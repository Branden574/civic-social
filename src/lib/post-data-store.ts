// ═══════════════════════════════════════════════════════════════
// Civic Social — Server-Side Post & Comment Persistence Store
// ═══════════════════════════════════════════════════════════════
//
// Stores user-created posts AND comments server-side so they
// survive refresh. Uses Symbol.for on global to persist across HMR.
//
// In production: Replace with Prisma/DB operations.
// ═══════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────

export type CommentPolicy = 'everyone' | 'followers_only' | 'off';
export type PostVisibility = 'public' | 'followers_only' | 'private';
export type PostStatus = 'published' | 'pending_review' | 'removed';
export type CommentStatus = 'published' | 'pending_review' | 'removed';

export interface PersistedPost {
  id: string;
  authorId: string;
  content: string;
  topics: string[];
  articleUrl?: string;
  civilityScore: number;
  createdAt: string; // ISO
  status: PostStatus;
  deletedAt: string | null;
  visibility: PostVisibility;
  comment_policy: CommentPolicy;
  is_thread_locked: boolean;
}

export interface PersistedComment {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string; // ISO
  status: CommentStatus;
  deletedAt: string | null;
}

// ─── Permission result ───────────────────────────────────────

export interface CanCommentResult {
  allowed: boolean;
  reason: string | null;
}

// ─── Store shape ─────────────────────────────────────────────

interface PostDataStore {
  posts: PersistedPost[];
  comments: PersistedComment[];
}

const STORE_KEY = Symbol.for('civic.post.data.store');

interface GlobalWithStore {
  [key: symbol]: PostDataStore | undefined;
}

function getStore(): PostDataStore {
  const g = global as unknown as GlobalWithStore;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { posts: [], comments: [] };
  }
  // Migrate: older stores may not have `comments`
  const s = g[STORE_KEY]!;
  if (!s.comments) s.comments = [];
  return s;
}

// ═══════════════════════════════════════════════════════════════
// POST CRUD
// ═══════════════════════════════════════════════════════════════

