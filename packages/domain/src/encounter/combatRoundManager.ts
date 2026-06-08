import { z } from "zod";

import {
  scenarioCombatModifierBucketSchema,
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
} from "../campaign/scenario";
import { getCombatDeclarationAttackPhases } from "./combatDeclarationValidation";
import { resolveCombatToHit } from "./toHitTable";
import type { EncounterParticipant, EncounterSession } from "./session";

const idSchema = z.string().min(1);

export const combatRoundStepSchema = z.enum([
  "select_actions",
  "review_action_modifiers",
  "initiative_phase_1",
  "phase_1_actions",
  "review_phase_2_actions",
  "phase_1_damage",
  "review_phase_2_modifiers",
  "initiative_phase_2",
  "phase_2_actions",
  "review_phase_2_damage",
  "phase_2_damage",
  "round_summary",
]);

export const COMBAT_ROUND_STEPS = combatRoundStepSchema.options;
export type CombatRoundStep = z.infer<typeof combatRoundStepSchema>;

export const COMBAT_ROUND_STEP_ABBREVIATIONS = {
  initiative_phase_1: "i1",
  initiative_phase_2: "i2",
  phase_1_actions: "A1",
  phase_1_damage: "D1",
  phase_2_actions: "A2",
  phase_2_damage: "D2",
  review_action_modifiers: "M1",
  review_phase_2_actions: "P1",
  review_phase_2_damage: "P2",
  review_phase_2_modifiers: "M2",
  round_summary: "SU",
  select_actions: "DE",
} satisfies Record<CombatRoundStep, string>;

export const COMBAT_ROUND_STEP_LABELS = {
  initiative_phase_1: "Initiative phase 1",
  initiative_phase_2: "Initiative phase 2",
  phase_1_actions: "A1 Attack/action roll",
  phase_1_damage: "D1 Damage/effects review",
  phase_2_actions: "A2 Attack/action roll",
  phase_2_damage: "D2 Damage/effects review",
  review_action_modifiers: "Review phase 1 modifiers",
  review_phase_2_actions: "P1 Parry/defense resolution",
  review_phase_2_damage: "P2 Parry/defense resolution",
  review_phase_2_modifiers: "Review/modify phase 2 actions/modifiers",
  round_summary: "Summary/update",
  select_actions: "Declaration",
} satisfies Record<CombatRoundStep, string>;

export const combatRoundStepStatusSchema = z.enum([
  "pending",
  "ready",
  "submitted",
  "gmEdited",
  "locked",
  "complete",
  "skipped",
]);

export const combatRoundInitiativeResultSchema = z.object({
  baseInitiative: z.number().int().default(0),
  modifierAdjustment: z.number().int().default(0),
  rolls: z.array(z.number().int().min(1).max(6)).default([]),
  rollTotal: z.number().int().optional(),
  total: z.number().int(),
});
const legacyCombatRoundInitiativeResultSchema = z
  .number()
  .int()
  .transform((total) => ({
    baseInitiative: 0,
    modifierAdjustment: 0,
    rolls: [],
    rollTotal: total,
    total,
  }));

export const combatRoundInitiativesSchema = z.object({
  phase1: z
    .union([combatRoundInitiativeResultSchema, legacyCombatRoundInitiativeResultSchema])
    .optional(),
  phase2: z
    .union([combatRoundInitiativeResultSchema, legacyCombatRoundInitiativeResultSchema])
    .optional(),
});

export const combatRoundPhaseContextsSchema = z.object({
  phase1: scenarioParticipantCombatContextSchema.optional(),
  phase2: scenarioParticipantCombatContextSchema.optional(),
});

export const combatRoundPhaseSchema = z.enum(["phase1", "phase2"]);
export type CombatRoundPhase = z.infer<typeof combatRoundPhaseSchema>;
export const combatRoundPhaseResolutionSubstepSchema = z.enum([
  "attack",
  "parry",
  "damage",
  "effects",
  "done",
]);
export const combatRoundPhaseResolutionStatusSubstepSchema = z.enum([
  "pending",
  ...combatRoundPhaseResolutionSubstepSchema.options,
]);
export type CombatRoundPhaseResolutionSubstep = z.infer<
  typeof combatRoundPhaseResolutionSubstepSchema
>;

export const combatRoundAttackRollResultSchema = z.object({
  actionId: idSchema,
  attackerParticipantId: idSchema,
  defenderParticipantId: idSchema,
  defenderDb: z.number().int(),
  grazing: z.boolean(),
  hit: z.boolean(),
  kind: z.literal("attackRoll"),
  lookupTotal: z.number().int(),
  marginOverMissThreshold: z.number().int(),
  ob: z.number().int(),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  phase: combatRoundPhaseSchema,
  roll: z.number().int().min(1).max(20).optional(),
  rollD20: z.number().int().min(1).max(20).optional(),
  rollTotal: z.number().int().optional(),
  rolledAt: z.string().datetime(),
  rolledByUserId: idSchema.optional(),
  tableResult: z.string().min(1),
  weaponName: z.string().min(1),
}).superRefine((result, context) => {
  if (result.rollTotal === undefined && result.roll === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Combat attack result requires rollTotal or legacy roll.",
      path: ["rollTotal"],
    });
  }
  if (result.rollD20 === undefined && result.roll === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Combat attack result requires rollD20 or legacy roll.",
      path: ["rollD20"],
    });
  }
}).transform((result) => {
  const rollTotal = result.rollTotal ?? result.roll;
  const rollD20 = result.rollD20 ?? result.roll;

  if (rollTotal === undefined || rollD20 === undefined) {
    throw new RangeError("Combat attack result requires an open-ended roll breakdown.");
  }

  return {
    ...result,
    rollD20,
    rollTotal,
  };
});

export const combatRoundAttackResultsSchema = z.object({
  phase1: combatRoundAttackRollResultSchema.optional(),
  phase2: combatRoundAttackRollResultSchema.optional(),
});

export const combatRoundPhaseResolutionCursorSchema = z.object({
  participantId: idSchema,
  phase: combatRoundPhaseSchema,
  substep: combatRoundPhaseResolutionSubstepSchema,
});

export const combatRoundPhaseResolutionParticipantStatusSchema = z.object({
  substep: combatRoundPhaseResolutionStatusSubstepSchema.default("pending"),
  updatedAt: z.string().datetime().optional(),
});

export const combatRoundPhaseResolutionStatusesSchema = z.record(
  idSchema,
  z
    .object({
      phase1: combatRoundPhaseResolutionParticipantStatusSchema.optional(),
      phase2: combatRoundPhaseResolutionParticipantStatusSchema.optional(),
    })
    .default({}),
);

export const combatRoundParryResolutionSchema = z.object({
  combinedParryScore: z.number().int().optional(),
  mainHandParryScore: z.number().int().optional(),
  modifierAdjustment: z.number().int().optional(),
  notes: z.string().optional(),
  offHandParryScore: z.number().int().optional(),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  resultLabel: z.string().min(1).optional(),
  rollD20: z.number().int().min(1).max(20).optional(),
  rollTotal: z.number().int().optional(),
  status: z.enum(["pending", "not_applicable", "resolved"]),
  success: z.boolean().optional(),
  targetNumber: z.number().int().positive().optional(),
  total: z.number().int().optional(),
  usedMainHand: z.boolean().optional(),
  usedOffHand: z.boolean().optional(),
});
export type CombatRoundParryResolution = z.infer<typeof combatRoundParryResolutionSchema>;

export const combatRoundPhaseResolutionResultSchema = z.object({
  attackResultId: idSchema,
  attackerParticipantId: idSchema,
  damageProposal: z
    .object({
      proposedEffects: z.array(z.never()).default([]),
      status: z.enum(["not_ready", "drafted", "committed"]),
    })
    .default({ proposedEffects: [], status: "not_ready" }),
  damageRoll: z
    .object({
      diceExpression: z.string().min(1).optional(),
      notes: z.string().optional(),
      rolls: z.array(z.number().int()).optional(),
      status: z.enum(["not_required", "pending", "rolled"]),
      total: z.number().int().optional(),
    })
    .default({ status: "pending" }),
  defenderParticipantId: idSchema,
  parryResolution: combatRoundParryResolutionSchema.default({ status: "pending" }),
  phase: combatRoundPhaseSchema,
  roundNumber: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});

export const combatRoundDeclarationSchema = z.object({
  actionId: idSchema.optional(),
  additionalActionNotes: z.string().optional(),
  combatContext: scenarioParticipantCombatContextSchema.optional(),
  movementId: z.string().min(1).optional(),
  phaseContexts: combatRoundPhaseContextsSchema.optional(),
  roundNumber: z.number().int().positive(),
  secondaryActionId: idSchema.optional(),
  submittedAt: z.string().datetime().optional(),
  submittedBy: z.enum(["gm", "player"]),
  submittedByUserId: idSchema.optional(),
});

const combatRoundStepStatusesSchema = z.record(combatRoundStepSchema, combatRoundStepStatusSchema);

