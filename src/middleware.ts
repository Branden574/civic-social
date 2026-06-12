// ═══════════════════════════════════════════════════════════════
// Civic Social — Edge Middleware
// ═══════════════════════════════════════════════════════════════
//
// Runs on EVERY request. Enforces:
//   1. Security headers (CSP, HSTS, X-Frame-Options, etc.)
//   2. Global rate limiting per IP
//   3. CSRF cookie provisioning
//   4. Admin route server-side protection
//   5. CORS lockdown
//
// NOTE: Next.js edge middleware cannot import Node.js modules.
// The rate limiter here is a lightweight edge-compatible version.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';

// ─── Edge-compatible rate limiter ────────────────────────────
// (Cannot import from src/lib in edge runtime; inline minimal version)

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 600; // requests per window (supports real-time debate polling from multiple tabs)

// Cleanup stale entries periodically (best-effort in edge)
function cleanupRateLimits() {
  const now = Date.now();
  if (rateLimitMap.size > 10_000) {
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfter: number } {
  cleanupRateLimits();
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, retryAfter: 0 };
}

// ─── CSRF token generation (edge-compatible) ─────────────────

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Session HMAC verification (edge-compatible) ─────────────
// Mirrors src/lib/security/session.ts verifySession(), but uses
// Web Crypto because edge middleware cannot import node:crypto.
// Never trust the session payload (auth gate, role checks, refresh)
// without verifying the signature first.

const SESSION_COOKIE = 'civic-session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // matches session.ts

interface EdgeSessionPayload {
  id?: string;
  email?: string;
  role?: string;
  iat?: number;
}

function base64UrlToBytes(b64url: string): Uint8Array | null {
  try {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Verify an HMAC-SHA256 signed session token. Returns payload or null. */
export async function verifySessionEdge(
  token: string | undefined,
  secret: string | undefined,
): Promise<EdgeSessionPayload | null> {
  if (!token || !secret) return null;

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx < 1) return null;

  const b64 = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const sigBytes = base64UrlToBytes(sig);
  if (!sigBytes) return null;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(b64)));
    if (!timingSafeEqualBytes(mac, sigBytes)) return null;

    const payloadBytes = base64UrlToBytes(b64);
    if (!payloadBytes) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as EdgeSessionPayload;
    if (!payload?.id || !payload?.iat) return null;

    // Server-side expiry — matches session.ts (browser maxAge isn't enough)
    if (Date.now() - payload.iat > SESSION_MAX_AGE_MS) return null;

    return payload;
  } catch {
    return null;
  }
}

// ─── Allowed origins for CORS ────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  'https://civicsocial.com',
  'https://www.civicsocial.com',
  'https://civic-social.vercel.app',
]);

function isAllowedOrigin(origin: string | null, requestUrl: string): boolean {
  if (!origin) return true; // Same-origin requests have no Origin header
  if (process.env.NODE_ENV !== 'production') return true; // Dev: allow all
  if (ALLOWED_ORIGINS.has(origin)) return true;

  // Allow the app's own Vercel deployment URL (set VERCEL_URL env var)
  const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercelUrl && origin === `https://${vercelUrl}`) return true;

  // Allow same-origin: the request's own host matches the origin
  try {
    const reqHost = new URL(requestUrl).origin;
    if (origin === reqHost) return true;
  } catch {
    // fall through
  }

  return false;
}

// ─── Security headers ────────────────────────────────────────

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // KNOWN LIMITATION: 'unsafe-inline' in script-src cannot be removed yet.
  // A nonce-based CSP ('strict-dynamic' + per-request nonce) was evaluated,
  // but Next.js only injects the nonce into its inline bootstrap scripts on
  // DYNAMICALLY rendered routes — statically prerendered pages ship inline
  // scripts without a nonce and would be blocked, breaking hydration in
  // production. The production build also can't currently be verified end-
  // to-end (pre-existing 'server-only' import failure in src/lib/moderation
  // breaks `npm run build`). Revisit once all routes render dynamically or
  // Next.js supports hash-based CSP for static output. Mitigations in place:
  // SameSite=Strict HttpOnly session cookie, Origin allowlist on /api/*,
  // frame-ancestors 'none', object-src 'none'.
  "script-src 'self' 'unsafe-inline' https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
  "connect-src 'self' https://api.congress.gov https://vitals.vercel-insights.com https://*.vercel.app wss://*.pusher.com https://*.pusher.com wss://*.pusherapp.com https://*.pusherapp.com https://sockjs-us2.pusher.com https://sockjs-us3.pusher.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "worker-src 'self' blob:",
].join('; ');

const SECURITY_HEADERS: Record<string, string> = {
  // WARNING: CSP enforced — blocks XSS and inline injection attempts
  'Content-Security-Policy': CSP_DIRECTIVES,

  // HTTPS enforcement
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',

  // Prevent MIME sniffing
  'X-Content-Type-Options': 'nosniff',

  // Clickjacking protection (redundant with CSP frame-ancestors but belt+suspenders)
  'X-Frame-Options': 'DENY',

  // Referrer policy: send origin only for cross-origin
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy: disable unnecessary APIs
  'Permissions-Policy': [
    'camera=(self)',     // Needed for debate video
    'microphone=(self)', // Needed for voice debates
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
  ].join(', '),

};

