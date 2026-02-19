// ═══════════════════════════════════════════════════════════════
// Civic Social — Check New Posts API (Hardened)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getNewPostCountSince } from '@/lib/simulated-new-posts';
import { getAllPublishedPosts } from '@/lib/post-data-store';
import { getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';

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

  // 1. Count simulated new posts released since the timestamp
  const simulated = getNewPostCountSince(sinceMs);

  // 2. Count user-created posts newer than timestamp
  const allUserPosts = await getAllPublishedPosts();
  const userPosts = allUserPosts.filter(
    (p) => new Date(p.createdAt).getTime() > sinceMs,
  );

  const totalCount = simulated.count + userPosts.length;

  let latestAt = simulated.latestAt;
  if (userPosts.length > 0) {
    const latestUserPost = userPosts.reduce((latest, p) =>
      new Date(p.createdAt).getTime() > new Date(latest.createdAt).getTime() ? p : latest,
    );
    const userLatestMs = new Date(latestUserPost.createdAt).getTime();
    if (!latestAt || userLatestMs > new Date(latestAt).getTime()) {
      latestAt = latestUserPost.createdAt;
    }
  }

  return NextResponse.json({
    count: totalCount,
    latestAt,
    serverTime: new Date().toISOString(),
  });
}
