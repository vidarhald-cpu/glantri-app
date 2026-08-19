import { AsyncLocalStorage } from "node:async_hooks";

import type { CampaignService, ScenarioService } from "@glantri/database";

type ScenarioWorkspaceAccessIntent = "read" | "write";

const requestAccessIntent = new AsyncLocalStorage<ScenarioWorkspaceAccessIntent>();

export function runScenarioWorkspaceAccessRequest<T>(method: string, operation: () => T): T {
  return requestAccessIntent.run(
    method === "GET" || method === "HEAD" ? "read" : "write",
    operation,
  );
}

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

  const accessIntent = input.accessIntent ?? requestAccessIntent.getStore() ?? "write";
  const hasLivePlayerAccess = await services.scenarioService.userHasPlayerScenarioAccess({
    scenarioId: input.scenarioId,
    userId: input.userId,
  });
  const hasPlayerAccess =
    hasLivePlayerAccess ||
    (accessIntent === "read" &&
      (await services.scenarioService.userHasPlayerScenarioAccess({
        includePaused: true,
        scenarioId: input.scenarioId,
        userId: input.userId,
      })));

  return hasPlayerAccess
    ? {
        campaignId: campaign.id,
        mode: "player",
      }
    : null;
}
