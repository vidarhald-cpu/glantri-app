# Combat To Hit

This first pass records the canonical hit/miss/grazing rule table for combat to-hit lookup and wires
GM Phase 1 attack rolls to that table. It does not resolve damage, criticals, hit location, armor
interaction, parry resolution, or Combat Effects yet.

## Source

The current canonical source for app hit/miss logic is:

- Workbook: `docs/source/combat/New Combat Arena.xlsx`
- Sheet: `to hit (new)`
- Range: `A1:I32`

The legacy workbook sheet `To Hit table` remains reference-only for this rule.

## Hit lookup

Roll a closed `1d20`.

Use:

```text
lookup total = OB - DB + roll
```

The canonical structured to-hit table lives in Admin -> Tables. That table is the source used by
to-hit helpers; this page only explains how the rule is intended to be read.

Current hit/miss classification:

- Lookup totals of `10` or less miss.
- Lookup total `11` is a grazing hit.
- Lookup totals of `12` or more hit.

Damage, critical, and minimum-damage columns from `to hit (new)` are deferred until the duplicate
`17` and `18` rows in the workbook are clarified.

## Current P1 attack result

The GM Combat inspector can roll Phase 1 attacks for hit/miss/grazing only. The result is stored in
the combat round state and committed P1 snapshots preserve the historical roll, OB, target DB, lookup
total, and table result.

Target defense currently uses the target participant's encounter-context Phase 1 DB: combined DB when
available, otherwise DB, with phase-aware General/Fatigue and DB/Parry modifiers applied by the
existing combat panel read model.

Phase 2 attack resolution, damage, criticals, hit location, parry resolution, and Combat Effects are
deferred.
