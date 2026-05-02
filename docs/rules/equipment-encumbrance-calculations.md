# Equipment & Encumbrance Calculations

## 1. Purpose and scope

This page explains how the app calculates item `ENC`, personal carried load, and the encumbrance values shown on Character equipment and loadout screens.

It focuses on equipment and load. Combat formulas such as OB, DB, Parry, and attack modifiers are documented separately.

## 2. Quick rule summary

- Equipped, worn, or held items count toward personal carried load.
- On-person items count toward personal carried load.
- Backpack items count toward personal carried load with the backpack carry factor.
- Nearby or `With you` items that are not personally carried do not count toward personal carried load.
- `Elsewhere` items do not count toward personal carried load.
- Mount-carried items are tracked separately and do not count toward personal carried load.

## 3. Inventory location and carried load

`Carried` means the item is on the character and counted for personal encumbrance.

| Carry state | Counts as personal carried load? | Carry factor | Notes |
| --- | --- | ---: | --- |
| `Equipped` / worn / held | Yes | `1.0` | Immediate access. |
| `On person` | Yes | `1.0` | Fast access. |
| `Backpack` | Yes | `0.75` | Slow access. Normal items count at reduced carried ENC. |
| `With you`, but not personally carried | No | `0.0` for personal carried ENC | Nearby or travelling with the character. May still be situationally accessible. |
| `Elsewhere` | No | `0.0` for personal carried ENC | Stored away from the character. |
| `Mount` / mount-carried | No | `0.0` for personal carried ENC | Tracked as mount load instead. |

The app groups inventory as:

- `Carried`: equipped, on-person, and backpack locations
- `With you`: nearby or travelling-with-you locations that are not personally carried
- `Elsewhere`: stored away from the character

Coins are valuables. They follow normal item and location ENC rules. The app also counts encounter-accessible coins separately for display and use.

## 4. Actual item ENC vs effective carried ENC

The app tracks two related ENC ideas.

| Value | Includes carry factor? | Used for |
| --- | --- | --- |
| Actual item ENC | No | Item display and the item's full burden before carry mode. |
| Effective carried ENC | Yes | Personal carried load. |

Actual item ENC answers: "How heavy/bulky is this item?"

Effective carried ENC answers: "How much does this item count against the character's personal load right now?"

## 5. Item ENC formula

For most non-armor items, ENC is built in steps.

| Step | Calculation | Meaning |
| --- | --- | --- |
| 1 | Start with `base ENC` | The item's starting encumbrance from rules data. |
| 2 | `* quantity` | More copies add more load. |
| 3 | `* material factor` | Some materials change ENC. |
| 4 | `* quality factor` | Some quality levels change ENC. |
| 5 | `* carry factor` | Carry mode changes effective personal load. |

Effective item ENC:

```text
Effective item ENC = base ENC * quantity * material factor * quality factor * carry factor
```

Actual item ENC:

```text
Actual item ENC = base ENC * quantity * material factor * quality factor
```

If an item has an explicit ENC override, the override is used instead.

## 6. Material, quality, and carry factor

| Input | What it means | Where it comes from | Effect on ENC |
| --- | --- | --- | --- |
| Base ENC | The item's starting encumbrance value. | Item rules data. | Main starting value for non-armor items and armor fallback. |
| Quantity | How many of the item the character has. | Saved inventory item. | Multiplies ENC. |
| Material | What the item is made of. | Saved inventory item. | Bronze currently multiplies ENC by `1.1`; other materials currently use `1.0`. |
| Quality | Item quality. | Saved inventory item. | Extraordinary quality currently multiplies ENC by `0.9`; standard quality uses `1.0`. |
| Carry factor | How the item is carried. | Inventory location/carry mode. | Equipped/on-person items use `1.0`; backpack items use `0.75`; mount/stored items use `0.0` for personal carried ENC. |

## 7. Armor ENC and worn armor

Armor uses a workbook formula when character Size is available.

| Case | Formula / behavior |
| --- | --- |
| Workbook armor ENC available | `Armor ENC = armor encumbrance factor * quantity * character Size` |
| Armor encumbrance factor missing | Use armor base ENC as the factor. |
| Workbook armor ENC unavailable | Fall back to normal item ENC calculation. |

Other armor values shown on the Character Loadout page:

| Value | Meaning |
| --- | --- |
| General armor | Rounded armor protection and armor type. |
| AA modifier | Armor Activity modifier used by combat/loadout formulas. |
| Perception modifier | Armor perception modifier used by perception/loadout formulas. |
| Coverage locations | Armor values by body location. |

Worn armor counts toward personal carried ENC when it is in a carried location.

Armor material and quality currently affect ENC only if the armor falls back to the normal item ENC calculation.

## 8. Total carried ENC

Personal carried ENC is the sum of effective ENC for items with these carry modes:

- `equipped`
- `on_person`
- `backpack`

Formula:

```text
Personal carried ENC = sum(effective ENC for equipped, on-person, and backpack items)
```

Items in nearby `With you` locations, `Elsewhere` locations, and `Mount` locations do not count toward personal carried ENC.

## 9. Capacity, encumbrance level, and movement

The loadout panel compares personal carried ENC to carrying capacity, then derives encumbrance level and movement.

| Step | Formula | Result |
| --- | --- | --- |
| 1. Capacity | `Capacity = round(STR + SIZ + 0.5 * CON)` | Carrying capacity. |
| 2. Carried percent | `Carried percent = round((personal carried ENC * 100) / Capacity)` | Load as percent of capacity. |
| 3. Encumbrance level | Use the threshold table below. | Encumbrance level. |
| 4. Movement modifier | `Movement modifier = round((encumbrance level / 2) + shield movement modifier)` | Modifier used for movement adjustment. |
| 5. Base move | If `Size GM <= 2`: `10 + STR GM + DEX GM + Size GM`. Otherwise: `10 + STR GM + DEX GM + 2`. | Unencumbered base movement. |
| 6. Final movement | `Final movement = base move - workbook movement-table adjustment` | Displayed movement. |

Encumbrance level is the highest level whose threshold is exceeded. If no threshold is exceeded, encumbrance level is `0`.

| Carried percent above | Encumbrance level |
| ---: | ---: |
| 20% | 1 |
| 40% | 2 |
| 60% | 3 |
| 90% | 4 |
| 120% | 5 |
| 150% | 6 |
| 170% | 7 |
| 190% | 8 |
| 210% | 9 |
| 230% | 10 |
| 250% | 11 |
| 260% | 12 |
| 270% | 13 |
| 280% | 14 |
| 290% | 15 |

Example:

- If carried percent is exactly `90%`, it does not exceed `90%`, so level `4` is not reached yet.
- If carried percent is `91%`, it exceeds `20%`, `40%`, `60%`, and `90%`, so encumbrance level is `4`.

## 10. Mount and nearby storage

Mount-carried load is tracked separately from personal carried load.

Current mount formula:

```text
Mount-carried ENC = sum(base ENC of mount-carried items)
```

Nearby `With you` storage can be encounter-accessible, but it does not count toward personal carried load unless the item is in an equipped, on-person, or backpack location.

## 11. Known interim notes

- Mount-carried encumbrance currently uses a simpler calculation than personal carried load.
- Combat/loadout formulas such as OB, DB, Parry, and attack modifiers are documented separately.
- Location labels may need UI cleanup if they do not exactly match the rule concepts players expect.
