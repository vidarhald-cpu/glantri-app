import {
  isCombatRoundEndReviewComplete,
  type CombatRoundCursorStep,
  type CombatRoundPhase,
  type CombatRoundState,
  type CombatRoundStep,
  type CombatRoundStepStatus,
} from "../combatRoundManager";
import type { CombatActionProcessPlan } from "../combatActionProcesses";
import type {
  CombatantIdentity,
  CombatProgressionBlocker,
  CombatProgressionBlockerType,
  CombatProgressionBoundaryKind,
  CombatProgressionDiagnostic,
  CombatProgressionExecutionGroup,
  CombatProgressionExecutionStrategy,
  CombatProgressionExpectedCommand,
  CombatProgressionGmIdentity,
  CombatProgressionProcess,
  CombatProgressionProcessKind,
  CombatProgressionStageKind,
  CombatProgressionStageState,
  CombatProgressionTaskKind,
  CombatProgressionTaskOwner,
  CombatProgressionTask,
  CombatProgressionTaskIdentity,
  CombatProgressionTaskPresentationContext,
  CombatProgressionAllowedActor,
  CombatProgressionBoundaryTransition,
} from "./types";

export const GM_IDENTITY: CombatProgressionGmIdentity = {
  id: "gm",
  kind: "gm",
  label: "Game Master",
};

const COMPLETED_STATUSES = new Set<CombatRoundStepStatus>([
  "complete",
  "gmEdited",
  "locked",
  "skipped",
  "submitted",
]);

export interface TaskDependency {
  message: string;
  owner?: CombatantIdentity;
  type: CombatProgressionBlockerType;
}

export interface TaskSpec {
  allowedActors?: readonly CombatProgressionAllowedActor[];
  dependencies?: readonly TaskDependency[];
  expectedCommand: CombatProgressionExpectedCommand;
  identity?: Omit<CombatProgressionTaskIdentity, "executionGroupId">;
  key?: string;
  kind: CombatProgressionTaskKind;
  owner?: CombatProgressionTaskOwner;
  presentationContext?: CombatProgressionTaskPresentationContext;
  trackerOwner?: CombatantIdentity;
  trackerStep: CombatRoundCursorStep;
  transition?: CombatProgressionBoundaryTransition;
}

export interface StageSpec {
  executionGroups?: readonly {
    key?: string;
    strategy?: CombatProgressionExecutionStrategy;
    tasks: readonly TaskSpec[];
  }[];
  key?: string;
  kind: CombatProgressionStageKind;
  state: CombatProgressionStageState;
  strategy: CombatProgressionExecutionStrategy;
  tasks?: readonly TaskSpec[];
}

export interface ProjectionBuildContext {
  actionProcessPlans: readonly CombatActionProcessPlan[];
  blockers: Map<string, CombatProgressionBlocker>;
  boundaryId: string;
  boundaryKind: CombatProgressionBoundaryKind;
  diagnostics: CombatProgressionDiagnostic[];
  identities: Map<string, CombatantIdentity>;
  roundNumber: number;
  state: CombatRoundState;
}

export function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return value;
}

export function boundaryForCursorStep(
  step: CombatRoundCursorStep,
  hasParticipant: boolean,
): CombatProgressionBoundaryKind {
  if (step === "DE") return "declaration";
  if (step === "M1") return "phase1_modifier_review";
  if (step === "i1") return "phase1_initiative";
  if (step === "A1" || step === "P1" || step === "D1") return "phase1_resolution";
  if (step === "M2") return "phase2_modifier_review";
  if (step === "i2") return "phase2_initiative";
  if (step === "A2" || step === "P2" || step === "D2") return "phase2_resolution";
  return hasParticipant ? "round_end" : "round_boundary";
}

