# Chargen Calculations

## 1. Purpose and scope

This page is the current reader guide to character generation: the steps a player walks in the app, and the calculations and rules each step shows.

It covers the Chargen step sequence, profile rolls, stat resolution, social class, education, skill points, skill-group costs, choices, and finalization. It does not change any character generation rules.

**One authority per question.** This page is authoritative for the Chargen process, its rule-set parameters, its point pools, and its purchase costs. Anything else belongs to the page that owns it:

| Question                                                                     | Page that answers it                                                               |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| What Skills, Learning Groups and Professions are, and what access they grant | [Competency Rules](./competency-rules.md) — the current Skill authority            |
| The complete Skill, Learning Group, Profession and availability content      | [Skill, Learning Group and Profession reference](./competency-reference/README.md) |
| Final sheet values after chargen                                             | `Character Sheet Calculations`                                                     |
| Carried load                                                                 | `Equipment & Encumbrance Calculations`                                             |
| Equipped weapon, armor, movement, and combat values                          | `Equip Items Calculations`                                                         |
| Retained Characters, the acquisition ledger, and headless finalization       | [Retained Character Ledger and Headless Chargen](./retained-character-ledger.md)   |

## How Chargen runs

Chargen is a ten-step wizard. **One step is rendered at a time**, below a row of step pills and a `Step N of 10` counter with `Previous step` and `Next step` buttons. The pills are not a one-way road: any step can be opened directly at any time, and the draft keeps the values already entered while you move between steps. The page header reads `Draft saved locally.`

### Starting, resuming, and replacing a draft

Chargen opens on a compact start panel rather than on step 1.

- With no saved draft it offers `Roll all dice`. Rolling the dice is what starts Chargen, and the step-1 Stats section opens on the rolled values. The Civilization and Profession choosers stay collapsed, because the roll made neither of those choices.
- With a saved draft for the signed-in account it offers `Resume saved Character` and `Create new Character`. Creating a new Character asks for confirmation first and then replaces that saved draft. **Finalized Characters are not affected.**
- A draft saved under an older Skill catalogue is shown as a historical draft. It remains readable, but it cannot continue in the current catalogue.

Starting a Character requires being signed in.

### The ten steps

The pill labels are the step headings the app already owns, so they read `1` through `6`, then `9`, `9b`, `10`, `11`. The sections headed `7. Individual skills` and `8. Specializations` render **inside** step `6. Skill allocation` rather than as pills of their own. There are ten pills, and the counter reads `Step N of 10`.

| What you see in Chargen    | What you do there                                                                                                                                                                            | Where this page explains it                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `1. Stats`                 | Pick one rolled profile. Each card shows its stats, total, distraction level, and social band. `Expand stats` and `Collapse stats` show or hide the full list.                               | `Stat/profile rolls`                                                                           |
| `2. Resolve stats`         | Read `Base`, `Adjusted`, and `Final` for every stat, and spend any `Exchange` and `Build` adjustments. Each control shows how much of its allowance is used; `Reset` returns to the roll.    | `Exchanges and builds`, then `Resolve stats`                                                   |
| `3. Choose civilization`   | Choose the civilization. Chargen infers the linked society from it. The step also shows the mother tongue and any optional civilization languages.                                           | `Civilization, society, and social class` and `Mother tongue and languages`                    |
| `4. Social class`          | Read the result of the social class roll: band, class label, and the access it sets up. Nothing is chosen here.                                                                              | `Civilization, society, and social class`                                                      |
| `5. Choose profession`     | Read what a Profession does and what it can teach, then choose one. `Search professions` and `Kind of work` narrow the list. **Choosing a Profession grants no ranks and spends no points.** | `Profession packages and choices`                                                              |
| `6. Skill allocation`      | Spend points. The sticky header carries `Culture`, `Access`, `Ordinary points`, and `Flexible points`. The `7. Individual skills` and `8. Specializations` sections live here too.           | `Ordinary and flexible skill points`, `Skill purchases`, and `Profession packages and choices` |
| `9. Skills table`          | Review every Skill in the draft with its stats, Learning Group XP, owned XP, derived preview, total XP, and total skill level.                                                               | `Character Sheet Calculations`                                                                 |
| `9b. Specialization Table` | Review each Specialization with its parent Skill, direct XP, derived preview, and total.                                                                                                     | `Derived XP and specializations`                                                               |
| `10. Review summary`       | Check the whole build before finalizing: the character summary on one side, points and education on the other.                                                                               | `Education` and `Review summary and finalization`                                              |
| `11. Finalize character`   | Confirm the name and create the Character record. The signed-in player is stored as the creator.                                                                                             | `Review summary and finalization`                                                              |

