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

There are **two** Playwright projects, and they are not interchangeable:

- `apps/web/playwright.config.ts` drives the full end-to-end suite in
  `apps/web/e2e`, which is wired into the CI `docker-test` job after the API and
  web containers have started.
- `apps/web/browser-tests/playwright.config.ts` drives the narrow
  `**/*.spec.mts` browser checks in `apps/web/browser-tests`.

The suite is not read-only. `apps/web/e2e/global-setup.ts` seeds deterministic
smoke users, a campaign/scenario, and a player character **through the API**,
starting with `POST /auth/register`, before the first spec runs.
`PLAYWRIGHT_API_URL` therefore selects the database those accounts are written
into, and must always name the stack you actually started. Never copy a literal
port from this document: a hardcoded `localhost:4000` drives whichever process
holds that port, which on a developer machine is normally the primary
checkout's API on the shared playtest database.

**From a task-isolated worktree**, run the suite through `db:task:exec`, which
supplies this worktree's own `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_API_URL` and
`PLAYWRIGHT_BROWSER_API_URL` derived from the same worktree key as its database
target, so the browser proof and the disposable database cannot drift apart:

```bash
pnpm db:task:exec -- pnpm --filter @glantri/web playwright
```

Global setup prints a `Playwright smoke target:` line naming the resolved API
and web URLs before its first write; check it against the stack you intended.
Why those addresses are derived rather than chosen is the controlling subject of
[task stack ports and addresses](./dev-database.md#task-stack-ports-and-addresses),
and is not repeated here.

### Running the e2e suite without `db:task:exec` — recorded 2026-09-26

`pnpm db:task:exec` refuses to run Playwright while its own stack is already up,
so a worker that must start the stack first and then run the suite has to
propagate the environment by hand. **Exporting only `PLAYWRIGHT_BASE_URL` and
`PLAYWRIGHT_API_URL` is not sufficient**, and the shortfall surfaces as spurious
spec failures rather than as a configuration error. This supersedes the earlier
two-variable invocation this section documented.

Export **the whole of this worktree's own `.env.task`**, and set the artifact
root, before naming the Playwright addresses:

```bash
set -a && . ./.env.task && set +a
export ARTIFACT_LOCAL_ROOT="$(mktemp -d)"
PLAYWRIGHT_BASE_URL=http://127.0.0.1:<web-port> \
  PLAYWRIGHT_API_URL=http://127.0.0.1:<api-port> \
  pnpm --filter @glantri/web playwright
```

`.env.task` is created by `db:task:setup` and is never hand-written or copied;
its six required values and the guard that validates them are recorded in
[dev-database.md](./dev-database.md#task-database-commands).

Three traps, each of which has already been misreported as a product defect:

- **Specs that write through the database directly need `DATABASE_URL` and the
  `GLANTRI_DB_*` values**, which is why the whole file must be exported.
  `apps/web/e2e/lost-seal-scenario.spec.ts:31` and
  `apps/web/e2e/player-attack-initiative-identity.spec.ts:222` write through
  `setScenarioParticipantVisibilityForTest`. With only the two `PLAYWRIGHT_*`
  variables exported they fail; with the full `.env.task` exported and a
  recycled database they pass. **Neither is a pre-existing failure.**
- **`ARTIFACT_LOCAL_ROOT` must be set**, or three specs fail on a
  missing-environment assertion rather than on product behaviour — see
  `apps/web/e2e/blackboard.spec.ts:121-122` and
  `apps/web/e2e/artifactImports.spec.ts:231`.
- **`apps/web/e2e/global-setup.ts` is not idempotent.** A second run against the
  same database fails with `409 CHARACTER_ALREADY_IN_ACTIVE_CAMPAIGN`, so
  **every full e2e run needs a fresh, unseeded disposable database.**

To recycle that database between runs, use `db:task:cleanup`, then
`db:task:setup`, then `db:task:migrate`. **`db:task:reset -- --target
application --confirm` is not available to an automated worker**: it is blocked
by a Prisma AI-consent guard no automated worker can satisfy. The command stays
listed in
[dev-database.md](./dev-database.md#task-database-commands) because it remains
the supported interactive path; this note records only that agents must use the
cleanup/setup/migrate sequence instead.

### Pre-existing Playwright failure baseline — recorded 2026-09-26

Established by independent QA on clean `dev` at
`445bb5c580db3bbfc800a281e72cd1ceb62b5dfb`, in a dedicated worktree with its own
disposable database, and cross-checked against the head of the lane then under
review: identical failure sets on both sides. Six failures are pre-existing. **A
lane is not accountable for these six; it is accountable for not adding a
seventh.**

Four in the `apps/web/playwright.config.ts` end-to-end project:

| Spec                                                    | Case                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/web/e2e/artifactImports.spec.ts:10`               | creates, reuses, revises, retires and imports through review at narrow width         |
| `apps/web/e2e/artifacts.spec.ts:16`                     | publishes a safe visual Artifact to entitled players without exposing GM controls    |
| `apps/web/e2e/character-lifecycle-recovery.spec.ts:85`  | keeps canonical truth visible while a failed identity draft is reviewed or discarded |
| `apps/web/e2e/character-lifecycle-recovery.spec.ts:138` | restores canonical progression after failure and retains explicit recovery controls  |

Two in the `apps/web/browser-tests/playwright.config.ts` project: **both
viewport cases** of `apps/web/browser-tests/skill-reference.spec.mts` — "Skill
reference stays usable at 1440px" and the same check at 390px.

**`apps/web/e2e/blackboard.spec.ts:27` is not one of them. It is expected to
pass.** It passed at clean `445bb5c5` and at the lane head in two independent
runs (19.2 s and 19.4 s). A Builder reported it as a fourth pre-existing
end-to-end failure: the _count_ of four was right, the _identity_ was wrong, most
likely because that run was made against an already-seeded database. **Treat any
failure of `blackboard.spec.ts` as a real regression**, not as baseline noise,
and re-derive the run against a fresh disposable database before reporting it.

Before attributing any failure above to a lane, confirm the run satisfied the
environment requirements in
[running the e2e suite without `db:task:exec`](#running-the-e2e-suite-without-dbtaskexec--recorded-2026-09-26).
Most reported extra failures so far have been environment shortfalls, not
product defects.

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

Artifact authoring, AI-assisted intake and package import share **one** staging/preview/explicit-accept pipeline with three entry points, so regression breadth for any one of them covers the others' surfaces and must cover the shared acceptance transaction. The controlling contract is [Content authoring, Scenario preparation and Artifact management](product/content-authoring-scenario-preparation-and-artifact-management.md).

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
