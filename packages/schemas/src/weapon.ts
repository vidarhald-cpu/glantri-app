import { z } from "zod";

export const weaponSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseOb: z.number()
});

export type Weapon = z.infer<typeof weaponSchema>;
