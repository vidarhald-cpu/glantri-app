# Glantri Critical Effects

Critical effects are represented as a canonical table of critical results and effect templates.
D1/D2 now uses that table to create GM-reviewable proposals after the attacker has rolled the
critical die. The proposals are editable draft rows; they are not committed until the GM accepts them
through the normal phase-damage commit.

> **Accepted content versus implemented behavior:** the recovered #393 calibration in
> [`docs/decisions/rules/0001-c1-critical-injury-recalibration.md`](../decisions/rules/0001-c1-critical-injury-recalibration.md)
> is authoritative for future fixture activation, but the fixture code, workbook, generated data, and
> runtime described below remain at the pre-#393 implementation. In particular, the accepted
> Fire/Energy `1/4`, `1/3`, and `1/2 HP/round` values are content intent only. Executable non-Bleed
> `periodic_loss` is not authorized.

The exact five-key post-#393 recovery is now frozen as
[non-executable evidence](../recovery/2026-09-06-c1-five-key-post-393-payloads.json), with its
[per-key pre/post comparison](../recovery/2026-09-06-c1-five-key-freeze-and-staging.md). The future
six-kind authoring, immutable-canon/GM-delta, manual-provenance, Stun, ordinary-Bleed, treatment, and
presentation contract is [decision 0004](../decisions/rules/0004-c1-critical-authoring-and-adjudication.md).
Those records prepare future work for exactly five keys; they do not change the pre-#393 executable
behavior documented on this page.

## C1 representative fixture authority

Issue #377 freezes 34 representative C1 Critical definitions under fixture version
`c1-2026-08-28`. They are the small review set accepted from the #371 calibration ruling, not a
bulk activation of the 608-result catalogue. The exact key-to-coverage and source-range review table
is recorded in [the C1 fixture audit](../audits/c1-critical-fixtures.md).

The representative fixtures preserve the stable `family|location|NN` identities and record the
canonical suggested name/description, damage floor, one Stun at most, action-state conditions,
immediate operations, exact Bleed rate and type, treatment classification, unresolved information,
authority, runtime support, and initiative interpretation. D1/D2 now activates this fixture contract
server-side when the committed Critical key is one of those exact 34 keys. The other 574 catalogue
rows remain on the legacy path and are not C1-active; specialized families also remain unreachable
from ordinary Combat lookup unless an existing Combat result already addresses one of the 34 keys.

The accepted C1 rules are:

- One Critical creates at most one Stun. A numeric Stun applies its authored `-1`, `-2`, `-4`, or
  `-8` to OB/Skill, DB/Parry, and Initiative only. Separate Critical-source Stuns retain independent
  identity and add without a generic cap. Severity 5 is an explicit action state, not another numeric
  rung, and Stun never progresses automatically into unconsciousness.
- Initiative resolves highest first. A consequence created at initiative `7` does not affect a peer
  action at `7`: the whole equal-initiative group uses the same pre-group state. Once that group
  closes, an immediate consequence activates automatically for a still-unresolved, mechanically
  incompatible action at initiative `4`. A consequence created at `4` never reaches backward to an
  already-resolved action at `5`. Explicit `next_round` onset remains deferred and is never pulled
  forward by group closure. This ordering is canonical and is not a GM-editable suggestion.
- Conditions and operations are separate. `collapse`, `unconscious`, `prone`, `fall_to_ground`, and
  `drop_held_item` do not imply one another. Functional loss is target-specific unless an explicit
  result imposes a global action restriction. In the current server-authoritative pending-attack
  seam, a complete canonical weapon source establishes an arm/hand requirement. An unusable arm or
  hand can therefore invalidate that weapon attack. Movement, speech, perception, an unarmed source
  without canonical limb metadata, any otherwise unaffected-function action, and incomplete legacy
  source data remain valid unless a separate typed restriction applies. Labels and descriptive prose
  never manufacture a dependency.
- Ordinary Bleed exists and can be treated immediately, but its first periodic HP loss is at SU of
  the following round after one full three-second interval. Each external/internal source retains
  identity. Rates use exact rational arithmetic, add before whole-HP application, and carry exact
  remainder. Approved whole-body variable rates roll once when accepted and retain the numerator.
- External Bleed exposes `active`, `partial`, `staunched_zero`, and `resolved`; internal Bleed exposes
  only `active`, `stabilised`, and `resolved`. These states concern the periodic-loss process, not
  healing of the underlying injury. Internal Bleed never inherits generic pressure, partial-control,
  or self-staunch behavior.
