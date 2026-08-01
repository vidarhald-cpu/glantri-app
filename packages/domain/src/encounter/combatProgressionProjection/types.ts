import type {
  CombatRoundCommandCurrentTask,
  CombatRoundCommandType,
  CombatRoundCursor,
  CombatRoundCursorStep,
  CombatRoundPhase,
  CombatRoundPhaseResolutionCursor,
  CombatRoundStep,
} from "../combatRoundManager";
import type { CombatParryPurpose, OffensiveParryRollPurpose } from "../combatOffensiveParry";

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

/** Shared visible tracker step for a boundary when its exact current task is ownerless or hidden. */
export function getCombatRoundStepForProgressionBoundary(
  boundary: CombatProgressionBoundaryKind,
): CombatRoundStep {
  switch (boundary) {
    case "declaration":
      return "select_actions";
    case "phase1_modifier_review":
      return "review_action_modifiers";
    case "phase1_initiative":
      return "initiative_phase_1";
    case "phase1_resolution":
      return "phase_1_actions";
    case "phase2_modifier_review":
      return "review_phase_2_modifiers";
    case "phase2_initiative":
      return "initiative_phase_2";
    case "phase2_resolution":
      return "phase_2_actions";
    case "round_end":
    case "round_boundary":
      return "round_summary";
  }
}

export type CombatProgressionProcessKind =
  | "adjust_distance"
  | "attack_decision"
  | "attack"
  | "combat_experience"
  | "continued_contact_maintenance"
  | "boundary_transition"
  | "declaration"
  | "distance"
  | "effect_review"
  | "feint"
  | "health_review"
  | "initiative"
  | "modifier_review"
  | "observation"
  | "offensive_parry"
  | "participant_review"
  | "round_end";

export type CombatProgressionStageKind =
  | "attack"
  | "boundary"
  | "commit"
  | "contest"
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
  | "opposed_rolls"
  | "offensive_parry_contest"
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
export type CombatProgressionExecutionGroupCompletionState = "complete" | "incomplete";
export type CombatProgressionTaskState = "executable" | "waiting";

export type CombatProgressionTaskKind =
  | "adjust_distance_adjustment"
  | "adjust_distance_attacker_roll"
  | "adjust_distance_commit"
  | "adjust_distance_defender_roll"
  | "adjust_distance_response"
  | "attack"
  | "combat_experience"
  | "continued_contact_maintenance_roll"
  | "critical"
  | "damage_roll"
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
  | "offensive_parry_brawling_roll"
  | "observation_roll"
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
  readonly actionId?: string;
  readonly attackIndex?: number;
  readonly attackModeId?: string;
  readonly attackResultId?: string;
  readonly attackerParticipantId?: string;
  readonly criticalResultId?: string;
  readonly contestId?: string;
  readonly continuedContactId?: string;
  readonly damageRollExpression?: string;
  readonly damageReviewId?: string;
  readonly declarationId?: string;
  readonly declaredOpponentParticipantId?: string;
  readonly defenderParticipantId?: string;
  readonly executionGroupId: string;
  readonly healthRollId?: string;
  readonly hitLocationResultId?: string;
  readonly initiativeGroupId?: string;
  readonly initiativeValue?: number;
  readonly opportunityId?: string;
  readonly offensiveParryAttemptId?: string;
  readonly observationAttemptId?: string;
  readonly parryPurpose?: CombatParryPurpose;
  readonly parryResultId?: string;
  readonly parrySourceId?: string;
  readonly rollPurpose?: OffensiveParryRollPurpose;
  readonly opponentParticipantId?: string;
  readonly pairId?: string;
  readonly participantId?: string;
  readonly phase?: CombatRoundPhase;
  readonly proposalId?: string;
  readonly relationshipId?: string;
  readonly weaponInstanceId?: string;
  readonly weaponSourceId?: string;
  readonly weaponSourceSlot?: string;
  readonly weaponTemplateId?: string;
}

export interface CombatProgressionPresentationReference {
  readonly id?: string;
  readonly label?: string;
}

/**
 * Viewer-sanitizable facts used to explain a projected task. These facts describe the task's
 * process context only; calculations, dice, proposal notes, and blockers deliberately stay out.
 */
export interface CombatProgressionTaskPresentationContext {
  readonly actionKind?: string;
  readonly attackOutcome?: "hit" | "miss";
  readonly actor?: CombatantIdentity;
  readonly distance?: {
    readonly current?: number;
    readonly direction?: string;
    readonly requested?: number;
  };
  readonly difficulty?: number;
  readonly damageRollExpression?: string;
  readonly reason?: string;
  readonly opponentRollRecorded?: boolean;
  readonly responder?: CombatantIdentity;
  readonly skill?: CombatProgressionPresentationReference;
  readonly target?: CombatantIdentity;
  readonly weapon?: CombatProgressionPresentationReference;
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
  readonly executionGroupId: string;
  readonly id: string;
  readonly identity: CombatProgressionTaskIdentity;
  readonly kind: CombatProgressionTaskKind;
  /** Visible combatant on the other side of this task, when the task has pair/target context. */
  readonly opponent?: CombatantIdentity;
  readonly owner?: CombatProgressionTaskOwner;
  readonly presentationContext?: CombatProgressionTaskPresentationContext;
  readonly processId: string;
  readonly stageId: string;
  readonly state: CombatProgressionTaskState;
  readonly trackerFacet: CombatProgressionTrackerFacet;
  readonly transition?: CombatProgressionBoundaryTransition;
}

