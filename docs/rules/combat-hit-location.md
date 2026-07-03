# Combat Hit Location

This rule records aimed hit-location declarations and resolves hit location as an explicit D1/D2
substep before damage proposal creation. It does not automate critical effects, injury typing,
bleeding, or live equipped armor interaction yet.

## Closed 1d20 location roll

If an attack hits and reaches D1/D2, the attacker rolls a closed `1d20` for hit location before the
damage proposal is calculated. There is no open-ended behavior. The GM can roll on behalf of any
attacker; a player can roll only for their own attacking participant and does not get a reroll or
Clear control.

The canonical structured hit-location table lives in Admin -> Tables. That table is the source used
by hit-location helpers; this page only explains how the rule is intended to be read.

Leg results are split before damage and critical lookup:

- roll `1` selects lower left leg
- rolls `2-3` select upper left leg
- roll `4` selects lower right leg
- rolls `5-6` select upper right leg

The side remains part of the combat hit location for display and damage rows. Critical-effect lookup
uses upper leg or lower leg from that selected sublocation.

## Aimed location

If the attacking character declares an aimed location for that phase, roll `1d20` twice and use the
roll whose selected body location is closer to the aimed location in table order. If both rolls are
equally close, use the first roll.

Target location is phase-specific declaration context. Phase 1 and Phase 2 may aim at different
locations, and damage proposal resolution reads the target from the matching phase context.

The `roll_hit_location` command stores the target location when present, the closed d20 rolls, the
selected hit location, and whether the selection came from a single roll or targeted closest-roll
selection. The later damage proposal consumes that stored location result. Clear unwinds later
commands first; after proposal and critical commands are undone, undoing `roll_hit_location` removes
the location result and returns D1/D2 to location pending.
