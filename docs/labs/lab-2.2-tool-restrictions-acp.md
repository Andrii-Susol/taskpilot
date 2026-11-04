# Lab 2.2 — Restrict Tool Namespaces, Allowlists, and ACP Integration

> **Domain 2** · **Builds on:** Lab 2.1 · **Time:** 60 min · **AI credits:** ≤ 60
> **Adds:** a narrowed `.mcp.json`, `.vscode/settings.json`, `.github/agents/ops-observer.agent.md`, `tools/acp-probe.mjs`, `docs/security/tool-policy.md`

## What you'll learn

Least-privilege tool access works at five layers. You'll configure each one and test it:

| # | Layer | Mechanism | Scope |
|---|---|---|---|
| 1 | **Server exposure** | `"tools": [...]` per server in `.mcp.json` | What a server even offers |
| 2 | **Agent profile** | `tools:` in `.agent.md` (incl. `server/tool` names) | What one agent can see |
| 3 | **Session permissions** | CLI `--allow-tool` / `--deny-tool` / `--available-tools`; VS Code approvals | One run |
| 4 | **IDE policy** | VS Code `chat.tools.terminal.autoApprove`, `chat.mcp.access` | One machine or the org |
| 5 | **Enterprise** | MCP registry and allowlist policies (Business/Enterprise only) | The whole organization |

> 🔧 **Corrections to the source guide:** the settings `github.copilot.mcp.allowlist` and `github.copilot.tools.permissions`, the file `.vscode/content-exclusion.json`, and `acp-registry.json` **don't exist**. The flag is `copilot --acp`, not `--acp-server`. *Content exclusion* is a Business/Enterprise feature configured on GitHub.com, so it's not available on Copilot Pro. This lab uses the real mechanisms.

---

## Step 0 — Start

```bash
cd taskpilot && source lab.env
git switch main && git pull && git switch -c lab/2.2-tool-restrictions
```

## Part A — Restrict at the server (layer 1, 0 credits)

Edit **`.mcp.json`** so the workspace server exposes only the read tools:

```json
{
  "mcpServers": {
    "taskpilot": {
      "type": "local",
      "command": "node",
      "args": ["tools/mcp-taskpilot/server.mjs"],
      "env": { "TASKPILOT_URL": "http://localhost:3000" },
      "tools": ["get_health", "list_tasks"]
    }
  }
}
```

```bash
copilot mcp get taskpilot      # Tools: get_health, list_tasks. create_task is no longer exposed.
```

The server still *implements* `create_task`, but no agent session using this config can see it. This is the cheapest and strongest control.

## Part B — Restrict per agent (layer 2)

Create **`.github/agents/ops-observer.agent.md`**, a read-only operations agent that can use exactly two MCP tools:

```markdown
---
name: ops-observer
description: Read-only operations observer. Checks TaskPilot health and task data through the taskpilot MCP server and reports findings. Never changes code or data.
tools: ["read", "search", "taskpilot/get_health", "taskpilot/list_tasks"]
---

You are `ops-observer`. Report on the running TaskPilot service using only your tools.
- Use `taskpilot/get_health` first; if it fails, report the outage and stop.
- Summarise tasks by status in a small Markdown table.
- You cannot edit files, run commands or create tasks. If asked to, say so and suggest which
  agent or human should act.
```

MCP tools are namespaced as `server-name/tool-name`. `server-name/*` would allow all of that server's tools.

## Part C — Session permissions test matrix (layer 3, ≤ 30 credits)

Start the API, then run **one** interactive session with explicit deny rules. One session shares context across all three tests, which is cheaper than three `-p` runs:

```bash
npm start &
copilot --model "$LAB_MODEL" --max-ai-credits "$LAB_CAP" \
  --deny-tool 'shell(rm)' --deny-tool 'shell(git push)' \
  --deny-tool 'write(.github/workflows/ci.yml)' \
  --allow-tool 'taskpilot(list_tasks)'
```

