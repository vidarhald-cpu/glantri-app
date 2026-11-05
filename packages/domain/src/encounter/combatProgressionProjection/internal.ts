import {
  type CombatRoundInitiativeExecutionGroup,
  getBlockingCombatObservationAttempts,
  isCombatRoundEndReviewComplete,
  type CombatRoundCursorStep,
  type CombatRoundPhase,
  type CombatRoundState,
  type CombatRoundStep,
  type CombatRoundStepStatus,
} from "../combatRoundManager";
import type { CombatActionProcessPlan } from "../combatActionProcesses";
import type { CombatParticipationProjection } from "../combatParticipation";
import { projectCombatTaskAutomationEligibility } from "../combatAutomationEligibility";
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
    position?: number;
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
  initiativeGroup?: CombatRoundInitiativeExecutionGroup;
  participation?: CombatParticipationProjection;
  roundNumber: number;
  state: CombatRoundState;
}

function taskParticipationFact(
  context: ProjectionBuildContext,
  spec: TaskSpec,
  processKind: CombatProgressionProcessKind,
) {
  const participantId =
    spec.identity?.participantId ??
    (spec.owner?.kind === "combatant" ? spec.owner.participantId : undefined);
  const phase = spec.identity?.phase;
  const target = (() => {
    switch (spec.kind) {
      case "submit_declaration":
        return { family: "declaration", participantId } as const;
      case "combat_experience":
        return spec.expectedCommand === "roll_combat_experience"
          ? ({ family: "combat_start_experience", participantId, step: "roll" } as const)
          : spec.expectedCommand === "set_combat_experience_difficulty"
            ? ({ family: "combat_start_experience", step: "difficulty" } as const)
            : ({ family: "phase_combat_experience", participantId, phase } as const);
      case "modifier_review":
        return { family: "modifier_review", participantId, phase } as const;
      case "double_attack_decision":
        return {
          family: "double_attack_decision",
          participantId,
          phase,
          opportunityId: spec.identity?.opportunityId,
        } as const;
      case "roll_initiative":
        return { family: "initiative", participantId, phase } as const;
      case "commit_initiative":
        return {
          family: "boundary",
          phase,
          step: phase === "phase1" ? "commit_i1" : "commit_i2",
        } as const;
      case "round_end_prepare":
        return { family: "boundary", step: "prepare_round_end" } as const;
      case "feint_attacker_roll":
      case "feint_defender_roll":
      case "feint_commit":
        return {
          family: "feint",
          participantId,
          phase,
          proposalId: spec.identity?.proposalId,
          step: spec.kind,
        } as const;
      case "adjust_distance_response":
      case "adjust_distance_adjustment":
      case "adjust_distance_attacker_roll":
      case "adjust_distance_defender_roll":
      case "adjust_distance_commit":
        return {
          family: "adjust_distance",
          participantId,
          phase,
          proposalId: spec.identity?.proposalId,
          step: spec.kind,
        } as const;
      case "attack":
        return {
          family: "phase_action",
          participantId,
          phase,
          opportunityId: spec.identity?.opportunityId,
          step: "attack",
        } as const;
      case "parry":
        return {
          family: "phase_response",
          participantId,
          phase,
          opportunityId: spec.identity?.opportunityId,
          step: "defense",
        } as const;
      case "offensive_parry_brawling_roll":
        return {
          family: "offensive_parry",
          participantId,
          phase,
          opportunityId: spec.identity?.opportunityId,
        } as const;
      case "hit_location":
        return {
          family: "damage_chain",
          participantId,
          phase,
          opportunityId: spec.identity?.opportunityId,
          step: "hit_location",
        } as const;
      case "critical":
        return {
          family: "damage_chain",
          participantId,
          phase,
          opportunityId: spec.identity?.opportunityId,
          step: "critical",
        } as const;
      case "damage_roll":
        return {
          family: "damage_chain",
          participantId,
          phase,
          opportunityId: spec.identity?.opportunityId,
          step: "damage",
        } as const;
      case "damage_review":
        return {
          family: "damage_chain",
          phase,
          opportunityId: spec.identity?.opportunityId,
          step: spec.expectedCommand === "commit_phase_damage" ? "damage" : "commit",
        } as const;
      case "continued_contact_maintenance_roll":
        return {
          family: "continued_contact",
          participantId,
          pairId: spec.identity?.continuedContactId,
          step: "maintenance_roll",
        } as const;
      case "distance_roll":
      case "distance_commit":
        return {
          family: "distance_control",
          participantId,
          pairId: spec.identity?.pairId,
          proposalId: spec.identity?.proposalId,
          step: spec.kind,
        } as const;
      case "health_review":
        return {
          family: "health_bleed",
          participantId,
          proposalId: spec.identity?.proposalId,
          step: "health_check",
        } as const;
      case "observation_roll":
        return {
          family: "observation",
          participantId,
          proposalId: spec.identity?.observationAttemptId,
          step: "observation_roll",
        } as const;
      case "participant_review":
        return { family: "participant_completion", participantId } as const;
      case "effect_review": {
        const effect = context.participation?.facts.find(
          (fact) =>
            fact.identity.processFamily === "effect_review" &&
            fact.identity.participantId === participantId,
        );
        if (effect && !(effect.status === "not_required" && effect.workClass === "no_work")) {
          return { family: "effect_review", participantId } as const;
        }
        return { family: "participant_completion", participantId } as const;
      }
      case "gm_advance_boundary": {
        const stepByBoundary = {
          declaration: "declaration_boundary",
          phase1_modifier_review: "M1_boundary",
          phase1_resolution: "phase1_boundary",
          phase2_modifier_review: "M2_boundary",
          phase2_resolution: "phase2_boundary",
          round_boundary: "round_boundary",
          round_end: "round_boundary",
        } as const;
        return {
          family: "boundary",
          step: stepByBoundary[context.boundaryKind as keyof typeof stepByBoundary],
        } as const;
      }
      default:
        return processKind === "round_end"
          ? ({ family: "boundary", step: "round_boundary" } as const)
          : undefined;
    }
  })();
  if (!target || !context.participation) return undefined;
  const fact = context.participation.facts.find(
    (candidate) =>
      candidate.identity.processFamily === target.family &&
      (target.participantId === undefined ||
        candidate.identity.participantId === target.participantId) &&
      (target.phase === undefined || candidate.identity.phase === target.phase) &&
      (!("step" in target) ||
        target.step === undefined ||
        candidate.identity.step === target.step) &&
      (!("opportunityId" in target) ||
        target.opportunityId === undefined ||
        candidate.identity.opportunityId === target.opportunityId) &&
      (!("proposalId" in target) ||
        target.proposalId === undefined ||
        candidate.identity.proposalId === target.proposalId) &&
      (!("pairId" in target) ||
        target.pairId === undefined ||
        candidate.identity.pairId === target.pairId),
  );
  return fact
    ? {
        completeness: fact.completeness,
        factId: fact.id,
        ordering: fact.ordering,
        ownership: fact.ownership,
        reason: fact.reason,
        status: fact.status,
        workClass: fact.workClass,
      }
    : undefined;
}

