import { describe, expect, it } from "vitest";

import type {
  CharacterLoadout,
  EquipmentItem,
  EquipmentTemplate,
  StorageLocation,
} from "@glantri/domain";

import { equipmentTemplates } from "../../../../../packages/content/src/equipment";
import type { EquipmentFeatureState } from "./types";
import { deriveCombatStateSnapshot } from "./combatStateDerivation";

const sampleCharacterId = "char-themistogenes";

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

const sampleLocations: StorageLocation[] = [
  {
    id: `${sampleCharacterId}:loc-equipped`,
    characterId: sampleCharacterId,
    name: "Equipped",
    type: "equipped_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${sampleCharacterId}:loc-person`,
    characterId: sampleCharacterId,
    name: "On Person",
    type: "person_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${sampleCharacterId}:loc-backpack`,
    characterId: sampleCharacterId,
    name: "Backpack",
    type: "backpack_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${sampleCharacterId}:loc-mount`,
    characterId: sampleCharacterId,
    name: "Mount",
    type: "mount_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${sampleCharacterId}:loc-home`,
    characterId: sampleCharacterId,
    name: "Home",
    type: "home",
    availabilityClass: "elsewhere",
    parentLocationId: null,
    isMobile: false,
    isAccessibleInEncounter: false,
    notes: null,
  },
];

const sampleEquipmentItems: EquipmentItem[] = [
  {
    id: "weapon-item-longsword-1",
    characterId: sampleCharacterId,
    templateId: "weapon-template-longsword",
    category: "weapon",
    displayName: null,
    specificityType: "generic",
    quantity: 1,
    isStackable: false,
    material: "steel",
    quality: "standard",
    storageAssignment: {
      locationId: `${sampleCharacterId}:loc-equipped`,
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
    id: "shield-item-round-1",
    characterId: sampleCharacterId,
    templateId: "shield-template-round-shield",
    category: "shield",
    displayName: null,
    specificityType: "generic",
    quantity: 1,
    isStackable: false,
    material: "wood",
    quality: "standard",
    storageAssignment: {
      locationId: `${sampleCharacterId}:loc-equipped`,
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
    id: "armor-item-jerkin-1",
    characterId: sampleCharacterId,
    templateId: "armor-template-leather-jerkin",
    category: "armor",
    displayName: null,
    specificityType: "generic",
    quantity: 1,
    isStackable: false,
    material: "leather",
    quality: "standard",
    storageAssignment: {
      locationId: `${sampleCharacterId}:loc-equipped`,
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
    id: "gear-item-rope-1",
    characterId: sampleCharacterId,
    templateId: "gear-template-rope",
    category: "gear",
    displayName: null,
    specificityType: "generic",
    quantity: 1,
    isStackable: false,
    material: "cloth",
    quality: "standard",
    storageAssignment: {
      locationId: `${sampleCharacterId}:loc-person`,
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
];

const sampleActiveLoadout: CharacterLoadout = {
  id: `${sampleCharacterId}:loadout-active`,
  characterId: sampleCharacterId,
  name: "Current",
  isActive: true,
  wornArmorItemId: "armor-item-jerkin-1",
  readyShieldItemId: "shield-item-round-1",
  activePrimaryWeaponItemId: "weapon-item-longsword-1",
  activeSecondaryWeaponItemId: null,
  activeMissileWeaponItemId: null,
  activeAmmoItemIds: [],
  quickAccessItemIds: [],
  notes: null,
};

function cloneState(): EquipmentFeatureState {
  return {
    templates: {
      templatesById: indexById<EquipmentTemplate>(equipmentTemplates),
    },
    itemsById: indexById(structuredClone(sampleEquipmentItems)),
    locationsById: indexById(structuredClone(sampleLocations)),
    activeLoadoutByCharacterId: {
      [sampleCharacterId]: structuredClone(sampleActiveLoadout),
    },
  };
}

describe("combatStateDerivation", () => {
  it("derives current one-handed plus shield combat rows from the persisted loadout", () => {
    const snapshot = deriveCombatStateSnapshot(cloneState(), "char-themistogenes");
    const primaryRow = snapshot.weaponRows[0];
    const unarmedRow = snapshot.weaponRows[3];

    expect(snapshot.gripSummary).toBe("One-handed + shield");
    expect(snapshot.wornArmorLabel).toBe("Leather Jerkin");
    expect(snapshot.readyShieldLabel).toBe("Round Shield");
    expect(primaryRow).toMatchObject({
      slotLabel: "Primary weapon",
      currentItemLabel: "Long sword",
      initiative: 0,
      ob1: 2,
      dmb1: 5,
      attack1: "Slash (Edged)",
      crit1: "FS",
      ob2: 1,
      dmb2: 3,
      attack2: "Thrust (Pointed)",
      crit2: "EP",
      db: 2,
      dm: 1,
      parry: 0,
    });
    expect(primaryRow.notes).toContain("Thrust Pointed | AM C");
    expect(unarmedRow.db).toBe(2);
    expect(snapshot.defenseSummary).toContain("Shield DB 2");
    expect(snapshot.defenseSummary).toContain("Primary DM 1");
  });

  it("surfaces formula-based missile DMB and special encumbrance notes without faking precision", () => {
    const state = cloneState();

    state.itemsById["weapon-item-longsword-1"].storageAssignment = {
      carryMode: "on_person",
      locationId: "char-themistogenes:loc-person",
    };
    state.itemsById["weapon-item-longsword-1"].isEquipped = false;
    state.activeLoadoutByCharacterId["char-themistogenes"] = {
      ...state.activeLoadoutByCharacterId["char-themistogenes"],
      readyShieldItemId: null,
      activePrimaryWeaponItemId: null,
      activeMissileWeaponItemId: "weapon-item-longsword-1",
    };
    state.itemsById["weapon-item-longsword-1"].templateId = "weapon-template-ballista";

    const snapshot = deriveCombatStateSnapshot(state, "char-themistogenes");
    const missileRow = snapshot.weaponRows[2];

    expect(snapshot.gripSummary).toBe("Missile ready");
    expect(missileRow.currentItemLabel).toBe("Ballista");
    expect(missileRow.dmb1).toBe("4d8+1 (formula)");
    expect(missileRow.attack1).toBe("Shot (Pointed)");
    expect(missileRow.db).toBe("—");
    expect(missileRow.notes).toContain("Source encumbrance 20+20 is ammo-linked");
    expect(snapshot.loadNotes).toContain("Source encumbrance 20+20 is ammo-linked");
  });
});
