import { z } from "zod";

import { glantriCharacteristicKeySchema } from "../character/profiles";
import { COMBAT_ROUND_STEPS, type CombatRoundStep } from "./combatRoundStep";

const idSchema = z.string().min(1);

export const combatGenericActionStatusSchema = z.enum([
  "declared",
  "reviewed",
  "active",
  "completed",
  "interrupted",
  "cancelled",
]);
export type CombatGenericActionStatus = z.infer<typeof combatGenericActionStatusSchema>;
const combatGenericActionTerminalStatusValues = [
  "completed",
  "interrupted",
  "cancelled",
] as const satisfies readonly CombatGenericActionStatus[];
export type CombatGenericActionTerminalStatus =
  (typeof combatGenericActionTerminalStatusValues)[number];

export const combatGenericActionDurationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("phase"), phase: z.enum(["phase1", "phase2"]) }),
  z.object({ kind: z.literal("round") }),
  z.object({ kind: z.literal("rounds"), rounds: z.number().int().min(2).max(100) }),
  z.object({ kind: z.literal("gm_decided") }),
]);
export type CombatGenericActionDuration = z.infer<typeof combatGenericActionDurationSchema>;

export const combatGenericActionReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("participant"), participantId: idSchema, label: z.string().min(1) }),
  z.object({
    itemId: idSchema,
    kind: z.literal("item"),
    label: z.string().min(1),
    ownerParticipantId: idSchema,
  }),
  z.object({ description: z.string().trim().min(1).max(500), kind: z.literal("environment") }),
]);
export type CombatGenericActionReference = z.infer<typeof combatGenericActionReferenceSchema>;

const combatGenericActionSkillRollBasisSchema = z.object({
  avgStats: z.number().int(),
  baseValue: z.number().int(),
  derivedXp: z.number().int().default(0),
  groupXp: z.number().int().default(0),
  kind: z.literal("skill"),
  skillId: idSchema,
  skillLabel: z.string().min(1),
  skillXp: z.number().int().default(0),
  unknownSkillPenalty: z.number().int().default(0),
});

const combatGenericActionStatRollBasisSchema = z.object({
  baseValue: z.number().int(),
  kind: z.literal("stat"),
  statId: glantriCharacteristicKeySchema,
  statLabel: z.string().min(1),
});

export const combatGenericActionRollRequestSchema = z.object({
  basis: z.discriminatedUnion("kind", [
    combatGenericActionSkillRollBasisSchema,
    combatGenericActionStatRollBasisSchema,
  ]),
  difficulty: z.number().int().min(1).max(200),
});
export type CombatGenericActionRollRequest = z.infer<typeof combatGenericActionRollRequestSchema>;

export const combatGenericActionRollResultSchema = z.object({
  achievedLevelId: z.string().min(1),
  achievedLevelLabel: z.string().min(1),
  calculationText: z.string().min(1),
  dieResult: z.number().int(),
  finalTotal: z.number().int(),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  rollD20: z.number().int().min(1).max(20),
  rolledAt: z.string().datetime(),
  rolledByUserId: idSchema.optional(),
  success: z.boolean(),
});
export type CombatGenericActionRollResult = z.infer<typeof combatGenericActionRollResultSchema>;

export const combatGenericActionResolutionSchema = z.object({
  resolvedAt: z.string().datetime(),
  resolvedByUserId: idSchema.optional(),
  text: z.string().trim().min(1).max(4000),
  visibleToParticipantIds: z.array(idSchema).default([]),
});
export type CombatGenericActionResolution = z.infer<typeof combatGenericActionResolutionSchema>;

export const combatItemInteractionOperationSchema = z.enum([
  "draw",
  "stow",
  "drop",
  "pickup",
  "pass",
  "use",
]);
export type CombatItemInteractionOperation = z.infer<typeof combatItemInteractionOperationSchema>;

export const combatItemInteractionStateSchema = z.enum([
  "held",
  "equipped",
  "stowed",
  "present_unheld",
]);
export type CombatItemInteractionState = z.infer<typeof combatItemInteractionStateSchema>;