Run these prompts in order and record the results in **`docs/security/tool-policy.md`** (template below):

| ID | Prompt | Expected result | Enforced by |
|---|---|---|---|
| TC-01 | `Use the taskpilot server to list tasks with status todo.` | **Permitted** without a prompt (pre-allowed) | Layer 3 allow |
| TC-02 | `Run the terminal command: rm -rf /tmp/taskpilot-build` | **Blocked.** The tool call is denied; no prompt is shown | Layer 3 deny |
| TC-03 | `Use the taskpilot server to create a task called "should fail".` | **Not possible.** The agent reports there's no such tool | Layer 1 exposure |
| TC-04 | `Add a comment line to .github/workflows/ci.yml` | **Blocked** write | Layer 3 deny (layers 4–6 come later) |
| TC-05 | `/allow-all`, then repeat TC-02 | **Still blocked.** Deny rules beat allow-all | Precedence rule |

Then run `/usage` and `/exit`. Check `git status` (no workflow change) and `ls /tmp/taskpilot-build 2>&1`.

Now test the agent profile (layer 2):

```bash
copilot --agent ops-observer --model "$LAB_MODEL" --max-ai-credits 30 \
  -p "Check TaskPilot health and give me a status summary of all tasks. Then create a new task called 'test'." \
  --allow-tool 'taskpilot'
```

Expect a health check and a summary table, followed by a refusal for the create request. The tool simply isn't in the agent's allowlist.

**`docs/security/tool-policy.md`** template:

```markdown
# Tool access policy and test evidence

| Layer | Control | Location |
|---|---|---|
| 1 | taskpilot exposes read tools only | `.mcp.json` |
| 2 | ops-observer: read/search + 2 MCP tools | `.github/agents/ops-observer.agent.md` |
| 3 | deny `shell(rm)`, `shell(git push)`, writes to CI | CLI flags (see `run-agent.sh`, Lab 4.3) |
| 4 | terminal auto-approve rules, MCP access | `.vscode/settings.json` |

## Test results (YYYY-MM-DD, model: ...)
| ID | Expected | Observed | Pass? |
|---|---|---|---|
| TC-01 | permitted | | |
| TC-02 | blocked | | |
| TC-03 | tool unavailable | | |
| TC-04 | blocked | | |
| TC-05 | still blocked under /allow-all | | |
```

## Part D — VS Code policy (layer 4, 0 credits)

Create **`.vscode/settings.json`**:

```jsonc
{
  // Terminal commands the agent may run WITHOUT asking (true) or must ALWAYS ask for (false).
  // Keys are command prefixes or /regex/. Anything not listed still prompts.
  "chat.tools.terminal.autoApprove": {
    "npm test": true,
    "/^git (status|diff|log)\\b/": true,
    "rm": false,
    "git push": false,
    "curl": false
  },
  // Which MCP servers VS Code may use: "all" | "registry" (only servers in the configured registry) | "none"
  "chat.mcp.access": "all",
  // NEVER enable this one - it disables tool approval entirely:
  // "chat.tools.global.autoApprove": true
}
```

In VS Code Chat (Agent mode):

1. Click the **tools icon**, expand **taskpilot**, and notice that only two tools are listed (layer 1 at work).
2. Select **ops-observer** in the agents dropdown. Its tool picker is locked to the profile's list (layer 2).
3. Ask the default agent to `run git status`. It runs without a prompt (auto-approved). Then ask it to `run rm -rf /tmp/x`. It **asks** first, because the command is set to `false`.

> 🏢 **Enterprise context (exam):** in Business/Enterprise, admins set *MCP servers in Copilot* policies plus an **MCP registry URL**. With `chat.mcp.access: "registry"`, only servers in that registry can start. A personal account can't configure org policies, so learn the concept and its effect.

## Part E — ACP: talk to Copilot the way JetBrains does (0 credits for the handshake)

