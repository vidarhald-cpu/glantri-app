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
  requestedEncounterId?: string | null;
  requestedScenarioId?: string | null;
  requestedTab?: string | null;
  scenarios: Scenario[];
}): CampaignWorkspaceState {
  const availableTabs = buildCampaignWorkspaceTabs({
    canAccessGmEncounter: input.canAccessGmEncounter
  });
  const activeScenarioId = input.scenarios.some(
    (scenario) => scenario.id === input.requestedScenarioId
  )
    ? input.requestedScenarioId ?? undefined
    : undefined;
  const activeEncounterId = input.encounters.some(
    (encounter) =>
      Boolean(activeScenarioId) &&
      encounter.id === input.requestedEncounterId &&
      encounter.scenarioId === activeScenarioId
  )
    ? input.requestedEncounterId ?? undefined
    : undefined;
  const requestedTab = availableTabs.find((tab) => tab.id === input.requestedTab)?.id;

  return {
    activeCampaignId: input.activeCampaignId,
    activeEncounterId,
    activeScenarioId,
    activeTab:
      requestedTab ??
      (input.requestedTab === "gm-encounter" && !input.canAccessGmEncounter
        ? "player-encounter"
        : "campaign")
  };
}
