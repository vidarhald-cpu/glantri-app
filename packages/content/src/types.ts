import { z } from "zod";

import {
  languageDefinitionSchema,
  professionFamilyDefinitionSchema,
  professionDefinitionSchema,
  professionSkillMapSchema,
  societyDefinitionSchema,
  skillDefinitionSchema,
  skillGroupDefinitionSchema,
  skillSpecializationSchema,
  societyLevelAccessSchema
} from "@glantri/domain";

export const canonicalContentSchema = z.object({
  languages: z.array(languageDefinitionSchema).default([]),
  skillGroups: z.array(skillGroupDefinitionSchema).default([]),
  skills: z.array(skillDefinitionSchema).default([]),
  specializations: z.array(skillSpecializationSchema).default([]),
  professionFamilies: z.array(professionFamilyDefinitionSchema).default([]),
  professions: z.array(professionDefinitionSchema).default([]),
  professionSkills: z.array(professionSkillMapSchema).default([]),
  societies: z.array(societyDefinitionSchema).default([]),
  societyLevels: z.array(societyLevelAccessSchema).default([])
});

export type CanonicalContent = z.infer<typeof canonicalContentSchema>;

export interface CanonicalContentLoader {
  load(): Promise<CanonicalContent>;
}
