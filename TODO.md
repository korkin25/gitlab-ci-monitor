# TODO

## Current state / next action

- **GCM-19 done** (2026-07-26): **dropped the standalone feature-backlog file.** User-facing
  features now live in `README.md`'s `## Features` section (the canonical, Marketplace-rendered
  list); backlog and ideas live here in `TODO.md` (Planned / ideas). Every reference to the old
  root backlog file was purged from `CLAUDE.md`, the `.claude/settings.json` hook,
  `.cursor/rules/project.mdc`, the PR/issue templates, `CONTRIBUTING.md`, and the `doc-sync`
  guard regex.
- **GCM-14 in progress** (2026-07-26): **adopt the `ai-project-template` engineering standard**
  (feature #10), adapted for a TS VS Code extension. Branch model migrated `main` →
  `dev`/`rc`/`release` (`dev` default; `main` legacy). Done on `feature/GCM-14-full-standard`:
  CI reuses `open-ci-actions@v1` `sast.yml` + bespoke Node gates (eslint/prettier/tsc/`node
  --test`/`vsce package`); universal agent-rule symlinks + `.claude/settings.json` hook +
  `.cursor/rules/project.mdc`; `CLAUDE.md` rewritten to the full standard (context-map router /
  Testing policy / Versioning=package.json / Safe-autonomy / Agent-security / Design-before-code
  / Per-task lifecycle); the feature backlog, `doc-sync.yml`, Dependabot, pre-commit (gitleaks-only),
  CODEOWNERS, PR/issue templates, SECURITY/CONTRIBUTING/CoC. `.gitlab-ci.yml` skipped (no Node
  GitLab template). `release.yml` unchanged. **Next:** push branch → PR to `dev` → analyze CI
  logs (even if green) → merge with `--no-ff` once green.
- **State:** `GCM-1`–`GCM-6` done. Tooling: `node:test` suite (28 green tests),
  ESLint + Prettier (lint-clean), token in Secret Storage, tag-triggered release workflow.
  Latest: `GCM-6` — expanding a project (via file open or repo click) now expands it in
  both panels **in place**, without switching sidebars/focus (replaced `reveal()` with
  tree-model expansion; `GCM-5`'s reveal caused the focus jump). Shipped in `v0.3.1`.
- **Latest:** `GCM-9` (`v0.3.4`) — selecting a repository in the **built-in** Source Control
  view now expands that project in our "Pipelines" panel, via the Git extension API
  (`repo.ui.selected` / `onDidChange`). `revealRepoByPath` in `tree-view.ts`;
  `wireBuiltInScmSelection` in `extension.ts`. (GCM-8/v0.3.3 fixed clicks inside our own
  panels + no sidebar jump.)
- **Also:** `GCM-10` (`v0.3.5`) — built-in SCM selection is an accordion (only the current
  project stays expanded in "Pipelines"). `GCM-11` (`v0.4.0`) — smarter failure notifications:
  notify only when the failure is the branch's latest pipeline, once per `project|ref`
  (`latestFailedByRef` in `src/notify.ts` + `notifiedFailureByRef` map).
- **Also:** `GCM-12` (`v0.4.1`) — tree refreshes only when pipeline data changes
  (`pipelinesSignature` in `src/signature.ts` + `lastSignature` gate), so it stops
  re-rendering/re-fetching expanded jobs every poll. Trade-off: running pipelines update on
  status change, not every second (offer live per-job mode via node memoization if asked).
- **Also:** `GCM-13` (`v0.4.2`) — a failed GitLab poll no longer wipes the repo's pipeline
  list or the notification dedup, so transient fetch errors stop causing notification spam
  (previous items/ids are kept; only successful fetches update/prune state).
- **Verify (UI, pending):** accordion in built-in Source Control; smart failure notifications
  (once, latest-per-branch, no spam on flaky network); smooth/cached job expansion.
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

## Planned / ideas

User-facing feature ideas not yet built land here first (as `GCM-<n>` tasks), then become an
entry in `README.md`'s `## Features` once delivered. Engineering/infra work (CI, release,
tooling, refactors) stays in the Backlog above / `CHANGELOG.md`, never here.

| ID | Status | Task |
|----|--------|------|
| —  | —      | (none yet) |