export const combatRoundParticipantStateSchema = z.object({
  attackResults: combatRoundAttackResultsSchema.default({}),
  declaration: combatRoundDeclarationSchema.optional(),
  initiatives: combatRoundInitiativesSchema.default({}),
  label: z.string().min(1),
  participantId: idSchema,
  stepStatuses: combatRoundStepStatusesSchema.default(
    Object.fromEntries(COMBAT_ROUND_STEPS.map((step) => [step, "pending"])),
  ),
});

export const combatRoundStepSnapshotSchema = z.object({
  actionResultSummary: z.string().optional(),
  attackResult: combatRoundAttackRollResultSchema.optional(),
  attackSummary: z
    .object({
      attackMode: z.string(),
      dmb: z.string(),
      initiative: z.string(),
      maxCrits: z.string(),
      ob: z.string(),
      weaponName: z.string(),
    })
    .optional(),
  committedAt: z.string().datetime(),
  declarationSummary: z
    .object({
      actionId: idSchema.optional(),
      additionalActionNotes: z.string().optional(),
      movementId: idSchema.optional(),
      secondaryActionId: idSchema.optional(),
    })
    .optional(),
  defenseSummary: z
    .object({
      db: z.string(),
      dm: z.string(),
      parry: z.string(),
      sourceName: z.string(),
    })
    .optional(),
  id: idSchema,
  initiativeRank: z
    .object({
      rank: z.number().int().positive(),
      rankTotal: z.number().int().nonnegative(),
      tiedCount: z.number().int().positive(),
    })
    .optional(),
  initiativeResult: combatRoundInitiativeResultSchema.optional(),
  modifierSummary: z
    .object({
      dbRaw: z.number().int().default(0),
      generalFatigueRaw: z.number().int().default(0),
      initiativeRaw: z.number().int().default(0),
      obSkillRaw: z.number().int().default(0),
      rows: z
        .array(
          z.object({
            bucketKey: scenarioCombatModifierBucketSchema,
            entries: z.array(scenarioCombatModifierEntrySchema).default([]),
            label: z.string().min(1),
            total: z.number().int(),
          }),
        )
        .default([]),
    })
    .optional(),
  participantId: idSchema,
  participantLabel: z.string().min(1),
  phase: combatRoundPhaseSchema.optional(),
  phaseContext: scenarioParticipantCombatContextSchema.optional(),
  phaseResolutionStatus: combatRoundPhaseResolutionParticipantStatusSchema.optional(),
  phaseResolutionResult: combatRoundPhaseResolutionResultSchema.optional(),
  roundNumber: z.number().int().positive(),
  step: combatRoundStepSchema,
});

export const combatRoundStateSchema = z.object({
  activeParticipantId: idSchema.optional(),
  currentStep: combatRoundStepSchema.default("select_actions"),
  phaseResolutionCursor: combatRoundPhaseResolutionCursorSchema.optional(),
  phaseResolutionResults: z.array(combatRoundPhaseResolutionResultSchema).default([]),
  phaseResolutionStatuses: combatRoundPhaseResolutionStatusesSchema.default({}),
  participants: z.array(combatRoundParticipantStateSchema).default([]),
  roundNumber: z.number().int().positive().default(1),
  selectedParticipantId: idSchema.optional(),
  selectedStep: combatRoundStepSchema.optional(),
  stepSnapshots: z.array(combatRoundStepSnapshotSchema).default([]),
});

export type CombatRoundStepStatus = z.infer<typeof combatRoundStepStatusSchema>;
export type CombatRoundDeclaration = z.infer<typeof combatRoundDeclarationSchema>;
export type CombatRoundPhaseContexts = z.infer<typeof combatRoundPhaseContextsSchema>;
export type CombatRoundInitiativeResult = z.infer<typeof combatRoundInitiativeResultSchema>;
export type CombatRoundInitiatives = z.infer<typeof combatRoundInitiativesSchema>;
export type CombatRoundAttackRollResult = z.infer<typeof combatRoundAttackRollResultSchema>;
export type CombatRoundAttackResults = z.infer<typeof combatRoundAttackResultsSchema>;
export type CombatRoundPhaseResolutionCursor = z.infer<
  typeof combatRoundPhaseResolutionCursorSchema
>;
export type CombatRoundPhaseResolutionResult = z.infer<
  typeof combatRoundPhaseResolutionResultSchema
>;
export type CombatRoundPhaseResolutionParticipantStatus = z.infer<
  typeof combatRoundPhaseResolutionParticipantStatusSchema
>;
export type CombatRoundPhaseResolutionStatuses = z.infer<
  typeof combatRoundPhaseResolutionStatusesSchema
>;
export type CombatRoundParticipantState = z.infer<typeof combatRoundParticipantStateSchema>;
export type CombatRoundStepSnapshot = z.infer<typeof combatRoundStepSnapshotSchema>;
export type CombatRoundState = z.infer<typeof combatRoundStateSchema>;
export interface CombatRoundInitiativeRank {
  rank: number;
  rankTotal: number;
  tiedCount: number;
}

export function rollOpenEndedD6(
  input: {
    maxRolls?: number;
    randomFn?: () => number;
  } = {},
): CombatRoundInitiativeResult & { isOpenEnded: boolean } {
  const randomFn = input.randomFn ?? Math.random;
  const maxRolls = input.maxRolls ?? 100;
  const rolls: number[] = [];

  for (let index = 0; index < maxRolls; index += 1) {
    const roll = Math.min(6, Math.max(1, Math.floor(randomFn() * 6) + 1));
    rolls.push(roll);

    if (roll !== 6) {
      break;
    }
  }

  return {
    baseInitiative: 0,
    isOpenEnded: rolls.length > 1,
    modifierAdjustment: 0,
    rolls,
    rollTotal: rolls.reduce((sum, roll) => sum + roll, 0),
    total: rolls.reduce((sum, roll) => sum + roll, 0),
  };
}

export function buildCombatRoundInitiativeResult(input: {
  baseInitiative?: number;
  modifierAdjustment?: number;
  roll: CombatRoundInitiativeResult;
}): CombatRoundInitiativeResult {
  const rollTotal = input.roll.rollTotal ?? input.roll.total;
  const baseInitiative = input.baseInitiative ?? 0;
  const modifierAdjustment = input.modifierAdjustment ?? 0;

  return combatRoundInitiativeResultSchema.parse({
    baseInitiative,
    modifierAdjustment,
    rolls: input.roll.rolls,
    rollTotal,
    total: baseInitiative + modifierAdjustment + rollTotal,
  });
}

function normalizeCombatRoundInitiativeResult(
  initiative: CombatRoundInitiativeResult | number | undefined,
): CombatRoundInitiativeResult | undefined {
  if (initiative === undefined) {
    return undefined;
  }

  return combatRoundInitiativeResultSchema.parse(
    typeof initiative === "number"
      ? { baseInitiative: 0, rolls: [], rollTotal: initiative, total: initiative }
      : {
          ...initiative,
          modifierAdjustment:
            initiative.modifierAdjustment ??
            initiative.total -
              (initiative.baseInitiative ?? 0) -
              (initiative.rollTotal ?? initiative.total - (initiative.baseInitiative ?? 0)),
          rollTotal: initiative.rollTotal ?? initiative.total - (initiative.baseInitiative ?? 0),
        },
  );
}

export function getCombatRoundInitiativeTotal(
  initiative?: CombatRoundInitiativeResult,
): number | undefined {
  return initiative?.total;
}

function buildDefaultStepStatuses(): Record<CombatRoundStep, CombatRoundStepStatus> {
  return Object.fromEntries(COMBAT_ROUND_STEPS.map((step) => [step, "pending"])) as Record<
    CombatRoundStep,
    CombatRoundStepStatus
  >;
}

function mergeStepStatuses(
  existing?: Partial<Record<CombatRoundStep, CombatRoundStepStatus>>,
): Record<CombatRoundStep, CombatRoundStepStatus> {
  return {
    ...buildDefaultStepStatuses(),
    ...existing,
  };
}

function getStepIndex(step: CombatRoundStep): number {
  return COMBAT_ROUND_STEPS.indexOf(step);
}

function isSameCombatRoundStepSnapshot(
  left: CombatRoundStepSnapshot,
  right: Pick<CombatRoundStepSnapshot, "participantId" | "roundNumber" | "step">,
): boolean {
  return (
    left.roundNumber === right.roundNumber &&
    left.participantId === right.participantId &&
    left.step === right.step
  );
}

function clearSnapshotsFromStep(input: {
  participantId?: string;
  roundNumber: number;
  snapshots: CombatRoundStepSnapshot[];
  step: CombatRoundStep;
}): CombatRoundStepSnapshot[] {
  const clearFromIndex = getStepIndex(input.step);

  return input.snapshots.filter((snapshot) => {
    if (snapshot.roundNumber !== input.roundNumber) {
      return true;
    }

    if (input.participantId && snapshot.participantId !== input.participantId) {
      return true;
    }

    return getStepIndex(snapshot.step) < clearFromIndex;
  });
}

