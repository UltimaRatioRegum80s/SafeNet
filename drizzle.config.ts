import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  /**
   * The Community Services tables are created and owned by
   * server/communityHub.ts (HUB_DDL, mirrored in migrations/community_hub.sql),
   * not declared in shared/schema.ts. drizzle-kit push reconciles the database
   * against the declared schema, so without this filter it treats every
   * `hub_*` table as one to drop.
   *
   * Verified against a real PostgreSQL on 6 September 2026: `drizzle-kit push`
   * offered "You're about to delete hub_organisations table with 1 items",
   * plus hub_requests and hub_memberships. Confirming that would destroy every
   * registered organisation, service request and staff membership.
   *
   * Excluding them here makes `npm run db:push` safe to run. Remove this only
   * if the hub tables are moved into shared/schema.ts as Drizzle definitions.
   */
  tablesFilter: ["!hub_*"],
});
