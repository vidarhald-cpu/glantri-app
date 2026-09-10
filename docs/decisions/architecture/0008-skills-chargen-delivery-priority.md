# Architecture decision 0008: Skills-to-Chargen delivery priority

- Status: approved
- Date: 2026-09-10
- Decision owner: Product Owner / control plane
- Functional areas: Skills, content governance, Chargen, Setting, historical reference
- Related issues: Forgejo #26, #85, #89, #90, #91, #92, #93, and #97
- Refines: architecture decisions 0006 and 0007
- Superseded by: none

## Context

The Skill content model, proposal/reference metadata foundation, Candidate 4
reader standard, and target-roster recovery have made the next product objective
clear: complete the approved Skill, Learning Group, and Profession content chain
and make the new Character Generation flow consume it. Full historical and
Setting presentation remains valuable, but it is not the near-term product
gate unless contextual competencies require a minimal Setting boundary.

Current recovered reference content contains 11 Arch Societies, 16 concrete
Civilizations, and 6 Society Levels. That evidence is transitional. It does not
make current civilization prose, mappings, or levels final Setting authority.

## Decision

### Near-term delivery sequence

The priority sequence is:

1. approve the full target Skill and competency roster;
2. author the full reader-facing Skill content;
3. finalize Learning Groups against that full roster;
4. finalize Professions and their relationships to Learning Groups and Skills;
5. integrate those content layers into the Skill reference and metadata
   structure; and
6. adapt Chargen to consume the approved Skill, Learning Group, and Profession
   model.

Full Arch-Society, Civilization, and Setting-content polish does not delay this
path. If contextual competencies make a Setting or context boundary technically
necessary, provide only the minimal separately authorized scaffold required to
bind those choices honestly. This priority refinement preserves decision 0006's
Setting ownership and Character compatibility boundaries; it does not authorize
the full Setting implementation sequence ahead of viable Chargen.

### Work after viable Chargen

Once the new Chargen flow is operational, product work may split into parallel
streams:

- rewrite and complete the 11 recovered Arch Societies with reader-facing
  historical and contextual prose;
- build the repository-defined Glantri Setting by reviewing the nine explicitly
  Glantri-facing Civilization candidates while keeping the seven historical or
  reference Civilizations outside it unless separately approved; and
- write complete Skill-system documentation for the concepts and relationships
  listed below.

Each stream still requires its own complete contract and explicit authorization.

### Transitional Civilization content

The current Civilizations page is useful recovered and reference content. It is
not finished reader-facing Setting content. The current records provide:

- 11 recovered Arch Societies;
- 16 concrete Civilizations;
- 6 Society Levels; and
- an existing Civilization-to-Arch-Society link with level, language, and
  contextual information.

The current repository contains 16 Civilization records. Nine are explicitly
Glantri-facing and are the evidence-backed initial candidates for the built-in
Glantri Setting. Seven are historical or reference Civilizations and remain
outside the Glantri Setting unless separately approved. All 16 currently map to
one of the 11 Arch Societies.

The candidates' prose, mappings, Setting membership, and Society-Level
treatment remain subject to Product Owner review before they become canonical
Setting definitions. Historical analogues preserve design provenance and
context; they do not exhaustively define a fictional Glantri civilization.

### Olog is held for Setting review

The current Olog link to `court_bureaucratic_empire` at Society Level 5 is not an
accepted product statement that Olog society is generally more developed than
Glantri. Product intent is that Ologs are not generally more developed than
Glantrians.

The later Glantri Setting and Civilization content pass must review Olog's
Arch-Society mapping and/or Setting-specific Society-Level treatment. The current
Skills-to-Chargen priority does not change that mapping or level.

### Reader-facing standard beyond Skills

Learning Groups, Professions, Arch Societies, and Civilizations should reach a
reader-facing standard comparable to Candidate 4 Skills. Final presentation
must use ordinary game-facing language rather than terse software or content-
engineering terminology. Each concept should explain:

- what it represents;
- what it is used for;
- important boundaries;
- how it relates to adjacent concepts; and
- relevant historical or Setting context where useful.

### Complete Skill-system documentation

Later Skill-system documentation must explain, without conflating:

- Domains;
- concrete Skills;
- Specializations;
- Learning Groups;
- Learning Histories;
- Professions;
- Arch Skills;
- Arch Societies;
- Society Level;
- Social Band;
- contextual and Setting binding;
- historical availability and Arch-Society applicability; and
- the relationships among those concepts.

Players acquire concrete Skills. Arch Skills remain non-purchasable
informational problem structures and never imply competence or mechanical
transfer.

## Preserved boundaries

This decision does not authorize:

- Setting or Civilization implementation;
- Arch-Society content rewriting;
- Chargen implementation except through a separately authorized case;
- new availability mechanics or DS/AB changes;
- a final full-catalogue identity crosswalk;
- Combat Skill taxonomy or weapon-mapping changes; or
- canonical full-catalogue publication.

## Portfolio consequences

- Forgejo #26 remains the Product Owner calibration and canonical-release gate.
- Forgejo #85 remains the inactive Setting architecture umbrella; full Setting
  polish no longer gates the near-term content-to-Chargen sequence.
- Forgejo #91 remains the contextual-binding Design case and may later own a
  minimal scaffold if Chargen genuinely requires it.
- Forgejo #92 remains the inactive Chargen Design case and must be refreshed
  against the approved full Skill, Learning Group, and Profession model before
  any authorization.
- Forgejo #93 remains the later Campaign Setting/content-selection Design case.

## Verification

Documentation formatting, links, decision indexing, and consistent portfolio
wording are sufficient. No Builder, independent QA, schema, runtime, database,
migration, content publication, or release action is authorized by this record.
