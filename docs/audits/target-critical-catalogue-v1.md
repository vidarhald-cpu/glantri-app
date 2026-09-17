# Target Critical catalogue V1 audit

Status: Builder verification for Forgejo #216; candidate pending fresh independent exact-head
content/rules QA and protected checks

Accepted baseline: `dev@dda76a24d0d8456944656348cfdaece3755c3b3c`

Package: [Target Critical catalogue V1](../source/combat/target-critical-catalogue-v1/README.md)

## Scope and boundary

This audit verifies a documentation/content package only. It does not claim runtime equivalence,
browser behavior, database behavior, migration safety, or implementation acceptance. No production
Critical table, generated runtime data, representative fixture, Combat/rules-engine/API/web file,
persistence model, schema, migration, routing rule, or armor arithmetic is part of the candidate.

## Source tuple

- Workbook: `docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx`
- SHA-256: `47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f`
- Results: `AppFacing_Crits!A1:X609`
- Effects: `AppFacing_Effects!A1:AE2180`
- Existing source inventory: 608 results / 2,179 unique effects

The workbook's five stale summary cells remain provenance-only discrepancies already recorded in
`docs/audits/critical-effects-conformance.md`. They do not change the generated source inventory.

The existing `critical-effects:verify` source/runtime preservation check passed unchanged at 608
results and 2,179 effects. It retained the source warnings—76 fractional rates, 757 unresolved
special/stateful mappings, 79 roll-once rates, 5 death timers, and the five summary discrepancies.
Those warnings describe the historical/runtime source snapshot; the target package resolves them
through separate non-runtime content and source dispositions rather than editing the workbook or
generated table.

## Catalogue verification

| Check                                      | Result |
| ------------------------------------------ | -----: |
| Catalogue JSONL lines                      |    608 |
| Unique keys                                |    608 |
| Approved family/location combinations only |   PASS |
| Index range exactly 01–16                  |   PASS |
| Six regional families × six scopes × 16    |    576 |
| Falling/Crushing whole-body                |     16 |
| Fire/Energy whole-body                     |     16 |
| Outcome name present                       |    608 |
| Player prose present                       |    608 |
| GM prose present                           |    608 |
| Structured consequence list present        |    608 |
| Source result coordinate present           |    608 |
| Source effect ranges present               |    608 |

Band totals reconcile to 608:

- Minor 114;
- Moderate 114;
- Serious 114;
- Severe 114;
- Catastrophic 88; and
- Fatal 64.

All twelve lower-leg 15–16 keys are Catastrophic and contain no terminal consequence.

## Source-row accounting

`source-dispositions.jsonl` has 2,179 lines, 2,179 unique effect keys, and one exact workbook row
snapshot per key.

| Final disposition                   |  Rows |
| ----------------------------------- | ----: |
| `retained_as_mechanic`              |   649 |
| `normalized_as_mechanic`            | 1,180 |
| `retained_as_non_runtime_content`   |   346 |
| `normalized_as_non_runtime_content` |     3 |
| `retired_legacy_shorthand`          |     1 |
| `unresolved`                        |     0 |
| Total                               | 2,179 |

Every row either points to one or more target consequence IDs or has an explicit retirement
disposition and rationale. No source row disappears through prose or aggregate counts.

The one fully retired row is the Fire/Energy 06 legacy Mobility `-8`/action-lock shorthand. The
approved target retains Stunned `-4`, conscious/actionable play, conditional hearing content, and the
non-runtime `1/4 HP/round` fire loss instead.

## Semantic invariants

- Dazed is always General `-2`.
- Stunned is always General `-4`.
- No target consequence names Stunned with `-1`, `-2`, or `-8`.
- Independent source stacking and exact-event idempotency are explicit.
- Fixed durations use creation-round remainder plus N complete subsequent rounds.
- Scheduled checkpoints never act as deterministic expiry.
- Bounded checks name their maximum and final-failure transition.
- Every ordinary Bleed has external/internal type, exact rational rate, delayed first accrual,
  independent lifecycle, treatment end, and provenance.
- No automatic ten-round Health cadence exists.
- Treating one source does not alter an unrelated source or named effect.
- Every catalogue result schedules CE in the next CE pre-phase and preserves current CE until
  replacement.
- Persistent/terminal content and non-Bleed periodic loss retain the explicit non-runtime boundary.

## Exact exceptions and interactions

`interaction-ledger.jsonl` has 15 complete entries. Each points to consequence IDs or catalogue keys
that exist in `catalogue.jsonl`.

- The only `action_limited_to_parry` consequences are `sharp|chest|04#c03` and
  `blunt|chest|04#c03`.
- Dazed plus Stunned, two independent Stunned sources, multiple Bleed sources, damage-floor
  precedence, fixed duration, scheduled recovery, bounded recovery, treatment isolation,
  Critical-triggered CE, simultaneous Round End processing, Fire/Energy cause conditionals,
  lower-leg band handling, and persistent-injury boundaries all have exact evidence.

The canonical example document expands those interactions into future implementation/QA fixtures.

## Distribution review

The distribution output has one catalogue-wide row, eight family rows, seven location rows, and six
band rows. Each grouping independently reconciles to 608 results.

Catalogue-wide incidence:

- Dazed 256; Stunned 278;
- fixed one-round 183; fixed two-round 129; fixed three-plus-round 75;
- rolled fixed 100; scheduled recovery 15; bounded recovery 42;
- external Bleed 138; internal Bleed 82;
- functional loss 307; ordinary modifier 225;
- persistent injury 80; incapacitating 84; terminal/fatal 117.

Average diagnostic burden rises monotonically across bands: `2.66`, `5.15`, `7.92`, `13.21`,
`16.72`, `17.17`. The report explains family/location outliers and the exact-rate calibration; no
quota was used.

The three Bleed-rate distribution columns are derived only from consequences whose semantic is
`bleed`. Fire/Energy therefore has no Bleed-rate statistics; the whole-body median is `5/12`, the
Moderate maximum is `1/6`, and the Serious maximum is `1/4 HP/round`. The Fire/Energy `1/4`, `1/3`,
and `1/2 HP/round` loss rates remain separate, non-Bleed, non-runtime target content.

## Payload integrity

| File                        | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `catalogue.jsonl`           | `39b9af69bb1452c947197be76dbb609564dc37925f70826f8da7c8268f7c5759` |
| `source-dispositions.jsonl` | `ac554ef96a59e09df4bd6995e88ed4636f364ee95ccd05f41feaf28f3705051f` |
| `distribution.csv`          | `bef8d2c18808f0fed0ce66cd0aa1deaeb81821ceebba3bafd695ff8628b1b139` |

`validation-summary.json` is the machine-readable count and hash record.

## Required next gate

The complete package remains a content/rules candidate. It requires fresh independent exact-head
content/rules QA and protected checks before any permitted integration. Runtime implementation and
activation require their own contract and must not be inferred from a content QA PASS.
