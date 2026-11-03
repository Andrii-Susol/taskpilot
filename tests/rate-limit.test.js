import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/middleware/rate-limit.js';
import { startTestServer } from './helpers.js';

const fakeReq = (ip = '1.2.3.4') => ({ socket: { remoteAddress: ip } });

test('allows up to capacity, then blocks', () => {
  let t = 0;
  const check = createRateLimiter({ capacity: 3, refillPerSecond: 1, now: () => t });
  assert.equal(check(fakeReq()).allowed, true);
  assert.equal(check(fakeReq()).allowed, true);
  assert.equal(check(fakeReq()).allowed, true);
  const blocked = check(fakeReq());
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
});

test('refills over time and isolates clients', () => {
  let t = 0;
  const check = createRateLimiter({ capacity: 1, refillPerSecond: 1, now: () => t });
  assert.equal(check(fakeReq('a')).allowed, true);
  assert.equal(check(fakeReq('a')).allowed, false);
  assert.equal(check(fakeReq('b')).allowed, true); // other client unaffected
  t = 1000;
  assert.equal(check(fakeReq('a')).allowed, true); // refilled
});

test('rejects invalid configuration', () => {
  assert.throws(() => createRateLimiter({ capacity: 0 }), RangeError);
});

test('API returns 429 with Retry-After, /health is exempt', async () => {
  const rateLimiter = createRateLimiter({ capacity: 2, refillPerSecond: 0.001 });
  const api = await startTestServer({ rateLimiter });
  try {
    assert.equal((await api.request('GET', '/tasks')).status, 200);
    assert.equal((await api.request('GET', '/tasks')).status, 200);
    const limited = await api.request('GET', '/tasks');
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.equal((await api.request('GET', '/health')).status, 200);
  } finally {
    await api.close();
  }
});
