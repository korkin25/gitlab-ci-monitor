# TODO

## Current state / next action

- **State:** Autonomous-development governance was just set up — `CLAUDE.md` (canonical
  rules), this `TODO.md`, `CHANGELOG.md` conventions, `AGENTS.md`, and a GitHub Actions
  CI workflow. No feature work has started under the new framework.
- **Next action:** Agree the first feature / backlog priority with the user before
  writing any code. Every feature starts test-first (see `CLAUDE.md` → Development
  workflow).

## Legend

- ⬜ planned
- 🟡 in progress
- ✅ done — **on completion, move the row to `CHANGELOG.md`** (only after a passing test)

## Maintenance rule

Keep this file in lockstep with the code, in the same change. Started/ongoing work lives
here; completed and verified work moves to `CHANGELOG.md`. Never mark a task ✅ without a
passing test. Keep the "Current state / next action" block at the very top accurate so a
fresh (cold-start) session knows exactly what to do next.

## Task IDs

- Tasks: `GCM-<n>` (GitLab CI Monitor), e.g. `GCM-1`.
- Decisions: `GCM-D<n>`, e.g. `GCM-D1`.
- Numbering is mandatory and monotonic — never reuse or skip-then-reuse an ID.

## Current work

| ID | Status | Task |
|----|--------|------|
| —  | —      | (none yet — agree the first task with the user) |

## Backlog

Candidate improvements suggested by the current codebase and README. Prioritize and
confirm with the user before starting; each is delivered test-first.

| ID | Status | Task |
|----|--------|------|
| GCM-1 | ⬜ | Set up a test harness (choose a runner — VS Code test / mocha / vitest) and write the first failing tests for the pipelines/HTTP layer. |
| GCM-2 | ⬜ | Add ESLint + Prettier config and make the codebase lint-clean; wire both into `npm` scripts and CI. |
| GCM-3 | ⬜ | Store the GitLab token in VS Code SecretStorage instead of plaintext `settings.json`; keep `GITLAB_TOKEN` env fallback. |
| GCM-4 | ⬜ | Add a release/package CI job (tag-triggered) that builds the `.vsix` and, on explicit opt-in, publishes to the VS Code Marketplace / OpenVSX via `@vscode/vsce`. |
