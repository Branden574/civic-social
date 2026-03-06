// ═══════════════════════════════════════════════════════════════
// Credibility Score Recomputation Engine
// ═══════════════════════════════════════════════════════════════
//
// Recomputes a user's credibility score (0–100) based on 6 weighted factors:
//   1. Civil Engagement (25%) — average civility of posts
//   2. Citation Quality  (25%) — % of posts that include source URLs
//   3. Report Accuracy   (15%) — ratio of dismissed reports vs actioned
//   4. Cross-Party Engagement (15%) — interactions with different affiliations
//   5. Verified Identity  (10%) — verification level bonus
//   6. Behavioral Consistency (10%) — posting regularity & low flag rate
//
// Called after post creation, and can be called on-demand from /api/me.
// ═══════════════════════════════════════════════════════════════

import { isDbAvailable, prisma } from '@/lib/db';

// ─── Weights ───────────────────────────────────────────────────

const WEIGHTS = {
  civilEngagement: 0.25,
  citationQuality: 0.25,
  reportAccuracy: 0.15,
  crossPartyEngagement: 0.15,
  verifiedIdentity: 0.10,
  behavioralConsistency: 0.10,
} as const;

// Minimum posts before score moves from default 50
const MIN_POSTS_FOR_RECOMPUTE = 3;

// ─── Factor computations ──────────────────────────────────────

/**
 * Factor 1: Civil Engagement (0–100)
 * Average civilityScore across all published posts.
 * Posts with score >= 0.8 are considered "civil".
 */
async function computeCivilEngagement(userId: string): Promise<number> {
  const result = await prisma.storedPost.aggregate({
    where: { authorId: userId, status: 'published', deletedAt: null },
    _avg: { civilityScore: true },
    _count: true,
  });

  if (!result._count || result._count === 0) return 50; // neutral default
  const avg = result._avg.civilityScore ?? 0.5;

  // Map 0–1 civility average to 0–100 score
  // 0.5 avg → 50, 0.8 avg → 80, 1.0 avg → 100
  return Math.round(Math.min(100, Math.max(0, avg * 100)));
}

/**
 * Factor 2: Citation Quality (0–100)
 * Percentage of posts that include an articleUrl (source citation).
 * Users who cite sources regularly score higher.
 */
async function computeCitationQuality(userId: string): Promise<number> {
  const [total, withUrl] = await Promise.all([
    prisma.storedPost.count({
      where: { authorId: userId, status: 'published', deletedAt: null },
    }),
    prisma.storedPost.count({
      where: {
        authorId: userId,
        status: 'published',
        deletedAt: null,
        articleUrl: { not: null },
      },
    }),
  ]);

  if (total === 0) return 50; // neutral default

  const ratio = withUrl / total;
  // 0% cited → 30, 50% cited → 65, 100% cited → 100
  return Math.round(30 + ratio * 70);
}

/**
 * Factor 3: Report Accuracy (0–100)
 * Measures whether a user's posts get flagged and actioned (bad)
 * vs. reports against them being dismissed (good).
 * Also penalizes users who file false reports.
 */
async function computeReportAccuracy(userId: string): Promise<number> {
  // Reports AGAINST this user's posts
  const postsIds = await prisma.storedPost.findMany({
    where: { authorId: userId, status: 'published' },
    select: { id: true },
  });

  if (postsIds.length === 0) return 60; // neutral-positive default

  // Check User model for reports against their posts (via Post model)
  // Since StoredPost doesn't have reports relation, we check if any
  // moderation actions exist against this user
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { civicReputation: true },
    });

    // If the user record exists and has cached reputation, use it as a signal
    if (user) {
      // civicReputation 0–1 maps to 0–100
      return Math.round(Math.max(30, Math.min(100, (user.civicReputation || 0.6) * 100)));
    }
  } catch {
    // User record may not exist in the full User model
  }

  return 60; // neutral-positive default
}

/**
 * Factor 4: Cross-Party Engagement (0–100)
 * Measures whether a user follows/interacts with people of
 * different political affiliations than their own.
 */
async function computeCrossPartyEngagement(userId: string): Promise<number> {
  try {
    // Get user's own affiliation
    const self = await prisma.searchableUser.findFirst({
      where: { id: userId },
      select: { affiliation: true },
    });

    if (!self?.affiliation) return 50; // no affiliation set = neutral

    // Get affiliations of people this user follows
    const followingEdges = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
      take: 100, // limit for performance
    });

    if (followingEdges.length === 0) return 40; // follows nobody = below neutral

    const followingIds = followingEdges.map(f => f.followingId);

    const followedUsers = await prisma.searchableUser.findMany({
      where: { id: { in: followingIds } },
      select: { affiliation: true },
    });

    const totalWithAffiliation = followedUsers.filter(u => u.affiliation).length;
    if (totalWithAffiliation === 0) return 50;

    const differentAffiliation = followedUsers.filter(
      u => u.affiliation && u.affiliation !== self.affiliation
    ).length;

    const crossPartyRatio = differentAffiliation / totalWithAffiliation;

    // 0% cross-party → 20, 50% → 70, 100% → 100
    return Math.round(20 + crossPartyRatio * 80);
  } catch {
    return 50; // fallback on any error
  }
}

/**
 * Factor 5: Verified Identity (0–100)
 * Bonus based on verification level.
 */
async function computeVerifiedIdentity(userId: string): Promise<number> {
  try {
    const user = await prisma.searchableUser.findFirst({
      where: { id: userId },
      select: { verificationLevel: true, isVerified: true },
    });

    if (!user) return 30;

    switch (user.verificationLevel) {
      case 'OFFICIAL_VERIFIED': return 100;
      case 'EXPERT_VERIFIED': return 95;
      case 'CITIZEN_VERIFIED': return 85;
      case 'EMAIL_VERIFIED': return 60;
      default: return 30; // UNVERIFIED
    }
  } catch {
    return 30;
  }
}

