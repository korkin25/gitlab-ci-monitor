# TODO

## Current state / next action

**`0.8.0` (STABLE) is LIVE — all three features shipped.** `GCM-20`/`GCM-21`/`GCM-22` were merged to
`dev` (PRs #15/#16/#17) and released through `dev` → `rc` → `release`: **stable `0.8.0`** is on the
VS Code Marketplace + Open VSX, with a GitHub Release (`v0.8.0`) carrying the `.vsix`.

- **GCM-20 — jobs as a stage tree + `needs` dependency tree** ✅ (PR #15).
- **GCM-21 — live-streaming job log** ✅ (PR #16) — `Pseudoterminal` tail, incremental polling
  (no trace WebSocket, decision `GCM-D1`).
- **GCM-22 — startup + auto-dismiss failure notifications** ✅ (PR #17).
- **GCM-23 — version scheme fixed** ✅ (PR #18). Root cause: `rc` `increment: Minor` made GitVersion
  overshoot the minor, so `release.yml`'s `minor-1` collided with the stable and shipped `0.6.10` as
  a pre-release (above the `0.6.1` a stable would compute → Marketplace rejected the stable). Fix:
  `rc` `increment: None` + `next-version` bumped past the burned `0.6.10`. Release timeline:
  `0.6.10` (buggy pre-release, superseded) → `0.7.14` (fixed pre-release) → **`0.8.0`** (stable).

**GCM-25 — version scheme SIMPLIFIED (replaces the odd/even scheme).** Each promotion now bumps a
higher SemVer position: `dev` = Patch (not published), `rc` = Minor → **pre-release**, `release` =
Major → **stable**. `release.yml` publishes plain `X.Y.Z` (rc → `major.minor.<commit count>`,
release → `majorMinorPatch`); no more `MINOR-1` / odd-even. `next-version` seeds the first cycle;
after a stable ships, its tag drives the increments. Dry-run gate before any `rc`/`release` push
stays mandatory (`docker run … gittools/gitversion:6.8.2 /repo /showvariable MajorMinorPatch`).

**Pending release (this cycle):** `next-version = 0.10.0`. Dry-run verified: `rc` → pre-release
**`0.10.5`** (`> 0.9.4` live floor), `release` → stable **`1.0.0`**. `GCM-24` (stage execution
order, already on `dev`) ships in it. Marketplace floor is `0.9.4` (a pre-release from an
interrupted push before the scheme change).

**Next action:** merge `GCM-25` (PR) → `dev`; then (on user "go") promote `dev` → `rc` (publishes
`0.10.5`) → `release` (publishes stable `1.0.0`).

**Shipped so far (see `CHANGELOG.md`):** `GCM-1`…`GCM-22` — multi-root tree in Explorer + Source
Control, **stage/dependency job tree**, **live-streaming job log**, status bar, smart failure
notifications (latest-at-startup, self-dismissing), change-detection refresh gate, token in Secret
Storage, the `ai-project-template` standard, the `dev`/`rc`/`release` branch model with GitVersion,
and the doc-sync CI guard.

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
