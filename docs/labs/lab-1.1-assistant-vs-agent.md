# Lab 1.1 — Distinguish Assistant vs. Agent Behavior

> **Domain 1:** Prepare agent architecture and SDLC processes · **Builds on:** Lab 00
> **Time:** 45 min · **AI credits:** ≤ 30 (+ ≤ 30 for the optional SDK part)
> **Adds:** `.github/agents/proper-agent.agent.md`, `PROJECT_STRUCTURE.md`, `tools/sdk-observer/`

## What you'll learn

- The difference between a **request–response assistant** and a **closed-loop agent** (plan → tool → observe → update context → repeat).
- How a **custom agent profile** (`.agent.md`) defines an agent's role and its *tool allowlist*.
- How to run an agent with **least privilege** (a write permission scoped to a single file) and capture an audit transcript.
- *(Optional)* How the **Copilot SDK** drives the same CLI runtime over JSON-RPC and exposes `onPreToolUse` and `onPostToolUse` hooks for observability.

```
Passive assistant:  prompt ──► model ──► text/code suggestion   (you apply it)

Agent loop:         prompt ──► model ──► choose tool ──► execute ──► observe ──┐
                                 ▲                                             │
                                 └──────────── update context ◄────────────────┘
```

| | Passive assistant | Agent |
|---|---|---|
| Surfaces | Inline suggestions, Chat **Ask** mode | Chat **Agent** mode, **Copilot CLI**, **cloud agent**, Copilot in JetBrains AI Assistant |
| Acts on files? | No; you accept or paste | Yes, through tools (`read`, `edit`, `search`, `execute`, MCP tools) |
| Context | Open files, selection | Workspace, terminal output, tool results, MCP servers |
| Control | You decide every change | **Permissions** (prompts, allow/deny lists, hooks) plus **review gates** |
| Protocols | IDE extension APIs | **ACP** (editor ↔ agent, JSON-RPC over stdio); the **Copilot SDK** wraps the CLI runtime over JSON-RPC |

---

## Step 0 — Start the lab

```bash
cd taskpilot && source lab.env
git switch main && git pull && git switch -c lab/1.1-proper-agent
```

## Step 1 — Observe passive assistant behavior (≈ 0–2 credits)

1. In VS Code, open `src/store.js`. Below `remove(id) {...}`, start typing `count() {`. A grey **inline suggestion** appears; press `Esc` to reject it. Inline suggestions are unlimited on Pro and cost no AI credits.
2. Open **Copilot Chat**, switch the mode dropdown to **Ask**, choose your cheap model, and ask once:
   > *How should I document the directory structure of this repository?*
3. Notice that you get **advice**, and nothing changes on disk (`git status` is clean). That's the assistant pattern.

## Step 2 — Create the custom agent profile

Create **`.github/agents/proper-agent.agent.md`**:

```markdown
---
name: proper-agent
description: Proactive task-execution agent for repository maintenance, refactoring and documentation. Executes multi-step tasks with tools instead of giving advice.
tools: ["read", "search", "edit", "execute"]
---

# Role and execution directives

You are `proper-agent`, an active engineering agent operating inside a governed SDLC.
You do NOT behave like a passive chat assistant.

## Core behaviour rules
1. **Decompose, then act.** Break the request into steps and execute them without asking for
   confirmation unless a blocking ambiguity exists.
2. **Gather context yourself.** Use `search` and `read`; never ask the user to paste file contents.
3. **Edit directly, then verify.** Change files with `edit`. After editing, re-read the file or run
   `npm test` to confirm correctness.
4. **Action-oriented summaries.** Finish with: files changed, commands run, and their results.
   Never write "you could update this file by...". Do the work.
5. **Limits.** If a path or tool is unavailable or denied, state the exact limitation, the tool
   call you attempted, and the human escalation step. Do not try to work around a denial.
6. **Branch discipline.** Never commit to `main`. Never run `git push`.
```

> 🔧 **Corrections to the source guide**
> - The file must be named `*.agent.md` (or `.md`) and contain YAML front matter with a **required `description`**.
> - The real tool aliases are `read`, `edit`, `search`, `execute` (aliases `shell`/`bash`), `agent`, `web`, and `todo`. Names such as `file_search`, `read_file` and `edit_file` are *ignored* (unknown names are silently dropped), so the agent would end up with fewer tools than intended.
> - `limits: max_iterations` is **not** a supported property. Cap spending with `--max-ai-credits` instead.

## Step 3 — Confirm Copilot discovered the agent (0 credits)

```bash
copilot --model "$LAB_MODEL"
```

On first launch inside the repo, Copilot asks whether to **trust this folder**. Choose to trust it and remember the choice. Then run these commands, which don't call a model:

```
/agent          ← proper-agent should be listed
/env            ← shows loaded instructions, agents, skills, MCP servers, hooks
/exit
```

In VS Code, the Chat **agents dropdown** now lists **proper-agent** as well.

## Step 4 — Run the agent with least privilege and an audit trail (≤ 30 credits)

Use non-interactive mode so permissions are explicit and nothing prompts you. In `-p` mode, any tool you didn't allow is **denied**, so this is a least-privilege run:

