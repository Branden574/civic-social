import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/security/api-guard';
import { isDbAvailable, prisma } from '@/lib/db';
import { sanitizeText } from '@/lib/security/sanitize';

const VALID_CATEGORIES = [
  'threats',
  'harassment',
  'misinformation',
  'hate-speech',
  'spam',
  'impersonation',
  'other',
];

export async function POST(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  let body: { postId?: string; category?: string; details?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { postId, category, details } = body;

  if (!postId || typeof postId !== 'string') {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 });
  }

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid report category' }, { status: 400 });
  }

  const sanitizedDetails = details ? sanitizeText(String(details).slice(0, 1000)) : null;

  try {
    // Rate limit: max 5 reports per hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentReportCount = await prisma.report.count({
      where: {
        reporterId: user.id,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentReportCount >= 5) {
      return NextResponse.json(
        { error: 'Too many reports. Please wait before submitting another.' },
        { status: 429 },
      );
    }

    // Check that the post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Don't allow self-reporting
    if (post.authorId === user.id) {
      return NextResponse.json({ error: 'You cannot report your own post' }, { status: 400 });
    }

    // Check for duplicate report
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: user.id,
        postId,
        status: 'PENDING',
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'You have already reported this post' },
        { status: 409 },
      );
    }

    const report = await prisma.report.create({
      data: {
        reason: category,
        details: sanitizedDetails,
        reporterId: user.id,
        postId,
      },
    });

    return NextResponse.json(
      { success: true, reportId: report.id },
      { status: 201 },
    );
  } catch (err) {
    console.error('[reports] Error creating report:', err);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}
