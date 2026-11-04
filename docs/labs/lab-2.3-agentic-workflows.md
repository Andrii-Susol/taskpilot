# Lab 2.3 — GitHub Agentic Workflows (gh-aw) with Safe Outputs and Least Privilege

> **Domain 2** · **Builds on:** Labs 1.2, 2.1 · **Time:** 75 min · **AI credits:** 2 workflow runs (each run = agent + threat-detection model calls)
> **Adds:** `.github/workflows/maintainer-report.md` + compiled `.lock.yml`, Actions secret `COPILOT_GITHUB_TOKEN`

## What you'll learn

| | Raw coding-agent CLI in a YAML job | **GitHub Agentic Workflow** |
|---|---|---|
| Source | Hand-written `.yml` | **Markdown** (`.md`) with YAML front matter, compiled to `.lock.yml` |
| Agent permissions | Whatever the job token allows (often `contents: write`) | **Read-only** by default |
| Writes to GitHub | Agent pushes or calls the API directly | Agent emits **safe outputs** (structured requests). A *separate* job with scoped permissions performs them |
| Guardrails | Whatever you build | Network firewall, tool allowlist, **threat detection** on outputs, output limits (`max`) |
| Review | Easy to auto-push | PRs are never auto-merged and go through your rulesets and CODEOWNERS |

> 🔧 **Corrections to the source guide:** there is no `*.gh-aw.yml` format, no `github/agentic-workflows/safe-outputs@v1` action, and no `--output` flag. You write `.github/workflows/<name>.md`, run `gh aw compile`, and commit **both** the `.md` and the generated `<name>.lock.yml`. GitHub Actions executes the lock file.

---

## Step 0 — Start and install the extension

```bash
cd taskpilot && source lab.env
git switch main && git pull && git switch -c lab/2.3-agentic-workflows
gh extension install github/gh-aw
gh aw version
```

## Step 1 — Create the Copilot token secret

A **personal** repository authenticates the Copilot engine with a fine-grained PAT stored as `COPILOT_GITHUB_TOKEN`. (Organization repos can instead grant `copilot-requests: write`, which bills the organization.)

1. github.com → **Settings → Developer settings → Fine-grained tokens → Generate new token**
   - Name: `taskpilot-copilot-actions` · Expiration: **30 days**
   - Repository access: **Public repositories** (read-only). The agent's repo access comes from the workflow, not from this token.
   - **Account permissions → Copilot Requests: Read**. Nothing else.
2. Store it as a repository secret:

```bash
read -rs PAT && gh aw secrets set COPILOT_GITHUB_TOKEN --value "$PAT" && unset PAT
gh secret list           # COPILOT_GITHUB_TOKEN
```

> 💳 AI credits used by any workflow with this secret are billed to **you**, the token owner. Labs 4.3, 5.2 and 6.1 reuse the secret, always with `workflow_dispatch` (manual) triggers. Never schedule agent workflows during the course.

## Step 2 — Allow Actions to *create* pull requests

**Settings → Actions → General → Workflow permissions → ☑ Allow GitHub Actions to create and approve pull requests.**

The safe-output job needs this to open a PR with `GITHUB_TOKEN`. The setting also lets workflows *approve* PRs. That risk is contained here because `main-review-gates` requires a **code owner** approval, and the Actions bot is not a code owner. Write that reasoning down; it's a classic exam scenario.

## Step 3 — Author the workflow

Create **`.github/workflows/maintainer-report.md`**:

```markdown
---
description: Read-only maintainer report for TaskPilot, delivered as an issue plus a docs PR
on:
  workflow_dispatch:
  # schedule: daily        # keep disabled during the course to save AI credits
permissions:
  contents: read
  issues: read
  pull-requests: read
timeout-minutes: 10
# engine: copilot          # default; optional object form:
# engine:
#   id: copilot
#   model: <your LAB_MODEL id>
tools:
  github:
safe-outputs:
  create-issue:
    title-prefix: "[maintainer-report] "
    labels: [report]
    max: 1
  create-pull-request:
    title-prefix: "docs(report): "
    labels: [report, automated]
    draft: true
    max: 1
---

# TaskPilot maintainer report

You are a maintainer assistant for this repository. You have READ-ONLY access.

1. Review the last 14 days of activity: merged pull requests, open pull requests, open issues,
   and recent commits on the default branch.
2. Read `docs/labs/` file names only to infer which lab the project has reached.
3. Produce a concise report with these sections:
   - **Shipped**: merged PRs (number, title).
   - **In flight**: open PRs and issues, each with a one-line risk note.
   - **Governance**: whether changes touched `.github/` or other code-owned paths.
   - **Suggested next steps**: at most 3 bullets.
4. Create ONE issue containing the report.
5. Create ONE draft pull request that adds the same report as `docs/reports/maintainer-report.md`
   (replace the file if it exists). Do not modify any other file.

If there is nothing to report, create the issue saying so and skip the pull request.
```

## Step 4 — Compile and inspect the lock file (0 credits)

```bash
gh aw compile                      # compiles every .github/workflows/*.md
ls .github/workflows/ | grep maintainer      # maintainer-report.md + maintainer-report.lock.yml
```

Inspect the security model in the generated YAML:

