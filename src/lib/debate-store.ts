// ═══════════════════════════════════════════════════════════════
// Civic Social — Debate Store (DB-Persisted + In-Memory Cache)
// ═══════════════════════════════════════════════════════════════
//
// Debates are persisted to PostgreSQL so they survive Vercel
// cold starts and are visible across all serverless instances.
//
// In-memory cache (per-instance) provides fast reads within the
// same process. Cache misses fall through to DB.
// ═══════════════════════════════════════════════════════════════

import { isDbAvailable, prisma } from '@/lib/db';

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
  durationMinutes: number;
  startedAt: string | null;
  pausedAt: string | null;
  elapsedBeforePauseMs: number;
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

// ─── In-memory cache (per serverless instance) ──────────────────

const CACHE_KEY = Symbol.for('civic.debate.cache');

interface DebateCache {
  debates: Map<string, Debate>;
}

function getCache(): DebateCache {
  const g = global as unknown as Record<symbol, DebateCache | undefined>;
  if (!g[CACHE_KEY]) {
    g[CACHE_KEY] = { debates: new Map() };
  }
  return g[CACHE_KEY]!;
}

const DEFAULT_STAGES = ['Opening', 'Rebuttal', 'Cross-Examination', 'Closing', 'Sources'];

// ─── DB ↔ Debate conversion ─────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDebate(row: any): Debate {
  let participants: DebateParticipant[] = [];
  try {
    participants = typeof row.participantsJson === 'string'
      ? JSON.parse(row.participantsJson)
      : [];
  } catch { /* fallback to empty */ }

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    sideA: { label: row.sideALabel, ideology: row.sideAIdeology || 'center' },
    sideB: { label: row.sideBLabel, ideology: row.sideBIdeology || 'center' },
    topics: row.topics || [],
    status: row.status as DebateStatus,
    durationMinutes: row.durationMinutes,
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    pausedAt: row.pausedAt ? new Date(row.pausedAt).toISOString() : null,
    elapsedBeforePauseMs: row.elapsedBeforePauseMs || 0,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    stages: row.stages?.length ? row.stages : DEFAULT_STAGES,
    currentStageIndex: row.currentStageIndex || 0,
    participants,
    spectatorCount: row.spectatorCount || 0,
    invitedUserIds: row.invitedUserIds || [],
    kickedUserIds: row.kickedUserIds || [],
    civilityScore: row.civilityScore || 0,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}

function debateToDbData(d: Debate) {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    creatorId: d.creatorId,
    creatorName: d.creatorName,
    sideALabel: d.sideA.label,
    sideAIdeology: d.sideA.ideology,
    sideBLabel: d.sideB.label,
    sideBIdeology: d.sideB.ideology,
    topics: d.topics,
    status: d.status,
    durationMinutes: d.durationMinutes,
    startedAt: d.startedAt ? new Date(d.startedAt) : null,
    pausedAt: d.pausedAt ? new Date(d.pausedAt) : null,
    elapsedBeforePauseMs: d.elapsedBeforePauseMs,
    completedAt: d.completedAt ? new Date(d.completedAt) : null,
    stages: d.stages,
    currentStageIndex: d.currentStageIndex,
    participantsJson: JSON.stringify(d.participants),
    spectatorCount: d.spectatorCount,
    invitedUserIds: d.invitedUserIds,
    kickedUserIds: d.kickedUserIds,
    civilityScore: d.civilityScore,
  };
}

/** Persist debate state to DB. Awaitable for critical mutations. */
async function persistDebate(debate: Debate, awaitDb = false): Promise<void> {
  getCache().debates.set(debate.id, debate);
  if (isDbAvailable()) {
    const data = debateToDbData(debate);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...updateData } = data;
    const op = prisma.debate.upsert({
      where: { id: debate.id },
      create: data,
      update: updateData,
    });
    if (awaitDb) {
      await op.catch(() => { /* DB write failed, cache is still correct */ });
    } else {
      op.catch(() => { /* best-effort */ });
    }
  }
}

// ─── CRUD Operations (async, DB-backed) ─────────────────────────

export async function getAllDebates(): Promise<Debate[]> {
  if (isDbAvailable()) {
    try {
      const rows = await prisma.debate.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      const debates = rows.map(rowToDebate);
      // Warm cache
      const cache = getCache();
      for (const d of debates) cache.debates.set(d.id, d);
      return debates;
    } catch { /* fall through to cache */ }
  }
  return Array.from(getCache().debates.values());
}

export async function getDebateById(id: string): Promise<Debate | null> {
  // 1. Check in-memory cache first (fast path)
  const cached = getCache().debates.get(id);
  if (cached) return cached;

  // 2. Check DB (handles cold starts / cross-instance lookups)
  if (isDbAvailable()) {
    try {
      const row = await prisma.debate.findUnique({ where: { id } });
      if (row) {
        const debate = rowToDebate(row);
        getCache().debates.set(id, debate);
        return debate;
      }
    } catch { /* DB unavailable */ }
  }

  return null;
}

