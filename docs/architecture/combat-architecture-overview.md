# Combat architecture overview

Status: Canonical architecture  
Audience: Developers working on the combat engine  
Purpose: Defines the architectural principles, data flow, synchronization model,
persistence model, and invariants that combat work must preserve.

This document is the entry point for combat architecture. Detailed contracts linked
at the end remain authoritative for their specific areas. Known deviations from this
architecture are tracked in
[combat-canonical-conformance-audit.md](./combat-canonical-conformance-audit.md);
this overview must not be read as evidence that every legacy path is already
conformant.

## 1. Design goals

The combat engine is designed around five primary goals:

1. Canonical, deterministic state.
2. Safe multiplayer synchronization.
3. Historical replay and inspection.
4. Predictable reload and undo.
5. Long-combat scalability.

Combat correctness, privacy, and exact authorization take priority over minimizing
code or optimizing without measurement.

## 2. Architectural principles

### Canonical server authority

The server owns canonical combat state and progression.

- `CombatProgressionProjection` is the authoritative task graph.
- Domain commands are the only way to change canonical combat state.
- Clients may hold editable drafts, cached history, and presentation state, but
  never calculate canonical progression or authorization.
- Calculations shown by the UI must come from authoritative calculation facts, not
  an independent React implementation.
- A client never treats inspector selection, a cursor, or a “latest” record as
  command authority.

### Descriptor-driven execution

Every combat command executes from an immutable descriptor projected for one exact
revision and task.

Depending on the command, its required identity includes:

- encounter and revision;
- round, phase, and boundary;
- command type and task;
- process, stage, and execution group;
- initiative group and effect cutoff;
- participant, opponent, pair, proposal, or opportunity;
- declaration, source, result, weapon, attack mode, or other command-specific
  lineage.

Ownerless GM tasks do not fabricate participant ownership. A field is required when
the canonical task requires it, rather than every descriptor carrying meaningless
placeholder values.

Descriptors are not patched across revisions. Missing, stale, or mismatched identity
fails closed. Genuine stale commands are refreshed for presentation but are never
automatically replayed.

### Revision-based synchronization

Every accepted encounter mutation creates exactly one new canonical revision.

The current physical representation of that revision is the persisted
`Encounter.updatedAt` value. Clients treat it as an opaque server-issued identity:
they carry and compare the exact value and never generate a revision from a local
clock or infer one from unrelated timestamps.

The synchronization relationship is:

```text
canonical revision
  -> revision-bound active combat state
  -> revision- and perspective-bound history
```

Accepted state is monotonic. An older poll, encounter response, or history response
cannot replace a newer accepted mutation.

## 3. Layer ownership

Combat rules must remain in the layer that owns them.

| Layer                   | Responsibility                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/domain`       | Combat state schemas, command facts, progression projection, canonical identity, undo facts, events/results, and deterministic state transitions |
| `packages/rules-engine` | Workbook- or rule-backed calculations and formula composition                                                                                    |
| `packages/database`     | Validated read models, split persistence, transactions, optimistic concurrency, legacy materialization, and full composition                     |
| `apps/api`              | Authentication, access checks, request parsing, descriptor authorization, command orchestration, response projection, and player-safe boundaries |
| `apps/web`              | Draft input, authoritative response adoption, revision polling, history coordination, and presentation                                           |

Dependencies continue to point downward according to `AGENTS.md`. In particular,
rules and formulas are not reimplemented in API routes or React components, and
database repositories are consumed through database services.

## 4. Combat state model

Combat state is divided into explicit ownership domains.

### Encounter metadata and non-combat session state

This includes:

- encounter, scenario, and campaign identity;
- title, status, routing, and canonical revision;
- participant membership and encounter participant shells;
- roleplay and other non-combat session information.

### Active combat state

The active-state row contains the bounded, mutable current combat round:

- current `CombatRoundState` without archived `rounds`;
- current-round commands, events, results, and snapshots;
- current boundary, cursors, task progress, and navigation;
- initiative-group and effect-timing source facts.

Participant combat contexts, equipment/health state, and combat effects that already
belong to `ScenarioParticipant` remain authoritative participant rows. Active
mutation responses carry updated participant shells when a command changes them.
The encounter active-state row is therefore not permission to duplicate those facts.

### Archived rounds

Each completed round is an immutable, independently stored
`CompletedCombatRound`. An archive contains the exact snapshots, commands, events,
and results required for reload, history, and inspection.

Ordinary combat commands never update or rewrite archived rows. A round transition
appends exactly one bounded archive row. The only normal exception is explicit
cross-boundary undo, which may remove the exact tail archive and restore the prior
active state atomically. Generic archive update and delete operations are forbidden.

### History projection

Combat history is a deterministic presentation projection from:

```text
active history facts
  + ordered archived rounds
  + participant and visibility facts
  + viewer perspective
