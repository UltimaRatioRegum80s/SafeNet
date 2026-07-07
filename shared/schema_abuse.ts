import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const abuse_reports = pgTable("abuse_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  incidentId: varchar("incident_id").notNull(),
  reporterUserId: varchar("reporter_user_id"),
  reason: varchar("reason").notNull(), // enforce allowed values in route validation
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas for validation
export const insertAbuseReportSchema = createInsertSchema(abuse_reports).omit({
  id: true,
  createdAt: true,
}).extend({
  reason: z.enum(["spam", "harassment", "misinfo", "other"]),
  note: z.string().max(500).optional(),
});

export type InsertAbuseReport = z.infer<typeof insertAbuseReportSchema>;
export type AbuseReport = typeof abuse_reports.$inferSelect;