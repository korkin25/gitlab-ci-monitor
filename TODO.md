# TODO

## Current state / next action

- **State:** `GCM-1`, `GCM-2`, `GCM-3` are **done**. Tooling: `node:test` suite
  (25 green tests), ESLint flat config + Prettier (lint-clean), all wired into CI as
  hard gates. Tokens now resolve Secret Storage → `settings.json` → `GITLAB_TOKEN`, with
  a `TokenStore` cache, Set/Clear Token commands, and startup migration of legacy tokens.
  Details in `CHANGELOG.md` → Unreleased.
- **Next action:** Start `GCM-4` — add a tag-triggered release/package CI job that builds
  the `.vsix` and, on explicit opt-in, publishes to the VS Code Marketplace / OpenVSX via
  `@vscode/vsce`.

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
| GCM-4 | ⬜ | Add a release/package CI job (tag-triggered) that builds the `.vsix` and, on explicit opt-in, publishes to the VS Code Marketplace / OpenVSX via `@vscode/vsce`. |
