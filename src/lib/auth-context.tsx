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
  avatar?: string | null;
  bannerUrl?: string | null;
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
    credibilityScore: number;
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
// NOTE: The session cookie (civic-session) is HttpOnly and managed
// server-side by /api/auth/login, /api/auth/signup, and /api/auth/logout.
// Client-side JS cannot read or set it — preventing XSS theft and
// role-forgery. localStorage is used only for client UI state hydration
// (display name, onboarding, etc.) and does NOT control server trust.

const STORAGE_KEY = 'civic-auth-user';

function persistUser(user: AuthUser) {
  try {
    // Exclude email from localStorage — it's PII that doesn't need client persistence.
    // The email is fetched from the server session on page load via /api/me.
    const { email: _email, ...safeUser } = user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser));
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
    stats: { followersCount: 0, followingCount: 0, postsCount: 0, credibilityScore: 50 },
  };
}

// ─── Provider ────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const bootstrapInFlight = useRef(false);

  // Hydrate from storage on mount, then fetch server bootstrap.
  // If no local storage data, try /api/me to recover session from HttpOnly cookie.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // Step 1: Read localStorage / sessionStorage for instant user state
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
        if (!cancelled) {
          setUser(hydratedUser);
          // Show content immediately — don't block on network.
          // This prevents the splash screen from lingering.
          setIsLoading(false);
        }

        // Step 2: Fetch server bootstrap for authoritative state IN THE BACKGROUND
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

        return; // isLoading already set above
      } else {
        // No local data — show content immediately (don't block on network).
        // This prevents the splash screen from lingering for logged-out visitors.
        if (!cancelled) setIsLoading(false);

        // Step 2b: Try recovering session from HttpOnly cookie IN THE BACKGROUND.
        // Skip if user just logged out (avoids unnecessary 401 roundtrip).
        let justLoggedOut = false;
        try {
          if (sessionStorage.getItem('civic-just-logged-out')) {
            justLoggedOut = true;
            sessionStorage.removeItem('civic-just-logged-out');
          }
        } catch { /* noop */ }

        if (!justLoggedOut) try {
          const res = await fetch('/api/me');
          if (res.ok) {
            const data = await res.json();
            if (data.user && !cancelled) {
              const recoveredUser: AuthUser = {
                id: data.user.id,
                email: data.user.email,
                displayName: data.user.displayName,
                username: data.user.username || data.user.displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, ''),
                role: data.user.role ?? 'user',
                avatarUrl: data.user.avatar || undefined,
                avatar: data.user.avatar || null,
                createdAt: new Date(),
                sessionStartedAt: new Date().toISOString(),
                onboarding: {
                  country: data.profile?.country || '',
                  affiliation: data.profile?.affiliation || '',
                  topics: data.profile?.topics || [],
                  bio: data.user.bio || '',
                  completedAt: data.onboarding?.isDone ? new Date().toISOString() : undefined,
                },
              };
              setUser(recoveredUser);
              persistUser(recoveredUser);
              setBootstrap({
                onboarding: data.onboarding,
                profileCompletion: data.profileCompletion,
                stats: data.stats,
              });
            }
          }
        } catch { /* Server unreachable — stay logged out */ }

        return; // isLoading already set above
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
        // Update avatar/banner/bio on the user object if returned
        if (data.user) {
          setUser((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              avatar: data.user.avatar ?? prev.avatar,
              avatarUrl: data.user.avatar ?? prev.avatarUrl ?? prev.avatar,
              bannerUrl: data.user.bannerUrl ?? prev.bannerUrl,
            };
            // Sync bio + profile data into onboarding so profile page picks it up
            if (updated.onboarding) {
              updated.onboarding = {
                ...updated.onboarding,
                ...(data.user.bio !== undefined && { bio: data.user.bio || '' }),
                ...(data.profile?.topics?.length && { topics: data.profile.topics }),
                ...(data.profile?.country && { country: data.profile.country }),
                ...(data.profile?.affiliation && { affiliation: data.profile.affiliation }),
              };
            }
            persistUser(updated);
            return updated;
          });
        }
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

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        recordFailedAttempt();
        return { success: false, error: data.error || 'Invalid credentials.' };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        username: data.user.username,
        role: data.user.role ?? 'user',
        avatarUrl: data.user.avatarUrl || undefined,
        createdAt: new Date(data.user.createdAt),
        isNewUser: false,
        sessionStartedAt: new Date().toISOString(),
        onboarding: {
          country: '',
          affiliation: '',
          topics: [],
          bio: '',
          // Use server's actual onboarding state — never hardcode
          completedAt: data.user.onboardingCompletedAt || new Date().toISOString(),
        },
      };

      setUser(authUser);
      clearLoginAttempts();

      // Server already set the HttpOnly session cookie during login.
      // Client-side: persist UI state based on rememberMe preference.
      if (rememberMe) {
        persistUser(authUser);
      } else {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
        } catch { /* noop */ }
      }

      const serverData = await fetchBootstrap(authUser);
      if (serverData) {
        setBootstrap(serverData);
      } else {
        setBootstrap(clientFallbackBootstrap(authUser));
      }

      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
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

    try {
      // Server generates a stable ID and hashes the password
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName: safeName }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create account.' };
      }

      // Server returns a success-shaped response WITHOUT a user when the
      // email may already be registered (prevents account enumeration).
      // Surface the generic message instead of logging in.
      if (!data.user) {
        return {
          success: false,
          error: data.message || 'Unable to complete signup. If you already have an account, try logging in.',
        };
      }

      const newUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName,
        username: data.user.username,
        role: 'user',
        createdAt: new Date(data.user.createdAt),
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

      setBootstrap({
        onboarding: { isDone: false, stepCompleted: '', completedAt: null },
        profileCompletion: {
          isComplete: false,
          percent: 0,
          missingFields: ['display_name', 'username', 'country', 'party', 'topics'],
        },
        stats: { followersCount: 0, followingCount: 0, postsCount: 0, credibilityScore: 50 },
      });

      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setBootstrap(null);
    clearPersistedUser();
    clearLoginAttempts();
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    try { localStorage.removeItem('profile_card_dismissed'); } catch { /* noop */ }
    // Set a flag so the next page load skips the /api/me recovery attempt
    // (avoids a ~2s network roundtrip that causes the "flash" on logout)
    try { sessionStorage.setItem('civic-just-logged-out', '1'); } catch { /* noop */ }
    // Clear the HttpOnly session cookie BEFORE redirecting — otherwise the
    // page reload recovers the session from the still-valid cookie.
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { /* noop — redirect anyway */ }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, []);

  const forgotPassword = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!email || !isValidEmail(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: false, error: data.error || 'Something went wrong. Please try again.' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
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
  // Onboarding is done if:
  // 1. Server (bootstrap) confirmed it, OR
  // 2. Client localStorage has completedAt, OR
  // 3. Bootstrap hasn't loaded yet but user exists — assume done to prevent carousel flicker
  const onboardingDone = bootstrap
    ? (bootstrap.onboarding?.isDone || !!user?.onboarding?.completedAt)
    : (!!user?.onboarding?.completedAt || !!user); // while loading, assume done if user exists

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
