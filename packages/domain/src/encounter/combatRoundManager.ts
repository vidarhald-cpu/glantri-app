import { z } from "zod";

import {
  scenarioCombatModifierBucketSchema,
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
} from "../campaign/scenario";
import { getCombatDeclarationAttackPhases } from "./combatDeclarationValidation";
import { lookupCombatToHitDamageMetadata, resolveCombatToHit } from "./toHitTable";
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

export const combatRoundCursorStepSchema = z.enum([
  "DE",
  "M1",
  "i1",
  "A1",
  "P1",
  "D1",
  "M2",
  "i2",
  "A2",
  "P2",
  "D2",
  "SU",
]);
export type CombatRoundCursorStep = z.infer<typeof combatRoundCursorStepSchema>;

export const combatRoundCursorSchema = z.object({
  participantId: idSchema.optional(),
  roundNumber: z.number().int().positive(),
  step: combatRoundCursorStepSchema,
});
export type CombatRoundCursor = z.infer<typeof combatRoundCursorSchema>;

export const combatRoundPhaseSchema = z.enum(["phase1", "phase2"]);
export type CombatRoundPhase = z.infer<typeof combatRoundPhaseSchema>;

export const combatRoundCommandTypeSchema = z.enum([
  "declare_action",
  "review_modifiers_phase1",
  "roll_initiative_phase1",
  "review_modifiers_phase2",
  "roll_initiative_phase2",
  "roll_attack",
  "roll_parry",
  "skip_phase_action",
  "complete_damage_review_phase1",
  "complete_damage_review_phase2",
  "resolve_damage",
]);
export type CombatRoundCommandType = z.infer<typeof combatRoundCommandTypeSchema>;

export const combatRoundCommandSchema = z.object({
  afterCursor: combatRoundCursorSchema,
  beforeCursor: combatRoundCursorSchema,
  createdAt: z.string().datetime(),
  createdByUserId: idSchema.optional(),
  facts: z.record(z.string(), z.unknown()).default({}),
  id: idSchema,
  participantId: idSchema,
  phase: combatRoundPhaseSchema.optional(),
  roundNumber: z.number().int().positive(),
  step: combatRoundCursorStepSchema.optional(),
  type: combatRoundCommandTypeSchema,
});
export type CombatRoundCommand = z.infer<typeof combatRoundCommandSchema>;

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

