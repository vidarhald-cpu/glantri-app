# Chargen and Competency Experience Product Contract

**Status:** Product Owner approved\
**Date:** 2026-09-17\
**Portfolio:** [#114 Chargen](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/114), [#110 Skills / Learning Groups / Professions](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/110)\
**Related content authority:** [#113 Profession Provenance / Availability](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/113)

This contract records playtest-derived product decisions for repeatable Character
creation, competency rules and reference material, and Profession competency
depth. It is product and documentation authority. It does not authorize a UI,
runtime, catalogue, migration, or content implementation.

The integrated Skill → Learning Group → Profession architecture remains
authoritative. This contract does not reopen the completed #110 integration or
restore the previous Skill system.

## 1. Repeatable Character creation

An account may have multiple Characters.

Entering Chargen must offer both of these paths where applicable:

- resume or edit an existing Character whose creation remains in progress;
- **Create new Character**.

Completing or starting one Character must not trap the account in that Character
or remove the ability to begin another. Account role combinations, including
GM/player and other multi-role accounts, must not prevent new Character creation
unless an explicit approved game or product rule requires that restriction.

This requirement controls the target experience independently of the cause of
the current playtest failure. Determining the current implementation gap belongs
to a separately authorized conformance audit.

## 2. Game documentation and reference presentation

The controlling principle is:

> **Glantri should explain Glantri, not explain its own interface.**

Ordinary game, reference, and Admin-facing surfaces present Glantri rules and
content. Controls and labels should make their function clear without
instructional filler that explains:

- how to search;
- what a tab is for;
- how the interface is organized;
- internal implementation concepts or identifiers;
- migration work;
- superseded or previous Skill-system structures.

Historical provenance, reconciliation, compatibility, and migration evidence
remain valuable repository and source documentation. They do not belong in the
ordinary game-reference experience.

### 2.1 Required reference structure

The competency reference area must provide the equivalent of these top-level
game concepts:

- **Rules**;
- **Skills**;
- **Learning Groups**;
- **Professions**;
- **Societies**.

Exact navigation labels may follow established Glantri terminology. The five
conceptual areas are required.

### 2.2 Rules reference

The Rules section explains the competency and Profession system in Glantri game
terms. It covers:

- what a Skill represents;
- what a Learning Group represents and how it relates to Skills;
- what a Profession represents;
- how Professions provide access to Learning Groups and direct competencies;
- how Society Level affects availability;
- how Social Band affects availability;
- how Arch Society and other approved contextual concepts apply;
- how these concepts interact during Character generation.

It must not explain tabs, search controls, database structures, internal IDs,
implementation architecture, or migration from the previous Skill system.

## 3. Contextual availability in the reference

Skill and competency reference material is incomplete when it omits approved
contextual availability that matters to play. Where authoritative content
exists and the dimension genuinely applies, the reference must present:

- Society Level;
- Social Band;
- other approved contextual availability, including Arch Society where
  applicable.

The reference must distinguish approved game content from unfinished content.
It must not fabricate contextual values or imply that unfinished contextual
availability is active in Chargen.

[#113 Profession Provenance / Availability](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/113)
remains the authority for unfinished Profession availability, contextual
bindings, and the S01/B1 gate. Those content dependencies remain visible as
unresolved dependencies until approved; they are not filled by inference.

## 4. Profession competency depth

A Profession must provide a recognizable and useful body of competencies to a
Character. Profession quality is judged by the resulting competency package,
not merely by whether every relationship is structurally valid.

A package that effectively collapses to one competency, such as a Cook route
that provides essentially only Cook, is not adequate merely because its Skill
and Learning Group links are internally consistent.

Improving a thin Profession may require one or more of:

- broader but still coherent Learning Group content;
- additional Profession → Learning Group opportunities;
- direct Profession competency opportunities;
- a genuinely missing Learning Group.

Do not pad a narrowly defined Learning Group with unrelated Skills merely to
make a Profession larger. A Profession may legitimately gain breadth through
multiple coherent Learning Groups and direct competencies. Specialist
Professions may also be narrower where that narrowness remains recognizable and
useful in play.

## 5. Profession competency depth target

### 5.1 Approved authoring target

The Product Owner has approved an authoring target of **roughly 10 effective
distinct base-Skill learning opportunities for an ordinary valid Profession
path**.

The target is a design and review signal, not a hard quota:

- Society Levels 1-2 may legitimately be narrower;
- more developed societies should generally support richer professional
  training;
- a Profession is never padded with irrelevant Skills to reach the number; and
- falling short is a prompt to review the content, not an automatic defect.

Earlier example ranges remain non-canonical.

### 5.2 Effective-breadth counting rules

Effective distinct base-Skill breadth is counted as follows:

- deduplicate a Skill reached through several routes;
- count fixed Skills;
- count only `chooseCount` for a choice slot, never the whole candidate pool;
- exclude unselected alternatives;
- evaluate mutually exclusive tracks separately; and
- exclude Specializations from base-Skill totals.

Possible Skill reach, meaning the union of every alternative a Profession family
can touch, may be reported separately. It is not effective breadth and must not
be substituted for it.

### 5.3 Required quantitative audit

The full-catalogue audit must:

1. compute distinct base-Skill coverage for all 84 Profession families;
2. deduplicate overlap between Learning Groups and direct routes;
3. report the actual distribution across the catalogue;
4. identify clearly thin Profession packages;
5. report the distribution against the approved target in 5.1;
6. distinguish legitimate specialist narrowness from deficient content.

No Profession should receive irrelevant Skills solely to reach a number. The
audit supplies evidence about the catalogue; the target itself is already
recorded in 5.1.

## 6. Preserved architecture and authority boundaries

The following remain approved:

- the target Skill catalogue;
- Learning Groups as coherent training contexts;
- Profession families and explicitly defined tracks;
- Profession access through Learning Groups and direct competencies;
- historical provenance as evidence;
- already approved structural relationships unless substantive content evidence
  supports a revision.

This contract refines product quality within that architecture.

### Authorized Profession and Learning Group catalogue redesign

The Product Owner has authorized a content redesign of the Profession and
Learning Group catalogue. The authorization explicitly covers:

- adding, removing, and merging Learning Groups;
- changing Learning Group memberships;
- adding and changing choice slots;
- changing Profession to Learning Group mappings; and
- changing Profession tracks and routes.

The current count of 59 Learning Groups is **not** fixed and may change.

The authorization explicitly does **not** cover:

- a broad rewrite of the 131 base Skills, which are generally preserved;
- a return to the previous Skill model; or
- a change to Chargen mechanics.

## 7. Decision state

### Settled product decisions

- Chargen supports creating multiple Characters per account.
- Resume/edit and Create new Character are both supported paths.
- Reference surfaces explain Glantri rules and content without interface or
  migration narration.
- The reference covers Rules, Skills, Learning Groups, Professions, and
  Societies.
- Approved contextual availability belongs in the reference.
- Profession packages must be recognizable and useful in play.
- The Skill → Learning Group → Profession architecture remains controlling.
- The Profession authoring target is roughly 10 effective distinct base-Skill
  learning opportunities per ordinary valid path, as a signal rather than a
  quota, counted by the rules in
  [section 5.2](#52-effective-breadth-counting-rules).
- The Profession and Learning Group catalogue redesign is authorized as recorded
  in [section 6](#authorized-profession-and-learning-group-catalogue-redesign),
  including a Learning Group count other than 59; the 131 base Skills, the Skill
  model, and Chargen mechanics stay outside that authorization.
- The V2 competency-reference experience, its publication requirements, and the
  bounded supersession of #252 are settled in
  [section 9](#9-v2-competency-reference-experience--product-owner-rulings-2026-09-26).

### Unresolved content dependencies

- #113 contextual Profession availability and associated Society, Arch Society,
  Social Band, Setting, and S01/B1 content remain unfinished where the
  authoritative sources say so.
- Missing contextual values must not be invented for the reference.

## 8. Required next preparation

This contract must be durable before any of these separately authorized tasks
begin:

1. a Chargen implementation-conformance audit;
2. a competency/reference UI audit;
3. a full Profession competency-depth and content audit.

Those audits are not authorized by this document.

## 9. V2 competency-reference experience — Product Owner rulings, 2026-09-26

**Status:** Product Owner approved, 2026-09-26.\
**Scope:** publication and reference-experience only.

This section records the next iteration of the competency reference. It is
product and documentation authority and authorizes no implementation.

It settles **how canonical competency content is presented and published to a
reader**. It does **not** reopen competency mechanics, Content V2 catalogue
semantics, Chargen acquisition, Learning Group membership, Profession routes,
Society rules, or Skill relationships. Where a requirement is already
contracted above, this section **cites** it and changes nothing.

### 9.1 #252 met its V1 scope — what is superseded, and what still binds

[#252 Competency reference and provenance — V1 contract](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/252)
remains correctly **Integrated**. It delivered the V1 scope it was given. It is
not reopened, and its completed scope is not characterized as failed.

Two of its stated limitations are **superseded, and only as far as the rulings
below require**:

- **#252 §2.2 (filters).** Its limitation to the filters then supported is
  **superseded** to permit useful, straightforward, **type-specific filters per
  catalogue**, as recorded in [section 9.11](#911-filtering-and-navigation).
  **Its prohibition on a generalized composable-filter framework is not
  superseded and remains binding: do not build a generic filter framework.**
- **#252 §2.5 (Societies).** Its exclusion of a V2 availability matrix and
  count subsystem for the Societies area is **superseded** to permit the
  **Access Overview matrix** of [section 9.10](#910-access-overview) and the
  **catalogue count and breadth presentation** of sections
  [9.6](#96-skills)-[9.9](#99-societies--civilizations).

Nothing else in #252 is superseded. In particular its reflect-never-repair
boundary, its competency-identity ruling, and its prohibition on inventing
relationship edges or availability semantics remain in force.

### 9.2 One canonical V2 reference experience

The canonical ordinary reference experience is the **V2 catalogue**. The user
must not face two competing catalogue systems, and must never have to decide
which catalogue is authoritative.

Its conceptual areas are the five already required by
[section 2.1](#21-required-reference-structure): Rules, Skills, Learning
Groups, Professions, Societies. In reader-facing terms these normally appear as
Skills, Learning Groups, Professions, Societies/Civilizations, and a combined
"How it works / Access" area carrying the Rules content of
[section 2.2](#22-rules-reference). **"How it works" and "Access" must not
become two duplicate conceptual areas**; choose the clearest reader-facing
naming and placement within the existing five-area model.

Legacy database-backed Skill Group and Profession editors and matrices must not
remain competing **ordinary reference** destinations merely because they
predate Content V2. Specifically inspect `/admin/skill-groups`,
`/admin/skill-groups/matrix`, `/admin/professions` and
`/admin/professions/matrix`. Where they still provide useful maintenance or
audit capability, relocate them under an explicitly administrative **Audit /
Legacy administration** area. Where they no longer provide useful capability,
retire them. **Do not delete useful operational tooling merely for cosmetic
cleanup.**

### 9.3 Maintenance and provenance concepts leave ordinary browsing

This applies the controlling principle of [section 2](#2-game-documentation-and-reference-presentation):
the ordinary reference explains Glantri, not catalogue maintenance.

Ordinary catalogue browsing must not carry prominent sections such as _Retired
Learning Groups_, _Skills without a Learning Group_, or migration,
reconciliation and provenance diagnostics.

- Retired Learning Groups are **provenance and audit material**. Preserve them
  where useful, but not as ordinary Learning Group catalogue content.
- A Skill with no Learning Group remains valid game information and needs no
  separate diagnostic catalogue section. Its row or Inspector may simply show
  `Learning Groups: 0` and explain that no Learning Group route exists.

### 9.4 Table and Inspector is the common interaction model

Compact catalogue tables for browsing and comparison, plus rich Inspectors for
explanation and detail. **Do not turn the tables into large spreadsheets.**

Each main area gets a compact table exposing the key numbers and dimensions
useful for browsing. Selecting a row opens its Inspector. A reader must be able
to move Skill ↔ Learning Group ↔ Profession ↔ Society without reconstructing
the graph by hand, so relationship links stay clickable.

### 9.5 Common Inspector hierarchy

The same basic information order applies across Skills, Learning Groups,
Professions and Societies/Civilizations, so readers learn where to find things:

1. explain the thing;
2. show what it gives, contains, or enables;
3. show how it relates to the other catalogue types;
4. put detailed availability and access at the bottom.

**The underlying data structure must not dictate the reader-facing order.**

### 9.6 Skills

**Table.** A compact Skill table with useful fields such as name, type,
player-facing category, linked stats, number of Learning Group routes, number
of Profession or direct routes, a concise relationship count or type where
useful, and a concise availability indication where canonical data supports
one. Do not overpopulate it.

**Inspector.** Explanation first — full description, type and category, linked
stats, typical uses and boundaries where authored, parent competency where
applicable. Then training and relationships — Learning Groups that teach it,
direct Profession routes, parent and child Specializations, and other canonical
mechanical relationships. Detailed availability comes last.

Current Skill prose appears substantially better than Learning Group and
Profession prose. **Do not rewrite good Skill content merely because an old
publication issue exists.**

### 9.7 Learning Groups

**Table.** Useful compact columns such as name, fixed base-Skill count, number
of training choices, reachable Specializations, number of Profession routes
using the Group, and a concise availability indication.

**Inspector.**

1. **Explanation** — the proper full reader-facing explanation of the training
   practice, **not merely its one-line `shortDescription`** (see
   [section 9.12](#912-prose-publication)).
2. **What it teaches** — fixed Skills, Specializations, choices, and a useful
   member or count summary. Express choices in reader language, for example
   "Choose 1 taught craft" or "Choose 3 melee weapon families", rather than
   leading with the implementation term _choice slot_.
3. **Where it is used** — Professions and routes using the Group, clickable
   member Skills, and other meaningful catalogue relationships.
4. **Detailed availability** — Society Level, Social Band and Society detail
   last.

### 9.8 Professions

**Table.** Profession browsing must answer the important questions without
opening every Profession. Useful compact columns include name, core training
route count, total training opportunities, reachable/effective base-Skill
count, reachable Specialization count, Society-Level range and Social-Band
range.

Where choices alter breadth, use meaningful player-facing presentation derived
from the **already-settled counting rules in
[section 5.2](#52-effective-breadth-counting-rules)**, which this section does
not restate or amend. As that section already requires, possible reach must not
be substituted for effective breadth. Avoid internal terminology such as
_choice slots_ as the primary summary.

**Inspector.** Opening text of the form "This Profession has 1 defining route
and 4 training routes" is **not** the headline description; those counts belong
in the summary, table, or training overview. The order is:

1. **What is this Profession?** — the full Profession description: what the
   occupation trains a practitioner to do, typical activities, and useful
   boundaries or context where authored. It must explain the occupation
   itself, **not restate its training graph**.
2. **What can I learn?** — number of reachable/effective base Skills, number of
   reachable Specializations, the actual deduplicated list of Skills, and
   useful breadth or minimum detail where route choices affect the outcome. A
   player must not have to open four Learning Groups by hand to discover which
   Skills a Profession can train.
3. **How am I trained?** — narrative order: core training route first, then
   alternative and additional training routes, then direct training. Each route
   shows the Learning Group and the Skills or Specializations that route
   actually teaches, with any selections shown inside the relevant route in
   normal reader language. Do not lead with, or detach, a _Choice slots_
   section unless a compelling future product need emerges.
4. **Complete training reach** — at the deeper-detail level, a deduplicated
   route or fan presentation such as Profession → Learning Group or direct
   route → Skill or Specialization, where the reader can inspect the complete
   graph.
5. **Detailed availability** — Society, Social Band and Society applicability
   last.

### 9.9 Societies / Civilizations

**Table.** A compact table with useful browse fields such as name, level or
type, Profession opportunity count, Learning Group opportunity count, and a
notable conditional-access indication. Exact columns follow the canonical data
and **must not become a new large analytical subsystem**.

**Inspector.** Follow the common hierarchy of
[section 9.5](#95-common-inspector-hierarchy): explain the Society or
Civilization, show relevant Professions, Learning Groups and Skill
opportunities, show relationships and conditions, and put detailed
availability and access last.

### 9.10 Access Overview

The older reference UI carried a useful **Access Overview** presentation:
Society Level rows, Social Band columns, and opportunity or availability shown
in the cells. Reuse and adapt that visual grammar for V2 rather than presenting
availability primarily as long bullet lists, and place the detailed matrix
toward the bottom of Inspectors.

Where canonical V2 data supports it, a cell may eventually communicate more
than yes/no — for example `2 routes` — with drill-down to which concrete routes
or Skills become available.

This presents the contextual availability already required by
[section 3](#3-contextual-availability-in-the-reference) and inherits its
limits unchanged: **do not invent availability semantics not already present in
canonical content**, and keep approved content distinguishable from unfinished
content. #113 remains the authority for unfinished Profession availability.

### 9.11 Filtering and navigation

**#252's restriction against a generalized composable-filter framework remains
sensible and remains binding. Do not build a generic filter framework.** Its
narrower filter limitation is superseded to the extent necessary to provide
useful, straightforward filters on each V2 catalogue:

- **Skills** — type, category, stats, relevant route or group properties;
- **Learning Groups** — members and counts, choice-bearing groups, Profession
  use, availability;
- **Professions** — Society Level, Social Band, Society/Civilization, training
  and Skill reach;
- **Societies** — level or type, and useful availability or content
  dimensions.

Exact filter sets are bounded by actual canonical data and reader usefulness.

**Preserve browsing state.** Search, filter and table state should survive
sensible Inspector traversal and return navigation. Following Skill → Learning
Group → Profession must not gratuitously clear the reader's search or filter
context.

### 9.12 Prose publication

Canonical V2 runtime content needs **distinct reader-facing layers**:

- `shortDescription` — the concise table or list summary;
- **full description** — Inspector content;
- typical activities or uses where authored;
- boundaries and context where authored.

**A one-line short description must not serve as the full Inspector
description.** **Source and proposal markdown must never be scraped at
runtime**; accepted content is published into canonical V2 runtime data through
the normal content source and projection.

Two observations at the current baseline are the reason this is ruled
explicitly rather than left to implementation:

- the reference projection maps a Learning Group's `shortDescription` into the
  field the reference renders as its description
  (`packages/content/src/competencyV2Reference.ts:146-148`), so the Group
  Inspector is structurally incapable of showing full prose today;
- the canonical V2 Profession family record carries **no reader-facing prose
  field at all** — `families[]` entries in
  `docs/product/proposals/competency-content-v2/competency-content-v2.json`
  carry `code`, `id`, `name`, `coreRoutes`, `groups`, `directRoute` and
  `skillIds`, some additionally `note`, `specializationIds` or `tracks`, and
  `note` is authoring provenance rather than reader prose. That is why the
  Profession Inspector currently leads with a route count: there is no
  description to lead with.

**Learning Group prose.** Full Learning Group prose is already authored in the
accepted source material. Inventory all canonical V2 Learning Groups against
that source and publish the accepted short description, full explanation and
relevant boundaries or context into the canonical V2 reader model. Where a
canonical V2 Learning Group genuinely lacks sufficient prose, **return the gap
for Product Owner and content review rather than fabricating mechanics**.

**Profession prose completeness.** Do not assume a V2 Profession already has
sufficient reader-facing prose merely because its identity and routes exist.
Inventory every canonical V2 Profession family against the accepted Profession
source. The minimum reader-facing Profession content is a short description; a
full description, normally one or two concise paragraphs; typical activities;
and boundaries or context where relevant. The prose answers what the Profession
is, what a practitioner does, and what kind of training or practice it
represents. **It must not merely restate Learning Group or route counts.**
Where accepted full prose exists, publish it. Where a canonical Profession
genuinely lacks proper prose, author the missing reader-facing prose **for
Product Owner review before canonical publication**.

**Authoring prose must not invent or change Profession mechanics, Learning
Group membership, direct Skill access, Society applicability, Skill identities,
or acquisition semantics.**

**Skill prose.** Re-evaluate the accepted #102 Skill prose against the current
canonical V2 runtime Skills. Where current V2 Skill prose already represents
the approved current reader prose, **do not churn it**. Where accepted prose
remains genuinely unpublished, publish it through the same canonical
reader-content mechanism.

This section records the **requirement**. Authoring and publishing the prose
itself is separate authorized work.

### 9.13 Alpha milestone

V2 reader-content publication and V2 reference-catalogue completion are **V1
Alpha work**. Alpha requires not only correct Chargen computation but a usable
published reference from which a player or GM can understand: what a Skill is;
what a Learning Group teaches; what a Profession is; what Skills a Profession
can train; how training routes connect; and where and under what conditions
material is available.

### 9.14 What this section does not settle

Concrete table columns are **not** fixed as a schema here. The columns named
above are examples of the intent; the exact set is bounded by actual canonical
data and settled in the implementation contract. **Do not overdesign.**

This section authorizes no implementation, no catalogue change, and no prose
authoring.
