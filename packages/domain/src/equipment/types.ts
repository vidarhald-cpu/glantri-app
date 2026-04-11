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

export type LocationAvailabilityClass =
  | "with_you"
  | "elsewhere";

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

export type WeaponDamageClass =
  | "blunt"
  | "edged"
  | "pointed";

export type CanonicalMeleeMode =
  | "slash"
  | "strike"
  | "thrust";

export type WeaponAttackModeProvenance =
  | "imported"
  | "manual"
  | "derived";

export interface EquipmentTemplateBase {
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

export interface WeaponAttackMode {
  id: string;
  label?: string | null;
  canonicalMeleeMode?: CanonicalMeleeMode | null;
  isPrimaryAttack?: boolean | null;
  damageClass?: WeaponDamageClass | null;
  ob?: number | null;
  obRaw?: string | null;
  dmb?: number | null;
  dmbRaw?: string | null;
  dmbFormula?: WeaponDamageModifierFormula | null;
  crit?: string | null;
  secondCrit?: string | null;
  armorModifier?: string | null;
  provenance: WeaponAttackModeProvenance;
  notes?: string | null;
}

export interface WeaponDamageModifierFormula {
  kind: "numeric" | "dice" | "special" | "unresolved";
  raw: string;
  numericValue?: number | null;
  diceCount?: number | null;
  diceSides?: number | null;
  flatModifier?: number | null;
  textModifier?: string | null;
  specialValue?: string | null;
  note?: string | null;
}

export interface WeaponEncumbranceFormula {
  kind: "numeric" | "ammo_linked" | "special" | "unresolved";
  raw: string;
  numericValue?: number | null;
  baseValue?: number | null;
  ammoValue?: number | null;
  specialValue?: string | null;
  note?: string | null;
}

export interface ImportedWeaponSourceMetadata {
  workbook: string;
  sheet: string;
  row: number;
  sourceRange: string;
  sourceColumns: Record<string, string>;
  rawRow: Record<string, string>;
}

export interface WeaponAttackModeManualOverride {
  modeId: string;
  fields: string[];
  note?: string | null;
}

export interface WeaponTemplateManualEnrichment {
  source: string;
  notes?: string[] | null;
  attackModeOverrides?: WeaponAttackModeManualOverride[] | null;
  resolvedImportWarnings?: string[] | null;
  unresolvedImportWarnings?: string[] | null;
}

export interface WeaponFormulaNormalizationEntry {
  fieldPath: string;
  kind: "dmb" | "encumbrance" | "ammo_encumbrance";
  raw: string;
  normalizedAs: string;
  note?: string | null;
}

export interface WeaponTemplateFormulaNormalization {
  source: string;
  normalizedFields?: WeaponFormulaNormalizationEntry[] | null;
  resolvedImportWarnings?: string[] | null;
  unresolvedImportWarnings?: string[] | null;
  notes?: string[] | null;
}

export interface WeaponTemplate extends EquipmentTemplateBase {
  category: "weapon";
  weaponClass: string;
  weaponSkill: string;
  handlingClass: WeaponHandlingClass;
  attackModes?: WeaponAttackMode[] | null;
  primeAttackType?: string | null;
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
  baseEncumbranceFormula?: WeaponEncumbranceFormula | null;
  ammoEncumbrance?: number | null;
  ammoEncumbranceRaw?: string | null;
  ammoEncumbranceFormula?: WeaponEncumbranceFormula | null;
  sourceMetadata?: ImportedWeaponSourceMetadata | null;
  importWarnings?: string[] | null;
  manualEnrichment?: WeaponTemplateManualEnrichment | null;
  formulaNormalization?: WeaponTemplateFormulaNormalization | null;
  durabilityProfile?: WeaponDurabilityProfile | null;
}

export interface ShieldTemplate extends EquipmentTemplateBase {
  category: "shield";
  shieldBonus?: number | null;
  defensiveValue?: number | null;
}

export interface ArmorTemplate extends EquipmentTemplateBase {
  category: "armor";
  armorRating?: number | null;
  mobilityPenalty?: number | null;
}

export interface GearTemplate extends EquipmentTemplateBase {
  category: "gear";
}

export interface ValuableTemplate extends EquipmentTemplateBase {
  category: "valuables";
}

export type EquipmentTemplate =
  | WeaponTemplate
  | ShieldTemplate
  | ArmorTemplate
  | GearTemplate
  | ValuableTemplate;

export interface EquipmentSpecialProperties {
  magicEffects?: string[];
  damageEffects?: string[];
  protectiveEffects?: string[];
  utilityEffects?: string[];
  roleplayTraits?: string[];
  customNotes?: string | null;
}

export interface ItemStorageAssignment {
  locationId: string;
  carryMode: CarryMode;
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
  storageAssignment: ItemStorageAssignment;
  conditionState: ItemConditionState;
  durabilityCurrent?: number | null;
  durabilityMax?: number | null;
  encumbranceOverride?: number | null;
  valueOverride?: number | null;
  specialProperties?: EquipmentSpecialProperties | null;
  notes?: string | null;
  isEquipped?: boolean | null;
  isFavorite?: boolean | null;
  acquiredFrom?: string | null;
  statusTags?: string[] | null;
}

export interface StorageLocation {
  id: string;
  characterId: string;
  name: string;
  type: StorageLocationType;
  availabilityClass: LocationAvailabilityClass;
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
  wornArmorItemId?: string | null;
  readyShieldItemId?: string | null;
  activePrimaryWeaponItemId?: string | null;
  activeSecondaryWeaponItemId?: string | null;
  activeMissileWeaponItemId?: string | null;
  activeAmmoItemIds: string[];
  quickAccessItemIds: string[];
  notes?: string | null;
}