export const combatItemInteractionSchema = z.object({
  itemId: idSchema,
  itemLabel: z.string().min(1),
  itemRevision: z.string().datetime(),
  operation: combatItemInteractionOperationSchema,
  recipientParticipantId: idSchema.optional(),
  stateAtDeclaration: combatItemInteractionStateSchema,
  visibleToParticipantIds: z.array(idSchema).default([]),
});
export type CombatItemInteraction = z.infer<typeof combatItemInteractionSchema>;

export function projectCombatItemInteractionRecipients<
  TParticipant extends { participantId: string },
>(input: {
  participants: readonly TParticipant[];
  viewer: { kind: "gm" } | { kind: "player"; visibleParticipantIds: ReadonlySet<string> };
}): TParticipant[] {
  const viewer = input.viewer;
  if (viewer.kind === "gm") return [...input.participants];
  return input.participants.filter((participant) =>
    viewer.visibleParticipantIds.has(participant.participantId),
  );
}

export const combatGenericActionSchema = z.object({
  awarenessContext: z.object({ kind: z.literal("survey") }).optional(),
  createdAt: z.string().datetime(),
  createdByUserId: idSchema.optional(),
  declarationKind: z.enum(["perform_task", "small_action"]).optional(),
  duration: combatGenericActionDurationSchema,
  id: idSchema,
  intent: z.string().trim().min(1).max(2000),
  itemInteraction: combatItemInteractionSchema.optional(),
  lastUpdatedAt: z.string().datetime(),
  ownerParticipantId: idSchema,
  preset: z.enum(["look_around", "environmental_movement", "item_interaction"]).optional(),
  progress: z.object({
    completedRounds: z.number().int().nonnegative().default(0),
    lastProgressedRoundNumber: z.number().int().positive().optional(),
    startedRoundNumber: z.number().int().positive().optional(),
    startedStep: z.enum(COMBAT_ROUND_STEPS).optional(),
    totalRounds: z.number().int().positive().optional(),
  }),
  reference: combatGenericActionReferenceSchema.optional(),
  resolution: combatGenericActionResolutionSchema.optional(),
  rollRequest: combatGenericActionRollRequestSchema.optional(),
  rollResult: combatGenericActionRollResultSchema.optional(),
  status: combatGenericActionStatusSchema,
});
export type CombatGenericAction = z.infer<typeof combatGenericActionSchema>;

/**
 * A Combat generic action in one of these statuses is no longer live.
 *
 * This is the single terminal-status vocabulary for **every** generic-action family, Item
 * interactions included: an Item action is an ordinary `CombatGenericAction` carrying
 * `preset: "item_interaction"` and an `itemInteraction`, and it moves through the same
 * `combatGenericActionStatusSchema` — `declared -> reviewed -> active` and then exactly one of
 * `completed` (resolve), `interrupted` (interrupt) or `cancelled` (cancel), as the Item action
 * lifecycle route's own terminal-status mapping shows. Rule decision 0007 §2 names the same three
 * statuses for Perform Task; they are shared here rather than restated per family.
 */
export const COMBAT_GENERIC_ACTION_TERMINAL_STATUSES: ReadonlySet<CombatGenericActionStatus> =
  new Set<CombatGenericActionStatus>(combatGenericActionTerminalStatusValues);

/** True while a Combat generic action has not yet reached a terminal status. */
export function isCombatGenericActionLive(action: CombatGenericAction): boolean {
  return !COMBAT_GENERIC_ACTION_TERMINAL_STATUSES.has(action.status);
}

