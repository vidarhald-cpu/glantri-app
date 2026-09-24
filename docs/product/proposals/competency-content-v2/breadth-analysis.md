# Effective-breadth analysis: approved catalogue vs. proposal

> **Status: CANONICAL — accepted by the Product Owner on 2026-09-23 (Forgejo #250).**
> See [decision record 0008](../../../decisions/rules/0008-competency-content-v2-canonical-acceptance.md).
> Generated from `packages/content/src/proposals/competencyContentV2/`. It is not yet registered
> with Chargen, not yet projected into canonical content, and does not yet replace any approved
> catalogue — that wiring is the separate, explicitly scoped work of #306 (runtime projection
> foundation), then #251/#252, per decision 0008's 2026-09-24 amendment.
> Regenerate with `pnpm --filter @glantri/content exec tsx ./scripts/generateCompetencyContentV2Report.ts`,
> then run Prettier over this folder.

## How this figure is used

Breadth is a **diagnostic, not a target**. The proposal authors coherent occupational training first
and then reads the distribution. Roughly 10 effective base Skills remains a design signal, never a
quota or a minimum: a coherent path at 7-9 is an accepted outcome, and a broader path is accepted
where it is genuinely justified. A path below 7 is flagged for a coherence review, not marked
defective.

## Counting rules (#250)

- Deduplicate Skills reachable through several routes on the same path.
- Count fixed Learning Group members and directly taught Skills.
- Count only `chooseCount` per selection slot; unselected alternatives count for nothing.
- Evaluate mutually exclusive tracks as separate paths.
- Exclude Specializations from base-Skill breadth.

Both sides of the comparison are measured by the same code path, so the before/after figures are like for like.

## Summary

| Measure              | Approved catalogue | Proposal (nominal) | Proposal (worst case) |
| -------------------- | -----------------: | -----------------: | --------------------: |
| Valid paths          |                 99 |                 86 |                    86 |
| Minimum              |                  0 |                  5 |                     5 |
| Lower quartile       |                  1 |                  7 |                     7 |
| Median               |                  3 |                  8 |                     8 |
| Upper quartile       |                  7 |                  9 |                     9 |
| Maximum              |                 17 |                 16 |                    14 |
| Mean                 |               4.39 |               8.59 |                  8.16 |
| Paths at or above 10 |                 10 |                 22 |                    19 |
| Paths below 10       |                 89 |                 64 |                    67 |

The worst-case column assumes every single slot selection duplicates a Skill the path already teaches.
That never happens by design — no slot offers a Skill its own group already fixes — but it bounds the figure honestly.

## Distribution

| Catalogue | Effective distinct base Skills | Valid paths |
| --------- | -----------------------------: | ----------: |
| Approved  |                              0 |           1 |
| Approved  |                              1 |          25 |
| Approved  |                              2 |          23 |
| Approved  |                              3 |           6 |
| Approved  |                              4 |           5 |
| Approved  |                              5 |           6 |
| Approved  |                              6 |           6 |
| Approved  |                              7 |           4 |
| Approved  |                              8 |           5 |
| Approved  |                              9 |           8 |
| Approved  |                             10 |           2 |
| Approved  |                             11 |           4 |
| Approved  |                             12 |           1 |
| Approved  |                             13 |           1 |
| Approved  |                             14 |           1 |
| Approved  |                             17 |           1 |
| Proposal  |                              5 |           2 |
| Proposal  |                              6 |           4 |
| Proposal  |                              7 |          28 |
| Proposal  |                              8 |          13 |
| Proposal  |                              9 |          17 |
| Proposal  |                             10 |          10 |
| Proposal  |                             11 |           5 |
| Proposal  |                             12 |           3 |
| Proposal  |                             14 |           1 |
| Proposal  |                             15 |           1 |
| Proposal  |                             16 |           2 |

## Paths flagged for coherence review (below 7)

A flag here is a prompt to look at the content, never a defect and never a licence to pad. The
2026-09-21 Learning-Group membership ruling deliberately narrowed five groups and retired one, and it
did so knowing breadth would fall: coherent training is authored first and breadth is read afterwards.
The paths below are the ones that fell under the coherence floor as a result, and each is left as the
ruling leaves it rather than topped up. Three are scholarly paths that lost Mathematics with K01 —
Mathematics was never part of what those occupations study, and the numerate scholarly Professions keep
it through K21 and K03. Three are construction paths that lost C03 — the building designer and the
shipbuilder reach every competence their occupation genuinely teaches, and the ruling forbids charging
either a craft apprenticeship for coordinating trades it does not practise. **Every one of these paths
still satisfies its defining core route.**

| Profession | Path                      | Effective breadth |
| ---------- | ------------------------- | ----------------: |
| P39        | Carpenter                 |                 6 |
| P40        | Shipbuilder               |                 5 |
| P49        | Building Designer         |                 5 |
| P64        | Teacher                   |                 6 |
| P65        | Scribe and Copyist        |                 6 |
| P67        | Historian and Genealogist |                 6 |

## Group-size distribution, before and after

The approved catalogue is measured by counting each approved group's base-Skill members; the proposal is
measured as fixed members plus slot selections.

| Effective size | Approved groups | Proposed groups |
| -------------: | --------------: | --------------: |
|              1 |               4 |               0 |
|              2 |              36 |              40 |
|              3 |              10 |              40 |
|              4 |               5 |              12 |
|              5 |               1 |               3 |
|              6 |               1 |               0 |
|              7 |               2 |               0 |

Approved: 59 groups. Proposal: 95 groups — 52 in the 3-4 preferred centre, 40 at two, 0 at one, 3 at five or more. Largest fixed purchase burden of any one group: 4.

## Direct-grant review

The first draft carried 283 direct Profession Skill grants; 106 remain. The withdrawals and the reasons for each retention are recorded in the [direct-grant review](./direct-grant-review.md).
