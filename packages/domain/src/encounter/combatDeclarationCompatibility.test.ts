import { describe, expect, it } from "vitest";

import {
  getCombatDeclarationCompatibilityRule,
  getCombatDeclarationRequiredContexts,
  validateCombatDeclarationCompatibility,
} from "./combatDeclarationCompatibility";

describe("combat declaration compatibility", () => {
  it("allows Parry with Open or Observe Opponent and current movement", () => {
    expect(getCombatDeclarationCompatibilityRule("parry")).toMatchObject({
      allowedMovementKinds: ["hold_position", "set_distance_preferences"],
      allowedSecondaryActions: ["observe_opponent"],
      primaryAction: "parry",
    });
    expect(
      validateCombatDeclarationCompatibility({
        movementKind: "hold_position",
        primaryAction: "parry",
      }),
    ).toEqual({ valid: true });
    expect(
      validateCombatDeclarationCompatibility({
        movementKind: "set_distance_preferences",
        primaryAction: "parry",
        secondaryAction: "observe_opponent",
      }),
    ).toEqual({ valid: true });
    expect(
      getCombatDeclarationRequiredContexts({
        primaryAction: "parry",
        secondaryAction: "observe_opponent",
      }),
    ).toEqual(["secondary_target_participant"]);
  });

  it("rejects an undefined secondary combination precisely", () => {
    expect(
      validateCombatDeclarationCompatibility({
        primaryAction: "parry",
        secondaryAction: "offensive_parry",
      }),
    ).toEqual({
      message: "offensive_parry is not compatible with the selected primary action.",
      valid: false,
    });
    expect(
      validateCombatDeclarationCompatibility({
        primaryAction: "attack_parry",
        secondaryAction: "observe_opponent",
      }),
    ).toEqual({
      message: "observe_opponent is not compatible with the selected primary action.",
      valid: false,
    });
  });

  it("rejects Observe Opponent as a primary action", () => {
    expect(
      validateCombatDeclarationCompatibility({
        primaryAction: "observe_opponent",
      }),
    ).toEqual({
      message: "Observe Opponent is a secondary action.",
      valid: false,
    });
  });
});
