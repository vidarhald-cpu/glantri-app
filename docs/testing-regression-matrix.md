# Testing And Refactor Safety

This document is the pre-refactor safety map for the Glantri monorepo. It tracks
which product workflows are protected by automated tests, where manual smoke
checks are still needed, and which areas should get characterization tests before
large structural changes.

## Pre-Refactor Verification

Run these commands before and after broad refactors:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use this command when you need a coverage snapshot:

```bash
pnpm coverage
```

Coverage is report-only for most packages, but refactor-critical packages use
baseline Vitest thresholds that pass today's suite while preventing silent
regression: rules-engine protects statements and branches, domain protects
statements, and database protects service statements.

## Database Integration Tests

Database/service integration tests live under `packages/database/src/services`.
In a linked Builder/QA worktree, use the owned disposable PostgreSQL 16 workflow:

```bash
pnpm db:task:setup -- --task <issue>
pnpm db:task:test
```

The CI `docker-test` job starts Postgres, applies Prisma migrations to
`glantri_test`, and runs the same filtered database test command before building
the API and web containers. The test safety check rejects the protected normal
database, a test database that aliases `DATABASE_URL`, a non-local production-like
host, or a database name without the `_test` suffix. The test setup resets
service-owned tables between suites, so never bypass the guard or reuse local dev,
production, or another worktree's target.

The database safety regression suite also inventories every repository-owned
direct `PrismaClient` construction and covers copied `.env.task` files, foreign
full environments, missing ownership with a foreign test URL, container-label
and cleanup mismatches, and unsafe task-environment permissions. These checks
must remain green alongside a positive isolated target and two-worktree
concurrency proof.

## Playwright Smoke Tests

The browser smoke suite lives in `apps/web/e2e` and is wired into the CI
`docker-test` job after the API and web containers have started.

