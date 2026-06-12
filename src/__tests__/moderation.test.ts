// ═══════════════════════════════════════════════════════════════
// Moderation Engine — comprehensive test suite
// ═══════════════════════════════════════════════════════════════
// Tests use obfuscated/mild stand-ins for the worst content where
// possible. Where real slur patterns must be exercised, tests use
// leetspeak variants so the repo doesn't carry raw hate strings.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { moderateLocal, blendProviderVerdict } from '@/lib/moderation/analyzer';
import { analyzeCivility } from '@/lib/civility';
import { normalizeForMatching } from '@/lib/moderation/local-rules';
import type { ProviderVerdict } from '@/lib/moderation/types';

// ─── Civil discourse (must be allowed, high scores) ──────────

describe('civil discourse — must score well and be allowed', () => {
  it('civil disagreement scores high', () => {
    const r = moderateLocal(
      'I understand your point, however I think the evidence suggests otherwise. According to the CBO report, the deficit grew 12% — I believe we should consider a different approach.',
    );
    expect(r.action).toBe('allow');
    expect(r.score).toBeGreaterThan(0.7);
    expect(r.severity).toBe('none');
  });

  it('strong policy criticism is allowed', () => {
    const r = moderateLocal(
      'This bill is a disaster for working families. The tax provisions overwhelmingly favor corporations and the spending cuts will hurt rural hospitals.',
    );
    expect(r.action).toBe('allow');
    expect(r.severity).toBe('none');
  });

  it('criticizing a politician by name is allowed', () => {
    const r = moderateLocal(
      'The governor broke his campaign promise on education funding. He should be voted out for this.',
    );
    expect(r.action).toBe('allow');
    expect(r.severity).toBe('none');
  });

  it('"worst president" is normal political speech — never more than low severity', () => {
    const r = moderateLocal('He is the worst president in modern history and his trade policy proves it.');
    expect(['allow', 'nudge']).toContain(r.action);
    expect(['none', 'low']).toContain(r.severity);
  });

  it('criticizing political parties is allowed', () => {
    const r = moderateLocal(
      'The party leadership has abandoned its principles. Their healthcare position contradicts what they ran on in 2024.',
    );
    expect(r.action).toBe('allow');
  });

  it('evidence-based constructive post scores very high', () => {
    const r = moderateLocal(
      'According to peer-reviewed research published last year, the policy reduced emissions by 18%. I propose we expand the program — a possible approach would be bipartisan state-level pilots. I appreciate the concerns about cost, and that trade-off deserves real discussion.',
    );
    expect(r.score).toBeGreaterThan(0.8);
    expect(r.action).toBe('allow');
    expect(r.signals.evidenceOrientation).toBeGreaterThan(0.3);
    expect(r.signals.solutionOrientation).toBeGreaterThan(0.3);
  });

  it('nuanced disagreement keeps high score', () => {
    const r = moderateLocal(
      'Fair point about the budget impact. That said, I think the data shows the benefits outweigh the costs, although reasonable people can disagree on the discount rate.',
    );
    expect(r.score).toBeGreaterThan(0.7);
    expect(r.signals.empathy).toBeGreaterThan(0);
  });
});

// ─── Personal attacks / harassment ───────────────────────────

