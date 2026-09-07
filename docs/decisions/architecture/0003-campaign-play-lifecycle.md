# Architecture decision 0003: Campaign play lifecycle and resumable context

- Status: approved product and architecture decision; implementation remains separately authorized
- Date: 2026-09-05
- Decision owner: Product owner / architecture control plane
- Functional areas: Campaign and narrative encounters; Combat experience; information projection
- Related issues/PRs: Forgejo #34-#40; Blackboard #16 / PR #33
- Supersedes: the earlier Scenario `draft/prepared/live/completed/archived` product
  wording and Encounter `setup/planned/.../complete` plus kind-gated Combat
  wording in this record
- Superseded by: none

## Context

Glantri already has Campaign roster authority, Scenario participant snapshots,
explicit Encounter membership, roleplay actions and checks, and mature Combat
Manager and Player Combat surfaces. The domain also names Campaign, Scenario,
and Encounter states. It does not yet consistently enforce one product lifecycle
and player-safe return path across discovery, direct routes, commands, terminal
history, and Combat entry or exit.

This decision records the accepted first game-usable Campaign-play milestone:

> A GM can activate a prepared Campaign, bring rostered Characters into a live
> Scenario, run roleplay and an optional Combat Encounter, return to the same
> Scenario context, close the Encounter with a public outcome, complete the
> Scenario, and later reopen its player-safe history; players can always discover
> or resume the live context they are entitled to see.

The state names in this record are authoritative product meanings. Existing
schemas, routes, and tests are implementation evidence, not proof that every
transition, projection, or command restriction below is already enforced.
Implementation remains in the separately authorized Forgejo cases in the
[Campaign play roadmap](../../product/campaign-play-lifecycle-roadmap.md).

## Decision

### Authority boundaries

Campaign, Scenario, Encounter, and Combat state are related but separate
authorities:

- Campaign owns the roster and broad play container.
- Scenario owns the concrete story situation and its participant snapshots.
- Encounter owns one bounded moment of play, its explicit membership, situation,
  roleplay activity, lifecycle, public outcome, and private GM closing note.
- Encounter `kind`, where retained for compatibility, is descriptive metadata.
  It is neither a lifecycle nor an authoritative Combat gate.
- Combat Manager and Player Combat retain canonical Combat progression,
  commands, results, and history. Entering or leaving Combat does not create a
  second Encounter or Scenario.
- Server-side action authorization and viewer projection remain separate checks
  under the
  [Authority and Information Projection Principle](../../architecture/information-authority-and-projection.md).

No global session engine or universal `currentScenarioId` is introduced.

### Campaign lifecycle and discovery

