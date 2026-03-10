// ═══════════════════════════════════════════════════════════════
// GET  /api/me  — Bootstrap endpoint (single source of truth)
// POST /api/me  — Sync client state → server, return authoritative
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { readLimiter, socialLimiter } from '@/lib/security/rate-limiter';
import {
  getUserState,
  upsertUserState,
  markOnboardingComplete,
  computeProfileCompletion,
  type OnboardingState,
  type ProfileCompletion,
} from '@/lib/user-state-store';
import { dbGetFollowerCount, dbGetFollowingCount } from '@/lib/social-store';
import { getPostCount } from '@/lib/post-data-store';
import { registerUser, ensureUserRecord } from '@/lib/user-registry';
import { isDbAvailable, prisma } from '@/lib/db';
import { recomputeCredibilityScore } from '@/lib/credibility-recompute';

async function getCredibilityScore(userId: string): Promise<number> {
  if (!isDbAvailable()) return 50;
  try {
    // Recompute score on each /api/me call (returns cached 50 for new users)
    const result = await recomputeCredibilityScore(userId);
    if (result) return result.overall;

    // Fallback: read stored score
    const row = await prisma.searchableUser.findFirst({
      where: { id: userId },
      select: { credibilityScore: true },
    });
    return row?.credibilityScore ?? 50;
  } catch {
    return 50;
  }
}

// ─── Response shape ──────────────────────────────────────────

interface MeResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    username: string;
    role: string;
    avatar: string | null;
    bannerUrl: string | null;
    bio: string | null;
  };
  onboarding: OnboardingState;
  profile: {
    topics: string[];
    country: string;
    affiliation: string;
  };
  profileCompletion: ProfileCompletion;
  stats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
    credibilityScore: number;
  };
}

async function buildResponse(
  sessionUser: { id: string; email: string; displayName: string; role: string },
  onboarding: OnboardingState,
  profileCompletion: ProfileCompletion,
  profileData?: { topics?: string[]; countryCode?: string; partyAffiliation?: string },
): Promise<MeResponse> {
  // Look up username, avatar, banner from DB
  let username = sessionUser.displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');
  let avatar: string | null = null;
  let bannerUrl: string | null = null;
  let bio: string | null = null;
  if (isDbAvailable()) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { username: true, avatar: true, bannerUrl: true, bio: true },
      });
      if (dbUser?.username) username = dbUser.username;
      if (dbUser?.avatar) avatar = dbUser.avatar;
      if (dbUser?.bannerUrl) bannerUrl = dbUser.bannerUrl;
      if (dbUser?.bio) bio = dbUser.bio;
    } catch { /* fallback to derived username */ }
  }

  return {
    user: {
      id: sessionUser.id,
      email: sessionUser.email,
      displayName: sessionUser.displayName,
      username,
      role: sessionUser.role,
      avatar,
      bannerUrl,
      bio,
    },
    onboarding,
    profile: {
      topics: profileData?.topics || [],
      country: profileData?.countryCode || '',
      affiliation: profileData?.partyAffiliation || '',
    },
    profileCompletion,
    stats: {
      followersCount: await dbGetFollowerCount(sessionUser.id),
      followingCount: await dbGetFollowingCount(sessionUser.id),
      postsCount: await getPostCount(sessionUser.id),
      credibilityScore: await getCredibilityScore(sessionUser.id),
    },
  };
}

// ─── GET /api/me ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const sessionUser = getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const derivedUsername = sessionUser.displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');

  // Auto-register in both user tables
  await registerUser({
    id: sessionUser.id,
    displayName: sessionUser.displayName,
    username: derivedUsername,
    email: sessionUser.email,
  });
  await ensureUserRecord({
    id: sessionUser.id,
    email: sessionUser.email,
    username: derivedUsername,
    displayName: sessionUser.displayName,
  });

  let state = getUserState(sessionUser.id);
  if (!state) {
    // Cold start — check DB for persisted onboarding state and profile data
    let dbOnboardingDone = false;
    let dbOnboardingCompletedAt: string | null = null;
    let dbDisplayName = sessionUser.displayName || '';
    let dbUsername = '';
    let dbBio = '';
    if (isDbAvailable()) {
      try {
        const dbUser = await prisma.searchableUser.findFirst({
          where: { id: sessionUser.id },
          select: { onboardingCompletedAt: true, displayName: true, username: true, bio: true },
        });
        if (dbUser?.onboardingCompletedAt) {
          dbOnboardingDone = true;
          dbOnboardingCompletedAt = dbUser.onboardingCompletedAt.toISOString();
        }
        if (dbUser?.displayName) dbDisplayName = dbUser.displayName;
        if (dbUser?.username) dbUsername = dbUser.username;
        if (dbUser?.bio) dbBio = dbUser.bio;
      } catch { /* DB read failed — use defaults */ }

      // Fallback: bio may exist in User table but not SearchableUser
      if (!dbBio) {
        try {
          const userRow = await prisma.user.findUnique({
            where: { id: sessionUser.id },
            select: { bio: true },
          });
          if (userRow?.bio) dbBio = userRow.bio;
        } catch { /* fallback failed */ }
      }
    }

    // Seed in-memory store from DB data so subsequent requests are fast
    state = upsertUserState(sessionUser.id, {
      onboarding: {
        isDone: dbOnboardingDone,
        stepCompleted: dbOnboardingDone ? 'done' : '',
        completedAt: dbOnboardingCompletedAt,
      },
      profile: {
        displayName: dbDisplayName,
        username: dbUsername,
        email: sessionUser.email,
        bio: dbBio,
      },
    });

    return NextResponse.json(
      await buildResponse(sessionUser, state.onboarding, computeProfileCompletion(state), state.profile),
    );
  }

  return NextResponse.json(
    await buildResponse(sessionUser, state.onboarding, computeProfileCompletion(state), state.profile),
  );
}

