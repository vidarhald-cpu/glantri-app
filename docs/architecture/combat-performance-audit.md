# Combat performance audit

Update (2026-07-26): `split_v1` physical persistence now stores the active combat
round separately from immutable archive rows. In isolated 0/10/30/50-archive
fixtures, legacy active reads grew from 1.62 to 195.92 ms while split active reads
stayed at 1.24/0.79/0.78/0.81 ms. Legacy whole-JSON rewrites grew from 1.89 to
973.30 ms while split active writes stayed at 5.13/2.90/2.84/2.89 ms. The exact
33.95 MB representative active read fell from 600.14 ms to 0.89 ms after
materialization. History and exact full reads remain linear, as expected.
See `combat-persistence-split.md`.

Date: 2026-07-25  
Branch: `feature/player-general-encounter-screen`

## Executive summary

Combat latency is dominated by persisted and transported data volume, not by dice
calculations or the progression projector.

The representative two-participant encounter was 33.95 MB before this audit. Of
its 33.93 MB `combatRoundState`, 25.46 MB was in 21 commands. Two
`commit_phase_initiative_resolution` commands were 8.45 MB and 16.95 MB because
each command stores the complete prior `CombatRoundState` in
`facts.previousState`. That prior state includes earlier commands and their own
`previousState`, so each phase-initiative commit recursively copies previous
history.

This produces three P0 effects:

1. Every combat mutation reads, validates, rewrites, and returns tens of
   megabytes.
2. `commit-phase-initiative-resolution` returns the large command separately as
   well as inside the encounter. In the measured flow, the response was
   101.90 MB: 67.94 MB encounter plus a 33.95 MB command.
3. GM workspace polling calls the scenario encounter-list endpoint, whose
   response contains all 50 full encounter sessions. The measured response was
   83.02 MB before the profiling copy was advanced, took 1.51 seconds at the API,
   ran twice during initial workspace loading, and is requested every five
   seconds while GM Combat is visible.

At the representative 33.95 MB size, declaration, modifier review, initiative
roll, round-end review, and round opening each took about 4.2 seconds at the
API. Initiative commit took 8.25 seconds and the following attack took 9.02
seconds. A compact eight-round encounter opened declarations in 146 ms. The
number of rounds is therefore not the main predictor: recursive state retained
inside commands is.

The largest browser cost is consumption of those large responses and whole
combat-tree reconciliation. A working 33.95 MB GM trace took 2.04 seconds from
navigation click to usable Combat UI after workspace data was already loaded;
321 ms was response receipt to usable Current Action, including a 295 ms main
thread task. Player Combat has better memoized tracker projection, but its
five-second refresh loads projection, content, participants, the full encounter,
and history, then a second effect fetches history again after the encounter
revision changes.

The first optimization slice should replace initiative command
`facts.previousState` with compact, explicit undo facts while preserving undo
semantics. It should also stop returning the same large command both standalone
and nested in the encounter. Polling and summary payload work should follow as
a separate slice.

Update (2026-07-26): that first slice is complete. New initiative commits use
strict versioned inverse facts and the initiative response no longer includes a
standalone command. The same representative commands fell from 8.45/16.95 MB to
1.46/1.35 KB. Replacing only the two active-round legacy commands reduced the
state from 33.93 MB to 8.54 MB; the remaining size is archived legacy data that
this non-migration slice intentionally preserves. See
`combat-undo-facts.md` for the exact schema and measurements.

Update (2026-07-26): the GM workspace polling slice is also complete. Campaign
workspace navigation now consumes `EncounterSessionSummary`, loads only the
selected full encounter, and polls a 163-byte active revision contract. The
same local 50-encounter scenario produced a 12,508-byte summary response in
13.21 ms instead of the prior 83,021,322-byte full-list response. Unchanged
polls no longer load encounter sessions, participants, content, or history.
See `encounter-summary-and-polling.md`.

Update (2026-07-26): the Player Combat refresh slice is complete. Slow scenario
context now loads once, while the exact player-safe encounter and history are
keyed to the accepted encounter revision. Interval and focus polling use the
same 163-byte revision contract. The duplicate revision history effect and
Offensive Parry-specific history reload were removed. See
`player-combat-refresh.md`.

Update (2026-07-26): a read-focused combat-state boundary now separates
metadata, active state, archived rounds, history source, and explicit full
encounter reads. Revision and GM-summary reads do not select `sessionJson`;
combat history no longer constructs or exposes an `EncounterSession` to its
projector. On the current 33.96 MB representative row, narrow and full
already-materialized validation were effectively equal at 1.48 ms and 1.46 ms
median, while physical history reads remained 632.86 ms because Prisma must
still materialize the unified JSON. This establishes the seam, but does not
claim a latency improvement or that the storage I/O problem is solved. See
`combat-read-models.md`.

