# Combat persistence split

Date: 2026-07-26  
Storage version: `split_v1`

## Purpose

Combat reads already use `CombatStateReadRepository` view contracts. This slice places
the mutable active round and immutable completed rounds in separate PostgreSQL rows
without changing `EncounterSession` as the authoritative domain/write contract or the
public exact-encounter response.

The split is a persistence concern only. Combat rules, task projection, descriptor
authorization, player-safe sanitation, history ordering, reload, and undo are
unchanged.

## Write-path classification

| Write class          | Examples                                                                                                                                                      | Physical mutation                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Active combat only   | declaration, modifier review, initiative, CE, attacks, parry, hit location, critical, damage/effect review, Brawling, Continued Contact, distance, health, SU | revision-guarded `Encounter` metadata/reduced session update plus active-state upsert |
| Round boundary       | finalize SU and open the next round                                                                                                                           | the active write plus one immutable archive insert                                    |
| Non-combat encounter | title/status/participants/roleplay                                                                                                                            | reduced session/metadata update; existing active/archive payloads are preserved       |
| Creation             | new encounter                                                                                                                                                 | legacy-compatible `sessionJson`; first combat write materializes `split_v1`           |
| Deletion             | encounter deletion                                                                                                                                            | database cascades active/archive rows                                                 |

Participant combat contexts and effects remain in the existing
`ScenarioParticipant` rows. Their domain/API update ordering is unchanged by this
persistence-only slice.

## Physical model

`Encounter` remains the identity and canonical revision row. It stores:

- routing/status/title and timestamps;
- `combatStorageMode`: `legacy` or `split_v1`;
- `combatArchiveCount`, used to validate a bounded archive delta without reading
  archive JSON;
- `sessionJson`, which is full for legacy encounters and contains only non-combat
  session state for split encounters.

`EncounterActiveCombatState` is one-to-one with `Encounter` and stores:

- `stateJson`: strict `ActiveCombatRoundState`, which cannot contain `rounds`;
- the canonical encounter revision copied from `Encounter.updatedAt`;
- schema version and timestamps.

`EncounterArchivedCombatRound` stores one strict `CompletedCombatRound` per
encounter/round. `(encounterId, roundNumber)` is unique and indexed. The normal
repository exposes insert only; an archive row is deleted only by encounter cascade.
No ordinary update path exists.

## Canonical revision and transactions

`Encounter.updatedAt` remains the sole public/canonical revision.

Every combat save runs in one serializable transaction:

1. read storage mode, archive count, and current revision;
2. reject a revision other than `expectedRevision`;
3. update `Encounter` with a `WHERE id + updatedAt` optimistic-concurrency guard;
4. read the newly committed revision inside the transaction;
5. upsert active state with that same revision;
6. insert at most the exact boundary archive;
7. commit.

A zero-row metadata update throws typed `stale_revision`. A malformed storage mode,
missing active row, revision mismatch, count mismatch, duplicate/non-contiguous
archive, or non-boundary archive delta fails closed. Transaction rollback prevents
an archive without its replacement active state, or vice versa.

Read composition checks the active revision and archive count against metadata before
returning a view. Mixed-revision facts are rejected, never silently combined.

## Legacy materialization

Migration adds new tables and defaults every existing encounter to `legacy`; it does
not rewrite encounter data.

Legacy reads continue through the previous `sessionJson` adapter. The first accepted
combat write:

1. validates the full legacy `EncounterSession`;
2. extracts and validates active state and every archived round;
3. stores reduced non-combat session JSON;
4. inserts the active row and all existing archives;
5. marks `split_v1`;
6. applies the requested combat mutation in the same transaction/revision.

The operation is idempotent by explicit storage mode. A split encounter never falls
back to legacy JSON. Partial split storage fails closed rather than alternating
authority.

## Session JSON ownership

For `legacy`, `sessionJson` remains the full authoritative encounter.

For `split_v1`, `sessionJson` owns only non-combat session facts:

- encounter participant shells/membership;
- roleplay state and visibility;
- encounter action log and general session metadata;
- current round/turn/declaration flags and other non-combat fields.

It does not contain `combatRoundState`. Ordinary combat writes therefore never
rewrite archived history.

## Full encounter and history composition

The exact full encounter contract remains unchanged. The designated repository
composes:

1. metadata/reduced session;
2. active state;
3. archive rows ordered by `roundNumber`;
4. complete `EncounterSession` schema validation.

Player-safe sanitation still runs after canonical composition. No table/storage
identity is exposed.

`CombatHistorySourceView` is composed directly from metadata, reduced participant
facts, active state, and ordered archives. It does not construct a full encounter
first. Its cost remains proportional to actual history size, which is intentional.

## Archive and undo rules

Ordinary commands may not update or rewrite archive rows. A normal round transition
adds exactly one next-numbered row. Duplicate retries fail the revision guard and the
unique archive key.

