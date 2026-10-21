# Critical source authority — current state and provenance transitions

This record states which Critical source workbook is **currently** authoritative, and records
each authorized transition away from a previous one. It exists because historical decision,
recovery and audit records pin the workbook and digest that were accepted on their own date,
and those pins are provenance for that accepted state — they are not assertions about the
current workbook. Without a single current-state record, a reader comparing a historical pin
against the live toolchain cannot tell an authorized content correction from drift.

## Current authority

| Field                             | Value                                                              |
| --------------------------------- | ------------------------------------------------------------------ |
| Workbook                          | `docs/source/combat/Glantri_CriticalEffects_AppFacing_v14.xlsx`    |
| Workbook SHA-256                  | `3c368646ed0c50da8e18d2fa04774d18f6ad9c991adcd8e2fe3c2515f3c14c8c` |
| Generated data file               | `packages/domain/src/encounter/criticalEffectsTableData.ts`        |
| Generated data file SHA-256       | `836e66a169d5267235652a139e1ecd307d3f481a482f9a75e721ba3c48213aee` |
| Critical results semantic SHA-256 | `8acae8c32f60a39f221225aa0f06fed163e73e523bf9a0c551f275cea5d940a4` |
| Establishing issue                | #741                                                               |
| Establishing branch               | `builder/741-critical-head-titles`                                 |
| Establishing commit               | `733496cbfe79915ece6937e5f71507b251b7c0a7`                         |

The digests above are the values the generator wrote into
`packages/domain/src/encounter/criticalEffectsTableManifest.json`. They were read from that
regenerated manifest, not transcribed from any failure output.

## Transition 1 — v13 `47cde37d…` to v14 `3c368646…` (issue #741)

| Field                      | Value                                                                           |
| -------------------------- | ------------------------------------------------------------------------------- |
| Previous workbook          | `docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx`                 |
| Previous workbook SHA-256  | `47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f`              |
| New workbook               | `docs/source/combat/Glantri_CriticalEffects_AppFacing_v14.xlsx`                 |
| New workbook SHA-256       | `3c368646ed0c50da8e18d2fa04774d18f6ad9c991adcd8e2fe3c2515f3c14c8c`              |
| Previous data file SHA-256 | `7308ca47622650c2a7f78cf3a6986ce16d269ef2c546e15038d4ee9d1891edf2`              |
| New data file SHA-256      | `836e66a169d5267235652a139e1ecd307d3f481a482f9a75e721ba3c48213aee`              |
| Authority                  | Product Owner ruling of 2026-10-21 recorded on issue #741                       |
| Generation mode            | `node scripts/generateCriticalEffectsTable.mjs --generate --accept-data-change` |

The generated data file's digest reflects two compounding causes: the 15 title corrections in
this transition, and the canonical Prettier formatting of generated generator output introduced
by #749, onto which this change is rebased. The semantic digests isolate the first from the
second — see below.

**v13 is preserved on disk byte-unchanged** at its original digest. v14 is v13 plus the
authorized corrections and nothing else.

**The transition is caused only by the authorized 15-key title and player-prose correction
under #741.** The 15 keys are `sharp|head|13`, `sharp|head|15`, `sharp|head|16` and the same
three Critical indexes for `blunt`, `teeth_claws`, `arrows_bolts` and `firearms`.

### Measured, field by field rather than sampled

Workbook v13 against v14, compared independently of the application's own generator — zip
entry set, every non-worksheet part byte for byte, `sharedStrings.xml` byte for byte, and
every cell of every worksheet by address, type, formula flag and decoded value:

- 28 zip entries in both; 17 non-worksheet parts byte-identical; `sharedStrings.xml`
  identical at 47 entries.
- **103,252 cells compared across 11 worksheets; exactly 15 differ.** All 15 are column F of
  `AppFacing_Crits`, on exactly the 15 authorized `crit_key` rows.
- Formula-cell count unchanged at 2,112, and none of the 15 changed cells carries a formula.
  `AppFacing_Crits` itself contains no formula cells in either workbook.
- **No mechanical or rule content differs**: no body text, effect, damage, Stun, Bleed,
  duration, urgency, treatment, mortality or tag cell is among the differences.

Authoritative dataset, against `dev` `112747f0`:

- 608 of 608 Critical results and 2,179 of 2,179 effect templates compared; **15 changed
  fields, every one of them `title`**, on exactly those 15 keys; **0 changed effect rows**;
  no row identity, index, family or location moved.

Semantic digests, **re-derived by importing the committed data file and recomputing
`sha256(JSON.stringify(export))`**, not read back from this manifest. The manifest's values are
computed from the workbook parse upstream of rendering, so a matching manifest field alone would
corroborate only that the workbook parse was unchanged; re-deriving from the committed module
also covers rendering fidelity:

- `criticalResultsSemanticSha256` re-derives to
  `8acae8c32f60a39f221225aa0f06fed163e73e523bf9a0c551f275cea5d940a4`, equal to the recorded
  value. It **differs** from the pre-transition `39d36f98…` because the 15 title corrections are
  a genuine semantic change.
- `effectTemplatesSemanticSha256` re-derives to
  `8a6a0e62f85d81219d4929465162ccbc56342706ff1a004214a9a7a330a2991d`, equal to the recorded
  value, confirming no effect data moved.

Neither semantic digest is asserted by any test in the repository — `criticalEffectsGeneration.test.ts`
checks `output` with `toMatchObject` over the counts, `file` and `fileSha256` only — so this
explicit re-derivation is the only evidence covering them.

Controlling catalogue `docs/source/combat/target-critical-catalogue-v1/catalogue.jsonl`:

