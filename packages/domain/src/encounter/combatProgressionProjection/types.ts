import type {
  CombatRoundCommandCurrentTask,
  CombatRoundCommandType,
  CombatRoundCursor,
  CombatRoundCursorStep,
  CombatRoundPhase,
  CombatRoundPhaseResolutionCursor,
} from "../combatRoundManager";

export type CombatProgressionBoundaryKind =
  | "declaration"
  | "phase1_modifier_review"
  | "phase1_initiative"
  | "phase1_resolution"
  | "phase2_modifier_review"
  | "phase2_initiative"
  | "phase2_resolution"
  | "round_end"
  | "round_boundary";

export type CombatProgressionProcessKind =
  | "adjust_distance"
  | "attack"
  | "combat_experience"
  | "declaration"
  | "distance"
  | "feint"
  | "health_review"
  | "initiative"
  | "modifier_review"
  | "participant_review"
  | "round_end";

export type CombatProgressionStageKind =
  | "attack"
  | "boundary"
  | "commit"
  | "critical"
  | "damage"
  | "defense"
  | "difficulty"
  | "feasibility"
  | "health"
  | "hit_location"
  | "input"
  | "participant"
  | "response"
  | "review"
  | "roll";

export type CombatProgressionExecutionStrategy =
  | "gm_review"
  | "initiative_groups"
  | "ordered_all"
  | "parallel_all"
  | "single_task";

export type CombatProgressionStageState = "active" | "complete" | "pending";
export type CombatProgressionTaskState = "executable" | "waiting";

export type CombatProgressionTaskKind =
  | "attack"
  | "combat_experience"
  | "critical"
  | "damage_review"
  | "distance_commit"
  | "distance_roll"
  | "gm_advance_boundary"
  | "health_review"
  | "hit_location"
  | "modifier_review"
  | "parry"
  | "participant_review"
  | "resolve_adjust_distance"
  | "resolve_feint"
  | "roll_initiative"
  | "commit_initiative"
  | "submit_declaration";

export type CombatProgressionExpectedCommand =
  | CombatRoundCommandType
  | "advance_boundary"
  | "set_combat_experience_difficulty";

export type CombatProgressionBlockerType =
  | "gm_commit_pending"
  | "invalid_source"
  | "invalid_target"
  | "missing_owner"
  | "participant_input_pending"
  | "proposal_pending"
  | "round_end_pending";

export type CombatProgressionDiagnosticCode =
  | "cursor_disagrees_with_process"
  | "missing_owner"
  | "multiple_executable_tasks"
  | "proposal_disagrees_with_task"
  | "repair_required";

export interface CombatantIdentity {
  readonly characterId?: string;
  readonly kind: "combatant";
  readonly label: string;
  readonly participantId: string;
  readonly scenarioParticipantId?: string;
}

export interface CombatProgressionGmIdentity {
  readonly id: "gm";
  readonly kind: "gm";
  readonly label: "Game Master";
}

export type CombatProgressionTaskOwner = CombatantIdentity | CombatProgressionGmIdentity;
export type CombatProgressionAllowedActor = "combatant" | "gm";

export interface CombatProgressionTrackerFacet {
  readonly owner?: CombatantIdentity;
  readonly step: CombatRoundCursorStep;
}

/** Stable facts used to identify projected work without relying on a runtime cursor cell. */
export interface CombatProgressionTaskIdentity {
  readonly attackResultId?: string;
  readonly executionGroupId: string;
  readonly opportunityId?: string;
  readonly phase?: CombatRoundPhase;
  readonly proposalId?: string;
}

export interface CombatProgressionTask {
  readonly allowedActors: readonly CombatProgressionAllowedActor[];
  readonly blockerIds: readonly string[];
  readonly expectedCommand: CombatProgressionExpectedCommand;
  readonly id: string;
  readonly identity: CombatProgressionTaskIdentity;
  readonly kind: CombatProgressionTaskKind;
  readonly owner?: CombatProgressionTaskOwner;
  readonly processId: string;
  readonly stageId: string;
  readonly state: CombatProgressionTaskState;
  readonly trackerFacet: CombatProgressionTrackerFacet;
}

export interface CombatProgressionStage {
  readonly executionStrategy: CombatProgressionExecutionStrategy;
  readonly id: string;
  readonly kind: CombatProgressionStageKind;
  readonly processId: string;
  readonly state: CombatProgressionStageState;
  readonly tasks: readonly CombatProgressionTask[];
}

export interface CombatProgressionProcess {
  readonly boundaryId: string;
  readonly id: string;
  readonly kind: CombatProgressionProcessKind;
  readonly stages: readonly CombatProgressionStage[];
}

export interface CombatProgressionBoundary {
  readonly blockerIds: readonly string[];
  readonly id: string;
  readonly kind: CombatProgressionBoundaryKind;
  readonly processes: readonly CombatProgressionProcess[];
  readonly roundNumber: number;
}

export interface CombatProgressionBlocker {
  readonly id: string;
  readonly message: string;
  readonly owner?: CombatantIdentity;
  readonly taskIds: readonly string[];
  readonly type: CombatProgressionBlockerType;
}

export interface CombatProgressionDiagnostic {
  readonly code: CombatProgressionDiagnosticCode;
  readonly message: string;
  readonly relatedIds: readonly string[];
  readonly severity: "warning";
}

export interface CombatProgressionProjection {
  readonly blockers: readonly CombatProgressionBlocker[];
  readonly boundary: CombatProgressionBoundary;
  readonly currentCursorEquivalent?: Readonly<CombatRoundCursor>;
  readonly currentTaskEquivalent?: Readonly<CombatRoundCommandCurrentTask>;
  readonly diagnostics: readonly CombatProgressionDiagnostic[];
  readonly phaseResolutionCursorEquivalent?: Readonly<CombatRoundPhaseResolutionCursor>;
  readonly roundNumber: number;
}
