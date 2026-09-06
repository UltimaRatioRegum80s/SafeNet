/**
 * Email: availability is not delivery.
 *
 * Two separate failures are pinned down here. First, the server must survive
 * an absent RESEND_API_KEY — the Resend constructor throws on a falsy key and
 * this module is imported by server/routes.ts, which is what once took the
 * whole process down at boot and left the app on "Loading NaborNet...".
 * Second, "we did not send it" must never be reported as "sent": the callers
 * in server/routes.ts branch on these outcomes.
 *
 * The Resend SDK is stubbed, so nothing here contacts a provider or sends a
 * message to a real address.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
const construct = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
    constructor(key: string) {
      construct(key);
      // The real constructor throws when the key is falsy.
      if (!key) throw new Error("Missing API key. Pass it to the constructor `new Resend(\"re_123\")`");
    }
  },
}));

const { sendVerificationEmail, sendPasswordResetEmail, resetEmailClientForTests } = await import(
  "../server/email"
);

const RECIPIENT = "resident@example.test";
const TOKEN = "8f14e45fceea167a5a36dedd4bea2543deadbeefdeadbeefdeadbeefdeadbeef";

let logs: string[];

beforeEach(() => {
  send.mockReset();
  construct.mockReset();
  resetEmailClientForTests();
  delete process.env.RESEND_API_KEY;

  logs = [];
  const capture =
    (...args: unknown[]) =>
      logs.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
  vi.spyOn(console, "log").mockImplementation(capture);
  vi.spyOn(console, "warn").mockImplementation(capture);
  vi.spyOn(console, "error").mockImplementation(capture);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.RESEND_API_KEY;
  resetEmailClientForTests();
});

describe("without RESEND_API_KEY", () => {
  it("reports not_configured instead of throwing", async () => {
    await expect(sendVerificationEmail(RECIPIENT, TOKEN, "resident")).resolves.toEqual({
      sent: false,
      reason: "not_configured",
    });
    await expect(sendPasswordResetEmail(RECIPIENT, TOKEN, "resident")).resolves.toEqual({
      sent: false,
      reason: "not_configured",
    });
    // Never constructed, so the constructor's throw cannot reach the caller.
    expect(construct).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("warns once rather than on every attempt", async () => {
    await sendVerificationEmail(RECIPIENT, TOKEN, "resident");
    await sendVerificationEmail(RECIPIENT, TOKEN, "resident");
    await sendPasswordResetEmail(RECIPIENT, TOKEN, "resident");

    const keyWarnings = logs.filter((line) => line.includes("RESEND_API_KEY is not set"));
    expect(keyWarnings).toHaveLength(1);
  });

  it("recovers when delivery is configured afterwards, without a restart", async () => {
    expect((await sendVerificationEmail(RECIPIENT, TOKEN, "resident")).sent).toBe(false);

    // What setting the Replit secret looks like to this module.
    process.env.RESEND_API_KEY = "re_test_key";
    send.mockResolvedValue({ error: null });

    await expect(sendVerificationEmail(RECIPIENT, TOKEN, "resident")).resolves.toEqual({
      sent: true,
    });
    await expect(sendPasswordResetEmail(RECIPIENT, TOKEN, "resident")).resolves.toEqual({
      sent: true,
    });
  });
});

describe("with a configured provider", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
  });

  it("reports a send that succeeded", async () => {
    send.mockResolvedValue({ error: null });
    await expect(sendVerificationEmail(RECIPIENT, TOKEN, "resident")).resolves.toEqual({
      sent: true,
    });
  });

  it("reports a provider rejection as not sent", async () => {
    send.mockResolvedValue({
      error: { name: "validation_error", message: "Invalid `to` field." },
    });
    await expect(sendVerificationEmail(RECIPIENT, TOKEN, "resident")).resolves.toEqual({
      sent: false,
      reason: "rejected",
    });
    await expect(sendPasswordResetEmail(RECIPIENT, TOKEN, "resident")).resolves.toEqual({
      sent: false,
      reason: "rejected",
    });
  });

  it("reports a thrown transport failure as not sent", async () => {
    send.mockRejectedValue(new Error("socket hang up"));
    await expect(sendVerificationEmail(RECIPIENT, TOKEN, "resident")).resolves.toEqual({
      sent: false,
      reason: "error",
    });
  });

  it("survives a constructor that throws on an unusable key", async () => {
    // Empty string is falsy for our own check, so force the constructor path
    // with a key the stub rejects.
    process.env.RESEND_API_KEY = "re_test_key";
    construct.mockImplementation(() => {
      throw new Error("Unusable API key");
    });
    await expect(sendVerificationEmail(RECIPIENT, TOKEN, "resident")).resolves.toEqual({
      sent: false,
      reason: "not_configured",
    });
  });
});

describe("logging", () => {
  it("never writes the recipient, the token or the key to the log", async () => {
    process.env.RESEND_API_KEY = "re_secret_key_value";

    send.mockResolvedValue({ error: null });
    await sendVerificationEmail(RECIPIENT, TOKEN, "resident");

    send.mockResolvedValue({ error: { name: "validation_error", message: "Invalid `to` field." } });
    await sendPasswordResetEmail(RECIPIENT, TOKEN, "resident");

    send.mockRejectedValue(new Error("socket hang up"));
    await sendVerificationEmail(RECIPIENT, TOKEN, "resident");

    const everything = logs.join("\n");
    expect(everything).not.toContain(RECIPIENT);
    expect(everything).not.toContain(TOKEN);
    expect(everything).not.toContain("re_secret_key_value");
    // Still says enough to diagnose.
    expect(everything).toMatch(/verification/);
    expect(everything).toMatch(/password reset/);
    expect(everything).toMatch(/rejected|error/);
  });
});
