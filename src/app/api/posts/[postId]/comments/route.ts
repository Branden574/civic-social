import { NextRequest, NextResponse } from 'next/server';
import {
  getPostById,
  createComment,
  getCommentsByPost,
  getCommentCount,
  deleteComment,
  getCommentById,
  getReplyCounts,
  canComment,
  canCommentMockPost,
} from '@/lib/post-data-store';
import { isFollowing, dbCreateNotification } from '@/lib/social-store';
import { getSessionUser, getClientIp, tooManyRequests, badRequest, internalError } from '@/lib/security/api-guard';
import { postLimiter, readLimiter } from '@/lib/security/rate-limiter';
import { sanitizeText, clampInt, isValidId } from '@/lib/security/sanitize';
import { secureLog } from '@/lib/security/logger';
import { mockCandidates } from '@/lib/data/mock-data';

// Helper stubs for permission checks (replace with real DB lookups in production)
const permissionHelpers = {
  isFollower: (viewerId: string, authorId: string) => isFollowing(viewerId, authorId),
  isBlocked: () => false, // No block system yet
  isBanned: () => false,  // No ban system yet
};

import { getUserById } from '@/lib/user-registry';

async function getAuthorMeta(authorId: string) {
  const u = await getUserById(authorId);
  if (u) {
    return {
      displayName: u.displayName,
      avatarUrl: u.avatarUrl || null,
      affiliations: [u.affiliation || 'center'],
      verificationLevel: u.verificationLevel,
    };
  }
  return { displayName: 'User', avatarUrl: null, affiliations: [], verificationLevel: 'CITIZEN_VERIFIED' };
}

async function serializeComment(c: { id: string; postId: string; authorId: string; parentCommentId: string | null; body: string; createdAt: string; status: string }, replyCount = 0) {
  const author = await getAuthorMeta(c.authorId);
  return {
    id: c.id,
    postId: c.postId,
    authorId: c.authorId,
    parentCommentId: c.parentCommentId,
    body: c.body,
    createdAt: c.createdAt,
    status: c.status,
    replyCount,
    author: {
      id: c.authorId,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
      affiliations: author.affiliations,
      verificationLevel: author.verificationLevel,
    },
  };
}

// ─── GET /api/posts/:postId/comments ─────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  if (!postId) return badRequest('Post ID required.');

  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const limit = clampInt(searchParams.get('limit'), 1, 100, 50);
  const cursor = searchParams.get('cursor') || undefined;

  const [result, replyCounts] = await Promise.all([
    getCommentsByPost(postId, { limit, cursor }),
    getReplyCounts(postId),
  ]);

  return NextResponse.json({
    comments: await Promise.all(result.comments.map((c) => serializeComment(c, replyCounts.get(c.id) ?? 0))),
    total: result.total,
    hasMore: result.hasMore,
    serverTime: new Date().toISOString(),
  });
}

