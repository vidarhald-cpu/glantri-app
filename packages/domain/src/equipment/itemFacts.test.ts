import { describe, expect, it } from "vitest";

import {
  CanonicalEquipmentItemSchema,
  EquipmentItemFactsV1Schema,
  EquipmentItemSchema,
} from "./schemas";

function baseItem() {
  return {
    acquiredFrom: null,
    campaignContextId: null,
    category: "weapon" as const,
    conditionState: "intact" as const,
    displayName: "Silverston Sword",
    durabilityCurrent: null,
    durabilityMax: null,
    encumbranceOverride: null,
    id: "item-silverston-sword",
    isEquipped: false,
    isFavorite: null,
    isStackable: false,
    material: "steel" as const,
    notes: null,
    previousStorageAssignment: null,
    quality: "extraordinary" as const,
    quantity: 1,
    specificityType: "specific" as const,
    statusTags: null,
    templateId: "weapon-template-fencing-sword",
    valueOverride: null,
  };
}

describe("durable equipment item authority", () => {
  it("represents an unheld item with no Character storage assignment", () => {
    const item = CanonicalEquipmentItemSchema.parse({
      ...baseItem(),
      characterId: null,
      holderCharacterId: null,
      itemFacts: { version: 1 },
      storageAssignment: null,
    });

    expect(item).toMatchObject({
      campaignContextId: null,
      characterId: null,
      holderCharacterId: null,
      storageAssignment: null,
    });
  });

  it("derives the legacy characterId view from the canonical holder", () => {
    const item = EquipmentItemSchema.parse({
      ...baseItem(),
      holderCharacterId: "character-1",
      itemFacts: { version: 1 },
      storageAssignment: {
        carryMode: "on_person",
        locationId: "character-1:loc-person",
      },
    });

    expect(item.characterId).toBe("character-1");
    expect(item.holderCharacterId).toBe("character-1");
  });

  it("fails closed when fact visibility is omitted or unknown", () => {
    const facts = EquipmentItemFactsV1Schema.parse({
      descriptiveTraits: [
        { category: "engraving", id: "trait-1", text: "House Silverston arms" },
        {
          category: "history",
          id: "trait-2",
          text: "Recovered at Highforge",
          visibility: "unexpected-value",
        },
      ],
      version: 1,
    });

    expect(facts.descriptiveTraits.map((fact) => fact.visibility)).toEqual(["gm_only", "gm_only"]);
  });

  it("accepts signed integer differences and rejects duplicate or stacking facts", () => {
    expect(
      EquipmentItemFactsV1Schema.parse({
        activeMechanics: [{ id: "ob-penalty", kind: "final_attack_ob_delta", value: -1 }],
        templateOverrides: [{ id: "slow", kind: "weapon_initiative_override", value: 3 }],
        version: 1,
      }),
    ).toMatchObject({
      activeMechanics: [{ value: -1 }],
      templateOverrides: [{ value: 3 }],
    });

    expect(() =>
      EquipmentItemFactsV1Schema.parse({
        activeMechanics: [{ id: "duplicate", kind: "final_attack_ob_delta", value: 1 }],
        descriptiveTraits: [{ category: "other", id: "duplicate", text: "same id" }],
        version: 1,
      }),
    ).toThrow("Item fact IDs must be unique");

    expect(() =>
      EquipmentItemFactsV1Schema.parse({
        activeMechanics: [
          { id: "ob-1", kind: "final_attack_ob_delta", value: 1 },
          { id: "ob-2", kind: "final_attack_ob_delta", value: -1 },
        ],
        version: 1,
      }),
    ).toThrow("final_attack_ob_delta does not stack");
  });

  it("migrates legacy strings without making them active mechanics", () => {
    const item = EquipmentItemSchema.parse({
      ...baseItem(),
      characterId: "character-1",
      specialProperties: {
        customNotes: "Kept wrapped in blue cloth.",
        magicEffects: ["Cast X once per day"],
        roleplayTraits: ["Arms of House Silverston"],
      },
      storageAssignment: {
        carryMode: "on_person",
        locationId: "character-1:loc-person",
      },
    });

    expect(item.itemFacts.activeMechanics).toEqual([]);
    expect(item.itemFacts.descriptiveTraits).toEqual([
      expect.objectContaining({ category: "other", visibility: "revealed" }),
    ]);
    expect(item.itemFacts.unsupportedCapabilities).toEqual([
      expect.objectContaining({
        rulesText: "Cast X once per day",
        visibility: "revealed",
      }),
    ]);
    expect(item.notes).toBe("Kept wrapped in blue cloth.");
    expect(item.specialProperties).toBeNull();
  });
});
