import type {
  CharacterLoadout,
  EquipmentItem,
  EquipmentTemplate,
  StorageLocation,
} from "@glantri/domain/equipment";
import { equipmentTemplates } from "@glantri/content/equipment";
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

const templatesById: Record<string, EquipmentTemplate> = indexById(equipmentTemplates);
const itemsById: Record<string, EquipmentItem> = indexById(sampleEquipmentItems);
const locationsById: Record<string, StorageLocation> = indexById(sampleLocations);

const activeLoadoutByCharacterId: Record<string, CharacterLoadout> = {
  [sampleCharacterId]: sampleActiveLoadout,
};

export const equipmentInitialState: EquipmentFeatureState = {
  templates: {
    templatesById,
  },
  itemsById,
  locationsById,
  activeLoadoutByCharacterId,
};
