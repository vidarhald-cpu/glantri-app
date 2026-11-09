import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TRAINING_BANDIT_DEMO_SNAPSHOT } from "../../../../../packages/database/scripts/trainingBanditDemoSnapshot";

/**
 * #1001 scope 3 — #851 ruling 22734 ("Press generate first"), Product Owner option (i): fielding a
 * humanoid archetype Template directly as a combatant is refused with "Generate an NPC from this
 * Template first.", on every path of `POST /scenarios/:scenarioId/participants/entity` that adds a
 * Template-sourced actor. Build-carrying Templates (the seeded Training Bandit, #666's Templates),
 * generated NPCs and ad-hoc actors are fielded exactly as before.
 */

const mocks = vi.hoisted(() => ({
  adminUser: { email: "gm@example.test", id: "gm-1", roles: ["game_master"] },
  campaignService: {
    getCampaignById: vi.fn(),
    getReusableEntityById: vi.fn(),
    listCampaignRosterEntries: vi.fn(),
  },
  requireAdminUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  scenarioService: {
    addEntityParticipant: vi.fn(),
    getScenarioById: vi.fn(),
    userHasPlayerScenarioAccess: vi.fn(),
  },
}));

vi.mock("@glantri/database", () => ({
  ArtifactImportService: vi.fn(() => ({})),
  CampaignCharacterAlreadyRosteredError: class extends Error {},
  CampaignCharacterRosterCandidateNotFoundError: class extends Error {},
  CampaignMapService: vi.fn(() => ({})),
  CampaignMapConflictError: class extends Error {},
  CampaignMapNotFoundError: class extends Error {},
  CampaignMapReferenceError: class extends Error {},
  CampaignManagementService: vi.fn(() => ({})),
  CampaignNoteConflictError: class extends Error {},
  CampaignNoteNotFoundError: class extends Error {},
  CampaignNoteReferenceError: class extends Error {},
  CampaignService: vi.fn(() => mocks.campaignService),
  CharacterEquipmentReadModelService: vi.fn(() => ({})),
  CharacterService: vi.fn(() => ({})),
  CombatItemInteractionService: vi.fn(() => ({})),
  CombatItemUnavailableError: class extends Error {},
  CombatStateReadService: vi.fn(() => ({})),
  EncounterCombatWriteError: class extends Error {},
  EncounterService: vi.fn(() => ({})),
  EncounterWriteError: class extends Error {},
  ScenarioEquipmentStaleError: class extends Error {},
  ScenarioService: vi.fn(() => mocks.scenarioService),
  ScenarioSessionWriteError: class extends Error {},
}));

vi.mock("../../lib/sessionAuth", () => ({
  requireAdminUser: mocks.requireAdminUser,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

import { scenariosRoutes } from "../scenarios";

/** The shape `buildHumanoidNpcArchetypeSnapshot` saves from the Templates page (#851, 22556). */
const ARCHETYPE_TEMPLATE_SNAPSHOT = {
  actorClass: "template",
  archetypeType: "humanoid_npc",
  equipmentProfile: "Short sword",
  humanoidNpcArchetype: { seniority: "fully_trained" },
  profession: "Garrison soldier",
  roleLabel: "Gate guard",
  templateKind: "humanoid_npc_archetype",
};

/** What `buildScenarioActorInputFromTemplate` sends for that Template from the Scenario page. */
const ARCHETYPE_ACTOR_INPUT = {
  kind: "npc",
  name: "Gate guard",
  snapshot: {
    ...ARCHETYPE_TEMPLATE_SNAPSHOT,
    templateId: "template-1",
    templateName: "Gate guard",
  },
};

/** The concrete NPC the Templates page generator saves from that archetype. */
const GENERATED_NPC_SNAPSHOT = {
  actorClass: "campaign_npc",
  build: { id: "npc-1", name: "Gate guard 101" },
  campaignId: "campaign-1",
  generatedHumanoidNpc: { sourceTemplateId: "template-1" },
  generationProvenance: { kind: "humanoid_npc_generator", sourceTemplateId: "template-1" },
  templateId: "template-1",
  templateName: "Gate guard",
};

async function app() {
  const instance = Fastify({ logger: false });
  await instance.register(scenariosRoutes);
  return instance;
}

async function addEntity(payload: Record<string, unknown>) {
  const instance = await app();
  const response = await instance.inject({
    method: "POST",
    payload: { role: "enemy", ...payload },
    url: "/scenarios/scenario-1/participants/entity",
  });
  await instance.close();
  return response;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminUser.mockResolvedValue(mocks.adminUser);
  mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
  mocks.scenarioService.getScenarioById.mockResolvedValue({
    campaignId: "campaign-1",
    id: "scenario-1",
    status: "live",
  });
  mocks.campaignService.getCampaignById.mockResolvedValue({ gmUserId: "gm-1", id: "campaign-1" });
  mocks.campaignService.listCampaignRosterEntries.mockResolvedValue([
    { campaignId: "campaign-1", sourceId: "entity-1", sourceType: "reusableEntity" },
  ]);
  mocks.scenarioService.addEntityParticipant.mockImplementation(async () => ({
    id: "participant-1",
  }));
});

describe("#1001 — an archetype Template is generated from, not fielded", () => {
  it("refuses a temporary actor built from an archetype Template on the Scenario page", async () => {
    const response = await addEntity({ entityInput: ARCHETYPE_ACTOR_INPUT, isTemporary: true });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "generate_npc_from_template_first",
      error: "Generate an NPC from this Template first.",
    });
    expect(mocks.scenarioService.addEntityParticipant).not.toHaveBeenCalled();
  });

  it("refuses an archetype Template fielded by its stored entity id", async () => {
    mocks.campaignService.getReusableEntityById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "template-1",
      kind: "npc",
      name: "Gate guard",
      snapshot: ARCHETYPE_TEMPLATE_SNAPSHOT,
    });

    const response = await addEntity({ entityId: "template-1" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "Generate an NPC from this Template first." });
    expect(mocks.scenarioService.addEntityParticipant).not.toHaveBeenCalled();
  });

  it("still fields an NPC generated from that archetype", async () => {
    mocks.campaignService.getReusableEntityById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "entity-1",
      kind: "npc",
      name: "Gate guard 101",
      snapshot: GENERATED_NPC_SNAPSHOT,
    });

    const response = await addEntity({ entityId: "entity-1" });

    expect(response.statusCode, response.body).toBe(200);
    expect(mocks.scenarioService.addEntityParticipant).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "entity-1" }),
    );
  });

  it.each([
    [
      "the seeded Training Bandit, as the Scenario page sends it",
      {
        ...TRAINING_BANDIT_DEMO_SNAPSHOT,
        actorClass: "template",
        templateId: "bandit",
        templateName: "Training Bandit",
      },
    ],
    [
      "a #666 build-carrying Template",
      { build: { id: "t", name: "Brawler" }, health: { currentHp: 12, maxHp: 12 } },
    ],
    ["an ad-hoc actor with only a display name", { displayName: "Bystander" }],
    ["an ad-hoc actor with no snapshot", undefined],
  ])("fields %s exactly as before", async (_label, snapshot) => {
    const response = await addEntity({
      entityInput: { kind: "npc", name: "Actor", snapshot },
      isTemporary: true,
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(mocks.scenarioService.addEntityParticipant).toHaveBeenCalledTimes(1);
  });
});
