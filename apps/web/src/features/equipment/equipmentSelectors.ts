import {
  isWithYouLocation,
  getItemAccessTier,
  getLocationAvailabilitySortOrder,
  isEncounterAccessible,
  isPersonalCarryMode,
  getEffectiveEncumbrance,
  getLocationSortOrder,
  getStorageAssignmentForLocation,
  isStoredCarryMode,
  type CharacterLoadout,
  type CarryMode,
  type EquipmentItem,
  type EquipmentTemplate,
  type StorageLocation,
} from "@glantri/domain";
import { calculateWorkbookArmorEncumbrance } from "./armorSummary";
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

export function getCharacterGearItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => item.category === "gear",
  );
}

export function getCharacterValuableItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => item.category === "valuables",
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
  characterSize?: number | null,
): InventoryRow[] {
  const items = getCharacterEquipmentItems(state, characterId);
  const rows: InventoryRow[] = [];

  for (const item of items) {
    const template = getEquipmentTemplateById(state, item.templateId);
    if (!template) {
      continue;
    }

    const location = state.locationsById[item.storageAssignment.locationId];
    const effectiveEncumbrance =
      template.category === "armor"
        ? calculateWorkbookArmorEncumbrance({
            characterSize: characterSize ?? null,
            item,
            template,
          }) ?? getEffectiveEncumbrance(item, template)
        : getEffectiveEncumbrance(item, template);

    rows.push({
      itemId: item.id,
      displayName: item.displayName ?? null,
      templateName: template.name,
      category: item.category,
      locationName: location?.name ?? "Unknown",
      carryMode: item.storageAssignment.carryMode,
      material: item.material,
      quality: item.quality,
      conditionState: item.conditionState,
      effectiveEncumbrance,
      accessTier: getItemAccessTier(item.storageAssignment.carryMode, location),
    });
  }

  return rows.sort((a, b) => {
      if (a.locationName !== b.locationName) {
        return a.locationName.localeCompare(b.locationName);
      }
      if (a.templateName !== b.templateName) {
        return a.templateName.localeCompare(b.templateName);
      }

      return (a.displayName ?? "").localeCompare(b.displayName ?? "");
    });
}

export function getWithYouLocations(
  state: EquipmentFeatureState,
  characterId: string,
): StorageLocation[] {
  return getCharacterLocations(state, characterId).filter((location) =>
    isWithYouLocation(location),
  );
}

export function getElsewhereLocations(
  state: EquipmentFeatureState,
  characterId: string,
): StorageLocation[] {
  return getCharacterLocations(state, characterId).filter(
    (location) => !isWithYouLocation(location),
  );
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
        .filter((item) => item.storageAssignment.locationId === location.id)
        .sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .filter((entry) => entry.items.length > 0)
    .sort((left, right) => {
      const orderDifference =
        getLocationSortOrder(left.location) - getLocationSortOrder(right.location);

      if (orderDifference !== 0) {
        return orderDifference;
      }

      return left.location.name.localeCompare(right.location.name);
    });
}

export function getItemsGroupedByAvailability(
  state: EquipmentFeatureState,
  characterId: string,
): Array<{
  availabilityClass: "with_you" | "elsewhere";
  groups: Array<{ location: StorageLocation; items: EquipmentItem[] }>;
}> {
  const locations = getCharacterLocations(state, characterId);
  const items = getCharacterEquipmentItems(state, characterId);

  return ["with_you", "elsewhere"].map((availabilityClass) => ({
    availabilityClass,
    groups: locations
      .filter((location) => location.availabilityClass === availabilityClass)
      .map((location) => ({
        location,
        items: items
          .filter((item) => item.storageAssignment.locationId === location.id)
          .sort((a, b) => a.id.localeCompare(b.id)),
      }))
      .filter((entry) => entry.items.length > 0 || !entry.location.type.endsWith("_system"))
      .sort((left, right) => {
        const availabilityDifference =
          getLocationAvailabilitySortOrder(left.location.availabilityClass) -
          getLocationAvailabilitySortOrder(right.location.availabilityClass);

        if (availabilityDifference !== 0) {
          return availabilityDifference;
        }

        const orderDifference =
          getLocationSortOrder(left.location) - getLocationSortOrder(right.location);

        if (orderDifference !== 0) {
          return orderDifference;
        }

        return left.location.name.localeCompare(right.location.name);
      }),
  })) as Array<{
    availabilityClass: "with_you" | "elsewhere";
    groups: Array<{ location: StorageLocation; items: EquipmentItem[] }>;
  }>;
}

export function getInventoryMoveOptions(
  state: EquipmentFeatureState,
  characterId: string,
): Array<{
  carryMode: CarryMode;
  label: string;
  locationId: string;
  value: string;
}> {
  return getCharacterLocations(state, characterId)
    .map((location) => {
      const storageAssignment = getStorageAssignmentForLocation(location);

      return {
        carryMode: storageAssignment.carryMode,
        label: `${location.availabilityClass === "with_you" ? "With you" : "Elsewhere"}: ${location.name}`,
        locationId: location.id,
        value: `${location.id}::${storageAssignment.carryMode}`,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getWithYouItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  const locationsById = state.locationsById;

  return getCharacterEquipmentItems(state, characterId).filter((item) => {
    const location = locationsById[item.storageAssignment.locationId];
    return location ? isWithYouLocation(location) : false;
  });
}

export function getEquippedItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => item.storageAssignment.carryMode === "equipped",
  );
}

export function getBackpackItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => item.storageAssignment.carryMode === "backpack",
  );
}

export function getStoredItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterEquipmentItems(state, characterId).filter(
    (item) => isStoredCarryMode(item.storageAssignment.carryMode),
  );
}

export function getEncounterAccessibleGearItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterGearItems(state, characterId).filter((item) => {
    if (isStoredCarryMode(item.storageAssignment.carryMode)) {
      return false;
    }

    if (isPersonalCarryMode(item.storageAssignment.carryMode)) {
      return true;
    }

    const location = state.locationsById[item.storageAssignment.locationId];
    return location ? isEncounterAccessible(location) : false;
  });
}

export function getEncounterAccessibleValuableItems(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem[] {
  return getCharacterValuableItems(state, characterId).filter((item) => {
    if (isStoredCarryMode(item.storageAssignment.carryMode)) {
      return false;
    }

    if (isPersonalCarryMode(item.storageAssignment.carryMode)) {
      return true;
    }

    const location = state.locationsById[item.storageAssignment.locationId];
    return location ? isEncounterAccessible(location) : false;
  });
}

export function getEncounterAccessibleCoinQuantity(
  state: EquipmentFeatureState,
  characterId: string,
): number {
  return getEncounterAccessibleValuableItems(state, characterId).reduce(
    (total, item) => {
      const template = getEquipmentTemplateById(state, item.templateId);
      const isCoins = template?.subtype === "coins";
      return isCoins ? total + item.quantity : total;
    },
    0,
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
    .filter((item) => item.storageAssignment.carryMode === "mount")
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

export function getWornArmor(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem | undefined {
  const loadout = getActiveLoadout(state, characterId);

  return loadout?.wornArmorItemId
    ? state.itemsById[loadout.wornArmorItemId]
    : undefined;
}

export function getReadyShield(
  state: EquipmentFeatureState,
  characterId: string,
): EquipmentItem | undefined {
  const loadout = getActiveLoadout(state, characterId);

  return loadout?.readyShieldItemId
    ? state.itemsById[loadout.readyShieldItemId]
    : undefined;
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
    armor: getWornArmor(state, characterId),
    shield: getReadyShield(state, characterId),
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