export const combatRoundAttackRollResultSchema = z
  .object({
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
  })
  .superRefine((result, context) => {
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
  })
  .transform((result) => {
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

export const combatRoundDamageResultSchema = z.object({
  armorModifier: z.number().int().optional(),
  attackResultId: idSchema,
  attackerParticipantId: idSchema,
  createdAt: z.string().datetime(),
  createdByUserId: idSchema.optional(),
  criticalGrade: z.string().min(1).optional(),
  damageRoll: z
    .object({
      diceExpression: z.string().min(1).optional(),
      required: z.boolean(),
      rolls: z.array(z.number().int()).optional(),
      total: z.number().int().optional(),
    })
    .default({ required: false }),
  defenderDm: z.number().int(),
  defenderParticipantId: idSchema,
  dmb: z.number().int(),
  grazing: z.boolean(),
  kind: z.literal("damage_result"),
  lookupTotal: z.number().int(),
  minDamage: z.number().int().optional(),
  parryResultId: idSchema.optional(),
  phase: combatRoundPhaseSchema,
  tableDamageModifier: z.number().int(),
  totalDamage: z.number().int(),
  weaponName: z.string().min(1).optional(),
});
export type CombatRoundDamageResult = z.infer<typeof combatRoundDamageResultSchema>;

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
  damageResult: combatRoundDamageResultSchema.optional(),
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
  commands: z.array(combatRoundCommandSchema).default([]),
  currentCursor: combatRoundCursorSchema.optional(),
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

export function getCombatRoundCursorStepForStep(step: CombatRoundStep): CombatRoundCursorStep {
  return combatRoundCursorStepSchema.parse(COMBAT_ROUND_STEP_ABBREVIATIONS[step]);
}

export function getCombatRoundStepForCursorStep(step: CombatRoundCursorStep): CombatRoundStep {
  const entry = COMBAT_ROUND_STEPS.find(
    (candidate) => COMBAT_ROUND_STEP_ABBREVIATIONS[candidate] === step,
  );

  if (!entry) {
    throw new RangeError(`Unsupported combat round cursor step: ${step}`);
  }

  return entry;
}

export function isGlobalCombatRoundCursorStep(step: CombatRoundCursorStep): boolean {
  return step === "DE" || step === "M1" || step === "i1" || step === "M2" || step === "i2";
}

function isGlobalCombatRoundStep(step: CombatRoundStep): boolean {
  return (
    step === "select_actions" ||
    step === "review_action_modifiers" ||
    step === "initiative_phase_1" ||
    step === "review_phase_2_modifiers" ||
    step === "initiative_phase_2"
  );
}

function getCombatRoundGlobalCommandTypeForStep(
  step: CombatRoundStep,
): CombatRoundCommandType | undefined {
  switch (step) {
    case "select_actions":
      return "declare_action";
    case "review_action_modifiers":
      return "review_modifiers_phase1";
    case "initiative_phase_1":
      return "roll_initiative_phase1";
    case "review_phase_2_modifiers":
      return "review_modifiers_phase2";
    case "initiative_phase_2":
      return "roll_initiative_phase2";
    default:
      return undefined;
  }
}

function getNextCombatRoundGlobalParticipantId(input: {
  participantId: string;
  state: CombatRoundState;
}): string {
  const participantIds = input.state.participants.map((participant) => participant.participantId);
  const participantIndex = participantIds.indexOf(input.participantId);

  if (participantIndex < 0 || participantIndex >= participantIds.length - 1) {
    return input.participantId;
  }

  return participantIds[participantIndex + 1] ?? input.participantId;
}

function getDefaultCombatRoundCursor(input: {
  participantId?: string;
  roundNumber: number;
  step: CombatRoundStep;
}): CombatRoundCursor {
  return combatRoundCursorSchema.parse({
    participantId: input.participantId,
    roundNumber: input.roundNumber,
    step: getCombatRoundCursorStepForStep(input.step),
  });
}

function getCombatRoundAttackCursorStepForPhase(phase: CombatRoundPhase): CombatRoundCursorStep {
  return phase === "phase1" ? "A1" : "A2";
}

function getCombatRoundParryCursorStepForPhase(phase: CombatRoundPhase): CombatRoundCursorStep {
  return phase === "phase1" ? "P1" : "P2";
}

function getCombatRoundDamageCursorStepForPhase(phase: CombatRoundPhase): CombatRoundCursorStep {
  return phase === "phase1" ? "D1" : "D2";
}

function getCombatRoundCursorStepForPhaseResolutionSubstep(input: {
  phase: CombatRoundPhase;
  substep: CombatRoundPhaseResolutionSubstep;
}): CombatRoundCursorStep {
  switch (input.substep) {
    case "attack":
    case "done":
    case "effects":
      return getCombatRoundAttackCursorStepForPhase(input.phase);
    case "parry":
      return getCombatRoundParryCursorStepForPhase(input.phase);
    case "damage":
      return getCombatRoundDamageCursorStepForPhase(input.phase);
  }
}

function buildCombatRoundCommandId(input: {
  createdAt: string;
  participantId: string;
  state: CombatRoundState;
  type: CombatRoundCommandType;
}): string {
  return [
    "combat-command",
    input.state.roundNumber,
    input.state.commands.length + 1,
    input.type,
    input.participantId,
    input.createdAt,
  ].join(":");
}

export function recordCombatRoundGlobalParticipantCommand(input: {
  commandId?: string;
  createdAt: string;
  createdByUserId?: string;
  facts?: Record<string, unknown>;
  participantId: string;
  state: CombatRoundState;
  step: CombatRoundStep;
  type?: CombatRoundCommandType;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandType = input.type ?? getCombatRoundGlobalCommandTypeForStep(input.step);

  if (!commandType || !isGlobalCombatRoundStep(input.step)) {
    return normalized;
  }

  const actorExists = normalized.participants.some(
    (participant) => participant.participantId === input.participantId,
  );

  if (!actorExists) {
    return normalized;
  }

  const beforeCursor = getDefaultCombatRoundCursor({
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: input.step,
  });
  const afterParticipantId = getNextCombatRoundGlobalParticipantId({
    participantId: input.participantId,
    state: normalized,
  });
  const afterCursor = getDefaultCombatRoundCursor({
    participantId: afterParticipantId,
    roundNumber: normalized.roundNumber,
    step: input.step,
  });
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.createdAt,
    createdByUserId: input.createdByUserId,
    facts: {
      step: beforeCursor.step,
      ...input.facts,
    },
    id:
      input.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.createdAt,
        participantId: input.participantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

function getLatestCombatRoundGlobalParticipantCommandIndex(input: {
  commandType: CombatRoundCommandType;
  participantId: string;
  roundNumber: number;
  state: CombatRoundState;
}): number {
  for (let index = input.state.commands.length - 1; index >= 0; index -= 1) {
    const command = input.state.commands[index];

    if (
      command?.roundNumber === input.roundNumber &&
      command.participantId === input.participantId &&
      command.type === input.commandType
    ) {
      return index;
    }
  }

  return -1;
}

function isGlobalCombatRoundCommandType(type: CombatRoundCommandType): boolean {
  return (
    type === "declare_action" ||
    type === "review_modifiers_phase1" ||
    type === "roll_initiative_phase1" ||
    type === "review_modifiers_phase2" ||
    type === "roll_initiative_phase2"
  );
}

function isUndoableCombatRoundCommandType(type: CombatRoundCommandType): boolean {
  return (
    isGlobalCombatRoundCommandType(type) ||
    type === "roll_attack" ||
    type === "roll_parry" ||
    type === "skip_phase_action" ||
    type === "complete_damage_review_phase1" ||
    type === "complete_damage_review_phase2" ||
    type === "resolve_damage"
  );
}

function getLatestCombatRoundGlobalCommandIndex(input: {
  roundNumber: number;
  state: CombatRoundState;
}): number {
  for (let index = input.state.commands.length - 1; index >= 0; index -= 1) {
    const command = input.state.commands[index];

    if (
      command?.roundNumber === input.roundNumber &&
      isGlobalCombatRoundCommandType(command.type)
    ) {
      return index;
    }
  }

  return -1;
}

function getLatestCombatRoundUndoableCommandIndex(input: {
  roundNumber: number;
  state: CombatRoundState;
}): number {
  for (let index = input.state.commands.length - 1; index >= 0; index -= 1) {
    const command = input.state.commands[index];

    if (
      command?.roundNumber === input.roundNumber &&
      isUndoableCombatRoundCommandType(command.type)
    ) {
      return index;
    }
  }

  return -1;
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
      snapshot.roundNumber !== input.roundNumber || !pairedSteps.includes(snapshot.step),
  );
}

function clearCombatRoundParticipantOutgoingResolutionState(input: {
  participantId: string;
  phase?: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const outgoingResults = normalized.participants
    .filter((participant) => participant.participantId === input.participantId)
    .flatMap((participant) =>
      [participant.attackResults.phase1, participant.attackResults.phase2].filter(
        (result): result is CombatRoundAttackRollResult => Boolean(result),
      ),
    )
    .filter((result) => !input.phase || result.phase === input.phase);
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
        result.attackerParticipantId !== input.participantId ||
        (input.phase !== undefined && result.phase !== input.phase),
    ),
    phaseResolutionStatuses: {
      ...normalized.phaseResolutionStatuses,
      [input.participantId]: input.phase
        ? {
            ...normalized.phaseResolutionStatuses[input.participantId],
            [input.phase]: undefined,
          }
        : {},
    },
    participants: normalized.participants.map((participant) => {
      if (participant.participantId === input.participantId) {
        const nextAttackResults =
          input.phase === "phase1"
            ? { ...participant.attackResults, phase1: undefined }
            : input.phase === "phase2"
              ? { ...participant.attackResults, phase2: undefined }
              : {};
        const phaseStepStatuses =
          input.phase === "phase1"
            ? {
                phase_1_actions: "pending" as const,
                phase_1_damage: "pending" as const,
                review_phase_2_actions: "pending" as const,
              }
            : input.phase === "phase2"
              ? {
                  phase_2_actions: "pending" as const,
                  phase_2_damage: "pending" as const,
                  review_phase_2_damage: "pending" as const,
                }
              : {
                  phase_1_actions: "pending" as const,
                  phase_1_damage: "pending" as const,
                  phase_2_actions: "pending" as const,
                  phase_2_damage: "pending" as const,
                  review_phase_2_actions: "pending" as const,
                  review_phase_2_damage: "pending" as const,
                };

        return {
          ...participant,
          attackResults: nextAttackResults,
          stepStatuses: {
            ...participant.stepStatuses,
            ...phaseStepStatuses,
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
    stepSnapshots: normalized.stepSnapshots.filter((snapshot) => {
      if (snapshot.roundNumber !== normalized.roundNumber) {
        return true;
      }

      return !affectedSnapshotSteps.get(snapshot.participantId)?.has(snapshot.step);
    }),
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
    return storedStatus;
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

    if (
      storedStatus === "submitted" ||
      storedStatus === "gmEdited" ||
      storedStatus === "complete"
    ) {
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
    hasPhaseAttack && attackResult?.hit ? attackResult.defenderParticipantId : input.participantId;
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

function getCombatRoundPhaseActionSkipCommandAfterCursor(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundCursor {
  const phaseCursor =
    input.state.phaseResolutionCursor?.phase === input.phase
      ? input.state.phaseResolutionCursor
      : undefined;

  return combatRoundCursorSchema.parse({
    participantId: phaseCursor?.participantId,
    roundNumber: input.state.roundNumber,
    step: getCombatRoundAttackCursorStepForPhase(input.phase),
  });
}

function recordCombatRoundPhaseActionSkipCommand(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundAttackCursorStepForPhase(input.phase),
  });
  const afterCursor = getCombatRoundPhaseActionSkipCommandAfterCursor({
    phase: input.phase,
    state: normalized,
  });
  const commandType = "skip_phase_action" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      phase: input.phase,
      status: "skipped",
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.participantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.participantId,
    phase: input.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

export function recordCombatRoundNoAttackPhaseReview(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const hasPhaseAttack = combatRoundParticipantHasPhaseAttack({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
  });

  if (hasPhaseAttack) {
    throw new RangeError("No-attack phase review cannot complete an attack-capable phase.");
  }

  const completed = completeCombatRoundPhaseResolutionForParticipant({
    participantId: input.participantId,
    phase: input.phase,
    state: normalized,
    submittedBy: input.submittedBy,
    updatedAt: input.updatedAt,
  });

  return input.command
    ? recordCombatRoundPhaseActionSkipCommand({
        command: input.command,
        participantId: input.participantId,
        phase: input.phase,
        state: completed,
      })
    : completed;
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

function getCombatRoundAttackResultById(input: {
  attackResultId: string;
  state: CombatRoundState;
}): CombatRoundAttackRollResult | undefined {
  const phases: CombatRoundPhase[] = ["phase1", "phase2"];

  for (const participant of input.state.participants) {
    for (const phase of phases) {
      const result = participant.attackResults[phase];

      if (
        result &&
        getCombatRoundAttackResultId({
          result,
          roundNumber: input.state.roundNumber,
        }) === input.attackResultId
      ) {
        return result;
      }
    }
  }

  return undefined;
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
            notes: input.attackResult.hit
              ? "Parry resolved successfully. Damage is not required."
              : undefined,
            status: "not_required",
          },
    damageResult: undefined,
    parryResolution: input.parryResolution,
    updatedAt: input.updatedAt,
  });

  return upsertCombatRoundPhaseResolutionResults({
    results: [nextResult],
    state: normalized,
  });
}

function getCombatRoundParryCommandAfterCursor(input: {
  attackResult: CombatRoundAttackRollResult;
  parryResolution: CombatRoundParryResolution;
  state: CombatRoundState;
}): CombatRoundCursor {
  if (input.parryResolution.success === true) {
    const phaseCursor =
      input.state.phaseResolutionCursor?.phase === input.attackResult.phase
        ? input.state.phaseResolutionCursor
        : undefined;

    return combatRoundCursorSchema.parse({
      participantId: phaseCursor?.participantId,
      roundNumber: input.state.roundNumber,
      step: getCombatRoundAttackCursorStepForPhase(input.attackResult.phase),
    });
  }

  return combatRoundCursorSchema.parse({
    participantId: input.attackResult.defenderParticipantId,
    roundNumber: input.state.roundNumber,
    step: getCombatRoundDamageCursorStepForPhase(input.attackResult.phase),
  });
}

function recordCombatRoundParryCommand(input: {
  attackResult: CombatRoundAttackRollResult;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  parryResolution: CombatRoundParryResolution;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.attackResult.defenderParticipantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundParryCursorStepForPhase(input.attackResult.phase),
  });
  const afterCursor = getCombatRoundParryCommandAfterCursor({
    attackResult: input.attackResult,
    parryResolution: input.parryResolution,
    state: normalized,
  });
  const commandType = "roll_parry" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      attackResultId: getCombatRoundAttackResultId({
        result: input.attackResult,
        roundNumber: normalized.roundNumber,
      }),
      attackerParticipantId: input.attackResult.attackerParticipantId,
      defenderParticipantId: input.attackResult.defenderParticipantId,
      success: input.parryResolution.success === true,
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.attackResult.defenderParticipantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.attackResult.defenderParticipantId,
    phase: input.attackResult.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

export function recordCombatRoundParryResult(input: {
  attackResult: CombatRoundAttackRollResult;
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  parryResolution: CombatRoundParryResolution;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const phase = input.attackResult.phase;
  const withParry = recordCombatRoundParryResolution({
    attackResult: input.attackResult,
    parryResolution: input.parryResolution,
    state: input.state,
    updatedAt: input.updatedAt,
  });
  const nextRoundState =
    input.parryResolution.success === true
      ? completeCombatRoundPhaseResolutionForParticipant({
          participantId: input.attackResult.attackerParticipantId,
          phase,
          state: withParry,
          submittedBy: input.submittedBy,
          updatedAt: input.updatedAt,
        })
      : advanceCombatRoundPhaseResolutionSubstepForParticipant({
          participantId: input.attackResult.attackerParticipantId,
          phase,
          state: withParry,
          updatedAt: input.updatedAt,
        });
  const defenderOwnedNextRoundState =
    input.parryResolution.success === true
      ? nextRoundState
      : {
          ...nextRoundState,
          phaseResolutionCursor: {
            participantId: input.attackResult.defenderParticipantId,
            phase,
            substep: "damage" as const,
          },
          selectedParticipantId: input.attackResult.defenderParticipantId,
          selectedStep: getCombatRoundDamageReviewStepForPhase(phase),
        };

  return input.command
    ? recordCombatRoundParryCommand({
        attackResult: input.attackResult,
        command: input.command,
        parryResolution: input.parryResolution,
        state: defenderOwnedNextRoundState,
      })
    : defenderOwnedNextRoundState;
}

export function getCombatRoundDamageResultId(input: { attackResultId: string }): string {
  return `${input.attackResultId}:damage`;
}

function rollCombatDamageDie(input: {
  rng: () => number;
  sides: number;
}): number {
  if (!Number.isInteger(input.sides) || input.sides < 1) {
    throw new RangeError("Combat damage die must have at least one side.");
  }

  return Math.min(input.sides, Math.floor(input.rng() * input.sides) + 1);
}

export function buildCombatRoundDamageResult(input: {
  armorModifier?: number;
  attackResult: CombatRoundAttackRollResult;
  createdAt: string;
  createdByUserId?: string;
  defenderDm: number;
  dmb: number;
  rng?: () => number;
  roundNumber: number;
}): CombatRoundDamageResult {
  if (!input.attackResult.hit) {
    throw new RangeError("Damage cannot be resolved for a missed attack.");
  }

  const damageMetadata = lookupCombatToHitDamageMetadata(input.attackResult.lookupTotal);

  if (!damageMetadata) {
    throw new RangeError(
      `Combat To Hit lookup total ${input.attackResult.lookupTotal} does not produce damage.`,
    );
  }

  const armorModifier = input.armorModifier ?? 0;
  const metadataDamageRoll = damageMetadata.damageRoll;
  let damageRoll: CombatRoundDamageResult["damageRoll"] = {
    required: false,
  };
  let damageRollTotal = 0;

  if (metadataDamageRoll?.required) {
    if (!metadataDamageRoll.dieSides) {
      throw new RangeError("Combat damage roll is required but no die size is defined.");
    }

    damageRollTotal = rollCombatDamageDie({
      rng: input.rng ?? Math.random,
      sides: metadataDamageRoll.dieSides,
    });
    damageRoll = {
      diceExpression: metadataDamageRoll.diceExpression,
      required: true,
      rolls: [damageRollTotal],
      total: damageRollTotal,
    };
  }

  const totalDamage = input.attackResult.grazing
    ? damageRollTotal + input.defenderDm + armorModifier
    : input.dmb +
      input.defenderDm +
      damageMetadata.damageModifier +
      damageRollTotal +
      armorModifier;
  const attackResultId = getCombatRoundAttackResultId({
    result: input.attackResult,
    roundNumber: input.roundNumber,
  });

  return combatRoundDamageResultSchema.parse({
    armorModifier,
    attackResultId,
    attackerParticipantId: input.attackResult.attackerParticipantId,
    createdAt: input.createdAt,
    createdByUserId: input.createdByUserId,
    criticalGrade: damageMetadata.criticalGrade,
    damageRoll,
    defenderDm: input.defenderDm,
    defenderParticipantId: input.attackResult.defenderParticipantId,
    dmb: input.dmb,
    grazing: input.attackResult.grazing,
    kind: "damage_result",
    lookupTotal: input.attackResult.lookupTotal,
    minDamage: damageMetadata.minDamage,
    parryResultId: `${attackResultId}:parry`,
    phase: input.attackResult.phase,
    tableDamageModifier: damageMetadata.damageModifier,
    totalDamage,
    weaponName: input.attackResult.weaponName,
  });
}

function recordCombatRoundDamageResolution(input: {
  attackResult: CombatRoundAttackRollResult;
  damageResult: CombatRoundDamageResult;
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
    damageResult: input.damageResult,
    damageRoll: {
      notes: "Damage resolved. Combat Effects are not created yet.",
      status: "rolled",
      total: input.damageResult.totalDamage,
    },
    updatedAt: input.updatedAt,
  });

  return upsertCombatRoundPhaseResolutionResults({
    results: [nextResult],
    state: normalized,
  });
}

function recordCombatRoundResolveDamageCommand(input: {
  attackResult: CombatRoundAttackRollResult;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  damageResult: CombatRoundDamageResult;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.attackResult.defenderParticipantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundDamageCursorStepForPhase(input.attackResult.phase),
  });
  const afterCursor = getCombatRoundDamageReviewCommandAfterCursor({
    phase: input.attackResult.phase,
    state: normalized,
  });
  const commandType = "resolve_damage" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      attackResultId: input.damageResult.attackResultId,
      attackerParticipantId: input.attackResult.attackerParticipantId,
      criticalGrade: input.damageResult.criticalGrade,
      damageResultId: getCombatRoundDamageResultId({
        attackResultId: input.damageResult.attackResultId,
      }),
      defenderParticipantId: input.attackResult.defenderParticipantId,
      status: "resolved",
      totalDamage: input.damageResult.totalDamage,
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.attackResult.defenderParticipantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.attackResult.defenderParticipantId,
    phase: input.attackResult.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

export function recordCombatRoundDamageResult(input: {
  armorModifier?: number;
  attackResult: CombatRoundAttackRollResult;
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  defenderDm: number;
  dmb: number;
  rng?: () => number;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult: input.attackResult,
    state: normalized,
  });

  if (!input.attackResult.hit) {
    throw new RangeError("Damage cannot be resolved for a missed attack.");
  }

  if (
    !resolution ||
    resolution.parryResolution.status !== "resolved" ||
    resolution.parryResolution.success !== false ||
    resolution.damageRoll.status !== "pending"
  ) {
    throw new RangeError("Damage is not pending for this attack.");
  }

  const damageResult = buildCombatRoundDamageResult({
    armorModifier: input.armorModifier,
    attackResult: input.attackResult,
    createdAt: input.updatedAt,
    createdByUserId: input.command?.createdByUserId,
    defenderDm: input.defenderDm,
    dmb: input.dmb,
    rng: input.rng,
    roundNumber: normalized.roundNumber,
  });
  const withDamageResult = recordCombatRoundDamageResolution({
    attackResult: input.attackResult,
    damageResult,
    state: normalized,
    updatedAt: input.updatedAt,
  });
  const withCompletedReview = completeCombatRoundPhaseResolutionForParticipant({
    participantId: input.attackResult.attackerParticipantId,
    phase: input.attackResult.phase,
    state: withDamageResult,
    submittedBy: input.submittedBy,
    updatedAt: input.updatedAt,
  });

  return input.command
    ? recordCombatRoundResolveDamageCommand({
        attackResult: input.attackResult,
        command: input.command,
        damageResult,
        state: withCompletedReview,
      })
    : withCompletedReview;
}

function getCombatRoundDamageReviewCommandTypeForPhase(
  phase: CombatRoundPhase,
): CombatRoundCommandType {
  return phase === "phase1" ? "complete_damage_review_phase1" : "complete_damage_review_phase2";
}

function getCombatRoundDamageReviewCommandAfterCursor(input: {
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundCursor {
  const phaseCursor =
    input.state.phaseResolutionCursor?.phase === input.phase
      ? input.state.phaseResolutionCursor
      : undefined;

  return combatRoundCursorSchema.parse({
    participantId: phaseCursor?.participantId,
    roundNumber: input.state.roundNumber,
    step: getCombatRoundAttackCursorStepForPhase(input.phase),
  });
}

function recordCombatRoundDamageReviewCommand(input: {
  attackResult: CombatRoundAttackRollResult;
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.attackResult.defenderParticipantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundDamageCursorStepForPhase(input.attackResult.phase),
  });
  const afterCursor = getCombatRoundDamageReviewCommandAfterCursor({
    phase: input.attackResult.phase,
    state: normalized,
  });
  const commandType = getCombatRoundDamageReviewCommandTypeForPhase(input.attackResult.phase);
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      attackResultId: getCombatRoundAttackResultId({
        result: input.attackResult,
        roundNumber: normalized.roundNumber,
      }),
      attackerParticipantId: input.attackResult.attackerParticipantId,
      defenderParticipantId: input.attackResult.defenderParticipantId,
      status: "deferred",
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.attackResult.defenderParticipantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.attackResult.defenderParticipantId,
    phase: input.attackResult.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

export function recordCombatRoundDamageReviewPlaceholder(input: {
  attackResult: CombatRoundAttackRollResult;
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  updatedAt: string;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult: input.attackResult,
    state: normalized,
  });

  if (!input.attackResult.hit) {
    throw new RangeError("Damage review cannot be completed for a missed attack.");
  }

  if (
    !resolution ||
    resolution.parryResolution.status !== "resolved" ||
    resolution.parryResolution.success !== false ||
    resolution.damageRoll.status !== "pending"
  ) {
    throw new RangeError("Damage review is not pending for this attack.");
  }

  const withCompletedReview = completeCombatRoundPhaseResolutionForParticipant({
    participantId: input.attackResult.attackerParticipantId,
    phase: input.attackResult.phase,
    state: normalized,
    submittedBy: input.submittedBy,
    updatedAt: input.updatedAt,
  });

  return input.command
    ? recordCombatRoundDamageReviewCommand({
        attackResult: input.attackResult,
        command: input.command,
        state: withCompletedReview,
      })
    : withCompletedReview;
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
  const roundNumber = existing?.roundNumber ?? input.encounter.currentRound;
  const existingCursorStep = existing?.currentCursor
    ? getCombatRoundStepForCursorStep(existing.currentCursor.step)
    : undefined;
  const existingCursorParticipantId = existing?.currentCursor?.participantId;
  const canUseExistingCurrentCursor =
    existing?.currentCursor &&
    existing.currentCursor.roundNumber === roundNumber &&
    existingCursorStep === currentStep &&
    (!existingCursorParticipantId || participantIds.has(existingCursorParticipantId));
  const resetsStaleDeclarationSelection =
    currentStep === "select_actions" &&
    existing?.selectedStep !== undefined &&
    existing.selectedStep !== "select_actions";
  const selectedParticipantId =
    canUseExistingCurrentCursor && existingCursorParticipantId
      ? existingCursorParticipantId
      : !resetsStaleDeclarationSelection &&
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
    commands: existing?.commands ?? [],
    currentCursor: canUseExistingCurrentCursor
      ? existing.currentCursor
      : isGlobalCombatRoundStep(currentStep)
        ? getDefaultCombatRoundCursor({
            participantId: selectedParticipantId,
            roundNumber,
            step: currentStep,
          })
        : undefined,
    currentStep,
    phaseResolutionCursor:
      currentStep === "select_actions" ? undefined : existing?.phaseResolutionCursor,
    phaseResolutionResults: existing?.phaseResolutionResults ?? [],
    phaseResolutionStatuses: existing?.phaseResolutionStatuses ?? {},
    participants,
    roundNumber,
    selectedParticipantId,
    selectedStep: canUseExistingCurrentCursor
      ? currentStep
      : resetsStaleDeclarationSelection
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

function isTopAdvanceModifierReviewStep(step: CombatRoundStep): boolean {
  return step === "review_action_modifiers" || step === "review_phase_2_modifiers";
}

function isCombatRoundStepStatusOpenForTopAdvance(status: CombatRoundStepStatus): boolean {
  return status === "pending" || status === "ready";
}

function getCombatRoundTopAdvanceParticipantStatus(input: {
  participant: CombatRoundParticipantState;
  step: CombatRoundStep;
}): CombatRoundStepStatus | undefined {
  const currentStatus = input.participant.stepStatuses[input.step] ?? "pending";

  if (!isCombatRoundStepStatusOpenForTopAdvance(currentStatus)) {
    return undefined;
  }

  switch (input.step) {
    case "select_actions":
      return "locked";
    case "review_action_modifiers":
    case "review_phase_2_modifiers":
      return "complete";
    case "initiative_phase_1":
      return input.participant.initiatives.phase1 ? undefined : "complete";
    case "initiative_phase_2":
      return input.participant.initiatives.phase2 ? undefined : "complete";
    default:
      return undefined;
  }
}

export function advanceCombatRoundStep(
  state: CombatRoundState,
  input: {
    command?: {
      commandId?: string;
      createdAt: string;
      createdByUserId?: string;
      facts?: Record<string, unknown>;
      participantId?: string;
    };
    stepSnapshots?: CombatRoundStepSnapshot[];
  } = {},
): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(state);
  const advanceCommand = input.command;
  const commandBackedGlobalAdvanceStatuses =
    advanceCommand && isGlobalCombatRoundStep(normalized.currentStep)
      ? normalized.participants
          .map((participant) => ({
            participantId: participant.participantId,
            status: getCombatRoundTopAdvanceParticipantStatus({
              participant,
              step: normalized.currentStep,
            }),
          }))
          .filter(
            (entry): entry is { participantId: string; status: CombatRoundStepStatus } =>
              entry.status !== undefined,
          )
      : [];
  const commandBackedGlobalAdvanceStatusByParticipantId = new Map(
    commandBackedGlobalAdvanceStatuses.map((entry) => [entry.participantId, entry.status]),
  );
  const withCommand =
    advanceCommand && commandBackedGlobalAdvanceStatuses.length > 0
      ? commandBackedGlobalAdvanceStatuses.reduce(
          (current, entry) =>
            recordCombatRoundGlobalParticipantCommand({
              createdAt: advanceCommand.createdAt,
              createdByUserId: advanceCommand.createdByUserId,
              facts: {
                source: "advance_step",
                status: entry.status,
                ...advanceCommand.facts,
              },
              participantId: entry.participantId,
              state: current,
              step: normalized.currentStep,
            }),
          normalized,
        )
      : normalized;
  const withSnapshots = input.stepSnapshots
    ? upsertCombatRoundStepSnapshots({
        snapshots: input.stepSnapshots,
        state: withCommand,
      })
    : withCommand;
  const nextStep = getNextCombatRoundStep(normalized.currentStep);
  const startsNextRound = normalized.currentStep === "round_summary";
  const advancesDeclarationStep = normalized.currentStep === "select_actions";
  const startsPhaseResolution =
    nextStep === "phase_1_actions"
      ? "phase1"
      : nextStep === "phase_2_actions"
        ? "phase2"
        : undefined;
  const nextRoundNumber = startsNextRound
    ? withSnapshots.roundNumber + 1
    : withSnapshots.roundNumber;
  const nextGlobalParticipantId = withSnapshots.participants[0]?.participantId;
  const baseState: CombatRoundState = {
    ...withSnapshots,
    activeParticipantId: startsNextRound ? undefined : withSnapshots.activeParticipantId,
    commands: startsNextRound ? [] : withSnapshots.commands,
    currentCursor:
      startsNextRound || isGlobalCombatRoundStep(nextStep)
        ? getDefaultCombatRoundCursor({
            participantId: nextGlobalParticipantId,
            roundNumber: nextRoundNumber,
            step: nextStep,
          })
        : undefined,
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
            [normalized.currentStep]:
              advanceCommand && isGlobalCombatRoundStep(normalized.currentStep)
                ? (commandBackedGlobalAdvanceStatusByParticipantId.get(
                    participant.participantId,
                  ) ?? participant.stepStatuses[normalized.currentStep])
                : advancesDeclarationStep
                  ? participant.stepStatuses.select_actions === "submitted" ||
                    participant.stepStatuses.select_actions === "gmEdited"
                    ? participant.stepStatuses.select_actions
                    : "locked"
                  : isTopAdvanceModifierReviewStep(normalized.currentStep)
                    ? participant.stepStatuses[normalized.currentStep]
                    : "complete",
          },
    })),
    roundNumber: nextRoundNumber,
    selectedParticipantId: startsNextRound
      ? nextGlobalParticipantId
      : isGlobalCombatRoundStep(nextStep)
        ? nextGlobalParticipantId
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
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
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
    return input.command
      ? recordCombatRoundGlobalParticipantCommand({
          ...input.command,
          facts: {
            status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
          },
          participantId: input.participantId,
          state: withStatus,
          step: "select_actions",
          type: "declare_action",
        })
      : withStatus;
  }

  const normalized = combatRoundStateSchema.parse(withStatus);
  const declaration = combatRoundDeclarationSchema.parse({
    ...input.declaration,
    submittedBy: input.submittedBy,
  });

  const withDeclaration: CombatRoundState = {
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

  return input.command
    ? recordCombatRoundGlobalParticipantCommand({
        ...input.command,
        facts: {
          actionId: declaration.actionId,
          status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
        },
        participantId: input.participantId,
        state: withDeclaration,
        step: "select_actions",
        type: "declare_action",
      })
    : withDeclaration;
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
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
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

  const withStatus = setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: withInitiative,
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: initiativeStep,
  });

  return input.command
    ? recordCombatRoundGlobalParticipantCommand({
        ...input.command,
        facts: {
          phase: input.phase,
          status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
        },
        participantId: input.participantId,
        state: withStatus,
        step: initiativeStep,
        type: input.phase === "phase1" ? "roll_initiative_phase1" : "roll_initiative_phase2",
      })
    : withStatus;
}

function getCombatRoundAttackCommandAfterCursor(input: {
  result: CombatRoundAttackRollResult;
  state: CombatRoundState;
}): CombatRoundCursor {
  if (input.result.hit) {
    return combatRoundCursorSchema.parse({
      participantId: input.result.defenderParticipantId,
      roundNumber: input.state.roundNumber,
      step: getCombatRoundCursorStepForPhaseResolutionSubstep({
        phase: input.result.phase,
        substep: "parry",
      }),
    });
  }

  const phaseCursor =
    input.state.phaseResolutionCursor?.phase === input.result.phase
      ? input.state.phaseResolutionCursor
      : undefined;

  return combatRoundCursorSchema.parse({
    participantId: phaseCursor?.participantId,
    roundNumber: input.state.roundNumber,
    step: getCombatRoundAttackCursorStepForPhase(input.result.phase),
  });
}

function recordCombatRoundAttackCommand(input: {
  command: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantId: string;
  result: CombatRoundAttackRollResult;
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const beforeCursor = combatRoundCursorSchema.parse({
    participantId: input.participantId,
    roundNumber: normalized.roundNumber,
    step: getCombatRoundAttackCursorStepForPhase(input.result.phase),
  });
  const afterCursor = getCombatRoundAttackCommandAfterCursor({
    result: input.result,
    state: normalized,
  });
  const commandType = "roll_attack" satisfies CombatRoundCommandType;
  const command = combatRoundCommandSchema.parse({
    afterCursor,
    beforeCursor,
    createdAt: input.command.createdAt,
    createdByUserId: input.command.createdByUserId,
    facts: {
      attackResultId: getCombatRoundAttackResultId({
        result: input.result,
        roundNumber: normalized.roundNumber,
      }),
      defenderParticipantId: input.result.defenderParticipantId,
      grazing: input.result.grazing,
      hit: input.result.hit,
      ...(afterCursor.participantId
        ? {
            nextStepOpened: {
              participantId: afterCursor.participantId,
              step: afterCursor.step,
            },
          }
        : {}),
    },
    id:
      input.command.commandId ??
      buildCombatRoundCommandId({
        createdAt: input.command.createdAt,
        participantId: input.participantId,
        state: normalized,
        type: commandType,
      }),
    participantId: input.participantId,
    phase: input.result.phase,
    roundNumber: normalized.roundNumber,
    step: beforeCursor.step,
    type: commandType,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.afterCursor.step);

  return {
    ...normalized,
    commands: [...normalized.commands, command],
    currentCursor: command.afterCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.afterCursor.participantId ?? normalized.selectedParticipantId,
    selectedStep,
  };
}

export function recordCombatRoundAttackResult(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
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

  const withStatus = setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: recordCombatRoundPhaseResolutionAttackDone({
      attackResult: input.result,
      state: withResult,
      updatedAt: input.result.rolledAt,
    }),
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: attackStep,
  });

  return input.command
    ? recordCombatRoundAttackCommand({
        command: input.command,
        participantId: input.participantId,
        result: input.result,
        state: withStatus,
      })
    : withStatus;
}

export function recordCombatRoundParticipantStepReview(input: {
  command?: {
    commandId?: string;
    createdAt: string;
    createdByUserId?: string;
  };
  participantId: string;
  state: CombatRoundState;
  step: CombatRoundStep;
  submittedBy: "gm" | "player";
}): CombatRoundState {
  const withStatus = setCombatRoundParticipantStepStatus({
    participantId: input.participantId,
    state: input.state,
    status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
    step: input.step,
  });

  const commandType =
    input.step === "review_action_modifiers"
      ? "review_modifiers_phase1"
      : input.step === "review_phase_2_modifiers"
        ? "review_modifiers_phase2"
        : undefined;

  return input.command && commandType
    ? recordCombatRoundGlobalParticipantCommand({
        ...input.command,
        facts: {
          status: input.submittedBy === "gm" ? "gmEdited" : "submitted",
        },
        participantId: input.participantId,
        state: withStatus,
        step: input.step,
        type: commandType,
      })
    : withStatus;
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
    damageResult: undefined,
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
    damageResult: undefined,
    updatedAt: input.updatedAt,
  });
}

function getCombatRoundGlobalDependencyPhaseForStep(
  step: CombatRoundStep,
): CombatRoundPhase | undefined {
  if (step === "review_action_modifiers" || step === "initiative_phase_1") {
    return "phase1";
  }

  if (step === "review_phase_2_modifiers" || step === "initiative_phase_2") {
    return "phase2";
  }

  return undefined;
}

function clearCombatRoundStepLegacy(input: {
  state: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundState {
  const parsed = combatRoundStateSchema.parse(input.state);
  const selectedParticipantId =
    parsed.selectedParticipantId &&
    parsed.participants.some(
      (participant) => participant.participantId === parsed.selectedParticipantId,
    )
      ? parsed.selectedParticipantId
      : undefined;
  const globalDependencyPhase = getCombatRoundGlobalDependencyPhaseForStep(input.step);
  const declarationClearParticipantId =
    input.step === "select_actions" && selectedParticipantId ? selectedParticipantId : undefined;
  const dependencyClearParticipantId =
    declarationClearParticipantId ?? (globalDependencyPhase ? selectedParticipantId : undefined);
  const normalized = dependencyClearParticipantId
    ? clearCombatRoundParticipantOutgoingResolutionState({
        participantId: dependencyClearParticipantId,
        phase: globalDependencyPhase,
        state: parsed,
      })
    : parsed;
  const clearsPhaseAction = input.step === "phase_1_actions" || input.step === "phase_2_actions";
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
  const clearsDamageReview = input.step === "phase_1_damage" || input.step === "phase_2_damage";
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
    ? (selectedOutgoingAttackResult ?? selectedIncomingAttackResult)
    : selectedIncomingAttackResult;
  const selectedResolutionForClear = selectedAttackResultForClear
    ? getCombatRoundPhaseResolutionResultForAttack({
        attackResult: selectedAttackResultForClear,
        state: normalized,
      })
    : undefined;
  const clearsAutoCreatedPendingParry =
    clearsParryReview &&
    Boolean(selectedAttackResultForClear?.hit) &&
    (!selectedResolutionForClear ||
      selectedResolutionForClear.parryResolution.status === "pending");
  const clearsPhaseActionRedo = clearsPhaseAction || clearsAutoCreatedPendingParry;
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
            clearsOwnerStatus && clearsPhaseActionRedo
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
    clearResolutionPhase && clearsPhaseActionRedo
      ? (selectedAttackResultForClear?.attackerParticipantId ??
        selectedParticipantForClear ??
        getCombatRoundPhaseResolutionOrder({
          phase: clearResolutionPhase,
          state: normalized,
        })[0])
      : clearResolutionPhase && (clearsParryReview || clearsDamageReview)
        ? selectedParticipantForClear
        : undefined;
  const nextCursorSubstep =
    clearResolutionPhase && nextCursorParticipant
      ? clearsParryReview && selectedAttackResultForClear
        ? clearsAutoCreatedPendingParry
          ? getCombatRoundInitialPhaseResolutionSubstep({
              participantId: selectedAttackResultForClear.attackerParticipantId,
              phase: clearResolutionPhase,
              state: normalized,
            })
          : getCombatRoundPostAttackResolutionSubstep(selectedAttackResultForClear)
        : clearsDamageReview
          ? selectedResolutionForClear?.damageRoll.status === "pending" &&
            selectedResolutionForClear.parryResolution.status === "resolved" &&
            selectedResolutionForClear.parryResolution.success === false
            ? "damage"
            : "parry"
          : selectedAttackResultForClear && clearsPhaseActionRedo
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
          : globalDependencyPhase &&
              normalized.phaseResolutionCursor?.phase === globalDependencyPhase
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

            return !(clearsPhaseActionRedo && result.attackResultId === selectedAttackResultId);
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
        clearsPhaseActionRedo &&
        participant.participantId === selectedAttackResultForClear?.attackerParticipantId
      ) {
        delete nextAttackResults.phase1;
      }

      if (
        input.step === "phase_2_actions" &&
        clearsPhaseActionRedo &&
        participant.participantId === selectedAttackResultForClear?.attackerParticipantId
      ) {
        delete nextAttackResults.phase2;
      }

      if (
        clearsAutoCreatedPendingParry &&
        selectedAttackResultForClear?.phase === "phase1" &&
        participant.participantId === selectedAttackResultForClear.attackerParticipantId
      ) {
        delete nextAttackResults.phase1;
      }

      if (
        clearsAutoCreatedPendingParry &&
        selectedAttackResultForClear?.phase === "phase2" &&
        participant.participantId === selectedAttackResultForClear.attackerParticipantId
      ) {
        delete nextAttackResults.phase2;
      }

      if (
        input.step === "initiative_phase_1" &&
        participant.participantId === selectedParticipantId
      ) {
        delete nextInitiatives.phase1;
      }

      if (
        input.step === "review_action_modifiers" &&
        participant.participantId === selectedParticipantId
      ) {
        delete nextInitiatives.phase1;
      }

      if (
        input.step === "initiative_phase_2" &&
        participant.participantId === selectedParticipantId
      ) {
        delete nextInitiatives.phase2;
      }

      if (
        input.step === "review_phase_2_modifiers" &&
        participant.participantId === selectedParticipantId
      ) {
        delete nextInitiatives.phase2;
      }

      const resetsSelectedStep =
        (!clearResolutionPhase && participant.participantId === selectedParticipantId) ||
        participant.participantId === selectedParticipantForClear ||
        (clearsPhaseActionRedo &&
          participant.participantId === selectedAttackResultForClear?.attackerParticipantId);
      const resetsDownstreamReview =
        clearsPhaseActionRedo &&
        participant.participantId === selectedAttackResultForClear?.defenderParticipantId;
      const resetsGlobalPhaseDependency =
        !clearResolutionPhase &&
        participant.participantId === selectedParticipantId &&
        globalDependencyPhase;

      return {
        ...participant,
        attackResults: nextAttackResults,
        declaration:
          input.step === "select_actions" && participant.participantId === selectedParticipantId
            ? undefined
            : participant.declaration,
        initiatives: nextInitiatives,
        stepStatuses:
          resetsSelectedStep || resetsDownstreamReview
            ? {
                ...participant.stepStatuses,
                ...(resetsSelectedStep ? { [input.step]: "pending" as const } : {}),
                ...(clearsPhaseActionRedo &&
                participant.participantId === selectedAttackResultForClear?.attackerParticipantId &&
                selectedAttackResultForClear.phase === "phase1"
                  ? {
                      phase_1_actions: "pending" as const,
                    }
                  : {}),
                ...(clearsPhaseActionRedo &&
                participant.participantId === selectedAttackResultForClear?.attackerParticipantId &&
                selectedAttackResultForClear.phase === "phase2"
                  ? {
                      phase_2_actions: "pending" as const,
                    }
                  : {}),
                ...(input.step === "review_action_modifiers" && resetsGlobalPhaseDependency
                  ? {
                      initiative_phase_1: "pending" as const,
                    }
                  : {}),
                ...(input.step === "review_phase_2_modifiers" && resetsGlobalPhaseDependency
                  ? {
                      initiative_phase_2: "pending" as const,
                    }
                  : {}),
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
        ? clearsPhaseActionRedo
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
      step:
        clearsAutoCreatedPendingParry && clearResolutionPhase
          ? getCombatRoundPhaseActionStepForPhase(clearResolutionPhase)
          : input.step,
    }),
  };
}

export function undoLatestCombatRoundGlobalParticipantCommand(input: {
  participantId?: string;
  state: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandType = getCombatRoundGlobalCommandTypeForStep(input.step);
  const participantId =
    input.participantId ??
    (normalized.selectedParticipantId &&
    normalized.participants.some(
      (participant) => participant.participantId === normalized.selectedParticipantId,
    )
      ? normalized.selectedParticipantId
      : undefined);

  if (!commandType || !isGlobalCombatRoundStep(input.step) || !participantId) {
    return undefined;
  }

  const commandIndex = getLatestCombatRoundGlobalParticipantCommandIndex({
    commandType,
    participantId,
    roundNumber: normalized.roundNumber,
    state: normalized,
  });
  const command = normalized.commands[commandIndex];

  if (!command) {
    return undefined;
  }

  return undoCombatRoundGlobalCommandAtIndex({
    commandIndex,
    state: normalized,
  });
}

function getCombatRoundAttackCommandPhase(command: CombatRoundCommand): CombatRoundPhase | undefined {
  if (command.phase) {
    return command.phase;
  }

  const step = command.step ?? command.beforeCursor.step ?? command.afterCursor.step;

  if (step === "A1" || step === "P1" || step === "D1") {
    return "phase1";
  }

  if (step === "A2" || step === "P2" || step === "D2") {
    return "phase2";
  }

  return undefined;
}

function undoCombatRoundGlobalCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    !isGlobalCombatRoundCommandType(command.type)
  ) {
    return undefined;
  }

  const step = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const participantId = command.beforeCursor.participantId ?? command.participantId;

  const stateForLegacyClear = setCombatRoundSelection({
    participantId,
    state: normalized,
    step,
  });
  const cleared = clearCombatRoundStepLegacy({
    state: stateForLegacyClear,
    step,
  });
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);

  return {
    ...cleared,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    selectedParticipantId: command.beforeCursor.participantId ?? participantId,
    selectedStep,
  };
}

function undoCombatRoundAttackCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "roll_attack"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);

  if (!phase) {
    return undefined;
  }

  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const stateForLegacyClear = setCombatRoundSelection({
    participantId,
    state: normalized,
    step: getCombatRoundPhaseActionStepForPhase(phase),
  });
  const cleared = clearCombatRoundStepLegacy({
    state: stateForLegacyClear,
    step: getCombatRoundPhaseActionStepForPhase(phase),
  });

  return {
    ...cleared,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "attack",
    },
    selectedParticipantId: participantId,
    selectedStep,
  };
}

function undoCombatRoundPhaseActionSkipCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "skip_phase_action"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);

  if (!phase) {
    return undefined;
  }

  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const actionStep = getCombatRoundPhaseActionStepForPhase(phase);
  const parryStep = getCombatRoundParryReviewStepForPhase(phase);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);
  const nextSubstep = getCombatRoundInitialPhaseResolutionSubstep({
    participantId,
    phase,
    state: normalized,
  });
  const phaseResolutionStatusesAfterUndo: CombatRoundPhaseResolutionStatuses = {
    ...normalized.phaseResolutionStatuses,
    [participantId]: {
      ...normalized.phaseResolutionStatuses[participantId],
      [phase]: {
        substep: nextSubstep,
        updatedAt: command.createdAt,
      },
    },
  };

  if (command.afterCursor.participantId && command.afterCursor.participantId !== participantId) {
    phaseResolutionStatusesAfterUndo[command.afterCursor.participantId] = {
      ...phaseResolutionStatusesAfterUndo[command.afterCursor.participantId],
      [phase]: undefined,
    };
  }

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: nextSubstep,
    },
    phaseResolutionStatuses: phaseResolutionStatusesAfterUndo,
    participants: normalized.participants.map((participant) =>
      participant.participantId === participantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [actionStep]: "pending",
              [parryStep]: "pending",
              [damageStep]: "pending",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId,
      roundNumber: normalized.roundNumber,
      snapshots: normalized.stepSnapshots,
      step: actionStep,
    }),
  };
}

function undoCombatRoundParryCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "roll_parry"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);
  const attackResultId =
    typeof command.facts.attackResultId === "string" ? command.facts.attackResultId : undefined;

  if (!phase || !attackResultId) {
    return undefined;
  }

  const attackResult = getCombatRoundAttackResultById({
    attackResultId,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult,
    state: normalized,
  });
  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const parryStep = getCombatRoundParryReviewStepForPhase(phase);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "parry",
    },
    phaseResolutionResults: resolution
      ? normalized.phaseResolutionResults.map((result) =>
          result.attackResultId === attackResultId
            ? resetCombatRoundParryForAttackResult({
                attackResult,
                resolution: result,
                updatedAt: attackResult.rolledAt,
              })
            : result,
        )
      : normalized.phaseResolutionResults,
    phaseResolutionStatuses: {
      ...normalized.phaseResolutionStatuses,
      [attackResult.attackerParticipantId]: {
        ...normalized.phaseResolutionStatuses[attackResult.attackerParticipantId],
        [phase]: {
          substep: "parry",
          updatedAt: attackResult.rolledAt,
        },
      },
    },
    participants: normalized.participants.map((participant) =>
      participant.participantId === attackResult.defenderParticipantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [parryStep]: "pending",
              [damageStep]: "pending",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId,
      roundNumber: normalized.roundNumber,
      selectedAttackResult: attackResult,
      snapshots: normalized.stepSnapshots,
      step: parryStep,
    }),
  };
}

function undoCombatRoundDamageReviewCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    (command.type !== "complete_damage_review_phase1" &&
      command.type !== "complete_damage_review_phase2")
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);
  const attackResultId =
    typeof command.facts.attackResultId === "string" ? command.facts.attackResultId : undefined;

  if (!phase || !attackResultId) {
    return undefined;
  }

  const attackResult = getCombatRoundAttackResultById({
    attackResultId,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult,
    state: normalized,
  });
  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);
  const phaseResolutionStatusesAfterUndo: CombatRoundPhaseResolutionStatuses = {
    ...normalized.phaseResolutionStatuses,
    [attackResult.attackerParticipantId]: {
      ...normalized.phaseResolutionStatuses[attackResult.attackerParticipantId],
      [phase]: {
        substep: "damage",
        updatedAt: attackResult.rolledAt,
      },
    },
  };

  if (
    command.afterCursor.participantId &&
    command.afterCursor.participantId !== attackResult.attackerParticipantId
  ) {
    phaseResolutionStatusesAfterUndo[command.afterCursor.participantId] = {
      ...phaseResolutionStatusesAfterUndo[command.afterCursor.participantId],
      [phase]: undefined,
    };
  }

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "damage",
    },
    phaseResolutionResults: resolution
      ? normalized.phaseResolutionResults.map((result) =>
          result.attackResultId === attackResultId
            ? resetCombatRoundDamageForAttackResult({
                attackResult,
                resolution: result,
                updatedAt: attackResult.rolledAt,
              })
            : result,
        )
      : normalized.phaseResolutionResults,
    phaseResolutionStatuses: phaseResolutionStatusesAfterUndo,
    participants: normalized.participants.map((participant) =>
      participant.participantId === attackResult.defenderParticipantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [damageStep]: "pending",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId,
      roundNumber: normalized.roundNumber,
      selectedAttackResult: attackResult,
      snapshots: normalized.stepSnapshots,
      step: damageStep,
    }),
  };
}

function undoCombatRoundResolvedDamageCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (
    !command ||
    command.roundNumber !== normalized.roundNumber ||
    command.type !== "resolve_damage"
  ) {
    return undefined;
  }

  const phase = getCombatRoundAttackCommandPhase(command);
  const attackResultId =
    typeof command.facts.attackResultId === "string" ? command.facts.attackResultId : undefined;

  if (!phase || !attackResultId) {
    return undefined;
  }

  const attackResult = getCombatRoundAttackResultById({
    attackResultId,
    state: normalized,
  });

  if (!attackResult) {
    return undefined;
  }

  const resolution = getCombatRoundPhaseResolutionResultForAttack({
    attackResult,
    state: normalized,
  });
  const participantId = command.beforeCursor.participantId ?? command.participantId;
  const selectedStep = getCombatRoundStepForCursorStep(command.beforeCursor.step);
  const damageStep = getCombatRoundDamageReviewStepForPhase(phase);
  const phaseResolutionStatusesAfterUndo: CombatRoundPhaseResolutionStatuses = {
    ...normalized.phaseResolutionStatuses,
    [attackResult.attackerParticipantId]: {
      ...normalized.phaseResolutionStatuses[attackResult.attackerParticipantId],
      [phase]: {
        substep: "damage",
        updatedAt: attackResult.rolledAt,
      },
    },
  };

  if (
    command.afterCursor.participantId &&
    command.afterCursor.participantId !== attackResult.attackerParticipantId
  ) {
    phaseResolutionStatusesAfterUndo[command.afterCursor.participantId] = {
      ...phaseResolutionStatusesAfterUndo[command.afterCursor.participantId],
      [phase]: undefined,
    };
  }

  return {
    ...normalized,
    commands: normalized.commands.filter((_, index) => index !== input.commandIndex),
    currentCursor: command.beforeCursor,
    currentStep: selectedStep,
    phaseResolutionCursor: {
      participantId,
      phase,
      substep: "damage",
    },
    phaseResolutionResults: resolution
      ? normalized.phaseResolutionResults.map((result) =>
          result.attackResultId === attackResultId
            ? resetCombatRoundDamageForAttackResult({
                attackResult,
                resolution: result,
                updatedAt: attackResult.rolledAt,
              })
            : result,
        )
      : normalized.phaseResolutionResults,
    phaseResolutionStatuses: phaseResolutionStatusesAfterUndo,
    participants: normalized.participants.map((participant) =>
      participant.participantId === attackResult.defenderParticipantId
        ? {
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              [damageStep]: "pending",
            },
          }
        : participant,
    ),
    selectedParticipantId: participantId,
    selectedStep,
    stepSnapshots: clearSnapshotsForCombatRoundStep({
      participantId,
      roundNumber: normalized.roundNumber,
      selectedAttackResult: attackResult,
      snapshots: normalized.stepSnapshots,
      step: damageStep,
    }),
  };
}

