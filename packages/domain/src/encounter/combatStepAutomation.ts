import { z } from "zod";

import type { CombatProgressionTask } from "./combatProgressionProjection";
import { combatParticipationProcessFamilySchema } from "./combatParticipation/types";
import { combatRoundStepSchema } from "./combatRoundStep";

export const CANONICAL_COMBAT_STEP_AUTOMATION_SCHEMA_VERSION = 1 as const;
export const DEFAULT_COMBAT_STEP_AUTOMATION_LIMIT = 32;
export const MAX_COMBAT_STEP_AUTOMATION_LIMIT = 64;

export const combatStepAutomationOperationFamilySchema = z.enum([
  "roll_remaining",
  "accept_remaining",
  "commit_remaining",
]);
export type CombatStepAutomationOperationFamily = z.infer<
  typeof combatStepAutomationOperationFamilySchema
>;

export const combatStepAutomationStopReasonSchema = z.enum([
  "end_of_step",
  "player_action_required",
  "gm_decision_required",
  "warning_requires_acknowledgement",
  "invalid_proposal",
  "target_invalid",
  "participant_not_gm_controlled",
  "stale_revision",
  "task_changed",
  "unsupported_task",
  "incomplete_legacy_state",
  "hidden_choice",
  "modifier_review_required",
  "declaration_review_required",
  "combat_experience_review_required",
  "effect_review_required",
  "observation_review_required",
  "continued_contact_review_required",
  "distance_decision_required",
  "roll_not_eligible",
  "safety_limit_reached",
  "persistence_failure",
]);
export type CombatStepAutomationStopReason = z.infer<typeof combatStepAutomationStopReasonSchema>;

export const combatStepAutomationStartRequestSchema = z.object({
  encounterId: z.string().min(1),
  expectedExecutionGroupId: z.string().min(1),
  expectedProcessId: z.string().min(1),
  expectedRevision: z.string().min(1),
  expectedRound: z.number().int().positive(),
  expectedStep: combatRoundStepSchema,
  expectedTaskId: z.string().min(1),
  operationFamily: combatStepAutomationOperationFamilySchema,
  runId: z.string().min(1).max(160),
  schemaVersion: z.literal(CANONICAL_COMBAT_STEP_AUTOMATION_SCHEMA_VERSION),
});
export type CombatStepAutomationStartRequest = z.infer<
  typeof combatStepAutomationStartRequestSchema
>;

export const combatStepAutomationTaskRecordSchema = z.object({
  commandId: z.string().min(1).optional(),
  executionGroupId: z.string().min(1),
  kind: z.string().min(1),
  participantId: z.string().min(1).optional(),
  taskId: z.string().min(1),
});
export type CombatStepAutomationTaskRecord = z.infer<typeof combatStepAutomationTaskRecordSchema>;

export const combatStepAutomationCommandLinkSchema = z.object({
  countsTowardProcessed: z.boolean(),
  executionGroupId: z.string().min(1),
  operationFamily: combatStepAutomationOperationFamilySchema,
  runId: z.string().min(1),
  schemaVersion: z.literal(CANONICAL_COMBAT_STEP_AUTOMATION_SCHEMA_VERSION),
  startProcessFamily: combatParticipationProcessFamilySchema.optional(),
  startingSequence: z.number().int().nonnegative(),
  startingRevision: z.string().min(1),
  taskId: z.string().min(1),
});
export type CombatStepAutomationCommandLink = z.infer<typeof combatStepAutomationCommandLinkSchema>;

export const combatStepAutomationRunIdentitySchema = z.object({
  encounterId: z.string().min(1),
  gmActorUserId: z.string().min(1),
  operationFamily: combatStepAutomationOperationFamilySchema,
  runId: z.string().min(1),
  schemaVersion: z.literal(CANONICAL_COMBAT_STEP_AUTOMATION_SCHEMA_VERSION),
  startExecutionGroupId: z.string().min(1),
  /** Optional for v1 compatibility; new runs use it as an exact process-level fence. */
  startProcessId: z.string().min(1).optional(),
  /** Optional for v1 compatibility; process-family consumers use it for bounded closure work. */
  startProcessFamily: combatParticipationProcessFamilySchema.optional(),
  startingRevision: z.string().min(1),
  startingRound: z.number().int().positive(),
  startingSequence: z.number().int().nonnegative(),
  startingStep: combatRoundStepSchema,
  startTaskId: z.string().min(1),
});
export type CombatStepAutomationRunIdentity = z.infer<typeof combatStepAutomationRunIdentitySchema>;

export const combatStepAutomationRunResultSchema = z.object({
  acceptedTasks: z.array(combatStepAutomationTaskRecordSchema).readonly(),
  alreadyAccepted: z.boolean().default(false),
  attemptedTasks: z.array(combatStepAutomationTaskRecordSchema).readonly(),
  finalRevision: z.string().min(1),
  finalTask: combatStepAutomationTaskRecordSchema.optional(),
  identity: combatStepAutomationRunIdentitySchema,
  processedCount: z.number().int().nonnegative(),
  stepComplete: z.boolean(),
  stopParticipantId: z.string().min(1).optional(),
  stopReason: combatStepAutomationStopReasonSchema,
  stopTask: combatStepAutomationTaskRecordSchema.optional(),
});
export type CombatStepAutomationRunResult = z.infer<typeof combatStepAutomationRunResultSchema>;

