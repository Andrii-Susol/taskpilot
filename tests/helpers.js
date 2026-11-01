// Test helper: starts the app on a random port and returns a tiny client.
import http from 'node:http';
import { createApp } from '../src/app.js';

export async function startTestServer(options) {
  const server = http.createServer(createApp(options));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  async function request(method, path, { body, raw, headers = {} } = {}) {
    const init = { method, headers: { ...headers } };
    if (raw !== undefined) {
      init.body = raw;
      init.headers['content-type'] = 'application/json';
    } else if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers['content-type'] = 'application/json';
    }
    const res = await fetch(base + path, init);
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  }

  return { request, close: () => new Promise((resolve) => server.close(resolve)) };
}
