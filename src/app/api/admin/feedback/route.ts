import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireAuth, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';

// GET — Admin only: list feedback submissions
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
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;
  const type = searchParams.get('type') || undefined;

  const where = type && ['bug', 'feature', 'general'].includes(type)
    ? { type }
    : {};

  const [items, total] = await Promise.all([
    prisma.feedbackSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.feedbackSubmission.count({ where }),
  ]);

  return NextResponse.json({
    feedback: items,
    total,
    page,
    hasMore: skip + limit < total,
  });
}

// POST — Any authenticated user: submit feedback
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const type = body.type as string;
  const title = (body.title as string)?.trim();
  const description = (body.description as string)?.trim();

  if (!['bug', 'feature', 'general'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type. Use bug, feature, or general.' }, { status: 400 });
  }
  if (!title || title.length < 3) {
    return NextResponse.json({ error: 'Title is required (min 3 characters).' }, { status: 400 });
  }
  if (!description || description.length < 10) {
    return NextResponse.json({ error: 'Description is required (min 10 characters).' }, { status: 400 });
  }

  const item = await prisma.feedbackSubmission.create({
    data: {
      userId: auth.id,
      type,
      title: title.slice(0, 200),
      description: description.slice(0, 5000),
    },
  });

  return NextResponse.json({ success: true, id: item.id }, { status: 201 });
}
