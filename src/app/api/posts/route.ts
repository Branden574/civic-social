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
import { getUserById, getUserByUsername, registerUser } from '@/lib/user-registry';
import { analyzeCivility } from '@/lib/civility';
import { incrementalCredibilityUpdate } from '@/lib/credibility-recompute';
import { dbCreateNotification } from '@/lib/social-store';

// ─── Author profile (matches post-store.tsx) ─────────────────
async function getAuthorProfile(authorId: string) {
  const u = await getUserById(authorId);
  if (u) {
    return {
      displayName: u.displayName,
      avatarUrl: u.avatarUrl || null,
      affiliations: [u.affiliation || 'center'],
      verificationLevel: u.verificationLevel,
      civicReputation: Math.max(0, Math.min(1, u.credibilityScore / 100)),
    };
  }
  return {
    displayName: authorId === 'user-current' ? 'Branden Vincent-Walker' : 'Unknown User',
    avatarUrl: null,
    affiliations: ['center'],
    verificationLevel: 'EMAIL_VERIFIED',
    civicReputation: 0.5,
  };
}

// ─── Serialize PersistedPost → client PostData shape ─────────

async function serializePost(p: PersistedPost) {
  const author = await getAuthorProfile(p.authorId);
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
    comment_count: await getCommentCount(p.id),
    author: {
      id: p.authorId,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
      affiliations: author.affiliations,
      verificationLevel: author.verificationLevel,
      civicReputation: author.civicReputation,
    },
    thread: null,
    sources: (() => {
      if (!safeUrl) return [];
      try {
        return [{ url: safeUrl, domain: new URL(safeUrl).hostname.replace('www.', ''), trustScore: 0.7 }];
      } catch {
        return [];
      }
    })(),
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
    postType: p.postType,
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
    const posts = await getPostsByAuthor(authorId, isOwnProfile);
    return NextResponse.json({
      posts: await Promise.all(posts.map(serializePost)),
      total: posts.length,
      serverTime: new Date().toISOString(),
    });
  }

  const posts = await getAllPublishedPosts();
  return NextResponse.json({
    posts: await Promise.all(posts.map(serializePost)),
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
    await registerUser({
      id: user.id,
      displayName: user.displayName,
      username: user.displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, ''),
      email: user.email,
    });

    // Rate limit posting
    const rl = postLimiter.check(userId);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

    const body = await request.json();
    const { content, topics, articleUrl, comment_policy, postType } = body;

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

    // Compute civility server-side — never trust client-provided scores
    const { score: civilityScore } = analyzeCivility(sanitizedContent);

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

    // Validate post type
    const VALID_POST_TYPES = ['OPEN_DISCUSSION', 'STRUCTURED_DEBATE', 'POLICY_PROPOSAL', 'CROSS_PARTY_ROUNDTABLE', 'EXPERT_AMA', 'NEWS_DISCUSSION'];
    const safePostType = VALID_POST_TYPES.includes(postType) ? postType : 'OPEN_DISCUSSION';

    // Create the post
    const post = await createPost({
      authorId: userId,
      content: sanitizedContent,
      topics: sanitizedTopics,
      articleUrl: safeArticleUrl || undefined,
      civilityScore,
      comment_policy: safePolicy,
      postType: safePostType,
    });

    secureLog.info(
      'POST /api/posts',
      `created post_id=${post.id} author_id=${userId} status=${post.status} visibility=${post.visibility} created_at=${post.createdAt}`,
    );

    // Fire-and-forget credibility update based on this post
    incrementalCredibilityUpdate(userId, civilityScore, !!safeArticleUrl).catch(() => {});

    // Extract @mentions and create notifications (fire-and-forget)
    extractAndNotifyMentions(sanitizedContent, post.id, userId, user.displayName).catch(() => {});

    return NextResponse.json({
      success: true,
      post: await serializePost(post),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    secureLog.error('POST /api/posts', err);
    return internalError('Failed to create post. Please try again.');
  }
}

// ─── @mention extraction and notification ───────────────────

async function extractAndNotifyMentions(
  content: string,
  postId: string,
  authorId: string,
  authorDisplayName: string,
) {
  // Match @username patterns (alphanumeric, dots, hyphens, underscores)
  const mentionRegex = /@([a-zA-Z0-9._-]{2,30})/g;
  const usernames = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(content)) !== null) {
    usernames.add(match[1].toLowerCase());
  }

  if (usernames.size === 0) return;

  // Limit to 10 mentions per post to prevent spam
  const limited = [...usernames].slice(0, 10);

  for (const username of limited) {
    const mentioned = await getUserByUsername(username);
    if (!mentioned || mentioned.id === authorId) continue;

    await dbCreateNotification({
      recipientUserId: mentioned.id,
      actorUserId: authorId,
      type: 'mention',
      entityType: 'post',
      entityId: postId,
      metadata: {
        actorName: authorDisplayName,
        preview: content.slice(0, 120),
      },
    });
  }
}
