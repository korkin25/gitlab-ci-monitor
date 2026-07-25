# Autopilot log — gitlab-ci-monitor

Autonomous changes (user authorized full autopilot on these repos). Newest first.

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
- **Added** `Features.md` (numbered backlog), a **doc-sync** CI guard, **Dependabot** (npm +
  github-actions), **pre-commit** (gitleaks via Docker only), **CODEOWNERS**, PR/issue
  templates, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and a `.claude/settings.json`
  per-turn hook.
- **Deliberately skipped `.gitlab-ci.yml`.** The GitLab twin (`open_ci_cd/templates`) is
  Python/Docker/Helm-oriented and has no Node/VS-Code template, and this extension is
  GitHub/marketplace-hosted, so a GitLab mirror would add no value. Revisit if a Node GitLab
  template is built.

**Guardrails honored:** feature branch `feature/GCM-14-full-standard` off `dev`; no history
rewrite; no secret touched; `release.yml`, `LICENSE`, `NOTICE` untouched; License stays ISC.