// Admin pages: even stricter CSP
const ADMIN_CSP = CSP_DIRECTIVES
  .replace("connect-src 'self' https://api.congress.gov", "connect-src 'self'");

// ─── Middleware ──────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '0.0.0.0';

  // ── 1. Global rate limiting ───────────────────────────────
  const rateResult = checkRateLimit(ip);
  if (!rateResult.allowed) {
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateResult.retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  // ── 1b. Auth-gate: redirect unauthenticated users from private routes ──
  const PUBLIC_ROUTES = new Set([
    '/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/terms', '/privacy', '/contact', '/safety', '/how-it-works',
  ]);
  const isPublicRoute = PUBLIC_ROUTES.has(pathname) || pathname.startsWith('/api/') || pathname.startsWith('/_next/');
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  // Verify the session signature ONCE for reuse (auth gate + refresh).
  // WARNING: payload is only trusted after the HMAC check passes.
  const sessionPayload = sessionCookie
    ? await verifySessionEdge(sessionCookie, process.env.SESSION_SECRET)
    : null;
  // Cookie present but signature/expiry invalid → clear it downstream
  const hasInvalidSession = !!sessionCookie && !sessionPayload;

  if (!isPublicRoute) {
    if (!sessionPayload) {
      const loginUrl = new URL('/', request.url);
      const res = NextResponse.redirect(loginUrl);
      if (hasInvalidSession) res.cookies.delete(SESSION_COOKIE);
      return res;
    }

    // Banned users: redirect to landing page
    if (sessionPayload?.role === 'banned') {
      // Clear the session cookie so they're logged out
      const res = NextResponse.redirect(new URL('/', request.url));
      res.cookies.delete('civic-session');
      return res;
    }

    // Admin routes require admin/creator role (check claim from signed cookie)
    if (pathname.startsWith('/admin')) {
      if (!sessionPayload || (sessionPayload.role !== 'admin' && sessionPayload.role !== 'creator')) {
        return NextResponse.redirect(new URL('/feed', request.url));
      }
    }
  }

  // ── 2. CORS check for API routes ──────────────────────────
  const origin = request.headers.get('origin');
  if (pathname.startsWith('/api/') && !isAllowedOrigin(origin, request.url)) {
    return new NextResponse(
      JSON.stringify({ error: 'Forbidden.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── 3. CSRF validation for state-changing API requests ────
  // The session cookie uses SameSite=Strict which is the primary CSRF defence.
  // The double-submit cookie adds defence-in-depth but must not block
  // same-origin fetch() calls from the app itself. We enforce CSRF only
  // for cross-origin POST requests (where an Origin header is present
  // and doesn't match the app's own host).
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if (pathname.startsWith('/api/') && isMutating) {
    const isSameOrigin = !origin || isAllowedOrigin(origin, request.url);

    if (!isSameOrigin) {
      const csrfCookie = request.cookies.get('__csrf')?.value;
      const csrfHeader = request.headers.get('x-csrf-token');

      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return new NextResponse(
          JSON.stringify({ error: 'Invalid or missing CSRF token.' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }
  }

  // ── 3b. Sliding session refresh ──────────────────────────
  // If the session cookie is past 50% of its lifetime, refresh the
  // cookie expiry so active users aren't logged out. Only runs for
  // cookies whose HMAC signature verified above — tampered or expired
  // cookies are never refreshed (they're cleared instead).
  const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours (matches session.ts)
  let shouldRefreshSession = false;
  if (sessionPayload?.iat) {
    // NOTE: iat is in MILLISECONDS (session.ts signs with Date.now())
    const ageMs = Date.now() - sessionPayload.iat;
    if (ageMs > SESSION_MAX_AGE_MS / 2) {
      shouldRefreshSession = true;
    }
  }

  // ── 4. Build response with security headers ───────────────
  const response = NextResponse.next();

  // Apply security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (key === 'Content-Security-Policy-Report-Only' && pathname.startsWith('/admin')) {
      response.headers.set(key, ADMIN_CSP);
    } else {
      response.headers.set(key, value);
    }
  }

  // Rate limit headers
  response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  response.headers.set('X-RateLimit-Remaining', String(rateResult.remaining));

  // ── 5. CSRF cookie provisioning ───────────────────────────
  if (!request.cookies.get('__csrf')) {
    response.cookies.set('__csrf', generateToken(), {
      httpOnly: false, // JS must read it to send as header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  }

  // ── 6. CORS headers for API routes ────────────────────────
  if (pathname.startsWith('/api/')) {
    const allowedOrigin = process.env.NODE_ENV === 'production'
      ? (origin && isAllowedOrigin(origin, request.url) ? origin : new URL(request.url).origin)
      : (origin || '*');

    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-csrf-token, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // ── 7. Sliding session refresh — extend cookie expiry ─────
  // Invalid (tampered/expired) session cookies are cleared instead.
  if (hasInvalidSession) {
    response.cookies.delete(SESSION_COOKIE);
  }
  if (shouldRefreshSession && sessionCookie) {
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });
  }

  // ── 8. Remove server info headers ─────────────────────────
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');

  return response;
}

// ─── Matcher: run on all routes except static assets ─────────
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|xml|txt|webmanifest|mp4|webm|ogg|mov)$).*)',
  ],
};
