<p align="center">
  <img src="icon.png" width="128" alt="GitLab CI Monitor — orange dragon" />
</p>

# GitLab CI Monitor

Monitor your GitLab pipelines in real time, right inside VS Code — across **every** repository in your workspace, in both the **Explorer** and the **Source Control** panels.

> Inspired by and based on [`gitlab-pipelines`](https://github.com/Jameswain/gitlab-pipelines) by **jameswain** (ISC). See [NOTICE](NOTICE).

## Features

- **Multi-root aware.** Every workspace folder that is a git repo and has a `.gitlab-ci.yml` is watched. Pipelines are grouped per repository:
  ```
  📦 repo-a · main (20)
     ✅  123 · success · main
        ✅  [build] compile
        ✅  [test] unit
  📦 repo-b · dev (20)
     🏃  456 · running · dev
  ```
- **Two homes.** The tree shows up under **Source Control** *and* the **Explorer** — pick whichever panel you live in.
- **Status bar indicator.** The pipeline status of the active editor's repo/branch is shown in the status bar; click it to open the pipeline in GitLab. It follows you as you switch files.
- **Failure notifications.** A desktop notification pops up when a watched pipeline transitions to `failed` (toggle with `notifyOnFailed`).
- **Actions.** Retry or cancel a pipeline from inline buttons; click a pipeline or a job to open it in GitLab; view a job's log via its context menu.
- **Repo groups collapse by default**, and the active editor's repo auto-expands.
- **Zero runtime dependencies** — the GitLab API is called via Node's built-in `https`.

## Requirements

The extension activates when a workspace folder contains a `.gitlab-ci.yml` file.

## Configuration

Add the following to your `settings.json`. The key is your git remote host (for gitlab.com it is `gitlab.com`):

```json
"GitLabPipelines": {
  "gitlab.com": {
    "token": "<personal-access-token>",
    "interval": 5000,
    "notifyOnFailed": true
  }
}
```

| Field | Required | Default | Meaning |
|-------|----------|---------|---------|
| `token` | ✅* | — | GitLab [Personal Access Token](https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html) with `read_api` (or `api` for retry/cancel). |
| `interval` | | `5000` | Refresh interval in milliseconds. |
| `notifyOnFailed` | | `true` | Show a notification when a pipeline fails. |

\* **Don't want the token in `settings.json`?** If `token` is omitted, the extension falls back to the **`GITLAB_TOKEN`** environment variable when VS Code is launched from a shell where it is exported. An explicit `token` in settings always takes precedence.

The domain and project are derived from each repo's git remote, so one entry per domain serves every repository hosted there.

> The configuration key is intentionally `GitLabPipelines` for drop-in compatibility with the original extension.

## Development

```bash
npm install        # dev dependencies only — the extension has zero runtime deps
npm run compile    # type-check and build the extension into out/
npm test           # run the unit suite (node:test) — see test/
```

The pure, VS Code-independent logic (git-remote parsing, log cleaning, job ordering, the
GitLab HTTP client) lives in dedicated modules and is covered by `npm test`; the runner is
Node's built-in `node:test`, so there are no extra test dependencies.

## Credits

Derived from [`gitlab-pipelines`](https://github.com/Jameswain/gitlab-pipelines) by jameswain, licensed under ISC.

## License

[ISC](LICENSE)
