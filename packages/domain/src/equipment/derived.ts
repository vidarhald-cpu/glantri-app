import type {
  AccessTier,
  CarryMode,
  EquipmentItem,
  EquipmentTemplate,
  MaterialType,
  QualityType,
} from "./types";

export function getMaterialFactor(material: MaterialType): number {
  switch (material) {
    case "bronze":
      return 1.1;
    default:
      return 1.0;
  }
}

export function getQualityFactor(quality: QualityType): number {
  switch (quality) {
    case "extraordinary":
      return 0.9;
    default:
      return 1.0;
  }
}

export function getCarryFactor(carryMode: CarryMode): number {
  switch (carryMode) {
    case "backpack":
      return 0.75;
    case "mount":
    case "stored":
      return 0.0;
    case "equipped":
    case "on_person":
    default:
      return 1.0;
  }
}

export function getEffectiveEncumbrance(
  item: EquipmentItem,
  template: EquipmentTemplate,
): number {
  if (item.encumbranceOverride != null) {
    return item.encumbranceOverride;
  }

  return (
    template.baseEncumbrance *
    getMaterialFactor(item.material) *
    getQualityFactor(item.quality) *
    getCarryFactor(item.carryMode)
  );
}

export function getAccessTier(carryMode: CarryMode): AccessTier {
  switch (carryMode) {
    case "equipped":
      return "immediate";
    case "on_person":
      return "fast";
    case "backpack":
      return "slow";
    case "mount":
      return "situational";
    case "stored":
    default:
      return "unavailable";
  }
}

export function getRetrievalRounds(carryMode: CarryMode): number | null {
  switch (carryMode) {
    case "equipped":
      return 0;
    case "on_person":
      return 1;
    case "backpack":
      return 10;
    case "mount":
    case "stored":
    default:
      return null;
  }
}