export function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return value;
}

// #894 moved `boundaryForCursorStep` to `./types`, beside `COMBAT_PROGRESSION_BOUNDARIES` and
// `isCombatInitiativeCommitted`, so `combatRoundManager` can read the boundary its initiative
// commit produces without hand-writing a second copy of the mapping. `./types` imports nothing
// from `combatRoundManager` at runtime, so that edge stays type-only. Re-exported here so this
// folder's existing callers are unchanged.
export { boundaryForCursorStep } from "./types";

/**
 * Ruling 2 (#215): the `declaration` boundary is a deliberately coarse authorization *family*, not a
 * synonym for one round step. It spans `pre_declaration` and `select_actions`, and the two steps stay
 * semantically distinct because every command authorized at this boundary carries its own step guard
 * or its own projected precondition:
 *
 * - `roll_combat_experience` and `set_combat_experience_difficulty` admit exactly
 *   `pre_declaration` and `select_actions` (`combatRoundManager.ts`), so the pre-declaration Combat
 *   Experience check is reachable.
 * - `declare_action` is *not* projected at all while the round is in `pre_declaration`
 *   (`buildDeclarationProcesses`), and its player path additionally requires
 *   `currentStep === "select_actions"` through `canPlayerSubmitCombatDeclaration`. Ordinary action
 *   declaration therefore stays unavailable until `select_actions`.
 *
 * Advancing the boundary is likewise step-wise rather than boundary-wise: `transitionWithoutCommand`
 * delegates a `declaration` advance to `advanceCombatRoundStep`, so the GM advance offered in
 * `pre_declaration` moves the round to `select_actions` and re-opens the same boundary. No new
 * persisted boundary vocabulary member is introduced.
 */
export function boundaryForStep(
  step: CombatRoundStep,
  state: CombatRoundState,
): CombatProgressionBoundaryKind {
  if (step === "pre_declaration" || step === "select_actions") return "declaration";
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
  // #948. A marked Observe attempt is still pending and still manually resolvable, but it no
  // longer holds the round open: without this, marking one would make the round permanently
  // unadvanceable, which is a worse block than the batch halt the ruling replaced.
  return isCombatRoundEndReviewComplete(state) &&
    getBlockingCombatObservationAttempts(state).length === 0
    ? "round_boundary"
    : "round_end";
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

  const participation = taskParticipationFact(context, spec, processKind);
  const state = blockerIds.length === 0 ? "executable" : "waiting";
  const identity = {
    executionGroupId,
    ...(context.initiativeGroup
      ? {
          initiativeGroupId: context.initiativeGroup.id,
          initiativeValue: context.initiativeGroup.initiativeValue,
        }
      : {}),
    ...spec.identity,
  };
  return {
    allowedActors,
    automation: projectCombatTaskAutomationEligibility({
      participation,
      task: {
        blockerCount: blockerIds.length,
        expectedCommand: spec.expectedCommand,
        identity,
        kind: spec.kind,
        ownerParticipantId:
          spec.owner?.kind === "combatant"
            ? spec.owner.participantId
            : spec.identity?.participantId,
        presentationContext: spec.presentationContext,
        state,
        taskId: id,
      },
    }),
    blockerIds,
    expectedCommand: spec.expectedCommand,
    executionGroupId,
    id,
    identity,
    kind: spec.kind,
    opponent: spec.identity?.opponentParticipantId
      ? context.identities.get(spec.identity.opponentParticipantId)
      : undefined,
    owner: spec.owner,
    participation,
    presentationContext: spec.presentationContext,
    processId: getCombatProgressionProcessId(context, processKind, processKey),
    stageId: stageId(context, processKind, stageKind, processKey, stageKey),
    state,
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
        (stage.tasks ?? []).map((task) => ({
          position: undefined,
          strategy: stage.strategy,
          tasks: [task],
        }));
      const executionGroups = groupSpecs.map((group, position) =>
        buildExecutionGroup(context, kind, stage, group, group.position ?? position, options.key),
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