function clearSnapshotsForCombatRoundStep(input: {
  participantId?: string;
  roundNumber: number;
  selectedAttackResult?: CombatRoundAttackRollResult;
  snapshots: CombatRoundStepSnapshot[];
  step: CombatRoundStep;
}): CombatRoundStepSnapshot[] {
  const pairedStepsByStep: Partial<Record<CombatRoundStep, CombatRoundStep[]>> = {
    phase_1_actions: ["phase_1_actions", "review_phase_2_actions", "phase_1_damage"],
    phase_1_damage: ["phase_1_damage"],
    phase_2_actions: ["phase_2_actions", "review_phase_2_damage", "phase_2_damage"],
    phase_2_damage: ["phase_2_damage"],
    review_phase_2_actions: ["review_phase_2_actions"],
    review_phase_2_damage: ["review_phase_2_damage"],
  };
  const pairedSteps = pairedStepsByStep[input.step];

  if (!pairedSteps) {
    return clearSnapshotsFromStep(input);
  }

  if (input.selectedAttackResult) {
    const attackStep = getCombatRoundPhaseActionStepForPhase(input.selectedAttackResult.phase);
    const parryStep = getCombatRoundParryReviewStepForPhase(input.selectedAttackResult.phase);
    const damageStep = getCombatRoundDamageReviewStepForPhase(input.selectedAttackResult.phase);
    const clearedSnapshotKeys = new Set<string>();

    if (input.step === attackStep) {
      clearedSnapshotKeys.add(`${input.selectedAttackResult.attackerParticipantId}:${attackStep}`);
      clearedSnapshotKeys.add(`${input.selectedAttackResult.defenderParticipantId}:${parryStep}`);
      clearedSnapshotKeys.add(`${input.selectedAttackResult.defenderParticipantId}:${damageStep}`);
    } else if (input.step === parryStep) {
      clearedSnapshotKeys.add(`${input.selectedAttackResult.defenderParticipantId}:${parryStep}`);
      clearedSnapshotKeys.add(`${input.selectedAttackResult.defenderParticipantId}:${damageStep}`);
    } else if (input.step === damageStep) {
      clearedSnapshotKeys.add(`${input.selectedAttackResult.defenderParticipantId}:${damageStep}`);
    }

    return input.snapshots.filter(
      (snapshot) =>
        snapshot.roundNumber !== input.roundNumber ||
        !clearedSnapshotKeys.has(`${snapshot.participantId}:${snapshot.step}`),
    );
  }

  if (input.participantId) {
    return input.snapshots.filter((snapshot) => {
      if (snapshot.roundNumber !== input.roundNumber) {
        return true;
      }

      if (snapshot.participantId !== input.participantId) {
        return true;
      }

      if (input.step === "review_phase_2_actions") {
        return snapshot.step !== "review_phase_2_actions" && snapshot.step !== "phase_1_damage";
      }

      if (input.step === "review_phase_2_damage") {
        return snapshot.step !== "review_phase_2_damage" && snapshot.step !== "phase_2_damage";
      }

      return !pairedSteps.includes(snapshot.step);
    });
  }

  return input.snapshots.filter(
    (snapshot) =>
      snapshot.roundNumber !== input.roundNumber ||
      !pairedSteps.includes(snapshot.step),
  );
}

function clearCombatRoundParticipantOutgoingResolutionState(input: {
  participantId: string;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const outgoingResults = normalized.participants
    .filter((participant) => participant.participantId === input.participantId)
    .flatMap((participant) =>
      [participant.attackResults.phase1, participant.attackResults.phase2].filter(
        (result): result is CombatRoundAttackRollResult => Boolean(result),
      ),
    );
  const affectedParticipantIds = new Set<string>([input.participantId]);
  const affectedDefenderSteps = new Map<string, Partial<Record<CombatRoundStep, "pending">>>();
  const affectedSnapshotSteps = new Map<string, Set<CombatRoundStep>>();

  for (const result of outgoingResults) {
    affectedParticipantIds.add(result.defenderParticipantId);
    const attackerSteps = affectedSnapshotSteps.get(result.attackerParticipantId) ?? new Set();
    attackerSteps.add(getCombatRoundPhaseActionStepForPhase(result.phase));
    affectedSnapshotSteps.set(result.attackerParticipantId, attackerSteps);

    const defenderSteps = affectedSnapshotSteps.get(result.defenderParticipantId) ?? new Set();
    affectedDefenderSteps.set(result.defenderParticipantId, {
      ...affectedDefenderSteps.get(result.defenderParticipantId),
      ...(result.phase === "phase1"
        ? {
            phase_1_damage: "pending",
            review_phase_2_actions: "pending",
          }
        : {
            phase_2_damage: "pending",
            review_phase_2_damage: "pending",
          }),
    });
    defenderSteps.add(getCombatRoundParryReviewStepForPhase(result.phase));
    defenderSteps.add(getCombatRoundDamageReviewStepForPhase(result.phase));
    affectedSnapshotSteps.set(result.defenderParticipantId, defenderSteps);
  }

  return {
    ...normalized,
    phaseResolutionCursor:
      normalized.phaseResolutionCursor &&
      affectedParticipantIds.has(normalized.phaseResolutionCursor.participantId)
        ? undefined
        : normalized.phaseResolutionCursor,
    phaseResolutionResults: normalized.phaseResolutionResults.filter(
      (result) =>
        result.roundNumber !== normalized.roundNumber ||
        result.attackerParticipantId !== input.participantId,
    ),
    phaseResolutionStatuses: {
      ...normalized.phaseResolutionStatuses,
      [input.participantId]: {},
    },
    participants: normalized.participants.map((participant) => {
      if (participant.participantId === input.participantId) {
        return {
          ...participant,
          attackResults: {},
          stepStatuses: {
            ...participant.stepStatuses,
            phase_1_actions: "pending",
            phase_1_damage: "pending",
            phase_2_actions: "pending",
            phase_2_damage: "pending",
            review_phase_2_actions: "pending",
            review_phase_2_damage: "pending",
          },
        };
      }

      const defenderSteps = affectedDefenderSteps.get(participant.participantId);

      return defenderSteps
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              ...defenderSteps,
            },
          }
        : participant;
    }),
    stepSnapshots: normalized.stepSnapshots.filter(
      (snapshot) => {
        if (snapshot.roundNumber !== normalized.roundNumber) {
          return true;
        }

        return !affectedSnapshotSteps.get(snapshot.participantId)?.has(snapshot.step);
      },
    ),
  };
}

function participantStateFromEncounterParticipant(input: {
  existing?: CombatRoundParticipantState;
  participant: EncounterParticipant;
}): CombatRoundParticipantState {
  return {
    attackResults: input.existing?.attackResults ?? {},
    declaration: input.existing?.declaration,
    initiatives: input.existing?.initiatives ?? {},
    label: input.participant.label,
    participantId: input.participant.id,
    stepStatuses: mergeStepStatuses(input.existing?.stepStatuses),
  };
}

export function buildCombatRoundAttackRollResult(input: {
  actionId: string;
  attackerParticipantId: string;
  defenderDb: number;
  defenderParticipantId: string;
  ob: number;
  openEndedD10s?: number[];
  phase: CombatRoundPhase;
  roll?: number;
  rollD20?: number;
  rollTotal?: number;
  rolledAt: string;
  rolledByUserId?: string;
  weaponName: string;
}): CombatRoundAttackRollResult {
  const rollTotal = input.rollTotal ?? input.roll;

  if (rollTotal === undefined) {
    throw new RangeError("Combat attack result requires an open-ended roll total.");
  }

  const toHit = resolveCombatToHit({
    db: input.defenderDb,
    ob: input.ob,
    rollTotal,
  });

  return combatRoundAttackRollResultSchema.parse({
    actionId: input.actionId,
    attackerParticipantId: input.attackerParticipantId,
    defenderDb: input.defenderDb,
    defenderParticipantId: input.defenderParticipantId,
    grazing: toHit.grazing,
    hit: toHit.hit,
    kind: "attackRoll",
    lookupTotal: toHit.lookupTotal,
    marginOverMissThreshold: toHit.lookupTotal - 10,
    ob: input.ob,
    openEndedD10s: input.openEndedD10s ?? [],
    phase: input.phase,
    roll: input.roll,
    rollD20: input.rollD20 ?? input.roll,
    rollTotal,
    rolledAt: input.rolledAt,
    rolledByUserId: input.rolledByUserId,
    tableResult: toHit.resultLabel,
    weaponName: input.weaponName,
  });
}

export function getCombatRoundAttackResultsForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): {
  incoming: CombatRoundAttackRollResult[];
  outgoing?: CombatRoundAttackRollResult;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const outgoing = normalized.participants.find(
    (participant) => participant.participantId === input.participantId,
  )?.attackResults[input.phase];
  const incoming = normalized.participants
    .map((participant) => participant.attackResults[input.phase])
    .filter(
      (result): result is CombatRoundAttackRollResult =>
        result !== undefined && result.defenderParticipantId === input.participantId,
    );

  return { incoming, outgoing };
}

export function getCombatRoundOutgoingAttackResultForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundAttackRollResult | undefined {
  return getCombatRoundAttackResultsForParticipantPhase(input).outgoing;
}

export function getCombatRoundIncomingAttackResultsForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundAttackRollResult[] {
  return getCombatRoundAttackResultsForParticipantPhase(input).incoming;
}

export function getCombatRoundDisplayIncomingAttackResultForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundAttackRollResult | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const incoming = getCombatRoundIncomingAttackResultsForParticipantPhase({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });

  return (
    incoming.find((attackResult) => {
      const resolution = getCombatRoundPhaseResolutionResultForAttack({
        attackResult,
        state: normalized,
      });

      return resolution?.parryResolution.status === "pending";
    }) ?? incoming[0]
  );
}

export function getCombatRoundDisplayAttackResultForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundAttackRollResult | undefined {
  const results = getCombatRoundAttackResultsForParticipantPhase(input);

  return results.outgoing ?? results.incoming[0];
}

export function getCombatRoundResolutionPhaseForStep(
  step: CombatRoundStep,
): CombatRoundPhase | undefined {
  if (step === "review_phase_2_actions" || step === "phase_1_damage") {
    return "phase1";
  }

  if (step === "review_phase_2_damage" || step === "phase_2_damage") {
    return "phase2";
  }

  return undefined;
}

export function getCombatRoundParryReviewStepForPhase(phase: CombatRoundPhase): CombatRoundStep {
  return phase === "phase1" ? "review_phase_2_actions" : "review_phase_2_damage";
}

export function getCombatRoundDamageReviewStepForPhase(phase: CombatRoundPhase): CombatRoundStep {
  return phase === "phase1" ? "phase_1_damage" : "phase_2_damage";
}

export function getCombatRoundPhaseActionStepForPhase(phase: CombatRoundPhase): CombatRoundStep {
  return phase === "phase1" ? "phase_1_actions" : "phase_2_actions";
}

function getCombatRoundAttackPhaseForStep(step: CombatRoundStep): CombatRoundPhase | undefined {
  if (step === "phase_1_actions") {
    return "phase1";
  }

  if (step === "phase_2_actions") {
    return "phase2";
  }

  return undefined;
}

function getCombatRoundPhaseParryStepForPhase(phase: CombatRoundPhase): CombatRoundStep {
  return phase === "phase1" ? "review_phase_2_actions" : "review_phase_2_damage";
}

export function combatRoundParticipantHasPhaseAttack(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );

  if (!participant?.declaration) {
    return false;
  }

  return getCombatDeclarationAttackPhases({
    actionId: participant.declaration.actionId,
    secondaryActionId: participant.declaration.secondaryActionId,
  }).includes(input.phase);
}

function getCombatRoundInitialPhaseResolutionSubstep(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundPhaseResolutionSubstep {
  return combatRoundParticipantHasPhaseAttack(input) ? "attack" : "parry";
}

function getCombatRoundPostAttackResolutionSubstep(
  attackResult: CombatRoundAttackRollResult,
): CombatRoundPhaseResolutionSubstep {
  return attackResult.hit ? "parry" : "effects";
}

export function getCombatRoundPhaseResolutionStatus(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundPhaseResolutionParticipantStatus {
  const normalized = combatRoundStateSchema.parse(input.state);

  return (
    normalized.phaseResolutionStatuses[input.participantId]?.[input.phase] ?? {
      substep: "pending",
    }
  );
}

export function getCombatRoundParticipantPhaseStepStatus(input: {
  participantId: string;
  state: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundStepStatus {
  const normalized = combatRoundStateSchema.parse(input.state);
  const phase =
    getCombatRoundAttackPhaseForStep(input.step) ??
    getCombatRoundResolutionPhaseForStep(input.step);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const storedStatus = participant?.stepStatuses[input.step] ?? "pending";

  if (!phase) {
    return storedStatus;
  }

  const actionStep = getCombatRoundPhaseActionStepForPhase(phase);
  const parryStep = getCombatRoundPhaseParryStepForPhase(phase);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);
  const phaseStatus = getCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase,
    state: normalized,
  });

  if (input.step === actionStep) {
    const hasPhaseAttack = combatRoundParticipantHasPhaseAttack({
      participantId: input.participantId,
      phase,
      state: normalized,
    });

    if (!hasPhaseAttack) {
      return phaseStatus.substep === "done" ? "skipped" : storedStatus;
    }

    const outgoingAttackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: input.participantId,
      phase,
      state: normalized,
    });

    return outgoingAttackResult ? "gmEdited" : storedStatus;
  }

  const incomingAttackResult = getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
    participantId: input.participantId,
    phase,
    state: normalized,
  });

  if (!incomingAttackResult) {
    return "skipped";
  }

  const resolution =
    getCombatRoundPhaseResolutionResultForAttack({
      attackResult: incomingAttackResult,
      state: normalized,
    }) ??
    buildCombatRoundPhaseResolutionResult({
      attackResult: incomingAttackResult,
      roundNumber: normalized.roundNumber,
      updatedAt: incomingAttackResult.rolledAt,
    });

  if (input.step === parryStep) {
    if (!incomingAttackResult.hit || resolution.parryResolution.status === "not_applicable") {
      return "skipped";
    }

    return resolution.parryResolution.status === "resolved" ? "complete" : "pending";
  }

  if (input.step === damageStep) {
    if (!incomingAttackResult.hit || resolution.damageRoll.status === "not_required") {
      return "skipped";
    }

    if (storedStatus === "submitted" || storedStatus === "gmEdited" || storedStatus === "complete") {
      return storedStatus;
    }

    return "pending";
  }

  return storedStatus;
}

function setCombatRoundPhaseResolutionStatus(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  status: CombatRoundPhaseResolutionParticipantStatus;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);

  return {
    ...normalized,
    phaseResolutionStatuses: {
      ...normalized.phaseResolutionStatuses,
      [input.participantId]: {
        ...normalized.phaseResolutionStatuses[input.participantId],
        [input.phase]: combatRoundPhaseResolutionParticipantStatusSchema.parse(input.status),
      },
    },
  };
}

export function getCombatRoundPhaseResolutionOrder(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): string[] {
  return sortCombatRoundParticipantsByInitiative(input).map(
    (participant) => participant.participantId,
  );
}

export function initializeCombatRoundPhaseResolutionCursor(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt?: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const order = getCombatRoundPhaseResolutionOrder({
    phase: input.phase,
    state: normalized,
  });
  const participantId = order.find(
    (id) =>
      getCombatRoundPhaseResolutionStatus({
        participantId: id,
        phase: input.phase,
        state: normalized,
      }).substep !== "done",
  );

  if (!participantId) {
    return {
      ...normalized,
      phaseResolutionCursor: undefined,
    };
  }

  const existingStatus = getCombatRoundPhaseResolutionStatus({
    participantId,
    phase: input.phase,
    state: normalized,
  });
  const nextSubstep =
    existingStatus.substep === "pending"
      ? getCombatRoundInitialPhaseResolutionSubstep({
          participantId,
          phase: input.phase,
          state: normalized,
        })
      : existingStatus.substep;
  const withStatus = setCombatRoundPhaseResolutionStatus({
    participantId,
    phase: input.phase,
    state: normalized,
    status: {
      substep: nextSubstep,
      updatedAt: input.updatedAt ?? existingStatus.updatedAt,
    },
  });

  return {
    ...withStatus,
    phaseResolutionCursor: {
      participantId,
      phase: input.phase,
      substep: nextSubstep,
    },
    selectedParticipantId: participantId,
    selectedStep: getCombatRoundPhaseActionStepForPhase(input.phase),
  };
}

function moveCombatRoundPhaseResolutionCursorToNextParticipant(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const order = getCombatRoundPhaseResolutionOrder({
    phase: input.phase,
    state: normalized,
  });
  const participantId = order.find(
    (id) =>
      getCombatRoundPhaseResolutionStatus({
        participantId: id,
        phase: input.phase,
        state: normalized,
      }).substep !== "done",
  );

  if (!participantId) {
    return {
      ...normalized,
      phaseResolutionCursor: undefined,
    };
  }

  const nextSubstep = getCombatRoundInitialPhaseResolutionSubstep({
    participantId,
    phase: input.phase,
    state: normalized,
  });
  const withStatus = setCombatRoundPhaseResolutionStatus({
    participantId,
    phase: input.phase,
    state: normalized,
    status: {
      substep: nextSubstep,
      updatedAt: input.updatedAt,
    },
  });

  return {
    ...withStatus,
    phaseResolutionCursor: {
      participantId,
      phase: input.phase,
      substep: nextSubstep,
    },
    selectedParticipantId: participantId,
    selectedStep: getCombatRoundPhaseActionStepForPhase(input.phase),
  };
}

