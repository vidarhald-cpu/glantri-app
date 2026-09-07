# Domain: Encounter, Roleplay & Combat context

Mappen inneholder delte domenekontrakter for Encounter-sessionen, rollespill,
Combat-kontekst, progresjon, kommandoer, resultater og spillertrygge lesemodeller.
Den godkjente produktlivssyklusen er dokumentert i
[`docs/decisions/architecture/0003-campaign-play-lifecycle.md`](../../../../docs/decisions/architecture/0003-campaign-play-lifecycle.md).

## Domenemodell

```
EncounterSession                      ← lagret i databasen (encounter-tabell)
  ├─ kind: "combat" | "roleplay"     ← autoritativt verktøysett, ikke livssyklus
  ├─ status                           ← draft/active/paused/completed/archived
  ├─ participants: EncounterParticipant[]
  │    ├─ characterId?               ← kobling til ScenarioParticipant
  │    ├─ declaration                (handlingstype, forsvarspostur, mål)
  │    └─ posisjon og orientering
  ├─ playerOutcome?                  ← offentlig sluttutfall
  ├─ gmPrivateClosingNote?           ← privat GM-notat; aldri spillerprojeksjon
  ├─ roleplayState?: RoleplayState   ← situasjon/rollespill kan brukes i begge kinds
  │    ├─ gmMessage
  │    ├─ pendingSkillRolls[]        ← tilordnede men ikke utførte terningkast
  │    ├─ actionLog[]                ← fullstendig hendelseslogg
  │    ├─ participantDescriptions{}
  │    └─ visibility{}               ← hvem ser hvem
  └─ combatRoundState?               ← Combat Manager-state; bare combat-kind har Combat-tilgang
```

`EncounterSession` er den primære Encounter-lagringsenheten. Encounter ↔ Scenario er
én-til-mange: et scenario kan ha mange avgrensede encounters. En Encounter er ikke
en Combat-runde, og Combat-progresjon endrer ikke Encounter-status automatisk.

## Rollespill

`roleplay.ts` eier beregning, sammenligning, rangering og normalisering.
`packages/rules-engine/src/encounters/roleplayTransitions.ts` eier nye
rollespilloverganger. Begge lagene er rene og har ingen I/O.

| Funksjon                            | Ansvar                                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| `buildRoleplayCalculationPreview()` | Forhåndsvisning av ferdighetsberegningstekst               |
| `rollOpenEndedRoleplayD20()`        | Open-ended d20-kast                                        |
| `assignRoleplaySkillRoll()`         | Tilordner venting terningkast til session                  |
| `recordRoleplayGmSkillRoll()`       | Registrerer GM-utfall i hendelseslogg                      |
| `compareRoleplayOpposedRolls()`     | Sammenligner to sider i motstandskast                      |
| `rankRoleplayGmRollResults()`       | Sorterer kast etter resultat                               |
| `normalizeRoleplayState()`          | Zod-parser med standardverdier fra session                 |
| `withRoleplayState()`               | Immutabelt oppdatering av `EncounterSession.roleplayState` |

Vanskelighetsgrader (`RoleplayDifficulty`) og terskler er hardkodet fra Rolemaster-regelbok.

## Eierskap i stacken

| Lag                                                | Ansvar                                               |
| -------------------------------------------------- | ---------------------------------------------------- |
| `packages/domain/src/encounter/`                   | Skjemaer, typer og rene Encounter-/Combat-kontrakter |
| `packages/database`                                | `encounterRepository`, `EncounterService`            |
| `apps/api/src/routes/scenarios/encounterRoutes.ts` | CRUD for encounters                                  |
| `apps/web/app/(app)/campaigns/.../encounters/`     | GM-encounter-sider                                   |

## Skillet mellom Scenario og Encounter

- **Scenario** er den langlivede historiesituasjonen. Den eier konkrete
  `ScenarioParticipant`-identiteter og snapshots med tilstand som vedvarer mellom
  encounters.
- **Encounter** er ett avgrenset øyeblikk eller møte i et scenario. Den eier eget
  medlemskap, situasjon, aktivitet, offentlig utfall og privat GM-sluttnotat.
- Combat-kind kan bruke rollespill-/situasjonsverktøy. Bare Combat-kind kan åpne
  Combat Manager eller Player Combat; en roleplay-kind endres aldri stille til Combat.
- Å forlate Combat returnerer til samme aktive Encounter og Scenario. Ferdig Combat
  lukker ikke Encounter automatisk.
- `completed` (vist som Closed) og `archived` er skrivebeskyttet og har ingen ordinær reaktivering.

## Testkommandoer

```bash
pnpm --filter @glantri/domain test -- encounter
pnpm --filter @glantri/database test -- encounter
pnpm --filter @glantri/api test -- encounter
```
