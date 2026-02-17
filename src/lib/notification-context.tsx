'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// Notification Context — Single Source of Truth for Badge Count
// ═══════════════════════════════════════════════════════════════
//
// Polls /api/notifications?action=unread-count every 30s
// Provides markAllRead that immediately clears badge then syncs
// ═══════════════════════════════════════════════════════════════

interface NotificationContextValue {
  unreadCount: number;
  setUnreadCount: (n: number | ((prev: number) => number)) => void;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  setUnreadCount: () => {},
  markAllRead: async () => {},
  refresh: async () => {},
});

const POLL_INTERVAL = 30_000; // 30 seconds

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?action=unread-count');
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Offline or error — keep last known count
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchUnreadCount]);

  const markAllRead = useCallback(async () => {
    // Optimistic: clear badge immediately
    setUnreadCount(0);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark-all-read' }),
      });
      if (res.ok) {
        const data = await res.json();
        // Reconcile with server (handles race condition: new notif during mark)
        setUnreadCount(data.unreadCountRemaining ?? 0);
      } else {
        // Rollback — refetch true count
        await fetchUnreadCount();
      }
    } catch {
      // Rollback on network failure
      await fetchUnreadCount();
    }
  }, [fetchUnreadCount]);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, setUnreadCount, markAllRead, refresh: fetchUnreadCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
