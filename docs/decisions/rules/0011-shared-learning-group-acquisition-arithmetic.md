# Rule decision 0011: One shared Learning Group acquisition arithmetic for the Pilot and Chargen paths

- Status: approved and implemented. Nothing in this record is open.
- Date: 2026-09-27
- Product owner: Vidar Hald
- Authority, stated precisely because a decision record is the project's evidence of who
  decided what:
  - The **convergence** onto one shared calculation, and the three canonical rules below,
    were ruled by the **control-plane ruling of 2026-09-27** recorded in Forgejo #381
    section 2.
  - The **pricing coefficient** `ceil(2/3 * weightedUseful)`, replacing Chargen's recorded
    `max(1, floor(0.6 * x))`, was **not** covered by that ruling. It was approved separately
    by the **Product Owner on 2026-09-27**, recorded on Forgejo PR #385 ("Ruling 1 — the
    coefficient is APPROVED"). The earlier version of this record asserted approved status
    for the coefficient before that ruling existed; it is cited here rather than implied, and
    this record must not be read as having back-dated it.
  - The **Specialization-access-only Group price**, previously recorded open below, was
    approved by the **Product Owner on 2026-09-27** on PR #385 ("Ruling 2").
  - The **non-monotonic build cost** consequence below was ruled correct and intended by the
    **Product Owner on 2026-09-27** on PR #385, together with the presentation requirement it
    carries.
- Related issues/PRs: Forgejo #381 (the defect and the convergence ruling),
  #375 (the conformance investigation that found it), #372 section 7 (the
  presentation half), #382 (the sibling Specialization Group-XP defect, separate
  and later)
- Complements:
  [Pilot Skill Rules v1](../../rules/pilot-skill-rules-v1.md),
  [Competency rules](../../rules/competency-rules.md),
  [Chargen calculations](../../rules/chargen-calculations.md),
  [Character Sheet calculations](../../rules/character-sheet-calculations.md),
  [Character progression calculations](../../rules/character-progression-calculations.md)
- Supersedes: the Chargen-local group-price scalar
  `max(1, floor(0.6 * total individual cost of active group skills))` wherever it
  was recorded. It changes no relationship semantics, no group model, and no
  content.
- Superseded by: none

## Question

Two live acquisition paths priced Learning Groups differently. The Pilot/runtime
path (`pilotSkillRulesV1.ts`, consumed by `retainedCharacterService`) implements
the approved Pilot v1 arithmetic. The Chargen path
(`primaryAllocation`, `characterSheet`) computed a level-independent per-group
scalar from that one group's own active membership, multiplied by purchased
ranks. It read neither the other purchased groups nor any relationship floor.

The consequence was a reproduced, player-facing defect: with one Learning Group's
active membership a strict subset of a stronger Group's, the player was charged a
primary point and gained no competence at all, symmetrically in either purchase
order.

## Ruling

**The arithmetic converges. It is not duplicated.** One shared deterministic
rules calculation owns the Learning Group acquisition arithmetic, and both paths
consume it. The approved Pilot v1 rules are canonical:

1. only the strongest applicable Learning Group contributes to a competency;
2. competency relationships establish non-additive minimum floors;
3. **a Group contribution that yields no useful competence produces no
   corresponding price.**

```text
G_s            = highest applicable group contribution to competency s
usefulGroup_s  = max(0, G_s - relationshipFloor_s)
weightedUseful = sum(weight_s * usefulGroup_s)
bundle cost    = ceil(2/3 * weightedUseful)
```

The ceiling is applied once to a complete bundle. The price therefore does not
decompose into a per-group, level-independent scalar, and the price of a single
purchase is the change in the bundle price.

This is a bounded rules-engine convergence. UI and state orchestration remain
distinct between the two paths; the two services, their state handling and their
APIs are not merged.

Each path keeps supplying its own inputs. Pilot v1 supplies authored economic
weights `1`/`2`/`3` and its authored relationship strengths; Chargen supplies its
own ordinary/flexible point costs as weights, its own membership resolution, and
relationship floors derived from group-only competence through the existing
Chargen relationship engine.

