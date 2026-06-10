import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  advanceCombatRoundStep,
  buildCombatRoundAttackRollResult,
  commitCombatRoundPhaseDamage,
  initializeCombatRoundState,
  recordCombatRoundAttackResult,
  recordCombatRoundCriticalRoll,
  recordCombatRoundDeclaration,
  recordCombatRoundDamageResult,
  recordCombatRoundHitLocationRoll,
  recordCombatRoundInitiative,
  recordCombatRoundParryResult,
  type CombatEffectsState,
  type EncounterSession,
} from "@glantri/domain";

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
    listCampaignsByPlayerAccess: vi.fn(),
    removeCampaignRosterEntryBySource: vi.fn(),
  };
  const characterService = {
    getOwnedCharacter: vi.fn(),
  };
  const encounterService = {
    createEncounter: vi.fn(),
    getEncounterById: vi.fn(),
    listEncountersByScenario: vi.fn(),
    updateEncounter: vi.fn(),
    updateScenarioParticipantState: vi.fn(),
  };
  const scenarioService = {
    createScenario: vi.fn(),
    addCharacterParticipant: vi.fn(),
    getScenarioById: vi.fn(),
    listScenariosByCampaignPlayerAccess: vi.fn(),
    listScenariosByCampaign: vi.fn(),
    listScenarioParticipants: vi.fn(),
    recordScenarioEvent: vi.fn(),
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

const attackParryDbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:attack-parry:phase1:db-parry",
  notes: "attack parry",
  scope: "until",
  sourceActionId: "attack_parry",
  sourcePhase: "phase1",
  sourceRule: "attack-parry-db-parry-phase1",
  value: -4,
};
const attackParryDbParryModifier = expect.objectContaining(attackParryDbParryModifierEntry);
const parryAttackDbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:parry-attack:phase2:db-parry",
  notes: "parry attack",
  scope: "until",
  sourceActionId: "parry_attack",
  sourcePhase: "phase2",
  sourceRule: "parry-attack-db-parry-phase2",
  value: -4,
};
const parryAttackDbParryModifier = expect.objectContaining(parryAttackDbParryModifierEntry);
const doubleAttackPhase1ObSkillModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase1:ob-skill",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase1",
  sourceRule: "double-attack-ob-skill-phase1",
  value: -1,
};
const doubleAttackPhase2ObSkillModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase2:ob-skill",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase2",
  sourceRule: "double-attack-ob-skill-phase2",
  value: -1,
};
const doubleAttackPhase1DbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase1:db-parry",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase1",
  sourceRule: "double-attack-db-parry-phase1",
  value: -4,
};
const doubleAttackPhase2DbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase2:db-parry",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase2",
  sourceRule: "double-attack-db-parry-phase2",
  value: -4,
};
const adjustRangePhase1DbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:adjust-range-attack:phase1:db-parry",
  notes: "adjust range",
  scope: "until",
  sourceActionId: "adjust_range_attack",
  sourcePhase: "phase1",
  sourceRule: "adjust-range-phase1-db-parry",
  value: -2,
};
const adjustRangePhase2DbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:adjust-range-attack:phase2:db-parry",
  notes: "adjust range attack",
  scope: "until",
  sourceActionId: "adjust_range_attack",
  sourcePhase: "phase2",
  sourceRule: "adjust-range-attack-phase2-db-parry",
  value: -4,
};
const doubleAttackPhase1ObSkillModifier = expect.objectContaining(
  doubleAttackPhase1ObSkillModifierEntry,
);
const doubleAttackPhase2ObSkillModifier = expect.objectContaining(
  doubleAttackPhase2ObSkillModifierEntry,
);
const doubleAttackPhase1DbParryModifier = expect.objectContaining(
  doubleAttackPhase1DbParryModifierEntry,
);
const doubleAttackPhase2DbParryModifier = expect.objectContaining(
  doubleAttackPhase2DbParryModifierEntry,
);
const adjustRangePhase1DbParryModifier = expect.objectContaining(
  adjustRangePhase1DbParryModifierEntry,
);
const adjustRangePhase2DbParryModifier = expect.objectContaining(
  adjustRangePhase2DbParryModifierEntry,
);

async function buildScenarioTestApp() {
  const app = Fastify({
    logger: false,
  });
  await app.register(scenariosRoutes);
  return app;
}

