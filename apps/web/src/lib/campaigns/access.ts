import { canAccessAdmin, type AuthUser } from "@glantri/auth";
import type {
  Campaign,
  PlayerAccessibleCampaign,
  PlayerAccessibleScenario,
  PlayerCampaignHomeRecord,
  Scenario,
} from "@glantri/domain";

import { ApiRequestError } from "../api/apiClient";
import {
  loadAccessibleCampaignById,
  loadAccessibleCampaigns,
  loadCampaignScenarios,
  loadCampaigns,
  type AccessibleCampaignRecord,
} from "../api/campaignClient";
import { buildCampaignWorkspaceHref } from "./workspace";

export interface CampaignWorkspaceAccessResult {
  accessMode: "gm" | "player" | "none";
  campaign?: Campaign | PlayerAccessibleCampaign;
  scenarios: Array<Scenario | PlayerAccessibleScenario>;
}

export function resolvePlayerCampaignResumeDestination(input: {
  campaigns: PlayerCampaignHomeRecord[];
  rememberedCampaignId?: string | null;
}): {
  clearRememberedCampaign: boolean;
  href: string;
} {
  const rememberedCampaignId = input.rememberedCampaignId ?? undefined;
  const rememberedCampaign = rememberedCampaignId
    ? input.campaigns.find((record) => record.campaign.id === rememberedCampaignId)
    : undefined;
  const campaign =
    rememberedCampaign ?? (input.campaigns.length === 1 ? input.campaigns[0] : undefined);

  if (!campaign) {
    return {
      clearRememberedCampaign: Boolean(rememberedCampaignId),
      href: "/campaigns",
    };
  }

  return {
    clearRememberedCampaign: Boolean(rememberedCampaignId && !rememberedCampaign),
    href: buildCampaignWorkspaceHref({
      campaignId: campaign.campaign.id,
      encounterId: campaign.resume.encounterId,
      scenarioId: campaign.resume.scenarioId,
      tab: campaign.resume.tab,
    }),
  };
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
          input.rememberedTab === "player-encounter" ||
          input.rememberedTab === "encounter" ||
          input.rememberedTab === "skill-rolls"
            ? input.rememberedParticipantId
            : undefined,
        scenarioId: input.rememberedScenarioId,
        tab:
          input.rememberedTab === "campaign" ||
          input.rememberedTab === "items" ||
          input.rememberedTab === "scenario" ||
          input.rememberedTab === "encounter" ||
          input.rememberedTab === "skill-rolls" ||
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
