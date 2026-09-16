# Chargen Slice 4 — Target Profession Consumption

## 1. Status and scope

**Current execution:** issue #206 implements Learning Groups and Professions together after integrated Slice 2. The combined milestone below and the current #206 PO rulings supersede earlier sequential activation and speculative legacy-completion wording. Independent acceptance and integration remain separate gates.

This is the final durable product/architecture contract for **Chargen Slice 4 — Target Profession Consumption** under Chargen #114.

It defines how the approved target Profession catalogue becomes the Profession content consumed by Chargen.

It is not an implementation contract and does not define:

- APIs;
- migrations;
- persistence structures;
- implementation files;
- branch or SHA baselines;
- Builder or QA work.

Slice 4 is downstream of both target competencies and target Learning Groups.

---

## 2. Objective

Chargen shall consume the approved target Profession catalogue and its explicit training/access opportunities without redesigning Chargen resource mechanics.

The approved target Profession model contains:

- **84 Profession families**;
- first-class Profession **variants/tracks**;
- **115 Profession → Learning Group opportunities**;
- **88 direct competency-training opportunities**.

The governing semantic rule is:

> **A Profession package defines explicit training/access opportunities. It does not automatically grant competencies, XP, points or levels.**

Target Profession content becomes authoritative for new Profession-related Chargen writes.

---

## 3. Family and variant/track identity model

### 3.1 Profession family

A Profession family is the durable conceptual identity grouping related professional paths.

It may contain:

- family-level description/context;
- family-common training/access opportunities;
- one or more concrete variants/tracks.

### 3.2 Variant/track

Variants/tracks are first-class Profession identities.

They are not:

- free-text annotations;
- presentation aliases;
- informal labels attached to a family.

Where the approved catalogue defines tracks, track identity must survive:

- selection;
- persistence;
- later display.

### 3.3 Selectable identity

Where a family has no variants/tracks, the family itself may be the concrete selectable Profession.

Where a family has variants/tracks, the concrete selected identity is the actual chosen track unless the approved catalogue explicitly defines a generic family-level choice.

A family with tracks does not gain a phantom generic track.

### 3.4 User understanding

Before commitment, the user must clearly understand:

- which Profession family is involved;
- which concrete variant/track is being selected.

The UI may implement this as:

- family → track selection;
- a grouped single list;
- another presentation preserving both identities.

No specific widget is required.

The selected track identity must be unambiguous.

---

## 4. Family-common versus track-specific opportunities

Profession packages may contain explicit opportunities at both levels.

### 4.1 Family-common opportunities

An opportunity defined as family-common applies to the concrete tracks of that family because the catalogue explicitly defines it as common.

Family-common opportunities may include:

- Learning Group opportunities;
- direct competency opportunities.

### 4.2 Track-specific opportunities

A track may define additional:

- Learning Group opportunities;
- direct competency opportunities.

Those opportunities belong only to that track unless explicitly declared otherwise.

### 4.3 No inferred inheritance

Similarity between tracks does not imply shared opportunities.

The effective package of a selected track is:

> **explicit family-common opportunities + explicit opportunities of the selected track**

No additional package contents may be inferred merely for balance, symmetry or convenience.

---

## 5. Learning Group versus direct competency routes

Two distinct canonical opportunity types exist.

### 5.1 Learning Group opportunity

A Profession may provide access/training through a target Learning Group.

The referenced Learning Group remains the same canonical Learning Group consumed by Slice 3.

The Profession does not create its own copy.

The player must be able to inspect that Learning Group's membership through the Slice 3 inspection model.

### 5.2 Direct competency opportunity

A Profession may provide a direct training/access route to a specific target competency.

Direct competency routes are first-class catalogue relationships.

They must not be transformed into synthetic Learning Groups merely to normalize the model.

### 5.3 Route convergence

A competency may be reachable:

- through a Profession Learning Group;
- directly through the Profession;
- through more than one Profession-related Learning Group;
- through another general Chargen route.

All routes resolve to the same canonical target competency identity.

Route multiplicity does not create duplicate competency state.

---

## 6. Package-as-access semantics

A Profession package means:

> **these are the training/access opportunities made available through this Profession under existing Chargen mechanics.**

Package membership does not itself mean:

- compulsory training;
- a free Skill;
- a free Specialization;
- a fixed starting competency;
- a fixed competency level;
- choose-N;
- minimum purchases;
- mandatory package completion;
- Profession XP;
- extra points;
- an additional resource pool.

