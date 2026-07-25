import type {
  CombatParryModifierValidationProjection,
  CombatProgressionPresentationTask,
} from "@glantri/domain";

export interface CombatParryModifierRequest {
  attackResultModifier: number;
  dbParryRaw: number;
  defenderModifierFingerprint: string;
  effectCutoffInitiativeGroupId?: string;
  expectedRevision: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
  modifierValidationTaskId: string;
}

/** Binds a parry mutation to the exact task, effect cutoff, and canonical modifier facts. */
export function buildCombatParryModifierRequest(input: {
  attackResultId: string;
  attackerParticipantId: string;
  defenderParticipantId: string;
  encounterId: string;
  encounterRevision?: string;
  opportunityId: string;
  parryPurpose: "ordinary_defense" | "offensive_parry";
  parrySourceId: string;
  processId: string;
  stageId: string;
  task?: CombatProgressionPresentationTask;
  validation?: CombatParryModifierValidationProjection;
}): CombatParryModifierRequest | undefined {
  const { task, validation } = input;
  if (
    !task ||
    task.kind !== "parry" ||
    task.state !== "executable" ||
    !validation ||
    validation.taskId !== task.id ||
    validation.encounterId !== input.encounterId ||
    validation.expectedRevision !== input.encounterRevision ||
    validation.attackResultId !== input.attackResultId ||
    validation.attackerParticipantId !== input.attackerParticipantId ||
    validation.defenderParticipantId !== input.defenderParticipantId ||
    validation.opportunityId !== input.opportunityId ||
    validation.parryPurpose !== input.parryPurpose ||
    validation.parrySourceId !== input.parrySourceId ||
    validation.processId !== input.processId ||
    validation.stageId !== input.stageId ||
    validation.initiativeGroupId !== task.identity.initiativeGroupId ||
    validation.initiativeValue !== task.identity.initiativeValue ||
    validation.effectCutoffInitiativeGroupId !== task.identity.initiativeGroupId
  ) {
    return undefined;
  }

  return {
    attackResultModifier: validation.attackResultModifier,
    dbParryRaw: validation.dbParryRaw,
    defenderModifierFingerprint: validation.defenderModifierFingerprint,
    effectCutoffInitiativeGroupId: validation.effectCutoffInitiativeGroupId,
    expectedRevision: validation.expectedRevision,
    initiativeGroupId: validation.initiativeGroupId,
    initiativeValue: validation.initiativeValue,
    modifierValidationTaskId: validation.taskId,
  };
}