export interface CombatProgressionExecutionGroupBoundaryMetadata {
  readonly id: string;
  readonly kind: CombatProgressionBoundaryKind;
  readonly roundNumber: number;
}

export interface CombatProgressionExecutionGroupDiagnostic {
  readonly code: "task_count_mismatch" | "task_identity_mismatch";
  readonly message: string;
  readonly relatedIds: readonly string[];
  readonly severity: "warning";
}

/**
 * The scheduling unit between a stage and its tasks. Most groups contain one task; explicitly
 * parallel mini-processes may place multiple independently executable tasks in one stable group.
 */
export interface CombatProgressionExecutionGroup {
  readonly activationBoundary: CombatProgressionExecutionGroupBoundaryMetadata;
  readonly blockerIds: readonly string[];
  readonly completionState: CombatProgressionExecutionGroupCompletionState;
  readonly diagnostics: readonly CombatProgressionExecutionGroupDiagnostic[];
  readonly executionStrategy: CombatProgressionExecutionStrategy;
  /** Reserved for a later activation slice; absent groups are eligible only in activationBoundary. */
  readonly futureActivationBoundary: CombatProgressionExecutionGroupBoundaryMetadata | undefined;
  readonly id: string;
  readonly position: number;
  readonly stageId: string;
  readonly tasks: readonly CombatProgressionTask[];
}

export interface CombatProgressionStage {
  readonly executionGroups: readonly CombatProgressionExecutionGroup[];
  /** Compatibility adapter; execution strategy is canonically owned by each execution group. */
  readonly executionStrategy: CombatProgressionExecutionStrategy;
  readonly id: string;
  readonly kind: CombatProgressionStageKind;
  readonly processId: string;
  readonly state: CombatProgressionStageState;
  /** Flattened compatibility adapter retained for existing task consumers. */
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
  readonly currentInitiativeGroupId?: string;
  readonly currentInitiativeValue?: number;
  readonly initiativeGroups?: readonly {
    readonly id: string;
    readonly initiativeValue: number;
    readonly opportunityIds: readonly string[];
    readonly participantIds: readonly string[];
    readonly status: "complete" | "current" | "waiting";
  }[];
  readonly participantIds: readonly string[];
  readonly phase: CombatRoundPhase;
}

export interface CombatProgressionPresentationTask {
  readonly actorAccess: {
    readonly combatant: boolean;
    readonly gm: boolean;
  };
  readonly contributesToProgression: boolean;
  readonly executionGroupId: string;
  readonly id: string;
  /** Immutable command identity retained without raw proposal or calculation contents. */
  readonly identity: CombatProgressionTaskIdentity;
  readonly expectedCommand: CombatProgressionExpectedCommand;
  readonly kind: CombatProgressionTaskKind;
  /** Sanitized opponent context for shared tracker presentation. */
  readonly opponent?: CombatantIdentity;
  readonly owner?: CombatProgressionTaskOwner;
  readonly presentationContext?: CombatProgressionTaskPresentationContext;
  readonly processId: string;
  readonly stageId: string;
  readonly state: CombatProgressionTaskState;
  readonly trackerFacet: CombatProgressionTrackerFacet;
  readonly transition?: CombatProgressionBoundaryTransition;
}

export interface CombatProgressionPresentationExecutionGroup {
  readonly activationBoundary: CombatProgressionExecutionGroupBoundaryMetadata;
  readonly blocked: boolean;
  readonly completionState: CombatProgressionExecutionGroupCompletionState;
  readonly executionStrategy: CombatProgressionExecutionStrategy;
  readonly futureActivationBoundary: CombatProgressionExecutionGroupBoundaryMetadata | undefined;
  readonly id: string;
  readonly position: number;
  readonly stageId: string;
  readonly tasks: readonly CombatProgressionPresentationTask[];
}

export interface CombatProgressionPresentationStage {
  readonly executionGroups: readonly CombatProgressionPresentationExecutionGroup[];
  /** Compatibility adapter; execution strategy is canonically owned by each execution group. */
  readonly executionStrategy: CombatProgressionExecutionStrategy;
  readonly id: string;
  readonly kind: CombatProgressionStageKind;
  readonly processId: string;
  readonly state: CombatProgressionStageState;
  /** Flattened compatibility adapter retained for existing presentation consumers. */
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
