import { z } from "zod";

export const combatArmorModifierClassSchema = z.enum(["A", "B", "C", "D", "E"]);
export type CombatArmorModifierClass = z.infer<typeof combatArmorModifierClassSchema>;

export type CombatArmorMaterialKey = "noArmor" | "cloth" | "leather" | "chain" | "plate";

export interface CombatArmorModifierRuleTableRow {
  armorClass: CombatArmorModifierClass;
  armorKey: CombatArmorMaterialKey;
  armorLabel: string;
  modifiersByWeaponArmorClass: Record<CombatArmorModifierClass, number>;
  sourceRows: readonly string[];
}

export interface CombatArmorModifierRuleTable {
  columns: readonly CombatArmorModifierClass[];
  id: string;
  notes: readonly string[];
  rows: readonly CombatArmorModifierRuleTableRow[];
  source: {
    range: string;
    sheet: string;
    workbook: string;
  };
  title: string;
}

export const COMBAT_ARMOR_MODIFIER_RULE_TABLE = {
  columns: ["A", "B", "C", "D", "E"],
  id: "combat-armor-modifier",
  notes: [
    "Lookup armor damage modifier by weapon armor class and defender armor class.",
    "The modifier participates in the damage lookup total.",
  ],
  rows: [
    {
      armorClass: "E",
      armorKey: "plate",
      armorLabel: "Plate",
      modifiersByWeaponArmorClass: { A: -8, B: -6, C: -4, D: -2, E: 0 },
      sourceRows: ["Armor mod table!A3:G3"],
    },
    {
      armorClass: "D",
      armorKey: "chain",
      armorLabel: "Chain",
      modifiersByWeaponArmorClass: { A: -6, B: -4, C: -2, D: 0, E: 0 },
      sourceRows: ["Armor mod table!A4:G4"],
    },
    {
      armorClass: "C",
      armorKey: "leather",
      armorLabel: "Leather",
      modifiersByWeaponArmorClass: { A: -4, B: -2, C: 0, D: 0, E: 0 },
      sourceRows: ["Armor mod table!A5:G5"],
    },
    {
      armorClass: "B",
      armorKey: "cloth",
      armorLabel: "Cloth",
      modifiersByWeaponArmorClass: { A: -2, B: 0, C: 0, D: 0, E: 0 },
      sourceRows: ["Armor mod table!A6:G6"],
    },
    {
      armorClass: "A",
      armorKey: "noArmor",
      armorLabel: "No armor",
      modifiersByWeaponArmorClass: { A: 0, B: 0, C: 0, D: 0, E: 0 },
      sourceRows: ["Armor mod table!A7:G7"],
    },
  ],
  source: {
    range: "A1:G11",
    sheet: "Armor mod table",
    workbook: "docs/source/combat/New_Combat_Arena.xlsx",
  },
  title: "Combat Armor Modifier",
} as const satisfies CombatArmorModifierRuleTable;

export function normalizeCombatArmorModifierClass(
  value: string | undefined | null,
): CombatArmorModifierClass | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();

  return combatArmorModifierClassSchema.safeParse(normalized).success
    ? (normalized as CombatArmorModifierClass)
    : undefined;
}

export function lookupCombatArmorModifier(input: {
  armorClass: CombatArmorModifierClass;
  weaponArmorClass: CombatArmorModifierClass;
}): number {
  const row = COMBAT_ARMOR_MODIFIER_RULE_TABLE.rows.find(
    (candidate) => candidate.armorClass === input.armorClass,
  );

  if (!row) {
    throw new RangeError(`Unknown combat armor class: ${input.armorClass}`);
  }

  return row.modifiersByWeaponArmorClass[input.weaponArmorClass];
}
