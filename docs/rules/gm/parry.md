# Parry — GM Procedure

Use this procedure to review a participant's primary **Parry** declaration and to proxy or review an
ordinary Parry check against an incoming attack. The defender owns the ordinary roll in Player
Combat; the GM is not its exclusive operator.

## 1. Validate The Declaration

| Check                     | Required result                                             |
| ------------------------- | ----------------------------------------------------------- |
| Primary action            | Parry                                                       |
| Target or outgoing attack | None                                                        |
| Canonical skill           | Total Dodge is available                                    |
| Secondary action          | Open, or a separately targeted Observe Opponent declaration |

On commit, the app stores one round-limited DB/Parry percentage modifier equal to one fifth of total
Dodge, rounded down. Review the generated row in declaration preview or modifier review. Recommit
replaces the row; declaration undo removes it.

## 2. Proxy Or Review An Incoming Parry

P1 follows a Phase 1 attack and P2 follows a Phase 2 attack. If the defender has no Parry source at
all, resolve the step as [2.1](#21-when-the-defender-has-no-parry-source) describes rather than by
the steps below.

1. If the attack missed, mark Parry not applicable; no damage resolution is required for that miss.
2. After a hit or grazing hit, confirm the defender-owned Current Action and its available main-hand
   and/or off-hand Parry sources.
3. Let the defender roll the open-ended `1d20` Parry check in Player Combat, or perform that Current
   Action as a GM proxy.
4. The app combines the Parry/P base with the calculated General/Fatigue, DB/Parry, stored
   attack-result, and declared-Parry adjustments.
5. Review the final total: **21 or higher succeeds; 20 or lower fails**.

| Resolved value           | Rule                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| Final Parry total        | Parry/P base + calculated modifier adjustment + open-ended roll total |
| Required open-ended roll | 21 − Parry/P base − calculated modifier adjustment                    |
| Success                  | Final total 21 or higher                                              |
| Failure                  | Final total 20 or lower                                               |

The app performs the workbook percentage composition. Use the displayed calculated adjustment and
final total; do not add the raw percentage inputs directly to the roll. The required-roll value is
the meaningful pre-roll threshold when all permitted inputs are known; the declaration by itself
does not have a success chance.

### 2.1 When The Defender Has No Parry Source

Sometimes nothing the defender is wielding can parry. A bow, a sling, a firearm, or a weapon that is
only thrown offers no Parry, and a Buckler or a Round Shield carries no Parry value of its own, so a
defender holding only those has no Parry source against the incoming attack.

After a hit or grazing hit, record that no Parry was available and continue straight to damage
resolution. Nothing is rolled at this step, and nothing takes the Parry roll's place: the defender's
Dodge and DB were already applied in deciding whether the attack connected, so that defence has
already had its effect on this attack and no further defence is resolved here.

Record the outcome rather than passing over the step. Reading the round back afterwards you should be
able to see that the Parry step was reached and that no Parry was available, instead of finding a gap
where the step belongs.

## 3. Clear Or Continue

| GM action   | Preserved result                                                               |
| ----------- | ------------------------------------------------------------------------------ |
| Clear A1/A2 | Removes dependent P/D state and the stored attack-result Parry modifier source |
| Clear P1/P2 | Resets Parry only and preserves the attack-result modifier for a reroll        |
| Clear D1/D2 | Preserves the attack and Parry results                                         |

## Current Operational Boundaries

The app does not yet allocate Parry sources across multiple opponents or automate expanded
two-source composition, the special minimum `+1`, positional restrictions, missile-specific Parry,
mandatory backward movement, blocked-retreat penalties, or terrain-space validation.

Do not treat these gaps as reconciled rules. Their source and implementation status, and the
unresolved Combat conflicts behind them, are recorded in
[Parry internal notes](../internal/parry-notes.md).

Player-facing declaration and incoming-roll instructions are in
[Parry — Player Rules](../player/parry.md).
