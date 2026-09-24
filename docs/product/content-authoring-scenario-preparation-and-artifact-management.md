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
scoping ([section 18.9](#189-open-ppl-9-answered-for-v1)) and **defer
OPEN-PPL-10 without deciding it** ([section 18.10](#1810-open-ppl-10-deferred-and-non-blocking)).

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
  2026-09-23), and records the two Product Owner rulings of **2026-09-24**:
  **OPEN-PPL-9 answered for V1** with future scoping deferred
  ([section 18.9](#189-open-ppl-9-answered-for-v1)), and **OPEN-PPL-10 deferred
  while remaining open** ([section 18.10](#1810-open-ppl-10-deferred-and-non-blocking)).
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
   a scope that does not yet exist.
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

| Type                                        | Status                                              |
| ------------------------------------------- | --------------------------------------------------- |
| Artifact                                    | **Enabled** (AM1)                                   |
| Item                                        | **Enabled** (#271)                                  |
| Scenario GM Plan update                     | Not enabled — requires its owning lane to enable it |
| Encounter / planning note                   | Not enabled — requires its owning lane to enable it |
| Map, Story, Character/NPC, any other domain | Not enabled — explicit opt-in only                  |

The typed registry in
[Artifact Management §13](../architecture/artifact-management-package-import.md#13-typed-object-registry)
continues to govern what an owning domain must define before its type is
enabled: what may be imported, required validation, legal references, legal
creation and update semantics, conflict handling, permissions and lifecycle
consequences.

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

| Item                                             | Status                                                                                                                                                                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reusable Encounter templates                     | **Later scope.** Recorded, not authorized.                                                                                                                                                                                                                                       |
| Random-Encounter mechanics                       | **Not in scope.**                                                                                                                                                                                                                                                                |
| Content Production Interface                     | **Future target architecture only.** See [section 19](#19-future-target-content-production-interface).                                                                                                                                                                           |
| Storage of the Scenario GM Plan                  | **Settled**, 2026-09-23. See [section 8.1](#81-the-scenario-gm-plan) and [section 18.7](#187-scenario-gm-plan-storage).                                                                                                                                                          |
| Anything gated on #279                           | Blocked; see [section 11.6](#116-visibility-everything-begins-gm-private).                                                                                                                                                                                                       |
| V1 representation selection                      | **Settled for V1**, 2026-09-24: two global singleton roles plus additional illustrations, visibility independent. See [section 4.2](#42-the-v1-association-role-vocabulary-for-a-person) and [section 18.9](#189-open-ppl-9-answered-for-v1).                                    |
| Context-specific representation overrides        | **Deferred, not rejected.** Per Campaign / entitlement tier / Scenario / play context. Not built in V1; returns to the Product Owner. See [section 18.9](#189-open-ppl-9-answered-for-v1).                                                                                       |
| Player self-service Artifact creation/management | **Future scope, and non-blocking for this contract.** [OPEN-PPL-10](people-artifact-and-gm-authoring-model.md#open-ppl-10--the-authority-model-for-player-self-service-artifacts) stays **open and deferred**; see [section 18.10](#1810-open-ppl-10-deferred-and-non-blocking). |

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

| Document                                                                                      | Relationship                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Artifact Management & Package Import](../architecture/artifact-management-package-import.md) | Artifact domain, identity, revisions, validation and atomicity remain authoritative. PO-6 is superseded by [section 11.5](#115-importable-domain-types).                                                                                                                                                                                                                                                                      |
| [Artifact packages and library (AM1)](../architecture/artifact-package-format.md)             | AM1 surface description; importable-type scope governed here.                                                                                                                                                                                                                                                                                                                                                                 |
| [AI-assisted Artifact and Item intake](ai-assisted-artifact-intake.md)                        | The #271 intake contract; it is an entry point into the one pipeline, not a separate route.                                                                                                                                                                                                                                                                                                                                   |
| [Scenario Play Workspace](../architecture/scenario-play-workspace.md)                         | Play authority remains #268's. §4.4 amended narrowly by [section 10](#10-encounter-and-artifact-ownership-versus-durable-association).                                                                                                                                                                                                                                                                                        |
| [People, Artifact and GM authoring model](people-artifact-and-gm-authoring-model.md)          | Records the #284 rulings. OPEN-PPL-6 resolved by [section 18.6](#186-open-ppl-6-resolved) and OPEN-PPL-4 by [section 18.8](#188-open-ppl-4-resolved); OPEN-PPL-9 answered **for V1** by [section 18.9](#189-open-ppl-9-answered-for-v1) with future scoping deferred; OPEN-PPL-10 **still open but deferred and non-blocking** per [section 18.10](#1810-open-ppl-10-deferred-and-non-blocking). The other seven remain open. |
| [Campaign Management V2](../architecture/campaign-management-v2.md)                           | Campaign UX contract; the Campaign Material surface in [section 7](#7-central-campaign-material-surface) extends its §6.2.                                                                                                                                                                                                                                                                                                    |
| [Player Play V1](../architecture/player-play-v1.md)                                           | Player play authority remains PPV1's. This contract is GM authoring.                                                                                                                                                                                                                                                                                                                                                          |
| [Campaign, Scenario and Encounter Workflows](campaign-scenario-encounter-workflows.md)        | Workspace responsibilities; authoring model governed here.                                                                                                                                                                                                                                                                                                                                                                    |
| [Secure Campaign Artifact storage boundary](../decisions/architecture/artifact-storage.md)    | Storage and privacy boundary remains authoritative and is unchanged.                                                                                                                                                                                                                                                                                                                                                          |
| [Functional ownership](../architecture/ownership.md)                                          | Coordination boundaries; Artifact authoring crosses the Campaign area.                                                                                                                                                                                                                                                                                                                                                        |
| [Testing and refactor safety](../testing-regression-matrix.md)                                | Regression breadth for this pipeline.                                                                                                                                                                                                                                                                                                                                                                                         |
