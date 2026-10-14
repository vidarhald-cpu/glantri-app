# Criticals — GM Value Reference

This page states the Critical values and effects **the current application produces**. Every value
below was read from the running code at `dev = 3e1a605833b5d9e4441751cba1a4d678ff7187d7`, either by
executing the shipped Critical functions or by driving a complete attack through the combat round
runtime. [Where each value came from](#where-each-value-came-from) names the exact function or
executed call behind every table, so a reviewer can re-derive a value instead of re-discovering it.

The procedural rules, the C1 fixture authority, and the round-end lifecycle remain in
[Glantri Critical Effects](../combat-critical-effects.md). This page adds the numbers.

## The critical roll

The app rolls two closed `d8` (faces `1`–`8`, no open-ended re-roll) and resolves:

```text
final critical roll = 2d8 + critical type modifier - armor critical modifier
```

**The armor critical modifier is subtracted.** Armor makes a Critical less severe, not more.

| Primary Critical grade | Critical type modifier |
| ---------------------- | ---------------------: |
| A                      |                     -6 |
| B                      |                     -4 |
| C                      |                     -2 |
| D                      |                      0 |
| E                      |                     +2 |
| F                      |                     +3 |

The same modifier table also carries a per-grade `minDamage` column (`A` `0` through `F` `5`). **The
current runtime never reads it.** The only minimum the app applies is the per-result
[minimum total damage floor](#minimum-total-damage-floor).

The armor critical modifier comes from the armor coverage of the selected hit location's armor
region. When that region has no coverage value, or the hit location is missing, the app uses `0` and
records why. Executed end to end with critical dice `4` and `5` against grade `B`:

| Armor critical modifier | 2d8 | Critical type modifier | Final critical roll |
| ----------------------: | --: | ---------------------: | ------------------: |
|                       1 |   9 |                     -4 |                   4 |
|                       3 |   9 |                     -4 |                   2 |

## Reachable final critical rolls

Driven end to end for each grade with no armor coverage, so the armor critical modifier is `0`:

| Grade | 2d8 = 2 (`1`+`1`) | 2d8 = 9 (`4`+`5`) | 2d8 = 16 (`8`+`8`) |
| ----- | ----------------: | ----------------: | -----------------: |
| A     |    -4 (no effect) |                 3 |                 10 |
| B     |    -2 (no effect) |                 5 |                 12 |
| C     |     0 (no effect) |                 7 |                 14 |
| D     |                 2 |                 9 |                 16 |
| E     |                 4 |                11 |     18 (no lookup) |
| F     |                 5 |                12 |     19 (no lookup) |

Grades `E` and `F` can therefore produce a roll the Critical table cannot answer. The app does not
clamp it; it raises a proposal warning and generates no table rows.

## Final critical roll to Critical index

| Final critical roll | What the app does                                                   |
| ------------------- | ------------------------------------------------------------------- |
| `0` or lower        | No Critical effect, and no table rows                               |
| `1` through `16`    | Critical table lookup at that index                                 |
| `17` or higher      | Unsupported; no clamping rule is approved, so no rows are generated |
| Not a whole number  | Unsupported; no rows are generated                                  |

## Critical family

The weapon's damage class decides the family. The MC/critical code is consulted **only** when the
damage class is unavailable.

| Weapon damage class | Critical family   |
| ------------------- | ----------------- |
| `blunt`             | `blunt`           |
| `edged`             | `sharp`           |
| `pointed`           | `pointed_weapons` |

| MC/critical code fallback                                                        | Critical family                                          |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `AC`, `CC`, `DC`, `EC`, `FC`                                                     | `blunt`                                                  |
| `AS`, `BS`, `CS`                                                                 | `sharp`                                                  |
| `AP`, `BP`, `CP`, `DP`, `FP AC`, `FP AS`, `FP BS`, `FP CS`, `FP DC`, `FC DP/EP*` | `pointed_weapons`                                        |
| `DS`, `EP`, `ES`, `FP`, `FS`                                                     | Ambiguous: the app asks for the attack mode damage class |

Any other code, a blank code, and `—` are unsupported for family lookup. The complete ambiguous set
is exactly those five codes.

## Critical location scope

| Combat hit location             | Critical location scope                               |
| ------------------------------- | ----------------------------------------------------- |
| `head`                          | `head`                                                |
| `rightArm`, `leftArm`           | `arm`                                                 |
| `chest`                         | `chest`                                               |
| `abdomen`                       | `abdomen`                                             |
| `upperRightLeg`, `upperLeftLeg` | `upper_leg`                                           |
| `lowerRightLeg`, `lowerLeftLeg` | `lower_leg`                                           |
| `rightLeg`, `leftLeg` (legacy)  | Ambiguous: review the hit as upper or lower leg first |

## Minimum total damage floor

The floor is a property of the Critical result row, not of the grade. At commit:

```text
final committed physical damage = max(reviewed physical damage, critical minimum total damage)
```

Executed example: a grade `D` attack with critical dice `4`+`5`, hit location roll `12`, resolves
`sharp|chest|09` at Critical index `9`, whose floor is `5` HP for reason `organ injury`. The
proposal records the floor, the pre-critical damage, and the extra amount a commit would apply.

## Secondary Critical

The Secondary grade is derived from the resolved, `Crit 1`-capped Primary grade:

1. apply the universal two-grade-step reduction;
2. a reduction that falls below `A` produces **no Secondary Critical at all**, checked before any
   cap;
3. cap the reduced grade at the `Sec` code's first letter — the cap never raises a grade.

| Primary grade | After the two-step reduction |
| ------------- | ---------------------------- |
| A             | None                         |
| B             | None                         |
| C             | A                            |
| D             | B                            |
| E             | C                            |
| F             | D                            |

The six recognized `Sec` codes are `AP`, `AC`, `AS`, `BS`, `CC`, `DC`. The second letter alone picks
the Secondary family: `C` → `blunt`, `P` → `pointed_weapons`, `S` → `sharp`. The resolved Secondary
grade for every combination:

| Primary \ `Sec` | `AP` | `AC` | `AS` | `BS` | `CC` | `DC` |
| --------------- | ---- | ---- | ---- | ---- | ---- | ---- |
| A               | —    | —    | —    | —    | —    | —    |
| B               | —    | —    | —    | —    | —    | —    |
| C               | A    | A    | A    | A    | A    | A    |
| D               | A    | A    | A    | B    | B    | B    |
| E               | A    | A    | A    | B    | C    | C    |
| F               | A    | A    | A    | B    | C    | D    |

| `Sec` value                     | What the app does                                    |
| ------------------------------- | ---------------------------------------------------- |
| Blank, absent                   | No Secondary Critical; this is an authored absence   |
| Any value outside the six codes | No Secondary Critical, and one surfaced data warning |

`BP` is structurally plausible and is **not** recognized: it fails closed with a warning. Normalization
is trimming and upper-casing only — internal spaces are never stripped and qualifiers are never
split off.

The Secondary rolls a **fresh, independent `2d8`** that never reuses the Primary's dice, reuses the
Primary's hit location, and resolves against the same armor critical modifier the Primary used.
Those dice are persisted, so re-opening or re-saving the GM review re-derives the Secondary without
re-rolling it.

**The Secondary follows the Primary grade, not the Primary's own result.** Executed: a grade `C`
Primary whose final critical roll was `0` produced no Primary effect, and the Secondary still
resolved at grade `A` in family `blunt`.

Executed Secondary totals with both Secondary dice showing `4` (total `8`) and armor critical
modifier `0`:

| Primary grade | `Sec` | Secondary grade | Secondary 2d8 | Final Secondary roll |
| ------------- | ----- | --------------- | ------------: | -------------------: |
| C             | `DC`  | A               |             8 |                    2 |
| D             | `DC`  | B               |             8 |                    4 |
| E             | `DC`  | C               |             8 |                    6 |
| F             | `DC`  | D               |             8 |                    8 |

## The five C1-active Critical keys

Five Critical keys resolve through the structured canonical review. For these, the app renders the
atoms below, with their own source-effect identity, target, and timing. `retained` means the app
rolls the die once when the Critical is accepted and never re-rolls it.

### `sharp|head|10` — Severe concussion causes unconsciousness

| Atom         | Value                                                                   | Target        | Timing    | GM may suppress |
| ------------ | ----------------------------------------------------------------------- | ------------- | --------- | --------------- |
| Damage floor | Minimum total damage 3 HP                                               | Combatant     | Commit    | No              |
| Condition    | Unconscious for retained `1d4` hours or until appropriate care          | Consciousness | Immediate | Yes             |
| Information  | Generic-care end and recovery remain GM-managed; no Skill is identified | GM guidance   | Read-only | No              |

### `sharp|chest|04` — Pectoral slash disables attacks

| Atom         | Value                                                        | Target                | Timing    | GM may suppress |
| ------------ | ------------------------------------------------------------ | --------------------- | --------- | --------------- |
| Damage floor | Minimum total damage 2 HP                                    | Combatant             | Commit    | No              |
| Condition    | Stance impaired for retained `1d4` rounds                    | Stance                | Immediate | Yes             |
| Condition    | General action limited to parry for retained `1d4` rounds    | General action        | Immediate | Yes             |
| Operation    | Drop held weapon                                             | Weapon-side held item | Immediate | Yes             |
| Information  | Generic treatment remains GM-managed and identifies no Skill | GM guidance           | Read-only | No              |

### `blunt|arm|12` — Hand crushed beyond use

| Atom          | Value                                                                    | Target           | Timing                                                   | GM may suppress |
| ------------- | ------------------------------------------------------------------------ | ---------------- | -------------------------------------------------------- | --------------- |
| Damage floor  | Minimum total damage 5 HP                                                | Combatant        | Commit                                                   | No              |
| Modifier      | Stun `-4` to OB/Skill, DB/Parry, and Initiative for 1 full round         | Combatant        | Immediate                                                | Yes             |
| Periodic loss | External Bleed `1/2` HP per round                                        | Arm              | Following round SU, after one full three-second interval | Yes             |
| Condition     | Hand function unusable until separately resolved                         | Hand             | Immediate                                                | Yes             |
| Operation     | Drop held item                                                           | Struck-hand item | Immediate                                                | Yes             |
| Information   | First Aid pressure and splinting are field stages; Surgery is definitive | GM guidance      | Read-only                                                | No              |
| Information   | Permanent deficit and recovery remain GM-managed                         | GM guidance      | Read-only                                                | No              |

### `pointed_weapons|arm|02` — Hand puncture breaks the grip

| Atom          | Value                                                                     | Target           | Timing                                                   | GM may suppress |
| ------------- | ------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------- | --------------- |
| Damage floor  | Minimum total damage 3 HP                                                 | Combatant        | Commit                                                   | No              |
| Modifier      | Stun `-1` to OB/Skill, DB/Parry, and Initiative for retained `1d4` rounds | Combatant        | Immediate                                                | Yes             |
| Periodic loss | External Bleed `1/8` HP per round                                         | Arm              | Following round SU, after one full three-second interval | Yes             |
| Condition     | Hand impaired for retained `1d4` rounds                                   | Hand             | Immediate                                                | Yes             |
| Operation     | Drop held item                                                            | Struck-hand item | Immediate                                                | Yes             |
| Information   | First Aid bandaging is the field-control candidate; source gate: bandage  | GM guidance      | Read-only                                                | No              |

### `pointed_weapons|chest|07` — Punctured lung shortens every breath

| Atom          | Value                                                                  | Target                       | Timing                                                   | GM may suppress |
| ------------- | ---------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------- | --------------- |
| Damage floor  | Minimum total damage 5 HP                                              | Combatant                    | Commit                                                   | No              |
| Modifier      | Stun `-4` to OB/Skill, DB/Parry, and Initiative until appropriate care | Combatant                    | Immediate                                                | Yes             |
| Periodic loss | Internal Bleed `1/4` HP per round                                      | Chest                        | Following round SU, after one full three-second interval | Yes             |
| Condition     | Breathing and general action impaired until appropriate care           | Breathing and general action | Immediate                                                | Yes             |
| Information   | Generic immediate care identifies no Skill                             | GM guidance                  | Read-only                                                | No              |

The retained duration rolls are genuine `1d4`: executed with a minimum and a maximum die stream, the
same key stored `1` and `4` rounds respectively and nothing else in the definition changed.

## What the GM may change on an active key

| Field              | Accepted values                                                            |
| ------------------ | -------------------------------------------------------------------------- |
| Stun modifier      | `-1`, `-2`, `-4`, `-8` — and only on a result that already has a Stun atom |
| Suppressed atoms   | Up to 12 keys, each one marked suppressible above                          |
| Instance title     | Up to 200 characters                                                       |
| Instance narrative | Up to 2000 characters                                                      |
| Private reason     | Up to 1000 characters                                                      |

A damage floor and an information atom are never suppressible. Suppressing an unlisted atom key, or
setting a Stun on a result with no Stun atom, is rejected by the server.

## Stun channels and addition

A numeric Stun contributes to exactly three channels: **OB/Skill**, **DB/Parry**, and **Initiative**.
Executed with two independent Stun sources of `-2` and `-4`:

| Channel    | Total from both sources |
| ---------- | ----------------------: |
| OB/Skill   |                      -6 |
| DB/Parry   |                      -6 |
| Initiative |                      -6 |

Adding a third source whose severity is the explicit action state rather than a numeric rung leaves
all three totals at `-6`: it contributes no number.

## Bleed accrual

C1 Bleed rates are exact rationals. All active source rates for a participant are added before any
whole HP is applied, and the exact remainder carries. Executed with one `1/8` HP and one `1/4` HP
source active, from a zero remainder — `3/8` HP accrues per SU tick:

| SU tick | Whole HP applied | Carried remainder |
| ------: | ---------------: | ----------------: |
|       1 |                0 |             `3/8` |
|       2 |                0 |             `3/4` |
|       3 |                1 |             `1/8` |
|       4 |                0 |             `1/2` |
|       5 |                0 |             `7/8` |
|       6 |                1 |             `1/4` |
|       7 |                0 |             `5/8` |
|       8 |                1 |               `0` |
|       9 |                0 |             `3/8` |

The remainder is reduced, not rounded, and never silently dropped: after eight ticks exactly `3` HP
has been applied.

## Immediate consequence activation by initiative

| Consequence onset | Source initiative | Pending action initiative | Consequence applies |
| ----------------- | ----------------: | ------------------------: | ------------------- |
| Immediate         |                 7 |                         7 | No                  |
| Immediate         |                 7 |                         4 | Yes                 |
| Immediate         |                 4 |                         5 | No                  |
| Immediate         |                 4 |                         4 | No                  |
| `next_round`      |                 7 |                         4 | No                  |

An equal-initiative group therefore resolves against the same pre-group state, and a consequence
never reaches backward to an action that already resolved at a higher initiative.

## Where each value came from

| Published values                                                                | Source read at the bound SHA                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical type modifiers, the unused `minDamage` column                          | `lookupCombatCriticalModifier` over every grade, `packages/domain/src/encounter/critical.ts`                                                                        |
| Subtraction of the armor critical modifier, and the two executed armor examples | `packages/domain/src/encounter/combatRoundManager.test.ts`, "derives armor critical modifier from the selected armor region when data exists", executed at this SHA |
| Reachable final critical rolls per grade                                        | A complete attack driven through `recordCombatRoundAttackResult` → `recordCombatRoundCriticalRoll` with injected dice, one run per grade                            |
| Final roll to index behaviour                                                   | `getFinalCriticalRollIndexStatus` over `-2`, `-1`, `0`, `1`, `2`, `15`, `16`, `17`, `18`, and a non-integer                                                         |
| Family from damage class and MC code                                            | `mapWeaponDamageClassToCriticalFamily` and `mapWeaponCriticalCodeToFamily` over every code the mapper names                                                         |
| Location scope                                                                  | `mapCombatHitLocationToCriticalLocation` over every member of `HIT_LOCATIONS`                                                                                       |
| The `sharp\|chest\|09` floor example                                            | The same driven attack, reading the generated proposal's `minTotalDamage` and `minDamageReason`                                                                     |
| Secondary grade reduction, the cap matrix, the `Sec` vocabulary                 | `applySecondaryCriticalGradeReduction` and `resolveSecondaryCriticalGrade` over all six grades × the six codes, plus blank, absent, `BP` and `N/A`                  |
| Secondary totals, and the Secondary after a no-effect Primary                   | The same driven attacks, reading the proposal's `secondary`                                                                                                         |
| The five keys and their atoms                                                   | `getC1FiveKeyCanonicalReview` for each key returned by `isC1FiveKeyCriticalRuntimeKey`                                                                              |
| Retained `1d4` durations, Bleed rates, conditions, operations, treatment        | `buildRepresentativeCriticalRuntimeDefinition` for each active key, run once with a minimum and once with a maximum die stream                                      |
| GM-changeable fields and their limits                                           | `combatCriticalAdjudicationSchema`, `packages/domain/src/encounter/combatCriticalRuntime.ts`                                                                        |
| Stun channels and addition                                                      | `CRITICAL_STUN_CHANNELS` and `sumIndependentCriticalStuns` over two numeric sources and one severity-only source                                                    |
| Bleed accrual trace                                                             | `accrueRepresentativeBleed` run for nine consecutive SU ticks, carrying its own returned remainder                                                                  |
| Initiative activation                                                           | `isCriticalConsequenceActiveForPendingInitiative` over the listed onset and initiative pairs                                                                        |

The fixture set behind the five keys is version `c1-2026-08-28`; their runtime contract is
`c1-five-key-post-393-2026-09-06`. `verifyRepresentativeCriticalFixtureSources()` returned no
failures at this SHA, so each published fixture value still matches its accepted source row.
