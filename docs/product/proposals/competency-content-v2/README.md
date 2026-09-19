# Competency Content V2 — Product Owner proposal

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — awaiting review.**
> Nothing in this folder is approved Glantri content. It does not replace the approved
> [competency reference](../../../rules/competency-reference/README.md), is not registered with
> Chargen, and is not projected into canonical content. It exists so the Product Owner can accept,
> amend or reject a redesigned Profession and Learning Group catalogue as a whole.

Issue: [#250](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/250), under umbrella #249.
Controlling product authority: [Chargen and Competency Experience Product
Contract](../../chargen-competency-experience-contract.md).
Factual starting point: the approved reference integrated by #243 / PR #245.

## Contents

- [Proposed Learning Groups](./learning-groups-v2.md)
- [Proposed Professions and valid paths](./professions-v2.md)
- [Effective-breadth analysis, before and after](./breadth-analysis.md)
- [Player-facing Skill categories and Civilization languages](./skill-categories-and-languages-v2.md)
- [Machine-readable companion](./competency-content-v2.json)

The authored source is `packages/content/src/proposals/competencyContentV2/`. The reports above are
generated from it by `packages/content/scripts/generateCompetencyContentV2Report.ts`, so the prose and
the numbers cannot drift apart.

## What the proposal changes

|                                                      | Approved |                                          Proposed |
| ---------------------------------------------------- | -------: | ------------------------------------------------: |
| Base Skills                                          |      131 | 131 (unchanged; none added, renamed or redefined) |
| Specializations                                      |       26 |                                    26 (unchanged) |
| Learning Groups                                      |       59 |   93 — 46 retained, 3 revised, 44 new, 10 removed |
| Groups with `pick N` choice slots                    |        0 |                                                 9 |
| Profession families                                  |       84 |                                84 (all preserved) |
| Valid Profession paths                               |       99 |                                                96 |
| Median effective distinct base Skills per valid path |        3 |                                                10 |
| Valid paths reaching 10                              | 10 of 99 |                                          95 of 96 |

## The five structural moves

1. **Choice slots become first-class content again.** A Learning Group may declare a `pick N` slot
   over a candidate pool. Cost is fixed Skills plus the Skills actually selected. Unselected
   alternatives grant no competence, cost nothing, and add nothing to breadth. All seven historical
   slot structures are restored: Basic and Advanced Melee, Basic and Advanced Missile, Craft
   Specialty, Advanced Craft Specialty, and Construction Specialty.

2. **Combat weapon families move into slots.** Ten fixed-weapon martial groups collapse into four
   slot-bearing groups plus the two groups that are genuinely defined by a single weapon
   (Swashbuckling fencing, Mounted lance drill). A soldier is charged for the arms actually issued
   and drilled, not for every family the army fields. This also **restores general 2-h edged
   access**, which the approved catalogue reached only through F37 on two Soldier tracks.

3. **Profession curricula are authored to the ~10 design signal.** The approved catalogue's median
   valid path taught 3 distinct base Skills and 89 of 99 paths fell below 10; one Profession taught
   none at all. The proposal reaches a median of 10 with a tight spread (quartiles 10 and 11,
   maximum 15) by adding coherent Learning Groups and stated direct routes, not by padding narrow
   groups with unrelated Skills.

4. **Every opportunity states its route.** A direct competency without a stated route is an
   unexplained grant, not a training opportunity. The deterministic checks refuse a path that
   supplies direct competencies with no route label.

5. **Access provenance stops masquerading as a category.** `Special access` is retired as a
   player-facing Skill category and every competency receives a real one. The `language` category is
   preserved and reserved for spoken and written competencies.

## Specific corrections carried by the proposal

- **Birth Attendant and Midwife (P33)** was the only Profession with zero learnable base Skills,
  because Obstetrics' immediate parent Medicine was not reachable in its own envelope. The proposed
  birth-attendance practice supplies Medicine alongside Obstetrics, implementing the approved
  Medicine → Obstetrics correction (#231). The path now reaches 10.
- **Herald (P76)** could reach Genealogy without History and Courtly Protocol without Customs. The
  proposed heraldic office practice supplies both parents inside the family's own envelope.
- **Every reachable Specialization's immediate parent** is now reachable on the same path. The
  deterministic check that proves this returns an empty list.
- **Food Preservation is deliberately not attached** to the proposed vineyard practice: its parent,
  Cooking, is not part of that practice, and an explicit membership never waives immediate-parent
  eligibility.

## What the proposal deliberately does not do

- **Scribe and Copyist's Written Tradition core remains blocked on #113.** It is recorded as a
  blocked dependency and is not resolved by judgement. The Scribe package must not be presented as
  universal literacy.
- **Poisons still has no generic occupational route**, and **Warded-Lock Entry still has no
  specialist occupation.** Both absences are approved positions in the current gap report. Attaching
  Poisons to the Alchemist or Warded-Lock Entry to the Locksmith would be a new rule, not a content
  fix.
- **No runtime, UI or Chargen change.** The category correction, the choice-slot schema use and the
  language competencies all need a separate authorized implementation task.
- **No mechanical relationship edge is invented.** Every Skill, Specialization and parent link used
  here already exists in the approved catalogues.
- **No broad rewrite of the 131 base Skills.** No Skill is added, removed, renamed or redescribed.

## Open questions requiring a Product Owner ruling

| #   | Question                                                                                                                                                                        | Why it cannot be settled here                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is ~10 effective distinct base Skills the accepted target, and is the proposed spread (median 10, quartiles 10–11, max 15) the shape you want?                                  | The product contract reserves the numeric target for a Product Owner decision after this audit.                                                                                              |
| 2   | May the Learning Group roster grow from 59 to 93?                                                                                                                               | #250 says 59 is not sacred, but the final roster size is a catalogue decision.                                                                                                               |
| 3   | Is Advanced Melee `pick 3` correct? The recovered import says choose 2 and the current executable data says choose 3.                                                           | An unresolved source conflict recorded in the approved gap report. The proposal states 3 and flags it.                                                                                       |
| 4   | Is Advanced Craft Specialty `pick 3`? The approved data's mechanic is choose-one and its prose says two specialties.                                                            | The same unresolved conflict; the proposal states 3 rather than inheriting stale prose.                                                                                                      |
| 5   | How should Society Level 1–2 narrowness actually be expressed?                                                                                                                  | The proposal authors each family at its full envelope. Nothing in the data model yet distinguishes the household/communal subset of a curriculum from its developed-society form.            |
| 6   | Should the seven real-world-analogue **Civilization** names be renamed?                                                                                                         | Language names derive from them. Until the Civilizations are named in Glantri terms, seven language names cannot be finally settled.                                                         |
| 7   | Are the candidate Glantri language names acceptable — Kethran, Old Latian, Palace Scyrian, Kaldan, Aspardic, and the Harbour/Hill/Palace/Wedge/Chancery scripts?                | These are invented proper nouns. The approved gap report explicitly refuses to replace missing linguistic detail with fictional Glantri history, so they need approval rather than adoption. |
| 8   | Should the proposed Palace Scyrian name imply descent from Scyria?                                                                                                              | That would be a new Glantri fact about civilizational relationship.                                                                                                                          |
| 9   | Should the nine unresolved written-tradition cases (Common, Old Common, Cuneiform, Imperial Aramaic, Linear B, Old Italic, Royal N'kolian, Runic Scandian, Tuu) be defined now? | The proposal supplies candidate names only; script, register and conventions remain unauthored.                                                                                              |
| 10  | Does retiring `special-access` as a player-facing category need a matching Chargen presentation decision for how direct-Profession access is shown instead?                     | The access label still has to appear somewhere; where it appears is a UX decision.                                                                                                           |
| 11  | Are the proposed new Learning Groups' fixed members correct as _taught practice_?                                                                                               | Roughly forty practices are newly described. Each is a content judgement the Product Owner owns.                                                                                             |
| 12  | Should Soldier's nine fixed-weapon tracks really collapse to four?                                                                                                              | The collapse follows from the choice slots, but track identity is player-facing content.                                                                                                     |
| 13  | Should Poisons and Warded-Lock Entry receive routes at all?                                                                                                                     | Both are deliberate approved absences; creating a route is a rule decision.                                                                                                                  |
| 14  | The approved provenance count conflict (518 claimed vs 523 printed legacy associations) is untouched.                                                                           | No evidence identifies which rows, if any, are erroneous.                                                                                                                                    |

## Verification performed

- Deterministic catalogue checks: family, path, route, anchor and choice-slot verification, plus
  Learning Group disposition accounting against the approved 59, executed by
  `packages/content/src/proposals/competencyContentV2/competencyContentV2.test.ts`.
- Quantitative effective-breadth analysis across all families and valid paths, computed by the #250
  counting rules, with the approved catalogue measured by the same code path.
- Content package tests, Prettier and `git diff --check`.
