# Autopilot log — gitlab-ci-monitor

Autonomous changes (user authorized full autopilot on these repos). Newest first.

## 2026-07-26 — Release 0.6.10 (pre-release) + GCM-23: version-scheme bug found

- **Published `0.6.10` (pre-release) with GCM-20/21/22.** After merging the three features to `dev`
  (PRs #15/#16/#17, all CI green), promoted `dev` → `rc` (fast-forward). `release.yml` published a
  **pre-release** to the VS Code Marketplace (`Published korkin25.gitlab-ci-monitor v0.6.10`) and
  Open VSX (`Published korkin25.gitlab-ci-monitor v0.6.10`). All three features are live via the
  pre-release channel.
- **Stopped before the stable `release` (user decision).** A stable cut computes GitVersion `0.6.1`
  (`release` increments Patch over `next-version: 0.6.0`), which is **below** the live `0.6.10`, so
  the Marketplace would reject it. Verified locally with a GitVersion dry-run on a non-pushed
  `release` merge (`/showvariable MajorMinorPatch` → `0.6.1`). Reset the local `release` back to
  `origin/release`; **no stable publish was attempted.**
- **Filed `GCM-23`** (see `TODO.md`) for the pre-existing odd/even release-version bug: `rc`'s
  `increment: Minor` makes GitVersion `0.7.0` on `rc`, and `release.yml`'s `MINOR-1` formula yields
  `0.6.<commitCount>` instead of the intended `0.5.<N>`, so the pre-release lands above the stable.
  Fix design + a local-dry-run gate are recorded in `TODO.md`. This is release infra, not one of the
  three feature changes.

- **Announce a branch's latest failure at startup.** Failure notifications previously suppressed
  everything on the first poll (GCM-11's baseline), so you never learned at startup that your latest
  pipeline was red. Now the notification fires on every poll including the first: a branch whose
  latest pipeline is `failed` is announced at startup, while older/superseded failures stay hidden
  (still only the branch's latest, via `latestFailedByRef`) and each failure still fires once per
  `project|ref`. Removed the `baselineDone` gate.
- **Self-dismissing toast.** The failure notification no longer stays until dismissed (an Error
  message with an "Open in GitLab" button did). It is now a progress notification whose task resolves
  on a ~2.5s timer, so it needs no click and slides away on its own (`showTransientFailure` +
  `FAILURE_TOAST_MS` in `tree-view.ts`).
- **Pure, unit-tested** decision logic extracted to `src/notify.ts`: `pendingFailureNotifications`
  (startup-notify + once-each dedup) and `formatFailureMessage`. _Reverse:_ revert the branch;
  git history holds the previous notifier.

## 2026-07-26 — GCM-21: live-streaming job log (Pseudoterminal)

- **Replaced the one-shot static log document with a live tail.** "Stream job log (live)" now opens
  the trace in a VS Code `Pseudoterminal`; the trace is polled and only the newly-appended tail is
  written each time, so a running job's log streams in incrementally, ANSI colors intact,
  auto-scrolling. Closing the terminal stops the stream; a second open re-focuses the live terminal.
- **Decision `GCM-D1`: no WebSocket.** GitLab exposes no WebSocket for a CI job trace (its own web UI
  polls the trace endpoint). "Streaming" is therefore incremental polling — the honest equivalent
  over the API GitLab actually provides. Documented in `src/log-stream.ts` and the CHANGELOG.
- **Pure, unit-tested core** in `src/log-stream.ts` (`startLogStream` with injectable timers,
  `computeDelta`, `isJobFinished`, `toTerminalChunk`, `stripSectionMarkers`). Added `getJob` to
  `src/gitlab-api.ts` for live status. The `gitlab-ci-log:` virtual-document content provider was
  removed; `src/ansi.ts` is left in place (the terminal renders ANSI, so `stripAnsi` is unused but
  the tested utility is kept). _Reverse:_ revert the branch; the previous document viewer is in git
  history.

## 2026-07-26 — GCM-20: jobs as a stage tree + `needs` dependency tree

- **Pipelines now expand into `stage → job → dependency` nodes** instead of a flat job list. Pure,
  unit-tested tree logic in `src/job-order.ts`: `groupJobsByStage` (dedupe-latest, drop canceled,
  first-seen stage order), `aggregateStageStatus` (stage-node status summary), `resolveNeeds`
  (job-name → `{name,status}` from the deduped jobs).
- **`needs` DAG via GitLab GraphQL.** REST does not expose job `needs`, so added a GraphQL layer to
  `src/gitlab-api.ts` (`buildGraphqlUrl`, `graphqlRequest` POST, `parseJobNeeds`, `getJobNeeds`) —
  zero new runtime deps (Node `https`). Best-effort: any GraphQL failure degrades to "no dependency
  edges", so a token without GraphQL scope still shows the full stage tree. _Reverse:_ revert the
  branch; the REST path is untouched.
- **`tree-view.ts`** builds the subtree once per pipeline (`buildStageTree`) and caches it (same
  TTL model as before); `getChildren` now walks stage/job/dependency levels. Node ids namespaced by
  pipeline id to stay unique across the tree.

## 2026-07-26 — GCM-19: drop the separate feature backlog file

- **Eliminated the standalone root feature-backlog file.** User-facing product features now live
  in `README.md`'s `## Features` section (the canonical list the VS Code Marketplace / Open VSX
  render); backlog
  and ideas live in `TODO.md` (Planned / ideas). The delivered features were reconciled into
  `README.md` (adding the previously-missing "Token in Secret Storage" bullet) before deletion.
- **Purged every reference** to the old file: `CLAUDE.md` (context-map, Features section,
  doc-sync table, per-task lifecycle), the `.claude/settings.json` hook,
  `.cursor/rules/project.mdc`, PR/issue templates, `CONTRIBUTING.md`, and the `doc-sync` guard
  regex. _Reverse:_ restore the file and its references from git history.

## 2026-07-26 — GCM-14: adopt the ai-project-template standard (adapted for a VS Code extension)

- **CI now reuses `korkin25/open-ci-actions@v1` `sast.yml`** for the language-agnostic gates
  (gitleaks, semgrep, checkov, trivy-config; `has-python`/`has-dockerfile` = false so the
  Python/Dockerfile jobs self-skip) and keeps the **Node/TypeScript** gates bespoke — eslint,
  prettier `--check`, `tsc`, `node --test`, and a `vsce package` smoke that uploads the `.vsix`.
  open-ci-actions has no Node workflow yet; if a second Node project appears, promote these.
  _Reverse:_ restore the previous inline `ci.yml` from git history.
- **Branch model migrated** `main` → `dev`/`rc`/`release`. `dev` is the default branch; `main`
  is kept only as legacy history. `release.yml` (tag-triggered marketplace publish) is unchanged
  — it is the vendored release path.
- **Versioning stays package.json-based** (no GitVersion): the marketplace/`.vsix` require the
  version in `package.json`, and `release.yml` already enforces tag == package.json.
- **Universal agent-rule pickup.** `CLAUDE.md` is the single source; `AGENTS.md`, `GEMINI.md`,
  `.cursorrules`, `.clinerules`, `.windsurfrules`, `.github/copilot-instructions.md` are
  symlinks to it, and `.cursor/rules/project.mdc` is a thin pointer. The old `AGENTS.md` pointer
  was folded away (its content is canonical in `CLAUDE.md`).
- **CLAUDE.md rewritten to the full standard**, adapted: Start-here context-map router, a
  **Testing policy** (groups a/b/c — unit/`node --test` vs Extension-Host vs human UX), a
  **Versioning** section (package.json), **Build/CI composition**, **Design-before-code**,
  **Safe autonomy**, **Agent security working agreements**, and the MANDATORY **Per-task
  lifecycle**. GCM-<n> ids, zero-runtime-deps and the ISC fork attribution are preserved.
- **Added** a numbered feature backlog (later dropped by GCM-19), a **doc-sync** CI guard, **Dependabot** (npm +
  github-actions), **pre-commit** (gitleaks via Docker only), **CODEOWNERS**, PR/issue
  templates, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and a `.claude/settings.json`
  per-turn hook.
- **Deliberately skipped `.gitlab-ci.yml`.** The GitLab twin (`open_ci_cd/templates`) is
  Python/Docker/Helm-oriented and has no Node/VS-Code template, and this extension is
  GitHub/marketplace-hosted, so a GitLab mirror would add no value. Revisit if a Node GitLab
  template is built.

**Guardrails honored:** feature branch `feature/GCM-14-full-standard` off `dev`; no history
rewrite; no secret touched; `release.yml`, `LICENSE`, `NOTICE` untouched; License stays ISC.
