# Skills product-area roadmap

Status: accepted product sequencing and portfolio boundary on 2026-09-04.

**Successor product guidance, 2026-09-17:** the target Skills, Learning Groups,
Professions, and Chargen consumption milestone is integrated. The
[Chargen and Competency Experience Product Contract](./chargen-competency-experience-contract.md)
now controls repeatable Character creation, ordinary competency-reference
presentation, and the required Profession-depth audit. This roadmap remains
useful for delivery history and source boundaries; its earlier assumptions about
showing a user-facing `Legacy Catalogue` do not override the successor rule that
ordinary game, reference, and Admin-facing surfaces explain current Glantri
content without migration or superseded-system narration. The reader-facing
prose expectation recorded below for Learning Groups, Professions, Arch
Societies and Civilizations is now settled as a product requirement for the V2
reference in that contract's
[section 9.12](./chargen-competency-experience-contract.md#912-prose-publication).

Observed against local Forgejo `dev@2ae4ceb65dc1bbc25275bde8ca54832d31a3dcc3`.
Live Forgejo issues remain operational truth for current status, ownership,
authorization, exact baselines, QA, and integration. This roadmap does not
authorize implementation.

## Product outcome

Glantri will first prove one complete, production-quality Skill content and
documentation model with the bounded Pilot set. The product owner must be able
to inspect every candidate record through a read-only Admin Skill Reference
before approving an immutable release. The accepted structure is then scaled to
the full usable catalogue before it replaces legacy Skill truth in the preserved
Chargen and Character experience.

The Pilot set is a development/calibration set. It is not the eventual game-pilot
catalogue, and manual construction of long-lived test Characters against it is
not a milestone requirement.

Normative content and integrity authority:
[Rule decision 0003](../decisions/rules/0003-skill-documentation-and-release-integrity.md).

## Delivery sequence

1. **Pilot documentation model** — settle the canonical record, release
   integrity, compatibility, provenance, and read-only review contract.
2. **Pilot Admin review surface** — implement a read-only Skill Reference that
   renders candidate and canonical versioned content while retaining a clearly
   labelled Legacy Catalogue compatibility surface.
3. **Pilot authorship** — give every bounded Pilot Skill, language, written
   tradition, and Specialization complete structured scope and
   production-quality concise and full documentation.
4. **Pilot acceptance gate** — review the candidate through Admin, resolve
   contradictions, and explicitly approve/freeze a new immutable release.
5. **Full catalogue rollout and review** — map useful legacy evidence, author and
   calibrate the complete usable catalogue, then review it as a whole.
6. **Preserved Chargen/Character integration** — only after the full catalogue is
   ready, extend the existing mature Chargen and Character flows to consume it
   and resume long-lived test-Character creation.

## Completed delivery path: full content into Chargen

Architecture decision
[0008](../decisions/architecture/0008-skills-chargen-delivery-priority.md)
sets the current product sequence:

1. approve the full target Skill and competency roster;
2. author the full reader-facing Skill content;
3. finalize Learning Groups against the full roster;
4. finalize Professions and their relationships to Learning Groups and Skills;
5. integrate those content layers into the Skill reference and metadata
   structure; and
6. adapt Chargen to consume the approved Skill, Learning Group, and Profession
   model.

Do not delay this path for complete Arch-Society, Civilization, or Setting-
content polish. If contextual competencies make a Setting boundary technically
necessary, authorize only the minimal scaffold needed for honest context
binding before viable Chargen.

## Setting sequence and later parallel work

Architecture decision
[0006](../decisions/architecture/0006-setting-foundation.md) introduces a
reusable Setting layer between generic rules content and Campaigns. Generic
Skills remain campaign- and setting-agnostic; contextual Skills declare a
context type and later bind to Setting-defined instances.

The complete Setting implementation remains decomposed and authorized
separately in this order:

1. Setting foundation;
2. contextual Skill binding;
3. Setting-first Chargen; and
4. Campaign Setting and content selection.

Once the new Chargen flow is operational, product work may split into three
parallel, separately authorized streams:

- rewrite the 11 recovered Arch Societies to the reader-facing content standard;
- review the nine explicitly Glantri-facing Civilization candidates for the
  repository-defined Glantri Setting while keeping the seven historical or
  reference Civilizations outside it unless separately approved; and
- write complete Skill-system documentation covering Domains, concrete Skills,
  Specializations, Learning Groups, Learning Histories, Professions, Arch
  Skills, Arch Societies, Society Level, Social Band, contextual/Setting
  binding, historical availability, Arch-Society applicability, and the
  relationships among them.

The built-in Glantri Setting remains repository-defined canonical content.
Runtime databases may reference or instantiate it but are not its sole content
authority. The current Skill Reference Society/Availability selector is a
transitional presentation and will be replaced when the contextual Skill and
Chargen stages are authorized. This section records dependencies only; it does
not authorize any implementation or canonical Skill release.

The current Civilizations page is transitional recovered/reference content,
not finished reader-facing Setting content. The repository contains 16
Civilization records: nine are explicitly Glantri-facing and are the evidence-
backed initial candidates for the built-in Glantri Setting; seven are historical
or reference Civilizations and remain outside the Setting unless separately
approved. All 16 currently link to one of the 11 recovered Arch Societies and
carry Society-Level and language context, but their prose, mappings, Setting
membership, and levels remain subject to Product Owner review. In particular,
Olog's current link to the level-5 court-bureaucratic archetype is not an
accepted statement that Ologs are generally more developed than Glantrians;
review it during the later Glantri Setting/Civilization pass.

Learning Groups, Professions, Arch Societies, and Civilizations should
eventually use ordinary, reader-facing prose comparable to Candidate 4 Skills:
what the concept represents, what it is used for, its boundaries, adjacent
relationships, and useful historical or Setting context.

## Approved historical-reference structure

Architecture decision
[0007](../decisions/architecture/0007-skill-historical-context-model.md)
separates the reference structures used to explain Skills historically:

- Arch Skills are non-purchasable informational problem structures and have no
  mechanical effect;
- Arch Societies are campaign-independent historical lenses that future Setting
  societies may map to;
- Learning Groups are authored shared ordinary training or practice contexts,
  distinct from Domains, Arch Skills, Learning Histories, and Professions; and
- historical attestation, normal acquisition, Arch-Society applicability, and
  Social-Band access remain separate facts.

The structure implies no Candidate-to-legacy 66-group crosswalk. Numeric Skill
floors, Social-Band values, final Arch-Society and full-catalogue rosters, and
new availability mechanics remain unresolved until separately decided. This is
reference architecture only and does not activate Chargen or runtime access.

## Operational portfolio

| Order | Forgejo case                                                      | Purpose                                                      | Current authority                                                             |
| ----: | ----------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
|     1 | [#22](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/22) | Canonical Skill documentation and release-integrity contract | Design/documentation authority only; no downstream implementation authority   |
|     2 | [#23](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/23) | Extend versioned content schema and validators               | Ready, dependency-gated on Case 1; not authorized                             |
|     3 | [#24](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/24) | Read-only Admin Skill Reference                              | Ready, dependency-gated on Case 2; not authorized                             |
|     4 | [#25](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/25) | Fully author documentation-complete Pilot content            | Ready, dependency-gated on Case 2; not authorized                             |
|     5 | [#26](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/26) | Product review and immutable Pilot release acceptance        | Design/review gate, dependency-gated on Cases 2-4; not authorized             |
|     6 | [#27](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/27) | Map legacy catalogue into the new authoring model            | Ready/inactive after Case 1 stabilizes; investigation only and not authorized |

Case 2 is the common model dependency for Admin and content authorship. Cases 3
and 4 may later proceed in coordinated order or in parallel only under explicit
authorization and clean hotspots. Case 5 requires both. Case 6 may investigate
legacy mapping after Case 1 is stable, but it cannot populate or activate
content.

```text
Case 1: documentation/release contract
  ├─> Case 2: schema and validators
  │     ├─> Case 3: Admin Skill Reference ─┐
  │     └─> Case 4: Pilot authorship ──────┼─> Case 5: Pilot review/freeze
  └─> Case 6: legacy mapping plan          └─> later full catalogue work

Case 5 and full-roster review -> full Skill content
                              -> Learning Groups
                              -> Professions
                              -> reference/meta-structure integration
                              -> viable Chargen
                              -> later Arch-Society, Glantri Setting,
                                 and Skill-system documentation streams

Minimal Setting/context scaffold may enter before viable Chargen only when
contextual competencies demonstrate that dependency in a separately authorized
case. Campaign Setting/content selection remains later work.
```

## Preserved authority and boundaries

- [Qualitative Skill Catalogue architecture](../decisions/rules/0002-skill-catalogue-qualitative-architecture.md)
  controls the 19-domain organization, navigation-only taxonomy, competency
  identities, DS/AB interpretation, languages, directional relationships, and
  learning histories.
- [Pilot Skill Rules v1](../rules/pilot-skill-rules-v1.md) controls bounded
  weights, costs, group contributions, relationship arithmetic, Specialization
  acquisition, and the intentionally non-recursive Pilot behavior.
- [Pilot Skill Content Release v1](../rules/pilot-skill-content-release-v1.md)
  records the immutable accepted `pilot-skills-content/1.0.1` release.
- [Retained Character ledger](../rules/retained-character-ledger.md) preserves
  acquisition history and pins rules/content/configuration versions; new
  releases do not silently rewrite Characters.
- [Chargen and Combat Manager preservation](./ui-interaction-preservation.md)
  makes the existing Chargen the presumptive player-product baseline. This does
  not require preserving the legacy Admin catalogue when it obstructs the new
  read-only reference model.

No case in this roadmap authorizes Pilot arithmetic changes, mutable Admin
editing, a documentation database, full-catalogue activation, Chargen/runtime
activation, Character migration, `main`, Azure, production, deployment, or
release work.

## Pilot Skill Content Complete gate

The formal wording and complete record checklist are in
[Rule decision 0003](../decisions/rules/0003-skill-documentation-and-release-integrity.md#pilot-skill-content-complete-gate).
The gate cannot pass from validator tests alone: candidate content must also be
coherently searchable and readable through Admin, contain no placeholder prose,
and receive explicit product-owner acceptance before becoming immutable
canonical content.

## Agent guidance

- Read the live case and exact `dev` before proposing or starting work.
- `status/Ready`, a dependency graph, or placement on this roadmap is not
  authorization.
- Do not use the bounded Pilot set as the catalogue for a game-pilot milestone.
- Do not create a second source of truth between canonical content, Admin, and
  future player consumers.
- Treat the legacy catalogue as evidence and temporary compatibility authority,
  not as the future Skill model.