export function undoLatestCombatRoundGlobalCommand(input: {
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandIndex = getLatestCombatRoundGlobalCommandIndex({
    roundNumber: normalized.roundNumber,
    state: normalized,
  });

  return undoCombatRoundGlobalCommandAtIndex({
    commandIndex,
    state: normalized,
  });
}

function undoCombatRoundCommandAtIndex(input: {
  commandIndex: number;
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const command = normalized.commands[input.commandIndex];

  if (!command) {
    return undefined;
  }

  if (command.type === "roll_attack") {
    return undoCombatRoundAttackCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "skip_phase_action") {
    return undoCombatRoundPhaseActionSkipCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "roll_parry") {
    return undoCombatRoundParryCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (
    command.type === "complete_damage_review_phase1" ||
    command.type === "complete_damage_review_phase2"
  ) {
    return undoCombatRoundDamageReviewCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  if (command.type === "resolve_damage") {
    return undoCombatRoundResolvedDamageCommandAtIndex({
      commandIndex: input.commandIndex,
      state: normalized,
    });
  }

  return undoCombatRoundGlobalCommandAtIndex({
    commandIndex: input.commandIndex,
    state: normalized,
  });
}

export function undoLatestCombatRoundCommand(input: {
  state: CombatRoundState;
}): CombatRoundState | undefined {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandIndex = getLatestCombatRoundUndoableCommandIndex({
    roundNumber: normalized.roundNumber,
    state: normalized,
  });

  return undoCombatRoundCommandAtIndex({
    commandIndex,
    state: normalized,
  });
}

function combatRoundSelectedStepHasClearableState(input: {
  state: CombatRoundState;
  step: CombatRoundStep;
}): boolean {
  const normalized = combatRoundStateSchema.parse(input.state);
  const selectedParticipant = normalized.participants.find(
    (participant) => participant.participantId === normalized.selectedParticipantId,
  );

  if (!selectedParticipant) {
    return false;
  }

  const status = selectedParticipant.stepStatuses[input.step] ?? "pending";
  const hasNonPendingStatus = status !== "pending";
  const phase =
    getCombatRoundAttackPhaseForStep(input.step) ??
    getCombatRoundResolutionPhaseForStep(input.step);

  if (!phase) {
    if (input.step === "select_actions") {
      return Boolean(selectedParticipant.declaration) || hasNonPendingStatus;
    }

    if (input.step === "initiative_phase_1") {
      return Boolean(selectedParticipant.initiatives.phase1) || hasNonPendingStatus;
    }

    if (input.step === "initiative_phase_2") {
      return Boolean(selectedParticipant.initiatives.phase2) || hasNonPendingStatus;
    }

    return hasNonPendingStatus;
  }

  const actionStep = getCombatRoundPhaseActionStepForPhase(phase);

  if (input.step === actionStep) {
    return (
      Boolean(
        getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: selectedParticipant.participantId,
          phase,
          state: normalized,
        }),
      ) ||
      Boolean(
        getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: selectedParticipant.participantId,
          phase,
          state: normalized,
        }),
      ) || hasNonPendingStatus
    );
  }

  return (
    Boolean(
      getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
        participantId: selectedParticipant.participantId,
        phase,
        state: normalized,
      }),
    ) || hasNonPendingStatus
  );
}

export function clearCombatRoundStep(input: {
  state: CombatRoundState;
  step: CombatRoundStep;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);
  const commandUndoneState = undoLatestCombatRoundCommand({ state: normalized });

  if (commandUndoneState) {
    return commandUndoneState;
  }

  if (combatRoundSelectedStepHasClearableState({ state: normalized, step: input.step })) {
    return clearCombatRoundStepLegacy({ state: normalized, step: input.step });
  }

  return normalized;
}

export function clearCurrentCombatRoundStepAndRewind(state: CombatRoundState): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(state);
  const commandIndex = getLatestCombatRoundUndoableCommandIndex({
    roundNumber: normalized.roundNumber,
    state: normalized,
  });
  const clearedState = clearCombatRoundStep({
    state: normalized,
    step: normalized.currentStep,
  });

  if (commandIndex >= 0) {
    return clearedState;
  }

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
