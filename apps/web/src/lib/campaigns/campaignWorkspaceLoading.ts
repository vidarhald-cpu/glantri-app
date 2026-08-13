import type {
  Campaign,
  EncounterSessionSummary,
  PlayerAccessibleCampaign,
  PlayerAccessibleScenario,
  Scenario,
  ScenarioParticipant,
} from "@glantri/domain";

export interface CampaignWorkspaceInitialAccess {
  accessMode: "gm" | "none" | "player";
  campaign?: Campaign | PlayerAccessibleCampaign | null;
  scenarios: Array<Scenario | PlayerAccessibleScenario>;
}

export async function loadCampaignWorkspaceInitialData(input: {
  loadAccess: () => Promise<CampaignWorkspaceInitialAccess>;
  loadEncounterSummaries: (scenarioId: string) => Promise<EncounterSessionSummary[]>;
  loadMyParticipant: (scenarioId: string) => Promise<ScenarioParticipant | null | undefined>;
  loadParticipants: (scenarioId: string) => Promise<ScenarioParticipant[]>;
}): Promise<{
  access: CampaignWorkspaceInitialAccess;
  encounterSummaries: EncounterSessionSummary[];
  participants: ScenarioParticipant[];
}> {
  const access = await input.loadAccess();
  const [encounterGroups, participantGroups] = await Promise.all([
    Promise.all(access.scenarios.map((scenario) => input.loadEncounterSummaries(scenario.id))),
    Promise.all(
      access.scenarios.map((scenario) =>
        access.accessMode === "player"
          ? input
              .loadMyParticipant(scenario.id)
              .then((participant) => (participant ? [participant] : []))
          : input.loadParticipants(scenario.id),
      ),
    ),
  ]);

  return {
    access,
    encounterSummaries: encounterGroups.flat(),
    participants: participantGroups.flat(),
  };
}
