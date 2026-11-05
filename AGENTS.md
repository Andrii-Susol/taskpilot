# AGENTS.md — TaskPilot

## Project facts
- Node.js 22, ES modules (`"type": "module"`), **zero runtime dependencies**. Do not add packages.
- Source in `src/`, tests in `tests/*.test.js` using `node:test` + `node:assert/strict`.
- Run `npm test` before declaring any task complete. All tests must pass.

## Engineering rules
- HTTP errors are JSON objects of the form `{ "error": "<message>" }`. Never leak stack traces
  or internal error messages.
- Validate inputs at the boundary (`src/store.js` validation, route handlers) and fail fast.
- Every behaviour change needs a test in `tests/`. Tests must be deterministic: no network
  calls outside 127.0.0.1, no unseeded randomness, inject clocks where time matters.

## Boundaries
- Never modify governance paths: `.github/workflows/`, `.github/agents/`, `.github/hooks/`,
  `.github/CODEOWNERS`, `SECURITY.md`, `AGENTS.md`, `.github/copilot-instructions.md`.
- Never commit secrets. Configuration comes from environment variables.
- Work on a branch; never push to `main`.
