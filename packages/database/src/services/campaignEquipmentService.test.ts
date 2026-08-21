import { describe, expect, it } from "vitest";
import {
  CanonicalEquipmentItemSchema,
  type CanonicalEquipmentItem,
  type StorageLocation,
} from "@glantri/domain";

import type { CharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";
import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { CharacterEquipmentWriteService } from "./characterEquipmentWriteService";

function repositoryStub() {
  const items = new Map<string, CanonicalEquipmentItem>();
  const locations: StorageLocation[] = [
    {
      availabilityClass: "with_you",
      characterId: "character-1",
      id: "character-1:loc-person",
      isAccessibleInEncounter: true,
      isMobile: true,
      name: "On person",
      notes: null,
      parentLocationId: null,
      type: "person_system",
    },
  ];
  const clone = (item: CanonicalEquipmentItem) => CanonicalEquipmentItemSchema.parse(item);

  const repository: CharacterEquipmentRepository = {
    async createCampaignEquipmentItem(item) {
      items.set(item.id, clone(item));
      return clone(item);
    },
    async createCharacterEquipmentItem() {
      throw new Error("Unexpected Character item create.");
    },
    async createCharacterStorageLocation(value) {
      return value;
    },
    async ensureDefaultEquipmentLocations() {
      return locations;
    },
    async getCampaignEquipmentItems(campaignId) {
      return [...items.values()].filter((item) => item.campaignContextId === campaignId).map(clone);
    },
    async getCanonicalEquipmentItemById(itemId) {
      return items.get(itemId) ?? null;
    },
    async getCharacterEquipmentItems() {
      return [];
    },
    async getCharacterEquipmentState() {
      return { items: [], loadouts: [], locations };
    },
    async getCharacterLoadouts() {
      return [];
    },
    async getCharacterStorageLocations() {
      return locations;
    },
    async moveCharacterEquipmentItem() {
      throw new Error("Unexpected move.");
    },
    async removeCharacterEquipmentItem() {},
    async removeCharacterStorageLocation() {},
    async updateCampaignEquipmentItemAuthoring(item) {
      items.set(item.id, clone(item));
      return clone(item);
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
    async updateCharacterEquipmentItem() {
      throw new Error("Unexpected Character item update.");
    },
    async upsertCharacterLoadout(value) {
      return value;
    },
  };

  return { items, repository };
}

const emptyFacts = {
  activeMechanics: [],
  descriptiveTraits: [],
  templateOverrides: [],
  unsupportedCapabilities: [],
  version: 1 as const,
};

describe("campaign equipment services", () => {
  it("creates and reloads an unassigned ordinary item in the campaign authority", async () => {
    const { repository } = repositoryStub();
    const write = new CharacterEquipmentWriteService(repository);
    const read = new CharacterEquipmentReadModelService(repository);

    const created = await write.createCampaignEquipmentItem({
      campaignId: "campaign-1",
      holderCharacterId: null,
      itemFacts: emptyFacts,
      templateId: "weapon-template-dagger",
    });
    const reloaded = await read.getCampaignEquipmentState("campaign-1");

    expect(created).toMatchObject({
      campaignContextId: "campaign-1",
      holderCharacterId: null,
      storageAssignment: null,
    });
    expect(reloaded.itemsById[created.id]?.id).toBe(created.id);
  });

  it("assigns a customized item to the Character's existing On person location and preserves its holder during reveal edits", async () => {
    const { repository } = repositoryStub();
    const write = new CharacterEquipmentWriteService(repository);
    const created = await write.createCampaignEquipmentItem({
      campaignId: "campaign-1",
      displayName: "Silverston",
      holderCharacterId: "character-1",
      itemFacts: {
        ...emptyFacts,
        descriptiveTraits: [
          {
            category: "engraving",
            id: "mark",
            text: "House Silverston",
            visibility: "gm_only",
          },
        ],
      },
      templateId: "weapon-template-fencing-sword",
    });

    expect(created).toMatchObject({
      holderCharacterId: "character-1",
      storageAssignment: { carryMode: "on_person", locationId: "character-1:loc-person" },
    });

    const edited = await write.updateCampaignEquipmentItemAuthoring({
      campaignId: "campaign-1",
      displayName: "Silverston",
      itemFacts: {
        ...created.itemFacts,
        descriptiveTraits: created.itemFacts.descriptiveTraits.map((fact) => ({
          ...fact,
          visibility: "revealed" as const,
        })),
      },
      itemId: created.id,
      notes: "A balanced fencing sword.",
    });

    expect(edited.holderCharacterId).toBe("character-1");
    expect(edited.storageAssignment).toEqual(created.storageAssignment);
    expect(edited.itemFacts.descriptiveTraits[0]?.visibility).toBe("revealed");
  });

  it("round-trips adding, preserving, and removing Disarm template overrides", async () => {
    const { repository } = repositoryStub();
    const write = new CharacterEquipmentWriteService(repository);
    const read = new CharacterEquipmentReadModelService(repository);
    const created = await write.createCampaignEquipmentItem({
      campaignId: "campaign-1",
      holderCharacterId: null,
      itemFacts: emptyFacts,
      templateId: "weapon-template-rapier",
    });
    const disarmOverrides = [
      {
        id: "capability",
        kind: "weapon_disarm_capability_override" as const,
        scope: "all_attack_modes" as const,
        value: "none" as const,
        visibility: "gm_only" as const,
      },
      {
        id: "control",
        kind: "weapon_disarm_control_override" as const,
        scope: "all_attack_modes" as const,
        unit: "control_rating" as const,
        value: 4,
        visibility: "revealed" as const,
      },
    ];
    const normalizedOverrides = [
      { ...disarmOverrides[0], active: false },
      { ...disarmOverrides[1], active: true },
    ];

    await write.updateCampaignEquipmentItemAuthoring({
      campaignId: "campaign-1",
      displayName: "Disarming rapier",
      itemFacts: { ...created.itemFacts, templateOverrides: disarmOverrides },
      itemId: created.id,
      notes: "First edit",
    });
    const added = (await read.getCampaignEquipmentState("campaign-1")).itemsById[created.id]!;
    expect(added.itemFacts.templateOverrides).toEqual(normalizedOverrides);

    await write.updateCampaignEquipmentItemAuthoring({
      campaignId: "campaign-1",
      displayName: "Renamed disarming rapier",
      itemFacts: added.itemFacts,
      itemId: created.id,
      notes: "Unrelated edit",
    });
    const preserved = (await read.getCampaignEquipmentState("campaign-1")).itemsById[created.id]!;
    expect(preserved.itemFacts.templateOverrides).toEqual(normalizedOverrides);

    await write.updateCampaignEquipmentItemAuthoring({
      campaignId: "campaign-1",
      itemFacts: { ...preserved.itemFacts, templateOverrides: [] },
      itemId: created.id,
    });
    const removed = (await read.getCampaignEquipmentState("campaign-1")).itemsById[created.id]!;
    expect(removed.itemFacts.templateOverrides).toEqual([]);
  });
});
