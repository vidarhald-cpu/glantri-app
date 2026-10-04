import { describe, expect, it } from "vitest";

import {
  createEmptyEquipmentItemFacts,
  revealableEquipmentItemFacts,
  revealableEquipmentState,
} from "./itemFacts";
import {
  CanonicalEquipmentItemSchema,
  canonicalizeLegacyEquipmentSnapshotItems,
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

/** A captured snapshot item as the Character equipment aggregate hands it to the GM. */
function snapshotItem(overrides: Record<string, unknown> = {}) {
  return {
    ...baseItem(),
    characterId: "character-1",
    holderCharacterId: "character-1",
    storageAssignment: { carryMode: "on_person", locationId: "character-1:loc-person" },
    ...overrides,
  };
}

const MIXED_FACTS = {
  activeMechanics: [
    { id: "ob-hidden", kind: "final_attack_ob_delta", value: 1, visibility: "gm_only" },
  ],
  descriptiveTraits: [
    { category: "engraving", id: "trait-revealed", text: "House arms", visibility: "revealed" },
    {
      category: "history",
      id: "trait-hidden",
      text: "Stolen from the duke",
      visibility: "gm_only",
    },
    { category: "history", id: "trait-unmarked", text: "No visibility recorded" },
  ],
  templateOverrides: [
    { id: "slow-revealed", kind: "weapon_initiative_override", value: 3, visibility: "revealed" },
    {
      id: "control-hidden",
      kind: "weapon_disarm_control_override",
      value: 4,
      visibility: "gm_only",
    },
  ],
  unsupportedCapabilities: [
    {
      id: "capability-revealed",
      name: "Shines",
      rulesText: "Sheds light",
      usageText: null,
      visibility: "revealed",
    },
    {
      id: "capability-hidden",
      name: "Cursed",
      rulesText: "Bound to the bearer",
      usageText: null,
      visibility: "gm_only",
    },
  ],
  version: 1,
};

describe("revealableEquipmentState — a captured snapshot reaching its holder", () => {
  it("keeps revealed facts and overrides and removes GM-only and unmarked ones", () => {
    const state = revealableEquipmentState({
      itemsById: {
        "item-sword": snapshotItem({
          itemFacts: MIXED_FACTS,
          mechanicalOverrides: [
            { kind: "input", property: "parry", value: 2, visibility: "gm_only" },
            { kind: "attack", modeId: "thrust", property: "ob", value: 1, visibility: "revealed" },
            { kind: "input", property: "initiative", value: 1 },
          ],
          notes: "A fine blade.",
        }),
      },
      revision: 3,
    }) as { itemsById: Record<string, Record<string, unknown>>; revision: number };

    expect(state.revision).toBe(3);
    expect(state.itemsById["item-sword"]).toMatchObject({
      displayName: "Silverston Sword",
      itemFacts: {
        activeMechanics: [],
        descriptiveTraits: [MIXED_FACTS.descriptiveTraits[0]],
        templateOverrides: [MIXED_FACTS.templateOverrides[0]],
        unsupportedCapabilities: [MIXED_FACTS.unsupportedCapabilities[0]],
        version: 1,
      },
      mechanicalOverrides: [
        { kind: "attack", modeId: "thrust", property: "ob", value: 1, visibility: "revealed" },
      ],
      notes: "A fine blade.",
      specialProperties: null,
    });
  });

  it("fails closed on facts it cannot read and on a raw legacy bag", () => {
    const state = revealableEquipmentState({
      itemsById: {
        "item-future": snapshotItem({ itemFacts: { ...MIXED_FACTS, version: 2 } }),
        "item-legacy": snapshotItem({ specialProperties: { roleplayTraits: ["Wolf crest"] } }),
        "item-unversioned": snapshotItem({ itemFacts: { descriptiveTraits: [] } }),
        malformed: "not an item",
      },
    }) as { itemsById: Record<string, Record<string, unknown>> };

    expect(Object.keys(state.itemsById).sort()).toEqual([
      "item-future",
      "item-legacy",
      "item-unversioned",
    ]);
    for (const item of Object.values(state.itemsById)) {
      expect(item.itemFacts).toEqual(createEmptyEquipmentItemFacts());
      expect(item.specialProperties).toBeNull();
    }
  });

  it("returns nothing for a snapshot that is not an object and no items for one without items", () => {
    expect(revealableEquipmentState(undefined)).toBeUndefined();
    expect(revealableEquipmentState([])).toBeUndefined();
    expect(revealableEquipmentState({ itemsById: [], revision: 1 })).toEqual({
      itemsById: {},
      revision: 1,
    });
  });
});

describe("canonicalizeLegacyEquipmentSnapshotItems", () => {
  const LEGACY_BAG = {
    customNotes: " Kept wrapped in blue cloth. ",
    damageEffects: ["+1 damage against undead"],
    magicEffects: ["Cast X once per day", "  "],
    protectiveEffects: [],
    roleplayTraits: ["Arms of House Silverston"],
    utilityEffects: ["Opens one lock"],
  };

  it("gives a legacy snapshot item the facts and notes its canonical item has", () => {
    const legacy = snapshotItem({ notes: "Family heirloom.", specialProperties: LEGACY_BAG });
    const canonical = EquipmentItemSchema.parse(legacy);
    const { itemsById } = canonicalizeLegacyEquipmentSnapshotItems({
      itemsById: { "item-silverston-sword": legacy },
    }) as { itemsById: Record<string, Record<string, unknown>> };

    expect(itemsById["item-silverston-sword"]).toEqual({
      ...legacy,
      itemFacts: canonical.itemFacts,
      notes: canonical.notes,
      specialProperties: null,
    });
    expect(canonical.notes).toBe("Family heirloom.\n\nKept wrapped in blue cloth.");
  });

  it("leaves an item that already has facts as it was, apart from clearing the legacy bag", () => {
    const item = snapshotItem({ itemFacts: MIXED_FACTS, notes: "A fine blade." });
    const { itemsById } = canonicalizeLegacyEquipmentSnapshotItems({
      itemsById: { "item-silverston-sword": item },
    }) as { itemsById: Record<string, Record<string, unknown>> };

    expect(itemsById["item-silverston-sword"]).toEqual({ ...item, specialProperties: null });
  });

  it("keeps the legacy information a holder sees on the canonical item, and nothing hidden", () => {
    const legacy = snapshotItem({ specialProperties: LEGACY_BAG });
    const holderView = revealableEquipmentState(
      canonicalizeLegacyEquipmentSnapshotItems({ itemsById: { legacy } }),
    ) as { itemsById: Record<string, Record<string, unknown>> };
    const canonical = EquipmentItemSchema.parse(legacy);

    // Every legacy string the canonical item reveals, and the notes it carries.
    expect(holderView.itemsById.legacy?.itemFacts).toEqual(
      revealableEquipmentItemFacts(canonical.itemFacts),
    );
    expect(holderView.itemsById.legacy?.itemFacts).toEqual(canonical.itemFacts);
    expect(holderView.itemsById.legacy?.notes).toBe("Kept wrapped in blue cloth.");
    expect(holderView.itemsById.legacy?.specialProperties).toBeNull();
  });

  it("passes through what is not a snapshot with items", () => {
    expect(canonicalizeLegacyEquipmentSnapshotItems(undefined)).toBeUndefined();
    expect(canonicalizeLegacyEquipmentSnapshotItems({ revision: 1 })).toEqual({ revision: 1 });
  });
});
