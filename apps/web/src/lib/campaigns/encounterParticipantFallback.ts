import {
  formatEncounterParticipantMembershipLabel,
  isUserAssignedToEncounterMembership,
  resolveEncounterParticipantMembership,
  type EncounterParticipant,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";

export function getScenarioParticipantFallbackEncounterParticipants(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
}): EncounterParticipant[] {
  return resolveEncounterParticipantMembership(input).participants;
}

export function formatEncounterParticipantCountLabel(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
}): string {
  return formatEncounterParticipantMembershipLabel(input);
}

export function isUserAssignedToEffectiveEncounter(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
  userId?: string | null;
}): boolean {
  return isUserAssignedToEncounterMembership(input);
}

export { resolveEncounterParticipantMembership };
