import type {
  ChargenMode,
  CharacterProgression,
  ChargenRuleSetParameters,
  RolledCharacterProfile,
  SkillDefinition
} from "@glantri/domain";

import { evaluateSkillSelection } from "../../skills/evaluateSkillSelection";
import { createChargenMethodPolicy, STANDARD_CHARGEN_METHOD_POLICY } from "../policy";
import {
  type CanonicalContentShape,
  LITERACY_SKILL_ID,
  cleanupProgression,
  ensureGroupExists,
  ensureSkillExists,
  ensureSpecializationExists,
  getBestPurchasedParentGroup,
  getEvaluationMessages,
  getSkillById,
  getSkillDefinitionGroupIds,
  getSpecializationById,
  getTargetedProgressionSkillRow,
  recalculateProgression
} from "./_helpers";
import {
  buildChargenSkillAccessSummaryInternal,
  getAllowedPrimaryGroupIdsInternal,
  getAllowedSecondaryGroupIdsInternal
} from "./access";
import {
  getActiveGroupSkillCost,
  getAvailableFlexiblePoolTotal,
  chooseChargenPool,
  getSkillSpendCost,
  getSpecializationSpendCost
} from "./costs";

export interface SpendPrimaryPointInput {
  content: CanonicalContentShape;
  professionId: string;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel: number;
  targetLanguageName?: string;
  targetId: string;
  targetType: "group" | "skill";
}

export interface SpendSecondaryPointInput {
  content: CanonicalContentShape;
  professionId?: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel: number;
  targetLanguageName?: string;
  targetId: string;
  targetType: "skill" | "specialization";
}

export interface AllocateChargenPointInput {
  content: CanonicalContentShape;
  professionId: string;
  profile?: RolledCharacterProfile;
  progression: CharacterProgression;
  societyId?: string;
  societyLevel: number;
  targetLanguageName?: string;
  targetId: string;
  targetType: "group" | "skill";
}

export interface SpendPointResult {
  error?: string;
  progression: CharacterProgression;
  spentCost?: number;
  warnings: string[];
}

function getGroupName(content: CanonicalContentShape, groupId: string): string {
  return content.skillGroups.find((group) => group.id === groupId)?.name ?? groupId;
}

function hasRemainingParentGroupAfterRemoval(input: {
  progression: CharacterProgression;
  removedGroupId: string;
  skillDefinition: SkillDefinition;
}): boolean {
  const remainingGroupIds = new Set(
    getSkillDefinitionGroupIds(input.skillDefinition).filter((groupId) => groupId !== input.removedGroupId)
  );

  return input.progression.skillGroups.some(
    (group) => group.ranks > 0 && remainingGroupIds.has(group.groupId)
  );
}

function getPrimaryGroupRemovalError(input: {
  content: CanonicalContentShape;
  groupId: string;
  progression: CharacterProgression;
}): string | undefined {
  const group = input.progression.skillGroups.find((item) => item.groupId === input.groupId);

  if (!group || group.primaryRanks < 1) {
    return "No primary-point group purchase to remove.";
  }

  const ranksAfterRemoval = group.grantedRanks + group.primaryRanks - 1;

  if (ranksAfterRemoval > 0) {
    return undefined;
  }

  const groupSkillIds = new Set(
    input.content.skills
      .filter((skill) => getSkillDefinitionGroupIds(skill).includes(input.groupId))
      .map((skill) => skill.id)
  );
  const hasDependentSpecializations = input.progression.specializations.some(
    (specialization) => {
      if (specialization.secondaryRanks < 1 || !groupSkillIds.has(specialization.skillId)) {
        return false;
      }

      const definition = getSkillById(input.content, specialization.skillId);

      if (!definition) {
        return false;
      }

      return !hasRemainingParentGroupAfterRemoval({
        progression: input.progression,
        removedGroupId: input.groupId,
        skillDefinition: definition
      });
    }
  );

  if (hasDependentSpecializations) {
    return `Remove specializations tied to the ${getGroupName(input.content, input.groupId)} group first.`;
  }

  return undefined;
}

