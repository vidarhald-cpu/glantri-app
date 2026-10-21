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

## Open question, not settled here

The per-entry `source_trace` blocks inside `catalogue.jsonl` and `source-dispositions.jsonl`
still name v13 and `47cde37d…` — 608 and 2,179 digest pins respectively, 608 workbook path
strings, and for the 15 corrected keys a `source_result.title` holding the old placeholder.
`validation-summary.json` and the catalogue `README.md` also still pin v13.

Whether those are historical per-row provenance snapshots of the same kind as the list above,
or current-state pins that must follow current authority, is **not settled** and is recorded
as an open question on #741. They were deliberately left untouched rather than half-updated:
moving a digest pin while leaving the row snapshot it describes would assert that the workbook
at `3c368646…` contains `Fatal sharp head critical`, which is false.

Separately, `catalogue.jsonl` and the authoritative dataset **already disagreed** at Critical
index 13 before this lane: the entry's `outcome_name` carried the bare machine stem while its
`source_trace` title carried the longer form that the dataset used. This lane does not
introduce that disagreement and does not extend it.
