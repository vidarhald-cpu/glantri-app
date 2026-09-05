# Rule decision 0003: Skill documentation and release integrity

- Status: approved
- Date: 2026-09-04
- Product owner: Glantri product owner/control plane
- Related Forgejo issues: [#22](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/22),
  [#23](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/23),
  [#24](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/24),
  [#25](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/25),
  [#26](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/26), and
  [#27](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/27)
- Related decisions: [`0002-skill-catalogue-qualitative-architecture.md`](./0002-skill-catalogue-qualitative-architecture.md)
- Related rules: [`pilot-skill-rules-v1.md`](../../rules/pilot-skill-rules-v1.md), [`pilot-skill-content-release-v1.md`](../../rules/pilot-skill-content-release-v1.md), and [`retained-character-ledger.md`](../../rules/retained-character-ledger.md)
- Supersedes: none
- Superseded by: none

## Question

What canonical content, documentation, integrity, authoring, and Admin-reference
contract must the bounded Pilot Skill set prove before Glantri scales the model to
the full usable Skill Catalogue?

## Evidence and provenance

The accepted qualitative Skill architecture separates competence-bearing Skills
and Specializations from navigation-only domains and categories. Pilot Skill
Rules v1 supplies bounded quantitative behavior, while Pilot Skill Content
Release v1 and the retained-Character ledger prove versioned content and
historical interpretation. The current legacy catalogue and Admin Skills pages
remain compatibility evidence; they are not the intended future authority.

The product owner reviewed the surviving content model and Admin presentation on
2026-09-04 and approved the rulings below. The accompanying
[Skills product roadmap](../../product/skills-product-roadmap.md) records the
delivery sequence. These decisions do not change the existing Pilot arithmetic
or authorize product implementation.

## Conflict or limitation

The integrated release `content-release:pilot-skills:1` proves mechanics and
validation, but many records use bounded fixture descriptions and do not yet
provide production-quality short and full documentation. Its one package digest
does not distinguish editorial-only changes from mechanically meaningful
changes. The legacy catalogue contains useful evidence and prose but mixes older
identities and runtime assumptions that cannot become canonical by copying.

A separately maintained prose database would create two sources of truth. An
Admin editor would also introduce mutable workflow and publication authority
before the Pilot model has been accepted. Neither is appropriate for this phase.

## Ruling

### Canonical record documentation

Every Pilot Skill, spoken language, written tradition, and Specialization must
carry these required fields in canonical versioned content:

- `name`;
- `shortLabel`, which may equal `name` when abbreviation adds no value;
- `shortDescription`;
- a substantive `description`; and
- a canonical structured `taskEnvelope`.

The task envelope is scope and boundary authority. Prose explains that authority
in useful product language but must not hide, contradict, or create mechanics.
The concise description is suitable for repeated list, Chargen, Character Sheet,
and tooltip presentation; the substantive description explains practical scope,
important boundaries, and distinctions for reference readers.

### Domains, languages, and written competence

Versioned domain definitions belong to the release. Every Specialization has an
explicit `domainId`. Domains and categories support navigation and discovery
only and imply no mechanics, transfer, access, membership benefit, or
relationship.

Spoken languages, scripts, and written traditions have explicit stable
identities and bindings in versioned content. A written tradition binds its
language, script, and conventions. Spoken competence never grants written
competence automatically. The generic legacy Language/Literacy model is not
restored as future canonical authority.

### Dual release integrity and compatibility

Every new Skill content release has two deterministic integrity values:

1. A **full/package digest** covers the complete immutable release, including
   documentation and presentation.
2. A **semantic/mechanical digest** covers structured facts that can affect a
   Character or game interpretation.

The semantic/mechanical digest includes, where applicable, stable identities and
kinds, weights, task envelopes, prerequisites, directional relationships,
access structures, learning-history membership, Specialization thresholds and
transfer declarations, language/script/written-tradition bindings, and any other
mechanically meaningful structured content. Pure editorial presentation such as
spelling, formatting, or `shortLabel` alone does not change it.

Digest comparison alone never decides Character migration. Each release or
change must explicitly classify compatibility and whether Character
compatibility/migration review is required.

The existing accepted release is immutable and must not be modified in place:

- release identity: `content-release:pilot-skills:1`;
- version: `pilot-skills-content/1.0.1`;
- package digest: `sha256:f524303b274b546c42daac06b65403957e896f35609d42ce7456ff5781c9f419`.

A documentation-complete Pilot release is a new versioned candidate and, after
explicit product-owner acceptance, a new immutable canonical release.

### Authoring, publication, and status

The Pilot workflow is:

`repository-authored candidate -> deterministic validation -> read-only Admin rendering -> product-owner review -> immutable canonical release`

Admin is read-only for candidate and canonical Skill content during this phase.
There is no mutable Admin content editor, separate documentation database, or
second prose authority. Candidate/proposal content must be renderable in Admin
before canonical acceptance.

The existing record-status vocabulary is sufficient:

- `proposal`;
- `canonical`;
- `evidence`; and
- `legacy`.

No database-level Draft/Reviewed/Approved workflow is introduced.

### Admin Skill Reference

The future read-only **Skill Reference** presents the Pilot and future canonical
model. The existing Admin Skills surface remains temporarily as an explicitly
labelled **Legacy Catalogue** compatibility reference. It must not be presented
as future authority. Removing it requires a later explicit decision after the
full new catalogue and runtime truth are integrated.

The list view supports search over name, short label, stable ID, and concise
description; domain, kind, weight, prerequisites, incoming/outgoing
relationships, explicit zero transfer, access exceptions, selected-profile
availability, and proposal/canonical status. The detail view presents identity,
status, both descriptions, task scope, structured mechanics, prerequisites,
Specialization acquisition, derived incoming/outgoing relationships, histories,
profile-specific access, language/script/tradition bindings, provenance and
release identity, with links to system-wide Skill Rules.

Admin Rules Docs remains authority for formulas and system-wide rules. It links
to Skill Reference rather than duplicating record-level documentation.

### Relationships, dependencies, and access presentation

One canonical set of explicit directional edges supplies both incoming and
outgoing relationship views. Admin derives readable statements such as
“Receives 75% from Riding” and “Contributes 25% to Mounted Combat.” It must not
infer reverse edges, symmetry, or category/family relationships. Pilot v1 uses
the strongest incoming contribution only, does not stack relationships, and is
non-recursive; recursion remains deferred. A zero-transfer Specialization is
stated explicitly and is not represented by a fake `0%` edge.

Prerequisites, Specialization parent and threshold, positive-acquisition
ownership, language/script dependencies, learning-history memberships, and
access are separate concise sections. Access remains canonical in profiles,
routes, overrides, and exceptions rather than being copied onto every Skill.
Per-Skill access is derived for an explicit profile/context. A global
available/restricted/unavailable filter has no meaning without a selected
profile. No relationship graph is required for the Pilot milestone.

### Pilot Skill Content Complete gate

The formal Pilot acceptance gate is:

> Every Pilot Skill, spoken language, written tradition and Specialization is
> fully authored in one canonical versioned content release and can be reviewed
> coherently through Admin with complete structured mechanics and scope,
> production-quality full and concise documentation, explicit directional
> relationships and dependencies, access and learning-history information,
> provenance and release identity, without placeholder content or contradictory
> mechanical/prose authority.

For every applicable record the gate requires a valid stable identity, full
name, short label, concise and substantive descriptions, primary domain,
complete task envelope, accepted weight, explicit or empty prerequisites, valid
relationship edges, explicit zero-transfer status, valid Specialization
threshold and ownership semantics, resolvable access and history memberships,
resolvable language/script/tradition semantics, provenance/status,
deterministic manifests and digests, coherent Admin rendering/search/filtering,
product language instead of raw internal IDs, no mechanics existing only in
prose, and deterministic validation/conformance.

### Catalogue and Character sequencing

The Pilot set is a development and calibration instrument, not the Skill set for
the eventual game pilot. After explicit acceptance of its documentation-complete
model, the project may map legacy evidence into the new model, populate and
calibrate the full usable catalogue, and review that complete catalogue. Only
then should the new catalogue be integrated into the preserved Chargen and
Character flows. Manual construction of long-lived test Characters is not a
milestone requirement before that integration.

## Reasoning

One versioned source lets deterministic validation, Admin review, future
Chargen, Character Sheet, and runtime consumers agree on identity and meaning.
Separating full-package integrity from semantic/mechanical integrity makes
editorial change visible without pretending every wording correction rewrites a
Character, while explicit compatibility classification keeps migration a
reviewed product decision. Read-only repository authoring preserves Git review,
provenance, repeatability, and immutable release boundaries during calibration.

## Executable examples

1. Changing only `shortLabel` changes the full/package digest but not the
   semantic/mechanical digest; the release still records an explicit
   compatibility classification.
2. Changing a Skill weight, task-envelope limit, relationship edge, access
   exception, or Specialization threshold changes both digests and requires
   compatibility/migration review.
3. A Skill detail page derives “Receives 75% from Riding” from one directional
   edge. It does not invent “Riding receives 75% from this Skill.”
4. Without a selected applicability profile, Admin may show that access
   exceptions exist but cannot label the Skill globally available or
   unavailable.
5. A spoken-language record and its written tradition render as separate
   competencies connected through explicit language and script bindings.

## Implementation consequences

- The canonical content contract and validators need additive documentation,
  released domain/script identities, dual digests, and compatibility metadata.
- A read-only Admin Skill Reference must consume candidate and canonical
  releases directly and remain distinct from the legacy compatibility surface.
- All bounded Pilot competencies and Specializations require production-quality
  authorship before the Pilot gate can pass.
- Full-catalogue mapping/population and preserved Chargen/Character integration
  are later, separately authorized phases.
- The current Pilot v1 arithmetic, retained-Character model, and immutable
  `1.0.1` release remain unchanged.

## Verification and traceability

The [Skills product roadmap](../../product/skills-product-roadmap.md) links the
six operational Forgejo cases and their dependency gates. Each later
implementation or content case requires its own exact-baseline authorization,
Builder handoff, independent QA, and control-plane acceptance. This decision is
documentation authority only; it grants no product implementation, `main`,
release, deployment, production, or external-service authority.
