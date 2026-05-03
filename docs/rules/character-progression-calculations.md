# Character Progression Calculations

## 1. Purpose and scope

This page explains the first version of character progression: GM checks, progression points, purchased attempts, and advancement rolls.

Progression is manual in this version. Combat and skill use do not automatically create checks yet.

## 2. Requested checks, approved checks, and progression points

A requested check is a player proposal: “I used this stat, skill, skill group, or specialization successfully.”

An approved check is the GM-approved version. A character must have an approved check before the player can buy a progression attempt for that target.

Requested checks show as awaiting GM approval. They do not allow spending progression points yet.

`Progression points` are granted by the GM. The player spends them to buy pending progression attempts. Spending points does not immediately increase XP or values.

## 3. Progression attempts

A progression attempt is a purchased chance to improve a checked target.

When an attempt is purchased:

- progression points are spent immediately,
- the target does not increase yet,
- the attempt waits in `Pending attempts`,
- the increase happens only if the resolve roll succeeds.

Only one pending attempt per target is supported in this first version.

## 4. Costs

Progression costs match chargen purchase costs where applicable.

| Target | Cost |
| --- | ---: |
| Ordinary skill increase | 2 |
| Secondary skill increase | 1 |
| New specialization | 4 |
| Existing specialization increase | 2 |
| Skill group increase | Dynamic group cost |

Skill group cost:

```text
Skill group cost = floor(0.6 * total individual cost of active group skills)
Minimum cost = 1 when at least one active skill exists
```

Active group skills are fixed group skills plus selected choice-slot skills. Unselected slot candidates do not count.

## 5. Provisional skills

A GM can approve a check for a skill the character does not currently have. This creates a provisional checked skill on the Progression screen.

Provisional skills:

- show as `Provisional`,
- have current XP `0`,
- do not appear as trained on the main Character Sheet yet,
- become real skill rows with `+1 XP` if the progression attempt succeeds.

If the attempt fails, the failure is recorded in history and the skill does not become trained.

## 6. Advancement thresholds

The threshold is the current XP/value before the attempted increase.

| Target | Threshold |
| --- | --- |
| Skill | Current `Total XP`: Group XP + Skill XP + Derived XP |
| Skill group | Current group XP / group level |
| Specialization | Current specialization total |
| Stat | Current stat value, but stat advancement is not enabled yet |

Skill thresholds use XP, not Total skill level. Total skill level includes linked stat average, which is used for play rolls rather than advancement thresholds.

The pending increase does not count toward its own threshold.

## 7. Open-ended progression roll

Roll an open-ended `d20`.

Procedure:

1. Roll `1d20`.
2. If the d20 is `1-19`, that is the final roll.
3. If the d20 is `20`, roll `1d10` and add it.
4. If that d10 is `10`, roll another `1d10` and add it.
5. Keep rolling and adding d10s while each new d10 is `10`.
6. Stop when a d10 is `1-9`.

Success rule:

```text
Progression succeeds if final roll total >= threshold
```

Examples:

| Threshold | Roll | Result |
| ---: | --- | --- |
| 12 | d20 = 12 | Success |
| 12 | d20 = 11 | Failure |
| 20 | d20 = 20 | Success |
| 24 | d20 20 + d10 4 | Success |
| 31 | d20 20 + d10 10 + d10 1 | Success |
| 45 | d20 20 + d10 10 + d10 10 + d10 5 | Success |
| 45 | d20 20 + d10 10 + d10 10 + d10 4 | Failure |

## 8. Resolve checks and history

Resolving checks rolls every pending attempt.

Each history entry records:

- target type, id, and label,
- cost paid,
- d20 result,
- open-ended d10 results,
- final roll total,
- threshold,
- success or failure,
- before value,
- after value,
- resolved timestamp.

After resolution, the pending attempt is removed and the check for that target is cleared.

## 9. Stat advancement note

Stats can receive checks so the GM can record important stat use, but stat progression is not spendable or resolvable yet.

When stat advancement is enabled later, it must increase `Current` stat only. It must not rewrite `Stats die roll`, `Original`, or resolved chargen creation stats.

## 10. Known interim notes

- Manual GM checks are implemented; automatic combat or skill-use checks are not.
- Stat advancement is checks-only/deferred.
- Progression is stored with the character build so old characters without progression state still load.
