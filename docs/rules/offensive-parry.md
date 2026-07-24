# Offensive Parry process

Implementation status: Slice 1 only.

The repository action identifier is `offensive_parry`; its user-facing label is **Offensive
Parry**. It is a declaration-time maneuver, not a display-text inference.

## Rule sources and interpretation

The maneuver and its parry-quality table are recorded in
`docs/rules/combat-action-rule-inventory.md` from the combat rules PDF, page 7. The verified
successful-parry margin mapping is:

| Successful parry margin | Brawling modifier |
| ----------------------- | ----------------- |
| 0–5                     | +0                |
| 6–10                    | +1                |
| 11–15                   | +2                |
| 16+                     | +4                |

The implementation follows the current product decision that declaring Offensive Parry gives the
declarer a flat **DB −2** for the declared round. This is deliberately distinct from the later
percentage-based Unbalanced modifier.

The post-parry opposed check uses the canonical `brawling` skill, the normal open-ended d20 roll,
and the existing opposed-roll convention: the higher final total wins. Equal totals produce no
winner, so Continued Contact is not established.

## Slice 1 sequence

1. A participant commits an `offensive_parry` declaration and selects one prepared opponent.
2. One generated, round-bound `flat_db` modifier applies DB −2. Recommit uses the same deterministic
   row identity and does not stack it.
3. Any qualifying canonical attack by that selected opponent against the declarer creates one
   proactive Offensive Parry task. The source attack does not need to hit, exceed DB, or enter an
   ordinary defensive-parry branch.
4. The task reuses the ordinary parry resolver, source, modifiers, dice, and success evaluation,
   but carries `parryPurpose: offensive_parry` and exact declaration/attack lineage.
5. If the proactive parry succeeds, one contest is created from the declaration ID, selected
   opponent ID, attempt ID, opportunity ID, attack-result ID, and parry-result ID. A failed attempt
   creates no contest.
6. A `parallel_all` execution group projects one participant-owned
   `offensive_parry_brawling_roll` task for each unresolved roller.
7. Each participant rolls Brawling for their own character; the GM may proxy through the same
   descriptor and endpoint.
8. After both rolls, the strict comparison resolves automatically.
9. If the Offensive Parry participant wins, one Continued Contact relationship and one Unbalanced
   condition are created. Otherwise neither is created and the attack process closes normally.

The contest belongs to P1 or P2, matching the triggering parry. It is not initiative or damage
work. A missed source attack remains composed-process work until this branch resolves, without
creating damage. For a hit, this task is the attack's one parry roll and retains ordinary successful
parry behavior; a duplicate defensive parry is not projected. Resolving this Slice 1 branch does
not create a follow-up attack and does not block the round for unimplemented maintenance.

## Canonical identities

The declaration stores the selected encounter-participant ID in
`combatContext.selectedOpponentId`. Recommit replaces that value; reload and undo use the persisted
declaration and never infer it from the latest attacker, encounter order, distance, cursor, or
inspector selection.

The proactive parry descriptor and request retain:

- encounter revision;
- task, execution-group, process, and stage IDs;
- maneuver declaration and selected-opponent IDs;
- attacker and defender IDs;
- phase;
- attack opportunity ID;
- attack-result ID;
- deterministic Offensive Parry attempt ID;
- parry purpose and parry-source identity.

The Brawling descriptor additionally retains:

- contest and parry-result IDs;
- controller/roller and opponent participant IDs;
- roll purpose `offensive_parry_brawling`.

No live layer resolves the trigger from participant plus phase, a cursor, inspector selection, or a
latest attack/parry.

## Continued Contact and Unbalanced

Continued Contact is a relationship:

- controller participant;
- affected participant;
- source declaration/action;
- source opportunity, attack result, and parry result;
- Brawling contest result;
- established round and phase;
- active status.

Unbalanced is a separate participant condition:

- affected participant;
- source Continued Contact and action;
- modifier value −2%;
- established round;
- active status.

The persisted Unbalanced effect contributes one `general` modifier marked `combatWide`. The shared
combat-wide resolver adds that row to initiative, attack/to-hit, DB/Parry, and non-Dodge maneuver
checks. Dodge-based Adjust Distance, movement Feint, and round-end distance contests already combine
general and skill buckets; the Offensive Parry Brawling contest uses the same contribution pipeline.
This preserves the narrower legacy behavior of ordinary general rows while making Unbalanced
combat-wide without adding Offensive-Parry-specific arithmetic to each formula.

Current modifier-path audit:

| Calculation | Unbalanced path |
| --- | --- |
| Initiative | initiative bucket + combat-wide general resolver |
| Attack/to-hit | Skill/OB bucket + combat-wide general resolver |
| DB and ordinary parry | DB/Parry bucket + combat-wide general resolver |
| Dodge and distance contests | existing combined general + skill resolver |
| Weapon Feint contest | combat-wide general resolver |
| Offensive Parry Brawling | existing general + skill resolver |

Disarm is not implemented, but it can consume the same combat-wide resolver later. No unsupported
currently implemented roll category required an Offensive-Parry-only calculation path.

The applicability contract carries excluded roll purposes. For the affected participant,
`escape_continued_contact` excludes the Unbalanced row itself. Other valid general, skill, or
situational modifiers remain applicable. The escape contest is not implemented in Slice 1.

## Presentation and privacy

Before the contest, Current Action identifies the committed attacker and asks the declarer to roll
Offensive Parry whether the source attack hit or missed. Tracker attention is owned by that exact
P1/P2 parry task. After success, Current Action asks each unresolved participant to roll Brawling.
The current-step result distinguishes interception of a missed attack from parrying a hit without
changing trigger eligibility, and records the broad comparison and visible
Continued Contact/Unbalanced consequence. The GM may inspect both rolls; a player receives their own
calculation and the broad opponent outcome, not the opponent's private dice/calculation.

The mechanics-only Brawling roll is not projected as new Combat Log narration.

## Deferred work

Slice 2:

- conditional Phase 2 attack opportunity;
- second-weapon requirements;
- automatic distance shortening where required;
- exact source/mode selection for the follow-up attack.

Slice 3:

- round-end Brawling maintenance/escape contest;
- the unpenalized escape roll using `escape_continued_contact`;
- continuation across later rounds;
- ending Continued Contact and removing Unbalanced;
- forward movement and forced-retreat consequences.

This document does not claim that the complete maneuver is implemented.