// ─── POST /api/me — Client sync ─────────────────────────────
// Client sends its localStorage-cached state so the server can
// seed or reconcile after a cold start. Server is authoritative
// for stats; client is the fallback for onboarding/profile data
// when the server store has been reset.

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const sessionUser = getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const clientOnboarding = body.onboarding as
    | { completedAt?: string; country?: string; affiliation?: string; topics?: string[]; bio?: string }
    | undefined;
  const clientProfile = body.profile as
    | { displayName?: string; username?: string; country?: string; affiliation?: string; topics?: string[]; bio?: string }
    | undefined;

  let state = getUserState(sessionUser.id);

  if (!state) {
    // Cold start — check DB for persisted onboarding before falling back to client
    let dbOnboardingDone = false;
    let dbOnboardingCompletedAt: string | null = null;
    if (isDbAvailable()) {
      try {
        const dbUser = await prisma.searchableUser.findFirst({
          where: { id: sessionUser.id },
          select: { onboardingCompletedAt: true },
        });
        if (dbUser?.onboardingCompletedAt) {
          dbOnboardingDone = true;
          dbOnboardingCompletedAt = dbUser.onboardingCompletedAt.toISOString();
        }
      } catch { /* DB read failed */ }
    }

    // Determine onboarding: DB wins, then client, then default
    const onboardingDone = dbOnboardingDone || !!clientOnboarding?.completedAt;
    const completedAt = dbOnboardingCompletedAt || clientOnboarding?.completedAt || null;

    state = upsertUserState(sessionUser.id, {
      onboarding: {
        isDone: onboardingDone,
        stepCompleted: onboardingDone ? 'done' : '',
        completedAt,
      },
      profile: {
        displayName: clientProfile?.displayName || sessionUser.displayName || '',
        username: clientProfile?.username || '',
        email: sessionUser.email,
        countryCode: clientProfile?.country || clientOnboarding?.country || '',
        partyAffiliation: clientProfile?.affiliation || clientOnboarding?.affiliation || '',
        topics: clientProfile?.topics || clientOnboarding?.topics || [],
        bio: clientProfile?.bio || clientOnboarding?.bio || '',
        avatarUrl: null,
      },
    });

    // If client said done but DB didn't have it yet, persist to DB
    if (onboardingDone && !dbOnboardingDone && isDbAvailable()) {
      prisma.searchableUser.update({
        where: { id: sessionUser.id },
        data: { onboardingCompletedAt: new Date(completedAt || Date.now()) },
      }).catch(() => {});
    }
  } else {
    // Server has state — reconcile: if client says done but server doesn't, trust client
    if (clientOnboarding?.completedAt && !state.onboarding.isDone) {
      state = markOnboardingComplete(sessionUser.id);
      // Persist to DB
      if (isDbAvailable()) {
        prisma.searchableUser.update({
          where: { id: sessionUser.id },
          data: { onboardingCompletedAt: new Date(clientOnboarding.completedAt) },
        }).catch(() => {});
      }
    }
    // Fill empty profile fields from client
    if (clientProfile) {
      const updates: Record<string, unknown> = {};
      if (!state.profile.countryCode && clientProfile.country) updates.countryCode = clientProfile.country;
      if (!state.profile.partyAffiliation && clientProfile.affiliation) updates.partyAffiliation = clientProfile.affiliation;
      if (state.profile.topics.length === 0 && clientProfile.topics?.length) updates.topics = clientProfile.topics;
      if (!state.profile.bio && clientProfile.bio) updates.bio = clientProfile.bio;
      if (!state.profile.displayName && clientProfile.displayName) updates.displayName = clientProfile.displayName;
      if (!state.profile.username && clientProfile.username) updates.username = clientProfile.username;

      if (Object.keys(updates).length > 0) {
        state = upsertUserState(sessionUser.id, { profile: updates as Parameters<typeof upsertUserState>[1]['profile'] });
      }
    }
  }

  return NextResponse.json(
    await buildResponse(sessionUser, state.onboarding, computeProfileCompletion(state), state.profile),
  );
}

// ─── PATCH /api/me — Update profile fields ──────────────────

export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = socialLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const sessionUser = getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON.');
  }

  const bio = typeof body.bio === 'string' ? body.bio.slice(0, 300) : undefined;
  const topics = Array.isArray(body.topics)
    ? (body.topics as string[]).filter((t) => typeof t === 'string' && t.length > 0).slice(0, 20).map((t) => t.slice(0, 50).toLowerCase().trim())
    : undefined;

  if (bio === undefined && topics === undefined) {
    return badRequest('No updatable fields provided.');
  }

  // Update in-memory profile state
  const profileUpdate: Record<string, unknown> = {};
  if (bio !== undefined) profileUpdate.bio = bio;
  if (topics !== undefined) profileUpdate.topics = topics;
  upsertUserState(sessionUser.id, { profile: profileUpdate });

  // Persist to DB
  if (isDbAvailable() && bio !== undefined) {
    try {
      await prisma.searchableUser.update({
        where: { id: sessionUser.id },
        data: { bio },
      });
    } catch { /* SearchableUser update failed */ }
    try {
      await prisma.user.update({
        where: { id: sessionUser.id },
        data: { bio },
      });
    } catch { /* User update failed */ }
  }

  return NextResponse.json({
    success: true,
    ...(bio !== undefined && { bio }),
    ...(topics !== undefined && { topics }),
  });
}
