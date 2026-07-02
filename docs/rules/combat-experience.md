# Combat Experience

Combat Experience is a combat-start readiness roll in the current round manager slice.

## Combat-Start Roll

At the start of combat, each active participant must resolve Combat Experience before that
participant can make an ordinary DE declaration. CE is an open declaration-window roll, similar to
initiative: players may resolve their own CE in any order, and the GM may resolve CE for any active
participant.

- Default difficulty: `26`
- Roll: open-ended `1d20 + Combat Experience`, unless the displayed Combat Experience total already meets the difficulty
- Skill total source: the displayed effective `Combat Experience` skill total from the participant character sheet/combat panel. The canonical combat value is `effectiveSkillNumber`; `totalSkill`/`totalSkillLevel` is used only as a fallback with an explicit warning.
- Missing skill fallback: `0`, with an explicit warning/status so a spelling, casing, or serialization mismatch is visible
- Current trigger: `combat_start`

The CE result table is anchored at difficulty `21`. The current app default difficulty is `26`,
and the GM may edit it before resolving CE. The command shifts the final roll total before reading
the table:

- `difficultyShift = difficulty - 21`
- `effectiveTableTotal = finalTotal - difficultyShift`

The existing table bands are read from `effectiveTableTotal`, not directly from the raw final total.
For example, `Combat Experience 19 + roll 8 = 27 vs 36` has `effectiveTableTotal = 12`, so it
resolves as Active with General `-2` for `2` rounds.

The GM's active CE difficulty is stored on the combat round state, so GM and player views use the
same number. If the Combat Experience skill total is equal to or higher than the current difficulty,
no die roll is required. The controlling player or the GM confirms the result, the participant is
Active with no modifier, and no General modifier row is created. The confirmation is still stored as
a `roll_combat_experience` command, so Clear current step can undo it and return DE to the CE-needed
state.

Participants can resolve CE and declarations non-sequentially during DE. A participant cannot
declare until their CE is resolved, but they may declare after their own CE is resolved even if other
participants still need CE. Advancing to M1 remains blocked until all active participants have
resolved required CE and submitted valid declarations, unless an explicit GM override workflow is
added separately.

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

This slice does not restrict player action dropdowns and does not implement action-selection gating for Panic or Passive beyond requiring the CE roll before declaration. Critical-triggered CE rerolls, simultaneous-attack CE rolls, and ordinary non-combat CE skill-roll behavior are follow-up work.
