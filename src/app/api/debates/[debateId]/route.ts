import { NextRequest, NextResponse } from 'next/server';
import {
  getDebateById,
  startDebate,
  pauseDebate,
  stopDebate,
  advanceStage,
  inviteToDebate,
  kickFromDebate,
  joinDebate,
  incrementSpectators,
} from '@/lib/debate-store';
import { getChatConfig, clearChatData, postSystemMessage } from '@/lib/chat-store';
import { clearVoiceRoom } from '@/lib/voice-signaling';
import { getSessionUser, getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { isValidId } from '@/lib/security/sanitize';
import { secureLog } from '@/lib/security/logger';
import { dbCreateNotification } from '@/lib/social-store';

// GET /api/debates/:debateId — get debate details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;
  if (!isValidId(debateId)) return badRequest('Invalid debate ID.');

  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const debate = getDebateById(debateId);
  if (!debate) {
    return NextResponse.json({ error: 'Debate not found.' }, { status: 404 });
  }
  return NextResponse.json({ debate, serverTime: new Date().toISOString() });
}

// PATCH /api/debates/:debateId — creator actions + participant actions
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;
  if (!isValidId(debateId)) return badRequest('Invalid debate ID.');

  const user = getSessionUser(request);
  // Spectate doesn't require auth; all other actions do
  const body = await request.json();
  const { action } = body;

  if (action !== 'spectate' && !user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const userId = user?.id ?? '';
  const userName = user?.displayName ?? 'Anonymous';

  switch (action) {
    case 'start': {
      const result = startDebate(debateId, userId);
      if (!result) return NextResponse.json({ error: 'Cannot start debate.' }, { status: 403 });
      postSystemMessage(debateId, result.status === 'live' ? 'The debate is now LIVE!' : 'Debate resumed.');
      secureLog.audit('debate_started', userId, { debateId });
      return NextResponse.json({ success: true, debate: result });
    }
    case 'pause': {
      const result = pauseDebate(debateId, userId);
      if (!result) return NextResponse.json({ error: 'Cannot pause debate.' }, { status: 403 });
      postSystemMessage(debateId, 'Debate paused by host.');
      secureLog.audit('debate_paused', userId, { debateId });
      return NextResponse.json({ success: true, debate: result });
    }
    case 'stop': {
      const result = stopDebate(debateId, userId);
      if (!result) return NextResponse.json({ error: 'Cannot stop debate.' }, { status: 403 });

      postSystemMessage(debateId, 'The debate has ended. Thank you for participating!');

      const chatConfig = getChatConfig(debateId);
      let chatCleared = false;
      if (chatConfig.autoClearOnEnd) {
        clearChatData(debateId);
        chatCleared = true;
      }

      clearVoiceRoom(debateId);
      secureLog.audit('debate_stopped', userId, { debateId, chatCleared });
      return NextResponse.json({ success: true, debate: result, chatCleared });
    }
    case 'advance_stage': {
      const result = advanceStage(debateId, userId);
      if (!result) return NextResponse.json({ error: 'Cannot advance stage.' }, { status: 403 });
      postSystemMessage(debateId, `Stage changed to: ${result.stages[result.currentStageIndex]}`);
      return NextResponse.json({ success: true, debate: result });
    }
    case 'invite': {
      const { targetUserId } = body;
      if (!targetUserId || !isValidId(targetUserId)) return badRequest('Valid targetUserId required.');
      const ok = inviteToDebate(debateId, userId, targetUserId);
      if (!ok) return NextResponse.json({ error: 'Cannot invite user.' }, { status: 403 });
      // Create notification for the invited user
      const debate = getDebateById(debateId);
      dbCreateNotification({
        recipientUserId: targetUserId,
        actorUserId: userId,
        type: 'debate_invite',
        entityType: 'debate',
        entityId: debateId,
        metadata: {
          actorName: userName,
          debateTitle: debate?.title || 'a debate',
        },
      });
      secureLog.audit('debate_invite', userId, { debateId, targetUserId });
      return NextResponse.json({ success: true });
    }
    case 'kick': {
      const { targetUserId: kickTarget } = body;
      if (!kickTarget || !isValidId(kickTarget)) return badRequest('Valid targetUserId required.');
      const ok = kickFromDebate(debateId, userId, kickTarget);
      if (!ok) return NextResponse.json({ error: 'Cannot kick user.' }, { status: 403 });
      secureLog.audit('user_kicked', userId, { debateId, targetUserId: kickTarget });
      const debate = getDebateById(debateId);
      return NextResponse.json({ success: true, debate });
    }
    case 'join': {
      const { side } = body;
      if (side !== 'A' && side !== 'B') return badRequest('Side must be A or B.');
      const ok = joinDebate(debateId, userId, userName, side);
      if (!ok) return NextResponse.json({ error: 'Cannot join debate.' }, { status: 403 });
      const debate = getDebateById(debateId);
      return NextResponse.json({ success: true, debate });
    }
    case 'spectate': {
      incrementSpectators(debateId);
      const debate = getDebateById(debateId);
      return NextResponse.json({ success: true, debate });
    }
    default:
      return badRequest('Unknown action.');
  }
}
