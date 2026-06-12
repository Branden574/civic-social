// ═══════════════════════════════════════════════════════════════
// Civic Social — Core Scoring Engine (v2 — Enhanced)
// ═══════════════════════════════════════════════════════════════
//
// Computes the composite Quality Score for each candidate:
//
//   Q(post, user) = Σ(wᵢ × Sᵢ) − P × penaltyMultiplier
//
// Also generates a human-readable explanation for each ranked
// post (the "Why am I seeing this?" feature).
//
// v2 enhancements:
//   - computeCivility now receives thread context
//   - Explanation generator is significantly more detailed
//   - Handles edge cases (zero-signal posts, penalty-dominated)
//   - Adds specific reaction/source/thread callouts
// ═══════════════════════════════════════════════════════════════

import type {
  FeedCandidate,
  AlgoUser,
  AlgorithmConfig,
  SignalScores,
  RankedPost,
} from './types';
import { DEFAULT_CONFIG } from './types';
import {
  computeEngagementQuality,
  computeCivility,
  computeViewpointDiversity,
  computeSourceCredibility,
  computeTopicRelevance,
  computeAuthorReputation,
  computePenalty,
  computeRealGraph,
} from './signals';

/**
 * Optional per-call context the heavy ranker needs that isn't on
 * the candidate or user directly.
 */
export interface ScoringContext {
  /** Map authorId → affinity ∈ [0,1] from mv_real_graph_affinity. */
  affinityMap?: ReadonlyMap<string, number>;
}

const EMPTY_AFFINITY: ReadonlyMap<string, number> = new Map();

// ─── Main scoring function ───────────────────────────────────

/**
 * Score a single candidate post for a given user.
 *
 * Returns the full signal breakdown + composite quality score.
 */
export function scoreCandidate(
  candidate: FeedCandidate,
  user: AlgoUser,
  config: AlgorithmConfig = DEFAULT_CONFIG,
  ctx: ScoringContext = {},
): RankedPost {
  const { weights, recencyHalfLifeHours, penaltyMultiplier } = config;
  const affinityMap = ctx.affinityMap ?? EMPTY_AFFINITY;

  // ── Compute each signal ──────────────────────────────────
  const signals: SignalScores = {
    engagementQuality: computeEngagementQuality(candidate.post),
    civility: computeCivility(candidate.post, candidate.thread),
    viewpointDiversity: computeViewpointDiversity(candidate, user),
    sourceCredibility: computeSourceCredibility(candidate.post),
    topicRelevance: computeTopicRelevance(
      candidate,
      user,
      recencyHalfLifeHours,
    ),
    authorReputation: computeAuthorReputation(candidate.author),
    realGraph: computeRealGraph(candidate.author.id, affinityMap),
    penalty: computePenalty(candidate.post),
  };

  // ── Composite score ──────────────────────────────────────
  //
  //   Q = w₁E + w₂C + w₃D + w₄S + w₅T + w₆R + w₇G − P × multiplier
  //
  const rawScore =
    weights.engagementQuality * signals.engagementQuality +
    weights.civility * signals.civility +
    weights.viewpointDiversity * signals.viewpointDiversity +
    weights.sourceCredibility * signals.sourceCredibility +
    weights.topicRelevance * signals.topicRelevance +
    weights.authorReputation * signals.authorReputation +
    weights.realGraph * signals.realGraph;

  const qualityScore = Math.max(
    0,
    rawScore - signals.penalty * penaltyMultiplier,
  );

  // ── Generate explanation ─────────────────────────────────
  const { explanation, explanationTags } = generateExplanation(
    signals,
    candidate,
    user,
  );

  return {
    candidate,
    qualityScore,
    signals,
    explanation,
    explanationTags,
  };
}

/**
 * Score all candidates and return sorted by quality score (desc).
 */
export function scoreCandidates(
  candidates: FeedCandidate[],
  user: AlgoUser,
  config: AlgorithmConfig = DEFAULT_CONFIG,
  ctx: ScoringContext = {},
): RankedPost[] {
  return candidates
    .map((c) => scoreCandidate(c, user, config, ctx))
    .sort((a, b) => b.qualityScore - a.qualityScore);
}

// ─── Explanation Generator (v2 — Enhanced) ──────────────────

