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

export const CAMPAIGN_WORKSPACE_LOAD_ERROR_MESSAGE =
  "We couldn't load this campaign. Try again. If the problem continues, reload the page.";

export class CampaignWorkspaceLoadError extends Error {
  constructor() {
    super(CAMPAIGN_WORKSPACE_LOAD_ERROR_MESSAGE);
    this.name = "CampaignWorkspaceLoadError";
  }
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
  try {
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
  } catch {
    throw new CampaignWorkspaceLoadError();
  }
}
