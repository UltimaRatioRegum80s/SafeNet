/**
 * Session teardown — what must be forgotten when someone signs out.
 *
 * NaborNet is used on shared and household devices. Community Services holds
 * a resident's service requests, the timeline notes a service wrote back, and
 * (for an owner) staff names and email addresses; the incident features hold
 * the coordinates of the last thing this account reported. None of that may
 * survive into the next person's session on the same browser.
 *
 * Two rules shape this module:
 *
 *  1. Every step is independently guarded. A failure in one must not skip the
 *     others, and — critically — must not stop the caller invalidating the
 *     server session. `logout()` in ./auth.ts relies on that.
 *  2. Requests in flight are cancelled *before* the cache is dropped, so a
 *     response that arrives after sign-out cannot be written back into the
 *     cache the next account will read.
 *
 * Device preferences (theme, map theme, install-prompt dismissal, the offline
 * client instance id) are deliberately left alone: they describe the browser,
 * not the person.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryClient as appQueryClient } from "./queryClient";

/** localStorage keys that describe the signed-in person rather than the device. */
export const PRIVATE_LOCAL_KEYS = [
  "nn:last-incident", // coordinates and time of this account's last report
  "nn:last-gps", // last device position captured for this account
  "nn:lastIncidentSubmitAt", // report cool-down, per account
  "emailForSignIn", // legacy magic-link address
  "pushSubscribed", // the push subscription belongs to the account
  "pushTypes",
] as const;

/** sessionStorage keys holding this account's unsent or optimistic work. */
export const PRIVATE_SESSION_KEYS = ["nn:optimistic-incidents"] as const;

type Step = { name: string; run: () => void | Promise<void> };

/**
 * Run every step, keep going after a failure, and report which ones failed.
 * Nothing here throws: teardown is best-effort by design, and the caller must
 * still be able to end the server session.
 */
async function runGuarded(steps: Step[]): Promise<string[]> {
  const failed: string[] = [];
  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      failed.push(step.name);
      console.warn(`[session] sign-out step failed: ${step.name}`, error);
    }
  }
  return failed;
}

/**
 * Attempt every key even if one throws, and report how many could not be
 * removed. A storage that rejects writes (private mode, blocked site data)
 * must not stop the remaining keys being tried, but it must still be visible
 * rather than silently swallowed.
 */
function forget(storage: Storage | undefined, keys: readonly string[]): number {
  if (!storage) return 0;
  let failures = 0;
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      failures += 1;
    }
  }
  return failures;
}

function webStorage(kind: "localStorage" | "sessionStorage"): Storage | undefined {
  try {
    return (globalThis as { localStorage?: Storage; sessionStorage?: Storage })[kind];
  } catch {
    // Accessing storage throws outright when the browser blocks site data.
    return undefined;
  }
}

/**
 * Remove the web-storage entries that belong to the signed-in account.
 * Throws only after every key has been attempted, so the caller can report
 * that some of the previous account's data may still be on the device.
 */
export function clearPrivateWebStorage(): void {
  const failures =
    forget(webStorage("localStorage"), PRIVATE_LOCAL_KEYS) +
    forget(webStorage("sessionStorage"), PRIVATE_SESSION_KEYS);
  if (failures > 0) {
    throw new Error(`${failures} private storage key(s) could not be removed`);
  }
}

/**
 * Drop everything the signed-in account left in memory and in web storage.
 * Returns the names of any steps that failed, for logging by the caller.
 */
export async function purgeSessionData(
  client: QueryClient = appQueryClient,
): Promise<string[]> {
  return runGuarded([
    {
      // First, so nothing is still resolving when the cache is emptied. A
      // request that outlives this call resolves into a query that is no
      // longer in the cache, and is therefore discarded rather than served
      // to whoever signs in next.
      name: "cancel in-flight requests",
      run: () => client.cancelQueries(),
    },
    {
      name: "clear cached queries",
      run: () => {
        client.clear();
        client.getMutationCache().clear();
      },
    },
    {
      name: "clear private web storage",
      run: clearPrivateWebStorage,
    },
  ]);
}
