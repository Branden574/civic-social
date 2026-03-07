// ═══════════════════════════════════════════════════════════════
// GET /api/feed/check-new — Check for genuinely new posts
// ═══════════════════════════════════════════════════════════════
//
// Only counts REAL persisted posts (StoredPost) created after `since`.
// Excludes the requesting user's own posts (already shown optimistically).
// Excludes simulated/demo posts entirely.
// Returns the new post IDs so the client can deduplicate.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, getSessionUser, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';
import { getAllPublishedPosts } from '@/lib/post-data-store';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get('since');

  if (!sinceParam) {
    return badRequest('Missing required "since" parameter (ISO timestamp or ms).');
  }

  // Parse the "since" value — accept ISO string or milliseconds
  let sinceMs: number;
  const parsed = Number(sinceParam);
  if (!isNaN(parsed) && parsed > 0 && parsed < 1e15) {
    sinceMs = parsed;
  } else {
    const d = new Date(sinceParam);
    if (isNaN(d.getTime())) {
      return badRequest('Invalid "since" parameter. Provide ISO timestamp or ms.');
    }
    sinceMs = d.getTime();
  }

  // Get the current user ID so we can exclude their own posts
  const sessionUser = getSessionUser(request);
  const currentUserId = sessionUser?.id;

  // Also accept excludeIds — posts the client already has rendered
  const excludeIdsParam = searchParams.get('excludeIds');
  const excludeIds = new Set(excludeIdsParam ? excludeIdsParam.split(',').filter(Boolean) : []);

  // Only count REAL persisted posts, not simulated/mock content
  const sinceDate = new Date(sinceMs);
  let newPosts: { id: string; createdAt: string; authorId: string }[] = [];

  if (isDbAvailable()) {
    try {
      const rows = await prisma.storedPost.findMany({
        where: {
          createdAt: { gt: sinceDate },
          status: 'published',
          deletedAt: null,
          // Exclude current user's own posts
          ...(currentUserId ? { authorId: { not: currentUserId } } : {}),
        },
        select: { id: true, createdAt: true, authorId: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      newPosts = rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        authorId: r.authorId,
      }));
    } catch {
      // DB query failed — return zero
    }
  } else {
    // Fallback: in-memory store
    const allPosts = await getAllPublishedPosts();
    newPosts = allPosts
      .filter((p) => {
        const postTime = new Date(p.createdAt).getTime();
        if (postTime <= sinceMs) return false;
        if (currentUserId && p.authorId === currentUserId) return false;
        return true;
      })
      .map((p) => ({ id: p.id, createdAt: p.createdAt, authorId: p.authorId }));
  }

  // Filter out posts the client already has
  const filtered = newPosts.filter((p) => !excludeIds.has(p.id));

  return NextResponse.json({
    count: filtered.length,
    postIds: filtered.map((p) => p.id),
    latestAt: filtered.length > 0 ? filtered[0].createdAt : null,
    serverTime: new Date().toISOString(),
  });
}
