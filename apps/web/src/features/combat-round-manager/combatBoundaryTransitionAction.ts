import type {
  CombatProgressionBoundaryKind,
  CombatProgressionExpectedCommand,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

export interface CombatBoundaryTransitionAction {
  readonly commandType: Extract<
    CombatProgressionExpectedCommand,
    "advance_combat_boundary" | "complete_round"
  >;
  readonly encounterId: string;
  readonly executionGroupId: string;
  readonly expectedBoundary: CombatProgressionBoundaryKind;
  readonly expectedRevision: string;
  readonly targetBoundary: CombatProgressionBoundaryKind;
  readonly taskId: string;
}

/**
 * Binds the visible projected transition to the exact encounter revision that produced it.
 * Click handlers must submit this descriptor as-is instead of reconstructing it from live props.
 */
export function buildCombatBoundaryTransitionAction(input: {
  encounterId: string;
  encounterRevision?: string;
  task?: CombatProgressionPresentationTask;
}): CombatBoundaryTransitionAction | undefined {
  const { task } = input;

  if (
    !input.encounterRevision ||
    !task ||
    task.kind !== "gm_advance_boundary" ||
    task.state !== "executable" ||
    !task.actorAccess.gm ||
    (task.expectedCommand !== "advance_combat_boundary" &&
      task.expectedCommand !== "complete_round") ||
    !task.transition
  ) {
    return undefined;
  }

  return Object.freeze({
    commandType: task.expectedCommand,
    encounterId: input.encounterId,
    executionGroupId: task.executionGroupId,
    expectedBoundary: task.transition.currentBoundary,
    expectedRevision: input.encounterRevision,
    targetBoundary: task.transition.targetBoundary,
    taskId: task.id,
  });
}
