'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { playNotificationSound, unlockAudio } from '@/lib/notification-sound';
import { getLocalReadIds, getLocalDismissedIds, markAllLocalRead } from '@/lib/notification-local-state';

// ═══════════════════════════════════════════════════════════════
// Notification Context — Badge Count + Sound + In-App Toasts
// ═══════════════════════════════════════════════════════════════
//
// SSE is the primary transport; falls back to polling
// /api/notifications every 60s (jittered) only while SSE is down.
// Adjusts server-reported unread count by subtracting locally
// read/dismissed IDs (handles serverless cold-start resets).
// When real new notifications arrive, plays sound and shows toast.
// ═══════════════════════════════════════════════════════════════

interface NotificationToastData {
  id: string;
  type: string;
  actorName?: string;
  preview?: string;
  entityId?: string;
  entityType?: string;
}

interface NotificationContextValue {
  unreadCount: number;
  setUnreadCount: (n: number | ((prev: number) => number)) => void;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
  // In-app toast
  activeToast: NotificationToastData | null;
  dismissToast: () => void;
  // Sound preference
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

// Frequently-changing value lives in its own context so consumers of
// actions/toast/sound don't re-render on every unread-count tick.
interface UnreadCountContextValue {
  unreadCount: number;
  setUnreadCount: (n: number | ((prev: number) => number)) => void;
}

type NotificationActionsValue = Omit<NotificationContextValue, 'unreadCount' | 'setUnreadCount'>;

const UnreadCountContext = createContext<UnreadCountContextValue>({
  unreadCount: 0,
  setUnreadCount: () => {},
});

const NotificationContext = createContext<NotificationActionsValue>({
  markAllRead: async () => {},
  refresh: async () => {},
  activeToast: null,
  dismissToast: () => {},
  soundEnabled: true,
  setSoundEnabled: () => {},
});

const POLL_INTERVAL = 60_000; // 60s fallback (SSE is primary)
const POLL_JITTER_MS = 5_000; // 0-5s random offset so clients don't poll in lockstep
const SOUND_PREF_KEY = 'civic-notif-sound';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeToast, setActiveToast] = useState<NotificationToastData | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const prevCountRef = useRef(0);
  const initialFetchDone = useRef(false);
  // Track known notification IDs to detect genuinely new ones
  const knownIdsRef = useRef<Set<string>>(new Set());

  // Load sound preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SOUND_PREF_KEY);
      if (saved === 'false') setSoundEnabledState(false);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    try {
      localStorage.setItem(SOUND_PREF_KEY, String(enabled));
    } catch {
      // ignore
    }
  }, []);

  // Unlock audio on first user interaction (required for iOS/Android)
  useEffect(() => {
    const handler = () => {
      unlockAudio();
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
    document.addEventListener('click', handler, { once: true });
    document.addEventListener('touchstart', handler, { once: true });
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed (non-critical)
    });

    // Listen for notification click messages from SW
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.url) {
        window.location.href = event.data.url;
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      // Fetch the latest unread notifications (small batch) to compute accurate count
      const res = await fetch('/api/notifications?limit=50&offset=0&unreadOnly=true');
      if (!res.ok) return;
      const data = await res.json();
      const serverNotifs = (data.notifications ?? []) as { id: string; type: string; metadata?: Record<string, unknown>; entityId?: string; entityType?: string }[];

      // Filter out notifications the client has already read or dismissed
      const localReadIds = getLocalReadIds();
      const localDismissedIds = getLocalDismissedIds();
      const actuallyUnread = serverNotifs.filter(
        (n) => !localReadIds.has(n.id) && !localDismissedIds.has(n.id),
      );

      const newCount = actuallyUnread.length;
      setUnreadCount(newCount);

      // Detect genuinely new notifications (not on initial load, not already known)
      if (initialFetchDone.current) {
        const newNotifs = actuallyUnread.filter((n) => !knownIdsRef.current.has(n.id));
        if (newNotifs.length > 0 && newCount > prevCountRef.current) {
          if (soundEnabled) {
            playNotificationSound();
          }
          // Show toast for the newest one
          const latest = newNotifs[0];
          if (latest) {
            setActiveToast({
              id: latest.id,
              type: latest.type,
              actorName: (latest.metadata?.actorName as string) || undefined,
              preview: (latest.metadata?.preview as string) || undefined,
              entityId: latest.entityId,
              entityType: latest.entityType,
            });

            if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && Notification.permission === 'granted') {
              showSystemNotification(latest as Parameters<typeof showSystemNotification>[0]);
            }
          }
        }
      }

      // Update known IDs
      for (const n of serverNotifs) knownIdsRef.current.add(n.id);
      prevCountRef.current = newCount;
      initialFetchDone.current = true;
    } catch {
      // Offline or error — keep last known count
    }
  }, [soundEnabled]);

  // Handle incoming SSE notification event
  const handleSSENotification = useCallback((data: { id: string; type: string; metadata?: Record<string, unknown>; entityId?: string; entityType?: string }) => {
    if (knownIdsRef.current.has(data.id)) return;
    knownIdsRef.current.add(data.id);

    setUnreadCount((prev) => prev + 1);

    if (soundEnabled) {
      playNotificationSound();
    }

    setActiveToast({
      id: data.id,
      type: data.type,
      actorName: (data.metadata?.actorName as string) || undefined,
      preview: (data.metadata?.preview as string) || undefined,
      entityId: data.entityId,
      entityType: data.entityType,
    });

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && Notification.permission === 'granted') {
      showSystemNotification(data as Parameters<typeof showSystemNotification>[0]);
    }
  }, [soundEnabled]);

  // Connect SSE + fallback polling when authenticated
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    if (isLoading) return;

    if (!isAuthenticated) {
      setUnreadCount(0);
      prevCountRef.current = 0;
      initialFetchDone.current = false;
      knownIdsRef.current.clear();
      return;
    }

    // Initial fetch
    fetchUnreadCount();

    // Fallback polling control — jittered so clients don't poll in lockstep
    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL + Math.random() * POLL_JITTER_MS);
    };
    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    // Try SSE connection
    try {
      const es = new EventSource('/api/notifications/stream');
      sseRef.current = es;

      es.addEventListener('unread-count', (e) => {
        try {
          const data = JSON.parse(e.data);
          setUnreadCount(data.unreadCount ?? 0);
          // SSE is healthy — fully stop the fallback polling
          stopPolling();
        } catch { /* ignore */ }
      });

      es.addEventListener('notification', (e) => {
        try {
          handleSSENotification(JSON.parse(e.data));
        } catch { /* ignore */ }
      });

      es.onerror = () => {
        // SSE failed — ensure polling is active as fallback.
        // EventSource auto-reconnects; on recovery the unread-count
        // event fires again and stops polling.
        startPolling();
      };
    } catch {
      // SSE not supported
    }

    // Fallback polling until SSE confirms it is healthy (slower interval since SSE is primary)
    startPolling();

    return () => {
      stopPolling();
      if (sseRef.current) sseRef.current.close();
    };
  }, [isAuthenticated, isLoading, fetchUnreadCount, handleSSENotification]);

  const markAllRead = useCallback(async () => {
    // Save all known IDs as read locally so cold-start refetch doesn't resurface them
    markAllLocalRead(Array.from(knownIdsRef.current));
    setUnreadCount(0);
    prevCountRef.current = 0;

    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
    } catch {
      // Server call failed but client state is correct
    }
  }, []);

  const dismissToast = useCallback(() => setActiveToast(null), []);

  // Memoized separately: count value changes frequently, actions value rarely
  const countValue = useMemo<UnreadCountContextValue>(
    () => ({ unreadCount, setUnreadCount }),
    [unreadCount],
  );

  const actionsValue = useMemo<NotificationActionsValue>(
    () => ({
      markAllRead,
      refresh: fetchUnreadCount,
      activeToast,
      dismissToast,
      soundEnabled,
      setSoundEnabled,
    }),
    [markAllRead, fetchUnreadCount, activeToast, dismissToast, soundEnabled, setSoundEnabled],
  );

  return (
    <UnreadCountContext.Provider value={countValue}>
      <NotificationContext.Provider value={actionsValue}>
        {children}
      </NotificationContext.Provider>
    </UnreadCountContext.Provider>
  );
}

