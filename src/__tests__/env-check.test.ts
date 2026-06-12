// ═══════════════════════════════════════════════════════════════
// Civic Social — Startup Environment Validation Tests
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkEnv,
  validateEnv,
  __resetEnvCheckForTests,
} from '@/lib/security/env-check';

const STRONG_SECRET = 'a'.repeat(64); // ≥ 32 chars

/** Fully-valid production env baseline for tests. */
function prodEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'production',
    SESSION_SECRET: STRONG_SECRET,
    DATABASE_URL: 'prisma+postgres://example/?api_key=test',
    CRON_SECRET: 'b'.repeat(64),
    ...overrides,
  };
}

function findingsFor(env: Record<string, string | undefined>, variable: string) {
  return checkEnv(env).findings.filter((f) => f.variable.includes(variable));
}

describe('checkEnv — SESSION_SECRET', () => {
  it('passes with a strong secret and full prod config', () => {
    const result = checkEnv(prodEnv());
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('errors in production when SESSION_SECRET is missing', () => {
    const result = checkEnv(prodEnv({ SESSION_SECRET: undefined }));
    expect(result.ok).toBe(false);
    const f = findingsFor(prodEnv({ SESSION_SECRET: undefined }), 'SESSION_SECRET');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
  });

  it('errors in production when SESSION_SECRET is under 32 chars', () => {
    const env = prodEnv({ SESSION_SECRET: 'short-secret' });
    const f = findingsFor(env, 'SESSION_SECRET');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('error');
    expect(f[0].message).toContain('32');
  });

  it('only warns (not errors) for missing SESSION_SECRET in development', () => {
    const result = checkEnv({ NODE_ENV: 'development' });
    const f = result.findings.filter((x) => x.variable === 'SESSION_SECRET');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('warn');
    expect(result.ok).toBe(true);
  });

  it('never includes the secret value in findings', () => {
    const secret = 'super-sensitive-but-too-short';
    const result = checkEnv(prodEnv({ SESSION_SECRET: secret }));
    for (const f of result.findings) {
      expect(f.message).not.toContain(secret);
      expect(f.variable).not.toContain(secret);
    }
  });
});

describe('checkEnv — database', () => {
  it('errors in production when neither DATABASE_URL nor DIRECT_URL is set', () => {
    const result = checkEnv(prodEnv({ DATABASE_URL: undefined }));
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.variable === 'DATABASE_URL' && f.level === 'error')).toBe(true);
  });

  it('accepts DIRECT_URL as an alternative to DATABASE_URL', () => {
    const result = checkEnv(prodEnv({
      DATABASE_URL: undefined,
      DIRECT_URL: 'postgresql://localhost:5432/civic',
    }));
    expect(result.findings.filter((f) => f.variable === 'DATABASE_URL')).toEqual([]);
  });

  it('does not require a database in development', () => {
    const result = checkEnv({ NODE_ENV: 'development', SESSION_SECRET: STRONG_SECRET });
    expect(result.findings.filter((f) => f.variable === 'DATABASE_URL')).toEqual([]);
  });
});

describe('checkEnv — moderation provider pairing', () => {
  it('warns when MODERATION_PROVIDER is set without MODERATION_API_KEY', () => {
    const f = findingsFor(prodEnv({ MODERATION_PROVIDER: 'anthropic' }), 'MODERATION_API_KEY');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('warn');
  });

  it('warns when MODERATION_API_KEY is set without MODERATION_PROVIDER', () => {
    const f = findingsFor(prodEnv({ MODERATION_API_KEY: 'sk-test' }), 'MODERATION_PROVIDER');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('warn');
  });

  it('warns on an unsupported provider value', () => {
    const f = findingsFor(
      prodEnv({ MODERATION_PROVIDER: 'openai', MODERATION_API_KEY: 'sk-test' }),
      'MODERATION_PROVIDER',
    );
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain('anthropic');
  });

  it('accepts a complete anthropic configuration', () => {
    const result = checkEnv(prodEnv({
      MODERATION_PROVIDER: 'anthropic',
      MODERATION_API_KEY: 'sk-test',
    }));
    expect(result.findings).toEqual([]);
  });
});

describe('checkEnv — CRON_SECRET', () => {
  it('warns in production when CRON_SECRET is missing', () => {
    const f = findingsFor(prodEnv({ CRON_SECRET: undefined }), 'CRON_SECRET');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('warn');
  });

  it('does not warn about CRON_SECRET in development', () => {
    const result = checkEnv({ NODE_ENV: 'development', SESSION_SECRET: STRONG_SECRET });
    expect(result.findings.filter((f) => f.variable === 'CRON_SECRET')).toEqual([]);
  });
});

describe('checkEnv — grouped vars (TURN / Pusher)', () => {
  it('warns when TURN config is partial, naming the missing vars', () => {
    const result = checkEnv(prodEnv({ TURN_URL: 'turn:turn.example.com:3478' }));
    const f = result.findings.filter((x) => x.variable.includes('TURN_USERNAME'));
    expect(f).toHaveLength(1);
    expect(f[0].variable).toContain('TURN_CREDENTIAL');
    expect(f[0].variable).not.toContain('TURN_URL');
  });

  it('accepts a complete TURN trio', () => {
    const result = checkEnv(prodEnv({
      TURN_URL: 'turn:turn.example.com:3478',
      TURN_USERNAME: 'user',
      TURN_CREDENTIAL: 'cred',
    }));
    expect(result.findings).toEqual([]);
  });

  it('warns when Pusher server config is partial', () => {
    const result = checkEnv(prodEnv({ PUSHER_APP_ID: '12345', PUSHER_KEY: 'key' }));
    const f = result.findings.filter((x) => x.variable.includes('PUSHER_SECRET'));
    expect(f).toHaveLength(1);
    expect(f[0].variable).toContain('PUSHER_CLUSTER');
  });

  it('warns when Pusher server config is complete but client config is missing', () => {
    const result = checkEnv(prodEnv({
      PUSHER_APP_ID: '12345',
      PUSHER_KEY: 'key',
      PUSHER_SECRET: 'secret',
      PUSHER_CLUSTER: 'us2',
    }));
    const f = result.findings.filter((x) => x.variable.includes('NEXT_PUBLIC_PUSHER_KEY'));
    expect(f).toHaveLength(1);
  });

  it('accepts a complete Pusher server + client configuration', () => {
    const result = checkEnv(prodEnv({
      PUSHER_APP_ID: '12345',
      PUSHER_KEY: 'key',
      PUSHER_SECRET: 'secret',
      PUSHER_CLUSTER: 'us2',
      NEXT_PUBLIC_PUSHER_KEY: 'key',
      NEXT_PUBLIC_PUSHER_CLUSTER: 'us2',
    }));
    expect(result.findings).toEqual([]);
  });
});

describe('validateEnv — singleton guard', () => {
  beforeEach(() => {
    __resetEnvCheckForTests();
  });

  it('returns a result on first call and null on subsequent calls', () => {
    const first = validateEnv(prodEnv());
    expect(first).not.toBeNull();
    expect(first!.ok).toBe(true);
    expect(validateEnv(prodEnv())).toBeNull();
  });

  it('runs again after the test-only reset', () => {
    expect(validateEnv(prodEnv())).not.toBeNull();
    __resetEnvCheckForTests();
    expect(validateEnv(prodEnv())).not.toBeNull();
  });
});
