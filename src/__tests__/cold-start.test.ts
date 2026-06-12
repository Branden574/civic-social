import { describe, it, expect } from 'vitest';
import {
  generateColdStartFeed,
  PHASE_CONFIGS,
  determinePhase,
  computeWarmupProgress,
} from '@/lib/algorithm/cold-start';
import { mockCandidates, mockUsers } from '@/lib/data/mock-data';
import type { ColdStartProfile } from '@/lib/algorithm/cold-start';

describe('Cold-Start Feed Engine v2', () => {
  const user = mockUsers.current;

  it('generates a feed for a brand-new user (day 0, phase 0)', () => {
    const profile: ColdStartProfile = {
      topics: ['healthcare', 'economy', 'climate'],
      country: 'US',
      affiliation: 'center-left',
      daysSinceSignup: 0,
      interactionCount: 0,
    };

    const result = generateColdStartFeed(mockCandidates, user, profile, 20);

    expect(result.coldStartActive).toBe(true);
    expect(result.phase).toBe(0);
    expect(result.warmupProgress).toBe(0);
    expect(result.posts.length).toBeGreaterThan(0);
    expect(result.posts.length).toBeLessThanOrEqual(20);
  });

  it('applies aggressive quality gates — no toxic content for new users', () => {
    const profile: ColdStartProfile = {
      topics: ['healthcare'],
      country: 'US',
      affiliation: '',
      daysSinceSignup: 1,
      interactionCount: 10,
    };

    const result = generateColdStartFeed(mockCandidates, user, profile, 50);

    for (const post of result.posts) {
      expect(post.candidate.post.toxicityScore).toBeLessThanOrEqual(0.4);
      expect(post.candidate.post.rageBaitScore).toBeLessThanOrEqual(0.3);
      expect(post.candidate.post.civilityScore).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('determines correct phase from profile', () => {
    expect(determinePhase({ topics: [], country: 'US', affiliation: '', daysSinceSignup: 0, interactionCount: 0 })).toBe(0);
    expect(determinePhase({ topics: [], country: 'US', affiliation: '', daysSinceSignup: 0, interactionCount: 3 })).toBe(0);
    expect(determinePhase({ topics: [], country: 'US', affiliation: '', daysSinceSignup: 1, interactionCount: 10 })).toBe(1);
    expect(determinePhase({ topics: [], country: 'US', affiliation: '', daysSinceSignup: 3, interactionCount: 40 })).toBe(1);
    expect(determinePhase({ topics: [], country: 'US', affiliation: '', daysSinceSignup: 5, interactionCount: 60 })).toBe(2);
  });

  it('computes warmup progress from days + interactions', () => {
    // Day 0, 0 interactions: 0
    const w0 = computeWarmupProgress({ topics: [], country: 'US', affiliation: '', daysSinceSignup: 0, interactionCount: 0 });
    expect(w0).toBe(0);

    // Day 3, 20 interactions: 0.6*(3/7) + 0.4*(20/100) = 0.257 + 0.08 ≈ 0.34
    const w3 = computeWarmupProgress({ topics: [], country: 'US', affiliation: '', daysSinceSignup: 3, interactionCount: 20 });
    expect(w3).toBeGreaterThan(0.3);
    expect(w3).toBeLessThan(0.5);

    // Day 7, 100 interactions: capped at 1.0
    const w7 = computeWarmupProgress({ topics: [], country: 'US', affiliation: '', daysSinceSignup: 7, interactionCount: 100 });
    expect(w7).toBe(1);
  });

  it('phase configs prioritize civility and safety in early phases', () => {
    const phase0 = PHASE_CONFIGS[0];
    const phase1 = PHASE_CONFIGS[1];
    const phase2 = PHASE_CONFIGS[2];

    // Phase 0: highest civility, lowest engagement weight
    expect(phase0.weights.civility).toBeGreaterThan(phase0.weights.engagementQuality);
    expect(phase0.penaltyMultiplier).toBe(3.0);

    // Phase 1: still civility-heavy
    expect(phase1.weights.civility).toBe(0.30);
    expect(phase1.penaltyMultiplier).toBe(2.5);

    // Phase 2: more balanced. topicRelevance trimmed 0.20 → 0.17
    // when X-port v1 added realGraph signal (0.03 of weight redistributed).
    expect(phase2.weights.topicRelevance).toBe(0.17);
    expect(phase2.weights.realGraph).toBe(0.05);
    expect(phase2.penaltyMultiplier).toBe(2.0);

    // Civility supremacy is preserved across every phase.
    expect(phase0.weights.civility).toBeGreaterThan(phase0.weights.realGraph);
    expect(phase1.weights.civility).toBeGreaterThan(phase1.weights.realGraph);
    expect(phase2.weights.civility).toBeGreaterThan(phase2.weights.realGraph);
  });

  it('produces diverse viewpoints from day 1', () => {
    const profile: ColdStartProfile = {
      topics: ['healthcare', 'economy'],
      country: 'US',
      affiliation: 'center-left',
      daysSinceSignup: 0,
      interactionCount: 0,
    };

    const result = generateColdStartFeed(mockCandidates, user, profile, 30);

    const affiliations = new Set<string>();
    for (const post of result.posts) {
      for (const aff of post.candidate.author.affiliations) {
        affiliations.add(aff);
      }
    }
    expect(affiliations.size).toBeGreaterThanOrEqual(2);
  });

  it('gradually transitions to standard algorithm by day 7+', () => {
    const early: ColdStartProfile = { topics: ['economy'], country: 'US', affiliation: '', daysSinceSignup: 1, interactionCount: 5 };
    const late: ColdStartProfile = { topics: ['economy'], country: 'US', affiliation: '', daysSinceSignup: 7, interactionCount: 100 };

    const earlyResult = generateColdStartFeed(mockCandidates, user, early, 10);
    const lateResult = generateColdStartFeed(mockCandidates, user, late, 10);

    expect(earlyResult.coldStartActive).toBe(true);
    // warmup = min(0.6*(7/7) + 0.4*(100/100), 1) = 1.0 => coldStartActive = false
    expect(lateResult.coldStartActive).toBe(false);
  });
});