/**
 * Subscribe only to the unread badge count. Prefer this in components
 * that just render the count (e.g. sidebar badge) — it avoids re-renders
 * from toast/sound/action changes and keeps count ticks isolated.
 */
export function useUnreadCount(): UnreadCountContextValue {
  return useContext(UnreadCountContext);
}

/**
 * Subscribe only to actions/toast/sound — does NOT re-render on
 * unread-count ticks. Prefer this for consumers that don't show the badge
 * (e.g. toast host in app-shell, sound toggle in settings).
 */
export function useNotificationActions(): NotificationActionsValue {
  return useContext(NotificationContext);
}

/**
 * Full notification API (back-compat). Note: subscribes to both contexts,
 * so consumers re-render on count ticks — use useUnreadCount() for the
 * badge, or useNotificationActions() for everything else, once consumers migrate.
 */
export function useNotifications(): NotificationContextValue {
  const actions = useContext(NotificationContext);
  const { unreadCount, setUnreadCount } = useContext(UnreadCountContext);
  return useMemo(
    () => ({ ...actions, unreadCount, setUnreadCount }),
    [actions, unreadCount, setUnreadCount],
  );
}

// ─── System notification helper ──────────────────────────────

function showSystemNotification(notif: {
  type: string;
  metadata?: { actorName?: string; preview?: string; debateTitle?: string };
  entityId?: string;
  entityType?: string;
}) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const typeLabels: Record<string, string> = {
    follow: 'started following you',
    like: 'reacted to your post',
    reply: 'replied to your post',
    mention: 'mentioned you',
    debate_invite: 'invited you to a debate',
    post_from_followed: 'published a new post',
    post_removed: 'removed your post',
    system: '',
  };

  const actorName = notif.metadata?.actorName || 'Someone';
  const label = typeLabels[notif.type] || 'sent you a notification';
  const body = notif.metadata?.preview || `${actorName} ${label}`;

  let url = '/notifications';
  if (notif.entityType === 'debate' && notif.entityId) {
    url = `/debates/${notif.entityId}`;
  } else if (notif.entityType === 'user' && notif.entityId) {
    url = `/profile/${notif.entityId}`;
  } else if (notif.entityId) {
    url = `/post/${notif.entityId}`;
  }

  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({
      type: 'SHOW_NOTIFICATION',
      title: `${actorName} ${label}`,
      body,
      url,
      tag: `civic-${notif.type}-${notif.entityId || Date.now()}`,
    });
  }).catch(() => {
    // Fallback: use Notification API directly (no SW needed)
    try {
      new Notification(`${actorName} ${label}`, {
        body,
        icon: '/icons/icon-192.png',
        tag: `civic-${notif.type}`,
      });
    } catch {
      // Notifications not supported
    }
  });
}
