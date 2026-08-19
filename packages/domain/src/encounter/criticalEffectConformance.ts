import {
  getCriticalEffectProposalProjection,
  type CriticalEffectProposalProjection,
} from "./criticalEffectProposal";
import {
  CRITICAL_EFFECTS_TABLE,
  type CriticalEffectTemplate,
  type CriticalResult,
} from "./criticalEffectsTable";

export const CRITICAL_EFFECT_MAPPING_STATUSES = [
  "mapped",
  "projection_only",
  "mechanically_unmapped",
  "deferred_rule_decision",
  "provenance_only",
] as const;

export type CriticalEffectMappingStatus = (typeof CRITICAL_EFFECT_MAPPING_STATUSES)[number];

export const CRITICAL_CONSEQUENCE_FAMILIES = [
  "stun",
  "action_state",
  "loss_of_use",
  "mobility",
  "external_bleed",
  "internal_bleed",
  "item_control",
  "structural_anatomical",
  "sensory_communication",
  "lasting_deficit",
  "terminal_marker",
  "minimum_damage_floor",
  "other",
] as const;

export type CriticalConsequenceFamily = (typeof CRITICAL_CONSEQUENCE_FAMILIES)[number];

export interface CriticalEffectConformanceEntry {
  actionState?: string;
  consequenceFamilies: readonly CriticalConsequenceFamily[];
  critKey: string;
  diagnostic: string;
  durationRoll?: string;
  durationMode: string;
  durationRaw?: string;
  durationUnit?: string;
  durationValue?: number;
  endTrigger?: string;
  effectKey: string;
  group: string;
  implementationNote?: string;
  mappingStatus: CriticalEffectMappingStatus;
  numericPenalty?: number;
  proposalProjection: string;
  rateMode: string;
  rateRaw?: string;
  rateRollFormula?: string;
  rateValuePerRound?: number;
  requiresExtension: boolean;
  sourceField?: string;
  sourceValue?: string;
  specialFlag?: string;
  subtype: string;
  target: string;
  type: string;
}

export interface CriticalResultFlagReconciliation {
  evidenceBasis: string;
  effectRows: number;
  evidencedResults: number;
  flag:
    | "hasBalance"
    | "hasStun"
    | "hasExternalBleed"
    | "hasInternalBleed"
    | "hasLossOfUse"
    | "hasSpecial";
  flaggedResults: number;
  mismatchedCritKeys: readonly string[];
}

export interface CriticalEffectConformanceReport {
  completeEffectInventory: boolean;
  duplicateEffectKeys: readonly string[];
  effectEntries: readonly CriticalEffectConformanceEntry[];
  familyCounts: Readonly<Record<CriticalConsequenceFamily, number>>;
  resultCount: number;
  resultFlagReconciliation: readonly CriticalResultFlagReconciliation[];
  statusCounts: Readonly<Record<CriticalEffectMappingStatus, number>>;
  uniqueEffectCount: number;
}

function projectionLabel(projection: CriticalEffectProposalProjection): string {
  return `${projection.representation}:${projection.rowCategory}`;
}