export function recordCombatRoundPhaseResolutionAttackDone(input: {
  attackResult: CombatRoundAttackRollResult;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  if (!input.attackResult.hit) {
    const withMissDoneStatus = setCombatRoundPhaseResolutionStatus({
      participantId: input.attackResult.attackerParticipantId,
      phase: input.attackResult.phase,
      state: input.state,
      status: {
        substep: "done",
        updatedAt: input.updatedAt,
      },
    });

    return moveCombatRoundPhaseResolutionCursorToNextParticipant({
      phase: input.attackResult.phase,
      state: withMissDoneStatus,
      updatedAt: input.updatedAt,
    });
  }

  const nextSubstep = getCombatRoundPostAttackResolutionSubstep(input.attackResult);
  const withStatus = setCombatRoundPhaseResolutionStatus({
    participantId: input.attackResult.attackerParticipantId,
    phase: input.attackResult.phase,
    state: input.state,
    status: {
      substep: nextSubstep,
      updatedAt: input.updatedAt,
    },
  });

  return {
    ...withStatus,
    phaseResolutionCursor: {
      participantId: input.attackResult.hit
        ? input.attackResult.defenderParticipantId
        : input.attackResult.attackerParticipantId,
      phase: input.attackResult.phase,
      substep: nextSubstep,
    },
    selectedParticipantId: input.attackResult.hit
      ? input.attackResult.defenderParticipantId
      : input.attackResult.attackerParticipantId,
    selectedStep: input.attackResult.hit
      ? getCombatRoundParryReviewStepForPhase(input.attackResult.phase)
      : getCombatRoundDamageReviewStepForPhase(input.attackResult.phase),
  };
}

export function advanceCombatRoundPhaseResolutionSubstepForParticipant(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const currentStatus = getCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });
  const currentSubstep =
    currentStatus.substep === "pending"
      ? getCombatRoundInitialPhaseResolutionSubstep(input)
      : currentStatus.substep;

  if (currentSubstep === "done") {
    return normalized;
  }

  if (currentSubstep === "effects") {
    return completeCombatRoundPhaseResolutionForParticipant({
      participantId: input.participantId,
      phase: input.phase,
      state: normalized,
      submittedBy: "gm",
      updatedAt: input.updatedAt,
    });
  }

  const nextSubstep: CombatRoundPhaseResolutionSubstep =
    currentSubstep === "attack" ? "parry" : currentSubstep === "parry" ? "damage" : "effects";
  const withStatus = setCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
    status: {
      substep: nextSubstep,
      updatedAt: input.updatedAt,
    },
  });

  return {
    ...withStatus,
    phaseResolutionCursor: {
      participantId: input.participantId,
      phase: input.phase,
      substep: nextSubstep,
    },
    selectedParticipantId: input.participantId,
    selectedStep:
      nextSubstep === "parry"
        ? getCombatRoundParryReviewStepForPhase(input.phase)
        : getCombatRoundDamageReviewStepForPhase(input.phase),
  };
}

export function completeCombatRoundPhaseResolutionForParticipant(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const withStatus = setCombatRoundPhaseResolutionStatus({
    participantId: input.participantId,
    phase: input.phase,
    state: input.state,
    status: {
      substep: "done",
      updatedAt: input.updatedAt,
    },
  });
  const hasPhaseAttack = combatRoundParticipantHasPhaseAttack({
    participantId: input.participantId,
    phase: input.phase,
    state: withStatus,
  });
  const attackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
    participantId: input.participantId,
    phase: input.phase,
    state: withStatus,
  });
  const withActionStepStatus = hasPhaseAttack
    ? withStatus
    : setCombatRoundParticipantStepStatus({
        participantId: input.participantId,
        state: withStatus,
        status: "skipped",
        step: getCombatRoundPhaseActionStepForPhase(input.phase),
      });
  const reviewParticipantId =
    hasPhaseAttack && attackResult?.hit
      ? attackResult.defenderParticipantId
      : input.participantId;
  const reviewStep =
    hasPhaseAttack && attackResult?.hit
      ? getCombatRoundDamageReviewStepForPhase(input.phase)
      : getCombatRoundParryReviewStepForPhase(input.phase);
  const withStepStatus =
    hasPhaseAttack && !attackResult?.hit
      ? withActionStepStatus
      : setCombatRoundParticipantStepStatus({
          participantId: reviewParticipantId,
          state: withActionStepStatus,
          status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
          step: reviewStep,
        });

  return moveCombatRoundPhaseResolutionCursorToNextParticipant({
    phase: input.phase,
    state: withStepStatus,
    updatedAt: input.updatedAt,
  });
}

export function getCombatRoundAttackResultId(input: {
  result: Pick<
    CombatRoundAttackRollResult,
    "attackerParticipantId" | "defenderParticipantId" | "phase"
  >;
  roundNumber: number;
}): string {
  return [
    input.roundNumber,
    input.result.phase,
    input.result.attackerParticipantId,
    input.result.defenderParticipantId,
  ].join(":");
}

export function buildCombatRoundPhaseResolutionResult(input: {
  attackResult: CombatRoundAttackRollResult;
  roundNumber: number;
  updatedAt: string;
}): CombatRoundPhaseResolutionResult {
  const attackResultId = getCombatRoundAttackResultId({
    result: input.attackResult,
    roundNumber: input.roundNumber,
  });

  return combatRoundPhaseResolutionResultSchema.parse({
    attackResultId,
    attackerParticipantId: input.attackResult.attackerParticipantId,
    damageProposal: {
      proposedEffects: [],
      status: "not_ready",
    },
    damageRoll: input.attackResult.hit
      ? {
          notes: "Awaiting parry resolution.",
          status: "pending",
        }
      : {
          status: "not_required",
        },
    defenderParticipantId: input.attackResult.defenderParticipantId,
    parryResolution: input.attackResult.hit
      ? {
          status: "pending",
        }
      : {
          resultLabel: "Attack missed",
          status: "not_applicable",
        },
    phase: input.attackResult.phase,
    roundNumber: input.roundNumber,
    updatedAt: input.updatedAt,
  });
}

export function getCombatRoundPhaseResolutionResultForAttack(input: {
  attackResult: CombatRoundAttackRollResult;
  state: CombatRoundState;
}): CombatRoundPhaseResolutionResult | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const attackResultId = getCombatRoundAttackResultId({
    result: input.attackResult,
    roundNumber: normalized.roundNumber,
  });

  return normalized.phaseResolutionResults.find(
    (resolution) => resolution.attackResultId === attackResultId,
  );
}

