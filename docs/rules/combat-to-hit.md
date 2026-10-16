# Glantri Combat To Hit / Damage

This page records the canonical hit/miss/grazing rule table for combat to-hit lookup and wires GM
Phase 1 and Phase 2 attack rolls to that table. D1/D2 damage resolution first creates a reviewable
damage result proposal for hits after a failed parry. Hit location is rolled as an explicit D1/D2
substep before that proposal is calculated; if the proposal has a critical grade, the critical roll
is a second explicit D1/D2 substep before commit. Committing that proposal writes source-linked
combat-effect rows for the defender. The proposal includes compact GM review overrides for location,
armor, total damage, critical grade, critical-roll modifiers/result, notes, and manual immediate
effect rows. Critical-effect automation is bounded rather than absent: the five C1-active Critical
keys resolve through a structured canonical review, and the atoms the GM accepts are written as
combat-effect rows at commit. Remaining Critical results stay on the legacy GM-note path, and full
injury typing is still future work. [Glantri Critical Effects](./combat-critical-effects.md) and
[Criticals — GM Value Reference](./gm/criticals.md) carry the current boundary and the values.

## Hit lookup

Roll open-ended `1d20`, using the same open-ended convention as skill rolls.

- An initial `20` opens upward: add `d10` rolls until a `d10` is not `10`.
- An initial `1` opens downward: subtract `d10` rolls until a `d10` is not `10`.
- The final roll total can be negative.

Use:

```text
hit lookup total = OB - DB + open-ended roll total
```

The canonical structured Glantri Combat To Hit / Damage table lives in Admin -> Tables. That table is
the source used by to-hit helpers; this page only explains how the rule is intended to be read.

Current hit/miss classification:

- Lookup totals of `10` or less miss.
- Lookup total `11` is a grazing hit.
- Lookup totals of `12` or more hit.

Damage metadata is available for hits and grazing hits. Lookup totals `17` and `18` are resolved in the
current table. Lookup totals above the displayed table continue by adding `1` damage per row, keeping
critical grade `F` and minimum damage `5`.

Melee hit lookup rows can also impose a defender parry modifier for this specific incoming attack.
The modifier is read from the hit lookup row, not the later damage lookup row, and is stored with the
attack result. Current parry modifiers are:

| Hit lookup total | Defender parry modifier |
| ---------------- | ----------------------- |
| `15` or less     | `0`                     |
| `16`             | `-1`                    |
| `17`             | `-2`                    |
| `18`             | `-3`                    |
| `19`             | `-4`                    |
| `20`             | `-5`                    |
| `21`             | `-6`                    |
| `22`             | `-7`                    |
| `23`             | `-8`                    |
| `24`             | `-9`                    |
| `25` or more     | `-10`                   |

During P1/P2, this stored attack-result modifier is added to General/Fatigue and DB/Parry raw
modifiers before the normal percentage adjustment is calculated. Clear undoing a parry removes the
parry result but keeps the attack result and its stored modifier; Clear undoing the attack removes the
modifier source.

For a normal hit, calculate a second lookup before reading final damage:

```text
damage lookup total = hit lookup total + weapon DMB + defender DM
```

The damage lookup row gives final table damage, critical grade, minimum damage, and any max-damage
note. For example, `OB 10 - DB 15 + roll 19 = hit lookup 14`; with weapon DMB `8`, defender DM `0`,
damage lookup is `14 + 8 + 0 = 22`, so the table gives damage `9`, critical `B`, and minimum
damage `1`.

Armor is applied after the table row is read. The reviewed hit location plus front/back direction
selects the defender's armor coverage region. Armor value reduces table damage, and the armor
modifier table can further adjust damage and minimum damage. The current direction model defaults to
front; the GM may review it as back before commit. Upper-leg hit locations use thigh armor for the
chosen direction. Lower-leg hit locations use the current lower-leg/foot armor bucket (`frontFoot` or
`backFoot`); if no such coverage is present, the existing missing-coverage warning applies and armor
defaults to `0A`.

When a damage lookup row has a max-damage cap, the proposal preserves the uncapped table damage for
audit, but the capped value is the effective damage used for commit. Current capped rows use
`17 + attacker STR GM` as the cap. If the GM reviews and edits the proposed total damage number,
that total-damage override is treated as final for commit while the computed armor/cap result remains
visible for audit.

Grazing-hit damage does not use a fixed row modifier. A grazing hit at hit lookup `11`
uses hit lookup `12` as its reference, then applies the same DMB and defender DM to find the
reference damage lookup row. The grazing hit rolls `1dX`, where `X` is the raw table damage on that
reference row before armor. Armor, minimum damage, max damage, and critical minimum floors are then
applied to the rolled grazing damage. For example, weapon DMB `8`, defender DM
`0`, and no armor make the reference damage lookup `12 + 8 + 0 = 20`; row `20` gives table damage
`7`, so the grazing hit rolls `1d7`.

