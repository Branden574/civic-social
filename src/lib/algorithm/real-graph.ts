// ═══════════════════════════════════════════════════════════════
// Civic Social — Real-Graph affinity fetch (X-Algorithm Port v1)
// ═══════════════════════════════════════════════════════════════
//
// Pulls viewer↔author affinity rows from mv_real_graph_affinity
// in a single round-trip. Returns a Map keyed by authorId so the
// scoring engine can do O(1) lookups during the heavy-ranker pass.
//
// Falls back to an empty map when the DB is unavailable — the
// realGraph signal will then contribute 0 and other six signals
// drive ranking, exactly as before the port.
// ═══════════════════════════════════════════════════════════════

import { prisma, isDbAvailable } from '@/lib/db';

interface AffinityRow {
  authorId: string;
  affinity: number;
}

/**
 * Fetch affinity scores for a viewer against a set of candidate
 * author ids. Authors not present in the matview map to 0.
 */
export async function fetchAffinityMap(
  viewerId: string,
  authorIds: readonly string[],
): Promise<Map<string, number>> {
  if (!isDbAvailable() || !prisma || authorIds.length === 0) {
    return new Map();
  }

  const unique = Array.from(new Set(authorIds));

  try {
    const rows = await prisma.$queryRawUnsafe<AffinityRow[]>(
      `SELECT "authorId", "affinity"
       FROM "mv_real_graph_affinity"
       WHERE "viewerId" = $1
         AND "authorId" = ANY($2::text[])`,
      viewerId,
      unique,
    );
    return new Map(rows.map((r) => [r.authorId, r.affinity]));
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[real-graph] affinity fetch failed; defaulting to empty map', err);
    }
    return new Map();
  }
}
