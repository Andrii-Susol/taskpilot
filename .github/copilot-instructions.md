# Copilot instructions — TaskPilot

## Operational guardrails
1. Never run destructive commands (`rm -rf`, `git reset --hard`, `git push --force`, history rewrites).
2. Respect `.github/CODEOWNERS`. If a change needs an owned governance path, stop and ask a human.
3. Prefer the smallest change that satisfies the acceptance criteria in the issue or PR.

## Code conventions
- Route handlers return `{ status, body }`. Errors use `{ error: string }` — do not throw from
  handlers for expected validation failures; use `ValidationError` from `src/store.js`.
- Use `const`/`let`, arrow functions for callbacks, named exports, no default exports.

## Pull requests
- Title: conventional commit style (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Body: what changed, why, how it was tested (paste the `npm test` summary line).