## Scope and method

This was a read-only application-code audit. No application or test code was
changed. Measurements used:

- the local persisted PostgreSQL data copied to an isolated
  `glantri_perf_audit` database;
- the actual Fastify API and Next.js application pointed at that copy;
- a two-participant combat with three archived rounds, an active fourth round,
  attack/parry history, modifiers/effects, and Continued Contact history;
- canonical task descriptors produced from the persisted projection;
- actual API mutations only against the isolated copy;
- Chrome/Playwright timing and DOM mutation observation;
- focused in-process timing of domain projection, history, tracker, JSON, and
  Prisma operations.

Timing is wall-clock time on the local development machine. API
`starttransfer` is used as server time to first response byte. Local transfer
time is separately visible as `total - starttransfer`. Values are diagnostic,
not CI-stable benchmark thresholds.

The clone did not contain an unresolved parry or Offensive Parry Brawling task.
Those commands existed in archived history, but this audit did not fabricate an
actionable descriptor to mutate them again. Their operation-specific API totals
are therefore deliberately not invented. Their shared read/project/write/
serialize path is covered by the measured attacks and other mutations, and the
relevant source paths were audited.

## Representative interaction timings

### Actual API mutation samples

| Interaction                  |         Persisted state before request |         API first byte |        Total |  Response |
| ---------------------------- | -------------------------------------: | ---------------------: | -----------: | --------: |
| Declare action               |                     33.95 MB encounter |               4,163 ms |     4,178 ms |  34.28 MB |
| Complete modifier review     |                     33.95 MB encounter |               4,198 ms |     4,213 ms |  34.28 MB |
| Roll initiative              |                     33.95 MB encounter |               4,133 ms |     4,149 ms |  33.97 MB |
| Commit initiative            |                     33.95 MB encounter |               8,196 ms |     8,246 ms | 101.90 MB |
| Roll attack after commit     |                     67.94 MB encounter | measured through Fetch |     9,016 ms |  67.95 MB |
| Roll parry                   |     no unresolved canonical clone task |           not replayed | not replayed |         — |
| Offensive Parry Brawling     |     no unresolved canonical clone task |           not replayed | not replayed |         — |
| Commit ordinary distance     |             3.34 MB encounter, round 3 |                 448 ms |       449 ms |   3.35 MB |
| Round-end participant review |                     33.95 MB encounter |               4,297 ms |     4,318 ms |  34.25 MB |
| Open declarations            | compact 293 KB, eight completed rounds |                 146 ms |       146 ms |    298 KB |
| Open declarations            |          bloated 33.95 MB, four rounds |               4,148 ms |     4,164 ms |  33.96 MB |

Parry is handled by
`apps/api/src/routes/scenarios/encounterRoutes.ts` in the
`/combat-round/roll-parry` route, and Brawling by the Offensive Parry Brawling
route in that file. Both perform the same full encounter read, materialization,
authorization projection, whole-session update, and encounter response as the
measured attack path. No separate parry/Brawling timing is claimed without an
executable canonical task.

### Layer decomposition

The browser button handlers call the request functions directly; no debounce or
intentional delay exists. In the working browser trace the request was scheduled
within the next animation frame. The large delay began after request dispatch.

The following components were isolated on the post-attack 67.94 MB state:

| Layer                                                | Measured time | Method                           |
| ---------------------------------------------------- | ------------: | -------------------------------- |
| PostgreSQL/Prisma encounter read                     |      1,178 ms | `findUnique` of the JSON session |
| JSON parse, already-materialized 67.94 MB value      |        101 ms | Node median                      |
| Pure initiative-commit domain mutation at 33.95 MB   |    165–182 ms | three direct runs                |
| Progression projection at 33.95 MB                   |         43 ms | direct run                       |
| Combat log projection at 33.95 MB                    |         18 ms | direct run                       |
| GM combat-history projection with shared progression |         16 ms | direct run                       |
| PostgreSQL/Prisma same-value whole JSON rewrite      |      7,222 ms | isolated clone                   |
| JSON stringify, 67.95 MB response                    |         29 ms | Node median                      |
| JSON parse, 67.95 MB response                        |         93 ms | Node median                      |
| JSON stringify, 101.90 MB initiative response        |         44 ms | Node median                      |
| JSON parse, 101.90 MB initiative response            |        138 ms | Node median                      |
| Local transfer after first byte, initiative response |         50 ms | curl                             |
| Browser receipt to usable GM Current Action          |        321 ms | Chrome trace, 33.95 MB state     |

