# Architecture decision 0004: Canonical Field Equipment v1 authority

- Status: approved product and architecture decision; implementation remains separately authorized
- Date: 2026-09-05
- Decision owner: Product owner / architecture control plane
- Functional areas: Equipment and physical state; Character lifecycle; Campaign and narrative encounters; Combat engine; information projection
- Related issues/PRs: Forgejo #8 and #43-#47
- Supersedes: none
- Superseded by: none

## Context

Glantri already stores concrete Campaign-context Items, Character storage and
loadout records, Scenario participant equipment snapshots, Scenario-available
object references, Combat Item interactions, and persistent ammunition
consumption. Those paths do not yet form one accepted end-to-end authority
contract. In particular, Character equipment does not have one aggregate
revision, Scenario snapshots do not detect external equipment changes, and
legacy `CharacterBuild.equipment` remains a competing compatibility shape.

This decision establishes the authority and portfolio boundary for Canonical
Field Equipment v1. Existing schemas, services, and tests are implementation
evidence, not proof that this decision is already satisfied. Delivery remains
in the separately authorized Forgejo cases listed in the
[Field Equipment roadmap](../../product/canonical-field-equipment-v1-roadmap.md).

The accepted milestone is:

> The same durable Item can be assigned, carried, equipped, made available, picked up, transferred and used from Campaign through Character, Scenario and Combat; the application always makes clear which state is canonical and which is a Scenario projection, detects external staleness rather than silently diverging, preserves authoritative in-play changes across reload, and never exposes Item information beyond the viewer’s actual relationship authority.

## Decision

### One durable Item identity

A concrete Item has one durable identity from Campaign authoring or assignment
through Character carry, Scenario availability and pickup, Character-to-Character
transfer, and Combat use. Every transition updates or refers to that same Item.
The application must never create parallel canonical copies to represent an
assignment, snapshot, pickup, handover, drop, draw, stow, or ammunition use.

Template or catalogue identity describes an Item; it does not replace the
concrete Item identity. Scenario and Combat records may retain projections,
frozen facts, references, and evidence, but they do not become another concrete
Item authority.

### Relationship to existing authority

The
[Character lifecycle contract](../../architecture/character-lifecycle-authority.md)
continues to own canonical Character identity, Character-level optimistic
concurrency, roster references, and Scenario participant snapshots. This
decision narrows the current-equipment part of that authority: the equipment
aggregate has its own coherent revision contract, and an equipment
reconciliation does not silently refresh unrelated Character snapshot facts.

The
[Campaign, Scenario, and Encounter workflow](../../product/campaign-scenario-encounter-workflows.md)
continues to separate Character development, Scenario actors, Encounter
membership, and Combat tools. Scenario Item availability belongs to the
Scenario play context. Combat Item operations occur through the existing
Encounter/Combat command authority and do not transfer Combat progression to
the equipment aggregate.

Existing
[equipment/encumbrance](../../rules/equipment-encumbrance-calculations.md) and
[loadout/combat](../../rules/combat-loadout-calculations.md) calculations remain
the current calculation references. This decision changes identity,
persistence, projection, reconciliation, and evidence boundaries; it does not
invent new encumbrance, carrying, weapon, armor, shield, OB, DB, Parry, or
initiative rules.

### Character equipment aggregate

Current equipment for one Character is one revision-controlled aggregate. Its
revision covers, as one coherent unit:

- held Item membership;
- Character storage, location, and carry state;
- equipped and loadout state;
- persistent active-ammunition selection; and
- the existing persistent loadout configuration.

Every mutation that changes participating records is atomic under the expected
aggregate revision. A coherent read returns one revision and cannot combine
membership, location, loadout, or ammunition state from different revisions.
A stale expected revision changes nothing and requires explicit reload and
reconciliation.