**`specializationBridge` and the Chargen floor derivation, stated accurately.** An earlier
version of this record said the bridge "is not used for acquisition or pricing". That was
**vacuous rather than true**, and it is corrected here. The Chargen floor derivation calls
`deriveBestSkillRelationships({ skills: content.skills })`
(`primaryAllocation/costs.ts`), and `deriveSkillRelationships.ts` derives
`specialization-bridge-parent` and `specialization-bridge-child` grants from
`skill.specializationBridge` whenever one is authored, regardless of whether specializations
are supplied. The bridge therefore **contributes nothing today only because canonical content
authors zero `specializationBridge` entries** — independently verified by QA and by the
Orchestrator on 2026-09-27. The moment content authors one, this pricing path would begin
consuming it.

This is recorded, not resolved here, and it is **not** authority to use the bridge. Forgejo
#381 section 5 keeps `specializationBridge` out of scope and rules that it "must not be used
for new V2 acquisition, pricing or effective-value computation", and
[rule decision 0010](0010-competency-classification-and-group-taught-specializations.md)
records its parameters as an open, implementation-blocking question. **No coefficient may be
invented for any competency pair.** Excluding bridge-sourced grants from the Chargen floor
derivation is the natural closure and belongs to whichever issue settles the bridge; until
then the true position is the one stated above, and canonical content must continue to author
no bridge.

## Consequences

- Chargen group prices change. `floor(0.6 * x)` with a minimum of `1` becomes
  `ceil(2/3 * x)` applied once to the bundle, so a group that cost `3` may now
  cost `4`, and a two-group bundle that cost `5` may now cost `7`. This is
  roughly an 11% rise plus rounding against the 60-point ordinary pool, and it
  is an approved consequence of the coefficient ruling of 2026-09-27 cited
  above, not a side effect of the convergence ruling.
- Because a bundle is priced once, the marginal price of one further rank in the
  same Group varies with the current level — a weight-`2` single-member Group
  alternates between `1` and `2`. This is inherent to pricing a bundle once
  rather than per rank.
- A membership fully suppressed by a stronger Group, or fully covered by a
  relationship floor, now quotes and costs `0`. The membership stays visible and
  explainable; it is not deleted.
