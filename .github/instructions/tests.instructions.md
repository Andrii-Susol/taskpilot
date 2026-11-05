---
applyTo: "tests/**"
---
- Use `node:test` (`test`, `before`, `after`) and `node:assert/strict`. No other test frameworks.
- Start the API with `startTestServer()` from `tests/helpers.js`; always close it in `after()`.
- One behaviour per test; name tests after the behaviour ("returns 400 when title is empty").
