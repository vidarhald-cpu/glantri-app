# Recent architecture changes

Handoff notes for Codex and collaborators. Updated after each significant architecture PR.

---

## PRs #165, #168, #172, #173, #174 — 2026-05-16 (refactor/epic-8-structural-cleanup)

### Changed areas

| PR | What changed |
|----|-------------|
| #173 | `packages/rules-engine/src/chargen/primaryAllocation.ts` (2573 lines) split into 7 files under `primaryAllocation/` |
| #172 | Pure combat derivation functions moved from `apps/web` to `packages/rules-engine/src/combat/deriveCombatValues.ts` |
| #174 | Roleplay state transition functions moved from `packages/domain/src/encounter/roleplay.ts` to `packages/rules-engine/src/encounters/roleplayTransitions.ts` |
| #165 | Standardised error handling in `apps/api/src/routes/characters.ts` and `chargen.ts` via `apps/api/src/lib/errors.ts` (`BadRequestError`, `NotFoundError`, `handleRouteError`) |
| #168 | Shared admin UI primitives added to `apps/web/app/(app)/admin/admin-ui.tsx`: `AdminWorkspaceTabs`, `AdminMatrixGroup`, `AdminActionRow` |

### New canonical entry points

**chargen primary allocation** (`packages/rules-engine/src/chargen/primaryAllocation/`):
- `_helpers.ts` — shared private types and helpers
- `access.ts` — profession/society access control
- `costs.ts` — cost calculations and pool requests
- `draftState.ts` — spend/remove mutations
- `views.ts` — `buildChargenDraftView` and view helpers
- `review.ts` — `reviewChargenDraft`
- `finalize.ts` — `finalizeChargenDraft`
- `primaryAllocation.ts` is now a re-export barrel — **do not add logic here**

**combat derivations** (`packages/rules-engine/src/combat/deriveCombatValues.ts`):
- `getDerivedInitiativeValue`, `getDerivedObValue`, `getDerivedDmbValue`, `getDmbValue`
- `getWorkbookWeaponRowParry`, `getWorkbookShieldRowParry`, `getWorkbookCombinedRowParry`
- `getWorkbookOneItemDefensePair`, `getGripSummary`
- Re-exported from `packages/rules-engine/src/index.ts`

**roleplay state transitions** (`packages/rules-engine/src/encounters/roleplayTransitions.ts`):
- `withRoleplayState`, `assignRoleplaySkillRoll`, `recordRoleplayGmSkillRoll` and related
- Re-exported from `packages/rules-engine/src/index.ts`

**API error handling** (`apps/api/src/lib/errors.ts`):
- `BadRequestError`, `NotFoundError`, `handleRouteError` — use these in all route handlers

**Admin UI primitives** (`apps/web/app/(app)/admin/admin-ui.tsx`):
- `AdminWorkspaceTabs` — replaces per-page `*WorkspaceTabs` components
- `AdminMatrixGroup` — wraps `AdminPanel` + `AdminDataTable` pattern
- `AdminActionRow` — replaces inline flex for button rows

### Deprecated / avoid editing directly

- **`packages/rules-engine/src/chargen/primaryAllocation.ts`** — barrel only, add nothing here
- **`apps/web/src/features/equipment/combatStateDerivation.ts`** — still exists but now imports from `@glantri/rules-engine`; do not re-add combat derivation logic inline
- **`packages/domain/src/encounter/roleplay.ts`** — stubs remain for backward compat; add new roleplay transitions to `rules-engine` instead
- Per-page `*WorkspaceTabs` components in `apps/web/app/(app)/admin/` — replaced by `AdminWorkspaceTabs`

### Important domain constraint change (PR #174)

`startScenario()` in `packages/domain/src/campaign/scenario.ts` now requires an explicit `startedAt: Date` parameter. Callers must supply the timestamp — the domain no longer calls `new Date()` itself. This was done to keep domain pure (no side effects).

### Test commands

```bash
pnpm --filter @glantri/rules-engine test          # 52 new golden combat tests + roleplay tests
pnpm --filter @glantri/api test                   # contract tests for characters + chargen routes
pnpm typecheck
pnpm lint
```

### Known conflict areas with `feature/player-general-encounter-screen`

The feature branch touches `apps/web/src/features/equipment/` (specifically `PhysicalStateSection`). It does **not** directly import from `combatStateDerivation.ts`, so no direct conflict there. However:

- If the feature branch adds new combat derivation logic inline in `combatStateDerivation.ts`, that logic should instead go into `packages/rules-engine/src/combat/deriveCombatValues.ts`.
- The feature branch should merge latest `main` before continuing — `startScenario()` signature changed (needs `startedAt` param).
- `roleplayTransitions.ts` is new; if the feature branch imports from `@glantri/domain` for roleplay state transitions it should be updated to import from `@glantri/rules-engine` instead.

---

## PRs #155, #156 — 2026-05-15 (earlier cleanup)

### Changed areas

| PR | What changed |
|----|-------------|
| #155 | Static game data moved from TypeScript to JSON under `packages/content/src/data/*.json` |
| #156 | Shared `AdminCatalogTable` and `AdminFilterSelect` added to `apps/web/app/(app)/admin/admin-ui.tsx`; gear/melee/missile/shield/valuables admin pages refactored to use them |

### New canonical entry points

- `packages/content/src/data/*.json` — canonical source for armor, gear, shield, valuable, weapon templates
- `packages/content/scripts/generateJson.ts` — regenerates JSON from source if needed
- `AdminCatalogTable`, `AdminFilterSelect` in `apps/web/app/(app)/admin/admin-ui.tsx`

### Deprecated / avoid editing directly

- `packages/content/src/equipment/*Templates.ts` — now thin wrappers that re-export from JSON; do not add new items here, edit the JSON files instead