function getPrimarySkillRemovalError(input: {
  content: CanonicalContentShape;
  progression: CharacterProgression;
  skillDefinition: SkillDefinition;
  targetLanguageName?: string;
}): string | undefined {
  const skill = getTargetedProgressionSkillRow({
    progression: input.progression,
    skillId: input.skillDefinition.id,
    targetLanguageName: input.targetLanguageName
  });

  if (!skill || skill.primaryRanks < 1) {
    return "No primary-point skill purchase to remove.";
  }

  const ranksAfterRemoval =
    skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks - 1;

  if (ranksAfterRemoval > 0) {
    return undefined;
  }

  const dependentSpecializationNames = input.progression.specializations
    .filter(
      (specialization) =>
        specialization.skillId === input.skillDefinition.id && specialization.secondaryRanks > 0
    )
    .map(
      (specialization) =>
        getSpecializationById(input.content, specialization.specializationId)?.name ??
        specialization.specializationId
    );

  if (dependentSpecializationNames.length > 0) {
    return `Remove ${dependentSpecializationNames.join(", ")} before lowering ${input.skillDefinition.name}.`;
  }

  if (input.skillDefinition.id !== LITERACY_SKILL_ID) {
    return undefined;
  }

  const requiredLiteracySkills = input.progression.skills
    .filter((candidate) => candidate.skillId !== LITERACY_SKILL_ID && candidate.ranks > 0)
    .map((candidate) => getSkillById(input.content, candidate.skillId))
    .filter(
      (definition): definition is SkillDefinition =>
        Boolean(definition && definition.requiresLiteracy === "required")
    )
    .map((definition) => definition.name);

  if (requiredLiteracySkills.length > 0) {
    return `Remove skills that require Literacy before lowering Literacy: ${requiredLiteracySkills.join(", ")}.`;
  }

  return undefined;
}

function getChargenGroupRemovalError(input: {
  content: CanonicalContentShape;
  groupId: string;
  access: { normalSkillGroupIds: string[] };
  progression: CharacterProgression;
}): string | undefined {
  const group = input.progression.skillGroups.find((item) => item.groupId === input.groupId);

  if (!group || group.primaryRanks < 1) {
    return "No allocated skill-group points to remove.";
  }

  const ranksAfterRemoval = group.ranks - 1;

  if (ranksAfterRemoval > 0) {
    return undefined;
  }

  const groupSkillIds = new Set(
    input.content.skills
      .filter((skill) => getSkillDefinitionGroupIds(skill).includes(input.groupId))
      .map((skill) => skill.id)
  );
  const hasDependentSpecializations = input.progression.specializations.some(
    (specialization) => {
      if (specialization.secondaryRanks < 1 || !groupSkillIds.has(specialization.skillId)) {
        return false;
      }

      const definition = getSkillById(input.content, specialization.skillId);

      if (!definition) {
        return false;
      }

      return !hasRemainingParentGroupAfterRemoval({
        progression: input.progression,
        removedGroupId: input.groupId,
        skillDefinition: definition
      });
    }
  );

  if (hasDependentSpecializations) {
    return `Remove specializations tied to the ${getGroupName(input.content, input.groupId)} skill group first.`;
  }

  return undefined;
}

