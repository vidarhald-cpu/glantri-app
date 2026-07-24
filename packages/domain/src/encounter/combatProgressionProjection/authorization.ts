import type { CombatRoundPhase } from "../combatRoundManager";
import type { CombatParryPurpose } from "../combatOffensiveParry";
import type {
  CombatProgressionBoundaryKind,
  CombatProgressionDiagnostic,
  CombatProgressionExpectedCommand,
  CombatProgressionProcessKind,
  CombatProgressionProjection,
  CombatProgressionStageKind,
  CombatProgressionTask,
  CombatProgressionTaskKind,
} from "./types";

export type CombatProgressionAuthorizationFailureCode =
  | "boundary_mismatch"
  | "boundary_closed"
  | "execution_group_mismatch"
  | "gm_only"
  | "identity_mismatch"
  | "stale_opportunity"
  | "stale_proposal"
  | "stale_boundary"
  | "task_mismatch"
  | "task_not_found"
  | "task_not_ready"
  | "wrong_target"
  | "wrong_actor"
  | "wrong_participant";

export type CombatProgressionAuthorizationActor =
  | { readonly kind: "gm" }
  | { readonly kind: "combatant"; readonly participantId: string };

export interface AuthorizeCombatProgressionTaskInput {
  readonly actionId?: string;
  readonly attackIndex?: number;
  readonly attackModeId?: string;
  readonly actor: CombatProgressionAuthorizationActor;
  readonly attackResultId?: string;
  readonly attackerParticipantId?: string;
  readonly commandType: CombatProgressionExpectedCommand;
  readonly criticalResultId?: string;
  readonly contestId?: string;
  readonly currentBoundary?: CombatProgressionBoundaryKind;
  readonly damageReviewId?: string;
  readonly declarationId?: string;
  readonly declaredOpponentParticipantId?: string;
  readonly defenderParticipantId?: string;
  readonly executionGroupId?: string;
  readonly healthRollId?: string;
  readonly hitLocationResultId?: string;
  readonly initiativeGroupId?: string;
  readonly initiativeValue?: number;
  readonly opportunityId?: string;
  readonly offensiveParryAttemptId?: string;
  readonly parryPurpose?: CombatParryPurpose;
  readonly parryResultId?: string;
  readonly parrySourceId?: string;
  readonly opponentParticipantId?: string;
  readonly pairId?: string;
  readonly participantId?: string;
  readonly phase?: CombatRoundPhase;
  readonly processId?: string;
  readonly projection: CombatProgressionProjection;
  readonly proposalId?: string;
  readonly taskId?: string;
  readonly stageId?: string;
  readonly targetBoundary?: CombatProgressionBoundaryKind;
  readonly weaponInstanceId?: string;
  readonly weaponSourceId?: string;
  readonly weaponSourceSlot?: string;
  readonly weaponTemplateId?: string;
}

export type CombatProgressionAuthorizationResult =
  | { readonly ok: true; readonly task: CombatProgressionTask }
  | {
      readonly code: CombatProgressionAuthorizationFailureCode;
      readonly message: string;
      readonly ok: false;
    };

interface CommandTaskRule {
  boundary?:
    | CombatProgressionBoundaryKind
    | ((phase?: CombatRoundPhase) => CombatProgressionBoundaryKind | undefined);
  kind: CombatProgressionTaskKind | readonly CombatProgressionTaskKind[];
  process?: CombatProgressionProcessKind;
  stage: CombatProgressionStageKind | readonly CombatProgressionStageKind[];
}

