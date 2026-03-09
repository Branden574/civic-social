// ═══════════════════════════════════════════════════════════════
// Civic Social — Voice Chat Signaling Store (DB-Backed)
// ═══════════════════════════════════════════════════════════════
//
// Server-side signaling layer for debate voice chat.
// All state is persisted to PostgreSQL so it works correctly
// across Vercel serverless instances (no in-memory state loss).
//
// Architecture:
//   Client ↔ API Route (signaling) ↔ DB (VoiceRoom + VoiceSignal)
//   Client ↔ Client (WebRTC peer-to-peer for audio/video)
//
// ═══════════════════════════════════════════════════════════════

import { isDbAvailable, prisma } from '@/lib/db';

// ─── Types ──────────────────────────────────────────────────────

export type VoiceRole = 'speaker' | 'listener' | 'pending';

export interface VoiceParticipant {
  userId: string;
  displayName: string;
  role: VoiceRole;
  isMuted: boolean;           // self-muted
  isServerMuted: boolean;     // muted by host
  joinedAt: string;
  requestedSpeakAt?: string;  // when they requested to speak
}

export interface VoiceRoom {
  debateId: string;
  enabled: boolean;            // host toggle
  creatorId: string;
  maxSpeakers: number;
  participants: VoiceParticipant[];
  speakRequests: string[];     // userId[] in order of request
  createdAt: string;
}

export interface SignalingMessage {
  id: string;
  debateId: string;
  fromUserId: string;
  toUserId: string;            // 'all' for broadcast
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup';
  payload: string;             // JSON-serialized SDP or ICE candidate
  createdAt: string;
  consumed: boolean;
}

// ─── DB ↔ VoiceRoom conversion ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVoiceRoom(row: any): VoiceRoom {
  let participants: VoiceParticipant[] = [];
  try {
    participants = typeof row.participantsJson === 'string'
      ? JSON.parse(row.participantsJson)
      : [];
  } catch { /* fallback to empty */ }

  return {
    debateId: row.id,
    enabled: row.enabled,
    creatorId: row.creatorId,
    maxSpeakers: row.maxSpeakers,
    participants,
    speakRequests: row.speakRequests || [],
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}

// ─── In-memory fallback (only when DB is unavailable) ──────────

const FALLBACK_KEY = Symbol.for('civic.voice.fallback');

interface FallbackStore {
  rooms: Map<string, VoiceRoom>;
  signals: Map<string, SignalingMessage[]>;
}

function getFallback(): FallbackStore {
  const g = global as unknown as Record<symbol, FallbackStore | undefined>;
  if (!g[FALLBACK_KEY]) {
    g[FALLBACK_KEY] = { rooms: new Map(), signals: new Map() };
  }
  return g[FALLBACK_KEY]!;
}

// ─── Room management ────────────────────────────────────────────

export async function getVoiceRoom(debateId: string): Promise<VoiceRoom | null> {
  if (isDbAvailable()) {
    try {
      const row = await prisma.voiceRoom.findUnique({ where: { id: debateId } });
      if (row) return rowToVoiceRoom(row);
      return null;
    } catch { /* fall through to fallback */ }
  }
  return getFallback().rooms.get(debateId) ?? null;
}

export async function enableVoiceChat(
  debateId: string,
  creatorId: string,
  maxSpeakers: number = 8,
): Promise<VoiceRoom> {
  if (isDbAvailable()) {
    try {
      const row = await prisma.voiceRoom.upsert({
        where: { id: debateId },
        create: {
          id: debateId,
          enabled: true,
          creatorId,
          maxSpeakers,
          participantsJson: '[]',
          speakRequests: [],
        },
        update: {
          enabled: true,
        },
      });
      return rowToVoiceRoom(row);
    } catch (err) {
      console.error('[voice] enableVoiceChat DB error:', err);
    }
  }

  // Fallback
  const fb = getFallback();
  let room = fb.rooms.get(debateId);
  if (!room) {
    room = {
      debateId,
      enabled: true,
      creatorId,
      maxSpeakers,
      participants: [],
      speakRequests: [],
      createdAt: new Date().toISOString(),
    };
    fb.rooms.set(debateId, room);
  } else {
    room.enabled = true;
  }
  return room;
}

