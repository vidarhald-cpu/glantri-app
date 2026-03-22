import { z } from "zod";

export const equipmentItemTypeSchema = z.enum(["weapon", "shield", "armor"]);
export const equipmentSlotSchema = z.enum(["main-hand", "off-hand", "body", "pack"]);

export const characterEquipmentItemSchema = z.object({
  armorLabel: z.string().min(1).optional(),
  armorValue: z.number().int().default(0),
  equipped: z.boolean().default(false),
  id: z.string().min(1),
  itemType: equipmentItemTypeSchema,
  name: z.string().min(1),
  notes: z.string().optional(),
  shieldBonus: z.number().int().default(0),
  slot: equipmentSlotSchema.default("pack"),
  weaponBonus: z.number().int().default(0),
  weaponSkillId: z.string().min(1).optional()
});

export const characterEquipmentSchema = z.object({
  items: z.array(characterEquipmentItemSchema).default([])
});

export type EquipmentItemType = z.infer<typeof equipmentItemTypeSchema>;
export type EquipmentSlot = z.infer<typeof equipmentSlotSchema>;
export type CharacterEquipmentItem = z.infer<typeof characterEquipmentItemSchema>;
export type CharacterEquipment = z.infer<typeof characterEquipmentSchema>;
