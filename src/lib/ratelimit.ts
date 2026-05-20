/**
 * Thin wrapper around Upstash Ratelimit. Gracefully no-ops when the
 * Upstash env vars are not set (local dev, sandbox builds), so server
 * actions can call `limit()` unconditionally.
 *
 * Configure with:
 *   UPSTASH_REDIS_REST_URL=...
 *   UPSTASH_REDIS_REST_TOKEN=...
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Limiter = {
  /** Returns `{ success: true }` if request is allowed; `{ success: false, retryAfterSeconds }` if rate-limited. */
  check(
    key: string,
  ): Promise<
    | { success: true }
    | { success: false; retryAfterSeconds: number }
  >;
};

let _transientFormLimiter: Limiter | null = null;

function makeLimiter(prefix: string, max: number, windowSeconds: number): Limiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    /* Dev / sandbox: allow everything. */
    return { check: async () => ({ success: true }) };
  }
  const redis = new Redis({ url, token });
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
    analytics: false,
    prefix,
  });
  return {
    async check(key: string) {
      const { success, reset } = await rl.limit(key);
      if (success) return { success: true };
      const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return { success: false, retryAfterSeconds };
    },
  };
}

export function transientFormLimiter(): Limiter {
  if (!_transientFormLimiter) {
    _transientFormLimiter = makeLimiter("transient-form", 5, 60 * 60);
  }
  return _transientFormLimiter;
}