Run it locally against running web/API servers with:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 PLAYWRIGHT_API_URL=http://localhost:4000 pnpm --filter @glantri/web playwright
```

The suite seeds deterministic smoke users, a campaign/scenario, and a player
character through the API in `apps/web/e2e/global-setup.ts`.

## Selecting independent-QA regression breadth

The compact QA procedure is `docs/process/qa-execution.md`. INITIAL QA selects
the broad, proportionate rows and gaps relevant to the complete approved claim.
REPAIR QA re-runs the exact failed gate and directly affected regressions; it
may carry forward a prior PASS only for a direct-child repair whose actual delta
cannot affect that surface.

Escalate REPAIR QA to broader or full relevant regression when the delta
touches schema/migrations, shared authorization/projection/serialization/API or
domain authority, concurrency/transactions, cross-cutting exports/toolchain,
major Combat/Scenario projections, unexpectedly broad scope, or unclear
non-direct-child/rebased topology. Privacy/security, browser, and database gates
remain conditional on impact and are never skipped solely because the mode is
REPAIR.

## Refactor-Critical Areas

Treat these paths as high-value coverage targets:

- `packages/rules-engine/src/**`
- `packages/domain/src/**`
- `packages/content/src/**`
- `packages/database/src/services/**`
- `packages/database/src/repositories/**`
- `apps/api/src/lib/**`
- `apps/api/src/routes/**`
- `apps/web/src/lib/**`
- `apps/web/src/features/**`
- `apps/web/app/(app)/**`

## Stable vs Actively Evolving Areas

Stable/protected workflows should get the strongest characterization tests before
large refactors:

- Chargen
- Character Sheet
- Character Progression
- Admin Skills/Professions/content screens
- Rules Docs
- Campaign roster basics

Encounter workflows are still in active product design. Protect stable
invariants there, but avoid brittle tests that freeze current layout, section
order, table order, or exact button placement:

- GM Scenario screen
- Encounter and Skill rolls workspace screens
- Roleplay encounter roll UI
- Combat encounter UI

## Functional Regression Matrix

| Workflow                         | Primary role      | Main modules                                                                                                                                                                                                                   | Current automated coverage                                                                                                                                                                                                                                                                                                              | Remaining gap                                                                                                                                                                                                | Refactor risk |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Auth/session                     | Player, GM, admin | `packages/auth`, `apps/api/src/lib/sessionAuth.ts`, `apps/web/src/lib/auth`                                                                                                                                                    | `packages/auth/src/session.test.ts`, `apps/api/src/lib/sessionAuth.test.ts`, `apps/web/src/lib/auth/authBootstrap.test.ts`, Playwright login smoke                                                                                                                                                                                      | Browser logout smoke test                                                                                                                                                                                    | Moderate      |
| API health/runtime               | System            | `apps/api/src/app.ts`, deploy workflows                                                                                                                                                                                        | `apps/api/src/app.test.ts`, `apps/api/src/lib/readiness.test.ts`, Docker readiness smoke in CI                                                                                                                                                                                                                                          | Deploy smoke still depends on real hosted DB availability                                                                                                                                                    | Moderate      |
| CORS/cookie contract             | Browser, API      | `apps/api/src/lib/sessionAuth.ts`                                                                                                                                                                                              | `apps/api/src/lib/sessionAuth.test.ts`                                                                                                                                                                                                                                                                                                  | Same-origin proxy strategy is not covered until chosen                                                                                                                                                       | Moderate      |
| Chargen rules                    | Player            | `packages/rules-engine/src/chargen`, `packages/domain/src/character`                                                                                                                                                           | `primaryAllocation.test.ts`, `selectionStructure.test.ts`, `statResolution.test.ts`, `importedContentIntegration.test.ts`; covers canonical content initialization, group pricing, required slot choices, and Longbow-as-specialization behavior                                                                                        | One or two UI smoke interactions for user-facing choice flows, avoiding full brittle end-to-end chargen scripts                                                                                              | High          |
| Chargen UI/helpers               | Player            | `apps/web/app/(app)/chargen/ChargenWizard.tsx`, `apps/web/src/lib/chargen`                                                                                                                                                     | `ChargenWizard.test.ts`, `ChargenWizard.component.test.tsx`, `chargenBrowse.test.ts`, Playwright chargen smoke                                                                                                                                                                                                                          | Rendered React interaction tests for deeper choices if setup remains lightweight                                                                                                                             | High          |
| Character Sheet/browser/edit     | Player, GM        | `apps/web/src/lib/characters`, `packages/database/src/services/characterService.ts`                                                                                                                                            | `characterBrowser.test.ts`, `characterSheet.test.ts`, `characterEdit.test.ts`, `characterService.test.ts`, Playwright characters-list smoke; sheet tests cover stat columns, skill XP columns, specialization XP, derived XP, total skill level, and current skill-point gains                                                          | Character sheet route smoke for browser rendering                                                                                                                                                            | Moderate      |
| Character Progression            | Player            | `packages/rules-engine/src/advancement`, `apps/web/src/lib/characters`                                                                                                                                                         | `advanceCharacter.test.ts`, `loadLocalCharacterAdvancementContext.test.ts`; covers requested/approved checks, requested-only rejection, point deduction, provisional rows, success/failure history, and progression-point gains separate from chargen points                                                                            | UI smoke test for advancement workflow                                                                                                                                                                       | High          |
| Equipment/loadout/combat stats   | Player, GM        | `apps/web/src/features/equipment`, `packages/database/src/services/characterEquipment*`, `packages/content/src/equipment`                                                                                                      | Equipment selector/loadout/movement/combat panel tests, importer/content tests, database equipment write integration tests                                                                                                                                                                                                              | Service read-model integration breadth                                                                                                                                                                       | High          |
| Canonical Field Equipment v1     | Player, GM        | Character equipment services, Campaign/Scenario Item routes and projections, Combat Item commands, inventory/loadout UI                                                                                                        | Preserve one concrete Item ID through assignment, transfer, Scenario availability/pickup, and Combat use; prove expected-revision atomic rollback, active-ammunition persistence/consumption, supported undo, and relationship-derived negative payloads                                                                                | Cover external `STALE` detection and explicit GM reconciliation separately from coherent authoritative in-play mutations; include reload/reconnect plus desktop and 390px Item/Combat/Lost Seal evidence     | High          |
| Combat calculations              | Player, GM        | `packages/rules-engine/src/combat`, `apps/web/src/features/equipment`                                                                                                                                                          | `workbookCombatMath.test.ts`, `combatVerification.test.ts`, `composeDefenseValues.test.ts`, `combatStateDerivation.test.ts`                                                                                                                                                                                                             | More spreadsheet-backed golden rows for varied loadouts                                                                                                                                                      | High          |
| Campaign roster/workspace        | GM, player        | `apps/web/src/lib/campaigns`, `apps/web/app/(app)/campaigns`, `apps/api/src/routes/scenarios/campaignRoutes.ts`, `packages/database/src/services/campaignService.ts`                                                           | Campaign workspace/detail tests, `campaignService.test.ts`, `scenarios.test.ts`, scenario service integration tests, Playwright seeded campaign smoke; roster service tests cover per-campaign membership, dedupe, unlink, and source preservation                                                                                      | Player-side browser smoke for campaign access                                                                                                                                                                | High          |
| Shared Campaign Blackboard       | GM, player        | `packages/domain/src/campaign/blackboard.ts`, `packages/database/src/{repositories,services}/blackboard*`, `apps/api/src/routes/scenarios/blackboardRoutes.ts`, `apps/web/src/features/blackboard`, Campaign workspace routing | Domain/service/API/component/database/Playwright Blackboard suites cover four-entry projection, authorship, common-payload privacy, restricted-detail exclusion, Artifact snapshots/content boundary, revision history, tombstones, layout concurrency, search/filter composition, stable entry links, reload, focus, and narrow layout | Independent QA should keep negative payload assertions explicit across unauthorized/cross-Campaign, removal/archive, correction/replacement, and Artifact withdrawal/access transitions                      | High          |
| Scenario/encounter API           | GM, player        | `apps/api/src/routes/scenarios/` (campaignRoutes, scenarioRoutes, encounterRoutes, participantRoutes, templateRoutes), `packages/database/src/services/scenarioService.ts`                                                     | `apps/api/src/routes/scenarios.test.ts`, `packages/database/src/services/scenarioService.test.ts`                                                                                                                                                                                                                                       | Narrow scenario/encounter API contract tests as read models are split                                                                                                                                        | High          |
| Encounter/roleplay screens       | GM, player        | `apps/web/app/(app)/encounters`, `packages/domain/src/encounter`                                                                                                                                                               | `EncounterDetail.test.ts`, `RoleplayEncounterScreens.test.ts`, `roleplay.test.ts`; encounter invariants are covered separately by issue #124                                                                                                                                                                                            | Keep tests focused on invariants such as session normalization, roll rules, opposed comparison, silent data hiding, and read-model contracts; defer detailed layout/browser tests while encounter UI evolves | Moderate      |
| Admin content/rules docs/players | Admin, GM         | `apps/web/app/(app)/admin`, `apps/web/src/lib/admin`, `apps/api/src/routes/adminContent.ts`, `apps/web/src/lib/rulesDocs.ts`                                                                                                   | `admin-ui.test.ts`, `PlayersAdminPage.test.ts`, `MarkdownRenderer.test.ts`, `viewModels.test.ts`, `rulesDocs.test.ts`; rules docs registry covers Chargen, Character Sheet, Equipment & Encumbrance, Equip Items, and Character Progression calculations                                                                                | API route characterization for admin content save conflicts                                                                                                                                                  | Moderate      |
| Web API client                   | Browser           | `apps/web/src/lib/api/localServiceClient.ts`                                                                                                                                                                                   | `apps/web/src/lib/api/localServiceClient.test.ts`                                                                                                                                                                                                                                                                                       | More methods can be added as domains are split                                                                                                                                                               | High          |

## Test Policy For Large Refactors

- Add characterization tests before moving code when behavior is not obvious.
- Prefer service/helper tests for logic and a few browser/e2e smoke tests for
  wiring.
- Put the strongest characterization coverage around stable/protected flows:
  Chargen, Character Sheet, Character Progression, Admin content/rules docs, and
  Campaign roster basics.
- For encounter screens, test stable invariants instead of current visual layout:
  encounter session normalization, roleplay roll rules, opposed roll comparison,
  scenario participant vs encounter participant boundaries, hidden/silent data
  not visible to players, and API/read-model contracts.
- For privacy-sensitive workflows, apply the
  [Authority and Information Projection Principle](./architecture/information-authority-and-projection.md):
  assert protected keys, values, identities, relationships, and executable state
  are absent from unauthorized payloads, DTOs, serialized responses, generated
  HTML, and rendered output across relevant roles and state transitions.
- Avoid detailed Playwright or component tests that lock current encounter table
  order, section order, or exact button placement until encounter product design
  settles.
- Keep spreadsheet-derived tests tied to exact workbook/sheet/cell references.
- Do not use coverage percentage alone as a quality signal; use this matrix to
  decide whether the touched workflow has the right kind of coverage.
