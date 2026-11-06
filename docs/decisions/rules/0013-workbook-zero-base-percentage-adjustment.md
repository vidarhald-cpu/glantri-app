# Rule decision 0013: The workbook's frozen zero row is superseded; zero is a base, not "ability absent"

- Status: approved and implemented. Nothing in this record is open.
- Date: 2026-11-04
- Product owner: Vidar Hald
- Authority: the Product Owner's **question 15 ruling**, Forgejo #922 comment 20880
  (2026-11-04), quoted in full below. The behaviour it keeps was first decided by the Product
  Owner on 2026-05-19 in commit `0f3682335bdeca4312ab096398eb24286092b177` ("Fix zero-base
  percentage modifier behavior", authored by Vidar Hald), recorded on #922 comment 20892. This
  record writes down a decision that already exists; it does not make a new one.
- Related issues/PRs: Forgejo #922 (the open-ended percentage-adjustment lookup, where the
  ruling was made), #934 (where question 15 was asked), #982 (this record and the correction of
  two source comments that still called the question open), #940 (whose extrapolation marker
  depends on the distinction recorded here)
- Supersedes: the source workbook's `Prosent!B5:P5` base-0 row, as an authority for what the
  combat percentage-adjustment lookup returns at a base of zero. The workbook is unchanged and
  remains the evidence for bases 1 to 49.
- Superseded by: none

## Question

The source workbook authors the base-0 row of the percentage-adjustment grid (`Prosent`) as
fifteen literal zeroes: at a base of zero, no raw modifier moves the value. Every other low base
(1 to 10) is authored as one point per raw step. The combat lookup has not followed the workbook
at base 0 since 2026-05-19; it returns one point per raw step there instead.

Product Owner question 15 asked whether that deviation should stay. Until this record, the
ruling existed only as a comment on #922, while two source comments described the question as
open.

## Evidence and provenance

- `data/raw/glantri/Themistogenes 1.07.xlsx`, sheet `Prosent`, `A4:P57`. Rows 5 to 15 (bases 0
  to 10) are literal values, not formulas. Bases 1 to 10 are authored as one point per raw step.
  Row 5 (`B5:P5`, base 0) is authored as zeroes. The zero row is formula-consistent, since a
  tenth of zero is zero, so it is deliberate in the source and not a bad transcription.
- Commit `0f3682335bdeca4312ab096398eb24286092b177` (2026-05-19) introduced the base-0 branch.
  The base-0 lines were byte-unchanged afterwards until #922 folded them into the single branch
  below (#922 comment 20892).
- Implementation: `resolveWorkbookPercentageAdjustment` in
  `packages/rules-engine/src/combat/workbookCombatMath.ts`. One branch (`rawOb <= 0`) answers one
  point per raw step for a base of zero and for every base below it.
- Tests in `packages/rules-engine/src/combat/workbookCombatMath.test.ts`: "applies the low-base
  minimum percentage adjustment to zero-base combat values" (bases 0, 1 and 2),
  "reproduces every authored cell the lookup trusts, and only the overridden row differs",
  "flags base 0 past the modifier edge, where the authored row is overridden by hand", and
  "expresses one continuous rule across zero, differing only in the flag".
- Prior rulings this one builds on, both on #922: comment 20793 (at a base of zero or below each
  point of raw modifier moves the value by one point; a defence may go below zero and is not
  floored) and comment 20326 (a figure outside the authored grid is an extrapolation and is
  flagged as one).

## Conflict or limitation

The source and the application disagree at base 0, on purpose. A workbook row that is frozen at
zero, between a row below it (the below-zero behaviour) and a row above it (base 1) that both
move one point per step, would make a combat value at base 0 unable to move under live
modifiers. The authored grid itself abandons proportional scaling for bases 1 to 10 and
authors a flat one point per step, so the zero row is the single isolated exception to its own
neighbours.

Earlier wording described the deviation as repairing a row that "imported as all zeroes". That
wording implied a transcription accident and is wrong: the workbook authors the zeroes
deliberately. This record states the deviation as what it is, a ruling.

## Ruling

Recorded verbatim, Product Owner, #922 comment 20880, 2026-11-04:

