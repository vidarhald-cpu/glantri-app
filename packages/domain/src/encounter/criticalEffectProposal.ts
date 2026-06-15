import type { HitLocation } from "./hitLocation";
import {
  getCriticalEffectRollRequirements,
  getCriticalResultWithEffects,
  type CriticalEffectRollRequirement,
  type CriticalEffectTemplate,
  type CriticalFamily,
  type CriticalLocationScope,
} from "./criticalEffectsTable";
import {
  mapCombatHitLocationToCriticalLocation,
  mapFinalCriticalRollToCritIndex,
  mapWeaponCriticalInputToFamily,
  type CriticalMappingResult,
} from "./criticalEffectMapping";

export interface CriticalEffectProposalRollReport {
  effectKey: string;
  formula: string;
  purpose: CriticalEffectRollRequirement["purpose"];
  rolls: readonly number[];
  sourceField: CriticalEffectRollRequirement["sourceField"];
  total: number;
}

export interface CriticalEffectProposalSummary {
  bodyText?: string;
  critIndex?: number;
  critKey?: string;
  family?: CriticalFamily;
  location?: CriticalLocationScope;
  rollReports: readonly CriticalEffectProposalRollReport[];
  title?: string;
  warnings: readonly string[];
}

export interface CriticalEffectProposalAdditionalEffect {
  durationRounds?: number;
  effectOrder?: number;
  id: string;
  kind: "modifier" | "fatigue" | "special" | "note";
  label: string;
  minDamageReason?: string;
  minTotalDamage?: number;
  modifierBucket?: "general" | "obSkill" | "db";
  modifierValue?: number;
  notes?: string;
  phase?: "phase1" | "phase2" | "round" | "untilCleared";
  rollReports?: readonly CriticalEffectProposalRollReport[];
  sourceCritKey?: string;
  sourceEffectKey?: string;
  sourceKind?: "critical_table";
}

export interface CriticalEffectProposalResult {
  criticalResult?: {
    bodyText: string;
    critIndex: number;
    critKey: string;
    family: CriticalFamily;
    location: CriticalLocationScope;
    title: string;
  };
  proposedEffects: readonly CriticalEffectProposalAdditionalEffect[];
  rollReports: readonly CriticalEffectProposalRollReport[];
  warnings: readonly string[];
}

export interface CriticalEffectProposalInput {
  existingCommittedDamageAmount: number;
  finalCriticalRoll?: number;
  rng?: () => number;
  selectedHitLocation?: HitLocation;
  weaponCriticalCode?: string;
  weaponDamageClass?: string | null;
}

const SUPPORTED_DICE_SIDES = new Set([3, 4, 6, 8, 10, 20]);

function addMappingWarning(
  label: string,
  result: CriticalMappingResult<unknown>,
  warnings: string[],
) {
  if (result.status !== "mapped") {
    warnings.push(`${label}: ${result.reason}`);
  }
}

function rollClosedDie(sides: number, rng: () => number): number {
  return Math.min(sides, Math.max(1, Math.floor(rng() * sides) + 1));
}

function rollFormula(input: {
  effectKey: string;
  formula: string;
  purpose: CriticalEffectRollRequirement["purpose"];
  rng: () => number;
  sourceField: CriticalEffectRollRequirement["sourceField"];
}): CriticalEffectProposalRollReport | undefined {
  const match = /^(\d*)d(\d+)$/i.exec(input.formula.trim());

  if (!match) {
    return undefined;
  }

  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);

  if (
    !Number.isInteger(count) ||
    count < 1 ||
    count > 20 ||
    !SUPPORTED_DICE_SIDES.has(sides)
  ) {
    return undefined;
  }

  const rolls = Array.from({ length: count }, () => rollClosedDie(sides, input.rng));

  return {
    effectKey: input.effectKey,
    formula: `${count === 1 ? "" : count}d${sides}`,
    purpose: input.purpose,
    rolls,
    sourceField: input.sourceField,
    total: rolls.reduce((sum, roll) => sum + roll, 0),
  };
}

