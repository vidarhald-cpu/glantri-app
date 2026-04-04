export type EquipmentCategory =
  | "weapon"
  | "shield"
  | "armor"
  | "gear"
  | "valuables";

export type SpecificityType =
  | "generic"
  | "specific";

export type MaterialType =
  | "steel"
  | "bronze"
  | "wood"
  | "leather"
  | "cloth"
  | "bone"
  | "stone"
  | "silver"
  | "gold"
  | "other";

export type QualityType =
  | "standard"
  | "extraordinary";

export type CarryMode =
  | "equipped"
  | "on_person"
  | "backpack"
  | "mount"
  | "stored";

export type ItemConditionState =
  | "intact"
  | "worn"
  | "damaged"
  | "broken"
  | "lost";

export type StorageLocationType =
  | "equipped_system"
  | "person_system"
  | "backpack_system"
  | "mount_system"
  | "home"
  | "camp"
  | "boat"
  | "wagon"
  | "cache"
  | "building"
  | "other";

export type AccessTier =
  | "immediate"
  | "fast"
  | "slow"
  | "situational"
  | "unavailable";

export type WeaponHandlingClass =
  | "one_handed"
  | "two_handed"
  | "light"
  | "paired"
  | "missile"
  | "thrown"
  | "polearm"
  | "other";

export interface EquipmentTemplate {
  id: string;
  category: EquipmentCategory;
  name: string;
  subtype?: string;
  tags: string[];
  specificityTypeDefault: SpecificityType;
  defaultMaterial: MaterialType;
  baseEncumbrance: number;
  baseValue?: number | null;
  rulesNotes?: string | null;
  roleplayNotes?: string | null;
}

export interface WeaponDurabilityProfile {
  maxDurabilityDefault: number;
  breakThreshold: number;
  wearSensitivity: "low" | "medium" | "high";
  edgeSensitive: boolean;
  shaftSensitive: boolean;
  notes?: string | null;
}

export interface WeaponTemplate extends EquipmentTemplate {
  category: "weapon";
  weaponClass: string;
  weaponSkill: string;
  handlingClass: WeaponHandlingClass;
  primaryAttackType?: string | null;
  secondaryAttackType?: string | null;
  ob1?: number | null;
  dmb1?: number | null;
  ob2?: number | null;
  dmb2?: number | null;
  parry?: number | null;
  initiative?: number | null;
  range?: string | null;
  armorMod1?: string | null;
  armorMod2?: string | null;
  crit1?: string | null;
  crit2?: string | null;
  secondCrit?: string | null;
  defensiveValue?: number | null;
  durabilityProfile?: WeaponDurabilityProfile | null;
}

export interface EquipmentSpecialProperties {
  magicEffects?: string[];
  damageEffects?: string[];
  protectiveEffects?: string[];
  utilityEffects?: string[];
  roleplayTraits?: string[];
  customNotes?: string | null;
}

export interface EquipmentItem {
  id: string;
  characterId: string;
  templateId: string;
  category: EquipmentCategory;
  displayName?: string | null;
  specificityType: SpecificityType;
  quantity: number;
  isStackable: boolean;
  material: MaterialType;
  quality: QualityType;
  locationId: string;
  carryMode: CarryMode;
  conditionState: ItemConditionState;
  durabilityCurrent?: number | null;
  durabilityMax?: number | null;
  encumbranceOverride?: number | null;
  valueOverride?: number | null;
  specialProperties?: EquipmentSpecialProperties | null;
  notes?: string | null;
  isEquipped: boolean;
  isFavorite?: boolean | null;
  acquiredFrom?: string | null;
  statusTags?: string[] | null;
}

export interface StorageLocation {
  id: string;
  characterId: string;
  name: string;
  type: StorageLocationType;
  parentLocationId?: string | null;
  isMobile: boolean;
  isAccessibleInEncounter: boolean;
  notes?: string | null;
}

export interface CharacterLoadout {
  id: string;
  characterId: string;
  name: string;
  isActive: boolean;
  activeArmorItemId?: string | null;
  activeShieldItemId?: string | null;
  activePrimaryWeaponItemId?: string | null;
  activeSecondaryWeaponItemId?: string | null;
  activeMissileWeaponItemId?: string | null;
  activeAmmoItemIds: string[];
  quickAccessItemIds: string[];
  notes?: string | null;
}
