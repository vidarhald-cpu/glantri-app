import type { CombatParticipationProjection } from "./combatParticipation";
import type {
  CombatProgressionProjection,
  CombatProgressionTask,
} from "./combatProgressionProjection";

export const DEFAULT_COMBAT_DETERMINISTIC_TRANSITION_LIMIT = 32;
export const MAX_COMBAT_DETERMINISTIC_TRANSITION_LIMIT = 64;

export type CombatDeterministicTransitionStopReason =
  | "blocked_or_human_work"
  | "complete"
  | "invalid_deterministic_task"
  | "safety_limit";

export interface CombatDeterministicTransitionProjection<State> {
  readonly participation: CombatParticipationProjection;
  readonly progression: CombatProgressionProjection;
  readonly revision: string;
  readonly state: State;
}

export interface CombatDeterministicTransitionExecution<State> {
  readonly revision: string;
  readonly state: State;
}

export function getCurrentExecutableCombatTasks(
  projection: CombatProgressionProjection,
): readonly CombatProgressionTask[] {
  return projection.boundary.processes.flatMap((process) =>
    process.stages.flatMap((stage) =>
      stage.state !== "active"
        ? []
        : stage.executionGroups.flatMap((group) =>
            group.completionState === "complete"
              ? []
              : group.tasks.filter((task) => task.state === "executable"),
          ),
    ),
  );
}

export function isCompleteDeterministicCombatTask(task: CombatProgressionTask): boolean {
  return Boolean(
    task.participation &&
    task.participation.completeness === "complete" &&
    task.participation.status === "required" &&
    task.participation.workClass === "deterministic_transition",
  );
}

/**
 * Runs a finite authoritative suffix. The executor owns canonical mutation and persistence; this
 * scheduler never synthesizes state, retries a stale descriptor, or skips over non-deterministic
 * work.
 */
export async function runCombatDeterministicTransitionSuffix<State>(input: {
  readonly execute: (input: {
    readonly commandId: string;
    readonly projection: CombatDeterministicTransitionProjection<State>;
    readonly task: CombatProgressionTask;
  }) => Promise<CombatDeterministicTransitionExecution<State>>;
  readonly initial: CombatDeterministicTransitionProjection<State>;
  readonly limit?: number;
  readonly project: (
    execution: CombatDeterministicTransitionExecution<State>,
  ) =>
    | Promise<CombatDeterministicTransitionProjection<State>>
    | CombatDeterministicTransitionProjection<State>;
}): Promise<{
  readonly executedTaskIds: readonly string[];
  readonly final: CombatDeterministicTransitionProjection<State>;
  readonly stopReason: CombatDeterministicTransitionStopReason;
}> {
  const limit = Math.min(
    MAX_COMBAT_DETERMINISTIC_TRANSITION_LIMIT,
    Math.max(1, input.limit ?? DEFAULT_COMBAT_DETERMINISTIC_TRANSITION_LIMIT),
  );
  let current = input.initial;
  const executedTaskIds: string[] = [];
  const seenDescriptors = new Set<string>();

  for (let index = 0; index < limit; index += 1) {
    const tasks = getCurrentExecutableCombatTasks(current.progression);
    if (tasks.length === 0) {
      return { executedTaskIds, final: current, stopReason: "complete" };
    }
    const task = tasks[0]!;
    if (!isCompleteDeterministicCombatTask(task)) {
      return { executedTaskIds, final: current, stopReason: "blocked_or_human_work" };
    }
    const descriptorKey = `${current.revision}:${task.id}:${task.executionGroupId}`;
    if (seenDescriptors.has(descriptorKey)) {
      return { executedTaskIds, final: current, stopReason: "invalid_deterministic_task" };
    }
    seenDescriptors.add(descriptorKey);
    const executed = await input.execute({
      commandId: `combat-deterministic-v1:${descriptorKey}`,
      projection: current,
      task,
    });
    executedTaskIds.push(task.id);
    current = await input.project(executed);
  }

  return { executedTaskIds, final: current, stopReason: "safety_limit" };
}
