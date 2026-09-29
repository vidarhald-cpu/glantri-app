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
    "Critical roll = 2d8 + critical type modifier - armor critical modifier.",
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

export function lookupCombatCriticalModifier(grade: string): CombatCriticalModifierRow {
  const normalizedGrade = normalizeCombatCriticalGrade(grade);
  const row = COMBAT_CRITICAL_MODIFIER_TABLE.rows.find(
    (candidate) => candidate.criticalGrade === normalizedGrade,
  );

  if (!row) {
    throw new RangeError(`Unknown combat critical grade: ${grade}`);
  }

  return row;
}

/**
 * Grade alphabet order used by rule decision 0006 §2 and by the settled `Sec` grammar
 * (`docs/rules/secondary-critical-sec-grammar.md` §3, "Grade order"): `A < B < C < D < E < F`,
 * the order `'cleon vs slaver'!C131` applies through `CODE()` comparison.
 */
export const COMBAT_CRITICAL_GRADE_ORDER = ["a", "b", "c", "d", "e", "f"] as const;

function getCombatCriticalGradeRank(grade: CombatCriticalGrade): number {
  return COMBAT_CRITICAL_GRADE_ORDER.indexOf(grade);
}

/** Negative when `left` is the lower grade, positive when it is the higher, `0` when equal. */
export function compareCombatCriticalGrades(
  left: CombatCriticalGrade,
  right: CombatCriticalGrade,
): number {
  return getCombatCriticalGradeRank(left) - getCombatCriticalGradeRank(right);
}

/** Lowers `grade` to `maximum` when it exceeds it. Never raises a grade. */
export function capCombatCriticalGradeAtMaximum(
  grade: CombatCriticalGrade,
  maximum: CombatCriticalGrade,
): CombatCriticalGrade {
  return compareCombatCriticalGrades(grade, maximum) > 0 ? maximum : grade;
}

function parseCombatCriticalGradeLetter(
  letter: string | undefined,
): CombatCriticalGrade | undefined {
  const parsed = combatCriticalGradeSchema.safeParse(letter?.toLowerCase());

  return parsed.success ? parsed.data : undefined;
}

/**
 * Rule decision 0006 §2: the weapon-table `Crit 1` grade letter is the **maximum** Primary
 * Critical grade for the weapon, applied before anything else in the resolution order.
 *
 * The `Crit 1` vocabulary is deliberately looser than the `Sec` vocabulary
 * (`docs/rules/secondary-critical-sec-grammar.md` §1, §4.2): qualified codes such as `FP cs` and
 * sentinels such as `N/A` occur. Only the leading grade letter is read, exactly as
 * `'cleon vs slaver'!C130:C131` reads it; anything whose first character is not a grade letter
 * yields no maximum and therefore no cap.
 */
export function parseWeaponPrimaryCriticalGradeMaximum(
  weaponCriticalCode: string | null | undefined,
): CombatCriticalGrade | undefined {
  const normalized = weaponCriticalCode?.trim().toUpperCase();

  return normalized ? parseCombatCriticalGradeLetter(normalized.charAt(0)) : undefined;
}

/**
 * Applies the weapon's `Crit 1` maximum to a resolved Primary Critical grade. Returns the grade
 * unchanged when the weapon authors no readable `Crit 1` grade letter.
 */
export function applyWeaponPrimaryCriticalGradeMaximum(input: {
  criticalGrade: string | undefined;
  weaponCriticalCode: string | null | undefined;
}): string | undefined {
  const grade = parseCombatCriticalGradeLetter(input.criticalGrade?.trim());

  if (!grade) {
    return input.criticalGrade;
  }

  const maximum = parseWeaponPrimaryCriticalGradeMaximum(input.weaponCriticalCode);

  return maximum ? capCombatCriticalGradeAtMaximum(grade, maximum) : grade;
}

