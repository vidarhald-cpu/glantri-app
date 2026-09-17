import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireAdminUser: vi.fn() }));
vi.mock("../../lib/sessionAuth", () => ({ requireAdminUser: auth.requireAdminUser }));

import {
  createCampaignItemRoutes,
  parseCampaignItemFacts,
  type CampaignItemRouteServices,
} from "./campaignItemRoutes";

const gm = { email: "gm@example.test", id: "gm-1", roles: ["game_master"] };

function services(): CampaignItemRouteServices {
  return {
    campaignService: {
      getCampaignById: vi.fn(async () => ({ gmUserId: gm.id, id: "campaign-1" })),
      listCampaignRosterEntries: vi.fn(async () => [
        { campaignId: "campaign-1", sourceId: "character-1", sourceType: "character" },
      ]),
    } as unknown as CampaignItemRouteServices["campaignService"],
    characterService: {
      getCharacterById: vi.fn(async () => ({ id: "character-1", name: "Alaric" })),
    } as unknown as CampaignItemRouteServices["characterService"],
    readService: {
      getCampaignEquipmentState: vi.fn(async () => ({ itemsById: {}, templatesById: {} })),
    } as unknown as CampaignItemRouteServices["readService"],
    writeService: {
      assignCampaignEquipmentItem: vi.fn(async (input) => input),
      createCampaignEquipmentItem: vi.fn(async (input) => input),
      unassignCampaignEquipmentItem: vi.fn(async (input) => input),
      updateCampaignEquipmentItemAuthoring: vi.fn(async (input) => input),
    } as unknown as CampaignItemRouteServices["writeService"],
  };
}

async function appWith(routeServices: CampaignItemRouteServices) {
  const app = Fastify({ logger: false });
  await app.register(createCampaignItemRoutes(routeServices));
  return app;
}

describe("campaign item fact parsing", () => {
  it("fails omitted and unknown visibility closed to GM only", () => {
    const facts = parseCampaignItemFacts({
      descriptiveTraits: [
        { category: "engraving", text: "Hidden arms" },
        { category: "history", text: "Lost heirloom", visibility: "surprise" },
      ],
      unsupportedCapabilities: [],
    });

    expect(facts.descriptiveTraits.map((fact) => fact.visibility)).toEqual(["gm_only", "gm_only"]);
  });

  it("accepts explicit Disarm capability/control additions and removals", () => {
    const overrides = [
      {
        id: "capability",
        kind: "weapon_disarm_capability_override",
        scope: "all_attack_modes",
        value: "none",
        visibility: "gm_only",
      },
      {
        id: "control",
        kind: "weapon_disarm_control_override",
        scope: "all_attack_modes",
        unit: "control_rating",
        value: 4,
        visibility: "revealed",
      },
    ];

    expect(
      parseCampaignItemFacts({
        descriptiveTraits: [],
        templateOverrides: overrides,
        unsupportedCapabilities: [],
      }).templateOverrides,
    ).toEqual(overrides);
    expect(
      parseCampaignItemFacts({
        descriptiveTraits: [],
        templateOverrides: [],
        unsupportedCapabilities: [],
      }).templateOverrides,
    ).toEqual([]);
  });
});