export function getCombatRoundDisplayPhaseResolutionResultForParticipantPhase(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt?: string;
}): CombatRoundPhaseResolutionResult | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const attackResult = getCombatRoundDisplayAttackResultForParticipantPhase({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  return (
    getCombatRoundPhaseResolutionResultForAttack({
      attackResult,
      state: normalized,
    }) ??
    buildCombatRoundPhaseResolutionResult({
      attackResult,
      roundNumber: normalized.roundNumber,
      updatedAt: input.updatedAt ?? attackResult.rolledAt,
    })
  );
}

function upsertCombatRoundPhaseResolutionResults(input: {
  results: CombatRoundPhaseResolutionResult[];
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const nextResults = input.results.map((result) =>
    combatRoundPhaseResolutionResultSchema.parse(result),
  );

  return {
    ...normalized,
    phaseResolutionResults: [
      ...normalized.phaseResolutionResults.filter(
        (existing) =>
          !nextResults.some((result) => result.attackResultId === existing.attackResultId),
      ),
      ...nextResults,
    ],
  };
}

export function ensureCombatRoundPhaseResolutionResultsForPhase(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const results = normalized.participants
    .map((participant) => participant.attackResults[input.phase])
    .filter((result): result is CombatRoundAttackRollResult => result !== undefined)
    .map((attackResult) => {
      const existing = getCombatRoundPhaseResolutionResultForAttack({
        attackResult,
        state: normalized,
      });

      return (
        existing ??
        buildCombatRoundPhaseResolutionResult({
          attackResult,
          roundNumber: normalized.roundNumber,
          updatedAt: input.updatedAt,
        })
      );
    });

  return upsertCombatRoundPhaseResolutionResults({
    results,
    state: normalized,
  });
}

export function recordCombatRoundParryResolution(input: {
  attackResult: CombatRoundAttackRollResult;
  parryResolution: CombatRoundParryResolution;
  state: CombatRoundState;
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const existing =
    getCombatRoundPhaseResolutionResultForAttack({
      attackResult: input.attackResult,
      state: normalized,
    }) ??
    buildCombatRoundPhaseResolutionResult({
      attackResult: input.attackResult,
      roundNumber: normalized.roundNumber,
      updatedAt: input.updatedAt,
    });
  const nextResult = combatRoundPhaseResolutionResultSchema.parse({
    ...existing,
    damageProposal: {
      proposedEffects: [],
      status: "not_ready",
    },
    damageRoll:
      input.attackResult.hit && input.parryResolution.success !== true
        ? {
            notes: "Parry resolved unsuccessfully. Damage roll is pending.",
            status: "pending",
          }
        : {
            notes: input.attackResult.hit ? "Parry resolved successfully. Damage is not required." : undefined,
            status: "not_required",
          },
    parryResolution: input.parryResolution,
    updatedAt: input.updatedAt,
  });

  return upsertCombatRoundPhaseResolutionResults({
    results: [nextResult],
    state: normalized,
  });
}

export function initializeCombatRoundState(input: {
  encounter: Pick<EncounterSession, "combatRoundState" | "currentRound" | "participants">;
}): CombatRoundState {
  const existing = input.encounter.combatRoundState
    ? combatRoundStateSchema.parse(input.encounter.combatRoundState)
    : undefined;
  const existingByParticipantId = new Map(
    existing?.participants.map((participant) => [participant.participantId, participant]) ?? [],
  );
  const participants = input.encounter.participants.map((participant) =>
    participantStateFromEncounterParticipant({
      existing: existingByParticipantId.get(participant.id),
      participant,
    }),
  );
  const participantIds = new Set(participants.map((participant) => participant.participantId));
  const currentStep = existing?.currentStep ?? "select_actions";
  const resetsStaleDeclarationSelection =
    currentStep === "select_actions" &&
    existing?.selectedStep !== undefined &&
    existing.selectedStep !== "select_actions";
  const selectedParticipantId =
    !resetsStaleDeclarationSelection &&
    existing?.selectedParticipantId &&
    participantIds.has(existing.selectedParticipantId)
      ? existing.selectedParticipantId
      : participants[0]?.participantId;
  const activeParticipantId =
    existing?.activeParticipantId && participantIds.has(existing.activeParticipantId)
      ? existing.activeParticipantId
      : undefined;

  return {
    activeParticipantId,
    currentStep,
    phaseResolutionCursor:
      currentStep === "select_actions" ? undefined : existing?.phaseResolutionCursor,
    phaseResolutionResults: existing?.phaseResolutionResults ?? [],
    phaseResolutionStatuses: existing?.phaseResolutionStatuses ?? {},
    participants,
    roundNumber: existing?.roundNumber ?? input.encounter.currentRound,
    selectedParticipantId,
    selectedStep: resetsStaleDeclarationSelection
      ? "select_actions"
      : (existing?.selectedStep ?? currentStep),
    stepSnapshots: existing?.stepSnapshots ?? [],
  };
}

export function getNextCombatRoundStep(step: CombatRoundStep): CombatRoundStep {
  const currentIndex = COMBAT_ROUND_STEPS.indexOf(step);

  return COMBAT_ROUND_STEPS[currentIndex + 1] ?? "select_actions";
}

export function getPreviousCombatRoundStep(step: CombatRoundStep): CombatRoundStep | undefined {
  const currentIndex = COMBAT_ROUND_STEPS.indexOf(step);

  return currentIndex > 0 ? COMBAT_ROUND_STEPS[currentIndex - 1] : undefined;
}

export function upsertCombatRoundStepSnapshots(input: {
  snapshots: CombatRoundStepSnapshot[];
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const nextSnapshots = input.snapshots.map((snapshot) =>
    combatRoundStepSnapshotSchema.parse(snapshot),
  );

  return {
    ...normalized,
    stepSnapshots: [
      ...normalized.stepSnapshots.filter(
        (existingSnapshot) =>
          !nextSnapshots.some((snapshot) =>
            isSameCombatRoundStepSnapshot(existingSnapshot, snapshot),
          ),
      ),
      ...nextSnapshots,
    ],
  };
}

export function getCombatRoundStepSnapshot(input: {
  participantId?: string;
  roundNumber?: number;
  state: CombatRoundState;
  step?: CombatRoundStep;
}): CombatRoundStepSnapshot | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participantId = input.participantId ?? normalized.selectedParticipantId;
  const roundNumber = input.roundNumber ?? normalized.roundNumber;
  const step = input.step ?? normalized.selectedStep ?? normalized.currentStep;

  if (!participantId) {
    return undefined;
  }

  return normalized.stepSnapshots.find((snapshot) =>
    isSameCombatRoundStepSnapshot(snapshot, {
      participantId,
      roundNumber,
      step,
    }),
  );
}

export function advanceCombatRoundStep(
  state: CombatRoundState,
  input: { stepSnapshots?: CombatRoundStepSnapshot[] } = {},
): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(state);
  const withSnapshots = input.stepSnapshots
    ? upsertCombatRoundStepSnapshots({
        snapshots: input.stepSnapshots,
        state: normalized,
      })
    : normalized;
  const nextStep = getNextCombatRoundStep(normalized.currentStep);
  const startsNextRound = normalized.currentStep === "round_summary";
  const advancesDeclarationStep = normalized.currentStep === "select_actions";
  const startsPhaseResolution =
    nextStep === "phase_1_actions" ? "phase1" : nextStep === "phase_2_actions" ? "phase2" : undefined;
  const baseState: CombatRoundState = {
    ...withSnapshots,
    activeParticipantId: startsNextRound ? undefined : withSnapshots.activeParticipantId,
    currentStep: nextStep,
    phaseResolutionCursor: startsNextRound ? undefined : withSnapshots.phaseResolutionCursor,
    phaseResolutionResults: startsNextRound ? [] : withSnapshots.phaseResolutionResults,
    phaseResolutionStatuses: startsNextRound ? {} : withSnapshots.phaseResolutionStatuses,
    participants: withSnapshots.participants.map((participant) => ({
      ...participant,
      attackResults: startsNextRound ? {} : participant.attackResults,
      declaration: startsNextRound ? undefined : participant.declaration,
      initiatives: startsNextRound ? {} : participant.initiatives,
      stepStatuses: startsNextRound
        ? buildDefaultStepStatuses()
        : {
            ...participant.stepStatuses,
            [normalized.currentStep]: advancesDeclarationStep
              ? participant.stepStatuses.select_actions === "submitted" ||
                participant.stepStatuses.select_actions === "gmEdited"
                ? participant.stepStatuses.select_actions
                : "locked"
              : "complete",
          },
    })),
    roundNumber: startsNextRound ? withSnapshots.roundNumber + 1 : withSnapshots.roundNumber,
    selectedParticipantId: startsNextRound
      ? withSnapshots.participants[0]?.participantId
      : withSnapshots.selectedParticipantId,
    selectedStep: nextStep,
  };

  return startsPhaseResolution
    ? initializeCombatRoundPhaseResolutionCursor({
        phase: startsPhaseResolution,
        state: baseState,
      })
    : baseState;
}

export function recordCombatRoundDeclaration(input: {
  declaration?: Omit<CombatRoundDeclaration, "submittedBy">;
  participantId: string;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
}): CombatRoundState {
  const withoutStaleResolution = clearCombatRoundParticipantOutgoingResolutionState({
    participantId: input.participantId,
    state: input.state,
  });
  const withStatus = setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: withoutStaleResolution,
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: "select_actions",
  });

  if (!input.declaration) {
    return withStatus;
  }

  const normalized = combatRoundStateSchema.parse(withStatus);
  const declaration = combatRoundDeclarationSchema.parse({
    ...input.declaration,
    submittedBy: input.submittedBy,
  });

  return {
    ...normalized,
    participants: normalized.participants.map((participant) =>
      participant.participantId === input.participantId
        ? {
            ...participant,
            declaration,
          }
        : participant,
    ),
  };
}

export function getCombatRoundInitiativePhaseForStep(
  step: CombatRoundStep,
): "phase1" | "phase2" | undefined {
  if (
    step === "initiative_phase_1" ||
    step === "phase_1_actions" ||
    step === "review_phase_2_actions" ||
    step === "phase_1_damage"
  ) {
    return "phase1";
  }

  if (
    step === "initiative_phase_2" ||
    step === "phase_2_actions" ||
    step === "review_phase_2_damage" ||
    step === "phase_2_damage"
  ) {
    return "phase2";
  }

  return undefined;
}

export function getCombatRoundModifierPhaseForStep(
  step: CombatRoundStep,
): "phase1" | "phase2" | undefined {
  if (
    step === "review_action_modifiers" ||
    step === "initiative_phase_1" ||
    step === "phase_1_actions" ||
    step === "review_phase_2_actions" ||
    step === "phase_1_damage"
  ) {
    return "phase1";
  }

  if (
    step === "review_phase_2_modifiers" ||
    step === "initiative_phase_2" ||
    step === "phase_2_actions" ||
    step === "review_phase_2_damage" ||
    step === "phase_2_damage"
  ) {
    return "phase2";
  }

  return undefined;
}

export function recordCombatRoundInitiative(input: {
  initiative: CombatRoundInitiativeResult | number;
  participantId: string;
  phase: "phase1" | "phase2";
  state: CombatRoundState;
  submittedBy: "gm" | "player";
}): CombatRoundState {
  const initiativeStep = input.phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2";
  const withInitiative = setCombatRoundParticipantInitiative({
    initiative: input.initiative,
    participantId: input.participantId,
    phase: input.phase,
    state: input.state,
  });

  return setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: withInitiative,
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: initiativeStep,
  });
}

