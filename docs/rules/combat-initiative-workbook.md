# Workbook-faithful Initiative

## Character and equipment initiative

Combat uses the workbook-equivalent total skill XP input. In app terms, that is `effectiveSkillNumber` from the chargen skill view, not `specificSkillLevel` alone and not `totalSkill`.

The character/equipment section is a theoretical pre-encounter view. For melee attacks, use the
`Calculations` sheet formula path:

```text
theoretical I = DEX GM + weapon Initiative + Skill mod(skill XP)
```

This theoretical value does not include live Combat Effects, encounter modifier buckets, or an
initiative roll.

## Encounter initiative

`Game sheet!G10/G11` should not be treated as a separate modern app calculation path. Those cells
were the spreadsheet-era input/review location for GM situational modifiers of the same live
General/Fatigue and Initiative type that the app now stores in encounter combat modifier buckets.

Encounter initiative uses the selected/panel `I` value as the base, then applies live raw modifiers
through the same workbook percentage modifier helper used for other combat modifiers:

```text
raw live modifier = General/Fatigue + Initiative
live adjustment = percentageAdjustment(I, raw live modifier)
final initiative = I + live adjustment + open-ended d6 roll
```

Skill/OB and DB do not affect initiative unless a future spreadsheet-backed rule explicitly adds
them. The Character section shows only theoretical `I`; Player Combat, GM Player Combat, and the GM
Combat Round Manager show the live initiative roll and result.

Example:

```text
I 3, General/Fatigue -1, Initiative +2
raw live modifier = +1
live adjustment = percentageAdjustment(3, +1)
final initiative = 3 + live adjustment + open-ended d6 roll
```
