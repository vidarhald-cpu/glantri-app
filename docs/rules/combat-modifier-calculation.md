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
- DB/Parry manual or situational modifiers. The stored JSON key may remain `situationDb` for
  backward compatibility, but the product-facing bucket controls both DB and Parry/P in
  encounter-context combat.
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

DB, Parry/P, and combined defense are implemented with the summed-raw path. Those calculations have
a clear existing workbook-backed path:

```text
Base DB = round(Dodge XP / 2) + 4 + DEX GM
Raw modifiers = equipment defensive value + General/Fatigue + DB/Parry + encumbrance to-hit modifier
Final DB = apply workbook percentage adjustment once
```

OB, parry, and encounter-context combat/encumbrance-dependent skill rows now use the same rule for
the live modifier sources currently wired through the app:

- OB uses the workbook raw OB as the base value and sums armor activity, weapon OB, and the
  canonical phase Skill/OB bucket before one percentage lookup. General/Fatigue rows do not enter
  attack OB merely because they are general rows.
- Parry/P uses the workbook raw parry as the base value and sums armor activity, weapon/shield
  parry, General/Fatigue, and DB/Parry before one percentage lookup. Combined parry also keeps the
  workbook minimum-1 primary/off-hand contribution rule before summing the live raw modifiers.
- Encounter-context combat skill rows use the unencumbered skill total as the base value. Their
  live skill value uses the canonical phase Skill/OB bucket before one percentage lookup. Their
  encumbered live value adds the existing encumbrance movement modifier as an `Enc` raw modifier
  into the same lookup.
- Initiative uses the panel/passive initiative as the base value. Its live initiative value uses
  the canonical phase Initiative bucket before one percentage lookup, then adds the open-ended d6
  roll. General/Fatigue, OB/Skill, and DB/Parry are not part of initiative merely because they are
  present in their own buckets.

DB/Parry does not include Skill/OB or Initiative. The encounter read model uses:

```text
DB/P raw live modifier = General/Fatigue + DB/Parry
DB/P adjustment = percentageAdjustment(base DB or base P, abs(DB/P raw live modifier))
DB/P final = base DB or base P +/- DB/P adjustment
```

Manual parry resolution reuses that DB/P modifier path. After a hit or grazing hit, the GM selects
the defender's available main-hand and/or off-hand parry sources for the selected incoming attack.
The first implementation uses the unmodified combined Parry/P row when the base combat-state read model
exposes one; otherwise it sums the selected source parry values. It then applies General/Fatigue and
DB/Parry and the stored attack-result parry modifier as raw modifiers through the same percentage
adjustment helper:

```text
Parry/P base = selected source parry value, or combined Parry/P when available
Parry raw modifier = General/Fatigue + DB/Parry + attack-result parry modifier
Parry adjustment = percentageAdjustment(Parry/P base, abs(Parry raw modifier))
Parry total = Parry/P base +/- Parry adjustment + open-ended d20 roll total
Parry succeeds when Parry total >= 21
```

The attack-result parry modifier is read from the hit lookup row and stored on the A1/A2 attack
result, so undoing P1/P2 keeps the modifier available for a rerolled parry while undoing the attack
removes the modifier source. Direction legality, hit-location coverage legality, and per-phase parry
source allocation across multiple incoming opponents are future work.

The Combat Round Manager inspector is context/time based. Base combat state is the equipment/loadout
value before round or action modifiers. Round/phase modifiers include declared action modifiers,
General/Fatigue, Initiative when relevant, OB/Skill, DB/Parry, active committed combatEffects, and
manual GM modifiers for the selected phase. Situational resolution modifiers belong to one specific
interaction, such as the attack-result parry modifier on a particular incoming attack.

Phase mini tables display effective values for the selected participant and selected context. Normal
phase rows include the relevant round/phase modifiers. P1/P2 and D1/D2 rows can also show the
selected incoming attack's situational parry context, including the stored attack-result parry
modifier, but that situational modifier does not follow the participant into unrelated later attacks
or inspections. The P1/P2 roll report remains the detailed breakdown: it starts from the selected
base source, then shows DB/Parry and attack-result raw modifiers once before the adjusted pre-roll P
value.

