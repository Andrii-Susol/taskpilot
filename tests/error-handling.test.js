import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

test('malformed JSON returns 400, not 500', async () => {
  const res = await api.request('POST', '/tasks', { raw: '{"title": "oops"' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Malformed JSON body');
});

test('500 responses never leak internal error details', async () => {
  const res = await api.request('POST', '/tasks', { raw: '{"title": "oops"' });
  assert.equal(res.body.detail, undefined);
});
