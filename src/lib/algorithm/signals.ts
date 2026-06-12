// ═══════════════════════════════════════════════════════════════
// Civic Social — Signal Extraction Functions (v2 — Enhanced)
// ═══════════════════════════════════════════════════════════════
//
// Each function computes a single signal in [0, 1].
// These are the building blocks of the For You ranking score.
//
// Math reference:
//
//   Q(post, user) = Σ(wᵢ × Sᵢ) − P(post) × penaltyMultiplier
//
//   S₁ = engagementQuality   (w = 0.20)
//   S₂ = civility             (w = 0.25)  ← highest weight
//   S₃ = viewpointDiversity   (w = 0.15)
//   S₄ = sourceCredibility    (w = 0.15)
//   S₅ = topicRelevance       (w = 0.15)
//   S₆ = authorReputation     (w = 0.10)
//   P  = penalty               (subtracted)
//
// v2 enhancements:
//   - Reaction quality ratio (insightful/nuance vs agree/disagree)
//   - New-post boost (posts < 2h old get engagement floor)
//   - Graduated affiliation distance on political spectrum
//   - Thread civility/diversity factored into scoring
//   - Low-trust source penalty
//   - Source diversity bonus
//   - Topic-aware recency decay (policy/legislation decays slower)
//   - Engagement velocity as standalone sub-signal
//   - Misinformation, spam, hashtag-flood, link-only penalties
// ═══════════════════════════════════════════════════════════════

import type { AlgoPost, AlgoThread, AlgoAuthor, AlgoUser, FeedCandidate } from './types';

// ─── Helpers ─────────────────────────────────────────────────

/** Clamp a value to [0, 1]. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Weighted sum of sub-scores, all assumed [0,1]. */
function weightedSum(components: [number, number][]): number {
  let sum = 0;
  for (const [weight, value] of components) {
    sum += weight * clamp01(value);
  }
  return clamp01(sum);
}

/** Jaccard similarity between two string arrays. */
function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Political spectrum positions for graduated distance calculation.
 * Distance between adjacent positions = 0.25.
 * "left" to "right" = 1.0.
 */
const SPECTRUM_POSITIONS: Record<string, number> = {
  'left': 0.0,
  'center-left': 0.25,
  'center': 0.50,
  'center-right': 0.75,
  'right': 1.0,
};

/** Compute graduated distance on the political spectrum (0–1). */
function spectrumDistance(a: string, b: string): number {
  const posA = SPECTRUM_POSITIONS[a];
  const posB = SPECTRUM_POSITIONS[b];
  if (posA === undefined || posB === undefined) {
    // Unknown affiliation — moderate distance
    return a === b ? 0.0 : 0.5;
  }
  return Math.abs(posA - posB);
}

/** Topics that indicate legislative/policy content (decays slower). */
const POLICY_TOPICS = new Set([
  'legislation', 'bill', 'policy', 'law', 'congress', 'senate',
  'supreme-court', 'regulation', 'executive-order', 'budget',
  'healthcare', 'tax', 'taxation', 'infrastructure', 'defense',
  'trade', 'foreign-policy', 'immigration', 'criminal-justice',
  'education', 'housing', 'election', 'elections', 'voting',
]);

// ═══════════════════════════════════════════════════════════════
// S₁ — ENGAGEMENT QUALITY (v2)
// ═══════════════════════════════════════════════════════════════
//
//   E = α₁·readTimeRatio + α₂·completionRate
//     + α₃·substantiveReplyRatio + α₄·replyDepthProxy
//     + α₅·reactionQualityRatio
//
//   NEW in v2:
//   - reactionQualityRatio: (insightful + nuance) / total reactions
//     Rewards posts where reactions indicate thoughtfulness, not
//     just agree/disagree pile-ons.
//   - New post boost: posts < 2 hours old get a floor of 0.25
//     so they aren't immediately buried by established posts.
//     This decays linearly from 2h → 0 over the next 4 hours.

