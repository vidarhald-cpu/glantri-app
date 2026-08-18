import type { EncounterSessionSummary } from "@glantri/domain";

export function getCampaignWorkspaceVisibleEncounters(input: {
  campaignId: string;
  encounters: EncounterSessionSummary[];
  scenarioIds: string[];
}): EncounterSessionSummary[] {
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
  encounters: EncounterSessionSummary[];
  scenarioId?: string;
}): EncounterSessionSummary[] {
  if (!input.scenarioId) {
    return [];
  }

  return input.encounters.filter((encounter) => encounter.scenarioId === input.scenarioId);
}
