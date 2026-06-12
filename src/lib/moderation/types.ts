// ═══════════════════════════════════════════════════════════════
// Civic Social — Moderation Engine Types
// ═══════════════════════════════════════════════════════════════
// Shared types for the hybrid moderation engine:
//   deterministic safety gate → quality signals → calibration →
//   policy action → (optional) AI provider blend
// ═══════════════════════════════════════════════════════════════

/** Severity of the worst violation found. */
export type ModerationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'none';

/** Category of the worst violation found. Superset of the legacy civility categories. */
export type ModerationCategory =
  | 'racism'
  | 'hate_speech'
  | 'violence'
  | 'threat'
  | 'harassment'
  | 'doxxing'
  | 'profanity'
  | 'incivility'
  | 'spam'
  | 'evasion'
  | 'none';

/** What the platform should do with the content. */
export type ModerationAction =
  | 'allow'            // publish normally
  | 'nudge'            // publish, but show improvement feedback
  | 'rate_limit'       // publish, but count against abuse budget
  | 'hold_for_review'  // store as pending_review, not publicly visible
  | 'block';           // refuse to publish

/**
 * Constructive-quality signals, each 0–1.
 * Higher is better for positive signals (respectfulness, evidence…),
 * higher is worse for negative signals (personalAttack, inflammatory…).
 */
export interface ModerationSignals {
  // Positive
  respectfulness: number;
  specificity: number;
  evidenceOrientation: number;
  policyFocus: number;
  empathy: number;
  solutionOrientation: number;
  // Negative
  personalAttack: number;
  inflammatory: number;
  absolutism: number;
  rageBait: number;
  groupGeneralization: number;
}

/** A single detected issue with user-facing message. */
export interface ModerationIssue {
  message: string;
  severity: ModerationSeverity;
  category: ModerationCategory;
}

/** Full moderation verdict. */
export interface ModerationResult {
  /** Civility/quality score 0–1 (higher = more civil/constructive). */
  score: number;
  severity: ModerationSeverity;
  category: ModerationCategory;
  /** User-facing issue messages (legacy-compatible string list). */
  issues: string[];
  /** Actionable “how to improve” suggestions. */
  suggestions: string[];
  /** 0–1 confidence in this verdict. */
  confidence: number;
  signals: ModerationSignals;
  action: ModerationAction;
  /** Primary user-facing message for the action (block/hold/nudge). */
  userMessage: string | null;
  /** True if the text appeared to deliberately evade filters. */
  evasionDetected: boolean;
  /** Structured issues (message + severity + category). */
  detailedIssues: ModerationIssue[];
  /** Which engines contributed: 'local' always; 'provider' when AI blended. */
  enginesUsed: Array<'local' | 'provider'>;
}

/** Result of the deterministic safety gate alone. */
export interface SafetyGateResult {
  severity: ModerationSeverity;
  category: ModerationCategory;
  issues: ModerationIssue[];
  /** Detected deliberate filter evasion (masked slurs etc.). */
  evasionDetected: boolean;
  /** Slur/violation matched only in an educational/reporting context. */
  mentionContext: boolean;
}

/** Verdict returned by an external AI moderation provider. */
export interface ProviderVerdict {
  /** 0–1 civility estimate. */
  score: number;
  severity: ModerationSeverity;
  /** Short rationale (safe metadata — no raw content echo). */
  rationale: string;
  /** Provider-suggested action — advisory only, never authoritative. */
  suggestedAction: ModerationAction;
}

/** Interface for pluggable external moderation providers. */
export interface ModerationProvider {
  readonly name: string;
  /**
   * Analyze text. Returns null on timeout/failure/circuit-open —
   * callers must treat null as “no provider opinion” and fall back
   * to local-only scoring.
   */
  moderate(text: string): Promise<ProviderVerdict | null>;
}
