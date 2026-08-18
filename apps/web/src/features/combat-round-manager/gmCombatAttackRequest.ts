import type { CombatProgressionPresentationTask } from "@glantri/domain";

import type { CurrentActionCommandDescriptor } from "@/features/combat-history";

export interface GmCombatAttackModifierRequest {
  effectCutoffInitiativeGroupId?: string;
  expectedRevision: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
  modifierValidationTaskId: string;
}

/**
 * Resolves the GM proxy modifier request from the exact task/revision that rendered the button.
 * Inspector selection and cached loadout summaries are deliberately not inputs.
 */
export function buildGmCombatAttackModifierRequest(input: {
  descriptor: CurrentActionCommandDescriptor;
  encounterId: string;
  encounterRevision?: string;
  projectedTask?: CombatProgressionPresentationTask;
}): GmCombatAttackModifierRequest | undefined {
  const { descriptor, projectedTask } = input;

  if (
    descriptor.commandType !== "roll_attack" ||
    descriptor.encounterId !== input.encounterId ||
    descriptor.expectedRevision !== input.encounterRevision ||
    !descriptor.opportunityId ||
    !descriptor.phase ||
    !projectedTask ||
    projectedTask.kind !== "attack" ||
    projectedTask.state !== "executable" ||
    projectedTask.id !== descriptor.taskId ||
    projectedTask.executionGroupId !== descriptor.executionGroupId ||
    projectedTask.identity.opportunityId !== descriptor.opportunityId ||
    projectedTask.identity.phase !== descriptor.phase ||
    projectedTask.identity.initiativeGroupId !== descriptor.initiativeGroupId ||
    projectedTask.identity.initiativeValue !== descriptor.initiativeValue
  ) {
    return undefined;
  }

  return {
    effectCutoffInitiativeGroupId: descriptor.initiativeGroupId,
    expectedRevision: descriptor.expectedRevision,
    initiativeGroupId: descriptor.initiativeGroupId,
    initiativeValue: descriptor.initiativeValue,
    modifierValidationTaskId: descriptor.taskId,
  };
}
