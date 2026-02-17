// ═══════════════════════════════════════════════════════════════
// Civic Social — Debate Voice Chat API (Hardened)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  getVoiceRoom,
  enableVoiceChat,
  disableVoiceChat,
  joinVoiceRoom,
  leaveVoiceRoom,
  requestToSpeak,
  grantSpeaking,
  revokeSpeaking,
  toggleSelfMute,
  serverMuteUser,
  muteAll,
  postSignal,
  getSignals,
  clearVoiceRoom,
} from '@/lib/voice-signaling';
import { getDebateById } from '@/lib/debate-store';
import { getSessionUser, getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { readLimiter, chatLimiter } from '@/lib/security/rate-limiter';
import { isValidId } from '@/lib/security/sanitize';
import { secureLog } from '@/lib/security/logger';

// ─── GET: Room state + pending signals ──────────────────────────

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

  const user = getSessionUser(request);
  const userId = user?.id || 'user-current';

  const room = getVoiceRoom(debateId);
  const signals = room ? getSignals(debateId, userId) : [];

  return NextResponse.json({
    room,
    signals,
    serverTime: new Date().toISOString(),
  });
}

// ─── POST: Enable voice chat / join room ────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;
  if (!isValidId(debateId)) return badRequest('Invalid debate ID.');

  const user = getSessionUser(request);
  const userId = user?.id || 'user-current';
  const userName = user?.displayName || 'Branden Vincent-Walker';

  const rl = chatLimiter.check(userId);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const body = await request.json();
  const { action } = body;

  const debate = getDebateById(debateId);
  if (!debate) {
    return NextResponse.json({ error: 'Debate not found.' }, { status: 404 });
  }

  switch (action) {
    case 'enable': {
      if (debate.creatorId !== userId) {
        return NextResponse.json({ error: 'Only the host can enable voice chat.' }, { status: 403 });
      }
      const maxSpeakers = Math.min(Math.max(body.maxSpeakers || 8, 2), 16);
      const room = enableVoiceChat(debateId, userId, maxSpeakers);
      joinVoiceRoom(debateId, userId, userName, false);
      secureLog.audit('voice_enabled', userId, { debateId });
      return NextResponse.json({ success: true, room });
    }

    case 'join': {
      const room = getVoiceRoom(debateId);
      if (!room || !room.enabled) {
        return NextResponse.json({ error: 'Voice chat is not enabled for this debate.' }, { status: 400 });
      }

      const isDebateParticipant = debate.participants.some((p) => p.userId === userId);
      if (!isDebateParticipant) {
        return NextResponse.json(
          { error: 'Voice chat is available to debate participants only.' },
          { status: 403 },
        );
      }

      const asListener = body.asListener !== false;
      const participant = joinVoiceRoom(debateId, userId, userName, asListener);

      if (!participant) {
        return NextResponse.json({ error: 'Could not join voice room.' }, { status: 400 });
      }

      return NextResponse.json({ success: true, participant, room: getVoiceRoom(debateId) });
    }

    default:
      return badRequest('Unknown action.');
  }
}

