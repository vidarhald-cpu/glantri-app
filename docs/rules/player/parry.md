# Parry — Player Rules

Parry is an untargeted primary Combat action. Choose it to spend the declared round focused on
defense.

## Declare Parry

1. Choose **Parry** as the primary action.
2. Do not select an opponent, attack target, weapon attack source, attack mode, or outgoing attack.
3. Optionally leave the secondary action open or add
   [Observe Opponent](../combat-round-and-actions.md#8-observe-opponent), which keeps its own
   Phase 1 target and result.
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
incoming-attack check.

## Roll Parry Against An Incoming Attack

An incoming Parry is a separate defender-owned Current Action. It can occur whether or not the
defender declared the primary Parry action; that declaration changes the modifier, not who owns the
roll or how it is resolved. If nothing you are wielding can parry, no Parry was available against
this attack and the round goes straight on to damage — see
[When the defender has no Parry source](../gm/parry.md#21-when-the-defender-has-no-parry-source).

1. After an incoming attack hits or grazes, open the Parry Current Action in Player Combat. A miss
   makes Parry not applicable.
2. Review the available Parry source and Parry input shown for the defender. The action cannot roll
   without an available source.
3. Roll Parry. Player Combat rolls the open-ended `1d20` and applies the current calculated modifier
   adjustment.
4. Read the final total and result: **21 or higher succeeds; 20 or lower fails**.

| Player-safe result | What is shown                                                                 |
| ------------------ | ----------------------------------------------------------------------------- |
| Parry input        | The defender's available Parry source and combined Parry/P score              |
| Modifier           | One calculated adjustment, without the opponent's individual modifier entries |
| Roll               | The initial `d20`, any open-ended dice, and their roll total                  |
| Result             | Final Parry total and “Parry successful” or “Parry failed”                    |

The GM may perform the same Current Action as a proxy and may review the result. The defender remains
the owner of the ordinary Parry roll.

## What The Declaration Does

- The modifier applies to ordinary incoming-attack Parry calculations for the declared round.
- Reconfirming the declaration replaces the existing Parry modifier instead of adding a duplicate.
- Undoing the declaration or ending the round removes the modifier.
- Parry creates no Phase 1 or Phase 2 attack opportunity and no separate “Parry maneuver” roll.
- Existing movement declaration behavior is unchanged.

GM proxy and review steps are in the [GM Parry procedure](../gm/parry.md).
