#!/usr/bin/env node
// ACP probe: talks to `copilot --acp` over stdio using JSON-RPC 2.0 (newline-delimited),
// the same way JetBrains AI Assistant or Zed do. Costs 0 AI credits unless you pass --prompt.
// Usage: node tools/acp-probe.mjs            -> initialize + session/new
//        node tools/acp-probe.mjs --prompt "Explain src/router.js in 2 sentences"
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const promptIdx = process.argv.indexOf('--prompt');
const promptText = promptIdx > -1 ? process.argv[promptIdx + 1] : null;

const agent = spawn('copilot', ['--acp'], { stdio: ['pipe', 'pipe', 'inherit'], shell: process.platform === 'win32' });
const pending = new Map();
let nextId = 0;

function request(method, params) {
  const id = nextId++;
  console.log('\n>>> client ->', method);
  agent.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

createInterface({ input: agent.stdout }).on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.id !== undefined && pending.has(msg.id) && !msg.method) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    return msg.error ? reject(msg.error) : resolve(msg.result);
  }
  if (msg.method === 'session/update') {
    const u = msg.params?.update ?? {};
    if (u.sessionUpdate === 'agent_message_chunk') process.stdout.write(u.content?.text ?? '');
    else console.log(`\n<<< update [${u.sessionUpdate}]`, u.title ?? u.status ?? '');
    return;
  }
  if (msg.method === 'session/request_permission') {
    // The agent asks the CLIENT before running a tool. This probe always rejects.
    console.log('\n<<< permission request:', msg.params?.toolCall?.title ?? '(tool call)');
    const reject = msg.params?.options?.find((o) => o.kind?.startsWith('reject')) ?? msg.params?.options?.[0];
    agent.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: msg.id,
      result: { outcome: { outcome: 'selected', optionId: reject?.optionId } } }) + '\n');
    return;
  }
  console.log('<<< agent message:', line.slice(0, 200));
});

try {
  const init = await request('initialize', {
    protocolVersion: 1,
    clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
    clientInfo: { name: 'taskpilot-acp-probe', version: '0.1.0' },
  });
  console.log('<<< initialize result:', JSON.stringify(init, null, 2));

  const session = await request('session/new', { cwd: process.cwd(), mcpServers: [] });
  console.log('<<< session/new result:', JSON.stringify(session));

  if (promptText) {
    const result = await request('session/prompt', {
      sessionId: session.sessionId,
      prompt: [{ type: 'text', text: promptText }],
    });
    console.log('\n<<< session/prompt result:', JSON.stringify(result));
  }
} catch (err) {
  console.error('ACP error:', JSON.stringify(err));
  process.exitCode = 1;
} finally {
  agent.kill();
}
