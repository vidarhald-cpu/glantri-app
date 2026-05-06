import { z } from "zod";

export const DEFAULT_CHARGEN_RULE_SET_ID = "legacy_default";
export const DEFAULT_CHARGEN_RULE_SET_NAME = "Legacy default";

export const chargenRuleSetParametersSchema = z.object({
  exchangeCount: z.number().int().min(0).max(50),
  flexiblePointFactor: z.number().positive().max(5),
  ordinarySkillPoints: z.number().int().min(0).max(500),
  statRollCount: z.number().int().min(1).max(50)
});

export const chargenRuleSetSchema = chargenRuleSetParametersSchema.extend({
  archivedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  id: z.string().min(1),
  isActive: z.boolean().default(false),
  name: z.string().trim().min(1),
  updatedAt: z.string().datetime()
});

export const characterChargenRuleSetSnapshotSchema = chargenRuleSetParametersSchema.extend({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1)
});

export const DEFAULT_CHARGEN_RULE_SET_PARAMETERS: ChargenRuleSetParameters = {
  exchangeCount: 2,
  flexiblePointFactor: 1,
  ordinarySkillPoints: 60,
  statRollCount: 20
};

export const DEFAULT_CHARGEN_RULE_SET: ChargenRuleSet = {
  ...DEFAULT_CHARGEN_RULE_SET_PARAMETERS,
  createdAt: "1970-01-01T00:00:00.000Z",
  id: DEFAULT_CHARGEN_RULE_SET_ID,
  isActive: true,
  name: DEFAULT_CHARGEN_RULE_SET_NAME,
  updatedAt: "1970-01-01T00:00:00.000Z"
};

export type ChargenRuleSetParameters = z.infer<typeof chargenRuleSetParametersSchema>;
export type ChargenRuleSet = z.infer<typeof chargenRuleSetSchema>;
export type CharacterChargenRuleSetSnapshot = z.infer<
  typeof characterChargenRuleSetSnapshotSchema
>;
