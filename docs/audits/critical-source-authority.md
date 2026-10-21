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
| Generated data file SHA-256       | `954ad00d9fa258ea489e5f965c7dcf222c146a60c06939607e31b2afbd63c810` |
| Critical results semantic SHA-256 | `8acae8c32f60a39f221225aa0f06fed163e73e523bf9a0c551f275cea5d940a4` |
| Establishing issue                | #741                                                               |
| Establishing branch               | `builder/741-critical-head-titles`                                 |
| Establishing commit               | `3054c41d9d91f8094a8438b641d216bc64c5bb63`                         |

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
| Previous data file SHA-256 | `63bb12c2ae0765acd64c70ba4abcc8ebf5d89a71026f70ca2199dd56de0f1673`              |
| New data file SHA-256      | `954ad00d9fa258ea489e5f965c7dcf222c146a60c06939607e31b2afbd63c810`              |
| Authority                  | Product Owner ruling of 2026-10-21 recorded on issue #741                       |
| Generation mode            | `node scripts/generateCriticalEffectsTable.mjs --generate --accept-data-change` |

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

### Open item carried to the control plane

`docs/source/combat/target-critical-catalogue-v1/validation-summary.json` still records
`workbook_sha256: 47cde37d…` and has deliberately **not** been moved to v14. Measured reason:
that file is a self-consistent snapshot of one validation run. Besides the workbook digest it
records `catalogue_sha256`, `source_dispositions_sha256` and `distribution_sha256` — the digests
of the artefacts that run validated. Its recorded `catalogue_sha256`
`39b9af69bb1452c947197be76dbb609564dc37925f70826f8da7c8268f7c5759` matches `catalogue.jsonl`
exactly as it stood before #741 and no longer matches it after the authorized `outcome_name` and
`player_prose` corrections. Moving only its workbook digest would describe a validation run that
never happened, and recomputing all four digests would assert a validation this lane did not
perform on an approved artefact that nothing in the repository regenerates. The disposition of
this file is referred to the control plane.
