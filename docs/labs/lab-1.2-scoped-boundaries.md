# Lab 1.2 — Enforce Scoped SDLC Boundaries

> **Domain 1** · **Builds on:** Labs 00–1.1 · **Time:** 60 min · **AI credits:** ≤ 30 (≤ 60 with the re-run)
> **Adds:** `.github/agents/implementation-only.agent.md`, `.github/CODEOWNERS`, `tests/error-handling.test.js`, ruleset `main-review-gates`
> **Fixes:** the planted JSON-parsing bug in `src/app.js`

## What you'll learn

Defense in depth for agent boundaries, from weakest to strongest:

| Layer | Example in this lab | Strength |
|---|---|---|
| 1. Prompt rules | "Never edit `.github/workflows/`" in the agent profile | **Soft.** The model usually complies, but not always. |
| 2. Tool permissions | `--deny-tool 'write(.github/workflows/ci.yml)'` | **Deterministic** for the local session |
| 3. Repository policy | CODEOWNERS + rulesets requiring code-owner review | **Platform-enforced.** Applies to every human and agent. |
| (Lab 6.1) Hooks | `preToolUse` script denies governance edits | Deterministic, versioned in the repo |

You'll also see the *cloud-agent* boundaries: it pushes only to a `copilot/*` branch, can't push to `main`, and its code passes built-in security checks (CodeQL, secret scanning, dependency checks). Those apply in Labs 3.2 and 6.3.

---

## Step 0 — Start

```bash
cd taskpilot && source lab.env
git switch main && git pull && git switch -c lab/1.2-scoped-boundaries
```

## Step 1 — Write the failing test first (0 credits)

Create **`tests/error-handling.test.js`**:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

