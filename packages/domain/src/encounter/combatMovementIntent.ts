import { z } from "zod";

import { combatDistanceSchema } from "./combatDistance";
import { combatGenericActionDurationSchema } from "./combatGenericAction";

const idSchema = z.string().min(1);

export const distancePreferenceIntentSourceSchema = z.enum(["player_declared", "gm_proxy"]);
export type DistancePreferenceIntentSource = z.infer<typeof distancePreferenceIntentSourceSchema>;

export const distancePreferenceIntentPhaseSchema = z.enum(["phase1", "phase2", "round"]);
export type DistancePreferenceIntentPhase = z.infer<typeof distancePreferenceIntentPhaseSchema>;

export const distancePreferenceIntentSchema = z.object({
  desiredDistance: combatDistanceSchema,
  notes: z.string().min(1).optional(),
  operation: z.enum(["maintain", "close", "open", "retreat"]).optional(),
  phase: distancePreferenceIntentPhaseSchema.optional(),
  source: distancePreferenceIntentSourceSchema,
  targetParticipantId: idSchema,
});
export type DistancePreferenceIntent = z.infer<typeof distancePreferenceIntentSchema>;

export const movementIntentModeSchema = z.enum([
  "hold_position",
  "set_distance_preferences",
  "move_in_environment",
]);
export type MovementIntentMode = z.infer<typeof movementIntentModeSchema>;

export const environmentalMovementPaceSchema = z.enum(["walk", "run", "reposition"]);
export type EnvironmentalMovementPace = z.infer<typeof environmentalMovementPaceSchema>;

export const environmentalMovementDestinationSchema = z.discriminatedUnion("kind", [
  z.object({
    description: z.string().trim().min(1).max(500),
    kind: z.literal("description"),
  }),
]);
export type EnvironmentalMovementDestination = z.infer<
  typeof environmentalMovementDestinationSchema
>;

export const environmentalMovementIntentSchema = z.object({
  actionId: idSchema.optional(),
  destination: environmentalMovementDestinationSchema,
  duration: combatGenericActionDurationSchema,
  pace: environmentalMovementPaceSchema,
});
export type EnvironmentalMovementIntent = z.infer<typeof environmentalMovementIntentSchema>;

export const movementIntentSchema = z
  .object({
    distancePreferences: z.array(distancePreferenceIntentSchema).default([]),
    environmentalMovement: environmentalMovementIntentSchema.optional(),
    mode: movementIntentModeSchema.default("hold_position"),
  })
  .superRefine((intent, context) => {
    if (intent.mode === "move_in_environment") {
      if (!intent.environmentalMovement) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Environmental movement requires a destination.",
          path: ["environmentalMovement"],
        });
      }
      if (intent.distancePreferences.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Environmental movement cannot contain participant distance preferences.",
          path: ["distancePreferences"],
        });
      }
      return;
    }

    if (intent.environmentalMovement) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Participant-relative movement cannot contain an environmental destination.",
        path: ["environmentalMovement"],
      });
    }
  });
export type MovementIntent = z.infer<typeof movementIntentSchema>;

export function createHoldPositionMovementIntent(): MovementIntent {
  return movementIntentSchema.parse({
    distancePreferences: [],
    mode: "hold_position",
  });
}

export function getMovementIntentLabel(intent?: MovementIntent): string | undefined {
  if (!intent) return undefined;
  if (intent.mode === "hold_position") return "Hold position";
  if (intent.mode === "set_distance_preferences") return "Change distance to participant";
  const movement = intent.environmentalMovement;
  if (!movement) return "Move in environment";
  const pace = movement.pace === "run" ? "Run" : movement.pace === "walk" ? "Walk" : "Reposition";
  return `${pace} to ${movement.destination.description}`;
}

export function normalizeMovementIntent(value: unknown): MovementIntent | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsed = movementIntentSchema.parse(value);

  return parsed.mode === "hold_position"
    ? createHoldPositionMovementIntent()
    : parsed.mode === "move_in_environment"
      ? movementIntentSchema.parse({
          distancePreferences: [],
          environmentalMovement: parsed.environmentalMovement,
          mode: "move_in_environment",
        })
      : movementIntentSchema.parse({
          ...parsed,
          distancePreferences: parsed.distancePreferences,
        });
}
