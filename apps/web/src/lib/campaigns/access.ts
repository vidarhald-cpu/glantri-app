import { canAccessAdmin, type AuthUser } from "@glantri/auth";
import type { Campaign, Scenario } from "@glantri/domain";

import {
  ApiRequestError,
  loadAccessibleCampaignById,
  loadAccessibleCampaigns,
  loadCampaignScenarios,
  loadCampaigns,
  type AccessibleCampaignRecord,
} from "../api/localServiceClient";
import { buildCampaignWorkspaceHref } from "./workspace";

export interface CampaignWorkspaceAccessResult {
  accessMode: "gm" | "player" | "none";
  campaign?: Campaign;
  scenarios: Scenario[];
}

function isPermissionMismatchError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && (error.status === 403 || error.status === 404);
}

export function canManageCampaignWorkspace(user?: AuthUser | null): boolean {
  return user ? canAccessAdmin(user.roles) : false;
}

export async function loadCampaignBrowserRecordsForUser(
  user?: AuthUser | null,
): Promise<AccessibleCampaignRecord[]> {
  if (canManageCampaignWorkspace(user)) {
    const campaigns = await loadCampaigns();
    return campaigns.map((campaign) => ({ campaign, scenarios: [] }));
  }

  try {
    return await loadAccessibleCampaigns();
  } catch (error) {
    if (isPermissionMismatchError(error)) {
      return [];
    }

    throw error;
  }
}

export async function loadCampaignWorkspaceAccessForUser(input: {
  campaignId: string;
  user?: AuthUser | null;
}): Promise<CampaignWorkspaceAccessResult> {
  if (canManageCampaignWorkspace(input.user)) {
    return {
      accessMode: "gm",
      scenarios: await loadCampaignScenarios(input.campaignId),
    };
  }

  try {
    const accessibleCampaign = await loadAccessibleCampaignById(input.campaignId);
    return {
      accessMode: "player",
      campaign: accessibleCampaign.campaign,
      scenarios: accessibleCampaign.scenarios,
    };
  } catch (error) {
    if (isPermissionMismatchError(error)) {
      return {
        accessMode: "none",
        scenarios: [],
      };
    }

    throw error;
  }
}

export function resolveCampaignResumeDestination(input: {
  accessibleCampaigns: AccessibleCampaignRecord[];
  rememberedCampaignId?: string | null;
  rememberedEncounterId?: string | null;
  rememberedParticipantId?: string | null;
  rememberedScenarioId?: string | null;
  rememberedTab?: string | null;
}): {
  clearRememberedCampaign: boolean;
  href: string;
} {
  const rememberedCampaignId = input.rememberedCampaignId ?? undefined;

  if (
    rememberedCampaignId &&
    input.accessibleCampaigns.some((record) => record.campaign.id === rememberedCampaignId)
  ) {
    return {
      clearRememberedCampaign: false,
      href: buildCampaignWorkspaceHref({
        campaignId: rememberedCampaignId,
        encounterId: input.rememberedEncounterId,
        participantId:
          input.rememberedTab === "player-encounter" ? input.rememberedParticipantId : undefined,
        scenarioId: input.rememberedScenarioId,
        tab:
          input.rememberedTab === "campaign" ||
          input.rememberedTab === "scenario" ||
          input.rememberedTab === "gm-encounter" ||
          input.rememberedTab === "player-encounter"
            ? input.rememberedTab
            : "campaign",
      }),
    };
  }

  return {
    clearRememberedCampaign: Boolean(rememberedCampaignId),
    href: "/campaigns",
  };
}

