# Domain: Campaign & Scenario

Filen `scenario.ts` er eneste kildefil i denne mappen. Den definerer alle typer knyttet
til kampanjer, scenarioer, deltakere og visningsproieksjoner.

## Domenemodell

```
Campaign
  └─ Scenario (mange per kampanje)
       ├─ ScenarioLiveState      (kampstatus, rundenummer, fase)
       ├─ ScenarioParticipant[]  (karakter eller entitet i sceneriet)
       │    ├─ snapshot          (frysepunkt av bygget / entitetsdata)
       │    └─ state             (health, combat, conditions, resources, equipment)
       ├─ CampaignAsset[]        (kart, bilder, dokumenter)
       ├─ CampaignRosterEntry[]  (kampanjeruten: PC-er, NPC-er, maler)
       └─ ScenarioEventLog[]     (revisjonslogg for hendelser)
```

`ScenarioParticipant.state` er kjernen for kampsporing: HP, blødning, engasjement,
kampmodifikatorer, parring, initiativ.

## Projeksjoner (player-facing)

- `ScenarioPlayerProjection` — det en spiller ser: scenario-sammendrag, synlige
  deltakere, egenkontrollert deltaker med HP/tilstander. Bygges av
  `buildScenarioPlayerProjection()`.
- `ScenarioPlayerVisibleParticipant` — begrenset deltakerinformasjon som er trygt å
  vise spillere.
- `ScenarioPlayerControlledParticipant` — rik visning av spillerens egen deltaker
  (bygg, utstyrsstatus, HP).

## Viktige funksjoner (ikke bare typer)

| Funksjon | Ansvar |
|----------|--------|
| `createScenarioLiveState()` | Ny live-state med startverdier |
| `startScenario()` | Setter combatStatus = "in_progress" |
| `advanceScenarioRound()` | Øker rundenummer, tilbakestiller til fase 1 |
| `setScenarioPhase()` | Bytter mellom fase 1 og 2 |
| `createParticipantSnapshotFromCharacter()` | Fryser karakterbygg + utstyr inn i deltaker-snapshot |
| `createParticipantSnapshotFromEntity()` | Fryser entitetsdata inn i deltaker-snapshot |
| `buildScenarioPlayerProjection()` | Bygger spiller-projeksjonen fra deltakerliste |
| `buildScenarioPlayerVisibleParticipants()` | Filtrerer synlige deltakere for spiller |

## Eierskap i stacken

| Lag | Ansvar |
|-----|--------|
| `packages/domain/src/campaign/scenario.ts` | Alle skjemaer, typer og ren logikk |
| `packages/database` | `scenarioRepository`, `scenarioService`, `participantRepository` |
| `apps/api/src/routes/scenarios/` | HTTP-ruter: scenario, deltaker, encounter, kampanje, mal |
| `apps/web/app/(app)/campaigns/` | Ruter og tynne side-komponenter |

## API-kontrakter

`packages/domain/src/api/scenarios.ts` — `JoinableScenarioRecord`
`packages/domain/src/api/campaigns.ts` — `AccessibleCampaignRecord`

## Testkommandoer

```bash
pnpm --filter @glantri/domain test
pnpm --filter @glantri/api test
```