### Inside step 6, Skill allocation

Step 6 is the one step where points are spent, so it carries more than one section:

- **`Choose your Profession core route`** appears only when more than one of the Profession's core routes applies. See `Profession core routes`.
- **`Society granted skills`** — the foundational Skills the society supplies.
- **`Profession skills`** — the `Profession training` section, holding `Languages`, each available training practice with its `Add training` and `Remove training` actions and its required and optional choice slots, and `Direct training in this area` for Skills taught directly rather than through a practice.
- **`Direct profession training`** — direct Profession routes outside the training practices.
- **`7. Individual skills`** — search and filter the visible Skills, including a `Purchasable now` filter.
- **`8. Specializations`** — Specializations with their parent Skill and parent level requirement.

Each training practice shows `Ranks from ordinary points`, `Ranks from flexible points`, and `Ranks in total`, and states what one more rank costs before it is bought. A rank that teaches nothing this Character does not already have costs nothing, and the app says so.

## 2. Chargen rule set

App section: the Chargen header and `10. Review summary`.

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

App section: Chargen step `1. Stats`.

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

App section: Chargen step `2. Resolve stats`.

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

App section: Chargen step `2. Resolve stats`.

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

App section: Chargen steps `3. Choose civilization` and `4. Social class`.

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

App section: Chargen step `3. Choose civilization`, and the `Languages` and `7. Individual skills` sections of `6. Skill allocation`.

Mother tongue is granted automatically from the selected civilization.

Formula:

```text
Mother tongue starting XP = max(11, Education)
```

Extra language choices create concrete `Language (Name)` entries when selected. The raw `Language` skill is not used as a standalone trained language row for players.

Society baseline languages are required. Civilization optional languages can be selected when available.

## 8. Education

App section: Chargen step `10. Review summary`.

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

App section: Chargen step `6. Skill allocation`, including its `7. Individual skills` section, and `10. Review summary`.

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

App section: Chargen step `6. Skill allocation`, including its `7. Individual skills` and `8. Specializations` sections.

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
A Group contribution that yields no useful competence yields no price.

Two consequences follow from pricing the bundle once, both approved (Product Owner,
2026-09-27) and recorded in
[rule decision 0011](../decisions/rules/0011-shared-learning-group-acquisition-arithmetic.md):

- **The marginal price of one further rank in the same Learning Group varies** with the
  group's current level rather than being constant. `F35` at society level 1, for example,
  quotes `6`, `5`, `5`, `6` over its first four ranks.
- **Adding a Learning Group may lower the build's total Learning Group cost.** Where new
  training raises a relationship floor that supplies competence an earlier Group was priced
  for, the recomputed bundle costs less than before. The calculation stays order-independent
  and history-free; the reduction is correct, and Chargen must present it as an edit to the
  Character's training allocation showing the before and after build cost, never as a
  purchase refund.

A Learning Group that teaches no base membership and exists only to open authored
Specialization access has a Group purchase cost of `0` and carries no Group purchase action
at all. Eligibility through the Group exposes the Specialization; the Specialization is
purchased and progressed separately under its own costs. The incidental flat cost of `1` it
formerly carried is retired (Product Owner ruling, 2026-09-27).

This is one shared Learning Group acquisition arithmetic, consumed by both the runtime
acquisition path and the Chargen path. Its current authority is
[rule decision 0011](../decisions/rules/0011-shared-learning-group-acquisition-arithmetic.md),
which replaced the former Chargen-local `floor(0.6 * total individual cost)` scalar and its
minimum of `1`. The retained Pilot v1 record is the historical provenance of that arithmetic
and is not current reader authority; see
[Competency Rules](./competency-rules.md) for the current Skill, Learning Group and Profession
authority.

Active group skills are:

```text
Active group skills = fixed group skills + selected choice-slot skills
```

