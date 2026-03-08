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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const validStatuses = ['PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED'];
  const where = status && validStatuses.includes(status)
    ? { status: status as 'PENDING' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED' }
    : {};

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.report.count({ where }),
  ]);

  return NextResponse.json({
    reports,
    total,
    page,
    hasMore: skip + limit < total,
  });
}
