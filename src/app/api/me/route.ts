// ═══════════════════════════════════════════════════════════════
// GET  /api/me  — Bootstrap endpoint (single source of truth)
// POST /api/me  — Sync client state → server, return authoritative
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import {
  getUserState,
  upsertUserState,
  markOnboardingComplete,
  computeProfileCompletion,
  type OnboardingState,
  type ProfileCompletion,
} from '@/lib/user-state-store';
import { getFollowerCount, getFollowingCount } from '@/lib/social-store';
import { getPostCount } from '@/lib/post-data-store';

// ─── Response shape ──────────────────────────────────────────

interface MeResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
  };
  onboarding: OnboardingState;
  profileCompletion: ProfileCompletion;
  stats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
  };
}

function buildResponse(
  sessionUser: { id: string; email: string; displayName: string; role: string },
  onboarding: OnboardingState,
  profileCompletion: ProfileCompletion,
): MeResponse {
  return {
    user: {
      id: sessionUser.id,
      email: sessionUser.email,
      displayName: sessionUser.displayName,
      role: sessionUser.role,
    },
    onboarding,
    profileCompletion,
    stats: {
      followersCount: getFollowerCount(sessionUser.id),
      followingCount: getFollowingCount(sessionUser.id),
      postsCount: getPostCount(sessionUser.id),
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

  const state = getUserState(sessionUser.id);
  if (!state) {
    // User exists in session cookie but not in server store (cold start).
    // Return defaults — client should POST /api/me to sync.
    const defaultOnboarding: OnboardingState = {
      isDone: false,
      stepCompleted: '',
      completedAt: null,
    };
    const defaultCompletion: ProfileCompletion = {
      isComplete: false,
      percent: 0,
      missingFields: ['display_name', 'username', 'country', 'party', 'topics'],
    };
    return NextResponse.json(buildResponse(sessionUser, defaultOnboarding, defaultCompletion));
  }

  return NextResponse.json(
    buildResponse(sessionUser, state.onboarding, computeProfileCompletion(state)),
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
    // Server doesn't know this user — seed from client data
    const onboardingDone = !!clientOnboarding?.completedAt;
    state = upsertUserState(sessionUser.id, {
      onboarding: {
        isDone: onboardingDone,
        stepCompleted: onboardingDone ? 'done' : '',
        completedAt: clientOnboarding?.completedAt || null,
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
  } else {
    // Server has state — reconcile: if client says done but server doesn't, trust client
    if (clientOnboarding?.completedAt && !state.onboarding.isDone) {
      state = markOnboardingComplete(sessionUser.id);
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
    buildResponse(sessionUser, state.onboarding, computeProfileCompletion(state)),
  );
}
