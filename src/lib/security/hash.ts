// ═══════════════════════════════════════════════════════════════
// Civic Social — Password Hashing (PBKDF2 via Node.js crypto)
// ═══════════════════════════════════════════════════════════════
// Server-only. Never import this in client components.
//
// Versioned hash format (current):
//   v2:<iterations>:<salt>:<hash>   — PBKDF2-SHA512, 600,000 iterations
// Legacy format (pre-versioning):
//   <salt>:<hash>                   — PBKDF2-SHA512, 100,000 iterations
//
// verifyPassword() accepts both formats. Use needsRehash() after a
// successful verify to transparently upgrade legacy hashes on login.
// ═══════════════════════════════════════════════════════════════

import { randomBytes, pbkdf2Sync, timingSafeEqual, createHash } from 'crypto';

const VERSION = 'v2';
const ITERATIONS = 600_000;
const LEGACY_ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';
const SEPARATOR = ':';

/**
 * Hash a plaintext password. Returns a versioned
 * "v2:<iterations>:<salt>:<hash>" string safe to store in DB.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return [VERSION, ITERATIONS, salt, hash].join(SEPARATOR);
}

/** Timing-safe comparison of a password attempt against salt+hash. */
function compareHash(password: string, salt: string, expectedHash: string, iterations: number): boolean {
  try {
    const attemptHash = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST).toString('hex');
    const expected = Buffer.from(expectedHash, 'hex');
    const attempt = Buffer.from(attemptHash, 'hex');
    if (expected.length !== attempt.length) return false;
    return timingSafeEqual(expected, attempt);
  } catch {
    return false;
  }
}

/**
 * Verify a plaintext password against a stored hash.
 * Accepts both the current "v2:<iters>:<salt>:<hash>" format and the
 * legacy "salt:hash" (100k iterations) format so old accounts keep working.
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || typeof stored !== 'string') return false;

  // Current versioned format: v2:<iterations>:<salt>:<hash>
  if (stored.startsWith(`${VERSION}${SEPARATOR}`)) {
    const parts = stored.split(SEPARATOR);
    if (parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 1) return false;
    return compareHash(password, parts[2], parts[3], iterations);
  }

  // Legacy format: <salt>:<hash> at 100,000 iterations
  const separatorIndex = stored.indexOf(SEPARATOR);
  if (separatorIndex === -1) return false;

  const salt = stored.slice(0, separatorIndex);
  const expectedHash = stored.slice(separatorIndex + 1);
  return compareHash(password, salt, expectedHash, LEGACY_ITERATIONS);
}

/**
 * True if a stored hash uses an outdated format/iteration count and
 * should be re-hashed (call after a successful verifyPassword()).
 */
export function needsRehash(stored: string): boolean {
  if (!stored || typeof stored !== 'string') return true;
  if (!stored.startsWith(`${VERSION}${SEPARATOR}`)) return true;
  const parts = stored.split(SEPARATOR);
  if (parts.length !== 4) return true;
  return Number(parts[1]) < ITERATIONS;
}

/**
 * SHA-256 hash a single-use token (password reset, etc.) for storage.
 * Tokens are high-entropy random values, so a fast unsalted hash is
 * sufficient — the goal is that a DB leak doesn't expose usable tokens.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
