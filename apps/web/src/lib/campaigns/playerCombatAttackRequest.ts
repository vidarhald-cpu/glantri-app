import type {
  CombatAttackModifierValidationProjection,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

export interface PlayerCombatAttackModifierRequest {
  effectCutoffInitiativeGroupId?: string;
  expectedRevision: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
  modifierValidationTaskId: string;
}

export function hasMatchingPlayerCombatAttackIdentity(input: {
  attackerParticipantId?: string;
  defenderParticipantId?: string;
  encounterId?: string;
  encounterRevision?: string;
  phase?: "phase1" | "phase2";
  task?: CombatProgressionPresentationTask;
  validation?: CombatAttackModifierValidationProjection;
}): boolean {
  const { task, validation } = input;
  return Boolean(
    input.attackerParticipantId &&
    input.defenderParticipantId &&
    input.encounterId &&
    input.encounterRevision &&
    task &&
    task.kind === "attack" &&
    task.state === "executable" &&
    task.owner?.kind === "combatant" &&
    task.owner.participantId === input.attackerParticipantId &&
    task.executionGroupId === task.identity.executionGroupId &&
    task.identity.attackerParticipantId === input.attackerParticipantId &&
    task.identity.defenderParticipantId === input.defenderParticipantId &&
    task.identity.phase === input.phase &&
    task.identity.opportunityId &&
    task.identity.initiativeGroupId &&
    typeof task.identity.initiativeValue === "number" &&
    validation &&
    validation.taskId === task.id &&
    validation.encounterId === input.encounterId &&
    validation.expectedRevision === input.encounterRevision &&
    validation.attackerParticipantId === input.attackerParticipantId &&
    validation.defenderParticipantId === input.defenderParticipantId &&
    validation.phase === input.phase &&
    validation.opportunityId === task.identity.opportunityId &&
    validation.initiativeGroupId === task.identity.initiativeGroupId &&
    validation.initiativeValue === task.identity.initiativeValue &&
    validation.effectCutoffInitiativeGroupId === task.identity.initiativeGroupId,
  );
}

/**
 * Binds the attack request to the same encounter revision and projected task that rendered the
 * action. Values are never reconstructed from a separate snapshot or local inspector state.
 */
export function buildPlayerCombatAttackModifierRequest(input: {
  attackerParticipantId: string;
  defenderParticipantId: string;
  encounterId: string;
  encounterRevision?: string;
  phase: "phase1" | "phase2";
  task?: CombatProgressionPresentationTask;
  validation?: CombatAttackModifierValidationProjection;
}): PlayerCombatAttackModifierRequest | undefined {
  const { validation } = input;
  if (
    !hasMatchingPlayerCombatAttackIdentity(input) ||
    !validation ||
    validation.attackContextAvailability !== "complete"
  ) {
    return undefined;
  }

  return {
    effectCutoffInitiativeGroupId: validation.effectCutoffInitiativeGroupId,
    expectedRevision: validation.expectedRevision,
    initiativeGroupId: validation.initiativeGroupId,
    initiativeValue: validation.initiativeValue,
    modifierValidationTaskId: validation.taskId,
  };
}
