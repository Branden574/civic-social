// ═══════════════════════════════════════════════════════════════
// Civic Social — Diversity-Aware Re-Ranking
// ═══════════════════════════════════════════════════════════════
//
// After scoring, the feed is re-ranked using a modified
// Maximal Marginal Relevance (MMR) approach adapted for
// civic discourse.
//
// The goal: ensure the user's feed is not an echo chamber.
//
// Constraints applied via sliding window:
//   1. No more than 60% of posts in any window of 5 share
//      the same political affiliation.
//   2. At least 1 cross-party interaction per window.
//   3. Thread types are mixed (not all debates or all news).
//
// The algorithm works greedily: for each position, pick the
// highest-scoring candidate that satisfies the diversity
// constraints. If no candidate satisfies all constraints,
// relax and pick the best available.
// ═══════════════════════════════════════════════════════════════

import type { RankedPost, DiversityConstraints } from './types';

/**
 * Re-rank a scored feed to enforce diversity constraints.
 *
 * Input:  posts sorted by qualityScore (descending).
 * Output: re-ordered list satisfying diversity constraints
 *         while keeping quality as high as possible.
 */
export function diversityRerank(
  rankedPosts: RankedPost[],
  constraints: DiversityConstraints,
): RankedPost[] {
  if (rankedPosts.length <= 1) return rankedPosts;

  const { windowSize, maxSameAffiliation, minCrossParty } = constraints;
  const result: RankedPost[] = [];
  const remaining = new Set(rankedPosts.map((_, i) => i));

  for (let position = 0; position < rankedPosts.length; position++) {
    // Get the current window (last `windowSize - 1` items in result)
    const windowStart = Math.max(0, result.length - (windowSize - 1));
    const currentWindow = result.slice(windowStart);

    // Find the best candidate that satisfies constraints
    let bestIdx = -1;
    let bestScore = -Infinity;
    let bestRelaxedIdx = -1;
    let bestRelaxedScore = -Infinity;

    for (const idx of remaining) {
      const candidate = rankedPosts[idx];
      const score = candidate.qualityScore;

      // Track best regardless of constraints (fallback)
      if (score > bestRelaxedScore) {
        bestRelaxedScore = score;
        bestRelaxedIdx = idx;
      }

      // Check constraints
      if (satisfiesConstraints(candidate, currentWindow, constraints, result)) {
        if (score > bestScore) {
          bestScore = score;
          bestIdx = idx;
        }
      }
    }

    // Use constrained pick if available, otherwise fallback
    const chosenIdx = bestIdx >= 0 ? bestIdx : bestRelaxedIdx;
    if (chosenIdx >= 0) {
      result.push(rankedPosts[chosenIdx]);
      remaining.delete(chosenIdx);
    }
  }

  return result;
}

/**
 * Check if adding a candidate to the current window
 * would satisfy all diversity constraints.
 *
 * v2 additions:
 *   - Constraint 4: Author concentration (max 2 posts per author in window)
 *   - Constraint 5: Recency spread (not all stale or all fresh)
 */