export async function getPopularDebates(limit = 5): Promise<Debate[]> {
  if (isDbAvailable()) {
    try {
      const rows = await prisma.debate.findMany({
        where: { status: { in: ['live', 'paused'] } },
        orderBy: { spectatorCount: 'desc' },
        take: limit,
      });
      return rows.map(rowToDebate);
    } catch { /* fall through */ }
  }
  return Array.from(getCache().debates.values())
    .filter((d) => d.status === 'live' || d.status === 'paused')
    .sort((a, b) => b.spectatorCount - a.spectatorCount)
    .slice(0, limit);
}

export async function createDebate(input: {
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  sideA: DebateSide;
  sideB: DebateSide;
  topics: string[];
  durationMinutes: number;
  creatorSide: 'A' | 'B';
}): Promise<Debate> {
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

  // Cache immediately
  getCache().debates.set(debate.id, debate);

  // Persist to DB (await to ensure it's queryable before returning)
  if (isDbAvailable()) {
    try {
      await prisma.debate.create({ data: debateToDbData(debate) });
    } catch { /* cache still has it */ }
  }

  return debate;
}

// ─── Creator Actions (async, DB-synced) ─────────────────────────

export async function startDebate(debateId: string, userId: string): Promise<Debate | null> {
  const debate = await getDebateById(debateId);
  if (!debate || debate.creatorId !== userId) return null;
  if (debate.status !== 'waiting' && debate.status !== 'paused') return null;

  if (debate.status === 'paused' && debate.pausedAt) {
    debate.pausedAt = null;
  } else {
    debate.startedAt = new Date().toISOString();
  }
  debate.status = 'live';
  await persistDebate(debate, true);
  return debate;
}

export async function pauseDebate(debateId: string, userId: string): Promise<Debate | null> {
  const debate = await getDebateById(debateId);
  if (!debate || debate.creatorId !== userId) return null;
  if (debate.status !== 'live') return null;

  if (debate.startedAt && !debate.pausedAt) {
    debate.elapsedBeforePauseMs = Date.now() - new Date(debate.startedAt).getTime();
  }
  debate.pausedAt = new Date().toISOString();
  debate.status = 'paused';
  await persistDebate(debate, true);
  return debate;
}

export async function stopDebate(debateId: string, userId: string): Promise<Debate | null> {
  const debate = await getDebateById(debateId);
  if (!debate || debate.creatorId !== userId) return null;
  if (debate.status === 'completed') return null;

  debate.status = 'completed';
  debate.completedAt = new Date().toISOString();
  debate.currentStageIndex = debate.stages.length - 1;
  await persistDebate(debate, true);
  return debate;
}

export async function advanceStage(debateId: string, userId: string): Promise<Debate | null> {
  const debate = await getDebateById(debateId);
  if (!debate || debate.creatorId !== userId) return null;
  if (debate.status !== 'live') return null;
  if (debate.currentStageIndex >= debate.stages.length - 1) return null;

  debate.currentStageIndex++;
  persistDebate(debate);
  return debate;
}

export async function inviteToDebate(debateId: string, creatorId: string, targetUserId: string): Promise<boolean> {
  const debate = await getDebateById(debateId);
  if (!debate || debate.creatorId !== creatorId) return false;
  if (debate.kickedUserIds.includes(targetUserId)) return false;
  if (!debate.invitedUserIds.includes(targetUserId)) {
    debate.invitedUserIds.push(targetUserId);
  }
  persistDebate(debate);
  return true;
}

export async function kickFromDebate(debateId: string, creatorId: string, targetUserId: string): Promise<boolean> {
  const debate = await getDebateById(debateId);
  if (!debate || debate.creatorId !== creatorId) return false;
  if (targetUserId === creatorId) return false;

  debate.participants = debate.participants.filter((p) => p.userId !== targetUserId);
  if (!debate.kickedUserIds.includes(targetUserId)) {
    debate.kickedUserIds.push(targetUserId);
  }
  debate.invitedUserIds = debate.invitedUserIds.filter((id) => id !== targetUserId);
  await persistDebate(debate, true);
  return true;
}

export async function joinDebate(debateId: string, userId: string, displayName: string, side: 'A' | 'B'): Promise<boolean> {
  const debate = await getDebateById(debateId);
  if (!debate) return false;
  if (debate.kickedUserIds.includes(userId)) return false;
  if (debate.participants.some((p) => p.userId === userId)) return false;

  debate.participants.push({
    userId,
    displayName,
    side,
    joinedAt: new Date().toISOString(),
  });
  await persistDebate(debate, true);
  return true;
}

export async function incrementSpectators(debateId: string): Promise<void> {
  const debate = await getDebateById(debateId);
  if (debate) {
    debate.spectatorCount++;
    persistDebate(debate);
  }
}

// ─── Timer helpers (pure functions for client use) ──────────────

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
  return Date.now() - new Date(debate.startedAt).getTime();
}

export function getRemainingMs(debate: Debate): number {
  const totalMs = debate.durationMinutes * 60 * 1000;
  const elapsed = getElapsedMs(debate);
  return Math.max(0, totalMs - elapsed);
}
