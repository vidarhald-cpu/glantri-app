import { z } from "zod";

import { normalizeSkillGroupId } from "../content/skills";

const idSchema = z.string().min(1);
const professionGrantTypeSchema = z.enum(["group", "ordinary-skill", "secondary-skill"]);
const professionGrantScopeSchema = z.enum(["family", "profession"]);

const retiredProfessionIdAliases: Record<string, string> = {
  entertainers_dancer_acrobat: "dancer_acrobat",
  entertainers_singer_musician: "musician",
  entertainers_trickster_fool: "entertainer",
};

export function normalizeProfessionId(input: unknown): string | undefined {
  if (typeof input !== "string" || input.length === 0) {
    return undefined;
  }

  return retiredProfessionIdAliases[input] ?? input;
}

/**
 * Reader-content layer (Forgejo #361). A Profession's reader prose: one line for tables and cards,
 * a several-paragraph full description for Inspectors, what a practitioner actually does, and what
 * the occupation's training does not supply. `fullDescription` is never a copy of
 * `shortDescription`, and neither is ever sourced from the catalogue's authoring `note`.
 */
const readerContentFields = {
  shortDescription: z.string().optional(),
  fullDescription: z.string().optional(),
  typicalActivities: z.array(z.string().min(1)).optional(),
  boundaries: z.array(z.string().min(1)).optional(),
} as const;

export const professionFamilyDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  ...readerContentFields,
});

export const professionDefinitionSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    const candidate = input as {
      familyId?: unknown;
      subtypeName?: unknown;
      name?: unknown;
      id?: unknown;
    };

    return {
      ...candidate,
      familyId: candidate.familyId ?? candidate.id,
      subtypeName: candidate.subtypeName ?? candidate.name,
    };
  },
  z.object({
    id: idSchema,
    familyId: idSchema,
    name: z.string().min(1),
    subtypeName: z.string().min(1),
    description: z.string().optional(),
    ...readerContentFields,
    exclusiveLearningGroupPairs: z.array(z.tuple([idSchema, idSchema])).optional(),
  }),
);

export const professionSkillMapSchema = z.preprocess(
  (input) => {
    if (typeof input !== "object" || input === null) {
      return input;
    }

    const candidate = input as { skillGroupId?: unknown };

    return {
      ...candidate,
      skillGroupId: normalizeSkillGroupId(candidate.skillGroupId) ?? candidate.skillGroupId,
    };
  },
  z.object({
    professionId: idSchema,
    scope: professionGrantScopeSchema.default("profession"),
    grantType: professionGrantTypeSchema,
    skillId: idSchema.optional(),
    skillGroupId: idSchema.optional(),
    specializationId: idSchema.optional(),
    ranks: z.number().int().nonnegative().default(0),
    isCore: z.boolean().default(false),
  }),
);

export type ProfessionFamilyDefinition = z.infer<typeof professionFamilyDefinitionSchema>;
export type ProfessionDefinition = z.infer<typeof professionDefinitionSchema>;
export type ProfessionSkillMap = z.infer<typeof professionSkillMapSchema>;
export type ProfessionGrantType = z.infer<typeof professionGrantTypeSchema>;
export type ProfessionGrantScope = z.infer<typeof professionGrantScopeSchema>;
