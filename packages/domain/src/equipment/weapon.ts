import { z } from "zod";

export const weaponSchema = z.object({
  baseOb: z.number(),
  id: z.string(),
  name: z.string()
});

export type Weapon = z.infer<typeof weaponSchema>;