describe("campaign item routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdminUser.mockResolvedValue(gm);
  });

  it("lists only for the campaign GM and returns the assignment choices", async () => {
    const routeServices = services();
    const app = await appWith(routeServices);
    const response = await app.inject({ method: "GET", url: "/campaigns/campaign-1/items" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      characters: [{ id: "character-1", name: "Alaric" }],
      state: { itemsById: {}, templatesById: {} },
    });
    await app.close();
  });

  it("does not expose the authoring route to a player", async () => {
    auth.requireAdminUser.mockImplementation(async (_request, reply) => {
      await reply.code(403).send({ error: "Admin or GM role required." });
      return null;
    });
    const app = await appWith(services());
    const response = await app.inject({ method: "GET", url: "/campaigns/campaign-1/items" });

    expect(response.statusCode).toBe(403);
    expect(response.body).not.toContain("itemsById");
    await app.close();
  });

  it("hides another GM's campaign as not found", async () => {
    const routeServices = services();
    vi.mocked(routeServices.campaignService.getCampaignById).mockResolvedValue({
      gmUserId: "gm-2",
      id: "campaign-1",
    } as never);
    const app = await appWith(routeServices);
    const response = await app.inject({ method: "GET", url: "/campaigns/campaign-1/items" });

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain("itemsById");
    await app.close();
  });

  it("does not let an unrelated Admin inspect or assign another Campaign's Items", async () => {
    auth.requireAdminUser.mockResolvedValue({
      email: "admin@example.test",
      id: "admin-1",
      roles: ["admin"],
    });
    const routeServices = services();
    const app = await appWith(routeServices);
    const read = await app.inject({ method: "GET", url: "/campaigns/campaign-1/items" });
    const assign = await app.inject({
      method: "POST",
      payload: {
        expectedItemRevision: "2026-09-16T00:00:00.000Z",
        expectedRevision: 0,
        targetCharacterId: "character-1",
      },
      url: "/campaigns/campaign-1/items/private-item/assign",
    });

    expect(read.statusCode).toBe(404);
    expect(assign.statusCode).toBe(404);
    expect(read.body).not.toContain("itemsById");
    expect(assign.body).not.toContain("private-item");
    expect(routeServices.readService.getCampaignEquipmentState).not.toHaveBeenCalled();
    expect(routeServices.writeService.assignCampaignEquipmentItem).not.toHaveBeenCalled();
    await app.close();
  });

  it("creates one typed canonical item and rejects a Character from another campaign", async () => {
    const routeServices = services();
    const app = await appWith(routeServices);
    const invalid = await app.inject({
      method: "POST",
      payload: {
        facts: { descriptiveTraits: [], unsupportedCapabilities: [] },
        holderCharacterId: "character-other",
        templateId: "weapon-template-fencing-sword",
      },
      url: "/campaigns/campaign-1/items",
    });
    expect(invalid.statusCode).toBe(400);
    expect(routeServices.writeService.createCampaignEquipmentItem).not.toHaveBeenCalled();

    const valid = await app.inject({
      method: "POST",
      payload: {
        displayName: "Silverston",
        facts: {
          descriptiveTraits: [{ category: "engraving", text: "House Silverston" }],
          finalAttackObDelta: { value: 1, visibility: "revealed" },
          initiativeOverride: { value: 1, visibility: "revealed" },
          unsupportedCapabilities: [],
        },
        holderCharacterId: "character-1",
        templateId: "weapon-template-fencing-sword",
      },
      url: "/campaigns/campaign-1/items",
    });
    expect(valid.statusCode).toBe(200);
    expect(routeServices.writeService.createCampaignEquipmentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "campaign-1",
        displayName: "Silverston",
        evidence: { actorAuthority: "campaign_gm", actorUserId: "gm-1" },
        holderCharacterId: "character-1",
      }),
    );
    await app.close();
  });

  it.each([
    { kind: "input", property: "finalAttackOb", value: 99 },
    { kind: "input", property: "name", value: 99 },
    { kind: "input", property: "baseEncumbrance", value: 1, templateId: "injected" },
  ])("rejects unknown or structural override input before writing", async (override) => {
    const routeServices = services();
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "POST",
      url: "/campaigns/campaign-1/items",
      payload: { templateId: "weapon-template-dagger", mechanicalOverrides: [override] },
    });
    expect(response.statusCode).toBe(400);
    expect(routeServices.writeService.createCampaignEquipmentItem).not.toHaveBeenCalled();
    await app.close();
  });

  it("forwards ammunition quantity and defaults omitted quantity to one", async () => {
    const routeServices = services();
    const app = await appWith(routeServices);
    for (const quantity of [20, undefined]) {
      const response = await app.inject({
        method: "POST",
        url: "/campaigns/campaign-1/items",
        payload: { templateId: "gear-template-arrows", quantity },
      });
      expect(response.statusCode).toBe(200);
      expect(routeServices.writeService.createCampaignEquipmentItem).toHaveBeenLastCalledWith(
        expect.objectContaining({ quantity: quantity ?? 1 }),
      );
    }
    await app.close();
  });

  it.each([1.5, "20", null])(
    "rejects non-integer Campaign quantity %s before writing",
    async (quantity) => {
      const routeServices = services();
      const app = await appWith(routeServices);
      const response = await app.inject({
        method: "POST",
        url: "/campaigns/campaign-1/items",
        payload: { templateId: "gear-template-arrows", quantity },
      });
      expect(response.statusCode).toBe(400);
      expect(routeServices.writeService.createCampaignEquipmentItem).not.toHaveBeenCalled();
      await app.close();
    },
  );

  it("assigns and unassigns the same existing Item with revision checks", async () => {
    const routeServices = services();
    const app = await appWith(routeServices);
    const assigned = await app.inject({
      method: "POST",
      payload: {
        expectedItemRevision: "2026-09-16T00:00:00.000Z",
        expectedRevision: 3,
        targetCharacterId: "character-1",
      },
      url: "/campaigns/campaign-1/items/item-1/assign",
    });
    expect(assigned.statusCode).toBe(200);
    expect(routeServices.writeService.assignCampaignEquipmentItem).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      evidence: { actorAuthority: "campaign_gm", actorUserId: "gm-1" },
      itemId: "item-1",
      expectedItemRevision: "2026-09-16T00:00:00.000Z",
      targetCharacterId: "character-1",
      targetExpectedRevision: 3,
    });

    const unassigned = await app.inject({
      method: "POST",
      payload: {
        expectedItemRevision: "2026-09-16T00:00:00.000Z",
        expectedRevision: 4,
        sourceCharacterId: "character-1",
      },
      url: "/campaigns/campaign-1/items/item-1/unassign",
    });
    expect(unassigned.statusCode).toBe(200);
    expect(routeServices.writeService.unassignCampaignEquipmentItem).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      evidence: { actorAuthority: "campaign_gm", actorUserId: "gm-1" },
      itemId: "item-1",
      expectedItemRevision: "2026-09-16T00:00:00.000Z",
      sourceCharacterId: "character-1",
      sourceExpectedRevision: 4,
    });
    await app.close();
  });

  it("edits facts without accepting a holder change", async () => {
    const routeServices = services();
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "PATCH",
      payload: {
        expectedItemRevision: "2026-09-16T00:00:00.000Z",
        facts: {
          descriptiveTraits: [
            { category: "engraving", id: "mark", text: "Revealed", visibility: "revealed" },
          ],
          unsupportedCapabilities: [],
        },
        holderCharacterId: "character-other",
      },
      url: "/campaigns/campaign-1/items/item-1",
    });

    expect(response.statusCode).toBe(200);
    expect(routeServices.writeService.updateCampaignEquipmentItemAuthoring).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      displayName: null,
      itemFacts: expect.objectContaining({
        descriptiveTraits: [expect.objectContaining({ visibility: "revealed" })],
      }),
      itemId: "item-1",
      expectedItemRevision: "2026-09-16T00:00:00.000Z",
      notes: null,
      mechanicalOverrides: undefined,
      physicalBaseEncumbrance: undefined,
      quantity: undefined,
    });
    expect(
      routeServices.writeService.updateCampaignEquipmentItemAuthoring,
    ).not.toHaveBeenCalledWith(expect.objectContaining({ holderCharacterId: expect.anything() }));
    await app.close();
  });
});
