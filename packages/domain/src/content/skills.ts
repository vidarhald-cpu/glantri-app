import { z } from "zod";

const idSchema = z.string().min(1);
const literacyRequirementSchema = z.enum(["no", "recommended", "required"]);
const skillCategorySchema = z.enum(["ordinary", "secondary"]);
const skillSocietyLevelSchema = z.number().int().min(1).max(6);
const skillDependencyStrengthSchema = z.enum(["required", "recommended", "helpful"]);

const SKILL_DEPENDENCY_STRENGTH_PRIORITY: Record<SkillDependencyStrength, number> = {
  helpful: 0,
  recommended: 1,
  required: 2
};

function getRequiredDependencySkillIds(
  dependencies: unknown
): unknown[] {
  if (!Array.isArray(dependencies)) {
    return [];
  }

  const requiredDependencySkillIds = dependencies.flatMap((dependency) => {
    if (
      typeof dependency !== "object" ||
      dependency === null ||
      !("skillId" in dependency) ||
      !("strength" in dependency)
    ) {
      return [];
    }

    return dependency.strength === "required" ? [dependency.skillId] : [];
  });

  return [...new Set(requiredDependencySkillIds)];
}

function dedupeDependencies(dependencies: unknown[]): unknown[] {
  const strongestDependencyBySkillId = new Map<string, unknown>();
  const passthroughDependencies: unknown[] = [];

  for (const dependency of dependencies) {
    if (
      typeof dependency !== "object" ||
      dependency === null ||
      !("skillId" in dependency) ||
      !("strength" in dependency)
    ) {
      passthroughDependencies.push(dependency);
      continue;
    }

    const skillId = String(dependency.skillId);
    const existing = strongestDependencyBySkillId.get(skillId);

    if (
      !existing ||
      SKILL_DEPENDENCY_STRENGTH_PRIORITY[dependency.strength as SkillDependencyStrength] >
        SKILL_DEPENDENCY_STRENGTH_PRIORITY[(existing as { strength: SkillDependencyStrength }).strength]
    ) {
      strongestDependencyBySkillId.set(skillId, dependency);
    }
  }

  return [...strongestDependencyBySkillId.values(), ...passthroughDependencies];
}

function normalizeSkillDependencies(input: {
  dependencies?: unknown;
  dependencySkillIds?: unknown;
  helpfulDependencySkillIds?: unknown;
  recommendedDependencySkillIds?: unknown;
}): unknown[] {
  const dependencies: unknown[] = [];

  if (Array.isArray(input.dependencies)) {
    dependencies.push(...input.dependencies);
  }

  if (Array.isArray(input.dependencySkillIds)) {
    dependencies.push(
      ...input.dependencySkillIds.map((skillId) => ({
        skillId,
        strength: "required"
      }))
    );
  }

  if (Array.isArray(input.recommendedDependencySkillIds)) {
    dependencies.push(
      ...input.recommendedDependencySkillIds.map((skillId) => ({
        skillId,
        strength: "recommended"
      }))
    );
  }

  if (Array.isArray(input.helpfulDependencySkillIds)) {
    dependencies.push(
      ...input.helpfulDependencySkillIds.map((skillId) => ({
        skillId,
        strength: "helpful"
      }))
    );
  }

  return dedupeDependencies(dependencies);
}

export const skillGroupDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0)
});

export const skillDependencySchema = z.object({
  skillId: idSchema,
  strength: skillDependencyStrengthSchema.default("required")
});

