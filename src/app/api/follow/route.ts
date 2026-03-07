import { NextRequest, NextResponse } from 'next/server';
import {
  isSubscribedToPosts,
  subscribeToPosts,
  unsubscribeFromPosts,
  getSubscriptionLevel,
  dbFollow,
  dbUnfollow,
  dbIsFollowing,
  dbGetFollowerCount,
  dbGetFollowingCount,
  createNotification,
} from '@/lib/social-store';
import { getSessionUser, getClientIp, tooManyRequests, badRequest } from '@/lib/security/api-guard';
import { socialLimiter, readLimiter } from '@/lib/security/rate-limiter';
import { isValidId } from '@/lib/security/sanitize';

// ─── GET /api/follow?target=user-xxx ─────────────────────────

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = readLimiter.check(ip);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('target');

  if (!targetUserId || !isValidId(targetUserId)) {
    return badRequest('Valid target param required.');
  }

  const user = getSessionUser(request);

  // Unauthenticated: return counts but no relationship state
  if (!user) {
    return NextResponse.json({
      isFollowing: false,
      isNotifyEnabled: false,
      notifyLevel: null,
      followerCount: await dbGetFollowerCount(targetUserId),
      followingCount: await dbGetFollowingCount(targetUserId),
      viewerFollowingCount: 0,
      authenticated: false,
      serverTime: new Date().toISOString(),
    });
  }

  const currentUser = user.id;

  return NextResponse.json({
    isFollowing: await dbIsFollowing(currentUser, targetUserId),
    isNotifyEnabled: isSubscribedToPosts(currentUser, targetUserId),
    notifyLevel: getSubscriptionLevel(currentUser, targetUserId),
    followerCount: await dbGetFollowerCount(targetUserId),
    followingCount: await dbGetFollowingCount(targetUserId),
    viewerFollowingCount: await dbGetFollowingCount(currentUser),
    authenticated: true,
    serverTime: new Date().toISOString(),
  });
}

// ─── POST /api/follow ────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = getSessionUser(request);

  // Auth required — no silent fallback
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required. Please log in to follow users.', code: 'AUTH_REQUIRED' },
      { status: 401 },
    );
  }

  const currentUser = user.id;

  // Rate limit social actions
  const rl = socialLimiter.check(currentUser);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.');
  }

  const action = body.action as string;
  const targetUserId = body.target_user_id as string;

  if (!targetUserId || !isValidId(targetUserId)) {
    return badRequest('Valid target_user_id required.');
  }

  if (targetUserId === currentUser) {
    return badRequest('Cannot follow yourself.');
  }

  switch (action) {
    case 'follow': {
      await dbFollow(currentUser, targetUserId);
      // Create follow notification for the target user
      createNotification({
        recipientUserId: targetUserId,
        actorUserId: currentUser,
        type: 'follow',
        entityType: 'user',
        entityId: targetUserId,
        metadata: {
          actorName: user.displayName,
          actorUsername: '',
        },
      });
      return NextResponse.json({
        success: true,
        isFollowing: true,
        isNotifyEnabled: isSubscribedToPosts(currentUser, targetUserId),
        followerCount: await dbGetFollowerCount(targetUserId),
        followingCount: await dbGetFollowingCount(targetUserId),
        viewerFollowingCount: await dbGetFollowingCount(currentUser),
      });
    }

    case 'unfollow':
      await dbUnfollow(currentUser, targetUserId);
      return NextResponse.json({
        success: true,
        isFollowing: false,
        isNotifyEnabled: false,
        followerCount: await dbGetFollowerCount(targetUserId),
        followingCount: await dbGetFollowingCount(targetUserId),
        viewerFollowingCount: await dbGetFollowingCount(currentUser),
      });

    case 'subscribe': {
      const level = (['all', 'debates', 'mentions'].includes(body.level as string) ? body.level : 'all') as 'all' | 'debates' | 'mentions';
      subscribeToPosts(currentUser, targetUserId, level);
      return NextResponse.json({
        success: true,
        isFollowing: await dbIsFollowing(currentUser, targetUserId),
        isNotifyEnabled: true,
        notifyLevel: level,
        followerCount: await dbGetFollowerCount(targetUserId),
        viewerFollowingCount: await dbGetFollowingCount(currentUser),
      });
    }

    case 'unsubscribe':
      unsubscribeFromPosts(currentUser, targetUserId);
      return NextResponse.json({
        success: true,
        isFollowing: await dbIsFollowing(currentUser, targetUserId),
        isNotifyEnabled: false,
        followerCount: await dbGetFollowerCount(targetUserId),
        viewerFollowingCount: await dbGetFollowingCount(currentUser),
      });

    default:
      return badRequest('Unknown action.');
  }
}
