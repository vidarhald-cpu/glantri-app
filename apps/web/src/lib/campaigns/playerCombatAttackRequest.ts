import type {
  CombatAttackModifierValidationProjection,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

export interface PlayerCombatAttackModifierRequest {
  attackerModifierFingerprint: string;
  effectCutoffInitiativeGroupId?: string;
  expectedRevision: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
  modifierValidationTaskId: string;
  obSkillRaw: number;
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
  const { task, validation } = input;
  if (
    !task ||
    task.kind !== "attack" ||
    task.state !== "executable" ||
    !validation ||
    validation.attackContextAvailability !== "complete" ||
    validation.taskId !== task.id ||
    validation.encounterId !== input.encounterId ||
    validation.expectedRevision !== input.encounterRevision ||
    validation.attackerParticipantId !== input.attackerParticipantId ||
    validation.defenderParticipantId !== input.defenderParticipantId ||
    validation.phase !== input.phase ||
    validation.initiativeGroupId !== task.identity.initiativeGroupId ||
    validation.initiativeValue !== task.identity.initiativeValue ||
    validation.effectCutoffInitiativeGroupId !== task.identity.initiativeGroupId
  ) {
    return undefined;
  }

  return {
    attackerModifierFingerprint: validation.attackerModifierFingerprint,
    effectCutoffInitiativeGroupId: validation.effectCutoffInitiativeGroupId,
    expectedRevision: validation.expectedRevision,
    initiativeGroupId: validation.initiativeGroupId,
    initiativeValue: validation.initiativeValue,
    modifierValidationTaskId: validation.taskId,
    obSkillRaw: validation.obSkillRaw,
  };
}
