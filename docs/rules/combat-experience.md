# Combat Experience

Combat Experience is a combat-start readiness roll in the current round manager slice.

## Combat-Start Roll

At the start of combat, each active participant must resolve Combat Experience before ordinary declaration in DE proceeds.

- Default difficulty: `26`
- Roll: open-ended `1d20 + Combat Experience`, unless the displayed Combat Experience total already meets the difficulty
- Skill total source: the displayed `Combat Experience` skill total from the participant character sheet/combat panel. The lookup prefers the sheet summary `totalSkill`/`totalSkillLevel`; if that final total is unavailable it reconstructs `effectiveSkillNumber + linkedStatAverage`; it falls back to bare `effectiveSkillNumber` only with an explicit warning.
- Missing skill fallback: `0`, with an explicit warning/status so a spelling, casing, or serialization mismatch is visible
- Current trigger: `combat_start`

The old source table assumed an earlier CE calculation model. The current app uses the normal skill-roll difficulty default of `26`.

If the Combat Experience skill total is equal to or higher than the current difficulty, no die roll
is required. The GM confirms the result, the participant is Active with no modifier, and no General
modifier row is created. The confirmation is still stored as a `roll_combat_experience` command, so
Clear current step can undo it and return DE to the CE-needed state.

## Result Table

| Final total | Result | Modifier | Duration | Effect row |
| --- | --- | ---: | ---: | --- |
| `<= 5` | Panic | `-4` | `1d6 + 4` rounds | Yes |
| `6-10` | Passive | `-2` | `4` rounds | Yes |
| `11-15` | Active | `-2` | `2` rounds | Yes |
| `16-20` | Active | `-1` | `1` round | Yes |
| `21+` | Active | `0` | `0` | No |

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

This slice does not restrict player action dropdowns and does not implement action-selection gating for Panic or Passive beyond requiring the CE roll before declaration. Player-originated CE rolls, critical-triggered CE rerolls, simultaneous-attack CE rolls, and ordinary non-combat CE skill-roll behavior are follow-up work.
