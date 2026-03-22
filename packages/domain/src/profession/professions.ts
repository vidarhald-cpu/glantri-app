import { z } from "zod";

const idSchema = z.string().min(1);
const professionGrantTypeSchema = z.enum(["group", "ordinary-skill", "secondary-skill"]);

export const professionDefinitionSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().optional()
});

export const professionSkillMapSchema = z.object({
  professionId: idSchema,
  grantType: professionGrantTypeSchema,
  skillId: idSchema.optional(),
  skillGroupId: idSchema.optional(),
  specializationId: idSchema.optional(),
  ranks: z.number().int().nonnegative().default(0),
  isCore: z.boolean().default(false)
});

export type ProfessionDefinition = z.infer<typeof professionDefinitionSchema>;
export type ProfessionSkillMap = z.infer<typeof professionSkillMapSchema>;
export type ProfessionGrantType = z.infer<typeof professionGrantTypeSchema>;
