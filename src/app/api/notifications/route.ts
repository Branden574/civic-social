import { NextRequest, NextResponse } from 'next/server';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markSeen,
  deleteNotification,
  dbGetNotifications,
  dbGetUnreadCount,
  dbMarkAllRead,
  dbMarkNotificationRead,
} from '@/lib/social-store';
import { getSessionUser, getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { readLimiter, socialLimiter } from '@/lib/security/rate-limiter';
import { clampInt, isValidId } from '@/lib/security/sanitize';
import { getUserById } from '@/lib/user-registry';

// ─── GET /api/notifications ──────────────────────────────────

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const user = getSessionUser(request);

  // Unauthenticated: return zero counts, no notifications
  if (!user) {
    return NextResponse.json({
      unreadCount: 0,
      notifications: [],
      total: 0,
      serverTime: new Date().toISOString(),
    });
  }

  const currentUser = user.id;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'list';

  if (action === 'unread-count') {
    const count = await dbGetUnreadCount(currentUser);
    return NextResponse.json({
      unreadCount: count,
      serverTime: new Date().toISOString(),
    });
  }

  // List notifications with bounded pagination
  const limit = clampInt(searchParams.get('limit'), 1, 100, 50);
  const offset = clampInt(searchParams.get('offset'), 0, 10000, 0);
  const unreadOnly = searchParams.get('unreadOnly') === 'true';

  const result = await dbGetNotifications(currentUser, { limit, offset, unreadOnly });

  // Enrich actor display names from user registry (fixes follow notifications showing ID or wrong name)
  const enriched = await Promise.all(
    result.notifications.map(async (n) => {
      if (!n.actorUserId) return n;
      const actor = await getUserById(n.actorUserId);
      if (!actor) return n;
      return {
        ...n,
        metadata: {
          ...n.metadata,
          actorName: actor.displayName,
          actorUsername: actor.username,
        },
      };
    }),
  );

  return NextResponse.json({
    notifications: enriched,
    total: result.total,
    unreadCount: result.unreadCount,
    serverTime: new Date().toISOString(),
  });
}

// ─── POST /api/notifications ─────────────────────────────────

export async function POST(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const currentUser = user.id;

  const rl = socialLimiter.check(currentUser);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const body = await request.json();
  const action = body.action as string;

  if (action === 'mark-all-read') {
    const markedCount = await dbMarkAllRead(currentUser);
    return NextResponse.json({
      success: true,
      markedCount,
      unreadCountRemaining: 0,
      serverTime: new Date().toISOString(),
    });
  }

  if (action === 'mark-read') {
    const notificationId = body.notification_id as string;
    if (!notificationId || !isValidId(notificationId)) {
      return badRequest('Valid notification_id required.');
    }
    await dbMarkNotificationRead(notificationId);
    const unreadCount = await dbGetUnreadCount(currentUser);
    return NextResponse.json({
      success: true,
      unreadCount,
      serverTime: new Date().toISOString(),
    });
  }

  if (action === 'delete') {
    const notificationId = body.notification_id as string;
    if (!notificationId || !isValidId(notificationId)) {
      return badRequest('Valid notification_id required.');
    }
    const ok = deleteNotification(notificationId);
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
