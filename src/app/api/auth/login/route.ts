// ═══════════════════════════════════════════════════════════════
// POST /api/auth/login — Verify credentials and start session
// ═══════════════════════════════════════════════════════════════
// Looks up the user by email (DB-first, in-memory fallback),
// verifies the PBKDF2 password hash, and returns the user object
// so the client can set its session cookie.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { postLimiter } from '@/lib/security/rate-limiter';
import { verifyPassword } from '@/lib/security/hash';
import { isDbAvailable, prisma } from '@/lib/db';
import { secureLog } from '@/lib/security/logger';

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
    const row = await prisma.searchableUser.findFirst({ where: { email } });

    if (!row) {
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    if (!row.passwordHash || !verifyPassword(password, row.passwordHash)) {
      secureLog.info('POST /api/auth/login', `failed_attempt email=${email}`);
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    secureLog.info('POST /api/auth/login', `success id=${row.id} email=${email}`);

    return NextResponse.json({
      success: true,
      user: {
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        username: row.username,
        role: 'user',
        createdAt: row.createdAt.toISOString(),
      },
    });
  }

  // No DB: cannot verify passwords — inform the client
  return NextResponse.json(
    { error: 'Login verification requires a database connection. Please contact support.' },
    { status: 503 },
  );
}
