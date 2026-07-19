import type {
  CombatRoundAttackRollResult,
  CombatRoundCommand,
  CombatRoundPhaseResolutionResult,
  CombatRoundStep,
  CombatRoundStepSnapshot,
  CombatRoundStepStatus,
  CombatHistoryStepOutcome,
  CombatProgressionTaskKind,
} from "@glantri/domain";

export type CombatTrackerMarkerKind =
  | "attack_hit"
  | "attack_miss"
  | "complete"
  | "skipped"
  | "required"
  | "roll_result"
  | "not_reached";

export interface CombatTrackerLegendItem {
  kind: CombatTrackerMarkerKind;
  label: string;
  marker: string;
  title: string;
}

export interface CombatTrackerRoundView {
  currentStep?: CombatRoundStep;
  roundNumber: number;
}

export interface CombatTrackerRowView {
  label: string;
  participantId: string;
  selected: boolean;
}

export interface CombatTrackerCellFacts {
  actionResultStatus?: CombatRoundStepSnapshot["actionResultStatus"];
  attackAttackerLabel?: string;
  attackDefenderLabel?: string;
  attackResult?: CombatRoundAttackRollResult;
  commands: readonly CombatRoundCommand[];
  declarationSubmittedBy?: "gm" | "player";
  feint?: {
    defenderLabel?: string;
    defenderPhase2Modifier?: number;
    method: "movement" | "weapon";
    status: "pending" | "committed" | "impossible";
  };
  adjustDistance?: {
    currentDistance: number;
    requestedDistance: number;
    committedDistance?: number;
    defenderLabel?: string;
    status: "pending" | "committed";
  };
  inspectable: boolean;
  initiativeTotal?: number;
  participantId: string;
  participantLabel: string;
  phaseResolutionResult?: CombatRoundPhaseResolutionResult;
  progression?: CombatTrackerLiveFacet;
  roundNumber: number;
  selected: boolean;
  status: CombatRoundStepStatus;
  step: CombatRoundStep;
  stepOutcome?: CombatHistoryStepOutcome;
}

export interface CombatTrackerCellView {
  cellKey: string;
  current: boolean;
  completed: boolean;
  executable: boolean;
  executionGroupIds: readonly string[];
  gmProxyAvailable: boolean;
  historical: boolean;
  hoverText: string;
  initiativeValue: boolean;
  inspectable: boolean;
  marker: string;
  markerKind: CombatTrackerMarkerKind;
  participantId: string;
  ownerParticipantIds: readonly string[];
  processIds: readonly string[];
  roundNumber: number;
  selected: boolean;
  status: "completed" | "executable" | "historical" | "not_reached" | "waiting";
  stageIds: readonly string[];
  step: CombatRoundStep;
  taskIds: readonly string[];
  taskKinds: readonly CombatProgressionTaskKind[];
  waiting: boolean;
}

export interface CombatTrackerLiveFacet {
  current: boolean;
  executable: boolean;
  executionGroupIds: readonly string[];
  gmProxyAvailable: boolean;
  ownerParticipantIds: readonly string[];
  processIds: readonly string[];
  stageIds: readonly string[];
  taskIds: readonly string[];
  taskKinds: readonly CombatProgressionTaskKind[];
  waiting: boolean;
}

export interface CombatTrackerModel {
  cells: Record<string, CombatTrackerCellView>;
  currentTaskCellKey?: string;
  legend: CombatTrackerLegendItem[];
  rounds: CombatTrackerRoundView[];
  rows: CombatTrackerRowView[];
  selectedCellKey?: string;
  steps: readonly CombatRoundStep[];
}
