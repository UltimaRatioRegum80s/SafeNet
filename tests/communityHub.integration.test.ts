/**
 * Community Services router — integration tests against a real PostgreSQL.
 *
 * The router is mounted on a bare Express app with a stub session middleware
 * that reads the caller's user id from a test header. Everything below that
 * — SQL, transactions, row locks, constraints — is the real thing.
 *
 * Covers the access, isolation and concurrency behaviour the feature depends
 * on: anonymous/pending/unverified callers, resident vs staff vs owner vs
 * administrator, independent verification, cross-user and cross-organisation
 * request isolation, invalid transitions, optimistic concurrency, duplicate
 * submissions, permission revocation and transaction rollback.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import {
  createTestUser,
  startTestDatabase,
  truncateHubTables,
  type TestDatabase,
} from "./helpers/testDatabase";

// server/db.ts builds a Neon serverless Pool, which speaks WebSocket to Neon's
// proxy and cannot address a local server. Swap in the node-postgres Pool
// pointed at the throwaway cluster; the router only uses `query` and
// `connect`, which are API-compatible.
const holder = vi.hoisted(() => ({ pool: null as any }));
vi.mock("../server/db", () => ({
  get pool() {
    return holder.pool;
  },
  db: {},
}));

let database: TestDatabase;
let server: Server;
let baseUrl: string;

type CallOptions = { method?: string; body?: unknown; origin?: string };

async function call(userId: string | null, path: string, options: CallOptions = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userId) headers["x-test-user"] = userId;
  if (options.origin) headers["Origin"] = options.origin;

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

const ORG = {
  name: "Windhoek City Water",
  type: "municipality" as const,
  country: "Namibia",
  city: "Windhoek",
  description: "Water and sanitation for the city.",
  contactEmail: "water@example.test",
  phone: "+264 61 000 000",
  website: "",
};

/** Register an organisation and have an independent administrator verify it. */
async function verifiedOrg(
  ownerId: string,
  adminId: string,
  overrides: Partial<typeof ORG> = {},
): Promise<string> {
  const created = await call(ownerId, "/organisations", {
    method: "POST",
    body: { ...ORG, ...overrides },
  });
  expect(created.status).toBe(201);
  const decision = await call(adminId, `/verification/${created.body.id}`, {
    method: "POST",
    body: { status: "verified", note: "Confirmed by phone against the published council number." },
  });
  expect(decision.status).toBe(200);
  return created.body.id as string;
}

async function submitRequest(userId: string, organisationId: string, overrides: any = {}) {
  return call(userId, "/requests", {
    method: "POST",
    body: {
      organisationId,
      title: "Streetlight out on Sam Nujoma Drive",
      description: "The light has been off for a week and the corner is very dark.",
      category: "electricity",
      neighbourhood: "Klein Windhoek",
      location: "Corner of Sam Nujoma and Nelson Mandela",
      idempotencyKey: randomUUID(),
      ...overrides,
    },
  });
}

