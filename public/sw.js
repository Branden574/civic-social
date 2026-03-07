// ═══════════════════════════════════════════════════════════════
// Civic Social — Service Worker
// ═══════════════════════════════════════════════════════════════
//
// Handles:
//   1. Push notification display (background & foreground)
//   2. Notification click routing
//   3. Badge count updates
//
// This is a minimal service worker focused on notifications.
// It does NOT cache app resources (Next.js handles that).
// ═══════════════════════════════════════════════════════════════

/* eslint-disable no-restricted-globals */

const APP_NAME = 'Civic Social';

// ─── Push event: display notification ────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: APP_NAME, body: event.data.text() };
  }

  const title = payload.title || APP_NAME;
  const options = {
    body: payload.body || 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || `civic-${Date.now()}`,
    renotify: !!payload.tag, // Re-alert if same tag
    data: {
      url: payload.url || '/notifications',
      type: payload.type || 'system',
    },
    actions: payload.actions || [],
    vibrate: [100, 50, 100], // Short vibration pattern
    requireInteraction: false, // Auto-dismiss after a while
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ─── Notification click: navigate to relevant page ───────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: url,
          });
          return;
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});

// ─── Install & activate ──────────────────────────────────────

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Message handler (from main app) ─────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, url, tag, type } = event.data;
    self.registration.showNotification(title || APP_NAME, {
      body: body || 'New notification',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: tag || `civic-${Date.now()}`,
      data: { url: url || '/notifications', type: type || 'system' },
      vibrate: [100, 50, 100],
    });
  }
});
