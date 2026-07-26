# Combat command undo facts

## Split archive interaction

Compact initiative undo remains entirely inside the active-state row. In-round undo
therefore rewrites no archive payload. The existing canonical cross-round undo seam
is persisted as an explicit removal of the exact last archived-round row plus the
replacement active state in one transaction. Legacy full `previousState` commands
remain readable after composition.

Status: implemented for phase initiative commitment on 2026-07-26.

## Rule

New combat commands must not persist a complete `CombatRoundState` as undo
data. A round state contains commands, archived rounds, events, results, and
snapshots; embedding it in a command makes later snapshots recursively contain
earlier snapshots.

Undo data must instead be:

- specific to the command type;
- versioned and schema validated;
- the exact inverse of the fields that command mutates;
- independent of unrelated command/history size;
- sufficient after persistence and reload;
- free of current-state or “latest command” inference.

## Initiative commit mutation surface

`commitCombatRoundPhaseInitiativeResolution` mutates only:

1. navigation: `currentCursor`, `currentStep`,
   `phaseResolutionCursor`, `selectedParticipantId`, and `selectedStep`;
2. the current phase entry in `phaseResolutionStatuses` for participants whose
   resolution status changes;
3. the current phase action-step status for a participant when unsupported
   stale action progress is normalized;
4. the status and array position of a Feint proposal opened for the first
   action turn;
5. the status and array position of an Adjust Distance proposal opened for the
   first action turn;
6. `commands`, by appending the initiative-commit command.

It does not mutate participant initiative values, declarations, attack
opportunities/results, combat modifiers, Combat Experience results, effects,
Continued Contact, Unbalanced, distance, events, snapshots, completed rounds,
or external scenario-participant rows. Initiative-group identity and effect
cutoff are derived from the unchanged initiative/effect facts plus the
presence of the initiative-commit command; removing that command restores the
pre-commit derivation.

## Version 1 schema

`combatRoundInitiativeCommitUndoFactsSchema` persists:

- `version: 1`;
- command, round, and phase identity;
- the five prior navigation fields, with explicit `null` for prior absence;
- only participant action-step rows that changed;
- only participant phase-resolution rows that changed, including whether the
  participant entry previously existed;
- only Feint and Adjust Distance proposals whose status changed, including
  their prior array index.

The schema is strict. Full participants, commands, events, snapshots, rounds,
`previousState`, and arbitrary unknown fields are rejected.

Undo removes the exact command and applies these inverse facts. It does not
look up another command or reconstruct values from current progression.

## Legacy compatibility

Previously persisted initiative-commit commands may contain
`facts.previousState`. The undo dispatcher first tries the versioned compact
schema. If it is absent, it retains the existing legacy
`combatRoundStateSchema` parse-and-restore path.

New commands never write `previousState`. This slice does not migrate existing
encounters, so archived legacy commands can continue to contribute to the
stored size until a separate, explicit migration is approved.

## API response

The initiative-commit response contains:

- the authoritative saved encounter;
- the compact command envelope, including the canonical next task/result;
- updated scenario participants when the mutation produced any.

It no longer returns the full committed command separately. The command is
already present in the authoritative encounter and no active web client used
the duplicate field.

## Size guards

Tests require:

- each representative compact initiative command to remain below 20 KB;
- adding 1 MB of unrelated prior command history to leave command size
  effectively unchanged;
- no `previousState` property on new commands;
- rejection of recursive command/history fields by the compact schema;
- no standalone `command` in the initiative API response.

The 20 KB ceiling is deliberately well above the measured 1.3–1.5 KB
representative commands, leaving room for bounded participant deltas without
permitting megabyte state snapshots.

## Measured result

Using the same 33.93 MB persisted encounter identified by the performance
audit:

| Measurement | Legacy | Compact |
| --- | ---: | ---: |
| Phase 1 initiative command | 8,448,079 B | 1,461 B |
| Phase 2 initiative command | 16,952,120 B | 1,354 B |
| Undo facts only | full prior state | 664 B / 556 B |
| Combat round state after replacing the two active commands | 33,934,023 B | 8,536,639 B |
| Equivalent encounter | 33,935,467 B | 8,538,083 B |
| Equivalent response shape | 50,888,222 B | 8,538,707 B |

The remaining 8.4 MB is predominantly archived legacy data and was not
migrated. A synthetic structural guard added 1,000,000 bytes of unrelated
history; the new command and undo payload remained exactly 1,075 and 456 bytes.

On an isolated temporary encounter row containing the compacted representative
state:

- read: 143 ms;
- same-value whole JSON write: 838 ms;
- route-core read + domain commit + write + envelope/serialization: 1,139 ms;
- response: 8,508,128 bytes.

The previous audit measured a 1,178 ms read, 7,222 ms same-value write, and
8,246 ms initiative request on the recursively amplified state. These are
local diagnostic measurements, not CI timing assertions.
