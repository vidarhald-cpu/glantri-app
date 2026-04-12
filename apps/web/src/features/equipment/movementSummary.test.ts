import { describe, expect, it } from "vitest";

import type {
  CharacterLoadout,
  EquipmentItem,
  EquipmentTemplate,
  StorageLocation,
} from "@glantri/domain";

import { equipmentTemplates } from "../../../../../packages/content/src/equipment";
import { buildWorkbookMovementSummary } from "./movementSummary";
import type { CombatStateCharacterInputs } from "./combatStateDerivation";
import type { EquipmentFeatureState } from "./types";

const characterId = "char-movement";

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

const locations: StorageLocation[] = [
  {
    id: `${characterId}:equipped`,
    characterId,
    name: "Equipped",
    type: "equipped_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${characterId}:person`,
    characterId,
    name: "On Person",
    type: "person_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${characterId}:home`,
    characterId,
    name: "Home",
    type: "home",
    availabilityClass: "elsewhere",
    parentLocationId: null,
    isMobile: false,
    isAccessibleInEncounter: false,
    notes: null,
  },
];

const loadout: CharacterLoadout = {
  id: `${characterId}:active`,
  characterId,
  name: "Current",
  isActive: true,
  wornArmorItemId: "armor-item-jerkin",
  readyShieldItemId: "shield-item-medium",
  activePrimaryWeaponItemId: "weapon-item-longsword",
  activeSecondaryWeaponItemId: null,
  activeMissileWeaponItemId: null,
  activeAmmoItemIds: [],
  quickAccessItemIds: [],
  notes: null,
};

const characterInputs: CombatStateCharacterInputs = {
  brawlingCombatSkillXp: 9,
  combatSkillXpByName: {
    "1-h edged": 15,
    Brawling: 9,
    Dodge: 15,
    Parry: 13,
  },
  constitution: 11,
  dexterity: 11,
  dexterityGm: 0,
  dodgeCombatSkillXp: 15,
  parryCombatSkillXp: 13,
  size: 13,
  sizeGm: 1,
  strength: 17,
  strengthGm: 3,
};

function createState(items: EquipmentItem[]): EquipmentFeatureState {
  return {
    templates: {
      templatesById: indexById<EquipmentTemplate>(equipmentTemplates),
    },
    itemsById: indexById(items),
    locationsById: indexById(locations),
    activeLoadoutByCharacterId: {
      [characterId]: loadout,
    },
  };
}

describe("buildWorkbookMovementSummary", () => {
  it("matches the workbook-faithful movement chain for a personal loadout", () => {
    const state = createState([
      {
        id: "weapon-item-longsword",
        characterId,
        templateId: "weapon-template-longsword",
        category: "weapon",
        displayName: null,
        specificityType: "generic",
        quantity: 1,
        isStackable: false,
        material: "steel",
        quality: "standard",
        storageAssignment: {
          locationId: `${characterId}:equipped`,
          carryMode: "equipped",
        },
        conditionState: "intact",
        durabilityCurrent: 12,
        durabilityMax: 12,
        encumbranceOverride: null,
        valueOverride: null,
        specialProperties: null,
        notes: null,
        isEquipped: true,
        isFavorite: null,
        acquiredFrom: null,
        statusTags: null,
      },
      {
        id: "shield-item-medium",
        characterId,
        templateId: "shield-template-medium-shield",
        category: "shield",
        displayName: null,
        specificityType: "generic",
        quantity: 1,
        isStackable: false,
        material: "wood",
        quality: "standard",
        storageAssignment: {
          locationId: `${characterId}:equipped`,
          carryMode: "equipped",
        },
        conditionState: "intact",
        durabilityCurrent: null,
        durabilityMax: null,
        encumbranceOverride: null,
        valueOverride: null,
        specialProperties: null,
        notes: null,
        isEquipped: true,
        isFavorite: null,
        acquiredFrom: null,
        statusTags: null,
      },
      {
        id: "armor-item-jerkin",
        characterId,
        templateId: "armor-template-leather-jerkin",
        category: "armor",
        displayName: null,
        specificityType: "generic",
        quantity: 1,
        isStackable: false,
        material: "leather",
        quality: "standard",
        storageAssignment: {
          locationId: `${characterId}:equipped`,
          carryMode: "equipped",
        },
        conditionState: "intact",
        durabilityCurrent: null,
        durabilityMax: null,
        encumbranceOverride: null,
        valueOverride: null,
        specialProperties: null,
        notes: null,
        isEquipped: true,
        isFavorite: null,
        acquiredFrom: null,
        statusTags: null,
      },
      {
        id: "gear-item-rope",
        characterId,
        templateId: "gear-template-rope",
        category: "gear",
        displayName: null,
        specificityType: "generic",
        quantity: 1,
        isStackable: false,
        material: "cloth",
        quality: "standard",
        storageAssignment: {
          locationId: `${characterId}:person`,
          carryMode: "on_person",
        },
        conditionState: "intact",
        durabilityCurrent: null,
        durabilityMax: null,
        encumbranceOverride: null,
        valueOverride: null,
        specialProperties: null,
        notes: null,
        isEquipped: false,
        isFavorite: null,
        acquiredFrom: null,
        statusTags: null,
      },
    ]);

    const summary = buildWorkbookMovementSummary({
      characterId,
      characterInputs,
      state,
    });

    expect(summary).toMatchObject({
      baseMove: 14,
      carryCapacity: 36,
      encumbranceLevel: 4,
      encumbrancePercent: 91,
      movement: 8,
      movementModifier: 4,
      personalEncumbrance: 32.66666666658,
      shieldMovementModifier: 2,
    });
  });

  it("ignores stored items for the workbook personal encumbrance total", () => {
    const state = createState([
      {
        id: "gear-item-rope",
        characterId,
        templateId: "gear-template-rope",
        category: "gear",
        displayName: null,
        specificityType: "generic",
        quantity: 1,
        isStackable: false,
        material: "cloth",
        quality: "standard",
        storageAssignment: {
          locationId: `${characterId}:home`,
          carryMode: "stored",
        },
        conditionState: "intact",
        durabilityCurrent: null,
        durabilityMax: null,
        encumbranceOverride: null,
        valueOverride: null,
        specialProperties: null,
        notes: null,
        isEquipped: false,
        isFavorite: null,
        acquiredFrom: null,
        statusTags: null,
      },
    ]);

    const summary = buildWorkbookMovementSummary({
      characterId,
      characterInputs,
      state,
    });

    expect(summary.personalEncumbrance).toBe(0);
    expect(summary.encumbranceLevel).toBe(0);
    expect(summary.movement).toBe(14);
  });
});
