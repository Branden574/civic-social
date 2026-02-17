// ═══════════════════════════════════════════════════════════════
// Civic Social — Server-Side Reaction & Feedback Store
// ═══════════════════════════════════════════════════════════════
//
// Tracks per-user reactions (agree/disagree/insightful/nuance)
// and optional feedback reasons. One reaction per user per post.
//
// In production: Replace with Prisma/DB operations.
// ═══════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────

export type ReactionType = 'agree' | 'disagree' | 'insightful' | 'nuance';

export interface Reaction {
  userId: string;
  postId: string;
  reaction: ReactionType;
  createdAt: string;
}

export interface ReactionFeedback {
  userId: string;
  postId: string;
  reaction: string;
  reasons: string[];
  notes: string;
  createdAt: string;
}

export interface ReactionCounts {
  agree: number;
  disagree: number;
  insightful: number;
  nuance: number;
}

// ─── Store ───────────────────────────────────────────────────

interface ReactionStore {
  /** Key: "userId:postId" */
  reactions: Map<string, Reaction>;
  feedback: ReactionFeedback[];
}

const STORE_KEY = Symbol.for('civic.reaction.store');

interface GlobalWithStore {
  [key: symbol]: ReactionStore | undefined;
}

function getStore(): ReactionStore {
  const g = global as unknown as GlobalWithStore;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { reactions: new Map(), feedback: [] };
  }
  return g[STORE_KEY]!;
}

function reactionKey(userId: string, postId: string): string {
  return `${userId}:${postId}`;
}

// ═══════════════════════════════════════════════════════════════
// REACTION CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * Toggle a reaction. Idempotent:
 * - Same reaction already set → removes it (toggle off)
 * - Different reaction set → switches to new one
 * - No reaction → adds it
 * Returns: the resulting reaction (or null if removed)
 */
export function toggleReaction(
  userId: string,
  postId: string,
  reaction: ReactionType,
): Reaction | null {
  const store = getStore();
  const key = reactionKey(userId, postId);
  const existing = store.reactions.get(key);

  if (existing && existing.reaction === reaction) {
    // Same reaction → toggle off
    store.reactions.delete(key);
    return null;
  }

  // Add or switch
  const newReaction: Reaction = {
    userId,
    postId,
    reaction,
    createdAt: new Date().toISOString(),
  };
  store.reactions.set(key, newReaction);
  return newReaction;
}

export function removeReaction(userId: string, postId: string): boolean {
  const store = getStore();
  return store.reactions.delete(reactionKey(userId, postId));
}

export function getViewerReaction(userId: string, postId: string): ReactionType | null {
  const store = getStore();
  const r = store.reactions.get(reactionKey(userId, postId));
  return r?.reaction ?? null;
}

/**
 * Count reactions for a post. These are ADDITIVE to the base
 * counts from mock data (which exist on the post itself).
 */
export function getReactionDeltas(postId: string): ReactionCounts {
  const store = getStore();
  const counts: ReactionCounts = { agree: 0, disagree: 0, insightful: 0, nuance: 0 };

  for (const r of store.reactions.values()) {
    if (r.postId === postId) {
      counts[r.reaction]++;
    }
  }
  return counts;
}

// ═══════════════════════════════════════════════════════════════
// FEEDBACK
// ═══════════════════════════════════════════════════════════════

export function addFeedback(input: {
  userId: string;
  postId: string;
  reaction: string;
  reasons: string[];
  notes?: string;
}): ReactionFeedback {
  const store = getStore();
  const fb: ReactionFeedback = {
    userId: input.userId,
    postId: input.postId,
    reaction: input.reaction,
    reasons: input.reasons,
    notes: input.notes || '',
    createdAt: new Date().toISOString(),
  };
  store.feedback.push(fb);
  return fb;
}

export function hasFeedbackForPost(userId: string, postId: string): boolean {
  return getStore().feedback.some(
    (fb) => fb.userId === userId && fb.postId === postId,
  );
}
