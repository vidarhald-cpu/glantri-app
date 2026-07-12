import type {
  CombatRoundAttackRollResult,
  CombatRoundCommand,
  CombatRoundPhaseResolutionResult,
  CombatRoundStep,
  CombatRoundStepSnapshot,
  CombatRoundStepStatus,
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
  activeTask: boolean;
  attackResult?: CombatRoundAttackRollResult;
  commands: readonly CombatRoundCommand[];
  current: boolean;
  declarationSubmittedBy?: "gm" | "player";
  inspectable: boolean;
  initiativeTotal?: number;
  participantId: string;
  participantLabel: string;
  pendingDistanceControlCommitCount: number;
  pendingDistanceControlRollCount: number;
  pendingHealthCheckRollCount: number;
  phaseCombatExperienceMarkerRequired: boolean;
  phaseResolutionResult?: CombatRoundPhaseResolutionResult;
  roundNumber: number;
  selected: boolean;
  status: CombatRoundStepStatus;
  step: CombatRoundStep;
}

export interface CombatTrackerCellView {
  cellKey: string;
  current: boolean;
  hoverText: string;
  initiativeValue: boolean;
  inspectable: boolean;
  marker: string;
  markerKind: CombatTrackerMarkerKind;
  participantId: string;
  roundNumber: number;
  selected: boolean;
  step: CombatRoundStep;
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
