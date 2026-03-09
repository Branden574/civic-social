// ═══════════════════════════════════════════════════════════════
// Civic Social — Debate Store (Server-Side Persistence)
// ═══════════════════════════════════════════════════════════════
//
// Manages debate rooms: creation, timer state, participants,
// invites, kicks, and stage progression.
//
// Uses Symbol.for on global for HMR persistence in dev.
// In production: Replace with DB operations.
// ═══════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type DebateStatus = 'waiting' | 'live' | 'paused' | 'completed';

export interface DebateSide {
  label: string;
  ideology: string;
}

export interface DebateParticipant {
  userId: string;
  displayName: string;
  side: 'A' | 'B';
  joinedAt: string;
}

export interface Debate {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  sideA: DebateSide;
  sideB: DebateSide;
  topics: string[];
  status: DebateStatus;

  // Timer
  durationMinutes: number;        // total allowed duration
  startedAt: string | null;       // ISO — when debate went live
  pausedAt: string | null;        // ISO — when paused (null if running)
  elapsedBeforePauseMs: number;   // accumulated ms from previous live segments
  completedAt: string | null;

  // Stage progression
  stages: string[];
  currentStageIndex: number;

  // Participants & spectators
  participants: DebateParticipant[];
  spectatorCount: number;

  // Creator controls
  invitedUserIds: string[];
  kickedUserIds: string[];

  // Scoring
  civilityScore: number;

  createdAt: string;
}

// ─── Global store ───────────────────────────────────────────────

const STORE_KEY = Symbol.for('civic.debate.store');

interface DebateStore {
  debates: Debate[];
  initialized: boolean;
}

interface GlobalWithStore {
  [key: symbol]: DebateStore | undefined;
}

const DEFAULT_STAGES = ['Opening', 'Rebuttal', 'Cross-Examination', 'Closing', 'Sources'];

function getStore(): DebateStore {
  const g = global as unknown as GlobalWithStore;
  if (!g[STORE_KEY] || !g[STORE_KEY]!.initialized) {
    g[STORE_KEY] = { debates: seedDebates(), initialized: true };
  }
  return g[STORE_KEY]!;
}

// ─── No seed/filler data — real debates only ────────────────────
// Mock debates removed. Store starts empty; populated by createDebate().

function seedDebates(): Debate[] {
  return [];
}

// ─── CRUD Operations ────────────────────────────────────────────

export function getAllDebates(): Debate[] {
  return getStore().debates;
}

export function getDebateById(id: string): Debate | null {
  return getStore().debates.find((d) => d.id === id) ?? null;
}

export function getPopularDebates(limit = 5): Debate[] {
  return [...getStore().debates]
    .filter((d) => d.status === 'live' || d.status === 'paused')
    .sort((a, b) => b.spectatorCount - a.spectatorCount)
    .slice(0, limit);
}

