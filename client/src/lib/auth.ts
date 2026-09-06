import type { SignupData, LoginData, AnonJoinData } from "@shared/schema";
import { clearCachesOnLogout } from "./serviceWorker";
import { purgeSessionData } from "./sessionTeardown";

export interface AuthUser {
  id: string;
  username: string;
  roles: string[];
  country: string;
  city: string;
  neighbourhood?: string;
  emailVerified?: boolean;
  accessStatus?: string;
  oauthProvider?: string | null;
}

export async function resendVerificationEmail(): Promise<{ ok: boolean; message: string }> {
  const response = await fetch('/api/auth/resend-verification', {
    method: 'POST',
    credentials: 'include',
  });
  
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Failed to resend verification email');
  }
  
  return result;
}

export interface SignupResult {
  user: AuthUser;
  /**
   * Whether the verification email actually went out. The server reports this
   * because the signup screen used to tell everyone to check their inbox even
   * when delivery was unconfigured or the provider had rejected the message.
   */
  emailDelivery: 'sent' | 'not_sent';
}

export async function signupWithEmail(data: SignupData): Promise<SignupResult> {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Signup failed');
  }

  const result = await response.json();
  return {
    user: result.user,
    // Absent means an older server that did not report it. Claiming delivery
    // we cannot confirm is the failure mode being fixed, so default to the
    // cautious answer.
    emailDelivery: result.emailDelivery === 'sent' ? 'sent' : 'not_sent',
  };
}

export async function loginWithEmail(data: LoginData): Promise<AuthUser> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    let error;
    try {
      error = await response.json();
    } catch {
      error = { error: 'Network error - please check your connection' };
    }
    throw new Error(error.error || 'Login failed');
  }
  
  const result = await response.json();
  return result.user;
}

export async function joinCommunity(data: AnonJoinData): Promise<AuthUser> {
  const response = await fetch('/api/auth/anon-join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Anonymous join failed');
  }
  
  const result = await response.json();
  return result.user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });
    if (!response.ok) {
      return null;
    }
    const result = await response.json();
    return result.user;
  } catch {
    return null;
  }
}

/**
 * End the session on this device and on the server.
 *
 * Ordering matters, and it is not the order this function used to use:
 *
 *  1. Cancel anything in flight and drop the cached data, so a response that
 *     arrives after sign-out cannot be read by the next account on a shared
 *     device (see ./sessionTeardown).
 *  2. Invalidate the server session. This used to sit behind
 *     `await clearCachesOnLogout()`, which touches IndexedDB and
 *     `navigator.serviceWorker` — both of which can throw, and on a page not
 *     served over a secure origin `navigator.serviceWorker` is `undefined`.
 *     A local cleanup failure therefore left the session cookie valid. It is
 *     now guarded and runs afterwards, so it can no longer prevent this.
 *  3. Clear the offline database and service-worker caches, best effort.
 *
 * Callers must still clear the auth store; every sign-out control in the app
 * does `await logout()` then the store's `logout()`.
 */
export async function logout(): Promise<void> {
  const failed = await purgeSessionData();

  let serverSessionEnded = false;
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    serverSessionEnded = response.ok;
  } catch (error) {
    console.error('[auth] Could not reach the server to end the session', error);
  }
  if (!serverSessionEnded) {
    failed.push('invalidate the server session');
  }

  try {
    await clearCachesOnLogout();
  } catch (error) {
    failed.push('clear offline data and caches');
    console.warn('[auth] Offline data or cache cleanup failed during sign-out', error);
  }

  if (failed.length > 0) {
    console.warn(`[auth] Sign-out completed with failures: ${failed.join(', ')}`);
  }
}

// Legacy compatibility functions for existing code
export const signInWithEmail = async (email: string, password: string) => {
  return loginWithEmail({ email, password });
};

export const signUpWithEmail = async (email: string, password: string, userData?: any) => {
  throw new Error('Use signupWithEmail instead');
};

export const onAuthChange = (callback: (user: any | null) => void) => {
  // For session-based auth, we check on app load
  getCurrentUser().then(callback);
  return () => {};
};

export const sendMagicLink = async (email: string) => {
  // For demo - just save email and allow immediate sign in
  window.localStorage.setItem('emailForSignIn', email);
};

export const completeMagicLinkSignIn = async () => {
  const email = window.localStorage.getItem('emailForSignIn');
  if (email) {
    window.localStorage.removeItem('emailForSignIn');
    return loginWithEmail({ email, password: 'magic-link' });
  }
  return null;
};