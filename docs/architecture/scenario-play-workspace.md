# Scenario Play Workspace — Durable Product/Architecture Contract

## 1. Status and scope

**Portfolio area:** #119 Artifact Management / #227 Campaign Management V2\
**Milestone:** Scenario Play Workspace\
**Architecture state:** Product Owner approved; implementation not authorized\
**Date recorded:** 2026-09-21\
**Recorded against:** `dev@57be80043461d065a61c462a1b511601e1a261e1`\
**Source of authority:** [#268 Scenario Play Workspace](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/268),
PRODUCT OWNER RULINGS — 2026-09-21\
**Amended:** 2026-09-21 — PRODUCT OWNER RULING PO-SPW-2, recorded on
[#268](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/268). The
Blackboard is meta-level player collaboration. See
[section 8](#8-blackboard-boundary) and
[decision PO-SPW-2](#po-spw-2--settled-the-blackboard-is-meta-level-player-collaboration).\
**Amended:** 2026-09-21 — PRODUCT OWNER RULING PO-SPW-1 and PO-SPW-3, recorded
on [#268](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/268).
**#268 now has no remaining open Product Owner decisions**, and no slice is
gated on one. See
[section 12](#12-product-owner-decisions--all-settled).

This contract records the approved rulings that govern the in-play surface: how
Items and Artifacts differ, how presence differs from visibility, where play
actually happens, what the player's in-play inventory is, and what the
Blackboard may and may not do.

It is the controlling contract that later implementation slices are written
against. It **does not authorize implementation**, Builder dispatch, branch
creation, schema migration, or PR work. Section 11 proposes bounded slices;
each still requires its own authorization through the canonical lifecycle.

This contract **introduces no new domain primitive**. Section 10 records the
existing domain evidence for that claim.

### Out of scope

- AI-friendly Artifact intake, tracked separately as
  [#271](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/271). It is an
  independent playtest blocker and does not wait for this milestone. This
  contract only names the seam where intake meets Campaign Artifact authoring
  (section 9).
- Blackboard redesign beyond the boundary stated in section 8.
- Player-created collaboration Artifacts. These are recorded as a later bounded
  capability in [section 11](#later-bounded-capability--player-created-collaboration-artifacts)
  and are deliberately **not** part of any slice in this contract.
- Map and spatial/VTT expansion.
- Any change to the canonical Item, Character, Scenario, or Encounter domain
  models.

---

## 2. Product outcome

> **The Scenario surface becomes the canonical Scenario Play Workspace, with
> Items, Artifacts, presence and visibility correctly distinguished, so an
> ordinary GM can run play end to end.**

The current state does not meet this outcome. Campaign Artifact management is a
GM authoring surface, and the in-play Scenario player surface carries no
Artifact or Blackboard access at all.

---

## 3. Controlling distinctions

These nine distinctions are the substance of this contract. Every slice,
review, and QA verdict in this milestone is measured against them.

| #   | Distinction                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------- |
| D1  | **Scenario** is the canonical play workspace. It answers _where are we playing?_                                     |
| D2  | **Encounter** is active contextual state **within** the Scenario. It answers _what is happening right now?_          |
| D3  | **Item** is a physical game-world object with presence, ownership, and equipment state, in the canonical Item model. |
| D4  | **Artifact** is a media/reference representation.                                                                    |
| D5  | An Item **may have attached Artifact representations**; a pure Artifact needs **no persistent Encounter ownership**. |
| D6  | **Presence is not visibility.** Revealing does not move something; picking it up does.                               |
| D7  | **Blackboard is presentation only.** Placing something on the board changes nothing canonical.                       |
| D8  | **Player play inventory is a Scenario-aware projection** of canonical Character inventory, not a second inventory.   |
| D9  | **Blackboard state is player discussion state, not game-world state.** The board is outside the game world.          |

---

## 4. Items versus Artifacts

### 4.1 Item

An Item is a thing that exists in the game world: weapons, physical maps,
letters, keys, valuables, books, equipment, and other pickable or ownable
objects.

An Item requires **game-world presence**. The system must be able to express
that an Item is:

- present in the current Scenario or active Encounter;
- visible or hidden to players;
- held by an NPC;
- loose in the environment;
- carried by a PC.

Items use the **existing canonical Item, ownership, and presence model**.

> **Do not invent a third ownership system.**

The canonical Item identity, override, equip, and movement semantics remain
those of
[GM Equipment Item Lifecycle V1](equipment-item-lifecycle.md#2-controlling-domain-separation),
including
[Item identity and movement](equipment-item-lifecycle.md#18-item-identity-and-movement).

### 4.2 Artifact

An Artifact is a media or reference representation: portraits, illustrations,
handouts, document images, clue images, tactical or reference maps, and other
presentational material.

Artifact identity, revision, ownership, visibility, and provenance remain
governed by
[Artifact Management & Package Import](artifact-management-package-import.md),
including
[ownership is distinct from visibility](artifact-management-package-import.md#61-ownership-is-distinct-from-visibility)
and
[no implicit ownership transfer](artifact-management-package-import.md#64-no-implicit-ownership-transfer).

### 4.3 Attached representation

A physical game-world object may have **zero, one or multiple** Artifacts
attached as its representation. Attachment is a representation link. It does not
make the Artifact an Item, and it does not make the Item media.

The required association semantics — multiplicity, revision pinning, and
attachment provenance — are settled by
[PO-SPW-1](#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics).
The recording mechanism belongs to the slice that implements it.

| Example                | Model                                  |
| ---------------------- | -------------------------------------- |
| physical treasure map  | Item + map Artifact                    |
| sword                  | Item + optional image Artifact         |
| letter                 | Item + document/image Artifact         |
| Captain Varro portrait | Artifact only                          |
| GM tactical map        | Map/Artifact, **not** normally an Item |

### 4.4 Encounter association

- **For Items, encounter/scenario presence is real game state and must be
  represented.**
- **For pure Artifacts, do not introduce persistent Encounter-to-Artifact
  ownership semantics merely to support display.** What the GM needs is an
  **encounter-context Reveal action** directed at the players currently in play.

This settles the earlier question in both directions: yes to Encounter-level
association for Items, no to persistent Encounter ownership for pure Artifacts.

### 4.5 Reveal and Share are two different operations

Ruling PO-SPW-2 establishes that the GM visibility operation and the shared-board
collaboration operation are **distinct operations that must be named
differently**. This section defines the canonical vocabulary. Every later
section, slice, API, and user-facing label in this milestone uses it.

| Canonical name                 | Who acts        | What it does                                                                                                                | What it changes                                                                    |
| ------------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Reveal** (GM reveal)         | GM only         | Makes protected GM-authored material accessible to a player or to the players. Players cannot reach unrevealed GM material. | Who may know or see. Nothing else. See [section 5](#5-presence-versus-visibility). |
| **Share**                      | Any participant | Adds material the actor can already access to the durable shared-material collection.                                       | Membership of the shared collection. No game-world state.                          |
| **Place on the Blackboard**    | Any participant | Puts an item of shared material on the shared board so the table is looking at it together.                                 | Board presentation only. No game-world state.                                      |
| **Remove from the Blackboard** | Any participant | Takes it off the board. The material stays in the shared collection.                                                        | Board presentation only. Destroys nothing.                                         |

> **Prohibited: using `reveal` for both operations.** The word `reveal`, and any
> equivalent identifier, route, command, event type, or user-facing label
> derived from it, is reserved for the GM visibility operation. It must not
> name, in implementation, API, or UI, the act of sharing material, placing it
> on the Blackboard, or removing it from the Blackboard. Conversely, Blackboard
> vocabulary — `share`, `place`, `placement` — must not name the GM visibility
> operation.

Reveal is a **precondition** for Share, never a synonym for it: a player may
share only material they can already access, and GM material becomes accessible
only through a Reveal. Once material is accessible, sharing and placement are
the players' own decision, and Glantri **must not** attempt to decide whether
the other players' characters could know or see it. See
[section 8](#8-blackboard-boundary).

---

## 5. Presence versus visibility

**Present** means physically or currently in the play context.\
**Visible** means players are allowed to know about or see it.

They are independent axes. An Item may be present and hidden, present and
visible, or visible in a representation while not present at all.

> **Revealing something does not move it. Picking it up does.**

Consequences:

- A **Reveal** action, in the sense defined in
  [section 4.5](#45-reveal-and-share-are-two-different-operations), changes only
  who may know or see. It never changes holder, location, carry mode, equip
  state, or canonical Scenario association.
- A pickup is an ordinary canonical ownership transition and is the only one of
  the two that changes game-world state.
- Presence gates usability. Visibility gates knowledge.
- A projection surface may show what is visible; it may never be the authority
  for what is present.

Server-side projection rules in
[Authority and Information Projection](information-authority-and-projection.md#projection-rules)
continue to govern what any viewer receives. A viewer must never receive
GM-private material through a play surface.

---

## 6. The in-play surface

### 6.1 No separate Encounter play page

> **Do not create a separate Encounter play page.**

The existing Scenario surface becomes the canonical **Scenario Play Workspace**.

- The **Scenario** answers _where are we playing?_
- The **active Encounter** answers _what is happening right now?_

An active Encounter is therefore **contextual state within the Scenario
workspace, not another navigation destination**. The workspace must make the
active Encounter obvious and surface the relevant current-play information.

This extends, and is consistent with, the V2 ruling in
[Campaign Management V2 §3.1](campaign-management-v2.md#31-no-separate-play-hierarchy)
that no second navigation hierarchy is created for an object that already has a
canonical home.

### 6.2 What the workspace surfaces over time

The workspace should, over time, support:

- PCs currently participating;
- visible NPCs;
- Items present in the current play context;
- the [durable shared-material collection](#83-the-durable-shared-material-collection)
  of revealed and shared Artifacts and clues;
- current Encounter information;
- Scenario/Encounter log;
- GM messages;
- future chat/messages;
- access to Map;
- access to Blackboard;
- the player's usable/current inventory.

> **Prefer fewer coherent play pages with richer context** rather than
> proliferating separate NPC, Item, handout, Encounter, and message pages.

### 6.3 One state, two authorities

GM and player views use **the same underlying Scenario/Encounter state with
different authority and visibility**. They are not two models and not two
sources of truth. The difference is what the viewer may do and what the server
projects to them.

---

## 7. Player inventory

> **Do not create a second "play inventory."**

Player inventory in the Scenario Play Workspace is a **Scenario-aware
projection of canonical Character inventory**.

Required semantics:

- Only Items actually present with the Character or with the current play
  context may be used.
- Environmental Items may be visible and present, and may be picked up.
- **Pickup uses the normal canonical ownership transition** into Character
  inventory.
- Equipped state remains canonical Character/Item state.
- An Item stored elsewhere may remain on the Character record and history, but
  **must not become usable merely because it exists in the database**.

This is the play-facing statement of the existing rule that a Scenario holds an
operational equipment projection rather than a second Item identity or
inventory; see
[Canonical equipment in Scenario play](../product/campaign-scenario-encounter-workflows.md#canonical-equipment-in-scenario-play).
The existing staleness and reconciliation authority described there is
unchanged by this contract.

---

## 8. Blackboard boundary

### 8.1 Core invariant

> **Blackboard = player discussion state, not game-world state.**

The Blackboard is **explicitly outside the game world**. It is a shared
collaboration and discussion surface for the human players and the GM, and it
represents what the table is currently looking at and talking about. It is not a
place, a container, a holder, or a channel inside the fiction.

**Blackboard state must not be used to model:**

- character knowledge;
- Item ownership;
- character visibility;
- in-world communication.

A consequence follows directly, and it is deliberate. Once material is
accessible to a player, that player may put it in front of the whole table, and
**Glantri must not attempt to determine whether the other players' characters
could know or see it**. That is intentional meta-level player communication
between the humans at the table, and the app does not adjudicate it.

Protection lives one step earlier, at Reveal: players cannot reach arbitrary
unrevealed GM material in the first place. See
[section 4.5](#45-reveal-and-share-are-two-different-operations).

### 8.2 Who may act, and what it changes

- **Any participant** — player or GM — may share accessible material and place
  it on the Blackboard.
- **Any participant** may remove material from the Blackboard.
- Placement and removal are **presentation only**.

> **Blackboard placement and removal must NOT change:**
>
> - Item ownership or location;
> - Artifact ownership;
> - Scenario or Encounter presence;
> - GM visibility state, including whether material is Revealed;
> - Item-to-Artifact association;
> - canonical Scenario association, carry mode, or equip state;
> - any other game-world state.
>
> An Artifact never becomes an Item by being placed on the Blackboard, and an
> Item never leaves its holder by being placed on it.

Worked examples:

- A PC carrying a physical map Item opens its attached map Artifact and places
  it on the Blackboard. The Item stays in the PC's inventory.
- The GM Reveals a sword image while the sword remains on the floor. The
  sword's presence and holder are unchanged.
- A clue Artifact is shared and placed on the board without becoming anyone's
  possession.
- A player takes a clue off the board because the table has moved on. The clue
  is still available to everyone it was shared with; nothing in the game world
  changed, and the GM's Reveal is not undone.

### 8.3 The durable shared-material collection

> **Material that has been deliberately Revealed or Shared must not disappear
> merely because it is removed from the Blackboard.**

The contract therefore requires a **durable, player-facing shared-material
collection**. It holds what the GM has made available and what participants have
shared, it survives removal from the board, and material can be reopened from it
and placed back on the board at any time.

At minimum it preserves GM material previously Revealed. It must be architected
so that participant-shared material uses the same concept rather than a parallel
one, and so that later player-created collaboration Artifacts can join it
without a second collection.

**This needs no new entity and no new domain primitive.** The separation the
ruling requires already exists in the model, in two layers:

| Requirement                                              | Existing expression                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GM-Revealed material persists independently of the board | `ScenarioArtifactReference` state `published`, with `artifactAudienceSchema`, read through `ArtifactService.listVisible`. A Scenario publication is already a durable visibility fact that no board action touches.                                                                    |
| Shared material is a collection, not a layout            | `blackboardCommonDtoSchema.catalogue` — the durable set of shared entries, each with its own identity, `entryVersion`, and revision `state`. Entry lifecycle is separate again: `blackboardEntryStateSchema` (`published` / `retracted` / `archived`) and `blackboardTombstoneSchema`. |
| Board presence is a separate, disposable layer           | `blackboardCommonDtoSchema.layout.placements`, created and deleted through `blackboardPlacementCreateSchema` and `blackboardPlacementDeleteSchema`, keyed by `entryId`.                                                                                                                |
| Reopen and place back                                    | Creating a placement again for a catalogue entry that never left the catalogue.                                                                                                                                                                                                        |

The mapping is therefore exact: **"remove from the Blackboard" is deleting the
placement, not the entry.**

Two naming consequences are binding on implementation:

1. The existing entry-level `canRemove` capability in
   `blackboardViewerCapabilitiesSchema` is a different, consequential operation
   that retracts shared material from the collection. It is **not** the
   any-participant removal this ruling authorizes, and the two must not share a
   control, a label, or an endpoint. Any-participant removal acts on the
   placement.
2. The player-facing collection is presented filtered to the current play
   context — Scenario publication scope for Revealed Artifacts, shared-entry
   scope for shared material — rather than by creating a second store. No new
   scope object is introduced.

### 8.4 Not a Blackboard redesign

This is a boundary and invariant statement, not a Blackboard redesign. The
deferral in
[Campaign Management V2 §9](campaign-management-v2.md#9-blackboard-boundary)
stands, as does the existing shared-surface behavior in
[Shared Campaign Blackboard](../product/campaign-scenario-encounter-workflows.md#shared-campaign-blackboard).
The board's categories, revision semantics, search, and layout behavior are
unchanged by this contract.

---

## 9. Campaign Artifact management boundary

Campaign Artifact management is a **GM authoring and index surface**.

It is **not** the player in-play experience, and it **is not an acceptable
substitute** for the Scenario Play Workspace.

> The current state is therefore **not sufficient for playtest** merely because
> a player-visible Artifact can technically be found somewhere in the Campaign
> catalogue.

The authoring surface still depends on an ordinary upload path rather than
package engineering, per
[Campaign Management V2 §5.1](campaign-management-v2.md#51-artifact-upload-dependency).
The AI-friendly intake work in
[#271](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/271) improves
that authoring seam and is **independent of this milestone**. No slice below
depends on it, and no slice below may absorb it.

---

## 10. Existing-model evidence

This contract asserts that the approved requirements are expressible in the
current domain. The evidence, read at the recorded baseline:

| Requirement                                            | Existing model that expresses it                                                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encounter as contextual state inside Scenario          | `scenarioSessionParticipantPresenceSchema` in `packages/domain/src/campaign/scenarioSession.ts` is a discriminated union over `scenario` and `encounter`, already modelling Encounter as a presence context within the Scenario session rather than a separate root.                           |
| Item presence in the play context                      | `scenarioAvailableObjectReferenceSchema` in `packages/domain/src/campaign/scenario.ts` carries `sourceKind` (`campaign_asset` / `campaign_item` / `reusable_entity`), `expectedHolderCharacterId`, and is held in `scenarioSessionStateSchema.availableObjects`.                               |
| Visibility separate from presence                      | The same reference carries `visibility` (`players` / `gm_only`) as a field distinct from its membership in `availableObjects`. Presence is the membership; visibility is the field.                                                                                                            |
| Pickup as a canonical ownership transition             | `scenarioSessionAvailableObjectSchema.canPickUp`, the `item_transferred` event in `scenarioObjectiveHistoryEventTypeSchema`, and the campaign Item assign/unassign routes in `apps/api/src/routes/scenarios/campaignItemRoutes.ts`.                                                            |
| Canonical Item ownership, presence, equip state        | `CharacterEquipmentItem` in `packages/database/prisma/schema.prisma`: nullable `holderCharacterId` (unheld world Items are already expressible), `campaignContextId`, `locationId`, `carryMode`, `isEquipped`.                                                                                 |
| "Present with the Character" versus "stored elsewhere" | `CharacterStorageLocation.availabilityClass` (`with_you` / `elsewhere`) and `isAccessibleInEncounter`. This is exactly the usability gate section 7 requires; no new field is needed to express it.                                                                                            |
| Reveal without ownership                               | `ScenarioArtifactReference` with `state` `attached` / `published` / `withdrawn`, and `artifactAudienceSchema` (`gm_private` / `campaign` / `scenario`). Publishing is already a visibility act that transfers nothing.                                                                         |
| Player-visible Artifact projection                     | `ArtifactService.listVisible` in `packages/database/src/services/artifactService.ts` already unions Campaign-published Artifacts with Scenario-published references gated by `userHasPlayerScenarioAccess`.                                                                                    |
| Blackboard placement that owns nothing                 | The Blackboard `image_map` category in `packages/domain/src/campaign/blackboard.ts` references `artifactId` and carries a frozen snapshot. It already references rather than owns.                                                                                                             |
| Durable shared material surviving board removal        | `blackboardCommonDtoSchema` already separates `catalogue` (durable shared entries with their own state) from `layout.placements` (disposable board positions keyed by `entryId`). Removing a placement leaves the entry intact. See [section 8.3](#83-the-durable-shared-material-collection). |

Two consequences follow.

1. **No new domain primitive is introduced by this contract.** Where a slice
   needs more, it needs an additional member of an existing enum — for example
   an Artifact Reveal event type alongside `item_transferred` in
   `scenarioObjectiveHistoryEventTypeSchema` — or an additional representation
   link between two existing entities. Extending an existing enum or adding a
   reference between existing entities is not a new primitive.
2. **The absence of an Encounter-to-Artifact link is correct, not a gap.**
   Ruling D5 requires no persistent Encounter ownership for pure Artifacts. The
   Reveal is an act with a log entry and a visibility consequence, expressed
   through the existing Scenario publication state and the existing event log.

The one genuinely open modelling question — where an Item's attached Artifact
representations are recorded — is carried as a Product Owner decision in
section 12 rather than resolved here.

---

## 11. Proposed implementation slices

These are **proposals**. None is authorized by this document. Each must be sized
against then-current `dev`, must declare its hotspots against
[functional ownership](ownership.md#reserved-integration-hotspots), and must
carry its own acceptance examples.

> **Do not implement the whole Scenario Play Workspace as one oversized PR.**

Steps 1 to 5 of the GM workflow — upload, find, Scenario association,
inspection, and the player-visibility data layer — already work. The gap is the
in-play surface. `ScenarioPlayerPageContent.tsx` currently contains zero
references to Artifacts or the Blackboard.

### Slice S1 — Player Scenario surface shows revealed Artifacts

**Outcome.** A player in a live Scenario can see and inspect the Artifacts the
GM has published to that Scenario, without leaving the Scenario surface.

**Scope.** Consume the existing player-visible Artifact projection from the
player Scenario surface; list Revealed Artifacts; open them in the approved
full-viewport inspection pattern. This list is the first, read-only form of the
[durable shared-material collection](#83-the-durable-shared-material-collection),
and S1 establishes its player-facing presentation.

**Exclusions.** No Encounter-context Reveal. No Items. No Blackboard placement.
No new persistence. No change to the visibility projection itself.

**Likely surfaces.** `apps/web/app/(app)/campaigns/[campaignId]/scenarios/[scenarioId]/player/`,
`apps/web/src/features/artifacts/`, the existing artifact read routes.

**Dependencies.** None. This is the first slice.

**Product decision needed first.** No.

### Slice S2 — Active Encounter as contextual state in the Scenario workspace

**Outcome.** The Scenario Play Workspace makes the active Encounter obvious and
presents current-Encounter information in place, for both GM and player, without
a separate play destination.

**Scope.** Surface the active Encounter context, its player-facing situation,
participating PCs and visible NPCs inside the Scenario workspace; establish the
one-state/two-authorities pattern for the workspace.

**Exclusions.** Does not remove or rewrite the existing Encounter workspace
tooling. Does not change Encounter lifecycle, membership, or Combat. No Item or
Artifact work.

**Scope boundary from ruling PO-SPW-3.** **S2 is not widened by absorbing the
existing Encounter workspace tabs.** That tooling is retained as transitional
GM-only management tooling alongside the workspace; S2 surfaces the active
Encounter as contextual state and stops there. No new player-facing play
capability is added to the Encounter workspace by this slice or any other.
Later absorption or consolidation is separately scoped, after playtesting. See
[PO-SPW-3](#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling).

**Likely surfaces.** Scenario workspace shell and Scenario session projection;
the Campaign workspace/scenario orchestration hotspot.

**Dependencies.** Independent of S1 but shares the workspace shell; if both run,
name one integration owner for the shell.

**Product decision needed first.** No. PO-SPW-3 is settled and closed; it bounds
S2's scope rather than gating it.

### Slice S3 — Encounter-context Artifact Reveal

**Outcome.** A GM can Reveal an Artifact to the players currently in the active
Encounter, and that Reveal is visible in the workspace and recorded in the log.

**Scope.** A GM **Reveal** action scoped to the active Encounter, built on the
existing Scenario publication state and the existing event log; the
corresponding player-side presentation; Revealed material entering the
[durable shared-material collection](#83-the-durable-shared-material-collection).

**Exclusions.** **No persistent Encounter-to-Artifact ownership.** No transfer
of ownership, location, or Scenario association. No Item creation. **No player
"reveal".** Under ruling PO-SPW-2 there is no such operation: a player shares
and places already-accessible material, which is a different operation with a
different name. No player Artifact authoring.

**Likely surfaces.** Scenario/Artifact services and routes; Scenario event log;
the play workspace.

**Dependencies.** After S1 (needs the player-side Artifact presentation and the
durable collection it establishes) and S2 (needs an explicit active-Encounter
context). **No longer gated on any product decision.**

**Product decision needed first.** No. PO-SPW-2 is settled and closed, and S3 is
no longer gated on it. The Reveal must remain non-persistent as ruled; if an
implementation finds it cannot express the Reveal without persistent Encounter
ownership, that is a stop condition, not a design choice.

### Slice S4 — Items present in the play context

**Outcome.** The workspace shows the Items present in the current play context
with correct visibility, and an entitled player can pick up an available Item
through the normal canonical ownership transition.

**Scope.** Present-versus-visible presentation of the Scenario available-object
set; pickup through the existing canonical transition; GM control of an Item's
presence and visibility.

**Exclusions.** No new ownership system. No second Item model. No equipment-rule
changes. No Artifact attachment.

**Likely surfaces.** Campaign/Scenario Item routes, services, repositories and
UI — a declared reserved hotspot — plus the play workspace.

**Dependencies.** After S2. Independent of S1 and S3.

**Product decision needed first.** No.

### Slice S5 — Player play inventory as a Scenario-aware projection

**Outcome.** A player sees, in the workspace, the inventory they can actually
use now: canonical Character inventory filtered by presence in the current play
context, with equipped state shown from canonical state.

**Scope.** The projection and its presentation; the usability gate; honest
presentation of Items that exist but are stored elsewhere.

**Exclusions.** No second inventory store. No change to canonical equipment
authority, staleness, or reconciliation rules.

**Likely surfaces.** Scenario session projection; equipment read services; the
play workspace.

**Dependencies.** After S4, which establishes presence handling and pickup.

**Product decision needed first.** No.

### Slice S6 — Item-attached Artifact representation and Blackboard sharing

**Outcome.** An Item may carry attached Artifact representations, and **any
participant** can share a suitable Item or Artifact they can access and place it
on the Blackboard for shared inspection without changing anything canonical.

**Scope.** The representation link; opening an Item's attached Artifact from
play; sharing it and placing it on the board; any-participant removal from the
board; explicit non-mutation guarantees; removal that leaves the material in the
[durable shared-material collection](#83-the-durable-shared-material-collection)
and allows it to be placed back.

**Exclusions.** No Blackboard redesign. No ownership, location, or Scenario
association change. An Artifact never becomes an Item. No modelling of character
knowledge, character visibility, or in-world communication through Blackboard
state. No player Artifact authoring. Any-participant removal must not be wired
to the existing entry-level retract capability.

**Likely surfaces.** Item and Artifact domain/services; the Campaign Blackboard
hotspot; the play workspace.

**Acceptance requirements from ruling PO-SPW-1.** The representation link this
slice builds must satisfy the settled association semantics. It must:

1. allow an Item **zero, one or multiple** Artifact representations;
2. **support revision pinning**;
3. **carry attachment provenance**;
4. **not assume one-to-one**;
5. reuse an existing canonical association mechanism **only if that mechanism
   cleanly satisfies points 1 to 4**, and otherwise introduce a **dedicated
   Item-to-Artifact link entity/table** at this slice.

**A simple one-to-one Item-to-Artifact pointer field is not acceptable.** The
mechanism is this slice's choice within those semantics, not a decision it waits
for. See
[PO-SPW-1](#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics).

**Dependencies.** After S4 and S5, and after the durable shared-material
collection exists in player-facing form (established in S1; S3 extends it but is
not a prerequisite). **No longer gated on any product decision.**

**Product decision needed first.** No. PO-SPW-1 is settled and closed. What
remains is an acceptance requirement on this slice: if the semantics above
cannot be met by the mechanism chosen, that is a stop condition, not a licence
to fall back to a one-to-one pointer.

### Later bounded capability — player-created collaboration Artifacts

Ruling PO-SPW-2 records that players should eventually be able to create
Artifacts for collaboration — notes, plans, sketches, images or similar — and
share them on the Blackboard.

This is a **later bounded capability with its own slice and its own
authorization**. It is recorded here so the architecture preserves room for it,
not so that any slice above absorbs it.

Its recorded properties:

- Such Artifacts are **meta-level player material** unless separately associated
  with an in-world Item.
- Authorship and provenance **may** be recorded.
- Glantri **must not** impose character-level ownership or secrecy rules on
  collaboration material.
- They join the same durable shared-material collection rather than a parallel
  one.

> **Do not expand S2 or S3 to add player Artifact authoring.** Preserve the
> architecture so this capability can arrive as its own slice.

The concrete preservation requirements for the slices above are:

1. Sharing and placement are authored against **accessible material**, not
   against "GM-Revealed material", so a later author-side source needs no rework
   of the share path.
2. The durable shared-material collection is not specialised to GM-Revealed
   Artifacts.
3. Nothing in S1–S6 assumes the GM is the only origin of shared material.

This capability also remains within the deferral of new Blackboard kinds in the
[Campaign play lifecycle roadmap](../product/campaign-play-lifecycle-roadmap.md);
nothing here authorizes it.

### Ordering

```text
S1 revealed Artifacts (player Scenario surface; establishes the durable collection)
S2 active Encounter as contextual state
        S1 + S2 -> S3 Encounter-context Reveal
        S2      -> S4 Items present in the play context
                   S4 -> S5 player play inventory projection
                   S4 + S5 + durable collection
                       -> S6 attached representation + Blackboard sharing
```

**No slice is gated on a product decision.** All of PO-SPW-1, PO-SPW-2 and
PO-SPW-3 are settled and closed, so the ordering above contains only slice and
capability dependencies.

S1 and S2 may proceed in parallel with a named shell integration owner. S3 and
S4 may proceed in parallel once S2 lands. S6 is last because of its slice
dependencies, not because it waits for a decision.

**Effect of ruling PO-SPW-2 on this ordering.** PO-SPW-2 is settled and closed
and **now gates nothing**. S3 is no longer conditioned on it and needs no
GM-only narrowing to proceed. The ruling introduces one new ordering fact rather
than a new slice: the durable shared-material collection must be player-facing
before any slice can remove material from the Blackboard, so S6 depends on the
collection presentation established in S1. S3 extends the same collection with
Encounter-context Reveals but is not itself a prerequisite for S6. Because S6
already follows S1 in the graph, no new slice and no new parallelism constraint
is created. Player-created collaboration Artifacts are outside this ordering
entirely.

**Effect of rulings PO-SPW-1 and PO-SPW-3 on this ordering.** Both are settled
and closed and **neither gates anything**. PO-SPW-1 removes the last decision
edge from the graph: S6 is now conditioned on the association semantics recorded
as its acceptance requirements, which the slice satisfies rather than waits for.
PO-SPW-3 adds no edge at all; it bounds S2's scope so that the existing
Encounter workspace tabs are not absorbed into it. No new slice and no new
parallelism constraint is created by either ruling.

---

## 12. Product Owner decisions — all settled

**#268 has no remaining open Product Owner decisions.** PO-SPW-1, PO-SPW-2 and
PO-SPW-3 are all **settled and closed**, and no slice in section 11 is gated on
a product decision any more.

Each original question text is retained below rather than deleted, so the
history shows what was asked and how the ruling answered or reframed it.

### PO-SPW-1 — SETTLED: Item-to-Artifact representation requires association semantics

**Status:** **Settled and closed.**\
**Settled on:** 2026-09-21\
**Authority:** PRODUCT OWNER RULING recorded on
[#268](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/268),
"PRODUCT OWNER RULING — PO-SPW-1 and PO-SPW-3 SETTLED".\
**Gates:** **Nothing.** In particular, **S6 is no longer gated on this
decision.** S6 is now conditioned on the semantics below being met, which is an
acceptance requirement rather than a decision to wait for.

**The question as originally recorded**, retained as provenance:

> **PO-SPW-1 — Where an Item's attached Artifact representations are recorded**
>
> Section 4.3 approves that an Item may have attached Artifact representations.
> The recording mechanism is not settled. The plausible options are a reference
> from the Item to Artifact identity, a reference-table between the two existing
> entities, or reuse of an existing reference mechanism.
>
> Each is a link between two existing entities rather than a new primitive, so
> no stop condition is triggered. But the choice has permission, provenance, and
> revision-pinning consequences under
> [Artifact Management](artifact-management-package-import.md#82-consumers-reference-artifact-identity),
> so it is a product/architecture decision rather than a Builder choice.
>
> **Affects:** Slice S6.

**How it was settled.** The ruling does not name a table. It settles the
**required association semantics** and leaves the mechanism to the slice that
reaches the work, provided the mechanism satisfies them.

**What was ruled.** The Item-to-Artifact representation mechanism must:

1. allow an Item **zero, one or multiple** Artifact representations;
2. **support revision pinning**, in the sense of
   [Artifact Management §4.4](artifact-management-package-import.md#44-revision-pinning),
   while still referencing stable Artifact identity under
   [§8.2](artifact-management-package-import.md#82-consumers-reference-artifact-identity);
3. **carry attachment provenance**;
4. **not assume one-to-one**;
5. **reuse an existing canonical association mechanism only if that mechanism
   cleanly satisfies points 1 to 4**;
6. otherwise use a **dedicated Item-to-Artifact link entity/table**, introduced
   when the downstream slice reaches that work.

**A simple one-to-one Item-to-Artifact pointer field is not acceptable.**

The association records representation only. Under
[Artifact Management §6.4](artifact-management-package-import.md#64-no-implicit-ownership-transfer)
attaching, referencing or sharing transfers no ownership, and an attached
Artifact never becomes an Item.

**The mechanism is deliberately not chosen here.** This contract states the
semantics and does not depend on any particular implementation. A separate
change ([#271](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/271),
PR #275) introduced a `CampaignItemArtifactAttachment` link table and has since
been accepted and integrated into `dev`
(`5b034464abba4ecf55f1aeb15914d8f9d5ad9a87`). Its existence in `dev` does **not**
make it the canonical mechanism: S6 must evaluate it against the association
semantics above and may reuse it **only if it cleanly satisfies all of them**
(points 1 to 4); otherwise S6 introduces the dedicated Item-to-Artifact link
entity/table called for by point 6. Nothing in this contract is written against
`CampaignItemArtifactAttachment`.

**Scope of the ruling.** Contract and product documentation only. It authorizes
no runtime implementation, schema, or migration beyond what the existing slice
authorizations already permit.

### PO-SPW-2 — SETTLED: the Blackboard is meta-level player collaboration

**Status:** **Settled and closed.**\
**Settled on:** 2026-09-21\
**Authority:** PRODUCT OWNER RULING recorded on
[#268](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/268),
"PRODUCT OWNER RULING — PO-SPW-2 SETTLED: the Blackboard is meta-level player
collaboration".\
**Gates:** **Nothing.** In particular, **S3 is no longer gated on this
decision.**

**The question as originally recorded**, retained as provenance:

> **PO-SPW-2 — Whether a player may reveal, or only the GM**
>
> Section 8 permits both players and the GM to project onto the Blackboard.
> Section 4.4 describes reveal as a GM action. Whether a player may perform an
> Encounter-context reveal of an Artifact they legitimately hold, as distinct
> from projecting it onto the Blackboard, is not settled.
>
> **Affects:** Slices S3 and S6. Does not block S3 if S3 ships GM-only.

**How it was settled.** The ruling does not answer the question as put. It
**rejects the framing** that produced it. There is no single "reveal" whose
actor was undecided; there are two different operations that had been given one
name. The question dissolves once they are separated.

**What was ruled:**

1. **Core invariant.** Blackboard state is player discussion state, not
   game-world state. The Blackboard is outside the game world and must not be
   used to model character knowledge, Item ownership, character visibility, or
   in-world communication. Recorded as distinction D9 and in
   [section 8.1](#81-core-invariant).
2. **Two operations, two names.** GM **Reveal** controls whether protected
   GM-authored material becomes accessible. **Share** and **Place on the
   Blackboard** are what any participant does with material already accessible
   to them, and Glantri must not try to decide whether other players'
   characters could know or see it. Reusing `reveal` for both is prohibited in
   implementation, API, and UI. Recorded in
   [section 4.5](#45-reveal-and-share-are-two-different-operations).
3. **Any participant may add and any participant may remove.** Placement and
   removal are presentation only and mutate no game-world state. Recorded in
   [section 8.2](#82-who-may-act-and-what-it-changes).
4. **Durable material.** Deliberately Revealed or Shared material must not
   disappear because it is removed from the board. Recorded in
   [section 8.3](#83-the-durable-shared-material-collection), which also shows
   that the existing catalogue/placement separation already expresses it, so no
   new entity or domain primitive is introduced.
5. **Player-created collaboration Artifacts** are a later bounded capability,
   not part of S2 or S3. Recorded in
   [section 11](#later-bounded-capability--player-created-collaboration-artifacts).

**Scope of the ruling.** Contract and product documentation only. It authorizes
no runtime implementation beyond what the existing slice authorizations already
permit.

### PO-SPW-3 — SETTLED: the existing Encounter workspace is retained as transitional GM-only management tooling

**Status:** **Settled and closed.**\
**Settled on:** 2026-09-21\
**Authority:** PRODUCT OWNER RULING recorded on
[#268](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/268),
"PRODUCT OWNER RULING — PO-SPW-1 and PO-SPW-3 SETTLED".\
**Gates:** **Nothing.** It places a **scope boundary** on S2 rather than
blocking it.

**The question as originally recorded**, retained as provenance:

> **PO-SPW-3 — The fate of the existing Encounter workspace surface**
>
> The rulings establish that play happens in the Scenario Play Workspace and
> that no separate Encounter play page is created. The existing Encounter
> workspace and its tabs, documented in
> [Encounter Workspace](../product/campaign-scenario-encounter-workflows.md#encounter-workspace),
> are GM tooling that predates this contract.
>
> Whether that GM tooling is progressively absorbed into the workspace, retained
> as GM-only management alongside it, or left unchanged is a product decision.
> This contract does not remove it.
>
> **Affects:** Slice S2 scope.

**How it was settled.** **Option A is chosen:** retain it, alongside the
workspace, as transitional tooling.

**What was ruled:**

1. The existing Encounter workspace is **retained as transitional GM-only
   management tooling**. It is not removed.
2. It is **not a second play surface**. The **Scenario Play Workspace is
   canonical for in-play presentation**.
3. **No new player-facing play capability** goes into the Encounter workspace.
   New in-play capability belongs to the Scenario Play Workspace.
4. **S2 is not widened** by absorbing the existing Encounter workspace tabs.
   Recorded as a scope boundary on
   [S2](#slice-s2--active-encounter-as-contextual-state-in-the-scenario-workspace).
5. Later absorption or consolidation of that tooling is **separately scoped,
   after playtesting**, and is not authorized here.

**Scope of the ruling.** Contract and product documentation only. It authorizes
no runtime implementation beyond what the existing slice authorizations already
permit.

### Preserved by the 2026-09-21 rulings

The Blackboard semantics settled under PO-SPW-2 stand unchanged: **Reveal**,
**Share**, and **Place-or-remove** are three distinct operations, and the
Blackboard is meta-level player collaboration rather than game-world state.
Nothing in PO-SPW-1 or PO-SPW-3 weakens them.

---

## 13. Relationship to existing contracts

| Existing statement                                                                                                                                                             | Effect of this contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Campaign Management V2 §3.1](campaign-management-v2.md#31-no-separate-play-hierarchy) removes a separate Play navigation hierarchy.                                           | Consistent and extended. Play is the Scenario's own canonical surface; the active Encounter is contextual state within it rather than a further destination.                                                                                                                                                                                                                                                                                                                                      |
| [Campaign Management V2 §9](campaign-management-v2.md#9-blackboard-boundary) defers Blackboard redesign.                                                                       | **Still unchanged, and the deferral still stands.** Section 8 is strengthened by ruling PO-SPW-2 into an invariant plus a non-mutation and durability boundary, and it names who may act. It adds no board category, revision rule, layout behavior, or search behavior, so it remains a boundary statement rather than the deferred redesign.                                                                                                                                                    |
| [Canonical equipment in Scenario play](../product/campaign-scenario-encounter-workflows.md#canonical-equipment-in-scenario-play) defines the operational equipment projection. | Unchanged and relied upon. Section 7 is its play-facing presentation rule.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [Encounter Workspace](../product/campaign-scenario-encounter-workflows.md#encounter-workspace) describes Encounter as a workspace with its own tabs.                           | Superseded **for the in-play surface only**, now settled by ruling PO-SPW-3. The Scenario Play Workspace is canonical for in-play presentation. The existing Encounter workspace is **not removed**: it is **retained as transitional GM-only management tooling** alongside the workspace, is not a second play surface, and receives **no new player-facing play capability**. S2 is not widened to absorb its tabs. Later absorption or consolidation is separately scoped, after playtesting. |
| [Campaign play lifecycle roadmap](../product/campaign-play-lifecycle-roadmap.md) defers contextual Scenario Artifacts and Scenario-relevant Blackboard to later contracts.     | This is that later contract for the play surface. The roadmap's sequencing, hotspot, and authorization rules continue to apply; nothing here authorizes any roadmap case. Its deferral of new Blackboard kinds also covers player-created collaboration Artifacts, which section 11 records as a later bounded capability.                                                                                                                                                                        |
| [Artifact Management §6.4](artifact-management-package-import.md#64-no-implicit-ownership-transfer) states that referencing, sharing, or exposing transfers no ownership.      | Directly relied upon. Reveal, Share, and Blackboard placement are exactly such acts.                                                                                                                                                                                                                                                                                                                                                                                                              |
| [Artifact Management §8.2](artifact-management-package-import.md#82-consumers-reference-artifact-identity) requires consumers to reference stable Artifact identity.           | Directly relied upon. The durable shared-material collection and every Blackboard entry reference Artifact identity; neither holds an independent copy of the media.                                                                                                                                                                                                                                                                                                                              |
| [Shared Campaign Blackboard](../product/campaign-scenario-encounter-workflows.md#shared-campaign-blackboard) describes the shared catalogue, board layout, and entry states.   | Unchanged and relied upon. Section 8.3 identifies the existing catalogue/placement separation as the durable shared-material collection this contract requires, and section 8.2 distinguishes any-participant removal of a **placement** from the existing consequential entry-level removal.                                                                                                                                                                                                     |

No conflict was found with the canonical Item, Character, Scenario, or Encounter
domain models. Nothing in this contract changes them.

---

## 14. Verification expectations for authorized slices

Slices in this milestone change player-visible material, permission projection,
and canonical ownership. They therefore require fresh independent QA at an exact
PR head.

**Privacy and ownership are the sharp edges.** Every slice must prove:

1. a viewer never receives GM-private material, in payload as well as in UI;
2. no presentation action — Reveal, Share, Blackboard placement, inspection —
   mutates ownership, location, carry mode, equip state, or canonical Scenario
   association;
3. pickup uses the canonical ownership transition and remains coherent after
   reload;
4. an Item present but not visible does not leak, and an Item visible but not
   present does not become usable.

**Ruling PO-SPW-2 adds the following required proofs** for any slice that
touches the Blackboard or the shared-material collection:

5. **Placement mutates nothing.** Placing material on the Blackboard leaves
   Item ownership and location, Artifact ownership, Scenario and Encounter
   presence, GM visibility state, and Item-to-Artifact association byte-for-byte
   unchanged. Prove it against persisted state, not only against the UI.
6. **Removal mutates nothing and destroys nothing.** Removing material from the
   Blackboard likewise mutates no game-world state, does **not** undo a GM
   Reveal, and leaves the material in the durable shared-material collection,
   from which it can be reopened and placed back. Prove the round trip:
   share/place, remove, reopen from the collection, place again.
7. **Any participant, not only the GM.** A non-GM participant can add
   accessible material and can remove material another participant placed, and
   neither act requires GM authority.
8. **Reveal remains GM-only and remains the access boundary.** A player cannot
   reach unrevealed GM material through any share, placement, collection, or
   search path, in payload as well as in UI.
9. **No knowledge adjudication.** The implementation contains no check of
   whether another player's character could know or see shared material.
   Its absence is the required behavior, not a gap.
10. **Terminology separation.** `reveal` and its derivatives do not name any
    share, placement, or removal operation in routes, commands, event types,
    domain identifiers, or user-facing labels; and any-participant removal is
    not wired to the existing entry-level retract capability.

**Ruling PO-SPW-1 adds the following required proofs** for the slice that
implements Item-to-Artifact representation. They are expectations on that slice
when it is authorized; they authorize no implementation here:

11. **Multiple representations.** One Item can carry more than one Artifact
    representation at the same time, and each is independently openable from
    play. An Item with zero representations and an Item with exactly one both
    remain valid. Prove it against persisted state, not only against the UI.
12. **A pinned revision stays pinned.** Where a representation pins an Artifact
    revision, publishing a newer Artifact revision does not move the pinned
    representation; it continues to resolve to the pinned revision, including
    after reload. Prove that an unpinned representation and a pinned one behave
    differently under the same update.
13. **Attachment provenance is recorded and readable.** Each attachment records
    its own provenance — who attached it and when, at minimum — and an entitled
    viewer can read it. Provenance survives Reveal, Share, Blackboard placement
    and removal, and it is not reconstructed from current state.
14. **No one-to-one assumption anywhere.** No route, projection, schema, or UI
    path assumes a single Artifact per Item, and a one-to-one pointer field is
    not introduced. Attaching transfers no ownership, and an attached Artifact
    never becomes an Item.
