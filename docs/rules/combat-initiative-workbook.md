# Workbook-faithful Initiative

## Initiative

For melee attacks, use the `Calculations` sheet formula path: base initiative is `Dex GM + weapon Initiative + Skill mod(skill XP)`, then apply the final `Game sheet!G10 + G11` adjustment exactly as the workbook does, adding `ROUNDDOWN((G10 + G11) / 2, 0)` only when the combined game modifier is above `2` or below `-2`.

## Note

No separate workbook prose rule was found that contradicted the initiative formulas. The app follows the workbook calculation cells directly and currently uses a `0` game-sheet initiative modifier where no live `G10 + G11` equivalent is captured in app state yet.