These mechanics are **not part of Slice 4**.

Any future mandatory or package-completion mechanic requires a separate Product Owner decision.

### 6.1 Asymmetry is valid

Profession packages do not need equal:

- numbers of Learning Groups;
- numbers of direct competency opportunities;
- package breadth;
- specialization;
- family complexity.

Chargen must consume packages as authored.

It must not normalize professions for balance or symmetry.

---

## 7. Resource and cost behavior

### 7.1 Existing resource mechanics remain authoritative

Slice 4 creates no new resource pool.

Existing Chargen resource mechanics remain in force.

### 7.2 Existing point-pool sizes remain unchanged

Slice 4 does not enlarge or shrink existing pools.

### 7.3 Existing cost formulas remain unchanged

Profession content affects valid access/training routes.

It does not redefine cost formulas.

### 7.4 Multiple routes do not stack automatically

Where multiple valid routes reach the same competency, they do not automatically produce:

- multiple competency entries;
- multiple levels;
- multiple purchases;
- cumulative discounts;
- cumulative grants.

The existing Chargen cost/resource rules determine the effective mechanical result.

### 7.5 Profession-selection cardinality is preserved

Slice 4 does not decide how many Professions a Character may select.

The existing Chargen rules governing Profession-selection cardinality remain authoritative unless separately superseded.

---

## 8. Package inspection

Before committing to a Profession or track, the player must be able to inspect the **full explicit training/access package**.

This includes:

- family-common Learning Group opportunities;
- family-common direct competency opportunities;
- track-specific Learning Group opportunities;
- track-specific direct competency opportunities.

A Learning Group opportunity must in turn expose its complete membership through the Slice 3 inspection behavior.

The product requirement is:

> **The material training/access consequences of choosing a Profession or track must be understandable before the player commits to it.**

The architecture does not prescribe a specific UI widget or layout.

---

## 9. General/unbound Profession availability

Slice 4 uses the target Profession catalogue in a **general/unbound Profession context**.

Target Profession availability by:

- Setting;
- Society;
- Arch Society;
- Social Band;
- geography;
- historical context;

is not yet canonically finalized.

Therefore provisional availability annotations have no gating effect in Slice 4.

The absence of an approved contextual availability rule means:

> **not yet restricted by that contextual layer**

rather than:

> **unavailable**

Later #113 Profession availability and Setting/context work may constrain the target catalogue without redefining Profession identity or package contents.

---

## 10. Social Band and legacy-filter boundary

The **Social Band step remains part of the existing Chargen workflow**.

Slice 4 does not redesign Social Band.

Accordingly:

- Social Band continues to be established as it is in the existing workflow;
- target Profession consumption does not require completion of the later #113 contextual availability work;
- unfinished target Profession availability by Social Band is not enforced in generic/unbound Slice 4.

Critically:

> **The legacy Profession availability/filter table must not be used to filter the 84 target Professions in generic/unbound Slice 4.**

Legacy:

- Society restrictions;
- Social-Band restrictions;
- legacy Profession filter mappings;

must not accidentally become restrictions on the target catalogue.

This boundary is deliberate.

The target catalogue and the legacy availability table represent different generations of content architecture.

Later #113 availability/Setting work may legitimately constrain target Professions after those contextual rules are approved.

---

## 11. Legacy compatibility

### 11.1 Shared compatibility principle

The governing compatibility principle is:

> **Target content is authoritative for new Chargen writes; legacy identities remain readable for historical compatibility without retroactive repricing or forced semantic migration.**

### 11.2 Historical Profession state

Persisted Characters using historical legacy Profession identities must remain readable.

Slice 4 must not:

- recalculate historical expenditure;
- grant new competencies retrospectively;
- remove historical competencies;
- change historical point expenditure;
- silently reinterpret an old Profession through a non-equivalent target package.

### 11.3 Historical Profession names

For a persisted historical legacy Profession:

- preserve the historical Profession name as the historical identity;
- preserve recoverable historical provenance;
- do not silently rewrite the Character as if it always held the target Profession.

Where an exact target successor exists, the UI may additionally show:

- the target successor;
- an alias/successor relationship.

The historical identity itself remains recoverable.

### 11.4 Exact and non-equivalent mappings