function getChargenSkillRemovalError(input: {
  content: CanonicalContentShape;
  progression: CharacterProgression;
  skillDefinition: SkillDefinition;
  targetLanguageName?: string;
}): string | undefined {
  const skill = getTargetedProgressionSkillRow({
    progression: input.progression,
    skillId: input.skillDefinition.id,
    targetLanguageName: input.targetLanguageName
  });

  if (!skill || skill.primaryRanks + skill.secondaryRanks < 1) {
    return "No allocated skill points to remove.";
  }

  const ranksAfterRemoval = skill.ranks - 1;

  if (ranksAfterRemoval > 0) {
    return undefined;
  }

  const dependentSpecializationNames = input.progression.specializations
    .filter(
      (specialization) =>
        specialization.skillId === input.skillDefinition.id && specialization.secondaryRanks > 0
    )
    .map(
      (specialization) =>
        getSpecializationById(input.content, specialization.specializationId)?.name ??
        specialization.specializationId
    );

  if (dependentSpecializationNames.length > 0) {
    return `Remove ${dependentSpecializationNames.join(", ")} before lowering ${input.skillDefinition.name}.`;
  }

  if (input.skillDefinition.id !== LITERACY_SKILL_ID) {
    return undefined;
  }

  const requiredLiteracySkills = input.progression.skills
    .filter((candidate) => candidate.skillId !== LITERACY_SKILL_ID && candidate.ranks > 0)
    .map((candidate) => getSkillById(input.content, candidate.skillId))
    .filter(
      (definition): definition is SkillDefinition =>
        Boolean(definition && definition.requiresLiteracy === "required")
    )
    .map((definition) => definition.name);

  if (requiredLiteracySkills.length > 0) {
    return `Remove skills that require Literacy before lowering Literacy: ${requiredLiteracySkills.join(", ")}.`;
  }

  return undefined;
}

export function createChargenProgression(
  mode: ChargenMode = "standard",
  ruleSet?: Partial<ChargenRuleSetParameters>
): CharacterProgression {
  const policy = createChargenMethodPolicy(ruleSet);

  return recalculateProgression({
    chargenMode: mode,
    educationPoints: 0,
    flexiblePointFactor: policy.flexiblePointFactor,
    level: 1,
    primaryPoolSpent: 0,
    primaryPoolTotal: policy.primaryPoolTotal,
    secondaryPoolSpent: 0,
    secondaryPoolTotal: STANDARD_CHARGEN_METHOD_POLICY.secondaryPoolTotal,
    skillGroups: [],
    skills: [],
    specializations: []
  });
}

export function normalizeChargenProgression(
  progression: CharacterProgression | undefined
): CharacterProgression {
  return recalculateProgression(progression ?? createChargenProgression());
}

export function applyProfessionGrants(input: {
  content: CanonicalContentShape;
  mode?: ChargenMode;
  professionId: string;
  ruleSet?: Partial<ChargenRuleSetParameters>;
}): CharacterProgression {
  return createChargenProgression(input.mode ?? "standard", input.ruleSet);
}