function makeCombatScenarioParticipant(overrides: Record<string, unknown> = {}) {
  return {
    controlledByUserId: "player-1",
    id: "participant-1",
    isActive: true,
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: {
      displayName: "The Gladiator",
    },
    sourceType: "character",
    state: {
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
      },
      conditions: [],
      equipment: {},
      health: {},
      modifiers: [],
      resources: {},
    },
    ...overrides,
  };
}

function makeCombatEncounter(overrides: Record<string, unknown> = {}) {
  return {
    actionLog: [],
    campaignId: "campaign-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "combat",
    participants: [
      {
        declaration: {
          actionType: "none",
          defenseFocus: "none",
          defensePosture: "none",
          targetLocation: "any",
        },
        facing: "north",
        id: "encounter-participant-1",
        initiative: 0,
        label: "The Gladiator",
        order: 0,
        orientation: "neutral",
        participantType: "scenario",
        position: { x: 0, y: 0, zone: "center" },
        scenarioParticipantId: "participant-1",
      },
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "A doubtful success",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setupCombatDeclarationRoute(
  input: {
    encounter?: Record<string, unknown>;
    participant?: Record<string, unknown>;
    user?: typeof mocks.playerUser | typeof mocks.adminUser;
  } = {},
) {
  const encounter = makeCombatEncounter(input.encounter);
  const participant = makeCombatScenarioParticipant(input.participant);

  if (input.user) {
    mocks.requireAuthenticatedUser.mockResolvedValue(input.user);
  }

  mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
  mocks.encounterService.updateScenarioParticipantState.mockImplementation(
    async (update: { state: unknown }) => ({
      ...participant,
      state: update.state,
    }),
  );
  mocks.encounterService.updateEncounter.mockImplementation(
    async (update: { session: unknown }) => update.session,
  );
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
  mocks.scenarioService.listScenarioParticipants.mockResolvedValue([participant]);

  return { encounter, participant };
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

  it("lists player-accessible campaigns through live scenario access only", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-live",
      kind: "mixed",
      name: "Live Scene",
      status: "live",
    };
    mocks.campaignService.listCampaignsByPlayerAccess.mockResolvedValue([campaign]);
    mocks.scenarioService.listScenariosByCampaignPlayerAccess.mockResolvedValue([scenario]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/accessible",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accessibleCampaigns: [
        {
          campaign,
          scenarios: [scenario],
        },
      ],
    });
    expect(mocks.campaignService.listCampaignsByPlayerAccess).toHaveBeenCalledWith("player-1");
    expect(mocks.scenarioService.listScenariosByCampaignPlayerAccess).toHaveBeenCalledWith(
      "campaign-1",
      "player-1",
    );
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

  it("returns player-safe roleplay visibility for a player's encounter", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "A slightly less new hope",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const encounter = {
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "The Gladiator",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
        {
          id: "scenario-participant-2",
          label: "City guard",
          participantType: "scenario",
          scenarioParticipantId: "participant-2",
        },
        {
          id: "scenario-participant-3",
          label: "Hidden spy",
          participantType: "scenario",
          scenarioParticipantId: "participant-3",
        },
      ],
      roleplayState: {
        actionLog: [],
        gmMessage: "The courtyard is tense.",
        participantDescriptions: {
          "scenario-participant-2": {
            detailedDescription: "Visible guard detail.",
            name: "City guard",
            shortDescription: "Armored guard",
          },
          "scenario-participant-3": {
            detailedDescription: "Hidden spy detail.",
            name: "Hidden spy",
            shortDescription: "Quiet figure",
          },
        },
        pendingSkillRolls: [],
        visibility: {
          "scenario-participant-1": {
            "scenario-participant-2": true,
          },
        },
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "A doubtful success",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
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
        snapshot: { displayName: "The Gladiator" },
        sourceType: "character",
      },
      {
        id: "participant-2",
        isActive: true,
        role: "npc",
        scenarioId: "scenario-1",
        snapshot: { displayName: "City guard" },
        sourceType: "entity",
      },
      {
        id: "participant-3",
        isActive: true,
        role: "npc",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Hidden spy" },
        sourceType: "entity",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.roleplayState).toMatchObject({
      participantDescriptions: {
        "scenario-participant-2": {
          detailedDescription: "Visible guard detail.",
          name: "City guard",
          shortDescription: "Armored guard",
        },
      },
      visibility: {
        "scenario-participant-1": {
          "scenario-participant-2": true,
        },
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("Hidden spy detail");
  });

  it("filters scenario participants for player workspace access", async () => {
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
    const controlledParticipant = {
      controlledByUserId: "player-1",
      id: "participant-1",
      isActive: true,
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: {
        displayName: "Player hero",
      },
      sourceType: "character",
    };
    const otherParticipant = {
      controlledByUserId: "other-player",
      id: "participant-2",
      isActive: true,
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: {
        displayName: "Other hero",
      },
      sourceType: "character",
    };
    const inactiveControlledParticipant = {
      controlledByUserId: "player-1",
      id: "participant-3",
      isActive: false,
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: {
        displayName: "Inactive hero",
      },
      sourceType: "character",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      controlledParticipant,
      otherParticipant,
      inactiveControlledParticipant,
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/participants",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      participants: [
        {
          displayName: "Player hero",
          id: "participant-1",
          isActive: true,
          isControlledByPlayer: false,
          role: "player_character",
          sourceType: "character",
        },
      ],
    });
  });

  it("creates an encounter under the path-authorized scenario and campaign", async () => {
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
    const bodySession = {
      campaignId: "campaign-evil",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      scenarioId: "scenario-evil",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const encounter = {
      ...bodySession,
      campaignId: "campaign-1",
      scenarioId: "scenario-1",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.encounterService.createEncounter.mockResolvedValue(encounter);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        session: bodySession,
      },
      url: "/scenarios/scenario-1/encounters",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.createEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      createdByUserId: "gm-1",
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        campaignId: "campaign-evil",
        id: "encounter-1",
        scenarioId: "scenario-evil",
      }),
    });
  });

  it("updates the path-authorized encounter instead of trusting body ids", async () => {
    const existingEncounter = {
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
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
    const bodySession = {
      campaignId: "campaign-evil",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-evil",
      scenarioId: "scenario-evil",
      title: "Renamed courtyard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.encounterService.updateEncounter.mockResolvedValue({
      ...bodySession,
      campaignId: "campaign-1",
      id: "encounter-1",
      participants: [],
      scenarioId: "scenario-1",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PUT",
      payload: {
        session: bodySession,
      },
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        campaignId: "campaign-evil",
        id: "encounter-evil",
        scenarioId: "scenario-evil",
      }),
    });
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
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { session: unknown }) => input.session,
    );
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
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.roleplayState.actionLog[0]).toMatchObject({
      pendingRollId: "roll-1",
      participantId: "scenario-participant-1",
      rollD20: 12,
      silent: false,
      skillId: "perception",
      type: "gm_skill_roll",
    });
  });

  it("allows a GM to submit a selected participant's player-facing assigned roleplay roll", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    const encounter = {
      actionLog: [],
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Absent hero",
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
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { session: unknown }) => input.session,
    );
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
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "other-player",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Absent hero",
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
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
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
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { session: unknown }) => input.session,
    );
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
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
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

  it("allows a player to declare combat action for their assigned participant during DE", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [
              {
                durationRounds: 2,
                id: "gm-initiative-mod",
                notes: "Quick start",
                scope: "until",
                value: 1,
              },
            ],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            mainHandParryDirection: "left",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
          phase2: {
            offHandParryDirection: "right_forward",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [attackParryDbParryModifier],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "submitted",
    );
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "attack_parry",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [attackParryDbParryModifier],
        }),
      }),
      movementId: "hold",
      phaseContexts: {
        phase1: expect.objectContaining({
          mainHandParryDirection: "left",
        }),
        phase2: expect.objectContaining({
          offHandParryDirection: "right_forward",
        }),
      },
      roundNumber: 1,
      submittedBy: "player",
      submittedByUserId: "player-1",
    });
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
  });

  it("records a GM declare_action command during DE", async () => {
    setupCombatDeclarationRoute({
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(1);
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "DE",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "DE",
      },
      createdByUserId: "gm-1",
      participantId: "encounter-participant-1",
      type: "declare_action",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
  });

  it("rejects attack declarations without the required phase target", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Select a target for Phase 1.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects GM Double Attack declarations unless both attack phases have targets", async () => {
    setupCombatDeclarationRoute({ user: mocks.adminUser });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Select a target for Phase 2.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects Adjust Range - Attack without a Phase 2 target", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "adjust_range_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Select a target for Phase 2.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("creates the phase 2 DB/Parry modifier when a player declares Parry - Attack", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "parry_attack",
            lastDeclaredEncounterId: "encounter-1",
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [parryAttackDbParryModifier],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "parry_attack",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [parryAttackDbParryModifier],
        }),
      }),
      roundNumber: 1,
      submittedBy: "player",
    });
  });

  it("creates phase 1 and phase 2 Skill/OB and DB/Parry modifiers when a player declares Double Attack", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-2",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "double_attack",
            lastDeclaredEncounterId: "encounter-1",
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [doubleAttackPhase1DbParryModifier, doubleAttackPhase2DbParryModifier],
                situationObSkill: [
                  doubleAttackPhase1ObSkillModifier,
                  doubleAttackPhase2ObSkillModifier,
                ],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "double_attack",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [doubleAttackPhase1DbParryModifier, doubleAttackPhase2DbParryModifier],
          situationObSkill: [doubleAttackPhase1ObSkillModifier, doubleAttackPhase2ObSkillModifier],
        }),
      }),
      roundNumber: 1,
      submittedBy: "player",
    });
  });

  it("creates phase 1 and phase 2 DB/Parry modifiers when a player declares Adjust Range - Attack", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "adjust_range_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "adjust_range_attack",
            lastDeclaredEncounterId: "encounter-1",
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [adjustRangePhase1DbParryModifier, adjustRangePhase2DbParryModifier],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "adjust_range_attack",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [adjustRangePhase1DbParryModifier, adjustRangePhase2DbParryModifier],
        }),
      }),
      phaseContexts: {
        phase1: expect.any(Object),
        phase2: expect.objectContaining({
          targetParticipantId: "encounter-target-1",
        }),
      },
      roundNumber: 1,
      submittedBy: "player",
    });
  });

  it("preserves existing combat modifier buckets when a player declares", async () => {
    setupCombatDeclarationRoute({
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [
                  {
                    id: "gm-db-mod",
                    notes: "GM cover",
                    scope: "until",
                    value: 2,
                  },
                ],
                situationInitiative: [
                  {
                    durationRounds: 2,
                    id: "gm-initiative-mod",
                    notes: "Ready",
                    scope: "until",
                    value: 1,
                  },
                ],
                situationObSkill: [
                  {
                    id: "gm-ob-mod",
                    notes: "GM footing",
                    scope: "until",
                    value: -1,
                  },
                ],
              },
            },
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [
              {
                id: "player-db-mod",
                notes: "Player should not write this",
                scope: "until",
                value: 99,
              },
            ],
            situationInitiative: [
              {
                id: "player-initiative-mod",
                notes: "Player should not write this",
                scope: "until",
                value: 99,
              },
            ],
            situationObSkill: [
              {
                id: "player-ob-mod",
                notes: "Player should not write this",
                scope: "until",
                value: 99,
              },
            ],
          },
          selectedOpponentId: "guard",
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: expect.objectContaining({
              modifierBuckets: {
                general: [],
                situationDb: [
                  {
                    id: "gm-db-mod",
                    notes: "GM cover",
                    scope: "until",
                    value: 2,
                  },
                  attackParryDbParryModifier,
                ],
                situationInitiative: [
                  {
                    durationRounds: 2,
                    id: "gm-initiative-mod",
                    notes: "Ready",
                    scope: "until",
                    value: 1,
                  },
                ],
                situationObSkill: [
                  {
                    id: "gm-ob-mod",
                    notes: "GM footing",
                    scope: "until",
                    value: -1,
                  },
                ],
              },
              selectedOpponentId: "guard",
            }),
          }),
        }),
      }),
    );
  });

  it("allows a GM to declare combat action for another player's participant after DE", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "locked",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [
              {
                durationRounds: 2,
                id: "gm-initiative-mod",
                notes: "Quick start",
                scope: "until",
                value: 1,
              },
            ],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("review_action_modifiers");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "gmEdited",
    );
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "attack_parry",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [attackParryDbParryModifier],
          situationInitiative: [
            {
              durationRounds: 2,
              id: "gm-initiative-mod",
              notes: "Quick start",
              scope: "until",
              value: 1,
            },
          ],
        }),
      }),
      roundNumber: 1,
      submittedBy: "gm",
      submittedByUserId: "gm-1",
    });
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_action_modifiers,
    ).toBe("gmEdited");
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "M1",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "M1",
      },
      type: "review_modifiers_phase1",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
  });

  it("allows a GM to declare Parry - Attack for another player's participant after DE", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "locked",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "parry_attack",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [parryAttackDbParryModifier],
        }),
      }),
      roundNumber: 1,
      submittedBy: "gm",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [parryAttackDbParryModifier],
              }),
            }),
            lastDeclaredActionId: "parry_attack",
            lastDeclaredEncounterId: "encounter-1",
          }),
        }),
      }),
    );
  });

  it("allows a GM to review phase 2 modifiers without entering modifier values", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_phase_2_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "submitted",
                initiative_phase_2: "pending",
                phase_1_actions: "complete",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "complete",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationObSkill: [],
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_phase_2_modifiers,
    ).toBe("gmEdited");
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "M2",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "M2",
      },
      type: "review_modifiers_phase2",
    });
  });

  it("rejects a player combat declaration after DE has advanced", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "locked",
              },
            },
          ],
          roundNumber: 1,
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationObSkill: [],
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("allows a player to roll phase 1 initiative for their assigned participant", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "initiative_phase_1",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        state: {
          combat: {
            lastDeclaredActionId: "attack_parry",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        initiativeBase: 3,
        initiativeModifierAdjustment: -1,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-initiative",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().initiative.total).toBeGreaterThanOrEqual(1);
    expect(response.json().initiative.rolls.length).toBeGreaterThanOrEqual(1);
    expect(response.json().initiative.baseInitiative).toBe(3);
    expect(response.json().initiative.modifierAdjustment).toBe(-1);
    expect(response.json().initiative.total).toBe(
      response.json().initiative.baseInitiative +
        response.json().initiative.modifierAdjustment +
        response.json().initiative.rollTotal,
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toMatchObject({
      rolls: response.json().initiative.rolls,
      total: response.json().initiative.total,
    });
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.initiative_phase_1).toBe(
      "submitted",
    );
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
  });

  it("allows a GM to roll initiative for another player's participant", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "initiative_phase_2",
          participants: [
            {
              initiatives: { phase1: { rolls: [6, 6], total: 12 } },
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "submitted",
                initiative_phase_2: "pending",
                phase_1_actions: "complete",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "complete",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "complete",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-initiative",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase2).toMatchObject({
      rolls: response.json().initiative.rolls,
      total: response.json().initiative.total,
    });
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.initiative_phase_2).toBe(
      "gmEdited",
    );
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "i2",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "i2",
      },
      type: "roll_initiative_phase2",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
  });

  it("rejects player initiative rolls for another participant", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "initiative_phase_1",
          participants: [
            {
              initiatives: {},
              label: "Other hero",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        controlledByUserId: "other-player",
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-initiative",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("allows the attacking player to roll hit location for a pending D1 result", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterParry,
        participants: encounterParticipants,
      },
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-hit-location",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        rolledByParticipantId: "encounter-participant-1",
        rollPrivilege: "attacker",
      }),
      participantId: "encounter-participant-2",
      type: "roll_hit_location",
    });
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.hitLocationRoll.status).toBe(
      "rolled",
    );
  });

  it("allows the attacking player to roll critical for their critical damage proposal", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordCombatRoundHitLocationRoll({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [12],
      rolledByParticipantId: "encounter-participant-1",
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterDamage,
        participants: encounterParticipants,
      },
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        attackResultId: "1:phase1:encounter-participant-1:encounter-participant-2",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-critical",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        rolledByParticipantId: "encounter-participant-1",
        rollPrivilege: "attacker",
      }),
      participantId: "encounter-participant-2",
      type: "roll_critical",
    });
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.criticalRoll.status).toBe(
      "rolled",
    );
  });

  it("clears DE declarations and participant action selections for GM correction", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "select_actions",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              selectedOpponentId: "guard",
              modifierBuckets: {
                general: [],
                situationDb: [
                  attackParryDbParryModifierEntry,
                  parryAttackDbParryModifierEntry,
                  doubleAttackPhase1DbParryModifierEntry,
                  doubleAttackPhase2DbParryModifierEntry,
                ],
                situationInitiative: [],
                situationObSkill: [
                  doubleAttackPhase1ObSkillModifierEntry,
                  doubleAttackPhase2ObSkillModifierEntry,
                ],
              },
            },
            lastDeclaredActionId: "parry_attack",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "pending",
    );
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: undefined,
            lastDeclaredEncounterId: undefined,
            lastDeclaredMovementId: undefined,
            lastDeclaredRoundNumber: undefined,
          }),
        }),
      }),
    );
  });

  it("clears a command-backed DE cell by restoring the command before cursor", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const stateWithCommand = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithCommand,
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              selectedOpponentId: "guard",
              modifierBuckets: {
                general: [],
                situationDb: [attackParryDbParryModifierEntry],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "select_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalled();
  });

  it("clears M1 and rewinds without erasing submitted DE declarations", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_action_modifiers,
    ).toBe("pending");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "submitted",
    );
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("clears a top-advance M1 command after the UI has landed on i1", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const reviewPhase1 = advanceCombatRoundStep(
      initializeCombatRoundState({ encounter: combatEncounter }),
    );
    const topAdvanced = advanceCombatRoundStep(reviewPhase1, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
        participantId: "encounter-participant-1",
      },
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: topAdvanced,
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "M1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("review_action_modifiers");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("review_action_modifiers");
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_action_modifiers,
    ).toBe("pending");
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("clears a command-backed i1 cell by restoring the command before cursor", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const initiativeState = {
      ...initializeCombatRoundState({ encounter: combatEncounter }),
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1" as const,
    };
    const stateWithCommand = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithCommand,
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "i1",
    });
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toBeUndefined();
  });

  it("clears a top-advance i1 command without leaving no-action A1 state selected", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const initiativePhase1 = advanceCombatRoundStep(
      advanceCombatRoundStep(initializeCombatRoundState({ encounter: combatEncounter })),
    );
    const topAdvanced = advanceCombatRoundStep(initiativePhase1, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
        participantId: "encounter-participant-1",
      },
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...topAdvanced,
          phaseResolutionCursor: {
            participantId: "encounter-participant-1",
            phase: "phase1",
            substep: "damage",
          },
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "phase_1_actions",
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "i1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_phase_2_actions,
    ).toBe("pending");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_damage).toBe(
      "pending",
    );
  });

  it("falls back from an empty selected A1 cell to the latest i1 command undo", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const initiativeState = {
      ...initializeCombatRoundState({ encounter: combatEncounter }),
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1" as const,
    };
    const afterTopRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterTopRoll,
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterGuardRoll,
          currentStep: "phase_1_actions",
          selectedParticipantId: "encounter-participant-2",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-2",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(1);
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_initiative_phase1",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "i1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.participants[1].initiatives.phase1).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("clears the latest attack command even when the inspected cell is an older i1", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const initiativeState = {
      ...initializeCombatRoundState({ encounter: combatEncounter }),
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1" as const,
    };
    const afterGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    const afterGuardInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterGladiatorInitiative,
      submittedBy: "gm",
    });
    const gladiatorMiss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterGladiatorMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: gladiatorMiss.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: gladiatorMiss,
      state: afterGuardInitiative,
      submittedBy: "gm",
    });
    const guardMiss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-2",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-1",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:04:00.000Z",
      weaponName: "Spear",
    });
    const afterGuardMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: guardMiss.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-2",
      result: guardMiss,
      state: afterGladiatorMiss,
      submittedBy: "gm",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterGuardMiss,
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "initiative_phase_1",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(3);
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "A1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("phase_1_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("phase_1_actions");
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toMatchObject({
      total: 14,
    });
    expect(updatedEncounter.combatRoundState.participants[1].initiatives.phase1).toMatchObject({
      total: 12,
    });
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toEqual(
      gladiatorMiss,
    );
    expect(updatedEncounter.combatRoundState.participants[1].attackResults.phase1).toBeUndefined();
  });

  it("clears the latest parry command even when the inspected cell is an older i1", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const declaredState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          roundNumber: 1,
        },
        participantId: "encounter-participant-1",
        state: initializeCombatRoundState({ encounter: combatEncounter }),
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const afterGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: declaredState,
      submittedBy: "gm",
    });
    const afterGuardInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterGladiatorInitiative,
      submittedBy: "gm",
    });
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: afterGuardInitiative,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterParry,
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "initiative_phase_1",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(3);
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "P1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("review_phase_2_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("review_phase_2_actions");
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toEqual(
      attackHit,
    );
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toMatchObject({
      total: 14,
    });
    expect(updatedEncounter.combatRoundState.participants[1].initiatives.phase1).toMatchObject({
      total: 12,
    });
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.parryResolution.status,
    ).toBe("pending");
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageRoll.status).toBe(
      "pending",
    );
  });

  it("clears the latest committed damage command and removes only its combat effect rows", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const declaredState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          roundNumber: 1,
        },
        participantId: "encounter-participant-1",
        state: initializeCombatRoundState({ encounter: combatEncounter }),
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const afterGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: declaredState,
      submittedBy: "gm",
    });
    const afterGuardInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterGladiatorInitiative,
      submittedBy: "gm",
    });
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: afterGuardInitiative,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordCombatRoundHitLocationRoll({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [12],
      rolledByParticipantId: "encounter-participant-1",
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [4, 5],
      rolledByParticipantId: "encounter-participant-1",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const existingCombatEffects: CombatEffectsState = {
      effects: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          damage: 0,
          description: "Existing row",
          effectGroup: "general",
          generalDamage: 0,
          id: "existing-effect",
          sourceEventId: "existing-event",
          status: "active",
          targetParticipantId: "participant-2",
          type: "special",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          description: "",
          id: "existing-event",
          sourceLabel: "Existing event",
          sourceType: "manual",
          targetParticipantId: "participant-2",
        },
      ],
    };
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "participant-1",
      command: {
        commandId: "commit-d1-api",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: existingCombatEffects,
      defenderScenarioParticipantId: "participant-2",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterCritical,
    });
    const expectedCommitEventId =
      "commit-d1-api:r1:phase1:1-phase1-encounter-participant-1-encounter-participant-2:1-phase1-encounter-participant-1-encounter-participant-2-damage:combat-effect-event";
    const expectedCommitEffectId =
      "commit-d1-api:r1:phase1:1-phase1-encounter-participant-1-encounter-participant-2:1-phase1-encounter-participant-1-encounter-participant-2-damage:combat-effect:general-damage";
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        id: "participant-2",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: committed.combatEffects,
        },
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...committed.state,
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "initiative_phase_1",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    mocks.encounterService.updateScenarioParticipantState.mockImplementation(
      async (update: { participantId: string; state: unknown }) => ({
        ...scenarioParticipants.find((participant) => participant.id === update.participantId),
        state: update.state,
      }),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      type: "roll_critical",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "D1",
    });
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("phase_1_damage");
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageResult).toBeDefined();
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.criticalRoll.status).toBe(
      "rolled",
    );
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageProposal.status).toBe(
      "drafted",
    );
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledTimes(1);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-2",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combatEffects: expect.objectContaining({
            effects: [
              expect.objectContaining({
                id: "existing-effect",
              }),
            ],
            events: [
              expect.objectContaining({
                id: "existing-event",
              }),
            ],
          }),
        }),
      }),
    );
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combatEffects.effects).not.toContainEqual(
      expect.objectContaining({ id: expectedCommitEffectId }),
    );
    expect(updatedParticipantState.combatEffects.events).not.toContainEqual(
      expect.objectContaining({ id: expectedCommitEventId }),
    );
  });

  it("fallback DE undo from an empty selected A1 cell clears mirrored declaration state", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const stateWithCommand = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithCommand,
          currentStep: "phase_1_actions",
          selectedParticipantId: "encounter-participant-2",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [attackParryDbParryModifierEntry],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-2",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: undefined,
            lastDeclaredEncounterId: undefined,
            lastDeclaredRoundNumber: undefined,
          }),
        }),
      }),
    );
  });

  it("clears the selected A1 cell without rewinding to initiative", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const stateWithAttack = recordCombatRoundAttackResult({
      participantId: "encounter-participant-1",
      result: attackResult,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithAttack,
          currentStep: "initiative_phase_1",
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("phase_1_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
  });

  it("clears an auto-opened defender P1 cell back to the attacker A1 redo point", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const stateWithAttack = recordCombatRoundAttackResult({
      participantId: "encounter-participant-1",
      result: attackResult,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithAttack,
          currentStep: "initiative_phase_1",
          selectedParticipantId: "encounter-participant-2",
          selectedStep: "review_phase_2_actions",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-2",
        step: "review_phase_2_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("phase_1_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
    expect(
      updatedEncounter.combatRoundState.participants[1].stepStatuses.review_phase_2_actions,
    ).toBe("pending");
  });

  it("does not allow players to clear combat round steps", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
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
