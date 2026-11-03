I’ll inspect the existing HTTP bootstrap and ownership/test patterns, then provide a concrete implementation plan scoped to `src/app.js` and `src/server.js`.

## 1. **Architectural impact summary**
Rate limiting can be added at the HTTP entrypoint without touching route/business logic: **`src/app.js`** will enforce request quotas before routing/body parsing, and **`src/server.js`** will wire runtime configuration (env-driven). Related updates should include **`tests/rate-limit.test.js`** (new behavior coverage) and a small **`README.md`** note for configuration/429 semantics.

## 2. **Implementation sequence**
1. In **`src/app.js`**, add a small in-memory limiter helper near the top-level utilities, e.g.  
   `function createFixedWindowRateLimiter({ limit, windowMs, now = Date.now })`  
   returning `({ key }) => ({ allowed: boolean, retryAfterSeconds: number })`.  
   Use a `Map<string, { count: number, windowStartMs: number }>` keyed by client identity.
2. Extend `createApp` signature to accept limiter config/object while preserving current defaults, e.g.  
   `export function createApp({ store = createStore(), rateLimiter } = {})`.
3. In the request handler (before route matching/body parsing), derive client key from request (default `req.socket.remoteAddress ?? 'unknown'`), call limiter, and if blocked return:  
   - status `429`  
   - body shape `{ error: 'Too many requests' }`  
   - header `retry-after` set from limiter result.
4. In **`src/server.js`**, add env parsing for rate limit settings (for example `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`) with safe numeric validation; if invalid/non-positive, disable limiter rather than crash.
5. In **`src/server.js`**, instantiate limiter once at startup and pass it into app creation:  
   `const server = http.createServer(createApp({ rateLimiter }));`
6. Add **`tests/rate-limit.test.js`** using `node:test` + existing `startTestServer` helper:  
   - allows requests up to limit within window  
   - returns 429 + `{ error: string }` + `retry-after` after threshold  
   - resets after window expires (inject deterministic `now` into limiter/app for reliable test).
7. Update **`README.md`** API/runtime config notes with env vars and 429 behavior.

## 3. **Risk and security assessment**
Main behavior change is intentional throttling (possible new 429s under burst traffic). Security impact is positive (basic abuse mitigation).  
Memory/performance risk is unbounded key growth in the limiter `Map`; mitigate by opportunistic cleanup of stale windows during requests.  
Proxy/IP correctness is a deployment risk: using raw socket IP is safe by default, but `X-Forwarded-For` should only be trusted behind a known proxy.  
CODEOWNERS ownership: **`/src/`** is owned by `@Andrii-Susol`; tests/docs fall under global `*` owner (`@Andrii-Susol`).

## 4. **Verification strategy**
Add/adjust tests in:
- **`tests/rate-limit.test.js`**: threshold, 429 payload shape, `retry-after`, window reset.
- Optional regression in **`tests/tasks.test.js`**: ensure non-rate-limited behavior unchanged when limiter disabled/default.

Manual checks:
1. Start server with strict limits (`RATE_LIMIT_MAX=2 RATE_LIMIT_WINDOW_MS=60000`) and hit `/health` 3 times.
2. Confirm third response is `429` with JSON `{ "error": "Too many requests" }` and `retry-after` header.
3. Restart without env vars and confirm existing API behavior unchanged.

## 5. **Open questions**
- Should rate limiting apply to **all** endpoints, or exclude `/health`?
- Is the policy per-IP only, or should it support per-token/API-key in future?
- In production behind a reverse proxy, do we need trusted-proxy configuration to use `X-Forwarded-For` safely?
- Should limits be fail-open (disable on bad config) or fail-fast (startup error)?

Awaiting human review and explicit approval before handoff to execution agent.

