// ═══════════════════════════════════════════════════════════════
// GET /api/news — Fetch news articles from credible sources
// POST /api/news/refresh — Trigger a refresh from RSS feeds
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getAllNews, getNewsByTopic, refreshNews } from '@/lib/news-store';
import { getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100);
  const refresh = searchParams.get('refresh') === 'true';

  // On refresh, await the RSS fetch so real articles are available in the response.
  // The store has a 15-min cooldown so this won't spam external feeds.
  if (refresh) {
    try {
      await refreshNews();
    } catch { /* ignore fetch errors — will fall back to existing articles */ }
  }

  const articles = topic ? getNewsByTopic(topic, limit) : getAllNews(limit);

  return NextResponse.json({
    articles,
    count: articles.length,
    serverTime: new Date().toISOString(),
  });
}

// POST /api/news — Force refresh from RSS feeds
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const result = await refreshNews();

  return NextResponse.json({
    success: true,
    added: result.added,
    errors: result.errors,
  });
}
