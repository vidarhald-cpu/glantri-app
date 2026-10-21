# Target Critical catalogue V1

This directory is the complete, non-runtime target Critical catalogue prepared by Forgejo #216.
It is rules/content authority for later implementation planning and exact-head QA. It does not
replace the production Critical table, generated runtime data, representative fixtures, Combat
code, persistence, schemas, migrations, armor arithmetic, or current executable behavior.

## Authority and source boundary

The executable authoring contract is Forgejo #216 at accepted baseline
`dev@dda76a24d0d8456944656348cfdaece3755c3b3c`. The controlling common rules are
[Rule Decision 0005](../../../decisions/rules/0005-critical-effect-semantics-and-timing.md) and
[Combat Round End & Review V1](../../../architecture/combat-round-end-review.md). The source
workbook and existing conformance reports are provenance and calibration evidence. They do not
override the approved target rules.

Current authoritative Critical source, per #741:

- path: `docs/source/combat/Glantri_CriticalEffects_AppFacing_v14.xlsx`;
- SHA-256: `3c368646ed0c50da8e18d2fa04774d18f6ad9c991adcd8e2fe3c2515f3c14c8c`;
- result range: `AppFacing_Crits!A1:X609`;
- effect range: `AppFacing_Effects!A1:AE2180`.

The reader-facing `outcome_name` and `player_prose` of the 15 Critical head results corrected
under #741 follow this current source. See
[Critical source authority](../../../audits/critical-source-authority.md).

Source workbook this catalogue was produced from, retained as provenance and not rewritten:

- path: `docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx`;
- SHA-256: `47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f`;
- result range: `AppFacing_Crits!A1:X609`;
- effect range: `AppFacing_Effects!A1:AE2180`.

Every `source_trace` block in `catalogue.jsonl` and `source-dispositions.jsonl` refers to that
v13 source. Those traces describe the source state captured when the records were produced and
are deliberately not rewritten to v14.

## Package

- `catalogue.jsonl` contains one complete authored object for each of the 608 target keys.
- `catalogue.schema.json` describes the entry envelope and frozen axes.
- `source-dispositions.jsonl` contains one complete snapshot and final disposition for each of the
  2,179 historical effect rows.
- `interaction-ledger.jsonl` records cross-source stacking, timing, treatment, conditional, and
  exception behavior using catalogue consequences that actually exist.
- `distribution.csv` contains catalogue-wide result incidence by family, location, and band. Its
  Bleed-rate columns include only `periodic_loss` consequences whose semantic is `bleed`; non-Bleed
  Fire/Energy loss remains separate target content.
- `distribution-report.md` explains the distribution review and normalization.
- `canonical-examples.md` provides future implementation/QA fixture authority.
- `unresolved-items.md` distinguishes catalogue completeness from external activation boundaries.
- `validation-summary.json` records exact counts, source coverage, and payload hashes.

The linked rule summary is [Target Critical catalogue V1](../../../rules/target-critical-catalogue-v1.md).
The linked verification record is
[Target Critical catalogue V1 audit](../../../audits/target-critical-catalogue-v1.md).

## Frozen key space

The key is `family|location_scope|NN`, where `NN` is the resolved Critical result index `01`–`16`.
Critical grade A–F is an input to resolution, not a catalogue axis.

- `sharp`, `blunt`, `pointed_weapons`, `arrows_bolts`, `teeth_claws`, and `firearms` each have
  `head`, `arm`, `chest`, `abdomen`, `upper_leg`, and `lower_leg`: 576 keys.
- `falling_crushing|whole_body|01–16`: 16 keys.
- `fire_energy|whole_body|01–16`: 16 keys.
- Total: 608 keys. No other combination is supported.

The authoring bands are Minor 01–03, Moderate 04–06, Serious 07–09, Severe 10–12,
Catastrophic 13–14, and Fatal 15–16. `lower_leg|15–16` is the explicit exception and remains
Catastrophic. A band describes combined burden; it does not manufacture death or incapacity.

Left/right is encounter context. Narrow anatomy may appear as a structured target without creating a
new selector location.

## Entry envelope

Each line of `catalogue.jsonl` is a self-contained JSON object:

- `key`, `family`, `location_scope`, and `result_index` record the frozen address.
- `authoring_band` records the target calibration band.
- `outcome_name` and `player_prose` are concise readable content.
- `gm_prose` is a rendering of the structured target consequences. It is not an independent source
  of mechanics.
- `structured_disposition.consequences` contains every application-relevant fact.
- `structured_disposition.treatment_interactions` records source-specific events without inventing a
  treatment Skill or generic cure.
- `source_trace` preserves the exact workbook result row, every exact effect row range, and the raw
  historical result snapshot.
