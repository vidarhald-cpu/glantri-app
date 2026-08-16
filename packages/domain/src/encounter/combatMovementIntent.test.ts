import { describe, expect, it } from "vitest";

import {
  getMovementIntentLabel,
  movementIntentSchema,
  normalizeMovementIntent,
} from "./combatMovementIntent";

describe("Combat movement intent", () => {
  it("keeps participant-relative and environmental intent structures distinct", () => {
    const relative = movementIntentSchema.parse({
      distancePreferences: [
        {
          desiredDistance: 1,
          operation: "close",
          source: "player_declared",
          targetParticipantId: "guard",
        },
      ],
      mode: "set_distance_preferences",
    });
    const environmental = movementIntentSchema.parse({
      environmentalMovement: {
        destination: { description: "doorway", kind: "description" },
        duration: { kind: "rounds", rounds: 3 },
        pace: "run",
      },
      mode: "move_in_environment",
    });

    expect(relative).toMatchObject({
      distancePreferences: [{ operation: "close", targetParticipantId: "guard" }],
      mode: "set_distance_preferences",
    });
    expect(relative.environmentalMovement).toBeUndefined();
    expect(environmental).toEqual({
      distancePreferences: [],
      environmentalMovement: {
        destination: { description: "doorway", kind: "description" },
        duration: { kind: "rounds", rounds: 3 },
        pace: "run",
      },
      mode: "move_in_environment",
    });
    expect(getMovementIntentLabel(environmental)).toBe("Run to doorway");
  });

  it("rejects a mixed environmental and pair-distance payload", () => {
    expect(() =>
      movementIntentSchema.parse({
        distancePreferences: [
          {
            desiredDistance: 2,
            source: "player_declared",
            targetParticipantId: "guard",
          },
        ],
        environmentalMovement: {
          destination: { description: "doorway", kind: "description" },
          duration: { kind: "round" },
          pace: "walk",
        },
        mode: "move_in_environment",
      }),
    ).toThrow("Environmental movement cannot contain participant distance preferences");
  });

  it("normalizes environmental movement without inventing tactical geometry", () => {
    expect(
      normalizeMovementIntent({
        environmentalMovement: {
          destination: { description: "wounded ally", kind: "description" },
          duration: { kind: "gm_decided" },
          pace: "reposition",
        },
        mode: "move_in_environment",
      }),
    ).toEqual({
      distancePreferences: [],
      environmentalMovement: {
        destination: { description: "wounded ally", kind: "description" },
        duration: { kind: "gm_decided" },
        pace: "reposition",
      },
      mode: "move_in_environment",
    });
  });
});