export function boundaryForStep(
  step: CombatRoundStep,
  state: CombatRoundState,
): CombatProgressionBoundaryKind {
  if (step === "select_actions") return "declaration";
  if (step === "review_action_modifiers") return "phase1_modifier_review";
  if (step === "initiative_phase_1") return "phase1_initiative";
  if (
    step === "phase_1_actions" ||
    step === "review_phase_2_actions" ||
    step === "phase_1_damage"
  ) {
    return "phase1_resolution";
  }
  if (step === "review_phase_2_modifiers") return "phase2_modifier_review";
  if (step === "initiative_phase_2") return "phase2_initiative";
  if (step === "phase_2_actions" || step === "review_phase_2_damage" || step === "phase_2_damage") {
    return "phase2_resolution";
  }
  return isCombatRoundEndReviewComplete(state) ? "round_boundary" : "round_end";
}

export function getCombatProgressionProcessId(
  context: ProjectionBuildContext,
  kind: CombatProgressionProcessKind,
  key?: string,
): string {
  return `${context.boundaryId}:process:${kind}${key ? `:${key}` : ""}`;
}

function stageId(
  context: ProjectionBuildContext,
  processKind: CombatProgressionProcessKind,
  kind: CombatProgressionStageKind,
  processKey?: string,
  stageKey?: string,
): string {
  return `${getCombatProgressionProcessId(context, processKind, processKey)}:stage:${kind}${stageKey ? `:${stageKey}` : ""}`;
}

function registerBlocker(
  context: ProjectionBuildContext,
  input: TaskDependency & { key: string; taskId: string },
): string {
  const id = `${context.boundaryId}:blocker:${input.type}:${input.key}`;
  const existing = context.blockers.get(id);
  context.blockers.set(id, {
    id,
    message: input.message,
    owner: input.owner,
    taskIds: existing ? [...new Set([...existing.taskIds, input.taskId])] : [input.taskId],
    type: input.type,
  });
  return id;
}

function buildTask(
  context: ProjectionBuildContext,
  processKind: CombatProgressionProcessKind,
  stageKind: CombatProgressionStageKind,
  spec: TaskSpec,
  executionGroupId: string,
  processKey?: string,
  stageKey?: string,
): CombatProgressionTask {
  const ownerKey =
    spec.owner?.kind === "combatant"
      ? spec.owner.participantId
      : spec.owner?.kind === "gm"
        ? "gm"
        : "unowned";
  const id = `${stageId(context, processKind, stageKind, processKey, stageKey)}:task:${spec.kind}:${spec.key ?? ownerKey}`;
  const dependencies = [...(spec.dependencies ?? [])];
  if (!spec.owner) {
    dependencies.push({
      message: "The projected task has no combatant owner.",
      type: "missing_owner",
    });
  }
  const blockerIds = dependencies.map((dependency, index) =>
    registerBlocker(context, {
      ...dependency,
      key: `${id}:dependency:${index}`,
      taskId: id,
    }),
  );
  const allowedActors =
    spec.allowedActors ??
    (spec.owner?.kind === "gm" ? (["gm"] as const) : (["combatant", "gm"] as const));
  const pendingType: CombatProgressionBlockerType =
    context.boundaryKind === "round_end" || context.boundaryKind === "round_boundary"
      ? "round_end_pending"
      : allowedActors.length === 1 && allowedActors[0] === "gm"
        ? "gm_commit_pending"
        : "participant_input_pending";
  registerBlocker(context, {
    key: `${id}:pending`,
    message:
      pendingType === "gm_commit_pending"
        ? "GM action is pending."
        : pendingType === "round_end_pending"
          ? "Round-end work is pending."
          : "Participant input is pending.",
    owner: spec.owner?.kind === "combatant" ? spec.owner : undefined,
    taskId: id,
    type: pendingType,
  });

  return {
    allowedActors,
    blockerIds,
    expectedCommand: spec.expectedCommand,
    executionGroupId,
    id,
    identity: {
      executionGroupId,
      ...spec.identity,
    },
    kind: spec.kind,
    opponent: spec.identity?.opponentParticipantId
      ? context.identities.get(spec.identity.opponentParticipantId)
      : undefined,
    owner: spec.owner,
    presentationContext: spec.presentationContext,
    processId: getCombatProgressionProcessId(context, processKind, processKey),
    stageId: stageId(context, processKind, stageKind, processKey, stageKey),
    state: blockerIds.length === 0 ? "executable" : "waiting",
    trackerFacet: { owner: spec.trackerOwner, step: spec.trackerStep },
    transition: spec.transition,
  };
}