> Question 15 ruling: keep the current zero override. Base 0 follows the same one-point-per-step floor as bases 1–10 and the already-approved below-zero behavior. Do not preserve the spreadsheet's isolated frozen zero row.
> Treat zero as a valid numerical base, not as "ability absent." If an ability genuinely cannot be used, represent that explicitly rather than through numeric zero.
> Record this as an explicit rule decision superseding the historical workbook zero row, and correct any comment that describes the behavior as merely repairing a bad import. Add regression coverage across the −1 / 0 / +1 boundary.

The ruling has two halves. Both are rules.

1. **One rule for a base of zero and everything below it.** For a base of zero or below, each
   point of raw modifier moves the value by one point. That is continuous with the authored
   one-point-per-step floor at bases 1 to 10 and with the already-approved below-zero behaviour.
   The workbook's isolated frozen zero row is **explicitly superseded**. It is not an unexplained
   deviation, it is not a bad transcription, and it is not a question awaiting a decision. The
   only difference between a base of zero and a base below it is the extrapolation flag: base 0
   has an authored row and is not flagged on the base edge, while a base below zero has none and
   is flagged `base_below_zero`.
2. **Zero is a valid numerical base, not "ability absent".** Numeric zero must not be used to
   mean that an ability cannot be used. If an ability genuinely cannot be used, that is
   represented explicitly, in its own right, and not through a numeric zero. A reader or author
   who finds a base of zero must treat it as a number that takes part in the arithmetic.

## Reasoning

The authored grid already stops scaling into a flat one point per step at bases 1 to 10, and the
approved below-zero behaviour is the same figure. Treating zero as the one base where a modifier
does nothing would create a dead point in the middle of a continuous scale and would read a
combat value of zero as "cannot act" when it is a figure like any other. The second half of the
ruling prevents that reading from returning elsewhere: a numeric zero is data, and "unusable" is
a different fact that needs its own representation.

## Executable examples

At a base of zero, the lookup returns the number of steps:

| Base | Raw steps | Result | Extrapolated axes |
| ---- | --------- | ------ | ----------------- |
| 0    | 1         | 1      | none              |
| 0    | 7         | 7      | none              |
| 0    | 15        | 15     | none              |
| 0    | 100       | 100    | `modifier`        |

Across the boundary, the figure is the same and only the flag differs:

| Base | Raw steps (1, 7, 15) | Extrapolated axes |
| ---- | -------------------- | ----------------- |
| -1   | 1, 7, 15             | `base_below_zero` |
| 0    | 1, 7, 15             | none              |
| 1    | 1, 7, 15             | none              |

Through the trace, a base of 0 with a raw modifier of -1 finishes at -1 and with +1 finishes at
+1; the value is not floored at zero.

A change that restores the frozen zero row (every result at base 0 equal to 0), floors a
defence at zero, or treats any one of bases -1, 0 and 1 as special must fail these examples.

## Implementation consequences

- No behaviour changes. The lookup already implements this rule and its tests already pin it.
- Two source comments that called the question open are corrected, and a third test comment that
  called it "an open Product Owner question" is corrected with them. No code and no assertion
  changed.
- Nothing may mark the base-0 row as an extrapolation on the strength of its departure from the
  workbook: it is an approved rule superseding the authored row, not an unreviewed departure
  from it. The extrapolation flag keeps its present meaning (outside the authored grid).
- No migration. No stored data depends on this.
- Not covered here: the open-ended lookup rule beyond the authored grid (bases above 49, steps
  above 15), which was ruled separately on #922.

## Verification and traceability

- Code: `packages/rules-engine/src/combat/workbookCombatMath.ts`
  (`resolveWorkbookPercentageAdjustment`).
- Tests: `packages/rules-engine/src/combat/workbookCombatMath.test.ts`, the cases named under
  Evidence and provenance. The ruling's request for regression coverage across the -1 / 0 / +1
  boundary is tracked outside this record; see #982.
- Rulings: #922 comments 20880, 20892, 20793 and 20326.
- Follow-on question the ruling raises and this record does not answer: whether numeric zero is
  used anywhere to mean an unusable ability. That is a survey, not an assumption, and is not
  decided here.
