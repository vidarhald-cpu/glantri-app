import { z } from "zod";

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
  "round_summary",
]);

export const COMBAT_ROUND_STEPS = combatRoundStepSchema.options;

export const combatRoundStepStatusSchema = z.enum([
  "pending",
  "ready",
  "complete",
  "skipped",
]);

export const combatRoundInitiativesSchema = z.object({
  phase1: z.number().int().optional(),
  phase2: z.number().int().optional(),
});

const combatRoundStepStatusesSchema = z.record(
  combatRoundStepSchema,
  combatRoundStepStatusSchema,
);

export const combatRoundParticipantStateSchema = z.object({
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

export type CombatRoundStep = z.infer<typeof combatRoundStepSchema>;
export type CombatRoundStepStatus = z.infer<typeof combatRoundStepStatusSchema>;
export type CombatRoundInitiatives = z.infer<typeof combatRoundInitiativesSchema>;
export type CombatRoundParticipantState = z.infer<typeof combatRoundParticipantStateSchema>;
export type CombatRoundState = z.infer<typeof combatRoundStateSchema>;

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

export function advanceCombatRoundStep(state: CombatRoundState): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(state);
  const nextStep = getNextCombatRoundStep(normalized.currentStep);
  const startsNextRound = normalized.currentStep === "round_summary";

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
            [normalized.currentStep]: "complete",
          },
    })),
    roundNumber: startsNextRound ? normalized.roundNumber + 1 : normalized.roundNumber,
    selectedStep: nextStep,
  };
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
  initiative?: number;
  participantId: string;
  phase: "phase1" | "phase2";
  state: CombatRoundState;
}): CombatRoundState {
  const normalized = combatRoundStateSchema.parse(input.state);

  return {
    ...normalized,
    participants: normalized.participants.map((participant) =>
      participant.participantId === input.participantId
        ? {
            ...participant,
            initiatives: {
              ...participant.initiatives,
              [input.phase]: input.initiative,
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

  return [...normalized.participants].sort((left, right) => {
    const leftInitiative = left.initiatives[input.phase];
    const rightInitiative = right.initiatives[input.phase];

    if (leftInitiative !== undefined || rightInitiative !== undefined) {
      return (rightInitiative ?? Number.NEGATIVE_INFINITY) - (leftInitiative ?? Number.NEGATIVE_INFINITY);
    }

    return left.label.localeCompare(right.label);
  });
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
    normalized.participants.find((entry) => entry.participantId === normalized.selectedParticipantId) ??
    normalized.participants[0];

  return {
    participant,
    status: participant?.stepStatuses[step],
    step,
  };
}
