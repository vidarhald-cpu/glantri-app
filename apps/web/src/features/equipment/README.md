# Equipment Feature

Inventory management and combat loadout for a single character.

Route: `apps/web/app/(app)/characters/[id]/equipment/page.tsx`

## Ansvar

- Vise og redigere utstyrsinventar (gjenstander, lagersteder, mengde, tilstand)
- Beregne bæreevne og enkombrans per gjenstand og totalt
- Velge aktive våpen og rustning for en kamputrustning (loadout)
- Vise kampstatistikk utledet fra loadout og karakterbygning

## State

`EquipmentFeatureState` (definert i `types.ts`) holdes i `page.tsx` med `useState`.

```
EquipmentFeatureState
  templates.templatesById   – utstyrsmaler fra @glantri/content/equipment
  itemsById                 – faktiske gjenstander (server-hentet)
  locationsById             – lagringslokasjoner (server-hentet)
  activeLoadoutByCharacterId – aktiv loadout per karakter (server-hentet)
```

Tilstandstransisjoner (flytt gjenstand, opprett lokasjon, sett aktivt våpen) er rene
funksjoner i `equipmentActions.ts` — de muterer ikke state direkte, men returnerer nytt
state.

## API-kall

Alle server-kall gjøres fra `page.tsx` via `localServiceClient` (barrel). Dette er en
kjent avvik fra feature-mønsteret og skal migreres til direkte klientimport fra
`@/lib/api/equipmentClient` (se issue #164 / T-07).

Relevante klientfunksjoner:
- `loadCharacterEquipmentState` — henter komplett EquipmentFeatureState fra server
- `addCharacterEquipmentItemOnServer` — legger til ny gjenstand
- `moveCharacterEquipmentItemOnServer` — setter lagerlokasjon og bæremodus
- `removeCharacterEquipmentItemOnServer` — sletter gjenstand
- `createCharacterStorageLocationOnServer` — oppretter brukerdefinert lagersted
- `removeCharacterStorageLocationOnServer` — sletter tom lagersted
- `updateCharacterEquipmentQuantityOnServer` — oppdaterer stabelstørrelse
- `updateCharacterEquipmentMetadataOnServer` — oppdaterer visningsnavn/tilstand/notater

## Nøkkelmoduler

| Fil | Ansvar |
|-----|--------|
| `types.ts` | `EquipmentFeatureState` og `InventoryRow` |
| `equipmentActions.ts` | Rene tilstandstransisjoner |
| `equipmentSelectors.ts` | Beregnede visninger fra state (inventarierader, flytt-alternativer osv.) |
| `equipmentStore.ts` | Initial state med eksempeldata fra @glantri/content |
| `armorSummary.ts` | Karakterstørrelse og rustningssummering |
| `combatStateDerivation.ts` | Utleder kampstatus-øyeblikksbilde fra loadout og karakterbygning |
| `combatStatePanel.ts` | Visningsmodell for kampstatistikktabell |
| `loadoutCombatStats.ts` | Tabellmodell for kampverdier per våpenkategori |
| `loadoutWeaponOptions.ts` | Filtreringslogikk for våpenvalg i loadout |
| `movementSummary.ts` | Bevegelsesmodifikatorer fra rustning og enkombrans |
| `displayFormatting.ts` | Enkombransformatering for visning |
| `inventoryTemplateGroups.ts` | Gruppering og filtrering av maler for "Legg til gjenstand"-skjema |
| `playerFacingTemplateOptions.ts` | Spillervennlige navn og filteralternativer for maler |
| `workbookCompositeTable.ts` | Oppslagstabell for komposittjusteringer fra regelarbeidsbok |

## Komponenter

- `CombatStatePanel` — tabellvisning av kampstatistikk, brukes fra `loadoutModule.tsx`
- `InventoryTable` — inventartabell (brukes foreløpig ikke — se `page.tsx` for inline tabellogikk)
- `WeaponLoadoutPanel`, `LoadoutSummaryCard`, `EncumbranceSummaryCard` — kortvisninger
- `CreateLocationDialog`, `MoveItemDialog`, `LocationSummary` — dialoger og stedssammendrag

## Kjent teknisk gjeld

- `page.tsx` er ikke en tynn route-wrapper: den inneholder all state og alle handlers direkte.
  Burde refaktoreres til `hooks/useEquipmentPageState.ts` og en `state/`-maskin.
- API-kall går via `localServiceClient` i stedet for direkte klientimport (T-07).

## Testkommandoer

```bash
pnpm --filter @glantri/web test -- equipment
pnpm --filter @glantri/web typecheck
```
