# Workbook-faithful OB and DMB

## OB

Combat uses the workbook-equivalent total skill XP input. In app terms, that is `effectiveSkillNumber` from the chargen skill view, not `specificSkillLevel` alone and not `totalSkill`.

For melee attacks, use the `Calculations` sheet formula: `ROUND(skill XP / 2, 0) + 1 + MAX(min(Str GM, 4), Dex GM)`, then combine weapon OB with armor `AA. mod`, look up the matching `Prosent` adjustment, and add or subtract that adjustment by the sign of the combined modifier.

## DMB

For numeric melee DMB, use the `Calculations` sheet formula: raw DMB is `Str GM + weapon DMB`, then rebalance it against the workbook's `+3` reference weapon bonus using the workbook OB result instead of treating weapon DMB as a flat standalone add-on.

## Discrepancy Note

`Rules for OBDB` says the skill term is halved and rounded down, but the actual `Calculations` cells use `ROUND(skill XP / 2, 0)`. The app follows the workbook formulas, not the prose wording, when those differ.
