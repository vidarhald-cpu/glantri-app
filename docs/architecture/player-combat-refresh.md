# Player Combat refresh and history coordination

## Split persistence

The revision-keyed refresh contract is unchanged. Exact player encounter and history
responses are composed from split canonical storage and sanitized at the existing
player-safe boundary. Storage mode and row identities never enter Player Combat.

Status: implemented on 2026-07-26.

## Previous request graph

`ScenarioPlayerCombatPageContent` previously used one broad refresh for initial
loading, five-second polling, and focus/visibility refresh. Every invocation
loaded:

| Data                       | Trigger                                       | Duplicate path                                       |
| -------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| scenario player projection | mount, interval, focus                        | slow context was treated as combat state             |
| canonical content          | mount, interval, focus                        | slow context was treated as combat state             |
| participant context        | mount, interval, focus, GM perspective change | participant selection restarted the broad effect     |
| exact encounter            | mount, interval, focus, GM perspective change | unchanged polls still read the full session          |
| combat history             | broad refresh                                 | also loaded by the revision effect                   |
| combat history             | `encounterSession.updatedAt` effect           | duplicated initial, external, and mutation refreshes |
| combat history             | Offensive Parry Brawling success              | duplicated again by the revision effect              |

The broad refresh's local in-flight boolean coordinated only one mounted effect
instance. It did not coordinate mutation responses with interval, focus, or
revision-effect work.

## Refresh model

Player Combat now has three explicit data lifetimes.

### Slow-changing scenario context

Scenario projection, canonical content, and the participant/player shell load
once on entry, scenario change, session/access change, or component remount.
Participant shells returned by player-owned mutations update the local roster.
They are not part of five-second polling.

Equipment, assignment, display-name, and content changes made by another client
may remain stale until navigation/reload unless an existing mutation response
updates the participant. Access is still checked by every revision, exact
encounter, and history request.

### Revision-bound encounter

The selected exact encounter loads once after slow context and participant
perspective resolution. Cross-client polling requests only
`GET /encounters/:encounterId/revision`.

- unchanged revision: no exact encounter or history request;
- newer revision: one exact player-safe encounter request;
- accepted same-client mutation: adopt its returned encounter immediately.

The accepted encounter revision is monotonic. A mismatched encounter ID or
older response is discarded.

### Revision-bound combat history

History has an explicit identity:

```text
encounter ID + encounter revision + optional GM perspective participant ID
```

`sourceEncounterId` and `sourceUpdatedAt` on the player-safe history projection
must match that identity. A single coordinator deduplicates in-flight and
completed requests for the identity.

The history API now obtains its canonical input through
`CombatHistorySourceView`, not a full `EncounterSession`. Authorization and
viewer sanitation remain above that internal read boundary, so this does not
change what a player can see. Unified persistence still means the history
repository physically reads the session JSON; see `combat-read-models.md`.

Initial exact loading, changed-revision polling, every mutation handler, and GM
perspective changes all use this coordinator. There is no
`encounterSession.updatedAt` history effect and no maneuver-specific history
request.

## Mutation authority

Every accepted Player Combat mutation passes its returned encounter through
the same adoption function:

1. validate encounter identity and monotonic revision;
2. replace the authoritative encounter immediately;
3. invalidate history and action descriptors from the older revision;
4. request the matching player-safe history once;
5. accept history only if the encounter revision and perspective still match.

The mutation is never replayed. A concurrent older poll or history response
cannot replace the mutation result.

## Polling and focus

The interval and focus/visibility listeners share one in-flight guard.
Polling is installed only for a selected, loaded combat encounter that is not
complete or archived.

When a newer revision is observed, action controls are invalidated while the
exact replacement is in flight. Stable presentation remains while the revision
check is unchanged.

## Request counts

For a normal player perspective:

| Flow                              |                                                          Before |                                       After |
| --------------------------------- | --------------------------------------------------------------: | ------------------------------------------: |
| initial load                      | 6 requests: 3 context + encounter + history + duplicate history | 5 requests: 3 context + encounter + history |
| unchanged poll                    |                                                      5 requests |                          1 revision request |
| changed external revision         |                          6 requests including duplicate history |  3 requests: revision + encounter + history |
| ordinary accepted mutation        |                       1 history request through revision effect |                     1 keyed history request |
| Offensive Parry Brawling mutation |                                              2 history requests |                     1 keyed history request |

GM-selected Player Combat previously could restart the entire broad effect when
its participant perspective resolved. It now changes only the history identity;
the exact encounter and slow context are retained.

## Transfer measurements

The prior audit measured a representative GM-selected player history response
at 177 KB, built from a 67.94 MB source encounter. The prior unchanged poll also
transferred the scenario projection, canonical content, participants, full
player-safe encounter, and that history.

The new unchanged poll transfers the previously measured compact revision
response of about 163 bytes. A changed poll transfers that revision plus one
exact player-safe encounter and one history response. An accepted mutation
transfers no extra encounter response and requests history once.

No comparable browser navigation-to-usable-Current-Action trace was collected
for this slice, so no browser timing claim is made.

## Race rules

- Mutation responses outrank older polling work.
- Exact encounter responses must match the selected encounter and cannot move
  the accepted revision backward.
- History must match encounter, revision, and GM perspective.
- Concurrent requests for one history identity share one promise.
- Selection changes invalidate exact loads, polling, and history acceptance.
- A missing or newly inaccessible encounter clears revision-bound state.
- Polling never retries or replays a command.
