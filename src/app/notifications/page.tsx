'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, MobileNav } from '@/components/layout/sidebar';
import { useNotifications } from '@/lib/notification-context';
import {
  getLocalReadIds,
  getLocalDismissedIds,
  markLocalRead,
  markAllLocalRead,
  markLocalDismissed,
} from '@/lib/notification-local-state';
import {
  Bell,
  BellRing,
  MessageSquare,
  ThumbsUp,
  UserPlus,
  Shield,
  Scale,
  Repeat2,
  AtSign,
  Newspaper,
  CheckCheck,
  RefreshCw,
  Loader2,
  WifiOff,
  ChevronDown,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import type { Notification, NotificationType } from '@/lib/social-store';
import { AuthGate } from '@/components/auth/auth-gate';

// ─── Notification type config ─────────────────────────────────

const NOTIF_CONFIG: Record<NotificationType, {
  icon: typeof Bell;
  color: string;
  label: string;
}> = {
  follow: { icon: UserPlus, color: 'text-info-light bg-info/10', label: 'followed you' },
  like: { icon: ThumbsUp, color: 'text-positive-light bg-positive/10', label: 'liked your post' },
  reply: { icon: MessageSquare, color: 'text-civic-light bg-civic/10', label: 'replied to your post' },
  repost: { icon: Repeat2, color: 'text-info-light bg-info/10', label: 'reposted your post' },
  mention: { icon: AtSign, color: 'text-warning-light bg-warning/10', label: 'mentioned you' },
  post_from_followed: { icon: Newspaper, color: 'text-civic-light bg-civic/10', label: 'published a new post' },
  debate_invite: { icon: Scale, color: 'text-warning-light bg-warning/10', label: 'invited you to a debate' },
  civility_boost: { icon: Shield, color: 'text-positive-light bg-positive/10', label: 'Civic milestone' },
  system: { icon: Bell, color: 'text-text-muted bg-surface-active', label: 'System update' },
};

// ─── Helpers ──────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDayLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const notifDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - notifDay.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function groupByDay(notifs: Notification[]): { label: string; items: Notification[] }[] {
  const groups: Map<string, Notification[]> = new Map();
  for (const n of notifs) {
    const key = getDayLabel(n.createdAt);
    const group = groups.get(key) || [];
    group.push(n);
    groups.set(key, group);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function getNotifRoute(n: Notification): string | null {
  switch (n.type) {
    case 'follow':
      return n.metadata.actorUsername ? `/profile/${n.metadata.actorUsername}` : null;
    case 'like':
    case 'reply':
    case 'repost':
    case 'mention':
    case 'post_from_followed':
      return n.entityId ? `/post/${n.entityId}` : null;
    case 'debate_invite':
      return n.entityId ? `/debates/${n.entityId}` : null;
    default:
      return null;
  }
}

// ─── Filter Tabs ──────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'mentions' | 'follows';
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'follows', label: 'Follows' },
];

