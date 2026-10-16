# Combat Experience

Combat Experience is a combat-start and phase-attack readiness roll in the current round manager slice.

## Combat-Start Roll

At the start of combat, each active participant must resolve Combat Experience before that
participant can make an ordinary DE declaration. CE is an open declaration-window roll, similar to
initiative: players may resolve their own CE in any order, and the GM may resolve CE for any active
participant.

- Default difficulty: `26`
- GM open step: the GM sets/accepts the shared difficulty with Start Combat Experience rolls before players can roll or confirm
- Roll: open-ended `1d20 + Combat Experience`, unless the displayed Combat Experience total already meets the difficulty
- Skill total source: the displayed effective `Combat Experience` skill total from the participant character sheet/combat panel. The lookup prefers the displayed total field such as `totalSkill`/`totalSkillLevel`; if that field is absent, it derives the same displayed total from linked stats plus XP, such as `linkedStatAverage + effectiveSkillNumber`. XP-only fields such as `effectiveSkillNumber` are used only as an explicit fallback with a warning.
- Missing skill fallback: `0`, with an explicit warning/status so a spelling, casing, or serialization mismatch is visible
- Current triggers: `combat_start`, `phase1_attack`, `phase2_attack`

The CE result table is anchored at difficulty `21`. The current app default difficulty is `26`,
and the GM may edit it before resolving CE. The command shifts the final roll total before reading
the table:

- `difficultyShift = difficulty - 21`
- `effectiveTableTotal = finalTotal - difficultyShift`

The existing table bands are read from `effectiveTableTotal`, not directly from the raw final total.
For example, `Combat Experience 19 + roll 8 = 27 vs 36` has `effectiveTableTotal = 12`, so it
resolves as Active with General `-2` for `2` rounds.

The GM's active CE difficulty is stored on the combat round state, so GM and player views use the
same number. An absent stored difficulty means the CE roll window is still closed; Player Combat
shows Waiting for GM until the GM starts CE rolls. The GM may update the shared difficulty before
any CE result is recorded. After the first CE roll or no-roll confirmation, the difficulty is locked;
changing it requires clearing the CE result state first.

If the Combat Experience skill total is equal to or higher than the current difficulty, no die roll
is required. The controlling player or the GM confirms the result, the participant is Active with no
modifier, and no General modifier row is created. The confirmation is still stored as a
`roll_combat_experience` command, so Clear current step can undo it and return DE to the CE-needed
state.

Participants can resolve CE and declarations non-sequentially during DE. A participant cannot
declare until their CE is resolved, but they may declare after their own CE is resolved even if other
participants still need CE. Advancing to M1 remains blocked until all active participants have
resolved required CE and submitted valid declarations, unless an explicit GM override workflow is
added separately.

## Phase Attack Rolls

After all `i1` rolls are known, the sequencer reviews phase 1 initiative before A1 opens. It detects
every participant who both has an executable phase 1 attack and is attacked in phase 1 by an
aware/seen opponent. After all `i2` rolls are known, the same review happens for phase 2 before A2
opens. This creates a broader back-out opportunity for threatened attackers, while the initiative
comparison decides the narrower set of participants who must roll CE if they continue.

Phase CE/back-out choices are resolved during the `i1`/`i2` initiative result review, not during
the A1/A2 attack step. The combat round `currentCursor` remains on `i1` or `i2` while the phase
initiative review is open. The GM grid still marks an unresolved A1/A2 CE requirement with `?`
because the consequence applies to that pending attack; `?` means CE is required, not merely that
back-out is available. The `?` marker clears when that participant submits a CE roll/confirmation or
backs out. A1/A2 does not ask CE/back-out questions after the GM commits phase initiative resolution.

Initiative is highest first. For each same-phase attack relationship, compare the attacking
participant's phase initiative with the incoming attacker's phase initiative:

- Initiative difference `<= 3`: both involved attacking participants roll CE when each is also
  attacked by and aware of the other participant.
- Initiative difference `> 3`: only the lower-initiative participant rolls CE, provided that lower
  participant is attacking in the phase and sees the incoming attacker. The higher-initiative
  participant does not roll CE, but may still back out while the attack is pending.
- A participant who is not attacking in that phase does not roll phase CE.
- An incoming attack from an explicitly unseen attacker does not trigger the opportunity. Missing
  visibility data is treated as seen for backward-compatible encounters.

Example: if two participants both make valid A1 attacks against each other, both see each other, and
their i1 totals are `5` and `5`, both must resolve phase CE before either A1 attack roll opens. If
their i1 totals are `9` and `4`, only the lower-initiative participant must roll CE if they continue,
but the higher-initiative participant may still back out before their attack is rolled. If
one participant declared Reactive attack, that participant has no A1 attack, so their declaration
cannot create a phase-1 attacked-while-attacking CE check.

Phase CE uses the same displayed effective skill total, difficulty-shifted table lookup, no-roll
rule, and command-backed undo as combat-start CE. During the `i1`/`i2` review:

- A CE-required threatened attacker may roll/confirm Combat Experience or back out.
- A threatened attacker who does not require CE may submit Continue attack or back out.
- Submitting a CE roll, Continue, or Back out records a pending phase initiative choice but does not
  open normal A1/A2 attack resolution.
- The GM may commit phase initiative resolution any time after all initiative rolls for that phase
  are complete.

