import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const adminUser = {
    email: "gm@example.test",
    id: "gm-1",
    roles: ["game_master"],
  };
  const playerUser = {
    email: "player@example.test",
    id: "player-1",
    roles: ["player"],
  };
  const campaignService = {
    createCampaign: vi.fn(),
    getCampaignById: vi.fn(),
    listCampaignRosterEntries: vi.fn(),
    listCampaignsByCharacterRosterAccess: vi.fn(),
    listCampaignsByGameMaster: vi.fn(),
    removeCampaignRosterEntryBySource: vi.fn(),
  };
  const characterService = {
    getOwnedCharacter: vi.fn(),
  };
  const encounterService = {
    getEncounterById: vi.fn(),
    listEncountersByScenario: vi.fn(),
    updateEncounter: vi.fn(),
  };
  const scenarioService = {
    createScenario: vi.fn(),
    addCharacterParticipant: vi.fn(),
    getScenarioById: vi.fn(),
    listScenariosByCampaign: vi.fn(),
    listScenarioParticipants: vi.fn(),
    updateScenario: vi.fn(),
    userHasPlayerScenarioAccess: vi.fn(),
  };
  return {
    adminUser,
    campaignService,
    characterService,
    encounterService,
    playerUser,
    requireAdminUser: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
    scenarioService,
  };
});

vi.mock("@glantri/database", () => ({
  CampaignService: vi.fn(() => mocks.campaignService),
  CharacterService: vi.fn(() => mocks.characterService),
  EncounterService: vi.fn(() => mocks.encounterService),
  ScenarioService: vi.fn(() => mocks.scenarioService),
}));