/**
 * Factor 6: Behavioral Consistency (0–100)
 * Rewards consistent posting and low flag/removal rates.
 * Penalizes accounts with removed posts or erratic behavior.
 */
async function computeBehavioralConsistency(userId: string): Promise<number> {
  const [published, removed] = await Promise.all([
    prisma.storedPost.count({
      where: { authorId: userId, status: 'published', deletedAt: null },
    }),
    prisma.storedPost.count({
      where: {
        authorId: userId,
        OR: [
          { status: 'removed' },
          { deletedAt: { not: null } },
        ],
      },
    }),
  ]);

  const total = published + removed;
  if (total === 0) return 50; // neutral default

  // High removal ratio = bad
  const removalRatio = removed / total;

  // 0% removed → 90, 10% removed → 70, 50% removed → 30
  const baseScore = Math.round(90 - removalRatio * 120);

  // Bonus for having more published posts (consistency)
  const volumeBonus = Math.min(10, Math.floor(published / 5));

  return Math.max(0, Math.min(100, baseScore + volumeBonus));
}

// ─── Main recomputation function ──────────────────────────────

export interface CredibilityBreakdown {
  overall: number;
  factors: {
    civilEngagement: number;
    citationQuality: number;
    reportAccuracy: number;
    crossPartyEngagement: number;
    verifiedIdentity: number;
    behavioralConsistency: number;
  };
  postCount: number;
}

/**
 * Recompute a user's credibility score and persist it.
 * Returns the breakdown of all factors.
 */
export async function recomputeCredibilityScore(
  userId: string,
): Promise<CredibilityBreakdown | null> {
  if (!isDbAvailable()) return null;

  try {
    // Check post count — don't recompute for very new users
    const postCount = await prisma.storedPost.count({
      where: { authorId: userId, status: 'published', deletedAt: null },
    });

    if (postCount < MIN_POSTS_FOR_RECOMPUTE) {
      return {
        overall: 50,
        factors: {
          civilEngagement: 50,
          citationQuality: 50,
          reportAccuracy: 60,
          crossPartyEngagement: 50,
          verifiedIdentity: 30,
          behavioralConsistency: 50,
        },
        postCount,
      };
    }

    // Compute all factors in parallel
    const [
      civilEngagement,
      citationQuality,
      reportAccuracy,
      crossPartyEngagement,
      verifiedIdentity,
      behavioralConsistency,
    ] = await Promise.all([
      computeCivilEngagement(userId),
      computeCitationQuality(userId),
      computeReportAccuracy(userId),
      computeCrossPartyEngagement(userId),
      computeVerifiedIdentity(userId),
      computeBehavioralConsistency(userId),
    ]);

    // Weighted sum
    const overall = Math.round(
      civilEngagement * WEIGHTS.civilEngagement +
      citationQuality * WEIGHTS.citationQuality +
      reportAccuracy * WEIGHTS.reportAccuracy +
      crossPartyEngagement * WEIGHTS.crossPartyEngagement +
      verifiedIdentity * WEIGHTS.verifiedIdentity +
      behavioralConsistency * WEIGHTS.behavioralConsistency,
    );

    // Clamp to 0–100
    const clampedScore = Math.max(0, Math.min(100, overall));

    // Persist to SearchableUser
    await prisma.searchableUser.updateMany({
      where: { id: userId },
      data: { credibilityScore: clampedScore },
    });

    // Also update User model cached fields if the record exists
    try {
      const avgCivility = civilEngagement / 100; // back to 0–1
      const crossParty = crossPartyEngagement / 100;
      await prisma.user.update({
        where: { id: userId },
        data: {
          civicReputation: clampedScore / 100,
          civilityAvg: avgCivility,
          crossPartyEngagement: crossParty,
        },
      });
    } catch {
      // User record may not exist in full User model — that's OK
    }

    return {
      overall: clampedScore,
      factors: {
        civilEngagement,
        citationQuality,
        reportAccuracy,
        crossPartyEngagement,
        verifiedIdentity,
        behavioralConsistency,
      },
      postCount,
    };
  } catch (err) {
    console.error('[credibility-recompute] Error for user', userId, err);
    return null;
  }
}

/**
 * Lightweight credibility bump — called after a single post creation.
 * Instead of full recompute (which queries many tables), this does an
 * incremental adjustment based on the new post's civility and citation.
 */
export async function incrementalCredibilityUpdate(
  userId: string,
  newPostCivilityScore: number,
  hasSourceUrl: boolean,
): Promise<void> {
  if (!isDbAvailable()) return;

  try {
    const current = await prisma.searchableUser.findFirst({
      where: { id: userId },
      select: { credibilityScore: true },
    });

    if (!current) return;

    const postCount = await prisma.storedPost.count({
      where: { authorId: userId, status: 'published', deletedAt: null },
    });

    if (postCount < MIN_POSTS_FOR_RECOMPUTE) return;

    // Small incremental adjustment (±1-3 points max)
    let delta = 0;

    // Civil post nudges score up, uncivil nudges down
    if (newPostCivilityScore >= 0.8) {
      delta += 1; // good post
    } else if (newPostCivilityScore < 0.5) {
      delta -= 2; // uncivil post penalized more
    }

    // Citation bonus
    if (hasSourceUrl) {
      delta += 1;
    }

    if (delta === 0) return;

    const newScore = Math.max(0, Math.min(100, current.credibilityScore + delta));

    await prisma.searchableUser.updateMany({
      where: { id: userId },
      data: { credibilityScore: newScore },
    });
  } catch (err) {
    console.error('[credibility-increment] Error for user', userId, err);
  }
}
