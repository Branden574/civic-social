import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getClientIp, tooManyRequests } from '@/lib/security/api-guard';
import { readLimiter } from '@/lib/security/rate-limiter';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.METERED_API_KEY;

  // Use Metered REST API to fetch TURN credentials (auto-selects nearest region)
  if (apiKey) {
    try {
      const res = await fetch(
        `https://civic-social.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
        { next: { revalidate: 300 } }, // cache for 5 minutes
      );
      if (res.ok) {
        const iceServers = await res.json();
        return NextResponse.json({ servers: iceServers }, {
          headers: { 'Cache-Control': 'private, max-age=300' },
        });
      }
    } catch { /* Metered API failed — fall through to defaults */ }
  }

  // Fallback: static TURN credentials or STUN-only
  const turnUrl = process.env.TURN_URL;
  const turnUser = process.env.TURN_USERNAME;
  const turnCred = process.env.TURN_CREDENTIAL;

  const servers: { urls: string; username?: string; credential?: string }[] = [...DEFAULT_ICE_SERVERS];

  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  }

  return NextResponse.json({ servers }, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}
