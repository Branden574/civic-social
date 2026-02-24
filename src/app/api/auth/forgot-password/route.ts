// ═══════════════════════════════════════════════════════════════
// POST /api/auth/forgot-password
// Generates a one-time reset token, stores it in PasswordResetToken,
// and sends the reset link via Resend email.
// Always returns 200 to avoid leaking whether an email is registered.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { postLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

const OK_RESPONSE = NextResponse.json({
  success: true,
  message: 'If that email is registered, a reset link has been sent.',
});

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
  if (!email || !isValidEmail(email)) {
    return badRequest('Valid email required.');
  }

  if (!isDbAvailable()) {
    // Can't send resets without DB — still return OK to avoid leaking info
    return OK_RESPONSE;
  }

  // Look up user — silently no-op if not found
  const user = await prisma.searchableUser.findFirst({ where: { email } });
  if (!user) return OK_RESPONSE;

  // Generate a cryptographically random token
  const token = randomBytes(32).toString('hex');
  const tokenId = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  try {
    await prisma.$executeRaw`
      INSERT INTO "PasswordResetToken" ("id", "userId", "token", "expiresAt")
      VALUES (${tokenId}, ${user.id}, ${token}, ${expiresAt})
    `;
  } catch (err) {
    console.error('[forgot-password] Failed to create token:', err);
    return OK_RESPONSE;
  }

  // Build reset URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await sendPasswordResetEmail(email, resetUrl);

  return OK_RESPONSE;
}
