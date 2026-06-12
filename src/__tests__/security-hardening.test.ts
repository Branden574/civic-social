// @vitest-environment node
// ═══════════════════════════════════════════════════════════════
// Tests: API Security Hardening
//   - /api/admin/db-cleanup requires admin (not just auth)
//   - /api/posts/:postId/reactions validates postId + reaction enum
//   - /api/posts/:postId DELETE is write-rate-limited
//   - /api/posts/:postId/comments PATCH is write-rate-limited
//   - /api/hashtag/:tag sanitizes the tag param
//   - sanitizeHashtag helper
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { sanitizeHashtag } from '@/lib/security/sanitize';
import { signSession, SESSION_COOKIE_NAME } from '@/lib/security/session';
import { socialLimiter } from '@/lib/security/rate-limiter';

import { POST as dbCleanupPost, GET as dbCleanupGet } from '@/app/api/admin/db-cleanup/route';
import { POST as reactionsPost } from '@/app/api/posts/[postId]/reactions/route';
import { DELETE as postDelete } from '@/app/api/posts/[postId]/route';
import { PATCH as commentsPatch } from '@/app/api/posts/[postId]/comments/route';
import { GET as hashtagGet } from '@/app/api/hashtag/[tag]/route';

beforeAll(() => {
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = 'vitest-only-session-secret';
  }
});

function sessionCookie(role: 'user' | 'admin' | 'creator', id = 'user-test-1'): string {
  const token = signSession({
    id,
    email: 'test@example.com',
    role,
    displayName: 'Test User',
    iat: Date.now(),
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function makeRequest(
  url: string,
  opts: { method?: string; cookie?: string; body?: unknown } = {},
): NextRequest {
  const headers = new Headers();
  if (opts.cookie) headers.set('cookie', opts.cookie);
  if (opts.body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function routeParams<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

// ─── sanitizeHashtag ─────────────────────────────────────────

describe('sanitizeHashtag', () => {
  it('lowercases and keeps slug characters', () => {
    expect(sanitizeHashtag('Climate-Policy_2026')).toBe('climate-policy_2026');
  });

  it('strips characters outside [a-z0-9_-]', () => {
    expect(sanitizeHashtag('<script>alert(1)</script>')).toBe('scriptalert1script');
    expect(sanitizeHashtag('héalth care!')).toBe('halthcare');
  });

  it('caps length at 50 chars', () => {
    expect(sanitizeHashtag('a'.repeat(80))).toHaveLength(50);
  });

  it('returns empty string for non-strings and all-invalid input', () => {
    expect(sanitizeHashtag(undefined as unknown as string)).toBe('');
    expect(sanitizeHashtag('!!!')).toBe('');
  });
});

// ─── /api/admin/db-cleanup ───────────────────────────────────

describe('admin db-cleanup requires admin role', () => {
  it('POST rejects unauthenticated requests with 401', async () => {
    const res = await dbCleanupPost(makeRequest('http://localhost/api/admin/db-cleanup', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('POST rejects regular logged-in users with 403', async () => {
    const res = await dbCleanupPost(
      makeRequest('http://localhost/api/admin/db-cleanup', { method: 'POST', cookie: sessionCookie('user') }),
    );
    expect(res.status).toBe(403);
  });

  it('POST lets admins past the guard', async () => {
    const res = await dbCleanupPost(
      makeRequest('http://localhost/api/admin/db-cleanup', { method: 'POST', cookie: sessionCookie('admin') }),
    );
    expect([401, 403]).not.toContain(res.status);
  });

  it('GET rejects regular logged-in users with 403', async () => {
    const res = await dbCleanupGet(
      makeRequest('http://localhost/api/admin/db-cleanup', { cookie: sessionCookie('user') }),
    );
    expect(res.status).toBe(403);
  });
});

// ─── /api/posts/:postId/reactions ────────────────────────────

describe('reactions route validates postId and reaction type', () => {
  it('rejects malformed postId with 400', async () => {
    const res = await reactionsPost(
      makeRequest('http://localhost/api/posts/x/reactions', {
        method: 'POST',
        cookie: sessionCookie('user'),
        body: { reaction: 'agree' },
      }),
      routeParams({ postId: 'bad id/../<x>' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects reaction values outside the enum with 400', async () => {
    const res = await reactionsPost(
      makeRequest('http://localhost/api/posts/post-1/reactions', {
        method: 'POST',
        cookie: sessionCookie('user'),
        body: { reaction: 'love' },
      }),
      routeParams({ postId: 'post-1' }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('agree');
  });
});

// ─── /api/posts/:postId DELETE rate limiting ─────────────────

describe('post DELETE uses a write rate limiter', () => {
  it('returns 429 once the social write limit is exhausted', async () => {
    const userId = 'user-del-limit';
    socialLimiter.reset(userId);
    // Exhaust the per-user write budget (30/min)
    for (let i = 0; i < 30; i++) socialLimiter.check(userId);

    const res = await postDelete(
      makeRequest('http://localhost/api/posts/post-1', {
        method: 'DELETE',
        cookie: sessionCookie('user', userId),
      }),
      routeParams({ postId: 'post-1' }),
    );
    expect(res.status).toBe(429);
    socialLimiter.reset(userId);
  });

  it('still requires authentication', async () => {
    const res = await postDelete(
      makeRequest('http://localhost/api/posts/post-1', { method: 'DELETE' }),
      routeParams({ postId: 'post-1' }),
    );
    expect(res.status).toBe(401);
  });
});

// ─── /api/posts/:postId/comments PATCH rate limiting ─────────

describe('comment reactions PATCH uses a write rate limiter', () => {
  it('returns 429 once the social write limit is exhausted', async () => {
    const userId = 'user-cr-limit';
    socialLimiter.reset(userId);
    for (let i = 0; i < 30; i++) socialLimiter.check(userId);

    const res = await commentsPatch(
      makeRequest('http://localhost/api/posts/post-1/comments', {
        method: 'PATCH',
        cookie: sessionCookie('user', userId),
        body: { commentId: 'comment-1', reaction: 'like' },
      }),
      routeParams({ postId: 'post-1' }),
    );
    expect(res.status).toBe(429);
    socialLimiter.reset(userId);
  });

  it('rejects reaction values outside the enum with 400', async () => {
    const userId = 'user-cr-enum';
    socialLimiter.reset(userId);
    const res = await commentsPatch(
      makeRequest('http://localhost/api/posts/post-1/comments', {
        method: 'PATCH',
        cookie: sessionCookie('user', userId),
        body: { commentId: 'comment-1', reaction: 'love' },
      }),
      routeParams({ postId: 'post-1' }),
    );
    expect(res.status).toBe(400);
  });
});

// ─── /api/hashtag/:tag ───────────────────────────────────────

describe('hashtag route sanitizes the tag param', () => {
  it('strips dangerous characters and lowercases the tag', async () => {
    const res = await hashtagGet(
      makeRequest('http://localhost/api/hashtag/Climate-Policy%21'),
      routeParams({ tag: 'Climate-Policy%21' }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tag).toBe('climate-policy');
  });

  it('rejects tags that are empty after sanitization', async () => {
    const res = await hashtagGet(
      makeRequest('http://localhost/api/hashtag/%21%21%21'),
      routeParams({ tag: '%21%21%21' }),
    );
    expect(res.status).toBe(400);
  });
});
