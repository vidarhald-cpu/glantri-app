import {
  advanceCombatRoundStep,
  buildCombatRoundCommandId,
  combatRoundCommandSchema,
  combatRoundStateSchema,
  getCombatRoundCursorStepForStep,
  getFirstCombatRoundPendingModifierReviewParticipantId,
  getCombatRoundStartNextRoundBlocker,
  resolveCombatObservationRoundBoundary,
  upsertCombatRoundStepSnapshots,
  type CombatRoundState,
  type CombatRoundStep,
  type CombatRoundStepSnapshot,
  type CombatRoundVisibility,
} from "../combatRoundManager";
import { authorizeCombatProgressionTask } from "./authorization";
import { buildCombatProgressionProjection } from "./build";
import type { CombatProgressionAuthorizationFailureCode } from "./authorization";
import type { CombatParticipationProjection } from "../combatParticipation";
import type { CombatProgressionBoundaryKind, CombatProgressionExpectedCommand } from "./types";

const TARGET_STEP_BY_BOUNDARY: Partial<Record<CombatProgressionBoundaryKind, CombatRoundStep>> = {
  declaration: "select_actions",
  phase1_initiative: "initiative_phase_1",
  phase1_modifier_review: "review_action_modifiers",
  phase1_resolution: "phase_1_actions",
  phase2_initiative: "initiative_phase_2",
  phase2_modifier_review: "review_phase_2_modifiers",
  phase2_resolution: "phase_2_actions",
  round_end: "round_summary",
};

const DIRECT_TRANSITIONS = new Set([
  // Ruling 2 (#215): the `declaration` boundary spans `pre_declaration` and `select_actions`, so
  // advancing out of the pre-declaration step re-opens the same boundary. The handler below already
  // delegates every `declaration` advance to `advanceCombatRoundStep`, which performs exactly that
  // one step hop.
  "declaration:declaration",
  "declaration:phase1_modifier_review",
  "phase1_modifier_review:phase1_initiative",
  "phase1_resolution:phase2_modifier_review",
  "phase2_modifier_review:phase2_initiative",
  "phase2_resolution:round_end",
]);

export class CombatProgressionBoundaryAdvanceError extends Error {
  readonly code: CombatProgressionAuthorizationFailureCode;

  constructor(code: CombatProgressionAuthorizationFailureCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CombatProgressionBoundaryAdvanceError";
  }
}

function transitionWithoutCommand(input: {
  currentBoundary: CombatProgressionBoundaryKind;
  state: CombatRoundState;
  stepSnapshots?: CombatRoundStepSnapshot[];
  targetBoundary: CombatProgressionBoundaryKind;
  visibility?: CombatRoundVisibility;
}): CombatRoundState {
  const transitionKey = `${input.currentBoundary}:${input.targetBoundary}`;
  if (!DIRECT_TRANSITIONS.has(transitionKey)) {
    throw new CombatProgressionBoundaryAdvanceError(
      "boundary_mismatch",
      `Unsupported combat boundary transition ${transitionKey}.`,
    );
  }

  if (
    input.currentBoundary === "declaration" ||
    input.currentBoundary === "phase1_modifier_review" ||
    input.currentBoundary === "phase2_modifier_review"
  ) {
    return advanceCombatRoundStep(input.state, {
      stepSnapshots: input.stepSnapshots,
      visibility: input.visibility,
    });
  }

  const targetStep = TARGET_STEP_BY_BOUNDARY[input.targetBoundary];
  if (!targetStep) {
    throw new CombatProgressionBoundaryAdvanceError(
      "boundary_mismatch",
      `Combat boundary ${input.targetBoundary} has no compatible round step.`,
    );
  }
  const normalized = input.stepSnapshots
    ? upsertCombatRoundStepSnapshots({ snapshots: input.stepSnapshots, state: input.state })
    : combatRoundStateSchema.parse(input.state);
  const participantId =
    input.targetBoundary === "phase2_modifier_review"
      ? (getFirstCombatRoundPendingModifierReviewParticipantId({
          phase: "phase2",
          state: normalized,
        }) ?? normalized.participants[0]?.participantId)
      : (normalized.currentCursor?.participantId ??
        normalized.selectedParticipantId ??
        normalized.participants[0]?.participantId);

  return combatRoundStateSchema.parse({
    ...normalized,
    currentCursor: {
      participantId,
      roundNumber: normalized.roundNumber,
      step: getCombatRoundCursorStepForStep(targetStep),
    },
    currentStep: targetStep,
    phaseResolutionCursor: undefined,
    selectedParticipantId: participantId,
    selectedStep: targetStep,
  });
}

