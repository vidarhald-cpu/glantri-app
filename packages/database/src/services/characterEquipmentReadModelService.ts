import {
  type CharacterLoadout,
  type EquipmentItem,
  type EquipmentTemplate,
  type StorageLocation,
} from "@glantri/domain";
import { equipmentTemplatesById } from "@glantri/content";

import {
  createPrismaCharacterEquipmentRepository,
  type CharacterEquipmentRepository,
} from "../repositories/characterEquipmentRepository";

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export interface CharacterEquipmentReadModel {
  activeLoadoutByCharacterId: Record<string, CharacterLoadout>;
  itemsById: Record<string, EquipmentItem>;
  locationsById: Record<string, StorageLocation>;
  templatesById: Record<string, EquipmentTemplate>;
}

export class CharacterEquipmentReadModelService {
  constructor(
    private readonly repository: CharacterEquipmentRepository = createPrismaCharacterEquipmentRepository(),
  ) {}

  async getCharacterEquipmentState(
    characterId: string,
  ): Promise<CharacterEquipmentReadModel> {
    const snapshot = await this.repository.getCharacterEquipmentState(characterId);

    const activeLoadout = snapshot.loadouts.find((loadout) => loadout.isActive);

    return {
      activeLoadoutByCharacterId: activeLoadout
        ? { [characterId]: activeLoadout }
        : {},
      itemsById: indexById(snapshot.items),
      locationsById: indexById(snapshot.locations),
      templatesById: equipmentTemplatesById as Record<string, EquipmentTemplate>,
    };
  }
}
