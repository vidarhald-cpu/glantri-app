# Glantri Combat To Hit / Damage

This page records the canonical hit/miss/grazing rule table for combat to-hit lookup and wires GM
Phase 1 and Phase 2 attack rolls to that table. D1/D2 damage resolution first creates a reviewable
damage result proposal for hits after a failed parry. Committing that proposal writes source-linked
combat-effect rows for the defender. The proposal now includes hit location plus compact GM review
overrides for location, armor, total damage, critical grade, notes, and manual immediate effect
rows. Critical-effect automation, bleeding, full injury typing, and live armor-location equipment
lookup remain future work.

## Hit lookup

Roll open-ended `1d20`, using the same open-ended convention as skill rolls.

- An initial `20` opens upward: add `d10` rolls until a `d10` is not `10`.
- An initial `1` opens downward: subtract `d10` rolls until a `d10` is not `10`.
- The final roll total can be negative.

Use:

```text
hit lookup total = OB - DB + open-ended roll total
```

The canonical structured Glantri Combat To Hit / Damage table lives in Admin -> Tables. That table is
the source used by to-hit helpers; this page only explains how the rule is intended to be read.

Current hit/miss classification:

- Lookup totals of `10` or less miss.
- Lookup total `11` is a grazing hit.
- Lookup totals of `12` or more hit.

Damage metadata is available for hits and grazing hits. Lookup totals `17` and `18` are resolved in the
current table. Lookup totals above the displayed table continue by adding `1` damage per row, keeping
critical grade `F` and minimum damage `5`.

For a normal hit, calculate a second lookup before reading final damage:

```text
damage lookup total = hit lookup total + weapon DMB + defender DM + armor modifier
```

The damage lookup row gives final table damage, critical grade, minimum damage, and any max-damage
note. For example, `OB 10 - DB 15 + roll 19 = hit lookup 14`; with weapon DMB `8`, defender DM `0`,
and armor modifier `0`, damage lookup is `14 + 8 + 0 + 0 = 22`, so the table gives damage `9`,
critical `B`, and minimum damage `1`.

Grazing-hit damage does not use a fixed row modifier. A grazing hit at hit lookup `11`
uses hit lookup `12` as its reference, then applies the same DMB, defender DM, and armor modifier to
find the reference damage lookup row. The grazing hit rolls `1dX`, where `X` is that reference row's
table damage. For example, weapon DMB `8`, defender DM `0`, and armor modifier `0` make the reference
damage lookup `12 + 8 + 0 + 0 = 20`; row `20` gives table damage `7`, so the grazing hit rolls `1d7`.

## Current attack and damage result

The GM Combat inspector can roll Phase 1 and Phase 2 attacks for hit/miss/grazing. The result is stored
in the combat round state and committed P1/P2 snapshots preserve the historical open-ended roll
breakdown, roll total, OB, target DB, lookup total, and table result.

Target defense currently uses the target participant's encounter-context DB for the matching phase:
combined DB when available, otherwise DB, with phase-aware General/Fatigue and DB/Parry modifiers
applied by the existing combat panel read model.

Attack result lines show final modified OB and DB totals without exposing the opponent's individual
modifier breakdown.

After a failed parry, D1/D2 can resolve and store a damage proposal:

```text
hit lookup total = OB - DB + open-ended roll total
hit location = closed 1d20, or two closed 1d20 rolls when an aimed location was declared
damage lookup total = hit lookup total + weapon DMB + defender DM + armor modifier
damage = table damage at the damage lookup total
```

The attacker rolls hit location. If no aimed location was declared for that attack phase, roll one
closed `1d20`. If the attacker declared an aimed location, roll closed `1d20` twice and use the
result whose selected body location is closest by table order. If both rolls are equally close, use the first
roll. The proposal stores the aimed location, all hit-location rolls, the selected location, and why
that selection was made.

For grazing hits, the required roll is the final damage result. Weapon DMB, defender DM, and armor are
used with reference hit lookup `12` to derive the grazing die size, then only the grazing roll total is
stored as damage.

The armor modifier table is available as structured rule data and participates in damage lookup when a
safe armor source is provided. Current D1/D2 proposals keep live armor modifier at `0` and display
armor as not applied until exact hit-location-to-equipped-armor wiring is safe. Critical grade and
minimum damage are stored as table metadata when present, but critical effects remain a GM review note
for now.

During D1/D2 review, the GM may record compact overrides without replacing the computed proposal.
Review fields can override selected hit location, armor modifier, total damage, and critical grade;
they can also carry notes and manual additional effect rows. Additional effect rows can be immediate
modifier, fatigue, special, or note rows. Modifier rows use the existing General/Fatigue, OB/Skill,
and DB/Parry live modifier groups; special and note rows are descriptive until the GM adds explicit
modifier values. The effective damage preview is recalculated from the reviewed armor modifier and
selected location where applicable. For grazing hits, changing armor can change the reviewed die size;
if the original grazing roll no longer fits that die, the GM must enter a total damage override before
commit.

The proposal is not applied until the GM uses Commit phase damage. That command writes one
combat-effect event and, when total damage is positive, one active `general_damage` effect row for
the defender using the effective reviewed values. It also writes one active row for each reviewed
additional effect. The rows are source-linked to the command by deterministic event/effect IDs, and
GM review notes are carried into the commit description. Phase-one committed rows are part of the
participant's live JSON-backed combatEffects state before phase two continues, so reviewed modifier
rows affect phase-two combat values where the existing live modifier path supports them. Clear unwinds
this in two visible steps: first removing only the committed rows and returning to the D1/D2 proposal
with review overrides and additional effects intact, then removing the proposal and returning to
pending damage review.

The intended final-damage sequencing remains:

1. Attack hit/miss/grazing.
2. Parry.
3. Hit location with closed `1d20`; if the attacker selected a target location, roll twice and choose
   the result closest to the target.
4. Armor modifier from hit location plus the armor modifier table when a safe equipped-armor source is
   available.
5. Final damage/effect proposal, manual immediate effect review, and GM commit.
