# Content authoring, Scenario preparation and Artifact management

## 1. Status and scope

**Status:** Product Owner approved, 2026-09-23; extended by the Product Owner
rulings of 2026-09-24. This is the **controlling contract** for content
authoring, Scenario preparation and Artifact management. Implementation is
**not** authorized by this document.

**Authority:** PRODUCT OWNER RULINGS recorded on
[#284](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/284) and
[#250](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/250), including
the 2026-09-23 rulings on the three conflicts a reconciliation pass surfaced
(C1, C2, C3), the partial-acceptance clarification, the canonical Artifact
Association ruling, the resolution of OPEN-PPL-6, the resolution of OPEN-PPL-4,
the Scenario GM Plan storage ruling, and the supplementary managing-GM
authority ruling that completes OPEN-PPL-4 — plus the **2026-09-24** rulings
that answer **OPEN-PPL-9 for V1** while deferring future context-specific
scoping ([section 18.9](#189-open-ppl-9-answered-for-v1)), **defer
OPEN-PPL-10 without deciding it** ([section 18.10](#1810-open-ppl-10-deferred-and-non-blocking)),
and **narrowly authorize a two-layer Scenario presentation override**
([section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1)).

**The controlling content-authoring principle — _content management serves the
story; it does not prescribe the story_ — is recorded at
[section 18.27](#1827-narrative-freedom--content-management-serves-the-story).**
It constrains how every lane models Campaign content, and authorizes nothing.

This contract **generalizes an implemented pipeline**. It does not introduce a
second import system, and no reader should build one from it.

### 1.1 What this contract controls

One coherent model for: authoring and importing content; managing Artifacts and
their associations; preparing a Scenario; and the AI round trip that supports
all three. Where an older contract says something narrower, the older contract
points here and this document governs.

### 1.2 What this contract does not do

- It does **not** reopen anything settled by #268 (Scenario Play Workspace),
  Player Play V1, #271, or #119 Artifact Management, except where a ruling in
  [section 18](#18-rulings-recorded-here) explicitly and narrowly amends it.
- It does **not** authorize schema, migration, runtime or UI implementation.
- It resolves **only** OPEN-PPL-6 and OPEN-PPL-4 (both settled and closed,
  2026-09-23), and records the Product Owner rulings of **2026-09-24**:
  **OPEN-PPL-9 answered for V1** with future scoping deferred
  ([section 18.9](#189-open-ppl-9-answered-for-v1)), **OPEN-PPL-10 deferred
  while remaining open** ([section 18.10](#1810-open-ppl-10-deferred-and-non-blocking)),
  and the **narrow Scenario presentation override**
  ([section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1)).
  In the
  [People/Artifact/GM authoring model](people-artifact-and-gm-authoring-model.md#15-open-decisions--none-chosen),
  **seven decisions — OPEN-PPL-1, 2, 3, 5, 7, 8 and 11 — remain open, unranked
  and unchanged.** OPEN-PPL-4 is settled by the 2026-09-23 Product Owner ruling
  recorded in that document and reflected here in
  [section 19.4](#194-reusable-profession-npc-representatives-depend-on-an-existing-open-decision).
- It does **not** answer
  [#279](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/279). See
  [section 11.6](#116-visibility-everything-begins-gm-private).

---

## 2. The one pipeline already exists

This is the framing the rest of the document depends on.

**Every authoring path in the implementation already builds an
`ArtifactPackage` client-side and goes through one staging pipeline.** There is
one envelope, one staging/preview/explicit-accept lifecycle, one derivation
module and one confirmation surface. The paths differ only in the surface that
assembles the package and in the `producer` recorded on it.

| Entry point             | Surface that assembles the package                                | `producer`                    |
| ----------------------- | ----------------------------------------------------------------- | ----------------------------- |
| Ordinary GM upload      | `apps/web/src/features/artifacts/OrdinaryArtifactUploadPanel.tsx` | `glantri-app/ordinary-upload` |
| AI-assisted intake      | `apps/web/src/features/artifacts/intake/intakeProposal.ts`        | `glantri-app/ai-intake`       |
| Authored package import | `apps/web/src/features/artifacts/ArtifactImportPanel.tsx`         | the package's own producer    |

All three then share:

- **one derivation module** — `apps/web/src/features/artifacts/artifactPackageDerivation.ts`
  derives resource identity, media type and SHA-256 for every path;
- **one API boundary** — `POST /campaigns/:campaignId/artifact-imports`, then
  preview, then explicit accept
  (`apps/api/src/routes/artifactImports.ts`);
- **one confirmation surface** — `ArtifactImportReview`, exported from
  `apps/web/src/features/artifacts/ArtifactImportPanel.tsx`;
- **one acceptance transaction** —
  `packages/database/src/repositories/artifactImportRepository.ts`.

> **There is one import system with several contextual entry points.** Any
> document, plan or slice that describes package import as a _separate route_
> from ordinary upload or AI intake is describing the surface, not the pipeline,
> and is stale.

This contract therefore **generalizes** that pipeline. It widens the envelope
and the entry points. It preserves the staging, preview, explicit-accept and
privacy behaviour exactly as implemented.

---

## 3. One Artifact system

There is **one uploader and one Artifact management system**. Portrait,
item image, map, Scenario image and AI intake are **contextual entry points into
it**, not separate subsystems.

Four pieces of state are independent and must not be collapsed:

| State                     | Lives on        | Meaning                                                                                              |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| Artifact identity         | the Artifact    | which logical Artifact this is, stable across revisions                                              |
| Artifact `kind`           | the Artifact    | what the media is — map, image, portrait, document, handout                                          |
| Association `role`        | the association | how it is used here — primary portrait, general appearance, additional illustration, fallback, other |
| Visibility / presentation | separate state  | who may see it, and what is currently shown                                                          |

**`kind` is not `role`.** The same Artifact may be a portrait by kind and a
fallback by role in one association and a primary portrait in another. This is
the structural consequence of the OPEN-PPL-6 resolution in
[section 18.6](#186-open-ppl-6-resolved).

**Selection is not visibility.** The 2026-09-24 ruling in
[section 18.9](#189-open-ppl-9-answered-for-v1) settles for V1 that a persistent
Person carries **at most one selected primary portrait**, **at most one selected
general appearance**, and **zero or more additional illustrations**, all
**global to that Person** — and that **Artifact visibility remains independent**
of those selections. Selecting an Artifact as a Person's primary portrait
therefore reveals nothing and publishes nothing; the fourth row of the table
above continues to decide who may see it. The two selected roles are
**independent singletons**, not one slot with two possible fillers.

This restates and does not change
[#284 §6 as recorded](people-artifact-and-gm-authoring-model.md#7-artifact-and-representation-lifecycle):
Artifact identity, semantic association, visibility/reveal and current
presentation are four separate pieces of state.

---

## 4. Typed associations

Campaign, Scenario, Encounter, Person and Item relationships are **canonical
typed associations**, not free-form tags. Ordinary tags remain, for search.

- **Campaign is the owning scope.** Every Artifact and every association is
  Campaign-scoped, per
  [Artifact Management §6.2](../architecture/artifact-management-package-import.md#62-v1-ownership-model).
- **Scenario association means intended or relevant use**, and is
  **many-to-many**. It is not ownership and not visibility.
- Associations are **manageable bidirectionally**: from the Artifact, and from
  the associated object.

### 4.1 The canonical Artifact Association layer

**PRODUCT OWNER RULING, 2026-09-23 (Slice A).**

> Do not elevate `CampaignItemArtifactAttachment` into the universal canonical
> association mechanism merely because it exists. Establish a common canonical
> Artifact Association domain layer supporting: typed target/domain; association
> role; Campaign scope; bidirectional lookup; durable historical association;
> association provenance; stable identity; revision pinning/provenance where the
> associated media semantics require it; attach existing;
> upload-new-and-attach; disassociate without deleting the Artifact. The
> physical database representation need not be a single polymorphic table if
> that would sacrifice referential integrity. Existing
> `CampaignItemArtifactAttachment` may be migrated, adapted or wrapped as
> appropriate. **The requirement is one canonical domain/service abstraction,
> not necessarily one SQL table.**

Required capabilities, restated as a checklist:

1. typed target / domain;
2. association role — see [section 4.2](#42-the-v1-association-role-vocabulary-for-a-person)
   for the V1 vocabulary this must carry for a Person;
3. Campaign scope;
4. bidirectional lookup;
5. durable historical association (see [section 9](#9-durable-history));
6. association provenance (see [section 6](#6-provenance));
7. stable identity;
8. revision pinning and revision provenance where the associated media
   semantics require it, in the sense of
   [Artifact Management §4.4](../architecture/artifact-management-package-import.md#44-revision-pinning);
9. attach an existing Artifact;
10. upload new and attach in one act;
11. **disassociate without deleting the Artifact.**

This is consistent with, and does not weaken,
[PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics),
which already requires zero/one/many multiplicity, revision pinning, attachment
provenance, and no one-to-one assumption, and which already declines to name a
table. This ruling adds that the **domain abstraction** is singular even where
the storage is not.

Attaching, referencing or sharing still transfers no ownership
([Artifact Management §6.4](../architecture/artifact-management-package-import.md#64-no-implicit-ownership-transfer)),
and a reference still grants no view rights
([§9.2](../architecture/artifact-management-package-import.md#92-references-do-not-grant-view-rights)).

### 4.2 The V1 association-role vocabulary for a Person

**PRODUCT OWNER RULING, 2026-09-24.** Full text and the deferral boundary are in
[section 18.9](#189-open-ppl-9-answered-for-v1). This section records what the
association layer above must support **for a persistent Person in V1**, and
nothing more.

| V1 role                         | Multiplicity per Person | Selection scope          |
| ------------------------------- | ----------------------- | ------------------------ |
| **selected primary portrait**   | **at most one**         | **global to the Person** |
| **selected general appearance** | **at most one**         | **global to the Person** |
| **additional illustration**     | **zero or more**        | **global to the Person** |

Binding on the implementing lane:

1. The two selected roles are **independent singletons**. A Person may hold
   both, either, or neither. They are not two values of one "primary" slot.
2. Additional illustrations are an **open set** with no selection semantics.
3. **Selections are global to the Person.** V1 builds **no** generalized
   Campaign-, Scenario-, entitlement- or play-context-specific primary-selection
   system, and **no** scope column, override table or resolution-order rule for
   a scope that does not yet exist. **Amended 2026-09-24, Product Owner,
   narrowly:** the single exception is the two-layer Scenario **presentation**
   override of
   [section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1),
   which overrides a Scenario's inherited presentation and **does not** create
   Scenario-scoped roles or alter these global selections. **Everything else
   this clause forbids remains forbidden.**
4. **Artifact visibility is independent of selection**, per
   [section 3](#3-one-artifact-system).
5. **"At most one selected" constrains selection, not association
   multiplicity.** A Person still carries zero, one or many Artifact
   associations. Implementing this as a one-to-one pointer field is explicitly
   **not acceptable** under
   [PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics),
   which is unchanged by this ruling.
6. The vocabulary is **not closed against future roles**, and the global scope
   above is the **default** that a future context-specific override would
   override. Recording it does not foreclose the deferred options; building an
   override mechanism now exceeds the ruling.

This sits **inside** the OPEN-PPL-6 resolution
([section 18.6](#186-open-ppl-6-resolved)) rather than amending it: role remains
on the association, intrinsic representation nature remains on the Artifact, and
representation readiness remains **derived** from both
([section 15](#15-representation-readiness)).

### 4.3 The V1 association-role vocabulary for an Item

**PRODUCT OWNER RULING, 2026-09-25.** Full text and boundary are in
[section 18.25](#1825-item-representation-roles). This section records what the
association layer of [section 4.1](#41-the-canonical-artifact-association-layer)
must support **for an Item in V1**, and nothing more. It is the same vocabulary
shape as [section 4.2](#42-the-v1-association-role-vocabulary-for-a-person),
reusing the same roles, conventions and naming rather than a parallel one.

| V1 role                                          | Multiplicity per Item | Selection scope        |
| ------------------------------------------------ | --------------------- | ---------------------- |
| **selected general/unidentified representation** | **at most one**       | **global to the Item** |
| **selected identified/examined representation**  | **at most one**       | **global to the Item** |
| **additional illustration**                      | **zero or more**      | **global to the Item** |

Binding on the implementing lane, on the same terms as
[section 4.2](#42-the-v1-association-role-vocabulary-for-a-person):

1. The two selected roles are **independent singletons**. An Item may hold both,
   either, or neither. They are not two values of one "primary" slot.
2. Additional illustrations are an **open set** with no selection semantics.
3. **Selections are global to the Item.** The single exception is the narrow
   Scenario **presentation** overlay of
   [section 18.20](#1820-item-presentation-layers-and-scenario-overrides), which
   creates no Scenario-scoped roles and alters no global selection.
4. **Artifact visibility is independent of selection**, per
   [section 3](#3-one-artifact-system).
5. **"At most one selected" constrains selection, not association
   multiplicity**, and a one-to-one pointer field remains unacceptable under
   [PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics).

**These roles select representation Artifacts.** The Item's **textual**
presentation — its label and its two presentation descriptions
([section 18.20](#1820-item-presentation-layers-and-scenario-overrides)) — is
Item domain state and **must not be modelled as a generic association**.

---

## 5. Reuse first

Existing canonical content is **reused, not recreated**.

- Adding an existing Person or Item to a Scenario normally makes its relevant
  canonical representations available automatically.
- Scenario-specific media may still be attached directly.

> **Reuse first is a reuse of canonical entities, never a byte-level auto-merge.**
> [INV-ART-02](../architecture/artifact-management-package-import.md#inv-art-02--logical-identity-is-distinct-from-binary-identity)
> continues to govern: identical bytes never collapse two logical Artifacts, and
> [§16.5](../architecture/artifact-management-package-import.md#165-generic-merge-prohibited)
> still prohibits generic merge. "Reuse" means the GM or the package **references
> an existing canonical identity**; it never means the system silently unifies two
> Artifacts because their content hashes match.

---

## 6. Provenance

Provenance exists at two levels, and they answer different questions.

**Artifact provenance** — who made this media, and where did it come from:

- author/creator;
- added or imported by;
- source, batch and run;
- optional source/workflow metadata.

This is **provider-neutral**. No field names or assumes a particular AI vendor,
model or tool.

**Association provenance** — why this Artifact is attached here:

- lightweight, for example "created by AI package X", "confirmed by GM";
- enough to support audit, package review and **rollback of the association**.

> **Rolling back an association must not delete the Artifact.** Reverting a
> package's associations removes the relationships it created. The media remains
> canonical Campaign material, per capability 11 in
> [section 4.1](#41-the-canonical-artifact-association-layer) and
> [Artifact Management §7.3](../architecture/artifact-management-package-import.md#73-retirement-rather-than-destructive-deletion).

Object-level import provenance and the Import Record already specified by
[Artifact Management §18](../architecture/artifact-management-package-import.md#18-provenance-and-import-record)
are preserved unchanged.

---

## 7. Central Campaign Material surface

One Campaign-level GM surface for finding and managing all authored material.

**Layout:** a searchable, filterable list on the left; a **dominant Inspector**
on the right; management controls on the surface. The Inspector is the existing
one — [PPV1 §8.2](../architecture/player-play-v1.md#82-inspector) — specialized,
never a second Inspector.

**Filters** include: Scenario; Encounter; type/kind; association role;
visibility; author/source; batch; association status; representation readiness;
and free search/tags.

The **association-role filter** is a filter over the role vocabulary that
already exists on the association. For a Person in V1 that vocabulary is the one
in [section 4.2](#42-the-v1-association-role-vocabulary-for-a-person) — selected
primary portrait, selected general appearance, additional illustration — and the
filter is **global**, matching the global scope of the selections themselves.
Because selection and visibility are independent, the role filter and the
**visibility** filter are **separate filters that must not be conflated**:
filtering to "selected primary portrait" says nothing about who can see it.
This filter must **not** acquire a per-Campaign, per-tier or per-play-context
selection dimension in V1; no such dimension exists to filter on.

**Required capability:** the GM must be able to **filter to all content used by
a Scenario without entering that Scenario's play UI.**

Associations are manageable **bidirectionally** from this surface.

> **Scope prohibition, carried forward verbatim:**
> **"Do not build a general-purpose knowledge-management system."**
> ([#284 §9 as recorded](people-artifact-and-gm-authoring-model.md#10-gm-campaign-material).)
> The filter list above is the **most likely place for that prohibition to be
> exceeded**. These are filters over canonical typed associations that already
> exist. They are not folders, not taxonomies, not a document-management
> hierarchy, and not a second home for any domain object.

This surface extends
[Campaign Management V2 §6.2](../architecture/campaign-management-v2.md#62-index-behavior-and-canonical-homes)
— the index **references** domain objects and does not duplicate them — and
remains, per
[#268 §9](../architecture/scenario-play-workspace.md#9-campaign-artifact-management-boundary),
a **GM authoring and index surface** that is not the player in-play experience
and not a substitute for it.

---

## 8. Scenario preparation

### 8.1 The Scenario GM Plan

**One canonical long-form GM-only plan per Scenario.**

- Collapsible.
- Directly editable in the app.
- Importable and updateable through an Authoring Package.
- **It is not an Artifact.** It is Scenario-owned authored text.

It is distinct from **all** of the following, and must not be conflated with
any of them:

| Not the GM Plan          | What it is instead                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Player-facing scene text | Settled by [OPEN-PPV1-1](../architecture/player-play-v1.md#open-ppv1-1--settled-scenario-and-encounter-each-may-carry-replaceable-scene-text) |
| GM announcements         | Settled by [PPV1 §9.3](../architecture/player-play-v1.md#93-gm-announcements-versus-scene-text)                                               |
| Activity / history       | Settled by [PPV1 §9](../architecture/player-play-v1.md#9-activity-visibility-and-projection-rules)                                            |
| The published summary    | Storage still open — [OPEN-PPL-11](people-artifact-and-gm-authoring-model.md#open-ppl-11--where-the-post-play-summary-lives)                  |

#### Storage — SETTLED, 2026-09-23

**PRODUCT OWNER RULING**, quoted verbatim. Indexed in
[section 18.7](#187-scenario-gm-plan-storage).

> "It is a canonical nullable long-form text field owned by Scenario, GM-only
> and Markdown/plain-text capable. It is not an Artifact, generic Note/KM
> entity, or separate rich-document object. Authoring-package changes stage
> updates through the common import pipeline. Stale package context must not
> silently overwrite a newer GM edit; use the existing Scenario
> revision/concurrency mechanism or equivalent conflict detection."

- **What it is.** A **canonical nullable long-form text field owned by
  `Scenario`**, **GM-only**, and **Markdown/plain-text capable**.
- **What it is not.** **Not** an Artifact, **not** a generic Note/KM entity,
  **not** a separate rich-document object.
- **Package updates.** Authoring-package changes **stage updates through the
  common import pipeline** of [section 2](#2-the-one-pipeline-already-exists).
  They never write directly, and GM Plan update remains a type that its owning
  lane must explicitly enable per
  [section 11.5](#115-importable-domain-types).
- **Conflict detection.** **Stale package context must not silently overwrite a
  newer GM edit.** The existing Scenario revision/concurrency mechanism is the
  `expectedRevision` check in `updateScenario` in
  `packages/database/src/repositories/scenarioRepository.ts`: under a row lock
  it compares the caller's `expectedRevision` against the Scenario's
  `updatedAt` revision and raises
  `ScenarioPersistenceError("stale_revision")` on mismatch. It is the same
  opaque-revision shape as `expectedUpdatedAt` in
  [Character lifecycle authority](../architecture/character-lifecycle-authority.md#editsynchronize).
  The implementing lane uses that mechanism or an equivalent conflict
  detection; it does not invent a silent last-writer-wins path.

Because the field is **GM-only**, the lane that implements it is a privacy
projection change and carries the
[mandatory QA floor](../../AGENTS.md#mandatory-qa-floor).

This ruling settles **the storage of the GM Plan only**. It does **not** answer
OPEN-PPL-11, which remains open.

### 8.2 Scenario resource assembly

A Scenario assembles its resources by **association**, per
[section 4](#4-typed-associations): the people, Items, Artifacts and Maps
relevant to it. Assembly is preparation, not play, and not visibility.

### 8.3 Encounter preparation

Encounter preparation is **contextual state inside Scenario Play**. It is **not
a player-facing play surface**, consistent with
[#268 §6.1](../architecture/scenario-play-workspace.md#61-no-separate-encounter-play-page)
and
[PPV1 §7.2](../architecture/player-play-v1.md#72-no-parallel-encounter-systems).

When an Encounter is active it **filters the Situation projection** while the
**Scenario remains the persistent container**.

---

## 9. Durable history

Associations are **historical campaign data**.

- When a Scenario or an Encounter ends, its membership and roster **remain
  queryable**.
- Only the **current filtering effect** ceases.
- This enables derived queries — what material a Scenario used, where a Person
  has appeared, which Encounters an Artifact participated in.

> **Planned and private material stays distinct from events that actually
> happened. A GM Plan is never evidence that something occurred in play.**
> Derived history reads from associations and from Activity; it never promotes
> preparation text into a record of play. This is the same distinction the
> Product Owner settled as _plan and actual summary remain distinct_
> ([#284 §10 as recorded](people-artifact-and-gm-authoring-model.md#111-what-a-scenario-carries)).

---

## 10. Encounter and Artifact: ownership versus durable association

**PRODUCT OWNER RULING, 2026-09-23 (C1).** This narrowly clarifies and amends
[#268 §4.4](../architecture/scenario-play-workspace.md#44-encounter-association).

> Artifacts remain Campaign-scoped resources; an Encounter does not own pure
> Artifacts merely to support display. However, durable typed
> Encounter↔Artifact associations are approved where they serve preparation,
> historical participation/use and later querying. These associations survive
> the Encounter. Active Encounter state determines current player projection;
> ending the Encounter removes the active filtering effect but does not erase
> historical associations.

Read as a boundary:

| Approved                                                            | Still not approved                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------- |
| A durable typed Encounter↔Artifact **association**                  | Encounter **ownership** of a pure Artifact                    |
| Association serving preparation, participation history and querying | Introducing ownership semantics **merely to support display** |
| Associations that survive the Encounter                             | Erasing associations when the Encounter ends                  |

Display remains served by the **encounter-context Reveal action** #268 §4.4
already specifies, and Reveal remains the GM visibility operation defined by
[#268 §4.5](../architecture/scenario-play-workspace.md#45-reveal-and-share-are-two-different-operations).
Nothing here changes Item encounter/scenario presence, which #268 §4.4 already
settles as real game state.

---

## 11. The General Authoring Package

The **General Authoring Package** is the common envelope for the one pipeline in
[section 2](#2-the-one-pipeline-already-exists).

### 11.1 What the envelope may carry

- references to existing canonical entities and Artifacts;
- new media;
- Scenario GM Plan updates;
- Encounter definitions;
- Encounter planning-note updates;
- associations;
- provenance;
- package/batch defaults.

> **The envelope does not automatically make every domain object importable.**
> See [section 11.5](#115-importable-domain-types).

### 11.2 Identity

- **Stable IDs govern round-trip identity.**
- **Names are labels**, never identity —
  [§16.1](../architecture/artifact-management-package-import.md#161-name-equality-is-not-identity-equality).
- **Package-local IDs identify new proposals** until canonical IDs exist —
  [§14.1](../architecture/artifact-management-package-import.md#141-package-local-identity).

### 11.3 Package defaults and automated association

A package inherits Campaign, Scenario, author and batch context as defaults.
**Automatic association is the normal path when the relationship is
unambiguous.**

There are exactly **three** outcomes for a proposed relationship:

| Outcome                      | Behaviour                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------- |
| **Resolved**                 | Associate automatically.                                                      |
| **Ambiguous**                | **Never guess.** Route to review, with the candidates listed.                 |
| **Intentionally unattached** | A valid library Artifact with no association. **This is not an error state.** |

> **"Intentionally unattached" does not exist today and is recorded here as
> new.** Current behaviour, per
> [AI-assisted intake](ai-assisted-artifact-intake.md#relationship-resolution),
> blocks confirmation on an unresolved relationship until the GM binds a target
> **or clears it** — there is no way to declare "deliberately unattached" as a
> distinct, valid outcome. The **never guess** rule and the ambiguous-routing
> behaviour are existing behaviour and are preserved exactly.

### 11.4 Package semantics are additive

> **A package is ADDITIVE by default. Omission from a later package must not
> silently delete existing Scenario work.**

A package that does not mention an association, a plan section or an Artifact
says nothing about it. Removal is an **explicit** act, never an inference from
absence. This protects hand-authored GM work against a regenerated batch.

### 11.5 Importable domain types

**PRODUCT OWNER RULING, 2026-09-23 (C3).** This **supersedes** the older
"Artifact only" answer at
[Artifact Management PO-6](../architecture/artifact-management-package-import.md#po-6--initial-importable-object-scope).

> Importability is **explicit per-domain opt-in** through the common
> staging/acceptance pipeline. **Artifact and Item are already enabled in
> implementation.** Correct the stale documentation that still says
> Artifact-only. The General Authoring Package is the common envelope; it does
> not automatically make every domain object importable. Scenario GM Plan
> updates, Encounter creation/planning-note updates and future domain types
> become importable **only when their owning implementation lane explicitly
> enables and validates them.** Preserve the existing
> staging/preview/explicit-accept pipeline and privacy behavior.

Current enabled state:

| Type                                   | Status                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Artifact                               | **Enabled** (AM1)                                                                                             |
| Item                                   | **Enabled** (#271)                                                                                            |
| Scenario GM Plan update                | Not enabled — requires its owning lane to enable it                                                           |
| Encounter / planning note              | Not enabled — requires its owning lane to enable it                                                           |
| Map / Map layer                        | **Not enabled** — direction only, at [section 18.41](#1841-map-intake--identity-layer-choice-and-eligibility) |
| Story, Character/NPC, any other domain | Not enabled — explicit opt-in only                                                                            |

The typed registry in
[Artifact Management §13](../architecture/artifact-management-package-import.md#13-typed-object-registry)
continues to govern what an owning domain must define before its type is
enabled: what may be imported, required validation, legal references, legal
creation and update semantics, conflict handling, permissions and lifecycle
consequences.

**Amended 2026-09-26.** The multi-domain intake direction of
[section 18.38](#1838-one-intake-session-for-many-kinds-of-material) and the Map
package direction of
[section 18.41](#1841-map-intake--identity-layer-choice-and-eligibility) are
**future/target architecture**.

> **They widen no enabled set, expand no current slice, authorize no
> implementation, and do not change the table above.**

### 11.6 Visibility: everything begins GM-private

> **Every imported object begins GM-private, regardless of what the producer
> claims.** A suggested visibility is recorded as a suggestion and is never
> applied. Sharing remains a separate, deliberate act.

This is existing, implemented behaviour — see
[AI-assisted intake, Visibility](ai-assisted-artifact-intake.md#visibility) —
and this contract preserves it without change.

> **Dependency:**
> [#279](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/279) is the
> open Product Owner decision on the Reveal boundary. **It blocks any package
> default that could apply a suggested visibility.** This contract records the
> dependency and **does not resolve it**.

---

## 12. Bulk intake and review

Bulk intake provides:

- a validation summary;
- counts by status;
- spot review of sampled entries;
- exception review of the entries that need a decision;
- **partial acceptance**, as defined below.

**Amended 2026-09-26.** The batch requirements — a staging UI designed for dozens
of entries, multi-file and package upload, batch classification, bulk defaults with
per-entry overrides, and one explicit commit of the selected validated batch — are
recorded at [section 18.40](#1840-batch-intake-is-first-class).

### 12.1 Partial acceptance means pre-commit selection

**PRODUCT OWNER CLARIFICATION, 2026-09-23.** Stated prominently because a reader
of the target model alone would otherwise build the behaviour that
[Artifact Management §17.4](../architecture/artifact-management-package-import.md#174-no-best-effort-partial-import)
forbids.

> **Partial acceptance = select/deselect entries during staging and atomically
> commit the selected valid subset. Do not introduce best-effort runtime partial
> commit after acceptance begins. A failed selected transaction remains a failed
> transaction.**

Concretely:

- Selection happens **before** acceptance
  ([§17.1](../architecture/artifact-management-package-import.md#171-optional-selection)),
  and changing it recomputes dependencies and revalidates
  ([§17.2](../architecture/artifact-management-package-import.md#172-dependency-recomputation)).
- The selected graph then commits **atomically**
  ([§17.3](../architecture/artifact-management-package-import.md#173-atomic-acceptance)).
- If it fails, **nothing from that attempt is authoritative**
  ([§17.5](../architecture/artifact-management-package-import.md#175-failed-commit)).
- **"Import whatever succeeds and leave the rest failed" remains prohibited.**

Nothing in "bulk" or "partial" weakens this. The word _partial_ describes the
**subset the GM chose**, never a partially committed result.

### 12.2 Review tiers

The graded review tiers — detailed staged GM review, batch review, trusted bulk
intake — are recorded at
[#284 §8 as recorded](people-artifact-and-gm-authoring-model.md#9-ai-ingestion-scale).
A tier changes the **review shape** only; it never changes what an operation
means and never creates a second canonical path. Whether the tiers are modes or
configurations remains open under
[OPEN-PPL-8](people-artifact-and-gm-authoring-model.md#open-ppl-8--whether-the-review-tiers-are-new-modes-or-configurations),
which this contract does not answer.

---

## 13. Encounter stays lightweight

**PRODUCT OWNER RULING, 2026-09-23 (C2).**

> Preserve the settled principle that Encounter remains comparatively
> lightweight. The Scenario GM Plan is the long-form primary planning document.
> An Encounter may have **one lightweight GM-only planning note**: plain or
> Markdown text; collapsible; directly editable; importable/updateable; **no
> separate rich-document lifecycle.** Authoring Packages may set or update this
> Encounter field, but **do not model a separate rich "Encounter GM Plan
> document".**

| Approved                                   | Still prohibited                                     |
| ------------------------------------------ | ---------------------------------------------------- |
| One GM-only planning note **field**        | A second rich authoring document                     |
| Plain/Markdown text, collapsible, editable | A separate document lifecycle, versioning or history |
| Packages may set/update the field          | Packages creating an "Encounter GM Plan" entity      |

The settled principle this preserves is
[#284 §11 as recorded](people-artifact-and-gm-authoring-model.md#12-encounter):
keep Encounter comparatively lightweight, and **do not turn Encounter into a
second rich authoring document**. That principle is unchanged; the ruling grants
one field within it.

It equally does not disturb
[PO-SPW-3](../architecture/scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling).

---

## 14. Scenario Preparation Brief and the AI round trip

A **Scenario Preparation Brief** gives an AI assistant the context it needs to
propose material for a Scenario, and the assistant returns a **General Authoring
Package** that enters the ordinary pipeline in
[section 2](#2-the-one-pipeline-already-exists).

The round trip changes nothing about authority: the returned package is staged,
previewed and explicitly accepted, and creates nothing before the GM confirms
([the intake invariant](ai-assisted-artifact-intake.md#the-invariant)).

---

## 15. Representation readiness

Representation readiness is a **derived** state, per the OPEN-PPL-6 resolution
in [section 18.6](#186-open-ppl-6-resolved). Its reported values are:

| Value                | Meaning                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| **bespoke**          | A specific, purpose-made representation exists and is in use.           |
| **generic fallback** | A generic/reusable Artifact is currently serving as the representation. |
| **missing-expected** | A representation is expected here and none exists.                      |
| **none-required**    | No representation is expected for this object.                          |

Readiness reports **drill into the Campaign Material surface**
([section 7](#7-central-campaign-material-surface)) rather than forming a
separate reporting area.

> Readiness is **derived** from the Artifact's intrinsic representation nature
> and the association's role. It is **not** a fourth stored flag, and it must not
> reintroduce a single ambiguous generic/specific boolean.

**For a Person in V1, the association half of that derivation is now
determinable.** The roles readiness derives from are exactly those in
[section 4.2](#42-the-v1-association-role-vocabulary-for-a-person), and the
selections are **global to the Person**, so **readiness for a Person is likewise
a single global state** in V1 — there is no per-Campaign, per-tier or
per-Scenario readiness value, because there is no such selection to derive one
from. Readiness is still **derived**, not stored.

Because **selection is independent of visibility**, readiness reports what a
representation **is**, never what a given viewer may see. A Person whose
selected primary portrait is bespoke reads **bespoke** even where that Artifact
is not visible to a particular viewer; the Campaign Material surface's
visibility filter is the separate axis for that.

> **Extensibility, without building it.** If a future ruling introduces
> context-specific representation overrides
> ([section 18.9](#189-open-ppl-9-answered-for-v1)), readiness stays derived and
> simply derives from the selection that resolves in that context. **V1 must not
> anticipate that by storing readiness or by adding a scope dimension to it.**

---

## 16. AI parity

> **Anything AI or package intake can canonically create, associate or update
> MUST also be achievable through in-app human tooling.**

AI may **batch and automate**. It must **not** have privileged domain semantics.
There is no canonical field an AI can reach that a GM cannot.

This is the same principle recorded at
[#284 §2 as recorded](people-artifact-and-gm-authoring-model.md#3-ai-parity-principle),
restated here because [section 11.1](#111-what-the-envelope-may-carry) widens
what a package may carry, and every widening inherits the parity obligation.

---

## 17. Scope boundaries

| Item                                                 | Status                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reusable Encounter templates                         | **Later scope.** Recorded, not authorized.                                                                                                                                                                                                                                       |
| Random-Encounter mechanics                           | **Not in scope.**                                                                                                                                                                                                                                                                |
| Content Production Interface                         | **Future target architecture only.** See [section 19](#19-future-target-content-production-interface).                                                                                                                                                                           |
| Storage of the Scenario GM Plan                      | **Settled**, 2026-09-23. See [section 8.1](#81-the-scenario-gm-plan) and [section 18.7](#187-scenario-gm-plan-storage).                                                                                                                                                          |
| Anything gated on #279                               | Blocked; see [section 11.6](#116-visibility-everything-begins-gm-private).                                                                                                                                                                                                       |
| V1 representation selection                          | **Settled for V1**, 2026-09-24: two global singleton roles plus additional illustrations, visibility independent. See [section 4.2](#42-the-v1-association-role-vocabulary-for-a-person) and [section 18.9](#189-open-ppl-9-answered-for-v1).                                    |
| Narrow Scenario presentation override                | **Authorized for V1**, amended 2026-09-24. Two layers only, resolved as override-if-present then canonical default. See [section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1).                                                                          |
| Context-specific representation overrides in general | **Deferred, not rejected.** Per Campaign / entitlement tier / play context, and any generic scope column or resolution hierarchy. Not built in V1; returns to the Product Owner. See [section 18.9](#189-open-ppl-9-answered-for-v1).                                            |
| Player self-service Artifact creation/management     | **Future scope, and non-blocking for this contract.** [OPEN-PPL-10](people-artifact-and-gm-authoring-model.md#open-ppl-10--the-authority-model-for-player-self-service-artifacts) stays **open and deferred**; see [section 18.10](#1810-open-ppl-10-deferred-and-non-blocking). |

---

## 18. Rulings recorded here

All rulings below are PRODUCT OWNER rulings of **2026-09-23** unless stated
otherwise. They are recorded faithfully and are neither softened nor extended.

### 18.1 C1 — Encounter and Artifact persistence

**Status:** Settled. **Amends:** [#268 §4.4](../architecture/scenario-play-workspace.md#44-encounter-association),
narrowly. **Gates:** Nothing. Full text and boundary in
[section 10](#10-encounter-and-artifact-ownership-versus-durable-association).

### 18.2 C2 — Encounter planning

**Status:** Settled. **Preserves:** [#284 §11 as recorded](people-artifact-and-gm-authoring-model.md#12-encounter).
**Gates:** Nothing. Full text in [section 13](#13-encounter-stays-lightweight).

### 18.3 C3 — Importable domain types

**Status:** Settled. **Supersedes:**
[Artifact Management PO-6](../architecture/artifact-management-package-import.md#po-6--initial-importable-object-scope).
**Gates:** Nothing; each future type is gated on its own owning lane. Full text
in [section 11.5](#115-importable-domain-types).

### 18.4 Partial acceptance

**Status:** Clarified and settled. **Preserves:**
[Artifact Management §17.4](../architecture/artifact-management-package-import.md#174-no-best-effort-partial-import).
Full text in [section 12.1](#121-partial-acceptance-means-pre-commit-selection).

### 18.5 Slice A — canonical Artifact association architecture

**Status:** Settled. **Consistent with:**
[PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics).
Full text in [section 4.1](#41-the-canonical-artifact-association-layer).

### 18.6 OPEN-PPL-6 resolved

**Status:** **SETTLED and closed**, 2026-09-23. **Authority:** Product Owner.
**Was:**
[OPEN-PPL-6 — Where generic versus specific is recorded](people-artifact-and-gm-authoring-model.md#open-ppl-6--where-generic-versus-specific-is-recorded).
**Gates:** Nothing. It no longer gates lane C.

> Separate **intrinsic representation nature** from **contextual use**.
> **Artifact:** intrinsic representation nature = generic/reusable,
> specific/bespoke, or unspecified where required.
> **Association:** contextual role/use, e.g. primary portrait, general
> appearance, additional representation, fallback usage, plus association
> provenance.
> **"Generic" describes the content itself. "Currently used as a fallback for X"
> describes a relationship.**
> Representation-readiness state should be **derived** from these dimensions
> rather than duplicating a single ambiguous generic/specific flag.

This is the resolution recorded in
[section 3](#3-one-artifact-system) (kind versus role) and
[section 15](#15-representation-readiness) (derived readiness).

### 18.7 Scenario GM Plan storage

**Status:** **SETTLED and closed**, 2026-09-23. **Authority:** Product Owner.
**Gates:** Nothing further on storage; importability still requires the
explicit opt-in in [section 11.5](#115-importable-domain-types). Full text in
[section 8.1](#81-the-scenario-gm-plan).

> "It is a canonical nullable long-form text field owned by Scenario, GM-only
> and Markdown/plain-text capable. It is not an Artifact, generic Note/KM
> entity, or separate rich-document object. Authoring-package changes stage
> updates through the common import pipeline. Stale package context must not
> silently overwrite a newer GM edit; use the existing Scenario
> revision/concurrency mechanism or equivalent conflict detection."

The named existing mechanism is the `expectedRevision` /
`ScenarioPersistenceError("stale_revision")` check in `updateScenario` in
`packages/database/src/repositories/scenarioRepository.ts`.

### 18.8 OPEN-PPL-4 resolved

**Status:** **SETTLED and closed**, 2026-09-23. **Authority:** Product Owner.
**Was:**
[OPEN-PPL-4 — What a persistent NPC record is](people-artifact-and-gm-authoring-model.md#open-ppl-4--what-a-persistent-npc-record-is).
**Gates:** Nothing. It no longer gates lane A, and it never gated slice A.

> "A persistent NPC is a Character using the same full Character/rules model as
> a PC, but with no player owner and with GM control under the applicable
> GM/Campaign authority.
> `CampaignRosterEntry` provides Campaign membership; Character itself remains
> independent of Campaign.
> `ReusableEntity` is reusable source/archetype material, not the canonical
> persistent identity of a person."

The authority consequence is recorded in
[Character lifecycle authority](../architecture/character-lifecycle-authority.md#gm-controlled-characters-with-no-player-owner),
which now explicitly supports GM-controlled Characters with no player owner
while **preserving unchanged** the rule that a managing GM may not pull another
user's player-owned Character into a Campaign.

A **supplementary Product Owner ruling of the same date** settles the authority
that binds such a Character before it is rostered in any Campaign, quoted
verbatim:

> "A persistent ownerless NPC Character has a designated managing GM. That
> managing GM has permanent-Character lifecycle authority independent of
> Campaign roster membership, including before first rostering and after removal
> from a Campaign.
> `CampaignRosterEntry` continues to govern Campaign membership and
> Campaign-scoped authority/state; it does not establish permanent ownership.
> Existing player-owned Character protection remains unchanged: GM status or
> Campaign membership never grants lifecycle ownership/authority over another
> user's player-owned Character.
> Do not overload player `ownerId` to represent the managing GM. If no suitable
> durable authority relation exists, the implementation must add an explicit
> representation rather than infer it from GM role or Campaign membership.
> Record this without narrowing OPEN-PPL-5 or other remaining open decisions."

It is recorded in
[Pre-roster and post-removal authority](../architecture/character-lifecycle-authority.md#pre-roster-and-post-removal-authority--the-designated-managing-gm),
together with the
[binding representation constraint](../architecture/character-lifecycle-authority.md#the-representation-constraint--ownerid-may-not-be-overloaded)
that `ownerId` may not be overloaded and the managing GM may not be inferred
from GM role or Campaign membership. Any lane that adds that representation
carries the [mandatory QA floor](../../AGENTS.md#mandatory-qa-floor).

> **No other `OPEN-PPL-*` decision is resolved, narrowed or reopened by this
> contract.** OPEN-PPL-1, 2, 3, 5, 7, 8, 9, 10 and 11 remain open and
> unchanged. OPEN-PPL-5 in particular is untouched beyond recording that later
> materialization/promotion from reusable content to a persistent Character
> remains its concern.

### 18.9 OPEN-PPL-9 answered for V1

**Status:** **SETTLED FOR V1, 2026-09-24. Future scoping DEFERRED, not
rejected — this decision is not closed.** **Authority:** Product Owner.
**Was, and remains the standing record:**
[OPEN-PPL-9 — The scope of a selected primary representation](people-artifact-and-gm-authoring-model.md#open-ppl-9--the-scope-of-a-selected-primary-representation).
**Gates:** **Nothing in V1.** It no longer gates lane B or lane C. It still
governs any future context-specific representation override, which must return
to the Product Owner.

> "**OPEN-PPL-9 / V1 representation selection**: do not build a generalized
> Campaign-, Scenario-, entitlement- or play-context-specific primary-selection
> system now.
> For current V1:
>
> - a persistent Person may have at most one selected primary portrait;
> - at most one selected general appearance;
> - zero or more additional illustrations;
> - those selections are global to that Person;
> - Artifact visibility remains independent.
>
> Future context-specific representation overrides are deferred until an actual
> product need requires them."

**Both halves are binding and neither may be dropped.**

- **The V1 half is a complete, implementable answer.** It is recorded as the V1
  role vocabulary in
  [section 4.2](#42-the-v1-association-role-vocabulary-for-a-person), as the
  selection-versus-visibility separation in [section 3](#3-one-artifact-system),
  as the role filter in [section 7](#7-central-campaign-material-surface), and
  as global derived readiness in
  [section 15](#15-representation-readiness). A lane needs no further ruling to
  build it.
- **The deferred half is a deferral, not a rejection.** Per-Campaign,
  per-entitlement-tier and per-Scenario/per-play-context scoping remain
  available to a future Product Owner decision. Nothing recorded here may be
  read as ruling them out, and nothing here may be implemented in a way that
  would make them a redesign rather than an extension. Under the Product Owner's
  [decision frontier](people-artifact-and-gm-authoring-model.md#151-the-decision-frontier),
  **reasonable extensibility is sufficient; hypothetical completeness is not
  required** — so V1 builds the global default and **not** the override
  mechanism.

**Amended 2026-09-24, Product Owner, narrowly.** The deferred half is reduced by
exactly one carve-out: the two-layer Scenario **presentation** override of
[section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1)
is authorized for V1. The per-Campaign, per-entitlement-tier and per-play-context
cases, and the general context-specific override mechanism, **remain deferred and
still return to the Product Owner.**

**It resolves nothing else.**
[OPEN-PPL-1](people-artifact-and-gm-authoring-model.md#open-ppl-1--how-identity-revelation-is-modelled)
is untouched: which of a Person's two selected roles reaches a given viewer is a
visibility/projection question that OPEN-PPL-1 still owns.
[PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics)
and [section 18.6](#186-open-ppl-6-resolved) are both unchanged.

### 18.10 OPEN-PPL-10 deferred and non-blocking

**Status:** **OPEN. Deferred as of 2026-09-24. No option is chosen, ranked or
rejected. It is not settled and not closed.** **Authority for the deferral:**
Product Owner. **Standing record:**
[OPEN-PPL-10 — The authority model for player self-service Artifacts](people-artifact-and-gm-authoring-model.md#open-ppl-10--the-authority-model-for-player-self-service-artifacts).
**Gates:** **Nothing in the current GM-controlled content-authoring
implementation.** It still gates any work that actually implements player
self-service Artifact creation or management.

> "**OPEN-PPL-10**: player self-service Artifact creation/management is future
> scope and does not block the current GM-controlled content-authoring
> implementation. Keep the future decision open/deferred until player
> self-service is actually prioritized."

**What changed is the blocking status, not the decision.** The three options in
the standing record are preserved intact and **unranked**. This contract governs
**GM authoring**, and the ruling finds that GM authoring does not materially
depend on how player self-service authority is eventually modelled. It remains a
**permission decision and not a Builder choice**; a lane that reaches actual
player self-service **stops and returns it to the Product Owner**, and the
deferral is lifted when player self-service is actually prioritized.
[Artifact Management PO-3](../architecture/artifact-management-package-import.md#po-3--player-artifact-creationsubmission)
is unchanged and still defers player creation from AM1.

### 18.11 Narrow Scenario presentation override authorized for V1

**Status:** **SETTLED FOR V1, 2026-09-24.** **Authority:** Product Owner.
**Amends, narrowly:** [section 4.2](#42-the-v1-association-role-vocabulary-for-a-person)
clause 3, [section 17](#17-scope-boundaries) and the deferred half of
[section 18.9](#189-open-ppl-9-answered-for-v1). **Gates:** Nothing beyond the
lane that builds it.

> "A Scenario may optionally override the inherited general/unidentified image
> and/or description, and may optionally override the inherited identified image
> and/or description. Absence of an override means use the canonical Person
> presentation. This does **not** create Scenario-scoped primary roles or modify
> the Person's canonical Artifact selections. **No** generic context/scope
> column, arbitrary resolution hierarchy, entitlement-specific override system
> or per-player override is authorized.
>
> Resolution is simply: **Scenario override if present → otherwise canonical
> Person default.**"

**The authorization is exactly this and no wider.** The general context-specific
override case of [section 18.9](#189-open-ppl-9-answered-for-v1) stays deferred,
and every other prohibition in
[section 4.2](#42-the-v1-association-role-vocabulary-for-a-person) clause 3
stands. The product/UI shape of the override is recorded in
[Campaign Material and Scenario Builder §7](campaign-material-and-scenario-builder-ui.md#7-scenario-overlays);
**this section authorizes the mechanism, not its implementation.**

### 18.12 The Scenario presentation overlay shape

**Status:** **SETTLED FOR V1, 2026-09-25**; the slot shape **re-settled
2026-09-25** to carry the presentation label. **Authority:** Product Owner.
**Extends, narrowly:**
[section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1).
**Amends:** its own earlier four-slot closure, which is superseded by the six
slots below. **Gates:** Nothing beyond the lane that builds it.

The override authorized in section 18.11 takes the shape of a **narrow typed
Scenario-to-Person presentation overlay** carrying **exactly six optional
slots** — the label, image and description of each of the two layers of
[section 18.13](#1813-the-canonical-person-presentation-layers):

- optional general/unidentified **label** override;
- optional general/unidentified **image** override;
- optional general/unidentified **description** override;
- optional identified **label** override;
- optional identified **image** override;
- optional identified **description** override.

**A Scenario may override the label, the image and/or the description, for
either layer, independently.** Overriding one slot neither implies nor requires
overriding another.

**Six is the closed shape.** No seventh slot, and no further layer, is
authorized.

**This is not a generalized context override system.** No **generic scope
column**, no **entitlement hierarchy** and no **override-resolution framework**
is authorized. Resolution stays the single rule of section 18.11 — Scenario
override if present, otherwise canonical Person default — applied independently
per slot.

**Where an appropriate Scenario-Person relation already exists, the overlay
reuses it.** Otherwise a **dedicated referentially sound relation** is
acceptable, in the sense already established in
[Campaign Storylines §2.1](campaign-storylines.md#21-relationships-must-be-referentially-sound):
the target type is known, the target exists, and a deleted or moved target
cannot leave a dangling or mistyped reference.

**No physical representation is chosen here.** No table, column, join or storage
shape is prescribed; the implementing lane selects one that satisfies the
requirement above, subject to
[section 4.2](#42-the-v1-association-role-vocabulary-for-a-person) clause 3,
which the overlay does not widen.

### 18.13 The canonical Person presentation layers

**Status:** **SETTLED FOR V1, 2026-09-25**; **re-settled 2026-09-25** to carry
the presentation label. **Authority:** Product Owner. **Amends:** its own
earlier two-text shape, which is superseded by the three fields per layer below.
It records domain state the association vocabulary of
[section 4.2](#42-the-v1-association-role-vocabulary-for-a-person) does not
cover. **Gates:** Nothing beyond the lane that builds it.

**Each of a Person's two presentation layers — general/unidentified and
identified/recognized — consists of a `label`, an `image` and a
`description`.** The label and the description are Person domain state; the
image is the selected representation Artifact of
[section 4.2](#42-the-v1-association-role-vocabulary-for-a-person).

**The label is presentation metadata, not another identity level.** It is the
short player-facing name the layer presents — `The officer` at the
general/unidentified layer, `Captain Varro` at the identified layer. It adds no
third layer, no partial-identity state and no resolution step beyond the single
rule of
[section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1).

**The resolved player-safe label is what player-facing surfaces render as the
Person's name.** It drives the GM row's `Players see:` line
([Live GM Scenario Play §4.1](live-gm-scenario-play.md#41-gm-rows)), the
published speaker label of
[section 18.16](#1816-prepared-message-speaker-history-is-text-identity-in-v1),
the speaker on a `scenario_announcement`, and the before/after text snapshots
carried by `person_identity_revealed`
([section 18.15](#1815-scenario-recognition-is-a-distinct-activity-event-kind)).

**Labels are never sourced from the GM dossier.** Where no explicit label
exists, resolution falls back safely:

| Layer                    | Fallback when no label is set           |
| ------------------------ | --------------------------------------- |
| **general/unidentified** | the neutral **`Unidentified person`**   |
| **identified**           | the canonical player-facing Person name |

The two descriptions are a **general/unidentified description** and an
**identified description**.

They are **distinct from Artifact metadata** — an Artifact's own title, caption
or description describes the Artifact — and **distinct from the GM-only
dossier**, whose structural exclusion in
[People/Artifact model §6.1](people-artifact-and-gm-authoring-model.md#61-the-gm-only-dossier)
is unchanged and no part of which may be surfaced as a presentation text.

**Existing fields may be reused only if their semantics genuinely match.**
Whether any particular existing field qualifies is an implementation finding for
the building lane, not a claim settled here. The player-safety of each label and
text is recorded in
[Campaign Material and Scenario Builder §3.1](campaign-material-and-scenario-builder-ui.md#31-the-canonical-presentation-label-and-texts).

### 18.14 Scenario override lifecycle

**Status:** **SETTLED FOR V1, 2026-09-25.** **Authority:** Product Owner.
**Extends:**
[section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1)
and [section 15](#15-representation-readiness). **Gates:** Nothing beyond the
lane that builds it.

**An explicit Scenario override survives later canonical presentation changes.**
Editing the Person's canonical image or description neither clears nor
re-resolves an override already set for a Scenario.

**If an override's Artifact becomes unavailable or retired, readiness reports an
error and explicit GM repair or reset is required. Silent fallback to the
canonical representation is forbidden.** This holds during preparation and
during play alike; the play-time behaviour is
[section 18.17](#1817-a-broken-scenario-override-during-play). The reason is player-facing, not
cosmetic: an unidentified-layer override exists because the canonical
presentation is the thing being withheld, so quietly resolving to it could
change what players learn.

This stays a **derived** report in the sense of
[section 15](#15-representation-readiness) — a concrete, actionable preparation
issue, not a fourth stored readiness flag — and it surfaces on the Scenario
Builder readiness list at
[Campaign Material and Scenario Builder §7.5](campaign-material-and-scenario-builder-ui.md#75-override-lifecycle).

### 18.15 Scenario recognition is a distinct Activity event kind

**Status:** **SETTLED FOR V1, 2026-09-25.** **Authority:** Product Owner.
**Amends, narrowly:** nothing. It settles the event kind that
[Campaign Material and Scenario Builder §7.4.1](campaign-material-and-scenario-builder-ui.md#741-only-a-change-during-play-is-history)
previously left to the building lane. **Gates:** the
[mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) for the lane that
persists the event kind.

**A mid-play recognition or reveal produces the distinct player-safe
state-transition Activity event `person_identity_revealed`.** It records a
transition from unidentified to identified during play. It is
**not** a `scenario_announcement`
([Campaign Material and Scenario Builder §8.1](campaign-material-and-scenario-builder-ui.md#81-publication-creates-a-scenario_announcement-activity-event)):
publishing a prepared GM message and the party learning who someone is are
different things that happened, and durable history
([section 9](#9-durable-history)) records them as different kinds.

**Preparation-state edits produce no Activity.** Establishing or changing the
initial recognition state while preparing a Scenario is preparation, not an
event. The asymmetry is unchanged: a change during play is history, a change
during preparation is not.

**The event's payload snapshots the player-safe text label immediately before and
immediately after recognition**, together with the player-safe references needed
to render the entry. **V1 snapshots no speaker or Person images and no Artifact
revisions for this event**, consistent with the text-identity-only rule for
prepared-message speaker history in
[section 18.16](#1816-prepared-message-speaker-history-is-text-identity-in-v1).

**Implementing a new persisted Activity kind is floor-class**, on exactly the
basis already recorded for `scenario_announcement` — it changes persisted
player-safe/privacy-projected semantics, the classification
[PPV1 §9.4](../architecture/player-play-v1.md#94-the-existing-event-and-roll-model)
applies to adding an announcement event type. **This section settles the product
decision; it authorizes no implementation.**

> **Amended, 2026-09-26: this event's recipient scope is settled.** The earlier
> reading that `person_identity_revealed` records a **shared-party** transition
> assumed party-wide recognition, which
> [section 18.28](#1828-persistent-player-facing-knowledge-is-character-scoped)
> supersedes. **The event is written only when the identity disclosure is shared
> with the complete intended participating audience**; a disclosure reaching only
> a subset is recorded in those Characters' Knowledge Libraries and emits no
> shared identity event —
> [section 18.37](#1837-character-scoped-knowledge-and-the-shared-activity-record).
> **The intermediate record of that question as an open product decision, of the
> same date, is superseded, and no lane stops on it.**
> **Everything else in this section stands**: the event kind is distinct from
> `scenario_announcement`, preparation-state edits produce no Activity, the
> payload is text-identity-only, and the lane is floor-class.

### 18.16 Prepared-message speaker history is text identity in V1

**Status:** **SETTLED FOR V1, 2026-09-25.** **Authority:** Product Owner.
**Amends, narrowly:** the speaker-snapshot requirement in
[Campaign Material and Scenario Builder §8.2](campaign-material-and-scenario-builder-ui.md#82-speaker-identity-in-a-published-announcement),
by fixing what is snapshotted. **Gates:** Nothing beyond the lane that builds
it, which is already floor-class under
[section 18.15](#1815-scenario-recognition-is-a-distinct-activity-event-kind)
and §8.1 of that document.

**In V1, publication snapshots and persists the player-safe speaker label/text
identity used at publication time.**

**An image snapshot is not required**, and **historical Artifact-revision
semantics are not required** for Activity messages. An Activity entry is a
record of what was said and by whom it appeared to be said; it is not a
versioned rendering of an Artifact.

**The reason the snapshot exists is unchanged:** later recognition must not
silently rewrite historical Activity. An announcement made by an unidentified
stranger stays, in the players' history, an announcement made by an unidentified
stranger.

### 18.17 A broken Scenario override during play

**Status:** **SETTLED FOR V1, 2026-09-25.** **Authority:** Product Owner.
**Extends:** [section 18.14](#1814-scenario-override-lifecycle), which recorded
the preparation-time behaviour. **Gates:** Nothing beyond the lane that builds
it.

**A broken or unavailable override never silently falls back to the canonical
presentation — during play as well as during preparation.** The reason is the
one already recorded: an unidentified-layer override exists because the
canonical presentation is the thing being withheld, so resolving to it quietly
could reveal what the GM meant to withhold.

**The condition surfaces as a GM-visible error/readiness condition.** It remains
a **derived** report in the sense of
[section 15](#15-representation-readiness), not a stored flag.

**Where a player rendering is nevertheless required for a currently visible
entity, players see a neutral missing-representation placeholder** until the GM
**explicitly repairs the override or resets to the canonical default**. **If the
entity is not visible, nothing is rendered.**

**That placeholder is UI chrome. It is not an Artifact, and it is explicitly not
the [`generic fallback`](#15-representation-readiness) readiness value.** It
conveys **no identity-specific content**, it is **not persisted and not
shareable**, and it **does not satisfy readiness**. The product/UI form of both
is
[Campaign Material and Scenario Builder §7.5](campaign-material-and-scenario-builder-ui.md#75-override-lifecycle).

### 18.18 One active Encounter per Character

**Status:** **SETTLED FOR V1, 2026-09-25.** **Authority:** Product Owner.
**Extends, narrowly:** [section 8.3](#83-encounter-preparation) and
[section 13](#13-encounter-stays-lightweight), by fixing the one participation
rule live play enforces. **Gates:** Nothing beyond the lane that builds it.

**A Character may not participate in more than one _active_ Encounter
simultaneously.** This is a hard V1 invariant.

- **Arbitrary planned or historical associations with other Encounters remain
  valid.** The invariant constrains **active** participation only, and it does
  not narrow the durable association rule of
  [section 10](#10-encounter-and-artifact-ownership-versus-durable-association).
- An Encounter may be **prepared**, **active**, **paused** or **completed**, and
  **paused state is resumable**.
- **No timeline-branching and no snapshot semantics are authorized.** There is
  one current state per Encounter.

**This is the only Encounter-participation rule the live surface enforces.** The
product/UI form is
[Live GM Scenario Play §3.2](live-gm-scenario-play.md#32-encounter-lifecycle),
and it does not disturb
[PO-SPW-3](../architecture/scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling).

### 18.19 Live improvisation may establish the Scenario membership it implies

**Status:** **SETTLED FOR V1, 2026-09-25.** **Authority:** Product Owner.
**Extends, narrowly:** [section 8.2](#82-scenario-resource-assembly), by
allowing one GM live operation to create the association it implies. **Gates:**
Nothing beyond the lane that builds it.

**When an Encounter is active, adding a resource directly to that Encounter may
establish the missing Scenario membership automatically, as part of the same GM
operation.**

**The GM is not sent back through management screens merely to satisfy
bookkeeping.** Resources created or added during play go through **the same
canonical services** as preparation; no parallel live-only creation path exists.

**Scenario membership and Encounter membership remain distinct concepts.** This
section authorizes one operation to create both where one implies the other; it
does not merge them. The product/UI form is
[Live GM Scenario Play §3.3](live-gm-scenario-play.md#33-add-and-improvisation).

### 18.20 Item presentation layers and Scenario overrides

**Status:** **SETTLED FOR V1, 2026-09-25.** **Authority:** Product Owner.
**Extends, narrowly:**
[section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1),
[section 18.12](#1812-the-scenario-presentation-overlay-shape) and
[section 18.13](#1813-the-canonical-person-presentation-layers), by applying
the same model to Items. **Gates:** Nothing beyond the lane that builds it.

**An Item has the same two canonical presentation layers as a Person:**

- **general/unidentified** — canonical image and canonical description;
- **identified/examined** — canonical image and canonical identified
  description.

An Item may additionally carry **optional additional representations**, as a
Person may carry additional illustrations.

**Scenario overrides and live identification select or override these layers
under the already-approved narrow Scenario-presentation rules** of
[section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1)
and [section 18.12](#1812-the-scenario-presentation-overlay-shape). Resolution
stays that single rule — Scenario override if present, otherwise the canonical
Item default — applied independently per slot.

> **No new generalized presentation system is introduced.** This is the Person
> model applied to Items, not a parallel mechanism: no generic scope column, no
> entitlement hierarchy, no override-resolution framework and no per-player
> override is authorized.

**No physical representation is chosen here**, on the same terms as
[section 18.12](#1812-the-scenario-presentation-overlay-shape). The product/UI
form is
[Campaign Material and Scenario Builder §3.3](campaign-material-and-scenario-builder-ui.md#33-the-item-inspector-in-campaign-material)
and
[§7.6](campaign-material-and-scenario-builder-ui.md#76-the-item-scenario-overlay).

### 18.21 GM-only notes on Items and Artifacts

**Status:** **SETTLED FOR V1, 2026-09-25**, for semantics, prohibition and
storage. **Authority:** Product Owner. **Amends:** nothing. It records domain
state the
association vocabulary of
[section 4.2](#42-the-v1-association-role-vocabulary-for-a-person) does not
cover. **Gates:** Nothing beyond the lane that builds it.

**Items and Artifacts support lightweight canonical GM-only notes.** The note
belongs to the canonical object and is permanently GM-only.

- It has **no visibility, share or reveal state**, and no operation exposes it.
- It is **structurally excluded from all player projections, Activity, the
  Blackboard and player-facing AI context**, to the same standard as the GM-only
  dossier in
  [People/Artifact model §6.1](people-artifact-and-gm-authoring-model.md#61-the-gm-only-dossier).
- **Longer cross-object narrative belongs in Storylines**, not in an expanded
  note field.

> **This is not a generic Note system and must not be broadened into one.**

**Storage for Items and Artifacts is settled here.**

- **Artifact GM notes use the existing Artifact `gmNotes` capability**, already
  carried on the canonical Artifact as `gmNotes: z.string().optional()` in
  `packages/domain/src/campaign/artifact.ts:75`.
- **Item GM notes are a canonical GM-only field owned by the Item
  domain/service.**
- **No generic Note entity or table is created for this.**

This closes storage **for Items and Artifacts only**. The separate question of
where the Campaign-scoped GM-only Person dossier lives —
[OPEN-PPL-3](people-artifact-and-gm-authoring-model.md#open-ppl-3--where-the-campaign-scoped-gm-only-dossier-lives) — **remains open and is not resolved here.**

### 18.22 No universal presence state

**Status:** **SETTLED FOR V1, 2026-09-25.** **Authority:** Product Owner.
**Amends:** nothing; it records a prohibition and the typed cases it protects.
**Gates:** Nothing beyond the lanes that build the live surfaces.

> **No universal `present` state exists across resource types.**

| Resource     | What presence means                                                                                                                                                     |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Person**   | contextual **Situation/Encounter presence**; **leaving changes presence, hiding changes visibility**                                                                    |
| **Item**     | physical presence and location **remain owned by the Item lifecycle/service**; **pickup, drop and movement change location/possession, concealment changes visibility** |
| **Artifact** | live state is **access/share**, not physical presence                                                                                                                   |

**Encounter participation remains distinct from Situation presence.**

> **Live UI may use common verbs where useful, but they dispatch typed domain
> operations rather than one generic presence/reveal flag.**

This is the same principle as the `Reveal` family of
[Live GM Scenario Play §8](live-gm-scenario-play.md#8-reveal-is-a-family-of-gm-ux-actions),
applied a second time: one shared verb in the UI, typed domain operations
underneath, never a single stored boolean. The live-play form is
[Live GM Scenario Play §4.3](live-gm-scenario-play.md#43-presence-is-typed-per-resource),
and the preparation-side independence it protects is
[Campaign Material and Scenario Builder §7.6](campaign-material-and-scenario-builder-ui.md#76-the-item-scenario-overlay).

### 18.23 OPEN-PPL-1 settled for V1 — superseded by Character-scoped recognition

_The heading is retained in position so existing references continue to resolve.
**Its earlier ruling — that recognition is party-wide Scenario-Person state —
is superseded and is no longer controlling.**_

**Status:** **SUPERSEDED, 2026-09-26.** **Authority:** Product Owner.
**Superseded by:**
[section 18.28](#1828-persistent-player-facing-knowledge-is-character-scoped),
which re-settles
[OPEN-PPL-1](people-artifact-and-gm-authoring-model.md#open-ppl-1--how-identity-revelation-is-modelled)
as **Character-scoped** knowledge and recognition. **Gates:** **Nothing.**

**What is superseded.** That recognition is party-wide Scenario-Person state
held once for the whole party; and that per-player recognition is deferred, that
V1 builds no per-player recognition or visibility control, and that no lane may
build it. **Those statements are withdrawn. No lane stops on them, and no lane
treats per-Character knowledge as out of scope.**

**What survives, and is restated at
[section 18.28](#1828-persistent-player-facing-knowledge-is-character-scoped):**
that Scenario preparation establishes the initial unidentified/identified state;
that an explicit live GM action is the only thing that changes it during play;
and that **preparation edits emit no recognition events** — only a change during
play is history, per
[section 18.15](#1815-scenario-recognition-is-a-distinct-activity-event-kind).

The controlling product/UI form is now
[Campaign Material and Scenario Builder §7.4](campaign-material-and-scenario-builder-ui.md#74-recognition-is-character-scoped-scenario-person-state).

### 18.24 Artifact access states and the legacy `scenario` audience

**Status:** **SETTLED FOR V1, 2026-09-25.** **Authority:** Product Owner.
**Extends:** [section 3](#3-one-artifact-system) and
[section 8.2](#82-scenario-resource-assembly). **Gates:** the
[mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) for the lane that
changes persisted audience semantics, which is security-relevant.

**V1 has exactly two canonical Artifact access states:**

- **`GM only`**;
- **`Shared with Campaign players`**.

**Scenario association never grants access.** Associating an Artifact with a
Scenario or an Encounter is assembly, not visibility, consistent with
[Artifact Management §9.2](../architecture/artifact-management-package-import.md#92-references-do-not-grant-view-rights).

**The existing persisted `scenario` audience is legacy draft implementation, not
a V1 product state.** It is **retired from writable V1 semantics** by the
**smallest safe cleanup**: no code path may newly write it, and the product
surfaces offer only the two canonical states.

- **Draft data may be reset or rebuilt** under the existing draft-data policy.
- **No generalized migration machinery is authorized** for this — no backfill
  framework, no audience-mapping layer, no versioned audience model.

> **Safety rule: any temporary handling of residual legacy `scenario` state must
> fail closed.** Where the state is encountered and cannot be resolved to one of
> the two canonical states, it resolves to **`GM only`**. It must never be
> treated as, or widened into, player access.

The product/UI form is
[Campaign Material and Scenario Builder §2.4](campaign-material-and-scenario-builder-ui.md#24-artifact-access-is-campaign-level-and-current)
and the live form is
[Live GM Scenario Play §6.3](live-gm-scenario-play.md#63-artifact).

**Locating the legacy audience's persisted read and write paths is authorized
implementation-finding work.** This contract deliberately does not name file
locations, and a lane must not treat their absence as a contract omission or
stop for a ruling on it.

**The implementing Builder:**

- **locates and reports** every persisted read and write path for the legacy
  `scenario` audience;
- **eliminates or neutralizes writable V1 use** of it;
- **preserves fail-closed handling** for any surviving legacy state, per the
  safety rule above;
- **adds regression coverage** for both the removal and the fail-closed
  resolution.

> **Naming: this is readiness-gap A3 (Artifact access).** It is **unrelated to
> Combat A3 (UI consolidation)**, recorded at
> [Combat Panel §12.15](combat-panel-contract.md#1215-a3--ui-consolidation).
> The two share a label only. A reader encountering "A3" resolves it from the
> document it appears in, and the two must never be conflated.

### 18.25 Item representation roles

**Status:** **SETTLED FOR V1, 2026-09-25.** **Authority:** Product Owner.
**Extends:** [section 4.2](#42-the-v1-association-role-vocabulary-for-a-person)
and [section 18.20](#1820-item-presentation-layers-and-scenario-overrides), by
giving the Item layers a typed association-role vocabulary. **Gates:** Nothing
beyond the lane that builds it.

**The V1 association-role vocabulary for an Item is recorded at
[section 4.3](#43-the-v1-association-role-vocabulary-for-an-item):** a singleton
**general/unidentified representation**, a singleton
**identified/examined representation**, and **zero or more additional
illustrations**.

**It reuses the existing association-role conventions and naming** of
[section 4.1](#41-the-canonical-artifact-association-layer) and
[section 4.2](#42-the-v1-association-role-vocabulary-for-a-person). **No
parallel Item-only association mechanism is authorized.**

**These roles select representation Artifacts.** **Item textual presentation
fields must not become generic associations** — the Item's label and its two
presentation descriptions are Item domain state, on the same footing as the
Person presentation fields of
[section 18.13](#1813-the-canonical-person-presentation-layers).

### 18.26 Realtime synchronization is an explicit architecture decision

**Status:** **RECORDED AS REQUIRED, 2026-09-25.** **Authority:** Product Owner.
**Amends:** nothing. **Gates:** the **first strongly synchronized multiplayer
live-play slice**, and nothing earlier.

**An explicit realtime architecture decision is required before the first
strongly synchronized multiplayer live-play slice is built.** Strong
synchronization means players and GM observing the same live state without a
manual refresh, at an interaction latency the surface promises.

**No transport is chosen here.** WebSocket, SSE, long polling and any other
mechanism are equally unselected; selecting one is the decision this section
requires, not a Builder choice.

**Current state, recorded as fact:** the repository carries **no realtime
transport**, and liveness is **client polling**.

**This gates nothing already authorized.** It does **not** block Campaign
Material authoring, the Scenario GM Plan
([section 8.1](#81-the-scenario-gm-plan)) or Combat A3 preparation. Those
surfaces are GM-side preparation and operate correctly on the existing model.
The live-play form is
[Live GM Scenario Play §10.1](live-gm-scenario-play.md#101-strongly-synchronized-multiplayer-liveness).

---

### 18.27 Narrative freedom — content management serves the story

**Status:** **RECORDED AS REQUIRED, 2026-09-26.** **Authority:** Product Owner.
**Amends:** nothing. **Gates:** nothing, and it authorizes nothing. It is a
**standing constraint** on every lane that models, stores or presents Campaign
content.

> **Content management serves the story; it does not prescribe the story.**

Glantri must make complex Campaign material **vivid, memorable, reusable and
easy to navigate** without forcing it into a **single chronology, interpretation
or expected sequence of revelation**.

**Ambiguity, partial knowledge, mistaken or multiple identities, revisitation,
delayed recognition, conflicting appearances, retrospective reinterpretation and
multiple viewpoints are ordinary supported states, not data defects to be
normalized away.**

#### The seven consequences

1. **Chronological history may be recorded, but chronology is not the organizing
   ontology of the story.** This is a **refusal**, not an omission: the natural
   modelling instinct to make time the spine of the story is declined. Durable
   history ([section 9](#9-durable-history)) and Activity remain exactly what
   they are — records — and acquire no authority to order or structure the
   narrative.
2. **GM-known relationships do not automatically become player-known
   relationships.** Knowing a fact on the GM side is not a pending disclosure
   awaiting propagation. The GM-only dossier
   ([People/Artifact model §6.1](people-artifact-and-gm-authoring-model.md#61-the-gm-only-dossier))
   and the GM-private default
   ([section 11.6](#116-visibility-everything-begins-gm-private)) are the
   settled shape of this consequence.
3. **Unresolved identities, and contradictory or player-mistaken
   interpretations, may persist until explicitly resolved in play.** A Person
   may remain a generic appearance indefinitely
   ([People/Artifact model §4](people-artifact-and-gm-authoring-model.md#4-person-representation-and-identity));
   nothing in the model may force, expire or tidy away that state.
4. **Associations support retrieval and context, not prescribed causality or
   encounter order.** The canonical Artifact Association layer
   ([section 4.1](#41-the-canonical-artifact-association-layer)) and every typed
   relationship built over it answer _what relates to what_. They do not encode
   _what causes what_ or _what happens first_, and no surface may read them that
   way.
5. **Readiness is advisory and must never block improvisation.** This rule is
   **already stated** and is deliberately **not** restated in different words
   here:
   [Campaign Material and Scenario Builder §10](campaign-material-and-scenario-builder-ui.md#10-preparation-readiness),
   over the derived readiness of [section 15](#15-representation-readiness).
   That wording governs; this entry only records that the rule is one of this
   principle's consequences.
6. **Player-facing content supports memory and investigation without presenting
   the Campaign as a solved database of canonical facts.** Player-capable
   surfaces help players remember and investigate. They must not read as a
   settled, complete, authoritative answer key, and they must not imply that
   what is recorded is all there is.
7. **The implementation must not simplify or "repair" ambiguity merely to make
   the domain model cleaner.** **This is a prohibition, and it is the operative
   consequence for any Builder.** An implementation may **not**, in order to
   tidy the model: collapse multiple or unresolved identities into one resolved
   record; deduplicate, reconcile or overwrite conflicting appearances,
   descriptions or player interpretations; derive a canonical chronology or
   sequence the product has not asked for; propagate knowledge automatically to
   remove a divergence; or add a completeness, correctness or resolution
   requirement to content that the product allows to remain open. A cleaner
   domain model is **not** a justification. Where the correct behavior is
   genuinely ambiguous and materially consequential, record `Needs decision`
   per
   [Product & Presentation Principles §3](product-presentation-principles.md#3-interpretation-and-authority)
   rather than resolving it in code.

#### Where this principle bears

| Contract                                                                        | The consequences it instantiates                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [People, Artifacts and GM authoring](people-artifact-and-gm-authoring-model.md) | Consequences 2, 3 and 7 — unresolved and multiple identities, delayed recognition, and the GM dossier that stays private. |
| [Campaign Blackboard V1](campaign-blackboard-v1.md)                             | Consequences 1, 6 and 7 — no silent updates, access without obligation, and the refusal to model forgetting.              |
| [Campaign Storylines](campaign-storylines.md)                                   | Consequences 1 and 4 — the flexible hierarchy and typed links for retrieval rather than causality.                        |

#### Boundary — what this principle is not licence for

**This principle reopens nothing and creates nothing.** Specifically:

- It **must not be cited to reopen settled mechanics**, including anything
  settled by [section 17](#17-scope-boundaries), any ruling in this
  [section 18](#18-rulings-recorded-here), or the settled positions of the
  contracts listed above.
- It **must not be used to create generalized narrative machinery** — no
  narrative engine, no general-purpose wiki or knowledge base, no timeline
  subsystem, no causality or inference layer, and no universal hierarchy of
  facts.
- It **grants no new scope, surface, entity or capability.** It constrains how
  work that is already authorized models content, and nothing more.

### 18.28 Persistent player-facing knowledge is Character-scoped

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner.
**Supersedes:** [section 18.23](#1823-open-ppl-1-settled-for-v1--superseded-by-character-scoped-recognition)
and the party-wide half of every statement it settled. **Re-settles:**
[OPEN-PPL-1](people-artifact-and-gm-authoring-model.md#open-ppl-1--how-identity-revelation-is-modelled).
**Gates:** Nothing. A lane implementing recognition or knowledge proceeds on
this section.

> **Persistent player-facing knowledge in V1 is fundamentally Character-scoped.
> There is no single Campaign-party knowledge library.**

**A Character's Knowledge Library is the persistent story material explicitly
available to that Character.** It is the V1 home of that Character's
Discoveries ([section 18.32](#1832-runtime-discoveries-from-skill-rolls-and-play)),
player-authored notes ([section 18.34](#1834-player-authored-notes-live-in-a-characters-knowledge-library))
and met/known People state
([section 18.30](#1830-people-identities-and-metknown-state)).

**A disclosure to a group means granting the same information to a selected set
of Characters.** It does **not** create a separate global "group knowledge"
truth store, and no second shared knowledge record is authorized.

**Recipient selection is by Character.** Common recipient shortcuts may later
include: the acting Character; selected Characters; the current Encounter's
participants; the current Scenario's participants; all relevant Campaign player
Characters. **The exact UI is not prescribed here.**

**Canonical recognition is therefore Character-scoped**: an encountered or known
identity becomes connected to a canonical Person identity **for the relevant
Character or Characters**, not once for the whole party.

**What this replaces.** [Section 18.23](#1823-open-ppl-1-settled-for-v1--superseded-by-character-scoped-recognition)
settled recognition as party-wide Scenario-Person state held once for the whole
party. **That is superseded.** Its preparation/live asymmetry survives unchanged
and is restated here:

- **Scenario preparation establishes the initial unidentified/identified
  state.** Preparation may establish it for the Scenario's participating
  Characters; it remains preparation.
- **An explicit live GM action changes it**, and nothing else does.
- **Preparation edits emit no recognition Activity.** Only a change during play
  is history, per
  [section 18.15](#1815-scenario-recognition-is-a-distinct-activity-event-kind).

**No per-Character presentation override is authorized by this.** Which
presentation layer a viewer receives is a **visibility/projection** question
resolved from that viewer's Character-scoped recognition state, over the
existing two canonical layers of
[section 18.13](#1813-the-canonical-person-presentation-layers) and the single
narrow Scenario override of
[section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1).
**Every prohibition in [section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1)
and [section 18.20](#1820-item-presentation-layers-and-scenario-overrides)
stands** — no generic scope column, no entitlement hierarchy, no
override-resolution framework, and no per-player or per-Character
**presentation override**.

**Per-Character knowledge is no longer deferred and is no longer a non-goal.**
Every earlier statement that V1 builds no per-player recognition or knowledge
control, or that per-player knowledge divergence does not exist, is superseded.
**No lane stops on the ground that per-player knowledge is deferred.**

**The product/UI form** is
[Campaign Material and Scenario Builder §7.4](campaign-material-and-scenario-builder-ui.md#74-recognition-is-character-scoped-scenario-person-state);
the identity model is
[People/Artifact model §4](people-artifact-and-gm-authoring-model.md#4-person-representation-and-identity);
the live form is
[Live GM Scenario Play §5.2](live-gm-scenario-play.md#52-people-are-valid-blackboard-material)
and [§6.1](live-gm-scenario-play.md#61-person). **This section settles the
product decision; it authorizes no implementation.**

### 18.29 The Blackboard is shared external memory, not knowledge synchronization

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner.
**Extends:** [section 18.28](#1828-persistent-player-facing-knowledge-is-character-scoped).
**Gates:** Nothing beyond the lane that builds the Blackboard.

**The Campaign Blackboard remains a shared Campaign workspace.** A Character may
post information available in **their own Knowledge Library** to the Blackboard
at an authorized presentation/detail level.

> **Posting to the Blackboard does not copy that information into any other
> Character's Knowledge Library. Removing Blackboard material does not alter any
> Character's Knowledge Library.**

A Character may therefore **know something privately, share it later, share only
a less-revealing presentation, or choose not to share it at all.**

> **This asymmetry between Knowledge Library and Blackboard is a gameplay
> feature, not a synchronization defect.** Characters' skills, perceptions and
> private discoveries are intended to create meaningful information differences
> within the party. **No lane may "fix" it by synchronizing the two, and no QA
> finding may treat the divergence as a bug.**

The Blackboard contract is
[Campaign Blackboard V1](campaign-blackboard-v1.md), whose
[§9](campaign-blackboard-v1.md#9-no-silent-blackboard-updates) no-silent-update
rule and [§22](campaign-blackboard-v1.md#22-privacy-and-disclosure-invariants)
invariants carry this rule on the product surface.

### 18.30 People, identities and met/known state

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner.
**Amends:** [section 18.13](#1813-the-canonical-person-presentation-layers) by
scoping which layer projects to the viewing Character.
**Gates:** the [mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) for the
lane that persists identity or met/known state, which is privacy-relevant.

**A "People you have met" concept is preserved** as part of player-facing
knowledge, held per Character.

**A canonical Person may have multiple player-facing identities** — for example
`Captain Varro`, `The masked swordsman`, `Brother Anselm`. **The GM and the
system may know privately that several identities resolve to the same canonical
Person while the Characters do not.** **Multiple identities may coexist as
apparently separate People entries for as long as the fiction requires.**

> **Anti-leak invariant.** **No distinguishable player-facing card type, icon,
> identifier form, metadata or other mechanical leak may expose whether a
> player-facing People entry is the canonical Person, an identity/alias backed
> by a canonical Person, or an unresolved encountered identity.** This is a
> **privacy invariant, not a UI preference**, and it is enforced by what the
> projection carries, on the standard of
> [section 18.31](#1831-player-projection-must-hide-preparation-mechanics).

**Resolution retains history.** When play establishes that two identities are
the same person, **the GM may explicitly resolve them, and their
encounter/history information must be retained rather than discarded.**
**Resolution may connect two aliases without yet revealing a canonical
identity.**

**A Person's states are not a single flag.** A Person may be **known without
being met**; **met under an unresolved identity**; **met and recognized**; or
**represented through several identities at different times**.

**Background people do not become durable People entries merely because they
physically exist in a scene.** **Hidden NPCs remain fully usable by the GM** in
selectors, rolls, Combat, Items, tasks and other GM operations **without
becoming player-visible or player-known**.

**A meaningful player-facing encounter as a discrete actor may establish a "met"
identity**, and **the GM must also have an explicit way to make a
Person/identity known without an encounter** — a public figure, a portrait,
extensive discussion, investigation or reputation.

**A textual mention in an Artifact does not by itself reveal a hidden canonical
Person association.**

**Scenario/context-specific presentation may allow the same Person to appear
differently** — mask, disguise, darkness, assumed role — **without leaking that
two appearances share the same canonical Person**. This is served by the
existing narrow Scenario presentation override of
[section 18.11](#1811-narrow-scenario-presentation-override-authorized-for-v1)
and authorizes no wider override mechanism.

The identity model this records is
[People/Artifact model §4](people-artifact-and-gm-authoring-model.md#4-person-representation-and-identity),
which carries the full text.

### 18.31 Player projection must hide preparation mechanics

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner.
**Extends:** [section 18.30](#1830-people-identities-and-metknown-state) to
every player-facing Scenario and knowledge surface. **Gates:** Nothing on its
own; it is the standard the privacy-relevant lanes are reviewed against.

> **Player-facing Scenario and knowledge material represents the fiction, not
> the GM's preparation model.**

**The player UI must not reveal, merely through structure**, whether:

- someone is backed by a full Character/NPC record;
- a People entry is canonical versus an identity/alias;
- the GM holds extensive hidden dossier or content;
- two unresolved identities privately map to one canonical Person;
- a presentation is canonical versus a Scenario override;
- hidden actors are mechanically present.

This is enforced on the standard already recorded for the GM dossier and the
session-summary source rule: **the excluded material is not present in what the
player surface receives**, rather than hidden after the fact —
[People/Artifact model §6.1](people-artifact-and-gm-authoring-model.md#61-the-gm-only-dossier),
[§11.2](people-artifact-and-gm-authoring-model.md#112-the-session-summary-source-rule--activity-is-the-only-source)
and
[Authority and Information Projection](../architecture/information-authority-and-projection.md#projection-rules).

**This supports the narrative-freedom requirement** that content management
serves the story: the model **must not normalize away ambiguity, mystery,
delayed recognition or multiple perspectives** for data-model convenience.

### 18.32 Runtime Discoveries from Skill rolls and play

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner.
**Extends:** [section 18.28](#1828-persistent-player-facing-knowledge-is-character-scoped).
**Gates:** Nothing beyond the lane that builds it.

**The GM cannot reasonably author a separate note for every Skill roll, or
pre-author the outcomes of live play. V1 must support lightweight runtime
recording of meaningful discoveries.**

A **Discovery** is player-facing information learned by one or more Characters
during play — a Perception result, an Insight or social observation, cultural or
historical recognition, or information learned during examination or
conversation.

**A Discovery is persistable into the recipient Character(s)' Knowledge
Libraries**, with lightweight typed context where available: Scenario or
Encounter, source Character, related Person/identity, Item, Artifact, and
Skill/task.

> **This is not authorization for a generalized atomic-fact ontology.** A
> Discovery may simply be **concise player-facing text plus recipient(s),
> provenance and optional typed links.** No fact decomposition, no
> knowledge-atom model and no fact-selection framework is authorized, which is
> the same refusal already recorded as a
> [Blackboard non-goal](campaign-blackboard-v1.md#24-v1-non-goals).

**The common Skill-resolution interaction must be low-friction.** The acting
Character is normally the default recipient, and the GM must be able to record a
meaningful result **inline** rather than opening a separate authoring workflow.

**Routine rolls need not create persistent Discoveries.**

**A Discovery is Character-private by default.** It is not Activity, not
Blackboard content and not recap input; it becomes any of those only through an
explicit act — [section 18.29](#1829-the-blackboard-is-shared-external-memory-not-knowledge-synchronization)
for the Blackboard,
[section 18.34](#1834-player-authored-notes-live-in-a-characters-knowledge-library)
for publication into shared history, and
[section 18.35](#1835-the-session-recap-privacy-boundary) for the recap.

### 18.33 GM Story Events

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner.
**Extends:** [section 9](#9-durable-history). **Gates:** the
[mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) for the lane that
persists a new player-safe Activity kind, on the basis already recorded in
[section 18.15](#1815-scenario-recognition-is-a-distinct-activity-event-kind).

**The GM needs a lightweight live-play action to record story events that were
not pre-authored** but matter to later narrative history — for example
`The chapel roof collapsed, separating the party.`

**It is recordable from live Scenario/Encounter context, with contextual links
derived automatically where possible**, rather than requiring clerical metadata
entry — [section 18.36](#1836-capture-in-context-retrieve-through-context).

**A Story Event intended as shared/public history becomes a player-safe Activity
entry**, projected under
[PPV1 §9](../architecture/player-play-v1.md#9-activity-visibility-and-projection-rules)
like any other. A Story Event the GM does not intend as shared history is not
Activity.

**Activity remains the authoritative source for AI session-summary
generation**, unchanged —
[People/Artifact model §11.2](people-artifact-and-gm-authoring-model.md#112-the-session-summary-source-rule--activity-is-the-only-source)
and [section 18.35](#1835-the-session-recap-privacy-boundary).

### 18.34 Player-authored notes live in a Character's Knowledge Library

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner.
**Settles, in part:**
[OPEN-PPL-7](people-artifact-and-gm-authoring-model.md#open-ppl-7--the-audience-granularity-of-sharedplayer-notes)
— per-Character private notes exist; whether a **shared** per-Person note body
also exists remains open there. **Gates:** Nothing for the private note itself.

**A player/Character may create freeform notes in their own Knowledge Library**,
optionally attached to a Person/identity, Item, Artifact, Discovery, Scenario or
Encounter, or another supported subject.

**These notes are not automatically** Activity or history; Blackboard content;
or input to a session recap.

**A player may deliberately share a note or its information to the Blackboard**,
under [section 18.29](#1829-the-blackboard-is-shared-external-memory-not-knowledge-synchronization).

**A player may also explicitly publish a snapshot of a note into shared session
history.** The UI may describe this as **`Add to session history`** and must
explain that the shared snapshot may be used by the later recap.

> **Publishing does not transform the original private note into a different
> object.** The original remains in that Character's Knowledge Library, and the
> published snapshot is a separate shared record.

**Knowledge Library notes are not Blackboard player notes.** Blackboard notes
are shared workspace content ([Campaign Blackboard V1 §16](campaign-blackboard-v1.md#16-player-notes));
these are Character-private knowledge. The two must not be collapsed.

### 18.35 The session recap privacy boundary

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner.
**Preserves:**
[People/Artifact model §11.2](people-artifact-and-gm-authoring-model.md#112-the-session-summary-source-rule--activity-is-the-only-source).
**Gates:** the [mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) for any
summary-drafting lane, unchanged and on privacy grounds.

The recap flow is preserved exactly:

> **player-safe Activity → AI draft → GM review/edit/approval → published
> recap.**

**Character-private Discoveries and private player notes are excluded** unless
explicitly published into an Activity or history surface appropriate to the
recap audience.

> **A public recap must not leak Character-private discoveries.**

> **The summary generator must not independently mine private Knowledge Library
> content, GM notes or private player notes.** **Activity remains the
> authoritative source.** Widening the generator's inputs to the Knowledge
> Library is prohibited, on the same "handed the player-safe projection and
> nothing else" standard as
> [People/Artifact model §11.2](people-artifact-and-gm-authoring-model.md#112-the-session-summary-source-rule--activity-is-the-only-source).

**This section does not settle where the approved recap lives.** The canonical
home of the published recap remains
[OPEN-PPL-11](people-artifact-and-gm-authoring-model.md#open-ppl-11--where-the-post-play-summary-lives),
**open and unchanged**; nothing here narrows or chooses among its options.

### 18.36 Capture in context; retrieve through context

**Status:** **SETTLED FOR V1 as a product principle, 2026-09-26.**
**Authority:** Product Owner. **Extends:**
[Product & Presentation Principles §4.3](product-presentation-principles.md#43-put-information-at-the-decision-or-outcome-it-serves).
**Gates:** Nothing; it is a requirement on the surfaces that capture and
retrieve knowledge.

> **Capture in context; retrieve through context.**

**The GM and players must not have to perform extensive metadata entry during
live play.** Where possible the application **derives** Scenario, Encounter,
acting Character, selected Person/identity, Item/Artifact, Skill/task and other
context **from the surface on which the capture occurs**.

**A Character's Knowledge Library must support later retrieval both through
broader browsing/search and through the subject itself.** Inspecting a Person
identity must make that Character's relevant Discoveries and Notes available
**without requiring the player to remember in which session or category they
were created**.

> **No detailed UI layout is prescribed. This records the semantic and
> interaction requirements only.**

### 18.37 Character-scoped knowledge and the shared Activity record

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner ruling
of 2026-09-26. It **supersedes the earlier record of this section, of the same
date, as an open product decision with no option chosen.** **Gates:**
**nothing.** A lane that persists or projects a recognition transition
**proceeds under the rule below**; it no longer stops and returns this decision.

Two settled rules meet here:

- **Activity is one shared player-safe narrative record** of what happened, and
  the exclusive source for a session recap —
  [section 9](#9-durable-history) and
  [People/Artifact model §11.2](people-artifact-and-gm-authoring-model.md#112-the-session-summary-source-rule--activity-is-the-only-source).
- **Recognition and knowledge are Character-scoped** —
  [section 18.28](#1828-persistent-player-facing-knowledge-is-character-scoped).

**A recognition transition that reaches only some Characters cannot be written as
shared party history without leaking**, which
[section 18.35](#1835-the-session-recap-privacy-boundary) forbids. That is the
tension this ruling resolves.

**What is ruled:**

> **`person_identity_revealed` is a shared Activity event only when the identity
> disclosure itself is shared with the complete intended participating
> audience.**

> **Recognition disclosed only to one Character, or to a subset of Characters, is
> recorded in those Characters' Knowledge Libraries and produces no shared
> Activity identity event.**

> **Shared Activity represents shared narrative knowledge. Character-private
> recognition must not leak into it, nor into the shared recap source** —
> [section 18.35](#1835-the-session-recap-privacy-boundary).

> **If recognition later becomes publicly disclosed to the full intended
> audience, that public transition may emit `person_identity_revealed`.**

**The escape valve is the GM's explicit Story Event.** If a private recognition
matters narratively, the GM may record a Story Event
([section 18.33](#1833-gm-story-events)), which becomes player-safe Activity and
recap input. That is the **only** route by which a subset disclosure enters
shared history, and it is a **deliberate GM act**, never an automatic
consequence of a disclosure.

> **Activity is not a generic visibility log.** Do not emit an Activity entry per
> recipient, per viewer, or per private disclosure.

**This is option 1 below, taken as the rule**, together with the
later-public-transition clause. **Nothing here authorizes implementation**; the
`person_identity_revealed` lane remains floor-class —
[section 18.15](#1815-scenario-recognition-is-a-distinct-activity-event-kind).

**The options that were considered, retained as provenance. Option 1 is the one
chosen; the other three are neither ranked nor rejected:**

1. **CHOSEN.** **`person_identity_revealed` is written only when the recognition
   is a shared disclosure** to all of the Scenario's participating player
   Characters, and a narrower disclosure produces no Activity entry.
2. **The event carries its recipient Characters** and Activity projection filters
   it per viewer, under
   [PPV1 §9](../architecture/player-play-v1.md#9-activity-visibility-and-projection-rules).
3. **The event records only the fiction-neutral fact** that someone learned
   something, with the identity content held in the recipient Characters'
   Knowledge Libraries.
4. **Recognition produces no Activity at all**, and narrative history carries
   only the GM's explicit Story Event
   ([section 18.33](#1833-gm-story-events)).

**The resolved speaker label a published announcement carries** is settled
separately and consistently, by the Product Owner ruling of 2026-09-26 recorded
at
[Campaign Material and Scenario Builder §8.2](campaign-material-and-scenario-builder-ui.md#82-speaker-identity-in-a-published-announcement):
a shared announcement resolves the most specific label player-safe for **every**
Character in the intended audience, rather than taking one Character's
recognition state as authoritative.

**This rule is applied to Map-Layer disclosure**, with no decision of its own, at
[Maps and spatial play §9.11](../architecture/maps-spatial-play.md#911-map-disclosure-and-the-shared-activity-record).

**Nothing in
[section 18.28](#1828-persistent-player-facing-knowledge-is-character-scoped)
through [section 18.36](#1836-capture-in-context-retrieve-through-context) is
gated on this section**, and nothing ever was — the Knowledge Library,
Discoveries, notes, the People identity model and the retrieval principle all
stand unchanged.

---

### 18.38 One intake session for many kinds of material

**Status:** **SETTLED FOR V1 as product direction, 2026-09-26.** **Authority:**
Product Owner. **Extends:** [section 2](#2-the-one-pipeline-already-exists) and
[section 11](#11-the-general-authoring-package). **Gates:** nothing, and **it
enables no new importable type** — [section 11.5](#115-importable-domain-types)
still governs that.

> **Glantri should support one coherent create/import session containing many
> domain types.**

The GM may receive one AI-produced package containing Person/NPC material;
portraits; Items; Item illustrations; Map base and overlay layers; letters and
documents; other Artifacts; Scenario associations; and provenance/context.

**The GM should be able to import the package once, review the entire proposed
batch, correct the exceptions, and accept the selected material.**

> **Do not require the GM to navigate to separate domain screens and run a
> separate upload workflow for every piece.**

**This is direction, not authorization.** The **enabled** importable set remains
**Artifact and Item**. A domain type becomes importable **only when its owning
implementation lane explicitly enables and validates it**, and nothing here
widens that set, expands a current slice or authorizes implementation.

The outer envelope should nevertheless remain **capable** of later carrying Person
representations, Items, Artifacts, Maps and layers, Scenario-related material and
other approved domains. **Capability is not enablement**, and **no Map intake work
is blocked on designing an ultimate universal package format** —
[section 18.41](#1841-map-intake--identity-layer-choice-and-eligibility) may
establish the first strong typed multi-entry package pattern.

### 18.39 Shared intake shell, typed domain editors

**Status:** **SETTLED FOR V1 as product direction, 2026-09-26.** **Authority:**
Product Owner. **Extends:** [section 2](#2-the-one-pipeline-already-exists).
**Gates:** nothing. **Introduces no new role vocabulary.**

Two shapes are prohibited:

| Prohibited                                                       | Why                                                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **One completely separate upload system per domain**             | It multiplies the single pipeline that [section 2](#2-the-one-pipeline-already-exists) says already exists. |
| **One lowest-common-denominator generic editor for all domains** | It loses the typed semantics each domain needs in order to validate.                                        |

> **Use one shared intake/staging shell with type-specific editors and controls
> inside it.**

Illustrative type-specific controls:

| Type         | Controls                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| **Map**      | target Map; layer role; order; player-safe or GM-only; optional opacity                               |
| **Person**   | target Person; general, identified or additional representation role; identity/presentation semantics |
| **Item**     | physical-Item semantics; representation role; Item-specific fields                                    |
| **Artifact** | native text or media; access; associations; provenance                                                |

The Person roles are the existing vocabulary of
[section 4.2](#42-the-v1-association-role-vocabulary-for-a-person); the Item roles
are [section 4.3](#43-the-v1-association-role-vocabulary-for-an-item) and
[section 18.25](#1825-item-representation-roles); the Map layer semantics are
[Maps / Spatial Play §8.1](../architecture/maps-spatial-play.md#81-layers-carry-visual-representations).

**Contextual entry points reuse the same machinery.**
[Section 2](#2-the-one-pipeline-already-exists) already records that there is one
import system with several contextual entry points; the 2026-09-26 ruling adds the
named examples and the hard principle:

- `Map -> Add layer` — target Map preselected;
- `Person -> Add portrait` — target Person and likely role preselected;
- `Scenario Builder -> Add material` — Scenario association preselected.

> **One engine, many context-prefilled entry points. Do not create independent
> ingestion implementations behind each button.**

The GM-facing entry point is
[Campaign Material and Scenario Builder §2.8](campaign-material-and-scenario-builder-ui.md#28-the-create-and-import-entry-point).

### 18.40 Batch intake is first-class

**Status:** **SETTLED FOR V1, 2026-09-26.** **Authority:** Product Owner.
**Extends:** [section 12](#12-bulk-intake-and-review). **Preserves:**
[section 12.1](#121-partial-acceptance-means-pre-commit-selection) exactly.
**Gates:** nothing.

> **The staging UI must be designed for dozens of files and material entries, not
> one file at a time.**

It must support multi-file upload; package upload; batch classification; bulk
defaults; **per-entry overrides**; bulk association where appropriate;
deselection; and **one explicit commit of the selected validated batch**.

Example batch defaults: Campaign; Scenario; default access; provenance and source
— the package-default inheritance of
[section 11.3](#113-package-defaults-and-automated-association).

> **The GM must be able to apply defaults to many entries and refine the
> exceptions individually.**

**The canonical pipeline is unchanged:**

> **stage -> validate -> preview/review -> explicit accept**

**External packages and AI-provided semantic context are proposals, not commands.**
The GM may edit the proposed type, target, role, associations, access, layer order
and other type-specific semantics **before** acceptance.

> **No AI or package import may silently reveal content, overwrite canonical
> identity, merge Persons, replace a Map, or attach to an ambiguous existing
> object.**

Each clause is already carried by an existing rule. It is gathered here only
because a batch UI is where such rules are most easily lost:

| Clause                             | Existing rule                                                                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| never silently reveal              | [section 11.6](#116-visibility-everything-begins-gm-private)                                                                                                                                                                                                               |
| never overwrite canonical identity | [Artifact Management §16.1](../architecture/artifact-management-package-import.md#161-name-equality-is-not-identity-equality) and [INV-IMP-02](../architecture/artifact-management-package-import.md#inv-imp-02--package-authority-is-weaker-than-target-domain-authority) |
| never merge                        | [Artifact Management §16.5](../architecture/artifact-management-package-import.md#165-generic-merge-prohibited)                                                                                                                                                            |
| never replace a Map                | [section 18.41](#1841-map-intake--identity-layer-choice-and-eligibility)                                                                                                                                                                                                   |
| never attach ambiguously           | **Never guess** — [section 11.3](#113-package-defaults-and-automated-association)                                                                                                                                                                                          |

**Partial acceptance is unchanged and is not reopened here.**
[Section 12.1](#121-partial-acceptance-means-pre-commit-selection) already settles
it: partial acceptance means **deselect before commit**, the selected set must
validate **as a whole**, and the selected entries commit **atomically**. **A
best-effort half-package remains prohibited.**

### 18.41 Map intake — identity, layer choice and eligibility

**Status:** **SETTLED FOR V1 as product direction, 2026-09-26.** **Authority:**
Product Owner. **Gates:** nothing, and **it does not enable a Map importer** —
[section 11.5](#115-importable-domain-types) and
[Artifact Management §13](../architecture/artifact-management-package-import.md#13-typed-object-registry) still govern that. The
Map domain model is [Maps / Spatial Play](../architecture/maps-spatial-play.md).

**A Map package may carry** a semantic manifest or context and one or more visual
files — conceptually `old-gatehouse.glantri-map.zip` holding a manifest, a base
image, optional overlay layers and optional GM-only layers.

The manifest **may propose** a stable external or source identity; a Map title;
layer names; layer roles; order; player-safe or GM-only status; and optional
provenance. **Exact serialization and schema remain an implementation concern**
except where already controlled by
[Artifact packages and library](../architecture/artifact-package-format.md).

#### New Map versus existing Map

**Names are not identity** — [section 11.2](#112-identity) and
[Artifact Management §16.1](../architecture/artifact-management-package-import.md#161-name-equality-is-not-identity-equality).

- Import may target an **existing** Map automatically **only** when the package
  carries an **exact trusted stable identifier** originating from Glantri or
  another explicitly trusted identity mechanism.
- Otherwise a package **may suggest** a possible match, and **the human chooses**
  `Create new` or selects an existing target.

> **Never fuzzy-match canonical identity from a title or a name alone.**

#### Adding versus replacing a layer

During staging the GM must **explicitly** choose whether an incoming image
**replaces the representation of an existing layer** or **creates a new layer**.

> **Do not infer this from filenames.**

The knowledge consequence is the hard rule of
[Maps / Spatial Play §8.2](../architecture/maps-spatial-play.md#82-replacement-versus-new-knowledge):
**replacement means the same knowledge; a new layer means new information.**

#### Player-safe is not disclosed

**Importing a player-safe layer discloses it to no Character**, and GM-only layers
remain **ineligible** for Character disclosure until the GM explicitly
reclassifies them —
[Maps / Spatial Play §9.8](../architecture/maps-spatial-play.md#98-player-safe-eligibility-is-not-disclosure).
This is the Map form of
[section 11.6](#116-visibility-everything-begins-gm-private).

#### Intake packages do not define live state

Ordinary Map and content packages must **not** encode current Character positions;
NPC positions; Item placements; or current Encounter state.

> **Those are live contextual state, not reusable content** —
> [Maps / Spatial Play §7.6](../architecture/maps-spatial-play.md#76-placement-state-is-normally-transient).

A later, richer Scenario package **may** propose such preparation. **Ordinary Map
intake remains reusable content intake**, and a package that carries placements
does not thereby establish them, nor grant any Character knowledge
([Maps / Spatial Play §9.7](../architecture/maps-spatial-play.md#97-how-a-character-acquires-map-knowledge)).

#### Provenance is preserved and mostly derived

Lightweight provenance — uploaded or imported by; import batch and source;
original filename; package or source ID; creator/author where supplied; revision
history — is already specified by [section 6](#6-provenance) and
[Artifact Management §18](../architecture/artifact-management-package-import.md#18-provenance-and-import-record). **Most
operational metadata is derived by Glantri rather than demanded from the external
tool** ([section 18.42](#1842-external-tools-supply-semantics-glantri-derives-technical-metadata)).

### 18.42 External tools supply semantics; Glantri derives technical metadata

**Status:** **CONFIRMED AND EXTENDED, 2026-09-26.** **Authority:** Product Owner.
**Already recorded at:**
[AI-assisted intake, The division of labour](ai-assisted-artifact-intake.md#the-division-of-labour).
**Gates:** nothing.

> **External tools describe meaning; Glantri derives technical file metadata
> itself.**

An AI conversation or external tool must **not be required** to supply SHA-256
digests; dimensions; MIME metadata; internal database IDs; generated timestamps;
or any other technical metadata Glantri can compute from the files. **Where
Glantri needs a hash or checksum internally, Glantri computes it during
staging.**

This is existing recorded behaviour: the intake format "has no place to supply
one, and the schema rejects any attempt to add one", and the preview shows the
derived media type, byte size, SHA-256 and storage identity **as confirmation that
the GM never had to supply any of it**
([AI-assisted intake, What the preview shows](ai-assisted-artifact-intake.md#what-the-preview-shows)). The
2026-09-26 ruling **extends it to Maps and to multi-type packages**
([section 18.38](#1838-one-intake-session-for-many-kinds-of-material)), and
**supersedes any workflow that requires a human or an ordinary AI conversation to
substitute checksums by hand before import.**

#### The boundary this ruling does not cross

> **This is a requirement on the human and ordinary-AI-conversation workflow. It
> is NOT a licence to weaken the machine package format's digest validation.**

**Every digest check in [Artifact packages and library](../architecture/artifact-package-format.md) and
[Artifact Management §15.1](../architecture/artifact-management-package-import.md#151-parse-and-integrity-validation) remains in
force and continues to fail closed.** A machine-authored package that declares a
`sha256` per resource **is held to it**, and an incorrect digest fails the import.
That is a **security control on a floor-class surface** — the
[mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) — and it is unchanged.

The two coexist exactly as
[AI-assisted intake, The advanced entry point](ai-assisted-artifact-intake.md#the-advanced-entry-point)
already records: the authored-package route **remains available for package-shaped
work** and is **not a prerequisite** for ordinary intake.

> **A lane that finds itself about to remove or soften a fail-closed digest check
> in the name of this ruling has misread it, and stops.**

### 18.43 The ordinary AI conversation workflow

**Status:** **RECORDED AS AN EXPLICIT USABILITY OBJECTIVE, 2026-09-26.**
**Authority:** Product Owner. **Already recorded in substance at:**
[AI-assisted Artifact and Item intake](ai-assisted-artifact-intake.md). **Gates:** nothing.

> **A user should be able to use an ordinary AI conversation to create images, a
> semantic manifest or context, and optionally one package or archive, then upload
> that result directly into Glantri's intake workbench.**

The workflow must **not require** a Codex or Builder thread; repository access;
manual checksum calculation; knowledge of Glantri database IDs; or manual package
surgery. **Glantri stages, validates, derives metadata and asks for explicit human
acceptance.**

This restates the standing #271 objective — "no developer tooling, no checksums,
no manifests and no repository access" — as a **product usability objective every
intake surface is measured against**, including the Map and multi-type direction of
[section 18.38](#1838-one-intake-session-for-many-kinds-of-material).

### 18.44 Content-production capability is actor-neutral

**Status:** **SETTLED FOR V1 as an architectural constraint, 2026-09-26.**
**Authority:** Product Owner. **Extends:**
[Artifact Management §21.5](../architecture/artifact-management-package-import.md#215-ai-and-player-authoring). **Gates:**
nothing, and **it exposes no player-facing authoring tool.**

> **Content-production operations must not be architected as intrinsically
> GM-only.**

Campaign Material remains the **primary GM workbench**
([Campaign Material and Scenario Builder §2](campaign-material-and-scenario-builder-ui.md#2-campaign-material--role)),
but the underlying **create, import, stage and validate** operations should be
**reusable and permission-driven**.

Foreseeable future player use cases include henchmen; properties; portraits;
player-created Maps; Items; and other player-authored material. **V1 need not
expose any of them.**

> **Hard principle: same canonical create/import machinery; different authority
> and ownership scopes.**

> **The architecture must not require duplicating the content engine later merely
> because the first UI was built for a GM.**

**What this does not change.**
[Artifact Management PO-3](../architecture/artifact-management-package-import.md#po-3--player-artifact-creationsubmission) and
[§9.3](../architecture/artifact-management-package-import.md#93-player-authority-in-v1) still govern player authority in V1, and
[Maps / Spatial Play M3](../architecture/maps-spatial-play.md#m3--player-authored-markers) remains **deferred**.
This section constrains **how the engine is built**, not **who may use it
today**.

### 18.45 Maps and intake under narrative freedom

**Status:** **CROSS-REFERENCE ONLY, 2026-09-26.** **Authority:** Product Owner.
**Amends:** nothing. **Authorizes:** nothing.

The controlling principle is
[section 18.27](#1827-narrative-freedom--content-management-serves-the-story) —
**content management serves the story; it does not prescribe the story** — and it
is **not restated here**.

Applied to Maps and intake, it means Map and content tooling must make material
visually engaging, memorable, reusable and easy to navigate **without forcing** a
linear chronology, one sequence of revelation, **one shared player perspective**,
one interpretation, or automatic normalization of mystery and ambiguity.

> **Maps and intake must preserve Character-specific knowledge and player-safe
> projection rather than flattening material into one universally visible truth**
> — [section 18.28](#1828-persistent-player-facing-knowledge-is-character-scoped)
> and
> [Maps / Spatial Play §9.6](../architecture/maps-spatial-play.md#96-map-knowledge-is-character-scoped).

**This reopens no settled mechanic.** The boundary already recorded at
[section 18.27](#1827-narrative-freedom--content-management-serves-the-story) —
what that principle is **not** licence for — governs unchanged.

---

## 19. Future target: Content Production Interface

**Status:** **Approved as future target architecture.**
**This is future scope. It does NOT expand slices A to D, and it is NOT
authorized for implementation.** No lane may absorb it and no slice may treat it
as a dependency.

### 19.1 The Production Brief/Kit

A **versioned, machine-readable Production Brief/Kit** supplied to local or
external AI production agents, containing as appropriate:

- the canonical Profession catalogue and its stable IDs;
- Civilization, Society and other context catalogues;
- relevant Skill, Learning Group and rule metadata;
- the existing reusable NPC, Artifact and Encounter-template inventory;
- coverage and readiness gaps;
- Authoring Package schemas and examples;
- approved terminology;
- visual and art-direction guidance;
- canonical content version and digest provenance.

The producer returns **the same validated Authoring Package** used by normal
AI-assisted authoring — not a privileged format.

> **It must not require privileged direct database access.** The Production
> Brief is data out; the Authoring Package is data in; the ordinary
> staging/preview/explicit-accept pipeline is the only way material becomes
> canonical.

### 19.2 Visual guidance must be layered

Visual guidance must **distinguish three layers** and must keep them
distinguishable to the producer:

1. **canonical setting facts**;
2. **approved visual/art-direction conventions**;
3. **optional inspiration/reference material**.

> **Generated artistic convention must not silently become game-world canon.**

### 19.3 Future production use cases

Recorded, not authorized:

- a generic/fallback visual library;
- **representative Profession NPCs at multiple ages and experience levels**;
- a reusable authored Encounter Template library;
- coverage-driven production queues and batches.

### 19.4 Reusable Profession NPC representatives depend on an existing open decision

_The heading is retained so existing references continue to resolve. The
decision it named — OPEN-PPL-4 — is now settled; other decisions in this section
remain open._

The use case is recorded above. It **is not authorized here**.

> **The governing decision,
> [OPEN-PPL-4 — What a persistent NPC record is](people-artifact-and-gm-authoring-model.md#open-ppl-4--what-a-persistent-npc-record-is),
> is SETTLED as of 2026-09-23 and no longer blocks this use case.**
> A pre-authored, reusable Profession NPC representative is exactly a persistent
> NPC record, and the Product Owner has ruled that a persistent NPC **is a
> `Character` with no player owner**, GM-controlled under the applicable
> GM/Campaign authority. `ReusableEntity` is reusable source/archetype material
> and is **not** the canonical persistent identity of a person. See
> [section 18.8](#188-open-ppl-4-resolved).

**What is still required before any reusable Profession NPC library is
produced:** production of such a library is future scope that is not authorized
by this contract, and the **Template half** of the use case, plus any
materialization step from reusable content into persistent Characters, still
depends on the decisions below.

Adjacent and still unresolved, for the Template half of the same use case:
[OPEN-PPL-2 — Whether Actor is a new domain entity](people-artifact-and-gm-authoring-model.md#open-ppl-2--whether-actor-is-a-new-domain-entity),
which names _Template_ as a product concept without deciding whether it is a
domain entity, and
[OPEN-PPL-5 — What Actor-to-persistent-NPC promotion preserves](people-artifact-and-gm-authoring-model.md#open-ppl-5--what-actor-to-persistent-npc-promotion-preserves),
which remains the concern for later materialization/promotion from reusable
content to a persistent `Character`. Both stand exactly as they did; neither is
narrowed here.

> **Neither blocks slice A.** Slice A is the canonical Artifact Association
> layer in [section 4.1](#41-the-canonical-artifact-association-layer), which
> concerns associations between existing typed targets and Artifacts and does
> not depend on what a persistent NPC record is.

---

## 20. Relationship to existing contracts

This contract is controlling for the model it describes. The documents below
retain their own authority for everything else and point here for this model.

| Document                                                                                      | Relationship                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Artifact Management & Package Import](../architecture/artifact-management-package-import.md) | Artifact domain, identity, revisions, validation and atomicity remain authoritative. PO-6 is superseded by [section 11.5](#115-importable-domain-types).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [Artifact packages and library (AM1)](../architecture/artifact-package-format.md)             | AM1 surface description; importable-type scope governed here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [AI-assisted Artifact and Item intake](ai-assisted-artifact-intake.md)                        | The #271 intake contract; it is an entry point into the one pipeline, not a separate route.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [Scenario Play Workspace](../architecture/scenario-play-workspace.md)                         | Play authority remains #268's. §4.4 amended narrowly by [section 10](#10-encounter-and-artifact-ownership-versus-durable-association).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [People, Artifact and GM authoring model](people-artifact-and-gm-authoring-model.md)          | Records the #284 rulings, and is **controlling for the Person identity and met/known model** that [section 18.30](#1830-people-identities-and-metknown-state) records. OPEN-PPL-6 resolved by [section 18.6](#186-open-ppl-6-resolved) and OPEN-PPL-4 by [section 18.8](#188-open-ppl-4-resolved); OPEN-PPL-9 answered **for V1** by [section 18.9](#189-open-ppl-9-answered-for-v1) with future scoping deferred; OPEN-PPL-10 **still open but deferred and non-blocking** per [section 18.10](#1810-open-ppl-10-deferred-and-non-blocking). OPEN-PPL-1 is re-settled **for V1 as Character-scoped** by [section 18.28](#1828-persistent-player-facing-knowledge-is-character-scoped), superseding [section 18.23](#1823-open-ppl-1-settled-for-v1--superseded-by-character-scoped-recognition); OPEN-PPL-7 is settled **in part** by [section 18.34](#1834-player-authored-notes-live-in-a-characters-knowledge-library); OPEN-PPL-11 is **untouched and open** per [section 18.35](#1835-the-session-recap-privacy-boundary). The remaining decisions are unchanged. |
| [Campaign Management V2](../architecture/campaign-management-v2.md)                           | Campaign UX contract; the Campaign Material surface in [section 7](#7-central-campaign-material-surface) extends its §6.2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [Player Play V1](../architecture/player-play-v1.md)                                           | Player play authority remains PPV1's. This contract is GM authoring.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [Live GM Scenario Play](live-gm-scenario-play.md)                                             | The GM's live operating surface. It operates over this model, carries the live capture surfaces of [section 18.32](#1832-runtime-discoveries-from-skill-rolls-and-play) and [section 18.33](#1833-gm-story-events), and produces the Activity kinds settled in [section 18.15](#1815-scenario-recognition-is-a-distinct-activity-event-kind) and [section 18.16](#1816-prepared-message-speaker-history-is-text-identity-in-v1); the Encounter rules it enforces are [section 18.18](#1818-one-active-encounter-per-character) and [section 18.19](#1819-live-improvisation-may-establish-the-scenario-membership-it-implies).                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [Campaign, Scenario and Encounter Workflows](campaign-scenario-encounter-workflows.md)        | Workspace responsibilities; authoring model governed here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [Secure Campaign Artifact storage boundary](../decisions/architecture/artifact-storage.md)    | Storage and privacy boundary remains authoritative and is unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [Functional ownership](../architecture/ownership.md)                                          | Coordination boundaries; Artifact authoring crosses the Campaign area.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [Testing and refactor safety](../testing-regression-matrix.md)                                | Regression breadth for this pipeline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
