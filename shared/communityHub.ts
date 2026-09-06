/**
 * Community Services — shared contract between client and server.
 *
 * Nothing in this module talks to the database or the network; it only
 * describes the shapes both sides agree on, plus the two pure rules
 * (state transitions and community matching) that must not drift apart.
 */
import { z } from "zod";

export const SERVICE_TYPES = ["municipality", "police", "fire", "security"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_LABELS: Record<ServiceType, string> = {
  municipality: "Municipality",
  police: "Police",
  fire: "Fire brigade",
  security: "Security service",
};

const shortText = (max: number) => z.string().trim().min(2).max(max);

export const organisationInput = z
  .object({
    name: shortText(120),
    type: z.enum(SERVICE_TYPES),
    country: shortText(80),
    city: shortText(80),
    description: shortText(1200),
    contactEmail: z.string().trim().email().max(254),
    phone: z.string().trim().min(5).max(40),
    website: z
      .union([
        z.literal(""),
        z
          .string()
          .url()
          .max(500)
          .refine((v) => /^https?:\/\//i.test(v), "Use an http or https website"),
      ])
      .default(""),
  })
  .strict();
export type OrganisationInput = z.infer<typeof organisationInput>;

export const REQUEST_CATEGORIES = [
  "roads",
  "water",
  "electricity",
  "waste",
  "public_safety",
  "fire_prevention",
  "security",
  "other",
] as const;
export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export const REQUEST_STATES = ["submitted", "acknowledged", "in_progress", "resolved", "closed"] as const;
export type RequestState = (typeof REQUEST_STATES)[number];

export const requestInput = z
  .object({
    organisationId: z.string().uuid(),
    title: shortText(140),
    description: shortText(3000),
    category: z.enum(REQUEST_CATEGORIES),
    neighbourhood: shortText(100),
    location: shortText(240),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type RequestInput = z.infer<typeof requestInput>;

export const updateInput = z
  .object({
    state: z.enum(REQUEST_STATES),
    note: shortText(2000),
    version: z.coerce.number().int().min(1),
  })
  .strict();

export const noticeInput = z.object({ title: shortText(140), body: shortText(2000) }).strict();

export const staffInput = z.object({ email: z.string().trim().email().max(254) }).strict();

export const reviewInput = z
  .object({
    status: z.enum(["verified", "rejected"]),
    note: z.string().trim().min(10).max(2000),
  })
  .strict();

/**
 * Allowed request lifecycle. `closed` is terminal; `resolved` can be reopened
 * so a resident who reports the problem is still there is not stuck.
 */
const ALLOWED_TRANSITIONS: Record<RequestState, readonly RequestState[]> = {
  submitted: ["acknowledged"],
  acknowledged: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
};

export function canTransition(from: RequestState, to: RequestState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: RequestState): RequestState[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])];
}

/** Case- and whitespace-insensitive country+city match. Keep server and client identical. */
export function sameCommunity(
  a: { country: string; city: string },
  b: { country: string; city: string },
): boolean {
  const normalise = (s: string) => s.trim().toLocaleLowerCase("en");
  return normalise(a.country) === normalise(b.country) && normalise(a.city) === normalise(b.city);
}

/* ------------------------------------------------------------------ *
 * Response shapes.
 *
 * These are explicit allowlists, not row spreads: `review_note`,
 * `reviewed_by`, `reviewed_at` and `owner_id` are private review
 * metadata and must never reach the directory. The server builds these
 * objects field by field so adding a database column cannot silently
 * widen the API.
 * ------------------------------------------------------------------ */

/** An organisation as seen in the public (community-scoped) directory. */
export interface DirectoryOrganisation {
  id: string;
  name: string;
  type: ServiceType;
  country: string;
  city: string;
  description: string;
  contact_email: string;
  phone: string;
  website: string;
  status: "pending" | "verified" | "rejected";
  following: boolean;
  can_manage: boolean;
  is_owner: boolean;
}

/**
 * An organisation the caller owns or staffs. Adds the caller's own review
 * outcome, which they are entitled to see because it is about them.
 */
export interface ManagedOrganisation extends DirectoryOrganisation {
  review_note: string | null;
}

/** An organisation application as seen by an administrator during review. */
export interface OrganisationApplication {
  id: string;
  name: string;
  type: ServiceType;
  country: string;
  city: string;
  description: string;
  contact_email: string;
  phone: string;
  website: string;
  status: "pending" | "verified" | "rejected";
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  applicant_email: string;
  applicant_username: string;
  /** True when the caller owns this application and therefore may not review it. */
  is_own_application: boolean;
}

export interface ServiceRequest {
  id: string;
  organisation_id: string;
  organisation_name: string;
  title: string;
  description: string;
  category: string;
  neighbourhood: string;
  location: string;
  state: RequestState;
  version: number;
  created_at: string;
  updated_at: string;
  /** True when the caller may move this request through its lifecycle. */
  can_manage: boolean;
  /** True when the caller raised this request. */
  is_mine: boolean;
}

export interface RequestUpdate {
  id: string;
  state: RequestState;
  note: string;
  created_at: string;
}

export interface ServiceNotice {
  id: string;
  organisation_name: string;
  title: string;
  body: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  username: string;
  email: string;
}

export interface CommunityOverview {
  organisations: DirectoryOrganisation[];
  managed: ManagedOrganisation[];
  requests: ServiceRequest[];
  notices: ServiceNotice[];
  isAdmin: boolean;
  emailVerified: boolean;
  community: { country: string; city: string };
}
