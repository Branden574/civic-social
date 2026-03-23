import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const turnUrl = process.env.TURN_URL;
  const turnUser = process.env.TURN_USERNAME;
  const turnCred = process.env.TURN_CREDENTIAL;

  const servers: { urls: string; username?: string; credential?: string }[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (turnUrl && turnUser && turnCred) {
    servers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnCred,
    });
  }

  return NextResponse.json({ servers }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}