The database rewrite is the largest measured server component once recursive
state reaches 67.94 MB. Domain projection is material, but an order of magnitude
smaller. The request-specific domain mutation is not separately instrumented
for every command, so it is not inferred from residual API time.

### Browser click/render sample

A GM Campaign-to-Combat transition after workspace data was loaded measured:

- 2,038 ms from click to usable Combat Round Manager;
- 321 ms from response receipt to usable Current Action;
- one 295 ms main-thread long task;
- 27 observed DOM mutation batches;
- 793 final DOM nodes and about 152 KB serialized DOM.

After the isolated profiling flow grew the selected encounter to 67.94 MB, GM
Combat did not become usable within a 120-second profiling window while the
workspace repeatedly loaded the now 117 MB scenario encounter list. This is a
P0 runaway interaction between payload growth and workspace refresh, not a
normal render benchmark.

## Browser and render findings

### P0: GM Combat refreshes the whole campaign workspace

`apps/web/app/(app)/campaigns/[campaignId]/CampaignWorkspaceShell.tsx`:

- `refreshWorkspaceContext` (around line 102) loads access, then encounters and
  participants for every accessible scenario.
- Both initial effects (around lines 158–173) invoke the refresh. The browser
  trace contained two complete initial refresh sets.
- The combat polling effect (around lines 250–278) calls that same full refresh
  every five seconds.

`loadScenarioEncounters` in
`apps/web/src/lib/api/encounterClient.ts` calls
`GET /scenarios/:scenarioId/encounters`, which returns full
`EncounterSession[]`, not summaries. The main scenario contained 50 encounters
and returned 83,021,322 bytes in the baseline sample. Three runs were
1.62/1.51/1.51 seconds.

The polling interval can overlap user work at the data and main-thread level.
The local `refreshInFlight` guard prevents overlap only within one mounted
effect instance; it does not make the payload narrow and does not coordinate
with mutation requests.

### P1: Player Combat performs broad polling and duplicate history reads

Status: resolved by the Player Combat refresh slice documented in
`player-combat-refresh.md`.

`ScenarioPlayerCombatPageContent.tsx`:

- `refreshCombatView` (around lines 1150–1235) runs every five seconds and on
  focus. Each refresh requests scenario projection, canonical content,
  participants, the full encounter, and combat history.
- The effect around lines 1267–1297 runs when
  `encounterSession.updatedAt` changes and requests combat history again.
- The Offensive Parry Brawling mutation path around line 2958 explicitly loads
  combat history as well, after which the revision effect can load it again.

Accepted mutation state is adopted correctly through `acceptEncounterSession`,
but history refresh remains request-based rather than being included in or
coordinated with the authoritative mutation response.

Player-safe combat history was measured from the same 67.94 MB encounter:

- GM history: 1,468 ms, 260 KB response;
- GM-selected player perspective: 1,437 ms, 177 KB response.

The smaller sanitized response does not avoid reading and materializing the
large source encounter.

### P1: GM tracker construction runs in component render

`CombatRoundManagerPanel.tsx` constructs `trackerCellFacts` directly in render
around lines 9108–9318. For every archived/active round, participant, and combat
step it:

- builds per-round maps;
- calls outgoing and incoming attack selectors;
- searches proposals and participant labels;
- scans commands to determine initiative commit;
- resolves phase results and snapshots.

The final `buildCombatTrackerModel` call is also in render. Its
`currentTaskCellKey` selection in
`buildCombatTrackerModel.ts` around lines 389–397 performs a `cellFacts.find`
for each cell, an avoidable quadratic lookup.

The Player Combat tracker is better isolated:
`buildProjectedCombatTrackerModel` is wrapped in `useMemo` around lines
1425–1434. Pure player tracker measurements were small:

| Archived rounds | Cells | Median tracker view-model time |
| --------------: | ----: | -----------------------------: |
|               0 |    24 |                       0.032 ms |
|               3 |    96 |                       0.107 ms |
|              10 |   240 |                       0.142 ms |
|              30 |   720 |                       0.403 ms |

Therefore tracker JSX/view-model work is not the current P0. The GM inline
construction and React reconciliation are P1/P2 work after payload volume is
fixed.

### P2: very large stateful components increase reconciliation surface

- `CombatRoundManagerPanel.tsx`: about 10,475 lines.
- `ScenarioPlayerCombatPageContent.tsx`: about 4,516 lines.

Both own the inspector, current action, modifiers, results, history, equipment,
and mutation state. Many derived values are memoized, but a new authoritative
encounter object invalidates all encounter-dependent memoization. Splitting
these components is not recommended as the first optimization; the measured
payload and persistence costs must be removed first.

## Domain projection findings

### P0: recursive previous-state persistence