- First Aid, Medicine, or Surgery is named only where the accepted treatment map explicitly supports
  it. Equipment, time, assistance, stabilization, and controlled removal remain separate facts.
  Generic `treatment` text remains GM-managed and creates no Skill check.
- Mortality, death clocks, permanent characteristic/function loss, recovery, hidden diagnoses, and
  legacy checks are information-only or unresolved in C1. Descriptive prose cannot activate those
  mechanics.

The accepted runtime stores every consequence with its Critical and source-effect identity. One Stun
source remains one durable effect even though its read-only calculation projection contributes to all
three channels. Separate source Stuns therefore add and can be resolved independently. Numeric Stun
does not cancel an action or imply collapse, parry-only, no-action, unconsciousness, or functional
loss; those are separate typed facts.

Descriptions are project-authored canonical GM suggestions. Narrative is not mechanics. Under the
future contract, an allowed GM review produces an instance delta and never rewrites canonical atoms;
the exact permitted and prohibited fields are enumerated in
[decision 0004](../decisions/rules/0004-c1-critical-authoring-and-adjudication.md). Current executable
review behavior remains pre-#393 until a separately authorized implementation is accepted.

## Reproducing the Critical table

The committed table data is generated from the approved Critical workbook snapshot under
`docs/source/combat`. Exact workbook, sheet, range, and column coordinates remain in the provenance
manifest so this Player/GM document does not expose internal source labels.

Run `pnpm critical-effects:verify` to validate the workbook, regenerate the table in memory, and
confirm that both the TypeScript data and provenance manifest are byte-stable. After an approved
workbook-only update, run `pnpm critical-effects:generate`, inspect the resulting diff, then rerun the
verification command. The generator refuses to overwrite differing Critical data by default; an
unexpected data difference is a content/rule checkpoint, not an invitation to normalize it.

`packages/domain/src/encounter/criticalEffectsTableManifest.json` records the workbook digest,
generator version, timestamp policy, source columns and ranges, transformations, output digests, and
full validation warnings with source cells. Fractional bleed rates, roll-once rates, death timers,
and unresolved Special/stateful mappings remain authored source values. Generation does not infer
bleed units, duration semantics, treatment behavior, or lifecycle rules.

The generator also compares every declared `AppFacing_Summary` breakdown with the generated payload.
Stale summary cells are recorded with exact source-cell, expected, and workbook values; they do not
replace generated-payload truth or authorize workbook edits. The exhaustive, rule-neutral mapping
inventory is checked in at `docs/audits/critical-effects-conformance.md`. Run
`node --import tsx scripts/reportCriticalEffectsConformance.mts --verify` to reproduce it, or use the
bounded `--generate` mode after an approved source/proposal diagnostic change and inspect the diff.

## Critical result lookup

Each critical result is addressed by three values:

- Critical family, such as sharp, blunt, arrows/bolts, pointed weapons, teeth/claws, firearms,
  fire/energy, or falling/crushing.
- Location scope, such as head, arm, chest, abdomen, upper leg, lower leg, or whole body.
- Critical index from `1` through `16`.

The lookup key is `family|location|NN`, for example `sharp|arm|13`. A final critical roll of `0` or
lower means no critical effect and does not generate table rows. Indexes above `16` are not clamped;
until a continuation rule is approved, they are treated as unsupported.

The result row keeps the full readable body text, title, mortality state, urgency, treatment
difficulty, treatment gate text, source tags, and flags for balance, stun, external bleed, internal
bleed, loss of use, and special handling.

## Effect templates

Each critical result can have one or more effect template rows. Templates are converted into editable
D1/D2 review rows that describe the character-sheet rows the GM is about to commit. The review shows
a short outcome summary, then the proposed rows themselves. Calculation details remain available as
audit information, but they are secondary to the outcome rows.

Supported effect Types in the current canonical data are:

- Physical
- Bleed
- Internal bleed
- Stun
- Special

Supported effect Groups in the current canonical data are:

- None
- General
- OB/Skill
- DB
- Bleed
- Stun/Action
- Mobility
- Special

Some recommended future dropdown values, such as Fatigue, Fear, and Morale, are reserved for later
rule work but are not currently present as effect rows.

Duration modes include instant, fixed, roll, ongoing, until treated, until staunched, mixed
until-treated-then-permanent, and special/stateful modes. Bleed rate modes include none, fixed
fraction, roll once for per-round rate, and death timer.

