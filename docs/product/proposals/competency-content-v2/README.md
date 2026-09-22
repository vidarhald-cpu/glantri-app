# Competency Content V2 — Product Owner proposal

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — reconciled against all 2026-09-21 rulings, awaiting review.**
> **Content V2 product design is closed by ruling; the catalogue itself is still not canonical.**
> Nothing in this folder is approved Glantri content. It does not replace the approved
> [competency reference](../../../rules/competency-reference/README.md), is not registered with
> Chargen, and is not projected into canonical content.

Issue: [#266](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/266), under umbrella #249,
successor to the integrated [#250](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/250).
Controlling product authority: [Chargen and Competency Experience Product
Contract](../../chargen-competency-experience-contract.md), whose section 5 records the authoring
target and section 6 authorizes this catalogue redesign.

This revision is a **reconciliation of the existing proposal against the Product Owner rulings**, not
a new catalogue investigation and not a redesign from scratch. It carries the **second ruling set of
2026-09-21**, which confirmed most of the first reconciliation and changed six things: C02 is settled,
combat is an explicit exception to the group-size rule, the category roster may be simplified, tracks
must earn their complexity, cores must be minimal, and the language blocker is removed. It then carries
the two later **settled rulings of the same day** — **Profession tracks** and **Profession cores** —
which close the track question outright and settle every core the previous revision had left open. It
now also carries the final ruling of that day, **Learning Group membership (settled)**, which retires
one group, reduces four, and **closes Content V2 product design**. Closing the design does **not** make
the catalogue canonical: it means the remaining genuine Product Owner questions are answered, and what
is left is bounded completion under settled rules.

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
- **A core is a necessary defining training route, not a unique classification key.** Professions may
  share a core where the training is genuinely defining for each, and a core may name an existing
  Learning Group route _or_ an existing direct competency route.
- **A category must be guessable** from the Skill name and the category labels alone, and the roster
  is no longer held to awkward placements for compatibility.

## What the proposal changes

|                                                      | Approved | #250 revision | First reconciliation | Tracks and cores | This revision (membership)                    |
| ---------------------------------------------------- | -------: | ------------: | -------------------: | ---------------: | --------------------------------------------- |
| Base Skills / Specializations                        | 131 / 26 |      131 / 26 |             131 / 26 |         131 / 26 | 131 / 26 (unchanged)                          |
| Learning Groups                                      |       59 |            92 |                   96 |               96 | 95 — 44 retained, 2 revised, 49 new           |
| Groups in the 3–4 preferred centre                   |       15 |            53 |                   57 |               57 | 52                                            |
| Groups at two                                        |       36 |            35 |                   36 |               36 | 40                                            |
| Groups at one                                        |        4 |             0 |                    0 |                0 | 0                                             |
| Groups at five or more                               |        4 |             4 |                    3 |                3 | 3 (all combat, under the exception)           |
| Largest fixed purchase burden of one group           |        7 |             6 |                    4 |                4 | 4                                             |
| Profession families                                  |       84 |            84 |                   84 |               84 | 84 (all preserved)                            |
| Professions carrying tracks                          |        — |             8 |                    8 |                2 | 2 (unchanged)                                 |
| Tracks                                               |        — |            21 |                   21 |                4 | 4 (unchanged)                                 |
| Valid Profession paths                               |       99 |            96 |                   96 |               86 | 86 (unchanged)                                |
| Direct Profession Skill grants                       |     88\* |           119 |                  101 |              104 | 106                                           |
| Player-facing browse categories                      |        — |            16 |                   16 |               14 | 14                                            |
| Civilization languages awaiting a naming ruling      |        — |             — |                    7 |                0 | 0                                             |
| Declared core routes                                 |        — |             — |                   96 |               90 | 90 across 86 paths, all satisfied (0 blocked) |
| Median effective distinct base Skills per valid path |        3 |             8 |                    8 |                8 | 8                                             |
| Quartiles                                            |    1 / 7 |        7 / 10 |               7 / 10 |           7 / 10 | 7 / 9                                         |
| Narrowest path                                       |        0 |             6 |                    6 |                7 | 5                                             |
| Broadest path                                        |       17 |            15 |                   15 |               16 | 16                                            |
| Paths flagged for coherence review (below 7)         |        — |             — |                    — |                0 | 6                                             |

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
Learning Group it bought. The Soldier is one identity whose core is being drilled to arms — stated
under the cores ruling as the alternative core routes M01, M03 and M04 — with the longbow tradition
and campaign service both openly available besides, which is exactly the
access-to-several-coherent-groups shape the breadth ruling asks for.
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

Every core requires one thing, except P20 Smuggler, which needs two. The build refuses any core
requiring more than two. A small set of **alternative** core routes is permitted, and two Professions
now use them.

### 4a. Cores settled by Product Owner ruling

The **"PRODUCT OWNER RULING — Profession cores (settled)"** comment recorded on
[issue #266](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/266) on 2026-09-21 rejects the
premise that a core must discriminate one Profession from every other:

> A Profession core is a **necessary defining training route, not a unique classification key.**
> Multiple Professions may legitimately share the same core Learning Group where that training is
> genuinely defining for each.

A shared core is therefore **correct content, not a defect**. G10 is the core of the Envoy, the
Mediator and the Political Agent; G11 of the Clerk and the Scribe; F24 of the Smith and the Smelter;
M07 of the Quartermaster and the Campaign Planner; F04 of the Athlete and the foot Courier. **No
Learning Group was invented to manufacture a unique core**, and none needed to be.

The ruling also settles that a core may name **an existing direct competency route**. Four cores moved:

- **P53 Cook** — the direct **Cooking** route is core; C10 is not the defining Cook core, and remains
  an optional route that still carries Food Preservation access. C10 stays the **Brewer's** core.
- **P02 Wild Plant Gatherer** — the direct **Plant Lore** route is core; G02 remains optional.
- **P39 Carpenter** — the direct **Carpentry** route is core; F27 remains optional and stays the
  **Millwright's** core.
- **P65 Scribe and Copyist** — the ruled shape is G11 **plus at least one written-language competency
  route**, and it is now authored in full. See
  [the Scribe core](#the-scribe-core-and-the-written-language-choice) below.

Two Professions gain **alternative core routes** rather than tracks, as the ruling requires explicitly:

- **P12 Courier and Messenger** — one of **F04, G05 or F06** (foot, mounted or vehicle courier
  practice). F06 was added as an ordinary route so the vehicle alternative is genuinely reachable
  rather than merely declared.
- **P22 Soldier** — one of **M01, M03 or M04**. **M06 Campaign service experience is not core.** It
  remains an ordinary route, because Combat Experience is experiential competence earned by real
  service; the Combat Experience route audit is unchanged, with M06 and K23 still its only two routes.

Because overlapping routes are charged once, moving a core between a group and a direct route it
already reached changes no breadth figure. The three new direct grants are recorded in the
[direct-grant review](./direct-grant-review.md) as ruling-driven defining routes, not breadth top-ups.

**This closes the previous revision's open question 2.** The cores for P02, P09, P20, P26, P27 and
P31 are no longer open: the ruling names them, and the proposal now matches.

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
demonstrated. Overlapping routes name the same competency 105 times across the catalogue and every
one is charged once, with the charged set identical when the routes are accumulated in reverse order.

## What the Learning Group membership ruling changed

The **"PRODUCT OWNER RULING — Learning Group membership (settled). CONTENT V2 PRODUCT DESIGN CLOSED."**
comment recorded on [issue #266](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/266) on
2026-09-21 names five groups and closes the product design. **No Learning Group was created to absorb
any of it**, and the retained/retired track set and every settled core are unchanged.

| Group                                  | Outcome                       | Removed                                | Where the removed competence is learned instead                                 |
| -------------------------------------- | ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| **C03** Construction site practice     | **Retired**                   | Surveying, and a choose-two craft slot | Per Profession — see the table below                                            |
| **K01** Scholarly study practice       | Research + Mnemonics          | Mathematics                            | **K21** Applied calculation practice, or **K03** Celestial observation practice |
| **M10** Arms instruction practice      | Teaching + Weapon Maintenance | Athletics                              | **F04** Running and athletic field practice                                     |
| **C06** Stone workshop and quarry      | Masonry + Sculpture           | Mining                                 | **C07**, which stays available to the Mason                                     |
| **C07** Mine and quarry apprenticeship | Mining + Climbing             | Survival                               | **G04** Field travel and camp practice                                          |

### C03 retired, and where each of its six users went

C03's only fixed base Skill was Surveying, and its choice slot charged a second and third craft
apprenticeship for what is really site coordination. The ruling retires it **without preserving a
one-Skill group** in its place, and forbids charging two craft apprenticeships merely to coordinate
trades. C03 was the core of none of its six users.

| Profession                | What now carries the route                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P28** Siege Engineer    | Nothing added. Surveying already comes from **F28**, the timber and mechanism trades from **F27**.                                                              |
| **P39** Carpenter         | **Surveying becomes a direct Profession route** — the site carpenter is genuinely taught to set the work out. Crafts stay with **C01**.                         |
| **P40** Shipbuilder       | Nothing added. Laying off a hull in the mould loft is not the ground measurement Surveying describes; trades stay with **F03**/**F27**.                         |
| **P46** Mason             | Surveying retained through **F28**; **C07** added as an ordinary route, which the ruling permits the Mason explicitly.                                          |
| **P48** Millwright        | **Surveying becomes a direct Profession route** — levelling and setting out a mill and its race. **C01** added for the forge work: one apprenticeship, not two. |
| **P49** Building Designer | Nothing added. **F28** is its core and already teaches Architecture and Surveying; **F01** remains available. Directing trades is not an apprenticeship.        |

### The consequences, reported rather than absorbed

- **Every Profession core and every valid path is still satisfiable.** Four of the five named groups
  are somebody's core — M10 the Weapon Instructor's, C06 the Mason's, C07 the Miner's, and K01 nobody's
  — and each survives the reduction. No core was moved, and no track disposition changed.
- **No base Skill lost its last route.** Poisons remains the one deliberately routeless Skill, exactly
  as before.
- **Group shape moves toward two**: 52 in the 3–4 centre and 40 at two, against 57 and 36. That is the
  intended outcome, not drift — two is explicitly valid where the competencies are genuinely learned
  together, and coherence takes precedence over size.
- **Six paths fall below the coherence-review floor of seven** and are left there: P39 Carpenter (6),
  P40 Shipbuilder (5), P49 Building Designer (5), P64 Teacher (6), P65 Scribe (6) and P67 Historian (6).
  Three lost Mathematics with K01; three lost C03. A flag is a prompt to look, never a defect and never
  a licence to pad, and the ruling is explicit that coherent training is authored first and breadth read
  afterwards. The flagged set is asserted exactly by test so it cannot drift silently.
- **Two direct grants added, none restored.** Surveying to P39 and P48 only. Athletics is **not**
  returned to the Weapon Instructor, because the ruling removed it from M10 as well.

## What the first reconciliation did, and this revision keeps

Breadth as a signal rather than a quota; F32 retired for M11 and M12; focused M01/M04 beside broad
M02/M03/M05 with cross-category pools; Combat Experience out of every instruction group; direct
grants reduced from 283 to 106; F16 and F22 retired with the Genealogy and Food Preservation routes
preserved through P67/P76 and C10; invented language names withdrawn and kept out by a name-provenance check against the canonical
language roster; core routes
introduced as a data annotation; and the machine-readable companion regenerated from the source so
the prose and the numbers cannot drift.

## What the proposal deliberately does not do

- **No change to the 131 base Skills or the 26 Specializations** — identities, mechanics, boundaries
  and reader prose are untouched. Prior authoring is reused, not rewritten.
- **No new conceptual layer or entity type.** Every ruling above is expressed with primitives the
  proposal already had.
- **It does not turn written languages into base Skills.** The Scribe core needed one written
  language, and the temptation was to file the written competencies among the base Skills so the
  existing core-route shape would swallow them. That would have been a content distortion to fit a
  data shape. A one-field extension to the core route was the smaller change.
- **It does not author language or script history.** Only the minimum canonical data — identity,
  spoken or written type, Civilization association, route and rolling — is authored. Registers,
  script histories and conventions deliberately wait.
- **Poisons and Warded-Lock Entry keep their approved absence of a generic occupational route.**
- **Olog is not corrected**, only flagged for a separate follow-up.
- **No runtime, UI or Chargen change**, no importer outside this directory, and no entry in
  `packages/content/src/index.ts`. The proposal is not canonical.

## Remaining Product Owner decisions

**None. Content V2 product design is closed by the 2026-09-21 Learning Group membership ruling**,
which states that the remaining genuine Product Owner questions are answered and that **no further
catalogue-wide design review is to be begun**. All four questions the previous revision still carried
are disposed of by that ruling:

| Previous question                                                       | Disposition                                                                                                                                                       |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Are the new Learning Groups correct as descriptions of taught practice? | **Settled.** The ruling names the five groups whose membership was genuinely doubtful and fixes each. The rest stand; no catalogue-wide review is to be reopened. |
| Are the Professions carrying three direct Skill grants acceptable?      | **Explicitly not reopened.** P16 and P52 are no issue merely because there are three; a control-plane check for an actual curriculum cluster found none.          |
| Where should direct-Profession access provenance be shown?              | **Deferred to #252**, which owns access-provenance presentation UX.                                                                                               |
| Which routes should Society Level 1–2 withhold?                         | **Bounded content authoring under settled rules**, before #251.                                                                                                   |

What remains is **bounded completion, not design**: written-language and Civilization completion with
the P65 representation gap (**#113**), SL1–2 and Social Band route authoring (before **#251**), and
access-provenance presentation (**#252**).

**Closing the design does not make Content V2 canonical.** The catalogue is still a non-canonical
proposal awaiting review, and nothing in this folder is approved Glantri content.

## Flagged for separate follow-up, not fixed here

- **Olog** appears modelled from a historical stage later and more advanced than the intended Glantri
  Olog society. Recorded in the language data, deliberately uncorrected.
- **Tuu's precise language identity.** The approved gap report asks for a sufficiently precise named
  language before a player-acquirable Tuu record is counted, because Tuu is a language family rather
  than one language. The San Forager Bands now have the rollable spoken competency the ruling
  requires, under the established Glantri name; **no narrower name was invented to close the gap
  report's question**, so that question stays open.
- **Script support for the restored written traditions.** Runic Scandian, Royal N'kolian, Old Italic,
  Linear B, Cuneiform and Imperial Aramaic are bound to the language each writes, which is the minimum
  the ruling needs. How each compound name decomposes into language, register and support script is
  the gap report's own open question and is **not** answered here.
- **Common and Old Common have no established script name.** Each written competency is therefore named
  for its language alone. No script was invented to fill the slot, and no equivalence or descent
  between Common and Old Common is asserted in either direction.

## The Scribe core and the written-language choice

**P65 Scribe and Copyist's core is settled and no longer blocked:** G11 Records-office practice **plus
at least one written-language competency**, chosen freely rather than named.

Expressing that needed one new field, `writtenLanguageChoiceCount`, on the core route. It states how
many written-language competencies the learner must additionally hold, without saying which. Two
alternatives were rejected as distortions rather than representations:

- **Filing written languages among the base Skills** so `skillIds` could carry them. That would make a
  contextual Civilization competency into a base Skill purely to fit an existing shape.
- **One alternative core route per written tradition.** That would assert the Scribe is a different
  Profession in each Civilization, which it is not.

The extension is deliberately narrow: one optional number, no new path-body concept, and no
enumeration. The choice counts as **exactly one requirement** against the two-requirement core
maximum, because it is one choice the learner makes rather than a list the Profession dictates. G11
plus the choice is exactly two, so **the minimality rule needed no adjustment** and the core cannot
quietly grow. The build refuses a choice larger than the number of written competencies authored, so
an unsatisfiable core fails rather than ships.

## Verification performed

- Deterministic catalogue checks, extended for the second ruling set: **C02's exact settled shape**;
  **the settled Learning Group memberships** — K01, M10, C06 and C07 asserted exactly, with C03 refused
  outright and its rehousing record required to account for every former user;
  the **combat exception allowlist**, enforced both ways; **track discipline** (a track must declare
  its own core); **core minimality** (at most two requirements); **Specializations charged nowhere** —
  not in a group's Skill cost, not in a path's charged set, not as base breadth — with the parent Skill
  required to be reachable on the path but not in the same group; **category guessability** so far as
  it is mechanisable (no retired category, no category below four competencies); **Combat Experience
  containment** to M06 and K23; and **language completeness** (a rollable spoken competency everywhere,
  a rollable written one unless the absence is authored, and no entry deferring to a further ruling).
  These join the existing group-shape bands, core-route satisfaction and the no-duplicate-payment and
  order-independence cost invariants. Failing any of them fails the build, not just a test.
- 95 proposal checks inside 336 content-package tests, typecheck, ESLint, `git diff --check`, and the
  changed-file formatting gate. Twelve of those checks lock the Learning Group membership ruling in
  line by line: the four settled memberships with no choice slot, that exactly the four named members
  are removed and no others, that each removed competence is still reachable through the route the
  ruling names, that C03 is retired with no one-Skill survivor and no group created to absorb it, that
  every route into C03 is accounted for, the two rehoused direct Surveying routes against the three
  Professions that keep it through F28, the Mason's C07 and the Miner's G04, that every touched core
  and every valid path still satisfies an applicable core route, that no base Skill was orphaned, and
  the exact set of paths that fell below the coherence floor. Nine further checks lock the Profession-cores ruling in
  line by line: the affirmed shared cores, that a Learning Group may be the core of more than one
  Profession, the three direct-route cores with their displaced groups still reachable, the Courier's
  and Soldier's alternative core routes with no tracks and every alternative genuinely satisfiable,
  that M06 is the core of nothing, the Smuggler's and Surgeon's retained cores, the Scribe's recorded
  blocker, and that no Learning Group was added.
- Quantitative effective-breadth and group-size analysis across all families and valid paths, with the
  approved catalogue measured by the same code path.