vi.mock("../lib/sessionAuth", () => ({
  requireAdminUser: mocks.requireAdminUser,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

import { scenariosRoutes } from "./scenarios";

async function buildScenarioTestApp() {
  const app = Fastify({
    logger: false,
  });
  await app.register(scenariosRoutes);
  return app;
}

describe("scenarios route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminUser.mockResolvedValue(mocks.adminUser);
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
  });

  it("lists campaigns for the authenticated game master", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    mocks.campaignService.listCampaignsByGameMaster.mockResolvedValue([campaign]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      campaigns: [campaign],
    });
    expect(mocks.campaignService.listCampaignsByGameMaster).toHaveBeenCalledWith("gm-1");
  });

  it("returns a validation error instead of calling the service for invalid campaign creation", async () => {
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        status: "active",
      },
      url: "/campaigns",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "name is required.",
    });
    expect(mocks.campaignService.createCampaign).not.toHaveBeenCalled();
  });

  it("creates a scenario under a campaign owned by the game master", async () => {
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "prepared",
    };
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.createScenario.mockResolvedValue(scenario);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        kind: "combat",
        name: "Bridge Ambush",
        status: "prepared",
      },
      url: "/campaigns/campaign-1/scenarios",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      scenario,
    });
    expect(mocks.scenarioService.createScenario).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      continuesFromScenarioId: undefined,
      description: undefined,
      kind: "combat",
      mapAssetId: undefined,
      name: "Bridge Ambush",
      status: "prepared",
    });
  });

  it("lists live roster-eligible scenarios for a character without campaign self-join", async () => {
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    mocks.campaignService.listCampaignsByCharacterRosterAccess.mockResolvedValue([campaign]);
    mocks.scenarioService.listScenariosByCampaign.mockResolvedValue([
      {
        campaignId: "campaign-1",
        id: "scenario-live",
        kind: "mixed",
        name: "Live Scene",
        status: "live",
      },
      {
        campaignId: "campaign-1",
        id: "scenario-draft",
        kind: "mixed",
        name: "Draft Scene",
        status: "draft",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/joinable?characterId=character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      joinableScenarios: [
        {
          campaignId: "campaign-1",
          campaignName: "Border Trouble",
          kind: "mixed",
          scenarioId: "scenario-live",
          scenarioName: "Live Scene",
          status: "live",
        },
      ],
    });
    expect(mocks.campaignService.listCampaignsByCharacterRosterAccess).toHaveBeenCalledWith(
      "character-1",
    );
  });

  it("removes a campaign character roster membership by source identity", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: true });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: true, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId: "character-1",
      sourceType: "character",
    });
  });

  it("accepts UUID character source ids on the source-key removal route", async () => {
    const sourceId = "23831e49-9060-493d-9eaf-65667c210ce5";
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: true });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: `/campaigns/campaign-1/roster-membership/character/${sourceId}`,
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: true, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId,
      sourceType: "character",
    });
  });

  it("removes a campaign template roster membership by source identity", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: true });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/template/template-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: true, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId: "template-1",
      sourceType: "template",
    });
  });

  it("rejects roster membership removal outside the game master's campaign", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "other-gm",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: "CAMPAIGN_NOT_FOUND",
      error: "Campaign not found.",
      route: "source-key",
    });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).not.toHaveBeenCalled();
  });

  it("keeps query-based roster membership removal as a compatibility no-op path", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource
      .mockResolvedValueOnce({ removed: true })
      .mockResolvedValueOnce({ removed: false });
    const app = await buildScenarioTestApp();

    const firstResponse = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership?sourceType=character&sourceId=character-1",
    });
    const secondResponse = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership?sourceType=character&sourceId=character-1",
    });

    await app.close();

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toEqual({ ok: true, removed: true, route: "source-query" });
    expect(secondResponse.json()).toEqual({ ok: true, removed: false, route: "source-query" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledTimes(2);
  });

  it("treats missing source-key roster membership removal as successful and idempotent", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: false });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/missing-character",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: false, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId: "missing-character",
      sourceType: "character",
    });
  });

  it("returns source-key diagnostics when roster membership removal fails", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockRejectedValue(
      new Error("Synthetic delete failure"),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "CAMPAIGN_ROSTER_REMOVE_FAILED",
      details: {
        campaignId: "campaign-1",
        causeMessage: "Synthetic delete failure",
        causeName: "Error",
        route: "source-key",
        sourceId: "character-1",
        sourceType: "character",
      },
      error: "Synthetic delete failure",
      route: "source-key",
    });
  });

  it("returns a useful validation error for invalid roster source types", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/pc/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "INVALID_ROSTER_SOURCE_TYPE",
      error: "Invalid roster source type. Expected character, reusableEntity, or template.",
      route: "source-key",
    });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).not.toHaveBeenCalled();
  });

  it("allows a player-owned roster character to join a live scenario", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "Live Scene",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: {
        allowPlayerSelfJoin: false,
      },
      status: "active",
    };
    const participant = {
      characterId: "character-1",
      controlledByUserId: "player-1",
      id: "participant-1",
      scenarioId: "scenario-1",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.characterService.getOwnedCharacter.mockResolvedValue({
      id: "character-1",
      ownerId: "player-1",
    });
    mocks.campaignService.listCampaignRosterEntries.mockResolvedValue([
      {
        campaignId: "campaign-1",
        id: "roster-1",
        sourceId: "character-1",
        sourceType: "character",
      },
    ]);
    mocks.scenarioService.addCharacterParticipant.mockResolvedValue(participant);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        characterId: "character-1",
        controlledByUserId: "player-1",
        joinSource: "player_joined",
        role: "player_character",
      },
      url: "/scenarios/scenario-1/participants/character",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ participant });
    expect(mocks.scenarioService.addCharacterParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "character-1",
        joinSource: "player_joined",
        scenarioId: "scenario-1",
      }),
    );
  });

  it("rejects player scenario join when the character is not in the campaign roster", async () => {
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "Live Scene",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: {
        allowPlayerSelfJoin: false,
      },
      status: "active",
    });
    mocks.characterService.getOwnedCharacter.mockResolvedValue({
      id: "character-1",
      ownerId: "player-1",
    });
    mocks.campaignService.listCampaignRosterEntries.mockResolvedValue([]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        characterId: "character-1",
        joinSource: "player_joined",
        role: "player_character",
      },
      url: "/scenarios/scenario-1/participants/character",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "This character is not currently assigned to a campaign.",
    });
    expect(mocks.scenarioService.addCharacterParticipant).not.toHaveBeenCalled();
  });

  it("lists encounters for a player with scenario workspace access", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const encounter = {
      id: "encounter-1",
      name: "Courtyard",
      scenarioId: "scenario-1",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.encounterService.listEncountersByScenario.mockResolvedValue([encounter]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/encounters",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      encounters: [encounter],
    });
    expect(mocks.scenarioService.userHasPlayerScenarioAccess).toHaveBeenCalledWith({
      scenarioId: "scenario-1",
      userId: "player-1",
    });
    expect(mocks.encounterService.listEncountersByScenario).toHaveBeenCalledWith("scenario-1");
  });

  it("allows a player to submit their own non-silent assigned roleplay roll", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            difficulty: "medium",
            id: "roll-1",
            mode: "difficulty",
            otherMod: 0,
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            silent: false,
            skillId: "perception",
            skillLabel: "Perception",
            skillValue: 10,
            useDbMod: false,
            useGenMod: false,
            useObSkillMod: false,
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.encounterService.updateEncounter.mockImplementation(async (nextEncounter: unknown) => nextEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0];
    expect(updatedEncounter.roleplayState.actionLog[0]).toMatchObject({
      pendingRollId: "roll-1",
      participantId: "scenario-participant-1",
      rollD20: 12,
      silent: false,
      skillId: "perception",
      type: "gm_skill_roll",
    });
  });

  it("preserves roll set and actor side when a player submits an assigned opposed roll", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "roll-1",
            mode: "opposed",
            otherMod: 0,
            opponentParticipantId: "scenario-participant-2",
            opponentSkillId: "brawling",
            opponentSkillLabel: "Brawling",
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
            skillValue: 24,
            useDbMod: false,
            useGenMod: false,
            useObSkillMod: false,
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.encounterService.updateEncounter.mockImplementation(async (nextEncounter: unknown) => nextEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 26,
          openEndedD10s: [6],
          rollD20: 20,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0];
    expect(updatedEncounter.roleplayState.actionLog[0]).toMatchObject({
      mode: "opposed",
      pendingRollId: "roll-1",
      rollSetId: "roll-set-1",
      side: "actor",
      participantId: "scenario-participant-1",
      skillId: "dodge",
      numericSubtotal: 50,
    });
  });

  it("rejects player roleplay rolls for other-participant assignments", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-other-participant",
          label: "Other hero",
          participantType: "scenario",
          scenarioParticipantId: "other-participant",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "roll-1",
            participantId: "scenario-other-participant",
            silent: false,
            skillId: "perception",
            skillLabel: "Perception",
          },
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "silent-roll",
            participantId: "scenario-other-participant",
            silent: true,
            skillId: "stealth",
            skillLabel: "Stealth",
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      name: "Bridge Ambush",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
      {
        controlledByUserId: "other-player",
        id: "other-participant",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Other hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects duplicate player submissions for the same assigned roll side", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [
          {
            createdAt: "2026-01-01T00:01:00.000Z",
            id: "existing-result",
            mode: "opposed",
            participantId: "scenario-participant-1",
            pendingRollId: "roll-1",
            rollSetId: "roll-set-1",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
            summary: "Player rolled Dodge.",
            type: "gm_skill_roll",
          },
        ],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "roll-1",
            mode: "opposed",
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      name: "Bridge Ambush",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects player roleplay rolls for silent assignments", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "silent-roll",
            participantId: "scenario-participant-1",
            silent: true,
            skillId: "stealth",
            skillLabel: "Stealth",
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      name: "Bridge Ambush",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "silent-roll",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });
});
