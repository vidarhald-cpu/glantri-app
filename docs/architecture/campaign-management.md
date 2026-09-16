# Glantri — Campaign Management Durable Product & Architecture Contract

**Product Owner approval:** Approved 2026-09-15.

**Provenance:** PO-approved Campaign Management durable product and architecture contract supplied for [#120](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/120); documentation publication authorized in [#194](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/194). Source attachment: `940ace6e-63b7-4a27-a5c9-05eb6679f38b/pasted-text.txt`; SHA-256: `768d3e992e6eec19a2189f5fd363cf41b2f60c1445dee9c8462c961a8eeb444c`.

## 1. Status and scope

**Portfolio area:** #120 Campaign Management\
**Status:** Future-product architecture; conceptually Ready\
**Implementation status:** Not yet activated\
**Relationship to #112 Persistent Play:** Successor product lane after the relevant Persistent Play milestone

Campaign Management defines how the GM organizes, understands, navigates, and maintains an ongoing Campaign.

Its architectural role is:

> **Campaign Management is the GM-facing organizational, navigational, historical and situational-awareness layer for an ongoing Campaign. Persistent Play remains the authoritative runtime engine.**

Campaign Management must remain distinct from:

- Persistent Play;
- Story;
- Maps;
- Artifacts;
- Characters.

These domains may reference one another, but must not be collapsed into a generic Campaign-content model.

This contract intentionally avoids implementation-specific assumptions about the then-current application. Before #120 becomes Active, only a short activation preflight against the current `dev` baseline should be required to translate this product architecture into implementation contracts.

The currently approved Persistent Play lifecycle is a controlling input:

- Scenario: Draft → Active ↔ Paused → Closed → Archived;
- Draft → Archived;
- Encounters exist inside Scenarios;
- Combat occurs inside an active Encounter;
- the same Encounter resumes after Combat;
- Scenario history provides the principal chronological spine of runtime play.

Campaign Management consumes and presents that authoritative state. It does not redefine it.

---

## 2. Product objective

Campaign Management should give the GM one coherent place from which to answer:

> **What is happening in this Campaign, what has happened, who and what are involved, what material is relevant, and where should I go next?**

An established Campaign should feel like a navigable body of connected game state rather than a collection of disconnected Scenarios, character records, Story material, Maps, Artifacts, notes, and runtime histories.

The GM should be able to:

- understand the Campaign's present situation immediately;
- identify the active or paused play context;
- find and navigate Scenarios and Encounters;
- understand which PCs currently belong to the Campaign and which belonged previously;
- distinguish prominent Campaign NPCs from incidental historical participants;
- review what has happened across the Campaign;
- maintain lightweight private operational Notes;
- navigate to related Maps, Artifacts, Story material, and Characters;
- discover Campaign-related material without needing to remember where it was created;
- distinguish current state from historical state;
- inspect historical material safely without changing active play;
- operate effectively even when a Campaign has accumulated substantial history and content.

The governing design principle is:

> **Campaign Management organizes relationships, context, history, and navigation. It does not replace the specialist domains it connects.**

---

## 3. Primary GM workflows

### 3.1 Open a Campaign and understand its present situation

On entering a Campaign, the GM should be able to establish the current situation without visiting several separate subsystems.

The Campaign Home should make it possible to answer, as applicable:

- Which Campaign is this?
- Which Scenario is Active or Paused?
- Which Encounter is currently relevant?
- Is Combat currently active?
- What happened most recently?
- Which Scenarios are available or in preparation?
- Who are the current PCs?
- Which NPCs are currently important?
- Are there active GM Notes requiring attention?
- Which Maps, Artifacts, Story material, or Characters are directly relevant to the current situation?

The Campaign Home is an overview and navigation surface.

It is not intended to reproduce the complete editing interfaces of every referenced object.

---

### 3.2 Prepare, inspect, or select a Scenario

The GM should be able to:

1. browse the Campaign's Scenarios;
2. distinguish lifecycle state;
3. search or filter the Scenario collection;
4. inspect a Draft, Active, Paused, Closed, or Archived Scenario;
5. see relevant relationships such as Characters, Maps, Artifacts, Story material, and Notes;
6. enter the appropriate Persistent Play workflow when actual play begins or resumes.

No separate `Adventure` domain object is introduced.

Within Campaign Management:

> **Scenario is the Campaign's adventure-level playable object.**

Reader-facing prose may describe a Scenario as an adventure where useful, but this does not establish another object layer.

---

### 3.3 Resume ongoing play

A GM returning to a Campaign should be able to reach current play with minimal reconstruction.

For example:

```text
Campaign
  → Paused Scenario
      → Current Encounter
          → Resume
```

If Combat is currently active, Campaign Management may expose and navigate to it.

It must not independently decide that a Combat, Encounter, or Scenario is current.

Persistent Play remains authoritative for runtime state.

---

### 3.4 Review what has happened

The GM should be able to review Campaign chronology and answer questions such as:

- What happened last session?
- Which Scenario preceded this one?
- When did the party first encounter this NPC?
- In which Encounter did this event occur?
- When did a particular Artifact become relevant?
- What significant Campaign events happened between two Scenarios?

Runtime history remains authoritative for events actually produced by play.

Campaign chronology may additionally contain explicit GM-authored Campaign events in CM2, but these must be distinguishable from runtime-derived history.

---

### 3.5 Find and understand a Character

The GM should be able to locate and understand the Campaign relevance of PCs and NPCs.

For a Character, Campaign Management may expose relationships such as:

- Campaign membership;
- Scenario appearances;
- Encounter participation;
- related Notes;
- relevant Maps;
- related Artifacts;
- related Story material;
- historical Campaign activity.

The Character remains authoritative in the Character domain.

Campaign Management records or derives Campaign relationships to that Character.

---

### 3.6 Manage the Campaign PC roster

Campaign membership for PCs initially supports:

- **Current**
- **Former**

The GM should be able to distinguish the present party from Characters who were previously members.

Historical relationships remain intact when a PC becomes Former.

Character conditions such as death, injury, incapacitation, or similar game state do not automatically become Campaign-membership states.

Additional membership states require a concrete later UX need.

---

### 3.7 Manage relevant NPCs without cluttering the Campaign

NPC handling follows a hybrid model.

Campaign Management supports:

1. explicit promotion or marking of an NPC as **Campaign-relevant**; and
2. automatic historical discoverability of NPCs linked to actual Campaign activity.

Therefore:

- major recurring NPCs can be deliberately surfaced in Campaign Management;
- an incidental NPC does not need to become a permanent prominent roster entry;
- historical participation remains discoverable even when the NPC is not promoted as Campaign-relevant.

---

### 3.8 Maintain private GM operational Notes

The GM needs lightweight Campaign Notes for practical memory and preparation.

Examples include:

- "If confronted about the ring, she initially denies visiting Threshold."
- "Prepare guard statistics before the next session."
- "The bridge should have been repaired if the party returns."
- "The Duke now suspects Elena."

A GM Note may relate to:

- the Campaign as a whole;
- a Scenario;
- an Encounter;
- a Character;
- a Map;
- an Artifact;
- Story material;
- another supported Campaign-related object.

Notes are distinct from Story prose.

They support a minimal operational lifecycle such as:

- active/open;
- resolved/archived.

Campaign Notes must not evolve into a general project-management or task-management subsystem.

---

### 3.9 Navigate related material

From Campaign contexts, the GM should be able to reach relevant:

- Scenarios;
- Encounters;
- Characters;
- Maps;
- Artifacts;
- Story material;
- Notes;
- historical events.

Navigation follows explicit or derived relationships.

The GM should not have to remember which specialist subsystem owns the referenced material.

---

### 3.10 Find something in a large Campaign

Campaign Management should support discovery at Campaign scope.

The target architecture permits search across supported Campaign-related object types while preserving:

- object type;
- context;
- permissions;
- visibility;
- authoritative ownership.

A search for a term such as `Black Eagle` might eventually return distinctly labelled results such as:

- NPC;
- Scenario;
- Story material;
- Artifact;
- Map;
- GM Note;
- Campaign chronology event.

CM1 may provide narrower discovery coverage if appropriate.

CM2 should establish the broader Campaign-memory and cross-object discovery model.

---

## 4. Conceptual information architecture

Campaign is the durable top-level organizational root.

A conceptual GM navigation model is:

```text
Campaign
│
├── Home / Overview
│
├── Current Play
│   └── Persistent Play Context
│       └── Scenario
│           └── Encounter
│               └── Combat
│
├── Scenarios
│   ├── Draft
│   ├── Active / Paused
│   ├── Closed
│   └── Archived
│
├── Characters
│   ├── Current PCs
│   ├── Former PCs
│   └── Campaign-relevant NPCs
│
├── History / Chronology
│
├── GM Notes
│
└── Related Material
    ├── Maps
    ├── Artifacts
    ├── Story
    └── other supported Campaign relationships
```

This is an information architecture and navigation model.

It is **not** a requirement that all objects be persisted beneath Campaign in one technical hierarchy.

Campaign Management provides the organizing context.

The specialist domains retain their own authority and internal models.

---

## 5. Domain relationships

### 5.1 Campaign

Campaign is an explicit durable domain object and organizational root.

It may organize or reference:

- Scenarios;
- PC Campaign membership;
- Campaign-relevant NPCs;
- historically participating NPCs;
- GM Notes;
- Campaign chronology;
- narrowly justified Campaign-level state;
- Maps;
- Artifacts;
- Story material;
- other supported domain relationships.

Campaign also provides the scope within which Campaign Management search and discovery operate.

---

### 5.2 Scenario

Scenario is the Campaign's adventure-level playable object.

A Scenario:

- belongs to a Campaign context;
- follows the Persistent Play lifecycle;
- contains Encounters;
- contributes authoritative runtime history;
- may reference Characters;
- may reference Maps;
- may reference Artifacts;
- may reference Story material;
- may have related GM Notes.

Campaign Management organizes and navigates Scenarios.

Persistent Play owns their runtime semantics.

---

### 5.3 Encounter

Encounter exists inside a Scenario.

Campaign Management may expose an Encounter through:

- current-play navigation;
- Scenario views;
- chronology;
- Character relationships;
- Campaign search;
- historical navigation.

Encounter does not become an independent top-level Campaign hierarchy.

---

### 5.4 Combat

Combat occurs inside an active Encounter.

Campaign Management may expose:

- whether relevant Combat is active;
- historical Combat relationships;
- navigation into current or historical Combat where supported.

It does not own Combat runtime state.

---

### 5.5 PC Campaign membership

A Character may be related to a Campaign as a PC.

Initial Campaign-membership states are:

- **Current**
- **Former**

Membership is a Campaign relationship.

The Character itself remains authoritative in the Character domain.

---

### 5.6 NPC Campaign relevance

NPC Campaign relevance follows the approved hybrid model.

An NPC may become visible within Campaign Management because:

- the GM explicitly promotes or marks the NPC as Campaign-relevant; or
- Campaign activity creates historical relationships that make the NPC discoverable.

This allows persistent important NPCs to remain prominent without forcing every incidental participant into the main Campaign roster.

---

### 5.7 Campaign chronology

Campaign chronology is the ordered historical view of meaningful Campaign events.

Its principal authoritative source is Persistent Play history.

In CM2 it may include two clearly distinguishable categories:

#### Runtime-derived events

Events produced by authoritative play state and history.

Examples may include:

- Scenario activated;
- Scenario paused;
- Scenario resumed;
- Encounter activity;
- Combat occurrence;
- Scenario closed.

#### GM-authored Campaign events

Explicit historical events entered by the GM to record meaningful Campaign developments that did not arise directly from runtime mechanics.

For example:

> "Thaumont 14 — King Stefan declared martial law."

A manual Campaign event is:

- not Story prose;
- not an automatically generated runtime event;
- not permission to edit or rewrite runtime history;
- explicitly distinguishable by provenance.

Chronology should present meaningful Campaign history, not every low-level application audit event.

---

### 5.8 GM Note

A GM Note is lightweight operational Campaign material.

A Note conceptually contains:

- content;
- Campaign relationship;
- optional relationship to relevant objects;
- basic creation/update provenance;
- minimal lifecycle state.

Initial lifecycle:

- active/open;
- resolved/archived.

Notes must remain simpler than a generalized document, issue, or project-management system.

---

### 5.9 Campaign-level state

Campaign may own state that genuinely applies to the Campaign rather than to a Scenario, Character, Map, Artifact, or another specialist object.

This capability is deliberately narrow.

The durable principle is:

> **New structured Campaign-state categories require a concrete product use; Campaign Management must not become a generic secondary rules engine.**

V1 must not introduce a generic arbitrary key/value Campaign-variable system.

Ordinary contextual facts may remain:

- GM Notes; or
- later, explicitly defined typed Campaign facts where a real product purpose has been established.

Structured Campaign state should exist only when the application has a reason to understand or behave differently because of that state.

---

## 6. Permissions and visibility principles

Campaign Management is GM-first for CM1 and CM2.

Future player-facing Campaign views remain possible, but are deferred.

### 6.1 GM authority

The GM can access and manage the Campaign Management material they are authorized to control, subject to the broader application permission model.

---

### 6.2 GM operational information is private by default

GM Notes and unrevealed Campaign-management context should be private unless deliberately exposed through a future approved mechanism.

The existence of a relationship must not accidentally expose hidden information.

---

### 6.3 Specialist domains retain visibility authority

Where a linked object has its own visibility model, that specialist domain remains authoritative.

For example:

- Story governs Story visibility;
- Map governs Map visibility;
- Artifact governs Artifact visibility;
- Character systems govern Character information visibility.

Campaign Management should not silently override those rules.

---

### 6.4 Relationship visibility may itself matter

A referenced object may be visible while a particular Campaign relationship is not.

For example, players might eventually know that an NPC exists without being allowed to see a secret relationship between that NPC and a Scenario.

The architecture must permit relationship visibility to remain distinct where necessary.

---

### 6.5 Search and discovery must not leak hidden information

Future player-facing discovery must not reveal hidden information through:

- search-result presence;
- counts;
- relationship labels;
- chronology entries;
- linked-object previews;
- metadata.

CM1 and CM2 remain GM-first, but this boundary must not be designed away.

---

## 7. Relationship to Persistent Play

Persistent Play and Campaign Management solve different problems.

### Persistent Play owns

- Scenario runtime lifecycle;
- authoritative active/paused state;
- Encounter runtime;
- Combat entry;
- Combat exit and return to the same Encounter;
- runtime continuity;
- authoritative runtime history;
- resumption of active play.

### Campaign Management owns

- Campaign organization;
- Campaign Home;
- Scenario discovery and navigation;
- Campaign roster relationships;
- Campaign-relevant NPC surfacing;
- GM Notes;
- broader Campaign chronology presentation;
- Campaign-scoped search and discovery;
- cross-domain relationship navigation;
- presentation of the current Persistent Play context.

The intended dependency direction is:

```text
Campaign Management
        │
        │ reads / exposes / navigates
        ▼
Persistent Play
Scenario → Encounter → Combat
        │
        │ produces authoritative runtime state/history
        ▼
Campaign Management
Current Context / Recent Activity / Chronology
```

Campaign Management consumes runtime truth.

It must not maintain a parallel authoritative definition of:

- current Scenario;
- current Encounter;
- active Combat;
- Scenario lifecycle state.

If Campaign Management displays Scenario X as Active or Paused, that must represent the same authoritative state used by Persistent Play.

---

## 8. Relationship to Maps, Artifacts, Story, and Characters

The domains remain separate.

### 8.1 Maps

A Map represents spatial information and interaction.

Campaign Management may reference a Map because it is relevant to:

- a Campaign;
- a Scenario;
- an Encounter;
- a Character;
- a historical event;
- another Campaign relationship.

Campaign Management does not reproduce Map spatial data or Map interaction behaviour.

---

### 8.2 Artifacts

An Artifact represents reusable authored media/content such as documents, handouts, illustrations, portraits, or other supported Artifact types.

Campaign Management may relate an Artifact to:

- a Campaign;
- a Scenario;
- an Encounter;
- a Character;
- a historical event.

The Artifact remains authoritative in the Artifact domain.

---

### 8.3 Story

Story contains authored narrative material.

It may include:

- exposition;
- descriptions;
- lore;
- scene material;
- dialogue;
- background;
- other narrative content.

Story content does not become Campaign history merely because it is written.

Story may describe events that never occur.

Campaign chronology records Campaign history; Story records authored narrative material.

---

### 8.4 Characters

Characters remain authoritative domain objects.

Campaign Management may establish or derive relationships such as:

- Current PC;
- Former PC;
- Campaign-relevant NPC;
- Scenario participation;
- Encounter participation;
- historical involvement.

Campaign Management does not fork the Character into a separate Campaign-owned copy.

---

### 8.5 Cross-domain relationship principle

Conceptually:

```text
                     Story
                       │
                       │ references
                       ▼
Map  ◄────────── Campaign Context ──────────► Artifact
                       │
                       │
                       ▼
                  Characters
                       │
                       │
                       ▼
            Scenario / Encounter / Combat
                 Persistent Play
```

Relationships provide navigation and context.

They do not erase domain boundaries.

---

## 9. Architectural invariants

The following invariants are controlling architectural rules for #120.

### INV-CM-01 — Campaign is an explicit durable root

> **Campaign is a first-class durable domain object and the organizational root for Campaign Management.**

Campaign is not merely an inferred collection of Scenarios.

---

### INV-CM-02 — Persistent Play owns runtime truth

> **Campaign Management may present and navigate runtime state, but Persistent Play remains authoritative for Scenario, Encounter, and Combat runtime state.**

No competing Campaign-management runtime state may be introduced.

---

### INV-CM-03 — Relationship does not transfer ownership

> **A Campaign Management relationship is a reference, not an ownership transfer.**

Linking a:

- Map;
- Artifact;
- Story item;
- Character;
- Persistent Play object

to a Campaign must not duplicate, fork, or transfer authoritative data into Campaign Management.

The specialist domain remains authoritative.

---

### INV-CM-04 — Historical inspection is non-mutating

> **Opening, searching, navigating, or inspecting historical Campaign material must not alter current Persistent Play state.**

Therefore:

- opening a Closed Scenario cannot make it current;
- inspecting a Paused or historical Scenario cannot activate it;
- opening an old Encounter cannot resume it;
- navigating chronology cannot change the active Scenario;
- inspecting an old Combat cannot change current runtime context;
- historical search results are observational until the GM explicitly enters an authorized runtime action.

---

### INV-CM-05 — Scenario remains the adventure-level playable object

> **Campaign Management does not introduce a separate Adventure object without a future concrete product requirement.**

Scenario remains the Campaign's playable adventure-level object.

---

### INV-CM-06 — Chronology preserves provenance

> **Runtime-derived history and GM-authored Campaign events must remain distinguishable by type and provenance.**

Manual Campaign events cannot rewrite authoritative runtime history.

---

### INV-CM-07 — Campaign state is deliberately bounded

> **Structured Campaign state may exist only for identified Campaign-level product purposes.**

Campaign Management must not become a generic key/value store or secondary rules engine.

---

### INV-CM-08 — Notes are operational, not Story

> **GM Notes are lightweight operational Campaign material and remain distinct from authored Story prose.**

A Note does not automatically become narrative canon or historical chronology.

---

### INV-CM-09 — Character membership is relational

> **A Character's Campaign role or membership is a relationship to the Campaign, not a duplicate Character object.**

Initial PC membership is Current or Former.

NPC prominence uses the approved hybrid relevance model.

---

### INV-CM-10 — Search preserves domain identity

> **Campaign-scoped search may span domains, but every result retains its true object type, context, authority, and visibility.**

Search must not create a generic Campaign-content abstraction.

---

### INV-CM-11 — Visibility does not propagate automatically through relationships

> **Linking objects does not automatically grant visibility to the referenced object or relationship.**

The relevant visibility authority must continue to apply.

---

### INV-CM-12 — Campaign Home is opinionated in V1

> **Campaign Home is a designed GM workspace, not a customizable dashboard framework.**

Configurable cards and arbitrary layout customization are outside V1.

---

## 10. Acceptance examples

### Example A — Resume a paused Campaign

The GM opens **Northern Reaches**.

Campaign Home shows:

- _The Broken Tower_ — Paused;
- current Encounter — _The Lower Gatehouse_;
- no active Combat;
- recent activity indicating that Combat concluded and returned to the same Encounter;
- relevant NPCs and Map.

The GM selects the appropriate resume action and returns to the existing Encounter.

No duplicate Scenario or Encounter is created.

Campaign Management has not created an independent runtime state.

---

### Example B — Inspect a Closed Scenario safely

The Campaign currently has an Active Scenario.

The GM opens an older Closed Scenario to review what happened.

The GM may:

- inspect its Encounters;
- inspect Characters involved;
- view history;
- open related Maps;
- open related Artifacts;
- open related Story material;
- review Notes.

The current Active Scenario remains unchanged.

Historical inspection has no runtime side effect.

---

### Example C — Find an NPC from an earlier Scenario

The GM remembers an NPC named Harek but not where the NPC appeared.

Campaign search returns:

> **Harek — NPC**

with useful Campaign context such as previous Scenario and Encounter relationships.

The GM can navigate from Harek to those historical contexts.

If Harek was only incidental and never promoted to Campaign-relevant status, historical discoverability still works.

---

### Example D — Promote an NPC to Campaign relevance

An NPC first appears in a Scenario as a minor participant.

The NPC later becomes a recurring political figure.

The GM marks the NPC as Campaign-relevant.

The NPC now appears prominently in Campaign Management while retaining the same authoritative Character identity and previous historical relationships.

No duplicate NPC is created.

---

### Example E — Current versus Former PC

A PC leaves the adventuring group.

The Campaign membership changes from:

> Current → Former

Historical Scenario and Encounter relationships remain intact.

The Character is not deleted or copied.

Any Character condition remains governed by the Character/game domain.

---

### Example F — Private GM Note

While viewing an NPC, the GM records:

> "If confronted about the ring, she initially denies visiting Threshold."

The Note is:

- associated with the Campaign;
- linked to the NPC;
- visible through relevant GM Note views and discovery;
- private operational information;
- initially active/open.

Later the GM may resolve/archive it.

It does not automatically become Story or chronology.

---

### Example G — Prepare a Scenario using specialist domains

The GM opens Draft Scenario _Night of the Assassins_.

Campaign Management exposes relationships to:

- Story material — _Assassins' Background_;
- Map — _Palace: East Wing_;
- Characters — Duke Stefan and three assassins;
- Artifact — _Intercepted Letter_.

Opening each item takes the GM to the corresponding specialist domain.

Campaign Management does not contain copied versions.

---

### Example H — Campaign chronology from actual play

The GM opens Campaign History.

The chronology shows events such as:

1. _The Stolen Seal_ activated;
2. Encounter _Warehouse_ entered;
3. Combat occurred;
4. Scenario closed;
5. _The Duke's Road_ activated;
6. Encounter _Border Inn_;
7. Scenario paused.

These events reflect authoritative runtime history.

---

### Example I — Manual Campaign event in CM2

The GM adds:

> "Thaumont 14 — King Stefan declared martial law."

The event appears in Campaign chronology as an explicitly GM-authored Campaign event.

It is visibly distinguishable from Persistent Play events.

Creating it does not:

- alter Scenario history;
- create a Story item;
- rewrite any runtime event.

---

### Example J — Cross-domain discovery

The GM searches the Campaign for:

> Black Eagle

Results may include:

- NPC — Bargle;
- Scenario — _Agents of the Black Eagle_;
- Story material — _Black Eagle Barony Background_;
- Artifact — _Black Eagle Order_;
- Map — _Fort Doom_;
- GM Note.

Each result retains its actual domain identity and context.

---

### Example K — Relationship does not transfer ownership

An Artifact is linked to an Encounter and to a Campaign chronology event.

The Artifact remains one authoritative Artifact.

Editing the Artifact through the Artifact system affects the referenced object according to Artifact rules.

Campaign Management has not created separate copies for:

- the Campaign;
- the Encounter;
- the chronology entry.

---

### Example L — Historical Combat inspection

The GM opens a historical Combat from Campaign chronology.

The GM can inspect the historical Combat record where supported.

The current Scenario, Encounter, and Combat context remain unchanged.

Inspection does not resume historical play.

---

## 11. Exclusions and deferred capabilities

Campaign Management must not become a universal authoring, knowledge-management, or simulation framework.

The following are outside CM1 and CM2 unless separately approved later:

- separate Adventure domain object;
- general-purpose wiki;
- arbitrary document trees;
- replacement for Story authoring;
- replacement for Maps;
- replacement for Artifact Management;
- replacement for Character Management;
- replacement for Persistent Play;
- relationship graph visualization;
- automatic AI Campaign summaries;
- AI-generated GM advice;
- automatic extraction of canonical facts from Story prose;
- automatic conversion of Story into runtime state;
- player-facing Campaign portal;
- player-editable Campaign Management;
- configurable Campaign Home/dashboard layout;
- generic task/project management;
- generic Kanban facilities;
- arbitrary user-defined databases;
- arbitrary key/value Campaign variables;
- generalized rules-engine functionality;
- complex universal tagging ontology;
- full fantasy calendar simulation;
- general world encyclopedia / setting-management system;
- generalized faction-management system;
- generalized quest-management system;
- economic or domain-management simulation;
- Campaign cloning/templates;
- Campaign publishing/export;
- cross-Campaign linking;
- rewriting runtime history through manual chronology editing.

Some of these may later become valid Glantri products.

They must not be smuggled into Campaign Management without an explicit product decision.

---

## 12. Resolved Product Owner decisions

The following decisions are settled for this architecture.

### PO-1 — Campaign domain root

**Resolved:** Campaign is an explicit durable domain object.

It is the organizational root for:

- roster;
- GM Notes;
- cross-Scenario chronology;
- Campaign-scoped search;
- justified Campaign-level state;
- cross-domain relationships.

---

### PO-2 — Adventure versus Scenario

**Resolved:** No separate Adventure object initially.

Scenario remains the Campaign's adventure-level playable object.

---

### PO-3 — Manual Campaign chronology events

**Resolved:** Approved conceptually for CM2.

Chronology may contain:

- authoritative runtime-derived events;
- explicit GM-authored Campaign events.

They must remain distinguishable by provenance.

Manual events cannot rewrite runtime history.

---

### PO-4 — Campaign-level state

**Resolved:** Allowed, deliberately narrow.

Structured Campaign state requires a concrete product purpose.

No arbitrary generic key/value state system in V1.

---

### PO-5 — NPC membership/relevance

**Resolved:** Hybrid model.

Support:

- explicit Campaign-relevant NPC promotion;
- automatic historical discoverability through actual Campaign activity.

---

### PO-6 — PC membership

**Resolved:** Initial membership states are:

- Current;
- Former.

Additional states require concrete later UX justification.

---

### PO-7 — GM Notes

**Resolved:** Lightweight operational Notes are part of Campaign Management.

Initial lifecycle may support:

- active/open;
- resolved/archived.

Notes are not Story or general task management.

---

### PO-8 — Search

**Resolved:** Target architecture is Campaign-scoped cross-domain discovery while preserving object type, context, authority, permissions, and visibility.

CM1 may use narrower search coverage.

CM2 establishes broader discovery.

---

### PO-9 — Campaign Home configurability

**Resolved:** Not in V1.

Campaign Home should initially be an opinionated GM workspace.

---

### PO-10 — Player-facing Campaign Management

**Resolved:** Deferred.

CM1 and CM2 are GM-first.

Architecture must preserve future visibility boundaries without attempting to design an undefined player portal.

---

## 13. Milestone CM1 — Campaign Workspace and Current Context

### Product outcome

> **A GM can open a Campaign, immediately understand its current situation, manage and navigate its playable contents and roster, use private operational Notes, and reach relevant preparation or play material.**

CM1 establishes Campaign Management as a usable GM workspace.

### CM1 scope

#### Campaign Home

Provide an opinionated Campaign overview capable of surfacing the most useful current information, including as applicable:

- Campaign identity;
- current Persistent Play context;
- recent activity;
- Scenario summary;
- current PCs;
- relevant NPCs;
- active/open GM Notes;
- directly relevant linked material.

The exact presentation may be determined during implementation design, but Campaign Home must optimize for rapid situational understanding.

---

#### Current Persistent Play context

Campaign Management must surface the authoritative runtime context without duplicating it.

Conceptually:

```text
Campaign
   ↓
Current Scenario
   ↓
Current Encounter
   ↓
Active Combat, if any
```

The GM can navigate into appropriate current play.

Campaign Management does not create a second current-context model.

---

#### Scenario organization and navigation

The GM can:

- view Campaign Scenarios;
- distinguish lifecycle state;
- find relevant Scenarios;
- inspect Scenarios;
- reach current Persistent Play;
- navigate related material.

Historical inspection remains non-mutating.

---

#### PC roster

Support:

- Current PCs;
- Former PCs.

Campaign membership remains a relationship to authoritative Character objects.

---

#### Campaign-relevant NPCs

Support:

- explicit Campaign-relevant NPCs;
- historical discoverability of NPCs linked through Campaign activity.

Avoid cluttering the main roster with every incidental NPC.

---

#### GM Notes

Support lightweight private operational Notes with:

- Campaign relationship;
- optional links to relevant objects;
- active/open state;
- resolved/archived state.

Do not expand into general task management.

---

#### Recent activity

Campaign Home should expose enough recent activity to help the GM understand what just happened and resume context.

Recent activity is not a replacement for the full CM2 chronology.

---

#### Cross-domain navigation

From relevant Campaign contexts, allow navigation to:

- Maps;
- Artifacts;
- Story material;
- Characters.

All referenced domains retain authoritative ownership.

---

### CM1 acceptance proposition

> **From Campaign Home, the GM can determine where the Campaign currently stands and reach either current play or relevant preparation material without manually reconstructing context across multiple systems.**

---

## 14. Milestone CM2 — Campaign Memory and Discovery

### Product outcome

> **A GM can efficiently retrieve and understand the accumulated history and relationships of a long-running Campaign.**

CM2 establishes Campaign Management as durable Campaign memory rather than only a current-play workspace.

### CM2 scope

#### Campaign chronology

Provide a coherent Campaign-level chronological view derived primarily from authoritative Persistent Play history.

Chronology must preserve object relationships and provenance.

---

#### GM-authored Campaign events

Allow explicit manual historical events where justified.

Each manual event must be identifiable as GM-authored and must not rewrite runtime history.

---

#### Cross-object Campaign search

Search should span supported Campaign-related domains while retaining:

- object type;
- relationship context;
- authority;
- permissions;
- visibility.

Search results must not collapse different domain objects into a generic content type.

---

#### Filters and historical discovery

Support useful filtering dimensions where product value is clear, potentially including:

- object type;
- Scenario;
- lifecycle state;
- current versus historical;
- Character relationship;
- chronology context.

The precise filter set should be chosen from actual supported object semantics rather than creating an unrestricted metadata framework.

---

#### Relationship discovery

Allow the GM to understand meaningful Campaign relationships.

Examples:

```text
NPC
 ├── Campaign relevance
 ├── Scenario appearances
 ├── Encounter participation
 ├── Notes
 ├── Story relationships
 └── Artifact relationships
```

```text
Scenario
 ├── Encounters
 ├── Characters
 ├── Maps
 ├── Artifacts
 ├── Story
 ├── Notes
 └── Chronology
```

```text
Artifact
 ├── related Scenario
 ├── related Encounter
 ├── related Character
 └── relevant Campaign event
```

Relationships must remain references to authoritative objects.

---

#### Non-mutating historical navigation

The GM can navigate from:

- chronology;
- search results;
- Characters;
- Scenarios;
- related objects

into historical material and return without altering current Persistent Play state.

This is a mandatory CM2 behavioural property, not merely a UI preference.

---

### CM2 acceptance proposition

> **In a Campaign containing substantial accumulated play, the GM can locate a person, event, Scenario, or related object and understand its Campaign context without remembering where the material was originally created, while historical inspection remains safely separated from current runtime state.**

---

## 15. Remaining Product Owner decisions

No material Product Owner decision remains open at the durable product-architecture level.

Implementation activation will still require ordinary design decisions against the then-current `dev` baseline, such as:

- how the approved concepts map onto the application as it then exists;
- which search/object types are practical in the first CM1 slice;
- exact Campaign Home information density and interaction design;
- exact chronology presentation;
- exact activation sequencing and bounded implementation contracts.

Those are implementation-preparation decisions, not unresolved Campaign Management product architecture.

Accordingly:

> **#120 Campaign Management — conceptually Ready**

This means **product/architecture Ready**, not implementation-activated.