beforeAll(async () => {
  database = await startTestDatabase();
  holder.pool = database.pool;

  // Imported only after the pool exists, so the mocked module resolves.
  const { communityHubRouter, ensureHubSchema } = await import("../server/communityHub");
  await ensureHubSchema();

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = req.header("x-test-user");
    (req as any).session = id ? { userId: id } : {};
    next();
  });
  app.use("/api/community-services", communityHubRouter);

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/community-services`;
});

afterAll(async () => {
  await new Promise((resolve) => server?.close(resolve));
  await database?.stop();
});

beforeEach(async () => {
  await truncateHubTables(database.pool);
});

/* ------------------------------------------------------------------ */

describe("access control", () => {
  it("rejects a caller with no session", async () => {
    const result = await call(null, "/overview");
    expect(result.status).toBe(401);
  });

  it("rejects a session for a user that no longer exists", async () => {
    const result = await call(randomUUID(), "/overview");
    expect(result.status).toBe(401);
  });

  it("rejects an account still awaiting access approval", async () => {
    const user = await createTestUser(database.pool, { accessStatus: "pending" });
    const result = await call(user.id, "/overview");
    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/awaiting approval/i);
  });

  it("rejects an account whose access was denied", async () => {
    const user = await createTestUser(database.pool, { accessStatus: "denied" });
    expect((await call(user.id, "/overview")).status).toBe(403);
  });

  it("lets an unverified email read, but not write", async () => {
    const user = await createTestUser(database.pool, { emailVerified: false });

    const read = await call(user.id, "/overview");
    expect(read.status).toBe(200);
    expect(read.body.emailVerified).toBe(false);

    const write = await call(user.id, "/organisations", { method: "POST", body: ORG });
    expect(write.status).toBe(403);
    expect(write.body.error).toMatch(/verify your email/i);
  });

  it("rejects a write from a foreign origin", async () => {
    const user = await createTestUser(database.pool);
    const result = await call(user.id, "/organisations", {
      method: "POST",
      body: ORG,
      origin: "https://evil.example",
    });
    expect(result.status).toBe(403);
    expect(result.body.error).toMatch(/origin/i);
  });

  it("does not treat a plain resident as an administrator", async () => {
    const user = await createTestUser(database.pool);
    const overview = await call(user.id, "/overview");
    expect(overview.body.isAdmin).toBe(false);
    expect((await call(user.id, "/verification")).status).toBe(403);
  });
});

describe("organisation registration and independent verification", () => {
  it("keeps a new application out of the directory until it is verified", async () => {
    const owner = await createTestUser(database.pool);
    const neighbour = await createTestUser(database.pool);

    const created = await call(owner.id, "/organisations", { method: "POST", body: ORG });
    expect(created.status).toBe(201);

    // The owner sees their own application under `managed`, never `organisations`.
    const ownerView = await call(owner.id, "/overview");
    expect(ownerView.body.organisations).toHaveLength(0);
    expect(ownerView.body.managed).toHaveLength(1);
    expect(ownerView.body.managed[0].status).toBe("pending");
    expect(ownerView.body.managed[0].is_owner).toBe(true);

    // Nobody else sees it at all.
    const otherView = await call(neighbour.id, "/overview");
    expect(otherView.body.organisations).toHaveLength(0);
    expect(otherView.body.managed).toHaveLength(0);
  });

  it("refuses to let an administrator verify their own application", async () => {
    const admin = await createTestUser(database.pool, { roles: ["resident", "admin"] });

    const created = await call(admin.id, "/organisations", { method: "POST", body: ORG });
    expect(created.status).toBe(201);

    const decision = await call(admin.id, `/verification/${created.body.id}`, {
      method: "POST",
      body: { status: "verified", note: "Verifying my own application should not be possible." },
    });
    expect(decision.status).toBe(409);

    const { rows } = await database.pool.query("SELECT status FROM hub_organisations WHERE id=$1", [
      created.body.id,
    ]);
    expect(rows[0].status).toBe("pending");
  });

  it("publishes the organisation once an independent administrator verifies it", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const resident = await createTestUser(database.pool);

    await verifiedOrg(owner.id, admin.id);

    const view = await call(resident.id, "/overview");
    expect(view.body.organisations).toHaveLength(1);
    expect(view.body.organisations[0].name).toBe(ORG.name);
  });

  it("never exposes owner or review metadata through the directory", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const resident = await createTestUser(database.pool);

    await verifiedOrg(owner.id, admin.id);

    const listed = (await call(resident.id, "/overview")).body.organisations[0];
    expect(listed).not.toHaveProperty("owner_id");
    expect(listed).not.toHaveProperty("review_note");
    expect(listed).not.toHaveProperty("reviewed_by");
    expect(listed).not.toHaveProperty("reviewed_at");
    // The public contact details are intended to be visible.
    expect(listed.contact_email).toBe(ORG.contactEmail);
  });

  it("scopes the directory to the caller's own city", async () => {
    const owner = await createTestUser(database.pool, { city: "Windhoek" });
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    await verifiedOrg(owner.id, admin.id);

    const outsider = await createTestUser(database.pool, { city: "Swakopmund" });
    const view = await call(outsider.id, "/overview");
    expect(view.body.organisations).toHaveLength(0);
  });

  it("refuses an organisation registered outside the applicant's community", async () => {
    const owner = await createTestUser(database.pool, { city: "Windhoek" });
    const result = await call(owner.id, "/organisations", {
      method: "POST",
      body: { ...ORG, city: "Cape Town", country: "South Africa" },
    });
    expect(result.status).toBe(400);
  });

  it("caps the number of applications one account may hold", async () => {
    const owner = await createTestUser(database.pool);
    for (let i = 0; i < 5; i++) {
      const created = await call(owner.id, "/organisations", {
        method: "POST",
        body: { ...ORG, name: `${ORG.name} ${i}` },
      });
      expect(created.status).toBe(201);
    }
    const sixth = await call(owner.id, "/organisations", {
      method: "POST",
      body: { ...ORG, name: `${ORG.name} overflow` },
    });
    expect(sixth.status).toBe(409);
  });

  it("rejects a duplicate organisation name in the same city", async () => {
    const owner = await createTestUser(database.pool);
    const other = await createTestUser(database.pool);
    expect((await call(owner.id, "/organisations", { method: "POST", body: ORG })).status).toBe(201);
    const clash = await call(other.id, "/organisations", { method: "POST", body: ORG });
    expect(clash.status).toBe(409);
  });
});

describe("service requests", () => {
  it("isolates a resident's request from other residents", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);

    const resident = await createTestUser(database.pool);
    const stranger = await createTestUser(database.pool);

    const created = await submitRequest(resident.id, organisationId);
    expect(created.status).toBe(201);

    expect((await call(resident.id, "/overview")).body.requests).toHaveLength(1);
    expect((await call(stranger.id, "/overview")).body.requests).toHaveLength(0);

    // Nor can a stranger read its history directly.
    const history = await call(stranger.id, `/requests/${created.body.id}/updates`);
    expect(history.status).toBe(404);
  });

  it("does not leak requests across organisations", async () => {
    const adminUser = await createTestUser(database.pool, { roles: ["admin"] });
    const ownerA = await createTestUser(database.pool);
    const ownerB = await createTestUser(database.pool);
    const orgA = await verifiedOrg(ownerA.id, adminUser.id, { name: "Service A" });
    const orgB = await verifiedOrg(ownerB.id, adminUser.id, { name: "Service B" });
    expect(orgB).toBeTruthy();

    const resident = await createTestUser(database.pool);
    await submitRequest(resident.id, orgA);

    // Owner B manages a different organisation and must see nothing.
    expect((await call(ownerB.id, "/overview")).body.requests).toHaveLength(0);
    // Owner A sees it as manageable work.
    const ownerAView = await call(ownerA.id, "/overview");
    expect(ownerAView.body.requests).toHaveLength(1);
    expect(ownerAView.body.requests[0].can_manage).toBe(true);
    expect(ownerAView.body.requests[0].is_mine).toBe(false);
  });

  it("refuses a request aimed at an unverified organisation", async () => {
    const owner = await createTestUser(database.pool);
    const created = await call(owner.id, "/organisations", { method: "POST", body: ORG });
    const resident = await createTestUser(database.pool);

    const result = await submitRequest(resident.id, created.body.id);
    expect(result.status).toBe(404);
  });

  it("treats a replayed submission as the same request", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const resident = await createTestUser(database.pool);

    const idempotencyKey = randomUUID();
    const first = await submitRequest(resident.id, organisationId, { idempotencyKey });
    const second = await submitRequest(resident.id, organisationId, { idempotencyKey });

    expect(first.status).toBe(201);
    expect(first.body.duplicate).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.id).toBe(first.body.id);

    const { rows } = await database.pool.query("SELECT count(*)::int AS n FROM hub_requests");
    expect(rows[0].n).toBe(1);
  });

  it("rejects a different payload replayed under the same reference", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const resident = await createTestUser(database.pool);

    const idempotencyKey = randomUUID();
    expect((await submitRequest(resident.id, organisationId, { idempotencyKey })).status).toBe(201);

    const changed = await submitRequest(resident.id, organisationId, {
      idempotencyKey,
      title: "A completely different problem",
    });
    expect(changed.status).toBe(409);
    expect(changed.body.error).toMatch(/different request/i);
  });

  it("rejects an invalid state transition and leaves the request untouched", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const resident = await createTestUser(database.pool);
    const created = await submitRequest(resident.id, organisationId);

    // submitted -> resolved is not allowed; it must be acknowledged first.
    const result = await call(owner.id, `/requests/${created.body.id}/updates`, {
      method: "POST",
      body: { state: "resolved", note: "Skipping ahead should fail.", version: 1 },
    });
    expect(result.status).toBe(409);

    const { rows } = await database.pool.query(
      "SELECT state, version FROM hub_requests WHERE id=$1",
      [created.body.id],
    );
    expect(rows[0].state).toBe("submitted");
    expect(rows[0].version).toBe(1);

    // The rejected attempt must not have written a history entry.
    const { rows: updates } = await database.pool.query(
      "SELECT count(*)::int AS n FROM hub_request_updates WHERE request_id=$1",
      [created.body.id],
    );
    expect(updates[0].n).toBe(0);
  });

  it("rejects an update built on a stale version", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const resident = await createTestUser(database.pool);
    const created = await submitRequest(resident.id, organisationId);

    const first = await call(owner.id, `/requests/${created.body.id}/updates`, {
      method: "POST",
      body: { state: "acknowledged", note: "We have logged this.", version: 1 },
    });
    expect(first.status).toBe(200);

    const stale = await call(owner.id, `/requests/${created.body.id}/updates`, {
      method: "POST",
      body: { state: "acknowledged", note: "Duplicate of the same edit.", version: 1 },
    });
    expect(stale.status).toBe(409);
  });

  it("lets only one of two simultaneous updates win", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const resident = await createTestUser(database.pool);
    const created = await submitRequest(resident.id, organisationId);

    const body = { state: "acknowledged", note: "Racing update.", version: 1 };
    const [a, b] = await Promise.all([
      call(owner.id, `/requests/${created.body.id}/updates`, { method: "POST", body }),
      call(owner.id, `/requests/${created.body.id}/updates`, { method: "POST", body }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const { rows } = await database.pool.query("SELECT version FROM hub_requests WHERE id=$1", [
      created.body.id,
    ]);
    expect(rows[0].version).toBe(2);
  });

  it("shows the resident the history written by the service", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const resident = await createTestUser(database.pool);
    const created = await submitRequest(resident.id, organisationId);

    await call(owner.id, `/requests/${created.body.id}/updates`, {
      method: "POST",
      body: { state: "acknowledged", note: "A crew is scheduled for Thursday.", version: 1 },
    });

    const history = await call(resident.id, `/requests/${created.body.id}/updates`);
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].note).toMatch(/Thursday/);
  });

  it("does not let the resident who raised a request manage it", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const resident = await createTestUser(database.pool);
    const created = await submitRequest(resident.id, organisationId);

    const result = await call(resident.id, `/requests/${created.body.id}/updates`, {
      method: "POST",
      body: { state: "acknowledged", note: "Marking my own request as handled.", version: 1 },
    });
    expect(result.status).toBe(404);
  });
});

describe("staff and revocation", () => {
  it("gives staff management rights, but reserves staff administration to the owner", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const staff = await createTestUser(database.pool);

    const added = await call(owner.id, `/organisations/${organisationId}/staff`, {
      method: "POST",
      body: { email: staff.email },
    });
    expect(added.status).toBe(200);

    // Staff can manage requests...
    const resident = await createTestUser(database.pool);
    const created = await submitRequest(resident.id, organisationId);
    const update = await call(staff.id, `/requests/${created.body.id}/updates`, {
      method: "POST",
      body: { state: "acknowledged", note: "Staff acknowledging the report.", version: 1 },
    });
    expect(update.status).toBe(200);

    // ...but cannot administer the staff list, and are not flagged as owner.
    expect((await call(staff.id, `/organisations/${organisationId}/staff`)).status).toBe(403);
    const staffView = await call(staff.id, "/overview");
    const managed = staffView.body.managed.find((o: any) => o.id === organisationId);
    expect(managed.can_manage).toBe(true);
    expect(managed.is_owner).toBe(false);
  });

  it("refuses to add a staff member without a verified, approved account", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const unverified = await createTestUser(database.pool, { emailVerified: false });

    const result = await call(owner.id, `/organisations/${organisationId}/staff`, {
      method: "POST",
      body: { email: unverified.email },
    });
    expect(result.status).toBe(400);
  });

  it("stops a removed staff member from managing requests immediately", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const staff = await createTestUser(database.pool);
    await call(owner.id, `/organisations/${organisationId}/staff`, {
      method: "POST",
      body: { email: staff.email },
    });

    const resident = await createTestUser(database.pool);
    const created = await submitRequest(resident.id, organisationId);

    const removed = await call(
      owner.id,
      `/organisations/${organisationId}/staff/${staff.id}`,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);

    const attempt = await call(staff.id, `/requests/${created.body.id}/updates`, {
      method: "POST",
      body: { state: "acknowledged", note: "Should be refused after removal.", version: 1 },
    });
    expect(attempt.status).toBe(404);
  });

  it("stops the workspace when verification is revoked", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const resident = await createTestUser(database.pool);
    const created = await submitRequest(resident.id, organisationId);

    const revoked = await call(admin.id, `/verification/${organisationId}`, {
      method: "POST",
      body: { status: "rejected", note: "Could not confirm authority on a second check." },
    });
    expect(revoked.status).toBe(200);

    // Gone from the directory...
    expect((await call(resident.id, "/overview")).body.organisations).toHaveLength(0);
    // ...and the owner can no longer act on its requests or publish notices.
    const attempt = await call(owner.id, `/requests/${created.body.id}/updates`, {
      method: "POST",
      body: { state: "acknowledged", note: "Should be refused after revocation.", version: 1 },
    });
    expect(attempt.status).toBe(404);

    const notice = await call(owner.id, `/organisations/${organisationId}/notices`, {
      method: "POST",
      body: { title: "Still here", body: "Should not publish." },
    });
    expect(notice.status).toBe(403);
  });
});

describe("notices", () => {
  it("shows notices from verified organisations to the city, and nobody else", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);

    const published = await call(owner.id, `/organisations/${organisationId}/notices`, {
      method: "POST",
      body: { title: "Planned water outage", body: "Tuesday 09:00 to 14:00 in Klein Windhoek." },
    });
    expect(published.status).toBe(201);

    const local = await createTestUser(database.pool, { city: "Windhoek" });
    expect((await call(local.id, "/overview")).body.notices).toHaveLength(1);

    const elsewhere = await createTestUser(database.pool, { city: "Swakopmund" });
    expect((await call(elsewhere.id, "/overview")).body.notices).toHaveLength(0);
  });

  it("refuses a notice from someone who does not manage the organisation", async () => {
    const owner = await createTestUser(database.pool);
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const organisationId = await verifiedOrg(owner.id, admin.id);
    const stranger = await createTestUser(database.pool);

    const result = await call(stranger.id, `/organisations/${organisationId}/notices`, {
      method: "POST",
      body: { title: "Unauthorised", body: "This should be refused." },
    });
    expect(result.status).toBe(403);
  });
});

describe("administrator review queue", () => {
  it("marks the administrator's own application so it cannot be self-reviewed", async () => {
    const admin = await createTestUser(database.pool, { roles: ["admin"] });
    const owner = await createTestUser(database.pool);

    await call(admin.id, "/organisations", { method: "POST", body: { ...ORG, name: "Admin's own" } });
    await call(owner.id, "/organisations", { method: "POST", body: ORG });

    const queue = await call(admin.id, "/verification");
    expect(queue.status).toBe(200);

    const own = queue.body.find((o: any) => o.name === "Admin's own");
    const other = queue.body.find((o: any) => o.name === ORG.name);
    expect(own.is_own_application).toBe(true);
    expect(other.is_own_application).toBe(false);
    // The queue is the one place applicant identity is legitimately shown.
    expect(other.applicant_email).toBe(owner.email);
    // Even here, the raw owner id is not part of the contract.
    expect(other).not.toHaveProperty("owner_id");
  });
});
