import { z } from "zod";

const idSchema = z.string().min(1);
const literacyRequirementSchema = z.enum(["no", "recommended", "required"]);
const skillCategorySchema = z.enum(["ordinary", "secondary"]);
export const playerFacingSkillCategoryIdSchema = z.enum([
  "combat",
  "military",
  "fieldcraft",
  "maritime",
  "healing",
  "trade",
  "high-society",
  "performance",
  "social",
  "covert",
  "language",
  "knowledge",
  "mental",
  "mystical",
  "craft",
  "physical",
  "special-access"
]);

export function normalizePlayerFacingSkillCategoryId(input: string | undefined): string | undefined {
  if (!input) {
    return undefined;
  }

  const normalized = input.trim().toLowerCase().replace(/[\s_]+/g, "-");

  if (normalized === "court-social") {
    return "social";
  }

  if (normalized === "leadership") {
    return undefined;
  }

  return normalized;
}

const SKILL_GROUP_ID_ALIASES: Record<string, string> = {
  field_soldiering: "veteran_soldiering",
  officer_training: "veteran_leadership",
  trap_and_intrusion_work: "covert_entry"
};

export function normalizeSkillGroupId(input: unknown): string | undefined {
  if (typeof input !== "string" || input.length === 0) {
    return undefined;
  }

  const normalized = input.trim().replace(/-/g, "_");
  return SKILL_GROUP_ID_ALIASES[normalized] ?? normalized;
}

export function normalizeSkillGroupIds(input: readonly unknown[] | undefined): string[] {
  return [
    ...new Set(
      (input ?? [])
        .map(normalizeSkillGroupId)
        .filter((groupId): groupId is string => Boolean(groupId))
    )
  ];
}
const skillSocietyLevelSchema = z.number().int().min(1).max(6);
const skillDependencyStrengthSchema = z.enum(["required", "recommended", "helpful"]);
const skillGroupSkillRelevanceSchema = z.enum(["core", "optional"]);
const derivedSkillGrantFactorSchema = z.number().min(0);
const meleeWeaponHandClassSchema = z.enum(["one-handed", "two-handed"]);
const meleeWeaponAttackStyleSchema = z.enum(["strike", "slash", "thrust"]);
export const specializationBridgeSchema = z.object({
  parentExcessOffset: z.number().int().nonnegative(),
  parentSkillId: idSchema,
  reverseFactor: derivedSkillGrantFactorSchema,
  threshold: z.number().int().nonnegative()
});

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
  courtly_formation: "high-society",
  covert_entry: "covert",
  craft_group: "craft",
  defensive_soldiering: "military",
  field_soldiering: "military",
  fieldcraft_stealth: "fieldcraft",
  formal_performance: "performance",
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
  officer_training: "military",
  omen_and_ritual_practice: "mystical",
  operations: "military",
  performance_basics: "performance",
  physical_science: "knowledge",
  political_acumen: "social",
  sacred_learning: "knowledge",
  security: "covert",
  social_reading: "social",
  stealth_group: "covert",
  street_theft: "covert",
  technical_measurement: "knowledge",
  transport_and_caravan_work: "trade",
  trap_and_intrusion_work: "covert",
  veteran_leadership: "military",
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

export const skillGroupSelectionSlotSchema = z.object({
  candidateSkillIds: z.array(idSchema).min(1),
  chooseCount: z.number().int().positive().default(1),
  id: idSchema,
  label: z.string().min(1),
  required: z.boolean().default(true)
});

export const skillGroupDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  skillMemberships: z.array(skillGroupSkillMembershipSchema).optional(),
  selectionSlots: z.array(skillGroupSelectionSlotSchema).optional(),
  sortOrder: z.number().int().default(0)
});

export const skillDependencySchema = z.object({
  skillId: idSchema,
  strength: skillDependencyStrengthSchema.default("required")
});

export const derivedSkillGrantSchema = z.object({
  factor: derivedSkillGrantFactorSchema,
  skillId: idSchema
});

export const meleeCrossTrainingSchema = z.object({
  attackStyle: meleeWeaponAttackStyleSchema,
  handClass: meleeWeaponHandClassSchema
});