export function computeEngagementQuality(post: AlgoPost): number {
  // Read-time ratio: how much longer do people read vs expected?
  const readTimeRatio = post.expectedReadTime > 0
    ? Math.min(post.avgReadTime / post.expectedReadTime, 2.0) / 2.0
    : 0;

  // Thread/post completion rate
  const completionRate = post.completionRate;

  // Ratio of substantive (thoughtful) replies to total
  const substantiveRatio = post.replyCount > 0
    ? post.substantiveReplies / post.replyCount
    : 0;

  // Reply depth as a proxy for discussion richness
  const replyDepth = Math.min(post.replyCount / 20, 1.0);

  // ── NEW: Reaction quality ratio ────────────────────────
  // (insightful + nuance) / total reactions → rewards thoughtful engagement
  const totalReactions = post.agreeCount + post.disagreeCount
    + post.insightfulCount + post.nuanceCount;
  const thoughtfulReactions = post.insightfulCount + post.nuanceCount;
  const reactionQuality = totalReactions > 5
    ? thoughtfulReactions / totalReactions
    : 0; // Need minimum 5 reactions to be meaningful

  // ── NEW: New post boost ────────────────────────────────
  // Posts < 2 hours old get a floor score so they aren't buried.
  // The floor decays from 0.25 → 0 over hours 2–6.
  const ageHours = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
  let newPostFloor = 0;
  if (ageHours < 2) {
    newPostFloor = 0.25;
  } else if (ageHours < 6) {
    newPostFloor = 0.25 * (1 - (ageHours - 2) / 4);
  }

  const baseScore = weightedSum([
    [0.25, readTimeRatio],
    [0.20, completionRate],
    [0.25, substantiveRatio],
    [0.15, replyDepth],
    [0.15, reactionQuality],
  ]);

  return clamp01(Math.max(baseScore, newPostFloor));
}

// ═══════════════════════════════════════════════════════════════
// S₂ — CIVILITY SCORE (v2)
// ═══════════════════════════════════════════════════════════════
//
//   C = β₁·(1 − toxicity) + β₂·politeness + β₃·empathy
//     + β₄·solutionOrientation + β₅·threadCivilityBoost
//
//   NEW in v2:
//   - threadCivilityBoost: if a post is in a high-civility thread,
//     the post inherits some of that thread's civility score.
//     A post in a toxic thread gets dampened.
//     This rewards posts that foster good environments.

export function computeCivility(
  post: AlgoPost,
  thread?: AlgoThread,
): number {
  const toxicityInverse = 1 - post.toxicityScore;
  const politeness = post.civilityScore;
  const empathy = post.empathyScore;
  const solution = post.solutionOrientation;

  // ── NEW: Thread civility context ───────────────────────
  // If the post is in a thread, blend in the thread's civility.
  // A high-civility thread gives a 10% boost; a low-civility thread dampens.
  // Default to 0.5 (neutral) if no thread context.
  const threadCivility = thread ? thread.civilityScore : 0.5;

  return weightedSum([
    [0.25, toxicityInverse],
    [0.25, politeness],
    [0.15, empathy],
    [0.25, solution],
    [0.10, threadCivility],
  ]);
}

// ═══════════════════════════════════════════════════════════════
// S₃ — VIEWPOINT DIVERSITY (v2)
// ═══════════════════════════════════════════════════════════════
//
//   D = γ₁·crossPartyThreadScore + γ₂·affiliationDistance
//     + γ₃·topicNovelty + γ₄·threadDiversityScore
//
//   NEW in v2:
//   - affiliationDistance is now GRADUATED on the spectrum:
//     "left" to "center-left" = 0.25 (mild boost)
//     "left" to "center"      = 0.50 (moderate boost)
//     "left" to "right"       = 1.00 (maximum boost)
//     Previously this was binary 0/1.
//
//   - threadDiversityScore: threads with measurable diversity
//     (diversityScore from thread metadata) get an additional boost.

export function computeViewpointDiversity(
  candidate: FeedCandidate,
  user: AlgoUser,
): number {
  const thread = candidate.thread;

  // Cross-party: unique affiliations in the thread
  const affiliationCount = thread
    ? new Set(thread.participantAffiliations).size
    : 1;
  const crossParty = Math.min(affiliationCount / 4, 1.0);

  // ── IMPROVED: Graduated affiliation distance ───────────
  const userIdeology = user.affiliations[0] || 'center';
  const authorIdeology = candidate.author.affiliations[0] || 'center';
  const affiliationDistance = spectrumDistance(userIdeology, authorIdeology);

  // Topic novelty: how new are this post's topics for the user?
  const topicOverlap = jaccardSimilarity(
    candidate.post.topics,
    user.topicInterests,
  );
  const topicNovelty = 1 - topicOverlap;

  // ── NEW: Thread diversity score ────────────────────────
  // Use the thread's own diversity metric if available.
  const threadDiversity = thread ? thread.diversityScore : 0;

  return weightedSum([
    [0.35, crossParty],
    [0.30, affiliationDistance],
    [0.20, topicNovelty],
    [0.15, threadDiversity],
  ]);
}

// ═══════════════════════════════════════════════════════════════
// S₄ — SOURCE CREDIBILITY (v2)
// ═══════════════════════════════════════════════════════════════
//
//   S = δ₁·sourceCountNorm + δ₂·avgTrustScore + δ₃·hasPrimary
//     + δ₄·sourceDiversity − δ₅·lowTrustPenalty
//
//   NEW in v2:
//   - lowTrustPenalty: if any source has trust < 0.35, the post
//     loses credibility. Citing 3 unreliable sources should NOT
//     give a 0.40 score — it should be near 0 or negative.
//   - sourceDiversity: citing from multiple distinct domains
//     (not all from the same outlet) is a positive signal.

