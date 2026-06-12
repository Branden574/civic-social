// ═══════════════════════════════════════════════════════════════
// Civic Social — Cold-Start Feed Engine v2
// ═══════════════════════════════════════════════════════════════
//
// Refined algorithm implementing the ranking formula:
//
//   Score(p,u) = W_qual·Q(p) + W_rel·R(p,u) + W_trust·T(p,u)
//              + W_div·D(p,u)  - W_risk·K(p,u)
//
//   FinalScore = Score × e^(-λ × ageHours)
//
// Phase system:
//   Phase 0 (first session): onboarding seeds only
//   Phase 1 (days 1-3, <N interactions): mixed curation + exploration
//   Phase 2 (after signals): gradual personalization increase
//
// Feed quotas:
//   45% topic-matched posts
//   20% civic news discussions
//   15% legislative / bill discussions
//   10% local/country relevance
//   10% cross-party high-civility
//
// ═══════════════════════════════════════════════════════════════

import type { FeedCandidate, AlgoUser, AlgorithmConfig, RankedPost } from './types';
import { DEFAULT_CONFIG } from './types';
import { scoreCandidates } from './scoring';
import { diversityRerank, computeFeedDiversityMetrics } from './diversity';
import type { FeedDiversityMetrics } from './diversity';

// ─── Types ───────────────────────────────────────────────────

export interface ColdStartProfile {
  topics: string[];
  country: string;
  affiliation: string;
  daysSinceSignup: number;
  interactionCount?: number;  // total interactions so far
}

export interface ColdStartFeedResult {
  posts: RankedPost[];
  diversity: FeedDiversityMetrics;
  totalCandidates: number;
  filteredCount: number;
  coldStartActive: boolean;
  warmupProgress: number;
  phase: 0 | 1 | 2;
}

// ─── Feed quota configuration ────────────────────────────────

const FEED_QUOTAS = {
  topic: 0.45,      // 45% topic-matched
  news: 0.20,       // 20% civic news
  bills: 0.15,      // 15% legislative
  local: 0.10,      // 10% local/country
  crossParty: 0.10, // 10% cross-party
} as const;

// ─── Cold-start configuration by phase ───────────────────────

const PHASE_CONFIGS: Record<0 | 1 | 2, AlgorithmConfig> = {
  // Phase 0: first session — maximum curation, minimal personalization.
  // realGraph stays 0 — new users have no interaction history yet.
  0: {
    weights: {
      engagementQuality: 0.05,
      civility: 0.35,
      viewpointDiversity: 0.25,
      sourceCredibility: 0.25,
      topicRelevance: 0.05,
      authorReputation: 0.05,
      realGraph: 0.00,
    },
    diversity: {
      windowSize: 3,
      maxSameAffiliation: 0.3,
      minCrossParty: 2,
      threadTypeMix: true,
    },
    recencyHalfLifeHours: 72,
    penaltyMultiplier: 3.0,
  },
  // Phase 1: days 1-3 or <50 interactions — mixed curation + early signals.
  // realGraph weak — limited interaction history.
  1: {
    weights: {
      engagementQuality: 0.10,
      civility: 0.30,
      viewpointDiversity: 0.18,
      sourceCredibility: 0.20,
      topicRelevance: 0.15,
      authorReputation: 0.05,
      realGraph: 0.02,
    },
    diversity: {
      windowSize: 4,
      maxSameAffiliation: 0.4,
      minCrossParty: 2,
      threadTypeMix: true,
    },
    recencyHalfLifeHours: 48,
    penaltyMultiplier: 2.5,
  },
  // Phase 2: after early signals — gradual personalization increase.
  2: {
    weights: {
      engagementQuality: 0.18,
      civility: 0.25,
      viewpointDiversity: 0.15,
      sourceCredibility: 0.15,
      topicRelevance: 0.17,
      authorReputation: 0.05,
      realGraph: 0.05,
    },
    diversity: {
      windowSize: 5,
      maxSameAffiliation: 0.45,
      minCrossParty: 1,
      threadTypeMix: true,
    },
    recencyHalfLifeHours: 36,
    penaltyMultiplier: 2.0,
  },
};

