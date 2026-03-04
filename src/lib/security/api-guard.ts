// ═══════════════════════════════════════════════════════════════
// Civic Social — API Route Guard Utilities
// ═══════════════════════════════════════════════════════════════
//
// Shared helpers that every API route imports for:
//   1. Extracting + validating the current user from session
//   2. Role-based access control
//   3. Rate limit enforcement with proper headers
//   4. Safe error responses (never leak internals)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import type { RateLimitResult } from './rate-limiter-types';
import { verifySession, SESSION_COOKIE_NAME } from './session';

// ─── User extraction ─────────────────────────────────────────
// Reads an HMAC-signed HttpOnly session cookie set by the auth
// API routes (login / signup). Client-side JS cannot read or
// forge this cookie — the HMAC signature prevents tampering.

interface SessionUser {
  id: string;
  email: string;
  role: 'user' | 'moderator' | 'admin' | 'creator';
  displayName: string;
}

/**
 * Extract the authenticated user from the request.
 * Returns null if unauthenticated or if the session token is invalid/tampered.
 */
export function getSessionUser(request: NextRequest): SessionUser | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySession(token);
  if (!payload) return null;

  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    displayName: payload.displayName || 'User',
  };
}

/**
 * Require authentication. Returns a 401 response if not logged in.
 */
export function requireAuth(request: NextRequest): SessionUser | NextResponse {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }
  return user;
}

/**
 * Require admin or creator role. Returns a 403 if insufficient privileges.
 */
export function requireAdmin(request: NextRequest): SessionUser | NextResponse {
  const result = requireAuth(request);
  if (result instanceof NextResponse) return result;

  if (result.role !== 'admin' && result.role !== 'creator') {
    return NextResponse.json(
      { error: 'Insufficient privileges.' },
      { status: 403 },
    );
  }
  return result;
}

/**
 * Require creator role specifically.
 */
export function requireCreator(request: NextRequest): SessionUser | NextResponse {
  const result = requireAuth(request);
  if (result instanceof NextResponse) return result;

  if (result.role !== 'creator') {
    return NextResponse.json(
      { error: 'Creator access required.' },
      { status: 403 },
    );
  }
  return result;
}

// ─── Rate limiting helpers ───────────────────────────────────

/**
 * Get a client identifier for rate limiting.
 * Uses X-Forwarded-For (from CDN/proxy), falls back to a default.
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0'
  );
}

/**
 * Build rate-limit headers for a response.
 */
export function rateLimitHeaders(result: { remaining: number; retryAfterMs: number; limit: number }): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
  };
  if (result.retryAfterMs > 0) {
    headers['Retry-After'] = String(Math.ceil(result.retryAfterMs / 1000));
  }
  return headers;
}

/**
 * Return a 429 Too Many Requests response.
 */
export function tooManyRequests(retryAfterMs: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
      },
    },
  );
}

// ─── Safe error responses ────────────────────────────────────

/**
 * Return a generic 500 error without leaking internals.
 */
export function internalError(publicMessage = 'An unexpected error occurred. Please try again.'): NextResponse {
  return NextResponse.json(
    { error: publicMessage },
    { status: 500 },
  );
}

/**
 * Return a 400 bad request.
 */
export function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 400 },
  );
}
