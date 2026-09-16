import { z } from "zod";

import {
  civilizationDefinitionSchema,
  languageDefinitionSchema,
  professionFamilyDefinitionSchema,
  professionDefinitionSchema,
  professionSkillMapSchema,
  societyBandSkillAccessSchema,
  societyDefinitionSchema,
  skillDefinitionSchema,
  skillGroupDefinitionSchema,
  skillSpecializationSchema,
  societyLevelAccessSchema,
} from "@glantri/domain";

export const canonicalContentSchema = z.object({
  civilizations: z.array(civilizationDefinitionSchema).default([]),
  languages: z.array(languageDefinitionSchema).default([]),
  skillGroups: z.array(skillGroupDefinitionSchema).default([]),
  skills: z.array(skillDefinitionSchema).default([]),
  specializations: z.array(skillSpecializationSchema).default([]),
  professionFamilies: z.array(professionFamilyDefinitionSchema).default([]),
  professions: z.array(professionDefinitionSchema).default([]),
  professionSkills: z.array(professionSkillMapSchema).default([]),
  societies: z.array(societyDefinitionSchema).default([]),
  societyLevels: z.array(societyLevelAccessSchema).default([]),
  societyBandSkillAccess: z.array(societyBandSkillAccessSchema).default([]),
});

// Runtime Chargen can project explicitly tagged target definitions after validating
// the legacy compatibility payload. This does not widen the canonical JSON schema.
export type CanonicalContent = Omit<z.infer<typeof canonicalContentSchema>, "skills"> & {
  skills: import("@glantri/domain").SkillDefinition[];
  chargenCatalogue?: {
    sourceId: "full-target-competencies";
    skillIds: readonly string[];
    specializationIds: readonly string[];
  };
  compatibilityContent?: CanonicalContent;
};

export interface CanonicalContentLoader {
  load(): Promise<CanonicalContent>;
}