// ─── Page ─────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const { unreadCount, markAllRead, setUnreadCount } = useNotifications();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);

  const PAGE_SIZE = 50;

  // ── Fetch notifications with client-side state merge ────
  const fetchNotifications = useCallback(async (reset = true) => {
    try {
      setOffline(false);
      const newOffset = reset ? 0 : offsetRef.current;
      const res = await fetch(`/api/notifications?limit=${PAGE_SIZE}&offset=${newOffset}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const fetched = data.notifications as Notification[];

      // Get client-side read/dismissed state
      const localReadIds = getLocalReadIds();
      const localDismissedIds = getLocalDismissedIds();

      // Filter out dismissed notifications, apply local read state
      const merged = fetched
        .filter((n) => !localDismissedIds.has(n.id))
        .map((n) => {
          if (!n.readAt && localReadIds.has(n.id)) {
            return { ...n, readAt: new Date().toISOString() };
          }
          return n;
        });

      if (reset) {
        setNotifications(merged);
        offsetRef.current = fetched.length;
      } else {
        setNotifications((prev) => {
          // Deduplicate by ID
          const existingIds = new Set(prev.map((n) => n.id));
          const newOnly = merged.filter((n) => !existingIds.has(n.id));
          return [...prev, ...newOnly];
        });
        offsetRef.current += fetched.length;
      }
      setHasMore(fetched.length === PAGE_SIZE);

      // Compute accurate unread count from merged data
      const localUnreadCount = merged.filter((n) => !n.readAt).length;
      setUnreadCount(localUnreadCount);
    } catch {
      setOffline(true);
    }
  }, [setUnreadCount]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchNotifications(true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mark all read ───────────────────────────────────────
  const handleMarkAllRead = useCallback(async () => {
    if (markingRead) return;
    setMarkingRead(true);

    // Optimistic: mark all loaded as read in UI immediately
    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((n) => (n.readAt ? n : { ...n, readAt: now })),
    );

    // Persist to localStorage so cold-start refetch respects this
    const allIds = notifications.map((n) => n.id);
    markAllLocalRead(allIds);

    try {
      await markAllRead();
    } catch {
      // Server failed but client state is saved locally — that's fine
    } finally {
      setMarkingRead(false);
    }
  }, [markingRead, markAllRead, notifications]);

  // ── Mark single notification read ───────────────────────
  const handleNotificationClick = useCallback(async (n: Notification) => {
    // Mark as read optimistically
    if (!n.readAt) {
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === n.id ? { ...notif, readAt: new Date().toISOString() } : notif,
        ),
      );
      setUnreadCount((c: number) => Math.max(0, c - 1));

      // Persist read state locally
      markLocalRead(n.id);

      // Fire and forget to server
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-read', notification_id: n.id }),
      }).catch(() => {});
    }

    // Route to destination
    const route = getNotifRoute(n);
    if (route) router.push(route);
  }, [router, setUnreadCount]);

  // ── Dismiss single notification ─────────────────────────
  const handleDismiss = useCallback((e: React.MouseEvent, n: Notification) => {
    e.stopPropagation();

    // Remove from UI immediately
    setNotifications((prev) => prev.filter((notif) => notif.id !== n.id));
    if (!n.readAt) {
      setUnreadCount((c: number) => Math.max(0, c - 1));
    }

    // Persist to localStorage
    markLocalDismissed(n.id);

    // Fire and forget to server
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', notification_id: n.id }),
    }).catch(() => {});
  }, [setUnreadCount]);

  // ── Refresh ─────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(true);
    setRefreshing(false);
  }, [fetchNotifications]);

  // ── Load more ───────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    await fetchNotifications(false);
    setLoadingMore(false);
  }, [fetchNotifications]);

  // ── Filter ──────────────────────────────────────────────
  const filtered = notifications.filter((n) => {
    switch (activeFilter) {
      case 'unread': return !n.readAt;
      case 'mentions': return n.type === 'mention';
      case 'follows': return n.type === 'follow';
      default: return true;
    }
  });

  const grouped = groupByDay(filtered);

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 min-w-0 border-r border-border-subtle">
        <div className="max-w-2xl mx-auto" ref={scrollRef}>
          {/* Header */}
          <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-xl border-b border-border-subtle">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text-primary">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-danger/20 text-danger-light">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Refresh button */}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-all"
                  aria-label="Refresh notifications"
                >
                  <RefreshCw className={clsx('w-4 h-4', refreshing && 'animate-spin')} />
                </button>

                {/* Mark all read */}
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingRead || unreadCount === 0}
                  className={clsx(
                    'flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all',
                    unreadCount > 0
                      ? 'text-civic-light hover:bg-civic/10'
                      : 'text-text-muted cursor-not-allowed',
                  )}
                >
                  {markingRead ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3.5 h-3.5" />
                  )}
                  Mark all as read
                </button>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex px-4 sm:px-6 gap-1 pb-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={clsx(
                    'text-xs font-medium px-3 py-1.5 rounded-full transition-all',
                    activeFilter === tab.key
                      ? 'bg-civic/15 text-civic-light'
                      : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover',
                  )}
                >
                  {tab.label}
                  {tab.key === 'unread' && unreadCount > 0 && (
                    <span className="ml-1 text-[9px] bg-danger/20 text-danger-light px-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </header>

          {/* Offline banner */}
          {offline && (
            <div className="flex items-center gap-2 px-4 sm:px-6 py-3 bg-warning/5 border-b border-warning/20 text-warning-light text-xs">
              <WifiOff className="w-3.5 h-3.5" />
              <span>You&apos;re offline. Reconnect to sync notifications.</span>
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-civic animate-spin" />
                <p className="text-xs text-text-muted">Loading notifications...</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-border-subtle flex items-center justify-center mb-4">
                <BellRing className="w-7 h-7 text-text-muted" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">
                {activeFilter === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </h3>
              <p className="text-xs text-text-muted text-center max-w-xs">
                {activeFilter === 'unread'
                  ? 'You have no unread notifications. Check back later for new activity.'
                  : 'When people interact with your posts or follow you, you\'ll see it here.'}
              </p>
            </div>
          ) : (
            /* Notification list grouped by day */
            <div>
              {grouped.map((group, gi) => (
                <div key={group.label}>
                  {/* Day header */}
                  <div className="sticky top-[105px] z-30 px-4 sm:px-6 py-2 bg-bg/90 backdrop-blur-sm border-b border-border-subtle/50">
                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      {group.label}
                    </p>
                  </div>

                  {group.items.map((n, i) => {
                    const config = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.system;
                    const Icon = config.icon;
                    const isUnread = !n.readAt;
                    const actionLabel = n.type === 'civility_boost'
                      ? (n.metadata.preview || config.label)
                      : config.label;

                    return (
                      <div
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleNotificationClick(n)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleNotificationClick(n); }}
                        className={clsx(
                          'w-full flex items-start gap-3 px-4 sm:px-6 py-3.5 border-b border-border-subtle/50 hover:bg-surface/40 transition-colors duration-150 text-left animate-fade-in opacity-0 cursor-pointer group',
                          isUnread && 'bg-civic/[0.03]',
                        )}
                        style={{ animationDelay: `${(gi * 10 + i) * 30}ms`, animationFillMode: 'forwards' }}
                      >
                        {/* Icon */}
                        <div className={clsx('w-9 h-9 rounded-full flex items-center justify-center shrink-0', config.color)}>
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary leading-snug">
                            {n.metadata.actorName && (
                              <span className="font-semibold">{n.metadata.actorName}</span>
                            )}{' '}
                            <span className="text-text-secondary">{actionLabel}</span>
                          </p>
                          {n.metadata.preview && n.type !== 'civility_boost' && (
                            <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                              {n.metadata.preview}
                            </p>
                          )}
                          <p className="text-[11px] text-text-muted mt-1">{formatRelativeTime(n.createdAt)}</p>
                        </div>

                        {/* Unread dot + dismiss button */}
                        <div className="flex items-center gap-1.5 shrink-0 mt-1">
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-civic animate-scale-in" />
                          )}
                          <button
                            onClick={(e) => handleDismiss(e, n)}
                            className="p-1 rounded-md text-text-muted/0 group-hover:text-text-muted hover:!text-text-primary hover:bg-surface-active transition-all"
                            aria-label="Dismiss notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center py-6">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-1.5 text-xs font-medium text-civic-light hover:text-civic px-4 py-2 rounded-lg hover:bg-civic/10 transition-all"
                  >
                    {loadingMore ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    Load more
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="h-24 lg:h-8" />
        </div>
      </main>
      <MobileNav />
    </div>
    </AuthGate>
  );
}
