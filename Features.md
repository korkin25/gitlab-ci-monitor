# Features

The single **numbered backlog** for `gitlab-ci-monitor`: **only user-facing product features** —
what the extension does for its users. Numbers are **stable and never reused**. Entries are
grouped by state — **Current** (in progress) · **Planned** · **Brainstorm** (ideas) ·
**Delivered**. New requests and ideas land here first, then become tasks (`GCM-<n>`) in
[TODO.md](TODO.md).

**Never** put engineering/infra tasks here (deployment, CI/CD, release, versioning, tooling,
refactors, governance) — those live in [TODO.md](TODO.md) / [CHANGELOG.md](CHANGELOG.md).

## Current (in progress)

_None._

## Planned

_None._

## Brainstorm (ideas)

_None._

## Delivered

1. **Multi-root pipeline tree.** Every workspace folder that is a git repo with a
   `.gitlab-ci.yml` is watched; pipelines grouped per repository (repo → pipelines → jobs).
2. **Two homes.** The tree appears under both **Source Control** and the **Explorer**; opening a
   file in a project (or selecting a repo in the built-in Source Control list) expands that
   project in place, without switching sidebars or stealing focus.
3. **Status-bar indicator.** Shows the active editor's repo/branch pipeline status; click to open
   it in GitLab; follows the active file.
4. **Smart failure notifications.** A desktop notification fires only when the **latest** pipeline
   for a branch has `failed`, and only **once per branch failure**; toggled via `notifyOnFailed`.
5. **Inline actions.** Retry/cancel a pipeline; open a pipeline or job in GitLab; view a job's log.
6. **Zero runtime dependencies.** The GitLab API is called via Node's built-in `https`.
7. **Token in VS Code SecretStorage.** GitLab tokens are stored securely, not in plain settings.
11. **Repo groups collapse by default.** Repository groups start collapsed and the active
    editor's repo auto-expands, so a large workspace stays readable.
