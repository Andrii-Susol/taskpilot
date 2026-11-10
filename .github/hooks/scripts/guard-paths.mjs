#!/usr/bin/env node
// preToolUse hook: deterministic guardrail that blocks agent writes to governance paths.
// Input: JSON on stdin ({ toolName, toolArgs, cwd, ... }). toolArgs may be a JSON string.
// Output: {"permissionDecision":"allow"|"deny", "permissionDecisionReason": "..."} on stdout.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PROTECTED = ['.github/workflows/', '.github/agents/', '.github/hooks/', '.github/CODEOWNERS', 'SECURITY.md'];
const READ_ONLY_TOOLS = new Set(['view', 'read', 'glob', 'grep', 'search', 'ls']);
const SHELL_TOOLS = new Set(['bash', 'shell', 'powershell', 'execute']);
const SHELL_WRITE = /(^|[\s;&|])(rm|mv|cp|tee|truncate|chmod|chown|sed\s+-i|perl\s+-i)\b|>{1,2}|git\s+(rm|mv|checkout\s+--)/;
const DANGEROUS = [/git\s+push\s+.*--force/, /rm\s+-rf\s+\/(\s|$)/, /curl[^|]*\|\s*(ba)?sh/];

function strings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => strings(v, out));
  return out;
}
const norm = (s) => s.replaceAll('\\', '/').replace(/^\.\//, '');
const touchesProtected = (s) => PROTECTED.some((p) => norm(s).includes(p));

function decide({ toolName = '', toolArgs }) {
  const tool = String(toolName).toLowerCase();
  let args = toolArgs;
  if (typeof args === 'string') {
    try { args = JSON.parse(args); } catch { args = { raw: args }; }
  }
  const values = strings(args);

  if (SHELL_TOOLS.has(tool)) {
    const cmd = values.join(' ');
    if (DANGEROUS.some((re) => re.test(cmd))) return deny(`Dangerous command blocked: ${cmd.slice(0, 80)}`);
    if (touchesProtected(cmd) && SHELL_WRITE.test(cmd)) return deny('Shell write to a protected governance path');
    return allow();
  }
  if (READ_ONLY_TOOLS.has(tool)) return allow();
  // Any other tool (edit, create, write, str_replace, MCP tools...) is treated as a potential write.
  if (values.some(touchesProtected)) return deny(`Tool "${toolName}" may not modify protected governance paths`);
  return allow();
}

const allow = () => ({ permissionDecision: 'allow' });
const deny = (reason) => ({ permissionDecision: 'deny', permissionDecisionReason: `Refusal: ${reason}. See SECURITY.md.` });

function audit(input, decision) {
  try {
    const dir = join(input.cwd ?? process.cwd(), '.copilot-audit');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'tool-calls.jsonl'), JSON.stringify({
      ts: new Date().toISOString(), tool: input.toolName, decision: decision.permissionDecision,
      reason: decision.permissionDecisionReason,
    }) + '\n');
  } catch { /* auditing must never break the agent */ }
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw || '{}');
  } catch {
    // Fail closed: if we cannot understand the request, we do not allow it.
    process.stdout.write(JSON.stringify(deny('Unparseable hook payload')));
    return;
  }
  const decision = decide(input);
  audit(input, decision);
  process.stdout.write(JSON.stringify(decision));
});
