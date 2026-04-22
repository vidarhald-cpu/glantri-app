import { describe, expect, it } from "vitest";

import type {
  CharacterLoadout,
  EquipmentItem,
  EquipmentTemplate,
  StorageLocation,
} from "@glantri/domain";
import { equipmentTemplates } from "@glantri/content/equipment";
import { defaultCombatAllocationState } from "@glantri/rules-engine";
import { buildCombatStatePanelModel } from "./combatStatePanel";
import type { CombatStateCharacterInputs } from "./combatStateDerivation";
import type { EquipmentFeatureState } from "./types";

const characterId = "char-throwing-panel";

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

const locations: StorageLocation[] = [
  {
    id: `${characterId}:loc-equipped`,
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
    id: `${characterId}:loc-person`,
    characterId,
    name: "On person",
    type: "person_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${characterId}:loc-backpack`,
    characterId,
    name: "Backpack",
    type: "backpack_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${characterId}:loc-mount`,
    characterId,
    name: "Mount",
    type: "mount_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: false,
    notes: null,
  },
];

const daggerItem: EquipmentItem = {
  id: "weapon-item-dagger-throwing",
  characterId,
  templateId: "weapon-template-dagger",
  category: "weapon",
  displayName: null,
  specificityType: "generic",
  quantity: 1,
  isStackable: false,
  material: "steel",
  quality: "standard",
  storageAssignment: {
    locationId: `${characterId}:loc-equipped`,
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
};

const longswordItem: EquipmentItem = {
  ...daggerItem,
  id: "weapon-item-longsword-primary",
  templateId: "weapon-template-longsword",
};

const shieldItem: EquipmentItem = {
  ...daggerItem,
  id: "shield-item-medium",
  templateId: "shield-template-medium-shield",
  category: "shield",
  material: "wood",
};

const armorItem: EquipmentItem = {
  ...daggerItem,
  id: "armor-item-leather-jerkin",
  templateId: "armor-template-leather-jerkin",
  category: "armor",
  material: "leather",
};

const bowItem: EquipmentItem = {
  ...daggerItem,
  id: "weapon-item-bow-missile",
  templateId: "weapon-template-bow",
  material: "wood",
};

const ropeItem: EquipmentItem = {
  ...daggerItem,
  id: "gear-item-rope-on-person",
  templateId: "gear-template-rope",
  category: "gear",
  material: "cloth",
  isEquipped: false,
  storageAssignment: {
    locationId: `${characterId}:loc-person`,
    carryMode: "on_person",
  },
};

const rationItem: EquipmentItem = {
  ...daggerItem,
  id: "gear-item-rations-backpack",
  templateId: "gear-template-rations",
  category: "gear",
  material: "cloth",
  isEquipped: false,
  storageAssignment: {
    locationId: `${characterId}:loc-backpack`,
    carryMode: "backpack",
  },
};

const mountSpearItem: EquipmentItem = {
  ...daggerItem,
  id: "weapon-item-spear-mount",
  templateId: "weapon-template-spear",
  isEquipped: false,
  storageAssignment: {
    locationId: `${characterId}:loc-mount`,
    carryMode: "mount",
  },
};

const activeLoadout: CharacterLoadout = {
  id: `${characterId}:loadout-active`,
  characterId,
  name: "Current",
  isActive: true,
  wornArmorItemId: null,
  readyShieldItemId: null,
  activePrimaryWeaponItemId: null,
  activeSecondaryWeaponItemId: null,
  activeMissileWeaponItemId: null,
  activeAmmoItemIds: [],
  quickAccessItemIds: [],
  notes: null,
};

const characterInputs: CombatStateCharacterInputs = {
  constitution: 11,
  dexterity: 11,
  dexterityGm: 0,
  combatSkillXpByName: {
    Throwing: 4,
  },
  dodgeCombatSkillXp: null,
  parryCombatSkillXp: null,
  brawlingCombatSkillXp: null,
  size: 13,
  sizeGm: 1,
  strength: 17,
  strengthGm: 3,
};

function createState(): EquipmentFeatureState {
  return {
    templates: {
      templatesById: indexById<EquipmentTemplate>(equipmentTemplates),
    },
    itemsById: {
      [daggerItem.id]: structuredClone(daggerItem),
      [longswordItem.id]: structuredClone(longswordItem),
      [shieldItem.id]: structuredClone(shieldItem),
      [armorItem.id]: structuredClone(armorItem),
      [bowItem.id]: structuredClone(bowItem),
      [ropeItem.id]: structuredClone(ropeItem),
      [rationItem.id]: structuredClone(rationItem),
      [mountSpearItem.id]: structuredClone(mountSpearItem),
    },
    locationsById: indexById(structuredClone(locations)),
    activeLoadoutByCharacterId: {
      [characterId]: structuredClone(activeLoadout),
    },
  };
}

function getThrowingRow(model: ReturnType<typeof buildCombatStatePanelModel>) {
  return model.weaponModeTable.rows.find((row) => row[1] === "Dagger" && row[3] === "Throw");
}

describe("combatStatePanel throwing row reliability", () => {
  it("includes the throwing row whenever the same valid throwing selection is recomputed", () => {
    const state = createState();

    const firstModel = buildCombatStatePanelModel(
      state,
      characterId,
      characterInputs,
      defaultCombatAllocationState,
      daggerItem.id,
    );
    const secondModel = buildCombatStatePanelModel(
      state,
      characterId,
      characterInputs,
      {
        ...defaultCombatAllocationState,
        situationalModifiers: {
          ...defaultCombatAllocationState.situationalModifiers,
          movement: 1,
        },
      },
      daggerItem.id,
    );

    expect(getThrowingRow(firstModel)).toBeDefined();
    expect(getThrowingRow(secondModel)).toBeDefined();
  });

  it("shows armor inside the panel and orders combined, unarmed, missile, and thrown rows correctly", () => {
    const state = createState();
    state.activeLoadoutByCharacterId[characterId] = {
      ...state.activeLoadoutByCharacterId[characterId],
      wornArmorItemId: armorItem.id,
      readyShieldItemId: shieldItem.id,
      activePrimaryWeaponItemId: longswordItem.id,
      activeMissileWeaponItemId: bowItem.id,
    };

    const model = buildCombatStatePanelModel(
      state,
      characterId,
      {
        ...characterInputs,
        brawlingCombatSkillXp: 9,
        combatSkillXpByName: {
          ...characterInputs.combatSkillXpByName,
          "1-h edged": 15,
          Bow: 6,
          Brawling: 9,
          Dodge: 15,
          Parry: 11,
        },
        dodgeCombatSkillXp: 15,
        parryCombatSkillXp: 11,
      },
      defaultCombatAllocationState,
      daggerItem.id,
    );

    expect(model.armorRows).toEqual([
      { label: "Armor", value: "Leather Jerkin" },
      { label: "General armor", value: "3B" },
      { label: "AA modifier", value: 0 },
      { label: "Perception modifier", value: 0 },
    ]);

    expect(model.weaponModeTable.rows.map((row) => `${row[0]}|${row[1]}`)).toEqual([
      "Primary|Long sword",
      "Shield|Medium shield",
      "Combined|Sword / shield",
      "Unarmed|Brawling",
      "Unarmed|Punch",
      "Unarmed|Kick",
      "Missile|Short bow",
      "Thrown|Dagger",
    ]);
  });

  it("uses all personal-load items for the encumbrance count while excluding mount items", () => {
    const state = createState();
    state.activeLoadoutByCharacterId[characterId] = {
      ...state.activeLoadoutByCharacterId[characterId],
      wornArmorItemId: armorItem.id,
      readyShieldItemId: shieldItem.id,
      activePrimaryWeaponItemId: longswordItem.id,
      activeMissileWeaponItemId: bowItem.id,
    };

    const model = buildCombatStatePanelModel(
      state,
      characterId,
      {
        ...characterInputs,
        brawlingCombatSkillXp: 9,
        combatSkillXpByName: {
          ...characterInputs.combatSkillXpByName,
          "1-h edged": 15,
          Bow: 6,
          Brawling: 9,
          Dodge: 15,
          Parry: 11,
        },
        dodgeCombatSkillXp: 15,
        parryCombatSkillXp: 11,
      },
      defaultCombatAllocationState,
      daggerItem.id,
    );

    const encumbranceRow = model.capabilityRows.find(
      (row) => row.label === "Enc/count/lvl",
    )?.value;

    expect(typeof encumbranceRow).toBe("string");
    const [, countPart] = String(encumbranceRow).split(" / ");
    expect(countPart).toBe("7");
  });
});
