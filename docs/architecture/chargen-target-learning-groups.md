# Chargen Slice 3 — Target Learning Group Consumption

## 1. Status and scope

This is the final durable product/architecture contract for **Chargen Slice 3 — Target Learning Group Consumption** under Chargen #114.

It defines the product behavior required for Chargen to consume the approved target Learning Group catalogue.

It is not an implementation contract and does not define:

- current-file changes;
- APIs;
- migrations;
- persistence structures;
- Builder ownership;
- branch or SHA baselines;
- implementation verification steps.

The slice remains dependent on completion and stability of Slice 2 target competency identities.

---

## 2. Objective

Chargen shall consume the approved **59 target Learning Groups** instead of the legacy Learning Group catalogue, while preserving the established Chargen workflow and mechanics.

The governing transition is:

> **Target competencies and target Learning Groups become authoritative for new Chargen writes, while historical legacy Learning Group identities remain readable for compatibility.**

Slice 3 changes the content model consumed by Chargen.

It does not redesign:

- resource allocation;
- point pools;
- cost formulas;
- acquisition mechanics;
- other Chargen stages.

---

## 3. Target catalogue facts

The approved target Learning Group model contains:

- **59 Learning Groups**;
- **90 of 131 base Skills** belonging to one or more Learning Groups;
- **41 deliberately groupless base Skills**;
- **151 base-Skill memberships**;
- **9 explicit Specialization memberships**;
- preserved Pilot Learning Group links as provenance only.

These catalogue facts are controlling inputs.

Slice 3 must not:

- reopen the catalogue;
- fabricate additional groups to make the model symmetrical;
- eliminate intentionally groupless Skills;
- reconstruct the legacy catalogue inside the target model.

---

## 4. User-visible behavior

### 4.1 Existing Chargen workflow is preserved

The existing Chargen workflow remains in place.

Where Chargen exposes Learning Groups or uses Learning Group membership when determining valid training or expenditure, it shall consume the target catalogue rather than the legacy catalogue.

Slice 3 does not introduce a replacement Chargen flow.

### 4.2 Target Learning Group choices

New Chargen activity uses target Learning Group identities and names.

A target Learning Group may contain:

- base Skills;
- explicitly listed Specializations.

The player must be able to understand what each Learning Group contains before spending resources on it.

### 4.3 Complete pre-spend inspection

Before committing resources to a Learning Group, the player must be able to inspect its complete explicit membership:

- all base Skills;
- all explicitly included Specializations.

The normal selection surface need not display every membership inline.

A summary plus detail/inspection presentation is valid.

No particular UI widget or interaction pattern is prescribed by this contract.

The product requirement is:

> **The player can determine exactly what the Learning Group contains before committing resources.**

---

## 5. Groupless competency behavior

The **41 deliberately groupless base Skills are valid target content**.

A groupless competency:

- remains a valid competency;
- remains discoverable wherever ordinary competency selection permits;
- may be acquired through any applicable general or direct route already allowed by Chargen;
- does not require synthetic Learning Group membership.

Slice 3 must not create artificial one-Skill Learning Groups merely to make all Skills grouped.

Groupless status is intentional catalogue semantics, not an incomplete-data condition.

---

## 6. Overlap and membership semantics

### 6.1 Overlap is valid

A competency may belong to more than one Learning Group.

This creates multiple legitimate routes to the same competency identity.

It does not create:

- duplicate competencies;
- duplicate competency levels;
- duplicate purchases;
- automatic stacking of benefits.

### 6.2 Unique competency identity

A Skill or Specialization has one canonical target competency identity regardless of how many Learning Groups contain it.

Learning Groups reference competencies; they do not instantiate copies of them.

### 6.3 Membership is not acquisition

Learning Group membership means that the competency belongs to the group for Chargen training/access purposes.

Membership does not itself:

- grant the competency;
- grant a level;
- grant XP;
- grant additional points;
- constitute expenditure.

Acquisition continues through existing Chargen mechanics.

### 6.4 Martial Learning Group structure

Chargen must consume the approved martial Learning Group structure as authored.

This includes the already approved principles that:

- close-combat groups may contain Dodge + Parry + weapon competency;
- military groups may legitimately be broader;
- ranged groups may compose with close-combat groups;
- overlap is acceptable;
- unnecessary one-Skill martial wrapper groups are not required.

The implementation must not recreate legacy group topology merely because it is easier for old assumptions.

---

## 7. Specialization membership

Specialization membership is explicit.

The approved **9 Specialization memberships** must be represented as such.

The following invariants apply:

- membership of a base Skill does not automatically include its Specializations;
- membership of one Specialization does not include sibling Specializations;
- Specialization membership does not propagate unless the approved catalogue explicitly says so.

Base-Skill membership and Specialization membership are therefore distinct content relationships.

---

### LG-11 — Learning Group membership does not bypass Specialization eligibility

