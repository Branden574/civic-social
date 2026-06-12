// ═══════════════════════════════════════════════════════════════
// Tests: Notification API perf fixes
//   A) GET /api/notifications — batched actor lookup (no N+1)
//   B) SSE stream — idle timeout + heartbeat/registry cleanup
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ─────────────────────────────────────────────────────

const TEST_USER = {
  id: 'user-test-recipient',
  email: 'recipient@example.com',
  role: 'user' as const,
  displayName: 'Test Recipient',
};

vi.mock('@/lib/security/api-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security/api-guard')>();
  return {
    ...actual,
    getSessionUser: vi.fn(() => TEST_USER),
  };
});

vi.mock('@/lib/user-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/user-registry')>();
  return {
    ...actual,
    getUserById: vi.fn(actual.getUserById),
    getUsersByIds: vi.fn(actual.getUsersByIds),
  };
});

import { GET } from '@/app/api/notifications/route';
import { GET as streamGET, pushSSEEvent } from '@/app/api/notifications/stream/route';
import { getUserById, getUsersByIds, registerUser } from '@/lib/user-registry';
import { createNotification } from '@/lib/social-store';

// ─── Store resets (same global-symbol approach as social tests) ─

const SOCIAL_STORE_KEY = Symbol.for('civic.social.store');
const REGISTRY_KEY = Symbol.for('civic.user.registry');
const SSE_KEY = Symbol.for('civic.sse.connections');

interface SSEStoreShape {
  connections: Map<string, Set<ReadableStreamDefaultController>>;
}

function resetStores() {
  (global as Record<symbol, unknown>)[SOCIAL_STORE_KEY] = undefined;
  (global as Record<symbol, unknown>)[REGISTRY_KEY] = undefined;
  (global as Record<symbol, unknown>)[SSE_KEY] = undefined;
}

function getSSEConnections(): SSEStoreShape['connections'] | undefined {
  const store = (global as Record<symbol, unknown>)[SSE_KEY] as SSEStoreShape | undefined;
  return store?.connections;
}

// ═══════════════════════════════════════════════════════════════
// A) GET /api/notifications — batched actor enrichment
// ═══════════════════════════════════════════════════════════════

describe('GET /api/notifications — batched actor lookup', () => {
  beforeEach(() => {
    resetStores();
    vi.mocked(getUserById).mockClear();
    vi.mocked(getUsersByIds).mockClear();
  });

  it('enriches actor names via a single getUsersByIds batch (no per-notification getUserById)', async () => {
    const actor = await registerUser({
      id: 'user-actor-1',
      displayName: 'Actor One',
      username: 'actor-one',
      email: 'actor1@example.com',
    });

    // Several notifications from the same actor → previously N getUserById calls
    const created = ['post-1', 'post-2', 'post-3'].map((entityId) =>
      createNotification({
        recipientUserId: TEST_USER.id,
        actorUserId: actor.id,
        type: 'reply',
        entityType: 'post',
        entityId,
        metadata: { preview: `reply on ${entityId}` },
      }),
    );

    const res = await GET(new NextRequest('http://localhost/api/notifications?limit=50&offset=0'));
    expect(res.status).toBe(200);
    const data = await res.json();

    const createdIds = new Set(created.map((n) => n.id));
    const enriched = (data.notifications as { id: string; metadata: Record<string, unknown> }[])
      .filter((n) => createdIds.has(n.id));
    expect(enriched).toHaveLength(3);
    for (const n of enriched) {
      expect(n.metadata.actorName).toBe('Actor One');
      expect(n.metadata.actorUsername).toBe('actor-one');
    }

    // The N+1 fix: exactly one batched lookup, zero per-row lookups
    expect(getUsersByIds).toHaveBeenCalledTimes(1);
    expect(getUserById).not.toHaveBeenCalled();
  });

  it('leaves notifications without a registered actor unchanged', async () => {
    const notif = createNotification({
      recipientUserId: TEST_USER.id,
      actorUserId: 'user-not-in-registry',
      type: 'like',
      entityType: 'post',
      entityId: 'post-x',
      metadata: { actorName: 'Stored Name' },
    });

    const res = await GET(new NextRequest('http://localhost/api/notifications'));
    const data = await res.json();
    const found = (data.notifications as { id: string; metadata: Record<string, unknown> }[])
      .find((n) => n.id === notif.id);
    expect(found).toBeDefined();
    expect(found!.metadata.actorName).toBe('Stored Name');
  });
});

// ═══════════════════════════════════════════════════════════════
// B) SSE stream — idle timeout + cleanup
// ═══════════════════════════════════════════════════════════════

describe('GET /api/notifications/stream — idle timeout + cleanup', () => {
  beforeEach(() => {
    resetStores();
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers the connection and sends the initial unread count', async () => {
    const res = await streamGET(new NextRequest('http://localhost/api/notifications/stream'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain('event: unread-count');
    expect(getSSEConnections()?.get(TEST_USER.id)?.size).toBe(1);
    reader.cancel();
  });

  it('closes and deregisters an idle connection after ~5 minutes without activity', async () => {
    const res = await streamGET(new NextRequest('http://localhost/api/notifications/stream'));
    const reader = res.body!.getReader();
    await reader.read(); // initial unread-count

    // Just under the idle window: heartbeats keep it alive, still registered
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(getSSEConnections()?.get(TEST_USER.id)?.size).toBe(1);

    // Past 5 minutes without any real event → idle close + deregistration
    await vi.advanceTimersByTimeAsync(2 * 60_000);
    expect(getSSEConnections()?.has(TEST_USER.id)).toBe(false);

    // Drain buffered heartbeats; the stream must terminate
    let done = false;
    for (let i = 0; i < 50 && !done; i++) {
      done = (await reader.read()).done;
    }
    expect(done).toBe(true);
  });

  it('pushSSEEvent counts as activity and keeps the connection alive past the idle window', async () => {
    const res = await streamGET(new NextRequest('http://localhost/api/notifications/stream'));
    const reader = res.body!.getReader();
    await reader.read();

    // Activity at 4 min resets the idle clock
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    pushSSEEvent(TEST_USER.id, 'notification', { id: 'n-1', type: 'like' });

    // 4 more minutes (8 total) — still under 5 min since last activity
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(getSSEConnections()?.get(TEST_USER.id)?.size).toBe(1);
    reader.cancel();
  });

  it('cleans up heartbeat and registry on abort', async () => {
    const abort = new AbortController();
    const res = await streamGET(
      new NextRequest('http://localhost/api/notifications/stream', { signal: abort.signal }),
    );
    const reader = res.body!.getReader();
    await reader.read();
    expect(getSSEConnections()?.get(TEST_USER.id)?.size).toBe(1);

    abort.abort();
    expect(getSSEConnections()?.has(TEST_USER.id)).toBe(false);

    // No further heartbeats should be enqueued after abort
    await vi.advanceTimersByTimeAsync(60_000);
    let done = false;
    for (let i = 0; i < 50 && !done; i++) {
      done = (await reader.read()).done;
    }
    expect(done).toBe(true);
  });
});
