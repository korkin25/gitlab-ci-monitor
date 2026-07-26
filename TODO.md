# TODO

## Current state / next action

**`0.6.10` (pre-release) is LIVE with all three features.** `GCM-20`/`GCM-21`/`GCM-22` are merged to
`dev` (PRs #15/#16/#17, CI green) and were promoted `dev` → `rc`, which published a **pre-release
`0.6.10`** to the VS Code Marketplace + Open VSX. All three features are installable now via the
pre-release channel.

- **GCM-20 — jobs as a stage tree + `needs` dependency tree** ✅ (PR #15).
- **GCM-21 — live-streaming job log** ✅ (PR #16) — `Pseudoterminal` tail, incremental polling
  (no trace WebSocket, decision `GCM-D1`).
- **GCM-22 — startup + auto-dismiss failure notifications** ✅ (PR #17).

**GCM-23 — version scheme FIXED (verified via local dry-run).** The stable `release` was blocked
because the `rc` publish came out as `0.6.10` (not the intended `0.5.<N>`), above the `0.6.1` a
stable would compute → Marketplace would reject the stable. Fixed in `GitVersion.yml`: `rc`
`increment: Minor` → `None` (so `rc` keeps `MajorMinorPatch == next-version`, and release.yml's
`minor-1` yields the odd minor just below stable), and `next-version` `0.6.0` → `0.8.0` (clean even
minor above the burned `0.6.10`). A local GitVersion dry-run confirms: `rc` → pre-release **`0.7.10`**
(odd, `> 0.6.10`, `< 0.8.0`), `release` → stable **`0.8.0`** (even, above everything). release.yml
comments updated to match.

**Next action:** merge `GCM-23` (PR #18) → `dev`, then promote `dev` → `rc` (publishes `0.7.10`
pre-release) → `release` (publishes stable **`0.8.0`** + GitHub Release).

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
| GCM-23 | 🟡 | Fix the release version scheme so a clean stable can supersede the live `0.6.10` pre-release |

## Backlog

The initial backlog (`GCM-1`…`GCM-4`) is complete — see `CHANGELOG.md` → Unreleased.
New candidates below; prioritize and confirm with the user before starting, each
delivered test-first.

### GCM-23 — release version scheme (odd/even) is broken

**Symptom.** Promoting `dev` → `rc` published a **pre-release `0.6.10`** (not the `0.5.<N>` the
config comments intend). A subsequent stable would be GitVersion `0.6.1` (`release` increments
Patch over `next-version: 0.6.0`), which is **below** the live `0.6.10`, so the Marketplace rejects
it — stable `release` is blocked.

**Root cause.** `GitVersion.yml` gives the `rc` branch `increment: Minor`, so GitVersion computes
`MajorMinorPatch = 0.7.0` on `rc` (a minor above `next-version`). `release.yml`'s rc formula
`V = ${MAJOR}.$((MINOR - 1)).${PRE}` then yields `0.6.<commitsSinceVersionSource>` = `0.6.10` — an
**even** minor that collides with the intended stable minor, and a patch (`10`) that can exceed the
stable patch. So the pre-release ends up **above**, not below, the stable it should precede.

**Fix (design, do test-first with a local GitVersion dry-run):**
1. Make the `rc` GitVersion increment stop overshooting the minor (e.g. `rc` `increment: None`/align
   with `next-version`) so the rc formula produces the intended odd-minor-below-stable (`0.5.<N>`),
   **or** rework `release.yml` to derive the pre-release from the stable minus one minor explicitly.
2. Because `0.6.10` is already burned on the Marketplace, bump `next-version` **above** `0.6.10`
   (e.g. `0.8.0`, keeping stable on an even minor per Microsoft) so the next stable supersedes it.
3. **Gate:** before pushing `rc`/`release`, dry-run GitVersion locally
   (`docker run --rm -v "$PWD:/repo" gittools/gitversion:6.8.2 /repo /showvariable ...`) on both
   branches and assert `pre-release < stable` and `stable > 0.6.10`.

| ID | Status | Task |
|----|--------|------|
| GCM-23 | 🟡 | Release version scheme fix (details above) — then cut a clean stable > `0.6.10` |

## Planned / ideas

User-facing feature ideas not yet built land here first (as `GCM-<n>` tasks), then become an
entry in `README.md`'s `## Features` once delivered. Engineering/infra work (CI, release,
tooling, refactors) stays in the Backlog above / `CHANGELOG.md`, never here.

| ID | Status | Task |
|----|--------|------|
| —  | —      | (none yet) |
