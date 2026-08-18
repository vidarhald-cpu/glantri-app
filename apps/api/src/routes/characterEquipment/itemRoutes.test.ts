import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../lib/errors";

const mocks = vi.hoisted(() => ({
  addItem: vi.fn(),
  ensureInitialized: vi.fn(),
  getState: vi.fn(),
  metadata: vi.fn(),
  moveItem: vi.fn(),
  quantity: vi.fn(),
  removeItem: vi.fn(),
  requireAccess: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@glantri/database", () => ({
  CharacterEquipmentReadModelService: class {
    getCharacterEquipmentState = mocks.getState;
  },
  CharacterEquipmentWriteService: class {
    addCharacterEquipmentItem = mocks.addItem;
    ensureCharacterEquipmentInitialized = mocks.ensureInitialized;
    moveCharacterEquipmentItem = mocks.moveItem;
    removeCharacterEquipmentItem = mocks.removeItem;
    updateCharacterEquipmentMetadata = mocks.metadata;
    updateCharacterEquipmentQuantity = mocks.quantity;
  },
}));

vi.mock("../../lib/sessionAuth", () => ({
  requireAuthenticatedUser: mocks.requireUser,
}));

vi.mock("./access", () => ({
  requireAccessibleCharacter: mocks.requireAccess,
}));

import { equipmentItemRoutes } from "./itemRoutes";

const characterId = "character-1";
const campaignItemId = "campaign-1:item-1";
const emptyState = {
  activeLoadoutByCharacterId: {},
  itemsById: {},
  locationsById: {},
  templatesById: {},
};

describe("Character Equipment item route authority", () => {
  const apps: Array<ReturnType<typeof Fastify>> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", roles: ["player"] });
    mocks.getState.mockResolvedValue(emptyState);
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function buildApp() {
    const app = Fastify();
    apps.push(app);
    await app.register(equipmentItemRoutes, { prefix: "/characters" });
    return app;
  }

  it.each([
    { expectedStatus: 400, perspective: "holder" },
    { expectedStatus: 404, perspective: "non-holder campaign participant" },
    { expectedStatus: 404, perspective: "unrelated user" },
  ])("denies campaign item update and deletion for $perspective", async ({ expectedStatus }) => {
    if (expectedStatus === 400) {
      mocks.requireAccess.mockResolvedValue({ characterId, kind: "holder" });
      const denied = new Error("Campaign item details can only be changed from Campaign Items.");
      mocks.metadata.mockRejectedValue(denied);
      mocks.removeItem.mockRejectedValue(denied);
    } else {
      mocks.requireAccess.mockRejectedValue(new NotFoundError());
    }
    const app = await buildApp();

    const metadataResponse = await app.inject({
      method: "POST",
      payload: {
        conditionState: "damaged",
        displayName: "Unauthorized rewrite",
        itemId: campaignItemId,
        notes: "Unauthorized notes",
      },
      url: `/characters/${characterId}/equipment/items/metadata`,
    });
    const removeResponse = await app.inject({
      method: "POST",
      payload: { itemId: campaignItemId },
      url: `/characters/${characterId}/equipment/items/remove`,
    });

    expect(metadataResponse.statusCode).toBe(expectedStatus);
    expect(removeResponse.statusCode).toBe(expectedStatus);
    expect(metadataResponse.body).not.toContain("Unauthorized notes");
    expect(removeResponse.body).not.toContain(campaignItemId);
  });

  it("keeps ordinary holder template-based item creation available", async () => {
    mocks.requireAccess.mockResolvedValue({ characterId, kind: "holder" });
    mocks.addItem.mockResolvedValue(undefined);
    const app = await buildApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        initialCarryMode: "equipped",
        initialLocationId: `${characterId}:loc-equipped`,
        quantity: 1,
        templateId: "weapon-template-dagger",
      },
      url: `/characters/${characterId}/equipment/items`,
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.addItem).toHaveBeenCalledWith(
      characterId,
      expect.objectContaining({
        initialCarryMode: "equipped",
        templateId: "weapon-template-dagger",
      }),
    );
  });
});
