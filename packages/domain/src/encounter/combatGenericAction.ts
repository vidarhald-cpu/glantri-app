import { z } from "zod";

import { glantriCharacteristicKeySchema } from "../character/profiles";

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

export const combatGenericActionSchema = z.object({
  awarenessContext: z.object({ kind: z.literal("survey") }).optional(),
  createdAt: z.string().datetime(),
  createdByUserId: idSchema.optional(),
  duration: combatGenericActionDurationSchema,
  id: idSchema,
  intent: z.string().trim().min(1).max(2000),
  lastUpdatedAt: z.string().datetime(),
  ownerParticipantId: idSchema,
  preset: z.enum(["look_around"]).optional(),
  progress: z.object({
    completedRounds: z.number().int().nonnegative().default(0),
    lastProgressedRoundNumber: z.number().int().positive().optional(),
    startedRoundNumber: z.number().int().positive().optional(),
    totalRounds: z.number().int().positive().optional(),
  }),
  reference: combatGenericActionReferenceSchema.optional(),
  resolution: combatGenericActionResolutionSchema.optional(),
  rollRequest: combatGenericActionRollRequestSchema.optional(),
  rollResult: combatGenericActionRollResultSchema.optional(),
  status: combatGenericActionStatusSchema,
});
export type CombatGenericAction = z.infer<typeof combatGenericActionSchema>;

export function getCombatGenericActionTotalRounds(
  duration: CombatGenericActionDuration,
): number | undefined {
  if (duration.kind === "round") return 1;
  if (duration.kind === "rounds") return duration.rounds;
  return undefined;
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

export function reviewCombatGenericAction(input: {
  actionId: string;
  actions: readonly CombatGenericAction[];
  duration: CombatGenericActionDuration;
  reference?: CombatGenericActionReference;
  reviewedAt: string;
  rollRequest?: CombatGenericActionRollRequest;
}): CombatGenericAction[] {
  const current = requireAction(input.actions, input.actionId);
  if (current.status !== "declared" && current.status !== "reviewed") {
    throw new RangeError("Only a declared Combat action can be reviewed.");
  }
  const next = combatGenericActionSchema.parse({
    ...current,
    duration: input.duration,
    lastUpdatedAt: input.reviewedAt,
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
}): CombatGenericAction[] {
  const current = requireAction(input.actions, input.actionId);
  if (current.status === "active") return [...input.actions];
  if (current.status !== "reviewed") {
    throw new RangeError("The GM must review this Combat action before activating it.");
  }
  const next = combatGenericActionSchema.parse({
    ...current,
    lastUpdatedAt: input.activatedAt,
    progress: { ...current.progress, startedRoundNumber: input.roundNumber },
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

export function finishCombatGenericAction(input: {
  actionId: string;
  actions: readonly CombatGenericAction[];
  at: string;
  status: "completed" | "interrupted" | "cancelled";
  resolution?: CombatGenericActionResolution;
}): CombatGenericAction[] {
  const current = requireAction(input.actions, input.actionId);
  if (["completed", "interrupted", "cancelled"].includes(current.status)) {
    return [...input.actions];
  }
  if (input.status !== "cancelled" && current.status !== "active") {
    throw new RangeError("Only an active Combat action can be completed or interrupted.");
  }
  if (input.status === "completed" && !input.resolution) {
    throw new RangeError("Enter the GM-controlled result before completing this Combat action.");
  }
  const next = combatGenericActionSchema.parse({
    ...current,
    lastUpdatedAt: input.at,
    resolution: input.resolution,
    status: input.status,
  });
  return replaceAction(input.actions, next);
}

export function advanceCombatGenericActionsToRound(input: {
  actions: readonly CombatGenericAction[];
  advancedAt: string;
  nextRoundNumber: number;
}): CombatGenericAction[] {
  return input.actions.map((candidate) => {
    const action = combatGenericActionSchema.parse(candidate);
    if (
      action.status !== "active" ||
      action.progress.startedRoundNumber == null ||
      action.duration.kind === "phase" ||
      action.duration.kind === "gm_decided" ||
      action.progress.lastProgressedRoundNumber === input.nextRoundNumber ||
      input.nextRoundNumber <= action.progress.startedRoundNumber
    ) {
      return action;
    }
    const totalRounds = getCombatGenericActionTotalRounds(action.duration);
    return combatGenericActionSchema.parse({
      ...action,
      lastUpdatedAt: input.advancedAt,
      progress: {
        ...action.progress,
        completedRounds: Math.min(
          action.progress.completedRounds + 1,
          totalRounds ?? Number.MAX_SAFE_INTEGER,
        ),
        lastProgressedRoundNumber: input.nextRoundNumber,
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
    return [
      combatGenericActionSchema.parse({
        ...action,
        createdByUserId: undefined,
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
