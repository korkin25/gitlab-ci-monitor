# Changelog

<p align="center">
  <img src="icon.png" width="96" alt="GitLab CI Monitor — orange dragon" />
</p>

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

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
