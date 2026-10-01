import { z } from "zod";

export const combatRoundStepSchema = z.enum([
  // Ruling 2 (#215): the Combat Experience pre-declaration step. A round opens here so that a
  // Combat Experience check that has become *due* — by schedule or by a Critical-triggered reset —
  // is resolved before declarations are made against the prior result. "Due" is not "expired": the
  // previous Combat Experience state stays active and auditable until a fresh roll replaces it here.
  "pre_declaration",
  "select_actions",
  "review_action_modifiers",
  "initiative_phase_1",
  "phase_1_actions",
  "review_phase_2_actions",
  "phase_1_damage",
  "review_phase_2_modifiers",
  "initiative_phase_2",
  "phase_2_actions",
  "review_phase_2_damage",
  "phase_2_damage",
  "round_summary",
]);

export const COMBAT_ROUND_STEPS = combatRoundStepSchema.options;
export type CombatRoundStep = z.infer<typeof combatRoundStepSchema>;