/**
 * True for a still-live action that **carries a canonical Item interaction**, whatever created it.
 *
 * `preset: "item_interaction"` means exactly one thing — this action owns a canonical
 * `itemInteraction`, an invariant `declareCombatGenericAction` enforces in both directions. It is
 * therefore the right predicate for the surfaces that drive the Item authority's own lifecycle
 * (GM review/activate/resolve/interrupt/cancel), which legitimately reach an Item declared through
 * the combat-declaration surface as well — behaviour that predates Forgejo issue #409 and is
 * unchanged by it.
 *
 * **It is not the one-live-action guard's family marker.** Use
 * {@link isCombatGuardedItemActionLive} for that.
 */
export function isCombatItemInteractionActionLive(action: CombatGenericAction): boolean {
  return action.preset === "item_interaction" && isCombatGenericActionLive(action);
}

/**
 * True for an action in the **guarded Item-action family** — the family the one-live-Item-action
 * refusal protects (Product Owner ruling on Forgejo issue #409).
 *
 * The discriminator is `declarationKind`, not `preset`. `declarationKind` is the canonical
 * declaration-family marker and is written in exactly one place,
 * `materializeCombatDeclarationTasks`, which stamps every action it mints with `"perform_task"` or
 * `"small_action"`. No helper ever adds, changes or removes it afterwards. An action that carries
 * no `declarationKind` therefore did not come from the combat-declaration surface: on the Item
 * side it can only have come from the Item-interaction authority route, which is the family this
 * guard is about.
 *
 * `preset` alone cannot express this, because the M7 path (Forgejo issue #323) materializes a
 * secondary `small_action` naming an Item with **both** `preset: "item_interaction"` and
 * `declarationKind: "small_action"`. The Product Owner ruled that such an action is *a Small Action
 * involving an Item*, not the Item-action family this guard protects — consistent with rule
 * decision 0007 §2, which deliberately excludes `small_action`. A `perform_task` never reaches
 * `preset: "item_interaction"` at all: `materializeCombatDeclarationTasks` attaches the declared
 * Item to the secondary `small_action` slot only.
 */
export function isCombatGuardedItemAction(action: CombatGenericAction): boolean {
  return action.preset === "item_interaction" && action.declarationKind === undefined;
}

/**
 * True for a guarded Item-action-family member that is still live — the exact liveness the
 * one-live-Item-action guard is scoped on. See {@link isCombatGuardedItemAction} for the family
 * discriminator and {@link COMBAT_GENERIC_ACTION_TERMINAL_STATUSES} for the terminal vocabulary.
 */
export function isCombatGuardedItemActionLive(action: CombatGenericAction): boolean {
  return isCombatGuardedItemAction(action) && isCombatGenericActionLive(action);
}

export function getCombatGenericActionTotalRounds(
  duration: CombatGenericActionDuration,
): number | undefined {
  if (duration.kind === "round") return 1;
  if (duration.kind === "rounds") return duration.rounds;
  return undefined;
}

export const combatGenericActionPresetSchema = z.enum([
  "look_around",
  "environmental_movement",
  "item_interaction",
]);
export type CombatGenericActionPreset = z.infer<typeof combatGenericActionPresetSchema>;

export const combatGenericActionProgressSchema = combatGenericActionSchema.shape.progress;
export type CombatGenericActionProgress = z.infer<typeof combatGenericActionProgressSchema>;

/**
 * Perform Task is a normal primary action. Its reviewed duration maps onto the actor's own
 * primary-action opportunity: one advance per round at that opportunity, completing after exactly
 * N advances. A phase duration is one such opportunity; `gm_decided` leaves the count with the GM.
 * This is the single timing authority for the canonical task lifecycle. `COMBAT_ROUND_STEPS`
 * reasoning in `canCompleteCombatGenericAction` governs only the legacy parallel channel.
 */
export function getCombatGenericActionOpportunityAdvances(
  duration: CombatGenericActionDuration,
): number | undefined {
  if (duration.kind === "round" || duration.kind === "phase") return 1;
  if (duration.kind === "rounds") return duration.rounds;
  return undefined;
}

/** True when this opportunity is the task's final advance and may therefore resolve it. */
export function isCombatGenericActionFinalOpportunity(action: CombatGenericAction): boolean {
  const required = getCombatGenericActionOpportunityAdvances(action.duration);
  if (required === undefined) return true;
  return action.progress.completedRounds + 1 >= required;
}

