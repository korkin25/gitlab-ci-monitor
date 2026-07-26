# TODO

## Current state / next action

**`1.0.0` (STABLE) is LIVE.** All shipped features are on the VS Code Marketplace + Open VSX, with a
GitHub Release (`v1.0.0`) carrying the `.vsix`.

**Version scheme (GCM-25).** Each promotion bumps a higher SemVer position: `dev` = Patch (not
published), `rc` = Minor → **pre-release**, `release` = Major → **stable**. `release.yml` publishes
plain `X.Y.Z` (rc → `major.minor.<commit count>`, release → `majorMinorPatch`). **Self-sustaining
from here:** the `v1.0.0` tag is now the floor, so the next cycle needs **no `next-version` bump** —
`dev` → `1.0.x`, `rc` → `1.1.<N>` (pre-release), `release` → `2.0.0` (stable). A local GitVersion
dry-run before any `rc`/`release` push stays **mandatory** (must be strictly above the highest
published version, else the Marketplace rejects it and the number is burned).

**Release history:** `0.6.10` (odd/even bug, superseded) → `0.7.14` (pre) → `0.8.0` (stable) →
`0.9.4` (pre, interrupted push) → `0.10.7` (pre, new scheme) → **`1.0.0`** (stable, current).

**In flight — GCM-26/27/28/29 (context-menu interactions).** On `feature/GCM-26-context-menu-actions`:
(26) **click a job = stream log**, right-click = open in GitLab (swapped); (27) right-click
**retry/cancel/play** on jobs and retry/cancel on pipelines (status-driven context values); (28)
right-click a pipeline → **open its commit**; (29) **"Retry" only on failed/canceled** pipelines +
new **"Run new pipeline"** (fresh run on the ref) — fixes the "retry does nothing" confusion. New
REST wrappers `retryJob`/`cancelJob`/`playJob`/`runPipeline` + `commitUrl` in `src/gitlab-api.ts`
(group-(a) green, 69 tests). **Next:** PR → `dev`, then `dev` → `rc` to publish a pre-release
`1.1.<N>` for testing. **Stable `release` is on hold** (user: rc only for now).

**Shipped (see `CHANGELOG.md`):** `GCM-1`…`GCM-25` — multi-root tree in Explorer + Source Control,
**stage/dependency job tree** (ordered by execution), **live-streaming job log**, status bar, smart
failure notifications (latest-at-startup, self-dismissing), change-detection refresh gate, token in
Secret Storage, the `ai-project-template` standard, the `dev`/`rc`/`release` GitVersion model, and
the doc-sync CI guard.

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
| GCM-24 | 🟡 | Order stage tree by execution (min job id per stage), not API first-seen — bug reported against `0.8.0`; heads to `0.10.0` |

## Backlog

The initial backlog (`GCM-1`…`GCM-4`) is complete — see `CHANGELOG.md`. New candidates below;
prioritize and confirm with the user before starting, each delivered test-first.

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
