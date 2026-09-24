# Campaign Material and Scenario Builder — product/UI contract

## 1. Status and scope

**Status:** Product Owner approved, 2026-09-24. This is the **current V1
product/UI contract** for the Campaign Material surface and the Scenario Builder
surface. Implementation is **not** authorized by this document.

**Authority:** Product Owner ruling of 2026-09-24 on Campaign Material, Scenario
Builder and Storylines.

### 1.1 What this contract controls

The **roles, UI shape and scope boundaries** of two GM surfaces: Campaign
Material (the Campaign-level content factory and library) and Scenario Builder
(the Scenario-level staging desk over that material).

### 1.2 What this contract does not do

- It does **not** restate the domain model. The controlling contract for
  Artifacts, typed associations, provenance, Scenario preparation and the import
  pipeline is
  [Content authoring, Scenario preparation and Artifact management](content-authoring-scenario-preparation-and-artifact-management.md).
  Where that contract already settles a mechanism, this document points to it.
- It does **not** authorize schema, migration, runtime or UI implementation, and
  it does not decompose into lanes.
- It does **not** reopen any open decision in the
  [People/Artifact/GM authoring model](people-artifact-and-gm-authoring-model.md#15-open-decisions--none-chosen).
- The GM-only Storylines surface is governed by its own contract,
  [Campaign Storylines](campaign-storylines.md).

---

## 2. Campaign Material — role

**Campaign Material is the canonical content factory and library. It is not a
Scenario planning surface.**

It is where the GM:

- uploads and imports Artifacts;
- creates simple native text Artifacts ([section 4](#4-native-text-artifacts));
- manages Artifact metadata, provenance, associations and representations;
- finds reusable Campaign resources;
- sees usage and history across Scenarios;
- handles unattached, fallback, missing or unresolved material;
- **reuses existing canonical content rather than recreating it**, per
  [Content authoring §5](content-authoring-scenario-preparation-and-artifact-management.md#5-reuse-first).

Artifact identity, associations and provenance are governed by
[Content authoring §3](content-authoring-scenario-preparation-and-artifact-management.md#3-one-artifact-system),
[§4](content-authoring-scenario-preparation-and-artifact-management.md#4-typed-associations)
and
[§6](content-authoring-scenario-preparation-and-artifact-management.md#6-provenance).
The surface itself extends
[Content authoring §7](content-authoring-scenario-preparation-and-artifact-management.md#7-central-campaign-material-surface).

### 2.1 Core UI

- **One searchable, filterable list.**
- **One dominant Inspector.**
- **No primary separation into software or domain-category screens.** The
  surface is organized around **GM jobs**, not around object types.
- Type and category filtering is available, but it is a filter, not the
  navigation spine.
- **No overloaded permanent filter bar.** Search plus the important context/job
  views may stay visible; less common filters are collapsed, and **active
  filters remain visible as chips or an equivalent**.

The Inspector is the existing one, specialized — never a second Inspector — per
[Content authoring §7](content-authoring-scenario-preparation-and-artifact-management.md#7-central-campaign-material-surface).

### 2.2 Domain objects versus Artifacts

Domain objects such as People and Items are **edited in their canonical domain
screens**. Campaign Material may:

- show them;
- manage their Artifact associations and representations;
- show where they are used;
- navigate to their canonical editor.

Artifacts themselves are editable in Campaign Material to the extent
appropriate:

- metadata, associations and provenance for **all** Artifacts;
- native content for **simple Glantri-owned text Artifacts**;
- preview and replace media for **external media**.

### 2.3 Scope boundaries — what Campaign Material must not become

These negative boundaries carry the same weight as the scope above.

| Campaign Material must not become                             | Canonical home instead               |
| ------------------------------------------------------------- | ------------------------------------ |
| A duplicate **Character** editor                              | The canonical Character screens      |
| A duplicate **Item**, **inventory** or **progression** editor | The canonical Item/Character screens |
| A duplicate **Combat** editor                                 | The Combat surfaces                  |
| An **image editor** or **drawing tool**                       | Out of scope                         |
| A **map editor**                                              | Out of scope                         |
| A **rich page-layout system**                                 | Out of scope                         |

The standing prohibition **"do not build a general-purpose knowledge-management
system"**
([People/Artifact model §10](people-artifact-and-gm-authoring-model.md#10-gm-campaign-material))
continues to govern this surface unchanged.

---

## 3. Person presentation in Campaign Material

A persistent Person has **two canonical presentation layers**:

| Layer                                 | Carries                                              |
| ------------------------------------- | ---------------------------------------------------- |
| **General appearance / unidentified** | canonical image; canonical description               |
| **Identified / recognized**           | canonical portrait; canonical identified description |

A Person may additionally have **zero or more additional illustrations**.

These are **Campaign-level reusable defaults**, not Scenario-specific
information. The Artifact-role half of this model is the V1 vocabulary in
[Content authoring §4.2](content-authoring-scenario-preparation-and-artifact-management.md#42-the-v1-association-role-vocabulary-for-a-person)
— selected primary portrait, selected general appearance, additional
illustration — and selection remains independent of visibility.

### 3.1 The two canonical presentation texts

The **general/unidentified description** and the **identified description** are
**two canonical texts on the Person presentation model**. They are not Artifact
content, not a Story Note ([Campaign Storylines §2](campaign-storylines.md#2-model)),
and not the GM-only dossier.

| Text                                 | Player-safe                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **general/unidentified description** | while the Person is visible but **unidentified**                                                  |
| **identified description**           | once the Person is **recognized** ([section 7.4](#74-recognition-is-shared-scenario-party-state)) |

**The GM-only dossier remains private and is neither of these texts.** Its
structural-exclusion standard in
[People/Artifact model §6.1](people-artifact-and-gm-authoring-model.md#61-the-gm-only-dossier)
is unchanged, and no part of it may be surfaced as a presentation text.

### 3.2 The Person Inspector

The Campaign Material **Person Inspector**:

- manages these representations and their associations;
- **does not edit Character mechanics**;
- exposes use and history;
- allows reuse of the Person in another Scenario.

> **Which layer applies is decided by shared Scenario-party recognition state**
> ([section 7.4](#74-recognition-is-shared-scenario-party-state)), not on the
> Person. The general modelling of identity revelation —
> [OPEN-PPL-1](people-artifact-and-gm-authoring-model.md#open-ppl-1--how-identity-revelation-is-modelled)
> — remains open, and per-player recognition remains deferred.

---

## 4. Native text Artifacts

Campaign Material supports **simple native text Artifacts**: letters, scrolls,
notices, inscriptions and clue/handout text.

- V1 editing is **simple plain text or Markdown with a basic preview**.
- A presentation such as `scroll` or `letter` is **rendering/presentation
  metadata**, not a rasterized image-editing feature.
- A **"clue" is normally a use or role, not a new domain entity.**
- If a document is also a physical game-world object, the **physical Item and
  its text/media Artifact remain distinct** and may be associated.

---

## 5. Scenario Builder — role

**Scenario Builder is the Scenario-specific staging desk over canonical Campaign
material.**

It owns:

- the Scenario GM Plan (storage settled by
  [Content authoring §8.1](content-authoring-scenario-preparation-and-artifact-management.md#81-the-scenario-gm-plan));
- Scenario resource membership (by association, per
  [Content authoring §8.2](content-authoring-scenario-preparation-and-artifact-management.md#82-scenario-resource-assembly));
- the initial presentation and use of those resources;
- Scenario-specific presentation overrides ([section 7](#7-scenario-overlays));
- planned reveals;
- Encounter preparation ([section 9](#9-encounter-preparation));
- prepared GM messages ([section 8](#8-prepared-gm-messages));
- preparation and readiness state ([section 10](#10-preparation-readiness)).

**It does not duplicate canonical Person, Item or Artifact editing.** Those
remain in their canonical editors and in Campaign Material as described in
[section 2.2](#22-domain-objects-versus-artifacts).

---

## 6. Scenario Builder screen structure

**One coherent Scenario preparation screen:**

- a Scenario header;
- a **collapsible GM Plan**;
- **one Scenario Content list**;
- **one dominant Scenario Inspector**;
- a **compact preparation/readiness status**.

The Scenario Content list is expected to stay modest in size, so **simple
category filtering is sufficient**: All; People; Items; Artifacts/Maps;
Encounters; Messages; and preparation gaps where useful.

**No third navigation hierarchy is required.** Campaign Material and Scenario
Builder are the two surfaces; nothing between them needs its own navigation
spine.

---

## 7. Scenario overlays

**Scenario-specific information does not live on the canonical Person or Item.**

- Scenario Builder **normally inherits canonical presentation** from
  [section 3](#3-person-presentation-in-campaign-material).
- It may **optionally override the image and/or the description, for either
  presentation layer, for this Scenario**.
- **Removing an override returns to the Campaign default.** Defaults are
  **never copied into Scenario state**; absence of an override is inheritance,
  not a stored copy.

Worked example: the canonical unidentified presentation is a generic officer;
the Scenario override is a customs-officer disguise; the canonical identified
presentation is the Captain Varro portrait.

### 7.1 The resolution rule

> **Scenario override if present → otherwise canonical Person default.**

That is the entire rule. It is applied independently to each of the four
presentation slots — unidentified image, unidentified description, identified
image, identified description — and there is **no third layer and no further
ordering**.

### 7.2 What the override is and is not

The override is **authorized for V1 in exactly this narrow form**, and the
controlling contract records the amendment at
[Content authoring §18.11](content-authoring-scenario-preparation-and-artifact-management.md#1811-narrow-scenario-presentation-override-authorized-for-v1).

**Authorized:** a Scenario may optionally override the inherited
general/unidentified image and/or description, and may optionally override the
inherited identified image and/or description.

**Not authorized — none of the following may be built:**

| Not authorized                                                                      |
| ----------------------------------------------------------------------------------- |
| A **generic context/scope column**                                                  |
| An **arbitrary resolution hierarchy** beyond [section 7.1](#71-the-resolution-rule) |
| An **entitlement-specific override system**                                         |
| A **per-player override**                                                           |
| **Scenario-scoped primary roles**                                                   |
| **Modification of the Person's canonical Artifact selections**                      |

The Person's canonical selections stay global and untouched, per
[Content authoring §4.2](content-authoring-scenario-preparation-and-artifact-management.md#42-the-v1-association-role-vocabulary-for-a-person).
**Everything that clause 3 of that section forbids, other than this one narrow
override, remains forbidden**, and the general context-specific override case
remains deferred to the Product Owner.

### 7.3 Three distinct concepts

**Presence, visibility/recognition and presentation are conceptually distinct**
and must not be collapsed into one another or into a single flag.

### 7.4 Recognition is shared Scenario-party state

**For V1, recognition is shared Scenario-party state, not per-player state.**

- **Scenario preparation establishes the initial unidentified/identified
  state.**
- **The GM may change that state during play.**
- **Presentation resolves from that shared state**, plus the optional Scenario
  override and the canonical fallback of [section 7.1](#71-the-resolution-rule).

**Per-player recognition is deferred, not rejected.** V1 builds no per-player
visibility or recognition controls, and nothing built for V1 may make per-player
recognition a redesign rather than an extension.

---

## 8. Prepared GM messages

**Prepared GM messages belong to Scenario preparation, not to Campaign
Material.**

A prepared message may optionally reference a speaker Person, a related Item, a
related Artifact, an Encounter, and the relevant Scenario stage or context.
Typical cases are a Person speaking and a narrator or material message.

- Prepared messages are **GM-only Scenario planning content** and **remain
  GM-only until published**.
- **Nothing enters Activity before publication.** A prepared but unpublished
  message has no Activity representation of any kind.
- In V1, publication is **party-wide — shared to the Scenario's players as a
  group. There is no per-player audience selector.**
- **V1 builds no dialogue trees and no automatic narrative triggers.**

### 8.1 Publication creates a `scenario_announcement` Activity event

**Publishing a prepared message creates an explicit player-safe Activity event
of kind `scenario_announcement`**, consistent with
[Content authoring §9](content-authoring-scenario-preparation-and-artifact-management.md#9-durable-history)
and projected by the rules in
[PPV1 §9](../architecture/player-play-v1.md#9-activity-visibility-and-projection-rules).

The event carries **the published text and only the safe references needed for
rendering and history** — no GM-only preparation context travels with it.

> **Implementing this persisted Activity kind is floor-class.** It changes
> persisted player-safe/privacy-projected semantics, so the lane that builds it
> carries the [mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) — the
> same classification
> [PPV1 §9.4](../architecture/player-play-v1.md#94-the-existing-event-and-roll-model)
> already applies to adding an announcement event type. **This document settles
> the design; it authorizes no implementation.**

An unpublished prepared message is not recap-eligible: it is excluded from the
session-summary source by
[People/Artifact model §11.2](people-artifact-and-gm-authoring-model.md#112-the-session-summary-source-rule--activity-is-the-only-source),
and eligibility is earned by publication.

---

## 9. Encounter preparation

**Encounters are prepared subsets and context over Scenario resources.**

Scenario Builder lets the GM:

- create a prepared Encounter;
- select participants and resources **primarily from the Scenario pool**;
- add a **short GM-only Encounter note**;
- associate relevant Items, Artifacts, Maps and messages;
- later **activate** the Encounter in Scenario Play.

**Encounter remains contextual state inside Scenario Play, not a separate
player-facing play surface**, per
[Content authoring §8.3](content-authoring-scenario-preparation-and-artifact-management.md#83-encounter-preparation)
and
[§13](content-authoring-scenario-preparation-and-artifact-management.md#13-encounter-stays-lightweight).

---

## 10. Preparation readiness

Scenario Builder gives **actionable preparation state, not a generic
completeness score**. Reported issues are concrete, for example:

- missing representation;
- generic fallback;
- missing description;
- unresolved imported material;
- missing map;
- prepared Encounters or messages present.

**Selecting a readiness issue leads directly to the affected resource or
action.** Representation readiness itself remains **derived**, per
[Content authoring §15](content-authoring-scenario-preparation-and-artifact-management.md#15-representation-readiness);
this surface presents it and does not store a second readiness state.

---

## 11. The authoring-level progression

One conceptual progression spans Campaign authoring, Scenario preparation and
play:

**Campaign Storyline → Scenario GM Plan → Encounter preparation → Prepared GM
message → Published Activity**

> **Information does not automatically flow down this chain.** The GM
> **explicitly decides** what moves into a more immediate or more
> player-capable layer. No layer derives, promotes or publishes content from the
> layer above it on its own.

The left-hand end is governed by
[Campaign Storylines](campaign-storylines.md); the right-hand end by
[PPV1 §9](../architecture/player-play-v1.md#9-activity-visibility-and-projection-rules)
and
[People/Artifact model §11.2](people-artifact-and-gm-authoring-model.md#112-the-session-summary-source-rule--activity-is-the-only-source).

---

## 12. Relationship to existing contracts

| Document                                                                                                                             | Relationship                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| [Content authoring, Scenario preparation and Artifact management](content-authoring-scenario-preparation-and-artifact-management.md) | **Controlling** for the domain model, the Artifact pipeline, associations, provenance and Scenario preparation mechanics. |
| [People, Artifacts and GM authoring](people-artifact-and-gm-authoring-model.md)                                                      | Records the #284 rulings and the open decisions; this contract reopens none of them.                                      |
| [Campaign Storylines](campaign-storylines.md)                                                                                        | The GM-only Campaign narrative authoring surface at the head of [section 11](#11-the-authoring-level-progression).        |
| [Scenario Play Workspace](../architecture/scenario-play-workspace.md)                                                                | Play authority. Scenario Builder is preparation, not play.                                                                |
| [Player Play V1](../architecture/player-play-v1.md)                                                                                  | Player play and Activity authority, including what publication may produce.                                               |
| [Campaign, Scenario and Encounter workflows](campaign-scenario-encounter-workflows.md)                                               | Workspace responsibilities; the authoring model remains governed by the Content authoring contract.                       |
| [Product & Presentation Principles](product-presentation-principles.md)                                                              | Presentation and privacy principles these surfaces inherit.                                                               |
