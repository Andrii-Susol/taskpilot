#!/usr/bin/env bash
set -euo pipefail

# Seed a running TaskPilot instance with demo tasks.
# Hardened with strict mode, curl retries, and proper error handling.

export TASKPILOT_URL=${TASKPILOT_URL:-http://localhost:3000}
export MAX_ATTEMPTS=3
export DELAY_SECONDS=1

# Task titles to seed
tasks=("Read the lab guide" "Configure CODEOWNERS" "Ship the rate limiter")

# Seed each task with retry logic
for title in "${tasks[@]}"; do
  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    if curl --silent --show-error --fail --max-time 3 \
      -X POST "$TASKPILOT_URL/tasks" \
      -H 'content-type: application/json' \
      -d "{\"title\": \"$title\"}" > /dev/null; then
      echo "OK on attempt ${attempt}: created task '$title'"
      break
    fi
    if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
      echo "Attempt ${attempt}/${MAX_ATTEMPTS} failed for '$title'; retrying in ${DELAY_SECONDS}s..." >&2
      sleep "$DELAY_SECONDS"
    else
      echo "FAILED after ${MAX_ATTEMPTS} attempts to create '$title'" >&2
      exit 1
    fi
  done
done

