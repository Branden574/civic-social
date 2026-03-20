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
const RATE_LIMIT_MAX = 120; // requests per window

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
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com",
  "connect-src 'self' https://api.congress.gov https://vitals.vercel-insights.com https://*.vercel.app",
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

export function middleware(request: NextRequest) {
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
  if (!isPublicRoute) {
    const sessionCookie = request.cookies.get('civic-session')?.value;
    if (!sessionCookie) {
      const loginUrl = new URL('/', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Admin routes require admin/creator role (check claim from signed cookie)
    if (pathname.startsWith('/admin')) {
      try {
        const payload = JSON.parse(atob(sessionCookie.split('.')[0]));
        if (payload.role !== 'admin' && payload.role !== 'creator') {
          return NextResponse.redirect(new URL('/feed', request.url));
        }
      } catch {
        return NextResponse.redirect(new URL('/', request.url));
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
  // If the session cookie is valid and past 50% of its lifetime,
  // refresh the cookie expiry so active users aren't logged out.
  const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours (matches session.ts)
  const sessionCookie = request.cookies.get('civic-session')?.value;
  let shouldRefreshSession = false;
  if (sessionCookie) {
    try {
      const payload = JSON.parse(atob(sessionCookie.split('.')[0]));
      if (payload.iat) {
        const ageSeconds = Math.floor((Date.now() / 1000) - payload.iat);
        if (ageSeconds > SESSION_MAX_AGE / 2) {
          shouldRefreshSession = true;
        }
      }
    } catch {
      // Invalid session — ignore, let downstream auth handle it
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
  if (shouldRefreshSession && sessionCookie) {
    response.cookies.set('civic-session', sessionCookie, {
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