```bash
grep -nE "^  [a-z_]+:$" .github/workflows/maintainer-report.lock.yml | head -20   # job names
grep -n -A6 "permissions:" .github/workflows/maintainer-report.lock.yml | head -60
```

You should find:

- An **agent** job with **read** permissions only.
- A **detection** job that scans the agent's proposed outputs for threats such as prompt-injection fallout or secret leakage.
- Separate **safe-output** jobs (create issue / create PR) that alone hold `issues: write` / `contents: write` / `pull-requests: write`.

Optionally validate in strict mode: `gh aw compile --strict`.

> Rule: **every time you edit the `.md`, recompile and commit the new `.lock.yml`.** A stale lock file is the #1 gh-aw bug, and `gh aw compile` tells you when they differ.

## Step 5 — Merge, then run

`workflow_dispatch` workflows can only be run once they exist on the default branch.

```bash
git add .github/workflows/maintainer-report.md .github/workflows/maintainer-report.lock.yml
git commit -m "feat(lab-2.3): read-only maintainer-report agentic workflow with safe outputs"
git push -u origin HEAD && gh pr create --fill && gh pr checks --watch
gh pr merge --squash --delete-branch --admin            # .github/workflows is code-owned
git switch main && git pull

gh label create report --color 0E8A16 --force          # labels used by the safe outputs
gh label create automated --color BFD4F2 --force
gh aw run maintainer-report
gh run watch                                            # or: gh aw status
```

## Step 6 — Audit the run

```bash
gh aw logs maintainer-report          # downloads and summarises recent runs (tool calls, tokens, duration)
RUN_ID=$(gh run list --workflow maintainer-report.lock.yml -L1 --json databaseId -q '.[0].databaseId')
gh aw audit "$RUN_ID"                 # prompts, tool calls, safe outputs, firewall decisions
```

In the Actions UI, walk through the jobs: **activation → agent → detection → safe outputs**. Then check the results:

```bash
gh issue list --label report
gh pr list --label report
```

## Step 7 — Observe the `GITHUB_TOKEN` loop safeguard (live)

Open the draft PR the workflow created. You'll notice that **CI (`test`) never started**. Events created with the default `GITHUB_TOKEN` don't trigger other workflows, which is what prevents infinite agent loops. As a result, `main-baseline`'s required check stays *Expected — waiting*.

As the human reviewer:

1. Read the diff. It should touch only `docs/reports/maintainer-report.md`.
2. Click **Ready for review**, then trigger CI as a human by closing and reopening the PR (`gh pr close <n> && gh pr reopen <n>`) or by pushing an empty commit to its branch.
3. When CI is green, merge with the admin bypass (the file is code-owned by `*`). Or close it if the report is wrong. Both outcomes are human decisions.

## Step 8 — (Concept) Why not just run the CLI in YAML?

This is the pattern the source guide used, and Labs 4.3 and 5.2 will use it *carefully*:

```yaml
permissions:
  contents: write           # ← the agent can push anything the token can
steps:
  - uses: actions/checkout@v5            # token persisted in .git/config by default
  - run: copilot -p "Refactor and push" --allow-all
```

When you run a CLI in plain Actions, *you* own every guardrail: `permissions: contents: read`, `persist-credentials: false`, tool allow and deny flags, credit caps, and a separate write job. gh-aw generates those for you.

---

## ✅ Verification checklist

- [ ] Both `maintainer-report.md` and `maintainer-report.lock.yml` are committed, and `gh aw compile` reports no changes.
- [ ] The lock file shows a **read-only agent job** and separate write-scoped safe-output jobs.
- [ ] The run created **one** issue and **one** draft PR, and nothing else changed in the repo.
- [ ] CI didn't start automatically on the bot PR, and you know why.
- [ ] The PR went through CI and code-owner governance before any merge.
- [ ] Credits are logged in `docs/metrics/credit-log.md` (check **Billing → Usage** after the run).

## Troubleshooting (gh-aw failure decision tree)

| Category | Symptom | Fix |
|---|---|---|
| **Tool misuse / config** | `403 Resource not accessible by personal access token` | The PAT is missing **Copilot Requests: Read**, or has expired. Re-set the secret. |
| | "Workflow not found" on `gh aw run` | It isn't on the default branch yet, or the lock file wasn't committed. |
| | Lock file out of date | Run `gh aw compile`, then commit both files. |
| | Safe-output job fails creating the PR | Step 2's setting is off. |
| **Reasoning** | Report misses merged PRs or invents some | Tighten the instructions (explicit time window, required fields). Lab 4.3 covers tuning. |
| **Context** | Agent reports stale state | gh-aw reads live GitHub data via the `github` tool; check the time window in your prompt. |
| **Network** | Firewall blocked a domain | Add only what's needed under `network:` in the front matter, then recompile. |

## 🧭 Exam notes

- Agentic workflows **default to read-only** and write **only via declared safe outputs** with limits (`max`, `title-prefix`, `labels`, `draft`).
- `gh aw compile` → `.lock.yml` is what Actions executes. Review the lock file in PRs, because it's the real security surface.
- Agent PRs are **never auto-merged**. Human and code-owner gates still apply.
- **`GITHUB_TOKEN` events don't trigger workflows.** Use a GitHub App token deliberately (with loop guards) if you really need chaining.

**Next:** [Lab 3.1 — Repo-level memory vs. session context](lab-3.1-repo-memory.md)