```

History is not a second canonical combat state. It is keyed by encounter, canonical
revision, and perspective, and preserves canonical event/result identity and round
isolation.

## 5. Read architecture

Every caller explicitly requests the smallest validated source view it needs:

- `EncounterMetadataView`;
- `EncounterAccessMetadataView` where assignment is required;
- `ActiveCombatStateView`;
- `ArchivedCombatRoundsView`;
- `CombatHistorySourceView`;
- `FullEncounterReadView`.

Callers must not depend on `EncounterSession` unless full encounter composition is
genuinely required. Arbitrary `Partial<EncounterSession>`, scattered `Pick` chains,
and casts from narrow views back to a full session are forbidden.

The repository returns canonical source views, not UI view models. Player-safe
projection and combat presentation remain above the persistence boundary.

## 6. Persistence architecture

Combat persistence uses `split_v1` storage:

```text
Encounter metadata and reduced session JSON
  + EncounterActiveCombatState
  + ordered EncounterArchivedCombatRound rows
```

`EncounterSession` remains the backward-compatible domain/write and exact-response
shape. For split encounters, the database composes it only when a full consumer
explicitly requests it; it is not persisted as a complete combat mirror after every
command.

Every combat save uses strict optimistic concurrency and a serializable transaction:

1. read storage mode, archive count, and canonical revision;
2. validate the expected revision;
3. update encounter metadata under the revision guard;
4. write active state with the same new revision;
5. insert or remove the exact bounded archive delta when required;
6. commit atomically.

Ordinary combat mutations do not read, validate, or rewrite archived payloads merely
to save the active round. Active read and write cost must remain independent of
archive count.

Existing legacy encounters remain readable from full `sessionJson`. Their first
accepted combat mutation materializes `split_v1` transactionally. Once split storage
is authoritative, runtime reads never silently fall back to legacy combat JSON.

Scenario-participant writes currently retain their documented transaction ordering
outside the encounter persistence transaction. Future work must not imply broader
atomicity without changing and testing that boundary explicitly.

## 7. Mutation pipeline

The canonical mutation pipeline is:

```text
authenticate and authorize encounter access
  -> parse the command contract
  -> authorize the exact projected descriptor
  -> run the canonical domain mutation
  -> persist under optimistic concurrency
  -> project the authoritative post-mutation response
  -> adopt it immediately in the initiating client
  -> load matching history once where required
```

Ordinary migrated commands return `ActiveCombatMutationResponse` version 1:

- encounter ID and canonical revision;
- active combat state;
- command envelope;
- concise next-task identity;
- optional updated participants;
- optional bounded mutation presentation.

The active response contains no archived rounds, combat history, full
`EncounterSession`, or duplicated full command. `nextTask` is a concise aid; the
complete active state remains the source for projecting all current and parallel
work.

There are two explicit compatibility boundaries:

- clients negotiate `active-v1`, while a legacy full-response branch remains during
  migration;
- `complete_round` temporarily returns the legacy full response because the GM
  tracker still needs the newly archived round from the encounter.

Moving GM historical tracker/inspection to revision-keyed history is required before
removing the round-boundary exception. New commands must not create additional
full-response exceptions.

### GM bulk step completion

`complete_remaining_step` is a descriptor-bound workflow command, not a client loop.
It consumes the exact current modifier-review or initiative task, advances the
contiguous eligible participants inside one domain mutation, persists one command,
and creates one revision. It stops before the first participant whose canonical
state requires a decision.

For modifier review, bulk completion accepts the already-projected declaration
contexts unchanged and persists those same participant contexts. For initiative,
it uses a bulk-specific eligibility predicate rather than treating every pending
initiative task as a blocker. GM-owned passive work and a sole ordinary phase action
whose ordering cannot affect another phase action may receive a bounded
`bulk_skipped` resolution with effective initiative zero and no die. Ordered
maneuvers, multiple competing executable phase actions, invalid declarations, and
player-owned initiative remain blockers. The returned active state and command
envelope identify the first blocker or the initiative-commit task after the
completed iteration. One compact inverse restores all touched participant statuses,
initiatives, and navigation.

## 8. Synchronization and refresh

Same-client mutations adopt their authoritative response immediately. Polling exists
only for changes made by another client.

The normal external-change flow is:

```text
poll selected encounter revision
  -> unchanged: do nothing
  -> changed: load one exact authoritative replacement
  -> load matching history once
