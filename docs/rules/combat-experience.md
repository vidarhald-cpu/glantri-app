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

After `i1` is complete and before A1 attacks, the sequencer checks every participant who both has an
executable phase 1 attack and is attacked in phase 1 by an aware/seen opponent. After `i2`, the same
check runs for phase 2 before A2 attacks. Required checks are resolved before the A1/A2
phase-resolution cursor opens. The GM grid marks an unresolved A1/A2 phase CE check with `?`; the
inspector and Player Combat panel describe the reason as "attacked while attacking" and list the
incoming attacker initiative comparison.

When the final required i1/i2 roll is recorded, any unresolved phase CE gate becomes the current
task immediately. If the GM uses the top advance button from a completed initiative step instead,
that advance also moves to the first unresolved phase CE gate before opening normal A1/A2 attack
resolution.

Initiative is highest first. For each same-phase attack relationship, compare the attacking
participant's phase initiative with the incoming attacker's phase initiative:

- Initiative difference `<= 3`: both involved attacking participants roll CE when each is also
  attacked by and aware of the other participant.
- Initiative difference `> 3`: only the lower-initiative participant rolls CE, provided that lower
  participant is attacking in the phase and sees the incoming attacker.
- A participant who is not attacking in that phase does not roll phase CE.
- An incoming attack from an explicitly unseen attacker does not trigger the opportunity. Missing
  visibility data is treated as seen for backward-compatible encounters.

Example: if two participants both make valid A1 attacks against each other, both see each other, and
their i1 totals are `5` and `5`, both must resolve phase CE before either A1 attack roll opens. If
one participant declared Parry - Attack, that participant has no A1 attack, so their declaration
cannot create a phase-1 attacked-while-attacking CE check.

Phase CE uses the same displayed effective skill total, difficulty-shifted table lookup, no-roll
rule, and command-backed undo as combat-start CE. Phase CE does not require a new GM "start rolls"
button; reaching the A1/A2 pre-attack gate opens the phase CE window. At an unresolved phase CE gate,
the participant may either roll/confirm Combat Experience or back out of the pending attack. Backing
out cancels only that A1/A2 attack, records no CE roll result, keeps declaration-generated modifiers,
and softens the matching generated phase attack DB/Parry penalty from `-4` to `-2` for that phase.

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
pending phase attack in the same CE command. Clear current step removes the CE command/result, any
created phase OB modifier or cancellation, and restores the participant to the unresolved `?` CE
gate. Clear after backing out removes the skipped-attack marker, restores the unresolved `?` CE gate,
and changes the softened generated DB/Parry row back from `-2` to `-4`; other declaration modifiers
remain in place.

## Result Table

| Effective table total | Result  | Modifier |         Duration | Effect row |
| --------------------- | ------- | -------: | ---------------: | ---------- |
| `<= 5`                | Panic   |     `-4` | `1d6 + 4` rounds | Yes        |
| `6-10`                | Passive |     `-2` |       `4` rounds | Yes        |
| `11-15`               | Active  |     `-2` |       `2` rounds | Yes        |
| `16-20`               | Active  |     `-1` |        `1` round | Yes        |
| `21+`                 | Active  |      `0` |              `0` | No         |

Panic duration is rolled at the time of the CE command and stored on the result/effect.

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

This slice does not restrict player action dropdowns and does not implement action-selection gating for Panic or Passive beyond requiring the relevant CE roll before declaration or phase attack resolution. Critical-triggered CE rerolls and ordinary non-combat CE skill-roll behavior are follow-up work.
