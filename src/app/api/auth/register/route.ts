// ═══════════════════════════════════════════════════════════════
// POST /api/auth/register — Register user in server-side registry
// ═══════════════════════════════════════════════════════════════
// Called during signup so the new user is immediately discoverable
// in search. Also called on app bootstrap (refreshMe) to ensure
// the user is re-registered after serverless cold starts.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { socialLimiter } from '@/lib/security/rate-limiter';
import { registerUser } from '@/lib/user-registry';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = socialLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // WARNING: Require authentication — prevent arbitrary user ID registration
  const sessionUser = getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  // WARNING: Force ID to match authenticated user — prevent impersonation
  const id = sessionUser.id;
  const displayName = body.displayName as string;
  const username = body.username as string;
  const email = body.email as string;
  const bio = (body.bio as string) || '';
  const affiliation = (body.affiliation as string) || '';

  if (!id || !displayName || !email) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  const user = await registerUser({
    id,
    displayName,
    username: username || displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, ''),
    email,
    bio,
    affiliation,
  });

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
    },
  });
}
