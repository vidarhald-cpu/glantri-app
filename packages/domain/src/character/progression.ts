import { z } from "zod";
import {
  inferPlayerFacingSkillCategoryIdFromGroupIds,
  normalizePlayerFacingSkillCategoryId,
  normalizeSkillGroupId,
  normalizeSkillGroupIds,
  playerFacingSkillCategoryIdSchema
} from "../content/skills";

const chargenModeSchema = z.enum(["standard"]);
const skillCategorySchema = z.enum(["ordinary", "secondary"]);
const characterSkillSourceSchema = z.enum(["mother-tongue"]);
const chargenSelectionIdsSchema = z.array(z.string().min(1)).default([]);
const characterChargenGroupSlotSelectionSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    const candidate = input as { groupId?: unknown };

    return {
      ...candidate,
      groupId: normalizeSkillGroupId(candidate.groupId) ?? candidate.groupId
    };
  },
  z.object({
    groupId: z.string().min(1),
    selectedSkillIds: chargenSelectionIdsSchema,
    slotId: z.string().min(1)
  })
);

export const characterSkillGroupSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    const candidate = input as { groupId?: unknown };

    return {
      ...candidate,
      groupId: normalizeSkillGroupId(candidate.groupId) ?? candidate.groupId
    };
  },
  z.object({
    groupId: z.string().min(1),
    grantedRanks: z.number().int().nonnegative().default(0),
    primaryRanks: z.number().int().nonnegative().default(0),
    secondaryRanks: z.number().int().nonnegative().default(0),
    ranks: z.number().int().nonnegative().default(0),
    gms: z.number().int().default(0)
  })
);

const LEGACY_LEADERSHIP_CATEGORY_BY_SKILL_ID: Record<string, string> = {
  captaincy: "military",
  insight: "social",
  intrigue: "social",
  social_perception: "social",
  tactics: "military",
  teamster: "fieldcraft",
  teamstering: "fieldcraft"
};

function normalizeCharacterSkillCategoryInput(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }

  const candidate = input as {
    categoryId?: unknown;
    groupId?: unknown;
    groupIds?: unknown;
    skillId?: unknown;
  };
  const normalizedGroupIds = normalizeSkillGroupIds(
    Array.isArray(candidate.groupIds)
      ? candidate.groupIds
      : candidate.groupId !== undefined
        ? [candidate.groupId]
        : undefined
  );
  const normalizedGroupId = normalizeSkillGroupId(candidate.groupId) ?? normalizedGroupIds[0];
  const normalizedCandidate = {
    ...candidate,
    groupId: normalizedGroupId ?? candidate.groupId,
    groupIds: normalizedGroupIds.length > 0 ? normalizedGroupIds : undefined
  };
  const categoryId =
    typeof candidate.categoryId === "string" && candidate.categoryId.length > 0
      ? candidate.categoryId
      : undefined;
  const normalizedCategoryKey = categoryId?.trim().toLowerCase().replace(/[\s_]+/g, "-");
  const normalizedCategoryId = normalizePlayerFacingSkillCategoryId(categoryId);

  if (normalizedCategoryId) {
    return {
      ...normalizedCandidate,
      categoryId: normalizedCategoryId
    };
  }

  if (normalizedCategoryKey !== "leadership") {
    return normalizedCandidate;
  }

  const inferredCategoryId = inferPlayerFacingSkillCategoryIdFromGroupIds({
    groupId: normalizedGroupId,
    groupIds: normalizedGroupIds
  });
  const skillCategoryId =
    typeof candidate.skillId === "string"
      ? LEGACY_LEADERSHIP_CATEGORY_BY_SKILL_ID[candidate.skillId]
      : undefined;

  return {
    ...normalizedCandidate,
    categoryId:
      inferredCategoryId === "special-access"
        ? skillCategoryId ?? "social"
        : inferredCategoryId
  };
}

export const characterSkillSchema = z.preprocess(
  normalizeCharacterSkillCategoryInput,
  z.object({
    category: skillCategorySchema.default("ordinary"),
    categoryId: playerFacingSkillCategoryIdSchema.optional(),
    grantedRanks: z.number().int().nonnegative().default(0),
    groupId: z.string().min(1),
    groupIds: z.array(z.string().min(1)).optional(),
    languageName: z.string().min(1).optional(),
    primaryRanks: z.number().int().nonnegative().default(0),
    relationshipGrantedRanks: z.number().int().nonnegative().optional(),
    relationshipGrantSourceName: z.string().min(1).optional(),
    relationshipGrantSourceSkillId: z.string().min(1).optional(),
    relationshipGrantSourceType: z
      .enum([
        "explicit",
        "melee-cross-training",
        "specialization-bridge-child",
        "specialization-bridge-parent"
      ])
      .optional(),
    secondaryRanks: z.number().int().nonnegative().default(0),
    skillId: z.string().min(1),
    ranks: z.number().int().nonnegative().default(0),
    level: z.number().int().default(0),
    sourceTag: characterSkillSourceSchema.optional()
  })
);

