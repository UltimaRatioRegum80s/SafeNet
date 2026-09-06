import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, decimal, integer, jsonb, uuid, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with roles, location, and optional email/password
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(), // nullable for anonymous users
  passwordHash: text("password_hash"), // nullable for anonymous users
  username: text("username").notNull(),
  displayName: text("display_name"), // legacy display name field
  roles: text("roles").array().notNull().default(sql`ARRAY['resident']::text[]`),
  country: text("country").notNull(),
  city: text("city").notNull(),
  neighbourhood: text("neighbourhood"),
  isVerified: boolean("is_verified").default(false),
  verifiedType: varchar("verified_type", { enum: ["police", "municipal", "security", "fire", "medical", "ngo"] }),
  verifiedBadge: text("verified_badge"), // Badge text to display
  // Email verification fields
  emailVerified: boolean("email_verified").default(false),
  emailVerificationTokenHash: text("email_verification_token_hash"),
  emailVerificationExpires: timestamp("email_verification_expires", { withTimezone: true }),
  emailVerificationSentAt: timestamp("email_verification_sent_at", { withTimezone: true }),
  emailVerificationCount: integer("email_verification_count").default(0), // daily send count
  emailVerificationCountResetAt: timestamp("email_verification_count_reset_at", { withTimezone: true }),
  lastLatitude: decimal("last_latitude", { precision: 10, scale: 8 }),
  lastLongitude: decimal("last_longitude", { precision: 11, scale: 8 }),
  homeLatitude: decimal("home_latitude", { precision: 10, scale: 8 }),
  homeLongitude: decimal("home_longitude", { precision: 11, scale: 8 }),
  interestLatitude: decimal("interest_latitude", { precision: 10, scale: 8 }),
  interestLongitude: decimal("interest_longitude", { precision: 11, scale: 8 }),
  notificationRadius: integer("notification_radius").default(1000), // meters
  fcmToken: text("fcm_token"), // For push notifications
  // Access control (Phase 3D-A: request-access gate)
  accessStatus: varchar("access_status", { enum: ["pending", "approved", "denied"] }).default("pending"),
  accessRequestedAt: timestamp("access_requested_at", { withTimezone: true }),
  accessApprovedAt: timestamp("access_approved_at", { withTimezone: true }),
  accessDecidedBy: text("access_decided_by"),
  requestedName: text("requested_name"),
  requestedCity: text("requested_city"),
  requestedReason: text("requested_reason"),
  // OAuth provider fields
  oauthProvider: text("oauth_provider"), // google, microsoft, apple
  oauthProviderId: text("oauth_provider_id"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Incidents table with moderation support
export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  idempotencyKey: text("idempotency_key"), // nullable, partial unique index enforced via SQL
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  severity: varchar("severity", { enum: ["low", "medium", "high", "critical"] }).notNull(),
  category: text("category").notNull(),
  isAnonymous: boolean("is_anonymous").default(false),
  state: varchar("state", { enum: ["new", "validated", "acknowledged", "resolved", "closed"] }).default("new"),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolveNote: text("resolve_note"),
  isModerated: boolean("is_moderated").default(false),
  moderatedBy: varchar("moderated_by").references(() => users.id),
  moderationReason: text("moderation_reason"),
  reportCount: integer("report_count").default(0),
  duplicateCount: integer("duplicate_count").default(1),
  source: varchar("source", { enum: ["gps", "network", "manual"] }),
  photos: text("photos").array().default([]),
  metadata: jsonb("metadata"), // Additional incident data
  createdAt: timestamp("created_at").default(sql`now()`),
  closedAt: timestamp("closed_at"),
  isShadowHidden: boolean("is_shadow_hidden").default(false),
  // Visibility scope for geo-restricted field tests (e.g., Kenya private beta)
  visibilityScope: varchar("visibility_scope", { enum: ["public_beta", "private_whitelist"] }).default("public_beta"),
  // Country code (ISO 3166-1 alpha-2) for geo-policy enforcement
  countryCode: varchar("country_code", { length: 2 }),
  // Taxonomy version (2 = new group-based system, 1 = legacy severity-based)
  taxonomyVersion: integer("taxonomy_version").default(2),
});

// Reports table for moderation
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").references(() => users.id),
  incidentId: varchar("incident_id").references(() => incidents.id),
  reason: varchar("reason", { enum: ["spam", "inappropriate", "fake", "harassment", "other"] }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Following table for incident subscriptions
export const follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  incidentId: varchar("incident_id").references(() => incidents.id),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Phase 2: Incident Responses (structured reactions)
// One response per user per incident (upsert model)
// Signals: seen, caution, helpful, resolved
export const incidentResponses = pgTable("incident_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id").references(() => incidents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  signal: varchar("signal", { enum: ["seen", "caution", "helpful", "resolved"] }).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  uniqueUserIncident: uniqueIndex("incident_responses_incident_user_idx").on(table.incidentId, table.userId),
}));

