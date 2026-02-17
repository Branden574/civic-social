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

// ─── User extraction ─────────────────────────────────────────
// In production, this reads a signed session cookie / JWT.
// For now, we read from a session cookie set by the auth context.

interface SessionUser {
  id: string;
  email: string;
  role: 'user' | 'moderator' | 'admin' | 'creator';
  displayName: string;
}

const SESSION_COOKIE = 'civic-session';

/**
 * Extract the authenticated user from the request.
 * Returns null if not authenticated.
 *
 * PRODUCTION TODO: Replace with signed JWT / session cookie validation.
 * Current implementation reads a demo session cookie.
 */
export function getSessionUser(request: NextRequest): SessionUser | null {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const parsed = JSON.parse(sessionCookie);
    if (!parsed.id || !parsed.email || !parsed.role) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      role: parsed.role,
      displayName: parsed.displayName || 'User',
    };
  } catch {
    return null;
  }
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
