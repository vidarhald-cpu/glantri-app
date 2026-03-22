import { z } from "zod";

export const glantriCharacteristicKeySchema = z.enum([
  "str",
  "dex",
  "con",
  "health",
  "siz",
  "com",
  "cha",
  "int",
  "pow",
  "lck",
  "will"
]);

export const glantriCharacteristicOrder = [
  "str",
  "dex",
  "con",
  "health",
  "siz",
  "com",
  "cha",
  "int",
  "pow",
  "lck",
  "will"
] as const;

export const glantriCharacteristicLabels: Record<
  z.infer<typeof glantriCharacteristicKeySchema>,
  string
> = {
  cha: "Cha",
  com: "Com",
  con: "Con",
  dex: "Dex",
  health: "Health",
  int: "Int",
  lck: "Lck",
  pow: "Pow",
  siz: "Siz",
  str: "Str",
  will: "Will"
};

export const glantriCharacteristicBlockSchema = z.object({
  cha: z.number().int().min(1).max(25),
  com: z.number().int().min(1).max(25),
  con: z.number().int().min(1).max(25),
  dex: z.number().int().min(1).max(25),
  health: z.number().int().min(1).max(25),
  int: z.number().int().min(1).max(25),
  lck: z.number().int().min(1).max(25),
  pow: z.number().int().min(1).max(25),
  siz: z.number().int().min(1).max(25),
  str: z.number().int().min(1).max(25),
  will: z.number().int().min(1).max(25)
});

export const rolledCharacterProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  distractionLevel: z.number().int().min(2).max(6),
  rolledStats: glantriCharacteristicBlockSchema,
  socialClassEducationValue: z.number().int().nonnegative().optional(),
  socialClassResult: z.string().min(1).optional(),
  socialClassRoll: z.number().int().min(1).max(20).optional(),
  socialClassTableId: z.string().min(1).optional(),
  societyLevel: z.number().int().nonnegative().default(0)
});

export type GlantriCharacteristicKey = z.infer<typeof glantriCharacteristicKeySchema>;
export type GlantriCharacteristicBlock = z.infer<typeof glantriCharacteristicBlockSchema>;
export type RolledCharacterProfile = z.infer<typeof rolledCharacterProfileSchema>;
