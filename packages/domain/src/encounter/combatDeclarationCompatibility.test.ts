import { describe, expect, it } from "vitest";

import {
  getCombatDeclarationCapabilityStatus,
  getCombatDeclarationCompatibilityRule,
  getCombatDeclarationRequiredContexts,
  isCombatDeclarationActionAvailable,
  validateCombatDeclarationActionAvailability,
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
      message: "Combat secondary action is not yet available: offensive_parry.",
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

  it("owns executable capability status for every exposed declaration family", () => {
    for (const actionId of [
      "attack_parry",
      "parry_attack",
      "double_attack",
      "feint_attack",
      "adjust_range_attack",
      "offensive_parry",
      "parry",
    ]) {
      expect(isCombatDeclarationActionAvailable({ actionId, kind: "primary" })).toBe(true);
    }

    expect(
      getCombatDeclarationCapabilityStatus({ actionId: "counterattack", kind: "primary" }),
    ).toBe("unavailable");
    expect(getCombatDeclarationCapabilityStatus({ actionId: "disarm", kind: "primary" })).toBe(
      "unavailable",
    );
    for (const actionId of ["parry_disarm", "break_off_engagement", "other"]) {
      expect(getCombatDeclarationCapabilityStatus({ actionId, kind: "primary" })).toBe(
        "legacy_only",
      );
    }
    expect(
      getCombatDeclarationCapabilityStatus({
        actionId: "observe_opponent",
        kind: "secondary",
      }),
    ).toBe("available");
    expect(getCombatDeclarationCapabilityStatus({ actionId: "move_only", kind: "primary" })).toBe(
      "partial_internal_only",
    );
    expect(validateCombatDeclarationCompatibility({ primaryAction: "move_only" })).toEqual({
      valid: true,
    });
    expect(getCombatDeclarationCapabilityStatus({ actionId: "open", kind: "secondary" })).toBe(
      "partial_internal_only",
    );
  });

  it("rejects unavailable, legacy-only, and unknown executable declarations precisely", () => {
    for (const actionId of [
      "counterattack",
      "disarm",
      "parry_disarm",
      "break_off_engagement",
      "other",
      "unknown_action",
    ]) {
      expect(validateCombatDeclarationActionAvailability({ actionId, kind: "primary" })).toEqual({
        message: `Combat action is not yet available: ${actionId}.`,
        valid: false,
      });
    }

    expect(
      validateCombatDeclarationActionAvailability({
        actionId: "arbitrary_secondary",
        kind: "secondary",
      }),
    ).toEqual({
      message: "Combat secondary action is not yet available: arbitrary_secondary.",
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
