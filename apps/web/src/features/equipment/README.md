# Equipment feature

This feature presents Character inventory, storage, carried load, persistent
loadout, and equipment-derived combat summaries. Its current route is
`apps/web/app/(app)/characters/[id]/equipment/page.tsx`.

The accepted cross-area authority and sequencing are documented in:

- [Canonical Field Equipment v1 authority](../../../../../docs/decisions/architecture/0004-canonical-field-equipment-v1.md)
- [Canonical Field Equipment v1 roadmap](../../../../../docs/product/canonical-field-equipment-v1-roadmap.md)
- [Equipment and encumbrance calculations](../../../../../docs/rules/equipment-encumbrance-calculations.md)
- [Equip Items calculations](../../../../../docs/rules/combat-loadout-calculations.md)

## Current implementation

`EquipmentFeatureState`, defined in `types.ts`, is assembled in the route from
server-backed Character equipment records and the equipment template catalogue:

```text
EquipmentFeatureState
  templates.templatesById
  itemsById
  locationsById
  activeLoadoutByCharacterId
```

The database stores concrete Items, Character storage locations, and persistent
loadouts as normalized records under one Character equipment aggregate revision.
Campaign Items use that same concrete Item record with `campaignContextId` and an
optional holder. Assignment, unassignment, Character transfer, Scenario pickup,
and Combat operations move or update the same ID. Accepted transitions retain
bounded queryable actor/context and before/after evidence without turning Item
state into a generalized event-sourcing system.

`CharacterBuild.equipment` is compatibility/history-only and rejects current
writes. Scenario participant snapshots retain frozen supported facts,
provenance, and fingerprints; external changes become visibly stale and block
dependent play until an explicit GM update. Accepted in-play mutations update
current Character equipment and the Scenario/Combat state together. Authored
final-OB and initiative Item facts remain recorded but non-operative.

## Authority boundary

One concrete Item identity survives assignment, carry/equip, Scenario
availability, pickup, Character transfer, and Combat use. Character current
equipment is one revision-controlled aggregate. Scenario equipment is
an operational projection with frozen supported mechanical facts and
provenance/fingerprint, not a second Item or Character authority.

External canonical changes after capture mark the Scenario projection `STALE`,
block dependent authoritative play, and require explicit GM reconciliation.
Authoritative in-play pickup, handover, drop, draw, stow, ammunition consumption,
and approved mutations reconcile canonical and operational state and persist
across reload.

GM-private Item facts are projected from the viewer's actual management
relationship. Global `game_master` role alone is insufficient.

## API boundary

The route calls equipment operations through the web API clients.
The relevant client functions cover full equipment reads, Item add/move/remove,
storage-location create/remove, quantity and metadata updates, loadout selection,
Campaign Item creation/editing, assignment/unassignment, and transfer.

`page.tsx` remains a known feature-boundary exception because it owns substantial
state and handlers directly. A future internal refactor may move that work into
a feature state module, but it must not create another current equipment
authority or broaden the Field Equipment portfolio.

## Key modules

| File or area                     | Responsibility                                 |
| -------------------------------- | ---------------------------------------------- |
| `types.ts`                       | Feature state and inventory row types          |
| `equipmentActions.ts`            | Pure local state transitions                   |
| `equipmentSelectors.ts`          | Derived inventory and movement views           |
| `campaign-items/`                | Campaign Item authoring and assignment surface |
| `loadoutModule.tsx`              | Persistent loadout and equipment summaries     |
| `combatStateDerivation.ts`       | Character/loadout combat summary derivation    |
| `loadoutCombatStats.ts`          | Weapon-category combat table models            |
| `movementSummary.ts`             | Armor and encumbrance movement summaries       |
| `inventoryTemplateGroups.ts`     | Template grouping for Item creation            |
| `playerFacingTemplateOptions.ts` | Player-safe template labels and filters        |
| `workbookCompositeTable.ts`      | Workbook-derived composite adjustment lookup   |

The owning server paths are `packages/database/src/services/characterEquipment*`,
`packages/database/src/repositories/characterEquipmentRepository.ts`, and
`apps/api/src/routes/characterEquipment/`. Campaign, Scenario, and Combat
integration also crosses `campaignItemRoutes.ts`, `scenarioService.ts`,
`combatItemInteractionService.ts`, and the shared Encounter routes.

## Verification surfaces

Focused web checks:

```bash
pnpm --filter @glantri/web test -- equipment
pnpm --filter @glantri/web typecheck
```

Dependent implementation must also exercise database/service, API/projection,
Combat command/undo, Scenario staleness/reconciliation, reload, privacy, and
shared Item/Combat/Lost Seal fixture coverage as named in the roadmap. Linked
worktrees must use an explicitly owned disposable database before running any
database-capable check.
