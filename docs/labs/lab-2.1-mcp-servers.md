# Lab 2.1 — Configure Local (stdio) and Remote (HTTP) MCP Servers

> **Domain 2:** Select and configure tools and environment interactions · **Builds on:** Labs 00–1.3
> **Time:** 75 min · **AI credits:** ≤ 30
> **Adds:** `tools/mcp-taskpilot/server.mjs` (your own MCP server, zero dependencies), `.mcp.json`, `.vscode/mcp.json`

## What you'll learn

- What MCP actually is on the wire: **JSON-RPC 2.0** messages for `initialize`, `tools/list` and `tools/call`.
- **stdio transport:** the host spawns the server as a child process, so there's no network port and its lifecycle is tied to the host.
- **Streamable HTTP transport:** a remote, shared server with authentication headers. (Legacy HTTP+SSE still exists, but the MCP spec replaced it with Streamable HTTP.)
- **Where configuration lives**, and why secrets never go into committed config files.

| | stdio (local) | HTTP (remote) |
|---|---|---|
| Process | Child of the host (VS Code / CLI / cloud agent) | Independent web service |
| Typical use | Local tools, dev databases, internal scripts | SaaS context (GitHub, Notion, M365), central enterprise servers |
| Auth | Environment variables passed to the process | `Authorization` header / OAuth |
| Risk | **Runs arbitrary code on your machine** | Data leaves your machine; token scope matters |

### Where MCP config lives (verified, CLI v1.0.103)

| File | Read by | Top-level key |
|---|---|---|
| `.mcp.json` (repo root) | **Copilot CLI** + **VS Code** (portable format) | `mcpServers` |
| `.github/mcp.json` | Copilot CLI | `mcpServers` |
| `.vscode/mcp.json` | VS Code only (**not** read by the CLI) | `servers` |
| `~/.copilot/mcp-config.json` | Copilot CLI user config (written by `copilot mcp add`) | `mcpServers` |
| Repo **Settings → Copilot → Cloud agent → MCP configuration** | Copilot cloud agent | `mcpServers` |

> Workspace MCP servers load **only after you trust the folder**. A cloned repo can't silently start code on your machine.

---

## Step 0 — Start

```bash
cd taskpilot && source lab.env
git switch main && git pull && git switch -c lab/2.1-mcp
mkdir -p tools/mcp-taskpilot
```

## Step 1 — Write your own MCP server (no SDK, so you see the protocol)

Create **`tools/mcp-taskpilot/server.mjs`**. This code was tested against the official MCP SDK client (v1.32).

```js
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
```

Notice the security-relevant design choices: **tool annotations** (`readOnlyHint`) separate read tools from write tools, `inputSchema` uses `additionalProperties: false`, and every API call has a timeout.

## Step 2 — Speak MCP by hand (0 credits)

Run the handshake yourself. This is exactly what VS Code or the CLI sends:

```bash
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"me","version":"0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
 | node tools/mcp-taskpilot/server.mjs
```

You'll see two JSON responses on **stdout** (capability negotiation, then the tool catalog) and the log lines on **stderr**. Now call a tool against the running API:

```bash
npm start &                       # API on :3000
bash scripts/seed-tasks.sh; echo
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"me","version":"0"}}}' \
 '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_tasks","arguments":{"status":"todo"}}}' \
 | node tools/mcp-taskpilot/server.mjs 2>/dev/null | tail -1
```

> 🧪 **Break it on purpose:** add `console.log('debug')` at the top of `handle()` and rerun. The client receives a non-JSON line on stdout. Real hosts then fail the connection or drop messages. Remove the line afterwards. **Never write logs to stdout in a stdio MCP server.**

## Step 3 — Register the local server for VS Code *and* the CLI

Create **`.mcp.json`** at the repo root:

```json
{
  "mcpServers": {
    "taskpilot": {
      "type": "local",
      "command": "node",
      "args": ["tools/mcp-taskpilot/server.mjs"],
      "env": { "TASKPILOT_URL": "http://localhost:3000" },
      "tools": ["*"]
    }
  }
}
```

(`"type": "stdio"` is accepted as a synonym for `"local"`.)

Verify with **0 credits** (the folder must be trusted, which you did in Lab 1.1):

```bash
copilot mcp list                 # Workspace servers: taskpilot (local)
copilot mcp get taskpilot        # command, env (values masked), tools, source file
```

In **VS Code:** run **MCP: List Servers** from the Command Palette, then start `taskpilot`. Open **Output → MCP: taskpilot** and you'll see the `initialize` and `tools/list` exchange, plus your stderr log lines.

## Step 4 — Use the server from an agent (≤ 30 credits)

Keep the API running (`npm start &`). Then:

```bash
copilot --model "$LAB_MODEL" --max-ai-credits "$LAB_CAP"
```

```
/mcp                                     ← shows taskpilot connected with 3 tools
Use the taskpilot MCP server to list all tasks with status "todo" and summarise them in one line each.
```

Copilot asks permission before the first `taskpilot` tool call. Approve **once** for this tool only. Then:

```
Create a task titled "Verify MCP write tools" using the taskpilot server.
```

Note that this second call is a **write**. Decline it, and observe that the agent reports the denial. Run `/usage`, then `/exit`. Lab 2.2 makes this read/write split permanent with configuration.