```bash
mkdir -p .copilot-audit
copilot --agent proper-agent --model "$LAB_MODEL" --max-ai-credits "$LAB_CAP" \
  -p "Analyze the repository layout and create PROJECT_STRUCTURE.md documenting each top-level directory and key file and its architectural role. Keep it under 60 lines." \
  --allow-tool 'write(PROJECT_STRUCTURE.md)' \
  --share .copilot-audit/lab-1.1-session.md \
  --usage-output-file .copilot-audit/lab-1.1-usage.json
```

While it runs, map the output to the four agent phases:

| Phase | What you see |
|---|---|
| Prompt processing | Custom agent instructions + your prompt are loaded |
| Model analysis | The agent states its plan |
| Tool execution | Calls such as `glob`/`view`/`grep` (read), then `create`/`edit` on `PROJECT_STRUCTURE.md` |
| Output and summary | Files changed and a summary, plus a usage line |

Then inspect the evidence:

```bash
git status                                  # only PROJECT_STRUCTURE.md is new
head -40 PROJECT_STRUCTURE.md
grep -nE "view|glob|grep|create|edit" .copilot-audit/lab-1.1-session.md | head -20   # tool calls
cat .copilot-audit/lab-1.1-usage.json       # AI credits / tokens actually used
```

Add a row to `docs/metrics/credit-log.md` with the credits used.

> 💡 **Interactive alternative:** run `copilot --agent proper-agent --max-ai-credits 30` and paste the same prompt. Copilot pauses with a **permission prompt** before writing (approve once). Interactive mode puts a human in the loop at the tool level.

## Step 5 — Least privilege in action (≤ 30 credits, optional)

Re-run with a prompt that tries to edit a second file, but keep the same single-file allowance:

```bash
copilot --agent proper-agent --model "$LAB_MODEL" --max-ai-credits 30 \
  -p "Also add a 'Project structure' link to README.md pointing to PROJECT_STRUCTURE.md." \
  --allow-tool 'write(PROJECT_STRUCTURE.md)'
git diff --stat README.md       # expect: no change. The write to README.md was denied.
```

The agent should report the denial, as Rule 5 in its profile requires. **A permission denial isn't a failure. It's the boundary doing its job.** Add the README link yourself.

## Step 6 (Optional) — Programmatic observability with the Copilot SDK (≤ 30 credits)

The SDK (`@github/copilot-sdk`, public preview) spawns the same Copilot CLI runtime and talks to it over **JSON-RPC**. Hooks let your code see, and veto, every tool call.

```bash
mkdir -p tools/sdk-observer && cd tools/sdk-observer
npm init -y >/dev/null && npm pkg set type=module && npm install @github/copilot-sdk
cd ../..
```

Make sure `.gitignore` already contains `node_modules/` (it does from Lab 00). Then create **`tools/sdk-observer/observe.mjs`**:

```js
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
```

```bash
node tools/sdk-observer/observe.mjs
cat .copilot-audit/sdk-trace.jsonl      # every tool call, its arguments and the hook's decision
```

> The SDK is in public preview, so field names can change. If `toolName` is undefined, log the whole `input` object once to see the current shape. Lab 4.2 reuses this tracer.

## Step 7 — Commit and ship

```bash
npm test
git add .github/agents/proper-agent.agent.md PROJECT_STRUCTURE.md README.md docs/metrics tools/sdk-observer/observe.mjs tools/sdk-observer/package*.json
git commit -m "feat(lab-1.1): proper-agent profile and agent-generated project structure doc"
git push -u origin HEAD && gh pr create --fill && gh pr checks --watch && gh pr merge --squash --delete-branch
```

---

## ✅ Verification checklist

- [ ] `/agent` (CLI) and the VS Code agents dropdown both list `proper-agent`.
- [ ] `PROJECT_STRUCTURE.md` was created **by the agent**, and the session transcript shows the tool calls.
- [ ] The README edit was **denied** under the single-file write allowance.
- [ ] The work happened on a `lab/*` branch and reached `main` only through a PR with green CI.
- [ ] *(If you set up signing)* your commit shows **Verified** on GitHub.
- [ ] Credits used are logged in `docs/metrics/credit-log.md`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/agent` doesn't list the agent | Wrong filename or extension, missing `description`, or invalid YAML front matter (check the indentation). The folder must be trusted. |
| Agent edits nothing and says permission denied | Expected in `-p` mode for tools that aren't allowed. Add a scoped `--allow-tool 'write(<file>)'`. |
| `Invalid value for --max-ai-credits` | The minimum is **30**. |
| `--share` file missing | It's written only after a non-interactive run completes. Check the path. |

## 🧭 Exam notes

- **Signed commits, `Co-authored-by`, and the session-log link in the commit message** are guarantees of **Copilot cloud agent** commits. You'll inspect them in Lab 3.2. Local CLI work is attributed to *your* commits (sign them yourself).
- **ACP** (Agent Client Protocol, from Zed and JetBrains) standardizes how an editor talks to an agent: capability discovery, sessions, streaming updates, and permission requests. `copilot --acp` turns the CLI into an ACP server. You'll call it directly in Lab 2.2.
- In JetBrains IDEs, Copilot appears **natively in the AI Assistant agent picker**. No `acp-registry.json` edits are needed.

**Next:** [Lab 1.2 — Scoped SDLC boundaries](lab-1.2-scoped-boundaries.md)
