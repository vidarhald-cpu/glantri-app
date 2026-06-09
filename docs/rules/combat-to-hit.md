# Combat To Hit

This first pass records the canonical hit/miss/grazing rule table for combat to-hit lookup and wires
GM Phase 1 and Phase 2 attack rolls to that table. D1/D2 can now record a first damage result for
unambiguous non-grazing hit rows after a failed parry. It does not apply hit points, critical effects,
hit location, or Combat Effects yet.

## Hit lookup

Roll open-ended `1d20`, using the same open-ended convention as skill rolls.

- An initial `20` opens upward: add `d10` rolls until a `d10` is not `10`.
- An initial `1` opens downward: subtract `d10` rolls until a `d10` is not `10`.
- The final roll total can be negative.

Use:

```text
lookup total = OB - DB + open-ended roll total
```

The canonical structured to-hit table lives in Admin -> Tables. That table is the source used by
to-hit helpers; this page only explains how the rule is intended to be read.

Current hit/miss classification:

- Lookup totals of `10` or less miss.
- Lookup total `11` is a grazing hit.
- Lookup totals of `12` or more hit.

Damage metadata is available for unambiguous non-grazing hit rows. Lookup totals `17` and `18`
currently have ambiguous damage rows and cannot be resolved automatically. Grazing-hit damage also
requires clarification before automated damage calculation.

## Current attack and damage result

The GM Combat inspector can roll Phase 1 and Phase 2 attacks for hit/miss/grazing. The result is stored
in the combat round state and committed P1/P2 snapshots preserve the historical open-ended roll
breakdown, roll total, OB, target DB, lookup total, and table result.

Target defense currently uses the target participant's encounter-context DB for the matching phase:
combined DB when available, otherwise DB, with phase-aware General/Fatigue and DB/Parry modifiers
applied by the existing combat panel read model.

Attack result lines show final modified OB and DB totals without exposing the opponent's individual
modifier breakdown.

After a failed parry, D1/D2 can resolve and store:

```text
damage = weapon DMB + defender DM + table damage modifier + armor modifier + required roll
```

The current armor modifier is `0` until armor and hit-location interaction is implemented. The current
damage-roll component is not required for the unambiguous rows implemented so far. Critical grade and
minimum damage are stored as table metadata when present, but critical effects and final wound/HP
application remain future work.
