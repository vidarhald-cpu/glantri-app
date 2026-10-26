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
  "pass",
  "perform_task",
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
  "pass",
  "talk_shout",
  "equip_unequip",
  "small_action",
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
  "pass",
  "perform_task",
  "parry_disarm",
  "disarm",
]);

const UNAVAILABLE_PRIMARY_ACTION_IDS = new Set<string>(["counterattack"]);

const AVAILABLE_SECONDARY_ACTION_IDS = new Set<string>([
  "observe_opponent",
  "pass",
  "talk_shout",
  "equip_unequip",
  "small_action",
]);

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
      status: AVAILABLE_SECONDARY_ACTION_IDS.has(actionId) ? "available" : "legacy_only",
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
export const COMBAT_DECLARATION_COMPATIBILITY_RULES: readonly CombatDeclarationCompatibilityRule[] =
  [
    ...COMBAT_PRIMARY_ACTION_IDS.map((primaryAction) => ({
      allowedMovementKinds: CURRENT_MOVEMENT_KINDS,
      compatibleSecondaryActions: [
        ...(isCombatDeclarationActionAvailable({ actionId: primaryAction, kind: "primary" })
          ? ([
              { actionId: "open", requiredContexts: [] },
              { actionId: "pass", requiredContexts: [] },
              { actionId: "talk_shout", requiredContexts: [] },
              { actionId: "equip_unequip", requiredContexts: [] },
              { actionId: "small_action", requiredContexts: [] },
            ] as const)
          : []),
        ...(primaryAction === "parry" || primaryAction === "pass"
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
      compatibleSecondaryActions: [
        { actionId: "pass", requiredContexts: [] },
        { actionId: "talk_shout", requiredContexts: [] },
        { actionId: "equip_unequip", requiredContexts: [] },
        { actionId: "small_action", requiredContexts: [] },
      ],
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
    if (!input.secondaryAction) return { valid: true };
    /**
     * #778 — primary and secondary actions are independent choices. This branch previously
     * refused *every* secondary action declared without a primary action, unconditionally and
     * without consulting any rule, which forced a player who only wanted to draw a weapon to
     * also select `pass`. A secondary action is now refused for want of a primary action only
     * where the authored compatibility table above already binds that secondary to specific
     * primary actions.
     *
     * Today that is `observe_opponent` alone, and it is rule-bound:
     * `docs/rules/observe-opponent.md` records it as "a typed secondary action available with
     * the untargeted primary actions Pass or Parry" whose "primary combination other than Pass
     * or Parry is rejected", and its round-boundary progression counts only rounds in which
     * "the observer declared Pass or Parry plus Observe Opponent against the relationship
     * target". `docs/rules/combat-round-and-actions.md` section 2.2 states the same bound.
     *
     * The predicate *reads* that one table instead of restating it, so there is no second
     * compatibility matrix to drift from it, and a secondary compatible with every available
     * primary action is a complete declaration on its own. Nothing here supplies a primary
     * action: an accepted secondary-only declaration records no primary action at all.
     */
    const availablePrimaryActions = getAvailableCombatPrimaryActionIds();
    const authoredPrimaryActions = availablePrimaryActions.filter((primaryAction) =>
      getCombatDeclarationCompatibilityRule(primaryAction)?.compatibleSecondaryActions.some(
        (secondary) => secondary.actionId === input.secondaryAction,
      ),
    );
    if (authoredPrimaryActions.length < availablePrimaryActions.length) {
      return {
        message: `${input.secondaryAction} requires a compatible primary action.`,
        valid: false,
      };
    }
    return { valid: true };
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
