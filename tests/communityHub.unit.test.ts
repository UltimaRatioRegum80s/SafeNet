/**
 * Pure-logic tests for the Community Services shared contract, plus a guard
 * that the checked-in migration has not drifted from the DDL the server runs.
 * No database or network is involved.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  REQUEST_STATES,
  canTransition,
  nextStates,
  organisationInput,
  requestInput,
  sameCommunity,
  updateInput,
} from "../shared/communityHub";

const root = path.resolve(import.meta.dirname, "..");

describe("request lifecycle", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("submitted", "acknowledged")).toBe(true);
    expect(canTransition("acknowledged", "in_progress")).toBe(true);
    expect(canTransition("acknowledged", "resolved")).toBe(true);
    expect(canTransition("in_progress", "resolved")).toBe(true);
    expect(canTransition("resolved", "closed")).toBe(true);
    // Reopening a resolved request is deliberate: the problem may persist.
    expect(canTransition("resolved", "in_progress")).toBe(true);
  });

  it("refuses to skip acknowledgement or move backwards", () => {
    expect(canTransition("submitted", "resolved")).toBe(false);
    expect(canTransition("submitted", "in_progress")).toBe(false);
    expect(canTransition("in_progress", "acknowledged")).toBe(false);
    expect(canTransition("resolved", "acknowledged")).toBe(false);
  });

  it("treats closed as terminal", () => {
    for (const state of REQUEST_STATES) {
      expect(canTransition("closed", state)).toBe(false);
    }
    expect(nextStates("closed")).toEqual([]);
  });

  it("never offers a next state that canTransition would reject", () => {
    for (const from of REQUEST_STATES) {
      for (const to of nextStates(from)) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  it("rejects an unknown state without throwing", () => {
    expect(canTransition("nonsense" as any, "closed")).toBe(false);
  });
});

describe("community matching", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(
      sameCommunity({ country: "Namibia", city: "Windhoek" }, { country: " namibia ", city: "WINDHOEK" }),
    ).toBe(true);
  });

  it("does not match a different city or country", () => {
    expect(
      sameCommunity({ country: "Namibia", city: "Windhoek" }, { country: "Namibia", city: "Swakopmund" }),
    ).toBe(false);
    expect(
      sameCommunity({ country: "Namibia", city: "Windhoek" }, { country: "South Africa", city: "Windhoek" }),
    ).toBe(false);
  });
});

describe("input validation", () => {
  const validOrganisation = {
    name: "Windhoek City Water",
    type: "municipality",
    country: "Namibia",
    city: "Windhoek",
    description: "Water and sanitation.",
    contactEmail: "water@example.test",
    phone: "+264 61 000 000",
  };

  it("accepts an organisation without a website and defaults it to empty", () => {
    const parsed = organisationInput.parse(validOrganisation);
    expect(parsed.website).toBe("");
  });

  it("rejects a non-http website scheme", () => {
    expect(() =>
      organisationInput.parse({ ...validOrganisation, website: "javascript:alert(1)" }),
    ).toThrow();
  });

  it("rejects unknown fields rather than silently dropping them", () => {
    expect(() =>
      organisationInput.parse({ ...validOrganisation, status: "verified" }),
    ).toThrow();
  });

  it("requires a neighbourhood on a service request", () => {
    const base = {
      organisationId: "0f9f1a2e-3b4c-4d5e-8f70-112233445566",
      title: "Streetlight out",
      description: "Dark corner for a week.",
      category: "electricity",
      location: "Corner of Sam Nujoma",
      idempotencyKey: "0f9f1a2e-3b4c-4d5e-8f70-112233445567",
    };
    expect(() => requestInput.parse(base)).toThrow();
    expect(requestInput.parse({ ...base, neighbourhood: "Klein Windhoek" }).neighbourhood).toBe(
      "Klein Windhoek",
    );
  });

  it("coerces the version a form submits as a string", () => {
    // The status form posts multipart/urlencoded-style values, so the version
    // arrives as a string; the schema must accept it as an integer.
    expect(updateInput.parse({ state: "acknowledged", note: "Logged.", version: "3" }).version).toBe(3);
  });

  it("rejects a version below one", () => {
    expect(() => updateInput.parse({ state: "acknowledged", note: "Logged.", version: 0 })).toThrow();
  });
});

describe("migration parity", () => {
  it("keeps migrations/community_hub.sql identical to the DDL the server runs", () => {
    const source = readFileSync(path.join(root, "server", "communityHub.ts"), "utf8");
    const match = source.match(/export const HUB_DDL = `([\s\S]*?)`;/);
    expect(match, "HUB_DDL literal not found in server/communityHub.ts").toBeTruthy();

    const ddl = match![1].replace(/^\n/, "").trim();
    const migration = readFileSync(path.join(root, "migrations", "community_hub.sql"), "utf8")
      // Drop the leading comment header.
      .replace(/^(--[^\n]*\n)+/, "")
      .trim();

    expect(migration).toBe(ddl);
  });

  it("only creates additive hub_* objects", () => {
    const migration = readFileSync(path.join(root, "migrations", "community_hub.sql"), "utf8");
    expect(migration).not.toMatch(/\bDROP\b/i);
    // The single ALTER is the additive backfill of payload_fingerprint.
    const alters = migration.match(/^ALTER TABLE .*/gim) ?? [];
    expect(alters).toHaveLength(1);
    expect(alters[0]).toMatch(/ALTER TABLE hub_requests ADD COLUMN IF NOT EXISTS/i);

    for (const statement of migration.match(/CREATE TABLE IF NOT EXISTS (\w+)/gi) ?? []) {
      expect(statement).toMatch(/hub_/);
    }
  });
});
