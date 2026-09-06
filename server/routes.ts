import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertIncidentSchema, 
  insertReportSchema,
  insertFollowSchema,
  insertChatMessageSchema,
  insertBusinessSchema,
  insertEventSchema,
  insertDrivebyRequestSchema,
  insertPushSubscriptionSchema,
  insertIncidentResponseSchema,
  RESPONSE_SIGNALS,
  signupSchema,
  loginSchema,
  anonJoinSchema,
  incidentComments,
  incidentReviews,
  users,
  loginAttempts,
  passwordResetTokens,
  landingBackgrounds,
  LANDING_SECTIONS
} from "@shared/schema";
import {
  createUser,
  createAnonymousUser,
  validateLogin,
  findUserByEmail
} from "./auth";
import { getCitiesByCountry, getNeighbourhoodsByCity, getSupportedCountries } from "./locationService";
import { Server as SocketIOServer } from "socket.io";
import { incidentDB, validateIncidentData, checkRateLimit, type CreateIncidentData } from "./incidentDatabase";
import { db } from "./db";
import { sql, and, eq, count, isNull, gte, desc } from "drizzle-orm";
import { sanitizeText, normalizeText, validateCoordinates, incidentContentKey } from "./lib/dedupe";
import { sanitizePlainText } from "./util/sanitize";
import { normalizeIncidentCoords } from "@shared/schema";
import { isModeratorOrAdmin } from "./auth/rbac";
import { assertIdempotency, storeIdempotencyResult, getIdempotencyResult } from "./lib/idempotency";
import uploadsRouter from "./routes/uploads";
import { limitUploads } from "./middleware/rateLimitUploads";
import { limitReactions } from "./middleware/rateLimitReactions";
import { sendIncidentPush } from "./push";
import moderationRouter from "./routes/moderation";
import { generateToken, hashToken, sendVerificationEmail, sendPasswordResetEmail } from "./email";
import { 
  canCreateIncidentAtLocation, 
  getVisibilityScope, 
  getCountryCode,
  isWhitelistedEmail,
  isKenyaFieldTestEnabled 
} from "./lib/geoPolicy";
import { 
  isValidIncidentType, 
  inferTaxonomyVersion,
  CURRENT_TAXONOMY_VERSION 
} from "./lib/taxonomyV2";

// Signup mode: 'open' (anyone can sign up) or 'whitelist' (only allowed emails)
const SIGNUP_MODE = process.env.SIGNUP_MODE || 'whitelist';
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || 'nabornetinfo@gmail.com,dwmoolman@gmail.com,carlin.king@gmail.com').split(',').map(e => e.trim().toLowerCase());

// Kill switches for operational control (env vars checked at runtime, require process restart)
const INCIDENT_CREATION_ENABLED = process.env.INCIDENT_CREATION_ENABLED !== 'false'; // default: enabled
const OFFLINE_SYNC_ENABLED = process.env.OFFLINE_SYNC_ENABLED !== 'false'; // default: enabled

// Email verification constants
const EMAIL_VERIFICATION_EXPIRES_HOURS = 24;
const EMAIL_RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_MAX_DAILY_SENDS = 5;

// Login rate limiting constants
const LOGIN_LOCKOUT_THRESHOLD = 5; // attempts before lockout
const LOGIN_LOCKOUT_DURATION_MINUTES = 15;
const LOGIN_WINDOW_MINUTES = 15;

// Note: sanitizeText moved to server/lib/dedupe.ts for better organization

// Security: RBAC helpers
const MODERATOR_TYPES = new Set(["police", "municipal", "security", "fire", "medical", "ngo"]);

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Security: Only use session-based auth in production
  const isDev = process.env.NODE_ENV !== 'production';
  const uid = (req.session as any)?.userId || (isDev ? (req.headers["x-user-id"] as string) : null);
  if (!uid) return res.status(401).json({ error: "Authentication required" });
  (req as any).authUserId = uid;
  next();
}

async function requireAuthOptional(req: Request, res: Response, next: NextFunction) {
  // Security: Only use session-based auth in production
  const isDev = process.env.NODE_ENV !== 'production';
  const uid = (req.session as any)?.userId || (isDev ? (req.headers["x-user-id"] as string) : null);
  if (uid) (req as any).authUserId = uid;
  next();
}

