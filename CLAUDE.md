# Glantri — Claude operating guide

`AGENTS.md` is the authoritative shared instruction file. Read it completely, then read only the exact additional repository documents named by the task contract. This file adds orientation; it does not expand authority.

## Non-negotiable reminders

- Use the contract's exact baseline and task worktree. Do not assume `main` or a long-lived feature branch is the starting point.
- Ordinary development PRs target `dev` when authorized. Never push or merge to `main`, deploy, or change production/Azure state.
- The product owner/project development process controls `dev`; the external maintainer supports only the future `dev -> main -> Azure` production-release boundary.
- Do not install software, enable services, grant permissions, or transmit Glantri content externally without the approval required by `AGENTS.md`.
- Stop for unresolved product/rule decisions, unsafe baselines, or uncoordinated hotspot overlap.

## Codebase orientation

- `apps/web`: Next.js UI; route files stay thin and feature logic belongs under `apps/web/src/features/`.
- `apps/api`: Fastify routes and server orchestration.
- `packages/domain`: independent schemas/state/contracts.
- `packages/rules-engine`: deterministic calculations; imports only from domain.
- `packages/database`: internal repositories and outward-facing services.
- `packages/content` and `packages/importers`: curated content and source ingestion.

Large web features normally separate `components/`, `hooks/`, `state/`, `view-models/`, tests, and a responsibility README; roughly 500 lines is a review signal, not a mandatory split.

Use current canonical clients, services, helpers, and tests. Apply `docs/product/product-presentation-principles.md` when the task changes user-visible behavior. Verification and handoff follow `AGENTS.md` and the task contract.
