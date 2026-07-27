export const COMBAT_PRIMARY_ACTION_IDS = [
  "attack_parry",
  "parry_attack",
  "double_attack",
  "feint_attack",
  "adjust_range_attack",
  "counterattack",
  "offensive_parry",
  "parry",
  "parry_disarm",
  "disarm",
  "break_off_engagement",
  "other",
] as const;

export const COMBAT_SECONDARY_ACTION_IDS = [
  "attack_parry",
  "parry_attack",
  "double_attack",
  "feint_attack",
  "adjust_range_attack",
  "counterattack",
  "observe_opponent",
  "offensive_parry",
  "parry_disarm",
  "disarm",
  "break_off_engagement",
  "other",
] as const;

export type CombatPrimaryActionId = (typeof COMBAT_PRIMARY_ACTION_IDS)[number];
export type CombatSecondaryActionId = (typeof COMBAT_SECONDARY_ACTION_IDS)[number];

export type CombatDeclarationMovementKind = "hold_position" | "set_distance_preferences";

export interface CombatDeclarationCompatibilityRule {
  allowedMovementKinds: readonly CombatDeclarationMovementKind[];
  allowedSecondaryActions: readonly CombatSecondaryActionId[];
  primaryAction: CombatPrimaryActionId;
  requiredContexts: readonly "secondary_target_participant"[];
}

const CURRENT_MOVEMENT_KINDS = ["hold_position", "set_distance_preferences"] as const;

export const COMBAT_DECLARATION_COMPATIBILITY_RULES: readonly CombatDeclarationCompatibilityRule[] =
  COMBAT_PRIMARY_ACTION_IDS.map((primaryAction) => ({
    allowedMovementKinds: CURRENT_MOVEMENT_KINDS,
    allowedSecondaryActions:
      primaryAction === "parry"
        ? (["observe_opponent"] as const)
        : COMBAT_SECONDARY_ACTION_IDS.filter((action) => action !== "observe_opponent"),
    primaryAction,
    requiredContexts: [],
  }));

export function getCombatDeclarationCompatibilityRule(
  primaryAction?: string,
): CombatDeclarationCompatibilityRule | undefined {
  return COMBAT_DECLARATION_COMPATIBILITY_RULES.find(
    (rule) => rule.primaryAction === primaryAction,
  );
}

export function getCombatDeclarationRequiredContexts(input: {
  primaryAction?: string;
  secondaryAction?: string;
}): readonly "secondary_target_participant"[] {
  const rule = getCombatDeclarationCompatibilityRule(input.primaryAction);

  return rule && input.secondaryAction === "observe_opponent"
    ? ["secondary_target_participant"]
    : [];
}

export function validateCombatDeclarationCompatibility(input: {
  movementKind?: string;
  primaryAction?: string;
  secondaryAction?: string;
}): { message?: string; valid: boolean } {
  if (!input.primaryAction) return { valid: true };
  if (input.primaryAction === "observe_opponent") {
    return {
      message: "Observe Opponent is a secondary action.",
      valid: false,
    };
  }
  const rule = getCombatDeclarationCompatibilityRule(input.primaryAction);
  // This first compatibility slice only constrains actions represented by the
  // canonical table. Existing extensions retain their prior validation path.
  if (!rule) return { valid: true };
  if (
    input.secondaryAction &&
    !rule.allowedSecondaryActions.includes(input.secondaryAction as CombatSecondaryActionId)
  ) {
    return {
      message: `${input.secondaryAction} is not compatible with the selected primary action.`,
      valid: false,
    };
  }
  if (
    input.movementKind &&
    !rule.allowedMovementKinds.includes(input.movementKind as CombatDeclarationMovementKind)
  ) {
    return {
      message: "The selected movement is not compatible with the selected primary action.",
      valid: false,
    };
  }
  return { valid: true };
}
