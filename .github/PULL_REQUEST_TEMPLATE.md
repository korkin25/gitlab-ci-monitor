<!-- See CLAUDE.md § Per-task lifecycle. Merge only when CI is green. -->

## What & why

<Summary of the change and the `GCM-<n>` it closes.>

## Checklist

- [ ] **Design** was written/agreed before coding (architectural decisions approved).
- [ ] Task logged in `TODO.md`; any user-facing feature described in `README.md` `## Features`.
- [ ] Tests written **first** (TDD) under `test/`.
- [ ] **Docs in lockstep** in this change (README / CHANGELOG / Features / TODO) — the
      `doc-sync` guard passes.
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`.
- [ ] CI is green (SAST + Node lint/typecheck/test/package).

<!-- Add the "no-docs" label or "[skip doc-sync]" in the title only if this truly needs no docs. -->
