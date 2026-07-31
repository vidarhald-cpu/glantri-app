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
export type CombatDeclarationActionKind = "primary" | "secondary";
export type CombatDeclarationCapabilityStatus =
  | "available"
  | "legacy_only"
  | "partial_internal_only"
  | "unavailable";

export interface CombatDeclarationCapability {
  actionId: string;
  kind: CombatDeclarationActionKind;
  status: CombatDeclarationCapabilityStatus;
}

const AVAILABLE_PRIMARY_ACTION_IDS = new Set<string>([
  "attack_parry",
  "parry_attack",
  "double_attack",
  "feint_attack",
  "adjust_range_attack",
  "offensive_parry",
  "parry",
]);

const UNAVAILABLE_PRIMARY_ACTION_IDS = new Set<string>(["counterattack", "disarm"]);

export const COMBAT_DECLARATION_CAPABILITIES: readonly CombatDeclarationCapability[] = [
  ...COMBAT_PRIMARY_ACTION_IDS.map(
    (actionId): CombatDeclarationCapability => ({
      actionId,
      kind: "primary",
      status: AVAILABLE_PRIMARY_ACTION_IDS.has(actionId)
        ? "available"
        : UNAVAILABLE_PRIMARY_ACTION_IDS.has(actionId)
          ? "unavailable"
          : "legacy_only",
    }),
  ),
  ...COMBAT_SECONDARY_ACTION_IDS.map(
    (actionId): CombatDeclarationCapability => ({
      actionId,
      kind: "secondary",
      status: actionId === "observe_opponent" ? "available" : "legacy_only",
    }),
  ),
  {
    actionId: "move_only",
    kind: "primary",
    status: "partial_internal_only",
  },
  {
    actionId: "open",
    kind: "secondary",
    status: "partial_internal_only",
  },
];

export function getCombatDeclarationCapabilityStatus(input: {
  actionId?: string;
  kind: CombatDeclarationActionKind;
}): CombatDeclarationCapabilityStatus | undefined {
  if (!input.actionId) return undefined;

  return COMBAT_DECLARATION_CAPABILITIES.find(
    (capability) => capability.actionId === input.actionId && capability.kind === input.kind,
  )?.status;
}

export function isCombatDeclarationActionAvailable(input: {
  actionId?: string;
  kind: CombatDeclarationActionKind;
}): boolean {
  return getCombatDeclarationCapabilityStatus(input) === "available";
}

export function validateCombatDeclarationActionAvailability(input: {
  actionId?: string;
  kind: CombatDeclarationActionKind;
}): { message?: string; valid: boolean } {
  if (!input.actionId) return { valid: true };

  const status = getCombatDeclarationCapabilityStatus(input);
  if (status === "available") return { valid: true };

  return {
    message:
      input.kind === "primary"
        ? `Combat action is not yet available: ${input.actionId}.`
        : `Combat secondary action is not yet available: ${input.actionId}.`,
    valid: false,
  };
}

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
    allowedSecondaryActions: primaryAction === "parry" ? (["observe_opponent"] as const) : [],
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
  const primaryStatus = getCombatDeclarationCapabilityStatus({
    actionId: input.primaryAction,
    kind: "primary",
  });
  if (primaryStatus !== "available" && primaryStatus !== "partial_internal_only") {
    return validateCombatDeclarationActionAvailability({
      actionId: input.primaryAction,
      kind: "primary",
    });
  }
  const secondaryStatus = getCombatDeclarationCapabilityStatus({
    actionId: input.secondaryAction,
    kind: "secondary",
  });
  if (
    input.secondaryAction &&
    secondaryStatus !== "available" &&
    secondaryStatus !== "partial_internal_only"
  ) {
    return validateCombatDeclarationActionAvailability({
      actionId: input.secondaryAction,
      kind: "secondary",
    });
  }
  const rule = getCombatDeclarationCompatibilityRule(input.primaryAction);
  if (primaryStatus === "partial_internal_only") return { valid: true };
  if (!rule) {
    return {
      message: `Combat action is not yet available: ${input.primaryAction}.`,
      valid: false,
    };
  }
  if (
    input.secondaryAction &&
    secondaryStatus !== "partial_internal_only" &&
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
