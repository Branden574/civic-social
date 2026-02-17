// ═══════════════════════════════════════════════════════════════
// Civic Social — For You Algorithm (Pipeline Entry Point)
// ═══════════════════════════════════════════════════════════════
//
// Full ranking pipeline:
//
//   Candidates → Safety Filter → Score → Diversity Re-rank → Feed
//
// Usage:
//   const feed = generateFeed(candidates, user);
//   // feed[0].qualityScore     → highest ranked
//   // feed[0].explanation      → "Why am I seeing this?"
//   // feed[0].signals          → full signal breakdown
// ═══════════════════════════════════════════════════════════════

import type {
  FeedCandidate,
  AlgoUser,
  AlgorithmConfig,
  RankedPost,
} from './types';
import { DEFAULT_CONFIG } from './types';
import { scoreCandidates } from './scoring';
import { diversityRerank, computeFeedDiversityMetrics } from './diversity';
import type { FeedDiversityMetrics } from './diversity';

export interface FeedResult {
  posts: RankedPost[];
  diversity: FeedDiversityMetrics;
  totalCandidates: number;
  filteredCount: number;
}

/**
 * Generate the For You feed for a user.
 *
 * Pipeline:
 *   1. Safety filter — remove policy-violating content
 *   2. Score — compute quality score for each candidate
 *   3. Diversity re-rank — enforce viewpoint diversity
 *   4. Return with metrics
 */
export function generateFeed(
  candidates: FeedCandidate[],
  user: AlgoUser,
  config: AlgorithmConfig = DEFAULT_CONFIG,
  limit: number = 50,
): FeedResult {
  const totalCandidates = candidates.length;

  // ── Step 1: Safety filter ──────────────────────────────
  const safeCandidates = candidates.filter((c) => {
    // Remove obvious policy violations
    if (c.post.botLikelihood > 0.9) return false;
    if (c.post.flagCount > 20) return false;
    if (c.post.toxicityScore > 0.95) return false;
    return true;
  });

  const filteredCount = totalCandidates - safeCandidates.length;

  // ── Step 2: Score all candidates ───────────────────────
  const scored = scoreCandidates(safeCandidates, user, config);

  // ── Step 3: Diversity-aware re-ranking ─────────────────
  const diverseRanked = diversityRerank(scored, config.diversity);

  // ── Step 4: Trim to limit ──────────────────────────────
  const finalPosts = diverseRanked.slice(0, limit);

  // ── Compute feed-level metrics ─────────────────────────
  const diversity = computeFeedDiversityMetrics(finalPosts);

  return {
    posts: finalPosts,
    diversity,
    totalCandidates,
    filteredCount,
  };
}

// Re-export types for convenience
export type {
  FeedCandidate,
  AlgoUser,
  AlgorithmConfig,
  RankedPost,
  SignalScores,
  AlgoPost,
  AlgoThread,
  AlgoAuthor,
  AlgoSource,
} from './types';
export type { FeedDiversityMetrics } from './diversity';
export { DEFAULT_CONFIG } from './types';
export { scoreCandidate } from './scoring';
