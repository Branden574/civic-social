// ═══════════════════════════════════════════════════════════════
// GET /api/users/:userId — Fetch user profile by ID or username
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { getUserById, getUserByUsername } from '@/lib/user-registry';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { userId } = await params;
  const identifier = decodeURIComponent(userId);

  // Try by ID first, then by username
  const user = (await getUserById(identifier)) ?? (await getUserByUsername(identifier));

  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 },
    );
  }

  // Return a public-safe profile (no email, no normalized fields)
  return NextResponse.json({
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    bio: user.bio,
    affiliation: user.affiliation,
    avatarUrl: user.avatarUrl,
    verificationLevel: user.verificationLevel,
    isVerified: user.isVerified,
    credibilityScore: user.credibilityScore,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    postCount: user.postCount,
    createdAt: user.createdAt,
  });
}
