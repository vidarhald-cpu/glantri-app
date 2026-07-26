# Combat read models

Status: implemented as a transitional read boundary on 2026-07-26.

## Purpose

`EncounterSession` remains the authoritative write model. The current database
also continues to persist that model in one `Encounter.sessionJson` document.
Read-only callers, however, no longer need to declare that they consume the
entire session when they only need metadata, active combat state, archived
rounds, or combat-history source facts.

The boundary is:

```text
Encounter.sessionJson
  -> CombatStateReadRepository
  -> strict canonical read view
  -> domain projection or API sanitation
```

The repository does not construct UI view models and does not decide combat
rules. It owns only persistence adaptation and schema validation.

## Read-path audit

| Caller                             | Required source                                                                    | Current read contract                                    | Mutation |
| ---------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- | -------- |
| Encounter summary list             | identity, title, status, revision; player assignment metadata where required       | `EncounterMetadataView` or `EncounterAccessMetadataView` | No       |
| Active revision poll               | encounter/scenario identity, status, revision                                      | `EncounterMetadataView`                                  | No       |
| GM combat history                  | active history facts, archived rounds, participant identities                      | `CombatHistorySourceView`                                | No       |
| Player and GM-perspective history  | same canonical history source, followed by player-safe projection                  | `CombatHistorySourceView`                                | No       |
| Explicit archived-round inspection | immutable completed rounds and identity                                            | `ArchivedCombatRoundsView`                               | No       |
| Internal active-state consumers    | active state, participant shells, visibility, revision                             | `ActiveCombatStateView`                                  | No       |
| Exact GM encounter GET             | complete session required by current public response                               | `FullEncounterReadView`/existing full service            | No       |
| Exact player encounter GET         | complete session before existing player-safe sanitation                            | existing full service                                    | No       |
| Combat mutations and authorization | complete authoritative write state, command history, undo facts, participant state | existing full service                                    | Yes      |
| Reload and undo                    | complete authoritative write state                                                 | existing full service                                    | Yes      |

The exact encounter routes remain full because Current Action, tracker,
historical inspection, modifier presentation, and mutation descriptors are
currently delivered from the complete public encounter response. Narrowing that
public response is a separate compatibility project.

## Contracts

Every read view carries `encounterId`, canonical `revision`, `updatedAt`, and
`viewVersion`. The revision is the exact persisted encounter revision and must
match `updatedAt`; no view derives a revision from another read or mixes rows.

### `EncounterMetadataView`

Contains encounter, scenario/campaign, routing, title, status, and revision
metadata. It is strict and rejects `combatRoundState` or other session fields.
The revision endpoint is built from this view.

`EncounterAccessMetadataView` is a narrow extension used only where a player
summary must decide assignment. It contains metadata plus participant
membership facts. It is not a combat-state view and authorizes no combat work.

### `ActiveCombatStateView`

Contains the current mutable `CombatRoundState` without its `rounds`
collection, plus the participant, visibility, status, and revision facts needed
by canonical active projection. Its active-state schema is strict, so archived
rounds cannot be smuggled through the active contract.

### `ArchivedCombatRoundsView`

Contains the ordered `CompletedCombatRound` collection and read identity only.
Completed-round parsing retains existing compatibility defaults for legacy
archived records. It contains no mutable cursor or current active state.

### `CombatHistorySourceView`

Contains exactly the source categories consumed by combat-history projection:

- the active combat state, without its archive collection;
- ordered archived rounds;
- participant membership and visibility facts;
- current round, encounter/scenario identity, status, and revision.

It excludes roleplay action logs, workspace data, scenario content, encounter
navigation, and unrelated session fields. `projectCombatHistory` accepts this
view directly; it no longer accepts an `EncounterSession`.

The projector temporarily reconstructs one `CombatRoundState` from the active
and archived parts because existing progression and combat-log projectors still
consume that canonical state. That reconstruction is internal to history
projection and does not restore an `EncounterSession` dependency.

