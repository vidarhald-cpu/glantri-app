import {
  getAccessTier,
  getEffectiveEncumbrance,
  type CharacterLoadout,
  type EquipmentItem,
  type EquipmentTemplate,
  type StorageLocation,
} from "@glantri/domain/equipment";
import type { EquipmentFeatureState, InventoryRow } from "./types";

export function getCharacterEquipmentItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return Object.values(state.itemsById).filter(
    (item) => item.characterId === characterId,
  );
}

export function getCharacterWeaponItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => item.category === "weapon",
  );
}

export function getCharacterShieldItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => item.category === "shield",
  );
}

export function getCharacterArmorItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => item.category === "armor",
  );
}

export function getCharacterLocations(
  state: EquipmentFeatureState,
  characterId: string,
): StorageLocation[] {
  return Object.values(state.locationsById).filter(
    (location) => location.characterId === characterId,
  );
}

export function getEquipmentTemplateById(
  state: EquipmentFeatureState,
  templateId: string,
): EquipmentTemplate | undefined {
  return state.templates.templatesById[templateId];
}

export function getInventoryRows(
  state: EquipmentFeatureState,
  characterId: string,
): InventoryRow[] {
  const items = getCharacterEquipmentItems(state, characterId);
  const rows: InventoryRow[] = [];

  for (const item of items) {
    const template = getEquipmentTemplateById(state, item.templateId);
    if (!template) {
      continue;
    }

    const location = state.locationsById[item.locationId];
    const effectiveEncumbrance = getEffectiveEncumbrance(item, template);

    rows.push({
      itemId: item.id,
      displayName: item.displayName ?? template.name,
      templateName: template.name,
      category: item.category,
      locationName: location?.name ?? "Unknown",
      carryMode: item.carryMode,
      material: item.material,
      quality: item.quality,
      conditionState: item.conditionState,
      effectiveEncumbrance,
      accessTier: getAccessTier(item.carryMode),
    });
  }

  return rows.sort((a, b) => {
      if (a.locationName !== b.locationName) {
        return a.locationName.localeCompare(b.locationName);
      }
      return a.displayName.localeCompare(b.displayName);
    });
}

export function getItemsGroupedByLocation(
  state: EquipmentFeatureState,
  characterId: string,
): Array<{ location: StorageLocation; items: EquipmentItem[] }> {
  const items = getCharacterEquipmentItems(state, characterId);
  const locations = getCharacterLocations(state, characterId);

  return locations
    .map((location) => ({
      location,
      items: items
        .filter((item) => item.locationId === location.id)
        .sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .filter((entry) => entry.items.length > 0);
}

export function getEquippedItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => item.carryMode === "equipped",
  );
}

export function getBackpackItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => item.carryMode === "backpack",
  );
}

export function getStoredItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => item.carryMode === "stored",
  );
}

export function getPersonalEncumbranceTotal(
  state: EquipmentFeatureState,
  characterId: string,
): number {
  return getCharacterEquipmentItems(state, characterId).reduce((total, item) => {
    const template = getEquipmentTemplateById(state, item.templateId);
    if (!template) {
      return total;
    }

    return total + getEffectiveEncumbrance(item, template);
  }, 0);
}

export function getMountEncumbranceTotal(
  state: EquipmentFeatureState,
  characterId: string,
): number {
  return getCharacterEquipmentItems(state, characterId)
    .filter((item) => item.carryMode === "mount")
    .reduce((total, item) => {
      const template = getEquipmentTemplateById(state, item.templateId);
      if (!template) {
        return total;
      }

      return total + template.baseEncumbrance;
    }, 0);
}

export function getActiveLoadout(
  state: EquipmentFeatureState,
  characterId: string,
): CharacterLoadout | undefined {
  return state.activeLoadoutByCharacterId[characterId];
}

export function getLoadoutEquipment(
  state: EquipmentFeatureState,
  characterId: string,
): {
  armor?: EquipmentItem;
  shield?: EquipmentItem;
  primary?: EquipmentItem;
  secondary?: EquipmentItem;
  missile?: EquipmentItem;
} {
  const loadout = getActiveLoadout(state, characterId);

  if (!loadout) {
    return {};
  }

  return {
    armor: loadout.activeArmorItemId
      ? state.itemsById[loadout.activeArmorItemId]
      : undefined,
    shield: loadout.activeShieldItemId
      ? state.itemsById[loadout.activeShieldItemId]
      : undefined,
    primary: loadout.activePrimaryWeaponItemId
      ? state.itemsById[loadout.activePrimaryWeaponItemId]
      : undefined,
    secondary: loadout.activeSecondaryWeaponItemId
      ? state.itemsById[loadout.activeSecondaryWeaponItemId]
      : undefined,
    missile: loadout.activeMissileWeaponItemId
      ? state.itemsById[loadout.activeMissileWeaponItemId]
      : undefined,
  };
}
