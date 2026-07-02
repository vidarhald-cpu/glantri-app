# Combat Experience

Combat Experience is a combat-start readiness roll in the current round manager slice.

## Combat-Start Roll

At the start of combat, each active participant must resolve Combat Experience before ordinary declaration in DE proceeds.

- Default difficulty: `26`
- Roll: open-ended `1d20 + Combat Experience`
- Skill total source: the participant snapshot sheet summary, using the `Combat Experience` skill's `effectiveSkillNumber`
- Missing skill fallback: `0`
- Current trigger: `combat_start`

The old source table assumed an earlier CE calculation model. The current app uses the normal skill-roll difficulty default of `26`.

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

## Current Boundary

This slice does not restrict player action dropdowns and does not implement action-selection gating for Panic or Passive beyond requiring the CE roll before declaration. Player-originated CE rolls, critical-triggered CE rerolls, simultaneous-attack CE rolls, and ordinary non-combat CE skill-roll behavior are follow-up work.