`commitCombatRoundPhaseInitiativeResolution` in
`packages/domain/src/encounter/combatRoundManager.ts` (around lines
7066–7160) writes:

```text
command.facts.previousState = normalized
```

`normalized` contains all prior commands. Prior initiative commits contain
their own full `previousState`. In the baseline active round:

| Object                    | JSON bytes |
| ------------------------- | ---------: |
| `combatRoundState`        | 33,934,023 |
| active `commands`         | 25,464,442 |
| archived `rounds`         |  8,418,024 |
| active snapshots          |     26,204 |
| active events             |     12,712 |
| phase-1 initiative commit |  8,448,079 |
| phase-2 initiative commit | 16,952,120 |

The undo path around lines 19047–19070 reparses that full previous state.
Correct undo is the reason the snapshot exists, but the representation is not
size-safe.

### P1: duplicate projections within declaration requests

In `encounterRoutes.ts`, declaration handling builds
`progressionProjection` to choose the command type and then calls
`authorizeCombatTaskCommand`. That helper independently calls
`buildCombatProgressionProjection` again (around lines 500–525). This is a
repeated identical pre-mutation projection.

Other routes generally need one pre-mutation projection for strict descriptor
authorization and a post-mutation envelope/projection. Those are different
states and should not be conflated. The optimization is to build one indexed
pre-mutation context and pass it to authorization, not cache across revisions.

### P2: history/event scans are linear but not the present bottleneck

`projectCombatHistory` in
`packages/domain/src/encounter/combatHistoryProjection.ts` maps each archived
round and reconstructs events/snapshots. Result presentation functions under
`apps/web/src/features/combat-history/view-models` repeatedly filter events for
the selected participant, opportunity, or contest.

Synthetic history-only measurements using realistic round content and a shared
progression projection:

| Archived rounds | History projection median | Projected payload |
| --------------: | ------------------------: | ----------------: |
|               0 |                   0.58 ms |             37 KB |
|               3 |                   2.49 ms |            210 KB |
|              10 |                   5.38 ms |            593 KB |
|              30 |                  13.45 ms |           1.70 MB |

This grows approximately linearly and is currently much smaller than reading
the recursive source state. An indexed event context is worthwhile later,
especially for result presentation, but it is not the first slice.

## API and persistence findings

### P0: full JSON document on every read/write/response

`packages/database/src/repositories/encounterRepository.ts`:

- `getEncounterById` loads the full `sessionJson`;
- `mapEncounter` validates the full value with `encounterSessionSchema`;
- `updateEncounter` validates and rewrites the full `sessionJson`;
- `listEncountersByScenario` loads and validates every full session.

Most combat mutation routes in `encounterRoutes.ts` perform one encounter read
and one encounter write. Declaration, initiative commit, and round-end review
also update one or more scenario participant records. The authoritative
response then contains the full saved encounter.

At 67.94 MB, one Prisma read was 1.18 seconds and a same-value rewrite was 7.22
seconds. This is the largest server-side bottleneck.

### P0: initiative response duplicates the large command

The initiative commit route around lines 7618–7780 returns:

- `command: committed.command`;
- `commandEnvelope`;
- `encounter: savedEncounter`;
- updated participants.

The 101.90 MB measured response was composed of:

- 67.94 MB encounter;
- 33.95 MB standalone command;
- a 640-byte command envelope.

The command is already present inside `encounter.combatRoundState.commands`.
Once the command is compact, response duplication becomes smaller, but the API
should still return only the authoritative state and compact next-task/result
envelope required by the client.

### P1: reads may perform normalization writes

`GET /encounters/:encounterId` around lines 3220–3300:

- calls `normalizeScenarioParticipantModifierRowsForEncounter`, which may
  update participant state;
- materializes the round state;
- rewrites the encounter if `combatRoundStatesDiffer`.

The stable baseline read did not trigger a measured write, but the read path can
produce up to one encounter normalization write plus participant normalization
writes. A GET should expose whether normalization occurred in diagnostics, and
normalization should move to explicit mutation/migration boundaries where
possible.

### P1: list payload is not shaped for workspace use

The scenario encounter-list route around lines 3105–3145 returns full sessions.
The workspace needs selection metadata for inactive encounters, not every
archived round, command, result, and snapshot. The API should have an encounter
summary projection containing identity, title, status, scenario, participant
summary, and revision. The active combat session should be fetched by exact ID.

## Payload and history growth

Actual warm read samples:

| Persisted combat                        | Encounter response | GET time |
| --------------------------------------- | -----------------: | -------: |
| fresh round 1                           |             6.7 KB |    29 ms |
| round 3, two archived rounds            |            1.48 MB |    81 ms |
| round 7, compact history                |            1.79 MB |   254 ms |
| round 4, recursive initiative snapshots |           33.95 MB |   947 ms |

