# Autopilot log — gitlab-ci-monitor

Autonomous changes (user authorized full autopilot on these repos). Newest first.

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
