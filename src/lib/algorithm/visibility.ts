// ═══════════════════════════════════════════════════════════════
// Civic Social — Visibility Filter (X-Algorithm Port v1)
// ═══════════════════════════════════════════════════════════════
//
// Viewer-aware filter applied BEFORE ranking. Combines:
//   1. Safety rules     (bot, flag, tox — was inline in old pipeline)
//   2. Hard deletes     (tombstones from deleted-posts store)
//   3. Mutes            (UserMute — closes ARCHITECTURE.md:754 gap)
//   4. Blocks           (UserBlock — bidirectional hide)
//   5. Self-exclude     (don't show viewer their own posts in For You)
//
// Returns the filtered list plus a structured breakdown of what
// got dropped, for observability.
// ═══════════════════════════════════════════════════════════════

import { prisma, isDbAvailable } from '@/lib/db';
import type { FeedCandidate, AlgoUser } from './types';
import { getDeletedPostIds } from '@/lib/deleted-posts';

export interface VisibilityResult {
  safe: FeedCandidate[];
  dropped: {
    safety: number;
    deleted: number;
    muted: number;
    blocked: number;
    self: number;
  };
}

export interface VisibilityOptions {
  /** Skip the self-exclude rule (used on profile views). */
  includeSelf?: boolean;
}

/**
 * Fetch the viewer's mute + block author-id sets (union, both
 * directions for blocks so a blocked viewer also can't see the
 * blocker's posts).
 */
async function fetchHiddenAuthorIds(
  viewerId: string,
): Promise<{ muted: Set<string>; blocked: Set<string> }> {
  if (!isDbAvailable() || !prisma) {
    return { muted: new Set(), blocked: new Set() };
  }

  const now = new Date();

  const [muteRows, blockRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ mutedId: string }[]>(
      `SELECT "mutedId" FROM "UserMute"
       WHERE "muterId" = $1
         AND ("expiresAt" IS NULL OR "expiresAt" > $2)`,
      viewerId, now,
    ),
    prisma.$queryRawUnsafe<{ otherId: string }[]>(
      `SELECT "blockedId" AS "otherId" FROM "UserBlock" WHERE "blockerId" = $1
       UNION
       SELECT "blockerId" AS "otherId" FROM "UserBlock" WHERE "blockedId" = $1`,
      viewerId,
    ),
  ]);

  return {
    muted: new Set(muteRows.map((r) => r.mutedId)),
    blocked: new Set(blockRows.map((r) => r.otherId)),
  };
}

/**
 * Apply the safety + visibility filter to a candidate list.
 * Single pass through the candidates.
 */
export async function filterVisibility(
  candidates: FeedCandidate[],
  viewer: AlgoUser,
  opts: VisibilityOptions = {},
): Promise<VisibilityResult> {
  const [hidden] = await Promise.all([
    fetchHiddenAuthorIds(viewer.id),
  ]);
  const deletedIds = getDeletedPostIds();

  const dropped = { safety: 0, deleted: 0, muted: 0, blocked: 0, self: 0 };
  const safe: FeedCandidate[] = [];

  for (const c of candidates) {
    // Safety rules — most aggressive content always dropped
    if (
      c.post.botLikelihood > 0.9 ||
      c.post.flagCount > 20 ||
      c.post.toxicityScore > 0.95
    ) {
      dropped.safety += 1;
      continue;
    }
    if (deletedIds.has(c.post.id)) {
      dropped.deleted += 1;
      continue;
    }
    if (hidden.blocked.has(c.author.id)) {
      dropped.blocked += 1;
      continue;
    }
    if (hidden.muted.has(c.author.id)) {
      dropped.muted += 1;
      continue;
    }
    if (!opts.includeSelf && c.author.id === viewer.id) {
      dropped.self += 1;
      continue;
    }
    safe.push(c);
  }

  return { safe, dropped };
}
