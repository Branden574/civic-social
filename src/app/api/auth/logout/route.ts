// ═══════════════════════════════════════════════════════════════
// POST /api/auth/logout — End the current session
// ═══════════════════════════════════════════════════════════════
// Clears the HttpOnly session cookie. Since the cookie is
// HttpOnly, only the server can clear it.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/security/session';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return response;
}
