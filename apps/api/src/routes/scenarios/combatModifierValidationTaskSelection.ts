import type {
  CombatProgressionProjection,
  CombatProgressionTask,
} from "@glantri/domain";

function progressionTasks(projection: CombatProgressionProjection) {
  return projection.boundary.processes.flatMap((process) =>
    process.stages.flatMap((stage) =>
      stage.executionGroups.flatMap((group) => group.tasks),
    ),
  );
}

/** Selects the viewing actor's exact executable calculation task inside a parallel group. */
export function selectCurrentCombatModifierValidationTask(input: {
  allowedParticipantIds?: ReadonlySet<string>;
  kind: "attack" | "parry";
  projection: CombatProgressionProjection;
}): CombatProgressionTask | undefined {
  return progressionTasks(input.projection).find(
    (task) =>
      task.kind === input.kind &&
      task.state === "executable" &&
      task.owner?.kind === "combatant" &&
      (!input.allowedParticipantIds ||
        input.allowedParticipantIds.has(task.owner.participantId)),
  );
}
