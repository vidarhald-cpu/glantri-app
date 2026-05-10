import { z } from "zod";

export const combatContextSchema = z.object({
  attackerId: z.string(),
  defenderId: z.string(),
  phase: z.enum(["PHASE_1", "PHASE_2"])
});

export type CombatContext = z.infer<typeof combatContextSchema>;
