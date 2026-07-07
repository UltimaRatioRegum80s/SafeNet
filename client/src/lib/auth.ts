import type { SignupData, LoginData, AnonJoinData } from "@shared/schema";
import { clearCachesOnLogout } from "./serviceWorker";

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

export async function signupWithEmail(data: SignupData): Promise<AuthUser> {
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
  return result.user;
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

export async function logout(): Promise<void> {
  await clearCachesOnLogout();
  await fetch('/api/auth/logout', { 
    method: 'POST',
    credentials: 'include',
  });
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