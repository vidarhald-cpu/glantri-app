import { z } from "zod";

export const characterSchema = z.object({
  id: z.string(),
  level: z.number().int().nonnegative(),
  name: z.string()
});

export type Character = z.infer<typeof characterSchema>;
