// ═══════════════════════════════════════════════════════════════
// Civic Social — Password Hashing (PBKDF2 via Node.js crypto)
// ═══════════════════════════════════════════════════════════════
// Server-only. Never import this in client components.
// Uses 100,000 iterations of PBKDF2-SHA512 with a random 16-byte salt.
// ═══════════════════════════════════════════════════════════════

import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

const ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';
const SEPARATOR = ':';

/**
 * Hash a plaintext password. Returns a "salt:hash" string safe to store in DB.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}${SEPARATOR}${hash}`;
}

/**
 * Verify a plaintext password against a stored "salt:hash" string.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const separatorIndex = stored.indexOf(SEPARATOR);
  if (separatorIndex === -1) return false;

  const salt = stored.slice(0, separatorIndex);
  const expectedHash = stored.slice(separatorIndex + 1);

  try {
    const attemptHash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
    const expected = Buffer.from(expectedHash, 'hex');
    const attempt = Buffer.from(attemptHash, 'hex');
    if (expected.length !== attempt.length) return false;
    return timingSafeEqual(expected, attempt);
  } catch {
    return false;
  }
}
