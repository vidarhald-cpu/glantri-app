import { rollOpenEndedD20 } from "../dice/openEndedD20";
import type { OpenEndedD20Roll } from "../dice/openEndedD20";

export type CombatToHitResultKey = "grazing-hit" | "hit" | "miss";
export type CombatToHitCriticalGrade = "a" | "b" | "c" | "d" | "e" | "f";

export interface CombatToHitDamageRollMetadata {
  required: boolean;
  sourceLookupTotal?: number;
}

export interface CombatToHitDamageMetadata {
  criticalGrade?: CombatToHitCriticalGrade;
  damage: number;
  damageRoll?: CombatToHitDamageRollMetadata;
  maxDamageNote?: string;
  minDamage?: number;
  sourceRows: readonly string[];
}

export interface CombatToHitRuleTableRow {
  ambiguousDamage?: boolean;
  ambiguityReason?: string;
  criticalGrade?: CombatToHitCriticalGrade;
  damage?: number;
  damageFormula?: "lookup-minus-13";
  damageRollFormula?: "grazing-from-lookup-12";
  grazing: boolean;
  hit: boolean;
  lookupTotal?: number;
  maxLookupTotal?: number;
  maxDamageNote?: string;
  minLookupTotal?: number;
  minDamage?: number;
  parryModifier?: number;
  resultKey: CombatToHitResultKey;
  resultLabel: string;
  sourceRows: readonly string[];
}

export interface CombatToHitRuleTable {
  dieLabel: string;
  id: string;
  notes: readonly string[];
  rows: readonly CombatToHitRuleTableRow[];
  source: {
    range: string;
    sheet: string;
    workbook: string;
  };
  title: string;
}

export interface CombatToHitResolution {
  criticalGrade?: CombatToHitCriticalGrade;
  damage?: number;
  db: number;
  grazing: boolean;
  hit: boolean;
  lookupTotal: number;
  minDamage?: number;
  ob: number;
  parryModifier: number;
  resultKey: CombatToHitResultKey;
  resultLabel: string;
  rollTotal: number;
  sourceRows: readonly string[];
}

export interface CombatToHitRoll extends OpenEndedD20Roll {
  rollTotal: number;
}