describe('personal attacks and harassment', () => {
  it('direct personal attack gets nudge or hold, never silently allowed', () => {
    const r = moderateLocal("You're an idiot and everyone here knows it. Pathetic.");
    expect(['nudge', 'hold_for_review']).toContain(r.action);
    expect(r.signals.personalAttack).toBeGreaterThan(0.3);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it('harassment campaign organization is blocked', () => {
    const r = moderateLocal("Let's all report his account and make his life hell until he leaves.");
    expect(r.action).toBe('block');
    expect(r.category).toBe('harassment');
  });

  it('profanity lowers score but does not block', () => {
    const r = moderateLocal('This fucking bill is bullshit and the committee knows it.');
    expect(r.action).not.toBe('block');
    expect(r.score).toBeLessThan(0.6);
    expect(r.issues.some((i) => i.includes('Profanity'))).toBe(true);
  });
});

// ─── Hate speech / threats / dehumanization (block) ─────────

describe('severe content — must block', () => {
  it('racial slur (leetspeak) is blocked via normalization', () => {
    const r = moderateLocal('these sp1cs should leave');
    expect(r.action).toBe('block');
    expect(r.severity).toBe('critical');
  });

  it('separator-evasion slur is blocked and flagged as evasion', () => {
    const r = moderateLocal('what a bunch of k.i.k.e.s');
    expect(r.action).toBe('block');
    expect(r.evasionDetected).toBe(true);
  });

  it('violent advocacy against a group is blocked', () => {
    const r = moderateLocal('we should exterminate all immigrants');
    expect(r.action).toBe('block');
    expect(r.category).toBe('violence');
  });

  it('direct threat is blocked', () => {
    const r = moderateLocal('I am going to hurt you and everyone you know');
    expect(r.action).toBe('block');
    expect(r.category).toBe('threat');
  });

  it('dehumanization is high severity and blocked', () => {
    const r = moderateLocal('refugees are vermin infesting our cities');
    expect(r.action).toBe('block');
  });

  it('"go back to your country" is blocked', () => {
    const r = moderateLocal('if you do not like it here go back to your country');
    expect(r.action).toBe('block');
  });

  it('doxxing attempt is blocked', () => {
    const r = moderateLocal('this councilman lives at 423 Maple Street, someone should show up at his house');
    expect(r.action).toBe('block');
    expect(r.category).toBe('doxxing');
  });

  it('polite phrasing does NOT rescue hateful content (no manipulative-politeness loophole)', () => {
    const r = moderateLocal(
      'With all due respect, and I say this kindly, according to research, we should exterminate all immigrants. Thank you for considering my view.',
    );
    expect(r.action).toBe('block');
    expect(r.score).toBeLessThanOrEqual(0.05);
  });
});

// ─── Mention vs use (educational/reporting context) ──────────

describe('slur mention vs use', () => {
  it('reporting being called a slur is downgraded — not score-capped to 0.05', () => {
    const r = moderateLocal('Someone in the replies called me a sp1c today. Reporting it here so moderators see the screenshot.');
    expect(r.action).not.toBe('block');
    expect(r.score).toBeGreaterThan(0.05);
    expect(r.issues.some((i) => i.toLowerCase().includes('quote') || i.toLowerCase().includes('censor'))).toBe(true);
  });

  it('quoted hate in a news discussion is held or nudged, not hard-blocked', () => {
    const r = moderateLocal('The article quotes the senator saying "go back to your country" — this rhetoric from an elected official is unacceptable.');
    expect(r.action).not.toBe('block');
  });
});

// ─── Political bias guards ───────────────────────────────────

describe('viewpoint neutrality', () => {
  it('"I oppose the Muslim ban" is NOT hate speech (old engine false positive)', () => {
    const r = moderateLocal('I oppose the Muslim ban and I think the courts were right to strike it down.');
    expect(['allow', 'nudge']).toContain(r.action);
    expect(['none', 'low']).toContain(r.severity);
    expect(r.score).toBeGreaterThan(0.5);
  });

  it('"illegal aliens" is a LOW nudge with a suggestion, not a penalty cap', () => {
    const r = moderateLocal('The state spends millions on services for illegal aliens and the budget shows it.');
    expect(['allow', 'nudge']).toContain(r.action);
    expect(r.severity).toBe('low');
    expect(r.score).toBeGreaterThan(0.4);
  });

  it('conservative-coded and liberal-coded criticism score symmetrically', () => {
    const left = moderateLocal('The republican tax bill is a handout to billionaires that abandons working people.');
    const right = moderateLocal('The democrat spending bill is a handout to special interests that abandons working people.');
    expect(Math.abs(left.score - right.score)).toBeLessThan(0.05);
    expect(left.action).toBe(right.action);
  });

  it('conspiracy-coded vocabulary alone is a nudge, not a cap', () => {
    const r = moderateLocal('Wake up — the mainstream coverage of this bill ignores what the committee actually voted on.');
    expect(['allow', 'nudge']).toContain(r.action);
    expect(['none', 'low']).toContain(r.severity);
  });

  it('group generalization about a political side is flagged but not blocked', () => {
    const r = moderateLocal('All democrats want open borders and all republicans want zero immigration.');
    expect(r.action).not.toBe('block');
    expect(r.signals.groupGeneralization).toBeGreaterThan(0);
  });
});

// ─── Spam / rage bait / formatting ───────────────────────────

describe('spam and rage bait', () => {
  it('rage bait (short + inflammatory + no substance) tanks score', () => {
    const r = moderateLocal('They are all corrupt evil trash!!!');
    expect(r.score).toBeLessThan(0.5);
    expect(r.signals.rageBait).toBeGreaterThan(0.4);
  });

  it('hashtag stuffing is flagged', () => {
    const r = moderateLocal('Big news! #politics #news #breaking #viral #trending #must #see #now');
    expect(r.issues.some((i) => i.includes('hashtags'))).toBe(true);
  });

  it('ALL CAPS shouting is penalized', () => {
    const r = moderateLocal('THIS IS COMPLETELY UNACCEPTABLE AND EVERYONE SHOULD BE ANGRY');
    expect(r.score).toBeLessThan(0.6);
  });

  it('acronyms do not trigger caps penalty (USA, FBI, COVID)', () => {
    const r = moderateLocal('The FBI and DOJ released the COVID-era records to the USA Today reporters who requested them.');
    expect(r.score).toBeGreaterThan(0.55);
  });

  it('link-only post gets a nudge issue', () => {
    const r = moderateLocal('https://example.com/article');
    expect(r.issues.some((i) => i.includes('Link-only'))).toBe(true);
  });
});

// ─── Evasion normalization unit tests ────────────────────────

describe('normalizeForMatching', () => {
  it('maps leetspeak', () => {
    expect(normalizeForMatching('h4t3 sp33ch').spaced).toBe('hate speech');
  });
  it('strips separators in loose form', () => {
    expect(normalizeForMatching('h-a-t-e').loose).toBe('hate');
  });
  it('collapses repeated characters', () => {
    expect(normalizeForMatching('stuuuupid').spaced).toContain('stupid');
  });
  it('maps cyrillic confusables', () => {
    expect(normalizeForMatching('hаte').spaced).toBe('hate'); // Cyrillic а
  });
  it('preserves prices and years', () => {
    expect(normalizeForMatching('the $5 billion budget in 2026').spaced).toContain('$5 billion');
  });
});

// ─── Legacy contract (analyzeCivility wrapper) ───────────────

describe('analyzeCivility backward compatibility', () => {
  it('returns the legacy shape', () => {
    const r = analyzeCivility('I think this policy is reasonable because the data supports it.');
    expect(typeof r.score).toBe('number');
    expect(Array.isArray(r.issues)).toBe(true);
    expect(['critical', 'high', 'medium', 'low', 'none']).toContain(r.severity);
    expect(['racism', 'hate_speech', 'violence', 'harassment', 'profanity', 'incivility', 'none']).toContain(r.category);
  });

  it('maps new categories to legacy vocabulary', () => {
    const r = analyzeCivility('this councilman lives at 423 Maple Street, someone should show up at his house');
    expect(r.category).toBe('harassment'); // doxxing → harassment in legacy terms
  });

  it('empty text returns perfect score', () => {
    const r = analyzeCivility('');
    expect(r.score).toBe(1);
    expect(r.severity).toBe('none');
  });

  it('exposes the full moderation result for new consumers', () => {
    const r = analyzeCivility('test post');
    expect(r.moderation).toBeDefined();
    expect(r.moderation.action).toBeDefined();
    expect(r.moderation.signals).toBeDefined();
  });
});

// ─── Provider blending (AI output is signal, not authority) ──

describe('blendProviderVerdict', () => {
  const base = moderateLocal('The committee vote was rushed and I think leadership owes an explanation.');

  it('provider cannot unblock local block', () => {
    const blocked = moderateLocal('we should exterminate all immigrants');
    const verdict: ProviderVerdict = { score: 0.9, severity: 'none', rationale: 'fine', suggestedAction: 'allow' };
    const blended = blendProviderVerdict(blocked, verdict);
    expect(blended.action).toBe('block');
    expect(blended.score).toBe(blocked.score);
  });

  it('provider score influence is clamped to ±0.15', () => {
    const verdict: ProviderVerdict = { score: 0, severity: 'none', rationale: '', suggestedAction: 'allow' };
    const blended = blendProviderVerdict(base, verdict);
    expect(base.score - blended.score).toBeLessThanOrEqual(0.15 + 1e-9);
  });

  it('provider escalation moves action at most one step, never to block', () => {
    const verdict: ProviderVerdict = { score: 0.1, severity: 'high', rationale: '', suggestedAction: 'block' };
    const blended = blendProviderVerdict(base, verdict);
    expect(blended.action).not.toBe('block');
    expect(['nudge', 'hold_for_review']).toContain(blended.action);
  });

  it('blend marks both engines used', () => {
    const verdict: ProviderVerdict = { score: 0.7, severity: 'none', rationale: '', suggestedAction: 'allow' };
    const blended = blendProviderVerdict(base, verdict);
    expect(blended.enginesUsed).toContain('local');
    expect(blended.enginesUsed).toContain('provider');
  });
});

// ─── Action thresholds ───────────────────────────────────────

describe('policy actions', () => {
  it('neutral statement → allow', () => {
    expect(moderateLocal('The hearing is scheduled for next Tuesday at the capitol.').action).toBe('allow');
  });

  it('results include confidence in (0,1]', () => {
    const r = moderateLocal('Some text to score.');
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('severe results have high confidence', () => {
    const r = moderateLocal('we should exterminate all immigrants');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('suggestions are capped at 3 (no nagging)', () => {
    const r = moderateLocal("You're an idiot. Obviously all democrats are corrupt. Do your research. Wake up sheeple. I hate everything!!!");
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
  });
});
