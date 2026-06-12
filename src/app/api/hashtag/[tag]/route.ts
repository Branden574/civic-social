// ═══════════════════════════════════════════════════════════════
// Cross-Content Hashtag API
// GET /api/hashtag/[tag]?limit=30
// Returns posts AND news articles matching the given topic tag.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getAllPublishedPosts, getCommentCountsBatch, type PersistedPost } from '@/lib/post-data-store';
import { getAllNews, type NewsArticle } from '@/lib/news-store';
import { getDeletedPostIds } from '@/lib/deleted-posts';
import { getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { sanitizeHashtag, clampInt } from '@/lib/security/sanitize';
import { getUserById } from '@/lib/user-registry';

async function serializePost(p: PersistedPost, counts: Map<string, number>) {
  const registryUser = await getUserById(p.authorId);
  return {
    type: 'post' as const,
    id: p.id,
    content: p.content,
    createdAt: p.createdAt,
    topics: p.topics,
    author: {
      id: p.authorId,
      displayName: registryUser?.displayName || 'User',
      avatarUrl: registryUser?.avatarUrl || null,
      affiliations: [registryUser?.affiliation || 'center'],
      verificationLevel: registryUser?.verificationLevel || 'EMAIL_VERIFIED',
      civicReputation: registryUser ? Math.max(0, Math.min(1, registryUser.credibilityScore / 100)) : 0.5,
    },
    thread: null,
    sources: [],
    reactions: { agree: 0, disagree: 0, insightful: 0, nuance: 0 },
    algorithm: {
      qualityScore: 0.5,
      signals: { engagementQuality: 0, civility: p.civilityScore, viewpointDiversity: 0, sourceCredibility: 0, topicRelevance: 0.7, authorReputation: 0.5, penalty: 0 },
      explanation: 'Matching topic.',
      explanationTags: ['hashtag-match'],
    },
    comment_policy: p.comment_policy ?? 'everyone',
    comment_count: counts.get(p.id) ?? 0,
    postType: p.postType || 'OPEN_DISCUSSION',
    replies: [],
  };
}

function serializeNewsArticle(a: NewsArticle) {
  return {
    type: 'news' as const,
    id: a.id,
    title: a.title,
    summary: a.summary,
    url: a.url,
    source: a.source,
    sourceDomain: a.sourceDomain,
    publishedAt: a.publishedAt,
    imageUrl: a.imageUrl || null,
    topics: a.topics,
    factCheckStatus: a.factCheckStatus,
    sourceTrustScore: a.sourceTrustScore,
    discussionCount: a.discussionCount,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tag: string }> },
) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { tag: rawTag } = await params;
  const tag = sanitizeHashtag(decodeURIComponent(rawTag));
  if (!tag) {
    return NextResponse.json({ error: 'Tag is required.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const limit = clampInt(searchParams.get('limit'), 1, 100, 30);

  const deletedIds = getDeletedPostIds();

  // Fetch posts matching the tag (exact match on topics array)
  const allPosts = await getAllPublishedPosts();
  const matchingPosts = allPosts.filter(
    (p) => !deletedIds.has(p.id) && p.topics.some((t) => t.toLowerCase() === tag),
  );

  const postIds = matchingPosts.map((p) => p.id);
  const counts = await getCommentCountsBatch(postIds);
  const serializedPosts = await Promise.all(matchingPosts.slice(0, limit).map((p) => serializePost(p, counts)));

  // Fetch news articles matching the tag
  const allNews = getAllNews(200);
  const matchingNews = allNews
    .filter((a) => a.topics.some((t) => t.toLowerCase() === tag))
    .slice(0, limit);
  const serializedNews = matchingNews.map(serializeNewsArticle);

  return NextResponse.json({
    tag,
    posts: serializedPosts,
    news: serializedNews,
    meta: {
      postCount: matchingPosts.length,
      newsCount: matchingNews.length,
    },
  });
}
