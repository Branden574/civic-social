// ═══════════════════════════════════════════════════════════════
// Civic Social — Server-Side Post & Comment Persistence Store
// ═══════════════════════════════════════════════════════════════
//
// When DATABASE_URL is set, all reads/writes go to Prisma
// (StoredPost / StoredComment tables) so data survives serverless
// cold starts and process restarts.
//
// Falls back to in-memory global store when DB is unavailable
// (local dev without a DB, or during initial setup).
// ═══════════════════════════════════════════════════════════════

import { isDbAvailable, prisma } from './db';

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
  postType: string;
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

// ─── Prisma row → PersistedPost ──────────────────────────────

function rowToPost(row: {
  id: string;
  authorId: string;
  content: string;
  topics: string[];
  articleUrl: string | null;
  civilityScore: number;
  createdAt: Date;
  status: string;
  deletedAt: Date | null;
  visibility: string;
  commentPolicy: string;
  isThreadLocked: boolean;
  postType?: string;
}): PersistedPost {
  return {
    id: row.id,
    authorId: row.authorId,
    content: row.content,
    topics: row.topics,
    articleUrl: row.articleUrl ?? undefined,
    civilityScore: row.civilityScore,
    createdAt: row.createdAt.toISOString(),
    status: row.status as PostStatus,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    visibility: row.visibility as PostVisibility,
    comment_policy: row.commentPolicy as CommentPolicy,
    is_thread_locked: row.isThreadLocked,
    postType: row.postType ?? 'OPEN_DISCUSSION',
  };
}

