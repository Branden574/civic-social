// ═══════════════════════════════════════════════════════════════
// Civic Social — Debate Chat API (Hardened)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  getMessages,
  postMessage,
  postSystemMessage,
  deleteMessage,
  pinMessage,
  addReaction,
  muteUser,
  unmuteUser,
  isUserMuted,
  clearChatData,
  getChatConfig,
  updateChatConfig,
  getChatStats,
  getPinnedMessages,
} from '@/lib/chat-store';
import { getDebateById } from '@/lib/debate-store';
import { getSessionUser, getClientIp, tooManyRequests, internalError, badRequest } from '@/lib/security/api-guard';
import { chatLimiter, readLimiter } from '@/lib/security/rate-limiter';
import { sanitizeText, isValidId, clampInt } from '@/lib/security/sanitize';
import { secureLog } from '@/lib/security/logger';

// ─── GET: Fetch messages ────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;
  if (!isValidId(debateId)) return badRequest('Invalid debate ID.');

  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since') || undefined;
  const limit = clampInt(searchParams.get('limit'), 1, 200, 200);

  const debate = await getDebateById(debateId);
  if (!debate) {
    return NextResponse.json({ error: 'Debate not found.' }, { status: 404 });
  }

  const user = getSessionUser(request);
  const userId = user?.id || 'user-current';

  const messages = await getMessages(debateId, { since, limit });
  const config = getChatConfig(debateId);
  const stats = getChatStats(debateId);
  const pinned = await getPinnedMessages(debateId);
  const muted = isUserMuted(debateId, userId);

  return NextResponse.json({
    messages,
    pinned,
    config,
    stats,
    isMuted: muted,
    serverTime: new Date().toISOString(),
  });
}

// ─── POST: Send a message ───────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;
  if (!isValidId(debateId)) return badRequest('Invalid debate ID.');

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = user.id;
  const userName = user.displayName || 'User';

  // Rate limit chat messages
  const rl = chatLimiter.check(userId);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON.');
  }
  const { content, replyToId } = body;

  const debate = await getDebateById(debateId);
  if (!debate) {
    return NextResponse.json({ error: 'Debate not found.' }, { status: 404 });
  }

  // Sanitize content
  const safeContent = sanitizeText(content || '');
  if (safeContent.length === 0) return badRequest('Message cannot be empty.');
  if (safeContent.length > 2000) return badRequest('Message exceeds 2000 character limit.');

  // Validate replyToId if provided
  if (replyToId && !isValidId(replyToId)) return badRequest('Invalid reply ID.');

  const participant = debate.participants.find((p) => p.userId === userId);
  const side = participant?.side ?? null;

  const result = postMessage({
    debateId,
    userId,
    displayName: userName,
    content: safeContent,
    side,
    replyToId,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    filtered: result.filtered,
  });
}

// ─── DELETE: Clear all chat data ────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;
  if (!isValidId(debateId)) return badRequest('Invalid debate ID.');

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = user.id;

  const debate = await getDebateById(debateId);
  if (!debate) {
    return NextResponse.json({ error: 'Debate not found.' }, { status: 404 });
  }

  if (debate.creatorId !== userId) {
    return NextResponse.json({ error: 'Only the debate creator can clear chat data.' }, { status: 403 });
  }

  const result = clearChatData(debateId);
  secureLog.audit('chat_cleared', userId, { debateId, messagesDeleted: result.messagesDeleted });

  return NextResponse.json({
    success: true,
    cleared: result,
    message: `Cleared ${result.messagesDeleted} messages and ${result.mutesCleared} mutes.`,
  });
}

// ─── PATCH: Moderation actions ──────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;
  if (!isValidId(debateId)) return badRequest('Invalid debate ID.');

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = user.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON.');
  }
  const { action } = body;

  const debate = await getDebateById(debateId);
  if (!debate) {
    return NextResponse.json({ error: 'Debate not found.' }, { status: 404 });
  }

  const isCreator = debate.creatorId === userId;

  switch (action) {
    case 'delete_message': {
      const { messageId } = body;
      if (!messageId || !isValidId(messageId)) return badRequest('Valid messageId required.');
      const ok = deleteMessage(debateId, messageId, userId);
      if (!ok) return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
      secureLog.audit('message_deleted', userId, { debateId, messageId });
      return NextResponse.json({ success: true });
    }

    case 'pin_message': {
      if (!isCreator) return NextResponse.json({ error: 'Only the host can pin messages.' }, { status: 403 });
      const { messageId } = body;
      if (!messageId || !isValidId(messageId)) return badRequest('Valid messageId required.');
      pinMessage(debateId, messageId);
      return NextResponse.json({ success: true });
    }

    case 'react': {
      const { messageId, emoji } = body;
      if (!messageId || !isValidId(messageId)) return badRequest('Valid messageId required.');
      // Sanitize emoji — allow only common emoji characters, max 4 chars
      const safeEmoji = typeof emoji === 'string' ? emoji.slice(0, 4) : '';
      if (!safeEmoji) return badRequest('Valid emoji required.');
      addReaction(debateId, messageId, safeEmoji);
      return NextResponse.json({ success: true });
    }

    case 'mute_user': {
      if (!isCreator) return NextResponse.json({ error: 'Only the host can mute users.' }, { status: 403 });
      const { targetUserId, reason, durationMinutes } = body;
      if (!targetUserId || !isValidId(targetUserId)) return badRequest('Valid targetUserId required.');
      const safeReason = sanitizeText(reason || '').slice(0, 200);
      const safeDuration = clampInt(durationMinutes, 1, 1440, 60);
      const mute = muteUser(debateId, targetUserId, userId, { reason: safeReason, durationMinutes: safeDuration });
      postSystemMessage(debateId, 'A user has been muted by the host.');
      secureLog.audit('user_muted', userId, { debateId, targetUserId, reason: safeReason });
      return NextResponse.json({ success: true, mute });
    }

    case 'unmute_user': {
      if (!isCreator) return NextResponse.json({ error: 'Only the host can unmute users.' }, { status: 403 });
      const { targetUserId: unmuteTarget } = body;
      if (!unmuteTarget || !isValidId(unmuteTarget)) return badRequest('Valid targetUserId required.');
      // WARNING: Previously called muteUser() here — fixed to unmuteUser()
      unmuteUser(debateId, unmuteTarget);
      return NextResponse.json({ success: true });
    }

    case 'update_config': {
      if (!isCreator) return NextResponse.json({ error: 'Only the host can update chat settings.' }, { status: 403 });
      const { enabled, slowModeSeconds, subscribersOnly, autoClearOnEnd, retentionHours } = body;
      const config = updateChatConfig(debateId, {
        ...(enabled !== undefined && { enabled: !!enabled }),
        ...(slowModeSeconds !== undefined && { slowModeSeconds: clampInt(slowModeSeconds, 0, 300, 0) }),
        ...(subscribersOnly !== undefined && { subscribersOnly: !!subscribersOnly }),
        ...(autoClearOnEnd !== undefined && { autoClearOnEnd: !!autoClearOnEnd }),
        ...(retentionHours !== undefined && { retentionHours: clampInt(retentionHours, 1, 720, 24) }),
      });
      secureLog.audit('chat_config_updated', userId, { debateId });
      return NextResponse.json({ success: true, config });
    }

    default:
      return badRequest('Unknown action.');
  }
}