## Operational consequences

Some critical results clearly imply immediate combat consequences, such as dropping an item held in
the struck hand, losing use of an arm, collapsing, becoming unconscious, or otherwise becoming unable
to act. When the table provides clear drop-item, loss-of-use, or no-action signals and the app can
identify a matching pending same-round attack, D1/D2 review proposes operational consequence rows for
GM approval.

Operational consequences are shown separately from character-sheet rows. They primarily affect the
round sequence and command facts, such as cancelling a pending action. A consequence may still create
a visible combat/session effect when accepted, such as a dropped-item special row, but only when no
equivalent proposed character-sheet row already exists.

Current supported proposals are:

- Drop item: creates a special combat/session effect row on commit. It does not remove the item from
  permanent inventory.
- Cancel pending action: marks an unrolled pending A1/A2 attack in the same round as cancelled or
  skipped by the committed damage command. The original declaration and generated phase modifiers
  remain, because the combatant already committed to the risky action.
- No combat action possible: records the operational no-action consequence. If the critical proposal
  already has an equivalent no-action, loss-of-use, or parry-only character-sheet row, commit writes
  that row once and does not create a second operational special row. If no equivalent row exists,
  the accepted consequence may create one visible special row. Broad future-round action gating
  remains future work.
- Note: used when the critical is clear but the app cannot safely identify the held item or pending
  attack.

These consequences are review drafts. The GM may uncheck or edit them before committing phase
damage. Undoing the commit removes the created special rows and cancellation marker, restoring the
pending attack; undoing the critical roll removes the generated consequence drafts with the rest of
the critical proposal.

No-action deduplication is per D1/D2 commit event. "No combat action possible," "Action limited to
parry," and loss-of-use rows should appear once unless the critical table explicitly proposes
distinct visible effects. If a critical says the target is limited to parry next round, that specific
row is the visible action-state row; a generic operational "No combat action possible" row is not
also created for the same event unless the table separately states full no-action, unconsciousness,
or collapse. Operational pending-attack cancellation affects same-round sequencing, but does not by
itself create a generic no-action row when a more specific action-limited row exists. Covered
critical minimum damage floors are audit details that can raise the physical damage row; they do not
create separate character-sheet rows.

## Rolls inside critical effects

The player's critical roll remains the attacker-privileged `2d8` roll recorded in D1/D2. After that,
some critical effect templates require additional random values such as duration or bleed rate. The
app rolls those table-contained dice during proposal creation and stores the roll reports with the
proposal for audit.

Examples:

- A duration roll such as `d4` or `d6` is rolled by the app and can populate an editable duration.
  Effects whose source says they begin next round are stored with one extra countdown tick before SU:
  "next round" stores as `2`, and a next-round `D6` result of `3` stores as `4`.
- A rate roll such as `1d4` is rolled by the app once and stored in the proposal notes/roll report.
- Unsupported formulas are shown as proposal warnings rather than guessed.

## Physical handling

Physical critical rows do not create a second normal damage stream. They use the minimum total damage floor rule.

The commit rule is:

```text
final committed physical damage = max(reviewed physical damage, critical minimum total damage)
```

This keeps normal damage, max-damage caps, hit location, and GM review as the main damage path.
Physical floor rows do not create a second normal damage row. If the floor exceeds the reviewed
physical damage, the committed physical row is raised to that minimum and the event details record the
pre-critical damage, the floor, and the extra amount applied.

For example, if armor-adjusted damage is `2` and the critical table requires minimum total damage
`5`, the committed physical damage row is `5` and the event details note that `2` damage after armor
was raised to the critical minimum `5`.

## Round-end review

Critical-derived bleed, internal bleed, and round-duration rows are not silently advanced when a
round ends. When the active cursor reaches SU, the app automatically prepares the first
participant's GM-reviewable round-end proposals before the next round can start.

At SU:

- Active round-duration effects propose a one-round duration decrease; effects that reach zero
  propose removal or deactivation.
- For an active C1 exact Bleed, no periodic damage occurs in the creation round. The first accrual is
  at SU of the following round after one full three-second interval.
- All active C1 Bleed source rates for the participant are added as exact rationals before applying
  whole HP. SU creates one aggregate General-damage proposal and stores one reduced rational
  remainder on the participant Combat effect state. Source effects remain separate and independently
  resolvable. Reload/reconnect reuses both the retained source rates and the aggregate remainder.
