import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

// Valid percent-encoded IDs

test('GET /tasks/:id with valid percent-encoded id returns 404 for unknown id', async () => {
  const res = await api.request('GET', '/tasks/does%20not%20exist');
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

test('GET /tasks/:id with valid percent-encoded space decodes correctly', async () => {
  const created = await api.request('POST', '/tasks', { body: { title: 'Test' } });
  const id = created.body.id;
  
  const res = await api.request('GET', `/tasks/${encodeURIComponent('prefix ' + id + ' suffix')}`);
  assert.equal(res.status, 404);
});

test('PATCH /tasks/:id with valid percent-encoded id returns 404 for unknown id', async () => {
  const res = await api.request('PATCH', '/tasks/does%20not%20exist', { body: { status: 'done' } });
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

test('DELETE /tasks/:id with valid percent-encoded id returns 404 for unknown id', async () => {
  const res = await api.request('DELETE', '/tasks/does%20not%20exist');
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

// Malformed percent-encoding

test('GET /tasks/:id with malformed percent-encoding returns 400', async () => {
  const res = await api.request('GET', '/tasks/%E0%A4%A');
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
}, { todo: 'bug: malformed percent-encoding causes 500; decodeURIComponent throws unhandled error instead of being validated as 400' });

test('PATCH /tasks/:id with malformed percent-encoding returns 400', async () => {
  const res = await api.request('PATCH', '/tasks/%E0%A4%A', { body: { status: 'done' } });
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
}, { todo: 'bug: malformed percent-encoding causes 500; decodeURIComponent throws unhandled error instead of being validated as 400' });

test('DELETE /tasks/:id with malformed percent-encoding returns 400', async () => {
  const res = await api.request('DELETE', '/tasks/%E0%A4%A');
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
}, { todo: 'bug: malformed percent-encoding causes 500; decodeURIComponent throws unhandled error instead of being validated as 400' });

test('GET /tasks/:id with incomplete percent-encoding returns 400', async () => {
  const res = await api.request('GET', '/tasks/%2');
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
}, { todo: 'bug: malformed percent-encoding causes 500; decodeURIComponent throws unhandled error instead of being validated as 400' });

// Trailing slashes

test('GET /tasks/:id with trailing slash returns 404 (does not match route)', async () => {
  const created = await api.request('POST', '/tasks', { body: { title: 'Test' } });
  const id = created.body.id;
  const res = await api.request('GET', `/tasks/${id}/`);
  assert.equal(res.status, 404);
}, { todo: 'bug: trailing slash matches route; router normalizes /tasks/id/ to [tasks, id] by filtering empty strings from split' });

test('PATCH /tasks/:id with trailing slash returns 404 (does not match route)', async () => {
  const created = await api.request('POST', '/tasks', { body: { title: 'Test' } });
  const id = created.body.id;
  const res = await api.request('PATCH', `/tasks/${id}/`, { body: { status: 'done' } });
  assert.equal(res.status, 404);
}, { todo: 'bug: trailing slash matches route; router normalizes /tasks/id/ to [tasks, id] by filtering empty strings from split' });

test('DELETE /tasks/:id with trailing slash returns 404 (does not match route)', async () => {
  const created = await api.request('POST', '/tasks', { body: { title: 'Test' } });
  const id = created.body.id;
  const res = await api.request('DELETE', `/tasks/${id}/`);
  assert.equal(res.status, 404);
}, { todo: 'bug: trailing slash matches route; router normalizes /tasks/id/ to [tasks, id] by filtering empty strings from split' });

test('GET /tasks with trailing slash returns 404 (does not match route)', async () => {
  const res = await api.request('GET', '/tasks/');
  assert.equal(res.status, 404);
}, { todo: 'bug: trailing slash matches route; router normalizes /tasks/ to [tasks] by filtering empty strings from split' });

// Unsupported methods on /tasks/:id

test('PUT /tasks/:id returns 405 method not allowed', async () => {
  const created = await api.request('POST', '/tasks', { body: { title: 'Test' } });
  const id = created.body.id;
  const res = await api.request('PUT', `/tasks/${id}`, { body: { status: 'done' } });
  assert.equal(res.status, 405);
  assert.ok(res.body.error);
});

test('POST /tasks/:id returns 405 method not allowed', async () => {
  const created = await api.request('POST', '/tasks', { body: { title: 'Test' } });
  const id = created.body.id;
  const res = await api.request('POST', `/tasks/${id}`, { body: { status: 'done' } });
  assert.equal(res.status, 405);
  assert.ok(res.body.error);
});

test('HEAD /tasks/:id returns 405 method not allowed', async () => {
  const created = await api.request('POST', '/tasks', { body: { title: 'Test' } });
  const id = created.body.id;
  const res = await api.request('HEAD', `/tasks/${id}`);
  assert.equal(res.status, 405);
});

test('OPTIONS /tasks/:id returns 405 method not allowed', async () => {
  const created = await api.request('POST', '/tasks', { body: { title: 'Test' } });
  const id = created.body.id;
  const res = await api.request('OPTIONS', `/tasks/${id}`);
  assert.equal(res.status, 405);
});

// Unsupported methods on /tasks (collection)

test('PUT /tasks returns 405 method not allowed', async () => {
  const res = await api.request('PUT', '/tasks', { body: { title: 'Test' } });
  assert.equal(res.status, 405);
  assert.ok(res.body.error);
});

test('DELETE /tasks returns 405 method not allowed', async () => {
  const res = await api.request('DELETE', '/tasks');
  assert.equal(res.status, 405);
  assert.ok(res.body.error);
});

test('PATCH /tasks returns 405 method not allowed', async () => {
  const res = await api.request('PATCH', '/tasks', { body: { status: 'done' } });
  assert.equal(res.status, 405);
  assert.ok(res.body.error);
});

// Combination: percent-encoded ID + unsupported method

test('PUT /tasks/:id with percent-encoded id returns 405 before checking id', async () => {
  const res = await api.request('PUT', '/tasks/does%20not%20exist', { body: { status: 'done' } });
  assert.equal(res.status, 405);
});

test('POST /tasks/:id with percent-encoded id returns 405 before checking id', async () => {
  const res = await api.request('POST', '/tasks/does%20not%20exist', { body: { title: 'Test' } });
  assert.equal(res.status, 405);
});

// Edge case: empty id segment

test('GET /tasks/ with double slash returns 404', async () => {
  const res = await api.request('GET', '/tasks//');
  assert.equal(res.status, 404);
}, { todo: 'bug: trailing slash matches route; router normalizes /tasks// to [tasks] by filtering empty strings from split' });

test('GET /tasks/:id where id is percent-encoded empty string returns 404', async () => {
  const res = await api.request('GET', '/tasks/%00');
  assert.equal(res.status, 404);
});
