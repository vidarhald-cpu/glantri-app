# Glantri RC 9 architecture review: per-request data volume

2026-11-12 · Joakim Kosmo

## Summary

The API is slow on Azure because every request loads, parses, copies and hashes far more data than it returns. Resident memory is not the problem. A player's 2 KB `/session` poll runs about 28 SQL statements and decodes roughly 0.5–1.5 MB of JSON. On a shared 1-vCPU B1 that costs about 0.5 CPU-seconds, so GM + 4 players saturate the core at about half the offered load.

This is a systemic pattern rather than one bug. Hot read paths rebuild whole domain aggregates from large JSON columns, re-validate them with Zod, and then project a few fields. There are no purpose-built read models for polling, and static game content has leaked into persisted per-entity data. A fast workstation hides it (35–40 ms per poll); one shared vCPU does not.

The pattern is fixable step by step, without a rewrite. The highest-value single change is to stop embedding the 94-template equipment catalogue (about 323 KB) in every participant snapshot, fingerprint and player projection. After that: lean reads for the polls, then a change token (304/ETag) so unchanged polls skip the work entirely.

These are review findings for the product owner and the Development Orchestrator. Nothing here is authorized work.

## Evidence from Azure

On RC 9 (`9ed7f805`), Azure B1 serves one polling tab in about 1 s per call but saturates at GM + 4 players. All measurements were taken on 2026-11-12 with a self-contained perf-test campaign (2 Characters, 1 generated NPC, 1 active encounter, no history), with nobody else on Azure.

**Load test** (read-only polling as the perf-test player):

| Run | Calls/min served | `/session` p50 / p90 / max | API CPU per request | Plan CPU |
| --- | --- | --- | --- | --- |
| 1 tab, `/session` every 4 s | 15 | 0.97 / 2.02 / 2.7 s | ≈ 0.52 s | 30–60 % |
| 5 tabs + `/player-projection` every 5 s | 66 of ≈ 135 offered | 6.2 / 9.9 / 20 s | ≈ 0.5 s | 99–100 % |

Postgres stayed at 7–13 % CPU and Web used under 0.02 CPU-s/min, so neither is the bottleneck. At idle, `/health` takes 0.11 s and `/auth/me` 0.20 s, against 0.86 s for `/session`: the cost is the endpoint's own work.

**Payloads** (uncompressed, measured through the API):

| Response | Size |
| --- | --- |
| Player `/session` | 2.0 KB |
| GM `/session` | 3.6 KB |
| `/player-projection` (GM or player) | 326.5 KB, of which 322.8 KB is `equipmentState.templatesById` |
| One Character's equipment state, zero items | 324.5 KB, of which 322.9 KB is the template catalogue (94 templates) |

**Stored JSON** (read-only size query on the Azure database, counts and sizes only):

| Column | Rows | Avg JSON text | Max JSON text | Avg stored (TOAST-compressed) |
| --- | --- | --- | --- | --- |
| `ScenarioParticipant.snapshotJson` | 7 (6 contain the catalogue) | 271 KB | 393 KB | 47 KB |
| `EncounterActiveCombatState.stateJson` | 1 | 904 KB | 904 KB | 67 KB |
| `EncounterArchivedCombatRound.roundJson` | 1 | 888 KB | 888 KB | 90 KB |
| `Character.build` | 7 | 7 KB | 26 KB | 3 KB |
| `ScenarioParticipant.stateJson` | 7 | 4 KB | 15 KB | 2 KB |
| `ScenarioEventLog.payloadJson` | 27 | 0.4 KB | 1.2 KB | 0.4 KB |

The catalogue alone averages 300 KB of JSON text inside each snapshot that holds it. The one active fight in the database (3 participants) holds about 0.9 MB of active state plus 0.9 MB per archived round; every read decompresses and decodes the full text, not the compressed size.

**CPU profile** of the API during one-tab polling (300 s, V8 sampling at 1 ms, 2026-11-12 16:33–16:38 UTC, about 45 player `/session` requests): the JavaScript main thread was busy about 17 s, ≈ 0.37 s per request. Decoding stored JSON and the garbage it leaves take 61 % of it. Milliseconds per request are the profile share × 0.37 s; Prisma query-engine threads do not appear in a JavaScript profile.

| Cost | ms per request | Share |
| --- | --- | --- |
| Prisma result decoding | 115 | 31 % |
| Garbage collection | 110 | 30 % |
| Equipment fingerprint (hashing) | 63 | 17 % |
| Character list + content validation | 22 | 6 % |
| Zod parsing | 22 | 6 % |
| Everything else | 37 | 10 % |

## Finding 1: static content copied into per-entity data