export function allocateChargenPoint(input: AllocateChargenPointInput): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const warnings: string[] = [];
  const access = buildChargenSkillAccessSummaryInternal({
    content: input.content,
    professionId: input.professionId,
    societyId: input.societyId,
    societyLevel: input.societyLevel
  });

  if (input.targetType === "group") {
    const normalAccess = access.normalSkillGroupIds.includes(input.targetId);

    if (!normalAccess) {
      return {
        error: "This skill group is not part of the selected profession and society access.",
        progression,
        warnings
      };
    }

    const groupCost = getActiveGroupSkillCost({
      content: input.content,
      groupId: input.targetId,
      progression
    });

    if (groupCost.error || groupCost.cost === undefined) {
      return {
        error: groupCost.error ?? "Skill group cost could not be calculated.",
        progression,
        warnings
      };
    }

    const cost = groupCost.cost;
    const pool = chooseChargenPool({
      cost,
      normalAccess,
      profile: input.profile,
      progression
    });

    if (!pool) {
      return {
        error: `Not enough ordinary or flexible points remain for this skill group. Cost: ${cost}.`,
        progression,
        warnings
      };
    }

    const group = ensureGroupExists(progression, input.targetId);

    if (pool === "primary") {
      group.primaryRanks += 1;
      progression.primaryPoolSpent += cost;
    } else {
      group.secondaryRanks += 1;
      progression.secondaryPoolSpent += cost;
    }

    group.ranks = group.grantedRanks + group.primaryRanks + group.secondaryRanks;

    return {
      progression: recalculateProgression(progression),
      spentCost: cost,
      warnings
    };
  }

  const skillDefinition = getSkillById(input.content, input.targetId);

  if (!skillDefinition) {
    return {
      error: "Skill definition not found.",
      progression,
      warnings
    };
  }

  const normalAccess = access.normalSkillIds.includes(skillDefinition.id);
  const dependencyEvaluation = evaluateSkillSelection({
    content: input.content,
    progression,
    target: {
      skill: skillDefinition,
      targetType: "skill"
    }
  });

  warnings.push(...getEvaluationMessages(dependencyEvaluation));

  if (!dependencyEvaluation.isAllowed) {
    return {
      error: dependencyEvaluation.blockingReasons[0]?.message ?? "Skill purchase is blocked.",
      progression,
      warnings
    };
  }

  const skill = ensureSkillExists(progression, skillDefinition, {
    languageName: input.targetLanguageName
  });
  const cost = getSkillSpendCost(skillDefinition);
  const pool = chooseChargenPool({
    cost,
    normalAccess,
    profile: input.profile,
    progression
  });

  if (!pool) {
    return {
      error: normalAccess
        ? `No ordinary or flexible points remain for this skill. Cost: ${cost}.`
        : "No flexible points remain for this other skill.",
      progression,
      warnings
    };
  }

  if (pool === "primary") {
    skill.primaryRanks += 1;
    progression.primaryPoolSpent += cost;
  } else {
    skill.secondaryRanks += 1;
    progression.secondaryPoolSpent += cost;
  }

  skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;

  return {
    progression: recalculateProgression(progression),
    spentCost: cost,
    warnings
  };
}

export function spendPrimaryPoint(input: SpendPrimaryPointInput): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const allowedGroupIds = getAllowedPrimaryGroupIdsInternal(
    input.content,
    input.professionId,
    input.societyId,
    input.societyLevel
  );
  const warnings: string[] = [];

  if (input.targetType === "group") {
    if (!allowedGroupIds.includes(input.targetId)) {
      return {
        error: "That group is not available for the selected profession and society.",
        progression,
        warnings
      };
    }

    const groupCost = getActiveGroupSkillCost({
      content: input.content,
      groupId: input.targetId,
      progression
    });

    if (groupCost.error || groupCost.cost === undefined) {
      return {
        error: groupCost.error ?? "Skill group cost could not be calculated.",
        progression,
        warnings
      };
    }

    const group = ensureGroupExists(progression, input.targetId);
    const cost = groupCost.cost;

    if (progression.primaryPoolSpent + cost > progression.primaryPoolTotal) {
      return {
        error: "Not enough primary points remaining for that group purchase.",
        progression,
        warnings
      };
    }

    group.primaryRanks += 1;
    group.ranks = group.grantedRanks + group.primaryRanks + group.secondaryRanks;
    progression.primaryPoolSpent += cost;

    return {
      progression: recalculateProgression(progression),
      spentCost: cost,
      warnings
    };
  }

  const skillDefinition = getSkillById(input.content, input.targetId);

  if (!skillDefinition) {
    return {
      error: "Skill definition not found.",
      progression,
      warnings
    };
  }

  const allowedParentGroupIds = getSkillDefinitionGroupIds(skillDefinition).filter((groupId) =>
    allowedGroupIds.includes(groupId)
  );

  if (allowedParentGroupIds.length === 0) {
    return {
      error: "That skill is not available for the selected profession and society.",
      progression,
      warnings
    };
  }

  const dependencyEvaluation = evaluateSkillSelection({
    content: input.content,
    progression,
    target: {
      skill: skillDefinition,
      targetType: "skill"
    }
  });

  warnings.push(...getEvaluationMessages(dependencyEvaluation));

  if (!dependencyEvaluation.isAllowed) {
    return {
      error: dependencyEvaluation.blockingReasons[0]?.message ?? "Skill purchase is blocked.",
      progression,
      warnings
    };
  }

  const skill = ensureSkillExists(progression, skillDefinition, {
    languageName: input.targetLanguageName
  });
  const cost = getSkillSpendCost(skillDefinition);

  if (progression.primaryPoolSpent + cost > progression.primaryPoolTotal) {
    return {
      error: "Not enough primary points remaining for that skill purchase.",
      progression,
      warnings
    };
  }

  skill.primaryRanks += 1;
  skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
  progression.primaryPoolSpent += cost;

  return {
    progression: recalculateProgression(progression),
    spentCost: cost,
    warnings
  };
}