An exact compatibility relationship may be exposed where the legacy Profession genuinely has an exact target successor.

A non-equivalent Profession must not be automatically mapped to a “closest” target Profession merely to remove legacy state.

### 11.5 New writes

After Slice 4 activation:

- new Profession writes use target Profession identities;
- target family/track identities are persisted as appropriate;
- new target writes do not create legacy Profession references.

The full legacy Profession catalogue does not remain an active competing authoring source.

### 11.6 Incomplete historical Chargen

Default behavior is:

- preserve historical Profession selections;
- preserve historical expenditure;
- do not unpredictably mix old legacy-package semantics with target-package semantics;
- new Profession writes use target Profession identities and opportunities.

An incomplete historical draft does not justify keeping legacy Profession selection generally active.

Exception:

For #206, preserve historical draft identities and recorded spending for reading. Personal drafts remain unverified and nonblocking; no legacy-completion mode or additional legacy choices is authorized.

Such a mode must not be built speculatively.

It remains compatibility behavior rather than a second active Profession catalogue.

### 11.7 Compatibility mechanism deferred

Exact compatibility mechanics remain an activation-time implementation concern based on real persisted data.

The durable requirement is behavioral compatibility, not a prescribed migration or storage strategy.

---

## 12. Resolved PO decisions

### PO-PROF-1 — Legacy Profession presentation

**Resolved.**

The historical Profession name remains the historical identity.

An exact target successor relationship may additionally be displayed.

Historical provenance remains recoverable.

### PO-PROF-2 — Family/track presentation

**Resolved.**

The player must clearly understand both:

- Profession family;
- concrete selected track where applicable.

No particular UI widget is mandated.

No phantom generic track may be created.

### PO-PROF-3 — Package inspection

**Resolved: YES.**

The full explicit package must be inspectable before Profession/track commitment.

This includes family-common and track-specific opportunities of both route types.

### PO-PROF-4 — Mandatory / choose-N package semantics

**Resolved: not part of Slice 4.**

Current Profession relationships represent available training/access opportunities only.

They do not imply:

- compulsory training;
- grants;
- choose-N;
- minimum spending;
- package completion;
- Profession XP;
- extra resources.

### PO-PROF-5 — Incomplete legacy Chargen

**Resolved.**

New Profession writes use target identities.

Historical choices and expenditure are preserved.

No speculative legacy-completion behavior is authorized in #206; use isolated synthetic compatibility fixtures.

---

## 13. Acceptance examples

### Example 1 — Profession with no tracks

A Profession family has no approved variants.

The family itself may be selected as the Profession identity.

Its explicit package is inspectable before selection.

### Example 2 — Profession family with tracks

A Profession family has three tracks.

The player can distinguish the family from the three concrete tracks.

Selecting one track persists that track identity.

Chargen does not invent a fourth generic track.

### Example 3 — Family-common opportunities

A family defines:

- two common Learning Groups;
- one common direct competency.

One specific track adds:

- another Learning Group;
- two additional direct competencies.

Selecting that track exposes the explicit union of those family-common and track-specific opportunities.

Another track does not inherit the first track's specific opportunities.

### Example 4 — Direct groupless competency

A Profession contains a direct training/access opportunity to one of the 41 groupless Skills.

The Skill is available through the direct Profession route.

No synthetic Learning Group is created.

### Example 5 — Package inspection

Before selecting a track, the player can inspect:

- all common Learning Groups;
- all common direct competencies;
- all track-specific Learning Groups;
- all track-specific direct competencies.

Each Learning Group can itself be inspected for full Skill/Specialization membership.

### Example 6 — Package is not a grant

A Profession package contains three Learning Groups and four direct competencies.

Selecting the Profession grants no competency level automatically.

The player still uses existing Chargen points/resources and cost rules.

### Example 7 — Multiple paths to one competency

One competency appears:

- directly in the Profession package;
- inside one of the Profession's Learning Groups.

Chargen treats both as routes to one target competency identity.

It does not create two copies or two automatic benefits.

### Example 8 — Unequal packages

Profession A exposes more Learning Groups than Profession B.

Profession B instead has several narrow direct competency opportunities.

Both packages remain as approved.

Chargen does not equalize them.

### Example 9 — Social Band exists, target filter does not

The existing Chargen workflow establishes Social Band.

The player then reaches target Profession selection.

