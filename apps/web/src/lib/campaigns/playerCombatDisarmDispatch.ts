import type { EncounterSession } from "@glantri/domain";

import type { CurrentActionCommandDescriptor } from "@/features/combat-history/view-models/currentActionPresentation";
import { rollCombatDisarmOnServer } from "@/lib/api/encounterClient";

type DisarmRollSender = typeof rollCombatDisarmOnServer;

export async function dispatchPlayerCombatDisarmRoll(input: {
  characteristicChoice: "strength" | "dexterity";
  currentEncounter?: EncounterSession;
  descriptor: CurrentActionCommandDescriptor;
  encounterId: string;
  send?: DisarmRollSender;
  skillChoice: "weapon_skill" | "parry";
}): Promise<EncounterSession | undefined> {
  if (!input.descriptor.disarmAttemptId || !input.descriptor.participantId) return undefined;
  return (input.send ?? rollCombatDisarmOnServer)({
    attemptId: input.descriptor.disarmAttemptId,
    characteristicChoice: input.characteristicChoice,
    currentEncounter: input.currentEncounter,
    encounterId: input.encounterId,
    executionGroupId: input.descriptor.executionGroupId!,
    expectedRevision: input.descriptor.expectedRevision,
    scenarioParticipantId: input.descriptor.participantId,
    skillChoice: input.skillChoice,
    taskId: input.descriptor.taskId,
  });
}

export function getPlayerParryDisarmAttemptId(
  descriptor: CurrentActionCommandDescriptor,
): string | undefined {
  return descriptor.parryPurpose === "parry_disarm" ? descriptor.disarmAttemptId : undefined;
}