export interface CombatStepAutomationProjection<State> {
  readonly revision: string;
  readonly roundNumber: number;
  readonly state: State;
  readonly step: z.infer<typeof combatRoundStepSchema>;
  readonly tasks: readonly CombatProgressionTask[];
}

export type CombatStepAutomationTaskDecision =
  | { readonly kind: "execute"; readonly countsTowardProcessed: boolean }
  | { readonly kind: "stop"; readonly reason: CombatStepAutomationStopReason };

export type CombatStepAutomationExecution<State> =
  | {
      readonly kind: "accepted";
      readonly projection: CombatStepAutomationProjection<State>;
    }
  | {
      readonly kind: "stopped";
      readonly projection: CombatStepAutomationProjection<State>;
      readonly reason: CombatStepAutomationStopReason;
    };

function taskRecord(
  task: CombatProgressionTask,
  commandId?: string,
): CombatStepAutomationTaskRecord {
  return combatStepAutomationTaskRecordSchema.parse({
    commandId,
    executionGroupId: task.executionGroupId,
    kind: task.kind,
    participantId:
      task.owner?.kind === "combatant" ? task.owner.participantId : task.identity.participantId,
    taskId: task.id,
  });
}

export function getCombatStepAutomationCommandPrefix(
  identity: Pick<CombatStepAutomationRunIdentity, "operationFamily" | "runId" | "startingRevision">,
): string {
  return `combat-step-automation-v1:${identity.runId}:${identity.startingRevision}:${identity.operationFamily}:`;
}

export function isCombatStepAutomationProjectionWithinScope<State>(input: {
  identity: CombatStepAutomationRunIdentity;
  projection: CombatStepAutomationProjection<State>;
}): boolean {
  const { identity, projection } = input;
  if (
    projection.roundNumber !== identity.startingRound ||
    projection.step !== identity.startingStep
  ) {
    return false;
  }
  const task = projection.tasks[0];
  if (!task) return false;
  if (identity.startProcessFamily === "health_bleed") {
    return task.kind === "health_review" || task.kind === "effect_review";
  }
  if (identity.startProcessFamily === "observation") {
    return task.kind === "observation_roll";
  }
  if (identity.startProcessFamily === "continued_contact") {
    return task.kind === "continued_contact_maintenance_roll";
  }
  return identity.startProcessId === undefined || task.processId === identity.startProcessId;
}

/**
 * Runs one finite, contiguous prefix of canonical tasks. The scheduler owns ordering and the
 * starting-step fence; callers own authorization, canonical command execution, and persistence.
 */
export async function runCombatStepAutomation<State>(input: {
  readonly classify: (input: {
    readonly projection: CombatStepAutomationProjection<State>;
    readonly task: CombatProgressionTask;
  }) => CombatStepAutomationTaskDecision;
  readonly execute: (input: {
    readonly commandId: string;
    readonly projection: CombatStepAutomationProjection<State>;
    readonly task: CombatProgressionTask;
  }) => Promise<CombatStepAutomationExecution<State>>;
  readonly identity: CombatStepAutomationRunIdentity;
  readonly initial: CombatStepAutomationProjection<State>;
  readonly limit?: number;
}): Promise<
  CombatStepAutomationRunResult & { readonly final: CombatStepAutomationProjection<State> }
> {
  const identity = combatStepAutomationRunIdentitySchema.parse(input.identity);
  const limit = Math.min(
    MAX_COMBAT_STEP_AUTOMATION_LIMIT,
    Math.max(1, input.limit ?? DEFAULT_COMBAT_STEP_AUTOMATION_LIMIT),
  );
  const prefix = getCombatStepAutomationCommandPrefix(identity);
  const acceptedTasks: CombatStepAutomationTaskRecord[] = [];
  const attemptedTasks: CombatStepAutomationTaskRecord[] = [];
  let processedCount = 0;
  let current = input.initial;

  const outsideScope = () =>
    !isCombatStepAutomationProjectionWithinScope({ identity, projection: current });

  const finish = (stopReason: CombatStepAutomationStopReason, stopTask?: CombatProgressionTask) => {
    const finalTask = current.tasks[0];
    const stepComplete = outsideScope();
    const result = combatStepAutomationRunResultSchema.parse({
      acceptedTasks,
      attemptedTasks,
      finalRevision: current.revision,
      finalTask: finalTask ? taskRecord(finalTask) : undefined,
      identity,
      processedCount,
      stepComplete,
      stopParticipantId:
        stopTask?.owner?.kind === "combatant"
          ? stopTask.owner.participantId
          : stopTask?.identity.participantId,
      stopReason,
      stopTask: stopTask ? taskRecord(stopTask) : undefined,
    });
    return { ...result, final: current };
  };

  for (let index = 0; index < limit; index += 1) {
    if (outsideScope()) {
      return finish("end_of_step");
    }
    const task = current.tasks[0];
    if (!task) return finish("end_of_step");

    const decision = input.classify({ projection: current, task });
    attemptedTasks.push(taskRecord(task));
    if (decision.kind === "stop") return finish(decision.reason, task);

    const commandId = `${prefix}${index}:${task.id}`;
    const execution = await input.execute({ commandId, projection: current, task });
    if (execution.kind === "stopped") {
      current = execution.projection;
      return finish(execution.reason, task);
    }
    acceptedTasks.push(taskRecord(task, commandId));
    if (decision.countsTowardProcessed) processedCount += 1;
    current = execution.projection;
  }

  return finish("safety_limit_reached", current.tasks[0]);
}
