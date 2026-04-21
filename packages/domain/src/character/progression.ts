import { z } from "zod";

const chargenModeSchema = z.enum(["standard"]);
const skillCategorySchema = z.enum(["ordinary", "secondary"]);
const characterSkillSourceSchema = z.enum(["mother-tongue"]);
const chargenSelectionIdsSchema = z.array(z.string().min(1)).default([]);
const characterChargenGroupSlotSelectionSchema = z.object({
  groupId: z.string().min(1),
  selectedSkillIds: chargenSelectionIdsSchema,
  slotId: z.string().min(1)
});

export const characterSkillGroupSchema = z.object({
  groupId: z.string().min(1),
  grantedRanks: z.number().int().nonnegative().default(0),
  primaryRanks: z.number().int().nonnegative().default(0),
  secondaryRanks: z.number().int().nonnegative().default(0),
  ranks: z.number().int().nonnegative().default(0),
  gms: z.number().int().default(0)
});

export const characterSkillSchema = z.object({
  category: skillCategorySchema.default("ordinary"),
  grantedRanks: z.number().int().nonnegative().default(0),
  groupId: z.string().min(1),
  languageName: z.string().min(1).optional(),
  primaryRanks: z.number().int().nonnegative().default(0),
  secondaryRanks: z.number().int().nonnegative().default(0),
  skillId: z.string().min(1),
  ranks: z.number().int().nonnegative().default(0),
  level: z.number().int().default(0),
  sourceTag: characterSkillSourceSchema.optional()
});

export const characterSpecializationSchema = z.object({
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

export const characterProgressionSchema = z.object({
  chargenMode: chargenModeSchema.default("standard"),
  primaryPoolSpent: z.number().int().nonnegative().default(0),
  primaryPoolTotal: z.number().int().nonnegative().default(60),
  secondaryPoolSpent: z.number().int().nonnegative().default(0),
  secondaryPoolTotal: z.number().int().nonnegative().default(0),
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