const COMMAND_TASK_RULES: Partial<Record<CombatProgressionExpectedCommand, CommandTaskRule>> = {
  advance_combat_boundary: {
    kind: "gm_advance_boundary",
    stage: "boundary",
  },
  commit_phase_initiative_resolution: {
    boundary: initiativeBoundary,
    kind: "commit_initiative",
    process: "initiative",
    stage: "commit",
  },
  commit_feint_result: {
    boundary: "phase1_resolution",
    kind: "feint_commit",
    process: "feint",
    stage: "proposal_commit",
  },
  declare_action: {
    boundary: "declaration",
    kind: "submit_declaration",
    process: "declaration",
    stage: "input",
  },
  decide_double_attack_phase2: {
    boundary: "phase2_modifier_review",
    kind: "double_attack_decision",
    process: "attack_decision",
    stage: "decision",
  },
  complete_round: {
    boundary: "round_boundary",
    kind: "gm_advance_boundary",
    process: "round_end",
    stage: "boundary",
  },
  commit_round_end_distance_control: {
    boundary: "round_end",
    kind: "distance_commit",
    process: "distance",
    stage: "proposal_commit",
  },
  commit_round_end_participant_review: {
    boundary: "round_end",
    kind: "effect_review",
    process: "effect_review",
    stage: "effect",
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
  roll_offensive_parry_brawling: {
    boundary: resolutionBoundary,
    kind: "offensive_parry_brawling_roll",
    process: "attack",
    stage: "offensive_parry_contest",
  },
  roll_hit_location: {
    boundary: resolutionBoundary,
    kind: "hit_location",
    process: "attack",
    // Adapter-backed attacks expose a dedicated stage. Persisted legacy attack
    // chains represent all post-defense rolls in their shared damage stage.
    stage: ["hit_location", "damage"],
  },
  roll_critical: {
    boundary: resolutionBoundary,
    kind: "critical",
    process: "attack",
    stage: ["critical", "damage"],
  },
  resolve_damage: {
    boundary: resolutionBoundary,
    kind: ["damage_roll", "damage_review"],
    process: "attack",
    stage: "damage",
  },
  commit_phase_damage: {
    boundary: resolutionBoundary,
    kind: "damage_review",
    process: "attack",
    stage: "commit",
  },
  prepare_round_end_review: {
    boundary: "round_end",
    kind: "round_end_prepare",
    process: "distance",
    stage: "review",
  },
  review_modifiers_phase1: {
    boundary: "phase1_modifier_review",
    kind: "modifier_review",
    process: "modifier_review",
    stage: "review",
  },
  review_modifiers_phase2: {
    boundary: "phase2_modifier_review",
    kind: "modifier_review",
    process: "modifier_review",
    stage: "review",
  },
  roll_combat_experience: {
    boundary: combatExperienceBoundary,
    kind: "combat_experience",
    process: "combat_experience",
    stage: "input",
  },
  roll_round_end_distance_control: {
    boundary: "round_end",
    kind: "distance_roll",
    process: "distance",
    stage: "roll",
  },
  roll_round_end_health_check: {
    boundary: "round_end",
    kind: "health_review",
    process: "health_review",
    stage: "health",
  },
  respond_adjust_distance: {
    boundary: "phase1_resolution",
    kind: "adjust_distance_response",
    process: "adjust_distance",
    stage: "participant_response",
  },
  review_adjust_distance_roll_adjustment: {
    boundary: "phase1_resolution",
    kind: "adjust_distance_adjustment",
    process: "adjust_distance",
    stage: "gm_adjustment",
  },
  roll_adjust_distance: {
    boundary: "phase1_resolution",
    kind: ["adjust_distance_attacker_roll", "adjust_distance_defender_roll"],
    process: "adjust_distance",
    stage: "opposed_rolls",
  },
  commit_adjust_distance: {
    boundary: "phase1_resolution",
    kind: "adjust_distance_commit",
    process: "adjust_distance",
    stage: "proposal_commit",
  },
  roll_feint: {
    boundary: "phase1_resolution",
    kind: ["feint_attacker_roll", "feint_defender_roll"],
    process: "feint",
    stage: ["attacker_roll", "defender_roll"],
  },
  set_combat_experience_difficulty: {
    boundary: "declaration",
    kind: "combat_experience",
    process: "combat_experience",
    stage: "difficulty",
  },
  submit_phase_initiative_choice: {
    boundary: resolutionBoundary,
    kind: "combat_experience",
    process: "combat_experience",
    stage: "input",
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

function combatExperienceBoundary(
  phase?: CombatRoundPhase,
): CombatProgressionBoundaryKind | undefined {
  return phase ? resolutionBoundary(phase) : "declaration";
}

function failure(
  code: CombatProgressionAuthorizationFailureCode,
  message: string,
): CombatProgressionAuthorizationResult {
  return { code, message, ok: false };
}

function ruleMatches<T extends string>(value: T, expected: T | readonly T[]): boolean {
  return Array.isArray(expected) ? expected.includes(value) : value === expected;
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
    input.commandType === "advance_combat_boundary"
      ? input.currentBoundary
      : typeof rule.boundary === "function"
        ? rule.boundary(input.phase)
        : rule.boundary;
  if (!expectedBoundary || input.projection.boundary.kind !== expectedBoundary) {
    return failure(
      input.currentBoundary ? "stale_boundary" : "boundary_closed",
      "The projected combat boundary is closed for this command.",
    );
  }

  const candidateStages = input.projection.boundary.processes
    .filter((candidate) => !rule.process || candidate.kind === rule.process)
    .flatMap((process) => process.stages)
    .filter((candidate) => ruleMatches(candidate.kind, rule.stage));
  const commandTasks = candidateStages
    .flatMap((stage) => stage.executionGroups)
    .flatMap((group) => group.tasks)
    .filter(
      (task) => ruleMatches(task.kind, rule.kind) && task.expectedCommand === input.commandType,
    );

  if (commandTasks.length === 0) {
    return failure("task_not_found", "No projected task matches this command.");
  }

  const transitionTasks = input.targetBoundary
    ? commandTasks.filter(
        (task) =>
          task.transition?.currentBoundary === expectedBoundary &&
          task.transition.targetBoundary === input.targetBoundary,
      )
    : commandTasks;
  if (input.targetBoundary && transitionTasks.length === 0) {
    return failure("wrong_target", "The requested combat boundary target is not executable.");
  }

  const participantTasks = input.participantId
    ? transitionTasks.filter(
        (task) =>
          (task.owner?.kind === "combatant" && task.owner.participantId === input.participantId) ||
          task.identity.participantId === input.participantId,
      )
    : transitionTasks;
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

  const lineageChecks: ReadonlyArray<readonly [unknown, keyof CombatProgressionTask["identity"]]> =
    [
      [input.actionId, "actionId"],
      [input.attackIndex, "attackIndex"],
      [input.attackModeId, "attackModeId"],
      [input.declarationId, "declarationId"],
      [input.initiativeGroupId, "initiativeGroupId"],
      [input.initiativeValue, "initiativeValue"],
      [input.declaredOpponentParticipantId, "declaredOpponentParticipantId"],
      [input.offensiveParryAttemptId, "offensiveParryAttemptId"],
      [input.parryPurpose, "parryPurpose"],
      [input.parrySourceId, "parrySourceId"],
      [input.weaponInstanceId, "weaponInstanceId"],
      [input.weaponSourceId, "weaponSourceId"],
      [input.weaponSourceSlot, "weaponSourceSlot"],
      [input.weaponTemplateId, "weaponTemplateId"],
    ];
  const lineageTasks = opportunityTasks.filter((task) =>
    lineageChecks.every(([value, key]) => value === undefined || task.identity[key] === value),
  );
  if (lineageTasks.length === 0 && lineageChecks.some(([value]) => value !== undefined)) {
    return failure(
      "identity_mismatch",
      "The attack source or mode identity does not match the projected task.",
    );
  }

  const proposalTasks = input.proposalId
    ? lineageTasks.filter((task) => task.identity.proposalId === input.proposalId)
    : lineageTasks;
  if (input.proposalId && proposalTasks.length === 0) {
    return failure("stale_proposal", "The combat proposal is stale or not executable.");
  }

  const contestTasks = input.contestId
    ? proposalTasks.filter((task) => task.identity.contestId === input.contestId)
    : proposalTasks;
  if (input.contestId && contestTasks.length === 0) {
    return failure("stale_proposal", "The contested roll is stale or not executable.");
  }

  const parryResultTasks = input.parryResultId
    ? contestTasks.filter((task) => task.identity.parryResultId === input.parryResultId)
    : contestTasks;
  if (input.parryResultId && parryResultTasks.length === 0) {
    return failure("stale_opportunity", "The parry result is stale or not executable.");
  }

  const healthRollTasks = input.healthRollId
    ? parryResultTasks.filter((task) => task.identity.healthRollId === input.healthRollId)
    : parryResultTasks;
  if (input.healthRollId && healthRollTasks.length === 0) {
    return failure("stale_proposal", "The Health roll is stale or not executable.");
  }

  const pairTasks = input.pairId
    ? healthRollTasks.filter((task) => task.identity.pairId === input.pairId)
    : healthRollTasks;
  if (input.pairId && pairTasks.length === 0) {
    return failure("stale_proposal", "The combat participant pair is stale or not executable.");
  }

  const opponentTasks = input.opponentParticipantId
    ? pairTasks.filter(
        (task) => task.identity.opponentParticipantId === input.opponentParticipantId,
      )
    : pairTasks;
  if (input.opponentParticipantId && opponentTasks.length === 0) {
    return failure("wrong_participant", "The projected task belongs to another opponent pair.");
  }

  const attackTasks = input.attackResultId
    ? opponentTasks.filter((task) => task.identity.attackResultId === input.attackResultId)
    : opponentTasks;
  if (input.attackResultId && attackTasks.length === 0) {
    return failure("stale_opportunity", "The attack result is stale or not executable.");
  }

  const attackerTasks = input.attackerParticipantId
    ? attackTasks.filter(
        (task) => task.identity.attackerParticipantId === input.attackerParticipantId,
      )
    : attackTasks;
  if (input.attackerParticipantId && attackerTasks.length === 0) {
    return failure("wrong_participant", "The projected task belongs to another attacker.");
  }

  const defenderTasks = input.defenderParticipantId
    ? attackerTasks.filter(
        (task) => task.identity.defenderParticipantId === input.defenderParticipantId,
      )
    : attackerTasks;
  if (input.defenderParticipantId && defenderTasks.length === 0) {
    return failure("wrong_participant", "The projected task belongs to another defender.");
  }

  const hitLocationTasks = input.hitLocationResultId
    ? defenderTasks.filter(
        (task) => task.identity.hitLocationResultId === input.hitLocationResultId,
      )
    : defenderTasks;
  if (input.hitLocationResultId && hitLocationTasks.length === 0) {
    return failure("stale_opportunity", "The hit-location result is stale or not executable.");
  }

  const criticalTasks = input.criticalResultId
    ? hitLocationTasks.filter((task) => task.identity.criticalResultId === input.criticalResultId)
    : hitLocationTasks;
  if (input.criticalResultId && criticalTasks.length === 0) {
    return failure("stale_opportunity", "The critical result is stale or not executable.");
  }

  const damageReviewTasks = input.damageReviewId
    ? criticalTasks.filter((task) => task.identity.damageReviewId === input.damageReviewId)
    : criticalTasks;
  if (input.damageReviewId && damageReviewTasks.length === 0) {
    return failure("stale_proposal", "The damage review is stale or not executable.");
  }

  const executionGroupTasks = input.executionGroupId
    ? damageReviewTasks.filter((task) => task.executionGroupId === input.executionGroupId)
    : damageReviewTasks;
  if (input.executionGroupId && executionGroupTasks.length === 0) {
    return failure(
      "execution_group_mismatch",
      "The projected combat execution group is stale or no longer executable.",
    );
  }

  const processTasks = input.processId
    ? executionGroupTasks.filter((task) => task.processId === input.processId)
    : executionGroupTasks;
  if (input.processId && processTasks.length === 0) {
    return failure("identity_mismatch", "The combat process identity does not match the task.");
  }

  const stageTasks = input.stageId
    ? processTasks.filter((task) => task.stageId === input.stageId)
    : processTasks;
  if (input.stageId && stageTasks.length === 0) {
    return failure("identity_mismatch", "The combat stage identity does not match the task.");
  }

  const matchingTasks = input.taskId
    ? stageTasks.filter((task) => task.id === input.taskId)
    : stageTasks;
  if (input.taskId && matchingTasks.length === 0) {
    return failure("task_mismatch", "The projected combat task is stale or no longer executable.");
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
