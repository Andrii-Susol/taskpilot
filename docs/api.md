# TaskPilot API Reference

All responses are JSON. Requests with bodies must include `Content-Type: application/json`.

## Rate Limiting

All endpoints except `/health` are rate-limited using token-bucket algorithm (default: 60 requests/minute, 1 token/second refill). Rate-limit headers appear on all responses except `/health`:

- `X-RateLimit-Limit`: bucket capacity (default: 60)
- `X-RateLimit-Remaining`: tokens remaining for this client
- `Retry-After`: seconds to wait (returned only on 429)

When rate limited, the API returns:

```
HTTP 429 Too Many Requests

{
  "error": "Too many requests"
}
```

## Endpoints

### Health Check

**GET /health**

Server health and uptime.

- **Status**: 200 OK
- **Rate-limited**: No (exempt)
- **Response body**:
  ```json
  {
    "status": "ok",
    "uptimeSeconds": 3600
  }
  ```

---

### List Tasks

**GET /tasks**

List all tasks, optionally filtered by status.

- **Query parameters**:
  - `status` (optional): Filter by status. One of: `todo`, `in-progress`, `done`. If provided and invalid, returns 400.

- **Responses**:
  - **200 OK**: Array of task objects
    ```json
    [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Write lab 0",
        "status": "todo",
        "dueDate": "2026-12-31",
        "createdAt": "2026-11-09T20:38:16.185Z",
        "updatedAt": "2026-11-09T20:38:16.185Z"
      }
    ]
    ```
  - **400 Bad Request**: Invalid status filter
    ```json
    {
      "error": "status must be one of: todo, in-progress, done"
    }
    ```

- **Rate-limited**: Yes

- **Examples**:
  ```bash
  # List all tasks
  curl -X GET http://localhost:3000/tasks

  # Filter by status
  curl -X GET 'http://localhost:3000/tasks?status=done'
  ```

---

### Create Task

**POST /tasks**

Create a new task.

- **Request body**:
  ```json
  {
    "title": "Write lab 0",
    "status": "todo",
    "dueDate": "2026-12-31"
  }
  ```
  - `title` (required): Non-empty string, max 200 characters (leading/trailing whitespace trimmed)
  - `status` (optional): One of `todo`, `in-progress`, `done`. Defaults to `todo`.
  - `dueDate` (optional): Valid calendar date in `YYYY-MM-DD` format, or `null`. Defaults to `null`.

- **Responses**:
  - **201 Created**: Task object with generated id, timestamps
    ```json
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Write lab 0",
      "status": "todo",
      "dueDate": "2026-12-31",
      "createdAt": "2026-11-09T20:38:16.185Z",
      "updatedAt": "2026-11-09T20:38:16.185Z"
    }
    ```
  - **400 Bad Request**: Validation error
    ```json
    {
      "error": "title must be a non-empty string"
    }
    ```
    Possible errors:
    - `Body must be a JSON object`
    - `title must be a non-empty string`
    - `title must be at most 200 characters`
    - `status must be one of: todo, in-progress, done`
    - `dueDate must be a valid date in YYYY-MM-DD format or null`
  - **429 Too Many Requests**: Rate limited

- **Rate-limited**: Yes

- **Examples**:
  ```bash
  # Minimal: title only
  curl -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d '{"title": "Buy milk"}'

  # Full: with status and due date
  curl -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Complete project",
      "status": "in-progress",
      "dueDate": "2026-12-31"
    }'

  # Explicit null due date
  curl -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d '{"title": "No deadline", "dueDate": null}'
  ```

---

### Get Task Statistics

**GET /tasks/stats**

Aggregate task counts by status.

- **Responses**:
  - **200 OK**: Statistics object
    ```json
    {
      "total": 4,
      "byStatus": {
        "todo": 2,
        "in-progress": 1,
        "done": 1
      }
    }
    ```

- **Rate-limited**: Yes

- **Examples**:
  ```bash
  curl -X GET http://localhost:3000/tasks/stats
  ```

---

### Get Task

**GET /tasks/:id**

Retrieve a single task by ID.

- **Path parameters**:
  - `id`: UUID of the task

