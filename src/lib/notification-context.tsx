'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { playNotificationSound, unlockAudio } from '@/lib/notification-sound';

// ═══════════════════════════════════════════════════════════════
// Notification Context — Badge Count + Sound + In-App Toasts
// ═══════════════════════════════════════════════════════════════
//
// Polls /api/notifications?action=unread-count every 30s.
// When unread count increases, plays a notification sound and
// shows an in-app toast banner with the latest notification.
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

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  setUnreadCount: () => {},
  markAllRead: async () => {},
  refresh: async () => {},
  activeToast: null,
  dismissToast: () => {},
  soundEnabled: true,
  setSoundEnabled: () => {},
});

const POLL_INTERVAL = 30_000; // 30 seconds
const SOUND_PREF_KEY = 'civic-notif-sound';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeToast, setActiveToast] = useState<NotificationToastData | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const prevCountRef = useRef(0);
  const initialFetchDone = useRef(false);

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
      const res = await fetch('/api/notifications?action=unread-count');
      if (!res.ok) return;
      const data = await res.json();
      const newCount = data.unreadCount ?? 0;

      setUnreadCount(newCount);

      // Play sound + show toast if count increased (not on initial load)
      if (initialFetchDone.current && newCount > prevCountRef.current) {
        if (soundEnabled) {
          playNotificationSound();
        }
        // Fetch the latest notification for the toast
        try {
          const listRes = await fetch('/api/notifications?limit=1&offset=0&unreadOnly=true');
          if (listRes.ok) {
            const listData = await listRes.json();
            const latest = listData.notifications?.[0];
            if (latest) {
              setActiveToast({
                id: latest.id,
                type: latest.type,
                actorName: latest.metadata?.actorName,
                preview: latest.metadata?.preview,
                entityId: latest.entityId,
                entityType: latest.entityType,
              });

              // Also show a system notification if permission granted and app is not focused
              if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && Notification.permission === 'granted') {
                showSystemNotification(latest);
              }
            }
          }
        } catch {
          // Non-critical
        }
      }

      prevCountRef.current = newCount;
      initialFetchDone.current = true;
    } catch {
      // Offline or error — keep last known count
    }
  }, [soundEnabled]);

  // Only fetch + poll when authenticated. Reset to 0 on logout.
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (isLoading) return;

    if (!isAuthenticated) {
      setUnreadCount(0);
      prevCountRef.current = 0;
      initialFetchDone.current = false;
      return;
    }

    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAuthenticated, isLoading, fetchUnreadCount]);

  const markAllRead = useCallback(async () => {
    setUnreadCount(0);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCountRemaining ?? 0);
        prevCountRef.current = data.unreadCountRemaining ?? 0;
      } else {
        await fetchUnreadCount();
      }
    } catch {
      await fetchUnreadCount();
    }
  }, [fetchUnreadCount]);

  const dismissToast = useCallback(() => setActiveToast(null), []);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        setUnreadCount,
        markAllRead,
        refresh: fetchUnreadCount,
        activeToast,
        dismissToast,
        soundEnabled,
        setSoundEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
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
