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

| Column          | Meaning                                                                                 |
| --------------- | --------------------------------------------------------------------------------------- |
| `Rolled / base` | The raw chargen roll or generated-character base, before creation adjustments.          |
| `Original`      | The finalized creation stat after authorized chargen/GM adjustments and creation rules. |
| `Developed`     | `Original` plus permanent post-creation development.                                    |
| `Current`       | The presently applicable stat, including temporary or semi-long-term changes.           |
| `GM`            | The game modifier calculated from `Current`.                                            |

Formula:

```text
Original stat = finalized chargen stat
Developed stat = Original stat + permanent development
Current stat = Developed stat + currently applicable changes
GM = trunc((Current - 11) / 2)
```

Example:

```text
Rolled / base 12
  + authorized chargen adjustment 1
= Original 13
  + later permanent development 1
= Developed 14
= Current 14 when no temporary or semi-long-term change applies
```

Magic, rituals, drugs, curses, bodily enhancement, and similar sustained changes may eventually
change `Current` without changing `Developed`. A modifier that applies to one roll or one
circumstance is applied to that roll instead; it does not change the Character's `Current` stat.

`trunc` means truncate toward zero.

A Characteristic is an integer from `1` to `25`, so every GM the app can show is in the table
below. Read it instead of evaluating the formula at the table:

| Current |  GM |
| ------: | --: |
|       1 |  -5 |
|     2–3 |  -4 |
|     4–5 |  -3 |
|     6–7 |  -2 |
|     8–9 |  -1 |
|   10–12 |   0 |
|   13–14 |   1 |
|   15–16 |   2 |
|   17–18 |   3 |
|   19–20 |   4 |
|   21–22 |   5 |
|   23–24 |   6 |
|      25 |   7 |

**Below `11`, truncation toward zero rounds a negative result up, not down.** This is where reading
the table beats evaluating the formula: at every even `Current` from `2` to `10`, truncating gives
a GM one higher than rounding downward would. `Current 10` gives GM `0` and not `-1`, because
`trunc((10 - 11) / 2)` is `trunc(-0.5)`, which is `0`. The same applies at `2`, `4`, `6` and `8`.

One consequence is visible in the table: the GM `0` band covers `10`, `11` and `12`, three values,
where the bands between `2` and `24` are two values each.

Worked example: `Current 14` gives `trunc((14 - 11) / 2)` = `trunc(1.5)` = GM `1`.

Chargen stat resolution can adjust some rolled stats before they become `Original`:

- `STR` may be adjusted by `Size`.
- `DEX` may be adjusted by `Size`.
- `CHA` may be adjusted by `Comeliness`.
- `Health` may be adjusted by `Constitution`.

`Distraction` displays its saved value and has no GM. The GM column shows `-`.

Older Characters whose raw roll was not stored separately show `—` under `Rolled / base`. Their
known `Original`, `Developed`, and `Current` gameplay values remain available; the app does not
guess or rewrite missing roll provenance.

## 4. Skills table

The Skills table shows each visible trained skill grouped into player-facing categories.

For retained Pilot Characters, the authoritative server row is governed by
[Retained Character Ledger and Headless Chargen](./retained-character-ledger.md): direct ranks and
explicit grants add to the strongest owned history, then the strongest non-recursive relationship
acts as a floor (`E = max(A, R)`). Relationship competence is not added a second time. The legacy
columns below remain the compatibility presentation for older Character builds until the later
Character Sheet UI consumes the retained read model directly.

### Stats and Avg stats

`Stats` lists the stats linked to the skill.

`Avg stats` is the average of the linked `Current` stats, using the rounded/floored value shown by
the app.

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

`Skill XP` is XP on the skill itself. It is separate from XP received through a skill group.

Skill XP can come from:

- points spent directly on that skill
- direct profession or society grants
- other specific skill grants saved on the character

Skill XP does not include `Group XP`. It does not include `Derived XP`. `Total XP` is where these parts are added together.

Formula:

```text
Skill XP = direct XP on this skill
```

Internally this includes ordinary, secondary, and specific/granted ranks recorded for that skill.

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

| Column              | Meaning                                           |
| ------------------- | ------------------------------------------------- |
| `Specialization`    | The specialization name.                          |
| `Parent skill`      | The skill the specialization belongs to.          |
| `Specialization XP` | XP bought for that specialization.                |
| `Derived XP`        | XP from specialization or cross-training effects. |
| `Total`             | Final specialization value shown on the sheet.    |

Specializations are gated by parent skill access and parent skill level requirements.

Examples:

- `Longbow` is a specialization of `Bow`.
- `Fencing` is a specialization of `1-h edged`.

Formula:

```text
Total specialization = Specialization XP + Derived XP
```

No Learning Group level is part of this total. A Learning Group that lists a specialization provides an access and training route only: Group cost and Group XP stay on the group's base skills, the specialization is acquired and progressed separately, there is no retroactive Group XP catch-up, and later group purchases add nothing to it ([rule decision 0010](../decisions/rules/0010-competency-classification-and-group-taught-specializations.md), ruling 3).

`Derived XP` is included in `Total`.

## 6. Skill points and education

### Ordinary and flexible points

Ordinary points are used for ordinary skill and skill-group purchases during chargen.

The total comes from the saved chargen rule set.

Formula:

```text
Ordinary skill points = chargenRuleSet.ordinarySkillPoints
```

Ordinary skills cost 2 points per increase. Secondary skills cost 1 point per increase. Skill groups use the dynamic group cost formula below.

Flexible points are used for extra skills outside normal profession and society access.

