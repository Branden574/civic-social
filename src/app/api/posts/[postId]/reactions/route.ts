// ═══════════════════════════════════════════════════════════════
// POST  /api/posts/:postId/reactions  — toggle reaction
// GET   /api/posts/:postId/reactions  — get viewer state + counts
// DELETE /api/posts/:postId/reactions — remove reaction
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { socialLimiter, readLimiter } from '@/lib/security/rate-limiter';
import {
  toggleReaction,
  removeReaction,
  getViewerReaction,
  getReactionDeltas,
  addFeedback,
  hasFeedbackForPost,
  type ReactionType,
} from '@/lib/reaction-store';
import { createNotification } from '@/lib/social-store';
import { getPostById } from '@/lib/post-data-store';

const VALID_REACTIONS: ReactionType[] = ['agree', 'disagree', 'insightful', 'nuance'];

type RouteContext = { params: Promise<{ postId: string }> };

// ─── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const { postId } = await context.params;
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const user = getSessionUser(request);
  const viewerReaction = user ? getViewerReaction(user.id, postId) : null;
  const deltas = getReactionDeltas(postId);
  const hasFeedback = user ? hasFeedbackForPost(user.id, postId) : false;

  return NextResponse.json({
    viewer_reaction: viewerReaction,
    deltas,
    has_feedback: hasFeedback,
  });
}

// ─── POST — toggle reaction ──────────────────────────────────

export async function POST(request: NextRequest, context: RouteContext) {
  const { postId } = await context.params;
  const ip = getClientIp(request);
  const rl = socialLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Please log in to react to posts.' },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.');
  }

  const reaction = body.reaction as string;

  // Allow "feedback" action to submit reasons
  if (body.action === 'feedback') {
    const reasons = body.reasons as string[];
    const notes = (body.notes as string) || '';
    if (!Array.isArray(reasons) || reasons.length === 0) {
      return badRequest('At least one reason is required.');
    }
    const fb = addFeedback({
      userId: user.id,
      postId,
      reaction: reaction || '',
      reasons,
      notes,
    });
    return NextResponse.json({ success: true, feedback: fb });
  }

  if (!reaction || !VALID_REACTIONS.includes(reaction as ReactionType)) {
    return badRequest(`Invalid reaction. Must be one of: ${VALID_REACTIONS.join(', ')}`);
  }

  const result = toggleReaction(user.id, postId, reaction as ReactionType);
  const deltas = getReactionDeltas(postId);
  const hasFeedback = hasFeedbackForPost(user.id, postId);

  // Notify post author on new reaction (not on un-toggle)
  if (result) {
    const post = await getPostById(postId);
    if (post && post.authorId !== user.id) {
      createNotification({
        recipientUserId: post.authorId,
        actorUserId: user.id,
        type: 'like',
        entityType: 'post',
        entityId: postId,
        metadata: {
          actorName: user.displayName,
        },
      });
    }
  }

  return NextResponse.json({
    viewer_reaction: result?.reaction ?? null,
    deltas,
    has_feedback: hasFeedback,
    toggled: result ? 'on' : 'off',
  });
}

// ─── DELETE — remove reaction ────────────────────────────────

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { postId } = await context.params;
  const ip = getClientIp(request);
  const rl = socialLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Please log in to manage reactions.' },
      { status: 401 },
    );
  }

  removeReaction(user.id, postId);
  const deltas = getReactionDeltas(postId);

  return NextResponse.json({
    viewer_reaction: null,
    deltas,
  });
}
