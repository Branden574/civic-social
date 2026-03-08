// ═══════════════════════════════════════════════════════════════
// POST /api/auth/login — Verify credentials and start session
// ═══════════════════════════════════════════════════════════════
// Looks up the user by email, verifies the PBKDF2 password hash,
// and sets an HMAC-signed HttpOnly session cookie so the client
// cannot forge or tamper with session data.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { postLimiter } from '@/lib/security/rate-limiter';
import { verifyPassword } from '@/lib/security/hash';
import { isDbAvailable, prisma } from '@/lib/db';
import { secureLog } from '@/lib/security/logger';
import { signSession, sessionCookieOptions } from '@/lib/security/session';
import { ensureUserRecord } from '@/lib/user-registry';

// Generic error to avoid leaking whether the email exists
const INVALID_CREDENTIALS = 'Invalid email or password.';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = postLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON.');
  }

  const email = (body.email as string)?.toLowerCase().trim();
  const password = body.password as string;

  if (!email || !isValidEmail(email)) {
    return badRequest('Please enter a valid email address.');
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  if (isDbAvailable()) {
    // DB path: look up by email, verify stored hash
    const row = await prisma.searchableUser.findFirst({
      where: { email },
      select: {
        id: true, email: true, displayName: true, username: true,
        passwordHash: true, createdAt: true, onboardingCompletedAt: true,
        role: true, suspendedUntil: true,
      },
    });

    if (!row) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    if (!row.passwordHash || !verifyPassword(password, row.passwordHash)) {
      secureLog.info('POST /api/auth/login', `failed_attempt email=${email}`);
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    secureLog.info('POST /api/auth/login', `success id=${row.id} email=${email}`);

    // Check if user is suspended
    if (row.suspendedUntil && new Date(row.suspendedUntil) > new Date()) {
      return NextResponse.json(
        { error: `Your account is suspended until ${new Date(row.suspendedUntil).toLocaleDateString()}.` },
        { status: 403 },
      );
    }

    // Check if user is banned (role = 'banned')
    if (row.role === 'banned') {
      return NextResponse.json(
        { error: 'Your account has been permanently banned.' },
        { status: 403 },
      );
    }

    // Ensure User table has a record (needed for Follow foreign keys)
    await ensureUserRecord({
      id: row.id,
      email: row.email,
      username: row.username,
      displayName: row.displayName,
    });

    // Returning users: ensure onboarding is marked complete in DB
    if (!row.onboardingCompletedAt) {
      prisma.searchableUser.update({
        where: { id: row.id },
        data: { onboardingCompletedAt: new Date() },
      }).catch(() => {});
    }

    // Read role from DB — never hardcode
    const VALID_ROLES = ['user', 'moderator', 'admin', 'creator'] as const;
    type ValidRole = typeof VALID_ROLES[number];
    const dbRole = row.role || 'user';
    const role: ValidRole = (VALID_ROLES as readonly string[]).includes(dbRole) ? (dbRole as ValidRole) : 'user';

    const userData = {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      username: row.username,
      role,
      createdAt: row.createdAt.toISOString(),
    };

    // Sign the session token server-side and set as HttpOnly cookie
    const token = signSession({
      id: row.id,
      email: row.email,
      role,
      displayName: row.displayName,
      iat: Date.now(),
    });

    const response = NextResponse.json({ success: true, user: userData });
    const opts = sessionCookieOptions();
    response.cookies.set(opts.name, token, {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      maxAge: opts.maxAge,
      path: opts.path,
    });
    return response;
  }

  // No DB: cannot verify passwords — inform the client
  return NextResponse.json(
    { error: 'Login verification requires a database connection. Please contact support.' },
    { status: 503 },
  );
}
