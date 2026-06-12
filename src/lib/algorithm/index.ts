// ═══════════════════════════════════════════════════════════════
// Civic Social — For You Algorithm (Pipeline Entry Point)
// ═══════════════════════════════════════════════════════════════
//
// X-Algorithm Port v1 pipeline:
//
//   generateForYouFeed(viewerId)
//     ├─ candidates  ──── Prisma (StoredPost + matviews), 4 sources, ~1500
//     ├─ visibility  ──── mutes + blocks + safety + self
//     ├─ light rank  ──── 1500 → ~200 with cheap signals
//     ├─ heavy rank  ──── existing 6 signals + Real-Graph
//     └─ diversity   ──── existing MMR rerank
//
// The old synchronous `generateFeed(candidates, ...)` is retained
// as a "rank-these-candidates" helper used by cold-start and tests.
// ═══════════════════════════════════════════════════════════════

import type {
  FeedCandidate,
  AlgoUser,
  AlgorithmConfig,
  RankedPost,
  CandidateBudget,
  CandidateSourceResult,
} from './types';
import { DEFAULT_CONFIG, DEFAULT_CANDIDATE_BUDGET } from './types';
import { scoreCandidates, type ScoringContext } from './scoring';
import { diversityRerank, computeFeedDiversityMetrics } from './diversity';
import type { FeedDiversityMetrics } from './diversity';
import { generateCandidates } from './candidates';
import { filterVisibility } from './visibility';
import { lightRank } from './light-ranker';
import { fetchAffinityMap } from './real-graph';

export interface FeedResult {
  posts: RankedPost[];
  diversity: FeedDiversityMetrics;
  totalCandidates: number;
  filteredCount: number;
}

export interface ForYouFeedResult extends FeedResult {
  /** Per-source candidate telemetry (for debugging / observability). */
  sources: CandidateSourceResult[];
  /** Per-stage drop counts. */
  dropped: {
    safety: number;
    deleted: number;
    muted: number;
    blocked: number;
    self: number;
    lightRanker: number;
  };
  /** Stage timing in milliseconds. */
  timing: {
    candidates: number;
    visibility: number;
    lightRank: number;
    heavyRank: number;
    diversity: number;
    total: number;
  };
}

export interface GenerateForYouOptions {
  config?: AlgorithmConfig;
  budget?: CandidateBudget;
  /** Final feed size returned to the client. Default 50. */
  limit?: number;
  /** Number kept after light-rank narrowing. Default 200. */
  lightRankKeep?: number;
  /** Restrict every source to a hashtag. */
  hashtag?: string;
  /** "Following" tab — only in-network candidates. */
  followingOnly?: boolean;
}

/**
 * Full For-You pipeline. Async because candidate generation
 * and Real-Graph fetch hit Prisma.
 */
export async function generateForYouFeed(
  viewer: AlgoUser,
  opts: GenerateForYouOptions = {},
): Promise<ForYouFeedResult> {
  const config = opts.config ?? DEFAULT_CONFIG;
  const limit = opts.limit ?? 50;
  const lightRankKeep = opts.lightRankKeep ?? 200;
  const budget = opts.budget ?? DEFAULT_CANDIDATE_BUDGET;

  const t0 = Date.now();

  // ── Stage 1: Candidate generation ──────────────────────
  const tCand = Date.now();
  const { candidates, sources, total } = await generateCandidates(viewer, {
    budget,
    hashtag: opts.hashtag,
    followingOnly: opts.followingOnly,
  });
  const tCandDone = Date.now();

  // ── Stage 2: Visibility filter ─────────────────────────
  const { safe, dropped } = await filterVisibility(candidates, viewer);
  const tVisDone = Date.now();

  // ── Stage 3: Light rank (1500 → keep) ──────────────────
  const lightRanked = lightRank(safe, viewer, {
    keep: lightRankKeep,
    recencyHalfLifeHours: config.recencyHalfLifeHours,
  });
  const survivors = lightRanked.map((lr) => lr.candidate);
  const lightDropped = safe.length - survivors.length;
  const tLightDone = Date.now();

  // ── Stage 4: Heavy rank with Real-Graph ────────────────
  const authorIds = survivors.map((c) => c.author.id);
  const affinityMap = await fetchAffinityMap(viewer.id, authorIds);
  const heavyCtx: ScoringContext = { affinityMap };
  const scored = scoreCandidates(survivors, viewer, config, heavyCtx);
  const tHeavyDone = Date.now();

  // ── Stage 5: Diversity rerank (unchanged) ──────────────
  const diverseRanked = diversityRerank(scored, config.diversity);
  const finalPosts = diverseRanked.slice(0, limit);
  const tDivDone = Date.now();

  const diversity = computeFeedDiversityMetrics(finalPosts);
  const totalFiltered =
      dropped.safety + dropped.deleted + dropped.muted
    + dropped.blocked + dropped.self;

  return {
    posts: finalPosts,
    diversity,
    totalCandidates: total,
    filteredCount: totalFiltered,
    sources,
    dropped: { ...dropped, lightRanker: lightDropped },
    timing: {
      candidates: tCandDone - tCand,
      visibility: tVisDone - tCandDone,
      lightRank: tLightDone - tVisDone,
      heavyRank: tHeavyDone - tLightDone,
      diversity: tDivDone - tHeavyDone,
      total: Date.now() - t0,
    },
  };
}

/**
 * Legacy synchronous "rank these candidates" pipeline. Used by
 * cold-start (which has its own candidate selection logic) and
 * by tests. Same behavior as before the X-port — does NOT call
 * Real-Graph, light-ranker, or candidate generation.
 *
 * Pipeline: safety filter → score (6 signals) → diversity rerank.
 */
export function generateFeed(
  candidates: FeedCandidate[],
  user: AlgoUser,
  config: AlgorithmConfig = DEFAULT_CONFIG,
  limit: number = 50,
): FeedResult {
  const totalCandidates = candidates.length;

  const safeCandidates = candidates.filter((c) => {
    if (c.post.botLikelihood > 0.9) return false;
    if (c.post.flagCount > 20) return false;
    if (c.post.toxicityScore > 0.95) return false;
    return true;
  });

  const filteredCount = totalCandidates - safeCandidates.length;
  const scored = scoreCandidates(safeCandidates, user, config);
  const diverseRanked = diversityRerank(scored, config.diversity);
  const finalPosts = diverseRanked.slice(0, limit);
  const diversity = computeFeedDiversityMetrics(finalPosts);

  return { posts: finalPosts, diversity, totalCandidates, filteredCount };
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
  CandidateBudget,
  CandidateSourceResult,
  FeedCursor,
} from './types';
export type { FeedDiversityMetrics } from './diversity';
export { DEFAULT_CONFIG, DEFAULT_CANDIDATE_BUDGET } from './types';
export { scoreCandidate } from './scoring';
