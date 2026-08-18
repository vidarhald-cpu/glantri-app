import { z } from "zod";

import { scenarioParticipantSchema, type ScenarioParticipant } from "../campaign/scenario";
import { buildCombatProgressionProjection } from "./combatProgressionProjection";
import { getCurrentExecutableCombatTasks } from "./combatDeterministicTransitions";
import {
  activeCombatRoundStateSchema,
  buildCombatRoundCommandEnvelope,
  combatRoundCursorSchema,
  combatRoundStepSchema,
  type ActiveCombatRoundState,
  type CombatRoundCommandEnvelope,
} from "./combatRoundManager";
import type { EncounterSession } from "./session";

const idSchema = z.string().min(1);
const MAX_COMBAT_MUTATION_PRESENTATION_BYTES = 64 * 1024;

const combatRoundCommandEnvelopeCurrentTaskSchema = z
  .object({
    cursorStep: combatRoundCursorSchema.shape.step,
    participantId: idSchema.optional(),
    roundNumber: z.number().int().positive(),
    step: combatRoundStepSchema,
  })
  .strict();

const combatRoundCommandEnvelopeLatestEventSchema = z
  .object({
    commandId: idSchema.optional(),
    details: z.string().optional(),
    phase: z.enum(["phase1", "phase2"]).optional(),
    resultId: idSchema.optional(),
    roundNumber: z.number().int().positive(),
    shortTitle: z.string(),
    step: combatRoundCursorSchema.shape.step.optional(),
    summaryText: z.string(),
  })
  .strict();

const combatRoundCommandEnvelopeLatestResultSchema = z
  .object({
    attackResultId: idSchema.optional(),
    attackerParticipantId: idSchema.optional(),
    defenderParticipantId: idSchema.optional(),
    kind: z.enum(["attack", "parry", "phase_initiative_commit"]),
    parryResultId: idSchema.optional(),
    phase: z.enum(["phase1", "phase2"]).optional(),
  })
  .strict();

export const combatRoundCommandEnvelopeSchema: z.ZodType<
  CombatRoundCommandEnvelope,
  z.ZodTypeDef,
  unknown
> = z
  .object({
    currentCursor: combatRoundCursorSchema.optional(),
    currentStep: combatRoundStepSchema,
    currentTask: combatRoundCommandEnvelopeCurrentTaskSchema.optional(),
    latestEvent: combatRoundCommandEnvelopeLatestEventSchema.optional(),
    latestResult: combatRoundCommandEnvelopeLatestResultSchema.optional(),
    warnings: z.array(z.string()),
  })
  .strict();

export const activeCombatMutationNextTaskSchema = z
  .object({
    executionGroupId: idSchema,
    expectedCommand: z.string().min(1),
    kind: z.string().min(1),
    participantId: idSchema.optional(),
    phase: z.enum(["phase1", "phase2"]).optional(),
    processId: idSchema,
    stageId: idSchema,
    taskId: idSchema,
  })
  .strict();

export const activeCombatDeterministicAdvanceDescriptorSchema = z
  .object({
    executionGroupId: idSchema,
    expectedRevision: z.string().min(1),
    taskId: idSchema,
  })
  .strict();

export const activeCombatMutationResponseSchema = z
  .object({
    activeCombatState: activeCombatRoundStateSchema,
    commandEnvelope: combatRoundCommandEnvelopeSchema,
    deterministicAdvance: activeCombatDeterministicAdvanceDescriptorSchema.optional(),
    encounterId: idSchema,
    mutationPresentation: z
      .record(z.unknown())
      .refine(
        (presentation) =>
          new TextEncoder().encode(JSON.stringify(presentation)).byteLength <=
          MAX_COMBAT_MUTATION_PRESENTATION_BYTES,
        "Combat mutation presentation must remain compact.",
      )
      .optional(),
    nextTask: activeCombatMutationNextTaskSchema.optional(),
    revision: z.string().min(1),
    storageMode: z.enum(["legacy", "split_v1"]).optional(),
    updatedParticipants: z.array(scenarioParticipantSchema).optional(),
    version: z.literal(1),
  })
  .strict();

export type ActiveCombatMutationNextTask = z.infer<typeof activeCombatMutationNextTaskSchema>;
export type ActiveCombatDeterministicAdvanceDescriptor = z.infer<
  typeof activeCombatDeterministicAdvanceDescriptorSchema
>;
export type ActiveCombatMutationResponse = z.infer<typeof activeCombatMutationResponseSchema>;

type ActiveCombatMutationEncounterSource = Pick<
  EncounterSession,
  "combatRoundState" | "id" | "updatedAt"
>;

function activeStateFromEncounter(
  encounter: ActiveCombatMutationEncounterSource,
): ActiveCombatRoundState {
  if (!encounter.combatRoundState) {
    throw new Error("Active combat mutation response requires active combat state.");
  }
  const { rounds: _archivedRounds, ...activeCombatState } = encounter.combatRoundState;
  return activeCombatRoundStateSchema.parse(activeCombatState);
}

function findNextTask(
  activeCombatState: ActiveCombatRoundState,
): ActiveCombatMutationNextTask | undefined {
  const projection = buildCombatProgressionProjection({
    ...activeCombatState,
    rounds: [],
  });
  const task = getCurrentExecutableCombatTasks(projection)[0];

  return task
    ? activeCombatMutationNextTaskSchema.parse({
        executionGroupId: task.executionGroupId,
        expectedCommand: task.expectedCommand,
        kind: task.kind,
        participantId: task.identity.participantId,
        phase: task.identity.phase,
        processId: task.processId,
        stageId: task.stageId,
        taskId: task.id,
      })
    : undefined;
}

export function buildActiveCombatMutationResponse(input: {
  commandEnvelope?: CombatRoundCommandEnvelope;
  deterministicAdvance?: ActiveCombatDeterministicAdvanceDescriptor;
  encounter: ActiveCombatMutationEncounterSource;
  mutationPresentation?: Record<string, unknown>;
  storageMode?: "legacy" | "split_v1";
  updatedParticipants?: ScenarioParticipant[];
}): ActiveCombatMutationResponse {
  const activeCombatState = activeStateFromEncounter(input.encounter);
  const commandEnvelope =
    input.commandEnvelope ??
    buildCombatRoundCommandEnvelope({
      state: { ...activeCombatState, rounds: [] },
    });

  return activeCombatMutationResponseSchema.parse({
    activeCombatState,
    commandEnvelope,
    deterministicAdvance: input.deterministicAdvance,
    encounterId: input.encounter.id,
    mutationPresentation: input.mutationPresentation,
    nextTask: findNextTask(activeCombatState),
    revision: input.encounter.updatedAt,
    storageMode: input.storageMode,
    updatedParticipants: input.updatedParticipants,
    version: 1,
  });
}

/**
 * Replaces revision-bound active state while retaining separately loaded immutable history and
 * non-combat encounter metadata.
 */
export function applyActiveCombatMutationResponse(input: {
  currentEncounter: EncounterSession;
  response: ActiveCombatMutationResponse;
}): EncounterSession {
  if (input.currentEncounter.id !== input.response.encounterId) {
    throw new Error("Combat mutation response belongs to a different encounter.");
  }

  return {
    ...input.currentEncounter,
    combatRoundState: {
      ...input.response.activeCombatState,
      rounds: input.currentEncounter.combatRoundState?.rounds ?? [],
    },
    currentRound: input.response.activeCombatState.roundNumber,
    updatedAt: input.response.revision,
  };
}