| State      | Accepted meaning for this milestone                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draft`    | GM preparation; not ordinarily discoverable by players.                                                                                                                                       |
| `active`   | Discoverable by entitled rostered players and available for the accepted play journey.                                                                                                        |
| `archived` | Present in the current model, but the ordinary archive, delete, and reopen product workflow is deferred unless a later implementation needs a separately accepted minimal terminal treatment. |

The normal milestone transition is:

```text
draft -> active
```

- A Campaign-managing GM may activate the Campaign.
- An administrator may act through the same server-side Campaign-management
  authority where existing administrator authority permits.
- A player may not activate a Campaign.
- There is no ordinary `active -> draft` transition.
- Activation does not change Campaign roster authority or make the Campaign a
  self-join space.

### Common Scenario and Encounter lifecycle

Multiple live Scenarios per Campaign are allowed. There is no global
authoritative `currentScenarioId`.

| Product state | Accepted meaning                                                                |
| ------------- | ------------------------------------------------------------------------------- |
| Draft         | GM preparation; not open for ordinary participant play.                         |
| Active        | Open for actual play and ordinary entitled participant controls.                |
| Paused        | Unfinished and expected to resume; visible, but without ordinary play controls. |
| Closed        | Finished, inspectable, and read-only for entitled participants.                 |
| Archived      | Historical and read-only; omitted from ordinary working/current lists.          |

Allowed normal transitions are exactly:

```text
draft -> active
active <-> paused
paused -> closed
closed -> archived
draft -> archived
```

`Closed` is the canonical product term. Where the existing Scenario/domain enum
uses `completed`, implementation `completed` means product state Closed; this
decision does not require a needless data migration merely to rename that enum.
There is no ordinary Closed or Archived to Active transition.

The current Scenario is derived for the entitled user and current session
context:

- exactly one entitled Active Scenario resumes directly;
- several entitled Active Scenarios present a choice; and
- zero entitled Active Scenarios returns the user to Campaign Home and available
  history.

The derived context is navigation state, not new canonical Campaign state.

### Player Scenario access and terminal restrictions

| Scenario product state | Ordinary player access                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Draft                  | No ordinary player access.                                                                      |
| Active                 | Interactive access for entitled participants.                                                   |
| Paused                 | Visible to entitled participants without ordinary play controls.                                |
| Closed                 | Entitled, player-safe, read-only outcomes, history, and shared information.                     |
| Archived               | Safe entitled historical access through explicit history views; omitted from active navigation. |

Every route and open rechecks server authority. A stable or previously valid
link does not preserve access after the underlying entitlement changes.

Paused, Closed, and Archived Scenarios deny new rolls, participant mutations,
Encounter activation, Combat entry, and every other live command. A disabled or
hidden client control is not sufficient; the server must reject the command with
zero mutation, and unauthorized payloads must exclude protected facts.

### Encounter situation and Combat capability

An Encounter is a bounded situation involving Scenario participants, not a
pre-classified activity modality. Conversation, Skill rolls, opposed checks,
Items/actions, Combat, post-Combat roleplay, and outcome may all occur in the
same Encounter. Create another Encounter when the situational or presence
context changes materially, not merely because the type of action changes.

Any suitable Active Encounter may enter Combat subject to existing participant
and Combat-readiness authority. Encounter kind must not gate Combat. Combat
start and end do not change Encounter lifecycle: leaving Combat returns to the
same Active Encounter, and Combat completion does not Close it.

This preserves the mature Combat Manager and Player Combat. It does not redesign
their tracker, panels, command ownership, calculations, history, or privacy
projection.

### Parent lifecycle, closure, and history

- An Encounter may remain Draft while its Scenario is Draft, Active, or Paused.
- An Encounter may become Active only while its parent Scenario is Active.
- Pausing a Scenario automatically pauses its Active Encounters. Resuming the
  Scenario does not automatically resume them; the GM explicitly resumes each
  relevant situation.
- A Scenario cannot be Closed while any Encounter remains Active or Paused.
- Unused Draft Encounters may be Archived.
- Closed or Archived Scenarios cannot contain newly activated play.

Multiple disjoint Active Encounters remain valid where participant overlap
invariants permit. A participant cannot simultaneously occupy incompatible
Active Encounter contexts. Paused Encounters remain visible and resumable but
offer no ordinary participant play controls.

Closed and Archived Encounters are read-only. They deny new rolls,
participant or membership mutations, roleplay commands, Combat entry, and other
live commands at the server boundary.

Closing an Encounter requires a public outcome. That outcome
is distinct from the private GM closing note: entitled players may receive the
public outcome, while the private note remains absent from player projections.
The outcome becomes durable Scenario/Encounter history, live controls disappear,
and ordinary reactivation is not allowed. Archived is later organization, not
deletion.

### Scenario chronology

Scenario owns the authoritative chronological story across play. Encounter and
Combat histories are contextual views of relevant events. Server-authoritative
event sequence orders events from multiple or interleaved Encounters; whole
Encounters are not ordered as indivisible blocks, and timestamps are metadata
rather than the sole ordering authority.

Each relevant event retains Scenario identity, Encounter identity where
applicable, event kind, appropriate actor/context, player-safe presentation, and
authoritative order. Private GM information is never duplicated into the
player-visible chronology.

### Preserved authorities

This decision reuses, and does not duplicate or absorb:

- Campaign roster membership;
- Scenario participant identity and snapshots;
- explicit Encounter membership and its existing safe fallback boundary;
- roleplay actions, checks, descriptions, visibility, and player projections;
- Combat Manager and Player Combat progression, commands, results, and history;
- Blackboard sharing and search;
- Artifact identity, storage, publication, and binary authorization;
- Items, Character, and NPC identity, ownership, and mechanics; and
- server-side privacy, authorization, and information projection.

Scenario-relevant Blackboard behavior remains outside this milestone. The
integrated #16 shell supplies safe Campaign-level findability and stable links;
it does not decide Scenario relevance, which still requires a later explicit
contract.

## Alternatives considered

- **One global current Scenario:** rejected because several Scenarios may be live
  and entitlement is viewer-specific.
- **Treat roleplay and Combat as separate session universes:** rejected because
  Combat is an activity inside the selected Active Encounter and must
  return to the same context.
- **Gate Combat by Encounter kind:** rejected because a situation may move
  naturally between conversation, checks, Combat, and post-Combat activity.
- **Reactivate completed or archived play:** not accepted for the ordinary
  lifecycle; terminal records remain read-only.
- **Create a new session engine or duplicate Campaign-object authorities:**
  rejected because the existing bounded authorities already own those facts.

## Consequences

The implementation portfolio must enforce transitions, authorization,
projection, navigation, and command denial consistently rather than adding UI
state alone. History must retain the accepted public outcome and player-safe
shared facts without exposing GM notes, hidden participants, private rolls,
private calculations, or executable state.

The following remain deferred: Combat redesign; spatial/VTT; Character
Knowledge; AI recap; universal graph; new Blackboard kinds;
scheduling/attendance; automatic NPC deduplication; Scenario-relevant
Blackboard beyond the integrated #16 Campaign-level work; and broad Item or
Critical rule changes. Later separately contracted work may cover contextual
Scenario Artifacts, Blackboard relevance, Item and snapshot readiness,
Campaign-local NPC entry, temporary-actor promotion, durable spontaneous rolls,
richer summaries, and the complete Campaign edit/archive/delete/reopen
lifecycle.

#37 owns Encounter lifecycle; Scenario/Encounter parent coupling; situational
identity; Combat start and return inside the same Encounter; pause/resume;
public-outcome/private-note closure semantics; and event/history linkage needed
for Scenario chronology. #38 later owns integrated Campaign -> Scenario ->
Encounter navigation and presentation, multiple-live selection, role-aware
workspace composition, chronology presentation, and desktop/narrow layouts.
The final play-workspace layout remains deliberate follow-on design after
Blackboard, Artifacts/maps, equipment, lifecycle, Skills/actions, and relevant
Character Knowledge settle.

## Integration and verification

The [Campaign play roadmap](../../product/campaign-play-lifecycle-roadmap.md)
owns the bounded #34-#40 dependency graph. Each implementation case requires a
fresh exact `origin/dev` baseline, its own authorization, declared hotspot
ownership, a documentation freshness check, and independent QA against an
immutable head.

Verification across the portfolio must cover transition matrices, one/several/
zero live Scenario derivation, direct-link authority rechecks, terminal command
denial and zero mutation, player-payload absence of protected facts, public
outcome/private-note separation, same-context Combat return, reload/reconnect,
and the complete two-user desktop and narrow-layout journey. Focused tasks may
add their own tests, but one owner coordinates migrations and one owner
coordinates the shared full-session E2E fixtures.

Blackboard #16 / PR #33 exact head
`efb62b7456e3fe63cbd26d19a3897222ba8eadad` is integrated on `dev` by merge
`171756bb64ccf83d2e35ffa8400d8206ab24b1d5`. This decision preserves and does
not change its Campaign-shell documentation in
`docs/architecture/ownership.md`,
`docs/product/campaign-scenario-encounter-workflows.md`,
`docs/testing-regression-matrix.md`, or
`packages/domain/src/campaign/README.md`. The first applicable implementation
Definition of Done must add or verify links to this decision in those owning
documents without duplicating its lifecycle tables.

## Release-boundary impact

None. This record changes no product code, schema, migration, runtime, UI,
`main`, Azure, production configuration, deployment, or release state. It does
not authorize implementation of #35-#40 or merge any PR.
