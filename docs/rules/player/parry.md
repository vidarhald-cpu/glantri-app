# Parry — Player Rules

Parry is an untargeted primary Combat action. Choose it to spend the declared round focused on
defense.

## Declare Parry

1. Choose **Parry** as the primary action.
2. Do not select an opponent, attack target, weapon attack source, attack mode, or outgoing attack.
3. Optionally leave the secondary action open or add
   [Observe Opponent](../observe-opponent.md), which keeps its own Phase 1 target and result.
4. Confirm the declaration. The declaration is blocked if the participant has no canonical Dodge
   skill total.

## Result Available At Declaration

The app immediately derives one Parry percentage modifier from the participant's total Dodge skill
and shows it in declaration preview and modifier review.

|             Total Dodge | Parry modifier |
| ----------------------: | -------------: |
|                     0–4 |            +0% |
|                     5–9 |            +1% |
|                   10–14 |            +2% |
|                   15–19 |            +3% |
|                   20–24 |            +4% |
| Each additional 5 Dodge |            +1% |

The rule uses one fifth of total Dodge, rounded down. For example, Dodge 17 produces **+3%**.

The percentage is not a flat three-point bonus to the final Parry total. During an incoming-attack
Parry, the app combines this percentage with the other current modifiers and presents the resolved
values and result.

There is no standalone success chance at declaration: Parry adds a known modifier to a later
incoming-attack check. Once that attack's permitted inputs are known, the GM procedure exposes the
required total and success boundary.

## What The Declaration Does

- The modifier applies to ordinary incoming-attack Parry calculations for the declared round.
- Reconfirming the declaration replaces the existing Parry modifier instead of adding a duplicate.
- Undoing the declaration or ending the round removes the modifier.
- Parry creates no Phase 1 or Phase 2 attack opportunity and no separate “Parry maneuver” roll.
- Existing movement declaration behavior is unchanged.

The GM resolves an incoming attack using the [GM Parry procedure](../gm/parry.md).
