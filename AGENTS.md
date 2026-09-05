# Glantri repository instructions

## Core rules

- Work from the existing Glantri monorepo and preserve established architecture unless the task explicitly changes it.
- Current Git and case-management authority is the loopback-only Forgejo repository `recovery-admin/glantri-app`. The canonical MacBook clone is `/Users/vidarhald/dev/glantri-app-forgejo`, and the canonical Codex project is `Glantri app — Forgejo`.
- The historical `Glantri app` Codex project and `/Users/vidarhald/dev/glantri-app` checkout are recovery/history evidence only, not the default root for new development. Repository documents remain authoritative; Codex project references are navigation aids.
- The product owner decides priority, game rules, user experience, development integration, and acceptance.
- `dev` is the shared development integration branch. The product owner/project development process may create and protect it and merge ordinary task PRs into it.
- The external maintainer participates only in future production-release/deployment support at the `dev -> main -> Azure` boundary.
- Never push or merge to `main`, deploy, change production/Azure configuration or secrets, or treat credentials as authority.
- Pushes and PR changes require explicit task or user authorization and a confirmed target.

Full process: `docs/process/control-plane.md` and `docs/process/development-baseline.md`.

## Task start and reading

Before non-trivial work:

1. Read this file and the exact additional documents named in the task contract.
2. Confirm the current Forgejo issue, when applicable, or other durable task contract is both `Ready` (complete) and explicitly `Authorized` for implementation. `Ready` alone is not permission to start.
3. Confirm outcome, scope, ownership, accepted baseline branch/SHA, reserved hotspots, acceptance examples, verification, and Git authority.
4. Fetch and resolve the live `origin/dev` SHA. Stop for contract refresh if it differs from the accepted baseline; do not silently choose a new baseline.
5. Inspect the current source and tests for the affected area; do not rely on old branches or chat history.
6. Stop if the task requires an unapproved product/rule decision, an unknown baseline, or uncoordinated hotspot edits.

Keep mandatory startup reading controlled and task-specific. Area documents are required only when the task touches that area. Decision records, audits, and historical reports are read on demand. Task contracts must name exact paths rather than say `read all architecture docs`.

Useful references:

- Task contract: `docs/process/task-contract.md`
- Isolated Builder/QA execution: `docs/process/agent-execution.md`
- Functional ownership/hotspots: `docs/architecture/ownership.md`
- Global user-facing principles: `docs/product/product-presentation-principles.md`
- Regression guidance: `docs/testing-regression-matrix.md`
- Rule and architecture decisions: `docs/decisions/`

## Rule and architecture discipline

- Cite source documents, pages, sheets, cells, ranges, formulas, or approved rule decisions precisely.
- Do not silently resolve source conflicts or invent Glantri rules. Record material rulings under `docs/decisions/` and protect them with focused examples/tests.
- Keep raw import, enrichment, normalization, derivation, and verification separate.
- Current combat convention: `effectiveSkillNumber` is total skill XP, including direct and group-derived contributions.
- Apps may import packages; packages never import apps. `packages/domain` is the bottom layer, and `packages/rules-engine` imports only from domain.
- Database repositories are internal; callers use services. Game calculations belong in rules-engine. `@glantri/test-scenarios` is test/e2e only.
- Preserve canonical helpers/services and avoid duplicate calculation paths, unrelated refactors, or placeholders for unimplemented features.

## Git, tools, and verification

- Use one clean, short-lived task branch/worktree from the exact accepted `dev` SHA. Do not continue feature work on accepted or long-lived branches.
- Substantial implementation Builder, independent QA, and dispatched bounded Investigator roles use separate visible Codex tasks. Builder and QA must never be the same visible task; hidden helper agents do not satisfy these roles.
- Coordinate reserved hotspots and cross-area merge order through the task contract.
- Existing repository tools, Docker/local database tooling, and declared dependency installation are allowed. New software, global tools, services, permissions, or external transmission require explicit approval.
- A linked Builder/QA worktree that can reach PostgreSQL must own an explicit disposable task target; worktree filesystem isolation is not database isolation. Follow `docs/dev-database.md`, never copy the primary checkout `.env`, and never use the protected `localhost:5432/glantri` database from a linked worktree.
- Run verification proportional to the affected layers; normally typecheck, lint, tests, and build, plus database or browser checks when relevant.
- Inspect Git status after generation/build/test steps. Do not silently commit generated output.

At handoff report outcome, files, decisions, exact baseline/head, verification, Git/PR state, remaining risks, and follow-ups.
