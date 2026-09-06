/**
 * Shared-device privacy: what a sign-out must leave behind.
 *
 * The scenario these tests encode is two people on one browser. Account A
 * opens Community Services — private service requests, the timeline notes a
 * service wrote back, an owner's staff list — then signs out, and account B
 * signs in. Nothing of A's may still be readable, including a response to a
 * request A started that only arrives after A has gone.
 *
 * They run in the vitest `node` environment (see vitest.config.ts), so the
 * browser globals the module touches are stubbed here explicitly. That is
 * also the point of the last group: teardown runs on real devices where
 * storage is blocked or a service worker is unavailable, and it must degrade
 * rather than abandon the sign-out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  PRIVATE_LOCAL_KEYS,
  PRIVATE_SESSION_KEYS,
  purgeSessionData,
} from "../client/src/lib/sessionTeardown";

/** Minimal Storage stand-in; `explode` models a browser blocking site data. */
function fakeStorage(explode = false): Storage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => {
      if (explode) throw new Error("site data is blocked");
      map.delete(k);
    },
    clear: () => map.clear(),
  } as Storage & { map: Map<string, string> };
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const ACCOUNT_A = "a0000000-0000-4000-8000-000000000001";
const ACCOUNT_B = "b0000000-0000-4000-8000-000000000002";

let localStore: ReturnType<typeof fakeStorage>;
let sessionStore: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  localStore = fakeStorage();
  sessionStore = fakeStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: localStore,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: sessionStore,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("query cache eviction on sign-out", () => {
  it("removes the previous account's Community Services data", async () => {
    const client = newClient();

    // The four query keys the Services page uses.
    client.setQueryData(["community-services", ACCOUNT_A], {
      requests: [{ id: "r1", title: "Broken streetlight", location: "12 Oak Street" }],
    });
    client.setQueryData(["service-updates", "r1", ACCOUNT_A], [
      { id: "u1", note: "Technician assigned; resident phoned on 081..." },
    ]);
    client.setQueryData(["service-staff", "org-1", ACCOUNT_A], [
      { id: "s1", username: "controller", email: "controller@example.test" },
    ]);
    client.setQueryData(["service-verification", ACCOUNT_A], [{ id: "app-1" }]);

    await purgeSessionData(client);

    expect(client.getQueryCache().getAll()).toHaveLength(0);
    for (const key of [
      ["community-services", ACCOUNT_A],
      ["service-updates", "r1", ACCOUNT_A],
      ["service-staff", "org-1", ACCOUNT_A],
      ["service-verification", ACCOUNT_A],
    ]) {
      expect(client.getQueryData(key)).toBeUndefined();
    }
  });

  it("removes shared and unscoped data too, not just user-keyed queries", async () => {
    const client = newClient();
    // Keys with no account in them at all: the ones a naive "user-scoped keys
    // are enough" argument misses.
    client.setQueryData(["/api/notifications"], [{ id: "n1", body: "Your request was resolved" }]);
    client.setQueryData(["service-staff", "org-1"], [{ email: "controller@example.test" }]);

    await purgeSessionData(client);

    expect(client.getQueryData(["/api/notifications"])).toBeUndefined();
    expect(client.getQueryData(["service-staff", "org-1"])).toBeUndefined();
  });

  it("discards a response that arrives after sign-out", async () => {
    const client = newClient();
    const key = ["community-services", ACCOUNT_A];

    // A request A started that the server answers only after A has gone. The
    // query function ignores the abort signal, exactly like the Services
    // page's own fetch helper, so cancellation alone cannot save us.
    let deliver: (value: unknown) => void = () => {};
    const inFlight = new Promise((resolve) => {
      deliver = resolve;
    });

    const fetched = client
      .fetchQuery({ queryKey: key, queryFn: () => inFlight })
      .catch(() => undefined);

    await purgeSessionData(client);

    // B signs in and the server finally answers A's request.
    deliver({ requests: [{ id: "r1", title: "Broken streetlight" }] });
    await fetched;
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(0);

    // And a fresh query under B's key starts empty.
    expect(client.getQueryData(["community-services", ACCOUNT_B])).toBeUndefined();
  });

  it("clears pending mutations as well as queries", async () => {
    const client = newClient();
    client.getMutationCache().build(client, { mutationKey: ["submit-request"] });
    expect(client.getMutationCache().getAll().length).toBeGreaterThan(0);

    await purgeSessionData(client);

    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });
});

describe("web storage", () => {
  it("removes the account's private keys", async () => {
    for (const key of PRIVATE_LOCAL_KEYS) localStore.setItem(key, "account A value");
    for (const key of PRIVATE_SESSION_KEYS) sessionStore.setItem(key, "account A value");

    await purgeSessionData(newClient());

    for (const key of PRIVATE_LOCAL_KEYS) expect(localStore.getItem(key)).toBeNull();
    for (const key of PRIVATE_SESSION_KEYS) expect(sessionStore.getItem(key)).toBeNull();
  });

  it("keeps device preferences that do not identify anyone", async () => {
    const kept = {
      theme: "dark",
      mapTheme: "dark",
      "nabornet-install-dismissed": "1756416319548",
      "nabornet-clientInstanceId": "device-42",
    };
    for (const [key, value] of Object.entries(kept)) localStore.setItem(key, value);

    await purgeSessionData(newClient());

    for (const [key, value] of Object.entries(kept)) {
      expect(localStore.getItem(key)).toBe(value);
    }
  });

  it("names the last report's coordinates among the private keys", () => {
    // Guard against someone trimming the list: these two hold where the
    // previous account was standing when they reported something.
    expect(PRIVATE_LOCAL_KEYS).toContain("nn:last-incident");
    expect(PRIVATE_LOCAL_KEYS).toContain("nn:last-gps");
  });
});

describe("degrading instead of abandoning", () => {
  it("still empties the cache when storage throws", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: fakeStorage(true),
      configurable: true,
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const client = newClient();
    client.setQueryData(["community-services", ACCOUNT_A], { requests: [{ id: "r1" }] });

    const failed = await purgeSessionData(client);

    expect(client.getQueryData(["community-services", ACCOUNT_A])).toBeUndefined();
    expect(failed).toContain("clear private web storage");
  });

  it("does not throw when web storage is unavailable at all", async () => {
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "sessionStorage");

    await expect(purgeSessionData(newClient())).resolves.toEqual([]);
  });
});
