import type { CharacterEquipmentReadModelService } from "@glantri/database";
import {
  sampleActiveLoadout,
  sampleCharacterId,
  sampleEquipmentItems,
  sampleLocations,
} from "@glantri/content/equipment";
import type { SampleCharacterEquipment } from "@glantri/database";

export async function loadDevSampleCharacterEquipment(): Promise<SampleCharacterEquipment> {
  return { sampleCharacterId, sampleLocations, sampleEquipmentItems, sampleActiveLoadout };
}

export function toEquipmentFeatureState(
  state: Awaited<ReturnType<CharacterEquipmentReadModelService["getCharacterEquipmentState"]>>
) {
  return {
    activeLoadoutByCharacterId: state.activeLoadoutByCharacterId,
    itemsById: state.itemsById,
    locationsById: state.locationsById,
    templates: {
      templatesById: state.templatesById,
    },
  };
}
