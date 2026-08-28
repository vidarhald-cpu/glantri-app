import type {
  AccessBand,
  DevelopmentStage,
  PilotSkillAccessAvailability,
  PilotSkillAccessExceptionBasis,
} from "@glantri/domain";

import {
  assertPilotNonNegativeInteger,
  type PilotSkillBuildResult,
  type PilotSkillCompetencyDefinition,
} from "./pilotSkillRulesV1Contracts";

export interface PilotSkillAccessOverride {
  attributionId: string;
  availability: PilotSkillAccessAvailability;
  competencyId?: string;
  domainId?: string;
  explanation: string;
}

export interface PilotSkillAccessProfile {
  accessBand: AccessBand;
  competencyOverrides?: readonly PilotSkillAccessOverride[];
  defaultAvailability?: PilotSkillAccessAvailability;
  developmentStage: DevelopmentStage;
  domainOverrides?: readonly PilotSkillAccessOverride[];
  id: string;
}

export interface PilotSkillAccessException {
  attributionId: string;
  basis: PilotSkillAccessExceptionBasis;
  explanation: string;
}

export interface PilotSkillAccessResolution {
  accessBand: AccessBand;
  attributionId?: string;
  availability: PilotSkillAccessAvailability;
  competenceGranted: 0;
  developmentStage: DevelopmentStage;
  explanation: string;
  resolvedBy:
    | "competency-override"
    | "domain-override"
    | "profile-default"
    | "safe-restricted-fallback"
    | "accepted-exception";
}

function selectAccessOverride(
  overrides: readonly PilotSkillAccessOverride[],
  predicate: (override: PilotSkillAccessOverride) => boolean,
): PilotSkillAccessOverride | undefined {
  return [...overrides]
    .filter(predicate)
    .sort((left, right) => left.attributionId.localeCompare(right.attributionId))[0];
}

export function resolvePilotSkillAccess(input: {
  competencyId: string;
  domainId: string;
  exception?: PilotSkillAccessException;
  profile: PilotSkillAccessProfile;
}): PilotSkillAccessResolution {
  const competencyOverride = selectAccessOverride(
    input.profile.competencyOverrides ?? [],
    (override) => override.competencyId === input.competencyId,
  );
  const domainOverride = selectAccessOverride(
    input.profile.domainOverrides ?? [],
    (override) => override.domainId === input.domainId,
  );
  const base = competencyOverride
    ? {
        attributionId: competencyOverride.attributionId,
        availability: competencyOverride.availability,
        explanation: competencyOverride.explanation,
        resolvedBy: "competency-override" as const,
      }
    : domainOverride
      ? {
          attributionId: domainOverride.attributionId,
          availability: domainOverride.availability,
          explanation: domainOverride.explanation,
          resolvedBy: "domain-override" as const,
        }
      : input.profile.defaultAvailability
        ? {
            availability: input.profile.defaultAvailability,
            explanation: `Profile "${input.profile.id}" default applies.`,
            resolvedBy: "profile-default" as const,
          }
        : {
            availability: "restricted" as const,
            explanation: "Ambiguous or absent applicability authoring resolves restricted.",
            resolvedBy: "safe-restricted-fallback" as const,
          };

  if (base.availability !== "available" && input.exception) {
    return {
      accessBand: input.profile.accessBand,
      attributionId: input.exception.attributionId,
      availability: "available",
      competenceGranted: 0,
      developmentStage: input.profile.developmentStage,
      explanation: `${input.exception.explanation} This exception opens an acquisition route and grants no competence.`,
      resolvedBy: "accepted-exception",
    };
  }

  return {
    accessBand: input.profile.accessBand,
    attributionId: base.attributionId,
    availability: base.availability,
    competenceGranted: 0,
    developmentStage: input.profile.developmentStage,
    explanation: base.explanation,
    resolvedBy: base.resolvedBy,
  };
}

export interface PilotChargenBudgetConfiguration {
  flexBudget: number;
  formationBudget: number;
}

export interface PilotChargenPurchase {
  access: PilotSkillAccessAvailability;
  cost: number;
  formationEligible: boolean;
  id: string;
}

export interface PilotChargenBudgetResult {
  errors: Array<{
    code: "PILOT_SKILL_ACCESS_NOT_AVAILABLE" | "PILOT_SKILL_BUDGET_EXCEEDED";
    purchaseId?: string;
  }>;
  flexRemaining: number;
  flexSpent: number;
  formationRemaining: number;
  formationSpent: number;
  valid: boolean;
}

export function evaluatePilotChargenBudget(input: {
  configuration: PilotChargenBudgetConfiguration;
  purchases: readonly PilotChargenPurchase[];
}): PilotChargenBudgetResult {
  assertPilotNonNegativeInteger(input.configuration.formationBudget, "Formation budget");
  assertPilotNonNegativeInteger(input.configuration.flexBudget, "Flex budget");

  const errors: PilotChargenBudgetResult["errors"] = [];
  let formationEligibleCost = 0;
  let flexOnlyCost = 0;

  for (const purchase of input.purchases) {
    assertPilotNonNegativeInteger(purchase.cost, `Purchase "${purchase.id}" cost`);
    if (purchase.access !== "available") {
      errors.push({ code: "PILOT_SKILL_ACCESS_NOT_AVAILABLE", purchaseId: purchase.id });
      continue;
    }
    if (purchase.formationEligible) {
      formationEligibleCost += purchase.cost;
    } else {
      flexOnlyCost += purchase.cost;
    }
  }

  const formationSpent = Math.min(input.configuration.formationBudget, formationEligibleCost);
  const flexSpent = flexOnlyCost + formationEligibleCost - formationSpent;

  if (flexSpent > input.configuration.flexBudget) {
    errors.push({ code: "PILOT_SKILL_BUDGET_EXCEEDED" });
  }

  return {
    errors,
    flexRemaining: Math.max(0, input.configuration.flexBudget - flexSpent),
    flexSpent,
    formationRemaining: input.configuration.formationBudget - formationSpent,
    formationSpent,
    valid: errors.length === 0,
  };
}

export interface PilotSkillFinalizationValidation {
  errors: Array<{
    code: "PILOT_SKILL_MISSING_SPOKEN_LANGUAGE";
    message: string;
  }>;
  valid: boolean;
}

export function validatePilotSkillFinalization(input: {
  build: PilotSkillBuildResult;
  competencies: readonly PilotSkillCompetencyDefinition[];
}): PilotSkillFinalizationValidation {
  const hasStartingSpokenLanguageGrant = input.competencies.some(
    (competency) =>
      competency.kind === "spoken-language" &&
      input.build.byCompetencyId[competency.id]?.grantSources.some(
        (grant) =>
          grant.ranks > 0 && (grant.sourceKind === "society" || grant.sourceKind === "background"),
      ),
  );
  const errors: PilotSkillFinalizationValidation["errors"] = hasStartingSpokenLanguageGrant
    ? []
    : [
        {
          code: "PILOT_SKILL_MISSING_SPOKEN_LANGUAGE",
          message:
            "A finalized Character must have a starting spoken language granted by society or background.",
        },
      ];

  return { errors, valid: errors.length === 0 };
}