The amount is based on the character's resolved `INT` and `LCK`, multiplied by the chargen rule-set flexible-point factor.

Formula:

```text
Flexible points = floor((resolved INT + resolved LCK) * flexible point factor)
```

With the standard rule set, the flexible point factor is 1.

### Individual skill pricing

```text
Ordinary skill cost = 2
Secondary skill cost = 1
```

### Skill group pricing

Skill group cost is dynamic.

Some groups have fixed skills. These are always part of the group. Other groups have a choice slot. A choice slot lets the player select one or more skills from a list, such as choosing `Bow` for `Basic Missile Training` or `Smithing` for `Craft Specialty`.

Formula:

```text
G_s            = highest active group contribution to Skill s
usefulGroup_s  = max(0, G_s - relationshipFloor_s)
weightedUseful = sum(individual cost of s * usefulGroup_s)
Skill group cost = ceil(2/3 * weightedUseful)
```

The ceiling is applied **once** to the complete bundle of purchased Learning Groups, never
per group and never per rank, so the price of a purchase is the change in the bundle price.
A Group contribution that yields no useful competence yields no price. A Learning Group that
teaches no base membership and exists only to open authored Specialization access has a Group
purchase cost of `0` and carries no Group purchase action at all: eligibility through the Group
exposes the Specialization, which is purchased and progressed separately under its own costs.
The incidental flat cost of `1` it formerly carried is retired (Product Owner ruling,
2026-09-27).

This is the shared canonical Learning Group acquisition arithmetic in
[`pilot-skill-rules-v1.md`](./pilot-skill-rules-v1.md) section 4, which both the
Pilot/runtime acquisition path and the Chargen path now consume (Forgejo #381). It replaces
the former Chargen-local `floor(0.6 * total individual cost)` scalar with its minimum of `1`.

```text
Active group skills = fixed group skills + skills currently selected in choice slots
```

Unselected slot candidates do not count. Required-slot groups cannot be bought or raised until their required choices are selected.

Choice examples:

- `Basic Missile Training` has fixed skills such as `Perception`, `Concentration`, and `Weapon Maintenance`, plus one selected missile weapon.
- `Advanced Craft Specialty` has a craft choice slot; only the selected craft counts, not every possible craft candidate.
- Unselected slot candidates do not increase cost and do not appear as trained skills.

Cost examples:

Examples below are for a single group bought to level `1` with no overlap and no
relationship floor, so `weightedUseful` equals the individual-cost total.

| Group shape                                                                              | Weighted useful total |          Group cost |
| ---------------------------------------------------------------------------------------- | --------------------: | ------------------: |
| Three ordinary skills                                                                    |       `2 + 2 + 2 = 6` | `ceil(2/3 * 6) = 4` |
| Dodge, Parry, Brawling, and one selected secondary weapon                                |   `1 + 1 + 1 + 1 = 4` | `ceil(2/3 * 4) = 3` |
| Perception, Concentration, Weapon Maintenance, and one selected secondary missile weapon |   `2 + 2 + 1 + 1 = 6` | `ceil(2/3 * 6) = 4` |
| One selected ordinary craft skill                                                        |                   `2` | `ceil(2/3 * 2) = 2` |
| A Skill whose whole Group contribution a stronger Group already supplies                 |                   `0` |                 `0` |

### Skill points summary

The Character Sheet summary shows current skill points and how progression changed them.

Formula:

```text
Successful progression gains = sum(cost of successful resolved progression attempts)
Current skill points = Original skill points + Successful progression gains
```

`Original skill points` are the character's chargen invested points at creation/finalization.
`Successful progression gains` count only resolved progression attempts that succeeded.
Failed attempts, pending attempts, and unspent progression points do not count toward current skill points.

The summary may also show chargen remaining points:

```text
Chargen remaining = ordinary pool remaining + flexible pool remaining
```

### Education

`Education` combines base education, social-class education, and education-linked learned skills.

Base education is the starting education value provided by the society/civilization setup before social class and learned education-linked skills are added.

Formula:

```text
Education = base education
  + social class education value
  + education-linked skill count
```

## 7. Known interim notes

- Combat/loadout formulas are documented separately.
- Character Detail and the loadout panel may still use different combat derivation paths.
- Remaining points combine ordinary and flexible remaining pools.

## Target Learning Groups and Professions — combined #206 capability

New target Chargen uses the approved 59-group graph and 84 Profession families. A selected explicit track preserves its family and concrete identity; other family opportunities form an additive access menu. Profession selection supplies no ranks, XP or points. Contextual #113 restrictions and legacy Society/Social Band availability are not applied to these unbound choices.

An accessible Learning Group is priced through the shared canonical acquisition arithmetic: the complete purchased bundle costs `ceil(2/3 * weightedUseful)`, where `weightedUseful` sums each base member's individual cost times `max(0, G_s - relationshipFloor_s)`. The nine explicit Specialization memberships are excluded from that sum and group contribution: they provide access only, with separate initial 4 / increase 2 costs and immediate-parent eligibility. A group that teaches no base membership and exists only to open Specialization access has a Group purchase cost of `0` and carries no Group purchase action at all: eligibility through the group exposes the Specialization, which is purchased and progressed separately (Product Owner ruling, 2026-09-27). Flexible funding does not authorize an otherwise inaccessible group. Overlapping groups use the best-contribution calculation for one competency identity, and a membership that produces no useful competence produces no price (Forgejo #381).

Target builds retain family/track/source identity and approved group definitions for later display. Historical builds retain their actual identities, levels and recorded expenditure; this change performs no migration or retroactive repricing. Server validation resolves the approved catalogue and rejects forged membership, family/track or purchase-price claims.
