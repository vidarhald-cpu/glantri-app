import type {
  CombatAttackModifierValidationProjection,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

export type PlayerCombatAttackContextAvailability =
  | { status: "not_applicable" }
  | { message: "Loading attack context…"; status: "loading" }
  | { message: "Attack context changed. Refreshing…"; status: "stale" }
  | {
      message: "Required attack context is unavailable. Ask the GM to reopen the modifier checkpoint.";
      status: "unavailable_required";
    }
  | { status: "complete" };

/**
 * Classifies only the revision-bound facts needed to invoke the current attack. Broader attacker
 * and defender summaries remain presentation-only and are not prerequisites here.
 */
export function projectPlayerCombatAttackContextAvailability(input: {
  attackerParticipantId?: string;
  attackSourceAvailable: boolean;
  defenderParticipantId?: string;
  encounterId?: string;
  encounterRevision?: string;
  historyRevision?: string;
  refreshPending: boolean;
  task?: CombatProgressionPresentationTask;
  validation?: CombatAttackModifierValidationProjection;
}): PlayerCombatAttackContextAvailability {
  const task = input.task;
  if (!task || task.kind !== "attack" || task.state !== "executable") {
    return { status: "not_applicable" };
  }
  if (
    input.refreshPending ||
    !input.encounterId ||
    !input.encounterRevision ||
    !input.historyRevision
  ) {
    return { message: "Loading attack context…", status: "loading" };
  }
  if (input.encounterRevision !== input.historyRevision) {
    return { message: "Attack context changed. Refreshing…", status: "stale" };
  }
  if (!input.attackSourceAvailable) {
    return {
      message:
        "Required attack context is unavailable. Ask the GM to reopen the modifier checkpoint.",
      status: "unavailable_required",
    };
  }

  const validation = input.validation;
  if (!validation) {
    return {
      message:
        "Required attack context is unavailable. Ask the GM to reopen the modifier checkpoint.",
      status: "unavailable_required",
    };
  }
  if (
    validation.expectedRevision !== input.encounterRevision ||
    validation.encounterId !== input.encounterId ||
    validation.taskId !== task.id ||
    validation.opportunityId !== task.identity.opportunityId ||
    validation.phase !== task.identity.phase ||
    validation.attackerParticipantId !== input.attackerParticipantId ||
    validation.defenderParticipantId !== input.defenderParticipantId
  ) {
    return { message: "Attack context changed. Refreshing…", status: "stale" };
  }
  if (validation.attackContextAvailability !== "complete") {
    return {
      message:
        "Required attack context is unavailable. Ask the GM to reopen the modifier checkpoint.",
      status: "unavailable_required",
    };
  }
  return { status: "complete" };
}