/**
 * Rule decision 0006 §2 (amended 2026-09-21): a universal, weapon-independent two-grade-step
 * reduction from the resolved (already `Crit 1`-capped) Primary grade. §3: `B` and `A` produce no
 * Secondary Critical at all, and that check happens **before** the `Sec` maximum cap, so the cap
 * can never manufacture a Secondary the reduction did not produce.
 */
export const SECONDARY_CRITICAL_GRADE_REDUCTION_STEPS = 2;

export function applySecondaryCriticalGradeReduction(
  grade: CombatCriticalGrade,
): CombatCriticalGrade | undefined {
  const rank = getCombatCriticalGradeRank(grade) - SECONDARY_CRITICAL_GRADE_REDUCTION_STEPS;

  return rank >= 0 ? COMBAT_CRITICAL_GRADE_ORDER[rank] : undefined;
}

/**
 * The six attested `Sec` codes, ruled the complete recognized vocabulary by the Forgejo #223
 * Product Owner ruling (`docs/rules/secondary-critical-sec-grammar.md`, Q2 — resolved). Any other
 * value — including a structurally valid but unattested combination such as `BP` — fails closed.
 */
export const RECOGNIZED_SECONDARY_CRITICAL_CODES = ["AP", "AC", "AS", "BS", "CC", "DC"] as const;
export type RecognizedSecondaryCriticalCode = (typeof RECOGNIZED_SECONDARY_CRITICAL_CODES)[number];

/** `Sec` second character routing, `docs/rules/secondary-critical-sec-grammar.md` §2. */
export const SECONDARY_CRITICAL_FAMILY_BY_CODE_LETTER = {
  C: "blunt",
  P: "pointed_weapons",
  S: "sharp",
} as const;
export type SecondaryCriticalFamily =
  (typeof SECONDARY_CRITICAL_FAMILY_BY_CODE_LETTER)[keyof typeof SECONDARY_CRITICAL_FAMILY_BY_CODE_LETTER];

export type SecondaryCriticalCodeParseResult =
  | {
      /** The authored field is blank or absent: an authored absence, not unknown data. */
      status: "absent";
    }
  | {
      code: RecognizedSecondaryCriticalCode;
      family: SecondaryCriticalFamily;
      /** The raw authored value, preserved verbatim for provenance. */
      rawCode: string;
      secondaryGradeMaximum: CombatCriticalGrade;
      status: "recognized";
    }
  | {
      rawCode: string;
      reason: string;
      status: "unrecognized";
    };

/**
 * Parses a weapon-authored `Sec` value.
 *
 * Normalization is trimming and upper-casing **only**, per the grammar's parsing guidance §5:
 * internal spaces are never stripped, qualifiers are never split off, and malformed values are
 * never repaired. A blank or absent value is an authored absence. Everything else that is not one
 * of the six attested codes is unrecognized and fails closed.
 */
export function parseSecondaryCriticalCode(
  rawSecondaryCriticalCode: string | null | undefined,
): SecondaryCriticalCodeParseResult {
  if (rawSecondaryCriticalCode === undefined || rawSecondaryCriticalCode === null) {
    return { status: "absent" };
  }

  if (rawSecondaryCriticalCode.length === 0) {
    return { status: "absent" };
  }

  const normalized = rawSecondaryCriticalCode.trim().toUpperCase();
  const recognized = RECOGNIZED_SECONDARY_CRITICAL_CODES.find(
    (candidate) => candidate === normalized,
  );

  if (!recognized) {
    return {
      rawCode: rawSecondaryCriticalCode,
      reason: `Weapon Sec code '${rawSecondaryCriticalCode}' is not one of the recognized codes ${RECOGNIZED_SECONDARY_CRITICAL_CODES.join(", ")}; no Secondary Critical is resolved.`,
      status: "unrecognized",
    };
  }

  const gradeLetter = parseCombatCriticalGradeLetter(recognized.charAt(0));
  const family =
    SECONDARY_CRITICAL_FAMILY_BY_CODE_LETTER[
      recognized.charAt(1) as keyof typeof SECONDARY_CRITICAL_FAMILY_BY_CODE_LETTER
    ];

  if (!gradeLetter || !family) {
    return {
      rawCode: rawSecondaryCriticalCode,
      reason: `Weapon Sec code '${rawSecondaryCriticalCode}' could not be routed to a grade maximum and Critical family.`,
      status: "unrecognized",
    };
  }

  return {
    code: recognized,
    family,
    rawCode: rawSecondaryCriticalCode,
    secondaryGradeMaximum: gradeLetter,
    status: "recognized",
  };
}

