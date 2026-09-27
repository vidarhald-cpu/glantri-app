# Chargen Calculations

## 1. Purpose and scope

This page explains the calculations and rules shown during character generation.

It covers profile rolls, stat resolution, social class, education, skill points, skill-group costs, choices, and finalization. It does not change any character generation rules.

For related references:

- See `Character Sheet Calculations` for final sheet values after chargen.
- See `Equipment & Encumbrance Calculations` for carried load.
- See `Equip Items Calculations` for equipped weapon, armor, movement, and combat values.

Quick lookup:

| What you see in Chargen | Where this doc explains it                                         |
| ----------------------- | ------------------------------------------------------------------ |
| Profile roll cards      | `Stat/profile rolls`                                               |
| Resolve stats           | `Resolve stats` and `Exchanges and builds`                         |
| Choose civilization     | `Civilization, society, and social class`                          |
| Social class            | `Stat/profile rolls` and `Civilization, society, and social class` |
| Choose profession       | `Profession packages and choices`                                  |
| Skill allocation        | `Ordinary and flexible skill points` and `Skill purchases`         |
| Other skills            | `Skill purchases` and `Profession packages and choices`            |
| Specializations         | `Derived XP and specializations`                                   |
| Review summary          | `Review summary and finalization`                                  |
| Finalize character      | `Review summary and finalization`                                  |

## 2. Chargen rule set

App section: Chargen header and `Review summary`.

Chargen uses the active chargen rule set. Admins can manage rule sets in `Admin -> Chargen Setup`, where the current active values are shown.

Finalized characters save the chargen rule-set name and parameters that were used. Changing the active rule set later does not silently change already-finalized characters. Older characters without saved chargen rules show `Legacy default`.

The bounded retained-Character headless path additionally pins the exact Pilot Skill rules,
canonical content-release identity/version/digest, and complete campaign/Chargen configuration
snapshot. It commits an append-only acquisition ledger and the authoritative effective-Skill read
model described in [Retained Character Ledger and Headless Chargen](./retained-character-ledger.md).
The existing visual Chargen wizard is not replaced by this headless foundation.

Custom rule sets can change these values. The table below shows the legacy/default values used when no custom active rule set overrides them.

| Rule-set parameter      | Meaning                                                                 | Default value |
| ----------------------- | ----------------------------------------------------------------------- | ------------: |
| `Stat roll count`       | Number of profile roll cards generated.                                 |            20 |
| `Exchanges allowed`     | Number of stat exchanges allowed after choosing a profile.              |             2 |
| `Ordinary skill points` | Ordinary points available for normal chargen skill and group purchases. |            60 |
| `Flexible point factor` | Multiplier for flexible point calculation.                              |             1 |

## 3. Stat/profile rolls

App section: Chargen step `Profile rolls`.

Each profile card has rolled stats, a distraction level, and a social class roll.

| Value             | Roll rule                                |
| ----------------- | ---------------------------------------- |
| Profile stats     | Each stat is `4d6, drop the lowest die`. |
| Distraction       | `1d3 + 1d3`.                             |
| Social class roll | `1d20`.                                  |

The rule set's `Stat roll count` controls how many profile cards are generated. It does not change the dice used for social class or distraction.

Future-rule note: the current default social class roll is one `d20`. Earlier spreadsheet versions experimented with more generous methods such as best-of-two `d20`. That is not the current default rule, but it may later become a configurable chargen rule-set option for campaigns where higher social access is intended.

`Stats die roll` on the Character Sheet means the rolled or adjusted chargen stat before final stat-resolution effects are applied.

## 4. Resolve stats

App section: Chargen step `Resolve stats`.

After profile selection and any stat exchanges/builds, chargen resolves the final creation stats.

The app uses a stat modifier table for some adjustments.

| Stat value | Modifier |
| ---------: | -------: |
|          1 |       -5 |
|        2-3 |       -4 |
|        4-5 |       -3 |
|        6-7 |       -2 |
|        8-9 |       -1 |
|      10-12 |        0 |
|      13-14 |        1 |
|      15-16 |        2 |
|      17-18 |        3 |
|      19-20 |        4 |
|      21-22 |        5 |
|      23-24 |        6 |
|         25 |        7 |

Current stat-resolution effects:

| Resolved stat | Formula                                   |
| ------------- | ----------------------------------------- |
| `STR`         | `rolled STR + stat modifier from SIZ`     |
| `DEX`         | `rolled DEX + Size-to-DEX modifier`       |
| `CHA`         | `rolled CHA + stat modifier from COM`     |
| `Health`      | `rolled Health + stat modifier from CON`  |
| Other stats   | Use the rolled or adjusted chargen value. |

