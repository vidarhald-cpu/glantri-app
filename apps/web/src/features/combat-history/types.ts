import type {
  CombatRoundAttackRollResult,
  CombatRoundCommand,
  CombatRoundInitiativeResult,
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

export type CombatTrackerAttention = "ordinary" | "exceptional";

export type CombatTrackerFacetStatus =
  | "unopened"
  | "open"
  | "waiting"
  | "completed"
  | "unsuccessful"
  | "historical";

export interface CombatTrackerHoverPresentation {
  actionLabel: string;
  actorLabel?: string;
  gmActionRequired: boolean;
  phaseLabel?: string;
  requiredActorLabel?: string;
  targetLabel?: string;
  text: string;
  waiting: boolean;
}

export interface CombatTrackerFacetPresentation {
  attention: CombatTrackerAttention;
  completed: boolean;
  current: boolean;
  executable: boolean;
  executionGroupIds: readonly string[];
  historical: boolean;
  hover: CombatTrackerHoverPresentation;
  marker: "·" | "?" | "✓" | "–" | "H" | "M" | `${number}`;
  status: CombatTrackerFacetStatus;
  taskIds: readonly string[];
  taskKinds: readonly CombatProgressionTaskKind[];
  waiting: boolean;
}

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
  adjustDistanceRollRecorded?: boolean;
  inspectable: boolean;
  initiativeCommitted?: boolean;
  initiativeResolutionType?: CombatRoundInitiativeResult["resolutionType"];
  initiativeRollRecorded?: boolean;
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

export interface CombatTrackerCellView extends CombatTrackerFacetPresentation {
  cellKey: string;
  gmProxyAvailable: boolean;
  /** Compatibility text consumed by the existing button/title rendering. */
  hoverText: string;
  initiativeValue: boolean;
  inspectable: boolean;
  markerKind: CombatTrackerMarkerKind;
  participantId: string;
  ownerParticipantIds: readonly string[];
  processIds: readonly string[];
  roundNumber: number;
  selected: boolean;
  stageIds: readonly string[];
  step: CombatRoundStep;
}

export interface CombatTrackerLiveFacet {
  attention: CombatTrackerAttention;
  current: boolean;
  executable: boolean;
  executionGroupIds: readonly string[];
  gmProxyAvailable: boolean;
  hover: CombatTrackerHoverPresentation;
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
  legend: readonly CombatTrackerLegendItem[];
  /** Cell used by operational auto-follow. It may be viewer-safe when the exact owner is hidden. */
  operationalCursorCellKey?: string;
  rounds: CombatTrackerRoundView[];
  rows: CombatTrackerRowView[];
  selectedCellKey?: string;
  steps: readonly CombatRoundStep[];
}
