import { z } from "zod";

import type { CombatProgressionTask } from "./combatProgressionProjection";
import { combatObservationManualReviewReasonSchema } from "./combatObservation";
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

export const combatStepAutomationProcessFamilySchema = z.union([
  combatParticipationProcessFamilySchema,
  z.literal("ordinary_distance_roll"),
]);
export type CombatStepAutomationProcessFamily = z.infer<
  typeof combatStepAutomationProcessFamilySchema
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
  "distance_calculation_review_required",
  "distance_review_required",
  "roll_not_eligible",
  "safety_limit_reached",
  "persistence_failure",
]);
export type CombatStepAutomationStopReason = z.infer<typeof combatStepAutomationStopReasonSchema>;

/**
 * #948. Observation automation is NPC batch processing, so a participant whose required
 * Observation basis cannot be derived is skipped and the batch continues. A skip resolves
 * nothing: the task is left for manual adjudication, and no basis is manufactured for it.
 * Each reason names a distinct derivation failure so the GM report can state it.
 *
 * The members live with the Observe rule in `combatObservation.ts`, because the persisted
 * manual-review marker records the same reason. One vocabulary, two readers.
 */
export const combatStepAutomationSkipReasonSchema = combatObservationManualReviewReasonSchema;
export type CombatStepAutomationSkipReason = z.infer<typeof combatStepAutomationSkipReasonSchema>;

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

/**
 * One participant the run passed over without resolving. `missingData` names the required data
 * found absent, so the GM report can say which datum is missing rather than only that one is.
 */
export const combatStepAutomationSkippedTaskSchema = z.object({
  missingData: z.array(z.string().min(1)).readonly().default([]),
  participantId: z.string().min(1).optional(),
  reason: combatStepAutomationSkipReasonSchema,
  task: combatStepAutomationTaskRecordSchema,
});
export type CombatStepAutomationSkippedTask = z.infer<typeof combatStepAutomationSkippedTaskSchema>;

export const combatStepAutomationCommandLinkSchema = z.object({
  countsTowardProcessed: z.boolean(),
  executionGroupId: z.string().min(1),
  operationFamily: combatStepAutomationOperationFamilySchema,
  runId: z.string().min(1),
  schemaVersion: z.literal(CANONICAL_COMBAT_STEP_AUTOMATION_SCHEMA_VERSION),
  startProcessFamily: combatStepAutomationProcessFamilySchema.optional(),
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
  startProcessFamily: combatStepAutomationProcessFamilySchema.optional(),
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
  skippedTasks: z.array(combatStepAutomationSkippedTaskSchema).readonly().default([]),
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
  | {
      readonly kind: "skip";
      /**
       * #948. A stable identity for the work being passed over, used to report it once. A
       * projected task id is not stable across a skip: it carries the boundary kind and the stage,
       * both of which change as the round progresses, so the same Observe attempt is presented
       * under a second id and would otherwise be reported twice in one run. The classifier knows
       * the durable identity — the Observe attempt id — and supplies it here. Omitted, the task id
       * is used.
       */
      readonly key?: string;
      readonly missingData?: readonly string[];
      readonly reason: CombatStepAutomationSkipReason;
    }
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
  if (identity.startProcessFamily === "ordinary_distance_roll") {
    return task.kind === "distance_roll";
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
  /**
   * #948. Durably records that this task was set aside, and returns the projection that follows.
   * Without it a skip is remembered only for the length of this run, so the task it passed over
   * still blocks its owner's progression and the participants after it never become executable —
   * which is exactly the behaviour the ruling of 2026-11-05 replaced. A caller that cannot
   * persist omits it or returns the projection it was given, and the run degrades to that
   * blocking behaviour rather than continuing on an unrecorded skip.
   */
  readonly recordSkip?: (input: {
    readonly missingData: readonly string[];
    readonly projection: CombatStepAutomationProjection<State>;
    readonly reason: CombatStepAutomationSkipReason;
    readonly task: CombatProgressionTask;
  }) => Promise<CombatStepAutomationProjection<State>>;
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
  const skippedTasks: CombatStepAutomationSkippedTask[] = [];
  const skippedTaskIds = new Set<string>();
  const skippedKeys = new Set<string>();
  let processedCount = 0;
  let current = input.initial;

  const outsideScope = () =>
    !isCombatStepAutomationProjectionWithinScope({ identity, projection: current });

  /**
   * #948. A skipped task stays in the projection because nothing resolved it, so the next task is
   * the first one this run has not already passed over. Order independence comes from here: the
   * skip is identified by task id rather than by position.
   */
  const nextTask = () => current.tasks.find((candidate) => !skippedTaskIds.has(candidate.id));

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
      skippedTasks,
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
    const task = nextTask();
    if (!task) return finish("end_of_step");

    const decision = input.classify({ projection: current, task });
    if (decision.kind === "skip") {
      skippedTaskIds.add(task.id);
      const skipKey = decision.key ?? task.id;
      // Report and record the same work once, however many projected task ids it is presented
      // under while the round moves on around it.
      if (skippedKeys.has(skipKey)) continue;
      skippedKeys.add(skipKey);
      const record = taskRecord(task);
      const missingData = decision.missingData ?? [];
      attemptedTasks.push(record);
      skippedTasks.push(
        combatStepAutomationSkippedTaskSchema.parse({
          missingData,
          participantId: record.participantId,
          reason: decision.reason,
          task: record,
        }),
      );
      if (input.recordSkip) {
        current = await input.recordSkip({
          missingData,
          projection: current,
          reason: decision.reason,
          task,
        });
      }
      continue;
    }
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

  return finish("safety_limit_reached", nextTask());
}
