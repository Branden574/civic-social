// ═══════════════════════════════════════════════════════════════
// Civic Social — Voice Chat Signaling Store
// ═══════════════════════════════════════════════════════════════
//
// Server-side signaling layer for debate voice chat.
// In production, this would be backed by a WebSocket server
// and an SFU (Selective Forwarding Unit) like LiveKit, mediasoup,
// or Janus. For this implementation, we use a polling-based
// signaling approach that works with Next.js API routes.
//
// Architecture:
//   Client ↔ API Route (signaling) ↔ Voice Store
//   Client ↔ Client (WebRTC peer-to-peer for audio)
//
// The server manages:
//   - Voice room state (who's connected, who's muted)
//   - Request-to-speak queue
//   - Host controls (grant/revoke speaking, mute all)
//   - WebRTC signaling relay (offer/answer/ICE candidates)
//
// ═══════════════════════════════════════════════════════════════

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

// ─── Global store ───────────────────────────────────────────────

const STORE_KEY = Symbol.for('civic.voice.store');

interface VoiceStore {
  rooms: Map<string, VoiceRoom>;
  signals: Map<string, SignalingMessage[]>; // debateId → signals
  initialized: boolean;
}

interface GlobalWithStore {
  [key: symbol]: VoiceStore | undefined;
}

function getStore(): VoiceStore {
  const g = global as unknown as GlobalWithStore;
  if (!g[STORE_KEY] || !g[STORE_KEY]!.initialized) {
    g[STORE_KEY] = {
      rooms: new Map(),
      signals: new Map(),
      initialized: true,
    };
  }
  return g[STORE_KEY]!;
}

// ─── Room management ────────────────────────────────────────────

export function getVoiceRoom(debateId: string): VoiceRoom | null {
  return getStore().rooms.get(debateId) ?? null;
}

export function enableVoiceChat(
  debateId: string,
  creatorId: string,
  maxSpeakers: number = 8,
): VoiceRoom {
  const store = getStore();
  let room = store.rooms.get(debateId);

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
    store.rooms.set(debateId, room);
  } else {
    room.enabled = true;
  }

  return room;
}

export function disableVoiceChat(debateId: string, userId: string): boolean {
  const store = getStore();
  const room = store.rooms.get(debateId);
  if (!room || room.creatorId !== userId) return false;
  room.enabled = false;
  return true;
}

// ─── Participant management ─────────────────────────────────────

export function joinVoiceRoom(
  debateId: string,
  userId: string,
  displayName: string,
  asListener: boolean = true,
): VoiceParticipant | null {
  const store = getStore();
  const room = store.rooms.get(debateId);
  if (!room || !room.enabled) return null;

  // Already in room?
  const existing = room.participants.find((p) => p.userId === userId);
  if (existing) return existing;

  const participant: VoiceParticipant = {
    userId,
    displayName,
    role: asListener ? 'listener' : 'speaker',
    isMuted: true,              // start muted
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
  return participant;
}

export function leaveVoiceRoom(debateId: string, userId: string): boolean {
  const store = getStore();
  const room = store.rooms.get(debateId);
  if (!room) return false;

  room.participants = room.participants.filter((p) => p.userId !== userId);
  room.speakRequests = room.speakRequests.filter((id) => id !== userId);
  return true;
}

// ─── Speaking controls ──────────────────────────────────────────

export function requestToSpeak(debateId: string, userId: string): boolean {
  const store = getStore();
  const room = store.rooms.get(debateId);
  if (!room || !room.enabled) return false;

  const participant = room.participants.find((p) => p.userId === userId);
  if (!participant) return false;
  if (participant.role === 'speaker') return true; // already speaking

  // Add to queue if not already there
  if (!room.speakRequests.includes(userId)) {
    room.speakRequests.push(userId);
    participant.requestedSpeakAt = new Date().toISOString();
  }

  participant.role = 'pending';
  return true;
}

export function grantSpeaking(debateId: string, hostUserId: string, targetUserId: string): boolean {
  const store = getStore();
  const room = store.rooms.get(debateId);
  if (!room || room.creatorId !== hostUserId) return false;

  const participant = room.participants.find((p) => p.userId === targetUserId);
  if (!participant) return false;

  // Check speaker capacity
  const speakerCount = room.participants.filter((p) => p.role === 'speaker').length;
  if (speakerCount >= room.maxSpeakers) return false;

  participant.role = 'speaker';
  participant.isMuted = false;
  room.speakRequests = room.speakRequests.filter((id) => id !== targetUserId);
  return true;
}

export function revokeSpeaking(debateId: string, hostUserId: string, targetUserId: string): boolean {
  const store = getStore();
  const room = store.rooms.get(debateId);
  if (!room || room.creatorId !== hostUserId) return false;

  const participant = room.participants.find((p) => p.userId === targetUserId);
  if (!participant) return false;

  participant.role = 'listener';
  participant.isMuted = true;
  return true;
}

export function toggleSelfMute(debateId: string, userId: string): boolean {
  const store = getStore();
  const room = store.rooms.get(debateId);
  if (!room) return false;

  const participant = room.participants.find((p) => p.userId === userId);
  if (!participant) return false;

  participant.isMuted = !participant.isMuted;
  return true;
}

export function serverMuteUser(debateId: string, hostUserId: string, targetUserId: string): boolean {
  const store = getStore();
  const room = store.rooms.get(debateId);
  if (!room || room.creatorId !== hostUserId) return false;

  const participant = room.participants.find((p) => p.userId === targetUserId);
  if (!participant) return false;

  participant.isServerMuted = !participant.isServerMuted;
  return true;
}

export function muteAll(debateId: string, hostUserId: string): boolean {
  const store = getStore();
  const room = store.rooms.get(debateId);
  if (!room || room.creatorId !== hostUserId) return false;

  for (const p of room.participants) {
    if (p.userId !== hostUserId) {
      p.isServerMuted = true;
    }
  }
  return true;
}

// ─── Signaling relay ────────────────────────────────────────────

export function postSignal(
  debateId: string,
  fromUserId: string,
  toUserId: string,
  type: SignalingMessage['type'],
  payload: string,
): SignalingMessage {
  const store = getStore();
  if (!store.signals.has(debateId)) {
    store.signals.set(debateId, []);
  }

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

  store.signals.get(debateId)!.push(signal);

  // Cap signals at 1000 per debate
  const sigs = store.signals.get(debateId)!;
  if (sigs.length > 1000) {
    store.signals.set(debateId, sigs.slice(-500));
  }

  return signal;
}

export function getSignals(debateId: string, forUserId: string): SignalingMessage[] {
  const store = getStore();
  const sigs = store.signals.get(debateId) || [];

  // Get unconsumed signals for this user
  const pending = sigs.filter(
    (s) => !s.consumed && (s.toUserId === forUserId || s.toUserId === 'all') && s.fromUserId !== forUserId,
  );

  // Mark as consumed
  for (const s of pending) {
    s.consumed = true;
  }

  return pending;
}

// ─── Cleanup ────────────────────────────────────────────────────

export function clearVoiceRoom(debateId: string): void {
  const store = getStore();
  store.rooms.delete(debateId);
  store.signals.delete(debateId);
}
