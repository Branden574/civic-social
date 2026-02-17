'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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

// ─── Bootstrap data (from /api/me) ──────────────────────────

export interface BootstrapData {
  onboarding: {
    isDone: boolean;
    stepCompleted: string;
    completedAt: string | null;
  };
  profileCompletion: {
    isComplete: boolean;
    percent: number;
    missingFields: string[];
  };
  stats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  isModerator: boolean;
  isLoading: boolean;
  /** True if account is < 7 days old (for cold-start feed algorithm) */
  isNewUser: boolean;
  /** True once server confirms onboarding is done (carousel dismissed / register completed) */
  onboardingDone: boolean;
  /** Server-authoritative profile completion state */
  profileCompletion: BootstrapData['profileCompletion'] | null;
  /** Server-authoritative stats (followers, following, posts) */
  stats: BootstrapData['stats'] | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateOnboarding: (profile: Partial<OnboardingProfile>) => void;
  completeOnboarding: () => Promise<void>;
  /** Re-fetch /api/me to get fresh stats/profile/onboarding state */
  refreshMe: () => Promise<void>;
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
  onboardingDone: false,
  profileCompletion: null,
  stats: null,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: () => {},
  forgotPassword: async () => ({ success: false }),
  updateOnboarding: () => {},
  completeOnboarding: async () => {},
  refreshMe: async () => {},
});

// ─── Secure storage helpers ──────────────────────────────────

const STORAGE_KEY = 'civic-auth-user';
const SESSION_COOKIE = 'civic-session';

function setSessionCookie(user: AuthUser) {
  const sessionData = JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
  });
  const maxAge = 60 * 60 * 24;
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
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

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

// ─── Age-based new user check (for cold-start feed) ─────────

