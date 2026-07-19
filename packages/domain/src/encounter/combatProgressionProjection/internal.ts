import {
  getNextCombatRoundEndTask,
  type CombatRoundCursorStep,
  type CombatRoundPhase,
  type CombatRoundState,
  type CombatRoundStep,
  type CombatRoundStepStatus,
} from "../combatRoundManager";
import type {
  CombatantIdentity,
  CombatProgressionBlocker,
  CombatProgressionBlockerType,
  CombatProgressionBoundaryKind,
  CombatProgressionDiagnostic,
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
  CombatProgressionAllowedActor,
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
  identity?: Omit<CombatProgressionTaskIdentity, "executionGroupId"> & {
    executionGroupId?: string;
  };
  key?: string;
  kind: CombatProgressionTaskKind;
  owner?: CombatProgressionTaskOwner;
  trackerOwner?: CombatantIdentity;
  trackerStep: CombatRoundCursorStep;
}

export interface StageSpec {
  kind: CombatProgressionStageKind;
  state: CombatProgressionStageState;
  strategy: CombatProgressionExecutionStrategy;
  tasks?: readonly TaskSpec[];
}

export interface ProjectionBuildContext {
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
  return getNextCombatRoundEndTask({ state })?.kind === "round_boundary"
    ? "round_boundary"
    : "round_end";
}

function processId(context: ProjectionBuildContext, kind: CombatProgressionProcessKind): string {
  return `${context.boundaryId}:process:${kind}`;
}

function stageId(
  context: ProjectionBuildContext,
  processKind: CombatProgressionProcessKind,
  kind: CombatProgressionStageKind,
): string {
  return `${processId(context, processKind)}:stage:${kind}`;
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
): CombatProgressionTask {
  const ownerKey =
    spec.owner?.kind === "combatant"
      ? spec.owner.participantId
      : spec.owner?.kind === "gm"
        ? "gm"
        : "unowned";
  const id = `${stageId(context, processKind, stageKind)}:task:${spec.kind}:${spec.key ?? ownerKey}`;
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
    id,
    identity: {
      executionGroupId:
        spec.identity?.executionGroupId ?? `${stageId(context, processKind, stageKind)}:group`,
      ...spec.identity,
    },
    kind: spec.kind,
    owner: spec.owner,
    processId: processId(context, processKind),
    stageId: stageId(context, processKind, stageKind),
    state: blockerIds.length === 0 ? "executable" : "waiting",
    trackerFacet: { owner: spec.trackerOwner, step: spec.trackerStep },
  };
}

export function buildProcess(
  context: ProjectionBuildContext,
  kind: CombatProgressionProcessKind,
  stages: readonly StageSpec[],
): CombatProgressionProcess {
  const id = processId(context, kind);
  return {
    boundaryId: context.boundaryId,
    id,
    kind,
    stages: stages.map((stage) => ({
      executionStrategy: stage.strategy,
      id: stageId(context, kind, stage.kind),
      kind: stage.kind,
      processId: id,
      state: stage.state,
      tasks: (stage.tasks ?? []).map((task) => buildTask(context, kind, stage.kind, task)),
    })),
  };
}

export function isCompleteStatus(status: CombatRoundStepStatus | undefined): boolean {
  return status !== undefined && COMPLETED_STATUSES.has(status);
}

export function trackerStepForPhase(phase: CombatRoundPhase, kind: "attack" | "damage" | "parry") {
  if (phase === "phase1") return kind === "attack" ? "A1" : kind === "parry" ? "P1" : "D1";
  return kind === "attack" ? "A2" : kind === "parry" ? "P2" : "D2";
}
