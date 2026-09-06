/**
 * `logout()` — the order of operations, and what must survive a failure.
 *
 * The defect this pins down: local cleanup used to run first and unguarded.
 * `clearCachesOnLogout()` touches IndexedDB and `navigator.serviceWorker`,
 * and on a page that is not on a secure origin `navigator.serviceWorker` is
 * `undefined` — so a TypeError there meant `/api/auth/logout` was never
 * called and the session cookie stayed valid. On a shared device the next
 * person could reload straight back into the previous account.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clearCachesOnLogout = vi.fn(async () => {});

vi.mock("../client/src/lib/serviceWorker", () => ({
  clearCachesOnLogout: (...args: unknown[]) => clearCachesOnLogout(...(args as [])),
}));

const { logout } = await import("../client/src/lib/auth");
const { queryClient } = await import("../client/src/lib/queryClient");

let calls: string[];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  calls = [];
  clearCachesOnLogout.mockReset();
  clearCachesOnLogout.mockImplementation(async () => {
    calls.push("clear-caches");
  });

  fetchMock = vi.fn(async (url: string) => {
    calls.push(`fetch:${url}`);
    return { ok: true, status: 200 } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  queryClient.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("logout", () => {
  it("drops cached data before it touches the network", async () => {
    queryClient.setQueryData(["community-services", "account-a"], {
      requests: [{ id: "r1", title: "Broken streetlight", location: "12 Oak Street" }],
    });

    await logout();

    expect(queryClient.getQueryData(["community-services", "account-a"])).toBeUndefined();
    expect(calls[0]).toBe("fetch:/api/auth/logout");
  });

  it("ends the server session even when cache cleanup throws", async () => {
    // What a non-secure origin actually does: navigator.serviceWorker is
    // undefined, so reading .controller throws.
    clearCachesOnLogout.mockImplementation(async () => {
      throw new TypeError("Cannot read properties of undefined (reading 'controller')");
    });

    await expect(logout()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("clears offline data and caches after the session ends", async () => {
    await logout();

    expect(calls).toEqual(["fetch:/api/auth/logout", "clear-caches"]);
  });

  it("does not throw when the server is unreachable", async () => {
    fetchMock.mockImplementation(async () => {
      throw new Error("Failed to fetch");
    });
    queryClient.setQueryData(["community-services", "account-a"], { requests: [] });

    await expect(logout()).resolves.toBeUndefined();

    // The local data still goes, so nothing of the previous account is left
    // readable even when the session could not be invalidated remotely.
    expect(queryClient.getQueryData(["community-services", "account-a"])).toBeUndefined();
    expect(clearCachesOnLogout).toHaveBeenCalled();
  });
});
