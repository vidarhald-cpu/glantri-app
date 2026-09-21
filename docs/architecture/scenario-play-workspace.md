# Scenario Play Workspace — Durable Product/Architecture Contract

## 1. Status and scope

**Portfolio area:** #119 Artifact Management / #227 Campaign Management V2\
**Milestone:** Scenario Play Workspace\
**Architecture state:** Product Owner approved; implementation not authorized\
**Date recorded:** 2026-09-21\
**Recorded against:** `dev@57be80043461d065a61c462a1b511601e1a261e1`\
**Source of authority:** [#268 Scenario Play Workspace](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/268),
PRODUCT OWNER RULINGS — 2026-09-21

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

These eight distinctions are the substance of this contract. Every slice,
review, and QA verdict in this milestone is measured against them.

| #   | Distinction                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------- |
| D1  | **Scenario** is the canonical play workspace. It answers _where are we playing?_                                     |
| D2  | **Encounter** is active contextual state **within** the Scenario. It answers _what is happening right now?_          |
| D3  | **Item** is a physical game-world object with presence, ownership, and equipment state, in the canonical Item model. |
| D4  | **Artifact** is a media/reference representation.                                                                    |
| D5  | An Item **may have attached Artifact representations**; a pure Artifact needs **no persistent Encounter ownership**. |
| D6  | **Presence is not visibility.** Revealing does not move something; picking it up does.                               |
| D7  | **Blackboard is presentation only.** Projection changes nothing canonical.                                           |
| D8  | **Player play inventory is a Scenario-aware projection** of canonical Character inventory, not a second inventory.   |

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

A physical game-world object may have one or more Artifacts attached as its
representation. Attachment is a representation link. It does not make the
Artifact an Item, and it does not make the Item media.

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
  **encounter-context reveal/share action** directed at the players currently in
  play.

This settles the earlier question in both directions: yes to Encounter-level
association for Items, no to persistent Encounter ownership for pure Artifacts.

---

## 5. Presence versus visibility

**Present** means physically or currently in the play context.\
**Visible** means players are allowed to know about or see it.

They are independent axes. An Item may be present and hidden, present and
visible, or visible in a representation while not present at all.

> **Revealing something does not move it. Picking it up does.**

Consequences:

- A reveal action changes only who may know or see. It never changes holder,
  location, carry mode, equip state, or canonical Scenario association.
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
- revealed or shared Artifacts and clues;
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

The Blackboard remains a **presentation and collaboration surface, not an
ownership or presence model**. Players and the GM may project suitable Items or
Artifacts onto it for shared inspection.

Worked examples:

- A PC carrying a physical map Item opens its attached map Artifact and projects
  it. The Item stays in the PC's inventory.
- The GM reveals a sword image while the sword remains on the floor. The sword's
  presence and holder are unchanged.
- A clue Artifact is shared without becoming anyone's possession.

**Blackboard projection must NOT:**

- transfer ownership;
- change Item location;
- change canonical Scenario association;
- turn an Artifact into an Item.

This is a boundary statement, not a Blackboard redesign. The deferral in
[Campaign Management V2 §9](campaign-management-v2.md#9-blackboard-boundary)
stands, as does the existing shared-surface behavior in
[Shared Campaign Blackboard](../product/campaign-scenario-encounter-workflows.md#shared-campaign-blackboard).

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

| Requirement                                            | Existing model that expresses it                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encounter as contextual state inside Scenario          | `scenarioSessionParticipantPresenceSchema` in `packages/domain/src/campaign/scenarioSession.ts` is a discriminated union over `scenario` and `encounter`, already modelling Encounter as a presence context within the Scenario session rather than a separate root. |
| Item presence in the play context                      | `scenarioAvailableObjectReferenceSchema` in `packages/domain/src/campaign/scenario.ts` carries `sourceKind` (`campaign_asset` / `campaign_item` / `reusable_entity`), `expectedHolderCharacterId`, and is held in `scenarioSessionStateSchema.availableObjects`.     |
| Visibility separate from presence                      | The same reference carries `visibility` (`players` / `gm_only`) as a field distinct from its membership in `availableObjects`. Presence is the membership; visibility is the field.                                                                                  |
| Pickup as a canonical ownership transition             | `scenarioSessionAvailableObjectSchema.canPickUp`, the `item_transferred` event in `scenarioObjectiveHistoryEventTypeSchema`, and the campaign Item assign/unassign routes in `apps/api/src/routes/scenarios/campaignItemRoutes.ts`.                                  |
| Canonical Item ownership, presence, equip state        | `CharacterEquipmentItem` in `packages/database/prisma/schema.prisma`: nullable `holderCharacterId` (unheld world Items are already expressible), `campaignContextId`, `locationId`, `carryMode`, `isEquipped`.                                                       |
| "Present with the Character" versus "stored elsewhere" | `CharacterStorageLocation.availabilityClass` (`with_you` / `elsewhere`) and `isAccessibleInEncounter`. This is exactly the usability gate section 7 requires; no new field is needed to express it.                                                                  |
| Artifact reveal/share without ownership                | `ScenarioArtifactReference` with `state` `attached` / `published` / `withdrawn`, and `artifactAudienceSchema` (`gm_private` / `campaign` / `scenario`). Publishing is already a visibility act that transfers nothing.                                               |
| Player-visible Artifact projection                     | `ArtifactService.listVisible` in `packages/database/src/services/artifactService.ts` already unions Campaign-published Artifacts with Scenario-published references gated by `userHasPlayerScenarioAccess`.                                                          |
| Blackboard projection that owns nothing                | The Blackboard `artifact` category in `packages/domain/src/campaign/blackboard.ts` references `sourceArtifactId` and carries a frozen snapshot plus placements. It already references rather than owns.                                                              |

Two consequences follow.

1. **No new domain primitive is introduced by this contract.** Where a slice
   needs more, it needs an additional member of an existing enum — for example
   an Artifact reveal event type alongside `item_transferred` in
   `scenarioObjectiveHistoryEventTypeSchema` — or an additional representation
   link between two existing entities. Extending an existing enum or adding a
   reference between existing entities is not a new primitive.
2. **The absence of an Encounter-to-Artifact link is correct, not a gap.**
   Ruling D5 requires no persistent Encounter ownership for pure Artifacts. The
   reveal is an act with a log entry and a visibility consequence, expressed
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
player Scenario surface; list revealed Artifacts; open them in the approved
full-viewport inspection pattern.

**Exclusions.** No Encounter-context reveal. No Items. No Blackboard. No new
persistence. No change to the visibility projection itself.

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

**Likely surfaces.** Scenario workspace shell and Scenario session projection;
the Campaign workspace/scenario orchestration hotspot.

**Dependencies.** Independent of S1 but shares the workspace shell; if both run,
name one integration owner for the shell.

**Product decision needed first.** No, but section 12 decision PO-SPW-3 shapes
how far the existing Encounter surface is folded in.

### Slice S3 — Encounter-context Artifact reveal

**Outcome.** A GM can reveal an Artifact to the players currently in the active
Encounter, and that reveal is visible in the workspace and recorded in the log.

**Scope.** A reveal/share action scoped to the active Encounter, built on the
existing Scenario publication state and the existing event log; the
corresponding player-side presentation.

**Exclusions.** **No persistent Encounter-to-Artifact ownership.** No transfer
of ownership, location, or Scenario association. No Item creation.

**Likely surfaces.** Scenario/Artifact services and routes; Scenario event log;
the play workspace.

**Dependencies.** After S1 (needs the player-side Artifact presentation) and
S2 (needs an explicit active-Encounter context).

**Product decision needed first.** No, provided the reveal remains
non-persistent as ruled. If an implementation finds it cannot express the reveal
without persistent Encounter ownership, that is a stop condition, not a design
choice.

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

### Slice S6 — Item-attached Artifact representation and Blackboard projection

**Outcome.** An Item may carry attached Artifact representations, and a PC or GM
can project a suitable Item or Artifact onto the Blackboard for shared
inspection without changing anything canonical.

**Scope.** The representation link; opening an Item's attached Artifact from
play; projecting it; explicit non-mutation guarantees.

**Exclusions.** No Blackboard redesign. No ownership, location, or Scenario
association change. An Artifact never becomes an Item.

**Likely surfaces.** Item and Artifact domain/services; the Campaign Blackboard
hotspot; the play workspace.

**Dependencies.** After S4 and S5. **Blocked on product decision PO-SPW-1.**

**Product decision needed first.** Yes.

### Ordering

```text
S1 revealed Artifacts (player Scenario surface)
S2 active Encounter as contextual state
        S1 + S2 -> S3 Encounter-context Artifact reveal
        S2      -> S4 Items present in the play context
                   S4 -> S5 player play inventory projection
                   S4 + S5 + PO-SPW-1 -> S6 attached representation + projection
```

S1 and S2 may proceed in parallel with a named shell integration owner. S3 and
S4 may proceed in parallel once S2 lands. S6 is last and is gated on a product
decision.

---

## 12. Remaining Product Owner decisions

### PO-SPW-1 — Where an Item's attached Artifact representations are recorded

Section 4.3 approves that an Item may have attached Artifact representations.
The recording mechanism is not settled. The plausible options are a reference
from the Item to Artifact identity, a reference-table between the two existing
entities, or reuse of an existing reference mechanism.

Each is a link between two existing entities rather than a new primitive, so no
stop condition is triggered. But the choice has permission, provenance, and
revision-pinning consequences under
[Artifact Management](artifact-management-package-import.md#82-consumers-reference-artifact-identity),
so it is a product/architecture decision rather than a Builder choice.

**Blocks:** Slice S6.

### PO-SPW-2 — Whether a player may reveal, or only the GM

Section 8 permits both players and the GM to project onto the Blackboard.
Section 4.4 describes reveal as a GM action. Whether a player may perform an
Encounter-context reveal of an Artifact they legitimately hold, as distinct from
projecting it onto the Blackboard, is not settled.

**Affects:** Slices S3 and S6. Does not block S3 if S3 ships GM-only.

### PO-SPW-3 — The fate of the existing Encounter workspace surface

The rulings establish that play happens in the Scenario Play Workspace and that
no separate Encounter play page is created. The existing Encounter workspace and
its tabs, documented in
[Encounter Workspace](../product/campaign-scenario-encounter-workflows.md#encounter-workspace),
are GM tooling that predates this contract.

Whether that GM tooling is progressively absorbed into the workspace, retained
as GM-only management alongside it, or left unchanged is a product decision.
This contract does not remove it.

**Affects:** Slice S2 scope.

---

## 13. Relationship to existing contracts

| Existing statement                                                                                                                                                             | Effect of this contract                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Campaign Management V2 §3.1](campaign-management-v2.md#31-no-separate-play-hierarchy) removes a separate Play navigation hierarchy.                                           | Consistent and extended. Play is the Scenario's own canonical surface; the active Encounter is contextual state within it rather than a further destination.                |
| [Campaign Management V2 §9](campaign-management-v2.md#9-blackboard-boundary) defers Blackboard redesign.                                                                       | Unchanged. Section 8 states a non-mutation boundary, not a redesign.                                                                                                        |
| [Canonical equipment in Scenario play](../product/campaign-scenario-encounter-workflows.md#canonical-equipment-in-scenario-play) defines the operational equipment projection. | Unchanged and relied upon. Section 7 is its play-facing presentation rule.                                                                                                  |
| [Encounter Workspace](../product/campaign-scenario-encounter-workflows.md#encounter-workspace) describes Encounter as a workspace with its own tabs.                           | Superseded **for the in-play surface only**. Play is the Scenario Play Workspace. The existing GM Encounter tooling is not removed by this contract; see decision PO-SPW-3. |
| [Campaign play lifecycle roadmap](../product/campaign-play-lifecycle-roadmap.md) defers contextual Scenario Artifacts and Scenario-relevant Blackboard to later contracts.     | This is that later contract for the play surface. The roadmap's sequencing, hotspot, and authorization rules continue to apply; nothing here authorizes any roadmap case.   |
| [Artifact Management §6.4](artifact-management-package-import.md#64-no-implicit-ownership-transfer) states that referencing, sharing, or exposing transfers no ownership.      | Directly relied upon. Reveal and Blackboard projection are exactly such acts.                                                                                               |

No conflict was found with the canonical Item, Character, Scenario, or Encounter
domain models. Nothing in this contract changes them.

---

## 14. Verification expectations for authorized slices

Slices in this milestone change player-visible material, permission projection,
and canonical ownership. They therefore require fresh independent QA at an exact
PR head.

**Privacy and ownership are the sharp edges.** Every slice must prove:

1. a viewer never receives GM-private material, in payload as well as in UI;
2. no presentation action — reveal, share, projection, inspection — mutates
   ownership, location, carry mode, equip state, or canonical Scenario
   association;
3. pickup uses the canonical ownership transition and remains coherent after
   reload;
4. an Item present but not visible does not leak, and an Item visible but not
   present does not become usable.
