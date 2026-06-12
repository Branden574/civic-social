// ═══════════════════════════════════════════════════════════════
// Civic Social — Civility Analyzer (compat wrapper)
// ═══════════════════════════════════════════════════════════════
// Backward-compatible facade over the moderation engine in
// src/lib/moderation/. Existing imports keep working:
//
//   import { analyzeCivility } from '@/lib/civility';
//
// Pure + sync + client/server safe (delegates to moderateLocal,
// which never touches the network or server-only modules).
//
// New code should import from '@/lib/moderation/analyzer' directly
// to get the full ModerationResult (action, suggestions, signals,
// confidence). This wrapper maps to the legacy CivilityResult
// shape and keeps the legacy category vocabulary.
// ═══════════════════════════════════════════════════════════════

import { moderateLocal } from './moderation/analyzer';
import type { ModerationResult, ModerationCategory } from './moderation/types';

export interface CivilityResult {
  score: number;   // 0–1, higher is more civil
  issues: string[];
  /** Severity classification: 'critical' | 'high' | 'medium' | 'low' | 'none' */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  /** Category of worst violation detected (legacy vocabulary) */
  category: 'racism' | 'hate_speech' | 'violence' | 'harassment' | 'profanity' | 'incivility' | 'none';
  /** Full moderation result from the new engine (superset of this shape). */
  moderation: ModerationResult;
}

/** Map new engine categories onto the legacy six. */
function toLegacyCategory(cat: ModerationCategory): CivilityResult['category'] {
  switch (cat) {
    case 'racism': return 'racism';
    case 'hate_speech': return 'hate_speech';
    case 'violence':
    case 'threat': return 'violence';
    case 'harassment':
    case 'doxxing': return 'harassment';
    case 'profanity': return 'profanity';
    case 'incivility':
    case 'spam':
    case 'evasion': return 'incivility';
    default: return 'none';
  }
}

export function analyzeCivility(text: string): CivilityResult {
  const result = moderateLocal(text);
  return {
    score: result.score,
    issues: result.issues,
    severity: result.severity,
    category: toLegacyCategory(result.category),
    moderation: result,
  };
}

// Re-export new-engine types for incremental migration.
export type { ModerationResult, ModerationAction, ModerationSignals } from './moderation/types';
export { moderateLocal } from './moderation/analyzer';