export function createDebate(input: {
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  sideA: DebateSide;
  sideB: DebateSide;
  topics: string[];
  durationMinutes: number;
  creatorSide: 'A' | 'B';
}): Debate {
  const store = getStore();
  const debate: Debate = {
    id: `debate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title,
    description: input.description,
    creatorId: input.creatorId,
    creatorName: input.creatorName,
    sideA: input.sideA,
    sideB: input.sideB,
    topics: input.topics,
    status: 'waiting',
    durationMinutes: input.durationMinutes,
    startedAt: null,
    pausedAt: null,
    elapsedBeforePauseMs: 0,
    completedAt: null,
    stages: DEFAULT_STAGES,
    currentStageIndex: 0,
    participants: [
      {
        userId: input.creatorId,
        displayName: input.creatorName,
        side: input.creatorSide,
        joinedAt: new Date().toISOString(),
      },
    ],
    spectatorCount: 0,
    invitedUserIds: [],
    kickedUserIds: [],
    civilityScore: 0,
    createdAt: new Date().toISOString(),
  };
  store.debates.unshift(debate);
  return debate;
}

// ─── Creator Actions ────────────────────────────────────────────

export function startDebate(debateId: string, userId: string): Debate | null {
  const debate = getDebateById(debateId);
  if (!debate || debate.creatorId !== userId) return null;
  if (debate.status !== 'waiting' && debate.status !== 'paused') return null;

  if (debate.status === 'paused' && debate.pausedAt) {
    // Resuming — accumulate time
    const pausedMs = Date.now() - new Date(debate.pausedAt).getTime();
    // Don't add paused time to elapsed (we're tracking live time only)
    debate.pausedAt = null;
  } else {
    // Fresh start
    debate.startedAt = new Date().toISOString();
  }
  debate.status = 'live';
  return debate;
}

export function pauseDebate(debateId: string, userId: string): Debate | null {
  const debate = getDebateById(debateId);
  if (!debate || debate.creatorId !== userId) return null;
  if (debate.status !== 'live') return null;

  // Accumulate elapsed time from this live segment
  if (debate.startedAt && !debate.pausedAt) {
    const liveSegmentMs = Date.now() - new Date(debate.startedAt).getTime() - debate.elapsedBeforePauseMs;
    // Actually, let's track total elapsed differently
    // elapsed = (now - startedAt) but we need to subtract paused intervals
    // Simpler: elapsedBeforePauseMs accumulates all live time before this pause
    debate.elapsedBeforePauseMs = Date.now() - new Date(debate.startedAt).getTime();
  }
  debate.pausedAt = new Date().toISOString();
  debate.status = 'paused';
  return debate;
}

export function stopDebate(debateId: string, userId: string): Debate | null {
  const debate = getDebateById(debateId);
  if (!debate || debate.creatorId !== userId) return null;
  if (debate.status === 'completed') return null;

  debate.status = 'completed';
  debate.completedAt = new Date().toISOString();
  debate.currentStageIndex = debate.stages.length - 1;
  return debate;
}

export function advanceStage(debateId: string, userId: string): Debate | null {
  const debate = getDebateById(debateId);
  if (!debate || debate.creatorId !== userId) return null;
  if (debate.status !== 'live') return null;
  if (debate.currentStageIndex >= debate.stages.length - 1) return null;

  debate.currentStageIndex++;
  return debate;
}

export function inviteToDebate(debateId: string, creatorId: string, targetUserId: string): boolean {
  const debate = getDebateById(debateId);
  if (!debate || debate.creatorId !== creatorId) return false;
  if (debate.kickedUserIds.includes(targetUserId)) return false;
  if (!debate.invitedUserIds.includes(targetUserId)) {
    debate.invitedUserIds.push(targetUserId);
  }
  return true;
}

export function kickFromDebate(debateId: string, creatorId: string, targetUserId: string): boolean {
  const debate = getDebateById(debateId);
  if (!debate || debate.creatorId !== creatorId) return false;
  if (targetUserId === creatorId) return false; // can't kick yourself

  // Remove from participants
  debate.participants = debate.participants.filter((p) => p.userId !== targetUserId);
  // Add to kicked list
  if (!debate.kickedUserIds.includes(targetUserId)) {
    debate.kickedUserIds.push(targetUserId);
  }
  // Remove from invited
  debate.invitedUserIds = debate.invitedUserIds.filter((id) => id !== targetUserId);
  return true;
}

export function joinDebate(debateId: string, userId: string, displayName: string, side: 'A' | 'B'): boolean {
  const debate = getDebateById(debateId);
  if (!debate) return false;
  if (debate.kickedUserIds.includes(userId)) return false;
  if (debate.participants.some((p) => p.userId === userId)) return false;

  debate.participants.push({
    userId,
    displayName,
    side,
    joinedAt: new Date().toISOString(),
  });
  return true;
}

export function incrementSpectators(debateId: string): void {
  const debate = getDebateById(debateId);
  if (debate) debate.spectatorCount++;
}

// ─── Timer helpers (pure functions for client use) ──────────────

/**
 * Calculate elapsed live time in milliseconds.
 * Excludes paused intervals.
 */
export function getElapsedMs(debate: Debate): number {
  if (!debate.startedAt) return 0;
  if (debate.status === 'completed') {
    if (debate.completedAt) {
      return new Date(debate.completedAt).getTime() - new Date(debate.startedAt).getTime();
    }
    return debate.elapsedBeforePauseMs;
  }
  if (debate.status === 'paused') {
    return debate.elapsedBeforePauseMs;
  }
  // Live — calculate from startedAt to now
  return Date.now() - new Date(debate.startedAt).getTime();
}

/**
 * Calculate remaining time in milliseconds.
 * Returns 0 if time is up.
 */
export function getRemainingMs(debate: Debate): number {
  const totalMs = debate.durationMinutes * 60 * 1000;
  const elapsed = getElapsedMs(debate);
  return Math.max(0, totalMs - elapsed);
}
