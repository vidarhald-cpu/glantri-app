import type { CampaignService, ScenarioService } from "@glantri/database";

export async function resolveScenarioWorkspaceAccess(
  services: {
    campaignService: Pick<CampaignService, "getCampaignById">;
    scenarioService: Pick<ScenarioService, "getScenarioById" | "userHasPlayerScenarioAccess">;
  },
  input: {
    accessIntent?: "read" | "write";
    scenarioId: string;
    userId: string;
    userRoles: string[];
  },
): Promise<{
  campaignId: string;
  mode: "gm" | "player";
} | null> {
  const scenario = await services.scenarioService.getScenarioById(input.scenarioId);

  if (!scenario) {
    return null;
  }

  const campaign = await services.campaignService.getCampaignById(scenario.campaignId);

  if (!campaign) {
    return null;
  }

  if (campaign.gmUserId === input.userId) {
    return {
      campaignId: campaign.id,
      mode: "gm",
    };
  }

  const hasPlayerAccess = await services.scenarioService.userHasPlayerScenarioAccess({
    ...(input.accessIntent === "read" ? { includePaused: true } : {}),
    scenarioId: input.scenarioId,
    userId: input.userId,
  });

  return hasPlayerAccess
    ? {
        campaignId: campaign.id,
        mode: "player",
      }
    : null;
}
