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
| Workbook SHA-256                  | `3b474637e2466e59485c6893ce94da1e125940ff3c6fb98e6c5948d0df6822e2` |
| Generated data file               | `packages/domain/src/encounter/criticalEffectsTableData.ts`        |
| Generated data file SHA-256       | `2e8e86cc3973e3d222df61e65d0f5e8637080b57c1138e6f81dbebd2e70e8fd3` |
| Critical results semantic SHA-256 | `c1afe09614e0e11d91969b9d0e2b3cae6f3ae3c12bcd0314525ee177075b7578` |
| Establishing issue                | #747                                                               |
| Establishing branch               | `builder/747-critical-machine-token-titles`                        |
| Previous establishing issue       | #741, at workbook `3c368646…`                                      |

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

Authoritative dataset, against `dev` `f67bd8bc`:

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

## Transition 2 — v14 `3c368646…` to v14 `3b474637…` (issue #747)

| Field                      | Value                                                                           |
| -------------------------- | ------------------------------------------------------------------------------- |
| Workbook                   | `docs/source/combat/Glantri_CriticalEffects_AppFacing_v14.xlsx`                 |
| Previous workbook SHA-256  | `3c368646ed0c50da8e18d2fa04774d18f6ad9c991adcd8e2fe3c2515f3c14c8c`              |
| New workbook SHA-256       | `3b474637e2466e59485c6893ce94da1e125940ff3c6fb98e6c5948d0df6822e2`              |
| Previous data file SHA-256 | `836e66a169d5267235652a139e1ecd307d3f481a482f9a75e721ba3c48213aee`              |
| New data file SHA-256      | `2e8e86cc3973e3d222df61e65d0f5e8637080b57c1138e6f81dbebd2e70e8fd3`              |
| Authority                  | Product Owner rulings of 2026-10-21 recorded on issue #747                      |
| Generation mode            | `node scripts/generateCriticalEffectsTable.mjs --generate --accept-data-change` |

**The retained-artefact pattern was deliberately not applied here: this transition edits v14 in
place rather than creating a v15.** Ruling 4B directs the change at
"the current v14 workbook's `CritSlots` sheet", so the pre-#747 v14 bytes are recoverable from git
history at `dev` `7bcbe508` rather than from a retained file on disk. This differs from Transition
1, which bumped the version and retained the previous workbook. **v13 is untouched** at
`47cde37d…`.

**The transition is caused only by the authorized #747 title correction.** 91 of 608 `title`
values carried a confirmed machine/internal token: 64 carrying one of 18 `sourceSpecialTags`
values, 27 more carrying `whole_body` or `lower_arm`, three carrying both. The governing rulings,
quoted verbatim:

> The corrected scope is **91 Critical result titles**, not 18 rows. Author reader-facing titles
> for all 91 rows containing confirmed machine/internal tokens. **This is one defect class:**
> direct `sourceSpecialTags` leakage; other confirmed machine-token leakage such as `whole_body`
> and `lower_arm`. **There is no remaining bucket of potentially intentional reader-facing
> snake_case terminology.**
>
> **Do not apply a blanket string transformation.** Each title must be authored from that row's
> existing authoritative body/effects and ordinary Critical terminology. **Existing human
> vocabulary should guide the wording** — for example, where sibling results already use
> `forearm`, do not expose `lower_arm`.

> Treat all seven arguable `whole_body` title cases as machine-token leakage and author them too.
> **The fact that the underlying location is `whole_body` does not make the literal underscore
> token reader-facing terminology.** Use ordinary prose consistent with the existing catalogue:
> **`whole-body`** where that is the natural description of the result; another established human
> term only where the row's body/effects clearly support it. **Do not expose `whole_body` merely
> because it is the internal location value. This keeps the 91-row cleanup governed by one rule and
> avoids a hidden 7-row exception.**

> For the 8 rows where the leaked machine tag cannot be translated from the row's own authored
> prose without interpreting `specialFlag`, **omit that clause from the reader-facing title. Do not
> derive prose from `specialFlag` in this title-cleanup lane.** Preserve unchanged: `bodyText`;
> effect templates; `specialFlag`; all mechanical values and row identities.
>
> **A Critical title is a reader-facing summary, not a complete encoding of every structured
> effect.**
>
> `firearms arm|08`: **file a separate content/data consistency issue** for the apparent
> `through-and-through` body text versus `embedded` flag. **Do not decide which is correct in
> #747.** The remaining seven omissions require no separate ruling **unless removing the machine
> clause leaves the title misleading or meaningless.**

