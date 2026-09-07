import Fastify from "fastify";
import { StaleEquipmentTransferError } from "@glantri/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireAdminUser: vi.fn() }));
vi.mock("../../lib/sessionAuth", () => ({ requireAdminUser: auth.requireAdminUser }));

import {
  createEquipmentTransferRoutes,
  type EquipmentTransferRouteServices,
} from "./transferRoutes";

const gm = { email: "gm@example.test", id: "gm-1", roles: ["game_master"] };

function services(): EquipmentTransferRouteServices {
  const characters = new Map([
    ["character-1", { id: "character-1", name: "Alaric" }],
    ["character-2", { id: "character-2", name: "Beatrice" }],
  ]);
  return {
    campaignService: {
      getCampaignById: vi.fn(async () => ({ gmUserId: gm.id, id: "campaign-1" })),
      listCampaignRosterEntries: vi.fn(async () =>
        Array.from(characters.keys()).map((sourceId) => ({
          campaignId: "campaign-1",
          sourceId,
          sourceType: "character",
        })),
      ),
    } as unknown as EquipmentTransferRouteServices["campaignService"],
    characterService: {
      getCharacterById: vi.fn(async (id: string) => characters.get(id) ?? null),
    } as unknown as EquipmentTransferRouteServices["characterService"],
    readService: {
      getCampaignEquipmentState: vi.fn(async () => ({ itemsById: {}, templatesById: {} })),
    } as unknown as EquipmentTransferRouteServices["readService"],
    writeService: {
      transferCampaignEquipmentItem: vi.fn(async (input) => input),
    } as unknown as EquipmentTransferRouteServices["writeService"],
  };
}

async function appWith(routeServices: EquipmentTransferRouteServices) {
  const app = Fastify({ logger: false });
  await app.register(createEquipmentTransferRoutes(routeServices), { prefix: "/characters" });
  return app;
}

describe("campaign item transfer route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireAdminUser.mockResolvedValue(gm);
  });

  it("authorizes the campaign GM and transfers between roster Characters", async () => {
    const routeServices = services();
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "POST",
      payload: {
        campaignId: "campaign-1",
        expectedRevision: 0,
        targetCharacterId: "character-2",
        targetExpectedRevision: 0,
      },
      url: "/characters/character-1/equipment/items/item-1/transfer",
    });

    expect(response.statusCode).toBe(200);
    expect(routeServices.writeService.transferCampaignEquipmentItem).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      itemId: "item-1",
      sourceExpectedRevision: 0,
      sourceCharacterId: "character-1",
      targetCharacterId: "character-2",
      targetExpectedRevision: 0,
    });
    expect(response.json().characters).toEqual([
      { id: "character-1", name: "Alaric" },
      { id: "character-2", name: "Beatrice" },
    ]);
    await app.close();
  });

  it("denies players before reading transfer details", async () => {
    auth.requireAdminUser.mockImplementation(async (_request, reply) => {
      await reply.code(403).send({ error: "Admin or GM role required." });
      return null;
    });
    const routeServices = services();
    const app = await appWith(routeServices);
    const response = await app.inject({
      method: "POST",
      payload: {
        campaignId: "campaign-1",
        expectedRevision: 0,
        targetCharacterId: "character-2",
        targetExpectedRevision: 0,
      },
      url: "/characters/character-1/equipment/items/hidden-item/transfer",
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).not.toContain("hidden-item");
    expect(routeServices.writeService.transferCampaignEquipmentItem).not.toHaveBeenCalled();
    await app.close();
  });

  it("hides another GM's campaign and rejects Characters outside its roster", async () => {
    const otherCampaignServices = services();
    vi.mocked(otherCampaignServices.campaignService.getCampaignById).mockResolvedValue({
      gmUserId: "gm-2",
      id: "campaign-1",
    } as never);
    const otherCampaignApp = await appWith(otherCampaignServices);
    const hidden = await otherCampaignApp.inject({
      method: "POST",
      payload: {
        campaignId: "campaign-1",
        expectedRevision: 0,
        targetCharacterId: "character-2",
        targetExpectedRevision: 0,
      },
      url: "/characters/character-1/equipment/items/item-1/transfer",
    });
    expect(hidden.statusCode).toBe(404);
    expect(hidden.body).not.toContain("item-1");
    await otherCampaignApp.close();

    const routeServices = services();
    const app = await appWith(routeServices);
    const invalid = await app.inject({
      method: "POST",
      payload: {
        campaignId: "campaign-1",
        expectedRevision: 0,
        targetCharacterId: "character-other",
        targetExpectedRevision: 0,
      },
      url: "/characters/character-1/equipment/items/item-1/transfer",
    });
    expect(invalid.statusCode).toBe(400);
    expect(routeServices.writeService.transferCampaignEquipmentItem).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects invalid payloads and reports stale transfers as recoverable conflicts", async () => {
    const routeServices = services();
    const app = await appWith(routeServices);
    const invalid = await app.inject({
      method: "POST",
      payload: {
        campaignId: "campaign-1",
        expectedRevision: 0,
        targetCharacterId: 42,
        targetExpectedRevision: 0,
      },
      url: "/characters/character-1/equipment/items/item-1/transfer",
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: "Choose the Character receiving the item." });

    vi.mocked(routeServices.writeService.transferCampaignEquipmentItem).mockRejectedValue(
      new StaleEquipmentTransferError(),
    );
    const stale = await app.inject({
      method: "POST",
      payload: {
        campaignId: "campaign-1",
        expectedRevision: 0,
        targetCharacterId: "character-2",
        targetExpectedRevision: 0,
      },
      url: "/characters/character-1/equipment/items/item-1/transfer",
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toEqual({
      error: "This item has already moved. Refresh Campaign Items before trying again.",
    });
    await app.close();
  });
});