function buildExecutionGroup(
  context: ProjectionBuildContext,
  processKind: CombatProgressionProcessKind,
  stage: StageSpec,
  groupSpec: NonNullable<StageSpec["executionGroups"]>[number],
  position: number,
  processKey?: string,
): CombatProgressionExecutionGroup {
  const currentStageId = stageId(context, processKind, stage.kind, processKey, stage.key);
  const firstTask = groupSpec.tasks[0];
  const ownerKey =
    firstTask?.owner?.kind === "combatant"
      ? firstTask.owner.participantId
      : firstTask?.owner?.kind === "gm"
        ? "gm"
        : "unowned";
  const taskKey = groupSpec.key ?? firstTask?.key ?? ownerKey;
  const groupKey = groupSpec.key ?? `${firstTask?.kind ?? "task"}:${taskKey}`;
  const id = `${currentStageId}:execution-group:${position}:${groupKey}`;
  const tasks = groupSpec.tasks.map((taskSpec) =>
    buildTask(context, processKind, stage.kind, taskSpec, id, processKey, stage.key),
  );
  return {
    activationBoundary: {
      id: context.boundaryId,
      kind: context.boundaryKind,
      roundNumber: context.roundNumber,
    },
    blockerIds: [...new Set(tasks.flatMap((task) => task.blockerIds))],
    completionState: stage.state === "complete" ? "complete" : "incomplete",
    diagnostics: [],
    executionStrategy: groupSpec.strategy ?? stage.strategy,
    futureActivationBoundary: undefined,
    id,
    position,
    stageId: currentStageId,
    tasks,
  };
}

export function getCombatProgressionBoundaryTarget(
  boundary: CombatProgressionBoundaryKind,
): CombatProgressionBoundaryKind | undefined {
  switch (boundary) {
    case "declaration":
      return "phase1_modifier_review";
    case "phase1_modifier_review":
      return "phase1_initiative";
    case "phase1_initiative":
      return "phase1_resolution";
    case "phase1_resolution":
      return "phase2_modifier_review";
    case "phase2_modifier_review":
      return "phase2_initiative";
    case "phase2_initiative":
      return "phase2_resolution";
    case "phase2_resolution":
      return "round_end";
    case "round_end":
      return "round_boundary";
    case "round_boundary":
      return "declaration";
  }
}

export function buildProcess(
  context: ProjectionBuildContext,
  kind: CombatProgressionProcessKind,
  stages: readonly StageSpec[],
  options: { key?: string; planId?: string } = {},
): CombatProgressionProcess {
  const id = getCombatProgressionProcessId(context, kind, options.key);
  return {
    boundaryId: context.boundaryId,
    id,
    kind,
    ...(options.planId ? { planId: options.planId } : {}),
    stages: stages.map((stage) => {
      const groupSpecs =
        stage.executionGroups ??
        (stage.tasks ?? []).map((task) => ({ strategy: stage.strategy, tasks: [task] }));
      const executionGroups = groupSpecs.map((group, position) =>
        buildExecutionGroup(context, kind, stage, group, position, options.key),
      );
      return {
        executionGroups,
        executionStrategy: stage.strategy,
        id: stageId(context, kind, stage.kind, options.key, stage.key),
        kind: stage.kind,
        processId: id,
        state: stage.state,
        tasks: executionGroups.flatMap((group) => group.tasks),
      };
    }),
  };
}

export function isCompleteStatus(status: CombatRoundStepStatus | undefined): boolean {
  return status !== undefined && COMPLETED_STATUSES.has(status);
}

export function trackerStepForPhase(phase: CombatRoundPhase, kind: "attack" | "damage" | "parry") {
  if (phase === "phase1") return kind === "attack" ? "A1" : kind === "parry" ? "P1" : "D1";
  return kind === "attack" ? "A2" : kind === "parry" ? "P2" : "D2";
}
