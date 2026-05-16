# Domain: Encounter & Roleplay

Kildefiler: `session.ts` (hoveddatamodell) og `roleplay.ts` (rollespillberegninger).

## Domenemodell

```
EncounterSession                      ← lagret i databasen (encounter-tabell)
  ├─ kind: "combat" | "roleplay"
  ├─ participants: EncounterParticipant[]
  │    ├─ characterId?               ← kobling til ScenarioParticipant
  │    ├─ declaration                (handlingstype, forsvarspostur, mål)
  │    └─ posisjon og orientering
  └─ roleplayState?: RoleplayState   ← kun for kind="roleplay"
       ├─ gmMessage
       ├─ pendingSkillRolls[]        ← tilordnede men ikke utførte terningkast
       ├─ actionLog[]                ← fullstendig hendelseslogg
       ├─ participantDescriptions{}
       └─ visibility{}               ← hvem ser hvem
```

`EncounterSession` er den primære lagringsenheten. Encounter ↔ Scenario er én-til-mange:
et scenario kan ha mange encounters (en per runde eller møte).

## Rollespill (roleplay.ts)

`roleplay.ts` er domenets beregningslag — rene funksjoner, ingen sideeffekter.

| Funksjon | Ansvar |
|----------|--------|
| `buildRoleplayCalculationPreview()` | Forhåndsvisning av ferdighetsberegningstekst |
| `rollOpenEndedRoleplayD20()` | Open-ended d20-kast |
| `assignRoleplaySkillRoll()` | Tilordner venting terningkast til session |
| `recordRoleplayGmSkillRoll()` | Registrerer GM-utfall i hendelseslogg |
| `compareRoleplayOpposedRolls()` | Sammenligner to sider i motstandskast |
| `rankRoleplayGmRollResults()` | Sorterer kast etter resultat |
| `normalizeRoleplayState()` | Zod-parser med standardverdier fra session |
| `withRoleplayState()` | Immutabelt oppdatering av `EncounterSession.roleplayState` |

Vanskelighetsgrader (`RoleplayDifficulty`) og terskler er hardkodet fra Rolemaster-regelbok.

## Eierskap i stacken

| Lag | Ansvar |
|-----|--------|
| `packages/domain/src/encounter/` | Skjemaer, typer, ren rollespilllogikk |
| `packages/database` | `encounterRepository`, `EncounterService` |
| `apps/api/src/routes/scenarios/encounterRoutes.ts` | CRUD for encounters |
| `apps/web/app/(app)/campaigns/.../encounters/` | GM-encounter-sider |

## Skillet mellom Scenario og Encounter

- **Scenario** er den langlivde kampenheten. Den har deltakere (`ScenarioParticipant`) med
  helse, HP og kampstatus som vedvarer mellom møter.
- **Encounter** er én økt eller ett møte i et scenario (en kampanje-runde, en rollespillsekvens).
  Den har en hendelseslogg og kan lukkes uten å endre scenariotilstanden.
- En encounter-session snapshoter deltakerdata fra scenariet ved oppstart.

## Testkommandoer

```bash
pnpm --filter @glantri/domain test -- encounter
pnpm --filter @glantri/database test -- encounter
pnpm --filter @glantri/api test -- encounter
```
