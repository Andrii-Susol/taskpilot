import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

test('GET /health returns ok', async () => {
  const res = await api.request('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('POST /tasks creates a task with default status', async () => {
  const res = await api.request('POST', '/tasks', { body: { title: 'Write lab 0' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.title, 'Write lab 0');
  assert.equal(res.body.status, 'todo');
  assert.ok(res.body.id);
});

test('POST /tasks rejects an empty title', async () => {
  const res = await api.request('POST', '/tasks', { body: { title: '   ' } });
  assert.equal(res.status, 400);
});

test('GET /tasks filters by status', async () => {
  await api.request('POST', '/tasks', { body: { title: 'Done thing', status: 'done' } });
  const res = await api.request('GET', '/tasks?status=done');
  assert.equal(res.status, 200);
  assert.ok(res.body.length >= 1);
  assert.ok(res.body.every((t) => t.status === 'done'));
});

test('PATCH and DELETE /tasks/:id', async () => {
  const created = await api.request('POST', '/tasks', { body: { title: 'Patch me' } });
  const id = created.body.id;
  const patched = await api.request('PATCH', `/tasks/${id}`, { body: { status: 'in-progress' } });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.status, 'in-progress');
  const deleted = await api.request('DELETE', `/tasks/${id}`);
  assert.equal(deleted.status, 204);
  const missing = await api.request('GET', `/tasks/${id}`);
  assert.equal(missing.status, 404);
});

test('unknown route returns 404 and wrong method returns 405', async () => {
  assert.equal((await api.request('GET', '/nope')).status, 404);
  assert.equal((await api.request('PUT', '/tasks')).status, 405);
});
