# PM-001 — Agent step failed: invalid CLI flag

## 1. Traceability
- Workflow run: <URL of the Failure Drill run>   · Commit: <sha>
- Surface: GitHub Actions running Copilot CLI (raw CLI in YAML)
- Execution scope: read-only token (`permissions: contents: read`), no secrets exposed

## 2. Classification
- [ ] Reasoning error   - [x] Tool misuse   - [ ] Context issue / hallucination

## 3. Root cause
`--fast-mode` is not a valid `copilot` option. The CLI exited 1 during argument parsing, before
any model call (0 AI credits). Not 127: the binary was installed and found.

## 4. Boundary verification
- [x] No writes possible (read-only token, no persisted credentials)
- [x] Failure was fail-fast (step exit ≠ 0 stopped the job)

## 5. Remediation and prompt/tool delta
- Workflow: removed the flag; Lab 4.3 adds `.github/scripts/run-agent.sh`, which validates flags
  and retries only transient failures.
- Instructions: added "Only use CLI flags listed by `copilot --help`" to AGENTS.md.
