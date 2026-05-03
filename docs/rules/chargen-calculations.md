# Chargen Calculations

## 1. Purpose and scope

This page explains the calculations and rules shown during character generation.

It covers profile rolls, stat resolution, social class, education, skill points, skill-group costs, choices, and finalization. It does not change any character generation rules.

For related references:

- See `Character Sheet Calculations` for final sheet values after chargen.
- See `Equipment & Encumbrance Calculations` for carried load.
- See `Equip Items Calculations` for equipped weapon, armor, movement, and combat values.

## 2. Chargen rule set

Chargen uses the active chargen rule set. Admins can manage rule sets in `Admin -> Chargen Setup`.

Finalized characters save the chargen rule-set name and parameters that were used. Changing the active rule set later does not silently change already-finalized characters. Older characters without saved chargen rules show `Legacy default`.

| Rule-set parameter | Meaning | Standard value |
| --- | --- | ---: |
| `Stat roll count` | Number of profile roll cards generated. | 20 |
| `Exchanges allowed` | Number of stat exchanges allowed after choosing a profile. | 2 |
| `Ordinary skill points` | Ordinary points available for normal chargen skill and group purchases. | 60 |
| `Flexible point factor` | Multiplier for flexible point calculation. | 1 |

## 3. Stat/profile rolls

Each profile card has rolled stats, a distraction level, and a social class roll.

| Value | Current roll rule |
| --- | --- |
| Profile stats | Each stat is `4d6, drop the lowest die`. |
| Distraction | `1d3 + 1d3`. |
| Social class roll | Best of two `d20` rolls. |

The rule set's `Stat roll count` controls how many profile cards are generated. It does not change the dice used for social class or distraction.

`Stats die roll` on the Character Sheet means the rolled or adjusted chargen stat before final stat-resolution effects are applied.

## 4. Resolve stats

After profile selection and any stat exchanges/builds, chargen resolves the final creation stats.

The app uses a stat modifier table for some adjustments.

| Stat value | Modifier |
| ---: | ---: |
| 1 | -5 |
| 2-3 | -4 |
| 4-5 | -3 |
| 6-7 | -2 |
| 8-9 | -1 |
| 10-12 | 0 |
| 13-14 | 1 |
| 15-16 | 2 |
| 17-18 | 3 |
| 19-20 | 4 |
| 21-22 | 5 |
| 23-24 | 6 |
| 25 | 7 |

Current stat-resolution effects:

| Resolved stat | Formula |
| --- | --- |
| `STR` | `rolled STR + stat modifier from SIZ` |
| `DEX` | `rolled DEX + Size-to-DEX modifier` |
| `CHA` | `rolled CHA + stat modifier from COM` |
| `Health` | `rolled Health + stat modifier from CON` |
| Other stats | Use the rolled or adjusted chargen value. |

Size-to-DEX modifier:

| Size condition | Modifier |
| --- | ---: |
| `SIZ > 14` | `-(Size GM - 1)` |
| `SIZ > 9` and `SIZ <= 14` | `0` |
| `SIZ <= 9` | `-Size GM` |

`Size GM` uses the same stat modifier table above.

## 5. Exchanges and builds

Exchanges and builds happen before final stat resolution.

| Adjustment | Current rule |
| --- | --- |
| Exchange | Swap two different stats. |
| Exchanges allowed | Comes from the active chargen rule set. |
| Build | Increase one stat by `1` and decrease a different stat by `2`. |
| Builds allowed | Currently fixed at `2`. |
| Build lower bound | The decreased stat cannot go below `1`. |
| Build upper bound | The increased stat cannot go above `25`. |

Exchange count and build count are tracked separately.

## 6. Civilization, society, and social class

Civilization determines language/culture setup and links to a society model.

Society determines social-band labels, available professions, baseline languages, skill access, and education setup.

Social class roll maps to one of four social bands:

| Social class roll | Social band |
| ---: | ---: |
| 1-10 | 1 |
| 11-15 | 2 |
| 16-18 | 3 |
| 19-20 | 4 |

The social-class table also gives a label and education value:

| Social class roll | Label | Education value |
| ---: | --- | ---: |
| 1-10 | `Bønder` | 2 |
| 11-15 | `Håndverkere` | 4 |
| 16-18 | `Storbønder` | 6 |
| 19-20 | `Adelen` | 8 |

