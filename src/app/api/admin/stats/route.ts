import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const [totalUsers, totalPosts, totalComments, usersThisWeek, postsToday] = await Promise.all([
    prisma.searchableUser.count(),
    prisma.storedPost.count({ where: { status: 'published' } }),
    prisma.storedComment.count({ where: { status: 'published' } }),
    prisma.searchableUser.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.storedPost.count({ where: { createdAt: { gte: today } } }),
  ]);

  return NextResponse.json({
    totalUsers,
    totalPosts,
    totalComments,
    usersThisWeek,
    postsToday,
    serverTime: now.toISOString(),
  });
}
