// ═══════════════════════════════════════════════════════════════
// Civic Social — Light Ranker (X-Algorithm Port v1)
// ═══════════════════════════════════════════════════════════════
//
// First-pass scoring. Narrows ~1500 candidates → ~200 using
// only cheap arithmetic, no Prisma calls. The heavy ranker then
// runs the full 6+1 signal pipeline on the survivors.
//
// Signals (light):
//   1. recency decay     — exp(-ageHours / halfLife)
//   2. content civility  — post.civilityScore
//   3. author civility   — author.civicReputation
//   4. topic match boost — Jaccard(post.topics, viewer.topicInterests)
//
// Light score = 0.35·recency + 0.30·postCivility + 0.20·authorRep
//             + 0.15·topicMatch
//
// Bias preserved: civility (post + author) is 50% of the light
// score — same supremacy as the heavy ranker. We aren't sneaking
// engagement-prediction in through the back door.
// ═══════════════════════════════════════════════════════════════

import type { FeedCandidate, AlgoUser } from './types';

export interface LightRankedCandidate {
  candidate: FeedCandidate;
  lightScore: number;
}

export interface LightRankOptions {
  /** How many to keep. Default 200. */
  keep?: number;
  /** Recency half-life in hours. Default 24. */
  recencyHalfLifeHours?: number;
}

const W_RECENCY = 0.35;
const W_POST_CIVILITY = 0.30;
const W_AUTHOR_REP = 0.20;
const W_TOPIC = 0.15;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersect = 0;
  for (const x of setA) if (setB.has(x)) intersect += 1;
  const union = setA.size + setB.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

function recencyScore(createdAt: Date, halfLifeHours: number): number {
  const ageMs = Date.now() - createdAt.getTime();
  const ageHours = Math.max(0, ageMs / (1000 * 60 * 60));
  return clamp01(Math.exp(-Math.LN2 * ageHours / halfLifeHours));
}

export function lightRank(
  candidates: FeedCandidate[],
  viewer: AlgoUser,
  opts: LightRankOptions = {},
): LightRankedCandidate[] {
  const keep = opts.keep ?? 200;
  const halfLife = opts.recencyHalfLifeHours ?? 24;

  const scored: LightRankedCandidate[] = candidates.map((c) => {
    const recency = recencyScore(c.post.createdAt, halfLife);
    const postCivility = clamp01(c.post.civilityScore);
    const authorRep = clamp01(c.author.civicReputation);
    const topicMatch = jaccard(c.post.topics, viewer.topicInterests);

    const lightScore =
        W_RECENCY * recency
      + W_POST_CIVILITY * postCivility
      + W_AUTHOR_REP * authorRep
      + W_TOPIC * topicMatch;

    return { candidate: c, lightScore };
  });

  scored.sort((a, b) => b.lightScore - a.lightScore);
  return scored.slice(0, keep);
}
