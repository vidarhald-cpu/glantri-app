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

Coverage is intentionally report-only for now. The first goal is to make weak
spots visible without blocking useful cleanup because of old test debt.

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

## Functional Regression Matrix

| Workflow | Primary role | Main modules | Current automated coverage | Remaining gap | Refactor risk |
| --- | --- | --- | --- | --- | --- |
| Auth/session | Player, GM, admin | `packages/auth`, `apps/api/src/lib/sessionAuth.ts`, `apps/web/src/lib/auth` | `packages/auth/src/session.test.ts`, `apps/api/src/lib/sessionAuth.test.ts`, `apps/web/src/lib/auth/authBootstrap.test.ts` | Browser-level login/logout smoke test | Moderate |
| API health/runtime | System | `apps/api/src/app.ts`, deploy workflows | `apps/api/src/app.test.ts`, Docker smoke in CI | `/ready` with DB check is not implemented yet | Moderate |
| CORS/cookie contract | Browser, API | `apps/api/src/lib/sessionAuth.ts` | `apps/api/src/lib/sessionAuth.test.ts` | Same-origin proxy strategy is not covered until chosen | Moderate |
| Chargen rules | Player | `packages/rules-engine/src/chargen`, `packages/domain/src/character` | `primaryAllocation.test.ts`, `selectionStructure.test.ts`, `statResolution.test.ts`, `importedContentIntegration.test.ts` | UI-level component tests for real user interaction | High |
| Chargen UI/helpers | Player | `apps/web/app/(app)/chargen/ChargenWizard.tsx`, `apps/web/src/lib/chargen` | `ChargenWizard.test.ts`, `chargenBrowse.test.ts` | Rendered React interaction tests | High |
| Character browser/sheet/edit | Player, GM | `apps/web/src/lib/characters`, `packages/database/src/services/characterService.ts` | `characterBrowser.test.ts`, `characterSheet.test.ts`, `characterEdit.test.ts`, `characterService.test.ts` | E2E route smoke for browser rendering | Moderate |
| Character advancement | Player | `packages/rules-engine/src/advancement`, `apps/web/src/lib/characters` | `advanceCharacter.test.ts`, `loadLocalCharacterAdvancementContext.test.ts` | UI smoke test for advancement workflow | High |
| Equipment/loadout/combat stats | Player, GM | `apps/web/src/features/equipment`, `packages/database/src/services/characterEquipment*`, `packages/content/src/equipment` | Equipment selector/loadout/movement/combat panel tests, importer/content tests, database equipment write test | Service read-model integration breadth | High |
| Combat calculations | Player, GM | `packages/rules-engine/src/combat`, `apps/web/src/features/equipment` | `workbookCombatMath.test.ts`, `combatVerification.test.ts`, `composeDefenseValues.test.ts`, `combatStateDerivation.test.ts` | More spreadsheet-backed golden rows for varied loadouts | High |
| Campaign workspace | GM, player | `apps/web/src/lib/campaigns`, `apps/web/app/(app)/campaigns`, `apps/api/src/routes/scenarios.ts` | Campaign workspace/detail tests, `scenarios.test.ts`, service tests | Browser smoke with seeded campaign | High |
| Scenario/encounter API | GM, player | `apps/api/src/routes/scenarios.ts`, `packages/database/src/services/scenarioService.ts` | `apps/api/src/routes/scenarios.test.ts`, `packages/database/src/services/scenarioService.test.ts` | More endpoint coverage before splitting every route group | High |
| Encounter/roleplay screens | GM, player | `apps/web/app/(app)/encounters`, `packages/domain/src/encounter` | `EncounterDetail.test.ts`, `RoleplayEncounterScreens.test.ts`, `roleplay.test.ts` | Browser smoke for active encounter | Moderate |
| Admin content/rules docs/players | Admin, GM | `apps/web/app/(app)/admin`, `apps/web/src/lib/admin`, `apps/api/src/routes/adminContent.ts` | `admin-ui.test.ts`, `PlayersAdminPage.test.ts`, `MarkdownRenderer.test.ts`, `viewModels.test.ts` | API route characterization for admin content save conflicts | Moderate |
| Web API client | Browser | `apps/web/src/lib/api/localServiceClient.ts` | `apps/web/src/lib/api/localServiceClient.test.ts` | More methods can be added as domains are split | High |

## Test Policy For Large Refactors

- Add characterization tests before moving code when behavior is not obvious.
- Prefer service/helper tests for logic and a few browser/e2e smoke tests for
  wiring.
- Keep spreadsheet-derived tests tied to exact workbook/sheet/cell references.
- Do not use coverage percentage alone as a quality signal; use this matrix to
  decide whether the touched workflow has the right kind of coverage.
