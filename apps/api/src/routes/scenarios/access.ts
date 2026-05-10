import type { ScenarioService } from "@glantri/database";

export async function resolveScenarioWorkspaceAccess(
  scenarioService: ScenarioService,
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
  const scenario = await scenarioService.getScenarioById(input.scenarioId);

  if (!scenario) {
    return null;
  }

  const campaign = await scenarioService.getCampaignById(scenario.campaignId);

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

  const hasPlayerAccess = await scenarioService.userHasPlayerScenarioAccess({
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