export function removePrimaryPoint(input: SpendPrimaryPointInput): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const warnings: string[] = [];

  if (input.targetType === "group") {
    const group = progression.skillGroups.find((item) => item.groupId === input.targetId);
    const error = getPrimaryGroupRemovalError({
      content: input.content,
      groupId: input.targetId,
      progression
    });

    if (!group || error) {
      return {
        error,
        progression,
        warnings
      };
    }

    group.primaryRanks -= 1;
    group.ranks = group.grantedRanks + group.primaryRanks + group.secondaryRanks;
    const groupCost = getActiveGroupSkillCost({
      content: input.content,
      groupId: input.targetId,
      progression
    });
    const refundedCost = groupCost.cost;

    if (refundedCost === undefined) {
      return {
        error: groupCost.error ?? "Skill group refund could not be calculated.",
        progression,
        warnings
      };
    }

    progression.primaryPoolSpent = Math.max(0, progression.primaryPoolSpent - refundedCost);

    return {
      progression: cleanupProgression(progression),
      spentCost: refundedCost,
      warnings
    };
  }

  const skillDefinition = getSkillById(input.content, input.targetId);

  if (!skillDefinition) {
    return {
      error: "Skill definition not found.",
      progression,
      warnings
    };
  }

  const skill = getTargetedProgressionSkillRow({
    progression,
    skillId: input.targetId,
    targetLanguageName: input.targetLanguageName
  });
  const error = getPrimarySkillRemovalError({
    content: input.content,
    progression,
    skillDefinition,
    targetLanguageName: input.targetLanguageName
  });

  if (!skill || error) {
    return {
      error,
      progression,
      warnings
    };
  }

  skill.primaryRanks -= 1;
  skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
  const refundedCost = getSkillSpendCost(skillDefinition);
  progression.primaryPoolSpent = Math.max(0, progression.primaryPoolSpent - refundedCost);

  return {
    progression: cleanupProgression(progression),
    spentCost: refundedCost,
    warnings
  };
}

