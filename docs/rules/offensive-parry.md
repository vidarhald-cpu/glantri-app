# Offensive Parry process

Implementation status: Slice 1 plus the controller-owned Continued Contact distance and
maintenance/escape lifecycle.

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
   The shared GM/Player declaration form places this encounter-participant selector in Phase 1,
   alongside other Phase 1 opponent-bound maneuvers; it is not part of the general Action panel.
2. One generated, round-bound `flat_db` modifier applies DB −2. Recommit uses the same deterministic
   row identity and does not stack it. The generated row is the single fact shown in declaration
   preview, presented for GM modifier review, persisted on commit, and composed into effective DB
   after percentage adjustment. A base combined DB of 15 therefore resolves as DB 13 for attacks
   in that round. It is not the later Unbalanced percentage modifier.
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
8. After both rolls, the strict comparison resolves automatically. The final roll completes the
   parallel group, removes both Brawling tasks and their tracker attention, and advances Current
   Action from the authoritative post-mutation projection.
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

Player-safe projection retains the contest ID and each unresolved task. After the first roll, that
roller's task is complete and their persisted roll remains; the other task keeps the same contest
and execution-group lineage. The completed roller sees a waiting state, while the other owner or
the GM proxy may perform the remaining roll. Only the second roll closes and resolves the contest.
After that roll, no Brawling task remains for either player or the GM. GM Combat refreshes the
active encounter revision while open; reload reconstructs the same completed projection. Undoing
the final roll restores exactly the other participant's unresolved task and removes only the result
and effects created by that final command.

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

| Calculation                 | Unbalanced path                                  |
| --------------------------- | ------------------------------------------------ |
| Initiative                  | initiative bucket + combat-wide general resolver |
| Attack/to-hit               | Skill/OB bucket + combat-wide general resolver   |
| DB and ordinary parry       | DB/Parry bucket + combat-wide general resolver   |
| Dodge and distance contests | existing combined general + skill resolver       |
| Weapon Feint contest        | combat-wide general resolver                     |
| Offensive Parry Brawling    | existing general + skill resolver                |

Disarm is not implemented, but it can consume the same combat-wide resolver later. No unsupported
currently implemented roll category required an Offensive-Parry-only calculation path.

The applicability contract carries excluded roll purposes. For the affected participant,
`escape_continued_contact` excludes the Unbalanced row itself. Other valid general, skill, or
situational modifiers remain applicable.

### Next-round engagement distance

Active Continued Contact survives the round transition. At Round End it replaces the ordinary
opposed distance contest for only the controller/affected-participant pair:

1. the controller receives **Choose engagement distance**;
2. the affected participant receives no opposing roll or competing choice;
3. the selected distance is committed through the ordinary canonical distance matrix with the
   prior distance, controller, affected participant, source contact, and reason retained;
4. reload and history preserve the choice, while undo restores the prior distance and unresolved
   choice;
5. the next round opens normal declarations for both participants at that chosen distance.

This lifecycle does not create an Offensive Parry attack, shorten distance from weapon data, or
change declaration legality. The controller owns only this relationship-scoped distance choice.
Unrelated participant pairs continue to use ordinary Round End distance resolution.

### Maintenance and escape

The establishment round does not contain a maintenance contest. Continued Contact first supplies
the controller-owned distance choice, the next round opens normal declarations, and both
participants fight that complete round through its ordinary combat work. Only when that later round
reaches Round End does maintenance precede the next distance decision:

1. one deterministic maintenance contest is created for each active Continued Contact relationship
   whose establishment round is earlier than the current round;
2. one controller-owned and one affected-participant-owned
   `continued_contact_maintenance_roll` task are projected together in an `SU` `parallel_all`
   execution group;
3. both use ordinary effective Brawling and `rollPurpose: escape_continued_contact`;
4. the affected participant's Unbalanced −2% row is excluded from that roll purpose only, while
   every other applicable modifier remains;
5. a strictly higher controller total maintains Continued Contact and Unbalanced;
6. a higher affected-participant total or an equal total breaks Continued Contact and removes
   Unbalanced.

Maintenance is a Round End child process. It does not run during initiative resolution,
declaration, or the distance choice, and unresolved maintenance gates all distance work for the
relationship. Each participant owns their own roll, the GM may proxy either exact task, and the
first roll completes only that participant's child task.

When contact is maintained, the same controller receives the canonical engagement-distance choice
before the next round's declarations. When contact is broken, the ordinary opposed distance
process returns for that pair. Ending contact marks both the relationship and condition terminal
and expires the linked Unbalanced combat effect in the same accepted route mutation. Reload
reconstructs the same result; undoing the final roll restores the prior active states and exactly
one unresolved maintenance task.

## Presentation and privacy

Before the contest, Current Action identifies the committed attacker and asks the declarer to roll
Offensive Parry whether the source attack hit or missed. Tracker attention is owned by that exact
P1/P2 parry task. After success, Current Action asks each unresolved participant to roll Brawling.
The current-step result distinguishes interception of a missed attack from parrying a hit without
changing trigger eligibility. Attack and purpose-tagged parry presentation is keyed by canonical
attack/parry result identity, so a compatibility projection of the same fact is not shown as a
second Attack or generic Defense entry. Genuinely distinct attack-result identities remain separate.
The result records the broad comparison and visible
Continued Contact/Unbalanced consequence. The GM may inspect both rolls; a player receives their own
calculation and the broad opponent outcome, not the opponent's private dice/calculation.

The final result uses one concise **Offensive Parry — Brawling** calculation. Each visible full roll
shows Skill, raw Percentage modifiers (with non-zero source rows), the persisted workbook-adjusted
Effective skill, Die roll, and Total. Parry quality values `+0%`, `+1%`, `+2%`, and `+4%` are not
flat skill points. The shared workbook table applies them with all other eligible percentage
contributions; base Brawling 15 with `+2%` resolves to effective skill 18. The signed contest
difference is always controller total minus affected-participant total. The GM sees both full
rolls; each involved player sees their own full roll, the opponent total, the signed difference,
and the broad result. Skill IDs, XP fields, characteristic decomposition, task/process identities,
and duplicate roll/final-total labels remain audit facts and are not normal calculation UI. This
Brawling calculation attaches only to the final contest result; the incoming Attack and proactive
parry retain their own calculations.

For one declaration and source attack result, the proactive attempt and parry result are
single-instance canonical facts. Successful resolution removes the parent parry task before
Brawling is projected. Reload, polling, or a stale descriptor cannot create another parry result or
restore **Roll Offensive Parry** after the contest or Continued Contact exists.

The mechanics-only Brawling roll is not projected as new Combat Log narration.

The final maintenance result uses one concise **Continued Contact — Maintenance** contested
calculation. A controller win states that contact was maintained, Unbalanced remains, and the
controller chooses the next engagement distance. An affected-participant win or tie states that
contact was broken, Unbalanced was removed, and ordinary distance control resumes. It does not
repeat the Brawling calculation that originally established Continued Contact.

## Deferred work

Slice 2:

- conditional Phase 2 attack opportunity;
- second-weapon requirements;
- automatic distance shortening where required;
- exact source/mode selection for the follow-up attack.

Still deferred:

- any conditional Phase 2 follow-up attack, second-weapon rule, or automatic attack-distance
  shortening;
- forward movement and forced-retreat consequences;
- Disarm, Throws, Locks, and Observe Opponent.

This document does not claim that the complete maneuver is implemented.