- 608 of 608 entries compared; **30 changed fields across 15 entries, confined to
  `outcome_name` and `player_prose`**; `gm_prose`, `source_trace` and
  `structured_disposition` unchanged in every entry. In `player_prose` only the leading
  placeholder stem sentence was replaced; the substantive sentence that follows it is
  byte-identical.
- `outcome_name` equals the authoritative dataset `title` for all 15 corrected keys.

## Records that keep citing v13, by design

The following remain unchanged and keep citing v13 and `47cde37d…`, because that is the
source they actually reviewed and accepted. They are valid provenance for that accepted
state, they are **not** assertions about the current workbook, and they are not to be amended
with forward references.

- `docs/decisions/rules/0001-c1-critical-injury-recalibration.md`
- `docs/recovery/2026-09-06-c1-five-key-freeze-and-staging.md`
- `docs/audits/c1-critical-fixtures.md`
- `docs/audits/target-critical-catalogue-v1.md`
- `packages/rules-engine/src/encounters/representativeCriticalFixtures.ts`
  (`REPRESENTATIVE_CRITICAL_WORKBOOK_SHA256`, and the workbook path in the fixture
  provenance type)
- `packages/domain/src/encounter/criticalInjuryFixtures.ts` (`WORKBOOK`, `WORKBOOK_SHA256`,
  `ACCEPTED_AT`)

The last two are frozen fixture snapshots, not pointers to the active workbook: they carry
`ACCEPTED_AT = 2026-08-13`, and their tests assert them against their own constants rather
than against the live file. The same reasoning that leaves the four accepted records at v13
leaves these at v13.

## `source_trace` refers to v13 by design, not drift

**Historical `source_trace` blocks may refer to v13 and `47cde37d…` while current authority is
v14 and `3c368646…`. This is by design and is not drift.** Product Owner ruling of 2026-10-21
on #741.

Left unchanged, deliberately:

- every `source_trace` block in `docs/source/combat/target-critical-catalogue-v1/catalogue.jsonl`
  — 608 `workbook` path strings, 608 `workbook_sha256` pins, and for the 15 corrected keys a
  `source_result.title` still holding the old machine-stem placeholder;
- every `source` trace block in
  `docs/source/combat/target-critical-catalogue-v1/source-dispositions.jsonl` — 2,179
  `workbook_sha256` pins. That file carries effect rows only and no reader-facing prose, so no
  prose was affected either way.

Those traces describe the source state captured when those catalogue records were produced.
Rewriting them to v14 would assert that records authored against v13 were derived from v14,
which is false. **The 2,789 historical trace pins were not updated merely to make every digest
string in the repository identical.**

A catalogue entry may therefore carry a corrected reader-facing `outcome_name` and
`player_prose` that follow current v14 authority while its own `source_trace` still shows the
v13 row it was produced from. Reviewers comparing the two should expect that and should not read
it as inconsistency.

Current authority moves forward instead through the fields and files that describe current
state: the v14 workbook, the generated runtime Critical data, this manifest, and the
controlling catalogue's current-authority declaration in
`docs/source/combat/target-critical-catalogue-v1/README.md`.

### Pre-existing divergence, not introduced here

`catalogue.jsonl` and the authoritative dataset **already disagreed** at Critical index 13
before this lane: the entry's `outcome_name` carried the bare machine stem while its own
`source_trace` title carried the longer form the dataset used. #741 does not introduce that
disagreement, does not extend it, and does not silently normalize historical traces. It remains
accounted for under the authority/divergence work on #739.

### `validation-summary.json` — historical validation evidence, not a current statement

**`docs/source/combat/target-critical-catalogue-v1/validation-summary.json` is left completely
unchanged.** Product Owner ruling of 2026-10-21 on #741. Three statements govern how it is to be
read:

1. **It describes the pre-#741, v13 validation state.**
2. **It remains valid historical evidence** of the validation run that was actually performed.
3. **It is not a current validation statement for v14 or post-#741 authority.** Nothing in it may
   be read as asserting that the v14 workbook, or the catalogue as corrected under #741, has been
   validated. No such validation has been run.

It is a self-consistent snapshot of one validation run: its workbook, catalogue, disposition and
distribution digests describe the inputs and outputs that were actually validated together at
that time.

| Field                        | Recorded                                                           | Describes                                                 |
| ---------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| `workbook_sha256`            | `47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f` | v13, the source that run validated                        |
| `catalogue_sha256`           | `39b9af69bb1452c947197be76dbb609564dc37925f70826f8da7c8268f7c5759` | `catalogue.jsonl` as it stood before the #741 corrections |
| `source_dispositions_sha256` | `ac554ef96a59e09df4bd6995e88ed4636f364ee95ccd05f41feaf28f3705051f` | `source-dispositions.jsonl`, which #741 did not change    |
| `distribution_sha256`        | `bef8d2c18808f0fed0ce66cd0aa1deaeb81821ceebba3bafd695ff8628b1b139` | `distribution.csv`, which #741 did not change             |

Because the four digests belong to one run, editing any single field inside the file would
falsify the record rather than update it. Under the ruling, #741 does not change only
`workbook_sha256`, does not recompute the four digests by hand, does not change the artefact
shape — so no current-authority field is added to it — and does not imply that v14 together with
the post-#741 catalogue was validated.

The `catalogue_sha256` divergence is caused by **#741's own authorized `outcome_name` and
`player_prose` corrections**, not by the v13-to-v14 version bump; it would have arisen even had
the workbook been edited in place.

**The architectural question** — how current catalogue validation should be reproducibly
regenerated and recorded — belongs to **#739 and the canonical-authority work**, where the
measurement above is recorded. It is not addressed here, and #741 is not blocked on it.
