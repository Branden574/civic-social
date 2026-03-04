// ═══════════════════════════════════════════════════════════════
// POST /api/auth/verify-email — Verify email with token
// GET  /api/auth/verify-email?token=xxx — Verify via link click
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';

async function verifyToken(token: string): Promise<NextResponse> {
  if (!token || typeof token !== 'string' || token.length < 32) {
    return badRequest('Valid verification token required.');
  }

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Email verification requires a database connection.' }, { status: 503 });
  }

  const rows = await prisma.$queryRaw<{
    id: string;
    userId: string;
    email: string;
    expiresAt: Date;
    usedAt: Date | null;
  }[]>`
    SELECT "id", "userId", "email", "expiresAt", "usedAt"
    FROM "EmailVerificationToken"
    WHERE "token" = ${token}
    LIMIT 1
  `;

  const record = rows[0];

  if (!record) {
    return NextResponse.json({ error: 'Invalid or expired verification link.' }, { status: 400 });
  }

  if (record.usedAt) {
    return NextResponse.json({ success: true, message: 'Email already verified.' });
  }

  if (new Date() > new Date(record.expiresAt)) {
    return NextResponse.json({ error: 'This verification link has expired. Please request a new one.' }, { status: 400 });
  }

  // Mark email as verified
  try {
    await prisma.searchableUser.update({
      where: { id: record.userId },
      data: { verificationLevel: 'EMAIL_VERIFIED', isVerified: true },
    });
  } catch (err) {
    console.error('[verify-email] Failed to update user:', err);
    return NextResponse.json({ error: 'Failed to verify email. Please try again.' }, { status: 500 });
  }

  // Mark token as used
  try {
    await prisma.$executeRaw`
      UPDATE "EmailVerificationToken" SET "usedAt" = NOW() WHERE "id" = ${record.id}
    `;
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ success: true, message: 'Email verified successfully!' });
}

// GET handler for clicking the link in the email
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';

  const result = await verifyToken(token);

  // For GET requests (link click), redirect to the app with a status message
  const data = await result.json();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  if (data.success) {
    return NextResponse.redirect(`${appUrl}/feed?verified=true`);
  }
  return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(data.error || 'Verification failed')}`);
}

// POST handler for programmatic verification
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON.');
  }

  const token = (body.token as string)?.trim() || '';
  return verifyToken(token);
}
