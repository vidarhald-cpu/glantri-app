# Observe Opponent

## Implemented V1 rule

Observe Opponent is a typed secondary action available only with the untargeted primary action
Parry. A declaration may contain at most one secondary action in V1:

```text
{ type: observe_opponent, targetParticipantId }
```

The canonical declaration retains the existing singular secondary-action fields while also
projecting the typed `secondaryActions` collection. This keeps persisted declarations without that
collection readable. Compatibility and target validation are server-owned: the target must be a
different, currently eligible encounter participant, and every primary combination other than
Parry is rejected.

Observation is directional. `A -> B` and `B -> A` are distinct relationships, and one observer can
hold independent relationships with several targets.

## Round-boundary progression

Observation advances at the completing round's SU boundary. The resolver reads only the active
round's canonical declaration and attack results.

A round counts when:

- the observer declared Parry plus Observe Opponent against the relationship target; and
- no attack by that target resolved as a hit against the observer during that round.

A hit suppresses only the current round's progress. It does not erase accumulated rounds or the
best bonus. A miss does not suppress progress.

The attempt schedule is:

| Completed attempts | Qualifying rounds required |
| ------------------ | --------------------------- |
| 0                  | 3                           |
| 1                  | 6                           |
| 2 or more          | 10                          |

The duration remains capped at ten qualifying rounds, so later attempts continue indefinitely.

When a threshold is reached, progression projects one observer-owned SU task. The observer (or a GM
proxy under the ordinary ownership rules) executes one canonical command. That command rolls the
observer and the hidden target server-side, records one opposed open-ended D20 contest, and creates
one accepted revision. The target receives no task. Each participant uses the better available
basis of Dodge or their highest applicable close-combat skill, recalculated with Intelligence
replacing the skill's ordinary linked characteristic. Canonical total skill XP remains the skill
contribution.

The observer's margin produces:

| Margin | Candidate bonus |
| ------ | --------------- |
| tie/loss or 0–5 | +0% |
| 6–10 | +1% |
| 11–15 | +2% |
| 16+ | +3% |

Every completed attempt resets progress and increments the completed-attempt count. The canonical
relationship retains `max(existing best, candidate)`, so a later weak or failed result cannot
reduce the bonus.

## Modifier ownership

The relationship is the only mutable source of observation progress and best bonus. The modifier
pipeline derives bounded, read-only contributions from it; no second general modifier is
persisted.

For an explicit observer/target pair, the best bonus is eligible once in the appropriate offensive
or defensive bucket:

- the observer's OB or offensive combat manoeuvre against that target;
- the observer's DB, Parry, Dodge, or defensive combat manoeuvre against an action by that target.

The reverse relationship, if any, is evaluated independently. Observation does not apply against
unrelated participants or checks.

For an ordinary attack, the canonical modifier signature includes the relationship contribution.
The attack command applies that opponent-specific percentage layer once to the already committed
phase/loadout OB and snapshots the concise contribution with the attack result. Validation,
resolved OB, calculation presentation, and history therefore use the same relationship fact
without persisting a duplicate modifier.

## Visibility and presentation

The observer sees each owned relationship's target, progress toward the next threshold, and best
bonus. Progress is compact Phase 1 declaration context; established pair-specific bonuses appear in
Combat modifiers. Every completed observation round records a concise, observer-only SU result:
updated progress, no progress after a qualifying hit, or period complete while the roll is pending.
The status event is stored before that observer's participant-SU-review completion event. A
completed contest remains before the completion event, replaces the pending period result without
duplicate narration, and appears in the completing round's SU results rather than as content in
the next round's declaration.

GM Combat retains both snapshotted calculation sides. The observer receives their selected skill,
skill XP, Intelligence value and adjustment, applied modifiers, open-ended roll facts, and result,
but never the hidden target calculation. Player-safe active-state and history projections remove
other observers' relationships and retain only the observer-safe latest attempt. Each projected
history round carries that archived round's relationship snapshot; historical panels never read
the mutable live relationship.

The opposed target receives no task, notification, roll result, or relationship disclosure merely
because an observation attempt occurred. GM Player Combat continues to use the same player-safe
projection as Player Combat.

## Persistence, reload, and undo

Relationships live in active `CombatRoundState`, carry into the next round, and are included in the
immutable completed-round snapshot. The relationship retains only the latest opposed resolution,
the completed-attempt count, progress, and best bonus; the active round retains its bounded attempt
result for SU presentation. The observer-roll command records the exact prior relationship as
compact undo facts. Non-threshold boundary progress uses the existing compact boundary inverse
facts. No previous round state, command history, or recursive snapshot is stored. This preserves
deterministic rollback and reload while keeping ordinary active persistence independent of archive
size.

## Deferred

V1 does not expose estimated OB, DMB, hit chance, safe-zone insights, declaration reading, Observe
with Direct Counter, arbitrary secondary actions, or speculative invalidation from equipment,
injury, style, or stance changes. The directional identity and player-safe relationship projection
leave room for later `insights` without changing progress or bonus ownership.
