/**
 * Community Services API — mounted at /api/community-services.
 *
 * Scope and deliberate limits:
 *  - This is a non-emergency request tracker between residents and local
 *    services. It performs NO emergency dispatch and has NO integration with
 *    any municipality, police, fire or security system. Nothing here notifies
 *    anyone out-of-band; there is no email or SMS delivery and no response SLA.
 *  - Registering an organisation grants nothing. An administrator who does not
 *    own the application must verify it before it becomes visible or usable.
 *  - All tables are additive and namespaced `hub_*`. Existing incident,
 *    account, session and offline-sync tables are untouched.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { createHash, randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { pool } from "./db";
import {
  canTransition,
  sameCommunity,
  organisationInput,
  requestInput,
  updateInput,
  noticeInput,
  staffInput,
  reviewInput,
  type DirectoryOrganisation,
  type ManagedOrganisation,
  type OrganisationApplication,
  type ServiceRequest,
  type ServiceNotice,
  type ServiceType,
  type RequestState,
} from "../shared/communityHub";

/** Maximum organisation applications a single account may hold. */
const MAX_ORGANISATIONS_PER_OWNER = 5;

/* ------------------------------------------------------------------ *
 * Schema
 *
 * Kept as an idempotent CREATE ... IF NOT EXISTS script so that Replit,
 * where the database is driven from shared/schema.ts via drizzle-kit push,
 * does not need a separate migration step. migrations/community_hub.sql
 * holds the same statements for environments that prefer to migrate
 * explicitly.
 *
 * This runs ONCE at server start, never on a request path.
 * ------------------------------------------------------------------ */
export const HUB_DDL = `
CREATE TABLE IF NOT EXISTS hub_organisations (
  id uuid PRIMARY KEY,
  owner_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('municipality','police','fire','security')),
  country text NOT NULL,
  city text NOT NULL,
  description text NOT NULL,
  contact_email text NOT NULL,
  phone text NOT NULL,
  website text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  review_note text,
  reviewed_by varchar REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hub_org_name_location
  ON hub_organisations (lower(name), lower(country), lower(city));
CREATE INDEX IF NOT EXISTS hub_org_owner ON hub_organisations (owner_id);

CREATE TABLE IF NOT EXISTS hub_memberships (
  organisation_id uuid NOT NULL REFERENCES hub_organisations(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'resident' CHECK (role IN ('resident','staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, user_id)
);
CREATE INDEX IF NOT EXISTS hub_membership_user ON hub_memberships (user_id);

CREATE TABLE IF NOT EXISTS hub_requests (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES hub_organisations(id) ON DELETE CASCADE,
  requester_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  payload_fingerprint text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  neighbourhood text NOT NULL,
  location text NOT NULL,
  state text NOT NULL DEFAULT 'submitted'
    CHECK (state IN ('submitted','acknowledged','in_progress','resolved','closed')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, idempotency_key)
);
ALTER TABLE hub_requests ADD COLUMN IF NOT EXISTS payload_fingerprint text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS hub_request_owner ON hub_requests (requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hub_request_org ON hub_requests (organisation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hub_request_updates (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES hub_requests(id) ON DELETE CASCADE,
  author_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state text NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_request_update_request
  ON hub_request_updates (request_id, created_at);

CREATE TABLE IF NOT EXISTS hub_notices (
  id uuid PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES hub_organisations(id) ON DELETE CASCADE,
  author_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_notice_org ON hub_notices (organisation_id, created_at DESC);
`;

let schemaReady: Promise<void> | undefined;

/**
 * Create the hub tables if they do not exist. Safe to call concurrently and
 * repeatedly: the work is done once per process, under a transaction-scoped
 * advisory lock so two booting instances cannot race on the same database.
 * A failure clears the memo so a later call can retry.
 */
export async function ensureHubSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(714039221)");
        await client.query(HUB_DDL);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

/* ------------------------------------------------------------------ *
 * Request context
 * ------------------------------------------------------------------ */

type HubUser = {
  id: string;
  email: string | null;
  email_verified: boolean;
  access_status: string | null;
  roles: string[] | null;
  country: string;
  city: string;
};

