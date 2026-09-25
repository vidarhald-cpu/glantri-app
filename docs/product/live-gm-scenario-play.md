# Live GM Scenario Play — product/UI contract

## 1. Status and scope

**Status:** Product Owner approved, 2026-09-25. This is the **current V1
product/UI contract** for the GM's live Scenario Play surface. Implementation is
**not** authorized by this document.

**Authority:** Product Owner ruling of 2026-09-25 on live GM Scenario Play.

### 1.1 What this contract controls

The **shape, authority and scope boundaries of the GM's live operating surface**
during a Scenario: the GM header, the live Situation list, the live Inspector,
the Messages control, contextual reveal actions, and what live play records in
Activity.

It is the GM-side counterpart of
[Player Play V1](../architecture/player-play-v1.md) and the surface the
compatibility requirement in
[PPV1 §16](../architecture/player-play-v1.md#16-relationship-to-the-later-gm-surface)
anticipates.

### 1.2 What this contract does not do

- It does **not** restate the domain model. Artifacts, typed associations,
  provenance and Scenario preparation mechanics are controlled by
  [Content authoring, Scenario preparation and Artifact management](content-authoring-scenario-preparation-and-artifact-management.md).
- It does **not** redesign the player arena. The five views, the shared header
  and the Activity projection rules remain
  [PPV1](../architecture/player-play-v1.md)'s.
- It does **not** redesign the Blackboard. The settled semantics are
  [Scenario Play Workspace §8](../architecture/scenario-play-workspace.md#8-blackboard-boundary);
  see [section 5](#5-durable-player-access-and-the-blackboard-relationship).
- It does **not** cover preparation. Campaign Material and Scenario Builder are
  governed by
  [Campaign Material and Scenario Builder](campaign-material-and-scenario-builder-ui.md).
- It does **not** authorize schema, migration, runtime or UI implementation, and
  it does not decompose into lanes.
- It does **not** reopen any open decision in the
  [People/Artifact/GM authoring model](people-artifact-and-gm-authoring-model.md#15-open-decisions--none-chosen).

The governing UX principle these surfaces share — **author once, operate in
context** — is recorded at
[Campaign Material and Scenario Builder §1.3](campaign-material-and-scenario-builder-ui.md#13-the-governing-ux-principle).

---

## 2. Same arena, different projection and authority

**This is a hard UX principle, not a preference.**

> **GM and player live-play screens use the same structural arena wherever
> possible. The GM receives additional authority and private context, not a
> fundamentally different application.**

> **Same arena, different projection and authority.**

The live tab set is **fixed and identical for both roles**:

```text
Situation | Action | Map | Blackboard | Character
```

These are the five views of
[PPV1 §5](../architecture/player-play-v1.md#5-the-five-play-views), over the one
Scenario-container arena of
[PPV1 §4](../architecture/player-play-v1.md#4-player-play-v1-information-architecture).

**GM-specific features live inside these same structures.** Live play does
**not** gain GM-only tabs such as `Admin`, `Artifact Manager` or
`Encounter Manager`, and it does not gain a parallel GM arena.

This is the product statement of
[#268 §6.3 — one state, two authorities](../architecture/scenario-play-workspace.md#63-one-state-two-authorities):
GM and player views are the same underlying Scenario/Encounter state with
different authority and different server-side projection, not two models.

Management and preparation remain on their own surfaces
([Campaign Material and Scenario Builder](campaign-material-and-scenario-builder-ui.md)),
and the existing GM Encounter workspace remains transitional GM-only management
tooling under
[PO-SPW-3](../architecture/scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling).

---

## 3. The live GM header

**Keep the header restrained.** It exposes:

- Scenario context and switching;
- active Encounter context and control;
- the standard live tabs of [section 2](#2-same-arena-different-projection-and-authority);
- a **GM view / Player projection** toggle;
- **`+ Add`**;
- **Messages** ([section 7](#7-the-messages-control-and-the-live-composer)).

> **Do not place object-specific `Reveal`, `Identify` or `Share` controls
> permanently in the header.** Those are contextual actions on a selected
> resource, and they live in the Inspector
> ([section 6](#6-the-live-gm-inspector)).

The header keeps the existing structure and replaceable GM scene text of
[PPV1 §6](../architecture/player-play-v1.md#6-shared-play-header-and-scene-text),
including the rule that the round tracker does not belong in it.

### 3.1 Scenario switching is navigation

**Scenario switching is primarily navigation and context.** It selects which
Scenario the GM is currently operating.

**No stronger Scenario exclusivity or lifecycle rule is introduced here.** Such
a rule is added only where actual product behaviour requires it.

### 3.2 Encounter lifecycle

An Encounter may be **prepared**, **active**, **paused** or **completed**.
Encounter remains contextual state inside Scenario Play rather than a separate
play destination
([#268 §6.1](../architecture/scenario-play-workspace.md#61-no-separate-encounter-play-page),
[PPV1 §7.2](../architecture/player-play-v1.md#72-no-parallel-encounter-systems)).

> **Hard V1 invariant: a Character may not participate in more than one
> **active** Encounter simultaneously.**

- A Character may have **arbitrary planned or historical associations** with any
  number of other Encounters. The invariant constrains **active** participation
  only.
- **Paused Encounter state is resumable.** Pausing does not end the Encounter,
  does not discard its participants or resources, and does not require it to be
  rebuilt on resume.
- **No timeline-branching and no snapshot semantics are introduced.** There is
  one current state per Encounter, not a tree of alternative states.

This invariant is the **only** Encounter-participation rule the live surface
enforces ([section 6.4](#64-encounter)).

### 3.3 Add and improvisation

`+ Add` is the single live entry point for bringing material into play. It
supports:

- an **existing Scenario resource**;
- an **existing Campaign resource**;
- **create Person/NPC**;
- **create Item**;
- **create Artifact / text clue**;
- **create Encounter**.

Creation during play goes through **the same canonical services** as
preparation. No parallel live-only creation path exists, and nothing created in
play is a second-class object.

> **If an active Encounter exists, adding a resource directly to it may
> establish the missing Scenario membership automatically as part of the same GM
> operation.**

**The GM is not sent back through management screens merely to satisfy
bookkeeping.** Scenario membership remains assembly by association in the sense
of
[Content authoring §8.2](content-authoring-scenario-preparation-and-artifact-management.md#82-scenario-resource-assembly);
this rule states only that the live operation may create the association it
implies, not that Encounter membership and Scenario membership are the same
thing.

---

## 4. The live Situation list

**One compact list**, structurally the same list the player sees
([PPV1 §8](../architecture/player-play-v1.md#8-situation--the-main-new-v1-screen)).

> **Show the resource first; state is secondary.**

The list supports:

- **compact category filters**;
- an **`Encounter | Scenario` scope switch**;
- a **`GM view | Player projection`** toggle;
- an easy **`+ Add to Situation`**.

When an Encounter is active, **Encounter scope may be the focused default**, but
the header or list **must remind the GM that additional Scenario resources
exist**, for example:

```text
Encounter 6 · 8 more in Scenario
```

**Switching to Scenario scope uses the same list and the same Inspector.**
Encounter members then carry a **small marker**. Scope is a filter over one
list, not a second list.

### 4.1 GM rows

A GM row shows **canonical identity**, plus the **player-facing identity where
it differs**:

```text
Captain Varro
Players see: The officer
```

**The `Players see:` value is the resolved player-safe label** of the layer the
party's shared Scenario recognition state selects, after the Scenario overlay,
per
[Campaign Material and Scenario Builder §3.1](campaign-material-and-scenario-builder-ui.md#31-the-canonical-presentation-label-and-texts),
[§7.1](campaign-material-and-scenario-builder-ui.md#71-the-resolution-rule) and
[§7.4](campaign-material-and-scenario-builder-ui.md#74-recognition-is-shared-scenario-party-state).
Where no label is set it takes that section's fallback — `Unidentified person`
at the unidentified layer, the canonical player-facing Person name at the
identified layer. **It is never sourced from the GM dossier.**

- **Hidden resources remain visible to the GM.** Hidden means hidden from
  players, never hidden from the GM.
- **Absent or non-current resources should not clutter the focused Situation
  list.**
- **Encounter membership is a small marker**, not repeated textual state on
  every row.
- **Supporting representation Artifacts must not appear as duplicate rows**
  unless they are independently meaningful live material. A Person's portrait is
  part of that Person's row, not a second row.

### 4.2 Presence and current visibility are transient

**Current visibility is transient.** A Person may leave or hide; an Item may be
picked up or concealed.

> **Leaving current sight does not revoke player knowledge or access already
> gained.**

Presence and visibility remain the independent axes of
[#268 §5](../architecture/scenario-play-workspace.md#5-presence-versus-visibility):
presence gates usability, visibility gates knowledge, and revealing something
does not move it.

### 4.3 Presence is typed per resource

> **No universal `present` state exists across resource types.**

| Resource     | What presence means live                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Person**   | contextual **Situation/Encounter presence**; **leaving changes presence, hiding changes visibility**                                                                    |
| **Item**     | physical presence and location **remain owned by the Item lifecycle/service**; **pickup, drop and movement change location/possession, concealment changes visibility** |
| **Artifact** | live state is **access/share**, not physical presence                                                                                                                   |

**Encounter participation remains distinct from Situation presence.**

> **The live UI may use common verbs where useful, but they dispatch typed
> domain operations rather than one generic presence/reveal flag.**

**This is the same idea as [section 8](#8-reveal-is-a-family-of-gm-ux-actions),
applied a second time.** `Reveal` is a family of GM UX actions rather than a
domain boolean; presence is likewise a family of typed domain operations rather
than one stored flag. One shared verb in the UI, typed domain operations
underneath. The domain form is
[Content authoring §18.22](content-authoring-scenario-preparation-and-artifact-management.md#1822-no-universal-presence-state).

---

## 5. Durable player access and the Blackboard relationship

Three concepts are **distinct** and must not be collapsed:

| Concept                        | Means                                                    |
| ------------------------------ | -------------------------------------------------------- |
| **Situation**                  | what players can perceive **now**                        |
| **Player-accessible material** | what the table has **legitimately learned or received**  |
| **Blackboard**                 | what players **currently choose to keep in shared view** |

### 5.1 Glantri does not model forgetting in V1

**Previously accessible People, Items and Artifacts may remain accessible after
they leave the Situation.**

> **Blackboard removal does not revoke access, does not unreveal, does not
> delete, and does not alter history.**

This is the already-settled behaviour of
[#268 §8.2](../architecture/scenario-play-workspace.md#82-who-may-act-and-what-it-changes)
and the durable shared-material collection of
[#268 §8.3](../architecture/scenario-play-workspace.md#83-the-durable-shared-material-collection),
restated here only as the live-play consequence. **Reveal, Share, and place or
remove on the Blackboard remain the three distinct operations named in
[#268 §4.5](../architecture/scenario-play-workspace.md#45-reveal-and-share-are-two-different-operations).**

> **This contract cross-references the existing Blackboard architecture and does
> not redesign it.** The deferral in
> [#268 §8.4](../architecture/scenario-play-workspace.md#84-not-a-blackboard-redesign)
> and
> [Campaign Management V2 §9](../architecture/campaign-management-v2.md#9-blackboard-boundary)
> stands.

> **Blackboard is already architecturally scoped but still needs a later compact
> UI/workflow design pass.** That pass is not performed here and is not
> authorized here. It is recorded separately as
> [Campaign Blackboard V1](campaign-blackboard-v1.md).

### 5.2 People are valid Blackboard material

**A Person is valid Blackboard material, using the current player-safe Person
presentation.**

- An **unidentified** Person uses the **general/unidentified presentation**.
- After recognition, the Blackboard card **may update to the identified
  presentation**.

**No per-player knowledge enforcement exists in V1.** Recognition is party-wide
Scenario state
([Campaign Material and Scenario Builder §7.4](campaign-material-and-scenario-builder-ui.md#74-recognition-is-shared-scenario-party-state)),
and the Blackboard invariant that Glantri does not adjudicate what another
player's Character could know
([#268 §8.1](../architecture/scenario-play-workspace.md#81-core-invariant))
is unchanged.

---

## 6. The live GM Inspector

**One structural pattern, reused for every resource type:**

1. **current player-facing preview** — `Players currently see…`, rendering the
   resolved player-safe label and presentation of
   [Campaign Material and Scenario Builder §3.1](campaign-material-and-scenario-builder-ui.md#31-the-canonical-presentation-label-and-texts);
2. **current state**;
3. a **small set of state-relevant primary actions**;
4. **GM-only context**;
5. **related resources**;
6. a secondary **`More…` / canonical click-through**.

> **Keep permanent primary actions to approximately 2–3 at a time.** The set is
> state-relevant: an action that cannot apply now is not occupying a primary
> slot.

The click-through half is the existing rule of
[PPV1 §13](../architecture/player-play-v1.md#13-canonical-detail-and-click-through-rule):
show the useful summary where it is needed, click through to the canonical place
where full information lives.

### 6.1 Person

Possible live actions:

- **Reveal identity**;
- **show / hide** — the **visibility** operation, distinct from presence
  ([section 4.3](#43-presence-is-typed-per-resource));
- **add to / remove from the active Encounter**;
- **publish a prepared speaker message**;
- **create an ad-hoc speaker message**.

> **The GM dossier/note is private and is never revealable.** Its structural
> exclusion under
> [People/Artifact model §6.1](people-artifact-and-gm-authoring-model.md#61-the-gm-only-dossier)
> is unchanged, and no live action exposes it.

`Reveal identity` is the mid-play recognition transition of
[Campaign Material and Scenario Builder §7.4.1](campaign-material-and-scenario-builder-ui.md#741-only-a-change-during-play-is-history)
and produces `person_identity_revealed`
([section 9](#9-historical-activity)).

### 6.2 Item

Possible live actions:

- **Reveal Item**;
- **Identify Item**;
- **add to / remove from the Encounter**.

> **Item mechanical effects apply from canonical state regardless of player
> knowledge.** A hidden modifier still affects the rules.

- **The Item GM note is private and is never revealable.**
- **No Item-mechanics editing happens in the live Inspector.** Mechanics,
  inventory, equip state and quantities stay in their canonical editors, per
  [Campaign Material and Scenario Builder §3.3](campaign-material-and-scenario-builder-ui.md#33-the-item-inspector-in-campaign-material).

The independence of Scenario membership, presence, visibility, identification,
possession/usability, canonical mechanical effect and disclosure of that effect
is recorded at
[Campaign Material and Scenario Builder §7.6](campaign-material-and-scenario-builder-ui.md#76-the-item-scenario-overlay)
and is binding on this surface.

### 6.3 Artifact

Possible live action:

- **Share / remove current Campaign-player access.**

> **Sharing must not leak hidden canonical identity or association metadata.** A
> shared Artifact carries what the players may see and nothing more; the
> server-side projection rules of
> [Authority and Information Projection](../architecture/information-authority-and-projection.md#projection-rules)
> govern what any viewer receives.

Artifact access itself is the current Campaign-level state of
[Campaign Material and Scenario Builder §2.4](campaign-material-and-scenario-builder-ui.md#24-artifact-access-is-campaign-level-and-current)
— **exactly `GM only` or `Shared with Campaign players`**. **Scenario or
Encounter membership never grants access**, and any residual legacy audience
state **fails closed to `GM only`**
([Content authoring §18.24](content-authoring-scenario-preparation-and-artifact-management.md#1824-artifact-access-states-and-the-legacy-scenario-audience)).

### 6.4 Encounter

Possible live actions: **Activate**; **Pause**; **End**; **Add resource**.

> **Enforce only the one-active-Encounter-per-Character invariant**
> ([section 3.2](#32-encounter-lifecycle)). No further Encounter-participation
> rule is enforced live.

### 6.5 Prepared message

Possible live actions: **Preview**; **Edit**; **Publish**.

**Publication produces a `scenario_announcement` Activity event**, per
[Campaign Material and Scenario Builder §8.1](campaign-material-and-scenario-builder-ui.md#81-publication-creates-a-scenario_announcement-activity-event).

**The speaker label uses the current player-safe recognition state**, and the
player-safe text identity is snapshotted at publication, per
[Campaign Material and Scenario Builder §8.2](campaign-material-and-scenario-builder-ui.md#82-speaker-identity-in-a-published-announcement)
and
[Content authoring §18.16](content-authoring-scenario-preparation-and-artifact-management.md#1816-prepared-message-speaker-history-is-text-identity-in-v1).

---

## 7. The Messages control and the live composer

**The permanent `Messages` control supports both prepared messages and immediate
ad-hoc GM announcements.** It is one control, not two.

The V1 quick composer carries:

- **text**;
- an **optional speaker Person**, published under that Person's **resolved
  player-safe label**
  ([Campaign Material and Scenario Builder §8.2](campaign-material-and-scenario-builder-ui.md#82-speaker-identity-in-a-published-announcement));
- an **optional relation** to the current Person, Item, Artifact or Encounter;
- **`Publish now`**;
- an optional **`Save as prepared`**.

> **`Publish now` is the primary live action.** **No formal message-object
> creation step is required before immediate publication.** The GM types and
> publishes.

- **No per-player audience selector exists in V1. Publication is party-wide**,
  unchanged from
  [Campaign Material and Scenario Builder §8](campaign-material-and-scenario-builder-ui.md#8-prepared-gm-messages).
- Where the currently selected resource provides useful context, the composer
  **defaults the speaker and related object intelligently but visibly** — the
  GM can always see what was defaulted and change it before publishing.
- **V1 builds no dialogue trees and no automatic narrative triggers.**

A published message is a GM announcement in the sense of
[PPV1 §9.3](../architecture/player-play-v1.md#93-gm-announcements-versus-scene-text)
and is **not** replaceable scene text.

---

## 8. Reveal is a family of GM UX actions

> **`Reveal` is a family of GM UX actions, not a universal domain boolean.**

| Resource     | Live GM action              |
| ------------ | --------------------------- |
| **Person**   | Reveal identity             |
| **Item**     | Reveal Item / Identify Item |
| **Artifact** | Share                       |
| **Message**  | Publish                     |

> **Presence, visibility, identification, usability, Artifact access and
> mechanical effect remain distinct.** They must not collapse into one another,
> and they must not collapse into a single stored `revealed` flag.

This is the live-play form of the same rule recorded for preparation at
[Campaign Material and Scenario Builder §7.6](campaign-material-and-scenario-builder-ui.md#76-the-item-scenario-overlay),
and it is consistent with — not a widening of — the reserved vocabulary in
[#268 §4.5](../architecture/scenario-play-workspace.md#45-reveal-and-share-are-two-different-operations),
where `reveal` names the GM visibility operation and never the Blackboard
operations.

**The same principle governs presence**
([section 4.3](#43-presence-is-typed-per-resource)): a common live verb
dispatches typed domain operations, and never a single generic
presence/reveal flag.

---

## 9. Historical Activity

Live play preserves exactly these two event kinds for the behaviour described
here:

| Event kind                 | Produced by                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `scenario_announcement`    | publishing a message ([section 6.5](#65-prepared-message), [section 7](#7-the-messages-control-and-the-live-composer)) |
| `person_identity_revealed` | a mid-play recognition transition ([section 6.1](#61-person))                                                          |

Their semantics are settled elsewhere and are **not restated or varied here**:
[Content authoring §18.15](content-authoring-scenario-preparation-and-artifact-management.md#1815-scenario-recognition-is-a-distinct-activity-event-kind)
and
[§18.16](content-authoring-scenario-preparation-and-artifact-management.md#1816-prepared-message-speaker-history-is-text-identity-in-v1),
with the product/UI form in
[Campaign Material and Scenario Builder §7.4.1](campaign-material-and-scenario-builder-ui.md#741-only-a-change-during-play-is-history)
and
[§8.1](campaign-material-and-scenario-builder-ui.md#81-publication-creates-a-scenario_announcement-activity-event).

Two rules bear repeating because they govern this surface directly:

- **Preparation-state edits emit no Activity.** A change during play is history;
  a change during preparation is not.
- **`person_identity_revealed` snapshots player-safe before/after text labels,
  not images.**

**The main GM Activity view remains the shared player-safe narrative history** —
the same history the players have, seen from the GM's seat.

> **A richer GM audit is deferred. It is not a V1 requirement**, is not designed
> here and is not authorized here.

What any viewer receives is projected under
[PPV1 §9](../architecture/player-play-v1.md#9-activity-visibility-and-projection-rules).

> **Implementing either persisted Activity kind is floor-class**, so the lane
> that builds it carries the
> [mandatory QA floor](../../AGENTS.md#mandatory-qa-floor). **This document
> settles product behaviour; it authorizes no implementation.**

---

## 10. V1 non-goals

These are **explicit non-goals**. They carry the same weight as the scope above,
and nothing in this contract may be read as authorizing them.

| Not built in V1                                                            |
| -------------------------------------------------------------------------- |
| **Per-player visibility or recognition**                                   |
| **Simulated forgetting**                                                   |
| A **generic visibility ACL system**                                        |
| A **generic context override hierarchy**                                   |
| An **image or map drawing system**                                         |
| A **dialogue-tree or automation engine**                                   |
| **Timeline branching**                                                     |
| A general-purpose **knowledge-management, wiki or task-management system** |
| **Duplicate Character or Item editors**                                    |

Per-player recognition remains **deferred, not rejected**
([Campaign Material and Scenario Builder §7.4](campaign-material-and-scenario-builder-ui.md#74-recognition-is-shared-scenario-party-state)):
nothing built for V1 may make it a redesign rather than an extension.

### 10.1 Strongly synchronized multiplayer liveness

**The realtime architecture is an explicit decision required before the first
strongly synchronized multiplayer live-play slice**, recorded at
[Content authoring §18.26](content-authoring-scenario-preparation-and-artifact-management.md#1826-realtime-synchronization-is-an-explicit-architecture-decision).
Strong synchronization means players and GM observing the same live state
without a manual refresh, at an interaction latency the surface promises.

**No transport is chosen.** Selecting one is that decision, not a Builder
choice. The repository carries **no realtime transport today** and liveness is
**client polling**.

**It blocks nothing already authorized** — not Campaign Material authoring, not
the Scenario GM Plan, not Combat A3 preparation. It gates the synchronized
multiplayer slice and nothing earlier.

---

## 11. Relationship to existing contracts

| Document                                                                                                                             | Relationship                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Player Play V1](../architecture/player-play-v1.md)                                                                                  | **Controlling** for the play arena, the five views, the shared header and Activity projection. This contract is its GM-side counterpart under [§16](../architecture/player-play-v1.md#16-relationship-to-the-later-gm-surface). |
| [Scenario Play Workspace](../architecture/scenario-play-workspace.md)                                                                | **Controlling** for play authority, presence versus visibility, the Reveal/Share vocabulary and the Blackboard boundary.                                                                                                        |
| [Content authoring, Scenario preparation and Artifact management](content-authoring-scenario-preparation-and-artifact-management.md) | **Controlling** for the domain model, Scenario preparation mechanics and the Activity event kinds this surface produces.                                                                                                        |
| [Campaign Material and Scenario Builder](campaign-material-and-scenario-builder-ui.md)                                               | The preparation surfaces this surface operates over. Preparation prepares; play executes.                                                                                                                                       |
| [People, Artifacts and GM authoring](people-artifact-and-gm-authoring-model.md)                                                      | Records the #284 rulings and open decisions; this contract reopens none of them.                                                                                                                                                |
| [Campaign Storylines](campaign-storylines.md)                                                                                        | GM-only Campaign narrative authoring; it is never live-play material and is never revealed.                                                                                                                                     |
| [Authority and Information Projection](../architecture/information-authority-and-projection.md)                                      | Server-side projection authority. A viewer never receives GM-private material through a play surface.                                                                                                                           |
| [Maps / Spatial Play](../architecture/maps-spatial-play.md)                                                                          | The Map view's own authority; unchanged by this contract.                                                                                                                                                                       |
| [Product & Presentation Principles](product-presentation-principles.md)                                                              | Presentation and privacy principles this surface inherits.                                                                                                                                                                      |
