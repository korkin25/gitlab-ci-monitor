# Autopilot log — gitlab-ci-monitor

Autonomous changes (user authorized full autopilot on these repos). Newest first.

## 2026-07-26 — GCM-41: label job `needs` explicitly (not a bug, a clarity fix)

- **User report:** `default_build` shown under `default_sign` looked like a bug ("can't be in
  default_sign"). It's the **`needs` DAG** (GCM-20): `default_sign` needs `default_build` — correct.
  The `↳ ✅ name` label just read as nesting. Changed the dep label to `↳ needs ✅ name` and the
  tooltip to "…a dependency this job waits for". Label-only change in `createDepNode`.

## 2026-07-26 — GCM-40: web sign-in + multi-GitLab (already supported) discoverability

- **User ask:** support several GitLab instances (public + private) and web-based auth (OAuth or
  similar). **Finding:** multi-host is ALREADY supported — `getAllConfigs`/`getExtensionSettings` key
  everything by the git-remote host, tokens are per-host in SecretStorage, `setToken` already picks
  the host. Confirmed; no code needed for #1.
- **Auth (user chose "web-PAT" over full OAuth):** OAuth apps are per-instance (no universal
  client_id) and gitlab.com tokens expire (2h → refresh) — heavy. So added **"Sign in to GitLab
  (Web)"** (`gitlabCiMonitor.signIn`): opens `patCreationUrl(host,'vscode-gitlab-ci-monitor','api')`
  (`/-/user_settings/personal_access_tokens?name=…&scopes=api`) in the browser via `env.openExternal`,
  then stores the pasted token per host. Works on any instance, zero-dep, no refresh. Full OAuth PKCE
  deferred (would need a registered gitlab.com OAuth app).
- **Discoverability (user couldn't find "Set GitLab Token"):** added `viewsWelcome` on both views with
  **Sign in to GitLab** / **Set it manually** buttons shown when empty, plus a sign-in icon in the
  view title. `patCreationUrl` is pure/tested.

## 2026-07-26 — GCM-38/39: live log as tail + loading spinner for pipelines

- **GCM-38 — live log is a `tail`.** Big logs made the live view slow because we downloaded the whole
  trace. Now `fetchJobTraceRange` (HTTP `Range`) pulls only the last ~64 KiB / 200 lines initially,
  then appends only new bytes from the last offset each poll. `startLogStream` was reworked from
  string-delta to a **byte-offset** model (`fetchTail(fromByte)` dep); new pure helpers
  `dropPartialFirstLine`/`lastLines`/`parseContentRangeTotal` (tested). Graceful fallback when GitLab
  ignores `Range` (200 → slice the full body). The terminal header notes "live tail — last N lines".
  Rationale (user): the full log is on GitLab; live = tail for a devops.
- **GCM-39 — loading spinner instead of an empty pipeline.** Per the user's UX: expand → if cached,
  show; else spin and keep refreshing until data arrives, then show. `getChildren` now returns a
  spinning `createLoadingNode` (ThemeIcon `sync~spin`) when a fetch fails and there is no stale cache,
  while the GCM-32 background retry keeps trying; on success the refresh replaces the spinner. Genuine
  zero-job pipelines still show empty.
- **WebSocket (re-asked):** reaffirmed GitLab has no PAT-authable pipeline-status WebSocket (its own UI
  polls; GraphQL subscriptions are limited/ActionCable/fragile) — the continuous-update equivalent is
  the adaptive polling already shipped in GCM-35 (~2s while running).

## 2026-07-26 — GCM-37: drop redundant "Skip (no token)" release steps

- **User feedback:** the release run showed "Publish to VS Code Marketplace" (ran) next to "Skip VS
  Code Marketplace publish (no token)" (skipped) — mutually-exclusive noise. Removed both `Skip …
  (no token)` echo steps from `release.yml`; a token-gated publish already renders as *skipped* when
  its secret is absent, so the extra step added nothing. Publish steps keep their `if` guards.

## 2026-07-26 — GCM-35/36: adaptive polling + trimmed pipeline label

- **GCM-35 — adaptive polling (live without Refresh).** GitLab has no pipeline-status WebSocket (its
  own UI polls), so instead of a fixed `setInterval` the refresh loop self-schedules: `pollOnce`
  re-arms via `nextPollDelay(hasRunningPipelines(), idleMs, fastMs)` — ~2s while running, the
  configured interval (5s) when idle. Pure `nextPollDelay` in `src/poll.ts` (tested);
  `hasRunningPipelines()` exposed from `tree-view.ts`. Explained to the user why a real GitLab
  WebSocket isn't feasible (no PAT-authable pipeline-status socket; zero-dep rule).
- **GCM-36 — trimmed the pipeline label.** Dropped the `success`/`failed` word (the emoji says it):
  label is now `#id · ref · duration`.

## 2026-07-26 — GCM-33/34: open-pipeline menu item + finish flash

- **GCM-33 — "Open pipeline in GitLab"** added to the pipeline right-click menu (`pipeline.open`,
  same handler as `pipeline.click`).
- **GCM-34 — finish flash.** On a status transition into a finished state the node's icon flashes
  briefly — ✨ success, 💥 failed (⚪/🔵 canceled/skipped) — then reverts. Implemented by swapping the
  node's `label` in place (no re-fetch): `flashableLabel` stores the normal label and returns the
  bright one while `flashUntil[key]` is live; `startFlash` is called from `trackStatus` (pipelines)
  and `buildStageTree` (jobs, vs `lastJobStatus`); one `ensureFlashClear` timer restores labels and
  re-renders after `FLASH_MS` (330ms). Pure `shouldFlash` in `src/flash.ts` (transition into
  success/failed/canceled/skipped) is unit-tested; the visual is group-(b).
- **GCM-32 reworked → background retry.** The failed-jobs retry is no longer "while expanded" — a
  `jobRetryQueue` + single timer re-fetch in the BACKGROUND (every 3s) any pipeline whose jobs failed
  to load, regardless of expand state, so the data is ready when the user returns; pipelines that drop
  out of the list are removed from the queue.

## 2026-07-26 — GCM-30/31/32: stop/logs/run buttons, durations, cache fix

- **GCM-30 (supersedes GCM-29's retry tweak).** Removed the pipeline-level **Retry** action entirely
  (`pipeline.retry` command + `retryPipeline` API + menus) — the user found it confusing. Inline
  buttons now: **Stop** (running pipeline `pipeline.cancel`, running job `pipeline.job.cancel`),
  **Open job log** (live, `pipeline.job.log`) on every job, **Run new pipeline** on finished
  pipelines. Renamed the cancel titles to "Stop …". Job retry/play stay in the job's right-click menu.
  Pipeline `contextValue` simplified to `pipelineItemRunning` / `pipelineItemDone`.
- **GCM-31 — run durations** on every pipeline/job label: live-ticking elapsed while running, final
  run time when finished. Pure `src/duration.ts` (`formatDuration`/`jobDurationSeconds`/
  `pipelineDurationSeconds`, tested with injected `now`). To make running durations tick, the
  change-detection signature gains a per-poll counter **only while something is running** (idle stays
  stable, preserving the GCM-12 no-flicker behavior); this also refreshes running jobs each poll.
- **GCM-32 — fix "expanded but empty" pipelines + auto-retry.** A timed-out `getPipelineJobs` was
  cached as "no jobs", so the pipeline stayed empty until the 10-min TTL. Now the fetch error
  propagates (`buildStageTree` no longer swallows it) and `getChildren` does not cache the failure;
  it also **keeps retrying** — `scheduleJobRetry` fires a node refresh every `JOBS_RETRY_MS` (3s),
  which re-runs `getChildren` only while the node stays expanded (collapsed → loop stops), one retry
  pending per pipeline. So a transient timeout self-heals without the user re-expanding.
- Tests: 77 group-(a) green (duration helpers + earlier http/timer patterns).

## 2026-07-26 — GCM-29: fix "Retry pipeline" confusion + add "Run new pipeline"

- **User report:** the inline "Retry pipeline" icon seemed to do nothing. Cause: it showed on ANY
  non-running pipeline, but GitLab's `POST /pipelines/:id/retry` only re-runs a pipeline's
  **failed/canceled** jobs — on a green pipeline it is a no-op, and the only feedback was a brief
  status-bar message.
- **Fix:** "Retry" is now offered **only on failed/canceled pipelines** (new context value
  `pipelineItemDone` for finished-clean ones, which get "Run new pipeline" instead). After a retry the
  pipeline's jobs cache is invalidated and the tree re-renders.
- **Added "Run new pipeline"** (`runPipeline` → `POST /pipeline?ref=…`) — a fresh run on the ref,
  which is likely what "retry" was expected to do. Inline on finished pipelines + in every pipeline's
  right-click menu. Path-assertion test added (69 group-(a) green).

## 2026-07-26 — GCM-26/27/28: context-menu interactions

- **GCM-26 — swapped job click/right-click.** Left-click a job now streams its live log (the common
  action); the right-click menu opens it in GitLab. The job node's `command` points at
  `pipeline.job.log` (carrying the node as its arg); `pipeline.click` moved to the context menu.
- **GCM-27 — retry/cancel/play from the right-click menu**, on both levels. Pipelines: retry/cancel
  (also inline). Jobs: retry (finished) / cancel (running) / play (manual), gated by status-driven
  context values (`jobItemRunning`/`jobItemManual`/`jobItemRetryable`) so only the applicable action
  shows. New REST wrappers `retryJob`/`cancelJob`/`playJob` (`src/gitlab-api.ts`, injectable
  transport for tests); after an action the pipeline's cached jobs are invalidated
  (`invalidatePipelineJobs`) and the tree re-renders so the change shows at once.
- **GCM-28 — open a pipeline's commit.** "Open commit in GitLab" derives the commit page from the
  pipeline `web_url` + `sha` (`commitUrl`, pure/tested). Pipeline node now carries `sha`.
- **Tests:** 68 group-(a) green — `commitUrl` (derive + empty-input), and `retryJob`/`cancelJob`/
  `playJob` path assertions via a local http server. The menu/click behavior is group-(b)
  (Extension Host). package.json gained the four commands + context-menu entries.

## 2026-07-26 — Stable 1.0.0 released (new scheme, GCM-24 + GCM-25)

- **Released stable `1.0.0`** (user "go"). Promoted `dev` → `rc` → `release` under the new GCM-25
  scheme: `rc` published pre-release **`0.10.7`**, then `release` published **stable `1.0.0`** to the
  VS Code Marketplace + Open VSX, with GitHub Release `v1.0.0`. Verified each with a GitVersion
  dry-run before pushing (rc `0.10.7 > 0.9.4`; release `1.0.0 > 0.10.7`). Carries GCM-24 (stage
  execution order).
- **No post-release chore needed.** Unlike the odd/even scheme, this one is self-sustaining: the
  `v1.0.0` tag is now the floor, so the next cycle (`dev` 1.0.x → `rc` 1.1.N → `release` 2.0.0) needs
  no `next-version` bump. `next-version: 0.10.0` stays as the (now-inert) first-cycle seed.

## 2026-07-26 — GCM-25: simpler version scheme (user-directed)

- **Replaced the odd/even scheme (GCM-23) with a simpler one** at the user's request: each promotion
  bumps a higher SemVer position — `dev` = Patch (unpublished), `rc` = Minor → pre-release, `release`
  = Major → stable. `release.yml` publishes plain `X.Y.Z` (rc → `major.minor.<preReleaseNumber>`,
  release → `majorMinorPatch`); dropped `MINOR-1` and the reserved odd/even minors. `GitVersion.yml`:
  `rc` `increment: Minor`, `release` `increment: Major`, `next-version: 0.10.0`. `CLAUDE.md`
  versioning section rewritten.
- **Why `next-version: 0.10.0`:** an interrupted `rc` push (before this change, under the old scheme)
  had already published pre-release **`0.9.4`**, so the floor is `0.9.4`. `next-version: 0.10.0`
  starts `rc` at `0.10.x` (a raised next-version suppresses rc's minor bump for this first cycle, so
  dev/rc share minor 10 until the first stable tag; from the next cycle tags drive the lanes).
- **Verified via local GitVersion dry-run (the mandatory gate):** `rc` → pre-release `0.10.5`
  (`> 0.9.4`), `release` → stable `1.0.0` (`> 0.10.5`). Local `rc`/`release` were reset to `origin`;
  nothing pushed during the dry-run. `GCM-24` (stage order) rides in this release.

## 2026-07-26 — GCM-24: stage tree ordered by execution, not API order

- **Bug (reported against 0.8.0):** the stage tree showed stages reversed — `commit_job_changes`
  first, `.pre` last — because `groupJobsByStage` ordered stages by first-seen in the jobs response,
  and GitLab's `/pipelines/:id/jobs` returns jobs **newest-first (descending id)**.
- **Fix:** order stages by the **minimum job id per stage** (over all jobs, robust to retries), which
  matches GitLab's stage-by-stage job creation and reproduces the UI order (`.pre` → … → `.post`).
  Pure change in `src/job-order.ts`; `buildStageTree` already calls `groupJobsByStage(jobs)`, so no
  tree-view change. Added an optional explicit `stageOrder` param (for a future GraphQL-authoritative
  order). TDD: updated the stage-order test + added a newest-first-API repro and a retry-anchor test.

## 2026-07-26 — Stable 0.8.0 released + opened next cycle (next-version 0.10.0)

- **Released stable `0.8.0`** (user "go"). Promoted `dev` → `rc` → `release`: `rc` published
  pre-release **`0.7.14`** (fixed scheme; the patch is the commit counter, which had grown from the
  dry-run's 10), then `release` published **stable `0.8.0`** to the VS Code Marketplace + Open VSX,
  with a GitHub Release `v0.8.0` carrying the `.vsix`. Timeline: `0.6.10` (buggy pre-release,
  superseded) → `0.7.14` (fixed pre-release) → `0.8.0` (stable). All three features (GCM-20/21/22)
  are in the stable channel.
- **Opened the next cycle: `next-version` `0.8.0` → `0.10.0`.** The odd/even scheme requires bumping
  the even-minor target by two after each stable (the odd minor between is the pre-release channel),
  and — critically — leaving `next-version` at `0.8.0` would make the next `rc` push compute
  `0.7.<N>` **below** the live stable `0.8.0` and get rejected. So the repo is left ready: next
  cycle's rc = `0.9.<N>`, stable = `0.10.0`. Documented the cadence rule + the pre-push GitVersion
  dry-run gate in `TODO.md`.

## 2026-07-26 — GCM-23: fix the release version scheme (odd/even)

- **Fixed the odd/even version scheme so a clean stable can supersede the burned `0.6.10`.** Two
  edits to `GitVersion.yml`: `rc` `increment: Minor` → **`None`** (so `rc` keeps
  `MajorMinorPatch == next-version` and release.yml's `minor-1` produces the odd minor just below the
  even stable, as intended), and `next-version` `0.6.0` → **`0.8.0`** (a clean even minor above the
  already-published `0.6.10`). Updated `release.yml`'s versioning-convention comments to match.
- **Verified with a local GitVersion dry-run before any push** (the gate from `GCM-23`): on `rc`,
  `MajorMinorPatch=0.8.0` → release.yml pre-release **`0.7.10`** (odd, `> 0.6.10`, `< 0.8.0`); on a
  non-pushed `release` merge, `MajorMinorPatch=0.8.0` → stable **`0.8.0`** (even, above everything).
  Local `rc`/`release` branches were reset to `origin`; nothing was pushed during the dry-run.
- **Next:** merge PR #18 → `dev`, then promote `dev` → `rc` (publishes `0.7.10`) → `release`
  (publishes stable `0.8.0` + GitHub Release). This is release infra, not one of the three features.

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
