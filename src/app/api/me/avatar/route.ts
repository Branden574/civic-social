import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, badRequest, tooManyRequests } from '@/lib/security/api-guard';
import { postLimiter } from '@/lib/security/rate-limiter';
import { isDbAvailable, prisma } from '@/lib/db';

const MAX_AVATAR_BYTES = 500_000; // ~500KB base64
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export async function POST(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const rl = postLimiter.check(user.id);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON.');
  }

  const avatar = body.avatar as string;
  if (!avatar || typeof avatar !== 'string') {
    return badRequest('avatar field required (base64 data URL).');
  }

  // Validate data URL format
  const match = avatar.match(/^data:(image\/(png|jpeg|webp));base64,/);
  if (!match) {
    return badRequest('Avatar must be a base64 data URL (png, jpeg, or webp).');
  }

  if (!ALLOWED_TYPES.includes(match[1])) {
    return badRequest('Only PNG, JPEG, and WebP images are allowed.');
  }

  if (avatar.length > MAX_AVATAR_BYTES) {
    return badRequest('Avatar image too large. Please use a smaller image (max ~375KB).');
  }

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { avatar },
    });

    // Also update SearchableUser avatarUrl
    await prisma.searchableUser.update({
      where: { id: user.id },
      data: { avatarUrl: avatar },
    }).catch(() => { /* SearchableUser may not exist */ });

    return NextResponse.json({ success: true, avatar });
  } catch (err) {
    console.error('[avatar upload]', err);
    return NextResponse.json({ error: 'Failed to save avatar.' }, { status: 500 });
  }
}
