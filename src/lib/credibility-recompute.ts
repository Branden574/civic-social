// ═══════════════════════════════════════════════════════════════
// Credibility Score Recomputation Engine
// ═══════════════════════════════════════════════════════════════
//
// Recomputes a user's credibility score (0–100) based on 6 weighted factors:
//   1. Civil Engagement (25%) — uses durable CivilityEvents (not just visible posts)
//   2. Citation Quality  (25%) — % of posts that include source URLs
//   3. Report Accuracy   (15%) — ratio of dismissed reports vs actioned
//   4. Cross-Party Engagement (15%) — interactions with different affiliations
//   5. Verified Identity  (10%) — verification level bonus
//   6. Behavioral Consistency (10%) — posting regularity & low violation rate
//
// KEY DESIGN: CivilityEvents persist even if posts are deleted.
// Deleting a racist post does NOT erase the credibility penalty.
// Recovery requires sustained positive contributions over time.
// ═══════════════════════════════════════════════════════════════

import { isDbAvailable, prisma } from '@/lib/db';
import { getCivilityHistory } from '@/lib/civility-events';

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

// Recovery: how many consecutive positive events needed to start rebuilding
const MIN_POSITIVE_STREAK_FOR_RECOVERY = 5;

// ─── Factor computations ──────────────────────────────────────

/**
 * Factor 1: Civil Engagement (0–100)
 * Uses DURABLE CivilityEvents — not just currently visible posts.
 * This means deleted posts' violation events still count.
 * Critical violations impose a hard ceiling until recovery.
 */
async function computeCivilEngagement(userId: string): Promise<number> {
  const history = await getCivilityHistory(userId);

  if (!history || history.totalEvents === 0) return 50; // neutral default

  // Base score from average civility across ALL events
  let baseScore = Math.round(Math.min(100, Math.max(0, history.averageScore * 100)));

  // Hard penalties for violations that cannot be erased by deletion
  if (history.criticalViolations > 0) {
    // Each critical violation reduces ceiling by 20, minimum ceiling of 10
    const ceiling = Math.max(10, 60 - history.criticalViolations * 20);

    // Recovery: if user has enough consecutive positive events, slowly raise ceiling
    if (history.positiveStreak >= MIN_POSITIVE_STREAK_FOR_RECOVERY) {
      // Each positive event beyond the threshold adds 2 points to ceiling, max 80
      const recoveryBonus = Math.min(20, (history.positiveStreak - MIN_POSITIVE_STREAK_FOR_RECOVERY) * 2);
      const recoveredCeiling = Math.min(80, ceiling + recoveryBonus);
      baseScore = Math.min(baseScore, recoveredCeiling);
    } else {
      baseScore = Math.min(baseScore, ceiling);
    }
  } else if (history.violations > 0) {
    // Non-critical violations: ceiling of 70, recoverable with positive streak
    const ceiling = Math.max(30, 70 - history.violations * 10);
    if (history.positiveStreak >= MIN_POSITIVE_STREAK_FOR_RECOVERY) {
      const recoveryBonus = Math.min(20, (history.positiveStreak - MIN_POSITIVE_STREAK_FOR_RECOVERY) * 2);
      baseScore = Math.min(baseScore, Math.min(90, ceiling + recoveryBonus));
    } else {
      baseScore = Math.min(baseScore, ceiling);
    }
  }

  return baseScore;
}

/**
 * Factor 2: Citation Quality (0–100)
 * Percentage of posts that include an articleUrl (source citation).
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

  if (total === 0) return 50;
  const ratio = withUrl / total;
  return Math.round(30 + ratio * 70);
}

/**
 * Factor 3: Report Accuracy (0–100)
 */
async function computeReportAccuracy(userId: string): Promise<number> {
  const postsIds = await prisma.storedPost.findMany({
    where: { authorId: userId, status: 'published' },
    select: { id: true },
  });

  if (postsIds.length === 0) return 60;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { civicReputation: true },
    });

    if (user) {
      return Math.round(Math.max(30, Math.min(100, (user.civicReputation || 0.6) * 100)));
    }
  } catch {
    // User record may not exist
  }

  return 60;
}

