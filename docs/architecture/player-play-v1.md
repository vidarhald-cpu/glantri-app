# Player Play V1 — Durable Composition Contract

## 1. Status and scope

**Portfolio area:** Campaign and narrative encounters / Combat experience\
**Milestone:** Player Play V1\
**Architecture state:** Recorded from the Product Owner specification; implementation not authorized\
**Date recorded:** 2026-09-22\
**Recorded against:** `dev@ab88b2edaf5ebe18a367f1b5b793413cf910082a`\
**Source of authority:** [#282 [PLAY] Player Play V1 — composition contract and implementation decomposition](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/282),
which is the Product Owner specification in 22 numbered sections. This document
records that specification durably; it does not extend or reinterpret it.

This contract is the **player-facing composition and navigation** layer built on
top of the integrated [Scenario Play Workspace](scenario-play-workspace.md)
contract recorded for
[#268](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/268).

> **#268's settled domain decisions are not reopened by this contract.**
> [PO-SPW-1](scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics),
> [PO-SPW-2](scenario-play-workspace.md#po-spw-2--settled-the-blackboard-is-meta-level-player-collaboration)
> and
> [PO-SPW-3](scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling)
> remain settled and closed. Where this contract needs one of those facts it
> **links to #268** instead of restating, narrowing, or re-deciding it.
> See [section 15](#15-relationship-to-268-and-other-existing-contracts).

It is an **area presentation contract** in the sense of
[Product & Presentation Principles §2.3](../product/product-presentation-principles.md#23-area-specific-presentation-contracts)
and
[§5](../product/product-presentation-principles.md#5-area-specific-presentation-contracts),
grown from the real workflows now in the app as
[§4.13](../product/product-presentation-principles.md#413-grow-area-contracts-from-real-workflows)
requires.

### 1.1 What this contract does not do

- It **does not authorize implementation**, Builder dispatch, branch creation,
  schema migration, or PR work. [Section 17](#17-proposed-implementation-decomposition)
  proposes bounded slices; each still requires its own authorization through the
  canonical lifecycle.
- It **does not design the GM management overhaul**. See
  [section 16](#16-relationship-to-the-later-gm-surface).
- It **does not redesign** Combat, Skill Roll, the Character sheet, Physical
  State, Equipment/Equip Item, Map internals, Blackboard internals, or the Skill
  and Combat calculation engines. See [section 3](#3-governing-guardrail--composition-not-redesign).
- It **does not redesign the storage or calculation architecture**. See
  [section 11.4](#114-storage-and-calculation-architecture-is-not-redesigned-here).
- It **introduces no new domain primitive**, and relies on the existing-model
  evidence already recorded in
  [Scenario Play Workspace §10](scenario-play-workspace.md#10-existing-model-evidence).

---

## 2. Product objective and success criterion

Glantri now has enough underlying functionality to be made usable for meaningful
playtesting. The standing playtest-foundation priorities are unchanged:

1. the Skill system and its documentation becoming complete, canonical and usable;
2. a functional Combat system;
3. Artifact intake/upload that actually works.

**Artifact intake is now sufficiently functional to use as a real playtest
component.** It was exercised manually in the running app with a Captain Varro
portrait: an ordinary PNG plus simple semantic JSON; staging and preview before
canonical creation; Glantri-derived MIME, size, SHA-256 and storage identity;
explicit GM acceptance creating the Artifact; Campaign sharing making it visible
to the player.

The objective now is a **coherent player Play arena**, without turning this into
a redesign of working systems.

> **Success criterion.** Move from the current collection of working but
> separated screens toward a **coherent player experience without rebuilding
> those screens**. A player should experience **Situation** (what is
> happening?), **Action** (what am I doing now?), **Map** (where are we?),
> **Blackboard** (what are the players discussing?) and **Character** (what can
> I currently do?) as parts of the same Play arena.

This restates, for the player surface, the existing product outcome in
[Scenario Play Workspace §2](scenario-play-workspace.md#2-product-outcome): the
Scenario surface is the canonical Scenario Play Workspace.

---

## 3. Governing guardrail — composition, not redesign

This is primarily a **composition and reorganization** project. Existing working
UI and mechanics took substantial effort and must be reused.

### 3.1 Not authorization to redesign

**This contract is not authorization to redesign:** Combat interaction; Skill
Roll widgets; Character sheet; Physical State; Equipment / Equip Item workflows;
Map internals; Blackboard internals; Skill or Combat calculation engines.

**Work from the outside inward:**

```text
navigation -> page composition -> panel placement -> only narrowly necessary component adaptation
```

### 3.2 What Builders may normally do

A Builder implementing an authorized slice under this contract may normally:

- embed or relocate existing components;
- introduce a shared Play shell;
- hide duplicated page framing;
- add compact wrappers and summaries;
- pass Scenario/Encounter context into existing components;
- add an Inspector;
- add click-through navigation to canonical detail views;
- lightly adapt an existing component so that it composes cleanly.

### 3.3 What Builders may not do without separate Product Owner authorization

They **may not** replace or materially redesign the underlying widgets or
workflows. Specifically, without separate Product Owner authorization a Builder
may not:

- replace or materially redesign Combat interaction or Combat controls;
- replace or materially redesign the Skill Roll / task widget or its mechanics;
- replace or materially redesign the Character sheet, Physical State, or the
  Equipment / Equip Item workflows;
- redesign Map internals or Blackboard internals;
- change, duplicate, or route around the Skill or Combat calculation engines;
- create a second Character model, a second inventory, a second Skill or Combat
  calculation path, or a second player event/history model;
- redesign the storage/calculation architecture in order to make a UI
  composition fit (see [section 11.4](#114-storage-and-calculation-architecture-is-not-redesigned-here));
- absorb the existing GM Encounter workspace (see
  [section 16](#16-relationship-to-the-later-gm-surface) and
  [PO-SPW-3](scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling));
- absorb any capability recorded as deferred in
  [section 14](#14-deferred-capabilities).

> **A slice that cannot deliver its outcome without crossing this boundary is a
> stop condition.** Return it to the Product Owner for decision rather than
> assuming authorization.

### 3.4 Existing routes remain available until playtested

**Existing routes normally remain available** until the composed replacement has
been playtested.

```text
introduce -> playtest -> redirect/remove later
```

A composition slice therefore adds the Play view first and leaves the current
route working. Retiring, redirecting, or removing an existing route is a
**separate, later decision** taken after playtest evidence, not part of the
slice that introduces the composed surface. This is the change-management
counterpart of
[Campaign Management V2 §6.2](campaign-management-v2.md#62-index-behavior-and-canonical-homes):
an object keeps one canonical home while the composed surface is proven.

---

## 4. Player Play V1 information architecture

The player experiences **one Play arena**, not a hierarchy of
Campaign -> Scenario -> Encounter -> Combat pages.

```text
Campaign
  └── Scenario                      persistent player Play container
        ├── (optional) Encounter    contextual state, not a destination
        └── PLAY ARENA
              ├── shared Play header   Scenario · optional ENCOUNTER · GM scene text
              └── views: Situation | Action | Map | Blackboard | Character
```

Four architectural facts govern the arena:

1. **The Scenario is the container.** This is the player-facing statement of
   [Scenario Play Workspace §6.1](scenario-play-workspace.md#61-no-separate-encounter-play-page)
   and of
   [Campaign Management V2 §3.1](campaign-management-v2.md#31-no-separate-play-hierarchy):
   no separate Encounter play page, and no second navigation hierarchy for an
   object that already has a canonical home.
2. **The five views are views of one current game state**, not unrelated pages.
3. **State is preserved when moving between views.** For example: a player
   begins preparing a Combat declaration, switches to Map to inspect tactical
   position, returns to Action, and the unfinished declaration state is intact.
   Likewise Situation -> inspect Captain Varro -> full Artifact -> Back returns
   to Situation with previous context and selection preserved where practical.
   This is the play-surface application of
   [Product & Presentation Principles §4.4](../product/product-presentation-principles.md#44-preserve-continuity-and-distinguish-state-over-time).
4. **Views compose existing canonical surfaces; they do not clone them.** A Play
   view embeds or reuses the canonical Map, Blackboard, Character, Combat and
   Skill Roll surfaces. It does not create a parallel home for those objects, so
   this is composition inside the Scenario's own canonical play surface rather
   than the second navigation hierarchy that
   [Campaign Management V2 §3.1](campaign-management-v2.md#31-no-separate-play-hierarchy)
   prohibits. See [section 15.1](#151-reconciliations).

---

## 5. The five Play views

| View           | Answers                                                             | Owns                                                                                                                                                 | Does not own                                                               |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Situation**  | What is happening, who and what is here, and what has just changed? | People / Items / Artifacts selectors, the Inspector, and shared Activity history.                                                                    | Rolls, declarations, the round tracker, detailed calculation arithmetic.   |
| **Action**     | What am I doing now?                                                | The round tracker while 3-second rounds are active, the existing player Combat UI, the existing Skill Roll / task widget, and recent rolls/outcomes. | Shared table history, Character planning detail, map interaction.          |
| **Map**        | Where are we?                                                       | The existing Map view and its internals, reached without losing Action state.                                                                        | Artifact identity, Map redesign, tactical rules.                           |
| **Blackboard** | What are the players discussing?                                    | The existing Blackboard surface, under the settled #268 semantics.                                                                                   | Game-world state of any kind.                                              |
| **Character**  | What can I currently do?                                            | The existing Character presentation: effective/current values, Skills, Physical State, encumbrance-dependent stats, and a current equipment summary. | A second Character model, a second inventory, a second calculation system. |

Each view is detailed below: Situation in [section 8](#8-situation--the-main-new-v1-screen),
Action in [section 10](#10-action-composition), Map in
[section 12.1](#121-map), Blackboard in [section 12.2](#122-blackboard), and
Character in [section 11](#11-character-inside-play-and-the-charactercampaign-ownership-boundary).

---

## 6. Shared Play header and scene text

Keep the current general header structure as far as practical. It identifies the
Scenario and, where applicable, the active Encounter, and supports
**replaceable GM scene text** — current colour and framing, for example:

```text
Rain beats against the gatehouse roof. Torchlight leaks through the shutters.
```

```text
Varro's men have formed a loose semicircle around the doorway.
```

Rules:

- Scene text is **current framing**, replaceable by the GM.
- It is **not** Activity, and **not** history.
- It is **not** a substitute for GM announcements. See
  [section 9.3](#93-gm-announcements-versus-scene-text).
- Where Scenario and Encounter each have scene text, **Encounter framing takes
  precedence while the Encounter is active.**
- **The round tracker does not belong in the common Play header.** It appears on
  Action only when the game is actually tracking time in 3-second rounds. See
  [section 10.1](#101-round-tracker).

---

## 7. Scenario versus Encounter behaviour

**Scenario is the persistent player Play container. Encounter is optional
contextual state inside the Scenario.**

Entering an Encounter must **not** navigate the player to another player page —
the same Play arena remains. The Encounter is visibly indicated by restrained
treatment such as a header tag or frame/border.

This is the player-facing form of distinctions D1 and D2 in
[Scenario Play Workspace §3](scenario-play-workspace.md#3-controlling-distinctions),
and of
[§6.1](scenario-play-workspace.md#61-no-separate-encounter-play-page).

### 7.1 An Encounter changes the projection of state

An Encounter changes the **projection** of state:

- it has its own participant roster; not every Campaign/Scenario character need
  be present;
- People reflects Encounter participants where appropriate;
- Items reflects what is present in the Encounter context;
- Campaign/Encounter modifiers affect current calculated values;
- players cannot manipulate equipment or Items that are elsewhere or not present;
- Combat may begin inside the Encounter;
- Activity records relevant Encounter transitions.

The presence/visibility semantics behind these projections are already settled
in [Scenario Play Workspace §5](scenario-play-workspace.md#5-presence-versus-visibility),
and the usability gate for Items that exist but are stored elsewhere is already
settled in [§7](scenario-play-workspace.md#7-player-inventory). This contract
adds only where the projection appears in the player arena.

### 7.2 No parallel Encounter systems

> **Do not create parallel Encounter-specific Character, Equipment, Skill or
> Combat systems.**

The same Character UI, the same equipment authority, the same Skill widget and
the same Combat components are used inside an Encounter; only the projected
context differs. This is the player-surface reading of
[one state, two authorities](scenario-play-workspace.md#63-one-state-two-authorities).

---

## 8. Situation — the main new V1 screen

Situation answers: **"What is happening, who and what is here, and what has just
changed?"** Keep it compact.

```text
┌──────────────────────────────────────────────────────────────┐
│ EXISTING HEADER                                              │
│ Scenario · optional ENCOUNTER                                │
│ Replaceable GM scene text                                    │
├──────────────────────────────────────────────────────────────┤
│ Situation   Action   Map   Blackboard   Character            │
├──────────────────┬───────────────────────────────────────────┤
│ PEOPLE           │                                           │
│ narrow list      │                                           │
│                  │              INSPECTOR                    │
│ ITEMS            │                                           │
│ narrow list      │       large visual / detail area          │
│                  │                                           │
│ ARTIFACTS        │       click through to full canonical view│
│ narrow list      │                                           │
├──────────────────┴───────────────────────────────────────────┤
│ ACTIVITY                                                     │
│                                                              │
│ GM announcement                                              │
│ automatic event                                              │
│ shared Skill / Combat outcome                                │
│                                                              │
│                  older history continues below ↓             │
└──────────────────────────────────────────────────────────────┘
```

### 8.1 Left selectors

Three narrow lists, **primarily selectors rather than detailed cards**. Keep row
content sparse: name, a small type/state cue, and perhaps a thumbnail where one
is already cheaply available.

- **People** — PCs and visible/relevant NPCs; during an Encounter use the
  Encounter roster/context; filters All / PCs / NPCs; simple search.
- **Items** — physical game-world Items present or relevant in the current
  context; simple search.
- **Artifacts** — current relevant/shared material; simple search. **Do not dump
  every Artifact ever revealed in the Campaign into this narrow rail**; full
  durable shared material must remain reachable separately, in the
  [durable shared-material collection](scenario-play-workspace.md#83-the-durable-shared-material-collection)
  that #268 already requires.

People and Items are projections, never authorities: what is **present** is
canonical state, and what is **visible** is a separate axis, exactly as
[Scenario Play Workspace §5](scenario-play-workspace.md#5-presence-versus-visibility)
records. A player Situation rail must never become the authority for presence.

### 8.2 Inspector

The Inspector **dominates the upper Situation screen** and must be **much wider
than the selector lists** — a narrow selector rail, with the remaining majority
of the width given to the Inspector.

It is a **generic visual/detail area, not a new domain model**:

| Selection      | Inspector shows                   |
| -------------- | --------------------------------- |
| NPC            | portrait plus visible information |
| Item           | image, details, available actions |
| Artifact       | large preview                     |
| map Artifact   | preview                           |
| activity event | relevant detail where useful      |

**Make visual content substantial** rather than showing portraits and maps as
tiny sidebars. Include **Open full view** where an existing canonical full view
exists; the full-viewport inspection pattern required by
[Campaign Management V2 §8](campaign-management-v2.md#8-artifact-and-image-inspection)
is the canonical destination, not something the Inspector reimplements.

With nothing selected, prefer a useful but simple default: the most recently
relevant/selected visual where available; otherwise the Scenario visual or
current relevant material; otherwise a neutral empty state. **Do not over-design
the empty state.**

### 8.3 Activity placement

Activity sits **below** the selector/Inspector area, **across the full page
width** — not in another narrow column. This lets history continue naturally
down the page and below the fold. **Prefer natural page scrolling over an
immediate small internal scrollbar.**

---

## 9. Activity visibility and projection rules

### 9.1 What Activity is

Activity is the shared, table-visible history:

- GM announcements;
- Scenario/Encounter transitions where relevant;
- visible NPC actions;
- Item pickup/drop/equip where appropriate;
- shared Skill Roll outcomes;
- shared Combat outcomes;
- Critical/injury outcomes where player-visible;
- useful Artifact reveal/share events;
- other automatic game events belonging in shared history.

**GM announcements visually stand out from routine automatic events.**

```text
GM
The eastern door slams shut.

Test Hunter · Observation — SUCCESS

Sergeant attacks Test Hunter — PARRIED

GM
You hear somebody moving behind the north wall.
```

> **Do not create several competing player logs** if one event/history model can
> provide different projections.

This is the play-surface application of
[one visible source of truth](../product/product-presentation-principles.md#411-maintain-one-visible-source-of-truth).

### 9.2 The visibility rule

> **Shared Activity publishes the outcome, not private mechanical calculation
> detail.**

Situation may show `Test Hunter · Observation — Success`. It need not show
`base 54 + situational 10 - fatigue 2 ...`. Combat may publish
`Test Hunter attacks Sergeant — Hit, C Critical` while the player's Combat
Outcome panel retains the detailed calculation.

| Shared in player Activity                          | Not shared in player Activity                               |
| -------------------------------------------------- | ----------------------------------------------------------- |
| GM announcements                                   | detailed modifier/calculation arithmetic                    |
| visible automatic events                           | private player-specific mechanical detail not table-visible |
| concise Skill outcomes                             | GM-only notes and events                                    |
| concise Combat outcomes                            | private messages and chat                                   |
| other information legitimately shared at the table |                                                             |

**Detailed calculations remain in their existing canonical/player views.** This
is a projection rule, not a reduction of what entitled users may see:
[Product & Presentation Principles §4.6](../product/product-presentation-principles.md#46-show-important-rolls-and-calculation-context-to-entitled-users)
continues to govern the detailed views, and
[§4.5](../product/product-presentation-principles.md#45-respect-perspective-knowledge-ownership-privacy-and-visibility)
continues to govern who receives what. Server-side projection authority is
unchanged and remains that of
[Authority and Information Projection](information-authority-and-projection.md#projection-rules),
as [Scenario Play Workspace §5](scenario-play-workspace.md#5-presence-versus-visibility)
records.

### 9.3 GM announcements versus scene text

**Scene text** is replaceable current framing, living with the Play/Scenario
presentation; it is not a chronological event.

**A GM announcement** is something the GM tells the players happened or is
happening; it becomes a durable, highlighted Activity event.

|              | Scene text             | GM announcement            |
| ------------ | ---------------------- | -------------------------- |
| Nature       | current framing        | chronological event        |
| Lives in     | the Play header        | Activity                   |
| Lifecycle    | replaceable            | durable                    |
| Presentation | restrained header text | highlighted Activity entry |

Later, support **prepared announcements** associated with a Scenario/Encounter,
so the GM can prepare narration and publish it with an **Announce** action
during play rather than typing live. **Prepared announcements are a deferred
bounded capability, not part of the first composition slice.** See
[section 14](#14-deferred-capabilities).

---

## 10. Action composition

Action answers: **"What am I doing now?"**

> **Do not design a new unified action engine.** V1 primarily stacks and reuses
> existing components.

```text
┌───────────────────────────────────────────────────────────────┐
│ ROUND TRACKER — only while 3-second rounds are active         │
├───────────────────────────────────────────────────────────────┤
│ compact current state / modifiers if already available        │
│ [click through to Character / Physical State]                 │
├───────────────────────────────────────────────────────────────┤
│ EXISTING PLAYER COMBAT UI — when Combat is active             │
├───────────────────────────────────────────────────────────────┤
│ EXISTING SKILL / TASK ROLL UI                                 │
├───────────────────────────────────────────────────────────────┤
│ RECENT ROLLS / OUTCOMES                                       │
└───────────────────────────────────────────────────────────────┘
```

### 10.1 Round tracker

Players **do** need it — it is fundamental board-game state indicating whose turn
and phase it is.

- It appears **only when 3-second round tracking is actually active**.
- It **belongs on Action**, not on Situation, Map, Blackboard or Character, and
  not in the shared Play header ([section 6](#6-shared-play-header-and-scene-text)).

### 10.2 Combat

**Reuse the current player Combat interaction.** Current player Combat carries
too much surrounding and stacked page furniture before the useful combat area.

The V1 goal is to:

1. retain the player round tracker;
2. retain the working declaration/interaction/outcome components;
3. remove or hide duplicated or irrelevant surrounding framing that composition
   makes redundant.

> **Do not redesign Combat controls in this project.**

The canonical declaration grammar, phase panels and modifier authority remain
those already documented for Player Combat in
[Campaign, Scenario, and Encounter Workflows](../product/campaign-scenario-encounter-workflows.md#encounter-workspace)
and the Combat area contracts. Composition changes where the components sit, not
what they mean.

### 10.3 Skill Roll

Place the existing Skill Roll / task widget **below** the Combat area.

- It remains available **during** Combat, because players may still need
  non-attack Skill rolls.
- Outside Combat there is **no empty Combat block**; Action then contains
  primarily Skill Roll plus relevant status and outcomes.

### 10.4 Roll history

Skill rolls need player-visible recent history: what was rolled, the Skill, the
result, the relevant target/difficulty where appropriate, and group/stack-ranked
results.

```text
GROUP ROLL · Observation

1. Test Hunter          72
2. Sergeant             61
3. Test Character       48
4. Jenny                36
```

Use the existing detailed calculation/outcome presentation behind **Details**
where possible. Action therefore retains a player-operational Recent Rolls /
Outcomes history while Situation receives only concise shared summaries
([section 9.2](#92-the-visibility-rule)).

> **Do not invent another Skill calculation engine or duplicate roll mechanics.**

---

## 11. Character inside Play, and the Character/Campaign ownership boundary

### 11.1 Character inside Play

Character answers: **"What can I currently do?"**

The current Character presentation is **already useful as a planning tool**,
because players need to understand current effective Skills and stats before
deciding whether to attempt something. **Reuse it substantially as-is.**

Play -> Character provides access to:

- the existing Character information;
- effective/current values;
- Skills;
- Physical State;
- encumbrance-dependent stats and calculations;
- a useful current equipment summary.

> **Do not create a second Character model or calculation system.**

During Campaign play, current values are **projections** of the permanent
Character, Campaign state, equipment/encumbrance, and Scenario/Encounter context
and modifiers. During an Encounter the **same** Character UI remains; it simply
reflects the Encounter context. The existing Character workspace behaviour,
including the Physical state panel and combat-effect presentation, is unchanged
by this contract; see
[Character Workspace](../product/campaign-scenario-encounter-workflows.md#character-workspace).

### 11.2 Permanent Character versus Campaign state

Keep existing permanent-character functions **outside** Campaign, in an expanded
**Characters / Chargen** area:

| Area                   | Owns                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Characters/Chargen** | Characters; Create / Chargen; Character; Progression; Edit — operating primarily on the permanent Character.                                                |
| **Campaign**           | Actual game-world equipment and possessions: Items; Equipment; Equip Item; ownership and location; carried/equipped state; later storage, shop and economy. |

Equipment may be summarized and clicked through from Character, but **do not
create a second inventory.** This is the player-surface statement of the rule
already settled in
[Scenario Play Workspace §7](scenario-play-workspace.md#7-player-inventory) —
play inventory is a Scenario-aware projection of canonical Character inventory —
and of the operational equipment projection in
[Canonical equipment in Scenario play](../product/campaign-scenario-encounter-workflows.md#canonical-equipment-in-scenario-play),
whose staleness and reconciliation authority is unchanged here.

Later Campaign shop/economy should let players handle routine acquisition
without GM micro-management. That is recorded, not scheduled.

> **One active Campaign per Character — V1.** A Character may belong to at most
> one active Campaign at a time. Multiple simultaneous Campaign participation is
> theoretical and intentionally unsupported for now. **Do not build campaign
> selectors, parallel inventories or parallel active state to solve that
> hypothetical.**

### 11.3 Campaign-scoped Character state

Temporary and play-derived state is **Campaign state attached to the Character**,
rather than an immediate rewrite of the permanent Character:

- wounds and injuries;
- fatigue;
- temporary conditions;
- campaign modifiers;
- Combat Experience state where applicable;
- progression/XP entitlement;
- other campaign consequences.

Such state may either **resolve inside the Campaign**, or be **explicitly
promoted** into a permanent Character change through Progression/Edit where
appropriate.

```text
combat injury -> Campaign injury state -> healing/resolution
             -> if a permanent consequence remains, an explicit permanent Character change
```

### 11.4 Storage and calculation architecture is not redesigned here

> **Do not redesign the current storage/calculation architecture under this UI
> task** unless there is an actual blocking mismatch; **record any such mismatch
> for control-plane decision.**

Operationally, for any slice authorized under this contract:

1. Compose against the existing storage and calculation paths.
2. If a composition genuinely cannot be expressed without a storage or
   calculation change, **stop**.
3. Record the exact mismatch — the required player-visible behaviour, the
   current model, and why the gap is blocking — as a named open decision in
   [section 18](#18-open-decisions-and-recorded-mismatches), in the style
   [Scenario Play Workspace §12](scenario-play-workspace.md#12-product-owner-decisions--all-settled)
   uses.
4. Return it for control-plane decision. **Do not solve it unilaterally**, and
   do not work around it by creating a parallel model.

---

## 12. Map and Blackboard boundaries

### 12.1 Map

Map is a full working view **inside the same Play arena**, and must remain easy
to reach during Combat:

```text
Action -> Map -> Action, without losing current Action state
```

> **Reuse the existing Map UI and internals; do not redesign the map system
> under this contract.**

A map Artifact and the interactive Map play view are **not automatically the
same thing.** The Inspector may preview map material and offer **Open Map** /
**Open full view** where appropriate. The identity separation itself is already
owned by [Maps / Spatial Play](maps-spatial-play.md#2-controlling-map-definition),
whose visibility, sharing and player-editing boundaries —
including [the player-editing boundary](maps-spatial-play.md#10-player-editing-boundary) —
are unchanged by this contract.

### 12.2 Blackboard

**Preserve the already-settled #268 Blackboard semantics.** They are recorded in
[Scenario Play Workspace §8](scenario-play-workspace.md#8-blackboard-boundary)
and settled by
[PO-SPW-2](scenario-play-workspace.md#po-spw-2--settled-the-blackboard-is-meta-level-player-collaboration).
This contract **adds nothing to them and narrows nothing in them**; the points
below are pointers, not a restatement of authority:

- The Blackboard is explicitly **meta-level player collaboration, outside the
  game world**. It is not Character knowledge, Item ownership, in-world
  visibility, or in-character communication —
  [§8.1](scenario-play-workspace.md#81-core-invariant).
- Once material is accessible to a player, that player may share and place it on
  the Blackboard **even if another player's Character would not know it**, and
  Glantri must not adjudicate that —
  [§8.1](scenario-play-workspace.md#81-core-invariant).
- **Reveal**, **Share**, and **Place-or-remove** are three distinct operations
  with distinct names —
  [§4.5](scenario-play-workspace.md#45-reveal-and-share-are-two-different-operations).
- Any participant may add or remove current Blackboard placements, and removal
  does **not** unreveal, does **not** remove durable shared material, does
  **not** alter Item ownership or location, and does **not** affect game-world
  state — [§8.2](scenario-play-workspace.md#82-who-may-act-and-what-it-changes).
- Durable shared material remains separate from current Blackboard placement —
  [§8.3](scenario-play-workspace.md#83-the-durable-shared-material-collection).

> **Reuse the existing Blackboard implementation rather than redesigning it.**

Player-created collaboration Artifacts remain a later bounded capability, as
[#268 already records](scenario-play-workspace.md#later-bounded-capability--player-created-collaboration-artifacts).
The Blackboard-redesign deferral in
[Campaign Management V2 §9](campaign-management-v2.md#9-blackboard-boundary)
stands.

---

## 13. Canonical-detail and click-through rule

An explicit design rule:

> **Show the useful summary where the player needs it; click through to the
> canonical place where full information lives.**

```text
compact summary -> inspect/expand -> canonical full view
```

| Summary, where the player needs it | Canonical full view                       |
| ---------------------------------- | ----------------------------------------- |
| Action modifier summary            | full Character / Physical State           |
| NPC list -> Inspector              | full Character/NPC view where appropriate |
| Item -> Inspector                  | full Item view                            |
| Artifact -> Inspector              | full Artifact view                        |
| map preview                        | Map                                       |
| Skill result                       | detailed Action outcome                   |
| equipment summary                  | Campaign Equipment                        |

Rules:

- **Do not recreate detailed functionality inside every Play view.**
- Navigation **preserves the player's Play context and unfinished state where
  practical** ([section 4](#4-player-play-v1-information-architecture)).
- Canonical homes are those already established by
  [Campaign Management V2 §6.2](campaign-management-v2.md#62-index-behavior-and-canonical-homes);
  this contract routes to them rather than defining new ones.
- Full-viewport inspection of visual material follows
  [Campaign Management V2 §8](campaign-management-v2.md#8-artifact-and-image-inspection).
- Information appears at the decision or outcome it serves, per
  [Product & Presentation Principles §4.3](../product/product-presentation-principles.md#43-put-information-at-the-decision-or-outcome-it-serves).

---

## 14. Deferred capabilities

These are **recorded and bounded**. They are preserved so the architecture keeps
room for them; **no slice authorized under this contract may absorb any of
them**, and none is a V1 restructuring blocker.

| Deferred capability                                                               | Recorded properties                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skill planning selector**                                                       | A later read-only Skill selector/planner letting a player choose any Skill and inspect its current effective value and modifiers before deciding whether to try it. It must use the existing current calculation path; make no roll; consume no action; create no Activity event; and may optionally link to Action to attempt the Skill. |
| **Private chat / messages**                                                       | See [section 14.1](#141-future-chat-and-messages--record-only).                                                                                                                                                                                                                                                                           |
| **Prepared GM announcements**                                                     | Announcements prepared against a Scenario/Encounter and published with an **Announce** action during play rather than typed live ([section 9.3](#93-gm-announcements-versus-scene-text)).                                                                                                                                                 |
| **Player-created collaboration Artifacts**                                        | Already recorded as a later bounded capability by [#268](scenario-play-workspace.md#later-bounded-capability--player-created-collaboration-artifacts). Not re-scoped here.                                                                                                                                                                |
| **Sophisticated list/filter systems** beyond the agreed simple filters and search | Situation rails stay as specified in [section 8.1](#81-left-selectors).                                                                                                                                                                                                                                                                   |
| **Customizable split-screen layouts**                                             | Not part of V1 composition.                                                                                                                                                                                                                                                                                                               |
| **Redesign of Combat**                                                            | Prohibited by [section 3](#3-governing-guardrail--composition-not-redesign) without separate Product Owner authorization.                                                                                                                                                                                                                 |
| **Redesign of Skill Roll**                                                        | As above.                                                                                                                                                                                                                                                                                                                                 |
| **Redesign of the Character sheet**                                               | As above.                                                                                                                                                                                                                                                                                                                                 |
| **Redesign of Equipment**                                                         | As above.                                                                                                                                                                                                                                                                                                                                 |
| **Redesign of Map**                                                               | As above; Map internals remain owned by [Maps / Spatial Play](maps-spatial-play.md#2-controlling-map-definition).                                                                                                                                                                                                                         |
| **Redesign of Blackboard**                                                        | As above; the deferral in [Campaign Management V2 §9](campaign-management-v2.md#9-blackboard-boundary) stands.                                                                                                                                                                                                                            |
| **Broad GM-management-page redesign**                                             | See [section 16](#16-relationship-to-the-later-gm-surface).                                                                                                                                                                                                                                                                               |

### 14.1 Future chat and messages — record only

Private messaging/chat should later be a **persistent drawer or channel
accessible throughout Play**, not another main Play tab and not part of
Activity. It is intended for player-to-player, GM-to-player and private
messages.

Ordinary chat is **meta-level communication between human participants**, not
automatically in-character communication. Private messages do not publish into
shared Activity, and do not belong on the Blackboard unless somebody
deliberately creates or shares material there.

**Record only. Do not implement under this contract.**

---

## 15. Relationship to #268 and other existing contracts

### 15.1 Reconciliations

| Existing statement                                                                                                                                                                                 | Effect of this contract                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Scenario Play Workspace §6.1](scenario-play-workspace.md#61-no-separate-encounter-play-page): no separate Encounter play page.                                                                    | Relied upon and applied to the player surface. [Section 7](#7-scenario-versus-encounter-behaviour) is its player-facing presentation rule; entering an Encounter changes projection, not destination.                                                                                                                                                         |
| [Scenario Play Workspace §6.2](scenario-play-workspace.md#62-what-the-workspace-surfaces-over-time): what the workspace surfaces over time.                                                        | This contract states **how** those surfaces are composed for the player: the five views, the Situation layout, and the click-through rule. It adds no new surface to that list.                                                                                                                                                                               |
| [Scenario Play Workspace §8](scenario-play-workspace.md#8-blackboard-boundary) and PO-SPW-2.                                                                                                       | **Preserved unchanged and linked, not restated.** [Section 12.2](#122-blackboard) adds no operation, actor, or board semantic.                                                                                                                                                                                                                                |
| [PO-SPW-1](scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics): Item-to-Artifact association semantics.                                   | **Not reopened.** Where the Situation Inspector opens an Item's attached Artifact representation, the association semantics are #268's, and the mechanism remains that slice's choice under PO-SPW-1's acceptance requirements.                                                                                                                               |
| [PO-SPW-3](scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling).                                                  | **Not reopened.** The existing GM Encounter workspace is retained as transitional GM-only management tooling and is **not absorbed** by any Player Play slice. See [section 16](#16-relationship-to-the-later-gm-surface).                                                                                                                                    |
| [Campaign Management V2 §3.1](campaign-management-v2.md#31-no-separate-play-hierarchy): no second Play navigation hierarchy.                                                                       | Consistent. The five Play views are views **inside the Scenario's own canonical play surface**, composing the existing canonical Map, Blackboard, Character, Combat and Skill Roll surfaces. They create no parallel home for those objects, and existing routes remain available under [section 3.4](#34-existing-routes-remain-available-until-playtested). |
| [Campaign Management V2 §6.2](campaign-management-v2.md#62-index-behavior-and-canonical-homes) and [§8](campaign-management-v2.md#8-artifact-and-image-inspection).                                | Relied upon. [Section 13](#13-canonical-detail-and-click-through-rule) routes to the established canonical homes and reuses the full-viewport inspection pattern rather than defining new ones.                                                                                                                                                               |
| [Campaign Management V2 §9](campaign-management-v2.md#9-blackboard-boundary): Blackboard redesign deferred.                                                                                        | Deferral stands; [section 14](#14-deferred-capabilities) records Blackboard redesign as deferred.                                                                                                                                                                                                                                                             |
| [Canonical equipment in Scenario play](../product/campaign-scenario-encounter-workflows.md#canonical-equipment-in-scenario-play).                                                                  | Unchanged and relied upon. [Section 11.2](#112-permanent-character-versus-campaign-state) is its player-facing ownership statement; staleness and reconciliation authority is untouched.                                                                                                                                                                      |
| [Encounter Workspace](../product/campaign-scenario-encounter-workflows.md#encounter-workspace) and [Character Workspace](../product/campaign-scenario-encounter-workflows.md#character-workspace). | Unchanged. Player Play composes the player-facing parts; the GM Encounter tooling is retained per PO-SPW-3, and the Character workspace is reused substantially as-is.                                                                                                                                                                                        |
| [Maps / Spatial Play](maps-spatial-play.md#2-controlling-map-definition).                                                                                                                          | Unchanged and relied upon. [Section 12.1](#121-map) places the existing Map view inside the arena and restates its identity separation without altering the Map contract.                                                                                                                                                                                     |
| [Player-Facing Copy Rules](../product/campaign-scenario-encounter-workflows.md#player-facing-copy-rules).                                                                                          | Unchanged and binding on every composed player view, including empty states in [section 8.2](#82-inspector).                                                                                                                                                                                                                                                  |

### 15.2 Nothing settled by #268 is reopened

This contract makes **no domain decision**. It decides player-facing composition
and navigation only. In particular it does not reopen, restate as open, narrow,
or contradict PO-SPW-1, PO-SPW-2 or PO-SPW-3, all of which remain **settled and
closed** as
[Scenario Play Workspace §12](scenario-play-workspace.md#12-product-owner-decisions--all-settled)
records.

---

## 16. Relationship to the later GM surface

This contract is **Player Play V1**.

The design must be compatible with the later principle that the GM uses the
**same conceptual Play surface with additional controls**, while separate GM
management pages handle preparation and administration.

- **Do not design that GM management overhaul now.**
- **Do not absorb the existing GM Encounter workspace into this Player Play
  work.** It is retained as transitional GM-only management tooling by
  [PO-SPW-3](scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling),
  which also bounds
  [#268's slice S2](scenario-play-workspace.md#slice-s2--active-encounter-as-contextual-state-in-the-scenario-workspace).
- The compatibility requirement is satisfied structurally: the five views are
  authority-neutral shells over
  [one state with two authorities](scenario-play-workspace.md#63-one-state-two-authorities),
  so a later GM surface adds controls rather than a parallel arena.

---

## 17. Proposed implementation decomposition

These are **proposals** returned for Product Owner / control-plane approval.
**None is authorized by this document, and no implementation is dispatched by
it.** Each slice must be sized against then-current `dev`, must declare its
hotspots against
[functional ownership](ownership.md#reserved-integration-hotspots), and must
carry its own acceptance examples.

Every slice below is **composition or thin adaptation**. Any slice that turns
out to require subsystem redesign crosses
[section 3](#3-governing-guardrail--composition-not-redesign) and is returned
for Product Owner decision rather than proceeding.

### 17.1 Reconciliation with #268's S1–S6

#268's [slice plan](scenario-play-workspace.md#11-proposed-implementation-slices)
is **not replaced and its dependency model is not changed**.

| #268 slice                                                                                                                                           | Status under this contract                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [S1 revealed Artifacts on the player Scenario surface](scenario-play-workspace.md#slice-s1--player-scenario-surface-shows-revealed-artifacts)        | **Useful as-is.** P2 (Situation) consumes its player-facing Artifact presentation and the durable collection it establishes. P2 does not re-do it.                 |
| [S2 active Encounter as contextual state](scenario-play-workspace.md#slice-s2--active-encounter-as-contextual-state-in-the-scenario-workspace)       | **Useful as-is**, and is the prerequisite for the arena's Encounter indication. P1 shares its shell hotspot; one integration owner is required.                    |
| [S3 Encounter-context Artifact Reveal](scenario-play-workspace.md#slice-s3--encounter-context-artifact-reveal)                                       | **Useful as-is.** Its Reveal events are a source of Activity entries under [section 9.1](#91-what-activity-is); no Player Play slice changes the Reveal operation. |
| [S4 Items present in the play context](scenario-play-workspace.md#slice-s4--items-present-in-the-play-context)                                       | **Useful as-is.** It supplies the presence/visibility data the Situation Items rail projects.                                                                      |
| [S5 player play inventory projection](scenario-play-workspace.md#slice-s5--player-play-inventory-as-a-scenario-aware-projection)                     | **Useful as-is.** It supplies the equipment summary surfaced from Character in [section 11.2](#112-permanent-character-versus-campaign-state).                     |
| [S6 attached representation + Blackboard sharing](scenario-play-workspace.md#slice-s6--item-attached-artifact-representation-and-blackboard-sharing) | **Useful as-is.** The Inspector's Item -> attached Artifact path depends on it; this contract adds no requirement to it and does not touch PO-SPW-1.               |

**Shared hotspots between the two plans:** the Campaign workspace/scenario
orchestration shell (S1, S2, P1, P2, P3, P5), the Campaign Blackboard surface
(S6, P4), and Campaign/Scenario Item routes and UI (S4, S5, P2, P5). One
integration owner is required wherever the plans overlap.

### 17.2 Proposed Player Play slices

Naming uses `P` to avoid collision with #268's `S` slices.

#### P1 — Play shell and the five views

- **Player-visible outcome.** A player in a Scenario sees one Play arena with
  Situation | Action | Map | Blackboard | Character, a shared header showing
  Scenario and active Encounter, and preserved state when switching views.
- **Reused.** `CampaignWorkspaceShell` and its existing tab model, the existing
  player Scenario surface, the existing Map and Blackboard workspaces, the
  existing player Character and player Combat surfaces.
- **Minimal new UI/glue.** A Play view switcher, the header Encounter
  indication, and view-state retention.
- **Scope and exclusions.** No new view content. No component redesign. No
  route removal. Situation may land as a placeholder-free minimal view or wait
  for P2.
- **Dependencies.** #268 S2 for the active-Encounter context.
- **Hotspots.** Campaign workspace/scenario orchestration — shared with #268
  S1/S2; needs a named integration owner.
- **Persistence/schema.** None expected.
- **QA level.** Ordinary independent QA; perspective-sensitive checks for
  player-versus-GM view access.
- **Possibly redundant later.** Separate player combat and player skill-roll
  entry points, after playtest — not removed by this slice
  ([section 3.4](#34-existing-routes-remain-available-until-playtested)).
- **Composition or redesign?** Composition.

#### P2 — Situation view

- **Player-visible outcome.** The Situation screen of
  [section 8](#8-situation--the-main-new-v1-screen): People/Items/Artifacts
  selector rails, a dominant Inspector, and full-width Activity below.
- **Reused.** Existing participant and Item projections, the player-visible
  Artifact projection from #268 S1, the existing full-viewport inspection
  pattern, and the existing event/history model.
- **Minimal new UI/glue.** The three selector rails with simple filters/search,
  the generic Inspector shell, and the Activity projection presentation.
- **Scope and exclusions.** No new domain model in the Inspector. No new event
  model. No second player log. No sophisticated filtering.
- **Dependencies.** P1; #268 S1 for Artifacts; #268 S4 for Items presence.
- **Hotspots.** Workspace shell; Campaign/Scenario Item routes and UI.
- **Persistence/schema.** None expected for presentation. **Possible mismatch:**
  Scenario-level replaceable scene text — see
  [OPEN-PPV1-1](#open-ppv1-1--scenario-level-scene-text-storage).
- **QA level.** Full independent QA. Activity is a privacy projection surface
  ([section 9.2](#92-the-visibility-rule)), which is a mandatory QA floor class.
- **Possibly redundant later.** Parts of the current player Scenario page.
- **Composition or redesign?** Composition, with the recorded mismatch to be
  confirmed before scheduling.

#### P3 — Action view composition

- **Player-visible outcome.** Action stacks round tracker (only while rounds are
  active), compact current state, the existing player Combat UI when Combat is
  active, the existing Skill Roll widget, and recent rolls/outcomes.
- **Reused.** The existing player Combat components and round tracker, and the
  existing Skill Roll / task widget and its outcome presentation.
- **Minimal new UI/glue.** Stacking, conditional round-tracker and Combat-block
  rendering, and removal/hiding of now-redundant page framing.
- **Scope and exclusions.** **No Combat control redesign. No new action engine.
  No new Skill calculation path.** No empty Combat block outside Combat.
- **Dependencies.** P1.
- **Hotspots.** Encounter API clients and live synchronization; combat
  experience surfaces.
- **Persistence/schema.** None.
- **QA level.** Full independent QA — Combat behaviour and declaration
  continuity must be proven unchanged.
- **Possibly redundant later.** The standalone player combat route.
- **Composition or redesign?** Composition; the framing removal is the only
  adaptation, and any need to change declaration components is a stop condition.

#### P4 — Map and Blackboard as Play views

- **Player-visible outcome.** Map and Blackboard are reachable as Play views,
  and Action -> Map -> Action preserves Action state.
- **Reused.** `MapWorkspace` and `BlackboardWorkspace` as they are.
- **Minimal new UI/glue.** Mounting them inside the arena and preserving view
  state.
- **Scope and exclusions.** **No Map or Blackboard redesign.** No change to
  #268's Blackboard semantics, to Reveal/Share/Place, or to sharing scope.
- **Dependencies.** P1.
- **Hotspots.** Campaign Blackboard domain/service/API/client/workspace —
  shared with #268 S6.
- **Persistence/schema.** None.
- **QA level.** Full independent QA — the Blackboard is a privacy-projection
  surface, and the non-mutation proofs in
  [Scenario Play Workspace §14](scenario-play-workspace.md#14-verification-expectations-for-authorized-slices)
  apply.
- **Possibly redundant later.** Nothing; the Campaign-level surfaces remain.
- **Composition or redesign?** Composition.

#### P5 — Character view inside Play and the ownership boundary

- **Player-visible outcome.** Play -> Character shows current effective values,
  Skills, Physical State, encumbrance-dependent stats and a current equipment
  summary, reflecting Encounter context when one is active.
- **Reused.** The existing Character workspace presentation and the existing
  equipment read path / #268 S5 projection.
- **Minimal new UI/glue.** Mounting the existing presentation in the arena and
  adding the equipment click-through to Campaign Equipment.
- **Scope and exclusions.** **No second Character model, no second inventory, no
  second calculation system.** No permanent-Character editing from Play.
- **Dependencies.** P1; #268 S5 for the play inventory projection.
- **Hotspots.** Character equipment repository and inventory/loadout UI.
- **Persistence/schema.** None expected. Campaign-scoped Character state
  ([section 11.3](#113-campaign-scoped-character-state)) is presented from
  existing storage; **any blocking mismatch is recorded, not solved**.
- **QA level.** Full independent QA — calculated values and privacy projection.
- **Possibly redundant later.** The separate player Character entry point.
- **Composition or redesign?** Composition.

### 17.3 Recommended sequencing, and the portfolio constraint

Recommended order: **P1 -> P2 -> P3**, with P4 and P5 available in parallel
after P1.

```text
#268 S2 -> P1 play shell
              ├── P2 situation   (also needs #268 S1, S4)
              ├── P3 action
              ├── P4 map + blackboard
              └── P5 character   (also needs #268 S5)
```

> **This UI work must not silently displace the current playtest-foundation
> priorities:** finishing Content V2 completion and canonicalization and then
> [#251](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/251) /
> [#252](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/252);
> improving Combat to a genuinely functional playtest loop; preserving and
> exercising the now-working Artifact intake; and infrastructure isolation work,
> which remains important because recent QA exposed stale-container
> ([#264](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/264)) and
> port/database cross-talk
> ([#276](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/276))
> hazards, plus a CI flake
> ([#280](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/280)).

Therefore the decomposition and sequencing are **returned, not started**. Choose
the smallest useful composition changes that make actual playtesting better
while the Skill and Combat foundations are completed. On that basis **P1 and P3
are the recommended smallest useful pair**: they give a coherent arena and a
usable Action screen with the least new surface, and they directly improve the
Combat playtest loop.

---

## 18. Open decisions and recorded mismatches

Recorded in the style of
[Scenario Play Workspace §12](scenario-play-workspace.md#12-product-owner-decisions--all-settled).
**No decision here reopens anything settled by #268.**

### OPEN-PPV1-1 — Scenario-level scene text storage

**Status:** Open — recorded for control-plane decision, not resolved here.\
**Gates:** Nothing today. It is a **precondition to confirm before P2 is
scheduled**, not a blocker on this contract.

[Section 6](#6-shared-play-header-and-scene-text) requires replaceable GM scene
text at Scenario level, with Encounter framing taking precedence while an
Encounter is active. The existing model records a **player-facing situation
message on the Encounter**
([Encounter Workspace](../product/campaign-scenario-encounter-workflows.md#encounter-workspace))
and Scenario title, summary and GM-facing notes
([Scenario Workspace](../product/campaign-scenario-encounter-workflows.md#scenario-workspace)),
but no separately identified player-facing Scenario scene text distinct from the
Scenario summary.

Two readings are available, and the choice is a product decision:

1. Scenario scene text is the existing player-safe Scenario summary, presented
   as scene text. No storage change.
2. Scenario scene text is a distinct replaceable field. That is a storage
   change, and under
   [section 11.4](#114-storage-and-calculation-architecture-is-not-redesigned-here)
   it must be returned for control-plane decision rather than introduced by a UI
   slice.

**This contract does not choose.** It records the question and forbids a Builder
from resolving it unilaterally.

### No contract conflict found

No conflict was found between this specification and
[Scenario Play Workspace](scenario-play-workspace.md),
[Campaign Management V2](campaign-management-v2.md),
[Maps / Spatial Play](maps-spatial-play.md), or
[Campaign, Scenario, and Encounter Workflows](../product/campaign-scenario-encounter-workflows.md).
The two points that required explicit reconciliation — Play views versus the
no-second-hierarchy ruling, and the Situation Artifacts rail versus the durable
shared-material collection — are reconciled in
[section 15.1](#151-reconciliations) and
[section 8.1](#81-left-selectors) without changing any existing contract.

---

## 19. Verification expectations for authorized slices

These are expectations on slices **when they are authorized**; they authorize no
implementation here. They are additional to, and never weaker than, the proofs
in
[Scenario Play Workspace §14](scenario-play-workspace.md#14-verification-expectations-for-authorized-slices),
which continue to apply in full to anything touching Reveal, Share, the
Blackboard, the shared-material collection, Item presence, or Item-to-Artifact
representation.

Every Player Play slice must prove:

1. **No redesign crept in.** The reused Combat, Skill Roll, Character, Physical
   State, Equipment, Map and Blackboard components behave as before composition.
2. **State is preserved across views.** Action -> Map -> Action leaves an
   unfinished declaration intact; Situation -> full Artifact -> Back restores
   context and selection where practical.
3. **Activity publishes outcomes, not arithmetic.** Detailed modifier and
   calculation arithmetic, GM-only notes and events, and private messages do not
   appear in shared Activity, **in payload as well as in UI**.
4. **Encounter changes projection, not destination.** Entering and leaving an
   Encounter does not navigate the player away from the arena, and Items or
   equipment that are elsewhere or not present remain unusable.
5. **One model each.** No second Character model, inventory, Skill or Combat
   calculation path, or player event/history model is introduced.
6. **Existing routes still work** until a separate decision retires them.
7. **Round tracker placement.** The tracker appears on Action only while
   3-second round tracking is active, and nowhere else.
8. **Deferred capabilities stayed deferred.** Nothing in
   [section 14](#14-deferred-capabilities) was partially implemented.

Slices that touch privacy projection — notably P2's Activity and P4's Blackboard
— are a mandatory QA floor class and require full adversarial independent QA at
an exact PR head.