- **Responses**:
  - **200 OK**: Task object
    ```json
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Write lab 0",
      "status": "todo",
      "dueDate": "2026-12-31",
      "createdAt": "2026-11-09T20:38:16.185Z",
      "updatedAt": "2026-11-09T20:38:16.185Z"
    }
    ```
  - **404 Not Found**: Task does not exist
    ```json
    {
      "error": "Task not found"
    }
    ```
  - **429 Too Many Requests**: Rate limited

- **Rate-limited**: Yes

- **Examples**:
  ```bash
  curl -X GET http://localhost:3000/tasks/550e8400-e29b-41d4-a716-446655440000
  ```

---

### Update Task

**PATCH /tasks/:id**

Partially update a task. Only provided fields are updated; omitted fields are preserved.

- **Path parameters**:
  - `id`: UUID of the task

- **Request body** (all fields optional):
  ```json
  {
    "title": "Updated title",
    "status": "in-progress",
    "dueDate": "2026-12-31"
  }
  ```
  - `title`: Non-empty string, max 200 characters (leading/trailing whitespace trimmed)
  - `status`: One of `todo`, `in-progress`, `done`
  - `dueDate`: Valid calendar date in `YYYY-MM-DD` format, or `null` to clear

- **Responses**:
  - **200 OK**: Updated task object
    ```json
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Updated title",
      "status": "in-progress",
      "dueDate": "2026-12-31",
      "createdAt": "2026-11-09T20:38:16.185Z",
      "updatedAt": "2026-11-09T20:38:16.186Z"
    }
    ```
  - **400 Bad Request**: Validation error (same as POST /tasks)
  - **404 Not Found**: Task does not exist
    ```json
    {
      "error": "Task not found"
    }
    ```
  - **429 Too Many Requests**: Rate limited

- **Rate-limited**: Yes

- **Examples**:
  ```bash
  # Update status only
  curl -X PATCH http://localhost:3000/tasks/550e8400-e29b-41d4-a716-446655440000 \
    -H "Content-Type: application/json" \
    -d '{"status": "done"}'

  # Update multiple fields
  curl -X PATCH http://localhost:3000/tasks/550e8400-e29b-41d4-a716-446655440000 \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Updated title",
      "dueDate": "2025-06-15"
    }'

  # Clear due date
  curl -X PATCH http://localhost:3000/tasks/550e8400-e29b-41d4-a716-446655440000 \
    -H "Content-Type: application/json" \
    -d '{"dueDate": null}'
  ```

---

### Delete Task

**DELETE /tasks/:id**

Delete a task permanently.

- **Path parameters**:
  - `id`: UUID of the task

- **Responses**:
  - **204 No Content**: Task deleted successfully (empty body)
  - **404 Not Found**: Task does not exist
    ```json
    {
      "error": "Task not found"
    }
    ```
  - **429 Too Many Requests**: Rate limited

- **Rate-limited**: Yes

- **Examples**:
  ```bash
  curl -X DELETE http://localhost:3000/tasks/550e8400-e29b-41d4-a716-446655440000
  ```

---

## Error Handling

All errors are JSON objects with an `error` field containing a human-readable message:

```json
{
  "error": "title must be a non-empty string"
}
```

Common error status codes:

| Status | Meaning |
| --- | --- |
| 400 | Bad Request: validation failure or malformed JSON |
| 404 | Not Found: resource does not exist or route does not exist |
| 405 | Method Not Allowed: endpoint exists but HTTP method is not supported |
| 429 | Too Many Requests: rate limit exceeded |
| 500 | Internal Server Error: server error (never leaks internal details) |

---

## Task Object Schema

All task responses include:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "string (1–200 characters)",
  "status": "todo | in-progress | done",
  "dueDate": "YYYY-MM-DD | null",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

- `id`: UUID v4, generated on creation
- `title`: Non-empty string, trimmed, max 200 characters
- `status`: Task status
- `dueDate`: Nullable calendar date in `YYYY-MM-DD` format (ISO 8601 compatible)
- `createdAt`: ISO 8601 timestamp, set on creation
- `updatedAt`: ISO 8601 timestamp, updated on any change
