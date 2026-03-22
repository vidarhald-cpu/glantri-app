# Architecture Scaffold Migration

## What changed

- Stabilized the monorepo toolchain:
  - Added an ESLint 9 flat config at the repo root.
  - Added `typecheck` scripts and Turbo task wiring.
  - Changed package `test` scripts to use `vitest run --passWithNoTests`.
  - Split package `build` from `typecheck` and added emitted `dist/` outputs for buildable packages.
  - Hardened root validation commands to run fresh with `turbo ... --force`.
- Cleaned up `apps/web`:
  - Removed the duplicate `src/app/page.tsx`.
  - Added an app-shell route group and placeholder routes for `/`, `/auth`, `/chargen`, and `/characters`.
  - Added `outputFileTracingRoot` in Next config to avoid workspace root ambiguity.
  - Added Dexie-backed offline scaffolding for chargen sessions, local character drafts, cached content, and sync client structure.
- Added `apps/api`:
  - Fastify bootstrap with route modules for `/auth`, `/content`, `/chargen`, `/characters`, `/sync`, plus `/health`.
  - Only scaffold/status behavior is implemented; no product endpoints yet.
- Added and reshaped packages:
  - Added `@glantri/domain` for framework-independent content and character schemas/types.
  - Added `@glantri/content` for canonical content types, validators, seed shape, and loader abstraction.
  - Added `@glantri/auth` for shared auth roles, user/session schemas, and role checks.
  - Kept `@glantri/rules-engine`, but expanded it with pure scaffolding modules for chargen, stats, skills, education, and validation.
  - Kept `@glantri/database`, but added repository/service boundaries and minimal Prisma auth models.
  - Kept `@glantri/schemas` as a compatibility wrapper around the new domain package.
- Wired workspace dependencies explicitly with `workspace:*` and package exports.

## What was added

- Domain schemas/types for:
  - `SkillGroupDefinition`
  - `SkillDefinition`
  - `SkillSpecialization`
  - `ProfessionDefinition`
  - `ProfessionSkillMap`
  - `SocietyLevelAccess`
  - `RolledCharacterProfile`
  - `CharacterSkillGroup`
  - `CharacterSkill`
  - `CharacterSpecialization`
  - `CharacterProgression`
- Content scaffolding for:
  - canonical content validators
  - default seed structure
  - loader interface
- Rules-engine placeholder pure functions for:
  - `generateProfiles`
  - `selectProfile`
  - `calculateAdjustedStats`
  - `calculateGms`
  - `calculateGroupLevel`
  - `calculateSkillLevel`
  - `calculateSpecializationLevel`
  - `calculateEducation`
  - `validateCharacterBuild`
- Database/auth scaffolding:
  - Prisma models for `User`, `Role`, `UserRole`, `Session`
  - Prisma-backed character/auth repositories and services

## What was deferred

- Real auth flows, password storage, account recovery, and authorization enforcement.
- Real content import from workbook sources.
- Real chargen, skill, education, and validation rules.
- Real sync queue processing, conflict handling, and push/pull semantics.
- Real API behavior beyond status/scaffold responses.
- Real web UX for the offline store; the store layer exists, but the pages do not consume it yet.
- Canonical content tables in PostgreSQL; content is scaffolded as package-level seed/loader contracts first.
- Next-specific ESLint rule integration; lint is working, but the current config is intentionally generic.
- Review flag: `merchant` currently has a scholarly-group foothold to keep the demo secondary/specialization path reachable. Revisit this after broader content and profession balancing so the final content model is not shaped by demo-path constraints.

## Commands that now pass

- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`

## Next recommended implementation step

Implement the first vertical slice around canonical content and chargen drafts:

1. Populate `@glantri/content` with a minimal canonical seed for skill groups, skills, and professions.
2. Expose that content through `apps/api` `/content`.
3. Load and cache that content into the Dexie content cache in `apps/web`.
4. Build the first real chargen draft flow on top of the local repositories and pure rules-engine functions.
