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
  it("keeps Parry plus Observe Opponent valid alongside independent movement intent", () => {
    expect(getCombatDeclarationCompatibilityRule("parry")).toMatchObject({
      allowedMovementKinds: ["hold_position", "set_distance_preferences", "move_in_environment"],
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
    expect(getCompatibleCombatSecondaryActionIds()).toEqual([
      "observe_opponent",
      "pass",
      "talk_shout",
      "equip_unequip",
      "small_action",
    ]);
    expect(getCompatibleCombatSecondaryActionIds("parry")).toEqual([
      "observe_opponent",
      "pass",
      "talk_shout",
      "equip_unequip",
      "small_action",
    ]);
    expect(getCompatibleCombatSecondaryActionIds("attack_parry")).toEqual([
      "pass",
      "talk_shout",
      "equip_unequip",
      "small_action",
    ]);
    expect(getCompatibleCombatPrimaryActionIds("observe_opponent")).toEqual(["parry", "pass"]);
    expect(projectCombatDeclarationCompatibility({ secondaryAction: "observe_opponent" })).toEqual(
      expect.objectContaining({
        compatiblePrimaryActions: ["parry", "pass"],
        compatibleSecondaryActions: [
          "observe_opponent",
          "pass",
          "talk_shout",
          "equip_unequip",
          "small_action",
        ],
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
        compatiblePrimaryActions: ["parry", "pass"],
        compatibleSecondaryActions: ["pass", "talk_shout", "equip_unequip", "small_action"],
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
        compatibleSecondaryActions: ["pass", "talk_shout", "equip_unequip", "small_action"],
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
      "break_off_engagement",
      "disarm",
      "parry_disarm",
    ]) {
      expect(isCombatDeclarationActionAvailable({ actionId, kind: "primary" })).toBe(true);
    }

    expect(
      getCombatDeclarationCapabilityStatus({ actionId: "counterattack", kind: "primary" }),
    ).toBe("unavailable");
    for (const actionId of ["other"]) {
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

  it("records movement intent independently of primary action feasibility", () => {
    for (const primaryAction of ["adjust_range_attack", "offensive_parry", "parry"]) {
      for (const movementKind of ["set_distance_preferences", "move_in_environment"]) {
        expect(validateCombatDeclarationCompatibility({ movementKind, primaryAction })).toEqual({
          valid: true,
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
    for (const actionId of ["counterattack", "other", "unknown_action"]) {
      expect(validateCombatDeclarationActionAvailability({ actionId, kind: "primary" })).toEqual({
        message: `Combat action is not yet available: ${actionId}.`,
        valid: false,
      });
    }

    for (const actionId of ["disarm", "parry_disarm"]) {
      expect(validateCombatDeclarationActionAvailability({ actionId, kind: "primary" })).toEqual({
        valid: true,
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

  /**
   * #778 — the branch this guards previously refused *every* secondary action declared without a
   * primary action, consulting no rule. `observe_opponent` keeps being refused because an
   * approved rule binds it: `docs/rules/observe-opponent.md` ("available with the untargeted
   * primary actions Pass or Parry", "every primary combination other than Pass or Parry is
   * rejected") and `docs/rules/combat-round-and-actions.md` section 2.2. The title names that
   * dependency so the case cannot later be read as a general requirement again.
   */
  it("rejects Observe Opponent without its authored Parry or Pass primary action", () => {
    expect(validateCombatDeclarationCompatibility({ secondaryAction: "observe_opponent" })).toEqual(
      {
        message: "observe_opponent requires a compatible primary action.",
        valid: false,
      },
    );
    expect(projectCombatDeclarationCompatibility({ secondaryAction: "observe_opponent" })).toEqual(
      expect.objectContaining({
        compatiblePrimaryActions: ["parry", "pass"],
        requiredContexts: ["secondary_target_participant"],
        status: "incomplete",
        valid: false,
      }),
    );
  });

  /**
   * #778 — a legal secondary action is a complete declaration on its own. No primary action is
   * required, and none is supplied: the returned validation carries no primary action and the
   * projection reports every available primary as still open, so nothing downstream can read an
   * implicit `pass` out of it.
   */
  it("accepts a declaration carrying only a legal secondary action", () => {
    for (const secondaryAction of ["pass", "talk_shout", "equip_unequip", "small_action"]) {
      expect(validateCombatDeclarationCompatibility({ secondaryAction })).toEqual({ valid: true });
      expect(projectCombatDeclarationCompatibility({ secondaryAction })).toEqual(
        expect.objectContaining({
          compatiblePrimaryActions: [
            "attack_parry",
            "parry_attack",
            "double_attack",
            "feint_attack",
            "adjust_range_attack",
            "offensive_parry",
            "parry",
            "break_off_engagement",
            "pass",
            "perform_task",
            "parry_disarm",
            "disarm",
            "move_only",
          ],
          message: undefined,
          status: "compatible",
          valid: true,
        }),
      );
    }

    expect(validateCombatDeclarationCompatibility({})).toEqual({ valid: true });
    expect(
      validateCombatDeclarationCompatibility({
        movementKind: "set_distance_preferences",
        secondaryAction: "equip_unequip",
      }),
    ).toEqual({ valid: true });
  });

  /**
   * #778 — the Product Owner's regression case 4: existing explicit action-specific restrictions
   * remain enforced. These are the three bounds the repair had to leave standing, each on a
   * different axis from primary/secondary compatibility.
   */
  it("keeps the authored availability, primary-ineligibility and pair bounds standing", () => {
    expect(validateCombatDeclarationCompatibility({ primaryAction: "observe_opponent" })).toEqual({
      message: "Observe Opponent is a secondary action.",
      valid: false,
    });
    expect(validateCombatDeclarationCompatibility({ secondaryAction: "counterattack" })).toEqual({
      message: "Combat secondary action is not yet available: counterattack.",
      valid: false,
    });
    expect(validateCombatDeclarationCompatibility({ primaryAction: "counterattack" })).toEqual({
      message: "Combat action is not yet available: counterattack.",
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
    expect(getCombatDeclarationRequiredContexts({ secondaryAction: "observe_opponent" })).toEqual([
      "secondary_target_participant",
    ]);
  });
});