function checkIsNewUserByAge(user: AuthUser): boolean {
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

// ─── Server bootstrap fetch ─────────────────────────────────

async function fetchBootstrap(user: AuthUser): Promise<BootstrapData | null> {
  try {
    const res = await fetch('/api/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        onboarding: user.onboarding
          ? {
              completedAt: user.onboarding.completedAt || null,
              country: user.onboarding.country,
              affiliation: user.onboarding.affiliation,
              topics: user.onboarding.topics,
              bio: user.onboarding.bio,
            }
          : undefined,
        profile: {
          displayName: user.displayName,
          username: user.username,
          country: user.onboarding?.country,
          affiliation: user.onboarding?.affiliation,
          topics: user.onboarding?.topics,
          bio: user.onboarding?.bio,
        },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      onboarding: data.onboarding,
      profileCompletion: data.profileCompletion,
      stats: data.stats,
    };
  } catch {
    return null;
  }
}

// Fallback bootstrap from client-only data (no server available)
function clientFallbackBootstrap(user: AuthUser): BootstrapData {
  const hasDoneOnboarding = !!user.onboarding?.completedAt;
  return {
    onboarding: {
      isDone: hasDoneOnboarding,
      stepCompleted: hasDoneOnboarding ? 'done' : '',
      completedAt: user.onboarding?.completedAt || null,
    },
    profileCompletion: {
      isComplete: false,
      percent: 0,
      missingFields: [],
    },
    stats: { followersCount: 0, followingCount: 0, postsCount: 0 },
  };
}

// ─── Provider ────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const bootstrapInFlight = useRef(false);

  // Hydrate from storage on mount, then fetch server bootstrap
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // Step 1: Read localStorage for instant user state
      let hydratedUser: AuthUser | null = null;

      const stored = readPersistedUser();
      if (stored) {
        hydratedUser = {
          ...stored,
          sessionStartedAt: stored.sessionStartedAt || new Date().toISOString(),
        };
      } else {
        try {
          const session = sessionStorage.getItem(STORAGE_KEY);
          if (session) {
            const parsed = JSON.parse(session);
            hydratedUser = {
              ...parsed,
              createdAt: new Date(parsed.createdAt),
              sessionStartedAt: parsed.sessionStartedAt || new Date().toISOString(),
            };
          }
        } catch { /* noop */ }
      }

      if (hydratedUser) {
        if (!cancelled) setUser(hydratedUser);
        setSessionCookie(hydratedUser);

        // Step 2: Fetch server bootstrap for authoritative state
        bootstrapInFlight.current = true;
        const serverData = await fetchBootstrap(hydratedUser);
        bootstrapInFlight.current = false;

        if (!cancelled) {
          if (serverData) {
            setBootstrap(serverData);
          } else {
            // Server unreachable — use client-only fallback
            setBootstrap(clientFallbackBootstrap(hydratedUser));
          }
        }
      }

      if (!cancelled) setIsLoading(false);
    }

    hydrate();
    return () => { cancelled = true; };
  }, []);

  // refreshMe: re-fetch /api/me for latest stats/profile/onboarding
  const refreshMe = useCallback(async () => {
    const currentUser = user;
    if (!currentUser) return;
    if (bootstrapInFlight.current) return;

    bootstrapInFlight.current = true;
    try {
      // Re-register user on server (handles Vercel cold starts wiping in-memory store)
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentUser.id,
          displayName: currentUser.displayName,
          username: currentUser.username || currentUser.displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, ''),
          email: currentUser.email,
        }),
      }).catch(() => {});

      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setBootstrap({
          onboarding: data.onboarding,
          profileCompletion: data.profileCompletion,
          stats: data.stats,
        });
      }
    } catch {
      // Silently fail — keep existing bootstrap
    } finally {
      bootstrapInFlight.current = false;
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string, rememberMe = false): Promise<{ success: boolean; error?: string }> => {
    const lockout = isLockedOut();
    if (lockout.locked) {
      const mins = Math.ceil(lockout.remainingMs / 60_000);
      return { success: false, error: `Too many failed attempts. Please try again in ${mins} minute${mins !== 1 ? 's' : ''}.` };
    }

    if (!email || !isValidEmail(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (!password || password.length < 8) {
      recordFailedAttempt();
      return { success: false, error: 'Invalid credentials.' };
    }

    // Login = existing user → onboarding is already done
    const mockUser: AuthUser = {
      id: `user-${Date.now()}`,
      email,
      displayName: email === 'admin@civicsocial.com' ? 'Platform Creator' : sanitizeDisplayName(email.split('@')[0]),
      username: email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, ''),
      role: email === 'admin@civicsocial.com' ? 'creator' : email.includes('admin') ? 'admin' : email.includes('mod') ? 'moderator' : 'user',
      createdAt: new Date(),
      isNewUser: false,
      sessionStartedAt: new Date().toISOString(),
      onboarding: {
        country: '',
        affiliation: '',
        topics: [],
        bio: '',
        completedAt: new Date().toISOString(),
      },
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

    // Fetch server bootstrap for the new session
    const serverData = await fetchBootstrap(mockUser);
    if (serverData) {
      setBootstrap(serverData);
    } else {
      setBootstrap(clientFallbackBootstrap(mockUser));
    }

    return { success: true };
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> => {
    if (!email || !isValidEmail(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    const passwordResult = validatePassword(password, email);
    if (!passwordResult.valid) {
      return { success: false, error: passwordResult.errors[0] };
    }

    const safeName = sanitizeDisplayName(displayName);
    if (!safeName || safeName.length < 2) {
      return { success: false, error: 'Display name must be at least 2 characters.' };
    }

    // Signup = new user → onboarding NOT done yet
    const newUser: AuthUser = {
      id: `user-${Date.now()}`,
      email,
      displayName: safeName,
      username: safeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, ''),
      role: 'user',
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

    // Register user on the server so they are immediately searchable
    try {
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newUser.id,
          displayName: newUser.displayName,
          username: newUser.username,
          email: newUser.email,
        }),
      });
    } catch {
      // Non-blocking — server registration will happen on next API call
    }

    // Set initial bootstrap — brand new user, nothing completed
    setBootstrap({
      onboarding: { isDone: false, stepCompleted: '', completedAt: null },
      profileCompletion: {
        isComplete: false,
        percent: 0,
        missingFields: ['display_name', 'username', 'country', 'party', 'topics'],
      },
      stats: { followersCount: 0, followingCount: 0, postsCount: 0 },
    });

    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setBootstrap(null);
    clearPersistedUser();
    clearLoginAttempts();
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }, []);

  const forgotPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!email || !isValidEmail(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
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

  const completeOnboarding = useCallback(async () => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        isNewUser: false,
        onboarding: {
          ...prev.onboarding,
          completedAt: new Date().toISOString(),
        } as OnboardingProfile,
      };
      persistUser(updated);
      return updated;
    });

    // Optimistically mark as done in bootstrap
    setBootstrap((prev) =>
      prev
        ? {
            ...prev,
            onboarding: {
              isDone: true,
              stepCompleted: 'done',
              completedAt: new Date().toISOString(),
            },
          }
        : prev,
    );

    // Tell the server
    try {
      const currentUser = user;
      const res = await fetch('/api/me/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: currentUser?.onboarding?.country,
          affiliation: currentUser?.onboarding?.affiliation,
          topics: currentUser?.onboarding?.topics,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBootstrap((prev) =>
          prev
            ? {
                ...prev,
                onboarding: data.onboarding,
                profileCompletion: data.profileCompletion,
                stats: data.stats,
              }
            : prev,
        );
      }
    } catch {
      // Server call failed — optimistic update still holds
    }
  }, [user]);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.role === 'creator';
  const isCreator = user?.role === 'creator';
  const isModerator = user?.role === 'moderator' || isAdmin;
  const isNewUser = user ? checkIsNewUserByAge(user) : false;
  const onboardingDone = bootstrap?.onboarding?.isDone ?? !!user?.onboarding?.completedAt;

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
        onboardingDone,
        profileCompletion: bootstrap?.profileCompletion ?? null,
        stats: bootstrap?.stats ?? null,
        login,
        signup,
        logout,
        forgotPassword,
        updateOnboarding,
        completeOnboarding,
        refreshMe,
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