type HubRequest = Request & { hubUser: HubUser; hubAdmin: boolean };

const route =
  (fn: (req: HubRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req as HubRequest, res)).catch(next);

const uuid = (value: unknown) => z.string().uuid().parse(value);

/**
 * SQL predicate: caller owns the organisation, or is staff on it.
 * Always used with the caller's user id bound to $1.
 */
const CAN_MANAGE = `(o.owner_id = $1 OR EXISTS (
  SELECT 1 FROM hub_memberships m
  WHERE m.organisation_id = o.id AND m.user_id = $1 AND m.role = 'staff'
))`;

/**
 * Load an organisation the caller is entitled to act on. Verification is
 * always required: a pending or rejected organisation can neither receive
 * requests nor publish notices. Re-checked on every write, so revoking
 * verification or staff access takes effect on the next request rather than
 * at cache expiry.
 */
async function loadManagedOrg(req: HubRequest, id: string, ownerOnly = false) {
  const predicate = ownerOnly ? "o.owner_id = $1" : CAN_MANAGE;
  const { rows } = await pool.query(
    `SELECT o.* FROM hub_organisations o
     WHERE o.id = $2 AND o.status = 'verified' AND ${predicate}`,
    [req.hubUser.id, id],
  );
  return rows[0];
}

/** Stable fingerprint of the meaningful fields of a request submission. */
function fingerprint(data: z.infer<typeof requestInput>): string {
  const canonical = JSON.stringify([
    data.organisationId,
    data.title.trim(),
    data.description.trim(),
    data.category,
    data.neighbourhood.trim(),
    data.location.trim(),
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

/* ------------------------------------------------------------------ *
 * Response mappers — explicit allowlists.
 *
 * The server builds every response object field by field. `owner_id`,
 * `reviewed_by` and `reviewed_at` are private review metadata and never
 * reach the directory; adding a database column cannot silently widen the
 * API the way a row spread would.
 * ------------------------------------------------------------------ */

function toDirectoryOrganisation(row: any): DirectoryOrganisation {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ServiceType,
    country: row.country,
    city: row.city,
    description: row.description,
    contact_email: row.contact_email,
    phone: row.phone,
    website: row.website,
    status: row.status,
    following: row.following === true,
    can_manage: row.can_manage === true,
    is_owner: row.is_owner === true,
  };
}

function toManagedOrganisation(row: any): ManagedOrganisation {
  // review_note is included here only because the caller owns or staffs this
  // organisation — it is the decision about them. It is never included in the
  // directory mapper above.
  return { ...toDirectoryOrganisation(row), review_note: row.review_note ?? null };
}

function toServiceRequest(row: any, callerId: string): ServiceRequest {
  return {
    id: row.id,
    organisation_id: row.organisation_id,
    organisation_name: row.organisation_name,
    title: row.title,
    description: row.description,
    category: row.category,
    neighbourhood: row.neighbourhood,
    location: row.location,
    state: row.state as RequestState,
    version: row.version,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    can_manage: row.can_manage === true,
    is_mine: row.requester_id === callerId,
  };
}

function toNotice(row: any): ServiceNotice {
  return {
    id: row.id,
    organisation_name: row.organisation_name,
    title: row.title,
    body: row.body,
    created_at: new Date(row.created_at).toISOString(),
  };
}

function toApplication(row: any, callerId: string): OrganisationApplication {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ServiceType,
    country: row.country,
    city: row.city,
    description: row.description,
    contact_email: row.contact_email,
    phone: row.phone,
    website: row.website,
    status: row.status,
    review_note: row.review_note ?? null,
    reviewed_at: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    created_at: new Date(row.created_at).toISOString(),
    applicant_email: row.applicant_email,
    applicant_username: row.applicant_username,
    is_own_application: row.owner_id === callerId,
  };
}

/* ------------------------------------------------------------------ *
 * Router
 * ------------------------------------------------------------------ */

export const communityHubRouter = Router();

/**
 * Authenticate and authorise. Mirrors the access rules the rest of the app
 * applies: a session is required, and the account must not be awaiting
 * approval or denied.
 *
 * Deliberately does NOT honour the development `x-user-id` header that
 * server/routes.ts accepts, because service requests carry a resident's
 * neighbourhood and street and are readable by organisation staff.
 */
communityHubRouter.use((request: Request, res: Response, next: NextFunction) => {
  const req = request as HubRequest;
  void (async () => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      res.status(401).json({ error: "Sign in to use Community Services." });
      return;
    }

    const { rows } = await pool.query(
      `SELECT id, email, email_verified, access_status, roles, country, city
       FROM users WHERE id = $1`,
      [userId],
    );
    const user = rows[0] as HubUser | undefined;
    if (!user) {
      res.status(401).json({ error: "Please sign in again." });
      return;
    }

    // Defence in depth: the global /api access gate in server/routes.ts already
    // rejects anyone whose access_status is not exactly 'approved', so it is
    // strictly the tighter of the two and runs first. This check only mirrors
    // /api/auth/me's treatment of a NULL status so the router is still correct
    // if it is ever mounted outside that gate.
    if (user.access_status === "pending") {
      res.status(403).json({ error: "Your community access is awaiting approval." });
      return;
    }
    if (user.access_status === "denied") {
      res.status(403).json({ error: "Your community access request was declined." });
      return;
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    req.hubUser = user;
    req.hubAdmin =
      user.email_verified === true &&
      ((user.roles ?? []).includes("admin") ||
        (!!user.email && adminEmails.includes(user.email.toLowerCase())));

    // Normally already resolved by the startup call in registerRoutes; this is
    // the retry path if the database was unreachable at boot. Memoised, so it
    // is a no-op await once it has succeeded.
    await ensureHubSchema();

    next();
  })().catch(next);
});

