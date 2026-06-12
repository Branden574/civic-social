// ═══════════════════════════════════════════════════════════════
// Auth Hardening Tests
// ═══════════════════════════════════════════════════════════════
// Covers the security-audit fixes owned by the auth surface:
//   - Versioned PBKDF2 password hashes (v2, 600k iterations) with
//     legacy (salt:hash, 100k) compatibility + rehash-on-verify
//   - SHA-256 hashing of single-use tokens (password reset)
//   - Edge middleware session HMAC verification (verifySessionEdge)
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { pbkdf2Sync, randomBytes, createHash, webcrypto } from 'node:crypto';
import { hashPassword, verifyPassword, needsRehash, hashToken } from '@/lib/security/hash';

// Test fixture — not a real credential
const PASSWORD = 'Correct-Horse-Battery-Staple-77!';

/** Build a hash in the LEGACY pre-versioning format: "salt:hash" @100k. */
function legacyHash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// ─── Versioned password hashing ──────────────────────────────

describe('password hashing (versioned PBKDF2)', () => {
  it('produces v2-format hashes with 600,000 iterations', () => {
    const stored = hashPassword(PASSWORD);
    const parts = stored.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v2');
    expect(Number(parts[1])).toBe(600_000);
    expect(parts[2]).toMatch(/^[0-9a-f]{32}$/); // 16-byte salt, hex
    expect(parts[3]).toMatch(/^[0-9a-f]{128}$/); // 64-byte key, hex
  }, 20_000);

  it('verifies v2 hashes and rejects wrong passwords', () => {
    const stored = hashPassword(PASSWORD);
    expect(verifyPassword(PASSWORD, stored)).toBe(true);
    expect(verifyPassword('wrong-password-123!', stored)).toBe(false);
  }, 20_000);

  it('still verifies LEGACY "salt:hash" (100k-iteration) hashes', () => {
    const stored = legacyHash(PASSWORD);
    expect(stored.startsWith('v2:')).toBe(false);
    expect(verifyPassword(PASSWORD, stored)).toBe(true);
    expect(verifyPassword('wrong-password-123!', stored)).toBe(false);
  }, 20_000);

  it('rejects malformed stored hashes without throwing', () => {
    expect(verifyPassword(PASSWORD, '')).toBe(false);
    expect(verifyPassword(PASSWORD, 'no-separator')).toBe(false);
    expect(verifyPassword(PASSWORD, 'v2:not-a-number:salt:hash')).toBe(false);
    expect(verifyPassword(PASSWORD, 'v2:600000:onlythreeparts')).toBe(false);
  });

  it('flags legacy hashes for rehash, but not fresh v2 hashes', () => {
    expect(needsRehash(legacyHash(PASSWORD))).toBe(true);
    expect(needsRehash(hashPassword(PASSWORD))).toBe(false);
    // Lower-than-current iteration count must also be upgraded
    expect(needsRehash('v2:100000:abcd:ef01')).toBe(true);
    expect(needsRehash('')).toBe(true);
  }, 20_000);

  it('upgrade flow: legacy hash verifies, rehash produces v2 that verifies', () => {
    // Mirrors login/route.ts: verify → needsRehash → hashPassword(password)
    const stored = legacyHash(PASSWORD);
    expect(verifyPassword(PASSWORD, stored)).toBe(true);
    expect(needsRehash(stored)).toBe(true);

    const upgraded = hashPassword(PASSWORD);
    expect(upgraded.startsWith('v2:600000:')).toBe(true);
    expect(verifyPassword(PASSWORD, upgraded)).toBe(true);
    expect(needsRehash(upgraded)).toBe(false);
  }, 20_000);
});

// ─── Single-use token hashing (password reset) ───────────────

describe('hashToken (reset tokens stored hashed)', () => {
  it('is a deterministic SHA-256 hex digest', () => {
    const token = randomBytes(32).toString('hex');
    const expected = createHash('sha256').update(token).digest('hex');
    expect(hashToken(token)).toBe(expected);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different tokens produce different hashes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});

// ─── Edge middleware session verification ────────────────────

describe('verifySessionEdge (middleware HMAC check)', () => {
  const SECRET = 'test-secret-for-middleware-hmac-verification';

  let signSession: typeof import('@/lib/security/session').signSession;
  let verifySessionEdge: typeof import('@/middleware').verifySessionEdge;

  beforeAll(async () => {
    process.env.SESSION_SECRET = SECRET;
    // jsdom lacks crypto.subtle — use Node's Web Crypto implementation
    if (!globalThis.crypto?.subtle) {
      vi.stubGlobal('crypto', webcrypto);
    }
    ({ signSession } = await import('@/lib/security/session'));
    ({ verifySessionEdge } = await import('@/middleware'));
  });

  function makeToken(overrides: Partial<{ iat: number; role: string }> = {}) {
    return signSession({
      id: 'user-abc123',
      email: 'test@example.com',
      role: (overrides.role as 'user') ?? 'user',
      displayName: 'Test User',
      iat: overrides.iat ?? Date.now(),
    });
  }

  it('accepts a token signed by signSession (node crypto parity)', async () => {
    const payload = await verifySessionEdge(makeToken(), SECRET);
    expect(payload).not.toBeNull();
    expect(payload?.id).toBe('user-abc123');
    expect(payload?.role).toBe('user');
  });

  it('rejects a tampered payload (role escalation attempt)', async () => {
    const token = makeToken();
    const [b64, sig] = [token.slice(0, token.lastIndexOf('.')), token.slice(token.lastIndexOf('.') + 1)];
    const json = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    json.role = 'admin';
    const forged = `${Buffer.from(JSON.stringify(json)).toString('base64url')}.${sig}`;
    expect(await verifySessionEdge(forged, SECRET)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    expect(await verifySessionEdge(makeToken(), 'some-other-secret')).toBeNull();
  });

  it('rejects an expired token (> 24h old)', async () => {
    const stale = makeToken({ iat: Date.now() - 25 * 60 * 60 * 1000 });
    expect(await verifySessionEdge(stale, SECRET)).toBeNull();
  });

  it('rejects garbage, empty, and unsigned inputs', async () => {
    expect(await verifySessionEdge(undefined, SECRET)).toBeNull();
    expect(await verifySessionEdge('', SECRET)).toBeNull();
    expect(await verifySessionEdge('not-a-token', SECRET)).toBeNull();
    expect(await verifySessionEdge('aGVsbG8.!!!notbase64!!!', SECRET)).toBeNull();
    // Payload without signature must never pass
    const bare = Buffer.from(JSON.stringify({ id: 'x', iat: Date.now() })).toString('base64url');
    expect(await verifySessionEdge(`${bare}.`, SECRET)).toBeNull();
  });

  it('fails closed when no secret is configured', async () => {
    expect(await verifySessionEdge(makeToken(), undefined)).toBeNull();
  });
});
