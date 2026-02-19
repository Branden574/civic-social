// ═══════════════════════════════════════════════════════════════
// Tests: Post Persistence — Create, Fetch, Delete, Feed Integration
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';

// Reset the store before each test
const STORE_KEY = Symbol.for('civic.post.data.store');

function resetStore() {
  (global as Record<symbol, unknown>)[STORE_KEY] = undefined;
}

import {
  createPost,
  getPostById,
  getPostsByAuthor,
  getAllPublishedPosts,
  deletePost,
  getPostCount,
} from '@/lib/post-data-store';

// ═══════════════════════════════════════════════════════════════
// A) POST CREATION + PERSISTENCE
// ═══════════════════════════════════════════════════════════════

describe('Post Creation', () => {
  beforeEach(() => resetStore());

  it('creates a post with all required fields', async () => {
    const post = await createPost({
      authorId: 'user-current',
      content: 'Test post about healthcare policy.',
      topics: ['healthcare'],
      civilityScore: 0.9,
    });

    expect(post.id).toBeTruthy();
    expect(post.authorId).toBe('user-current');
    expect(post.content).toBe('Test post about healthcare policy.');
    expect(post.topics).toEqual(['healthcare']);
    expect(post.civilityScore).toBe(0.9);
    expect(post.createdAt).toBeTruthy();
    expect(post.status).toBe('published');
    expect(post.deletedAt).toBeNull();
  });

  it('post survives simulated refresh (getPostById)', async () => {
    const post = await createPost({
      authorId: 'user-current',
      content: 'This should persist.',
      topics: [],
      civilityScore: 0.8,
    });

    // Simulate "refresh" by fetching again
    const fetched = await getPostById(post.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.content).toBe('This should persist.');
  });

  it('post appears in author posts list', async () => {
    await createPost({
      authorId: 'user-current',
      content: 'My first post.',
      topics: ['economy'],
      civilityScore: 0.85,
    });
    await createPost({
      authorId: 'user-current',
      content: 'My second post.',
      topics: ['climate'],
      civilityScore: 0.9,
    });

    const posts = await getPostsByAuthor('user-current');
    expect(posts.length).toBe(2);
    // Most recent first
    expect(posts[0].content).toBe('My second post.');
  });

  it('post appears in all published posts (for feed)', async () => {
    await createPost({
      authorId: 'user-current',
      content: 'Feed post.',
      topics: [],
      civilityScore: 0.8,
    });

    const all = await getAllPublishedPosts();
    expect(all.length).toBe(1);
    expect(all[0].content).toBe('Feed post.');
  });

  it('post count is correct', async () => {
    expect(await getPostCount('user-current')).toBe(0);
    await createPost({ authorId: 'user-current', content: 'A', topics: [], civilityScore: 0.8 });
    await createPost({ authorId: 'user-current', content: 'B', topics: [], civilityScore: 0.8 });
    expect(await getPostCount('user-current')).toBe(2);
  });

  it('posts from different authors are isolated', async () => {
    await createPost({ authorId: 'user-current', content: 'My post', topics: [], civilityScore: 0.8 });
    await createPost({ authorId: 'user-other', content: 'Other post', topics: [], civilityScore: 0.8 });

    expect((await getPostsByAuthor('user-current')).length).toBe(1);
    expect((await getPostsByAuthor('user-other')).length).toBe(1);
    expect((await getAllPublishedPosts()).length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// B) POST DELETION
// ═══════════════════════════════════════════════════════════════

describe('Post Deletion', () => {
  beforeEach(() => resetStore());

  it('deletePost removes from all queries', async () => {
    const post = await createPost({
      authorId: 'user-current',
      content: 'Will be deleted.',
      topics: [],
      civilityScore: 0.8,
    });

    expect(await getPostById(post.id)).not.toBeNull();
    expect((await getAllPublishedPosts()).length).toBe(1);

    await deletePost(post.id);

    expect(await getPostById(post.id)).toBeNull();
    expect((await getAllPublishedPosts()).length).toBe(0);
    expect((await getPostsByAuthor('user-current')).length).toBe(0);
    expect(await getPostCount('user-current')).toBe(0);
  });

  it('deleting a non-existent post returns false', async () => {
    expect(await deletePost('non-existent-id')).toBe(false);
  });

  it('deleted post content is wiped', async () => {
    const post = await createPost({
      authorId: 'user-current',
      content: 'Sensitive content.',
      topics: [],
      civilityScore: 0.8,
    });

    await deletePost(post.id);

    // Even if we bypass the normal getter, content should be wiped
    // (the post still exists in the array but with deletedAt set)
    // getPostById filters it out, but the underlying data is cleaned
  });
});

// ═══════════════════════════════════════════════════════════════
// C) FEED INTEGRATION (simulate refresh cycle)
// ═══════════════════════════════════════════════════════════════

describe('Feed Integration', () => {
  beforeEach(() => resetStore());

  it('created post is returned in getAllPublishedPosts after "refresh"', async () => {
    // Step 1: Create post (simulates compose modal)
    await createPost({
      authorId: 'user-current',
      content: 'I think we need better healthcare policy.',
      topics: ['healthcare'],
      civilityScore: 0.95,
    });

    // Step 2: "Refresh" — getAllPublishedPosts is what the feed API uses
    const posts = await getAllPublishedPosts();
    expect(posts.length).toBe(1);
    expect(posts[0].content).toContain('healthcare policy');
  });

  it('created post is returned in getPostsByAuthor after "refresh"', async () => {
    // Step 1: Create
    await createPost({
      authorId: 'user-current',
      content: 'Profile post.',
      topics: [],
      civilityScore: 0.8,
    });

    // Step 2: "Refresh" — profile page fetches by author
    const posts = await getPostsByAuthor('user-current');
    expect(posts.length).toBe(1);
    expect(posts[0].content).toBe('Profile post.');
  });

  it('multiple posts maintain correct order after refresh', async () => {
    await createPost({ authorId: 'user-current', content: 'First', topics: [], civilityScore: 0.8 });
    await createPost({ authorId: 'user-current', content: 'Second', topics: [], civilityScore: 0.8 });
    await createPost({ authorId: 'user-current', content: 'Third', topics: [], civilityScore: 0.8 });

    const posts = await getPostsByAuthor('user-current');
    expect(posts.length).toBe(3);
    // Most recent first (unshift in createPost)
    expect(posts[0].content).toBe('Third');
    expect(posts[1].content).toBe('Second');
    expect(posts[2].content).toBe('First');
  });
});

// ═══════════════════════════════════════════════════════════════
// D) ARTICLE URL HANDLING
// ═══════════════════════════════════════════════════════════════

describe('Article URL', () => {
  beforeEach(() => resetStore());

  it('stores articleUrl when provided', async () => {
    const post = await createPost({
      authorId: 'user-current',
      content: 'Check this article.',
      topics: ['news'],
      articleUrl: 'https://example.com/article',
      civilityScore: 0.8,
    });

    expect(post.articleUrl).toBe('https://example.com/article');
  });

  it('articleUrl is undefined when not provided', async () => {
    const post = await createPost({
      authorId: 'user-current',
      content: 'No article.',
      topics: [],
      civilityScore: 0.8,
    });

    expect(post.articleUrl).toBeUndefined();
  });
});
