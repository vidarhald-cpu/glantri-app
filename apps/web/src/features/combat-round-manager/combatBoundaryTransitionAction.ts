import type {
  CombatProgressionBoundaryKind,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

export interface CombatBoundaryTransitionAction {
  readonly encounterId: string;
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
    !task.transition
  ) {
    return undefined;
  }

  return Object.freeze({
    encounterId: input.encounterId,
    expectedBoundary: task.transition.currentBoundary,
    expectedRevision: input.encounterRevision,
    targetBoundary: task.transition.targetBoundary,
    taskId: task.id,
  });
}
