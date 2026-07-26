# TODO

## Current state / next action

**Cutting `0.6.0`** — three user-requested features (`GCM-20`/`GCM-21`/`GCM-22`), each on its own
`feature/*` branch → PR to `dev` → promote `dev` → `rc` → `release`. `VSCE_PAT`/`OVSX_PAT` are now
configured, so a merge to `rc`/`release` publishes to the VS Code Marketplace + Open VSX (`rc` =
pre-release `0.5.<N>`, `release` = stable `0.6.0`), and `release` also cuts a GitHub Release.

- **GCM-20 — jobs as a stage tree + `needs` dependency tree** (in progress): pipelines expand into
  stage nodes → job nodes → dependency leaves. Stage grouping + aggregate status are pure
  (`groupJobsByStage`/`aggregateStageStatus`/`resolveNeeds` in `src/job-order.ts`); `needs` edges
  via GitLab GraphQL (`getJobNeeds`/`parseJobNeeds`/`graphqlRequest` in `src/gitlab-api.ts`,
  best-effort). `tree-view.ts` builds/caches the whole subtree. Group-(a) green (job-tree + graphql
  tests). **Next:** GCM-21 (live-streaming job log).
- **GCM-21 — live-streaming job log** (planned): replace the one-shot static log document with a
  live tail (`Pseudoterminal` + incremental trace polling; GitLab exposes no trace WebSocket, so
  this is the streaming equivalent — decision `GCM-D1`).
- **GCM-22 — startup + auto-dismiss failure notifications** (planned): notify at startup about a
  branch's **latest** failed pipeline (suppress older, superseded failures), once per `project|ref`;
  and make the failure toast self-dismiss after ~2.5s (no click) via a transient notification.

**Shipped so far (see `CHANGELOG.md`):** `GCM-1`…`GCM-19` — multi-root tree in Explorer + Source
Control, status bar, smart failure notifications (`latestFailedByRef`), change-detection refresh
gate (`pipelinesSignature`), token in Secret Storage, the `ai-project-template` standard, the
`dev`/`rc`/`release` branch model with GitVersion, and the doc-sync CI guard.

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

## Planned / ideas

User-facing feature ideas not yet built land here first (as `GCM-<n>` tasks), then become an
entry in `README.md`'s `## Features` once delivered. Engineering/infra work (CI, release,
tooling, refactors) stays in the Backlog above / `CHANGELOG.md`, never here.

| ID | Status | Task |
|----|--------|------|
| —  | —      | (none yet) |
