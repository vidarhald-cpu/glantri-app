# People, Artifacts and GM authoring — cross-cutting product model

## 1. Status and scope

> **Controlling contract for content authoring, Artifact management and Scenario
> preparation:**
> [Content authoring, Scenario preparation and Artifact management](content-authoring-scenario-preparation-and-artifact-management.md).
> It records the Product Owner's 2026-09-23 rulings — C1, C2, C3, the
> partial-acceptance clarification, the canonical Artifact Association
> requirement, and the resolution of
> [OPEN-PPL-6](#open-ppl-6--where-generic-versus-specific-is-recorded) — and
> governs where this note and it describe the same model. It also records the
> Product Owner's 2026-09-24 rulings: the **V1 representation selection** answer
> to [OPEN-PPL-9](#open-ppl-9--the-scope-of-a-selected-primary-representation)
> and the **deferral** of
> [OPEN-PPL-10](#open-ppl-10--the-authority-model-for-player-self-service-artifacts).
> This note remains authoritative for the #284 record and for the
> `OPEN-PPL-*` decisions, of which **seven remain genuinely open** — see
> [section 15](#15-open-decisions--none-chosen) for the exact state of each.

**Portfolio areas:** #112 Campaign / Persistent Play, #114 Chargen, #119
Artifact Management, #120/#227 Campaign Management, #122 AI Integration /
Player-Created Content\
**Artifact type:** durable conceptual product preparation for work that is not
immediately next, in the sense of
[capability sizing and preparation](../process/development-operating-model.md#capability-sizing-and-preparation)\
**Architecture state:** Product Owner decisions recorded; **no implementation is
authorized or dispatched**\
**Date recorded:** 2026-09-22\
**Recorded against:** `dev@c2c0f2a96f86d12686a325d173ef57d12704d781`\
**Source of authority:**
[#284 Cross-cutting People / Artifact / GM-authoring product model](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/284),
sections 1 to 11, plus the Product Owner ruling of 2026-09-22 on the same issue
recorded in
[section 11.2](#112-the-session-summary-source-rule--activity-is-the-only-source)

This note records one connected set of settled Product Owner decisions spanning
Player Play, NPC authoring, Artifact use, AI authoring and GM Campaign material,
and returns a proposed product-lane map in [section 16](#16-proposed-product-lane-map).

### 1.1 Why this note lives in `docs/product/`

The location was determined from process guidance rather than assumed. The
guidance that chose it, in order:

1. **[`docs/process/control-plane.md` §Sources of truth](../process/control-plane.md#sources-of-truth)**
   maps _product and presentation quality_ to `docs/product/` plus area and task
   contracts, and maps _approved rule and architecture rulings_ to
   `docs/decisions/`. #284 settles what the product should be. It settles no
   rule and no interface.
2. **[`docs/decisions/README.md` §When a record is required](../decisions/README.md#when-a-record-is-required)**
   requires an architecture decision record only when a **change** establishes a
   durable cross-area boundary, shared contract, persistence strategy or
   hard-to-reverse constraint. #284 deliberately chooses no mechanism, names no
   table and establishes no boundary; every mechanism question it raises is
   carried as an open decision in [section 15](#15-open-decisions--none-chosen).
   `docs/decisions/` is therefore excluded.
3. **[`docs/process/development-operating-model.md` §Capability sizing and preparation](../process/development-operating-model.md#capability-sizing-and-preparation)**
   describes exactly this artifact type: for work that is not immediately next,
   keep preparation _durable and conceptual_ — objectives, workflows, concepts,
   permissions, invariants, exclusions and Product Owner decisions — and leave
   SHA-specific designs and exact-path contracts to a preflight near activation.
   That is what #284 asked for and what this note is.
4. **[`docs/process/control-plane.md` §Documentation loading and maintenance](../process/control-plane.md#documentation-loading-and-maintenance)**
   and
   **[`docs/process/development-baseline.md` §Standing documentation economy](../process/development-baseline.md#standing-documentation-economy)**
   both require task- and area-specific detail to stay scoped in the document
   that owns it, and require duplication to be pruned rather than copied across
   doc trees.
   [`docs/process/task-contract.md` §Rule/reference documentation applicability](../process/task-contract.md#rulereference-documentation-applicability)
   states the same rule directly: _link these sources instead of copying the same
   decision, rule, or provenance across doc trees_. A cross-cutting note that
   restated five area contracts would violate all three.
5. `docs/architecture/` was **not** chosen merely because other contracts live
   there. Every current document in that tree — including
   [Scenario Play Workspace](../architecture/scenario-play-workspace.md) and
   [Player Play V1](../architecture/player-play-v1.md) — is an _area contract
   written against a specific surface_, carrying implementation slices,
   hotspots and verification expectations for that surface. This note spans five
   prospective lanes, authorizes no slice, and owns no surface. Placing it there
   would create a sixth area contract that duplicates the five it must instead
   link to.
6. The established precedent for this artifact type is already in
   `docs/product/`, listed under _Portfolio guidance_ in
   [`docs/decisions/README.md` §Recovered current decisions](../decisions/README.md#recovered-current-decisions):
   [strategic future register](2026-09-03-strategic-future-register.md),
   [campaign play lifecycle roadmap](campaign-play-lifecycle-roadmap.md),
   [skills product roadmap](skills-product-roadmap.md) and
   [canonical Field Equipment V1 roadmap](canonical-field-equipment-v1-roadmap.md).

### 1.2 What this note does not do

- It **authorizes no implementation**, Builder dispatch, branch, schema change
  or migration, and it creates no lane issue.
- It **introduces no new domain primitive by prose.** "Actor" and "Template" are
  named by the Product Owner; this note records what was said about them and
  flags what is unsettled. It specifies no schema, table or field.
- It **decides nothing #284 left open.** Where a section implies a choice the
  Product Owner did not make, that choice is recorded in
  [section 15](#15-open-decisions--none-chosen) with options stated neutrally and
  **none chosen**.
- It **does not reopen, narrow or supersede** anything settled by
  [#268](../architecture/scenario-play-workspace.md#12-product-owner-decisions--all-settled)
  or
  [Player Play V1](../architecture/player-play-v1.md#18-open-decisions-and-recorded-mismatches).
  Both contracts' decisions are unchanged by this note.
  [Section 14](#14-what-is-already-settled-elsewhere) is the cross-reference
  index.

---

## 2. People model

Recording #284 §1.

- **A persistent PC and a persistent NPC use the same full Character and rules
  model.** Player and GM **control semantics** differ; the model does not.
- **Template** is a **reusable archetype**, not an individual person.
- **Actor** is the **runtime/play instance**. An Actor may originate from a
  Character/NPC **or** from a Template.
- The application needs **manual GM creation of full NPCs**, and a separate path
  for **lightweight/generic Actors**.
- **Actor to persistent NPC promotion may be a later capability.** It is not
  required now.
- The current **V1 rule remains one active Campaign per Character**.

> **Which record carries a persistent NPC is settled as of 2026-09-23.** A
> persistent NPC is a `Character` with **no player owner**, GM-controlled under
> the applicable GM/Campaign authority. `CampaignRosterEntry` provides Campaign
> membership and `Character` itself remains independent of Campaign;
> `ReusableEntity` is reusable source/archetype material, not the canonical
> persistent identity of a person. Such a Character has a **designated managing
> GM** whose permanent-Character lifecycle authority is independent of Campaign
> roster membership. See
> [OPEN-PPL-4](#open-ppl-4--what-a-persistent-npc-record-is).

> **Terminology hazard, recorded rather than resolved.** The word _Actor_
> already has a second meaning in this repository:
> [Character lifecycle authority](../architecture/character-lifecycle-authority.md#actor-and-privacy-matrix)
> uses "actor" for the **acting user** in an authorization matrix, while
> `CampaignActorClass` in `apps/web/src/lib/campaigns/campaignActors.ts` uses it
> for the play instance #284 means. Any lane that makes _Actor_ a durable
> identifier must resolve the collision deliberately; this note does not choose
> a resolution.

Presence of a person in play is governed by
[#268 §5 presence versus visibility](../architecture/scenario-play-workspace.md#5-presence-versus-visibility),
which is unchanged here. People rails and rosters remain **projections, never
authorities**, exactly as
[Player Play V1 §8.1](../architecture/player-play-v1.md#81-left-selectors)
records.

---

## 3. AI parity principle

Recording #284 §2. **This is a constraint on every later capability in this
note, not a nice-to-have.**

> **Anything AI can canonically create or change through import must also be
> possible through ordinary in-app authoring tools.**

- AI **may batch and automate** those operations.
- AI **must not have privileged canonical semantics unavailable to humans.**

Consequences that follow directly:

1. A capability may not be delivered AI-first. If a lane gives AI intake the
   power to write a canonical field, the ordinary in-app path to that field is
   part of the same capability, not a follow-up.
2. The principle is **already load-bearing and already has one open gap.**
   #271 gave canonical Items a GM-private `gmNotes` field that AI intake writes,
   and
   [#277](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/277) exists
   precisely because **no GM authoring surface for that field was built**. #277
   is the parity repair for #271, and this note records it as the worked example
   of the principle rather than as a new requirement.
3. The principle is consistent with, and does not weaken,
   [Artifact Management §21.5](../architecture/artifact-management-package-import.md#215-ai-and-player-authoring):
   _AI is an author/source, not a privileged integration._ Parity constrains
   what AI may do **exclusively**; §21.5 constrains the **authority** by which it
   does it. Both apply.
4. Parity is a **completeness** obligation, not an authorization. It never
   grants AI a capability humans lack, and it never grants a human path
   authority the GM review boundary withholds.

---

## 4. Person representation and identity

Recording #284 §3.

- **Presence or visibility of a person does not imply that their identity is
  known.** This is a third axis alongside the two
  [#268 §5](../architecture/scenario-play-workspace.md#5-presence-versus-visibility)
  already settles; it neither narrows nor contradicts them.
- Player-facing presentation **may begin as a generic appearance** — for example
  _"middle-aged wealthy man"_ with a generic pencil/sketch image.
- **Later identity revelation** may expose the canonical name, a specific
  portrait and a more detailed known description **without replacing the
  underlying Actor/person**.
- **Prior notes and history are preserved through identification.** Identifying
  a person is not a new person.
- Both a **generic appearance image** and a **specific portrait** are supported.
  A person **may have several Artifacts and one selected primary
  representation**. The 2026-09-24 ruling below makes this precise for V1: it is
  **two distinct singleton selected roles** — one primary portrait and one
  general appearance — plus an open set of additional illustrations, not a
  single "primary" slot.

Identity revelation is a **GM visibility operation**, so it belongs to the
**Reveal** vocabulary settled by
[#268 §4.5](../architecture/scenario-play-workspace.md#45-reveal-and-share-are-two-different-operations)
and must not be named with Blackboard vocabulary (`share`, `place`,
`placement`), nor may `reveal` be reused for those. That prohibition is #268's
and is restated here only as the pointer that governs naming in this area.

**How identity reveal is modelled is not settled.** See
[OPEN-PPL-1](#open-ppl-1--how-identity-revelation-is-modelled).

---

## 5. Person Inspector

Recording #284 §4.

> **This is a specialization of an Inspector that already exists.**
> [Player Play V1 §8.2](../architecture/player-play-v1.md#82-inspector) already
> specifies the Inspector: it dominates the upper Situation screen, is much
> wider than the selector rails, is **a generic visual/detail area and not a new
> domain model**, makes visual content substantial, and offers _Open full view_
> where a canonical full view exists. None of that is re-decided here, and this
> note adds no second Inspector.

The Person Inspector shows **all information the current viewer is entitled to
know**. What #284 adds, on top of PPV1 §8.2, is the **people-specific content
set and its authorization tiers**:

| Element                                                                                           | Status                                                                                                           |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Inspector exists, is generic, dominates layout                                                    | **Already settled** by [PPV1 §8.2](../architecture/player-play-v1.md#82-inspector). Not re-decided.              |
| Click-through to a canonical full view                                                            | **Already settled** by [PPV1 §13](../architecture/player-play-v1.md#13-canonical-detail-and-click-through-rule). |
| NPC selection shows portrait plus visible info                                                    | **Already settled** by [PPV1 §8.2](../architecture/player-play-v1.md#82-inspector).                              |
| **Generic appearance image and a specific portrait, side by side in the same person's Inspector** | **New in #284.**                                                                                                 |
| **A general description and a separate detailed/known description**                               | **New in #284.**                                                                                                 |
| **Shared/player game notes presented in the Inspector**                                           | **New in #284.**                                                                                                 |
| **Expandable/full presentation for images, long notes and descriptions**                          | **New in #284**, and routed to the existing full-viewport inspection pattern rather than reimplemented.          |
| **Explicit authorization tiers for canonical click-through**                                      | **New in #284**, refining PPV1 §13's general rule for people.                                                    |

The authorization tiers #284 settles:

| Viewer                        | May reach the canonical full Character                  |
| ----------------------------- | ------------------------------------------------------- |
| The **owning player** of a PC | Yes, for that PC                                        |
| The **GM**                    | Yes, for a PC and for an NPC                            |
| **Any other player**          | **No** — remains on the revealed Inspector presentation |

Canonical click-through is therefore **conditional on authorization**, and the
Inspector presentation is the floor everyone else stays on. Where the tiers here
and PPV1 §13's general routing rule meet, PPV1 §13 still decides _where_ the
click-through goes; #284 decides _who_ may take it.

Expandable presentation uses the full-viewport inspection pattern established by
[Campaign Management V2 §8](../architecture/campaign-management-v2.md#8-artifact-and-image-inspection),
which PPV1 §8.2 already names as the canonical destination. It is not
reimplemented inside the Inspector.

**Which representation is primary, and at what scope, is settled for V1.** A
persistent Person may have **at most one selected primary portrait**, **at most
one selected general appearance**, and **zero or more additional
illustrations**; those selections are **global to that Person**, and Artifact
visibility remains independent of them. Context-specific overrides — per
Campaign, per entitlement tier, per Scenario or per play context — are
**deferred, not rejected**. See
[OPEN-PPL-9](#open-ppl-9--the-scope-of-a-selected-primary-representation).

---

## 6. Notes: the GM dossier and shared player notes

Recording #284 §5.

### 6.1 The GM-only dossier

- Every Campaign PC and NPC supports a **long-form, Campaign-scoped, GM-only
  dossier/history**.
- It may contain hidden origins, secrets, motives, future hooks and extensive
  campaign notes.
- It **must be structurally excluded from all player projections, search and
  context**.

> ### This is a hard privacy constraint, not a UI preference
>
> "Structurally excluded" means the GM-private text **must not be reachable by a
> non-GM in any payload**, not merely absent from a rendered view.
>
> Three existing rules already say so, and this note relies on them rather than
> inventing a new standard:
>
> - [Product & Presentation Principles §4.5](product-presentation-principles.md#45-respect-perspective-knowledge-ownership-privacy-and-visibility)
>   already states the governing principle: **client-side hiding is not an
>   adequate privacy boundary**, and protected facts _should be excluded or
>   sanitized before reaching an unauthorized client_.
> - [Authority and Information Projection §Projection rules](../architecture/information-authority-and-projection.md#projection-rules)
>   is the server-side authority for what any viewer receives.
> - [#268 §14](../architecture/scenario-play-workspace.md#14-verification-expectations-for-authorized-slices)
>   requires the proof to be made **in payload as well as in UI**.
>
> **An implementer cannot satisfy this requirement by hiding the field in the
> client, by redacting it in a view model, or by omitting it from a component.**
> The satisfying shape is the one the Product Owner has already accepted once:
> the private text lives outside the value object that travels into projections,
> so it _cannot_ travel, and it is read only by an explicitly GM-scoped path.
>
> **A recent QA failure turned on exactly this class of defect.** In
> [#271](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/271), AI intake
> wrote the context's `gmNotes` into `CharacterEquipmentItem.notes` — the
> **player-visible** column the Campaign Items surface labels _Description_ —
> and the player equipment read model returned it unredacted, so a player
> holding an intake-created Item received the GM's private text verbatim.
> Independent adversarial QA found it; the repair (`2e2f781b`) gave canonical
> Items a genuine separate GM-private column and, critically, kept that column
> **out of the domain Item** so it could not travel inside an Item value into
> any projection. Independent QA then proved the exclusion against twelve
> payloads, including one that forced the field onto a held Item by direct
> `UPDATE` to bypass the mapper.
> [#277](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/277) records
> that the weaker model — carrying the field in the domain value and redacting
> it in projections — **was explicitly rejected by the Product Owner.**
>
> Any dossier lane inherits that standard, and inherits the
> [mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) on privacy grounds.

**Where the dossier is stored is not settled.** See
[OPEN-PPL-3](#open-ppl-3--where-the-campaign-scoped-gm-only-dossier-lives).

### 6.2 Shared and player notes

- **Shared/player notes are separate** from the GM dossier. They are a different
  body of text with a different audience, not a visibility flag on one field.
- They may be **accumulated manually**.
- They may **later be proposed by AI session summaries** — proposed, under the
  same GM review boundary; AI parity in [section 3](#3-ai-parity-principle) and
  the intake invariant in
  [AI-assisted intake](ai-assisted-artifact-intake.md#the-invariant) both apply.
  Any such summary is additionally bound by the source rule in
  [section 11.2](#112-the-session-summary-source-rule--activity-is-the-only-source):
  it may be drafted only from the player-visible Activity projection, so a
  proposed note can never carry dossier text back out.
- They **survive changes in revealed identity**. Notes accumulated about _"the
  middle-aged wealthy man"_ remain attached to the same person once he is known
  to be Captain Varro.

Shared notes are **not** Blackboard state. The Blackboard is meta-level player
collaboration and is outside the game world, settled by
[PO-SPW-2](../architecture/scenario-play-workspace.md#po-spw-2--settled-the-blackboard-is-meta-level-player-collaboration);
placing something on the board changes nothing canonical. Person notes are
canonical campaign material. The two must not be conflated.

**The audience granularity of shared notes is not settled.** See
[OPEN-PPL-7](#open-ppl-7--the-audience-granularity-of-sharedplayer-notes).

---

## 7. Artifact and representation lifecycle

Recording #284 §6.

- **PCs as well as NPCs** may have attached Artifacts, including portraits and
  additional visible or private material.
- **Players should eventually be able to upload and manage permitted Artifacts
  for their own Characters.**
- **Attach, edit metadata, replace/update media, change primary
  representation/role, and disassociate are first-class operations**, not
  side effects of some other workflow.
- **Disassociation must not implicitly delete the Artifact.**
- **Artifact identity, semantic association, visibility/reveal, and current
  presentation are four separate pieces of state.**

Every one of these rests on existing settled contract, which this note links
rather than restates:

| #284 requirement                       | Already settled by                                                                                                                                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Association semantics for attachment   | [PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics) — zero/one/many, revision pinning, provenance, no one-to-one, and a one-to-one pointer field is **not acceptable** |
| Attachment transfers no ownership      | [Artifact Management §6.4](../architecture/artifact-management-package-import.md#64-no-implicit-ownership-transfer)                                                                                                                                        |
| Consumers reference stable identity    | [Artifact Management §8.2](../architecture/artifact-management-package-import.md#82-consumers-reference-artifact-identity)                                                                                                                                 |
| Revision pinning                       | [Artifact Management §4.4](../architecture/artifact-management-package-import.md#44-revision-pinning)                                                                                                                                                      |
| A reference does not grant view rights | [Artifact Management §9.2](../architecture/artifact-management-package-import.md#92-references-do-not-grant-view-rights)                                                                                                                                   |
| Disassociation is not deletion         | [Artifact Management §7.3](../architecture/artifact-management-package-import.md#73-retirement-rather-than-destructive-deletion) — retirement rather than destructive deletion                                                                             |
| Ownership scopes may grow              | [Artifact Management §6.5](../architecture/artifact-management-package-import.md#65-future-extensibility) — player-owned drafts are anticipated **without redesigning Artifact identity**                                                                  |
| Player authoring authority today       | [Artifact Management §9.3](../architecture/artifact-management-package-import.md#93-player-authority-in-v1) and [PO-3](../architecture/artifact-management-package-import.md#po-3--player-artifact-creationsubmission) — deferred from AM1                 |

PO-SPW-1 was settled for **Item**-to-Artifact representation. #284 extends the
same _requirement_ to people. It does **not** change PO-SPW-1, and it does not
decide whether one mechanism serves both. See
[OPEN-PPL-6](#open-ppl-6--where-generic-versus-specific-is-recorded) and the
lane map's treatment of this in [lane C](#lane-c--artifact-association-pc-self-service-and-the-generic-visual-library).

**Player self-service authority is not settled, and is deferred.** The Product
Owner ruled on 2026-09-24 that player self-service Artifact creation and
management is **future scope** that does **not block** the current
GM-controlled content-authoring implementation. The decision stays **open** —
no option is chosen — until player self-service is actually prioritized. See
[OPEN-PPL-10](#open-ppl-10--the-authority-model-for-player-self-service-artifacts).

---

## 8. Generic visual library

Recording #284 §7.

- Support **reusable generic representations** for equipment types, and later
  for people, buildings, ships and world material.
- **Generic library imagery should be visibly distinct from bespoke entity
  art.** **Pencil/sketch treatment is the current preferred visual convention.**
- **Record generic-versus-specific semantics as data as well as styling.** A
  styling convention alone is not sufficient: the distinction must be queryable,
  not merely visible.
- **Specific objects and entities may fall back to appropriate generic library
  imagery** until bespoke material exists.

The generic appearance image in [section 4](#4-person-representation-and-identity)
is the people-facing case of this library, which is why the two sections are
recorded together and why a lane that builds one should not build a second
mechanism for the other.

**Where the generic/specific fact is recorded is not settled.** See
[OPEN-PPL-6](#open-ppl-6--where-generic-versus-specific-is-recorded).

---

## 9. AI ingestion scale

Recording #284 §8. Three tiers, graded by risk:

| Tier                                            | Content class                            | Review shape                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Detailed staged GM review** — preserved as-is | Consequential named/canonical content    | The current per-entry review shipped by #271. **Preserve it.** It is not replaced by anything below.                           |
| **Batch review** — planned                      | Medium-risk generated content            | Counts, validation, duplicate and unresolved-association reporting, and **sampled/spot-check previews** rather than per-entry. |
| **Trusted bulk intake** — planned               | Low-risk generic visual/library material | Bulk acceptance without per-entry review.                                                                                      |

> **The same underlying in-app/domain operations remain authoritative at every
> tier.** A tier changes the _review_ shape. It never changes what the operation
> means, and it never creates a second canonical path.

This is the review-side statement of the parity principle in
[section 3](#3-ai-parity-principle). The current behaviour it must preserve is
recorded in [AI-assisted intake](ai-assisted-artifact-intake.md): the
[division of labour](ai-assisted-artifact-intake.md#the-division-of-labour)
(semantic facts from the author, every technical fact derived by Glantri), the
[invariant](ai-assisted-artifact-intake.md#the-invariant) that no canonical Item
or Artifact exists before the GM confirms, the
[conservative relationship resolution](ai-assisted-artifact-intake.md#relationship-resolution)
that never guesses, and the
[visibility rule](ai-assisted-artifact-intake.md#visibility) that everything
intake creates begins GM-private whatever the context suggested.

> **A tier that can make material player-visible without a separate human act is
> a change to the Reveal boundary**, in the vocabulary of
> [#268 §4.5](../architecture/scenario-play-workspace.md#45-reveal-and-share-are-two-different-operations),
> and
> [#279](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/279) is the
> open Product Owner decision that governs it. **This note does not answer
> #279.**

**Whether the tiers are new intake modes or configurations of the existing one
is not settled.** See
[OPEN-PPL-8](#open-ppl-8--whether-the-review-tiers-are-new-modes-or-configurations).

> **This section governs what AI brings _in_, not what AI generates _from_ the
> Campaign.** The separate, settled restriction on what a session-summary AI may
> be given is
> [section 11.2](#112-the-session-summary-source-rule--activity-is-the-only-source),
> and it is stated there once rather than repeated here. The two meet at the
> review boundary: a drafted summary is GM-reviewed and explicitly published,
> exactly as staged intake creates nothing before the GM confirms.

---

## 10. GM Campaign Material

Recording #284 §9.

- **Do not build a general-purpose knowledge-management system.** This is a
  scope prohibition, stated first because it is the constraint most likely to be
  exceeded.
- Provide a **lightweight unified material/index experience** across canonical
  objects: People/NPCs, Items, Artifacts, Maps and Notes.
- Organize and find **primarily through semantic associations** — Campaign,
  Scenario, Encounter, PC/NPC, Item, GM note — rather than through folders,
  taxonomies or a search-first model.
- **Associations should be navigable in both directions where useful.**

This extends work that already exists and must not be duplicated:
[#239 Creation launcher and material index](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/239)
is Ready under #227, and
[Campaign Management V2 §6.2](../architecture/campaign-management-v2.md#62-index-behavior-and-canonical-homes)
already establishes index behaviour and canonical homes, which
[PPV1 §13](../architecture/player-play-v1.md#13-canonical-detail-and-click-through-rule)
routes to rather than redefining. The index is a **GM authoring and index
surface** and, by
[#268 §9](../architecture/scenario-play-workspace.md#9-campaign-artifact-management-boundary),
is **not** the player in-play experience and is not a substitute for it.

---

## 11. Scenario authoring and history

### 11.1 What a Scenario carries

Recording #284 §10.

- **Scenario is the principal GM preparation and history container.** This is
  consistent with
  [#268 D1](../architecture/scenario-play-workspace.md#3-controlling-distinctions),
  which makes Scenario the canonical play workspace, and extends it from play to
  preparation and history.
- A Scenario should support:
  - modest **private GM planning/notes**;
  - **player framing / current scene text**;
  - **related people, Items, Artifacts and Maps**;
  - later, **prepared announcements**;
  - a **post-play summary of what actually happened**.
- **Plan and actual summary remain distinct.** The preparation is not
  retroactively edited into the history.
- **AI may later draft the post-play summary from Activity for GM review** —
  draft, for review, under [section 3](#3-ai-parity-principle) and the intake
  invariant.

Three of these are already governed elsewhere and are linked, not re-decided:

- **Scene text** is settled by
  [OPEN-PPV1-1](../architecture/player-play-v1.md#open-ppv1-1--settled-scenario-and-encounter-each-may-carry-replaceable-scene-text):
  Scenario and Encounter each may carry replaceable scene text. Its distinction
  from a GM announcement is settled by
  [PPV1 §9.3](../architecture/player-play-v1.md#93-gm-announcements-versus-scene-text).
- **Prepared announcements** are already a recorded deferred bounded capability
  in [PPV1 §14](../architecture/player-play-v1.md#14-deferred-capabilities) and
  §9.3. #284 confirms the intent; it does not re-scope it, and no lane below
  absorbs it.
- **Activity**, the source a post-play summary would be drafted from, is settled
  by
  [PPV1 §9](../architecture/player-play-v1.md#9-activity-visibility-and-projection-rules),
  including
  [§9.4](../architecture/player-play-v1.md#94-the-existing-event-and-roll-model):
  one event model already serves both projections, **no new player log**, and
  adding a new event type is a persisted-semantics change on a privacy-projected
  surface carrying the
  [mandatory QA floor](../../AGENTS.md#mandatory-qa-floor).

**Where the post-play summary lives is not settled.** See
[OPEN-PPL-11](#open-ppl-11--where-the-post-play-summary-lives).

### 11.2 The session-summary source rule — Activity is the only source

Recording the Product Owner ruling of 2026-09-22 on
[#284](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/284).
**Settled.** It reopens nothing in
[section 15](#15-open-decisions--none-chosen) and changes no lane's structure.
This is the single full statement of the rule; every other section that needs it
links here.

> **The player-visible Situation Activity stream is the complete player-safe
> narrative record from which an AI session summary may be produced. A
> session-summary AI must receive only that player-safe Activity projection, not
> richer Campaign or game state.**

A session-summary AI **must not receive, and must not be in a position to infer
from**:

- **GM-only PC/NPC dossiers** — [section 6.1](#61-the-gm-only-dossier);
- **private GM planning notes** — [section 11.1](#111-what-a-scenario-carries);
- **private Artifact/Item notes** — `CampaignAsset.gmNotes` and the canonical
  Item GM-private column added by #271, both recorded in
  [section 13](#13-existing-model-orientation);
- **unrevealed NPC identity or facts** —
  [section 4](#4-person-representation-and-identity);
- **private chat and messages**;
- **detailed Skill or Combat calculations** — already excluded from Activity by
  [PPV1 §9.2](../architecture/player-play-v1.md#92-the-visibility-rule), which
  keeps them in their canonical entitled views;
- **GM-only or player-private mechanical records** — including
  `roleplayState.actionLog` and its `calculationText`, which
  [PPV1 §9.4](../architecture/player-play-v1.md#94-the-existing-event-and-roll-model)
  records as the detailed-roll home distinct from Activity;
- **technical or lifecycle bookkeeping suppressed from Situation**;
- **prepared but unpublished announcements** —
  [PPV1 §9.3](../architecture/player-play-v1.md#93-gm-announcements-versus-scene-text)
  and [§14](../architecture/player-play-v1.md#14-deferred-capabilities);
- **scene / framing text, merely because it exists outside Activity** —
  [PPV1 §9.3](../architecture/player-play-v1.md#93-gm-announcements-versus-scene-text)
  and
  [OPEN-PPV1-1](../architecture/player-play-v1.md#open-ppv1-1--settled-scenario-and-encounter-each-may-carry-replaceable-scene-text).

> **The governing consequence.** **If information should be eligible for the
> shared session recap, it must first have an appropriate player-visible
> Activity event or summary.** Eligibility is earned by being published to the
> table, not by being reachable in the database.

#### This is a privacy constraint, not a UI preference

The rule is satisfied by **what the AI is given**, not by what is filtered out
afterwards.

> **An implementer cannot satisfy this rule by assembling richer Campaign or
> game state and then filtering, redacting, truncating or instructing the model
> at the prompt-assembly layer.** The summary capability must be **handed the
> player-safe Activity projection and nothing else**, so that the excluded
> material is not present in the context to be filtered. A prompt that could in
> principle have carried GM-private text has already failed this rule, whether
> or not the produced draft happens to contain any.

This is the same standard, and the same reasoning, as
[section 6.1](#61-the-gm-only-dossier):

- [Product & Presentation Principles §4.5](product-presentation-principles.md#45-respect-perspective-knowledge-ownership-privacy-and-visibility)
  already states the governing principle — **client-side hiding is not an
  adequate privacy boundary**, and protected facts are excluded or sanitized
  **before** reaching an unauthorized consumer. A summary AI is such a consumer,
  and its output is destined for a player-visible surface.
- [Authority and Information Projection §Projection rules](../architecture/information-authority-and-projection.md#projection-rules)
  remains the server-side authority for what any consumer receives.
- **The #271 QA failure turned on exactly this class of defect.** GM-private
  text reached a player-visible surface while every gate stayed green, because
  the private value travelled inside a value object that projections carried.
  The accepted repair kept the private column **out of** the object that
  travels, so it _could not_ travel.
  [#277](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/277) records
  that the weaker "carry it and redact later" model was **explicitly rejected by
  the Product Owner.** Prompt-layer filtering is that rejected model, applied to
  a context window instead of a payload.

Any summary-drafting capability therefore inherits the
[mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) on privacy grounds, and
its proof is [section 17](#17-verification-expectations-for-lanes-authorized-from-here)
item 2.

#### The Scenario-summary workflow

1. **Generate a private draft solely from Scenario Activity.** The draft is
   GM-private on creation, consistent with the intake
   [visibility rule](ai-assisted-artifact-intake.md#visibility).
2. **The GM reviews and edits it.** Draft, not publication — the GM review
   boundary of [section 3](#3-ai-parity-principle) and the intake
   [invariant](ai-assisted-artifact-intake.md#the-invariant) both apply, and the
   parity obligation means the GM must be able to author the same summary
   without AI.
3. **The GM explicitly publishes it** as the Scenario's player-visible
   summary/history. Publication is a **separate human act**; no drafting tier
   may make a summary player-visible on its own.
4. **The published summary is straightforward to copy manually**, so the GM can
   paste it into email or other external communication without an export
   feature.

> **This workflow decides no storage.** Whether the published summary is a
> Scenario field, a generated projection, a `CampaignNote` or a stored
> Activity-derived text remains
> [OPEN-PPL-11](#open-ppl-11--where-the-post-play-summary-lives), whose options
> are unchanged and **none chosen**. Step 3's publication act constrains the
> **visibility transition**, not the record that carries it.

#### The four-way distinction to preserve

| Artifact             | What it is                                             |
| -------------------- | ------------------------------------------------------ |
| **GM plan**          | private preparation — _what may happen_                |
| **Scene text**       | replaceable current framing                            |
| **Activity**         | player-safe record of _what did happen_                |
| **Scenario summary** | GM-approved narrative derived **solely** from Activity |

These four are not degrees of the same thing. Collapsing any pair — drafting
from the plan, recapping the scene text, or editing the plan into the history —
breaks the rule. **Plan and actual summary remain distinct** is #284 §10's own
statement of the same boundary, recorded in
[section 11.1](#111-what-a-scenario-carries).

#### What this rule builds on, and does not replace

[PPV1 §9](../architecture/player-play-v1.md#9-activity-visibility-and-projection-rules)
remains the authority for what Activity contains and what it excludes, and
[§9.4](../architecture/player-play-v1.md#94-the-existing-event-and-roll-model)
remains the authority for the model: `ScenarioEventLog` projected by
`projectScenarioObjectiveHistory` **is** the player-safe shared Activity, it
already performs the player filtering, and **no new player log is created**.
This rule adds only that this existing projection is the **exclusive** source
for a session summary. It narrows nothing in PPV1 §9 and adds no event.

One consequence follows directly and is recorded here as a consequence, not as a
new decision: because **there is no GM announcement event type today** —
[PPV1 §9.4](../architecture/player-play-v1.md#94-the-existing-event-and-roll-model)
— narration the GM currently delivers as scene text is **not recap-eligible**
until an announcement becomes a durable Activity event. PPV1 §9.4 already
records that adding that event type is a persisted-semantics change on a
privacy-projected surface carrying the
[mandatory QA floor](../../AGENTS.md#mandatory-qa-floor), and this note neither
schedules nor authorizes it.

---

## 12. Encounter

Recording #284 §11.

- Keep Encounter **comparatively lightweight**.
- At minimum: **name, optional short subtitle/framing, roster/context, and
  associations to relevant material**.
- **Do not turn Encounter into a second rich authoring document.** Scenario
  carries the broader preparation and history.

> **PRODUCT OWNER RULING C2, 2026-09-23** — recorded in
> [Content authoring, Scenario preparation and Artifact management §13](content-authoring-scenario-preparation-and-artifact-management.md#13-encounter-stays-lightweight),
> the controlling contract for this model. The lightweight principle above is
> **preserved**, and the Scenario GM Plan is the long-form primary planning
> document. Within that principle, an Encounter may carry **one lightweight
> GM-only planning note**: plain/Markdown text; collapsible; directly editable;
> importable/updateable; **no separate rich-document lifecycle.** Authoring
> Packages may set or update this Encounter field, but **do not model a separate
> rich "Encounter GM Plan document".**

This is primarily a **preservation and scope-boundary requirement**. It is
consistent with, and adds nothing to,
[#268 D2](../architecture/scenario-play-workspace.md#3-controlling-distinctions)
(Encounter is contextual state _within_ the Scenario),
[#268 §6.1](../architecture/scenario-play-workspace.md#61-no-separate-encounter-play-page)
(no separate Encounter play page) and
[PPV1 §7.2](../architecture/player-play-v1.md#72-no-parallel-encounter-systems)
(no parallel Encounter systems).

It also does **not** disturb
[PO-SPW-3](../architecture/scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling):
the existing GM Encounter workspace is **retained** as transitional GM-only
management tooling, is not a second play surface, receives no new player-facing
play capability, and later absorption is separately scoped after playtesting.
#284's "keep Encounter lightweight" is a constraint on _new authoring
capability_, not an instruction to remove the retained tooling.

---

## 13. Existing-model orientation

Recorded at `dev@c2c0f2a96f86d12686a325d173ef57d12704d781` so that the lane map
below is grounded in the repository rather than in assumption. **These are
orientation facts for sizing, not a contract.** Per
[capability sizing and preparation](../process/development-operating-model.md#capability-sizing-and-preparation),
a preflight near activation re-establishes them against then-current `dev`; this
section will go stale and is not to be treated as an exact-path design.

| Fact                                                                                                                                                                                                                                             | Why it matters                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ReusableEntity` exists in `packages/database/prisma/schema.prisma` and `reusableEntitySchema` in `packages/domain/src/campaign/scenario.ts`, with kinds `npc` / `monster` / `animal`.                                                           | A non-PC person record already exists. It is **owned by `gmUserId` and is not campaign-scoped**, which a Campaign-scoped dossier would have to reckon with. Per the settled [OPEN-PPL-4](#open-ppl-4--what-a-persistent-npc-record-is) it is **reusable source/archetype material, not the canonical persistent identity of a person**. |
| `ReusableEntity` carries a single `description` and a single `notes`, and `CampaignRosterEntry` carries a single `notes`.                                                                                                                        | **No GM-private / player-visible split exists on any person record today.** [Section 6.1](#61-the-gm-only-dossier) is therefore new work, not a flag on an existing field.                                                                                                                                                              |
| `CampaignActorClass` in `apps/web/src/lib/campaigns/campaignActors.ts` is already `template` / `campaign_npc` / `generated_npc`, and derives from a `ReusableEntity` snapshot.                                                                   | The Template/NPC/generated-Actor trichotomy already exists in the client, above a domain that does not distinguish them.                                                                                                                                                                                                                |
| `CampaignRosterSourceType` is `character` / `reusableEntity` / `template` and `CampaignRosterCategory` is `pc` / `npc` / `template`.                                                                                                             | Part of #284 §1's vocabulary is already in the persisted roster model.                                                                                                                                                                                                                                                                  |
| `apps/web/src/lib/templates/npcArchetypeTemplates.ts` and `apps/web/src/features/templates/TemplatesPageContent.tsx` are the existing archetype authoring surface.                                                                               | An NPC/Actor authoring lane extends this rather than starting a new surface.                                                                                                                                                                                                                                                            |
| Neither `Character` nor `ReusableEntity` carries any representation, portrait or Artifact reference.                                                                                                                                             | Person-to-Artifact association is genuinely absent, unlike Item-to-Artifact.                                                                                                                                                                                                                                                            |
| `CampaignItemArtifactAttachment` exists (from #271, PR #275) with a composite `(campaignId, artifactId)` FK but only a simple FK on `itemId`.                                                                                                    | The existing attachment mechanism, and the subject of [#278](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/278). [PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics) states it is **not** automatically canonical.                        |
| `CampaignNote` + `CampaignNoteAssociation` exist, with `CampaignNoteReferenceType` = `campaign` / `scenario` / `encounter` / `character` / `npc` / `artifact` / `tag`, a `@@unique([noteId, type, targetId])` and a `@@index([type, targetId])`. | A multi-association substrate indexed in **both** directions already exists — directly relevant to [section 10](#10-gm-campaign-material)'s bidirectional navigation.                                                                                                                                                                   |
| `Scenario` has `name`, `description`, `kind`, `status`, `mapAssetId`, `liveStateJson`. There is **no** separate GM-private planning field, **no** player framing field and **no** post-play summary field.                                       | [Section 11](#11-scenario-authoring-and-history) is mostly new fields/state, and a single `description` today serves an audience that would have to be split.                                                                                                                                                                           |
| `Encounter` has `name`, `status`, `sessionJson`, `combatStorageMode` and archive counters.                                                                                                                                                       | Encounter is **already** lightweight. [Section 12](#12-encounter) is a preservation requirement.                                                                                                                                                                                                                                        |
| `CampaignAsset` carries `gmNotes` with the schema comment _"Never included in the player-facing Artifact projection"_, plus `audience`, `visibility`, `artifactKind`, `altText`.                                                                 | The GM-private-field pattern already has a second worked instance on the Artifact side.                                                                                                                                                                                                                                                 |
| `apps/web/app/(app)/campaigns/[campaignId]/CampaignWorkspaceShell.tsx` is ~1,707 lines and is the real player and GM arena, per [PPV1 §17.1](../architecture/player-play-v1.md#171-the-existing-player-surface--verified-facts).                 | Any UI in lanes B and E lands in the densest reserved hotspot in the repository.                                                                                                                                                                                                                                                        |

---

## 14. What is already settled elsewhere

The complete index of places where this note **links instead of restating**.
Nothing in either contract is narrowed, contradicted or moved by this note.

| Settled fact                                                                                 | Owned by                                                                                                                                                                                                                             | Referenced from                                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Item-to-Artifact association semantics                                                       | [PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics)                                                                                              | [§7](#7-artifact-and-representation-lifecycle), [lane C](#lane-c--artifact-association-pc-self-service-and-the-generic-visual-library)                           |
| Reveal / Share / Place-or-remove are three distinct operations; the Blackboard is meta-level | [PO-SPW-2](../architecture/scenario-play-workspace.md#po-spw-2--settled-the-blackboard-is-meta-level-player-collaboration), [#268 §4.5](../architecture/scenario-play-workspace.md#45-reveal-and-share-are-two-different-operations) | [§4](#4-person-representation-and-identity), [§6.2](#62-shared-and-player-notes), [§9](#9-ai-ingestion-scale)                                                    |
| The GM Encounter workspace is retained as transitional GM-only tooling                       | [PO-SPW-3](../architecture/scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling)                                                                     | [§12](#12-encounter), [lane E](#lane-e--gm-campaign-material-index-and-scenario-authoringhistory)                                                                |
| Presence is not visibility; a projection is never the authority for presence                 | [#268 §5](../architecture/scenario-play-workspace.md#5-presence-versus-visibility)                                                                                                                                                   | [§2](#2-people-model), [§4](#4-person-representation-and-identity)                                                                                               |
| The durable shared-material collection survives board removal                                | [#268 §8.3](../architecture/scenario-play-workspace.md#83-the-durable-shared-material-collection)                                                                                                                                    | [§6.2](#62-shared-and-player-notes)                                                                                                                              |
| Campaign Artifact management is a GM authoring surface, not the play experience              | [#268 §9](../architecture/scenario-play-workspace.md#9-campaign-artifact-management-boundary)                                                                                                                                        | [§10](#10-gm-campaign-material)                                                                                                                                  |
| Privacy proofs are made in payload as well as UI                                             | [#268 §14](../architecture/scenario-play-workspace.md#14-verification-expectations-for-authorized-slices)                                                                                                                            | [§6.1](#61-the-gm-only-dossier), [§17](#17-verification-expectations-for-lanes-authorized-from-here)                                                             |
| Player-created collaboration Artifacts are a later bounded capability                        | [#268](../architecture/scenario-play-workspace.md#later-bounded-capability--player-created-collaboration-artifacts)                                                                                                                  | [lane C](#lane-c--artifact-association-pc-self-service-and-the-generic-visual-library)                                                                           |
| The Inspector exists, is generic, and dominates the Situation screen                         | [PPV1 §8.2](../architecture/player-play-v1.md#82-inspector)                                                                                                                                                                          | [§5](#5-person-inspector)                                                                                                                                        |
| Selector rails are projections; the Artifacts rail is not narrowed in the first pass         | [PPV1 §8.1](../architecture/player-play-v1.md#81-left-selectors), [OPEN-PPV1-2](../architecture/player-play-v1.md#open-ppv1-2--settled-the-first-composition-pass-preserves-the-existing-artifact-visibility-projection)             | [§2](#2-people-model), [lane B](#lane-b--person-representation-identity-reveal-inspector-and-notesdossier)                                                       |
| Activity visibility, one event model, no second player log                                   | [PPV1 §9](../architecture/player-play-v1.md#9-activity-visibility-and-projection-rules), [§9.4](../architecture/player-play-v1.md#94-the-existing-event-and-roll-model)                                                              | [§11.1](#111-what-a-scenario-carries), [§11.2](#112-the-session-summary-source-rule--activity-is-the-only-source)                                                |
| Scene text versus GM announcement                                                            | [PPV1 §9.3](../architecture/player-play-v1.md#93-gm-announcements-versus-scene-text), [OPEN-PPV1-1](../architecture/player-play-v1.md#open-ppv1-1--settled-scenario-and-encounter-each-may-carry-replaceable-scene-text)             | [§11](#11-scenario-authoring-and-history)                                                                                                                        |
| Click through to the canonical place where full information lives                            | [PPV1 §13](../architecture/player-play-v1.md#13-canonical-detail-and-click-through-rule)                                                                                                                                             | [§5](#5-person-inspector)                                                                                                                                        |
| Prepared announcements are deferred and bounded                                              | [PPV1 §14](../architecture/player-play-v1.md#14-deferred-capabilities)                                                                                                                                                               | [§11](#11-scenario-authoring-and-history)                                                                                                                        |
| Scenario- and Encounter-relevant Artifact filtering is a later bounded capability            | [PPV1](../architecture/player-play-v1.md#later-bounded-capability--scenario--and-encounter-relevant-artifact-filtering)                                                                                                              | [lane B](#lane-b--person-representation-identity-reveal-inspector-and-notesdossier), [lane E](#lane-e--gm-campaign-material-index-and-scenario-authoringhistory) |
| The first Player Play sequence is P1 -> P2 -> playtest; P4 runs alone                        | [PPV1 §17.4](../architecture/player-play-v1.md#174-recommended-sequencing-and-the-portfolio-constraint)                                                                                                                              | [§16.7](#167-sequencing-and-the-portfolio-constraint)                                                                                                            |
| The later GM surface boundary                                                                | [PPV1 §16](../architecture/player-play-v1.md#16-relationship-to-the-later-gm-surface)                                                                                                                                                | [lane E](#lane-e--gm-campaign-material-index-and-scenario-authoringhistory)                                                                                      |

---

## 15. Open decisions — none chosen

Recorded in the style of
[#268 §12](../architecture/scenario-play-workspace.md#12-product-owner-decisions--all-settled)
and
[PPV1 §18](../architecture/player-play-v1.md#18-open-decisions-and-recorded-mismatches).

**Every decision below is genuinely open, with two exceptions. Options are
stated neutrally and none is chosen.** A lane that reaches one of these stops
and returns it to the Product Owner / control plane rather than deciding it in
implementation. None of these reopens anything settled by #268 or Player Play
V1.

> **Exceptions, in three distinct states. Every heading below is retained
> unchanged so existing references continue to resolve.**
>
> - **Settled and closed:**
>   [OPEN-PPL-4](#open-ppl-4--what-a-persistent-npc-record-is) and
>   [OPEN-PPL-6](#open-ppl-6--where-generic-versus-specific-is-recorded), both
>   as of 2026-09-23.
> - **Settled for V1, future scoping deferred — not closed:**
>   [OPEN-PPL-9](#open-ppl-9--the-scope-of-a-selected-primary-representation),
>   as of 2026-09-24. V1 is answered unambiguously; per-Campaign,
>   per-entitlement-tier and per-context scoping remain deferred, not rejected.
> - **Open and deferred — no option chosen, and non-blocking for current V1:**
>   [OPEN-PPL-10](#open-ppl-10--the-authority-model-for-player-self-service-artifacts),
>   as of 2026-09-24. It is **still open**; what changed is only that it no
>   longer blocks GM-controlled content authoring.
>
> **The remaining seven decisions — OPEN-PPL-1, 2, 3, 5, 7, 8 and 11 — remain
> genuinely open, unranked and unchanged.**

### 15.1 The decision frontier

**PRODUCT OWNER RULING, 2026-09-24**, quoted verbatim, governing how the
decisions in this section are answered:

> "Decide only what the currently authorized product actually requires. Future
> or hypothetical behaviour is deferred unless the current implementation
> materially depends on it, or the current choice would materially foreclose a
> reasonably foreseeable near-term requirement. **Reasonable extensibility is
> sufficient; hypothetical completeness is not required.**"

This is why a decision in this section may be answered **for V1** without being
closed, and why a decision may be recorded as **open and deferred** rather than
forced to a premature choice. A V1 answer here is binding on the implementing
lane and is **not** a rejection of the options it did not need to take.

### OPEN-PPL-1 — How identity revelation is modelled

**Status:** Open. **Raised by:** #284 §3. **Affects:** lane B.

#284 settles that presence does not imply known identity, that presentation may
begin generic, that revelation exposes canonical name, specific portrait and a
detailed description, and that the underlying Actor/person is **not** replaced.
It does not say how revealed-ness is represented.

Options, **none chosen**:

1. **A reveal state on the existing person-in-campaign association** — revealed
   or not, per person per Campaign, for all players at once.
2. **A per-viewer knowledge record** — revealed-ness held per player, allowing
   one player to know an identity another does not.
3. **A separate revealed-presentation record** — the generic presentation and
   the identified presentation are two records, and revelation switches which
   one projects.
4. **Reuse of the existing Artifact/Scenario reveal state** — model person
   revelation on `ScenarioArtifactReference`'s `attached` / `published` /
   `withdrawn` shape rather than introducing a second vocabulary.

Any option must satisfy #284's preservation requirement: notes and history
survive identification. Options 1 and 2 differ materially in privacy blast
radius and in QA cost.

### OPEN-PPL-2 — Whether Actor is a new domain entity

**Status:** Open. **Raised by:** #284 §1. **Affects:** lanes A and B.

#284 names **Actor** as the runtime/play instance, originating from a
Character/NPC **or** a Template. It does not say whether that is a new entity.
[Section 13](#13-existing-model-orientation) records that `ReusableEntity` plus
`ScenarioParticipant` plus `CampaignActorClass` already express something close.

Options, **none chosen**:

1. **Nothing new** — `ScenarioParticipant` already _is_ the Actor, and
   `CampaignActorClass` already classifies its origin.
2. **Extend `ReusableEntity`** — keep one entity, address its GM-user rather
   than Campaign scoping, and widen its kinds.
3. **A distinct Actor entity** — a first-class runtime instance separate from
   both the archetype and the participant row.

> **This note introduces no domain primitive.** The Product Owner named _Actor_
> and _Template_ as product concepts. Whether either becomes a domain entity is
> this decision, and it is not made here. Note also that #268 asserts it
> [introduces no new domain primitive](../architecture/scenario-play-workspace.md#10-existing-model-evidence);
> a lane that chose option 3 would be doing something #268 deliberately avoided
> and would owe an architecture decision record under
> [`docs/decisions/README.md`](../decisions/README.md#when-a-record-is-required).

### OPEN-PPL-3 — Where the Campaign-scoped GM-only dossier lives

**Status:** Open. **Raised by:** #284 §5. **Affects:** lane B.

The requirement — long-form, Campaign-scoped, GM-only, structurally excluded
from all player projections, search and context — is **settled**. The storage is
not.

Options, **none chosen**:

1. **A GM-private column on a Campaign-scoped person record**, deliberately kept
   out of the domain value object, in the shape the Product Owner already
   accepted for `CharacterEquipmentItem.gmNotes` in #271.
2. **A GM-only `CampaignNote`**, reusing the existing note and association
   substrate with an audience restriction.
3. **A dedicated dossier entity**, with its own lifecycle and history.

Whichever is chosen must satisfy [section 6.1](#61-the-gm-only-dossier) in full,
including the payload-level proof, and carries the
[mandatory QA floor](../../AGENTS.md#mandatory-qa-floor). Option 2 must
additionally answer whether a `CampaignNote` can bear a GM-only audience without
weakening the existing note model.

### OPEN-PPL-4 — What a persistent NPC record is

**Status:** **SETTLED and closed.**\
**Settled on:** 2026-09-23\
**Authority:** PRODUCT OWNER RULING, recorded on
[#284](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/284).\
**Raised by:** #284 §1. **Affects:** lane A.\
**Gates:** **Nothing.** It no longer gates lane A.

**The question as originally recorded**, retained as provenance:

> #284 settles that a persistent PC and a persistent NPC use the **same full
> Character and rules model**, and that only control semantics differ. It does
> not say which record carries it.
>
> Options, **none chosen**:
>
> 1. **A `Character` with no player owner**, GM-controlled through existing
>    Campaign authority.
> 2. **A `ReusableEntity` whose snapshot is a full character build** — closest
>    to today's shape, per [section 13](#13-existing-model-orientation).
> 3. **Both**, with promotion between them — which folds into
>    [OPEN-PPL-5](#open-ppl-5--what-actor-to-persistent-npc-promotion-preserves).
>
> Option 1 interacts with
> [Character lifecycle authority](../architecture/character-lifecycle-authority.md#actor-and-privacy-matrix),
> which is written around a player owner, and with the V1 rule of **one active
> Campaign per Character**, which #284 §1 explicitly retains.

**What was ruled**, quoted verbatim:

> "A persistent NPC is a Character using the same full Character/rules model as
> a PC, but with no player owner and with GM control under the applicable
> GM/Campaign authority.
> `CampaignRosterEntry` provides Campaign membership; Character itself remains
> independent of Campaign.
> `ReusableEntity` is reusable source/archetype material, not the canonical
> persistent identity of a person.
> Update the relevant authority/lifecycle documentation as necessary to
> explicitly support GM-controlled Characters with no player owner. Do not
> resolve OPEN-PPL-5 beyond recording that later materialization/promotion from
> reusable content to persistent Character remains its concern."

**This is option 1.** Option 2 is explicitly rejected **as the canonical
persistent identity of a person**: `ReusableEntity` remains reusable
source/archetype material. Option 3 is not chosen. The ruling records only that
later materialization/promotion from reusable content to a persistent Character
remains
[OPEN-PPL-5](#open-ppl-5--what-actor-to-persistent-npc-promotion-preserves)'s
concern; **nothing about OPEN-PPL-5 is answered, narrowed or pre-empted here.**

**Consequences recorded, not extended:**

- **Character identity is not Campaign-scoped.** `CampaignRosterEntry` provides
  Campaign membership; the `Character` record itself remains independent of
  Campaign.
- [Character lifecycle authority](../architecture/character-lifecycle-authority.md#gm-controlled-characters-with-no-player-owner)
  is extended to support a Character with no player owner, controlled by the GM
  under the applicable GM/Campaign authority, **without weakening the existing
  protection that a managing GM may not pull another user's player-owned
  Character into a Campaign**.
- The V1 rule of **one active Campaign per Character** is unchanged. #284 §1
  retains it and this ruling does not amend it.
- The ruling describes an ownership state the schema already permits:
  `Character.ownerId` is declared `String?` in
  `packages/database/prisma/schema.prisma`. That is recorded as evidence, not as
  an implementation instruction.

**Supplementary Product Owner ruling, 2026-09-23 — pre-roster managing-GM
authority.** The original ruling left the authority over an ownerless NPC
Character **before it is rostered in any Campaign** unstated, and authoring
necessarily precedes rostering. The Product Owner has now settled it, quoted
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

**Further consequences recorded, not extended:**

- A persistent ownerless NPC Character has a **designated managing GM** whose
  permanent-Character lifecycle authority is **independent of Campaign roster
  membership** — before first rostering, while rostered, and after removal.
- `CampaignRosterEntry` governs Campaign membership and Campaign-scoped
  authority and state only, and does **not** establish permanent ownership.
- The player-owned protection is **unchanged**: GM status or Campaign membership
  never grants lifecycle ownership or authority over another user's
  player-owned Character.
- **Binding on the implementing lane:** player `ownerId` must **not** be
  overloaded to represent the managing GM, and the managing GM must **not** be
  inferred from GM role or Campaign membership. If no suitable durable authority
  relation exists, an explicit representation must be added. Recorded in
  [Character lifecycle authority](../architecture/character-lifecycle-authority.md#the-representation-constraint--ownerid-may-not-be-overloaded).
- The matrix rows in
  [Character lifecycle authority](../architecture/character-lifecycle-authority.md#actor-and-privacy-matrix)
  that conditioned GM read/edit/delete on "while the Character is rostered" are
  updated accordingly, with the player-owned case kept separate and unamended.
- **Nothing here narrows
  [OPEN-PPL-5](#open-ppl-5--what-actor-to-persistent-npc-promotion-preserves)
  or any other open decision.**

### OPEN-PPL-5 — What Actor-to-persistent-NPC promotion preserves

**Status:** Open. **Raised by:** #284 §1 ("may be a later capability").
**Affects:** lane A.

Options, **none chosen**:

1. **Promotion preserves identity** — the same person gains a persistent record,
   and all notes, history and revealed state follow it.
2. **Promotion creates a new persistent person**, with the Actor's material
   copied or linked rather than moved.
3. **No promotion** — the lightweight and persistent paths stay separate, and a
   GM who wants persistence authors the NPC directly.

Option 1's preservation requirement interacts with
[OPEN-PPL-1](#open-ppl-1--how-identity-revelation-is-modelled) and
[OPEN-PPL-3](#open-ppl-3--where-the-campaign-scoped-gm-only-dossier-lives):
whatever carries notes and revealed-ness must survive the promotion.

### OPEN-PPL-6 — Where generic versus specific is recorded

**Status:** **SETTLED and closed.**\
**Settled on:** 2026-09-23\
**Authority:** PRODUCT OWNER RULING, recorded in
[Content authoring, Scenario preparation and Artifact management §18.6](content-authoring-scenario-preparation-and-artifact-management.md#186-open-ppl-6-resolved).\
**Raised by:** #284 §7 (_"as data as well as styling"_).
**Affects:** lanes B and C.\
**Gates:** **Nothing.** It no longer gates lane C.

**The question as originally recorded**, retained as provenance:

> Options, **none chosen**:
>
> 1. **A property of the Artifact** — an Artifact is generic-library material or
>    bespoke entity art, once and globally.
> 2. **A property of the association** — the same Artifact may be a generic
>    stand-in for one entity and bespoke for another.
> 3. **Both** — a library classification on the Artifact and a role on each
>    association.
>
> Option 2 and option 3 interact with PO-SPW-1's requirement that an association
> carry **attachment provenance** and support **zero, one or multiple**
> representations; option 1 does not.

**What was ruled.** Separate **intrinsic representation nature** from
**contextual use**.

- **Artifact:** intrinsic representation nature = **generic/reusable**,
  **specific/bespoke**, or **unspecified** where required.
- **Association:** contextual role/use — e.g. primary portrait, general
  appearance, additional representation, fallback usage — plus **association
  provenance**.
- **"Generic" describes the content itself. "Currently used as a fallback for X"
  describes a relationship.**
- **Representation-readiness state should be derived from these dimensions**
  rather than duplicating a single ambiguous generic/specific flag.

This is effectively option 3, made precise: the two dimensions are not the same
fact recorded twice, and readiness is **derived**, not stored as a third flag.
It satisfies PO-SPW-1's attachment-provenance and multiplicity requirements,
which the association half carries.

### OPEN-PPL-7 — The audience granularity of shared/player notes

**Status:** Open. **Raised by:** #284 §5. **Affects:** lane B.

#284 calls them _"shared/player game notes"_ and _"shared notes"_, and settles
that they are separate from the GM dossier and survive identity change. It does
not say who shares them with whom.

Options, **none chosen**:

1. **One shared body per person per Campaign**, visible to and editable by all
   players in that Campaign.
2. **Per-player private notes**, each player keeping their own.
3. **Both** — a shared body plus per-player private notes.

Option 1 and option 3 must not be confused with the Blackboard, which
[PO-SPW-2](../architecture/scenario-play-workspace.md#po-spw-2--settled-the-blackboard-is-meta-level-player-collaboration)
settles as meta-level player collaboration outside the game world. Option 2
raises a player-versus-player privacy boundary that
[Product & Presentation Principles §4.5](product-presentation-principles.md#45-respect-perspective-knowledge-ownership-privacy-and-visibility)
governs.

### OPEN-PPL-8 — Whether the review tiers are new modes or configurations

**Status:** Open. **Raised by:** #284 §8. **Affects:** lane D.

Options, **none chosen**:

1. **Configurations of the existing staged intake** — one pipeline, three review
   presentations, selected by content class.
2. **Separate intake modes** — distinct entry points with distinct validation
   and acceptance surfaces.
3. **A risk classification on the proposal** that selects the review shape
   automatically, with GM override.

Whichever is chosen, #284 §8's own constraint holds: _the same underlying
in-app/domain operations remain authoritative at every tier._ Any tier that can
make material player-visible without a separate human act is additionally gated
on [#279](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/279), which
**this note does not answer**.

### OPEN-PPL-9 — The scope of a selected primary representation

**Status:** **SETTLED FOR V1. Future scoping DEFERRED, not rejected. This
decision is therefore neither "open" nor "closed".**\
**Settled on:** 2026-09-24\
**Authority:** PRODUCT OWNER RULING, recorded on
[#284](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/284) and in
[Content authoring, Scenario preparation and Artifact management §18.9](content-authoring-scenario-preparation-and-artifact-management.md#189-open-ppl-9-answered-for-v1).\
**Raised by:** #284 §3 and §4. **Affects:** lanes B and C.\
**Gates:** **Nothing in V1.** It no longer gates lane B or lane C. It remains
the decision record that a **future** context-specific representation override
must reopen and extend.

**The question as originally recorded**, retained as provenance:

> #284 settles that a person may have several Artifacts and **one selected
> primary representation**, and separately that both a generic appearance image
> and a specific portrait are supported. Those two statements together imply at
> least two representation roles, and the scoping of "primary" is not stated.
>
> Options, **none chosen**:
>
> 1. **Global per person** — one primary, everywhere.
> 2. **Per Campaign.**
> 3. **Per entitlement tier** — a primary generic appearance for viewers who do
>    not know the identity and a primary portrait for those who do, which is the
>    reading that makes [section 4](#4-person-representation-and-identity) work
>    without a second mechanism.
> 4. **Per Scenario or per play context.**
>
> Option 3 couples this decision to
> [OPEN-PPL-1](#open-ppl-1--how-identity-revelation-is-modelled).

**What was ruled**, quoted verbatim:

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

#### What V1 builds

This is **option 1, scoped explicitly to V1**. Read precisely, the ruling
defines **two distinct singleton selected roles plus an open set** — it is
**not** "one primary representation":

| V1 selection                    | Multiplicity per Person | Scope                |
| ------------------------------- | ----------------------- | -------------------- |
| **Selected primary portrait**   | **At most one**         | Global to the Person |
| **Selected general appearance** | **At most one**         | Global to the Person |
| **Additional illustrations**    | **Zero or more**        | Global to the Person |

- The two selected roles are **independent singletons**, not one slot with two
  possible fillers. A Person may have both, either, or neither.
- **Artifact visibility remains independent** of selection. Selecting an
  Artifact as the primary portrait neither reveals it nor publishes it; who may
  see it is governed by the separate visibility state that
  [Content authoring §3](content-authoring-scenario-preparation-and-artifact-management.md#3-one-artifact-system)
  keeps distinct.
- **No Campaign-, Scenario-, entitlement- or play-context-specific
  primary-selection system is built in V1.** A lane that finds itself designing
  one has exceeded this ruling and stops.

#### What is deferred, and is not foreclosed

Options 2, 3 and 4 are **deferred, not rejected**. The ruling defers "future
context-specific representation overrides ... until an actual product need
requires them". Applying the Product Owner's
[decision frontier](#151-the-decision-frontier), the V1 answer is required to be
**reasonably extensible, not hypothetically complete**:

- A future decision may still scope selection **per Campaign, per entitlement
  tier, or per Scenario/play context** without contradicting anything recorded
  here. The V1 answer is stated as the **global default selection**, and a later
  context-specific selection is the **override** of that default.
- Nothing in V1 may be built in a way that makes such an override a redesign of
  Artifact identity or of the association layer. The canonical Artifact
  Association layer in
  [Content authoring §4.1](content-authoring-scenario-preparation-and-artifact-management.md#41-the-canonical-artifact-association-layer)
  already carries a **typed target** and an **association role**, which is the
  extension point a future scoped override would use.
- Conversely, **V1 must not speculatively build the override mechanism**, a
  scope column, or a resolution-order rule for a scope that does not yet exist.

#### The coupling to OPEN-PPL-1, corrected

The original option 3 was coupled to
[OPEN-PPL-1](#open-ppl-1--how-identity-revelation-is-modelled), on the reading
that entitlement-tier-scoped selection was what made
[section 4](#4-person-representation-and-identity) work "without a second
mechanism". **That coupling is discharged for V1 and the reasoning is now
stale.** V1 satisfies section 4 through the **two distinct global roles** — a
selected general appearance and a selected primary portrait — combined with
**independent visibility**, rather than through tier-scoped selection. Which of
the two a given viewer receives is a **visibility/projection** question, which
is OPEN-PPL-1's concern and remains entirely open.

**OPEN-PPL-1 is neither answered, narrowed nor pre-empted here.** This ruling
decides _what may be selected and at what scope_; OPEN-PPL-1 still decides _how
revealed-ness is represented and which selection therefore projects to whom._

#### No collision with PO-SPW-1 or OPEN-PPL-6

- **[PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics)
  is unaffected.** "At most one selected primary portrait" is a constraint on
  **selection**, not on **association multiplicity**. A Person still carries
  zero, one or many Artifact associations, and PO-SPW-1's prohibition on a
  one-to-one pointer field stands unchanged. **A V1 implementation must not read
  "at most one" as licence for a one-to-one pointer.**
- **[OPEN-PPL-6](#open-ppl-6--where-generic-versus-specific-is-recorded) is
  unaffected and is the mechanism this ruling selects within.** OPEN-PPL-6
  already places contextual **role** on the association and intrinsic
  representation nature on the Artifact. This ruling names which roles V1
  supports; it does not move where role lives, and readiness remains
  **derived**.

### OPEN-PPL-10 — The authority model for player self-service Artifacts

**Status:** **Open — and DEFERRED. Not settled, not closed, no option
chosen.**\
**Deferral recorded on:** 2026-09-24\
**Authority for the deferral:** PRODUCT OWNER RULING, recorded on
[#284](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/284) and in
[Content authoring, Scenario preparation and Artifact management §18.10](content-authoring-scenario-preparation-and-artifact-management.md#1810-open-ppl-10-deferred-and-non-blocking).\
**Raised by:** #284 §6. **Affects:** lane C.\
**Gates:** **Nothing in current V1.** The deferral finding is that this decision
is **non-blocking for GM-controlled content authoring**. It still gates any work
that actually implements player self-service Artifact creation or management.

**What was ruled**, quoted verbatim:

> "**OPEN-PPL-10**: player self-service Artifact creation/management is future
> scope and does not block the current GM-controlled content-authoring
> implementation. Keep the future decision open/deferred until player
> self-service is actually prioritized."

**What this does and does not do.**

- It **does not choose** among the three options below. None is selected, none
  is ranked, none is rejected. The question is exactly as open as it was.
- It **does** find that player self-service Artifact creation/management is
  **future scope**, and that the current **GM-controlled** content-authoring
  implementation does **not depend on it**. Lane C's GM-controlled half is
  therefore not blocked by this decision.
- It **does** direct that the decision stay open and deferred **until player
  self-service is actually prioritized**, at which point it must be taken by the
  Product Owner. It is a permission decision and is not a Builder choice.
- A lane that reaches actual player self-service Artifact creation or management
  **stops and returns this decision to the Product Owner**, exactly as before.

#284 settles that players **should eventually** be able to upload and manage
permitted Artifacts for their own Characters. The authority by which they do so
is not settled, and
[Artifact Management PO-3](../architecture/artifact-management-package-import.md#po-3--player-artifact-creationsubmission)
deferred player creation from AM1.

Options, **none chosen, and preserved unranked**:

1. **A new ownership scope** — player-owned Artifacts, anticipated without
   redesigning Artifact identity by
   [AM §6.5](../architecture/artifact-management-package-import.md#65-future-extensibility).
2. **Submission through the review/authorization boundary** in
   [AM §21.5](../architecture/artifact-management-package-import.md#215-ai-and-player-authoring),
   so the GM accepts what a player proposes.
3. **A bounded direct-write permission** scoped to Artifacts attached to the
   player's own Character, with no authority over Campaign-owned material.

All three must preserve
[AM §9.2](../architecture/artifact-management-package-import.md#92-references-do-not-grant-view-rights)
and
[AM §6.4](../architecture/artifact-management-package-import.md#64-no-implicit-ownership-transfer).
This is a permission decision and is not a Builder choice.

### OPEN-PPL-11 — Where the post-play summary lives

**Status:** Open. **Raised by:** #284 §10. **Affects:** lane E.

#284 settles that a Scenario carries a post-play summary of what actually
happened, and that **plan and actual summary remain distinct**. It does not say
what the summary is.

Options, **none chosen**:

1. **A Scenario field** — free text the GM writes and edits.
2. **A projection of the existing event log**, generated rather than stored —
   which
   [PPV1 §9.4](../architecture/player-play-v1.md#94-the-existing-event-and-roll-model)
   would make the _one visible source of truth_ reading.
3. **A `CampaignNote` of a summary kind**, reusing the existing note and
   association substrate.
4. **A stored summary derived from Activity once and then editable**, which is
   the shape #284's "AI may later draft the post-play summary from Activity for
   GM review" most directly suggests.

Option 2 stores nothing and cannot be GM-edited. Options 1, 3 and 4 differ in
whether the summary is player-visible, which is a projection question under
[Authority and Information Projection](../architecture/information-authority-and-projection.md#projection-rules).

---

## 16. Proposed product-lane map

These are **proposals** returned for control-plane prioritization. **No lane
issue is created by this note, and no lane is authorized or dispatched.** Each
lane, when it reaches Ready, must be sized against then-current `dev`, must
declare its hotspots against
[functional ownership](../architecture/ownership.md#reserved-integration-hotspots),
and must carry its own acceptance examples.

Hotspot paths are recorded from the orientation survey in
[section 13](#13-existing-model-orientation) and are **sizing information, not an
exact-path contract**.

### Lane A — Canonical NPC / Actor authoring

**Covers:** #284 §1 (people model), §2 as it applies to NPC authoring.

|                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dependencies**                | Its own decision gate: [OPEN-PPL-2](#open-ppl-2--whether-actor-is-a-new-domain-entity) must be settled before Ready. [OPEN-PPL-4](#open-ppl-4--what-a-persistent-npc-record-is) is **settled (2026-09-23)** and no longer gates it. **No dependency on any Player Play slice** — this is GM authoring, and #268/PPV1 consume its output rather than gating it. Lanes B and E both depend on it.                                                                                                                                                                                                                                                                                                         |
| **Extends, does not duplicate** | The existing archetype/Actor surface (`apps/web/src/features/templates/TemplatesPageContent.tsx` ~2,348 lines, `apps/web/src/lib/templates/npcArchetypeTemplates.ts`, `apps/web/src/lib/campaigns/campaignActors.ts`); [Character lifecycle authority](../architecture/character-lifecycle-authority.md#authorities); the Campaign roster model; #227/[#236 Membership and Scenario surface](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/236). **Not** the retained GM Encounter workspace — [PO-SPW-3](../architecture/scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling) forbids new capability there. |
| **Data hotspots**               | Prisma schema and migrations (reserved): `ReusableEntity`, `ScenarioParticipant`, `CampaignRosterEntry`, `Character`. `packages/domain/src/campaign/scenario.ts` (`reusableEntitySchema`, `reusableEntityKindSchema`, `campaignRosterSourceTypeSchema`). `packages/database/src/services/campaignService.ts`, `campaignManagementService.ts`, `packages/database/src/repositories/scenarioRepository.ts`.                                                                                                                                                                                                                                                                                               |
| **API/UI hotspots**             | `apps/api/src/routes/scenarios/templateRoutes.ts`, `participantRoutes.ts`, `campaignRoutes.ts`. `apps/web/src/features/templates/TemplatesPageContent.tsx`, `apps/web/src/lib/api/campaignClient.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Settled**                     | PC and NPC share the full Character/rules model, differing only in control semantics; Template is a reusable archetype; Actor is the runtime/play instance and may come from either source; manual GM creation of full NPCs is needed; a lightweight/generic Actor path is needed; promotion is a **later** capability; one active Campaign per Character remains the V1 rule; [AI parity](#3-ai-parity-principle) applies to every authoring operation this lane creates.                                                                                                                                                                                                                              |
| **Still open**                  | [OPEN-PPL-2](#open-ppl-2--whether-actor-is-a-new-domain-entity), [OPEN-PPL-5](#open-ppl-5--what-actor-to-persistent-npc-promotion-preserves). [OPEN-PPL-4](#open-ppl-4--what-a-persistent-npc-record-is) is settled and is no longer in this list. Plus the _Actor_ terminology collision recorded in [section 2](#2-people-model).                                                                                                                                                                                                                                                                                                                                                                     |
| **QA class**                    | [Mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) if it changes persisted schema — which options 2 and 3 of OPEN-PPL-2 do. The settled OPEN-PPL-4 answer uses the existing nullable `Character.ownerId` for the absence of a player owner, but its supplementary managing-GM ruling forbids overloading `ownerId` and requires an explicit durable representation where none exists — so this lane may well add a persisted shape as well. Either way the Character-authority change it implies is security-relevant and carries the floor on that ground.                                                                                                                                       |

### Lane B — Person representation, identity reveal, Inspector and notes/dossier

**Covers:** #284 §3 (representation and identity), §4 (Person Inspector),
§5 (notes).

|                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dependencies**                | **Lane A** for a person record to attach to. **PPV1 P1 and P2** for the Inspector host surface — the Person Inspector is a specialization of [PPV1 §8.2](../architecture/player-play-v1.md#82-inspector) and **must not create a second Inspector**. **Lane C** for the representation association if a person's Artifacts use one mechanism with Items. [OPEN-PPL-1](#open-ppl-1--how-identity-revelation-is-modelled) and [OPEN-PPL-3](#open-ppl-3--where-the-campaign-scoped-gm-only-dossier-lives) must be settled before Ready.                                                                                                                                                                                                                                      |
| **Extends, does not duplicate** | [PPV1 §8.2](../architecture/player-play-v1.md#82-inspector) and [§13](../architecture/player-play-v1.md#13-canonical-detail-and-click-through-rule); [#268 §5](../architecture/scenario-play-workspace.md#5-presence-versus-visibility) and [§4.5](../architecture/scenario-play-workspace.md#45-reveal-and-share-are-two-different-operations); [Authority and Information Projection](../architecture/information-authority-and-projection.md#projection-rules); [Campaign Management V2 §8](../architecture/campaign-management-v2.md#8-artifact-and-image-inspection) for expandable presentation; **[#277](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/277) as the GM-private-field precedent** — reuse that pattern rather than inventing a second one. |
| **Data hotspots**               | Prisma schema and migrations (reserved). `packages/domain/src/campaign/scenario.ts` and `scenarioPlayerProjection`; `packages/domain/src/campaign/scenarioSession.ts`. `packages/database/src/services/campaignManagementService.ts`, `scenarioService.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **API/UI hotspots**             | `apps/api/src/routes/scenarios/participantRoutes.ts`, `scenarioRoutes.ts`, `access.ts`. `apps/web/app/(app)/campaigns/[campaignId]/CampaignWorkspaceShell.tsx` — shared with PPV1 P1/P2/P4/P5/P7 and #268 S1/S2; **one integration owner required**. `apps/web/src/features/scenarios/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Settled**                     | The Inspector exists and is generic; click-through routes to canonical homes; presence and visibility do not imply known identity; revelation does not replace the person; notes and history survive identification; both a generic appearance and a specific portrait are supported, and **V1 selection of each is a global singleton on the Person, with visibility independent** ([OPEN-PPL-9](#open-ppl-9--the-scope-of-a-selected-primary-representation)); the authorization tiers in [section 5](#5-person-inspector); the GM dossier is **structurally excluded** from player projections, search and context; shared notes are separate from the dossier; identity reveal is Reveal vocabulary, not Share.                                                       |
| **Still open**                  | [OPEN-PPL-1](#open-ppl-1--how-identity-revelation-is-modelled), [OPEN-PPL-3](#open-ppl-3--where-the-campaign-scoped-gm-only-dossier-lives), [OPEN-PPL-7](#open-ppl-7--the-audience-granularity-of-sharedplayer-notes). [OPEN-PPL-9](#open-ppl-9--the-scope-of-a-selected-primary-representation) is **settled for V1** (two global singleton roles — primary portrait and general appearance — plus zero or more additional illustrations, with visibility independent) and **no longer gates this lane**; only future context-specific overrides remain deferred.                                                                                                                                                                                                        |
| **QA class**                    | **[Mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) — privacy projection and persisted-data semantics.** This is the highest-risk lane in the map and the one the #271 defect class most directly threatens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### Lane C — Artifact association, PC self-service and the generic visual library

**Covers:** #284 §6 (Artifact/representation lifecycle), §7 (generic visual
library).

|                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dependencies**                | [PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics)'s association semantics, already settled and **binding on this lane**. [#278](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/278) should land with or before any widening of `CampaignItemArtifactAttachment`, since widening a link table with a known database-level scoping gap enlarges that gap. #268 S6 is the Item-side slice of the same association. **The former conjunctive gate on [OPEN-PPL-9](#open-ppl-9--the-scope-of-a-selected-primary-representation) and [OPEN-PPL-10](#open-ppl-10--the-authority-model-for-player-self-service-artifacts) before Ready is DISCHARGED for V1**: OPEN-PPL-9 is settled for V1, and OPEN-PPL-10 is deferred and non-blocking for GM-controlled content authoring. **No `OPEN-PPL-*` decision now blocks this lane's GM-controlled scope.** Two conditions survive as scope boundaries rather than gates: this lane must **not** build a Campaign-, Scenario-, entitlement- or play-context-specific primary-selection system, and it must **not** implement player self-service Artifact creation/management, which still returns [OPEN-PPL-10](#open-ppl-10--the-authority-model-for-player-self-service-artifacts) to the Product Owner. [OPEN-PPL-6](#open-ppl-6--where-generic-versus-specific-is-recorded) is **settled** and no longer gates this lane. |
| **Extends, does not duplicate** | [#268 S6](../architecture/scenario-play-workspace.md#slice-s6--item-attached-artifact-representation-and-blackboard-sharing); the [#119 Artifact Management contract](../architecture/artifact-management-package-import.md#1-status-and-scope); #278; [#239](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/239) for the index side. **PO-SPW-1 point 5 requires evaluating `CampaignItemArtifactAttachment` against the association semantics before reusing it**, and point 6 requires a dedicated link entity otherwise. Nothing in this map presumes that evaluation's outcome.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Data hotspots**               | Prisma schema and migrations (reserved): `CampaignItemArtifactAttachment`, `CampaignAsset`, `ScenarioArtifactReference`, `ArtifactRevision`. `packages/database/src/services/artifactService.ts` (~621 lines, holds `listVisible`). `packages/domain/src/campaign/artifact.ts` (`artifactCommonDtoSchema` — the field set PPV1 records as carrying no scenario scope).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **API/UI hotspots**             | `apps/api/src/routes/artifacts.ts`, `artifactImports.ts`. `apps/web/src/features/artifacts/ArtifactPanel.tsx`, `ArtifactDetails.tsx`, `OrdinaryArtifactUploadPanel.tsx`, `inspection/`. Campaign/Scenario Item routes and UI (reserved hotspot, shared with #268 S4/S5 and PPV1 P2/P7).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Settled**                     | PO-SPW-1's association semantics, including that a one-to-one pointer field is **not acceptable**; attaching transfers no ownership and an attached Artifact never becomes an Item; consumers reference stable identity; a reference does not grant view rights; **disassociation must not implicitly delete**; attach / edit metadata / replace media / change primary role / disassociate are all first-class; the **V1 role vocabulary for a Person** is a single selected primary portrait, a single selected general appearance and zero or more additional illustrations, **global to the Person**, with visibility independent — and **"at most one selected" is a selection constraint, never a licence for a one-to-one pointer**, which PO-SPW-1 still forbids; PCs as well as NPCs may carry Artifacts; generic library imagery is visibly distinct, pencil/sketch is the current convention, generic-versus-specific is recorded **as data**, and specific entities may fall back to generic imagery.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Still open**                  | **Nothing blocks this lane's GM-controlled V1 scope.** [OPEN-PPL-9](#open-ppl-9--the-scope-of-a-selected-primary-representation) is **settled for V1**, with per-Campaign / per-entitlement-tier / per-context overrides **deferred, not rejected**. [OPEN-PPL-10](#open-ppl-10--the-authority-model-for-player-self-service-artifacts) is **still open but deferred**, and is non-blocking here; the **PC self-service** half of this lane's title remains unauthorized and still stops on it. [OPEN-PPL-6](#open-ppl-6--where-generic-versus-specific-is-recorded) is now settled.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **QA class**                    | [Mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) — schema change, and player self-service is an authorization change. PO-SPW-1's [proofs 11 to 14](../architecture/scenario-play-workspace.md#14-verification-expectations-for-authorized-slices) apply directly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Lane D — AI parity, batch review and trusted bulk authoring

**Covers:** #284 §2 (AI parity), §8 (AI ingestion scale).

|                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dependencies**                | **[#279](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/279) must be settled first** for any tier that could apply a suggested visibility — it is the Reveal-boundary decision, and this note does not answer it. **Lanes A and C must precede the corresponding AI capability**, because [parity](#3-ai-parity-principle) requires the ordinary in-app path to exist; AI may not reach a canonical field humans cannot. [#277](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/277) is the outstanding parity repair from #271 and is arguably this lane's first item. [OPEN-PPL-8](#open-ppl-8--whether-the-review-tiers-are-new-modes-or-configurations) before Ready. |
| **Extends, does not duplicate** | [AI-assisted Artifact and Item intake](ai-assisted-artifact-intake.md) and #271; [AM §21.5](../architecture/artifact-management-package-import.md#215-ai-and-player-authoring), [§15 validation and import lifecycle](../architecture/artifact-management-package-import.md#15-validation-and-import-lifecycle), [§17.3 atomic acceptance](../architecture/artifact-management-package-import.md#173-atomic-acceptance) and [§17.4](../architecture/artifact-management-package-import.md#174-no-best-effort-partial-import); the advanced package **entry point**, which [stays unchanged](ai-assisted-artifact-intake.md#the-advanced-entry-point) and is not a separate pipeline.       |
| **Data hotspots**               | `packages/database/src/services/artifactService.ts`; the intake staging path; Prisma schema if a risk classification is persisted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **API/UI hotspots**             | `apps/web/src/features/artifacts/intake/` (`AiIntakePanel.tsx`, `intakeProposal.ts`); `apps/web/src/features/artifacts/ArtifactImportPanel.tsx`; `apps/api/src/routes/artifacts.ts`, `artifactImports.ts`. **Execution risk:** [#280](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/280) records `ArtifactImportPanel` test flakes under CI load in exactly this surface.                                                                                                                                                                                                                                                                                                        |
| **Settled**                     | The parity principle itself, as a constraint on every capability; the detailed staged GM review is **preserved** for consequential named/canonical content; batch review uses counts, validation, duplicate and unresolved-association reporting and sampled previews; trusted bulk intake is for low-risk generic visual/library material; **the same underlying in-app/domain operations remain authoritative at every tier**; today's intake creates everything GM-private and guesses nothing.                                                                                                                                                                                         |
| **Still open**                  | [OPEN-PPL-8](#open-ppl-8--whether-the-review-tiers-are-new-modes-or-configurations); and, as a pre-existing open issue rather than a new one, #279.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **QA class**                    | [Mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) for any tier that can make material player-visible. Ordinary independent QA for review-presentation-only work that provably cannot change visibility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Lane E — GM Campaign Material index and Scenario authoring/history

**Covers:** #284 §9 (GM Campaign Material), §10 (Scenario authoring and
history), §11 (Encounter).

|                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dependencies**                | **[#239](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/239) is the existing index lane** — extend it, do not open a parallel one. #227 is its parent and #236 is adjacent. **Lane A** for people to index, **lane C** for representations to preview. [OPEN-PPL-11](#open-ppl-11--where-the-post-play-summary-lives) before the history half is Ready; the index half is not gated on it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Extends, does not duplicate** | [Campaign Management V2 §6.1 Notes](../architecture/campaign-management-v2.md#61-notes) and [§6.2 index behavior and canonical homes](../architecture/campaign-management-v2.md#62-index-behavior-and-canonical-homes); [§7 creation and retrieval are separate user jobs](../architecture/campaign-management-v2.md#7-creation-and-retrieval-are-separate-user-jobs); [Campaign, Scenario and Encounter workflows](campaign-scenario-encounter-workflows.md#scenario-workspace); **the existing `CampaignNote` / `CampaignNoteAssociation` substrate**, which already indexes associations in both directions across campaign / scenario / encounter / character / npc / artifact / tag. [PPV1 §16](../architecture/player-play-v1.md#16-relationship-to-the-later-gm-surface) bounds how far a GM surface may go.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Data hotspots**               | Prisma schema and migrations (reserved): `Scenario` (which today has one `description` and no GM-private, player-framing or summary fields), `CampaignNote`, `CampaignNoteAssociation`. `packages/database/src/services/campaignManagementService.ts`; `packages/domain/src/campaign/campaignManagement.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **API/UI hotspots**             | `apps/api/src/routes/scenarios/scenarioRoutes.ts`, `campaignManagementRoutes.ts`. `apps/web/app/(app)/campaigns/[campaignId]/CampaignNoteEditor.tsx`, `CampaignNoteAssociations.tsx`, `CampaignDetailPageContent.tsx`, `CampaignHomeOverview.tsx`, `scenarios/[scenarioId]/ScenarioDetailPageContent.tsx`, and `CampaignWorkspaceShell.tsx` (reserved).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Settled**                     | **No general-purpose knowledge-management system**; a lightweight unified material index across People/NPCs, Items, Artifacts, Maps and Notes; organization primarily through semantic associations, navigable in both directions where useful; Scenario is the principal preparation and history container; **plan and actual summary remain distinct**; **an AI session summary may be produced only from the player-visible Activity projection, which is the complete player-safe narrative record** — the summary capability is _given_ that projection and nothing else, never richer Campaign or game state filtered afterwards ([section 11.2](#112-the-session-summary-source-rule--activity-is-the-only-source)); consequently **information is recap-eligible only once it has an appropriate player-visible Activity event or summary**, so GM planning text, unrevealed facts, private notes and chat, detailed mechanical calculations, suppressed bookkeeping, unpublished prepared announcements and **scene/framing text** are all out of source scope; AI may later _draft_ the summary, which the GM reviews and edits and then **explicitly publishes** as the Scenario's player-visible summary/history, the published text being **straightforward to copy manually** for email or other external communication; the four-way **GM plan / scene text / Activity / Scenario summary** distinction is preserved; **Encounter stays lightweight** and must not become a second rich authoring document; the GM Encounter workspace is retained as transitional tooling and receives no new player-facing capability ([PO-SPW-3](../architecture/scenario-play-workspace.md#po-spw-3--settled-the-existing-encounter-workspace-is-retained-as-transitional-gm-only-management-tooling)); scene text and prepared announcements are already settled/deferred by PPV1 and are **not** re-scoped here. |
| **Still open**                  | [OPEN-PPL-11](#open-ppl-11--where-the-post-play-summary-lives) — **unchanged and still unchosen**; the draft/review/publish workflow in [section 11.2](#112-the-session-summary-source-rule--activity-is-the-only-source) constrains the visibility transition, **not** the record that carries the summary, so this lane still stops and returns to the Product Owner on storage. Splitting Scenario's single `description` into GM-private planning text and player framing also inherits [OPEN-PPL-3](#open-ppl-3--where-the-campaign-scoped-gm-only-dossier-lives)'s structural-exclusion standard even though it is a different field.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **QA class**                    | [Mandatory QA floor](../../AGENTS.md#mandatory-qa-floor) once GM-private Scenario planning text exists — same class as the #271 defect — and equally for any AI summary-drafting capability, because the source restriction is a privacy projection and its proof is [section 17](#17-verification-expectations-for-lanes-authorized-from-here) item 2. The index half, if it only routes to canonical homes with existing permissions, is ordinary independent QA with perspective-sensitive checks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### 16.6 Lane dependency summary

```text
Lane A  canonical NPC / Actor authoring
   │        gate: OPEN-PPL-2, OPEN-PPL-5 (OPEN-PPL-4 settled)
   ├── Lane B  representation, identity reveal, Inspector, notes/dossier
   │        also needs: PPV1 P1 + P2 (Inspector host), Lane C (association)
   │        gate: OPEN-PPL-1, OPEN-PPL-3, OPEN-PPL-7 (OPEN-PPL-9 settled for V1)
   │                                                               — QA FLOOR
   └── Lane E  GM Campaign Material index + Scenario authoring/history
            extends #239 / #227; gate: OPEN-PPL-11

Lane C  Artifact association + PC self-service + generic visual library
         extends #268 S6 / #119; sequence with #278
         gate: NONE for the GM-controlled V1 scope               — QA FLOOR
               OPEN-PPL-6 settled; OPEN-PPL-9 settled for V1;
               OPEN-PPL-10 open but DEFERRED and non-blocking.
               Boundaries, not gates: no context-specific primary
               selection, and no player self-service Artifact
               creation/management (that half still stops on PPL-10).

Lane D  AI parity + batch review + trusted bulk
         follows the human path it must have parity with (A, C)
         blocked for visibility-applying tiers by #279
         gate: OPEN-PPL-8
         first item is arguably #277, the outstanding #271 parity repair
```

### 16.7 Sequencing and the portfolio constraint

**None of these lanes is scheduled by this note.** Two standing constraints
govern whenever they are:

1. [PPV1 §17.4](../architecture/player-play-v1.md#174-recommended-sequencing-and-the-portfolio-constraint)
   settles the first Player Play sequence as **P1 -> P2 -> playtest**, with P4
   later and alone. Lane B's Inspector work depends on P2 having landed and
   **must not displace or absorb it**.
2. The same section records that this class of UI work **must not silently
   displace the current playtest-foundation priorities**: Content V2 completion
   and #251/#252, Combat as a functional playtest loop, preserving the
   now-working Artifact intake, and infrastructure isolation (#264, #276, #280).
   That constraint applies to every lane above.

The cheapest genuinely useful items in this map, if the control plane wants one
now, are the ones that close an existing gap rather than opening a lane:
**#277** (the outstanding parity repair), **#279** (an open Product Owner
decision that lane D is blocked on), and **#278** (defence in depth on the
attachment lane C would widen). All three already exist as issues.

---

## 17. Verification expectations for lanes authorized from here

Expectations on those lanes when they are authorized. **They authorize no
implementation here.**

1. **The GM dossier is unreachable, not hidden.** A non-GM viewer never receives
   GM dossier text **in any payload**, including person projections, Situation
   rails, the Inspector, Activity, the material index, search results and any
   context assembled for AI. Prove it against the network payload, not the UI,
   and prove it against a record whose private text was written by a path that
   bypasses the normal mapper — the exact attack that found the #271 defect.
2. **A session-summary AI was given only Activity.** Prove the restriction in
   [section 11.2](#112-the-session-summary-source-rule--activity-is-the-only-source)
   at the point the context is **assembled**, not at the point the draft is
   read: capture the complete input handed to the model and show it contains
   nothing but the player-safe Activity projection. A test that only inspects
   the produced draft does not discharge this item. Prove additionally that a
   Scenario carrying GM planning text, an unrevealed NPC, an unpublished
   prepared announcement and scene text yields an input identical to the same
   Scenario without them, and that the drafted summary reaches no player before
   an explicit GM publication act.
3. **Identity revelation reveals only what was revealed.** Before revelation, a
   player receives neither the canonical name, the specific portrait, nor the
   detailed description — again in payload. After revelation, prior notes and
   history are intact and still attached to the same person.
4. **Notes survive identification.** Prove the round trip: accumulate notes
   against a generic presentation, reveal the identity, and show the notes are
   the same records.
5. **Disassociation destroys nothing.** Removing a representation leaves the
   Artifact, its revisions and its provenance intact and re-attachable.
   [#268 proofs 11 to 14](../architecture/scenario-play-workspace.md#14-verification-expectations-for-authorized-slices)
   apply unchanged to person representations.
6. **Parity is demonstrated, not asserted.** For every canonical field a lane
   lets AI write, show the ordinary in-app path that writes the same field, and
   show that AI reaches no canonical semantics the human path cannot.
7. **No tier changes meaning.** A batch or bulk tier produces objects
   indistinguishable, in canonical state, from the same objects created through
   detailed review. Prove it against persisted state.
8. **Intake still creates nothing before confirmation.** The
   [invariant](ai-assisted-artifact-intake.md#the-invariant) holds at every
   tier: abandoning a staged proposal leaves no partial object, no orphan
   Artifact and no retained bytes.
9. **Encounter stayed lightweight.** No lane added a rich authoring document to
   Encounter, and no new player-facing play capability entered the retained GM
   Encounter workspace.
10. **Vocabulary separation holds.** Identity revelation uses Reveal vocabulary;
    `share`, `place` and `placement` remain Blackboard vocabulary and name no
    visibility operation, per
    [#268 §4.5](../architecture/scenario-play-workspace.md#45-reveal-and-share-are-two-different-operations).
11. **Nothing settled elsewhere moved.** No lane narrowed or contradicted a
    #268 or Player Play V1 decision; where one appears to need to, it stops and
    returns to the Product Owner.
12. **V1 representation selection is exactly what was ruled.** A Person accepts
    **at most one** selected primary portrait and **at most one** selected
    general appearance, independently of each other, plus **any number** of
    additional illustrations; all three are **global to the Person**. Prove that
    changing a selection changes **no** visibility state and that changing
    visibility changes **no** selection. Prove additionally that **no
    Campaign-, Scenario-, entitlement- or play-context-scoped selection exists**
    — and that the association layer still permits a Person **zero, one or many**
    Artifact associations, so that "at most one selected" was not implemented as
    a one-to-one pointer, which
    [PO-SPW-1](../architecture/scenario-play-workspace.md#po-spw-1--settled-item-to-artifact-representation-requires-association-semantics)
    forbids.