## Current attack and damage result

The GM Combat inspector can roll Phase 1 and Phase 2 attacks for hit/miss/grazing. The result is stored
in the combat round state and committed P1/P2 snapshots preserve the historical open-ended roll
breakdown, roll total, OB, target DB, lookup total, and table result.

Target defense currently uses the target participant's encounter-context DB for the matching phase:
combined DB when available, otherwise DB, with phase-aware General/Fatigue and DB/Parry modifiers
applied by the existing combat panel read model.

Attack result lines show final modified OB and DB totals without exposing the opponent's individual
modifier breakdown.

After a failed parry, D1/D2 first requires the attacker-owned hit-location roll, then can resolve and
store a damage proposal:

```text
hit lookup total = OB - DB + open-ended roll total
hit location = closed 1d20, or two closed 1d20 rolls when an aimed location was declared
damage lookup total = hit lookup total + weapon DMB + defender DM
damage = table damage at the damage lookup total, then armor-adjusted
```

The attacker rolls hit location. If no aimed location was declared for that attack phase, roll one
closed `1d20`. If the attacker declared an aimed location, roll closed `1d20` twice and use the
result whose selected body location is closest by table order. If both rolls are equally close, use
the first roll. The `roll_hit_location` command stores the aimed location, all hit-location rolls, the
selected location, and why that selection was made; the damage proposal consumes that stored result
and will not create a proposal while location is missing.

For grazing hits, the required roll is the final damage result. Weapon DMB and defender DM are used
with reference hit lookup `12` to derive the raw reference table row, then the grazing die is rolled
before armor is applied. The proposal stores both the raw grazing roll and the final armor-adjusted
damage for audit.

The armor modifier table is available as structured rule data. Current D1/D2 proposals read equipped
armor coverage by reviewed hit location and front/back direction, subtract armor value from table
damage, and apply the armor modifier table after damage lookup. Critical grade and minimum damage are
stored as table metadata when present; Critical effects themselves are resolved by the critical roll
below and are documented in [Glantri Critical Effects](./combat-critical-effects.md).

If the damage lookup produces a critical grade, D1/D2 enters critical pending after the damage
proposal is created. The attacker rolls `2d8`; the final critical roll is `2d8 + critical type
modifier - armor critical modifier`. The armor critical modifier is **subtracted**: armor reduces
Critical severity. The critical type modifier comes from the combat critical modifier table. Armor
critical modifier is read from the selected hit-location armor coverage when available, and the GM
may review or override the critical type modifier, armor critical modifier, final critical roll, and
critical location. For a C1-active Critical key the stored critical roll resolves a structured
canonical review whose accepted atoms — Stun, conditions, Bleed, and a read-only treatment state —
are created as source-linked combat-effect rows when the damage proposal is committed. For every
other Critical result the stored roll remains a GM review note and creates no rows.

During D1/D2 review, the GM may record compact overrides without replacing the computed proposal.
Review fields can override selected hit location, armor modifier, total damage, critical grade,
critical type modifier, armor critical modifier, final critical roll, and critical location; they can
also carry notes and manual additional effect rows. Additional effect rows can be immediate modifier,
fatigue, special, or note rows. Modifier rows use the existing General/Fatigue, OB/Skill, and
DB/Parry live modifier groups; special and note rows are descriptive until the GM adds explicit
modifier values. The effective damage preview is recalculated from the reviewed armor modifier and
selected location where applicable. For grazing hits, changing armor changes the final
armor-adjusted damage but does not change the already rolled grazing die size.

The proposal is not applied until the GM uses Commit phase damage. That command writes one
combat-effect event and, when total damage is positive, one active physical damage effect row for the
defender using the effective reviewed values. If the proposal has an effective hit location, the row
is recorded at that character damage location; General damage is used only when no specific location
is available. Critical grade and critical roll are carried into the commit notes, and for a C1-active
Critical key commit also writes the accepted canonical atoms as their own rows and applies that
result's minimum total damage floor to the committed physical damage. Commit also writes one active
row for each reviewed additional effect. The rows are
source-linked to the command by deterministic event/effect IDs, and GM review notes are carried into
the commit description. Phase-one committed rows are part of the participant's live JSON-backed
combatEffects state before phase two continues, so reviewed modifier rows affect phase-two combat
values where the existing live modifier path supports them. Clear unwinds this command stack in
visible steps: commit first, then critical roll if one exists, then damage proposal, then hit-location
roll, then parry/attack as normal.

The intended final-damage sequencing remains:

1. Attack hit/miss/grazing.
2. Parry.
3. Hit location with closed `1d20`; if the attacker selected a target location, roll twice and choose
   the result closest to the target.
4. Armor coverage from hit location plus reviewed front/back direction; subtract armor value and apply
   the armor modifier table after damage lookup.
5. Critical roll when a critical grade is present.
6. Final damage/effect proposal, manual immediate effect review, and GM commit.
