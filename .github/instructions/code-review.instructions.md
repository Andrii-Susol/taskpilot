---
applyTo: "**"
excludeAgent: "coding-agent"
---
# Code review focus (TaskPilot)
When reviewing a pull request, check in this order and cite file:line:
1. Security: user input reaching fs, child_process, RegExp, or eval; secrets in code or logs.
2. Error format follows docs/adr/0001-error-response-format.md; no leaked internal details.
3. New behaviour has a node:test test in tests/; no new runtime dependencies.
4. Agent-authored PRs: changes stay within the scope stated in the linked issue.
Be concise. Do not comment on formatting that tests and linters already cover.
