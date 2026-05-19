import { describe, expect, it } from "vitest";

import type { EncounterSession, Scenario, ScenarioParticipant } from "@glantri/domain";

import { buildCampaignWorkspaceTabs, resolveCampaignWorkspaceState } from "./workspace";

function scenario(input: Pick<Scenario, "id" | "name">): Scenario {
  return {
    campaignId: "camp-1",
    createdAt: "2026-04-23T00:00:00.000Z",
    description: "",
    id: input.id,
    kind: "mixed",
    name: input.name,
    status: "draft",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
}

function encounter(input: {
  id: string;
  kind?: EncounterSession["kind"];
  participantMembershipMode?: EncounterSession["participantMembershipMode"];
  scenarioId: string;
  status?: EncounterSession["status"];
  title?: string;
  scenarioParticipantId?: string;
}): EncounterSession {
  return {
    actionLog: [],
    campaignId: "camp-1",
    createdAt: "2026-04-23T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: input.id,
    kind: input.kind ?? "roleplay",
    participantMembershipMode: input.participantMembershipMode,
    participants: input.scenarioParticipantId
      ? [
          {
            id: `encounter-participant-${input.scenarioParticipantId}`,
            initiative: 0,
            label: "The Gladiator",
            order: 0,
            participantType: "scenario",
            scenarioParticipantId: input.scenarioParticipantId,
          } as EncounterSession["participants"][number],
        ]
      : [],
    scenarioId: input.scenarioId,
    status: input.status ?? "planned",
    title: input.title ?? "Market shadows",
    turnOrderMode: "manual",
    updatedAt: "2026-04-23T00:00:00.000Z",
  };
}

function scenarioParticipant(input: {
  controlledByUserId?: string;
  id: string;
  isActive?: boolean;
  name?: string;
  scenarioId: string;
}): ScenarioParticipant {
  return {
    controlledByUserId: input.controlledByUserId,
    id: input.id,
    isActive: input.isActive ?? true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: input.scenarioId,
    snapshot: {
      displayName: input.name ?? input.id,
    },
    sourceType: "character",
  } as ScenarioParticipant;
}

describe("campaign workspace", () => {
  it("keeps the intended left-to-right tab order and hides the GM tab for players", () => {
    expect(
      buildCampaignWorkspaceTabs({ canAccessGmEncounter: true }).map((tab) => tab.id)
    ).toEqual([
      "campaign",
      "scenario",
      "gm-encounter",
      "player-encounter",
      "character",
      "combat",
    ]);

    expect(
      buildCampaignWorkspaceTabs({ canAccessGmEncounter: false }).map((tab) => tab.id)
    ).toEqual(["campaign", "scenario", "player-encounter", "character", "combat"]);
  });

  it("opens the Character tab against the active scenario context", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      encounters: [],
      requestedEncounterId: null,
      requestedScenarioId: null,
      requestedTab: "character",
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeTab).toBe("character");
  });

  it("opens the Combat tab against the active scenario context", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      encounters: [],
      requestedEncounterId: null,
      requestedScenarioId: null,
      requestedTab: "combat",
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeTab).toBe("combat");
  });

  it("keeps the Combat tab open with a missing-context state when no scenario is selected", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: true,
      encounters: [],
      requestedEncounterId: null,
      requestedScenarioId: null,
      requestedTab: "combat",
      scenarios: [],
    });

    expect(state.activeScenarioId).toBeUndefined();
    expect(state.activeTab).toBe("combat");
  });

  it("auto-selects the only combat encounter when a GM opens the Combat tab", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: true,
      encounters: [
        encounter({
          id: "roleplay-encounter",
          kind: "roleplay",
          scenarioId: "scn-1",
          status: "active",
        }),
        encounter({
          id: "combat-encounter",
          kind: "combat",
          scenarioId: "scn-1",
          status: "planned",
        }),
      ],
      requestedEncounterId: null,
      requestedScenarioId: "scn-1",
      requestedTab: "combat",
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBe("combat-encounter");
    expect(state.activeTab).toBe("combat");
  });

  it("keeps the GM Combat tab in selection mode when multiple combat encounters are available", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: true,
      encounters: [
        encounter({
          id: "combat-one",
          kind: "combat",
          scenarioId: "scn-1",
          status: "active",
        }),
        encounter({
          id: "combat-two",
          kind: "combat",
          scenarioId: "scn-1",
          status: "planned",
        }),
      ],
      requestedEncounterId: null,
      requestedScenarioId: "scn-1",
      requestedTab: "combat",
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBeUndefined();
    expect(state.activeTab).toBe("combat");
  });

  it("keeps an explicitly selected roleplaying encounter visible for GM Combat tab messaging", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: true,
      encounters: [
        encounter({
          id: "roleplay-encounter",
          kind: "roleplay",
          scenarioId: "scn-1",
          status: "active",
        }),
        encounter({
          id: "combat-encounter",
          kind: "combat",
          scenarioId: "scn-1",
          status: "planned",
        }),
      ],
      requestedEncounterId: "roleplay-encounter",
      requestedScenarioId: "scn-1",
      requestedTab: "combat",
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBe("roleplay-encounter");
    expect(state.activeTab).toBe("combat");
  });

  it("auto-selects the only scenario for a GM opening Combat tab without ids", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: true,
      encounters: [
        encounter({
          id: "combat-encounter",
          kind: "combat",
          scenarioId: "scn-1",
          status: "active",
        }),
      ],
      requestedEncounterId: null,
      requestedScenarioId: null,
      requestedTab: "combat",
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBe("combat-encounter");
    expect(state.activeTab).toBe("combat");
  });

  it("sanitizes scenario and encounter selection against the current campaign flow", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: true,
      currentUserId: "player-1",
      encounters: [
        encounter({
          id: "enc-1",
          scenarioId: "scn-1",
          scenarioParticipantId: "participant-1",
          status: "setup",
          title: "Gate skirmish",
        }),
      ],
      requestedEncounterId: "enc-1",
      requestedScenarioId: "missing-scenario",
      requestedTab: "gm-encounter",
      scenarios: [
        {
          campaignId: "camp-1",
          createdAt: "2026-04-23T00:00:00.000Z",
          description: "",
          id: "scn-1",
          kind: "mixed",
          name: "Session one",
          status: "draft",
          updatedAt: "2026-04-23T00:00:00.000Z"
        }
      ]
    });

    expect(state.activeScenarioId).toBeUndefined();
    expect(state.activeEncounterId).toBeUndefined();
    expect(state.activeTab).toBe("campaign");
  });

  it("falls back to the deepest valid workspace state when a player cannot open the GM tab", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      encounters: [],
      requestedEncounterId: null,
      requestedScenarioId: "scn-1",
      requestedTab: "gm-encounter",
      scenarios: [
        {
          campaignId: "camp-1",
          createdAt: "2026-04-23T00:00:00.000Z",
          description: "",
          id: "scn-1",
          kind: "mixed",
          name: "Session one",
          status: "draft",
          updatedAt: "2026-04-23T00:00:00.000Z"
        }
      ]
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeTab).toBe("scenario");
  });

  it("restores remembered scenario, encounter, and tab when the URL does not specify them", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: true,
      encounters: [
        {
          actionLog: [],
          campaignId: "camp-1",
          createdAt: "2026-04-23T00:00:00.000Z",
          currentRound: 1,
          currentTurnIndex: 0,
          declarationsLocked: false,
          id: "enc-1",
          kind: "combat",
          participants: [],
          scenarioId: "scn-1",
          status: "setup",
          title: "Gate skirmish",
          turnOrderMode: "manual",
          updatedAt: "2026-04-23T00:00:00.000Z"
        }
      ],
      rememberedEncounterId: "enc-1",
      rememberedScenarioId: "scn-1",
      rememberedTab: "player-encounter",
      requestedEncounterId: null,
      requestedScenarioId: null,
      requestedTab: null,
      scenarioParticipants: [
        scenarioParticipant({
          controlledByUserId: "player-1",
          id: "participant-1",
          scenarioId: "scn-1",
        }),
      ],
      scenarios: [
        {
          campaignId: "camp-1",
          createdAt: "2026-04-23T00:00:00.000Z",
          description: "",
          id: "scn-1",
          kind: "mixed",
          name: "Session one",
          status: "draft",
          updatedAt: "2026-04-23T00:00:00.000Z"
        }
      ]
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBe("enc-1");
    expect(state.activeTab).toBe("player-encounter");
  });

  it("restores a remembered player encounter when the encounter remains visible to the player", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      currentUserId: "player-1",
      encounters: [
        encounter({
          id: "enc-1",
          scenarioId: "scn-1",
          scenarioParticipantId: "participant-1",
          status: "setup",
          title: "Gate skirmish",
        }),
      ],
      rememberedEncounterId: "enc-1",
      rememberedScenarioId: "scn-1",
      rememberedTab: "player-encounter",
      requestedEncounterId: null,
      requestedScenarioId: null,
      requestedTab: null,
      scenarioParticipants: [
        scenarioParticipant({
          controlledByUserId: "player-1",
          id: "participant-1",
          scenarioId: "scn-1",
        }),
      ],
      scenarios: [scenario({ id: "scn-1", name: "Session one" })]
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBe("enc-1");
    expect(state.activeTab).toBe("player-encounter");
  });

  it("falls back to the scenario tab when the encounter is missing but the scenario is still valid", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: true,
      encounters: [],
      rememberedEncounterId: "enc-missing",
      rememberedScenarioId: "scn-1",
      rememberedTab: "player-encounter",
      requestedEncounterId: null,
      requestedScenarioId: null,
      requestedTab: null,
      scenarios: [
        {
          campaignId: "camp-1",
          createdAt: "2026-04-23T00:00:00.000Z",
          description: "",
          id: "scn-1",
          kind: "mixed",
          name: "Session one",
          status: "draft",
          updatedAt: "2026-04-23T00:00:00.000Z"
        }
      ]
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBeUndefined();
    expect(state.activeTab).toBe("scenario");
  });

  it("auto-selects the only accessible player scenario when opening the scenario tab without an id", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      encounters: [],
      requestedEncounterId: null,
      requestedScenarioId: null,
      requestedTab: "scenario",
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeTab).toBe("scenario");
  });

  it("resolves the first assigned player encounter when opening player encounter without ids", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      currentUserId: "player-1",
      encounters: [
        encounter({
          id: "enc-paused",
          scenarioId: "scn-1",
          scenarioParticipantId: "participant-1",
          status: "paused",
          title: "Later scene",
        }),
        encounter({
          id: "enc-active",
          scenarioId: "scn-1",
          scenarioParticipantId: "participant-1",
          status: "active",
          title: "Now scene",
        }),
      ],
      requestedEncounterId: null,
      requestedScenarioId: null,
      requestedTab: "player-encounter",
      scenarioParticipants: [
        scenarioParticipant({
          controlledByUserId: "player-1",
          id: "participant-1",
          scenarioId: "scn-1",
        }),
      ],
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBe("enc-active");
    expect(state.activeTab).toBe("player-encounter");
  });

  it("uses active scenario participants as the default player access list for empty encounters", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      currentUserId: "player-1",
      encounters: [
        encounter({
          id: "enc-empty",
          scenarioId: "scn-1",
          status: "active",
          title: "Default scene",
        }),
      ],
      requestedEncounterId: null,
      requestedScenarioId: "scn-1",
      requestedTab: "player-encounter",
      scenarioParticipants: [
        scenarioParticipant({
          controlledByUserId: "player-1",
          id: "participant-1",
          scenarioId: "scn-1",
        }),
      ],
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBe("enc-empty");
    expect(state.activeTab).toBe("player-encounter");
  });

  it("does not use inactive scenario participants for empty encounter player access", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      currentUserId: "player-1",
      encounters: [
        encounter({
          id: "enc-empty",
          scenarioId: "scn-1",
          status: "active",
          title: "Default scene",
        }),
      ],
      requestedEncounterId: null,
      requestedScenarioId: "scn-1",
      requestedTab: "player-encounter",
      scenarioParticipants: [
        scenarioParticipant({
          controlledByUserId: "player-1",
          id: "participant-1",
          isActive: false,
          scenarioId: "scn-1",
        }),
      ],
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBeUndefined();
    expect(state.activeTab).toBe("player-encounter");
  });

  it("does not fall back when explicit membership mode has an empty list", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      currentUserId: "player-1",
      encounters: [
        encounter({
          id: "enc-explicit-empty",
          participantMembershipMode: "explicit",
          scenarioId: "scn-1",
          status: "active",
        }),
      ],
      requestedEncounterId: null,
      requestedScenarioId: "scn-1",
      requestedTab: "player-encounter",
      scenarioParticipants: [
        scenarioParticipant({
          controlledByUserId: "player-1",
          id: "participant-1",
          scenarioId: "scn-1",
        }),
      ],
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBeUndefined();
    expect(state.activeTab).toBe("player-encounter");
  });

  it("keeps explicit encounter membership strict once participants are assigned", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      currentUserId: "player-1",
      encounters: [
        encounter({
          id: "enc-explicit",
          scenarioId: "scn-1",
          scenarioParticipantId: "other-participant",
          status: "active",
        }),
      ],
      requestedEncounterId: null,
      requestedScenarioId: "scn-1",
      requestedTab: "player-encounter",
      scenarioParticipants: [
        scenarioParticipant({
          controlledByUserId: "player-1",
          id: "participant-1",
          scenarioId: "scn-1",
        }),
        scenarioParticipant({
          controlledByUserId: "other-player",
          id: "other-participant",
          scenarioId: "scn-1",
        }),
      ],
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBeUndefined();
    expect(state.activeTab).toBe("player-encounter");
  });

  it("invalidates remembered fallback access when explicit membership later excludes the player", () => {
    const scenarioParticipants = [
      scenarioParticipant({
        controlledByUserId: "player-1",
        id: "participant-1",
        scenarioId: "scn-1",
      }),
      scenarioParticipant({
        controlledByUserId: "other-player",
        id: "other-participant",
        scenarioId: "scn-1",
      }),
    ];
    const fallbackState = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      currentUserId: "player-1",
      encounters: [
        encounter({
          id: "enc-changing",
          scenarioId: "scn-1",
          status: "active",
        }),
      ],
      rememberedEncounterId: "enc-changing",
      rememberedScenarioId: "scn-1",
      rememberedTab: "player-encounter",
      scenarioParticipants,
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });
    const explicitState = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      currentUserId: "player-1",
      encounters: [
        encounter({
          id: "enc-changing",
          scenarioId: "scn-1",
          scenarioParticipantId: "other-participant",
          status: "active",
        }),
      ],
      rememberedEncounterId: "enc-changing",
      rememberedScenarioId: "scn-1",
      rememberedTab: "player-encounter",
      scenarioParticipants,
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(fallbackState.activeEncounterId).toBe("enc-changing");
    expect(explicitState.activeEncounterId).toBeUndefined();
    expect(explicitState.activeTab).toBe("player-encounter");
  });

  it("keeps the player encounter tab for a waiting state when no assigned encounter exists", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      currentUserId: "player-1",
      encounters: [
        encounter({
          id: "enc-other",
          scenarioId: "scn-1",
          scenarioParticipantId: "other-participant",
          status: "active",
        }),
      ],
      requestedEncounterId: null,
      requestedScenarioId: "scn-1",
      requestedTab: "player-encounter",
      scenarioParticipants: [
        scenarioParticipant({
          controlledByUserId: "other-player",
          id: "other-participant",
          scenarioId: "scn-1",
        }),
      ],
      scenarios: [scenario({ id: "scn-1", name: "Session one" })],
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBeUndefined();
    expect(state.activeTab).toBe("player-encounter");
  });
});
