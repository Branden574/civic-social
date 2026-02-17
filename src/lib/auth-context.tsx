'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { validatePassword } from '@/lib/security/password';

// ─── Types ───────────────────────────────────────────────────

type UserRole = 'user' | 'moderator' | 'admin' | 'creator';

export interface OnboardingProfile {
  country: string;
  affiliation: string;
  topics: string[];
  bio: string;
  completedAt?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  username: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: Date;
  onboarding?: OnboardingProfile;
  isNewUser?: boolean;
  /** ISO timestamp when this session started (for admin audit display) */
  sessionStartedAt?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  isModerator: boolean;
  isLoading: boolean;
  isNewUser: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateOnboarding: (profile: Partial<OnboardingProfile>) => void;
  completeOnboarding: () => void;
}

// ─── Context ─────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  isCreator: false,
  isModerator: false,
  isLoading: true,
  isNewUser: false,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: () => {},
  forgotPassword: async () => ({ success: false }),
  updateOnboarding: () => {},
  completeOnboarding: () => {},
});

// ─── Secure storage helpers ──────────────────────────────────
// NOTE: In production, replace localStorage with HttpOnly session
// cookies set by the server. localStorage is used here for the
// demo; the session cookie (civic-session) is set alongside
// for API route auth validation.

const STORAGE_KEY = 'civic-auth-user';
const SESSION_COOKIE = 'civic-session';

function setSessionCookie(user: AuthUser) {
  // Set a cookie that API routes can read for auth.
  // In production this MUST be HttpOnly and set by the server.
  const sessionData = JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
  });
  const maxAge = 60 * 60 * 24; // 24 hours
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(sessionData)}; path=/; max-age=${maxAge}; SameSite=Strict${secure}`;
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Strict`;
}

function persistUser(user: AuthUser) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setSessionCookie(user);
  } catch {
    // noop — SSR / private browsing
  }
}

function readPersistedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...parsed, createdAt: new Date(parsed.createdAt) };
  } catch {
    return null;
  }
}

function clearPersistedUser() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    clearSessionCookie();
  } catch {
    // noop
  }
}

// ─── Login attempt tracking (client-side progressive delay) ──

const LOGIN_ATTEMPTS_KEY = 'civic-login-attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LoginAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil?: number;
}

function getLoginAttempts(): LoginAttemptRecord {
  try {
    const raw = sessionStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!raw) return { count: 0, firstAttemptAt: Date.now() };
    return JSON.parse(raw);
  } catch {
    return { count: 0, firstAttemptAt: Date.now() };
  }
}

function recordFailedAttempt(): LoginAttemptRecord {
  const record = getLoginAttempts();
  const now = Date.now();

  // Reset if window expired
  if (record.lockedUntil && now > record.lockedUntil) {
    const fresh = { count: 1, firstAttemptAt: now };
    sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(fresh));
    return fresh;
  }

  record.count++;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(record));
  return record;
}

function clearLoginAttempts() {
  try { sessionStorage.removeItem(LOGIN_ATTEMPTS_KEY); } catch { /* noop */ }
}

function isLockedOut(): { locked: boolean; remainingMs: number } {
  const record = getLoginAttempts();
  if (record.lockedUntil) {
    const remaining = record.lockedUntil - Date.now();
    if (remaining > 0) {
      return { locked: true, remainingMs: remaining };
    }
  }
  return { locked: false, remainingMs: 0 };
}

// ─── New user detection ──────────────────────────────────────

function checkIsNewUser(user: AuthUser): boolean {
  const createdAt = new Date(user.createdAt);
  const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceCreation <= 7;
}

// ─── Email validation ────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

// ─── Display name sanitization ───────────────────────────────

function sanitizeDisplayName(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s.\-']/gu, '')
    .trim()
    .slice(0, 50);
}

