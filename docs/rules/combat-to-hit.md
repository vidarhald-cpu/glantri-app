# Glantri Combat To Hit / Damage

This page records the canonical hit/miss/grazing rule table for combat to-hit lookup and wires GM
Phase 1 and Phase 2 attack rolls to that table. D1/D2 damage resolution first creates a reviewable
damage result proposal for hits after a failed parry. Committing that proposal writes source-linked
combat-effect rows for the defender, but hit location, critical-effect automation, bleeding, and
armor-location lookup remain future work.

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

Grazing-hit damage does not use a fixed normal damage modifier. It rolls `1dX`, where `X` is the full
normal damage total one lookup row higher, using the current known damage inputs. For lookup total
`11`, calculate normal lookup-total-`12` damage first, then use that total as the grazing die size.
For example, weapon DMB `8`, defender DM `0`, armor modifier `0`, and lookup-total-`12` table damage
modifier `1` make normal lookup-total-`12` damage `9`, so the grazing hit rolls `1d9`.

## Current attack and damage result

The GM Combat inspector can roll Phase 1 and Phase 2 attacks for hit/miss/grazing. The result is stored
in the combat round state and committed P1/P2 snapshots preserve the historical open-ended roll
breakdown, roll total, OB, target DB, lookup total, and table result.

Target defense currently uses the target participant's encounter-context DB for the matching phase:
combined DB when available, otherwise DB, with phase-aware General/Fatigue and DB/Parry modifiers
applied by the existing combat panel read model.

Attack result lines show final modified OB and DB totals without exposing the opponent's individual
modifier breakdown.

After a failed parry, D1/D2 can resolve and store a damage proposal:

```text
damage = weapon DMB + defender DM + table damage modifier + armor modifier + required roll
```

For grazing hits, the required roll is the final damage result. Weapon DMB, defender DM, table damage,
and armor are used to derive the grazing die size from the next normal hit row, then only the grazing
roll total is stored as damage.

The current armor modifier is `0` until armor and hit-location interaction is implemented. Critical
grade and minimum damage are stored as table metadata when present, but critical effects remain a GM
review note for now.

The proposal is not applied until the GM uses Commit phase damage. That command writes one
combat-effect event and, when total damage is positive, one active `general_damage` effect row for
the defender. The row is source-linked to the command by deterministic event/effect IDs. Phase-one
committed rows are part of the participant's live JSON-backed combatEffects state before phase two
continues. Clear unwinds this in two visible steps: first removing only the committed rows and
returning to the D1/D2 proposal, then removing the proposal and returning to pending damage review.

The intended final-damage sequencing remains:

1. Attack hit/miss/grazing.
2. Parry.
3. Hit location with closed `1d20`; if the attacker selected a target location, roll twice and choose
   the result closest to the target.
4. Armor modifier from hit location plus the armor modifier table.
5. Final damage/effect proposal and GM commit.
