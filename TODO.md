# TODO

## Current state / next action

- **State:** `GCM-1`–`GCM-5` done. Tooling: `node:test` suite (29 green tests),
  ESLint + Prettier (lint-clean), token in Secret Storage, tag-triggered release workflow.
  Latest feature: clicking a repo in one panel expands it in the other (`GCM-5`).
- **Release:** `v0.3.0` is the current release (adds `GCM-5`). The tag triggers
  `.github/workflows/release.yml`, which builds the `.vsix` and attaches it to a GitHub
  Release; install via **Extensions: Install from VSIX…**. Marketplace/Open VSX publish
  stays opt-in (no `VSCE_PAT`/`OVSX_PAT` secrets configured yet).
- **Next action:** For the next release, add entries under `## [Unreleased]`, bump
  `package.json`, move Unreleased into a dated `## [x.y.z]` section, then push the matching
  `vX.Y.Z` tag. Otherwise, agree the next feature with the user (test-first).

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
