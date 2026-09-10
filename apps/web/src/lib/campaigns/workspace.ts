import {
  isUserEntitledToTerminalEncounterHistory,
  type EncounterSession,
  type EncounterSessionSummary,
  type PlayerAccessibleScenario,
  type Scenario,
  type ScenarioParticipant,
} from "@glantri/domain";

import { isUserAssignedToEffectiveEncounter } from "./encounterParticipantFallback";

export type CampaignWorkspaceTabId =
  | "campaign"
  | "blackboard"
  | "items"
  | "scenario"
  | "encounter"
  | "gm-encounter"
  | "player-encounter"
  | "skill-rolls"
  | "player-skill-rolls"
  | "character"
  | "combat"
  | "player-combat";

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
  blackboardCategory?: string | null;
  blackboardPinned?: string | null;
  blackboardQuery?: string | null;
  campaignId: string;
  encounterId?: string | null;
  entryId?: string | null;
  participantId?: string | null;
  scenarioId?: string | null;
  tab?: CampaignWorkspaceTabId | null;
}

const orderedTabs: CampaignWorkspaceTab[] = [
  { id: "campaign", label: "Campaign" },
  { id: "blackboard", label: "Blackboard" },
  { id: "items", label: "Items" },
  { id: "scenario", label: "Scenario" },
  { id: "encounter", label: "Encounter" },
  { id: "skill-rolls", label: "Skill rolls" },
  { id: "player-skill-rolls", label: "Player skill rolls" },
  { id: "character", label: "Character" },
  { id: "combat", label: "Combat" },
  { id: "player-combat", label: "Player combat" },
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

  if (input.entryId) {
    searchParams.set("entryId", input.entryId);
  }

  if (input.blackboardQuery) {
    searchParams.set("blackboardQuery", input.blackboardQuery);
  }

  if (input.blackboardCategory) {
    searchParams.set("blackboardCategory", input.blackboardCategory);
  }

  if (input.blackboardPinned) {
    searchParams.set("blackboardPinned", input.blackboardPinned);
  }

  const query = searchParams.toString();
  return query ? `/campaigns/${input.campaignId}?${query}` : `/campaigns/${input.campaignId}`;
}

export function buildCampaignWorkspaceTabs(input: {
  canAccessGmEncounter: boolean;
}): CampaignWorkspaceTab[] {
  return input.canAccessGmEncounter
    ? orderedTabs
    : orderedTabs.filter((tab) => tab.id !== "combat" && tab.id !== "items");
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
    case "blackboard":
      return "blackboard";
    case "items":
      return input.canAccessGmEncounter ? "items" : fallbackTab;
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
    case "player-skill-rolls":
      return input.activeScenarioId && input.activeEncounterId
        ? "player-skill-rolls"
        : input.canAccessGmEncounter
          ? fallbackTab
          : "player-skill-rolls";
    case "character":
      return input.activeScenarioId ? "character" : fallbackTab;
    case "combat":
      return input.canAccessGmEncounter
        ? "combat"
        : input.activeScenarioId
          ? "player-combat"
          : fallbackTab;
    case "player-combat":
      return input.activeScenarioId ? "player-combat" : fallbackTab;
    default:
      return fallbackTab;
  }
}

type WorkspaceEncounterSummary = EncounterSessionSummary | EncounterSession;

function getEncounterStatusRank(status: EncounterSessionSummary["status"]): number {
  switch (status) {
    case "active":
      return 0;
    case "draft":
      return 1;
    case "paused":
      return 2;
    case "completed":
      return 4;
    case "archived":
      return 99;
    default:
      return 50;
  }
}

function isSelectableWorkspaceEncounter(encounter: WorkspaceEncounterSummary): boolean {
  return encounter.status !== "archived" && encounter.status !== "completed";
}

function isTerminalScenario(scenario: Scenario | PlayerAccessibleScenario): boolean {
  return scenario.status === "completed" || scenario.status === "archived";
}

function isHistoricalWorkspaceTab(tab?: string | null): boolean {
  return tab === "scenario" || tab === "encounter" || tab === "player-encounter";
}

function isPlayerAssignedToEncounter(input: {
  encounter: WorkspaceEncounterSummary;
  scenarioParticipants: ScenarioParticipant[];
  userId?: string | null;
}): boolean {
  if ("viewerAssigned" in input.encounter && input.encounter.viewerAssigned !== undefined) {
    return input.encounter.viewerAssigned;
  }

  if (!("participants" in input.encounter)) {
    return false;
  }

  if (input.encounter.status === "completed" || input.encounter.status === "archived") {
    return isUserEntitledToTerminalEncounterHistory({
      encounter: {
        participantMembershipMode: input.encounter.participantMembershipMode,
        participants: input.encounter.participants,
        scenarioId: input.encounter.scenarioId,
        status: input.encounter.status,
      },
      scenarioParticipants: input.scenarioParticipants,
      userId: input.userId,
    });
  }

  return isUserAssignedToEffectiveEncounter({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
    userId: input.userId,
  });
}

