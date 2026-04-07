import { z } from "zod";

export const EquipmentCategorySchema = z.enum([
  "weapon",
  "shield",
  "armor",
  "gear",
  "valuables",
]);

export const SpecificityTypeSchema = z.enum([
  "generic",
  "specific",
]);

export const MaterialTypeSchema = z.enum([
  "steel",
  "bronze",
  "wood",
  "leather",
  "cloth",
  "bone",
  "stone",
  "silver",
  "gold",
  "other",
]);

export const QualityTypeSchema = z.enum([
  "standard",
  "extraordinary",
]);

export const CarryModeSchema = z.enum([
  "equipped",
  "on_person",
  "backpack",
  "mount",
  "stored",
]);

export const ItemConditionStateSchema = z.enum([
  "intact",
  "worn",
  "damaged",
  "broken",
  "lost",
]);

export const StorageLocationTypeSchema = z.enum([
  "equipped_system",
  "person_system",
  "backpack_system",
  "mount_system",
  "home",
  "camp",
  "boat",
  "wagon",
  "cache",
  "building",
  "other",
]);

export const WeaponHandlingClassSchema = z.enum([
  "one_handed",
  "two_handed",
  "light",
  "paired",
  "missile",
  "thrown",
  "polearm",
  "other",
]);

export const EquipmentSpecialPropertiesSchema = z.object({
  magicEffects: z.array(z.string()).optional(),
  damageEffects: z.array(z.string()).optional(),
  protectiveEffects: z.array(z.string()).optional(),
  utilityEffects: z.array(z.string()).optional(),
  roleplayTraits: z.array(z.string()).optional(),
  customNotes: z.string().nullable().optional(),
});

export const EquipmentTemplateSchema = z.object({
  id: z.string(),
  category: EquipmentCategorySchema,
  name: z.string(),
  subtype: z.string().optional(),
  tags: z.array(z.string()).default([]),
  specificityTypeDefault: SpecificityTypeSchema,
  defaultMaterial: MaterialTypeSchema,
  baseEncumbrance: z.number().nonnegative(),
  baseValue: z.number().nullable().optional(),
  rulesNotes: z.string().nullable().optional(),
  roleplayNotes: z.string().nullable().optional(),
});

export const EquipmentTemplateBaseSchema = EquipmentTemplateSchema;

export const WeaponDurabilityProfileSchema = z.object({
  maxDurabilityDefault: z.number().int().positive(),
  breakThreshold: z.number().int().nonnegative(),
  wearSensitivity: z.enum(["low", "medium", "high"]),
  edgeSensitive: z.boolean(),
  shaftSensitive: z.boolean(),
  notes: z.string().nullable().optional(),
});

export const WeaponTemplateSchema = EquipmentTemplateSchema.extend({
  category: z.literal("weapon"),
  weaponClass: z.string(),
  weaponSkill: z.string(),
  handlingClass: WeaponHandlingClassSchema,
  primaryAttackType: z.string().nullable().optional(),
  secondaryAttackType: z.string().nullable().optional(),
  ob1: z.number().nullable().optional(),
  dmb1: z.number().nullable().optional(),
  ob2: z.number().nullable().optional(),
  dmb2: z.number().nullable().optional(),
  parry: z.number().nullable().optional(),
  initiative: z.number().nullable().optional(),
  range: z.string().nullable().optional(),
  armorMod1: z.string().nullable().optional(),
  armorMod2: z.string().nullable().optional(),
  crit1: z.string().nullable().optional(),
  crit2: z.string().nullable().optional(),
  secondCrit: z.string().nullable().optional(),
  defensiveValue: z.number().nullable().optional(),
  durabilityProfile: WeaponDurabilityProfileSchema.nullable().optional(),
});

export const ShieldTemplateSchema = EquipmentTemplateSchema.extend({
  category: z.literal("shield"),
  shieldBonus: z.number().nullable().optional(),
  defensiveValue: z.number().nullable().optional(),
});

export const ArmorTemplateSchema = EquipmentTemplateSchema.extend({
  category: z.literal("armor"),
  armorRating: z.number().nullable().optional(),
  mobilityPenalty: z.number().nullable().optional(),
});

export const GearTemplateSchema = EquipmentTemplateSchema.extend({
  category: z.literal("gear"),
});

export const ValuableTemplateSchema = EquipmentTemplateSchema.extend({
  category: z.literal("valuables"),
});

export const AnyEquipmentTemplateSchema = z.discriminatedUnion("category", [
  WeaponTemplateSchema,
  ShieldTemplateSchema,
  ArmorTemplateSchema,
  GearTemplateSchema,
  ValuableTemplateSchema,
]);

export const EquipmentItemSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  templateId: z.string(),
  category: EquipmentCategorySchema,
  displayName: z.string().nullable().optional(),
  specificityType: SpecificityTypeSchema,
  quantity: z.number().positive(),
  isStackable: z.boolean(),
  material: MaterialTypeSchema,
  quality: QualityTypeSchema,
  locationId: z.string(),
  carryMode: CarryModeSchema,
  conditionState: ItemConditionStateSchema,
  durabilityCurrent: z.number().int().nonnegative().nullable().optional(),
  durabilityMax: z.number().int().positive().nullable().optional(),
  encumbranceOverride: z.number().nonnegative().nullable().optional(),
  valueOverride: z.number().nonnegative().nullable().optional(),
  specialProperties: EquipmentSpecialPropertiesSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  isEquipped: z.boolean(),
  isFavorite: z.boolean().nullable().optional(),
  acquiredFrom: z.string().nullable().optional(),
  statusTags: z.array(z.string()).nullable().optional(),
});

export const StorageLocationSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  name: z.string(),
  type: StorageLocationTypeSchema,
  parentLocationId: z.string().nullable().optional(),
  isMobile: z.boolean(),
  isAccessibleInEncounter: z.boolean(),
  notes: z.string().nullable().optional(),
});

export const CharacterLoadoutSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  activeArmorItemId: z.string().nullable().optional(),
  activeShieldItemId: z.string().nullable().optional(),
  activePrimaryWeaponItemId: z.string().nullable().optional(),
  activeSecondaryWeaponItemId: z.string().nullable().optional(),
  activeMissileWeaponItemId: z.string().nullable().optional(),
  activeAmmoItemIds: z.array(z.string()).default([]),
  quickAccessItemIds: z.array(z.string()).default([]),
  notes: z.string().nullable().optional(),
});

export type EquipmentTemplateInput = z.input<typeof EquipmentTemplateSchema>;
export type EquipmentTemplateBaseInput = z.input<typeof EquipmentTemplateBaseSchema>;
export type WeaponTemplateInput = z.input<typeof WeaponTemplateSchema>;
export type ShieldTemplateInput = z.input<typeof ShieldTemplateSchema>;
export type ArmorTemplateInput = z.input<typeof ArmorTemplateSchema>;
export type GearTemplateInput = z.input<typeof GearTemplateSchema>;
export type ValuableTemplateInput = z.input<typeof ValuableTemplateSchema>;
export type EquipmentItemInput = z.input<typeof EquipmentItemSchema>;
export type StorageLocationInput = z.input<typeof StorageLocationSchema>;
export type CharacterLoadoutInput = z.input<typeof CharacterLoadoutSchema>;
