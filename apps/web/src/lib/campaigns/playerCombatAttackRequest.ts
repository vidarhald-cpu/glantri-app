import type {
  CombatAttackModifierValidationProjection,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

export interface PlayerCombatAttackModifierRequest {
  attackerModifierFingerprint: string;
  defenderDbParryRaw: number;
  defenderModifierFingerprint: string;
  expectedRevision: string;
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
    validation.taskId !== task.id ||
    validation.encounterId !== input.encounterId ||
    validation.expectedRevision !== input.encounterRevision ||
    validation.attackerParticipantId !== input.attackerParticipantId ||
    validation.defenderParticipantId !== input.defenderParticipantId ||
    validation.phase !== input.phase
  ) {
    return undefined;
  }

  return {
    attackerModifierFingerprint: validation.attackerModifierFingerprint,
    defenderDbParryRaw: validation.defenderDbParryRaw,
    defenderModifierFingerprint: validation.defenderModifierFingerprint,
    expectedRevision: validation.expectedRevision,
    modifierValidationTaskId: validation.taskId,
    obSkillRaw: validation.obSkillRaw,
  };
}