// ─── Determine current phase ─────────────────────────────────

function determinePhase(profile: ColdStartProfile): 0 | 1 | 2 {
  const interactions = profile.interactionCount ?? 0;
  const days = profile.daysSinceSignup;

  // Phase 0: first session (day 0 with no interactions)
  if (days === 0 && interactions < 5) return 0;

  // Phase 1: days 1-3 or fewer than 50 interactions
  if (days <= 3 || interactions < 50) return 1;

  // Phase 2: accumulating signals
  return 2;
}

// ─── Quality gates for new user content ──────────────────────

function applyNewUserQualityGates(
  candidates: FeedCandidate[],
  phase: 0 | 1 | 2,
): { passed: FeedCandidate[]; blocked: number } {
  // Phase 0 has strictest gates; phase 2 is more relaxed
  const toxicityThreshold = phase === 0 ? 0.3 : phase === 1 ? 0.4 : 0.5;
  const rageBaitThreshold = phase === 0 ? 0.2 : phase === 1 ? 0.3 : 0.4;
  const minCivility = phase === 0 ? 0.6 : phase === 1 ? 0.5 : 0.4;
  const minLength = phase === 0 ? 50 : 30;

  const passed = candidates.filter((c) => {
    if (c.post.toxicityScore > toxicityThreshold) return false;
    if (c.post.rageBaitScore > rageBaitThreshold) return false;
    if (c.post.botLikelihood > 0.5) return false;
    if (c.post.flagCount > (phase === 0 ? 3 : 5)) return false;
    if (c.post.allCapsRatio > 0.3) return false;
    if (c.post.civilityScore < minCivility) return false;
    if (c.post.content.length < minLength) return false;
    return true;
  });

  return { passed, blocked: candidates.length - passed.length };
}

// ─── Relevance scoring for cold start ────────────────────────
// R(p,u) = 0.6·topicMatch + 0.25·countryMatch + 0.15·languageMatch

function relevanceColdStart(
  candidate: FeedCandidate,
  userTopics: string[],
  userCountry: string,
): number {
  const topicSet = new Set(userTopics);
  const overlap = candidate.post.topics.filter((t) => topicSet.has(t)).length;
  const topicMatch = userTopics.length > 0 ? overlap / userTopics.length : 0.3;

  // Country match (mock — compare author's known region)
  const countryMatch = 0.5; // Default partial match for mock data

  // Language match (always English in mock)
  const languageMatch = 1.0;

  return 0.6 * topicMatch + 0.25 * countryMatch + 0.15 * languageMatch;
}

// ─── Topic-based ordering ────────────────────────────────────

function selectByTopicAffinity(
  candidates: FeedCandidate[],
  userTopics: string[],
): FeedCandidate[] {
  if (userTopics.length === 0) return candidates;

  const topicSet = new Set(userTopics);

  const scored = candidates.map((c) => {
    const overlap = c.post.topics.filter((t) => topicSet.has(t)).length;
    const topicScore = overlap / Math.max(userTopics.length, 1);
    return { candidate: c, topicScore };
  });

  scored.sort((a, b) => b.topicScore - a.topicScore);
  return scored.map((s) => s.candidate);
}

// ─── Categorize candidates into pools ────────────────────────

interface CandidatePools {
  topic: FeedCandidate[];
  news: FeedCandidate[];
  bills: FeedCandidate[];
  local: FeedCandidate[];
  crossParty: FeedCandidate[];
}