A Character-to-Character transfer coordinates two Character aggregates and the
same concrete Item identity. The mutation either removes the Item and its
loadout references from Character A and establishes its valid state for
Character B, or changes nothing. The transfer does not clone, delete and
recreate, or silently change identity.

`CharacterBuild.equipment` ceases to be current write authority. It may remain
only as a compatibility or historical projection until a separately bounded
retirement removes it. New current equipment writes must not flow through that
legacy shape.

### Transfer and Scenario pickup are different transitions

A handover or transfer moves a held Item from Character A to Character B. Both
Characters participate in a coordinated multi-aggregate mutation.

A Scenario pickup begins with an unheld Campaign-context concrete Item. An
authorized GM explicitly makes it available in a Scenario, and an entitled
Character acquires that same Item. Scenario availability is play-context
authority: it decides that a named Item may be acquired in that Scenario and by
whom it may be projected. It is not Item identity, Character storage, or a
general world/container engine.

Dropping an Item during authoritative play makes that same concrete Item unheld
in the applicable play context. A later pickup acquires that identity; it does
not manufacture a replacement. Field Equipment v1 adds no free-standing world
objects, nested locations, containers, or general spatial inventory.

### Canonical state and Scenario projection

Canonical Item and Character equipment state remain the durable source of truth.
A Scenario may capture an operational equipment projection for entitled play.
The product must label and present those two roles clearly rather than treating
the projection as an invisible cache or a second authority.

When canonical equipment changes outside the Scenario after projection capture,
the Scenario equipment projection becomes `STALE` visibly. The application:

1. detects the external change from retained revision or fingerprint evidence;
2. does not silently refresh or silently continue with divergent state;
3. requires explicit GM reconciliation; and
4. blocks dependent authoritative play until reconciliation succeeds.

Authoritative in-play pickup, handover, drop, draw, stow, ammunition
consumption, and other explicitly approved mutations are different. Each must
reconcile canonical and operational state in the same authoritative operation
and must not deliberately leave the Scenario projection stale. The reconciled
result and aftermath persist across reload, reconnect, and historical review.

### Frozen mechanical interpretation

An active Scenario freezes the resolved structured mechanical facts sufficient
to continue accepted play, together with provenance and a deterministic
fingerprint. The frozen record identifies at least the concrete Item, source
template or definition evidence, resolved supported mechanical values, and the
version/revision inputs used to resolve them.

This is a bounded play-integrity contract, not a Skills-style full Item release
platform. Field Equipment v1 does not require a generalized versioned Item
catalogue, mutable authoring framework, release candidate workflow, or content
migration platform.

Authored final-OB and initiative Item facts remain unsupported and
non-operative for Field Equipment v1. Existing schema or projector names are
not authority to apply them during play. They may not affect Character,
Scenario, or Combat calculations without a separate explicit Glantri rule
decision and focused mechanical verification.

### Existing ammunition-family mechanism only

Field Equipment v1 completes the existing bounded ammunition-family path:

- persist the active ammunition selection as Character equipment state;
- require server-side family compatibility between the active missile weapon
  and selected ammunition;
- preserve selection and readiness across reload;
- consume the authoritative concrete ammunition Item quantity when the shot is
  committed; and
- support the existing bounded command undo by restoring the guarded quantity
  and operational state.

This decision adds no quiver capacity, ammunition recovery, container,
bulk-repacking, or new carrying rule. An ammunition-container catalogue record
does not gain capacity or storage authority by implication.

### Bounded durable evidence

Field Equipment v1 retains durable, queryable evidence for these accepted
transitions:

| Transition                          | Minimum evidence                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| Assignment and unassignment         | Item, actor authority, source/destination Character or unheld Campaign context, order/time          |
| Character transfer                  | Item, actor authority, both Character contexts, before/after revisions, order/time                  |
| Scenario availability               | Item, actor authority, Campaign and Scenario context, availability state, order/time                |
| Pickup and drop                     | Item, actor authority, Character and Scenario/Combat context, before/after holder state, order/time |
| Quantity and ammunition consumption | Item, actor authority, Character/Scenario/Combat context, before/after quantity, order/time         |
| Supported undo                      | Original transition reference, undo actor authority, restored facts, order/time                     |

