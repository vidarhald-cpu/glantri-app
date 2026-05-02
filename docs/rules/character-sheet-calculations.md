# Character Sheet Calculations

## 1. Purpose and scope

This page explains the values shown on the main Character Sheet / Character Detail page.

It is written for players and GM reviewers who want to check the sheet by hand.

Combat and loadout values are only summarized here. Full OB, DMB, DB, DM, Parry, Initiative, encumbrance, and movement formulas are documented separately or will be expanded in later combat/loadout pages.

## 2. Character identity and chargen rule set

- `Character name`, `Title`, `Age`, `Gender`, and `Notes` are saved character details.
- `Society`, `Social class`, and `Profession` are labels from the character's chargen choices and the current rules data.
- `Social class` may show the saved social-class roll in parentheses.
- `Chargen rules` comes from the saved chargen rule set on the character.
- Older characters without saved chargen rules show `Legacy default`.

Changing the active chargen rule set later does not silently change the rule-set name recorded on an already finalized character.

## 3. Characteristics and GMs

The `Profile Stats` table shows:

| Column | Meaning |
| --- | --- |
| `Stats die roll` | The raw rolled value from chargen. |
| `Original` | The finished creation stat after chargen stat resolution. |
| `Current` | The current gameplay stat. Currently this is the same as `Original`. |
| `GM` | The game modifier calculated from `Current`. |

Formula:

```text
Original stat = resolved stat from chargen
Current stat = Original stat for now
GM = trunc((Current - 11) / 2)
```

`trunc` means truncate toward zero.

| Current | Calculation | GM |
| ---: | --- | ---: |
| 15 | `trunc((15 - 11) / 2)` | 2 |
| 12 | `trunc((12 - 11) / 2)` | 0 |
| 10 | `trunc((10 - 11) / 2)` | 0 |
| 8 | `trunc((8 - 11) / 2)` | -1 |

Chargen stat resolution can adjust some rolled stats before they become `Original`:

- `STR` may be adjusted by `Size`.
- `DEX` may be adjusted by `Size`.
- `CHA` may be adjusted by `Comeliness`.
- `Health` may be adjusted by `Constitution`.

`Distraction` displays its saved value and has no GM. The GM column shows `-`.

## 4. Skills table

The Skills table shows each visible trained skill grouped into player-facing categories.

### Stats and Avg stats

`Stats` lists the stats linked to the skill.

`Avg stats` is the average of those linked stats, using the rounded/floored value shown by the app.

Formula:

```text
Avg stats = average of the skill's linked stats
```

Use the displayed `Avg stats` value when checking `Total skill level`.

### Group XP

`Group XP` is the best active skill-group contribution for that skill.

Formula:

```text
Group XP = highest applicable active skill-group level for this skill
Skill group level = group ranks + group GMs
```

If a skill belongs to more than one bought group, only the best group contribution counts. Group XP values are not added together.

### Skill XP

`Skill XP` is XP bought or granted for that specific skill outside the chosen group contribution.

Formula:

```text
Skill XP = granted/specific ranks + ordinary ranks + secondary ranks for that skill
```

### Derived XP

`Derived XP` is XP from related skills, cross-training, or specialization rules.

The Character Sheet shows Derived XP as its own column. It may also show a source label such as `Cross-trained from ...`.

Derived XP rules and skill relationships can be reviewed in Admin -> Skills.

### Total XP

`Total XP` is the effective skill XP before linked stats are added.

Formula:

```text
Total XP = Group XP + Skill XP + Derived XP
```

Combat calculations use this total skill XP value, not only Skill XP and not only Group XP.

### Total skill level

`Total skill level` adds `Avg stats` to `Total XP`.

Formula:

```text
Total skill level = Avg stats + Total XP
```

## 5. Specializations

Specializations are shown separately from ordinary skills.

The Specializations table shows:

| Column | Meaning |
| --- | --- |
| `Specialization` | The specialization name. |
| `Parent skill` | The skill the specialization belongs to. |
| `Specialization XP` | XP bought for that specialization. |
| `Derived XP` | XP from specialization or cross-training effects. |
| `Total` | Final specialization value shown on the sheet. |

Specializations are gated by parent skill access and parent skill level requirements.

Examples:

- `Longbow` is a specialization of `Bow`.
- `Fencing` is a specialization of `1-h edged`.

Formula:

```text
Total specialization = floor(parent group contribution / 2)
  + Specialization XP
  + Derived XP
```

`Derived XP` is included in `Total`.

## 6. Skill points and education

### Ordinary and flexible points

`Ordinary skill points` come from the saved chargen rule set.

Formula:

```text
Ordinary skill points = chargenRuleSet.ordinarySkillPoints
```

Flexible points use the current chargen formula multiplied by the saved rule-set factor.

Formula:

```text
Flexible points = floor((resolved INT + resolved LCK) * flexiblePointFactor)
```

With the standard rule set, `flexiblePointFactor = 1`.

### Individual skill pricing

```text
Ordinary skill cost = 2
Secondary skill cost = 1
```

### Skill group pricing

Skill group cost is dynamic.

Formula:

```text
Skill group cost = floor(0.6 * total individual cost of active group skills)
Minimum cost = 1 when at least one active skill exists
```

`Active group skills` means fixed group skills plus selected slot skills.

Unselected slot candidates do not count. Required-slot groups cannot be bought or raised until their required choices are selected.

Examples:

| Group shape | Individual-cost total | Group cost |
| --- | ---: | ---: |
| Three ordinary skills | `2 + 2 + 2 = 6` | `floor(0.6 * 6) = 3` |
| Dodge, Parry, Brawling, and one selected secondary weapon | `1 + 1 + 1 + 1 = 4` | `floor(0.6 * 4) = 2` |
| Perception, Concentration, Weapon Maintenance, and one selected secondary missile weapon | `2 + 2 + 1 + 1 = 6` | `floor(0.6 * 6) = 3` |
| One selected ordinary craft skill | `2` | `max(1, floor(0.6 * 2)) = 1` |

### Skill points summary

The Character Sheet summary shows spent and remaining skill points.

Formula:

```text
Spent = total skill points invested
Remaining = ordinary pool remaining + flexible pool remaining
```

### Education

`Education` combines base education, social-class education, and education-linked learned skills.

Formula:

```text
Education = base education
  + social class education value
  + education-linked skill count
```

## 7. Known interim notes

- Linked stat average source still needs final standardization if rolled, resolved, and adjusted stats differ.
- Combat/loadout formulas are documented separately.
- Character Detail and the loadout panel may still use different combat derivation paths.
- Remaining points combine ordinary and flexible remaining pools.