function categorizeCandidates(
  candidates: FeedCandidate[],
  userTopics: string[],
  userAffiliation: string,
): CandidatePools {
  const topicSet = new Set(userTopics);

  const pools: CandidatePools = {
    topic: [],
    news: [],
    bills: [],
    local: [],
    crossParty: [],
  };

  for (const c of candidates) {
    const threadType = c.thread?.type || '';
    const authorAff = c.author.affiliations[0] || '';
    const topicOverlap = c.post.topics.some((t) => topicSet.has(t));

    // News discussion posts
    if (threadType === 'NEWS_DISCUSSION' || c.post.topics.includes('civic-news')) {
      pools.news.push(c);
    }
    // Legislative / policy posts
    else if (threadType === 'POLICY_PROPOSAL' || c.post.topics.some((t) =>
      ['legislation', 'bill', 'policy', 'law', 'congress', 'senate'].includes(t),
    )) {
      pools.bills.push(c);
    }
    // Cross-party high civility
    else if (
      userAffiliation &&
      authorAff !== userAffiliation &&
      c.post.civilityScore >= 0.7 &&
      c.post.sources.length > 0
    ) {
      pools.crossParty.push(c);
    }
    // Topic-matched
    else if (topicOverlap) {
      pools.topic.push(c);
    }
    // Everything else goes to local
    else {
      pools.local.push(c);
    }
  }

  return pools;
}

// ─── Assemble feed with quotas ───────────────────────────────

function assembleWithQuotas(
  pools: CandidatePools,
  scored: RankedPost[],
  limit: number,
): RankedPost[] {
  const scoredMap = new Map(scored.map((rp) => [rp.candidate.post.id, rp]));
  const used = new Set<string>();
  const result: RankedPost[] = [];

  function takeFromPool(pool: FeedCandidate[], count: number) {
    let taken = 0;
    // Sort pool by their score if available
    const sorted = pool
      .map((c) => scoredMap.get(c.post.id))
      .filter((rp): rp is RankedPost => !!rp && !used.has(rp.candidate.post.id))
      .sort((a, b) => b.qualityScore - a.qualityScore);

    for (const rp of sorted) {
      if (taken >= count) break;
      result.push(rp);
      used.add(rp.candidate.post.id);
      taken++;
    }
  }

  // Fill by quotas
  takeFromPool(pools.topic, Math.ceil(limit * FEED_QUOTAS.topic));
  takeFromPool(pools.news, Math.ceil(limit * FEED_QUOTAS.news));
  takeFromPool(pools.bills, Math.ceil(limit * FEED_QUOTAS.bills));
  takeFromPool(pools.local, Math.ceil(limit * FEED_QUOTAS.local));
  takeFromPool(pools.crossParty, Math.ceil(limit * FEED_QUOTAS.crossParty));

  // Fill remaining slots from highest-scored unused
  if (result.length < limit) {
    const remaining = scored
      .filter((rp) => !used.has(rp.candidate.post.id))
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, limit - result.length);
    result.push(...remaining);
  }

  return result;
}

// ─── Enforce diversity constraints ───────────────────────────

function enforceDiversityConstraints(posts: RankedPost[]): RankedPost[] {
  const result: RankedPost[] = [];
  const authorCounts = new Map<string, number>();
  const topicsUsed = new Set<string>();

  for (const rp of posts) {
    const authorId = rp.candidate.author.id;
    const count = authorCounts.get(authorId) || 0;

    // Max 2 posts per author per 20
    if (count >= 2 && result.length < 20) continue;

    result.push(rp);
    authorCounts.set(authorId, count + 1);
    rp.candidate.post.topics.forEach((t) => topicsUsed.add(t));
  }

  return result;
}

// ─── Compute warmup progress ─────────────────────────────────

function computeWarmupProgress(profile: ColdStartProfile): number {
  const daysFactor = Math.min(profile.daysSinceSignup / 7, 1.0);
  const interactionFactor = Math.min((profile.interactionCount ?? 0) / 100, 1.0);
  // Weight both: days matter less if user is very active
  return Math.min(0.6 * daysFactor + 0.4 * interactionFactor, 1.0);
}

// ─── Blend cold-start and standard configs ───────────────────

