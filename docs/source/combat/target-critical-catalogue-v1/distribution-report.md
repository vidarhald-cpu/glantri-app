# Target Critical catalogue V1 distribution review

The machine-readable source is `distribution.csv`. Counts are result incidence: a result counts once
for a measure even when it contains multiple matching consequences. Categories may overlap. The
diagnostic burden score is a review aid, not a game mechanic or balance quota.

## Catalogue totals

| Measure                          | Results |
| -------------------------------- | ------: |
| Catalogue entries                |     608 |
| Dazed                            |     256 |
| Stunned                          |     278 |
| Remainder-of-round effect        |      33 |
| Fixed one-round effect           |     183 |
| Fixed two-round effect           |     129 |
| Fixed three-or-more-round effect |      75 |
| Rolled fixed duration            |     100 |
| Scheduled recovery               |      15 |
| Bounded recovery                 |      42 |
| External Bleed                   |     138 |
| Internal Bleed                   |      82 |
| Functional loss                  |     307 |
| Ordinary localized modifier      |     225 |
| Persistent injury content        |      80 |
| Incapacitating condition         |      84 |
| Terminal/fatal content           |     117 |

The 117 terminal-result incidence matches the source mortality inventory, except that no lower-leg
15–16 key is terminal. Some source rows for the same result collapse into one target consequence,
so result incidence is lower than source effect-row counts for persistent and terminal tags.

## By band

| Band         | Results | Dazed | Stunned | Ext / int Bleed | Function loss | Persistent | Incapacitating | Terminal | Avg burden |
| ------------ | ------: | ----: | ------: | --------------: | ------------: | ---------: | -------------: | -------: | ---------: |
| Minor        |     114 |    86 |       0 |          11 / 0 |            24 |          1 |              0 |        0 |       2.66 |
| Moderate     |     114 |    32 |      43 |          12 / 6 |            55 |          2 |              0 |        0 |       5.15 |
| Serious      |     114 |    15 |      58 |         24 / 18 |            73 |         15 |             15 |        0 |       7.92 |
| Severe       |     114 |    43 |      96 |         50 / 32 |            85 |         44 |             46 |       15 |      13.21 |
| Catastrophic |      88 |    70 |      71 |         40 / 25 |            60 |         18 |             17 |       38 |      16.72 |
| Fatal        |      64 |    10 |      10 |           1 / 1 |            10 |          0 |              6 |       64 |      17.17 |

Combined burden rises at every band boundary. Minor outcomes use Dazed but never Stunned.
Stunned becomes more common from Serious and is present in 96 of 114 Severe outcomes. Fatal results
do not need additional impairment to prove severity when terminal content already dominates their
burden.

Catastrophic has more overlapping timed and functional consequences than Fatal because it represents
survivable catastrophic injury as well as terminal deterioration. The burden score weights terminal
content sufficiently to keep Fatal above Catastrophic without fabricating extra modifiers.

## Bleed rate review

All ordinary Bleed rates are fixed exact fractions. No target Bleed rolls `1d4` or `1d6` each round,
and no death timer is represented as ordinary Bleed.

- External range: `1/8` to `3/4 HP/round`, approximately 2.5 to 15 HP/minute.
- Internal range: `1/8` to `2/3 HP/round`, approximately 2.5 to 13 1/3 HP/minute.
- Lower-leg 15–16 cap: external `1/2`, internal `1/3 HP/round`.
- Catalogue median among Bleed-bearing results: `1/2 HP/round`.

The rate ladder preserves external/internal distinction and anatomy while removing legacy extreme
dice-per-round tails. Every source starts after one complete subsequent round and retains independent
treatment state.

The three Fire/Energy target rates (`1/4`, `1/3`, `1/2`) are non-Bleed and explicitly non-runtime.
They are not counted in ordinary Bleed incidence.

## Family review

Six regional families each contain 96 results. Falling/Crushing and Fire/Energy contain 16 whole-body
results each.

- Pointed Weapons has the highest average burden (12.30) and the most external/internal Bleed
  incidence (56/26), consistent with penetration and embedded-object consequences.
- Blunt has low external Bleed (2) and higher internal Bleed (20), consistent with closed trauma.
- Sharp and Teeth/Claws have similar total distributions but retain distinct prose, anatomy, and
  source tags; they were not merged.
- Arrows/Bolts and Firearms preserve embedded projectile/extraction consequences and distinct family
  identity.
- Fire/Energy has no ordinary Bleed. Its conditionals and three approved content-only loss sources
  remain separate.
- Falling/Crushing concentrates whole-body function, internal Bleed, and structural burden.

These differences come from authored family behavior and source anatomy. No family was forced to
meet a quota.

## Location review

- Head has the highest incapacitating incidence (32) and 25 persistent-injury results.
- Chest and abdomen each have 24 incapacitating results and 28 internal-Bleed results.
- Arm has 86 functional-loss results and no automatic incapacity.
- Upper leg has 67 functional-loss results and no automatic incapacity.
- Lower leg has 77 functional-loss results, 49 external-Bleed results, and zero terminal results.
- Whole body carries the specialized Falling/Crushing and Fire/Energy sequences.

All twelve lower-leg 15–16 keys are Catastrophic. They rely on function loss, Bleed, structural
injury, and persistent content rather than automatic death.

## Duration and uncertainty review

Fixed one, two, and three-plus-round forms correspond to approximately 3, 6, and at least 9 seconds
after the creation-round remainder. Rolled fixed `1d3`, `1d4`, and `1d6` round forms are rolled once
and have bounded maximums. Long historical hour-scale unconsciousness is not represented as a combat
round timer.

Scheduled recovery appears only where the state can reasonably persist until a repeated Mobility or
similar checkpoint. Bounded recovery is used for unconsciousness where unlimited repeated checks
would create an implausible tail; the maximum-failure transition is `persists until stabilised`, not
automatic recovery or death.

## Repetition and normalization

The catalogue intentionally uses a small, consistent grammar for timing, source identity, treatment,
and named effects. Repeated syntax is not repeated fiction: each result retains its own outcome name,
family/location anatomy, source coordinates, consequence targets, and source-row disposition.

The distribution review identified and corrected four material legacy patterns:

1. variable numeric Stun was replaced by canonical Dazed/Stunned plus separate semantic states;
2. unsupported global action locks were replaced by localized consequences;
3. extreme dice-per-round Bleed was recalibrated to exact rates; and
4. lower-leg terminal shorthand was removed from the 15–16 exception band.

No further family, location, band, or burden outlier requires a Product Owner ruling for catalogue
completion.
