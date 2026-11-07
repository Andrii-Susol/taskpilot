# INC-001 — Context drift while adding /tasks/stats
- Date / model / surface: YYYY-MM-DD / <model> / Copilot CLI (proper-agent)
- Session evidence: commits wip(drift) turn 1–3 (SHAs: …), /context showed …% usage

## Classification
- [x] Context issue — conflicting instructions (session turns vs AGENTS.md / copilot-instructions.md)
- [ ] Reasoning error — (fill in if observed, e.g. route order)
- [ ] Tool misuse

## Symptoms
- …

## Root cause
Two un-reconciled "reviewer" instructions were injected into the session; no single source of
truth recorded the error-format decision, so the agent followed the most recent message.

## Remediation (state reset)
1. Cleared session (new session). 2. Recorded decision in ADR-0001. 3. Hard-reset branch to
baseline. 4. Re-ran from one anchor (issue #…) — result: …
