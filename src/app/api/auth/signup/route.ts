// ═══════════════════════════════════════════════════════════════
// POST /api/auth/signup — Create a new account
// ═══════════════════════════════════════════════════════════════
// Generates a stable server-side user ID, hashes the password,
// and upserts the user into SearchableUser (DB or in-memory).
// Returns the user object so the client can start a session.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { postLimiter } from '@/lib/security/rate-limiter';
import { validatePassword } from '@/lib/security/password';
import { hashPassword } from '@/lib/security/hash';
import { isDbAvailable, prisma } from '@/lib/db';
import { registerUser, getUserById } from '@/lib/user-registry';
import { secureLog } from '@/lib/security/logger';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

function sanitizeDisplayName(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s.\-']/gu, '')
    .trim()
    .slice(0, 50);
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
  const rawDisplayName = body.displayName as string;

  if (!email || !isValidEmail(email)) {
    return badRequest('Please enter a valid email address.');
  }

  const passwordResult = validatePassword(password, email);
  if (!passwordResult.valid) {
    return NextResponse.json({ error: passwordResult.errors[0] }, { status: 400 });
  }

  const displayName = sanitizeDisplayName(rawDisplayName || '');
  if (!displayName || displayName.length < 2) {
    return badRequest('Display name must be at least 2 characters.');
  }

  const username = displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '');

  // Check for existing email if DB is available
  if (isDbAvailable()) {
    const existing = await prisma.searchableUser.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
  }

  const passwordHash = hashPassword(password);
  // Stable ID: deterministic prefix + UUID so it survives restarts
  const id = `user-${randomUUID().replace(/-/g, '').slice(0, 16)}`;

  try {
    // Store in registry (DB or in-memory)
    await registerUser({ id, displayName, username, email });

    // Persist the password hash — only possible with DB
    if (isDbAvailable()) {
      await prisma.searchableUser.update({
        where: { id },
        data: { passwordHash },
      });
    }

    secureLog.info('POST /api/auth/signup', `new_user id=${id} email=${email}`);

    const user = await getUserById(id);

    return NextResponse.json({
      success: true,
      user: {
        id,
        email,
        displayName,
        username,
        role: 'user',
        createdAt: user?.createdAt ?? new Date().toISOString(),
      },
    });
  } catch (err) {
    secureLog.error('POST /api/auth/signup', err);
    return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }
}
