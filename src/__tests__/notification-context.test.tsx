// ═══════════════════════════════════════════════════════════════
// Tests: NotificationProvider context split + SSE/polling cascade
//   1) unreadCount ticks don't re-render actions-only consumers
//   2) useNotifications() keeps the full back-compat shape
//   3) fallback polling stops once SSE is healthy, resumes on error
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  NotificationProvider,
  useNotifications,
  useNotificationActions,
  useUnreadCount,
} from '@/lib/notification-context';

// ─── Mocks ─────────────────────────────────────────────────────

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { id: 'user-test' } }),
}));

vi.mock('@/lib/notification-sound', () => ({
  playNotificationSound: vi.fn(),
  unlockAudio: vi.fn(),
}));

// Fake EventSource so we can drive SSE health from tests
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onerror: (() => void) | null = null;
  private listeners = new Map<string, ((e: { data: string }) => void)[]>();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: { data: string }) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }

  emit(type: string, data: unknown) {
    for (const cb of this.listeners.get(type) ?? []) {
      cb({ data: JSON.stringify(data) });
    }
  }

  close() {}

  static latest(): FakeEventSource {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1];
  }
}

// ─── Test consumers with render counters ───────────────────────

let actionsRenders = 0;
let countRenders = 0;

function ActionsConsumer() {
  const { activeToast } = useNotificationActions();
  actionsRenders++;
  return <div data-testid="toast">{activeToast?.id ?? 'none'}</div>;
}

function CountConsumer() {
  const { unreadCount } = useUnreadCount();
  countRenders++;
  return <div data-testid="count">{unreadCount}</div>;
}

function FullShapeProbe({ onValue }: { onValue: (v: ReturnType<typeof useNotifications>) => void }) {
  onValue(useNotifications());
  return null;
}

// ─── Setup ─────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  actionsRenders = 0;
  countRenders = 0;
  FakeEventSource.instances = [];
  // fetch returns !ok so fetchUnreadCount exits early (no state churn);
  // we count calls to observe polling behavior.
  fetchMock = vi.fn(async () => ({ ok: false }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ═══════════════════════════════════════════════════════════════

describe('NotificationProvider context split', () => {
  it('unread-count ticks re-render count consumers but not actions consumers', async () => {
    render(
      <NotificationProvider>
        <ActionsConsumer />
        <CountConsumer />
      </NotificationProvider>,
    );

    const actionsRendersAfterMount = actionsRenders;
    const countRendersAfterMount = countRenders;
    expect(screen.getByTestId('count').textContent).toBe('0');

    // SSE delivers a new unread count → only the count context should fan out
    await act(async () => {
      FakeEventSource.latest().emit('unread-count', { unreadCount: 7 });
    });

    expect(screen.getByTestId('count').textContent).toBe('7');
    expect(countRenders).toBeGreaterThan(countRendersAfterMount);
    expect(actionsRenders).toBe(actionsRendersAfterMount);
  });

  it('useNotifications() keeps the back-compat shape (count + actions)', async () => {
    let value: ReturnType<typeof useNotifications> | undefined;
    render(
      <NotificationProvider>
        <FullShapeProbe onValue={(v) => { value = v; }} />
      </NotificationProvider>,
    );

    expect(value).toBeDefined();
    expect(value!.unreadCount).toBe(0);
    expect(typeof value!.setUnreadCount).toBe('function');
    expect(typeof value!.markAllRead).toBe('function');
    expect(typeof value!.refresh).toBe('function');
    expect(typeof value!.dismissToast).toBe('function');
    expect(typeof value!.setSoundEnabled).toBe('function');
    expect(value!.activeToast).toBeNull();
    expect(value!.soundEnabled).toBe(true);

    // Old API still reflects live count updates
    await act(async () => {
      FakeEventSource.latest().emit('unread-count', { unreadCount: 4 });
    });
    expect(value!.unreadCount).toBe(4);
  });
});

describe('NotificationProvider fallback polling', () => {
  it('stops fallback polling once SSE is healthy and resumes it on SSE error', async () => {
    render(
      <NotificationProvider>
        <CountConsumer />
      </NotificationProvider>,
    );
    await act(async () => {});

    // Initial fetch on mount
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // SSE reports healthy → fallback polling must be fully stopped
    await act(async () => {
      FakeEventSource.latest().emit('unread-count', { unreadCount: 1 });
    });

    // Well past the 60s (+ jitter) poll interval — no poll requests
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 70_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // SSE drops → polling resumes as fallback
    await act(async () => {
      FakeEventSource.latest().onerror?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(70_000);
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);

    // SSE recovers → polling stops again
    const callsAfterRecoveryBase = fetchMock.mock.calls.length;
    await act(async () => {
      FakeEventSource.latest().emit('unread-count', { unreadCount: 2 });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 70_000);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterRecoveryBase);
  });
});