Generated action DB/Parry rows may be phase-specific. Manual DB/Parry rows without a phase apply
broadly. A generated row with `sourcePhase = phase1` contributes to phase 1 DB/P only; a generated
row with `sourcePhase = phase2` contributes to phase 2 DB/P only. No-specific-phase views such as
Declaration and Round summary include broad rows only; they do not sum phase 1 and phase 2 generated
rows together.

Older workbook notes may refer to `Game sheet!G10/G11` for initiative. In the modern app model,
those cells are not a separate initiative rule. They are the spreadsheet-era place where the GM
entered and reviewed situational initiative modifiers. The app represents those modifiers with the
GM-controlled Initiative combat modifier bucket, alongside General/Fatigue from live Combat
Effects.

Example:

```text
I = 3
General/Fatigue = -1
Initiative = +2
Raw live modifier = +1
Live adjustment = percentageAdjustment(3, +1)
Final encounter initiative = 3 + live adjustment + open-ended d6 roll
```

The out-of-play Equip Items view remains theoretical unless an explicit encounter live-modifier
context is passed. Action-specific combat phase modifiers beyond the current allocation inputs are
future work and should be added as named raw modifier sources rather than as final-value overlays.

## Generated action modifiers

Declaring `Single attack` currently creates one generated encounter modifier in the DB/Parry
bucket:

```text
Stored bucket key = situationDb
Value = -4
Duration = 1 round
Details = single attack
Source phase = phase 1
```

This phase 1 row modifies phase 1 DB and Parry/P, but does not modify phase 2 DB/P.

Declaring `Reactive attack` mirrors the same rule in phase 2:

```text
Stored bucket key = situationDb
Value = -4
Duration = 1 round
Details = reactive attack
Source phase = phase 2
```

This phase 2 row modifies phase 2 DB and Parry/P, but does not modify phase 1 DB/P.

Declaring `Double Attack` creates generated modifiers in both combat phases:

```text
Stored bucket key = situationObSkill
Value = -1
Duration = 1 round
Details = double attack
Source phase = phase 1 and phase 2

Stored bucket key = situationDb
Value = -4
Duration = 1 round
Details = double attack
Source phase = phase 1 and phase 2
```

The phase 1 rows modify phase 1 Skill/OB and DB/Parry only; the phase 2 rows modify phase 2
Skill/OB and DB/Parry only. Generated action lines are idempotent on repeated declaration saves.
Changing away from the matching action removes generated lines while leaving manual modifiers intact.
If the GM removes a generated action line while the action remains selected, the next declaration save
may recreate it because the line is derived from the action choice.

Declaring `Adjust Range - Attack` currently creates declaration-level DB/Parry modifiers only:

```text
Stored bucket key = situationDb
Value = -2
Duration = 1 round
Details = adjust range
Source phase = phase 1

Stored bucket key = situationDb
Value = -4
Duration = 1 round
Details = adjust range attack
Source phase = phase 2
```

The source inventory notes that the phase 1 `-2` DB risk is specifically tied to moving closer.
Because the app does not yet model range direction, distance state, or the opposed movement contest,
this first slice applies the phase 1 declaration modifier whenever Adjust Range - Attack is declared.
The phase 2 row is the standard attack DB/Parry risk. Full distance/range resolution and wrong-range
attack penalties are deferred.

## Broad sword OB example

The Scyrian-cavalry-style Broad sword case is a useful guardrail because the displayed theoretical
OB is not the raw workbook base:

```text
Raw OB = round(1-h edged XP 9 / 2) + 1 + max(STR GM 4, DEX GM 2) = 10
Theoretical raw modifiers = Broad sword OB +2
Theoretical percentage adjustment = lookupWorkbookPercentageAdjustment(10, 2) = 2
Theoretical final OB = 12

Encounter raw modifiers = Broad sword OB +2 + Skill/OB -1 = +1
Encounter percentage adjustment = lookupWorkbookPercentageAdjustment(10, 1) = 1
Encounter final OB = 11
```

So theoretical OB `12` with live Skill/OB `-1` should display as `11`, not `10`. A result of
`10` means the live modifier was both included in the raw modifier sum and then applied again as a
flat post-adjustment subtraction. Applying the percentage table directly to the displayed `12` is
also not the canonical path, because `12` is already a final workbook value rather than the raw OB
base.