function normalizedEffectText(effect: CriticalEffectTemplate): string {
  return [
    effect.type,
    effect.group,
    effect.subtype,
    effect.target,
    effect.actionState,
    effect.specialFlag,
    effect.sourceField,
    effect.sourceValue,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
}

function classifyConsequenceFamilies(
  effect: CriticalEffectTemplate,
): readonly CriticalConsequenceFamily[] {
  const families = new Set<CriticalConsequenceFamily>();
  const text = normalizedEffectText(effect);

  if (effect.type === "Stun") families.add("stun");
  if (effect.actionState) families.add("action_state");
  if (effect.subtype === "loss_of_use") families.add("loss_of_use");
  if (
    effect.group === "Mobility" ||
    effect.subtype === "balance_or_stance" ||
    effect.actionState === "cannot_use_for_mobility"
  ) {
    families.add("mobility");
  }
  if (effect.type === "Bleed") families.add("external_bleed");
  if (effect.type === "Internal bleed") families.add("internal_bleed");
  if (/drop_item|weapon_stuck|equipment_damage|drop (?:item|weapon)/.test(text)) {
    families.add("item_control");
  }
  if (
    /amputation|anatom|transfix|crush|ruined|organ|heart|vessel|embedded|extraction|spinal|thoracic|pelvic|abdominal|airway|breathing|burn|maiming/.test(
      text,
    )
  ) {
    families.add("structural_anatomical");
  }
  if (/blind|\beye\b|vision|deaf|hearing|speech/.test(text)) {
    families.add("sensory_communication");
  }
  if (
    effect.durationMode === "mixed_until_treated_then_permanent" ||
    /permanent|scar|maiming|blind|ruined|paralysis|brain_damage|insanity|manual_skill/.test(text)
  ) {
    families.add("lasting_deficit");
  }
  if (
    effect.durationMode === "death_timer_special" ||
    effect.rateMode === "death_timer" ||
    /death|dying|mortal|rapidly_dying/.test(text)
  ) {
    families.add("terminal_marker");
  }
  if (effect.subtype === "minimum_damage_floor") families.add("minimum_damage_floor");
  if (families.size === 0) families.add("other");

  return CRITICAL_CONSEQUENCE_FAMILIES.filter((family) => families.has(family));
}

function isDeferredNumericDeficit(effect: CriticalEffectTemplate): boolean {
  return Boolean(
    effect.specialFlag &&
    /^(?:permanent_.+_loss|permanent_half_all_characteristics|scar_loss_fel)$/.test(
      effect.specialFlag,
    ),
  );
}

function classifyMapping(input: {
  effect: CriticalEffectTemplate;
  families: readonly CriticalConsequenceFamily[];
  projection: CriticalEffectProposalProjection;
}): Pick<CriticalEffectConformanceEntry, "diagnostic" | "mappingStatus" | "requiresExtension"> {
  const { effect, families, projection } = input;

  if (projection.rowCategory === "physical_damage") {
    return {
      diagnostic:
        "Preserved as the proposal-level minimum total damage floor; no duplicate effect row is emitted.",
      mappingStatus: "provenance_only",
      requiresExtension: false,
    };
  }

  if (families.includes("terminal_marker")) {
    return {
      diagnostic:
        "Terminal marker is retained as source evidence; terminal/death semantics require a separate approved rule decision.",
      mappingStatus: "deferred_rule_decision",
      requiresExtension: false,
    };
  }

  if (isDeferredNumericDeficit(effect)) {
    return {
      diagnostic:
        "Authored permanent numeric deficit is retained as source evidence; characteristic conversion remains an approved deferred rule decision.",
      mappingStatus: "deferred_rule_decision",
      requiresExtension: false,
    };
  }

  if (effect.type === "Stun") {
    return {
      diagnostic:
        "Stun facts are retained, but authored -1/-2/-4/-8 interpretation, stacking, and cause-specific recovery remain unresolved.",
      mappingStatus: "deferred_rule_decision",
      requiresExtension: false,
    };
  }

  if (effect.type === "Bleed" || effect.type === "Internal bleed") {
    return {
      diagnostic:
        "Typed bleed projection preserves the authored rate facts; unit/time arithmetic remains a separate deferred rule decision.",
      mappingStatus: "mapped",
      requiresExtension: false,
    };
  }

  if (projection.representation === "operational_consequence") {
    return {
      diagnostic:
        "Source fact reaches a GM-reviewable operational projection, but durable item-control semantics are not implemented.",
      mappingStatus: "projection_only",
      requiresExtension: true,
    };
  }

  if (projection.representation === "review_effect" && projection.kind === "modifier") {
    return {
      diagnostic: "Numeric source penalty maps to a typed modifier proposal and runtime bucket.",
      mappingStatus: "mapped",
      requiresExtension: false,
    };
  }

  if (projection.rowCategory === "no_combat_action" || projection.rowCategory === "loss_of_use") {
    return {
      diagnostic:
        "Source fact reaches a visible typed review row, but general ongoing action/function enforcement is not implemented.",
      mappingStatus: "projection_only",
      requiresExtension: true,
    };
  }

  return {
    diagnostic:
      "Mechanically meaningful source fact currently degrades to a generic special/note row and requires an explicit model/consumer extension.",
    mappingStatus: "mechanically_unmapped",
    requiresExtension: true,
  };
}

export function classifyCriticalEffectConformance(
  effect: CriticalEffectTemplate,
): CriticalEffectConformanceEntry {
  const proposalProjection = getCriticalEffectProposalProjection(effect);
  const consequenceFamilies = classifyConsequenceFamilies(effect);
  const mapping = classifyMapping({
    effect,
    families: consequenceFamilies,
    projection: proposalProjection,
  });

  return {
    actionState: effect.actionState,
    consequenceFamilies,
    critKey: effect.critKey,
    diagnostic: mapping.diagnostic,
    durationMode: effect.durationMode,
    durationRaw: effect.durationRaw,
    durationRoll: effect.durationRoll,
    durationUnit: effect.durationUnit,
    durationValue: effect.durationValue,
    endTrigger: effect.endTrigger,
    effectKey: effect.effectKey,
    group: effect.group,
    implementationNote: effect.implementationNote,
    mappingStatus: mapping.mappingStatus,
    numericPenalty: effect.penaltyPct,
    proposalProjection: projectionLabel(proposalProjection),
    rateMode: effect.rateMode,
    rateRaw: effect.rateRaw,
    rateRollFormula: effect.rateRollFormula,
    rateValuePerRound: effect.rateValuePerRound,
    requiresExtension: mapping.requiresExtension,
    sourceField: effect.sourceField,
    sourceValue: effect.sourceValue,
    specialFlag: effect.specialFlag,
    subtype: effect.subtype,
    target: effect.target,
    type: effect.type,
  };
}

const RESULT_FLAG_SPECS = [
  {
    evidenceBasis: "balance_penalty effect rows",
    evidence: (effect: CriticalEffectTemplate) => effect.sourceField === "balance_penalty",
    flag: "hasBalance" as const,
  },
  {
    evidenceBasis: "Stun effect rows",
    evidence: (effect: CriticalEffectTemplate) => effect.type === "Stun",
    flag: "hasStun" as const,
  },
  {
    evidenceBasis: "external Bleed effect rows",
    evidence: (effect: CriticalEffectTemplate) => effect.type === "Bleed",
    flag: "hasExternalBleed" as const,
  },
  {
    evidenceBasis: "Internal bleed effect rows",
    evidence: (effect: CriticalEffectTemplate) => effect.type === "Internal bleed",
    flag: "hasInternalBleed" as const,
  },
  {
    evidenceBasis: "loss_of_use effect rows",
    evidence: (effect: CriticalEffectTemplate) => effect.subtype === "loss_of_use",
    flag: "hasLossOfUse" as const,
  },
  {
    evidenceBasis: "special_tags effect rows or preserved result sourceSpecialTags",
    evidence: (effect: CriticalEffectTemplate) => effect.sourceField === "special_tags",
    flag: "hasSpecial" as const,
    resultEvidence: (result: CriticalResult, effects: readonly CriticalEffectTemplate[]) =>
      result.sourceSpecialTags.length > 0 || effects.some((effect) => effect.type === "Special"),
  },
];

function reconcileResultFlags(input: {
  effects: readonly CriticalEffectTemplate[];
  results: readonly CriticalResult[];
}): readonly CriticalResultFlagReconciliation[] {
  const effectsByCritKey = new Map<string, CriticalEffectTemplate[]>();

  for (const effect of input.effects) {
    const effects = effectsByCritKey.get(effect.critKey) ?? [];
    effects.push(effect);
    effectsByCritKey.set(effect.critKey, effects);
  }

  return RESULT_FLAG_SPECS.map((spec) => {
    const mismatchedCritKeys: string[] = [];
    let evidencedResults = 0;

    for (const result of input.results) {
      const effects = effectsByCritKey.get(result.critKey) ?? [];
      const evidenced =
        "resultEvidence" in spec && spec.resultEvidence
          ? spec.resultEvidence(result, effects)
          : effects.some(spec.evidence);
      if (evidenced) evidencedResults += 1;
      if (result[spec.flag] !== evidenced) mismatchedCritKeys.push(result.critKey);
    }

    return {
      evidenceBasis: spec.evidenceBasis,
      effectRows: input.effects.filter(spec.evidence).length,
      evidencedResults,
      flag: spec.flag,
      flaggedResults: input.results.filter((result) => result[spec.flag]).length,
      mismatchedCritKeys: mismatchedCritKeys.sort(),
    };
  });
}

function duplicateKeys(keys: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();

  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort();
}

export function buildCriticalEffectConformanceReport(
  input: {
    effects?: readonly CriticalEffectTemplate[];
    results?: readonly CriticalResult[];
  } = {},
): CriticalEffectConformanceReport {
  const effects = input.effects ?? CRITICAL_EFFECTS_TABLE.effectTemplates;
  const results = input.results ?? CRITICAL_EFFECTS_TABLE.criticalResults;
  const duplicateEffectKeys = duplicateKeys(effects.map((effect) => effect.effectKey));
  const effectEntries = effects
    .map(classifyCriticalEffectConformance)
    .sort((left, right) =>
      left.effectKey < right.effectKey ? -1 : left.effectKey > right.effectKey ? 1 : 0,
    );
  const uniqueEffectCount = new Set(effectEntries.map((entry) => entry.effectKey)).size;
  const statusCounts = Object.fromEntries(
    CRITICAL_EFFECT_MAPPING_STATUSES.map((status) => [
      status,
      effectEntries.filter((entry) => entry.mappingStatus === status).length,
    ]),
  ) as Record<CriticalEffectMappingStatus, number>;
  const familyCounts = Object.fromEntries(
    CRITICAL_CONSEQUENCE_FAMILIES.map((family) => [
      family,
      effectEntries.filter((entry) => entry.consequenceFamilies.includes(family)).length,
    ]),
  ) as Record<CriticalConsequenceFamily, number>;
  const resultFlagReconciliation = reconcileResultFlags({ effects, results });

  return {
    completeEffectInventory:
      duplicateEffectKeys.length === 0 &&
      uniqueEffectCount === effects.length &&
      resultFlagReconciliation.every((entry) => entry.mismatchedCritKeys.length === 0),
    duplicateEffectKeys,
    effectEntries,
    familyCounts,
    resultCount: results.length,
    resultFlagReconciliation,
    statusCounts,
    uniqueEffectCount,
  };
}
