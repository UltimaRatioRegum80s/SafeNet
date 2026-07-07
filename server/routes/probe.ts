import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { sql, and, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { incidents } from "../../shared/schema";
import { storage } from "../storage";

// Moderator check - copied from routes.ts to avoid circular imports
const MODERATOR_TYPES = new Set(["police", "municipal", "security", "fire", "medical", "ngo"]);

async function requireModerator(req: Request, res: Response, next: NextFunction) {
  const uid = (req.session as any)?.userId || (req.headers["x-user-id"] as string);
  if (!uid) return res.status(401).json({ error: "Authentication required" });

  try {
    const user = await storage.getUser(uid);
    if (!user) return res.status(401).json({ error: "User not found" });
    
    // Check if user is verified and has moderator privileges
    if (!(user.isVerified && user.verifiedType && MODERATOR_TYPES.has(String(user.verifiedType)))) {
      return res.status(403).json({ error: "Moderator privileges required" });
    }
    
    (req as any).authUserId = uid;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Authorization check failed" });
  }
}

export const probeRouter = Router();

/**
 * 1) Socket canary — emits a fake incident to verify WS delivery
 *    No DB write, ignored by clients (we filter __probe__ on the frontend).
 *    Moderator-only for security.
 */
probeRouter.post("/socket-canary", requireModerator, (req: Request, res: Response) => {
  const probeId = `probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Get io from request context (set in routes.ts)
  const io = (req as any).io;
  if (!io) {
    return res.status(500).json({ ok: false, error: "Socket.IO not available" });
  }

  // Mimic toApiIncident() public payload shape
  const payload = {
    id: probeId,
    type: "__probe__",
    title: "socket probe",
    description: "connectivity check",
    latitude: -33.9249,
    longitude: 18.4241,
    severity: "low",
    category: "__probe__",
    photos: [],
    state: "validated",
    status: "validated",
    metadata: { probe: true, source: "socket-canary" },
    isAnonymous: true,
    createdAt: new Date().toISOString(),
  };

  io.emit("incident:created", payload); // broadcast public view
  return res.json({ ok: true, id: probeId });
});

/**
 * 2) BBox echo — returns server-parsed bbox + count only (fast diag).
 *    Moderator-only. sinceHours optional.
 */
probeRouter.get("/bbox-echo", requireModerator, async (req: Request, res: Response) => {
  const bbox = String(req.query.bbox || "");
  const sinceHours = Number(req.query.sinceHours ?? 72);

  const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);
  if ([minLng, minLat, maxLng, maxLat].some((n) => Number.isNaN(n))) {
    return res.status(400).json({ ok: false, error: "Invalid bbox" });
  }

  // Use decimal comparison for coordinate columns
  const since = sql`now() - interval '${sinceHours} hours'`;
  const where = and(
    gte(incidents.longitude, minLng.toString()),
    lte(incidents.longitude, maxLng.toString()),
    gte(incidents.latitude, minLat.toString()),
    lte(incidents.latitude, maxLat.toString()),
    gte(incidents.createdAt as any, since)
  );

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(incidents)
    .where(where);

  return res.json({
    ok: true,
    bbox: { minLng, minLat, maxLng, maxLat },
    sinceHours,
    count: row?.count ?? 0,
  });
});

/**
 * 3) Health endpoints
 */
probeRouter.get("/healthz", (_req, res) => res.json({ ok: true, ts: Date.now() }));
probeRouter.get("/readyz", async (_req, res) => {
  try {
    await db.execute(sql`select 1`);
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false });
  }
});