// ─── POST /api/posts/:postId/comments ────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  if (!postId) return badRequest('Post ID required.');

  try {
    const user = getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = user.id;

    // Rate limit
    const rl = postLimiter.check(userId);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

    // Parse body
    const body = await request.json();
    const rawBody = body.body as string | undefined;
    const parentCommentId = body.parent_comment_id as string | undefined;

    // Validate body
    if (!rawBody || typeof rawBody !== 'string' || rawBody.trim().length === 0) {
      return badRequest('Comment body is required.');
    }

    const sanitizedBody = sanitizeText(rawBody);
    if (sanitizedBody.length === 0) return badRequest('Comment body cannot be empty after sanitization.');
    if (sanitizedBody.length > 1000) return badRequest('Comment exceeds maximum length of 1000 characters.');

    // Validate parent comment if provided
    if (parentCommentId) {
      if (!isValidId(parentCommentId)) return badRequest('Invalid parent comment ID.');
      const parent = await getCommentById(parentCommentId);
      if (!parent || parent.postId !== postId) return badRequest('Parent comment not found on this post.');
    }

    // Permission check — try persisted post first, then mock
    const persistedPost = await getPostById(postId);
    let permResult;

    if (persistedPost) {
      permResult = canComment(userId, persistedPost, permissionHelpers);
    } else {
      // Check mock posts — all mock posts are public with comments enabled
      const mockCandidate = mockCandidates.find((c) => c.post.id === postId);
      if (!mockCandidate) return badRequest('Post not found.');
      permResult = canCommentMockPost(userId, {
        authorId: mockCandidate.author.id,
        comment_policy: 'everyone',
        visibility: 'public',
        status: 'published',
      }, permissionHelpers);
    }

    if (!permResult.allowed) {
      return NextResponse.json(
        { error: permResult.reason, code: 'COMMENT_DENIED' },
        { status: 403 },
      );
    }

    // Create comment
    const [comment, commentCount] = await Promise.all([
      createComment({
        postId,
        authorId: userId,
        body: sanitizedBody,
        parentCommentId: parentCommentId || undefined,
      }),
      getCommentCount(postId),
    ]);

    secureLog.info('POST comment', `comment=${comment.id} post=${postId} author=${userId}`);

    // Create notification for the post author (don't notify yourself)
    const postAuthorId = persistedPost?.authorId
      || mockCandidates.find((c) => c.post.id === postId)?.author.id;
    if (postAuthorId && postAuthorId !== userId) {
      const authorMeta = await getAuthorMeta(userId);
      dbCreateNotification({
        recipientUserId: postAuthorId,
        actorUserId: userId,
        type: 'reply',
        entityType: 'post',
        entityId: postId,
        metadata: {
          actorName: authorMeta.displayName,
          preview: sanitizedBody.slice(0, 100),
        },
      });
    }

    // If replying to a comment, also notify the parent comment author
    if (parentCommentId) {
      const parentComment = await getCommentById(parentCommentId);
      if (parentComment && parentComment.authorId !== userId && parentComment.authorId !== postAuthorId) {
        const authorMeta = await getAuthorMeta(userId);
        dbCreateNotification({
          recipientUserId: parentComment.authorId,
          actorUserId: userId,
          type: 'reply',
          entityType: 'comment',
          entityId: postId,
          metadata: {
            actorName: authorMeta.displayName,
            preview: sanitizedBody.slice(0, 100),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      comment: await serializeComment(comment),
      commentCount,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    secureLog.error('POST comment', err);
    return internalError('Failed to create comment.');
  }
}

// ─── PATCH /api/posts/:postId/comments — Comment reactions ───

// In-memory comment reactions (maps commentId → userId → reaction)
const commentReactions = new Map<string, Map<string, string | null>>();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  if (!postId) return badRequest('Post ID required.');

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const commentId = body.commentId as string;
    const reaction = body.reaction as string | null; // 'like', 'dislike', or null to remove

    if (!commentId || !isValidId(commentId)) return badRequest('Valid commentId required.');
    if (reaction !== null && reaction !== 'like' && reaction !== 'dislike') {
      return badRequest('Reaction must be "like", "dislike", or null.');
    }

    // Verify comment exists
    const comment = await getCommentById(commentId);
    if (!comment || comment.postId !== postId) {
      return badRequest('Comment not found on this post.');
    }

    // Store reaction
    if (!commentReactions.has(commentId)) {
      commentReactions.set(commentId, new Map());
    }
    const reactions = commentReactions.get(commentId)!;
    reactions.set(user.id, reaction);

    // Compute counts
    let likes = 0;
    let dislikes = 0;
    for (const r of reactions.values()) {
      if (r === 'like') likes++;
      if (r === 'dislike') dislikes++;
    }

    return NextResponse.json({
      success: true,
      commentId,
      viewerReaction: reaction,
      likes,
      dislikes,
    });
  } catch (err) {
    secureLog.error('PATCH comment reaction', err);
    return internalError('Failed to save comment reaction.');
  }
}

// ─── DELETE /api/posts/:postId/comments?commentId=xxx ────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get('commentId');

  if (!commentId || !isValidId(commentId)) return badRequest('Valid commentId required.');

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = user.id;

  const [ok, commentCount] = await Promise.all([
    deleteComment(commentId, userId),
    getCommentCount(postId),
  ]);

  if (!ok) {
    return NextResponse.json({ error: 'Comment not found or not authorized.' }, { status: 404 });
  }

  secureLog.audit('comment_deleted', userId, { commentId, postId });

  return NextResponse.json({
    success: true,
    commentCount,
    serverTime: new Date().toISOString(),
  });
}
