import { Router } from "express";
import { storage } from "../storage";
// Note: Auth middleware is defined in routes.ts, will mount there
import { insertAbuseReportSchema } from "@shared/schema";
import { checkRateLimit } from "../incidentDatabase";

const router = Router();

// Auth middleware imported from routes.ts
async function requireAuthOptional(req: any, res: any, next: any) {
  const uid = req.session?.userId || req.headers["x-user-id"];
  if (uid) req.authUserId = uid;
  next();
}

async function requireModerator(req: any, res: any, next: any) {
  const uid = req.session?.userId || req.headers["x-user-id"];
  if (!uid) return res.status(401).json({ error: "Authentication required" });
  
  try {
    const user = await storage.getUser(uid);
    if (!user?.isVerified || !user.verifiedType) {
      return res.status(403).json({ error: "Moderator access required" });
    }
    req.authUserId = uid;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Authentication error" });
  }
}

// Rate-limited abuse reporting endpoint
router.post("/incidents/:id/abuse-report", requireAuthOptional, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req.session as any)?.userId ?? null;
    const ip = req.headers["x-forwarded-for"]?.toString() ?? req.socket.remoteAddress ?? "0.0.0.0";

    // Rate limit using existing system pattern
    const reporterId = userId ?? ip;
    if (!checkRateLimit(reporterId, !userId)) {
      return res.status(429).json({ 
        ok: false, 
        error: "Too many reports. Please wait before reporting again." 
      });
    }

    // Validate request body
    const validatedData = insertAbuseReportSchema.parse({
      incidentId: id,
      ...req.body
    });

    // Create abuse report
    await storage.createAbuseReport({
      ...validatedData,
      reporterUserId: userId
    });

    return res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Rate limit')) {
      return res.status(429).json({ 
        ok: false, 
        error: "Too many reports. Please wait before reporting again." 
      });
    }
    next(error);
  }
});

// Moderator queue endpoint
router.get("/moderation/queue", requireModerator, async (req, res, next) => {
  try {
    const queueItems = await storage.getModerationQueue();
    return res.json({ ok: true, items: queueItems });
  } catch (error) {
    next(error);
  }
});

// Moderation action endpoint (approve/reject)
router.post("/moderation/incidents/:id/action", requireModerator, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action } = req.body as { action?: "approve" | "reject" };
    
    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid action. Must be 'approve' or 'reject'" 
      });
    }

    // Update shadow status
    const isShadowHidden = action === "reject";
    await storage.updateIncidentShadowStatus(id, isShadowHidden);

    // Notify via socket
    const io = req.app.get("io");
    io?.to("moderators").emit("incident:moderated", { id, action });

    return res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;