Every Character participant carries the whole equipment template catalogue (94 templates, about 300 KB of JSON) in its stored snapshot, even with zero items. That one choice drives most of the poll cost on a small scenario.

How it gets there:

- `CharacterEquipmentReadModelService.getCharacterEquipmentState` returns `templatesById: equipmentTemplatesById`, the static content constant (`packages/database/src/services/characterEquipmentReadModelService.ts:119`). In memory that is only a reference, so it is cheap.
- The participant snapshot stores that whole read model as `snapshot.equipmentState` when a Character joins a scenario or is reconciled (`scenarioService.ts:522`, `:675`; `scenarioEquipmentReconciliation.ts:148`). Stored, the reference becomes a 300 KB copy per participant.
- Combat code reads templates from the snapshot (`combatInitiativeResolution.ts:56`, `combatParticipantCalculationResolution.ts:189`), so the copy is load-bearing today.

What it costs on every poll:

- **Decode.** Each read of participants decodes about 0.27–0.39 MB per Character participant. The player `/session` reads participants twice, so a 3-participant scenario decodes roughly 1.5 MB of JSON for a 2 KB answer. This matches the profile's largest shares: Prisma result decoding (about 31 %) and garbage collection (about 30 %).
- **Hash.** `resolveScenarioEquipmentStatus` reloads the current equipment state and runs `fingerprintScenarioEquipment` over it, catalogue included: a deep `canonicalize` with `localeCompare` key sorting, `JSON.stringify`, then SHA-256 (`scenarioEquipmentReconciliation.ts:26–40`, `:83`). Nothing is cached, although the catalogue never changes at runtime. This is about 17 % of the profile, roughly 63 ms per poll on B1.
- **Ship.** `/player-projection` returns `controlledParticipant.equipmentState` with the catalogue (via `revealableEquipmentState`, `itemFacts.ts:68`), so each tab receives 326 KB every 5 s, stringified and brotli-compressed afresh each time.

ADR 0004 allows Scenario records to hold projections and frozen facts, but says they must never create parallel canonical copies (`docs/decisions/architecture/0004-canonical-field-equipment-v1.md:38–44`). A full copy of static content in every participant goes against the spirit of that rule, and no document discusses its size.

## Finding 2: polls compose the full fight and never use it

`/session` and `/player-projection` load each active encounter in full, with every archived round, and parse it 4–5 times; the GM `/session` and the projection then use none of the combat state. In the one live fight on Azure that is about 0.9 MB of active state plus 0.9 MB per archived round, decoded on every poll.

- `listScenarioSessionEncounters` calls `getFullEncounterById` for each non-finished encounter (`combatStateReadRepository.ts:495`), inside a REPEATABLE READ transaction (`:107–113`). It reads the `Encounter` row, the active `stateJson` and all `EncounterArchivedCombatRound` rows.
- The composed state is then Zod-parsed about five times: `activeCombatRoundStateSchema`, `completedCombatRoundSchema` per round, `parseCombatRoundState`, the outer `encounterSessionSchema` (which embeds `combatRoundStateSchema`, `session.ts:404`) and `fullEncounterReadViewSchema` (`combatReadModels.ts:382–408`, `:617`). The #1145 WeakSet cache does not apply, because each pass receives a freshly built object.
- **What the polls use:** the GM `/session` returns `id`, `kind`, `status`, `title`, `updatedAt` and the outcome; `/player-projection` uses the roster and `roleplayState.visibility`. The player `/session` reads `combatRoundState` only for `item_resolution` rows (`scenarioSession.ts:467`).
- **Growth:** the cost rises with every round played. #1136 already fixed this for *finished* encounters by reading summaries inside PostgreSQL (`readFinishedEncounterSessionSummaries`); active encounters still take the full path.
- The event log is read whole on every `/session` with no limit (`scenarioRepository.ts:1836`) and parsed twice per row. It is small today (27 rows) but unbounded.

Why is a 3-participant round about 0.9 MB? The persistence review points at undo facts that copy whole state collections into commands (for example `previousStepSnapshots`, `combatProgressionProjection/advance.ts:233`), so active state grows faster than linearly within a round. #1135 trims undo-only facts from *newly* archived rounds; the existing archive predates it.

## Finding 3: redundant reads, a write on every GET, and a heavy access check

A player's 2 KB `/session` issues about 28 SQL statements plus two interactive transactions, because layers re-read what an earlier layer already loaded. The GM path issues about 30 statements plus one transaction per Character participant.