- **The build's total Learning Group cost is not monotonic in the training
  purchased, and this is ruled correct and intended.** Where a newly added Group
  raises a relationship floor that supplies competence an earlier Group was
  priced for, the recomputed bundle costs **less** than before. The canonical
  example is `profession:weapon-instructor` at society level 1: `F35` three
  times then `G08` three times records ordinary spend
  `[6, 11, 16, 16, 15, 15]`, falling from `16` to `15` while the player is
  adding training. `F35` teaches `one_handed_concussion_axe`; `G08` teaches
  `one_handed_edged`; melee cross-training at distance 1 floors the axe. The
  case is reachable from canonical content — 25 ordered instances across
  `weapon-instructor`, `guard-escort` and `sailor` — and the finalize-time
  validator recomputes the same bundle, so it raises no spending mismatch.

  **Product Owner ruling, 2026-09-27 (PR #385).** Canonical draft recomputation
  may produce a lower final build cost when new training makes earlier paid
  contribution redundant. The arithmetic stands: order-independent canonical
  calculation is preserved, and there are **no refund transactions and no
  history-dependent clamping**. What was **not** approved is presenting the
  reduction as an ordinary purchase refund. Chargen therefore exposes the
  operation as **editing the Character's training allocation**, and when a change
  reduces the total cost it shows the **before and after build cost** with a
  concise explanation that overlapping training has reduced the net cost. A
  visible result of "added training, points spent went down" without an
  explanation is not acceptable. The recorded spend sequence above is a
  **regression check** on this record, not a defect reproduction.

  **Correction, 2026-09-27 (post-PR #385) — the mechanism attribution above is
  retired, not the ruling.** This record is corrected in place rather than
  silently rewritten, following the convention already used above for
  `specializationBridge` and for the Specialization-access-only Group price: the
  superseded sentence is left standing just above, and this paragraph states
  what governs instead, under the **same** 2026-09-27 Product Owner ruling — this
  is the record catching up to the ruling it already cites, not a new decision.

  The phrase "overlapping training has reduced the net cost" named the wrong
  mechanism. "Overlapping training does not stack"
  ([`docs/rules/competency-rules.md`](../../rules/competency-rules.md)) governs
  **one Skill taught by several Learning Groups**, and it produces a **zero-cost
  single purchase** — the case ruled under Ruling item 3 above (`ceil` of a
  bundle that gains no useful competence prices at `0`). That is a _different_
  mechanism from the Specialization-access-only Group priced at `0` below: there
  the Group has no base membership at all, whereas here a real membership is
  fully supplied by a stronger Group already held. It never produces a cost
  _reduction_: there is no bundle it reprices downward while other training
  stays fixed. Every reachable cost reduction under this record instead comes
  from a **different rule** — relationship floors between **different** Skills,
  exactly the `weapon-instructor`/`F35`/`G08` mechanism in the example above.

  **Do not broaden "overlapping training does not stack" to cover relationship
  effects; they are different rules.** The non-stacking rule keeps its own
  separate zero-cost wording and must not be unified with the relationship-floor
  explanation below merely for narrative economy — doing so is exactly how the
  defect that this correction fixes was reintroduced once already, and a future
  reader must not repeat it.

  The presentation requirement stands, corrected: Chargen keeps the **before and
  after build cost visible**, and a bare "added training, points spent went
  down" without explanation remains unacceptable. The explanation reads, for a
  reduction, in terms of the training also improving related skills, so points
  previously needed elsewhere are no longer needed; and, for the mirror increase
  on removal, in terms of removing benefits to related skills, so more points
  are needed elsewhere. No rules-engine terminology is exposed to the player.
  The shipped strings
  (`apps/web/src/features/chargen/components/TrainingCostChangeNotice.tsx:42-43`)
  are the canonical player-facing wording and are checkably in agreement with
  this record:
  - reduction: "This training also improves related skills, so some points
    previously needed elsewhere are no longer needed."
  - increase (mirror, on removal): "Removing this training also removes its
    benefit to related skills, so more points are needed elsewhere."

- Draft acquisition state is not migrated. Development data is draft and
  non-durable. Any further allocation or removal recomputes the recorded pool
  spend under the corrected rules; a draft that is never touched again and is
  submitted for finalization is rejected by the existing server validation with
  "Recorded Chargen spending does not match authoritative purchase prices."
  No incorrect historic price is preserved.

## Specialization-access-only Learning Groups — ruled, no longer open

A Learning Group that teaches **no base membership** and exists only to open
authored Specialization access grants no group competence, so the canonical
competence arithmetic cannot price it. Its former price came entirely from the
retired Chargen minimum of `1`. An earlier version of this record retained that
incidental flat `1` and recorded the price as an open product question rather
than inventing one.

**Product Owner ruling, 2026-09-27 (PR #385, "Ruling 2"). The question is now
answered and this record no longer holds anything open.** Such a Group's
purchase cost is **`0`**, and there is **no XP-buy action for the Group itself**.
Eligibility through the Group exposes the Specialization; the Specialization is
purchased and progressed separately under its own initial-`4` / increase-`2`
costs. The incidental flat `1` is **not** preserved.

This is not merely a constant set to zero. A zero-cost purchase that still
records a purchase is not what was ruled, so such a Group stops being a
purchasable thing: Chargen quotes no price for it, rejects a Group purchase of
it, and shows no Group training controls for it. No access is lost, because
Specialization eligibility is derived from the Profession-accessible Group
definitions and never from purchased Group ranks
(`resolveCompetencyV2Path.ts`, `resolveEffectiveProfessionPackage.ts`,
`validateTargetChargenBuild.ts`).

No approved canonical Learning Group reaches this case in either catalogue —
every group has at least one fixed membership in the 95-group
`withCompetencyContentV2(...)` projection that Chargen actually loads and in the
legacy 59-group approved catalogue retained for `/skills` (see
[`docs/testing-regression-matrix.md`](../../testing-regression-matrix.md)) — so
the shape is reachable only in legacy draft content. A legacy draft holding purchased ranks on such a Group reprices to `0`
under the draft-state consequence above.