export function recordCombatRoundAttackResult(input: {
  participantId: string;
  result: CombatRoundAttackRollResult;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
}): CombatRoundState {
  const attackStep = input.result.phase === "phase1" ? "phase_1_actions" : "phase_2_actions";
  const normalized = combatRoundStateSchema.parse(input.state);
  const withResult: CombatRoundState = {
    ...normalized,
    participants: normalized.participants.map((participant) =>
      participant.participantId === input.participantId
        ? {
            ...participant,
            attackResults: {
              ...participant.attackResults,
              [input.result.phase]: input.result,
            },
          }
        : participant,
    ),
  };

  return setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: recordCombatRoundPhaseResolutionAttackDone({
      attackResult: input.result,
      state: withResult,
      updatedAt: input.result.rolledAt,
    }),
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: attackStep,
  });
}

export function recordCombatRoundParticipantStepReview(input: {
  participantId: string;
  state: CombatRoundState;
  step: CombatRoundStep;
  submittedBy: "gm" | "player";
}): CombatRoundState {
  return setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: input.state,
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: input.step,
  });
}

function resetCombatRoundParryForAttackResult(input: {
  attackResult: CombatRoundAttackRollResult;
  resolution: CombatRoundPhaseResolutionResult;
  updatedAt: string;
}): CombatRoundPhaseResolutionResult {
  return combatRoundPhaseResolutionResultSchema.parse({
    ...input.resolution,
    damageProposal: {
      proposedEffects: [],
      status: "not_ready",
    },
    damageRoll: input.attackResult.hit
      ? {
          notes: "Awaiting parry resolution.",
          status: "pending",
        }
      : {
          status: "not_required",
        },
    parryResolution: input.attackResult.hit
      ? {
          status: "pending",
        }
      : {
          resultLabel: "Attack missed",
          status: "not_applicable",
        },
    updatedAt: input.updatedAt,
  });
}

function resetCombatRoundDamageForAttackResult(input: {
  attackResult: CombatRoundAttackRollResult;
  resolution: CombatRoundPhaseResolutionResult;
  updatedAt: string;
}): CombatRoundPhaseResolutionResult {
  return combatRoundPhaseResolutionResultSchema.parse({
    ...input.resolution,
    damageProposal: {
      proposedEffects: [],
      status: "not_ready",
    },
    damageRoll:
      input.attackResult.hit && input.resolution.parryResolution.success !== true
        ? {
            notes:
              input.resolution.parryResolution.status === "resolved"
                ? "Parry resolved unsuccessfully. Damage roll is pending."
                : "Awaiting parry resolution.",
            status: "pending",
          }
        : {
            notes: input.attackResult.hit
              ? "Parry resolved successfully. Damage is not required."
              : undefined,
            status: "not_required",
          },
    updatedAt: input.updatedAt,
  });
}

export function clearCombatRoundStep(input: {
  state: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundState {
  const parsed = combatRoundStateSchema.parse(input.state);
  const declarationClearParticipantId =
    input.step === "select_actions" &&
    parsed.selectedParticipantId &&
    parsed.participants.some(
      (participant) => participant.participantId === parsed.selectedParticipantId,
    )
      ? parsed.selectedParticipantId
      : undefined;
  const normalized = declarationClearParticipantId
    ? clearCombatRoundParticipantOutgoingResolutionState({
        participantId: declarationClearParticipantId,
        state: parsed,
      })
    : parsed;
  const clearsPhaseAction =
    input.step === "phase_1_actions" || input.step === "phase_2_actions";
  const clearsParryReview =
    input.step === "review_phase_2_actions" || input.step === "review_phase_2_damage";
  const clearResolutionPhase =
    input.step === "phase_1_actions" ||
    input.step === "review_phase_2_actions" ||
    input.step === "phase_1_damage"
      ? "phase1"
      : input.step === "phase_2_actions" ||
          input.step === "review_phase_2_damage" ||
          input.step === "phase_2_damage"
        ? "phase2"
        : undefined;
  const clearsDamageReview =
    input.step === "phase_1_damage" || input.step === "phase_2_damage";
  const selectedParticipantForClear = clearResolutionPhase
    ? normalized.selectedParticipantId &&
      normalized.participants.some(
        (participant) => participant.participantId === normalized.selectedParticipantId,
      )
      ? normalized.selectedParticipantId
      : normalized.phaseResolutionCursor?.phase === clearResolutionPhase
        ? normalized.phaseResolutionCursor.participantId
        : undefined
    : undefined;
  const selectedOutgoingAttackResult =
    clearResolutionPhase && selectedParticipantForClear
      ? getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: selectedParticipantForClear,
          phase: clearResolutionPhase,
          state: normalized,
        })
      : undefined;
  const selectedIncomingAttackResult =
    clearResolutionPhase && selectedParticipantForClear
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: selectedParticipantForClear,
          phase: clearResolutionPhase,
          state: normalized,
        })
      : undefined;
  const selectedAttackResultForClear = clearsPhaseAction
    ? selectedOutgoingAttackResult ?? selectedIncomingAttackResult
    : selectedIncomingAttackResult;
  const selectedAttackResultId = selectedAttackResultForClear
    ? getCombatRoundAttackResultId({
        result: selectedAttackResultForClear,
        roundNumber: normalized.roundNumber,
      })
    : undefined;
  const nextPhaseResolutionStatuses = clearResolutionPhase
    ? Object.fromEntries(
        Object.entries(normalized.phaseResolutionStatuses).map(([participantId, statuses]) => {
          const clearsOwnerStatus =
            selectedAttackResultForClear?.attackerParticipantId === participantId;
          const nextStatus =
            clearsOwnerStatus && clearsPhaseAction
              ? undefined
              : clearsOwnerStatus && clearsParryReview && selectedAttackResultForClear
                ? {
                    substep: getCombatRoundPostAttackResolutionSubstep(
                      selectedAttackResultForClear,
                    ),
                    updatedAt: selectedAttackResultForClear.rolledAt,
                  }
                : clearsOwnerStatus && clearsDamageReview && selectedAttackResultForClear
                  ? {
                      substep: "damage" as const,
                      updatedAt: selectedAttackResultForClear.rolledAt,
                    }
                  : statuses[clearResolutionPhase];

          return [
            participantId,
            {
              ...statuses,
              [clearResolutionPhase]: nextStatus,
            },
          ];
        }),
      )
    : normalized.phaseResolutionStatuses;
  const nextCursorParticipant =
    clearResolutionPhase && clearsPhaseAction
      ? selectedAttackResultForClear?.attackerParticipantId ??
        selectedParticipantForClear ??
        getCombatRoundPhaseResolutionOrder({
          phase: clearResolutionPhase,
          state: normalized,
        })[0]
      : clearResolutionPhase && (clearsParryReview || clearsDamageReview)
        ? selectedParticipantForClear
        : undefined;
  const nextCursorSubstep =
    clearResolutionPhase && nextCursorParticipant
      ? clearsParryReview && selectedAttackResultForClear
        ? getCombatRoundPostAttackResolutionSubstep(selectedAttackResultForClear)
        : clearsDamageReview
          ? "damage"
          : selectedAttackResultForClear && clearsPhaseAction
            ? getCombatRoundInitialPhaseResolutionSubstep({
                participantId: selectedAttackResultForClear.attackerParticipantId,
                phase: clearResolutionPhase,
                state: normalized,
              })
        : getCombatRoundInitialPhaseResolutionSubstep({
            participantId: nextCursorParticipant,
            phase: clearResolutionPhase,
            state: normalized,
          })
      : undefined;

  return {
    ...normalized,
    phaseResolutionCursor:
      clearResolutionPhase && nextCursorParticipant && nextCursorSubstep
        ? {
            participantId: nextCursorParticipant,
            phase: clearResolutionPhase,
            substep: nextCursorSubstep,
          }
        : clearResolutionPhase && normalized.phaseResolutionCursor?.phase === clearResolutionPhase
          ? undefined
          : normalized.phaseResolutionCursor,
    phaseResolutionResults: clearResolutionPhase
      ? normalized.phaseResolutionResults
          .filter((result) => {
            if (
              result.roundNumber !== normalized.roundNumber ||
              result.phase !== clearResolutionPhase
            ) {
              return true;
            }

            return !(clearsPhaseAction && result.attackResultId === selectedAttackResultId);
          })
          .map((result) => {
            if (result.attackResultId !== selectedAttackResultId || !selectedAttackResultForClear) {
              return result;
            }

            if (clearsParryReview) {
              return resetCombatRoundParryForAttackResult({
                attackResult: selectedAttackResultForClear,
                resolution: result,
                updatedAt: selectedAttackResultForClear.rolledAt,
              });
            }

            if (clearsDamageReview) {
              return resetCombatRoundDamageForAttackResult({
                attackResult: selectedAttackResultForClear,
                resolution: result,
                updatedAt: selectedAttackResultForClear.rolledAt,
              });
            }

            return result;
          })
      : normalized.phaseResolutionResults,
    phaseResolutionStatuses: nextPhaseResolutionStatuses,
    participants: normalized.participants.map((participant) => {
      const nextAttackResults = { ...participant.attackResults };
      const nextInitiatives = { ...participant.initiatives };

      if (
        input.step === "phase_1_actions" &&
        participant.participantId === selectedAttackResultForClear?.attackerParticipantId
      ) {
        delete nextAttackResults.phase1;
      }

      if (
        input.step === "phase_2_actions" &&
        participant.participantId === selectedAttackResultForClear?.attackerParticipantId
      ) {
        delete nextAttackResults.phase2;
      }

      if (input.step === "initiative_phase_1") {
        delete nextInitiatives.phase1;
      }

      if (input.step === "initiative_phase_2") {
        delete nextInitiatives.phase2;
      }

      const resetsSelectedStep =
        !clearResolutionPhase ||
        participant.participantId === selectedParticipantForClear ||
        (clearsPhaseAction &&
          participant.participantId === selectedAttackResultForClear?.attackerParticipantId);
      const resetsDownstreamReview =
        clearsPhaseAction &&
        participant.participantId === selectedAttackResultForClear?.defenderParticipantId;

      return {
        ...participant,
        attackResults: nextAttackResults,
        declaration: input.step === "select_actions" ? undefined : participant.declaration,
        initiatives: nextInitiatives,
        stepStatuses:
          resetsSelectedStep || resetsDownstreamReview
            ? {
                ...participant.stepStatuses,
                ...(resetsSelectedStep ? { [input.step]: "pending" as const } : {}),
                ...(input.step === "phase_1_actions" && resetsDownstreamReview
                  ? {
                      phase_1_damage: "pending" as const,
                      review_phase_2_actions: "pending" as const,
                    }
                  : {}),
                ...(input.step === "review_phase_2_actions" && resetsSelectedStep
                  ? {
                      phase_1_damage: "pending" as const,
                    }
                  : {}),
                ...(input.step === "phase_2_actions" && resetsDownstreamReview
                  ? {
                      phase_2_damage: "pending" as const,
                      review_phase_2_damage: "pending" as const,
                    }
                  : {}),
                ...(input.step === "review_phase_2_damage" && resetsSelectedStep
                  ? {
                      phase_2_damage: "pending" as const,
                    }
                  : {}),
              }
            : participant.stepStatuses,
      };
    }),
    selectedParticipantId: nextCursorParticipant ?? normalized.selectedParticipantId,
    selectedStep:
      clearResolutionPhase && nextCursorParticipant
        ? clearsPhaseAction
          ? getCombatRoundPhaseActionStepForPhase(clearResolutionPhase)
          : clearsParryReview
            ? getCombatRoundParryReviewStepForPhase(clearResolutionPhase)
          : getCombatRoundDamageReviewStepForPhase(clearResolutionPhase)
        : normalized.selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId: normalized.selectedParticipantId,
      roundNumber: normalized.roundNumber,
      selectedAttackResult: selectedAttackResultForClear,
      snapshots: normalized.stepSnapshots,
      step: input.step,
    }),
  };
}

