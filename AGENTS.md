# Glantri repository instructions

## Purpose and precedence

This is the existing Glantri app monorepo. Work from the current implementation; do not create a replacement application or casually replace established architecture.

These instructions apply to every coding agent. Tool-specific guidance such as `CLAUDE.md` may add detail but must not contradict this file. If instructions conflict, stop, report the conflict, and follow the most recent explicit product-owner ruling until the repository guidance is corrected.

## Authority boundaries

- The product owner decides priorities, Glantri game-rule behavior, user experience, and acceptance.
- The external maintainer owns merges to `main`, release decisions, production deployment approvals, and production/Azure configuration.
- Coding agents may inspect, develop, test, create local task branches/worktrees, and prepare development PRs within an authorized task contract.
- Pushing a branch or creating/updating a PR requires explicit task or user authorization and a confirmed target branch.
- Agents must not merge to `main`, approve or cancel a production deployment, deploy to production, change production/Azure settings or secrets, or request production write access.
- Until the maintainer confirms otherwise, do not assume that agents may merge into any shared integration branch.

See `docs/process/control-plane.md` and `docs/process/development-baseline.md` for the complete operating model.

## Operating boundary and tooling

- Normal Glantri work is limited to the assigned repository/worktree, existing standard local development and file-processing tools, the Glantri GitHub repository under the authority rules above, and Glantri source material explicitly stored in the repository or project context.
- Existing compilers, typecheckers, formatters, linters, test runners, Git, Docker/local database tooling, Prisma, and local PDF/Office/Excel/file readers or converters may be used on Glantri files without separate approval.
- Explicit user approval is required before installing software, VS Code extensions, global utilities, or packages outside the normal repository dependency workflow; enabling an external service/integration; or granting new permissions, account access, personal-cloud access, computer control, or filesystem access outside the assigned workspace.
- An installed tool is not permission to transmit Glantri content externally. Do not use external AI/cloud analysis, personal ChatGPT services, publishing/deployment services, or live personal Drive access for Glantri unless the task requires it and the user explicitly approves where appropriate. Tool availability never grants authority to push, merge, deploy, delete, publish, or take another destructive/external action.

## Start every non-trivial task with a contract

Before implementation, identify:

1. Outcome and acceptance examples.
2. In scope and out of scope.
3. Primary functional area and integration owner, if cross-area.
4. Exact accepted baseline branch and commit SHA.
5. Expected paths and any reserved integration hotspots.
6. Rule evidence, conflicts, and approved implementation rulings.
7. Contracts affected: API, schema, persistence, events, or UI read models.
8. Required verification and handoff evidence.
9. Git authorization: local only, push allowed, and intended PR target.

A task is not ready if an agent would need to invent a product rule, choose an unconfirmed shared baseline, or edit a hotspot without coordination.

Use `.github/ISSUE_TEMPLATE/implementation-task.yml` or `docs/process/task-contract.md` as the contract format.
Apply the normative `docs/product/product-presentation-principles.md` to user-visible work, and record each acceptance dimension's applicability as defined by the task contract. Do not invent criteria for genuinely internal work.

## Pre-flight reading

Read, when present:

- `AGENTS.md`
- `docs/process/control-plane.md`
- `docs/architecture/ownership.md`
- `docs/architecture/current-refactor-priorities.md`
- `docs/architecture/recent-architecture-changes.md`
- `docs/product/campaign-scenario-encounter-workflows.md`
- `docs/product/product-presentation-principles.md` for user-visible work
- `docs/testing-regression-matrix.md`

Then inspect the current source and tests relevant to the task. Do not rely on older branches or conversations.

Before changing files, identify the canonical helpers/components, recent refactors, correct layer, protecting tests, and verification commands.

## Rule and source governance

Rule texts, PDFs, spreadsheets, and source extracts are evidence and provenance. They are important inputs, but they are not unquestionable implementation truth: they may contain errors, internal conflicts, omissions, manual-play shortcuts, or calculations that can be improved for computerized play.

When work depends on source material:

- Cite the source precisely: document/workbook, section/sheet, page/cell/range, and formula or text where relevant.
- Keep raw import, manual enrichment, normalization, derivation, and verification separate.
- Record conflicts, ambiguity, source errors, and deviations; do not silently fix or simplify a rule.
- An approved Glantri implementation ruling may correct, simplify, replace, or improve source behavior for the application.
- Record material rulings under `docs/decisions/rules/`, including evidence, reasoning, examples, implementation consequences, status, and supersession links.
- Protect approved behavior with focused executable examples or golden tests. Tests prove implemented behavior; they do not by themselves prove that the product ruling is correct.
- If source and implementation disagree without an approved ruling, report the mismatch and leave the rule-dependent behavior unresolved rather than guessing.