/**
 * Per-account write budget. Keyed on the authenticated account rather than
 * the IP: correct behind Replit's proxy, and one NAT'd network cannot
 * exhaust another user's budget.
 */
const writeLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as HubRequest).hubUser?.id ?? "anonymous",
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: "Please wait a minute before making more changes." },
});

/**
 * Applies to writes only. Reads stay unthrottled here so that polling the
 * overview cannot consume the budget a resident needs to submit a request.
 */
function guardWrites(req: Request, res: Response, next: NextFunction) {
  if (req.method === "GET" || req.method === "HEAD") return next();

  if (!(req as HubRequest).hubUser.email_verified) {
    return res
      .status(403)
      .json({ error: "Verify your email before submitting or managing services." });
  }

  // Same-origin writes only. The session cookie is SameSite=Lax, which already
  // blocks cross-site form POSTs; an explicit Origin check states the intent
  // and covers callers that do send an Origin header.
  const origin = req.get("origin");
  if (origin) {
    const hostOrigin = `${req.protocol}://${req.get("host")}`;
    const configured = process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
    if (origin !== hostOrigin && origin !== configured) {
      return res.status(403).json({ error: "Origin not allowed." });
    }
  }

  return writeLimit(req, res, next);
}

communityHubRouter.use(guardWrites);

/* ---------------------------- Overview ---------------------------- */

communityHubRouter.get(
  "/overview",
  route(async (req, res) => {
    const { id, country, city } = req.hubUser;

    const { rows: organisationRows } = await pool.query(
      `SELECT o.*,
              ${CAN_MANAGE} AS can_manage,
              (o.owner_id = $1) AS is_owner,
              EXISTS (
                SELECT 1 FROM hub_memberships m
                WHERE m.organisation_id = o.id AND m.user_id = $1
              ) AS following
       FROM hub_organisations o
       WHERE (o.status = 'verified' AND lower(o.country) = lower($2) AND lower(o.city) = lower($3))
          OR o.owner_id = $1
          OR ${CAN_MANAGE}
       ORDER BY o.name
       LIMIT 200`,
      [id, country, city],
    );

    // The directory shows only verified organisations in the caller's own
    // community. `managed` is a separate list, so the caller's pending or
    // rejected applications never leak into the public directory.
    const organisations = organisationRows
      .filter((row) => row.status === "verified" && sameCommunity(row, req.hubUser))
      .map(toDirectoryOrganisation);
    const managed = organisationRows
      .filter((row) => row.can_manage === true || row.is_owner === true)
      .map(toManagedOrganisation);

    const { rows: requestRows } = await pool.query(
      `SELECT r.*, o.name AS organisation_name,
              (o.status = 'verified' AND ${CAN_MANAGE}) AS can_manage
       FROM hub_requests r
       JOIN hub_organisations o ON o.id = r.organisation_id
       WHERE r.requester_id = $1 OR (o.status = 'verified' AND ${CAN_MANAGE})
       ORDER BY r.updated_at DESC
       LIMIT 200`,
      [id],
    );

    const { rows: noticeRows } = await pool.query(
      `SELECT n.id, n.title, n.body, n.created_at, o.name AS organisation_name
       FROM hub_notices n
       JOIN hub_organisations o ON o.id = n.organisation_id
       WHERE o.status = 'verified'
         AND lower(o.country) = lower($1)
         AND lower(o.city) = lower($2)
       ORDER BY n.created_at DESC
       LIMIT 30`,
      [country, city],
    );

    res.json({
      organisations,
      managed,
      requests: requestRows.map((row) => toServiceRequest(row, id)),
      notices: noticeRows.map(toNotice),
      isAdmin: req.hubAdmin,
      emailVerified: req.hubUser.email_verified === true,
      community: { country, city },
    });
  }),
);