function satisfiesConstraints(
  candidate: RankedPost,
  currentWindow: RankedPost[],
  constraints: DiversityConstraints,
  fullResult: RankedPost[],
): boolean {
  const { windowSize, maxSameAffiliation, minCrossParty, threadTypeMix } =
    constraints;

  // If window isn't full yet, be lenient
  if (currentWindow.length < 2) return true;

  // ── Constraint 1: Affiliation concentration ───────────
  const candidateAffiliation =
    candidate.candidate.author.affiliations[0] || 'unknown';

  const windowAffiliations = currentWindow.map(
    (p) => p.candidate.author.affiliations[0] || 'unknown',
  );
  const allAffiliations = [...windowAffiliations, candidateAffiliation];

  // Count each affiliation
  const counts = new Map<string, number>();
  for (const aff of allAffiliations) {
    counts.set(aff, (counts.get(aff) || 0) + 1);
  }

  // Check if any single affiliation exceeds the max
  const totalInWindow = allAffiliations.length;
  for (const count of counts.values()) {
    if (count / totalInWindow > maxSameAffiliation) {
      return false;
    }
  }

  // ── Constraint 2: Cross-party minimum ─────────────────
  // In a full window, ensure at least `minCrossParty` distinct affiliations
  if (totalInWindow >= windowSize) {
    const uniqueAffiliations = new Set(allAffiliations);
    if (uniqueAffiliations.size < Math.min(minCrossParty + 1, totalInWindow)) {
      return false;
    }
  }

  // ── Constraint 3: Thread type mixing ──────────────────
  if (threadTypeMix && currentWindow.length >= 3) {
    const candidateType =
      candidate.candidate.thread?.type || 'OPEN_DISCUSSION';
    const recentTypes = currentWindow.slice(-3).map(
      (p) => p.candidate.thread?.type || 'OPEN_DISCUSSION',
    );

    // Don't allow 4 in a row of the same thread type
    if (recentTypes.every((t) => t === candidateType)) {
      return false;
    }
  }

  // ── Constraint 4: Author concentration (NEW v2) ───────
  // No more than 2 posts from the same author in the entire feed
  // (prevents one prolific author from dominating)
  const candidateAuthorId = candidate.candidate.author.id;
  const authorCountInFeed = fullResult.filter(
    (p) => p.candidate.author.id === candidateAuthorId,
  ).length;
  if (authorCountInFeed >= 2) {
    return false;
  }

  // ── Constraint 5: Recency spread (NEW v2) ─────────────
  // In a window of 5, don't allow all posts to be older than 48h.
  // This prevents stale cross-party posts from crowding out fresh content.
  if (currentWindow.length >= windowSize - 1) {
    const now = Date.now();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    const staleCount = currentWindow.filter(
      (p) => (now - p.candidate.post.createdAt.getTime()) > fortyEightHoursMs,
    ).length;
    const candidateIsStale =
      (now - candidate.candidate.post.createdAt.getTime()) > fortyEightHoursMs;

    // If all posts in window are stale, prefer a fresh one
    if (staleCount >= windowSize - 1 && candidateIsStale) {
      return false;
    }
  }

  return true;
}

/**
 * Compute feed diversity metrics for transparency.
 * These are shown to the user as part of the feed health indicator.
 */
export function computeFeedDiversityMetrics(feed: RankedPost[]): FeedDiversityMetrics {
  const affiliations = feed.map(
    (p) => p.candidate.author.affiliations[0] || 'unknown',
  );

  const affiliationCounts = new Map<string, number>();
  for (const aff of affiliations) {
    affiliationCounts.set(aff, (affiliationCounts.get(aff) || 0) + 1);
  }

  const total = feed.length || 1;
  const affiliationDistribution: Record<string, number> = {};
  for (const [aff, count] of affiliationCounts) {
    affiliationDistribution[aff] = count / total;
  }

  // Shannon entropy of affiliation distribution
  let entropy = 0;
  for (const fraction of Object.values(affiliationDistribution)) {
    if (fraction > 0) {
      entropy -= fraction * Math.log2(fraction);
    }
  }

  // Thread type variety
  const threadTypes = new Set(
    feed.map((p) => p.candidate.thread?.type || 'OPEN_DISCUSSION'),
  );

  // Cross-party threads (posts where thread has 2+ affiliations)
  const crossPartyCount = feed.filter(
    (p) =>
      p.candidate.thread &&
      new Set(p.candidate.thread.participantAffiliations).size >= 2,
  ).length;

  return {
    affiliationDistribution,
    shannonEntropy: entropy,
    maxPossibleEntropy: Math.log2(Math.max(affiliationCounts.size, 1)),
    diversityRatio:
      entropy / Math.log2(Math.max(affiliationCounts.size, 1)) || 0,
    threadTypeCount: threadTypes.size,
    crossPartyPercentage: crossPartyCount / total,
    totalPosts: feed.length,
  };
}

export interface FeedDiversityMetrics {
  affiliationDistribution: Record<string, number>;
  shannonEntropy: number;
  maxPossibleEntropy: number;
  diversityRatio: number;        // 0–1; 1 = perfect diversity
  threadTypeCount: number;
  crossPartyPercentage: number;
  totalPosts: number;
}
