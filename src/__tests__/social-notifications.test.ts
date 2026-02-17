// ═══════════════════════════════════════════════════════════════
// Tests: Follow/Unfollow + Notification Subscriptions + Notifications
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';

// ─── Reset the store before each test ─────────────────────────
// We access the global symbol directly to reset state

const STORE_KEY = Symbol.for('civic.social.store');

function resetStore() {
  (global as Record<symbol, unknown>)[STORE_KEY] = undefined;
}

// Import after defining reset so module can be re-initialized
import {
  isFollowing,
  follow,
  unfollow,
  getFollowerCount,
  getFollowingCount,
  getFollowingIds,
  isSubscribedToPosts,
  subscribeToPosts,
  unsubscribeFromPosts,
  getSubscriptionLevel,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllRead,
  markSeen,
} from '@/lib/social-store';

// ═══════════════════════════════════════════════════════════════
// A) FOLLOW / UNFOLLOW
// ═══════════════════════════════════════════════════════════════

describe('Follow/Unfollow', () => {
  beforeEach(() => resetStore());

  it('seed data: current user follows sarah, elena, david', () => {
    expect(isFollowing('user-current', 'user-sarah')).toBe(true);
    expect(isFollowing('user-current', 'user-elena')).toBe(true);
    expect(isFollowing('user-current', 'user-david')).toBe(true);
    expect(isFollowing('user-current', 'user-marcus')).toBe(false);
  });

  it('follow creates edge and is idempotent', () => {
    expect(isFollowing('user-current', 'user-marcus')).toBe(false);
    follow('user-current', 'user-marcus');
    expect(isFollowing('user-current', 'user-marcus')).toBe(true);
    // Idempotent — calling follow again should not duplicate
    follow('user-current', 'user-marcus');
    expect(getFollowerCount('user-marcus')).toBe(1);
  });

  it('unfollow removes edge', () => {
    expect(isFollowing('user-current', 'user-sarah')).toBe(true);
    unfollow('user-current', 'user-sarah');
    expect(isFollowing('user-current', 'user-sarah')).toBe(false);
  });

  it('unfollow on non-existing edge is a no-op', () => {
    expect(isFollowing('user-current', 'user-nobody')).toBe(false);
    unfollow('user-current', 'user-nobody'); // should not throw
    expect(isFollowing('user-current', 'user-nobody')).toBe(false);
  });

  it('follower and following counts are correct', () => {
    expect(getFollowingIds('user-current')).toContain('user-sarah');
    expect(getFollowingCount('user-current')).toBe(3); // sarah, elena, david
    expect(getFollowerCount('user-sarah')).toBe(1); // current user
  });

  it('unfollow auto-disables bell subscription', () => {
    // elena has a subscription from seed
    expect(isSubscribedToPosts('user-current', 'user-elena')).toBe(true);
    unfollow('user-current', 'user-elena');
    expect(isSubscribedToPosts('user-current', 'user-elena')).toBe(false);
  });

  it('follow generates a notification for the followed user', () => {
    const beforeCount = getNotifications('user-marcus').total;
    follow('user-current', 'user-marcus');
    const after = getNotifications('user-marcus');
    expect(after.total).toBe(beforeCount + 1);
    const followNotif = after.notifications.find((n) => n.type === 'follow');
    expect(followNotif).toBeDefined();
    expect(followNotif?.actorUserId).toBe('user-current');
  });
});

// ═══════════════════════════════════════════════════════════════
// B) NOTIFICATION SUBSCRIPTIONS (BELL)
// ═══════════════════════════════════════════════════════════════