export async function disableVoiceChat(debateId: string, userId: string): Promise<boolean> {
  if (isDbAvailable()) {
    try {
      const row = await prisma.voiceRoom.findUnique({ where: { id: debateId } });
      if (!row || row.creatorId !== userId) return false;
      await prisma.voiceRoom.update({
        where: { id: debateId },
        data: { enabled: false },
      });
      return true;
    } catch { /* fall through */ }
  }

  const room = getFallback().rooms.get(debateId);
  if (!room || room.creatorId !== userId) return false;
  room.enabled = false;
  return true;
}

// ─── Persist room helper ────────────────────────────────────────

async function persistRoom(room: VoiceRoom): Promise<void> {
  if (isDbAvailable()) {
    try {
      await prisma.voiceRoom.update({
        where: { id: room.debateId },
        data: {
          participantsJson: JSON.stringify(room.participants),
          speakRequests: room.speakRequests,
          enabled: room.enabled,
        },
      });
    } catch (err) {
      console.error('[voice] persistRoom DB error:', err);
    }
  }
  // Also update fallback cache
  getFallback().rooms.set(room.debateId, room);
}

// ─── Participant management ─────────────────────────────────────

export async function joinVoiceRoom(
  debateId: string,
  userId: string,
  displayName: string,
  asListener: boolean = true,
): Promise<VoiceParticipant | null> {
  const room = await getVoiceRoom(debateId);
  if (!room || !room.enabled) return null;

  // Already in room?
  const existing = room.participants.find((p) => p.userId === userId);
  if (existing) return existing;

  const participant: VoiceParticipant = {
    userId,
    displayName,
    role: asListener ? 'listener' : 'speaker',
    isMuted: true,
    isServerMuted: false,
    joinedAt: new Date().toISOString(),
  };

  // If joining as speaker, check capacity
  if (!asListener) {
    const speakerCount = room.participants.filter((p) => p.role === 'speaker').length;
    if (speakerCount >= room.maxSpeakers) {
      participant.role = 'listener';
    }
  }

  room.participants.push(participant);
  await persistRoom(room);
  return participant;
}

export async function leaveVoiceRoom(debateId: string, userId: string): Promise<boolean> {
  const room = await getVoiceRoom(debateId);
  if (!room) return false;

  room.participants = room.participants.filter((p) => p.userId !== userId);
  room.speakRequests = room.speakRequests.filter((id) => id !== userId);
  await persistRoom(room);
  return true;
}

// ─── Speaking controls ──────────────────────────────────────────

export async function requestToSpeak(debateId: string, userId: string): Promise<boolean> {
  const room = await getVoiceRoom(debateId);
  if (!room || !room.enabled) return false;

  const participant = room.participants.find((p) => p.userId === userId);
  if (!participant) return false;
  if (participant.role === 'speaker') return true;

  if (!room.speakRequests.includes(userId)) {
    room.speakRequests.push(userId);
    participant.requestedSpeakAt = new Date().toISOString();
  }

  participant.role = 'pending';
  await persistRoom(room);
  return true;
}

export async function grantSpeaking(debateId: string, hostUserId: string, targetUserId: string): Promise<boolean> {
  const room = await getVoiceRoom(debateId);
  if (!room || room.creatorId !== hostUserId) return false;

  const participant = room.participants.find((p) => p.userId === targetUserId);
  if (!participant) return false;

  const speakerCount = room.participants.filter((p) => p.role === 'speaker').length;
  if (speakerCount >= room.maxSpeakers) return false;

  participant.role = 'speaker';
  participant.isMuted = false;
  room.speakRequests = room.speakRequests.filter((id) => id !== targetUserId);
  await persistRoom(room);
  return true;
}

export async function revokeSpeaking(debateId: string, hostUserId: string, targetUserId: string): Promise<boolean> {
  const room = await getVoiceRoom(debateId);
  if (!room || room.creatorId !== hostUserId) return false;

  const participant = room.participants.find((p) => p.userId === targetUserId);
  if (!participant) return false;

  participant.role = 'listener';
  participant.isMuted = true;
  await persistRoom(room);
  return true;
}

export async function toggleSelfMute(debateId: string, userId: string): Promise<boolean> {
  const room = await getVoiceRoom(debateId);
  if (!room) return false;

  const participant = room.participants.find((p) => p.userId === userId);
  if (!participant) return false;

  participant.isMuted = !participant.isMuted;
  await persistRoom(room);
  return true;
}

