/**
 * Boots a throwaway PostgreSQL for the Community Services integration suite.
 *
 * A real PostgreSQL is used rather than a mock or an in-memory emulation,
 * because the behaviour under test is mostly SQL: row locking under
 * concurrency, ON CONFLICT idempotency, CHECK constraints and the
 * `owner_id <> reviewer` predicate that enforces independent verification.
 * None of that is exercised by a fake.
 *
 * The binaries come from the `embedded-postgres` dev dependency, and the
 * cluster lives in a temporary directory that is destroyed after the run.
 * It never touches a development or production database.
 */
import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

/**
 * Minimal `users` table: only the columns the Community Services router
 * reads or joins on, with the same types and nullability as
 * shared/schema.ts. Kept deliberately small so a change to the real schema
 * that breaks this router shows up as a failing test rather than passing
 * against an over-permissive fixture.
 */
const USERS_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  password_hash text,
  username text NOT NULL,
  roles text[] NOT NULL DEFAULT ARRAY['resident']::text[],
  country text NOT NULL,
  city text NOT NULL,
  neighbourhood text,
  email_verified boolean DEFAULT false,
  access_status varchar DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
`;

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

export type TestDatabase = {
  pool: Pool;
  stop: () => Promise<void>;
};

export async function startTestDatabase(): Promise<TestDatabase> {
  const dataDir = await mkdtemp(path.join(tmpdir(), "nabornet-hub-pg-"));
  const port = await freePort();

  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("hubtest");

  const pool = new Pool({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password: "postgres",
    database: "hubtest",
    max: 8,
  });

  await pool.query(USERS_DDL);

  return {
    pool,
    stop: async () => {
      await pool.end().catch(() => undefined);
      await postgres.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}

let userCounter = 0;

export type TestUserOptions = {
  city?: string;
  country?: string;
  emailVerified?: boolean;
  accessStatus?: string | null;
  roles?: string[];
  neighbourhood?: string | null;
};

/** Insert a user and return its id. Defaults to an approved, verified resident. */
export async function createTestUser(
  pool: Pool,
  options: TestUserOptions = {},
): Promise<{ id: string; email: string; username: string }> {
  const n = ++userCounter;
  const email = `user${n}@example.test`;
  const username = `user${n}`;
  const { rows } = await pool.query(
    `INSERT INTO users (email, username, roles, country, city, neighbourhood, email_verified, access_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      email,
      username,
      options.roles ?? ["resident"],
      options.country ?? "Namibia",
      options.city ?? "Windhoek",
      options.neighbourhood ?? "Klein Windhoek",
      options.emailVerified ?? true,
      options.accessStatus === undefined ? "approved" : options.accessStatus,
    ],
  );
  return { id: rows[0].id, email, username };
}

/** Remove all hub data between tests, leaving the schema in place. */
export async function truncateHubTables(pool: Pool): Promise<void> {
  await pool.query(
    `TRUNCATE hub_request_updates, hub_requests, hub_notices, hub_memberships, hub_organisations
     RESTART IDENTITY CASCADE`,
  );
}
