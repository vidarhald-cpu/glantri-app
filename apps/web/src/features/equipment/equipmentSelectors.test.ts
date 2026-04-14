import { describe, expect, it } from "vitest";
import type { EquipmentItem, EquipmentTemplate, StorageLocation } from "@glantri/domain";

import {
  getInventoryRows,
  getItemsGroupedForInventoryPage,
} from "./equipmentSelectors";
import type { EquipmentFeatureState } from "./types";

const characterId = "char-inventory";

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function createTemplate(
  overrides: Partial<EquipmentTemplate> &
    Pick<EquipmentTemplate, "id" | "name" | "category" | "baseEncumbrance" | "defaultMaterial">,
): EquipmentTemplate {
  return {
    qualityMultipliers: { extraordinary: 1.5, standard: 1 },
    sourceMetadata: null,
    tags: [],
    ...overrides,
  } as unknown as EquipmentTemplate;
}

function createItem(
  overrides: Partial<EquipmentItem> &
    Pick<EquipmentItem, "id" | "templateId" | "category" | "storageAssignment">,
): EquipmentItem {
  return {
    acquiredFrom: null,
    characterId,
    conditionState: "intact",
    displayName: null,
    durabilityCurrent: null,
    durabilityMax: null,
    encumbranceOverride: null,
    isEquipped: false,
    isFavorite: null,
    isStackable: false,
    material: "steel",
    notes: null,
    quality: "standard",
    quantity: 1,
    specialProperties: null,
    specificityType: "generic",
    statusTags: null,
    valueOverride: null,
    ...overrides,
  } as EquipmentItem;
}

function createLocation(
  overrides: Partial<StorageLocation> &
    Pick<StorageLocation, "id" | "name" | "type" | "availabilityClass">,
): StorageLocation {
  return {
    characterId,
    isAccessibleInEncounter: true,
    isMobile: true,
    notes: null,
    parentLocationId: null,
    ...overrides,
  };
}

function createState(): EquipmentFeatureState {
  const templates = [
    createTemplate({
      baseEncumbrance: 4,
      category: "weapon",
      defaultMaterial: "steel",
      handlingClass: "one_handed",
      id: "weapon-template-longsword",
      name: "Long sword",
    }),
    createTemplate({
      baseEncumbrance: 7.5,
      category: "weapon",
      defaultMaterial: "bronze",
      handlingClass: "polearm",
      id: "weapon-template-spear",
      name: "Spear",
    }),
    createTemplate({
      baseEncumbrance: 1,
      category: "gear",
      defaultMaterial: "cloth",
      id: "gear-template-rope",
      name: "Rope",
    }),
    createTemplate({
      baseEncumbrance: 2,
      category: "gear",
      defaultMaterial: "cloth",
      id: "gear-template-rations",
      name: "Rations",
    }),
  ];

  const items = [
    createItem({
      category: "weapon",
      id: "item-equipped",
      storageAssignment: { carryMode: "equipped", locationId: `${characterId}:loc-equipped` },
      templateId: "weapon-template-longsword",
    }),
    createItem({
      category: "gear",
      id: "item-person",
      storageAssignment: { carryMode: "on_person", locationId: `${characterId}:loc-person` },
      templateId: "gear-template-rope",
    }),
    createItem({
      category: "gear",
      id: "item-backpack",
      storageAssignment: { carryMode: "backpack", locationId: `${characterId}:loc-backpack` },
      templateId: "gear-template-rations",
    }),
    createItem({
      category: "weapon",
      id: "item-mount",
      material: "bronze",
      storageAssignment: { carryMode: "mount", locationId: `${characterId}:loc-mount` },
      templateId: "weapon-template-spear",
    }),
    createItem({
      category: "weapon",
      id: "item-home",
      storageAssignment: { carryMode: "stored", locationId: `${characterId}:loc-home` },
      templateId: "weapon-template-longsword",
    }),
  ];

  const locations = [
    createLocation({
      availabilityClass: "with_you",
      id: `${characterId}:loc-equipped`,
      name: "Equipped",
      type: "equipped_system",
    }),
    createLocation({
      availabilityClass: "with_you",
      id: `${characterId}:loc-person`,
      name: "On person",
      type: "person_system",
    }),
    createLocation({
      availabilityClass: "with_you",
      id: `${characterId}:loc-backpack`,
      name: "Backpack",
      type: "backpack_system",
    }),
    createLocation({
      availabilityClass: "with_you",
      id: `${characterId}:loc-mount`,
      isAccessibleInEncounter: false,
      name: "Mount",
      type: "mount_system",
    }),
    createLocation({
      availabilityClass: "elsewhere",
      id: `${characterId}:loc-home`,
      isAccessibleInEncounter: false,
      isMobile: false,
      name: "Home",
      type: "home",
    }),
  ];

  return {
    activeLoadoutByCharacterId: {},
    itemsById: indexById(items),
    locationsById: indexById(locations),
    templates: {
      templatesById: indexById(templates),
    },
  };
}

describe("equipmentSelectors inventory page grouping", () => {
  it("creates Carried, With you, and Elsewhere sections with carried excluding mount", () => {
    const state = createState();
    const groupedSections = getItemsGroupedForInventoryPage(state, characterId);

    expect(groupedSections.map((section) => section.label)).toEqual([
      "Carried",
      "With you",
      "Elsewhere",
    ]);

    const carried = groupedSections.find((section) => section.key === "carried");
    const withYou = groupedSections.find((section) => section.key === "with_you");
    const elsewhere = groupedSections.find((section) => section.key === "elsewhere");

    expect(carried?.groups.map((group) => group.location.type)).toEqual([
      "equipped_system",
      "person_system",
      "backpack_system",
    ]);
    expect(withYou?.groups.map((group) => group.location.type)).toEqual(["mount_system"]);
    expect(elsewhere?.groups.map((group) => group.location.type)).toEqual(["home"]);
  });

  it("includes actual and effective encumbrance on inventory rows", () => {
    const state = createState();
    const rows = getInventoryRows(state, characterId, 6);
    const spearRow = rows.find((row) => row.itemId === "item-mount");

    expect(spearRow).toMatchObject({
      actualEncumbrance: 8.25,
      effectiveEncumbrance: 0,
      locationName: "Mount",
      templateName: "Spear",
    });
  });
});
