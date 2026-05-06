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
