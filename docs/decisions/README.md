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