/* ------------------------- Organisations -------------------------- */

communityHubRouter.post(
  "/organisations",
  route(async (req, res) => {
    const data = organisationInput.parse(req.body);
    if (!sameCommunity(data, req.hubUser)) {
      return res
        .status(400)
        .json({ error: "Register a service in your account's country and city." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Lock the applicant's existing rows so two concurrent submissions
      // cannot both observe a count below the cap.
      const { rows: existing } = await client.query(
        "SELECT id FROM hub_organisations WHERE owner_id = $1 FOR UPDATE",
        [req.hubUser.id],
      );
      if (existing.length >= MAX_ORGANISATIONS_PER_OWNER) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: `You can register up to ${MAX_ORGANISATIONS_PER_OWNER} organisations. Contact an administrator for assistance.`,
        });
      }

      const { rows } = await client.query(
        `INSERT INTO hub_organisations
           (id, owner_id, name, type, country, city, description, contact_email, phone, website)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          randomUUID(),
          req.hubUser.id,
          data.name,
          data.type,
          data.country,
          data.city,
          data.description,
          data.contactEmail.toLowerCase(),
          data.phone,
          data.website,
        ],
      );
      await client.query("COMMIT");

      res.status(201).json({
        id: rows[0].id,
        message:
          "Organisation submitted for verification. It stays private until an administrator who does not own it has verified it.",
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }),
);

communityHubRouter.post(
  "/organisations/:id/follow",
  route(async (req, res) => {
    const id = uuid(req.params.id);
    const { rows } = await pool.query(
      "SELECT country, city FROM hub_organisations WHERE id = $1 AND status = 'verified'",
      [id],
    );
    if (!rows[0] || !sameCommunity(rows[0], req.hubUser)) {
      return res.status(404).json({ error: "Service unavailable in your community." });
    }
    await pool.query(
      "INSERT INTO hub_memberships (organisation_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [id, req.hubUser.id],
    );
    res.json({ ok: true });
  }),
);

communityHubRouter.delete(
  "/organisations/:id/follow",
  route(async (req, res) => {
    // Only a 'resident' subscription is removable here. Staff membership is
    // managed by the owner and must not be droppable by the staff member.
    await pool.query(
      "DELETE FROM hub_memberships WHERE organisation_id = $1 AND user_id = $2 AND role = 'resident'",
      [uuid(req.params.id), req.hubUser.id],
    );
    res.json({ ok: true });
  }),
);

/* ---------------------------- Requests ---------------------------- */

communityHubRouter.post(
  "/requests",
  route(async (req, res) => {
    const data = requestInput.parse(req.body);

    const { rows } = await pool.query(
      "SELECT country, city FROM hub_organisations WHERE id = $1 AND status = 'verified'",
      [data.organisationId],
    );
    if (!rows[0] || !sameCommunity(rows[0], req.hubUser)) {
      return res.status(404).json({ error: "Choose a verified service in your community." });
    }

    const digest = fingerprint(data);
    const inserted = await pool.query(
      `INSERT INTO hub_requests
         (id, organisation_id, requester_id, idempotency_key, payload_fingerprint,
          title, description, category, neighbourhood, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (requester_id, idempotency_key) DO NOTHING
       RETURNING id`,
      [
        randomUUID(),
        data.organisationId,
        req.hubUser.id,
        data.idempotencyKey,
        digest,
        data.title,
        data.description,
        data.category,
        data.neighbourhood,
        data.location,
      ],
    );

    if (inserted.rows[0]) {
      return res.status(201).json({ id: inserted.rows[0].id, duplicate: false });
    }

    // The key was used before. Replaying the identical submission is a safe
    // retry and returns the original request; a different body under the same
    // key is a client bug and is rejected rather than silently discarded.
    const { rows: prior } = await pool.query(
      "SELECT id, payload_fingerprint FROM hub_requests WHERE requester_id = $1 AND idempotency_key = $2",
      [req.hubUser.id, data.idempotencyKey],
    );
    if (!prior[0]) {
      return res.status(409).json({ error: "Could not confirm the request. Please try again." });
    }
    if (prior[0].payload_fingerprint !== digest) {
      return res.status(409).json({
        error:
          "A different request was already submitted with this reference. Start a new request.",
      });
    }
    return res.json({ id: prior[0].id, duplicate: true });
  }),
);

communityHubRouter.get(
  "/requests/:id/updates",
  route(async (req, res) => {
    const id = uuid(req.params.id);
    const { rows } = await pool.query(
      `SELECT r.id FROM hub_requests r
       JOIN hub_organisations o ON o.id = r.organisation_id
       WHERE r.id = $2 AND (r.requester_id = $1 OR (o.status = 'verified' AND ${CAN_MANAGE}))`,
      [req.hubUser.id, id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Request not found." });

    const { rows: updates } = await pool.query(
      `SELECT id, state, note, created_at FROM hub_request_updates
       WHERE request_id = $1 ORDER BY created_at, id`,
      [id],
    );
    res.json(
      updates.map((u) => ({
        id: u.id,
        state: u.state,
        note: u.note,
        created_at: new Date(u.created_at).toISOString(),
      })),
    );
  }),
);

communityHubRouter.post(
  "/requests/:id/updates",
  route(async (req, res) => {
    const id = uuid(req.params.id);
    const data = updateInput.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Re-check management rights inside the transaction and lock the row, so
      // a concurrent revocation or a competing update cannot slip past.
      const { rows } = await client.query(
        `SELECT r.state, r.version FROM hub_requests r
         JOIN hub_organisations o ON o.id = r.organisation_id
         WHERE r.id = $2 AND o.status = 'verified' AND ${CAN_MANAGE}
         FOR UPDATE OF r`,
        [req.hubUser.id, id],
      );
      if (!rows[0]) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Request not found or you cannot manage it." });
      }
      if (rows[0].version !== data.version) {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .json({ error: "This request changed while you were working. Refresh and try again." });
      }
      if (!canTransition(rows[0].state as RequestState, data.state)) {
        await client.query("ROLLBACK");
        return res
          .status(409)
          .json({ error: `A request cannot move from ${rows[0].state} to ${data.state}.` });
      }

      await client.query(
        "UPDATE hub_requests SET state = $1, version = version + 1, updated_at = now() WHERE id = $2",
        [data.state, id],
      );
      await client.query(
        `INSERT INTO hub_request_updates (id, request_id, author_id, state, note)
         VALUES ($1,$2,$3,$4,$5)`,
        [randomUUID(), id, req.hubUser.id, data.state, data.note],
      );
      await client.query("COMMIT");
      res.json({ ok: true, version: data.version + 1 });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }),
);

/* ----------------------------- Notices ---------------------------- */

communityHubRouter.post(
  "/organisations/:id/notices",
  route(async (req, res) => {
    const id = uuid(req.params.id);
    const data = noticeInput.parse(req.body);
    if (!(await loadManagedOrg(req, id))) {
      return res.status(403).json({ error: "Only verified service staff can publish updates." });
    }
    await pool.query(
      "INSERT INTO hub_notices (id, organisation_id, author_id, title, body) VALUES ($1,$2,$3,$4,$5)",
      [randomUUID(), id, req.hubUser.id, data.title, data.body],
    );
    res.status(201).json({ ok: true });
  }),
);

/* ------------------------------ Staff ----------------------------- */

communityHubRouter.get(
  "/organisations/:id/staff",
  route(async (req, res) => {
    const id = uuid(req.params.id);
    if (!(await loadManagedOrg(req, id, true))) {
      return res.status(403).json({ error: "Only the organisation owner can manage staff." });
    }
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.email
       FROM hub_memberships m JOIN users u ON u.id = m.user_id
       WHERE m.organisation_id = $1 AND m.role = 'staff'
       ORDER BY u.username`,
      [id],
    );
    res.json(rows.map((r) => ({ id: r.id, username: r.username, email: r.email })));
  }),
);

communityHubRouter.post(
  "/organisations/:id/staff",
  route(async (req, res) => {
    const id = uuid(req.params.id);
    const { email } = staffInput.parse(req.body);
    if (!(await loadManagedOrg(req, id, true))) {
      return res
        .status(403)
        .json({ error: "Only the verified organisation owner can add staff." });
    }

    const { rows } = await pool.query(
      `SELECT id FROM users
       WHERE lower(email) = $1 AND email_verified = true
         AND (access_status IS NULL OR access_status = 'approved')`,
      [email.toLowerCase()],
    );
    if (!rows[0]) {
      return res
        .status(400)
        .json({ error: "The staff member needs an approved account and a verified email first." });
    }

    await pool.query(
      `INSERT INTO hub_memberships (organisation_id, user_id, role) VALUES ($1,$2,'staff')
       ON CONFLICT (organisation_id, user_id) DO UPDATE SET role = 'staff'`,
      [id, rows[0].id],
    );
    res.json({ ok: true });
  }),
);

communityHubRouter.delete(
  "/organisations/:id/staff/:userId",
  route(async (req, res) => {
    const id = uuid(req.params.id);
    if (!(await loadManagedOrg(req, id, true))) {
      return res.status(403).json({ error: "Only the organisation owner can manage staff." });
    }
    await pool.query(
      "DELETE FROM hub_memberships WHERE organisation_id = $1 AND user_id = $2 AND role = 'staff'",
      [id, req.params.userId],
    );
    res.json({ ok: true });
  }),
);

/* -------------------------- Verification -------------------------- */

communityHubRouter.get(
  "/verification",
  route(async (req, res) => {
    if (!req.hubAdmin) return res.status(403).json({ error: "Administrator access required." });
    const { rows } = await pool.query(
      `SELECT o.*, u.email AS applicant_email, u.username AS applicant_username
       FROM hub_organisations o JOIN users u ON u.id = o.owner_id
       ORDER BY (o.status = 'pending') DESC, o.created_at DESC
       LIMIT 200`,
    );
    res.json(rows.map((row) => toApplication(row, req.hubUser.id)));
  }),
);

communityHubRouter.post(
  "/verification/:id",
  route(async (req, res) => {
    if (!req.hubAdmin) return res.status(403).json({ error: "Administrator access required." });
    const data = reviewInput.parse(req.body);

    // `owner_id <> $3` enforces independent verification in the database
    // itself: an administrator can never decide their own application.
    const { rows } = await pool.query(
      `UPDATE hub_organisations
       SET status = $1, review_note = $2, reviewed_by = $3, reviewed_at = now()
       WHERE id = $4 AND owner_id <> $3
       RETURNING id`,
      [data.status, data.note, req.hubUser.id, uuid(req.params.id)],
    );
    if (!rows[0]) {
      return res.status(409).json({
        error:
          "Organisation unavailable. An administrator who does not own the application must review it.",
      });
    }
    res.json({ ok: true });
  }),
);

/* --------------------------- Error handler ------------------------ */

communityHubRouter.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: error.issues.map((i) => i.message).join("; ") });
  }
  if (error?.code === "23505") {
    return res.status(409).json({ error: "That organisation is already registered in this city." });
  }
  // Log the full error server-side; return a generic message to the client.
  console.error("[community-services] request failed:", error);
  res
    .status(503)
    .json({ error: "Community Services is temporarily unavailable. Please try again." });
});