/**
 * True when the owner still holds an unconsumed primary-action opportunity for this task.
 *
 * `lastProgressedRoundNumber` is the round whose opportunity was consumed. Only
 * `advanceCombatGenericActionAtOpportunity` writes it; the round rollover deliberately does not
 * (see `advanceCombatGenericActionsToRound`).
 */
export function isCombatGenericActionOpportunityOpen(input: {
  action: CombatGenericAction;
  roundNumber: number;
}): boolean {
  const action = input.action;
  if (!isCombatGenericActionLive(action)) return false;
  return action.progress.lastProgressedRoundNumber !== input.roundNumber;
}

/**
 * Consumes exactly one primary-action opportunity for an active task. It never advances twice in
 * one round and never exceeds the reviewed advance count.
 */
export function advanceCombatGenericActionAtOpportunity(input: {
  actionId: string;
  actions: readonly CombatGenericAction[];
  advancedAt: string;
  roundNumber: number;
}): CombatGenericAction[] {
  const current = requireAction(input.actions, input.actionId);
  if (current.status !== "active") {
    throw new RangeError("Only an active Combat Task can advance at its action opportunity.");
  }
  if (current.progress.lastProgressedRoundNumber === input.roundNumber) {
    throw new RangeError("This Combat Task already used its action opportunity this round.");
  }
  const required = getCombatGenericActionOpportunityAdvances(current.duration);
  const next = combatGenericActionSchema.parse({
    ...current,
    lastUpdatedAt: input.advancedAt,
    progress: {
      ...current.progress,
      completedRounds: Math.min(
        current.progress.completedRounds + 1,
        required ?? Number.MAX_SAFE_INTEGER,
      ),
      lastProgressedRoundNumber: input.roundNumber,
      totalRounds: getCombatGenericActionTotalRounds(current.duration),
    },
  });
  return replaceAction(input.actions, next);
}

function replaceAction(
  actions: readonly CombatGenericAction[],
  replacement: CombatGenericAction,
): CombatGenericAction[] {
  return actions.map((action) => (action.id === replacement.id ? replacement : action));
}

function requireAction(
  actions: readonly CombatGenericAction[],
  actionId: string,
): CombatGenericAction {
  const action = actions.find((candidate) => candidate.id === actionId);
  if (!action) throw new RangeError("Combat action is no longer available. Refresh and review it.");
  return combatGenericActionSchema.parse(action);
}

export function declareCombatGenericAction(input: {
  action: Omit<CombatGenericAction, "lastUpdatedAt" | "progress" | "status">;
  actions: readonly CombatGenericAction[];
}): CombatGenericAction[] {
  const existing = input.actions.find((action) => action.id === input.action.id);
  if (existing) return [...input.actions];

  if (input.action.preset === "look_around") {
    if (
      input.action.rollRequest?.basis.kind !== "skill" ||
      input.action.rollRequest.basis.skillId !== "perception"
    ) {
      throw new RangeError("Look around uses the canonical Perception skill.");
    }
  }

  if (
    input.action.preset === "environmental_movement" &&
    input.action.reference?.kind !== "environment"
  ) {
    throw new RangeError("Environmental movement requires an environmental destination.");
  }
  if ((input.action.preset === "item_interaction") !== Boolean(input.action.itemInteraction)) {
    throw new RangeError("Canonical Item actions require one canonical Item interaction.");
  }

  const action = combatGenericActionSchema.parse({
    ...input.action,
    awarenessContext: input.action.preset === "look_around" ? { kind: "survey" } : undefined,
    lastUpdatedAt: input.action.createdAt,
    progress: {
      completedRounds: 0,
      totalRounds: getCombatGenericActionTotalRounds(input.action.duration),
    },
    status: "declared",
  });
  return [...input.actions, action];
}