async function requireEmailVerified(req: Request, res: Response, next: NextFunction) {
  const isDev = process.env.NODE_ENV !== 'production';
  const uid = (req.session as any)?.userId || (isDev ? (req.headers["x-user-id"] as string) : null);
  if (!uid) return res.status(401).json({ error: "Authentication required" });
  
  try {
    const result = await db.select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    
    if (result.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }
    
    if (!result[0].emailVerified) {
      return res.status(403).json({ 
        error: "Email verification required to perform this action",
        code: "EMAIL_NOT_VERIFIED"
      });
    }
    
    (req as any).authUserId = uid;
    next();
  } catch (error) {
    console.error('Email verification check failed:', error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ADMIN_EMAILS for access approval (comma-separated)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

async function requireApprovedAccess(req: Request, res: Response, next: NextFunction) {
  const isDev = process.env.NODE_ENV !== 'production';
  const uid = (req.session as any)?.userId || (isDev ? (req.headers["x-user-id"] as string) : null);
  if (!uid) return res.status(401).json({ error: "Authentication required" });

  try {
    const result = await db.select({ accessStatus: users.accessStatus })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    if (result.length === 0) return res.status(401).json({ error: "User not found" });
    if (result[0].accessStatus !== 'approved') {
      return res.status(403).json({ error: "Access not yet approved", code: "ACCESS_PENDING" });
    }
    (req as any).authUserId = uid;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Access check failed" });
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const isDev = process.env.NODE_ENV !== 'production';
  const uid = (req.session as any)?.userId || (isDev ? (req.headers["x-user-id"] as string) : null);
  if (!uid) return res.status(401).json({ error: "Authentication required" });

  try {
    const user = await storage.getUser(uid);
    if (!user) return res.status(401).json({ error: "User not found" });

    const isAdmin = user.roles?.includes('admin') ||
      (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
    if (!isAdmin) return res.status(403).json({ error: "Admin privileges required" });

    (req as any).authUserId = uid;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Admin check failed" });
  }
}

async function requireModerator(req: Request, res: Response, next: NextFunction) {
  // Security: Only use session-based auth in production
  const isDev = process.env.NODE_ENV !== 'production';
  const uid = (req.session as any)?.userId || (isDev ? (req.headers["x-user-id"] as string) : null);
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Access gate: block pending/denied users from community API endpoints
  const ACCESS_GATE_EXEMPT = new Set([
    '/api/auth', '/api/legal', '/api/version',
    '/api/healthz', '/api/readyz', '/api/probe', '/api/e2e',
    '/api/access', '/api/admin', '/api/landing-backgrounds',
  ]);

  app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    const fullPath = `/api${path}`;

    if (ACCESS_GATE_EXEMPT.has(fullPath) || Array.from(ACCESS_GATE_EXEMPT).some(p => fullPath.startsWith(p + '/'))) {
      return next();
    }
    if (fullPath.startsWith('/api/auth')) return next();

    const isDev = process.env.NODE_ENV !== 'production';
    const uid = (req.session as any)?.userId || (isDev ? (req.headers["x-user-id"] as string) : null);
    if (!uid) return next();

    try {
      const result = await db.select({ accessStatus: users.accessStatus })
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);

      if (result.length > 0 && result[0].accessStatus !== 'approved') {
        return res.status(403).json({ error: "Access not yet approved", code: "ACCESS_PENDING" });
      }
    } catch (error) {
      console.error("Access gate check failed:", error);
    }
    next();
  });

  // Mount uploads router with rate limiting
  app.use("/api/uploads", limitUploads, requireAuthOptional, uploadsRouter);
  
  // Mount moderation routes
  app.use("/api", moderationRouter);
  
  // Mount probe routes for production diagnostics
  const { probeRouter } = await import("./routes/probe");
  app.use("/api/probe", probeRouter);
  
  // Legacy redirect for old /map links (301 permanent)
  app.get("/map", (_req, res) => res.redirect(301, "/community/map"));
  
  // Legal consent tracking endpoint
  app.post("/api/legal/consent", async (req, res) => {
    try {
      const { termsVersion, privacyVersion } = req.body;
      
      if (!termsVersion || !privacyVersion) {
        return res.status(400).json({ error: "Missing version information" });
      }
      
      const userId = (req.session as any)?.userId || null;
      const sessionId = req.sessionID || null;
      const ipAddress = req.ip || req.socket.remoteAddress || null;
      const userAgent = req.get('User-Agent') || null;
      
      await db.execute(sql`
        INSERT INTO legal_consents (user_id, session_id, terms_version, privacy_version, ip_address, user_agent)
        VALUES (${userId}, ${sessionId}, ${termsVersion}, ${privacyVersion}, ${ipAddress}, ${userAgent})
      `);
      
      console.log(`📋 [LEGAL] Consent recorded: user=${userId || 'anonymous'}, terms=${termsVersion}, privacy=${privacyVersion}`);
      
      res.json({ ok: true, recorded: true });
    } catch (error) {
      console.error("Failed to record consent:", error);
      res.status(500).json({ error: "Failed to record consent" });
    }
  });
  
  // Authentication routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, username, country, city, neighbourhood } = signupSchema.parse(req.body);
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const normalizedEmail = email.toLowerCase().trim();
      
      // SECURITY: Check signup mode and whitelist
      if (SIGNUP_MODE === 'whitelist' && !ALLOWED_EMAILS.includes(normalizedEmail)) {
        const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const origin = req.get('Origin') || req.get('Referer') || 'direct';
        
        console.log(`🚨 [SECURITY] UNAUTHORIZED SIGNUP ATTEMPT:
          📧 Email: ${email}
          👤 Username: ${username}
          🌍 Location: ${city}, ${country}
          🏠 Neighborhood: ${neighbourhood || 'none'}
          🌐 IP: ${clientIP}
          🖥️  User Agent: ${userAgent}
          🔗 Origin: ${origin}
          ⏰ Time: ${new Date().toISOString()}
        `);
        
        return res.status(403).json({ error: "Registration is currently restricted during beta phase. Contact us for access." });
      }
      
      // Validate input
      if (!email || !password || !username || !country || !city) {
        return res.status(400).json({ error: "All required fields must be provided" });
      }
      
      // Check if user already exists. This previously looked the email up in
      // the *username* column, so it never matched and a repeat signup fell
      // through to a raw unique-constraint error from the database.
      const existingUser = await findUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists with this email" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Generate email verification token
      const verificationToken = generateToken();
      const verificationTokenHash = hashToken(verificationToken);
      const verificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRES_HOURS * 60 * 60 * 1000);
      
      const newUser = await storage.createUser({
        email: normalizedEmail,
        passwordHash: hashedPassword,
        username,
        country,
        city,
        neighbourhood: neighbourhood || null,
        // Every account starts as a resident. Representing a municipality,
        // police station, fire brigade or security service is NOT granted at
        // registration: it is claimed afterwards through the Community
        // Services organisation application, which an administrator who does
        // not own the application must verify. ("user" was not a role any
        // other part of the app recognises — App.tsx feeds roles[0] straight
        // into the role selector.)
        roles: ["resident"],
        isVerified: false,
        verifiedType: null
      });
      
      // Update user with verification token
      await db.update(users)
        .set({
          emailVerificationTokenHash: verificationTokenHash,
          emailVerificationExpires: verificationExpires,
          emailVerificationSentAt: new Date(),
          emailVerificationCount: 1,
          emailVerificationCountResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })
        .where(eq(users.id, newUser.id));
      
      // Send verification email (non-blocking)
      sendVerificationEmail(normalizedEmail, verificationToken, username).catch(err => {
        console.error('Failed to send verification email:', err);
      });
      
      const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const origin = req.get('Origin') || req.get('Referer') || 'direct';
      
      console.log(`✅ [SIGNUP] USER REGISTERED (pending verification):
        📧 Email: ${normalizedEmail}
        👤 Username: ${username} 
        🌍 Location: ${city}, ${country}
        🏠 Neighborhood: ${neighbourhood || 'none'}
        🌐 IP: ${clientIP}
        🖥️  User Agent: ${userAgent}
        🔗 Origin: ${origin}
        ⏰ Time: ${new Date().toISOString()}
      `);
      
      // Session fixation mitigation: regenerate session ID before storing user
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          console.error("Session regeneration failed after signup:", regenErr);
          return res.status(500).json({ error: "Signup failed" });
        }
        
        (req.session as any).userId = newUser.id;
        
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save failed after signup:", saveErr);
            return res.status(500).json({ error: "Signup failed" });
          }
          
          res.json({ 
            ok: true, 
            user: { 
              id: newUser.id, 
              username: newUser.username, 
              roles: newUser.roles, 
              country: newUser.country, 
              city: newUser.city,
              neighbourhood: newUser.neighbourhood,
              emailVerified: false,
              // Report the real access status. Omitting it made the client
              // fall back to 'approved' (App.tsx: `user.accessStatus ||
              // 'approved'`), so a new account saw the full app until the
              // next reload bounced it to /pending.
              accessStatus: newUser.accessStatus || 'pending'
            },
            message: "Account created! Please check your email to verify your account."
          });
        });
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const normalizedEmail = email.toLowerCase().trim();
      const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      
      // Validate input
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      
      // Check for rate limiting (exponential backoff)
      const windowStart = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);
      const recentAttempts = await db.select({ count: count() })
        .from(loginAttempts)
        .where(and(
          eq(sql`lower(${loginAttempts.email})`, normalizedEmail),
          gte(loginAttempts.attemptedAt, windowStart),
          eq(loginAttempts.success, false)
        ));
      
      const failedCount = recentAttempts[0]?.count || 0;
      if (failedCount >= LOGIN_LOCKOUT_THRESHOLD) {
        console.log(`🔒 [SECURITY] Login locked for ${normalizedEmail} - too many failed attempts`);
        return res.status(429).json({ 
          error: `Too many failed login attempts. Please try again in ${LOGIN_LOCKOUT_DURATION_MINUTES} minutes.`,
          lockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString()
        });
      }
      
      const user = await validateLogin(email, password);
      
      // Log the attempt
      await db.insert(loginAttempts).values({
        email: normalizedEmail,
        ipAddress: clientIP,
        userAgent,
        success: !!user
      });
      
      if (!user) {
        console.log(`❌ [AUTH] Failed login attempt for ${normalizedEmail} from ${clientIP}`);
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      // Session fixation mitigation: regenerate session ID before storing user
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          console.error("Session regeneration failed:", regenErr);
          return res.status(500).json({ error: "Login failed" });
        }
        
        (req.session as any).userId = user.id;
        
        req.session.save(async (saveErr) => {
          if (saveErr) {
            console.error("Session save failed:", saveErr);
            return res.status(500).json({ error: "Login failed" });
          }
          
          const userRecord = await db.select({ emailVerified: users.emailVerified })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);
          
          console.log(`✅ [AUTH] Successful login for ${normalizedEmail} from ${clientIP}`);
          
          res.json({ 
            ok: true, 
            user: { 
              id: user.id, 
              username: user.username, 
              roles: user.roles, 
              country: user.country, 
              city: user.city,
              neighbourhood: user.neighbourhood,
              emailVerified: userRecord[0]?.emailVerified || false
            } 
          });
        });
      });
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle validation errors differently
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid email or password format" });
      }
      
      res.status(500).json({ error: "An error occurred during login. Please try again." });
    }
  });
  
  // Email verification endpoint
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Verification token is required" });
      }
      
      const tokenHash = hashToken(token);
      
      // Find user with matching token that hasn't expired
      const result = await db.select()
        .from(users)
        .where(and(
          eq(users.emailVerificationTokenHash, tokenHash),
          gte(users.emailVerificationExpires, new Date())
        ))
        .limit(1);
      
      if (result.length === 0) {
        return res.status(400).json({ error: "Invalid or expired verification link. Please request a new one." });
      }
      
      const user = result[0];
      
      // Mark email as verified
      await db.update(users)
        .set({
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpires: null
        })
        .where(eq(users.id, user.id));
      
      console.log(`✅ [EMAIL] Email verified for user ${user.email}`);
      
      res.json({ ok: true, message: "Email verified successfully! You can now create reports." });
    } catch (error: any) {
      console.error('Email verification error:', error);
      res.status(500).json({ error: "Failed to verify email. Please try again." });
    }
  });
  
  // Resend verification email
  app.post("/api/auth/resend-verification", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).authUserId;
      
      const result = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (result.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const user = result[0];
      
      if (user.emailVerified) {
        return res.status(400).json({ error: "Email is already verified" });
      }
      
      if (!user.email) {
        return res.status(400).json({ error: "No email address on file" });
      }
      
      // Check cooldown (60 seconds)
      if (user.emailVerificationSentAt) {
        const cooldownEnd = new Date(user.emailVerificationSentAt.getTime() + EMAIL_RESEND_COOLDOWN_SECONDS * 1000);
        if (new Date() < cooldownEnd) {
          const secondsRemaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
          return res.status(429).json({ 
            error: `Please wait ${secondsRemaining} seconds before requesting another email`,
            retryAfter: secondsRemaining
          });
        }
      }
      
      // Check daily limit
      const now = new Date();
      let dailyCount = user.emailVerificationCount || 0;
      
      if (user.emailVerificationCountResetAt && now > user.emailVerificationCountResetAt) {
        dailyCount = 0;
      }
      
      if (dailyCount >= EMAIL_MAX_DAILY_SENDS) {
        return res.status(429).json({ error: "Maximum verification emails sent for today. Please try again tomorrow." });
      }
      
      // Generate new token
      const verificationToken = generateToken();
      const verificationTokenHash = hashToken(verificationToken);
      const verificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRES_HOURS * 60 * 60 * 1000);
      
      await db.update(users)
        .set({
          emailVerificationTokenHash: verificationTokenHash,
          emailVerificationExpires: verificationExpires,
          emailVerificationSentAt: now,
          emailVerificationCount: dailyCount + 1,
          emailVerificationCountResetAt: user.emailVerificationCountResetAt && now <= user.emailVerificationCountResetAt 
            ? user.emailVerificationCountResetAt 
            : new Date(now.getTime() + 24 * 60 * 60 * 1000)
        })
        .where(eq(users.id, userId));
      
      await sendVerificationEmail(user.email, verificationToken, user.username);
      
      console.log(`📧 [EMAIL] Resent verification email to ${user.email}`);
      
      res.json({ ok: true, message: "Verification email sent!" });
    } catch (error: any) {
      console.error('Resend verification error:', error);
      res.status(500).json({ error: "Failed to send verification email" });
    }
  });
  
  // Forgot password - request reset
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const normalizedEmail = email.toLowerCase().trim();
      
      // Find user (don't reveal if email exists)
      const result = await db.select()
        .from(users)
        .where(eq(sql`lower(${users.email})`, normalizedEmail))
        .limit(1);
      
      // Always return success to prevent email enumeration
      if (result.length === 0) {
        console.log(`🔐 [AUTH] Password reset requested for unknown email: ${normalizedEmail}`);
        return res.json({ ok: true, message: "If that email exists, a reset link has been sent." });
      }
      
      const user = result[0];
      
      // Generate reset token
      const resetToken = generateToken();
      const resetTokenHash = hashToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Invalidate any existing reset tokens for this user
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt)
        ));
      
      // Create new reset token
      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: resetTokenHash,
        expiresAt
      });
      
      // Send reset email
      await sendPasswordResetEmail(user.email!, resetToken, user.username);
      
      console.log(`🔐 [AUTH] Password reset email sent to ${user.email}`);
      
      res.json({ ok: true, message: "If that email exists, a reset link has been sent." });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: "Failed to process request" });
    }
  });
  
  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      
      const tokenHash = hashToken(token);
      
      // Find valid reset token
      const result = await db.select()
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gte(passwordResetTokens.expiresAt, new Date())
        ))
        .limit(1);
      
      if (result.length === 0) {
        return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      }
      
      const resetRecord = result[0];
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Update user password
      await db.update(users)
        .set({
          passwordHash: hashedPassword,
          updatedAt: new Date()
        })
        .where(eq(users.id, resetRecord.userId));
      
      // Mark token as used
      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetRecord.id));
      
      console.log(`🔐 [AUTH] Password reset successfully for user ${resetRecord.userId}`);
      
      res.json({ ok: true, message: "Password reset successfully! You can now log in." });
    } catch (error: any) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.post("/api/auth/anon-join", async (req, res) => {
    try {
      const userData = anonJoinSchema.parse(req.body);
      
      // Check signup mode - enforce whitelist for closed beta
      if (SIGNUP_MODE === 'whitelist') {
        const normalizedEmail = userData.email?.toLowerCase().trim();
        if (!normalizedEmail || !ALLOWED_EMAILS.includes(normalizedEmail)) {
          return res.status(403).json({ 
            error: "Closed Beta: Registration is currently limited to invited users only. Please contact the NaborNet team for access." 
          });
        }
      }
      
      // Log anonymous join attempt with tracking info
      const clientIP = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';
      const origin = req.get('Origin') || req.get('Referer') || 'direct';
      
      console.log(`🕶️ [ANON-JOIN] ANONYMOUS USER ATTEMPT:
        🌍 Location: ${userData.city}, ${userData.country}
        🏠 Neighborhood: ${userData.neighbourhood || 'none'}
        🌐 IP: ${clientIP}
        🖥️  User Agent: ${userAgent}
        🔗 Origin: ${origin}
        ⏰ Time: ${new Date().toISOString()}
      `);
      
      const user = await createAnonymousUser(userData);
      
      // Store user in session
      (req.session as any).userId = user.id;
      
      res.json({ 
        ok: true, 
        user: { 
          id: user.id, 
          username: user.username, 
          roles: user.roles, 
          country: user.country, 
          city: user.city,
          neighbourhood: user.neighbourhood
        } 
      });
    } catch (error: any) {
      console.error('Anonymous join error:', error);
      
      // Handle specific database constraint errors
      if (error.code === '23505') {
        if (error.constraint === 'users_email_unique') {
          return res.status(400).json({ error: 'An account with this email address already exists. Please try logging in instead.' });
        }
        if (error.constraint === 'users_username_unique') {
          return res.status(400).json({ error: 'This username is already taken. Please choose a different one.' });
        }
      }
      
      res.status(400).json({ error: error.message || 'Unable to create account. Please try again.' });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Could not log out" });
      }
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  });

  // GeoPolicy status endpoint (public, for UI to show field test badges)
  app.get("/api/geo/status", (req, res) => {
    res.json({
      kenyaFieldTestEnabled: isKenyaFieldTestEnabled(),
    });
  });

  // Deployment truth endpoint - returns build version for verification
  app.get("/api/version", (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      version: "v2.1.1",
      timestamp: "2026-01-01T12:45:00Z",
      swDisabled: true,
      message: "SW DISABLED FOR DEPLOYMENT DEBUGGING"
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Get email verification status
      const userRecord = await db.select({ emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          roles: user.roles, 
          country: user.country, 
          city: user.city,
          neighbourhood: user.neighbourhood,
          emailVerified: userRecord[0]?.emailVerified || false,
          accessStatus: user.accessStatus || 'approved',
          oauthProvider: user.oauthProvider || null,
        } 
      });
    } catch (error: any) {
      console.error('Auth check error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // User routes
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update user location for geo-notifications
  app.post("/api/users/:id/location", async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      await storage.updateUserLocation(req.params.id, latitude, longitude);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Verify user (admin only)
  // Security: Admin/moderator only - verify user accounts
  app.post("/api/users/:id/verify", requireModerator, async (req, res) => {
    try {
      const { type, badge } = req.body;
      const user = await storage.verifyUser(req.params.id, type, badge);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // User location preference routes
  app.post("/api/users/home-location", requireAuth, async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      const userId = (req as any).authUserId;
      
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ error: "Valid latitude and longitude required" });
      }
      
      await storage.updateUserHomeLocation(userId, latitude, longitude);
      res.json({ ok: true, message: "Home location updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update home location" });
    }
  });

  app.post("/api/users/interest-location", requireAuth, async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      const userId = (req as any).authUserId;
      
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ error: "Valid latitude and longitude required" });
      }
      
      await storage.updateUserInterestLocation(userId, latitude, longitude);
      res.json({ ok: true, message: "Interest location updated successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update interest location" });
    }
  });

  // Helper functions for robust incident creation
  const toNumber = (v: unknown) => (v === "" || v == null ? NaN : Number(v));
  const pickCoord = (b: any) => {
    // accept either lat/lng or latitude/longitude
    let lat = toNumber(b.lat ?? b.latitude);
    let lng = toNumber(b.lng ?? b.longitude);
    // detect & fix common swap
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) [lat, lng] = [lng, lat];
    return { lat, lng };
  };

  // Enhanced incident creation with duplicate detection, idempotency, and anonymous reporting
  // Requires email verification to prevent spam/abuse
  app.post("/api/incidents", requireEmailVerified, async (req, res) => {
    try {
      // Kill switch: Check if incident creation is enabled (offline sync also uses this route)
      const isOfflineSync = Boolean(req.body?.idempotencyKey);
      if (!INCIDENT_CREATION_ENABLED) {
        return res.status(503).json({ error: "Incident reporting temporarily disabled" });
      }
      if (isOfflineSync && !OFFLINE_SYNC_ENABLED) {
        return res.status(503).json({ error: "Offline sync temporarily disabled" });
      }

      // First try flexible coordinate extraction
      const { type, note } = req.body ?? {};
      const { lat, lng } = pickCoord(req.body ?? {});
      
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.warn("[NN] 422 invalid coords", req.body);
        return res.status(422).json({ error: "Invalid coordinates" });
      }
      
      // Taxonomy v2: Validate incident type ID
      if (type && !isValidIncidentType(type)) {
        console.warn("[Taxonomy] Invalid type ID:", type);
        return res.status(400).json({ error: "Invalid incident type" });
      }

      // Then try Zod parsing for full validation, falling back to basic data
      let parsed, incidentData;
      try {
        parsed = insertIncidentSchema.parse(req.body);
        incidentData = normalizeIncidentCoords(parsed);
      } catch (zodError) {
        // Fallback to basic incident data if Zod validation fails
        incidentData = {
          type: type || "other",
          title: note?.slice(0, 120) ?? null,
          latitude: lat,
          longitude: lng,
          description: note || null,
          severity: "low", // Always ensure severity has a value
          category: "General",
          isAnonymous: false
        };
      }

      // Phase 2: Idempotency-Key support - DURABLE DB-BACKED
      const idempotencyKey = req.header("Idempotency-Key") || req.body?.idempotencyKey;
      if (idempotencyKey) {
        // First check DB for existing incident with this key (durable idempotency)
        const existingIncident = await storage.getIncidentByIdempotencyKey(idempotencyKey);
        if (existingIncident) {
          console.log(`[Idempotency] DB hit - returning existing incident for key: ${idempotencyKey.slice(0, 20)}...`);
          return res.json(toApiIncident(existingIncident, true));
        }
        
        // Fallback to in-memory cache for recent duplicates (belt + suspenders)
        const cachedResult = getIdempotencyResult(idempotencyKey);
        if (cachedResult) {
          console.log(`[Idempotency] Cache hit for key: ${idempotencyKey.slice(0, 20)}...`);
          return res.json(cachedResult);
        }
        if (!assertIdempotency(idempotencyKey)) {
          return res.status(409).json({ 
            error: "Duplicate submission detected"
          });
        }
      }

      // Security: Enhanced sanitization and validation
      const sanitizedData = {
        ...incidentData,
        title: sanitizeText(incidentData.title),
        description: sanitizeText(incidentData.description),
        // Guarantee severity is never null/undefined and ensure it's a valid enum value
        severity: (incidentData.severity && ["low", "medium", "high", "critical"].includes(incidentData.severity) 
                  ? incidentData.severity 
                  : "low") as "low" | "medium" | "high" | "critical",
      };

      // Validate coordinates are within supported region using GeoPolicy
      const latNum = Number(sanitizedData.latitude);
      const lonNum = Number(sanitizedData.longitude);
      
      // Get user email for geo policy check
      const userEmail = await (async () => {
        const uid = (req.session as any)?.userId;
        if (uid) {
          const user = await storage.getUser(uid);
          return user?.email || null;
        }
        return null;
      })();
      
      // Check if incident creation is allowed at this location
      const geoCheck = canCreateIncidentAtLocation({ lat: latNum, lng: lonNum }, userEmail);
      
      // PATCH D: Enhanced server-side logging for geo policy enforcement
      console.log("[GeoPolicy] Incident creation check:", {
        coords: { lat: latNum, lng: lonNum },
        userEmail: userEmail ? `${userEmail.slice(0, 3)}***` : null,
        allowed: geoCheck.allowed,
        reason: geoCheck.reason || null,
        kenyaFieldTestEnabled: isKenyaFieldTestEnabled(),
        isWhitelisted: userEmail ? isWhitelistedEmail(userEmail) : false,
      });
      
      if (!geoCheck.allowed) {
        console.warn("[GeoPolicy] Rejected incident creation:", {
          coords: { lat: latNum, lng: lonNum },
          reason: geoCheck.reason,
        });
        return res.status(400).json({ 
          error: geoCheck.reason || "Location outside supported region" 
        });
      }
      
      // Determine visibility scope and country code based on location
      const visibilityScope = getVisibilityScope({ lat: latNum, lng: lonNum });
      const countryCode = getCountryCode({ lat: latNum, lng: lonNum });
      
      // PATCH D: Log visibility scope assignment for debugging
      console.log("[GeoPolicy] Incident visibility:", {
        visibilityScope,
        countryCode,
        coords: { lat: latNum, lng: lonNum },
      });

      // Security: Enhanced rate limiting with configurable parameters
      const key = (req.session as any)?.userId || 
                 (req.headers["x-user-id"] as string) || 
                 `ip:${req.ip}`;

      const isAnonymous = Boolean(sanitizedData.isAnonymous);
      if (!checkRateLimit(key, isAnonymous)) {
        return res.status(429).json({ 
          error: "Too many reports, please slow down",
          retryAfter: 3
        });
      }

      const userId = key.startsWith("ip:") ? null : key;

      // Enhanced duplicate detection with configurable parameters
      const duplicateIncident = await storage.findDuplicateIncident(
        sanitizedData.type,
        latNum,
        lonNum
      );

      if (duplicateIncident) {
        // Increment duplicate count instead of creating new incident
        await storage.incrementDuplicateCount(duplicateIncident.id);
        const result = { ...duplicateIncident, isDuplicate: true };
        
        // Cache idempotent result
        if (idempotencyKey) {
          storeIdempotencyResult(idempotencyKey, result);
        }
        
        return res.json(result);
      }

      // Auto-flagging heuristics for quality control
      let isShadowHidden = false;
      
      // Velocity heuristic: Check if this user/IP is creating too many incidents
      try {
        // Use a stricter rate limit for burst detection
        const burstKey = `burst:${userId ?? req.ip}`;
        if (!checkRateLimit(burstKey, isAnonymous)) {
          isShadowHidden = true;
          console.log(`🚩 Shadow flagged: velocity burst for ${burstKey}`);
        }
      } catch (velocityError) {
        // If rate limit check fails, err on side of caution
        isShadowHidden = true;
      }

      // Text similarity heuristic: Check for similar descriptions nearby
      if (!isShadowHidden && sanitizedData.description && sanitizedData.description.length >= 10) {
        try {
          const { rows } = await db.execute(sql`
            SELECT 1
            FROM incidents
            WHERE created_at > NOW() - INTERVAL '5 minutes'
              AND similarity(description, ${sanitizedData.description}) > 0.5
              AND earth_distance(ll_to_earth(latitude::float, longitude::float), ll_to_earth(${lat}, ${lng})) < 300
            LIMIT 1
          `);
          if (rows && rows.length > 0) {
            isShadowHidden = true;
            console.log(`🚩 Shadow flagged: similar description detected`);
          }
        } catch (similarityError) {
          // If similarity check fails, continue without flagging
          console.warn('Similarity check failed:', similarityError);
        }
      }

      // Create new incident with shadow flag if detected by heuristics
      // Taxonomy v2: Infer version from type ID format
      const taxonomyVersion = type ? inferTaxonomyVersion(type) : CURRENT_TAXONOMY_VERSION;
      
      const incidentToCreate = { 
        ...sanitizedData, 
        userId,
        source: "gps" as const,
        isShadowHidden,
        idempotencyKey: idempotencyKey || null, // Store for durable idempotency
        visibilityScope, // GeoPolicy: public_beta or private_whitelist
        countryCode, // ISO 3166-1 alpha-2 country code
        taxonomyVersion, // Taxonomy version (1=legacy, 2=v2 group-based)
      };
      
      const incident = await storage.createIncident(incidentToCreate);
      
      // Send push notifications to neighborhood
      try {
        await sendIncidentPush(incident);
      } catch (pushError) {
        console.error('❌ Push notification failed:', pushError);
        // Don't fail the incident creation if push fails
      }
      
      // Cache idempotent result for successful creation
      if (idempotencyKey) {
        storeIdempotencyResult(idempotencyKey, incident);
      }
      
      // Return incident with status aliasing
      res.json(toApiIncident(incident, true)); // Reporter sees full data
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/incidents", requireAuthOptional, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 300, 1000);
      const bbox = (req.query.bbox as string | undefined)?.split(",").map(Number);
      const sinceHours = Number(req.query.sinceHours) || 168; // Default to 7 days (168 hours)
      const userId = req.query.userId as string | undefined;
      const requestingUserId = (req as any).authUserId as string | undefined;
      
      // Use private cache: response now includes personalized isOwnIncident field
      res.set('Cache-Control', 'private, max-age=60');
      
      let incidents;
      
      // If userId filtering is requested
      if (userId) {
        incidents = await storage.getIncidentsByUser(userId, sinceHours);
      }
      // If bbox filtering is requested and valid
      else if (bbox && bbox.length === 4 && bbox.every(Number.isFinite)) {
        const [minLng, minLat, maxLng, maxLat] = bbox;
        // Use nearby endpoint logic but adapted for bbox
        incidents = await storage.getIncidentsInBounds(minLat, minLng, maxLat, maxLng, sinceHours);
      } else {
        incidents = await storage.getIncidents(limit, sinceHours);
      }
      
      // Apply status aliasing, preserving userId for the owner so they can delete their own incidents
      const apiIncidents = incidents.map(inc => toApiIncident(inc, false, requestingUserId || null));
      
      // Simple array response for bbox queries (used by map), paginated response for regular queries
      if (bbox) {
        res.json(apiIncidents);
      } else {
        res.json({
          incidents: apiIncidents,
          pagination: {
            page,
            limit,
            hasMore: incidents.length === limit,
            total: incidents.length
          }
        });
      }
    } catch (error: any) {
      console.error('Error fetching incidents:', error);
      res.status(500).json({ error: "Failed to fetch incidents" });
    }
  });

  // Location-based feed: nearby incidents with time filtering
  // GET /api/incidents/nearby?lat=...&lng=...&radiusKm=5&sinceHours=72&category=...&severity=...
  // Uses requireAuthOptional to get user email for visibility filtering
  app.get("/api/incidents/nearby", requireAuthOptional, async (req, res) => {
    try {
      const { lat, lng, radiusKm = 5, sinceHours = 72, category, severity } = req.query;
      
      // Security: Robust numeric validation (prevents rejecting valid zeros)
      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ error: "Valid lat and lng coordinates required" });
      }
      
      // Radius in km (1/3/5/10), default 5km
      const radius = Number(radiusKm);
      const safeRadiusKm = Number.isFinite(radius) && radius > 0 && radius <= 50 ? radius : 5;
      
      // Time filtering: default 72h, allow up to 168h (7 days)
      const hours = Math.min(Math.max(Number(sinceHours) || 72, 1), 168);
      
      // Optional filters (category = incident type, severity = low/medium/high/critical)
      const categoryFilter = typeof category === 'string' && category.length > 0 ? category : undefined;
      const severityFilter = typeof severity === 'string' && severity.length > 0 ? severity : undefined;
      
      // Get user email for visibility filtering (GeoPolicy)
      let userEmail: string | null = null;
      const userId = (req as any).authUserId;
      if (userId) {
        const user = await storage.getUser(userId);
        userEmail = user?.email || null;
      }
      
      const incidents = await storage.getIncidentsNearby(latitude, longitude, safeRadiusKm, hours, categoryFilter, severityFilter, userEmail);
      // Apply status aliasing to nearby incidents, preserving userId for the owner
      const apiIncidents = incidents.map(inc => toApiIncident(inc, false, userId || null));
      res.json(apiIncidents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Enhanced moderation routes
  // Security: Moderator only - incident moderation
  app.post("/api/incidents/:id/moderate", requireModerator, async (req, res) => {
    try {
      const moderatorId = (req as any).authUserId; // From middleware
      const { reason } = req.body;
      await storage.moderateIncident(req.params.id, moderatorId, reason);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Security: Moderator only - resolve incident
  app.post("/api/incidents/:id/resolve", requireModerator, async (req, res) => {
    try {
      const moderatorId = (req as any).authUserId;
      const { resolveNote } = req.body;
      const incident = await storage.resolveIncident(req.params.id, moderatorId, resolveNote || "Resolved by moderator");
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Security: Moderator only - get anonymous incidents queue
  app.get("/api/mod/anonymous", requireModerator, async (req, res) => {
    try {
      const incidents = await storage.getAnonymousIncidentsQueue();
      res.json(incidents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Report incident route
  // Security: Require authentication for incident reporting
  app.post("/api/incidents/:id/report", requireAuth, async (req, res) => {
    try {
      const reportData = insertReportSchema.parse({
        ...req.body,
        incidentId: req.params.id
      });
      const reporterId = (req as any).authUserId; // From auth middleware
      const report = await storage.reportIncident({ ...reportData, reporterId });
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Follow incident routes
  // Security: Require authentication for following incidents  
  app.post("/api/incidents/:id/follow", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).authUserId; // From auth middleware
      const follow = await storage.followIncident({ 
        incidentId: req.params.id, 
        userId 
      });
      res.json(follow);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/incidents/:id/follow", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).authUserId; // From auth middleware
      await storage.unfollowIncident(userId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE - Owner deletes their own incident
  app.delete("/api/incidents/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).authUserId;
      const incidentId = req.params.id;
      const result = await storage.deleteIncident(incidentId, userId);
      if (result === "not_found") return res.status(404).json({ error: "Incident not found" });
      if (result === "forbidden") return res.status(403).json({ error: "You can only delete your own incidents" });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Phase 2: Incident Response routes (structured reactions)
  // POST - Upsert a response (one per user per incident)
  // Rate limited: 20 writes per 5 minutes per user
  app.post("/api/incidents/:id/respond", requireAuth, limitReactions, async (req, res) => {
    try {
      const userId = (req as any).authUserId;
      const incidentId = req.params.id;
      
      const responseData = insertIncidentResponseSchema.parse({
        incidentId,
        signal: req.body.signal,
      });
      
      const response = await storage.upsertResponse(incidentId, userId, responseData.signal);
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // DELETE - Remove user's response from an incident
  // Rate limited: 20 writes per 5 minutes per user
  app.delete("/api/incidents/:id/respond", requireAuth, limitReactions, async (req, res) => {
    try {
      const userId = (req as any).authUserId;
      const incidentId = req.params.id;
      
      await storage.deleteResponse(incidentId, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET - Get response counts for an incident (no auth required for viewing)
  app.get("/api/incidents/:id/responses", async (req, res) => {
    try {
      const incidentId = req.params.id;
      const counts = await storage.getResponseCounts(incidentId);
      res.json(counts);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // GET - Get current user's response for an incident
  app.get("/api/incidents/:id/my-response", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).authUserId;
      const incidentId = req.params.id;
      
      const response = await storage.getUserResponse(incidentId, userId);
      res.json(response || null);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Notifications routes
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // IP Geolocation fallback endpoint
  app.get("/api/geo/ip", async (req, res) => {
    try {
      // Get client IP address
      const clientIp = req.headers['x-forwarded-for'] || 
                      req.headers['x-real-ip'] || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress || 
                      (req.connection as any)?.socket?.remoteAddress ||
                      '127.0.0.1';

      // For localhost/development, return Windhoek coordinates
      if (clientIp === '127.0.0.1' || clientIp === '::1' || (clientIp as string).includes('localhost')) {
        return res.json({
          lat: -22.5609,
          lon: 17.0658,
          accuracy: 25000,
          city: 'Windhoek',
          country: 'Namibia',
          source: 'ip-fallback-dev'
        });
      }

      // In production, you could integrate with IP geolocation services like:
      // - ipapi.co
      // - ipgeolocation.io
      // - MaxMind GeoIP2
      // For now, return Southern Africa region center as fallback
      res.json({
        lat: -22.5609, // Windhoek, Namibia (regional center)
        lon: 17.0658,
        accuracy: 50000, // ~50km accuracy for IP-based geolocation
        city: 'Windhoek',
        country: 'Namibia',
        source: 'ip-fallback'
      });
    } catch (error: any) {
      console.error('IP geolocation error:', error);
      res.status(500).json({ error: "IP geolocation unavailable" });
    }
  });

  // Location API routes (with both singular and plural endpoints for compatibility)
  app.get("/api/location/countries", (req, res) => {
    try {
      const countries = getSupportedCountries();
      res.json({ countries });
    } catch (error: any) {
      console.error('Error fetching countries:', error);
      res.status(500).json({ error: "Failed to fetch countries" });
    }
  });

  app.get("/api/locations/countries", (req, res) => {
    try {
      const countries = getSupportedCountries();
      res.json({ countries });
    } catch (error: any) {
      console.error('Error fetching countries:', error);
      res.status(500).json({ error: "Failed to fetch countries" });
    }
  });

  app.get("/api/location/cities/:country", (req, res) => {
    try {
      const { country } = req.params;
      const cities = getCitiesByCountry(country);
      res.json({ cities: cities.map(city => ({ name: city.name, population: city.population })) });
    } catch (error: any) {
      console.error('Error fetching cities:', error);
      res.status(500).json({ error: "Failed to fetch cities" });
    }
  });

  app.get("/api/locations/cities/:country", (req, res) => {
    try {
      const { country } = req.params;
      const cities = getCitiesByCountry(country);
      res.json({ cities: cities.map(city => ({ name: city.name, population: city.population })) });
    } catch (error: any) {
      console.error('Error fetching cities:', error);
      res.status(500).json({ error: "Failed to fetch cities" });
    }
  });

  app.get("/api/location/neighbourhoods/:country/:city", (req, res) => {
    try {
      const { country, city } = req.params;
      const neighbourhoods = getNeighbourhoodsByCity(city, country);
      res.json({ neighbourhoods: neighbourhoods.map(n => ({ name: n.name, population: n.population })) });
    } catch (error: any) {
      console.error('Error fetching neighbourhoods:', error);
      res.status(500).json({ error: "Failed to fetch neighbourhoods" });
    }
  });

  app.get("/api/locations/neighbourhoods/:country/:city", (req, res) => {
    try {
      const { country, city } = req.params;
      const neighbourhoods = getNeighbourhoodsByCity(city, country);
      res.json({ neighbourhoods: neighbourhoods.map(n => ({ name: n.name, population: n.population })) });
    } catch (error: any) {
      console.error('Error fetching neighbourhoods:', error);
      res.status(500).json({ error: "Failed to fetch neighbourhoods" });
    }
  });

  // ------- Incident Comments -------

  // GET comments (basic pagination via offset)
  app.get("/api/incidents/:id/comments", async (req, res) => {
    try {
      const { id } = req.params;
      const limit = Math.min(Number(req.query.limit ?? 20), 100);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);

      const items = await db.query.incidentComments.findMany({
        where: and(
          eq(incidentComments.incidentId, id),
          isNull(incidentComments.deletedAt)
        ),
        orderBy: (t, { asc }) => [asc(t.createdAt)],
        limit,
        offset,
      });

      res.json({ items, nextOffset: items.length === limit ? offset + limit : null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST a comment
  app.post("/api/incidents/:id/comments", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { body } = req.body as { body: string };

      if (!body || typeof body !== "string" || body.trim().length === 0) {
        return res.status(400).json({ error: "Empty comment" });
      }

      const [row] = await db.insert(incidentComments).values({
        incidentId: id,
        userId: req.authUserId,
        body: sanitizePlainText(body, 1000),
      }).returning();

      req.io?.to(`incident:${id}`).emit("incident:comment:new", { incidentId: id, comment: row });
      res.status(201).json(row);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE soft-delete comment with RBAC
  app.delete("/api/incidents/:incidentId/comments/:commentId", requireAuth, async (req: any, res) => {
    try {
      const { incidentId, commentId } = req.params;
      
      // 1) Load comment to check ownership (and ensure it belongs to the incident)
      const comment = await db.query.incidentComments.findFirst({
        columns: { id: true, userId: true, incidentId: true, deletedAt: true },
        where: and(
          eq(incidentComments.id, commentId),
          eq(incidentComments.incidentId, incidentId)
        ),
      });

      if (!comment) return res.status(404).json({ error: "Comment not found" });
      if (comment.deletedAt) return res.status(204).end(); // already deleted

      // Get user for RBAC check
      const user = await storage.getUser(req.authUserId);
      if (!user) return res.status(401).json({ error: "User not found" });

      const isOwner = comment.userId === user.id;
      const isMod = isModeratorOrAdmin(user);

      if (!isOwner && !isMod) {
        return res.status(403).json({ error: "Not allowed" });
      }

      // 2) Soft delete
      await db.update(incidentComments)
        .set({ deletedAt: new Date() })
        .where(eq(incidentComments.id, commentId));

      // 3) Notify room
      req.io?.to(`incident:${incidentId}`).emit("incident:comment:deleted", {
        incidentId,
        commentId,
      });

      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ------- Reviews (someone took a look) -------

  // GET review summary incl. my state
  app.get("/api/incidents/:id/reviews", async (req: any, res) => {
    try {
      const { id } = req.params;

      const [{ c }] = await db.select({ c: count() })
        .from(incidentReviews)
        .where(eq(incidentReviews.incidentId, id));

      let reviewedByMe = false;
      const userId = (req.session as any)?.userId;
      if (userId) {
        const mine = await db.query.incidentReviews.findFirst({
          where: and(eq(incidentReviews.incidentId, id), eq(incidentReviews.userId, userId)),
        });
        reviewedByMe = !!mine;
      }

      res.json({ count: Number(c), reviewedByMe });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT toggle review for current user
  app.put("/api/incidents/:id/reviews/toggle", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.authUserId;

      const existing = await db.query.incidentReviews.findFirst({
        where: and(eq(incidentReviews.incidentId, id), eq(incidentReviews.userId, userId)),
      });

      if (existing) {
        await db.delete(incidentReviews)
          .where(and(eq(incidentReviews.incidentId, id), eq(incidentReviews.userId, userId)));
      } else {
        await db.insert(incidentReviews).values({ incidentId: id, userId });
      }

      const [{ c }] = await db.select({ c: count() })
        .from(incidentReviews)
        .where(eq(incidentReviews.incidentId, id));

      const reviewedByMe = !existing;
      req.io?.to(`incident:${id}`).emit("incident:review:count", { incidentId: id, count: Number(c) });
      res.json({ reviewed: reviewedByMe, count: Number(c) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Community chat routes
  app.post("/api/chat/:room", async (req, res) => {
    try {
      const { room } = req.params;
      const messageData = insertChatMessageSchema.parse({
        ...req.body,
        room
      });
      
      const userId = req.headers['x-user-id'] as string || null;
      const message = await storage.createChatMessage({ ...messageData, userId });
      
      // Broadcast to connected clients via WebSocket
      io.to(`chat:${room}`).emit("message", message);
      
      res.json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/chat/:room", async (req, res) => {
    try {
      const { room } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      // Default to 7-day filtering (168 hours) like incidents
      const messages = await storage.getChatHistory(room, limit, 168);
      res.json(messages.reverse()); // Return in chronological order
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Real-time incident endpoints
  app.get("/api/incidents/live", async (req, res) => {
    try {
      const since = req.query.since ? parseInt(req.query.since as string) : (Date.now() - 24 * 60 * 60 * 1000);
      const incidents = await storage.getIncidents();
      const filtered = incidents.filter(i => i.createdAt && new Date(i.createdAt).getTime() > since);
      // Apply status aliasing to live incidents
      const apiIncidents = filtered.map(inc => toApiIncident(inc, false));
      res.json(apiIncidents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Phase 2: Community Business routes
  app.post("/api/businesses", requireAuth, async (req, res) => {
    try {
      const businessData = insertBusinessSchema.parse(req.body);
      const business = await storage.createBusiness({
        ...businessData,
        ownerId: (req as any).authUserId
      });
      res.json({ ok: true, business });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid business data" });
    }
  });

  app.get("/api/businesses/nearby", async (req, res) => {
    try {
      const { lat, lng, radius = 2000 } = req.query;
      if (!lat || !lng) return res.status(400).json({ error: "Coordinates required" });
      
      const businesses = await storage.getBusinessesNearby(
        Number(lat), 
        Number(lng), 
        Number(radius)
      );
      res.json(businesses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch businesses" });
    }
  });

  // Phase 2: Community Events routes
  app.post("/api/events", requireAuth, async (req, res) => {
    try {
      const eventData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent({
        ...eventData,
        organizerId: (req as any).authUserId
      });
      res.json({ ok: true, event });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid event data" });
    }
  });

  app.get("/api/events/nearby", async (req, res) => {
    try {
      const { lat, lng, radius = 5000, sinceHours = 0, untilHours = 168 } = req.query;
      if (!lat || !lng) return res.status(400).json({ error: "Coordinates required" });
      
      const events = await storage.getEventsNearby(
        Number(lat), 
        Number(lng), 
        Number(radius),
        Number(sinceHours),
        Number(untilHours)
      );
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/promotions/nearby", async (req, res) => {
    try {
      const { lat, lng, radius = 5000 } = req.query;
      if (!lat || !lng) return res.status(400).json({ error: "Coordinates required" });
      
      const promotions = await storage.getActivePromotions(
        Number(lat), 
        Number(lng), 
        Number(radius)
      );
      res.json(promotions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch promotions" });
    }
  });

  // Phase 2: Drive-by Security Request routes
  app.post("/api/driveby-requests", requireAuth, async (req, res) => {
    try {
      const requestData = insertDrivebyRequestSchema.parse(req.body);
      const request = await storage.createDrivebyRequest({
        ...requestData,
        requesterId: (req as any).authUserId
      });
      res.json({ ok: true, request });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request data" });
    }
  });

  app.get("/api/driveby-requests", requireAuth, async (req, res) => {
    try {
      const requests = await storage.getUserDrivebyRequests((req as any).authUserId);
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  });

  app.get("/api/driveby-requests/inbox", requireModerator, async (req, res) => {
    try {
      const requests = await storage.getDrivebyInbox();
      res.json(requests);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inbox" });
    }
  });

  app.post("/api/driveby-requests/:id/accept", requireModerator, async (req, res) => {
    try {
      const { estimatedArrival } = req.body;
      const request = await storage.acceptDrivebyRequest(
        req.params.id, 
        (req as any).authUserId,
        estimatedArrival ? new Date(estimatedArrival) : undefined
      );
      res.json({ ok: true, request });
    } catch (error) {
      res.status(500).json({ error: "Failed to accept request" });
    }
  });

  app.post("/api/driveby-requests/:id/complete", requireModerator, async (req, res) => {
    try {
      const { completionNotes } = req.body;
      const request = await storage.completeDrivebyRequest(req.params.id, sanitizeText(completionNotes));
      res.json({ ok: true, request });
    } catch (error) {
      res.status(500).json({ error: "Failed to complete request" });
    }
  });

  // Phase 2: Enhanced incident authority actions
  app.post("/api/incidents/:id/acknowledge", requireModerator, async (req, res) => {
    try {
      const incident = await storage.acknowledgeIncident(req.params.id, (req as any).authUserId);
      res.json({ ok: true, incident });
    } catch (error) {
      res.status(500).json({ error: "Failed to acknowledge incident" });
    }
  });

  app.post("/api/incidents/:id/resolve", requireModerator, async (req, res) => {
    try {
      const { resolveNote } = req.body;
      const incident = await storage.resolveIncident(
        req.params.id, 
        (req as any).authUserId, 
        sanitizeText(resolveNote)
      );
      res.json({ ok: true, incident });
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve incident" });
    }
  });

  // Push notification routes
  app.post("/api/push/subscribe", requireAuthOptional, async (req, res) => {
    try {
      const subscriptionData = insertPushSubscriptionSchema.parse(req.body);
      const userId = (req as any).authUserId || null; // Support anonymous users
      
      const subscription = await storage.createPushSubscription({
        ...subscriptionData,
        userId
      });
      
      console.log(`✅ Push subscription created for ${subscriptionData.neighbourhoodId}`);
      res.json({ ok: true, subscription });
    } catch (error: any) {
      console.error('❌ Push subscription failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/push/subscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: "Endpoint is required" });
      }
      
      await storage.removePushSubscription(endpoint);
      console.log(`✅ Push subscription removed: ${endpoint.slice(0, 50)}...`);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('❌ Push unsubscribe failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/push/settings", async (req, res) => {
    try {
      const { endpoint, types } = req.body;
      if (!endpoint || !Array.isArray(types)) {
        return res.status(400).json({ error: "Endpoint and types array are required" });
      }
      
      await storage.updatePushSubscriptionTypes(endpoint, types);
      console.log(`✅ Push settings updated: ${types.join(', ')}`);
      res.json({ ok: true });
    } catch (error: any) {
      console.error('❌ Push settings update failed:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup Socket.IO
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Socket.IO access gate: reject unauthenticated and non-approved users
  io.use(async (socket, next) => {
    const session = (socket.request as any).session;
    const userId = session?.userId;

    if (!userId) {
      console.log(`🚫 [SOCKET] Rejected connection ${socket.id}: no authenticated session`);
      return next(new Error("Unauthorized: authentication required"));
    }

    try {
      const result = await db.select({ accessStatus: users.accessStatus })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (result.length === 0) {
        console.log(`🚫 [SOCKET] Rejected connection ${socket.id}: user ${userId} not found`);
        return next(new Error("Unauthorized: user not found"));
      }

      const { accessStatus } = result[0];
      if (accessStatus !== 'approved') {
        console.log(`🚫 [SOCKET] Rejected connection ${socket.id}: user ${userId} access_status=${accessStatus}`);
        return next(new Error("Access not approved"));
      }

      (socket as any).userId = userId;
      next();
    } catch (error) {
      console.error(`[SOCKET] Access gate error for ${socket.id}:`, error);
      return next(new Error("Authorization check failed"));
    }
  });

  // Helper to get session data from socket request
  async function getSessionForSocket(req: any): Promise<{ userId?: string; neighborhood?: string }> {
    try {
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          const neighborhood = `${user.city}:${user.neighbourhood || 'general'}`;
          return { userId: user.id, neighborhood };
        }
      }
      return {};
    } catch (error) {
      console.error('Session lookup error:', error);
      return {};
    }
  }

  // Helper to convert DB incident to API format with status aliasing
  function toApiIncident(incident: any, isAdmin: boolean = false, requestingUserId?: string | null) {
    const isOwner = !!(requestingUserId && incident.userId === requestingUserId);
    const result = {
      ...incident,
      status: incident.state === "new" ? "pending" : incident.state, // Alias state->status
      // Server-stamped ownership flag so the client never needs to compare IDs.
      // Safe: the server resolves the requesting user from the session,
      // so this field is authoritative even for anonymously submitted incidents.
      isOwnIncident: isOwner,
    };
    
    // Always strip userId from anonymous incidents — even for the owner.
    // The client uses isOwnIncident to gate the delete button.
    if (!isAdmin && incident.isAnonymous) {
      delete result.userId;
    }
    
    return result;
  }

  // Socket.IO incident and chat handling
  io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join neighborhood room based on user session
    try {
      const sessionData = await getSessionForSocket(socket.request);
      if (sessionData.neighborhood) {
        socket.join(`nh:${sessionData.neighborhood}`);
        console.log(`Client ${socket.id} joined neighborhood: ${sessionData.neighborhood}`);
        
        // Join staff room if user is a moderator/admin
        if (sessionData.userId) {
          const user = await storage.getUser(sessionData.userId);
          if (user?.isVerified && user.verifiedType) {
            socket.join("moderators");
            socket.join(`nh:${sessionData.neighborhood}:staff`);
            console.log(`Moderator ${socket.id} joined staff rooms`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to join neighborhood room:', error);
    }

    // Join chat rooms
    socket.on('join:chat', (room) => {
      socket.join(`chat:${room}`);
      console.log(`Client ${socket.id} joined chat room: ${room}`);
    });

    socket.on('leave:chat', (room) => {
      socket.leave(`chat:${room}`);
      console.log(`Client ${socket.id} left chat room: ${room}`);
    });

    // Enhanced incident handling with rate limiting and validation
    socket.on('incident:new', async (data) => {
      try {
        // Kill switch: Check if incident creation is enabled
        if (!INCIDENT_CREATION_ENABLED) {
          socket.emit('incident:error', { error: 'Incident reporting temporarily disabled' });
          return;
        }

        // Basic validation
        if (!data.type || !data.latitude || !data.longitude) {
          socket.emit('incident:error', { error: 'Missing required fields' });
          return;
        }

        // Enhanced rate limiting for socket connections
        const reporterId = data.reporter_id || socket.id;
        const isAnonymous = !data.reporter_id;
        
        if (!checkRateLimit(reporterId, isAnonymous)) {
          socket.emit('incident:error', { 
            error: 'Rate limit exceeded. Please wait before reporting another incident.',
            retryAfter: 3
          });
          return;
        }

        // Enhanced validation and sanitization
        const lat = Number(data.latitude);
        const lon = Number(data.longitude);
        
        if (!validateCoordinates(lat, lon)) {
          socket.emit('incident:error', { 
            error: 'Location outside supported region (Southern Africa)' 
          });
          return;
        }

        // Create sanitized incident data
        const incidentData = {
          type: sanitizeText(data.type),
          title: sanitizeText(data.description) || `${data.type} reported`,
          description: sanitizeText(data.description) || `${data.type} incident reported via quick report`,
          latitude: lat,
          longitude: lon,
          severity: 'medium' as const,
          category: sanitizeText(data.type),
          isAnonymous: isAnonymous,
          source: 'gps' as const,
          userId: data.reporter_id || null,
          state: 'new' as const
        };

        // Check for duplicates before creating
        const duplicateIncident = await storage.findDuplicateIncident(
          incidentData.type,
          lat,
          lon
        );

        if (duplicateIncident) {
          await storage.incrementDuplicateCount(duplicateIncident.id);
          socket.emit('incident:created', { ...toApiIncident(duplicateIncident, true), isDuplicate: true });
          return;
        }

        // Apply auto-flagging heuristics for socket reports too
        let isShadowHidden = false;
        
        // Velocity heuristic for socket reports
        const burstKey = `socket_burst:${reporterId}`;
        if (!checkRateLimit(burstKey, isAnonymous)) {
          isShadowHidden = true;
          console.log(`🚩 Socket shadow flagged: velocity burst for ${reporterId}`);
        }

        // Create incident with shadow flag
        const incidentWithShadow = { ...incidentData, isShadowHidden };
        const incident = await storage.createIncident(incidentWithShadow);
        
        // Send push notifications to neighborhood (only if not shadow hidden)
        if (!isShadowHidden) {
          try {
            await sendIncidentPush(incident);
          } catch (pushError) {
            console.error('❌ Push notification failed:', pushError);
            // Don't fail the incident creation if push fails
          }
        }
        
        // Emit success to the reporter with admin view (sees userId)
        socket.emit('incident:created', toApiIncident(incident, true));

        // Get reporter's neighborhood for targeted broadcast
        const sessionData = await getSessionForSocket(socket.request);
        const broadcastIncident = toApiIncident(incident, false); // Hide userId for public
        
        if (!isShadowHidden) {
          // Normal public broadcast for valid incidents
          if (sessionData.neighborhood) {
            // Broadcast to neighborhood room only
            io.to(`nh:${sessionData.neighborhood}`).emit('incident:created', broadcastIncident);
            console.log(`Broadcasted incident to neighborhood: ${sessionData.neighborhood}`);
          } else {
            // Fallback to general broadcast if no neighborhood
            io.emit('incident:created', broadcastIncident);
          }
        } else {
          // Shadow flagged: notify staff only
          if (sessionData.neighborhood) {
            io.to(`nh:${sessionData.neighborhood}:staff`).emit('incident:flagged', { id: incident.id });
          }
          io.to("moderators").emit('incident:flagged', { id: incident.id });
          console.log(`🚩 Shadow incident flagged, staff notified: ${incident.id}`);
        }
        
        console.log('New incident broadcasted:', data.type);
      } catch (error: any) {
        console.error('Error creating incident:', error);
        socket.emit('incident:error', { error: 'Failed to create incident' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // ============================================================
  // TEST-ONLY ENDPOINT - E2E_TEST_SEED_USER
  // Strictly gated behind E2E_TEST_MODE=true
  // DO NOT modify existing auth logic - this is an isolated test helper
  // ============================================================
  if (process.env.E2E_TEST_MODE === 'true') {
    console.log('⚠️ E2E_TEST_MODE enabled - test-only endpoints active');
    
    app.post("/api/e2e/seed-user", async (req, res) => {
      try {
        const { verified = true } = req.body;
        const timestamp = Date.now();
        const testEmail = `e2e-test-${timestamp}@test.local`;
        const testUsername = `e2e_tester_${timestamp}`;
        const testPassword = `TestPass_${timestamp}!`;
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        
        // Create test user directly in database
        // Using only required fields + those with defaults in schema
        const result = await db.execute(sql`
          INSERT INTO users (email, username, password_hash, country, city, email_verified, access_status)
          VALUES (
            ${testEmail},
            ${testUsername},
            ${hashedPassword},
            'Namibia',
            'Windhoek',
            ${verified},
            'approved'
          )
          RETURNING id, email, username, email_verified
        `);
        
        const newUser = result.rows[0] as { id: string; email: string; username: string; email_verified: boolean };
        
        // Create session for the test user
        (req.session as any).userId = newUser.id;
        
        console.log(`🧪 E2E: Created test user ${testEmail} (verified: ${verified})`);
        
        res.json({
          success: true,
          user: {
            id: newUser.id,
            email: newUser.email,
            username: newUser.username,
            emailVerified: newUser.email_verified,
          },
          credentials: {
            email: testEmail,
            password: testPassword,
          },
        });
      } catch (error) {
        console.error('E2E seed user error:', error);
        res.status(500).json({ error: 'Failed to create test user' });
      }
    });
    
    // Cleanup endpoint for test users
    app.delete("/api/e2e/cleanup", async (req, res) => {
      try {
        const result = await db.execute(sql`
          DELETE FROM users WHERE email LIKE 'e2e-test-%@test.local'
        `);
        console.log('🧪 E2E: Cleaned up test users');
        res.json({ success: true, message: 'Test users cleaned up' });
      } catch (error) {
        console.error('E2E cleanup error:', error);
        res.status(500).json({ error: 'Failed to cleanup test users' });
      }
    });
  }

  // ── Access Gate: Request details + Admin approval endpoints ──

  app.post("/api/access/request-details", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).authUserId;
      const { name, city, reason } = req.body;

      await db.update(users).set({
        requestedName: name || null,
        requestedCity: city || null,
        requestedReason: reason || null,
        accessRequestedAt: new Date(),
      }).where(eq(users.id, userId));

      res.json({ ok: true });
    } catch (error) {
      console.error("Request details error:", error);
      res.status(500).json({ error: "Failed to save request details" });
    }
  });

  app.get("/api/admin/access-requests", requireAdmin, async (req, res) => {
    try {
      const statusFilter = (req.query.status as string) || 'pending';
      const result = await db.select({
        id: users.id,
        email: users.email,
        username: users.username,
        accessStatus: users.accessStatus,
        accessRequestedAt: users.accessRequestedAt,
        accessApprovedAt: users.accessApprovedAt,
        accessDecidedBy: users.accessDecidedBy,
        requestedName: users.requestedName,
        requestedCity: users.requestedCity,
        requestedReason: users.requestedReason,
        oauthProvider: users.oauthProvider,
        country: users.country,
        city: users.city,
        createdAt: users.createdAt,
      }).from(users)
        .where(eq(users.accessStatus, statusFilter as any))
        .orderBy(desc(users.createdAt));

      res.json({ requests: result });
    } catch (error) {
      console.error("Admin access requests error:", error);
      res.status(500).json({ error: "Failed to fetch access requests" });
    }
  });

  app.post("/api/admin/access-requests/:userId/approve", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const adminId = (req as any).authUserId;

      const [updated] = await db.update(users).set({
        accessStatus: "approved",
        accessApprovedAt: new Date(),
        accessDecidedBy: adminId,
      }).where(eq(users.id, userId)).returning();

      if (!updated) return res.status(404).json({ error: "User not found" });

      console.log(`✅ [ADMIN] User ${userId} approved by ${adminId}`);
      res.json({ ok: true, user: { id: updated.id, email: updated.email, accessStatus: updated.accessStatus } });
    } catch (error) {
      console.error("Admin approve error:", error);
      res.status(500).json({ error: "Failed to approve user" });
    }
  });

  app.post("/api/admin/access-requests/:userId/deny", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const adminId = (req as any).authUserId;

      const [updated] = await db.update(users).set({
        accessStatus: "denied",
        accessDecidedBy: adminId,
      }).where(eq(users.id, userId)).returning();

      if (!updated) return res.status(404).json({ error: "User not found" });

      console.log(`❌ [ADMIN] User ${userId} denied by ${adminId}`);
      res.json({ ok: true, user: { id: updated.id, email: updated.email, accessStatus: updated.accessStatus } });
    } catch (error) {
      console.error("Admin deny error:", error);
      res.status(500).json({ error: "Failed to deny user" });
    }
  });

  // Helper to parse object storage paths
  function parseObjPath(path: string): { bucketName: string; objectName: string } {
    if (!path.startsWith("/")) path = `/${path}`;
    const parts = path.split("/");
    if (parts.length < 3) throw new Error("Invalid path: must contain at least a bucket name");
    return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
  }

  // ── Landing Page Backgrounds (Admin) ───────────────────────────

  app.get("/api/landing-backgrounds", async (_req, res) => {
    try {
      const bgs = await db.select().from(landingBackgrounds);
      res.json(bgs);
    } catch (error) {
      console.error("Error fetching landing backgrounds:", error);
      res.status(500).json({ error: "Failed to fetch backgrounds" });
    }
  });

  app.post("/api/admin/landing-backgrounds", requireAdmin, limitUploads, async (req, res) => {
    const multer = (await import("multer")).default;
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { files: 1, fileSize: 10 * 1024 * 1024 },
    });

    upload.single("file")(req, res, async (err: any) => {
      try {
        if (err) return res.status(400).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const sectionId = req.body.sectionId;
        const validIds = LANDING_SECTIONS.map(s => s.id);
        if (!sectionId || !validIds.includes(sectionId)) {
          return res.status(400).json({ error: "Invalid section ID" });
        }

        const ALLOWED = new Set(["image/jpeg","image/png","image/webp","image/avif"]);
        const { fileTypeFromBuffer } = await import("file-type");
        const ft = await fileTypeFromBuffer(req.file.buffer);
        const mime = ft?.mime || req.file.mimetype;
        if (!mime || !ALLOWED.has(mime)) {
          return res.status(415).json({ error: `Unsupported file type: ${mime}` });
        }

        const sharp = (await import("sharp")).default;
        const { randomUUID } = await import("crypto");

        const data = await sharp(req.file.buffer, { failOnError: false })
          .rotate()
          .resize({ width: 2400, height: 1600, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();

        const imgId = randomUUID();
        const filename = `backgrounds/${imgId}.webp`;

        const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
        let privateDir = process.env.PRIVATE_OBJECT_DIR;
        if (!privateDir) {
          return res.status(500).json({ error: "Object storage not configured" });
        }
        if (privateDir.endsWith("/")) privateDir = privateDir.slice(0, -1);
        const { bucketName, objectName: basePath } = parseObjPath(privateDir);
        const bucket = objectStorageClient.bucket(bucketName);
        const objectPath = `${basePath}/uploads/${filename}`;
        const file = bucket.file(objectPath);
        await file.save(data, { contentType: "image/webp" });

        const imageUrl = `/objects/uploads/${filename}`;

        const existing = await db.select().from(landingBackgrounds).where(eq(landingBackgrounds.sectionId, sectionId));
        if (existing.length > 0 && existing[0].imageUrl) {
          try {
            const oldPath = existing[0].imageUrl;
            if (oldPath.startsWith("/objects/")) {
              const oldEntityId = oldPath.replace("/objects/", "");
              let entityDir = privateDir;
              if (!entityDir.endsWith("/")) entityDir += "/";
              const oldFullPath = `${entityDir}${oldEntityId}`;
              const oldParsed = parseObjPath(oldFullPath);
              const oldFile = objectStorageClient.bucket(oldParsed.bucketName).file(oldParsed.objectName);
              const [exists] = await oldFile.exists();
              if (exists) await oldFile.delete();
            }
          } catch (e) {
            console.warn("Failed to delete old background from object storage:", e);
          }
        }

        const adminId = (req as any).authUserId;

        const [bg] = await db.insert(landingBackgrounds).values({
          sectionId,
          imageUrl,
          uploadedBy: adminId,
        }).onConflictDoUpdate({
          target: landingBackgrounds.sectionId,
          set: {
            imageUrl,
            uploadedBy: adminId,
            updatedAt: new Date(),
          },
        }).returning();

        res.status(201).json(bg);
      } catch (error) {
        console.error("Error processing landing background upload:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to upload background" });
        }
      }
    });
  });

  app.delete("/api/admin/landing-backgrounds/:sectionId", requireAdmin, async (req, res) => {
    try {
      const { sectionId } = req.params;
      const [deleted] = await db.delete(landingBackgrounds)
        .where(eq(landingBackgrounds.sectionId, sectionId))
        .returning();
      if (!deleted) return res.status(404).json({ error: "Background not found" });

      if (deleted.imageUrl?.startsWith("/objects/")) {
        try {
          const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
          const privateDir = process.env.PRIVATE_OBJECT_DIR;
          if (privateDir) {
            const entityId = deleted.imageUrl.replace("/objects/", "");
            let entityDir = privateDir;
            if (!entityDir.endsWith("/")) entityDir += "/";
            const fullPath = `${entityDir}${entityId}`;
            const parsed = parseObjPath(fullPath);
            const file = objectStorageClient.bucket(parsed.bucketName).file(parsed.objectName);
            const [exists] = await file.exists();
            if (exists) await file.delete();
          }
        } catch (e) {
          console.warn("Failed to delete background from object storage:", e);
        }
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Error deleting landing background:", error);
      res.status(500).json({ error: "Failed to delete background" });
    }
  });

  return httpServer;
}