Size-to-DEX modifier:

| Size condition            |         Modifier |
| ------------------------- | ---------------: |
| `SIZ > 14`                | `-(Size GM - 1)` |
| `SIZ > 9` and `SIZ <= 14` |              `0` |
| `SIZ <= 9`                |       `-Size GM` |

`Size GM` uses the same stat modifier table above.

## 5. Exchanges and builds

App section: Chargen step `Resolve stats`.

Exchanges and builds happen before final stat resolution.

| Adjustment        | Current rule                                                   |
| ----------------- | -------------------------------------------------------------- |
| Exchange          | Swap two different stats.                                      |
| Exchanges allowed | Comes from the active chargen rule set.                        |
| Build             | Increase one stat by `1` and decrease a different stat by `2`. |
| Builds allowed    | Currently fixed at `2`.                                        |
| Build lower bound | The decreased stat cannot go below `1`.                        |
| Build upper bound | The increased stat cannot go above `25`.                       |

Exchange count and build count are tracked separately.

## 6. Civilization, society, and social class

App section: Chargen steps `Choose civilization` and `Social class`.

Approved future boundary: Characters will be created within a Setting, and
contextual Skill choices will bind to Setting-defined contexts during
Setting-first Chargen. The current civilization, Society, and Skill Reference
Society/Availability selectors remain transitional until that separately
authorized sequence is implemented. This note does not change the calculations
or current runtime behavior below. See
[Architecture decision 0006](../decisions/architecture/0006-setting-foundation.md).

Civilization determines language/culture setup and links to a society model.

Society determines social-band labels, available professions, baseline languages, skill access, and education setup.

Social class roll maps to one of four social bands:

| Social class roll | Social band |
| ----------------: | ----------: |
|              1-10 |           1 |
|             11-15 |           2 |
|             16-18 |           3 |
|             19-20 |           4 |

The social-class table also gives a label and education value:

| Social class roll | Label         | Education value |
| ----------------: | ------------- | --------------: |
|              1-10 | `Bønder`      |               2 |
|             11-15 | `Håndverkere` |               4 |
|             16-18 | `Storbønder`  |               6 |
|             19-20 | `Adelen`      |               8 |

Society stage and social class band are separate ideas. Society stage is the civilization/society's development level; social class band is the character's access band inside that society.

## 7. Mother tongue and languages

App section: Chargen steps `Choose civilization`, `Skill allocation`, and `Other skills`.

Mother tongue is granted automatically from the selected civilization.

Formula:

```text
Mother tongue starting XP = max(11, Education)
```

Extra language choices create concrete `Language (Name)` entries when selected. The raw `Language` skill is not used as a standalone trained language row for players.

Society baseline languages are required. Civilization optional languages can be selected when available.

## 8. Education

App section: Chargen `Review summary`.

Education combines the selected society/civilization setup, social class, and education-linked learned skills.

| Input                        | Meaning                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| Base education               | Starting education from the selected society/civilization setup. |
| Social class education value | Education value from the social class band.                      |
| Education-linked skills      | Learned skills that add to Education.                            |

Formula:

```text
Education = base education + social class education value + education-linked skill count
```

The Chargen review summary shows `Education`, `Base education`, `Social class education value`, and `Education-linked skills`. Education-linked skill metadata can be reviewed in `Admin -> Skills`.

## 9. Ordinary and flexible skill points

App section: Chargen steps `Skill allocation`, `Other skills`, and `Review summary`.

Ordinary points are used for normal chargen skill and skill-group purchases.

```text
Ordinary skill points = active rule set ordinary skill points
```

Flexible points are used when ordinary points are not available or when buying outside normal profession/society access.

```text
Flexible points = floor((resolved INT + resolved LCK) * flexible point factor)
```

The flexible point factor comes from the active chargen rule set. With the default rule set, the factor is `1`.

Normal-access purchases spend ordinary points first when enough ordinary points remain. If ordinary points cannot cover the cost, a normal-access purchase may use flexible points. Outside-normal-access skill purchases use flexible points.

## 10. Skill purchases

App section: Chargen steps `Skill allocation`, `Other skills`, and `Specializations`.

Individual skill costs:

| Purchase                         | Cost |
| -------------------------------- | ---: |
| Ordinary skill increase          |    2 |
| Secondary skill increase         |    1 |
| New specialization               |    4 |
| Existing specialization increase |    2 |

Skill group cost is dynamic.

