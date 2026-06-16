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
D1/D2 review rows that describe the character-sheet rows the GM is about to commit.

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

Current supported proposals are:

- Drop item: creates a special combat/session effect row on commit. It does not remove the item from
  permanent inventory.
- Cancel pending action: marks an unrolled pending A1/A2 attack in the same round as cancelled or
  skipped by the committed damage command. The original declaration and generated phase modifiers
  remain, because the combatant already committed to the risky action.
- No combat action possible: creates a visible special combat effect row for clear incapacitating or
  no-action results. The row is active immediately, but broad next-round incapacitation gating remains
  future work.
- Note: used when the critical is clear but the app cannot safely identify the held item or pending
  attack.

These consequences are review drafts. The GM may uncheck or edit them before committing phase
damage. Undoing the commit removes the created special rows and cancellation marker, restoring the
pending attack; undoing the critical roll removes the generated consequence drafts with the rest of
the critical proposal.

## Rolls inside critical effects

The player's critical roll remains the attacker-privileged `2d8` roll recorded in D1/D2. After that,
some critical effect templates require additional random values such as duration or bleed rate. The
app rolls those table-contained dice during proposal creation and stores the roll reports with the
proposal for audit.

Examples:

- A duration roll such as `d4` or `d6` is rolled by the app and can populate an editable duration.
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
round ends. SU builds GM-reviewable round-end proposals before the next round can start.

At SU:

- Active round-duration effects propose a one-round duration decrease; effects that reach zero
  propose removal or deactivation.
- External bleed that is due proposes general damage and a Health check at difficulty `21`.
- Internal bleed that is due proposes general damage and a Health check at difficulty `26`.
- Health checks use open-ended `1d20 + Health`; the GM can edit the difficulty before rolling.

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
- Current combat hit locations map directly for head, chest, abdomen, and arm. Whole-leg hits remain
  ambiguous because the critical table distinguishes upper leg and lower leg.
- The final numeric critical roll maps directly to critical index `1` through `16`. Values of `0` or
  lower mean no critical effect. Values above `16` are unsupported and are not clamped.

The GM may override the reviewed critical index without rerolling the stored critical dice. Choosing
`1` through `16` rebuilds the table proposal for that index; choosing no effect removes generated
critical proposal rows while leaving the original dice and computed final roll available for audit.

GM review remains required before any critical-derived effect rows are committed. The review is
outcome-focused: it shows proposed physical damage, modifier, bleed, internal bleed, fatigue,
no-action/loss-of-use, dropped-item, and special-note rows before commit. Bleed and internal bleed use
the existing typed combatEffect rows when a safe rate is available. Clear no-action, collapse, and
unconscious results become special rows such as "No combat action possible" rather than arbitrary DB
modifiers. Ambiguous numeric or prose-heavy rows become special notes and keep their source text for
GM review instead of being guessed as a mechanical modifier. Automatic permanent injury and long-term
incapacitation automation remain future table-driven work.
