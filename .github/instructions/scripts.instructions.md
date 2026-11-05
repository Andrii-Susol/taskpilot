---
applyTo: "scripts/**/*.sh"
---
- Shebang `#!/usr/bin/env bash` and `set -euo pipefail` on line 2.
- Quote every variable expansion. Export variables that child processes need.
- Network calls: `curl --silent --show-error --fail --max-time <n>` with a bounded retry loop.
- Clean up background processes with `trap '...' EXIT`. Scripts must exit non-zero on failure.
- Must pass `shellcheck`.