export const COMBAT_TO_HIT_RULE_TABLE = {
  dieLabel: "1d20",
  id: "combat-to-hit",
  notes: [
    "Hit lookup total = OB - DB + open-ended roll total.",
    "Roll open-ended 1d20, using the same convention as skill rolls.",
    "Lookup totals of 10 or less miss.",
    "Lookup total 11 is a grazing hit.",
    "Lookup totals of 12 or more hit.",
    "Damage lookup total = hit lookup total + weapon DMB + defender DM.",
    "Damage, critical grade, and minimum damage are read from the damage lookup total row.",
    "Equipped armor is applied after table damage is read: armor value reduces damage and the armor modifier table adjusts damage and minimum damage.",
    "Melee hit lookup totals 16 and higher impose a defender parry modifier from the hit lookup row.",
    "Lookup totals 17 and 18 are resolved in the refreshed table.",
    "Grazing-hit damage rolls 1dX, where X is the armor-adjusted reference damage at damage lookup total 12 + DMB + DM.",
    "Lookup totals above 34 continue by adding 1 damage per row, with critical grade f, minimum damage 5, and defender parry modifier -10.",
    "Legacy workbook sheet `To Hit table` is not canonical for current app hit/miss logic.",
  ],
  rows: [
    {
      grazing: false,
      hit: false,
      maxLookupTotal: 10,
      resultKey: "miss",
      resultLabel: "Miss",
      sourceRows: ["to hit (new)!A3:B4"],
    },
    {
      damage: 0,
      damageRollFormula: "grazing-from-lookup-12",
      grazing: true,
      hit: true,
      lookupTotal: 11,
      resultKey: "grazing-hit",
      resultLabel: "Grazing hit",
      sourceRows: ["to hit (new)!A5:E5", "to hit (new)!A6:E6", "to hit (new)!C32"],
    },
    {
      damage: 1,
      grazing: false,
      hit: true,
      lookupTotal: 12,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A6:E6"],
    },
    {
      damage: 1,
      grazing: false,
      hit: true,
      lookupTotal: 13,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A7:E7"],
    },
    {
      damage: 2,
      grazing: false,
      hit: true,
      lookupTotal: 14,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A8:E8"],
    },
    {
      damage: 2,
      grazing: false,
      hit: true,
      lookupTotal: 15,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A9:E9"],
    },
    {
      damage: 3,
      grazing: false,
      hit: true,
      lookupTotal: 16,
      parryModifier: -1,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A10:E10"],
    },
    {
      damage: 4,
      grazing: false,
      hit: true,
      lookupTotal: 17,
      parryModifier: -2,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A11:E11"],
    },
    {
      damage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 18,
      parryModifier: -3,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A12:E12"],
    },
    {
      damage: 6,
      grazing: false,
      hit: true,
      lookupTotal: 19,
      parryModifier: -4,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A13:E13"],
    },
    {
      criticalGrade: "a",
      damage: 7,
      grazing: false,
      hit: true,
      lookupTotal: 20,
      parryModifier: -5,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A14:F14"],
    },
    {
      criticalGrade: "a",
      damage: 8,
      grazing: false,
      hit: true,
      lookupTotal: 21,
      parryModifier: -6,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A15:F15"],
    },
    {
      criticalGrade: "b",
      damage: 9,
      minDamage: 1,
      grazing: false,
      hit: true,
      lookupTotal: 22,
      parryModifier: -7,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A16:G16"],
    },
    {
      criticalGrade: "b",
      damage: 10,
      minDamage: 1,
      grazing: false,
      hit: true,
      lookupTotal: 23,
      parryModifier: -8,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A17:G17"],
    },
    {
      criticalGrade: "c",
      damage: 11,
      minDamage: 2,
      grazing: false,
      hit: true,
      lookupTotal: 24,
      parryModifier: -9,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A18:G18"],
    },
    {
      criticalGrade: "c",
      damage: 12,
      minDamage: 2,
      grazing: false,
      hit: true,
      lookupTotal: 25,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A19:G19"],
    },
    {
      criticalGrade: "d",
      damage: 13,
      minDamage: 3,
      grazing: false,
      hit: true,
      lookupTotal: 26,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A20:G20"],
    },
    {
      criticalGrade: "d",
      damage: 14,
      minDamage: 3,
      grazing: false,
      hit: true,
      lookupTotal: 27,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A21:G21"],
    },
    {
      criticalGrade: "e",
      damage: 15,
      minDamage: 4,
      grazing: false,
      hit: true,
      lookupTotal: 28,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A22:G22"],
    },
    {
      criticalGrade: "e",
      damage: 16,
      minDamage: 4,
      grazing: false,
      hit: true,
      lookupTotal: 29,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A23:G23"],
    },
    {
      criticalGrade: "f",
      damage: 17,
      maxDamageNote: "max damage: 17 + GM STR when relevant",
      minDamage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 30,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A24:I24"],
    },
    {
      criticalGrade: "f",
      damage: 18,
      maxDamageNote: "max damage: 17 + GM STR when relevant",
      minDamage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 31,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A25:I25"],
    },
    {
      criticalGrade: "f",
      damage: 19,
      maxDamageNote: "max damage: 17 + GM STR when relevant",
      minDamage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 32,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A26:I26"],
    },
    {
      criticalGrade: "f",
      damage: 20,
      maxDamageNote: "max damage: 17 + GM STR when relevant",
      minDamage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 33,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A27:I27"],
    },
    {
      criticalGrade: "f",
      damage: 21,
      maxDamageNote: "max damage: 17 + GM STR when relevant",
      minDamage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 34,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A28:I28"],
    },
    {
      criticalGrade: "f",
      damageFormula: "lookup-minus-13",
      maxDamageNote: "max damage: 17 + GM STR when relevant",
      minDamage: 5,
      grazing: false,
      hit: true,
      minLookupTotal: 35,
      parryModifier: -10,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A29:I29"],
    },
  ],
  source: {
    range: "A1:I32",
    sheet: "to hit (new)",
    workbook: "docs/source/combat/New_Combat_Arena.xlsx",
  },
  title: "Glantri Combat To Hit / Damage",
} as const satisfies CombatToHitRuleTable;

export function calculateToHitLookupTotal(input: {
  db: number;
  ob: number;
  rollTotal: number;
}): number {
  assertCombatToHitRollTotal(input.rollTotal);

  return input.ob - input.db + input.rollTotal;
}

