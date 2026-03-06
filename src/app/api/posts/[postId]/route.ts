import { NextRequest, NextResponse } from 'next/server';
import { markPostDeleted } from '@/lib/deleted-posts';
import {
  deletePost as deletePersistedPost,
  getPostById,
  getCommentCount,
  canComment,
  canCommentMockPost,
} from '@/lib/post-data-store';
import { isFollowing } from '@/lib/social-store';
import { getSessionUser, getClientIp, internalError, badRequest, tooManyRequests } from '@/lib/security/api-guard';
import { isValidId } from '@/lib/security/sanitize';
import { secureLog } from '@/lib/security/logger';
import { readLimiter } from '@/lib/security/rate-limiter';
import { mockCandidates, mockReplies } from '@/lib/data/mock-data';

const permissionHelpers = {
  isFollower: (viewerId: string, authorId: string) => isFollowing(viewerId, authorId),
  isBlocked: () => false,
  isBanned: () => false,
};

import { getUserById } from '@/lib/user-registry';
import { recomputeCredibilityScore } from '@/lib/credibility-recompute';

async function getAuthorProfile(authorId: string) {
  const u = await getUserById(authorId);
  if (u) {
    return {
      displayName: u.displayName,
      affiliations: [u.affiliation || 'center'],
      verificationLevel: u.verificationLevel,
      civicReputation: Math.max(0, Math.min(1, u.credibilityScore / 100)),
    };
  }
  return {
    displayName: 'Unknown User',
    affiliations: [],
    verificationLevel: 'CITIZEN_VERIFIED',
    civicReputation: 0.5,
  };
}

// ═══════════════════════════════════════════════════════════════
// GET /api/posts/:postId — Full post detail with comment metadata
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  if (!postId) return badRequest('Post ID required.');

  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const user = getSessionUser(request);
  const viewerId = user?.id || 'user-current';

  // Try persisted post first
  const post = await getPostById(postId);
  if (post) {
    const author = await getAuthorProfile(post.authorId);
    const commentCount = await getCommentCount(postId);
    const perm = canComment(viewerId, post, permissionHelpers);

    return NextResponse.json({
      post: {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        topics: post.topics,
        articleUrl: post.articleUrl,
        status: post.status,
        visibility: post.visibility,
        comment_policy: post.comment_policy,
        is_thread_locked: post.is_thread_locked,
        comment_count: commentCount,
        viewer_can_comment: perm.allowed,
        viewer_comment_block_reason: perm.reason,
        author: {
          id: post.authorId,
          displayName: author.displayName,
          affiliations: author.affiliations,
          verificationLevel: author.verificationLevel,
          civicReputation: author.civicReputation,
        },
        reactions: { agree: 0, disagree: 0, insightful: 0, nuance: 0 },
      },
      serverTime: new Date().toISOString(),
    });
  }

  // Try mock post
  const mockCandidate = mockCandidates.find((c) => c.post.id === postId);
  if (mockCandidate) {
    const commentCount = await getCommentCount(postId);
    const mockLegacyReplies = mockReplies.filter((r) => r.postId === postId);
    const perm = canCommentMockPost(viewerId, {
      authorId: mockCandidate.author.id,
      comment_policy: 'everyone',
      visibility: 'public',
      status: 'published',
    }, permissionHelpers);

    return NextResponse.json({
      post: {
        id: mockCandidate.post.id,
        content: mockCandidate.post.content,
        createdAt: mockCandidate.post.createdAt.toISOString(),
        topics: mockCandidate.post.topics,
        status: 'published',
        visibility: 'public' as const,
        comment_policy: 'everyone' as const,
        is_thread_locked: false,
        comment_count: commentCount + mockLegacyReplies.length,
        viewer_can_comment: perm.allowed,
        viewer_comment_block_reason: perm.reason,
        author: {
          id: mockCandidate.author.id,
          displayName: mockCandidate.author.displayName,
          affiliations: mockCandidate.author.affiliations,
          verificationLevel: mockCandidate.author.verificationLevel,
          civicReputation: mockCandidate.author.civicReputation,
        },
        reactions: {
          agree: mockCandidate.post.agreeCount,
          disagree: mockCandidate.post.disagreeCount,
          insightful: mockCandidate.post.insightfulCount,
          nuance: mockCandidate.post.nuanceCount,
        },
        sources: mockCandidate.post.sources.map((s: { url: string; domain: string; trustScore: number }) => ({
          url: s.url,
          domain: s.domain,
          trustScore: s.trustScore,
        })),
        replies: mockLegacyReplies.map((r) => ({
          id: r.id,
          content: r.content,
          author: {
            id: r.author.id,
            displayName: r.author.displayName,
            affiliations: r.author.affiliations,
            verificationLevel: r.author.verificationLevel,
          },
          createdAt: r.createdAt.toISOString(),
          civilityScore: r.civilityScore,
          reactions: {
            agree: r.agreeCount,
            disagree: r.disagreeCount,
            insightful: r.insightfulCount,
          },
        })),
      },
      serverTime: new Date().toISOString(),
    });
  }

  return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
}

// ═══════════════════════════════════════════════════════════════
// DELETE /api/posts/:postId — Full Data Wipe
// ═══════════════════════════════════════════════════════════════

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;

  if (!postId || !isValidId(postId)) {
    return badRequest('Invalid post ID format.');
  }

  try {
    const user = getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // Verify ownership
    const post = await getPostById(postId);
    if (post && post.authorId !== user.id) {
      return NextResponse.json({ error: 'You can only delete your own posts.' }, { status: 403 });
    }

    await deletePersistedPost(postId);
    markPostDeleted(postId);

    secureLog.audit('post_deleted', user.id, { postId });

    // Recompute credibility after deletion (removal changes the ratio)
    recomputeCredibilityScore(user.id).catch(() => {});

    return NextResponse.json({
      success: true,
      postId,
      wipedAt: new Date().toISOString(),
      message: 'Post and all associated data have been permanently deleted.',
    });
  } catch (err) {
    secureLog.error('DELETE /api/posts', err);
    return internalError('Failed to delete post. Please try again.');
  }
}