```text
G_s            = highest active group contribution to Skill s
usefulGroup_s  = max(0, G_s - relationshipFloor_s)
weightedUseful = sum(individual cost of s * usefulGroup_s)
Skill group cost = ceil(2/3 * weightedUseful)
```

The ceiling is applied **once** to the complete bundle of purchased Learning Groups, never
per group and never per rank, so the price of a purchase is the change in the bundle price.
A Group contribution that yields no useful competence yields no price. A Learning Group that
teaches no base membership and exists only to open authored Specialization access keeps a flat
cost of `1` per purchase.

This is the shared canonical Learning Group acquisition arithmetic in
[`pilot-skill-rules-v1.md`](./pilot-skill-rules-v1.md) section 4, which both the
Pilot/runtime acquisition path and the Chargen path now consume (Forgejo #381). It replaces
the former Chargen-local `floor(0.6 * total individual cost)` scalar with its minimum of `1`.

Active group skills are:

```text
Active group skills = fixed group skills + selected choice-slot skills
```

Fixed group skills are always part of the group. Choice slots require choosing one or more skills, such as choosing `Bow` for `Basic Missile Training` or `Smithing` for `Craft Specialty`.

Unselected slot candidates do not count toward group cost and do not become trained skills. Required-slot groups cannot be bought or raised until their required choices are selected.

## 11. Profession packages and choices

App section: Chargen step `Choose profession`, then `Skill allocation`.

A profession grants access to included training packages and sometimes specific skills. Those packages define what the character may buy during chargen; they are not all automatic XP.

The review summary shows:

| UI label                 | Meaning                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `Skill groups`           | Skill groups currently represented in the draft.                                   |
| `Skills`                 | Skill rows currently represented in the draft.                                     |
| `Core skills`            | Profession/package skills that are directly included and not only slot candidates. |
| `Required group choices` | Required choice slots from available profession groups.                            |
| `Selectable pool`        | Other selectable skills from current profession/society access.                    |
| `Chosen skills`          | Skills selected from free choices or group slots.                                  |

Selected slot skills appear under their owning group. Unselected slot candidates should not appear as direct skills.

## 12. Derived XP and specializations

App section: Chargen step `Specializations`.

Derived XP may come from related skills, cross-training, or specialization rules.

Derived relationship definitions can be reviewed in `Admin -> Skills`.

Specializations are gated by parent skill access and parent skill level requirements.

Examples:

- `Longbow` is a specialization of `Bow`; it is not a normal missile weapon choice.
- `Fencing` is a specialization of `1-h edged`.

## 13. Review summary and finalization

App section: Chargen steps `Review summary` and `Finalize character`.

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

- General Character advancement remains incomplete. Retained Pilot Characters support the bounded
  current-GM-authorized learning-history advancement seam documented above.
- Some formula labels may be refined as the docs mature.
- Combat and equipment calculations are documented in separate pages.

## Target Learning Groups and Professions — combined #206 capability

New target Chargen uses the approved 59-group graph and 84 Profession families. A selected explicit track preserves its family and concrete identity; other family opportunities form an additive access menu. Profession selection supplies no ranks, XP or points. Contextual #113 restrictions and legacy Society/Social Band availability are not applied to these unbound choices.

An accessible Learning Group is priced through the shared canonical acquisition arithmetic: the complete purchased bundle costs `ceil(2/3 * weightedUseful)`, where `weightedUseful` sums each base member's individual cost times `max(0, G_s - relationshipFloor_s)`. The nine explicit Specialization memberships are excluded from that sum and group contribution: they provide access only, with separate initial 4 / increase 2 costs and immediate-parent eligibility. A group that teaches no base membership and exists only to open Specialization access costs a flat `1` per purchase. Flexible funding does not authorize an otherwise inaccessible group. Overlapping groups use the best-contribution calculation for one competency identity, and a membership that produces no useful competence produces no price (Forgejo #381).

Target builds retain family/track/source identity and approved group definitions for later display. Historical builds retain their actual identities, levels and recorded expenditure; this change performs no migration or retroactive repricing. Server validation resolves the approved catalogue and rejects forged membership, family/track or purchase-price claims.

## Bounded P09/P14 purchase alternatives

The current #206 PO ruling makes P09 Sailor and Boat Worker’s F09/G06 routes alternative group purchases: F09 is the fuller rigged-vessel route and replaces G06 for that path. P14 Guard, Watcher and Escort’s F30/G08 group routes are likewise mutually exclusive; G08+F35 remains permitted when both sets are taught. These rules apply only to purchases through those Professions. They do not exclude independent/direct competency purchases, create tracks or imply exclusions elsewhere. Each alternative retains its existing cost and access rules; refused purchases leave spending and progression unchanged.
