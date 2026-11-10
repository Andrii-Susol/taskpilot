// Unit tests for the preToolUse governance hook (Lab 6.1). Costs 0 AI credits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK = '.github/hooks/scripts/guard-paths.mjs';
const cwd = mkdtempSync(join(tmpdir(), 'guard-')); // keeps audit logs out of the repo

function decide(payload) {
  const input = typeof payload === 'string' ? payload : JSON.stringify({ cwd, ...payload });
  const out = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  return JSON.parse(out.stdout).permissionDecision;
}

test('allows edits to application source', () => {
  assert.equal(decide({ toolName: 'edit', toolArgs: JSON.stringify({ path: 'src/app.js' }) }), 'allow');
});

test('denies edits and creates in governance paths', () => {
  assert.equal(decide({ toolName: 'edit', toolArgs: JSON.stringify({ path: '.github/workflows/ci.yml' }) }), 'deny');
  assert.equal(decide({ toolName: 'create', toolArgs: { path: '/repo/.github/agents/x.agent.md' } }), 'deny');
  assert.equal(decide({ toolName: 'edit', toolArgs: { path: '.github\\CODEOWNERS' } }), 'deny');
});

test('allows reading governance files', () => {
  assert.equal(decide({ toolName: 'view', toolArgs: { path: '.github/CODEOWNERS' } }), 'allow');
  assert.equal(decide({ toolName: 'bash', toolArgs: JSON.stringify({ command: 'cat .github/CODEOWNERS' }) }), 'allow');
});

test('denies shell writes to governance paths and dangerous commands', () => {
  assert.equal(decide({ toolName: 'bash', toolArgs: JSON.stringify({ command: 'echo x >> .github/CODEOWNERS' }) }), 'deny');
  assert.equal(decide({ toolName: 'bash', toolArgs: JSON.stringify({ command: 'git push origin main --force' }) }), 'deny');
  assert.equal(decide({ toolName: 'bash', toolArgs: JSON.stringify({ command: 'npm test' }) }), 'allow');
});

test('fails closed on an unparseable payload', () => {
  assert.equal(decide('not json'), 'deny');
});