> **A. Generator/test title pin.** Update the hard-coded `sharp|arm|13` representative title in
> `scripts/generateCriticalEffectsTable.mjs` and the corresponding exact-literal test in
> `criticalEffectsTable.test.ts` to the newly approved #747 title. **This is an authorized
> mechanical consequence of changing that title, not authority to alter the representative case,
> key, mechanics, or test semantics. Keep the assertion; do not weaken or remove it merely to avoid
> updating the expected title.**
>
> **B. `CritSlots`.** Update the corresponding title text in the current v14 workbook's
> `CritSlots` sheet for the #747-affected rows so it agrees with `AppFacing_Crits`. **Do not leave
> `CritSlots` carrying the machine-token titles when it can later be used to
> re-derive/reintroduce them.** Scope is title/text synchronization only: same affected Critical
> identities; same approved titles; **no effect/mechanical columns; no row identity/index/family/
> location changes; no edits to historical v13.**
>
> **Durable guard.** If it can be done narrowly, add a conformance assertion that overlapping
> Critical identities in `CritSlots` and `AppFacing_Crits` agree on the title field —
> **specifically to prevent a future re-derivation from silently restoring machine titles. Do not
> redesign the generator or worksheet model to achieve this.** If a clean title-equivalence guard
> requires broader architecture work, **file it separately rather than expanding #747.**

### Measured, field by field rather than sampled

Workbook v14 `3c368646…` against v14 `3b474637…`, compared independently of the application's own
generator — zip entry set, every non-worksheet part byte for byte, `sharedStrings.xml` byte for
byte, and every cell of every worksheet by address, type, formula flag and decoded value:

- 28 zip entries in both; 17 non-worksheet parts byte-identical; `sharedStrings.xml` identical at
  47 entries.
- **103,252 cells compared across 11 worksheets; exactly 182 differ.** 91 are column F of
  `AppFacing_Crits` and 91 are column E of `CritSlots`, on exactly the same 91 Critical identities,
  and both sheets carry the same new string for each.
- Formula-cell count unchanged at **2,112**, and none of the 182 changed cells carries a formula.
- **No mechanical or rule content differs**: no body text, effect, damage, Stun, Bleed, duration,
  urgency, treatment, mortality or tag cell is among the differences.

The differ was falsified eight ways before it was trusted — stripping the array formula from
`CritSlots!V2`, editing a `body_text` cell, desynchronizing one `CritSlots` title from its
`AppFacing_Crits` twin, writing a title other than the approved one, changing a numeric cell on an
unrelated sheet, appending to `xl/styles.xml`, dropping `xl/theme/theme1.xml`, and incrementing
`urgency` on an authorized row. Each was caught by exit code. Running it with identical inputs also
fails, because zero authorized changes is not a pass.

Authoritative dataset, by importing the committed module rather than text-parsing the generated
file:

- 608 of 608 Critical results and 2,179 of 2,179 effect templates compared; **13,269 result fields
  and 41,863 effect fields compared**; **91 changed fields, every one of them `title`**; **0 changed
  effect fields**; no `bodyText`, row identity, index, family or location moved; no title outside
  the 91 changed.
- **24 of the 91 authored titles coincide with the trivial underscore-to-space rewrite of their old
  value, and every one of those 24 is a `whole_body unusable` / `whole_body barely usable` slot row**
  where plain English genuinely is "whole body". The other 67 do not coincide, so the set is not the
  product of a blanket rule. `lower_arm` renders as `forearm`, matching the eight existing titles
  that already use it; `brain_damage_risk` renders as "lasting" or "permanent" according to which
  word each row's own prose uses.

Semantic digests, **re-derived by importing the committed data file and recomputing
`sha256(JSON.stringify(export))`**, not read back from this manifest:

- `criticalResultsSemanticSha256` re-derives to
  `c1afe09614e0e11d91969b9d0e2b3cae6f3ae3c12bcd0314525ee177075b7578`, equal to the recorded value.
  It **differs** from the pre-#747 `8acae8c3…` because the 91 title corrections are a genuine
  semantic change.