Explicit membership of a Specialization in a Learning Group creates the approved Learning Group training/access route to that Specialization. It does not waive the Specialization's independently applicable eligibility requirements, including the approved immediate-parent threshold, unless an existing separately approved Chargen rule explicitly provides otherwise.

Preserve nested Specialization parentage.

Example: Falconry → Animal Training → Animal Handling.

Learning Group membership of Falconry does not flatten or bypass that parent chain.

This is a clarification of already-approved Chargen/Specialization semantics, not a new mechanics change.

## 8. Point and cost invariants

### 8.1 Existing point pools remain authoritative

Slice 3 introduces no new point pool.

Existing Chargen resource pools retain their current sizes and purposes unless separately superseded by a later approved decision.

### 8.2 Existing cost rules remain authoritative

Slice 3 does not introduce a new Learning Group cost model.

Existing cost rules continue to apply using the target membership graph.

### 8.3 Multiple routes do not multiply benefits

If the same competency is reachable through multiple groups or through another valid Chargen route, the character still has one competency identity.

Multiple routes must not automatically:

- discount the purchase repeatedly;
- grant multiple purchases;
- create duplicate expenditure;
- produce additional levels.

The existing applicable cost/resource mechanics remain controlling.

### 8.4 Pilot provenance is non-mechanical

Pilot links remain provenance only.

They do not provide:

- entitlement;
- acquisition;
- additional training access;
- discount;
- resource benefit.

---

## 9. General/unbound availability boundary

Slice 3 consumes the target Learning Group catalogue in a **general/unbound context**.

Pending or provisional availability information relating to:

- Setting;
- Society;
- Arch Society;
- Social Band;
- Civilization;
- geography;
- period;

must not filter target Learning Groups during Slice 3 unless a separately approved existing mechanic independently requires such behavior.

In particular:

> **Absence of finalized contextual availability is not equivalent to unavailability.**

Slice 3 must not invent Setting/Society applicability.

Later contextual availability work may constrain target content after that architecture is approved.

---

## 10. Legacy compatibility

### 10.1 Shared compatibility principle

The governing principle is:

> **Target content is authoritative for new Chargen writes; legacy identities remain readable for historical compatibility without retroactive repricing or forced semantic migration.**

### 10.2 Historical state remains valid

Persisted historical state using legacy Learning Groups must remain readable.

Slice 3 must not:

- recalculate historical expenditure;
- grant or remove competency levels retrospectively;
- reinterpret old costs through the target catalogue;
- silently convert a non-equivalent legacy identity into a target Learning Group.

### 10.3 Historical group names

Where a persisted historical state references a non-equivalent legacy Learning Group and the group is user-visible:

- preserve and display its actual historical group name;
- identify it as legacy/historical where useful;
- preserve historical identity and provenance;
- do not silently rename it as a target group.

Where an exact target successor exists, the UI may additionally expose that successor relationship.

The historical identity remains recoverable.

### 10.4 New writes

After Slice 3 activation:

- new Learning Group selections use target Learning Groups;
- new target Chargen writes do not create legacy-group references;
- the legacy catalogue is not a parallel active source of new Chargen choices.

Legacy material may remain as:

- read compatibility data;
- mapping data;
- historical provenance;
- narrowly required compatibility fixtures.

### 10.5 Incomplete legacy Chargen

Default behavior for incomplete historical drafts is:

- previously made legacy selections remain valid;
- prior expenditure remains valid;
- legacy-only groups remain readable;
- all new Learning Group selections use target Learning Groups.

An incomplete draft does **not** by itself justify continued general selection from the legacy catalogue.

Exception:

If activation-time evidence demonstrates that real persisted incomplete drafts cannot safely be completed without additional legacy-group selection, a narrowly scoped legacy-completion mode may be retained for those specific drafts.

Such a mode must not be designed speculatively.

It is compatibility behavior, not a second active catalogue.

### 10.6 Compatibility implementation is activation-time work

The exact compatibility mechanism depends on real persisted data and remains an activation-time implementation decision.

This contract defines required outcomes, not storage or migration machinery.

---

## 11. Resolved PO decisions

### PO-LG-1 — Legacy group labels

**Resolved.**

Historical legacy group identity must be preserved and shown where user-visible.

Exact target-successor relationships may additionally be shown.

Non-equivalent historical groups must never be silently renamed into target groups.

### PO-LG-2 — Membership presentation

**Resolved.**

The player must be able to inspect complete Learning Group membership before spending resources.

A summary/details presentation is sufficient.

No specific UI widget is mandated.

### PO-LG-3 — Incomplete legacy Chargen

**Resolved.**

New selections use target groups.

Historical choices remain valid and readable.

A narrowly scoped legacy-completion mode is permissible only if real activation-time persisted data proves it necessary.

---

## 12. Acceptance examples

