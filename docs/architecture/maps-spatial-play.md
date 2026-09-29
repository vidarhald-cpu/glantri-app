# GLANTRI — MAPS / SPATIAL PLAY

## Durable Product / Architecture Contract

**Portfolio area:** #118 Maps / Spatial Play\
**Product milestone:** Map Workspace V1\
**Architecture status:** Ready\
**Implementation status:** Future / activation-gated\
**Amended:** Product Owner Maps ruling of **2026-09-26** (ruling points 1-13);
see [section 1.1](#11-the-2026-09-26-maps-ruling)\
**Amended:** Product Owner live map sketching ruling of **2026-09-29**; see
[section 1.2](#12-the-2026-09-29-live-map-sketching-ruling)

---

# 1. Status and scope

This contract defines the durable product architecture for **#118 Maps / Spatial Play**.

It establishes the common conceptual model for interactive spatial content across:

1. world / campaign / regional Maps;
2. area / settlement / dungeon / subregion Maps;
3. tactical / encounter / combat Maps.

These are different **roles and scales of Map**, not separate fundamental Map types.

This contract intentionally does not define implementation-specific:

- storage;
- migrations;
- APIs;
- source ownership;
- file paths;
- current runtime integration;
- branch or PR structure.

It also deliberately leaves tactical and VTT-like mechanics outside **Map Workspace V1**.

The purpose of this contract is to allow #118 to remain conceptually stable until activation, at which point only a short preflight against then-current development architecture should be required.

## 1.1 The 2026-09-26 Maps ruling

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner.
**Scope:** documentation only. It authorizes no implementation and does not
activate #118.

The Product Owner Maps ruling of 2026-09-26 is recorded **in place** throughout
this contract rather than as a separate appendix. It amends:

- [section 2](#2-controlling-map-definition) — a Map is a canonical
  **Campaign-scoped** domain object, and the Map's purpose is **illustrative**;
- [section 7](#7-marker-model) — live placements, their transience, and
  player-facing marker treatment;
- [section 8](#8-layer-model) — Layers carry **visual representations**, and the
  replacement-versus-new-layer rule;
- [section 9](#9-visibility-and-sharing-model) — **the material reversal**: Map
  knowledge is **Character-scoped**, and player-safe classification is
  **eligibility**, not disclosure;
- [section 13](#13-editing-and-update-model) — authored Map content versus live
  placement state;
- [section 16](#16-durable-domain-boundaries) — a Map is not an Item;
- [section 17](#17-explicitly-deferred-tactical-and-spatial-mechanics) — the
  remaining V1 non-goals;
- [section 9.11](#911-map-disclosure-and-the-shared-activity-record) — how a
  subset disclosure meets the shared Activity record, applying an already-settled
  rule;
- [section 19](#19-resolved-po-decisions) and
  [section 20](#20-remaining-po-decisions) — the new resolved decisions, and the
  confirmation that **no new open decision** arises.

The content-intake half of the same ruling is recorded at
[Content authoring, Scenario preparation and Artifact management §18.38](../product/content-authoring-scenario-preparation-and-artifact-management.md#1838-one-intake-session-for-many-kinds-of-material)
onward, **not here**.

## 1.2 The 2026-09-29 live map sketching ruling

**Status:** **SETTLED FOR V1, 2026-09-29.** **Authority:** Product Owner.
**Scope:** documentation only. It authorizes **no implementation**, **no
dispatch**, and **no dependency installation**, and it does not activate #118.

The Product Owner ruling of 2026-09-29 admits **in-app GM drawing as an
authoring path into the ordinary Map facility**, and refines — it does **not**
reverse — the replacement-versus-new-information rule of
[section 8.2](#82-replacement-versus-new-knowledge). Like the 2026-09-26 ruling,
it is recorded **in place** throughout this contract. It amends:

- [section 2.3](#23-one-map-facility-many-authoring-paths) — imported, sketched
  and mixed Maps are **one Map facility**;
- [section 6](#6-coordinate-model) — a **stable Map-local coordinate frame**
  that supports **expansion**;
- [section 7.8](#78-retained-placement-arrangements) through
  [section 7.10](#710-viewer-camera-is-individual-view-state) — retained
  placement arrangements, explicit placement with live marker updates, and
  independent viewer cameras;
- [section 8.2](#82-replacement-versus-new-knowledge) — **the D1 disclosure
  ruling**, which preserves Character-specific disclosure while establishing
  that a layer is a **disclosure unit**, not a Map version;
- [section 8.3](#83-a-visual-representation-may-be-authored-in-app) — publication
  of a GM-authored image into an ordinary visual layer;
- [section 13](#13-editing-and-update-model) — the narrow private-source versus
  published-image boundary, which is **not** Map branching or revision history;
- [section 17](#17-explicitly-deferred-tactical-and-spatial-mechanics) — the
  amended exclusion of drawing tools, and the exclusions retained;
- [section 19](#19-resolved-po-decisions) and
  [section 20](#20-remaining-po-decisions) — the new resolved decisions, and the
  confirmation that **no new open decision** arises.

The editor-specific authoring workflow — tools, tablet use, draft handling and
the evaluation posture toward a candidate editor — is recorded at
[Live map sketching](../product/live-map-sketching.md), **not here**. **The Map
model is not duplicated there**; that document references this contract for all
common Map behaviour.

> **No editor or drawing library is canonically mandated by this contract.**

---

# 2. Controlling Map definition

A **Map is a persistent interactive spatial object**.

It provides an authored spatial context in which information can be:

- positioned;
- organized;
- referenced;
- navigated;
- selectively exposed to players, **per Character**
  ([section 9.6](#96-map-knowledge-is-character-scoped)).

A Map is distinct from:

- an Artifact;
- Campaign/runtime state;
- Story or Narrative content;
- Combat state.

A Map may use an Artifact for visual presentation, but its identity and spatial structure do not depend on that Artifact.

The common conceptual Map model consists of:

- stable Map identity;
- descriptive metadata;
- broad spatial role;
- normalized Map-local coordinate space;
- optional background Artifact;
- Layers;
- spatial markers;
- Map-to-Map links;
- visibility and sharing state.

A Map remains valid even when no background Artifact exists.

## 2.1 A Map is a canonical Campaign domain object

**Amended 2026-09-26.**

A Map is a **persistent Campaign-scoped spatial/story resource**. Examples
include:

- building and site plans;
- tactical encounter illustrations;
- settlement Maps;
- regional Maps;
- schematic spatial diagrams.

A Map:

- has **stable identity independent of any Scenario**;
- may be associated with **multiple Scenarios and Encounters**;
- remains **reusable throughout the Campaign**;
- is **not inherently a Combat object**;
- does **not** derive its identity from the image file representing it, per
  [section 4](#4-map-identity-model).

> **Scenario and Encounter association expresses relevance and use. It does not
> create a copy of the Map.**

Association also grants **no Character any knowledge** of the Map — see
[section 9.7](#97-how-a-character-acquires-map-knowledge).

A tactical encounter illustration is one **role and scale** of this single Map
model ([section 1](#1-status-and-scope)), not a separate Combat object.

## 2.2 Map purpose — illustration, not authoritative rules state

**Amended 2026-09-26.** This is the controlling product principle for Maps.

> **The Map is an illustration of the world in the game.** It exists to make the
> fiction visually engaging, understandable and memorable.

> **Map position and geometry are illustrative, not authoritative rules state.**

V1 Map coordinates must **not** determine:

- Combat legality;
- range;
- movement allowance;
- pathfinding;
- line of sight;
- rules-engine outcomes.

**The GM remains the adjudicator.** A rough sense of scale may be supported; V1
does not require precise tactical geometry.

This principle is **why**
[section 17](#17-explicitly-deferred-tactical-and-spatial-mechanics) defers what
it defers, and it is the standard every future spatial capability is measured
against — see [section 7.7](#77-player-facing-marker-treatment).

## 2.3 One Map facility, many authoring paths

**Added 2026-09-29.**

A Map may be authored from **imported imagery**, from an **in-app GM drawing**,
or from **both**. These are **authoring paths into one canonical Map facility**.

> **Map identity, coordinate frame, layers, placement, disclosure, player
> presentation and persistence do not depend on the authoring path.**

Published drawing content becomes an **ordinary visual layer representation**
([section 8.1](#81-layers-carry-visual-representations)); the editable drawing
source it came from remains **private GM authoring material** and is not
canonical Map, Character, Item or knowledge data
([section 8.3](#83-a-visual-representation-may-be-authored-in-app)).

> **In-app sketching is an authoring path into the ordinary Map facility. It is
> not a second Map engine, a second Map domain, or a canonical Sketch object.**

Drawing a door creates no canonical Door object, and drawing a room creates no
Place or SpatialRegion — see
[section 17](#17-explicitly-deferred-tactical-and-spatial-mechanics).

---

# 3. Map Workspace V1 product outcome

The first major Maps milestone is:

## Map Workspace V1

### Product outcome

A GM can create and organize persistent Maps, optionally give them Artifact backgrounds, place annotations, entity references and Map links in normalized space, organize them into Layers, navigate between Maps, and selectively disclose Map information to Characters.

**Amended 2026-09-26.** Disclosure is **per Character**, not one party-wide share
([section 9.6](#96-map-knowledge-is-character-scoped)).

Map Workspace V1 is about:

- persistent spatial organization;
- navigation;
- reference;
- controlled information sharing.

It is **not**:

- a tactical movement engine;
- a virtual tabletop;
- an automated visibility engine;
- a Combat positioning authority.

---

# 4. Map identity model

## Identity invariant

**Map identity is independent of presentation.**

A Map remains the same Map when:

- its background changes;
- marker positions change;
- markers are created or removed;
- Layers change;
- visibility changes;
- Map links change;
- descriptive metadata changes.

The background image does not define Map identity.

Likewise, an individual current arrangement of markers does not constitute a new Map identity.

This allows a persistent Map to evolve during a Campaign without forcing replacement objects or breaking existing links.

---

# 5. Hierarchy and graph model

Map relationships form a **navigable graph**, not a rigid single-parent hierarchy.

A Map may contain an anchored link to another Map.

Typical relationships may look conceptually like:

**Known World**\
→ **Glantri**\
→ **Glantri City**\
→ **Old Quarter**\
→ **Old Gatehouse**\
→ **Gatehouse Courtyard tactical Map**

However, this apparent hierarchy is a consequence of Map links, not an imposed tree structure.

The graph model permits:

- geographic drill-down;
- several overview Maps linking to the same Map;
- several entrances into one location;
- reuse of location or tactical Maps;
- alternative organizational views;
- future non-tree Map relationships.

A Map therefore does not require exactly one parent.

The same mechanism supports transitions between world, area and tactical scales.

---

# 6. Coordinate model

**Amended 2026-09-29.** Every Map has a **stable Map-local coordinate frame,
independent of image resolution, export crop and viewer camera**.

Conceptually:

- X and Y describe position within Map space;
- marker placement does not depend on source-image pixel dimensions;
- position remains stable when a representation changes resolution or crop;
- position remains stable regardless of any viewer's current pan and zoom;
- a Map without a visual representation still possesses the same coordinate
  frame.

The stable Map-local coordinate frame is the durable spatial foundation.

## Expansion

**Added 2026-09-29.**

The coordinate frame supports **expansion beyond the current drawn or imported
extent**, so a Map can grow as exploration or authoring proceeds.

> **Adding space, or replacing an image representation, must not rescale or
> reposition existing content or markers.**

**The storage representation of coordinates is an implementation concern.** This
contract requires the stability and expansion properties above, not a particular
encoding; physical units and tactical measurement remain unnecessary.

"Expansion" means users can continue into surrounding Map space without a fixed
paper edge. **It is not a promise of unlimited raster size**, and practical
image dimensions remain an implementation and evaluation concern
([Live map sketching](../product/live-map-sketching.md)).

## Not required in V1

The coordinate model does not yet require:

- metres;
- feet;
- geographic longitude or latitude;
- square-grid coordinates;
- hex coordinates;
- physical token dimensions;
- real-world distance calculations.

Those capabilities may later be layered onto the same spatial model.

## Background replacement

Replacing or revising a background does not automatically reposition markers.

If the new background depicts materially altered geography, repositioning markers is an explicit GM edit.

**Amended 2026-09-29.** That rule is **retained**.

> **Expansion alone is not materially changed geography.** Extending a Map into
> surrounding space requires no repositioning of existing content or markers.

**Amended 2026-09-26.** "Background" means the Map's **base visual layer** in the
sense of [section 8.1](#81-layers-carry-visual-representations). Replacing the
representation of **any** visual layer follows the same positional rule, and the
**knowledge** consequences of replacing a representation versus adding a layer
are governed by [section 8.2](#82-replacement-versus-new-knowledge).

---

# 7. Marker model

Map Workspace V1 uses a **bounded mixed marker model**.

A marker is Map-owned spatial content.

It may additionally reference another object, but a reference does not transfer domain authority to the Map.

V1 supports three conceptual marker types.

## 7.1 Annotation marker

An Annotation marker contains Map-owned information.

Examples include:

- labels;
- points of interest;
- GM notes;
- locations;
- warnings;
- descriptive symbols.

No external domain object is required.

The annotation exists as authored Map content.

---

## 7.2 Entity-reference marker

An Entity-reference marker points to an existing supported Glantri object.

The external domain object remains authoritative for:

- its identity;
- its domain or game state;
- its own permissions;
- its lifecycle.

The Map owns:

- spatial placement;
- Map-specific presentation;
- Map-specific visibility.

### Critical invariant

**An entity reference conveys identity linkage only.**

It does not automatically synchronize Map position with:

- Campaign location;
- Combat position;
- entity-location state;
- movement state in another domain.

For example:

Moving an NPC's Map marker in Map Workspace V1 does **not** move that NPC in Campaign or Combat state.

Future synchronization may be deliberately introduced, but it must remain an explicit cross-domain integration rather than being implied by the existence of the reference.

---

## 7.3 Map-link marker

A Map-link marker provides navigation from one Map to another.

Examples include:

- a settlement on a regional Map opening the settlement Map;
- stairs opening another dungeon-level Map;
- a room opening a tactical Map;
- a district opening a more detailed area Map.

Map-link markers provide the basic drill-down and Map-graph navigation model.

**Amended 2026-09-26.** A Map-link marker is eligible content like any other
marker. **Following a link presents the destination Map subject to the viewing
Character's own Map knowledge** ([section 9.6](#96-map-knowledge-is-character-scoped)),
and a link is **never** a party-wide grant of the destination Map. A Character who
does not know the destination acquires only what is actually projected to them
([section 9.7](#97-how-a-character-acquires-map-knowledge)).

---

## 7.4 Broken external references

External-reference failure must not silently destroy authored Map content.

If the external object referenced by an Entity-reference marker becomes unavailable:

- the marker remains on the Map;
- its authored Map identity remains recognizable;
- its spatial location remains;
- its Map-owned presentation may remain;
- the external reference is represented as unavailable or broken.

This preserves the separation between:

**authored spatial information**\
and\
**referenced-object lifecycle**.

---

## 7.5 Live placements

**SETTLED FOR V1, 2026-09-26.**

V1 supports **approximate current placement** of:

- player Characters;
- People/NPC identities;
- Items where useful.

The GM must be able to:

- add one Character/Person;
- **bulk-add** multiple Characters/People;
- add an Item;
- **drag and drop** placements;
- remove placements;
- show or hide placements where appropriate.

**An Item need not have a placement merely because it exists.** An unseen or
hidden Item may simply have **no position disclosed to any Character**, and the GM
may keep **GM-only placements** where useful.

> **A GM-only or hidden placement must be incapable of granting Map knowledge.**
> Only what is **actually projected** to a Character establishes anything
> ([section 9.7](#97-how-a-character-acquires-map-knowledge)).

**Placement eligibility is per Character in the same way Layer eligibility is**
([section 9.6](#96-map-knowledge-is-character-scoped)); there is no single
party-wide set of visible placements.

A placement is an Entity-reference marker in the sense of
[section 7.2](#72-entity-reference-marker), so its
[critical invariant](#critical-invariant) holds: moving a placement changes
**only** Map placement, never Campaign, Combat or entity-location state.

---

## 7.6 Placement state is normally transient

**SETTLED FOR V1, 2026-09-26.**

> **Map and Layer knowledge is persistent. Current placements are normally live
> contextual state, not permanent Character memory.**

**Opening a Map later from a Character's Knowledge Library shows the Layers that
Character knows — not a historical snapshot of where every actor and Item once
stood** ([section 9.7](#97-how-a-character-acquires-map-knowledge)).

If a past position matters narratively it belongs in an **explicit narrative
record** — a Discovery, a Note, Blackboard material, a Story Event or another
deliberate record:
[Content authoring §18.32](../product/content-authoring-scenario-preparation-and-artifact-management.md#1832-runtime-discoveries-from-skill-rolls-and-play),
[§18.33](../product/content-authoring-scenario-preparation-and-artifact-management.md#1833-gm-story-events) and
[§18.34](../product/content-authoring-scenario-preparation-and-artifact-management.md#1834-player-authored-notes-live-in-a-characters-knowledge-library).

**V1 does not require historical Map-position replay**
([section 17](#17-explicitly-deferred-tactical-and-spatial-mechanics)).

**Clarified 2026-09-29.** "Transient" here means **not Character memory and not
authored Map content**. It does **not** mean that the current arrangement is
discarded when the GM navigates away —
[section 7.8](#78-retained-placement-arrangements) records that it is retained.
Everything this section says about knowledge is unchanged by that retention.

---

## 7.7 Player-facing marker treatment

**SETTLED FOR V1, 2026-09-26.**

Character and People placements must be **visually distinguishable enough to be
useful**. V1 should support:

- **stable, recognizable markers** for player Characters;
- **label visibility controls** — labels shown continuously, hidden, or revealed
  on hover, tap or selection;
- **viewer-local label display state**;
- optional **local highlighting of the current player's own Character**.

> **Do not rely on colour alone for marker identity.**
> ([Product & Presentation Principles](../product/product-presentation-principles.md).)

**Player-facing labels must use the appropriate player-safe Person/identity
presentation**, resolved from the viewing Character's own recognition state —
[Content authoring §18.30](../product/content-authoring-scenario-preparation-and-artifact-management.md#1830-people-identities-and-metknown-state).

> **Marker appearance must not leak whether a Person is backed by a full
> Character/NPC record, is a lightweight Person, is an alias or identity, or is
> unresolved.**

That is the identity anti-leak invariant
([People, Artifacts and GM authoring §4.2](../product/people-artifact-and-gm-authoring-model.md#42-the-identity-anti-leak-invariant))
applied to Map markers, and the structural standard of
[Content authoring §18.31](../product/content-authoring-scenario-preparation-and-artifact-management.md#1831-player-projection-must-hide-preparation-mechanics).

Future capabilities **may** include custom personal tokens or portraits, facing
and directional indicators, declared movement/action overlays, and Combat-intent
visualization.

> **These remain illustrative and must not make the Map authoritative for
> Combat** ([section 2.2](#22-map-purpose--illustration-not-authoritative-rules-state)).

---

## 7.8 Retained placement arrangements

**SETTLED FOR V1, 2026-09-29.**

> **The latest explicitly authored placement arrangement belongs to the Map and
> survives navigating away and returning.** The GM can switch Maps and resume
> without repositioning objects.

This applies **equally to imported, sketched and mixed Maps**
([section 2.3](#23-one-map-facility-many-authoring-paths)). Retention covers
position and authored visibility, subject to current viewer permissions.

> **Navigation must not create, clear, duplicate or reposition markers.**

What retention is **not**:

- it is **not** authoritative entity location, Campaign runtime location or
  Combat state — the [critical invariant](#critical-invariant) of
  [section 7.2](#72-entity-reference-marker) is unchanged;
- it is **not** Character knowledge, and **retention grants no player
  visibility**. What a Character sees remains resolved from that Character's own
  Map knowledge ([section 9.6](#96-map-knowledge-is-character-scoped)) and is
  acquired only at actual projection
  ([section 9.7](#97-how-a-character-acquires-map-knowledge));
- it is **not** authored Map content, and adding, moving or clearing a retained
  placement is still **not a Map revision**
  ([section 13](#13-editing-and-update-model));
- it is **not** a movement record. **No historical movement or token replay is
  required**, and none may be inferred from retention
  ([section 17](#17-explicitly-deferred-tactical-and-spatial-mechanics)).

> **Knowledge Library and Blackboard projections do not automatically include a
> retained arrangement** ([section 7.6](#76-placement-state-is-normally-transient)
> and [section 9.10](#910-blackboard-sharing-of-maps)).

The same entity appearing in retained arrangements on two Maps is **not**
reconciled as physical travel.

---

## 7.9 Placement is explicit, and marker movement is immediate

**SETTLED FOR V1, 2026-09-29.**

> **Placement is an explicit act. Opening, importing, associating or publishing
> a Map never places an entity automatically.**

Neither does changing Scenario or Encounter, saving a private drawing source, or
publishing an image. This restates
[section 2.1](#21-a-map-is-a-canonical-campaign-domain-object) and
[section 9.7](#97-how-a-character-acquires-map-knowledge) for the placement case
and adds no automatic-placement capability.

> **An authorized movement of an existing marker updates permitted live viewers
> immediately, and independently of any drawing publication.**

Marker movement and image publication are separate updates. Neither implies the
other, and existing positioning authority is unchanged: **this grants players no
new movement or editing rights**
([section 10](#10-player-editing-boundary)).

---

## 7.10 Viewer camera is individual view state

**SETTLED FOR V1, 2026-09-29.**

> **Each viewer pans and zooms independently. Viewport is individual view state,
> not shared game state.**

- A drawing publication **does not move another viewer's camera**.
- A marker update **does not move another viewer's camera**.
- Receiving an update **does not switch a viewer away** from the Map they are
  looking at.

The player-facing form of this rule is
[Player Play V1 §12.1](player-play-v1.md#121-map).

---

# 8. Layer model

Map Workspace V1 contains a lightweight **Layer** concept.

A Layer provides:

- a name;
- ordering;
- a collection of markers;
- visibility state — **eligibility for player disclosure, not a party-wide
  visible state** ([section 9.2](#92-layer-visibility)).

Example organizational Layers might include:

- Settlements;
- Roads;
- Known Locations;
- NPCs;
- GM Secrets;
- Encounter Notes.

In V1, Layers are primarily:

- organizational constructs;
- information-sharing constructs.

They are not yet:

- terrain layers;
- collision layers;
- elevation layers;
- LOS layers;
- tactical movement layers.

Later spatial systems may add richer Layer semantics without redefining the fundamental Map model.

## 8.1 Layers carry visual representations

**Amended 2026-09-26.** A Layer is **not only a marker container**.

A Map consists of an **ordered set of layers**. A layer may carry a **visual
representation backed by an Artifact/image**, its own markers, or both.

V1 requires:

- **stack order**;
- **visibility and disclosure semantics**
  ([section 9](#9-visibility-and-sharing-model));
- a **player-safe base layer where one exists**;
- additional **player-safe or GM-only** layers;
- **optional future opacity** support.

Opacity may be represented as an optional display property. **V1 does not require
sophisticated layer compositing controls beyond basic ordering and visibility.**

> **V1 rule: one Map layer corresponds to one visual Artifact representation.**

Multi-file tiled or composite layers are **deferred**.

The optional background Artifact of
[section 2](#2-controlling-map-definition) is the **base visual layer** of this
stack, not a separate mechanism.

**A player-safe base layer is not mandatory at Map creation time.** The GM may
prepare a Map privately first.

> **However, a Character cannot receive a usable player projection of a Map until
> at least one player-safe layer exists.**

That is a missing representation, not a privacy failure — see
[section 9.8](#98-player-safe-eligibility-is-not-disclosure). A Map remains valid
with no visual layer at all
([section 14.6](#146-background-less-map)).

## 8.2 Replacement versus new knowledge

**Amended 2026-09-26.** These two operations must be distinguished carefully,
because confusing them leaks information.

| Operation                  | What it is                                                                                                  | Knowledge consequence                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Replace representation** | same layer identity, same information: a corrected, higher-resolution, restyled or otherwise improved image | Characters who already know the layer **continue to know it** and see the replacement                  |
| **Add layer**              | **new spatial or story information** — a secret passage, a cellar, a hidden room, a revealed structure      | **Nobody knows it** merely because they knew the base layer; it is learned only by explicit disclosure |

> **Hard rule: replacement changes representation; new information creates a new
> layer.**

**This prevents accidental knowledge leaks through image replacement.** A GM who
edits a secret passage into the base image instead of adding a layer has
disclosed it to every Character who knows the base layer.

During intake the GM chooses between the two **explicitly**, and the choice is
never inferred from a filename —
[Content authoring §18.41](../product/content-authoring-scenario-preparation-and-artifact-management.md#1841-map-intake--identity-layer-choice-and-eligibility).

### 8.2.1 The D1 disclosure ruling — a layer is a disclosure unit

**SETTLED FOR V1, 2026-09-29.** **Authority:** Product Owner. This ruling
**refines** the hard rule above. **It does not reverse it, and it authorizes no
relaxation of Character-specific disclosure.**

The question it answers: when a GM publishes an updated image that adds newly
drawn information, what happens to the Characters who already knew the previous
representation?

> **Preserve Character-specific disclosure. A publication that adds new
> fictional information does not automatically disclose that information to
> every Character who knew the previous representation.**

The two operations remain distinguished exactly as the table above states:

| Operation                                 | Disclosure consequence                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Representation correction/replacement** | May replace existing imagery **for its existing recipients**. Same information, same audience, no new knowledge.                                         |
| **New information**                       | Creates a **new disclosure unit with an explicit eligible audience**. Prior recipients of the previous representation learn nothing by that publication. |

> **Publishing pixels never silently redefines who knows what.**

#### What the ruling clarifies

A **layer is a disclosure unit**. It is **not** a Map version, and **not** a
record of a publication event.

- **New disclosure does not create another Map.** Players revisit **one stable
  Map identity** ([section 4](#4-map-identity-model)).
- **Each viewer receives one current composed presentation**, containing the
  information that Character is entitled to know
  ([section 9.6](#96-map-knowledge-is-character-scoped)). A player is never
  presented with a pile of near-duplicate historical maps.
- **Internal visual and disclosure layers may be consolidated when doing so
  preserves all meaningful audience and knowledge distinctions.** Consolidation
  that would merge two different eligible audiences, or that would deliver
  information to a Character not entitled to it, is **prohibited**.

> **Layer identity exists to preserve disclosure distinctions, not to preserve
> every publication event as a historical player-visible Map version.**

#### What the ruling does not permit

> **Do not introduce general Map revision or history UI**
> ([section 13](#13-editing-and-update-model) and
> [section 17](#17-explicitly-deferred-tactical-and-spatial-mechanics)).

> **Do not use pixel differencing, or any other automatic inference, to decide
> who knows what.** Whether a publication carries new information is a
> **deliberate GM choice**, exactly as it is at intake
> ([Content authoring §18.41](../product/content-authoring-scenario-preparation-and-artifact-management.md#1841-map-intake--identity-layer-choice-and-eligibility)).

A GM who draws a newly discovered room and publishes it to the Characters who
were present has made a **new disclosure to that subset**. A Character who was
absent learns nothing, and remains unable to receive that information until the
GM explicitly discloses it
([section 9.7](#97-how-a-character-acquires-map-knowledge)). Ambiguous audience
**fails closed** —
[Authority and Information Projection, projection rule 6](information-authority-and-projection.md#projection-rules).

## 8.3 A visual representation may be authored in app

**Added 2026-09-29.**

A visual layer's representation may be an **image generated by an in-app GM
drawing editor**, rather than an uploaded or imported file.

- The Map consumes that image through the **same representation and Artifact
  lifecycle as any other imagery**
  ([section 11](#11-map--artifact-relationship) and
  [section 12](#12-artifact-revision-behavior)). **The V1 rule that one Map layer
  corresponds to one visual Artifact representation is unchanged.**
- The **editable drawing source is retained separately as private GM authoring
  material**. It is not canonical Map, Character, Item or knowledge data, and
  **the published image must contain no embedded private editable source**.
- **A publish operation updates the image and its Map-space alignment together**,
  so that expansion or a changed crop never moves existing content
  ([section 6](#6-coordinate-model)).
- **Saving an unfinished source does not activate a published Artifact
  revision.** Only publication updates the player-facing representation, through
  the normal authorized lifecycle.
- **A failed publication retains the previous usable image and a recoverable
  private draft.** Image and alignment must never be left mismatched.

The disclosure consequence of a publication is governed by
[section 8.2.1](#821-the-d1-disclosure-ruling--a-layer-is-a-disclosure-unit), and
the private-source boundary by [section 13](#13-editing-and-update-model). The
editor-side workflow lives at
[Live map sketching](../product/live-map-sketching.md).

---

# 9. Visibility and sharing model

**MATERIALLY AMENDED 2026-09-26.** Map Workspace V1 controls **eligibility for
player display** at three levels, and resolves what a given player actually sees
against **that player's Character's Map knowledge**.

The effective hierarchy is:

> **Map access → Layer eligibility → optional Marker override**, projected
> through **the viewing Character's Map knowledge**

> **Eligibility and knowledge are two different things. Conflating them is the
> specific defect this section exists to prevent** —
> [section 9.8](#98-player-safe-eligibility-is-not-disclosure).

**Map knowledge is Character-scoped**
([section 9.6](#96-map-knowledge-is-character-scoped)).

> **Sections 9.1 to 9.3 describe the GM-side classification of a Map, its Layers
> and its markers. They do not describe one shared party-wide player view.**

> **EVERY statement anywhere in this contract that a Map, a Layer or a marker is
> "player-visible", "shared with players" or otherwise visible as one shared
> party-wide state is SUPERSEDED** by
> [section 9.6](#96-map-knowledge-is-character-scoped). This supersession is
> **not scoped to sections 9.1 to 9.3**; it reaches
> [section 2](#2-controlling-map-definition),
> [section 3](#3-map-workspace-v1-product-outcome),
> [section 7.3](#73-map-link-marker),
> [section 8](#8-layer-model),
> [section 10](#10-player-editing-boundary),
> the [section 14](#14-core-workflows) workflows and the
> [section 15](#15-acceptance-examples) acceptance examples.

> **Keep the distinction crisp: eligibility is a property of the Layer; knowledge
> is a property of the Character.**

---

## 9.1 Map access

A Map is either:

- **GM-only**; or
- **player-presentable** — the GM may present it to Characters.

If the Map itself is GM-only, its internal player-facing Layer or marker settings do not independently expose it.

**Amended 2026-09-26.** "Player-presentable" is a **GM-side classification, not a
disclosure**. It makes the Map available for the GM to present to Characters. It
grants no Character any knowledge on its own, and **it is not a party-wide
share**. Which Characters know the Map is governed by
[section 9.6](#96-map-knowledge-is-character-scoped) and
[section 9.7](#97-how-a-character-acquires-map-knowledge).

> **The phrase "shared with players" as a single party-wide state is
> superseded.**

---

## 9.2 Layer visibility

On a shared Map, each Layer may independently be:

- GM-only;
- player-visible.

This allows the GM to prepare public and secret information on the same Map.

Separate player and GM copies of the same underlying Map are therefore not required merely to maintain hidden information.

**Amended 2026-09-26.** A Layer's **player-visible** classification means the
Layer is **eligible** to be disclosed to Characters. It does **not** mean any
Character knows it, and it does **not** disclose it to the party.

> **Revealing a Layer to one Character does not reveal it to any other
> Character** ([section 9.6](#96-map-knowledge-is-character-scoped)).

A **GM-only** Layer is **ineligible** for Character disclosure until the GM
explicitly reclassifies it.

---

## 9.3 Marker visibility override

An individual marker may override its Layer's normal visibility when necessary.

This supports cases such as:

- revealing one previously secret location;
- hiding one exceptional marker on an otherwise visible Layer;
- progressive revelation without restructuring Layers.

Marker overrides are exceptions to Layer-level defaults rather than a replacement for Layer organization.

**Amended 2026-09-26.** A marker override adjusts **eligibility** for the marker
it names. Like Layer eligibility, it is not itself a disclosure to any Character.

---

## 9.4 Explicit V1 sharing boundary

V1 does **not** support arbitrary spatial-region sharing.

Deferred forms of visibility include:

- arbitrary polygons or regions;
- cropping sections of a background for sharing;
- LOS-derived visibility;
- tactical visibility cones;
- dynamic fog;
- position-derived revelation;
- automatic exploration-based revelation.

These require richer spatial mechanics and remain outside Map Workspace V1.

---

## 9.5 Permissions boundary for referenced entities

Sharing an Entity-reference marker does not grant unrestricted access to the referenced object.

A player may see the Map-facing representation that the GM has shared.

Any deeper access to the referenced object remains governed by:

- that object's domain rules;
- that object's permissions;
- the relevant player-facing presentation rules.

Maps must not become a permissions bypass.

There is therefore a durable distinction between:

> revealing that an entity exists at a particular place

and:

> revealing all information associated with that entity.

**Confirmed unchanged, 2026-09-26.** This boundary **already anticipates** the
2026-09-26 ruling that Map disclosure affects Map knowledge only
([section 9.9](#99-map-disclosure-affects-map-knowledge-only)) and that marker
presentation must not leak an entity's backing
([section 7.7](#77-player-facing-marker-treatment)). It is restated nowhere else
and required no change.

---

## 9.6 Map knowledge is Character-scoped

**SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner. **Supersedes** the
party-wide reading of [section 9.1](#91-map-access),
[section 9.2](#92-layer-visibility) and
[section 9.3](#93-marker-visibility-override), and of
[section 10](#10-player-editing-boundary) to the extent that "players consume what
is shared" implied **one shared player view**.

> **Map knowledge is Character-scoped**, consistent with
> [Content authoring §18.28](../product/content-authoring-scenario-preparation-and-artifact-management.md#1828-persistent-player-facing-knowledge-is-character-scoped).

**Different Characters may legitimately see different projections of the same
canonical Map.** There is **one canonical Map** and no per-Character copy.

| Viewer     | Projection                             |
| ---------- | -------------------------------------- |
| **GM**     | base Map + secret tunnel + hidden room |
| **Elena**  | base Map + secret tunnel               |
| **Marcus** | base Map only                          |

> **Revealing a Map Layer to one Character does not reveal it to any other
> Character unless they are also explicit recipients.**

A Map a Character knows lives in **that Character's Knowledge Library**. **There
is no party-wide Map knowledge store, and no lane may create one** —
[Content authoring §18.28](../product/content-authoring-scenario-preparation-and-artifact-management.md#1828-persistent-player-facing-knowledge-is-character-scoped)
authorizes no second shared knowledge record.

> **A leftover party-wide sentence is not a stop sign.** No lane stops on the
> ground that per-Character Map knowledge is deferred or outside V1 scope. The
> reversal recorded here is the current controlling position.

**This authorizes no per-Character presentation override.** Which projection a
viewer receives is a **visibility and projection** question resolved from that
viewer's Character-scoped Map knowledge, exactly as
[Content authoring §18.28](../product/content-authoring-scenario-preparation-and-artifact-management.md#1828-persistent-player-facing-knowledge-is-character-scoped)
resolves it for People. The prohibitions it preserves — no generic scope column,
no entitlement hierarchy, no override-resolution framework, no per-Character
**presentation override** — stand unchanged.

---

## 9.7 How a Character acquires Map knowledge

**SETTLED FOR V1, 2026-09-26.**

**There is no separate requirement to pre-share a Map before using it in play.**

> **In ordinary live play, presenting the player-safe Map to a Character is what
> establishes that Map for that Character.**

**Tightened 2026-09-26. The operative trigger is actual projection, not
placement.**

> **A GM-side placement alone grants no Map knowledge.** A Character acquires the
> Map and its Layers when the **player-safe Map is actually projected or shown to
> that Character**.

> **Hidden and preparatory GM placement must not leak knowledge**, and a GM-only
> placement must be **incapable** of granting it
> ([section 7.5](#75-live-placements)).

Placing a Character on a Map the GM has not yet shown that Character therefore
establishes nothing. Placement in ordinary live play is how projection normally
happens; it is not itself the grant.

- The Character acquires the **player-safe Map and Layers actually projected to
  them**, and the Map enters that Character's Knowledge Library.
- **Additional Layers are learned when explicitly disclosed to that Character.**
- Once learned, a Map or Layer **remains** in that Character's Knowledge Library
  under the V1 no-forgetting assumption.
- **Removing the Character from the live Map does not remove their Map
  knowledge.**
- **Scenario association alone grants no knowledge**
  ([section 2.1](#21-a-map-is-a-canonical-campaign-domain-object)).

### The knowledge and placement boundary

Acquisition happens **at projection**, yet **knowledge persists while placement
does not** ([section 7.6](#76-placement-state-is-normally-transient)).

> **Projection is the event that establishes knowledge. Placement is not the
> record of it, and a placement the Character never saw is not the grant of it.**

Opening the Map later shows the Layers that Character knows, not where anybody
stood. There is no contradiction between
[section 7.6](#76-placement-state-is-normally-transient) and this section.

---

## 9.8 Player-safe eligibility is not disclosure

**SETTLED FOR V1, 2026-09-26.**

> **Do not conflate "eligible for player display or disclosure" with "already
> known by one or more Characters".**

Worked example — a secret tunnel overlay:

| Property           | Value      |
| ------------------ | ---------- |
| player-safe        | **yes**    |
| currently known by | **nobody** |

- **Importing or authoring a player-safe Layer discloses it to no Character.**
- **GM-only Layers remain ineligible** for Character disclosure until the GM
  explicitly changes that classification.
- A Map with no player-safe Layer yet **cannot produce a usable player
  projection** ([section 8.1](#81-layers-carry-visual-representations)).

The intake form of this rule is
[Content authoring §18.41](../product/content-authoring-scenario-preparation-and-artifact-management.md#1841-map-intake--identity-layer-choice-and-eligibility),
and it is the Map form of the GM-private import default at
[Content authoring §11.6](../product/content-authoring-scenario-preparation-and-artifact-management.md#116-visibility-everything-begins-gm-private).

---

## 9.9 Map disclosure affects Map knowledge only

**SETTLED FOR V1, 2026-09-26.**

> **Revealing a Map or Map Layer must not silently modify any other knowledge
> domain.**

Revealing a secret tunnel:

- **grants** Map-Layer knowledge;
- does **not** reveal Person identity;
- does **not** grant Item knowledge;
- does **not** alter a Character's knowledge about actors merely because they are
  placed nearby.

> **Map consumes the player-safe projection of People, Items and other domains.
> It does not become an alternate knowledge or reveal engine for those domains.**

This is the knowledge-side statement of the permissions boundary already recorded
at [section 9.5](#95-permissions-boundary-for-referenced-entities). It is governed
by
[Authority and Information Projection](information-authority-and-projection.md#projection-rules)
and
[Content authoring §18.31](../product/content-authoring-scenario-preparation-and-artifact-management.md#1831-player-projection-must-hide-preparation-mechanics).

---

## 9.10 Blackboard sharing of Maps

**SETTLED FOR V1, 2026-09-26.** The product form is
[Campaign Blackboard V1 §6.3](../product/campaign-blackboard-v1.md#63-artifact--map).

**Maps are valid Blackboard material.**

> **A Character may share any subset of the Map Layers they personally know.**

Example: Elena knows base + secret tunnel + cellar. She may post base only; base
plus tunnel; or every Layer she knows.

- **The Blackboard Map contains exactly the Layers deliberately shared.**
- It **must not silently track later changes** in the posting Character's Map
  knowledge. If she later learns another Layer, the existing Blackboard Map
  **remains unchanged** until somebody explicitly enriches it —
  [Campaign Blackboard V1 §9](../product/campaign-blackboard-v1.md#9-no-silent-blackboard-updates).
- **Blackboard sharing copies no Map knowledge into any other Character's
  Knowledge Library** —
  [Campaign Blackboard V1 §9.2](../product/campaign-blackboard-v1.md#92-the-blackboard-is-shared-external-memory-not-knowledge-synchronization).
- **Blackboard Map cards do not automatically include current live placements**
  ([section 7.6](#76-placement-state-is-normally-transient)).

V1 may support **at least** a compact Map card and a larger, planning-sized Map
presentation on the board. **Arbitrary free resizing is not required** —
[Campaign Blackboard V1 §14](../product/campaign-blackboard-v1.md#14-card-sizing).

---

## 9.11 Map disclosure and the shared Activity record

**SETTLED FOR V1, 2026-09-26.** **Authority:** the Product Owner ruling of
2026-09-26 that settles how a Character-scoped disclosure meets the shared
Activity record, whose canonical home is
[Content authoring §18.37](../product/content-authoring-scenario-preparation-and-artifact-management.md#1837-character-scoped-knowledge-and-the-shared-activity-record).
**This section decides nothing of its own**; it applies that rule to Map-Layer
disclosure, over the Character-scoped knowledge model of
[Content authoring §18.28](../product/content-authoring-scenario-preparation-and-artifact-management.md#1828-persistent-player-facing-knowledge-is-character-scoped).

Two settled rules meet here, exactly as they do for Person recognition:

- **Activity is one shared player-safe narrative record**, and the exclusive
  source for a session recap —
  [Content authoring §9](../product/content-authoring-scenario-preparation-and-artifact-management.md#9-durable-history) and
  [§18.35](../product/content-authoring-scenario-preparation-and-artifact-management.md#1835-the-session-recap-privacy-boundary).
- **Map knowledge is Character-scoped**
  ([section 9.6](#96-map-knowledge-is-character-scoped)), and placement on a
  player-presentable Map is how a Character acquires it
  ([section 9.7](#97-how-a-character-acquires-map-knowledge)).

The consequence follows directly from the settled rule:

> **Disclosing a Map or Map Layer to one Character, or to a subset of Characters,
> grants that knowledge to those Characters' Knowledge Libraries and produces no
> shared Activity entry.**

> **A disclosure made to the complete intended participating audience is the
> shared case**, and may be recorded as shared narrative history.

If a Map Layer known privately **later becomes disclosed to the complete intended
audience**, that public transition is the shared case and may be recorded then.

**Shared Activity represents shared narrative knowledge.** Character-private Map
knowledge must not leak into it, nor into the shared recap source —
[Content authoring §18.35](../product/content-authoring-scenario-preparation-and-artifact-management.md#1835-the-session-recap-privacy-boundary).

### The escape valve for a narratively important discovery

> **If a Map discovery matters narratively, the GM may explicitly record a Story
> Event** ([Content authoring §18.33](../product/content-authoring-scenario-preparation-and-artifact-management.md#1833-gm-story-events)), which becomes
> player-safe Activity and recap input.

That is the **only** route by which a subset disclosure enters shared history, and
it is a **deliberate GM act**, never an automatic consequence of disclosing a
Layer.

> **Activity must not be used as a generic layer-visibility log.** Do not emit an
> Activity entry per Layer reveal, per placement change, or per viewer.

> **No lane stops on this question.** It is settled, and this section adds no
> Map-specific decision.

---

# 10. Player-editing boundary

Map Workspace V1 follows this model:

> **GM authors; players consume what is shared.**

General player Map editing and marker authoring are not part of V1.

The architecture nevertheless preserves room for later capabilities such as:

- private player pins;
- party annotations;
- player-to-GM information sharing;
- collaboratively edited Maps.

Those capabilities introduce additional ownership, visibility and collaboration semantics and should be designed explicitly when required rather than being implicitly included in V1.

**Amended 2026-09-26.** [M3](#m3--player-authored-markers) remains **deferred**:
V1 exposes no general player Map editing.

> **That is a V1 UI boundary, not an architectural constraint.** The underlying
> create, import, stage and validate machinery must **not** be built as
> intrinsically GM-only —
> [Content authoring §18.44](../product/content-authoring-scenario-preparation-and-artifact-management.md#1844-content-production-capability-is-actor-neutral).

What a player **sees** of a Map is not governed by this section at all; it is
governed by that player's Character-scoped Map knowledge
([section 9.6](#96-map-knowledge-is-character-scoped)).

---

# 11. Map ↔ Artifact relationship

The Map and Artifact domains remain separate.

## Artifact

An Artifact is an authored media/content asset.

It may contain:

- an uploaded map image;
- generated visual content;
- scanned source material;
- hand-drawn geography;
- another visual depiction.

## Map

A Map is a persistent interactive spatial context.

A Map may:

- have no Artifact;
- reference one Artifact as its background;
- later change its background;
- share the same background Artifact with another Map where appropriate.

An Artifact depicting a map does **not** automatically become an interactive Map.

Creating a Map using an Artifact:

- does not consume the Artifact;
- does not convert the Artifact;
- does not transfer Artifact ownership into the Map domain.

The Artifact remains an Artifact.

The Map remains a Map.

---

# 12. Artifact revision behavior

Map background behavior aligns with the approved Artifact-management architecture.

A normal Map background reference targets the **stable Artifact identity**.

It therefore resolves to that Artifact's **current active revision**.

**Amended 2026-09-26.** This applies to **every visual layer representation**
([section 8.1](#81-layers-carry-visual-representations)), not only to a base
background. Correcting a layer's logical Artifact flows through to the Map and
**changes no Character's knowledge**; supplying genuinely **new** spatial
information requires a **new layer**
([section 8.2](#82-replacement-versus-new-knowledge)).

Consequences:

- correcting the existing logical background Artifact does not require rebinding the Map;
- upgrading the same logical Artifact can flow through to the Map automatically;
- replacing the background with a genuinely different Artifact is an explicit Map edit.

Example:

A scanned city Map Artifact is cleaned up and a corrected active revision replaces its earlier revision.

The Map still references the same stable Artifact identity and therefore displays the corrected current revision without requiring a new Map/background binding.

By contrast, replacing that city depiction with a different commissioned map is an explicit choice of another Artifact.

## Deferred revision capability

Future requirements may justify pinning a Map background to a particular historical Artifact revision.

Artifact revision pinning is not required in Map Workspace V1.

---

# 13. Editing and update model

V1 Maps are **mutable persistent objects**.

Editing any of the following retains Map identity:

- marker locations;
- labels;
- markers;
- Layers;
- Layer order;
- visibility;
- Map links;
- background Artifact;
- descriptive metadata.

V1 does not require:

- draft/publish branching;
- Map revision history;
- rollback;
- historical snapshots.

Secret or unfinished content can remain:

- on a GM-only Map;
- on GM-only Layers;
- as hidden marker exceptions.

This avoids creating a separate publication/versioning subsystem merely to support normal GM preparation.

## Authored Map content versus live placement state

**Amended 2026-09-26.** The editable list above is **authored Map content**, and
it is persistent.

> **Live placements are not authored Map content.** They are live contextual state
> and are normally transient
> ([section 7.6](#76-placement-state-is-normally-transient)).

Editing authored content retains Map identity. Adding, moving or clearing a live
placement is not a Map revision at all, and V1 requires no history of it.

**Amended 2026-09-29.** A placement retained across navigation
([section 7.8](#78-retained-placement-arrangements)) is still live contextual
state under this section, and its retention creates no Map revision and no
history requirement.

## The private drawing source and the published image

**Added 2026-09-29.** Draft/publish branching, Map revision history, rollback and
historical snapshots **remain deferred**
([section 17](#17-explicitly-deferred-tactical-and-spatial-mechanics)). One
narrow, bounded boundary is nevertheless required for in-app drawing:

> **A GM drawing editor keeps a private working source separately from the last
> published image** ([section 8.3](#83-a-visual-representation-may-be-authored-in-app)).

> **This lightweight publication boundary does not establish general Map
> branching, rollback, or revision history — of the Map, of its layers, or of
> any other authored Map content.**

Its entire extent is: a private editable source; an explicit publish that
produces an ordinary image and its Map-space alignment; and a recoverable draft
when publication fails. It creates **no player-visible Map version**, **no
historical presentation**, and **no revision UI**. Publishing refreshes the
applicable player presentations without resetting any viewer's camera
([section 7.10](#710-viewer-camera-is-individual-view-state)), and marker
movement remains a separate immediate update
([section 7.9](#79-placement-is-explicit-and-marker-movement-is-immediate)).

Secret or unfinished **Map** content still belongs on a GM-only Map, on GM-only
Layers, or in hidden marker exceptions, as above.

---

# 14. Core workflows

## 14.1 Create Map

1. GM creates a Map.
2. GM names it.
3. GM chooses its broad role:
   - world/region;
   - area;
   - tactical.
4. GM optionally chooses an Artifact as background.
5. GM creates Layers as useful.
6. GM places markers.
7. GM saves the Map.

The Map is valid even if no background has been selected.

---

## 14.2 Build hierarchy and drill-down

1. GM opens a Map.
2. GM creates a Map-link marker.
3. GM selects another Map as its destination.
4. During use, the marker provides navigation to the linked Map.

The destination Map does not thereby acquire a required single parent.

---

## 14.3 Prepare shared and secret information together

1. GM prepares a Map containing both public and secret information.
2. GM marks the Map **player-presentable**.
3. Selected Layers are **player-safe**, that is **eligible** for disclosure.
4. Secret Layers remain GM-only and therefore **ineligible**.
5. Individual marker overrides may raise or lower eligibility for exceptional markers.
6. Eligibility may change later without creating another Map.
7. **Each Character learns only the Layers actually projected to that Character**
   ([section 9.7](#97-how-a-character-acquires-map-knowledge)).

**Amended 2026-09-26.** Steps 2 and 3 are **GM-side classification**, not a
party-wide share, and they disclose nothing on their own
([section 9.8](#98-player-safe-eligibility-is-not-disclosure)).

---

## 14.4 Place a referenced entity

1. GM creates an Entity-reference marker.
2. GM selects a supported existing Glantri object.
3. The Map records the reference.
4. The marker represents that object spatially.
5. Moving the marker alters only Map placement.
6. External Campaign, Combat or entity-location state remains unchanged.

---

## 14.5 Replace background

1. A Map already contains markers, Layers and sharing state.
2. GM explicitly chooses another Artifact as background.
3. Map identity remains unchanged.
4. Layers remain unchanged.
5. markers and positions remain unchanged.
6. sharing remains unchanged.
7. GM manually adjusts marker placement if the new depiction requires it.

---

## 14.6 Background-less Map

1. GM creates a Map without selecting an Artifact.
2. GM positions labels, Map links or other markers in normalized space.
3. The Map remains valid and navigable.
4. A background Artifact may be attached later without replacing the Map.

---

# 15. Acceptance examples

## 15.1 Regional Map with shared and hidden information

A regional Map contains:

- towns;
- roads;
- known landmarks;
- undiscovered ruins;
- enemy locations.

The Map is **player-presentable**.

The Towns, Roads and Known Locations Layers are **player-safe**, that is eligible
for disclosure. GM Secrets remains GM-only and ineligible.

Elena is shown the Map during play and learns the three eligible Layers. Marcus,
who was not present, knows none of them until the Map is projected to him.

**Accepted.**

**Amended 2026-09-26.** The earlier wording — "the Map is shared" and "the Layers
are player-visible" — described one party-wide player view and is **superseded**
by [section 9.6](#96-map-knowledge-is-character-scoped).

---

## 15.2 Marker visibility override

A hidden ruin sits on the GM Secrets Layer.

After the Characters discover it, the GM changes that marker's override so the
marker becomes **eligible** without making the rest of the Layer eligible, then
discloses it to the Characters who were there.

**Accepted.**

**Amended 2026-09-26.** Changing the override makes the marker eligible; it
discloses it to nobody by itself, and it reaches only the Characters the GM
actually discloses it to
([section 9.3](#93-marker-visibility-override) and
[section 9.8](#98-player-safe-eligibility-is-not-disclosure)).

---

## 15.3 Dungeon drill-down

A dungeon Map contains a staircase marker linked to another dungeon-level Map.

A chamber may separately contain a marker linking to a tactical encounter Map.

Navigation works through Map links rather than rigid parent-child ownership.

**Accepted.**

---

## 15.4 Entity-reference marker

A Map marker references an existing NPC.

The marker spatially represents the NPC.

Moving the marker does not modify Campaign or Combat state.

The NPC remains authoritative for its own identity and game information.

**Accepted.**

---

## 15.5 Permission-protected entity information

A Character who knows the Layer the marker sits on can see that NPC marker.

The marker identifies the NPC through the player-safe presentation resolved from
**that Character's own recognition state**
([section 7.7](#77-player-facing-marker-treatment)).

The NPC's GM-only information remains inaccessible unless the NPC domain independently permits player access.

**Accepted.**

---

## 15.6 Map without background

A GM creates an abstract location Map containing:

- five locations;
- labels;
- Map links;
- normalized spatial placement.

No Artifact is attached.

The result is still a valid Map.

**Accepted.**

---

## 15.7 Background replacement

A hand-drawn town background is replaced by a different commissioned Artifact.

The Map retains:

- identity;
- Layers;
- markers;
- visibility;
- links.

The GM adjusts marker locations if necessary.

**Accepted.**

---

## 15.8 Current Artifact revision update

A Map's background references Artifact A.

Artifact A receives a corrected active revision.

Because the Map references stable Artifact identity rather than a pinned V1 revision, the Map now resolves to Artifact A's corrected active revision without rebinding.

The Map remains the same Map.

**Accepted.**

---

## 15.9 Broken entity reference

A marker references an external object that later becomes unavailable.

The marker does not silently disappear.

Its authored Map information and position remain, while the external reference is identified as unavailable.

**Accepted.**

---

# 16. Durable domain boundaries

## Map ≠ Artifact

Artifact provides media/content.

Map provides interactive spatial context.

---

## A Map is not an Item

**Added 2026-09-26.**

An **Item** is a **physical object in the fiction**. A Map is a canonical spatial
resource the application uses to illustrate a place or a layout.

> **A physical parchment map, scroll, book or document discovered by Characters is
> an Item**, potentially with an associated Artifact that players can inspect.

That Item is **not automatically connected in the application to the canonical Map
domain object, even when both depict the same place.** Connecting them is an
explicit authoring act.

> **Do not conflate Items with Maps merely because both may visually depict a
> location.**

This matches the owning-domain semantics already recorded at
[Campaign Blackboard V1 §4.1](../product/campaign-blackboard-v1.md#41-owning-domain-semantics) and the
Item-versus-Artifact distinction of
[AI-assisted Artifact and Item intake](../product/ai-assisted-artifact-intake.md#item-versus-artifact).

---

## Map ≠ Campaign state

A Map may represent or reference Campaign objects spatially.

Map placement does not become authoritative Campaign runtime location merely because a marker exists.

---

## Map ≠ Combat

A tactical Map may eventually synchronize with Combat.

That does not collapse the domains.

Combat remains responsible for Combat state and rules.

Map remains responsible for spatial representation and interaction.

Any future synchronization must have an explicit authority contract.

---

## Map ≠ Story

Story owns narrative content and narrative structure.

Maps may be referenced from Story or may reference relevant objects, but Maps do not become the canonical narrative-content model.

---

## Marker ≠ referenced entity

A marker spatially represents or refers to an entity.

The referenced entity remains authoritative for itself.

Map owns only the marker's Map-specific concerns.

---

# 17. Explicitly deferred tactical and spatial mechanics

The following are outside Map Workspace V1:

- physical scale and distance;
- square grids;
- hex grids;
- grid snapping;
- token footprints;
- automated movement;
- movement allowance;
- pathfinding;
- facing;
- reach;
- elevation;
- terrain cost;
- walls and doors as collision mechanics;
- collision;
- line of sight;
- vision;
- fog of war;
- dynamic exploration and revelation;
- arbitrary regions and polygons;
- tactical zones;
- areas of effect;
- tactical measurement;
- range calculation;
- cover;
- concealment;
- Combat synchronization;
- automatic Combatant placement;
- initiative-linked movement;
- occupancy;
- automatic entity-location synchronization;
- multi-user tactical manipulation;
- player-owned annotations;
- Map revision history;
- rollback;
- general Map branching, and any Map revision-history UI;
- live collaborative annotation;
- simultaneous collaborative drawing;
- player drawing and player-authored Map imagery;
- VTT walls and lights;
- automatic Item positioning;
- historical placement or token replay;
- exact geospatial coordinates;
- a native iPad application;
- dependency on AI generation;
- a semantic Map-package importer;
- automatic Place or SpatialRegion creation.

**Amended 2026-09-26.** Six entries were added by the 2026-09-26 ruling: drawing
tools (since amended, below), live collaborative annotation, VTT walls and
lights, automatic Item positioning, historical placement or token replay, and
exact geospatial coordinates.

**Amended 2026-09-29.** The blanket exclusion of **drawing tools** is replaced.

> **Bounded GM image-authoring tools are permitted**
> ([section 2.3](#23-one-map-facility-many-authoring-paths) and
> [section 8.3](#83-a-visual-representation-may-be-authored-in-app)).

| Permitted                                                                       | Still deferred                                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| illustrative rectangles, lines, freehand strokes, text and similar simple marks | tactical region geometry, collision geometry and polygon-based fog |
| a GM manually drawing and publishing newly explored space                       | automated fog of war and automated exploration-based revelation    |
| a bounded GM drawing surface producing an ordinary image                        | a full VTT, player drawing, and simultaneous collaborative drawing |

> **Drawn shapes depict the fiction. They carry no collision, movement,
> distance, line-of-sight or rules-engine meaning**
> ([section 2.2](#22-map-purpose--illustration-not-authoritative-rules-state)).

The remaining V1 exclusions above are **retained in full**, including the grid,
tactical measurement and movement-rule exclusions, Combat synchronization,
automatic entity placement, movement history, and general Map
branching/rollback/revision-history UI.

> **Do not turn V1 Maps into a full VTT.**

**The architecture must allow later growth without requiring any of the items
above now.** That, together with
[section 2.2](#22-map-purpose--illustration-not-authoritative-rules-state), is the
test a later spatial capability must pass.

Later spatial mechanics should **extend the common Map/spatial model**.

They should not create a separate tactical-Map architecture merely because tactical use introduces richer mechanics.

---

# 18. V1 milestone shape

The durable first product milestone remains one substantial capability:

# Map Workspace V1

Its product value comes from the cohesive workflow:

> create Map → organize spatial information → reference game objects → connect Maps → control visibility → use the Map during play

The internal concepts:

- Map identity;
- normalized coordinates;
- markers;
- Layers;
- sharing;
- hierarchy;

must not automatically be treated as six separate product milestones.

When #118 is later activated, implementation planning should prefer the largest coherent vertical slice or slices that can safely deliver the Map Workspace V1 user outcome.

Technical sequencing may occur internally.

That sequencing does not alter the durable product milestone.

---

# 19. Resolved PO decisions

## M1 — Sharing granularity

**Approved**

V1 supports:

- whole-Map sharing;
- Layer visibility;
- marker visibility overrides.

Arbitrary spatial-region sharing is deferred.

---

## M2 — Marker model

**Approved**

V1 uses the bounded mixed marker model:

1. Annotation marker;
2. Entity-reference marker;
3. Map-link marker.

Entity references convey identity linkage only and do not automatically synchronize external location or game state.

---

## M3 — Player-authored markers

**Deferred**

Map Workspace V1 uses:

> GM authors; players consume what is shared.

Player annotation and collaborative editing remain later capabilities.

---

## M4 — Map is a canonical Campaign domain object

**Approved, 2026-09-26**

A Map is a persistent **Campaign-scoped** spatial/story resource with stable
identity independent of any Scenario, reusable across Scenarios and Encounters.
Scenario/Encounter association expresses relevance, not ownership, and creates no
copy. A Map is not an Item, and not inherently a Combat object.
[Section 2.1](#21-a-map-is-a-canonical-campaign-domain-object) and
[section 16](#16-durable-domain-boundaries).

---

## M5 — The Map is illustrative, not authoritative rules state

**Approved, 2026-09-26**

Map position and geometry illustrate the fiction. V1 coordinates must not
determine Combat legality, range, movement allowance, pathfinding, line of sight
or rules-engine outcomes. **The GM remains the adjudicator.**
[Section 2.2](#22-map-purpose--illustration-not-authoritative-rules-state).

---

## M6 — Layers carry visual representations; replacement is not new information

**Approved, 2026-09-26**

A Layer may carry a visual Artifact representation, markers, or both. **One V1
layer corresponds to one visual Artifact representation**; multi-file tiled or
composite layers are deferred, and opacity is an optional display property.

> **Replacement changes representation. New information creates a new layer.**

[Section 8.1](#81-layers-carry-visual-representations) and
[section 8.2](#82-replacement-versus-new-knowledge).

---

## M7 — Map knowledge is Character-scoped

**Approved, 2026-09-26**

Different Characters may hold different projections of one canonical Map.
Player-safe classification is **eligibility**, never disclosure. Map disclosure
affects Map knowledge only. **This supersedes the party-wide reading of
[section 9](#9-visibility-and-sharing-model).**
[Section 9.6](#96-map-knowledge-is-character-scoped) through
[section 9.9](#99-map-disclosure-affects-map-knowledge-only).

---

## M8 — Live placements are transient; knowledge is not

**Approved, 2026-09-26**

V1 supports approximate live placement of Characters, People and Items, with
bulk-add, drag/drop, removal and show/hide. Placements are live contextual state,
not Character memory. **Knowledge is acquired at actual projection, not by GM-side
placement**, and knowledge acquired that way persists after the placement ends.
Player-facing markers must not leak a Person's backing.
[Section 7.5](#75-live-placements) through
[section 7.7](#77-player-facing-marker-treatment), and
[section 9.7](#97-how-a-character-acquires-map-knowledge).

---

## M9 — Blackboard Map sharing is by known-Layer subset

**Approved, 2026-09-26**

A Character may post any subset of the Map Layers they personally know. The posted
Map contains exactly those Layers, never tracks the poster's later learning, and
copies no knowledge into another Character's Knowledge Library.
[Section 9.10](#910-blackboard-sharing-of-maps).

---

## M10 — One Map facility, and a stable expanding coordinate frame

**Approved, 2026-09-29**

Imported, sketched and mixed Maps are **one Map facility**. Authoring paths
differ; Map identity, layers, placement, disclosure, player presentation and
persistence are common, and sketching is **not a second Map engine**. Every Map
has a **stable Map-local coordinate frame independent of image resolution,
export crop and viewer camera**, supporting **expansion**; adding space or
replacing an image must not rescale or reposition existing content or markers.
**Expansion alone is not materially changed geography.**
[Section 2.3](#23-one-map-facility-many-authoring-paths) and
[section 6](#6-coordinate-model).

---

## M11 — Retained arrangements, explicit placement, individual cameras

**Approved, 2026-09-29**

Each Map **retains its latest placement arrangement** across navigating away and
returning, for imported Maps as well as sketched ones. Retention is **not**
authoritative entity location, Combat state or Character knowledge; it grants no
player visibility; Knowledge Library and Blackboard projections do not
automatically include it; and no movement history is required. **Placement is
explicit** — opening, importing, associating or publishing a Map places nothing.
**Authorized marker movement updates permitted viewers immediately and
independently of drawing publication**, and **each viewer's camera is individual
view state**. [Section 7.8](#78-retained-placement-arrangements) through
[section 7.10](#710-viewer-camera-is-individual-view-state). This **extends** M8
rather than replacing it.

---

## M12 — The publication boundary, and the D1 disclosure ruling

**Approved, 2026-09-29**

A visual layer's representation may be an image authored in app. A **private
editable GM source** is separate from the **explicitly published image**, whose
Map-space alignment updates coherently with it; saving an unfinished source
activates no published revision; a failed publication retains the previous usable
image and a recoverable draft; and the published image embeds no private source.
**This lightweight boundary establishes no general Map branching or revision
history.**

> **D1: Preserve Character-specific disclosure.** Representation
> correction/replacement may replace existing imagery for its existing
> recipients; **new information creates a new disclosure unit with an explicit
> eligible audience** and is not disclosed to prior recipients automatically.
> **New disclosure does not create another Map** — one stable Map identity, one
> current composed presentation per viewer — and internal layers **may be
> consolidated only where that preserves all meaningful audience and knowledge
> distinctions**. **No general Map revision/history UI, and no pixel differencing
> or other automatic disclosure inference.**

[Section 8.2.1](#821-the-d1-disclosure-ruling--a-layer-is-a-disclosure-unit),
[section 8.3](#83-a-visual-representation-may-be-authored-in-app) and
[section 13](#13-editing-and-update-model). This **refines** M6; the rule that
replacement changes representation while new information creates a new layer is
**unchanged**.

---

## M13 — Bounded GM image authoring, and no canonical engine

**Approved, 2026-09-29**

The blanket exclusion of drawing tools is amended to permit **bounded GM
image-authoring tools**; illustrative rectangles, lines and freehand strokes are
allowed, while tactical region geometry, collision and polygon fog remain
deferred, and a GM manually drawing newly explored space is allowed while
automated fog and exploration remain deferred.

> **No editor or drawing library is canonically mandated.** A bounded evaluation
> of a pinned released version of a candidate editor, behind the image-publication
> boundary, is the intended **first authorized implementation phase** — see
> [Live map sketching](../product/live-map-sketching.md). **Its failure leaves
> this Map architecture unchanged**, with another editor evaluable against the
> same boundary.

[Section 17](#17-explicitly-deferred-tactical-and-spatial-mechanics).

---

# 20. Remaining PO decisions

No material product or architecture decision remains unresolved for **Map Workspace V1**.

**Confirmed 2026-09-26.** The 2026-09-26 Maps ruling introduced **no new open
decision**. The one question it could have raised — whether a Map-Layer disclosure
reaching only some Characters produces a shared Activity entry — is **already
answered** by the settled rule at
[Content authoring §18.37](../product/content-authoring-scenario-preparation-and-artifact-management.md#1837-character-scoped-knowledge-and-the-shared-activity-record),
applied to Maps at [section 9.11](#911-map-disclosure-and-the-shared-activity-record).

**Confirmed 2026-09-29.** The 2026-09-29 live map sketching ruling introduces
**no new open decision** either. The one question it could have left open — how a
publication that adds new information affects prior recipients of the previous
representation — is **decided** by
[section 8.2.1](#821-the-d1-disclosure-ruling--a-layer-is-a-disclosure-unit).
Editor selection, export limits and draft-recovery mechanics are **evaluation
and implementation questions, not product decisions**
([Live map sketching](../product/live-map-sketching.md)).

Future decisions will be required when later capabilities are activated, particularly around:

- physical scale;
- tactical geometry;
- Combat synchronization and authority;
- LOS and vision;
- dynamic fog/exploration;
- player-owned spatial content;
- Artifact revision pinning if historical presentation becomes necessary.

Those are future milestone decisions and do not block the current architecture.

---

# 21. Readiness assessment

The conceptual contract now establishes:

- stable Map identity;
- one Map model across spatial scales;
- graph-based Map navigation;
- normalized spatial coordinates;
- the bounded mixed marker model;
- lightweight Layers;
- controlled Map/Layer/marker sharing;
- the player-editing boundary;
- Map/Artifact separation;
- current-Artifact-revision background behavior;
- external-reference durability;
- mutable V1 editing;
- durable Map/Campaign/Combat/Story boundaries;
- a cohesive Map Workspace V1 milestone;
- explicit exclusion of later tactical mechanics.

**Amended 2026-09-26.** The 2026-09-26 Maps ruling adds to that list:

- the canonical **Campaign-scoped** Map object, and the Map/Item boundary;
- the **illustrative, not authoritative** Map purpose;
- the **visual layer stack** and the replacement-versus-new-layer rule;
- **Character-scoped Map knowledge**, and the eligibility-versus-knowledge
  distinction;
- **live placements** and their transience;
- player-facing marker treatment and the identity anti-leak invariant;
- **Blackboard Map sharing by known-Layer subset**.

**Amended 2026-09-29.** The live map sketching ruling adds:

- **one Map facility** across imported, sketched and mixed authoring paths;
- the **stable, expandable Map-local coordinate frame**;
- **retained placement arrangements**, explicit placement, immediate marker
  updates and **individual viewer cameras**;
- the **private-source versus published-image boundary**, which is not Map
  branching or revision history;
- the **D1 disclosure ruling** — a layer is a **disclosure unit**, not a Map
  version;
- **bounded GM image-authoring tools**, with no canonically mandated engine.

No further product ruling is required before the architecture can be treated as complete.

# #118 Maps / Spatial Play — conceptual architecture Ready
