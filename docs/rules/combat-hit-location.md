# Combat Hit Location

This first pass records aimed hit-location declarations and exposes pure helper rules. It does not
resolve attacks, damage, criticals, or armor interaction yet.

## Closed 1d20 location roll

If an attack hits, roll a closed `1d20` for hit location. There is no open-ended behavior.

The canonical structured hit-location table lives in Admin -> Tables. That table is the source used
by hit-location helpers; this page only explains how the rule is intended to be read.

## Aimed location

If the attacking character declares an aimed location for that phase, roll `1d20` twice and use the
roll closer to the aimed location. Distance is measured to the nearest die result in that location's
range. If both rolls are equally close, use the first roll.

Target location is phase-specific declaration context. Phase 1 and Phase 2 may aim at different
locations, and future attack resolution should read the target from the matching phase context.
