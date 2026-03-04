// ═══════════════════════════════════════════════════════════════
// Civic Social — Server-Side Session Token Signing
// ═══════════════════════════════════════════════════════════════
//
// Signs and verifies session tokens using HMAC-SHA256 so that
// session cookies cannot be forged or tampered with client-side.
//
// Token format: base64url(JSON payload) + "." + base64url(HMAC)
//
// IMPORTANT: SESSION_SECRET must be set in environment variables.
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// ═══════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';

export interface SessionPayload {
  id: string;
  email: string;
  role: 'user' | 'moderator' | 'admin' | 'creator';
  displayName: string;
  /** Issued-at timestamp (ms) for optional expiry checks */
  iat: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production');
    }
    // Development fallback — clearly insecure, only for local dev
    return 'dev-insecure-fallback-set-SESSION_SECRET-in-env';
  }
  return secret;
}

/** Sign a payload and return the session token string. */
export function signSession(payload: SessionPayload): string {
  const secret = getSecret();
  const data = JSON.stringify(payload);
  const b64 = Buffer.from(data).toString('base64url');
  const sig = createHmac('sha256', secret).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

/** Verify a session token and return the payload, or null if invalid/tampered. */
export function verifySession(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx < 1) return null;

  const b64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const secret = getSecret();
  const expectedSig = createHmac('sha256', secret).update(b64).digest('base64url');

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(sig, 'base64url');
  const expectedBuf = Buffer.from(expectedSig, 'base64url');
  if (sigBuf.length !== expectedBuf.length) return null;

  try {
    if (!cryptoTimingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  try {
    const data = Buffer.from(b64, 'base64url').toString('utf8');
    const payload = JSON.parse(data) as SessionPayload;
    if (!payload.id || !payload.email || !payload.role || !payload.iat) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Cookie name for the session token. */
export const SESSION_COOKIE_NAME = 'civic-session';

/** Cookie options for setting the session cookie. */
export function sessionCookieOptions(maxAgeSeconds = 60 * 60 * 24) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: maxAgeSeconds,
    path: '/',
  };
}
