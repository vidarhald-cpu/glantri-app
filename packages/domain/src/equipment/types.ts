export type EquipmentCategory = "weapon" | "shield" | "armor" | "gear" | "valuables";

export type SpecificityType = "generic" | "specific";

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

export type QualityType = "standard" | "extraordinary";

export type CarryMode = "equipped" | "on_person" | "backpack" | "mount" | "stored";

export type ItemConditionState = "intact" | "worn" | "damaged" | "broken" | "lost";

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

export type LocationAvailabilityClass = "with_you" | "elsewhere";

export type AccessTier = "immediate" | "fast" | "slow" | "situational" | "unavailable";

export type WeaponHandlingClass =
  | "one_handed"
  | "two_handed"
  | "light"
  | "paired"
  | "missile"
  | "thrown"
  | "polearm"
  | "other";

export type WeaponDamageClass = "blunt" | "edged" | "pointed";

export type CanonicalMeleeMode = "slash" | "strike" | "thrust";

export type WeaponAttackModeProvenance = "imported" | "manual" | "derived";

export type WeaponAttackModeType = "melee" | "missile" | "thrown";

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
  /** Explicit delivery family; live declarations must not infer thrown use from a missing melee mode. */
  attackType?: WeaponAttackModeType | null;
  label?: string | null;
  /** Canonical display/default resolution order; legacy data falls back to array order. */
  order?: number | null;
  canonicalMeleeMode?: CanonicalMeleeMode | null;
  /** Explicit rules capability; absent legacy data is conservatively ineligible. */
  allowsRepeatedRoundAttack?: boolean | null;
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
  /** Mode-specific initiative from the source row; never fall back to melee initiative for throws. */
  initiative?: number | null;
  /** Mode-specific source range/reach. V1 preserves this without imposing a maximum-distance rule. */
  range?: string | null;
  provenance: WeaponAttackModeProvenance;
  /** Typed row-level provenance when this mode originates from a different source row/template. */
  sourceMetadata?: ImportedWeaponSourceMetadata | null;
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

export interface ImportedShieldSourceMetadata {
  workbook: string;
  sheet: string;
  row: number;
  sourceRange: string;
  sourceColumns: Record<string, string>;
  rawRow: Record<string, string>;
}

export interface ArmorLocationValues {
  head?: number | null;
  frontArm?: number | null;
  chest?: number | null;
  backArm?: number | null;
  abdomen?: number | null;
  frontThigh?: number | null;
  frontFoot?: number | null;
  backThigh?: number | null;
  backFoot?: number | null;
}

export interface ArmorLocationTypes {
  head?: string | null;
  frontArm?: string | null;
  chest?: string | null;
  backArm?: string | null;
  abdomen?: string | null;
  frontThigh?: string | null;
  frontFoot?: string | null;
  backThigh?: string | null;
  backFoot?: string | null;
  generalArmor?: string | null;
}

export interface ArmorComponentProfile {
  name: string;
  encumbranceFactor?: number | null;
  movementFactor?: number | null;
  generalArmor?: number | null;
  generalArmorRounded?: number | null;
  armorActivityModifier?: number | null;
  perceptionModifier?: number | null;
  locationValues?: ArmorLocationValues | null;
  criticalModifierByArea?: ArmorLocationValues | null;
  criticalModifierGeneral?: number | null;
  sourceMetadata?: ImportedArmorSourceMetadata | null;
}

export interface ImportedArmorSourceMetadata {
  workbook: string;
  sheet: string;
  finishedRow: number;
  typeRow?: number | null;
  componentRows?: number[] | null;
  sourceRange: string;
  sourceColumns: Record<string, string>;
  rawRows: Record<string, Record<string, string>>;
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
  preferredDistances?: number[] | null;
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
  weaponSkill?: string | null;
  handlingClass?: WeaponHandlingClass | null;
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
  shieldBonus?: number | null;
  defensiveValue?: number | null;
  movementModifier?: number | null;
  offensiveSourceMetadata?: ImportedShieldSourceMetadata | null;
  defensiveSourceMetadata?: ImportedShieldSourceMetadata | null;
  importWarnings?: string[] | null;
}

