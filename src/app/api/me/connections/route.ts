// ═══════════════════════════════════════════════════════════════
// GET /api/me/connections?type=followers|following
// Returns the list of users who follow the current user (followers)
// or who the current user follows (following).
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  if (type !== 'followers' && type !== 'following') {
    return badRequest('type must be "followers" or "following".');
  }

  if (!isDbAvailable()) {
    return NextResponse.json({ users: [] });
  }

  try {
    let rows: { id: string; displayName: string; username: string; avatarUrl: string | null; verificationLevel: string; credibilityScore: number }[];

    if (type === 'followers') {
      // People who follow me: followingId = me → get their profile (followerId)
      rows = await prisma.$queryRaw`
        SELECT su.id, su."displayName", su.username, su."avatarUrl", su."verificationLevel", su."credibilityScore"
        FROM "SearchableUser" su
        JOIN "SearchableUserFollow" suf ON su.id = suf."followerId"
        WHERE suf."followingId" = ${user.id}
        ORDER BY suf."createdAt" DESC
        LIMIT 200
      `;
    } else {
      // People I follow: followerId = me → get their profile (followingId)
      rows = await prisma.$queryRaw`
        SELECT su.id, su."displayName", su.username, su."avatarUrl", su."verificationLevel", su."credibilityScore"
        FROM "SearchableUser" su
        JOIN "SearchableUserFollow" suf ON su.id = suf."followingId"
        WHERE suf."followerId" = ${user.id}
        ORDER BY suf."createdAt" DESC
        LIMIT 200
      `;
    }

    return NextResponse.json({ users: rows });
  } catch (err) {
    console.error('[connections]', err);
    return NextResponse.json({ users: [] });
  }
}