### `FullEncounterReadView`

Wraps an explicitly requested, fully validated `EncounterSession` and repeats
its canonical read identity. It exists so full consumers state that choice
rather than obtaining a full session accidentally from a generic read helper.

## Transitional `sessionJson` adapter

The Prisma adapter performs one row read for each operation.

- Metadata and GM summary reads select only top-level database columns and do
  not select `sessionJson`.
- Active, archived, history, and player-assignment views still select the
  unified `sessionJson`, because those facts do not yet have separate physical
  storage.
- The adapter first parses only membership, visibility, current-round, and an
  opaque `combatRoundState`. It then validates only the active/archive structure
  required by the requested view.
- Fields deliberately outside a narrow view do not make that view fail merely
  because they are malformed.
- Required active, archived, participant, visibility, identity, and revision
  facts remain schema-validated and fail closed.
- `getFullEncounterById` retains full `EncounterSession` validation.

This distinction is intentional corruption handling, not relaxed validation:
the caller's declared contract is validated completely, while unrelated data is
left for the contract that owns it.

## History and player safety

`CombatHistorySourceView` is an internal canonical source. It may contain facts
that a player is not permitted to see. Authorization is resolved before any
history response, and the existing viewer-aware `projectCombatHistory` remains
the only outward player and GM-selected-player history projection.

Narrow metadata and revision responses contain no combat facts. Player summary
assignment returns only `viewerAssigned`, never the participant membership
source used to derive it.

History response identity is copied from the source view, so
`sourceEncounterId` and `sourceUpdatedAt` continue to support the GM and Player
revision-keyed adoption rules.

## Route migration

Migrated:

- `GET /encounters/:encounterId/revision` uses
  `getEncounterMetadataById`;
- `GET /encounters/:encounterId/combat-history` uses
  `getCombatHistorySourceById`;
- encounter summaries use metadata-only reads for GM access and the narrow
  assignment view for player access.

Intentionally unchanged:

- exact GM and player-safe encounter GETs;
- full encounter-list editing routes;
- every mutation, authorization, reload, and undo path;
- mutation response contracts.

## Measurements

The current largest representative encounter is 33,962,157 serialized bytes.
Local diagnostic measurements on that same persisted row were:

| Read/projection                                               |                            Measurement |
| ------------------------------------------------------------- | -------------------------------------: |
| Prisma full JSON row materialization                          |                              634.01 ms |
| Metadata-only read                                            |                                3.60 ms |
| Active-state read and validation                              |                              640.07 ms |
| Archived-round read and validation                            |                              604.16 ms |
| History-source read and validation                            |                              632.86 ms |
| Full encounter read and validation                            |                              612.31 ms |
| Full-schema validation of an already materialized row, median |                                1.46 ms |
| History-source extraction/validation of the same row, median  |                                1.48 ms |
| 50 metadata summaries                                         | 12,493 bytes; 3.86 ms repository query |
| GM history projection                                         |                36.25 ms; 259,109 bytes |
| Player-safe history projection                                |                28.30 ms; 179,218 bytes |

The history read gains a narrower dependency and corruption boundary, but the
measured validation CPU is effectively unchanged and there is no material
database-I/O reduction: Prisma must still materialize almost the same 33.96 MB
JSON document. Response sizes and history semantics are unchanged. These
figures are local diagnostics, not CI timing thresholds.

## Future persistence seam

A later physical split can replace only the repository adapter:

- top-level encounter metadata remains the metadata source;
- an active-state column/table implements `getActiveCombatStateById`;
- immutable archived storage implements `getArchivedCombatRoundsById`;
- a history source query composes the required active and archived facts in one
  consistent revision;
- the authoritative write service coordinates those stores transactionally.

The domain read schemas, history projector signature, route authorization,
player-safe sanitation, and client history identity do not need to change.
Until that split, `EncounterSession` remains the only authoritative write model;
the read views are not a second canonical combat model.
