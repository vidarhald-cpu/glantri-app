# Competency Content V2 — Product Owner proposal

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — reconciled against the 2026-09-21 rulings, awaiting review.**
> Nothing in this folder is approved Glantri content. It does not replace the approved
> [competency reference](../../../rules/competency-reference/README.md), is not registered with
> Chargen, and is not projected into canonical content.

Issue: [#266](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/266), under umbrella #249,
successor to the integrated [#250](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/250).
Controlling product authority: [Chargen and Competency Experience Product
Contract](../../chargen-competency-experience-contract.md), whose section 5 records the authoring
target and section 6 authorizes this catalogue redesign.

This revision is a **reconciliation of the existing proposal against the Product Owner rulings**, not
a new catalogue investigation and not a redesign from scratch.

## Contents

- [Proposed Learning Groups, with the shape review and the combat structure](./learning-groups-v2.md)
- [Proposed Professions, core routes and valid paths](./professions-v2.md)
- [Effective-breadth and group-size analysis, before and after](./breadth-analysis.md)
- [Direct-grant review — what was withdrawn, what moved into groups, what was kept](./direct-grant-review.md)
- [Player-facing Skill categories and Civilization languages](./skill-categories-and-languages-v2.md)
- [Player-facing explanation of Society-Level route availability](./society-level-route-availability.md)
- [Machine-readable companion](./competency-content-v2.json)

The authored source is `packages/content/src/proposals/competencyContentV2/`. Every report above
except this file and the Society-Level explanation is generated from it by
`packages/content/scripts/generateCompetencyContentV2Report.ts`, so the prose and the numbers cannot
drift apart.

## Governing principles, as ruled

- **Breadth is a diagnostic, never a quota or a minimum.** Roughly 10 effective base Skills per path
  remains a design signal. Author coherent training first; measure afterwards.
- **A Learning Group is a coherent taught or practised curriculum**, not a bag of Skills that happen
  to suit the same Profession.
- **3–4 effective base Skills is the preferred group centre.** 2 is valid where genuinely coherent, 1
  requires reconsideration, 5+ requires justification, and combat groups may deliberately be larger.
- **Profession breadth comes from access to several coherent groups**, not from oversized groups or
  direct-Skill padding.
- **Direct Profession Skills are exceptional occupational routes**, not a breadth mechanism.
- **Access is not a grant.** A group or Profession may make a Specialization reachable; it is still
  purchased separately, and parent-Skill eligibility still applies.
- **Availability applies to routes.** A closed route does not close a Skill; Skills remain reachable
  through the union of all valid routes.

## What the proposal changes

|                                                      | Approved | #250 revision | This reconciliation                                  |
| ---------------------------------------------------- | -------: | ------------: | ---------------------------------------------------- |
| Base Skills / Specializations                        | 131 / 26 |      131 / 26 | 131 / 26 (unchanged; none added, renamed, redefined) |
| Learning Groups                                      |       59 |            92 | 96 — 44 retained, 2 revised, 50 new, 13 removed      |
| Groups in the 3–4 preferred centre                   |       15 |            53 | 57                                                   |
| Groups at two                                        |       36 |            35 | 36                                                   |
| Groups at one                                        |        4 |             0 | 0                                                    |
| Groups at five or more                               |        4 |             4 | 3 (all broad combat groups, each justified)          |
| Largest fixed purchase burden of one group           |        7 |             6 | 4                                                    |
| Profession families                                  |       84 |            84 | 84 (all preserved)                                   |
| Valid Profession paths                               |       99 |            96 | 96                                                   |
| Direct Profession Skill grants                       |     88\* |           119 | 101                                                  |
| Declared core routes                                 |        — |             — | 96, all satisfied (1 recorded as blocked on #113)    |
| Median effective distinct base Skills per valid path |        3 |             8 | 8                                                    |
| Quartiles                                            |    1 / 7 |        7 / 10 | 7 / 10                                               |

\* The approved figure counts direct Skill and Specialization opportunities together across 84
families.

## What this reconciliation did

### 1. Combat restructuring — the largest change

Focused and broad combat groups now coexist, and the **overlap between them is intentional**: breadth
is deduplicated per path, so reaching the same weapon family twice costs once.

- **M01** is the focused melee package the ruling describes: Dodge, Parry and one chosen melee weapon
  family. **M04** is its missile counterpart. **F30** stays fixed, because the tradition is defined
  by its weapon.
- **M02, M03 and M05** are the broad groups, deliberately at five, buying economical breadth. Their
  pools are context-specific and **cross category**: M02 offers Brawling and Throwing beside the
  melee families; M03 offers Throwing and the Sling beside the line weapons.
- **Brawling is no longer fixed in any weapon course.** It sits in the broad pool, taken where the
  school genuinely teaches it, instead of being an unexamined surcharge on every melee curriculum.
- **F32 is replaced as ruled** by **M11 Mounted combat practice** (Riding + Mounted Combat) and
  **M12 Mounted lance and formation drill** (Lance + Formation Fighting), with the general
  close-combat group M01 supplying the mounted Profession's sidearm and guard.

### 2. Combat Experience is out of every instruction group

It is experiential competence from credible real combat or field exposure, not instruction. It now
comes from exactly two routes, both experiential:

- **M06 Campaign service experience** — repeated service in the field: the Soldier, the Mounted
  Soldier, the Military Scout, the Military Commander, the Siege Engineer, the Siege Engine Crew
  Specialist and the Field Surgeon.
- **K23 Coercive service practice** — habitual real violence in someone's service: the Enforcer.

The **Weapon Instructor no longer acquires it**, which is the point of the ruling: instructing is not
exposure.

### 3. F16 and F22 retired, their Specialization routes preserved

Both were a single effective base Skill wrapped around Specialization access.

- **F16** was already retired in #250. **Genealogy** remains reachable through P67 Historian and P76
  Herald, with its parent History supplied by K10 on both paths.
- **F22** is retired here. **Food Preservation** is carried by **C10 Brewing and preserving
  practice**, whose curriculum genuinely contains it and whose Cooking is the Specialization's
  immediate parent. Five paths still reach it.

### 4. Coherent direct-grant clusters moved into groups

Direct grants are exceptional routes, so four clusters that described a real taught practice became
Learning Groups: **K24 Watch and guard practice** (the Guard), **K25 Street theft practice** (the
Thief), **K22 Contemplative discipline practice** (the Diviner and the Religious Practitioner) and
**M10 Arms instruction practice** (the Weapon Instructor). Direct grants fell from 119 to 101.

### 5. Core routes

Every Profession declares at least one **defining core route** — the training it is not that
Profession without, expressed entirely in terms of the Learning Groups and directly taught Skills
that already exist. A track's own core routes refine or replace its parent's. All 96 path/core-route
pairs are satisfied. **No GM override mechanism is required or introduced.** The Scribe and Copyist's
Written Tradition core is recorded as **blocked on #113** rather than invented.

### 6. Cost invariants are enforced, not asserted

Overlapping routes name the same competency 102 times across the catalogue; every one is charged
once. Accumulating each path's routes in reverse order yields the identical charged set. A catalogue
that broke either property would **fail to build**.

### 7. Languages: invented names withdrawn

Kethran, Old Latian, Palace Scyrian, Kaldan and Aspardic are withdrawn, along with the Harbour, Hill,
Palace, Wedge and Chancery scripts, and the derived Common Hand and Royal N'kolian registers.
Canonical Glantri names are used where established; the appropriate historical name otherwise. No
linguistic descent is asserted — in particular, the suggested Mycenaean descent from Scyria is gone.
Every Civilization has a rollable spoken competency, and a rollable written one unless authored as
having no writing. **Olog is flagged for later correction and deliberately not corrected here.**

### 8. Skill categories

Sixteen broad, semantically predictable browse categories covering all 157 competencies. They
describe what a competency **is**, never where it was learned, which is why `special-access` is
retired as a category.

### 9. Player-facing Society-Level explanation

[society-level-route-availability.md](./society-level-route-availability.md) explains, in a player's
terms, why the same Profession exposes different training in different societies: the Profession is
one identity, Society Level and Social Band govern which **routes** exist, and a Skill is reachable
through the union of every route that does.

## What the proposal deliberately does not do

- **No change to the 131 base Skills or the 26 Specializations** — identities, mechanics, boundaries
  and reader prose are untouched. This work reorganises access and topology only.
- **No new conceptual layer or entity type.** Core routes are a data annotation over existing groups
  and Skills, not a new primitive.
- **Scribe and Copyist's Written Tradition core remains blocked on #113.** The package must not be
  presented as universal literacy.
- **Advanced Craft Specialty's count is left unresolved.** The analysis counts the lowest evidenced
  value so that no content depends on the answer.
- **Poisons and Warded-Lock Entry keep their approved absence of a generic occupational route.**
- **Olog is not corrected**, only flagged.
- **No runtime, UI or Chargen change**, and no mechanical relationship edge is invented.

## Remaining Product Owner decisions

Everything the 2026-09-21 rulings settle has been removed from this list. What remains is genuinely
unsettled.

| #   | Question                                                                                                                              | Why it cannot be settled here                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Advanced Craft Specialty (C02): choose one, two, or three?                                                                            | Held open by explicit ruling and must not be settled by breadth pressure. The proposal counts one so that no content depends on the answer. |
| 2   | Are the 50 new Learning Groups correct as descriptions of **taught practice**?                                                        | Each is a content judgement the Product Owner owns. The six added here — K22, K24, K25, M10, M11, M12 — deserve particular attention.       |
| 3   | Are the four Soldier tracks the right four, by name and identity?                                                                     | The collapse is approved in principle; the resulting track identities are player-facing content.                                            |
| 4   | Are the declared core routes right where the first-listed group was not obviously the defining one — P02, P09, P20, P26, P27 and P31? | A core route states what a Profession is not that Profession without. That is a product judgement, not a derivable fact.                    |
| 5   | Are the two Professions still carrying three direct Skill grants acceptable — P16 Local Informant and P52 Trapmaker?                  | Both were argued on coherence rather than trimmed to a number, and the Product Owner may read either differently.                           |
| 6   | Should the Common and Old Common **written traditions** be given script, register and conventions now?                                | The competencies are named for their languages and invent no script. Authoring the traditions themselves is unfinished in the gap report.   |
| 7   | What is the precise identity of the San Forager Bands' spoken **Tuu**?                                                                | No competency exists today, and the approved gap report asks for an identity this proposal cannot infer.                                    |
| 8   | Now that `special-access` is not a category, where should direct-Profession access provenance be shown instead?                       | The label still has to appear somewhere. That is a Chargen presentation decision.                                                           |
| 9   | Which individual routes should Society Level 1–2 withhold?                                                                            | The model is settled and now explained for players; the per-route data is contextual availability, unfinished under #113.                   |

## Verification performed

- Deterministic catalogue checks, extended for these rulings: group-shape bands with mandatory
  justification at one and at five or more; Specialization access-not-grant, including the refusal to
  count a Specialization as base breadth and the empty unreachable-parent list; core-route presence
  and satisfaction on every valid path; and the no-duplicate-payment and order-independence cost
  invariants. Failing any of them fails the build, not just a test.
- 52 content-package tests, typecheck, ESLint, the changed-file formatting gate, and `git diff --check`.
- Quantitative effective-breadth and group-size analysis across all families and valid paths, with the
  approved catalogue measured by the same code path.
