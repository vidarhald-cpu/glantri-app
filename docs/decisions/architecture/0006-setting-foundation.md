# Architecture decision 0006: Reusable Setting foundation

- Status: approved
- Date: 2026-09-09
- Amended: 2026-09-26 (Product Owner ruling, Chargen Alpha inspection — a
  Setting-level competency availability constraint is recorded; self-amendment,
  same record)
- Decision owner: Product Owner / control plane
- Functional areas: rules and content governance, Skills, Character lifecycle,
  Chargen, Campaign, reusable world content
- Related issues/PRs: Forgejo #85; decision recording only
- Supersedes: any design that embeds a specific society, language, script, legal
  system, region, or other world instance in a generic Skill; any assumption
  that local seed data is the sole authority for the built-in Glantri world
- Superseded by: none

## Context

Generic rules content, reusable world definitions, and concrete Campaign game
state answer different authority questions. The current catalogue and Chargen
surfaces mix generic Skill identity with specific societies, languages, scripts,
legal systems, and related availability choices. That coupling cannot support
reusable settings without either contaminating generic rules or copying world
content into each Campaign.

Glantri therefore needs one reusable world-content boundary between generic
rules and Campaigns. The boundary must preserve Campaign ownership and
information security, retained Character identity, repository-defined
canonical content, and the existing Product Owner release gates.

## Decision

### Setting is the reusable world-content layer

Glantri introduces a reusable **Setting** layer between generic or global rules
content and Campaigns.

Generic Skill definitions remain campaign- and setting-agnostic. A Skill that
requires contextual knowledge declares a context type rather than embedding a
specific society, culture, language, script, legal system, geographic region,
institution, profession, or other world instance.

A Setting may supply reusable definitions such as:

- societies and cultures;
- languages and scripts;
- legal systems and geographic contexts;
- setting-specific professions;
- equipment and weapon templates; and
- other reusable world content when separately required and designed.

This list establishes ownership, not a complete Setting schema or permission
model.

### Character and Campaign relationship

A Character is created within one Setting. During Setting-first Chargen,
contextual Skill choices bind to compatible Setting-defined contexts. A
Character may subsequently join compatible Campaigns belonging to the same
Setting, subject to the existing player-initiated joining and
relationship-derived authorization rules.

A Campaign chooses one Setting and may select or filter the Setting content
relevant to that Campaign. Reusable Setting content remains distinct from
concrete mutable Campaign state. Instantiating or using a Setting definition in
Campaign A creates or uses Campaign A state; another Campaign does not gain
access merely because it uses the same Setting.

Campaign remains the ownership and information-security boundary for concrete
Campaign objects.

### Canonical built-in Setting

The built-in **Glantri Setting** is repository-defined canonical content. A
runtime database may reference, index, cache, or instantiate that content, but
local seed data or mutable database rows are not its sole authority.

### One umbrella, no Universe layer

`Setting` is the current umbrella for reusable world context. Glantri does not
introduce a separate Universe abstraction now. A larger container may be split
out later only if actual product requirements require multiple Settings within
one larger Universe.

### Setting-level competency availability — 2026-09-26 amendment

Product Owner ruling, 2026-09-26, from the Chargen Alpha inspection. It records
a **future constraint** on the Setting/availability layer. It authorizes no
implementation and changes nothing else in this record.

**Glantri-civilization identities must not be introduced into generic combat or
competency-engine rules.** Iest, Lankhmar and other named civilizations belong
to Setting content, exactly as the decision above already requires of generic
Skills.

The historical and desired Setting rule to be represented is:

- **Fencing is normally available only at the Iest-level cultural or Setting
  horizon.**
- **Lankhmar is an explicit historical Setting exception** where the Fencing
  tradition is also available.

This is an **availability rule**, not a statement that Lankhmar generally has
Iest-level structural properties. It is the kind of independent local condition
that [Competency rules → Social Band](../../rules/competency-rules.md#social-band)
already contemplates, and it is checked as availability, never as competence.

Until the Setting implementation can represent it cleanly, the Product Owner or
GM may **enforce Fencing availability manually**. **Do not build generalized
exception machinery solely for this case.**

The Fencing competency type itself is ruled separately in
[rule decision 0010](../rules/0010-competency-classification-and-group-taught-specializations.md);
this amendment concerns availability only and records no relationship strength,
cost or competency change.

### Transitional Skill Reference

The current Skill Reference Society/Availability selector is transitional. It
does not define the future Setting model and will be replaced when contextual
Skills and Chargen are adapted to Setting authority.

## Alternatives considered

### Keep setting instances inside generic Skills

Rejected because generic rules would remain coupled to one world and could not
be reused without copying or rewriting Skill definitions.

### Store all reusable world content directly in each Campaign

Rejected because it duplicates shared definitions, obscures provenance and
compatibility, and confuses reusable sources with concrete Campaign objects.

### Make runtime seed rows canonical

Rejected for the built-in Glantri Setting because reset, local environment, or
database history would become content authority. Canonical built-in content
must remain versionable and reviewable in the repository.

### Introduce Setting and Universe together

Rejected as premature. Current requirements need one reusable Setting layer;
they do not yet demonstrate a separate multi-Setting Universe authority.

## Consequences

- Generic Skill mechanics and definitions can remain reusable while contextual
  selections bind to Setting-owned instances.
- Character identity gains a Setting compatibility boundary before Campaign
  membership.
- Campaigns can filter reusable Setting content without sharing their concrete
  mutable objects.
- Repository content and runtime references require explicit identity,
  versioning, and compatibility contracts in later implementation cases.
- Existing Society/Availability presentation remains transitional until its
  separately authorized replacement.
- Current runtime, schema, Chargen, and Skill mechanics remain unchanged by
  this decision record.

## Integration and verification

The complete Setting implementation remains decomposed and authorized
separately in this order:

1. Setting foundation;
2. contextual Skill binding;
3. Setting-first Chargen; and
4. Campaign Setting and content selection.

Architecture decision
[0008](./0008-skills-chargen-delivery-priority.md) refines product ordering:
the near-term priority is to complete the full Skill, Learning Group, and
Profession content chain and make Chargen consume it. Full Arch-Society,
Civilization, and Setting-content polish must not delay that path. A minimal
Setting/context scaffold may precede viable Chargen only when a separately
authorized contract demonstrates that contextual competencies technically
require it.

Forgejo #85 owns the Design-state follow-up and open contract questions. Each
stage must define its exact baseline, authority, versioning and compatibility,
migration behavior, projection rules, hotspots, and verification before
dispatch. This sequence is not implementation authorization.

This documentation action uses routine formatting and link checks only. It does
not start a Builder, PR, independent QA task, schema change, migration, runtime
change, or canonical Skill publication.

## Release-boundary impact

None. This decision does not authorize changes to `main`, deployment, Azure,
production configuration, or canonical Skill release state.