| What | Times per player poll | Where |
| --- | --- | --- |
| Scenario row, Zod-parsed each time | 3 | access gate, `scenarioParticipantSupport.ts:154`, route `scenarioRoutes.ts:129` |
| All participant rows, snapshots included | 2 | access gate (`:166`), route (`:130`) |
| Campaign roster | 2 | access gate (`:160`), available objects (`scenarioRepository.ts:1775`) |
| Every campaign Item, schema-parsed, even with zero references | 1 | `characterEquipmentRepository.ts:1984` |
| Player's whole Character list with builds and content validation | 1, plus 1 roster query per Character | `access.ts:63` → `listByOwner` (`characterRepository.ts:389`) |

- **The access check** loads every Character the player owns, with `build`, `effectiveSkillsJson` and `versionEnvelopeJson`, and runs `getTargetProgressionValidationErrors` on each (two deep `catalogueIntegrityKey` canonicalizations per skill row), only to collect Character ids (`campaignService.ts:128–132`). About 6 % of the profile.
- **A write on a read.** Each equipment status check opens a READ COMMITTED transaction that runs `characterEquipmentAggregate.upsert` with an empty update, then `SELECT … FOR SHARE` (`characterEquipmentRepository.ts:589–596`). A GET should not take write-path locks; whether the upsert rewrites the row each time needs a query log to confirm.
- **N+1 queries:** roster PCs without a controller are loaded one by one (`scenarioParticipantSupport.ts:185`), roster access is queried once per owned Character, and reusable entities once per reference (`scenarioRepository.ts:1153`).

## Finding 4: combat commands read the whole history twice

