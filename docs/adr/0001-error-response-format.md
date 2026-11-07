# ADR-0001: HTTP error response format
- Status: Accepted · Date: YYYY-MM-DD · Decider: @YOUR_USERNAME

## Decision
All HTTP errors are JSON `{ "error": "<human-readable message>" }` with an appropriate 4xx/5xx
status. Expected validation failures are signalled with `ValidationError` and mapped centrally in
`src/app.js`; handlers never throw for expected errors. Internal details are never returned.

## Rejected alternatives
- `{ success: false, message }` — inconsistent with existing clients and tests.
- Throwing from handlers for validation — mixes control flow and makes status mapping implicit.
