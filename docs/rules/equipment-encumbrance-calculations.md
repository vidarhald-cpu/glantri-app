# Equipment & Encumbrance Calculations

## 1. Purpose and scope

This page explains how the app calculates item `ENC`, personal carried load, and the encumbrance values shown on Character equipment and loadout screens.

It focuses on equipment and load. Combat formulas such as OB, DB, Parry, and attack modifiers are documented separately.

## 2. What ENC means

`ENC` is the app's encumbrance value for an item or load.

An item's ENC usually starts from the item's base ENC, then changes based on quantity, material, quality, and how the item is carried.

Armor has a special workbook ENC formula when the character's Size is known.

## 3. Item ENC formula

For most non-armor items, effective ENC is:

```text
Item ENC = base ENC * quantity * material factor * quality factor * carry factor
```

If an item has an explicit ENC override, the override is used instead.

For inventory display, the app also calculates actual item ENC:

```text
Actual item ENC = base ENC * quantity * material factor * quality factor
```

Actual item ENC does not include the carry factor. Effective ENC is the value used for personal carried load.

### Armor ENC

Armor uses a workbook formula when character Size is available:

```text
Armor ENC = armor encumbrance factor * quantity * character Size
```

If an armor template does not have a separate armor encumbrance factor, the app uses the armor's base ENC as the factor.

If the workbook armor formula cannot be calculated, armor falls back to the normal item ENC calculation.

## 4. Material and quality

| Input | What it means | Where it comes from | Effect on ENC |
| --- | --- | --- | --- |
| Base ENC | The item's starting encumbrance value. | Item rules data. | Main starting value for non-armor items and armor fallback. |
| Quantity | How many of the item the character has. | Saved inventory item. | Multiplies ENC. |
| Material | What the item is made of. | Saved inventory item. | Bronze currently multiplies ENC by `1.1`; other materials currently use `1.0`. |
| Quality | Item quality. | Saved inventory item. | Extraordinary quality currently multiplies ENC by `0.9`; standard quality uses `1.0`. |
| Carry factor | How the item is carried. | Inventory location/carry mode. | Equipped/on-person items use `1.0`; backpack items use `0.75`; mount/stored items use `0.0` for personal effective ENC. |

Current armor note: when the workbook armor formula is used, armor ENC is based on armor encumbrance factor, quantity, and character Size. Material and quality are only used if armor falls back to the normal item ENC calculation.

## 5. Inventory location and carried load

`Carried` means the item is on the character and counted for personal encumbrance.

| Location / state | Counts as carried load? | Notes |
| --- | --- | --- |
| `Equipped` / worn / held | Yes | Immediate access. Counts as personal carried load. |
| `On person` | Yes | Fast access. Counts as personal carried load. |
| `Backpack` | Yes | Slow access. Counts as personal carried load with the backpack carry factor for normal items. |
| `With you`, but not in Equipped/On person/Backpack | No | Nearby or travelling with the character, but not counted as personal carried load. It may still be situationally accessible. |
| `Elsewhere` | No | Stored away from the character. Does not count as personal carried load. |
| `Mount` / mount-carried | No | Tracked as mount load, not personal carried load. |
| Coins | Depends on location | Coins are valuables. They follow normal item/location ENC rules. The app separately counts encounter-accessible coins for display/use. |

The app groups inventory as:

- `Carried`: equipped, on-person, and backpack locations
- `With you`: nearby or travelling-with-you locations that are not personally carried
- `Elsewhere`: stored away from the character

## 6. Total carried ENC

Personal carried ENC is the sum of effective ENC for personal-load items.

Personal-load items are items with these carry modes:

- `equipped`
- `on_person`
- `backpack`

Formula:

```text
Personal carried ENC = sum(effective ENC for equipped, on-person, and backpack items)
```

Items in nearby `With you` locations, `Elsewhere` locations, and `Mount` locations do not count toward personal carried ENC.

Worn armor counts if it is in a carried location. When the workbook armor formula is available, the armor's carried ENC comes from that armor formula.

## 7. Encumbrance capacity and encumbrance level

The loadout panel compares personal carried ENC to carrying capacity.

Formula:

```text
Capacity = round(STR + SIZ + 0.5 * CON)
Carried percent = round((personal carried ENC * 100) / Capacity)
```

Encumbrance level is based on how many thresholds the carried percent exceeds:

```text
20, 40, 60, 90, 120, 150, 170, 190, 210, 230, 250, 260, 270, 280, 290
```

Example:

- If carried percent is `91`, it exceeds `20`, `40`, `60`, and `90`.
- Encumbrance level is therefore `4`.

Movement modifier uses encumbrance level and any ready shield movement modifier:

```text
Movement modifier = round((encumbrance level / 2) + shield movement modifier)
```

Base move is:

```text
If Size GM <= 2:
  Base move = 10 + STR GM + DEX GM + Size GM
Otherwise:
  Base move = 10 + STR GM + DEX GM + 2
```

Final movement is base move minus the workbook movement-table adjustment for the current movement modifier.

## 8. Armor ENC and worn armor

Armor can show several values on the Character Loadout page:

| Value | Meaning |
| --- | --- |
| Armor ENC | Encumbrance from the workbook armor formula when Size is known. |
| General armor | Rounded general armor value and armor type. |
| AA modifier | Armor Activity modifier used by combat/loadout formulas. |
| Perception modifier | Armor perception modifier used by perception/loadout formulas. |
| Coverage locations | Armor values by body location, such as head, chest, abdomen, arms, thighs, and feet. |

Worn armor counts toward personal carried ENC when it is in a carried location.

Armor material and quality currently affect ENC only if the armor falls back to the normal item ENC calculation.

## 9. Mount and nearby storage notes

Mount-carried load is tracked separately from personal carried load.

Current mount formula:

```text
Mount-carried ENC = sum(base ENC of mount-carried items)
```

Current app behavior / needs final rule review: mount-carried ENC currently uses a simpler calculation than personal carried ENC. It does not apply quantity, material, quality, carry factor, or the workbook armor formula.

Nearby `With you` storage can be encounter-accessible, but it does not count toward personal carried load unless the item is in an equipped, on-person, or backpack location.

## 10. Known interim notes

- Mount-carried encumbrance currently uses a simpler calculation than personal carried load.
- Combat/loadout formulas such as OB, DB, Parry, and attack modifiers are documented separately.
- Location labels may need UI cleanup if they do not exactly match the rule concepts players expect.
