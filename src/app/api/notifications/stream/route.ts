// ═══════════════════════════════════════════════════════════════
// SSE Notification Stream
// GET /api/notifications/stream
// Sends real-time notification updates via Server-Sent Events.
// Falls back gracefully — client uses polling as backup.
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/security/api-guard';
import { dbGetUnreadCount } from '@/lib/social-store';

// In-memory registry of active SSE connections per user
const SSE_KEY = Symbol.for('civic.sse.connections');

interface SSEStore {
  connections: Map<string, Set<ReadableStreamDefaultController>>;
}

function getSSEStore(): SSEStore {
  const g = global as unknown as Record<symbol, SSEStore | undefined>;
  if (!g[SSE_KEY]) {
    g[SSE_KEY] = { connections: new Map() };
  }
  return g[SSE_KEY]!;
}

/** Push an SSE event to all connections for a given user */
export function pushSSEEvent(userId: string, event: string, data: unknown) {
  const store = getSSEStore();
  const controllers = store.connections.get(userId);
  if (!controllers || controllers.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(payload);

  for (const controller of controllers) {
    try {
      controller.enqueue(bytes);
    } catch {
      controllers.delete(controller);
    }
  }
}

export async function GET(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userId = user.id;
  const store = getSSEStore();

  const stream = new ReadableStream({
    start(controller) {
      // Register this connection
      if (!store.connections.has(userId)) {
        store.connections.set(userId, new Set());
      }
      store.connections.get(userId)!.add(controller);

      // Send initial unread count
      dbGetUnreadCount(userId).then((count) => {
        try {
          const msg = `event: unread-count\ndata: ${JSON.stringify({ unreadCount: count })}\n\n`;
          controller.enqueue(new TextEncoder().encode(msg));
        } catch { /* connection closed */ }
      });

      // Heartbeat every 25s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Cleanup when the connection closes
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        store.connections.get(userId)?.delete(controller);
        if (store.connections.get(userId)?.size === 0) {
          store.connections.delete(userId);
        }
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
