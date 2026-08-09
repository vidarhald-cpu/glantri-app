"use client";

import {
  forwardRef,
  Profiler,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CombatRoundDeclaration,
  CombatNpcDeclarationProposal,
  CombatProgressionBoundaryKind,
  CombatRoundAttackDirection,
  CombatRoundAttackRollResult,
  CombatRoundCommandEnvelope,
  CombatRoundCombatExperienceResult,
  CombatRoundDamageArmorCoverage,
  CombatRoundDamageReview,
  CombatRoundDamageReviewAdditionalEffect,
  CombatRoundDamageResult,
  CombatRoundPhaseDamageCommitReadiness,
  CombatRoundState,
  CombatRoundParryResolution,
  CombatRoundParryModifierBreakdownEntry,
  CombatRoundPhase,
  CombatRoundPhaseResolutionResult,
  CombatRoundStep,
  CombatRoundStepStatus,
  CombatRoundInitiativeRank,
  CombatRoundStepSnapshot,
  CombatStepAutomationRunResult,
  CombatDistance,
  CombatDistanceEdge,
  EncounterSession,
  MovementIntent,
  CombatRoundEndReview,
  CombatRoundEndDistanceProposal,
  RoundEndParticipantReview,
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  ScenarioParticipant,
  ScenarioParticipantCombatContext,
  ScenarioParticipantSecondaryActionContext,
  WeaponTemplate,
} from "@glantri/domain";
import {
  COMBAT_FEINT_OUTCOME_TABLE,
  COMBAT_ROUND_STEP_LABELS,
  buildCombatRoundPhaseResolutionResult,
  buildLiveCombatModifierContributionProjection,
  buildCombatRoundDamageArmorCoverageFromEquipmentState,
  buildCombatRoundInspector,
  canBackOutCombatRoundPhaseAttack,
  canClearCombatRoundStep,
  characterBuildSchema,
  canonicalCombatModifierEffectSchema,
  combatRoundStateSchema,
  combatRoundParticipantHasExecutablePhaseAction,
  combatRoundParticipantHasPhaseAttack,
  deriveCombatHistoryStepOutcome,
  ensureDistanceEdgesForParticipantPairs,
  formatOpenEndedD20RollBreakdown,
  getCombatDistanceParticipantAliases,
  getCombatRoundAttackResultById,
  getParticipantCombatExperienceSkillTotalLookup,
  getCombatRoundCombatExperienceDifficulty,
  getCombatRoundInitiativePhaseForStep,
  getCombatRoundPhaseInitiativeChoice,
  getCombatRoundPhaseCombatExperienceRequirement,
  getCombatRoundRequiredCombatExperienceTrigger,
  getCombatRoundDamageSubstate,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundEffectiveCriticalRoll,
  getCombatRoundEffectiveDamageResult,
  getCombatRoundPhaseDamageCommitReadiness,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundPhaseAttackBackOutOpportunity,
  getCombatRoundParticipantPhaseStepStatus,
  getCombatRoundPhaseResolutionResultForAttack,
  getCombatRoundPhaseResolutionStatus,
  getCombatRoundTimelineRoundStates,
  getCombatRoundInitiativeRanks,
  getCombatRoundEndDistanceProposalLifecycle,
  getCombatRoundModifierPhaseForStep,
  getCombatRoundNextEventSequence,
  getCombatRoundResolutionPhaseForStep,
  getCombatRoundStepSnapshot,
  getHitLocationFullLabel,
  getFinalCriticalRollIndexStatus,
  HIT_LOCATIONS,
  hasScenarioParticipantCombatDeclarationForEncounterRound,
  initializeCombatRoundState,
  isCombatRoundCombatExperienceWindowOpen,
  isCombatRoundPhaseInitiativeResolutionOpen,
  hasCombatRoundCombatExperienceRoll,
  getWeaponPreferredDistances,
  reviewCombatRoundDamageResult,
  projectCombatNpcDeclarationProposal,
  validateCombatDeclarationTargets,
} from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  buildCombatStateCharacterInputs,
  type WorkbookRawModifier,
} from "@glantri/rules-engine";

import {
  buildCombatStepResultPresentation,
  buildCombatCalculationPresentationLines,
  buildCombatCalculationPresentationFromSnapshot,
  buildDodgeCalculationPresentationFromSnapshot,
  buildRecordedCombatModifierRows,
  CombatEventResultList,
  CombatLog,
  CombatStepResultList,
  CombatTracker,
  createDefaultCombatLogSelection,
  formatSignedCombatModifier,
  labelCurrentActionAsDeclarationEdit,
  reconcileCombatLogSelection,
  resolveCombatTaskCommandContext,
  resolveCombatHistoryPanelSnapshot,
  type CombatCalculationPresentation,
  selectCombatLogEvent,
  selectCombatEventsForTrackerCell,
  type CombatLogEventSelection,
  type CurrentActionCommandDescriptor,
} from "@/features/combat-history";
import { buildEquipmentLoadoutModuleModel } from "@/features/equipment/loadoutModule";
import { buildCombatNpcDeclarationProposalPresentation } from "./view-models/combatNpcDeclarationProposalPresentation";
import { buildGmCombatParryModifierRequest } from "./gmCombatParryRequest";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import {
  advanceDeterministicCombatOnServer,
  advanceCombatRoundCurrentStepOnServer,
  backOutPhaseAttackOnServer,
  clearCurrentCombatRoundStepOnServer,
  commitPhaseInitiativeResolutionOnServer,
  commitCurrentCombatPhaseDamageOnServer,
  continuePhaseAttackOnServer,
  decideDoubleAttackPhase2OnServer,
  rollCombatFeintOnServer,
  commitCombatFeintOnServer,
  respondCombatAdjustDistanceOnServer,
  reviewCombatAdjustDistanceOnServer,
  rollCombatAdjustDistanceOnServer,
  commitCombatAdjustDistanceOnServer,
  commitRoundEndDistanceControlOnServer,
  commitRoundEndParticipantReviewOnServer,
  rollCombatAttackOnServer,
  rollCombatExperienceOnServer,
  rollCombatInitiativeOnServer,
  rollCombatParryCommandOnServer,
  rollCombatObservationOnServer,
  rollContinuedContactMaintenanceOnServer,
  rollOffensiveParryBrawlingOnServer,
  rollCombatCriticalOnServer,
  rollCombatHitLocationOnServer,
  rollCurrentRoundEndDistanceControlOnServer,
  rollRoundEndHealthCheckOnServer,
  runGmCombatStepWorkflowOnServer,
  saveCurrentCombatDamageReviewOnServer,
  resolveCurrentCombatPhaseDamageOnServer,
  setCombatExperienceDifficultyOnServer,
  setPairDistanceOnServer,
  skipCurrentCombatPhaseActionOnServer,
  submitCombatDeclarationOnServer,
  loadEncounterById,
} from "@/lib/api/encounterClient";
import {
  beginCombatPerformanceInteraction,
  combatPerformanceNow,
  measureCombatPerformanceStage,
  recordCombatPerformanceAdoption,
  recordCombatPerformanceReactCommit,
  recordCombatPerformanceStage,
  settleCombatPerformanceInteraction,
} from "@/lib/performance/combatPerformance";
import { ApiRequestError } from "@/lib/api/apiClient";
import { loadScenarioParticipants } from "@/lib/api/scenarioClient";
import {
  loadCharacterEquipmentState,
  loadServerCharacterById,
  type ServerCharacterRecord,
} from "@/lib/api/localServiceClient";
import {
  buildAdjustDistanceGmAdjustmentRequest,
  type AdjustDistanceAdjustmentDraft,
  type AdjustDistanceAdjustmentDraftHandle,
} from "./adjustDistanceAdjustmentDraft";
import {
  buildPlayerCombatModifierRows,
  formatCombatInitiativeFormula,
  getGmCombatStepActionLabel,
  getPlayerCombatStepLabel,
  PlayerCombatActionButtonPanel,
  PlayerCombatActionResultPanel,
  PlayerCombatActionSelectorPanel,
  PlayerCombatHistoricalActionSelectorPanel,
  PlayerCombatHistoricalContextPanel,
  type PlayerCombatDistancePreferenceOption,
  type PlayerCombatAttackStatsView,
  PlayerCombatAttackLocationSelector,
  PlayerCombatAttackModeSelector,
  PlayerCombatAttackStatsTable,
  PlayerCombatAttackTargetSelector,
  PlayerCombatDefenseStatsTable,
  PlayerCombatModifierPanel,
  PlayerCombatObservationProgress,
  PlayerCombatOpponentSelector,
  PlayerCombatParryContextPanel,
  PlayerCombatPhasePanel,
  playerCombatPanelCardStyle,
  playerCombatPanelRowStyle,
  playerCombatTopPanelRowStyle,
  sanitizePlayerCombatModifierContext,
  type PlayerCombatModifierBucketView,
  type PlayerCombatPhaseCardView,
} from "@/features/player-combat/PlayerCombatPanels";
import {
  buildFeintSkillPreview,
  FeintSkillPreview,
} from "@/features/player-combat/FeintSkillPreview";
import {
  buildCombatParticipantCandidates,
  type CombatParticipantRosterEntry,
} from "@/features/player-combat/combatParticipantCandidates";
import {
  collectCanonicalCombatSituationEffects,
  type CombatSituationDisplayRow,
} from "@/features/player-combat/combatSituationAwareness";
import { getPlayerCombatModifierDisplayPhase } from "@/features/player-combat/playerCombatModifierPhase";
import {
  canAcceptCombatRoundViewRevision,
  type CombatRoundViewState,
  getCombatRoundDescriptorRevision,
  updateCombatRoundViewState,
} from "./combatRoundViewState";
import { buildGmCombatAttackModifierRequest } from "./gmCombatAttackRequest";
import {
  applyDefaultPlayerCombatPhaseContext,
  buildCombatDeclarationAttackSelection,
  buildPlayerCombatDefenseStats,
  buildPlayerCombatLoadoutSummary,
  buildPlayerCombatPhasePanelModel,
  formatScenarioCombatEquipmentDiagnostic,
  getScenarioCombatEquipmentStatus,
  isEquipmentFeatureState,
  resolveCombatFeintDeclarationRequestTarget,
  resolveCombatFeintWeaponSkill,
  resolveCanonicalCombatTargetIdentity,
  resolveCombatEquipmentCharacterId,
  resolveScenarioCombatEquipmentState,
  type PlayerCombatPhaseKey,
} from "@/features/player-combat/playerCombatPhaseModel";
import {
  buildEncounterDbParryModifierCalculation,
  buildEncounterInitiativeModifierCalculation,
  buildEncounterLiveCombatModifierSummary,
  buildTargetAwareEncounterLiveCombatModifierSummary,
  resolveEncounterLiveCombatModifierContext,
} from "@/lib/campaigns/liveCombatModifiers";
import {
  createEmptyPlayerEncounterCombatContext,
  getPlayerEncounterActionLabel,
  getPlayerEncounterMovementLabel,
  isPlayerEncounterActionId,
  mergeCombatContextWithCurrentModifierBuckets,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "@/lib/campaigns/playerEncounter";
import { loadCanonicalContent } from "@/lib/content/loadCanonicalContent";
import {
  getCombatRoundManagerInspectionSelection,
  getCurrentCombatRoundTaskSelection,
  getNextCombatRoundParticipantSelection,
  isCombatRoundInspectionSelectionLive,
  isGlobalCombatRoundParticipantStep,
  type CombatRoundSelectionTarget,
} from "./combatRoundSelection";
import { buildAdjustDistanceReviewPresentation } from "./adjustDistanceReviewPresentation";
import { resolveHistoricalFeintSkillLabel } from "./view-models/historicalFeintPresentation";
import { projectCombatActionGeneratedModifiers } from "./combatDistanceModifierProjection";
import { buildCombatRoundPhasePanelProjection } from "./combatRoundPhasePanelProjection";
import {
  getCombatRoundTimelineArrowMove,
  getAdjacentCombatRoundTimelineParticipantSelection,
  getAdjacentCombatRoundTimelineStepSelection,
  getCombatRoundTimelineCellKey,
  getParticipantIdsForTimelineRound,
  type CombatRoundTimelineSelection,
} from "./combatRoundTimelineNavigation";
import {
  scrollCombatRoundTimelineCellIntoView,
  type CombatRoundTimelineScrollMode,
} from "./combatRoundTimelineScroll";
import { buildCombatBoundaryTransitionAction } from "./combatBoundaryTransitionAction";
import {
  buildActiveAttackResolutionPresentation,
  buildActiveInspectorCorePresentation,
  projectGmCombatEvents,
} from "./view-models/activeInspectorPresentation";
import { getOrCreateCombatModifierReviewInputSnapshot } from "./view-models/modifierReviewInputSnapshot";
import { buildCombatStepWorkflowStatusPresentation } from "./view-models/combatStepWorkflowStatus";
import {
  createCombatRecentResultCandidate,
  resolveCombatRecentResultFocus,
  selectCombatRecentResultPresentation,
  type CombatRecentResultCandidate,
  type CombatRecentResultFocus,
} from "./view-models/combatRecentResultFocus";
import {
  applyCombatTrackerSelectionOverlay,
  buildActiveCombatPresentation,
  buildArchivedCombatPresentation,
  buildArchivedCombatPresentationIdentity,
  buildCombatPendingOverlay,
  buildCombatSelectionOverlay,
  buildCombatTrackerBasePresentation,
  composeCombatPresentationModel,
  createCombatPresentationLayerCache,
} from "./view-models/combatPresentationModel";

interface CombatRoundManagerPanelProps {
  encounter: EncounterSession;
  onEncounterUpdated?: (encounter: EncounterSession) => void;
  onScenarioParticipantsUpdated?: (participants: ScenarioParticipant[]) => void;
  scenarioParticipants?: ScenarioParticipant[];
}

type PhaseAttackChoiceSelection = "continue" | "back_out";
type DoubleAttackPhase2Decision = "continue" | "cancel";

type InspectorCurrentActionOutcomeSelection = "perform" | "skip" | "complete_remaining";

type RoundEndDistanceRollOption = {
  key: string;
  pairLabel: string;
  participantId: string;
  participantLabel: string;
  proposal: CombatRoundEndDistanceProposal;
};

const panelStyle = {
  background: "#fbfaf7",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "1rem",
  padding: "1rem",
} as const;

const distanceMatrixCellBorder = "1px solid #d8d6cf";
const distanceMatrixCellSize = "2.75rem";

const distanceMatrixCellStyle = {
  border: distanceMatrixCellBorder,
  boxSizing: "border-box",
  height: "2rem",
  maxWidth: distanceMatrixCellSize,
  minWidth: distanceMatrixCellSize,
  padding: 0,
  textAlign: "center",
  verticalAlign: "middle",
  width: distanceMatrixCellSize,
} as const;

const distanceMatrixRowHeaderStyle = {
  border: distanceMatrixCellBorder,
  boxSizing: "border-box",
  maxWidth: "9.5rem",
  minWidth: "9.5rem",
  overflow: "hidden",
  padding: "0.22rem 0.35rem",
  textAlign: "left",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const distanceMatrixColumnHeaderStyle = {
  boxSizing: "border-box",
  height: "4.75rem",
  maxWidth: distanceMatrixCellSize,
  minWidth: distanceMatrixCellSize,
  overflow: "visible",
  padding: 0,
  position: "relative",
  verticalAlign: "bottom",
  width: distanceMatrixCellSize,
} as const;

const distanceMatrixColumnHeaderTextStyle = {
  bottom: "0.1rem",
  display: "inline-block",
  fontSize: "0.75rem",
  left: "50%",
  lineHeight: 1.05,
  maxWidth: "6.5rem",
  overflow: "hidden",
  position: "absolute",
  textOverflow: "ellipsis",
  transform: "translateX(-0.15rem) rotate(-45deg)",
  transformOrigin: "bottom left",
  whiteSpace: "nowrap",
  width: "6.5rem",
} as const;

const distanceMatrixInputStyle = {
  border: "0",
  boxSizing: "border-box",
  height: "1.85rem",
  textAlign: "center",
  width: "100%",
} as const;

const combatReviewRowHeaderStyle = {
  borderBottom: "1px solid #ddd3bf",
  color: "#5e5a50",
  padding: "0.25rem 0.35rem",
  textAlign: "left",
} as const;

const combatReviewRowCellStyle = {
  borderBottom: "1px solid #ede6d8",
  padding: "0.25rem 0.35rem",
  verticalAlign: "top",
} as const;

const combatDamageReviewSectionStyle = {
  borderTop: "1px solid #e6e0d2",
  display: "grid",
  gap: "0.5rem",
  paddingTop: "0.55rem",
} as const;

const combatDamageReviewSectionHeadingStyle = {
  fontSize: "0.9rem",
} as const;

const combatDamageReviewHelperTextStyle = {
  color: "#5e5a50",
  fontSize: "0.85rem",
} as const;

const inspectorNavStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
} as const;

const compactFieldLabelStyle = {
  display: "grid",
  gap: "0.2rem",
} as const;

interface CombatInspectorDeclarationDraft {
  actionId: PlayerEncounterActionId | "";
  additionalActionNotes: string;
  combatContext: ScenarioParticipantCombatContext;
  movementId: PlayerEncounterMovementId | "";
  movementIntent: MovementIntent;
  phaseContexts: CombatInspectorPhaseContextDrafts;
  secondaryActionContext?: ScenarioParticipantSecondaryActionContext;
  secondaryActionId: PlayerEncounterActionId | "";
  feintMethod: "movement" | "weapon";
  feintSkillId: string;
}

interface CombatInspectorPhaseContextDrafts {
  phase1: ScenarioParticipantCombatContext;
  phase2: ScenarioParticipantCombatContext;
}

type CombatInspectorSourceMode = "current" | "history";

interface CombatParrySourceOption {
  label: string;
  score: number;
}

interface CombatParrySourceOptions {
  combinedLabel?: string;
  combinedScore?: number;
  mainHand?: CombatParrySourceOption;
  offHand?: CombatParrySourceOption;
}

interface CombatParrySourceSelection {
  usedMainHand: boolean;
  usedOffHand: boolean;
}

interface CombatDamageReviewAdditionalEffectDraft {
  accepted: boolean;
  durationRounds: string;
  effectOrder?: number;
  id: string;
  kind: CombatRoundDamageReviewAdditionalEffect["kind"];
  label: string;
  minDamageReason?: string;
  minTotalDamage?: number;
  modifierBucket: string;
  modifierValue: string;
  notes: string;
  phase: string;
  rateValuePerRound: string;
  rowCategory?: CombatRoundDamageReviewAdditionalEffect["rowCategory"];
  rollReports?: CombatRoundDamageReviewAdditionalEffect["rollReports"];
  sourceCritKey?: string;
  sourceEffectKey?: string;
  sourceText?: string;
  sourceKind?: CombatRoundDamageReviewAdditionalEffect["sourceKind"];
}

interface CombatDamageReviewOperationalConsequenceDraft {
  accepted: boolean;
  hand: "" | "mainHand" | "offHand" | "unknown";
  id: string;
  itemId: string;
  itemLabel: string;
  kind: "drop_item" | "cancel_pending_action" | "note";
  label: string;
  notes: string;
  participantId: string;
  phase: "" | "phase1" | "phase2";
  reason: string;
  sourceCritKey?: string;
  sourceEffectKey?: string;
  sourceText?: string;
  step: "" | "A1" | "A2";
  targetActionId: string;
}

interface CombatDamageReviewDraft {
  additionalEffects: CombatDamageReviewAdditionalEffectDraft[];
  attackDirectionOverride: CombatRoundAttackDirection;
  armorCriticalModifierOverride: string;
  armorModifierOverride: string;
  criticalGradeOverride: string;
  criticalLocationOverride: string;
  criticalTypeModifierOverride: string;
  finalCriticalRollOverride: string;
  notes: string;
  operationalConsequences: CombatDamageReviewOperationalConsequenceDraft[];
  selectedHitLocationOverride: string;
  totalDamageOverride: string;
}

interface CombatActionResultSection {
  calculations: readonly CombatCalculationPresentation[];
  resultLine?: string;
  title: string;
}

function buildInspectorPhaseContexts(
  participant?: ScenarioParticipant,
  declaration?: CombatRoundDeclaration,
  scope?: { encounterId?: string; roundNumber?: number },
): CombatInspectorPhaseContextDrafts {
  const scopedCombat = hasScenarioParticipantCombatDeclarationForEncounterRound({
    encounterId: scope?.encounterId,
    participant,
    roundNumber: scope?.roundNumber,
  })
    ? participant?.state.combat
    : undefined;
  const fallbackContext = mergeCombatContextWithCurrentModifierBuckets({
    baseContext: declaration?.combatContext ?? scopedCombat?.combatContext,
    currentContext: declaration
      ? (declaration.combatContext ?? scopedCombat?.combatContext)
      : scopedCombat?.combatContext,
  });

  return {
    phase1: applyDefaultPlayerCombatPhaseContext(
      declaration?.phaseContexts?.phase1 ?? fallbackContext,
    ),
    phase2: applyDefaultPlayerCombatPhaseContext(
      declaration?.phaseContexts?.phase2 ?? fallbackContext,
    ),
  };
}

function isSequentialResolutionStep(step: CombatRoundStep): boolean {
  return (
    step === "phase_1_actions" ||
    step === "review_phase_2_actions" ||
    step === "phase_1_damage" ||
    step === "phase_2_actions" ||
    step === "review_phase_2_damage" ||
    step === "phase_2_damage"
  );
}

function getBoundaryTransitionButtonLabel(target: CombatProgressionBoundaryKind): string {
  switch (target) {
    case "phase1_modifier_review":
      return "Advance to M1";
    case "phase1_initiative":
      return "Open Phase 1 initiative";
    case "phase2_modifier_review":
      return "Open Phase 2";
    case "phase2_initiative":
      return "Open Phase 2 initiative";
    case "round_end":
      return "Begin round end";
    case "declaration":
      return "Start next round";
    default:
      return "Advance combat";
  }
}

function formatCombatExperienceStatus(result?: CombatRoundCombatExperienceResult): string {
  if (!result) {
    return "Not rolled";
  }

  const isPhaseResult = result.trigger !== "combat_start";

  if (result.noRollRequired) {
    return isPhaseResult ? "Attack continues, no roll required" : "Active, no roll required";
  }

  if (
    isPhaseResult &&
    result.effectiveTableTotal !== undefined &&
    result.effectiveTableTotal <= 5
  ) {
    return "No attack made";
  }

  if (isPhaseResult && result.modifierValue < 0) {
    return `Attack continues, OB ${result.modifierValue}`;
  }

  if (!result.needsEffectRow || result.modifierValue === 0) {
    return isPhaseResult ? "Attack continues, no modifier" : "Active, no modifier";
  }

  return `${result.label} ${result.modifierValue}, duration ${result.durationRounds}`;
}

function createModifierEntryDraft(): ScenarioCombatModifierEntry {
  return {
    application: "percentage",
    id: `modifier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    notes: "",
    scope: "until",
    value: 0,
  };
}

function buildDeclarationDraft(
  participant?: ScenarioParticipant,
  declaration?: CombatRoundDeclaration,
  scope?: { encounterId?: string; roundNumber?: number },
): CombatInspectorDeclarationDraft {
  const scopedCombat = hasScenarioParticipantCombatDeclarationForEncounterRound({
    encounterId: scope?.encounterId,
    participant,
    roundNumber: scope?.roundNumber,
  })
    ? participant?.state.combat
    : undefined;

  return {
    actionId: isPlayerEncounterActionId(declaration?.actionId)
      ? declaration.actionId
      : isPlayerEncounterActionId(scopedCombat?.lastDeclaredActionId)
        ? scopedCombat.lastDeclaredActionId
        : "",
    additionalActionNotes:
      declaration?.additionalActionNotes ?? scopedCombat?.lastDeclarationNotes ?? "",
    combatContext: mergeCombatContextWithCurrentModifierBuckets({
      baseContext: declaration?.combatContext ?? scopedCombat?.combatContext,
      currentContext: declaration
        ? (declaration.combatContext ?? scopedCombat?.combatContext)
        : scopedCombat?.combatContext,
    }),
    movementId: (declaration?.movementId ??
      scopedCombat?.lastDeclaredMovementId ??
      "hold") as PlayerEncounterMovementId,
    movementIntent:
      declaration?.movementIntent ??
      scopedCombat?.lastMovementIntent ??
      createDefaultMovementIntent(),
    phaseContexts: buildInspectorPhaseContexts(participant, declaration, scope),
    secondaryActionContext: declaration?.secondaryActionContext,
    secondaryActionId: isPlayerEncounterActionId(declaration?.secondaryActionId)
      ? declaration.secondaryActionId
      : isPlayerEncounterActionId(scopedCombat?.lastDeclaredSecondaryActionId)
        ? scopedCombat.lastDeclaredSecondaryActionId
        : "",
    feintMethod: declaration?.feint?.method ?? "movement",
    feintSkillId: declaration?.feint?.attackerSkillId ?? "dodge",
  };
}

function buildInspectorDraftKey(input: {
  declaration?: CombatRoundDeclaration;
  participantId?: string;
}): string | undefined {
  if (!input.participantId) {
    return undefined;
  }

  return [
    input.participantId,
    input.declaration?.roundNumber ?? "no-round-declaration",
    input.declaration?.submittedAt ?? "no-submission-time",
  ].join(":");
}

function getCombatInspectorSourceLabel(mode: CombatInspectorSourceMode): string | undefined {
  switch (mode) {
    case "current":
      return undefined;
    case "history":
      return "History";
  }
}

function createUnrecordedHistoricalPhaseContext(): ScenarioParticipantCombatContext {
  return applyDefaultPlayerCombatPhaseContext(createEmptyPlayerEncounterCombatContext());
}

function buildHistoricalInspectorPhaseContexts(
  snapshot: CombatRoundStepSnapshot,
): CombatInspectorPhaseContextDrafts {
  return {
    phase1:
      snapshot.phase === "phase1" && snapshot.phaseContext
        ? snapshot.phaseContext
        : createUnrecordedHistoricalPhaseContext(),
    phase2:
      snapshot.phase === "phase2" && snapshot.phaseContext
        ? snapshot.phaseContext
        : createUnrecordedHistoricalPhaseContext(),
  };
}

function buildInspectorDisplayDraft(input: {
  draft: CombatInspectorDeclarationDraft;
  snapshot?: CombatRoundStepSnapshot;
}): CombatInspectorDeclarationDraft {
  if (!input.snapshot) {
    return input.draft;
  }

  return {
    actionId:
      (input.snapshot.declarationSummary?.actionId as PlayerEncounterActionId | undefined) ?? "",
    additionalActionNotes: input.snapshot.declarationSummary?.additionalActionNotes ?? "",
    combatContext: createEmptyPlayerEncounterCombatContext(),
    movementId:
      (input.snapshot.declarationSummary?.movementId as PlayerEncounterMovementId | undefined) ??
      "",
    movementIntent:
      input.snapshot.declarationSummary?.movementIntent ?? createDefaultMovementIntent(),
    phaseContexts: buildHistoricalInspectorPhaseContexts(input.snapshot),
    secondaryActionContext: input.snapshot.declarationSummary?.secondaryActionContext,
    feintMethod: input.snapshot.declarationSummary?.feint?.method ?? input.draft.feintMethod,
    feintSkillId:
      input.snapshot.declarationSummary?.feint?.attackerSkillId ?? input.draft.feintSkillId,
    secondaryActionId:
      (input.snapshot.declarationSummary?.secondaryActionId as
        | PlayerEncounterActionId
        | undefined) ?? "",
  };
}

function getModifierBucketContextKey(
  bucket: ScenarioCombatModifierBucket,
): keyof ScenarioParticipantCombatContext["modifierBuckets"] {
  switch (bucket) {
    case "general":
      return "general";
    case "situation_db":
      return "situationDb";
    case "situation_initiative":
      return "situationInitiative";
    case "situation_ob_skill":
      return "situationObSkill";
  }
}

function createDefaultMovementIntent(): MovementIntent {
  return {
    distancePreferences: [],
    mode: "hold_position",
  };
}

function hasCombatRoundDeclarationAction(declaration?: CombatRoundDeclaration): boolean {
  return Boolean(
    declaration?.actionId ||
    declaration?.secondaryActionId ||
    declaration?.movementId ||
    declaration?.movementIntent ||
    declaration?.additionalActionNotes ||
    declaration?.combatContext ||
    declaration?.phaseContexts,
  );
}

function formatSnapshotInitiativeRankLabel(rank?: CombatRoundInitiativeRank): string | undefined {
  if (!rank) {
    return undefined;
  }

  const tieLabel = rank.tiedCount > 1 ? ` (tied with ${rank.tiedCount})` : "";

  return `Rank: ${rank.rank} of ${rank.rankTotal}${tieLabel}`;
}

function formatCombatAttackResultMainLine(result: CombatRoundAttackRollResult): string {
  const rollText = formatOpenEndedD20RollBreakdown({
    dieResult: result.rollTotal,
    openEndedD10s: result.openEndedD10s,
    rollD20: result.rollD20,
  });

  return `Main: ${result.weaponName} OB ${result.ob} - DB ${result.defenderDb} + roll ${rollText} = ${result.lookupTotal}`;
}

function formatCombatDefenseResultMainLine(result: CombatRoundAttackRollResult): string {
  const rollText = formatOpenEndedD20RollBreakdown({
    dieResult: result.rollTotal,
    openEndedD10s: result.openEndedD10s,
    rollD20: result.rollD20,
  });

  return `Defense: DB ${result.defenderDb} vs ${result.weaponName} OB ${result.ob} + roll ${rollText} = ${result.lookupTotal}`;
}

function formatCombatAttackResultLine(input: {
  participantId?: string;
  result: CombatRoundAttackRollResult;
}): string {
  return input.participantId === input.result.defenderParticipantId
    ? formatCombatDefenseResultMainLine(input.result)
    : formatCombatAttackResultMainLine(input.result);
}

function buildRoundEndDistancePairLabel(
  proposal: CombatRoundEndDistanceProposal,
  participantLabelsById: Record<string, string>,
): string {
  const participantALabel =
    participantLabelsById[proposal.participantAId] ?? proposal.participantAId;
  const participantBLabel =
    participantLabelsById[proposal.participantBId] ?? proposal.participantBId;

  return `${participantALabel} ↔ ${participantBLabel}`;
}

function buildRoundEndDistanceRollOptionKey(input: {
  participantId: string;
  proposalId: string;
}): string {
  return JSON.stringify([input.proposalId, input.participantId]);
}

function isRoundEndDistanceCommitReady(proposal: CombatRoundEndDistanceProposal): boolean {
  return proposal.accepted && getCombatRoundEndDistanceProposalLifecycle(proposal) === "resolved";
}

function getRoundEndDistancePendingRollOptions(input: {
  participantLabelsById: Record<string, string>;
  proposals: readonly CombatRoundEndDistanceProposal[];
}): RoundEndDistanceRollOption[] {
  return input.proposals.flatMap((proposal) => {
    if (
      !proposal.accepted ||
      (proposal.status !== "pending" && proposal.status !== "pending_rolls")
    ) {
      return [];
    }

    const pairLabel = buildRoundEndDistancePairLabel(proposal, input.participantLabelsById);

    return [
      {
        participantId: proposal.participantAId,
        side: proposal.participantA,
      },
      {
        participantId: proposal.participantBId,
        side: proposal.participantB,
      },
    ]
      .filter((entry) => entry.side.status === "pending")
      .map((entry) => {
        const participantLabel =
          input.participantLabelsById[entry.participantId] ?? entry.participantId;

        return {
          key: buildRoundEndDistanceRollOptionKey({
            participantId: entry.participantId,
            proposalId: proposal.id,
          }),
          pairLabel,
          participantId: entry.participantId,
          participantLabel,
          proposal,
        };
      });
  });
}

function buildCombatAttackResultPanel(input: {
  participantId?: string;
  result: CombatRoundAttackRollResult;
}) {
  return {
    interpretedResult: formatCombatAttackResultLine({
      participantId: input.participantId,
      result: input.result,
    }),
    resultLabel: `Result: ${input.result.tableResult}`,
    sections: [
      {
        calculations: [
          buildCombatCalculationPresentationFromSnapshot({
            calculationId: [
              input.result.phase,
              input.result.attackerParticipantId,
              input.result.defenderParticipantId,
              input.result.attackOpportunityId ?? "default",
              "attack",
            ].join(":"),
            calculationType: "attack",
            facts: { ...input.result },
            label: "To hit",
          }),
        ].filter((entry): entry is CombatCalculationPresentation => Boolean(entry)),
        resultLine: `Result: ${formatCombatAttackTableResultLabel(input.result.tableResult)}`,
        title: "To hit",
      },
    ],
  };
}

function formatCombatParryModifierBreakdown(input: {
  fallbackAdjustment: number;
  modifiers?: readonly CombatRoundParryModifierBreakdownEntry[];
}): string {
  const modifiers = input.modifiers?.filter((modifier) => modifier.value !== 0) ?? [];

  if (modifiers.length === 0) {
    return `mods ${formatSignedCombatModifier(input.fallbackAdjustment)}`;
  }

  return modifiers
    .map((modifier) => `${modifier.label} ${formatSignedCombatModifier(modifier.value)}`)
    .join(" + ");
}

function formatCombatParryCalculationLine(
  resolution: CombatRoundParryResolution,
): string | undefined {
  if (
    resolution.status !== "resolved" ||
    resolution.combinedParryScore === undefined ||
    resolution.modifierAdjustment === undefined ||
    resolution.rollD20 === undefined ||
    resolution.rollTotal === undefined ||
    resolution.total === undefined
  ) {
    return undefined;
  }

  const rollText = formatOpenEndedD20RollBreakdown({
    dieResult: resolution.rollTotal,
    openEndedD10s: resolution.openEndedD10s,
    rollD20: resolution.rollD20,
  });
  const modifierText = formatCombatParryModifierBreakdown({
    fallbackAdjustment: resolution.modifierAdjustment,
    modifiers: resolution.modifierBreakdown,
  });
  const sourcePrefix = resolution.parrySourceLabel
    ? `${resolution.parrySourceLabel} P ${resolution.combinedParryScore}`
    : `P ${resolution.combinedParryScore}`;
  const modifiedParryBeforeRoll =
    resolution.modifiedParryBeforeRoll ??
    resolution.combinedParryScore + resolution.modifierAdjustment;
  const adjustmentText =
    modifiedParryBeforeRoll === resolution.combinedParryScore
      ? ""
      : ` -> P ${modifiedParryBeforeRoll}`;

  return `${sourcePrefix} + ${modifierText}${adjustmentText} + roll ${rollText} = ${resolution.total}`;
}

function formatResolutionStatusLabel(value: string): string {
  return value
    .split("_")
    .map((part, index) => (index === 0 ? part[0]?.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function formatCombatAttackTableResultLabel(value: string): string {
  const trimmed = value.trim();

  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : "Unknown";
}

function formatCombatDamageCalculationLine(
  damage: CombatRoundPhaseResolutionResult["damageResult"],
): string | undefined {
  if (!damage) {
    return undefined;
  }

  const effectiveDamage = getCombatRoundEffectiveDamageResult(damage);
  const hitLookupTotal = damage.hitLookupTotal ?? damage.lookupTotal;
  const tableDamage = effectiveDamage.effectiveTableDamage;

  if (damage.grazing && damage.damageRoll.required) {
    const rawGrazingDamage =
      effectiveDamage.effectiveDamageRoll.rawGrazingDamage ??
      effectiveDamage.effectiveDamageRoll.total;
    const rollLabel =
      effectiveDamage.effectiveDamageRoll.diceExpression && rawGrazingDamage !== undefined
        ? `${effectiveDamage.effectiveDamageRoll.diceExpression} = ${rawGrazingDamage}`
        : "required roll";
    const referenceHitLookupTotal =
      effectiveDamage.effectiveDamageRoll.grazingReferenceHitLookupTotal ??
      effectiveDamage.effectiveDamageRoll.derivedFromLookupTotal;
    const referenceDamageLookupTotal =
      effectiveDamage.effectiveDamageRoll.grazingReferenceDamageLookupTotal ??
      effectiveDamage.effectiveDamageLookupTotal;
    const referenceDamage =
      effectiveDamage.effectiveDamageRoll.grazingReferenceTableDamage ??
      effectiveDamage.effectiveDamageRoll.grazingReferenceDamage ??
      effectiveDamage.effectiveDamageRoll.derivedNormalDamageTotal;
    const referenceLabel =
      referenceHitLookupTotal !== undefined &&
      referenceDamageLookupTotal !== undefined &&
      referenceDamage !== undefined
        ? `grazing reference: hit ${referenceHitLookupTotal} + DMB ${damage.dmb} + DM ${damage.defenderDm} = lookup ${referenceDamageLookupTotal}; raw reference damage ${referenceDamage}`
        : "grazing reference damage lookup";

    return `${referenceLabel}; raw grazing die: ${rollLabel}`;
  }

  if (hitLookupTotal === undefined || effectiveDamage.effectiveDamageLookupTotal === undefined) {
    return `table damage ${tableDamage ?? effectiveDamage.effectiveTotalDamage} = ${effectiveDamage.effectiveTotalDamage}`;
  }

  return `hit ${hitLookupTotal} + DMB ${damage.dmb} + DM ${damage.defenderDm} = lookup ${effectiveDamage.effectiveDamageLookupTotal}`;
}

function formatCombatDamageResultLine(
  damage: CombatRoundPhaseResolutionResult["damageResult"],
): string | undefined {
  if (!damage) {
    return undefined;
  }

  const effectiveDamage = getCombatRoundEffectiveDamageResult(damage);
  const critical = effectiveDamage.effectiveCriticalGrade
    ? ` · critical ${effectiveDamage.effectiveCriticalGrade.toUpperCase()}`
    : "";
  const minDamage =
    effectiveDamage.effectiveMinDamage !== undefined
      ? ` · min damage ${effectiveDamage.effectiveMinDamage}`
      : "";
  const maxDamage = effectiveDamage.effectiveMaxDamageNote
    ? effectiveDamage.effectiveMaxDamageCap !== undefined
      ? ` · max ${effectiveDamage.effectiveMaxDamageCap}`
      : ` · ${effectiveDamage.effectiveMaxDamageNote}`
    : "";
  const criticalMinimum =
    effectiveDamage.criticalMinTotalDamage !== undefined
      ? ` · critical min ${effectiveDamage.criticalMinTotalDamage}`
      : "";
  const tableDamage = effectiveDamage.effectiveTableDamage ?? effectiveDamage.effectiveTotalDamage;

  if (damage.grazing && damage.damageRoll.required) {
    const rawGrazingDamage =
      effectiveDamage.effectiveDamageRoll.rawGrazingDamage ??
      effectiveDamage.effectiveDamageRoll.total ??
      effectiveDamage.effectiveRawTotalDamage;

    return `raw grazing damage ${rawGrazingDamage}${critical}${minDamage}${maxDamage}${criticalMinimum}`;
  }

  return `table damage ${tableDamage}${critical}${minDamage}${maxDamage}${criticalMinimum}`;
}

function formatCombatDamageResultLocationSuffix(
  damage: CombatRoundPhaseResolutionResult["damageResult"],
): string {
  const location = damage
    ? getCombatRoundEffectiveDamageResult(damage).effectiveSelectedHitLocation
    : undefined;

  return location ? ` at ${getHitLocationFullLabel(location).toLowerCase()}` : "";
}

function formatCombatHitLocationLine(
  damage: CombatRoundPhaseResolutionResult["damageResult"],
): string | undefined {
  if (!damage) {
    return undefined;
  }

  const effectiveDamage = getCombatRoundEffectiveDamageResult(damage);

  if (!effectiveDamage.effectiveSelectedHitLocation) {
    return undefined;
  }

  const selected = getHitLocationFullLabel(effectiveDamage.effectiveSelectedHitLocation);

  return `Location: ${selected}`;
}

function formatCombatArmorLine(
  damage: CombatRoundPhaseResolutionResult["damageResult"],
): string | undefined {
  if (!damage) {
    return undefined;
  }

  const effectiveDamage = getCombatRoundEffectiveDamageResult(damage);

  if (!effectiveDamage.effectiveArmorRegionLabel || !effectiveDamage.effectiveArmorCoverageLabel) {
    return damage.review?.armorModifierOverride !== undefined
      ? `Armor: modifier ${effectiveDamage.effectiveArmorModifier}`
      : "Armor: not applied yet";
  }

  const modifier =
    effectiveDamage.effectiveArmorModifier !== 0
      ? `, armor mod ${effectiveDamage.effectiveArmorModifier}`
      : "";

  return `Armor: ${effectiveDamage.effectiveArmorRegionLabel.toLowerCase()}/${effectiveDamage.effectiveAttackDirection} ${effectiveDamage.effectiveArmorCoverageLabel}, damage -${effectiveDamage.effectiveArmorValue}${modifier}`;
}

function formatCombatLocationResultLine(resolution: CombatRoundPhaseResolutionResult): string {
  const locationRoll = resolution.hitLocationRoll;

  if (locationRoll.status !== "rolled" || !locationRoll.selectedHitLocation) {
    return "Result: Pending";
  }

  return `Result: ${getHitLocationFullLabel(locationRoll.selectedHitLocation)}`;
}

function formatCombatCriticalResultLine(
  resolution: CombatRoundPhaseResolutionResult,
): string | undefined {
  const criticalRoll = resolution.criticalRoll;
  const effectiveCritical = getCombatRoundEffectiveCriticalRoll({
    criticalRoll,
    review: resolution.damageResult?.review,
  });

  if (criticalRoll.status === "not_required") {
    return resolution.damageResult ? "Result: No critical" : undefined;
  }

  if (criticalRoll.status !== "rolled") {
    return "Result: Pending";
  }

  const criticalIndexStatus = getFinalCriticalRollIndexStatus(
    effectiveCritical.finalCriticalRoll ?? criticalRoll.finalCriticalRoll,
  );

  if (criticalIndexStatus.status === "no_effect") {
    return "Result: No critical effect";
  }

  const location = effectiveCritical.criticalLocation
    ? getHitLocationFullLabel(effectiveCritical.criticalLocation)
    : "unknown location";

  return `Result: critical roll ${effectiveCritical.finalCriticalRoll ?? criticalRoll.finalCriticalRoll} at ${location}`;
}

function formatCombatPhaseResolutionResultLines(input: {
  attackResult: CombatRoundAttackRollResult;
  participantId?: string;
  resolution: CombatRoundPhaseResolutionResult;
}): {
  attackLine: string;
  armorLine?: string;
  locationLine?: string;
  proposalLine: string;
  sections: readonly CombatActionResultSection[];
  statusLine: string;
} {
  const parry = input.resolution.parryResolution;
  const damage = input.resolution.damageRoll;
  const damageResult = input.resolution.damageResult;
  const proposal = input.resolution.damageProposal;
  const resolvedParryLine = formatCombatParryCalculationLine(parry);
  const resolvedDamageLine = formatCombatDamageCalculationLine(damageResult);
  const resolvedDamageResultLine = formatCombatDamageResultLine(damageResult);
  const resolvedHitLocationLine = formatCombatHitLocationLine(damageResult);
  const resolvedArmorLine = formatCombatArmorLine(damageResult);
  const locationResultLine = formatCombatLocationResultLine(input.resolution);
  const criticalResultLine = formatCombatCriticalResultLine(input.resolution);
  const additionalEffectsLine = damageResult?.review?.additionalEffects?.length
    ? ` · Effects: ${damageResult.review.additionalEffects
        .map((effect) => effect.label)
        .join(", ")}`
    : "";
  const parryLine =
    resolvedParryLine ??
    `Parry: ${formatResolutionStatusLabel(parry.status)}${
      parry.resultLabel ? ` (${parry.resultLabel})` : ""
    }`;
  const parryResultLine =
    parry.status === "resolved" && parry.resultLabel
      ? `Result: ${parry.resultLabel}`
      : `Result: ${formatResolutionStatusLabel(parry.status)}`;
  const damageLine = `Damage roll: ${formatResolutionStatusLabel(damage.status)}`;
  const proposalLine =
    proposal.status === "committed"
      ? `Phase damage committed${
          proposal.committedCombatEffectIds.length > 0
            ? ` · ${proposal.committedCombatEffectIds.length} active row${
                proposal.committedCombatEffectIds.length === 1 ? "" : "s"
              }`
            : " · no damage row"
        }${additionalEffectsLine}`
      : `Proposal: ${formatResolutionStatusLabel(proposal.status)}`;
  const statusLine = resolvedDamageLine
    ? `${parryLine} · ${resolvedDamageLine}`
    : parryResultLine
      ? parryLine
      : `${parryLine} · ${damageLine}`;
  const damageResultLine =
    damageResult && resolvedDamageLine
      ? `Result: ${
          getCombatRoundEffectiveDamageResult(damageResult).effectiveTotalDamage
        } damage${formatCombatDamageResultLocationSuffix(damageResult)}`
      : proposal.status === "committed"
        ? `Result: ${proposalLine}`
        : `Result: ${formatResolutionStatusLabel(proposal.status)}`;
  const attackCalculation = buildCombatCalculationPresentationFromSnapshot({
    calculationId: `${input.resolution.attackResultId}:attack`,
    calculationType: "attack",
    facts: { ...input.attackResult },
    label: "To hit",
  });
  const parryCalculation = buildCombatCalculationPresentationFromSnapshot({
    calculationId: `${input.resolution.attackResultId}:parry`,
    calculationType: "parry",
    facts: { ...parry },
    label: "Parry",
  });
  const locationCalculation = buildCombatCalculationPresentationFromSnapshot({
    calculationId: `${input.resolution.attackResultId}:location`,
    calculationType: "hit_location",
    facts: { ...input.resolution.hitLocationRoll },
    label: "Location",
  });
  const damageCalculation = damageResult
    ? buildCombatCalculationPresentationFromSnapshot({
        calculationId: `${input.resolution.attackResultId}:damage`,
        calculationType: "damage_proposed",
        facts: { ...damageResult },
        label: "Damage",
      })
    : undefined;
  const effectiveCritical = getCombatRoundEffectiveCriticalRoll({
    criticalRoll: input.resolution.criticalRoll,
    review: damageResult?.review,
  });
  const criticalCalculation = buildCombatCalculationPresentationFromSnapshot({
    calculationId: `${input.resolution.attackResultId}:critical`,
    calculationType: "critical",
    facts: {
      ...input.resolution.criticalRoll,
      armorCriticalModifier: effectiveCritical.armorCriticalModifier,
      criticalTypeModifier: effectiveCritical.criticalTypeModifier,
      finalCriticalRoll: effectiveCritical.finalCriticalRoll,
    },
    label: "Critical",
  });
  const sections: CombatActionResultSection[] = [
    {
      calculations: attackCalculation ? [attackCalculation] : [],
      resultLine: `Result: ${formatCombatAttackTableResultLabel(input.attackResult.tableResult)}`,
      title: "To hit",
    },
    {
      calculations: parryCalculation ? [parryCalculation] : [],
      resultLine: parryResultLine,
      title: "Parry",
    },
    {
      calculations: locationCalculation ? [locationCalculation] : [],
      resultLine: locationResultLine,
      title: "Location",
    },
    {
      calculations: damageCalculation ? [damageCalculation] : [],
      resultLine: damageResultLine,
      title: "Damage",
    },
  ];

  if (criticalCalculation || criticalResultLine) {
    sections.push({
      calculations: criticalCalculation ? [criticalCalculation] : [],
      resultLine: criticalResultLine,
      title: "Critical",
    });
  }

  return {
    attackLine: `${formatCombatAttackResultLine({
      participantId: input.participantId,
      result: input.attackResult,
    })} · Result: ${input.attackResult.tableResult}`,
    proposalLine:
      proposal.status === "committed"
        ? proposalLine
        : (resolvedDamageResultLine ?? parryResultLine ?? proposalLine),
    armorLine: resolvedArmorLine,
    locationLine: resolvedHitLocationLine,
    sections,
    statusLine,
  };
}

function buildHistoricalCombatActionResult(input: {
  participantId?: string;
  snapshot?: CombatRoundStepSnapshot;
  step?: CombatRoundStep;
}) {
  const snapshot = input.snapshot;

  if (!snapshot) {
    return { interpretedResult: "No recorded result for this step." };
  }

  if (snapshot.attackResult && snapshot.phaseResolutionResult) {
    const lines = formatCombatPhaseResolutionResultLines({
      attackResult: snapshot.attackResult,
      participantId: input.participantId,
      resolution: snapshot.phaseResolutionResult,
    });

    return {
      detailLines: [lines.armorLine].filter((line): line is string => Boolean(line)),
      interpretedResult: lines.statusLine,
      rankLabel: lines.attackLine,
      resultLabel: lines.proposalLine,
      sections: lines.sections,
    };
  }

  if (snapshot.attackResult) {
    return buildCombatAttackResultPanel({
      participantId: input.participantId,
      result: snapshot.attackResult,
    });
  }

  if (
    snapshot.initiativeResult &&
    (input.step === "initiative_phase_1" || input.step === "initiative_phase_2")
  ) {
    return {
      interpretedResult: formatCombatInitiativeFormula(snapshot.initiativeResult),
      rankLabel: formatSnapshotInitiativeRankLabel(snapshot.initiativeRank),
    };
  }

  if (snapshot.actionResultStatus === "recorded" && snapshot.actionResultSummary) {
    return { interpretedResult: snapshot.actionResultSummary };
  }

  if (snapshot.actionResultStatus === "skipped") {
    return { interpretedResult: "Action skipped for this step." };
  }

  if (snapshot.actionResultStatus === "no_attack") {
    return { interpretedResult: "No attack was recorded for this step." };
  }

  return { interpretedResult: "No recorded result for this step." };
}

function formatCombatPhaseResolutionSummary(input: {
  attackResult: CombatRoundAttackRollResult;
  participantId?: string;
  resolution: CombatRoundPhaseResolutionResult;
}): string {
  const lines = formatCombatPhaseResolutionResultLines(input);

  return lines.sections
    .flatMap((section) => [
      section.title,
      ...section.calculations.flatMap(buildCombatCalculationPresentationLines),
      section.resultLine,
    ])
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function getCombatAttackPhaseForStep(step: CombatRoundStep): CombatRoundPhase | undefined {
  if (step === "phase_1_actions") {
    return "phase1";
  }

  if (step === "phase_2_actions") {
    return "phase2";
  }

  return undefined;
}

function getCombatResolutionStepKind(step: CombatRoundStep): "parry" | "damage" | undefined {
  if (step === "review_phase_2_actions" || step === "review_phase_2_damage") {
    return "parry";
  }

  if (step === "phase_1_damage" || step === "phase_2_damage") {
    return "damage";
  }

  return undefined;
}

function formatCombatPhaseLabel(phase: CombatRoundPhase): string {
  return phase === "phase1" ? "phase 1" : "phase 2";
}

function formatCombatResolutionSubstepLabel(substep: string): string {
  switch (substep) {
    case "attack":
      return "Attack roll";
    case "parry":
      return "Parry pending";
    case "damage":
      return "Damage pending";
    case "effects":
      return "Effects pending";
    case "done":
      return "Done";
    case "pending":
    default:
      return "Pending";
  }
}

function getCombatResolutionButtonLabel(input: {
  hasPhaseAttack?: boolean;
  phase?: CombatRoundPhase;
  substep?: string;
  step: CombatRoundStep;
}): string {
  if (input.phase && input.hasPhaseAttack === false) {
    return `Complete ${formatCombatPhaseLabel(input.phase)} for participant`;
  }

  if (
    input.phase &&
    input.hasPhaseAttack !== false &&
    (!input.substep || input.substep === "pending" || input.substep === "attack")
  ) {
    return `Roll ${formatCombatPhaseLabel(input.phase)} attack`;
  }

  if (input.phase && input.substep === "parry") {
    return "Mark parry reviewed";
  }

  if (input.phase && input.substep === "damage") {
    return "Prepare damage review";
  }

  if (input.phase && input.substep === "effects") {
    return `Complete ${formatCombatPhaseLabel(input.phase)} for participant`;
  }

  return getGmCombatStepActionLabel(input.step);
}

function formatCombatResolutionNextLabel(input: {
  hasPhaseAttack?: boolean;
  phase: CombatRoundPhase;
  substep: string;
}): string {
  const phaseLabel = input.phase === "phase1" ? "Phase 1" : "Phase 2";

  if (input.hasPhaseAttack === false) {
    return `No ${formatCombatPhaseLabel(input.phase)} attack`;
  }

  switch (input.substep) {
    case "attack":
      return `${phaseLabel} attack roll`;
    case "parry":
      return `${phaseLabel} parry review`;
    case "damage":
      return `${phaseLabel} damage review`;
    case "effects":
      return `${phaseLabel} effects review`;
    case "done":
      return `${phaseLabel} done`;
    case "pending":
    default:
      return `${phaseLabel} ${formatCombatResolutionSubstepLabel(input.substep).toLowerCase()}`;
  }
}

function parseCombatInteger(value: string, label: string): number {
  const trimmed = value.trim();

  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`${label} is not available as a numeric combat value.`);
  }

  return Number(trimmed);
}

function parseOptionalCombatInteger(value: string | undefined): number | undefined {
  if (!value || !/^-?\d+$/.test(value.trim())) {
    return undefined;
  }

  return Number(value);
}

function parseOptionalCombatReviewInteger(value: string, label: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  return parseCombatInteger(value, label);
}

function parseOptionalCombatReviewPositiveInteger(
  value: string,
  label: string,
): number | undefined {
  const parsed = parseOptionalCombatReviewInteger(value, label);

  if (parsed !== undefined && parsed <= 0) {
    throw new RangeError(`${label} must be a positive whole number.`);
  }

  return parsed;
}

const COMBAT_DAMAGE_REVIEW_MODIFIER_BUCKETS = [
  { label: "General/Fatigue", value: "general" },
  { label: "OB/Skill", value: "obSkill" },
  { label: "DB/Parry", value: "db" },
] as const;

const COMBAT_DAMAGE_REVIEW_EFFECT_PHASES = [
  { label: "No phase", value: "" },
  { label: "Phase 1", value: "phase1" },
  { label: "Phase 2", value: "phase2" },
  { label: "This round", value: "round" },
  { label: "Until cleared", value: "untilCleared" },
] as const;

function createCombatDamageReviewEffectDraft(
  kind: "modifier" | "note",
): CombatDamageReviewAdditionalEffectDraft {
  const id = `review-effect-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;

  if (kind === "modifier") {
    return {
      accepted: true,
      durationRounds: "",
      id,
      kind,
      label: "Manual modifier",
      modifierBucket: "general",
      modifierValue: "-1",
      notes: "",
      phase: "",
      rateValuePerRound: "",
      rowCategory: "general_modifier",
    };
  }

  return {
    accepted: true,
    durationRounds: "",
    id,
    kind,
    label: "Manual note",
    modifierBucket: "general",
    modifierValue: "",
    notes: "",
    phase: "",
    rateValuePerRound: "",
    rowCategory: "special_note",
  };
}

function buildCombatDamageReviewDraft(
  damageResult?: CombatRoundDamageResult,
  criticalRoll?: CombatRoundPhaseResolutionResult["criticalRoll"],
): CombatDamageReviewDraft {
  const effectiveDamage = damageResult
    ? getCombatRoundEffectiveDamageResult(damageResult)
    : undefined;
  const effectiveCritical = getCombatRoundEffectiveCriticalRoll({
    criticalRoll,
    review: damageResult?.review,
  });

  return {
    additionalEffects: (damageResult?.review?.additionalEffects ?? []).map((effect) => ({
      accepted: effect.accepted !== false,
      durationRounds: effect.durationRounds?.toString() ?? "",
      effectOrder: effect.effectOrder,
      id: effect.id,
      kind: effect.kind,
      label: effect.label,
      minDamageReason: effect.minDamageReason,
      minTotalDamage: effect.minTotalDamage,
      modifierBucket: effect.modifierBucket ?? "general",
      modifierValue: effect.modifierValue?.toString() ?? "",
      notes: effect.notes ?? "",
      phase: effect.phase ?? "",
      rateValuePerRound: effect.rateValuePerRound?.toString() ?? "",
      rowCategory: effect.rowCategory,
      rollReports: effect.rollReports,
      sourceCritKey: effect.sourceCritKey,
      sourceEffectKey: effect.sourceEffectKey,
      sourceText: effect.sourceText,
      sourceKind: effect.sourceKind,
    })),
    attackDirectionOverride: effectiveDamage?.effectiveAttackDirection ?? "front",
    armorCriticalModifierOverride: effectiveCritical.armorCriticalModifier?.toString() ?? "",
    armorModifierOverride: effectiveDamage?.effectiveArmorModifier.toString() ?? "",
    criticalGradeOverride: effectiveDamage?.effectiveCriticalGrade ?? "none",
    criticalLocationOverride: effectiveCritical.criticalLocation ?? "",
    criticalTypeModifierOverride: effectiveCritical.criticalTypeModifier?.toString() ?? "",
    finalCriticalRollOverride: effectiveCritical.finalCriticalRoll?.toString() ?? "",
    notes: damageResult?.review?.notes ?? "",
    operationalConsequences: (damageResult?.review?.operationalConsequences ?? []).map(
      (consequence) => ({
        accepted: consequence.accepted,
        hand: consequence.hand ?? "",
        id: consequence.id,
        itemId: consequence.itemId ?? "",
        itemLabel: consequence.itemLabel ?? "",
        kind: consequence.kind,
        label: consequence.label,
        notes: consequence.notes ?? "",
        participantId: consequence.participantId,
        phase: consequence.phase ?? "",
        reason: consequence.reason,
        sourceCritKey: consequence.sourceCritKey,
        sourceEffectKey: consequence.sourceEffectKey,
        sourceText: consequence.sourceText,
        step: consequence.step ?? "",
        targetActionId: consequence.targetActionId ?? "",
      }),
    ),
    selectedHitLocationOverride: effectiveDamage?.effectiveSelectedHitLocation ?? "",
    totalDamageOverride: effectiveDamage?.effectiveTotalDamage.toString() ?? "",
  };
}

function getCombatDamageReviewEffectLabel(draft: CombatDamageReviewAdditionalEffectDraft): string {
  if (draft.label.trim()) {
    return draft.label.trim();
  }

  if (draft.kind === "modifier") {
    const bucketLabel =
      COMBAT_DAMAGE_REVIEW_MODIFIER_BUCKETS.find((bucket) => bucket.value === draft.modifierBucket)
        ?.label ?? "Modifier";

    return bucketLabel;
  }

  if (draft.kind === "fatigue") {
    return "Fatigue";
  }

  if (draft.kind === "special") {
    return "Special effect";
  }

  return "Manual note";
}

function buildCombatDamageReviewFromDraft(input: {
  criticalRoll?: CombatRoundPhaseResolutionResult["criticalRoll"];
  damageResult: CombatRoundDamageResult;
  draft: CombatDamageReviewDraft;
}): Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId"> {
  const effectiveDamage = getCombatRoundEffectiveDamageResult(input.damageResult);
  const effectiveCritical = getCombatRoundEffectiveCriticalRoll({
    criticalRoll: input.criticalRoll,
    review: input.damageResult.review,
  });
  const selectedHitLocationValue = HIT_LOCATIONS.find(
    (location) => location === input.draft.selectedHitLocationOverride,
  );
  const criticalLocationValue = HIT_LOCATIONS.find(
    (location) => location === input.draft.criticalLocationOverride,
  );
  const selectedHitLocationOverride =
    selectedHitLocationValue &&
    selectedHitLocationValue !== effectiveDamage.computedSelectedHitLocation
      ? selectedHitLocationValue
      : undefined;
  const criticalLocationOverride =
    criticalLocationValue && criticalLocationValue !== effectiveCritical.criticalLocation
      ? criticalLocationValue
      : undefined;
  const attackDirectionOverride =
    input.draft.attackDirectionOverride !== effectiveDamage.computedAttackDirection
      ? input.draft.attackDirectionOverride
      : undefined;
  const selectedCriticalGrade =
    input.draft.criticalGradeOverride === "none"
      ? undefined
      : input.draft.criticalGradeOverride.trim() || undefined;
  const criticalGradeOverride =
    selectedCriticalGrade === effectiveDamage.computedCriticalGrade
      ? undefined
      : (selectedCriticalGrade ?? (effectiveDamage.computedCriticalGrade ? null : undefined));
  const armorModifier = parseOptionalCombatReviewInteger(
    input.draft.armorModifierOverride,
    "Armor modifier override",
  );
  const armorModifierOverride =
    armorModifier !== undefined && armorModifier !== effectiveDamage.computedArmorModifier
      ? armorModifier
      : undefined;
  const armorCriticalModifier = parseOptionalCombatReviewInteger(
    input.draft.armorCriticalModifierOverride,
    "Armor critical modifier override",
  );
  const armorCriticalModifierOverride =
    armorCriticalModifier !== undefined &&
    armorCriticalModifier !== effectiveCritical.armorCriticalModifier
      ? armorCriticalModifier
      : undefined;
  const criticalTypeModifier = parseOptionalCombatReviewInteger(
    input.draft.criticalTypeModifierOverride,
    "Critical type modifier override",
  );
  const criticalTypeModifierOverride =
    criticalTypeModifier !== undefined &&
    criticalTypeModifier !== effectiveCritical.criticalTypeModifier
      ? criticalTypeModifier
      : undefined;
  const finalCriticalRoll = parseOptionalCombatReviewInteger(
    input.draft.finalCriticalRollOverride,
    "Final critical roll override",
  );
  const finalCriticalRollOverride =
    finalCriticalRoll !== undefined && finalCriticalRoll !== effectiveCritical.finalCriticalRoll
      ? finalCriticalRoll
      : undefined;
  const notes = input.draft.notes.trim();
  const additionalEffects = input.draft.additionalEffects.map((effect) => {
    const kind = effect.kind;
    const phase = COMBAT_DAMAGE_REVIEW_EFFECT_PHASES.find(
      (candidate) => candidate.value === effect.phase,
    )?.value;
    const durationRounds = parseOptionalCombatReviewPositiveInteger(
      effect.durationRounds,
      "Effect duration",
    );
    const modifierValue =
      kind === "modifier" || kind === "fatigue"
        ? parseCombatInteger(effect.modifierValue, "Effect modifier")
        : undefined;
    const modifierBucket =
      kind === "modifier"
        ? (COMBAT_DAMAGE_REVIEW_MODIFIER_BUCKETS.find(
            (bucket) => bucket.value === effect.modifierBucket,
          )?.value ?? "general")
        : undefined;
    const rateValuePerRound =
      effect.rateValuePerRound.trim() && /^\d+(\.\d+)?$/.test(effect.rateValuePerRound.trim())
        ? Number(effect.rateValuePerRound)
        : undefined;

    return {
      accepted: effect.accepted,
      durationRounds,
      effectOrder: effect.effectOrder,
      id: effect.id,
      kind,
      label: getCombatDamageReviewEffectLabel(effect),
      minDamageReason: effect.minDamageReason,
      minTotalDamage: effect.minTotalDamage,
      modifierBucket,
      modifierValue,
      notes: effect.notes.trim() || undefined,
      phase: phase || undefined,
      rateValuePerRound,
      rowCategory: effect.rowCategory,
      rollReports: effect.rollReports,
      sourceCritKey: effect.sourceCritKey,
      sourceEffectKey: effect.sourceEffectKey,
      sourceText: effect.sourceText,
      sourceKind: effect.sourceKind,
    };
  });
  const operationalConsequences = input.draft.operationalConsequences.map((consequence) => ({
    accepted: consequence.accepted,
    hand:
      consequence.hand === "mainHand" ||
      consequence.hand === "offHand" ||
      consequence.hand === "unknown"
        ? consequence.hand
        : undefined,
    id: consequence.id,
    itemId: consequence.itemId.trim() || undefined,
    itemLabel: consequence.itemLabel.trim() || undefined,
    kind:
      consequence.kind === "drop_item" ||
      consequence.kind === "cancel_pending_action" ||
      consequence.kind === "note"
        ? consequence.kind
        : "note",
    label: consequence.label.trim() || "Operational consequence",
    notes: consequence.notes.trim() || undefined,
    participantId: consequence.participantId,
    phase:
      consequence.phase === "phase1" || consequence.phase === "phase2"
        ? consequence.phase
        : undefined,
    reason: consequence.reason.trim() || "Critical consequence proposed for GM review.",
    sourceCritKey: consequence.sourceCritKey,
    sourceEffectKey: consequence.sourceEffectKey,
    sourceText: consequence.sourceText,
    step: consequence.step === "A1" || consequence.step === "A2" ? consequence.step : undefined,
    targetActionId: consequence.targetActionId.trim() || undefined,
  }));
  const reviewWithoutTotalDamageOverride: Omit<
    CombatRoundDamageReview,
    "reviewedAt" | "reviewedByUserId"
  > = {
    additionalEffects,
    criticalEffectProposal: input.damageResult.review?.criticalEffectProposal,
    operationalConsequences,
  };

  if (armorModifierOverride !== undefined) {
    reviewWithoutTotalDamageOverride.armorModifierOverride = armorModifierOverride;
  }

  if (attackDirectionOverride !== undefined) {
    reviewWithoutTotalDamageOverride.attackDirectionOverride = attackDirectionOverride;
  }

  if (armorCriticalModifierOverride !== undefined) {
    reviewWithoutTotalDamageOverride.armorCriticalModifierOverride = armorCriticalModifierOverride;
  }

  if (criticalGradeOverride !== undefined) {
    reviewWithoutTotalDamageOverride.criticalGradeOverride = criticalGradeOverride;
  }

  if (criticalLocationOverride !== undefined) {
    reviewWithoutTotalDamageOverride.criticalLocationOverride = criticalLocationOverride;
  }

  if (criticalTypeModifierOverride !== undefined) {
    reviewWithoutTotalDamageOverride.criticalTypeModifierOverride = criticalTypeModifierOverride;
  }

  if (finalCriticalRollOverride !== undefined) {
    reviewWithoutTotalDamageOverride.finalCriticalRollOverride = finalCriticalRollOverride;
  }

  if (selectedHitLocationOverride !== undefined) {
    reviewWithoutTotalDamageOverride.selectedHitLocationOverride = selectedHitLocationOverride;
  }

  const draftEffectiveDamage = getCombatRoundEffectiveDamageResult({
    ...input.damageResult,
    review: reviewWithoutTotalDamageOverride,
  });
  const totalDamage = parseOptionalCombatReviewInteger(
    input.draft.totalDamageOverride,
    "Total damage override",
  );
  const totalDamageOverride =
    totalDamage !== undefined && totalDamage !== draftEffectiveDamage.effectiveTotalDamage
      ? totalDamage
      : undefined;
  const review: Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId"> = {
    additionalEffects,
    criticalEffectProposal: input.damageResult.review?.criticalEffectProposal,
    operationalConsequences,
  };

  if (armorModifierOverride !== undefined) {
    review.armorModifierOverride = armorModifierOverride;
  }

  if (attackDirectionOverride !== undefined) {
    review.attackDirectionOverride = attackDirectionOverride;
  }

  if (armorCriticalModifierOverride !== undefined) {
    review.armorCriticalModifierOverride = armorCriticalModifierOverride;
  }

  if (criticalGradeOverride !== undefined) {
    review.criticalGradeOverride = criticalGradeOverride;
  }

  if (criticalLocationOverride !== undefined) {
    review.criticalLocationOverride = criticalLocationOverride;
  }

  if (criticalTypeModifierOverride !== undefined) {
    review.criticalTypeModifierOverride = criticalTypeModifierOverride;
  }

  if (finalCriticalRollOverride !== undefined) {
    review.finalCriticalRollOverride = finalCriticalRollOverride;
  }

  if (notes) {
    review.notes = notes;
  }

  if (selectedHitLocationOverride !== undefined) {
    review.selectedHitLocationOverride = selectedHitLocationOverride;
  }

  if (totalDamageOverride !== undefined) {
    review.totalDamageOverride = totalDamageOverride;
  }

  return review;
}

interface CombatDamageReviewProposedSheetRow {
  accepted: boolean;
  details: string;
  duration: string;
  effectId?: string;
  rowType: string;
  target: string;
  value: string;
}

function getCombatDamageReviewDraftEffectRowType(
  effect: CombatDamageReviewAdditionalEffectDraft,
): string {
  if (effect.rowCategory === "bleed") {
    return "Bleed";
  }

  if (effect.rowCategory === "internal_bleed") {
    return "Internal bleed";
  }

  if (effect.rowCategory === "no_combat_action") {
    return "No combat action";
  }

  if (effect.rowCategory === "loss_of_use") {
    return "Loss of use";
  }

  if (effect.rowCategory === "dropped_item") {
    return "Dropped item";
  }

  if (effect.rowCategory === "ob_skill_modifier") {
    return "OB/Skill modifier";
  }

  if (effect.rowCategory === "db_parry_modifier") {
    return "DB/Parry modifier";
  }

  if (effect.rowCategory === "general_modifier") {
    return "General modifier";
  }

  if (effect.kind === "fatigue" || effect.rowCategory === "fatigue") {
    return "Fatigue";
  }

  if (effect.kind === "note") {
    return "Note";
  }

  return effect.kind === "special" ? "Special" : "Modifier";
}

function getCombatDamageReviewDraftEffectTarget(
  effect: CombatDamageReviewAdditionalEffectDraft,
): string {
  if (effect.rowCategory === "bleed" || effect.rowCategory === "internal_bleed") {
    return "Bleed";
  }

  if (effect.rowCategory === "no_combat_action" || effect.rowCategory === "loss_of_use") {
    return "Special";
  }

  if (effect.kind === "modifier") {
    return (
      COMBAT_DAMAGE_REVIEW_MODIFIER_BUCKETS.find((bucket) => bucket.value === effect.modifierBucket)
        ?.label ?? "General/Fatigue"
    );
  }

  if (effect.kind === "fatigue") {
    return "Fatigue";
  }

  return "Special";
}

function formatCombatDamageReviewRateValue(value: string): string {
  const trimmed = value.trim();

  return `${trimmed}/10 HP / round`;
}

function getCombatDamageReviewDraftEffectValue(
  effect: CombatDamageReviewAdditionalEffectDraft,
): string {
  if (effect.rowCategory === "bleed" || effect.rowCategory === "internal_bleed") {
    return effect.rateValuePerRound.trim()
      ? formatCombatDamageReviewRateValue(effect.rateValuePerRound)
      : "";
  }

  const value = effect.modifierValue.trim();

  if (!value) {
    return "";
  }

  return value.startsWith("-") || value.startsWith("+") ? value : `+${value}`;
}

function formatCombatDamageReviewDraftEffectDuration(
  effect: CombatDamageReviewAdditionalEffectDraft,
): string {
  const parts = [];

  if (effect.durationRounds.trim()) {
    parts.push(
      `${effect.durationRounds.trim()} round${effect.durationRounds.trim() === "1" ? "" : "s"}`,
    );
  }

  const phaseLabel = COMBAT_DAMAGE_REVIEW_EFFECT_PHASES.find(
    (phase) => phase.value === effect.phase,
  )?.label;

  if (phaseLabel && effect.phase) {
    parts.push(phaseLabel);
  }

  return parts.join(" · ");
}

function formatCombatDamageReviewDraftEffectDetails(
  effect: CombatDamageReviewAdditionalEffectDraft,
): string {
  const label = effect.label.trim();
  const notes = effect.notes.trim();

  if (!notes) {
    return label;
  }

  const normalizedLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const normalizedNotes = notes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (normalizedNotes && normalizedLabel.includes(normalizedNotes)) {
    return label;
  }

  return label && notes.toLowerCase().startsWith(`${label.toLowerCase()}:`)
    ? notes
    : label
      ? `${label}: ${notes}`
      : notes;
}

function buildCombatDamageReviewProposedSheetRows(input: {
  damageResult: CombatRoundDamageResult;
  draft: CombatDamageReviewDraft;
}): CombatDamageReviewProposedSheetRow[] {
  let effectiveDamage = getCombatRoundEffectiveDamageResult(input.damageResult);

  try {
    effectiveDamage = getCombatRoundEffectiveDamageResult({
      ...input.damageResult,
      review: buildCombatDamageReviewFromDraft({
        damageResult: input.damageResult,
        draft: input.draft,
      }),
    });
  } catch {
    effectiveDamage = getCombatRoundEffectiveDamageResult(input.damageResult);
  }
  const location = effectiveDamage.effectiveSelectedHitLocation
    ? getHitLocationFullLabel(effectiveDamage.effectiveSelectedHitLocation)
    : "General";
  const physicalDetails = [
    input.damageResult.weaponName
      ? `${input.damageResult.weaponName} hit to ${location.toLowerCase()}.`
      : `Hit to ${location.toLowerCase()}.`,
    effectiveDamage.effectiveCriticalGrade
      ? `Critical ${effectiveDamage.effectiveCriticalGrade.toUpperCase()}.`
      : undefined,
    effectiveDamage.criticalMinApplied && effectiveDamage.criticalMinTotalDamage !== undefined
      ? `Critical minimum raises damage from ${effectiveDamage.preCriticalEffectiveDamage} to ${effectiveDamage.criticalMinTotalDamage}.`
      : undefined,
  ].filter((entry): entry is string => Boolean(entry));
  const rows: CombatDamageReviewProposedSheetRow[] =
    effectiveDamage.effectiveTotalDamage > 0
      ? [
          {
            accepted: true,
            details: physicalDetails.join(" "),
            duration: "active",
            rowType: "Physical damage",
            target: location,
            value: `${effectiveDamage.effectiveTotalDamage} damage`,
          },
        ]
      : [];

  for (const effect of input.draft.additionalEffects) {
    rows.push({
      accepted: effect.accepted,
      details: formatCombatDamageReviewDraftEffectDetails(effect),
      duration: formatCombatDamageReviewDraftEffectDuration(effect),
      effectId: effect.id,
      rowType: getCombatDamageReviewDraftEffectRowType(effect),
      target: getCombatDamageReviewDraftEffectTarget(effect),
      value: getCombatDamageReviewDraftEffectValue(effect),
    });
  }

  return rows;
}

function getCombatTableCell(input: {
  columns: string[];
  label: string;
  row: Array<string | number>;
}): string {
  const index = input.columns.indexOf(input.label);

  if (index < 0) {
    return "—";
  }

  const value = input.row[index];
  return value == null ? "—" : String(value);
}

function findParryScoreForWeaponLabel(input: {
  model: ReturnType<typeof buildEquipmentLoadoutModuleModel> | null;
  weaponLabel: string;
}): number | undefined {
  if (input.weaponLabel === "Unarmed") {
    return undefined;
  }

  const table = input.model?.combatStatePanelModel?.weaponModeTable;
  if (!table) {
    return undefined;
  }

  const row = table?.rows.find(
    (candidate) =>
      getCombatTableCell({
        columns: table.columns,
        label: "Weapon",
        row: candidate,
      }) === input.weaponLabel,
  );

  return row
    ? parseOptionalCombatInteger(
        getCombatTableCell({ columns: table.columns, label: "Parry", row }),
      )
    : undefined;
}

function getCombinedParrySource(
  model: ReturnType<typeof buildEquipmentLoadoutModuleModel> | null,
): CombatParrySourceOption | undefined {
  const table = model?.combatStatePanelModel?.weaponModeTable;
  if (!table) {
    return undefined;
  }

  const row = table?.rows.find(
    (candidate) =>
      getCombatTableCell({
        columns: table.columns,
        label: "Mode",
        row: candidate,
      }) === "Combined",
  );

  if (!row) {
    return undefined;
  }

  const score = parseOptionalCombatInteger(
    getCombatTableCell({ columns: table.columns, label: "Parry", row }),
  );

  return score === undefined
    ? undefined
    : {
        label: getCombatTableCell({ columns: table.columns, label: "Weapon", row }),
        score,
      };
}

function buildCombatParrySourceOptions(input: {
  loadoutModel: ReturnType<typeof buildEquipmentLoadoutModuleModel> | null;
  mainHandLabel: string;
  offHandLabel: string;
}): CombatParrySourceOptions {
  const mainHandScore = findParryScoreForWeaponLabel({
    model: input.loadoutModel,
    weaponLabel: input.mainHandLabel,
  });
  const offHandScore = findParryScoreForWeaponLabel({
    model: input.loadoutModel,
    weaponLabel: input.offHandLabel,
  });
  const combinedSource = getCombinedParrySource(input.loadoutModel);

  return {
    combinedLabel: combinedSource?.label,
    combinedScore: combinedSource?.score,
    mainHand:
      mainHandScore !== undefined
        ? {
            label: input.mainHandLabel,
            score: mainHandScore,
          }
        : undefined,
    offHand:
      offHandScore !== undefined
        ? {
            label: input.offHandLabel,
            score: offHandScore,
          }
        : undefined,
  };
}

function getCombatParrySourceSelection(input: {
  selection?: CombatParrySourceSelection;
  sources?: CombatParrySourceOptions;
}): CombatParrySourceSelection {
  return {
    usedMainHand: input.selection?.usedMainHand ?? Boolean(input.sources?.mainHand),
    usedOffHand: input.selection?.usedOffHand ?? Boolean(input.sources?.offHand),
  };
}

function getSelectedCombatParryBase(input: {
  selection: CombatParrySourceSelection;
  sources?: CombatParrySourceOptions;
}): number | undefined {
  const mainScore = input.selection.usedMainHand ? input.sources?.mainHand?.score : undefined;
  const offScore = input.selection.usedOffHand ? input.sources?.offHand?.score : undefined;

  if (mainScore !== undefined && offScore !== undefined) {
    return input.sources?.combinedScore ?? mainScore + offScore;
  }

  return mainScore ?? offScore;
}

function formatSelectedCombatParrySourceName(input: {
  selection: CombatParrySourceSelection;
  sources?: CombatParrySourceOptions;
}): string {
  if (
    input.selection.usedMainHand &&
    input.selection.usedOffHand &&
    input.sources?.combinedScore !== undefined &&
    input.sources.combinedLabel
  ) {
    return input.sources.combinedLabel;
  }

  const labels = [
    input.selection.usedMainHand ? input.sources?.mainHand?.label : undefined,
    input.selection.usedOffHand ? input.sources?.offHand?.label : undefined,
  ].filter((label): label is string => Boolean(label));

  return labels.length > 0 ? labels.join(" + ") : "No parry source selected";
}

function getCombatParrySelectionKey(input: {
  result?: CombatRoundAttackRollResult;
  roundNumber: number;
}): string | undefined {
  return input.result
    ? [
        input.roundNumber,
        input.result.phase,
        input.result.attackerParticipantId,
        input.result.defenderParticipantId,
      ].join(":")
    : undefined;
}

function findScenarioParticipantForEncounterParticipant(input: {
  encounterParticipant: EncounterSession["participants"][number];
  scenarioParticipants: ScenarioParticipant[];
}): ScenarioParticipant | undefined {
  return input.scenarioParticipants.find(
    (participant) =>
      participant.id === input.encounterParticipant.scenarioParticipantId ||
      participant.id === input.encounterParticipant.id ||
      (participant.characterId &&
        participant.characterId === input.encounterParticipant.characterId),
  );
}

function aliasesOverlap(left: readonly string[], right: readonly string[]): boolean {
  const rightAliases = new Set(right);

  return left.some((alias) => rightAliases.has(alias));
}

function findScenarioParticipantForCombatRoundParticipant(input: {
  encounterParticipants: EncounterSession["participants"];
  roundParticipant: CombatRoundState["participants"][number];
  scenarioParticipants: ScenarioParticipant[];
}): ScenarioParticipant | undefined {
  const roundAliases = getCombatDistanceParticipantAliases(input.roundParticipant);
  const encounterParticipant = input.encounterParticipants.find((participant) =>
    aliasesOverlap(roundAliases, getCombatDistanceParticipantAliases(participant)),
  );

  if (encounterParticipant) {
    const scenarioParticipant = findScenarioParticipantForEncounterParticipant({
      encounterParticipant,
      scenarioParticipants: input.scenarioParticipants,
    });

    if (scenarioParticipant) {
      return scenarioParticipant;
    }
  }

  return input.scenarioParticipants.find((participant) =>
    aliasesOverlap(roundAliases, getCombatDistanceParticipantAliases(participant)),
  );
}

function findEncounterParticipantForScenarioParticipant(input: {
  encounterParticipants: EncounterSession["participants"];
  scenarioParticipant?: ScenarioParticipant;
  scenarioParticipantId?: string;
}): EncounterSession["participants"][number] | undefined {
  const scenarioParticipantId = input.scenarioParticipantId ?? input.scenarioParticipant?.id;
  const characterId = input.scenarioParticipant?.characterId;

  return input.encounterParticipants.find(
    (participant) =>
      participant.scenarioParticipantId === scenarioParticipantId ||
      participant.id === scenarioParticipantId ||
      (characterId && participant.characterId === characterId),
  );
}

interface CombatDistanceTableRow {
  edge: CombatDistanceEdge;
  participantALabel: string;
  participantBLabel: string;
  preferredDistanceLabel: string;
}

function getActiveWeaponTemplatesForScenarioParticipant(
  participant: ScenarioParticipant | undefined,
  resolvedEquipmentState?: EquipmentFeatureState,
): WeaponTemplate[] {
  const equipmentStateCandidate = resolvedEquipmentState ?? participant?.snapshot.equipmentState;

  if (!isEquipmentFeatureState(equipmentStateCandidate)) {
    return [];
  }

  const characterId =
    participant?.characterId ?? Object.keys(equipmentStateCandidate.activeLoadoutByCharacterId)[0];
  const loadout = characterId
    ? equipmentStateCandidate.activeLoadoutByCharacterId[characterId]
    : undefined;
  const activeWeaponItemIds = [
    loadout?.activePrimaryWeaponItemId,
    loadout?.activeSecondaryWeaponItemId,
    loadout?.activeMissileWeaponItemId,
  ].filter((itemId): itemId is string => Boolean(itemId));

  return activeWeaponItemIds
    .map((itemId) => {
      const item = equipmentStateCandidate.itemsById[itemId];
      const template = item
        ? equipmentStateCandidate.templates.templatesById[item.templateId]
        : undefined;

      return template?.category === "weapon" ? template : undefined;
    })
    .filter((template): template is WeaponTemplate => Boolean(template));
}

function normalizeCombatWeaponName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLocaleLowerCase()
    : undefined;
}

function getLongestPreferredDistanceForWeaponName(input: {
  participant?: ScenarioParticipant;
  resolvedEquipmentState?: EquipmentFeatureState | null;
  weaponName?: string;
}): CombatDistance | undefined {
  const weaponName = normalizeCombatWeaponName(input.weaponName);
  const activeWeapons = getActiveWeaponTemplatesForScenarioParticipant(
    input.participant,
    input.resolvedEquipmentState ?? undefined,
  );
  const weapon = activeWeapons.find(
    (candidate) => normalizeCombatWeaponName(candidate.name) === weaponName,
  );
  const distances = getWeaponPreferredDistances(weapon);

  return distances.at(-1);
}

function formatCombatDistanceSource(source: CombatDistanceEdge["source"]): string {
  switch (source) {
    case "gm_set":
      return "GM set";
    case "round_end_review":
      return "Round-end review";
    case "maneuver":
      return "Maneuver";
    case "default_weapon_reach":
    default:
      return "Default weapon reach";
  }
}

function formatPreferredDistanceLabel(weapons: WeaponTemplate[]): string {
  const distances = [
    ...new Set(weapons.flatMap((weapon) => getWeaponPreferredDistances(weapon))),
  ].sort((left, right) => left - right);

  return distances.length > 0 ? distances.join(", ") : "Fallback 2";
}

function buildCombatDistanceTableRows(input: {
  encounter: EncounterSession;
  resolvedEquipmentStateByScenarioParticipantId?: Record<string, EquipmentFeatureState | undefined>;
  roundState: CombatRoundState;
  scenarioParticipants: ScenarioParticipant[];
}): CombatDistanceTableRow[] {
  const encounterParticipantById = new Map(
    input.encounter.participants.map((participant) => [participant.id, participant]),
  );
  const scenarioParticipantByRoundParticipantId = new Map(
    input.roundState.participants.map((roundParticipant) => [
      roundParticipant.participantId,
      findScenarioParticipantForCombatRoundParticipant({
        encounterParticipants: input.encounter.participants,
        roundParticipant,
        scenarioParticipants: input.scenarioParticipants,
      }),
    ]),
  );
  const weaponsByParticipantId = Object.fromEntries(
    input.roundState.participants.map((participant) => [
      participant.participantId,
      (() => {
        const scenarioParticipant = scenarioParticipantByRoundParticipantId.get(
          participant.participantId,
        );

        return getActiveWeaponTemplatesForScenarioParticipant(
          scenarioParticipant,
          scenarioParticipant
            ? input.resolvedEquipmentStateByScenarioParticipantId?.[scenarioParticipant.id]
            : undefined,
        );
      })(),
    ]),
  );
  const distanceState = ensureDistanceEdgesForParticipantPairs({
    lastChangedRound: input.roundState.roundNumber,
    participantIds: input.roundState.participants.map((participant) => participant.participantId),
    state: input.roundState.distanceState,
    weaponsByParticipantId,
  });

  return Object.values(distanceState.edges)
    .map((edge) => {
      const participantA =
        input.roundState.participants.find(
          (participant) => participant.participantId === edge.participantAId,
        ) ?? encounterParticipantById.get(edge.participantAId);
      const participantB =
        input.roundState.participants.find(
          (participant) => participant.participantId === edge.participantBId,
        ) ?? encounterParticipantById.get(edge.participantBId);
      const preferredWeapons = [
        ...(weaponsByParticipantId[edge.participantAId] ?? []),
        ...(weaponsByParticipantId[edge.participantBId] ?? []),
      ];

      return {
        edge,
        participantALabel: participantA?.label ?? edge.participantAId,
        participantBLabel: participantB?.label ?? edge.participantBId,
        preferredDistanceLabel: formatPreferredDistanceLabel(preferredWeapons),
      };
    })
    .sort(
      (left, right) =>
        left.participantALabel.localeCompare(right.participantALabel) ||
        left.participantBLabel.localeCompare(right.participantBLabel),
    );
}

function getCombatDistanceTableRowForParticipants(input: {
  participantAId: string | undefined;
  participantAAliases?: readonly string[];
  participantBId: string | undefined;
  participantBAliases?: readonly string[];
  rows: CombatDistanceTableRow[];
}): CombatDistanceTableRow | undefined {
  const participantAAliases = [input.participantAId, ...(input.participantAAliases ?? [])].filter(
    (alias, index, aliases): alias is string => Boolean(alias) && aliases.indexOf(alias) === index,
  );
  const participantBAliases = [input.participantBId, ...(input.participantBAliases ?? [])].filter(
    (alias, index, aliases): alias is string => Boolean(alias) && aliases.indexOf(alias) === index,
  );

  if (participantAAliases.length === 0 || participantBAliases.length === 0) {
    return undefined;
  }

  return input.rows.find(
    (row) =>
      (participantAAliases.includes(row.edge.participantAId) &&
        participantBAliases.includes(row.edge.participantBId)) ||
      (participantAAliases.includes(row.edge.participantBId) &&
        participantBAliases.includes(row.edge.participantAId)),
  );
}

function getEncounterScenarioParticipantIds(
  encounterParticipants: EncounterSession["participants"],
): string[] {
  return encounterParticipants
    .map((participant) => participant.scenarioParticipantId ?? participant.id)
    .filter((participantId): participantId is string => Boolean(participantId));
}

function formatStepStatus(status: string | undefined): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "submitted":
      return "Submitted";
    case "gmEdited":
      return "GM edited";
    case "locked":
      return "Locked";
    case "ready":
      return "Ready";
    case "skipped":
      return "Skipped";
    case "pending":
    default:
      return "Pending";
  }
}

function buildCombatAttackResultParryModifiers(
  attackResult?: CombatRoundAttackRollResult,
): WorkbookRawModifier[] {
  const attackResultModifier = attackResult?.defenderParryModifier ?? 0;

  return attackResultModifier === 0
    ? []
    : [
        {
          label: "attack result",
          value: attackResultModifier,
        },
      ];
}

function CombatParryResolutionPanel(input: {
  attackResult: CombatRoundAttackRollResult;
  controlsDisabled?: boolean;
  modifierAdjustment: number;
  modifierBreakdown?: readonly CombatRoundParryModifierBreakdownEntry[];
  onSelectionChange: (selection: CombatParrySourceSelection) => void;
  parryBase?: number;
  resolution?: CombatRoundParryResolution;
  selection: CombatParrySourceSelection;
  sources?: CombatParrySourceOptions;
}) {
  const canUseMainHand = Boolean(input.sources?.mainHand);
  const canUseOffHand = Boolean(input.sources?.offHand);
  const selectedSourceLabel = formatSelectedCombatParrySourceName({
    selection: input.selection,
    sources: input.sources,
  });
  const modifiedParryBeforeRoll =
    input.parryBase === undefined ? undefined : input.parryBase + input.modifierAdjustment;
  const sourceSummary =
    input.parryBase !== undefined
      ? `${selectedSourceLabel} P ${input.parryBase} + ${formatCombatParryModifierBreakdown({
          fallbackAdjustment: input.modifierAdjustment,
          modifiers: input.modifierBreakdown,
        })}${
          modifiedParryBeforeRoll !== undefined && modifiedParryBeforeRoll !== input.parryBase
            ? ` -> P ${modifiedParryBeforeRoll}`
            : ""
        }`
      : "No available parry score.";

  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Parry resolution</strong>
      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
        {input.attackResult.weaponName} attack result: {input.attackResult.tableResult}
      </div>
      {input.resolution?.status === "resolved" ? (
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{input.resolution.resultLabel}</div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
          <input
            checked={input.selection.usedMainHand}
            disabled={input.controlsDisabled || !canUseMainHand}
            onChange={(event) =>
              input.onSelectionChange({
                ...input.selection,
                usedMainHand: event.target.checked,
              })
            }
            type="checkbox"
          />
          Main hand
        </label>
        <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
          <input
            checked={input.selection.usedOffHand}
            disabled={input.controlsDisabled || !canUseOffHand}
            onChange={(event) =>
              input.onSelectionChange({
                ...input.selection,
                usedOffHand: event.target.checked,
              })
            }
            type="checkbox"
          />
          Off hand
        </label>
      </div>
      <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{sourceSummary}</div>
    </section>
  );
}

function CombatDamageReviewPanel(input: {
  attackerLabel?: string;
  commitReadiness?: CombatRoundPhaseDamageCommitReadiness;
  controlsDisabled?: boolean;
  damageResult: CombatRoundDamageResult;
  defenderLabel?: string;
  draft: CombatDamageReviewDraft;
  onDraftChange: (draft: CombatDamageReviewDraft) => void;
  onSaveReview: () => void;
  saving?: boolean;
}) {
  const disabled = input.controlsDisabled || input.saving;
  const criticalEffectProposal = input.damageResult.review?.criticalEffectProposal;
  const effectiveDamage = getCombatRoundEffectiveDamageResult(input.damageResult);
  const commitStatus = input.commitReadiness
    ? input.commitReadiness.ready
      ? "Ready to commit"
      : (input.commitReadiness.reason ?? "Cannot commit: phase damage is not ready.")
    : undefined;
  const criticalEffectStatus = criticalEffectProposal
    ? criticalEffectProposal.criticalIndexStatus === "no_effect"
      ? "No critical effect."
      : criticalEffectProposal.warnings.length > 0
        ? `Critical effects unavailable: ${criticalEffectProposal.warnings.join(" ")}`
        : undefined
    : effectiveDamage.effectiveCriticalGrade
      ? "Critical effects not accepted/committed yet."
      : undefined;
  const criticalMinimumStatus =
    effectiveDamage.criticalMinApplied && effectiveDamage.criticalMinTotalDamage !== undefined
      ? `Critical minimum raises damage from ${effectiveDamage.preCriticalEffectiveDamage} to ${effectiveDamage.criticalMinTotalDamage}.`
      : effectiveDamage.criticalMinTotalDamage !== undefined
        ? `Critical minimum damage floor ${effectiveDamage.criticalMinTotalDamage} is covered.`
        : undefined;
  const proposedRows = buildCombatDamageReviewProposedSheetRows({
    damageResult: input.damageResult,
    draft: input.draft,
  });
  const effectById = new Map(input.draft.additionalEffects.map((effect) => [effect.id, effect]));
  const acceptedEffectLabels = Array.from(
    new Set(
      proposedRows
        .filter((row) => row.accepted && row.rowType !== "Physical damage")
        .map((row) => row.rowType.toLowerCase()),
    ),
  );
  const acceptedOperationalLabels = input.draft.operationalConsequences
    .filter((consequence) => consequence.accepted)
    .map((consequence) => consequence.label.toLowerCase());
  const outcomeSummary = [
    `${effectiveDamage.effectiveTotalDamage} physical damage to ${
      effectiveDamage.effectiveSelectedHitLocation
        ? getHitLocationFullLabel(effectiveDamage.effectiveSelectedHitLocation).toLowerCase()
        : "general"
    }`,
    effectiveDamage.effectiveCriticalGrade
      ? `Critical ${effectiveDamage.effectiveCriticalGrade.toUpperCase()}${
          criticalEffectProposal?.title ? `: ${criticalEffectProposal.title}` : ""
        }`
      : undefined,
    acceptedEffectLabels.length ? `Effects: ${acceptedEffectLabels.join(", ")}` : undefined,
    acceptedOperationalLabels.length
      ? `Operational: ${acceptedOperationalLabels.join(", ")}`
      : undefined,
  ].filter((entry): entry is string => Boolean(entry));
  const representedRollReportKeys = new Set(
    input.draft.additionalEffects.flatMap((effect) =>
      (effect.rollReports ?? []).map(
        (report) => `${report.effectKey}:${report.purpose}:${report.formula}`,
      ),
    ),
  );
  const unrepresentedRollReports =
    criticalEffectProposal?.rollReports.filter(
      (report) =>
        !representedRollReportKeys.has(`${report.effectKey}:${report.purpose}:${report.formula}`),
    ) ?? [];
  const updateAdditionalEffect = (
    effectId: string,
    patch: Partial<CombatDamageReviewAdditionalEffectDraft>,
  ) => {
    input.onDraftChange({
      ...input.draft,
      additionalEffects: input.draft.additionalEffects.map((effect) =>
        effect.id === effectId ? { ...effect, ...patch } : effect,
      ),
    });
  };
  const removeAdditionalEffect = (effectId: string) => {
    input.onDraftChange({
      ...input.draft,
      additionalEffects: input.draft.additionalEffects.filter((effect) => effect.id !== effectId),
    });
  };
  const updateOperationalConsequence = (
    consequenceId: string,
    patch: Partial<CombatDamageReviewOperationalConsequenceDraft>,
  ) => {
    input.onDraftChange({
      ...input.draft,
      operationalConsequences: input.draft.operationalConsequences.map((consequence) =>
        consequence.id === consequenceId ? { ...consequence, ...patch } : consequence,
      ),
    });
  };

  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>
        Damage/effects review{input.defenderLabel ? ` for ${input.defenderLabel}` : ""}
      </strong>
      <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
        The attacker rolls; {input.defenderLabel ?? "the defender"} receives the damage/effects
        review.
        {input.attackerLabel ? ` Attacker: ${input.attackerLabel}.` : ""}
      </div>
      <section style={combatDamageReviewSectionStyle}>
        <strong style={combatDamageReviewSectionHeadingStyle}>Outcome summary</strong>
        <ul style={{ color: "#2f342b", fontSize: "0.9rem", margin: 0, paddingLeft: "1.1rem" }}>
          {outcomeSummary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {criticalEffectStatus ? (
          <div style={combatDamageReviewHelperTextStyle}>{criticalEffectStatus}</div>
        ) : null}
      </section>
      <section style={combatDamageReviewSectionStyle}>
        <strong style={combatDamageReviewSectionHeadingStyle}>Proposed recorded effects</strong>
        <div style={combatDamageReviewHelperTextStyle}>
          Rows proposed for commit. Review accepted rows before saving.
        </div>
        {criticalEffectProposal ? (
          <section style={{ display: "grid", gap: "0.35rem" }}>
            <strong style={{ fontSize: "0.86rem" }}>Critical table proposal</strong>
            <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>
              {criticalEffectProposal.criticalIndexStatus === "no_effect"
                ? "No critical effect"
                : (criticalEffectProposal.title ?? "Critical table mapping unavailable")}
            </div>
            {criticalEffectProposal.bodyText ? (
              <div style={{ lineHeight: 1.45 }}>{criticalEffectProposal.bodyText}</div>
            ) : null}
            {unrepresentedRollReports.length > 0 ? (
              <div style={combatDamageReviewHelperTextStyle}>
                App-side rolls:{" "}
                {unrepresentedRollReports
                  .map(
                    (report) => `${report.formula} ${report.rolls.join(" + ")} = ${report.total}`,
                  )
                  .join("; ")}
              </div>
            ) : null}
            {criticalEffectProposal.warnings.length > 0 ? (
              <div
                style={{ color: "#8a3b1f", display: "grid", gap: "0.2rem", fontSize: "0.85rem" }}
              >
                {criticalEffectProposal.warnings.map((warning, index) => (
                  <div key={`critical-effect-proposal-warning:${index}:${warning}`}>{warning}</div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
        <strong style={{ fontSize: "0.86rem" }}>Character-sheet rows: {proposedRows.length}</strong>
        {proposedRows.length === 0 ? (
          <div style={combatDamageReviewHelperTextStyle}>No character-sheet rows proposed.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: "0.82rem", width: "100%" }}>
              <thead>
                <tr>
                  <th style={combatReviewRowHeaderStyle}>Accept</th>
                  <th style={combatReviewRowHeaderStyle}>Row</th>
                  <th style={combatReviewRowHeaderStyle}>Target</th>
                  <th style={combatReviewRowHeaderStyle}>Value</th>
                  <th style={combatReviewRowHeaderStyle}>Duration</th>
                  <th style={combatReviewRowHeaderStyle}>Details</th>
                </tr>
              </thead>
              <tbody>
                {proposedRows.map((row, index) => {
                  const effect = row.effectId ? effectById.get(row.effectId) : undefined;
                  const isMechanical = effect?.kind === "modifier" || effect?.kind === "fatigue";
                  const isBleed =
                    effect?.rowCategory === "bleed" || effect?.rowCategory === "internal_bleed";

                  return (
                    <tr key={`${row.rowType}-${index}`}>
                      <td style={combatReviewRowCellStyle}>
                        <input
                          checked={row.accepted}
                          disabled={disabled || !row.effectId}
                          onChange={(event) =>
                            row.effectId
                              ? updateAdditionalEffect(row.effectId, {
                                  accepted: event.target.checked,
                                })
                              : undefined
                          }
                          type="checkbox"
                        />
                      </td>
                      <td style={combatReviewRowCellStyle}>
                        {effect ? (
                          <input
                            disabled={disabled}
                            onChange={(event) =>
                              updateAdditionalEffect(effect.id, { label: event.target.value })
                            }
                            style={{ width: "100%" }}
                            type="text"
                            value={effect.label}
                          />
                        ) : (
                          row.rowType
                        )}
                      </td>
                      <td style={combatReviewRowCellStyle}>
                        {effect?.kind === "modifier" ? (
                          <select
                            disabled={disabled}
                            onChange={(event) =>
                              updateAdditionalEffect(effect.id, {
                                modifierBucket: event.target.value,
                                rowCategory:
                                  event.target.value === "obSkill"
                                    ? "ob_skill_modifier"
                                    : event.target.value === "db"
                                      ? "db_parry_modifier"
                                      : "general_modifier",
                              })
                            }
                            value={effect.modifierBucket}
                          >
                            {COMBAT_DAMAGE_REVIEW_MODIFIER_BUCKETS.map((bucket) => (
                              <option key={bucket.value} value={bucket.value}>
                                {bucket.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          row.target
                        )}
                      </td>
                      <td style={combatReviewRowCellStyle}>
                        {effect && (isMechanical || isBleed) ? (
                          <input
                            disabled={disabled}
                            inputMode="numeric"
                            onChange={(event) =>
                              updateAdditionalEffect(effect.id, {
                                [isBleed ? "rateValuePerRound" : "modifierValue"]:
                                  event.target.value,
                              })
                            }
                            style={{ width: "5rem" }}
                            type="text"
                            value={isBleed ? effect.rateValuePerRound : effect.modifierValue}
                          />
                        ) : (
                          row.value || "—"
                        )}
                      </td>
                      <td style={combatReviewRowCellStyle}>
                        {effect ? (
                          <input
                            disabled={disabled}
                            inputMode="numeric"
                            onChange={(event) =>
                              updateAdditionalEffect(effect.id, {
                                durationRounds: event.target.value,
                              })
                            }
                            placeholder="rounds"
                            style={{ width: "5rem" }}
                            type="text"
                            value={effect.durationRounds}
                          />
                        ) : (
                          row.duration || "—"
                        )}
                      </td>
                      <td style={combatReviewRowCellStyle}>
                        {effect ? (
                          <div
                            style={{
                              alignItems: "center",
                              display: "grid",
                              gap: "0.35rem",
                              gridTemplateColumns: "minmax(10rem, 1fr) auto",
                            }}
                          >
                            <input
                              disabled={disabled}
                              onChange={(event) =>
                                updateAdditionalEffect(effect.id, { notes: event.target.value })
                              }
                              style={{ width: "100%" }}
                              type="text"
                              value={effect.notes}
                            />
                            <button
                              disabled={disabled}
                              onClick={() => removeAdditionalEffect(effect.id)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          row.details
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section style={combatDamageReviewSectionStyle}>
        <strong style={combatDamageReviewSectionHeadingStyle}>GM adjustments</strong>
        <div style={combatDamageReviewHelperTextStyle}>
          Review overrides and accepted rows here; commit stays in Current action.
        </div>
        <div
          style={{
            display: "grid",
            gap: "0.5rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))",
          }}
        >
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>Location</span>
            <select
              disabled={disabled}
              onChange={(event) =>
                input.onDraftChange({
                  ...input.draft,
                  selectedHitLocationOverride: event.target.value,
                })
              }
              value={input.draft.selectedHitLocationOverride}
            >
              {input.draft.selectedHitLocationOverride ? null : (
                <option value="">Not recorded</option>
              )}
              {HIT_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {getHitLocationFullLabel(location)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>Direction</span>
            <select
              disabled={disabled}
              onChange={(event) =>
                input.onDraftChange({
                  ...input.draft,
                  attackDirectionOverride: event.target.value as CombatRoundAttackDirection,
                })
              }
              value={input.draft.attackDirectionOverride}
            >
              <option value="front">Front</option>
              <option value="back">Back</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>Armor</span>
            <span style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
              {effectiveDamage.effectiveArmorCoverageLabel
                ? `${effectiveDamage.effectiveArmorCoverageLabel} at ${
                    effectiveDamage.effectiveArmorRegionLabel ?? "selected location"
                  }`
                : "No armor coverage"}
            </span>
          </label>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>
              Critical roll / effect index
            </span>
            <input
              disabled={disabled}
              inputMode="numeric"
              onChange={(event) =>
                input.onDraftChange({
                  ...input.draft,
                  finalCriticalRollOverride: event.target.value,
                })
              }
              placeholder="No effect or 1-16"
              type="text"
              value={input.draft.finalCriticalRollOverride}
            />
          </label>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>
              Damage override
            </span>
            <input
              disabled={disabled}
              inputMode="numeric"
              onChange={(event) =>
                input.onDraftChange({
                  ...input.draft,
                  totalDamageOverride: event.target.value,
                })
              }
              type="text"
              value={input.draft.totalDamageOverride}
            />
          </label>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>
              Armor modifier
            </span>
            <input
              disabled={disabled}
              inputMode="numeric"
              onChange={(event) =>
                input.onDraftChange({
                  ...input.draft,
                  armorModifierOverride: event.target.value,
                })
              }
              type="text"
              value={input.draft.armorModifierOverride}
            />
          </label>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>
              Critical grade
            </span>
            <select
              disabled={disabled}
              onChange={(event) =>
                input.onDraftChange({
                  ...input.draft,
                  criticalGradeOverride: event.target.value,
                })
              }
              value={input.draft.criticalGradeOverride}
            >
              <option value="none">None</option>
              {["a", "b", "c", "d", "e", "f"].map((grade) => (
                <option key={grade} value={grade}>
                  {grade.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>
              Critical location
            </span>
            <select
              disabled={disabled}
              onChange={(event) =>
                input.onDraftChange({
                  ...input.draft,
                  criticalLocationOverride: event.target.value,
                })
              }
              value={input.draft.criticalLocationOverride}
            >
              {input.draft.criticalLocationOverride ? null : <option value="">Not recorded</option>}
              {HIT_LOCATIONS.map((location) => (
                <option key={location} value={location}>
                  {getHitLocationFullLabel(location)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>
              Critical type mod
            </span>
            <input
              disabled={disabled}
              inputMode="numeric"
              onChange={(event) =>
                input.onDraftChange({
                  ...input.draft,
                  criticalTypeModifierOverride: event.target.value,
                })
              }
              type="text"
              value={input.draft.criticalTypeModifierOverride}
            />
          </label>
          <label style={{ display: "grid", gap: "0.2rem" }}>
            <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>
              Armor critical
            </span>
            <input
              disabled={disabled}
              inputMode="numeric"
              onChange={(event) =>
                input.onDraftChange({
                  ...input.draft,
                  armorCriticalModifierOverride: event.target.value,
                })
              }
              type="text"
              value={input.draft.armorCriticalModifierOverride}
            />
          </label>
        </div>
        <label style={{ display: "grid", gap: "0.2rem" }}>
          <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>Combat note</span>
          <input
            disabled={disabled}
            onChange={(event) =>
              input.onDraftChange({
                ...input.draft,
                notes: event.target.value,
              })
            }
            type="text"
            value={input.draft.notes}
          />
        </label>
        {input.draft.operationalConsequences.length > 0 ? (
          <section style={{ display: "grid", gap: "0.5rem" }}>
            <strong style={{ fontSize: "0.86rem" }}>
              Operational consequences: {input.draft.operationalConsequences.length}
            </strong>
            {input.draft.operationalConsequences.map((consequence) => (
              <label
                key={consequence.id}
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: "0.45rem",
                  fontSize: "0.9rem",
                }}
                title={consequence.reason}
              >
                <input
                  checked={consequence.accepted}
                  disabled={disabled}
                  onChange={(event) =>
                    updateOperationalConsequence(consequence.id, {
                      accepted: event.target.checked,
                    })
                  }
                  type="checkbox"
                />
                <span>{consequence.label}</span>
              </label>
            ))}
          </section>
        ) : null}
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <strong style={{ fontSize: "0.86rem" }}>Add manual row</strong>
          <button
            disabled={disabled}
            onClick={() =>
              input.onDraftChange({
                ...input.draft,
                additionalEffects: [
                  ...input.draft.additionalEffects,
                  createCombatDamageReviewEffectDraft("modifier"),
                ],
              })
            }
            type="button"
          >
            Add modifier row
          </button>
          <button
            disabled={disabled}
            onClick={() =>
              input.onDraftChange({
                ...input.draft,
                additionalEffects: [
                  ...input.draft.additionalEffects,
                  createCombatDamageReviewEffectDraft("note"),
                ],
              })
            }
            type="button"
          >
            Add note row
          </button>
        </div>
        <button disabled={disabled} onClick={input.onSaveReview} type="button">
          {input.saving ? "Saving..." : "Save review"}
        </button>
      </section>
      <details
        style={{
          ...combatDamageReviewSectionStyle,
          color: "#5e5a50",
          fontSize: "0.86rem",
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Calculation details</summary>
        {criticalMinimumStatus ? (
          <div style={{ color: "#5e5a50", marginTop: "0.5rem" }}>{criticalMinimumStatus}</div>
        ) : (
          <div style={{ color: "#5e5a50", marginTop: "0.5rem" }}>
            No additional calculation notes.
          </div>
        )}
      </details>
      <section style={combatDamageReviewSectionStyle}>
        <strong style={combatDamageReviewSectionHeadingStyle}>Commit readiness</strong>
        {commitStatus ? (
          <div
            style={{
              color: input.commitReadiness?.ready ? "#365f2c" : "#8a3b1f",
              fontSize: "0.88rem",
              fontWeight: 700,
            }}
          >
            {commitStatus}
          </div>
        ) : (
          <div style={combatDamageReviewHelperTextStyle}>
            Commit readiness appears after required damage rolls are resolved.
          </div>
        )}
        {input.commitReadiness?.warnings.length ? (
          <div style={{ color: "#8a3b1f", display: "grid", gap: "0.2rem", fontSize: "0.85rem" }}>
            {input.commitReadiness.warnings.map((warning, index) => (
              <div key={`damage-commit-readiness-warning:${index}:${warning}`}>{warning}</div>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}

function CombatRoundEndParticipantReviewPanel(input: {
  controlsDisabled?: boolean;
  observationPending?: boolean;
  participantLabel?: string;
  review?: RoundEndParticipantReview;
}) {
  const review = input.review;
  const pendingHealthRolls =
    review?.proposedHealthRolls.filter(
      (proposal) => proposal.accepted && proposal.status === "pending",
    ) ?? [];
  const pendingRequirements =
    review?.canonicalReview?.requirements.filter((requirement) => !requirement.resolved) ?? [];

  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Participant review</strong>
      {!review ? (
        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>Preparing round-end review...</div>
      ) : (
        <>
          <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
            {input.participantLabel ? `${input.participantLabel}: ` : ""}
            {input.observationPending
              ? "observation roll pending"
              : review.status.replaceAll("_", " ")}
          </div>
          {review.proposedEffects.length > 0 ? (
            <section style={{ display: "grid", gap: "0.25rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Duration updates</strong>
              {review.proposedEffects.map((proposal) => (
                <div key={proposal.id} style={{ fontSize: "0.88rem" }}>
                  {proposal.label}
                  {proposal.nextDuration ? ` -> ${proposal.nextDuration}` : ""}
                </div>
              ))}
            </section>
          ) : null}
          {review.proposedRemovals.length > 0 ? (
            <section style={{ display: "grid", gap: "0.25rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Expired effects</strong>
              {review.proposedRemovals.map((proposal) => (
                <div key={proposal.id} style={{ fontSize: "0.88rem" }}>
                  {proposal.label}
                </div>
              ))}
            </section>
          ) : null}
          {review.proposedDamage.length > 0 ? (
            <section style={{ display: "grid", gap: "0.25rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Active bleed</strong>
              {review.proposedDamage.map((proposal) => (
                <div
                  key={proposal.id}
                  style={{
                    borderTop: "1px solid #ddd3bf",
                    display: "grid",
                    gap: "0.15rem",
                    paddingTop: "0.35rem",
                  }}
                >
                  <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>{proposal.label}</div>
                  <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                    Rate {proposal.bleedRate}/10 HP/round · accumulated{" "}
                    {proposal.previousAccumulatedTenths}/10 + {proposal.bleedRate}/10 ={" "}
                    {proposal.accumulatedTenths}/10
                  </div>
                  <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                    Damage due {proposal.amount} · remainder {proposal.remainingAccumulatedTenths}
                    /10
                  </div>
                  <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                    Health roll{" "}
                    {proposal.healthCheckDue
                      ? "due now"
                      : proposal.roundsUntilHealthCheck !== undefined
                        ? `due in ${proposal.roundsUntilHealthCheck} round${
                            proposal.roundsUntilHealthCheck === 1 ? "" : "s"
                          }`
                        : "not due"}
                  </div>
                  {proposal.notes ? (
                    <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>{proposal.notes}</div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}
          {pendingHealthRolls.length > 0 ? (
            <section style={{ display: "grid", gap: "0.4rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Pending Health check</strong>
              {pendingHealthRolls.map((proposal) => (
                <div
                  key={proposal.id}
                  style={{
                    borderTop: "1px solid #ddd3bf",
                    display: "grid",
                    gap: "0.3rem",
                    paddingTop: "0.4rem",
                  }}
                >
                  <div style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>
                    {proposal.label} · Difficulty {proposal.difficulty}
                  </div>
                  <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                    Health +{proposal.healthStat} · pending
                  </div>
                  {proposal.warnings.map((warning, warningIndex) => (
                    <div
                      key={`end-review-health-roll-warning:${proposal.id}:${warningIndex}:${warning}`}
                      style={{ color: "#8a3b1f", fontSize: "0.82rem" }}
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ) : null}
          {pendingRequirements.filter((requirement) => requirement.kind !== "health_check").length >
          0 ? (
            <section style={{ display: "grid", gap: "0.25rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Pending</strong>
              {pendingRequirements
                .filter((requirement) => requirement.kind !== "health_check")
                .map((requirement) => (
                  <div key={requirement.id} style={{ fontSize: "0.88rem" }}>
                    {requirement.label}
                  </div>
                ))}
            </section>
          ) : null}
          {review.warnings.map((warning, index) => (
            <div
              key={`end-review-warning:${index}:${warning}`}
              style={{ color: "#8a3b1f", fontSize: "0.85rem" }}
            >
              {warning}
            </div>
          ))}
          {review.proposedEffects.length === 0 &&
          review.proposedRemovals.length === 0 &&
          review.proposedDamage.length === 0 &&
          review.proposedHealthRolls.length === 0 ? (
            <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
              No participant-owned round-end changes proposed.
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function CombatRoundEndDistanceControlPanel(input: {
  participantLabelsById: Record<string, string>;
  roundReview?: CombatRoundEndReview;
}) {
  const distanceProposals = (input.roundReview?.proposedDistances ?? []).filter(
    (proposal) => getCombatRoundEndDistanceProposalLifecycle(proposal) !== "applied",
  );

  if (input.roundReview && distanceProposals.length === 0) {
    return null;
  }

  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Round-end distance control</strong>
      {!input.roundReview ? (
        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>Preparing round-end review...</div>
      ) : distanceProposals.length > 0 ? (
        <section style={{ display: "grid", gap: "0.4rem" }}>
          {distanceProposals.map((proposal) => {
            const participantALabel =
              input.participantLabelsById[proposal.participantAId] ?? proposal.participantAId;
            const participantBLabel =
              input.participantLabelsById[proposal.participantBId] ?? proposal.participantBId;
            const resultA = proposal.participantA.result;
            const resultB = proposal.participantB.result;
            const participantACalculation = resultA
              ? buildDodgeCalculationPresentationFromSnapshot({
                  calculationId: `${proposal.id}:participant-a`,
                  calculationType: "distance_control_roll",
                  facts: resultA,
                })
              : undefined;
            const participantBCalculation = resultB
              ? buildDodgeCalculationPresentationFromSnapshot({
                  calculationId: `${proposal.id}:participant-b`,
                  calculationType: "distance_control_roll",
                  facts: resultB,
                })
              : undefined;
            const participantASummary = participantACalculation
              ? buildCombatCalculationPresentationLines(participantACalculation)
              : [proposal.participantA.status === "pending" ? "pending" : "not required"];
            const participantBSummary = participantBCalculation
              ? buildCombatCalculationPresentationLines(participantBCalculation)
              : [proposal.participantB.status === "pending" ? "pending" : "not required"];

            return (
              <div
                key={proposal.id}
                style={{
                  borderTop: "1px solid #ddd3bf",
                  display: "grid",
                  gap: "0.3rem",
                  paddingTop: "0.4rem",
                }}
              >
                <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>
                  {participantALabel} ↔ {participantBLabel}
                </div>
                <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                  Current {proposal.currentDistance} · {participantALabel}:{" "}
                  {proposal.participantA.desiredDistance ?? "no preference"} · {participantBLabel}:{" "}
                  {proposal.participantB.desiredDistance ?? "no preference"}
                </div>
                <div
                  style={{ color: "#5e5a50", display: "grid", fontSize: "0.82rem", gap: "0.1rem" }}
                >
                  <strong>{participantALabel}</strong>
                  {participantASummary.map((line) => (
                    <div key={`${proposal.id}:a:${line}`}>{line}</div>
                  ))}
                </div>
                <div
                  style={{ color: "#5e5a50", display: "grid", fontSize: "0.82rem", gap: "0.1rem" }}
                >
                  <strong>{participantBLabel}</strong>
                  {participantBSummary.map((line) => (
                    <div key={`${proposal.id}:b:${line}`}>{line}</div>
                  ))}
                </div>
                {proposal.winnerParticipantId ? (
                  <div style={{ color: "#3f5f46", fontSize: "0.82rem" }}>
                    Winner:{" "}
                    {input.participantLabelsById[proposal.winnerParticipantId] ??
                      proposal.winnerParticipantId}
                  </div>
                ) : proposal.status === "rolled" && proposal.outcome === "tie" ? (
                  <div style={{ color: "#3f5f46", fontSize: "0.82rem" }}>
                    Tie: current distance remains unless GM overrides.
                  </div>
                ) : null}
                <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                  Proposed next-round distance: {proposal.proposedDistance ?? "pending"}
                  {proposal.appliedDistance !== undefined
                    ? ` · applied ${proposal.appliedDistance}`
                    : ""}
                  {` · ${proposal.status.replaceAll("_", " ")}`}
                </div>
                {[
                  ...proposal.warnings,
                  ...proposal.participantA.warnings,
                  ...proposal.participantB.warnings,
                ].map((warning, warningIndex) => (
                  <div
                    key={`end-review-distance-warning:${proposal.id}:${warningIndex}:${warning}`}
                    style={{ color: "#8a3b1f", fontSize: "0.82rem" }}
                  >
                    {warning}
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      ) : (
        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
          No distance-control proposals for this round.
        </div>
      )}
    </section>
  );
}

function resolveCombatRoundInspectionSelection(input: {
  manualSelection?: CombatRoundSelectionTarget;
  pendingSelection?: CombatRoundSelectionTarget;
  state: CombatRoundState;
}): CombatRoundSelectionTarget {
  return (
    getCombatRoundManagerInspectionSelection(input) ??
    getCurrentCombatRoundTaskSelection(input.state) ?? {
      participantId: input.state.participants[0]?.participantId,
      step: input.state.currentStep,
    }
  );
}

function getCombatRoundManagerStateFromCommandEnvelope(input: {
  commandEnvelope?: CombatRoundCommandEnvelope;
  encounter: EncounterSession;
}): {
  inspectionSelection: CombatRoundSelectionTarget;
  state: CombatRoundState;
} {
  const initialized = initializeCombatRoundState({ encounter: input.encounter });
  const currentTask = input.commandEnvelope?.currentTask;
  const currentTaskSelection: CombatRoundSelectionTarget | undefined = currentTask
    ? {
        participantId: currentTask.participantId,
        step: currentTask.step,
      }
    : undefined;

  return {
    inspectionSelection: resolveCombatRoundInspectionSelection({
      manualSelection: currentTaskSelection,
      pendingSelection: currentTaskSelection,
      state: initialized,
    }),
    state: initialized,
  };
}

function getCombatMutationConflictCode(error: unknown): string | undefined {
  if (
    !(error instanceof ApiRequestError) ||
    error.status !== 409 ||
    !error.payload ||
    typeof error.payload !== "object" ||
    !("code" in error.payload) ||
    typeof error.payload.code !== "string"
  ) {
    return undefined;
  }

  return error.payload.code;
}

function getCombatMutationRefreshMessage(code: string): string {
  if (code === "stale_revision") {
    return "Combat changed in another view. The current action was refreshed; review it before retrying.";
  }
  if (code.includes("modifier")) {
    return "Combat modifiers changed in another view. The current action was refreshed; review it before retrying.";
  }
  return "The displayed combat task is no longer current. The current action was refreshed; review it before retrying.";
}

/**
 * Keep the GM's in-progress adjustment local to this small editor.  The parent
 * combat manager only receives the draft when its primary action is confirmed,
 * so typing cannot rebuild history or issue mutation requests.
 */
const AdjustDistanceAdjustmentEditor = forwardRef<
  AdjustDistanceAdjustmentDraftHandle,
  {
    attackerParticipantId: string;
    defenderParticipantId: string;
    proposalId: string;
    saving: boolean;
    savedAdjustment?: { notes?: string; participantId?: string; value?: number };
  }
>(function AdjustDistanceAdjustmentEditor(input, ref) {
  const draftRef = useRef<AdjustDistanceAdjustmentDraft>({
    note: input.savedAdjustment?.notes ?? "",
    participantId: input.savedAdjustment?.participantId ?? "",
    value: String(input.savedAdjustment?.value ?? 0),
  });
  const [, setDraftRevision] = useState(0);
  const draft = draftRef.current;
  const updateDraft = (
    update: (current: AdjustDistanceAdjustmentDraft) => AdjustDistanceAdjustmentDraft,
  ) => {
    draftRef.current = update(draftRef.current);
    setDraftRevision((current) => current + 1);
  };

  useEffect(() => {
    draftRef.current = {
      note: input.savedAdjustment?.notes ?? "",
      participantId: input.savedAdjustment?.participantId ?? "",
      value: String(input.savedAdjustment?.value ?? 0),
    };
    setDraftRevision((current) => current + 1);
  }, [
    input.proposalId,
    input.savedAdjustment?.notes,
    input.savedAdjustment?.participantId,
    input.savedAdjustment?.value,
  ]);

  useImperativeHandle(ref, () => ({ getDraft: () => draftRef.current }), []);

  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <div
        style={{
          alignItems: "end",
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "minmax(9rem, 12rem) minmax(5rem, 6rem)",
        }}
      >
        <label style={compactFieldLabelStyle}>
          <span>Adjustment target</span>
          <select
            disabled={input.saving}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, participantId: event.target.value }))
            }
            value={draft.participantId}
          >
            <option value="">Neither</option>
            <option value={input.attackerParticipantId}>Attacker</option>
            <option value={input.defenderParticipantId}>Defender</option>
          </select>
        </label>
        <label style={compactFieldLabelStyle}>
          <span>Modifier</span>
          <input
            aria-describedby={`${input.proposalId}:adjustment-help`}
            disabled={input.saving}
            onChange={(event) =>
              updateDraft((current) => ({ ...current, value: event.target.value }))
            }
            step="1"
            type="number"
            value={draft.value}
          />
        </label>
      </div>
      <span
        id={`${input.proposalId}:adjustment-help`}
        style={{ color: "#5e5a50", fontSize: "0.78rem" }}
      >
        Typical range: -4 to +4 (guidance only)
      </span>
      <label style={compactFieldLabelStyle}>
        <span>Combat note (optional)</span>
        <input
          disabled={input.saving}
          onChange={(event) => updateDraft((current) => ({ ...current, note: event.target.value }))}
          value={draft.note}
        />
      </label>
    </div>
  );
});

export default function CombatRoundManagerPanel({
  encounter,
  onEncounterUpdated,
  onScenarioParticipantsUpdated,
  scenarioParticipants = [],
}: CombatRoundManagerPanelProps) {
  const panelViewModelStartedAt = combatPerformanceNow();
  const presentationLayerCacheRef = useRef<ReturnType<
    typeof createCombatPresentationLayerCache
  > | null>(null);
  if (!presentationLayerCacheRef.current) {
    presentationLayerCacheRef.current = createCombatPresentationLayerCache();
  }
  const initialRoundState = useMemo(() => initializeCombatRoundState({ encounter }), [encounter]);
  const initialInspectionSelection = useMemo(
    () =>
      resolveCombatRoundInspectionSelection({
        manualSelection: getCurrentCombatRoundTaskSelection(initialRoundState),
        state: initialRoundState,
      }),
    [initialRoundState],
  );
  const [roundView, setRoundView] = useState<CombatRoundViewState>({
    encounterId: encounter.id,
    encounterRevision: encounter.updatedAt,
    state: initialRoundState,
  });
  const roundState = roundView.state;
  const acceptedEncounterRevisionRef = useRef({
    encounterId: encounter.id,
    updatedAt: encounter.updatedAt,
  });
  const setRoundState = useCallback(
    (state: CombatRoundState, encounterRevision?: string) => {
      if (
        encounterRevision &&
        !canAcceptCombatRoundViewRevision({
          accepted: {
            encounterId: acceptedEncounterRevisionRef.current.encounterId,
            encounterRevision: acceptedEncounterRevisionRef.current.updatedAt,
          },
          candidateEncounterId: encounter.id,
          candidateRevision: encounterRevision,
        })
      ) {
        return;
      }

      if (encounterRevision) {
        acceptedEncounterRevisionRef.current = {
          encounterId: encounter.id,
          updatedAt: encounterRevision,
        };
      }
      setRoundView((current) =>
        updateCombatRoundViewState({
          current,
          encounterId: encounter.id,
          encounterRevision,
          state,
        }),
      );
    },
    [encounter.id],
  );
  const acceptCanonicalEncounterState = useCallback(
    (
      nextEncounter: EncounterSession,
      state = initializeCombatRoundState({ encounter: nextEncounter }),
    ) => {
      const accepted = acceptedEncounterRevisionRef.current;

      if (
        !canAcceptCombatRoundViewRevision({
          accepted: {
            encounterId: accepted.encounterId,
            encounterRevision: accepted.updatedAt,
          },
          candidateEncounterId: nextEncounter.id,
          candidateRevision: nextEncounter.updatedAt,
        })
      ) {
        recordCombatPerformanceAdoption({
          accepted: false,
          revision: nextEncounter.updatedAt,
        });
        return false;
      }

      acceptedEncounterRevisionRef.current = {
        encounterId: nextEncounter.id,
        updatedAt: nextEncounter.updatedAt,
      };
      setRoundView((current) =>
        updateCombatRoundViewState({
          current,
          encounterId: nextEncounter.id,
          encounterRevision: nextEncounter.updatedAt,
          state,
        }),
      );
      recordCombatPerformanceAdoption({
        accepted: true,
        revision: nextEncounter.updatedAt,
      });
      return true;
    },
    [],
  );
  const [inspectionSelection, setInspectionSelection] = useState(initialInspectionSelection);
  const [recentResultFocus, setRecentResultFocus] = useState<CombatRecentResultFocus>();
  const [recentResultRequest, setRecentResultRequest] = useState<{
    readonly acceptedRevision: string;
    readonly candidate: CombatRecentResultCandidate;
  }>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [stepWorkflowStatus, setStepWorkflowStatus] = useState<CombatStepAutomationRunResult>();
  const [stepWorkflowDeclarationProposal, setStepWorkflowDeclarationProposal] =
    useState<CombatNpcDeclarationProposal>();
  useEffect(() => {
    if (!saving) {
      settleCombatPerformanceInteraction();
    }
  }, [roundView.encounterRevision, saving]);
  const [scenarioParticipantOverrides, setScenarioParticipantOverrides] = useState<
    Record<string, ScenarioParticipant>
  >({});
  const [inspectorDrafts, setInspectorDrafts] = useState<
    Record<string, CombatInspectorDeclarationDraft>
  >({});
  const [inspectorModifierEditedDraftKeys, setInspectorModifierEditedDraftKeys] = useState<
    Record<string, true>
  >({});
  const modifierReviewInputSnapshotsRef = useRef(
    new Map<string, NonNullable<ReturnType<typeof getOrCreateCombatModifierReviewInputSnapshot>>>(),
  );
  const [parrySourceSelections, setParrySourceSelections] = useState<
    Record<string, CombatParrySourceSelection>
  >({});
  const [damageReviewDrafts, setDamageReviewDrafts] = useState<
    Record<string, CombatDamageReviewDraft>
  >({});
  const [combatExperienceDifficultyDrafts, setCombatExperienceDifficultyDrafts] = useState<
    Record<string, string>
  >({});
  const combatExperienceDifficultyRequestInFlightRef = useRef(false);
  const [distanceDrafts, setDistanceDrafts] = useState<Record<string, string>>({});
  const [roundEndDistanceOverrideDrafts, setRoundEndDistanceOverrideDrafts] = useState<
    Record<string, string>
  >({});
  const [roundEndDistanceRollSelectionKey, setRoundEndDistanceRollSelectionKey] = useState("");
  const [roundEndDistanceCommitProposalId, setRoundEndDistanceCommitProposalId] = useState("");
  const [inspectorPhaseAttackChoiceSelection, setInspectorPhaseAttackChoiceSelection] =
    useState<PhaseAttackChoiceSelection>("continue");
  const [inspectorDoubleAttackDecision, setInspectorDoubleAttackDecision] =
    useState<DoubleAttackPhase2Decision>("continue");
  const [inspectorFeintAttackerModifier, setInspectorFeintAttackerModifier] = useState("0");
  const [inspectorFeintDefenderObModifier, setInspectorFeintDefenderObModifier] = useState("0");
  const [inspectorFeintDefenderDbModifier, setInspectorFeintDefenderDbModifier] = useState("0");
  const [inspectorFeintNote, setInspectorFeintNote] = useState("");
  const [inspectorAdjustDistanceResponse, setInspectorAdjustDistanceResponse] = useState<
    "allow" | "oppose"
  >("oppose");
  const [inspectorAdjustDistanceCommittedDistance, setInspectorAdjustDistanceCommittedDistance] =
    useState("2");
  const [inspectorAdjustDistanceOutcome, setInspectorAdjustDistanceOutcome] = useState<
    "successful" | "unsuccessful" | "allowed"
  >("unsuccessful");
  const [inspectorAdjustDistanceReviewNote, setInspectorAdjustDistanceReviewNote] = useState("");
  const [inspectorCurrentActionOutcomeSelection, setInspectorCurrentActionOutcomeSelection] =
    useState<InspectorCurrentActionOutcomeSelection>("perform");
  const [content, setContent] = useState<Awaited<ReturnType<typeof loadCanonicalContent>>>();
  const [resolvedCharacterStateByParticipantId, setResolvedCharacterStateByParticipantId] =
    useState<
      Record<
        string,
        {
          equipmentState: EquipmentFeatureState;
          serverRecord: ServerCharacterRecord;
        }
      >
    >({});
  const inspectorAdjustDistanceAdjustmentDraftRef =
    useRef<AdjustDistanceAdjustmentDraftHandle | null>(null);
  const timelineCellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [trackerPositionRequest, setTrackerPositionRequest] = useState(0);
  const encounterScopeRef = useRef(encounter.id);
  const manualSelectionRef = useRef<CombatRoundSelectionTarget | undefined>(undefined);
  const pendingSelectionRef = useRef<CombatRoundSelectionTarget | undefined>(undefined);
  const deterministicAdvanceAttemptRef = useRef<string | undefined>(undefined);
  const deterministicAdvanceBlockedRevisionRef = useRef<string | undefined>(undefined);
  const boundaryTransitionInFlightRef = useRef(false);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(initialRoundState.roundNumber);

  async function refreshCanonicalCombatAfterConflict(
    error: unknown,
    options: { suppressDeterministicAdvance?: boolean } = {},
  ): Promise<boolean> {
    const code = getCombatMutationConflictCode(error);
    if (!code) {
      return false;
    }

    const [refreshedEncounter, refreshedParticipants] = await Promise.all([
      loadEncounterById(roundView.encounterId),
      encounter.scenarioId ? loadScenarioParticipants(encounter.scenarioId) : Promise.resolve([]),
    ]);
    const next = getCombatRoundManagerStateFromCommandEnvelope({
      encounter: refreshedEncounter,
    });
    pendingSelectionRef.current = undefined;
    manualSelectionRef.current = undefined;
    const accepted = acceptCanonicalEncounterState(refreshedEncounter, next.state);

    if (accepted) {
      if (options.suppressDeterministicAdvance) {
        deterministicAdvanceBlockedRevisionRef.current = refreshedEncounter.updatedAt;
      }
      if (refreshedParticipants.length > 0) {
        setScenarioParticipantOverrides(
          Object.fromEntries(
            refreshedParticipants.map((participant) => [participant.id, participant]),
          ),
        );
        onScenarioParticipantsUpdated?.(refreshedParticipants);
      }
      setInspectionSelection(next.inspectionSelection);
      setSelectedRoundNumber(next.state.roundNumber);
      onEncounterUpdated?.(refreshedEncounter);
      focusRoundTable({ scrollToCurrent: true, state: next.state });
    }
    setSaveError(getCombatMutationRefreshMessage(code));
    return true;
  }

  const encounterScenarioParticipantIds = useMemo(
    () => getEncounterScenarioParticipantIds(encounter.participants),
    [encounter.participants],
  );
  const effectiveScenarioParticipants = useMemo(
    () =>
      scenarioParticipants.map(
        (participant) => scenarioParticipantOverrides[participant.id] ?? participant,
      ),
    [scenarioParticipantOverrides, scenarioParticipants],
  );
  const descriptorRevision = getCombatRoundDescriptorRevision({
    acceptedEncounter: {
      encounterId: encounter.id,
      encounterRevision: encounter.updatedAt,
    },
    currentView: roundView,
  });
  const trackerProjectionStartedAt = combatPerformanceNow();
  const activePresentationIdentity = `${roundView.encounterId}:${
    descriptorRevision ?? roundView.encounterRevision ?? encounter.updatedAt
  }`;
  let activePresentationRebuilt = false;
  const activePresentation = presentationLayerCacheRef.current.resolveActive(
    activePresentationIdentity,
    () => {
      activePresentationRebuilt = true;
      return buildActiveCombatPresentation({
        combatLogSourceRevision: roundView.encounterRevision ?? encounter.updatedAt,
        encounterId: roundView.encounterId,
        encounterRevision: descriptorRevision ?? roundView.encounterRevision ?? encounter.updatedAt,
        resolveStepStatus: getParticipantDeclarationStatus,
        roundState,
        scenarioParticipants: effectiveScenarioParticipants,
      });
    },
  );
  const presentationParticipantRows = activePresentation.displayParticipants.map((participant) => ({
    label: participant.label,
    participantId: participant.participantId,
  }));
  const archivedPresentationIdentity = buildArchivedCombatPresentationIdentity({
    participantRows: presentationParticipantRows,
    roundState,
  });
  let archivedPresentationRebuilt = false;
  const archivedPresentation = presentationLayerCacheRef.current.resolveArchived(
    archivedPresentationIdentity,
    () => {
      archivedPresentationRebuilt = true;
      return buildArchivedCombatPresentation({
        buildHistoricalActionResult: buildHistoricalCombatActionResult,
        identity: archivedPresentationIdentity,
        participantRows: presentationParticipantRows,
        resolveStepStatus: getParticipantDeclarationStatus,
        roundState,
      });
    },
  );
  const selectionOverlayIdentity = [
    activePresentation.identity,
    archivedPresentation.identity,
    selectedRoundNumber,
    inspectionSelection.participantId,
    inspectionSelection.step,
    manualSelectionRef.current?.participantId,
    manualSelectionRef.current?.step,
    pendingSelectionRef.current?.participantId,
    pendingSelectionRef.current?.step,
  ].join(":");
  const selectionOverlay = presentationLayerCacheRef.current.resolveSelection(
    selectionOverlayIdentity,
    () =>
      buildCombatSelectionOverlay({
        active: activePresentation,
        archived: archivedPresentation,
        localSelection: inspectionSelection,
        manualSelection: manualSelectionRef.current,
        pendingSelection: pendingSelectionRef.current,
        selectedRoundNumber,
      }),
  );
  const pendingOverlay = buildCombatPendingOverlay({
    error: saveError,
    saving,
    workflow: inspectorCurrentActionOutcomeSelection,
  });
  let trackerBaseRebuilt = false;
  const trackerBasePresentation = presentationLayerCacheRef.current.resolveTrackerBase(
    `${archivedPresentation.identity}:${activePresentation.identity}`,
    () => {
      trackerBaseRebuilt = true;
      return buildCombatTrackerBasePresentation({
        active: activePresentation,
        archived: archivedPresentation,
      });
    },
  );
  const trackerModel = presentationLayerCacheRef.current.resolveTracker(
    `${archivedPresentation.identity}:${activePresentation.identity}:${selectionOverlay.identity}`,
    () =>
      applyCombatTrackerSelectionOverlay({
        base: trackerBasePresentation,
        selection: selectionOverlay,
      }),
  );
  const combatPresentation = composeCombatPresentationModel({
    active: activePresentation,
    archived: archivedPresentation,
    pending: pendingOverlay,
    selection: selectionOverlay,
    tracker: trackerModel,
  });
  recordCombatPerformanceStage(
    "tracker_view_model",
    combatPerformanceNow() - trackerProjectionStartedAt,
    {
      activePresentationRebuilt,
      archivedPresentationRebuilt,
      archivedRoundCount: archivedPresentation.roundStates.length,
      trackerBaseRebuilt,
      trackerCellCount:
        archivedPresentation.trackerCellFacts.length + activePresentation.trackerCellFacts.length,
    },
  );
  const combatProgressionProjection = combatPresentation.active.progressionProjection;
  const combatProgressionPresentation = combatPresentation.active.progression;
  const timelineRoundStates = combatPresentation.timelineRoundStates;
  const selectedTimelineRoundState = combatPresentation.selection.selectedRoundState;
  const selectedRoundIsActive = combatPresentation.selection.selectedRoundIsActive;
  const displayParticipants = combatPresentation.active.displayParticipants;
  const projectedCurrentTasks = combatPresentation.active.projectedCurrentTasks;
  const currentActionPresentation = combatPresentation.active.currentAction;
  const liveInspectorContext = combatPresentation.active.liveInspectorContext;
  const currentTaskSelection = combatPresentation.active.currentTaskSelection;
  const renderedInspectionSelection = combatPresentation.selection.renderedInspectionSelection;
  const timelineRoundNumbers = combatPresentation.timelineRoundNumbers;
  const combatLogProjection = combatPresentation.active.combatLog;
  const [combatLogSelection, setCombatLogSelection] = useState(() =>
    createDefaultCombatLogSelection(combatLogProjection),
  );
  useEffect(() => {
    setCombatLogSelection((current) =>
      reconcileCombatLogSelection({ current, projection: combatLogProjection }),
    );
  }, [combatLogProjection]);
  const handleCombatLogSelection = useCallback(
    (selection: CombatLogEventSelection) => {
      setRecentResultFocus(undefined);
      setRecentResultRequest(undefined);
      setCombatLogSelection(
        selectCombatLogEvent({
          eventId: selection.combatLogEventId,
          projection: combatLogProjection,
        }),
      );
    },
    [combatLogProjection],
  );
  const combatDistanceRows = useMemo(
    () =>
      combatPresentation.active.inspectorPresentation.resolve({
        build: () =>
          measureCombatPerformanceStage("panel_distance_table_presentation", () =>
            buildCombatDistanceTableRows({
              encounter,
              resolvedEquipmentStateByScenarioParticipantId: Object.fromEntries(
                Object.entries(resolvedCharacterStateByParticipantId).map(
                  ([participantId, state]) => [participantId, state.equipmentState],
                ),
              ),
              roundState,
              scenarioParticipants: effectiveScenarioParticipants,
            }),
          ),
        dependencies: [
          effectiveScenarioParticipants,
          encounter,
          resolvedCharacterStateByParticipantId,
          roundState,
        ],
        key: "distance-table",
      }),
    [
      combatPresentation.active.inspectorPresentation,
      effectiveScenarioParticipants,
      encounter,
      resolvedCharacterStateByParticipantId,
      roundState,
    ],
  );
  const dirtyCombatDistanceRows = useMemo(
    () =>
      combatDistanceRows.filter((row) => {
        const draftValue = distanceDrafts[row.edge.pairKey];

        return draftValue !== undefined && draftValue !== String(row.edge.distance);
      }),
    [combatDistanceRows, distanceDrafts],
  );
  const projectedBoundaryTransitionTask = projectedCurrentTasks.find(
    (task) => task.kind === "gm_advance_boundary" && task.state === "executable" && task.transition,
  );
  const projectedBoundaryTransitionAction = buildCombatBoundaryTransitionAction({
    encounterId: roundView.encounterId,
    encounterRevision: descriptorRevision,
    task: projectedBoundaryTransitionTask,
  });
  const projectedDoubleAttackDecisionTask = projectedCurrentTasks.find(
    (task) => task.kind === "double_attack_decision" && task.state === "executable",
  );
  const projectedFeintTask = projectedCurrentTasks.find(
    (task) =>
      ["feint_attacker_roll", "feint_defender_roll", "feint_commit"].includes(task.kind) &&
      task.state === "executable",
  );
  const projectedAdjustDistanceTask = projectedCurrentTasks.find(
    (task) =>
      [
        "adjust_distance_response",
        "adjust_distance_adjustment",
        "adjust_distance_attacker_roll",
        "adjust_distance_defender_roll",
        "adjust_distance_commit",
      ].includes(task.kind) && task.state === "executable",
  );
  const currentTaskStep = currentTaskSelection?.step ?? roundState.currentStep;
  useEffect(() => {
    if (!currentTaskSelection || manualSelectionRef.current || pendingSelectionRef.current) {
      return;
    }
    setSelectedRoundNumber(roundState.roundNumber);
    setInspectionSelection(currentTaskSelection);
  }, [
    currentTaskSelection?.participantId,
    currentTaskSelection?.step,
    liveInspectorContext?.taskId,
    roundState.roundNumber,
  ]);
  const archivedInspectorPresentation = !selectedRoundIsActive
    ? measureCombatPerformanceStage(
        "panel_archived_inspector_presentation_lookup",
        () =>
          combatPresentation.archived.inspectorPresentation.get({
            participantId: renderedInspectionSelection.participantId,
            roundNumber: selectedRoundNumber,
            step: renderedInspectionSelection.step,
          }),
        { archivedInspectorReused: true },
      )
    : undefined;
  const activeInspectorCore = selectedRoundIsActive
    ? combatPresentation.active.inspectorPresentation.resolve({
        build: () =>
          buildActiveInspectorCorePresentation({
            boundary: combatProgressionPresentation.boundary.kind,
            combatLog: combatLogProjection,
            encounterId: encounter.id,
            encounterRevision: descriptorRevision ?? combatLogProjection.sourceRevision,
            gmEvents: combatPresentation.active.gmEvents,
            resultEvents: combatPresentation.active.resultEvents,
            participantId: renderedInspectionSelection.participantId,
            roundState,
            step: renderedInspectionSelection.step,
          }),
        dependencies: [
          combatProgressionPresentation.boundary.kind,
          combatLogProjection,
          combatPresentation.active.gmEvents,
          combatPresentation.active.resultEvents,
          renderedInspectionSelection.participantId,
          renderedInspectionSelection.step,
          roundState,
        ],
        key: `core:${renderedInspectionSelection.participantId ?? "none"}:${renderedInspectionSelection.step}`,
      })
    : undefined;
  const inspector =
    activeInspectorCore?.inspector ??
    archivedInspectorPresentation?.inspector ??
    measureCombatPerformanceStage("panel_build_combat_round_inspector", () =>
      buildCombatRoundInspector({
        participantId: renderedInspectionSelection.participantId,
        state: selectedTimelineRoundState,
        step: renderedInspectionSelection.step,
      }),
    );
  const gmCurrentStepResultPresentation = useMemo(
    () =>
      !selectedRoundIsActive
        ? undefined
        : (activeInspectorCore?.currentStepResults ??
          measureCombatPerformanceStage("panel_current_event_result_selection", () =>
            inspector.participant
              ? buildCombatStepResultPresentation({
                  boundary: combatProgressionPresentation.boundary.kind,
                  combatLog: combatLogProjection,
                  encounterId: encounter.id,
                  encounterRevision: descriptorRevision ?? combatLogProjection.sourceRevision,
                  events: projectGmCombatEvents({
                    events: roundState.events,
                    participants: roundState.participants,
                  }),
                  participantId: inspector.participant.participantId,
                  roundNumber: roundState.roundNumber,
                  step: inspector.step,
                  viewer: { kind: "gm" },
                })
              : undefined,
          )),
    [
      activeInspectorCore,
      combatLogProjection,
      combatProgressionPresentation.boundary.kind,
      descriptorRevision,
      encounter.id,
      inspector.participant,
      roundState.events,
      roundState.participants,
      roundState.roundNumber,
      selectedRoundIsActive,
    ],
  );
  const projectedDeterministicTask = combatProgressionProjection.boundary.processes
    .flatMap((process) => process.stages)
    .flatMap((stage) => stage.executionGroups)
    .flatMap((group) => group.tasks)
    .find(
      (task) =>
        task.state === "executable" &&
        task.participation?.status === "required" &&
        task.participation.workClass === "deterministic_transition" &&
        task.participation.completeness === "complete",
    );
  const recentResultSource = recentResultRequest?.candidate.source ?? recentResultFocus?.source;
  const recentResultSourcePresentation =
    recentResultSource && recentResultSource.roundNumber === roundState.roundNumber
      ? combatPresentation.active.inspectorPresentation.resolve({
          build: () =>
            buildActiveInspectorCorePresentation({
              boundary: combatProgressionPresentation.boundary.kind,
              combatLog: combatLogProjection,
              encounterId: encounter.id,
              encounterRevision: roundView.encounterRevision ?? combatLogProjection.sourceRevision,
              gmEvents: combatPresentation.active.gmEvents,
              resultEvents: combatPresentation.active.resultEvents,
              participantId: recentResultSource.participantId,
              roundState,
              step: recentResultSource.step,
            }).currentStepResults,
          dependencies: [
            combatProgressionPresentation.boundary.kind,
            combatLogProjection,
            combatPresentation.active.gmEvents,
            combatPresentation.active.resultEvents,
            recentResultSource.participantId,
            recentResultSource.step,
            roundState,
          ],
          key: `recent-result:${recentResultSource.participantId}:${recentResultSource.step}`,
        })
      : recentResultSource
        ? combatPresentation.archived.inspectorPresentation.get({
            participantId: recentResultSource.participantId,
            roundNumber: recentResultSource.roundNumber,
            step: recentResultSource.step,
          })?.currentStepResults
        : undefined;
  useEffect(() => {
    if (!recentResultRequest) return;
    if (recentResultRequest.acceptedRevision !== roundView.encounterRevision) return;

    const focus = resolveCombatRecentResultFocus({
      acceptedPresentation: recentResultSourcePresentation,
      acceptedRevision: recentResultRequest.acceptedRevision,
      candidate: recentResultRequest.candidate,
    });
    setRecentResultRequest(undefined);
    if (focus) setRecentResultFocus(focus);
  }, [recentResultRequest, recentResultSourcePresentation, roundView.encounterRevision]);
  const recentResultPresentation = recentResultFocus
    ? selectCombatRecentResultPresentation({
        focus: recentResultFocus,
        presentation: recentResultSourcePresentation,
      })
    : undefined;
  useEffect(() => {
    if (!recentResultFocus) return;
    if (
      !recentResultPresentation &&
      (recentResultFocus.source.roundNumber !== roundState.roundNumber ||
        roundView.encounterRevision !== recentResultFocus.acceptedRevision)
    ) {
      setRecentResultFocus(undefined);
    }
  }, [recentResultPresentation, recentResultFocus, roundState, roundView.encounterRevision]);
  const inspectorSelectionIsCurrentProgression =
    combatProgressionPresentation.taskVisibility === "available" &&
    (isCombatRoundInspectionSelectionLive({
      context: liveInspectorContext,
      selectedRoundIsActive,
      selection: {
        participantId: inspector.participant?.participantId,
        step: inspector.step,
      },
    }) ||
      (selectedRoundIsActive &&
        combatProgressionPresentation.boundary.kind === "declaration" &&
        inspector.step === "select_actions"));
  const clearCurrentStepAvailable =
    canClearCombatRoundStep({
      state: roundState,
      step: currentTaskStep,
    }) && selectedRoundIsActive;
  const selectedEncounterParticipant = encounter.participants.find(
    (participant) => participant.id === inspector.participant?.participantId,
  );
  const selectedScenarioParticipant = selectedEncounterParticipant
    ? findScenarioParticipantForEncounterParticipant({
        encounterParticipant: selectedEncounterParticipant,
        scenarioParticipants: effectiveScenarioParticipants,
      })
    : undefined;
  const inspectorCombatExperienceTrigger =
    selectedRoundIsActive && inspector.participant?.participantId
      ? getCombatRoundRequiredCombatExperienceTrigger({
          participantId: inspector.participant.participantId,
          state: roundState,
          visibility: encounter.roleplayState?.visibility,
        })
      : undefined;
  const inspectorCombatExperienceRequired = Boolean(inspectorCombatExperienceTrigger);
  const inspectorCombatExperienceIsCombatStart =
    inspectorCombatExperienceTrigger === "combat_start";
  const inspectorCombatExperienceResult = inspector.participant?.combatExperience;
  const inspectorCombatExperienceWindowOpen =
    inspectorCombatExperienceTrigger === "combat_start"
      ? isCombatRoundCombatExperienceWindowOpen(roundState)
      : inspectorCombatExperienceRequired;
  const combatExperienceRollRecorded = hasCombatRoundCombatExperienceRoll(roundState);
  const activeCombatExperienceDifficulty = getCombatRoundCombatExperienceDifficulty(roundState);
  const inspectorCombatExperienceDifficultyKey = `${roundState.roundNumber}:combat-experience`;
  const inspectorCombatExperienceDifficulty =
    inspectorCombatExperienceDifficultyKey &&
    combatExperienceDifficultyDrafts[inspectorCombatExperienceDifficultyKey] !== undefined
      ? combatExperienceDifficultyDrafts[inspectorCombatExperienceDifficultyKey]
      : String(activeCombatExperienceDifficulty);
  const inspectorRoundEndReview =
    inspector.step === "round_summary" && inspector.participant?.participantId
      ? selectedTimelineRoundState.roundEndReview?.participantReviews[
          inspector.participant.participantId
        ]
      : undefined;
  const inspectorSuPendingRows: CombatSituationDisplayRow[] =
    !selectedRoundIsActive || !inspectorSelectionIsCurrentProgression
      ? []
      : [
          ...(inspectorRoundEndReview?.canonicalReview?.proposals ?? []).map((proposal) => {
            const durationProposal = inspectorRoundEndReview?.proposedEffects.find(
              (candidate) => candidate.id === proposal.id,
            );
            const expiryProposal = inspectorRoundEndReview?.proposedRemovals.find(
              (candidate) => candidate.id === proposal.id,
            );
            return {
              durationLabel:
                proposal.transitionType === "expire"
                  ? "Expires after this review"
                  : durationProposal?.nextDuration,
              id: proposal.id,
              label:
                durationProposal?.label.replace(/^Reduce duration:\s*/, "") ??
                expiryProposal?.label.replace(/^Expire\s*/, "") ??
                "Effect duration",
            };
          }),
          ...(inspectorRoundEndReview?.canonicalReview?.requirements ?? [])
            .filter((requirement) => !requirement.resolved)
            .map((requirement) => ({
              durationLabel: requirement.blocksReview ? "Required" : "Pending rule",
              id: requirement.id,
              label: requirement.label,
            })),
        ];
  const projectedRoundEndTasks = combatProgressionProjection.boundary.processes
    .flatMap((process) => process.stages)
    .flatMap((stage) => stage.executionGroups)
    .flatMap((group) => group.tasks)
    .filter((task) => task.state === "executable" && task.trackerFacet.step === "SU");
  const inspectorRoundEndTask =
    selectedRoundIsActive && inspector.step === "round_summary"
      ? projectedRoundEndTasks.find(
          (task) => task.id === combatPresentation.active.currentAction?.taskId,
        )
      : undefined;
  const roundParticipantLabelsById = useMemo(
    () =>
      Object.fromEntries(
        roundState.participants.map((participant) => [
          participant.participantId,
          participant.label,
        ]),
      ),
    [roundState.participants],
  );
  const stepWorkflowStatusPresentation = stepWorkflowStatus
    ? buildCombatStepWorkflowStatusPresentation({
        participantLabelsById: new Map(Object.entries(roundParticipantLabelsById)),
        result: stepWorkflowStatus,
      })
    : undefined;
  const currentDeclarationParticipantId = inspector.participant?.participantId;
  const currentDeclarationProposalRevision = roundView.encounterRevision ?? encounter.updatedAt;
  const currentDeclarationProposal =
    currentActionPresentation?.taskKind === "submit_declaration" &&
    currentDeclarationParticipantId &&
    !selectedScenarioParticipant?.controlledByUserId &&
    selectedRoundIsActive
      ? stepWorkflowDeclarationProposal?.participantId === currentDeclarationParticipantId &&
        stepWorkflowDeclarationProposal.roundNumber === roundState.roundNumber &&
        stepWorkflowDeclarationProposal.proposalRevision === currentDeclarationProposalRevision
        ? stepWorkflowDeclarationProposal
        : projectCombatNpcDeclarationProposal({
            encounterId: encounter.id,
            encounterRevision: currentDeclarationProposalRevision,
            participantId: currentDeclarationParticipantId,
            proposalSequence: getCombatRoundNextEventSequence(roundState),
            state: roundState,
          })
      : undefined;
  const currentDeclarationProposalPresentation = currentDeclarationProposal
    ? buildCombatNpcDeclarationProposalPresentation({
        participantLabelsById: new Map(Object.entries(roundParticipantLabelsById)),
        proposal: currentDeclarationProposal,
      })
    : undefined;
  const activeRoundEndDistanceProposals =
    selectedRoundIsActive && inspector.step === "round_summary"
      ? (roundState.roundEndReview?.proposedDistances ?? []).filter((proposal) => proposal.accepted)
      : [];
  const inspectorRoundEndDistanceRollOptions = getRoundEndDistancePendingRollOptions({
    participantLabelsById: roundParticipantLabelsById,
    proposals: activeRoundEndDistanceProposals,
  });
  const inspectorSelectedParticipantDistanceRollOption = inspectorRoundEndDistanceRollOptions.find(
    (option) => option.participantId === inspector.participant?.participantId,
  );
  const inspectorRoundEndTaskDistanceRollKey =
    inspectorRoundEndTask?.kind === "distance_roll"
      ? buildRoundEndDistanceRollOptionKey({
          participantId:
            inspectorRoundEndTask.owner?.kind === "combatant"
              ? inspectorRoundEndTask.owner.participantId
              : "",
          proposalId: inspectorRoundEndTask.identity.proposalId ?? "",
        })
      : undefined;
  const resolvedRoundEndDistanceRollSelectionKey =
    inspectorRoundEndTaskDistanceRollKey ??
    (inspectorRoundEndDistanceRollOptions.some(
      (option) => option.key === roundEndDistanceRollSelectionKey,
    )
      ? roundEndDistanceRollSelectionKey
      : (inspectorSelectedParticipantDistanceRollOption?.key ??
        inspectorRoundEndDistanceRollOptions[0]?.key));
  const inspectorRoundEndDistanceRollOption = inspectorRoundEndDistanceRollOptions.find(
    (option) => option.key === resolvedRoundEndDistanceRollSelectionKey,
  );
  const inspectorRoundEndDistanceCommitOptions = activeRoundEndDistanceProposals.filter(
    isRoundEndDistanceCommitReady,
  );
  const inspectorRoundEndTaskDistanceCommitProposalId =
    inspectorRoundEndTask?.kind === "distance_commit"
      ? inspectorRoundEndTask.identity.proposalId
      : undefined;
  const resolvedRoundEndDistanceCommitProposalId = inspectorRoundEndDistanceCommitOptions.some(
    (proposal) => proposal.id === inspectorRoundEndTaskDistanceCommitProposalId,
  )
    ? inspectorRoundEndTaskDistanceCommitProposalId
    : inspectorRoundEndDistanceCommitOptions.some(
          (proposal) => proposal.id === roundEndDistanceCommitProposalId,
        )
      ? roundEndDistanceCommitProposalId
      : inspectorRoundEndDistanceCommitOptions[0]?.id;
  const inspectorRoundEndDistanceCommitProposal = inspectorRoundEndDistanceCommitOptions.find(
    (proposal) => proposal.id === resolvedRoundEndDistanceCommitProposalId,
  );
  const inspectorRoundEndDistanceAction =
    inspectorRoundEndTask?.kind === "distance_roll" && inspectorRoundEndDistanceRollOption
      ? ({
          kind: "roll" as const,
          option: inspectorRoundEndDistanceRollOption,
        } satisfies { kind: "roll"; option: RoundEndDistanceRollOption })
      : inspectorRoundEndTask?.kind === "distance_commit" && inspectorRoundEndDistanceCommitProposal
        ? ({
            kind: "commit" as const,
            proposal: inspectorRoundEndDistanceCommitProposal,
          } satisfies { kind: "commit"; proposal: CombatRoundEndDistanceProposal })
        : undefined;
  const inspectorRoundEndDistanceControlComplete = Boolean(
    selectedTimelineRoundState.roundEndReview &&
    !selectedTimelineRoundState.roundEndReview.proposedDistances.some(
      (proposal) =>
        proposal.accepted && getCombatRoundEndDistanceProposalLifecycle(proposal) !== "applied",
    ),
  );
  useEffect(() => {
    if (
      saving ||
      !selectedRoundIsActive ||
      !projectedDeterministicTask ||
      !descriptorRevision ||
      deterministicAdvanceBlockedRevisionRef.current === descriptorRevision
    ) {
      return;
    }
    const attemptKey = `${encounter.id}:${projectedDeterministicTask.id}:${descriptorRevision}`;
    if (deterministicAdvanceAttemptRef.current === attemptKey) return;

    deterministicAdvanceAttemptRef.current = attemptKey;
    setSaving(true);
    void advanceDeterministicCombatOnServer({
      currentEncounter: encounter,
      encounterId: encounter.id,
      executionGroupId: projectedDeterministicTask.executionGroupId,
      expectedRevision: descriptorRevision,
      taskId: projectedDeterministicTask.id,
    })
      .then(({ encounter: nextEncounter, participants, stopReason }) => {
        const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
        if (participants.length > 0) {
          setScenarioParticipantOverrides(
            Object.fromEntries(participants.map((participant) => [participant.id, participant])),
          );
          onScenarioParticipantsUpdated?.(participants);
        }
        acceptCanonicalEncounterState(nextEncounter, nextRoundState);
        if (!manualSelectionRef.current && !pendingSelectionRef.current) {
          setInspectionSelection(resolveCombatRoundInspectionSelection({ state: nextRoundState }));
          setSelectedRoundNumber(nextRoundState.roundNumber);
        }
        onEncounterUpdated?.(nextEncounter);
        setSaveError(
          stopReason === "safety_limit"
            ? "Deterministic combat advancement reached its safety limit."
            : undefined,
        );
      })
      .catch((caughtError: unknown) => {
        setSaveError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to advance deterministic combat work.",
        );
      })
      .finally(() => setSaving(false));
  }, [
    acceptCanonicalEncounterState,
    descriptorRevision,
    encounter,
    onEncounterUpdated,
    onScenarioParticipantsUpdated,
    projectedDeterministicTask?.executionGroupId,
    projectedDeterministicTask?.id,
    saving,
    selectedRoundIsActive,
  ]);
  const selectedRoundDeclaration = hasCombatRoundDeclarationAction(
    inspector.participant?.declaration,
  )
    ? inspector.participant?.declaration
    : undefined;
  const inspectorDraftKey = buildInspectorDraftKey({
    declaration: selectedRoundDeclaration,
    participantId: selectedScenarioParticipant?.id,
  });
  const inspectorHasLocalDraft = Boolean(inspectorDraftKey && inspectorDrafts[inspectorDraftKey]);
  const inspectorHasLocalModifierEdits = Boolean(
    inspectorDraftKey && inspectorModifierEditedDraftKeys[inspectorDraftKey],
  );
  const inspectorDraft =
    inspectorHasLocalDraft && inspectorDraftKey
      ? inspectorDrafts[inspectorDraftKey]
      : selectedRoundIsActive
        ? combatPresentation.active.inspectorPresentation.resolve({
            build: () =>
              buildDeclarationDraft(selectedScenarioParticipant, selectedRoundDeclaration, {
                encounterId: encounter.id,
                roundNumber: selectedRoundNumber,
              }),
            dependencies: [
              selectedScenarioParticipant,
              selectedRoundDeclaration,
              encounter.id,
              selectedRoundNumber,
            ],
            key: `declaration-draft:${inspector.participant?.participantId ?? "none"}`,
          })
        : buildDeclarationDraft(selectedScenarioParticipant, selectedRoundDeclaration, {
            encounterId: encounter.id,
            roundNumber: selectedRoundNumber,
          });
  const historicalSnapshotResolutionStartedAt = combatPerformanceNow();
  const inspectorSnapshot =
    archivedInspectorPresentation?.snapshot ??
    getCombatRoundStepSnapshot({
      participantId: inspector.participant?.participantId,
      roundNumber: selectedRoundNumber,
      state: selectedTimelineRoundState,
      step: inspector.step,
    });
  const inspectorHistoricalStepOutcome =
    archivedInspectorPresentation?.stepOutcome ?? deriveCombatHistoryStepOutcome(inspectorSnapshot);
  const inspectorIsHistorical = !selectedRoundIsActive || !inspectorSelectionIsCurrentProgression;
  const resolveInspectorContextSnapshot = (
    isValid?: (snapshot: CombatRoundStepSnapshot) => boolean,
  ) =>
    resolveCombatHistoryPanelSnapshot({
      getParticipantId: (snapshot) => snapshot.participantId,
      isValid,
      participantId: inspector.participant?.participantId ?? "",
      roundNumber: selectedRoundNumber,
      selectedStep: inspector.step,
      snapshots: selectedTimelineRoundState.stepSnapshots,
    });
  const inspectorContextBaseSnapshot =
    archivedInspectorPresentation?.panelSnapshot ??
    (inspectorIsHistorical ? resolveInspectorContextSnapshot() : undefined);
  const inspectorPanelSnapshot = archivedInspectorPresentation?.panelSnapshot
    ? archivedInspectorPresentation.panelSnapshot
    : inspectorContextBaseSnapshot
      ? {
          ...inspectorContextBaseSnapshot,
          ...inspectorSnapshot,
          declarationSummary: resolveInspectorContextSnapshot((snapshot) =>
            Boolean(snapshot.declarationSummary),
          )?.declarationSummary,
          modifierSummary: resolveInspectorContextSnapshot((snapshot) =>
            Boolean(snapshot.modifierSummary),
          )?.modifierSummary,
          phasePanels: {
            phase1: resolveInspectorContextSnapshot((snapshot) =>
              Boolean(snapshot.phasePanels?.phase1),
            )?.phasePanels?.phase1,
            phase2: resolveInspectorContextSnapshot((snapshot) =>
              Boolean(snapshot.phasePanels?.phase2),
            )?.phasePanels?.phase2,
          },
          step: inspector.step,
        }
      : undefined;
  const inspectorSourceMode: CombatInspectorSourceMode = inspectorIsHistorical
    ? "history"
    : "current";
  const inspectorSourceLabel = getCombatInspectorSourceLabel(inspectorSourceMode);
  const inspectorDisplayDraft = buildInspectorDisplayDraft({
    draft: inspectorDraft,
    snapshot: inspectorPanelSnapshot,
  });
  recordCombatPerformanceStage(
    "panel_historical_snapshot_resolution",
    combatPerformanceNow() - historicalSnapshotResolutionStartedAt,
    {
      historical: inspectorIsHistorical,
      snapshotFound: Boolean(inspectorPanelSnapshot),
    },
  );
  const inspectorHistoricalDeclarationSummary = inspectorPanelSnapshot?.declarationSummary;
  const inspectorHistoricalSelectorFactsComplete = Boolean(inspectorHistoricalDeclarationSummary);
  const inspectorHistoricalActionOptions =
    inspectorHistoricalSelectorFactsComplete && inspectorHistoricalDeclarationSummary
      ? [
          inspectorHistoricalDeclarationSummary.actionId &&
          inspectorHistoricalDeclarationSummary.actionLabel
            ? {
                label: inspectorHistoricalDeclarationSummary.actionLabel,
                value: inspectorHistoricalDeclarationSummary.actionId as PlayerEncounterActionId,
              }
            : undefined,
          inspectorHistoricalDeclarationSummary.secondaryActionId &&
          inspectorHistoricalDeclarationSummary.secondaryActionLabel &&
          inspectorHistoricalDeclarationSummary.secondaryActionId !==
            inspectorHistoricalDeclarationSummary.actionId
            ? {
                label: inspectorHistoricalDeclarationSummary.secondaryActionLabel,
                value:
                  inspectorHistoricalDeclarationSummary.secondaryActionId as PlayerEncounterActionId,
              }
            : undefined,
        ].filter((option): option is { label: string; value: PlayerEncounterActionId } =>
          Boolean(option),
        )
      : undefined;
  const inspectorModifierPhase = getPlayerCombatModifierDisplayPhase({
    actionId: inspectorDisplayDraft.actionId,
    step: inspector.step,
  });
  const inspectorEquipmentState = useMemo(() => {
    const build = () =>
      measureCombatPerformanceStage("panel_equipment_loadout_presentation", () =>
        resolveScenarioCombatEquipmentState({
          resolvedEquipmentState:
            resolvedCharacterStateByParticipantId[selectedScenarioParticipant?.id ?? ""]
              ?.equipmentState,
          scenarioEquipmentState: selectedScenarioParticipant?.snapshot.equipmentState,
        }),
      );
    return selectedRoundIsActive
      ? combatPresentation.active.inspectorPresentation.resolve({
          build,
          dependencies: [
            resolvedCharacterStateByParticipantId,
            selectedScenarioParticipant?.id,
            selectedScenarioParticipant?.snapshot.equipmentState,
          ],
          key: `equipment-state:${inspector.participant?.participantId ?? "none"}`,
        })
      : build();
  }, [
    combatPresentation.active.inspectorPresentation,
    inspector.participant?.participantId,
    resolvedCharacterStateByParticipantId,
    selectedRoundIsActive,
    selectedScenarioParticipant?.id,
    selectedScenarioParticipant?.snapshot.equipmentState,
  ]);
  const inspectorEquipmentCharacterId = useMemo(
    () =>
      resolveCombatEquipmentCharacterId({
        characterId: selectedScenarioParticipant?.characterId,
        state: inspectorEquipmentState,
      }) ?? "",
    [inspectorEquipmentState, selectedScenarioParticipant?.characterId],
  );
  const inspectorEquipmentStatus = useMemo(
    () =>
      getScenarioCombatEquipmentStatus({
        characterId: selectedScenarioParticipant?.characterId,
        resolvedEquipmentState:
          resolvedCharacterStateByParticipantId[selectedScenarioParticipant?.id ?? ""]
            ?.equipmentState,
        scenarioEquipmentState: selectedScenarioParticipant?.snapshot.equipmentState,
      }),
    [resolvedCharacterStateByParticipantId, selectedScenarioParticipant],
  );
  const inspectorEquipmentDiagnostic = formatScenarioCombatEquipmentDiagnostic({
    isGameMaster: true,
    participantName: selectedScenarioParticipant?.snapshot.displayName,
    status: inspectorEquipmentStatus,
  });
  const inspectorDodgeSkillValue = useMemo(() => {
    if (!content) return undefined;
    const build = characterBuildSchema.safeParse(selectedScenarioParticipant?.snapshot.build);
    if (!build.success) return undefined;
    return buildCharacterSheetSummary({ build: build.data, content }).draftView.skills.find(
      (skill) => skill.skillId === "dodge",
    )?.effectiveSkillNumber;
  }, [content, selectedScenarioParticipant?.snapshot.build]);
  const inspectorGeneratedCombatContext = useMemo(() => {
    const build = () =>
      measureCombatPerformanceStage("panel_active_modifier_presentation", () => {
        if (inspectorHasLocalModifierEdits) {
          return inspectorDraft.combatContext;
        }

        return projectCombatActionGeneratedModifiers({
          actionId: inspectorDraft.actionId || undefined,
          combatContext: inspectorDraft.combatContext,
          dodgeSkillValue: inspectorDodgeSkillValue,
          encounterParticipant: selectedEncounterParticipant,
          movementIntent: inspectorDraft.movementIntent,
          phaseContexts: inspectorDraft.phaseContexts,
          resolvedEquipmentState: inspectorEquipmentState ?? undefined,
          roundState: selectedTimelineRoundState,
          scenarioParticipant: selectedScenarioParticipant,
          secondaryActionId: inspectorDraft.secondaryActionId || undefined,
        });
      });
    return selectedRoundIsActive
      ? combatPresentation.active.inspectorPresentation.resolve({
          build,
          dependencies: [
            inspectorDraft.actionId,
            inspectorDraft.combatContext,
            inspectorDraft.movementIntent,
            inspectorDraft.phaseContexts,
            inspectorDraft.secondaryActionId,
            inspectorEquipmentState,
            inspectorHasLocalModifierEdits,
            inspectorDodgeSkillValue,
            selectedEncounterParticipant,
            selectedScenarioParticipant,
            selectedTimelineRoundState,
          ],
          key: `generated-modifier-context:${inspector.participant?.participantId ?? "none"}`,
        })
      : build();
  }, [
    combatPresentation.active.inspectorPresentation,
    inspector.participant?.participantId,
    inspectorDraft.actionId,
    inspectorDraft.combatContext,
    inspectorDraft.movementIntent,
    inspectorDraft.phaseContexts,
    inspectorDraft.secondaryActionId,
    inspectorEquipmentState,
    inspectorHasLocalModifierEdits,
    inspectorDodgeSkillValue,
    selectedEncounterParticipant,
    selectedRoundIsActive,
    selectedScenarioParticipant,
    selectedTimelineRoundState,
  ]);
  const modifierReviewDescriptor = currentActionPresentation?.primaryAction.descriptor;
  const selectedParticipantOwnsModifierReview = Boolean(
    modifierReviewDescriptor?.participantId &&
    selectedEncounterParticipant &&
    getCombatDistanceParticipantAliases(selectedEncounterParticipant).includes(
      modifierReviewDescriptor.participantId,
    ),
  );
  const modifierReviewInputSnapshot = getOrCreateCombatModifierReviewInputSnapshot({
    combatContext: inspectorGeneratedCombatContext,
    descriptor: selectedParticipantOwnsModifierReview ? modifierReviewDescriptor : undefined,
    expectedParticipantRevision: selectedScenarioParticipant?.updatedAt,
    participantId: selectedParticipantOwnsModifierReview
      ? selectedScenarioParticipant?.id
      : undefined,
    snapshots: modifierReviewInputSnapshotsRef.current,
  });
  const inspectorLiveModifiers = useMemo(() => {
    const currentInitiativeGroupId =
      combatProgressionProjection.executionOrder?.currentInitiativeGroupId;
    const build = () =>
      measureCombatPerformanceStage("panel_active_modifier_presentation", () =>
        buildTargetAwareEncounterLiveCombatModifierSummary({
          combatContext: sanitizePlayerCombatModifierContext(inspectorGeneratedCombatContext),
          combatEffects: selectedScenarioParticipant?.state.combatEffects,
          context: resolveEncounterLiveCombatModifierContext({
            actionId: inspectorDraft.actionId || undefined,
            encounterId: encounter.id,
            ownerCombatantId: inspector.participant?.participantId,
            ownerParticipantId: selectedScenarioParticipant?.id,
            participants: encounter.participants,
            phaseKey: inspectorModifierPhase,
            provisional: inspectorHasLocalModifierEdits,
            relationships: selectedTimelineRoundState.observationRelationships,
            roundNumber: selectedRoundNumber,
            step: inspector.step,
            targetParticipantId: inspectorModifierPhase
              ? (inspectorDraft.secondaryActionContext?.targetParticipantId ??
                inspectorDraft.phaseContexts[inspectorModifierPhase].targetParticipantId)
              : undefined,
          }),
          currentInitiativeGroupId,
        }),
      );
    return selectedRoundIsActive
      ? combatPresentation.active.inspectorPresentation.resolve({
          build,
          dependencies: [
            currentInitiativeGroupId,
            inspectorGeneratedCombatContext,
            inspectorDraft.actionId,
            inspectorDraft.phaseContexts,
            inspectorDraft.secondaryActionContext,
            inspectorHasLocalModifierEdits,
            inspectorModifierPhase,
            inspector.participant?.participantId,
            inspector.step,
            encounter.id,
            encounter.participants,
            selectedScenarioParticipant?.id,
            selectedScenarioParticipant?.state.combatEffects,
            selectedRoundNumber,
            selectedTimelineRoundState.observationRelationships,
          ],
          key: `live-modifiers:${inspector.participant?.participantId ?? "none"}:${inspectorModifierPhase ?? "none"}`,
        })
      : build();
  }, [
    combatPresentation.active.inspectorPresentation,
    combatProgressionProjection.executionOrder?.currentInitiativeGroupId,
    inspector.participant?.participantId,
    inspectorGeneratedCombatContext,
    inspectorDraft.actionId,
    inspectorDraft.phaseContexts,
    inspectorDraft.secondaryActionContext,
    inspectorHasLocalModifierEdits,
    inspectorModifierPhase,
    inspector.step,
    selectedRoundIsActive,
    encounter.id,
    encounter.participants,
    selectedScenarioParticipant?.id,
    selectedScenarioParticipant?.state.combatEffects,
    selectedRoundNumber,
    selectedTimelineRoundState.observationRelationships,
  ]);
  const inspectorModifierRows = useMemo(() => {
    const currentInitiativeGroupId =
      combatProgressionProjection.executionOrder?.currentInitiativeGroupId;
    const build = () =>
      measureCombatPerformanceStage("panel_active_modifier_presentation", () =>
        buildPlayerCombatModifierRows({
          combatContext: inspectorGeneratedCombatContext,
          combatEffects: selectedScenarioParticipant?.state.combatEffects,
          currentInitiativeGroupId,
          currentRound: selectedRoundNumber,
          encounterId: encounter.id,
          liveModifiers: inspectorLiveModifiers,
          ownerParticipantId: selectedScenarioParticipant?.id,
          phaseKey: inspectorModifierPhase,
          visibleAtStep: inspector.step,
        }),
      );
    return selectedRoundIsActive
      ? combatPresentation.active.inspectorPresentation.resolve({
          build,
          dependencies: [
            inspectorGeneratedCombatContext,
            currentInitiativeGroupId,
            inspectorLiveModifiers,
            inspectorModifierPhase,
            inspector.step,
            inspectorDraft.actionId,
            selectedScenarioParticipant?.state.combatEffects,
            selectedRoundNumber,
            encounter.id,
            selectedScenarioParticipant?.id,
          ],
          key: `modifier-rows:${inspector.participant?.participantId ?? "none"}:${inspector.step}`,
        })
      : build();
  }, [
    combatPresentation.active.inspectorPresentation,
    inspectorGeneratedCombatContext,
    combatProgressionProjection.executionOrder?.currentInitiativeGroupId,
    inspectorLiveModifiers,
    inspectorModifierPhase,
    inspector.participant?.participantId,
    inspector.step,
    inspectorDraft.actionId,
    selectedRoundIsActive,
    selectedRoundNumber,
    encounter.id,
    selectedScenarioParticipant?.id,
    selectedScenarioParticipant?.state.combatEffects,
  ]);
  const inspectorPendingModifierEntries = useMemo(() => {
    const currentInitiativeGroupId =
      combatProgressionProjection.executionOrder?.currentInitiativeGroupId;
    const build = () =>
      measureCombatPerformanceStage(
        "panel_active_modifier_presentation",
        () =>
          buildLiveCombatModifierContributionProjection({
            combatContext: inspectorGeneratedCombatContext,
            combatEffects: selectedScenarioParticipant?.state.combatEffects,
            currentInitiativeGroupId,
            currentRound: selectedRoundNumber,
            encounterId: encounter.id,
            ownerParticipantId: selectedScenarioParticipant?.id,
          }).pendingModifierEntries,
      );
    return selectedRoundIsActive
      ? combatPresentation.active.inspectorPresentation.resolve({
          build,
          dependencies: [
            currentInitiativeGroupId,
            encounter.id,
            inspectorGeneratedCombatContext,
            selectedRoundNumber,
            selectedScenarioParticipant?.id,
            selectedScenarioParticipant?.state.combatEffects,
          ],
          key: `pending-modifiers:${inspector.participant?.participantId ?? "none"}`,
        })
      : build();
  }, [
    combatPresentation.active.inspectorPresentation,
    combatProgressionProjection.executionOrder?.currentInitiativeGroupId,
    encounter.id,
    inspector.participant?.participantId,
    inspectorGeneratedCombatContext,
    selectedRoundIsActive,
    selectedRoundNumber,
    selectedScenarioParticipant?.id,
    selectedScenarioParticipant?.state.combatEffects,
  ]);
  const historicalModifierPresentationStartedAt = combatPerformanceNow();
  const inspectorDisplayModifierRows: readonly PlayerCombatModifierBucketView[] =
    inspectorIsHistorical
      ? (archivedInspectorPresentation?.modifierRows ??
        inspectorPanelSnapshot?.modifierSummary?.rows ??
        [])
      : inspectorModifierRows;
  const inspectorModifierLifecycleEffects = inspectorIsHistorical
    ? (inspectorPanelSnapshot?.modifierSummary?.effects ?? [])
    : collectCanonicalCombatSituationEffects({
        combatEffects: selectedScenarioParticipant?.state.combatEffects?.effects,
        continuedContacts: selectedTimelineRoundState.continuedContacts,
        ownerParticipantIds: [
          selectedScenarioParticipant?.id,
          inspector.participant?.participantId,
        ].filter((id): id is string => Boolean(id)),
        unbalancedConditions: selectedTimelineRoundState.unbalancedConditions,
      });
  const inspectorHistoricalModifierPhase = inspectorPanelSnapshot?.phase;
  const inspectorHistoricalModifierPhasePanel = inspectorHistoricalModifierPhase
    ? inspectorPanelSnapshot?.phasePanels?.[inspectorHistoricalModifierPhase]
    : undefined;
  const inspectorModifierOpponentId = inspectorIsHistorical
    ? (inspectorHistoricalModifierPhasePanel?.phaseContext.targetParticipantId ??
      inspectorHistoricalModifierPhasePanel?.phaseContext.selectedOpponentId ??
      inspectorPanelSnapshot?.declarationSummary?.secondaryActionContext?.targetParticipantId)
    : inspectorLiveModifiers.opponentParticipantId;
  const inspectorModifierContext = {
    opponentParticipantId: inspectorModifierOpponentId,
    participantLabels:
      inspectorModifierOpponentId && inspectorLiveModifiers.opponentLabel
        ? { [inspectorModifierOpponentId]: inspectorLiveModifiers.opponentLabel }
        : undefined,
    phase: inspectorIsHistorical ? inspectorHistoricalModifierPhase : inspectorModifierPhase,
    roundNumber: selectedRoundNumber,
    step: inspector.step,
  };
  recordCombatPerformanceStage(
    "panel_historical_modifier_presentation",
    combatPerformanceNow() - historicalModifierPresentationStartedAt,
    { historical: inspectorIsHistorical },
  );
  const inspectorModifierSourceMode: CombatInspectorSourceMode = inspectorIsHistorical
    ? "history"
    : "current";
  const inspectorModifierSourceLabel = getCombatInspectorSourceLabel(inspectorModifierSourceMode);
  const inspectorTargetValidation = useMemo(
    () =>
      validateCombatDeclarationTargets({
        actingParticipantId: inspector.participant?.participantId,
        actionId: inspectorDraft.actionId || undefined,
        movementKind: inspectorDraft.movementIntent.mode,
        phaseContexts: inspectorDraft.phaseContexts,
        secondaryActionContext: inspectorDraft.secondaryActionContext,
        selectedOpponentId: inspectorDraft.combatContext.selectedOpponentId,
        secondaryActionId: inspectorDraft.secondaryActionId || undefined,
      }),
    [
      inspectorDraft.actionId,
      inspectorDraft.combatContext.selectedOpponentId,
      inspectorDraft.phaseContexts,
      inspectorDraft.secondaryActionContext,
      inspectorDraft.secondaryActionId,
      inspectorDraft.movementIntent.mode,
      inspector.participant?.participantId,
    ],
  );
  const inspectorAttackPhase = getCombatAttackPhaseForStep(inspector.step);
  const inspectorResolutionPhase = getCombatRoundResolutionPhaseForStep(inspector.step);
  const inspectorResolutionStepKind = getCombatResolutionStepKind(inspector.step);
  const inspectorSelectedStepIsSequential = isSequentialResolutionStep(inspector.step);
  const inspectorCurrentStepIsInitiative =
    inspector.step === "initiative_phase_1" || inspector.step === "initiative_phase_2";
  const inspectorInitiativeResolutionPhase = inspectorCurrentStepIsInitiative
    ? getCombatRoundInitiativePhaseForStep(inspector.step)
    : undefined;
  const inspectorPhaseInitiativeResolutionOpen =
    inspectorInitiativeResolutionPhase && selectedRoundIsActive
      ? isCombatRoundPhaseInitiativeResolutionOpen({
          phase: inspectorInitiativeResolutionPhase,
          state: roundState,
          visibility: encounter.roleplayState?.visibility,
        })
      : false;
  const inspectorPhaseInitiativeCommitLabel =
    inspectorPhaseInitiativeResolutionOpen && inspectorInitiativeResolutionPhase
      ? `Commit ${formatCombatPhaseLabel(inspectorInitiativeResolutionPhase)} initiative`
      : undefined;
  const inspectorCanExecuteSelectedStep =
    selectedRoundIsActive &&
    (Boolean(projectedBoundaryTransitionAction) ||
      inspectorSelectionIsCurrentProgression ||
      (inspectorCurrentStepIsInitiative && roundState.currentStep === inspector.step));
  const inspectorIsInspectionOnly = !inspectorCanExecuteSelectedStep;
  const inspectorCurrentAttackPhase = inspectorAttackPhase;
  const inspectorPhaseChoicePhase =
    inspectorInitiativeResolutionPhase ??
    (currentActionPresentation?.taskKind === "combat_experience"
      ? currentActionPresentation.phase
      : undefined);
  const inspectorCurrentResolutionPhase = inspectorAttackPhase ?? inspectorResolutionPhase;
  const inspectorPhaseCombatExperienceRequirement =
    inspector.participant?.participantId && inspectorPhaseChoicePhase && selectedRoundIsActive
      ? getCombatRoundPhaseCombatExperienceRequirement({
          participantId: inspector.participant.participantId,
          phase: inspectorPhaseChoicePhase,
          state: roundState,
          visibility: encounter.roleplayState?.visibility,
        })
      : undefined;
  const inspectorPhaseAttackBackOutOpportunity =
    inspector.participant?.participantId && inspectorPhaseChoicePhase && selectedRoundIsActive
      ? getCombatRoundPhaseAttackBackOutOpportunity({
          participantId: inspector.participant.participantId,
          phase: inspectorPhaseChoicePhase,
          state: roundState,
          visibility: encounter.roleplayState?.visibility,
        })
      : undefined;
  const inspectorPhaseInitiativeChoice =
    inspector.participant?.participantId && inspectorPhaseChoicePhase && selectedRoundIsActive
      ? getCombatRoundPhaseInitiativeChoice({
          participantId: inspector.participant.participantId,
          phase: inspectorPhaseChoicePhase,
          state: roundState,
        })
      : undefined;
  const inspectorPhaseResolutionCursor =
    inspectorSelectedStepIsSequential &&
    selectedTimelineRoundState.phaseResolutionCursor?.phase === inspectorCurrentResolutionPhase
      ? selectedTimelineRoundState.phaseResolutionCursor
      : undefined;
  const inspectorPhaseResolutionStatus =
    inspector.participant && inspectorCurrentResolutionPhase
      ? getCombatRoundPhaseResolutionStatus({
          participantId: inspector.participant.participantId,
          phase: inspectorCurrentResolutionPhase,
          state: selectedTimelineRoundState,
        })
      : undefined;
  const inspectorCurrentPhaseHasAttack =
    inspector.participant && inspectorCurrentResolutionPhase
      ? combatRoundParticipantHasPhaseAttack({
          participantId: inspector.participant.participantId,
          phase: inspectorCurrentResolutionPhase,
          state: selectedTimelineRoundState,
        })
      : undefined;
  const inspectorTargetValidationMessage =
    !inspectorCurrentStepIsInitiative &&
    (!inspectorCurrentResolutionPhase ||
      (inspectorCurrentPhaseHasAttack !== false &&
        (!inspectorPhaseResolutionStatus ||
          inspectorPhaseResolutionStatus.substep === "pending" ||
          inspectorPhaseResolutionStatus.substep === "attack"))) &&
    !inspectorTargetValidation.valid
      ? inspectorTargetValidation.message
      : undefined;
  const resolvedInspectorCharacterState = selectedScenarioParticipant
    ? resolvedCharacterStateByParticipantId[selectedScenarioParticipant.id]
    : undefined;
  const inspectorBuild = useMemo(() => {
    const sourceBuild =
      resolvedInspectorCharacterState?.serverRecord.build ??
      selectedScenarioParticipant?.snapshot.build;
    const build = () => {
      const result = characterBuildSchema.safeParse(sourceBuild);
      return result.success ? result.data : null;
    };
    return selectedRoundIsActive
      ? combatPresentation.active.inspectorPresentation.resolve({
          build,
          dependencies: [sourceBuild],
          key: `character-build:${inspector.participant?.participantId ?? "none"}`,
        })
      : build();
  }, [
    combatPresentation.active.inspectorPresentation,
    inspector.participant?.participantId,
    resolvedInspectorCharacterState?.serverRecord.build,
    selectedRoundIsActive,
    selectedScenarioParticipant?.snapshot.build,
  ]);
  const inspectorSheetSummary = useMemo(() => {
    const build = () =>
      measureCombatPerformanceStage("panel_equipment_loadout_presentation", () =>
        content && inspectorBuild
          ? buildCharacterSheetSummary({
              build: inspectorBuild,
              content,
            })
          : undefined,
      );
    return selectedRoundIsActive
      ? combatPresentation.active.inspectorPresentation.resolve({
          build,
          dependencies: [content, inspectorBuild],
          key: `sheet-summary:${inspector.participant?.participantId ?? "none"}`,
        })
      : build();
  }, [
    combatPresentation.active.inspectorPresentation,
    content,
    inspector.participant?.participantId,
    inspectorBuild,
    selectedRoundIsActive,
  ]);
  const inspectorCombatExperienceSkillLookup = useMemo(
    () =>
      selectedScenarioParticipant
        ? getParticipantCombatExperienceSkillTotalLookup({
            ...selectedScenarioParticipant,
            sheetSummary: inspectorSheetSummary,
          })
        : { skillTotal: 0 },
    [inspectorSheetSummary, selectedScenarioParticipant],
  );
  const inspectorCombatExperienceSkillTotal = inspectorCombatExperienceSkillLookup.skillTotal;
  const inspectorCombatExperienceDraftDifficultyValue = Number.parseInt(
    inspectorCombatExperienceDifficulty,
    10,
  );
  const inspectorCombatExperienceDraftDifficultyValid =
    inspectorCombatExperienceDifficulty.trim().length > 0 &&
    Number.isInteger(inspectorCombatExperienceDraftDifficultyValue) &&
    inspectorCombatExperienceDraftDifficultyValue > 0;
  const inspectorCombatExperienceDifficultyDraftChanged =
    inspectorCombatExperienceDraftDifficultyValid &&
    inspectorCombatExperienceDraftDifficultyValue !== activeCombatExperienceDifficulty;
  const inspectorCombatExperienceDifficultyTaskActive =
    currentActionPresentation?.primaryAction.descriptor?.commandType ===
    "set_combat_experience_difficulty";
  const inspectorCombatExperienceDifficultyInputVisible =
    inspectorCombatExperienceDifficultyTaskActive ||
    (inspectorCombatExperienceRequired &&
      inspectorCombatExperienceIsCombatStart &&
      (!inspectorCombatExperienceWindowOpen || !combatExperienceRollRecorded));
  const inspectorCombatExperienceDifficultyStartPending =
    inspectorCombatExperienceRequired &&
    inspectorCombatExperienceIsCombatStart &&
    !inspectorCombatExperienceWindowOpen;
  const inspectorCombatExperienceDifficultyUpdatePending =
    inspectorCombatExperienceRequired &&
    inspectorCombatExperienceIsCombatStart &&
    inspectorCombatExperienceWindowOpen &&
    !combatExperienceRollRecorded &&
    inspectorCombatExperienceDifficultyDraftChanged;
  const inspectorCombatExperienceNoRollAvailable =
    inspectorCombatExperienceRequired &&
    inspectorCombatExperienceWindowOpen &&
    inspectorCombatExperienceSkillTotal >= activeCombatExperienceDifficulty;
  const inspectorCanContinuePhaseAttack = Boolean(
    inspectorPhaseAttackBackOutOpportunity &&
    !inspectorPhaseAttackBackOutOpportunity.ceRequired &&
    !inspectorPhaseInitiativeChoice &&
    inspectorPhaseInitiativeResolutionOpen &&
    selectedScenarioParticipant &&
    selectedEncounterParticipant &&
    selectedRoundIsActive &&
    !inspectorSnapshot,
  );
  const inspectorPhaseInitiativeChoiceSubmitted = Boolean(inspectorPhaseInitiativeChoice);
  const inspectorCanBackOutPhaseAttack = Boolean(
    inspectorPhaseAttackBackOutOpportunity &&
    inspector.participant?.participantId &&
    inspectorPhaseChoicePhase &&
    canBackOutCombatRoundPhaseAttack({
      participantId: inspector.participant.participantId,
      phase: inspectorPhaseChoicePhase,
      state: roundState,
      visibility: encounter.roleplayState?.visibility,
    }) &&
    !inspectorCombatExperienceIsCombatStart &&
    selectedScenarioParticipant &&
    selectedEncounterParticipant &&
    selectedRoundIsActive &&
    !inspectorSnapshot,
  );
  const inspectorPhaseAttackChoiceSelectorAvailable = Boolean(
    inspectorCanBackOutPhaseAttack &&
    !inspectorPhaseInitiativeChoiceSubmitted &&
    (inspectorPhaseCombatExperienceRequirement || inspectorCanContinuePhaseAttack),
  );
  const inspectorPhaseAttackChoiceKey = inspectorPhaseAttackBackOutOpportunity
    ? [
        inspector.participant?.participantId ?? "unknown",
        inspectorPhaseAttackBackOutOpportunity.phase,
        inspectorPhaseAttackBackOutOpportunity.ceRequired ? "ce" : "continue",
        inspectorPhaseInitiativeChoice?.choice ?? "pending",
      ].join(":")
    : "none";

  useEffect(() => {
    setInspectorPhaseAttackChoiceSelection("continue");
  }, [inspectorPhaseAttackChoiceKey]);

  const inspectorPhaseAttackChoiceIsBackOut =
    inspectorPhaseAttackChoiceSelectorAvailable &&
    inspectorPhaseAttackChoiceSelection === "back_out";
  const inspectorDoubleAttackDecisionAvailable = Boolean(
    !inspectorIsInspectionOnly &&
    projectedDoubleAttackDecisionTask?.owner?.kind === "combatant" &&
    projectedDoubleAttackDecisionTask.owner.participantId ===
      inspector.participant?.participantId &&
    inspector.participant?.declaration?.actionId === "double_attack" &&
    inspector.step === "review_phase_2_modifiers" &&
    inspector.participant.attackResults.phase1 &&
    !inspector.participant.attackResults.phase2 &&
    !roundState.commands.some(
      (command) =>
        command.roundNumber === roundState.roundNumber &&
        command.participantId === inspector.participant?.participantId &&
        command.type === "decide_double_attack_phase2",
    ),
  );
  const combatExperienceDifficultyControlsDisabled =
    saving ||
    (!inspectorCombatExperienceIsCombatStart && !inspectorCombatExperienceDifficultyTaskActive) ||
    combatExperienceRollRecorded ||
    (inspectorIsInspectionOnly && inspector.step !== "select_actions") ||
    Boolean(inspectorSnapshot);
  const inspectorLoadoutModel = useMemo(() => {
    if (archivedInspectorPresentation) {
      return null;
    }
    const build = () =>
      measureCombatPerformanceStage("panel_equipment_loadout_presentation", () =>
        buildEquipmentLoadoutModuleModel({
          characterContext:
            content && inspectorBuild
              ? {
                  content,
                  record: {
                    build: inspectorBuild,
                  },
                }
              : null,
          characterId: inspectorEquipmentCharacterId,
          liveCombatModifiers: inspectorLiveModifiers,
          state: inspectorEquipmentState,
          throwingWeaponItemId: null,
        }),
      );
    return selectedRoundIsActive
      ? combatPresentation.active.inspectorPresentation.resolve({
          build,
          dependencies: [
            content,
            inspectorBuild,
            inspectorEquipmentState,
            inspectorLiveModifiers,
            inspectorEquipmentCharacterId,
          ],
          key: `loadout-model:${inspector.participant?.participantId ?? "none"}`,
        })
      : build();
  }, [
    combatPresentation.active.inspectorPresentation,
    archivedInspectorPresentation,
    content,
    inspector.participant?.participantId,
    inspectorBuild,
    inspectorEquipmentState,
    inspectorLiveModifiers,
    inspectorEquipmentCharacterId,
    selectedRoundIsActive,
  ]);
  const inspectorLoadoutSummary = useMemo(() => {
    if (archivedInspectorPresentation) {
      return archivedInspectorPresentation.phaseLoadouts.phase1;
    }
    const build = () =>
      measureCombatPerformanceStage("panel_equipment_loadout_presentation", () =>
        buildPlayerCombatLoadoutSummary({
          actionId: inspectorDraft.actionId,
          allowUnarmedFallback:
            inspectorEquipmentStatus.kind === "ready" ||
            inspectorEquipmentStatus.kind === "unarmed",
          loadoutModel: inspectorLoadoutModel!,
          secondaryActionId: inspectorDraft.secondaryActionId,
        }),
      );
    return selectedRoundIsActive
      ? combatPresentation.active.inspectorPresentation.resolve({
          build,
          dependencies: [
            inspectorDraft.actionId,
            inspectorDraft.secondaryActionId,
            inspectorEquipmentStatus.kind,
            inspectorLoadoutModel,
          ],
          key: `loadout-summary:${inspector.participant?.participantId ?? "none"}`,
        })
      : build();
  }, [
    combatPresentation.active.inspectorPresentation,
    archivedInspectorPresentation,
    inspector.participant?.participantId,
    inspectorDraft.actionId,
    inspectorDraft.secondaryActionId,
    inspectorEquipmentStatus.kind,
    inspectorLoadoutModel,
    selectedRoundIsActive,
  ]);
  const inspectorTargetOptions = useMemo(() => {
    const candidateRoster: { participants: readonly CombatParticipantRosterEntry[] } = {
      participants: encounter.participants.length
        ? encounter.participants
        : effectiveScenarioParticipants
            .filter((participant) => participant.isActive)
            .map((participant) => ({
              characterId: participant.characterId,
              id: participant.id,
              label: participant.snapshot.displayName,
              scenarioParticipantId: participant.id,
            })),
    };
    const purpose =
      inspectorDraft.actionId === "feint_attack" ||
      inspectorDraft.actionId === "adjust_range_attack"
        ? "maneuver_target"
        : "attack_target";
    const allowedParticipantIds =
      encounterScenarioParticipantIds.length > 0
        ? encounterScenarioParticipantIds
        : candidateRoster.participants.flatMap((participant) =>
            getCombatDistanceParticipantAliases(participant),
          );
    return buildCombatParticipantCandidates({
      activeParticipantIds: new Set(
        effectiveScenarioParticipants
          .filter((participant) => participant.isActive)
          .map((participant) => participant.id),
      ),
      actingParticipantId: selectedScenarioParticipant?.id,
      allowedParticipantIds,
      encounter: candidateRoster,
      purpose,
    })
      .filter((candidate) => candidate.selectable)
      .map(({ displayName, participantId }) => ({ displayName, id: participantId }));
  }, [
    encounter.participants,
    effectiveScenarioParticipants,
    encounterScenarioParticipantIds,
    selectedScenarioParticipant?.id,
  ]);
  const inspectorNormalizedFeintPhaseContexts = useMemo(() => {
    if (inspectorDisplayDraft.actionId !== "feint_attack") {
      return inspectorDisplayDraft.phaseContexts;
    }
    const resolution = resolveCombatFeintDeclarationRequestTarget({
      encounterParticipants: encounter.participants,
      phaseContexts: inspectorDisplayDraft.phaseContexts,
    });
    return resolution.ok ? resolution.phaseContexts : inspectorDisplayDraft.phaseContexts;
  }, [encounter.participants, inspectorDisplayDraft.actionId, inspectorDisplayDraft.phaseContexts]);
  const inspectorPhaseLoadoutSummaries = useMemo(() => {
    if (archivedInspectorPresentation) {
      return archivedInspectorPresentation.phaseLoadouts;
    }
    const build = () =>
      measureCombatPerformanceStage("panel_phase_summary_presentation", () => {
        const buildPhaseSummary = (phaseKey: PlayerCombatPhaseKey) => {
          const basePhaseLiveModifiers = buildEncounterLiveCombatModifierSummary({
            combatContext: inspectorGeneratedCombatContext,
            combatEffects: selectedScenarioParticipant?.state.combatEffects,
            currentRound: selectedRoundNumber,
            encounterId: encounter.id,
            ownerParticipantId: selectedScenarioParticipant?.id,
            phaseKey,
          });
          const phaseLiveModifiers = buildTargetAwareEncounterLiveCombatModifierSummary({
            combatContext: inspectorGeneratedCombatContext,
            combatEffects: selectedScenarioParticipant?.state.combatEffects,
            context: resolveEncounterLiveCombatModifierContext({
              actionId: inspectorDraft.actionId || undefined,
              encounterId: encounter.id,
              ownerCombatantId: inspector.participant?.participantId,
              ownerParticipantId: selectedScenarioParticipant?.id,
              participants: encounter.participants,
              phaseKey,
              provisional: inspectorHasLocalModifierEdits,
              relationships: selectedTimelineRoundState.observationRelationships,
              roundNumber: selectedRoundNumber,
              step: inspector.step,
              targetParticipantId:
                inspectorDraft.secondaryActionContext?.targetParticipantId ??
                inspectorDraft.phaseContexts[phaseKey].targetParticipantId,
            }),
          });
          const phaseLoadoutModel = buildEquipmentLoadoutModuleModel({
            characterContext:
              content && inspectorBuild
                ? {
                    content,
                    record: {
                      build: inspectorBuild,
                    },
                  }
                : null,
            characterId: inspectorEquipmentCharacterId,
            liveCombatModifiers: phaseLiveModifiers,
            state: inspectorEquipmentState,
            throwingWeaponItemId: null,
          });
          const requestPhaseLoadoutModel = buildEquipmentLoadoutModuleModel({
            characterContext:
              content && inspectorBuild
                ? {
                    content,
                    record: {
                      build: inspectorBuild,
                    },
                  }
                : null,
            characterId: inspectorEquipmentCharacterId,
            liveCombatModifiers: basePhaseLiveModifiers,
            state: inspectorEquipmentState,
            throwingWeaponItemId: null,
          });

          const summary = buildPlayerCombatLoadoutSummary({
            actionId: inspectorDraft.actionId,
            allowUnarmedFallback:
              inspectorEquipmentStatus.kind === "ready" ||
              inspectorEquipmentStatus.kind === "unarmed",
            loadoutModel: phaseLoadoutModel,
            phaseKey,
            selectedAttackModeId: inspectorDraft.phaseContexts[phaseKey].attackModeId,
            secondaryActionId: inspectorDraft.secondaryActionId,
          });
          const requestSummary = buildPlayerCombatLoadoutSummary({
            actionId: inspectorDraft.actionId,
            allowUnarmedFallback:
              inspectorEquipmentStatus.kind === "ready" ||
              inspectorEquipmentStatus.kind === "unarmed",
            loadoutModel: requestPhaseLoadoutModel,
            phaseKey,
            selectedAttackModeId: inspectorDraft.phaseContexts[phaseKey].attackModeId,
            secondaryActionId: inspectorDraft.secondaryActionId,
          });
          return {
            ...summary,
            attackStats: summary.attackStats
              ? {
                  ...summary.attackStats,
                  provisional: inspectorHasLocalModifierEdits,
                }
              : null,
            requestAttackStats: requestSummary.attackStats,
          };
        };

        return {
          phase1: buildPhaseSummary("phase1"),
          phase2: buildPhaseSummary("phase2"),
        };
      });
    return selectedRoundIsActive
      ? combatPresentation.active.inspectorPresentation.resolve({
          build,
          dependencies: [
            content,
            inspectorBuild,
            inspectorDraft.actionId,
            inspectorDraft.phaseContexts,
            inspectorDraft.secondaryActionContext,
            inspectorHasLocalModifierEdits,
            inspectorGeneratedCombatContext,
            inspectorDraft.secondaryActionId,
            inspectorEquipmentState,
            inspectorEquipmentCharacterId,
            inspectorEquipmentStatus.kind,
            selectedScenarioParticipant?.state.combatEffects,
            selectedRoundNumber,
            selectedTimelineRoundState.observationRelationships,
            encounter.id,
            encounter.participants,
            inspector.participant?.participantId,
            inspector.step,
            selectedScenarioParticipant?.id,
          ],
          key: `phase-summaries:${inspector.participant?.participantId ?? "none"}`,
        })
      : build();
  }, [
    combatPresentation.active.inspectorPresentation,
    archivedInspectorPresentation,
    content,
    inspectorBuild,
    inspector.participant?.participantId,
    inspectorDraft.actionId,
    inspectorDraft.phaseContexts,
    inspectorDraft.secondaryActionContext,
    inspectorHasLocalModifierEdits,
    inspectorGeneratedCombatContext,
    inspectorDraft.secondaryActionId,
    inspectorEquipmentState,
    inspectorEquipmentCharacterId,
    inspectorEquipmentStatus.kind,
    selectedRoundIsActive,
    selectedScenarioParticipant?.state.combatEffects,
    selectedRoundNumber,
    selectedTimelineRoundState.observationRelationships,
    encounter.id,
    encounter.participants,
    inspector.step,
    selectedScenarioParticipant?.id,
  ]);
  const inspectorRenderedDeclarationAttackSelection = useMemo(
    () =>
      buildCombatDeclarationAttackSelection({
        actionId: inspectorDisplayDraft.actionId || undefined,
        feintMethod: inspectorDisplayDraft.feintMethod,
        phaseContexts: inspectorNormalizedFeintPhaseContexts,
        phaseLoadoutSummaries: inspectorPhaseLoadoutSummaries,
        secondaryActionId: inspectorDisplayDraft.secondaryActionId || undefined,
      }),
    [
      inspectorDisplayDraft.actionId,
      inspectorDisplayDraft.feintMethod,
      inspectorDisplayDraft.secondaryActionId,
      inspectorNormalizedFeintPhaseContexts,
      inspectorPhaseLoadoutSummaries,
    ],
  );
  const inspectorResolvedFeintSkill = inspectorIsHistorical
    ? inspectorDisplayDraft.feintSkillId
      ? {
          id: inspectorDisplayDraft.feintSkillId,
          label: resolveHistoricalFeintSkillLabel({
            skillId: inspectorDisplayDraft.feintSkillId,
            skills: content?.skills ?? [],
            specializations: content?.specializations ?? [],
          }),
        }
      : undefined
    : inspectorDraft.feintMethod === "movement"
      ? { id: "dodge", label: "Dodge" }
      : resolveCombatFeintWeaponSkill({
          equipmentState: inspectorEquipmentState,
          skills: content?.skills ?? [],
          specializations: content?.specializations ?? [],
          sourceTemplateId: inspectorPhaseLoadoutSummaries.phase1.reference?.sourceTemplateId,
        });
  const inspectorFeintSkillPreview = useMemo(
    () =>
      buildFeintSkillPreview({
        build: inspectorBuild ?? undefined,
        combatContext: inspectorGeneratedCombatContext,
        combatEffects: selectedScenarioParticipant?.state.combatEffects,
        content,
        currentInitiativeGroupId:
          combatProgressionProjection.executionOrder?.currentInitiativeGroupId,
        encounterId: encounter.id,
        method: inspectorDisplayDraft.feintMethod,
        observationRelationships: selectedTimelineRoundState.observationRelationships,
        participantId: selectedScenarioParticipant?.id ?? "unavailable-participant",
        roundNumber: selectedRoundNumber,
        sheetSummary: inspectorSheetSummary,
        skill: content?.skills.find((skill) => skill.id === inspectorResolvedFeintSkill?.id),
        targetParticipantId: inspectorNormalizedFeintPhaseContexts.phase1?.targetParticipantId,
      }),
    [
      combatProgressionProjection.executionOrder?.currentInitiativeGroupId,
      content,
      encounter.id,
      inspectorBuild,
      inspectorDisplayDraft.feintMethod,
      inspectorGeneratedCombatContext,
      inspectorNormalizedFeintPhaseContexts.phase1?.targetParticipantId,
      inspectorResolvedFeintSkill?.id,
      inspectorSheetSummary,
      selectedRoundNumber,
      selectedScenarioParticipant?.id,
      selectedScenarioParticipant?.state.combatEffects,
      selectedTimelineRoundState.observationRelationships,
    ],
  );
  const inspectorDistancePreferenceOptions = useMemo<PlayerCombatDistancePreferenceOption[]>(() => {
    const primaryTargetId =
      inspectorDisplayDraft.phaseContexts.phase1.targetParticipantId ??
      inspectorDisplayDraft.phaseContexts.phase2.targetParticipantId ??
      inspectorDisplayDraft.combatContext.targetParticipantId;
    const primaryTargetPhase =
      inspectorDisplayDraft.actionId === "adjust_range_attack"
        ? "phase2"
        : inspectorDisplayDraft.phaseContexts.phase1.targetParticipantId
          ? "phase1"
          : inspectorDisplayDraft.phaseContexts.phase2.targetParticipantId
            ? "phase2"
            : undefined;
    const defaultDistance =
      primaryTargetId && primaryTargetPhase
        ? getLongestPreferredDistanceForWeaponName({
            participant: selectedScenarioParticipant,
            resolvedEquipmentState: inspectorEquipmentState,
            weaponName: inspectorPhaseLoadoutSummaries[primaryTargetPhase].attackStats?.weaponName,
          })
        : undefined;

    return inspectorTargetOptions.map((option) => ({
      defaultDistance: option.id === primaryTargetId ? defaultDistance : undefined,
      displayName: option.displayName,
      id: option.id,
    }));
  }, [
    inspectorDisplayDraft.combatContext.targetParticipantId,
    inspectorDisplayDraft.actionId,
    inspectorDisplayDraft.phaseContexts.phase1.targetParticipantId,
    inspectorDisplayDraft.phaseContexts.phase2.targetParticipantId,
    inspectorEquipmentState,
    inspectorPhaseLoadoutSummaries,
    inspectorTargetOptions,
    selectedScenarioParticipant,
  ]);
  const inspectorDisplayDistancePreferenceOptions = inspectorPanelSnapshot?.declarationSummary
    ? (inspectorPanelSnapshot.declarationSummary.movementPreferenceTargets ?? []).map((target) => ({
        defaultDistance:
          inspectorPanelSnapshot.declarationSummary?.movementIntent?.distancePreferences.find(
            (preference) => preference.targetParticipantId === target.id,
          )?.desiredDistance,
        displayName: target.displayName,
        id: target.id,
      }))
    : inspectorDistancePreferenceOptions;
  const inspectorCurrentInitiativePhase =
    inspector.step === "initiative_phase_1"
      ? "phase1"
      : inspector.step === "initiative_phase_2"
        ? "phase2"
        : undefined;
  const inspectorCurrentInitiative = inspectorCurrentInitiativePhase
    ? inspector.participant?.initiatives[inspectorCurrentInitiativePhase]
    : undefined;
  const inspectorDisplayInitiative = inspectorIsHistorical
    ? inspectorSnapshot?.initiativeResult
    : inspectorCurrentInitiative;
  const inspectorDisplayInitiativeResolutionType =
    inspectorDisplayInitiative && "resolutionType" in inspectorDisplayInitiative
      ? inspectorDisplayInitiative.resolutionType
      : undefined;
  const inspectorInitiativeRollCounts =
    inspectorCurrentInitiativePhase && selectedRoundIsActive
      ? {
          pending: roundState.participants.filter(
            (participant) => participant.initiatives[inspectorCurrentInitiativePhase] === undefined,
          ).length,
          total: roundState.participants.length,
        }
      : undefined;
  const attackParryResultPresentationStartedAt = combatPerformanceNow();
  const activeAttackResolutionPresentation =
    selectedRoundIsActive && !inspectorIsHistorical
      ? combatPresentation.active.inspectorPresentation.resolve({
          build: () =>
            buildActiveAttackResolutionPresentation({
              attackPhase: inspectorAttackPhase,
              participantId: inspector.participant?.participantId,
              resolutionPhase: inspectorResolutionPhase,
              roundState,
            }),
          dependencies: [
            inspector.participant?.participantId,
            inspectorAttackPhase,
            inspectorResolutionPhase,
            roundState,
          ],
          key: `attack-resolution:${inspector.participant?.participantId ?? "none"}:${inspector.step}`,
        })
      : undefined;
  const archivedAttackResolutionPresentation = archivedInspectorPresentation?.attackResolution;
  const inspectorDisplayAttackResult = inspectorIsHistorical
    ? (archivedAttackResolutionPresentation?.attackResult ?? inspectorSnapshot?.attackResult)
    : activeAttackResolutionPresentation?.attackResult;
  const inspectorResolutionAttackResult = inspectorIsHistorical
    ? (archivedAttackResolutionPresentation?.resolutionAttackResult ??
      inspectorSnapshot?.attackResult)
    : activeAttackResolutionPresentation?.resolutionAttackResult;
  const inspectorDisplayPhaseResolutionResult = inspectorIsHistorical
    ? (archivedAttackResolutionPresentation?.resolutionResult ??
      inspectorSnapshot?.phaseResolutionResult)
    : activeAttackResolutionPresentation?.resolutionResult;
  const inspectorPhaseResolutionOwnerParticipantId =
    activeAttackResolutionPresentation?.phaseResolutionOwnerParticipantId ??
    archivedAttackResolutionPresentation?.phaseResolutionOwnerParticipantId ??
    inspectorResolutionAttackResult?.attackerParticipantId ??
    inspector.participant?.participantId;
  const inspectorPhaseResolutionOwnerStatus = archivedAttackResolutionPresentation
    ? archivedAttackResolutionPresentation.phaseResolutionOwnerStatus
    : !inspectorIsHistorical
      ? activeAttackResolutionPresentation?.phaseResolutionOwnerStatus
      : inspectorPhaseResolutionOwnerParticipantId && inspectorCurrentResolutionPhase
        ? getCombatRoundPhaseResolutionStatus({
            participantId: inspectorPhaseResolutionOwnerParticipantId,
            phase: inspectorCurrentResolutionPhase,
            state: selectedTimelineRoundState,
          })
        : undefined;
  const inspectorPhaseResolutionOwnerHasAttack =
    inspectorPhaseResolutionOwnerParticipantId && inspectorCurrentResolutionPhase
      ? combatRoundParticipantHasPhaseAttack({
          participantId: inspectorPhaseResolutionOwnerParticipantId,
          phase: inspectorCurrentResolutionPhase,
          state: selectedTimelineRoundState,
        })
      : undefined;
  const inspectorActionPhaseHasAttack = inspectorCurrentAttackPhase
    ? inspectorCurrentPhaseHasAttack
    : inspectorPhaseResolutionOwnerHasAttack;
  const inspectorActionPhaseResolutionStatus = inspectorCurrentAttackPhase
    ? inspectorPhaseResolutionStatus
    : inspectorPhaseResolutionOwnerStatus;
  const inspectorParrySelectionKey = getCombatParrySelectionKey({
    result: inspectorResolutionAttackResult,
    roundNumber: selectedTimelineRoundState.roundNumber,
  });
  const inspectorParryDefenderRoundParticipant =
    !archivedAttackResolutionPresentation && inspectorResolutionAttackResult
      ? selectedTimelineRoundState.participants.find(
          (participant) =>
            participant.participantId === inspectorResolutionAttackResult.defenderParticipantId,
        )
      : undefined;
  const inspectorParryDefenderEncounterParticipant =
    !archivedAttackResolutionPresentation && inspectorResolutionAttackResult
      ? encounter.participants.find(
          (participant) => participant.id === inspectorResolutionAttackResult.defenderParticipantId,
        )
      : undefined;
  const inspectorParryDefenderScenarioParticipant = inspectorParryDefenderEncounterParticipant
    ? findScenarioParticipantForEncounterParticipant({
        encounterParticipant: inspectorParryDefenderEncounterParticipant,
        scenarioParticipants: effectiveScenarioParticipants,
      })
    : undefined;
  const inspectorParryDefenderPhaseSummary =
    inspectorResolutionPhase && inspectorParryDefenderScenarioParticipant
      ? selectedRoundIsActive
        ? combatPresentation.active.inspectorPresentation.resolve({
            build: () =>
              buildScenarioParticipantPhaseSummary({
                declaration: inspectorParryDefenderRoundParticipant?.declaration,
                phaseKey: inspectorResolutionPhase,
                scenarioParticipant: inspectorParryDefenderScenarioParticipant,
              }),
            dependencies: [
              inspectorParryDefenderRoundParticipant?.declaration,
              inspectorResolutionPhase,
              inspectorParryDefenderScenarioParticipant,
            ],
            key: `parry-defender-phase-summary:${inspectorParryDefenderScenarioParticipant.id}:${inspectorResolutionPhase}`,
          })
        : buildScenarioParticipantPhaseSummary({
            declaration: inspectorParryDefenderRoundParticipant?.declaration,
            phaseKey: inspectorResolutionPhase,
            scenarioParticipant: inspectorParryDefenderScenarioParticipant,
          })
      : undefined;
  const inspectorParrySources =
    archivedAttackResolutionPresentation?.parry.sources ??
    inspectorParryDefenderPhaseSummary?.parrySources;
  const inspectorParrySelection = archivedAttackResolutionPresentation
    ? archivedAttackResolutionPresentation.parry.selection
    : getCombatParrySourceSelection({
        selection: inspectorParrySelectionKey
          ? parrySourceSelections[inspectorParrySelectionKey]
          : undefined,
        sources: inspectorParrySources,
      });
  const inspectorParryBase = archivedAttackResolutionPresentation
    ? archivedAttackResolutionPresentation.parry.base
    : getSelectedCombatParryBase({
        selection: inspectorParrySelection,
        sources: inspectorParrySources,
      });
  const inspectorParryExtraRawModifiers = archivedAttackResolutionPresentation
    ? []
    : buildCombatAttackResultParryModifiers(inspectorResolutionAttackResult);
  const inspectorParryModifierCalculation =
    !archivedAttackResolutionPresentation && inspectorParryBase !== undefined
      ? buildEncounterDbParryModifierCalculation({
          baseValue: inspectorParryBase,
          extraRawModifiers: inspectorParryExtraRawModifiers,
          liveModifiers: inspectorParryDefenderPhaseSummary?.liveModifiers,
        })
      : null;
  const inspectorParryModifierAdjustment = archivedAttackResolutionPresentation
    ? archivedAttackResolutionPresentation.parry.modifierAdjustment
    : inspectorParryModifierCalculation
      ? inspectorParryModifierCalculation.finalValue - (inspectorParryBase ?? 0)
      : 0;
  const inspectorParryModifierBreakdown =
    archivedAttackResolutionPresentation?.parry.modifierBreakdown ??
    inspectorParryModifierCalculation?.rawModifiers ??
    [];
  if (!archivedAttackResolutionPresentation) {
    recordCombatPerformanceStage(
      inspectorIsHistorical
        ? "panel_historical_attack_parry_result_presentation"
        : "panel_active_attack_parry_result_presentation",
      combatPerformanceNow() - attackParryResultPresentationStartedAt,
      { source: "inspector_resolution" },
    );
  }
  const inspectorSelectedAttackAlreadyRolled = Boolean(
    inspectorAttackPhase && inspectorDisplayAttackResult,
  );
  const inspectorCanRollPhaseAttack =
    inspectorCanExecuteSelectedStep &&
    Boolean(inspectorCurrentAttackPhase) &&
    inspectorCurrentPhaseHasAttack === true &&
    (!inspectorPhaseResolutionStatus ||
      inspectorPhaseResolutionStatus.substep === "pending" ||
      inspectorPhaseResolutionStatus.substep === "attack") &&
    !inspectorDisplayAttackResult;
  const inspectorCanSkipCurrentPhaseAction =
    inspectorCanExecuteSelectedStep &&
    Boolean(inspectorCurrentAttackPhase) &&
    Boolean(
      inspector.participant?.participantId &&
      inspectorCurrentAttackPhase &&
      combatRoundParticipantHasExecutablePhaseAction({
        participantId: inspector.participant.participantId,
        phase: inspectorCurrentAttackPhase,
        state: selectedTimelineRoundState,
      }),
    ) &&
    (!inspectorPhaseResolutionStatus ||
      inspectorPhaseResolutionStatus.substep === "pending" ||
      inspectorPhaseResolutionStatus.substep === "attack") &&
    !inspectorDisplayAttackResult;
  const inspectorSkipActionOutcomeSelectorAvailable =
    inspectorCanSkipCurrentPhaseAction &&
    currentActionPresentation?.taskKind === "attack" &&
    !inspectorPhaseAttackChoiceSelectorAvailable;
  const inspectorCurrentAttackSourceMissing =
    inspectorCanRollPhaseAttack &&
    Boolean(inspectorCurrentAttackPhase) &&
    !inspectorPhaseLoadoutSummaries[inspectorCurrentAttackPhase ?? "phase1"].attackStats;
  const inspectorAttackSourceValidationMessage =
    inspectorCurrentAttackSourceMissing && inspectorCurrentAttackPhase
      ? `No ${formatCombatPhaseLabel(inspectorCurrentAttackPhase)} attack source available.`
      : undefined;
  const inspectorCanRollParry =
    inspectorCanExecuteSelectedStep &&
    Boolean(inspectorResolutionPhase) &&
    inspectorResolutionStepKind === "parry" &&
    Boolean(inspectorResolutionAttackResult?.hit) &&
    inspectorDisplayPhaseResolutionResult?.parryResolution.status === "pending" &&
    inspectorPhaseResolutionOwnerStatus?.substep === "parry" &&
    inspector.participant?.participantId ===
      inspectorResolutionAttackResult?.defenderParticipantId &&
    inspectorParryBase !== undefined &&
    !inspectorSnapshot;
  const currentDamageTaskAttackResultId =
    currentActionPresentation?.taskKind === "damage_review"
      ? currentActionPresentation.primaryAction.descriptor?.attackResultId
      : undefined;
  const liveDamageResolution = currentDamageTaskAttackResultId
    ? roundState.phaseResolutionResults.find(
        (resolution) => resolution.attackResultId === currentDamageTaskAttackResultId,
      )
    : undefined;
  const displayedDamageResolution = liveDamageResolution ?? inspectorDisplayPhaseResolutionResult;
  const inspectorDamageSubstate =
    inspectorResolutionStepKind === "damage"
      ? getCombatRoundDamageSubstate(displayedDamageResolution)
      : undefined;
  const inspectorDamageProposalReady =
    inspectorResolutionStepKind === "damage" &&
    Boolean(displayedDamageResolution?.damageResult) &&
    displayedDamageResolution?.damageProposal.status !== "committed";
  const inspectorDamageCommitted =
    inspectorResolutionStepKind === "damage" &&
    displayedDamageResolution?.damageProposal.status === "committed";
  const inspectorDamageAttackerLabel = displayedDamageResolution
    ? (selectedTimelineRoundState.participants.find(
        (participant) =>
          participant.participantId === displayedDamageResolution.attackerParticipantId,
      )?.label ?? "attacker")
    : undefined;
  const inspectorDamageDefenderLabel = displayedDamageResolution
    ? (selectedTimelineRoundState.participants.find(
        (participant) =>
          participant.participantId === displayedDamageResolution.defenderParticipantId,
      )?.label ?? "defender")
    : undefined;
  const inspectorDamageReviewKey = displayedDamageResolution?.damageResult?.attackResultId;
  const inspectorDamageReviewDraft =
    inspectorDamageReviewKey && damageReviewDrafts[inspectorDamageReviewKey]
      ? damageReviewDrafts[inspectorDamageReviewKey]
      : buildCombatDamageReviewDraft(
          displayedDamageResolution?.damageResult,
          displayedDamageResolution?.criticalRoll,
        );
  const inspectorDamageCommitReadiness = useMemo(() => {
    const damageResult = displayedDamageResolution?.damageResult;

    if (!inspectorDamageProposalReady || !damageResult) {
      return undefined;
    }

    try {
      const reviewedState = reviewCombatRoundDamageResult({
        attackResultId: damageResult.attackResultId,
        review: buildCombatDamageReviewFromDraft({
          criticalRoll: displayedDamageResolution?.criticalRoll,
          damageResult,
          draft: inspectorDamageReviewDraft,
        }),
        reviewedAt: "2026-01-01T00:00:00.000Z",
        state: selectedTimelineRoundState,
      });

      return getCombatRoundPhaseDamageCommitReadiness({
        attackResultId: damageResult.attackResultId,
        state: reviewedState,
      });
    } catch (caughtError) {
      return {
        attackResultId: damageResult.attackResultId,
        ready: false,
        reason:
          caughtError instanceof Error
            ? `Cannot commit: ${caughtError.message}`
            : "Cannot commit: save review before committing.",
        warnings: [],
      } satisfies CombatRoundPhaseDamageCommitReadiness;
    }
  }, [
    inspectorDamageProposalReady,
    inspectorDamageReviewDraft,
    displayedDamageResolution,
    selectedTimelineRoundState,
  ]);
  const inspectorDamageCommitValidationMessage =
    inspectorDamageProposalReady &&
    inspectorDamageSubstate !== "critical_pending" &&
    inspectorDamageCommitReadiness?.ready === false
      ? inspectorDamageCommitReadiness.reason
      : undefined;
  const inspectorDamageReviewCommitReadiness =
    inspectorDamageSubstate === "critical_pending" ? undefined : inspectorDamageCommitReadiness;
  const projectedFeintOwnerParticipantId = projectedFeintTask?.trackerFacet.owner?.participantId;
  const inspectorFeintProposal =
    selectedRoundIsActive &&
    projectedFeintOwnerParticipantId === inspector.participant?.participantId
      ? roundState.feintProposals.find(
          (proposal) =>
            (proposal.status === "awaiting_rolls" || proposal.status === "awaiting_review") &&
            proposal.attackerParticipantId === projectedFeintOwnerParticipantId,
        )
      : undefined;
  const inspectorFeintAttackerCalculation = inspectorFeintProposal?.attackerRoll
    ? buildCombatCalculationPresentationFromSnapshot({
        calculationId: inspectorFeintProposal.attackerRoll.id,
        calculationType: "feint_roll",
        facts: inspectorFeintProposal.attackerRoll,
        label: `Initiator — ${
          roundParticipantLabelsById[inspectorFeintProposal.attackerParticipantId] ??
          inspectorFeintProposal.attackerParticipantId
        }`,
      })
    : undefined;
  const inspectorFeintDefenderCalculation = inspectorFeintProposal?.defenderRoll
    ? buildCombatCalculationPresentationFromSnapshot({
        calculationId: inspectorFeintProposal.defenderRoll.id,
        calculationType: "feint_roll",
        facts: inspectorFeintProposal.defenderRoll,
        label: `Defender — ${
          roundParticipantLabelsById[inspectorFeintProposal.defenderParticipantId] ??
          inspectorFeintProposal.defenderParticipantId
        }`,
      })
    : undefined;
  const inspectorAdjustDistanceProposal =
    selectedRoundIsActive && projectedAdjustDistanceTask?.identity.proposalId
      ? roundState.adjustDistanceProposals.find(
          (proposal) =>
            proposal.status !== "committed" &&
            proposal.id === projectedAdjustDistanceTask.identity.proposalId,
        )
      : undefined;
  const inspectorAdjustDistanceReview = buildAdjustDistanceReviewPresentation({
    participantLabelsById: roundParticipantLabelsById,
    proposal: inspectorAdjustDistanceProposal,
  });
  const inspectorAdjustDistanceAttackerCalculation = inspectorAdjustDistanceProposal?.attackerRoll
    ? buildDodgeCalculationPresentationFromSnapshot({
        actor: {
          label:
            roundParticipantLabelsById[inspectorAdjustDistanceProposal.attackerParticipantId] ??
            inspectorAdjustDistanceProposal.attackerParticipantId,
          participantId: inspectorAdjustDistanceProposal.attackerParticipantId,
        },
        calculationId: inspectorAdjustDistanceProposal.attackerRoll.id,
        calculationType: "adjust_distance_roll",
        facts: inspectorAdjustDistanceProposal.attackerRoll,
        label: "Initiator calculation",
      })
    : undefined;
  const inspectorAdjustDistanceDefenderCalculation = inspectorAdjustDistanceProposal?.defenderRoll
    ? buildDodgeCalculationPresentationFromSnapshot({
        actor: {
          label:
            roundParticipantLabelsById[inspectorAdjustDistanceProposal.defenderParticipantId] ??
            inspectorAdjustDistanceProposal.defenderParticipantId,
          participantId: inspectorAdjustDistanceProposal.defenderParticipantId,
        },
        calculationId: inspectorAdjustDistanceProposal.defenderRoll.id,
        calculationType: "adjust_distance_roll",
        facts: inspectorAdjustDistanceProposal.defenderRoll,
        label: "Opponent calculation",
      })
    : undefined;
  useEffect(() => {
    if (!inspectorAdjustDistanceProposal) return;
    setInspectorAdjustDistanceCommittedDistance(
      String(
        inspectorAdjustDistanceProposal.review?.committedDistance ??
          inspectorAdjustDistanceProposal.standardProposedDistance ??
          inspectorAdjustDistanceProposal.currentDistance,
      ),
    );
    setInspectorAdjustDistanceOutcome(
      inspectorAdjustDistanceProposal.review?.acceptedOutcome ??
        inspectorAdjustDistanceProposal.standardOutcome ??
        "unsuccessful",
    );
    setInspectorAdjustDistanceReviewNote(inspectorAdjustDistanceProposal.review?.notes ?? "");
  }, [inspectorAdjustDistanceProposal]);
  useEffect(() => {
    if (!inspectorFeintProposal?.review) return;
    setInspectorFeintAttackerModifier(
      String(
        inspectorFeintProposal.review.gmAttackerDbParryModifier ??
          inspectorFeintProposal.review.proposedAttackerDbParryModifier,
      ),
    );
    setInspectorFeintDefenderObModifier(
      String(
        inspectorFeintProposal.review.gmDefenderSkillObModifier ??
          inspectorFeintProposal.review.gmDefenderObDbModifier ??
          inspectorFeintProposal.review.proposedDefenderObDbModifier,
      ),
    );
    setInspectorFeintDefenderDbModifier(
      String(
        inspectorFeintProposal.review.gmDefenderDbParryModifier ??
          inspectorFeintProposal.review.gmDefenderObDbModifier ??
          inspectorFeintProposal.review.proposedDefenderObDbModifier,
      ),
    );
    setInspectorFeintNote(inspectorFeintProposal.review.notes ?? "");
  }, [inspectorFeintProposal]);
  const inspectorRoundEndActionValidationMessage =
    inspector.step === "round_summary" && selectedRoundIsActive
      ? inspectorRoundEndTask?.kind === "round_end_prepare"
        ? "Round-end review is preparing automatically."
        : inspectorRoundEndDistanceAction
          ? undefined
          : !inspectorRoundEndTask
            ? "Round-end review complete for this participant."
            : undefined
      : undefined;
  const inspectorRoundEndReviewHasProposals = Boolean(
    inspectorRoundEndReview &&
    (inspectorRoundEndReview.proposedEffects.length > 0 ||
      inspectorRoundEndReview.proposedRemovals.length > 0 ||
      inspectorRoundEndReview.proposedDamage.length > 0 ||
      inspectorRoundEndReview.proposedHealthRolls.length > 0),
  );
  const inspectorCombatExperienceDifficultyValidationMessage =
    inspectorCombatExperienceDifficultyInputVisible &&
    !inspectorCombatExperienceDraftDifficultyValid
      ? "Enter CE difficulty."
      : undefined;
  const inspectorCurrentCommandType =
    currentActionPresentation?.primaryAction.descriptor?.commandType;
  const inspectorActionValidationMessage =
    inspectorCurrentCommandType === "set_combat_experience_difficulty"
      ? inspectorCombatExperienceDifficultyValidationMessage
      : inspectorCurrentCommandType === "declare_action" ||
          inspectorCurrentCommandType === "review_modifiers_phase1" ||
          inspectorCurrentCommandType === "review_modifiers_phase2"
        ? inspectorTargetValidationMessage
        : inspectorCurrentCommandType === "roll_attack"
          ? (inspectorTargetValidationMessage ?? inspectorAttackSourceValidationMessage)
          : inspectorCurrentCommandType === "commit_round_end_distance_control" &&
              inspectorRoundEndDistanceCommitProposal?.controlMode === "continued_contact" &&
              !roundEndDistanceOverrideDrafts[inspectorRoundEndDistanceCommitProposal.id]?.trim()
            ? "Choose engagement distance."
            : inspectorCurrentCommandType === "commit_phase_damage"
              ? inspectorDamageCommitValidationMessage
              : inspectorCurrentCommandType === "prepare_round_end_review"
                ? inspectorRoundEndActionValidationMessage
                : undefined;
  const inspectorCombatExperienceActionLabel = inspectorCombatExperienceDifficultyStartPending
    ? "Start Combat Experience rolls"
    : inspectorCombatExperienceDifficultyUpdatePending ||
        (inspectorCombatExperienceDifficultyInputVisible &&
          !inspectorCombatExperienceDraftDifficultyValid)
      ? "Update CE difficulty"
      : inspectorCombatExperienceRequired
        ? !inspectorCombatExperienceWindowOpen
          ? "Start Combat Experience rolls"
          : inspectorCombatExperienceNoRollAvailable
            ? "Confirm Combat Experience"
            : "Roll Combat Experience"
        : undefined;
  const inspectorIsCursorParticipant =
    Boolean(inspectorPhaseResolutionCursor) &&
    inspectorPhaseResolutionCursor?.participantId === inspector.participant?.participantId;
  const inspectorCursorParticipantLabel = inspectorPhaseResolutionCursor
    ? selectedTimelineRoundState.participants.find(
        (participant) => participant.participantId === inspectorPhaseResolutionCursor.participantId,
      )?.label
    : undefined;
  const inspectorCursorIncomingAttackResult =
    inspectorPhaseResolutionCursor &&
    (inspectorPhaseResolutionCursor.substep === "parry" ||
      inspectorPhaseResolutionCursor.substep === "damage" ||
      inspectorPhaseResolutionCursor.substep === "effects")
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: inspectorPhaseResolutionCursor.participantId,
          phase: inspectorPhaseResolutionCursor.phase,
          state: selectedTimelineRoundState,
        })
      : undefined;
  const inspectorCursorActorLabel = inspectorCursorIncomingAttackResult
    ? selectedTimelineRoundState.participants.find(
        (participant) =>
          participant.participantId === inspectorCursorIncomingAttackResult.attackerParticipantId,
      )?.label
    : inspectorCursorParticipantLabel;
  const inspectorCursorDefenderLabel = inspectorCursorIncomingAttackResult
    ? selectedTimelineRoundState.participants.find(
        (participant) =>
          participant.participantId === inspectorCursorIncomingAttackResult.defenderParticipantId,
      )?.label
    : undefined;
  const inspectorActionButtonLabel = projectedBoundaryTransitionAction
    ? getBoundaryTransitionButtonLabel(projectedBoundaryTransitionAction.targetBoundary)
    : inspectorSelectedAttackAlreadyRolled
      ? "Attack already rolled"
      : inspectorAdjustDistanceProposal?.status === "awaiting_defender_response"
        ? "Confirm defender response"
        : inspectorAdjustDistanceProposal?.status === "awaiting_gm_adjustment"
          ? "Confirm maneuver adjustment"
          : inspectorAdjustDistanceProposal?.status === "awaiting_rolls"
            ? inspectorAdjustDistanceProposal.attackerRoll
              ? "Roll defender Dodge"
              : "Roll attacker Dodge"
            : inspectorAdjustDistanceProposal?.status === "awaiting_review"
              ? "Commit distance adjustment"
              : inspectorFeintProposal?.status === "awaiting_rolls"
                ? inspectorFeintProposal.attackerRoll
                  ? "Roll feint resistance"
                  : "Roll feint"
                : inspectorFeintProposal?.status === "awaiting_review"
                  ? "Commit feint result"
                  : inspectorDoubleAttackDecisionAvailable
                    ? inspectorDoubleAttackDecision === "cancel"
                      ? "Cancel Attack 2"
                      : "Continue Attack 2"
                    : inspectorPhaseInitiativeChoiceSubmitted
                      ? "Phase choice submitted"
                      : inspectorPhaseAttackChoiceIsBackOut
                        ? "Back out of attack"
                        : inspectorCanContinuePhaseAttack
                          ? "Continue attack"
                          : inspectorCombatExperienceActionLabel
                            ? inspectorCombatExperienceActionLabel
                            : inspectorPhaseInitiativeCommitLabel
                              ? inspectorPhaseInitiativeCommitLabel
                              : inspectorIsInspectionOnly && inspector.step !== "select_actions"
                                ? "Inspecting step - use Current task to resume"
                                : inspector.step === "round_summary" &&
                                    inspectorRoundEndTask?.kind === "round_end_prepare"
                                  ? "Preparing round-end review"
                                  : inspector.step === "round_summary" &&
                                      inspectorRoundEndDistanceAction?.kind === "roll"
                                    ? `Roll distance control for ${inspectorRoundEndDistanceAction.option.participantLabel}`
                                    : inspector.step === "round_summary" &&
                                        inspectorRoundEndDistanceAction?.kind === "commit"
                                      ? "Apply distance control"
                                      : inspector.step === "round_summary" &&
                                          inspectorRoundEndTask?.kind === "effect_review"
                                        ? inspectorRoundEndReviewHasProposals
                                          ? "Commit participant SU review"
                                          : "Mark SU review complete"
                                        : inspector.step === "round_summary" &&
                                            inspectorRoundEndTask?.kind === "health_review"
                                          ? "Roll health check"
                                          : inspector.step === "round_summary" &&
                                              !inspectorRoundEndTask
                                            ? "Round-end review complete"
                                            : inspectorDamageCommitted
                                              ? "Phase damage committed"
                                              : inspectorDamageSubstate === "critical_pending"
                                                ? `Roll critical for ${inspectorDamageAttackerLabel ?? "attacker"}`
                                                : inspectorDamageSubstate === "location_pending"
                                                  ? `Roll hit location for ${inspectorDamageAttackerLabel ?? "attacker"}`
                                                  : inspectorDamageSubstate === "location_rolled"
                                                    ? "Prepare damage review"
                                                    : inspectorDamageProposalReady
                                                      ? "Commit phase damage"
                                                      : inspectorCanRollParry
                                                        ? "Roll parry"
                                                        : inspectorAttackSourceValidationMessage
                                                          ? inspectorAttackSourceValidationMessage
                                                          : inspectorCurrentResolutionPhase &&
                                                              inspectorActionPhaseHasAttack ===
                                                                false
                                                            ? `Complete ${formatCombatPhaseLabel(inspectorCurrentResolutionPhase)} for participant`
                                                            : getCombatResolutionButtonLabel({
                                                                hasPhaseAttack:
                                                                  inspectorActionPhaseHasAttack,
                                                                phase:
                                                                  inspectorCurrentResolutionPhase,
                                                                step: inspector.step,
                                                                substep:
                                                                  inspectorActionPhaseResolutionStatus?.substep,
                                                              });
  const inspectorBulkStepCompletionAvailable =
    inspectorCanExecuteSelectedStep &&
    (currentActionPresentation?.taskKind === "modifier_review" ||
      currentActionPresentation?.taskKind === "roll_initiative" ||
      (currentActionPresentation?.taskKind === "combat_experience" &&
        roundState.currentStep === "select_actions" &&
        inspectorCurrentCommandType === "roll_combat_experience" &&
        !selectedScenarioParticipant?.controlledByUserId) ||
      (currentActionPresentation?.taskKind === "health_review" &&
        inspectorCurrentCommandType === "roll_round_end_health_check" &&
        !selectedScenarioParticipant?.controlledByUserId) ||
      (currentActionPresentation?.taskKind === "observation_roll" &&
        inspectorCurrentCommandType === "roll_observation" &&
        !selectedScenarioParticipant?.controlledByUserId) ||
      (currentActionPresentation?.taskKind === "continued_contact_maintenance_roll" &&
        inspectorCurrentCommandType === "roll_continued_contact_maintenance" &&
        !selectedScenarioParticipant?.controlledByUserId) ||
      (currentActionPresentation?.taskKind === "distance_roll" &&
        inspectorCurrentCommandType === "roll_round_end_distance_control" &&
        !selectedScenarioParticipant?.controlledByUserId) ||
      (currentActionPresentation?.taskKind === "submit_declaration" &&
        !selectedScenarioParticipant?.controlledByUserId)) &&
    !(currentActionPresentation?.taskKind === "modifier_review" && inspectorHasLocalModifierEdits);
  const inspectorWorkflowSelectorAvailable =
    Boolean(currentActionPresentation?.primaryAction.descriptor) &&
    (inspectorSkipActionOutcomeSelectorAvailable || inspectorBulkStepCompletionAvailable);
  const inspectorCurrentActionOutcomeKey = inspectorWorkflowSelectorAvailable
    ? [
        selectedTimelineRoundState.roundNumber,
        selectedTimelineRoundState.currentCursor?.participantId ?? "none",
        selectedTimelineRoundState.currentCursor?.step ?? "none",
        inspectorActionButtonLabel,
      ].join(":")
    : "none";

  useEffect(() => {
    setInspectorCurrentActionOutcomeSelection("perform");
  }, [inspectorCurrentActionOutcomeKey]);

  const inspectorSkipActionSelected = inspectorCurrentActionOutcomeSelection === "skip";
  const inspectorBulkStepCompletionSelected =
    inspectorCurrentActionOutcomeSelection === "complete_remaining";
  const inspectorActionButtonDisabled = saving || Boolean(inspectorActionValidationMessage);
  const inspectorEffectiveActionButtonDisabled = inspectorSkipActionSelected
    ? saving ||
      Boolean(inspectorSnapshot) ||
      inspectorIsInspectionOnly ||
      !inspectorSkipActionOutcomeSelectorAvailable
    : inspectorBulkStepCompletionSelected
      ? saving ||
        Boolean(inspectorSnapshot) ||
        inspectorIsInspectionOnly ||
        !inspectorBulkStepCompletionAvailable
      : inspectorActionButtonDisabled;
  const inspectorCurrentActionOutcomeControls = inspectorWorkflowSelectorAvailable ? (
    <label style={compactFieldLabelStyle}>
      <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Workflow</span>
      <select
        disabled={saving || Boolean(inspectorSnapshot) || inspectorIsInspectionOnly}
        onChange={(event) =>
          setInspectorCurrentActionOutcomeSelection(
            event.target.value as InspectorCurrentActionOutcomeSelection,
          )
        }
        value={inspectorCurrentActionOutcomeSelection}
      >
        <option value="perform">Perform current action</option>
        <option disabled={!inspectorSkipActionOutcomeSelectorAvailable} value="skip">
          Skip this participant
        </option>
        <option disabled={!inspectorBulkStepCompletionAvailable} value="complete_remaining">
          {currentActionPresentation?.taskKind === "modifier_review"
            ? "Accept remaining NPC reviews"
            : currentActionPresentation?.taskKind === "combat_experience"
              ? "Roll remaining GM Combat Experience"
              : currentActionPresentation?.taskKind === "health_review"
                ? "Roll remaining GM Health checks"
                : currentActionPresentation?.taskKind === "observation_roll"
                  ? "Roll remaining GM Observe checks"
                  : currentActionPresentation?.taskKind === "continued_contact_maintenance_roll"
                    ? "Roll remaining GM Continued Contact checks"
                    : currentActionPresentation?.taskKind === "distance_roll"
                      ? "Roll remaining GM distance-control checks"
                      : currentActionPresentation?.taskKind === "submit_declaration"
                        ? "Accept remaining NPC declarations"
                        : "Roll remaining GM initiative"}
        </option>
      </select>
    </label>
  ) : null;
  const inspectorBulkStepLabel =
    currentActionPresentation?.taskKind === "modifier_review"
      ? "Accept remaining NPC reviews"
      : currentActionPresentation?.taskKind === "combat_experience"
        ? "Roll remaining GM Combat Experience"
        : currentActionPresentation?.taskKind === "health_review"
          ? "Roll remaining GM Health checks"
          : currentActionPresentation?.taskKind === "observation_roll"
            ? "Roll remaining GM Observe checks"
            : currentActionPresentation?.taskKind === "continued_contact_maintenance_roll"
              ? "Roll remaining GM Continued Contact checks"
              : currentActionPresentation?.taskKind === "distance_roll"
                ? "Roll remaining GM distance-control checks"
                : currentActionPresentation?.taskKind === "submit_declaration"
                  ? "Accept remaining NPC declarations"
                  : "Roll remaining GM initiative";
  const inspectorWorkflowActionLabel = inspectorSkipActionSelected
    ? `Skip ${getPlayerCombatStepLabel(inspector.step).toLowerCase()} for ${
        inspector.participant?.label ?? "participant"
      }`
    : inspectorBulkStepCompletionSelected
      ? inspectorBulkStepLabel
      : undefined;
  const inspectorWorkflowPresentation =
    currentActionPresentation && inspectorWorkflowActionLabel
      ? {
          ...currentActionPresentation,
          heading: inspectorBulkStepCompletionSelected
            ? currentActionPresentation.taskKind === "modifier_review"
              ? "Modifier review"
              : currentActionPresentation.taskKind === "combat_experience"
                ? "Combat Experience"
                : currentActionPresentation.taskKind === "health_review"
                  ? "Health/Bleed"
                  : currentActionPresentation.taskKind === "observation_roll"
                    ? "Observe Opponent"
                    : currentActionPresentation.taskKind === "continued_contact_maintenance_roll"
                      ? "Continued Contact"
                      : currentActionPresentation.taskKind === "distance_roll"
                        ? "Distance control"
                        : currentActionPresentation.taskKind === "submit_declaration"
                          ? "Declaration"
                          : "Initiative"
            : currentActionPresentation.heading,
          primaryAction: {
            ...currentActionPresentation.primaryAction,
            label: inspectorWorkflowActionLabel,
          },
          requiredNow: inspectorBulkStepCompletionSelected
            ? currentActionPresentation.taskKind === "modifier_review"
              ? "Stops at the first unresolved review."
              : currentActionPresentation.taskKind === "combat_experience"
                ? "Stops before player-owned or attention-required Combat Experience."
                : currentActionPresentation.taskKind === "health_review"
                  ? "Stops before player-owned Health or attention-required effect work."
                  : currentActionPresentation.taskKind === "observation_roll"
                    ? "Stops before player-owned or relationship-review Observe work."
                    : currentActionPresentation.taskKind === "continued_contact_maintenance_roll"
                      ? "Stops before player-owned, relationship-review, or distance work."
                      : currentActionPresentation.taskKind === "distance_roll"
                        ? "Stops before player-owned, incomplete, or GM distance-review work."
                        : currentActionPresentation.taskKind === "submit_declaration"
                          ? "Stops at the first declaration requiring attention."
                          : "Stops before player-owned or attention-required initiative."
            : `${inspectorWorkflowActionLabel}.`,
          summary: inspectorBulkStepCompletionSelected
            ? currentActionPresentation.taskKind === "modifier_review"
              ? "Accept straightforward GM-controlled participant reviews unchanged."
              : currentActionPresentation.taskKind === "combat_experience"
                ? "Roll eligible GM-controlled NPC Combat Experience checks in canonical order."
                : currentActionPresentation.taskKind === "health_review"
                  ? "Roll eligible GM-controlled NPC Health checks in canonical SU order."
                  : currentActionPresentation.taskKind === "observation_roll"
                    ? "Roll exact GM-controlled NPC Observe contests in canonical SU order."
                    : currentActionPresentation.taskKind === "continued_contact_maintenance_roll"
                      ? "Roll exact GM-controlled Continued Contact maintenance sides in canonical order."
                      : currentActionPresentation.taskKind === "distance_roll"
                        ? "Roll exact GM-controlled ordinary distance contests in canonical pair order."
                        : currentActionPresentation.taskKind === "submit_declaration"
                          ? "Accept valid prior-round GM-controlled NPC declarations in canonical order."
                          : "Roll eligible GM-controlled participant initiative in canonical order."
            : currentActionPresentation.summary,
        }
      : currentActionPresentation;
  const inspectorPhaseAttackChoiceControls = inspectorPhaseAttackChoiceSelectorAvailable ? (
    <label style={compactFieldLabelStyle}>
      <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Phase choice</span>
      <select
        disabled={saving || Boolean(inspectorSnapshot)}
        onChange={(event) =>
          setInspectorPhaseAttackChoiceSelection(event.target.value as PhaseAttackChoiceSelection)
        }
        value={inspectorPhaseAttackChoiceSelection}
      >
        <option value="continue">
          {inspectorPhaseCombatExperienceRequirement ? "Continue and roll CE" : "Continue attack"}
        </option>
        <option value="back_out">
          {inspectorPhaseCombatExperienceRequirement
            ? "Back out of attack (-2 DB/Parry penalty)"
            : "Back out of attack (no CE roll)"}
        </option>
      </select>
    </label>
  ) : null;
  const inspectorDoubleAttackDecisionControls = inspectorDoubleAttackDecisionAvailable ? (
    <label style={compactFieldLabelStyle}>
      <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Attack 2</span>
      <select
        disabled={saving || Boolean(inspectorSnapshot)}
        onChange={(event) =>
          setInspectorDoubleAttackDecision(event.target.value as DoubleAttackPhase2Decision)
        }
        value={inspectorDoubleAttackDecision}
      >
        <option value="continue">Continue Attack 2 (-1 OB, -4 DB)</option>
        <option value="cancel">Cancel Attack 2 (phase-2 DB becomes -2)</option>
      </select>
    </label>
  ) : null;
  const inspectorCombatExperienceDifficultyControls =
    inspectorCombatExperienceDifficultyInputVisible ? (
      <label style={compactFieldLabelStyle}>
        <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>CE difficulty</span>
        <input
          disabled={combatExperienceDifficultyControlsDisabled}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
            }
          }}
          onChange={(event) => {
            setCombatExperienceDifficultyDrafts((current) => ({
              ...current,
              [inspectorCombatExperienceDifficultyKey]: event.target.value,
            }));
          }}
          type="number"
          value={inspectorCombatExperienceDifficulty}
        />
      </label>
    ) : null;
  const inspectorRoundEndDistanceControls =
    inspectorRoundEndDistanceAction?.kind === "roll" ? (
      <div style={{ display: "grid", gap: "0.35rem" }}>
        {!inspectorRoundEndTask && inspectorRoundEndDistanceRollOptions.length > 1 ? (
          <label style={compactFieldLabelStyle}>
            <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Distance roll</span>
            <select
              disabled={saving || Boolean(inspectorSnapshot)}
              onChange={(event) => setRoundEndDistanceRollSelectionKey(event.target.value)}
              value={resolvedRoundEndDistanceRollSelectionKey}
            >
              {inspectorRoundEndDistanceRollOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.participantLabel} · {option.pairLabel}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
          Distance control: {inspectorRoundEndDistanceAction.option.pairLabel}
        </div>
      </div>
    ) : inspectorRoundEndDistanceAction?.kind === "commit" ? (
      <div style={{ display: "grid", gap: "0.35rem" }}>
        {!inspectorRoundEndTask && inspectorRoundEndDistanceCommitOptions.length > 1 ? (
          <label style={compactFieldLabelStyle}>
            <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Distance pair</span>
            <select
              disabled={saving || Boolean(inspectorSnapshot)}
              onChange={(event) => setRoundEndDistanceCommitProposalId(event.target.value)}
              value={resolvedRoundEndDistanceCommitProposalId}
            >
              {inspectorRoundEndDistanceCommitOptions.map((proposal) => (
                <option key={proposal.id} value={proposal.id}>
                  {buildRoundEndDistancePairLabel(proposal, roundParticipantLabelsById)} · proposal{" "}
                  {proposal.proposedDistance ?? "pending"}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
            Distance control:{" "}
            {buildRoundEndDistancePairLabel(
              inspectorRoundEndDistanceAction.proposal,
              roundParticipantLabelsById,
            )}
          </div>
        )}
        <label style={compactFieldLabelStyle}>
          <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>
            {inspectorRoundEndDistanceAction.proposal.controlMode === "continued_contact"
              ? "Engagement distance"
              : "GM override"}
          </span>
          <select
            disabled={saving || Boolean(inspectorSnapshot)}
            onChange={(event) =>
              setRoundEndDistanceOverrideDrafts((current) => ({
                ...current,
                [inspectorRoundEndDistanceAction.proposal.id]: event.target.value,
              }))
            }
            value={
              roundEndDistanceOverrideDrafts[inspectorRoundEndDistanceAction.proposal.id] ?? ""
            }
          >
            <option value="">
              {inspectorRoundEndDistanceAction.proposal.controlMode === "continued_contact"
                ? "Choose distance"
                : "Use proposal"}
            </option>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((distance) => (
              <option key={distance} value={distance}>
                Distance {distance}
              </option>
            ))}
          </select>
        </label>
      </div>
    ) : null;
  const inspectorFeintControls = inspectorFeintProposal ? (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <strong>Feint</strong>
      <div>
        {
          selectedTimelineRoundState.participants.find(
            (participant) =>
              participant.participantId === inspectorFeintProposal.attackerParticipantId,
          )?.label
        }{" "}
        against{" "}
        {
          selectedTimelineRoundState.participants.find(
            (participant) =>
              participant.participantId === inspectorFeintProposal.defenderParticipantId,
          )?.label
        }{" "}
        · {inspectorFeintProposal.method === "movement" ? "Movement" : "Weapon"}
      </div>
      {inspectorFeintProposal.description ? <div>{inspectorFeintProposal.description}</div> : null}
      {inspectorFeintProposal.status === "awaiting_review" && inspectorFeintProposal.review ? (
        <>
          <div>
            Opposed result: {inspectorFeintProposal.attackerRoll?.finalTotal} vs{" "}
            {inspectorFeintProposal.defenderRoll?.finalTotal} · difference{" "}
            {inspectorFeintProposal.difference}
          </div>
          {[inspectorFeintAttackerCalculation, inspectorFeintDefenderCalculation].map(
            (calculation) =>
              calculation ? (
                <details key={calculation.calculationId} open>
                  <summary style={{ fontWeight: 700 }}>{calculation.label}</summary>
                  <div style={{ display: "grid", gap: "0.15rem", paddingTop: "0.25rem" }}>
                    {buildCombatCalculationPresentationLines(calculation).map((line, index) => (
                      <div key={`${calculation.calculationId}:line:${index}`}>{line}</div>
                    ))}
                  </div>
                </details>
              ) : null,
          )}
          {inspectorFeintProposal.tableResult ? (
            <div>Table band: {inspectorFeintProposal.tableResult.band.replaceAll("_", " ")}</div>
          ) : null}
          <table style={{ borderCollapse: "collapse", fontSize: "0.82rem", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Difference</th>
                <th style={{ textAlign: "right" }}>Defender P2 OB/DB</th>
                <th style={{ textAlign: "right" }}>Attacker P1 DB/Parry</th>
              </tr>
            </thead>
            <tbody>
              {COMBAT_FEINT_OUTCOME_TABLE.map((row) => {
                const selected = inspectorFeintProposal.tableResult?.band === row.band;
                return (
                  <tr
                    key={row.band}
                    style={selected ? { background: "#f3ead2", fontWeight: 700 } : undefined}
                  >
                    <td>{row.differenceLabel}</td>
                    <td style={{ textAlign: "right" }}>
                      {row.defenderPhase2ObDbModifier >= 0 ? "+" : ""}
                      {row.defenderPhase2ObDbModifier}%
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {row.attackerPhase1DbParryModifier >= 0 ? "+" : ""}
                      {row.attackerPhase1DbParryModifier}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <label style={compactFieldLabelStyle}>
            <span>Attacker DB/Parry · Phase 1</span>
            <input
              disabled={saving}
              onChange={(event) => setInspectorFeintAttackerModifier(event.target.value)}
              type="number"
              value={inspectorFeintAttackerModifier}
            />
          </label>
          <label style={compactFieldLabelStyle}>
            <span>Defender Skill/OB · Phase 2</span>
            <input
              disabled={saving}
              onChange={(event) => setInspectorFeintDefenderObModifier(event.target.value)}
              type="number"
              value={inspectorFeintDefenderObModifier}
            />
          </label>
          <label style={compactFieldLabelStyle}>
            <span>Defender DB/Parry · Phase 2</span>
            <input
              disabled={saving}
              onChange={(event) => setInspectorFeintDefenderDbModifier(event.target.value)}
              type="number"
              value={inspectorFeintDefenderDbModifier}
            />
          </label>
        </>
      ) : null}
      {inspectorFeintProposal.status === "awaiting_review" ? (
        <label style={compactFieldLabelStyle}>
          <span>Combat note</span>
          <input
            disabled={saving}
            onChange={(event) => setInspectorFeintNote(event.target.value)}
            value={inspectorFeintNote}
          />
        </label>
      ) : null}
    </div>
  ) : null;
  const inspectorAdjustDistanceControls = inspectorAdjustDistanceProposal ? (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <strong>Adjustment maneuver</strong>
      <div>
        Distance {inspectorAdjustDistanceProposal.currentDistance} →{" "}
        {inspectorAdjustDistanceProposal.requestedDistance} ·{" "}
        {inspectorAdjustDistanceProposal.direction}
      </div>
      {inspectorAdjustDistanceProposal.status === "awaiting_defender_response" ? (
        <label style={compactFieldLabelStyle}>
          <span>Defender response</span>
          <select
            disabled={saving}
            onChange={(event) =>
              setInspectorAdjustDistanceResponse(event.target.value as "allow" | "oppose")
            }
            value={inspectorAdjustDistanceResponse}
          >
            <option value="oppose">Oppose</option>
            <option value="allow">Allow adjustment</option>
          </select>
        </label>
      ) : null}
      {inspectorAdjustDistanceProposal.status === "awaiting_gm_adjustment" ? (
        <AdjustDistanceAdjustmentEditor
          ref={inspectorAdjustDistanceAdjustmentDraftRef}
          attackerParticipantId={inspectorAdjustDistanceProposal.attackerParticipantId}
          defenderParticipantId={inspectorAdjustDistanceProposal.defenderParticipantId}
          proposalId={inspectorAdjustDistanceProposal.id}
          savedAdjustment={inspectorAdjustDistanceProposal.gmRollAdjustment}
          saving={saving}
        />
      ) : null}
      {inspectorAdjustDistanceProposal.status === "awaiting_review" ? (
        <>
          {inspectorAdjustDistanceReview ? (
            <div style={{ display: "grid", gap: "0.25rem" }}>
              <div>
                <strong>Actor:</strong> {inspectorAdjustDistanceReview.actor.label}
              </div>
              <div>
                <strong>Target:</strong> {inspectorAdjustDistanceReview.target.label}
              </div>
              <div>
                <strong>Requested movement:</strong> distance{" "}
                {inspectorAdjustDistanceReview.currentDistance} →{" "}
                {inspectorAdjustDistanceReview.requestedDistance}
              </div>
              <div>{inspectorAdjustDistanceReview.outcome}</div>
              {inspectorAdjustDistanceReview.winner && inspectorAdjustDistanceReview.loser ? (
                <div>
                  Winner: {inspectorAdjustDistanceReview.winner.label} · Loser:{" "}
                  {inspectorAdjustDistanceReview.loser.label}
                </div>
              ) : null}
              <div>
                <strong>Proposed result:</strong> distance{" "}
                {inspectorAdjustDistanceReview.proposedDistance}
              </div>
              <table style={{ borderCollapse: "collapse", fontSize: "0.82rem", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Contest result</th>
                    <th style={{ textAlign: "left" }}>Standard outcome</th>
                    <th style={{ textAlign: "left" }}>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectorAdjustDistanceReview.tableRows.map((row) => {
                    const selected = row.id === inspectorAdjustDistanceReview.applicableTableRowId;
                    return (
                      <tr
                        key={row.id}
                        style={selected ? { background: "#f3ead2", fontWeight: 700 } : undefined}
                      >
                        <td>{row.rollCondition}</td>
                        <td>{row.outcome}</td>
                        <td>{row.result}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {inspectorAdjustDistanceProposal.defenderResponse === "oppose" ? (
            <div>
              Dodge: {inspectorAdjustDistanceProposal.attackerRoll?.finalTotal} vs{" "}
              {inspectorAdjustDistanceProposal.defenderRoll?.finalTotal}
            </div>
          ) : null}
          <div>
            Standard proposal: distance {inspectorAdjustDistanceProposal.standardProposedDistance}
          </div>
          {[
            inspectorAdjustDistanceAttackerCalculation,
            inspectorAdjustDistanceDefenderCalculation,
          ].map((calculation) =>
            calculation ? (
              <details key={calculation.calculationId} open>
                <summary style={{ fontWeight: 700 }}>{calculation.label}</summary>
                <div style={{ display: "grid", gap: "0.15rem", paddingTop: "0.25rem" }}>
                  {buildCombatCalculationPresentationLines(calculation).map((line, index) => (
                    <div key={`${calculation.calculationId}:line:${index}`}>{line}</div>
                  ))}
                </div>
              </details>
            ) : null,
          )}
          <label style={compactFieldLabelStyle}>
            <span>Accepted outcome</span>
            <select
              disabled={saving}
              onChange={(event) =>
                setInspectorAdjustDistanceOutcome(
                  event.target.value as "successful" | "unsuccessful" | "allowed",
                )
              }
              value={inspectorAdjustDistanceOutcome}
            >
              <option value="successful">Successful</option>
              <option value="unsuccessful">Unsuccessful</option>
              {inspectorAdjustDistanceProposal.defenderResponse === "allow" ? (
                <option value="allowed">Allowed</option>
              ) : null}
            </select>
          </label>
          <label style={compactFieldLabelStyle}>
            <span>Committed distance</span>
            <select
              disabled={saving}
              onChange={(event) => setInspectorAdjustDistanceCommittedDistance(event.target.value)}
              value={inspectorAdjustDistanceCommittedDistance}
            >
              {inspectorAdjustDistanceReview?.legalDistances.map((distance) => (
                <option key={distance} value={distance}>
                  {distance}
                </option>
              ))}
            </select>
          </label>
          <label style={compactFieldLabelStyle}>
            <span>Combat note</span>
            <input
              disabled={saving}
              onChange={(event) => setInspectorAdjustDistanceReviewNote(event.target.value)}
              value={inspectorAdjustDistanceReviewNote}
            />
          </label>
        </>
      ) : null}
    </div>
  ) : null;
  const inspectorStepWorkflowStatus = stepWorkflowStatusPresentation ? (
    <section
      aria-label="Workflow status"
      style={{
        background: "#f5f2e9",
        border: "1px solid #ddd6c5",
        borderRadius: 6,
        display: "grid",
        gap: "0.2rem",
        padding: "0.45rem 0.55rem",
      }}
    >
      <strong style={{ fontSize: "0.88rem" }}>Workflow</strong>
      <span>{stepWorkflowStatusPresentation.operationLabel}</span>
      <span>{stepWorkflowStatusPresentation.processedSummary}</span>
      {stepWorkflowStatusPresentation.completion ? (
        <span>{stepWorkflowStatusPresentation.completion}</span>
      ) : null}
      {stepWorkflowStatusPresentation.stopMessage ? (
        <span>
          {stepWorkflowStatusPresentation.stopParticipantLabel
            ? `Stopped at ${stepWorkflowStatusPresentation.stopParticipantLabel}. `
            : ""}
          {stepWorkflowStatusPresentation.stopMessage}
        </span>
      ) : null}
    </section>
  ) : null;
  const inspectorDeclarationProposal = currentDeclarationProposalPresentation ? (
    <section
      aria-label="Previous declaration proposal"
      style={{
        background: "#f8f6ef",
        border: "1px solid #e2dccd",
        borderRadius: 6,
        display: "grid",
        gap: "0.15rem",
        padding: "0.4rem 0.5rem",
      }}
    >
      <strong style={{ fontSize: "0.88rem" }}>
        {currentDeclarationProposalPresentation.sourceLabel}
      </strong>
      <span>{currentDeclarationProposalPresentation.summary}</span>
      {currentDeclarationProposalPresentation.reason ? (
        <span style={{ color: "#7a3f26", fontSize: "0.88rem" }}>
          Needs review: {currentDeclarationProposalPresentation.reason}
        </span>
      ) : null}
    </section>
  ) : null;
  const inspectorPreActionControls =
    inspectorCurrentActionOutcomeControls ||
    inspectorCombatExperienceDifficultyControls ||
    inspectorFeintControls ||
    inspectorAdjustDistanceControls ||
    inspectorDoubleAttackDecisionControls ||
    inspectorPhaseAttackChoiceControls ||
    inspectorRoundEndDistanceControls ||
    inspectorDeclarationProposal ||
    inspectorStepWorkflowStatus ? (
      <>
        {inspectorStepWorkflowStatus}
        {inspectorDeclarationProposal}
        {inspectorCurrentActionOutcomeControls}
        {inspectorCombatExperienceDifficultyControls}
        {inspectorFeintControls}
        {inspectorAdjustDistanceControls}
        {inspectorDoubleAttackDecisionControls}
        {inspectorPhaseAttackChoiceControls}
        {inspectorRoundEndDistanceControls}
      </>
    ) : null;
  const inspectorPhaseCombatExperienceThreats =
    inspectorPhaseCombatExperienceRequirement?.threats ??
    inspectorPhaseAttackBackOutOpportunity?.threats ??
    [];
  const inspectorPhaseCombatExperienceRollRequired =
    inspectorPhaseAttackBackOutOpportunity?.ceRequired ??
    Boolean(inspectorPhaseCombatExperienceRequirement);
  const showInspectorPhaseCombatExperienceContextPanel = Boolean(
    inspectorPhaseCombatExperienceRequirement ||
    inspectorPhaseAttackBackOutOpportunity ||
    inspectorPhaseInitiativeChoice,
  );
  const showInspectorInitiativeContextPanel =
    !inspectorIsHistorical &&
    !showInspectorPhaseCombatExperienceContextPanel &&
    inspectorCurrentStepIsInitiative;
  const showInspectorModifierReviewContextPanel =
    !inspectorIsHistorical &&
    !showInspectorInitiativeContextPanel &&
    !showInspectorPhaseCombatExperienceContextPanel &&
    (inspector.step === "review_action_modifiers" || inspector.step === "review_phase_2_modifiers");
  const showInspectorCombatStartExperienceContextPanel =
    !inspectorIsHistorical &&
    !showInspectorInitiativeContextPanel &&
    !showInspectorPhaseCombatExperienceContextPanel &&
    !showInspectorModifierReviewContextPanel &&
    inspectorCombatExperienceRequired &&
    inspectorCombatExperienceIsCombatStart;
  const inspectorCanonicalActionResultEvents =
    activeInspectorCore?.canonicalActionResultEvents ??
    archivedInspectorPresentation?.canonicalActionResultEvents ??
    measureCombatPerformanceStage(
      "panel_current_event_result_selection",
      () =>
        projectGmCombatEvents({
          events: selectCombatEventsForTrackerCell({
            events: selectedTimelineRoundState.events,
            participantId: inspector.participant?.participantId,
            retainLatestWhenEmpty: false,
            step: inspector.step,
          }),
          participants: selectedTimelineRoundState.participants,
        }),
      { historical: inspectorIsHistorical },
    );
  const inspectorHasCanonicalActionResult = inspectorCanonicalActionResultEvents.length > 0;
  const inspectorShowsLegacyResultFallback = Boolean(
    inspectorIsHistorical &&
    !inspectorHistoricalStepOutcome &&
    inspectorSnapshot &&
    (inspectorSnapshot.actionResultStatus === "recorded" ||
      inspectorSnapshot.attackResult ||
      ((inspector.step === "initiative_phase_1" || inspector.step === "initiative_phase_2") &&
        inspectorSnapshot.initiativeResult) ||
      inspectorSnapshot.actionResultSummary),
  );
  const inspectorHistoricalActionResult = archivedInspectorPresentation
    ? archivedInspectorPresentation.historicalActionResult
    : measureCombatPerformanceStage("panel_historical_attack_parry_result_presentation", () =>
        inspectorIsHistorical
          ? inspectorHistoricalStepOutcome
            ? { interpretedResult: inspectorHistoricalStepOutcome.message }
            : buildHistoricalCombatActionResult({
                participantId: inspector.participant?.participantId,
                snapshot: inspectorSnapshot,
                step: inspector.step,
              })
          : undefined,
      );
  const inspectorCurrentStepStatus = inspector.participant?.stepStatuses[inspector.step];
  const inspectorHistoricalStatusLabel =
    archivedInspectorPresentation?.historicalStatusLabel ??
    (inspectorHistoricalStepOutcome
      ? inspectorHistoricalStepOutcome.category === "not_required"
        ? "Not required"
        : inspectorHistoricalStepOutcome.category === "not_applicable"
          ? "Not applicable"
          : "Skipped"
      : undefined);
  const inspectorParticipantHasDeclared = Boolean(selectedRoundDeclaration);
  const inspectorStatusSuffix = inspectorSnapshot
    ? " Committed."
    : inspectorCombatExperienceDifficultyStartPending
      ? " Waiting for GM to start CE."
      : inspectorPhaseResolutionCursor
        ? ` Current actor: ${inspectorCursorActorLabel ?? inspectorPhaseResolutionCursor.participantId}${inspectorCursorDefenderLabel ? ` · Defender: ${inspectorCursorDefenderLabel}` : ""} · Next: ${formatCombatResolutionNextLabel(
            {
              hasPhaseAttack: combatRoundParticipantHasPhaseAttack({
                participantId:
                  inspectorCursorIncomingAttackResult?.attackerParticipantId ??
                  inspectorPhaseResolutionCursor.participantId,
                phase: inspectorPhaseResolutionCursor.phase,
                state: selectedTimelineRoundState,
              }),
              phase: inspectorPhaseResolutionCursor.phase,
              substep: inspectorPhaseResolutionCursor.substep,
            },
          )}.${inspectorIsCursorParticipant ? "" : " Selected actor differs from current cursor."}`
        : inspectorDisplayPhaseResolutionResult
          ? " Resolution review pending."
          : inspectorDisplayAttackResult
            ? " Attack rolled."
            : inspectorCurrentInitiative
              ? " Initiative rolled."
              : inspector.step === "review_action_modifiers" ||
                  inspector.step === "review_phase_2_modifiers"
                ? inspectorCurrentStepStatus === "complete" ||
                  inspectorCurrentStepStatus === "gmEdited"
                  ? " Reviewed."
                  : ""
                : inspectorParticipantHasDeclared
                  ? " Declared."
                  : "";
  const inspectorPhaseCards = useMemo<readonly PlayerCombatPhaseCardView[]>(() => {
    if (!inspector.participant) {
      return [];
    }

    return [
      {
        description: "",
        phaseLabel: "Phase 1",
        stats: [],
        title: "",
      },
      {
        description: "",
        phaseLabel: "Phase 2",
        stats: [],
        title: "",
      },
    ];
  }, [inspector.participant]);
  const inspectorInitiativeCalculation = selectedRoundIsActive
    ? combatPresentation.active.inspectorPresentation.resolve({
        build: () =>
          buildEncounterInitiativeModifierCalculation({
            baseInitiative: inspectorLoadoutSummary.passiveInitiative,
            combatContext: inspectorGeneratedCombatContext,
            phaseKey: inspectorModifierPhase,
          }),
        dependencies: [
          inspectorLoadoutSummary.passiveInitiative,
          inspectorGeneratedCombatContext,
          inspectorModifierPhase,
        ],
        key: `initiative-calculation:${inspector.participant?.participantId ?? "none"}:${inspectorModifierPhase ?? "none"}`,
      })
    : buildEncounterInitiativeModifierCalculation({
        baseInitiative: inspectorLoadoutSummary.passiveInitiative,
        combatContext: inspectorGeneratedCombatContext,
        phaseKey: inspectorModifierPhase,
      });
  useEffect(() => {
    const encounterChanged = encounterScopeRef.current !== encounter.id;

    if (!acceptCanonicalEncounterState(encounter, initialRoundState)) {
      return;
    }

    if (encounterChanged) {
      encounterScopeRef.current = encounter.id;
      setRecentResultFocus(undefined);
      setRecentResultRequest(undefined);
      setStepWorkflowStatus(undefined);
      setStepWorkflowDeclarationProposal(undefined);
      manualSelectionRef.current = undefined;
      pendingSelectionRef.current = undefined;
      setSelectedRoundNumber(initialRoundState.roundNumber);
      setDamageReviewDrafts({});
      setInspectorDrafts({});
      setInspectorModifierEditedDraftKeys({});
      modifierReviewInputSnapshotsRef.current.clear();
      setParrySourceSelections({});
      setSaveError(undefined);
      setScenarioParticipantOverrides({});
    }

    const pendingSelection = encounterChanged ? undefined : pendingSelectionRef.current;
    const manualSelection = encounterChanged ? undefined : manualSelectionRef.current;
    const currentTaskSelection =
      !pendingSelection && !manualSelection
        ? getCurrentCombatRoundTaskSelection(initialRoundState)
        : undefined;
    const nextInspectionSelection = resolveCombatRoundInspectionSelection({
      manualSelection: manualSelection ?? currentTaskSelection,
      pendingSelection,
      state: initialRoundState,
    });

    if (pendingSelection) {
      pendingSelectionRef.current = undefined;
    }

    setSelectedRoundNumber((currentRoundNumber) =>
      currentTaskSelection
        ? initialRoundState.roundNumber
        : getCombatRoundTimelineRoundStates(initialRoundState).some(
              (round) => round.roundNumber === currentRoundNumber,
            )
          ? currentRoundNumber
          : initialRoundState.roundNumber,
    );

    if (
      manualSelection &&
      !initialRoundState.participants.some(
        (participant) => participant.participantId === manualSelection.participantId,
      )
    ) {
      manualSelectionRef.current = undefined;
    }

    setInspectionSelection(nextInspectionSelection);

    if (currentTaskSelection?.participantId) {
      scrollTimelineCellIntoView(
        {
          participantId: currentTaskSelection.participantId,
          roundNumber: initialRoundState.roundNumber,
          step: currentTaskSelection.step,
        },
        "center",
      );
    }
  }, [acceptCanonicalEncounterState, encounter, initialRoundState]);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      try {
        const nextContent = await loadCanonicalContent();

        if (!cancelled) {
          setContent(nextContent);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setSaveError(
            caughtError instanceof Error ? caughtError.message : "Unable to load combat content.",
          );
        }
      }
    }

    void loadContent();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const participantId = selectedScenarioParticipant?.id;
    const characterId = selectedScenarioParticipant?.characterId;

    if (!participantId || !characterId || resolvedCharacterStateByParticipantId[participantId]) {
      return;
    }

    const stableParticipantId = participantId;
    const stableCharacterId = characterId;
    let cancelled = false;

    async function hydrateInspectorCharacterState() {
      try {
        const [serverRecord, equipmentState] = await Promise.all([
          loadServerCharacterById(stableCharacterId),
          loadCharacterEquipmentState(stableCharacterId),
        ]);

        if (cancelled) {
          return;
        }

        setResolvedCharacterStateByParticipantId((current) => ({
          ...current,
          [stableParticipantId]: {
            equipmentState,
            serverRecord,
          },
        }));
      } catch (caughtError) {
        if (!cancelled) {
          setSaveError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load inspector combat loadout.",
          );
        }
      }
    }

    void hydrateInspectorCharacterState();

    return () => {
      cancelled = true;
    };
  }, [
    resolvedCharacterStateByParticipantId,
    selectedScenarioParticipant?.characterId,
    selectedScenarioParticipant?.id,
  ]);

  function scrollTimelineCellIntoView(
    selection: CombatRoundTimelineSelection,
    mode: CombatRoundTimelineScrollMode = "nearest",
  ) {
    window.requestAnimationFrame(() => {
      scrollCombatRoundTimelineCellIntoView({
        cell: timelineCellRefs.current[getCombatRoundTimelineCellKey(selection)],
        container: tableContainerRef.current,
        mode,
        padding: 96,
      });
    });
  }

  function focusRoundTable(
    input: {
      scrollIntoView?: boolean;
      scrollToCurrent?: boolean;
      state?: CombatRoundState;
    } = {},
  ) {
    if (input.scrollIntoView !== false && input.scrollToCurrent !== true) {
      tableContainerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    tableContainerRef.current?.focus({ preventScroll: true });

    if (input.scrollToCurrent) {
      setTrackerPositionRequest((current) => current + 1);
    }
  }

  function buildScenarioParticipantPhaseSummary(input: {
    declaration?: CombatRoundDeclaration;
    opponentCombatantId?: string;
    phaseKey?: PlayerCombatPhaseKey;
    scenarioParticipant?: ScenarioParticipant;
  }): {
    armorCoverage: CombatRoundDamageArmorCoverage;
    attackModeLabel?: string;
    attackStats: ReturnType<typeof buildPlayerCombatLoadoutSummary>["attackStats"];
    baseDefenseStats: ReturnType<typeof buildPlayerCombatDefenseStats>;
    defenseStats: ReturnType<typeof buildPlayerCombatDefenseStats>;
    strengthGm?: number;
    liveModifiers: ReturnType<typeof buildEncounterLiveCombatModifierSummary>;
    mainHandParryItemLabel?: string;
    modifierRows: ReturnType<typeof buildPlayerCombatModifierRows>;
    offHandParryItemLabel?: string;
    parrySources: CombatParrySourceOptions;
    phaseContext?: ScenarioParticipantCombatContext;
  } {
    const draft = buildDeclarationDraft(input.scenarioParticipant, input.declaration, {
      encounterId: encounter.id,
      roundNumber: selectedRoundNumber,
    });
    const encounterParticipant = encounter.participants.find(
      (participant) =>
        participant.scenarioParticipantId === input.scenarioParticipant?.id ||
        participant.id === input.scenarioParticipant?.id,
    );
    const liveModifiers = buildTargetAwareEncounterLiveCombatModifierSummary({
      combatContext: draft.combatContext,
      combatEffects: input.scenarioParticipant?.state.combatEffects,
      context: resolveEncounterLiveCombatModifierContext({
        actionId: draft.actionId || undefined,
        encounterId: encounter.id,
        ownerCombatantId: encounterParticipant?.id,
        ownerParticipantId: input.scenarioParticipant?.id,
        participants: encounter.participants,
        phaseKey: input.phaseKey,
        relationships: selectedTimelineRoundState.observationRelationships,
        roundNumber: selectedRoundNumber,
        step: selectedTimelineRoundState.currentStep,
        targetParticipantId: input.phaseKey
          ? (input.opponentCombatantId ??
            draft.secondaryActionContext?.targetParticipantId ??
            draft.phaseContexts[input.phaseKey].targetParticipantId)
          : undefined,
      }),
    });
    const modifierRows = buildPlayerCombatModifierRows({
      combatContext: draft.combatContext,
      combatEffects: input.scenarioParticipant?.state.combatEffects,
      currentRound: selectedRoundNumber,
      encounterId: encounter.id,
      liveModifiers,
      ownerParticipantId: input.scenarioParticipant?.id,
      phaseKey: input.phaseKey,
    });
    const resolvedCharacterState = input.scenarioParticipant
      ? resolvedCharacterStateByParticipantId[input.scenarioParticipant.id]
      : undefined;
    const buildResult = characterBuildSchema.safeParse(
      resolvedCharacterState?.serverRecord.build ?? input.scenarioParticipant?.snapshot.build,
    );
    const characterCombatInputs =
      content && buildResult.success
        ? buildCombatStateCharacterInputs(
            buildCharacterSheetSummary({
              build: buildResult.data,
              content,
            }),
          )
        : undefined;
    const equipmentState = resolveScenarioCombatEquipmentState({
      resolvedEquipmentState: resolvedCharacterState?.equipmentState,
      scenarioEquipmentState: input.scenarioParticipant?.snapshot.equipmentState,
    });
    const equipmentCharacterId =
      resolveCombatEquipmentCharacterId({
        characterId: input.scenarioParticipant?.characterId,
        state: equipmentState,
      }) ?? "";
    const loadoutModel = buildEquipmentLoadoutModuleModel({
      characterContext:
        content && buildResult.success
          ? {
              content,
              record: {
                build: buildResult.data,
              },
            }
          : null,
      characterId: equipmentCharacterId,
      liveCombatModifiers: liveModifiers,
      state: equipmentState,
      throwingWeaponItemId: null,
    });
    const baseLoadoutModel = buildEquipmentLoadoutModuleModel({
      characterContext:
        content && buildResult.success
          ? {
              content,
              record: {
                build: buildResult.data,
              },
            }
          : null,
      characterId: equipmentCharacterId,
      state: equipmentState,
      throwingWeaponItemId: null,
    });
    const loadoutSummary = buildPlayerCombatLoadoutSummary({
      actionId: draft.actionId,
      loadoutModel,
      phaseKey: input.phaseKey,
      selectedAttackModeId: input.phaseKey
        ? draft.phaseContexts[input.phaseKey].attackModeId
        : undefined,
      secondaryActionId: draft.secondaryActionId,
    });
    const baseLoadoutSummary = buildPlayerCombatLoadoutSummary({
      actionId: draft.actionId,
      loadoutModel: baseLoadoutModel,
      phaseKey: input.phaseKey,
      selectedAttackModeId: input.phaseKey
        ? draft.phaseContexts[input.phaseKey].attackModeId
        : undefined,
      secondaryActionId: draft.secondaryActionId,
    });
    const parrySources = buildCombatParrySourceOptions({
      loadoutModel: baseLoadoutModel,
      mainHandLabel: baseLoadoutSummary.mainHandParryItemLabel,
      offHandLabel: baseLoadoutSummary.offHandParryItemLabel,
    });
    const phaseContext = input.phaseKey ? draft.phaseContexts[input.phaseKey] : undefined;
    const baseDefenseStats = phaseContext
      ? buildPlayerCombatDefenseStats({
          mainHandParryItemLabel: baseLoadoutSummary.mainHandParryItemLabel,
          offHandParryItemLabel: baseLoadoutSummary.offHandParryItemLabel,
          phaseContext,
          reference: baseLoadoutSummary.reference,
        })
      : null;
    const defenseStats = phaseContext
      ? buildPlayerCombatDefenseStats({
          mainHandParryItemLabel: loadoutSummary.mainHandParryItemLabel,
          offHandParryItemLabel: loadoutSummary.offHandParryItemLabel,
          phaseContext,
          reference: loadoutSummary.reference,
        })
      : null;

    return {
      armorCoverage: buildCombatRoundDamageArmorCoverageFromEquipmentState({
        characterId: input.scenarioParticipant?.characterId,
        equipmentState,
      }),
      attackModeLabel: loadoutSummary.attackModeOptions.find(
        (mode) => mode.id === loadoutSummary.selectedAttackModeId,
      )?.label,
      attackStats: loadoutSummary.attackStats,
      baseDefenseStats,
      defenseStats,
      strengthGm: characterCombatInputs?.strengthGm ?? undefined,
      liveModifiers,
      mainHandParryItemLabel: baseLoadoutSummary.mainHandParryItemLabel,
      modifierRows,
      offHandParryItemLabel: baseLoadoutSummary.offHandParryItemLabel,
      parrySources,
      phaseContext,
    };
  }

  function buildCombatRoundStepSnapshots(
    committedAt: string,
    stateForSnapshots = roundState,
  ): CombatRoundStepSnapshot[] {
    const step = stateForSnapshots.currentStep;
    const phase = getCombatRoundModifierPhaseForStep(step);
    const attackPhase = getCombatAttackPhaseForStep(step);
    const resolutionStepKind = getCombatResolutionStepKind(step);
    const ranks = phase ? getCombatRoundInitiativeRanks({ phase, state: stateForSnapshots }) : {};

    return stateForSnapshots.participants.map((roundParticipant) => {
      const encounterParticipant = encounter.participants.find(
        (participant) => participant.id === roundParticipant.participantId,
      );
      const scenarioParticipant = encounterParticipant
        ? findScenarioParticipantForEncounterParticipant({
            encounterParticipant,
            scenarioParticipants: effectiveScenarioParticipants,
          })
        : undefined;
      const declaration = hasCombatRoundDeclarationAction(roundParticipant.declaration)
        ? roundParticipant.declaration
        : undefined;
      const draft = buildDeclarationDraft(scenarioParticipant, declaration, {
        encounterId: encounter.id,
        roundNumber: stateForSnapshots.roundNumber,
      });
      const phaseSummaries = {
        phase1: buildScenarioParticipantPhaseSummary({
          declaration,
          phaseKey: "phase1",
          scenarioParticipant,
        }),
        phase2: buildScenarioParticipantPhaseSummary({
          declaration,
          phaseKey: "phase2",
          scenarioParticipant,
        }),
      };
      const phaseSummary = buildScenarioParticipantPhaseSummary({
        declaration,
        phaseKey: phase,
        scenarioParticipant,
      });
      // Snapshot rows describe everything recorded at this point in the round.
      // Phase filtering belongs to calculation totals, not historical visibility.
      const recordedModifierRows = buildRecordedCombatModifierRows({
        combatContext: draft.combatContext,
        combatEffects: scenarioParticipant?.state.combatEffects,
        currentRound: stateForSnapshots.roundNumber,
        liveModifiers: phaseSummary.liveModifiers,
        step,
      });
      const modifierRows = recordedModifierRows.map((row) => ({
        bucketKey: row.bucketKey,
        entries: row.entries,
        label: row.label,
        total: row.total,
      }));
      const modifierOwnerIds = new Set(
        [roundParticipant.participantId, scenarioParticipant?.id].filter((id): id is string =>
          Boolean(id),
        ),
      );
      const modifierEffects = [
        ...collectCanonicalCombatSituationEffects({
          combatEffects: scenarioParticipant?.state.combatEffects?.effects,
          continuedContacts: stateForSnapshots.continuedContacts,
          unbalancedConditions: stateForSnapshots.unbalancedConditions,
        }),
        ...recordedModifierRows.flatMap((row) => [
          ...row.entries.flatMap((entry) => {
            const effect = canonicalCombatModifierEffectSchema.safeParse(entry.canonicalLifecycle);
            return effect.success ? [effect.data] : [];
          }),
          ...(row.derivedEntries ?? []).flatMap((entry) =>
            entry.canonicalLifecycle && "createdAt" in entry.canonicalLifecycle
              ? [entry.canonicalLifecycle]
              : [],
          ),
        ]),
      ].filter((effect) => modifierOwnerIds.has(effect.ownerParticipantId));
      const uniqueModifierEffects = [
        ...new Map(modifierEffects.map((effect) => [effect.id, effect])).values(),
      ];
      const phaseContext = phaseSummary.phaseContext;
      const targetOptions = buildCombatParticipantCandidates({
        encounter:
          encounter.participants.length > 0
            ? encounter
            : {
                participants: effectiveScenarioParticipants
                  .filter((participant) => participant.isActive)
                  .map((participant) => ({
                    characterId: participant.characterId,
                    id: participant.id,
                    label: participant.snapshot.displayName,
                    scenarioParticipantId: participant.id,
                  })),
              },
        activeParticipantIds: new Set(
          effectiveScenarioParticipants
            .filter((participant) => participant.isActive)
            .map((participant) => participant.id),
        ),
        actingParticipantId: scenarioParticipant?.id,
        allowedParticipantIds:
          encounterScenarioParticipantIds.length > 0
            ? encounterScenarioParticipantIds
            : effectiveScenarioParticipants
                .filter((participant) => participant.isActive)
                .map((participant) => participant.id),
        purpose:
          draft.actionId === "feint_attack" || draft.actionId === "adjust_range_attack"
            ? "maneuver_target"
            : "attack_target",
      })
        .filter((candidate) => candidate.selectable)
        .map(({ displayName, participantId }) => ({ displayName, id: participantId }));
      const buildPhasePanelSnapshot = (phaseKey: PlayerCombatPhaseKey) => {
        const summary = phaseSummaries[phaseKey];
        const context = summary.phaseContext ?? draft.phaseContexts[phaseKey];
        const model = buildPlayerCombatPhasePanelModel({
          actionId: draft.actionId,
          attackStats: summary.attackStats,
          defenseStats: summary.defenseStats,
          phaseCard: {
            description: "",
            phaseLabel: phaseKey === "phase1" ? "Phase 1" : "Phase 2",
            stats: [],
            title: "",
          },
          phaseContext: context,
          phaseKey,
          secondaryActionId: draft.secondaryActionId,
        });
        const targetScenarioParticipant = effectiveScenarioParticipants.find(
          (participant) => participant.id === context.targetParticipantId,
        );
        const targetEncounterParticipant = context.targetParticipantId
          ? findEncounterParticipantForScenarioParticipant({
              encounterParticipants: encounter.participants,
              scenarioParticipant: targetScenarioParticipant,
              scenarioParticipantId: context.targetParticipantId,
            })
          : undefined;
        const distanceRow = getCombatDistanceTableRowForParticipants({
          participantAId: roundParticipant.participantId,
          participantAAliases: getCombatDistanceParticipantAliases(roundParticipant),
          participantBId: targetEncounterParticipant?.id,
          participantBAliases: [
            ...getCombatDistanceParticipantAliases(targetEncounterParticipant),
            ...getCombatDistanceParticipantAliases(targetScenarioParticipant),
          ],
          rows: combatDistanceRows,
        });

        return {
          attackModeLabel: summary.attackModeLabel,
          attackSummary: model.showAttackStats ? (model.attackStats ?? undefined) : undefined,
          defenseSummary: model.showDefenseContext ? (model.defenseStats ?? undefined) : undefined,
          distanceLabel: targetEncounterParticipant
            ? `Distance: ${distanceRow?.edge.distance ?? "—"}`
            : undefined,
          mainHandParryItemLabel: summary.mainHandParryItemLabel,
          offHandParryItemLabel: summary.offHandParryItemLabel,
          phaseContext: context,
          targetOptions,
        };
      };
      const phaseModel =
        phase && phaseContext
          ? buildPlayerCombatPhasePanelModel({
              actionId: draft.actionId,
              attackStats: phaseSummary.attackStats,
              defenseStats: phaseSummary.defenseStats,
              phaseCard: {
                description: "",
                phaseLabel: phase === "phase1" ? "Phase 1" : "Phase 2",
                stats: [],
                title: "",
              },
              phaseContext,
              phaseKey: phase,
              secondaryActionId: draft.secondaryActionId,
            })
          : undefined;
      const initiativeResult = phase ? roundParticipant.initiatives[phase] : undefined;
      const attackResult = attackPhase
        ? getCombatRoundOutgoingAttackResultForParticipantPhase({
            participantId: roundParticipant.participantId,
            phase: attackPhase,
            state: stateForSnapshots,
          })
        : phase && resolutionStepKind
          ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
              participantId: roundParticipant.participantId,
              phase,
              state: stateForSnapshots,
            })
          : undefined;
      const phaseResolutionResult =
        phase && resolutionStepKind && attackResult
          ? (getCombatRoundPhaseResolutionResultForAttack({
              attackResult,
              state: stateForSnapshots,
            }) ??
            buildCombatRoundPhaseResolutionResult({
              attackResult,
              roundNumber: stateForSnapshots.roundNumber,
              updatedAt: committedAt,
            }))
          : undefined;
      const phaseResolutionStatus = phase
        ? getCombatRoundPhaseResolutionStatus({
            participantId: roundParticipant.participantId,
            phase,
            state: stateForSnapshots,
          })
        : undefined;
      const actionResultSummary =
        attackResult && phaseResolutionResult
          ? formatCombatPhaseResolutionSummary({
              attackResult,
              participantId: roundParticipant.participantId,
              resolution: phaseResolutionResult,
            })
          : attackResult
            ? `${formatCombatAttackResultLine({
                participantId: roundParticipant.participantId,
                result: attackResult,
              })}\nResult: ${attackResult.tableResult}`
            : initiativeResult
              ? formatCombatInitiativeFormula(initiativeResult)
              : undefined;
      const participantStepStatus = roundParticipant.stepStatuses[step];
      const actionResultStatus = actionResultSummary
        ? "recorded"
        : participantStepStatus === "skipped"
          ? "skipped"
          : (attackPhase || (phase && resolutionStepKind)) && !attackResult
            ? "no_attack"
            : "no_result";
      const actionResultReason =
        step === "phase_2_actions" &&
        draft.actionId === "double_attack" &&
        roundParticipant.declaration?.attackOpportunities?.some(
          (opportunity) =>
            opportunity.origin === "double_attack" &&
            opportunity.phase === "phase2" &&
            opportunity.status === "cancelled",
        )
          ? "double_attack_cancelled"
          : undefined;

      return {
        actionResultReason,
        actionResultStatus,
        actionResultSummary,
        attackResult,
        attackSummary:
          phaseModel?.showAttackStats && phaseModel.attackStats
            ? phaseModel.attackStats
            : undefined,
        committedAt,
        declarationSummary: {
          actionId: draft.actionId || undefined,
          adjustDistance: roundParticipant.declaration?.adjustDistance,
          actionLabel: draft.actionId ? getPlayerEncounterActionLabel(draft.actionId) : undefined,
          additionalActionNotes: draft.additionalActionNotes || undefined,
          feint:
            roundParticipant.declaration?.actionId === "feint_attack" &&
            roundParticipant.declaration.feint
              ? {
                  attackerSkillId: roundParticipant.declaration.feint.attackerSkillId,
                  defenderSkillId: roundParticipant.declaration.feint.defenderSkillId,
                  method: roundParticipant.declaration.feint.method,
                  targetParticipantId: roundParticipant.declaration.feint.targetParticipantId,
                }
              : undefined,
          movementId: draft.movementId || undefined,
          movementLabel: getPlayerEncounterMovementLabel(draft.movementId),
          movementIntent: draft.movementIntent,
          movementPreferenceTargets: draft.movementIntent.distancePreferences.flatMap(
            (preference) => {
              const target = effectiveScenarioParticipants.find(
                (participant) =>
                  participant.id === preference.targetParticipantId ||
                  participant.characterId === preference.targetParticipantId,
              );

              return target
                ? [{ displayName: target.snapshot.displayName, id: preference.targetParticipantId }]
                : [];
            },
          ),
          secondaryActionContext: draft.secondaryActionContext,
          secondaryActionId: draft.secondaryActionId || undefined,
          secondaryActionLabel: draft.secondaryActionId
            ? getPlayerEncounterActionLabel(draft.secondaryActionId)
            : undefined,
        },
        defenseSummary:
          phaseModel?.showDefenseContext && phaseModel.defenseStats
            ? phaseModel.defenseStats
            : undefined,
        id: `${stateForSnapshots.roundNumber}:${roundParticipant.participantId}:${step}`,
        initiativeRank: initiativeResult ? ranks[roundParticipant.participantId] : undefined,
        initiativeResult,
        modifierSummary: {
          dbFlatAdjustment: phaseSummary.liveModifiers.dbFlatAdjustment ?? 0,
          dbRaw: phaseSummary.liveModifiers.dbRaw,
          effects: uniqueModifierEffects,
          generalFatigueRaw: phaseSummary.liveModifiers.generalFatigueRaw,
          initiativeRaw: phaseSummary.liveModifiers.initiativeRaw,
          obSkillRaw: phaseSummary.liveModifiers.obSkillRaw,
          rows: modifierRows,
        },
        participantId: roundParticipant.participantId,
        participantLabel: roundParticipant.label,
        phase,
        phasePanels: {
          phase1: buildPhasePanelSnapshot("phase1"),
          phase2: buildPhasePanelSnapshot("phase2"),
        },
        phaseContext,
        phaseResolutionStatus,
        phaseResolutionResult,
        roundNumber: stateForSnapshots.roundNumber,
        step,
      };
    });
  }

  async function commitCurrentStep(candidate?: CurrentActionCommandDescriptor) {
    if (isSequentialResolutionStep(roundState.currentStep) && !projectedBoundaryTransitionAction) {
      return;
    }

    const phaseInitiativeResolutionPhase = getCombatRoundInitiativePhaseForStep(
      roundState.currentStep,
    );

    if (
      phaseInitiativeResolutionPhase &&
      isCombatRoundPhaseInitiativeResolutionOpen({
        phase: phaseInitiativeResolutionPhase,
        state: roundState,
        visibility: encounter.roleplayState?.visibility,
      })
    ) {
      const descriptor = resolveCombatTaskCommandContext({
        descriptor: candidate,
        expectedCommandTypes: ["commit_phase_initiative_resolution"],
        presentation: currentActionPresentation,
        requiredFields: ["executionGroupId", "expectedRevision", "phase", "taskId"],
      });
      if (!descriptor || descriptor.phase !== phaseInitiativeResolutionPhase) {
        setSaveError("Combat state changed. Review the current action before continuing.");
        return;
      }
      setSaving(true);

      try {
        const {
          commandEnvelope,
          encounter: nextEncounter,
          participants,
        } = await commitPhaseInitiativeResolutionOnServer({
          currentEncounter: encounter,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          phase: descriptor.phase,
          taskId: descriptor.taskId,
        });
        const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
          getCombatRoundManagerStateFromCommandEnvelope({
            commandEnvelope,
            encounter: nextEncounter,
          });

        if (participants.length > 0) {
          setScenarioParticipantOverrides((current) => ({
            ...current,
            ...Object.fromEntries(participants.map((participant) => [participant.id, participant])),
          }));
          onScenarioParticipantsUpdated?.(participants);
        }

        pendingSelectionRef.current = undefined;
        manualSelectionRef.current = undefined;
        setInspectionSelection(nextInspectionSelection);
        setRoundState(nextRoundState, nextEncounter.updatedAt);
        setSelectedRoundNumber(nextRoundState.roundNumber);
        onEncounterUpdated?.(nextEncounter);
        focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
        setSaveError(undefined);
      } catch (caughtError) {
        setSaveError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to commit phase initiative resolution.",
        );
      } finally {
        setSaving(false);
      }

      return;
    }

    const boundaryTransitionAction = projectedBoundaryTransitionAction;

    if (!boundaryTransitionAction) {
      setSaveError("The current combat boundary is not ready to advance.");
      return;
    }

    if (boundaryTransitionInFlightRef.current) {
      return;
    }

    const committedAt = new Date().toISOString();
    const stepSnapshots = buildCombatRoundStepSnapshots(committedAt, roundState);

    boundaryTransitionInFlightRef.current = true;
    setSaving(true);
    try {
      const {
        commandEnvelope,
        encounter: nextEncounter,
        participants,
      } = await advanceCombatRoundCurrentStepOnServer({
        // Completing a round adds an immutable archive that is intentionally absent from the
        // active-only response. Keep the legacy response for this boundary until GM history is
        // revision-keyed independently from the full encounter.
        currentEncounter:
          boundaryTransitionAction.commandType === "complete_round" ? undefined : encounter,
        commandType: boundaryTransitionAction.commandType,
        encounterId: boundaryTransitionAction.encounterId,
        executionGroupId: boundaryTransitionAction.executionGroupId,
        expectedBoundary: boundaryTransitionAction.expectedBoundary,
        expectedRevision: boundaryTransitionAction.expectedRevision,
        stepSnapshots,
        targetBoundary: boundaryTransitionAction.targetBoundary,
        taskId: boundaryTransitionAction.taskId,
      });
      if (participants.length > 0) {
        setScenarioParticipantOverrides((current) => ({
          ...current,
          ...Object.fromEntries(participants.map((participant) => [participant.id, participant])),
        }));
        onScenarioParticipantsUpdated?.(participants);
      }
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      acceptCanonicalEncounterState(nextEncounter, nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      if (getCombatMutationConflictCode(caughtError)) {
        try {
          await refreshCanonicalCombatAfterConflict(caughtError);
        } catch (refreshError) {
          setSaveError(
            refreshError instanceof Error
              ? refreshError.message
              : "Combat state changed and could not be refreshed.",
          );
        }
      } else {
        setSaveError(
          caughtError instanceof Error ? caughtError.message : "Unable to advance combat round.",
        );
      }
    } finally {
      boundaryTransitionInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function clearCurrentStep() {
    setSaving(true);

    try {
      const currentSelection = getCurrentCombatRoundTaskSelection(roundState);
      const clearedSelection: CombatRoundSelectionTarget = {
        participantId: currentSelection?.participantId,
        step: currentSelection?.step ?? roundState.currentStep,
      };
      const { encounter: nextEncounter, participants } = await clearCurrentCombatRoundStepOnServer({
        currentEncounter: encounter,
        encounterId: encounter.id,
        participantId: clearedSelection.participantId,
        step: clearedSelection.step,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      const nextSelection = resolveCombatRoundInspectionSelection({
        manualSelection: getCurrentCombatRoundTaskSelection(nextRoundState),
        state: nextRoundState,
      });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextSelection);
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      setSaveError(undefined);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollIntoView: false, scrollToCurrent: true, state: nextRoundState });

      if (participants.length > 0) {
        setScenarioParticipantOverrides((current) => ({
          ...current,
          ...Object.fromEntries(participants.map((participant) => [participant.id, participant])),
        }));
        setInspectorDrafts((current) => {
          const nextDrafts = { ...current };

          for (const participant of participants) {
            for (const draftKey of Object.keys(nextDrafts)) {
              if (draftKey.startsWith(`${participant.id}:`)) {
                delete nextDrafts[draftKey];
              }
            }
          }

          return nextDrafts;
        });
        onScenarioParticipantsUpdated?.(participants);
      }
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to clear combat round step.",
      );
    } finally {
      setSaving(false);
    }
  }

  function selectCurrentTask() {
    setRecentResultFocus(undefined);
    setRecentResultRequest(undefined);
    manualSelectionRef.current = undefined;
    pendingSelectionRef.current = undefined;
    setSelectedRoundNumber(roundState.roundNumber);
    setInspectionSelection(
      resolveCombatRoundInspectionSelection({
        manualSelection: currentTaskSelection,
        state: roundState,
      }),
    );
    focusRoundTable({ scrollIntoView: false, scrollToCurrent: true });
  }

  function selectTimelineSelection(
    selection: CombatRoundTimelineSelection,
    mode: CombatRoundTimelineScrollMode = "nearest",
  ) {
    setRecentResultFocus(undefined);
    setRecentResultRequest(undefined);
    if (selection.roundNumber !== roundState.roundNumber) {
      beginCombatPerformanceInteraction({
        command: "inspect_archived_tracker_cell",
        encounterId: encounter.id,
        expectedRevision: descriptorRevision,
        participantCount: roundState.participants.length,
        requestExpected: false,
        roundNumber: selection.roundNumber,
      });
    }
    setSelectedRoundNumber(selection.roundNumber);
    manualSelectionRef.current = {
      participantId: selection.participantId,
      step: selection.step,
    };
    setInspectionSelection({
      participantId: selection.participantId,
      step: selection.step,
    });
    scrollTimelineCellIntoView(selection, mode);
    if (selection.roundNumber !== roundState.roundNumber) {
      settleCombatPerformanceInteraction();
    }
  }

  function selectInspector(participantId: string, step: CombatRoundStep, roundNumber: number) {
    selectTimelineSelection({
      participantId,
      roundNumber,
      step,
    });
  }

  function moveSelection(input: { participantOffset?: number; stepOffset?: number }) {
    const currentStep = inspectionSelection.step;
    const participantIds = getParticipantIdsForTimelineRound({
      fallbackParticipantIds: displayParticipants.map((participant) => participant.participantId),
      roundNumber: selectedRoundNumber,
      timelineRoundStates: [...timelineRoundStates],
    });
    const nextSelection =
      input.stepOffset !== undefined
        ? getAdjacentCombatRoundTimelineStepSelection({
            participantId: inspectionSelection.participantId,
            roundNumbers: [...timelineRoundNumbers],
            selectedRoundNumber,
            step: currentStep,
            stepOffset: input.stepOffset,
          })
        : getAdjacentCombatRoundTimelineParticipantSelection({
            participantId: inspectionSelection.participantId,
            participantIds,
            participantOffset: input.participantOffset ?? 0,
            roundNumber: selectedRoundNumber,
            step: currentStep,
          });

    selectTimelineSelection(nextSelection);
  }

  function handleTimelineKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target instanceof HTMLElement ? event.target : undefined;
    const move = getCombatRoundTimelineArrowMove({
      key: event.key,
      targetIsContentEditable: target?.isContentEditable,
      targetTagName: target?.tagName,
    });
    if (!move) return;
    event.preventDefault();
    moveSelection(move);
  }

  function updateInspectorDraft(patch: Partial<CombatInspectorDeclarationDraft>) {
    if (!inspectorDraftKey) {
      return;
    }

    if (Object.keys(patch).some((key) => key !== "combatContext")) {
      setInspectorModifierEditedDraftKeys((current) => {
        const next = { ...current };
        delete next[inspectorDraftKey];
        return next;
      });
    }

    setInspectorDrafts((current) => ({
      ...current,
      [inspectorDraftKey]: {
        ...inspectorDraft,
        ...patch,
      },
    }));
  }

  function updateInspectorModifierBucket(
    bucket: ScenarioCombatModifierBucket,
    updater: (entries: ScenarioCombatModifierEntry[]) => ScenarioCombatModifierEntry[],
  ) {
    const bucketKey = getModifierBucketContextKey(bucket);

    if (inspectorDraftKey) {
      setInspectorModifierEditedDraftKeys((current) => ({
        ...current,
        [inspectorDraftKey]: true,
      }));
    }

    updateInspectorDraft({
      combatContext: {
        ...inspectorDraft.combatContext,
        modifierBuckets: {
          ...inspectorDraft.combatContext.modifierBuckets,
          [bucketKey]: updater(inspectorDraft.combatContext.modifierBuckets[bucketKey]),
        },
      },
    });
  }

  function getParticipantDeclarationStatus(input: {
    participantId: string;
    roundState: typeof roundState;
    step: CombatRoundStep;
    status: CombatRoundStepStatus;
  }): CombatRoundStepStatus {
    const phase =
      getCombatAttackPhaseForStep(input.step) ?? getCombatRoundResolutionPhaseForStep(input.step);

    if (phase) {
      return getCombatRoundParticipantPhaseStepStatus({
        participantId: input.participantId,
        state: input.roundState,
        step: input.step,
      });
    }

    if (input.step !== "select_actions") {
      return input.status;
    }

    const encounterParticipant = encounter.participants.find(
      (participant) => participant.id === input.participantId,
    );
    const scenarioParticipant = encounterParticipant
      ? effectiveScenarioParticipants.find(
          (participant) =>
            participant.id === encounterParticipant.scenarioParticipantId ||
            participant.id === encounterParticipant.id ||
            (participant.characterId &&
              participant.characterId === encounterParticipant.characterId),
        )
      : undefined;
    const declaredThisRound = hasScenarioParticipantCombatDeclarationForEncounterRound({
      encounterId: encounter.id,
      participant: scenarioParticipant,
      roundNumber: input.roundState.roundNumber,
    });

    return declaredThisRound && input.status === "pending" ? "submitted" : input.status;
  }

  async function saveInspectorDeclaration(candidate?: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: [
        "declare_action",
        "review_modifiers_phase1",
        "review_modifiers_phase2",
      ],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "participantId", "taskId"],
    });
    if (!descriptor) {
      setSaveError("Combat state changed. Review the current action before continuing.");
      return;
    }
    if (
      descriptor.commandType === "resolve_damage" &&
      currentActionPresentation?.taskKind === "damage_roll" &&
      !descriptor.damageRollExpression
    ) {
      setSaveError("The graze damage roll context is no longer available.");
      return;
    }
    const taskScenarioParticipant = scenarioParticipantForTask(descriptor);
    const taskEncounterParticipant = encounter.participants.find((participant) =>
      getCombatDistanceParticipantAliases(participant).includes(descriptor.participantId!),
    );
    if (!encounter.scenarioId || !taskScenarioParticipant || !taskEncounterParticipant) {
      return;
    }

    if (inspectorCombatExperienceRequired) {
      setSaveError("Roll Combat Experience before declaring an action.");
      return;
    }
    const isModifierReview =
      descriptor.commandType === "review_modifiers_phase1" ||
      descriptor.commandType === "review_modifiers_phase2";
    if (isModifierReview && !modifierReviewInputSnapshot) {
      setSaveError("Modifier review state changed. Reopen the current review before continuing.");
      return;
    }

    const feintTargetResolution =
      !isModifierReview && inspectorDraft.actionId === "feint_attack"
        ? resolveCombatFeintDeclarationRequestTarget({
            encounterParticipants: encounter.participants,
            phaseContexts: inspectorDraft.phaseContexts,
          })
        : undefined;
    if (feintTargetResolution && !feintTargetResolution.ok) {
      setSaveError(feintTargetResolution.message);
      return;
    }
    let requestPhaseContexts = feintTargetResolution?.ok
      ? feintTargetResolution.phaseContexts
      : inspectorDraft.phaseContexts;
    if (!isModifierReview && inspectorDraft.actionId === "adjust_range_attack") {
      const targetParticipantId =
        requestPhaseContexts.phase1?.targetParticipantId ??
        requestPhaseContexts.phase2?.targetParticipantId;
      if (!targetParticipantId) {
        setSaveError("Select an opponent for Adjust Distance-Attack.");
        return;
      }
      requestPhaseContexts = {
        phase1: {
          ...inspectorDraft.phaseContexts.phase1,
          ...requestPhaseContexts.phase1,
          targetParticipantId,
        },
        phase2: {
          ...inspectorDraft.phaseContexts.phase2,
          ...requestPhaseContexts.phase2,
          targetParticipantId,
        },
      };
    }
    const declarationAttackSelection = buildCombatDeclarationAttackSelection({
      actionId: inspectorDraft.actionId || undefined,
      feintMethod: inspectorDraft.feintMethod,
      phaseContexts: requestPhaseContexts,
      phaseLoadoutSummaries: inspectorPhaseLoadoutSummaries,
      secondaryActionId: inspectorDraft.secondaryActionId || undefined,
    });
    requestPhaseContexts = declarationAttackSelection.phaseContexts;
    const attackModeUnavailableMessage = Object.values(inspectorPhaseLoadoutSummaries).find(
      (summary) => summary.attackModeUnavailableMessage,
    )?.attackModeUnavailableMessage;
    if (!isModifierReview && attackModeUnavailableMessage) {
      setSaveError(attackModeUnavailableMessage);
      return;
    }
    const targetValidation = isModifierReview
      ? { valid: true as const }
      : validateCombatDeclarationTargets({
          actingParticipantId: taskEncounterParticipant.id,
          actionId: inspectorDraft.actionId || undefined,
          movementKind: inspectorDraft.movementIntent.mode,
          phaseContexts: requestPhaseContexts,
          secondaryActionContext: inspectorDraft.secondaryActionContext,
          selectedOpponentId: inspectorDraft.combatContext.selectedOpponentId,
          secondaryActionId: inspectorDraft.secondaryActionId || undefined,
        });

    if (!targetValidation.valid) {
      setSaveError(targetValidation.message ?? "Select a target for each attack phase.");
      return;
    }

    const reviewStepSnapshot = isModifierReview
      ? buildCombatRoundStepSnapshots(new Date().toISOString(), {
          ...roundState,
          participants: roundState.participants.map((participant) =>
            participant.participantId === taskEncounterParticipant.id && participant.declaration
              ? {
                  ...participant,
                  declaration: {
                    ...participant.declaration,
                    combatContext:
                      !inspectorHasLocalModifierEdits && modifierReviewInputSnapshot
                        ? modifierReviewInputSnapshot.combatContext
                        : inspectorGeneratedCombatContext,
                    phaseContexts: requestPhaseContexts,
                  },
                }
              : participant,
          ),
        }).find(
          (snapshot) =>
            snapshot.participantId === taskEncounterParticipant.id &&
            snapshot.step === roundState.currentStep,
        )
      : undefined;

    setSaving(true);

    try {
      const actedParticipantId = taskEncounterParticipant.id;
      const actedStep = roundState.currentStep;
      const shouldUsePersistedCursor = isGlobalCombatRoundParticipantStep(actedStep);
      const displayedParticipantIds = displayParticipants.map(
        (participant) => participant.participantId,
      );
      const declarationResponse = await submitCombatDeclarationOnServer({
        currentEncounter: encounter,
        actionId: inspectorDraft.actionId || undefined,
        adjustDistance:
          inspectorDraft.actionId === "adjust_range_attack" &&
          requestPhaseContexts.phase1?.targetParticipantId
            ? {
                requestedDistance:
                  inspectorDraft.movementIntent.distancePreferences.find(
                    (preference) =>
                      preference.targetParticipantId ===
                      requestPhaseContexts.phase1?.targetParticipantId,
                  )?.desiredDistance ??
                  inspectorDistancePreferenceOptions.find(
                    (option) => option.id === requestPhaseContexts.phase1?.targetParticipantId,
                  )?.defaultDistance ??
                  2,
                targetParticipantId: requestPhaseContexts.phase1!.targetParticipantId!,
              }
            : undefined,
        additionalActionNotes: inspectorDraft.additionalActionNotes,
        combatContext:
          isModifierReview && !inspectorHasLocalModifierEdits
            ? modifierReviewInputSnapshot!.combatContext
            : inspectorGeneratedCombatContext,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        expectedParticipantRevision: isModifierReview
          ? modifierReviewInputSnapshot?.expectedParticipantRevision
          : taskScenarioParticipant.updatedAt,
        feint:
          inspectorDraft.actionId === "feint_attack" && feintTargetResolution?.ok
            ? {
                attackerSkillId:
                  inspectorDraft.feintMethod === "movement"
                    ? inspectorResolvedFeintSkill?.id
                    : undefined,
                method: inspectorDraft.feintMethod,
                targetParticipantId: feintTargetResolution.targetParticipantId,
              }
            : undefined,
        movementId: inspectorDraft.movementId || undefined,
        movementIntent: inspectorDraft.movementIntent,
        phaseContexts: requestPhaseContexts,
        phaseAttackSources: declarationAttackSelection.phaseAttackSources,
        phaseWeaponNames: {
          phase1: inspectorPhaseLoadoutSummaries.phase1.attackStats?.weaponName,
          phase2: inspectorPhaseLoadoutSummaries.phase2.attackStats?.weaponName,
        },
        reviewStepSnapshot,
        scenarioParticipantId: taskScenarioParticipant.id,
        secondaryActionContext: inspectorDraft.secondaryActionContext,
        secondaryActionId: inspectorDraft.secondaryActionId || undefined,
        taskId: descriptor.taskId,
      });
      let { commandEnvelope, deterministicAdvance, encounter: nextEncounter } = declarationResponse;
      const { participant } = declarationResponse;
      let updatedScenarioParticipants = [participant];
      let deterministicAdvanceError: unknown;
      if (deterministicAdvance) {
        deterministicAdvanceAttemptRef.current = `${encounter.id}:${deterministicAdvance.taskId}:${deterministicAdvance.expectedRevision}`;
        try {
          const advanced = await advanceDeterministicCombatOnServer({
            currentEncounter: nextEncounter,
            encounterId: encounter.id,
            executionGroupId: deterministicAdvance.executionGroupId,
            expectedRevision: deterministicAdvance.expectedRevision,
            taskId: deterministicAdvance.taskId,
          });
          commandEnvelope = advanced.commandEnvelope;
          nextEncounter = advanced.encounter;
          updatedScenarioParticipants = [
            ...new Map(
              [participant, ...advanced.participants].map((candidate) => [candidate.id, candidate]),
            ).values(),
          ];
          deterministicAdvance = undefined;
        } catch (caughtError) {
          if (getCombatMutationConflictCode(caughtError)) throw caughtError;
          deterministicAdvanceError = caughtError;
        }
      }
      const commandState = getCombatRoundManagerStateFromCommandEnvelope({
        commandEnvelope,
        encounter: nextEncounter,
      });
      const nextRoundState = commandState.state;
      const nextSelection = shouldUsePersistedCursor
        ? undefined
        : getNextCombatRoundParticipantSelection({
            fromParticipantId: actedParticipantId,
            participantIds: displayedParticipantIds,
            step: inspectionSelection.step,
          });
      const nextInspectionSelection = nextSelection
        ? resolveCombatRoundInspectionSelection({
            manualSelection: nextSelection,
            pendingSelection: nextSelection,
            state: nextRoundState,
          })
        : commandState.inspectionSelection;

      setScenarioParticipantOverrides((current) => ({
        ...current,
        ...Object.fromEntries(
          updatedScenarioParticipants.map((candidate) => [candidate.id, candidate]),
        ),
      }));

      if (nextSelection) {
        pendingSelectionRef.current = nextSelection;
        manualSelectionRef.current = nextSelection;
      } else {
        pendingSelectionRef.current = undefined;
        manualSelectionRef.current = undefined;
      }

      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      onScenarioParticipantsUpdated?.(updatedScenarioParticipants);
      setSaveError(
        deterministicAdvanceError instanceof Error
          ? deterministicAdvanceError.message
          : deterministicAdvanceError
            ? "The declaration was accepted, but deterministic combat work could not advance."
            : undefined,
      );
    } catch (caughtError) {
      if (getCombatMutationConflictCode(caughtError)) {
        try {
          await refreshCanonicalCombatAfterConflict(caughtError, {
            suppressDeterministicAdvance: true,
          });
        } catch (refreshError) {
          setSaveError(
            refreshError instanceof Error
              ? refreshError.message
              : "Combat state changed and could not be refreshed.",
          );
        }
      } else {
        setSaveError(
          caughtError instanceof Error ? caughtError.message : "Unable to save combat declaration.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function scenarioParticipantForTask(descriptor: CurrentActionCommandDescriptor) {
    const participantId = descriptor.participantId;
    if (!participantId) return undefined;
    const encounterParticipant = encounter.participants.find((participant) =>
      getCombatDistanceParticipantAliases(participant).includes(participantId),
    );
    return encounterParticipant
      ? findScenarioParticipantForEncounterParticipant({
          encounterParticipant,
          scenarioParticipants: effectiveScenarioParticipants,
        })
      : undefined;
  }

  async function rollInspectorFeint(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["roll_feint"],
      presentation: currentActionPresentation,
      requiredFields: [
        "executionGroupId",
        "expectedRevision",
        "participantId",
        "proposalId",
        "taskId",
      ],
    });
    const scenarioParticipant = descriptor ? scenarioParticipantForTask(descriptor) : undefined;
    if (!descriptor || !scenarioParticipant) return;
    setSaving(true);
    try {
      const { encounter: nextEncounter } = await rollCombatFeintOnServer({
        currentEncounter: encounter,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        proposalId: descriptor.proposalId!,
        scenarioParticipantId: scenarioParticipant.id,
        taskId: descriptor.taskId,
      });
      const next = getCombatRoundManagerStateFromCommandEnvelope({
        encounter: nextEncounter,
      });
      // A GM may execute the current task after selecting its tracker cell directly. Once the
      // accepted Feint roll replaces that task, the old explicit selection must not keep the
      // inspector pinned to the completed initiator roll as History. Recent-result focus owns
      // only the Results panel; ordinary canonical task selection owns every active panel.
      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(next.inspectionSelection);
      setRoundState(next.state, nextEncounter.updatedAt);
      setSelectedRoundNumber(next.state.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : "Unable to roll feint.");
    } finally {
      setSaving(false);
    }
  }

  async function advanceInspectorAdjustDistance(descriptor: CurrentActionCommandDescriptor) {
    const proposal = roundState.adjustDistanceProposals.find(
      (candidate) => candidate.id === descriptor.proposalId,
    );
    const scenarioParticipant = scenarioParticipantForTask(descriptor);
    if (!proposal || saving) return;
    setSaving(true);
    try {
      let nextEncounter: EncounterSession;
      if (
        descriptor.commandType === "respond_adjust_distance" &&
        proposal.status === "awaiting_defender_response"
      ) {
        if (!scenarioParticipant) return;
        nextEncounter = await respondCombatAdjustDistanceOnServer({
          currentEncounter: encounter,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          proposalId: proposal.id,
          response: inspectorAdjustDistanceResponse,
          scenarioParticipantId: scenarioParticipant.id,
          taskId: descriptor.taskId,
        });
      } else if (
        descriptor.commandType === "review_adjust_distance_roll_adjustment" &&
        proposal.status === "awaiting_gm_adjustment"
      ) {
        const draft = inspectorAdjustDistanceAdjustmentDraftRef.current?.getDraft() ?? {
          note: "",
          participantId: "",
          value: "0",
        };
        const request = buildAdjustDistanceGmAdjustmentRequest(draft);
        nextEncounter = await reviewCombatAdjustDistanceOnServer({
          currentEncounter: encounter,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          proposalId: proposal.id,
          taskId: descriptor.taskId,
          ...request,
        });
      } else if (
        descriptor.commandType === "roll_adjust_distance" &&
        proposal.status === "awaiting_rolls"
      ) {
        if (!scenarioParticipant) return;
        nextEncounter = await rollCombatAdjustDistanceOnServer({
          currentEncounter: encounter,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          proposalId: proposal.id,
          scenarioParticipantId: scenarioParticipant.id,
          taskId: descriptor.taskId,
        });
      } else if (
        descriptor.commandType === "commit_adjust_distance" &&
        proposal.status === "awaiting_review"
      ) {
        nextEncounter = await commitCombatAdjustDistanceOnServer({
          currentEncounter: encounter,
          committedDistance: Number.parseInt(inspectorAdjustDistanceCommittedDistance, 10),
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          notes: inspectorAdjustDistanceReviewNote || undefined,
          outcome: inspectorAdjustDistanceOutcome,
          proposalId: proposal.id,
          taskId: descriptor.taskId,
        });
      } else {
        setSaveError("Combat state changed. Review the current action before continuing.");
        return;
      }
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setInspectionSelection(resolveCombatRoundInspectionSelection({ state: nextRoundState }));
      onEncounterUpdated?.(nextEncounter);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to advance the distance adjustment.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function commitInspectorFeint(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["commit_feint_result"],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "proposalId", "taskId"],
    });
    const proposal = descriptor
      ? roundState.feintProposals.find((candidate) => candidate.id === descriptor.proposalId)
      : undefined;
    if (!descriptor || !proposal?.review) return;
    setSaving(true);
    try {
      const { encounter: nextEncounter, participants } = await commitCombatFeintOnServer({
        currentEncounter: encounter,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        gmAttackerDbParryModifier: Number.parseInt(inspectorFeintAttackerModifier, 10) || 0,
        gmDefenderDbParryModifier: Number.parseInt(inspectorFeintDefenderDbModifier, 10) || 0,
        gmDefenderSkillObModifier: Number.parseInt(inspectorFeintDefenderObModifier, 10) || 0,
        notes: inspectorFeintNote || undefined,
        proposalId: descriptor.proposalId!,
        taskId: descriptor.taskId,
      });
      setScenarioParticipantOverrides((current) => ({
        ...current,
        ...Object.fromEntries(participants.map((participant) => [participant.id, participant])),
      }));
      onScenarioParticipantsUpdated?.(participants);
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setInspectionSelection(resolveCombatRoundInspectionSelection({ state: nextRoundState }));
      onEncounterUpdated?.(nextEncounter);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : "Unable to commit feint.");
    } finally {
      setSaving(false);
    }
  }

  async function rollInspectorCombatExperience(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["roll_combat_experience", "submit_phase_initiative_choice"],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "participantId", "taskId"],
    });
    const scenarioParticipant = descriptor ? scenarioParticipantForTask(descriptor) : undefined;
    if (!descriptor || !scenarioParticipant) {
      return;
    }

    if (!inspectorCombatExperienceWindowOpen) {
      setSaveError("Set Combat Experience difficulty before rolling.");
      return;
    }

    setSaving(true);

    try {
      const { encounter: nextEncounter, participant } = await rollCombatExperienceOnServer({
        currentEncounter: encounter,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        opportunityId: descriptor.opportunityId,
        phase: descriptor.phase,
        scenarioParticipantId: scenarioParticipant.id,
        taskId: descriptor.taskId,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      const nextInspectionSelection = resolveCombatRoundInspectionSelection({
        state: nextRoundState,
      });

      setScenarioParticipantOverrides((current) => ({
        ...current,
        [participant.id]: participant,
      }));
      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      onScenarioParticipantsUpdated?.([participant]);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll Combat Experience.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function backOutInspectorPhaseAttack(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["submit_phase_initiative_choice"],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "participantId", "phase", "taskId"],
    });
    const scenarioParticipant = descriptor ? scenarioParticipantForTask(descriptor) : undefined;
    if (!descriptor || !scenarioParticipant) {
      return;
    }

    setSaving(true);

    try {
      const { encounter: nextEncounter, participant } = await backOutPhaseAttackOnServer({
        currentEncounter: encounter,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        phase: descriptor.phase!,
        scenarioParticipantId: scenarioParticipant.id,
        taskId: descriptor.taskId,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      const nextInspectionSelection = resolveCombatRoundInspectionSelection({
        state: nextRoundState,
      });

      setScenarioParticipantOverrides((current) => ({
        ...current,
        [participant.id]: participant,
      }));
      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      onScenarioParticipantsUpdated?.([participant]);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to back out of attack.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function continueInspectorPhaseAttack(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["submit_phase_initiative_choice"],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "participantId", "phase", "taskId"],
    });
    const scenarioParticipant = descriptor ? scenarioParticipantForTask(descriptor) : undefined;
    if (!descriptor || !scenarioParticipant) {
      return;
    }

    setSaving(true);

    try {
      const { encounter: nextEncounter, participant } = await continuePhaseAttackOnServer({
        currentEncounter: encounter,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        phase: descriptor.phase!,
        scenarioParticipantId: scenarioParticipant.id,
        taskId: descriptor.taskId,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      const nextInspectionSelection = resolveCombatRoundInspectionSelection({
        state: nextRoundState,
      });

      setScenarioParticipantOverrides((current) => ({
        ...current,
        [participant.id]: participant,
      }));
      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      onScenarioParticipantsUpdated?.([participant]);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to continue attack.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function decideInspectorDoubleAttackPhase2(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["decide_double_attack_phase2"],
      presentation: currentActionPresentation,
      requiredFields: [
        "executionGroupId",
        "expectedRevision",
        "opportunityId",
        "participantId",
        "taskId",
      ],
    });
    const scenarioParticipant = descriptor ? scenarioParticipantForTask(descriptor) : undefined;
    if (!descriptor || !scenarioParticipant) return;
    setSaving(true);
    try {
      const { encounter: nextEncounter, participant } = await decideDoubleAttackPhase2OnServer({
        currentEncounter: encounter,
        decision: inspectorDoubleAttackDecision,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        opportunityId: descriptor.opportunityId!,
        scenarioParticipantId: scenarioParticipant.id,
        taskId: descriptor.taskId,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      setScenarioParticipantOverrides((current) => ({
        ...current,
        [participant.id]: participant,
      }));
      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(resolveCombatRoundInspectionSelection({ state: nextRoundState }));
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      onScenarioParticipantsUpdated?.([participant]);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to record Double Attack decision.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveCombatExperienceDifficultyDraft(
    candidate: CurrentActionCommandDescriptor,
    value = inspectorCombatExperienceDifficulty,
  ) {
    if (combatExperienceDifficultyRequestInFlightRef.current) {
      return;
    }
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["set_combat_experience_difficulty"],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "taskId"],
    });
    if (!descriptor) return;
    const difficulty = Number.parseInt(value, 10);

    if (!Number.isInteger(difficulty) || difficulty <= 0) {
      setSaveError("Combat Experience difficulty must be a positive integer.");
      return;
    }

    if (difficulty === activeCombatExperienceDifficulty && inspectorCombatExperienceWindowOpen) {
      return;
    }

    combatExperienceDifficultyRequestInFlightRef.current = true;
    setSaving(true);

    try {
      const { encounter: nextEncounter } = await setCombatExperienceDifficultyOnServer({
        currentEncounter: encounter,
        difficulty,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        taskId: descriptor.taskId,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      const nextInspectionSelection = resolveCombatRoundInspectionSelection({
        state: nextRoundState,
      });

      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      setCombatExperienceDifficultyDrafts((current) => ({
        ...current,
        [inspectorCombatExperienceDifficultyKey]: String(
          getCombatRoundCombatExperienceDifficulty(nextRoundState),
        ),
      }));
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof TypeError && caughtError.message === "Failed to fetch"
          ? "Could not reach the combat service. Try again."
          : caughtError instanceof Error
            ? caughtError.message
            : "Unable to set Combat Experience difficulty.",
      );
    } finally {
      combatExperienceDifficultyRequestInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function saveCombatDistanceChanges() {
    if (dirtyCombatDistanceRows.length === 0) {
      return;
    }

    const changes = dirtyCombatDistanceRows.map((row) => {
      const value = distanceDrafts[row.edge.pairKey] ?? String(row.edge.distance);
      const distance = Number.parseInt(value, 10);

      return { distance, row, value };
    });
    const invalidChange = changes.find(
      (change) =>
        change.value.trim() !== String(change.distance) ||
        !Number.isInteger(change.distance) ||
        change.distance < 0 ||
        change.distance > 8,
    );

    if (invalidChange) {
      setSaveError("Combat distance must be an integer from 0 to 8.");
      return;
    }

    setSaving(true);

    try {
      let latestEncounter = encounter;
      const participantOverrides: Record<string, ScenarioParticipant> = {};

      for (const change of changes) {
        const { encounter: nextEncounter, participants } = await setPairDistanceOnServer({
          currentEncounter: encounter,
          distance: change.distance,
          encounterId: encounter.id,
          participantAId: change.row.edge.participantAId,
          participantBId: change.row.edge.participantBId,
        });

        latestEncounter = nextEncounter;
        for (const participant of participants ?? []) {
          participantOverrides[participant.id] = participant;
        }
      }

      const nextRoundState = initializeCombatRoundState({ encounter: latestEncounter });
      const nextInspectionSelection = resolveCombatRoundInspectionSelection({
        state: nextRoundState,
      });

      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState, latestEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      if (Object.keys(participantOverrides).length > 0) {
        setScenarioParticipantOverrides((current) => ({
          ...current,
          ...participantOverrides,
        }));
      }
      onEncounterUpdated?.(latestEncounter);
      setDistanceDrafts({});
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to set combat distance.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollInspectorInitiative(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["roll_initiative_phase1", "roll_initiative_phase2"],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "participantId", "phase", "taskId"],
    });
    const scenarioParticipant = descriptor ? scenarioParticipantForTask(descriptor) : undefined;
    const encounterParticipant = descriptor?.participantId
      ? encounter.participants.find((participant) =>
          getCombatDistanceParticipantAliases(participant).includes(descriptor.participantId!),
        )
      : undefined;
    if (!descriptor || !scenarioParticipant || !encounterParticipant) {
      return;
    }

    setSaving(true);

    try {
      const actedParticipantId = encounterParticipant.id;
      const actedStep = roundState.currentStep;
      const shouldUsePersistedCursor = isGlobalCombatRoundParticipantStep(actedStep);
      const displayedParticipantIds = displayParticipants.map(
        (participant) => participant.participantId,
      );
      const { encounter: nextEncounter } = await rollCombatInitiativeOnServer({
        currentEncounter: encounter,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId!,
        expectedParticipantRevision: scenarioParticipant.updatedAt,
        expectedRevision: descriptor.expectedRevision,
        scenarioParticipantId: scenarioParticipant.id,
        taskId: descriptor.taskId,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      const nextSelection = shouldUsePersistedCursor
        ? undefined
        : getNextCombatRoundParticipantSelection({
            fromParticipantId: actedParticipantId,
            participantIds: displayedParticipantIds,
            step: inspectionSelection.step,
          });
      const nextInspectionSelection = nextSelection
        ? resolveCombatRoundInspectionSelection({
            manualSelection: nextSelection,
            pendingSelection: nextSelection,
            state: nextRoundState,
          })
        : resolveCombatRoundInspectionSelection({ state: nextRoundState });

      if (nextSelection) {
        pendingSelectionRef.current = nextSelection;
        manualSelectionRef.current = nextSelection;
      } else {
        pendingSelectionRef.current = undefined;
        manualSelectionRef.current = undefined;
      }

      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll combat initiative.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollInspectorPhaseAttack(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["roll_attack"],
      presentation: currentActionPresentation,
      requiredFields: [
        "actionId",
        "attackIndex",
        "attackModeId",
        "declarationId",
        "executionGroupId",
        "expectedRevision",
        "opponentParticipantId",
        "opportunityId",
        "participantId",
        "phase",
        "processId",
        "stageId",
        "taskId",
        "weaponSourceId",
        "weaponSourceSlot",
        "weaponTemplateId",
      ],
    });
    const selectedScenarioParticipant = descriptor
      ? scenarioParticipantForTask(descriptor)
      : undefined;
    const selectedEncounterParticipant = descriptor?.participantId
      ? encounter.participants.find((participant) =>
          getCombatDistanceParticipantAliases(participant).includes(descriptor.participantId!),
        )
      : undefined;
    if (!descriptor || !selectedScenarioParticipant || !selectedEncounterParticipant) {
      return;
    }
    const phase = descriptor.phase!;

    const existingAttackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: selectedEncounterParticipant.id,
      phase,
      state: roundState,
    });

    if (existingAttackResult) {
      setSaveError(
        `Attack already rolled. Clear ${phase === "phase1" ? "A1" : "A2"} before rolling again.`,
      );
      return;
    }

    const phaseLabel = formatCombatPhaseLabel(phase);
    const phaseLoadoutSummary = inspectorPhaseLoadoutSummaries[phase];
    const requestAttackStats =
      "requestAttackStats" in phaseLoadoutSummary
        ? (phaseLoadoutSummary.requestAttackStats as PlayerCombatAttackStatsView | null)
        : undefined;
    const canonicalAttackSummary = requestAttackStats ?? phaseLoadoutSummary.attackStats;
    if (!canonicalAttackSummary) {
      setSaveError(`${phaseLabel} attack calculation is unavailable.`);
      return;
    }

    const targetIdentity = resolveCanonicalCombatTargetIdentity({
      encounterParticipants: encounter.participants,
      targetParticipantId: descriptor.opponentParticipantId,
    });
    const targetScenarioParticipant = effectiveScenarioParticipants.find(
      (participant) => participant.id === targetIdentity?.scenarioParticipantId,
    );
    const targetEncounterParticipant = findEncounterParticipantForScenarioParticipant({
      encounterParticipants: encounter.participants,
      scenarioParticipant: targetScenarioParticipant,
      scenarioParticipantId: descriptor.opponentParticipantId,
    });
    if (!targetIdentity || !targetScenarioParticipant || !targetEncounterParticipant) {
      setSaveError(
        descriptor.actionId === "feint_attack" && phase === "phase2"
          ? "The Feint target is no longer in this encounter."
          : `Select a target for ${phaseLabel} attack.`,
      );
      return;
    }

    const projectedAttackTask = projectedCurrentTasks.find((task) => task.id === descriptor.taskId);
    const modifierRequest = buildGmCombatAttackModifierRequest({
      descriptor,
      encounterId: roundView.encounterId,
      encounterRevision: roundView.encounterRevision,
      projectedTask: projectedAttackTask,
    });

    if (!modifierRequest) {
      setSaveError("Combat state changed. Review the current action before rolling.");
      return;
    }

    setSaving(true);

    try {
      const {
        commandEnvelope,
        encounter: nextEncounter,
        participant,
      } = await rollCombatAttackOnServer({
        currentEncounter: encounter,
        actionId: descriptor.actionId,
        attackIndex: descriptor.attackIndex!,
        attackModeId: descriptor.attackModeId!,
        effectCutoffInitiativeGroupId: modifierRequest.effectCutoffInitiativeGroupId,
        defenderParticipantId: targetIdentity.encounterParticipantId,
        declarationId: descriptor.declarationId!,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId!,
        expectedParticipantRevision: selectedScenarioParticipant.updatedAt,
        expectedRevision: modifierRequest.expectedRevision,
        initiativeGroupId: modifierRequest.initiativeGroupId,
        initiativeValue: modifierRequest.initiativeValue,
        modifierValidationTaskId: modifierRequest.modifierValidationTaskId,
        opportunityId: descriptor.opportunityId!,
        phase,
        scenarioParticipantId: selectedScenarioParticipant.id,
        taskId: descriptor.taskId,
        weaponInstanceId: descriptor.weaponInstanceId,
        weaponSourceId: descriptor.weaponSourceId!,
        weaponSourceSlot: descriptor.weaponSourceSlot!,
        weaponTemplateId: descriptor.weaponTemplateId!,
      });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });

      if (participant) {
        setScenarioParticipantOverrides((current) => ({
          ...current,
          [participant.id]: participant,
        }));
        onScenarioParticipantsUpdated?.([participant]);
      }

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      try {
        if (await refreshCanonicalCombatAfterConflict(caughtError)) {
          return;
        }
      } catch (refreshError) {
        setSaveError(
          refreshError instanceof Error
            ? refreshError.message
            : "Unable to refresh the current combat action.",
        );
        return;
      }
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to save ${phaseLabel} attack result.`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollInspectorParry(descriptor: CurrentActionCommandDescriptor) {
    const attackResult = descriptor.attackResultId
      ? getCombatRoundAttackResultById({
          attackResultId: descriptor.attackResultId,
          state: roundState,
        })
      : undefined;
    const phase = descriptor.phase;

    if (
      descriptor.commandType !== "roll_parry" ||
      !descriptor.attackResultId ||
      !descriptor.executionGroupId ||
      !descriptor.processId ||
      !descriptor.stageId ||
      !descriptor.parryPurpose ||
      !descriptor.parrySourceId ||
      !descriptor.opportunityId ||
      !descriptor.opponentParticipantId ||
      !attackResult ||
      !phase ||
      !descriptor.participantId ||
      attackResult.defenderParticipantId !== descriptor.participantId ||
      attackResult.attackerParticipantId !== descriptor.opponentParticipantId ||
      attackResult.phase !== phase
    ) {
      setSaveError("No attack result is available for parry.");
      return;
    }

    if (!attackResult.hit && descriptor.parryPurpose !== "offensive_parry") {
      setSaveError("Attack missed; parry is not applicable.");
      return;
    }
    if (
      descriptor.parryPurpose === "offensive_parry" &&
      (!descriptor.declarationId ||
        !descriptor.declaredOpponentParticipantId ||
        !descriptor.offensiveParryAttemptId)
    ) {
      setSaveError("The Offensive Parry task identity is incomplete.");
      return;
    }

    const defenderRoundParticipant = roundState.participants.find(
      (participant) => participant.participantId === descriptor.participantId,
    );
    const defenderEncounterParticipant = encounter.participants.find(
      (participant) => participant.id === descriptor.participantId,
    );
    const defenderScenarioParticipant = defenderEncounterParticipant
      ? findScenarioParticipantForEncounterParticipant({
          encounterParticipant: defenderEncounterParticipant,
          scenarioParticipants: effectiveScenarioParticipants,
        })
      : undefined;
    const attackerEncounterParticipant = encounter.participants.find(
      (participant) => participant.id === attackResult.attackerParticipantId,
    );
    const attackerScenarioParticipant = attackerEncounterParticipant
      ? findScenarioParticipantForEncounterParticipant({
          encounterParticipant: attackerEncounterParticipant,
          scenarioParticipants: effectiveScenarioParticipants,
        })
      : undefined;
    const projectedParryTask = projectedCurrentTasks.find((task) => task.id === descriptor.taskId);

    if (!defenderScenarioParticipant || !defenderRoundParticipant) {
      setSaveError("Defender scenario participant is required to roll parry.");
      return;
    }

    const defenderPhaseSummary = buildScenarioParticipantPhaseSummary({
      declaration: defenderRoundParticipant.declaration,
      opponentCombatantId: attackResult.attackerParticipantId,
      phaseKey: phase,
      scenarioParticipant: defenderScenarioParticipant,
    });
    const selectionKey = getCombatParrySelectionKey({
      result: attackResult,
      roundNumber: roundState.roundNumber,
    });
    const sources = defenderPhaseSummary.parrySources;
    const selection = getCombatParrySourceSelection({
      selection: selectionKey ? parrySourceSelections[selectionKey] : undefined,
      sources,
    });
    const parryBase = getSelectedCombatParryBase({ selection, sources });

    if (parryBase === undefined) {
      setSaveError("Select at least one available parry source.");
      return;
    }
    const modifierRequest = buildGmCombatParryModifierRequest({
      attackerScenarioParticipant,
      attackResult,
      defenderCombatantId: descriptor.participantId,
      defenderScenarioParticipant,
      descriptor,
      encounterId: encounter.id,
      encounterRevision: currentActionPresentation?.encounterRevision,
      projectedTask: projectedParryTask,
      roundState,
    });
    if (!modifierRequest) {
      setSaveError("Parry state changed. Review the current action before rolling.");
      return;
    }

    const usedMainHand = selection.usedMainHand && Boolean(sources?.mainHand);
    const usedOffHand = selection.usedOffHand && Boolean(sources?.offHand);

    setSaving(true);

    try {
      const { commandEnvelope, encounter: nextEncounter } = await rollCombatParryCommandOnServer({
        currentEncounter: encounter,
        attackResultId: descriptor.attackResultId,
        attackerParticipantId: descriptor.opponentParticipantId,
        commandType: "roll_parry",
        defenderParticipantId: descriptor.participantId,
        declarationId: descriptor.declarationId,
        declaredOpponentParticipantId: descriptor.declaredOpponentParticipantId,
        encounterId: encounter.id,
        executionGroupId: descriptor.executionGroupId,
        expectedParticipantRevision: defenderScenarioParticipant.updatedAt,
        expectedRevision: descriptor.expectedRevision,
        effectCutoffInitiativeGroupId: modifierRequest.effectCutoffInitiativeGroupId,
        initiativeGroupId: modifierRequest.initiativeGroupId,
        initiativeValue: modifierRequest.initiativeValue,
        modifierValidationTaskId: modifierRequest.modifierValidationTaskId,
        offensiveParryAttemptId: descriptor.offensiveParryAttemptId,
        opportunityId: descriptor.opportunityId,
        parryPurpose: descriptor.parryPurpose,
        parrySourceId: descriptor.parrySourceId,
        phase,
        processId: descriptor.processId,
        scenarioParticipantId: defenderScenarioParticipant.id,
        stageId: descriptor.stageId,
        taskId: descriptor.taskId,
        usedMainHand,
        usedOffHand,
      });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : "Unable to roll parry.");
    } finally {
      setSaving(false);
    }
  }

  async function rollInspectorOffensiveParryBrawling(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["roll_offensive_parry_brawling"],
      presentation: currentActionPresentation,
      requiredFields: [
        "attackResultId",
        "contestId",
        "declarationId",
        "declaredOpponentParticipantId",
        "executionGroupId",
        "opponentParticipantId",
        "offensiveParryAttemptId",
        "opportunityId",
        "parryResultId",
        "participantId",
        "phase",
        "processId",
        "stageId",
      ],
    });
    const participant = descriptor ? scenarioParticipantForTask(descriptor) : undefined;
    if (!descriptor || !participant) {
      setSaveError("The Offensive Parry task is no longer available.");
      return;
    }
    setSaving(true);
    try {
      const nextEncounter = await rollOffensiveParryBrawlingOnServer({
        currentEncounter: encounter,
        attackResultId: descriptor.attackResultId!,
        contestId: descriptor.contestId!,
        declarationId: descriptor.declarationId!,
        declaredOpponentParticipantId: descriptor.declaredOpponentParticipantId!,
        encounterId: descriptor.encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        opponentParticipantId: descriptor.opponentParticipantId!,
        offensiveParryAttemptId: descriptor.offensiveParryAttemptId!,
        opportunityId: descriptor.opportunityId!,
        parryResultId: descriptor.parryResultId!,
        phase: descriptor.phase!,
        processId: descriptor.processId!,
        scenarioParticipantId: participant.id,
        stageId: descriptor.stageId!,
        taskId: descriptor.taskId,
      });
      const nextRoundState = combatRoundStateSchema.parse(nextEncounter.combatRoundState);
      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(resolveCombatRoundInspectionSelection({ state: nextRoundState }));
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to roll Offensive Parry Brawling.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollContinuedContactMaintenance(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["roll_continued_contact_maintenance"],
      presentation: currentActionPresentation,
      requiredFields: [
        "contestId",
        "continuedContactId",
        "executionGroupId",
        "expectedRevision",
        "opponentParticipantId",
        "participantId",
        "processId",
        "rollPurpose",
        "stageId",
        "taskId",
      ],
    });
    const participant = descriptor ? scenarioParticipantForTask(descriptor) : undefined;
    if (!descriptor || !participant) {
      setSaveError("The Continued Contact maintenance task is no longer available.");
      return;
    }
    setSaving(true);
    try {
      const {
        commandEnvelope,
        encounter: nextEncounter,
        participant: updatedParticipant,
      } = await rollContinuedContactMaintenanceOnServer({
        currentEncounter: encounter,
        contestId: descriptor.contestId!,
        continuedContactId: descriptor.continuedContactId!,
        encounterId: descriptor.encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        opponentParticipantId: descriptor.opponentParticipantId!,
        processId: descriptor.processId!,
        scenarioParticipantId: participant.id,
        stageId: descriptor.stageId!,
        taskId: descriptor.taskId,
      });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });
      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      acceptCanonicalEncounterState(nextEncounter, nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      if (updatedParticipant) {
        setScenarioParticipantOverrides((current) => ({
          ...current,
          [updatedParticipant.id]: updatedParticipant,
        }));
        onScenarioParticipantsUpdated?.([updatedParticipant]);
      }
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to roll Continued Contact maintenance.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollObservation(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["roll_observation"],
      presentation: currentActionPresentation,
      requiredFields: [
        "executionGroupId",
        "expectedRevision",
        "observationAttemptId",
        "opponentParticipantId",
        "participantId",
        "processId",
        "relationshipId",
        "stageId",
        "taskId",
      ],
    });
    const participant = descriptor ? scenarioParticipantForTask(descriptor) : undefined;
    if (!descriptor || !participant) {
      setSaveError("The Observe Opponent task is no longer available.");
      return;
    }
    setSaving(true);
    try {
      const { commandEnvelope, encounter: nextEncounter } = await rollCombatObservationOnServer({
        currentEncounter: encounter,
        encounterId: descriptor.encounterId,
        executionGroupId: descriptor.executionGroupId!,
        expectedRevision: descriptor.expectedRevision,
        observationAttemptId: descriptor.observationAttemptId!,
        opponentParticipantId: descriptor.opponentParticipantId!,
        processId: descriptor.processId!,
        relationshipId: descriptor.relationshipId!,
        scenarioParticipantId: participant.id,
        stageId: descriptor.stageId!,
        taskId: descriptor.taskId,
      });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });
      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      acceptCanonicalEncounterState(nextEncounter, nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll Observe Opponent.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveInspectorDamageReview() {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: currentActionPresentation?.primaryAction.descriptor,
      expectedCommandTypes: ["commit_phase_damage"],
      presentation: currentActionPresentation,
      requiredFields: [
        "attackResultId",
        "attackerParticipantId",
        "criticalResultId",
        "damageReviewId",
        "defenderParticipantId",
        "executionGroupId",
        "expectedRevision",
        "hitLocationResultId",
        "phase",
        "taskId",
      ],
    });

    const damageResolution = descriptor
      ? roundState.phaseResolutionResults.find(
          (resolution) => resolution.attackResultId === descriptor.attackResultId,
        )
      : undefined;
    const damageResult = damageResolution?.damageResult;
    const damageReviewKey = damageResult?.attackResultId;
    const damageReviewDraft = damageReviewKey
      ? (damageReviewDrafts[damageReviewKey] ??
        buildCombatDamageReviewDraft(damageResult, damageResolution?.criticalRoll))
      : undefined;

    if (!damageReviewKey || !damageResult || !damageReviewDraft || !descriptor) {
      setSaveError("Combat state changed. Review the current action before continuing.");
      return;
    }

    setSaving(true);

    try {
      const { commandEnvelope, encounter: nextEncounter } =
        await saveCurrentCombatDamageReviewOnServer({
          currentEncounter: encounter,
          attackResultId: descriptor.attackResultId!,
          attackerParticipantId: descriptor.attackerParticipantId!,
          commandType: "commit_phase_damage",
          criticalResultId: descriptor.criticalResultId!,
          damageReviewId: descriptor.damageReviewId!,
          defenderParticipantId: descriptor.defenderParticipantId!,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          hitLocationResultId: descriptor.hitLocationResultId!,
          opportunityId: descriptor.opportunityId,
          phase: descriptor.phase!,
          review: buildCombatDamageReviewFromDraft({
            criticalRoll: damageResolution?.criticalRoll,
            damageResult,
            draft: damageReviewDraft,
          }),
          taskId: descriptor.taskId,
        });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState, nextEncounter.updatedAt);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      setDamageReviewDrafts((current) => {
        const rest = { ...current };
        delete rest[damageReviewKey];

        return rest;
      });
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to save damage review.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function invokeGmDownstreamCombatTask(candidate?: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: [
        "roll_hit_location",
        "roll_critical",
        "resolve_damage",
        "commit_phase_damage",
      ],
      presentation: currentActionPresentation,
      requiredFields: [
        "attackResultId",
        "attackerParticipantId",
        "criticalResultId",
        "damageReviewId",
        "defenderParticipantId",
        "executionGroupId",
        "expectedRevision",
        "hitLocationResultId",
        "phase",
        "taskId",
      ],
    });
    if (!descriptor) {
      setSaveError("Combat state changed. Review the current action before continuing.");
      return;
    }
    const attackerEncounterParticipant = encounter.participants.find((participant) =>
      getCombatDistanceParticipantAliases(participant).includes(descriptor.attackerParticipantId!),
    );
    const attackerScenarioParticipant = attackerEncounterParticipant
      ? findScenarioParticipantForEncounterParticipant({
          encounterParticipant: attackerEncounterParticipant,
          scenarioParticipants: effectiveScenarioParticipants,
        })
      : undefined;
    if (
      (descriptor.commandType === "roll_hit_location" ||
        descriptor.commandType === "roll_critical") &&
      !attackerScenarioParticipant
    ) {
      setSaveError("The attacking participant is no longer available.");
      return;
    }

    setSaving(true);
    try {
      if (descriptor.commandType === "roll_hit_location") {
        const nextEncounter = await rollCombatHitLocationOnServer({
          currentEncounter: encounter,
          attackResultId: descriptor.attackResultId!,
          attackerParticipantId: descriptor.attackerParticipantId!,
          defenderParticipantId: descriptor.defenderParticipantId!,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          hitLocationResultId: descriptor.hitLocationResultId!,
          opportunityId: descriptor.opportunityId,
          phase: descriptor.phase!,
          scenarioParticipantId: attackerScenarioParticipant!.id,
          taskId: descriptor.taskId,
        });
        acceptCanonicalEncounterState(
          nextEncounter,
          initializeCombatRoundState({ encounter: nextEncounter }),
        );
        onEncounterUpdated?.(nextEncounter);
      } else if (descriptor.commandType === "roll_critical") {
        const nextEncounter = await rollCombatCriticalOnServer({
          currentEncounter: encounter,
          attackResultId: descriptor.attackResultId!,
          attackerParticipantId: descriptor.attackerParticipantId!,
          criticalResultId: descriptor.criticalResultId!,
          defenderParticipantId: descriptor.defenderParticipantId!,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          hitLocationResultId: descriptor.hitLocationResultId!,
          opportunityId: descriptor.opportunityId,
          phase: descriptor.phase!,
          scenarioParticipantId: attackerScenarioParticipant!.id,
          taskId: descriptor.taskId,
        });
        acceptCanonicalEncounterState(
          nextEncounter,
          initializeCombatRoundState({ encounter: nextEncounter }),
        );
        onEncounterUpdated?.(nextEncounter);
      } else if (descriptor.commandType === "resolve_damage") {
        const { commandEnvelope, encounter: nextEncounter } =
          await resolveCurrentCombatPhaseDamageOnServer({
            currentEncounter: encounter,
            attackResultId: descriptor.attackResultId!,
            attackerParticipantId: descriptor.attackerParticipantId!,
            commandType: "resolve_damage",
            criticalResultId: descriptor.criticalResultId!,
            damageRollExpression: descriptor.damageRollExpression,
            damageReviewId: descriptor.damageReviewId!,
            defenderParticipantId: descriptor.defenderParticipantId!,
            encounterId: encounter.id,
            executionGroupId: descriptor.executionGroupId!,
            expectedRevision: descriptor.expectedRevision,
            hitLocationResultId: descriptor.hitLocationResultId!,
            opportunityId: descriptor.opportunityId,
            phase: descriptor.phase!,
            scenarioParticipantId: attackerScenarioParticipant?.id,
            taskId: descriptor.taskId,
          });
        const next = getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });
        acceptCanonicalEncounterState(nextEncounter, next.state);
        setInspectionSelection(next.inspectionSelection);
        onEncounterUpdated?.(nextEncounter);
      } else {
        const damageResolution = roundState.phaseResolutionResults.find(
          (resolution) => resolution.attackResultId === descriptor.attackResultId,
        );
        const damageResult = damageResolution?.damageResult;
        const damageReviewDraft = damageResult
          ? (damageReviewDrafts[damageResult.attackResultId] ??
            buildCombatDamageReviewDraft(damageResult, damageResolution?.criticalRoll))
          : undefined;
        if (!damageResult || !damageReviewDraft) {
          setSaveError("No damage review is available for this attack.");
          return;
        }
        const { commandEnvelope, encounter: nextEncounter } =
          await commitCurrentCombatPhaseDamageOnServer({
            currentEncounter: encounter,
            attackResultId: descriptor.attackResultId!,
            attackerParticipantId: descriptor.attackerParticipantId!,
            commandType: "commit_phase_damage",
            criticalResultId: descriptor.criticalResultId!,
            damageReviewId: descriptor.damageReviewId!,
            defenderParticipantId: descriptor.defenderParticipantId!,
            encounterId: encounter.id,
            executionGroupId: descriptor.executionGroupId!,
            expectedRevision: descriptor.expectedRevision,
            hitLocationResultId: descriptor.hitLocationResultId!,
            opportunityId: descriptor.opportunityId,
            phase: descriptor.phase!,
            review: buildCombatDamageReviewFromDraft({
              criticalRoll: damageResolution?.criticalRoll,
              damageResult,
              draft: damageReviewDraft,
            }),
            taskId: descriptor.taskId,
          });
        const next = getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });
        acceptCanonicalEncounterState(nextEncounter, next.state);
        setInspectionSelection(next.inspectionSelection);
        onEncounterUpdated?.(nextEncounter);
      }
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to resolve combat damage.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function advanceInspectorRoundEndReview(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["commit_round_end_participant_review", "roll_round_end_health_check"],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "participantId", "taskId"],
    });
    const scenarioParticipant = descriptor ? scenarioParticipantForTask(descriptor) : undefined;
    if (!descriptor || !scenarioParticipant || !selectedRoundIsActive) {
      return;
    }

    setSaving(true);

    try {
      if (!roundState.roundEndReview) {
        setSaveError("Round-end review is preparing automatically.");
        return;
      }

      const participantReview =
        roundState.roundEndReview.participantReviews[descriptor.participantId!];

      if (!participantReview) {
        setSaveError("Round-end review is missing for this participant.");
        return;
      }

      if (descriptor.commandType === "commit_round_end_participant_review") {
        if (!encounter.scenarioId) {
          setSaveError("Scenario participant state is required to commit SU review.");
          return;
        }

        const {
          commandEnvelope,
          encounter: nextEncounter,
          participant: updatedParticipant,
        } = await commitRoundEndParticipantReviewOnServer({
          currentEncounter: encounter,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          expectedParticipantRevision: scenarioParticipant.updatedAt,
          scenarioParticipantId: scenarioParticipant.id,
          taskId: descriptor.taskId,
        });
        const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
          getCombatRoundManagerStateFromCommandEnvelope({
            commandEnvelope,
            encounter: nextEncounter,
          });
        pendingSelectionRef.current = undefined;
        manualSelectionRef.current = undefined;
        acceptCanonicalEncounterState(nextEncounter, nextRoundState);
        setInspectionSelection(nextInspectionSelection);
        setSelectedRoundNumber(nextRoundState.roundNumber);
        setScenarioParticipantOverrides((current) => ({
          ...current,
          [updatedParticipant.id]: updatedParticipant,
        }));
        onScenarioParticipantsUpdated?.([updatedParticipant]);
        onEncounterUpdated?.(nextEncounter);
        focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
        setSaveError(undefined);
        return;
      }

      if (descriptor.commandType === "roll_round_end_health_check") {
        if (!encounter.scenarioId || !descriptor.healthRollId) {
          setSaveError("Scenario participant state is required to roll SU health.");
          return;
        }

        const pendingHealthRoll = participantReview.proposedHealthRolls.find(
          (proposal) =>
            proposal.accepted &&
            proposal.status === "pending" &&
            proposal.id === descriptor.healthRollId,
        );

        if (!pendingHealthRoll) {
          setSaveError("No pending health roll is available for this participant.");
          return;
        }

        const { encounter: nextEncounter, participant: updatedParticipant } =
          await rollRoundEndHealthCheckOnServer({
            currentEncounter: encounter,
            encounterId: encounter.id,
            executionGroupId: descriptor.executionGroupId!,
            expectedRevision: descriptor.expectedRevision,
            expectedParticipantRevision: scenarioParticipant.updatedAt,
            healthRollId: pendingHealthRoll.id,
            scenarioParticipantId: scenarioParticipant.id,
            taskId: descriptor.taskId,
          });
        const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
        acceptCanonicalEncounterState(nextEncounter, nextRoundState);
        setScenarioParticipantOverrides((current) => ({
          ...current,
          [updatedParticipant.id]: updatedParticipant,
        }));
        onScenarioParticipantsUpdated?.([updatedParticipant]);
        onEncounterUpdated?.(nextEncounter);
        setSaveError(undefined);
        return;
      }

      setSaveError("Round-end review complete for this participant.");
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to advance SU review.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function commitRoundEndDistanceControl(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["commit_round_end_distance_control"],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "pairId", "proposalId", "taskId"],
    });
    if (!descriptor || !selectedRoundIsActive) {
      return;
    }

    setSaving(true);

    try {
      const overrideDraft = roundEndDistanceOverrideDrafts[descriptor.proposalId!];
      const proposal = inspectorRoundEndDistanceCommitProposal;
      const controlledByContinuedContact = proposal?.controlMode === "continued_contact";
      const selectedDistance =
        overrideDraft && overrideDraft.trim().length > 0
          ? parseCombatInteger(overrideDraft, "Distance")
          : undefined;
      const { commandEnvelope, encounter: nextEncounter } =
        await commitRoundEndDistanceControlOnServer({
          currentEncounter: encounter,
          chosenDistance: controlledByContinuedContact ? selectedDistance : undefined,
          distanceOverride: controlledByContinuedContact ? undefined : selectedDistance,
          distanceProposalId: descriptor.proposalId!,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          pairId: descriptor.pairId!,
          scenarioParticipantId: controlledByContinuedContact
            ? descriptor.participantId
            : undefined,
          taskId: descriptor.taskId,
        });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });
      setInspectionSelection(nextInspectionSelection);
      acceptCanonicalEncounterState(nextEncounter, nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      setRoundEndDistanceOverrideDrafts((current) => {
        const next = { ...current };

        delete next[descriptor.proposalId!];

        return next;
      });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to apply distance control.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollRoundEndDistanceControlFromPrimaryAction(
    candidate: CurrentActionCommandDescriptor,
  ) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["roll_round_end_distance_control"],
      presentation: currentActionPresentation,
      requiredFields: [
        "executionGroupId",
        "expectedRevision",
        "opponentParticipantId",
        "pairId",
        "participantId",
        "proposalId",
        "taskId",
      ],
    });
    if (!descriptor || !selectedRoundIsActive) {
      return;
    }

    setSaving(true);

    try {
      const { commandEnvelope, encounter: nextEncounter } =
        await rollCurrentRoundEndDistanceControlOnServer({
          currentEncounter: encounter,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          opponentParticipantId: descriptor.opponentParticipantId!,
          pairId: descriptor.pairId!,
          participantId: descriptor.participantId!,
          proposalId: descriptor.proposalId!,
          taskId: descriptor.taskId,
        });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      acceptCanonicalEncounterState(nextEncounter, nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to roll distance control.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function completeRemainingInspectorStep(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: [
        "review_modifiers_phase1",
        "review_modifiers_phase2",
        "roll_initiative_phase1",
        "roll_initiative_phase2",
        "roll_combat_experience",
        "roll_round_end_health_check",
        "roll_observation",
        "roll_continued_contact_maintenance",
        "roll_round_end_distance_control",
        "declare_action",
      ],
      presentation: currentActionPresentation,
      requiredFields: [
        "executionGroupId",
        "expectedRevision",
        "participantId",
        "processId",
        "taskId",
      ],
    });
    if (!descriptor) {
      setSaveError("Combat state changed. Review the current action before continuing.");
      return;
    }
    const operationFamily =
      descriptor.commandType === "roll_initiative_phase1" ||
      descriptor.commandType === "roll_initiative_phase2" ||
      descriptor.commandType === "roll_combat_experience" ||
      descriptor.commandType === "roll_round_end_health_check" ||
      descriptor.commandType === "roll_observation" ||
      descriptor.commandType === "roll_continued_contact_maintenance" ||
      descriptor.commandType === "roll_round_end_distance_control"
        ? "roll_remaining"
        : "accept_remaining";
    if (operationFamily === "accept_remaining" && inspectorHasLocalModifierEdits) {
      setSaveError("Save or cancel the current modifier draft before continuing the workflow.");
      return;
    }

    setSaving(true);
    try {
      const {
        commandEnvelope,
        declarationProposal,
        encounter: nextEncounter,
        participants,
        workflow,
      } = await runGmCombatStepWorkflowOnServer({
        currentEncounter: encounter,
        encounterId: encounter.id,
        expectedExecutionGroupId: descriptor.executionGroupId!,
        expectedProcessId: descriptor.processId!,
        expectedRevision: descriptor.expectedRevision,
        expectedRound: roundState.roundNumber,
        expectedStep: roundState.currentStep,
        expectedTaskId: descriptor.taskId,
        operationFamily,
        runId: crypto.randomUUID(),
      });
      if (participants.length > 0) {
        setScenarioParticipantOverrides((current) => ({
          ...current,
          ...Object.fromEntries(participants.map((participant) => [participant.id, participant])),
        }));
        onScenarioParticipantsUpdated?.(participants);
      }
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      acceptCanonicalEncounterState(nextEncounter, nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setStepWorkflowStatus(workflow);
      setStepWorkflowDeclarationProposal(declarationProposal);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to run the combat workflow.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function skipInspectorCurrentPhaseAction(candidate: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: ["roll_attack"],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "participantId", "phase", "taskId"],
    });
    if (!descriptor?.participantId || !descriptor.phase) {
      setSaveError("Combat state changed. Review the current action before continuing.");
      return;
    }

    setSaving(true);
    try {
      const { commandEnvelope, encounter: nextEncounter } =
        await skipCurrentCombatPhaseActionOnServer({
          currentEncounter: encounter,
          encounterId: encounter.id,
          executionGroupId: descriptor.executionGroupId!,
          expectedRevision: descriptor.expectedRevision,
          participantId: descriptor.participantId,
          phase: descriptor.phase,
          processId: descriptor.processId,
          stageId: descriptor.stageId,
          taskId: descriptor.taskId,
        });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      acceptCanonicalEncounterState(nextEncounter, nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to skip the current action.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function invokeResultProducingGmCommand(
    descriptor: CurrentActionCommandDescriptor,
    operation: () => Promise<void>,
  ) {
    const sourceParticipantId = inspector.participant?.participantId;
    const candidate = sourceParticipantId
      ? createCombatRecentResultCandidate({
          commandType: descriptor.commandType,
          presentation: gmCurrentStepResultPresentation,
          source: {
            participantId: sourceParticipantId,
            roundNumber: selectedRoundNumber,
            step: inspector.step,
          },
          sourceTaskId: descriptor.taskId,
        })
      : undefined;
    const acceptedBefore = acceptedEncounterRevisionRef.current;

    await operation();

    const acceptedAfter = acceptedEncounterRevisionRef.current;
    if (
      candidate &&
      acceptedAfter.encounterId === acceptedBefore.encounterId &&
      acceptedAfter.updatedAt !== acceptedBefore.updatedAt
    ) {
      setRecentResultRequest({
        acceptedRevision: acceptedAfter.updatedAt,
        candidate,
      });
    }
  }

  function invokeGmCurrentAction(candidate?: CurrentActionCommandDescriptor) {
    const descriptor = resolveCombatTaskCommandContext({
      descriptor: candidate,
      expectedCommandTypes: candidate ? [candidate.commandType] : [],
      presentation: currentActionPresentation,
      requiredFields: ["executionGroupId", "expectedRevision", "taskId"],
    });
    if (!descriptor) {
      setSaveError("Combat state changed. Review the current action before continuing.");
      return;
    }
    beginCombatPerformanceInteraction({
      command: inspectorBulkStepCompletionSelected
        ? "complete_remaining_step"
        : inspectorSkipActionSelected
          ? "skip_current_phase_action"
          : descriptor.commandType,
      encounterId: encounter.id,
      expectedRevision: descriptor.expectedRevision,
      participantCount: roundState.participants.length,
      roundNumber: roundState.roundNumber,
    });
    if (inspectorBulkStepCompletionSelected) {
      void completeRemainingInspectorStep(descriptor);
      return;
    }
    if (inspectorSkipActionSelected) {
      void skipInspectorCurrentPhaseAction(descriptor);
      return;
    }

    switch (descriptor.commandType) {
      case "advance_combat_boundary":
      case "commit_phase_initiative_resolution":
      case "complete_round":
        void commitCurrentStep(descriptor);
        return;
      case "respond_adjust_distance":
      case "review_adjust_distance_roll_adjustment":
      case "roll_adjust_distance":
      case "commit_adjust_distance":
        void invokeResultProducingGmCommand(descriptor, () =>
          advanceInspectorAdjustDistance(descriptor),
        );
        return;
      case "roll_parry":
        void invokeResultProducingGmCommand(descriptor, () => rollInspectorParry(descriptor));
        return;
      case "roll_offensive_parry_brawling":
        void invokeResultProducingGmCommand(descriptor, () =>
          rollInspectorOffensiveParryBrawling(descriptor),
        );
        return;
      case "roll_continued_contact_maintenance":
        void invokeResultProducingGmCommand(descriptor, () =>
          rollContinuedContactMaintenance(descriptor),
        );
        return;
      case "roll_observation":
        void invokeResultProducingGmCommand(descriptor, () => rollObservation(descriptor));
        return;
      case "roll_hit_location":
      case "roll_critical":
      case "resolve_damage":
      case "commit_phase_damage":
        void invokeResultProducingGmCommand(descriptor, () =>
          invokeGmDownstreamCombatTask(descriptor),
        );
        return;
      case "roll_feint":
        void invokeResultProducingGmCommand(descriptor, () => rollInspectorFeint(descriptor));
        return;
      case "commit_feint_result":
        void invokeResultProducingGmCommand(descriptor, () => commitInspectorFeint(descriptor));
        return;
      case "decide_double_attack_phase2":
        void decideInspectorDoubleAttackPhase2(descriptor);
        return;
      case "submit_phase_initiative_choice":
        if (inspectorPhaseAttackChoiceIsBackOut) {
          void backOutInspectorPhaseAttack(descriptor);
        } else if (inspectorPhaseCombatExperienceRequirement) {
          void invokeResultProducingGmCommand(descriptor, () =>
            rollInspectorCombatExperience(descriptor),
          );
        } else {
          void continueInspectorPhaseAttack(descriptor);
        }
        return;
      case "set_combat_experience_difficulty":
        void saveCombatExperienceDifficultyDraft(descriptor);
        return;
      case "roll_combat_experience":
        void invokeResultProducingGmCommand(descriptor, () =>
          rollInspectorCombatExperience(descriptor),
        );
        return;
      case "roll_round_end_distance_control":
        void invokeResultProducingGmCommand(descriptor, () =>
          rollRoundEndDistanceControlFromPrimaryAction(descriptor),
        );
        return;
      case "commit_round_end_distance_control":
        void invokeResultProducingGmCommand(descriptor, () =>
          commitRoundEndDistanceControl(descriptor),
        );
        return;
      case "roll_round_end_health_check":
        void invokeResultProducingGmCommand(descriptor, () =>
          advanceInspectorRoundEndReview(descriptor),
        );
        return;
      case "commit_round_end_participant_review":
        void advanceInspectorRoundEndReview(descriptor);
        return;
      case "roll_initiative_phase1":
      case "roll_initiative_phase2":
        void invokeResultProducingGmCommand(descriptor, () => rollInspectorInitiative(descriptor));
        return;
      case "roll_attack":
        void invokeResultProducingGmCommand(descriptor, () => rollInspectorPhaseAttack(descriptor));
        return;
      case "declare_action":
      case "review_modifiers_phase1":
      case "review_modifiers_phase2":
        void saveInspectorDeclaration(descriptor);
        return;
      case "prepare_round_end_review":
        // This descriptor is consumed by the single guarded preparation effect.
        return;
      default:
        setSaveError("This combat task does not have a canonical command handler.");
    }
  }

  recordCombatPerformanceStage(
    "combat_panel_view_model",
    combatPerformanceNow() - panelViewModelStartedAt,
    {
      archivedRoundCount: timelineRoundStates.length - 1,
    },
  );

  return (
    <Profiler
      id="CombatRoundManagerPanel"
      onRender={(_id, phase, actualDuration, baseDuration) =>
        recordCombatPerformanceReactCommit({
          actualDuration,
          baseDuration,
          phase,
        })
      }
    >
      <section style={panelStyle}>
        <div
          style={{
            alignItems: "start",
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Combat Round Manager</h2>
          </div>
          <section
            aria-label="Step controller"
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <button
                disabled={saving || !currentTaskSelection}
                onClick={selectCurrentTask}
                title="Return to the current unresolved combat step"
                type="button"
              >
                {inspectorIsHistorical ? "Resume current task" : "Current task"}
              </button>
              <button
                disabled={saving || !clearCurrentStepAvailable}
                onClick={() => void clearCurrentStep()}
                type="button"
              >
                Clear current step
              </button>
            </div>
          </section>
        </div>

        {saveError ? (
          <div
            style={{
              background: "#fdf0ea",
              border: "1px solid #e4b9a7",
              borderRadius: 10,
              color: "#8b3a1a",
              padding: "0.75rem",
            }}
          >
            {saveError}
          </div>
        ) : null}

        {inspectorEquipmentDiagnostic && selectedScenarioParticipant ? (
          <div
            role="alert"
            style={{
              background: "#fff8e7",
              border: "1px solid #d9c79b",
              borderRadius: 8,
              padding: "0.75rem",
            }}
          >
            {inspectorEquipmentDiagnostic}
          </div>
        ) : null}

        <CombatTracker
          followCurrent={!inspectorIsHistorical}
          model={trackerModel}
          onInspect={(cell) => selectInspector(cell.participantId, cell.step, cell.roundNumber)}
          onKeyDown={handleTimelineKeyDown}
          positionCurrentRequest={trackerPositionRequest}
          registerCell={(cellKey, node, _currentTask) => {
            timelineCellRefs.current[cellKey] = node;
          }}
          tableRef={tableContainerRef}
        />
        <section
          aria-label="Combat round inspector"
          style={{
            border: "1px solid #e3e1dc",
            borderRadius: 10,
            display: "grid",
            gap: "0.75rem",
            padding: "0.75rem",
          }}
        >
          {inspector.participant ? (
            <>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>
                    Combat inspector — {inspector.participant.label} · Round {selectedRoundNumber} ·{" "}
                    {COMBAT_ROUND_STEP_LABELS[inspector.step]}
                  </h3>
                  <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>
                    {COMBAT_ROUND_STEP_LABELS[inspector.step]} ·{" "}
                    {inspectorIsHistorical && inspectorHistoricalStatusLabel
                      ? inspectorHistoricalStatusLabel
                      : formatStepStatus(inspector.status)}
                    {inspectorSnapshot ? " · Committed" : ""}
                  </div>
                </div>
                <div style={inspectorNavStyle}>
                  <button onClick={() => moveSelection({ participantOffset: -1 })} type="button">
                    Previous participant
                  </button>
                  <button onClick={() => moveSelection({ participantOffset: 1 })} type="button">
                    Next participant
                  </button>
                  <button onClick={() => moveSelection({ stepOffset: -1 })} type="button">
                    Previous step
                  </button>
                  <button onClick={() => moveSelection({ stepOffset: 1 })} type="button">
                    Next step
                  </button>
                </div>
              </div>

              {selectedScenarioParticipant ? (
                <>
                  <div style={playerCombatTopPanelRowStyle}>
                    {inspectorIsHistorical && !inspectorHistoricalSelectorFactsComplete ? (
                      <section style={playerCombatPanelCardStyle}>
                        <strong>Action selector · History</strong>
                        <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                          No information available for this panel.
                        </div>
                      </section>
                    ) : inspectorIsHistorical ? (
                      <PlayerCombatHistoricalActionSelectorPanel
                        actionLabel={
                          inspectorHistoricalDeclarationSummary?.actionLabel ??
                          (inspectorDisplayDraft.actionId
                            ? getPlayerEncounterActionLabel(inspectorDisplayDraft.actionId)
                            : undefined)
                        }
                        additionalActionNotes={inspectorDisplayDraft.additionalActionNotes}
                        declarationRecorded
                        distancePreferences={inspectorDisplayDistancePreferenceOptions.map(
                          (preference) => ({
                            desiredDistance: preference.defaultDistance,
                            displayName: preference.displayName,
                          }),
                        )}
                        movementLabel={
                          inspectorHistoricalDeclarationSummary?.movementLabel ??
                          (inspectorDisplayDraft.movementId
                            ? getPlayerEncounterMovementLabel(inspectorDisplayDraft.movementId)
                            : undefined)
                        }
                        roundNumber={selectedRoundNumber}
                        secondaryActionLabel={
                          inspectorHistoricalDeclarationSummary?.secondaryActionLabel ??
                          (inspectorDisplayDraft.secondaryActionId
                            ? getPlayerEncounterActionLabel(inspectorDisplayDraft.secondaryActionId)
                            : undefined)
                        }
                      />
                    ) : (
                      <PlayerCombatActionSelectorPanel
                        actionId={inspectorDisplayDraft.actionId}
                        actionOptions={inspectorHistoricalActionOptions}
                        additionalActionNotes={inspectorDisplayDraft.additionalActionNotes}
                        controlsDisabled={
                          saving ||
                          !selectedRoundIsActive ||
                          inspectorIsHistorical ||
                          inspectorCombatExperienceRequired
                        }
                        declarationRecorded={Boolean(inspector.participant?.declaration)}
                        distancePreferenceOptions={inspectorDisplayDistancePreferenceOptions}
                        movementId={inspectorDisplayDraft.movementId}
                        movementIntent={inspectorDisplayDraft.movementIntent}
                        onActionChange={(actionId) =>
                          updateInspectorDraft({
                            actionId,
                            ...(actionId === "feint_attack"
                              ? { feintMethod: "movement", feintSkillId: "dodge" }
                              : {}),
                          })
                        }
                        onAdditionalActionNotesChange={(additionalActionNotes) =>
                          updateInspectorDraft({ additionalActionNotes })
                        }
                        onMovementChange={(movementId) => updateInspectorDraft({ movementId })}
                        onMovementIntentChange={(movementIntent) =>
                          updateInspectorDraft({ movementIntent })
                        }
                        onSecondaryActionChange={(secondaryActionId) =>
                          updateInspectorDraft({
                            secondaryActionId,
                            ...(secondaryActionId === "observe_opponent"
                              ? {}
                              : { secondaryActionContext: undefined }),
                          })
                        }
                        roundNumber={selectedRoundNumber}
                        secondaryActionId={inspectorDisplayDraft.secondaryActionId}
                        sourceLabel={inspectorSourceLabel}
                      />
                    )}
                    {inspectorPhaseCards.map((phaseCard, index) => {
                      const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2";
                      const historicalPhasePanel = inspectorPanelSnapshot?.phasePanels?.[phaseKey];
                      const archivedPhaseProjection =
                        archivedInspectorPresentation?.phasePanels[phaseKey];
                      const phaseCombatContext = inspectorIsHistorical
                        ? (historicalPhasePanel?.phaseContext ??
                          createUnrecordedHistoricalPhaseContext())
                        : (inspectorRenderedDeclarationAttackSelection.phaseContexts[phaseKey] ??
                          inspectorNormalizedFeintPhaseContexts[phaseKey] ??
                          inspectorDisplayDraft.phaseContexts[phaseKey]);
                      const phaseLoadoutSummary = inspectorPhaseLoadoutSummaries[phaseKey];
                      const phaseTargetIdentity = !inspectorIsHistorical
                        ? resolveCanonicalCombatTargetIdentity({
                            encounterParticipants: encounter.participants,
                            targetParticipantId: phaseCombatContext.targetParticipantId,
                          })
                        : undefined;
                      const phaseTargetScenarioParticipant = !inspectorIsHistorical
                        ? effectiveScenarioParticipants.find(
                            (participant) =>
                              participant.id === phaseTargetIdentity?.scenarioParticipantId,
                          )
                        : undefined;
                      const phaseTargetEncounterParticipant =
                        !inspectorIsHistorical && phaseTargetIdentity
                          ? encounter.participants.find(
                              (participant) =>
                                participant.id === phaseTargetIdentity.encounterParticipantId,
                            )
                          : undefined;
                      const phaseDistanceRow = !inspectorIsHistorical
                        ? getCombatDistanceTableRowForParticipants({
                            participantAId: inspector.participant?.participantId,
                            participantAAliases: getCombatDistanceParticipantAliases(
                              inspector.participant,
                            ),
                            participantBId: phaseTargetEncounterParticipant?.id,
                            participantBAliases: [
                              ...getCombatDistanceParticipantAliases(
                                phaseTargetEncounterParticipant,
                              ),
                              ...getCombatDistanceParticipantAliases(
                                phaseTargetScenarioParticipant,
                              ),
                            ],
                            rows: combatDistanceRows,
                          })
                        : undefined;
                      const phaseSourceLabel = getCombatInspectorSourceLabel(
                        inspectorIsHistorical ? "history" : "current",
                      );
                      const phaseDistanceLabel = inspectorIsHistorical
                        ? historicalPhasePanel?.distanceLabel
                        : phaseTargetEncounterParticipant
                          ? `Distance: ${phaseDistanceRow?.edge.distance ?? "—"}`
                          : undefined;
                      const buildPhaseProjection = () => {
                        const phaseProjectionStartedAt = combatPerformanceNow();
                        const phaseDefenseStats = !inspectorIsHistorical
                          ? (() => {
                              const stats = buildPlayerCombatDefenseStats({
                                mainHandParryItemLabel: phaseLoadoutSummary.mainHandParryItemLabel,
                                offHandParryItemLabel: phaseLoadoutSummary.offHandParryItemLabel,
                                phaseContext: phaseCombatContext,
                                reference: phaseLoadoutSummary.reference,
                              });
                              return stats
                                ? {
                                    ...stats,
                                    provisional: inspectorHasLocalModifierEdits,
                                  }
                                : null;
                            })()
                          : null;
                        const selectedResolutionContext =
                          !inspectorIsHistorical &&
                          phaseKey === inspectorResolutionPhase &&
                          inspector.participant?.participantId ===
                            inspectorResolutionAttackResult?.defenderParticipantId &&
                          (inspectorResolutionStepKind === "parry" ||
                            inspectorResolutionStepKind === "damage") &&
                          inspectorDisplayPhaseResolutionResult
                            ? {
                                attackResultId:
                                  inspectorDisplayPhaseResolutionResult.attackResultId,
                                parryBase: inspectorParryBase,
                                parryModifierCalculation: inspectorParryModifierCalculation,
                                parryResolution:
                                  inspectorDisplayPhaseResolutionResult.parryResolution,
                                parrySourceLabel: formatSelectedCombatParrySourceName({
                                  selection: inspectorParrySelection,
                                  sources: inspectorParrySources,
                                }),
                              }
                            : undefined;
                        const projection = buildCombatRoundPhasePanelProjection({
                          actionId: inspectorDisplayDraft.actionId,
                          attackStats: inspectorIsHistorical
                            ? null
                            : phaseLoadoutSummary.attackStats,
                          liveModifiers: inspectorIsHistorical
                            ? undefined
                            : phaseKey === inspectorResolutionPhase
                              ? inspectorParryDefenderPhaseSummary?.liveModifiers
                              : buildEncounterLiveCombatModifierSummary({
                                  combatContext: inspectorGeneratedCombatContext,
                                  combatEffects: selectedScenarioParticipant?.state.combatEffects,
                                  phaseKey,
                                }),
                          participantId: inspector.participant?.participantId,
                          phaseCard,
                          phaseContext: phaseCombatContext,
                          phaseDefenseStats: inspectorIsHistorical ? null : phaseDefenseStats,
                          phaseKey,
                          secondaryActionId: inspectorDisplayDraft.secondaryActionId,
                          selectedResolutionContext,
                          selectedStep: inspector.step,
                          snapshotAttackStats: historicalPhasePanel?.attackSummary,
                          snapshotDefenseStats: historicalPhasePanel?.defenseSummary,
                        });
                        recordCombatPerformanceStage(
                          "panel_phase_summary_presentation",
                          combatPerformanceNow() - phaseProjectionStartedAt,
                          { historical: inspectorIsHistorical, phaseKey },
                        );
                        return projection;
                      };
                      const phaseProjection = archivedPhaseProjection
                        ? archivedPhaseProjection
                        : !inspectorIsHistorical
                          ? combatPresentation.active.inspectorPresentation.resolve({
                              build: buildPhaseProjection,
                              dependencies: [
                                inspectorDisplayDraft.actionId,
                                phaseLoadoutSummary,
                                inspectorGeneratedCombatContext,
                                selectedScenarioParticipant?.state.combatEffects,
                                inspector.participant?.participantId,
                                phaseCard,
                                phaseCombatContext,
                                phaseKey,
                                inspectorDisplayDraft.secondaryActionId,
                                inspectorResolutionPhase,
                                inspectorResolutionAttackResult,
                                inspectorResolutionStepKind,
                                inspectorDisplayPhaseResolutionResult,
                                inspectorParryBase,
                                inspectorParryModifierCalculation,
                                inspectorParrySelection,
                                inspectorParrySources,
                                inspector.step,
                              ],
                              key: `phase-panel:${inspector.participant?.participantId ?? "none"}:${inspector.step}:${phaseKey}`,
                            })
                          : buildPhaseProjection();
                      const phaseModel = phaseProjection.phaseModel;

                      /*
                       * The phase projection is intentionally context-aware:
                       * normal rows use phase-aware stats, while selected P/D
                       * rows can replay the specific incoming attack's parry
                       * context without leaking it into later actor views.
                       */

                      return (
                        <PlayerCombatPhasePanel
                          key={phaseModel.phaseCard.phaseLabel}
                          phaseCard={phaseCard}
                          sourceLabel={phaseSourceLabel}
                        >
                          {inspectorIsHistorical && !historicalPhasePanel ? (
                            <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                              No information available for this panel.
                            </div>
                          ) : inspectorDisplayDraft.actionId === "offensive_parry" &&
                            phaseKey === "phase1" ? (
                            <div style={{ display: "grid", gap: "0.65rem" }}>
                              <PlayerCombatOpponentSelector
                                controlsDisabled={saving || inspectorIsHistorical}
                                onSelectedOpponentChange={(selectedOpponentId) =>
                                  updateInspectorDraft({
                                    combatContext: {
                                      ...inspectorDisplayDraft.combatContext,
                                      selectedOpponentId: selectedOpponentId || undefined,
                                    },
                                  })
                                }
                                opponentOptions={inspectorTargetOptions}
                                readOnly={inspectorIsHistorical}
                                selectedOpponentId={
                                  inspectorDisplayDraft.combatContext.selectedOpponentId
                                }
                              />
                            </div>
                          ) : inspectorDisplayDraft.secondaryActionId === "observe_opponent" &&
                            phaseKey === "phase1" ? (
                            <div style={{ display: "grid", gap: "0.65rem" }}>
                              <PlayerCombatOpponentSelector
                                controlsDisabled={saving || inspectorIsHistorical}
                                label="Opponent"
                                onSelectedOpponentChange={(targetParticipantId) =>
                                  updateInspectorDraft({
                                    secondaryActionContext: targetParticipantId
                                      ? { action: "observe_opponent", targetParticipantId }
                                      : undefined,
                                  })
                                }
                                opponentOptions={inspectorTargetOptions}
                                readOnly={inspectorIsHistorical}
                                selectedOpponentId={
                                  inspectorDisplayDraft.secondaryActionContext?.targetParticipantId
                                }
                              />
                              <PlayerCombatObservationProgress
                                relationships={
                                  inspectorIsHistorical
                                    ? (archivedInspectorPresentation?.historicalContext
                                        .observationRelationships ?? [])
                                    : selectedTimelineRoundState.observationRelationships.filter(
                                        (relationship) =>
                                          relationship.observerParticipantId ===
                                          selectedEncounterParticipant?.id,
                                      )
                                }
                                targetLabels={Object.fromEntries(
                                  selectedTimelineRoundState.participants.map((participant) => [
                                    participant.participantId,
                                    participant.label,
                                  ]),
                                )}
                              />
                            </div>
                          ) : inspectorDisplayDraft.actionId === "adjust_range_attack" &&
                            phaseKey === "phase1" ? (
                            <div style={{ display: "grid", gap: "0.65rem" }}>
                              <PlayerCombatAttackTargetSelector
                                combatContext={phaseModel.phaseContext}
                                controlsDisabled={saving || inspectorIsHistorical}
                                distanceLabel={phaseDistanceLabel}
                                onCombatContextChange={(combatContext) =>
                                  updateInspectorDraft({
                                    phaseContexts: {
                                      phase1: combatContext,
                                      phase2: {
                                        ...inspectorDraft.phaseContexts.phase2,
                                        targetParticipantId: combatContext.targetParticipantId,
                                      },
                                    },
                                  })
                                }
                                readOnly={inspectorIsHistorical}
                                targetOptions={inspectorTargetOptions}
                              />
                              <label style={compactFieldLabelStyle}>
                                <strong>Requested distance</strong>
                                {inspectorIsHistorical ? (
                                  <span style={{ color: "#5e5a50" }}>
                                    {inspectorDisplayDraft.movementIntent.distancePreferences.find(
                                      (entry) =>
                                        entry.targetParticipantId ===
                                        phaseModel.phaseContext.targetParticipantId,
                                    )?.desiredDistance ?? "No recorded information"}
                                  </span>
                                ) : (
                                  <select
                                    disabled={saving}
                                    onChange={(event) => {
                                      const targetParticipantId =
                                        phaseModel.phaseContext.targetParticipantId;
                                      if (!targetParticipantId) return;
                                      updateInspectorDraft({
                                        movementIntent: {
                                          ...inspectorDraft.movementIntent,
                                          distancePreferences: [
                                            ...inspectorDraft.movementIntent.distancePreferences.filter(
                                              (entry) =>
                                                entry.targetParticipantId !== targetParticipantId,
                                            ),
                                            {
                                              desiredDistance: Number(event.target.value) as
                                                | 0
                                                | 1
                                                | 2
                                                | 3
                                                | 4
                                                | 5
                                                | 6
                                                | 7
                                                | 8,
                                              source: "gm_proxy",
                                              targetParticipantId,
                                            },
                                          ],
                                        },
                                      });
                                    }}
                                    value={
                                      inspectorDraft.movementIntent.distancePreferences.find(
                                        (entry) =>
                                          entry.targetParticipantId ===
                                          phaseModel.phaseContext.targetParticipantId,
                                      )?.desiredDistance ??
                                      inspectorDistancePreferenceOptions.find(
                                        (option) =>
                                          option.id === phaseModel.phaseContext.targetParticipantId,
                                      )?.defaultDistance ??
                                      2
                                    }
                                  >
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((distance) => (
                                      <option key={distance} value={distance}>
                                        {distance}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </label>
                              <div>Skill: Dodge</div>
                              <div>The defender may oppose or allow the maneuver.</div>
                            </div>
                          ) : inspectorDisplayDraft.actionId === "feint_attack" &&
                            phaseKey === "phase1" ? (
                            <div style={{ display: "grid", gap: "0.65rem" }}>
                              <PlayerCombatAttackTargetSelector
                                combatContext={phaseModel.phaseContext}
                                controlsDisabled={saving || inspectorIsHistorical}
                                distanceLabel={phaseDistanceLabel}
                                onCombatContextChange={(combatContext) =>
                                  updateInspectorDraft({
                                    phaseContexts: {
                                      phase1: combatContext,
                                      phase2: {
                                        ...inspectorDraft.phaseContexts.phase2,
                                        targetParticipantId: combatContext.targetParticipantId,
                                      },
                                    },
                                  })
                                }
                                readOnly={inspectorIsHistorical}
                                targetOptions={inspectorTargetOptions}
                              />
                              <label style={compactFieldLabelStyle}>
                                <strong>Feint method</strong>
                                {inspectorIsHistorical ? (
                                  <span style={{ color: "#5e5a50" }}>
                                    {inspectorDisplayDraft.feintMethod === "weapon"
                                      ? "Weapon"
                                      : "Movement"}
                                  </span>
                                ) : (
                                  <select
                                    disabled={saving}
                                    onChange={(event) => {
                                      const method =
                                        event.target.value === "weapon" ? "weapon" : "movement";
                                      updateInspectorDraft({
                                        feintMethod: method,
                                        feintSkillId: "dodge",
                                      });
                                    }}
                                    value={inspectorDisplayDraft.feintMethod}
                                  >
                                    <option value="movement">Movement</option>
                                    <option value="weapon">Weapon</option>
                                  </select>
                                )}
                              </label>
                              {inspectorIsHistorical ? (
                                <>
                                  <div>
                                    <strong>Skill:</strong>{" "}
                                    {inspectorResolvedFeintSkill?.label ?? "Unavailable"}
                                  </div>
                                  <div>Characteristic: Dexterity</div>
                                </>
                              ) : (
                                <FeintSkillPreview preview={inspectorFeintSkillPreview} />
                              )}
                              <div>Defender: highest close-combat skill · Intelligence</div>
                            </div>
                          ) : phaseModel.showAttackStats && phaseModel.attackStats ? (
                            <PlayerCombatAttackStatsTable stats={phaseModel.attackStats} />
                          ) : null}
                          {(!inspectorIsHistorical || historicalPhasePanel) &&
                          phaseModel.showAttackLocationSelector &&
                          !(
                            inspectorDisplayDraft.actionId === "feint_attack" &&
                            phaseKey === "phase1"
                          ) ? (
                            <>
                              <PlayerCombatAttackTargetSelector
                                combatContext={phaseModel.phaseContext}
                                controlsDisabled={saving || inspectorIsHistorical}
                                distanceLabel={phaseDistanceLabel}
                                onCombatContextChange={(combatContext) =>
                                  updateInspectorDraft({
                                    phaseContexts:
                                      (inspectorDisplayDraft.actionId === "feint_attack" ||
                                        inspectorDisplayDraft.actionId === "adjust_range_attack") &&
                                      phaseKey === "phase2"
                                        ? {
                                            phase1: {
                                              ...inspectorDraft.phaseContexts.phase1,
                                              targetParticipantId:
                                                combatContext.targetParticipantId,
                                            },
                                            phase2: combatContext,
                                          }
                                        : {
                                            ...inspectorDraft.phaseContexts,
                                            [phaseKey]: combatContext,
                                          },
                                  })
                                }
                                readOnly={
                                  inspectorIsHistorical ||
                                  ((inspectorDisplayDraft.actionId === "feint_attack" ||
                                    inspectorDisplayDraft.actionId === "adjust_range_attack") &&
                                    phaseKey === "phase2")
                                }
                                targetOptions={
                                  historicalPhasePanel?.targetOptions ?? inspectorTargetOptions
                                }
                              />
                              <PlayerCombatAttackLocationSelector
                                combatContext={phaseModel.phaseContext}
                                controlsDisabled={saving || inspectorIsHistorical}
                                onCombatContextChange={(combatContext) =>
                                  updateInspectorDraft({
                                    phaseContexts: {
                                      ...inspectorDraft.phaseContexts,
                                      [phaseKey]: combatContext,
                                    },
                                  })
                                }
                                readOnly={inspectorIsHistorical}
                              />
                              <PlayerCombatAttackModeSelector
                                controlsDisabled={saving || inspectorIsHistorical}
                                emptyState={
                                  inspectorIsHistorical
                                    ? undefined
                                    : phaseLoadoutSummary.attackModeUnavailableMessage
                                }
                                onChange={(attackModeId) =>
                                  updateInspectorDraft({
                                    phaseContexts: {
                                      ...inspectorDraft.phaseContexts,
                                      [phaseKey]: {
                                        ...inspectorDraft.phaseContexts[phaseKey],
                                        attackModeId,
                                      },
                                    },
                                  })
                                }
                                options={
                                  inspectorIsHistorical
                                    ? phaseCombatContext.attackModeId
                                      ? [
                                          {
                                            id: phaseCombatContext.attackModeId,
                                            label:
                                              historicalPhasePanel?.attackModeLabel ??
                                              phaseCombatContext.attackModeId,
                                          },
                                        ]
                                      : []
                                    : phaseLoadoutSummary.attackModeOptions
                                }
                                selectedAttackModeId={
                                  inspectorIsHistorical
                                    ? phaseCombatContext.attackModeId
                                    : phaseModel.phaseContext.attackModeId
                                }
                                readOnly={inspectorIsHistorical}
                              />
                            </>
                          ) : null}
                          {(!inspectorIsHistorical || historicalPhasePanel) &&
                          phaseModel.showDefenseContext ? (
                            <>
                              {phaseModel.defenseStats ? (
                                <PlayerCombatDefenseStatsTable stats={phaseModel.defenseStats} />
                              ) : (
                                <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                                  Defense information unavailable.
                                </div>
                              )}
                              <PlayerCombatParryContextPanel
                                combatContext={phaseModel.phaseContext}
                                controlsDisabled={saving || inspectorIsHistorical}
                                mainHandItemLabel={
                                  historicalPhasePanel?.mainHandParryItemLabel ??
                                  phaseLoadoutSummary.mainHandParryItemLabel
                                }
                                offHandItemLabel={
                                  historicalPhasePanel?.offHandParryItemLabel ??
                                  phaseLoadoutSummary.offHandParryItemLabel
                                }
                                onCombatContextChange={(combatContext) =>
                                  updateInspectorDraft({
                                    phaseContexts: {
                                      ...inspectorDraft.phaseContexts,
                                      [phaseKey]: combatContext,
                                    },
                                  })
                                }
                                readOnly={inspectorIsHistorical}
                              />
                            </>
                          ) : null}
                        </PlayerCombatPhasePanel>
                      );
                    })}
                  </div>

                  <div style={playerCombatPanelRowStyle}>
                    {inspectorIsHistorical && !inspectorPanelSnapshot?.modifierSummary ? (
                      <section style={playerCombatPanelCardStyle}>
                        <strong>Combat situation · History</strong>
                        <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                          No information available for this panel.
                        </div>
                      </section>
                    ) : (
                      <PlayerCombatModifierPanel
                        activeSpecialEffectCount={
                          inspectorIsHistorical
                            ? 0
                            : (inspectorLiveModifiers.specialEffectCount ?? 0)
                        }
                        context={inspectorModifierContext}
                        controlsDisabled={saving}
                        onAddEntry={(bucketKey, entry) =>
                          updateInspectorModifierBucket(bucketKey, (current) => [
                            ...current,
                            entry ?? createModifierEntryDraft(),
                          ])
                        }
                        onRemoveEntry={(bucketKey, entryId) =>
                          updateInspectorModifierBucket(bucketKey, (current) =>
                            current.filter((entry) => entry.id !== entryId),
                          )
                        }
                        onUpdateEntry={(bucketKey, entryId, patch) =>
                          updateInspectorModifierBucket(bucketKey, (current) =>
                            current.map((entry) =>
                              entry.id === entryId
                                ? {
                                    ...entry,
                                    ...patch,
                                  }
                                : entry,
                            ),
                          )
                        }
                        readOnly={
                          inspectorIsHistorical ||
                          (inspector.step !== "review_action_modifiers" &&
                            inspector.step !== "review_phase_2_modifiers")
                        }
                        pendingActivationLabel={
                          combatProgressionProjection.executionOrder?.currentInitiativeValue !==
                          undefined
                            ? `Effective after Initiative ${combatProgressionProjection.executionOrder.currentInitiativeValue} finishes`
                            : undefined
                        }
                        pendingEntries={
                          inspectorIsHistorical ? [] : inspectorPendingModifierEntries
                        }
                        pendingRows={inspectorSuPendingRows}
                        provisional={!inspectorIsHistorical && inspectorLiveModifiers.provisional}
                        lifecycleEffects={inspectorModifierLifecycleEffects}
                        rows={inspectorDisplayModifierRows}
                        showEmptyCategories={
                          !inspectorIsHistorical &&
                          (inspector.step === "review_action_modifiers" ||
                            inspector.step === "review_phase_2_modifiers")
                        }
                        sourceLabel={inspectorModifierSourceLabel}
                      />
                    )}
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {showInspectorInitiativeContextPanel ? (
                        <section style={playerCombatPanelCardStyle}>
                          <strong>Initiative</strong>
                          <div
                            style={{
                              color: "#5e5a50",
                              display: "grid",
                              fontSize: "0.85rem",
                              gap: "0.2rem",
                            }}
                          >
                            <div>
                              Base initiative {inspectorInitiativeCalculation.baseInitiative}
                            </div>
                            <div>
                              Initiative modifiers{" "}
                              {inspectorInitiativeCalculation.rawModifierTotal >= 0 ? "+" : ""}
                              {inspectorInitiativeCalculation.rawModifierTotal}
                            </div>
                            <div>
                              Effective before roll{" "}
                              {inspectorInitiativeCalculation.modifiedInitiative}
                              {inspectorInitiativeCalculation.modifierAdjustment !== 0
                                ? ` (${inspectorInitiativeCalculation.modifierAdjustment >= 0 ? "+" : ""}${inspectorInitiativeCalculation.modifierAdjustment})`
                                : ""}
                            </div>
                            {inspectorInitiativeRollCounts ? (
                              <div>
                                Pending rolls: {inspectorInitiativeRollCounts.pending} of{" "}
                                {inspectorInitiativeRollCounts.total}
                              </div>
                            ) : null}
                            {inspectorDisplayInitiative ? (
                              <div style={{ color: "#3f5f46" }}>
                                {inspectorDisplayInitiativeResolutionType === "bulk_skipped"
                                  ? "Initiative bulk skipped by GM · effective 0."
                                  : inspectorDisplayInitiativeResolutionType === "gm_skipped"
                                    ? "Initiative skipped by GM · effective 0."
                                    : `Rolled initiative ${inspectorDisplayInitiative.total}.`}
                              </div>
                            ) : null}
                          </div>
                        </section>
                      ) : null}
                      {showInspectorPhaseCombatExperienceContextPanel ? (
                        <section style={playerCombatPanelCardStyle}>
                          <strong>Phase Combat Experience</strong>
                          <div
                            style={{
                              color: "#5e5a50",
                              display: "grid",
                              fontSize: "0.85rem",
                              gap: "0.2rem",
                            }}
                          >
                            {inspectorPhaseInitiativeChoice ? (
                              <div>Phase choice submitted. Waiting for GM commit.</div>
                            ) : (
                              <>
                                <div>
                                  {inspectorPhaseCombatExperienceRollRequired
                                    ? "CE roll required — attacked while attacking."
                                    : "No CE roll required — back-out available."}
                                </div>
                                <div>Effective CE {inspectorCombatExperienceSkillTotal}</div>
                                {inspectorPhaseCombatExperienceThreats.length > 0 ? (
                                  <div>
                                    Incoming attacker(s):{" "}
                                    {inspectorPhaseCombatExperienceThreats
                                      .map((threat) => {
                                        const attacker = roundState.participants.find(
                                          (participant) =>
                                            participant.participantId ===
                                            threat.attackerParticipantId,
                                        );

                                        return attacker?.label ?? threat.attackerParticipantId;
                                      })
                                      .join(", ")}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </section>
                      ) : null}
                      {showInspectorModifierReviewContextPanel ? (
                        <section style={playerCombatPanelCardStyle}>
                          <strong>Modifier review</strong>
                          <div
                            style={{
                              color: "#5e5a50",
                              display: "grid",
                              fontSize: "0.85rem",
                              gap: "0.2rem",
                            }}
                          >
                            <span>
                              Current effects:{" "}
                              {inspectorDisplayModifierRows.reduce(
                                (total, row) =>
                                  total +
                                  row.entries.length +
                                  (row.characterStateEntries?.length ?? 0) +
                                  (row.derivedEntries?.length ?? 0),
                                0,
                              )}
                            </span>
                            <span>Proposed: {inspectorPendingModifierEntries.length}</span>
                            <span>GM changes: {inspectorHasLocalModifierEdits ? 1 : 0}</span>
                            <strong style={{ color: "#1f1b14" }}>Ready to commit</strong>
                          </div>
                        </section>
                      ) : null}
                      {showInspectorCombatStartExperienceContextPanel ? (
                        <section style={playerCombatPanelCardStyle}>
                          <strong>Combat Experience</strong>
                          <div>{formatCombatExperienceStatus(inspectorCombatExperienceResult)}</div>
                          <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
                            Skill total {inspectorCombatExperienceSkillTotal}
                          </div>
                          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                            {inspectorCombatExperienceWindowOpen
                              ? `Open at difficulty ${activeCombatExperienceDifficulty}.`
                              : "Waiting for GM to start CE."}
                            {combatExperienceRollRecorded
                              ? " Difficulty locked after the first CE result."
                              : ""}
                          </div>
                          {inspectorCombatExperienceSkillLookup.warning ? (
                            <div style={{ color: "#8a4f21", fontSize: "0.85rem" }}>
                              {inspectorCombatExperienceSkillLookup.warning}
                            </div>
                          ) : null}
                        </section>
                      ) : null}
                      {!inspectorIsHistorical &&
                      inspectorResolutionStepKind === "parry" &&
                      inspectorResolutionAttackResult?.hit &&
                      inspectorDisplayPhaseResolutionResult &&
                      inspectorDisplayPhaseResolutionResult?.parryResolution.status !==
                        "not_applicable" ? (
                        <CombatParryResolutionPanel
                          attackResult={inspectorResolutionAttackResult}
                          controlsDisabled={
                            saving ||
                            inspectorIsInspectionOnly ||
                            Boolean(inspectorSnapshot) ||
                            inspectorDisplayPhaseResolutionResult.parryResolution.status ===
                              "resolved"
                          }
                          modifierAdjustment={inspectorParryModifierAdjustment}
                          modifierBreakdown={inspectorParryModifierBreakdown}
                          onSelectionChange={(selection) => {
                            if (!inspectorParrySelectionKey) {
                              return;
                            }

                            setParrySourceSelections((current) => ({
                              ...current,
                              [inspectorParrySelectionKey]: selection,
                            }));
                          }}
                          parryBase={inspectorParryBase}
                          resolution={inspectorDisplayPhaseResolutionResult.parryResolution}
                          selection={inspectorParrySelection}
                          sources={inspectorParrySources}
                        />
                      ) : null}
                      {!inspectorIsHistorical &&
                      inspectorDamageProposalReady &&
                      displayedDamageResolution?.damageResult ? (
                        <CombatDamageReviewPanel
                          attackerLabel={inspectorDamageAttackerLabel}
                          commitReadiness={inspectorDamageReviewCommitReadiness}
                          controlsDisabled={
                            saving || inspectorIsInspectionOnly || Boolean(inspectorSnapshot)
                          }
                          damageResult={displayedDamageResolution.damageResult}
                          defenderLabel={inspectorDamageDefenderLabel}
                          draft={inspectorDamageReviewDraft}
                          onDraftChange={(draft) => {
                            if (!inspectorDamageReviewKey) {
                              return;
                            }

                            setDamageReviewDrafts((current) => ({
                              ...current,
                              [inspectorDamageReviewKey]: draft,
                            }));
                          }}
                          onSaveReview={() => void saveInspectorDamageReview()}
                          saving={saving}
                        />
                      ) : null}
                      {!inspectorIsHistorical && inspector.step === "round_summary" ? (
                        <>
                          {inspectorRoundEndDistanceControlComplete ? (
                            <CombatRoundEndParticipantReviewPanel
                              controlsDisabled={saving || inspectorIsInspectionOnly}
                              observationPending={
                                inspectorRoundEndTask?.kind === "observation_roll" &&
                                inspectorRoundEndTask.owner?.kind === "combatant" &&
                                inspectorRoundEndTask.owner.participantId ===
                                  inspector.participant?.participantId
                              }
                              participantLabel={inspector.participant?.label}
                              review={inspectorRoundEndReview}
                            />
                          ) : null}
                          <CombatRoundEndDistanceControlPanel
                            participantLabelsById={roundParticipantLabelsById}
                            roundReview={selectedTimelineRoundState.roundEndReview}
                          />
                        </>
                      ) : null}
                      {inspectorIsHistorical ? (
                        <PlayerCombatHistoricalContextPanel
                          context={inspectorHistoricalStatusLabel}
                          roundNumber={selectedRoundNumber}
                          stepLabel={getPlayerCombatStepLabel(inspector.step)}
                        />
                      ) : (
                        <PlayerCombatActionButtonPanel
                          disabled={inspectorEffectiveActionButtonDisabled}
                          onDeclareAction={(descriptor?: CurrentActionCommandDescriptor) => {
                            invokeGmCurrentAction(descriptor);
                          }}
                          preActionControls={
                            inspectorSelectionIsCurrentProgression
                              ? inspectorPreActionControls
                              : undefined
                          }
                          presentation={
                            inspector.participant?.declaration
                              ? labelCurrentActionAsDeclarationEdit({
                                  participantId: inspector.participant.participantId,
                                  presentation: inspectorWorkflowPresentation,
                                })
                              : inspectorWorkflowPresentation
                          }
                          saving={saving}
                          statusText={
                            projectedBoundaryTransitionAction
                              ? `Current boundary complete. ${getBoundaryTransitionButtonLabel(
                                  projectedBoundaryTransitionAction.targetBoundary,
                                )}.`
                              : `Current step: ${getPlayerCombatStepLabel(
                                  inspector.step,
                                )}.${inspectorStatusSuffix}`
                          }
                          validationMessage={inspectorActionValidationMessage}
                        />
                      )}
                    </div>
                    {inspectorIsHistorical && inspectorHasCanonicalActionResult ? (
                      <CombatEventResultList
                        events={inspectorCanonicalActionResultEvents}
                        model={archivedInspectorPresentation?.canonicalActionResultModel}
                        title={`Historical result — Round ${selectedTimelineRoundState.roundNumber} · ${getPlayerCombatStepLabel(inspector.step)}`}
                      />
                    ) : inspectorIsHistorical && inspectorHistoricalActionResult ? (
                      <div style={{ display: "grid", gap: "0.3rem" }}>
                        {inspectorShowsLegacyResultFallback ? (
                          <div style={{ color: "#8a4f21", fontSize: "0.8rem", fontWeight: 700 }}>
                            Some historical result details are unavailable.
                          </div>
                        ) : null}
                        <PlayerCombatActionResultPanel
                          result={inspectorHistoricalActionResult}
                          title={`Historical result — Round ${selectedTimelineRoundState.roundNumber} · ${getPlayerCombatStepLabel(inspector.step)}`}
                        />
                      </div>
                    ) : inspectorIsHistorical ? (
                      <PlayerCombatActionResultPanel result={null} title="Historical result" />
                    ) : gmCurrentStepResultPresentation ? (
                      <CombatStepResultList
                        presentation={gmCurrentStepResultPresentation}
                        recentPresentation={recentResultPresentation}
                      />
                    ) : recentResultPresentation ? (
                      <CombatStepResultList
                        presentation={recentResultPresentation}
                        title="Recent result"
                      />
                    ) : (
                      <PlayerCombatActionResultPanel result={null} />
                    )}
                  </div>
                </>
              ) : (
                <div>No scenario participant state is available for this inspector row.</div>
              )}
            </>
          ) : (
            <>
              <div>
                <h3 style={{ margin: 0 }}>
                  Combat inspector — Round {selectedRoundNumber} ·{" "}
                  {COMBAT_ROUND_STEP_LABELS[inspector.step]}
                </h3>
                <div style={{ color: "#5e5a50", fontSize: "0.92rem" }}>
                  {COMBAT_ROUND_STEP_LABELS[inspector.step]} · Phase-wide
                </div>
              </div>

              <div style={playerCombatTopPanelRowStyle}>
                {["Declaration", "Phase 1", "Phase 2"].map((label) => (
                  <section key={label} style={playerCombatPanelCardStyle}>
                    <strong>{label}</strong>
                    <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>—</div>
                  </section>
                ))}
              </div>

              <div style={playerCombatPanelRowStyle}>
                <section style={playerCombatPanelCardStyle}>
                  <strong>Combat situation</strong>
                  <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>Phase-wide task</div>
                </section>
                <PlayerCombatActionButtonPanel
                  disabled={inspectorEffectiveActionButtonDisabled}
                  onDeclareAction={(descriptor?: CurrentActionCommandDescriptor) => {
                    invokeGmCurrentAction(descriptor);
                  }}
                  preActionControls={
                    inspectorSelectionIsCurrentProgression ? inspectorPreActionControls : undefined
                  }
                  presentation={inspectorWorkflowPresentation}
                  saving={saving}
                  statusText={
                    projectedBoundaryTransitionAction
                      ? `Current boundary complete. ${getBoundaryTransitionButtonLabel(
                          projectedBoundaryTransitionAction.targetBoundary,
                        )}.`
                      : `Current step: ${getPlayerCombatStepLabel(
                          inspector.step,
                        )}.${inspectorStatusSuffix}`
                  }
                  validationMessage={inspectorActionValidationMessage}
                />
                {gmCurrentStepResultPresentation ? (
                  <CombatStepResultList
                    presentation={gmCurrentStepResultPresentation}
                    recentPresentation={recentResultPresentation}
                  />
                ) : recentResultPresentation ? (
                  <CombatStepResultList
                    presentation={recentResultPresentation}
                    title="Recent result"
                  />
                ) : (
                  <PlayerCombatActionResultPanel result={null} />
                )}
              </div>
            </>
          )}
        </section>

        <CombatLog
          autoFollow={combatLogSelection.mode === "automatic" && !inspectorIsHistorical}
          events={combatLogProjection.events}
          onSelect={handleCombatLogSelection}
          selectedCombatLogEventId={combatLogSelection.selectedCombatLogEventId}
          selectedPresentationTargetId={combatLogSelection.selectedPresentationTargetId}
        />

        <section
          aria-label="Distance matrix"
          style={{
            border: "1px solid #e3e1dc",
            borderRadius: 8,
            display: "grid",
            gap: "0.35rem",
            padding: "0.65rem 0.75rem",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "space-between",
            }}
          >
            <strong>Round-level distance matrix</strong>
            <span style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
              {dirtyCombatDistanceRows.length === 0
                ? "No unsaved distance changes."
                : `${dirtyCombatDistanceRows.length} unsaved distance ${
                    dirtyCombatDistanceRows.length === 1 ? "change" : "changes"
                  }.`}
            </span>
          </div>
          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
            Pair distances shared by the round; not part of the current action command.
          </div>
          {displayParticipants.length > 1 ? (
            <>
              <div style={{ overflowX: "auto" }}>
                <table
                  className="distanceMatrix"
                  style={{
                    borderCollapse: "collapse",
                    fontSize: "0.82rem",
                    tableLayout: "fixed",
                    width: "max-content",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        className="distanceMatrixCornerCell"
                        style={{
                          ...distanceMatrixRowHeaderStyle,
                          border: 0,
                          height: distanceMatrixColumnHeaderStyle.height,
                        }}
                      />
                      {displayParticipants.map((participant) => (
                        <th
                          className="distanceMatrixHeaderCell"
                          key={`distance-column:${participant.participantId}`}
                          style={distanceMatrixColumnHeaderStyle}
                          title={participant.label}
                        >
                          <span
                            className="distanceMatrixHeaderLabel"
                            style={distanceMatrixColumnHeaderTextStyle}
                          >
                            {participant.label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayParticipants.map((rowParticipant, rowIndex) => (
                      <tr key={`distance-row:${rowParticipant.participantId}`}>
                        <th
                          className="distanceMatrixRowLabel"
                          style={distanceMatrixRowHeaderStyle}
                          title={rowParticipant.label}
                        >
                          {rowParticipant.label}
                        </th>
                        {displayParticipants.map((columnParticipant, columnIndex) => {
                          if (rowParticipant.participantId === columnParticipant.participantId) {
                            return (
                              <td
                                className="distanceMatrixCell distanceMatrixNumericCell distanceMatrixDiagonalCell"
                                key={`distance-cell:${rowParticipant.participantId}:${columnParticipant.participantId}`}
                                style={{
                                  ...distanceMatrixCellStyle,
                                  color: "#8c8578",
                                }}
                              >
                                —
                              </td>
                            );
                          }

                          const distanceRow = getCombatDistanceTableRowForParticipants({
                            participantAId: rowParticipant.participantId,
                            participantBId: columnParticipant.participantId,
                            rows: combatDistanceRows,
                          });
                          const draftValue = distanceRow
                            ? (distanceDrafts[distanceRow.edge.pairKey] ??
                              String(distanceRow.edge.distance))
                            : "";
                          const editable = rowIndex < columnIndex && Boolean(distanceRow);
                          const title = distanceRow
                            ? [
                                `Source: ${formatCombatDistanceSource(distanceRow.edge.source)}`,
                                `Preferred: ${distanceRow.preferredDistanceLabel}`,
                                distanceRow.edge.notes ? `Notes: ${distanceRow.edge.notes}` : "",
                              ]
                                .filter(Boolean)
                                .join(". ")
                            : "Distance unavailable.";

                          return (
                            <td
                              className="distanceMatrixCell distanceMatrixNumericCell"
                              key={`distance-cell:${rowParticipant.participantId}:${columnParticipant.participantId}`}
                              style={distanceMatrixCellStyle}
                              title={title}
                            >
                              {editable && distanceRow ? (
                                <input
                                  aria-label={`Distance between ${rowParticipant.label} and ${columnParticipant.label}`}
                                  disabled={saving || !selectedRoundIsActive}
                                  max={8}
                                  min={0}
                                  onChange={(event) =>
                                    setDistanceDrafts((current) => ({
                                      ...current,
                                      [distanceRow.edge.pairKey]: event.target.value,
                                    }))
                                  }
                                  style={distanceMatrixInputStyle}
                                  type="number"
                                  value={draftValue}
                                />
                              ) : (
                                <span>{draftValue || "—"}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <button
                  disabled={
                    saving || !selectedRoundIsActive || dirtyCombatDistanceRows.length === 0
                  }
                  onClick={() => void saveCombatDistanceChanges()}
                  type="button"
                >
                  Save distance changes
                </button>
                <button
                  disabled={saving || dirtyCombatDistanceRows.length === 0}
                  onClick={() => setDistanceDrafts({})}
                  type="button"
                >
                  Reset changes
                </button>
              </div>
            </>
          ) : (
            <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
              Add at least two active participants to review pairwise distance.
            </div>
          )}
        </section>
      </section>
    </Profiler>
  );
}