function getEffectRollReports(input: {
  effect: CriticalEffectTemplate;
  rng: () => number;
  warnings: string[];
}): CriticalEffectProposalRollReport[] {
  const reports: CriticalEffectProposalRollReport[] = [];
  const rolledRequirementKeys = new Set<string>();

  for (const requirement of getCriticalEffectRollRequirements(input.effect)) {
    const requirementKey = `${requirement.purpose}:${requirement.formula}`;

    if (rolledRequirementKeys.has(requirementKey)) {
      continue;
    }

    rolledRequirementKeys.add(requirementKey);

    const report = rollFormula({
      effectKey: input.effect.effectKey,
      formula: requirement.formula,
      purpose: requirement.purpose,
      rng: input.rng,
      sourceField: requirement.sourceField,
    });

    if (report) {
      reports.push(report);
    } else {
      input.warnings.push(
        `Critical effect ${input.effect.effectKey} contains unsupported roll formula '${requirement.formula}' in ${requirement.sourceField}.`,
      );
    }
  }

  return reports;
}

function normalizePenalty(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value > 0 ? -value : value;
}

function buildEffectNotes(input: {
  effect: CriticalEffectTemplate;
  existingCommittedDamageAmount: number;
  rollReports: readonly CriticalEffectProposalRollReport[];
}): string {
  const details: string[] = [];

  if (input.effect.sourceValue) {
    details.push(input.effect.sourceValue);
  }

  if (input.effect.implementationNote) {
    details.push(input.effect.implementationNote);
  }

  if (input.effect.durationRaw) {
    details.push(`Duration: ${input.effect.durationRaw}`);
  }

  if (input.effect.rateRaw) {
    details.push(`Rate: ${input.effect.rateRaw}`);
  }

  if (input.effect.treatmentGate) {
    details.push(`Treatment: ${input.effect.treatmentGate}`);
  }

  if (input.effect.minTotalDamage !== undefined) {
    const difference = input.effect.minTotalDamage - input.existingCommittedDamageAmount;

    details.push(
      difference > 0
        ? `Minimum total damage floor ${input.effect.minTotalDamage}; current committed damage is ${input.existingCommittedDamageAmount}, so the GM may add ${difference} damage if appropriate.`
        : `Minimum total damage floor ${input.effect.minTotalDamage} is covered by current committed damage ${input.existingCommittedDamageAmount}.`,
    );
  }

  for (const report of input.rollReports) {
    details.push(
      `${report.purpose} roll ${report.formula}: ${report.rolls.join(" + ")} = ${report.total}`,
    );
  }

  details.push(`Source: ${input.effect.effectKey}`);

  return details.join(" ");
}

function getDraftDurationRounds(
  effect: CriticalEffectTemplate,
  rollReports: readonly CriticalEffectProposalRollReport[],
): number | undefined {
  const durationReport = rollReports.find((report) => report.purpose === "duration");

  if (durationReport) {
    return durationReport.total;
  }

  if (
    effect.durationMode === "fixed" &&
    effect.durationValue !== undefined &&
    effect.durationUnit?.toLowerCase().includes("round")
  ) {
    return effect.durationValue;
  }

  return undefined;
}

