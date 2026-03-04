import { NextRequest, NextResponse } from 'next/server';
import { getAllDebates, createDebate, getPopularDebates } from '@/lib/debate-store';
import { getSessionUser, getClientIp, tooManyRequests, internalError, badRequest } from '@/lib/security/api-guard';
import { debateLimiter, readLimiter } from '@/lib/security/rate-limiter';
import { sanitizeText, sanitizeTopics, clampInt } from '@/lib/security/sanitize';
import { secureLog } from '@/lib/security/logger';

// GET /api/debates — list all debates
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter');

  if (filter === 'popular') {
    return NextResponse.json({ debates: getPopularDebates(10) });
  }

  let debates = getAllDebates();
  if (filter && ['live', 'waiting', 'completed'].includes(filter)) {
    debates = debates.filter((d) => d.status === filter);
  }

  return NextResponse.json({ debates, serverTime: new Date().toISOString() });
}

// POST /api/debates — create a new debate
export async function POST(request: NextRequest) {
  try {
    const user = getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const userId = user.id;
    const userName = user.displayName;

    // Rate limit debate creation
    const rl = debateLimiter.check(userId);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

    const body = await request.json();
    const { title, description, sideA, sideB, topics, durationMinutes, creatorSide } = body;

    // Validate and sanitize title
    const safeTitle = sanitizeText(title || '');
    if (safeTitle.length < 5) {
      return badRequest('Title must be at least 5 characters.');
    }
    if (safeTitle.length > 200) {
      return badRequest('Title must be at most 200 characters.');
    }

    // Validate sides
    const safeSideALabel = sanitizeText(sideA?.label || '');
    const safeSideBLabel = sanitizeText(sideB?.label || '');
    if (!safeSideALabel || !safeSideBLabel) {
      return badRequest('Both sides must have labels.');
    }

    // Sanitize description
    const safeDescription = sanitizeText(description || '').slice(0, 2000);

    // Sanitize topics
    const safeTopics = sanitizeTopics(topics);

    // Clamp duration
    const safeDuration = clampInt(durationMinutes, 5, 180, 30);

    const debate = createDebate({
      title: safeTitle,
      description: safeDescription,
      creatorId: userId,
      creatorName: userName,
      sideA: { label: safeSideALabel.slice(0, 100), ideology: sanitizeText(sideA?.ideology || 'center').slice(0, 30) },
      sideB: { label: safeSideBLabel.slice(0, 100), ideology: sanitizeText(sideB?.ideology || 'center').slice(0, 30) },
      topics: safeTopics,
      durationMinutes: safeDuration,
      creatorSide: creatorSide === 'B' ? 'B' : 'A',
    });

    secureLog.info('POST /api/debates', `Created debate id=${debate.id} creator=${userId}`);

    return NextResponse.json({ success: true, debate });
  } catch (err) {
    secureLog.error('POST /api/debates', err);
    return internalError('Failed to create debate.');
  }
}