```

The current exact encounter endpoints still return a full GM or player-safe
encounter. A future active-only read may narrow that transfer, but summary or revision
data must never be used to synthesize progression locally.

Encounter lists use compact summaries. Slow-changing scenario content, campaign
metadata, and participant context are not part of five-second combat polling.

Focus and visibility refresh use the same narrow revision path. In-flight work is
keyed by encounter and revision; stale responses are ignored rather than merged.

## 9. Player safety

Canonical source data may contain information that a player cannot see. It must not
cross the player boundary directly.

Server-side viewer-aware projection removes or redacts, as applicable:

- hidden attacks and opportunities;
- uninvolved or private results;
- private dice and calculations;
- GM-only notes and diagnostics;
- hidden modifiers, identities, and equipment facts.

Player-safe exact encounters, active mutation responses, and history remain distinct
from GM responses. GM-selected Player Combat uses an explicit participant
perspective; it does not weaken ordinary player authorization.

Sanitization occurs before outward serialization. React filtering is never a privacy
boundary.

## 10. Undo and reload

Undo is command- and identity-based. New or reworked commands store strict,
versioned, compact inverse facts for exactly the fields they mutate.

Forbidden undo designs include:

- a complete prior `CombatRoundState`;
- recursive command, event, snapshot, or archive payloads;
- arbitrary JSON or `Partial<CombatRoundState>`;
- inference from the latest command or current cursor.

Compact initiative-commit undo is the implemented reference pattern. Legacy
initiative commands with `facts.previousState` remain readable and undoable, but new
commands never write that shape.

In-round undo changes active state only. Cross-boundary undo removes the exact tail
archive and restores active state in one canonical transaction. Reload followed by
undo must be behaviorally identical to undo without reload.

## 11. Initiative-group and effect timing

A1 and A2 execute in descending committed initiative groups. Only the highest
unresolved initiative value projects executable source and child work. A group
remains current until all source opportunities, defensive work, contests,
hit-location/critical/damage work, reviews, and consequence commits are complete or
canonically cancelled.

Exact initiative ties are simultaneous:

- all tied opportunities use the same pre-group effective state;
- resolving one sibling does not arbitrarily serialize the others;
- a tied opportunity remains protected unless an existing explicit interruption
  rule says otherwise.

An effect created during group X is authoritative immediately but remains
`pending` while X is open. It is visible but excluded from same-group arithmetic.
When X completes, the same effect becomes `active` automatically and applies to
later groups. Expiry follows its canonical duration.

Activation is keyed to the stable initiative-group boundary, not merely a numeric
initiative threshold. The effect cutoff carried by the calculation/descriptor
includes effects active before the group and excludes effects created within it.
No activation button or extra GM review exists.

## 12. Combat states and controllers

Persistent tactical and physical conditions use canonical combat states with
`pending`, `active`, and `expired` timing. Temporary tactical authority is represented
as a controller relationship with an explicit purpose and affected participant,
rather than maneuver-specific ownership hidden in UI logic.

Continued Contact is the first controller relationship:

- it grants the controller ownership of engagement-distance choice for the affected
  pair;
- ordinary opposed distance control is suppressed while the relationship survives;
- next-round declarations and attacks remain ordinary combat work;
- it creates no special attack phase and performs no weapon-based automatic
  shortening;
- after one complete intervening round, maintenance occurs during SU;
- both participants roll the canonical Brawling contest, with only Unbalanced
  excluded from the defender's escape-purpose roll;
- escape ends Continued Contact and its synchronized Unbalanced condition; successful
  maintenance carries both forward.

Future states and controllers must reuse these state, timing, ownership, provenance,
and synchronization concepts rather than creating a parallel maneuver engine.

## 13. UI adoption and presentation

The UI is not authoritative. It is an authoritative-response consumer.

After an accepted mutation it must:

```text
replace canonical revision and active combat state
  -> invalidate prior descriptors
  -> select/reproject canonical current work
  -> apply participant updates
  -> retain the last confirmed history presentation
  -> load/adopt matching revision-keyed history once