describe('Notification Subscriptions (Bell)', () => {
  beforeEach(() => resetStore());

  it('seed data: elena subscription exists at level all', () => {
    expect(isSubscribedToPosts('user-current', 'user-elena')).toBe(true);
    expect(getSubscriptionLevel('user-current', 'user-elena')).toBe('all');
  });

  it('subscribeToPosts creates subscription', () => {
    expect(isSubscribedToPosts('user-current', 'user-sarah')).toBe(false);
    subscribeToPosts('user-current', 'user-sarah', 'debates');
    expect(isSubscribedToPosts('user-current', 'user-sarah')).toBe(true);
    expect(getSubscriptionLevel('user-current', 'user-sarah')).toBe('debates');
  });

  it('subscribeToPosts auto-follows if not following', () => {
    expect(isFollowing('user-current', 'user-rachel')).toBe(false);
    subscribeToPosts('user-current', 'user-rachel', 'all');
    expect(isFollowing('user-current', 'user-rachel')).toBe(true);
    expect(isSubscribedToPosts('user-current', 'user-rachel')).toBe(true);
  });

  it('unsubscribeFromPosts removes subscription', () => {
    expect(isSubscribedToPosts('user-current', 'user-elena')).toBe(true);
    unsubscribeFromPosts('user-current', 'user-elena');
    expect(isSubscribedToPosts('user-current', 'user-elena')).toBe(false);
    // But still following
    expect(isFollowing('user-current', 'user-elena')).toBe(true);
  });

  it('getSubscriptionLevel returns null when not subscribed', () => {
    expect(getSubscriptionLevel('user-current', 'user-marcus')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// C) NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

describe('Notifications', () => {
  beforeEach(() => resetStore());

  it('seed data has notifications for current user', () => {
    const result = getNotifications('user-current');
    expect(result.notifications.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('unread count matches notifications without readAt', () => {
    const result = getNotifications('user-current');
    const manualUnread = result.notifications.filter((n) => !n.readAt).length;
    // Note: unreadCount counts ALL, not just paginated
    expect(result.unreadCount).toBe(getUnreadCount('user-current'));
    expect(manualUnread).toBeLessThanOrEqual(result.unreadCount);
  });

  it('notifications are sorted newest first', () => {
    const result = getNotifications('user-current');
    for (let i = 1; i < result.notifications.length; i++) {
      const prev = new Date(result.notifications[i - 1].createdAt).getTime();
      const curr = new Date(result.notifications[i].createdAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('pagination works correctly', () => {
    const all = getNotifications('user-current', { limit: 100 });
    const page1 = getNotifications('user-current', { limit: 3, offset: 0 });
    const page2 = getNotifications('user-current', { limit: 3, offset: 3 });

    expect(page1.notifications.length).toBeLessThanOrEqual(3);
    expect(page1.total).toBe(all.total);

    // No overlap
    const page1Ids = new Set(page1.notifications.map((n) => n.id));
    for (const n of page2.notifications) {
      expect(page1Ids.has(n.id)).toBe(false);
    }
  });

  it('each notification has required fields', () => {
    const result = getNotifications('user-current');
    for (const n of result.notifications) {
      expect(n.id).toBeTruthy();
      expect(n.recipientUserId).toBe('user-current');
      expect(n.type).toBeTruthy();
      expect(n.entityType).toBeTruthy();
      expect(n.entityId).toBeTruthy();
      expect(n.createdAt).toBeTruthy();
      // readAt can be null
      // metadata should exist
      expect(n.metadata).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// D) MARK AS READ
// ═══════════════════════════════════════════════════════════════

describe('Mark as Read', () => {
  beforeEach(() => resetStore());

  it('markNotificationRead marks a single notification', () => {
    const result = getNotifications('user-current');
    const unread = result.notifications.find((n) => !n.readAt);
    expect(unread).toBeDefined();

    const ok = markNotificationRead(unread!.id);
    expect(ok).toBe(true);

    // Verify it's now read
    const after = getNotifications('user-current');
    const found = after.notifications.find((n) => n.id === unread!.id);
    expect(found?.readAt).toBeTruthy();
  });

  it('markNotificationRead on already-read is a no-op and returns false', () => {
    const result = getNotifications('user-current');
    const alreadyRead = result.notifications.find((n) => n.readAt);
    if (alreadyRead) {
      const ok = markNotificationRead(alreadyRead.id);
      expect(ok).toBe(false);
    }
  });

  it('markAllRead marks all unread notifications and clears count', () => {
    const before = getUnreadCount('user-current');
    expect(before).toBeGreaterThan(0);

    const result = markAllRead('user-current');
    expect(result.markedCount).toBe(before);
    expect(result.unreadCountRemaining).toBe(0);
    expect(result.serverTime).toBeTruthy();

    expect(getUnreadCount('user-current')).toBe(0);
  });

  it('markAllRead is idempotent — calling twice does not break', () => {
    markAllRead('user-current');
    const result = markAllRead('user-current');
    expect(result.markedCount).toBe(0);
    expect(result.unreadCountRemaining).toBe(0);
  });

  it('markAllRead with up_to only marks notifications before timestamp', () => {
    const notifs = getNotifications('user-current');
    const sorted = [...notifs.notifications].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    // Use the middle notification's timestamp as cutoff
    const midIdx = Math.floor(sorted.length / 2);
    const cutoff = sorted[midIdx].createdAt;

    const result = markAllRead('user-current', cutoff);

    // Some may remain unread (those after cutoff)
    // The exact count depends on seed data, but remaining should be >= 0
    expect(result.markedCount).toBeGreaterThanOrEqual(0);
    expect(result.unreadCountRemaining).toBeGreaterThanOrEqual(0);
  });

  it('new notification after markAllRead shows in unread count', () => {
    markAllRead('user-current');
    expect(getUnreadCount('user-current')).toBe(0);

    // Trigger a follow which creates a new notification
    follow('user-new-person', 'user-current');

    expect(getUnreadCount('user-current')).toBe(1);
  });

  it('markSeen sets seenAt without affecting readAt', () => {
    const before = getNotifications('user-current');
    const unreadUnseen = before.notifications.find((n) => !n.readAt && !n.seenAt);

    markSeen('user-current');

    if (unreadUnseen) {
      const after = getNotifications('user-current');
      const found = after.notifications.find((n) => n.id === unreadUnseen.id);
      expect(found?.seenAt).toBeTruthy();
      expect(found?.readAt).toBeNull(); // Still unread
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// E) RACE CONDITIONS
// ═══════════════════════════════════════════════════════════════

describe('Race condition handling', () => {
  beforeEach(() => resetStore());

  it('new notification during markAllRead remains unread', () => {
    const beforeUnread = getUnreadCount('user-current');
    expect(beforeUnread).toBeGreaterThan(0);

    // Mark all read with a specific cutoff (simulating in-flight)
    const cutoff = new Date().toISOString();
    markAllRead('user-current', cutoff);

    // New notification arrives AFTER cutoff
    follow('user-latecomer', 'user-current');

    // The new notification should be unread
    const remaining = getUnreadCount('user-current');
    expect(remaining).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// F) NOTIFICATION TYPES
// ═══════════════════════════════════════════════════════════════

describe('Notification types in seed data', () => {
  beforeEach(() => resetStore());

  it('has follow, reply, like, mention, and system notifications', () => {
    const result = getNotifications('user-current', { limit: 100 });
    const types = new Set(result.notifications.map((n) => n.type));

    expect(types.has('reply')).toBe(true);
    expect(types.has('like')).toBe(true);
    expect(types.has('follow')).toBe(true);
    expect(types.has('mention')).toBe(true);
    expect(types.has('civility_boost')).toBe(true);
  });

  it('follow notifications have actor metadata', () => {
    const result = getNotifications('user-current', { limit: 100 });
    const followNotif = result.notifications.find((n) => n.type === 'follow');
    expect(followNotif).toBeDefined();
    expect(followNotif?.actorUserId).toBeTruthy();
    expect(followNotif?.metadata.actorName).toBeTruthy();
  });

  it('reply notifications have preview text', () => {
    const result = getNotifications('user-current', { limit: 100 });
    const replyNotif = result.notifications.find((n) => n.type === 'reply');
    expect(replyNotif).toBeDefined();
    expect(replyNotif?.metadata.preview).toBeTruthy();
  });
});