// Push subscriptions for web push notifications
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // nullable for anonymous users
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  neighbourhoodId: text("neighbourhood_id").notNull(), // for location-based filtering
  types: text("types").array().notNull().default(sql`ARRAY[]::text[]`), // incident types to receive
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  incidentId: varchar("incident_id").references(() => incidents.id),
  type: varchar("type", { enum: ["incident_nearby", "incident_update", "follow_update"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Chat messages table for neighborhood chat
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  room: text("room").notNull(), // format: city:Windhoek:Vineta
  userId: varchar("user_id").references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Session table for express-session compatibility  
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),  // Keep as jsonb as that's the expected type
  expire: timestamp("expire", { precision: 6 }).notNull(),  // Match existing precision
});

// Auth sessions table
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  refreshToken: varchar("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  revoked: boolean("revoked").default(false),
});

// Schema definitions
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(6).optional(), // For validation before hashing
});

export const signupSchema = insertUserSchema.extend({
  role: z.enum(["private", "security_org"]),
}).pick({
  email: true,
  password: true,
  username: true,
  role: true,
  country: true,
  city: true,
  neighbourhood: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const anonJoinSchema = z.object({
  username: z.string().min(1).max(100), // Allow longer names and remove regex restriction
  email: z.string().email().optional(),
  role: z.enum(["private", "security_org"]),
  country: z.string().min(1),
  city: z.string().min(1),
  neighbourhood: z.string().min(1).optional(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SignupData = z.infer<typeof signupSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type AnonJoinData = z.infer<typeof anonJoinSchema>;

// New schema for updated single form flow
export const newJoinSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Valid email is required"),
  role: z.enum(["private_citizen", "security_organisation", "government_service"]),
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  neighbourhood: z.string().min(1, "Neighbourhood is required")
});

export type NewJoinData = z.infer<typeof newJoinSchema>;

// Keep existing schema definitions with mobile-friendly coordinate validation
export const insertIncidentSchema = createInsertSchema(incidents).pick({
  type: true,
  title: true,
  description: true,
  severity: true,
  category: true,
  isAnonymous: true,
  photos: true,
}).extend({
  // Mobile-friendly coordinate validation - coerce strings to numbers
  latitude: z.coerce.number().refine(v => Number.isFinite(v) && Math.abs(v) <= 90, "Invalid latitude"),
  longitude: z.coerce.number().refine(v => Number.isFinite(v) && Math.abs(v) <= 180, "Invalid longitude"),
  // Guarantee severity is never null
  severity: z.enum(["low", "medium", "high", "critical"]).default("low"),
});

// Export a tiny normalizer so routes can safely finalize values
export function normalizeIncidentCoords<T extends { latitude: number; longitude: number }>(parsed: T) {
  let { latitude: lat, longitude: lng } = parsed;

  // Heuristic swap if they look reversed (mobile autofill glitch)
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    [lat, lng] = [lng, lat];
  }
  // Round for DB precision & stable clustering
  lat = Number(lat.toFixed(6));
  lng = Number(lng.toFixed(6));

  return { ...parsed, latitude: lat, longitude: lng };
}

export const insertReportSchema = createInsertSchema(reports).pick({
  incidentId: true,
  reason: true,
  description: true,
});

export const insertFollowSchema = createInsertSchema(follows).pick({
  incidentId: true,
});

// Phase 2: Incident Response schema (structured reactions)
export const insertIncidentResponseSchema = createInsertSchema(incidentResponses).pick({
  incidentId: true,
  signal: true,
});

// Signal types for incident responses
export const RESPONSE_SIGNALS = ["seen", "caution", "helpful", "resolved"] as const;
export type ResponseSignal = typeof RESPONSE_SIGNALS[number];

// Additional types
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof follows.$inferSelect;
export type InsertIncidentResponse = z.infer<typeof insertIncidentResponseSchema>;
export type IncidentResponse = typeof incidentResponses.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Chat message schema
export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  room: true,
  message: true,
});

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Phase 2: Community Businesses for local directory
export const businesses = pgTable("businesses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: varchar("category", { enum: ["restaurant", "retail", "service", "healthcare", "education", "security", "other"] }).notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  phone: text("phone"),
  website: text("website"),
  hours: jsonb("hours"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Phase 2: Community Events and Promotions
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizerId: varchar("organizer_id").references(() => users.id),
  businessId: varchar("business_id").references(() => businesses.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category", { enum: ["community", "safety", "business", "social", "emergency", "other"] }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isPromotion: boolean("is_promotion").default(false),
  promotionCode: text("promotion_code"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Phase 2: Drive-by Security Requests
export const drivebyRequests = pgTable("driveby_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").references(() => users.id),
  incidentId: varchar("incident_id").references(() => incidents.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", { enum: ["low", "medium", "high", "urgent"] }).default("medium"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  requestedTime: timestamp("requested_time"),
  state: varchar("state", { enum: ["pending", "accepted", "en_route", "completed", "cancelled"] }).default("pending"),
  acceptedBy: varchar("accepted_by").references(() => users.id),
  acceptedAt: timestamp("accepted_at"),
  completedAt: timestamp("completed_at"),
  completionNotes: text("completion_notes"),
  estimatedArrival: timestamp("estimated_arrival"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertBusinessSchema = createInsertSchema(businesses).pick({
  name: true,
  description: true,
  category: true,
  address: true,
  latitude: true,
  longitude: true,
  phone: true,
  website: true,
  hours: true,
});

export const insertEventSchema = createInsertSchema(events).pick({
  title: true,
  description: true,
  category: true,
  latitude: true,
  longitude: true,
  startTime: true,
  endTime: true,
  isPromotion: true,
  promotionCode: true,
  expiresAt: true,
});

export const insertDrivebyRequestSchema = createInsertSchema(drivebyRequests).pick({
  title: true,
  description: true,
  priority: true,
  latitude: true,
  longitude: true,
  requestedTime: true,
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).pick({
  userId: true,
  endpoint: true,
  p256dh: true,
  auth: true,
  neighbourhoodId: true,
  types: true,
});

export type Business = typeof businesses.$inferSelect;
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type DrivebyRequest = typeof drivebyRequests.$inferSelect;
export type InsertDrivebyRequest = z.infer<typeof insertDrivebyRequestSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;

// Incident comments (thread under a card)
export const incidentComments = pgTable("incident_comments", {
  id: integer("id").primaryKey().default(sql`nextval('incident_comments_id_seq')`),
  incidentId: varchar("incident_id").notNull().references(() => incidents.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Incident "someone took a look" reviews
export const incidentReviews = pgTable(
  "incident_reviews",
  {
    incidentId: varchar("incident_id").notNull().references(() => incidents.id),
    userId: varchar("user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.incidentId, t.userId] }), // one review per user per incident
  })
);

// Export types for comments and reviews
export type IncidentComment = typeof incidentComments.$inferSelect;
export type IncidentReview = typeof incidentReviews.$inferSelect;

// Insert schemas for comments and reviews
export const insertIncidentCommentSchema = createInsertSchema(incidentComments).pick({
  incidentId: true,
  body: true,
});

export type InsertIncidentComment = z.infer<typeof insertIncidentCommentSchema>;

// Legal consent tracking for Terms of Service and Privacy Policy
export const legalConsents = pgTable("legal_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // nullable for anonymous/pre-signup consent
  sessionId: text("session_id"), // for anonymous tracking before signup
  termsVersion: text("terms_version").notNull(), // e.g., "1.0.0"
  privacyVersion: text("privacy_version").notNull(), // e.g., "1.0.0"
  consentedAt: timestamp("consented_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"), // for audit trail
  userAgent: text("user_agent"), // for audit trail
});

export const insertLegalConsentSchema = createInsertSchema(legalConsents).pick({
  userId: true,
  sessionId: true,
  termsVersion: true,
  privacyVersion: true,
  ipAddress: true,
  userAgent: true,
});

export type LegalConsent = typeof legalConsents.$inferSelect;
export type InsertLegalConsent = z.infer<typeof insertLegalConsentSchema>;

// Current legal document versions - increment when documents change
// v1.1.0 Terms: Added anti-doxxing clause and defamation/neutrality requirements
export const LEGAL_VERSIONS = {
  terms: "1.1.0",
  privacy: "1.0.0",
} as const;

// Password reset tokens - hashed tokens with 1-hour expiry
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").notNull(), // SHA-256 hash of token
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }), // null until used
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Login attempts for rate limiting and abuse detection
export const loginAttempts = pgTable("login_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(), // lowercase
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).defaultNow().notNull(),
});

export type LoginAttempt = typeof loginAttempts.$inferSelect;

// Landing page background images (admin-managed)
export const landingBackgrounds = pgTable("landing_backgrounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sectionId: text("section_id").notNull().unique(),
  imageUrl: text("image_url").notNull(),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLandingBackgroundSchema = createInsertSchema(landingBackgrounds).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLandingBackground = z.infer<typeof insertLandingBackgroundSchema>;
export type LandingBackground = typeof landingBackgrounds.$inferSelect;

export const LANDING_SECTIONS = [
  { id: 'hero', label: 'Hero' },
  { id: 'trust_pillars', label: 'Trust Pillars' },
  { id: 'what_it_is', label: 'What It Is' },
  { id: 'how_it_works', label: 'How It Works' },
  { id: 'guardrails', label: 'Guardrails' },
  { id: 'offline_ready', label: 'Offline Ready' },
  { id: 'beta_access', label: 'Beta Access' },
] as const;

export type LandingSectionId = typeof LANDING_SECTIONS[number]['id'];

// Import abuse reports from separate schema file
export { abuse_reports, type AbuseReport, type InsertAbuseReport, insertAbuseReportSchema } from "./schema_abuse";