```

Current Action, tracker, inspector, modifiers, and result panels must describe the
same projected revision. Historical inspection never retargets live execution.
Tracker cells show live or completed markers only when that exact
round/facet/participant has canonical task or result identity; no prior-round or
“latest” fallback is permitted.

GM Step Automation is server-owned orchestration over those same canonical tasks,
not a separate auto-roll path. One explicit GM request is bound to the accepted
revision and current combat step, processes only the contiguous eligible
GM-controlled NPC prefix, permits deterministic closure only to expose the next
step, and then stops. Its transient Workflow Status is presentation-only; accepted
underlying commands remain the sole history, result, privacy, and undo authority.

Declaration carry-forward is a DE-only consumer of this framework. Its immutable
proposal comes from the participant's accepted declaration in the immediately
preceding archived round, then is validated against the current authoritative
participant, target, loadout, relationship, movement, and declaration capabilities.
Acceptance invokes the ordinary declaration command path. Missing canonical fields
or any changed circumstance stops the contiguous run; no archive-wide search,
retargeting, source substitution, or tactical inference is allowed.

GM Combat presentation is partitioned by ownership identity:

1. **Archived Presentation** owns normalized completed-round facts, historical
   tracker cells, declarations, calculations, modifiers, and result-ledger
   references. It also owns a keyed immutable inspector candidate for every
   completed-round participant and step, including the contextual snapshot,
   phase summaries, equipment/loadout snapshots, modifiers, exact-step events,
   attack/parry/result facts, and calculation sections. Its identity is
   immutable archive lineage plus its participant roster, so an active
   revision, selection change, inspector toggle, or pending control cannot
   rebuild it.
2. **Active Presentation** owns the current round, GM progression projection,
   current task/action, current tracker cells, combat log, and revision-owned
   active inspector candidates. The inspector owner retains stable participant
   contexts, modifier rows, equipment/loadout summaries, phase summaries,
   attack/parry resolution, calculations, current results, and distance
   presentation. Its identity is encounter plus accepted canonical revision.
   Slow-changing character/content dependencies are explicit submodel
   dependencies; they can replace only the affected candidate without making
   selection or pending state an active-presentation identity.
3. **Selection Overlay** owns only the selected round, participant, and tracker
   facet. It selects cached live or historical presentation; it does not project
   either source again.
4. **Pending Overlay** owns local saving, error, and workflow-control state. It
   never participates in archive or active identity.

`CombatRoundManagerPanel` composes these layers through one
`CombatPresentationModel`. A cached archived tracker cell remains the same object
when active state changes; only the bounded active tracker model is regenerated
and composed with it. Selection performs keyed lookup against stable active
inspector candidates rather than reconstructing their canonical facts. Current
Action is sourced only from Active Presentation.
This identity boundary is a correctness rule first and a performance boundary
second; component-level memoization must not create competing view models.

Normal waiting is presentation state, not an unavailable-task error. Action controls
must disappear or disable when their descriptor is stale, while stable non-actionable
presentation may remain until an external replacement arrives.

## 14. Canonical invariants

Combat work must preserve all of the following:

- one canonical encounter revision;
- one canonical domain state, with explicit persistence ownership;
- `CombatProgressionProjection` as the task graph;
- descriptor-first, fail-closed command execution;
- strict optimistic concurrency and monotonic client adoption;
- no cursor, inspector, display label, or latest-state authorization fallback;
- immutable archived rounds, except exact transactional boundary undo;
- active reads and ordinary writes independent of archive size;
- explicit, schema-validated read models;
- revision- and perspective-keyed history;
- active mutation responses without archived history;
- server-side player-safe projection;
- exact round isolation for tasks, results, tracker, and history;
- effect-cutoff consistency across descriptor, calculation, and validation;
- compact, non-recursive undo facts for new commands;
- persistence accessed through database services;
- no canonical progression or formula duplication in the UI.

## 15. Performance architecture

Combat scalability currently depends on a sequence of complementary boundaries:

```text
compact undo facts
  -> compact encounter summaries and revision polling
  -> revision-keyed history coordination
  -> split active/archive persistence
  -> active-only mutation responses
