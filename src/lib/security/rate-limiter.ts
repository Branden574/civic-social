// ═══════════════════════════════════════════════════════════════
// Civic Social — In-Memory Rate Limiter
// ═══════════════════════════════════════════════════════════════
//
// Sliding window counter per key. Production should swap to Redis
// (e.g. @upstash/ratelimit) for multi-instance deployments.
//
// Usage:
//   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });
//   const { allowed, remaining, retryAfterMs } = limiter.check(ip);
// ═══════════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Window duration in milliseconds */
  windowMs: number;
  /** Max requests per window */
  max: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  limit: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

// Garbage-collect expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }
}, 60_000);

export function createRateLimiter(name: string, config: RateLimitConfig) {
  const store = getStore(name);

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const existing = store.get(key);

      if (!existing || now > existing.resetAt) {
        store.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true, remaining: config.max - 1, retryAfterMs: 0, limit: config.max };
      }

      existing.count++;

      if (existing.count > config.max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: existing.resetAt - now,
          limit: config.max,
        };
      }

      return {
        allowed: true,
        remaining: config.max - existing.count,
        retryAfterMs: 0,
        limit: config.max,
      };
    },

    reset(key: string) {
      store.delete(key);
    },
  };
}

// ─── Pre-configured limiters ─────────────────────────────────

/** Global: 100 req / 60s per IP */
export const globalLimiter = createRateLimiter('global', {
  windowMs: 60_000,
  max: 100,
});

/** Auth: 5 attempts / 15 min per IP */
export const authLimiter = createRateLimiter('auth', {
  windowMs: 15 * 60_000,
  max: 5,
});

/** Posting: 10 posts / 60 min per user */
export const postLimiter = createRateLimiter('post', {
  windowMs: 60 * 60_000,
  max: 10,
});

/** Chat messages + voice actions: 120 / minute per user */
export const chatLimiter = createRateLimiter('chat', {
  windowMs: 60_000,
  max: 120,
});

/** Follow/unfollow: 30 / minute per user */
export const socialLimiter = createRateLimiter('social', {
  windowMs: 60_000,
  max: 30,
});

/** Debate creation: 5 / hour per user */
export const debateLimiter = createRateLimiter('debate', {
  windowMs: 60 * 60_000,
  max: 5,
});

/** API read endpoints: 600 / minute per IP (supports real-time debate polling from multiple tabs) */
export const readLimiter = createRateLimiter('read', {
  windowMs: 60_000,
  max: 600,
});

/** Signup: 3 / hour per IP */
export const signupLimiter = createRateLimiter('signup', {
  windowMs: 60 * 60_000,
  max: 3,
});

/** Password reset: 3 / hour per email */
export const passwordResetLimiter = createRateLimiter('password-reset', {
  windowMs: 60 * 60_000,
  max: 3,
});
