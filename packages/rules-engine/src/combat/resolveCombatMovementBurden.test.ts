import { describe, expect, it } from "vitest";

import type {
  CharacterLoadout,
  EquipmentItem,
  EquipmentTemplate,
  StorageLocation,
} from "@glantri/domain";

import {
  getCombatMovementModifierApplicability,
  resolveCombatMovementBurden,
} from "./resolveCombatMovementBurden";

const characterId = "character-1";
const personLocation: StorageLocation = {
  availabilityClass: "with_you",
  characterId,
  id: "location-person",
  isAccessibleInEncounter: true,
  isMobile: true,
  name: "On person",
  type: "person_system",
};
const equippedLocation: StorageLocation = {
  ...personLocation,
  id: "location-equipped",
  name: "Equipped",
  type: "equipped_system",
};

function gearTemplate(baseEncumbrance: number): EquipmentTemplate {
  return {
    baseEncumbrance,
    baseValue: null,
    category: "gear",
    defaultMaterial: "steel",
    id: "gear-load",
    name: "Workbook load",
    specificityTypeDefault: "generic",
    tags: [],
  };
}

const shieldTemplate: EquipmentTemplate = {
  baseEncumbrance: 0,
  baseValue: null,
  category: "shield",
  defaultMaterial: "wood",
  id: "shield-medium",
  movementModifier: 2,
  name: "Medium shield",
  specificityTypeDefault: "generic",
  tags: [],
};

function item(input: {
  category?: EquipmentItem["category"];
  carryMode?: EquipmentItem["storageAssignment"]["carryMode"];
  id: string;
  locationId?: string;
  templateId: string;
}): EquipmentItem {
  return {
    category: input.category ?? "gear",
    characterId,
    conditionState: "intact",
    id: input.id,
    isStackable: false,
    material: input.category === "shield" ? "wood" : "steel",
    quality: "standard",
    quantity: 1,
    specificityType: "generic",
    storageAssignment: {
      carryMode: input.carryMode ?? "on_person",
      locationId: input.locationId ?? personLocation.id,
    },
    templateId: input.templateId,
  };
}

function loadout(readyShieldItemId?: string): CharacterLoadout {
  return {
    activeAmmoItemIds: [],
    characterId,
    id: "loadout-1",
    isActive: true,
    name: "Combat",
    quickAccessItemIds: [],
    readyShieldItemId,
  };
}

function resolve(input: {
  load: number;
  readyShield?: boolean;
  stats?: { constitution: number; size: number; strength: number };
}) {
  const loadTemplate = gearTemplate(input.load);
  const loadItem = item({ id: "item-load", templateId: loadTemplate.id });
  const shieldItem = item({
    category: "shield",
    carryMode: "equipped",
    id: "item-shield",
    locationId: equippedLocation.id,
    templateId: shieldTemplate.id,
  });
  return resolveCombatMovementBurden({
    characterId,
    characteristics: input.stats ?? { constitution: 11, size: 13, strength: 17 },
    equipmentLoadoutRevision: "revision-1",
    equipmentState: {
      activeLoadout: loadout(input.readyShield ? shieldItem.id : undefined),
      items: input.readyShield ? [loadItem, shieldItem] : [loadItem],
      locationsById: {
        [equippedLocation.id]: equippedLocation,
        [personLocation.id]: personLocation,
      },
      templatesById: {
        [loadTemplate.id]: loadTemplate,
        [shieldTemplate.id]: shieldTemplate,
      },
    },
    participantId: "participant-1",
    sourceSnapshotId: "snapshot-1",
  });
}