Because target Social-Band Profession availability is not yet approved, the old legacy availability table does not filter the 84 target Professions.

### Example 10 — Provisional Profession availability

A target Profession has provisional source annotations suggesting relevance to a particular Society.

Generic Slice 4 Chargen does not enforce those annotations as availability restrictions.

### Example 11 — Historical legacy Profession

An existing Character holds a legacy Profession with no exact target successor.

The historical Profession remains displayed and recoverable.

The Character is not silently rewritten into a target Profession.

### Example 12 — Exact successor

An old Profession has an exact target successor.

The interface may show the successor relationship while still preserving the Character's historical Profession identity.

---

## 14. Exclusions

Slice 4 does not redesign or determine:

- stats;
- rolled profile;
- Civilization selection;
- Social Band mechanics;
- point-pool sizes;
- existing cost formulas;
- advancement after Chargen;
- XP;
- Campaign Setting inheritance;
- final Society availability;
- final Arch-Society availability;
- final Setting availability;
- broad Character migration;
- post-Chargen Profession changes;
- Profession catalogue content;
- Learning Group catalogue content;
- competency catalogue content;
- new Profession-specific point pools;
- mandatory Profession packages;
- choose-N package mechanics;
- fixed starting competency grants.

The Social Band step remains, but target Profession availability by Social Band is explicitly deferred.

---

## 15. Prerequisites

Slice 4 must not activate before:

1. **Slice 2 target competency identities are stable.**
2. **Slice 3 target Learning Group identities and membership semantics are stable.**
3. The approved target Profession catalogue is available in machine-consumable form with stable identities for:
   - 84 Profession families;
   - all approved variants/tracks;
   - family/track relationships.
4. The catalogue explicitly distinguishes:
   - family-common opportunities;
   - track-specific opportunities.
5. Opportunity route type is explicit:
   - Learning Group; or
   - direct competency.
6. The approved:
   - 115 Profession → Learning Group opportunities;
   - 88 direct competency-training opportunities;
     are available as target content.
7. Existing Chargen Profession-related resource/cost behavior is sufficiently characterized to preserve it.
8. Legacy Profession identities actually present in persisted state can be identified for compatibility handling.
9. Activation planning can distinguish exact successor relationships from non-equivalent historical identities.
10. Provisional availability metadata can be kept non-operative rather than accidentally interpreted as canonical filtering.

Pending proposals, provisional availability material or legacy Profession tables must not be used to bypass these dependencies.

---

## 16. Remaining Product Owner decisions

**None material at the product/architecture level.**

Future decisions remain intentionally outside Slice 4, particularly:

- mandatory Profession training;
- choose-N structures;
- fixed starting grants;
- Profession-specific resource mechanics;
- contextual Profession availability under #113.

Those are future product decisions, not unresolved parts of this contract.

# Final status

**Chargen Slice 4 — product architecture Ready**

The durable contract is complete.

Combined implementation is authorized under #206; acceptance and integration remain gated by its current executable contract.

The current sequence is integrated Slice 2 → combined target Learning Groups and Professions (#206) → later #113 contextual availability / Setting-sensitive Chargen.

Neither Slice 3 nor Slice 4 may use legacy tables or pending proposal content to bypass these dependencies.

## Combined implementation milestone — issue #206

PO ruling 6056 authorizes combined target Learning Group and Profession consumption after integrated Slice 2. The former sequential Slice 3 then Slice 4 activation plan is superseded. Issue #206 owns the executable baseline, implementation, verification and independent acceptance gates; this document does not claim integration.

Profession opportunities default to additive family-level access menus. Only explicit source-defined complete tracks are selectable identities. Ambiguous alternative/additional apprenticeship wording does not imply exclusivity, and review-ledger facets are not canonical tracks. Selection grants no competencies or resources. Section G military compositions preserve their separate melee, ranged and mounted courses.

Target group access requires an approved Profession route. Flexible funds can pay an accessible group but do not create entitlement. Group prices include only base-Skill members under the existing formula. Explicit Specializations are access-only, bought separately for 4 initially and 2 per increase, with normal immediate-parent eligibility.

Generic/unbound choices do not inherit legacy Society or Social Band filters. #113 contextual availability remains unfinished and inactive. Personal browser drafts are unverified and nonblocking; isolated synthetic historical fixtures establish compatibility without speculative legacy-completion or personal-storage inspection.
