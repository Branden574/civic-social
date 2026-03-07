// ═══════════════════════════════════════════════════════════════
// Client-side notification state persistence
// ═══════════════════════════════════════════════════════════════
//
// Since the notification backend is in-memory (resets on serverless
// cold starts), we track read and dismissed notification IDs in
// localStorage so the client is the source of truth for state
// that the user has already acted on.
// ═══════════════════════════════════════════════════════════════

const READ_KEY = 'civic-notif-read-ids';
const DISMISSED_KEY = 'civic-notif-dismissed-ids';
const MAX_ENTRIES = 200; // Prevent unbounded growth

function getSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSet(key: string, set: Set<string>): void {
  try {
    // Keep only the most recent entries to prevent unbounded storage growth
    const arr = Array.from(set);
    const trimmed = arr.length > MAX_ENTRIES ? arr.slice(-MAX_ENTRIES) : arr;
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable
  }
}

// ─── Read state ──────────────────────────────────────────────

export function getLocalReadIds(): Set<string> {
  return getSet(READ_KEY);
}

export function markLocalRead(id: string): void {
  const set = getSet(READ_KEY);
  set.add(id);
  saveSet(READ_KEY, set);
}

export function markAllLocalRead(ids: string[]): void {
  const set = getSet(READ_KEY);
  for (const id of ids) set.add(id);
  saveSet(READ_KEY, set);
}

// ─── Dismissed state ─────────────────────────────────────────

export function getLocalDismissedIds(): Set<string> {
  return getSet(DISMISSED_KEY);
}

export function markLocalDismissed(id: string): void {
  const set = getSet(DISMISSED_KEY);
  set.add(id);
  saveSet(DISMISSED_KEY, set);
  // Also mark as read
  markLocalRead(id);
}

// ─── Clear all (for debugging/reset) ─────────────────────────

export function clearLocalNotificationState(): void {
  try {
    localStorage.removeItem(READ_KEY);
    localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // ignore
  }
}
