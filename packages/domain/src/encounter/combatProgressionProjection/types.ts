import type {
  CombatRoundCommandCurrentTask,
  CombatRoundCommandType,
  CombatRoundCursor,
  CombatRoundCursorStep,
  CombatRoundPhase,
  CombatRoundPhaseResolutionCursor,
} from "../combatRoundManager";

export const COMBAT_PROGRESSION_BOUNDARIES = [
  "declaration",
  "phase1_modifier_review",
  "phase1_initiative",
  "phase1_resolution",
  "phase2_modifier_review",
  "phase2_initiative",
  "phase2_resolution",
  "round_end",
  "round_boundary",
] as const;

export type CombatProgressionBoundaryKind = (typeof COMBAT_PROGRESSION_BOUNDARIES)[number];

export type CombatProgressionProcessKind =
  | "adjust_distance"
  | "attack_decision"
  | "attack"
  | "combat_experience"
  | "boundary_transition"
  | "declaration"
  | "distance"
  | "effect_review"
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
  | "effect"
  | "decision"
  | "feasibility"
  | "health"
  | "hit_location"
  | "gm_adjustment"
  | "input"
  | "attacker_roll"
  | "defender_roll"
  | "participant"
  | "participant_response"
  | "response"
  | "proposal_commit"
  | "proposal_review"
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
  | "adjust_distance_adjustment"
  | "adjust_distance_attacker_roll"
  | "adjust_distance_commit"
  | "adjust_distance_defender_roll"
  | "adjust_distance_response"
  | "attack"
  | "combat_experience"
  | "critical"
  | "damage_review"
  | "distance_commit"
  | "distance_roll"
  | "double_attack_decision"
  | "feint_attacker_roll"
  | "feint_commit"
  | "feint_defender_roll"
  | "effect_review"
  | "gm_advance_boundary"
  | "health_review"
  | "hit_location"
  | "modifier_review"
  | "parry"
  | "participant_review"
  | "round_end_prepare"
  | "roll_initiative"
  | "commit_initiative"
  | "submit_declaration";

export type CombatProgressionExpectedCommand =
  | CombatRoundCommandType
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
  readonly healthRollId?: string;
  readonly opportunityId?: string;
  readonly opponentParticipantId?: string;
  readonly pairId?: string;
  readonly participantId?: string;
  readonly phase?: CombatRoundPhase;
  readonly proposalId?: string;
}

export interface CombatProgressionBoundaryTransition {
  readonly currentBoundary: CombatProgressionBoundaryKind;
  readonly requiredCompletedProcessIds: readonly string[];
  readonly targetBoundary: CombatProgressionBoundaryKind;
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
  readonly transition?: CombatProgressionBoundaryTransition;
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
  /** Stable source action-process plan identifier, when this process is adapter-derived. */
  readonly planId?: string;
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
  /** The last initiative order committed by the GM. Uncommitted rolls never appear here. */
  readonly executionOrder?: CombatProgressionExecutionOrder;
  readonly phaseResolutionCursorEquivalent?: Readonly<CombatRoundPhaseResolutionCursor>;
  readonly roundNumber: number;
}

export interface CombatProgressionExecutionOrder {
  readonly participantIds: readonly string[];
  readonly phase: CombatRoundPhase;
}

export interface CombatProgressionPresentationTask {
  readonly actorAccess: {
    readonly combatant: boolean;
    readonly gm: boolean;
  };
  readonly contributesToProgression: boolean;
  readonly id: string;
  readonly identity: {
    readonly executionGroupId: string;
    readonly phase?: CombatRoundPhase;
  };
  readonly kind: CombatProgressionTaskKind;
  readonly owner?: CombatProgressionTaskOwner;
  readonly processId: string;
  readonly stageId: string;
  readonly state: CombatProgressionTaskState;
  readonly trackerFacet: CombatProgressionTrackerFacet;
  readonly transition?: CombatProgressionBoundaryTransition;
}

export interface CombatProgressionPresentationStage {
  readonly executionStrategy: CombatProgressionExecutionStrategy;
  readonly id: string;
  readonly kind: CombatProgressionStageKind;
  readonly processId: string;
  readonly state: CombatProgressionStageState;
  readonly tasks: readonly CombatProgressionPresentationTask[];
}

export interface CombatProgressionPresentationProcess {
  readonly id: string;
  readonly kind: CombatProgressionProcessKind;
  readonly stages: readonly CombatProgressionPresentationStage[];
}

/** Sanitized live progression facts suitable for shared GM/player presentation. */
export interface CombatProgressionPresentationProjection {
  /** Player-safe indication that child work is complete and only the GM may open the next boundary. */
  readonly awaitingGmTransition: boolean;
  readonly boundary: {
    readonly id: string;
    readonly kind: CombatProgressionBoundaryKind;
    readonly roundNumber: number;
  };
  readonly executionOrder?: CombatProgressionExecutionOrder;
  readonly processes: readonly CombatProgressionPresentationProcess[];
  readonly roundNumber: number;
  /** False means relevant canonical facts conflict and live task presentation must fail closed. */
  readonly taskVisibility: "available" | "conflicted";
}
