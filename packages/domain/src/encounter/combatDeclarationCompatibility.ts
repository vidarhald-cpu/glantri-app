export const COMBAT_PRIMARY_ACTION_IDS = [
  "attack_parry",
  "parry_attack",
  "double_attack",
  "feint_attack",
  "adjust_range_attack",
  "counterattack",
  "offensive_parry",
  "parry",
  "break_off_engagement",
  "parry_disarm",
  "disarm",
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
  "break_off_engagement",
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
    status: "available",
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

export type CombatDeclarationMovementKind =
  | "hold_position"
  | "set_distance_preferences"
  | "move_in_environment";
export type CombatDeclarationPrimaryActionId = CombatPrimaryActionId | "move_only";

export interface CombatDeclarationCompatibilityRule {
  allowedMovementKinds: readonly CombatDeclarationMovementKind[];
  compatibleSecondaryActions: readonly CombatDeclarationSecondaryCompatibility[];
  primaryAction: CombatDeclarationPrimaryActionId;
}

export type CombatDeclarationRequiredContext = "secondary_target_participant";

export interface CombatDeclarationSecondaryCompatibility {
  actionId: CombatSecondaryActionId | "open";
  requiredContexts: readonly CombatDeclarationRequiredContext[];
}

export type CombatDeclarationSelectionStatus =
  | "compatible"
  | "incompatible"
  | "incomplete"
  | "unsupported";

export interface CombatDeclarationCompatibilityProjection {
  allowedMovementKinds: readonly CombatDeclarationMovementKind[];
  compatiblePrimaryActions: readonly CombatDeclarationPrimaryActionId[];
  compatibleSecondaryActions: readonly CombatSecondaryActionId[];
  message?: string;
  requiredContexts: readonly CombatDeclarationRequiredContext[];
  status: CombatDeclarationSelectionStatus;
  valid: boolean;
}

const CURRENT_MOVEMENT_KINDS = [
  "hold_position",
  "set_distance_preferences",
  "move_in_environment",
] as const;
const MOVEMENT_OWNING_PRIMARY_ACTION_IDS = new Set<string>([
  "adjust_range_attack",
  "offensive_parry",
  "parry",
  "break_off_engagement",
]);

export const COMBAT_DECLARATION_COMPATIBILITY_RULES: readonly CombatDeclarationCompatibilityRule[] =
  [
    ...COMBAT_PRIMARY_ACTION_IDS.map((primaryAction) => ({
      allowedMovementKinds: MOVEMENT_OWNING_PRIMARY_ACTION_IDS.has(primaryAction)
        ? (["hold_position"] as const)
        : CURRENT_MOVEMENT_KINDS,
      compatibleSecondaryActions: [
        ...(isCombatDeclarationActionAvailable({ actionId: primaryAction, kind: "primary" })
          ? ([{ actionId: "open", requiredContexts: [] }] as const)
          : []),
        ...(primaryAction === "parry"
          ? ([
              {
                actionId: "observe_opponent",
                requiredContexts: ["secondary_target_participant"],
              },
            ] as const)
          : []),
      ],
      primaryAction,
    })),
    {
      allowedMovementKinds: CURRENT_MOVEMENT_KINDS,
      compatibleSecondaryActions: [],
      primaryAction: "move_only",
    },
  ];

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
}): readonly CombatDeclarationRequiredContext[] {
  const rules = input.primaryAction
    ? [getCombatDeclarationCompatibilityRule(input.primaryAction)].filter(
        (rule): rule is CombatDeclarationCompatibilityRule => Boolean(rule),
      )
    : COMBAT_DECLARATION_COMPATIBILITY_RULES;

  return [
    ...new Set(
      rules.flatMap(
        (rule) =>
          rule.compatibleSecondaryActions.find(
            (secondary) => secondary.actionId === input.secondaryAction,
          )?.requiredContexts ?? [],
      ),
    ),
  ];
}

function getAvailableCombatPrimaryActionIds(): CombatDeclarationPrimaryActionId[] {
  return [
    ...COMBAT_PRIMARY_ACTION_IDS.filter((actionId) =>
      isCombatDeclarationActionAvailable({ actionId, kind: "primary" }),
    ),
    ...(isCombatDeclarationActionAvailable({ actionId: "move_only", kind: "primary" })
      ? (["move_only"] as const)
      : []),
  ];
}

function getAvailableCombatSecondaryActionIds(): CombatSecondaryActionId[] {
  return COMBAT_SECONDARY_ACTION_IDS.filter((actionId) =>
    isCombatDeclarationActionAvailable({ actionId, kind: "secondary" }),
  );
}