export type SecondaryCriticalGradeResolution =
  | {
      /** No Secondary Critical occurs, and nothing is wrong: an authored absence or a B/A Primary. */
      reason: string;
      status: "none";
    }
  | {
      rawCode: string;
      reason: string;
      /** No Secondary Critical occurs and the reason is a data problem worth surfacing. */
      status: "unrecognized";
    }
  | {
      code: RecognizedSecondaryCriticalCode;
      family: SecondaryCriticalFamily;
      gradeCapApplied: boolean;
      primaryCriticalGrade: CombatCriticalGrade;
      rawCode: string;
      reducedCriticalGrade: CombatCriticalGrade;
      secondaryCriticalGrade: CombatCriticalGrade;
      secondaryGradeMaximum: CombatCriticalGrade;
      status: "resolved";
    };

/**
 * The settled Secondary Critical grade chain, rule decision 0006 §2/§3:
 *
 * 1. start from the resolved, already `Crit 1`-capped Primary grade;
 * 2. apply the universal two-grade-step reduction (`F→D, E→C, D→B, C→A`);
 * 3. `B` and `A` produce no Secondary Critical, checked **before** the cap;
 * 4. cap the reduced grade at the `Sec` first character's maximum — never raising it.
 */
export function resolveSecondaryCriticalGrade(input: {
  resolvedPrimaryCriticalGrade: string | undefined;
  weaponSecondaryCriticalCode: string | null | undefined;
}): SecondaryCriticalGradeResolution {
  const parsed = parseSecondaryCriticalCode(input.weaponSecondaryCriticalCode);

  if (parsed.status === "absent") {
    return {
      reason: "The weapon authors no Sec code, so no Secondary Critical occurs.",
      status: "none",
    };
  }

  if (parsed.status === "unrecognized") {
    return {
      rawCode: parsed.rawCode,
      reason: parsed.reason,
      status: "unrecognized",
    };
  }

  const primaryGrade = parseCombatCriticalGradeLetter(input.resolvedPrimaryCriticalGrade?.trim());

  if (!primaryGrade) {
    return {
      rawCode: parsed.rawCode,
      reason: `Resolved Primary Critical grade '${input.resolvedPrimaryCriticalGrade ?? ""}' is not a recognized grade letter; no Secondary Critical is resolved.`,
      status: "unrecognized",
    };
  }

  const reducedGrade = applySecondaryCriticalGradeReduction(primaryGrade);

  if (!reducedGrade) {
    return {
      reason: `The universal two-grade-step reduction from Primary grade ${primaryGrade.toUpperCase()} falls below A, so no Secondary Critical occurs.`,
      status: "none",
    };
  }

  const secondaryCriticalGrade = capCombatCriticalGradeAtMaximum(
    reducedGrade,
    parsed.secondaryGradeMaximum,
  );

  return {
    code: parsed.code,
    family: parsed.family,
    gradeCapApplied: secondaryCriticalGrade !== reducedGrade,
    primaryCriticalGrade: primaryGrade,
    rawCode: parsed.rawCode,
    reducedCriticalGrade: reducedGrade,
    secondaryCriticalGrade,
    secondaryGradeMaximum: parsed.secondaryGradeMaximum,
    status: "resolved",
  };
}
