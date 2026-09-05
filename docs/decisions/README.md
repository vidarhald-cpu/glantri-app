# Glantri decision records

Decision records preserve why the application behaves or is structured in a particular way. They complement source evidence and tests; they do not replace either.

## Structure

```text
docs/decisions/
  architecture/   durable architecture and interface decisions
  rules/          Glantri implementation rulings and unresolved rule conflicts
  templates/      starting formats
```

Use filenames `NNNN-short-kebab-title.md`, with numbers assigned sequentially within each directory. Do not renumber old records.

## Status

- `proposed`: ready for review but not authoritative.
- `approved`: accepted and authoritative for implementation.
- `unresolved`: evidence/conflict is recorded but no ruling has been made.
- `superseded`: retained for traceability and linked to the replacement.
- `rejected`: considered but not adopted.

Only the product owner approves game-rule/UX rulings. Architecture decisions follow the review authority recorded in the task contract. Neither kind of record grants `main`, release, or production authority.

## When a record is required

Create a rule decision when implementation intentionally differs from, resolves a conflict in, or materially interprets source evidence. Create an architecture decision when a change establishes a durable cross-area boundary, shared contract, persistence strategy, or hard-to-reverse constraint.

Routine implementation details do not need decision records.

## Recovered current decisions

- Rules: [`rules/0001-c1-critical-injury-recalibration.md`](rules/0001-c1-critical-injury-recalibration.md)
- Rules: [`rules/0002-skill-catalogue-qualitative-architecture.md`](rules/0002-skill-catalogue-qualitative-architecture.md)
- Rules: [`rules/0003-skill-documentation-and-release-integrity.md`](rules/0003-skill-documentation-and-release-integrity.md)
- Product/UX: [`../product/ui-interaction-preservation.md`](../product/ui-interaction-preservation.md)
- Architecture: [`architecture/0002-spatial-scene-rules-boundary.md`](architecture/0002-spatial-scene-rules-boundary.md)
- Architecture: [`architecture/0004-canonical-field-equipment-v1.md`](architecture/0004-canonical-field-equipment-v1.md)
- Architecture guidance: [`../architecture/information-authority-and-projection.md`](../architecture/information-authority-and-projection.md)
- Portfolio guidance: [`../product/2026-09-03-strategic-future-register.md`](../product/2026-09-03-strategic-future-register.md)
- Skills product roadmap: [`../product/skills-product-roadmap.md`](../product/skills-product-roadmap.md)
- Field Equipment product roadmap: [`../product/canonical-field-equipment-v1-roadmap.md`](../product/canonical-field-equipment-v1-roadmap.md)
