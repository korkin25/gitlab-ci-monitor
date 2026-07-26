# Changelog

<p align="center">
  <img src="icon.png" width="96" alt="GitLab CI Monitor — orange dragon" />
</p>

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **GCM-24 — show pipeline stages in execution order, not reversed.** The stage tree listed stages
  in the order GitLab's `/pipelines/:id/jobs` returns jobs — which is **newest-first (descending
  id)**, so the *last* stage (e.g. `commit_job_changes`) showed up *first* and `.pre` last. Stages
  are now ordered by the **smallest job id in each stage**: GitLab creates a pipeline's jobs stage
  by stage, so the earliest stage holds the lowest ids — reproducing the order GitLab's own UI shows
  (`.pre` → … → `.post`). The min is taken over all jobs (not the deduped latest) so a retried job's
  new high id doesn't drag its stage later; `groupJobsByStage` also accepts an optional explicit
  stage order for future use. (`src/job-order.ts`.)

- **GCM-23 — fix the odd/even release version scheme so a clean stable can ship.** Promoting
  `dev` → `rc` had published a pre-release **`0.6.10`** (not the intended `0.5.<N>`), which is
  **above** the `0.6.1` a stable would compute — and since the Marketplace keeps one increasing
  version line across both channels, the stable was un-publishable. Root cause: `rc` had
  `increment: Minor` in `GitVersion.yml`, so GitVersion computed `0.7.0` on `rc` and `release.yml`'s
  `minor-1` formula landed back on the stable's even minor. Fixed by setting `rc` `increment: None`
  (so `rc` keeps `MajorMinorPatch == next-version` and `minor-1` yields the odd minor just below the
  even stable) and bumping `next-version` `0.6.0` → **`0.8.0`** (a clean even minor above the burned
  `0.6.10`). Verified with a local GitVersion dry-run: `rc` → pre-release `0.7.10`, `release` →
  stable `0.8.0`. `release.yml`'s versioning-convention comments were updated to match.

### Added

