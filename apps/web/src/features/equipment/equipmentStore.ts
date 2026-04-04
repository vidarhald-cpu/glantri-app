import type {
  CharacterLoadout,
  EquipmentItem,
  StorageLocation,
  WeaponTemplate,
} from "@glantri/domain/equipment";
import { weaponTemplates } from "@glantri/content/equipment";
import {
  sampleActiveLoadout,
  sampleCharacterId,
  sampleEquipmentItems,
  sampleLocations,
} from "@glantri/test-scenarios/equipment/sampleCharacterEquipment";
import type { EquipmentFeatureState } from "./types";

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

const weaponsById: Record<string, WeaponTemplate> = indexById(weaponTemplates);
const itemsById: Record<string, EquipmentItem> = indexById(sampleEquipmentItems);
const locationsById: Record<string, StorageLocation> = indexById(sampleLocations);

const activeLoadoutByCharacterId: Record<string, CharacterLoadout> = {
  [sampleCharacterId]: sampleActiveLoadout,
};

export const equipmentInitialState: EquipmentFeatureState = {
  templates: {
    weaponsById,
  },
  itemsById,
  locationsById,
  activeLoadoutByCharacterId,
};
