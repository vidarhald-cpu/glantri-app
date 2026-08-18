import {
  createEmptyEquipmentItemFacts,
  revealableEquipmentItemFacts,
  type AssignedEquipmentItem,
  type CanonicalEquipmentItem,
  type CharacterLoadout,
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
  itemsById: Record<string, AssignedEquipmentItem>;
  locationsById: Record<string, StorageLocation>;
  templatesById: Record<string, EquipmentTemplate>;
}

export interface CampaignEquipmentReadModel {
  itemsById: Record<string, CanonicalEquipmentItem>;
  templatesById: Record<string, EquipmentTemplate>;
}

export type CharacterEquipmentViewer =
  | { kind: "gm" }
  | { kind: "holder"; characterId: string }
  | { kind: "unauthorized" };

function projectItemsForViewer(
  items: AssignedEquipmentItem[],
  viewer: CharacterEquipmentViewer | undefined,
): AssignedEquipmentItem[] {
  if (viewer?.kind === "unauthorized") {
    return [];
  }

  return items.flatMap((item) => {
    if (viewer?.kind === "holder" && item.holderCharacterId !== viewer.characterId) {
      return [];
    }

    if (viewer?.kind === "gm") {
      return [item];
    }

    return [
      {
        ...item,
        itemFacts:
          viewer?.kind === "holder"
            ? revealableEquipmentItemFacts(item.itemFacts)
            : createEmptyEquipmentItemFacts(),
      },
    ];
  });
}

export class CharacterEquipmentReadModelService {
  constructor(
    private readonly repository: CharacterEquipmentRepository = createPrismaCharacterEquipmentRepository(),
  ) {}

  async getCampaignEquipmentState(campaignId: string): Promise<CampaignEquipmentReadModel> {
    return {
      itemsById: indexById(await this.repository.getCampaignEquipmentItems(campaignId)),
      templatesById: equipmentTemplatesById as Record<string, EquipmentTemplate>,
    };
  }

  async getCharacterEquipmentState(
    characterId: string,
    viewer?: CharacterEquipmentViewer,
  ): Promise<CharacterEquipmentReadModel> {
    const snapshot = await this.repository.getCharacterEquipmentState(characterId);

    if (viewer?.kind === "unauthorized") {
      return {
        activeLoadoutByCharacterId: {},
        itemsById: {},
        locationsById: {},
        templatesById: {},
      };
    }

    const activeLoadout = snapshot.loadouts.find((loadout) => loadout.isActive);

    return {
      activeLoadoutByCharacterId: activeLoadout ? { [characterId]: activeLoadout } : {},
      itemsById: indexById(projectItemsForViewer(snapshot.items, viewer)),
      locationsById: indexById(snapshot.locations),
      templatesById: equipmentTemplatesById as Record<string, EquipmentTemplate>,
    };
  }
}
