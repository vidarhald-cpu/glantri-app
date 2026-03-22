import { z } from "zod";

import { characterEquipmentSchema } from "./equipment";
import { characterProgressionSchema } from "./progression";
import { rolledCharacterProfileSchema } from "./profiles";

export const characterBuildSchema = z.object({
  equipment: characterEquipmentSchema.default({ items: [] }),
  id: z.string().min(1),
  name: z.string().min(1),
  profile: rolledCharacterProfileSchema,
  progression: characterProgressionSchema,
  professionId: z.string().min(1).optional(),
  socialClass: z.string().min(1).optional(),
  societyId: z.string().min(1).optional(),
  societyLevel: z.number().int().nonnegative().optional()
});

export const characterValidationIssueSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  path: z.string().optional()
});

export const characterBuildValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(characterValidationIssueSchema)
});

export type CharacterBuild = z.infer<typeof characterBuildSchema>;
export type CharacterValidationIssue = z.infer<typeof characterValidationIssueSchema>;
export type CharacterBuildValidationResult = z.infer<
  typeof characterBuildValidationResultSchema
>;
