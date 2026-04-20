import { z } from "zod";

const idSchema = z.string().min(1);
const literacyRequirementSchema = z.enum(["no", "recommended", "required"]);
const skillCategorySchema = z.enum(["ordinary", "secondary"]);
export const playerFacingSkillCategoryIdSchema = z.enum([
  "combat",
  "military",
  "leadership",
  "fieldcraft",
  "maritime",
  "healing",
  "trade",
  "court-social",
  "covert",
  "knowledge",
  "mental",
  "mystical",
  "craft",
  "physical",
  "special-access"
]);
const skillSocietyLevelSchema = z.number().int().min(1).max(6);
const skillDependencyStrengthSchema = z.enum(["required", "recommended", "helpful"]);
const skillGroupSkillRelevanceSchema = z.enum(["core", "optional"]);

const LEGACY_PLAYER_FACING_SKILL_CATEGORY_BY_GROUP_ID: Partial<
  Record<string, PlayerFacingSkillCategoryId>
> = {
  advanced_melee_training: "combat",
  advanced_missile_training: "combat",
  animal_handling: "fieldcraft",
  animal_husbandry: "fieldcraft",
  athletic_conditioning: "physical",
  athletics: "physical",
  basic_melee_training: "combat",
  basic_missile_training: "combat",
  civic_learning: "knowledge",
  combat_group: "combat",
  commercial_administration: "trade",
  courtly_formation: "court-social",
  covert_entry: "covert",
  craft_group: "craft",
  defensive_soldiering: "military",
  field_soldiering: "military",
  fieldcraft_stealth: "fieldcraft",
  formal_performance: "court-social",
  healing_practice: "healing",
  herb_and_remedy_craft: "healing",
  humanities: "knowledge",
  learned_natural_inquiry: "knowledge",
  literate_foundation: "knowledge",
  maritime_crew_training: "maritime",
  maritime_navigation: "maritime",
  medicine_group: "healing",
  mental_discipline: "mental",
  mental_group: "mental",
  mercantile_practice: "trade",
  military_group: "military",
  mounted_service: "fieldcraft",
  mounted_warrior_training: "combat",
  mystical_group: "mystical",
  officer_training: "leadership",
  omen_and_ritual_practice: "mystical",
  operations: "military",
  performance_basics: "court-social",
  physical_science: "knowledge",
  political_acumen: "leadership",
  sacred_learning: "knowledge",
  security: "covert",
  social_reading: "court-social",
  stealth_group: "covert",
  street_theft: "covert",
  technical_measurement: "knowledge",
  transport_and_caravan_work: "trade",
  trap_and_intrusion_work: "covert",
  veteran_leadership: "leadership",
  veteran_soldiering: "military",
  wilderness_group: "fieldcraft"
};

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

export const skillGroupSkillMembershipSchema = z.object({
  skillId: idSchema,
  relevance: skillGroupSkillRelevanceSchema.default("optional")
});

export const skillGroupDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  skillMemberships: z.array(skillGroupSkillMembershipSchema).optional(),
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
      categoryId?: unknown;
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
    const explicitCategoryId =
      typeof candidate.categoryId === "string" && candidate.categoryId.length > 0
        ? candidate.categoryId
        : undefined;
    const inferredCategoryId = inferPlayerFacingSkillCategoryIdFromGroupIds({
      groupId: String(normalizedGroupId ?? ""),
      groupIds: Array.isArray(normalizedGroupIds)
        ? normalizedGroupIds
            .filter((groupId): groupId is string => typeof groupId === "string")
        : []
    });

    return {
      ...candidate,
      categoryId: explicitCategoryId ?? inferredCategoryId,
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
    categoryId: playerFacingSkillCategoryIdSchema.optional(),
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
  baselineLanguageIds: z.array(idSchema).optional(),
  shortDescription: z.string().min(1),
  historicalReference: z.string().optional(),
  glantriExamples: z.string().optional(),
  notes: z.string().optional()
});

export const languageDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  notes: z.string().optional(),
  sourceSocietyId: idSchema.optional()
});

export const civilizationDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  shortDescription: z.string().min(1),
  historicalAnalogue: z.string().min(1),
  spokenLanguageName: z.string().min(1),
  writtenLanguageName: z.string().min(1).nullable(),
  period: z.string().min(1),
  linkedSocietyId: idSchema,
  linkedSocietyLevel: z.number().int().min(1).max(6),
  notes: z.string().optional()
});

export type SkillGroupDefinition = z.infer<typeof skillGroupDefinitionSchema>;
export type SkillGroupSkillMembership = z.infer<typeof skillGroupSkillMembershipSchema>;
export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;
export type SkillDependency = z.infer<typeof skillDependencySchema>;
export type SkillSpecialization = z.infer<typeof skillSpecializationSchema>;
export type SocietyLevelAccess = z.infer<typeof societyLevelAccessSchema>;
export type SocietyDefinition = z.infer<typeof societyDefinitionSchema>;
export type LanguageDefinition = z.infer<typeof languageDefinitionSchema>;
export type CivilizationDefinition = z.infer<typeof civilizationDefinitionSchema>;
export type LiteracyRequirement = z.infer<typeof literacyRequirementSchema>;
export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type PlayerFacingSkillCategoryId = z.infer<typeof playerFacingSkillCategoryIdSchema>;
export type SkillDependencyStrength = z.infer<typeof skillDependencyStrengthSchema>;
export type SkillGroupSkillRelevance = z.infer<typeof skillGroupSkillRelevanceSchema>;

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

export function inferPlayerFacingSkillCategoryIdFromGroupIds(
  skill: Pick<SkillDefinition, "groupId" | "groupIds"> | { groupId?: string; groupIds?: string[] }
): PlayerFacingSkillCategoryId {
  const orderedGroupIds = [
    ...(skill.groupId ? [skill.groupId] : []),
    ...((skill.groupIds ?? []).filter((groupId) => groupId !== skill.groupId) as string[])
  ];

  for (const groupId of orderedGroupIds) {
    const mapped = LEGACY_PLAYER_FACING_SKILL_CATEGORY_BY_GROUP_ID[groupId];
    if (mapped) {
      return mapped;
    }
  }

  return "special-access";
}

export function getPlayerFacingSkillCategoryId(
  skill:
    | Pick<SkillDefinition, "categoryId" | "groupId" | "groupIds">
    | { categoryId?: string; groupId?: string; groupIds?: string[] },
  options?: { preferDirectProfession?: boolean }
): PlayerFacingSkillCategoryId {
  if (options?.preferDirectProfession) {
    return "special-access";
  }

  if (typeof skill.categoryId === "string" && skill.categoryId.length > 0) {
    return skill.categoryId as PlayerFacingSkillCategoryId;
  }

  return inferPlayerFacingSkillCategoryIdFromGroupIds(skill);
}