interface ExplanationResult {
  explanation: string;
  explanationTags: string[];
}

/**
 * Generates a human-readable explanation for why a post
 * appears in the user's feed.
 *
 * v2 improvements:
 *   - More specific and varied language
 *   - References concrete data (source counts, thread stats, etc.)
 *   - Handles edge cases and penalty-dominated posts
 *   - Distinguishes between different author verification levels
 *   - Adds reaction-quality and velocity callouts
 */
function generateExplanation(
  signals: SignalScores,
  candidate: FeedCandidate,
  user: AlgoUser,
): ExplanationResult {
  const tags: string[] = [];
  const reasons: string[] = [];

  // ── Civility (highest weight — check first) ──────────────
  if (signals.civility > 0.85) {
    tags.push('exceptional-civility');
    reasons.push('Exceptionally civil tone — a model for constructive discourse');
  } else if (signals.civility > 0.7) {
    tags.push('high-civility');
    if (candidate.post.solutionOrientation > 0.7) {
      reasons.push('Civil and solution-oriented — proposes actionable ideas');
    } else if (candidate.post.empathyScore > 0.7) {
      reasons.push('Empathetic and respectful tone that fosters understanding');
    } else {
      reasons.push('Maintains a respectful, constructive tone');
    }
  }

  // ── Engagement Quality ───────────────────────────────────
  if (signals.engagementQuality > 0.7) {
    tags.push('deep-engagement');
    const totalReactions = candidate.post.agreeCount + candidate.post.disagreeCount
      + candidate.post.insightfulCount + candidate.post.nuanceCount;
    const thoughtfulRatio = totalReactions > 0
      ? (candidate.post.insightfulCount + candidate.post.nuanceCount) / totalReactions
      : 0;

    if (thoughtfulRatio > 0.4 && totalReactions > 10) {
      reasons.push(
        `${Math.round(thoughtfulRatio * 100)}% of reactions are "insightful" or "nuanced" — readers find this genuinely thought-provoking`,
      );
    } else if (candidate.post.substantiveReplies > 10) {
      reasons.push(
        `Sparked ${candidate.post.substantiveReplies} substantive replies — driving meaningful discussion`,
      );
    } else {
      reasons.push('Readers engage deeply with this content, not just scroll past');
    }
  } else if (signals.engagementQuality > 0.5) {
    tags.push('quality-engagement');
    reasons.push('Readers spend significant time engaging with this content');
  }

  // ── Viewpoint Diversity ──────────────────────────────────
  if (signals.viewpointDiversity > 0.7) {
    tags.push('cross-party');
    if (candidate.thread) {
      const uniqueAffiliations = new Set(candidate.thread.participantAffiliations).size;
      if (uniqueAffiliations >= 3) {
        reasons.push(
          `${uniqueAffiliations} political perspectives are engaging constructively in this thread`,
        );
      } else {
        reasons.push('Features dialogue across political perspectives');
      }
    } else {
      reasons.push('Offers a perspective outside your usual feed');
    }
  } else if (signals.viewpointDiversity > 0.5) {
    tags.push('diverse-viewpoint');
    // Check if the boost is from a different affiliation
    const userIdeology = user.affiliations[0] || 'center';
    const authorIdeology = candidate.author.affiliations[0] || 'center';
    if (userIdeology !== authorIdeology) {
      reasons.push(
        `From a ${authorIdeology} perspective — expanding your viewpoint exposure`,
      );
    }
  }

  // ── Source Credibility ───────────────────────────────────
  if (signals.sourceCredibility > 0.7) {
    tags.push('well-sourced');
    const primaryCount = candidate.post.sources.filter((s) => s.isPrimary).length;
    const highTrustCount = candidate.post.sources.filter((s) => s.trustScore >= 0.8).length;
    if (primaryCount > 0) {
      reasons.push(
        `Cites ${primaryCount} primary source${primaryCount > 1 ? 's' : ''} (official documents, research, court records)`,
      );
    } else if (highTrustCount >= 2) {
      reasons.push(
        `Backed by ${highTrustCount} high-credibility sources (trust > 80%)`,
      );
    } else {
      reasons.push(
        `Supported by ${candidate.post.sources.length} credible source${candidate.post.sources.length !== 1 ? 's' : ''}`,
      );
    }
  } else if (signals.sourceCredibility > 0.4) {
    tags.push('sourced');
    reasons.push(`Includes ${candidate.post.sources.length} supporting source${candidate.post.sources.length !== 1 ? 's' : ''}`);
  }

  // ── Topic Relevance ──────────────────────────────────────
  if (signals.topicRelevance > 0.7) {
    tags.push('relevant-topic');
    const sharedTopics = candidate.post.topics.filter((t) =>
      user.topicInterests.includes(t),
    );
    if (sharedTopics.length > 0) {
      reasons.push(
        `Directly related to topics you follow: ${sharedTopics.slice(0, 3).join(', ')}`,
      );
    } else {
      reasons.push('Highly relevant to your interests and engagement patterns');
    }
  } else if (signals.topicRelevance > 0.5) {
    tags.push('trending');
    reasons.push('Trending in topics related to your interests');
  }

  // ── Real-Graph (viewer ↔ author affinity, X-port v1) ────
  if (signals.realGraph > 0.6) {
    tags.push('familiar-author');
    reasons.push(
      `You've engaged with ${candidate.author.displayName} before`,
    );
  } else if (signals.realGraph > 0.3) {
    tags.push('related-author');
  }

  // ── Author Reputation ────────────────────────────────────
  if (signals.authorReputation > 0.8) {
    tags.push('trusted-author');
    const level = candidate.author.verificationLevel;
    if (level === 'OFFICIAL_VERIFIED') {
      reasons.push(
        `From ${candidate.author.displayName} — a verified government official`,
      );
    } else if (level === 'EXPERT_VERIFIED') {
      reasons.push(
        `From ${candidate.author.displayName} — a verified subject-matter expert`,
      );
    } else {
      reasons.push(
        `From ${candidate.author.displayName} — a highly reputable community member`,
      );
    }
  } else if (signals.authorReputation > 0.6) {
    tags.push('reputable-author');
    if (candidate.author.verificationLevel === 'CITIZEN_VERIFIED') {
      reasons.push('From a verified citizen with consistent civic engagement');
    }
  }

  // ── Thread type context ──────────────────────────────────
  if (candidate.thread) {
    const typeLabels: Record<string, string> = {
      POLICY_PROPOSAL: 'Active policy proposal with community input',
      STRUCTURED_DEBATE: 'Structured debate with moderated format',
      CROSS_PARTY_ROUNDTABLE: 'Cross-party roundtable discussion',
      EXPERT_AMA: 'Expert Q&A — verified experts answering questions',
      NEWS_DISCUSSION: 'Breaking news discussion',
      OPEN_DISCUSSION: 'Community discussion',
    };
    const threadLabel = typeLabels[candidate.thread.type];
    if (threadLabel && candidate.thread.type !== 'OPEN_DISCUSSION') {
      tags.push(candidate.thread.type.toLowerCase().replace(/_/g, '-'));
      if (candidate.thread.participantCount > 20) {
        reasons.push(`${threadLabel} — ${candidate.thread.participantCount} participants`);
      } else {
        reasons.push(threadLabel);
      }
    }
  }

  // ── Solution-oriented bonus ──────────────────────────────
  if (candidate.post.solutionOrientation > 0.7 && !tags.includes('exceptional-civility')) {
    tags.push('solution-focused');
    reasons.push('Proposes concrete solutions rather than just identifying problems');
  }

  // ── Penalty warnings ─────────────────────────────────────
  if (signals.penalty > 0.5) {
    tags.push('flagged-high');
    reasons.push(
      'Warning: This content has significant community flags or automated concerns',
    );
  } else if (signals.penalty > 0.3) {
    tags.push('flagged');
    reasons.push(
      'Note: Some community members have flagged this content for review',
    );
  }

  // ── Build final explanation ──────────────────────────────
  // Take top 3 most impactful reasons
  let explanation: string;
  if (reasons.length > 0) {
    explanation = reasons.slice(0, 3).join(' · ');
  } else if (signals.penalty > 0) {
    explanation = 'Showing this post with lower priority due to quality signals.';
  } else {
    explanation = 'Recommended based on your interests and engagement history.';
  }

  return { explanation, explanationTags: tags };
}