Fixed group skills are always part of the group. Choice slots require choosing one or more skills, such as choosing `Bow` for `Basic Missile Training` or `Smithing` for `Craft Specialty`.

Unselected slot candidates do not count toward group cost and do not become trained skills. Required-slot groups cannot be bought or raised until their required choices are selected.

## 11. Profession packages and choices

App section: Chargen step `5. Choose profession`, then `6. Skill allocation`.

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

### Profession core routes

A Profession's **core route** is the training that completes the Profession. Where a Profession
has only one applicable core route, that route is simply the one that must be completed and
Chargen asks nothing. Where more than one applies, `6. Skill allocation` shows
`Choose your Profession core route` and one must be selected before finalization.

Selecting a core route does **not** narrow what the Character may buy. The app states this on the
step: the choice defines which mandatory training completes the Profession, and training offered
by the other route remains available for purchase at its ordinary cost and access. The step then
reports either `Selected core route complete.` or
`Selected core route still has required training to acquire.`

A core route can require Learning Groups, individual skills, and written-language choices; any of
those still outstanding is what keeps the route incomplete.

## 12. Derived XP and specializations

App section: the `8. Specializations` section of `6. Skill allocation`, and step `9b. Specialization Table`.

Derived XP may come from related skills, cross-training, or specialization rules.

Derived relationship definitions can be reviewed in `Admin -> Skills`.

Specializations are gated by parent skill access and parent skill level requirements.

Examples:

- `Longbow` is a specialization of `Bow`; it is not a normal missile weapon choice.
- `Fencing` is a specialization of `1-h edged`.

## 13. Review summary and finalization

App section: Chargen steps `10. Review summary` and `11. Finalize character`.

Before finalization, Chargen summarizes the selected profile, civilization, society, social band, social class, profession, mother tongue, selected languages, skill counts, point spending, and education.

Finalization is blocked until every one of these holds:

- a rolled profile is selected,
- a society is selected, which follows from the selected civilization,
- a profession is selected,
- one applicable Profession core route is selected, where more than one applies, and that route is
  complete,
- ordinary pool is not overspent,
- flexible pool is not overspent,
- ordinary spending on each purchased group is allowed for the selected profession and society,
- ordinary spending on each purchased skill is valid for this build,
- dependency and specialization gates are satisfied,
- required choice slots are complete for every group the draft owns.

Anything the app reports as a warning rather than an error does not block finalization.

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

An accessible Learning Group is priced through the one shared acquisition arithmetic stated under `Skill purchases` above; it is not restated here. Two further points apply to the target content specifically: the nine explicit Specialization memberships are excluded from both the priced sum and the group contribution, providing access only under their separate initial 4 / increase 2 costs and immediate-parent eligibility; and flexible funding does not authorize an otherwise inaccessible group.

Target builds retain family/track/source identity and approved group definitions for later display. Historical builds retain their actual identities, levels and recorded expenditure; this change performs no migration or retroactive repricing. Server validation resolves the approved catalogue and rejects forged membership, family/track or purchase-price claims.

## Profession-specific route alternatives

Two Professions — Sailor and Boat Worker, and Guard, Watcher and Escort — offer a choice between
two training routes to overlapping competence. **"Alternative" here means a choice of route, not a
prohibition.** By the Product Owner ruling of 2026-09-29 (Forgejo #387) the two alternatives are
**not mutually exclusive**: a Character who trains in only one route buys only that one, a
Character who genuinely trains in both buys both, and each is paid for independently under the
ordinary acquisition arithmetic. The named routes and the full statement of that ruling are in
[Competency Rules](./competency-rules.md); the earlier wording on this page, which described the
Guard, Watcher and Escort routes as mutually exclusive, is superseded by it.

In Chargen neither alternative is the `Choose your Profession core route` choice described under
`Profession core routes` above. Guard, Watcher and Escort has only one applicable core route, so
that choice never appears for it: both of its alternative routes are ordinary purchasable training
within `6. Skill allocation`, each bought at its ordinary cost and access, and neither of them is
the training that completes the Profession. Sailor and Boat Worker is reached as two separately
selectable Professions, so there the alternative is settled by which one is chosen at
`5. Choose profession`, and the selected Profession's own single core route is what must then be
completed. These alternatives create no tracks, do not restrict independent or direct competency
purchases, and imply nothing about other Professions.
