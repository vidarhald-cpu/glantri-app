import { z } from "zod";

const idSchema = z.string().min(1);
const literacyRequirementSchema = z.enum(["no", "recommended", "required"]);
const skillCategorySchema = z.enum(["ordinary", "secondary"]);

export const skillGroupDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0)
});

export const skillDefinitionSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    const candidate = input as {
      groupId?: unknown;
      groupIds?: unknown;
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

    return {
      ...candidate,
      groupId: normalizedGroupId,
      groupIds: normalizedGroupIds
    };
  },
  z.object({
    id: idSchema,
    groupId: idSchema,
    groupIds: z.array(idSchema).min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    linkedStats: z.array(z.string().min(1)).min(1),
    isTheoretical: z.boolean().default(false),
    category: skillCategorySchema.default("ordinary"),
    requiresLiteracy: literacyRequirementSchema.default("no"),
    sortOrder: z.number().int().default(0),
    allowsSpecializations: z.boolean().default(false)
  })
);

export const skillSpecializationSchema = z.object({
  id: idSchema,
  skillId: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  minimumGroupLevel: z.number().int().nonnegative().default(11),
  sortOrder: z.number().int().default(0)
});

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

export type SkillGroupDefinition = z.infer<typeof skillGroupDefinitionSchema>;
export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;
export type SkillSpecialization = z.infer<typeof skillSpecializationSchema>;
export type SocietyLevelAccess = z.infer<typeof societyLevelAccessSchema>;
export type LiteracyRequirement = z.infer<typeof literacyRequirementSchema>;
export type SkillCategory = z.infer<typeof skillCategorySchema>;

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
