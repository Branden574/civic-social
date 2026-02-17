import { NextRequest, NextResponse } from 'next/server';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markNotificationRead,
  markSeen,
} from '@/lib/social-store';
import { getSessionUser, getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { readLimiter, socialLimiter } from '@/lib/security/rate-limiter';
import { clampInt, isValidId } from '@/lib/security/sanitize';

// ─── GET /api/notifications ──────────────────────────────────

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const user = getSessionUser(request);
  const currentUser = user?.id || 'user-current';

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'unread-count') {
    return NextResponse.json({
      unreadCount: getUnreadCount(currentUser),
      serverTime: new Date().toISOString(),
    });
  }

  // List notifications with bounded pagination
  const limit = clampInt(searchParams.get('limit'), 1, 100, 50);
  const offset = clampInt(searchParams.get('offset'), 0, 10000, 0);
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  const result = getNotifications(currentUser, { limit, offset, unreadOnly });

  return NextResponse.json({
    notifications: result.notifications,
    total: result.total,
    unreadCount: result.unreadCount,
    serverTime: new Date().toISOString(),
  });
}

// ─── POST /api/notifications ─────────────────────────────────

export async function POST(request: NextRequest) {
  const user = getSessionUser(request);
  const currentUser = user?.id || 'user-current';

  const rl = socialLimiter.check(currentUser);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const body = await request.json();
  const action = body.action as string;

  if (action === 'mark-all-read') {
    const upTo = typeof body.up_to === 'string' ? body.up_to : undefined;
    const result = markAllRead(currentUser, upTo);
    return NextResponse.json({
      success: true,
      ...result,
    });
  }

  if (action === 'mark-read') {
    const notificationId = body.notification_id as string;
    if (!notificationId || !isValidId(notificationId)) {
      return badRequest('Valid notification_id required.');
    }
    const ok = markNotificationRead(notificationId);
    return NextResponse.json({
      success: ok,
      unreadCount: getUnreadCount(currentUser),
      serverTime: new Date().toISOString(),
    });
  }

  if (action === 'mark-seen') {
    markSeen(currentUser);
    return NextResponse.json({ success: true });
  }

  return badRequest('Unknown action.');
}
