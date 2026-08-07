import {
  fingerprintCombatModifierResolution,
  resolveCanonicalCombatAttackModifierFacts,
  type CombatProgressionPresentationTask,
  type CombatRoundState,
  type ScenarioParticipant,
} from "@glantri/domain";

import type { CurrentActionCommandDescriptor } from "@/features/combat-history";

export interface GmCombatAttackModifierRequest {
  attackerModifierFingerprint: string;
  effectCutoffInitiativeGroupId?: string;
  expectedRevision: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
  modifierValidationTaskId: string;
  obSkillRaw: number;
}

/**
 * Resolves the GM proxy modifier request from the exact task/revision that rendered the button.
 * Inspector selection and cached loadout summaries are deliberately not inputs.
 */
export function buildGmCombatAttackModifierRequest(input: {
  attackerCombatantId: string;
  attackerScenarioParticipant: ScenarioParticipant;
  defenderCombatantId: string;
  defenderScenarioParticipant: ScenarioParticipant;
  descriptor: CurrentActionCommandDescriptor;
  encounterId: string;
  encounterRevision?: string;
  projectedTask?: CombatProgressionPresentationTask;
  roundState: CombatRoundState;
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

  const facts = resolveCanonicalCombatAttackModifierFacts({
    attackerCombatantId: input.attackerCombatantId,
    attackerScenarioParticipant: input.attackerScenarioParticipant,
    defenderCombatantId: input.defenderCombatantId,
    defenderScenarioParticipant: input.defenderScenarioParticipant,
    encounterId: input.encounterId,
    opportunityId: descriptor.opportunityId,
    phase: descriptor.phase,
    state: input.roundState,
  });

  if (
    facts.declaredOpportunity?.id !== descriptor.opportunityId ||
    facts.attackerActionId !== descriptor.actionId
  ) {
    return undefined;
  }

  return {
    attackerModifierFingerprint: fingerprintCombatModifierResolution(facts.attackerResolution),
    effectCutoffInitiativeGroupId: descriptor.initiativeGroupId,
    expectedRevision: descriptor.expectedRevision,
    initiativeGroupId: descriptor.initiativeGroupId,
    initiativeValue: descriptor.initiativeValue,
    modifierValidationTaskId: descriptor.taskId,
    obSkillRaw: facts.attackerResolution.total,
  };
}
