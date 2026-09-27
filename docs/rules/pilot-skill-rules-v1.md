# Pilot Skill Rules v1

## 1. Status and scope

This is the canonical reference for the pure `pilot-skill-rules/v1` calculation kernel and Gate A fixtures. It implements the product-owner decisions accepted in [issue #372](https://github.com/vidarhald-cpu/glantri-app/issues/372) from the [Pilot Skill Rules v1 acceptance](https://github.com/vidarhald-cpu/glantri-app/issues/368#issuecomment-5451133379), including the [overlap and non-recursion clarification](https://github.com/vidarhald-cpu/glantri-app/issues/368#issuecomment-5450553989) and the [spoken-language clarification](https://github.com/vidarhald-cpu/glantri-app/issues/368#issuecomment-5450637657).

This first slice is a pure rules authority. It does not migrate existing Characters, replace current persistence, or implement the final Character-builder UI. Older Character Sheet and Chargen documentation continues to describe those existing runtime surfaces until a later authorized integration slice consumes this kernel.

## 2. Concrete Skill weights and direct cost

Every concrete Skill has an authored economic weight of `1`, `2`, or `3`.

```text
direct Skill cost = Skill weight × directly acquired ranks
```

Examples:

- Weight `3`, four ranks: `3 × 4 = 12`.
- Weight `1`, four ranks: `1 × 4 = 4`.

Weight controls price, not a competence ceiling. A weight-3 Skill can exceed rank 20 if acquisition rules and budget allow it.

## 3. Formation and Flex budgets

Formation and Flex are supplied configuration values. `60` is used by the golden calibration, but it is not a kernel constant.

Formation-eligible costs consume Formation first and may then consume Flex. Flex-only costs consume Flex. The calculation is based on totals, so purchase-array order cannot change pool use.

Access is checked before either pool is spent. A `restricted` or `unavailable` route is not made purchasable merely because budget remains. An accepted exception must first resolve the route to `available`.

Examples:

- Configuration Formation `60`, Flex `26`, cost `62`: Formation `60`, Flex `2`.
- Configuration Formation `47`, Flex `5`, cost `49`: Formation `47`, Flex `2`. This proves `60` is not hard-coded.

## 4. Learning groups and histories

A learning group/history is a visible, narratable training source with an explicit Character-owned level. Group level remains a first-class calculation input; it is not flattened into direct Skill ranks.

For each Skill `s`:

```text
G_s = highest selected group level containing s
D_s = direct ranks in s
X_s = explicit society/background/other grant ranks in s
A_s = G_s + D_s + X_s
```

Only `G_s` from the strongest group counts. Other memberships remain in the explanation output with their group identity and supplied level. They are marked as suppressed by the stronger group; they are not deleted.

The final selected bundle is priced once:

```text
relationshipFloor_s = strongest floor-rounded incoming relationship
                      sourced only by group competence in the bundle
usefulGroup_s = max(0, G_s - relationshipFloor_s)
weightedUseful = sum(Skill weight_s × usefulGroup_s)
group bundle cost = ceil(2/3 × weightedUseful)
```

The ceiling is applied once to the complete bundle. Direct purchases happen on top of the strongest group contribution and are not used to discount the group price.

Two consequences follow from pricing the bundle once rather than per rank, both approved (Product Owner, 2026-09-27) and recorded in [rule decision 0011](../decisions/rules/0011-shared-learning-group-acquisition-arithmetic.md). The marginal price of one further rank in the same group **varies** with the group's current level instead of being constant. And adding a group may **lower** the bundle price, where the new group's contribution raises a relationship floor that supplies competence an earlier group was priced for; the calculation stays order-independent and history-free, and the lower recomputed price is correct.

This group-bundle arithmetic is the **shared canonical calculation**. The Chargen acquisition path consumes the same calculation, supplying its own economic weights and its own relationship floors; it holds no second implementation. See [rule decision 0011](../decisions/rules/0011-shared-learning-group-acquisition-arithmetic.md).

Examples:

- City Watch grants Sword `4`; Veteran Campaign visibly includes Sword `2`. Sword group competence is `4`. The second membership remains explainable but adds zero competence and zero price.
- Group A grants Sword `2`; Group B grants Sword `4`. The final useful group contribution is `4`, not `6`, regardless of selection order.
- Direct Sword `+3` over group Sword `4` gives acquired base `A = 7`.
- Infirmary grants Medicine `4` and First Aid `4`. Medicine explicitly includes First Aid at `100%`, so the First Aid row adds zero useful group competence and zero group price while remaining visible.

## 5. Explicit directional relationships

Pilot v1 supports authored strengths `100%`, `75%`, `50%`, and `25%`.

For an explicit edge from source `x` to target `y`:

```text
candidate(x -> y) = floor(A_x × strength / 100)
R_y = strongest candidate into y
E_y = max(A_y, R_y)
```

Candidates are floored before comparison. Incoming results never stack. Equal results select the lexicographically first relationship ID for deterministic explanation. No reverse edge is inferred.

Pilot v1 is deliberately non-recursive: only acquired base `A`—direct, group, and explicit granted competence—may source a relationship. Relationship-derived `E` cannot source another edge. A chain `A -> B -> C` therefore stops at `B` unless `B` also has acquired base. Cycles cannot amplify competence. Calculation explanations identify this policy as `non-recursive-temporary-pilot-limitation`.

This is a temporary pilot limitation, not the intended final Glantri direction. A later rules version may investigate cascading from one simple effective Skill level after cycle, convergence, amplification, rounding, graph, migration, and explanation review. The v1 input/output seam keeps acquired base, candidates, chosen source, and effective competence separate so that investigation remains possible.

An unowned Specialization may show a relationship candidate for explanation, but the candidate cannot acquire it and its effective competence remains zero until at least one rank is explicitly acquired.

## 6. Competence bands

| Competence | Band                        |
| ---------: | --------------------------- |
|        `0` | Untrained                   |
|      `1–5` | Beginner                    |
|     `6–10` | Intermediate                |
|    `11–15` | Experienced / fully trained |
|    `16–20` | Expert                      |
|      `21+` | World class                 |

## 7. Specializations

A Specialization is a stable competence identity with its own acquired ranks.

Typical prerequisite thresholds are:

- `6` when intermediate competence is enough;
- `11` when full professional competence is normally required.

Another positive threshold requires explicit authored justification. Eligibility reads acquired base competence `A`, not relationship-derived competence.

Meeting prerequisites makes acquisition available; it does not make the Character own the Specialization. Ownership starts with the first explicitly acquired rank.

Pilot v1 Specialization price is:

```text
first acquisition cost = 2 initiation + specialization weight × acquired ranks
later rank cost = specialization weight × acquired ranks
specialization weight = 1 or 2
```

A typical weight-1 Specialization bought at two ranks costs `2 + 1 × 2 = 4`. Its first rank costs `3`.

There is no automatic base-to-Specialization or Specialization-to-base transfer. Explicit edges may point either way and use the normal relationship vocabulary. A zero-transfer Specialization is valid. A base-to-Specialization relationship can raise effective competence only after the Specialization has been explicitly acquired.

## 8. DS/AB access resolution

Development Stage (DS) describes whether and how a practice exists in the society/profile. Access Band (AB) describes ordinary routes to the learning opportunity. Neither grants ranks or competence.

Resolution precedence is:

1. competency-specific profile override;
2. domain-specific profile override;
3. profile default;
4. safe `restricted` fallback when authoring is absent or ambiguous.

The result is `available`, `restricted`, or `unavailable` with attribution and explanation. Accepted exception bases are biography, contact, domain, institution, profile, teacher, text, and tradition. An accepted exception may open an acquisition route, but the access result always grants exactly zero competence.

Example: Surgery resolves `restricted`. An accepted teacher or institution may resolve it to `available`; the Character still has Surgery `0` until an explicit acquisition occurs.

## 9. Profession and background

Profession is recorded identity and explanatory context. It may help later UI organize likely histories, routes, Skills, and Specializations, but it is mechanically inert in this kernel. Changing only the Profession ID changes no group contribution, direct cost, Specialization result, relationship result, or effective competence.

Society/background may supply explicit granted competence, including the starting spoken language. Each grant remains an explicit source rather than an effect of the Profession label.

## 10. Mandatory spoken language

A finalized Character must have at least one spoken-language competency with a positive explicit starting-language grant whose source is `society` or `background`. A spoken language present only through direct purchase, a learning group/history, a relationship, or another explicit grant does not satisfy this starting invariant. The kernel consumes the existing society/background starting-language value; it does not invent or replace that numeric rule.

A written tradition is a separate competency and never satisfies the spoken-language invariant. Granting a spoken language does not grant its written tradition. Additional spoken or written competencies are acquired through their normal explicit routes.

## 11. Gate A golden Characters

All fixtures use Formation `60`, Flex `26`, an explicit background spoken language, histories priced before direct ranks, and the non-recursive relationship rule. `WU` is weighted useful group competence.

|   # | Biography-first fixture | WU / group cost | Direct + Specialization | Total | Representative effective competence                  | Representative roll (`Avg + E + 10`) |
| --: | ----------------------- | --------------: | ----------------------: | ----: | ---------------------------------------------------- | -----------------------------------: |
|   1 | Guard / veteran         |       `44 / 30` |                    `15` |  `45` | Sword `6`, Shield `4`, Knife/Dagger floor `3`        |             Sword `15 + 6 + 10 = 31` |
|   2 | Physician-scholar       |       `30 / 20` |                    `20` |  `40` | Medicine `6`, First Aid `6`, Diagnostic Medicine `3` |          Medicine `16 + 6 + 10 = 32` |
|   3 | Covert investigator     |       `48 / 32` |                    `24` |  `56` | Lockpicking `6`, Perception `5`, Streetwise `4`      |       Lockpicking `15 + 6 + 10 = 31` |
|   4 | Court official          |       `45 / 30` |                    `21` |  `51` | Administration `6`, Written Tradition `4`, Law `3`   |    Administration `15 + 6 + 10 = 31` |
|   5 | Merchant-smith          |       `40 / 27` |                    `18` |  `45` | Trade `6`, Smithing `6`, Appraisal `4`               |          Smithing `15 + 6 + 10 = 31` |
|   6 | Coastal navigator       |       `54 / 36` |                    `18` |  `54` | Pilotage `6`, Wayfinding `6`, Chart Navigation `3`   |          Pilotage `15 + 6 + 10 = 31` |
|   7 | Caravan-militia hybrid  |       `47 / 32` |                    `22` |  `54` | Wayfinding `6`, Spear `5`, Trade `5`                 |        Wayfinding `14 + 6 + 10 = 30` |
|   8 | Deliberate optimizer    |       `44 / 30` |                    `32` |  `62` | Perception `10`, Stealth `10`, Lockpicking `6`       |          Stealth `15 + 10 + 10 = 35` |

Fixtures 1–7 fit within Formation. Fixture 8 spends Formation `60` and Flex `2`. Executable permutations reverse group, member, and relationship input order and reproduce identical cost and competence results.

## 12. Explanation and validation contract

The kernel exposes, rather than hides:

- every group membership, strongest group, suppressed group, relationship overlap, useful increment, and weighted price contribution;
- every relationship candidate, source acquired base, percentage, floored result, deterministic chosen edge, and whether it governs;
- acquired base and effective competence as separate values;
- Specialization eligibility, ownership, each prerequisite, and blocked unowned transfer;
- access attribution with an explicit zero-competence result;
- stable budget and missing-spoken-language error codes.

Invalid weights, strengths, ranks, group/relationship identities, or unjustified nonstandard Specialization thresholds fail deterministically at the pure calculation boundary.
