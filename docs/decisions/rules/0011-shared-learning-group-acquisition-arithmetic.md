# Rule decision 0011: One shared Learning Group acquisition arithmetic for the Pilot and Chargen paths

- Status: approved and implemented. One consequence is recorded open below for
  product-owner confirmation; it does not block the repair.
- Date: 2026-09-27
- Product owner: Vidar Hald
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
Chargen relationship engine. `specializationBridge` is not used for acquisition
or pricing.

## Consequences

- Chargen group prices change. `floor(0.6 * x)` with a minimum of `1` becomes
  `ceil(2/3 * x)` applied once to the bundle, so a group that cost `3` may now
  cost `4`, and a two-group bundle that cost `5` may now cost `7`.
- Because a bundle is priced once, the marginal price of one further rank in the
  same Group varies with the current level — a weight-`2` single-member Group
  alternates between `1` and `2`. This is inherent to pricing a bundle once
  rather than per rank.
- A membership fully suppressed by a stronger Group, or fully covered by a
  relationship floor, now quotes and costs `0`. The membership stays visible and
  explainable; it is not deleted.
- Draft acquisition state is not migrated. Development data is draft and
  non-durable. Any further allocation or removal recomputes the recorded pool
  spend under the corrected rules; a draft that is never touched again and is
  submitted for finalization is rejected by the existing server validation with
  "Recorded Chargen spending does not match authoritative purchase prices."
  No incorrect historic price is preserved.

## Open — recorded for product-owner confirmation

A Learning Group that teaches **no base membership** and exists only to open
authored Specialization access grants no group competence, so the canonical
competence arithmetic cannot price it. Its former price came entirely from the
Chargen minimum of `1`. That flat `1` per purchase is **retained** so no price is
invented and no recorded behaviour is silently dropped. Whether Specialization
access should carry a price of its own, and what it should be, is a product
question this record does not settle.
