import type { CombatRoundCommandType, CombatRoundPhase } from "../combatRoundManager";
import type {
  CombatProgressionBoundaryKind,
  CombatProgressionDiagnostic,
  CombatProgressionProcessKind,
  CombatProgressionProjection,
  CombatProgressionStageKind,
  CombatProgressionTask,
  CombatProgressionTaskKind,
} from "./types";

export type CombatProgressionAuthorizationFailureCode =
  | "boundary_closed"
  | "gm_only"
  | "stale_opportunity"
  | "stale_proposal"
  | "task_not_found"
  | "task_not_ready"
  | "wrong_actor"
  | "wrong_participant";

export type CombatProgressionAuthorizationActor =
  | { readonly kind: "gm" }
  | { readonly kind: "combatant"; readonly participantId: string };

export interface AuthorizeCombatProgressionTaskInput {
  readonly actor: CombatProgressionAuthorizationActor;
  readonly attackResultId?: string;
  readonly commandType: CombatRoundCommandType;
  readonly executionGroupId?: string;
  readonly opportunityId?: string;
  readonly participantId?: string;
  readonly phase?: CombatRoundPhase;
  readonly projection: CombatProgressionProjection;
  readonly proposalId?: string;
}

export type CombatProgressionAuthorizationResult =
  | { readonly ok: true; readonly task: CombatProgressionTask }
  | {
      readonly code: CombatProgressionAuthorizationFailureCode;
      readonly message: string;
      readonly ok: false;
    };

interface CommandTaskRule {
  boundary:
    | CombatProgressionBoundaryKind
    | ((phase?: CombatRoundPhase) => CombatProgressionBoundaryKind | undefined);
  kind: CombatProgressionTaskKind;
  process: CombatProgressionProcessKind;
  stage: CombatProgressionStageKind;
}

const COMMAND_TASK_RULES: Partial<Record<CombatRoundCommandType, CommandTaskRule>> = {
  commit_phase_initiative_resolution: {
    boundary: initiativeBoundary,
    kind: "commit_initiative",
    process: "initiative",
    stage: "commit",
  },
  declare_action: {
    boundary: "declaration",
    kind: "submit_declaration",
    process: "declaration",
    stage: "input",
  },
  roll_attack: {
    boundary: resolutionBoundary,
    kind: "attack",
    process: "attack",
    stage: "attack",
  },
  roll_initiative_phase1: {
    boundary: "phase1_initiative",
    kind: "roll_initiative",
    process: "initiative",
    stage: "roll",
  },
  roll_initiative_phase2: {
    boundary: "phase2_initiative",
    kind: "roll_initiative",
    process: "initiative",
    stage: "roll",
  },
  roll_parry: {
    boundary: resolutionBoundary,
    kind: "parry",
    process: "attack",
    stage: "defense",
  },
};

const RELEVANT_DIAGNOSTICS = new Set<CombatProgressionDiagnostic["code"]>([
  "cursor_disagrees_with_process",
  "missing_owner",
  "multiple_executable_tasks",
  "proposal_disagrees_with_task",
  "repair_required",
]);

function initiativeBoundary(phase?: CombatRoundPhase): CombatProgressionBoundaryKind | undefined {
  return phase === "phase1"
    ? "phase1_initiative"
    : phase === "phase2"
      ? "phase2_initiative"
      : undefined;
}

function resolutionBoundary(phase?: CombatRoundPhase): CombatProgressionBoundaryKind | undefined {
  return phase === "phase1"
    ? "phase1_resolution"
    : phase === "phase2"
      ? "phase2_resolution"
      : undefined;
}

function failure(
  code: CombatProgressionAuthorizationFailureCode,
  message: string,
): CombatProgressionAuthorizationResult {
  return { code, message, ok: false };
}

function hasRelevantDiagnostic(
  projection: CombatProgressionProjection,
  tasks: readonly CombatProgressionTask[],
): boolean {
  const relatedIds = new Set<string>([projection.boundary.id]);
  for (const task of tasks) {
    relatedIds.add(task.id);
    relatedIds.add(task.processId);
    relatedIds.add(task.stageId);
  }
  return projection.diagnostics.some(
    (diagnostic) =>
      RELEVANT_DIAGNOSTICS.has(diagnostic.code) &&
      diagnostic.relatedIds.some((id) => relatedIds.has(id)),
  );
}

