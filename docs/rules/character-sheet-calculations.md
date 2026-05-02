# Character Sheet Calculations

## 1. Purpose and scope

This page documents the values shown on the main Character Sheet / Character Detail page.

It is written for players and GM reviewers who want to manually verify the numbers shown in the app.

Combat and loadout workbook values are only summarized here. Full OB, DMB, DB, DM, Parry, Initiative, encumbrance, and movement formulas are documented separately or will be expanded in later combat/loadout pages.

## 2. Character identity and chargen rule set

- `Character name`, `Title`, `Age`, `Gender`, and `Notes` are stored character fields.
- `Society`, `Social class`, and `Profession` are labels from the character's chargen choices and the current canonical content.
- `Social class` may show the stored social-class roll in parentheses.
- `Chargen rules` comes from the chargen rule-set snapshot saved on the character.
- Older characters without a saved rule-set snapshot show `Legacy default`.

Changing the active chargen rule set later does not silently change the rule-set name recorded on an already finalized character.

## 3. Characteristics and GMs

The `Profile Stats` table shows `Stats die roll`, `Original`, `Current`, and `GM`.

- `Stats die roll` is the raw rolled stat stored from chargen.
- `Original` is the finished stat at character creation after chargen stat-resolution effects.
- `Current` is the current gameplay stat after later advancement, injury, effects, or other post-creation changes.
- `GM` is the displayed game modifier for the current stat.

Current app behavior: character advancement, injury, and persistent current-stat effects are not implemented yet, so `Current` currently equals `Original`.

Formula:

```text
Original stat = resolved stat from chargen
Current stat = Original stat for now
Displayed GM = trunc((Current stat - 11) / 2)
```

`trunc` means truncate toward zero. For example:

| Current stat | Calculation | Displayed GM |
| --- | --- | --- |
| 15 | `trunc((15 - 11) / 2)` | `2` |
| 12 | `trunc((12 - 11) / 2)` | `0` |
| 10 | `trunc((10 - 11) / 2)` | `0` |
| 8 | `trunc((8 - 11) / 2)` | `-1` |

Current chargen-resolution inputs:

- `STR` may be adjusted by `Size`.
- `DEX` may be adjusted by `Size`.
- `CHA` may be adjusted by `Comeliness`.
- `Health` may be adjusted by `Constitution`.

These are chargen-resolution inputs, not manual sheet edits.

`Distraction` displays its stored value and has no GM. The GM column shows `-`.

## 4. Skill XP columns

The Skills table shows each visible trained skill grouped into player-facing categories.

### Group XP

`Group XP` is the best active skill-group contribution for that skill.

Formula:

```text
Group XP = highest applicable active skill-group level for this skill
Skill group level = group ranks + group GMs
```

If a skill belongs to multiple bought groups, only the best group contribution counts. Group contributions are not added together.

### Skill XP

`Skill XP` is XP/ranks bought or granted directly for that specific skill.

Formula:

```text
Skill XP = granted/specific ranks + ordinary ranks + secondary ranks for that skill row
```

For most manual checking, read this as: XP invested directly into that skill outside the chosen skill-group contribution.

### Derived XP

`Derived XP` is relationship-derived XP, such as melee cross-training, explicit derived grants, or specialization bridge effects.

The Character Sheet shows Derived XP as its own column. It may also show a source label such as `Cross-trained from ...`.

Derived XP rules and skill relationships can be reviewed in Admin -> Skills.

### Total XP

`Total XP` is the effective skill XP before linked stats are added.

Formula:

```text
Total XP = Group XP + Skill XP + Derived XP
```

Combat calculations use this total skill XP value, not only direct skill XP and not only group XP.

### Total skill level

`Total skill level` adds the skill's linked-stat average to Total XP.

Formula:

```text
Total skill level = linked stat average + Total XP
```

## 5. Linked stat average

Each skill has linked stats, shown in the `Stats` column.

Formula:

```text
Linked stat average = average of the skill's linked stats
```

The app displays the rounded/floored value in `Avg stats`.

Current app behavior / needs final rule decision: the exact stat source should be standardized if there is a rolled, resolved, or adjusted-stat discrepancy. Until then, use the `Avg stats` value displayed by the app when manually checking `Total skill level`.

## 6. Specializations

Specializations are shown separately from ordinary skills.

The Specializations table shows:

- `Specialization`
- `Parent skill`
- `Specialization XP`
- `Derived XP`
- `Total`

Specializations are gated by parent skill access and parent skill level requirements.

Examples:

- `Longbow` is a specialization of `Bow`. It is not a normal missile weapon skill.
- `Fencing` is a specialization of `1-h edged`.

Current formula:

```text
Total specialization = floor(parent group contribution / 2)
  + Specialization XP
  + Derived XP
```

`Parent group contribution` means the active group contribution used for the parent skill in the specialization calculation path.

Bridge-derived specialization XP is shown in the `Derived XP` column and is included in `Total`.

## 7. Skill points and education

### Ordinary points

`Ordinary skill points` come from the saved chargen rule set:

```text
Ordinary skill points = chargenRuleSet.ordinarySkillPoints
```

Ordinary skill first/raise cost:

```text
Ordinary skill cost = 2
```

### Flexible points

Flexible points use the current chargen formula multiplied by the saved rule-set factor.

Formula:

```text
Flexible points = floor((resolved INT + resolved LCK) * flexiblePointFactor)
```

With the standard rule set, `flexiblePointFactor = 1`.

Secondary skill first/raise cost:

```text
Secondary skill cost = 1
```

### Skill group pricing

Skill group cost is dynamic.

Formula:

```text
Skill group cost = floor(0.6 * total individual cost of active group skills)
Minimum cost = 1 when at least one active skill exists
```

`Active group skills` means:

- fixed skills in the group
- selected slot skills

Unselected slot candidates do not count.

Required-slot groups cannot be bought or raised until their required choices are selected.

Examples:

| Group shape | Individual-cost total | Group cost |
| --- | ---: | ---: |
| Three ordinary skills | `2 + 2 + 2 = 6` | `floor(0.6 * 6) = 3` |
| Dodge, Parry, Brawling, and one selected secondary weapon | `1 + 1 + 1 + 1 = 4` | `floor(0.6 * 4) = 2` |
| Perception, Concentration, Weapon Maintenance, and one selected secondary missile weapon | `2 + 2 + 1 + 1 = 6` | `floor(0.6 * 6) = 3` |
| One selected ordinary craft skill | `2` | `max(1, floor(0.6 * 2)) = 1` |

### Skill points summary

The Character Sheet summary shows spent and remaining skill points.

Current app behavior:

```text
Spent = total skill points invested
Remaining = ordinary pool remaining + flexible pool remaining
```

The summary combines the remaining ordinary and flexible pools into one displayed value.

### Education

The Character Sheet shows `Education` as a single value.

Current app behavior:

```text
Education = base education
  + social class education value
  + theoretical/education-linked skill count
```

Current app behavior / needs final rule decision: the current label combines these inputs into one number, so the label is useful but slightly compressed.

## 8. Known interim notes

- Character Detail and the loadout panel may use different combat derivation paths. The workbook-style loadout formulas should be documented separately.
- Linked stat average source needs final standardization if rolled, resolved, and adjusted stats differ.
- Full combat/loadout formulas for OB, DMB, DB, DM, Parry, Initiative, armor, encumbrance, and movement will be documented separately.
