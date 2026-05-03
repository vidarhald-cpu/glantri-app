# Equip Items Calculations

## 1. Purpose and scope

This page explains the values shown on the Character `Equip Items` screen.

It covers equipped weapons, shields, armor, weapon rows, defense rows, movement, encumbrance summaries, and the small skill table shown with equipped items. It is not the full combat action system.

Quick summary: `Equip Items` rows combine the character's relevant skill XP, relevant stat GM, weapon or armor rules data, armor/activity modifiers, and encumbrance modifiers where relevant. Some values come directly from item rules data; others are calculated.

For related references:

- See `Character Sheet Calculations` for Skill XP, Group XP, Derived XP, and Total XP.
- See `Equipment & Encumbrance Calculations` for item ENC, carried load, capacity, and encumbrance level.

## 2. Inputs used by the Equip Items screen

The `Equip Items` screen uses the current character, chosen equipment, and live combat state.

| Input | What it affects |
| --- | --- |
| `Primary weapon` | Primary weapon row, melee OB/DMB, DB/DM, parry, and grip summary. |
| `Shield` | Shield row, one-hand-plus-shield grip, shield movement modifier, DB/DM, and parry. |
| `Armor` | Armor summary, Armor Activity modifier, perception modifier, armor coverage, and personal carried ENC. |
| `Second hand weapon` | Secondary weapon row, dual-wield grip, combined defense row, and off-hand parry. |
| `Missile weapon` | Missile weapon row and projectile OB/DMB. |
| `Throwing weapon` | Thrown weapon row. This can use a weapon's thrown attack mode. |
| `Punch`, `Kick`, and `Brawling` | Workbook-backed unarmed rows that remain available even without weapons. |
| Character stats and GMs | STR, DEX, SIZ, CON, INT, POW, and LCK feed combat, perception, movement, and load formulas. |
| Skill XP / Total XP | Combat formulas use the character's total skill XP for the relevant combat skill. |
| Encumbrance and movement | Personal carried ENC affects encumbrance level, movement modifier, movement, and some skill rows. |

## 3. Skill values used by combat

Combat uses total skill XP for the relevant skill.

```text
Combat skill XP = Group XP + Skill XP + Derived XP
```

This is the same `Total XP` concept documented on the Character Sheet. Combat formulas use this XP number directly. They do not add the skill's linked-stat average unless a specific Equip Items skill row says it is calculating a skill level.

Examples:

| Combat value | Skill XP source |
| --- | --- |
| Melee weapon OB and initiative | The equipped weapon's linked weapon skill, such as `1-h edged`. |
| Projectile OB | The missile weapon's linked skill, such as `Bow`. |
| Thrown OB | `Throwing`. |
| DB and DM | `Dodge`. |
| Parry | `Parry`. |
| Punch, Kick, and Brawling OB | `Brawling`. |

## 4. Characteristic GMs used by combat

Equip Items combat formulas use workbook-style GMs from adjusted character stats.

Formula:

```text
GM = trunc((stat - 11) / 2)
```

| GM | Used for |
| --- | --- |
| `STR GM` | Melee OB, melee DMB, thrown DMB, and base move. Melee OB caps the STR GM contribution at `4`. |
| `DEX GM` | Melee OB, projectile OB, initiative, DB, parry, and base move. |
| `Size GM` | Base move. If Size GM is above `2`, base move uses `2` instead. |
| `CON` | Carrying capacity. |
| `SIZ` | Carrying capacity and armor ENC when armor workbook sizing is available. |
| `INT`, `POW`, `LCK` | Perception in the Equip Items skills table. |

## 5. Weapon row values

The `Weapons` table shows ready weapons and defensive rows.

Common row types:

| Row type | Meaning |
| --- | --- |
| `Primary` | Active primary melee weapon. |
| `Secondary` | Active second-hand weapon. |
| `Shield` | Ready shield. |
| `Combined` | Primary plus shield or primary plus second-hand weapon defense. |
| `Unarmed` / `Brawling` | Unarmed combat summary. |
| `Punch` and `Kick` | Workbook-backed unarmed attack rows. |
| `Missile` | Active missile weapon. |
| `Thrown` | Selected throwing weapon or thrown attack mode. |

Weapon table columns:

