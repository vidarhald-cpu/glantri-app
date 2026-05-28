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

| Term                  | Meaning                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Base value            | The unmodified workbook starting value, such as raw OB, raw parry, or base DB.                   |
| Raw modifier          | A signed modifier step before percentage lookup.                                                 |
| Percentage adjustment | The workbook table result for `base value` and `abs(raw modifier total)`.                        |
| Final value           | `base value + adjustment` for positive totals, or `base value - adjustment` for negative totals. |

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
- Initiative manual or situational modifiers, for initiative only
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

## Current implementation boundary

DB and combined defense are implemented with the summed-raw path. Those calculations have a clear
existing workbook-backed path:

```text
Base DB = round(Dodge XP / 2) + 4 + DEX GM
Raw modifiers = equipment defensive value + DB/live modifier + encumbrance to-hit modifier
Final DB = apply workbook percentage adjustment once
```

OB, parry, and encounter-context combat/encumbrance-dependent skill rows now use the same rule for
the live modifier sources currently wired through the app:

- OB uses the workbook raw OB as the base value and sums armor activity, weapon OB, General/Fatigue,
  and OB/Skill before one percentage lookup.
- Parry uses the workbook raw parry as the base value and sums armor activity, weapon/shield parry,
  General/Fatigue, and OB/Skill before one percentage lookup. Combined parry also keeps the workbook
  minimum-1 primary/off-hand contribution rule before summing the live raw modifiers.
- Encounter-context combat skill rows use the unencumbered skill total as the base value. Their
  live skill value sums General/Fatigue and OB/Skill before one percentage lookup. Their encumbered
  live value adds the existing encumbrance movement modifier as an `Enc` raw modifier into the same
  lookup.
- Initiative uses the panel/passive initiative as the base value. Its live initiative value sums
  General/Fatigue and Initiative raw modifiers before one percentage lookup, then adds the
  open-ended d6 roll. OB/Skill and DB are intentionally not part of initiative unless a later
  spreadsheet-backed rule adds them.

The out-of-play Equip Items view remains theoretical unless an explicit encounter live-modifier
context is passed. Action-specific combat phase modifiers beyond the current allocation inputs are
future work and should be added as named raw modifier sources rather than as final-value overlays.

## Broad sword OB example

The Scyrian-cavalry-style Broad sword case is a useful guardrail because the displayed theoretical
OB is not the raw workbook base:

```text
Raw OB = round(1-h edged XP 9 / 2) + 1 + max(STR GM 4, DEX GM 2) = 10
Theoretical raw modifiers = Broad sword OB +2
Theoretical percentage adjustment = lookupWorkbookPercentageAdjustment(10, 2) = 2
Theoretical final OB = 12

Encounter raw modifiers = Broad sword OB +2 + General/Fatigue -1 = +1
Encounter percentage adjustment = lookupWorkbookPercentageAdjustment(10, 1) = 1
Encounter final OB = 11
```

So theoretical OB `12` with live General/Fatigue `-1` should display as `11`, not `10`. A result of
`10` means the live modifier was both included in the raw modifier sum and then applied again as a
flat post-adjustment subtraction. Applying the percentage table directly to the displayed `12` is
also not the canonical path, because `12` is already a final workbook value rather than the raw OB
base.
