import { z } from "zod";

import {
  scenarioCombatModifierBucketSchema,
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
} from "../campaign/scenario";
import { resolveCombatToHit } from "./toHitTable";
import type { EncounterParticipant, EncounterSession } from "./session";

const idSchema = z.string().min(1);

export const combatRoundStepSchema = z.enum([
  "select_actions",
  "review_action_modifiers",
  "initiative_phase_1",
  "phase_1_actions",
  "review_phase_2_actions",
  "review_phase_2_modifiers",
  "initiative_phase_2",
  "phase_2_actions",
  "review_phase_2_damage",
  "round_summary",
]);

export const COMBAT_ROUND_STEPS = combatRoundStepSchema.options;
export type CombatRoundStep = z.infer<typeof combatRoundStepSchema>;

export const COMBAT_ROUND_STEP_ABBREVIATIONS = {
  initiative_phase_1: "i1",
  initiative_phase_2: "i2",
  phase_1_actions: "P1",
  phase_2_actions: "P2",
  review_action_modifiers: "M1",
  review_phase_2_actions: "D1",
  review_phase_2_damage: "D2",
  review_phase_2_modifiers: "M2",
  round_summary: "SU",
  select_actions: "DE",
} satisfies Record<CombatRoundStep, string>;

export const COMBAT_ROUND_STEP_LABELS = {
  initiative_phase_1: "Initiative phase 1",
  initiative_phase_2: "Initiative phase 2",
  phase_1_actions: "Phase 1 actions",
  phase_2_actions: "Phase 2 actions",
  review_action_modifiers: "Review phase 1 modifiers",
  review_phase_2_actions: "Phase 1 damage/effects review",
  review_phase_2_damage: "Phase 2 damage/effects review",
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
  parryResolution: z
    .object({
      notes: z.string().optional(),
      resultLabel: z.string().min(1).optional(),
      status: z.enum(["pending", "not_applicable", "resolved"]),
    })
    .default({ status: "pending" }),
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
  phaseResolutionResult: combatRoundPhaseResolutionResultSchema.optional(),
  roundNumber: z.number().int().positive(),
  step: combatRoundStepSchema,
});

export const combatRoundStateSchema = z.object({
  activeParticipantId: idSchema.optional(),
  currentStep: combatRoundStepSchema.default("select_actions"),
  phaseResolutionResults: z.array(combatRoundPhaseResolutionResultSchema).default([]),
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
export type CombatRoundPhaseResolutionResult = z.infer<
  typeof combatRoundPhaseResolutionResultSchema
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
  roundNumber: number;
  snapshots: CombatRoundStepSnapshot[];
  step: CombatRoundStep;
}): CombatRoundStepSnapshot[] {
  const clearFromIndex = getStepIndex(input.step);

  return input.snapshots.filter((snapshot) => {
    if (snapshot.roundNumber !== input.roundNumber) {
      return true;
    }

    return getStepIndex(snapshot.step) < clearFromIndex;
  });
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
  if (step === "review_phase_2_actions") {
    return "phase1";
  }

  if (step === "review_phase_2_damage") {
    return "phase2";
  }

  return undefined;
}

export function getCombatRoundDamageReviewStepForPhase(phase: CombatRoundPhase): CombatRoundStep {
  return phase === "phase1" ? "review_phase_2_actions" : "review_phase_2_damage";
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
  const selectedParticipantId =
    existing?.selectedParticipantId && participantIds.has(existing.selectedParticipantId)
      ? existing.selectedParticipantId
      : participants[0]?.participantId;
  const activeParticipantId =
    existing?.activeParticipantId && participantIds.has(existing.activeParticipantId)
      ? existing.activeParticipantId
      : undefined;

  return {
    activeParticipantId,
    currentStep: existing?.currentStep ?? "select_actions",
    phaseResolutionResults: existing?.phaseResolutionResults ?? [],
    participants,
    roundNumber: existing?.roundNumber ?? input.encounter.currentRound,
    selectedParticipantId,
    selectedStep: existing?.selectedStep ?? existing?.currentStep ?? "select_actions",
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

  return {
    ...withSnapshots,
    activeParticipantId: startsNextRound ? undefined : withSnapshots.activeParticipantId,
    currentStep: nextStep,
    participants: withSnapshots.participants.map((participant) => ({
      ...participant,
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
    selectedStep: nextStep,
  };
}

export function recordCombatRoundDeclaration(input: {
  declaration?: Omit<CombatRoundDeclaration, "submittedBy">;
  participantId: string;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
}): CombatRoundState {
  const withStatus = setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: input.state,
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
    step === "review_phase_2_actions"
  ) {
    return "phase1";
  }

  if (
    step === "initiative_phase_2" ||
    step === "phase_2_actions" ||
    step === "review_phase_2_damage"
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
    step === "review_phase_2_actions"
  ) {
    return "phase1";
  }

  if (
    step === "review_phase_2_modifiers" ||
    step === "initiative_phase_2" ||
    step === "phase_2_actions" ||
    step === "review_phase_2_damage"
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
    state: withResult,
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

export function clearCombatRoundStep(input: {
  state: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const clearResolutionPhase =
    input.step === "phase_1_actions" || input.step === "review_phase_2_actions"
      ? "phase1"
      : input.step === "phase_2_actions" || input.step === "review_phase_2_damage"
        ? "phase2"
        : undefined;

  return {
    ...normalized,
    phaseResolutionResults: clearResolutionPhase
      ? normalized.phaseResolutionResults.filter(
          (result) =>
            result.roundNumber !== normalized.roundNumber || result.phase !== clearResolutionPhase,
        )
      : normalized.phaseResolutionResults,
    participants: normalized.participants.map((participant) => {
      const nextAttackResults = { ...participant.attackResults };
      const nextInitiatives = { ...participant.initiatives };

      if (input.step === "phase_1_actions") {
        delete nextAttackResults.phase1;
      }

      if (input.step === "phase_2_actions") {
        delete nextAttackResults.phase2;
      }

      if (input.step === "initiative_phase_1") {
        delete nextInitiatives.phase1;
      }

      if (input.step === "initiative_phase_2") {
        delete nextInitiatives.phase2;
      }

      return {
        ...participant,
        attackResults: nextAttackResults,
        declaration: input.step === "select_actions" ? undefined : participant.declaration,
        initiatives: nextInitiatives,
        stepStatuses: {
          ...participant.stepStatuses,
          [input.step]: "pending",
        },
      };
    }),
    stepSnapshots: clearSnapshotsFromStep({
      roundNumber: normalized.roundNumber,
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
