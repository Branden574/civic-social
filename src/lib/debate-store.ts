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

// ─── Seed data (matches existing mock debates) ──────────────────

function seedDebates(): Debate[] {
  const now = Date.now();
  return [
    {
      id: 'debate-1',
      title: 'Should the US Adopt Universal Basic Income?',
      description: 'A structured debate on the merits and risks of implementing a UBI program in the United States.',
      creatorId: 'user-sarah',
      creatorName: 'Sarah Chen',
      sideA: { label: 'For UBI', ideology: 'center-left' },
      sideB: { label: 'Against UBI', ideology: 'center-right' },
      topics: ['economy', 'welfare', 'policy'],
      status: 'live',
      durationMinutes: 45,
      startedAt: new Date(now - 32 * 60 * 1000).toISOString(), // started 32 min ago
      pausedAt: null,
      elapsedBeforePauseMs: 0,
      completedAt: null,
      stages: DEFAULT_STAGES,
      currentStageIndex: 1, // Rebuttal
      participants: [
        { userId: 'user-sarah', displayName: 'Sarah Chen', side: 'A', joinedAt: new Date(now - 35 * 60 * 1000).toISOString() },
        { userId: 'user-elena', displayName: 'Dr. Elena Rodriguez', side: 'A', joinedAt: new Date(now - 34 * 60 * 1000).toISOString() },
        { userId: 'user-amara', displayName: 'Amara Okafor', side: 'A', joinedAt: new Date(now - 33 * 60 * 1000).toISOString() },
        { userId: 'user-marcus', displayName: 'Marcus Johnson', side: 'B', joinedAt: new Date(now - 35 * 60 * 1000).toISOString() },
        { userId: 'user-rachel', displayName: 'Rachel Thompson', side: 'B', joinedAt: new Date(now - 34 * 60 * 1000).toISOString() },
        { userId: 'user-michael', displayName: 'Prof. Michael Adler', side: 'B', joinedAt: new Date(now - 33 * 60 * 1000).toISOString() },
      ],
      spectatorCount: 234,
      invitedUserIds: [],
      kickedUserIds: [],
      civilityScore: 0.89,
      createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'debate-2',
      title: 'Is Nuclear Energy Essential for Climate Goals?',
      description: 'Examining whether nuclear power is a necessary component of the clean energy transition or if renewables alone can meet climate targets.',
      creatorId: 'user-elena',
      creatorName: 'Dr. Elena Rodriguez',
      sideA: { label: 'Nuclear is Essential', ideology: 'center' },
      sideB: { label: 'Renewables Suffice', ideology: 'left' },
      topics: ['climate', 'energy', 'science'],
      status: 'live',
      durationMinutes: 30,
      startedAt: new Date(now - 21 * 60 * 1000).toISOString(), // started 21 min ago
      pausedAt: null,
      elapsedBeforePauseMs: 0,
      completedAt: null,
      stages: DEFAULT_STAGES,
      currentStageIndex: 2, // Cross-Examination
      participants: [
        { userId: 'user-elena', displayName: 'Dr. Elena Rodriguez', side: 'A', joinedAt: new Date(now - 25 * 60 * 1000).toISOString() },
        { userId: 'user-michael', displayName: 'Prof. Michael Adler', side: 'A', joinedAt: new Date(now - 24 * 60 * 1000).toISOString() },
        { userId: 'user-amara', displayName: 'Amara Okafor', side: 'B', joinedAt: new Date(now - 24 * 60 * 1000).toISOString() },
        { userId: 'user-david', displayName: 'David Kim', side: 'B', joinedAt: new Date(now - 23 * 60 * 1000).toISOString() },
      ],
      spectatorCount: 189,
      invitedUserIds: [],
      kickedUserIds: [],
      civilityScore: 0.93,
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'debate-3',
      title: 'Should Social Media Companies Be Regulated as Utilities?',
      description: 'Debating whether major social media platforms should face utility-style regulation or if the free market should govern digital communication.',
      creatorId: 'user-marcus',
      creatorName: 'Marcus Johnson',
      sideA: { label: 'Regulate', ideology: 'center-left' },
      sideB: { label: 'Free Market', ideology: 'right' },
      topics: ['technology', 'regulation', 'free-speech'],
      status: 'waiting',
      durationMinutes: 40,
      startedAt: null,
      pausedAt: null,
      elapsedBeforePauseMs: 0,
      completedAt: null,
      stages: DEFAULT_STAGES,
      currentStageIndex: 0,
      participants: [
        { userId: 'user-marcus', displayName: 'Marcus Johnson', side: 'B', joinedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-sarah', displayName: 'Sarah Chen', side: 'A', joinedAt: new Date(now - 2.5 * 60 * 60 * 1000).toISOString() },
      ],
      spectatorCount: 78,
      invitedUserIds: ['user-elena', 'user-rachel'],
      kickedUserIds: [],
      civilityScore: 0,
      createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'debate-4',
      title: 'Immigration: Path to Citizenship vs. Merit-Based System',
      description: 'A deep dive into two competing visions for immigration reform in the United States.',
      creatorId: 'user-rachel',
      creatorName: 'Rachel Thompson',
      sideA: { label: 'Path to Citizenship', ideology: 'center-left' },
      sideB: { label: 'Merit-Based', ideology: 'center-right' },
      topics: ['immigration', 'policy', 'economy'],
      status: 'completed',
      durationMinutes: 45,
      startedAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      pausedAt: null,
      elapsedBeforePauseMs: 0,
      completedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      stages: DEFAULT_STAGES,
      currentStageIndex: 4,
      participants: [
        { userId: 'user-sarah', displayName: 'Sarah Chen', side: 'A', joinedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-elena', displayName: 'Dr. Elena Rodriguez', side: 'A', joinedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-david', displayName: 'David Kim', side: 'A', joinedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-rachel', displayName: 'Rachel Thompson', side: 'B', joinedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-marcus', displayName: 'Marcus Johnson', side: 'B', joinedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-michael', displayName: 'Prof. Michael Adler', side: 'B', joinedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString() },
      ],
      spectatorCount: 456,
      invitedUserIds: [],
      kickedUserIds: [],
      civilityScore: 0.86,
      createdAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'debate-5',
      title: 'Should the Electoral College Be Abolished?',
      description: 'Examining the case for and against the Electoral College in modern American democracy.',
      creatorId: 'user-michael',
      creatorName: 'Prof. Michael Adler',
      sideA: { label: 'Abolish', ideology: 'left' },
      sideB: { label: 'Keep', ideology: 'right' },
      topics: ['elections', 'constitution', 'democracy'],
      status: 'completed',
      durationMinutes: 60,
      startedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      pausedAt: null,
      elapsedBeforePauseMs: 0,
      completedAt: new Date(now - 23 * 60 * 60 * 1000).toISOString(),
      stages: DEFAULT_STAGES,
      currentStageIndex: 4,
      participants: [
        { userId: 'user-amara', displayName: 'Amara Okafor', side: 'A', joinedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-sarah', displayName: 'Sarah Chen', side: 'A', joinedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-david', displayName: 'David Kim', side: 'A', joinedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-michael', displayName: 'Prof. Michael Adler', side: 'B', joinedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-rachel', displayName: 'Rachel Thompson', side: 'B', joinedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString() },
        { userId: 'user-marcus', displayName: 'Marcus Johnson', side: 'B', joinedAt: new Date(now - 25 * 60 * 60 * 1000).toISOString() },
      ],
      spectatorCount: 567,
      invitedUserIds: [],
      kickedUserIds: [],
      civilityScore: 0.82,
      createdAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
    },
  ];
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