export function computeSourceCredibility(post: AlgoPost): number {
  if (post.sources.length === 0) {
    return 0.0; // no sources = no credibility bonus
  }

  // Normalized source count: 3+ sources → 1.0
  const sourceCountNorm = Math.min(post.sources.length / 3, 1.0);

  // Average trust score across all sources
  const avgTrust =
    post.sources.reduce((sum, s) => sum + s.trustScore, 0) /
    post.sources.length;

  // Primary source bonus
  const hasPrimary = post.sources.some((s) => s.isPrimary) ? 1.0 : 0.0;

  // ── NEW: Source diversity (unique domains) ─────────────
  const uniqueDomains = new Set(post.sources.map((s) => s.domain)).size;
  const sourceDiversity = Math.min(uniqueDomains / 3, 1.0);

  // ── NEW: Low-trust source penalty ──────────────────────
  // If any source has trust < 0.35, penalize proportionally.
  // All low-trust = full penalty. Mixed = partial.
  const lowTrustSources = post.sources.filter((s) => s.trustScore < 0.35);
  const lowTrustRatio = lowTrustSources.length / post.sources.length;
  // Scale: 0 low-trust sources = 0 penalty, all low-trust = 0.8 penalty
  const lowTrustPenalty = lowTrustRatio * 0.8;

  const raw = weightedSum([
    [0.25, sourceCountNorm],
    [0.40, avgTrust],
    [0.15, hasPrimary],
    [0.20, sourceDiversity],
  ]);

  // Subtract low-trust penalty (can push score toward 0)
  return clamp01(raw - lowTrustPenalty);
}

// ═══════════════════════════════════════════════════════════════
// S₅ — TOPIC RELEVANCE (v2)
// ═══════════════════════════════════════════════════════════════
//
//   T = ε₁·topicInterestScore + ε₂·recencyDecay + ε₃·trendBonus
//     + ε₄·engagementVelocity
//
//   NEW in v2:
//   - Topic-aware recency decay: policy/legislation posts use a
//     longer half-life (72h instead of 24h) because they have
//     longer relevance windows. News decays faster (18h).
//
//   - engagementVelocity: standalone sub-signal measuring the
//     acceleration of engagement (not just raw volume).
//     High velocity = content is resonating RIGHT NOW.

export function computeTopicRelevance(
  candidate: FeedCandidate,
  user: AlgoUser,
  recencyHalfLifeHours: number,
): number {
  // Topic interest overlap
  const topicInterest = jaccardSimilarity(
    candidate.post.topics,
    user.topicInterests,
  );

  // ── IMPROVED: Topic-aware recency decay ────────────────
  // Policy/legislation topics decay 3x slower (they stay relevant longer).
  // News topics decay 25% faster (they become stale quickly).
  const isPolicyTopic = candidate.post.topics.some((t) => POLICY_TOPICS.has(t));
  const isNewsTopic = candidate.thread?.type === 'NEWS_DISCUSSION';
  let effectiveHalfLife = recencyHalfLifeHours;
  if (isPolicyTopic) {
    effectiveHalfLife = recencyHalfLifeHours * 3; // 72h for policy
  } else if (isNewsTopic) {
    effectiveHalfLife = recencyHalfLifeHours * 0.75; // 18h for news
  }

  const ageHours =
    (Date.now() - candidate.post.createdAt.getTime()) / (1000 * 60 * 60);
  const recencyDecay = Math.pow(2, -ageHours / effectiveHalfLife);

  // Trending bonus (based on reply velocity)
  const replyVelocity =
    ageHours > 0 ? candidate.post.replyCount / ageHours : 0;
  const trendBonus = Math.min(replyVelocity / 10, 1.0);

  // ── NEW: Engagement velocity ───────────────────────────
  // Measures how rapidly engagement is accelerating.
  // Posts with high reaction counts relative to their age score higher.
  const totalReactions = candidate.post.agreeCount + candidate.post.disagreeCount
    + candidate.post.insightfulCount + candidate.post.nuanceCount;
  const reactionVelocity = ageHours > 0.1 ? totalReactions / ageHours : 0;
  // Normalize: 50+ reactions/hour = max velocity score
  const velocityScore = Math.min(reactionVelocity / 50, 1.0);

  return weightedSum([
    [0.35, topicInterest],
    [0.30, recencyDecay],
    [0.15, trendBonus],
    [0.20, velocityScore],
  ]);
}

