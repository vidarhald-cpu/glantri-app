import { z } from "zod";

import { combatDistanceSchema } from "./combatDistance";

const idSchema = z.string().min(1);

export const distancePreferenceIntentSourceSchema = z.enum(["player_declared", "gm_proxy"]);
export type DistancePreferenceIntentSource = z.infer<
  typeof distancePreferenceIntentSourceSchema
>;

export const distancePreferenceIntentPhaseSchema = z.enum(["phase1", "phase2", "round"]);
export type DistancePreferenceIntentPhase = z.infer<
  typeof distancePreferenceIntentPhaseSchema
>;

export const distancePreferenceIntentSchema = z.object({
  desiredDistance: combatDistanceSchema,
  notes: z.string().min(1).optional(),
  phase: distancePreferenceIntentPhaseSchema.optional(),
  source: distancePreferenceIntentSourceSchema,
  targetParticipantId: idSchema,
});
export type DistancePreferenceIntent = z.infer<typeof distancePreferenceIntentSchema>;

export const movementIntentModeSchema = z.enum([
  "hold_position",
  "set_distance_preferences",
]);
export type MovementIntentMode = z.infer<typeof movementIntentModeSchema>;

export const movementIntentSchema = z.object({
  distancePreferences: z.array(distancePreferenceIntentSchema).default([]),
  mode: movementIntentModeSchema.default("hold_position"),
});
export type MovementIntent = z.infer<typeof movementIntentSchema>;

export function createHoldPositionMovementIntent(): MovementIntent {
  return movementIntentSchema.parse({
    distancePreferences: [],
    mode: "hold_position",
  });
}

export function normalizeMovementIntent(value: unknown): MovementIntent | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsed = movementIntentSchema.parse(value);

  return parsed.mode === "hold_position"
    ? createHoldPositionMovementIntent()
    : movementIntentSchema.parse({
        ...parsed,
        distancePreferences: parsed.distancePreferences,
      });
}
