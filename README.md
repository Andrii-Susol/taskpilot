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
| POST | /tasks | Create `{ title, status? }` |
| GET/PATCH/DELETE | /tasks/:id | Read / update / delete |

Lab guides live in `docs/labs/`.
