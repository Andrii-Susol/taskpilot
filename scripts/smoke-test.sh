#!/usr/bin/env bash
set -euo pipefail

# Smoke test: start TaskPilot, hit /health, stop it.
# Hardened with strict mode, background process cleanup, and network resilience.

export PORT=${PORT:-3456}
export MAX_ATTEMPTS=5
export DELAY_SECONDS=1

# Start server in background and ensure cleanup on exit
node src/server.js &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT

# Give server time to start
sleep 1

# Retry health check with bounded loop
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if output="$(curl --silent --show-error --fail --max-time 3 "http://localhost:$PORT/health")"; then
    echo "OK on attempt ${attempt}: ${output}"
    exit 0
  fi
  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    echo "Attempt ${attempt}/${MAX_ATTEMPTS} failed; retrying in ${DELAY_SECONDS}s..." >&2
    sleep "$DELAY_SECONDS"
  fi
done
echo "FAILED after ${MAX_ATTEMPTS} attempts" >&2
exit 1
