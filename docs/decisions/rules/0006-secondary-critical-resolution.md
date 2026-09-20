# Rule decision 0006: Secondary Critical resolution

- Status: approved
- Date: 2026-09-19
- Product owner: Vidar Hald
- Related portfolio areas: Forgejo #111 Criticals / Injury; Forgejo #223 Secondary Critical source recovery
- Complements: [decision 0004](./0004-c1-critical-authoring-and-adjudication.md), [decision 0005](./0005-critical-effect-semantics-and-timing.md), and the `Sec` weapon-table column described in [Combat loadout calculations](../../rules/combat-loadout-calculations.md)
- Supersedes: none
- Superseded by: none

## Question

When a weapon attack produces a Critical, what decides whether a second
Critical also occurs, at what grade is it resolved, and from which roll?

## Evidence and limitation

This decision records the Product Owner rulings taken after the bounded
read-only source recovery authorized by Forgejo #223. That recovery established
that `Crit 2` and the Secondary Critical field (`Sec` / `Second crit.`) are
separate weapon-table fields, and that `Crit 2` denotes an alternate attack
mode rather than a Secondary Critical.

Before this record, the only Secondary Critical statement in the repository was
the one-line `Sec` column gloss in
[Combat loadout calculations](../../rules/combat-loadout-calculations.md). That
gloss remains a data-column description; this record is the rule authority.

This is a rules and documentation decision only. **No runtime Secondary
Critical implementation is authorized by it.** No schema, evaluator, resolution
path, catalogue position, or user-facing behavior changes on the basis of this
record alone.

The decision does not alter the 608 primary Critical catalogue positions, their
families, locations, indices, prose, or effects. A Secondary Critical performs a
second lookup against those existing positions; it never adds, removes, or
rewrites them.

## Ruling

### 1. Secondary Critical capability is weapon-authored

Whether an attack can produce a Secondary Critical, and how that Secondary
Critical is routed, is controlled solely by the weapon-authored `Sec` field and
its code.

Secondary Critical capability is never inferred independently of weapon data,
and it is never derived from `Crit 2`, which source recovery established is a
separate alternate-attack-mode field.

### 2. The grade relationship is a fixed relative reduction

A Secondary Critical resolves a fixed number of Critical grades below the
**resolved Primary Critical grade**. The grade distance is always preserved;
the reduction is relative, never absolute.

Worked example for a two-grade reduction:

| Resolved Primary | Secondary |
| ---------------- | --------- |
| F                | D         |
| E                | C         |
| D                | B         |
| C                | A         |
| B                | none      |
| A                | none      |

Resolution order:

```text
resolved Primary Critical grade
  -> apply the weapon-authored relative grade reduction
  -> Secondary Critical grade, or none when the result falls below A
```

### 3. Below A produces no Secondary Critical

When the reduction would place the Secondary Critical below `A`, **no Secondary
Critical occurs**. There is no minimum-grade substitution.

### 4. There is no absolute grade cap

Individual examples such as `E` to `C` record relative distance only. They must
not be reinterpreted as an absolute `C` cap, and no other absolute grade cap
exists.

### 5. The Secondary Critical uses a fresh independent roll

The Secondary Critical is resolved from a **fresh independent 2d8** roll. The
Primary Critical's 2d8 result is never reused for it.

## Deferred

Reconciliation and ratification of the exact `Sec` weapon-table grammar remains
**deferred**. It covers:

- the exact code vocabulary;
- Critical-family routing per code;
- the grade reduction encoded by each individual code; and
- exceptions and internal inconsistencies in the source data.

Until that reconciliation is separately approved, any parsing work must preserve
the raw `Sec` code and its provenance, and must fail closed on grammar it does
not recognize. This record must not be used to infer the deferred grammar.

## Implementation consequences

None are authorized by this record. Separate authority is required before any
Secondary Critical schema, parsing, resolution, or presentation work begins. The
rulings above are the target that such work must satisfy when it is authorized.

## Verification and traceability

- Portfolio: Forgejo #111 Criticals / Injury.
- Source recovery: Forgejo #223 Secondary Critical source recovery.
- Existing `Sec` column description:
  [Combat loadout calculations](../../rules/combat-loadout-calculations.md).