A compact eight-round encounter opened declarations in 146 ms, while the
recursive four-round encounter took 4.16 seconds for the same transition.
History count alone is not the cause. Archived rounds should remain immutable
and inspectable; the fix is to stop recursively embedding them in undo facts,
not to delete history.

There was no persisted ten-round encounter. A ten-archived-round in-memory
history projection built from representative completed-round content took 5.38
ms and produced 593 KB. This measures history projection scaling only, not
database performance.

## Ranked bottlenecks

### P0

1. **Recursive initiative undo snapshot**
   - File/function:
     `packages/domain/src/encounter/combatRoundManager.ts`,
     `commitCombatRoundPhaseInitiativeResolution`.
   - Data path: initiative commit → `facts.previousState` → nested commands →
     whole encounter JSON.
   - Evidence: 25.46 MB of 33.93 MB active state was commands; two commands
     accounted for nearly all of it.

2. **Whole-session persistence and response**
   - Files/functions:
     `packages/database/src/repositories/encounterRepository.ts`;
     mutation routes in `encounterRoutes.ts`.
   - Evidence: 1.18-second read and 7.22-second same-value write at 67.94 MB;
     4.2–9.0-second real mutations.

3. **GM full-campaign polling with full sessions**
   - Files/functions: `CampaignWorkspaceShell.refreshWorkspaceContext`,
     `loadScenarioEncounters`, scenario encounter-list route.
   - Evidence: 83.02 MB/1.51-second baseline scenario list, two initial loads,
     then every five seconds.

4. **Initiative command duplicated in response**
   - File/function: initiative-commit route return object.
   - Evidence: 101.90 MB response, including standalone 33.95 MB command already
     nested in the encounter.

### P1

5. **Player broad polling and duplicate history refresh**
   - File/function: `ScenarioPlayerCombatPageContent.refreshCombatView` and
     revision history effect.

6. **GET normalization can write**
   - File/functions:
     `normalizeScenarioParticipantModifierRowsForEncounter`,
     `initializeMaterializedCombatRoundState`, encounter GET route.

7. **GM tracker facts rebuilt in render**
   - File/function: `CombatRoundManagerPanel` tracker block around lines
     9108–9318.

### P2

8. **Repeated identical pre-mutation progression projection**
   - File/function: declaration route plus `authorizeCombatTaskCommand`.

9. **Repeated linear event/participant lookups**
   - Files: combat history result view models and GM tracker construction.
   - These are measurable with longer histories but not the current dominant
     cost.

10. **Quadratic current tracker-cell lookup**
    - File/function: `buildCombatTrackerModel` current-task selection.

### P3

11. **Large component reconciliation surface**
    - Files: GM and Player combat page components.
    - Refactor only after data-volume and invalidation changes have benchmark
      coverage.

## Recommended optimization slices

### Slice 1 — compact initiative undo facts — complete

1. Define the exact fields needed to undo initiative commit: prior cursors,
   phase statuses, participant combat contexts/modifier IDs, and any created
   effect IDs.
2. Replace full `facts.previousState` with that compact, schema-validated delta.
3. Preserve reload and undo behavior with round/phase/task identity tests.
4. Stop returning the standalone full command when the accepted encounter and
   compact command envelope already identify the mutation.
5. Add a serialization guard asserting that a second initiative commit grows
   state linearly, not in proportion to the full previous state.

This slice directly attacks the measured 4.2–9.0-second mutation cost without
changing gameplay, projection, authorization, or history semantics.

Measured after implementation on a temporary isolated encounter row containing
the compacted representative state:

- whole encounter: 8,538,083 bytes;
- read: 143 ms;
- same-value write: 838 ms;
- route-core read/commit/write/envelope/serialization: 1,139 ms;
- initiative response shape: 8,508,128 bytes.

The comparable pre-change audit measurements were a 1,178 ms read, 7,222 ms
same-value write, and 8,246 ms initiative request. The original measured
101.90 MB response duplicated the command; the current representative
before/after response-shape comparison is 50,888,222 versus 8,538,707 bytes.
Old archived snapshots remain readable and are not automatically migrated.

### Slice 2 — summary workspace loading and narrow GM polling

1. Add an encounter-summary response for scenario/campaign lists.
2. Fetch the exact active encounter by ID.
3. Consolidate the two initial workspace refresh effects.
4. Poll an exact revision/summary endpoint, then fetch the active encounter only
   when the revision changes.
5. Keep mutation responses authoritative; polling remains for other clients.

### Slice 3 — Player Combat refresh consolidation

1. Separate slow-changing content/participant metadata from five-second combat
   refresh.
