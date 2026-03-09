import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.toLowerCase().trim() || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const where = q
    ? {
        OR: [
          { displayName: { contains: q, mode: 'insensitive' as const } },
          { username: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.searchableUser.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        credibilityScore: true,
        followerCount: true,
        postCount: true,
        createdAt: true,
        suspendedUntil: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.searchableUser.count({ where }),
  ]);

  // Mask emails for security — show first 2 chars + *** + @domain
  const maskedUsers = users.map((u) => ({
    ...u,
    email: maskEmail(u.email),
  }));

  return NextResponse.json({
    users: maskedUsers,
    total,
    page,
    hasMore: skip + limit < total,
  });
}
