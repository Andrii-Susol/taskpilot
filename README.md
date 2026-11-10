# TaskPilot

A tiny, zero-dependency task API used as a hands-on GH-600 (agentic AI on GitHub) lab project.

## Run
    npm start            # http://localhost:3000
    npm test             # node:test suite

## API
| Method | Path | Description |
|---|---|---|
| GET | /health | Liveness check |
| GET | /tasks[?status=] | List tasks |
| POST | /tasks | Create `{ title, status?, dueDate? }` |
| GET/PATCH/DELETE | /tasks/:id | Read / update / delete |

**Full schema & examples:** see [docs/api-schema.md](docs/api-schema.md)

Lab guides live in `docs/labs/`.

# Governance as code
`rulesets/*.json` are exports of the live repository rulesets (GitHub REST API format).
Changes to protection must be proposed here first (reviewed via CODEOWNERS), then applied:

    gh api -X PUT repos/OWNER/REPO/rulesets/<id> --input governance/rulesets/<name>.json

Drift check: re-export and `git diff governance/` — any diff means someone changed protection in the UI.