export async function serverMuteUser(debateId: string, hostUserId: string, targetUserId: string): Promise<boolean> {
  const room = await getVoiceRoom(debateId);
  if (!room || room.creatorId !== hostUserId) return false;

  const participant = room.participants.find((p) => p.userId === targetUserId);
  if (!participant) return false;

  participant.isServerMuted = !participant.isServerMuted;
  await persistRoom(room);
  return true;
}

export async function muteAll(debateId: string, hostUserId: string): Promise<boolean> {
  const room = await getVoiceRoom(debateId);
  if (!room || room.creatorId !== hostUserId) return false;

  for (const p of room.participants) {
    if (p.userId !== hostUserId) {
      p.isServerMuted = true;
    }
  }
  await persistRoom(room);
  return true;
}

// ─── Signaling relay ────────────────────────────────────────────

export async function postSignal(
  debateId: string,
  fromUserId: string,
  toUserId: string,
  type: SignalingMessage['type'],
  payload: string,
): Promise<SignalingMessage> {
  const signal: SignalingMessage = {
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    debateId,
    fromUserId,
    toUserId,
    type,
    payload,
    createdAt: new Date().toISOString(),
    consumed: false,
  };

  if (isDbAvailable()) {
    try {
      const row = await prisma.voiceSignal.create({
        data: {
          debateId,
          fromUserId,
          toUserId,
          type,
          payload,
          consumed: false,
        },
      });
      signal.id = row.id;

      // Cleanup: delete consumed signals older than 30 seconds
      // Fire-and-forget to keep the table small
      const cutoff = new Date(Date.now() - 30_000);
      prisma.voiceSignal.deleteMany({
        where: {
          debateId,
          consumed: true,
          createdAt: { lt: cutoff },
        },
      }).catch(() => {});

      return signal;
    } catch (err) {
      console.error('[voice] postSignal DB error:', err);
    }
  }

  // Fallback: in-memory
  const fb = getFallback();
  if (!fb.signals.has(debateId)) {
    fb.signals.set(debateId, []);
  }
  fb.signals.get(debateId)!.push(signal);
  const sigs = fb.signals.get(debateId)!;
  if (sigs.length > 1000) {
    fb.signals.set(debateId, sigs.slice(-500));
  }
  return signal;
}

export async function getSignals(debateId: string, forUserId: string): Promise<SignalingMessage[]> {
  if (isDbAvailable()) {
    try {
      // Get unconsumed signals for this user
      const rows = await prisma.voiceSignal.findMany({
        where: {
          debateId,
          consumed: false,
          toUserId: { in: [forUserId, 'all'] },
          NOT: { fromUserId: forUserId },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      if (rows.length > 0) {
        // Mark as consumed
        await prisma.voiceSignal.updateMany({
          where: {
            id: { in: rows.map((r) => r.id) },
          },
          data: { consumed: true },
        });
      }

      return rows.map((r) => ({
        id: r.id,
        debateId: r.debateId,
        fromUserId: r.fromUserId,
        toUserId: r.toUserId,
        type: r.type as SignalingMessage['type'],
        payload: r.payload,
        createdAt: r.createdAt.toISOString(),
        consumed: true,
      }));
    } catch (err) {
      console.error('[voice] getSignals DB error:', err);
    }
  }

  // Fallback: in-memory
  const fb = getFallback();
  const sigs = fb.signals.get(debateId) || [];
  const pending = sigs.filter(
    (s) => !s.consumed && (s.toUserId === forUserId || s.toUserId === 'all') && s.fromUserId !== forUserId,
  );
  for (const s of pending) {
    s.consumed = true;
  }
  return pending;
}

// ─── Cleanup ────────────────────────────────────────────────────

export async function clearVoiceRoom(debateId: string): Promise<void> {
  if (isDbAvailable()) {
    try {
      await Promise.all([
        prisma.voiceRoom.delete({ where: { id: debateId } }).catch(() => {}),
        prisma.voiceSignal.deleteMany({ where: { debateId } }),
      ]);
    } catch { /* ignore */ }
  }
  const fb = getFallback();
  fb.rooms.delete(debateId);
  fb.signals.delete(debateId);
}