export const skillDefinitionSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    const candidate = input as {
      id?: unknown;
      dependencies?: unknown;
      dependencySkillIds?: unknown;
      categoryId?: unknown;
      groupId?: unknown;
      groupIds?: unknown;
      helpfulDependencySkillIds?: unknown;
      recommendedDependencySkillIds?: unknown;
    };

    const rawGroupIds = Array.isArray(candidate.groupIds)
      ? candidate.groupIds
      : candidate.groupId !== undefined
        ? [candidate.groupId]
        : undefined;
    const normalizedGroupIds = normalizeSkillGroupIds(rawGroupIds);
    const normalizedGroupId = normalizeSkillGroupId(candidate.groupId) ?? normalizedGroupIds[0];
    const normalizedDependencies = normalizeSkillDependencies(candidate);
    const explicitCategoryId = normalizePlayerFacingSkillCategoryId(
      typeof candidate.categoryId === "string" && candidate.categoryId.length > 0
        ? candidate.categoryId
        : undefined
    );
    const normalizedCategoryId =
      candidate.id === "language" ? "language" : explicitCategoryId;
    const inferredCategoryId = inferPlayerFacingSkillCategoryIdFromGroupIds({
      groupId: String(normalizedGroupId ?? ""),
      groupIds: Array.isArray(normalizedGroupIds)
        ? normalizedGroupIds
            .filter((groupId): groupId is string => typeof groupId === "string")
        : []
    });

    return {
      ...candidate,
      categoryId: normalizedCategoryId ?? inferredCategoryId,
      dependencies: normalizedDependencies,
      dependencySkillIds: getRequiredDependencySkillIds(normalizedDependencies),
      groupId: normalizedGroupId,
      groupIds: normalizedGroupIds.length > 0 ? normalizedGroupIds : rawGroupIds
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
    allowsSpecializations: z.boolean().default(false),
    derivedGrants: z.array(derivedSkillGrantSchema).optional(),
    meleeCrossTraining: meleeCrossTrainingSchema.optional(),
    specializationBridge: specializationBridgeSchema.optional()
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
    sortOrder: z.number().int().default(0),
    specializationBridge: specializationBridgeSchema.optional()
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
      skillGroupIds?: unknown;
    };

    return {
      ...candidate,
      skillGroupIds: Array.isArray(candidate.skillGroupIds)
        ? normalizeSkillGroupIds(candidate.skillGroupIds)
        : candidate.skillGroupIds,
      societyName:
        candidate.societyName !== undefined || candidate.label === undefined
          ? candidate.societyName
          : candidate.label
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

// Society-band skill access means "eligible to spend main skill points here",
// not "granted for free". Keep this separate from direct skill grants.
export const societyBandSkillAccessSchema = z.object({
  societyId: idSchema,
  societyName: z.string().min(1),
  linkedSocietyLevel: z.number().int().min(1).max(6),
  socialBand: z.number().int().min(1).max(4),
  skillId: idSchema,
  notes: z.string().optional()
});

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

export const civilizationDefinitionSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    const candidate = input as {
      motherTongueLanguageName?: unknown;
      optionalLanguageNames?: unknown;
      spokenLanguageName?: unknown;
    };

    return {
      ...candidate,
      motherTongueLanguageName:
        typeof candidate.motherTongueLanguageName === "string" &&
        candidate.motherTongueLanguageName.length > 0
          ? candidate.motherTongueLanguageName
          : candidate.spokenLanguageName,
      optionalLanguageNames: Array.isArray(candidate.optionalLanguageNames)
        ? candidate.optionalLanguageNames
        : []
    };
  },
  z.object({
    id: idSchema,
    name: z.string().min(1),
    shortDescription: z.string().min(1),
    historicalAnalogue: z.string().min(1),
    spokenLanguageName: z.string().min(1),
    writtenLanguageName: z.string().min(1).nullable(),
    motherTongueLanguageName: z.string().min(1),
    optionalLanguageNames: z.array(z.string().min(1)).default([]),
    period: z.string().min(1),
    linkedSocietyId: idSchema,
    linkedSocietyLevel: z.number().int().min(1).max(6),
    notes: z.string().optional()
  })
);

export type SkillGroupSkillMembership = z.infer<typeof skillGroupSkillMembershipSchema>;
export type SkillGroupSelectionSlot = z.infer<typeof skillGroupSelectionSlotSchema>;
export type SkillGroupDefinition = z.infer<typeof skillGroupDefinitionSchema>;
export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;
export type SkillDependency = z.infer<typeof skillDependencySchema>;
export type DerivedSkillGrant = z.infer<typeof derivedSkillGrantSchema>;
export type MeleeCrossTraining = z.infer<typeof meleeCrossTrainingSchema>;
export type SkillSpecialization = z.infer<typeof skillSpecializationSchema>;
export type SocietyLevelAccess = z.infer<typeof societyLevelAccessSchema>;
export type SocietyBandSkillAccess = z.infer<typeof societyBandSkillAccessSchema>;
export type SocietyDefinition = z.infer<typeof societyDefinitionSchema>;
export type LanguageDefinition = z.infer<typeof languageDefinitionSchema>;
export type CivilizationDefinition = z.infer<typeof civilizationDefinitionSchema>;
export type LiteracyRequirement = z.infer<typeof literacyRequirementSchema>;
export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type PlayerFacingSkillCategoryId = z.infer<typeof playerFacingSkillCategoryIdSchema>;
export type SkillDependencyStrength = z.infer<typeof skillDependencyStrengthSchema>;
export type SkillGroupSkillRelevance = z.infer<typeof skillGroupSkillRelevanceSchema>;
export type MeleeWeaponHandClass = z.infer<typeof meleeWeaponHandClassSchema>;
export type MeleeWeaponAttackStyle = z.infer<typeof meleeWeaponAttackStyleSchema>;

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
  const primaryGroupId = normalizeSkillGroupId(skill.groupId);
  const groupIds = normalizeSkillGroupIds(skill.groupIds ?? []);
  const orderedGroupIds = [
    ...(primaryGroupId ? [primaryGroupId] : []),
    ...groupIds.filter((groupId) => groupId !== primaryGroupId)
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
    const normalizedCategoryId = normalizePlayerFacingSkillCategoryId(skill.categoryId);

    if (normalizedCategoryId) {
      return normalizedCategoryId as PlayerFacingSkillCategoryId;
    }
  }

  return inferPlayerFacingSkillCategoryIdFromGroupIds(skill);
}

export function getAccessibleFoundationalSkillIdsForSocietyBand(
  entries: SocietyBandSkillAccess[],
  input: { socialBand: number; societyId: string }
): string[] {
  const matchingEntries = entries.filter(
    (entry) =>
      entry.societyId === input.societyId &&
      entry.socialBand === input.socialBand
  );

  return [...new Set(matchingEntries.map((entry) => entry.skillId))];
}
