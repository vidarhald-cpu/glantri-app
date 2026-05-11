import type { CampaignService, ScenarioService } from "@glantri/database";

export async function resolveScenarioWorkspaceAccess(
  services: {
    campaignService: Pick<CampaignService, "getCampaignById">;
    scenarioService: Pick<ScenarioService, "getScenarioById" | "userHasPlayerScenarioAccess">;
  },
  input: {
    scenarioId: string;
    userId: string;
    userRoles: string[];
  }
): Promise<
  | {
      campaignId: string;
      mode: "gm" | "player";
    }
  | null
> {
  const scenario = await services.scenarioService.getScenarioById(input.scenarioId);

  if (!scenario) {
    return null;
  }

  const campaign = await services.campaignService.getCampaignById(scenario.campaignId);

  if (!campaign) {
    return null;
  }

  const isAdmin = input.userRoles.includes("admin");
  const isGameMaster = input.userRoles.includes("game_master");

  if (isAdmin || (isGameMaster && campaign.gmUserId === input.userId)) {
    return {
      campaignId: campaign.id,
      mode: "gm",
    };
  }

  const hasPlayerAccess = await services.scenarioService.userHasPlayerScenarioAccess({
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