**ACP** (Agent Client Protocol) is JSON-RPC over stdio between an *editor* (client) and an *agent* (server). `copilot --acp` turns the CLI into an ACP agent. The client sends `initialize` and then `session/new`. The agent streams `session/update` notifications and asks the **client** for permission (`session/request_permission`) before running tools. The permission decision belongs to the client, not the agent.

Create **`tools/acp-probe.mjs`**:

```js
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
```

```bash
node tools/acp-probe.mjs
```

Read the `initialize` result: `agentCapabilities` (`loadSession`, `mcpCapabilities.http/sse`, `promptCapabilities.image`), `agentInfo` (Copilot and its version), and `authMethods`. This is the **capability discovery** the source guide describes. `session/new` returns a `sessionId`. Neither call uses a model.

Optional (a few credits): make the agent want a tool, and watch your client deny it:

```bash
node tools/acp-probe.mjs --prompt "Create a file named acp-test.txt containing hello."
ls acp-test.txt 2>&1      # "No such file" because the client rejected the permission request
```

### JetBrains (optional)

- In a 2025.3+ IDE with the AI Assistant plugin, open AI chat, select **GitHub Copilot** in the **agent picker**, and sign in with GitHub OAuth. It's included with your Copilot subscription; no JetBrains AI subscription is needed for ACP agents.
- **Settings | Tools | AI Assistant | Agents** lists ACP agents. You can install others from the ACP Registry ("Install From ACP Registry…").
- Tool permissions are still enforced by the Copilot runtime (approval prompts in the chat), and the repo's `.mcp.json`, agents and instructions still apply.

## Part F — Commit

```bash
kill %1 2>/dev/null
git add .mcp.json .vscode/settings.json .github/agents/ops-observer.agent.md tools/acp-probe.mjs docs/security/tool-policy.md
git commit -m "feat(lab-2.2): least-privilege tool exposure, ops-observer agent, VS Code policy, ACP probe"
git push -u origin HEAD && gh pr create --fill && gh pr checks --watch && gh pr merge --squash --delete-branch --admin
```

---

## ✅ Verification checklist

- [ ] `copilot mcp get taskpilot` lists exactly two tools.
- [ ] TC-01…TC-05 are recorded, with TC-05 proving that **deny beats allow-all**.
- [ ] `ops-observer` produced a summary and refused to create a task.
- [ ] In VS Code, `rm` always prompts and `git status` doesn't.
- [ ] The ACP probe printed `initialize` capabilities and a `sessionId`, and an optional tool request was rejected by the client.

## Troubleshooting

| Symptom | Fix |
|---|---|
| TC-02 shows a prompt instead of a silent deny | You're in a different session from the one with `--deny-tool`. Restart with the flags. |
| `ops-observer` can't see the MCP tools | The tool names must match `server/tool` exactly, the server must be running, and the folder must be trusted. |
| `session/new` → "Authentication required" | Run `copilot login` (or `/login`) first. |
| On Windows, `spawn copilot ENOENT` | The probe already sets `shell: true` on Windows. Make sure `copilot` is on your PATH in Git Bash. |

## 🧭 Exam notes

- **ACP Registry** = *discovery* of agent binaries. **Tool restrictions** come from the agent runtime's permissions, the agent profile, and policies, not from the registry entry.
- Plugin vs. agent vs. CLI in JetBrains:
  - The **Copilot plugin** gives the full editor experience (completions, NES, inline chat, code review).
  - The **Copilot agent in AI Assistant** is chat-centric, ACP-based, and bundled.
  - **Copilot CLI** is terminal-first, and its runtime powers the agent experiences.
- Precedence: **deny > allow**, even with `--allow-all` or `--yolo`. `--available-tools` / `--excluded-tools` control what the model *sees*; allow and deny control what it may *run*.

**Next:** [Lab 2.3 — GitHub Agentic Workflows with safe outputs](lab-2.3-agentic-workflows.md)
