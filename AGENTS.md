# AGENTS.md

Repository

This is the existing Glantri app monorepo. Work from the current implementation. Do not create a new app or replace the architecture.

Priorities 1. Prefer small, reviewable changes 2. Put shared logic in shared/domain/rules-engine layers before wiring UI 3. Avoid unrelated refactors 4. Preserve current app behavior unless the task explicitly changes it

Project structure
• apps/web — Next.js frontend and admin/chargen UI
• apps/api — API routes and server logic
• packages/\* — shared packages, schemas, content, database, rules engine, shared contracts

Likely important areas
• apps/web/app/(app)/chargen/ChargenWizard.tsx
• admin pages under apps/web/app/(app)/admin/...
• shared content/types/validators in packages/...
• rules and progression logic in rules-engine/domain packages

Architecture and import rules

Package dependency direction is strictly top-down:
• apps/_ may import from packages/_ — never the reverse
• packages/rules-engine imports only from packages/domain — not from apps/_ or packages/database
• packages/domain has no imports from other repo packages (it is the bottom layer)
• @glantri/test-scenarios is forbidden outside _.test.ts, \*.test.tsx, and e2e/
• apps/web/app/ uses @/ alias to apps/web/src/ — do not write long relative ../../src/ paths
• packages/database repositories are internal — external callers use services only
• All game rule calculations go in packages/rules-engine, not in web features

Where to place new code

• New UI feature → apps/web/src/features/<feature>/ with thin route in app/.../page.tsx
• New API route group → apps/api/src/routes/<feature>/ with routes.ts, handlers.ts, parse.ts
• New domain type or Zod schema → packages/domain/src/<domain>/
• New game rule calculation → packages/rules-engine/src/<domain>/
• New database operation → packages/database/src/services/<domain>/ (repositories are internal)
• New API request/response contract → packages/domain/src/api/ or packages/shared/src/contracts/
• New test fixture → packages/test-scenarios — only usable from tests/e2e

Feature folder structure for apps/web/src/features/<feature>/

Large features must follow this layout:
README.md — responsibility, entrypoints, state location, API calls, test commands
index.ts
components/ — pure presentational components, no side effects
hooks/ — data loading and side effects (useXData.ts)
state/ — reducer/state machine using useReducer, not many useState
view-models/ — pure functions for filtering, sorting, display models
tests/

page.tsx files in app/ are thin wrappers — no state, no fetch, layout only.
State machines and view models must be testable without React.

File size guideline

Files over ~500 lines are a signal of too many responsibilities. Exceptions are generated data and large test files. See routes/scenarios/ (API) and the feature folder structure (web) as reference splits.

Working style
• Start from existing code patterns
• Reuse existing helpers where reasonable
• Do not introduce broad abstractions unless clearly justified
• Keep patches focused on the requested task
• If data model changes are needed, make the smallest viable change

Testing and verification

When making code changes, run:
• pnpm build
• pnpm lint
• pnpm test

If a command fails:
• determine whether it is pre-existing or introduced by your change
• explain that clearly in the final summary

Git expectations
• Do not create new branches unless explicitly asked
• Make changes directly in the checked-out working tree
• Keep commits focused and readable

Output summary format

At the end of a task, report: 1. what was changed 2. files changed 3. key implementation decisions 4. verification results 5. any follow-up recommendations

Current product direction

Important current design assumptions:
• skills support primary, secondary, and specialization
• specialization usually depends on a parent skill and often a minimum parent level
• dependencies may be required, recommended, or helpful
• hard-enforce dependency and specialization gates
• society fit and profession fit should usually be advisory, not hard blocking
• professions are structured as family + subtype
• professions grant training groups and sometimes direct skills

Avoid for now
• do not implement large unrelated refactors
• do not redesign the whole admin UI
• do not redesign the whole chargen flow unless the task explicitly calls for it
• do not import content packs into production content unless explicitly asked

Spreadsheet-derived rules policy

This repository implements game rules that must match source spreadsheets exactly.

When a task depends on workbook calculations:
• Treat the spreadsheet as the source of truth.
• Do not invent, approximate, simplify, or substitute formulas.
• Do not confuse nearby concepts such as stat modifier, GM stat, capped adjustment, OB contribution, or similar values.
• Before changing code, extract and report:
• workbook
• sheet
• exact cell range
• exact formula or workbook logic
• target code mapping
• If the spreadsheet is ambiguous, preserve the ambiguity and report it instead of guessing.
• Add spreadsheet-backed tests with hardcoded expected outputs.
• Prefer narrow fixes over redesigns.
• Keep layers separate:
• raw import
• manual enrichment
• normalization
• derivation
• verification
• Do not move to derivation or UI changes until verification passes for the relevant formula set.

Strict calculation mode

For calculation-heavy tasks:
• Exactness is more important than completeness.
• If a value is not explicitly derivable from the cited spreadsheet cells or approved repo rules docs, leave it unresolved and report it.
• If implementation and spreadsheet disagree, prefer the spreadsheet and report the mismatch explicitly.
• Before changing code, produce a short formula-mapping note:
• source cells
• source formula
• target field / code location
• ambiguity list
• Only then implement.

Skill XP rule for combat calculations

For combat calculations, use total skill XP only.

In this codebase:
• effectiveSkillNumber is the canonical workbook-equivalent total skill XP
• it includes all skill XP regardless of source, including direct allocation and group-derived contribution

Do not use partial skill values such as:
• only direct/specific skill allocation
• only group contribution

The split between direct allocation and group contribution exists for character building and later progression workflows, not for combat math.

## Agent pre-flight rule

Before implementing any non-trivial change, the agent must first sync with the current project architecture.

Read, when present:

- `AGENTS.md`
- `docs/architecture/current-refactor-priorities.md`
- `docs/architecture/recent-architecture-changes.md`
- `docs/product/campaign-scenario-encounter-workflows.md`
- `docs/testing-regression-matrix.md`

Then inspect the current source files relevant to the task. Do not rely on assumptions from older branches or earlier conversations.

Before changing files, identify:

1. Which current files/helpers/components are canonical for this task.
2. Whether the target area was recently refactored.
3. Where the new code should live.
4. Which existing tests protect the area.
5. Which verification commands must be run.

Rules:

- Preserve the current architecture from `main`.
- Use existing extracted components, helpers, and services.
- Do not re-inline logic that has been extracted.
- Do not create duplicate calculation paths.
- Put business/game rules in `domain` or `rules-engine` where practical.
- Keep UI pages mostly as orchestration/composition where practical.
- Add or update tests for behavior changes.
- Do not add visual placeholders for unimplemented features.
