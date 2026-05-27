import { z } from "zod";

import { scenarioParticipantCombatContextSchema } from "../campaign/scenario";
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
  rolls: z.array(z.number().int().min(1).max(6)).default([]),
  total: z.number().int(),
});
const legacyCombatRoundInitiativeResultSchema = z
  .number()
  .int()
  .transform((total) => ({ rolls: [], total }));

export const combatRoundInitiativesSchema = z.object({
  phase1: z
    .union([combatRoundInitiativeResultSchema, legacyCombatRoundInitiativeResultSchema])
    .optional(),
  phase2: z
    .union([combatRoundInitiativeResultSchema, legacyCombatRoundInitiativeResultSchema])
    .optional(),
});

export const combatRoundDeclarationSchema = z.object({
  actionId: idSchema.optional(),
  additionalActionNotes: z.string().optional(),
  combatContext: scenarioParticipantCombatContextSchema.optional(),
  movementId: z.string().min(1).optional(),
  roundNumber: z.number().int().positive(),
  secondaryActionId: idSchema.optional(),
  submittedAt: z.string().datetime().optional(),
  submittedBy: z.enum(["gm", "player"]),
  submittedByUserId: idSchema.optional(),
});

const combatRoundStepStatusesSchema = z.record(combatRoundStepSchema, combatRoundStepStatusSchema);

export const combatRoundParticipantStateSchema = z.object({
  declaration: combatRoundDeclarationSchema.optional(),
  initiatives: combatRoundInitiativesSchema.default({}),
  label: z.string().min(1),
  participantId: idSchema,
  stepStatuses: combatRoundStepStatusesSchema.default(
    Object.fromEntries(COMBAT_ROUND_STEPS.map((step) => [step, "pending"])),
  ),
});

export const combatRoundStateSchema = z.object({
  activeParticipantId: idSchema.optional(),
  currentStep: combatRoundStepSchema.default("select_actions"),
  participants: z.array(combatRoundParticipantStateSchema).default([]),
  roundNumber: z.number().int().positive().default(1),
  selectedParticipantId: idSchema.optional(),
  selectedStep: combatRoundStepSchema.optional(),
});

export type CombatRoundStepStatus = z.infer<typeof combatRoundStepStatusSchema>;
export type CombatRoundDeclaration = z.infer<typeof combatRoundDeclarationSchema>;
export type CombatRoundInitiativeResult = z.infer<typeof combatRoundInitiativeResultSchema>;
export type CombatRoundInitiatives = z.infer<typeof combatRoundInitiativesSchema>;
export type CombatRoundParticipantState = z.infer<typeof combatRoundParticipantStateSchema>;
export type CombatRoundState = z.infer<typeof combatRoundStateSchema>;

export function rollOpenEndedD6(input: {
  maxRolls?: number;
  randomFn?: () => number;
} = {}): CombatRoundInitiativeResult & { isOpenEnded: boolean } {
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
    isOpenEnded: rolls.length > 1,
    rolls,
    total: rolls.reduce((sum, roll) => sum + roll, 0),
  };
}

function normalizeCombatRoundInitiativeResult(
  initiative: CombatRoundInitiativeResult | number | undefined,
): CombatRoundInitiativeResult | undefined {
  if (initiative === undefined) {
    return undefined;
  }

  return combatRoundInitiativeResultSchema.parse(
    typeof initiative === "number" ? { rolls: [], total: initiative } : initiative,
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

function participantStateFromEncounterParticipant(input: {
  existing?: CombatRoundParticipantState;
  participant: EncounterParticipant;
}): CombatRoundParticipantState {
  return {
    declaration: input.existing?.declaration,
    initiatives: input.existing?.initiatives ?? {},
    label: input.participant.label,
    participantId: input.participant.id,
    stepStatuses: mergeStepStatuses(input.existing?.stepStatuses),
  };
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
    participants,
    roundNumber: existing?.roundNumber ?? input.encounter.currentRound,
    selectedParticipantId,
    selectedStep: existing?.selectedStep ?? existing?.currentStep ?? "select_actions",
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

export function advanceCombatRoundStep(state: CombatRoundState): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(state);
  const nextStep = getNextCombatRoundStep(normalized.currentStep);
  const startsNextRound = normalized.currentStep === "round_summary";
  const advancesDeclarationStep = normalized.currentStep === "select_actions";

  return {
    ...normalized,
    activeParticipantId: startsNextRound ? undefined : normalized.activeParticipantId,
    currentStep: nextStep,
    participants: normalized.participants.map((participant) => ({
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
    roundNumber: startsNextRound ? normalized.roundNumber + 1 : normalized.roundNumber,
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

  return {
    ...normalized,
    participants: normalized.participants.map((participant) => {
      const nextInitiatives = { ...participant.initiatives };

      if (input.step === "initiative_phase_1") {
        delete nextInitiatives.phase1;
      }

      if (input.step === "initiative_phase_2") {
        delete nextInitiatives.phase2;
      }

      return {
        ...participant,
        declaration: input.step === "select_actions" ? undefined : participant.declaration,
        initiatives: nextInitiatives,
        stepStatuses: {
          ...participant.stepStatuses,
          [input.step]: "pending",
        },
      };
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
  const sortedParticipants = sortCombatRoundParticipantsByInitiative(input);
  const positions: Record<string, number> = {};
  let nextPosition = 1;

  for (const participant of sortedParticipants) {
    if (getCombatRoundInitiativeTotal(participant.initiatives[input.phase]) === undefined) {
      continue;
    }

    positions[participant.participantId] = nextPosition;
    nextPosition += 1;
  }

  return positions;
}

export function buildCombatRoundInspector(input: {
  participantId?: string;
  state: CombatRoundState;
  step?: CombatRoundStep;
}): {
  participant?: CombatRoundParticipantState;
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
    status: participant?.stepStatuses[step],
    step,
  };
}
