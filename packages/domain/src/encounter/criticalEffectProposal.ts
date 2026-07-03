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
  getFinalCriticalRollIndexStatus,
  mapCombatHitLocationToCriticalLocation,
  mapFinalCriticalRollToCritIndex,
  mapWeaponCriticalInputToFamily,
  type CriticalMappingResult,
  type FinalCriticalRollIndexStatus,
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
  criticalIndexStatus?: FinalCriticalRollIndexStatus["status"];
  critIndex?: number;
  critKey?: string;
  family?: CriticalFamily;
  location?: CriticalLocationScope;
  minDamageReason?: string;
  minTotalDamage?: number;
  rollReports: readonly CriticalEffectProposalRollReport[];
  title?: string;
  warnings: readonly string[];
}

export type CriticalEffectProposalRowCategory =
  | "general_modifier"
  | "ob_skill_modifier"
  | "db_parry_modifier"
  | "fatigue"
  | "bleed"
  | "internal_bleed"
  | "no_combat_action"
  | "loss_of_use"
  | "dropped_item"
  | "special_note"
  | "physical_damage";

export interface CriticalEffectProposalAdditionalEffect {
  accepted?: boolean;
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
  rateValuePerRound?: number;
  rowCategory?: CriticalEffectProposalRowCategory;
  rollReports?: readonly CriticalEffectProposalRollReport[];
  sourceCritKey?: string;
  sourceEffectKey?: string;
  sourceText?: string;
  sourceKind?: "critical_table";
}