function resolvePlayerEncounterSelection(input: {
  activeScenarioId?: string;
  encounters: WorkspaceEncounterSummary[];
  requestedEncounterId?: string | null;
  scenarioParticipants: ScenarioParticipant[];
  userId?: string | null;
  allowTerminalRequested?: boolean;
  requireActive?: boolean;
}): WorkspaceEncounterSummary | undefined {
  const assignedEncounters = input.encounters
    .filter(
      (encounter) => !input.activeScenarioId || encounter.scenarioId === input.activeScenarioId,
    )
    .filter((encounter) =>
      isPlayerAssignedToEncounter({
        encounter,
        scenarioParticipants: input.scenarioParticipants,
        userId: input.userId,
      }),
    );

  if (input.requestedEncounterId) {
    const requestedEncounter = assignedEncounters.find(
      (encounter) =>
        encounter.id === input.requestedEncounterId &&
        (isSelectableWorkspaceEncounter(encounter) || input.allowTerminalRequested) &&
        (!input.requireActive || encounter.status === "active"),
    );

    if (requestedEncounter) {
      return requestedEncounter;
    }
  }

  const candidateEncounters = assignedEncounters
    .filter(isSelectableWorkspaceEncounter)
    .filter((encounter) => !input.requireActive || encounter.status === "active");

  return [...candidateEncounters].sort(
    (left, right) =>
      getEncounterStatusRank(left.status) - getEncounterStatusRank(right.status) ||
      left.title.localeCompare(right.title),
  )[0];
}

function resolveGmCombatEncounterSelection(input: {
  activeScenarioId?: string;
  encounters: WorkspaceEncounterSummary[];
  requestedEncounterId?: string | null;
}): WorkspaceEncounterSummary | undefined {
  const candidateEncounters = input.encounters
    .filter(
      (encounter) => !input.activeScenarioId || encounter.scenarioId === input.activeScenarioId,
    )
    .filter((encounter) => encounter.status === "active");

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
  encounters: WorkspaceEncounterSummary[];
  currentUserId?: string | null;
  rememberedEncounterId?: string | null;
  rememberedScenarioId?: string | null;
  rememberedTab?: string | null;
  requestedEncounterId?: string | null;
  requestedScenarioId?: string | null;
  requestedTab?: string | null;
  scenarioParticipants?: ScenarioParticipant[];
  scenarios: Array<Scenario | PlayerAccessibleScenario>;
}): CampaignWorkspaceState {
  const requestedScenarioId = input.requestedScenarioId ?? input.rememberedScenarioId;
  const requestedEncounterId = input.requestedEncounterId ?? input.rememberedEncounterId;
  const requestedTab = input.requestedTab ?? input.rememberedTab;
  const selectableScenarios = input.scenarios.filter((scenario) => !isTerminalScenario(scenario));
  const requestedScenario = input.scenarios.find((scenario) => scenario.id === requestedScenarioId);
  const terminalScenarioExplicitlyRequested = Boolean(
    input.requestedScenarioId &&
    requestedScenario?.id === input.requestedScenarioId &&
    isHistoricalWorkspaceTab(input.requestedTab),
  );
  const terminalEncounterExplicitlyRequested = Boolean(
    input.requestedEncounterId && isHistoricalWorkspaceTab(input.requestedTab),
  );
  let activeScenarioId =
    requestedScenario &&
    (!isTerminalScenario(requestedScenario) || terminalScenarioExplicitlyRequested)
      ? requestedScenario.id
      : undefined;
  let activeEncounterId = input.encounters.some(
    (encounter) =>
      Boolean(activeScenarioId) &&
      encounter.id === requestedEncounterId &&
      encounter.scenarioId === activeScenarioId &&
      (isSelectableWorkspaceEncounter(encounter) || terminalEncounterExplicitlyRequested),
  )
    ? (requestedEncounterId ?? undefined)
    : undefined;

  if (!input.canAccessGmEncounter) {
    if (
      !activeScenarioId &&
      (requestedTab === "scenario" ||
        requestedTab === "character" ||
        requestedTab === "combat" ||
        requestedTab === "player-combat" ||
        requestedTab === "encounter" ||
        requestedTab === "skill-rolls" ||
        requestedTab === "player-skill-rolls") &&
      selectableScenarios.length === 1
    ) {
      activeScenarioId = selectableScenarios[0]?.id;
    }

    if (
      !activeScenarioId &&
      (requestedTab === "player-encounter" ||
        requestedTab === "encounter" ||
        requestedTab === "skill-rolls" ||
        requestedTab === "player-skill-rolls" ||
        requestedTab === "player-combat") &&
      selectableScenarios.length === 1
    ) {
      activeScenarioId = selectableScenarios[0]?.id;
    }

    if (
      requestedTab === "player-encounter" ||
      requestedTab === "encounter" ||
      requestedTab === "skill-rolls" ||
      requestedTab === "player-skill-rolls" ||
      requestedTab === "combat" ||
      requestedTab === "player-combat"
    ) {
      const playerEncounter = resolvePlayerEncounterSelection({
        activeScenarioId,
        encounters: input.encounters,
        requestedEncounterId,
        scenarioParticipants: input.scenarioParticipants ?? [],
        userId: input.currentUserId,
        allowTerminalRequested: terminalEncounterExplicitlyRequested,
        requireActive: requestedTab === "combat" || requestedTab === "player-combat",
      });

      if (playerEncounter) {
        activeEncounterId = playerEncounter.id;
        activeScenarioId = playerEncounter.scenarioId ?? activeScenarioId;
      } else {
        activeEncounterId = undefined;
      }
    }
  } else if (requestedTab === "combat" || requestedTab === "player-combat") {
    if (!activeScenarioId && selectableScenarios.length === 1) {
      activeScenarioId = selectableScenarios[0]?.id;
    }

    const explicitlyRequestedEncounter = input.requestedEncounterId
      ? input.encounters.find(
          (encounter) =>
            encounter.id === input.requestedEncounterId &&
            (!activeScenarioId || encounter.scenarioId === activeScenarioId) &&
            encounter.status === "active",
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
    }),
  };
}
