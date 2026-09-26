# Campaign Storylines — product/UI contract

## 1. Status and scope

**Status:** Product Owner approved, 2026-09-24. This is the **current V1
product/UI contract** for Storylines. Implementation is **not** authorized by
this document.

**Authority:** Product Owner ruling of 2026-09-24 on Campaign Material, Scenario
Builder and Storylines.

**Storylines are a separate GM-only Campaign authoring surface for long-running
narrative, background and history spanning multiple Scenarios.**

### 1.1 What Storylines are not

| Storylines are not               | Because                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A **play surface**               | Play is governed by [Scenario Play Workspace](../architecture/scenario-play-workspace.md) and [Player Play V1](../architecture/player-play-v1.md).   |
| An **Artifact**                  | The Artifact system is governed by [Content authoring §3](content-authoring-scenario-preparation-and-artifact-management.md#3-one-artifact-system).  |
| A **player-visible Note system** | Storylines are GM-only by domain definition — [section 4](#4-the-privacy-invariant).                                                                 |
| A **general-purpose wiki**       | The standing prohibition in [People/Artifact model §10](people-artifact-and-gm-authoring-model.md#10-gm-campaign-material) governs this surface too. |

These negative boundaries are as binding as the scope below.

### 1.2 What this contract does not do

- It does **not** restate the Artifact, association or Scenario-preparation
  domain model, which is controlled by
  [Content authoring, Scenario preparation and Artifact management](content-authoring-scenario-preparation-and-artifact-management.md).
- It does **not** authorize schema, migration, runtime or UI implementation.
- It does **not** choose a physical storage representation for Storylines or
  Story Notes ([section 2.1](#21-relationships-must-be-referentially-sound)).
- It does **not** answer
  [OPEN-PPL-3](people-artifact-and-gm-authoring-model.md#open-ppl-3--where-the-campaign-scoped-gm-only-dossier-lives),
  and **must not be read as broadening into a general resolution of it.**
  Recording Storyline and Story Note as dedicated GM-only domain objects settles
  those two objects and nothing else about where the Campaign-scoped GM-only
  dossier lives.

---

## 2. Model

Two concepts, and no more.

**Storyline** — a long-running Campaign story or thread.

**Story Note** — a GM-only native text node inside a Storyline.

**Both are dedicated GM-only domain objects.** A Storyline is **not** an
Artifact, a Story Note is **not** an Artifact, and neither is an instance of a
generic Note or knowledge-management system. They are modelled as their own
domain objects with their own GM-only lifecycle.

A Story Note supports:

- a title;
- a simple text/Markdown body;
- an optional **parent Story Note**;
- ordering and hierarchy;
- an optional lightweight type/category, such as chapter, person, event,
  background, object or general;
- **typed links** to **at least People, Items, Artifacts and Scenarios**, and to
  other appropriate game objects;
- links to other Story Notes;
- ordinary external hyperlinks.

### 2.1 Relationships must be referentially sound

The requirement on every relationship above — parent, Story-Note link and typed
link to a game object — is that it is a **referentially sound typed
relationship**: the target type is known, the target exists, and a deleted or
moved target cannot leave a dangling or mistyped reference.

**No physical representation is chosen here.** This contract states the
requirement, not a table, column, join or storage shape; the implementing lane
selects one that satisfies it.

**A typed link means retrieval and context, never causality or order.** Per the
fourth consequence of [Content authoring §18.27](content-authoring-scenario-preparation-and-artifact-management.md#1827-narrative-freedom--content-management-serves-the-story), these relationships answer
_what relates to what_; they do not encode _what causes what_ or _what happens
first_, and no surface may present or traverse them as though they did.

### 2.2 The hierarchy is flexible

**Story → Chapter → Event is not a required schema and must not be prescribed as
one.** A chapter may link to several Scenarios, and one Scenario may relate to
multiple Storylines.

**This flexibility is required, not merely permitted.** It instantiates the first
consequence of [Content authoring §18.27](content-authoring-scenario-preparation-and-artifact-management.md#1827-narrative-freedom--content-management-serves-the-story): chronological history may be
recorded, but chronology is **not** the organizing ontology of the story. A
Storyline must not be forced into a single sequence, and the seventh consequence
**prohibits** deriving one in order to make the model cleaner.

### 2.3 Story Notes never absorb domain state

**A Story Note about a Person does not become a Person or Character field.** It
**links** to the canonical Person. The canonical editors remain the only home
for domain state, exactly as in
[Campaign Material and Scenario Builder §2.2](campaign-material-and-scenario-builder-ui.md#22-domain-objects-versus-artifacts).

---

## 3. UI concept

A simple three-part workspace is sufficient:

- **left** — the Storyline hierarchy/outliner;
- **centre** — the selected Story Note text;
- **right** — related game objects, notes and external references.

**No tables, forms, charting, image layout or general wiki feature set is
required.**

Typed relationships provide **backlinks**: a Person, Artifact or Item can show
its related Storylines and Story Notes and navigate to them — subject in every
case to [section 4](#4-the-privacy-invariant), which means those backlinks exist
only on GM-scoped surfaces.

Rich `[[wiki-style]]` inline internal linking is **future scope**. V1 uses
explicit typed relationships plus ordinary external Markdown links.

---

## 4. The privacy invariant

> **Storylines and Story Notes are GM-only by domain definition. They have no
> visibility or share control at all, and they are structurally excluded from
> every player-capable path.**

This is an **invariant**, not a preference or a default.

### 4.1 No visibility control exists

There is **no** visibility, share, publish or audience control on a Storyline or
a Story Note. There is no state in which one becomes player-visible. An
implementation that adds such a control violates this contract.

### 4.2 Structural exclusion

Storylines and Story Notes must be **structurally excluded** from:

- **player APIs and projections**;
- **player search and player material views**;
- **Blackboard and share flows**;
- **player-safe Activity**;
- **player-facing and session-summary AI context**.

"Structurally excluded" carries the meaning already established for the GM-only
dossier in
[People/Artifact model §6.1](people-artifact-and-gm-authoring-model.md#61-the-gm-only-dossier):
the text **must not be reachable by a non-GM in any payload**, not merely absent
from a rendered view. Client-side hiding, view-model redaction and component
omission do **not** satisfy it, per
[Product & Presentation Principles §4.5](product-presentation-principles.md#45-respect-perspective-knowledge-ownership-privacy-and-visibility)
and
[Authority and Information Projection](../architecture/information-authority-and-projection.md#projection-rules).
The satisfying shape is the one already accepted: the private text lives outside
any value object that travels into a projection, and is read only by an
explicitly GM-scoped path.

The AI half of the exclusion follows directly from the session-summary source
rule in
[People/Artifact model §11.2](people-artifact-and-gm-authoring-model.md#112-the-session-summary-source-rule--activity-is-the-only-source):
the **player-safe Activity projection is the exclusive source** for an AI session
summary. A Story Note is not Activity, so it is never eligible, and no
session-summary path may reach it.

Any lane implementing Storylines is a privacy-projection change and carries the
[mandatory QA floor](../../AGENTS.md#mandatory-qa-floor).

### 4.3 Nothing is ever "revealed"

**The Story Note itself is never revealed.** If the GM wants to communicate
material derived from a Story Note, they **explicitly create or update a
player-capable object** — a Scenario plan, a prepared GM message, or an Artifact.
That new or updated object carries the communicated content; the Story Note does
not change state and does not become visible.

---

## 5. Position in the authoring-level progression

A Campaign Storyline sits at the head of the progression recorded in
[Campaign Material and Scenario Builder §11](campaign-material-and-scenario-builder-ui.md#11-the-authoring-level-progression):

**Campaign Storyline → Scenario GM Plan → Encounter preparation → Prepared GM
message → Published Activity**

**Information does not automatically flow down this chain.** Movement from a
Storyline into any more immediate or player-capable layer is always an
**explicit GM decision**, and is exactly the act described in
[section 4.3](#43-nothing-is-ever-revealed).

---

## 6. Relationship to existing contracts

| Document                                                                                                                             | Relationship                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [Content authoring, Scenario preparation and Artifact management](content-authoring-scenario-preparation-and-artifact-management.md) | **Controlling** for Artifacts, associations and Scenario preparation. A Story Note is none of those. |
| [People, Artifacts and GM authoring](people-artifact-and-gm-authoring-model.md)                                                      | Source of the structural-exclusion standard (§6.1) and the session-summary source rule (§11.2).      |
| [Campaign Material and Scenario Builder](campaign-material-and-scenario-builder-ui.md)                                               | The adjacent GM surfaces. Storylines are neither of them and duplicate neither.                      |
| [Player Play V1](../architecture/player-play-v1.md)                                                                                  | Activity and player projection authority; Storylines add no Activity event.                          |
| [Product & Presentation Principles](product-presentation-principles.md)                                                              | The perspective/privacy principle the invariant rests on.                                            |
