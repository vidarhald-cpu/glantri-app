# Rules Documentation

Use the page for the job at hand. Table-facing rules stay separate from source evidence,
implementation detail, and unresolved design work.

## Audience Routes

| Audience       | Use it for                                                                                               | Keep elsewhere                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Player rules   | Choices, required inputs, visible results, and short examples                                            | Opponent-private facts, strategy, source rationale, and implementation detail   |
| GM procedures  | Ordered resolution steps, tables, shared results, GM-only inputs, and undo/commit behavior               | Design rationale, code ownership, source reconciliation, and unapproved rulings |
| Internal notes | Source coordinates, formulas, provenance, implementation mapping, tests, ambiguities, and decision links | Table instructions and tactical recommendations                                 |

## Audience-Separated Mechanics

| Mechanic | Player rules                                           | GM procedure                   | Internal notes                                                       |
| -------- | ------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------- |
| Parry    | [Declare Parry and read its result](./player/parry.md) | [Resolve Parry](./gm/parry.md) | [Parry sources, math, and implementation](./internal/parry-notes.md) |

Pages not listed here have not yet been audience-separated. Their existing content remains
maintained and reachable while migration proceeds.

Current retained-Character authority is documented in
[Retained Character Ledger and Headless Chargen](./retained-character-ledger.md), which links the
accepted Pilot v1 rules and exact canonical content release to persisted revisions, Campaign
membership, migration lineage, snapshots, and viewer-safe provenance.

Current Skill authority is split deliberately:

- [Competency Rules](./competency-rules.md) and the linked
  [Skill, Learning Group, and Profession reference](./competency-reference/README.md)
  provide the complete player/GM-facing target-system explanation and content;
- [Skill Catalogue qualitative architecture](../decisions/rules/0002-skill-catalogue-qualitative-architecture.md)
  governs the 19 navigation domains, competence identities, DS/AB meaning,
  language/written-tradition boundary, directional authoring relationships, and
  learning-history semantics; and
- [Pilot Skill Rules v1](./pilot-skill-rules-v1.md) and
  [Pilot Skill Content Release v1](./pilot-skill-content-release-v1.md) govern the
  bounded Pilot's accepted quantitative arithmetic, calibration, content, and
  migration boundary.

The qualitative decision does not change or generalize Pilot v1 mechanics.

Current Critical-effect behavior and its explicit pre/post-#393 boundary are documented in
[Glantri Critical Effects](./combat-critical-effects.md). The future six-kind authoring and bounded
GM-adjudication contract is
[decision 0004](../decisions/rules/0004-c1-critical-authoring-and-adjudication.md); its exact five-key
payload is non-executable recovery evidence until separately authorized implementation work lands.

The weapon-authored Secondary Critical is governed by
[decision 0006](../decisions/rules/0006-secondary-critical-resolution.md). Its deferred `Sec` code
grammar, Critical-family routing, per-code grade reduction, source exceptions, and remaining
Product Owner questions are reconciled in
[Secondary Critical `Sec` grammar reconciliation](./secondary-critical-sec-grammar.md). That
reconciliation is documentation only; it authorizes no runtime work and does not change the 608
primary catalogue positions.

The approved future Critical and shared-effect target is
[decision 0005](../decisions/rules/0005-critical-effect-semantics-and-timing.md). It defines
Stunned/Dazed, source-preserving stacking, canonical complete-round duration, C1-style future Bleed,
source-specific treatment, and the full-catalogue structure. It is documentation authority only and
does not change the current runtime or the historical C1 evidence recorded above.

## Maintainer Indexes

- [Combat Declarations](./combat-declarations.md) — approved player/GM declaration
  choices, structured intent, movement, and adjudication boundary.
- [Combat Action Rule Inventory](./combat-action-rule-inventory.md) — source extraction,
  classification, implementation status, and unresolved Combat reconciliation.
- [Source Mapping](./source-mapping.md) — checked-in source files and their mapped app structures.
- [Ambiguity Log](./ambiguity-log.md) — unresolved rules questions and bounded implementation
  decisions.

## Pattern For The Next Mechanic

1. Keep the existing mechanic path as a short compatibility route so inbound links remain valid.
2. Add `player/<mechanic>.md` for the choice, required inputs, available results, and one short
   example.
3. Add `gm/<mechanic>.md` for the ordered procedure, tables, visibility boundary, and
   commit/undo behavior.
4. Add `internal/<mechanic>-notes.md` for source coordinates, calculation rationale, stable
   identifiers, implementation ownership, executable tests, and unresolved decisions.
5. Add one row to the audience-separated table above and point internal inventories to the three
   audience routes.

The Player and GM pages state what happens and how to resolve it. They do not recommend tactical
choices. When risk is knowable and strategically meaningful, present the resulting chance or band;
do not make readers reconstruct it from raw modifiers. The app may perform complex calculations,
but it must present their actionable result immediately.

If source text and executable behavior disagree, preserve both facts in internal notes and link the
decision record. Do not silently reconcile Combat behavior while
[issue #211](https://github.com/vidarhald-cpu/glantri-app/issues/211) remains unresolved.
