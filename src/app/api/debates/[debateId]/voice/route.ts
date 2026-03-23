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

  const debate = await getDebateById(debateId);
  if (!debate) {
    return NextResponse.json({ error: 'Debate not found.' }, { status: 404 });
  }

  const user = getSessionUser(request);
  const userId = user?.id ?? null;

  const room = await getVoiceRoom(debateId);
  // Only fetch signals for authenticated users (signals are addressed to specific userIds)
  const signals = room && userId ? await getSignals(debateId, userId) : [];

  // Debug: check signal addressing
  let debugTotalUnconsumed = 0;
  let debugForMe = 0;
  let debugTargets: string[] = [];
  if (room && userId) {
    try {
      const { prisma } = await import('@/lib/db');
      const unconsumed = await prisma.voiceSignal.findMany({
        where: { debateId, consumed: false },
        select: { toUserId: true, fromUserId: true, type: true },
        take: 10,
      });
      debugTotalUnconsumed = unconsumed.length;
      debugForMe = unconsumed.filter(s => s.toUserId === userId).length;
      debugTargets = [...new Set(unconsumed.map(s => `to:${s.toUserId.slice(-12)} from:${s.fromUserId.slice(-12)}`))];
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    room,
    signals,
    _debug: { myId: userId ?? 'NONE', signalsReturned: signals.length, totalUnconsumed: debugTotalUnconsumed, forMe: debugForMe, targets: debugTargets },
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
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = user.id;
  const userName = user.displayName || 'User';

  const rl = chatLimiter.check(userId);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

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

  switch (action) {
    case 'enable': {
      if (debate.creatorId !== userId) {
        return NextResponse.json({ error: 'Only the host can enable voice chat.' }, { status: 403 });
      }
      const maxSpeakers = Math.min(Math.max(body.maxSpeakers || 8, 2), 16);
      const room = await enableVoiceChat(debateId, userId, maxSpeakers);
      await joinVoiceRoom(debateId, userId, userName, false);
      secureLog.audit('voice_enabled', userId, { debateId });
      // Re-fetch room to include the host as participant
      const updatedRoom = await getVoiceRoom(debateId);
      return NextResponse.json({ success: true, room: updatedRoom || room });
    }

    case 'join': {
      const room = await getVoiceRoom(debateId);
      if (!room || !room.enabled) {
        return NextResponse.json({ error: 'Voice chat is not enabled for this debate.' }, { status: 400 });
      }

      const isDebateParticipant = debate.participants.some((p) => p.userId === userId);

      // Spectators can join as listen-only (no mic, receive streams only).
      // Debaters can join as speakers or listeners.
      // Cap spectator listeners to prevent mesh explosion (max 10 spectator listeners).
      if (!isDebateParticipant) {
        const spectatorListeners = room.participants.filter(
          (p) => p.role === 'listener' && !debate.participants.some((dp) => dp.userId === p.userId),
        );
        if (spectatorListeners.length >= 10) {
          return NextResponse.json(
            { error: 'Listener slots are full. Try again later.' },
            { status: 400 },
          );
        }
      }

      // Spectators always join as listeners; debaters can choose
      const asListener = !isDebateParticipant || body.asListener !== false;
      const participant = await joinVoiceRoom(debateId, userId, userName, asListener);

      if (!participant) {
        return NextResponse.json({ error: 'Could not join voice room.' }, { status: 400 });
      }

      return NextResponse.json({ success: true, participant, room: await getVoiceRoom(debateId) });
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
    case 'request_speak': {
      const ok = await requestToSpeak(debateId, userId);
      if (!ok) return NextResponse.json({ error: 'Could not request to speak.' }, { status: 400 });
      return NextResponse.json({ success: true, room: await getVoiceRoom(debateId) });
    }

    case 'grant_speak': {
      if (!isCreator) return NextResponse.json({ error: 'Only host can grant speaking.' }, { status: 403 });
      const { targetUserId } = body;
      if (!targetUserId || !isValidId(targetUserId)) return badRequest('Valid targetUserId required.');
      const ok = await grantSpeaking(debateId, userId, targetUserId);
      if (!ok) return NextResponse.json({ error: 'Could not grant speaking.' }, { status: 400 });
      return NextResponse.json({ success: true, room: await getVoiceRoom(debateId) });
    }

    case 'revoke_speak': {
      if (!isCreator) return NextResponse.json({ error: 'Only host can revoke speaking.' }, { status: 403 });
      const { targetUserId: revokeTarget } = body;
      if (!revokeTarget || !isValidId(revokeTarget)) return badRequest('Valid targetUserId required.');
      const ok = await revokeSpeaking(debateId, userId, revokeTarget);
      if (!ok) return NextResponse.json({ error: 'Could not revoke speaking.' }, { status: 400 });
      return NextResponse.json({ success: true, room: await getVoiceRoom(debateId) });
    }

    case 'toggle_mute': {
      await toggleSelfMute(debateId, userId);
      return NextResponse.json({ success: true, room: await getVoiceRoom(debateId) });
    }

    case 'server_mute': {
      if (!isCreator) return NextResponse.json({ error: 'Only host can server-mute.' }, { status: 403 });
      const { targetUserId: muteTarget } = body;
      if (!muteTarget || !isValidId(muteTarget)) return badRequest('Valid targetUserId required.');
      await serverMuteUser(debateId, userId, muteTarget);
      secureLog.audit('voice_server_mute', userId, { debateId, targetUserId: muteTarget });
      return NextResponse.json({ success: true, room: await getVoiceRoom(debateId) });
    }

    case 'mute_all': {
      if (!isCreator) return NextResponse.json({ error: 'Only host can mute all.' }, { status: 403 });
      await muteAll(debateId, userId);
      secureLog.audit('voice_mute_all', userId, { debateId });
      return NextResponse.json({ success: true, room: await getVoiceRoom(debateId) });
    }

    case 'signal': {
      const { toUserId, signalType, payload } = body;
      if (!toUserId || !isValidId(toUserId)) return badRequest('Valid toUserId required.');
      const validSignalTypes = ['offer', 'answer', 'ice-candidate', 'hangup'] as const;
      if (!signalType || !validSignalTypes.includes(signalType)) {
        return badRequest('signalType must be one of: offer, answer, ice-candidate, hangup.');
      }
      if (!payload) return badRequest('payload required.');
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      if (payloadStr.length > 65_000) return badRequest('Payload too large.');
      const signal = await postSignal(debateId, userId, toUserId, signalType, payloadStr);
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
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = user.id;

  const { searchParams } = new URL(request.url);
  const leaveOnly = searchParams.get('leave') === '1';

  const debate = await getDebateById(debateId);
  if (!debate) {
    return NextResponse.json({ error: 'Debate not found.' }, { status: 404 });
  }

  if (leaveOnly) {
    await leaveVoiceRoom(debateId, userId);
    return NextResponse.json({ success: true, action: 'left' });
  }

  if (debate.creatorId !== userId) {
    return NextResponse.json({ error: 'Only the host can disable voice chat.' }, { status: 403 });
  }

  await disableVoiceChat(debateId, userId);
  await clearVoiceRoom(debateId);
  secureLog.audit('voice_disabled', userId, { debateId });
  return NextResponse.json({ success: true, action: 'disabled' });
}