A GM combat command reads and parses the full encounter, all archived rounds included, once in the route and again in the service, before its write transaction starts. Its CPU and memory therefore grow with the number of rounds played. RC 9 (#1145) removed repeated parsing inside the round logic, but not this.

Traced on `POST /encounters/:id/combat-round/roll-hit-location` (`encounterRoutes.ts:19534–19770`); `roll-attack` follows the same pattern:

1. **Route:** `encounterService.getEncounterById` (`:19543`) → full read with about three Zod passes over the history; then *all* scenario participants with full snapshots (`:19571`).
2. **Service:** `updateCombatEncounter` calls `getEncounterById` a second time (`encounterService.ts:254`). The equipment guard reloads every active Character participant plus its equipment and hashes it, catalogue included (`scenarioEquipmentReconciliation.ts:165–198`). Event collection and `buildCombatLogProjection` scan the whole timeline, re-parsing each archived round (`combatRoundManager.ts:30686`).
3. **Transaction:** Serializable with up to 3 retries, a `FOR UPDATE` lock on the Scenario row, then whole-document writes of the reduced `sessionJson` and the active `stateJson` (`combatStatePersistenceRepository.ts:234–407`). The write itself is bounded by one round, which is sound.

**Character sheets are rebuilt repeatedly.** `resolveCanonicalParticipantCalculationContext` runs `characterBuildSchema.safeParse` and a full `buildCharacterSheetSummary` with no cache (`combatParticipantCalculationResolution.ts:142–153`). Step-snapshot derivation reaches it up to five times per phase and computes both phases although one is used (`combatStepSnapshotFigures.ts:284`; `combatStepSnapshotDerivation.ts:238–243`). That is up to about 10 sheet builds per participant per committed step, so a 6-participant, 2-step commit can build about 120 sheets.

The architecture documents already name the main gap: command handlers “still begin from the backward-compatible full encounter service”, and the next step is to “move command handlers to an active mutation source” (`docs/architecture/combat-persistence-split.md:191–207`). The second full read in the service, the full-timeline scans and the sheet rebuilds are not mentioned there.

## Finding 5: trusted data is re-validated on every read

Data the API wrote and validated itself is parsed again with Zod, often several times, every time it is read. Each pass allocates a fresh copy, which feeds the garbage-collection share.

- Full encounter reads: about four passes over the archived history (Finding 2). Legacy mappers parse the whole session twice, `safeParse` then `parse` (`encounterRepository.ts:34–48`, `combatStateReadRepository.ts:141–155`).
- Character reads: a full `characterBuildSchema.parse` per row plus the content-integrity validation (Finding 3), on single reads, lists and every sheet build.
- `catalogueIntegrityKey` for the *approved* content definitions is recomputed on every call, although that content is static (`domain/character/progression.ts:356–391`).
- The view is parsed again on the way out: `scenarioSessionParticipantSchema` per participant and `scenarioSessionViewSchema` over the whole view (`scenarioSession.ts:774`).

**Already lean** (keep it that way):

- Static content is loaded once and memoized per process (`targetCompetencies.ts:351–360`). API resident memory stays at 123–136 MB under load; process memory is not the problem.
- Equipment items, locations and loadouts are normalized tables; the aggregate row holds only a revision.
- The combat archive is append-only, one row per round, and finished encounters already have a summary read (#1136).
- There is one PrismaClient. Services are cheap to construct and hold no per-instance caches.
- Authentication costs about four small queries per request.
- Response compression is brotli quality 4, a reasonable setting; it is just redone on every large response.

## Recommendations

Start with the catalogue, then make the polls read only what they return, then add a change token; that order targets the GM + 4 players capacity goal first. Combat-command work follows. Effects below are rough estimates from the profile shares, to be confirmed by re-running the same load test after each step.

| # | Change | Addresses | Expected effect | Size | QA floor |
| --- | --- | --- | --- | --- | --- |
| 1 | Stop storing, hashing and shipping the template catalogue: keep template ids (or only held items' templates) in snapshots, resolve templates from the in-memory constant, fingerprint items, locations, loadouts and revision only, and return only needed templates to the browser | F1 | Removes about 0.3 MB decode and about 63 ms hashing per Character participant per poll; projection from 326 KB to a few KB. Likely the largest single gain | Medium | Yes: stored data semantics |
| 2 | Make equipment status a pure read: compare revisions first, cache the fingerprint by (Character, revision), drop the `upsert` + `FOR SHARE` transaction from GET paths | F1, F3 | Most equipment work disappears on unchanged polls; no write locks on reads | Small | No |
| 3 | Give polls a lean encounter read: extend the #1136 summary approach to active encounters (roster, visibility, status, title); fetch `item_resolution` rows with a targeted query | F2 | Poll cost stops growing with rounds; removes up to \~1.8 MB decode per active fight per poll | Medium | No |
| 4 | Read once per request: pass the scenario, participants and roster loaded by the access gate to the handler; skip available-object queries when there are no references; replace the access check's `listByOwner` with an id-only query | F3 | About 28 → \~12 statements per player poll; removes the Character list and its validation | Small | Yes: authorization path |
| 5 | Poll change token: a scenario revision with ETag / 304, so an unchanged poll does no domain work (already in the performance plan) | All poll findings | Unchanged polls drop to auth + one revision check | Medium | No |
| 6 | Combat commands: pass the loaded encounter to the service instead of re-reading it; memoize the sheet build per participant per request and compute only the needed phase; then move handlers to the active mutation source (already documented) | F4 | Roughly halves pre-transaction work now; makes command cost independent of history later | Small, then large | No |
| 7 | Validation policy: validate on write and at trust boundaries; parse stored data once per read (or cache by revision); precompute `catalogueIntegrityKey` for approved content | F5 | Lower GC pressure across all paths | Medium | Case by case |
| 8 | Bound growth: store undo facts as deltas rather than whole `stepSnapshots` copies; page the event log on `/session` | F2 | Keeps rounds well below the current \~0.9 MB | Medium | Yes: stored data semantics |

Changes 1 and 8 alter what is stored. Under the development-stage data policy, existing snapshots can be reconciled or rebuilt instead of migrated, but the change still requires full independent QA (AGENTS.md, mandatory QA floor). Change 4 touches access control, so the same floor applies.

None of this needs a rewrite. The persistence split, the normalized equipment tables and the append-only archive are sound foundations; the fix is to stop reading and copying whole aggregates where a projection or an id would do.

## Method, confidence and open questions

The review covers release commit `9ed7f805` (Alpha RC 9) as deployed on Azure, read-only. Three independent code reads traced the poll read paths, the persistence model with the combat write path, and process-level memory and caching. The key claims were then checked by hand at the cited lines: snapshot capture, the GET-path upsert, the access-path `listByOwner`, the double encounter read and the uncached sheet builds.

Measurements on Azure, all on 2026-11-12: two load-test runs, an idle latency probe, a 300 s in-process V8 CPU profile, payload sizes through the API, and one read-only size query on the database (sizes and counts only). The temporary app settings and database firewall rules were removed afterwards; the API runs unchanged.

**Confidence:** high for Findings 1–4, which are measured and confirmed in code. Medium for the expected effects, which are estimates from profile shares and still need measuring.

**Open questions:**

- Does the web client need the full template catalogue from the API, or does it already bundle `@glantri/content`? This decides how much of change 1 can be done server-side only.
- Does the empty-update `upsert` on GET actually rewrite the aggregate row each time? A Postgres statement log would settle it.
- Is about 0.9 MB per round expected for a 3-participant fight? A breakdown of one stored round by key would show how much is undo data.
- The Studio measures about 35–40 ms per poll on similar data. Profiling the same tiny scenario there would show whether the fixed costs above exist there too, only faster.
