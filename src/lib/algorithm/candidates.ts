// ═══════════════════════════════════════════════════════════════
// Civic Social — Candidate Generation (X-Algorithm Port v1)
// ═══════════════════════════════════════════════════════════════
//
// Stops the O(n) "score every published post" pattern. Pulls
// at most ~1,500 candidates from four explicit sources with
// quotas, then dedupes by post id.
//
// Sources:
//   1. in-network               — followed users, last 7d
//   2. out-of-network-topic     — topic-match strangers, last 7d
//   3. cross-party              — opposite-affiliation high-civility, 48h
//   4. trending                 — engagement velocity × civility, 6h
//
// Backed by StoredPost (real DB table) + mv_author_profile +
// mv_trending_posts. Falls back to in-memory mock pool when
// Prisma is unavailable (dev without a DB).
// ═══════════════════════════════════════════════════════════════

import { prisma, isDbAvailable } from '@/lib/db';
import type {
  AlgoUser,
  AlgoPost,
  AlgoAuthor,
  FeedCandidate,
  CandidateBudget,
  CandidateSourceResult,
  CandidateSourceName,
} from './types';
import { DEFAULT_CANDIDATE_BUDGET } from './types';

// ─── Types for raw rows from each query ─────────────────────

interface StoredPostRow {
  id: string;
  authorId: string;
  content: string;
  topics: string[];
  civilityScore: number;
  createdAt: Date;
}

interface AuthorProfileRow {
  authorId: string;
  displayName: string;
  civicReputation: number;
  civilityAvg: number;
  accuracyScore: number;
  verificationLevel: string;
  affiliations: string[];
}

interface TrendingRow extends StoredPostRow {
  recent_comment_count: number;
  velocity: number;
  trending_score: number;
}

// ─── Public surface ─────────────────────────────────────────

export interface GenerateCandidatesResult {
  candidates: FeedCandidate[];
  sources: CandidateSourceResult[];
  total: number;
}

export interface GenerateCandidatesOptions {
  budget?: CandidateBudget;
  hashtag?: string;       // restrict every source to topic match
  followingOnly?: boolean; // 'following' tab — only fetch in-network
}

/**
 * Generate up to ~1,500 candidates for the viewer from four sources.
 * Returns deduped candidates + per-source telemetry.
 */
export async function generateCandidates(
  viewer: AlgoUser,
  opts: GenerateCandidatesOptions = {},
): Promise<GenerateCandidatesResult> {
  const budget = opts.budget ?? DEFAULT_CANDIDATE_BUDGET;

  // Following-tab override: only in-network, with full budget.
  if (opts.followingOnly) {
    const inNetBudget: CandidateBudget = {
      inNetwork: budget.inNetwork + budget.outOfNetworkTopic + budget.crossParty + budget.trending,
      outOfNetworkTopic: 0,
      crossParty: 0,
      trending: 0,
    };
    const { candidates, source } = await runSource('in-network', () =>
      fetchInNetwork(viewer, inNetBudget.inNetwork, opts.hashtag),
    );
    return { candidates, sources: [source], total: candidates.length };
  }

  // Parallel fetch from all four sources.
  const [inNet, oonTopic, crossParty, trending] = await Promise.all([
    runSource('in-network',
      () => fetchInNetwork(viewer, budget.inNetwork, opts.hashtag)),
    runSource('out-of-network-topic',
      () => fetchOutOfNetworkTopic(viewer, budget.outOfNetworkTopic, opts.hashtag)),
    runSource('cross-party',
      () => fetchCrossParty(viewer, budget.crossParty, opts.hashtag)),
    runSource('trending',
      () => fetchTrending(viewer, budget.trending, opts.hashtag)),
  ]);

  // Dedupe — in-network wins ties, then OON-topic, then cross-party, then trending.
  const seen = new Set<string>();
  const ordered = [
    ...inNet.candidates,
    ...oonTopic.candidates,
    ...crossParty.candidates,
    ...trending.candidates,
  ];
  const candidates: FeedCandidate[] = [];
  for (const c of ordered) {
    if (seen.has(c.post.id)) continue;
    seen.add(c.post.id);
    candidates.push(c);
  }

  return {
    candidates,
    sources: [inNet.source, oonTopic.source, crossParty.source, trending.source],
    total: candidates.length,
  };
}

