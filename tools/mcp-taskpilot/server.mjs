#!/usr/bin/env node
// TaskPilot MCP server - zero dependencies, stdio transport.
// Speaks newline-delimited JSON-RPC 2.0 on stdin/stdout (the MCP stdio transport).
// RULE: stdout is reserved for protocol messages. All logging goes to stderr.
import { createInterface } from 'node:readline';

const SERVER_INFO = { name: 'taskpilot', version: '0.1.0' };
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const BASE_URL = process.env.TASKPILOT_URL ?? 'http://localhost:3000';

const log = (...args) => console.error('[taskpilot-mcp]', ...args);

const TOOLS = {
  get_health: {
    description: 'Check whether the TaskPilot API is up. Read-only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: () => api('GET', '/health'),
  },
  list_tasks: {
    description: 'List TaskPilot tasks, optionally filtered by status. Read-only.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['todo', 'in-progress', 'done'] } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    run: ({ status } = {}) => api('GET', status ? `/tasks?status=${encodeURIComponent(status)}` : '/tasks'),
  },
  create_task: {
    description: 'Create a TaskPilot task. WRITE operation - changes server state.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 200 },
        status: { type: 'string', enum: ['todo', 'in-progress', 'done'] },
      },
      required: ['title'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
    run: ({ title, status }) => api('POST', '/tasks', { title, status }),
  },
};

async function api(method, path, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`TaskPilot API ${method} ${path} -> HTTP ${res.status}: ${text}`);
  return text || '{}';
}

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function fail(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function handle(msg) {
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined || id === null;
  log('<-', method);

  switch (method) {
    case 'initialize': {
      const requested = params.protocolVersion;
      const protocolVersion = SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0];
      return reply(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO });
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return; // notifications never get a response
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, {
        tools: Object.entries(TOOLS).map(([name, t]) => ({
          name,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: t.annotations,
        })),
      });
    case 'tools/call': {
      const tool = TOOLS[params.name];
      if (!tool) return fail(id, -32602, `Unknown tool: ${params.name}`);
      try {
        const text = await tool.run(params.arguments ?? {});
        return reply(id, { content: [{ type: 'text', text }] });
      } catch (err) {
        // Tool failures are reported as results with isError so the model can react.
        return reply(id, { content: [{ type: 'text', text: String(err.message) }], isError: true });
      }
    }
    default:
      if (!isNotification) fail(id, -32601, `Method not found: ${method}`);
  }
}

const pending = new Set();
const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return fail(null, -32700, 'Parse error');
  }
  const p = handle(msg)
    .catch((err) => fail(msg.id ?? null, -32603, err.message))
    .finally(() => pending.delete(p));
  pending.add(p);
});
// When the client closes stdin, finish in-flight calls, then exit.
rl.on('close', () => Promise.allSettled([...pending]).then(() => process.exit(0)));
log(`ready (TASKPILOT_URL=${BASE_URL})`);
