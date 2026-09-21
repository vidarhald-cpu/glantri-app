# Secondary Critical `Sec` grammar — Product Owner decision memo

**Status: RESOLVED. This memo is preserved as decision provenance, not as an open decision aid.**
All four questions below were decided by the Product Owner's ruling on Forgejo #223, "PRODUCT OWNER
RULING — Secondary Criticals, all four questions settled" (2026-09-21). That ruling amended
[Rule decision 0006](../decisions/rules/0006-secondary-critical-resolution.md) and is fully recorded
in [Secondary Critical `Sec` grammar reconciliation](./secondary-critical-sec-grammar.md), which is
the current rule-authoritative document. **Read that document, and decision 0006 as amended, for the
settled rules — not this memo.** This page keeps the original per-question evidence, alternatives,
and reasoning below unedited (except this notice and the per-question resolution lines added just
beneath each question's heading), because that reasoning — in particular why the weapon-anchored
reading would have required amending 0006 §2, and why reusing the Primary's hit location was the
better-supported tie-break — is exactly what the ruling adopted, and is useful history for anyone
asking "why was it decided this way."

Authority (historical, at the time this memo was written): [Rule decision 0006](../decisions/rules/0006-secondary-critical-resolution.md)
(approved, integrated) settled trigger, grade-reduction shape, and roll. It explicitly deferred the
exact `Sec` grammar. That deferred reconciliation was completed as evidence in Forgejo #223 PR
[#269](http://127.0.0.1:3001/recovery-admin/glantri-app/pulls/269) (branch `codex/223-sec-grammar`,
head `e1b4cceb39598e164c2abff6a1ea2fd0111e6fef`, not yet merged to `dev` at the time of this memo).
This memo did not restate that reconciliation; it presented its four open questions for a decision.
Both PR #269 and this memo's PR #273 have since been reconciled onto branch `codex/223-sec-grammar`.

Portfolio: Forgejo #111 Criticals / Injury.

## Purpose and boundary

This memo authorizes nothing. It changes no schema, evaluator, resolution path, or catalogue
position, and it does not alter the 608 primary Critical catalogue. It exists so the Product Owner
can decide the four questions PR #269 returned, with the concrete consequence of each option visible
in one place. Full source citations, the complete evidence table, and the nine recorded exceptions
live in PR #269's `docs/rules/secondary-critical-sec-grammar.md`; this memo cites and summarizes
rather than duplicates that material.

Grade alphabet used throughout: `A < B < C < D < E < F` (`A` lowest, `F` highest), the order
`'cleon vs slaver'!C131` applies through `CODE()` comparison.

## The two divergence rows

Every question below is easiest to see against the same two rows, the only ones where the two
grade-reduction readings disagree:

| Row | Weapon   | `Weapon1!M` (`Crit 1`) | `Weapon1!Q` (`Sec`) |
| --- | -------- | ---------------------- | ------------------- |
| 18  | Hatchet  | `DS`                   | `AC`                |
| 19  | Wood axe | `ES`                   | `AC`                |

---

## Q1 — Reduction anchor: weapon-anchored vs constant-`F`

> **Resolved.** Neither alternative below is what was ruled. The table columns are maxima: `Crit 1`
> caps the Primary grade and the `Sec` first character caps the Secondary grade. The reduction
> itself is a universal, weapon-independent two-grade-step applied to the resolved Primary grade,
> and the `Sec` first character then caps the result. See
> [Secondary Critical `Sec` grammar reconciliation §3](./secondary-critical-sec-grammar.md#3-grade-reduction-and-capping-resolved).

**Source evidence.** `Weapon1!Q` (`Second crit.`) is populated in twelve rows; no workbook formula
reads column `Q` (widest ranges stop at column `P`: `Calculations!AI17`, `C17`, `N17`, `O17`;
`Calculations!F70`; `'Character sheet entry'!O10`). The `Sec` value is authored as an absolute grade
letter in the same alphabet and position as the `Crit 1` letter that `Game sheet!F31` labels
`"Max Critical"` and that `'cleon vs slaver'!C130:C131` applies as a ceiling. No source cell states
what the `Sec` letter is measured _from_.

**Alternatives.**

- **Reading A — weapon-anchored.** Reduction = distance from the weapon's own `Weapon1!M` (`Crit 1`)
  grade letter to its `Weapon1!Q` (`Sec`) grade letter.
- **Reading B — constant-`F`-anchored.** Reduction = distance from `F` to the `Sec` grade letter,
  independent of the weapon's `Crit 1` grade.

Both readings reproduce decision 0006 §2's worked two-grade example (`F→D, E→C, D→B, C→A`), because
ten of the twelve `Sec`-bearing rows have `Crit 1 = F`. Neither reading is contradicted by any
executed source formula, because none exists.

**Behavioural difference — Hatchet (`Q18`) and Wood axe (`Q19`).**

| Weapon   | `Crit 1` | `Sec` | Reading A reduction | Reading B reduction |
| -------- | -------- | ----- | ------------------- | ------------------- |
| Hatchet  | `DS`     | `AC`  | 3                   | 5                   |
| Wood axe | `ES`     | `AC`  | 4                   | 5                   |

Under Reading A, the identical code `AC` reduces by 3 grades on the Hatchet and 4 on the Wood axe —
the reduction is a property of the `(Crit 1, Sec)` pair, not of the code alone. Under Reading B both
weapons reduce by 5 regardless of their own `Crit 1` grade, and — because their `Crit 1` ceiling
(`D` and `E` respectively) is below `F`, the anchor Reading B measures from — **neither weapon can
ever produce the resolved Primary grade of `F` that a 5-grade reduction into `A` would require**.
Their `Sec` entries become permanently dead under Reading B: authored but unreachable at the table.
Every other `Sec`-bearing weapon (the other ten rows) behaves identically under both readings.

**Interaction with decision 0006.** 0006 §2 reads: _"a fixed number of Critical grades below the
resolved Primary Critical grade"_ — the grade the attack actually resolves to _after_ the 2d8 roll
and modifiers, not the weapon's table-authored ceiling. Reading B (constant-`F`) is consistent with
0006 §2 as written without change: the reduction is simply a fixed per-code number applied to
whatever the resolved Primary grade turns out to be. **Reading A (weapon-anchored) is not** —
measuring from the weapon's `Crit 1` table grade is a different quantity from the resolved Primary
grade 0006 §2 names, since the resolved grade depends on the roll and can differ attack to attack
even with a fixed weapon. Choosing Reading A would require amending 0006 §2 to define what "the
resolved Primary Critical grade" is offset from for this purpose, or to introduce a second,
weapon-fixed reference point alongside it.

**Recommendation.** None. The evidence does not favour either reading over the other on its own
terms: Reading A preserves the authored `(Crit 1, Sec)` pairing exactly at the weapon's maximum and
keeps both divergence rows reachable at the table, at the cost of requiring a 0006 amendment.
Reading B needs no amendment and treats every `Sec` code as self-contained, at the cost of making two
already-authored rows permanently dead. Both are internally coherent; the choice is a rules-design
preference this memo does not have standing to make.

---

## Q2 — Recognized grammar: full 12-code matrix vs six attested codes

> **Resolved.** Reading B (attested-only). The six attested codes `AP, AC, AS, BS, CC, DC` are
> recognized; unknown codes fail closed; future content may explicitly add codes.

**Source evidence.** `Weapon1!Q` contains exactly six distinct values across its twelve populated
cells: `AP` (`Q15`), `AC` (`Q18`, `Q19`), `AS` (`Q28`, `Q29`), `BS` (`Q30`), `CC` (`Q20`), `DC`
(`Q22`, `Q24`, `Q32`, `Q33`, `Q35`). Grade letters observed are only `A`–`D`; family letters observed
are only `S`/`P`/`C`. `E`/`F` grade letters and any family letter outside `S|P|C` never appear.
Nothing in the source states whether the unused combinations (e.g. `BP`, `DP`, `CS`) are valid but
simply not yet authored on a weapon, or invalid.

**Alternatives.**

- **Reading A — full matrix.** All twelve `{A,B,C,D} × {S,P,C}` combinations are recognized grammar;
  six are attested on current weapons, six are not yet used but are structurally valid.
- **Reading B — attested-only.** Only the six codes actually seen (`AP`, `AC`, `AS`, `BS`, `CC`,
  `DC`) are recognized; any other well-formed two-character code is treated as unrecognized grammar
  until content authoring adds a weapon that uses it.

Both readings reject `E`/`F` grade letters and non-`S|P|C` family letters identically — that part is
not in dispute.

**Behavioural difference.** No currently authored weapon exercises this distinction — `Q18` and `Q19`
both use the attested code `AC`, so this question does not affect the Hatchet/Wood axe divergence.
The difference only appears the first time a _new_ weapon (via content authoring, not this memo) is
given an unattested combination such as `BP` or `CS`: under Reading A a parser accepts it as a valid
`Sec` code; under Reading B a parser must reject it as unrecognized grammar (per decision 0006's
"fail closed" requirement, recorded again in PR #269's parsing guidance) until this question is
revisited or the code is explicitly added to the recognized set.

**Interaction with decision 0006.** Neither reading requires any change to 0006. 0006 does not
mention grammar scope at all; it only requires (in its Deferred section) that parsing "fail closed on
grammar it does not recognize" — a requirement both readings satisfy, they just disagree on where
the recognized boundary sits.

**Recommendation.** None. This is a content-authoring-scope question with no behavioural evidence
either way from the current weapon table, since no weapon yet exercises the disputed codes.

---

## Q3 — Scope: is melee-only deliberate?

> **Resolved.** Secondary Critical content applies only where an authored recognized `Sec` value
> exists, so the present source is melee-only. This is stated explicitly as **not a permanent
> prohibition** on future missile or other non-melee Secondary Critical authoring — a middle
> position between Reading A and Reading B below.

**Source evidence.** `Weapon1` (melee) has a `Second crit.` column (`Q`). `Weapon2` (missile/ammo)
does not: its header row is `Weapon2!A1:K1` = `Weapon, Skill, OB 1, DMB 1, Parry%, Initiativ, Range,
Arm.mod. 1, Crit 1, Enc., Ammo Enc.` — eleven columns, no `Second crit.` field at all. Of the eight
frozen catalogue families in
[Target Critical catalogue V1](./target-critical-catalogue-v1.md), only
three (`sharp`, `pointed_weapons`, `blunt`, i.e. the `S`/`P`/`C` routing targets) are reachable
through any authored `Sec` code. `arrows_bolts`, `teeth_claws`, `firearms`, `falling_crushing`, and
`fire_energy` have no `Sec` letter and no column on `Weapon2` to carry one.

**Alternatives.**

- **Reading A — deliberate boundary.** Secondary Criticals are a melee-specific mechanic (a
  glancing/follow-through blow from the same weapon); missile and ammunition attacks were never
  meant to have one.
- **Reading B — authoring gap.** `Weapon2` simply was never extended with a `Second crit.` column
  because no one authored it yet; the five unreachable families are an omission, not a boundary.

The source cannot distinguish these: there is no comment, header note, or design-notes statement
either affirming melee-only intent or flagging the missing column as incomplete.

**Behavioural difference.** This does not affect the Hatchet/Wood axe pair (both are melee weapons on
`Weapon1`). Concretely: under Reading A, an arrow, a claw attack, a firearm, a falling/crushing
result, and a fire/energy source can never produce a Secondary Critical, permanently, by design — no
future data addition changes that without a fresh ruling. Under Reading B, the missing `Weapon2`
column is a gap to close later (e.g. by adding a `Second crit.` column to the missile table through
normal content authoring), and the five families remain reachable in principle once that authoring
happens.

**Interaction with decision 0006.** No conflict either way. 0006 §1 makes Secondary Critical
capability "controlled solely by the weapon-authored `Sec` field" — both readings already conform to
that: today, no missile/ammo weapon has a `Sec` field, so today's behavior is identical under either
reading. The two readings only diverge on whether that absence is a **permanent** design boundary
(Reading A) or an **open** content gap (Reading B) — a distinction about future authoring, not about
resolution logic.

**Recommendation.** None. The evidence is symmetric: a missing column is consistent with both "never
intended" and "not yet done," and nothing in the workbook, design notes, or recovered PDF speaks to
missile/ammo Secondary Criticals at all.

---

## Q4 — Hit location: does the Secondary reuse the Primary's location?

> **Resolved as Reading A (reuse), matching this memo's weak recommendation below.** The Secondary
> Critical reuses the Primary Critical's hit location. Only the Critical result uses a fresh
> independent 2d8. See decision 0006 §4 (added by its 2026-09-21 amendment).

**Source evidence.** Decision 0006 §5 rules a fresh independent 2d8 for the Secondary Critical's
_result_ roll, but is silent on hit **location**. Location is one of the three axes of the catalogue
lookup key (family, location, index) per
[Target Critical catalogue V1](./target-critical-catalogue-v1.md). The original Forgejo
#223 recovery (see the Orchestrator's comment on the issue and the read-only investigator's report)
found no source formula or document that rolls a second, independent hit location for a Secondary
Critical; both options that recovery pass offered assumed the Primary's location was reused, but that
assumption was never put to the Product Owner as an explicit ruling — 0006 covers only the result
roll.

**Alternatives.**

- **Reading A — reuse the Primary's hit location.** The Secondary Critical resolves at the same body
  location the Primary Critical hit; only the family, index, and result differ.
  A single physical blow produces both effects at one place, consistent with `Sec`'s attachment "to
  the main attack mode" already recorded in
  [Combat loadout calculations](./combat-loadout-calculations.md).
- **Reading B — roll a fresh, independent hit location.** The Secondary Critical rolls its own
  location, alongside its own fresh 2d8 result roll (per 0006 §5), potentially landing somewhere
  different from the Primary.

No source formula does either — this is the one question of the four with essentially no source
evidence pointing either direction, only the structural fact that 0006 ruled the result roll fresh
without mentioning location.

**Behavioural difference.** Independent of the anchor question (Q1): whichever reduction anchor is
chosen, a Hatchet's Primary Critical and its `Sec`-derived Secondary Critical (family `blunt`, i.e.
strike, since `Weapon1!Q18` second character is `C`) will, under Reading A, both land at the same
struck location — e.g. both at the target's forearm. Under Reading B, the Secondary Critical could
independently roll a different location — e.g. Primary at the forearm, Secondary at the head — from
the same single attack.

**Interaction with decision 0006.** 0006 §5 rules the result roll (2d8) fresh and independent; it
does not rule location either way, so **neither reading contradicts 0006 as written** — both are
additions to an incomplete key specification, not amendments. However, until one is chosen, the
Secondary Critical lookup key (family, location, index) is not fully specified by 0006 plus PR #269:
family is settled (Q2's grammar aside), index follows from family + result, but location has no
ruling at all.

**Recommendation.** Reuse the Primary's hit location (Reading A). This is the only one of the four
questions where a recommendation is offered, and only a weak one: no source evidence favours it, but
(a) it is the reading both prior recovery passes on #223 independently assumed without contradiction,
(b) it matches the existing `Sec` attachment language ("attached to the main attack mode") that ties
the Secondary to the same attack, not a separate one, and (c) a single weapon blow producing two
simultaneous but physically separated wounds has no support anywhere in source or design notes, while
a single blow with two effects at one location is the more mechanically conventional reading. This
recommendation should be treated as a tie-breaker suggestion, not a finding — the Product Owner may
reasonably choose Reading B instead.

---

## Summary table (historical — see resolutions above and in the linked ruling)

| #   | Question         | Divergence example                         | Requires amending 0006?                     | Recommendation (then)          | Ruling                                     |
| --- | ---------------- | ------------------------------------------ | ------------------------------------------- | ------------------------------ | ------------------------------------------ |
| Q1  | Reduction anchor | Hatchet 3 vs 5; Wood axe 4 vs 5            | Weapon-anchored: yes (§2). Constant-`F`: no | None                           | Neither: maxima + universal two-step + cap |
| Q2  | Grammar scope    | Only affects future unattested codes       | No                                          | None                           | Attested-only (Reading B)                  |
| Q3  | Melee-only scope | Only affects future missile/ammo authoring | No                                          | None                           | Melee-only now, not a permanent boundary   |
| Q4  | Hit location     | Same vs different location per attack      | No (fills a gap, doesn't contradict)        | Weak: reuse Primary's location | Reuse Primary's location                   |

## Verification and traceability

- Portfolio: Forgejo #111 Criticals / Injury.
- Source reconciliation: `docs/rules/secondary-critical-sec-grammar.md` (now the current rule
  document, reconciled onto this same branch).
- Rule authority for settled matters: [decision 0006](../decisions/rules/0006-secondary-critical-resolution.md)
  (as amended 2026-09-21).
- Resolution record: [Ambiguity Log](./ambiguity-log.md), "Secondary Critical `Sec` Grammar" entry
  (status: resolved).
- Issue: Forgejo #223 and its comment thread, including the "PRODUCT OWNER RULING — Secondary
  Criticals, all four questions settled" comment.

## Dependency note (historical)

At the time this memo was written, it cited `docs/rules/secondary-critical-sec-grammar.md` by path
without linking to it, because that file existed only on the then-unmerged PR #269 branch
(`codex/223-sec-grammar`), not at this memo's `dev` baseline. PR #269 and this memo's branch have
since been reconciled onto the same branch, so the citations above now link directly.
