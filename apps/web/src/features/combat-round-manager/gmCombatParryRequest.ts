import {
  fingerprintCombatModifierResolution,
  resolveCanonicalCombatParryModifierFacts,
  type CombatParryModifierValidationProjection,
  type CombatProgressionPresentationTask,
  type CombatRoundAttackRollResult,
  type CombatRoundState,
  type ScenarioParticipant,
} from "@glantri/domain";

import type { CurrentActionCommandDescriptor } from "@/features/combat-history";
import { buildCombatParryModifierRequest } from "@/lib/campaigns/combatParryModifierRequest";

/** Resolves the GM proxy tuple from the exact projected parry task, never the inspector. */
export function buildGmCombatParryModifierRequest(input: {
  attackerScenarioParticipant?: ScenarioParticipant;
  attackResult: CombatRoundAttackRollResult;
  defenderCombatantId: string;
  defenderScenarioParticipant: ScenarioParticipant;
  descriptor: CurrentActionCommandDescriptor;
  encounterId: string;
  encounterRevision?: string;
  projectedTask?: CombatProgressionPresentationTask;
  roundState: CombatRoundState;
}) {
  const { descriptor, projectedTask } = input;
  if (
    descriptor.commandType !== "roll_parry" ||
    !descriptor.attackResultId ||
    !descriptor.opportunityId ||
    !descriptor.parryPurpose ||
    !descriptor.parrySourceId ||
    !descriptor.processId ||
    !descriptor.stageId ||
    !projectedTask
  ) {
    return undefined;
  }
  const facts = resolveCanonicalCombatParryModifierFacts({
    attackerScenarioParticipant: input.attackerScenarioParticipant,
    attackResult: input.attackResult,
    defenderCombatantId: input.defenderCombatantId,
    defenderScenarioParticipant: input.defenderScenarioParticipant,
    encounterId: input.encounterId,
    state: input.roundState,
  });
  const validation = {
    attackResultId: descriptor.attackResultId,
    attackResultModifier: facts.attackResultModifier,
    attackerParticipantId: input.attackResult.attackerParticipantId,
    dbParryRaw: facts.defenderResolution.total,
    defenderModifierFingerprint: fingerprintCombatModifierResolution(facts.defenderResolution),
    defenderParticipantId: input.defenderCombatantId,
    effectCutoffInitiativeGroupId: descriptor.initiativeGroupId,
    encounterId: input.encounterId,
    expectedRevision: descriptor.expectedRevision,
    initiativeGroupId: descriptor.initiativeGroupId,
    initiativeValue: descriptor.initiativeValue,
    opportunityId: descriptor.opportunityId,
    parryPurpose: descriptor.parryPurpose,
    parrySourceId: descriptor.parrySourceId,
    processId: descriptor.processId,
    stageId: descriptor.stageId,
    taskId: descriptor.taskId,
  } satisfies CombatParryModifierValidationProjection;

  return buildCombatParryModifierRequest({
    attackResultId: descriptor.attackResultId,
    attackerParticipantId: input.attackResult.attackerParticipantId,
    defenderParticipantId: input.defenderCombatantId,
    encounterId: input.encounterId,
    encounterRevision: input.encounterRevision,
    opportunityId: descriptor.opportunityId,
    parryPurpose: descriptor.parryPurpose,
    parrySourceId: descriptor.parrySourceId,
    processId: descriptor.processId,
    stageId: descriptor.stageId,
    task: projectedTask,
    validation,
  });
}
