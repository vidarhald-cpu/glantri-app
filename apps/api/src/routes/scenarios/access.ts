import type { CampaignService, ScenarioService } from "@glantri/database";

export async function resolveScenarioWorkspaceAccess(
  services: {
    campaignService: Pick<CampaignService, "getCampaignById" | "listCampaignsByUserAccess">;
    scenarioService: Pick<ScenarioService, "getScenarioById" | "userHasPlayerScenarioAccess">;
  },
  input: {
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

  const isGameMaster = input.userRoles.includes("game_master");

  if (isGameMaster && campaign.gmUserId === input.userId) {
    return {
      campaignId: campaign.id,
      mode: "gm",
    };
  }

  const hasPlayerAccess = await services.scenarioService.userHasPlayerScenarioAccess({
    scenarioId: input.scenarioId,
    userId: input.userId,
  });

  if (!hasPlayerAccess || scenario.status === "draft") {
    return null;
  }

  const campaignsWithUserAccess = await services.campaignService.listCampaignsByUserAccess(
    input.userId,
  );

  if (
    campaignsWithUserAccess &&
    !campaignsWithUserAccess.some((candidate) => candidate.id === campaign.id)
  ) {
    return null;
  }

  return {
    campaignId: campaign.id,
    mode: "player",
  };
}