2. Adopt mutation response encounter/history projection atomically.
3. Remove the duplicate revision-triggered history fetch when the same refresh
   already returned matching history.
4. Use a lightweight revision poll for cross-client changes.

### Slice 4 — one indexed projection context per request

1. Build one pre-mutation projection and identity index.
2. Pass it to command-type selection, authorization, modifier validation, and
   lineage lookup.
3. Build a distinct post-mutation projection only for the authoritative
   response.
4. Key the context by encounter revision and never reuse it across mutations.

### Slice 5 — memoized/indexed presentation

1. Move GM tracker-fact construction to a pure memoized view model.
2. Build participant, command, result, event, and cell-key maps once.
3. Replace the quadratic tracker current-cell search with a map/flag captured
   during the first pass.
4. Defer or virtualize archived history/result panels only after profiler
   evidence shows a remaining render bottleneck.

### Slice 6 — active versus archived payload shape

Evaluate separating active combat state from immutable archived history so an
ordinary mutation need not rewrite all old rounds. This is a larger persistence
slice and should follow compact undo facts. It must preserve reload, undo,
round isolation, player-safe sanitation, and exact historical inspection.

## Guard benchmarks and tests

Add performance guards without timing-flaky assertions:

- serialization-growth test: two initiative commits must add bounded command
  bytes rather than copy the previous state;
- response-shape test: initiative response must not include duplicate full
  state in both `command` and `encounter`;
- request-count test: initial GM Combat load performs one workspace summary
  load and one active encounter load;
- polling test: unchanged revision transfers no full encounter;
- Player mutation test: accepted response does not immediately trigger a
  duplicate encounter/history request;
- projection count test: one pre-mutation projection per request plus at most
  one post-mutation projection;
- ten-round benchmark fixture with two participants, modifiers, effects,
  Continued Contact, attack/parry/Brawling history, and strict authorization;
- browser benchmark recording event-to-request, API, response-to-Current Action,
  render count, long tasks, transferred bytes, and DOM mutations.

Suggested local targets after the P0 slices:

- ordinary mutation response below 1 MB for this two-participant fixture;
- no full-session list response;
- no recursive growth between phase initiative commits;
- no main-thread task above 100 ms for a normal current-action update;
- stable linear history projection at 10 and 30 rounds.

These are proposed guard targets and should be calibrated in CI before becoming
hard thresholds.

## Audit conclusion

The immediate problem is architectural data amplification at one precise
domain command, compounded by whole-document persistence and broad polling.
Optimizing React components or adding generic caches first would mask rather
than remove the cost. Compact undo facts, a compact initiative response, and
narrow encounter polling provide the highest-confidence path to restoring
interactive combat while retaining canonical progression, strict descriptor
authorization, reload, undo, and player-safe views.

With compact initiative undo, response deduplication, summary workspace loading,
and narrow GM polling complete, the next measured optimization slice is Player
Combat refresh consolidation. It should atomically adopt mutation responses,
separate slow participant/content context from combat revision checks, and
remove duplicate history fetches before React restructuring or generic caching.

## Active-only mutation response follow-up

GM Combat, Player Combat, and GM Player Combat now request versioned active-only
mutation responses. A 33,755,559-byte synthetic history-bearing legacy response
produced a 1,954-byte active response (99.9942% smaller). Median local
serialization changed from 4.241 ms for the full response to 0.009 ms for the
active response; compact composition measured 0.312 ms. Mutation-family samples
for attack, parry, initiative, modifier review, distance, Brawling, and round-end
review were 1,912–1,982 bytes with the same active fixture.

This removes archived-round serialization and transfer from ordinary mutations.
It does not remove the pre-mutation full encounter read used by current command
handlers, the explicit `complete_round` compatibility response, history
projection cost, or GM tracker/render rebuilding. The
recommended next server optimization is an active-source mutation boundary with
one indexed authorization/projection context per request. See
`active-combat-mutation-response.md`.

## Split-storage first-write follow-up

The first live `split_v1` failure exposed a hidden write on exact encounter GET:
the route persisted participant modifier normalization and, when round state
normalization differed, called combat persistence. A mount/focus GET could
therefore overlap the first CE mutation after both read legacy revision N.
Serializable PostgreSQL correctly aborted one `Encounter.updateMany` transaction
as Prisma `P2034`.

Exact GET now performs those projections in memory only. This removes the
initialization/polling writer and avoids an unnecessary full split materialization
outside an explicit command. The persistence adapter additionally performs a
bounded full-transaction retry for legitimate `P2034` conflicts. This is a
correctness and tail-latency repair; it does not change the previously measured
active-response or history costs.

## Progressive-slowdown instrumentation follow-up

