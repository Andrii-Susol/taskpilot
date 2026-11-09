# Task API Schema

## Task Object

```json
{
  "id": "uuid",
  "title": "string",
  "status": "string",
  "dueDate": "string | null",
  "createdAt": "string",
  "updatedAt": "string"
}
```

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string (UUID) | — | Unique identifier, auto-generated |
| `title` | string | — | Task description; 1–200 characters, non-empty |
| `status` | string | `"todo"` | One of: `"todo"`, `"in-progress"`, `"done"` |
| `dueDate` | string or null | `null` | Optional due date in `YYYY-MM-DD` format. Must be a valid calendar date. |
| `createdAt` | string (ISO 8601) | — | Timestamp of creation |
| `updatedAt` | string (ISO 8601) | — | Timestamp of last update |

## Endpoints

### POST /tasks
Create a new task.

**Request body:**
```json
{
  "title": "string",
  "status": "string (optional)",
  "dueDate": "string | null (optional)"
}
```

**Response:** `201 Created` with task object.

**Validation errors (400):**
- `title` must be a non-empty string, ≤200 characters
- `status` must be one of: `todo`, `in-progress`, `done`
- `dueDate` must be null or a valid date in `YYYY-MM-DD` format (e.g., `"2026-12-31"`)

Reference: [ADR-0001 Error Response Format](adr/0001-error-response-format.md)

### PATCH /tasks/:id
Update an existing task.

**Request body:**
```json
{
  "title": "string (optional)",
  "status": "string (optional)",
  "dueDate": "string | null (optional)"
}
```

**Response:** `200 OK` with updated task object.

**Validation errors (400):**
- Same validation rules as POST /tasks apply to any field present in the request.

Reference: [ADR-0001 Error Response Format](adr/0001-error-response-format.md)

## Examples

### Create a task with a due date
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete Q4 review",
    "status": "in-progress",
    "dueDate": "2026-12-15"
  }'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Complete Q4 review",
  "status": "in-progress",
  "dueDate": "2026-12-15",
  "createdAt": "2026-11-09T19:57:21.843Z",
  "updatedAt": "2026-11-09T19:57:21.843Z"
}
```

### Update a task's due date
```bash
curl -X PATCH http://localhost:3000/tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "dueDate": "2026-12-31"
  }'
```

### Clear a due date
```bash
curl -X PATCH http://localhost:3000/tasks/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "dueDate": null
  }'
```
