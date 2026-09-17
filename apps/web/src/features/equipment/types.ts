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
  managementCampaigns?: Array<{ id: string; name: string }>;
  templates: {
    templatesById: Record<string, EquipmentTemplate>;
  };
  itemsById: Record<string, EquipmentItem>;
  locationsById: Record<string, StorageLocation>;
  activeLoadoutByCharacterId: Record<string, CharacterLoadout>;
  /** Server aggregate revision. Local static fixtures may omit it. */
  revision?: number;
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
  actualEncumbrance: number;
  effectiveEncumbrance: number | null;
  accessTier: AccessTier;
}
