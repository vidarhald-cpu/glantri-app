import type {
  CarryMode,
  CharacterLoadout,
  StorageLocation,
  StorageLocationType,
} from "@glantri/domain/equipment";
import { validateLoadout } from "@glantri/domain/equipment";
import type { EquipmentFeatureState } from "./types";

function cloneState(state: EquipmentFeatureState): EquipmentFeatureState {
  return {
    templates: {
      weaponsById: { ...state.templates.weaponsById },
    },
    itemsById: { ...state.itemsById },
    locationsById: { ...state.locationsById },
    activeLoadoutByCharacterId: { ...state.activeLoadoutByCharacterId },
  };
}

export function moveItem(
  state: EquipmentFeatureState,
  itemId: string,
  locationId: string,
  carryMode: CarryMode,
): EquipmentFeatureState {
  const item = state.itemsById[itemId];
  if (!item) {
    throw new Error(`Item not found: ${itemId}`);
  }

  const location = state.locationsById[locationId];
  if (!location) {
    throw new Error(`Location not found: ${locationId}`);
  }

  const next: EquipmentFeatureState = cloneState(state);

  next.itemsById[itemId] = {
    ...item,
    locationId,
    carryMode,
    isEquipped: carryMode === "equipped",
  };

  return next;
}

export function createCustomLocation(
  state: EquipmentFeatureState,
  characterId: string,
  name: string,
  type: StorageLocationType,
): EquipmentFeatureState {
  const id = `${characterId}:loc-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;

  const next = cloneState(state);

  const location: StorageLocation = {
    id,
    characterId,
    name: name.trim(),
    type,
    parentLocationId: null,
    isMobile: false,
    isAccessibleInEncounter: false,
    notes: null,
  };

  next.locationsById[id] = location;
  return next;
}

function updateLoadout(
  state: EquipmentFeatureState,
  characterId: string,
  updater: (loadout: CharacterLoadout) => CharacterLoadout,
): EquipmentFeatureState {
  const current = state.activeLoadoutByCharacterId[characterId];
  if (!current) {
    throw new Error(`Active loadout not found for character: ${characterId}`);
  }

  const next = cloneState(state);
  const updated = updater(current);
  const errors = validateLoadout(updated, { itemsById: next.itemsById });

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  next.activeLoadoutByCharacterId[characterId] = updated;
  return next;
}

export function setActivePrimaryWeapon(
  state: EquipmentFeatureState,
  characterId: string,
  itemId: string | null,
): EquipmentFeatureState {
  return updateLoadout(state, characterId, (loadout) => ({
    ...loadout,
    activePrimaryWeaponItemId: itemId,
  }));
}

export function setActiveSecondaryWeapon(
  state: EquipmentFeatureState,
  characterId: string,
  itemId: string | null,
): EquipmentFeatureState {
  return updateLoadout(state, characterId, (loadout) => ({
    ...loadout,
    activeSecondaryWeaponItemId: itemId,
  }));
}

export function setActiveMissileWeapon(
  state: EquipmentFeatureState,
  characterId: string,
  itemId: string | null,
): EquipmentFeatureState {
  return updateLoadout(state, characterId, (loadout) => ({
    ...loadout,
    activeMissileWeaponItemId: itemId,
  }));
}
