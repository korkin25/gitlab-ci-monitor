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
- **Two homes.** The tree shows up under **Source Control** *and* the **Explorer** — pick whichever panel you live in. Opening a file in a project, or selecting a repository in the built-in **Source Control** list, expands that project in the panel — **in place, without switching sidebars or stealing focus**.
- **Status bar indicator.** The pipeline status of the active editor's repo/branch is shown in the status bar; click it to open the pipeline in GitLab. It follows you as you switch files.
- **Smart failure notifications.** A desktop notification pops up only when the **latest** pipeline for a branch has `failed` — and only **once per branch failure**. If a newer run on that branch succeeds, no notification. Toggle with `notifyOnFailed`.
- **Actions.** Retry or cancel a pipeline from inline buttons; click a pipeline or a job to open it in GitLab; view a job's log via its context menu.
- **Token in VS Code Secret Storage.** Your GitLab token is kept in the OS keychain via VS Code Secret Storage — not in plaintext settings. A legacy `settings.json` token is auto-migrated, and a `GITLAB_TOKEN` env var still works as a fallback (see [Token](#token-required)).
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
with `read_api` scope (or `api` if you want retry/cancel) is required. It is resolved from the
first source that has it, most secure first:

1. **VS Code Secret Storage (recommended).** Run **“GitLab CI: Set GitLab Token (Secret Storage)”**
   from the Command Palette and paste the token. It is stored in the OS keychain, never in a file.
   Use **“Clear GitLab Token (Secret Storage)”** to remove it.
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
