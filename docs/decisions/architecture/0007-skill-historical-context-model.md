# Architecture decision 0007: Skill historical context and learning structure

- Status: approved
- Date: 2026-09-09
- Decision owner: Product Owner / control plane
- Functional areas: Skills, historical reference content, Setting, Chargen,
  content governance
- Related issues: Forgejo #26, #87, #89, and #90
- Depends on: architecture decision 0006
- Superseded by: none

## Context

The Skill catalogue needs to explain recurring human capabilities, historically
specific forms of those capabilities, and ordinary ways people learn them
without turning those explanations into unintended game mechanics. Several
structures are related but answer different questions. Treating them as one
classification or availability mechanism would manufacture mappings and access
rules that have not been approved.

This decision records the shared conceptual boundaries. It does not approve a
final Skill roster, final Arch-Society roster, numeric availability values, or
runtime behavior.

## Decision

### Concrete Skills remain the competence authority

Players acquire and use concrete Skills. Generic Skill definitions remain
campaign- and setting-agnostic. When a Skill requires contextual knowledge, it
declares the kind of context it needs rather than embedding a particular
society, language, script, legal system, geographic place, institution, or
other Setting instance.

The reusable-content chain is:

```text
generic rules and content
  -> Setting definitions
  -> Campaign selection and instantiation
  -> concrete Campaign play state
```

Architecture decision 0006 controls Setting identity, Setting-bound Character
creation, compatible Campaign membership, and repository authority for the
built-in Glantri Setting.

### Arch Skills are informational problem structures

An **Arch Skill** is a non-purchasable informational structure describing a
recurring human problem or capability area. It supports historical explanation,
catalogue coherence, and coverage auditing across concrete Skills.

Membership in an Arch Skill does not grant ranks, transfer, prerequisites,
availability, access, or any other mechanical effect. More than one Arch Skill
may describe relevant aspects of a concrete Skill where the authored evidence
supports that many-to-many relationship.

### Arch Societies are historical lenses

An **Arch Society** is a campaign-independent historical lens used to describe
how concrete competence and access may appear in a kind of society. A future
Setting society may map to an Arch Society while adding Setting-specific names,
languages, scripts, law, geography, technology, institutions, and other world
content.

That mapping does not make Arch Society a Setting, Campaign, or mechanics
authority. An optional exact Concrete Skill by Arch Society manifestation may
explain how a competence appears in that historical context. A manifestation is
descriptive unless an existing approved rule explicitly gives it a mechanical
effect.

The current recovered Arch-Society roster contains 11 records and is the
approved target for a later reader-facing rewrite after viable Chargen. That
does not make its current prose, mappings, or levels final, and no additional
society may be invented or inferred by similarity.

### Learning Groups describe shared ordinary practice

A **Learning Group** is a shared ordinary training or practice context in which
specified concrete Skills may be learned together. Membership is many-to-many
and authored; it is not inferred from similar names or subject matter.

Learning Groups remain distinct from:

- Domains, which organize navigation and reference presentation;
- Arch Skills, which organize informational capability problems;
- Learning Histories, which record Character-facing acquisition routes or
  histories;
- Professions, which describe occupational references or associations; and
- direct profession suggestions, which are not authored access rules.

A Learning Group may support only some of its members in a particular Arch
Society. Group applicability must not automatically confer availability on
every member.

### Historical and availability facts remain separate

The reference model keeps these concepts independent:

1. **Historical attestation**: evidence that a competence or practice existed
   in a context.
2. **Normal Skill acquisition**: the approved rules by which a Character may
   acquire the concrete Skill.
3. **Arch-Society applicability**: whether and how a concrete Skill is relevant
   to a particular historical lens.
4. **Social-Band access**: the human-facing historical availability state for
   a concrete Skill in that Arch Society and social band.

Evidence for one concept does not silently establish another. The reference
model may preserve unresolved, held, mixed, or context-dependent results and
their provenance. It must not fill gaps by semantic similarity.

The Pilot DS1-DS6 by AB1-AB4 authoring/access-profile model remains separate
from Society Level 1-6 by Social Band L1-L4 historical reference. This decision
does not reconcile or change either model.

### No legacy-group crosswalk is implied

No Candidate or Pilot Skill is automatically mapped to the legacy 66-group
collection. Learning histories, profession associations, direct profession
suggestions, Arch-Skill membership, and semantic similarity are not substitutes
for an authored Skill-to-Learning-Group mapping.

Any future crosswalk requires explicit provenance and Product Owner approval.

## Preserved boundaries

This decision does not approve or determine:

- numeric Skill floors or Social-Band values;
- expansion beyond or silent reinterpretation of the current 11-record
  Arch-Society roster;
- a final full-catalogue competency roster or identity crosswalk;
- new Skill relationships, transfer values, opposed checks, prerequisites, or
  access rules;
- Combat Skill taxonomy or weapon mappings;
- Candidate publication or canonical Skill release;
- Setting schema, runtime availability behavior, Chargen activation, migration,
  or Campaign content-selection behavior.

Those require separately authorized cases and, where applicable, the #26
Product Owner calibration and canonical-release gate.

## Sequencing

The complete Setting implementation sequence remains:

1. Setting foundation;
2. contextual Skill binding;
3. Setting-first Chargen; and
4. Campaign Setting and content selection.

Each stage requires its own complete contract and explicit authorization. The
sequence itself is not implementation authority. Architecture decision
[0008](./0008-skills-chargen-delivery-priority.md) controls the nearer product
priority: finish the full Skill, Learning Group, and Profession content chain
and adapt Chargen before full Arch-Society and Setting-content polish, except
for a minimal separately authorized contextual scaffold when technically
necessary.

## Verification

This decision is documentation-only. Routine Markdown formatting and link
checks are sufficient. No Builder implementation, independent QA, schema,
runtime, database, migration, or canonical release is authorized by recording
it.