export function createPost(input: {
  authorId: string;
  content: string;
  topics: string[];
  articleUrl?: string;
  civilityScore: number;
  comment_policy?: CommentPolicy;
  visibility?: PostVisibility;
}): PersistedPost {
  const store = getStore();
  const post: PersistedPost = {
    id: `user-post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    authorId: input.authorId,
    content: input.content,
    topics: input.topics,
    articleUrl: input.articleUrl,
    civilityScore: input.civilityScore,
    createdAt: new Date().toISOString(),
    status: 'published',
    deletedAt: null,
    visibility: input.visibility ?? 'public',
    comment_policy: input.comment_policy ?? 'everyone',
    is_thread_locked: false,
  };
  store.posts.unshift(post);
  return post;
}

export function getPostById(id: string): PersistedPost | null {
  return getStore().posts.find((p) => p.id === id && !p.deletedAt) ?? null;
}

export function getPostsByAuthor(
  authorId: string,
  includeReview = false,
): PersistedPost[] {
  return getStore().posts.filter((p) => {
    if (p.authorId !== authorId) return false;
    if (p.deletedAt) return false;
    if (!includeReview && p.status === 'pending_review') return false;
    if (p.status === 'removed') return false;
    return true;
  });
}

export function getAllPublishedPosts(): PersistedPost[] {
  return getStore().posts.filter(
    (p) => p.status === 'published' && !p.deletedAt,
  );
}

export function deletePost(id: string): boolean {
  const store = getStore();
  const post = store.posts.find((p) => p.id === id);
  if (post) {
    post.deletedAt = new Date().toISOString();
    post.content = '[deleted]';
    return true;
  }
  return false;
}

export function getPostCount(authorId: string): number {
  return getStore().posts.filter(
    (p) => p.authorId === authorId && !p.deletedAt && p.status === 'published',
  ).length;
}

export function updatePostCommentPolicy(
  postId: string,
  authorId: string,
  policy: CommentPolicy,
): boolean {
  const post = getStore().posts.find((p) => p.id === postId && p.authorId === authorId);
  if (!post) return false;
  post.comment_policy = policy;
  return true;
}

export function lockThread(postId: string, locked: boolean): boolean {
  const post = getStore().posts.find((p) => p.id === postId);
  if (!post) return false;
  post.is_thread_locked = locked;
  return true;
}

// ═══════════════════════════════════════════════════════════════
// COMMENT CRUD
// ═══════════════════════════════════════════════════════════════

export function createComment(input: {
  postId: string;
  authorId: string;
  body: string;
  parentCommentId?: string;
}): PersistedComment {
  const store = getStore();
  const comment: PersistedComment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    postId: input.postId,
    authorId: input.authorId,
    parentCommentId: input.parentCommentId ?? null,
    body: input.body,
    createdAt: new Date().toISOString(),
    status: 'published',
    deletedAt: null,
  };
  store.comments.unshift(comment);
  return comment;
}

export function getCommentsByPost(
  postId: string,
  options?: { limit?: number; cursor?: string },
): { comments: PersistedComment[]; total: number; hasMore: boolean } {
  const store = getStore();
  const all = store.comments.filter(
    (c) => c.postId === postId && c.status === 'published' && !c.deletedAt,
  );

  // Sort newest first
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const limit = options?.limit ?? 50;
  let startIdx = 0;

  if (options?.cursor) {
    const cursorIdx = all.findIndex((c) => c.id === options.cursor);
    if (cursorIdx >= 0) startIdx = cursorIdx + 1;
  }

  const page = all.slice(startIdx, startIdx + limit);
  return {
    comments: page,
    total: all.length,
    hasMore: startIdx + limit < all.length,
  };
}

export function getCommentCount(postId: string): number {
  return getStore().comments.filter(
    (c) => c.postId === postId && c.status === 'published' && !c.deletedAt,
  ).length;
}

export function getCommentById(commentId: string): PersistedComment | null {
  return getStore().comments.find((c) => c.id === commentId && !c.deletedAt) ?? null;
}

export function deleteComment(commentId: string, requesterId: string): boolean {
  const store = getStore();
  const comment = store.comments.find((c) => c.id === commentId);
  if (!comment) return false;
  if (comment.authorId !== requesterId) return false;
  comment.deletedAt = new Date().toISOString();
  comment.body = '[deleted]';
  comment.status = 'removed';
  return true;
}

export function getReplyCounts(postId: string): Map<string, number> {
  const store = getStore();
  const counts = new Map<string, number>();
  for (const c of store.comments) {
    if (c.postId === postId && c.parentCommentId && c.status === 'published' && !c.deletedAt) {
      counts.set(c.parentCommentId, (counts.get(c.parentCommentId) ?? 0) + 1);
    }
  }
  return counts;
}

// ═══════════════════════════════════════════════════════════════
// PERMISSION: canComment
// ═══════════════════════════════════════════════════════════════
// Single authoritative function used by API + UI capability.
// In production, pass real user objects; here we use IDs.

export function canComment(
  viewerId: string | null,
  post: PersistedPost,
  helpers: {
    isFollower: (viewerId: string, authorId: string) => boolean;
    isBlocked: (a: string, b: string) => boolean;
    isBanned: (userId: string) => boolean;
  },
): CanCommentResult {
  if (!viewerId) return { allowed: false, reason: 'Sign in to comment' };
  if (post.deletedAt) return { allowed: false, reason: 'Post deleted' };
  if (post.status !== 'published') return { allowed: false, reason: 'Post unavailable' };
  if (post.is_thread_locked) return { allowed: false, reason: 'Thread locked by moderator' };
  if (post.comment_policy === 'off') return { allowed: false, reason: 'Comments turned off by author' };
  if (helpers.isBanned(viewerId)) return { allowed: false, reason: 'Your account is restricted' };
  if (helpers.isBlocked(viewerId, post.authorId)) return { allowed: false, reason: 'Blocked' };
  if (post.visibility === 'private') return { allowed: false, reason: 'Private post' };

  const needsFollow = post.comment_policy === 'followers_only' || post.visibility === 'followers_only';
  if (needsFollow && viewerId !== post.authorId) {
    if (!helpers.isFollower(viewerId, post.authorId)) {
      return { allowed: false, reason: 'Only followers can comment' };
    }
  }

  return { allowed: true, reason: null };
}

// Convenience for mock posts (from feed/mock data that aren't PersistedPosts)
export function canCommentMockPost(
  viewerId: string | null,
  mockPostMeta: { comment_policy?: CommentPolicy; visibility?: PostVisibility; is_thread_locked?: boolean; status?: PostStatus; deletedAt?: string | null; authorId?: string },
  helpers: {
    isFollower: (viewerId: string, authorId: string) => boolean;
    isBlocked: (a: string, b: string) => boolean;
    isBanned: (userId: string) => boolean;
  },
): CanCommentResult {
  const fakePost: PersistedPost = {
    id: '',
    authorId: mockPostMeta.authorId ?? '',
    content: '',
    topics: [],
    civilityScore: 0,
    createdAt: '',
    status: mockPostMeta.status ?? 'published',
    deletedAt: mockPostMeta.deletedAt ?? null,
    visibility: mockPostMeta.visibility ?? 'public',
    comment_policy: mockPostMeta.comment_policy ?? 'everyone',
    is_thread_locked: mockPostMeta.is_thread_locked ?? false,
  };
  return canComment(viewerId, fakePost, helpers);
}
