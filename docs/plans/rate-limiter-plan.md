I’ll open the existing plan and produce a revised version aligned to your six constraints.

I’m validating exact function/file names and CODEOWNERS so the revised plan is implementation-ready against this repo.

1. **Architectural impact summary**  
Rate limiting should be implemented as a dedicated in-memory utility plus light wiring in the HTTP entrypoint. Affected paths: **`src/rate-limiter.js`** (new token-bucket implementation), **`src/app.js`** (middleware-style enforcement and `/health` exemption), **`src/server.js`** (env-driven configuration), **`tests/rate-limiter.test.js`** and **`tests/tasks.test.js`** (behavior coverage), and **`docs/plans/rate-limiter-plan.v1.md`** / optionally **`README.md`** (config + response contract). CODEOWNERS ownership for touched runtime files is **`/src/ @Andrii-Susol`**; tests/docs are covered by global `* @Andrii-Susol`.

2. **Implementation sequence**  
1. Create **`src/rate-limiter.js`** with `export function createTokenBucketRateLimiter({ capacity = 60, refillPerSec = 1, maxKeys, keyFn = defaultKeyFn, now = Date.now } = {})` and `function defaultKeyFn(req) { return req.socket?.remoteAddress ?? 'unknown'; }`.  
2. In the limiter, track buckets in `Map<string, { tokens: number, lastRefillMs: number, lastSeenMs: number }>`; on each request: refill by elapsed time, consume 1 token if available, and return `{ allowed, retryAfterSec, limit: capacity, remaining }`.  
3. Implement memory bound in the limiter: when `buckets.size > maxKeys`, evict **idle** buckets first (largest idle duration via `lastSeenMs`) until size is `<= maxKeys`; if needed to enforce hard bound, continue evicting oldest entries.  
4. Update **`src/app.js`** signature to `createApp({ store = createStore(), rateLimiter } = {})`; in handler, parse URL first, skip limiting for `url.pathname === '/health'`, otherwise call limiter and, if blocked, return `429` with body `{ error: 'Too many requests' }` plus headers: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`.  
5. Also set `X-RateLimit-Limit` / `X-RateLimit-Remaining` on allowed non-`/health` responses so clients can observe quota progression consistently.  
6. Update **`src/server.js`** to parse `RATE_LIMIT_CAPACITY` (default `60`) and `RATE_LIMIT_REFILL_PER_SEC` (default `1`), construct limiter once, and pass into `createApp`. Keep zero-dependency parsing/validation; reject non-positive/NaN values by falling back to defaults.  
7. Ensure testability hooks are preserved: tests can inject custom `keyFn` and deterministic `now` through limiter factory options passed via `createApp`/`startTestServer`.

3. **Risk and security assessment**  
Primary behavioral risk is introducing 429s under burst traffic; `/health` exemption avoids false negatives in uptime checks. Security posture improves (basic abuse throttling), but IP-based identity can collapse multiple users behind NAT and is proxy-sensitive; only trust forwarded headers if an explicit trusted-proxy policy is added later. Memory/performance risks are bounded by `maxKeys`; eviction scan is O(n) during overflow events, acceptable for a zero-dependency baseline but should be monitored at high cardinality.

4. **Verification strategy**  
Add **`tests/rate-limiter.test.js`** (node:test) with cases for: token consumption/refill using injected `now`, 429 response shape `{ error: string }`, required headers (`Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`), `/health` exemption, and `maxKeys` eviction behavior when many client keys are seen. Update/add integration checks in **`tests/tasks.test.js`** for end-to-end header presence and throttling on non-health routes. Manual checks: run server with defaults, confirm sustained 1 req/sec refill behavior; then burst a single IP and verify 429 + headers; hit `/health` repeatedly and confirm never rate-limited.

5. **Open questions**  
What default value should be used for **`maxKeys`** (fixed constant vs derived from capacity), given it is required for memory bounds but not specified as an env var? If strict hard-bounding under all conditions is required, should active buckets also be evictable when no clearly idle buckets exist.

Awaiting human review and explicit approval before handoff to execution agent.

---
## Approval
- Decision: **PLAN APPROVED**. Proceeding to execution stage.
- Approved by: @YOUR_USERNAME
- Date: YYYY-MM-DD
- Scope of execution: `src/middleware/rate-limit.js`, `src/app.js`, `src/server.js`, `tests/rate-limit.test.js`
