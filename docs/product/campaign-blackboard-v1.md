# Campaign Blackboard V1 — product/UI contract

## 1. Status and scope

**Status:** Product Owner approved, 2026-09-25. This is the **current V1 product/UI contract** for
the Campaign Blackboard. Implementation is **not** authorized by this document.

**Authority:** Product Owner ruling of 2026-09-25 on the Campaign Blackboard.

This is the compact Blackboard UI/workflow design pass that
[Live GM Scenario Play §5.1](live-gm-scenario-play.md#51-glantri-does-not-model-forgetting-in-v1)
records as still needed and does not perform.

### 1.1 Purpose

The Campaign Blackboard is a **persistent shared player workspace** for arranging and discussing
material that players deliberately choose to place on the table. It lets players:

- keep useful material visible across Scenarios and sessions;
- spatially group People, Items, Artifacts, Maps and player notes;
- deliberately share information they know with the rest of the table;
- accumulate additional shared information on existing material;
- independently inspect shared material without taking control of other players' screens.

**The Blackboard is Campaign-scoped, not Scenario-scoped.** It is a **collaborative player
surface**. It is **not** a GM planning surface, a representation of current Situation presence, or a
character-knowledge simulator.

### 1.2 What this contract does not do

- It does **not** restate the Blackboard's settled architectural boundary. The core invariant, who
  may act, non-mutation, and the durable shared-material collection are controlled by
  [Scenario Play Workspace §8](../architecture/scenario-play-workspace.md#8-blackboard-boundary)
  and
  [PO-SPW-2](../architecture/scenario-play-workspace.md#po-spw-2--settled-the-blackboard-is-meta-level-player-collaboration).
- It does **not** restate the Person, Item or Artifact domain model. Presentation layers, typed
  associations and Scenario overrides are controlled by
  [Content authoring, Scenario preparation and Artifact management](content-authoring-scenario-preparation-and-artifact-management.md).
- It does **not** redesign the live play surfaces. The player arena is
  [Player Play V1](../architecture/player-play-v1.md)'s and the GM surface is
  [Live GM Scenario Play](live-gm-scenario-play.md)'s.
- It does **not** select a realtime transport (see [section 23](#23-realtime-transport)).
- It does **not** authorize schema, migration, runtime or UI implementation, and it does not
  decompose into lanes.

---

## 2. Campaign persistence

A Campaign has **one shared Blackboard** in V1.

Blackboard content persists across Encounters; across Scenarios; across play sessions; and when the
player who originally posted material is absent.

> **Changing Scenario or Encounter does not clear or replace the Blackboard.**

**Removing a Person or Item from the current Situation has no effect on Blackboard material already
posted.**

**Removing a card from the Blackboard does not revoke player access, erase knowledge, change
Situation state or alter the canonical object.** This is the already-settled non-mutation and
durability behaviour of
[#268 §8.2](../architecture/scenario-play-workspace.md#82-who-may-act-and-what-it-changes) and the
durable shared-material collection of
[#268 §8.3](../architecture/scenario-play-workspace.md#83-the-durable-shared-material-collection),
restated here only as the board-level consequence, and it is the same rule as
[Live GM Scenario Play §5.1](live-gm-scenario-play.md#51-glantri-does-not-model-forgetting-in-v1).

---

## 3. Inspection is private; arrangement is shared

**This is the core interaction rule of the Blackboard, and the rest of this contract follows from
it.**

> **Inspection, navigation and zoom are private. Content, position and stacking are shared.**

| State       | What it covers                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Shared**  | Blackboard cards; information deliberately posted to those cards; attached and standalone player notes; card positions; card stacking/z-order. All players see the same. |
| **Private** | Which card the player is inspecting; their pan position; their zoom level; their local viewport; other purely local navigation state. Each player controls their own.    |

**Opening a card does not open it on anybody else's screen. There is no presenter-controlled shared
selection in V1.**

The rule governs private inspection ([section 11](#11-private-inspection)), board navigation
([section 15](#15-board-navigation)) and what the Change Log records
([section 18.2](#182-events-that-are-not-logged)).

---

## 4. Eligible Blackboard material

V1 supports:

1. **Person**
2. **Item**
3. **Artifact**
4. **Map**, through the appropriate player-safe Artifact/map representation
5. **Standalone player note**

Person, Item and Artifact/Map cards **refer to canonical material but contain only information
deliberately shared to the Blackboard**.

A standalone player note is **Blackboard-native content**. It does not create a canonical Artifact,
Story Note or other Campaign object.

That a Person is valid Blackboard material is already recorded at
[Live GM Scenario Play §5.2](live-gm-scenario-play.md#52-people-are-valid-blackboard-material).

---

## 5. Explicit sharing

**Blackboard access and player knowledge are not the same thing.**

> **Access determines what a player may post. It does not determine what the player must post.**

A player may deliberately post a **less revealing** presentation than the maximum information
available to them.

**Information becomes shared Blackboard content only through an explicit posting action.**

> **The Blackboard must never silently expose additional information merely because one or more
> players know it.**

---

## 6. Typed presentation sharing

Blackboard does **not** introduce a universal hierarchy of facts. Structured information is shared
using the **presentation vocabulary of the underlying domain**.

### 6.1 Person

A player may post any player-safe Person presentation available to them: **general/unidentified**;
**identified/recognized**; **additional player-safe illustration** where explicitly available. The
layers, their label/image/description slots and their player-safety are
[Content authoring §18.13](content-authoring-scenario-preparation-and-artifact-management.md#1813-the-canonical-person-presentation-layers)
and
[Campaign Material and Scenario Builder §3.1](campaign-material-and-scenario-builder-ui.md#31-the-canonical-presentation-label-and-texts);
Scenario overrides resolve per
[Content authoring §18.12](content-authoring-scenario-preparation-and-artifact-management.md#1812-the-scenario-presentation-overlay-shape).

**A player who knows the identified presentation may still choose to post only the general
presentation.**

### 6.2 Item

A player may post any player-safe Item presentation available to them: **general/unidentified**;
**identified/examined**; **additional player-safe representation** where explicitly available. The
layers are
[Content authoring §18.20](content-authoring-scenario-preparation-and-artifact-management.md#1820-item-presentation-layers-and-scenario-overrides)
and the representation roles that select their images are
[§18.25](content-authoring-scenario-preparation-and-artifact-management.md#1825-item-representation-roles).

**Richer private knowledge does not force richer Blackboard disclosure.**

### 6.3 Artifact / Map

> **Artifacts do not acquire an invented general/identified hierarchy merely for Blackboard.**

The player may post the accessible player-safe Artifact presentation/content. Where the Artifact
domain explicitly provides multiple player-safe versions or representations, the player may choose
among those they are allowed to access. A Map is posted through its appropriate player-safe
Artifact/map representation.

### 6.4 Unstructured information

**V1 does not provide a generic per-fact selection system.** Knowledge, hypotheses, interpretation
or remembered details not represented by an existing typed presentation are shared through a
**player note** ([section 16](#16-player-notes)).

> **Structured game presentation is shared through typed presentation layers; unstructured player
> knowledge or interpretation is shared through notes.**

---

## 7. Adding a new card

From an eligible resource, a player can choose **Add to Blackboard**.

> **The posting UI shows only presentation choices that the player is allowed to share.**

Worked example — _Post Captain Varro_:

- **General presentation** — "The officer";
- **Identified presentation** — "Captain Varro";
- optional attached note.

**The player explicitly chooses the presentation level to post.**

After posting: the card appears in the **posting player's** current visible board area; **other
players' viewports do not move**; the shared card becomes part of the Campaign Blackboard.

---

## 8. Existing cards and incremental disclosure

**The same canonical resource should not normally create another Blackboard card.**

If a player tries to post a Person, Item or Artifact already represented, the normal interaction is
**Already on Blackboard — add information to the existing card**. The player can then add a richer
structured presentation they are entitled to share; add an attached note; or cancel.

**Adding richer information is additive disclosure.** Example: the Blackboard initially contains
"The officer"; a player later deliberately posts the identified presentation; the existing card now
also contains "Captain Varro" and its identified presentation.

The compact board preview may thereafter use the **richest structured presentation actually shared
to the Blackboard**. **It must not use information that remains private to individual players.**

V1 does not require deliberate duplicate cards for the same canonical resource.

---

## 9. No silent Blackboard updates

> **The Blackboard represents what players have deliberately shared, not a live projection of their
> maximum current knowledge.**

**New knowledge never silently changes existing Blackboard content** — not Person recognition, not
discovery of an Item's identity, not a changed Scenario-specific presentation, not later access to
richer information.

**Existing Blackboard content remains as posted until a player explicitly enriches it** through
[section 8](#8-existing-cards-and-incremental-disclosure).

### 9.1 Knowledge-update indication

When a player's accessible information becomes richer, the application **should make that player
aware** that new shareable information is available — for example _"New information available: The
officer — You now recognize this person as Captain Varro."_ with `Add to Blackboard`.

**This indication is private.** It:

- does **not** inform other players that the player learned something;
- does **not** itself modify the Blackboard;
- does **not** automatically post the richer information;
- may lead directly to the existing-card enrichment flow.

**The player remains free to share nothing or to share a lower-detail presentation.**

A **durable-enough** local `New information` indication may accompany transient feedback, so that
important updates are not lost merely because the player missed a short-lived message.

---

## 10. Card previews

Cards on the full board are **compact and readily identifiable**, so players can recognize material
and understand spatial relationships without opening every card.

A preview normally contains an image or thumbnail where useful; the posted player-facing
label/title; a short posted description or identifying text where useful; and an indication that
notes are attached.

> **The preview must use only information actually shared to the Blackboard.**

Different resource types may have different appropriate card presentation, but the board remains
visually coherent.

---

## 11. Private inspection

Clicking or tapping a card **privately** opens the full Blackboard version of that card for the
current player. Inspection may show a larger image/map; all structured information actually shared
to the Blackboard; associated player notes; and appropriate text/content.

**Inspection is local UI state** ([section 3](#3-inspection-is-private-arrangement-is-shared)). It
must not change anybody else's screen; alter a shared board selection; change z-order merely
because the card was read; or reposition the card.

When inspection closes, the player returns to their previous board viewport and sees the **latest
shared board state** — other players may have moved or updated cards meanwhile.

---

## 12. Spatial board model

The Blackboard is a **large bounded spatial surface**, substantially larger than a normal viewport.
**It is not an infinite canvas in V1.**

Players can pan independently; zoom independently; drag cards freely; arrange cards into meaningful
clusters; and overlap cards.

**Spatial arrangement is itself meaningful collaborative expression** — players might place a
Person, Item and document close together to suggest a possible relationship. **V1 does not require
a formal grouping object merely to represent such a cluster.**

---

## 13. Overlap and stacking

Cards may overlap like physical cards on a table, supporting piles of material; clearing working
space without deleting cards; and assembling temporary discussion groups.

**V1 does not introduce a formal Stack domain object.** Stacking is represented by card position,
overlap and shared z-order.

- **Clicking/tapping a card for inspection does not change z-order.**
- **Dragging a card brings it to the front.**
- Explicit `Bring to front` and `Send to back` operations may be provided.

The most recently manipulated card therefore naturally sits on top of an overlapping pile.

---

## 14. Card sizing

Normal object cards use **predictable compact board footprints** in V1. **Arbitrary freeform
resizing is not required**; private inspection provides the large view needed for detailed reading.

This keeps spatial grouping predictable, stacking understandable, and the shared board free of
domination by arbitrarily enlarged cards.

Resource types such as Maps may use an appropriate recognizable thumbnail on the board while still
opening into a larger private inspection view.

---

## 15. Board navigation

**Board pan and zoom are private** ([section 3](#3-inspection-is-private-arrangement-is-shared)).
Returning to the Blackboard within a session normally restores the player's own recent viewport. A
**Fit board** action allows the player to recover orientation and see the current occupied board
area.

**Adding a new card does not force other players' screens to navigate to it.** A later notification
mechanism may offer another player a private `Show` action that navigates only that player's
viewport.

---

## 16. Player notes

### 16.1 Attached note

A note associated with an existing Blackboard card. Example — _Captain Varro_: "Vidar: Why did he
already know about the cellar?"; "Jenny: Could his family be connected to the seal?"

### 16.2 Standalone note

A separate spatial Blackboard card, for example _"Who killed Marcus? — Vidar"_. Standalone notes
can be freely placed and stacked like other cards.

### 16.3 Collaboration and attribution

V1 **may** allow any player to edit a shared player note. **The original author should normally
remain identifiable.** Where inexpensive, the UI may also identify the most recent editor — for
example `Vidar · edited by Jenny`.

V1 does **not** require note ownership permissions; rich-text collaboration; revision history; or
simultaneous-document merge semantics.

> **Notes are Blackboard content, not canonical Person, Item or Artifact data.**

---

## 17. Multiplayer conflict behavior

V1 does not require sophisticated collaborative locking:

- **card movement may use last completed move wins**;
- **note edits may use last saved edit wins**.

No conflict-resolution dialog is required for ordinary V1 collaboration. A future implementation
may add a lightweight transient indicator such as `Jenny is moving this`, but this is **not** a V1
requirement.

---

## 18. Blackboard Change Log

The Blackboard includes a restricted **Blackboard Change Log** at the bottom of the surface. **It
follows the visual and interaction conventions of existing Glantri log panels rather than
introducing a new log UI grammar**: compact rows; newest entries at the bottom; normal application
timestamp treatment; **auto-scroll while the user is already following the latest entry**; **no
forced downward scroll when the user has deliberately scrolled back**; clickable resource
references where useful; and existing collapse/expand and scrolling conventions where applicable.

### 18.1 Logged events

Meaningful **shared** Blackboard content changes: card added; card removed; structured information
added to an existing card; attached note added; note materially edited; note removed; standalone
note added, edited or removed.

Examples: _"Jenny added Captain Varro"_; _"Vidar added information to Captain Varro"_; _"Astrid
added a note to Royal Warrant"_.

### 18.2 Events that are not logged

**Spatial housekeeping is not logged**: drag; stacking; bring-to-front/send-to-back; zoom; pan;
private inspection. Those actions would create excessive noise. This follows directly from
[section 3](#3-inspection-is-private-arrangement-is-shared) — private navigation is not shared
state, and arrangement changes are visible on the board itself.

### 18.3 Scope

The Change Log is **Campaign-scoped** like the Blackboard. It provides useful recent shared
activity, but **it is not an archival audit ledger**. Exact retention/pagination policy is
implementation detail unless a later requirement makes it material.

**Private knowledge updates do not appear in the shared Blackboard Change Log** unless the player
subsequently shares something to the Blackboard.

---

## 19. Relationship to Activity

> **Blackboard Change Log and Activity have different purposes, and the two concepts must remain
> distinct.**

| Record                    | Records                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| **Activity**              | the durable player-safe narrative record of **what happened in the fiction** |
| **Blackboard Change Log** | meaningful changes to **the shared tabletop workspace**                      |

**Adding a card or rearranging shared investigative material does not automatically create an
Activity entry.**

Activity itself is unchanged by this contract. Its projection rules are
[Live GM Scenario Play §9](live-gm-scenario-play.md#9-historical-activity), and its two settled
event kinds are `scenario_announcement`
([Campaign Material and Scenario Builder §8.1](campaign-material-and-scenario-builder-ui.md#81-publication-creates-a-scenario_announcement-activity-event))
and `person_identity_revealed`
([§7.4.1](campaign-material-and-scenario-builder-ui.md#741-only-a-change-during-play-is-history)).
This contract adds no Activity event kind.

---

## 20. Future cross-screen Game Messages

A later general **Game Messages** mechanism may transiently surface relevant events regardless of
which screen or tab a player is viewing — for example _"Jenny added Captain Varro to the
Blackboard."_; _"The GM shared a new map."_; _"You now recognize the officer as Captain Varro."_;
_"An Encounter has started."_

**This future layer is presentation infrastructure, not a new source of truth.** Its inputs come
from authoritative underlying domain events and state changes: Blackboard changes; recognition
changes; GM sharing; Encounter lifecycle.

> **The Blackboard must not become responsible for implementing the cross-screen notification
> subsystem itself. Game Messages are deferred from Blackboard V1.**

---

## 21. Relationship to Situation and player access

Three concepts remain distinct, as recorded at
[Live GM Scenario Play §5](live-gm-scenario-play.md#5-durable-player-access-and-the-blackboard-relationship):

1. **Current Situation presentation** — what is currently perceived in play.
2. **Player-accessible information** — information the player is entitled to know or access.
3. **Blackboard-shared information** — information players have deliberately placed into the common
   workspace.

A Person may leave the Situation while their Blackboard card remains. An Item may be picked up,
concealed or moved while its Blackboard card remains. An Artifact may remain on the Blackboard
after its originating Scenario is finished. Presence is typed per resource and there is no universal
`present` state
([Content authoring §18.22](content-authoring-scenario-preparation-and-artifact-management.md#1822-no-universal-presence-state)).

**Glantri does not model forgetting in V1** merely because material is no longer currently present.

---

## 22. Privacy and disclosure invariants

> **These are privacy boundaries, not merely UI preferences.** A Blackboard implementation **must**
> preserve every one of them, and they are the privacy-projection surface that
> [Authority and Information Projection](../architecture/information-authority-and-projection.md)
> governs.

- **Private knowledge does not leak onto the Blackboard automatically.**
- **A player can post only information they are authorized to access.**
- **A player may deliberately choose a less revealing presentation.**
- **Posting richer information is an explicit sharing action.**
- **Private inspection does not change shared state.**
- **Private knowledge-update notifications reveal nothing to other players.**
- **Blackboard must not expose GM-only dossier, notes, hidden associations or other private metadata
  through labels, previews, links or association data.**

---

## 23. Realtime transport

The collaborative Blackboard will eventually require sufficiently responsive synchronization for
shared movements and content changes. The repository carries **no realtime transport today** and
liveness is **client polling**.

**V1 product design selects no transport.** The required decision is already recorded at
[Content authoring §18.26](content-authoring-scenario-preparation-and-artifact-management.md#1826-realtime-synchronization-is-an-explicit-architecture-decision),
and it gates **the strongly synchronized multiplayer Blackboard interaction layer** on the same
terms.

**It blocks nothing here.** Documentation and decomposition of Blackboard functionality may
proceed.

> **The transport mechanism must not change the product semantics defined in this contract.**

---

## 24. V1 non-goals

**These are explicit non-goals. They carry the same weight as the scope above, and nothing in this
contract may be read as authorizing them.**

| Not built in V1                                                                      |
| ------------------------------------------------------------------------------------ |
| **Scenario-specific boards**                                                         |
| **Personal or private boards**                                                       |
| **GM-only hidden Blackboard layers**                                                 |
| **Drawing tools** and **freehand annotation**                                        |
| **Arrows or connectors**, and **relationship graphs**                                |
| **Formal grouping objects** and **formal Stack domain objects**                      |
| **Nested canvases**                                                                  |
| **Arbitrary card rotation**                                                          |
| **Rich-text document editing**                                                       |
| **Version history for player notes**                                                 |
| **Character-by-character knowledge enforcement**                                     |
| **Automatic sharing of newly learned information**                                   |
| **Automatic synchronization to current Situation presentation**                      |
| **Presenter-controlled shared card inspection**                                      |
| **Wiki functionality**                                                               |
| **Storyline editing** and **Campaign Material editing**                              |
| **Generalized fact-selection or knowledge-atom modeling**                            |
| **Cross-screen Game Messages** ([section 20](#20-future-cross-screen-game-messages)) |

These may be considered later based on actual play experience.

---

## 25. Core V1 acceptance examples

A conforming implementation must support at least these behaviors.

| Behavior                            | Example                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persistent board**                | Jenny posts a map on Monday; Jenny does not play Friday; the map remains on the same Campaign Blackboard for everyone.                                              |
| **Deliberate lower-detail sharing** | Vidar recognizes Captain Varro; he chooses to post the general presentation "The officer"; the Blackboard does not disclose "Captain Varro".                        |
| **Incremental disclosure**          | Jenny later knows Varro's identity; she adds the identified presentation to the existing card; the shared card now makes that richer information available to all.  |
| **No silent upgrade**               | Vidar later discovers additional information about Varro; the existing card remains unchanged until someone explicitly posts the new information.                   |
| **Private inspection**              | Vidar opens the Royal Warrant and reads it; Jenny continues looking at another part of the board; neither player's viewport changes because of the other's.         |
| **Spatial collaboration**           | Jenny drags Varro next to the warrant; the shared board position changes for everyone; Vidar's zoom level and viewport remain his own.                              |
| **Stacking**                        | Several cards overlap; dragging one brings it to the top; merely opening another card to read it does not change the pile.                                          |
| **Notes**                           | Vidar attaches "Why did he know about the cellar?" to Varro; Jenny may edit the shared note; the note remains Blackboard content rather than canonical Person data. |
| **Change log**                      | Adding Varro and later adding his identity create Blackboard Change Log entries; dragging Varro around the board does not.                                          |
| **Knowledge notification**          | Jenny newly recognizes Varro; Jenny privately receives an indication that richer information can be shared; no other player learns this from the notification.      |

---

## 26. Relationship to existing contracts

| Document                                                                                                                                                                                                                      | Relationship                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Scenario Play Workspace §8](../architecture/scenario-play-workspace.md#8-blackboard-boundary) and [PO-SPW-2](../architecture/scenario-play-workspace.md#po-spw-2--settled-the-blackboard-is-meta-level-player-collaboration) | **Controlling** for the Blackboard's architectural boundary: discussion state rather than game-world state, who may act, non-mutation, and the durable catalogue/placement separation. This contract is the product/UI design **inside** that boundary and changes none of it.                                                                                                                                                           |
| [Campaign Management V2 §9](../architecture/campaign-management-v2.md#9-blackboard-boundary) and [#268 §8.4](../architecture/scenario-play-workspace.md#84-not-a-blackboard-redesign)                                         | Record that broader Blackboard product work was deferred **until actual use establishes a need**, and that the boundary statements are not themselves the design pass. This contract is that later product design; it authorizes no implementation.                                                                                                                                                                                      |
| [Live GM Scenario Play §5](live-gm-scenario-play.md#5-durable-player-access-and-the-blackboard-relationship)                                                                                                                  | **Controlling** for the Situation / player-accessible / Blackboard three-way distinction and for the rule that Blackboard removal revokes no access and alters no history. Its §5.2 permission for a card to carry the identified presentation is exercised **only** through the explicit posting of [section 8](#8-existing-cards-and-incremental-disclosure); [section 9](#9-no-silent-blackboard-updates) admits no automatic update. |
| [Content authoring, Scenario preparation and Artifact management](content-authoring-scenario-preparation-and-artifact-management.md)                                                                                          | **Controlling** for the Person and Item presentation layers (§18.12, §18.13, §18.20, §18.25), typed presence (§18.22) and the realtime architecture decision (§18.26). This contract adds no presentation layer and no override mechanism.                                                                                                                                                                                               |
| [Campaign Material and Scenario Builder](campaign-material-and-scenario-builder-ui.md)                                                                                                                                        | **Controlling** for the Person and Item presentation layers as authored and inspected, and for the two settled Activity event kinds. Campaign Material editing remains a [non-goal](#24-v1-non-goals) of this surface.                                                                                                                                                                                                                   |
| [Player Play V1 §12.2](../architecture/player-play-v1.md#122-blackboard)                                                                                                                                                      | Places the Blackboard as one of the five Play views and adds no board semantic. Unchanged.                                                                                                                                                                                                                                                                                                                                               |
| [Shared Campaign Blackboard](campaign-scenario-encounter-workflows.md#shared-campaign-blackboard)                                                                                                                             | Describes the **currently implemented** shared surface — its entry categories, shared search, revision state and pinning. This contract defines the V1 target and does not restate, extend or retire that description; reconciling the two is implementation-lane work under the controlling-sources rule.                                                                                                                               |
| [Authority and Information Projection](../architecture/information-authority-and-projection.md)                                                                                                                               | Server-side projection authority for [section 22](#22-privacy-and-disclosure-invariants). A viewer never receives GM-private material through the Blackboard.                                                                                                                                                                                                                                                                            |
| [Maps / Spatial Play](../architecture/maps-spatial-play.md)                                                                                                                                                                   | The Map view's own authority. A Map reaches the Blackboard only through its player-safe Artifact/map representation.                                                                                                                                                                                                                                                                                                                     |
| [Product & Presentation Principles](product-presentation-principles.md)                                                                                                                                                       | Presentation and privacy principles this surface inherits.                                                                                                                                                                                                                                                                                                                                                                               |
