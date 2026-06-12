// ═══════════════════════════════════════════════════════════════
// Civic Social — Moderation Policy
// ═══════════════════════════════════════════════════════════════
// The single place where scores/severities map to actions, and
// where the platform's moderation principles are written down.
//
// PRINCIPLES (enforced by tests in moderation.test.ts):
//
// 1. VIEWPOINT NEUTRALITY. We judge tone, threats, hate,
//    harassment, evidence quality, and constructiveness — never
//    whether an opinion is left, right, popular, or unpopular.
// 2. POLITICAL SPEECH IS PROTECTED. Criticizing politicians,
//    parties, policies, and institutions — even harshly — is
//    allowed. "X is the worst president" is normal speech.
// 3. NO MANIPULATIVE-POLITENESS LOOPHOLE. Politely-worded
//    threats, hate, or dehumanization are still severe. Bonuses
//    never override severity ceilings.
// 4. SEVERE CONTENT IS FIRMLY BLOCKED. Slurs, credible threats,
//    violent advocacy, dehumanization, doxxing: blocked with a
//    clear, direct explanation.
// 5. NUDGE, DON'T PUNISH, FOR TONE. Insults, profanity, and
//    rage-bait lower score and trigger coaching, not censorship.
// 6. EVASION ESCALATES. Deliberately masking a slur shows intent;
//    masked violations are treated as the unmasked severity and
//    flagged for rate-limiting.
// ═══════════════════════════════════════════════════════════════

import type { ModerationAction, ModerationSeverity, ModerationCategory } from './types';

export interface PolicyInput {
  score: number;
  severity: ModerationSeverity;
  category: ModerationCategory;
  evasionDetected: boolean;
  mentionContext: boolean;
}

export interface PolicyDecision {
  action: ModerationAction;
  userMessage: string | null;
}

/** Score thresholds (after severity caps are applied). */
export const POLICY_THRESHOLDS = {
  /** Below this (with medium issues) → hold for human review. */
  holdBelow: 0.35,
  /** Below this → publish with a nudge. */
  nudgeBelow: 0.6,
} as const;

/** Severity ceilings — a matching violation caps the score. */
export const SEVERITY_CEILINGS: Partial<Record<ModerationSeverity, number>> = {
  critical: 0.05,
  high: 0.15,
  medium: 0.55,
};

const FIRM_BLOCK_MESSAGES: Partial<Record<ModerationCategory, string>> = {
  racism: 'This post contains racial slurs or supremacist language, which Civic Social does not allow under any circumstances.',
  hate_speech: 'This post contains hate speech targeting a group of people. Strong disagreement is welcome here — hate is not.',
  violence: 'This post advocates violence. That is never allowed on Civic Social.',
  threat: 'This post contains a threat. Threats are never allowed and may be reported to authorities where required.',
  doxxing: 'This post shares or seeks someone’s private information. Doxxing is strictly prohibited.',
  harassment: 'This post organizes or directs harassment at a person. That is not allowed.',
  evasion: 'This post attempts to disguise prohibited language. Masked slurs and threats are treated exactly like unmasked ones.',
};

export function decideAction(input: PolicyInput): PolicyDecision {
  const { score, severity, category, evasionDetected, mentionContext } = input;

  // Severe content → firm block. Evasion of severe content → block + note.
  if (severity === 'critical' || (severity === 'high' && !mentionContext)) {
    const msg = evasionDetected
      ? FIRM_BLOCK_MESSAGES.evasion!
      : FIRM_BLOCK_MESSAGES[category] ?? 'This post violates Civic Social community standards and cannot be published.';
    return { action: 'block', userMessage: msg };
  }

  // Evasion attempts below the severe tier → rate-limit signal
  // (published this time, counted against the author's abuse budget).
  if (evasionDetected) {
    return {
      action: 'rate_limit',
      userMessage: 'Parts of this post appear to disguise flagged language. Repeated attempts will limit your posting.',
    };
  }

  // Downgraded mention-context (quoting/reporting a slur) → hold for review
  // when the score is still very low, otherwise nudge with censoring advice.
  if (mentionContext && score < POLICY_THRESHOLDS.holdBelow) {
    return {
      action: 'hold_for_review',
      userMessage: 'Because this post quotes severe language, it has been sent to a moderator for a quick review before publishing.',
    };
  }

  if (severity === 'medium' && score < POLICY_THRESHOLDS.holdBelow) {
    return {
      action: 'hold_for_review',
      userMessage: 'This post was held for a quick review — it reads as a personal attack rather than a critique. A moderator will take a look shortly.',
    };
  }

  if (score < POLICY_THRESHOLDS.nudgeBelow) {
    return {
      action: 'nudge',
      userMessage: 'Posted. A heads-up: posts like this tend to rank lower in feeds. The suggestions below can help it reach more readers.',
    };
  }

  return { action: 'allow', userMessage: null };
}
