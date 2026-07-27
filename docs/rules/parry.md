# Parry

## Implemented declaration rule

Parry is an untargeted primary combat action. The participant spends the declared round focusing on
defense. It requires no opponent, attack target, weapon attack source, attack mode, or outgoing
attack opportunity.

The declaration derives one raw Parry percentage modifier from the participant's canonical total
Dodge skill:

```text
Parry modifier = floor(total Dodge skill / 5)%
```

For example, Dodge 17 produces `floor(17 / 5) = 3`, recorded as `+3%`. The result is not a flat
three-point Parry bonus. The raw percentage is consumed by the same workbook percentage-composition
helper as other combat modifiers.

The deterministic declaration-derived modifier:

- uses the stable source rule `parry-dodge-one-fifth`;
- appears in declaration preview and modifier review;
- is stored in the DB/Parry bucket with percentage application;
- applies to ordinary incoming-attack parry calculations;
- lasts for the declared round;
- is replaced, not duplicated, on recommit;
- is removed by declaration undo and round expiry.

The Dodge source is the stable `dodge` skill identity and its `effectiveSkillNumber`, which is the
canonical total combat-skill XP value. A declaration cannot be committed if that canonical skill is
unavailable.

Parry alone creates no A1 or A2 attack opportunity and no independent “Parry maneuver” roll.
Qualifying incoming attacks continue through the ordinary defensive-parry pipeline. Declaring
Parry does not change attack, parry, or dice formulas.

## Secondary action compatibility

Parry may be declared with an open secondary action or with Observe Opponent. Observe Opponent is a
secondary action, not a primary action, and owns a separate Phase 1 participant target. Its
directional relationship, round-boundary progress, opposed contest, best bonus, modifier
application, and player-safe visibility are specified in [observe-opponent.md](./observe-opponent.md).
Parry without that optional secondary action remains unchanged.

## Movement treatment

Existing movement declaration behavior is unchanged. The source assumes sufficient room for
defensive maneuvering, but terrain validation, forced backward movement, and the blocked-retreat
penalty are not implemented. The maneuvering-room assumption remains rules documentation rather
than explanatory prose beneath the declaration dropdowns; Current Action and precise validation
messages remain the places for actionable guidance.

## Explicitly deferred source rules

The following remain deferred unless already supplied by ordinary combat mechanics:

- combining two parrying weapons or a weapon and shield beyond existing source composition;
- special minimum `+1` treatment for weak parrying weapons;
- prioritization among multiple simultaneous incoming attacks;
- front, back, and side restrictions;
- missile-specific parry calculations;
- mandatory one-metre backward movement;
- blocked-retreat DB penalty;
- environmental space validation.