export function getCompatibleCombatPrimaryActionIds(
  secondaryAction?: string,
): readonly CombatDeclarationPrimaryActionId[] {
  const availablePrimaryActions = getAvailableCombatPrimaryActionIds();
  if (!secondaryAction) return availablePrimaryActions;
  if (!isCombatDeclarationActionAvailable({ actionId: secondaryAction, kind: "secondary" })) {
    return [];
  }

  return availablePrimaryActions.filter((primaryAction) =>
    getCombatDeclarationCompatibilityRule(primaryAction)?.compatibleSecondaryActions.some(
      (secondary) => secondary.actionId === secondaryAction,
    ),
  );
}

export function getCompatibleCombatSecondaryActionIds(
  primaryAction?: string,
): readonly CombatSecondaryActionId[] {
  const availableSecondaryActions = getAvailableCombatSecondaryActionIds();
  if (!primaryAction) return availableSecondaryActions;
  if (!isCombatDeclarationActionAvailable({ actionId: primaryAction, kind: "primary" })) {
    return [];
  }

  const rule = getCombatDeclarationCompatibilityRule(primaryAction);
  return availableSecondaryActions.filter((secondaryAction) =>
    rule?.compatibleSecondaryActions.some((secondary) => secondary.actionId === secondaryAction),
  );
}

export function validateCombatDeclarationCompatibility(input: {
  movementKind?: string;
  primaryAction?: string;
  secondaryAction?: string;
}): { message?: string; valid: boolean } {
  if (input.primaryAction === "observe_opponent") {
    return {
      message: "Observe Opponent is a secondary action.",
      valid: false,
    };
  }
  const primaryStatus = input.primaryAction
    ? getCombatDeclarationCapabilityStatus({
        actionId: input.primaryAction,
        kind: "primary",
      })
    : undefined;
  if (
    input.primaryAction &&
    primaryStatus !== "available" &&
    primaryStatus !== "partial_internal_only"
  ) {
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
  if (!input.primaryAction) {
    return input.secondaryAction
      ? {
          message: `${input.secondaryAction} requires a compatible primary action.`,
          valid: false,
        }
      : { valid: true };
  }
  const rule = getCombatDeclarationCompatibilityRule(input.primaryAction);
  if (!rule) {
    return {
      message: `Combat action is not yet available: ${input.primaryAction}.`,
      valid: false,
    };
  }
  if (
    input.secondaryAction &&
    !rule.compatibleSecondaryActions.some(
      (secondary) => secondary.actionId === input.secondaryAction,
    )
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

export function projectCombatDeclarationCompatibility(input: {
  movementKind?: string;
  primaryAction?: string;
  secondaryAction?: string;
}): CombatDeclarationCompatibilityProjection {
  const validation = validateCombatDeclarationCompatibility(input);
  const primaryStatus = getCombatDeclarationCapabilityStatus({
    actionId: input.primaryAction,
    kind: "primary",
  });
  const secondaryStatus = getCombatDeclarationCapabilityStatus({
    actionId: input.secondaryAction,
    kind: "secondary",
  });
  const unsupported =
    (Boolean(input.primaryAction) &&
      primaryStatus !== "available" &&
      primaryStatus !== "partial_internal_only") ||
    (Boolean(input.secondaryAction) &&
      secondaryStatus !== "available" &&
      secondaryStatus !== "partial_internal_only");
  const rule = getCombatDeclarationCompatibilityRule(input.primaryAction);
  const compatiblePrimaryActions = getCompatibleCombatPrimaryActionIds(
    input.secondaryAction,
  ).filter((primaryAction) => {
    const primaryRule = getCombatDeclarationCompatibilityRule(primaryAction);
    return (
      !input.movementKind ||
      Boolean(
        primaryRule?.allowedMovementKinds.includes(
          input.movementKind as CombatDeclarationMovementKind,
        ),
      )
    );
  });

  return {
    allowedMovementKinds: rule?.allowedMovementKinds ?? CURRENT_MOVEMENT_KINDS,
    compatiblePrimaryActions,
    compatibleSecondaryActions: getCompatibleCombatSecondaryActionIds(input.primaryAction),
    message: validation.message,
    requiredContexts: getCombatDeclarationRequiredContexts(input),
    status: validation.valid
      ? "compatible"
      : unsupported
        ? "unsupported"
        : input.secondaryAction && !input.primaryAction
          ? "incomplete"
          : "incompatible",
    valid: validation.valid,
  };
}
