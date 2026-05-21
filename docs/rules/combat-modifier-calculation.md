# Combat Modifier Calculation

This note documents how live combat modifiers should enter workbook-backed combat values.

## Source mapping

- Workbook: `data/raw/glantri/Themistogenes 1.07.xlsx`
- Existing code table: `packages/rules-engine/src/combat/workbookCombatMath.ts`
- Target helper: `lookupWorkbookPercentageAdjustment`
- Current defense target: `calculateWorkbookDefensePair`

The exact workbook cell range for the imported percentage adjustment table is not yet recorded in
the repo. Existing golden tests cite workbook combat rows such as `Weapon1!A10:O10`,
`Weapon2!A10:J10`, and `Calculations!R/W/Z` formula paths for OB/DMB. Defense documentation in
`docs/rules/combat-loadout-calculations.md` defines DB as `Base DB` plus raw equipment/to-hit
modifiers passed through the same workbook percentage adjustment table.

## Terms

| Term | Meaning |
| --- | --- |
| Base value | The unmodified workbook starting value, such as raw OB, raw parry, or base DB. |
| Raw modifier | A signed modifier step before percentage lookup. |
| Percentage adjustment | The workbook table result for `base value` and `abs(raw modifier total)`. |
| Final value | `base value + adjustment` for positive totals, or `base value - adjustment` for negative totals. |

## Rule

Collect all applicable raw modifiers first, sum them, then apply the workbook percentage adjustment
once.

```text
raw modifier total = sum(raw modifiers)
percentage adjustment = workbook percentage adjustment(base value, abs(raw modifier total))
final value = base value +/- percentage adjustment
```

Do not apply a live modifier to an already-final display value when the value has a known base/raw
modifier path. That double-stages the percentage table and can collapse nearby results. For example,
an already-final DB of `15` with a raw `-1` modifier can display as `13`; using the summed raw path
keeps the one-point advantage and displays `14` in the documented shield/combined-defense case.

## Raw modifier sources

These are raw modifier sources when they apply to a given combat value:

- General/Fatigue from active combat effects
- OB/Skill manual or situational modifiers
- DB manual or situational modifiers
- Encumbrance, including the workbook to-hit modifier
- Equipment-derived raw modifiers where the workbook treats them as modifier steps, such as weapon
  OB/parry values and weapon/shield defensive values
- Action and situation modifiers

## Not raw modifiers

These are not raw percentage modifiers by themselves:

- Armor rating
- Damage type or critical type
- Already-final derived display values
- Text labels, warnings, and narrative descriptions

## Current refactor boundary

This refactor starts with DB and combined defense. Those calculations have a clear existing
workbook-backed path:

```text
Base DB = round(Dodge XP / 2) + 4 + DEX GM
Raw modifiers = equipment defensive value + DB/live modifier + encumbrance to-hit modifier
Final DB = apply workbook percentage adjustment once
```

OB, parry, and encumbrance-dependent skill rows already have workbook helpers, but not every live
modifier source has been threaded into those helpers yet. Until that is done, they may still use the
existing live overlay path.