export function removeChargenPoint(
  input: AllocateChargenPointInput
): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const warnings: string[] = [];

  if (input.targetType === "group") {
    const group = progression.skillGroups.find((item) => item.groupId === input.targetId);
    const access = buildChargenSkillAccessSummaryInternal({
      content: input.content,
      professionId: input.professionId,
      societyId: input.societyId,
      societyLevel: input.societyLevel
    });
    const error = getChargenGroupRemovalError({
      access,
      content: input.content,
      groupId: input.targetId,
      progression
    });

    if (!group || error) {
      return {
        error,
        progression,
        warnings
      };
    }

    const groupCost = getActiveGroupSkillCost({
      content: input.content,
      groupId: input.targetId,
      progression
    });
    const refundCost = groupCost.cost;

    if (refundCost === undefined) {
      return {
        error: groupCost.error ?? "Skill group refund could not be calculated.",
        progression,
        warnings
      };
    }

    if (group.secondaryRanks > 0) {
      group.secondaryRanks -= 1;
      progression.secondaryPoolSpent = Math.max(0, progression.secondaryPoolSpent - refundCost);
    } else {
      group.primaryRanks -= 1;
      progression.primaryPoolSpent = Math.max(0, progression.primaryPoolSpent - refundCost);
    }

    group.ranks = group.grantedRanks + group.primaryRanks + group.secondaryRanks;

    return {
      progression: cleanupProgression(progression),
      spentCost: refundCost,
      warnings
    };
  }

  const skillDefinition = getSkillById(input.content, input.targetId);

  if (!skillDefinition) {
    return {
      error: "Skill definition not found.",
      progression,
      warnings
    };
  }

  const skill = getTargetedProgressionSkillRow({
    progression,
    skillId: input.targetId,
    targetLanguageName: input.targetLanguageName
  });
  const error = getChargenSkillRemovalError({
    content: input.content,
    progression,
    skillDefinition,
    targetLanguageName: input.targetLanguageName
  });

  if (!skill || error) {
    return {
      error,
      progression,
      warnings
    };
  }

  const usedSecondaryPool = skill.secondaryRanks > 0;

  if (usedSecondaryPool) {
    skill.secondaryRanks -= 1;
  } else {
    skill.primaryRanks -= 1;
  }

  skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
  const refundedCost = getSkillSpendCost(skillDefinition);

  if (usedSecondaryPool) {
    progression.secondaryPoolSpent = Math.max(0, progression.secondaryPoolSpent - refundedCost);
  } else {
    progression.primaryPoolSpent = Math.max(0, progression.primaryPoolSpent - refundedCost);
  }

  return {
    progression: cleanupProgression(progression),
    spentCost: refundedCost,
    warnings
  };
}

export function removeSecondaryPoint(input: SpendSecondaryPointInput): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const warnings: string[] = [];

  if (input.targetType === "skill") {
    const skillDefinition = getSkillById(input.content, input.targetId);

    if (!skillDefinition) {
      return {
        error: "Skill definition not found.",
        progression,
        warnings
      };
    }

    const skill = getTargetedProgressionSkillRow({
      progression,
      skillId: input.targetId,
      targetLanguageName: input.targetLanguageName
    });

    if (!skill || skill.secondaryRanks < 1) {
      return {
        error: "No flexible-point skill purchase to remove.",
        progression,
        warnings
      };
    }

    const error = getChargenSkillRemovalError({
      content: input.content,
      progression,
      skillDefinition,
      targetLanguageName: input.targetLanguageName
    });

    if (error) {
      return {
        error,
        progression,
        warnings
      };
    }

    skill.secondaryRanks -= 1;
    skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
    const refundedCost = getSkillSpendCost(skillDefinition);
    progression.secondaryPoolSpent = Math.max(0, progression.secondaryPoolSpent - refundedCost);

    return {
      progression: cleanupProgression(progression),
      spentCost: refundedCost,
      warnings
    };
  }

  const specializationDefinition = getSpecializationById(input.content, input.targetId);

  if (!specializationDefinition) {
    return {
      error: "Specialization definition not found.",
      progression,
      warnings
    };
  }

  const specialization = progression.specializations.find(
    (item) => item.specializationId === specializationDefinition.id
  );

  if (!specialization || specialization.secondaryRanks < 1) {
    return {
      error: "No specialization purchase to remove.",
      progression,
      warnings
    };
  }

  specialization.secondaryRanks -= 1;
  specialization.ranks = specialization.secondaryRanks;
  const refundedCost = getSpecializationSpendCost(specialization.secondaryRanks > 0);
  progression.secondaryPoolSpent = Math.max(0, progression.secondaryPoolSpent - refundedCost);

  return {
    progression: cleanupProgression(progression),
    spentCost: refundedCost,
    warnings
  };
}