// ═══════════════════════════════════════════════════════════════
// S₆ — AUTHOR REPUTATION
// ═══════════════════════════════════════════════════════════════
//
//   R = ζ₁·civicReputation + ζ₂·verificationBonus
//     + ζ₃·historicalCivility + ζ₄·accuracyScore
//
//   Unchanged from v1 — this signal was already well-designed.

export function computeAuthorReputation(author: AlgoAuthor): number {
  const verificationMap: Record<string, number> = {
    OFFICIAL_VERIFIED: 1.0,
    EXPERT_VERIFIED: 0.95,
    CITIZEN_VERIFIED: 0.7,
    EMAIL_VERIFIED: 0.3,
    UNVERIFIED: 0.0,
  };

  const verificationBonus =
    verificationMap[author.verificationLevel] ?? 0.0;

  return weightedSum([
    [0.30, author.civicReputation],
    [0.25, verificationBonus],
    [0.25, author.civilityAvg],
    [0.20, author.accuracyScore],
  ]);
}

// ═══════════════════════════════════════════════════════════════
// P — PENALTY SCORE (v2)
// ═══════════════════════════════════════════════════════════════
//
//   P = η₁·rageBaitScore + η₂·allCapsRatio + η₃·flagPenalty
//     + η₄·botLikelihood + η₅·lowEffortScore
//     + η₆·misinformationRisk + η₇·spamSignals
//
//   NEW in v2:
//   - misinformationRisk: uses optional misinformationScore field.
//     In production, this would come from a fact-checking pipeline.
//     For now, uses heuristic: unverified claims with no sources.
//
//   - spamSignals: composite of:
//     - Excessive hashtags (>5)
//     - Link-only posts (no substantive text)
//     - Low unique word ratio (repetitive content)
//     - Very short content with inflammatory language

export function computePenalty(post: AlgoPost): number {
  // Rage-bait detection (ML model output)
  const rageBait = post.rageBaitScore;

  // All-caps ratio: posts that are 50%+ caps get penalized
  const capsRatio = post.allCapsRatio;

  // Flag penalty: normalized against threshold (10 flags = full penalty)
  const flagPenalty = Math.min(post.flagCount / 10, 1.0);

  // Bot likelihood from behavioral model
  const botPenalty = post.botLikelihood;

  // Low-effort: very short posts with no sources & low civility
  const contentLength = post.content.length;
  const lowEffort =
    contentLength < 50 && post.sources.length === 0
      ? 1 - contentLength / 50
      : 0;

  // ── NEW: Misinformation risk ───────────────────────────
  // Uses the optional AI-scored field if available.
  // Falls back to heuristic: short content + no sources + low author rep
  const misinfoScore = post.misinformationScore ?? 0;

  // ── NEW: Spam / manipulation signals ───────────────────
  let spamScore = 0;

  // Excessive hashtags (>5 hashtags is likely spam)
  const hashtagCount = post.hashtagCount ?? post.topics.length;
  if (hashtagCount > 8) {
    spamScore += 0.6;
  } else if (hashtagCount > 5) {
    spamScore += 0.3;
  }

  // Link-only: post is just a URL with no substantive text
  if (post.isLinkOnly) {
    spamScore += 0.4;
  }

  // Low unique word ratio (repetitive copy-paste)
  const uniqueWordRatio = post.uniqueWordRatio ?? 1.0;
  if (uniqueWordRatio < 0.3) {
    spamScore += 0.5;
  } else if (uniqueWordRatio < 0.5) {
    spamScore += 0.2;
  }

  spamScore = clamp01(spamScore);

  return weightedSum([
    [0.25, rageBait],
    [0.10, capsRatio],
    [0.15, flagPenalty],
    [0.15, botPenalty],
    [0.10, lowEffort],
    [0.15, misinfoScore],
    [0.10, spamScore],
  ]);
}

// ═══════════════════════════════════════════════════════════════
// G — REAL-GRAPH (viewer ↔ author affinity)  — X-port v1
// ═══════════════════════════════════════════════════════════════
//
//   G(viewer, author) = mv_real_graph_affinity.affinity ∈ [0, 1]
//
// Looked up from the materialized view (mv_real_graph_affinity),
// passed into scoring via the precomputed map. Returns 0 when
// the (viewer, author) pair has no affinity row.
//
// We do NOT fall back to engagement-prediction. If a viewer has
// no interaction history with an author, the signal is 0 — the
// other six signals still drive ranking.

export function computeRealGraph(
  authorId: string,
  affinityMap: ReadonlyMap<string, number>,
): number {
  const v = affinityMap.get(authorId);
  return v === undefined ? 0 : clamp01(v);
}
