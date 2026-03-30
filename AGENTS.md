# AGENTS.md

## Repository
This is the existing Glantri app monorepo. Work from the current implementation. Do not create a new app or replace the architecture.

## Priorities
1. Prefer small, reviewable changes
2. Put shared logic in shared/domain/rules-engine layers before wiring UI
3. Avoid unrelated refactors
4. Preserve current app behavior unless the task explicitly changes it

## Project structure
- `apps/web` — Next.js frontend and admin/chargen UI
- `apps/api` — API routes and server logic
- `packages/*` — shared packages, schemas, content, database, rules engine, shared contracts

## Likely important areas
- `apps/web/app/(app)/chargen/ChargenWizard.tsx`
- admin pages under `apps/web/app/(app)/admin/...`
- shared content/types/validators in `packages/...`
- rules and progression logic in rules-engine/domain packages

## Working style
- Start from existing code patterns
- Reuse existing helpers where reasonable
- Do not introduce broad abstractions unless clearly justified
- Keep patches focused on the requested task
- If data model changes are needed, make the smallest viable change

## Testing and verification
When making code changes, run:
- `pnpm build`
- `pnpm lint`
- `pnpm test`

If a command fails:
- determine whether it is pre-existing or introduced by your change
- explain that clearly in the final summary

## Git expectations
- Do not create new branches unless explicitly asked
- Make changes directly in the checked-out working tree
- Keep commits focused and readable

## Output summary format
At the end of a task, report:
1. what was changed
2. files changed
3. key implementation decisions
4. verification results
5. any follow-up recommendations

## Current product direction
Important current design assumptions:
- skills support `primary`, `secondary`, and `specialization`
- specialization usually depends on a parent skill and often a minimum parent level
- dependencies may be `required`, `recommended`, or `helpful`
- hard-enforce dependency and specialization gates
- society fit and profession fit should usually be advisory, not hard blocking
- professions are structured as family + subtype
- professions grant training groups and sometimes direct skills

## Avoid for now
- do not implement large unrelated refactors
- do not redesign the whole admin UI
- do not redesign the whole chargen flow unless the task explicitly calls for it
- do not import content packs into production content unless explicitly asked