## Step 5 — Add a remote HTTP MCP server (GitHub's hosted server)

GitHub's remote MCP server supports read-only, toolset-scoped URLs. You'll connect to the **issues toolset in read-only mode**:

`https://api.githubcopilot.com/mcp/x/issues/readonly`

> The Copilot CLI already has the GitHub MCP server built in. You're adding a *second, narrowly scoped* remote server to practice HTTP transport and header authentication.

### 5a — VS Code: secret prompted at runtime, never committed

Create **`.vscode/mcp.json`**:

```json
{
  "inputs": [
    {
      "id": "github_mcp_pat",
      "type": "promptString",
      "description": "Fine-grained PAT (Issues: read-only, this repo only)",
      "password": true
    }
  ],
  "servers": {
    "github-issues-ro": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/x/issues/readonly",
      "headers": { "Authorization": "Bearer ${input:github_mcp_pat}" }
    }
  }
}
```

VS Code prompts for the token the first time and keeps it in its **secret storage**. The committed file contains only a placeholder. (For GitHub specifically you could also drop `headers` and let VS Code use OAuth.)

### 5b — Copilot CLI: secret stored in your user config, outside the repo

1. Create a **fine-grained PAT** at github.com → Settings → Developer settings → Fine-grained tokens:
   - Repository access: **Only select repositories → taskpilot**
   - Permissions: **Issues: Read-only** (Metadata: read is added automatically)
   - Expiration: 7 days
2. Add the server, letting the shell expand the token so it never touches the repo:

```bash
read -rs GH_MCP_TOKEN && export GH_MCP_TOKEN        # paste the token; nothing is echoed
copilot mcp add --transport http github-issues-ro \
  https://api.githubcopilot.com/mcp/x/issues/readonly \
  --header "Authorization: Bearer $GH_MCP_TOKEN"
copilot mcp get github-issues-ro                    # Source: User (~/.copilot/mcp-config.json)
gh issue create --title "MCP smoke test" --body "Created to test the remote MCP server (Lab 2.1)."
```

3. Test it (a few credits):

```bash
copilot --model "$LAB_MODEL" --max-ai-credits 30 \
  -p "Using only the github-issues-ro MCP server, list open issues in $REPO with number and title." \
  --allow-tool 'github-issues-ro'
```

> ⚠️ The token now sits in plain text in `~/.copilot/mcp-config.json`. That's acceptable for a 7-day, read-only, single-repo token. Remove it at the end of Domain 2: `copilot mcp remove github-issues-ro`, then revoke the PAT.

## Step 6 — Commit (no secrets!)

```bash
kill %1 2>/dev/null
git add tools/mcp-taskpilot/server.mjs .mcp.json .vscode/mcp.json
git diff --cached | grep -iE "ghp_|github_pat_|bearer [a-z0-9]" && echo "STOP: secret found" || echo "clean"
git commit -m "feat(lab-2.1): TaskPilot stdio MCP server + workspace and remote MCP config"
git push -u origin HEAD && gh pr create --fill && gh pr checks --watch
gh pr merge --squash --delete-branch --admin      # touches code-owned paths
gh issue close "$(gh issue list --search 'MCP smoke test' --json number -q '.[0].number')"
```

Push protection (enabled in Lab 00) would also block a real token. Lab 6.3 demonstrates that.

---

## ✅ Verification checklist

- [ ] The manual `printf | node` handshake returned `initialize` and `tools/list` results on stdout, with logs on stderr.
- [ ] `copilot mcp list` shows **taskpilot** as a *workspace* server, and VS Code's MCP output shows the handshake.
- [ ] The agent called `list_tasks` after a permission prompt, and the `create_task` write was declined.
- [ ] The remote `github-issues-ro` server listed your issue. Its token lives only in VS Code secret storage and `~/.copilot`.
- [ ] Committed files contain no tokens.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `copilot mcp list` says "No MCP servers configured" | The folder isn't trusted (start `copilot` interactively once and trust it), or the file uses the `servers` key. The CLI needs `mcpServers`. |
| Server connects but tools fail with `ECONNREFUSED` | The TaskPilot API isn't running, or `TASKPILOT_URL` is wrong. |
| Connection drops right after start | Something printed to **stdout**. Move logging to stderr. |
| Remote server returns 401/403 | The PAT has expired, lacks Issues:read, or isn't scoped to this repo. |
| Works in VS Code but not the CLI | You only have `.vscode/mcp.json`. The CLI ignores it. Use `.mcp.json`. |

## 🧭 Exam notes

- **MCP secrets for the cloud agent:** use repository **Settings → Secrets and variables → Agents**. Names must start with **`COPILOT_MCP_`** to be passed to MCP servers. Cloud agent can't see Actions, Codespaces or Dependabot secrets. (The older "`copilot` environment" approach has been migrated to Agents secrets.)
- The cloud agent's MCP JSON (Settings → Copilot → Cloud agent) needs an explicit **`tools`** list per server. Use an allowlist, not `*`, for write-capable servers.
- **`${VARIABLE}` interpolation:** never hard-code tokens. Use VS Code `inputs`, user-level config, or Agents secrets.

**Next:** [Lab 2.2 — Restricting tools, allowlists, and ACP](lab-2.2-tool-restrictions-acp.md)
