# Changelog

<p align="center">
  <img src="icon.png" width="96" alt="GitLab CI Monitor — orange dragon" />
</p>

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Autonomous development governance: `CLAUDE.md` rules, `TODO.md`, `CHANGELOG.md` conventions, `AGENTS.md`, and GitHub Actions CI.

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