export function updateCombatGenericActionIntent(input: {
  actionId: string;
  actions: readonly CombatGenericAction[];
  intent: string;
  updatedAt: string;
}): CombatGenericAction[] {
  const current = requireAction(input.actions, input.actionId);
  if (current.intent === input.intent.trim()) return [...input.actions];

  const next = combatGenericActionSchema.parse({
    ...current,
    intent: input.intent,
    lastUpdatedAt: input.updatedAt,
  });
  return replaceAction(input.actions, next);
}

export function reviewCombatGenericAction(input: {
  actionId: string;
  actions: readonly CombatGenericAction[];
  duration: CombatGenericActionDuration;
  preset?: CombatGenericActionPreset;
  reference?: CombatGenericActionReference;
  reviewedAt: string;
  rollRequest?: CombatGenericActionRollRequest;
}): CombatGenericAction[] {
  const current = requireAction(input.actions, input.actionId);
  if (current.status !== "declared" && current.status !== "reviewed") {
    throw new RangeError("Only a declared Combat action can be reviewed.");
  }
  if (current.preset === "environmental_movement" && input.reference?.kind !== "environment") {
    throw new RangeError("Environmental movement must retain its environmental destination.");
  }
  if (current.preset === "item_interaction" && input.reference?.kind !== "item") {
    throw new RangeError("Canonical Item actions must retain their declared Item.");
  }
  // A review may only set the canonical `look_around` preset on an otherwise plain task. It never
  // adds, removes, or rewrites the Item or environmental-movement presets, whose own declaration
  // invariants are owned by `declareCombatGenericAction`.
  const preset =
    input.preset === undefined || input.preset === current.preset
      ? current.preset
      : input.preset === "look_around" && current.preset === undefined
        ? "look_around"
        : (() => {
            throw new RangeError("This Combat action preset cannot be set during GM review.");
          })();
  // The Perception invariant is asserted where the preset is first applied. An already-preset task
  // keeps the existing authoritative GM roll adjustment behaviour unchanged.
  if (preset === "look_around" && current.preset !== "look_around") {
    if (
      input.rollRequest?.basis.kind !== "skill" ||
      input.rollRequest.basis.skillId !== "perception"
    ) {
      throw new RangeError("Look around uses the canonical Perception skill.");
    }
  }
  const next = combatGenericActionSchema.parse({
    ...current,
    awarenessContext:
      preset === "look_around" ? { kind: "survey" } : (current.awarenessContext ?? undefined),
    duration: input.duration,
    lastUpdatedAt: input.reviewedAt,
    preset,
    progress: {
      completedRounds: 0,
      totalRounds: getCombatGenericActionTotalRounds(input.duration),
    },
    reference: input.reference,
    rollRequest: input.rollRequest,
    status: "reviewed",
  });
  return replaceAction(input.actions, next);
}

export function activateCombatGenericAction(input: {
  actionId: string;
  activatedAt: string;
  actions: readonly CombatGenericAction[];
  roundNumber: number;
  step: CombatRoundStep;
}): CombatGenericAction[] {
  const current = requireAction(input.actions, input.actionId);
  if (current.status === "active") return [...input.actions];
  if (current.status !== "reviewed") {
    throw new RangeError("The GM must review this Combat action before activating it.");
  }
  const next = combatGenericActionSchema.parse({
    ...current,
    lastUpdatedAt: input.activatedAt,
    progress: {
      ...current.progress,
      startedRoundNumber: input.roundNumber,
      startedStep: input.step,
    },
    status: "active",
  });
  return replaceAction(input.actions, next);
}

export function recordCombatGenericActionRoll(input: {
  actionId: string;
  actions: readonly CombatGenericAction[];
  result: CombatGenericActionRollResult;
}): CombatGenericAction[] {
  const current = requireAction(input.actions, input.actionId);
  if (current.rollResult) return [...input.actions];
  if (current.status !== "active" || !current.rollRequest) {
    throw new RangeError("This Combat action does not currently have a roll to make.");
  }

  const next = combatGenericActionSchema.parse({
    ...current,
    lastUpdatedAt: input.result.rolledAt,
    rollResult: input.result,
  });
  return replaceAction(input.actions, next);
}

