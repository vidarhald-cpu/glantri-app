import type {
  AccessTier,
  CarryMode,
  CharacterLoadout,
  EquipmentItem,
  EquipmentTemplate,
  ItemConditionState,
  MaterialType,
  StorageLocation,
  QualityType,
} from "@glantri/domain";

export interface EquipmentFeatureState {
  templates: {
    templatesById: Record<string, EquipmentTemplate>;
  };
  itemsById: Record<string, EquipmentItem>;
  locationsById: Record<string, StorageLocation>;
  activeLoadoutByCharacterId: Record<string, CharacterLoadout>;
}

export interface InventoryRow {
  itemId: string;
  displayName: string | null;
  templateName: string;
  category: string;
  locationName: string;
  carryMode: CarryMode;
  material: MaterialType;
  quality: QualityType;
  conditionState: ItemConditionState;
  effectiveEncumbrance: number;
  accessTier: AccessTier;
}
