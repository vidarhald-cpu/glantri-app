import { isCampaignGameMaster } from "@glantri/auth";
import type { CampaignService, ScenarioService } from "@glantri/database";

/**
 * The canonical Scenario workspace gate.
 *
 * Its GM predicate is unchanged in behaviour: it required the `game_master` role **and**
 * `Campaign.gmUserId` before Forgejo issue #977 and it requires exactly the same pair now. The
 * only change is that the pair is no longer written inline here. It is the shared
 * `isCampaignGameMaster`, which the controller-conflict exemption in
 * `packages/database/src/services/scenarioParticipantSupport.ts` now also calls, so the two
 * cannot drift apart again. #977 narrowed that exemption onto this gate's predicate; nothing
 * here was relaxed to meet it.
 */
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

  if (
    isCampaignGameMaster({
      campaignGmUserId: campaign.gmUserId,
      userId: input.userId,
      userRoles: input.userRoles,
    })
  ) {
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
