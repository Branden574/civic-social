// ═══════════════════════════════════════════════════════════════
// Civic Social — For You Algorithm Type Definitions
// ═══════════════════════════════════════════════════════════════

/**
 * Represents a user in the algorithm context.
 * Stripped to the fields the ranking engine needs.
 */
export interface AlgoUser {
  id: string;
  affiliations: string[];        // ideology labels: "left", "center-right", etc.
  topicInterests: string[];      // topics the user has engaged with
  followingIds: string[];        // user IDs they follow
  civicReputation: number;       // 0–1
  civilityAvg: number;           // 0–1
  country: string;
}

/**
 * A candidate post entering the ranking pipeline.
 * Combines the post's own data with contextual metadata.
 */
export interface FeedCandidate {
  post: AlgoPost;
  thread?: AlgoThread;
  author: AlgoAuthor;
}

export interface AlgoPost {
  id: string;
  content: string;
  createdAt: Date;
  threadId?: string;
  parentId?: string;
  topics: string[];

  // AI-scored content signals
  civilityScore: number;         // 0–1
  toxicityScore: number;         // 0–1
  solutionOrientation: number;   // 0–1
  empathyScore: number;          // 0–1

  // Engagement metrics
  avgReadTime: number;           // seconds
  expectedReadTime: number;      // seconds
  completionRate: number;        // 0–1
  replyCount: number;
  substantiveReplies: number;

  // Sources
  sources: AlgoSource[];

  // Anti-abuse signals
  rageBaitScore: number;         // 0–1
  allCapsRatio: number;          // 0–1
  botLikelihood: number;         // 0–1
  flagCount: number;

  // Reaction counts
  agreeCount: number;
  disagreeCount: number;
  insightfulCount: number;
  nuanceCount: number;

  // ── Enhanced signals (v2) ──────────────────────────────
  // Misinformation risk: 0 = verified, 1 = high disinfo risk
  misinformationScore?: number;
  // Hashtag count (for spam detection)
  hashtagCount?: number;
  // Whether this is a link-only post (no substantive text)
  isLinkOnly?: boolean;
  // Unique word ratio: unique words / total words (low = repetitive)
  uniqueWordRatio?: number;
  // Readability score: 0 = very difficult, 1 = very accessible
  readabilityScore?: number;
}

export interface AlgoSource {
  url: string;
  domain: string;
  trustScore: number;            // 0–1
  isPrimary: boolean;
}

export interface AlgoThread {
  id: string;
  type: string;
  topics: string[];
  civilityScore: number;
  diversityScore: number;
  engagementScore: number;
  participantCount: number;
  participantAffiliations: string[];  // all unique ideologies present
}

export interface AlgoAuthor {
  id: string;
  displayName: string;
  affiliations: string[];        // ideology labels
  verificationLevel: string;
  civicReputation: number;       // 0–1
  civilityAvg: number;           // 0–1
  accuracyScore: number;         // 0–1
}

// ═══════════════════════════════════════════════════════════════
// Signal Scores — output of each scoring function
// ═══════════════════════════════════════════════════════════════

export interface SignalScores {
  engagementQuality: number;     // 0–1
  civility: number;              // 0–1
  viewpointDiversity: number;    // 0–1
  sourceCredibility: number;     // 0–1
  topicRelevance: number;        // 0–1
  authorReputation: number;      // 0–1
  penalty: number;               // 0–1 (subtracted)
}

/**
 * The final ranked post with its quality score and explanation.
 */
export interface RankedPost {
  candidate: FeedCandidate;
  qualityScore: number;          // final composite score
  signals: SignalScores;
  explanation: string;           // human-readable "Why am I seeing this?"
  explanationTags: string[];     // machine-readable tags for UI chips
}

// ═══════════════════════════════════════════════════════════════
// Algorithm Configuration — tunable weights & constraints
// ═══════════════════════════════════════════════════════════════

export interface AlgorithmWeights {
  engagementQuality: number;
  civility: number;
  viewpointDiversity: number;
  sourceCredibility: number;
  topicRelevance: number;
  authorReputation: number;
}

export interface DiversityConstraints {
  windowSize: number;            // sliding window size
  maxSameAffiliation: number;    // max fraction from same ideology
  minCrossParty: number;         // min cross-party posts per window
  threadTypeMix: boolean;        // enforce thread type variety
}

export interface AlgorithmConfig {
  weights: AlgorithmWeights;
  diversity: DiversityConstraints;
  recencyHalfLifeHours: number;  // how fast recency decays
  penaltyMultiplier: number;     // how strongly penalties reduce score
}

/**
 * Default configuration — these are the "knobs" that define
 * the platform's ranking philosophy.
 *
 * Key design choice: Civility (0.25) has the highest weight,
 * signaling that constructive tone is the #1 priority.
 */
export const DEFAULT_CONFIG: AlgorithmConfig = {
  weights: {
    engagementQuality: 0.20,
    civility: 0.25,
    viewpointDiversity: 0.15,
    sourceCredibility: 0.15,
    topicRelevance: 0.15,
    authorReputation: 0.10,
  },
  diversity: {
    windowSize: 5,
    maxSameAffiliation: 0.6,
    minCrossParty: 1,
    threadTypeMix: true,
  },
  recencyHalfLifeHours: 24,
  penaltyMultiplier: 1.5,
};
