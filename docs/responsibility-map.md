# Responsibility map (single-writer)

| Path | Writer agent | Human owner (CODEOWNERS) | Enforcement layers |
|---|---|---|---|
| `src/**` (except experimental) | api-agent | @Andrii-Susol | agent profile · per-run write allowlist · code-owner review |
| `src/experimental/**` | api-agent | **none (ownership reset)** | agent profile · CI only — sandbox |
| `src/experimental/secure/**` | api-agent | @Andrii-Susol | re-owned inside the sandbox |
| `tests/**` | test-agent | @Andrii-Susol | agent profile · code-owner review |
| `docs/**`, `README.md` | docs-agent | @Andrii-Susol | agent profile · code-owner review |
| `docs/adr/`, `docs/postmortems/`, `docs/labs/` | humans only | @Andrii-Susol | code-owner review |
| `.github/**`, `AGENTS.md`, `SECURITY.md` | **no agent** | @Andrii-Susol | code-owner review · `--deny-tool` · hook (Lab 6.1) |
| `scripts/**` | refactor-agent | @Andrii-Susol | code-owner review · shellcheck gate |

Read-only agents: implementation-planner, ops-observer, orchestrator.
