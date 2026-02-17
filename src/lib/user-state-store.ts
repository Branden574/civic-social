// ═══════════════════════════════════════════════════════════════
// Civic Social — Server-Side Per-User State Store
// ═══════════════════════════════════════════════════════════════
//
// Tracks onboarding completion and profile data per user.
// Uses Symbol.for on global to persist across HMR in dev.
//
// In production: Replace with Prisma/DB operations.
// ═══════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────

export interface OnboardingState {
  isDone: boolean;
  stepCompleted: string;
  completedAt: string | null;
}

export interface UserProfile {
  displayName: string;
  username: string;
  email: string;
  countryCode: string;
  partyAffiliation: string;
  topics: string[];
  bio: string;
  avatarUrl: string | null;
}

export interface UserState {
  userId: string;
  onboarding: OnboardingState;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileCompletion {
  isComplete: boolean;
  percent: number;
  missingFields: string[];
}

// ─── Store ───────────────────────────────────────────────────

interface UserStateStore {
  users: Map<string, UserState>;
}

const STORE_KEY = Symbol.for('civic.user.state.store');

interface GlobalWithStore {
  [key: symbol]: UserStateStore | undefined;
}

function getStore(): UserStateStore {
  const g = global as unknown as GlobalWithStore;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { users: new Map() };
  }
  return g[STORE_KEY]!;
}

// ─── Default factories ───────────────────────────────────────

function defaultOnboarding(): OnboardingState {
  return { isDone: false, stepCompleted: '', completedAt: null };
}

function defaultProfile(email = ''): UserProfile {
  return {
    displayName: '',
    username: '',
    email,
    countryCode: '',
    partyAffiliation: '',
    topics: [],
    bio: '',
    avatarUrl: null,
  };
}

// ═══════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════

export function getUserState(userId: string): UserState | null {
  return getStore().users.get(userId) ?? null;
}

export function upsertUserState(
  userId: string,
  data: {
    onboarding?: Partial<OnboardingState>;
    profile?: Partial<UserProfile>;
    createdAt?: string;
  },
): UserState {
  const store = getStore();
  const existing = store.users.get(userId);
  const now = new Date().toISOString();

  if (existing) {
    if (data.onboarding) {
      existing.onboarding = { ...existing.onboarding, ...data.onboarding };
    }
    if (data.profile) {
      existing.profile = { ...existing.profile, ...data.profile };
    }
    existing.updatedAt = now;
    return existing;
  }

  const newState: UserState = {
    userId,
    onboarding: { ...defaultOnboarding(), ...(data.onboarding ?? {}) },
    profile: { ...defaultProfile(), ...(data.profile ?? {}) },
    createdAt: data.createdAt ?? now,
    updatedAt: now,
  };
  store.users.set(userId, newState);
  return newState;
}

// ─── Onboarding ──────────────────────────────────────────────

export function markOnboardingComplete(userId: string): UserState {
  return upsertUserState(userId, {
    onboarding: {
      isDone: true,
      stepCompleted: 'done',
      completedAt: new Date().toISOString(),
    },
  });
}

// ─── Profile ─────────────────────────────────────────────────

export function updateUserProfile(
  userId: string,
  profile: Partial<UserProfile>,
): UserState {
  return upsertUserState(userId, { profile });
}

// ─── Profile Completion ──────────────────────────────────────

export function computeProfileCompletion(state: UserState): ProfileCompletion {
  const missing: string[] = [];

  if (!state.profile.displayName) missing.push('display_name');
  if (!state.profile.username) missing.push('username');
  if (!state.profile.countryCode) missing.push('country');
  if (!state.profile.partyAffiliation) missing.push('party');
  if (!state.profile.topics || state.profile.topics.length < 3) missing.push('topics');

  const totalRequired = 5;
  const completed = totalRequired - missing.length;
  const percent = Math.round((completed / totalRequired) * 100);

  return {
    isComplete: missing.length === 0,
    percent,
    missingFields: missing,
  };
}
