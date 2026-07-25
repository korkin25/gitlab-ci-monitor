# Contributing

Thanks for contributing. This project is developed under the workflow in
[`CLAUDE.md`](CLAUDE.md) — read it first; it is the canonical contract for humans and AI
agents alike.

## TL;DR

1. **Design before code.** No implementation until the design is written down and any
   architectural decision is agreed (affected `src/**`, VS Code API surface, trade-offs).
2. **Log the task** in `TODO.md` as `GCM-<n>` and add it to `Features.md`.
3. **Branch** `feature/GCM-<n>-<slug>` off `dev` (there is no `main`; the flow is
   `feature/*` → `dev` → `rc` → `release`).
4. **TDD** — write the failing test first (under `test/`), then implement until green. No
   feature code without a test.
5. **Keep docs in lockstep** in the same change (the `doc-sync` CI guard enforces this). The
   version lives in `package.json` — bump it deliberately for a release (see `CLAUDE.md`
   § Versioning).
6. **Open a PR** to `dev`; merge only when CI is green. Promotion `dev` → `rc` → `release` is
   approval-gated.

## Local checks

```bash
npm ci
npm run lint          # eslint
npm run format:check  # prettier --check
npm run compile       # tsc typecheck
npm test              # node --test (compiles tests via pretest)
npm run package       # build the .vsix
```

Manual (group-b) testing runs in the **Extension Development Host** (press F5 in VS Code)
against a real GitLab instance/token — never commit a token.

Optional local hook — **gitleaks** secret scan (via Docker, no local binary needed). Other
lint/scan gates run in CI, not locally.

```bash
pipx install pre-commit && pre-commit install   # then gitleaks runs on every commit
pre-commit run --all-files                       # run once over the whole repo
```

## Commit style

Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`). Do not add a
`Co-Authored-By` trailer.

## Zero dependencies & license

Keep runtime dependencies at **zero** (the GitLab API is called via Node's built-in `https`);
a new runtime dependency needs a justified decision. This project is a fork of
[`gitlab-pipelines`](https://github.com/Jameswain/gitlab-pipelines) and is licensed **ISC**
(see `LICENSE`/`NOTICE`). Report vulnerabilities per [`SECURITY.md`](SECURITY.md).
