import {
  getCombatRoundStepForCursorStep,
  type CombatProgressionPresentationProjection,
  type CombatProgressionPresentationTask,
  type CombatProgressionTaskKind,
  type CombatRoundStep,
} from "@glantri/domain";

import type { CombatTrackerLiveFacet } from "../types";
import { buildCombatTrackerCellKey } from "./buildCombatTrackerModel";
import {
  buildCombatTrackerTaskHover,
  classifyCombatTrackerTaskAttention,
} from "./combatTrackerTaskPresentation";

export interface CombatProgressionTrackerIndex {
  readonly byCellKey: Readonly<Record<string, CombatTrackerLiveFacet>>;
  readonly conflicted: boolean;
  readonly currentStep?: CombatRoundStep;
  readonly currentTaskIds: readonly string[];
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function getCombatProgressionPresentationTasks(
  progression: CombatProgressionPresentationProjection | undefined,
): CombatProgressionPresentationTask[] {
  if (progression?.taskVisibility !== "available") return [];
  return (
    progression?.processes.flatMap((process) =>
      process.stages.flatMap((stage) => stage.executionGroups.flatMap((group) => group.tasks)),
    ) ?? []
  );
}

/** Builds one task/facet index per encounter revision; tracker cells only perform key lookups. */
export function buildCombatProgressionTrackerIndex(
  progression: CombatProgressionPresentationProjection | undefined,
): CombatProgressionTrackerIndex {
  if (!progression || progression.taskVisibility === "conflicted") {
    return {
      byCellKey: {},
      conflicted: progression?.taskVisibility === "conflicted",
      currentStep: undefined,
      currentTaskIds: [],
    };
  }

  const tasksByCellKey = new Map<string, CombatProgressionPresentationTask[]>();
  const currentTasks: CombatProgressionPresentationTask[] = [];
  for (const process of progression.processes) {
    for (const stage of process.stages) {
      if (stage.state !== "active") continue;
      for (const group of stage.executionGroups) {
        for (const task of group.tasks) {
          if (task.contributesToProgression) currentTasks.push(task);
          const participantId = task.trackerFacet.owner?.participantId;
          if (!participantId) continue;
          const key = buildCombatTrackerCellKey({
            participantId,
            roundNumber: progression.roundNumber,
            step: getCombatRoundStepForCursorStep(task.trackerFacet.step),
          });
          tasksByCellKey.set(key, [...(tasksByCellKey.get(key) ?? []), task]);
        }
      }
    }
  }

  const byCellKey: Record<string, CombatTrackerLiveFacet> = {};
  for (const [cellKey, tasks] of tasksByCellKey) {
    const progressionTasks = tasks.filter((task) => task.contributesToProgression);
    const attention = progressionTasks.some(
      (task) => classifyCombatTrackerTaskAttention(task) === "exceptional",
    )
      ? "exceptional"
      : "ordinary";
    const primaryTask = [...(progressionTasks.length > 0 ? progressionTasks : tasks)].sort(
      (left, right) => {
        const attentionDifference =
          Number(classifyCombatTrackerTaskAttention(right) === "exceptional") -
          Number(classifyCombatTrackerTaskAttention(left) === "exceptional");
        if (attentionDifference !== 0) return attentionDifference;
        return Number(right.state === "executable") - Number(left.state === "executable");
      },
    )[0]!;
    byCellKey[cellKey] = {
      attention,
      current: progressionTasks.length > 0,
      executable: progressionTasks.some((task) => task.state === "executable"),
      executionGroupIds: unique(tasks.map((task) => task.executionGroupId)),
      gmProxyAvailable: tasks.some((task) => task.actorAccess.gm),
      hover: buildCombatTrackerTaskHover(primaryTask),
      ownerParticipantIds: unique(
        tasks.flatMap((task) =>
          task.owner?.kind === "combatant" ? [task.owner.participantId] : [],
        ),
      ),
      processIds: unique(tasks.map((task) => task.processId)),
      stageIds: unique(tasks.map((task) => task.stageId)),
      taskIds: tasks.map((task) => task.id),
      taskKinds: unique(tasks.map((task) => task.kind)) as CombatProgressionTaskKind[],
      waiting: progressionTasks.some((task) => task.state === "waiting"),
    };
  }

  return {
    byCellKey,
    conflicted: false,
    currentStep: currentTasks[0]
      ? getCombatRoundStepForCursorStep(currentTasks[0].trackerFacet.step)
      : undefined,
    currentTaskIds: currentTasks.map((task) => task.id),
  };
}

export function findCombatProgressionTaskForParticipant(input: {
  kind: CombatProgressionTaskKind;
  participantId: string;
  progression?: CombatProgressionPresentationProjection;
}): CombatProgressionPresentationTask | undefined {
  if (input.progression?.taskVisibility !== "available") return undefined;
  return getCombatProgressionPresentationTasks(input.progression).find(
    (task) =>
      task.kind === input.kind &&
      task.owner?.kind === "combatant" &&
      task.owner.participantId === input.participantId &&
      task.contributesToProgression,
  );
}
