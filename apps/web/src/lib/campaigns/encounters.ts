import type { EncounterSession } from "@glantri/domain";

export function getCampaignWorkspaceVisibleEncounters(input: {
  campaignId: string;
  encounters: EncounterSession[];
  scenarioIds: string[];
}): EncounterSession[] {
  const scenarioIds = new Set(input.scenarioIds);

  return input.encounters.filter((encounter) => {
    if (encounter.campaignId && encounter.campaignId !== input.campaignId) {
      return false;
    }

    if (!encounter.scenarioId) {
      return false;
    }

    return scenarioIds.has(encounter.scenarioId);
  });
}

export function getScenarioVisibleEncounters(input: {
  encounters: EncounterSession[];
  scenarioId?: string;
}): EncounterSession[] {
  if (!input.scenarioId) {
    return [];
  }

  return input.encounters.filter((encounter) => encounter.scenarioId === input.scenarioId);
}