Society stage and social class band are separate ideas. Society stage is the civilization/society's development level; social class band is the character's access band inside that society.

## 7. Mother tongue and languages

Mother tongue is granted automatically from the selected civilization.

Formula:

```text
Mother tongue starting XP = max(11, Education)
```

Extra language choices create concrete `Language (Name)` entries when selected. The raw `Language` skill is not used as a standalone trained language row for players.

Society baseline languages are required. Civilization optional languages can be selected when available.

## 8. Education

Education combines society, social class, and learned education-linked skills.

| Input | Meaning |
| --- | --- |
| Base education | Starting education from the selected society/social band row. |
| Social class education value | Education value from the social class roll. |
| Education-linked learned skills | Count of learned theoretical skills. |

Formula:

```text
Education = base education + social class education value + learned theoretical skill count
```

The current app label for the total is `Education`.

## 9. Ordinary and flexible skill points

Ordinary points are used for normal chargen skill and skill-group purchases.

```text
Ordinary skill points = active rule set ordinary skill points
```

Flexible points are used when ordinary points are not available or when buying outside normal profession/society access.

```text
Flexible points = floor((resolved INT + resolved LCK) * flexible point factor)
```

The flexible point factor comes from the active chargen rule set. With the standard rule set, the factor is `1`.

Normal-access purchases spend ordinary points first when enough ordinary points remain. If ordinary points cannot cover the cost, a normal-access purchase may use flexible points. Outside-normal-access skill purchases use flexible points.

## 10. Skill purchases

Individual skill costs:

| Purchase | Cost |
| --- | ---: |
| Ordinary skill increase | 2 |
| Secondary skill increase | 1 |
| New specialization | 4 |
| Existing specialization increase | 2 |

Skill group cost is dynamic.

```text
Skill group cost = floor(0.6 * total individual cost of active group skills)
Minimum cost = 1 when at least one active skill exists
```

Active group skills are:

```text
Active group skills = fixed group skills + selected choice-slot skills
```

Fixed group skills are always part of the group. Choice slots require choosing one or more skills, such as choosing `Bow` for `Basic Missile Training` or `Smithing` for `Craft Specialty`.

Unselected slot candidates do not count toward group cost and do not become trained skills. Required-slot groups cannot be bought or raised until their required choices are selected.

## 11. Profession packages and choices

A profession grants access to included training packages and sometimes specific skills. Those packages define what the character may buy during chargen; they are not all automatic XP.

The review summary shows:

| UI label | Meaning |
| --- | --- |
| `Skill groups` | Skill groups currently represented in the draft. |
| `Skills` | Skill rows currently represented in the draft. |
| `Core skills` | Profession/package skills that are directly included and not only slot candidates. |
| `Required group choices` | Required choice slots from available profession groups. |
| `Selectable pool` | Other selectable skills from current profession/society access. |
| `Chosen skills` | Skills selected from free choices or group slots. |

Selected slot skills appear under their owning group. Unselected slot candidates should not appear as direct skills.

## 12. Derived XP and specializations

Derived XP may come from related skills, cross-training, or specialization rules.

Derived relationship definitions can be reviewed in `Admin -> Skills`.

Specializations are gated by parent skill access and parent skill level requirements.

Examples:

- `Longbow` is a specialization of `Bow`; it is not a normal missile weapon choice.
- `Fencing` is a specialization of `1-h edged`.

## 13. Review summary and finalization

Before finalization, Chargen summarizes the selected profile, civilization, society, social band, social class, profession, mother tongue, selected languages, skill counts, point spending, and education.

Finalization checks:

- ordinary pool is not overspent,
- flexible pool is not overspent,
- ordinary spending is valid for the selected profession and society,
- dependency and specialization gates are satisfied,
- required group choices are complete.

Finalized characters save:

- character name,
- selected profile,
- selected society and social class,
- selected profession,
- progression and selected choices,
- education,
- saved chargen rule-set name and parameters.

Creator or owner attribution is handled by the character record around the saved build.

## 14. Known interim notes

- Character advancement is not implemented yet.
- Some formula labels may be refined as the docs mature.
- Combat and Equip Items calculations are documented in separate pages.
