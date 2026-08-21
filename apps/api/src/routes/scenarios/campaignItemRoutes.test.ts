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
      createCampaignEquipmentItem: vi.fn(async (input) => input),
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
    ).toEqual([
      expect.objectContaining({ active: false, id: "capability" }),
      expect.objectContaining({ active: true, id: "control" }),
    ]);
    expect(
      parseCampaignItemFacts({
        descriptiveTraits: [],
        templateOverrides: [],
        unsupportedCapabilities: [],
      }).templateOverrides,
    ).toEqual([]);
  });

  it("accepts the closed typed characteristic contract and explicit inactive state", () => {
    const facts = parseCampaignItemFacts({
      characteristics: [
        {
          active: false,
          id: "slash-ob",
          kind: "attack_mode_ob_delta",
          scope: { attackModeId: "slash", kind: "attack_mode" },
          unit: "ob_points",
          value: 2,
          visibility: "revealed",
        },
      ],
      descriptiveTraits: [],
      finalAttackObDelta: {
        active: false,
        id: "late-ob",
        provenance: { source: "legacy_item_fact", sourceTemplateVersion: "v1" },
        value: 1,
        visibility: "revealed",
      },
      unsupportedCapabilities: [],
    });

    expect(facts.characteristics).toEqual([
      expect.objectContaining({ active: false, id: "slash-ob" }),
    ]);
    expect(facts.activeMechanics).toEqual([
      expect.objectContaining({
        active: false,
        id: "late-ob",
        provenance: { source: "legacy_item_fact", sourceTemplateVersion: "v1" },
      }),
    ]);
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
        holderCharacterId: "character-1",
      }),
    );
    await app.close();
  });

  it("edits facts without accepting a holder change", async () => {
    const routeServices = services();
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "PATCH",
      payload: {
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
      notes: null,
    });
    expect(
      routeServices.writeService.updateCampaignEquipmentItemAuthoring,
    ).not.toHaveBeenCalledWith(expect.objectContaining({ holderCharacterId: expect.anything() }));
    await app.close();
  });
});
