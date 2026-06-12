// ═══════════════════════════════════════════════════════════════
// Civic Social — Moderation Analyzer (orchestrator)
// ═══════════════════════════════════════════════════════════════
// Pipeline:
//   normalize → safety gate → tone rules → quality signals →
//   calibrate → policy action → [server only: provider blend]
//
// Two entry points:
//   moderateLocal(text)      — synchronous, client+server safe.
//                              Used by compose preview, post-card,
//                              and as the authoritative floor.
//   moderateContent(text)    — async, SERVER ONLY, lives in
//                              './moderate.server' (adds the optional
//                              AI provider blend; the provider can
//                              never lower the local safety floor).
// ═══════════════════════════════════════════════════════════════

import type {
  ModerationResult,
  ModerationSignals,
  ModerationIssue,
  ModerationSeverity,
  ProviderVerdict,
} from './types';
import {
  runSafetyGate,
  runToneRules,
  runSpamChecks,
  computeQualitySignals,
  collectSuggestions,
} from './local-rules';
import { calibrateScore } from './calibration';
import { decideAction } from './policy';

const SEVERITY_RANK: Record<ModerationSeverity, number> = {
  critical: 4, high: 3, medium: 2, low: 1, none: 0,
};

function worstOf(a: ModerationSeverity, b: ModerationSeverity): ModerationSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function buildSuggestions(raw: string, signals: ModerationSignals): string[] {
  const out = collectSuggestions(raw);

  // Signal-driven coaching (writing-coach tone, not punishment)
  if (signals.evidenceOrientation < 0.15 && raw.trim().split(/\s+/).length > 15) {
    out.push('Add a source or explain what evidence shaped your view — sourced posts rank higher.');
  }
  if (signals.personalAttack > 0.4) {
    out.push('Try focusing on the policy or decision instead of the person.');
  }
  if (signals.groupGeneralization > 0.3) {
    out.push('Strong disagreement is allowed — sweeping claims about entire groups weaken your argument.');
  }
  if (signals.solutionOrientation === 0 && signals.inflammatory > 0.4) {
    out.push('What would you do instead? Posts that propose solutions get more thoughtful replies.');
  }
  // Dedupe, cap at 3 to avoid nagging
  return [...new Set(out)].slice(0, 3);
}

/**
 * Synchronous local-only moderation. Client + server safe.
 * This is the authoritative safety floor.
 */
export function moderateLocal(raw: string): ModerationResult {
  const text = raw ?? '';
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return {
      score: 1, severity: 'none', category: 'none',
      issues: [], suggestions: [], confidence: 0.5,
      signals: computeQualitySignals(''),
      action: 'allow', userMessage: null,
      evasionDetected: false, detailedIssues: [], enginesUsed: ['local'],
    };
  }

  // 1. Safety gate (severe content, evasion-normalized)
  const gate = runSafetyGate(text);

  // 2. Tone + spam rules (viewpoint-neutral medium/low)
  const toneIssues = runToneRules(text);
  const spamIssues = runSpamChecks(text);
  const allIssues: ModerationIssue[] = [...gate.issues, ...toneIssues, ...spamIssues];

  // Worst severity across gate + tone
  let severity = gate.severity;
  let category = gate.category;
  for (const issue of [...toneIssues, ...spamIssues]) {
    if (SEVERITY_RANK[issue.severity] > SEVERITY_RANK[severity]) {
      severity = issue.severity;
      category = issue.category;
    }
  }

  // 3. Quality signals
  const signals = computeQualitySignals(text);

  // 4. Calibrated score + confidence
  const { score, confidence } = calibrateScore({
    signals, severity, issues: allIssues, wordCount: words.length,
  });

  // 5. Policy action
  const decision = decideAction({
    score,
    severity,
    category,
    evasionDetected: gate.evasionDetected,
    mentionContext: gate.mentionContext,
  });

  return {
    score,
    severity,
    category,
    issues: allIssues.map((i) => i.message),
    suggestions: buildSuggestions(text, signals),
    confidence,
    signals,
    action: decision.action,
    userMessage: decision.userMessage,
    evasionDetected: gate.evasionDetected,
    detailedIssues: allIssues,
    enginesUsed: ['local'],
  };
}

/**
 * Blend an advisory provider verdict into a local result.
 * Rules (model output is a SIGNAL, never authority):
 *   * Provider can never reduce local severity or unblock content.
 *   * Provider can pull the score ±0.15 at most.
 *   * Provider severity above local can escalate the ACTION at most
 *     one step (allow→nudge, nudge→hold) — never directly to block.
 */
export function blendProviderVerdict(
  local: ModerationResult,
  verdict: ProviderVerdict,
): ModerationResult {
  // Severe local results are final.
  if (local.action === 'block' || local.severity === 'critical' || local.severity === 'high') {
    return local;
  }

  const blendedScore = Math.max(0, Math.min(1,
    local.score + Math.max(-0.15, Math.min(0.15, (verdict.score - local.score) * 0.4)),
  ));

  let action = local.action;
  const providerSeverityHigher = SEVERITY_RANK[verdict.severity] > SEVERITY_RANK[local.severity];
  if (providerSeverityHigher && (verdict.suggestedAction === 'hold_for_review' || verdict.suggestedAction === 'block')) {
    // Escalate exactly one step
    if (action === 'allow') action = 'nudge';
    else if (action === 'nudge' || action === 'rate_limit') action = 'hold_for_review';
  }

  return {
    ...local,
    score: blendedScore,
    severity: worstOf(local.severity, verdict.severity === 'critical' ? 'medium' : verdict.severity),
    action,
    userMessage: action !== local.action && action === 'hold_for_review'
      ? 'This post was held for a quick human review before publishing.'
      : local.userMessage,
    confidence: Math.min(0.98, local.confidence + 0.1),
    enginesUsed: ['local', 'provider'],
  };
}

// NOTE: moderateContent (local + AI provider blend) lives in
// './moderate.server' — it imports the 'server-only' provider, so it
// must never be referenced (even dynamically) from this client-safe
// module or the provider gets pulled into client bundles and breaks
// `next build`.
