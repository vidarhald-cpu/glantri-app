import { describe, expect, it } from "vitest";
import { EquipmentItemSchema, type AssignedEquipmentItem } from "@glantri/domain";

import type { CharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";

function itemWithMixedVisibility(): AssignedEquipmentItem {
  return EquipmentItemSchema.parse({
    campaignContextId: null,
    category: "weapon",
    characterId: "character-1",
    conditionState: "intact",
    id: "item-1",
    isEquipped: false,
    isStackable: false,
    itemFacts: {
      activeMechanics: [
        {
          id: "revealed-ob",
          kind: "final_attack_ob_delta",
          value: 1,
          visibility: "revealed",
        },
      ],
      descriptiveTraits: [
        {
          category: "history",
          id: "gm-history",
          text: "Its former owner is still searching for it.",
          visibility: "gm_only",
        },
      ],
      templateOverrides: [],
      unsupportedCapabilities: [],
      version: 1,
    },
    material: "steel",
    quality: "standard",
    quantity: 1,
    specificityType: "specific",
    storageAssignment: {
      carryMode: "on_person",
      locationId: "character-1:loc-person",
    },
    templateId: "weapon-template-dagger",
  });
}

function revealedItem(): AssignedEquipmentItem {
  const item = itemWithMixedVisibility();
  return EquipmentItemSchema.parse({
    ...item,
    itemFacts: {
      ...item.itemFacts,
      descriptiveTraits: item.itemFacts.descriptiveTraits.map((fact) => ({
        ...fact,
        visibility: "revealed",
      })),
    },
  });
}

function repositoryWith(item: AssignedEquipmentItem): CharacterEquipmentRepository {
  return {
    async getCharacterEquipmentAggregateState() {
      return { items: [item], loadouts: [], locations: [], revision: 0 };
    },
    async mutateCharacterEquipmentAggregate(input) {
      return { result: await input.mutation(this), revision: input.expectedRevision + 1 };
    },
    async createCharacterEquipmentItem(value) {
      return value;
    },
    async createCampaignEquipmentItem(value) {
      return value;
    },
    async createCharacterStorageLocation(value) {
      return value;
    },
    async ensureDefaultEquipmentLocations() {
      return [];
    },
    async getCanonicalEquipmentItemById(itemId) {
      return itemId === item.id ? item : null;
    },
    async getCampaignEquipmentItems() {
      return [item];
    },
    async getCharacterEquipmentItems() {
      return [item];
    },
    async getCharacterEquipmentState() {
      return { items: [item], loadouts: [], locations: [], revision: 0 };
    },
    async getCharacterLoadouts() {
      return [];
    },
    async getCharacterStorageLocations() {
      return [];
    },
    async moveCharacterEquipmentItem(_characterId, _itemId, storageAssignment) {
      return EquipmentItemSchema.parse({ ...item, storageAssignment });
    },
    async removeCharacterEquipmentItem() {},
    async removeCharacterStorageLocation() {},
    async updateCharacterEquipmentItem(value) {
      return value;
    },
    async updateCampaignEquipmentItemAuthoring(value) {
      return value;
    },
    async transferCampaignEquipmentItem(input) {
      throw new Error(`Unexpected campaign item transfer: ${input.itemId}`);
    },
    async applyCombatItemInteraction(input) {
      throw new Error(`Unexpected Combat Item interaction: ${input.itemId}`);
    },
    async getCombatItemInteractionRecords() {
      return [];
    },
    async upsertCharacterLoadout(value) {
      return value;
    },
  };
}

describe("CharacterEquipmentReadModelService viewer projection", () => {
  it("gives GM all facts and the holder only revealed facts", async () => {
    const service = new CharacterEquipmentReadModelService(
      repositoryWith(itemWithMixedVisibility()),
    );

    const gm = await service.getCharacterEquipmentState("character-1", {
      kind: "gm",
    });
    const holder = await service.getCharacterEquipmentState("character-1", {
      characterId: "character-1",
      kind: "holder",
    });

    expect(gm.itemsById["item-1"]?.itemFacts.descriptiveTraits).toHaveLength(1);
    expect(holder.itemsById["item-1"]?.itemFacts.activeMechanics).toHaveLength(1);
    expect(holder.itemsById["item-1"]?.itemFacts.descriptiveTraits).toEqual([]);
    expect(JSON.stringify(holder)).not.toContain("former owner");
  });

  it("returns no item state for a non-holder or unauthorized viewer", async () => {
    const service = new CharacterEquipmentReadModelService(
      repositoryWith(itemWithMixedVisibility()),
    );

    const nonHolder = await service.getCharacterEquipmentState("character-1", {
      characterId: "character-2",
      kind: "holder",
    });
    const unauthorized = await service.getCharacterEquipmentState("character-1", {
      kind: "unauthorized",
    });

    expect(nonHolder.itemsById).toEqual({});
    expect(unauthorized).toEqual({
      activeLoadoutByCharacterId: {},
      itemsById: {},
      locationsById: {},
      revision: 0,
      templatesById: {},
    });
  });

  it("keeps internal scenario compatibility reads free of instance facts", async () => {
    const service = new CharacterEquipmentReadModelService(
      repositoryWith(itemWithMixedVisibility()),
    );

    const compatibility = await service.getCharacterEquipmentState("character-1");

    expect(compatibility.itemsById["item-1"]?.itemFacts).toEqual({
      activeMechanics: [],
      descriptiveTraits: [],
      templateOverrides: [],
      unsupportedCapabilities: [],
      version: 1,
    });
  });

  it("omits hidden facts completely before reveal and includes them after reveal and reload", async () => {
    const before = await new CharacterEquipmentReadModelService(
      repositoryWith(itemWithMixedVisibility()),
    ).getCharacterEquipmentState("character-1", {
      characterId: "character-1",
      kind: "holder",
    });
    const beforeJson = JSON.stringify(before);

    expect(beforeJson).not.toContain("former owner");
    expect(beforeJson).not.toContain("gm-history");
    expect(beforeJson).not.toContain("gm_only");
    expect(beforeJson).not.toContain("hidden");

    const afterReload = await new CharacterEquipmentReadModelService(
      repositoryWith(revealedItem()),
    ).getCharacterEquipmentState("character-1", {
      characterId: "character-1",
      kind: "holder",
    });

    expect(JSON.stringify(afterReload)).toContain("former owner");
    expect(afterReload.itemsById["item-1"]?.itemFacts.descriptiveTraits).toHaveLength(1);
  });
});
