---
description: Read-only maintainer report for TaskPilot, delivered as an issue plus a docs PR
on:
  workflow_dispatch:
  # schedule: daily        # keep disabled during the course to save AI credits
permissions:
  contents: read
  issues: read
  pull-requests: read
timeout-minutes: 10
# engine: copilot          # default; optional object form:
# engine:
#   id: copilot
#   model: <your LAB_MODEL id>
tools:
  github:
safe-outputs:
  create-issue:
    title-prefix: "[maintainer-report] "
    labels: [report]
    max: 1
  create-pull-request:
    title-prefix: "docs(report): "
    labels: [report, automated]
    draft: true
    max: 1
---

# TaskPilot maintainer report

You are a maintainer assistant for this repository. You have READ-ONLY access.

1. Review the last 14 days of activity: merged pull requests, open pull requests, open issues,
   and recent commits on the default branch.
2. Read `docs/labs/` file names only to infer which lab the project has reached.
3. Produce a concise report with these sections:
   - **Shipped**: merged PRs (number, title).
   - **In flight**: open PRs and issues, each with a one-line risk note.
   - **Governance**: whether changes touched `.github/` or other code-owned paths.
   - **Suggested next steps**: at most 3 bullets.
4. Create ONE issue containing the report.
5. Create ONE draft pull request that adds the same report as `docs/reports/maintainer-report.md`
   (replace the file if it exists). Do not modify any other file.

If there is nothing to report, create the issue saying so and skip the pull request.
