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

const orderedTabs: CampaignWorkspaceTab[] = [
  { id: "campaign", label: "Campaign" },
  { id: "scenario", label: "Scenario" },
  { id: "gm-encounter", label: "GM Encounter" },
  { id: "player-encounter", label: "Player Encounter" }
];

export function buildCampaignWorkspaceTabs(input: {
  canAccessGmEncounter: boolean;
}): CampaignWorkspaceTab[] {
  return orderedTabs.filter(
    (tab) => input.canAccessGmEncounter || tab.id !== "gm-encounter"
  );
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
  const availableTabs = buildCampaignWorkspaceTabs({
    canAccessGmEncounter: input.canAccessGmEncounter
  });
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
  const activeRequestedTab = availableTabs.find((tab) => tab.id === requestedTab)?.id;

  return {
    activeCampaignId: input.activeCampaignId,
    activeEncounterId,
    activeScenarioId,
    activeTab:
      activeRequestedTab ??
      (requestedTab === "gm-encounter" && !input.canAccessGmEncounter
        ? "player-encounter"
        : "campaign")
  };
}
