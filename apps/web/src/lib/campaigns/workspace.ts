import type { EncounterSession, Scenario, ScenarioParticipant } from "@glantri/domain";

import { isUserAssignedToEffectiveEncounter } from "./encounterParticipantFallback";

export type CampaignWorkspaceTabId =
  | "campaign"
  | "scenario"
  | "encounter"
  | "gm-encounter"
  | "player-encounter"
  | "skill-rolls"
  | "character"
  | "combat";

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
  { id: "encounter", label: "Encounter" },
  { id: "skill-rolls", label: "Skill rolls" },
  { id: "character", label: "Character" },
  { id: "combat", label: "Combat" }
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
  void input;
  return orderedTabs;
}

function resolveFallbackCampaignWorkspaceTab(input: {
  activeEncounterId?: string;
  activeScenarioId?: string;
}): CampaignWorkspaceTabId {
  if (input.activeEncounterId && input.activeScenarioId) {
    return "encounter";
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
  });

  switch (input.requestedTab) {
    case "campaign":
      return "campaign";
    case "scenario":
      return input.activeScenarioId || !input.canAccessGmEncounter ? "scenario" : "campaign";
    case "encounter":
    case "player-encounter":
      if (!input.activeScenarioId || !input.activeEncounterId) {
        return input.canAccessGmEncounter ? fallbackTab : "encounter";
      }

      return "encounter";
    case "gm-encounter":
      if (!input.canAccessGmEncounter) {
        return fallbackTab;
      }

      return input.activeScenarioId && input.activeEncounterId ? "encounter" : fallbackTab;
    case "skill-rolls":
      return input.activeScenarioId && input.activeEncounterId
        ? "skill-rolls"
        : input.canAccessGmEncounter
          ? fallbackTab
          : "skill-rolls";
    case "character":
      return input.activeScenarioId ? "character" : fallbackTab;
    case "combat":
      return "combat";
    default:
      return fallbackTab;
  }
}

function getEncounterStatusRank(status: EncounterSession["status"]): number {
  switch (status) {
    case "active":
      return 0;
    case "planned":
      return 1;
    case "paused":
      return 2;
    case "setup":
      return 3;
    case "complete":
      return 4;
    case "archived":
      return 99;
    default:
      return 50;
  }
}

function isPlayerAssignedToEncounter(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
  userId?: string | null;
}): boolean {
  return isUserAssignedToEffectiveEncounter({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
    userId: input.userId,
  });
}

function resolvePlayerEncounterSelection(input: {
  activeScenarioId?: string;
  encounters: EncounterSession[];
  requestedEncounterId?: string | null;
  scenarioParticipants: ScenarioParticipant[];
  userId?: string | null;
}): EncounterSession | undefined {
  const candidateEncounters = input.encounters
    .filter((encounter) => !input.activeScenarioId || encounter.scenarioId === input.activeScenarioId)
    .filter((encounter) =>
      isPlayerAssignedToEncounter({
        encounter,
        scenarioParticipants: input.scenarioParticipants,
        userId: input.userId,
      })
    );

  if (input.requestedEncounterId) {
    const requestedEncounter = candidateEncounters.find(
      (encounter) => encounter.id === input.requestedEncounterId
    );

    if (requestedEncounter) {
      return requestedEncounter;
    }
  }

  return [...candidateEncounters].sort(
    (left, right) =>
      getEncounterStatusRank(left.status) - getEncounterStatusRank(right.status) ||
      left.title.localeCompare(right.title)
  )[0];
}

function resolveGmCombatEncounterSelection(input: {
  activeScenarioId?: string;
  encounters: EncounterSession[];
  requestedEncounterId?: string | null;
}): EncounterSession | undefined {
  const candidateEncounters = input.encounters
    .filter((encounter) => !input.activeScenarioId || encounter.scenarioId === input.activeScenarioId)
    .filter((encounter) => encounter.status !== "archived");

  if (input.requestedEncounterId) {
    return candidateEncounters.find((encounter) => encounter.id === input.requestedEncounterId);
  }

  if (candidateEncounters.length === 1) {
    return candidateEncounters[0];
  }

  return undefined;
}

export function resolveCampaignWorkspaceState(input: {
  activeCampaignId: string;
  canAccessGmEncounter: boolean;
  encounters: EncounterSession[];
  currentUserId?: string | null;
  rememberedEncounterId?: string | null;
  rememberedScenarioId?: string | null;
  rememberedTab?: string | null;
  requestedEncounterId?: string | null;
  requestedScenarioId?: string | null;
  requestedTab?: string | null;
  scenarioParticipants?: ScenarioParticipant[];
  scenarios: Scenario[];
}): CampaignWorkspaceState {
  const requestedScenarioId = input.requestedScenarioId ?? input.rememberedScenarioId;
  const requestedEncounterId = input.requestedEncounterId ?? input.rememberedEncounterId;
  const requestedTab = input.requestedTab ?? input.rememberedTab;
  let activeScenarioId = input.scenarios.some(
    (scenario) => scenario.id === requestedScenarioId
  )
    ? requestedScenarioId ?? undefined
    : undefined;
  let activeEncounterId = input.encounters.some(
    (encounter) =>
      Boolean(activeScenarioId) &&
      encounter.id === requestedEncounterId &&
      encounter.scenarioId === activeScenarioId
  )
    ? requestedEncounterId ?? undefined
    : undefined;

  if (!input.canAccessGmEncounter) {
    if (
      !activeScenarioId &&
      (
        requestedTab === "scenario" ||
        requestedTab === "character" ||
        requestedTab === "combat" ||
        requestedTab === "encounter" ||
        requestedTab === "skill-rolls"
      ) &&
      input.scenarios.length === 1
    ) {
      activeScenarioId = input.scenarios[0]?.id;
    }

    if (
      !activeScenarioId &&
      (requestedTab === "player-encounter" || requestedTab === "encounter" || requestedTab === "skill-rolls") &&
      input.scenarios.length === 1
    ) {
      activeScenarioId = input.scenarios[0]?.id;
    }

    if (requestedTab === "player-encounter" || requestedTab === "encounter" || requestedTab === "skill-rolls") {
      const playerEncounter = resolvePlayerEncounterSelection({
        activeScenarioId,
        encounters: input.encounters,
        requestedEncounterId,
        scenarioParticipants: input.scenarioParticipants ?? [],
        userId: input.currentUserId,
      });

      if (playerEncounter) {
        activeEncounterId = playerEncounter.id;
        activeScenarioId = playerEncounter.scenarioId ?? activeScenarioId;
      } else {
        activeEncounterId = undefined;
      }
    }
  } else if (requestedTab === "combat") {
    if (!activeScenarioId && input.scenarios.length === 1) {
      activeScenarioId = input.scenarios[0]?.id;
    }

    const explicitlyRequestedEncounter = input.requestedEncounterId
      ? input.encounters.find(
          (encounter) =>
            encounter.id === input.requestedEncounterId &&
            (!activeScenarioId || encounter.scenarioId === activeScenarioId)
        )
      : undefined;

    if (!explicitlyRequestedEncounter) {
      const combatEncounter = resolveGmCombatEncounterSelection({
        activeScenarioId,
        encounters: input.encounters,
        requestedEncounterId: undefined,
      });

      activeEncounterId = combatEncounter?.id;
      activeScenarioId = combatEncounter?.scenarioId ?? activeScenarioId;
    }
  }

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
