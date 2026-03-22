import type {
  EncounterAttackResolution,
  EncounterCriticalEffectSummary,
  EncounterCriticalType
} from "@glantri/domain";

import { encounterAttackResolutionSchema } from "@glantri/domain";

export interface ResolveEncounterCriticalResult {
  errors: string[];
  resolution?: EncounterAttackResolution;
  warnings: string[];
}

const PROVISIONAL_CRITICAL_TRIGGER_DAMAGE_THRESHOLD = 12;
const PROVISIONAL_CRITICAL_RULE_LABEL =
  "REVIEW_FLAG: Critical escalation currently uses a provisional final-damage threshold because no finalized crit trigger rule is modeled yet.";

function clampPercentileRoll(roll: number): number {
  return Math.max(1, Math.min(100, Math.round(roll)));
}

function parseResolution(resolution: EncounterAttackResolution): EncounterAttackResolution {
  return encounterAttackResolutionSchema.parse(resolution);
}

function getCriticalType(resolution: EncounterAttackResolution): EncounterCriticalType {
  if (
    resolution.hitLocation?.resolvedLocation === "arm" ||
    resolution.hitLocation?.resolvedLocation === "leg"
  ) {
    return "limb";
  }

  return "general";
}

function getLocationModifier(resolution: EncounterAttackResolution): number {
  switch (resolution.hitLocation?.resolvedLocation) {
    case "head":
      return 10;
    case "torso":
      return 5;
    case "arm":
    case "leg":
      return 0;
    default:
      return 0;
  }
}

function buildCriticalEffectSummary(input: {
  finalRoll: number;
  type: EncounterCriticalType;
}): {
  effect: EncounterCriticalEffectSummary;
  resultKey: string;
  resultRow: string;
} {
  if (input.finalRoll >= 120) {
    return {
      effect: {
        severity: "severe",
        summary:
          input.type === "limb"
            ? "Severe limb critical pending condition modeling."
            : "Severe critical pending condition modeling.",
        tags: ["critical", "severe"]
      },
      resultKey: `${input.type}-severe`,
      resultRow: "Severe"
    };
  }

  if (input.finalRoll >= 80) {
    return {
      effect: {
        severity: "major",
        summary:
          input.type === "limb"
            ? "Major limb critical pending condition modeling."
            : "Major critical pending condition modeling.",
        tags: ["critical", "major"]
      },
      resultKey: `${input.type}-major`,
      resultRow: "Major"
    };
  }

  return {
    effect: {
      severity: "minor",
      summary:
        input.type === "limb"
          ? "Minor limb critical pending condition modeling."
          : "Minor critical pending condition modeling.",
      tags: ["critical", "minor"]
    },
    resultKey: `${input.type}-minor`,
    resultRow: "Minor"
  };
}

export function determineEncounterCriticalEscalation(input: {
  resolution: EncounterAttackResolution;
}): {
  criticalPending: boolean;
  criticalType: EncounterCriticalType;
  provisionalRuleLabel: string;
  triggerDamage: number;
  triggerThreshold: number;
} {
  const resolution = parseResolution(input.resolution);
  const triggerDamage = resolution.damage?.finalDamage ?? 0;

  return {
    criticalPending: triggerDamage >= PROVISIONAL_CRITICAL_TRIGGER_DAMAGE_THRESHOLD,
    criticalType: getCriticalType(resolution),
    provisionalRuleLabel: PROVISIONAL_CRITICAL_RULE_LABEL,
    triggerDamage,
    triggerThreshold: PROVISIONAL_CRITICAL_TRIGGER_DAMAGE_THRESHOLD
  };
}

export function resolveEncounterCritical(input: {
  criticalRoll: number;
  resolution: EncounterAttackResolution;
}): ResolveEncounterCriticalResult {
  const resolution = parseResolution(input.resolution);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (resolution.outcome !== "critical-pending") {
    errors.push("Only critical-pending results can be resolved for critical effects.");
  }

  if (resolution.critical?.status !== "pending") {
    errors.push("Critical resolution requires a pending critical state.");
  }

  if (errors.length > 0) {
    return {
      errors,
      warnings
    };
  }

  const roll = clampPercentileRoll(input.criticalRoll);
  const baseModifier = resolution.damage?.finalDamage ?? 0;
  const locationModifier = getLocationModifier(resolution);
  const totalModifier = baseModifier + locationModifier;
  const finalRoll = roll + totalModifier;
  const type = resolution.critical?.type ?? getCriticalType(resolution);
  const { effect, resultKey, resultRow } = buildCriticalEffectSummary({
    finalRoll,
    type
  });

  warnings.push(PROVISIONAL_CRITICAL_RULE_LABEL);

  return {
    errors: [],
    resolution: parseResolution({
      ...resolution,
      critical: {
        ...resolution.critical,
        effect,
        provisionalRuleLabel: PROVISIONAL_CRITICAL_RULE_LABEL,
        roll: {
          baseModifier,
          finalRoll,
          locationModifier,
          resultKey,
          resultRow,
          roll,
          totalModifier
        },
        status: "resolved",
        triggerDamage: resolution.critical?.triggerDamage ?? resolution.damage?.finalDamage ?? 0,
        triggerThreshold:
          resolution.critical?.triggerThreshold ?? PROVISIONAL_CRITICAL_TRIGGER_DAMAGE_THRESHOLD,
        type
      },
      outcome: "critical-resolved"
    }),
    warnings
  };
}
