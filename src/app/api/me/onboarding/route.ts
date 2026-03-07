// ═══════════════════════════════════════════════════════════════
// POST /api/me/onboarding  — Mark onboarding complete
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { socialLimiter } from '@/lib/security/rate-limiter';
import {
  getUserState,
  upsertUserState,
  markOnboardingComplete,
  computeProfileCompletion,
} from '@/lib/user-state-store';
import { dbGetFollowerCount, dbGetFollowingCount } from '@/lib/social-store';
import { getPostCount } from '@/lib/post-data-store';
import { isDbAvailable, prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = socialLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const sessionUser = getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Ensure user state exists before completing
  if (!getUserState(sessionUser.id)) {
    upsertUserState(sessionUser.id, {
      profile: {
        displayName: sessionUser.displayName || '',
        username: '',
        email: sessionUser.email,
        countryCode: (body.country as string) || '',
        partyAffiliation: (body.affiliation as string) || '',
        topics: (body.topics as string[]) || [],
        bio: '',
        avatarUrl: null,
      },
    });
  }

  const state = markOnboardingComplete(sessionUser.id);

  // Persist to database (survives cold starts)
  if (isDbAvailable()) {
    try {
      await prisma.searchableUser.update({
        where: { id: sessionUser.id },
        data: { onboardingCompletedAt: new Date() },
      });
    } catch {
      // DB write failed — in-memory state is still correct for this request
    }
  }

  return NextResponse.json({
    success: true,
    onboarding: state.onboarding,
    profileCompletion: computeProfileCompletion(state),
    stats: {
      followersCount: await dbGetFollowerCount(sessionUser.id),
      followingCount: await dbGetFollowingCount(sessionUser.id),
      postsCount: await getPostCount(sessionUser.id),
    },
  });
}