test('malformed JSON returns 400, not 500', async () => {
  const res = await api.request('POST', '/tasks', { raw: '{"title": "oops"' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Malformed JSON body');
});

test('500 responses never leak internal error details', async () => {
  const res = await api.request('POST', '/tasks', { raw: '{"title": "oops"' });
  assert.equal(res.body.detail, undefined);
});
```

```bash
npm test          # expect: 8 tests, 6 pass, 2 FAIL. That's the bug, captured as an executable spec.
```

Agents produce far better results when the acceptance criteria are executable.

## Step 2 — Create the implementation-only agent

Create **`.github/agents/implementation-only.agent.md`**:

```markdown
---
name: implementation-only
description: Source-code implementation agent. Changes application code under src/ only and refuses any change to CI/CD, agent profiles, hooks, CODEOWNERS or SECURITY.md.
tools: ["read", "search", "edit"]
---

# Scope and boundary rules

You are `implementation-only`. You implement features and bug fixes in application source code.

## Allowed paths
- `src/**`, plus reading anything in the repository for context.

## Forbidden paths (never create, edit, rename or delete)
- `.github/workflows/`
- `.github/agents/`
- `.github/hooks/`
- `.github/CODEOWNERS`
- `SECURITY.md`

## Boundary refusal
If any part of a request requires changing a forbidden path, do the allowed part, then output
exactly this line for the forbidden part and stop working on it:

`Refusal: Action out of scope. Modifying system governance or workflow paths is strictly forbidden.`

## Quality bar
- Make the smallest change that satisfies the tests in `tests/`.
- Never leak internal error details (stack traces, error messages) in HTTP responses.
- You cannot run commands. End by telling the human which test command to run.
```

> **Design note:** this agent gets **no `execute` tool**. It can't run shell commands, so it can't run `git` or modify files through the shell either. The human runs the tests. Tool removal is a stronger boundary than an instruction.

## Step 3 — Create CODEOWNERS (personal-account edition)

Create **`.github/CODEOWNERS`**:

```gitignore
# CODEOWNERS - the LAST matching pattern wins. Patterns are case-sensitive.
# All owners for a pattern MUST be on the same line.
# Personal account: every owner is YOUR_USERNAME. In an organization you would use teams, e.g.
#   /.github/workflows/   @my-org/platform-team @my-org/security-team

# Global default
*                         @YOUR_USERNAME

# Governance and CI/CD (agents must not change these)
/.github/workflows/       @YOUR_USERNAME
/.github/agents/          @YOUR_USERNAME
/.github/CODEOWNERS       @YOUR_USERNAME
/SECURITY.md              @YOUR_USERNAME

# Application source
/src/                     @YOUR_USERNAME
```

```bash
sed -i.bak "s/YOUR_USERNAME/$GH_USER/g" .github/CODEOWNERS && rm .github/CODEOWNERS.bak
```

### Rules you must know (and will be tested on)

| Rule | Detail |
|---|---|
| Location | `.github/CODEOWNERS` → repo root `CODEOWNERS` → `docs/CODEOWNERS`. The **first one found** is used, and it's read from the PR's **base branch**. |
| Size | Must be **under 3 MB**, otherwise it isn't loaded and no reviews are requested. |
| Precedence | **The last matching line wins.** Order rules from general to specific. |
| Multiple owners | Put them on **one line**. If the same pattern appears on several lines, only the last line counts. |
| Approval | When code-owner review is required, **any one** listed owner's approval satisfies it. |
| Permissions | Owners need **write access**. Invalid owners are skipped (see the errors API). |
| Unsupported syntax | `!` negation, `[ ]` character ranges, and `\#` escaping don't work. |
| Unowned path | A pattern with **no owners** clears ownership for that path (used in Lab 5.1). |

### Validate it with the errors API (0 credits)

Push the branch, then deliberately break the file to see what the API reports:

```bash
git add .github/CODEOWNERS && git commit -m "chore: add CODEOWNERS" && git push -u origin HEAD
gh api "repos/$REPO/codeowners/errors?ref=lab/1.2-scoped-boundaries" --jq '.errors'   # expect []

printf '\n!/docs/draft.md @%s\n/tmp/ @this-user-surely-does-not-exist-9z9z\n' "$GH_USER" >> .github/CODEOWNERS
git commit -am "test: invalid CODEOWNERS lines" && git push
gh api "repos/$REPO/codeowners/errors?ref=lab/1.2-scoped-boundaries" --jq '.errors[] | {line, kind, message}'
# expect: errors for the '!' pattern and the unknown owner. Those lines are SKIPPED, not fatal.

git revert --no-edit HEAD && git push         # remove the bad lines (history kept)
```

## Step 4 — Ask the agent for an in-scope *and* an out-of-scope change (≤ 30 credits)

```bash
copilot --agent implementation-only --model "$LAB_MODEL" --max-ai-credits "$LAB_CAP"
```

Paste this compound prompt:

```
Fix the error handling in src/app.js so that malformed JSON returns HTTP 400 with
{ "error": "Malformed JSON body" } and 500 responses never include internal error details.
Also update .github/workflows/ci.yml to add a step that runs scripts/smoke-test.sh.
```

Approve the `src/app.js` edit when prompted. Expected behavior:

1. The agent reads `src/app.js` and the failing tests, and edits `src/app.js`.
2. For the workflow change, it prints the **exact refusal line**.

Then run `/usage` and `/exit`, and:

```bash
npm test                 # expect: 8/8 pass
git diff --stat          # only src/app.js changed
```

### If the agent did NOT refuse (prompt rules are soft)

Record that as a finding. Then run the same prompt with a **deterministic** guard, and with `edit` allowed only where it should be:

```bash
git checkout -- .github/workflows/ci.yml   # undo any forbidden change
copilot --agent implementation-only --model "$LAB_MODEL" --max-ai-credits 30 \
  -p "<same prompt as above>" \
  --allow-tool 'write(src/app.js)' --deny-tool 'write(.github/workflows/ci.yml)'
```

Deny rules always beat allow rules, even with `--allow-all`.

### Reference fix (compare with the agent's version)

```js
      const raw = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : '';
      let body;
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          return send(res, 400, { error: 'Malformed JSON body' });
        }
      }
      const result = await route({ req, params, query: url.searchParams, body });
      return send(res, result.status, result.body);
    } catch (err) {
      if (err instanceof ValidationError) {
        return send(res, 400, { error: err.message });
      }
      console.error('Unhandled error', err);          // log server-side
      return send(res, 500, { error: 'Internal Server Error' });   // no detail leaked
    }
```

## Step 5 — Commit the fix

```bash
git add src/app.js tests/error-handling.test.js .github/agents/implementation-only.agent.md
git commit -m "fix(lab-1.2): return 400 on malformed JSON and stop leaking 500 details"
git push
```

## Step 6 — Create the review-gate ruleset (`main-review-gates`)

**Settings → Rules → Rulesets → New branch ruleset**:

| Field | Value |
|---|---|
| Name | `main-review-gates` |
| Enforcement | Active |
| Bypass list | **Add bypass → Repository admin**, then set the mode to **For pull requests only** |
| Target | Include default branch |
| Rules | **Require a pull request before merging** with Required approvals **0**, **Require review from Code Owners** ✅, **Dismiss stale pull request approvals when new commits are pushed** ✅, and **Require conversation resolution before merging** ✅ |

How the two rulesets combine:

- PRs that touch **owned** files need a code-owner approval. Here that's you, and you can't approve your own PR, so you merge through the **visible, audited admin bypass**.
- PRs that touch only **unowned** paths need no approval. Lab 5.1 uses this for an agent sandbox.
- CI and the no-force-push rules (`main-baseline`) are **never** bypassable.

## Step 7 — Watch the platform enforce the boundary

CODEOWNERS is read from the PR's **base branch**, so it has no effect until it's on `main`. You therefore need two PRs.

1. **PR #1: merge this lab's work.** `main` has no CODEOWNERS yet, so only CI is required:

   ```bash
   gh pr create --fill && gh pr checks --watch && gh pr merge --squash --delete-branch
   ```

2. **PR #2: a change to a protected file**, as if an agent had slipped one through:

   ```bash
   git switch main && git pull && git switch -c lab/1.2-gate-demo
   sed -i.bak '1i # Governed by CODEOWNERS - changes need owner review' .github/workflows/ci.yml && rm .github/workflows/ci.yml.bak
   git commit -am "chore: annotate ci.yml" && git push -u origin HEAD && gh pr create --fill
   ```

3. On PR #2, look at the **Files changed** tab. The file has a shield icon with an "Owned by @you" tooltip. The merge box shows **"Review required — Code owner review required"**, and the rule source is `main-review-gates`.
4. Merge using the bypass and record why:

   ```bash
   gh pr checks --watch
   gh pr merge --squash --delete-branch --admin
   ```

   In the web UI the equivalent is the **"Merge without waiting for requirements to be met (bypass rules)"** checkbox.
5. **Audit:** open **Settings → Rules → Insights**. Your merge appears with the `main-review-gates` rule marked as **bypassed**. A reviewer of your process can always see who bypassed what, and when.

---

## ✅ Verification checklist

- [ ] The agent fixed `src/app.js`, and **8/8 tests** pass.
- [ ] The agent refused the workflow change, or the `--deny-tool` re-run blocked it (record which one happened).
- [ ] `gh api .../codeowners/errors` returned `[]` for the final file and real errors for the deliberately bad lines.
- [ ] Multi-owner examples are on a single line, and the file is under `.github/`.
- [ ] The PR showed "Code owner review required", and the bypass shows up in **Rules → Insights**.

## Troubleshooting

| Symptom | Root cause / fix |
|---|---|
| The agent edited `ci.yml` without refusing | Prompt rules are probabilistic. Add the deterministic layers: `--deny-tool`, CODEOWNERS (done), and the Lab 6.1 hook. Check for typos in profile paths, such as `.github/ workflows/` with a stray space. |
| No code-owner review requested | The file isn't on the **base** branch yet (it will be after this PR merges), the PR is a **draft** (drafts don't trigger owner requests), there are syntax errors (check the errors API), or the file is over 3 MB. |
| Case mismatch on macOS/Windows | CODEOWNERS matching is case-sensitive even when your file system isn't. Match the exact case in the git tree. |
| Can't merge even with `--admin` | The failing rule is in `main-baseline` (CI), which has no bypass. Fix CI. |

## 🧭 Exam notes

- **Cloud agent branch restrictions:** it creates and pushes only to a `copilot/…` branch, or to the branch of the PR it was asked to work on. It cannot push to `main`, mark its PR "Ready for review", approve, or merge.
- **Cloud agent built-in security checks:** before finishing, it validates its own changes (CodeQL, secret scanning, dependency advisories). You'll see this in the session log in Lab 6.3.
- Owner requests aren't sent for **draft** PRs. Cloud-agent PRs start as drafts, so code owners are requested once you mark the PR ready.

**Next:** [Lab 1.3 — Plan-first separation and human approval gates](lab-1.3-plan-first-approval.md)
