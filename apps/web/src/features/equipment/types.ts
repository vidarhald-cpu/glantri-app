import type {
  AccessTier,
  CarryMode,
  CharacterLoadout,
  EquipmentItem,
  ItemConditionState,
  MaterialType,
  StorageLocation,
  WeaponTemplate,
  QualityType,
} from "@glantri/domain/equipment";

export interface EquipmentFeatureState {
  templates: {
    weaponsById: Record<string, WeaponTemplate>;
  };
  itemsById: Record<string, EquipmentItem>;
  locationsById: Record<string, StorageLocation>;
  activeLoadoutByCharacterId: Record<string, CharacterLoadout>;
}

export interface InventoryRow {
  itemId: string;
  displayName: string;
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