- `normalization_notes` explains entry-local retirement or successor-rule changes.
- `diagnostic_burden_score` supports distribution review only. It is not a game mechanic.

Every consequence has a stable entry-local `id`, source-effect keys, exact source ranges, visibility,
target status, and the explicit runtime boundary `not_authorized_by_issue_216`.

## Consequence grammar

The target keeps the six consequence kinds established by Decision 0004:

1. `damage_floor`: minimum total damage; never a second damage stream.
2. `modifier`: Dazed, Stunned, or an ordinary named channel modifier.
3. `periodic_loss`: an exact source-specific Bleed or an explicitly non-runtime Fire/Energy loss.
4. `condition`: a durable semantic state on a structured target.
5. `operation`: a one-time event such as falling, dropping an item, or scheduling CE.
6. `information`: structured persistent, terminal, or anatomical content that has no authorized
   current runtime consumer.

Prose cannot add consequences. `mechanics_must_not_be_inferred_from_prose` is true in every entry.

### Named effects

- Dazed is always General `-2`.
- Stunned is always General `-4`.
- Independent sources coexist and add. Dazed plus Stunned is General `-6`; two independently
  sourced Stunned effects are General `-8`.
- The same event/source applied twice is an idempotency defect, not stacking.
- Duration belongs to the authored source. There is no generic Stunned or Dazed recovery roll.

Legacy numeric Stun `-1`/`-2` rows were normalized to Dazed where appropriate. Legacy `-4` rows were
normalized to Stunned. Legacy `-8` rows may create Dazed and Stunned as separate consequences rather
than changing the meaning of Stunned. Semantic action states were evaluated independently.

### Timing

One round is approximately three seconds. Fixed `N rounds` means the remainder of the creation round
plus N complete subsequent rounds. `remainder_of_round` is distinct from fixed one round.

The catalogue uses:

- fixed duration;
- rolled fixed duration resolved once on application;
- scheduled uncertain recovery, where the state persists until the due check resolves it;
- bounded uncertain recovery with an explicit maximum-check transition;
- condition/event termination; and
- persistent injury content.

All due Round End expiry and recovery work remains in the current round's visible Round End Effects
slot before GM Review. CE is the exception: every resolved Critical schedules a fresh roll for the
next CE pre-phase, while the current CE state persists until replaced.

### Bleed and treatment

Every external or internal Bleed is an independent exact rational source. The first full accrual
occurs only after one complete subsequent round. Aggregate HP loss may add active rates, but the
sources retain independent type, treatment state, recovery, history, and provenance.

External lifecycle: `active -> controlled -> staunched -> resolved`.

Internal lifecycle: `active -> stabilised -> resolved`.

Treatment events affect only the source that names them. Treating Bleed does not remove Dazed,
Stunned, function loss, or another wound unless an authored consequence explicitly links them. No
automatic Health-every-ten-rounds behavior is present.

## Source dispositions

`source-dispositions.jsonl` contains the exact historical row under `source.row`, its exact workbook
range, a final disposition, target consequence IDs, and a rationale. The permitted dispositions are:

- `retained_as_mechanic`;
- `normalized_as_mechanic`;
- `retained_as_non_runtime_content`;
- `normalized_as_non_runtime_content`; and
- `retired_legacy_shorthand`.

Retirement is explicit and reasoned. It is used only where a successor rule or accepted content
boundary rejects the source shorthand. No row is omitted. There are no unresolved source-row
dispositions.

## Normalization choices

- Source minimum-damage floors are preserved exactly.
- Legacy dice-per-round Bleed and death-timer rates are replaced by exact fractions calibrated by
  external/internal type, anatomy, and band. The maximum ordinary external rate is `3/4 HP/round`;
  the maximum ordinary internal rate is `2/3 HP/round`.
- Unsupported global action locks are replaced by named effects and independently justified
  localized conditions. Automatic unconsciousness is limited to source-supported central trauma.
- `sharp|chest|04` and `blunt|chest|04` are the only `action_limited_to_parry` outcomes.
- Lower-leg 15–16 legacy terminal shorthand does not survive as terminal content.
- Fire/Energy cause conditionals remain inside outcomes. The approved 06, 09, and 10 non-Bleed loss
  rates remain structured target content but are explicitly non-runtime.
- Persistent injury and terminal outcomes are structured target content. Issue #216 does not
  authorize a runtime consumer, persistence model, or migration for them.

## Review and validation

The checked-in validation record proves exact key count, approved combinations, prose coverage,
structured coverage, source accounting, and payload hashes. `distribution.csv` and the distribution
report review incidence and burden without imposing quotas. Later implementation must consume this
package through a separately authorized design and must not silently copy historical source prose or
current runtime mappings as target mechanics.