```

This architecture deliberately avoids:

- recursive prior-state snapshots;
- whole-workspace or whole-session polling;
- active mutations whose cost grows with archived rounds;
- history-sized ordinary mutation responses;
- rebuilding a full encounter when a declared narrow read view is sufficient.

Optimization remains measurement-led. Do not add caching until canonical identity,
scope, and invalidation are explicit. History reads and exact full composition are
still proportional to actual history size; that is distinct from active mutation
cost.

## 16. Extending combat safely

Every new maneuver, condition, contest, or child process should answer this checklist
before implementation:

1. What verified rule text or workbook formula is authoritative?
2. What stable canonical identities and provenance must be persisted?
3. Which domain state and progression task own the work?
4. Which exact descriptor fields authorize the command?
5. Which calculations belong in the rules engine, and which authoritative facts are
   presented?
6. Does the work create active/pending effects, controller relationships, child
   processes, cancellations, or archive facts?
7. What compact inverse facts make reload and undo exact?
8. What does the active mutation response need, and which participant rows change?
9. What may GM, owning player, affected player, and uninvolved players see?
10. How do Current Action, tracker, results, log, waiting states, and historical
    inspection remain aligned?
11. Which stale revision/task/group/source combinations must reject?
12. Does performance remain bounded as rounds, commands, participants, and history
    grow?

Minimum regression coverage should include the successful path, precise invalid
inputs, authorization, genuine stale requests, reload, undo, player-safe projection,
round isolation, and existing related maneuvers. Initiative-sensitive work also
requires non-tied and exact-tie coverage.

## 17. Future work

Expected gameplay work includes:

- further Observe Opponent tactical insights beyond the implemented V1 modifier;
- Drop, Pick Up, and Exchange Item;
- Disarm;
- Break Off Engagement;
- Throws, Locks, and additional maneuvers.

Likely optimization work, only when profiling justifies it, includes:

- active-only command-handler reads and mutation sources;
- moving GM round-boundary history/tracker fully onto revision-keyed history;
- tracker/view-model indexing;
- history virtualization or deferred rendering for very long combats.

No future work should weaken the invariants in this document.

## 18. Detailed contracts

- [combat-canonical-conformance-audit.md](./combat-canonical-conformance-audit.md)
- [combat-presentation-guidelines.md](./combat-presentation-guidelines.md) —
  normative guidance for presenting canonical combat facts
- [combat-ux-principles.md](./combat-ux-principles.md) — normative layout,
  interaction, and shared-tabletop presentation principles
- [combat-presentation-conformance-audit.md](./combat-presentation-conformance-audit.md) —
  audited implementation baseline and approved normalization sequence
- [combat-presentation-contract.md](./combat-presentation-contract.md)
- [combat-task-integration-matrix.md](./combat-task-integration-matrix.md)
- [combat-read-models.md](./combat-read-models.md)
- [combat-persistence-split.md](./combat-persistence-split.md)
- [active-combat-mutation-response.md](./active-combat-mutation-response.md)
- [combat-undo-facts.md](./combat-undo-facts.md)
- [encounter-summary-and-polling.md](./encounter-summary-and-polling.md)
- [player-combat-refresh.md](./player-combat-refresh.md)
- [combat-initiative-group-timing.md](./combat-initiative-group-timing.md)
- [combat-states-and-controllers.md](./combat-states-and-controllers.md)
- [combat-performance-audit.md](./combat-performance-audit.md)
- [Observe Opponent rules](../rules/observe-opponent.md)
