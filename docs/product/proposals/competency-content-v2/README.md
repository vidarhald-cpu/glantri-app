# Competency Content V2 — Product Owner proposal

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — accepted as a starting point, revised, awaiting review.**
> Nothing in this folder is approved Glantri content. It does not replace the approved
> [competency reference](../../../rules/competency-reference/README.md), is not registered with
> Chargen, and is not projected into canonical content.

Issue: [#250](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/250), under umbrella #249.
Controlling product authority: [Chargen and Competency Experience Product
Contract](../../chargen-competency-experience-contract.md), whose section 5 records the authoring
target and section 6 authorizes this catalogue redesign.

## Contents

- [Proposed Learning Groups, with the size review](./learning-groups-v2.md)
- [Proposed Professions and valid paths](./professions-v2.md)
- [Effective-breadth analysis, before and after](./breadth-analysis.md)
- [Direct-grant review — what was withdrawn and what was kept](./direct-grant-review.md)
- [Player-facing Skill categories and Civilization languages](./skill-categories-and-languages-v2.md)
- [Machine-readable companion](./competency-content-v2.json)

The authored source is `packages/content/src/proposals/competencyContentV2/`. Every report above is
generated from it by `packages/content/scripts/generateCompetencyContentV2Report.ts`, so the prose and
the numbers cannot drift apart.

## Governing principle: breadth is a diagnostic, not a target

The first draft of this proposal was authored under breadth pressure and pushed every ordinary path to
at least ten effective base Skills. The Product Owner has inverted that pressure. This revision
authors coherent occupational training first and then reads breadth as a diagnostic:

- roughly 10 remains a design signal, never a quota or a minimum;
- a coherent path at **7–9 is an accepted outcome**, not a defect;
- a broader path is accepted where the occupation genuinely is broad;
- a path below 7 is flagged for a coherence review rather than marked deficient;
- **no Profession is padded to reach a number.**

The visible consequence is that 166 direct Profession Skill grants were withdrawn and the median fell
from 10 to 8. That fall is the intended result, not a regression.

## What the proposal changes

|                                                      | Approved | First draft | This revision                                        |
| ---------------------------------------------------- | -------: | ----------: | ---------------------------------------------------- |
| Base Skills / Specializations                        | 131 / 26 |    131 / 26 | 131 / 26 (unchanged; none added, renamed, redefined) |
| Learning Groups                                      |       59 |          93 | 92 — 44 retained, 4 revised, 44 new, 11 removed      |
| Groups with `pick N` choice slots                    |        0 |           9 | 9                                                    |
| Largest fixed purchase burden of one group           |        7 |           7 | 6                                                    |
| Groups outside the 2–4 size band                     |        — |     2 below | 0 below, 4 above (all choice-driven)                 |
| Profession families                                  |       84 |          84 | 84 (all preserved)                                   |
| Valid Profession paths                               |       99 |          96 | 96                                                   |
| Direct Profession Skill grants                       |     88\* |         283 | 120                                                  |
| Median effective distinct base Skills per valid path |        3 |          10 | 8                                                    |
| Quartiles                                            |    1 / 7 |     10 / 11 | 7 / 10                                               |

\* The approved figure counts direct Skill and Specialization opportunities together across 84 families.

## The structural moves

1. **Choice slots are first-class content again.** A Learning Group may declare a `pick N` slot over a
   candidate pool. Cost is fixed Skills plus the Skills actually selected; unselected alternatives grant
   no competence, cost nothing, and add nothing to breadth. All seven historical slot structures are
   restored.

2. **Combat weapon families live in slots.** Ten fixed-weapon martial groups collapse into four
   slot-bearing groups plus the two genuinely defined by a single weapon. A soldier is charged for the
   arms actually issued and drilled. This also **restores general 2-h edged access**, which the approved
   catalogue reached only through F37 on two Soldier tracks.

3. **Curricula are authored for coherence, then measured.** See the
   [direct-grant review](./direct-grant-review.md) for the full accounting.

4. **Every opportunity states its route.** A direct competency without a stated route is an unexplained
   grant, not a training opportunity; the deterministic checks refuse one.

5. **Access provenance stops masquerading as a category.** `Special access` is retired as a
   player-facing Skill category and every competency receives a real one. The `language` category is
   preserved and reserved for spoken and written competencies.

## Learning Group size review

Applying the size guidance — a normal centre of 3–4, 2 entirely acceptable where competencies are
genuinely learned together, 1 a sign that a direct route or a broader practice fits better, 5+ needing
positive justification and 6+ normally advanced, compound or materially choice-driven — produced two
genuine content changes and a long list of confirmations. **No group was forced into the 3–4 centre.**

- **F22 Seasonal kitchen and preservation practice** taught exactly one base Skill. Revised to Cooking
  and Plant Lore: seasonal kitchen work genuinely teaches what is available when.
- **F16 Lineage investigation apprenticeship** taught exactly one base Skill, Research, which both its
  users already reach elsewhere. It was a Specialization-access wrapper, not a taught practice. Retired;
  Genealogy becomes a direct Specialization route and its immediate parent History comes from K10.
- **F32 Mounted lance and troop drill** carried a fixed burden of seven. Brawling was removed: mounted
  troop drill teaches fighting from the saddle, not unarmed scuffling. Fixed burden is now six.
- **K11 Court service practice** gained Administration, which is the daily substance of court service
  and the immediate parent of the Court Administration Specialization the group makes available.
- The 35 two-Skill groups were each reviewed and retained. Every one is a genuinely paired practice
  (Surveying with Cartography, Fibre Working with Weaving, Smelting with Smithing, and so on).
- The four groups above the band are all advanced or compound **and** materially choice-driven, so their
  size is player-selected breadth rather than fixed purchase burden. **C03** has a fixed burden of one
  with a pick-two slot; that is the distinction the guidance asks for, not a one-Skill group.

## Society Level 1–2

Adopted as ruled: Society Level narrows availability **within** one Profession curriculum. The proposal
contains no Society-Level-duplicated Profession definitions and no per-level Profession variants — each
family has exactly one curriculum, authored at its full envelope, from which a less developed society
supports fewer routes.

Authoring **which** individual routes a Society Level 1 or 2 community cannot support is a contextual
availability question, and contextual availability remains unfinished under #113. The proposal
therefore adopts the model and does not invent the per-route data.

## Specific corrections carried

- **Birth Attendant and Midwife (P33)** was the only Profession with zero learnable base Skills, because
  Obstetrics' immediate parent Medicine was not reachable in its own envelope. The proposed
  birth-attendance practice supplies Medicine alongside Obstetrics, implementing the approved
  Medicine → Obstetrics correction (#231).
- **Herald (P76)** could reach Genealogy without History and Courtly Protocol without Customs. The
  proposed heraldic office practice supplies both parents inside the family's own envelope.
- **Every reachable Specialization's immediate parent** is reachable on the same path. The deterministic
  check that proves this returns an empty list.
- **Food Preservation is deliberately not attached** to the proposed vineyard practice: its parent,
  Cooking, is not part of that practice, and an explicit membership never waives immediate-parent
  eligibility.

## What the proposal deliberately does not do

- **Scribe and Copyist's Written Tradition core remains blocked on #113.** Recorded as a blocked
  dependency, not resolved by judgement. The package must not be presented as universal literacy.
- **Advanced Craft Specialty's count is left unresolved.** The executable data says choose one, its own
  prose says two, and the master-artisan reading suggests three. Per ruling this must not be settled by
  breadth pressure, so the analysis counts the lowest evidenced value and the question stays open.
- **Poisons and Warded-Lock Entry keep their approved absence of a generic occupational route.**
- **Invented Glantri language and civilization names are not adopted.** They are carried as clearly
  marked candidates requiring a naming ruling.
- **No runtime, UI or Chargen change.**
- **No mechanical relationship edge is invented**, and **no broad rewrite of the 131 base Skills.**

## Remaining Product Owner decisions

Questions settled by the current ruling have been removed from this list.

| #   | Question                                                                                                                                                                | Why it cannot be settled here                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Advanced Craft Specialty: choose one, two, or three?                                                                                                                    | Held open by explicit ruling. The proposal counts one so that no content depends on the answer.                                          |
| 2   | Should the seven real-world-analogue **Civilization** names be renamed?                                                                                                 | Language names derive from them; seven language names cannot be finally settled first.                                                   |
| 3   | Are the candidate Glantri language names acceptable — Kethran, Old Latian, Palace Scyrian, Kaldan, Aspardic, and the Harbour, Hill, Palace, Wedge and Chancery scripts? | They are invented proper nouns, and this task does not approve them. Only the Lankhmaran correction stands on an existing Glantri name.  |
| 4   | Should the proposed Palace Scyrian name imply descent from Scyria?                                                                                                      | That would assert a new relationship between Glantri civilizations.                                                                      |
| 5   | Should the nine unresolved written-tradition cases be defined now?                                                                                                      | Candidate names only; script, register and conventions remain unauthored, and the approved gap report refuses to fill them by inference. |
| 6   | Now that `special-access` is not a category, where should direct-Profession access provenance be shown instead?                                                         | The label still has to appear somewhere. That is a Chargen presentation decision.                                                        |
| 7   | Are the 44 new Learning Groups correct as descriptions of **taught practice**?                                                                                          | Forty-four practices are newly described; each is a content judgement the Product Owner owns.                                            |
| 8   | Are the four Soldier tracks the right four, by name and identity?                                                                                                       | The collapse is approved in principle; the resulting track identities are player-facing content.                                         |
| 9   | Are the retained direct grants the right calls, particularly the marginal ones — the cook's Customs and Bargaining, the midwife's Religion, the potter's Masonry?       | Each was retained on a coherence argument that the Product Owner may read differently.                                                   |
| 10  | Are the group-size changes accepted — retiring F16, broadening F22, trimming F32, and fixing Administration into K11?                                                   | Each changes what a practice teaches.                                                                                                    |
| 11  | Which individual routes should Society Level 1–2 withhold?                                                                                                              | The model is settled; the per-route data is contextual availability, unfinished under #113.                                              |

## Verification performed

- 35 deterministic catalogue checks: family, path, route, anchor and choice-slot verification; Learning
  Group disposition accounting against the approved 59; group-size band accounting; and a check that the
  direct-grant review matches the authored catalogue exactly in both directions.
- Quantitative effective-breadth analysis across all families and valid paths, with the approved
  catalogue measured by the same code path.
- Content package tests, typecheck, ESLint, the changed-file formatting gate, and `git diff --check`.
