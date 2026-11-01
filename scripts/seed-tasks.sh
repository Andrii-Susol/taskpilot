#!/bin/bash
# Seed a running TaskPilot instance with demo tasks.
# NOTE: intentionally fragile - hardened in Lab 3.2.
URL=${TASKPILOT_URL:-http://localhost:3000}
for title in "Read the lab guide" "Configure CODEOWNERS" "Ship the rate limiter"; do
  curl -s -X POST $URL/tasks -H 'content-type: application/json' -d "{\"title\": \"$title\"}"
done