export function assertCombatToHitRollTotal(rollTotal: number): void {
  if (!Number.isInteger(rollTotal)) {
    throw new RangeError("Combat To Hit roll total must be an integer.");
  }
}

export function rollOpenEndedCombatToHitD20(rng: () => number = Math.random): CombatToHitRoll {
  const roll = rollOpenEndedD20(rng);

  return {
    ...roll,
    rollTotal: roll.dieResult,
  };
}

function rowMatchesLookupTotal(row: CombatToHitRuleTableRow, lookupTotal: number): boolean {
  if (row.lookupTotal !== undefined) {
    return lookupTotal === row.lookupTotal;
  }

  if (row.minLookupTotal !== undefined && lookupTotal < row.minLookupTotal) {
    return false;
  }

  if (row.maxLookupTotal !== undefined && lookupTotal > row.maxLookupTotal) {
    return false;
  }

  return true;
}

export function lookupCombatToHitResult(lookupTotal: number): CombatToHitRuleTableRow {
  if (!Number.isInteger(lookupTotal)) {
    throw new RangeError("Combat To Hit lookup total must be an integer.");
  }

  const row = COMBAT_TO_HIT_RULE_TABLE.rows.find((candidate) =>
    rowMatchesLookupTotal(candidate, lookupTotal),
  );

  if (!row) {
    throw new RangeError(`Combat To Hit lookup total ${lookupTotal} is not represented by the canonical table.`);
  }

  return row;
}

function getCombatToHitDamageValue(
  row: CombatToHitRuleTableRow,
  lookupTotal: number,
): number | undefined {
  if (row.damage !== undefined) {
    return row.damage;
  }

  if (row.damageFormula === "lookup-minus-13") {
    return lookupTotal - 13;
  }

  return undefined;
}

function getCombatToHitDamageRollMetadata(
  row: CombatToHitRuleTableRow,
): CombatToHitDamageRollMetadata | undefined {
  if (row.damageRollFormula === "grazing-from-lookup-12") {
    return {
      required: true,
      sourceLookupTotal: 12,
    };
  }

  return undefined;
}

export function lookupCombatToHitDamageMetadata(
  lookupTotal: number,
): CombatToHitDamageMetadata | undefined {
  const row = lookupCombatToHitResult(lookupTotal);

  if (!row.hit) {
    return undefined;
  }

  if (row.ambiguousDamage) {
    throw new RangeError(
      `Combat To Hit lookup total ${lookupTotal} has ambiguous damage metadata: ${row.ambiguityReason ?? "clarification required"}`,
    );
  }

  const damage = getCombatToHitDamageValue(row, lookupTotal);

  if (damage === undefined) {
    throw new RangeError(
      `Combat To Hit lookup total ${lookupTotal} does not have damage metadata.`,
    );
  }

  return {
    criticalGrade: row.criticalGrade,
    damage,
    damageRoll: getCombatToHitDamageRollMetadata(row),
    maxDamageNote: row.maxDamageNote,
    minDamage: row.minDamage,
    sourceRows: row.sourceRows,
  };
}

export function lookupCombatToHitParryModifier(lookupTotal: number): number {
  const row = lookupCombatToHitResult(lookupTotal);

  return row.parryModifier ?? 0;
}

export function resolveCombatToHit(input: {
  db: number;
  ob: number;
  rollTotal: number;
}): CombatToHitResolution {
  const lookupTotal = calculateToHitLookupTotal(input);
  const result = lookupCombatToHitResult(lookupTotal);
  const damageMetadata = result.hit
    ? (() => {
        try {
          return lookupCombatToHitDamageMetadata(lookupTotal);
        } catch {
          return undefined;
        }
      })()
    : undefined;

  return {
    criticalGrade: damageMetadata?.criticalGrade,
    damage: damageMetadata?.damage,
    db: input.db,
    grazing: result.grazing,
    hit: result.hit,
    lookupTotal,
    minDamage: damageMetadata?.minDamage,
    ob: input.ob,
    parryModifier: lookupCombatToHitParryModifier(lookupTotal),
    resultKey: result.resultKey,
    resultLabel: result.resultLabel,
    rollTotal: input.rollTotal,
    sourceRows: result.sourceRows,
  };
}