### Example 1 — Ordinary target group

A target Learning Group contains five base Skills.

Before spending resources, the player can inspect all five.

Selecting or using the group applies existing Chargen resource and cost rules.

No Skill level is granted merely because the Skill is a group member.

### Example 2 — Martial group

A close-combat Learning Group contains:

- Dodge;
- Parry;
- an approved weapon competency.

Chargen consumes this group directly.

It does not break the group into legacy-style wrappers.

### Example 3 — Overlapping membership

A Skill belongs to two target Learning Groups.

Both groups correctly show that Skill.

The Character still has only one Skill identity and one resulting Skill state.

### Example 4 — Groupless Skill

A base Skill is one of the 41 deliberately groupless Skills.

The Skill remains valid and available through otherwise applicable competency-selection routes.

No synthetic Learning Group is created for it.

### Example 5 — Explicit Specialization

A target Learning Group includes one particular Specialization.

That Specialization is part of the group.

Other Specializations beneath the same base Skill are not implicitly members.

### Example 6 — Provisional availability metadata

A Learning Group carries source metadata suggesting relevance to a particular Society or Setting.

Generic Slice 3 Chargen does not filter the group on that basis.

### Example 7 — Historical legacy group

An existing Character references a non-equivalent legacy Learning Group.

The Character remains readable.

The historical group name remains identifiable.

The group is not silently relabeled as a target Learning Group.

### Example 8 — Incomplete legacy draft

An incomplete historical Chargen draft already contains one legacy group purchase.

That purchase remains valid.

A subsequent new group selection uses the target catalogue.

The system does not expose the whole legacy catalogue merely because the draft is old.

---

## 13. Exclusions

Slice 3 does not redesign or decide:

- stats;
- rolled profile;
- Civilization selection;
- Social Band mechanics;
- point-pool sizes;
- existing cost formulas;
- Profession mechanics;
- advancement after Chargen;
- XP;
- Campaign Setting inheritance;
- final Society availability;
- final Arch-Society availability;
- final Setting availability;
- broad Character migration;
- Learning Group catalogue content;
- competency catalogue content;
- post-Chargen training mechanics.

It does not create a new Learning Group authoring or management subsystem.

---

## 14. Prerequisites

Slice 3 must not activate before:

1. Slice 2 has established stable target competency identities.
2. The approved target Learning Group catalogue is available in machine-consumable form.
3. That content includes:
   - stable Learning Group identities;
   - base-Skill memberships;
   - explicit Specialization memberships;
   - retained provenance as required.
4. Existing Chargen resource and cost behavior is sufficiently characterized to preserve it.
5. Legacy Learning Group identities actually present in persisted state can be identified for compatibility purposes.
6. Activation-time implementation planning can distinguish:
   - exact target successors where they genuinely exist;
   - non-equivalent historical legacy identities.

Pending proposals or legacy tables must not be used to bypass the dependency on stable target competency identities.

---

## 15. Remaining Product Owner decisions

**None material at the product/architecture level.**

Compatibility mechanics, persistence technique and any narrowly required legacy-completion mechanism remain activation-time implementation decisions based on real persisted data rather than unresolved product decisions.

# Final status

**Chargen Slice 3 — product architecture Ready**

The durable contract is complete.

Implementation remains dependency- and activation-gated.

## Publication authority and forward pipeline

Product Owner approved, 16 September 2026. Portfolio #114 remains **Active**. Current/preceding work: Slice 2 Target Competencies; next prepared milestone: Slice 3 Target Learning Groups; following prepared milestone: Slice 4 Target Professions.

**Slice 2 — Target Competencies → Slice 3 — Target Learning Groups → Slice 4 — Target Professions → later #113 contextual availability / Setting-sensitive Chargen.**

Slice 3 requires stable/integrated Slice 2 competency identities. Slice 4 requires stable/integrated Slice 3 Learning Group identities and membership semantics. Legacy content and pending proposals cannot bypass this chain.

Both contracts are product architecture Ready; neither is Active implementation, Authorized or Integrated by this documentation publication. A separate control-plane order must authorize activation preflight. No Builder/QA dispatch, implementation, migrations or runtime changes are authorized here.

Both slices consume approved target content in general/unbound context. Unfinished Setting, Society, Arch-Society, Social-Band, geography, period and context bindings remain non-operative. Later #113 contextual availability may constrain the target model only after completion and separate activation. The Social Band step remains, but its legacy Profession filter must not restrict the 84 target Professions.

Target content is authoritative for new writes; legacy identities remain readable without retroactive repricing, retrospective competency-level changes, forced semantic migration or a competing full legacy catalogue. Compatibility details await separately authorized activation-time inspection of real persisted data.

Related approved contracts: [target Learning Groups](chargen-target-learning-groups.md), [target Professions](chargen-target-professions.md), and [Profession provenance/availability](profession-provenance-availability.md).
