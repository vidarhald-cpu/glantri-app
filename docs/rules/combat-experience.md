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
executable phase 1 attack and is attacked in phase 1 by an aware/seen opponent. Those participants
must resolve Combat Experience before A1 attack resolution opens. After `i2`, the same check runs
for phase 2 before A2 attacks.

Phase CE uses the same displayed effective skill total, difficulty-shifted result table, no-roll
rule, command-backed undo, and General modifier rows as combat-start CE. Phase CE does not require a
new GM "start rolls" button; reaching the A1/A2 pre-attack gate opens the phase CE window. If the
encounter visibility map explicitly marks the attacker as unseen by the defending participant, that
incoming attack does not trigger phase CE for the defender. Missing visibility data is treated as
seen so older encounters do not silently skip required CE.

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

Panic, Passive, and Active penalties are represented as normal combat effect rows:

- type: `general_modifier`
- group: `general`
- modifier value: table modifier
- duration: normal round-duration text such as `2 rounds`
- details: short note such as `combat exp active -2`

The existing live modifier model applies the row, and the existing SU duration countdown decrements or expires it. Active `21+` creates no effect row.

No-roll Active confirmations also create no effect row. Rolled CE results and no-roll CE
confirmations are both command-backed and undoable; clearing a rolled CE removes only the
command-created CE modifier row, while clearing a no-roll confirmation removes no combatEffect rows.

## Current Boundary

This slice does not restrict player action dropdowns and does not implement action-selection gating for Panic or Passive beyond requiring the relevant CE roll before declaration or phase attack resolution. Critical-triggered CE rerolls and ordinary non-combat CE skill-roll behavior are follow-up work.