- `effectTemplatesSemanticSha256` re-derives to
  `8a6a0e62f85d81219d4929465162ccbc56342706ff1a004214a9a7a330a2991d`, **unchanged from before
  #747**, confirming no effect data moved.

### Clauses omitted rather than substituted — the ruled set is eight rows

Eight rows carry a machine clause whose meaning is absent from that row's own `bodyText`, so under
Ruling 3 the clause is dropped and nothing is invented in its place. `bodyText`, effect templates,
`specialFlag` and every mechanical value are unchanged on all eight.

The arithmetic, stated explicitly because this issue's row sets have been miscounted more than once:
the Product Owner's original list of eight, **minus `fire_energy|whole_body|03`**, **plus
`firearms|head|07`** — eight rows.

| row       | clause omitted |
| --------- | -------------- | --- | ------------------------------------------ |
| `firearms | arm            | 08` | both `embedded_shot` and `extraction_risk` |
| `firearms | chest          | 06` | `extraction_risk`                          |
| `firearms | chest          | 07` | `extraction_risk`                          |
| `firearms | abdomen        | 06` | `extraction_risk`                          |
| `firearms | abdomen        | 07` | `extraction_risk`                          |
| `firearms | upper_leg      | 05` | `embedded_shot`                            |
| `firearms | lower_leg      | 05` | `embedded_shot`                            |
| `firearms | head           | 07` | `permanent_fel_loss`                       |

On the four `firearms|chest|06/07` and `firearms|abdomen|06/07` rows only `extraction_risk` is
omitted: the prose does support "shot lodged". `firearms|arm|08`'s prose/flag contradiction remains
filed as **#756** and is not decided here.

#### `firearms|head|07` — ratified

This row was not on the original list. It was measured by this lane: its prose — "Your shot blows
off your opponent's nose… the pain and obstruction to vision gives your target a -10 modifier to
all 'to hit' rolls" — never states a Fel loss, unlike sibling `arrows_bolts|head|07`, whose prose
says "reduces the character's Fel score by -20 permanently". Writing "permanent Fel loss" there
would derive prose from `specialFlag`, which Ruling 3 forbids. Product Owner ruling:

> Ratify omission of the `permanent_fel_loss` clause. The row's own `bodyText` does not support
> that consequence, so **it must not be promoted into reader-facing title prose. Leave the
> remaining title `Nose destroyed; gunshot` unchanged in #747.**
>
> The `gunshot` clause represents a **separate class**: underscore-free tag-derived wording that is
> readable but potentially awkward. **Do not broaden #747 to remove or rewrite such clauses.** File
> a follow-up characterization for underscore-free tag-derived title fragments such as `gunshot`,
> including how many rows are affected and whether the terms add useful reader-facing information
> or merely expose source tags. **Do not hold #747 on that follow-up.**

So the title stays `Nose destroyed; gunshot`, and **no underscore-free tag-derived fragment anywhere
in the 91 was removed or rewritten** — `gunshot`, `mauling`, `pinned` and `unconscious` are
preserved exactly where they already stood. That class is characterized separately and does not
hold this lane.

#### `fire_energy|whole_body|03` — removed from the omission set

This lane executed the directed omission while reporting that the clause looked derivable, and that
reading was upheld. Product Owner ruling:

> Remove this row from the non-derivable omission set. **Preserve the clause in the reader-facing
> title as: `deafened by blast or lightning`.** The row's own authored `bodyText` explicitly
> supports it, and sibling rows 04/05 already use the same wording. **This is not a new rule or an
> override of the prior principle; it corrects the factual premise used to classify this one row.**

The row's prose reads "If the critical was caused by an explosion or lightning, the victim is also
deafened for D6 rounds", exactly parallel to 04's "deafened for D10 rounds". The clause was always
derivable and the row should never have been classified as non-derivable. Its title now reads
`Concussion or blast shock; no action / unconscious; deafened by blast or lightning; whole-body
trauma`, matching siblings 04 and 05 word for word in that clause.

### `CritSlots` title equivalence — achieved narrowly, with one inherited divergence