export interface ArmorTemplate extends EquipmentTemplateBase {
  category: "armor";
  armorRating?: number | null;
  generalArmorRounded?: number | null;
  encumbranceFactor?: number | null;
  mobilityPenalty?: number | null;
  armorActivityModifier?: number | null;
  movementFactor?: number | null;
  perceptionModifier?: number | null;
  locationValues?: ArmorLocationValues | null;
  locationTypes?: ArmorLocationTypes | null;
  criticalModifierByArea?: ArmorLocationValues | null;
  criticalModifierGeneral?: number | null;
  componentProfiles?: ArmorComponentProfile[] | null;
  sourceMetadata?: ImportedArmorSourceMetadata | null;
  importWarnings?: string[] | null;
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

export type ItemFactVisibility = "gm_only" | "revealed";

export interface ItemFactProvenance {
  factId: string;
  itemId: string;
}

export interface WeaponInitiativeOverrideFact {
  id: string;
  kind: "weapon_initiative_override";
  scope: "all_attack_modes";
  unit: "initiative_points";
  value: number;
  visibility: ItemFactVisibility;
}

export interface FinalAttackObDeltaFact {
  id: string;
  kind: "final_attack_ob_delta";
  calculationStage: "final_attack_ob";
  scope: "all_attack_modes";
  unit: "ob_points";
  value: number;
  visibility: ItemFactVisibility;
}

export type DescriptiveItemTraitCategory =
  | "engraving"
  | "maker_mark"
  | "appearance"
  | "provenance"
  | "craftsmanship"
  | "history"
  | "material"
  | "inscription"
  | "other";

export interface DescriptiveItemTrait {
  category: DescriptiveItemTraitCategory;
  id: string;
  text: string;
  visibility: ItemFactVisibility;
}

export interface UnsupportedItemCapability {
  id: string;
  name: string;
  rulesText: string;
  usageText?: string | null;
  visibility: ItemFactVisibility;
}

export interface EquipmentItemFactsV1 {
  version: 1;
  templateOverrides: WeaponInitiativeOverrideFact[];
  activeMechanics: FinalAttackObDeltaFact[];
  descriptiveTraits: DescriptiveItemTrait[];
  unsupportedCapabilities: UnsupportedItemCapability[];
}

export interface ItemStorageAssignment {
  locationId: string;
  carryMode: CarryMode;
}

/**
 * One durable item authority. The generic defaults preserve the assigned-item
 * compatibility view used by the current Character inventory workflow, while
 * `CanonicalEquipmentItem` represents the full holder/assignment-nullable domain.
 */
export interface EquipmentItem<
  THolderCharacterId extends string | null = string,
  TStorageAssignment extends ItemStorageAssignment | null = ItemStorageAssignment,
> {
  id: string;
  holderCharacterId?: THolderCharacterId;
  /** @deprecated Compatibility view, always derived from holderCharacterId. */
  characterId: THolderCharacterId;
  campaignContextId?: string | null;
  templateId: string;
  category: EquipmentCategory;
  displayName?: string | null;
  specificityType: SpecificityType;
  quantity: number;
  isStackable: boolean;
  material: MaterialType;
  quality: QualityType;
  /** Canonical optimistic-concurrency revision; supplied by persistent Item authority. */
  revision?: string;
  storageAssignment: TStorageAssignment;
  previousStorageAssignment?: ItemStorageAssignment | null;
  conditionState: ItemConditionState;
  durabilityCurrent?: number | null;
  durabilityMax?: number | null;
  encumbranceOverride?: number | null;
  valueOverride?: number | null;
  itemFacts?: EquipmentItemFactsV1;
  /** @deprecated Accepted only as a legacy input and converted to itemFacts. */
  specialProperties?: EquipmentSpecialProperties | null;
  notes?: string | null;
  isEquipped?: boolean | null;
  isFavorite?: boolean | null;
  acquiredFrom?: string | null;
  statusTags?: string[] | null;
}

export type CanonicalEquipmentItem = Omit<
  EquipmentItem<string | null, ItemStorageAssignment | null>,
  "campaignContextId" | "holderCharacterId" | "itemFacts"
> & {
  campaignContextId: string | null;
  holderCharacterId: string | null;
  itemFacts: EquipmentItemFactsV1;
};

export type AssignedEquipmentItem = Omit<
  EquipmentItem<string, ItemStorageAssignment>,
  "campaignContextId" | "holderCharacterId" | "itemFacts"
> & {
  campaignContextId: string | null;
  holderCharacterId: string;
  itemFacts: EquipmentItemFactsV1;
};

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
