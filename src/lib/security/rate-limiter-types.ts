// Shared type for rate limiter results
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  limit: number;
}
