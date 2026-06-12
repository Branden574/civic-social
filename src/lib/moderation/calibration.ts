// ═══════════════════════════════════════════════════════════════
// Civic Social — Score Calibration
// ═══════════════════════════════════════════════════════════════
// Combines the safety-gate verdict, tone issues, and quality
// signals into a single calibrated 0–1 civility score with a
// confidence estimate.
//
// Pure functions, server/client safe.
// ═══════════════════════════════════════════════════════════════

import type { ModerationSignals, ModerationSeverity, ModerationIssue } from './types';
import { SEVERITY_CEILINGS } from './policy';

/** Signal weights for the constructive-quality composite. */
const POSITIVE_WEIGHTS: Array<[keyof ModerationSignals, number]> = [
  ['respectfulness', 0.34],
  ['evidenceOrientation', 0.16],
  ['specificity', 0.13],
  ['policyFocus', 0.13],
  ['empathy', 0.12],
  ['solutionOrientation', 0.12],
];

const NEGATIVE_WEIGHTS: Array<[keyof ModerationSignals, number]> = [
  ['personalAttack', 0.30],
  ['inflammatory', 0.20],
  ['rageBait', 0.20],
  ['groupGeneralization', 0.18],
  ['absolutism', 0.12],
];

export interface CalibrationInput {
  signals: ModerationSignals;
  severity: ModerationSeverity;
  issues: ModerationIssue[];
  wordCount: number;
}

export interface CalibrationOutput {
  score: number;
  confidence: number;
}

export function calibrateScore(input: CalibrationInput): CalibrationOutput {
  const { signals, severity, issues, wordCount } = input;

  // Constructive composite: start from positive base, subtract negatives.
  let positive = 0;
  for (const [key, w] of POSITIVE_WEIGHTS) positive += signals[key] * w;

  let negative = 0;
  for (const [key, w] of NEGATIVE_WEIGHTS) negative += signals[key] * w;

  // Base score: anchored at 0.55 for neutral text. A bland but harmless
  // post scores ~0.55–0.65; constructive signals raise it toward 1;
  // abusive signals pull it down.
  let score = 0.55 + positive * 0.45 - negative * 0.9;

  // Per-issue tone penalties (medium/low only — severe handled by ceiling)
  for (const issue of issues) {
    if (issue.severity === 'medium') score -= 0.12;
    else if (issue.severity === 'low') score -= 0.05;
  }

  // Severity ceiling — bonuses can NEVER override this.
  const ceiling = SEVERITY_CEILINGS[severity] ?? 1.0;
  score = Math.max(0, Math.min(ceiling, score));

  // ── Confidence ───────────────────────────────────────────
  // Severe pattern hits → very confident. Very short text → less
  // confident (limited signal). Mid-range scores → less confident
  // than extremes.
  let confidence = 0.75;
  if (severity === 'critical' || severity === 'high') confidence = 0.95;
  else {
    if (wordCount < 5) confidence -= 0.2;
    else if (wordCount > 30) confidence += 0.1;
    const distanceFromMid = Math.abs(score - 0.5) * 2; // 0 at 0.5, 1 at extremes
    confidence += distanceFromMid * 0.1;
  }
  confidence = Math.max(0.3, Math.min(0.98, confidence));

  return { score, confidence };
}