describe("resolveCombatMovementBurden", () => {
  it("matches Themistogenes Calculations L39:S42 cached source values", () => {
    expect(
      resolve({
        load: 37.30555556,
        stats: { constitution: 17, size: 13, strength: 17 },
      }),
    ).toMatchObject({
      carryingCapacity: 39,
      carriedPercentage: 96,
      encumbranceLevel: 4,
      shieldMovementContribution: 0,
      finalMovementModifier: 2,
    });
  });

  it("matches the workbook load, capacity, threshold, shield, and final-MM fixture", () => {
    const result = resolve({ load: 32.66666666658, readyShield: true });

    expect(result).toMatchObject({
      carryingCapacity: 36,
      carriedPercentage: 91,
      encumbranceLevel: 4,
      shieldMovementContribution: 2,
      finalMovementModifier: 4,
      completeness: "complete",
      missingFacts: [],
    });
    expect(result.carriedItems).toHaveLength(2);
  });

  it("changes level only when the rounded carried percentage crosses a workbook threshold", () => {
    expect(resolve({ load: 7.2 }).encumbranceLevel).toBe(0);
    expect(resolve({ load: 7.56 }).encumbranceLevel).toBe(1);
  });

  it("uses Strength, Size, and Constitution for carrying capacity", () => {
    expect(resolve({ load: 20, stats: { constitution: 10, size: 10, strength: 10 } })).toMatchObject({
      carryingCapacity: 25,
      carriedPercentage: 80,
      encumbranceLevel: 3,
    });
    expect(resolve({ load: 20, stats: { constitution: 20, size: 15, strength: 15 } })).toMatchObject({
      carryingCapacity: 40,
      carriedPercentage: 50,
      encumbranceLevel: 2,
    });
  });

  it("adds ready-shield burden inside MM and uses zero when no shield is ready", () => {
    expect(resolve({ load: 32.66666666658, readyShield: true })).toMatchObject({
      encumbranceLevel: 4,
      shieldMovementContribution: 2,
      finalMovementModifier: 4,
    });
    expect(resolve({ load: 32.66666666658, readyShield: false })).toMatchObject({
      encumbranceLevel: 4,
      shieldMovementContribution: 0,
      finalMovementModifier: 2,
    });
  });

  it("keeps missing authoritative equipment explicit instead of assuming zero", () => {
    const result = resolveCombatMovementBurden({
      characteristics: { constitution: 11, size: 13, strength: 17 },
      participantId: "participant-1",
      sourceSnapshotId: "snapshot-1",
    });

    expect(result).toMatchObject({
      completeness: "partial",
      missingFacts: ["equipment_state"],
    });
    expect(result.finalMovementModifier).toBeUndefined();
  });

  it("keeps an accepted burden snapshot immutable after later equipment changes", () => {
    const loadTemplate = gearTemplate(10);
    const loadItem = item({ id: "item-load", templateId: loadTemplate.id });
    const equipmentState = {
      activeLoadout: loadout(),
      items: [loadItem],
      locationsById: { [personLocation.id]: personLocation },
      templatesById: { [loadTemplate.id]: loadTemplate },
    };
    const accepted = resolveCombatMovementBurden({
      characterId,
      characteristics: { constitution: 11, size: 13, strength: 17 },
      equipmentState,
      participantId: "participant-1",
      sourceSnapshotId: "accepted-roll-snapshot",
    });

    loadTemplate.baseEncumbrance = 100;
    const later = resolveCombatMovementBurden({
      characterId,
      characteristics: { constitution: 11, size: 13, strength: 17 },
      equipmentState,
      participantId: "participant-1",
      sourceSnapshotId: "later-equipment-snapshot",
    });

    expect(accepted).toMatchObject({
      finalMovementModifier: 1,
      sourceSnapshotId: "accepted-roll-snapshot",
      totalEffectiveCarriedEncumbrance: 10,
    });
    expect(later).toMatchObject({
      sourceSnapshotId: "later-equipment-snapshot",
      totalEffectiveCarriedEncumbrance: 100,
    });
  });
});

describe("Movement Modifier applicability", () => {
  it("requires MM only for the two migrated movement-heavy contests", () => {
    expect(getCombatMovementModifierApplicability("adjust_distance_attack")).toBe("required");
    expect(getCombatMovementModifierApplicability("round_end_adjust_distance")).toBe("required");
    expect(getCombatMovementModifierApplicability("movement_feint")).toBe("not_applicable");
    expect(getCombatMovementModifierApplicability("weapon_feint")).toBe("not_applicable");
    expect(getCombatMovementModifierApplicability("offensive_parry_brawling")).toBe(
      "not_applicable",
    );
    expect(getCombatMovementModifierApplicability("continued_contact")).toBe("not_applicable");
    expect(getCombatMovementModifierApplicability("observe_opponent")).toBe("not_applicable");
  });
});