export const skillDefinitionSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    const candidate = input as {
      dependencies?: unknown;
      dependencySkillIds?: unknown;
      groupId?: unknown;
      groupIds?: unknown;
      helpfulDependencySkillIds?: unknown;
      recommendedDependencySkillIds?: unknown;
    };

    const normalizedGroupIds = Array.isArray(candidate.groupIds)
      ? candidate.groupIds
      : candidate.groupId !== undefined
        ? [candidate.groupId]
        : undefined;
    const normalizedGroupId =
      candidate.groupId !== undefined
        ? candidate.groupId
        : Array.isArray(candidate.groupIds)
          ? candidate.groupIds[0]
          : undefined;
    const normalizedDependencies = normalizeSkillDependencies(candidate);

    return {
      ...candidate,
      dependencies: normalizedDependencies,
      dependencySkillIds: getRequiredDependencySkillIds(normalizedDependencies),
      groupId: normalizedGroupId,
      groupIds: normalizedGroupIds
    };
  },
  z.object({
    id: idSchema,
    groupId: idSchema,
    groupIds: z.array(idSchema).min(1),
    name: z.string().min(1),
    shortDescription: z.string().optional(),
    description: z.string().optional(),
    linkedStats: z.array(z.string().min(1)).min(1),
    isTheoretical: z.boolean().default(false),
    societyLevel: skillSocietyLevelSchema.default(1),
    dependencies: z.array(skillDependencySchema).default([]),
    dependencySkillIds: z.array(idSchema).default([]),
    secondaryOfSkillId: idSchema.optional(),
    specializationOfSkillId: idSchema.optional(),
    category: skillCategorySchema.default("ordinary"),
    requiresLiteracy: literacyRequirementSchema.default("no"),
    sortOrder: z.number().int().default(0),
    allowsSpecializations: z.boolean().default(false)
  })
);

export const skillSpecializationSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    const candidate = input as {
      minimumGroupLevel?: unknown;
      minimumParentLevel?: unknown;
    };
    const normalizedMinimumParentLevel =
      candidate.minimumParentLevel ?? candidate.minimumGroupLevel;

    return {
      ...candidate,
      minimumGroupLevel: normalizedMinimumParentLevel,
      minimumParentLevel: normalizedMinimumParentLevel
    };
  },
  z.object({
    id: idSchema,
    skillId: idSchema,
    name: z.string().min(1),
    description: z.string().optional(),
    minimumGroupLevel: z.number().int().nonnegative().default(11),
    minimumParentLevel: z.number().int().nonnegative().default(11),
    sortOrder: z.number().int().default(0)
  })
);

export const societyLevelAccessSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    const candidate = input as {
      label?: unknown;
      societyName?: unknown;
    };

    if (candidate.societyName !== undefined || candidate.label === undefined) {
      return input;
    }

    return {
      ...candidate,
      societyName: candidate.label
    };
  },
  z.object({
    societyId: idSchema,
    societyLevel: z.number().int().nonnegative(),
    societyName: z.string().min(1),
    baseEducation: z.number().int().nonnegative().optional(),
    classRollTableId: z.string().min(1).optional(),
    socialClass: z.string().min(1),
    professionIds: z.array(idSchema).default([]),
    skillGroupIds: z.array(idSchema).default([]),
    skillIds: z.array(idSchema).default([]),
    notes: z.string().optional()
  })
);

export const societyDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  societyLevel: z.number().int().min(1).max(6),
  shortDescription: z.string().min(1),
  historicalReference: z.string().optional(),
  glantriExamples: z.string().optional(),
  notes: z.string().optional()
});

export type SkillGroupDefinition = z.infer<typeof skillGroupDefinitionSchema>;
export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;
export type SkillDependency = z.infer<typeof skillDependencySchema>;
export type SkillSpecialization = z.infer<typeof skillSpecializationSchema>;
export type SocietyLevelAccess = z.infer<typeof societyLevelAccessSchema>;
export type SocietyDefinition = z.infer<typeof societyDefinitionSchema>;
export type LiteracyRequirement = z.infer<typeof literacyRequirementSchema>;
export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type SkillDependencyStrength = z.infer<typeof skillDependencyStrengthSchema>;

export function getSkillDependencies(
  skill: Pick<SkillDefinition, "dependencies">
): SkillDependency[] {
  const strongestDependencyBySkillId = new Map<string, SkillDependency>();

  for (const dependency of skill.dependencies) {
    const existing = strongestDependencyBySkillId.get(dependency.skillId);

    if (
      !existing ||
      SKILL_DEPENDENCY_STRENGTH_PRIORITY[dependency.strength] >
        SKILL_DEPENDENCY_STRENGTH_PRIORITY[existing.strength]
    ) {
      strongestDependencyBySkillId.set(dependency.skillId, dependency);
    }
  }

  return [...strongestDependencyBySkillId.values()];
}

export function getSkillGroupIds(skill: Pick<SkillDefinition, "groupId" | "groupIds">): string[] {
  const seen = new Set<string>();
  const groupIds = skill.groupIds.length > 0 ? skill.groupIds : [skill.groupId];

  return groupIds.filter((groupId) => {
    if (seen.has(groupId)) {
      return false;
    }

    seen.add(groupId);
    return true;
  });
}
