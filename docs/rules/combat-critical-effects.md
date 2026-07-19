# Glantri Critical Effects

Critical effects are represented as a canonical table of critical results and effect templates.
D1/D2 now uses that table to create GM-reviewable proposals after the attacker has rolled the
critical die. The proposals are editable draft rows; they are not committed until the GM accepts them
through the normal phase-damage commit.

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

GM review remains required before any critical-derived effect rows are committed. The review is
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