`scripts/generateCriticalEffectsTable.mjs` now reads `CritSlots` and asserts that every Critical
identity the two sheets share carries the same title. It is one source constant, one entry in the
existing sheet list, one assertion function and one call in `main()`; no generator or worksheet
model was redesigned, and nothing from `CritSlots` enters the generated payload or the manifest.
The assertion is enforced by `critical-effects:verify`, which `criticalEffectsGeneration.test.ts`
spawns under `pnpm test`.

Enabling it surfaced a pre-existing divergence: **#741 authored its 15 `Fatal <family> head
critical` titles in `AppFacing_Crits` but never carried them into `CritSlots`**, which still holds
the machine stems at `CritSlots!E30/32/33`, `E126/128/129`, `E222/224/225`, `E318/320/321` and
`E414/416/417`. Those identities are outside #747's authorized scope, so they are recorded as
tolerated divergences pinned to their exact stale strings rather than edited by this lane. An entry
stops applying the moment the row is synchronized, and any _other_ change to one of those rows fails
like any other divergence. **The remaining synchronization needs its own issue.**

The guard was falsified three ways, each by exit code: restoring `lower_arm` in `CritSlots` for one
of the 91, altering a tolerated row to a different stale string, and drifting an unrelated
`CritSlots` title.

### `criticalInjuryFixtures.ts` pulls content live while asserting frozen v13 provenance — #758

`fixtureSource` in `packages/domain/src/encounter/criticalInjuryFixtures.ts` calls
`getCriticalResultWithEffects` and spreads the **live** Critical table's whole `result` object into
the fixture, while the same function **hardcodes** `workbook: …v13.xlsx`,
`workbookSha256: 47cde37d…` and `tableVersion: "app-facing-v13"` — and
`criticalInjuryDomain.test.ts` asserts that attribution. The module is a hybrid: **frozen
provenance, live content.**

One of its six fixture keys is `sharp|arm|11`, which is among #747's 91. So #747 is the first lane
to move live fixture content, and `DURATION_STRIPPED_FIXTURE_GOLDEN` moves with it. #741 did not hit
this because none of its 15 keys is a fixture key.

**Updating that golden inside #747 was the wrong fix, and it is not applied here.** It would have
left the fixture asserting that a title which never existed in v13 "came from workbook v13 at digest
`47cde37d…`" — a manufactured verifiable falsehood in live code, of exactly the class the
`source_trace` and `validation-summary.json` rulings exist to prevent. #741's QA reasoned that these
fixtures "assert against their own constants, never the live file"; that is true of the digest and
**false of the content**, and the hybrid is what makes the reasoning fail. Three reviewers read the
file and all three missed the split, because each asked whether the fixture could mask a _title
regression_ rather than assert a _false provenance_.

The cause is therefore fixed upstream under **#758**, which snapshots the v13 content into the
fixture, recovered from the preserved v13 artefact and mechanically proved against it. After that the
fixture no longer reads the live table and this golden does not move at all. **`criticalInjuryDomain.test.ts`
is byte-identical to `dev` on this branch**, and #747 is rebased onto #758 rather than compensating
for it.

### Regression guard against tag-value leakage

`criticalEffectsTable.test.ts` gains four assertions that bind the _values_, not the field names:
no title contains a `snake_case` run; no title contains an underscored `sourceSpecialTags` value
used anywhere in the table; no title contains an underscored per-effect `specialFlag` value; no
title contains a `location` enum value in its raw underscored form. They are derived from the
dataset, so a newly authored row leaking a new tag fails too.

**The guard is bound to underscored values deliberately.** Several tag and flag values are single
ordinary English words — `unconscious`, `collapse`, `death`, `dying`, `scar`, `amputation` — which
the authored titles publish correctly ("no action / unconscious", "instant death"). A first,
unrestricted form of this guard indicted **399** such titles, none of them defective; the data was
right and the check was wrong. Underscore-bearing is the shape that is never reader-facing.

Falsified by reintroducing each of `lower_arm unusable`, `permanent_dex_loss`,
`whole_body unusable`, `blind_one_eye`, `embedded_missile` and `whole_body_trauma` into one title in
the committed data file: all six failed the guard, each mutation verified as applied and then
reverted byte-identically.

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
which is false. **The 2,787 historical trace pins were not updated merely to make every digest
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
