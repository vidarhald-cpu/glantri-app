export type CombatToHitResultKey = "grazing-hit" | "hit" | "miss";

export interface CombatToHitRuleTableRow {
  grazing: boolean;
  hit: boolean;
  lookupTotal?: number;
  maxLookupTotal?: number;
  minLookupTotal?: number;
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
  db: number;
  grazing: boolean;
  hit: boolean;
  lookupTotal: number;
  ob: number;
  resultKey: CombatToHitResultKey;
  resultLabel: string;
  roll: number;
  sourceRows: readonly string[];
}

export const COMBAT_TO_HIT_RULE_TABLE = {
  dieLabel: "1d20",
  id: "combat-to-hit",
  notes: [
    "Lookup total = OB - DB + roll.",
    "The attack roll is a closed 1d20.",
    "Lookup totals of 10 or less miss.",
    "Lookup total 11 is a grazing hit.",
    "Lookup totals of 12 or more hit.",
    "Damage, critical, and minimum-damage columns from the workbook are deferred because duplicate 17/18 rows need clarification.",
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
      grazing: true,
      hit: true,
      lookupTotal: 11,
      resultKey: "grazing-hit",
      resultLabel: "Grazing hit",
      sourceRows: ["to hit (new)!A5:B5"],
    },
    {
      grazing: false,
      hit: true,
      minLookupTotal: 12,
      resultKey: "hit",
      resultLabel: "Hit",
      sourceRows: ["to hit (new)!A6:B29"],
    },
  ],
  source: {
    range: "A1:I32",
    sheet: "to hit (new)",
    workbook: "docs/source/combat/New Combat Arena.xlsx",
  },
  title: "Combat To Hit",
} as const satisfies CombatToHitRuleTable;

export function calculateToHitLookupTotal(input: {
  db: number;
  ob: number;
  roll: number;
}): number {
  assertCombatToHitRoll(input.roll);

  return input.ob - input.db + input.roll;
}

export function assertCombatToHitRoll(roll: number): void {
  if (!Number.isInteger(roll) || roll < 1 || roll > 20) {
    throw new RangeError("Combat To Hit roll must be a closed 1d20 value from 1 to 20.");
  }
}

export function rollClosedD20(
  input: {
    randomFn?: () => number;
  } = {},
): number {
  const randomFn = input.randomFn ?? Math.random;

  return Math.min(20, Math.max(1, Math.floor(randomFn() * 20) + 1));
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

export function resolveCombatToHit(input: {
  db: number;
  ob: number;
  roll: number;
}): CombatToHitResolution {
  const lookupTotal = calculateToHitLookupTotal(input);
  const result = lookupCombatToHitResult(lookupTotal);

  return {
    db: input.db,
    grazing: result.grazing,
    hit: result.hit,
    lookupTotal,
    ob: input.ob,
    resultKey: result.resultKey,
    resultLabel: result.resultLabel,
    roll: input.roll,
    sourceRows: result.sourceRows,
  };
}
