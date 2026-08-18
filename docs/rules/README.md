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

## Maintainer Indexes

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