// ─── Per-source helpers ─────────────────────────────────────

async function runSource(
  name: CandidateSourceName,
  fn: () => Promise<FeedCandidate[]>,
): Promise<{ candidates: FeedCandidate[]; source: CandidateSourceResult }> {
  const t0 = Date.now();
  let candidates: FeedCandidate[] = [];
  try {
    candidates = await fn();
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[candidates:${name}] query failed`, err);
    }
    candidates = [];
  }
  return {
    candidates,
    source: { source: name, fetched: candidates.length, queryMs: Date.now() - t0 },
  };
}

// 1. In-network: posts from followed users (last 7d).
async function fetchInNetwork(
  viewer: AlgoUser,
  limit: number,
  hashtag?: string,
): Promise<FeedCandidate[]> {
  if (!isDbAvailable() || !prisma) return [];

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const params: unknown[] = [viewer.id, since, limit];
  let topicClause = '';
  if (hashtag) {
    topicClause = ` AND $4 = ANY(sp."topics")`;
    params.push(hashtag);
  }

  const rows = await prisma.$queryRawUnsafe<StoredPostRow[]>(
    `SELECT sp."id", sp."authorId", sp."content", sp."topics",
            sp."civilityScore", sp."createdAt"
     FROM "StoredPost" sp
     WHERE sp."authorId" IN (
       SELECT "followingId" FROM "Follow" WHERE "followerId" = $1
     )
       AND sp."createdAt" > $2
       AND sp."status" = 'published'
       AND sp."deletedAt" IS NULL${topicClause}
     ORDER BY sp."createdAt" DESC
     LIMIT $3`,
    ...params,
  );

  return hydrate(rows);
}

// 2. Out-of-network topic-match (strict v1).
async function fetchOutOfNetworkTopic(
  viewer: AlgoUser,
  limit: number,
  hashtag?: string,
): Promise<FeedCandidate[]> {
  if (!isDbAvailable() || !prisma) return [];

  // Fallback: viewer has no declared topic interests — use trending source instead.
  const topicSeed = hashtag ? [hashtag] : viewer.topicInterests;
  if (!topicSeed || topicSeed.length === 0) return [];

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRawUnsafe<StoredPostRow[]>(
    `SELECT sp."id", sp."authorId", sp."content", sp."topics",
            sp."civilityScore", sp."createdAt"
     FROM "StoredPost" sp
     WHERE sp."topics" && $1::text[]
       AND sp."authorId" NOT IN (
         SELECT "followingId" FROM "Follow" WHERE "followerId" = $2
       )
       AND sp."authorId" <> $2
       AND sp."createdAt" > $3
       AND sp."status" = 'published'
       AND sp."deletedAt" IS NULL
       AND sp."civilityScore" >= 0.5
     ORDER BY sp."createdAt" DESC
     LIMIT $4`,
    topicSeed,
    viewer.id,
    since,
    limit,
  );

  return hydrate(rows);
}

// 3. Cross-party high-civility (48h).
async function fetchCrossParty(
  viewer: AlgoUser,
  limit: number,
  hashtag?: string,
): Promise<FeedCandidate[]> {
  if (!isDbAvailable() || !prisma) return [];
  // No defined affiliation = skip; trending budget will absorb.
  if (!viewer.affiliations || viewer.affiliations.length === 0) return [];

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const params: unknown[] = [viewer.affiliations, since, limit];
  let topicClause = '';
  if (hashtag) {
    topicClause = ` AND $4 = ANY(sp."topics")`;
    params.push(hashtag);
  }

  // Authors whose affiliations are DISJOINT from viewer's.
  // We use mv_author_profile.affiliations for this — refreshed hourly.
  const rows = await prisma.$queryRawUnsafe<StoredPostRow[]>(
    `SELECT sp."id", sp."authorId", sp."content", sp."topics",
            sp."civilityScore", sp."createdAt"
     FROM "StoredPost" sp
     JOIN "mv_author_profile" ap ON ap."authorId" = sp."authorId"
     WHERE NOT (ap."affiliations" && $1::text[])
       AND array_length(ap."affiliations", 1) IS NOT NULL
       AND sp."civilityScore" >= 0.7
       AND sp."createdAt" > $2
       AND sp."status" = 'published'
       AND sp."deletedAt" IS NULL${topicClause}
     ORDER BY sp."civilityScore" DESC, sp."createdAt" DESC
     LIMIT $3`,
    ...params,
  );

  return hydrate(rows);
}

// 4. Trending: read from precomputed matview.
async function fetchTrending(
  _viewer: AlgoUser,
  limit: number,
  hashtag?: string,
): Promise<FeedCandidate[]> {
  if (!isDbAvailable() || !prisma) return [];

  const params: unknown[] = [limit];
  let topicClause = '';
  if (hashtag) {
    topicClause = ` AND $2 = ANY("topics")`;
    params.push(hashtag);
  }

  const rows = await prisma.$queryRawUnsafe<TrendingRow[]>(
    `SELECT "postId" AS "id", "authorId", "content", "topics",
            "civilityScore", "createdAt",
            "recent_comment_count", "velocity", "trending_score"
     FROM "mv_trending_posts"
     WHERE 1=1${topicClause}
     ORDER BY "trending_score" DESC
     LIMIT $1`,
    ...params,
  );

  return hydrate(rows);
}

// ─── Hydration: rows → FeedCandidate[] ──────────────────────

async function hydrate(rows: StoredPostRow[]): Promise<FeedCandidate[]> {
  if (rows.length === 0) return [];
  if (!prisma) return [];

  const authorIds = Array.from(new Set(rows.map((r) => r.authorId)));
  const authorRows = await prisma.$queryRawUnsafe<AuthorProfileRow[]>(
    `SELECT "authorId", "displayName", "civicReputation", "civilityAvg",
            "accuracyScore", "verificationLevel", "affiliations"
     FROM "mv_author_profile"
     WHERE "authorId" = ANY($1::text[])`,
    authorIds,
  );
  const authorById = new Map(authorRows.map((a) => [a.authorId, a]));

  return rows.map((r) => {
    const a = authorById.get(r.authorId);
    const author: AlgoAuthor = {
      id: r.authorId,
      displayName: a?.displayName ?? 'User',
      affiliations: a?.affiliations ?? [],
      verificationLevel: a?.verificationLevel ?? 'EMAIL_VERIFIED',
      civicReputation: a?.civicReputation ?? 0.5,
      civilityAvg: a?.civilityAvg ?? 0.5,
      accuracyScore: a?.accuracyScore ?? 0.5,
    };
    const post: AlgoPost = {
      id: r.id,
      content: r.content,
      createdAt: r.createdAt,
      topics: r.topics ?? [],
      civilityScore: r.civilityScore,
      // Fields that StoredPost doesn't carry yet — neutral defaults
      // (heavy ranker still functions; these signals just contribute 0).
      toxicityScore: 0,
      solutionOrientation: 0,
      empathyScore: 0,
      avgReadTime: 0,
      expectedReadTime: 0,
      completionRate: 0,
      replyCount: 0,
      substantiveReplies: 0,
      sources: [],
      rageBaitScore: 0,
      allCapsRatio: 0,
      botLikelihood: 0,
      flagCount: 0,
      agreeCount: 0,
      disagreeCount: 0,
      insightfulCount: 0,
      nuanceCount: 0,
    };
    return { post, author };
  });
}