function rowToComment(row: {
  id: string;
  postId: string;
  authorId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: Date;
  status: string;
  deletedAt: Date | null;
}): PersistedComment {
  return {
    id: row.id,
    postId: row.postId,
    authorId: row.authorId,
    parentCommentId: row.parentCommentId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    status: row.status as CommentStatus,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

// ─── In-memory fallback store ─────────────────────────────────

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
  const s = g[STORE_KEY]!;
  if (!s.comments) s.comments = [];
  return s;
}

// ═══════════════════════════════════════════════════════════════
// POST CRUD
// ═══════════════════════════════════════════════════════════════

export async function createPost(input: {
  authorId: string;
  content: string;
  topics: string[];
  articleUrl?: string;
  civilityScore: number;
  comment_policy?: CommentPolicy;
  visibility?: PostVisibility;
  postType?: string;
}): Promise<PersistedPost> {
  const id = `user-post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (isDbAvailable()) {
    const row = await prisma.storedPost.create({
      data: {
        id,
        authorId: input.authorId,
        content: input.content,
        topics: input.topics,
        articleUrl: input.articleUrl ?? null,
        civilityScore: input.civilityScore,
        status: 'published',
        visibility: input.visibility ?? 'public',
        commentPolicy: input.comment_policy ?? 'everyone',
        isThreadLocked: false,
        postType: input.postType ?? 'OPEN_DISCUSSION',
      },
    });
    return rowToPost(row);
  }

  const post: PersistedPost = {
    id,
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
    postType: input.postType ?? 'OPEN_DISCUSSION',
  };
  getStore().posts.unshift(post);
  return post;
}

export async function getPostById(id: string): Promise<PersistedPost | null> {
  if (isDbAvailable()) {
    const row = await prisma.storedPost.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? rowToPost(row) : null;
  }
  return getStore().posts.find((p) => p.id === id && !p.deletedAt) ?? null;
}

export async function getPostsByAuthor(
  authorId: string,
  includeReview = false,
): Promise<PersistedPost[]> {
  if (isDbAvailable()) {
    const rows = await prisma.storedPost.findMany({
      where: {
        authorId,
        deletedAt: null,
        status: includeReview ? { not: 'removed' } : 'published',
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(rowToPost);
  }
  return getStore().posts.filter((p) => {
    if (p.authorId !== authorId) return false;
    if (p.deletedAt) return false;
    if (!includeReview && p.status === 'pending_review') return false;
    if (p.status === 'removed') return false;
    return true;
  });
}

export async function getAllPublishedPosts(): Promise<PersistedPost[]> {
  if (isDbAvailable()) {
    const rows = await prisma.storedPost.findMany({
      where: { status: 'published', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(rowToPost);
  }
  return getStore().posts.filter(
    (p) => p.status === 'published' && !p.deletedAt,
  );
}

export async function deletePost(id: string): Promise<boolean> {
  if (isDbAvailable()) {
    const updated = await prisma.storedPost.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), content: '[deleted]' },
    });
    return updated.count > 0;
  }
  const post = getStore().posts.find((p) => p.id === id);
  if (post) {
    post.deletedAt = new Date().toISOString();
    post.content = '[deleted]';
    return true;
  }
  return false;
}

export async function getPostCount(authorId: string): Promise<number> {
  if (isDbAvailable()) {
    return prisma.storedPost.count({
      where: { authorId, deletedAt: null, status: 'published' },
    });
  }
  return getStore().posts.filter(
    (p) => p.authorId === authorId && !p.deletedAt && p.status === 'published',
  ).length;
}

export async function updatePostCommentPolicy(
  postId: string,
  authorId: string,
  policy: CommentPolicy,
): Promise<boolean> {
  if (isDbAvailable()) {
    const updated = await prisma.storedPost.updateMany({
      where: { id: postId, authorId },
      data: { commentPolicy: policy },
    });
    return updated.count > 0;
  }
  const post = getStore().posts.find((p) => p.id === postId && p.authorId === authorId);
  if (!post) return false;
  post.comment_policy = policy;
  return true;
}

export async function lockThread(postId: string, locked: boolean): Promise<boolean> {
  if (isDbAvailable()) {
    const updated = await prisma.storedPost.updateMany({
      where: { id: postId },
      data: { isThreadLocked: locked },
    });
    return updated.count > 0;
  }
  const post = getStore().posts.find((p) => p.id === postId);
  if (!post) return false;
  post.is_thread_locked = locked;
  return true;
}

// ═══════════════════════════════════════════════════════════════
// COMMENT CRUD
// ═══════════════════════════════════════════════════════════════

export async function createComment(input: {
  postId: string;
  authorId: string;
  body: string;
  parentCommentId?: string;
}): Promise<PersistedComment> {
  const id = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (isDbAvailable()) {
    const row = await prisma.storedComment.create({
      data: {
        id,
        postId: input.postId,
        authorId: input.authorId,
        parentCommentId: input.parentCommentId ?? null,
        body: input.body,
        status: 'published',
      },
    });
    return rowToComment(row);
  }

  const comment: PersistedComment = {
    id,
    postId: input.postId,
    authorId: input.authorId,
    parentCommentId: input.parentCommentId ?? null,
    body: input.body,
    createdAt: new Date().toISOString(),
    status: 'published',
    deletedAt: null,
  };
  getStore().comments.unshift(comment);
  return comment;
}

export async function getCommentsByPost(
  postId: string,
  options?: { limit?: number; cursor?: string },
): Promise<{ comments: PersistedComment[]; total: number; hasMore: boolean }> {
  const limit = options?.limit ?? 50;

  if (isDbAvailable()) {
    const all = await prisma.storedComment.findMany({
      where: { postId, status: 'published', deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const total = all.length;
    let startIdx = 0;
    if (options?.cursor) {
      const cursorIdx = all.findIndex((c) => c.id === options.cursor);
      if (cursorIdx >= 0) startIdx = cursorIdx + 1;
    }
    const page = all.slice(startIdx, startIdx + limit).map(rowToComment);
    return { comments: page, total, hasMore: startIdx + limit < total };
  }

  const store = getStore();
  const all = store.comments
    .filter((c) => c.postId === postId && c.status === 'published' && !c.deletedAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  let startIdx = 0;
  if (options?.cursor) {
    const cursorIdx = all.findIndex((c) => c.id === options.cursor);
    if (cursorIdx >= 0) startIdx = cursorIdx + 1;
  }

  const page = all.slice(startIdx, startIdx + limit);
  return { comments: page, total: all.length, hasMore: startIdx + limit < all.length };
}

export async function getCommentCount(postId: string): Promise<number> {
  if (isDbAvailable()) {
    return prisma.storedComment.count({
      where: { postId, status: 'published', deletedAt: null },
    });
  }
  return getStore().comments.filter(
    (c) => c.postId === postId && c.status === 'published' && !c.deletedAt,
  ).length;
}

/**
 * Batch-fetch comment counts for multiple posts in a single DB query.
 * Returns a Map<postId, count>. Missing entries → 0.
 */
export async function getCommentCountsBatch(postIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (postIds.length === 0) return counts;

  if (isDbAvailable()) {
    const rows = await prisma.storedComment.groupBy({
      by: ['postId'],
      where: { postId: { in: postIds }, status: 'published', deletedAt: null },
      _count: { id: true },
    });
    for (const row of rows) {
      counts.set(row.postId, row._count.id);
    }
    return counts;
  }

  const store = getStore();
  for (const c of store.comments) {
    if (postIds.includes(c.postId) && c.status === 'published' && !c.deletedAt) {
      counts.set(c.postId, (counts.get(c.postId) ?? 0) + 1);
    }
  }
  return counts;
}

export async function getCommentById(commentId: string): Promise<PersistedComment | null> {
  if (isDbAvailable()) {
    const row = await prisma.storedComment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    return row ? rowToComment(row) : null;
  }
  return getStore().comments.find((c) => c.id === commentId && !c.deletedAt) ?? null;
}

export async function deleteComment(commentId: string, requesterId: string): Promise<boolean> {
  if (isDbAvailable()) {
    const updated = await prisma.storedComment.updateMany({
      where: { id: commentId, authorId: requesterId },
      data: { deletedAt: new Date(), body: '[deleted]', status: 'removed' },
    });
    return updated.count > 0;
  }
  const store = getStore();
  const comment = store.comments.find((c) => c.id === commentId);
  if (!comment) return false;
  if (comment.authorId !== requesterId) return false;
  comment.deletedAt = new Date().toISOString();
  comment.body = '[deleted]';
  comment.status = 'removed';
  return true;
}

export async function getReplyCounts(postId: string): Promise<Map<string, number>> {
  if (isDbAvailable()) {
    const replies = await prisma.storedComment.findMany({
      where: { postId, parentCommentId: { not: null }, status: 'published', deletedAt: null },
      select: { parentCommentId: true },
    });
    const counts = new Map<string, number>();
    for (const r of replies) {
      if (r.parentCommentId) {
        counts.set(r.parentCommentId, (counts.get(r.parentCommentId) ?? 0) + 1);
      }
    }
    return counts;
  }
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
    postType: 'OPEN_DISCUSSION',
  };
  return canComment(viewerId, fakePost, helpers);
}