/**
 * Authoritative top-level transition. It authorizes the projected GM task, rejects stale or
 * skipped targets, and then delegates to the existing round-state transition behavior.
 */
export function advanceCombatProgressionBoundary(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
    facts?: Record<string, unknown>;
  };
  expectedCommandType: Extract<
    CombatProgressionExpectedCommand,
    "advance_combat_boundary" | "complete_round"
  >;
  expectedBoundary: CombatProgressionBoundaryKind;
  expectedExecutionGroupId: string;
  expectedTaskId: string;
  participation?: CombatParticipationProjection;
  state: CombatRoundState;
  stepSnapshots?: CombatRoundStepSnapshot[];
  targetBoundary: CombatProgressionBoundaryKind;
  visibility?: CombatRoundVisibility;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const projection = buildCombatProgressionProjection(normalized, {
    participation: input.participation,
  });
  const commandType =
    input.expectedBoundary === "round_boundary"
      ? ("complete_round" as const)
      : ("advance_combat_boundary" as const);
  if (input.expectedCommandType !== commandType) {
    throw new CombatProgressionBoundaryAdvanceError(
      "task_mismatch",
      "The projected combat boundary command changed before it could be advanced.",
    );
  }
  const authorization = authorizeCombatProgressionTask({
    actor: { kind: "gm" },
    commandType,
    currentBoundary: input.expectedBoundary,
    executionGroupId: input.expectedExecutionGroupId,
    projection,
    taskId: input.expectedTaskId,
    targetBoundary: input.targetBoundary,
  });
  if (!authorization.ok) {
    if (input.expectedBoundary === "round_boundary") {
      const roundBoundaryBlocker = getCombatRoundStartNextRoundBlocker(normalized);
      if (roundBoundaryBlocker) throw new RangeError(roundBoundaryBlocker);
    }
    throw new CombatProgressionBoundaryAdvanceError(
      authorization.code === "stale_boundary" || authorization.code === "wrong_target"
        ? "boundary_mismatch"
        : authorization.code,
      authorization.message,
    );
  }
  if (authorization.task.blockerIds.length > 0) {
    throw new CombatProgressionBoundaryAdvanceError(
      "task_not_ready",
      "Combat boundary blockers must be cleared before advancing.",
    );
  }

  if (commandType === "complete_round") {
    const observationBoundary = resolveCombatObservationRoundBoundary({
      state: normalized,
    });
    const completed = advanceCombatRoundStep(observationBoundary.state, {
      command: {
        ...input.command,
        facts: {
          ...input.command.facts,
          observationUndoFacts: observationBoundary.undoFacts,
          previousGmBacktrackHold: normalized.gmBacktrackHold,
        },
      },
      stepSnapshots: input.stepSnapshots,
      visibility: input.visibility,
    });
    return combatRoundStateSchema.parse({ ...completed, gmBacktrackHold: undefined });
  }

  const transitioned = transitionWithoutCommand({
    currentBoundary: input.expectedBoundary,
    state: normalized,
    stepSnapshots: input.stepSnapshots,
    targetBoundary: input.targetBoundary,
    visibility: input.visibility,
  });
  const openedProjection = buildCombatProgressionProjection(transitioned);
  if (openedProjection.boundary.kind !== input.targetBoundary) {
    throw new CombatProgressionBoundaryAdvanceError(
      "boundary_mismatch",
      "The combat transition did not open the requested boundary.",
    );
  }
  const participantId =
    normalized.currentCursor?.participantId ??
    normalized.selectedParticipantId ??
    normalized.participants[0]?.participantId;
  if (!participantId || !normalized.currentCursor || !transitioned.currentCursor) {
    throw new CombatProgressionBoundaryAdvanceError(
      "task_not_ready",
      "Combat boundary transition cursors are incomplete.",
    );
  }
  const command = combatRoundCommandSchema.parse({
    afterCursor: transitioned.currentCursor,
    beforeCursor: normalized.currentCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      currentBoundary: input.expectedBoundary,
      previousGmBacktrackHold: normalized.gmBacktrackHold,
      previousStepSnapshots: normalized.stepSnapshots,
      requiredCompletedProcessIds: authorization.task.transition?.requiredCompletedProcessIds ?? [],
      targetBoundary: input.targetBoundary,
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId,
        state: normalized,
        type: commandType,
      }),
    participantId,
    roundNumber: normalized.roundNumber,
    type: commandType,
  });

  return combatRoundStateSchema.parse({
    ...transitioned,
    commands: [...transitioned.commands, command],
    gmBacktrackHold: undefined,
  });
}
