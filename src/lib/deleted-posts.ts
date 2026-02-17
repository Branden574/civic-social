// ═══════════════════════════════════════════════════════════════
// Deleted Posts Registry
// ═══════════════════════════════════════════════════════════════
//
// Tracks post IDs that have been permanently deleted so they
// are filtered from all feeds and search results.
//
// In production: This would be a database column (deleted_at)
// or a dedicated deletions table.
//
// For dev/demo: Uses a global variable attached to the Node.js
// process global, which survives across API route invocations
// in the same server process.
// ═══════════════════════════════════════════════════════════════

// Attach to the Node.js global object to persist across module
// re-evaluations in Next.js dev mode (Turbopack HMR)
const GLOBAL_KEY = Symbol.for('civic.deleted.posts');

interface GlobalStore {
  [key: symbol]: Set<string> | undefined;
}

function getStore(): Set<string> {
  const g = global as unknown as GlobalStore;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Set<string>();
  }
  return g[GLOBAL_KEY]!;
}

export function markPostDeleted(postId: string): void {
  getStore().add(postId);
}

export function isPostDeleted(postId: string): boolean {
  return getStore().has(postId);
}

export function getDeletedPostIds(): Set<string> {
  return getStore();
}

export function clearDeletedPosts(): void {
  getStore().clear();
}