| Column | Meaning | Formula/source | Notes |
| --- | --- | --- | --- |
| `Mode` | How the row is being used. | Equip Items row type. | Examples: `Primary`, `Shield`, `Combined`, `Missile`, `Thrown`. |
| `Weapon` | Item or combined item label. | Equipped item name or weapon class pair. | Combined rows show the primary/off-hand pairing. |
| `I` | Initiative. | See Initiative below. | Missile and thrown rows use a simpler DEX-adjusted value. |
| `Attack 1`, `Attack 2`, `Attack 3` | Attack mode labels. | Comes from the weapon or shield rules data. | Missing modes show `-`. |
| `OB`, `OB2`, `OB3` | Offensive bonus for the attack mode. | See OB below. | `OB3` is currently not calculated for normal weapon rows. |
| `DMB`, `DMB2`, `DMB3` | Damage modifier bonus. | See DMB below. | Dice or special text can come directly from weapon rules data. |
| `Crit 1`, `Crit 2`, `Crit 3` | Critical code. | Comes from weapon rules data. | Examples include workbook critical codes such as `AC`. |
| `Sec` | Secondary critical. | Comes from weapon rules data. | Sec is the second critical attached to the main attack mode. It is only applied when the main attack mode is used and the rules call for the second critical. |
| `AM`, `AM 2`, `AM 3` | Armor modifier code/value for the attack. | Comes from weapon rules data. | AM is used when resolving how the attack interacts with armor. AM is separate from item ENC. ENC measures carried load. |
| `DB` | Defensive bonus for this defensive item state. | See Defense values. | Uses Dodge XP, DEX GM, equipment defense, and encumbrance to-hit modifier. |
| `DM` | Difference caused by the encumbrance to-hit modifier. | See Defense values. | Current app behavior reports the change between equipment-only DB and full DB. |
| `Parry` | Parry value. | See Parry below. | Uses Parry XP, DEX GM, armor AA, and weapon/shield parry. |

## 6. OB, DMB, and initiative

### Melee OB

Melee weapon rows use the workbook melee OB formula when all inputs are available.

| Step | Formula |
| --- | --- |
| Raw melee OB | `round(skill XP / 2) + trained-skill bonus + max(min(STR GM, 4), DEX GM)` |
| Modifier | `armor AA modifier + weapon OB` |
| Adjustment | Look up the workbook percentage adjustment for `Raw melee OB` and `abs(Modifier)`. |
| Final OB | If modifier is positive or zero, `Raw melee OB + adjustment`; otherwise `Raw melee OB - adjustment`. |

Any live attack situational modifier is added after the workbook OB result.

`trained-skill bonus` is `+1` when the character has the relevant weapon skill. If the character uses a weapon without the relevant skill, the `+1` trained-skill bonus is not added.

### Projectile and thrown OB

Projectile and thrown rows use the projectile OB formula.

| Step | Formula |
| --- | --- |
| Raw projectile OB | `round(skill XP / 2) + trained-skill bonus + DEX GM` |
| Modifier | `armor AA modifier + weapon OB` |
| Adjustment | Look up the workbook percentage adjustment for `Raw projectile OB` and `abs(Modifier)`. |
| Final OB | If modifier is positive or zero, `Raw projectile OB + adjustment`; otherwise `Raw projectile OB - adjustment`. |

Thrown weapon OB uses `Throwing` XP instead of the weapon's melee skill.

Projectile and thrown OB use the same trained-skill bonus rule: `+1` is included when the character has the relevant missile or throwing skill.

### Melee DMB

Melee DMB uses the workbook melee DMB formula when the weapon has numeric OB and DMB values.

| Step | Formula |
| --- | --- |
| Raw DMB | `STR GM + weapon DMB` |
| Reference adjustment | Workbook percentage adjustment for `Raw melee OB` and `3`. |
| Reference OB | `Raw melee OB + reference adjustment` |
| Final DMB | `Raw DMB + (Reference OB - Final OB) - (3 - weapon OB)` |

If the workbook numeric path is unavailable, DMB comes from the weapon rules data.

Thrown DMB with a numeric weapon DMB uses:

```text
Thrown DMB = STR GM + weapon DMB
```

Missile DMB generally comes from the weapon rules data unless a weapon has a formula or special text.

### Initiative

Melee initiative uses the weapon skill XP, DEX GM, weapon initiative, and a skill modifier table.

| Step | Formula |
| --- | --- |
| Skill initiative modifier | `0` for skill XP `0-10`; then `floor((skill XP - 6) / 5)` for `11-31`. |
| Base initiative | `DEX GM + weapon initiative + skill initiative modifier` |
| Game modifier adjustment | If the live game modifier is above `2` or below `-2`, add `floor(game modifier / 2)`. Otherwise add `0`. |
| Final initiative | `base initiative + game modifier adjustment` |

Missile and thrown initiative currently use:

```text
Initiative = weapon initiative + DEX GM
```

## 7. Defense values

### DB and DM

DB and DM begin with Dodge XP.

| Step | Formula |
| --- | --- |
| Base DB | `round(Dodge XP / 2) + 4 + DEX GM` |
| Equipment modifier | Defensive value from the selected weapon, shield, or item combination. |
| To-hit modifier | Lookup from current encumbrance level. |
| Equipment-only DB | Apply the workbook percentage adjustment using `equipment modifier`. |
| Full DB | Apply the workbook percentage adjustment using `equipment modifier + to-hit modifier`. |
| DM | `Full DB - equipment-only DB` |

Current to-hit modifiers by encumbrance level:

| Encumbrance level | To-hit modifier |
| ---: | ---: |
| 0 | 2 |
| 1 | 1 |
| 2 | 1 |
| 3 | 0 |
| 4 | 0 |
| 5 | -1 |
| 6 | -1 |
| 7 | -2 |
| 8 | -2 |
| 9 | -3 |
| 10 | -3 |
| 11 | -4 |
| 12 | -4 |
| 13 | -5 |
| 14 | -5 |
| 15 | -6 |

Single-item rows use that item's defensive value. Combined rows use the primary weapon defensive value plus the best available off-hand shield or second-hand weapon defensive value.

### Parry

Weapon and shield parry use Parry XP.

| Step | Formula |
| --- | --- |
| Raw parry | `round(Parry XP / 2) + 1 + DEX GM` |
| Modifier | `armor AA modifier + weapon or shield parry modifier` |
| Adjustment | Look up the workbook percentage adjustment for `Raw parry` and `abs(Modifier)`. |
| Final parry | If modifier is positive, `Raw parry + adjustment`; otherwise `Raw parry - adjustment`. |

Combined parry uses the primary and off-hand parry modifiers together.

```text
Combined parry modifier =
  armor AA modifier
  + max(1, primary parry modifier)
  + max(1, off-hand parry modifier)
```

Current app behavior / needs final rule review: the Equip Items summary still displays `Combined parry` as `-` even though the combined weapon row can calculate a parry value.

## 8. Armor effects on the Equip Items screen

The Armor card shows armor values for the currently worn armor.

| Value | Meaning |
| --- | --- |
| `Armor` | The worn armor item. |
| `General armor` | Rounded armor protection plus armor type. |
| `AA modifier` | Armor Activity modifier. This is a negative modifier from bulky armor that restricts free movement. It normally appears on very heavy armor designed mainly to protect an important person who is not expected to move freely in the fighting line. |
| `Perception modifier` | Armor modifier used by the Equip Items perception calculation. |
| `Armor coverage` | Armor values by body location. |

AA modifier is separate from armor ENC. ENC measures carried load; AA modifier affects combat and activity calculations.

Armor ENC and carried-load rules are documented in `Equipment & Encumbrance Calculations`.

## 9. Encumbrance and movement summary

The `Defence and movement` card summarizes load and movement.

| Label | Meaning |
| --- | --- |
| `Encumbrance capacity` | Carrying capacity. |
| `Enc/count/lvl` | Personal carried ENC / number of personal-load items / encumbrance level. |
| `Mov/mod` | Final movement / movement modifier. |

The movement chain is:

| Step | Formula |
| --- | --- |
| Capacity | `round(STR + SIZ + 0.5 * CON)` |
| Carried percent | `round((personal carried ENC * 100) / Capacity)` |
| Encumbrance level | Highest threshold exceeded by carried percent. |
| Movement modifier | `round((encumbrance level / 2) + shield movement modifier)` |
| Base move | If `Size GM <= 2`: `10 + STR GM + DEX GM + Size GM`; otherwise `10 + STR GM + DEX GM + 2`. |
| Final movement | `base move - workbook movement-table adjustment` |

See `Equipment & Encumbrance Calculations` for item ENC, carry modes, mount load, and the full encumbrance threshold table.

## 10. Encumbrance-dependent skills

The `Encumbrance dependent skills` table lists learned skills from combat, covert, and physical skill areas when they can be affected by load.

| Column | Meaning | Formula/source |
| --- | --- | --- |
| `Skill` | Skill name. | Current rules data. |
| `Initiative` | Skill initiative. | `DEX GM + skill initiative modifier`. |
| `Stat average` | Rounded average of the skill's linked stats. | Uses adjusted character stats. |
| `XP` | Total skill XP. | Character Sheet `Total XP` for the skill. |
| `Skill level` | Skill level before encumbrance adjustment. | `Stat average + XP`. |
| `Encumbered` | Skill level after movement modifier adjustment. | `Skill level - workbook composite adjustment`. |

Perception is a special current Equip Items path:

```text
Base perception = round((INT + POW + LCK) / 3) + Perception XP
Perception total = base perception adjusted by armor perception modifier
```

Current app behavior / needs final rule review: perception uses armor perception adjustment here, while the separate encumbrance-specific perception formula remains interim.

## 11. GMR and Hitpoints

The `Combat stats and skills` card currently shows:

| Label | Formula/source |
| --- | --- |
| `Hitpoints` | Saved rolled `Health` from chargen. |
| `GMR` | `POW + LCK - 3`, using adjusted stats. |

Current app behavior / needs final rule review: Hitpoints currently comes from rolled Health, not a later adjusted/current hitpoint track.

## 12. Known interim notes

- Character Detail and the Equip Items screen may still use different combat derivation paths.
- The combined parry summary can show `-` even when the combined row has a calculated parry value.
- Perception encumbrance and armor handling needs final rule review.
- Mount-carried encumbrance is documented separately and currently uses a simpler load calculation than personal carried load.
