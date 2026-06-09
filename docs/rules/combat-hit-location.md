# Combat Hit Location

This rule records aimed hit-location declarations and resolves hit location during D1/D2 damage
proposal creation. It does not automate critical effects, injury typing, bleeding, or live equipped
armor interaction yet.

## Closed 1d20 location roll

If an attack hits and reaches D1/D2 damage proposal, the attacker rolls a closed `1d20` for hit
location. There is no open-ended behavior.

The canonical structured hit-location table lives in Admin -> Tables. That table is the source used
by hit-location helpers; this page only explains how the rule is intended to be read.

## Aimed location

If the attacking character declares an aimed location for that phase, roll `1d20` twice and use the
roll whose selected body location is closer to the aimed location in table order. If both rolls are
equally close, use the first roll.

Target location is phase-specific declaration context. Phase 1 and Phase 2 may aim at different
locations, and damage proposal resolution reads the target from the matching phase context.

The proposal stores the target location when present, the closed d20 rolls, the selected hit
location, and whether the selection came from a single roll or targeted closest-roll selection.