Development-only correlated instrumentation is documented in
`combat-performance-instrumentation.md`. It follows one GM command from click
through repository reads, authorization/projection, domain execution,
transaction, compact response shaping, client adoption, tracker construction,
React commit, and settled UI. It adds no requests or revisions and is disabled
unless both process-specific flags are set.

Disposable split-storage fixtures used two participants and bounded archived
rounds at active rounds 1, 3, 5, and 7. Values are local medians and are
diagnostic rather than CI thresholds.

| Stage                                      |  Round 1 |  Round 3 |  Round 5 |  Round 7 | Growth                                  |
| ------------------------------------------ | -------: | -------: | -------: | -------: | --------------------------------------- |
| Split active read                          |  1.12 ms |  0.80 ms |  0.94 ms |  0.86 ms | Flat                                    |
| Ordinary active mutation                   |  4.09 ms |  3.41 ms |  3.06 ms |  3.43 ms | Flat                                    |
| Full encounter read                        |  1.34 ms | 10.48 ms | 19.79 ms | 26.35 ms | Linear in archives                      |
| History-source read                        |  1.94 ms |  9.55 ms | 14.98 ms | 18.68 ms | Linear in archives                      |
| Full serialization probe                   |  0.01 ms |  0.60 ms |  1.17 ms |  1.59 ms | Linear in payload                       |
| Full composed bytes                        |   5.7 KB |   467 KB |   929 KB |  1.39 MB | Linear in archives                      |
| Active-view bytes                          |   5.3 KB |   5.3 KB |   5.3 KB |   5.3 KB | Flat                                    |
| Tracker cells                              |       24 |       72 |      120 |      168 | Linear in rounds × participants × steps |
| Tracker view model (happy-dom fixture)     |  1.65 ms |  2.77 ms |  5.89 ms |  6.38 ms | Linear                                  |
| Whole panel view model (happy-dom fixture) |  2.96 ms |  4.32 ms |  7.53 ms | 10.30 ms | Linear                                  |
| React commit (happy-dom fixture)           | 13.59 ms | 25.64 ms | 35.97 ms | 46.73 ms | Linear                                  |

The minimal browser fixture confirms repeated all-round tracker work, but its
magnitude does not explain a 6–8 second command by itself. It is not a
substitute for an authenticated browser sample against the reported long
encounter.

The largest representative local legacy encounter measured 33,947,986
serialized bytes:

- full read: 572.44 ms;
- history-source read: 560.56 ms;
- same-shape legacy rewrite: 3,524.61 ms;
- first split materialization: 3,580.70 ms;
- subsequent split active read: 0.97 ms.

This is the strongest measured multi-second contributor. The local database
still contains both `legacy` and `split_v1` encounters, so the correlation
record's repository stage and response size are necessary before deciding
whether a reported slow click is a legacy materialization, a compatibility
full read, client tracker growth, or a combination.

The measurement pass does not change the mutation boundary. Ordinary handlers
still begin from the compatibility full encounter in routes that call
`EncounterService.getEncounterById`, even when persistence and the response are
active-only. No optimization should be selected until one real slow click
produces correlated `api_total`, repository, response, request-count, tracker,
React, and `click_to_settled` records.

## Combat Presentation Model — Slice 1

The first presentation slice separates immutable archived presentation,
revision-bound active presentation, selection, and pending workflow state.
Archived tracker facts and cell presentations are constructed under archive
lineage identity. A new active revision composes a bounded current-round tracker
slice with the same archived cell objects. Selection and pending workflow changes
reuse both source layers and the base tracker.

The opt-in happy-dom fixture now records both initial construction and a transient
workflow-overlay render. Initial construction still performs the required archive
projection, so it remains proportional to archive depth. The transient render is
the new identity-boundary measurement:

| Active round | Cells | Initial panel | Initial commit | Transient panel | Transient tracker | Transient commit |
| -----------: | ----: | ------------: | -------------: | --------------: | ----------------: | ---------------: |
|            1 |    24 |       4.63 ms |       14.39 ms |         0.61 ms |           0.01 ms |          1.70 ms |
|            3 |    72 |       7.37 ms |       25.63 ms |         0.56 ms |           0.01 ms |          0.64 ms |
|            5 |   120 |      11.31 ms |       35.03 ms |         0.83 ms |           0.01 ms |          0.87 ms |
|            7 |   168 |      14.78 ms |       45.81 ms |         1.37 ms |           0.01 ms |          1.14 ms |

Before this slice every render followed the all-round construction path; the
earlier Round 7 fixture measured 10.30 ms panel construction, 6.38 ms tracker
construction, and 46.73 ms commit. The new transient Round 7 path measures
1.37 ms, 0.01 ms, and 1.14 ms respectively. Initial construction is slightly more
expensive because it establishes two explicit source layers; it happens only when
their identities require it and is not evidence of improved first-load latency.

