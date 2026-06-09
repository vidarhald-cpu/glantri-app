# Glantri Combat To Hit / Damage

This first pass records the canonical hit/miss/grazing rule table for combat to-hit lookup and wires
GM Phase 1 and Phase 2 attack rolls to that table. D1/D2 can now record a first damage result for
hits after a failed parry. It does not apply hit points, critical effects, hit location, bleeding, or
Combat Effects yet.

## Hit lookup

Roll open-ended `1d20`, using the same open-ended convention as skill rolls.

- An initial `20` opens upward: add `d10` rolls until a `d10` is not `10`.
- An initial `1` opens downward: subtract `d10` rolls until a `d10` is not `10`.
- The final roll total can be negative.

Use:

```text
lookup total = OB - DB + open-ended roll total
```

The canonical structured Glantri Combat To Hit / Damage table lives in Admin -> Tables. That table is
the source used by to-hit helpers; this page only explains how the rule is intended to be read.

Current hit/miss classification:

- Lookup totals of `10` or less miss.
- Lookup total `11` is a grazing hit.
- Lookup totals of `12` or more hit.

Damage metadata is available for hits and grazing hits. Lookup totals `17` and `18` are resolved in the
refreshed table. Lookup totals above the displayed table continue by adding `1` damage per row, keeping
critical grade `F` and minimum damage `5`.

Grazing-hit damage does not use a fixed normal damage modifier. It rolls `1dX`, where `X` is the damage
value for lookup total `12`.

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

For grazing hits, the required roll is the grazing die and weapon DMB is retained for context but not
added as fixed normal damage.

The current armor modifier is `0` until armor and hit-location interaction is implemented. Critical
grade and minimum damage are stored as table metadata when present, but critical effects and final
wound/HP application remain future work.

Future final-damage sequencing remains:

1. Attack hit/miss/grazing.
2. Parry.
3. Hit location with closed `1d20`; if the attacker selected a target location, roll twice and choose
   the result closest to the target.
4. Armor modifier from hit location plus the armor modifier table.
5. Final damage/effect proposal.