function getCriticalEffectLabel(effect: CriticalEffectTemplate): string {
  if (effect.specialFlag) {
    return effect.specialFlag;
  }

  if (effect.subtype && effect.subtype !== "none") {
    return effect.subtype
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return effect.type;
}

function mapCriticalEffectTemplateToReviewEffect(input: {
  effect: CriticalEffectTemplate;
  existingCommittedDamageAmount: number;
  rollReports: readonly CriticalEffectProposalRollReport[];
}): CriticalEffectProposalAdditionalEffect {
  const modifierValue = normalizePenalty(input.effect.penaltyPct);
  const common = {
    durationRounds: getDraftDurationRounds(input.effect, input.rollReports),
    effectOrder: input.effect.effectOrder,
    id: `critical-effect-${input.effect.effectKey.replace(/[^A-Za-z0-9_-]+/g, "-")}`,
    label: getCriticalEffectLabel(input.effect),
    minDamageReason: input.effect.minDamageReason,
    minTotalDamage: input.effect.minTotalDamage,
    notes: buildEffectNotes({
      effect: input.effect,
      existingCommittedDamageAmount: input.existingCommittedDamageAmount,
      rollReports: input.rollReports,
    }),
    rollReports: input.rollReports,
    sourceCritKey: input.effect.critKey,
    sourceEffectKey: input.effect.effectKey,
    sourceKind: "critical_table" as const,
  };

  if (input.effect.type === "Physical" && input.effect.subtype === "minimum_damage_floor") {
    return {
      ...common,
      kind: "note",
      label: `Minimum damage floor ${input.effect.minTotalDamage ?? ""}`.trim(),
    };
  }

  if (modifierValue !== undefined) {
    if (input.effect.group === "OB/Skill") {
      return {
        ...common,
        kind: "modifier",
        label: common.label || "OB/Skill modifier",
        modifierBucket: "obSkill",
        modifierValue,
      };
    }

    if (input.effect.group === "DB") {
      return {
        ...common,
        kind: "modifier",
        label: common.label || "DB modifier",
        modifierBucket: "db",
        modifierValue,
      };
    }

    if (input.effect.group === "General") {
      return {
        ...common,
        kind: "modifier",
        label: common.label || "General modifier",
        modifierBucket: "general",
        modifierValue,
      };
    }
  }

  if (input.effect.type === "Bleed" || input.effect.type === "Internal bleed") {
    return {
      ...common,
      kind: "special",
      label: input.effect.type,
    };
  }

  if (input.effect.type === "Stun") {
    return {
      ...common,
      kind: "special",
      label: input.effect.actionState || common.label || "Stun/action state",
    };
  }

  return {
    ...common,
    kind: input.effect.type === "Special" ? "special" : "note",
  };
}

export function buildCriticalEffectProposalFromDamageResult(
  input: CriticalEffectProposalInput,
): CriticalEffectProposalResult {
  const warnings: string[] = [];
  const family = mapWeaponCriticalInputToFamily({
    weaponCriticalCode: input.weaponCriticalCode,
    weaponDamageClass: input.weaponDamageClass,
  });
  const location = mapCombatHitLocationToCriticalLocation(input.selectedHitLocation);
  const critIndex = mapFinalCriticalRollToCritIndex(input.finalCriticalRoll);

  addMappingWarning("Critical family", family, warnings);
  addMappingWarning("Critical location", location, warnings);
  addMappingWarning("Critical index", critIndex, warnings);

  if (family.status !== "mapped" || location.status !== "mapped" || critIndex.status !== "mapped") {
    return {
      proposedEffects: [],
      rollReports: [],
      warnings,
    };
  }

  const resultWithEffects = getCriticalResultWithEffects(
    family.value,
    location.value,
    critIndex.value,
  );

  if (!resultWithEffects) {
    return {
      proposedEffects: [],
      rollReports: [],
      warnings: [
        ...warnings,
        `No critical table result exists for ${family.value}|${location.value}|${String(
          critIndex.value,
        ).padStart(2, "0")}.`,
      ],
    };
  }

  const rng = input.rng ?? Math.random;
  const rollReports: CriticalEffectProposalRollReport[] = [];
  const proposedEffects = resultWithEffects.effects.map((effect) => {
    const effectRollReports = getEffectRollReports({ effect, rng, warnings });
    rollReports.push(...effectRollReports);

    return mapCriticalEffectTemplateToReviewEffect({
      effect,
      existingCommittedDamageAmount: input.existingCommittedDamageAmount,
      rollReports: effectRollReports,
    });
  });

  return {
    criticalResult: {
      bodyText: resultWithEffects.result.bodyText,
      critIndex: resultWithEffects.result.critIndex,
      critKey: resultWithEffects.result.critKey,
      family: resultWithEffects.result.family,
      location: resultWithEffects.result.location,
      title: resultWithEffects.result.title,
    },
    proposedEffects,
    rollReports,
    warnings,
  };
}

export function buildCriticalEffectProposalSummary(
  proposal: CriticalEffectProposalResult,
): CriticalEffectProposalSummary {
  return {
    bodyText: proposal.criticalResult?.bodyText,
    critIndex: proposal.criticalResult?.critIndex,
    critKey: proposal.criticalResult?.critKey,
    family: proposal.criticalResult?.family,
    location: proposal.criticalResult?.location,
    rollReports: proposal.rollReports,
    title: proposal.criticalResult?.title,
    warnings: proposal.warnings,
  };
}
