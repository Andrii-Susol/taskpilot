import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

test('GET /tasks/stats returns stats with zero tasks', async () => {
  const res = await api.request('GET', '/tasks/stats');
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0);
  assert.equal(res.body.byStatus.todo, 0);
  assert.equal(res.body.byStatus['in-progress'], 0);
  assert.equal(res.body.byStatus.done, 0);
});

test('GET /tasks/stats counts tasks by status', async () => {
  await api.request('POST', '/tasks', { body: { title: 'Task 1', status: 'todo' } });
  await api.request('POST', '/tasks', { body: { title: 'Task 2', status: 'todo' } });
  await api.request('POST', '/tasks', { body: { title: 'Task 3', status: 'in-progress' } });
  await api.request('POST', '/tasks', { body: { title: 'Task 4', status: 'done' } });
  const res = await api.request('GET', '/tasks/stats');
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 4);
  assert.equal(res.body.byStatus.todo, 2);
  assert.equal(res.body.byStatus['in-progress'], 1);
  assert.equal(res.body.byStatus.done, 1);
});

test('GET /tasks/stats is not shadowed by /tasks/:id route', async () => {
  const res = await api.request('GET', '/tasks/stats');
  assert.equal(res.status, 200);
  assert.ok(res.body.hasOwnProperty('total'));
  assert.ok(res.body.hasOwnProperty('byStatus'));
});