On commit, submitted choices are applied and then normal A1/A2 resolution opens. Submitted Back out
cancels only that A1/A2 attack, records no CE roll result, keeps declaration-generated modifiers,
and softens the matching generated phase attack DB/Parry penalty from `-4` to `-2` for that phase.
Submitted CE results are applied to the pending attack. Any unresolved CE-required participant is
auto-rolled as continuing the planned attack during GM commit. Any unresolved non-CE-required
threatened participant defaults to Continue attack with no CE roll.

Before commit, the GM can see all threatened attackers and submitted/unsubmitted statuses. A player
can see and submit only their own phase initiative choice; other participants' CE rolls, back-outs,
continue choices, skipped attacks, and modifiers are not exposed through player-facing panels or
latest-event text before commit.

Phase CE uses a phase-attack outcome table:

| Effective table total | Phase attack result      |
| --------------------- | ------------------------ |
| `<= 5`                | No attack made           |
| `6-10`                | Phase attack OB `-4`     |
| `11-15`               | Phase attack OB `-3`     |
| `16-20`               | Phase attack OB `-2`     |
| `21+`                 | Attack continues, no mod |

Phase OB penalties are stored in the participant combat context as phase-scoped Skill/OB modifiers
for only that A1/A2 attack, not as round-duration General modifier rows. A `<= 5` result cancels the
pending phase attack when phase initiative resolution is committed.

Clear before commit removes the latest submitted phase initiative choice only and returns that
participant to unresolved review state. Clear after commit first undoes the commit: it removes applied
CE modifiers/cancellations, removes backed-out skipped-attack markers, restores softened generated
DB/Parry rows from `-2` to `-4`, returns to phase initiative review, and preserves submitted choices
for further Clear operations. Other declaration modifiers remain in place.

## Result Table

| Effective table total | Result  | Modifier |         Duration | Effect row |
| --------------------- | ------- | -------: | ---------------: | ---------- |
| `<= 5`                | Panic   |     `-4` | `1d6 + 4` rounds | Yes        |
| `6-10`                | Passive |     `-2` |       `4` rounds | Yes        |
| `11-15`               | Active  |     `-2` |       `2` rounds | Yes        |
| `16-20`               | Active  |     `-1` |        `1` round | Yes        |
| `21+`                 | Active  |      `0` |              `0` | No         |

Provenance — Panic duration `1d6 + 4`. The historical source table certifies only the range `5 to
10` for Panic duration; it names no die and no distribution. Uniform `1d6 + 4` over `5-10` is the
selection method ratified by the Product Owner (Forgejo #215, ruling 1), certifying the behaviour
already implemented and published here. This is a provenance certification only; it changes no
behaviour.

Panic duration is rolled at the time of the CE command and stored on the result/effect.

## When The Next Check Is Due

A combat-start Combat Experience result holds for the Duration in the table above, and the next
check falls due as that duration runs out. Count from the round the result was rolled in and add the
duration: the check is due as that round opens, so the first round the old result no longer covers
is the round the participant resolves Combat Experience again.

| Result rolled in round | Duration    | Next check due |
| ---------------------- | ----------- | -------------- |
| `7`                    | `1` round   | `8`            |
| `7`                    | `2` rounds  | `9`            |
| `7`                    | `4` rounds  | `11`           |
| `7`                    | `6` rounds  | `13`           |
| `7`                    | `0` (`21+`) | No next check  |

An Active `21+` result has no duration, so it schedules no next check and never becomes due by
schedule. A confirmation made without rolling, because the participant's Combat Experience total
already meets the difficulty, resolves in that same `21+` band and schedules nothing either. While a
participant is on a `21+` result, only a Critical-triggered reset asks them for Combat Experience
again.

Being due is not the same as expiring. The result that is running stays active until the fresh roll
replaces it, and that fresh roll schedules the next check its own duration implies.

## Effect Storage

Combat-start Panic, Passive, and Active penalties are represented as normal combat effect rows:

- type: `general_modifier`
- group: `general`
- modifier value: table modifier
- duration: normal round-duration text such as `2 rounds`
- details: short note such as `combat exp active -2`

The existing live modifier model applies the row, and the existing SU duration countdown decrements or expires it. Active `21+` creates no effect row.

No-roll Active confirmations also create no effect row. Rolled CE results and no-roll CE
confirmations are both command-backed and undoable; clearing a rolled combat-start CE removes only
the command-created CE modifier row, while clearing a no-roll confirmation removes no combatEffect
rows. Clearing a phase CE roll removes phase-scoped combat-context modifiers or the pending-attack
cancellation recorded by that CE command.

## Current Boundary

This slice does not restrict player action dropdowns and does not implement action-selection gating for Panic or Passive beyond requiring the relevant CE roll before declaration or phase attack resolution. Ordinary non-combat CE skill-roll behavior is follow-up work.

The Critical-triggered reset is **implemented**. A Critical resolved against a participant marks a
fresh Combat Experience as due for that participant with reason `critical`, due from the next round.
The reset is only marked at the critical roll; it is resolved in the next round's `pre_declaration`
step, never mid-round and never during Round End. Declarations already made against the prior result
are not invalidated, and the previous Combat Experience stays active until the fresh roll replaces
it. Clearing the critical roll restores the exact previous due marker.
