# Encounter summary loading and GM polling

Status: implemented for the campaign workspace on 2026-07-26.

## Contracts

`EncounterSessionSummary` is the workspace navigation contract. It contains only:

- encounter, scenario, and campaign identity;
- title;
- status;
- created and updated timestamps;
- an optional player-specific assignment fact.

It deliberately excludes the session document, combat state, archived rounds,
commands, events, results, snapshots, participant combat facts, and roleplay
state. The GM repository query selects only top-level database columns and does
not select `sessionJson`.

`EncounterSessionRevision` contains encounter identity, canonical `updatedAt`
revision, and status. It is the polling contract.

The full `EncounterSession` remains available only from the exact encounter
endpoint when workspace presentation needs the selected encounter.

## Endpoints

- `GET /scenarios/:scenarioId/encounter-summaries`
  returns ordered summaries. Scenario authorization is unchanged.
- `GET /encounters/:encounterId`
  returns the full exact encounter and retains normalization/player-safety
  behavior.
- `GET /encounters/:encounterId/revision`
  returns only the compact revision contract after the same scenario access
  check.
- `GET /scenarios/:scenarioId/encounters`
  remains the explicit full-list endpoint for the scenario editor, which edits
  membership across encounters. It is not used by the campaign workspace.

Player summaries carry only `viewerAssigned`; they do not expose encounter
participant identities. The API currently derives that fact from the full
player-safe membership model. The measured GM performance path uses the
metadata-only repository query.

## Workspace initialization

One initialization effect performs:

1. one campaign/scenario access load;
2. one summary request for each accessible scenario;
3. one slow-changing participant-context request for each scenario;
4. one exact full encounter request after canonical routing selects an
   encounter.

Search-parameter normalization no longer triggers a second initialization.
When no encounter is selected, step 4 does not run.

Changing selection invalidates the previous exact-load token, clears stale
presentation, and fetches only the newly selected encounter.

## Revision polling

Five-second GM Combat polling and focus/visibility refreshes check only the
selected encounter revision:

```text
revision unchanged
  -> no full fetch

revision newer
  -> one exact encounter fetch
  -> authoritative replacement
```

No summaries, access context, participants, campaign metadata, or scenario
content are fetched on an unchanged poll. The interval is installed only while
GM Combat has a selected, fully loaded encounter.

Accepted same-client mutations remain authoritative immediately. Their
encounter replaces local state and updates the selected summary locally;
polling is only for cross-client changes.

Player Combat now uses the same narrow revision contract. Its selected
player-safe encounter and revision-keyed player-safe history are coordinated
separately from scenario projection, content, and participant context. See
`player-combat-refresh.md`.

## Summary refresh policy

Summaries reload when:

- workspace access/scenario context initializes;
- the scenario editor creates an encounter;
- the scenario editor changes encounter status or membership.

An accepted active-encounter mutation updates its title/status/revision summary
from the authoritative mutation response without reloading the list. Ordinary
combat rolls therefore do not request summaries.

## Race handling

- Exact-load and poll responses are accepted only for the still-selected
  encounter ID.
- Each selection load has a monotonic request token.
- A poll cannot replace a newer mutation result; encounter replacement retains
  the latest accepted `updatedAt`.
- A full response older than either the accepted revision or the revision that
  caused the fetch is discarded.
- A missing/deleted encounter removes its summary and clears active state; route
  normalization then clears the invalid selection.
- Polling never replays a mutation.

## Measurements

The prior representative scenario list contained 50 full encounters:

- 83,021,322 bytes per list response;
- two initial list loads;
- another full list every five seconds;
- about 1.51 seconds per list request.

Against the same current local 50-encounter scenario:

- metadata-only summary query: 13.21 ms;
- summary response: 12,508 bytes;
- revision response: 163 bytes;
- largest exact encounter: 33,949,929 bytes and 644.64 ms repository read.

The new initial GM flow transfers one 12.5 KB summary list plus one selected
full encounter, instead of two 83 MB lists. An unchanged poll transfers about
163 bytes and performs no full encounter read. A changed poll transfers the
revision response plus exactly one selected encounter.

These are local diagnostic measurements. A comparable browser
navigation-to-usable-Current-Action trace was not rerun in this slice, so no
new browser timing is claimed.
