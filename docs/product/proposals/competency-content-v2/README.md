# Competency Content V2 — Product Owner proposal

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — reconciled against both 2026-09-21 ruling sets, awaiting review.**
> Nothing in this folder is approved Glantri content. It does not replace the approved
> [competency reference](../../../rules/competency-reference/README.md), is not registered with
> Chargen, and is not projected into canonical content.

Issue: [#266](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/266), under umbrella #249,
successor to the integrated [#250](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/250).
Controlling product authority: [Chargen and Competency Experience Product
Contract](../../chargen-competency-experience-contract.md), whose section 5 records the authoring
target and section 6 authorizes this catalogue redesign.

This revision is a **reconciliation of the existing proposal against the Product Owner rulings**, not
a new catalogue investigation and not a redesign from scratch. It now carries the **second ruling set
of 2026-09-21**, which confirmed most of the first reconciliation and changed six things: C02 is
settled, combat is an explicit exception to the group-size rule, the category roster may be
simplified, tracks must earn their complexity, cores must be minimal, and the language blocker is
removed.

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
  purchased separately, parent-Skill eligibility still applies, and the parent must be reachable on
  the valid path — though not necessarily in the same Learning Group. A Specialization never counts
  toward base-Skill breadth or a group's Skill cost.
- **Availability applies to routes.** A closed route does not close a Skill; Skills remain reachable
  through the union of all valid routes, and a restriction is recorded at the most general route
  level where it is genuinely true.
- **Combat is an explicit exception to the 5+ rule.** A larger, choice-heavy combat group is
  _desirable_, because it makes broad investment in one narrow competence domain economically viable.
- **A track must earn its complexity.** Where a Learning Group or a choice slot already expresses the
  distinction, there is no track.
- **A core must be minimal** — enough for identity, never a rigid class build.
- **A category must be guessable** from the Skill name and the category labels alone, and the roster
  is no longer held to awkward placements for compatibility.

## What the proposal changes

|                                                      | Approved | #250 revision | First reconciliation | This revision                         |
| ---------------------------------------------------- | -------: | ------------: | -------------------: | ------------------------------------- |
| Base Skills / Specializations                        | 131 / 26 |      131 / 26 |             131 / 26 | 131 / 26 (unchanged)                  |
| Learning Groups                                      |       59 |            92 |                   96 | 96 — 44 retained, 2 revised, 50 new   |
| Groups in the 3–4 preferred centre                   |       15 |            53 |                   57 | 57                                    |
| Groups at two                                        |       36 |            35 |                   36 | 36                                    |
| Groups at one                                        |        4 |             0 |                    0 | 0                                     |
| Groups at five or more                               |        4 |             4 |                    3 | 3 (all combat, under the exception)   |
| Largest fixed purchase burden of one group           |        7 |             6 |                    4 | 4                                     |
| Profession families                                  |       84 |            84 |                   84 | 84 (all preserved)                    |
| Professions carrying tracks                          |        — |             8 |                    8 | 2                                     |
| Tracks                                               |        — |            21 |                   21 | 4                                     |
| Valid Profession paths                               |       99 |            96 |                   96 | 86                                    |
| Direct Profession Skill grants                       |     88\* |           119 |                  101 | 101                                   |
| Player-facing browse categories                      |        — |            16 |                   16 | 14                                    |
| Civilization languages awaiting a naming ruling      |        — |             — |                    7 | 0                                     |
| Declared core routes                                 |        — |             — |                   96 | 86, all satisfied (1 blocked on #113) |
| Median effective distinct base Skills per valid path |        3 |             8 |                    8 | 8                                     |
| Quartiles                                            |    1 / 7 |        7 / 10 |               7 / 10 | 7 / 10                                |
| Narrowest path                                       |        0 |             6 |                    6 | 7                                     |
| Broadest path                                        |       17 |            15 |                   15 | 16                                    |

\* The approved figure counts direct Skill and Specialization opportunities together across 84
families.

## What the second ruling set changed

### 1. C02 is settled

**C02 = Appraisal + Bargaining + Teaching + choose ONE craft.** The earlier source conflict — data
said one, its prose said two, a master-artisan reading suggested three — is closed in favour of one,
and the ruling forbids raising it under breadth pressure. The exact shape is now a deterministic
check, so it cannot drift. This closes the previous revision's open question 1.

### 2. Combat groups revisited under the explicit exception

M02, M03 and M05 were re-examined as _desirable_ rather than defended as tolerable. None had been
trimmed to reach a number, so none grew back; what changed is that the catalogue no longer apologises
for them, and the exception is enforced as an **allowlist** — the build refuses any other group that
reaches five, and refuses any listed group that stops being large and choice-heavy. M01 remains the
focused package the ruling describes (Dodge, Parry, one chosen melee family), Brawling stays out of
the fixed weapon courses, and M11/M12 continue to carry the retired F32.

### 3. Tracks audited; sixteen retired — settled by Product Owner ruling

A track is a materially different **form** of the occupation, so the audit applies one mechanisable
test: **a track must declare a core route of its own.** If the defining training does not differ, the
variant was an ordinary weapon, Skill or equipment choice and belongs in the Profession's group list.

- **Kept:** P09 Sailor (inshore boat work against rigged-vessel service) and P31 Surgeon (civil
  operative apprenticeship against field surgery) — four tracks, each with its own core.
- **Retired:** P14 Guard (2), **P22 Soldier (4)**, P24 Military Scout (2), P25 Military Commander (3),
  P26 Military Quartermaster (2) and P82 Weapon Instructor (3).

The **four Soldier tracks are retired**: every one differed from its siblings only in which combat
Learning Group it bought. The Soldier is one identity whose core is repeated service in the field,
with contingent drill, formation drill, the issued missile arm and the longbow tradition all openly
available — which is exactly the access-to-several-coherent-groups shape the breadth ruling asks for.
Valid paths fall from 96 to 86, and the `narrowByDesign` exemption P82's one-tradition fencing track
needed is removed with it.

This is no longer merely this proposal's own internal audit outcome: the **"PRODUCT OWNER RULING —
Profession tracks (settled)"** comment recorded on [issue #266](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/266)
on 2026-09-21 **approves the retirement of all 16 tracks and confirms the same four retained tracks**
listed above, and settles two dispositions by name: **Soldier longbow identity** is carried by the
longbow/combat Learning Group plus contextual/cultural availability, not a track, and **communal/militia
command** remains a route/context distinction, not a track, absent future content showing a materially
different defining curriculum. The ruling states the same governing rule the mechanisable build test
enforces — see [Track discipline](./professions-v2.md#track-discipline) — and that **no further track
investigation is required**. This closes the previous revision's open question 3, and the track outcome
is settled, not pending further Product Owner review.

### 4. Cores audited and held minimal

Every core is one Learning Group, except P20 Smuggler, which needs two. The build now refuses any
core requiring more than two things. A small set of **alternative** core routes is permitted and none
is needed: where the defining training genuinely differs, a track with its own core says so.

### 5. Category roster simplified from sixteen to fourteen

- **`mental` retired.** Two members — Meditation and Mnemonics — is proliferation, and neither name
  points a player at the word. Meditation joins `mystical`; Mnemonics joins `knowledge`.
- **`high-society` retired.** It described a milieu, which is what the ruling forbids. Heraldry joins
  `knowledge`; Politics and Courtly Protocol join `social`.
- **One arbitrary placement corrected.** Agriculture & Husbandry defaulted to `trade`, splitting the
  living-animal competencies across two categories. It now defaults to `fieldcraft`, with Cart Driving
  overridden back to `trade` as the transport trade it is.

`special-access` remains retired as provenance rather than a category, and `language` remains a
distinct browse category. The build refuses a retired category and refuses any category that falls
below four competencies.

### 6. The language blocker is removed

Every Civilization now carries a rollable spoken competency, and a rollable written one unless the
absence is **authored** — San Forager Bands and Scythians, both non-literate. Reading is rolled
against the written competency. **No entry defers to a further naming ruling any more**, which closes
the previous revision's open questions 6 and 7:

- **Common and Old Common written traditions** are rollable now, named for their languages. Script,
  register and conventions are later enrichment, not a blocker.
- **Tuu** is settled by the naming ruling itself: no approved Glantri name exists, so the appropriate
  historical name stands, and nothing further is invented.

Invented names stay withdrawn, no descent is asserted, and **Olog is flagged for later correction and
deliberately not corrected**.

### 7. Combat Experience: routes audited separately

CE is reachable only through **M06 Campaign service experience** and **K23 Coercive service
practice**, and only eight paths reach it — the Enforcer through coercive service, and the Soldier,
Mounted Soldier, Military Scout, Military Commander, Siege Engineer, Siege Engine Crew Specialist and
field Surgeon through campaign service. Each has an authored route label that explains the exposure.
The Weapon Instructor, the Guard, the Military Quartermaster and the civil Surgeon reach none. The
containment is enforced both ways: the build refuses any other group that teaches CE, and refuses
either route group if it stops teaching it. The full audit table is in the Professions report.

### 8. Society Level

The player-facing explanation now also states **where a restriction is written down**: at the
Learning Group when the curriculum does not exist in that society, at the Profession's route into the
group when it exists but that occupation cannot reach it — and never as a society-specific Profession
variant.

### 9. Overlap economics

Unchanged and preserved, as ruled. The existing group-rebate arithmetic is untouched; no defect was
demonstrated. Overlapping routes name the same competency 107 times across the catalogue and every
one is charged once, with the charged set identical when the routes are accumulated in reverse order.

## What the first reconciliation did, and this revision keeps

Breadth as a signal rather than a quota; F32 retired for M11 and M12; focused M01/M04 beside broad
M02/M03/M05 with cross-category pools; Combat Experience out of every instruction group; direct
grants reduced from 283 to 101; F16 and F22 retired with the Genealogy and Food Preservation routes
preserved through P67/P76 and C10; invented language names withdrawn and kept out by test; core routes
introduced as a data annotation; and the machine-readable companion regenerated from the source so
the prose and the numbers cannot drift.

## What the proposal deliberately does not do

- **No change to the 131 base Skills or the 26 Specializations** — identities, mechanics, boundaries
  and reader prose are untouched. Prior authoring is reused, not rewritten.
- **No new conceptual layer or entity type.** Every ruling above is expressed with primitives the
  proposal already had.
- **Scribe and Copyist's Written Tradition core remains blocked on #113.**
- **Poisons and Warded-Lock Entry keep their approved absence of a generic occupational route.**
- **Olog is not corrected**, only flagged for a separate follow-up.
- **No runtime, UI or Chargen change**, no importer outside this directory, and no entry in
  `packages/content/src/index.ts`. The proposal is not canonical.

## Remaining Product Owner decisions

Everything both ruling sets settle has been removed. Four of the previous nine questions are closed
here: **C02's count** (settled by ruling), **the four Soldier tracks** (retired, so there is nothing
to name), **the Common and Old Common written traditions** and **the identity of Tuu** (both closed by
the naming ruling). What remains is genuinely unsettled.

| #   | Question                                                                                                                              | Why it cannot be settled here                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Are the 50 new Learning Groups correct as descriptions of **taught practice**?                                                        | Each is a content judgement the Product Owner owns. K22, K24, K25, M10, M11 and M12 deserve particular attention.                     |
| 2   | Are the declared core routes right where the first-listed group was not obviously the defining one — P02, P09, P20, P26, P27 and P31? | A core states what a Profession is not that Profession without. That is a product judgement, not a derivable fact.                    |
| 3   | Are the two Professions still carrying three direct Skill grants acceptable — P16 Local Informant and P52 Trapmaker?                  | Both were argued on coherence rather than trimmed to a number, and folding either into a group would push a non-combat group to five. |
| 4   | Now that `special-access` is not a category, where should direct-Profession access provenance be shown instead?                       | The label still has to appear somewhere. That is a Chargen presentation decision.                                                     |
| 5   | Which individual routes should Society Level 1–2 withhold?                                                                            | The model is settled and explained for players; the per-route data is contextual availability, unfinished under #113.                 |

## Flagged for separate follow-up, not fixed here

- **Olog** appears modelled from a historical stage later and more advanced than the intended Glantri
  Olog society. Recorded in the language data, deliberately uncorrected.
- **Scribe and Copyist's Written Tradition core** is blocked on **#113** rather than invented.

## Verification performed

- Deterministic catalogue checks, extended for the second ruling set: **C02's exact settled shape**;
  the **combat exception allowlist**, enforced both ways; **track discipline** (a track must declare
  its own core); **core minimality** (at most two requirements); **Specializations charged nowhere** —
  not in a group's Skill cost, not in a path's charged set, not as base breadth — with the parent Skill
  required to be reachable on the path but not in the same group; **category guessability** so far as
  it is mechanisable (no retired category, no category below four competencies); **Combat Experience
  containment** to M06 and K23; and **language completeness** (a rollable spoken competency everywhere,
  a rollable written one unless the absence is authored, and no entry deferring to a further ruling).
  These join the existing group-shape bands, core-route satisfaction and the no-duplicate-payment and
  order-independence cost invariants. Failing any of them fails the build, not just a test.
- 74 proposal checks inside 315 content-package tests, typecheck, ESLint, `git diff --check`, and the
  changed-file formatting gate.
- Quantitative effective-breadth and group-size analysis across all families and valid paths, with the
  approved catalogue measured by the same code path.