Evidence may live in bounded aggregate/Scenario/Combat event records and command
facts. A generalized Item ledger, accounting system, or universal event-sourcing
platform is deferred.

### Relationship-derived information authority

Canonical authority, action authorization, viewer projection, and rendering are
separate gates under the
[Authority and Information Projection Principle](../../architecture/information-authority-and-projection.md).

GM-private Item facts derive from the viewer's actual Campaign/Character
management relationship. A global `game_master` role alone never grants those
facts. The managing Campaign GM receives the private projection required to
manage the Item; an owning Character player receives only their permitted
holder projection; an unrelated global GM, ordinary Campaign player, and
cross-Campaign viewer do not receive private keys, values, identities,
relationships, executable facts, or hidden existence signals.

Ambiguous relationship authority fails closed. Client-side hiding, a rejected
mutation, or a clean DOM does not prove a safe server projection.

## Portfolio and compatibility consequences

- Forgejo #44 is the narrow independent security repair for relationship-derived
  private Item projection. It must avoid aggregate, Scenario, and Combat scope.
- Forgejo #45 owns the revision-controlled Character equipment aggregate and
  coordinated same-ID Character transfer.
- Forgejo #46 owns Scenario availability, pickup/drop, external-staleness
  detection, explicit reconciliation, frozen facts, and in-play synchronization.
- Forgejo #47 is the integrated product milestone and may begin only after its
  dependencies and shared hotspots are cleared.
- Forgejo #8 remains a causally separate Mandatory Recovery investigation. It
  may independently instrument the intermittent equipment read-model race only
  after separate authorization. This decision neither authorizes #8 nor claims
  that the known aggregate gap caused its observation.

Existing Item, storage, loadout, Scenario snapshot, Combat interaction, and
ammunition records require compatible migration rather than identity replacement.
One migration owner controls schema order. `CharacterBuild.equipment` remains
readable only for bounded compatibility/history until its separately verified
retirement.

## Deliberate deferrals

Field Equipment v1 does not decide or authorize:

- generalized consumables, charges, or arbitrary use counters;
- containers, nested storage, quiver capacity, or a world/container engine;
- stack split/merge;
- economics, price, budgets, or an Item ledger;
- generalized condition, degradation, repair, or ammunition recovery;
- new encumbrance, carry-capacity, location, or movement rules;
- a broad custom or versioned Item-definition/release platform;
- activation of authored final-OB or initiative Item facts; or
- Chargen or Combat Manager redesign.

Existing accepted weapon, armor, shield, loadout, encumbrance, Combat, and undo
rules remain unchanged except where a later separately authorized implementation
is necessary to conform persistence and authority to this decision.

## Verification obligations for implementation

Dependent implementation contracts must cover, in their applicable layers:

- same-ID assignment, unassignment, transfer, availability, pickup, drop, use,
  quantity/ammunition consumption, and supported undo;
- expected-revision success, stale rejection, concurrent transfer, rollback,
  coherent reads, duplicate-possession denial, and reload/reconnect persistence;
- external mutation causing visible `STALE`, blocked dependent play, explicit GM
  reconciliation, and authoritative in-play operations remaining reconciled;
- frozen supported facts plus provenance/fingerprint, with final-OB and
  initiative authoring proven non-operative;
- managing GM, holder, unrelated global GM, ordinary Campaign player, and
  cross-Campaign negative payload perspectives; and
- desktop and supported narrow-layout product evidence without exposing
  architecture terms as ordinary player copy.

Documentation-only approval of this record does not authorize source code,
schema, migration, behavior, issue integration, `main`, Azure, production, or
deployment changes.
