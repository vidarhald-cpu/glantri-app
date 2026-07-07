import { z } from "zod";

export const combatCriticalGradeSchema = z.enum(["a", "b", "c", "d", "e", "f"]);
export type CombatCriticalGrade = z.infer<typeof combatCriticalGradeSchema>;

export interface CombatCriticalModifierRow {
  criticalGrade: CombatCriticalGrade;
  criticalTypeModifier: number;
  minDamage: number;
  sourceRows: readonly string[];
}

export const COMBAT_CRITICAL_MODIFIER_TABLE = {
  id: "combat-critical-modifiers",
  notes: [
    "Critical roll = 2d8 + critical type modifier + armor critical modifier.",
    "Armor critical modifier is read from selected hit-location armor coverage when available.",
  ],
  rows: [
    {
      criticalGrade: "a",
      criticalTypeModifier: -6,
      minDamage: 0,
      sourceRows: ["Critical table!A2:C2"],
    },
    {
      criticalGrade: "b",
      criticalTypeModifier: -4,
      minDamage: 1,
      sourceRows: ["Critical table!A3:C3"],
    },
    {
      criticalGrade: "c",
      criticalTypeModifier: -2,
      minDamage: 2,
      sourceRows: ["Critical table!A4:C4"],
    },
    {
      criticalGrade: "d",
      criticalTypeModifier: 0,
      minDamage: 3,
      sourceRows: ["Critical table!A5:C5"],
    },
    {
      criticalGrade: "e",
      criticalTypeModifier: 2,
      minDamage: 4,
      sourceRows: ["Critical table!A6:C6"],
    },
    {
      criticalGrade: "f",
      criticalTypeModifier: 3,
      minDamage: 5,
      sourceRows: ["Critical table!A7:C7"],
    },
  ],
  source: {
    range: "A1:C7",
    sheet: "Critical table",
    workbook: "docs/source/combat/New_Combat_Arena.xlsx",
  },
  title: "Combat Critical Modifiers",
} as const;

export function normalizeCombatCriticalGrade(grade: string): CombatCriticalGrade {
  return combatCriticalGradeSchema.parse(grade.trim().toLowerCase());
}

export function lookupCombatCriticalModifier(
  grade: string,
): CombatCriticalModifierRow {
  const normalizedGrade = normalizeCombatCriticalGrade(grade);
  const row = COMBAT_CRITICAL_MODIFIER_TABLE.rows.find(
    (candidate) => candidate.criticalGrade === normalizedGrade,
  );

  if (!row) {
    throw new RangeError(`Unknown combat critical grade: ${grade}`);
  }

  return row;
}
