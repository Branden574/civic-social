import { NextRequest, NextResponse } from 'next/server';
import {
  createPost,
  getPostsByAuthor,
  getAllPublishedPosts,
  getCommentCount,
  type PersistedPost,
  type CommentPolicy,
} from '@/lib/post-data-store';
import {
  getSessionUser,
  getClientIp,
  tooManyRequests,
  internalError,
  badRequest,
} from '@/lib/security/api-guard';
import { postLimiter, readLimiter } from '@/lib/security/rate-limiter';
import { sanitizeText, sanitizeTopics, sanitizeUrl, isValidId } from '@/lib/security/sanitize';
import { secureLog } from '@/lib/security/logger';
import { getUserById, registerUser } from '@/lib/user-registry';

// ─── Author profile (matches post-store.tsx) ─────────────────
function getAuthorProfile(authorId: string) {
  const u = getUserById(authorId);
  if (u) {
    return {
      displayName: u.displayName,
      affiliations: [u.affiliation || 'center'],
      verificationLevel: u.verificationLevel,
      civicReputation: Math.max(0, Math.min(1, u.credibilityScore / 100)),
    };
  }
  return {
    displayName: authorId === 'user-current' ? 'Branden Vincent-Walker' : 'Unknown User',
    affiliations: ['center'],
    verificationLevel: 'EMAIL_VERIFIED',
    civicReputation: 0.5,
  };
}

// ─── Serialize PersistedPost → client PostData shape ─────────

function serializePost(p: PersistedPost) {
  const author = getAuthorProfile(p.authorId);
  const safeUrl = p.articleUrl ? sanitizeUrl(p.articleUrl) : null;
  return {
    id: p.id,
    content: p.content,
    createdAt: p.createdAt,
    topics: p.topics,
    articleUrl: safeUrl,
    comment_policy: p.comment_policy,
    visibility: p.visibility,
    is_thread_locked: p.is_thread_locked,
    comment_count: getCommentCount(p.id),
    author: {
      id: p.authorId,
      displayName: author.displayName,
      affiliations: author.affiliations,
      verificationLevel: author.verificationLevel,
      civicReputation: author.civicReputation,
    },
    thread: null,
    sources: safeUrl
      ? [{ url: safeUrl, domain: new URL(safeUrl).hostname.replace('www.', ''), trustScore: 0.7 }]
      : [],
    reactions: { agree: 0, disagree: 0, insightful: 0, nuance: 0 },
    algorithm: {
      qualityScore: 0.5 + p.civilityScore * 0.3,
      signals: {
        engagementQuality: 0,
        civility: p.civilityScore,
        viewpointDiversity: 0,
        sourceCredibility: safeUrl ? 0.6 : 0,
        topicRelevance: p.topics.length > 0 ? 0.7 : 0.3,
        authorReputation: author.civicReputation,
        penalty: 0,
      },
      explanation: 'Your post — shown to you and your followers.',
      explanationTags: ['your-post'],
    },
    replies: [],
    status: p.status,
  };
}

// ─── GET /api/posts?author=userId ────────────────────────────

export async function GET(request: NextRequest) {
  // Rate limit reads
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const authorId = searchParams.get('author');

  if (authorId) {
    if (!isValidId(authorId)) return badRequest('Invalid author ID format.');

    const user = getSessionUser(request);
    const isOwnProfile = user ? authorId === user.id : false;
    const posts = getPostsByAuthor(authorId, isOwnProfile);
    return NextResponse.json({
      posts: posts.map(serializePost),
      total: posts.length,
      serverTime: new Date().toISOString(),
    });
  }

  const posts = getAllPublishedPosts();
  return NextResponse.json({
    posts: posts.map(serializePost),
    total: posts.length,
    serverTime: new Date().toISOString(),
  });
}

// ─── POST /api/posts ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const user = getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const userId = user.id;
    registerUser({
      id: user.id,
      displayName: user.displayName,
      username: user.displayName.toLowerCase().replace(/\s+/g, '-'),
      email: user.email,
    });

    // Rate limit posting
    const rl = postLimiter.check(userId);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

    const body = await request.json();
    const { content, topics, articleUrl, civilityScore, comment_policy } = body;

    // Validate and sanitize content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return badRequest('Content is required and cannot be empty.');
    }

    const sanitizedContent = sanitizeText(content);

    if (sanitizedContent.length > 2000) {
      return badRequest('Content exceeds maximum length of 2000 characters.');
    }

    if (sanitizedContent.length === 0) {
      return badRequest('Content cannot be empty after sanitization.');
    }

    // Sanitize topics
    const sanitizedTopics = sanitizeTopics(topics);

    // Validate and sanitize URL (SSRF prevention)
    const safeArticleUrl = articleUrl ? sanitizeUrl(articleUrl) : undefined;
    if (articleUrl && !safeArticleUrl) {
      return badRequest('Invalid or disallowed article URL.');
    }

    // Validate comment policy
    const validPolicies: CommentPolicy[] = ['everyone', 'followers_only', 'off'];
    const safePolicy: CommentPolicy = validPolicies.includes(comment_policy) ? comment_policy : 'everyone';

    // Create the post
    const post = createPost({
      authorId: userId,
      content: sanitizedContent,
      topics: sanitizedTopics,
      articleUrl: safeArticleUrl || undefined,
      civilityScore: typeof civilityScore === 'number' ? Math.max(0, Math.min(1, civilityScore)) : 0.8,
      comment_policy: safePolicy,
    });

    secureLog.info(
      'POST /api/posts',
      `created post_id=${post.id} author_id=${userId} status=${post.status} visibility=${post.visibility} created_at=${post.createdAt}`,
    );

    return NextResponse.json({
      success: true,
      post: serializePost(post),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    secureLog.error('POST /api/posts', err);
    return internalError('Failed to create post. Please try again.');
  }
}