- **GCM-22 — announce a branch's latest failure at startup, and self-dismiss the toast.** Two
  changes to failure notifications: (1) the notification now fires on **every** poll including the
  first, so a branch whose latest pipeline is already `failed` is announced **at startup** — older,
  already-superseded failures are still never shown (only the branch's latest), and each failure
  still notifies **once** per `project|ref`. The startup-suppression that hid even the current red
  state is gone. (2) The toast is now **self-dismissing**: it needs no click and slides away after
  ~2.5s (a progress notification whose task resolves on a timer), instead of an error message with
  an "Open in GitLab" button that stayed until dismissed. New pure, unit-tested helpers in
  `src/notify.ts` (`pendingFailureNotifications`, `formatFailureMessage`).

- **GCM-21 — job logs stream live into a terminal instead of a static document.** "Stream job log
  (live)" now opens the trace in a `Pseudoterminal` that tails in real time as the job runs: each
  poll fetches the trace and only the newly-appended tail is written, so output arrives
  incrementally, ANSI colors intact, auto-scrolling like a real log. Closing the terminal stops the
  stream; re-opening a still-running job re-focuses the existing one. GitLab exposes no WebSocket for
  a job trace, so the stream is incremental polling of the trace endpoint — the streaming equivalent
  over the API GitLab actually provides (decision **GCM-D1**). New pure, unit-tested core in
  `src/log-stream.ts` (`startLogStream`, `computeDelta`, `isJobFinished`, `toTerminalChunk`,
  `stripSectionMarkers`) with an injectable timer/transport; `getJob` added to `src/gitlab-api.ts`
  to read live job status. The one-shot read-only-document viewer (and its `gitlab-ci-log:` content
  provider) is replaced.

- **GCM-20 — jobs render as a stage tree with the job dependency (`needs`) graph.** A pipeline no
  longer expands into a flat job list. Jobs now nest under their **stage** (each stage node shows
  an aggregate status summarising its jobs), and any job with `needs` is collapsible, revealing
  the jobs it depends on as `↳`-prefixed leaves — the CI DAG, in the tree. Stage grouping comes
  from the REST jobs endpoint (`groupJobsByStage` / `aggregateStageStatus` in `src/job-order.ts`);
  the `needs` edges come from GitLab **GraphQL** (`getJobNeeds` / `parseJobNeeds` in
  `src/gitlab-api.ts`), best-effort — a token without GraphQL access (or an old GitLab) simply
  yields jobs with no dependency edges. The per-pipeline cache now stores the whole stage subtree.

- **GCM-14 — adopt the `ai-project-template` engineering standard (feature #10).** Universal
  agent-rule pickup: `CLAUDE.md` is the single source and `AGENTS.md`, `GEMINI.md`,
  `.cursorrules`, `.clinerules`, `.windsurfrules`, `.github/copilot-instructions.md` are
  symlinks to it, with `.cursor/rules/project.mdc` as a thin pointer and a per-turn
  `.claude/settings.json` hook re-injecting the context map. `CLAUDE.md` was rewritten to the
  full standard (Start-here context-map router, Testing policy a/b/c, Versioning, Safe
  autonomy, Agent security working agreements, Design-before-code, MANDATORY Per-task
  lifecycle). Added `Features.md` (numbered backlog), a **doc-sync** CI guard, **Dependabot**
  (npm + github-actions), **pre-commit** (gitleaks via Docker only), **CODEOWNERS**, PR/issue
  templates, `SECURITY.md`, `CONTRIBUTING.md`, and `CODE_OF_CONDUCT.md`.

### Changed

- **GCM-19 — dropped `Features.md`; user-facing features now live in `README.md` `## Features`.**
  Eliminated the separate root `Features.md` backlog. Its delivered features were reconciled into
  `README.md`'s `## Features` section — the canonical list the VS Code Marketplace / Open VSX
  render — adding the previously-missing "Token in Secret Storage" bullet; not-yet-built ideas
  move to `TODO.md` (Planned / ideas). Purged every `Features.md` reference from `CLAUDE.md`
  (context-map, Features section, doc-sync table, per-task lifecycle), the `.claude/settings.json`
  hook, `.cursor/rules/project.mdc`, the PR/issue templates, `CONTRIBUTING.md`, and the `doc-sync`
  CI guard regex.

- **GCM-18 — stable releases also cut a GitHub Release with the `.vsix` attached.** A merge to
  `release` now, in addition to the Marketplace/Open VSX publish, tags `vX.Y.Z` at the release
  commit and cuts a GitHub Release with auto-generated notes and the built `.vsix` attached
  (`gh release create`, `permissions.contents: write`, `GH_TOKEN`). The `rc` channel stays
  marketplace-only (no tag), so pre-release tags never confuse GitVersion.

- **GCM-17 — Marketplace odd/even-minor versioning.** The VS Code Marketplace has no pre-release *suffix* (unlike PyPI): versions are one increasing `X.Y.Z` line + a `--pre-release` flag. Adopted Microsoft's scheme — stable on an **even** minor (`next-version: 0.6.0` → `release` publishes clean `0.6.0`), pre-release on the **odd** minor just below it (`rc` publishes `0.5.<N>`). Every pre-release stays strictly below the stable it leads to, so nothing collides.

- **GCM-17 — Open VSX publish hardening.** Auto-create the publisher namespace on Open VSX
  (`ovsx create-namespace`, idempotent), drop `--pre-release` for `ovsx` (ignored on a
  prepackaged `.vsix`), and make the Open VSX step non-fatal (`continue-on-error`) so the VS Code
  Marketplace (the primary target) is never blocked by an Open VSX hiccup.
- **GCM-17 — require VS Code >= 1.63** (`engines.vscode` `^1.61.0` → `^1.63.0`). Pre-release
  publishing to the Marketplace (`vsce publish --pre-release`, used on the `rc` channel) needs
  `engines.vscode >= 1.63`; the old floor blocked it. 1.63 (2021) is well below any VS Code in use.
- **GCM-16 — release standard: version from GitVersion, publish on merge (no tags).** Adopted the
  `ai-project-template` release model for a VS Code extension. Added `GitVersion.yml` (clean 6.x
  config, single source of the version). `release.yml` no longer triggers on a `vX.Y.Z` tag — it
  now runs `on: push: branches: [rc, release]`: a merge to `rc` publishes a **pre-release**
  (`vsce publish --pre-release` / `ovsx publish --pre-release`; version `<major>.<minor>.<preReleaseNumber>`
  since the marketplace rejects a `-rc.N` suffix) and a merge to `release` publishes the **stable**
  `majorMinorPatch`. `ci.yml` gained a **`Version`** job (reusing `open-ci-actions@v1` gitversion)
  that proves `GitVersion.yml` parses on every push/PR. The version is injected into `package.json`
  at publish (`npm version <v> --no-git-tag-version`), never hand-bumped; marketplace publishing stays
  opt-in via `VSCE_PAT`/`OVSX_PAT`. `CLAUDE.md`'s "Versioning" section became "Versioning &
  releasing" (GitVersion, merge-to-release). Added a **`Features.md` scope rule** (only
  user-facing product features; engineering/infra work lives in `TODO.md`/`CHANGELOG.md`) and
  **actualized `Features.md`** to the real user-facing features (removed the CI/release/infra
  entries #8–#10; added repo-groups-collapse).
- **GCM-15 — tamed Dependabot noise + doc-sync exemption.** The `doc-sync` guard now skips
  dependency PRs (the `dependencies` label / `dependabot[bot]` actor) — a version bump carries
  no doc change and should not be forced to fake one. `dependabot.yml` now opens **one grouped
  PR per ecosystem** and **ignores breaking major bumps** (e.g. `typescript` 4.x → 7.x,
  `@types/node` 16 → 26 need a deliberate migration as their own task, not a red auto-PR); only
  minor/patch updates are proposed.
- **GCM-14 — CI reuses `open-ci-actions` SAST, and the branch model moved to
  `dev`/`rc`/`release`.** `.github/workflows/ci.yml` now reuses `korkin25/open-ci-actions@v1`
  `sast.yml` for the language-agnostic security gates (gitleaks, semgrep, checkov, trivy) and
  keeps the Node/TypeScript gates bespoke (eslint, prettier, `tsc`, `node --test`, plus a
  `vsce package` smoke that uploads the `.vsix`). The old `main` branch is retired in favour of
  `feature/*` → `dev` → `rc` → `release`; `dev` is the default branch. Versioning stays
  `package.json`-based (no GitVersion) and `release.yml` is unchanged.

## [0.4.2] — 2026-07-24

### Fixed
- **No more notification spam after a failed fetch.** When a poll to GitLab failed (network blip, timeout, 5xx), the repo's pipeline list briefly went empty and the internal "already notified" state got wiped — so on the next successful poll every existing failure was re-announced, and the toasts piled up. A failed fetch now keeps the repo's previous pipelines and notification state untouched (no re-notify, no tree flicker); only a successful fetch updates and prunes state. (GCM-13)

## [0.4.1] — 2026-07-24

### Fixed
- **Smoother tree — no more re-render on every poll.** The tree is now refreshed only when the pipeline data actually changes (a `id:status:ref` signature per project), instead of rebuilding the whole tree every few seconds. Expanded pipelines keep their cached jobs and no longer flicker/re-fetch while nothing has changed. (GCM-12)

### Notes
- While a pipeline stays `running`, its row/jobs update on the next status change (or when you re-expand it) rather than on every poll — the trade-off for removing the constant re-render. Ask if you want live per-job progress for running pipelines back (done smoothly).

## [0.4.0] — 2026-07-24

### Changed
- **Smarter failure notifications.** A pipeline failure now notifies only when it is the **latest** pipeline for its branch (a newer successful/running run on the same branch suppresses it), and only **once per `project + branch` failure** instead of once per pipeline id. Pre-existing failures at startup are recorded silently and never pop up. (GCM-11)

## [0.3.5] — 2026-07-24

### Changed
- **Selecting a repository in the built-in Source Control view now works as an accordion:** the chosen project expands in "Pipelines" and every other repo collapses, so only the current one stays open. (GCM-10)

## [0.3.4] — 2026-07-24

### Added
- **Selecting a repository in the built-in Source Control view expands it in "Pipelines".** Clicking a repo in VS Code's own Source Control repository list now scrolls to and expands that project in our Pipelines panel (same sidebar, no focus jump). Uses the Git extension's `repo.ui.selected` / `onDidChange`; a no-op if the Git extension is unavailable. (GCM-9)

## [0.3.3] — 2026-07-24

### Fixed
- **Clicking a repository expands it in whichever panel you clicked — Explorer or Source Control — without the sidebar jumping.** Expansion is now driven by `reveal()` called *only* on the panel the click (or active file) came from, which is already frontmost, so focus never moves to the other sidebar. This fixes repo clicks in the Source Control "Pipelines" panel doing nothing, and keeps the Explorer panel working. Supersedes the 0.3.1/0.3.2 attempts, which fought VS Code's tree-refresh behavior. (GCM-8)

## [0.3.2] — 2026-07-24

### Fixed
- **Clicking a repository in the Source Control "Pipelines" panel now expands it.** The expand/collapse handlers used to rebuild and refresh the tree in the middle of a click, which replaced the very node being expanded and cancelled it — so repo clicks did nothing in the Source Control panel (Explorer kept working because it also expands via the open file). Native clicks now just record the expansion state; the tree is not rebuilt mid-click. (GCM-7)

## [0.3.1] — 2026-07-24

### Fixed
- **Expanding a project no longer switches sidebars or steals focus.** Opening a file in a project, or expanding a repo in one panel, now expands that repo in **both** panels *in place* — previously it forced the Source Control sidebar to the front. Selecting a repo in the Source Control "Pipelines" view now reliably expands it too. Implemented by driving expansion through the tree model (no `reveal()`). (GCM-6, fixes GCM-5)

### Changed
- CI: move GitHub Actions to the current majors (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`) — clears the last Node 20 runtime deprecation warning.

## [0.3.0] — 2026-07-24

### Added
- **Click a repo to expand it in both panels.** Selecting a repository in either tree (the "GitLab CI" view in Explorer or "Pipelines" in Source Control) now immediately expands and reveals that repository in the other panel too. (GCM-5)

### Changed
- CI: bump GitHub Actions to `actions/checkout@v5`, `actions/setup-node@v5`, and `actions/upload-artifact@v5` (drop the Node 20 runtime deprecation warning).

## [0.2.0] — 2026-07-24

### Added
- Autonomous development governance: `CLAUDE.md` rules, `TODO.md`, `CHANGELOG.md` conventions, `AGENTS.md`, and GitHub Actions CI.
- **Test suite** (`node:test`, zero extra runtime deps) covering the git-remote URL parser, the ANSI/section log cleaner, job ordering, and the GitLab HTTP layer (`buildRequestOptions` + `apiRequest` over a local server). Run with `npm test`. (GCM-1)
- **ESLint + Prettier** (dev-only): ESLint flat config with `typescript-eslint`, Prettier for formatting, and `eslint-config-prettier` to keep them from fighting. New scripts `npm run lint` / `lint:fix` / `format` / `format:check`. CI now runs lint and format check as hard gates. (GCM-2)
- **Token in VS Code Secret Storage.** New commands **“Set GitLab Token (Secret Storage)”** and **“Clear GitLab Token (Secret Storage)”** store the token in the OS keychain instead of plaintext `settings.json`. Tokens are resolved most-secure-first: Secret Storage → `settings.json` `token` (legacy) → `GITLAB_TOKEN`. A plaintext `settings.json` token is auto-migrated into Secret Storage on startup (the setting is left in place; you're told you can remove it). The `GITLAB_TOKEN` env fallback is unchanged. (GCM-3)
- **Release workflow** (`.github/workflows/release.yml`): a SemVer tag (`v*.*.*`) that matches `package.json` runs the full quality gate, builds the `.vsix` with `@vscode/vsce`, and attaches it to a generated GitHub Release. Publishing to the VS Code Marketplace / Open VSX is opt-in via the `VSCE_PAT` / `OVSX_PAT` secrets. (GCM-4)

### Changed
- The `token` field in `settings.json` is now legacy/discouraged — the README documents Secret Storage as the recommended location. (GCM-3)
- **Leaner `.vsix`:** `.vscodeignore` now excludes dev/governance files (`eslint.config.mjs`, Prettier configs, `CLAUDE.md`, `AGENTS.md`, `TODO.md`, `.claude/`), so the published package is just the compiled `out/`, icon, README/CHANGELOG, and LICENSE/NOTICE. (GCM-4)
- **Internal refactor (no behavior change):** pure logic extracted into VS Code-free modules so it is unit-testable — `src/git-url.ts`, `src/ansi.ts`, `src/job-order.ts`, and the whole GitLab REST client in `src/gitlab-api.ts`. `src/pipelines.ts` re-exports the HTTP layer, so existing imports are unaffected.
- Codebase reformatted to the Prettier style (tabs, single quotes, 120-col) and made lint-clean. (GCM-2)

## [0.1.6] — 2026-07-24

### Fixed
- **Job log is fully cleaned.** All ANSI/CSI/OSC escape sequences, GitLab `section_start/end` markers and stray carriage returns are stripped — no more `␛[0K` garbage.
- **No "save?" prompt.** The log now opens as a read-only virtual document, so closing the tab never asks to save.

## [0.1.5] — 2026-07-24

### Changed
- Icon: a classic orange dragon — clear and recognizable at a glance.

## [0.1.3] — 2026-07-24

### Added
- Extension icon (orange dragon).

## [0.1.2] — 2026-07-24

### Fixed
- **Repo groups no longer collapse themselves.** Expansion state is now remembered, so a group you open stays open across the periodic refresh (previously the tree rebuilt every few seconds with everything collapsed).

### Changed
- Clicking / expanding a repo shows its pipelines and stays put; the repo of the active editor auto-expands (SCM-graph-like focus on the current project).

## [0.1.1] — 2026-07-24

### Changed
- **Jobs are cached.** The tree now reads jobs from an in-memory cache instead of hitting the GitLab API on every expand/refresh. Finished pipelines keep their jobs for 10 minutes (they never change); running pipelines use a short TTL; a pipeline's cache is invalidated when its status changes. This removes the lag when expanding pipelines.

### Notes
- Job logs open in a normal editor tab (`View job log`), so fragments can be selected and pasted into AI chats / plugins.

## [0.1.0] — 2026-07-24

Initial release. Derived from [`gitlab-pipelines`](https://github.com/Jameswain/gitlab-pipelines) by jameswain (ISC).

### Added
- **Multi-root workspace support** — every workspace folder that is a git repo and contains a `.gitlab-ci.yml` is watched; pipelines are grouped per repository (repo → pipelines → jobs).
- **Source Control + Explorer views** — the tree is shown in both panels.
- **Status bar indicator** — pipeline status of the active editor's repo/branch; click to open in GitLab; follows the active editor.
- **Failure notifications** — desktop notification when a watched pipeline transitions to `failed` (`notifyOnFailed`, default `true`).
- **Actions** — retry / cancel a pipeline (inline), open pipeline or job in GitLab (click), view a job's log (context menu).
- **Active-repo auto-expand** — repo groups collapse by default; the active editor's repo expands.
- **`GITLAB_TOKEN` fallback** — when no token is set in `settings.json`, the `GITLAB_TOKEN` environment variable is used if present.

### Changed vs. upstream
- HTTP layer rewritten on Node's built-in `https` — **no runtime dependencies**.
- Removed the `curl --insecure` TLS-bypass fallback (no longer disables certificate verification).
- Dropped the unrelated `boot.conf` / game-metadata status-bar feature.