function blendConfigs(phaseConfig: AlgorithmConfig, warmup: number): AlgorithmConfig {
  if (warmup >= 1.0) return DEFAULT_CONFIG;
  if (warmup <= 0.0) return phaseConfig;

  const blend = (cold: number, standard: number) =>
    cold * (1 - warmup) + standard * warmup;

  return {
    weights: {
      engagementQuality: blend(phaseConfig.weights.engagementQuality, DEFAULT_CONFIG.weights.engagementQuality),
      civility: blend(phaseConfig.weights.civility, DEFAULT_CONFIG.weights.civility),
      viewpointDiversity: blend(phaseConfig.weights.viewpointDiversity, DEFAULT_CONFIG.weights.viewpointDiversity),
      sourceCredibility: blend(phaseConfig.weights.sourceCredibility, DEFAULT_CONFIG.weights.sourceCredibility),
      topicRelevance: blend(phaseConfig.weights.topicRelevance, DEFAULT_CONFIG.weights.topicRelevance),
      authorReputation: blend(phaseConfig.weights.authorReputation, DEFAULT_CONFIG.weights.authorReputation),
      realGraph: blend(phaseConfig.weights.realGraph, DEFAULT_CONFIG.weights.realGraph),
    },
    diversity: warmup < 0.5 ? phaseConfig.diversity : DEFAULT_CONFIG.diversity,
    recencyHalfLifeHours: blend(phaseConfig.recencyHalfLifeHours, DEFAULT_CONFIG.recencyHalfLifeHours),
    penaltyMultiplier: blend(phaseConfig.penaltyMultiplier, DEFAULT_CONFIG.penaltyMultiplier),
  };
}

// ═══════════════════════════════════════════════════════════════
// Main entry point: generateColdStartFeed
// ═══════════════════════════════════════════════════════════════

export function generateColdStartFeed(
  candidates: FeedCandidate[],
  user: AlgoUser,
  coldStartProfile: ColdStartProfile,
  limit: number = 50,
): ColdStartFeedResult {
  const totalCandidates = candidates.length;

  // ── Determine phase ──────────────────────────────────
  const phase = determinePhase(coldStartProfile);
  const warmup = computeWarmupProgress(coldStartProfile);
  const phaseConfig = PHASE_CONFIGS[phase];

  // ── Step 1: Aggressive quality gates ─────────────────
  const { passed, blocked } = applyNewUserQualityGates(candidates, phase);

  // ── Step 2: Topic-based starter pack ordering ────────
  const topicOrdered = selectByTopicAffinity(passed, coldStartProfile.topics);

  // ── Step 3: Categorize into pools ────────────────────
  const pools = categorizeCandidates(
    topicOrdered,
    coldStartProfile.topics,
    coldStartProfile.affiliation,
  );

  // ── Step 4: Blend algorithm config based on warmup ───
  const blendedConfig = blendConfigs(phaseConfig, warmup);

  // ── Step 5: Score all candidates with blended config ─
  const scored = scoreCandidates(topicOrdered, user, blendedConfig);

  // ── Step 6: Assemble feed with quotas ────────────────
  const quotaFeed = assembleWithQuotas(pools, scored, limit);

  // ── Step 7: Diversity-aware re-ranking ───────────────
  const diverseRanked = diversityRerank(quotaFeed, blendedConfig.diversity);

  // ── Step 8: Enforce diversity constraints ────────────
  const constrained = enforceDiversityConstraints(diverseRanked);

  // ── Step 9: Final trim and metrics ───────────────────
  const finalPosts = constrained.slice(0, limit);
  const diversity = computeFeedDiversityMetrics(finalPosts);

  return {
    posts: finalPosts,
    diversity,
    totalCandidates,
    filteredCount: blocked,
    coldStartActive: warmup < 1.0,
    warmupProgress: Math.round(warmup * 100) / 100,
    phase,
  };
}

// Re-export for convenience
export { PHASE_CONFIGS, FEED_QUOTAS, determinePhase, computeWarmupProgress };
