// Read-only observer session: logs every tool call through SDK hooks and denies anything
// that is not a read. Usage: node tools/sdk-observer/observe.mjs "your prompt"
import { CopilotClient } from '@github/copilot-sdk';
import { appendFileSync, mkdirSync } from 'node:fs';

const prompt = process.argv[2] ?? 'Explain in 3 sentences how src/router.js matches routes.';
const model = process.env.LAB_MODEL && process.env.LAB_MODEL !== 'auto' ? process.env.LAB_MODEL : undefined;
mkdirSync('.copilot-audit', { recursive: true });
const trace = (entry) =>
  appendFileSync('.copilot-audit/sdk-trace.jsonl', JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');

const READ_ONLY = /^(view|read|glob|grep|search|ls)/i;
const client = new CopilotClient();
const session = await client.createSession({
  model,
  hooks: {
    onPreToolUse: async (input) => {
      const allowed = READ_ONLY.test(input.toolName);
      trace({ phase: 'pre', tool: input.toolName, args: input.toolArgs, decision: allowed ? 'allow' : 'deny' });
      return allowed
        ? { permissionDecision: 'allow' }
        : { permissionDecision: 'deny', permissionDecisionReason: 'Observer sessions are read-only' };
    },
    onPostToolUse: async (input) => {
      trace({ phase: 'post', tool: input.toolName, result: input.toolResult?.resultType });
    },
  },
});

const reply = await session.sendAndWait({ prompt });
console.log(reply?.data?.content ?? reply);
await session.disconnect();
await client.stop();
