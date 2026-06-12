// ═══════════════════════════════════════════════════════════════
// X-Algorithm Port v1 — unit tests
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { lightRank } from '@/lib/algorithm/light-ranker';
import { computeRealGraph } from '@/lib/algorithm/signals';
import { scoreCandidate } from '@/lib/algorithm/scoring';
import { DEFAULT_CONFIG } from '@/lib/algorithm/types';
import type {
  FeedCandidate,
  AlgoUser,
  AlgoPost,
  AlgoAuthor,
} from '@/lib/algorithm/types';

// ─── Helpers ─────────────────────────────────────────────────

function makePost(overrides: Partial<AlgoPost> = {}): AlgoPost {
  return {
    id: overrides.id ?? `post-${Math.random().toString(36).slice(2)}`,
    content: 'Lorem ipsum about civic discourse.',
    createdAt: overrides.createdAt ?? new Date(),
    topics: overrides.topics ?? [],
    civilityScore: overrides.civilityScore ?? 0.8,
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
    ...overrides,
  };
}

function makeAuthor(overrides: Partial<AlgoAuthor> = {}): AlgoAuthor {
  return {
    id: overrides.id ?? `author-${Math.random().toString(36).slice(2)}`,
    displayName: 'Test Author',
    affiliations: ['center'],
    verificationLevel: 'EMAIL_VERIFIED',
    civicReputation: 0.6,
    civilityAvg: 0.7,
    accuracyScore: 0.7,
    ...overrides,
  };
}

function makeCandidate(
  post: Partial<AlgoPost> = {},
  author: Partial<AlgoAuthor> = {},
): FeedCandidate {
  return { post: makePost(post), author: makeAuthor(author) };
}

const VIEWER: AlgoUser = {
  id: 'viewer-1',
  affiliations: ['left'],
  topicInterests: ['healthcare', 'climate'],
  followingIds: [],
  civicReputation: 0.6,
  civilityAvg: 0.7,
  country: 'US',
};

// ─── Light ranker ────────────────────────────────────────────

describe('lightRank', () => {
  it('keeps the requested count', () => {
    const candidates = Array.from({ length: 100 }, () => makeCandidate());
    const out = lightRank(candidates, VIEWER, { keep: 20 });
    expect(out).toHaveLength(20);
  });

  it('orders by lightScore descending', () => {
    const old = makeCandidate({
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      civilityScore: 0.5,
      topics: [],
    });
    const fresh = makeCandidate({
      createdAt: new Date(),
      civilityScore: 0.95,
      topics: ['healthcare'],
    });
    const out = lightRank([old, fresh], VIEWER, { keep: 2 });
    expect(out[0].candidate).toBe(fresh);
    expect(out[0].lightScore).toBeGreaterThan(out[1].lightScore);
  });

  it('rewards recency, civility, author rep, and topic match', () => {
    const matching = makeCandidate(
      { topics: ['healthcare'], civilityScore: 0.9 },
      { civicReputation: 0.9 },
    );
    const empty = makeCandidate(
      { topics: ['unrelated'], civilityScore: 0.3 },
      { civicReputation: 0.2 },
    );
    const [first] = lightRank([empty, matching], VIEWER, { keep: 2 });
    expect(first.candidate).toBe(matching);
  });

  it('handles empty candidate list', () => {
    expect(lightRank([], VIEWER)).toEqual([]);
  });
});

// ─── Real-Graph signal ──────────────────────────────────────

describe('computeRealGraph', () => {
  it('returns 0 when author not in affinity map', () => {
    const map = new Map<string, number>();
    expect(computeRealGraph('absent-author', map)).toBe(0);
  });

  it('returns the affinity value when present', () => {
    const map = new Map<string, number>([['author-a', 0.7]]);
    expect(computeRealGraph('author-a', map)).toBe(0.7);
  });

  it('clamps to [0, 1]', () => {
    const map = new Map<string, number>([
      ['low', -0.5],
      ['high', 1.5],
    ]);
    expect(computeRealGraph('low', map)).toBe(0);
    expect(computeRealGraph('high', map)).toBe(1);
  });
});

// ─── Scoring integration with realGraph ─────────────────────

describe('scoreCandidate with Real-Graph', () => {
  it('produces same score as before when affinity is empty (backwards compat)', () => {
    const c = makeCandidate({ topics: ['healthcare'], civilityScore: 0.85 });
    const without = scoreCandidate(c, VIEWER, DEFAULT_CONFIG);
    const withEmpty = scoreCandidate(c, VIEWER, DEFAULT_CONFIG, {
      affinityMap: new Map(),
    });
    expect(withEmpty.qualityScore).toBeCloseTo(without.qualityScore, 6);
  });

  it('boosts a familiar author over a stranger of equal post quality', () => {
    const familiar = makeCandidate({ id: 'p1' }, { id: 'author-known' });
    const stranger = makeCandidate({ id: 'p2' }, { id: 'author-new' });

    const map = new Map<string, number>([['author-known', 0.9]]);
    const familiarScore = scoreCandidate(familiar, VIEWER, DEFAULT_CONFIG, {
      affinityMap: map,
    });
    const strangerScore = scoreCandidate(stranger, VIEWER, DEFAULT_CONFIG, {
      affinityMap: map,
    });

    expect(familiarScore.qualityScore).toBeGreaterThan(strangerScore.qualityScore);
    expect(familiarScore.signals.realGraph).toBe(0.9);
    expect(strangerScore.signals.realGraph).toBe(0);
  });

  it('civility weight (0.25) still dominates realGraph (0.10)', () => {
    expect(DEFAULT_CONFIG.weights.civility).toBeGreaterThan(
      DEFAULT_CONFIG.weights.realGraph * 2,
    );
  });

  it('weights still sum to 1.00', () => {
    const w = DEFAULT_CONFIG.weights;
    const sum =
        w.engagementQuality + w.civility + w.viewpointDiversity
      + w.sourceCredibility + w.topicRelevance + w.authorReputation
      + w.realGraph;
    expect(sum).toBeCloseTo(1.0, 6);
  });

  it('produces "familiar-author" explanation tag when affinity is high', () => {
    const c = makeCandidate({}, { id: 'familiar' });
    const map = new Map<string, number>([['familiar', 0.8]]);
    const result = scoreCandidate(c, VIEWER, DEFAULT_CONFIG, { affinityMap: map });
    expect(result.explanationTags).toContain('familiar-author');
  });
});
