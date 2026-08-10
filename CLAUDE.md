# Glantri — Claude operating guide

`AGENTS.md` is the shared, authoritative instruction file for all coding agents. Read it completely before doing any work. This file adds Claude-specific reminders and codebase orientation; it does not grant additional authority. If these files ever conflict, stop and report the conflict.

## Non-negotiable authority boundaries

- Work only inside the development repository and GitHub scope authorized by the task contract.
- Do not assume `main` is the work baseline or PR target. Use the exact branch and commit SHA named in the task contract.
- Create or switch branches/worktrees only when the task authorizes it. Never continue accumulating unrelated work on a long-lived feature branch.
- Do not push or create/update a PR unless the task or user explicitly authorizes it and names a confirmed target.
- Never merge to `main`. The external maintainer owns `main` merges, release decisions, production approvals, and production/Azure configuration.
- Do not approve/cancel deployments, deploy, edit production settings or secrets, request production write access, or use available credentials to bypass these rules.
- A future shared integration branch does not change these rules unless its ownership and merge authority have been explicitly approved and documented.

## Required task start

1. Read `AGENTS.md`, `docs/process/control-plane.md`, `docs/process/development-baseline.md`, and `docs/architecture/ownership.md`.
2. Confirm the task contract, exact baseline SHA, owned area, reserved hotspots, and Git authorization.
3. Inspect current source, architecture notes, and tests for the affected area.
4. If the task lacks a safe baseline, requires an unapproved rule decision, or overlaps a reserved hotspot without coordination, stop and report the blocker.

## Rule governance

PDFs, texts, and spreadsheets are evidence and provenance, not unquestionable implementation truth. Cite them precisely, but do not silently treat every source value as binding.

- Record conflicts, ambiguities, source errors, and computerized-play deviations.
- An approved Glantri implementation ruling may correct, simplify, replace, or improve a source rule.
- Material rulings belong in `docs/decisions/rules/` and require focused examples/tests.
- Without an approved ruling, do not invent a resolution for a source conflict.
- Keep raw import, enrichment, normalization, derivation, and verification separate.
- Existing tests show current behavior; they are not independent proof of the correct product rule.

Current approved combat convention: `effectiveSkillNumber` is total combat skill XP, including direct and group-derived contributions.

## Codebase orientation

Glantri is a TypeScript monorepo:

- `apps/web`: Next.js frontend.
- `apps/api`: Fastify routes and server orchestration.
- `packages/domain`: independent shared schemas, domain state, and contracts.
- `packages/rules-engine`: deterministic game calculations; imports only from domain.
- `packages/database`: repositories and outward-facing services.
- `packages/content` and `packages/importers`: content and source ingestion.

Key conventions:

- Apps may import packages; packages never import apps.
- Zod schemas are shared from domain rather than duplicated.
- Database repositories are internal; callers use services.
- `@glantri/test-scenarios` is test/e2e only.
- Web API calls use domain clients in `apps/web/src/lib/api/`; do not add direct component `fetch` calls.
- `apps/web/app/` is a thin route layer. Feature logic belongs in `apps/web/src/features/<feature>/`.
- Pure game calculations belong in `packages/rules-engine`.
- Preserve canonical helpers and extracted components; do not create parallel calculation paths.

Large web features normally use `components/`, `hooks/`, `state/`, `view-models/`, tests, and a responsibility README. File size above roughly 500 lines is a review signal, not a mandatory split.

## Verification

Use the checks required by the task contract. The usual full set is:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

API/database/end-to-end changes may also require database integration tests and Playwright/Docker checks. Documentation-only work should validate templates, references, and `git diff --check`.

## Handoff

Report the outcome, changed files, decisions, verification, exact baseline/branch, whether anything was pushed or submitted as a PR, and unresolved risks. Do not close historical issues or rewrite milestones as a prerequisite unless the current task explicitly adopts them.
