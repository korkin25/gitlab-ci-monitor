<p align="center">
  <img src="icon.png" width="128" alt="GitLab CI Monitor — orange dragon" />
</p>

# GitLab CI Monitor

Monitor your GitLab pipelines in real time, right inside VS Code — across **every** repository in your workspace, in both the **Explorer** and the **Source Control** panels.

> Inspired by and based on [`gitlab-pipelines`](https://github.com/Jameswain/gitlab-pipelines) by **jameswain** (ISC). See [NOTICE](NOTICE).

## Features

- **Multi-root aware.** Every workspace folder that is a git repo and has a `.gitlab-ci.yml` is watched. Pipelines are grouped per repository, and each pipeline expands into a **stage tree with the job dependency (`needs`) graph**:
  ```
  📦 repo-a · main (20)
     ✅  123 · main · 2m 3s
        ✅  build (2)
           ✅  compile · 41s
           ✅  lint · 12s
        ✅  test (1)
           ✅  unit · 1m 8s
              ↳ needs ✅ compile
        🚦  deploy (1)
           🚦  deploy
              ↳ needs ✅ unit
  📦 repo-b · dev (20)
     🏃  456 · dev · 34s
  ```
- **Stage & dependency tree.** Jobs are no longer a flat list: they nest under their **stage** (with an at-a-glance aggregate status per stage), and any job with `needs` expands to show the jobs it depends on — the CI DAG, right in the tree. Stage grouping comes from the REST API; the `needs` edges from GitLab GraphQL (best-effort — a token without GraphQL access simply shows no dependency edges).
- **Two homes.** The tree shows up under **Source Control** *and* the **Explorer** — pick whichever panel you live in. Opening a file in a project, or selecting a repository in the built-in **Source Control** list, expands that project in the panel — **in place, without switching sidebars or stealing focus**.
- **Status bar indicator.** The pipeline status of the active editor's repo/branch is shown in the status bar; click it to open the pipeline in GitLab. It follows you as you switch files.
- **Smart failure notifications.** A notification pops up only when the **latest** pipeline for a branch has `failed` — and only **once per branch failure**. On startup a branch whose latest pipeline is already red is announced (but not older, already-superseded failures); if a newer run on that branch succeeds, no notification. The toast is **self-dismissing** — it needs no click and slides away after a couple of seconds. Toggle with `notifyOnFailed`.
- **Actions.** Inline buttons and a right-click menu. On a **pipeline** — **Stop** (running) or **Run new pipeline** (finished) inline; the menu also has **Open pipeline in GitLab** and **Open commit in GitLab**. On a **job** — **Open job log** (live) and **Stop** (running) inline; the menu adds retry (finished), play (manual), and open in GitLab.
- **Run duration.** Every pipeline and job shows how long it took — a **live-ticking elapsed time** while it runs, and the final run time once it finishes (e.g. `✅  compile · 12s`, `🏃  deploy · 1m 4s`).
- **Finish flash.** The instant a pipeline or job finishes, its icon flashes for a moment — a **✨ sparkle** when it succeeds, a **💥 burst** when it fails — then settles back to the normal status icon, so a change catches your eye.
- **Live job log on click — a true `tail`.** **Click a job** to stream its log; right-click opens it in GitLab. It opens the job's trace in a terminal that **tails in real time** — it fetches only the **last ~200 lines** (via an HTTP range request, so a huge log opens instantly) and then appends only the newly-written bytes as the job runs, ANSI colors intact, auto-scrolling. The full log stays in GitLab; the terminal is the "what's happening now" view a devops wants. Closing the terminal stops the stream; re-opening a still-running job re-focuses it. (GitLab has no trace WebSocket, so this is efficient incremental range-polling.)
- **Web sign-in & multiple GitLabs.** **Sign in via the browser** — the extension opens the host's token page with the scope pre-filled; you click Create and paste it back. Works across **several GitLab instances at once** (`gitlab.com` + a private `gitlab.company.com`): the host comes from each repo's git remote and tokens are stored **per host** in VS Code Secret Storage (OS keychain, not plaintext). A legacy `settings.json` token is auto-migrated, and a `GITLAB_TOKEN` env var still works as a fallback (see [Token](#token-required)).
- **Live updates, no Refresh needed.** The tree refreshes itself on an **adaptive interval** — polling **faster (~2s) while a pipeline is running** for a near-live feel, and backing off to the configured interval once everything has finished. (GitLab exposes no pipeline-status WebSocket — its own UI polls too — so this is the efficient equivalent; a manual **Refresh** is still available.)
- **Repo groups collapse by default**, and the active editor's repo auto-expands.
- **Zero runtime dependencies** — the GitLab API is called via Node's built-in `https`.

## Requirements

The extension activates when a workspace folder contains a `.gitlab-ci.yml` file.

## Configuration

Non-secret options live in `settings.json`, keyed by your git remote host (for gitlab.com it is `gitlab.com`):

```json
"GitLabPipelines": {
  "gitlab.com": {
    "interval": 5000,
    "notifyOnFailed": true
  }
}
```

| Field | Required | Default | Meaning |
|-------|----------|---------|---------|
| `interval` | | `5000` | Refresh interval in milliseconds. |
| `notifyOnFailed` | | `true` | Show a notification when a pipeline fails. |

The domain and project are derived from each repo's git remote, so one entry per domain serves every repository hosted there.

> The configuration key is intentionally `GitLabPipelines` for drop-in compatibility with the original extension.

### Token (required)

A GitLab [Personal Access Token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html)
with `api` scope (or `read_api` for monitoring only, without the retry/cancel/run actions) is
required. **Multiple GitLab instances are supported** — the host is taken from each repo's git
remote, and tokens are stored **per host**, so `gitlab.com` and a private `gitlab.company.com` in the
same workspace each get their own. It is resolved from the first source that has it, most secure
first:

0. **Sign in via the web (easiest).** Run **“GitLab CI: Sign in to GitLab (Web)”** (or click **Sign
   in to GitLab** in the panel when it is empty). It opens the host's token-creation page in your
   browser with the name and scope pre-filled — click **Create** and paste the token back. Works on
   any GitLab instance.
1. **VS Code Secret Storage.** Run **“GitLab CI: Set GitLab Token (Secret Storage)”** from the
   Command Palette (it asks which host if you have several) and paste the token. It is stored in the
   OS keychain, never in a file. Use **“Clear GitLab Token (Secret Storage)”** to remove it.
2. **`settings.json`** — a legacy plaintext `"token": "<pat>"` under your host still works, but is
   discouraged. If one is present and Secret Storage has none, the extension copies it into Secret
   Storage on startup and tells you that you can delete the plaintext entry.
3. **`GITLAB_TOKEN`** environment variable — used when VS Code is launched from a shell where it is
   exported. Handy for keeping the token out of any settings file entirely.

## Commands

All commands are under the **GitLab CI** category in the Command Palette:

| Command | What it does |
|---------|--------------|
| Refresh | Re-poll every watched repository now. |
| Sign in to GitLab (Web) | Open the host's token page (name + scope pre-filled) in the browser, then paste the token. |
| Set GitLab Token (Secret Storage) | Store a token for a host in the OS keychain. |
| Clear GitLab Token (Secret Storage) | Remove a stored token for a host. |
| Retry / Cancel pipeline | Also available as inline buttons in the tree. |
| View job log | From a job's context menu; opens a cleaned, read-only trace. |
| Open in GitLab | Click a pipeline or job. |

## Development

```bash
npm install        # dev dependencies only — the extension has zero runtime deps
npm run compile    # type-check and build the extension into out/
npm run lint       # ESLint (flat config, typescript-eslint)
npm run format     # apply Prettier;  npm run format:check verifies formatting
npm test           # run the unit suite (node:test) — see test/
```

CI (GitHub Actions) runs lint, format check, type-check, tests, and a dependency audit on
every push. ESLint owns code quality and Prettier owns formatting (`eslint-config-prettier`
keeps them from fighting).

### Releasing

Pushing a SemVer tag that matches `package.json` (e.g. `v0.1.7`) triggers the
[release workflow](.github/workflows/release.yml): it re-runs the full quality gate, builds
the `.vsix` with `@vscode/vsce`, and attaches it to a generated GitHub Release.

Publishing to the marketplaces is **opt-in** — each publish step runs only when its token
secret is configured in the repository:

| Secret | Publishes to |
|--------|--------------|
| `VSCE_PAT` | VS Code Marketplace (`vsce publish`) |
| `OVSX_PAT` | Open VSX (`ovsx publish`) |

```bash
npm run package    # build a .vsix locally (same command the release job runs)
```

The pure, VS Code-independent logic (git-remote parsing, log cleaning, job ordering, the
GitLab HTTP client) lives in dedicated modules and is covered by `npm test`; the runner is
Node's built-in `node:test`, so there are no extra test dependencies.

## Credits

Derived from [`gitlab-pipelines`](https://github.com/Jameswain/gitlab-pipelines) by jameswain, licensed under ISC.

## License

[ISC](LICENSE)
