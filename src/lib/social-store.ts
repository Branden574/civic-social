// ═══════════════════════════════════════════════════════════════
// Civic Social — Social Graph + Notifications Store
// ═══════════════════════════════════════════════════════════════
//
// Server-side in-memory store for follows, notification
// subscriptions, and notifications. Uses Symbol.for on global
// to persist across HMR in Next.js dev mode.
//
// In production: Replace with Prisma/DB queries.
// ═══════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────

export type NotificationType =
  | 'follow'
  | 'like'
  | 'reply'
  | 'repost'
  | 'mention'
  | 'post_from_followed'
  | 'debate_invite'
  | 'civility_boost'
  | 'system';

export interface Notification {
  id: string;
  recipientUserId: string;
  actorUserId: string | null;
  type: NotificationType;
  entityType: 'post' | 'comment' | 'user' | 'bill' | 'article' | 'system';
  entityId: string;
  createdAt: string; // ISO
  readAt: string | null;
  seenAt: string | null;
  metadata: {
    actorName?: string;
    actorUsername?: string;
    preview?: string;
    postId?: string;
    billId?: string;
    score?: number;
  };
}

export interface FollowEdge {
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface NotificationSubscription {
  subscriberId: string;
  targetUserId: string;
  eventType: 'new_post';
  level: 'all' | 'debates' | 'mentions';
  createdAt: string;
}

interface SocialStore {
  follows: FollowEdge[];
  subscriptions: NotificationSubscription[];
  notifications: Notification[];
}

// ─── Global Singleton ────────────────────────────────────────

const STORE_KEY = Symbol.for('civic.social.store');

interface GlobalWithStore {
  [key: symbol]: SocialStore | undefined;
}

function getStore(): SocialStore {
  const g = global as unknown as GlobalWithStore;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = createInitialStore();
  }
  return g[STORE_KEY]!;
}

// ─── Seed Data ───────────────────────────────────────────────

const CURRENT_USER = 'user-current';

function createInitialStore(): SocialStore {
  const now = new Date();
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000).toISOString();

  // Seed follows (current user follows some people)
  const follows: FollowEdge[] = [
    { followerId: CURRENT_USER, followingId: 'user-sarah', createdAt: ago(10080) },
    { followerId: CURRENT_USER, followingId: 'user-elena', createdAt: ago(7200) },
    { followerId: CURRENT_USER, followingId: 'user-david', createdAt: ago(4320) },
  ];

  // Seed subscriptions (bell on for elena)
  const subscriptions: NotificationSubscription[] = [
    { subscriberId: CURRENT_USER, targetUserId: 'user-elena', eventType: 'new_post', level: 'all', createdAt: ago(7200) },
  ];

  // Seed notifications
  const notifications: Notification[] = [
    {
      id: 'notif-1',
      recipientUserId: CURRENT_USER,
      actorUserId: 'user-elena',
      type: 'reply',
      entityType: 'post',
      entityId: 'post-1',
      createdAt: ago(2),
      readAt: null,
      seenAt: null,
      metadata: { actorName: 'Dr. Elena Rodriguez', actorUsername: 'elena-rodriguez', preview: 'Great analysis on the healthcare comparison. I think the data supports...' },
    },
    {
      id: 'notif-2',
      recipientUserId: CURRENT_USER,
      actorUserId: 'user-marcus',
      type: 'like',
      entityType: 'post',
      entityId: 'post-2',
      createdAt: ago(15),
      readAt: null,
      seenAt: null,
      metadata: { actorName: 'Marcus Johnson', actorUsername: 'marcus-johnson', preview: 'Infrastructure spending should prioritize...' },
    },
    {
      id: 'notif-3',
      recipientUserId: CURRENT_USER,
      actorUserId: 'user-amara',
      type: 'follow',
      entityType: 'user',
      entityId: CURRENT_USER,
      createdAt: ago(60),
      readAt: null,
      seenAt: null,
      metadata: { actorName: 'Amara Okafor', actorUsername: 'amara-okafor' },
    },
    {
      id: 'notif-4',
      recipientUserId: CURRENT_USER,
      actorUserId: 'user-sarah',
      type: 'post_from_followed',
      entityType: 'post',
      entityId: 'post-3',
      createdAt: ago(90),
      readAt: null,
      seenAt: null,
      metadata: { actorName: 'Sarah Chen', actorUsername: 'sarah-chen', preview: 'New analysis: How the proposed healthcare bill compares to existing systems...' },
    },
    {
      id: 'notif-5',
      recipientUserId: CURRENT_USER,
      actorUserId: null,
      type: 'civility_boost',
      entityType: 'system',
      entityId: 'system-civ-1',
      createdAt: ago(180),
      readAt: null,
      seenAt: null,
      metadata: { actorName: 'Civic Social', preview: 'Your credibility score increased to 89. Keep up the civil engagement!', score: 89 },
    },
    {
      id: 'notif-6',
      recipientUserId: CURRENT_USER,
      actorUserId: 'user-rachel',
      type: 'mention',
      entityType: 'post',
      entityId: 'post-7',
      createdAt: ago(240),
      readAt: ago(120),
      seenAt: ago(120),
      metadata: { actorName: 'Rachel Thompson', actorUsername: 'rachel-thompson', preview: 'As @you mentioned, the VA healthcare data shows...' },
    },
    {
      id: 'notif-7',
      recipientUserId: CURRENT_USER,
      actorUserId: 'user-david',
      type: 'reply',
      entityType: 'post',
      entityId: 'post-1',
      createdAt: ago(300),
      readAt: ago(200),
      seenAt: ago(200),
      metadata: { actorName: 'David Park', actorUsername: 'david-park', preview: 'While I disagree on the funding model, your analysis of the cost structure is solid...' },
    },
    {
      id: 'notif-8',
      recipientUserId: CURRENT_USER,
      actorUserId: 'user-sarah',
      type: 'debate_invite',
      entityType: 'post',
      entityId: 'debate-1',
      createdAt: ago(360),
      readAt: ago(300),
      seenAt: ago(300),
      metadata: { actorName: 'Sarah Chen', actorUsername: 'sarah-chen', preview: 'Universal Healthcare vs. Market-Based Reform' },
    },
  ];

  return { follows, subscriptions, notifications };
}

