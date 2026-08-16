import { describe, expect, it } from "vitest";

import {
  getCombatDeclarationCapabilityStatus,
  getCombatDeclarationCompatibilityRule,
  getCombatDeclarationRequiredContexts,
  getCompatibleCombatPrimaryActionIds,
  getCompatibleCombatSecondaryActionIds,
  isCombatDeclarationActionAvailable,
  projectCombatDeclarationCompatibility,
  validateCombatDeclarationActionAvailability,
  validateCombatDeclarationCompatibility,
} from "./combatDeclarationCompatibility";

describe("combat declaration compatibility", () => {
  it("keeps Parry plus Observe Opponent valid without generic distance movement", () => {
    expect(getCombatDeclarationCompatibilityRule("parry")).toMatchObject({
      allowedMovementKinds: ["hold_position"],
      compatibleSecondaryActions: [
        {
          actionId: "open",
          requiredContexts: [],
        },
        {
          actionId: "observe_opponent",
          requiredContexts: ["secondary_target_participant"],
        },
      ],
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
        movementKind: "hold_position",
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

  it("projects selector choices in both directions from the same rules", () => {
    expect(getCompatibleCombatSecondaryActionIds()).toEqual(["observe_opponent"]);
    expect(getCompatibleCombatSecondaryActionIds("parry")).toEqual(["observe_opponent"]);
    expect(getCompatibleCombatSecondaryActionIds("attack_parry")).toEqual([]);
    expect(getCompatibleCombatPrimaryActionIds("observe_opponent")).toEqual(["parry"]);
    expect(projectCombatDeclarationCompatibility({ secondaryAction: "observe_opponent" })).toEqual(
      expect.objectContaining({
        compatiblePrimaryActions: ["parry"],
        compatibleSecondaryActions: ["observe_opponent"],
        message: "observe_opponent requires a compatible primary action.",
        requiredContexts: ["secondary_target_participant"],
        status: "incomplete",
        valid: false,
      }),
    );
  });

  it("projects stale unsupported and incompatible pairs without making them executable", () => {
    expect(
      projectCombatDeclarationCompatibility({
        primaryAction: "attack_parry",
        secondaryAction: "observe_opponent",
      }),
    ).toEqual(
      expect.objectContaining({
        compatiblePrimaryActions: ["parry"],
        compatibleSecondaryActions: [],
        status: "incompatible",
        valid: false,
      }),
    );
    expect(
      projectCombatDeclarationCompatibility({
        primaryAction: "break_off_engagement",
        secondaryAction: "counterattack",
      }),
    ).toEqual(
      expect.objectContaining({
        compatiblePrimaryActions: [],
        compatibleSecondaryActions: [],
        status: "unsupported",
        valid: false,
      }),
    );
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
      "available",
    );
    expect(
      validateCombatDeclarationCompatibility({
        movementKind: "hold_position",
        primaryAction: "move_only",
      }),
    ).toEqual({ valid: true });
    expect(
      validateCombatDeclarationCompatibility({
        primaryAction: "attack_parry",
        secondaryAction: "open",
      }),
    ).toEqual({ valid: true });
    expect(getCombatDeclarationCapabilityStatus({ actionId: "open", kind: "secondary" })).toBe(
      "partial_internal_only",
    );
  });

  it("keeps movement-owning maneuvers out of generic relative and environmental resolution", () => {
    for (const primaryAction of ["adjust_range_attack", "offensive_parry", "parry"]) {
      for (const movementKind of ["set_distance_preferences", "move_in_environment"]) {
        expect(validateCombatDeclarationCompatibility({ movementKind, primaryAction })).toEqual({
          message: "The selected movement is not compatible with the selected primary action.",
          valid: false,
        });
      }
    }

    expect(
      validateCombatDeclarationCompatibility({
        movementKind: "set_distance_preferences",
        primaryAction: "move_only",
      }),
    ).toEqual({ valid: true });
    expect(
      validateCombatDeclarationCompatibility({
        movementKind: "move_in_environment",
        primaryAction: "move_only",
      }),
    ).toEqual({ valid: true });
  });

  it("fails closed for unapproved internal-only primary-secondary pairs", () => {
    for (const secondaryAction of ["observe_opponent", "open"]) {
      const input = { primaryAction: "move_only", secondaryAction };

      expect(validateCombatDeclarationCompatibility(input)).toEqual({
        message: `${secondaryAction} is not compatible with the selected primary action.`,
        valid: false,
      });
      expect(projectCombatDeclarationCompatibility(input)).toEqual(
        expect.objectContaining({
          status: "incompatible",
          valid: false,
        }),
      );
    }

    expect(
      validateCombatDeclarationCompatibility({
        movementKind: "teleport",
        primaryAction: "move_only",
      }),
    ).toEqual({
      message: "The selected movement is not compatible with the selected primary action.",
      valid: false,
    });
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

  it("rejects a secondary action without a compatible primary", () => {
    expect(validateCombatDeclarationCompatibility({ secondaryAction: "observe_opponent" })).toEqual(
      {
        message: "observe_opponent requires a compatible primary action.",
        valid: false,
      },
    );
  });
});
