// In-memory token bucket rate limiter.
//
// Caveats — read before believing this is "production grade":
//   1. State is per-process. If you run multiple Node instances behind a load
//      balancer, each has its own counters. Replace with Redis (Upstash,
//      ElastiCache) before horizontal scaling.
//   2. Memory grows with unique keys until pruned. We GC stale entries lazily
//      on each `take` call.
//   3. The key is whatever the caller passes. If you key on a header the
//      client can spoof (e.g. raw X-Forwarded-For without a trusted proxy),
//      attackers can rotate it. Treat this as a speed-bump, not a wall.

type Bucket = {
  tokens: number;
  lastRefillMs: number;
};

const buckets = new Map<string, Bucket>();
const STALE_AFTER_MS = 10 * 60 * 1000;
let lastSweepMs = Date.now();

export type RateLimitOptions = {
  /** Sustained refill rate, tokens per second. */
  refillPerSecond: number;
  /** Maximum tokens (i.e. burst size). */
  capacity: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function take(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  maybeSweep(now);

  const b = buckets.get(key) ?? {
    tokens: opts.capacity,
    lastRefillMs: now,
  };
  const elapsedSec = (now - b.lastRefillMs) / 1000;
  b.tokens = Math.min(opts.capacity, b.tokens + elapsedSec * opts.refillPerSecond);
  b.lastRefillMs = now;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    buckets.set(key, b);
    return {
      ok: true,
      remaining: Math.floor(b.tokens),
      retryAfterSeconds: 0,
    };
  }

  buckets.set(key, b);
  const deficit = 1 - b.tokens;
  const retryAfterSeconds = Math.ceil(deficit / opts.refillPerSecond);
  return { ok: false, remaining: 0, retryAfterSeconds };
}

function maybeSweep(now: number) {
  if (now - lastSweepMs < 60_000) return;
  lastSweepMs = now;
  for (const [k, b] of buckets) {
    if (now - b.lastRefillMs > STALE_AFTER_MS) buckets.delete(k);
  }
}
