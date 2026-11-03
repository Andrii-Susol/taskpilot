// In-memory token-bucket rate limiter (no Redis, no dependencies).
// Each client key gets `capacity` tokens; tokens refill at `refillPerSecond`.
export function createRateLimiter({
  capacity = 60,
  refillPerSecond = 1,
  maxKeys = 10_000,
  now = () => Date.now(),
  keyFn = (req) => req.socket?.remoteAddress ?? 'unknown',
} = {}) {
  if (!(capacity > 0) || !(refillPerSecond > 0)) {
    throw new RangeError('capacity and refillPerSecond must be positive numbers');
  }
  const buckets = new Map();

  function evictIdle(t) {
    // A bucket that has been idle long enough to refill completely carries no state.
    const fullRefillMs = (capacity / refillPerSecond) * 1000;
    for (const [key, b] of buckets) {
      if (t - b.last >= fullRefillMs) buckets.delete(key);
    }
  }

  return function check(req) {
    const t = now();
    const key = keyFn(req);
    let b = buckets.get(key);
    if (!b) {
      if (buckets.size >= maxKeys) evictIdle(t);
      b = { tokens: capacity, last: t };
      buckets.set(key, b);
    }
    b.tokens = Math.min(capacity, b.tokens + ((t - b.last) / 1000) * refillPerSecond);
    b.last = t;
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return { allowed: true, remaining: Math.floor(b.tokens), limit: capacity };
    }
    return {
      allowed: false,
      remaining: 0,
      limit: capacity,
      retryAfterSeconds: Math.ceil((1 - b.tokens) / refillPerSecond),
    };
  };
}