Undo never goes back to a previous round (Product Owner ruling, #1135). A combat
write whose archive count is lower than the stored count fails closed with
`archive_delta_invalid`; no write removes an archive row. In-round undo changes
active state only. Compact initiative undo facts and legacy `previousState` parsing
remain domain concerns of the active round.

An archived round keeps no undo data. When the round end is committed the domain
drops, from each archived command, the facts that only an in-round undo reads
(`ARCHIVED_COMBAT_ROUND_UNDO_ONLY_COMMAND_FACT_KEYS`). Rows archived before #1135
still carry them; they are left as they are and readers ignore them.

## Backups, migration, and recovery

Database backups taken before this migration restore as legacy encounters after the
migration is applied. Backups taken afterward must include the two new tables.
Repository-standard full PostgreSQL dumps already include them.

Restore order is:

1. restore the database;
2. run `prisma migrate deploy`;
3. allow legacy encounters to materialize on their first combat write, or run a
   separately approved explicit migration tool.

There is no production-wide automatic migration in this slice. Recovery from partial
split rows is explicit database/migration work; runtime reads do not fall back.

## Scaling measurement

The checked-in profiling script is
`packages/database/scripts/profileCombatPersistenceSplit.ts`. It uses the largest
local encounter as read-only source material, writes fixtures to an isolated database
schema, and reports medians without creating CI timing thresholds.

The representative post-split fixture used a roughly 1.6 KB reduced session, a
roughly 1.5 KB active row, and bounded ~66 KB archived rows. A fresh isolated-schema
run on 2026-07-26 produced:

| Archives | Legacy active read | Split active read | Legacy JSON rewrite | Split mutation | History source | Full encounter |
| -------: | -----------------: | ----------------: | ------------------: | -------------: | -------------: | -------------: |
|        0 |            1.62 ms |           1.24 ms |             1.89 ms |        5.13 ms |        1.64 ms |        1.79 ms |
|       10 |           44.52 ms |           0.79 ms |           206.60 ms |        2.90 ms |       29.96 ms |       40.66 ms |
|       30 |          125.36 ms |           0.78 ms |           589.46 ms |        2.84 ms |       84.31 ms |      116.24 ms |
|       50 |          195.92 ms |           0.81 ms |           973.30 ms |        2.89 ms |      134.79 ms |      195.90 ms |

Active reads and ordinary writes are flat with archive count. History and exact full
composition remain linear because they intentionally read the archives.

One-row round transitions measured 6.24/22.93/28.18/30.15 ms. One-time legacy
materialization measured 8.12/233.59/689.35/1,195.20 ms because it intentionally
validates and inserts every existing archive exactly once.

The exact 33,947,709-byte representative encounter measured 600.14 ms for a legacy
active read and 3,508.29 ms for a same-value legacy JSON rewrite. Its one-time split
materialization took 3,565.89 ms. After materialization, its active read was 0.89 ms.
History-source and full-composition reads remained history-sized at 558.40 ms and
572.21 ms respectively.

## Remaining boundaries

- Combat command handlers still begin from the backward-compatible full encounter
  service because current domain mutation functions consume `EncounterSession`.
  Their pre-mutation read and projection remain history-sized.
- Production web combat clients negotiate the active-only mutation response, so
  ordinary response serialization and transfer no longer grow with history.
  A legacy full-response branch remains temporarily for rollback compatibility
  and the `complete_round` GM boundary whose tracker still consumes the newly
  archived round from the encounter.
- Exact full GET and history projection remain history-sized by design.
- Scenario participant writes are still separate from the encounter persistence
  transaction, matching pre-split behavior.
- Commands/events/results remain JSON inside their bounded active/archive payloads.

The active-only response is documented in
`active-combat-mutation-response.md`. The next persistence optimization should
move command handlers to an active mutation source without changing their strict
authorization or the exact full-GET contract.

## First-write concurrency and transaction conflicts

Legacy-to-`split_v1` materialization is part of the first accepted combat
mutation's serializable transaction. Read endpoints, including exact encounter
GET and revision polling, must not normalize or materialize persistence. They may
project normalized state in memory, but the first canonical write remains the
only authority that changes storage mode.

The persistence repository retries only Prisma `P2034` write-conflict/deadlock
errors. Each bounded retry starts a new complete transaction and re-reads storage
mode, archive count, and canonical revision. It never retries an individual
`updateMany`, reuses a transaction client, or catches validation/domain errors.
The original expected revision remains fixed:

- if PostgreSQL aborted the only attempted write, the fresh attempt may commit;
- if another accepted command advanced the revision, the fresh attempt returns
  `stale_revision`;
- after three `P2034` attempts, the service returns the typed
  `transaction_conflict` error.

This preserves exactly one revision advance and prevents duplicate active rows,
archives, commands, or events. Concurrent first commands may therefore yield one
accepted mutation and one canonical stale rejection; they cannot both succeed
against the same prior revision.