export interface CriticalEffectProposalResult {
  criticalIndexStatus: FinalCriticalRollIndexStatus["status"];
  criticalResult?: {
    bodyText: string;
    critIndex: number;
    critKey: string;
    family: CriticalFamily;
    location: CriticalLocationScope;
    title: string;
  };
  minDamageReason?: string;
  minTotalDamage?: number;
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
  if (result.status === "ambiguous" || result.status === "unsupported") {
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

  if (!Number.isInteger(count) || count < 1 || count > 20 || !SUPPORTED_DICE_SIDES.has(sides)) {
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

function normalizeEffectText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function formatCriticalEffectActionState(effect: CriticalEffectTemplate): string | undefined {
  const actionState = normalizeEffectText(effect.actionState);
  const sourceValue = normalizeEffectText(effect.sourceValue);

  if (actionState === "unconscious" || sourceValue?.toUpperCase() === "UNCONSCIOUS") {
    return "Unconscious";
  }

  if (actionState === "collapse") {
    return "Collapse";
  }

  if (actionState === "no_action" || sourceValue?.toUpperCase() === "NO ACTION") {
    return "No combat action possible";
  }

  if (actionState === "parry_only") {
    return "Action limited to parry";
  }

  if (actionState === "impaired") {
    return "Combat action impaired";
  }

  return actionState;
}

function buildEffectNotes(input: {
  effect: CriticalEffectTemplate;
  existingCommittedDamageAmount: number;
  rollReports: readonly CriticalEffectProposalRollReport[];
}): string {
  const details: string[] = [];
  const actionState = formatCriticalEffectActionState(input.effect);
  const durationReport = input.rollReports.find((report) => report.purpose === "duration");
  const rateReport = input.rollReports.find((report) => report.purpose === "rate");
  const formatRollReport = (report: CriticalEffectProposalRollReport): string => {
    const purpose = report.purpose.charAt(0).toUpperCase() + report.purpose.slice(1);
    const rolls = report.rolls.length > 1 ? ` (${report.rolls.join(" + ")})` : "";

    return `${purpose} roll ${report.formula} = ${report.total}${rolls}.`;
  };

  if (input.effect.type === "Bleed" || input.effect.type === "Internal bleed") {
    const bleedLabel = input.effect.type === "Internal bleed" ? "Internal bleed" : "Bleed";
    const rate =
      rateReport !== undefined
        ? `${rateReport.total}/10 HP / round`
        : normalizeEffectText(input.effect.rateRaw);

    details.push(rate ? `${bleedLabel}: ${rate}` : bleedLabel);
  } else if (actionState) {
    details.push(actionState.endsWith(".") ? actionState : `${actionState}.`);
  } else if (input.effect.subtype === "loss_of_use") {
    const target = normalizeEffectText(input.effect.target);

    details.push(
      target
        ? `Loss of use: no actions with affected ${target}.`
        : "Loss of use: no actions with affected body part.",
    );
  } else if (input.effect.specialFlag) {
    details.push(input.effect.specialFlag.replace(/_/g, " "));
  } else if (input.effect.sourceValue) {
    details.push(input.effect.sourceValue);
  }

  if (
    input.effect.implementationNote &&
    input.effect.type !== "Stun" &&
    input.effect.type !== "Bleed" &&
    input.effect.type !== "Internal bleed" &&
    input.effect.subtype !== "loss_of_use" &&
    input.effect.subtype !== "minimum_damage_floor" &&
    !input.effect.specialFlag
  ) {
    details.push(input.effect.implementationNote);
  }

  if (
    input.effect.durationRaw &&
    !durationReport &&
    input.effect.durationRaw.toLowerCase() !== "instant"
  ) {
    details.push(`Duration: ${input.effect.durationRaw}`);
  }

  if (
    input.effect.rateRaw &&
    !rateReport &&
    input.effect.type !== "Bleed" &&
    input.effect.type !== "Internal bleed"
  ) {
    details.push(`Rate: ${input.effect.rateRaw}`);
  }

  if (input.effect.treatmentGate) {
    details.push(
      input.effect.treatmentGate.endsWith(".")
        ? input.effect.treatmentGate
        : `${input.effect.treatmentGate}.`,
    );
  }

  if (input.effect.minTotalDamage !== undefined) {
    const difference = input.effect.minTotalDamage - input.existingCommittedDamageAmount;

    details.push(
      difference > 0
        ? `Minimum total damage floor ${input.effect.minTotalDamage}; commit raises physical damage by ${difference} if no GM override is final.`
        : `Minimum total damage floor ${input.effect.minTotalDamage} is covered by current committed damage ${input.existingCommittedDamageAmount}.`,
    );
  }

  for (const report of input.rollReports) {
    details.push(formatRollReport(report));
  }

  return details.join(" ");
}

function criticalEffectDurationBeginsNextRound(effect: CriticalEffectTemplate): boolean {
  const text = [
    effect.durationRaw,
    effect.sourceValue,
    effect.implementationNote,
    effect.treatmentGate,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" ")
    .toLowerCase();

  if (/\b(this|current)\s+round\b/.test(text) || /until end of (?:the )?current round/.test(text)) {
    return false;
  }

  return /\bnext\s+(?:round|d\d+\s+rounds?|\d+\s+rounds?)\b/.test(text);
}

export function getCriticalEffectStoredDurationRounds(
  effect: CriticalEffectTemplate,
  rollReports: readonly CriticalEffectProposalRollReport[],
): number | undefined {
  const durationReport = rollReports.find((report) => report.purpose === "duration");
  let durationRounds: number | undefined;

  if (durationReport) {
    durationRounds = durationReport.total;
  } else if (
    effect.durationMode === "fixed" &&
    effect.durationValue !== undefined &&
    effect.durationUnit?.toLowerCase().includes("round")
  ) {
    durationRounds = effect.durationValue;
  } else if (criticalEffectDurationBeginsNextRound(effect)) {
    durationRounds = 1;
  }

  if (durationRounds === undefined) {
    return undefined;
  }

  return criticalEffectDurationBeginsNextRound(effect) ? durationRounds + 1 : durationRounds;
}

function getCriticalEffectLabel(effect: CriticalEffectTemplate): string {
  const actionState = formatCriticalEffectActionState(effect);

  if (effect.type === "Stun" && actionState) {
    return actionState === "Unconscious" ? "Unconscious - no combat action possible" : actionState;
  }

  if (effect.type === "Bleed") {
    return "Bleed";
  }

  if (effect.type === "Internal bleed") {
    return "Internal bleed";
  }

  if (effect.subtype === "loss_of_use") {
    return "Loss of use";
  }

  if (effect.specialFlag) {
    return effect.specialFlag.replace(/_/g, " ");
  }

  if (effect.subtype && effect.subtype !== "none") {
    return effect.subtype
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return effect.type;
}

function getCriticalEffectRateValuePerRound(
  effect: CriticalEffectTemplate,
  rollReports: readonly CriticalEffectProposalRollReport[],
): number | undefined {
  const rateReport = rollReports.find((report) => report.purpose === "rate");

  if (rateReport) {
    return rateReport.total;
  }

  return effect.rateValuePerRound;
}

function isCriticalEffectMinimumDamageFloor(effect: CriticalEffectTemplate): boolean {
  return effect.type === "Physical" && effect.subtype === "minimum_damage_floor";
}

function isCriticalEffectDropItemTag(effect: CriticalEffectTemplate): boolean {
  return effect.specialFlag === "drop_item" || effect.sourceValue?.toLowerCase() === "drop_item";
}

function criticalEffectBlocksOrLimitsAction(effect: CriticalEffectTemplate): boolean {
  const actionState = effect.actionState?.toLowerCase();
  const sourceValue = effect.sourceValue?.toUpperCase();
  const text = [
    effect.actionState,
    effect.durationRaw,
    effect.specialFlag,
    effect.sourceField,
    effect.sourceValue,
    effect.implementationNote,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" ")
    .toLowerCase();

  return Boolean(
    actionState === "no_action" ||
    actionState === "no_meaningful_action" ||
    actionState === "unconscious" ||
    actionState === "collapse" ||
    actionState === "parry_only" ||
    sourceValue === "NO ACTION" ||
    text.includes("unconscious") ||
    text.includes("no action") ||
    text.includes("may do nothing") ||
    text.includes("parry only") ||
    text.includes("collapse"),
  );
}

function mapCriticalEffectTemplateToReviewEffect(input: {
  effect: CriticalEffectTemplate;
  existingCommittedDamageAmount: number;
  rollReports: readonly CriticalEffectProposalRollReport[];
}): CriticalEffectProposalAdditionalEffect | undefined {
  const modifierValue = normalizePenalty(input.effect.penaltyPct);
  const common = {
    accepted: true,
    durationRounds: getCriticalEffectStoredDurationRounds(input.effect, input.rollReports),
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
    sourceText: input.effect.sourceValue,
    sourceKind: "critical_table" as const,
  };

  if (isCriticalEffectMinimumDamageFloor(input.effect)) {
    return undefined;
  }

  if (isCriticalEffectDropItemTag(input.effect)) {
    return undefined;
  }

  if (input.effect.type === "Bleed") {
    return {
      ...common,
      kind: "special",
      label: "Bleed",
      rateValuePerRound: getCriticalEffectRateValuePerRound(input.effect, input.rollReports),
      rowCategory: "bleed",
    };
  }

  if (input.effect.type === "Internal bleed") {
    return {
      ...common,
      kind: "special",
      label: "Internal bleed",
      rateValuePerRound: getCriticalEffectRateValuePerRound(input.effect, input.rollReports),
      rowCategory: "internal_bleed",
    };
  }

  if (input.effect.type === "Stun" && criticalEffectBlocksOrLimitsAction(input.effect)) {
    return {
      ...common,
      kind: "special",
      label: common.label || "No combat action possible",
      rowCategory: "no_combat_action",
    };
  }

  if (input.effect.subtype === "loss_of_use") {
    return {
      ...common,
      kind: "special",
      label: common.label || "Loss of use",
      rowCategory: "loss_of_use",
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
        rowCategory: "ob_skill_modifier",
      };
    }

    if (input.effect.group === "DB") {
      return {
        ...common,
        kind: "modifier",
        label: common.label || "DB modifier",
        modifierBucket: "db",
        modifierValue,
        rowCategory: "db_parry_modifier",
      };
    }

    if (input.effect.group === "General") {
      return {
        ...common,
        kind: "modifier",
        label: common.label || "General modifier",
        modifierBucket: "general",
        modifierValue,
        rowCategory: "general_modifier",
      };
    }

    if (input.effect.type === "Stun") {
      return {
        ...common,
        kind: "modifier",
        label: common.label || "Stunned",
        modifierBucket: "general",
        modifierValue,
        rowCategory: "general_modifier",
      };
    }
  }

  return {
    ...common,
    kind: input.effect.type === "Special" ? "special" : "note",
    rowCategory: "special_note",
  };
}

export function buildCriticalEffectProposalFromDamageResult(
  input: CriticalEffectProposalInput,
): CriticalEffectProposalResult {
  const warnings: string[] = [];
  const criticalIndexStatus = getFinalCriticalRollIndexStatus(input.finalCriticalRoll);

  if (criticalIndexStatus.status === "no_effect") {
    return {
      criticalIndexStatus: criticalIndexStatus.status,
      proposedEffects: [],
      rollReports: [],
      warnings,
    };
  }

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
      criticalIndexStatus: criticalIndexStatus.status,
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
      criticalIndexStatus: criticalIndexStatus.status,
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
  let minTotalDamage: number | undefined;
  let minDamageReason: string | undefined;
  const proposedEffects = resultWithEffects.effects.flatMap((effect) => {
    if (
      isCriticalEffectMinimumDamageFloor(effect) &&
      effect.minTotalDamage !== undefined &&
      (minTotalDamage === undefined || effect.minTotalDamage > minTotalDamage)
    ) {
      minTotalDamage = effect.minTotalDamage;
      minDamageReason = effect.minDamageReason;
    }

    const effectRollReports = getEffectRollReports({ effect, rng, warnings });
    rollReports.push(...effectRollReports);
    const reviewEffect = mapCriticalEffectTemplateToReviewEffect({
      effect,
      existingCommittedDamageAmount: input.existingCommittedDamageAmount,
      rollReports: effectRollReports,
    });

    return reviewEffect ? [reviewEffect] : [];
  });

  return {
    criticalIndexStatus: criticalIndexStatus.status,
    criticalResult: {
      bodyText: resultWithEffects.result.bodyText,
      critIndex: resultWithEffects.result.critIndex,
      critKey: resultWithEffects.result.critKey,
      family: resultWithEffects.result.family,
      location: resultWithEffects.result.location,
      title: resultWithEffects.result.title,
    },
    minDamageReason,
    minTotalDamage,
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
    criticalIndexStatus: proposal.criticalIndexStatus,
    critIndex: proposal.criticalResult?.critIndex,
    critKey: proposal.criticalResult?.critKey,
    family: proposal.criticalResult?.family,
    location: proposal.criticalResult?.location,
    minDamageReason: proposal.minDamageReason,
    minTotalDamage: proposal.minTotalDamage,
    rollReports: proposal.rollReports,
    title: proposal.criticalResult?.title,
    warnings: proposal.warnings,
  };
}