// ─── Provider ────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from storage on mount
  useEffect(() => {
    const stored = readPersistedUser();
    if (stored) {
      const hydrated = { ...stored, sessionStartedAt: stored.sessionStartedAt || new Date().toISOString() };
      setUser(hydrated);
      setSessionCookie(hydrated);
    } else {
      try {
        const session = sessionStorage.getItem(STORAGE_KEY);
        if (session) {
          const parsed = JSON.parse(session);
          const hydrated = {
            ...parsed,
            createdAt: new Date(parsed.createdAt),
            sessionStartedAt: parsed.sessionStartedAt || new Date().toISOString(),
          };
          setUser(hydrated);
          setSessionCookie(hydrated);
        }
      } catch { /* noop */ }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe = false): Promise<{ success: boolean; error?: string }> => {
    // Check lockout
    const lockout = isLockedOut();
    if (lockout.locked) {
      const mins = Math.ceil(lockout.remainingMs / 60_000);
      return { success: false, error: `Too many failed attempts. Please try again in ${mins} minute${mins !== 1 ? 's' : ''}.` };
    }

    // Validate email
    if (!email || !isValidEmail(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // Validate password (basic check for login; full policy on signup)
    if (!password || password.length < 8) {
      recordFailedAttempt();
      return { success: false, error: 'Invalid credentials.' };
    }

    // PRODUCTION TODO: Send credentials to server, verify bcrypt hash.
    // The server should return a signed session token (HttpOnly cookie).
    // NEVER return the role from client-side email matching in production.

    const mockUser: AuthUser = {
      id: `user-${Date.now()}`,
      email,
      displayName: email === 'admin@civicsocial.com' ? 'Platform Creator' : sanitizeDisplayName(email.split('@')[0]),
      username: email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, ''),
      role: email === 'admin@civicsocial.com' ? 'creator' : email.includes('admin') ? 'admin' : email.includes('mod') ? 'moderator' : 'user',
      createdAt: new Date(),
      sessionStartedAt: new Date().toISOString(),
    };

    setUser(mockUser);
    clearLoginAttempts();

    if (rememberMe) {
      persistUser(mockUser);
    } else {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser));
      } catch { /* noop */ }
      setSessionCookie(mockUser);
    }

    return { success: true };
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> => {
    // Validate email
    if (!email || !isValidEmail(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // Strong password validation
    const passwordResult = validatePassword(password, email);
    if (!passwordResult.valid) {
      return { success: false, error: passwordResult.errors[0] };
    }

    // Sanitize display name
    const safeName = sanitizeDisplayName(displayName);
    if (!safeName || safeName.length < 2) {
      return { success: false, error: 'Display name must be at least 2 characters.' };
    }

    // PRODUCTION TODO: Send to server, hash password with bcrypt/argon2,
    // send verification email, return session token.

    const newUser: AuthUser = {
      id: `user-${Date.now()}`,
      email,
      displayName: safeName,
      username: safeName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, ''),
      role: 'user', // Always 'user' on signup — never derive role from email
      createdAt: new Date(),
      isNewUser: true,
      sessionStartedAt: new Date().toISOString(),
      onboarding: {
        country: '',
        affiliation: '',
        topics: [],
        bio: '',
      },
    };
    setUser(newUser);
    persistUser(newUser);
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearPersistedUser();
    clearLoginAttempts();
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }, []);

  const forgotPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!email || !isValidEmail(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // PRODUCTION: Send reset email with single-use token (15 min expiry).
    // IMPORTANT: Always return success to prevent email enumeration.
    // The response should be identical whether the email exists or not.

    return { success: true };
  }, []);

  const updateOnboarding = useCallback((profile: Partial<OnboardingProfile>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        onboarding: { ...prev.onboarding, ...profile } as OnboardingProfile,
      };
      persistUser(updated);
      return updated;
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        isNewUser: true,
        onboarding: {
          ...prev.onboarding,
          completedAt: new Date().toISOString(),
        } as OnboardingProfile,
      };
      persistUser(updated);
      return updated;
    });
  }, []);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.role === 'creator';
  const isCreator = user?.role === 'creator';
  const isModerator = user?.role === 'moderator' || isAdmin;
  const isNewUser = user ? checkIsNewUser(user) : false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        isCreator,
        isModerator,
        isLoading,
        isNewUser,
        login,
        signup,
        logout,
        forgotPassword,
        updateOnboarding,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}