/**
 * Factor 4: Cross-Party Engagement (0–100)
 */
async function computeCrossPartyEngagement(userId: string): Promise<number> {
  try {
    const self = await prisma.searchableUser.findFirst({
      where: { id: userId },
      select: { affiliation: true },
    });

    if (!self?.affiliation) return 50;

    const followingEdges = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
      take: 100,
    });

    if (followingEdges.length === 0) return 40;

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
    return Math.round(20 + crossPartyRatio * 80);
  } catch {
    return 50;
  }
}

/**
 * Factor 5: Verified Identity (0–100)
 */
async function computeVerifiedIdentity(userId: string): Promise<number> {
  try {
    const user = await prisma.searchableUser.findFirst({
      where: { id: userId },
      select: { verificationLevel: true },
    });

    if (!user) return 30;

    switch (user.verificationLevel) {
      case 'OFFICIAL_VERIFIED': return 100;
      case 'EXPERT_VERIFIED': return 95;
      case 'CITIZEN_VERIFIED': return 85;
      case 'EMAIL_VERIFIED': return 60;
      default: return 30;
    }
  } catch {
    return 30;
  }
}

/**
 * Factor 6: Behavioral Consistency (0–100)
 * Now uses CivilityEvents for violation tracking (durable even after deletion).
 */
async function computeBehavioralConsistency(userId: string): Promise<number> {
  const [published, history] = await Promise.all([
    prisma.storedPost.count({
      where: { authorId: userId, status: 'published', deletedAt: null },
    }),
    getCivilityHistory(userId),
  ]);

  if (published === 0 && (!history || history.totalEvents === 0)) return 50;

  // Violation ratio from durable events (not just deleted posts)
  const totalEvents = history?.totalEvents || 1;
  const violationRatio = (history?.violations || 0) / totalEvents;

  // 0% violations → 90, 10% → 78, 50% → 30
  const baseScore = Math.round(90 - violationRatio * 120);

  // Volume bonus for consistent positive posting
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

export async function recomputeCredibilityScore(
  userId: string,
): Promise<CredibilityBreakdown | null> {
  if (!isDbAvailable()) return null;

  try {
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

    const overall = Math.round(
      civilEngagement * WEIGHTS.civilEngagement +
      citationQuality * WEIGHTS.citationQuality +
      reportAccuracy * WEIGHTS.reportAccuracy +
      crossPartyEngagement * WEIGHTS.crossPartyEngagement +
      verifiedIdentity * WEIGHTS.verifiedIdentity +
      behavioralConsistency * WEIGHTS.behavioralConsistency,
    );

    const clampedScore = Math.max(0, Math.min(100, overall));

    await prisma.searchableUser.updateMany({
      where: { id: userId },
      data: { credibilityScore: clampedScore },
    });

    try {
      const avgCivility = civilEngagement / 100;
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
      // User record may not exist
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
 * Uses the civility result's severity classification for aggressive penalties.
 */
export async function incrementalCredibilityUpdate(
  userId: string,
  newPostCivilityScore: number,
  hasSourceUrl: boolean,
  severity?: string,
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

    let delta = 0;

    // Use severity classification for sharper penalties
    if (severity === 'critical') {
      delta -= 30; // Massive immediate drop (slurs, hate speech, violence)
    } else if (severity === 'high') {
      delta -= 20; // Large drop (dehumanization, xenophobia)
    } else if (newPostCivilityScore >= 0.8) {
      delta += 1;  // Good post — slow recovery
    } else if (newPostCivilityScore >= 0.5) {
      delta += 0;  // Mediocre — no change
    } else if (newPostCivilityScore >= 0.3) {
      delta -= 5;  // Uncivil
    } else {
      delta -= 10; // Severe
    }

    // Citation bonus
    if (hasSourceUrl) delta += 1;

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
