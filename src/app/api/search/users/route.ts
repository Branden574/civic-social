// ═══════════════════════════════════════════════════════════════
// GET /api/search/users — User search with ranking
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { searchUsers, registerUser } from '@/lib/user-registry';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const scope = (searchParams.get('scope') || 'global') as 'global' | 'followers';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
  const cursor = parseInt(searchParams.get('cursor') || '0', 10);

  const user = getSessionUser(request);

  // Auto-register the requesting user so they appear in searches
  if (user) {
    registerUser({
      id: user.id,
      displayName: user.displayName,
      username: user.displayName.toLowerCase().replace(/\s+/g, '-'),
      email: user.email,
    });
  }

  const { results, total, hasMore } = searchUsers({
    query: q,
    scope,
    viewerId: user?.id,
    limit,
    cursor,
  });

  return NextResponse.json({
    users: results.map((r) => ({
      id: r.user.id,
      displayName: r.user.displayName,
      username: r.user.username,
      bio: r.user.bio,
      affiliation: r.user.affiliation,
      avatarUrl: r.user.avatarUrl,
      verificationLevel: r.user.verificationLevel,
      isVerified: r.user.isVerified,
      credibilityScore: r.user.credibilityScore,
      followerCount: r.user.followerCount,
      followingCount: r.user.followingCount,
      postCount: r.user.postCount,
      createdAt: r.user.createdAt,
    })),
    total,
    hasMore,
    query: q,
    scope,
  });
}
