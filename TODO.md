# TODO

## Current state / next action

- **State:** `GCM-1` is **done** — test harness (`node:test`) is in place with 19 green
  tests, and the pure logic has been extracted into VS Code-free modules
  (`git-url`, `ansi`, `job-order`, `gitlab-api`). `npm test` runs the suite; the
  extension still builds with `npm run compile`. Details in `CHANGELOG.md` → Unreleased.
- **Next action:** Start `GCM-2` — add ESLint + Prettier, make the codebase lint-clean,
  and wire both into `npm` scripts and CI. Continue test-first for any behavior change.

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
| GCM-2 | ⬜ | Add ESLint + Prettier config and make the codebase lint-clean; wire both into `npm` scripts and CI. |
| GCM-3 | ⬜ | Store the GitLab token in VS Code SecretStorage instead of plaintext `settings.json`; keep `GITLAB_TOKEN` env fallback. |
| GCM-4 | ⬜ | Add a release/package CI job (tag-triggered) that builds the `.vsix` and, on explicit opt-in, publishes to the VS Code Marketplace / OpenVSX via `@vscode/vsce`. |
