# Active combat mutation responses

Date: 2026-07-26  
Wire version: `active-v1`

## Purpose

Ordinary combat mutations no longer need to send immutable archived rounds back to a
client that already has the encounter identity, revision polling, and revision-keyed
history. The active mutation response is the authoritative post-command active state;
combat history remains a separate revision-bound projection.

Exact encounter GET and the persisted `EncounterSession` write model are unchanged.
This is a response and client-adoption boundary, not a combat-rule or persistence
change.

## Previous response audit

All combat mutation families returned `encounter: EncounterSession`. Individual
routes also returned some combination of:

- a full command plus a command envelope;
- one participant or an array of updated participants;
- initiative or Combat Experience calculation facts;
- an attack result;
- a distance edge or difficulty.

The GM and Player clients immediately read the returned encounter, while the small
route-specific values drove calculation or participant presentation. No ordinary
mutation client needed archived rounds, prior snapshots, or old history from the
response. Player Combat already requested a player-safe history projection keyed by
the accepted revision.

The audited mutation families are:

| Family                           | Routes covered                                                                  | Small presentation retained                 |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| declaration and modifier review  | declaration, generated/manual modifier review, phase review                     | participant updates where changed           |
| initiative and Combat Experience | roll/commit initiative, CE difficulty, CE roll, back-out/continue               | initiative, difficulty, CE result           |
| attacks and defenses             | attack, parry, hit location, critical, damage proposal/review/commit            | attack result where already returned        |
| maneuvers and contests           | Feint, Adjust Distance, Offensive Parry Brawling, Continued Contact maintenance | existing concise route result only          |
| distance and round end           | edge changes, controlled distance, health, SU review, boundary/open-round work  | edge and participant updates where returned |
| progression utilities            | initialize, clear step, prepare round end, phase decisions                      | command envelope                            |

## Contract

`ActiveCombatMutationResponse` is a strict shared domain schema:

```text
version: 1
encounterId
revision
activeCombatState
commandEnvelope
nextTask?
updatedParticipants?
mutationPresentation?
storageMode?
```

`activeCombatState` is `ActiveCombatRoundState`; its schema cannot contain the
archived `rounds` collection. It can contain the bounded current-round commands,
events, results, and snapshots required to reconstruct exact Current Action,
tracker, inspector, undo, and descriptor state. The prohibition on a response
`commands` array refers to a duplicated top-level/full-history command payload, not
the canonical bounded command facts inside the active state.

`mutationPresentation` is limited to 64 KiB. The outer response is strict and
rejects full encounter, archived-round, history, or duplicate-command fields.

`nextTask` is a concise identity of the first executable canonical task. It is
advisory presentation data; the complete active state remains the source used to
reproject all parallel/current work and authorization descriptors.

## API negotiation and rollback

Migrated clients send:

```text
x-glantri-combat-response: active-v1
```

A route-scoped pre-serialization builder converts the existing internal mutation
payload into the active contract. It removes the full encounter and duplicate full
command before Fastify serialization. Without the header, the legacy full response
remains available as the rollback/compatibility path.

The builder extracts and validates only the active state. It does not validate or
walk archived rounds and does not perform a post-mutation full encounter read.
The persistence service still receives the authoritative domain session used by the
existing command handlers; the physical split ensures its write remains active-only.

Legacy response removal is a later cleanup after any non-web/API consumers are
inventoried. Production GM Combat, Player Combat, and GM Player Combat now request
`active-v1` for ordinary active-state mutations.

`complete_round` remains on the legacy response temporarily. That command creates a
new immutable archive, while the GM tracker still reads archived rounds from its
full encounter rather than the revision-keyed history projection used by Player
Combat. Returning an active-only response there would silently omit the just-closed
round from GM historical inspection. This explicit boundary exception preserves
exact UI state without violating the active contract by embedding an archive. Moving
GM history/tracker to the independent history projection is the prerequisite for
removing this final legacy mutation response.

## Client adoption

The shared encounter client:

1. sends the compact response header;
2. validates `ActiveCombatMutationResponse`;
3. rejects a mismatched encounter identity;
4. replaces revision and active combat state;
5. retains locally loaded immutable rounds and non-combat metadata;
6. exposes existing small mutation presentation and participant-update values to
   current UI handlers.

The request body helper removes the local `currentEncounter` before JSON
serialization. It is a client-side application source, never a wire field.

GM Combat uses its existing monotonic revision guard before replacing Current Action,
tracker, and inspector state. Player Combat uses its existing encounter/revision
guard and history coordinator. GM Player Combat shares the Player Combat path and
differs only by selected participant and proxy authority.

## History responsibility

Active replacement never clears the last confirmed history presentation. The
history coordinator requests the player-safe projection for the new revision once
and atomically replaces the revision-keyed history when it arrives. Older history
responses are ignored.

The active response contains no combat history. Revision polling does not fetch a
full encounter after a successful same-client mutation. Exact reload remains the
recovery and compatibility path.

## Race rules

- Encounter identity must match the selected encounter.
- Accepted client state is monotonic by canonical revision.
- Existing GM and Player acceptance guards discard older responses and accept the
  same revision idempotently.
- A mutation response outranks an older polling request.
- History is accepted only for the current encounter/revision/perspective key.
- No mutation is automatically retried or replayed.
- Optimistic concurrency, task, execution-group, initiative-group, effect-cutoff,
  source, and modifier-signature authorization remain server-side and unchanged.

## Size and CPU measurement

A deterministic synthetic fixture used a 33,755,559-byte history-bearing legacy
response (50 archived rounds) and the same active state for every mutation family.
On the local Node 25.8.2 runtime:

| Response              |      Bytes |
| --------------------- | ---------: |
| legacy full encounter | 33,755,559 |
| attack                |      1,960 |
| parry                 |      1,958 |
| initiative            |      1,950 |
| modifier review       |      1,912 |
| distance              |      1,982 |
| Brawling              |      1,955 |
| round-end review      |      1,912 |

The representative active response was 1,954 bytes, a 99.9942% reduction.
Median full serialization was 4.241 ms; active response composition was 0.312 ms
and active serialization was 0.009 ms over 12 local runs. A separate valid
33,789,385-byte schema fixture measured 0.561 ms for full schema composition versus
0.301 ms for active response composition.

These are local CPU/byte measurements, not CI timing thresholds. No browser
response-to-Current-Action trace was collected, so no browser timing claim is made.
Repository active reads and writes retain the already measured split-persistence
cost; this slice removes response-side archive traversal, serialization, and
transfer.

## Remaining work

- Command handlers still begin from the backward-compatible full domain encounter.
  Their pre-mutation read/projection cost remains the next server-side target.
- Current active state can itself grow within a very long round.
- GM tracker and result rendering still rebuild substantial presentation models.
- The legacy response branch should be deleted only after external consumers are
  confirmed migrated and GM round-boundary history no longer depends on the full
  encounter.

## Persistence conflict errors

Active-only response negotiation does not change mutation error semantics.
`stale_revision` remains the canonical response when another command committed
first. An exhausted serializable-storage conflict is returned as HTTP 409 with
code `transaction_conflict` and the safe message “Combat state changed while
saving. Refresh and try again.” Raw Prisma paths and SQL diagnostics are never
part of the response.

GM Combat keeps the accepted encounter rendered and shows this message in the
normal action-error area. The error is not classified as an exact-encounter load
failure, and no mutation is replayed by the client.
