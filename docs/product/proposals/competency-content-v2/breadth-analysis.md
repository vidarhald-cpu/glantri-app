# Effective-breadth analysis: approved catalogue vs. proposal

> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — awaiting review.**
> Generated from `packages/content/src/proposals/competencyContentV2/`. It is not registered with
> Chargen, not projected into canonical content, and does not replace any approved catalogue.
> Regenerate with `pnpm --filter @glantri/content exec tsx ./scripts/generateCompetencyContentV2Report.ts`,
> then run Prettier over this folder.

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
| Minimum              |                  0 |                  9 |                     7 |
| Lower quartile       |                  1 |                 10 |                    10 |
| Median               |                  3 |                 10 |                    10 |
| Upper quartile       |                  7 |                 11 |                    11 |
| Maximum              |                 17 |                 15 |                    14 |
| Mean                 |               4.39 |              10.73 |                 10.19 |
| Paths at or above 10 |                 10 |                 95 |                    75 |
| Paths below 10       |                 89 |                  1 |                    21 |

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
| Proposal  |                              9 |           1 |
| Proposal  |                             10 |          52 |
| Proposal  |                             11 |          25 |
| Proposal  |                             12 |          12 |
| Proposal  |                             13 |           4 |
| Proposal  |                             15 |           2 |

## Paths still below the ~10 design signal

None, other than paths explicitly marked narrow by design.

## Paths marked narrow by design

| Profession            | Path           | Effective breadth | Why the narrowness is legitimate                                                                  |
| --------------------- | -------------- | ----------------: | ------------------------------------------------------------------------------------------------- |
| P82 Weapon Instructor | Fencing master |                 9 | The fencing-master path is deliberately narrow: a single named tradition is the whole occupation. |