// ─── PATCH: Voice actions ───────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;
  if (!isValidId(debateId)) return badRequest('Invalid debate ID.');

  const user = getSessionUser(request);
  const userId = user?.id || 'user-current';

  const body = await request.json();
  const { action } = body;

  const debate = getDebateById(debateId);
  if (!debate) {
    return NextResponse.json({ error: 'Debate not found.' }, { status: 404 });
  }

  const isCreator = debate.creatorId === userId;

  switch (action) {
    case 'request_speak': {
      const ok = requestToSpeak(debateId, userId);
      if (!ok) return NextResponse.json({ error: 'Could not request to speak.' }, { status: 400 });
      return NextResponse.json({ success: true, room: getVoiceRoom(debateId) });
    }

    case 'grant_speak': {
      if (!isCreator) return NextResponse.json({ error: 'Only host can grant speaking.' }, { status: 403 });
      const { targetUserId } = body;
      if (!targetUserId || !isValidId(targetUserId)) return badRequest('Valid targetUserId required.');
      const ok = grantSpeaking(debateId, userId, targetUserId);
      if (!ok) return NextResponse.json({ error: 'Could not grant speaking.' }, { status: 400 });
      return NextResponse.json({ success: true, room: getVoiceRoom(debateId) });
    }

    case 'revoke_speak': {
      if (!isCreator) return NextResponse.json({ error: 'Only host can revoke speaking.' }, { status: 403 });
      const { targetUserId: revokeTarget } = body;
      if (!revokeTarget || !isValidId(revokeTarget)) return badRequest('Valid targetUserId required.');
      const ok = revokeSpeaking(debateId, userId, revokeTarget);
      if (!ok) return NextResponse.json({ error: 'Could not revoke speaking.' }, { status: 400 });
      return NextResponse.json({ success: true, room: getVoiceRoom(debateId) });
    }

    case 'toggle_mute': {
      toggleSelfMute(debateId, userId);
      return NextResponse.json({ success: true, room: getVoiceRoom(debateId) });
    }

    case 'server_mute': {
      if (!isCreator) return NextResponse.json({ error: 'Only host can server-mute.' }, { status: 403 });
      const { targetUserId: muteTarget } = body;
      if (!muteTarget || !isValidId(muteTarget)) return badRequest('Valid targetUserId required.');
      serverMuteUser(debateId, userId, muteTarget);
      secureLog.audit('voice_server_mute', userId, { debateId, targetUserId: muteTarget });
      return NextResponse.json({ success: true, room: getVoiceRoom(debateId) });
    }

    case 'mute_all': {
      if (!isCreator) return NextResponse.json({ error: 'Only host can mute all.' }, { status: 403 });
      muteAll(debateId, userId);
      secureLog.audit('voice_mute_all', userId, { debateId });
      return NextResponse.json({ success: true, room: getVoiceRoom(debateId) });
    }

    case 'signal': {
      const { toUserId, signalType, payload } = body;
      if (!toUserId || !isValidId(toUserId)) return badRequest('Valid toUserId required.');
      const validSignalTypes = ['offer', 'answer', 'ice-candidate', 'hangup'] as const;
      if (!signalType || !validSignalTypes.includes(signalType)) {
        return badRequest('signalType must be one of: offer, answer, ice-candidate, hangup.');
      }
      if (!payload) return badRequest('payload required.');
      // Serialize payload to string and limit size
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      if (payloadStr.length > 10_000) return badRequest('Payload too large.');
      const signal = postSignal(debateId, userId, toUserId, signalType, payloadStr);
      return NextResponse.json({ success: true, signal });
    }

    default:
      return badRequest('Unknown action.');
  }
}

// ─── DELETE: Disable voice / leave room ─────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> },
) {
  const { debateId } = await params;
  if (!isValidId(debateId)) return badRequest('Invalid debate ID.');

  const user = getSessionUser(request);
  const userId = user?.id || 'user-current';

  const { searchParams } = new URL(request.url);
  const leaveOnly = searchParams.get('leave') === '1';

  const debate = getDebateById(debateId);
  if (!debate) {
    return NextResponse.json({ error: 'Debate not found.' }, { status: 404 });
  }

  if (leaveOnly) {
    leaveVoiceRoom(debateId, userId);
    return NextResponse.json({ success: true, action: 'left' });
  }

  if (debate.creatorId !== userId) {
    return NextResponse.json({ error: 'Only the host can disable voice chat.' }, { status: 403 });
  }

  disableVoiceChat(debateId, userId);
  clearVoiceRoom(debateId);
  secureLog.audit('voice_disabled', userId, { debateId });
  return NextResponse.json({ success: true, action: 'disabled' });
}