export function clearCurrentCombatRoundStepAndRewind(state: CombatRoundState): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(state);
  const clearedState = clearCombatRoundStep({
    state: normalized,
    step: normalized.currentStep,
  });
  const previousStep = getPreviousCombatRoundStep(normalized.currentStep);
  const nextStep = previousStep ?? normalized.currentStep;

  return {
    ...clearedState,
    currentStep: nextStep,
    selectedStep: nextStep,
  };
}

export function canPlayerSubmitCombatDeclaration(input: {
  participantId: string;
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const declarationStatus = participant?.stepStatuses.select_actions ?? "pending";

  return normalized.currentStep === "select_actions" && declarationStatus === "pending";
}

export function canPlayerRollCombatInitiative(input: {
  participantId: string;
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const requiredStep = input.phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2";
  const participant = normalized.participants.find(
    (entry) => entry.participantId === input.participantId,
  );
  const initiativeValue = participant?.initiatives[input.phase];
  const stepStatus = participant?.stepStatuses[requiredStep] ?? "pending";

  return (
    normalized.currentStep === requiredStep &&
    initiativeValue === undefined &&
    stepStatus === "pending"
  );
}

export function setCombatRoundActiveParticipant(
  state: CombatRoundState,
  participantId?: string,
): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(state);
  const hasParticipant = normalized.participants.some(
    (participant) => participant.participantId === participantId,
  );

  return {
    ...normalized,
    activeParticipantId: hasParticipant ? participantId : undefined,
    selectedParticipantId: hasParticipant ? participantId : normalized.selectedParticipantId,
  };
}

export function setCombatRoundSelection(input: {
  participantId?: string;
  state: CombatRoundState;
  step?: CombatRoundStep;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const hasParticipant = normalized.participants.some(
    (participant) => participant.participantId === input.participantId,
  );

  return {
    ...normalized,
    selectedParticipantId: hasParticipant ? input.participantId : normalized.selectedParticipantId,
    selectedStep: input.step ?? normalized.selectedStep,
  };
}

export function setCombatRoundParticipantInitiative(input: {
  initiative?: CombatRoundInitiativeResult | number;
  participantId: string;
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const initiative = normalizeCombatRoundInitiativeResult(input.initiative);

  return {
    ...normalized,
    participants: normalized.participants.map((participant) =>
      participant.participantId === input.participantId
        ? {
            ...participant,
            initiatives: {
              ...participant.initiatives,
              [input.phase]: initiative,
            },
          }
        : participant,
    ),
  };
}

export function setCombatRoundParticipantStepStatus(input: {
  participantId: string;
  state: CombatRoundState;
  status: CombatRoundStepStatus;
  step: CombatRoundStep;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);

  return {
    ...normalized,
    participants: normalized.participants.map((participant) =>
      participant.participantId === input.participantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [input.step]: input.status,
            },
          }
        : participant,
    ),
  };
}

export function sortCombatRoundParticipantsByInitiative(input: {
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): CombatRoundParticipantState[] {
  const normalized = combatRoundStateSchema.parse(input.state);
  const originalIndexByParticipantId = new Map(
    normalized.participants.map((participant, index) => [participant.participantId, index]),
  );

  return [...normalized.participants].sort((left, right) => {
    const leftInitiative = getCombatRoundInitiativeTotal(left.initiatives[input.phase]);
    const rightInitiative = getCombatRoundInitiativeTotal(right.initiatives[input.phase]);

    if (leftInitiative !== undefined && rightInitiative !== undefined) {
      return (
        rightInitiative - leftInitiative ||
        (originalIndexByParticipantId.get(left.participantId) ?? 0) -
          (originalIndexByParticipantId.get(right.participantId) ?? 0)
      );
    }

    if (leftInitiative !== undefined) {
      return -1;
    }

    if (rightInitiative !== undefined) {
      return 1;
    }

    return (
      (originalIndexByParticipantId.get(left.participantId) ?? 0) -
      (originalIndexByParticipantId.get(right.participantId) ?? 0)
    );
  });
}

export function getCombatRoundInitiativePositions(input: {
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): Record<string, number> {
  const ranks = getCombatRoundInitiativeRanks(input);

  return Object.fromEntries(
    Object.entries(ranks).map(([participantId, rank]) => [participantId, rank.rank]),
  );
}

export function getCombatRoundInitiativeRanks(input: {
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): Record<string, CombatRoundInitiativeRank> {
  const sortedParticipants = sortCombatRoundParticipantsByInitiative(input);
  const rolledParticipants = sortedParticipants
    .map((participant) => ({
      participant,
      total: getCombatRoundInitiativeTotal(participant.initiatives[input.phase]),
    }))
    .filter(
      (entry): entry is { participant: CombatRoundParticipantState; total: number } =>
        entry.total !== undefined,
    );
  const tiedCountsByTotal = rolledParticipants.reduce((counts, entry) => {
    counts.set(entry.total, (counts.get(entry.total) ?? 0) + 1);

    return counts;
  }, new Map<number, number>());
  const ranks: Record<string, CombatRoundInitiativeRank> = {};
  let currentRank = 0;
  let previousTotal: number | undefined;

  rolledParticipants.forEach((entry, index) => {
    if (entry.total !== previousTotal) {
      currentRank = index + 1;
      previousTotal = entry.total;
    }

    ranks[entry.participant.participantId] = {
      rank: currentRank,
      rankTotal: rolledParticipants.length,
      tiedCount: tiedCountsByTotal.get(entry.total) ?? 1,
    };
  });

  return ranks;
}

export function buildCombatRoundInspector(input: {
  participantId?: string;
  state: CombatRoundState;
  step?: CombatRoundStep;
}): {
  participant?: CombatRoundParticipantState;
  snapshot?: CombatRoundStepSnapshot;
  status?: CombatRoundStepStatus;
  step: CombatRoundStep;
} {
  const normalized = combatRoundStateSchema.parse(input.state);
  const step = input.step ?? normalized.selectedStep ?? normalized.currentStep;
  const participant =
    normalized.participants.find((entry) => entry.participantId === input.participantId) ??
    normalized.participants.find(
      (entry) => entry.participantId === normalized.selectedParticipantId,
    ) ??
    normalized.participants[0];

  return {
    participant,
    snapshot: participant
      ? getCombatRoundStepSnapshot({
          participantId: participant.participantId,
          roundNumber: normalized.roundNumber,
          state: normalized,
          step,
        })
      : undefined,
    status: participant?.stepStatuses[step],
    step,
  };
}