For calculation-heavy work, produce a short mapping note before implementation: source references, source logic, target code, conflicts, and applicable approved ruling.

Current approved combat convention: `effectiveSkillNumber` is the workbook-equivalent total skill XP and includes direct allocation plus group-derived contribution. Combat calculations must not substitute only one component.

## Functional ownership and coordination

Primary areas are:

- Rules and content governance
- Character lifecycle
- Equipment and physical state
- Campaign and narrative encounters
- Combat engine
- Combat experience
- Platform

The exact responsibilities and reserved integration hotspots are defined in `docs/architecture/ownership.md`.

Read globally; write within the task's declared area. Before crossing an area boundary:

- declare every affected area and contract;
- name one integration owner;
- coordinate hotspot ownership and merge order;
- land shared contract/schema decisions before dependent work where practical;
- require architecture review before high-risk or cross-area work becomes ready.

Only one active task may edit a reserved hotspot unless an integration plan explicitly assigns the split and order.

## Branch, worktree, and PR policy

- Use one short-lived branch/worktree per coherent task or tightly related cluster.
- Start from the exact accepted development baseline named in the task contract, not automatically from `main` and not automatically from the latest long-lived feature branch.
- Do not share a dirty worktree between agents.
- Do not keep adding unrelated scope to an existing branch or PR.
- A PR should represent one coherent behavior or architecture slice. There is no rigid changed-file cap.
- An unusually large, high-risk, or cross-area PR requires a written integration plan covering contract order, hotspot ownership, review strategy, verification, compatibility, and rollback.
- Do not continue using a feature branch after its work has been accepted into the relevant shared baseline.
- Do not create or merge a shared integration branch until the unresolved constraints in `docs/process/development-baseline.md` are confirmed.
- Never infer authority to push, open a PR, change its base, or merge from the existence of credentials.

## Architecture and placement

Dependency direction is strictly top-down:

- `apps/*` may import from `packages/*`; never the reverse.
- `packages/rules-engine` imports only from `packages/domain`, not from apps or database.
- `packages/domain` is the bottom layer and imports from no other repository package.
- `@glantri/test-scenarios` is allowed only from tests and `e2e/`.
- `apps/web/app/` uses the `@/` alias to `apps/web/src/`; avoid long relative imports.
- Database repositories are internal; external callers use services.
- Game-rule calculations belong in `packages/rules-engine`, not web features.

Place new code as follows:

- UI feature: `apps/web/src/features/<feature>/`, with a thin route under `app/`.
- API route group: `apps/api/src/routes/<feature>/`.
- Domain type or Zod schema: `packages/domain/src/<domain>/`.
- Game-rule calculation: `packages/rules-engine/src/<domain>/`.
- Database operation: `packages/database/src/services/<domain>/`.
- API contract: `packages/domain/src/api/` or an established shared contract location.
- Test fixture: `packages/test-scenarios`, used only by tests/e2e.

Preserve extracted components, helpers, and services. Do not re-inline canonical logic or create duplicate calculation paths. Files above roughly 500 lines are a signal to review responsibilities, not a mechanical split requirement.

## Working style

- Prefer focused, reviewable changes and preserve existing behavior unless the task changes it.
- Put shared/domain/rules logic in the appropriate shared layer before wiring UI.
- Reuse current patterns and avoid unrelated refactors or premature abstractions.
- Make the smallest viable data-model change.
- Do not add visual placeholders for unimplemented features.
- Historical GitHub issues and milestones are architecture input, not automatically the current operational backlog. Adopt them into the current Project only after triage.
- GitHub Issues and one GitHub Project are the operational backlog; repository documents hold durable policy, architecture, and decisions.

## Testing and verification

For code changes, run the checks proportional to the affected layers, normally:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

Changes crossing API, database, or end-to-end flows may also require integration tests and Playwright/Docker checks. Add or update tests for behavior changes. If a check fails, establish whether it is pre-existing or introduced and report that clearly.

Documentation-only changes require at least template syntax validation, link/path review, and `git diff --check`; they do not require the full application suite unless they affect executable configuration.

## Handoff

At task end report:

1. Outcome and files changed.
2. Key implementation, rule, and architecture decisions.
3. Verification results.
4. Baseline, branch, push/PR state, and intended target.
5. Remaining risks, decisions, and follow-up work.
