# Autonomy levels — TaskPilot

| Level | Description | Surface in this repo | Default permissions | Human gate |
|---|---|---|---|---|
| L0 | Human only; AI off | — | — | — |
| L1 | Suggestions; human applies | Inline suggestions, Chat **Ask** | No tools | Every change |
| L2 | Agent acts, human approves each tool call | CLI interactive, VS Code Agent mode | Permission prompts | Every write/command |
| L3 | Agent acts within a pre-approved allowlist | `copilot -p` with `--allow-tool`, `run-agent.sh` in Actions | Scoped allow/deny + caps + hooks | PR review |
| L4 | Autonomous task to PR in an isolated env | Copilot cloud agent, gh-aw (safe outputs) | Own branch / read-only + safe outputs | Approve workflows, code owners, merge |
| L5 | Autonomous through to merge | Auto-merge in `src/experimental/` only | CI-only rules | None (CI + rollback) |

## Policy
- Governance paths: max **L2** with explicit human approval — and the hook denies agents anyway.
- Production deploys: never above L3; environment approval required (Lab 6.2).
- L5 is allowed **only** in the ownership-reset sandbox and must be revertible (Lab 5.3).