export const characterSpecializationSchema = z.object({
  relationshipGrantedRanks: z.number().int().nonnegative().optional(),
  relationshipGrantSourceName: z.string().min(1).optional(),
  relationshipGrantSourceSkillId: z.string().min(1).optional(),
  relationshipGrantSourceType: z
    .enum([
      "explicit",
      "melee-cross-training",
      "specialization-bridge-child",
      "specialization-bridge-parent"
    ])
    .optional(),
  specializationId: z.string().min(1),
  skillId: z.string().min(1),
  secondaryRanks: z.number().int().nonnegative().default(0),
  ranks: z.number().int().nonnegative().default(0),
  level: z.number().int().default(0)
});

export const characterChargenSelectionsSchema = z.object({
  selectedLanguageIds: chargenSelectionIdsSchema,
  selectedSkillIds: chargenSelectionIdsSchema,
  selectedGroupSlots: z.array(characterChargenGroupSlotSelectionSchema).default([])
});

export const progressionTargetTypeSchema = z.enum([
  "stat",
  "skill",
  "skillGroup",
  "specialization"
]);

const progressionTargetBaseSchema = z.object({
  targetId: z.string().min(1),
  targetLabel: z.string().min(1),
  targetType: progressionTargetTypeSchema
});

export const characterProgressionCheckSchema = progressionTargetBaseSchema.extend({
  checkedAt: z.string().min(1),
  checkedBy: z.string().min(1).optional(),
  id: z.string().min(1),
  notes: z.string().optional(),
  provisional: z.boolean().optional()
});

export const characterProgressionPendingAttemptSchema = progressionTargetBaseSchema.extend({
  checkId: z.string().min(1),
  cost: z.number().int().nonnegative(),
  id: z.string().min(1),
  purchasedAt: z.string().min(1),
  purchasedBy: z.string().min(1).optional()
});

export const characterProgressionHistoryEntrySchema = progressionTargetBaseSchema.extend({
  afterValue: z.number(),
  beforeValue: z.number(),
  cost: z.number().int().nonnegative(),
  id: z.string().min(1),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  resolvedAt: z.string().min(1),
  rollD20: z.number().int().min(1).max(20),
  rollTotal: z.number().int().nonnegative(),
  success: z.boolean(),
  threshold: z.number()
});

export const characterProgressionStateSchema = z.object({
  availablePoints: z.number().int().nonnegative().default(0),
  checks: z.array(characterProgressionCheckSchema).default([]),
  history: z.array(characterProgressionHistoryEntrySchema).default([]),
  pendingAttempts: z.array(characterProgressionPendingAttemptSchema).default([])
});

export const characterProgressionSchema = z.object({
  chargenMode: chargenModeSchema.default("standard"),
  primaryPoolSpent: z.number().int().nonnegative().default(0),
  primaryPoolTotal: z.number().int().nonnegative().default(60),
  secondaryPoolSpent: z.number().int().nonnegative().default(0),
  secondaryPoolTotal: z.number().int().nonnegative().default(0),
  flexiblePointFactor: z.number().positive().default(1),
  level: z.number().int().positive().default(1),
  skillGroups: z.array(characterSkillGroupSchema).default([]),
  skills: z.array(characterSkillSchema).default([]),
  specializations: z.array(characterSpecializationSchema).default([]),
  educationPoints: z.number().int().nonnegative().default(0),
  chargenSelections: characterChargenSelectionsSchema.optional()
});

export type CharacterSkillGroup = z.infer<typeof characterSkillGroupSchema>;
export type CharacterSkill = z.infer<typeof characterSkillSchema>;
export type CharacterSpecialization = z.infer<typeof characterSpecializationSchema>;
export type CharacterChargenGroupSlotSelection = z.infer<
  typeof characterChargenGroupSlotSelectionSchema
>;
export type CharacterChargenSelections = z.infer<typeof characterChargenSelectionsSchema>;
export type CharacterProgression = z.infer<typeof characterProgressionSchema>;
export type ChargenMode = z.infer<typeof chargenModeSchema>;
export type ProgressionTargetType = z.infer<typeof progressionTargetTypeSchema>;
export type CharacterProgressionCheck = z.infer<typeof characterProgressionCheckSchema>;
export type CharacterProgressionPendingAttempt = z.infer<
  typeof characterProgressionPendingAttemptSchema
>;
export type CharacterProgressionHistoryEntry = z.infer<
  typeof characterProgressionHistoryEntrySchema
>;
export type CharacterProgressionState = z.infer<typeof characterProgressionStateSchema>;

export function normalizeCharacterSkillLanguageName(
  languageName: string | undefined
): string | undefined {
  const normalized = languageName?.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized === "undefined" || normalized === "null") {
    return undefined;
  }

  return normalized;
}

export function getCharacterSkillKey(
  skill: Pick<CharacterSkill, "skillId" | "languageName">
): string {
  const normalizedLanguageName = normalizeCharacterSkillLanguageName(skill.languageName);
  return normalizedLanguageName
    ? `${skill.skillId}::language:${normalizedLanguageName}`
    : skill.skillId;
}

export function isSameCharacterSkill(
  left: Pick<CharacterSkill, "skillId" | "languageName">,
  right: Pick<CharacterSkill, "skillId" | "languageName">
): boolean {
  return getCharacterSkillKey(left) === getCharacterSkillKey(right);
}
