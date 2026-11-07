#!/usr/bin/env bash
# Run a Copilot CLI task with a per-attempt AI-credit cap and bounded retries.
# Retries ONLY failures that look transient; permanent errors fail fast (retrying them burns credits).
# Usage: .github/scripts/run-agent.sh "<prompt>" [extra copilot args...]
# Optional env: MAX_RETRIES (3), RETRY_DELAY_SECONDS (5), MAX_AI_CREDITS (30),
#               AGENT_OUTPUT_FILE (copy of the successful attempt's output), COPILOT_BIN.
set -euo pipefail

PROMPT="${1:?usage: run-agent.sh \"<prompt>\" [copilot args...]}"
shift
MAX_RETRIES="${MAX_RETRIES:-3}"
DELAY="${RETRY_DELAY_SECONDS:-5}"
CAP="${MAX_AI_CREDITS:-30}"
COPILOT_BIN="${COPILOT_BIN:-copilot}"
PERMANENT='Invalid command format|unknown option|Invalid value|No authentication|Resource not accessible|session limit'

log="$(mktemp)"
trap 'rm -f "$log"' EXIT

for ((attempt = 1; attempt <= MAX_RETRIES; attempt++)); do
  echo "::group::Agent attempt ${attempt}/${MAX_RETRIES} (cap ${CAP} AI credits)"
  set +e
  "$COPILOT_BIN" -p "$PROMPT" --max-ai-credits "$CAP" --no-ask-user "$@" 2>&1 | tee "$log"
  code=${PIPESTATUS[0]}
  set -e
  echo "::endgroup::"

  if [[ $code -eq 0 ]]; then
    [[ -n "${AGENT_OUTPUT_FILE:-}" ]] && cp "$log" "$AGENT_OUTPUT_FILE"
    echo "Agent task succeeded on attempt ${attempt}."
    exit 0
  fi
  if grep -qiE "$PERMANENT" "$log"; then
    echo "::error::Permanent failure (exit ${code}); not retrying." >&2
    exit "$code"
  fi
  if (( attempt < MAX_RETRIES )); then
    echo "::warning::Transient failure (exit ${code}); retrying in ${DELAY}s." >&2
    sleep "$DELAY"
    DELAY=$(( DELAY * 2 ))   # exponential backoff
  fi
done

echo "::error::Agent task failed after ${MAX_RETRIES} attempts." >&2
exit 1
