# GLANTRI — MAPS / SPATIAL PLAY

## Durable Product / Architecture Contract

**Portfolio area:** #118 Maps / Spatial Play\
**Product milestone:** Map Workspace V1\
**Architecture status:** Ready\
**Implementation status:** Future / activation-gated

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

---

# 2. Controlling Map definition

A **Map is a persistent interactive spatial object**.

It provides an authored spatial context in which information can be:

- positioned;
- organized;
- referenced;
- navigated;
- selectively exposed to players.

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

---

# 3. Map Workspace V1 product outcome

The first major Maps milestone is:

## Map Workspace V1

### Product outcome

A GM can create and organize persistent Maps, optionally give them Artifact backgrounds, place annotations, entity references and Map links in normalized space, organize them into Layers, navigate between Maps, and selectively share Map information with players.

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

Every Map has a **normalized Map-local coordinate space**.

Conceptually:

- X and Y describe relative position within Map space;
- marker placement does not depend on source-image pixel dimensions;
- position remains stable when a background changes resolution;
- a Map without a background still possesses the same coordinate space.

The normalized coordinate system is the durable spatial foundation.

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

# 8. Layer model

Map Workspace V1 contains a lightweight **Layer** concept.

A Layer provides:

- a name;
- ordering;
- a collection of markers;
- visibility state.

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

---

# 9. Visibility and sharing model

Map Workspace V1 supports three levels of visibility control.

The effective hierarchy is:

> **Map access → Layer visibility → optional Marker override**

---

## 9.1 Map access

A Map is either:

- GM-only; or
- shared with players.

If the Map itself is GM-only, its internal player-facing Layer or marker settings do not independently expose it.

---

## 9.2 Layer visibility

On a shared Map, each Layer may independently be:

- GM-only;
- player-visible.

This allows the GM to prepare public and secret information on the same Map.

Separate player and GM copies of the same underlying Map are therefore not required merely to maintain hidden information.

---

## 9.3 Marker visibility override

An individual marker may override its Layer's normal visibility when necessary.

This supports cases such as:

- revealing one previously secret location;
- hiding one exceptional marker on an otherwise visible Layer;
- progressive revelation without restructuring Layers.

Marker overrides are exceptions to Layer-level defaults rather than a replacement for Layer organization.

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
2. GM shares the Map with players.
3. Selected Layers are player-visible.
4. Secret Layers remain GM-only.
5. Individual marker overrides may reveal or hide exceptional markers.
6. Visibility may change later without creating another Map.

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

The Map is shared.

The Towns, Roads and Known Locations Layers are player-visible.

GM Secrets remains hidden.

**Accepted.**

---

## 15.2 Marker visibility override

A hidden ruin sits on the GM Secrets Layer.

After the characters discover it, the GM changes that marker's visibility so players can see it without revealing the rest of the Layer.

**Accepted.**

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

Players can see an NPC marker on a shared Map.

The marker identifies the NPC in the manner chosen for Map presentation.

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
- rollback.

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

# 20. Remaining PO decisions

No material product or architecture decision remains unresolved for **Map Workspace V1**.

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

No further product ruling is required before the architecture can be treated as complete.

# #118 Maps / Spatial Play — conceptual architecture Ready
