// ═══════════════════════════════════════════════════════════════
// Civic Social — Startup Environment Validation
// ═══════════════════════════════════════════════════════════════
//
// Validates required and paired environment variables once per
// server process and logs CLEAR warnings about anything missing,
// weak, or half-configured — so misconfiguration surfaces at boot
// instead of failing silently at request time.
//
// Safety properties:
//   * Variable VALUES are NEVER logged — only names and findings.
//   * Never throws and never blocks startup; advisory only.
//   * Singleton-guarded: validateEnv() runs at most once.
//
// Wire-up: call validateEnv() from src/instrumentation.ts —
// Next.js invokes register() natively at server startup.
// ═══════════════════════════════════════════════════════════════

import { secureLog } from './logger';

type Env = Record<string, string | undefined>;

export interface EnvFinding {
  level: 'error' | 'warn';
  variable: string;
  message: string;
}

export interface EnvCheckResult {
  /** True when no error-level findings were produced. */
  ok: boolean;
  findings: EnvFinding[];
}

/** Minimum acceptable SESSION_SECRET length (HMAC-SHA256 key). */
const SESSION_SECRET_MIN_LENGTH = 32;

/** Var groups that only work when configured together. */
const TURN_VARS = ['TURN_URL', 'TURN_USERNAME', 'TURN_CREDENTIAL'];
const PUSHER_SERVER_VARS = ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER'];
const PUSHER_CLIENT_VARS = ['NEXT_PUBLIC_PUSHER_KEY', 'NEXT_PUBLIC_PUSHER_CLUSTER'];

/** Returns the missing names when a group is PARTIALLY configured, else null. */
function partiallyConfigured(env: Env, vars: string[]): string[] | null {
  const missing = vars.filter((v) => !env[v]);
  if (missing.length === 0 || missing.length === vars.length) return null;
  return missing;
}

/**
 * Pure check — inspects the given env and returns findings.
 * Exported separately from validateEnv() so tests can pass a
 * synthetic env without touching the singleton guard.
 */
export function checkEnv(env: Env = process.env): EnvCheckResult {
  const findings: EnvFinding[] = [];
  const isProd = env.NODE_ENV === 'production';
  // Missing critical config is an error in production, a warning in dev.
  const criticalLevel: EnvFinding['level'] = isProd ? 'error' : 'warn';

  // ── SESSION_SECRET: required, must be strong ───────────────
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret) {
    findings.push({
      level: criticalLevel,
      variable: 'SESSION_SECRET',
      message:
        'Not set — session signing (src/lib/security/session.ts) will throw and login will fail. '
        + 'Generate with: openssl rand -hex 32',
    });
  } else if (sessionSecret.length < SESSION_SECRET_MIN_LENGTH) {
    findings.push({
      level: criticalLevel,
      variable: 'SESSION_SECRET',
      message:
        `Shorter than ${SESSION_SECRET_MIN_LENGTH} characters — too weak for HMAC-SHA256 session signing. `
        + 'Generate with: openssl rand -hex 32',
    });
  }

  // ── Database: required in production ───────────────────────
  if (isProd && !env.DATABASE_URL && !env.DIRECT_URL) {
    findings.push({
      level: 'error',
      variable: 'DATABASE_URL',
      message:
        'Neither DATABASE_URL nor DIRECT_URL is set — the app will run on volatile '
        + 'in-memory stores and ALL data is lost on restart.',
    });
  }

  // ── Moderation provider: optional, but must be paired ──────
  const modProvider = env.MODERATION_PROVIDER;
  const modKey = env.MODERATION_API_KEY;
  if (modProvider && !modKey) {
    findings.push({
      level: 'warn',
      variable: 'MODERATION_API_KEY',
      message:
        'MODERATION_PROVIDER is set but MODERATION_API_KEY is missing — AI moderation '
        + 'is disabled; local rules remain the only moderation layer.',
    });
  } else if (!modProvider && modKey) {
    findings.push({
      level: 'warn',
      variable: 'MODERATION_PROVIDER',
      message:
        'MODERATION_API_KEY is set but MODERATION_PROVIDER is missing — the key is '
        + 'unused. Set MODERATION_PROVIDER=anthropic to enable AI moderation.',
    });
  } else if (modProvider && modProvider !== 'anthropic') {
    findings.push({
      level: 'warn',
      variable: 'MODERATION_PROVIDER',
      message:
        'Unsupported provider value — only "anthropic" is implemented. AI moderation '
        + 'is disabled; local rules remain the only moderation layer.',
    });
  }

  // ── CRON_SECRET: required in production for cron routes ────
  if (isProd && !env.CRON_SECRET) {
    findings.push({
      level: 'warn',
      variable: 'CRON_SECRET',
      message:
        'Not set — /api/cron/* routes will reject every invocation with 500 and feed '
        + 'materialized views will go stale. Generate with: openssl rand -hex 32',
    });
  }

  // ── TURN static credentials: all-or-none trio ──────────────
  const turnMissing = partiallyConfigured(env, TURN_VARS);
  if (turnMissing) {
    findings.push({
      level: 'warn',
      variable: turnMissing.join(', '),
      message:
        'Incomplete static TURN configuration — TURN_URL, TURN_USERNAME, and '
        + 'TURN_CREDENTIAL must all be set together. Falling back to STUN-only, '
        + 'which breaks debate video/audio behind strict NATs.',
    });
  }

  // ── Pusher server credentials: all-or-none quad ────────────
  const pusherMissing = partiallyConfigured(env, PUSHER_SERVER_VARS);
  if (pusherMissing) {
    findings.push({
      level: 'warn',
      variable: pusherMissing.join(', '),
      message:
        'Incomplete Pusher server configuration — PUSHER_APP_ID, PUSHER_KEY, '
        + 'PUSHER_SECRET, and PUSHER_CLUSTER must all be set together. Real-time '
        + 'signaling is disabled.',
    });
  } else if (env.PUSHER_APP_ID) {
    // Server quad complete — make sure the client-side pair is also present.
    const clientMissing = PUSHER_CLIENT_VARS.filter((v) => !env[v]);
    if (clientMissing.length > 0) {
      findings.push({
        level: 'warn',
        variable: clientMissing.join(', '),
        message:
          'Pusher server credentials are configured but the client-side config is '
          + 'incomplete — browsers cannot subscribe to channels without it.',
      });
    }
  }

  return { ok: !findings.some((f) => f.level === 'error'), findings };
}

// ─── Singleton-guarded entry point ───────────────────────────

let hasRun = false;

/**
 * Run environment validation once per process and log the findings.
 * Subsequent calls are no-ops (returns null). Never throws.
 */
export function validateEnv(env: Env = process.env): EnvCheckResult | null {
  if (hasRun) return null;
  hasRun = true;

  const result = checkEnv(env);
  for (const finding of result.findings) {
    const line = `${finding.variable} — ${finding.message}`;
    if (finding.level === 'error') {
      secureLog.error('env-check', line);
    } else {
      secureLog.warn('env-check', line);
    }
  }

  if (result.findings.length === 0) {
    secureLog.info('env-check', 'environment validation passed — no findings');
  } else {
    secureLog.info(
      'env-check',
      `environment validation finished with ${result.findings.length} finding(s)`,
    );
  }
  return result;
}

/** Test hook — reset the singleton guard. */
export function __resetEnvCheckForTests(): void {
  hasRun = false;
}
