# Effective-breadth analysis: approved catalogue vs. proposal

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — awaiting review.**
> Generated from `packages/content/src/proposals/competencyContentV2/`. It is not registered with
> Chargen, not projected into canonical content, and does not replace any approved catalogue.
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
| Valid paths          |                 99 |                 96 |                    96 |
| Minimum              |                  0 |                  6 |                     5 |
| Lower quartile       |                  1 |                  7 |                     7 |
| Median               |                  3 |                  8 |                     8 |
| Upper quartile       |                  7 |                 10 |                    10 |
| Maximum              |                 17 |                 15 |                    14 |
| Mean                 |               4.39 |               8.86 |                  8.34 |
| Paths at or above 10 |                 10 |                 32 |                    28 |
| Paths below 10       |                 89 |                 64 |                    68 |

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
| Proposal  |                              6 |           1 |
| Proposal  |                              7 |          26 |
| Proposal  |                              8 |          23 |
| Proposal  |                              9 |          14 |
| Proposal  |                             10 |          14 |
| Proposal  |                             11 |          10 |
| Proposal  |                             12 |           4 |
| Proposal  |                             13 |           2 |
| Proposal  |                             14 |           1 |
| Proposal  |                             15 |           1 |

## Paths flagged for coherence review (below 7)

None, other than paths explicitly marked narrow by design.

## Direct-grant review

The first draft carried 283 direct Profession Skill grants; 119 remain. The withdrawals and the reasons for each retention are recorded in the [direct-grant review](./direct-grant-review.md).

## Paths marked narrow by design

| Profession            | Path                  | Effective breadth | Why the narrowness is legitimate                                                                  |
| --------------------- | --------------------- | ----------------: | ------------------------------------------------------------------------------------------------- |
| P82 Weapon Instructor | Fencing master        |                 6 | The fencing-master path is deliberately narrow: a single named tradition is the whole occupation. |
| P82 Weapon Instructor | Missile weapon master |                 8 | The fencing-master path is deliberately narrow: a single named tradition is the whole occupation. |
