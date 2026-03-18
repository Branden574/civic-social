// ═══════════════════════════════════════════════════════════════
// Display Name Validator — shared client + server
// ═══════════════════════════════════════════════════════════════
// Validates display names for:
//   1. Length and format
//   2. Hate speech, slurs, and profanity
//   3. Uniqueness (server-side only, via async check)
// ═══════════════════════════════════════════════════════════════

export interface DisplayNameValidation {
  valid: boolean;
  error?: string;
}

// ── Banned patterns (subset of civility.ts CRITICAL + HIGH + MEDIUM) ──
// These catch slurs, hate speech, and profanity even when used as display names.

const BANNED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Racial slurs
  { pattern: /n[i1!]gg[ae3]r?s?|n[i1!]gg[ae3]h?|sp[i1!]c[ks]?|ch[i1!]nk[s]?|w[e3]tb[a4]ck[s]?|k[i1!]k[e3][s]?|g[o0]{2}k[s]?|r[a4]gh[e3][a4]d[s]?|c[o0]{2}n[s]?|b[e3][a4]n[e3]r[s]?/i, reason: 'Display name contains a racial slur.' },
  // Homophobic/transphobic slurs
  { pattern: /f[a4@]g[gs]?[o0]?t[s]?|tr[a4]nn[yi1][e3]?[s]?|d[yi1]k[e3][s]?/i, reason: 'Display name contains a homophobic or transphobic slur.' },
  // Supremacist language
  { pattern: /white\s*power|white\s*supremac|master\s*race|racial?\s*purity|ethno\s*state|race\s*war/i, reason: 'Display name contains hate speech.' },
  // Violent / dehumanizing
  { pattern: /kill\s*(all|them)|death\s*to|sub\s*human|genocide/i, reason: 'Display name contains violent or dehumanizing language.' },
  // Common profanity (aggressive subset)
  { pattern: /\bf+u+c+k+|f\*ck|sh[i1!]t|a[s$]{2}h[o0]le|b[i1!]tch|c[u\*]nt|d[i1!]ck(?:head)?|p[u\*]ss[yi1]|wh[o0]re|sl[u\*]t/i, reason: 'Display name contains profanity.' },
  // Nazi / extremist
  { pattern: /nazi|heil\s*hitler|sieg\s*heil|1488|14\s*88|aryan|swastika/i, reason: 'Display name contains extremist content.' },
  // Slur evasion via common substitutions
  { pattern: /n[i1!]gg|f[a4@]gg/i, reason: 'Display name contains prohibited language.' },
];

/**
 * Validate a display name synchronously (format + profanity).
 * Does NOT check uniqueness — use `checkDisplayNameAvailable()` for that.
 */
export function validateDisplayName(name: string): DisplayNameValidation {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: 'Display name is required.' };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: 'Display name must be at least 2 characters.' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Display name must be 50 characters or less.' };
  }

  // Check for banned content (slurs, hate speech, profanity)
  // Strip spaces and common substitutions for evasion detection
  const normalized = trimmed.replace(/[\s._\-]/g, '');
  for (const { pattern, reason } of BANNED_PATTERNS) {
    if (pattern.test(trimmed) || pattern.test(normalized)) {
      return { valid: false, error: reason };
    }
  }

  return { valid: true };
}
