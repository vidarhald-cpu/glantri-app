import { z } from "zod";

export const characterSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().nonnegative()
});

export type Character = z.infer<typeof characterSchema>;
