# Features

The single **numbered backlog** for `gitlab-ci-monitor`: everything the user asks to build
and every brainstorm idea. Numbers are **stable and never reused**. Entries are grouped by
state — **Current** (in progress) · **Planned** · **Brainstorm** (ideas) · **Delivered**.
New requests and ideas land here first, then become tasks (`GCM-<n>`) in [TODO.md](TODO.md).

## Current (in progress)

10. **Adopt the `ai-project-template` engineering standard (GCM-14).** Align this repo with the
    shared reference template, adapted for a TypeScript VS Code extension: CI reuses
    `korkin25/open-ci-actions@v1` `sast.yml` (gitleaks/semgrep/checkov/trivy) and keeps the Node
    gates bespoke (eslint/prettier/tsc/`node --test`/`vsce package`); branch model **`feature/*`
    → `dev` → `rc` → `release`** (retire `main`); universal agent-rule pickup (`CLAUDE.md`
    single-source with symlinked `AGENTS.md`/`GEMINI.md`/`.cursorrules`/… + Cursor MDC pointer +
    per-turn hook); **doc-sync CI guard**, Dependabot, pre-commit (gitleaks-only), CODEOWNERS,
    PR/issue templates, `SECURITY.md`/`CONTRIBUTING.md`/`CODE_OF_CONDUCT.md`. Governance doc
    gains **Design-before-code**, **Safe-autonomy**, **Agent-security**, a **Testing policy**
    (groups a/b/c) and a **Versioning** section (package.json is the source of truth; no
    GitVersion). Release stays the vendored tag-triggered `release.yml`.

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
8. **Tag-triggered release.** A `vX.Y.Z` tag builds the `.vsix`, attaches it to a GitHub Release,
   and publishes to the VS Code Marketplace + OpenVSX (`@vscode/vsce` / `ovsx`).
9. **`node --test` unit suite + eslint/prettier/tsc CI.** Automated group-(a) quality gates.
