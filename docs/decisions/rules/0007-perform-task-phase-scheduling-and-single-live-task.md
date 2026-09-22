# Rule decision 0007: Perform Task phase-duration scheduling and one live Perform Task per participant

- Status: approved
- Date: 2026-09-22
- Product owner: Vidar Hald, Product Owner ruling on Forgejo issue #287, work item A1a
- Related issues/PRs: Forgejo #287 (Combat consolidation), work item A1a (Combat task lifecycle
  convergence)
- Supersedes: none
- Superseded by: none

## Question

Two questions surfaced during A1a's Perform Task lifecycle implementation and were not answered
by the [Combat Panel Contract §12.12](../../product/combat-panel-contract.md#1212-a1--combat-task-lifecycle-convergence):

1. When a Perform Task carries a `{kind: "phase", phase: "phase1" | "phase2"}` duration, at which
   primary-action opportunity does it resolve, and what happens when a lifecycle command targets
   the wrong one?
2. May a participant hold more than one live Perform Task at a time, and if not, what stops
   already-malformed legacy state from granting two primary actions?

## Evidence and provenance

- [Combat Panel Contract §12.12](../../product/combat-panel-contract.md#1212-a1--combat-task-lifecycle-convergence)
  settles that Perform Task is a normal primary action with the same initiative ordering and
  action opportunity as any other primary action, and no parallel generic-action clock, but does
  not name Phase 2 or the one-live-task question.
- [Combat task integration matrix — Perform Task lifecycle](../../architecture/combat-task-integration-matrix.md)
  records the implementation audit; before this ruling it stated only that lifecycle commands
  project one executable task at "the owner's Phase 1 primary-action opportunity."
- `packages/domain/src/encounter/combatGenericAction.ts` — `combatGenericActionDurationSchema`
  already defines `{kind: "phase", phase: "phase1" | "phase2"}` alongside `round`, `rounds: N`
  and `gm_decided`.
- `apps/api/src/routes/scenarios/encounterRoutes.ts` — `materializeCombatDeclarationTasks`, the
  Perform Task declaration path.
- `packages/domain/src/encounter/combatRoundManager.ts` —
  `requireCombatRoundOpenPerformTask`, `getCombatRoundOpenPerformTaskForParticipant`, and the
  five lifecycle command handlers (resolve, review, roll, cancel, interrupt).

## Conflict or limitation

`combatGenericActionDurationSchema` already admitted a `phase2` value, but no lifecycle command
distinguished it from Phase 1 before commit `30eade0b`: every task resolved at the actor's Phase 1
opportunity regardless of its declared phase. Separately, `materializeCombatDeclarationTasks` had
no check preventing a participant from being handed a second live Perform Task through repeated
declaration, before commit `fbf9815d`. Neither gap was a documented rule; both were implementation
omissions a Builder and QA returned to the Product Owner rather than resolving unilaterally.

## Ruling

### 1. Phase-duration Perform Tasks resolve only at their named phase, in both directions

**Never resolve a Phase 2 task at Phase 1 or vice versa.**

- A `{kind: "phase", phase: "phase1"}` duration schedules the task at the actor's Phase 1
  primary-action opportunity, exactly as `round`, `rounds: N` and `gm_decided` durations do.
- A `{kind: "phase", phase: "phase2"}` duration schedules the task at the actor's Phase 2
  primary-action opportunity instead. Phase 2 opens for a phase2-duration task only; `round`- and
  `rounds`-duration tasks are never open at Phase 2.
- All five lifecycle commands — resolve, review, roll, cancel and interrupt — are refused when
  addressed at the task's other phase. The refusal happens in `requireCombatRoundOpenPerformTask`
  before the open-task lookup, so it cannot be evaded by shaping state.
- A GM review that defers a task's duration into the other phase spends the current phase's
  opportunity (`consumesOpportunity: true`): the current phase closes for that participant, and
  exactly one `task_resolved` event can result, from the deferred phase's later resolution.
  Replaying the deferring review is refused; re-reviewing back into the original phase is refused
  once the first review has activated the task.
- Cancel and interrupt at Phase 2 emit zero `task_resolved` events, leave the task open at neither
  phase, and undo to byte-equal prior state.

**Fold this into the current A1a contract/repair without broadening the UI or route-convergence
work.** This ruling authorizes the phase-scheduling fix alone; it does not reopen A1a's scope,
widen `combatDeclarationPrimaryIntentSchema`, or authorize A1b's route-convergence work.

Recurrence of an unresolved `phase2` task into the following round follows from this ruling only
by omission — no expiry rule is stated or authorized. Whether it should instead expire is
explicitly **not** decided by this ruling; see
[Combat Panel Contract §12.18](../../product/combat-panel-contract.md#1218-open-decision--phase-2-perform-task-recurrence-versus-expiry).

### 2. At most one live Perform Task per participant

**A participant may have at most one live Perform Task at a time. A second one is refused until
the existing task is completed, cancelled or resolved. Malformed legacy state must still be
prevented from granting two primary actions.**

- `materializeCombatDeclarationTasks` refuses a `perform_task` declaration while the declaring
  participant already holds a live one — any task whose status is not `completed`, `cancelled` or
  `interrupted`.
- Two exclusions preserve existing behavior and are not new capability: re-declaring the same
  round's task by its own `taskId` is excluded from the check, so idempotent re-declaration still
  succeeds, and cross-round carry-forward of an existing task is unaffected because the server
  writes the minted task id back into the persisted declaration intent and falls back to it.
- The refusal applies to `perform_task` only; `small_action` is deliberately not covered.
- This is a creation-time refusal, not the enforcement chokepoint. It makes the two-live-task
  state rarer; it repairs nothing already persisted. `getCombatRoundOpenPerformTaskForParticipant`
  remains the single gate that prevents already-malformed legacy state from granting two primary
  actions, through its two independent witnesses — the phase-resolution substep being `done`, and
  command-log completion evidence, either sufficient alone — and its existing selection rule
  (started over declared, then most recent `createdAt`).

## Reasoning

Both rulings correct implementation gaps against settled intent rather than inventing new Combat
rules. Ruling 1 makes the already-defined `phase2` duration value behave as its name implies,
consistent with §12.12's settled position that Perform Task uses the actor's own primary-action
opportunity and no separate timing authority — Phase 2 is simply the other opportunity a
phase-duration task may name. Ruling 2 answers a materialization-time question the Builder and QA
declined to decide unilaterally: whether "one primary action per round" (already enforced at the
opportunity gate) should also be enforced earlier, at declaration. The Product Owner chose to
refuse at declaration too, while leaving the existing opportunity gate as the backstop against
already-divergent persisted state, which a creation-time check cannot retroactively clean.

## Executable examples

- A `{kind: "phase", phase: "phase2"}` task: `resolve_combat_task` at Phase 1 throws
  `/scheduled for the actor's Phase 2 primary-action opportunity/`; the same command at Phase 2
  succeeds and emits one `task_resolved` event with `phase: "phase2"`.
- A `{kind: "phase", phase: "phase1"}` task: `resolve_combat_task` at Phase 2 throws
  `/scheduled for the actor's Phase 1 primary-action opportunity/`.
- A GM review at Phase 1 that sets `duration: {kind: "phase", phase: "phase2"}` on an in-progress
  task closes Phase 1 for that participant (`phaseResolutionStatuses.<id>.phase1.substep` becomes
  `"done"`) and leaves the task open and resolvable at Phase 2 in the same round; resolving it
  there leaves no further open opportunity in either phase and produces exactly one
  `task_resolved` event.
- Declaring a second `perform_task` for a participant who already holds one with status
  `declared`, `reviewed` or `active` returns HTTP 400 with
  `/already has a Combat Task in progress/`, and `updateEncounter` is never called. Declaring
  again once the earlier task is `completed`, `cancelled` or `interrupted` succeeds and both tasks
  persist, the earlier one unchanged.

## Implementation consequences

No schema or migration change; `combatGenericActionDurationSchema` already defined `phase2`.
Persisted command and event facts already carry `phase`; this ruling changes only which phase
authorizes which command, and adds one creation-time refusal path in
`materializeCombatDeclarationTasks`. No UI surface or route-convergence (A1b) work is authorized
by either ruling.

## Verification and traceability

- Ruling 1 (phase-duration scheduling and both-directions refusal): commit `30eade0b`
  (`fix(#287): schedule a phase-duration Perform Task into the named phase`); protected by
  `packages/domain/src/encounter/combatTaskLifecycle.test.ts`, describe block `"phase duration
schedules the named primary-action opportunity"` (covers phase1-only resolution, phase2-only
  resolution, both-directions refusal, deferral closing the current phase, deferral undo, Phase 2
  resolution undo, cancel/interrupt at Phase 2, and authorization at the Phase 2 boundary).
- Ruling 2 (one live Perform Task per participant): commit `fbf9815d`
  (`fix(#287): refuse a second live Perform Task at declaration`); protected by
  `apps/api/src/routes/scenarios.test.ts`, tests `"refuses a second Perform Task while the
participant already holds a live one"` and `"accepts the next Perform Task once the earlier one
is completed, cancelled or interrupted"`. The unchanged enforcement chokepoint is protected by
  `packages/domain/src/encounter/combatTaskLifecycle.test.ts`, describe blocks `"open Perform Task
selection with more than one live task"` and `"one primary action per round with two live
Perform Tasks"`.
- Documentation: [Combat task integration matrix](../../architecture/combat-task-integration-matrix.md),
  Perform Task lifecycle row and narrative; [Combat Panel Contract §12.18](../../product/combat-panel-contract.md#1218-open-decision--phase-2-perform-task-recurrence-versus-expiry)
  records the recurrence-versus-expiry question this ruling does not settle.
- Raised as a documentation-durability gap by independent QA of branch
  `codex/287-a1a-task-lifecycle`, finding F1: neither ruling appeared in any repository document
  before this record; both survived only in Forgejo issue #287 comments and TSDoc.
