import { rollOpenEndedD20 } from "../dice/openEndedD20";
import type { OpenEndedD20Roll } from "../dice/openEndedD20";

export type CombatToHitResultKey = "grazing-hit" | "hit" | "miss";
export type CombatToHitCriticalGrade = "a" | "b" | "c" | "d" | "e" | "f";

export interface CombatToHitDamageMetadata {
  criticalGrade?: CombatToHitCriticalGrade;
  damageModifier: number;
  minDamage?: number;
  sourceRows: readonly string[];
}

export interface CombatToHitRuleTableRow {
  ambiguousDamage?: boolean;
  ambiguityReason?: string;
  criticalGrade?: CombatToHitCriticalGrade;
  damageModifier?: number;
  damageModifierFormula?: "lookup-minus-11";
  grazing: boolean;
  hit: boolean;
  lookupTotal?: number;
  maxLookupTotal?: number;
  minLookupTotal?: number;
  minDamage?: number;
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
  damageModifier?: number;
  db: number;
  grazing: boolean;
  hit: boolean;
  lookupTotal: number;
  minDamage?: number;
  ob: number;
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
    "Lookup total = OB - DB + open-ended roll total.",
    "Roll open-ended 1d20, using the same convention as skill rolls.",
    "Lookup totals of 10 or less miss.",
    "Lookup total 11 is a grazing hit.",
    "Lookup totals of 12 or more hit.",
    "Damage metadata is available for unambiguous hit rows.",
    "Lookup totals 17 and 18 have duplicate damage rows and must not be used for damage calculation until clarified.",
    "Grazing-hit damage has a special DMB note that must be clarified before automated damage calculation.",
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
      ambiguousDamage: true,
      ambiguityReason:
        "Grazing damage says `1 -> DMB *` and refers to a special effective DMB note; damage automation needs clarification.",
      grazing: true,
      hit: true,
      lookupTotal: 11,
      resultKey: "grazing-hit",
      resultLabel: "Grazing hit",
      sourceRows: ["to hit (new)!A5:E5", "to hit (new)!C32"],
    },
    {
      damageModifier: 1,
      grazing: false,
      hit: true,
      lookupTotal: 12,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A6:E6"],
    },
    {
      damageModifier: 1,
      grazing: false,
      hit: true,
      lookupTotal: 13,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A7:E7"],
    },
    {
      damageModifier: 2,
      grazing: false,
      hit: true,
      lookupTotal: 14,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A8:E8"],
    },
    {
      damageModifier: 2,
      grazing: false,
      hit: true,
      lookupTotal: 15,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A9:E9"],
    },
    {
      damageModifier: 3,
      grazing: false,
      hit: true,
      lookupTotal: 16,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A10:E10"],
    },
    {
      ambiguousDamage: true,
      ambiguityReason:
        "Lookup total 17 appears twice with damage modifiers 4 and 6.",
      grazing: false,
      hit: true,
      lookupTotal: 17,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A11:E11", "to hit (new)!A13:E13"],
    },
    {
      ambiguousDamage: true,
      ambiguityReason:
        "Lookup total 18 appears twice with damage modifiers 5 and 7, and only the second row has critical grade a.",
      grazing: false,
      hit: true,
      lookupTotal: 18,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A12:E12", "to hit (new)!A14:F14"],
    },
    {
      criticalGrade: "a",
      damageModifier: 8,
      grazing: false,
      hit: true,
      lookupTotal: 19,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A15:F15"],
    },
    {
      criticalGrade: "b",
      damageModifier: 9,
      minDamage: 1,
      grazing: false,
      hit: true,
      lookupTotal: 20,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A16:G16"],
    },
    {
      criticalGrade: "b",
      damageModifier: 10,
      minDamage: 1,
      grazing: false,
      hit: true,
      lookupTotal: 21,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A17:G17"],
    },
    {
      criticalGrade: "c",
      damageModifier: 11,
      minDamage: 2,
      grazing: false,
      hit: true,
      lookupTotal: 22,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A18:G18"],
    },
    {
      criticalGrade: "c",
      damageModifier: 12,
      minDamage: 2,
      grazing: false,
      hit: true,
      lookupTotal: 23,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A19:G19"],
    },
    {
      criticalGrade: "d",
      damageModifier: 13,
      minDamage: 3,
      grazing: false,
      hit: true,
      lookupTotal: 24,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A20:G20"],
    },
    {
      criticalGrade: "d",
      damageModifier: 14,
      minDamage: 3,
      grazing: false,
      hit: true,
      lookupTotal: 25,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A21:G21"],
    },
    {
      criticalGrade: "e",
      damageModifier: 15,
      minDamage: 4,
      grazing: false,
      hit: true,
      lookupTotal: 26,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A22:G22"],
    },
    {
      criticalGrade: "e",
      damageModifier: 16,
      minDamage: 4,
      grazing: false,
      hit: true,
      lookupTotal: 27,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A23:G23"],
    },
    {
      criticalGrade: "f",
      damageModifier: 17,
      minDamage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 28,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A24:G24"],
    },
    {
      criticalGrade: "f",
      damageModifier: 18,
      minDamage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 29,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A25:G25"],
    },
    {
      criticalGrade: "f",
      damageModifier: 19,
      minDamage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 30,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A26:G26"],
    },
    {
      criticalGrade: "f",
      damageModifier: 20,
      minDamage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 31,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A27:G27"],
    },
    {
      criticalGrade: "f",
      damageModifier: 21,
      minDamage: 5,
      grazing: false,
      hit: true,
      lookupTotal: 32,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A28:G28"],
    },
    {
      criticalGrade: "f",
      damageModifierFormula: "lookup-minus-11",
      minDamage: 5,
      grazing: false,
      hit: true,
      minLookupTotal: 33,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A29:G29"],
    },
  ],
  source: {
    range: "A1:I32",
    sheet: "to hit (new)",
    workbook: "docs/source/combat/New_Combat_Arena.xlsx",
  },
  title: "Combat To Hit",
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

function getCombatToHitDamageModifier(
  row: CombatToHitRuleTableRow,
  lookupTotal: number,
): number | undefined {
  if (row.damageModifier !== undefined) {
    return row.damageModifier;
  }

  if (row.damageModifierFormula === "lookup-minus-11") {
    return lookupTotal - 11;
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

  const damageModifier = getCombatToHitDamageModifier(row, lookupTotal);

  if (damageModifier === undefined) {
    throw new RangeError(
      `Combat To Hit lookup total ${lookupTotal} does not have damage metadata.`,
    );
  }

  return {
    criticalGrade: row.criticalGrade,
    damageModifier,
    minDamage: row.minDamage,
    sourceRows: row.sourceRows,
  };
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
    damageModifier: damageMetadata?.damageModifier,
    db: input.db,
    grazing: result.grazing,
    hit: result.hit,
    lookupTotal,
    minDamage: damageMetadata?.minDamage,
    ob: input.ob,
    resultKey: result.resultKey,
    resultLabel: result.resultLabel,
    rollTotal: input.rollTotal,
    sourceRows: result.sourceRows,
  };
}