/**
 * Authorizes projected work only. The command implementation remains responsible for validating
 * and mutating authoritative combat facts.
 */
export function authorizeCombatProgressionTask(
  input: AuthorizeCombatProgressionTaskInput,
): CombatProgressionAuthorizationResult {
  const rule = COMMAND_TASK_RULES[input.commandType];
  if (!rule) return failure("task_not_found", "The command has no projected authorization task.");

  const expectedBoundary =
    typeof rule.boundary === "function" ? rule.boundary(input.phase) : rule.boundary;
  if (!expectedBoundary || input.projection.boundary.kind !== expectedBoundary) {
    return failure("boundary_closed", "The projected combat boundary is closed for this command.");
  }

  const process = input.projection.boundary.processes.find(
    (candidate) => candidate.kind === rule.process,
  );
  const stage = process?.stages.find((candidate) => candidate.kind === rule.stage);
  const commandTasks = (stage?.tasks ?? []).filter(
    (task) => task.kind === rule.kind && task.expectedCommand === input.commandType,
  );

  if (commandTasks.length === 0) {
    return failure("task_not_found", "No projected task matches this command.");
  }

  const participantTasks = input.participantId
    ? commandTasks.filter(
        (task) =>
          task.owner?.kind === "combatant" && task.owner.participantId === input.participantId,
      )
    : commandTasks;
  if (input.participantId && participantTasks.length === 0) {
    return failure("wrong_participant", "The projected task belongs to another participant.");
  }

  const phaseTasks = input.phase
    ? participantTasks.filter((task) => task.identity.phase === input.phase)
    : participantTasks;
  if (input.phase && phaseTasks.length === 0) {
    return failure("task_not_found", "No projected task matches this combat phase.");
  }

  const opportunityTasks = input.opportunityId
    ? phaseTasks.filter((task) => task.identity.opportunityId === input.opportunityId)
    : phaseTasks;
  if (input.opportunityId && opportunityTasks.length === 0) {
    return failure("stale_opportunity", "The combat opportunity is stale or not executable.");
  }

  const proposalTasks = input.proposalId
    ? opportunityTasks.filter((task) => task.identity.proposalId === input.proposalId)
    : opportunityTasks;
  if (input.proposalId && proposalTasks.length === 0) {
    return failure("stale_proposal", "The combat proposal is stale or not executable.");
  }

  const attackTasks = input.attackResultId
    ? proposalTasks.filter((task) => task.identity.attackResultId === input.attackResultId)
    : proposalTasks;
  if (input.attackResultId && attackTasks.length === 0) {
    return failure("stale_opportunity", "The attack result is stale or not executable.");
  }

  const matchingTasks = input.executionGroupId
    ? attackTasks.filter((task) => task.identity.executionGroupId === input.executionGroupId)
    : attackTasks;
  if (input.executionGroupId && matchingTasks.length === 0) {
    return failure("task_not_found", "No task is executable in this execution group.");
  }

  if (matchingTasks.length !== 1 || hasRelevantDiagnostic(input.projection, matchingTasks)) {
    return failure("task_not_ready", "Projected combat facts do not identify one safe task.");
  }

  const task = matchingTasks[0]!;
  if (task.state !== "executable") {
    return failure("task_not_ready", "The matching projected task is not executable.");
  }

  if (input.actor.kind === "gm") {
    return task.allowedActors.includes("gm")
      ? { ok: true, task }
      : failure("wrong_actor", "The GM may not execute this projected task.");
  }
  if (task.allowedActors.length === 1 && task.allowedActors[0] === "gm") {
    return failure("gm_only", "The projected task is GM-only.");
  }
  if (input.participantId && input.actor.participantId !== input.participantId) {
    return failure("wrong_participant", "The actor does not control the requested participant.");
  }
  if (task.owner?.kind !== "combatant" || task.owner.participantId !== input.actor.participantId) {
    return failure("wrong_actor", "The projected task belongs to another actor.");
  }
  return task.allowedActors.includes("combatant")
    ? { ok: true, task }
    : failure("gm_only", "The projected task is GM-only.");
}