// ═══════════════════════════════════════════════════════════════
// FOLLOW OPERATIONS
// ═══════════════════════════════════════════════════════════════

export function isFollowing(followerId: string, followingId: string): boolean {
  return getStore().follows.some(
    (f) => f.followerId === followerId && f.followingId === followingId,
  );
}

export function follow(
  followerId: string,
  followingId: string,
  actorDisplayName?: string,
  actorUsername?: string,
): void {
  const store = getStore();
  if (!isFollowing(followerId, followingId)) {
    store.follows.push({
      followerId,
      followingId,
      createdAt: new Date().toISOString(),
    });
    createNotification({
      recipientUserId: followingId,
      actorUserId: followerId,
      type: 'follow',
      entityType: 'user',
      entityId: followingId,
      metadata: {
        actorName: actorDisplayName || followerId,
        actorUsername: actorUsername || '',
      },
    });
  }
}

export function unfollow(followerId: string, followingId: string): void {
  const store = getStore();
  store.follows = store.follows.filter(
    (f) => !(f.followerId === followerId && f.followingId === followingId),
  );
  // Auto-disable post notifications
  unsubscribeFromPosts(followerId, followingId);
}

export function getFollowerCount(userId: string): number {
  return getStore().follows.filter((f) => f.followingId === userId).length;
}

export function getFollowingCount(userId: string): number {
  return getStore().follows.filter((f) => f.followerId === userId).length;
}

export function getFollowingIds(userId: string): string[] {
  return getStore().follows
    .filter((f) => f.followerId === userId)
    .map((f) => f.followingId);
}