export function canCompleteCombatGenericAction(input: {
  action: CombatGenericAction;
  roundNumber: number;
  step: CombatRoundStep;
}): boolean {
  const action = combatGenericActionSchema.parse(input.action);
  if (action.status !== "active") return false;
  if (action.duration.kind === "gm_decided") return true;
  if (action.duration.kind === "round" || action.duration.kind === "rounds") {
    return (
      action.progress.totalRounds !== undefined &&
      action.progress.completedRounds >= action.progress.totalRounds
    );
  }

  const startedRoundNumber = action.progress.startedRoundNumber;
  const startedStep = action.progress.startedStep;
  if (startedRoundNumber === undefined || startedStep === undefined) return false;
  const targetStep = action.duration.phase === "phase1" ? "phase_1_actions" : "phase_2_actions";
  const targetIndex = COMBAT_ROUND_STEPS.indexOf(targetStep);
  const currentIndex = COMBAT_ROUND_STEPS.indexOf(input.step);
  const startedIndex = COMBAT_ROUND_STEPS.indexOf(startedStep);
  if (input.roundNumber < startedRoundNumber) return false;
  if (input.roundNumber === startedRoundNumber) {
    return startedIndex < targetIndex && currentIndex > targetIndex;
  }
  if (startedIndex < targetIndex) return true;
  return currentIndex > targetIndex;
}

export function finishCombatGenericAction(input: {
  actionId: string;
  actions: readonly CombatGenericAction[];
  at: string;
  status: CombatGenericActionTerminalStatus;
  resolution?: CombatGenericActionResolution;
  roundNumber?: number;
  step?: CombatRoundStep;
  /**
   * `primary_action_opportunity` is the canonical Perform Task lifecycle timing authority. The
   * default keeps the legacy parallel channel's round/step reasoning unchanged.
   */
  timing?: "primary_action_opportunity";
}): CombatGenericAction[] {
  const current = requireAction(input.actions, input.actionId);
  if (!isCombatGenericActionLive(current)) {
    return [...input.actions];
  }
  if (input.status !== "cancelled" && current.status !== "active") {
    throw new RangeError("Only an active Combat action can be completed or interrupted.");
  }
  if (input.status === "completed" && !input.resolution) {
    throw new RangeError("Enter the GM-controlled result before completing this Combat action.");
  }
  if (input.status === "completed" && input.timing === "primary_action_opportunity") {
    if (!isCombatGenericActionFinalOpportunity(current)) {
      throw new RangeError(
        "This Combat action cannot resolve before its reviewed timing completes.",
      );
    }
  } else if (
    input.status === "completed" &&
    (input.roundNumber === undefined ||
      input.step === undefined ||
      !canCompleteCombatGenericAction({
        action: current,
        roundNumber: input.roundNumber,
        step: input.step,
      }))
  ) {
    throw new RangeError("This Combat action cannot resolve before its reviewed timing completes.");
  }
  const next = combatGenericActionSchema.parse({
    ...current,
    lastUpdatedAt: input.at,
    resolution: input.resolution,
    status: input.status,
  });
  return replaceAction(input.actions, next);
}

/**
 * Carries `round`/`rounds` tasks across a round rollover.
 *
 * `lastProgressedRoundNumber` means exactly one thing: the round in which the owner's
 * primary-action opportunity for this task was consumed. `isCombatGenericActionOpportunityOpen`
 * and `advanceCombatGenericActionAtOpportunity` are its only writers and readers in that sense, so
 * **the rollover must never stamp it**. Stamping the round being entered closed the opportunity
 * for the whole of that round and re-closed it every round after, which made a `rounds: N` task
 * unreachable — no resolve, advance, interrupt or cancel — from round 2 onward (Forgejo #344).
 *
 * `completedRounds` is therefore derived rather than incremented: a round of the task's life
 * counts exactly once, whether the owner spent the opportunity explicitly through
 * `advanceCombatGenericActionAtOpportunity` or the round simply elapsed. `Math.max` keeps an
 * explicit advance already recorded for that round from being counted a second time here, and
 * makes the carry idempotent without a persisted rollover marker.
 *
 * `phase` and `gm_decided` durations are untouched, exactly as before: phase-timed recurrence is
 * governed by rule decision 0007 ruling 3, and `gm_decided` leaves the count with the GM.
 */
