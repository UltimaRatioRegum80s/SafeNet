import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import path from "path";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { logIncidentCreate } from './middleware/telemetry.js';
import { storage } from "./storage";
import passport from "passport";
import { setupOAuth, setupOAuthRoutes } from "./auth/oauth";

const PgSession = ConnectPgSimple(session);

const app = express();

// Trust proxy - required for secure cookies behind Replit's proxy
app.set('trust proxy', 1);

// CORS: pin production to explicit origins, while allowing this Replit
// workspace's exact preview domains during development.
const configuredOrigins = (
  process.env.ALLOWED_ORIGINS ||
  (process.env.NODE_ENV === 'production'
    ? 'https://nabornet.io,https://www.nabornet.io'
    : 'http://localhost:5000,http://localhost:5001,http://127.0.0.1:5000')
).split(',').map(s => s.trim()).filter(Boolean);

const replitPreviewOrigins = process.env.NODE_ENV === 'production'
  ? []
  : [process.env.REPLIT_DEV_DOMAIN, ...(process.env.REPLIT_DOMAINS || '').split(',')]
      .map(domain => domain?.trim())
      .filter((domain): domain is string => Boolean(domain))
      .map(domain => domain.replace(/^https?:\/\//, ''))
      .filter(domain => domain.endsWith('.replit.dev'))
      .map(domain => `https://${domain}`);

const ALLOWED_ORIGINS = new Set([...configuredOrigins, ...replitPreviewOrigins]);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// Probe and health endpoints
app.get("/api/healthz", (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.get("/api/readyz", async (_req, res) => {
  try {
    const { pool } = await import("./db");
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false });
  }
});

// Add telemetry for mobile incident creation monitoring
app.use(logIncidentCreate);

// Security: Fail fast if SESSION_SECRET is missing in production
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required in production");
}

// Session configuration
const isProduction = process.env.NODE_ENV === 'production';
const isSecure = isProduction || process.env.REPL_SLUG !== undefined; // Replit always uses HTTPS

app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'nabornet-session-secret-dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isSecure, // Enable secure cookies on HTTPS (Replit published apps use HTTPS)
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax', // 'lax' is safer and works for same-origin requests
    path: '/'
  }
}));

// Initialize Passport for OAuth
setupOAuth();
app.use(passport.initialize());
setupOAuthRoutes(app);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// DEPLOYMENT TRUTH: No-cache headers for HTML shell
// This ensures index.html is never cached by browser or CDN
app.use((req, res, next) => {
  const path = req.path;
  // Set no-cache for HTML shell requests (SPA routes that serve index.html)
  // Exclude API routes and static assets
  const isApiRoute = path.startsWith('/api/');
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map|webp|json)$/i.test(path);
  const isUpload = path.startsWith('/uploads/');
  const isObject = path.startsWith('/objects/');
  
  if (!isApiRoute && !isStaticAsset && !isUpload && !isObject) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Static file serving for uploads with protective headers
app.use("/uploads", (req, res, next) => {
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Robots-Tag", "noindex");
  next();
});

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "public/uploads"), {
    immutable: true,
    maxAge: "365d",
  })
);

// Register object storage routes for serving uploaded files
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
registerObjectStorageRoutes(app);

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Security: Don't re-throw after responding to prevent process crashes
    console.error('Error handled:', err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start cleanup scheduler for old incidents and chat messages
    startCleanupScheduler();
  });
})();

// Cleanup scheduler - runs every 24 hours to remove incidents and chat messages older than 7 days
function startCleanupScheduler() {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  // Run cleanup immediately on startup (with a short delay)
  setTimeout(async () => {
    try {
      await storage.cleanupOldData(7);
    } catch (error) {
      console.error('❌ [CLEANUP] Initial cleanup failed:', error);
    }
  }, 10000); // 10 second delay to let server fully start
  
  // Schedule regular cleanup every 24 hours
  setInterval(async () => {
    try {
      await storage.cleanupOldData(7);
    } catch (error) {
      console.error('❌ [CLEANUP] Scheduled cleanup failed:', error);
    }
  }, CLEANUP_INTERVAL);
  
  console.log('🧹 [CLEANUP] Scheduler started - will run every 24 hours for incidents and chat messages');
}