export function getFollowerIds(userId: string): string[] {
  return getStore().follows
    .filter((f) => f.followingId === userId)
    .map((f) => f.followerId);
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION SUBSCRIPTIONS (BELL)
// ═══════════════════════════════════════════════════════════════

export function isSubscribedToPosts(subscriberId: string, targetUserId: string): boolean {
  return getStore().subscriptions.some(
    (s) => s.subscriberId === subscriberId && s.targetUserId === targetUserId && s.eventType === 'new_post',
  );
}

export function subscribeToPosts(
  subscriberId: string,
  targetUserId: string,
  level: 'all' | 'debates' | 'mentions' = 'all',
): void {
  const store = getStore();
  if (!isSubscribedToPosts(subscriberId, targetUserId)) {
    store.subscriptions.push({
      subscriberId,
      targetUserId,
      eventType: 'new_post',
      level,
      createdAt: new Date().toISOString(),
    });
  }
  // Auto-follow if not already following
  if (!isFollowing(subscriberId, targetUserId)) {
    follow(subscriberId, targetUserId);
  }
}

export function unsubscribeFromPosts(subscriberId: string, targetUserId: string): void {
  const store = getStore();
  store.subscriptions = store.subscriptions.filter(
    (s) => !(s.subscriberId === subscriberId && s.targetUserId === targetUserId && s.eventType === 'new_post'),
  );
}

export function getSubscriptionLevel(subscriberId: string, targetUserId: string): string | null {
  const sub = getStore().subscriptions.find(
    (s) => s.subscriberId === subscriberId && s.targetUserId === targetUserId && s.eventType === 'new_post',
  );
  return sub?.level ?? null;
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION OPERATIONS
// ═══════════════════════════════════════════════════════════════

function createNotification(params: {
  recipientUserId: string;
  actorUserId: string | null;
  type: NotificationType;
  entityType: Notification['entityType'];
  entityId: string;
  metadata: Notification['metadata'];
}): Notification {
  const store = getStore();
  const notif: Notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...params,
    createdAt: new Date().toISOString(),
    readAt: null,
    seenAt: null,
  };
  store.notifications.unshift(notif);
  return notif;
}

export function getNotifications(
  recipientUserId: string,
  options?: { limit?: number; offset?: number; unreadOnly?: boolean },
): { notifications: Notification[]; total: number; unreadCount: number } {
  const store = getStore();
  let all = store.notifications.filter((n) => n.recipientUserId === recipientUserId);

  const unreadCount = all.filter((n) => !n.readAt).length;
  const total = all.length;

  if (options?.unreadOnly) {
    all = all.filter((n) => !n.readAt);
  }

  // Sort by createdAt desc (newest first)
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 50;
  const paginated = all.slice(offset, offset + limit);

  return { notifications: paginated, total, unreadCount };
}

export function getUnreadCount(recipientUserId: string): number {
  return getStore().notifications.filter(
    (n) => n.recipientUserId === recipientUserId && !n.readAt,
  ).length;
}

export function markNotificationRead(notificationId: string): boolean {
  const notif = getStore().notifications.find((n) => n.id === notificationId);
  if (notif && !notif.readAt) {
    notif.readAt = new Date().toISOString();
    return true;
  }
  return false;
}

export function markAllRead(
  recipientUserId: string,
  upTo?: string, // ISO timestamp — mark all created before this
): { markedCount: number; unreadCountRemaining: number; serverTime: string } {
  const store = getStore();
  const serverTime = new Date().toISOString();
  const cutoff = upTo ? new Date(upTo).getTime() : Infinity;
  let markedCount = 0;

  for (const n of store.notifications) {
    if (
      n.recipientUserId === recipientUserId &&
      !n.readAt &&
      new Date(n.createdAt).getTime() <= cutoff
    ) {
      n.readAt = serverTime;
      markedCount++;
    }
  }

  const unreadCountRemaining = store.notifications.filter(
    (n) => n.recipientUserId === recipientUserId && !n.readAt,
  ).length;

  return { markedCount, unreadCountRemaining, serverTime };
}

export function markSeen(recipientUserId: string): void {
  const now = new Date().toISOString();
  for (const n of getStore().notifications) {
    if (n.recipientUserId === recipientUserId && !n.seenAt) {
      n.seenAt = now;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// DB-BACKED FOLLOW OPERATIONS
// These use the SearchableUserFollow table for real users.
// Fall back to in-memory when DB is unavailable.
// ═══════════════════════════════════════════════════════════════

import { isDbAvailable, prisma } from './db';

export async function dbFollow(followerId: string, followingId: string): Promise<void> {
  // Update in-memory cache
  const store = getStore();
  if (!store.follows.some((f) => f.followerId === followerId && f.followingId === followingId)) {
    store.follows.push({ followerId, followingId, createdAt: new Date().toISOString() });
  }
  if (!isDbAvailable()) return;
  try {
    await prisma.$executeRaw`
      INSERT INTO "SearchableUserFollow" ("followerId", "followingId")
      VALUES (${followerId}, ${followingId})
      ON CONFLICT ("followerId", "followingId") DO NOTHING
    `;
  } catch { /* in-memory updated above */ }
}

export async function dbUnfollow(followerId: string, followingId: string): Promise<void> {
  // Update in-memory cache
  const store = getStore();
  store.follows = store.follows.filter(
    (f) => !(f.followerId === followerId && f.followingId === followingId),
  );
  unsubscribeFromPosts(followerId, followingId);
  if (!isDbAvailable()) return;
  try {
    await prisma.$executeRaw`
      DELETE FROM "SearchableUserFollow"
      WHERE "followerId" = ${followerId} AND "followingId" = ${followingId}
    `;
  } catch { /* silently fail */ }
}

export async function dbIsFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (!isDbAvailable()) return isFollowing(followerId, followingId);
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "SearchableUserFollow"
      WHERE "followerId" = ${followerId} AND "followingId" = ${followingId}
    `;
    return Number(rows[0]?.count ?? 0) > 0;
  } catch {
    return isFollowing(followerId, followingId);
  }
}

export async function dbGetFollowerCount(userId: string): Promise<number> {
  if (!isDbAvailable()) return getFollowerCount(userId);
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "SearchableUserFollow"
      WHERE "followingId" = ${userId}
    `;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return getFollowerCount(userId);
  }
}

export async function dbGetFollowingCount(userId: string): Promise<number> {
  if (!isDbAvailable()) return getFollowingCount(userId);
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM "SearchableUserFollow"
      WHERE "followerId" = ${userId}
    `;
    return Number(rows[0]?.count ?? 0);
  } catch {
    return getFollowingCount(userId);
  }
}

export async function dbGetFollowingIds(userId: string): Promise<string[]> {
  if (!isDbAvailable()) return getFollowingIds(userId);
  try {
    const rows = await prisma.$queryRaw<{ followingId: string }[]>`
      SELECT "followingId" FROM "SearchableUserFollow"
      WHERE "followerId" = ${userId}
    `;
    // Merge with in-memory mock follows for demo users
    const dbIds = rows.map((r) => r.followingId);
    const memIds = getFollowingIds(userId);
    return [...new Set([...dbIds, ...memIds])];
  } catch {
    return getFollowingIds(userId);
  }
}
