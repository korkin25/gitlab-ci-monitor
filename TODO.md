# TODO

## Current state / next action

- **State:** `GCM-1`–`GCM-4` are **all done** — the original backlog is cleared.
  Tooling: `node:test` suite (25 green tests), ESLint + Prettier (lint-clean), token in
  Secret Storage, and a tag-triggered release workflow that builds a lean `.vsix` and
  publishes on opt-in. `npm run package` builds the `.vsix` locally (verified). Details in
  `CHANGELOG.md` → Unreleased.
- **Next action:** None queued. When ready, cut the first release under the new framework:
  bump `package.json` version, move `## [Unreleased]` into a dated version section in
  `CHANGELOG.md`, then push the matching `vX.Y.Z` tag to trigger the release. Otherwise,
  agree the next feature with the user (test-first).

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
| —  | —      | (none — GCM-1…GCM-4 done; agree the next task with the user) |

## Backlog

The initial backlog (`GCM-1`…`GCM-4`) is complete — see `CHANGELOG.md` → Unreleased.
New candidates below; prioritize and confirm with the user before starting, each
delivered test-first.

| ID | Status | Task |
|----|--------|------|
| —  | —      | (empty — add new `GCM-<n>` items as they come up) |
