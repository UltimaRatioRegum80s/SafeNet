import { Request, Response, NextFunction } from 'express';

// Light telemetry to spot mobile-only issues
export function logIncidentCreate(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  res.on("finish", () => {
    if (req.path === "/api/incidents" && req.method === "POST") {
      console.log("[INCIDENT_CREATE]", {
        status: res.statusCode,
        ms: Date.now() - started,
        uaMobile: /Mobile|Android|iPhone|iPad/i.test(req.headers["user-agent"] || ""),
      });
    }
  });
  next();
}