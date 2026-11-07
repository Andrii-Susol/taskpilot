---
applyTo: "src/**"
---
- All input validation lives in `validate()` in `src/store.js` and runs for BOTH create and update
  (partial) paths. Add new fields there, with a clear `ValidationError` message.
- New task fields: add the default in `create()`, support them in `update()`, and include them in
  responses. Never change existing field names.
- Errors: throw `ValidationError` for invalid input; `src/app.js` maps it to `400 { error }`.
  Do NOT return `{ success: false }` or `{ message }` shapes.
- Do not touch files outside `src/` and `tests/` unless the task explicitly says so.
