import type { EncounterSession, Scenario } from "@glantri/domain";

export type CampaignWorkspaceTabId =
  | "campaign"
  | "scenario"
  | "gm-encounter"
  | "player-encounter";

export interface CampaignWorkspaceTab {
  id: CampaignWorkspaceTabId;
  label: string;
}

export interface CampaignWorkspaceState {
  activeCampaignId: string;
  activeEncounterId?: string;
  activeScenarioId?: string;
  activeTab: CampaignWorkspaceTabId;
}

export interface CampaignWorkspaceHrefInput {
  campaignId: string;
  encounterId?: string | null;
  participantId?: string | null;
  scenarioId?: string | null;
  tab?: CampaignWorkspaceTabId | null;
}

const orderedTabs: CampaignWorkspaceTab[] = [
  { id: "campaign", label: "Campaign" },
  { id: "scenario", label: "Scenario" },
  { id: "gm-encounter", label: "GM Encounter" },
  { id: "player-encounter", label: "Player Encounter" }
];

export function buildCampaignWorkspaceHref(input: CampaignWorkspaceHrefInput): string {
  const searchParams = new URLSearchParams();

  if (input.tab) {
    searchParams.set("tab", input.tab);
  }

  if (input.scenarioId) {
    searchParams.set("scenarioId", input.scenarioId);
  }

  if (input.encounterId) {
    searchParams.set("encounterId", input.encounterId);
  }

  if (input.participantId) {
    searchParams.set("participantId", input.participantId);
  }

  const query = searchParams.toString();
  return query ? `/campaigns/${input.campaignId}?${query}` : `/campaigns/${input.campaignId}`;
}

export function buildCampaignWorkspaceTabs(input: {
  canAccessGmEncounter: boolean;
}): CampaignWorkspaceTab[] {
  return orderedTabs.filter(
    (tab) => input.canAccessGmEncounter || tab.id !== "gm-encounter"
  );
}

function resolveFallbackCampaignWorkspaceTab(input: {
  activeEncounterId?: string;
  activeScenarioId?: string;
  canAccessGmEncounter: boolean;
}): CampaignWorkspaceTabId {
  if (input.activeEncounterId && input.activeScenarioId) {
    return input.canAccessGmEncounter ? "gm-encounter" : "player-encounter";
  }

  if (input.activeScenarioId) {
    return "scenario";
  }

  return "campaign";
}

function resolveRequestedCampaignWorkspaceTab(input: {
  activeEncounterId?: string;
  activeScenarioId?: string;
  canAccessGmEncounter: boolean;
  requestedTab?: string | null;
}): CampaignWorkspaceTabId {
  const fallbackTab = resolveFallbackCampaignWorkspaceTab({
    activeEncounterId: input.activeEncounterId,
    activeScenarioId: input.activeScenarioId,
    canAccessGmEncounter: input.canAccessGmEncounter,
  });

  switch (input.requestedTab) {
    case "campaign":
      return "campaign";
    case "scenario":
      return input.activeScenarioId ? "scenario" : "campaign";
    case "gm-encounter":
      if (!input.activeScenarioId || !input.activeEncounterId) {
        return fallbackTab;
      }

      return input.canAccessGmEncounter ? "gm-encounter" : "player-encounter";
    case "player-encounter":
      return input.activeScenarioId && input.activeEncounterId
        ? "player-encounter"
        : fallbackTab;
    default:
      return fallbackTab;
  }
}

export function resolveCampaignWorkspaceState(input: {
  activeCampaignId: string;
  canAccessGmEncounter: boolean;
  encounters: EncounterSession[];
  rememberedEncounterId?: string | null;
  rememberedScenarioId?: string | null;
  rememberedTab?: string | null;
  requestedEncounterId?: string | null;
  requestedScenarioId?: string | null;
  requestedTab?: string | null;
  scenarios: Scenario[];
}): CampaignWorkspaceState {
  const requestedScenarioId = input.requestedScenarioId ?? input.rememberedScenarioId;
  const requestedEncounterId = input.requestedEncounterId ?? input.rememberedEncounterId;
  const requestedTab = input.requestedTab ?? input.rememberedTab;
  const activeScenarioId = input.scenarios.some(
    (scenario) => scenario.id === requestedScenarioId
  )
    ? requestedScenarioId ?? undefined
    : undefined;
  const activeEncounterId = input.encounters.some(
    (encounter) =>
      Boolean(activeScenarioId) &&
      encounter.id === requestedEncounterId &&
      encounter.scenarioId === activeScenarioId
  )
    ? requestedEncounterId ?? undefined
    : undefined;

  return {
    activeCampaignId: input.activeCampaignId,
    activeEncounterId,
    activeScenarioId,
    activeTab: resolveRequestedCampaignWorkspaceTab({
      activeEncounterId,
      activeScenarioId,
      canAccessGmEncounter: input.canAccessGmEncounter,
      requestedTab,
    })
  };
}
