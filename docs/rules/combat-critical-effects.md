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

The lookup key is `family|location|NN`, for example `sharp|arm|13`. Indexes above `16` are not
clamped; until a continuation rule is approved, they are treated as unsupported.

The result row keeps the full readable body text, title, mortality state, urgency, treatment
difficulty, treatment gate text, source tags, and flags for balance, stun, external bleed, internal
bleed, loss of use, and special handling.

## Effect templates

Each critical result can have one or more effect template rows. Templates are converted into editable
D1/D2 review rows where the current combatEffects system can represent them safely.

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

The proposal rule is:

```text
critical minimum extra = max(0, minimum total damage - already recorded damage)
```

This keeps normal damage, max-damage caps, hit location, and GM review as the main damage path.
Physical floor rows do not create a second normal damage row by default; if the floor exceeds the
already recorded damage, the proposal records a note for GM review.

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
- The final numeric critical roll maps directly to critical index `1` through `16`. Values outside
  that range are unsupported and are not clamped.

GM review remains required before any critical-derived effect rows are committed. Structured General,
OB/Skill, and DB modifier templates become editable modifier drafts. Prose-heavy special results,
stun/action states, bleed/internal bleed, mobility, loss of use, and treatment gates become editable
special or note drafts until richer typed effect rows are implemented. Automatic critical, stun,
bleeding, unconsciousness, and permanent injury automation remain future table-driven work.