export function spendSecondaryPoint(input: SpendSecondaryPointInput): SpendPointResult {
  const progression = recalculateProgression(structuredClone(input.progression));
  const allowedGroupIds = getAllowedSecondaryGroupIdsInternal(
    input.content,
    input.societyId,
    input.societyLevel
  );
  const warnings: string[] = [];

  if (input.targetType === "skill") {
    const skillDefinition = getSkillById(input.content, input.targetId);

    if (!skillDefinition) {
      return {
        error: "Skill definition not found.",
        progression,
        warnings
      };
    }

    const allowedParentGroupIds = getSkillDefinitionGroupIds(skillDefinition).filter((groupId) =>
      allowedGroupIds.includes(groupId)
    );

    if (allowedParentGroupIds.length === 0) {
      return {
        error: "That skill is not exactly one society level above the current character.",
        progression,
        warnings
      };
    }

    const dependencyEvaluation = evaluateSkillSelection({
      content: input.content,
      progression,
      target: {
        skill: skillDefinition,
        targetType: "skill"
      }
    });

    warnings.push(...getEvaluationMessages(dependencyEvaluation));

    if (!dependencyEvaluation.isAllowed) {
      return {
        error: dependencyEvaluation.blockingReasons[0]?.message ?? "Skill purchase is blocked.",
        progression,
        warnings
      };
    }

    const skill = ensureSkillExists(progression, skillDefinition, {
      languageName: input.targetLanguageName
    });
    const cost = getSkillSpendCost(skillDefinition);

    if (
      progression.secondaryPoolSpent + cost >
      getAvailableFlexiblePoolTotal({
        profile: input.profile,
        progression
      })
    ) {
      return {
        error: "Not enough secondary points remaining for that skill purchase.",
        progression,
        warnings
      };
    }

    skill.secondaryRanks += 1;
    skill.ranks = skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks;
    progression.secondaryPoolSpent += cost;

    return {
      progression: recalculateProgression(progression),
      spentCost: cost,
      warnings
    };
  }

  const specializationDefinition = getSpecializationById(input.content, input.targetId);

  if (!specializationDefinition) {
    return {
      error: "Specialization definition not found.",
      progression,
      warnings
    };
  }

  const specializationEvaluation = evaluateSkillSelection({
    content: input.content,
    progression,
    target: {
      specialization: specializationDefinition,
      targetType: "specialization"
    }
  });

  warnings.push(...getEvaluationMessages(specializationEvaluation));

  if (!specializationEvaluation.isAllowed) {
    return {
      error:
        specializationEvaluation.blockingReasons[0]?.message ??
        "Specialization purchase is blocked.",
      progression,
      warnings
    };
  }

  const parentSkillDefinition = getSkillById(input.content, specializationDefinition.skillId);

  if (!parentSkillDefinition) {
    return {
      error: "Specialization definition not found.",
      progression,
      warnings
    };
  }

  if (!specializationDefinition.specializationBridge) {
    const allowedParentGroupIds = getSkillDefinitionGroupIds(parentSkillDefinition).filter((groupId) =>
      allowedGroupIds.includes(groupId)
    );

    if (allowedParentGroupIds.length === 0) {
      return {
        error:
          "This specialization is outside the current society/profession access for its parent skill.",
        progression,
        warnings
      };
    }

    const parentGroup = getBestPurchasedParentGroup(input.content, progression, parentSkillDefinition);

    if (!parentGroup) {
      return {
        error: "Acquire the parent group before purchasing a specialization.",
        progression,
        warnings
      };
    }
  }

  const specialization = ensureSpecializationExists(progression, specializationDefinition);
  const cost = getSpecializationSpendCost(specialization.secondaryRanks > 0);

  if (
    progression.secondaryPoolSpent + cost >
    getAvailableFlexiblePoolTotal({
      profile: input.profile,
      progression
    })
  ) {
    return {
      error: "Not enough secondary points remaining for that specialization purchase.",
      progression,
      warnings
    };
  }

  specialization.secondaryRanks += 1;
  specialization.skillId = specializationDefinition.skillId;
  specialization.ranks = specialization.secondaryRanks;
  progression.secondaryPoolSpent += cost;

  return {
    progression: recalculateProgression(progression),
    spentCost: cost,
    warnings
  };
}
