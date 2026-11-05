---
name: shell-error-handling
description: Harden bash scripts with strict mode, bounded retries, cleanup traps and correct exit codes. Use when creating or editing *.sh files or when a script fails silently.
---

# Shell error handling

## Checklist
1. `#!/usr/bin/env bash` + `set -euo pipefail`.
2. Export variables used by child processes (`export PORT`).
3. Background processes: capture `$!` and `trap 'kill "$PID" 2>/dev/null || true' EXIT`.
4. Network calls: `curl --silent --show-error --fail --max-time 3`.
5. Retries: bounded loop, then a clear error message to stderr and `exit 1`.
6. Verify: `bash -n script.sh && shellcheck script.sh`, then test both success AND failure paths.

## Retry template
```bash
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if output="$(curl --silent --show-error --fail --max-time 3 "$URL")"; then
    echo "OK on attempt ${attempt}: ${output}"; exit 0
  fi
  echo "Attempt ${attempt}/${MAX_ATTEMPTS} failed; retrying in ${DELAY_SECONDS}s..." >&2
  sleep "$DELAY_SECONDS"
done
echo "FAILED after ${MAX_ATTEMPTS} attempts" >&2; exit 1
```