This fixture verifies identity reuse, not the reported authenticated 11.6-second
production-path panel build. A comparable real encounter replay is still required
to measure click-to-settled, render count, and the absolute reduction after this
slice. Compatibility `EncounterSession` reads are intentionally unchanged.

## Combat Presentation Model — Slice 2A

Active inspector presentation is now owned by the accepted active revision.
The active layer owns the GM combat log and a bounded, dependency-checked store
of participant inspector candidates: inspector/result ledgers, declaration
defaults, combat modifiers, equipment/loadout summaries, phase summaries,
attack/parry resolution, calculations, initiative calculation, and distance
presentation. Selection chooses a candidate by identity. Pending controls,
workflow choice, local errors, and JSX remain panel concerns and are not cache
dependencies.

An authenticated replay used the same three-participant Round 5 encounter, four
archived rounds, and canonical `roll_adjust_distance` command as the accepted
Slice 1 baseline. The first post-change trace retained ten panel executions and
measured 603.4 ms of non-tracker work, a conservative 26.3% reduction. A
controlled trace taken immediately after revision polling measured:

| Stage                  |      Slice 1 |     Slice 2A |           Change |
| ---------------------- | -----------: | -----------: | ---------------: |
| Click to settled       |   1,472.0 ms |     962.1 ms |           -34.6% |
| Total panel work       |   1,147.2 ms |     680.0 ms |           -40.7% |
| Tracker work           |     328.6 ms |     301.7 ms |            -8.2% |
| Non-tracker panel work |     818.6 ms |     378.3 ms |           -53.8% |
| React commits          |  5 / 65.9 ms |  3 / 40.1 ms |  -40.0% / -39.2% |
| API total              |    347.75 ms |    334.50 ms |            -3.8% |
| Network                |     350.5 ms |     337.0 ms |            -3.9% |
| Mutation response      | 71,023 bytes | 71,035 bytes | effectively flat |

The controlled capture recorded one active-presentation rebuild, five reuses,
39 active-inspector submodel rebuilds, 35 submodel reuses, no archived
presentation rebuild, one request, and no follow-up request. The response and
server path are unchanged; the measured reduction comes from presentation
identity reuse. Compatibility `EncounterSession` reads, tracker construction,
historical inspector ownership, and response contracts remain untouched.

## Combat Presentation Model — Slice 2B

Completed-round inspector presentation is owned by Archived Presentation. For
each immutable archived round, participant, and tracker step, the archive
builder records one keyed candidate containing the inspector core, exact and
contextual snapshots, snapshot modifier rows, phase summaries, GM-visible
exact-step event ledger, attack/parry/result presentation, and snapshotted
calculation sections. Selection, inspector visibility, pending controls, local
errors, workflow state, and active revisions perform only keyed lookup and do
not participate in archive identity.

This is deliberately eager at archive-identity construction and stable
thereafter. It may shift a small amount of work to initial or archive-boundary
construction, but archived-cell navigation no longer invokes historical
builders. Boundary undo or archive replacement changes immutable lineage and
replaces the candidates; ordinary active revisions retain them. Tracker
ownership, compatibility reads, hydration requests, APIs, and Active
Presentation remain unchanged.

The authenticated three-participant, four-archive Round 4 A2 inspection capture
(`92ed208d-754a-49de-b7ac-20b82065bddd`) measured:

| Stage | Slice 2B baseline | Slice 2B |
| --- | ---: | ---: |
| Click to settled | 712.4 ms | 131.8 ms |
| Total panel work | 96.7 ms | 61.6 ms |
| Tracker work | 0.2 ms | 0.3 ms |
| Non-tracker panel work | 96.5 ms | 61.3 ms |
| React commits | 2 / 25.3 ms | 2 / 25.8 ms |
| Archive inspector lookup | not owned | 0.0 ms / 4 executions |
| Historical snapshot resolution | 1.9 ms | 0.1 ms |
| Historical modifiers | approximately 0 ms | 0.0 ms |
| Historical attack/parry/results | 6.6 ms | 0 render-time executions |
| Historical calculations | 0.4 ms | 0 render-time executions |

Archived Presentation rebuilt zero times and was reused four times during the
selection. The remaining two character/equipment hydration requests transferred
11,609 and 285,541 bytes; they are intentionally outside this presentation
ownership slice. The current-command comparison remains the accepted Slice 2A
`roll_adjust_distance` capture (962.1 ms click-to-settled, 680.0 ms panel,
301.7 ms tracker, one active rebuild/five reuses, no archive rebuild, and no
follow-up requests); Slice 2B does not change its active path.
