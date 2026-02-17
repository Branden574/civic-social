// ═══════════════════════════════════════════════════════════════
// Civic Social — CSRF Protection
// ═══════════════════════════════════════════════════════════════
//
// Double-submit cookie pattern for state-changing requests.
// Middleware sets a CSRF cookie; API routes verify the header.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE = '__csrf';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Generate a cryptographically random CSRF token.
 */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Set the CSRF cookie on a response if not already present.
 */
export function setCsrfCookie(request: NextRequest, response: NextResponse): NextResponse {
  const existing = request.cookies.get(CSRF_COOKIE);
  if (!existing) {
    const token = generateCsrfToken();
    response.cookies.set(CSRF_COOKIE, token, {
      httpOnly: false, // Client JS must read it to send as header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });
  }
  return response;
}

/**
 * Validate the CSRF token on a state-changing request.
 * Returns true if valid, false if missing/mismatched.
 */
export function validateCsrf(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length < 32) return false;

  // Constant-time comparison
  return timingSafeEqual(cookieToken, headerToken);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
