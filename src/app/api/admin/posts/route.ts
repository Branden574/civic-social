import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';
import { clampInt, sanitizeText } from '@/lib/security/sanitize';

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
  const page = clampInt(searchParams.get('page'), 1, 1000, 1);
  const limit = clampInt(searchParams.get('limit'), 1, 50, 20);
  const q = sanitizeText(searchParams.get('q') || '').toLowerCase();
  const status = searchParams.get('status') || undefined;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status && ['published', 'removed', 'pending_review'].includes(status)) {
    where.status = status;
  }
  if (q) {
    where.content = { contains: q, mode: 'insensitive' };
  }

  const [posts, total] = await Promise.all([
    prisma.storedPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.storedPost.count({ where }),
  ]);

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      authorId: p.authorId,
      content: p.content.slice(0, 300),
      topics: p.topics,
      status: p.status,
      postType: p.postType,
      createdAt: p.createdAt.toISOString(),
      deletedAt: p.deletedAt?.toISOString() || null,
    })),
    total,
    page,
    limit,
  });
}