export function advanceCombatGenericActionsToRound(input: {
  actions: readonly CombatGenericAction[];
  advancedAt: string;
  nextRoundNumber: number;
}): CombatGenericAction[] {
  return input.actions.map((candidate) => {
    const action = combatGenericActionSchema.parse(candidate);
    const startedRoundNumber = action.progress.startedRoundNumber;
    if (
      action.status !== "active" ||
      startedRoundNumber == null ||
      action.duration.kind === "phase" ||
      action.duration.kind === "gm_decided" ||
      input.nextRoundNumber <= startedRoundNumber
    ) {
      return action;
    }
    const totalRounds = getCombatGenericActionTotalRounds(action.duration);
    const completedRounds = Math.min(
      Math.max(action.progress.completedRounds, input.nextRoundNumber - startedRoundNumber),
      totalRounds ?? Number.MAX_SAFE_INTEGER,
    );
    if (completedRounds === action.progress.completedRounds) return action;
    return combatGenericActionSchema.parse({
      ...action,
      lastUpdatedAt: input.advancedAt,
      progress: {
        ...action.progress,
        completedRounds,
        totalRounds,
      },
    });
  });
}

export function projectCombatGenericActionsForPlayer(input: {
  actions: readonly CombatGenericAction[];
  controlledParticipantIds: ReadonlySet<string>;
  visibleParticipantIds: ReadonlySet<string>;
}): CombatGenericAction[] {
  return input.actions.flatMap((candidate) => {
    const action = combatGenericActionSchema.parse(candidate);
    const ownsAction = input.controlledParticipantIds.has(action.ownerParticipantId);
    const receivesResult = action.resolution?.visibleToParticipantIds.some((id) =>
      input.controlledParticipantIds.has(id),
    );
    const ownerIsVisible = input.visibleParticipantIds.has(action.ownerParticipantId);
    const maySeeItemInteraction =
      action.preset !== "item_interaction" ||
      action.itemInteraction?.visibleToParticipantIds.some((id) =>
        input.controlledParticipantIds.has(id),
      );
    if (!maySeeItemInteraction) return [];
    if (!ownsAction && (!receivesResult || !ownerIsVisible)) return [];

    const reference =
      action.reference?.kind === "participant" &&
      !input.visibleParticipantIds.has(action.reference.participantId)
        ? undefined
        : action.reference?.kind === "item" &&
            !input.visibleParticipantIds.has(action.reference.ownerParticipantId)
          ? undefined
          : action.reference;
    const maySeeResolution = Boolean(receivesResult);
    const itemInteraction = action.itemInteraction
      ? {
          ...action.itemInteraction,
          visibleToParticipantIds: action.itemInteraction.visibleToParticipantIds.filter((id) =>
            input.controlledParticipantIds.has(id),
          ),
        }
      : undefined;
    return [
      combatGenericActionSchema.parse({
        ...action,
        createdByUserId: undefined,
        itemInteraction,
        reference,
        resolution:
          maySeeResolution && action.resolution
            ? {
                ...action.resolution,
                resolvedByUserId: undefined,
                visibleToParticipantIds: action.resolution.visibleToParticipantIds.filter((id) =>
                  input.controlledParticipantIds.has(id),
                ),
              }
            : undefined,
        rollResult:
          ownsAction && action.rollResult
            ? { ...action.rollResult, rolledByUserId: undefined }
            : undefined,
      }),
    ];
  });
}
