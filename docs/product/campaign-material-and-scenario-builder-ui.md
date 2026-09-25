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
- It does **not** govern live play. The GM's live operating surface is
  [Live GM Scenario Play](live-gm-scenario-play.md).

### 1.3 The governing UX principle

One principle governs Campaign Material, Scenario Builder and
[Live GM Scenario Play](live-gm-scenario-play.md) together:

> **Author once, operate in context.**

| Surface                                       | Is                                             |
| --------------------------------------------- | ---------------------------------------------- |
| **Campaign Material**                         | the canonical material factory and library     |
| **Scenario Builder**                          | the Scenario-specific preparation/staging desk |
| **[Scenario Play](live-gm-scenario-play.md)** | the live operating surface                     |

Two consequences are binding on all three:

> **The GM must not need to navigate back into design or management screens to
> perform ordinary actions during play.**

> **Preparation helps play but never constrains improvisation.**

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
- manages the **canonical Person and Item representations**
  ([section 3](#3-person-and-item-presentation-in-campaign-material));
- manages the Artifact's **current Campaign-level access**
  ([section 2.4](#24-artifact-access-is-campaign-level-and-current));
- keeps lightweight **GM-only notes** on Items and Artifacts
  ([section 2.5](#25-gm-only-notes-on-items-and-artifacts));
- handles unattached, fallback, missing or unresolved material
  ([section 2.6](#26-unattached-and-exception-material));
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

Suggested always-visible controls: **Search**; **View**; **Scenario**;
**Filters**; **removable active-filter chips**.

The views are **job-oriented**, for example: `All material`;
`Scenario material`; `Preparation gaps`; `Needs attention`; `Unattached`;
`Recent imports`; `Player-shared material`.

**Category filtering such as People / Items / Artifacts / Maps is acceptable as
a compact filter, not as separate applications.** A category is never a
navigation destination with its own screen.

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

| Campaign Material must not become                             | Canonical home instead                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| A duplicate **Character** editor                              | The canonical Character screens                                     |
| A duplicate **Item**, **inventory** or **progression** editor | The canonical Item/Character screens                                |
| A duplicate **Combat** editor                                 | The Combat surfaces                                                 |
| An **image editor** or **drawing tool**                       | Out of scope                                                        |
| A **map editor**                                              | Out of scope                                                        |
| A **rich page-layout system**                                 | Out of scope                                                        |
| A **Scenario reveal-planning** surface                        | [Scenario Builder §7.7](#77-reveal-planning-prepares-play-executes) |
| An **Encounter operation** surface                            | [Live GM Scenario Play](live-gm-scenario-play.md)                   |
| A **Storyline editor**                                        | [Campaign Storylines](campaign-storylines.md)                       |

The standing prohibition **"do not build a general-purpose knowledge-management
system"**
([People/Artifact model §10](people-artifact-and-gm-authoring-model.md#10-gm-campaign-material))
continues to govern this surface unchanged.

### 2.4 Artifact access is Campaign-level and current

Campaign Material manages the Artifact's **current Campaign-level access**.
V1 has **exactly two canonical states**:

- **GM only**;
- **shared with Campaign players**.

There is no third. The controlling record is
[Content authoring §18.24](content-authoring-scenario-preparation-and-artifact-management.md#1824-artifact-access-states-and-the-legacy-scenario-audience).

**The persisted `scenario` audience carried by the existing draft implementation
is not one of these states.** It is legacy draft implementation, retired from
writable V1 semantics by the smallest safe cleanup: **no surface offers it and
no path newly writes it**, draft data may be reset or rebuilt under the existing
draft-data policy, and **no generalized migration machinery is built for it**.

> **Any temporary handling of residual legacy state fails closed — it resolves
> to `GM only`, never to player access.**

**Finding where that legacy audience is persisted is implementation work, not a
contract gap**, and the implementing Builder reports the paths it finds, removes
writable V1 use, keeps the fail-closed handling and adds regression coverage —
[Content authoring §18.24](content-authoring-scenario-preparation-and-artifact-management.md#1824-artifact-access-states-and-the-legacy-scenario-audience).
**That readiness gap is A3 (Artifact access) and is unrelated to Combat A3 (UI
consolidation).**

**This is distinct from Scenario preparation and from reveal.**

- **Scenario association never grants access.** Associating an Artifact with a
  Scenario or Encounter is assembly, per
  [Content authoring §8.2](content-authoring-scenario-preparation-and-artifact-management.md#82-scenario-resource-assembly).
- **Sharing from Campaign Material means share now**, not "prepare a future
  reveal". Prepared intent lives in Scenario Builder
  ([section 7.7](#77-reveal-planning-prepares-play-executes)).
- **Removing current access does not rewrite Activity or history and does not
  make players "forget"** —
  [Live GM Scenario Play §5.1](live-gm-scenario-play.md#51-glantri-does-not-model-forgetting-in-v1).
- **Person recognition is not an Artifact-access state.** Recognition is shared
  Scenario-party state ([section 7.4](#74-recognition-is-shared-scenario-party-state)).

### 2.5 GM-only notes on Items and Artifacts

Items and Artifacts may carry a **lightweight GM-only note**. The note:

- **belongs to the canonical object**;
- is **permanently GM-only**;
- has **no visibility, share or reveal action** — there is no control to expose
  it, in preparation or in play;
- is **excluded structurally** from player projections, player-facing search,
  Activity, the Blackboard and player-facing AI context.

This is the same structural-exclusion standard the GM-only dossier already
carries in
[People/Artifact model §6.1](people-artifact-and-gm-authoring-model.md#61-the-gm-only-dossier)
and the Storyline privacy invariant in
[Campaign Storylines §4.2](campaign-storylines.md#42-structural-exclusion).

**Longer cross-object narrative belongs in Storylines instead**, not in an
expanded note field.

> **This is not a generic Note system and must not be broadened into one.**

**The semantics, the prohibition and the storage are settled** at
[Content authoring §18.21](content-authoring-scenario-preparation-and-artifact-management.md#1821-gm-only-notes-on-items-and-artifacts).
An **Artifact** GM note is surfaced by the existing Artifact `gmNotes`
capability (`packages/domain/src/campaign/artifact.ts:75`); an **Item** GM note
is surfaced by a canonical GM-only field owned by the Item domain/service. **No
generic Note entity or table backs this surface.**

That closes storage **for Items and Artifacts only**. The separate open question
of where the Campaign-scoped GM-only Person dossier lives —
[OPEN-PPL-3](people-artifact-and-gm-authoring-model.md#open-ppl-3--where-the-campaign-scoped-gm-only-dossier-lives) — **remains open and is not resolved by this contract.**

### 2.6 Unattached and exception material

**Unattached canonical material is valid and may remain unattached
intentionally.** It is not an error and must not be presented as one.

**Staged or import exceptions are not the same thing as canonical unattached
material.** A `Needs attention` view may expose both kinds of GM work, but it
must **clearly distinguish staged state from canonical state**. The staged half
belongs to the intake pipeline of
[Content authoring §12](content-authoring-scenario-preparation-and-artifact-management.md#12-bulk-intake-and-review).

### 2.7 Bulk actions

Support **limited, meaningful multi-select operations** over homogeneous
selections, for example: use the selected resources in a Scenario; apply tags;
other homogeneous association or material operations.

> **Do not create a heterogeneous generic bulk editor, and do not create a broad
> bulk-delete workflow.**

---

## 3. Person and Item presentation in Campaign Material

A persistent Person has **two canonical presentation layers**, and **each layer
carries a label, an image and a description**:

| Layer                                 | Label                | Image              | Description                      |
| ------------------------------------- | -------------------- | ------------------ | -------------------------------- |
| **General appearance / unidentified** | e.g. `The officer`   | canonical image    | canonical description            |
| **Identified / recognized**           | e.g. `Captain Varro` | canonical portrait | canonical identified description |

A Person may additionally have **zero or more additional illustrations**.

These are **Campaign-level reusable defaults**, not Scenario-specific
information. The Artifact-role half of this model is the V1 vocabulary in
[Content authoring §4.2](content-authoring-scenario-preparation-and-artifact-management.md#42-the-v1-association-role-vocabulary-for-a-person)
— selected primary portrait, selected general appearance, additional
illustration — and selection remains independent of visibility.

### 3.1 The canonical presentation label and texts

Each layer's **label** and **description** are **canonical texts on the Person
presentation model**. They are not Artifact content, not a Story Note
([Campaign Storylines §2](campaign-storylines.md#2-model)), and not the GM-only
dossier.

| Text                                 | Player-safe                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **general/unidentified label**       | while the Person is visible but **unidentified**                                                  |
| **general/unidentified description** | while the Person is visible but **unidentified**                                                  |
| **identified label**                 | once the Person is **recognized** ([section 7.4](#74-recognition-is-shared-scenario-party-state)) |
| **identified description**           | once the Person is **recognized** ([section 7.4](#74-recognition-is-shared-scenario-party-state)) |

**The label is presentation metadata, not another identity level.** It is the
short player-facing name a layer presents; it introduces no partial-identity
state and no extra resolution step.

**The resolved player-safe label is what player-facing surfaces render as the
Person's name** — the `Players see:` row
([Live GM Scenario Play §4.1](live-gm-scenario-play.md#41-gm-rows)), the
published speaker label ([section 8.2](#82-speaker-identity-in-a-published-announcement)),
the speaker on a `scenario_announcement`, and the before/after snapshots in
`person_identity_revealed` ([section 7.4.1](#741-only-a-change-during-play-is-history)).

**Labels are never sourced from the GM dossier**, and they have safe fallbacks:

| Layer                    | Fallback when no label is set           |
| ------------------------ | --------------------------------------- |
| **general/unidentified** | the neutral **`Unidentified person`**   |
| **identified**           | the canonical player-facing Person name |

These two texts are also **distinct from Artifact metadata**: an Artifact's own
title, caption or description describes the Artifact, not the Person, and does
not stand in for either presentation text. **An existing field may carry one of
these texts only where its semantics genuinely match**; where they do not, the
text is its own. Which existing fields, if any, qualify is an implementation
finding, not a claim this contract makes.

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
> Person. How identity revelation is modelled is **settled for V1** —
> [OPEN-PPL-1](people-artifact-and-gm-authoring-model.md#open-ppl-1--how-identity-revelation-is-modelled)
> — as party-wide Scenario-Person state; per-player recognition remains
> deferred.

> **The Person Inspector must not become the Character editor.**

### 3.3 The Item Inspector in Campaign Material

**An Item uses the same two canonical presentation layers as a Person, each
carrying a label, an image and a description:**

| Layer                      | Label         | Image           | Description                      |
| -------------------------- | ------------- | --------------- | -------------------------------- |
| **General / unidentified** | player-facing | canonical image | canonical description            |
| **Identified / examined**  | player-facing | canonical image | canonical identified description |

An Item may additionally have **zero or more optional additional
representations**.

**The representation Artifacts are selected by typed association roles** — a
singleton general/unidentified representation, a singleton identified/examined
representation, and zero or more additional illustrations — reusing the Person
role conventions and naming at
[Content authoring §4.3](content-authoring-scenario-preparation-and-artifact-management.md#43-the-v1-association-role-vocabulary-for-an-item).
**The Item's label and descriptions are Item domain state and are not generic
associations.**

**Scenario overrides and live identification select or override these layers**
under the same already-approved narrow Scenario-presentation rules that govern a
Person ([section 7](#7-scenario-overlays),
[Content authoring §18.20](content-authoring-scenario-preparation-and-artifact-management.md#1820-item-presentation-layers-and-scenario-overrides)).

> **No new generalized presentation system is introduced.** Items reuse the
> Person model; they do not get a parallel mechanism.

The Campaign Material **Item Inspector** may show:

- the Item's representations and their associations;
- usage and history across Scenarios;
- representation readiness ([section 10](#10-preparation-readiness));
- the private GM note ([section 2.5](#25-gm-only-notes-on-items-and-artifacts)).

> **It must not edit possession, inventory location, equip state, quantities,
> combat mechanics or current Encounter state.** Those remain in the canonical
> Item/Character screens and in play, per
> [section 2.3](#23-scope-boundaries--what-campaign-material-must-not-become).

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

### 5.1 Reuse and improvisation

Scenario resources may be **added from existing Campaign material or created
contextually**, per
[Content authoring §5](content-authoring-scenario-preparation-and-artifact-management.md#5-reuse-first).

> **Preparation is not a prerequisite for play.**

**The GM must be able to add or create resources later, during live play,
through the same canonical services** — see
[Live GM Scenario Play §3.3](live-gm-scenario-play.md#33-add-and-improvisation).
Nothing in Scenario Builder may become a step the GM is required to complete
before improvising.

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

### 6.1 The Scenario GM Plan

The Scenario GM Plan is **GM-only, collapsible, simple long-form text or
Markdown**.

> **It is Scenario-owned domain content, not an Artifact.**

Its storage is settled by
[Content authoring §8.1](content-authoring-scenario-preparation-and-artifact-management.md#81-the-scenario-gm-plan),
and it is the long-form primary planning document that keeps Encounter
lightweight under
[Content authoring §13](content-authoring-scenario-preparation-and-artifact-management.md#13-encounter-stays-lightweight).

---

## 7. Scenario overlays

**Scenario-specific information does not live on the canonical Person or Item.**

- Scenario Builder **normally inherits canonical presentation** from
  [section 3](#3-person-and-item-presentation-in-campaign-material).
- It may **optionally override the label, the image and/or the description, for
  either presentation layer, for this Scenario**. The three are independent.
- **Removing an override returns to the Campaign default.** Defaults are
  **never copied into Scenario state**; absence of an override is inheritance,
  not a stored copy.

Worked example: the canonical unidentified presentation is a generic officer
labelled `The officer`; the Scenario override is a customs-officer disguise
labelled `The customs inspector`; the canonical identified presentation is
`Captain Varro` and the Captain Varro portrait.

### 7.1 The resolution rule

> **Scenario override if present → otherwise canonical Person default.**

That is the entire rule. It is applied independently to each of the **six**
presentation slots — unidentified label, unidentified image, unidentified
description, identified label, identified image, identified description — and
there is **no third layer and no further ordering**.

**A resolved label that is still empty takes the safe fallback of
[section 3.1](#31-the-canonical-presentation-label-and-texts)**: `Unidentified
person` at the unidentified layer, the canonical player-facing Person name at
the identified layer.

### 7.2 What the override is and is not

The override is **authorized for V1 in exactly this narrow form**, and the
controlling contract records the amendment at
[Content authoring §18.11](content-authoring-scenario-preparation-and-artifact-management.md#1811-narrow-scenario-presentation-override-authorized-for-v1).

**Authorized:** a Scenario may optionally override the inherited
general/unidentified label, image and/or description, and may optionally
override the inherited identified label, image and/or description.

The authorized shape is a **narrow typed Scenario-to-Person presentation
overlay** carrying **exactly six optional slots** — general/unidentified label,
image and description overrides, and identified label, image and description
overrides — and nothing else. **Six is the closed shape**, settled at
[Content authoring §18.12](content-authoring-scenario-preparation-and-artifact-management.md#1812-the-scenario-presentation-overlay-shape). Where an appropriate
Scenario-Person relation already exists the overlay reuses it; otherwise a
**dedicated referentially sound relation** is acceptable. **No physical
representation is chosen here**; the shape of the overlay in the domain contract
is
[Content authoring §18.12](content-authoring-scenario-preparation-and-artifact-management.md#1812-the-scenario-presentation-overlay-shape).

**Not authorized — none of the following may be built:**

| Not authorized                                                                      |
| ----------------------------------------------------------------------------------- |
| A **generic context/scope column**                                                  |
| An **arbitrary resolution hierarchy** beyond [section 7.1](#71-the-resolution-rule) |
| An **entitlement-specific override system**                                         |
| A **per-player override**                                                           |
| **Scenario-scoped primary roles**                                                   |
| **Modification of the Person's canonical Artifact selections**                      |
| A general **override-resolution framework**                                         |

The Person's canonical selections stay global and untouched, per
[Content authoring §4.2](content-authoring-scenario-preparation-and-artifact-management.md#42-the-v1-association-role-vocabulary-for-a-person).
**Everything that clause 3 of that section forbids, other than this one narrow
override, remains forbidden**, and the general context-specific override case
remains deferred to the Product Owner.

### 7.3 Three distinct concepts

**Presence, visibility/recognition and presentation are conceptually distinct**
and must not be collapsed into one another or into a single flag.

### 7.4 Recognition is shared Scenario-party state

**For V1, recognition is persistent Scenario-Person, party-wide play state, not
per-player state.** It persists for that Scenario rather than lasting only for a
session or a view. This is the settled answer to
[OPEN-PPL-1](people-artifact-and-gm-authoring-model.md#open-ppl-1--how-identity-revelation-is-modelled),
recorded at
[Content authoring §18.23](content-authoring-scenario-preparation-and-artifact-management.md#1823-open-ppl-1-settled-for-v1--recognition-is-party-wide-scenario-person-state);
**a lane implementing recognition no longer stops and returns it to the Product
Owner.**

- **Scenario preparation establishes the initial unidentified/identified
  state.**
- **An explicit mid-play GM reveal/recognition action changes it.** It changes in
  no other way, and **preparation edits emit no recognition events**.
- **Presentation resolves from that shared state**, plus the optional Scenario
  override and the canonical fallback of [section 7.1](#71-the-resolution-rule).

**Per-player recognition is deferred, not rejected.** V1 builds no per-player
visibility or recognition controls, and nothing built for V1 may make per-player
recognition a redesign rather than an extension.

#### 7.4.1 Only a change during play is history

**A player-visible recognition or reveal during play produces a distinct
player-safe state-transition Activity event.** The party learned who someone is,
and that learning is part of what happened.

**That event kind is `person_identity_revealed`, and it is not a
`scenario_announcement`.** Publishing a prepared GM message
([section 8.1](#81-publication-creates-a-scenario_announcement-activity-event))
and the party recognizing a Person are different things that happened, and they
are recorded as different event kinds. `person_identity_revealed` records a
mid-play **shared-party transition from unidentified to identified**.

**Its payload snapshots the resolved player-safe label
([section 3.1](#31-the-canonical-presentation-label-and-texts)) immediately
before and immediately after recognition**, together with the player-safe references needed
to render the entry and its history. No GM-only preparation context travels with
it. **V1 snapshots no speaker or Person images and no Artifact revisions for this
event** — the same text-identity-only rule already recorded for prepared-message
speaker history in
[section 8.2](#82-speaker-identity-in-a-published-announcement).

**Preparation edits produce no Activity.** Setting or changing the initial
recognition state while preparing the Scenario is preparation, not an event, and
nothing enters Activity — the same boundary [section 8](#8-prepared-gm-messages)
draws for a prepared but unpublished message.

That asymmetry is the rule: **a change during play is history; a change during
preparation is not.** What a player-visible reveal renders in Activity is
projected under
[PPV1 §9](../architecture/player-play-v1.md#9-activity-visibility-and-projection-rules).

> **Implementing this persisted Activity kind is floor-class**, on the same basis
> as [section 8.1](#81-publication-creates-a-scenario_announcement-activity-event):
> it changes persisted player-safe/privacy-projected semantics, so the lane that
> builds it carries the [mandatory QA floor](../../AGENTS.md#mandatory-qa-floor).
> **This document settles the product decision; it authorizes no
> implementation.**

### 7.5 Override lifecycle

**An explicit Scenario override survives later canonical presentation changes.**
Editing the Person's canonical image or description does not clear, rewrite or
re-resolve an override a GM set for a Scenario. The override is a deliberate
Scenario decision and it stands.

**If an override's Artifact becomes unavailable or retired, preparation flags a
readiness error and the GM must explicitly repair or reset the override. There
is no silent fallback to the canonical presentation.** The reasoning is the
point: an unidentified-layer override exists precisely because the canonical
presentation is the thing being withheld, so quietly substituting the canonical
representation could change what players learn. The failure is therefore
surfaced as a concrete readiness issue per
[section 10](#10-preparation-readiness) and resolved by an explicit GM decision.

**The same rule holds during play, not only during preparation.** A broken
override discovered mid-play **never silently falls back to the canonical
presentation**. It surfaces as a **GM-visible error/readiness condition**, and
where a player rendering is nevertheless required for a **currently visible**
entity, players see a **neutral missing-representation placeholder** — not the
canonical image or description — until the GM **explicitly repairs the override
or resets to the canonical default**. **If the entity is not visible, nothing is
rendered.**

**That placeholder is UI chrome. It is not an Artifact, and it is explicitly not
a `generic fallback`.** It conveys **no identity-specific content**, it is **not
persisted and not shareable**, and it **does not satisfy readiness**. A neutral
placeholder reveals nothing; the canonical presentation may reveal precisely what
the GM meant to withhold.

### 7.6 The Item Scenario overlay

An Item's Scenario overlay keeps the following concepts **deliberately
independent**. Each is its own concept, and each may hold any value
independently of the others:

| Concept                           | Answers                                    |
| --------------------------------- | ------------------------------------------ |
| **Scenario membership**           | Is this Item part of this Scenario at all? |
| **Current presence**              | Is it here now?                            |
| **Current visibility**            | Can players see it now?                    |
| **Identification**                | Do players know what it is?                |
| **Possession / usability**        | Who holds it, and can it be used?          |
| **Canonical mechanical effects**  | What does it actually do under the rules?  |
| **Disclosure of those mechanics** | Do players know what it does?              |

> **Hidden mechanical modifiers continue to affect the rules even when players
> do not know about them.** Mechanical effect resolves from canonical state, not
> from what has been disclosed.

> **Do not collapse these into a single `revealed` flag.**

**Current presence and location remain owned by the Item lifecycle/service.**
Pickup, drop and movement change location or possession; concealment changes
visibility. **There is no universal `present` state across resource types** —
[Content authoring §18.22](content-authoring-scenario-preparation-and-artifact-management.md#1822-no-universal-presence-state).

The same independence governs live play, where the corresponding GM actions are
a family rather than one boolean —
[Live GM Scenario Play §8](live-gm-scenario-play.md#8-reveal-is-a-family-of-gm-ux-actions).
Presence and visibility remain the independent axes of
[#268 §5](../architecture/scenario-play-workspace.md#5-presence-versus-visibility).

### 7.7 Reveal planning prepares; play executes

**Scenario Builder may prepare intended reveals and identification. It does not
execute live reveal actions.**

Prepared intent, for example:

- a Person **starts unidentified**;
- an Item **starts hidden**;
- an Artifact **remains GM-only**;
- a **prepared message exists**.

> **Actual state-changing actions happen in live Scenario Play**
> ([Live GM Scenario Play §6](live-gm-scenario-play.md#6-the-live-gm-inspector)).

This is the same boundary [section 7.4](#74-recognition-is-shared-scenario-party-state)
draws for recognition and [section 8](#8-prepared-gm-messages) draws for
messages: **a change during play is history; a change during preparation is
not.**

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

### 8.2 Speaker identity in a published announcement

**A published `scenario_announcement` renders its speaker according to the
party's recognition state at publication time**
([section 7.4](#74-recognition-is-shared-scenario-party-state)), with the
Scenario overlay and canonical fallback of
[section 7.1](#71-the-resolution-rule) applied to that state.

**An unidentified Person must not expose canonical identity through the Activity
projection.** The canonical Person relation carried by the event may remain
**GM/history-side only**; it is not part of what the player projection carries.

**In V1, the resolved player-safe label used at publication
([section 3.1](#31-the-canonical-presentation-label-and-texts)) is snapshotted
and persisted with the event as the speaker's text identity.** Later recognition changes what
players see from that point onward; it does **not** silently rewrite historical
Activity. An announcement made by an unidentified stranger remains, in the
players' history, an announcement made by an unidentified stranger — which is
the whole reason the snapshot exists.

**The snapshot is text identity only.** An **image snapshot is not required**,
and **historical Artifact-revision semantics are not required** for Activity
messages: an Activity entry is a record of what was said and by whom it appeared
to be said, not a versioned rendering of an Artifact.

This is the same restraint as the event carrying only the safe references it
needs ([section 8.1](#81-publication-creates-a-scenario_announcement-activity-event)),
and it is part of why that lane is floor-class.

An unpublished prepared message is not recap-eligible: it is excluded from the
session-summary source by
[People/Artifact model §11.2](people-artifact-and-gm-authoring-model.md#112-the-session-summary-source-rule--activity-is-the-only-source),
and eligibility is earned by publication.

---

## 9. Encounter preparation

**Encounters are prepared subsets and context over Scenario resources.**

Scenario Builder lets the GM:

- create a prepared Encounter;
- select participants and resources **primarily from the Scenario pool**, with
  **easy access to Campaign resources when something is missing**;
- add a **short GM-only Encounter note**;
- associate relevant Items, Artifacts, Maps and messages;
- later **activate** the Encounter in Scenario Play
  ([Live GM Scenario Play §3.2](live-gm-scenario-play.md#32-encounter-lifecycle)).

**Encounter preparation stays lightweight** — the list above is its whole
scope.

**Encounter remains contextual state inside Scenario Play, not a separate
player-facing play surface**, per
[Content authoring §8.3](content-authoring-scenario-preparation-and-artifact-management.md#83-encounter-preparation)
and
[§13](content-authoring-scenario-preparation-and-artifact-management.md#13-encounter-stays-lightweight).

---

## 10. Preparation readiness

Scenario Builder gives **actionable preparation state**.

> **There is no percentage or completeness score.** Readiness reports concrete,
> derived, actionable problems and nothing else.

Reported issues are concrete, for example:

- missing representation;
- generic fallback;
- missing description;
- unresolved imported material;
- missing map;
- prepared Encounters or messages present;
- an override whose Artifact is unavailable or retired
  ([section 7.5](#75-override-lifecycle)).

**Selecting a readiness issue leads directly to the affected resource or
action.** Representation readiness itself remains **derived**, per
[Content authoring §15](content-authoring-scenario-preparation-and-artifact-management.md#15-representation-readiness);
this surface presents it and does not store a second readiness state.

> **Readiness is advisory and never blocks live improvisation.** An unresolved
> readiness issue must never prevent the GM from running the Scenario
> ([section 5.1](#51-reuse-and-improvisation)).

### 10.1 Storyline integration

Scenario Builder **shows related Storylines and Story Notes and allows links and
click-through** to them.

> **Do not embed the Storyline editor.**

Storylines remain governed by [Campaign Storylines](campaign-storylines.md),
including its privacy invariant: a Story Note is GM-only, has no visibility
control, and is never revealed
([§4](campaign-storylines.md#4-the-privacy-invariant)).

### 10.2 Planned versus historical membership

**Planned Scenario and Encounter membership may be freely edited during
preparation.**

> **Actual historical participation and use after play remains durable.**

> **Do not expose casual controls that erase campaign history.** Removing a
> Person from a Scenario's planned roster must not delete the record that they
> took part in it.

This is the durable-history rule of
[Content authoring §9](content-authoring-scenario-preparation-and-artifact-management.md#9-durable-history)
and the Encounter durable-association rule of
[Content authoring §10](content-authoring-scenario-preparation-and-artifact-management.md#10-encounter-and-artifact-ownership-versus-durable-association),
applied to this surface.

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
| [Live GM Scenario Play](live-gm-scenario-play.md)                                                                                    | The GM's live operating surface. Preparation prepares; play executes.                                                     |
| [Scenario Play Workspace](../architecture/scenario-play-workspace.md)                                                                | Play authority. Scenario Builder is preparation, not play.                                                                |
| [Player Play V1](../architecture/player-play-v1.md)                                                                                  | Player play and Activity authority, including what publication may produce.                                               |
| [Campaign, Scenario and Encounter workflows](campaign-scenario-encounter-workflows.md)                                               | Workspace responsibilities; the authoring model remains governed by the Content authoring contract.                       |
| [Product & Presentation Principles](product-presentation-principles.md)                                                              | Presentation and privacy principles these surfaces inherit.                                                               |