- A C1 whole-body `d4`/`d6` rate rolls once when the Critical is committed. The retained roll and
  rational rate are persisted on that source and SU never rerolls it.

The following bullets describe the legacy non-C1 path only:

- Bleed values are tenths of HP per round. Bleed `1` means `1/10` HP per round, and bleed `10`
  means `1` HP per round.
- Each active bleed row accumulates its bleed value in tenths at SU. Only whole accumulated HP is
  proposed as General damage; any fractional remainder is stored on that bleed row for later rounds.
- External bleed health checks default to difficulty `21`; internal bleed health checks default to
  difficulty `26`.
- Health checks are proposed only every 10 rounds of ongoing bleed, or after first aid. First-aid
  action mechanics are deferred.
- Health checks use open-ended `1d20 + Health`; the GM can edit the difficulty before rolling.
- A successful Health check reduces the relevant bleed row by `1`. If that reduces the bleed value
  to `0`, the bleed row is expired. A failed check does not reduce bleed automatically.

The Health-check reduction above is never applied to C1 exact Bleed. C1 treatment read state preserves
only the fixture's explicit First Aid, Medicine, Surgery, staged guidance, equipment/removal boundary,
or GM-managed/unresolved classification. It does not manufacture a DC, Health substitution,
self-staunch chance, recovery duration, mortality clock, or permanent-stat effect from prose.

Start next round remains blocked until participant SU reviews and accepted health checks are
complete. Undoing SU review commands restores previous durations/statuses and removes only the
round-end damage rows created by those commands.

## Combat integration

D1/D2 records the pieces needed for critical-effect lookup:

- Damage table critical grade/type `A-F`.
- The final numeric critical roll from `2d8 + critical type modifier + armor critical modifier`.
- The selected hit location.
- The weapon's attack critical code / MC.

The critical table needs:

- Critical family.
- Critical location scope.
- Critical index.

Mapping policy:

- Weapon damage class maps safely to family: edged to sharp, pointed to pointed weapons, and blunt
  to blunt.
- MC-only fallback is allowed only for codes that are unambiguous in current weapon data. Ambiguous
  MC-only values such as `FS`, `EP`, and `FP` are shown as mapping warnings unless damage class is
  available.
- Current combat hit locations map directly for head, chest, abdomen, arm, upper leg, and lower leg.
  Legacy saved whole-leg hits remain ambiguous because the critical table distinguishes upper leg and
  lower leg; review those old results as upper or lower leg before applying critical effects.
- The final numeric critical roll maps directly to critical index `1` through `16`. Values of `0` or
  lower mean no critical effect. Values above `16` are unsupported and are not clamped.

The GM may override the reviewed critical index without rerolling the stored critical dice. Choosing
`1` through `16` rebuilds the table proposal for that index; choosing no effect removes generated
critical proposal rows while leaving the original dice and computed final roll available for audit.

GM review remains required before any critical-derived effect rows are committed. For one of the 34
C1 keys, commit resolves the accepted fixture into source-linked Stun, typed condition, exact Bleed,
and treatment read-state effects; the 574 inactive rows continue to use the legacy proposal mapping.
The review is
outcome-focused: it shows proposed physical damage, modifier, bleed, internal bleed, fatigue,
no-action/loss-of-use, and special-note rows before commit. Operational consequences are shown as a
separate compact checklist, not as duplicate proposed character-sheet rows. Bleed and internal bleed
use the existing typed combatEffect rows when a safe rate is available. Clear no-action, collapse,
and unconscious results become special rows such as "No combat action possible" rather than arbitrary
DB modifiers.
Ambiguous numeric or prose-heavy rows become special notes and keep their source text for GM review
instead of being guessed as a mechanical modifier. The full critical text is kept as reference for the
review event/reference, not copied into every effect row. The physical damage row keeps a compact
damage/armor/critical reference, while each effect row keeps one short actionable detail such as
"No combat action possible.", "No combat action possible next round.", "Action limited to parry.",
or "Internal bleed: 5/10 HP per round until treated." Duration and modifier fields are mechanical
fields: round durations are stored as numeric round counts when known, modifier rows store numeric
modifiers only, and non-round conditions such as "until treated" remain in the details/status text.
After the SU tick, a next-round row stored as `2` displays as duration `1` for the next round, then
expires at the following SU. Automatic permanent injury and long-term incapacitation automation
remain future table-driven work.
