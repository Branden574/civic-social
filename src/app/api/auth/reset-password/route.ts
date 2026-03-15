// ═══════════════════════════════════════════════════════════════
// POST /api/auth/reset-password
// Validates a one-time reset token, hashes the new password, and
// updates the user's passwordHash in SearchableUser.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { postLimiter } from '@/lib/security/rate-limiter';
import { hashPassword } from '@/lib/security/hash';
import { validatePassword } from '@/lib/security/password';
import { isDbAvailable, prisma } from '@/lib/db';

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

  const token = (body.token as string)?.trim();
  const newPassword = body.newPassword as string;

  if (!token || typeof token !== 'string' || token.length < 32) {
    return badRequest('Valid reset token required.');
  }

  if (!newPassword || typeof newPassword !== 'string') {
    return badRequest('New password required.');
  }

  const pwResult = validatePassword(newPassword, '');
  if (!pwResult.valid) {
    return NextResponse.json({ error: pwResult.errors[0] }, { status: 400 });
  }

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Password reset requires a database connection.' }, { status: 503 });
  }

  // Look up the token
  const rows = await prisma.$queryRaw<{
    id: string;
    userId: string;
    expiresAt: Date;
    usedAt: Date | null;
  }[]>`
    SELECT "id", "userId", "expiresAt", "usedAt"
    FROM "PasswordResetToken"
    WHERE "token" = ${token}
    LIMIT 1
  `;

  const record = rows[0];

  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 400 });
  }

  if (record.usedAt) {
    return NextResponse.json({ error: 'This reset link has already been used.' }, { status: 400 });
  }

  if (new Date() > new Date(record.expiresAt)) {
    return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 400 });
  }

  // Hash the new password and update user
  const passwordHash = hashPassword(newPassword);

  try {
    await prisma.searchableUser.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
  } catch (err) {
    console.error('[reset-password] Failed to update password:', err);
    return NextResponse.json({ error: 'Failed to update password. Please try again.' }, { status: 500 });
  }

  // Mark token as used
  try {
    await prisma.$executeRaw`
      UPDATE "PasswordResetToken" SET "usedAt" = NOW() WHERE "id" = ${record.id}
    `;
  } catch {
    // Non-fatal — password is already updated
  }

  // WARNING: Clear the session cookie so any existing sessions (including stolen ones)
  // can't continue using the old credentials. User must re-login with new password.
  const response = NextResponse.json({ success: true, message: 'Password updated. You can now log in.' });
  response.cookies.set('civic-session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return response;
}
