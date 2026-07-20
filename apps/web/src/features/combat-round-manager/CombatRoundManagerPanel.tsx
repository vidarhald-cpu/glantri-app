"use client";

import {
  forwardRef,
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
  CombatRoundPhaseInitiativeChoice,
  CombatRoundPhaseResolutionResult,
  CombatRoundStep,
  CombatRoundStepStatus,
  CombatRoundInitiativeRank,
  CombatRoundStepSnapshot,
  CombatStepEvent,
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
  WeaponTemplate,
  ProjectedCombatHistoryEvent,
} from "@glantri/domain";
import {
  COMBAT_ROUND_STEP_LABELS,
  COMBAT_ROUND_STEPS,
  buildCombatRoundPhaseResolutionResult,
  buildCombatProgressionProjection,
  buildCombatRoundDamageArmorCoverageFromEquipmentState,
  buildCombatRoundInspector,
  canBackOutCombatRoundPhaseAttack,
  canClearCombatRoundStep,
  characterBuildSchema,
  combatRoundParticipantHasExecutablePhaseAction,
  combatRoundParticipantHasPhaseAttack,
  deriveCombatHistoryStepOutcome,
  ensureDistanceEdgesForParticipantPairs,
  formatOpenEndedD20RollBreakdown,
  getCombatDistanceParticipantAliases,
  getCombatRoundAttackResultId,
  getParticipantCombatExperienceSkillTotalLookup,
  getCombatRoundCombatExperienceDifficulty,
  getCombatRoundInitiativePhaseForStep,
  getMergedCombatDbParryModifierTotal,
  getMergedCombatSkillObModifierTotal,
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
  getCombatRoundInitiativeTotal,
  getCombatRoundEndDistanceProposalLifecycle,
  getCombatRoundModifierPhaseForStep,
  getCombatRoundResolutionPhaseForStep,
  getCombatRoundStepSnapshot,
  getCombatRoundStepForCursorStep,
  getHitLocationFullLabel,
  getFinalCriticalRollIndexStatus,
  getLatestCombatEventSummary,
  HIT_LOCATIONS,
  hasScenarioParticipantCombatDeclarationForEncounterRound,
  initializeCombatRoundState,
  isCombatRoundCombatExperienceWindowOpen,
  isCombatRoundPhaseInitiativeResolutionOpen,
  hasCombatRoundCombatExperienceRoll,
  getWeaponPreferredDistances,
  normalizeCombatArmorModifierClass,
  projectCombatHistoryEvent,
  projectCombatProgressionPresentation,
  recordCombatRoundCriticalRoll,
  recordCombatRoundDamageResult,
  recordCombatRoundHitLocationRoll,
  reviewCombatRoundDamageResult,
  validateCombatDeclarationTargets,
} from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  buildCombatStateCharacterInputs,
  type WorkbookRawModifier,
} from "@glantri/rules-engine";

import {
  buildCombatTrackerModel,
  buildCombatProgressionTrackerIndex,
  buildCombatTrackerCellKey,
  buildConciseDodgeCalculationRows,
  buildCurrentActionPresentation,
  buildRecordedCombatModifierRows,
  CombatEventResultList,
  CombatTracker,
  formatSignedCombatModifier,
  getCombatProgressionPresentationTasks,
  isCombatViewRevisionAtLeast,
  resolveCombatHistoryPanelSnapshot,
  selectCombatEventsForTrackerCell,
  type CombatTrackerCellFacts,
  type CurrentActionCommandDescriptor,
} from "@/features/combat-history";
import { buildEquipmentLoadoutModuleModel } from "@/features/equipment/loadoutModule";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import {
  advanceCombatRoundCurrentStepOnServer,
  advanceCurrentCombatPhaseResolutionOnServer,
  backOutPhaseAttackOnServer,
  clearCurrentCombatRoundStepOnServer,
  commitPhaseInitiativeResolutionOnServer,
  commitCurrentCombatPhaseDamageOnServer,
  completeCurrentCombatPhaseResolutionOnServer,
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
  rollCurrentRoundEndDistanceControlOnServer,
  rollRoundEndHealthCheckOnServer,
  saveCurrentCombatDamageReviewOnServer,
  setCombatExperienceDifficultyOnServer,
  setPairDistanceOnServer,
  skipCombatRoundCurrentActionOnServer,
  submitCombatDeclarationOnServer,
  prepareCombatRoundEndReviewOnServer,
  loadEncounterById,
  updateEncounterOnServer,
} from "@/lib/api/encounterClient";
import { ApiRequestError } from "@/lib/api/apiClient";
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
  type PlayerCombatDistancePreferenceOption,
  PlayerCombatAttackLocationSelector,
  PlayerCombatAttackModeSelector,
  PlayerCombatAttackStatsTable,
  PlayerCombatAttackTargetSelector,
  PlayerCombatDefenseStatsTable,
  PlayerCombatModifierPanel,
  PlayerCombatParryContextPanel,
  PlayerCombatPhasePanel,
  playerCombatPanelCardStyle,
  playerCombatPanelRowStyle,
  playerCombatTopPanelRowStyle,
  sanitizePlayerCombatModifierContext,
  type PlayerCombatModifierBucketView,
  type PlayerCombatPhaseCardView,
} from "@/features/player-combat/PlayerCombatPanels";
import { getPlayerCombatModifierDisplayPhase } from "@/features/player-combat/playerCombatModifierPhase";
import { getLatestRelevantPlayerCombatAttackResult } from "@/features/player-combat/playerCombatResultSelection";
import {
  applyDefaultPlayerCombatPhaseContext,
  buildCanonicalCombatTargetOptions,
  buildCombatAttackSourceRef,
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
} from "@/lib/campaigns/liveCombatModifiers";
import {
  createEmptyPlayerEncounterCombatContext,
  getPlayerEncounterActionLabel,
  getPlayerEncounterMovementLabel,
  getPlayerEncounterOpponentParticipants,
  isPlayerEncounterActionId,
  mergeCombatContextWithCurrentModifierBuckets,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "@/lib/campaigns/playerEncounter";
import { loadCanonicalContent } from "@/lib/content/loadCanonicalContent";
import {
  getCombatRoundManagerInspectionSelection,
  getCombatRoundManagerDisplayParticipantIds,
  getCurrentCombatRoundTaskSelection,
  getNextCombatRoundParticipantSelection,
  isGlobalCombatRoundParticipantStep,
  type CombatRoundSelectionTarget,
} from "./combatRoundSelection";
import { projectCombatActionGeneratedModifiers } from "./combatDistanceModifierProjection";
import { buildCombatRoundPhasePanelProjection } from "./combatRoundPhasePanelProjection";
import {
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

interface CombatRoundManagerPanelProps {
  encounter: EncounterSession;
  onEncounterUpdated?: (encounter: EncounterSession) => void;
  onScenarioParticipantsUpdated?: (participants: ScenarioParticipant[]) => void;
  scenarioParticipants?: ScenarioParticipant[];
}

interface CombatRoundViewState {
  encounterId: string;
  encounterRevision?: string;
  state: CombatRoundState;
}

type PhaseAttackChoiceSelection = "continue" | "back_out";
type DoubleAttackPhase2Decision = "continue" | "cancel";

type InspectorCurrentActionOutcomeSelection = "normal" | "skip";

const COMBAT_FEINT_REFERENCE_ROWS = [
  { attackerDbParry: -4, band: "defender_strong", defenderObDb: 2, difference: "≤ -16" },
  { attackerDbParry: -2, band: "defender_edge", defenderObDb: 0, difference: "-15 to -6" },
  { attackerDbParry: -1, band: "balanced", defenderObDb: 0, difference: "-5 to 0" },
  { attackerDbParry: 0, band: "attacker_edge", defenderObDb: -2, difference: "1 to 10" },
  { attackerDbParry: 0, band: "attacker_strong", defenderObDb: -4, difference: "≥ 11" },
] as const;

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
  calculationLines: readonly string[];
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

function formatCombatExperienceCalculation(result: CombatRoundCombatExperienceResult): string {
  if (result.noRollRequired) {
    return `Combat Experience ${result.skillTotal} vs difficulty ${result.difficulty}`;
  }

  return `Combat Experience ${result.skillTotal} + roll ${result.rollTotal} = ${result.finalTotal} vs ${result.difficulty}`;
}

function formatCombatExperienceEffectLine(result: CombatRoundCombatExperienceResult): string {
  const isPhaseResult = result.trigger !== "combat_start";

  if (result.noRollRequired) {
    return "Result: Active, no modifier";
  }

  if (
    isPhaseResult &&
    result.effectiveTableTotal !== undefined &&
    result.effectiveTableTotal <= 5
  ) {
    return "Result: attack cancelled";
  }

  if (isPhaseResult && result.modifierValue < 0) {
    return `Result: OB ${result.modifierValue}`;
  }

  if (!result.needsEffectRow || result.modifierValue === 0) {
    return "Result: Active, no modifier";
  }

  return `Result: ${result.label}, General ${result.modifierValue} for ${result.durationRounds} round${
    result.durationRounds === 1 ? "" : "s"
  }`;
}

function buildPhaseInitiativeChoiceResultPanel(choice?: CombatRoundPhaseInitiativeChoice): {
  interpretedResult: string;
  rankLabel?: string;
  resultLabel?: string;
} | null {
  if (!choice) {
    return null;
  }

  if (choice.choice === "roll_ce_result" && choice.combatExperience) {
    return {
      interpretedResult: formatCombatExperienceCalculation(choice.combatExperience),
      rankLabel: "Combat Experience",
      resultLabel: formatCombatExperienceEffectLine(choice.combatExperience),
    };
  }

  if (choice.choice === "back_out") {
    return {
      interpretedResult: "Back out of attack",
      rankLabel: "Phase Combat Experience",
      resultLabel: "Result: attack cancelled/backed out",
    };
  }

  if (choice.choice === "continue_without_ce") {
    return {
      interpretedResult: "Continue attack",
      rankLabel: "Phase Combat Experience",
      resultLabel: "Result: no CE roll required",
    };
  }

  return null;
}

function createModifierEntryDraft(): ScenarioCombatModifierEntry {
  return {
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

function formatInitiativeRankLabel(input: {
  participantId?: string;
  ranks: Record<string, CombatRoundInitiativeRank>;
  value: number | undefined;
}): string | undefined {
  if (!input.participantId || input.value === undefined) {
    return undefined;
  }

  const rank = input.ranks[input.participantId];

  if (!rank) {
    return undefined;
  }

  const tieLabel = rank.tiedCount > 1 ? ` (tied with ${rank.tiedCount})` : "";

  return `Rank: ${rank.rank} of ${rank.rankTotal}${tieLabel}`;
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

function formatCombatToHitCalculationLine(result: CombatRoundAttackRollResult): string {
  const rollText = formatOpenEndedD20RollBreakdown({
    dieResult: result.rollTotal,
    openEndedD10s: result.openEndedD10s,
    rollD20: result.rollD20,
  });

  return `OB ${result.ob} - DB ${result.defenderDb} + roll ${rollText} = ${result.lookupTotal}`;
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
        calculationLines: [formatCombatToHitCalculationLine(input.result)],
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

function formatHitLocationTargetLabel(
  targetLocation: CombatRoundPhaseResolutionResult["hitLocationRoll"]["targetLocation"],
): string {
  return targetLocation && targetLocation !== "none"
    ? getHitLocationFullLabel(targetLocation)
    : "None";
}

function formatCombatLocationCalculationLine(resolution: CombatRoundPhaseResolutionResult): string {
  const locationRoll = resolution.hitLocationRoll;

  if (locationRoll.status !== "rolled") {
    return "Hit location roll required";
  }

  const targetLabel = formatHitLocationTargetLabel(locationRoll.targetLocation);
  const rollsLabel = locationRoll.hitLocationRolls.join(", ");
  const selectedLabel = locationRoll.selectedHitLocation
    ? getHitLocationFullLabel(locationRoll.selectedHitLocation)
    : "Unknown";

  return locationRoll.selectionReason === "targeted_closest"
    ? `Target: ${targetLabel} · Rolls: ${rollsLabel} -> ${selectedLabel} selected`
    : `Roll: ${rollsLabel}`;
}

function formatCombatLocationResultLine(resolution: CombatRoundPhaseResolutionResult): string {
  const locationRoll = resolution.hitLocationRoll;

  if (locationRoll.status !== "rolled" || !locationRoll.selectedHitLocation) {
    return "Result: Pending";
  }

  return `Result: ${getHitLocationFullLabel(locationRoll.selectedHitLocation)}`;
}

function formatCombatCriticalCalculationLine(
  resolution: CombatRoundPhaseResolutionResult,
): string | undefined {
  const criticalRoll = resolution.criticalRoll;
  const effectiveCritical = getCombatRoundEffectiveCriticalRoll({
    criticalRoll,
    review: resolution.damageResult?.review,
  });

  if (criticalRoll.status === "not_required") {
    return resolution.damageResult ? "No critical roll required" : undefined;
  }

  if (criticalRoll.status !== "rolled" || !criticalRoll.criticalDice) {
    return "Critical roll required";
  }

  return `2d8 ${criticalRoll.criticalDice.join(" + ")} + type mod ${
    effectiveCritical.criticalTypeModifier ?? criticalRoll.criticalTypeModifier ?? 0
  } - armor crit mod ${
    effectiveCritical.armorCriticalModifier ?? criticalRoll.armorCriticalModifier ?? 0
  } = ${effectiveCritical.finalCriticalRoll ?? criticalRoll.finalCriticalRoll}`;
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
  const locationCalculationLine = formatCombatLocationCalculationLine(input.resolution);
  const locationResultLine = formatCombatLocationResultLine(input.resolution);
  const criticalCalculationLine = formatCombatCriticalCalculationLine(input.resolution);
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
  const sections: CombatActionResultSection[] = [
    {
      calculationLines: [formatCombatToHitCalculationLine(input.attackResult)],
      resultLine: `Result: ${formatCombatAttackTableResultLabel(input.attackResult.tableResult)}`,
      title: "To hit",
    },
    {
      calculationLines: [resolvedParryLine ?? `Parry ${formatResolutionStatusLabel(parry.status)}`],
      resultLine: parryResultLine,
      title: "Parry",
    },
    {
      calculationLines: [locationCalculationLine],
      resultLine: locationResultLine,
      title: "Location",
    },
    {
      calculationLines: [
        resolvedDamageLine ?? damageLine,
        resolvedDamageResultLine,
        resolvedArmorLine,
      ].filter((line): line is string => Boolean(line)),
      resultLine: damageResultLine,
      title: "Damage",
    },
  ];

  if (criticalCalculationLine || criticalResultLine) {
    sections.push({
      calculationLines: [criticalCalculationLine].filter((line): line is string => Boolean(line)),
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

  if (snapshot.initiativeResult) {
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

function projectGmCombatEvents(input: {
  events: readonly CombatStepEvent[];
  participants: CombatRoundState["participants"];
}): ProjectedCombatHistoryEvent[] {
  const participantInputs = input.participants.map((participant) => ({
    displayName: participant.label,
    participantId: participant.participantId,
  }));
  const labels = new Map(
    participantInputs.map((participant) => [participant.participantId, participant.displayName]),
  );

  return input.events.flatMap((event) => {
    const projected = projectCombatHistoryEvent({
      event,
      participants: participantInputs,
      viewer: { kind: "gm" },
    });
    if (!projected) return [];

    const identities = [...projected.identities];
    for (const [index, participantId] of event.visibility.involvedParticipantIds.entries()) {
      if (identities.some((identity) => identity.participantId === participantId)) continue;
      const displayName = labels.get(participantId);
      if (!displayName) continue;
      identities.push({
        displayName,
        participantId,
        role: index === 0 ? "actor" : "target",
        visibility: "visible",
      });
    }
    return [{ ...projected, identities }];
  });
}

function formatCombatPhaseResolutionSummary(input: {
  attackResult: CombatRoundAttackRollResult;
  participantId?: string;
  resolution: CombatRoundPhaseResolutionResult;
}): string {
  const lines = formatCombatPhaseResolutionResultLines(input);

  return lines.sections
    .flatMap((section) => [section.title, ...section.calculationLines, section.resultLine])
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
  const weapon =
    activeWeapons.find((candidate) => normalizeCombatWeaponName(candidate.name) === weaponName) ??
    activeWeapons[0];
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

function isGridArrowTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
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
          <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>Notes</span>
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
  difficultyDrafts: Record<string, string>;
  onDifficultyDraftChange: (healthRollId: string, value: string) => void;
  participantLabel?: string;
  review?: RoundEndParticipantReview;
}) {
  const review = input.review;

  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Participant review</strong>
      <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
        Participant round-end review for SU health, bleed, duration, and status.
      </div>
      {!review ? (
        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>Preparing round-end review...</div>
      ) : (
        <>
          <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
            {input.participantLabel ? `${input.participantLabel}: ` : ""}
            {review.status.replaceAll("_", " ")}
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
          {review.proposedHealthRolls.length > 0 ? (
            <section style={{ display: "grid", gap: "0.4rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Health check review</strong>
              {review.proposedHealthRolls.map((proposal) => {
                const result = proposal.result;
                const difficultyValue =
                  input.difficultyDrafts[proposal.id] ?? String(proposal.difficulty);

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
                    <label style={{ display: "grid", gap: "0.2rem" }}>
                      <span style={{ color: "#5e5a50", fontSize: "0.8rem", fontWeight: 700 }}>
                        {proposal.label}
                      </span>
                      <input
                        disabled={input.controlsDisabled || proposal.status !== "pending"}
                        inputMode="numeric"
                        onChange={(event) =>
                          input.onDifficultyDraftChange(proposal.id, event.target.value)
                        }
                        type="text"
                        value={difficultyValue}
                      />
                    </label>
                    <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                      Health +{proposal.healthStat}
                      {result
                        ? ` · rolled ${formatOpenEndedD20RollBreakdown({
                            dieResult: result.rollTotal,
                            openEndedD10s: result.openEndedD10s,
                            rollD20: result.rollD20,
                          })} = ${result.rollTotal}; final ${result.finalTotal} (${result.success ? "success" : "failure"})`
                        : " · pending"}
                    </div>
                    {result && proposal.previousBleedRate !== undefined ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                        {result.success && proposal.nextBleedRate !== undefined
                          ? `Bleed reduced ${proposal.previousBleedRate} -> ${proposal.nextBleedRate}`
                          : `Bleed remains ${proposal.previousBleedRate}`}
                      </div>
                    ) : null}
                    {proposal.warnings.map((warning, warningIndex) => (
                      <div
                        key={`end-review-health-roll-warning:${proposal.id}:${warningIndex}:${warning}`}
                        style={{ color: "#8a3b1f", fontSize: "0.82rem" }}
                      >
                        {warning}
                      </div>
                    ))}
                  </div>
                );
              })}
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
            const participantASummary = resultA
              ? buildConciseDodgeCalculationRows({
                  calculation: resultA,
                  eventId: `${proposal.id}:participant-a`,
                  outcome: proposal.status === "rolled" ? proposal.outcome : undefined,
                }).map((row) => row.text)
              : [proposal.participantA.status === "pending" ? "pending" : "not required"];
            const participantBSummary = resultB
              ? buildConciseDodgeCalculationRows({
                  calculation: resultB,
                  eventId: `${proposal.id}:participant-b`,
                  outcome: proposal.status === "rolled" ? proposal.outcome : undefined,
                }).map((row) => row.text)
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
        <span>GM note (private, optional)</span>
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
    (state: CombatRoundState) => {
      setRoundView({ encounterId: encounter.id, state });
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
        accepted.encounterId === nextEncounter.id &&
        !isCombatViewRevisionAtLeast({
          acceptedUpdatedAt: accepted.updatedAt,
          candidateUpdatedAt: nextEncounter.updatedAt,
        })
      ) {
        return false;
      }

      acceptedEncounterRevisionRef.current = {
        encounterId: nextEncounter.id,
        updatedAt: nextEncounter.updatedAt,
      };
      setRoundView({
        encounterId: nextEncounter.id,
        encounterRevision: nextEncounter.updatedAt,
        state,
      });
      return true;
    },
    [],
  );
  const [inspectionSelection, setInspectionSelection] = useState(initialInspectionSelection);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [scenarioParticipantOverrides, setScenarioParticipantOverrides] = useState<
    Record<string, ScenarioParticipant>
  >({});
  const [inspectorDrafts, setInspectorDrafts] = useState<
    Record<string, CombatInspectorDeclarationDraft>
  >({});
  const [inspectorModifierEditedDraftKeys, setInspectorModifierEditedDraftKeys] = useState<
    Record<string, true>
  >({});
  const [parrySourceSelections, setParrySourceSelections] = useState<
    Record<string, CombatParrySourceSelection>
  >({});
  const [damageReviewDrafts, setDamageReviewDrafts] = useState<
    Record<string, CombatDamageReviewDraft>
  >({});
  const [combatExperienceDifficultyDrafts, setCombatExperienceDifficultyDrafts] = useState<
    Record<string, string>
  >({});
  const [distanceDrafts, setDistanceDrafts] = useState<Record<string, string>>({});
  const [roundEndHealthDifficultyDrafts, setRoundEndHealthDifficultyDrafts] = useState<
    Record<string, string>
  >({});
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
    useState<InspectorCurrentActionOutcomeSelection>("normal");
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
  const activeCurrentCellRef = useRef<HTMLButtonElement | null>(null);
  const inspectorAdjustDistanceAdjustmentDraftRef =
    useRef<AdjustDistanceAdjustmentDraftHandle | null>(null);
  const timelineCellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const encounterScopeRef = useRef(encounter.id);
  const manualSelectionRef = useRef<CombatRoundSelectionTarget | undefined>(undefined);
  const pendingSelectionRef = useRef<CombatRoundSelectionTarget | undefined>(undefined);
  const roundEndAutoPrepareAttemptRef = useRef<string | undefined>(undefined);
  const boundaryTransitionInFlightRef = useRef(false);
  const [selectedRoundNumber, setSelectedRoundNumber] = useState(initialRoundState.roundNumber);
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
  const combatProgressionProjection = useMemo(
    () => buildCombatProgressionProjection(roundState),
    [roundState],
  );
  const combatProgressionPresentation = useMemo(
    () =>
      projectCombatProgressionPresentation({
        projection: combatProgressionProjection,
        viewer: { kind: "gm" },
      }),
    [combatProgressionProjection],
  );
  const combatProgressionTrackerIndex = useMemo(
    () => buildCombatProgressionTrackerIndex(combatProgressionPresentation),
    [combatProgressionPresentation],
  );
  const phase1Ranks = useMemo(
    () => getCombatRoundInitiativeRanks({ phase: "phase1", state: roundState }),
    [roundState],
  );
  const phase2Ranks = useMemo(
    () => getCombatRoundInitiativeRanks({ phase: "phase2", state: roundState }),
    [roundState],
  );
  const timelineRoundStates = useMemo(
    () => getCombatRoundTimelineRoundStates(roundState),
    [roundState],
  );
  const latestCombatEventSummary = useMemo(
    () => getLatestCombatEventSummary(roundState),
    [roundState],
  );
  const selectedTimelineRoundState =
    timelineRoundStates.find((candidate) => candidate.roundNumber === selectedRoundNumber) ??
    roundState;
  const selectedRoundIsActive = selectedTimelineRoundState.roundNumber === roundState.roundNumber;
  const displayParticipants = useMemo(() => {
    const participantById = new Map(
      roundState.participants.map((participant) => [participant.participantId, participant]),
    );

    return getCombatRoundManagerDisplayParticipantIds(roundState, combatProgressionPresentation)
      .map((participantId) => participantById.get(participantId))
      .filter((participant): participant is CombatRoundState["participants"][number] =>
        Boolean(participant),
      );
  }, [combatProgressionPresentation, roundState]);
  const combatDistanceRows = useMemo(
    () =>
      buildCombatDistanceTableRows({
        encounter,
        resolvedEquipmentStateByScenarioParticipantId: Object.fromEntries(
          Object.entries(resolvedCharacterStateByParticipantId).map(([participantId, state]) => [
            participantId,
            state.equipmentState,
          ]),
        ),
        roundState,
        scenarioParticipants: effectiveScenarioParticipants,
      }),
    [effectiveScenarioParticipants, encounter, resolvedCharacterStateByParticipantId, roundState],
  );
  const dirtyCombatDistanceRows = useMemo(
    () =>
      combatDistanceRows.filter((row) => {
        const draftValue = distanceDrafts[row.edge.pairKey];

        return draftValue !== undefined && draftValue !== String(row.edge.distance);
      }),
    [combatDistanceRows, distanceDrafts],
  );
  const timelineRoundNumbers = timelineRoundStates.map((state) => state.roundNumber);
  const projectedCurrentTasks = getCombatProgressionPresentationTasks(
    combatProgressionPresentation,
  ).filter((task) => task.contributesToProgression);
  const projectedBoundaryTransitionTask = projectedCurrentTasks.find(
    (task) => task.kind === "gm_advance_boundary" && task.state === "executable" && task.transition,
  );
  const projectedBoundaryTransitionAction = buildCombatBoundaryTransitionAction({
    encounterId: roundView.encounterId,
    encounterRevision: roundView.encounterRevision,
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
  const projectedCurrentTask =
    projectedCurrentTasks.find(
      (task) => task.trackerFacet.owner?.participantId === roundState.currentCursor?.participantId,
    ) ?? projectedCurrentTasks[0];
  const currentActionPresentation = useMemo(
    () =>
      buildCurrentActionPresentation({
        encounterId: roundView.encounterId,
        encounterRevision: roundView.encounterRevision,
        progression: combatProgressionPresentation,
        viewer: { kind: "gm" },
      }),
    [
      combatProgressionPresentation,
      roundView.encounterId,
      roundView.encounterRevision,
    ],
  );
  const currentTaskSelection = projectedCurrentTask?.trackerFacet.owner
    ? {
        participantId: projectedCurrentTask.trackerFacet.owner.participantId,
        step: getCombatRoundStepForCursorStep(projectedCurrentTask.trackerFacet.step),
      }
    : combatProgressionPresentation.taskVisibility === "available"
      ? getCurrentCombatRoundTaskSelection(roundState)
      : undefined;
  const currentTaskStep = currentTaskSelection?.step ?? roundState.currentStep;
  const inspector = buildCombatRoundInspector({
    participantId: inspectionSelection.participantId,
    state: selectedTimelineRoundState,
    step: inspectionSelection.step,
  });
  const inspectorSelectionIsCurrentProgression =
    selectedRoundIsActive &&
    Boolean(
      combatProgressionPresentation.taskVisibility === "available" &&
      inspector.participant?.participantId &&
      (combatProgressionTrackerIndex.byCellKey[
        buildCombatTrackerCellKey({
          participantId: inspector.participant.participantId,
          roundNumber: roundState.roundNumber,
          step: inspector.step,
        })
      ]?.current ||
        (combatProgressionPresentation.boundary.kind === "declaration" &&
          inspector.step === "select_actions")),
    );
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
  const projectedRoundEndTasks = combatProgressionProjection.boundary.processes
    .flatMap((process) => process.stages)
    .flatMap((stage) => stage.executionGroups)
    .flatMap((group) => group.tasks)
    .filter((task) => task.state === "executable" && task.trackerFacet.step === "SU");
  const inspectorRoundEndTask =
    selectedRoundIsActive && inspector.step === "round_summary"
      ? (projectedRoundEndTasks.find(
          (task) =>
            task.trackerFacet.owner?.participantId === roundState.currentCursor?.participantId,
        ) ?? projectedRoundEndTasks[0])
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
    if (saving || !selectedRoundIsActive || inspectorRoundEndTask?.kind !== "round_end_prepare") {
      return;
    }

    const attemptKey = `${encounter.id}:${roundState.roundNumber}`;

    if (roundEndAutoPrepareAttemptRef.current === attemptKey) {
      return;
    }

    roundEndAutoPrepareAttemptRef.current = attemptKey;
    setSaving(true);
    void prepareCombatRoundEndReviewOnServer({ encounterId: encounter.id })
      .then(({ encounter: nextEncounter }) => {
        const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
        acceptCanonicalEncounterState(nextEncounter, nextRoundState);
        setInspectionSelection(resolveCombatRoundInspectionSelection({ state: nextRoundState }));
        setSelectedRoundNumber(nextRoundState.roundNumber);
        onEncounterUpdated?.(nextEncounter);
        setSaveError(undefined);
      })
      .catch((caughtError: unknown) => {
        setSaveError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to prepare round-end review automatically.",
        );
      })
      .finally(() => setSaving(false));
  }, [
    acceptCanonicalEncounterState,
    encounter.id,
    inspectorRoundEndTask?.kind,
    onEncounterUpdated,
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
      : buildDeclarationDraft(selectedScenarioParticipant, selectedRoundDeclaration, {
          encounterId: encounter.id,
          roundNumber: selectedRoundNumber,
        });
  const inspectorSnapshot = getCombatRoundStepSnapshot({
    participantId: inspector.participant?.participantId,
    roundNumber: selectedRoundNumber,
    state: selectedTimelineRoundState,
    step: inspector.step,
  });
  const inspectorHistoricalStepOutcome = deriveCombatHistoryStepOutcome(inspectorSnapshot);
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
  const inspectorContextBaseSnapshot = inspectorIsHistorical
    ? resolveInspectorContextSnapshot()
    : undefined;
  const inspectorPanelSnapshot = inspectorContextBaseSnapshot
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
  const inspectorHistoricalDeclarationSummary = inspectorPanelSnapshot?.declarationSummary;
  const inspectorHistoricalSelectorFactsComplete = Boolean(
    inspectorHistoricalDeclarationSummary?.movementLabel &&
    (!inspectorHistoricalDeclarationSummary.actionId ||
      inspectorHistoricalDeclarationSummary.actionLabel) &&
    (!inspectorHistoricalDeclarationSummary.secondaryActionId ||
      inspectorHistoricalDeclarationSummary.secondaryActionLabel) &&
    (inspectorHistoricalDeclarationSummary.movementIntent?.distancePreferences ?? []).every(
      (preference) =>
        inspectorHistoricalDeclarationSummary.movementPreferenceTargets?.some(
          (target) => target.id === preference.targetParticipantId,
        ),
    ),
  );
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
    return resolveScenarioCombatEquipmentState({
      resolvedEquipmentState:
        resolvedCharacterStateByParticipantId[selectedScenarioParticipant?.id ?? ""]
          ?.equipmentState,
      scenarioEquipmentState: selectedScenarioParticipant?.snapshot.equipmentState,
    });
  }, [
    resolvedCharacterStateByParticipantId,
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
  const inspectorGeneratedCombatContext = useMemo(() => {
    if (inspectorHasLocalModifierEdits) {
      return inspectorDraft.combatContext;
    }

    return projectCombatActionGeneratedModifiers({
      actionId: inspectorDraft.actionId || undefined,
      combatContext: inspectorDraft.combatContext,
      encounterParticipant: selectedEncounterParticipant,
      movementIntent: inspectorDraft.movementIntent,
      phaseContexts: inspectorDraft.phaseContexts,
      resolvedEquipmentState: inspectorEquipmentState ?? undefined,
      roundState: selectedTimelineRoundState,
      scenarioParticipant: selectedScenarioParticipant,
      secondaryActionId: inspectorDraft.secondaryActionId || undefined,
    });
  }, [
    inspectorDraft.actionId,
    inspectorDraft.combatContext,
    inspectorDraft.movementIntent,
    inspectorDraft.phaseContexts,
    inspectorDraft.secondaryActionId,
    inspectorEquipmentState,
    inspectorHasLocalModifierEdits,
    selectedEncounterParticipant,
    selectedScenarioParticipant,
    selectedTimelineRoundState,
  ]);
  const inspectorLiveModifiers = useMemo(
    () =>
      buildEncounterLiveCombatModifierSummary({
        combatContext: sanitizePlayerCombatModifierContext(inspectorGeneratedCombatContext),
        combatEffects: selectedScenarioParticipant?.state.combatEffects,
        phaseKey: inspectorModifierPhase,
      }),
    [inspectorGeneratedCombatContext, inspectorModifierPhase, selectedScenarioParticipant],
  );
  const inspectorModifierRows = useMemo(
    () =>
      buildPlayerCombatModifierRows({
        combatContext: inspectorGeneratedCombatContext,
        combatEffects: selectedScenarioParticipant?.state.combatEffects,
        currentRound: selectedRoundNumber,
        encounterId: encounter.id,
        liveModifiers: inspectorLiveModifiers,
        ownerParticipantId: selectedScenarioParticipant?.id,
        phaseKey: inspectorModifierPhase,
        visibleAtStep: inspector.step,
      }),
    [
      inspectorGeneratedCombatContext,
      inspectorLiveModifiers,
      inspectorModifierPhase,
      inspector.step,
      inspectorDraft.actionId,
      selectedScenarioParticipant?.state.combatEffects,
    ],
  );
  const inspectorDisplayModifierRows: readonly PlayerCombatModifierBucketView[] =
    inspectorIsHistorical
      ? (inspectorPanelSnapshot?.modifierSummary?.rows ?? [])
      : inspectorModifierRows;
  const inspectorModifierSourceMode: CombatInspectorSourceMode = inspectorIsHistorical
    ? "history"
    : "current";
  const inspectorModifierSourceLabel = getCombatInspectorSourceLabel(inspectorModifierSourceMode);
  const inspectorTargetValidation = useMemo(
    () =>
      validateCombatDeclarationTargets({
        actionId: inspectorDraft.actionId || undefined,
        phaseContexts: inspectorDraft.phaseContexts,
        secondaryActionId: inspectorDraft.secondaryActionId || undefined,
      }),
    [inspectorDraft.actionId, inspectorDraft.phaseContexts, inspectorDraft.secondaryActionId],
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
  const inspectorPhaseChoicePhase = inspectorInitiativeResolutionPhase;
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
  const inspectorVisibleCombatExperienceResult =
    inspectorPhaseInitiativeChoice?.combatExperience ?? inspectorCombatExperienceResult;
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
    const result = characterBuildSchema.safeParse(
      resolvedInspectorCharacterState?.serverRecord.build ??
        selectedScenarioParticipant?.snapshot.build,
    );
    return result.success ? result.data : null;
  }, [
    resolvedInspectorCharacterState?.serverRecord.build,
    selectedScenarioParticipant?.snapshot.build,
  ]);
  const inspectorSheetSummary = useMemo(
    () =>
      content && inspectorBuild
        ? buildCharacterSheetSummary({
            build: inspectorBuild,
            content,
          })
        : undefined,
    [content, inspectorBuild],
  );
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
  const inspectorCombatExperienceDifficultyInputVisible =
    inspectorCombatExperienceRequired &&
    inspectorCombatExperienceIsCombatStart &&
    (!inspectorCombatExperienceWindowOpen || !combatExperienceRollRecorded);
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
  const inspectorCombatExperienceDifficultyCommandPending =
    inspectorCombatExperienceDifficultyStartPending ||
    inspectorCombatExperienceDifficultyUpdatePending;
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
    !inspectorCombatExperienceIsCombatStart ||
    combatExperienceRollRecorded ||
    (inspectorIsInspectionOnly && inspector.step !== "select_actions") ||
    Boolean(inspectorSnapshot);
  const inspectorLoadoutModel = useMemo(
    () =>
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
    [
      content,
      inspectorBuild,
      inspectorEquipmentState,
      inspectorLiveModifiers,
      inspectorEquipmentCharacterId,
    ],
  );
  const inspectorLoadoutSummary = useMemo(
    () =>
      buildPlayerCombatLoadoutSummary({
        actionId: inspectorDraft.actionId,
        allowUnarmedFallback:
          inspectorEquipmentStatus.kind === "ready" || inspectorEquipmentStatus.kind === "unarmed",
        loadoutModel: inspectorLoadoutModel,
        secondaryActionId: inspectorDraft.secondaryActionId,
      }),
    [inspectorDraft.actionId, inspectorDraft.secondaryActionId, inspectorLoadoutModel],
  );
  const inspectorTargetOptions = useMemo(() => {
    const options = getPlayerEncounterOpponentParticipants({
      allowedParticipantIds: encounterScenarioParticipantIds,
      isGameMaster: true,
      participants: effectiveScenarioParticipants,
      selectedParticipantId: selectedScenarioParticipant?.id,
    });
    return buildCanonicalCombatTargetOptions({
      encounterParticipants: encounter.participants,
      options,
    });
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
    const buildPhaseSummary = (phaseKey: PlayerCombatPhaseKey) => {
      const phaseLiveModifiers = buildEncounterLiveCombatModifierSummary({
        combatContext: inspectorGeneratedCombatContext,
        combatEffects: selectedScenarioParticipant?.state.combatEffects,
        phaseKey,
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

      return buildPlayerCombatLoadoutSummary({
        actionId: inspectorDraft.actionId,
        allowUnarmedFallback:
          inspectorEquipmentStatus.kind === "ready" || inspectorEquipmentStatus.kind === "unarmed",
        loadoutModel: phaseLoadoutModel,
        phaseKey,
        selectedAttackModeId: inspectorDraft.phaseContexts[phaseKey].attackModeId,
        secondaryActionId: inspectorDraft.secondaryActionId,
      });
    };

    return {
      phase1: buildPhaseSummary("phase1"),
      phase2: buildPhaseSummary("phase2"),
    };
  }, [
    content,
    inspectorBuild,
    inspectorDraft.actionId,
    inspectorGeneratedCombatContext,
    inspectorDraft.secondaryActionId,
    inspectorEquipmentState,
    inspectorEquipmentCharacterId,
    selectedScenarioParticipant?.state.combatEffects,
  ]);
  const inspectorResolvedFeintSkill =
    inspectorDraft.feintMethod === "movement"
      ? { id: "dodge", label: "Dodge" }
      : resolveCombatFeintWeaponSkill({
          equipmentState: inspectorEquipmentState,
          skills: content?.skills ?? [],
          specializations: content?.specializations ?? [],
          sourceTemplateId: inspectorPhaseLoadoutSummaries.phase1.reference?.sourceTemplateId,
        });
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
  const inspectorInitiativeRollCounts =
    inspectorCurrentInitiativePhase && selectedRoundIsActive
      ? {
          pending: roundState.participants.filter(
            (participant) => participant.initiatives[inspectorCurrentInitiativePhase] === undefined,
          ).length,
          total: roundState.participants.length,
        }
      : undefined;
  const inspectorDisplayAttackResult = inspectorIsHistorical
    ? inspectorSnapshot?.attackResult
    : inspector.participant && inspectorAttackPhase
      ? getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: inspector.participant.participantId,
          phase: inspectorAttackPhase,
          state: selectedTimelineRoundState,
        })
      : undefined;
  const inspectorCanShowLatestRelevantAttackResult =
    COMBAT_ROUND_STEPS.indexOf(inspector.step) >= COMBAT_ROUND_STEPS.indexOf("phase_1_actions") &&
    inspector.step !== "round_summary";
  const inspectorLatestRelevantAttackResult =
    !inspectorIsHistorical && inspectorCanShowLatestRelevantAttackResult && inspector.participant
      ? getLatestRelevantPlayerCombatAttackResult({
          participantId: inspector.participant.participantId,
          state: selectedTimelineRoundState,
        })
      : undefined;
  const inspectorResolutionAttackResult = inspectorIsHistorical
    ? inspectorSnapshot?.attackResult
    : inspector.participant && inspectorResolutionPhase
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: inspector.participant.participantId,
          phase: inspectorResolutionPhase,
          state: selectedTimelineRoundState,
        })
      : undefined;
  const inspectorDisplayPhaseResolutionResult = inspectorIsHistorical
    ? inspectorSnapshot?.phaseResolutionResult
    : inspectorResolutionAttackResult
      ? (getCombatRoundPhaseResolutionResultForAttack({
          attackResult: inspectorResolutionAttackResult,
          state: selectedTimelineRoundState,
        }) ??
        buildCombatRoundPhaseResolutionResult({
          attackResult: inspectorResolutionAttackResult,
          roundNumber: selectedTimelineRoundState.roundNumber,
          updatedAt: inspectorResolutionAttackResult.rolledAt,
        }))
      : undefined;
  const inspectorPhaseResolutionOwnerParticipantId =
    inspectorResolutionAttackResult?.attackerParticipantId ?? inspector.participant?.participantId;
  const inspectorPhaseResolutionOwnerStatus =
    inspectorPhaseResolutionOwnerParticipantId && inspectorCurrentResolutionPhase
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
  const inspectorParryDefenderRoundParticipant = inspectorResolutionAttackResult
    ? selectedTimelineRoundState.participants.find(
        (participant) =>
          participant.participantId === inspectorResolutionAttackResult.defenderParticipantId,
      )
    : undefined;
  const inspectorParryDefenderEncounterParticipant = inspectorResolutionAttackResult
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
      ? buildScenarioParticipantPhaseSummary({
          declaration: inspectorParryDefenderRoundParticipant?.declaration,
          phaseKey: inspectorResolutionPhase,
          scenarioParticipant: inspectorParryDefenderScenarioParticipant,
        })
      : undefined;
  const inspectorParrySelection = getCombatParrySourceSelection({
    selection: inspectorParrySelectionKey
      ? parrySourceSelections[inspectorParrySelectionKey]
      : undefined,
    sources: inspectorParryDefenderPhaseSummary?.parrySources,
  });
  const inspectorParryBase = getSelectedCombatParryBase({
    selection: inspectorParrySelection,
    sources: inspectorParryDefenderPhaseSummary?.parrySources,
  });
  const inspectorParryExtraRawModifiers = buildCombatAttackResultParryModifiers(
    inspectorResolutionAttackResult,
  );
  const inspectorParryModifierCalculation =
    inspectorParryBase !== undefined
      ? buildEncounterDbParryModifierCalculation({
          baseValue: inspectorParryBase,
          extraRawModifiers: inspectorParryExtraRawModifiers,
          liveModifiers: inspectorParryDefenderPhaseSummary?.liveModifiers,
        })
      : null;
  const inspectorParryModifierAdjustment = inspectorParryModifierCalculation
    ? inspectorParryModifierCalculation.finalValue - (inspectorParryBase ?? 0)
    : 0;
  const inspectorParryModifierBreakdown = inspectorParryModifierCalculation?.rawModifiers ?? [];
  const inspectorNoPhaseAttack =
    Boolean(inspectorAttackPhase) &&
    !inspectorDisplayAttackResult &&
    inspectorCurrentPhaseHasAttack === false;
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
    inspectorCanSkipCurrentPhaseAction && !inspectorPhaseAttackChoiceSelectorAvailable;
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
  const inspectorDamageSubstate =
    inspectorResolutionStepKind === "damage"
      ? getCombatRoundDamageSubstate(inspectorDisplayPhaseResolutionResult)
      : undefined;
  const inspectorDamageProposalReady =
    inspectorResolutionStepKind === "damage" &&
    Boolean(inspectorDisplayPhaseResolutionResult?.damageResult) &&
    inspectorDisplayPhaseResolutionResult?.damageProposal.status !== "committed";
  const inspectorDamageCommitted =
    inspectorResolutionStepKind === "damage" &&
    inspectorDisplayPhaseResolutionResult?.damageProposal.status === "committed";
  const inspectorDamageAttackerLabel = inspectorDisplayPhaseResolutionResult
    ? (selectedTimelineRoundState.participants.find(
        (participant) =>
          participant.participantId === inspectorDisplayPhaseResolutionResult.attackerParticipantId,
      )?.label ?? "attacker")
    : undefined;
  const inspectorDamageDefenderLabel = inspectorDisplayPhaseResolutionResult
    ? (selectedTimelineRoundState.participants.find(
        (participant) =>
          participant.participantId === inspectorDisplayPhaseResolutionResult.defenderParticipantId,
      )?.label ?? "defender")
    : undefined;
  const inspectorDamageReviewKey =
    inspectorDisplayPhaseResolutionResult?.damageResult?.attackResultId;
  const inspectorDamageReviewDraft =
    inspectorDamageReviewKey && damageReviewDrafts[inspectorDamageReviewKey]
      ? damageReviewDrafts[inspectorDamageReviewKey]
      : buildCombatDamageReviewDraft(
          inspectorDisplayPhaseResolutionResult?.damageResult,
          inspectorDisplayPhaseResolutionResult?.criticalRoll,
        );
  const inspectorDamageCommitReadiness = useMemo(() => {
    const damageResult = inspectorDisplayPhaseResolutionResult?.damageResult;

    if (!inspectorDamageProposalReady || !damageResult) {
      return undefined;
    }

    try {
      const reviewedState = reviewCombatRoundDamageResult({
        attackResultId: damageResult.attackResultId,
        review: buildCombatDamageReviewFromDraft({
          criticalRoll: inspectorDisplayPhaseResolutionResult?.criticalRoll,
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
    inspectorDisplayPhaseResolutionResult,
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
  const projectedAdjustDistanceOwnerParticipantId =
    projectedAdjustDistanceTask?.trackerFacet.owner?.participantId;
  const inspectorFeintProposal =
    selectedRoundIsActive &&
    projectedFeintOwnerParticipantId === inspector.participant?.participantId
      ? roundState.feintProposals.find(
          (proposal) =>
            (proposal.status === "awaiting_rolls" || proposal.status === "awaiting_review") &&
            proposal.attackerParticipantId === projectedFeintOwnerParticipantId,
        )
      : undefined;
  const inspectorAdjustDistanceProposal =
    selectedRoundIsActive &&
    projectedAdjustDistanceOwnerParticipantId === inspector.participant?.participantId
      ? roundState.adjustDistanceProposals.find(
          (proposal) =>
            proposal.status !== "committed" &&
            proposal.attackerParticipantId === projectedAdjustDistanceOwnerParticipantId,
        )
      : undefined;
  const inspectorAdjustDistanceExpectedParticipantId = inspectorAdjustDistanceProposal
    ? inspectorAdjustDistanceProposal.status === "awaiting_defender_response"
      ? inspectorAdjustDistanceProposal.defenderParticipantId
      : inspectorAdjustDistanceProposal.status === "awaiting_rolls"
        ? inspectorAdjustDistanceProposal.attackerRoll
          ? inspectorAdjustDistanceProposal.defenderParticipantId
          : inspectorAdjustDistanceProposal.attackerParticipantId
        : undefined
    : undefined;
  const inspectorAdjustDistanceExpectedEncounterParticipant = encounter.participants.find(
    (participant) => participant.id === inspectorAdjustDistanceExpectedParticipantId,
  );
  const inspectorAdjustDistanceExpectedScenarioParticipant =
    inspectorAdjustDistanceExpectedEncounterParticipant
      ? findScenarioParticipantForEncounterParticipant({
          encounterParticipant: inspectorAdjustDistanceExpectedEncounterParticipant,
          scenarioParticipants: effectiveScenarioParticipants,
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
  const inspectorFeintExpectedParticipantId = inspectorFeintProposal
    ? inspectorFeintProposal.attackerRoll
      ? inspectorFeintProposal.defenderParticipantId
      : inspectorFeintProposal.attackerParticipantId
    : undefined;
  const inspectorFeintExpectedEncounterParticipant = encounter.participants.find(
    (participant) => participant.id === inspectorFeintExpectedParticipantId,
  );
  const inspectorFeintExpectedScenarioParticipant = inspectorFeintExpectedEncounterParticipant
    ? findScenarioParticipantForEncounterParticipant({
        encounterParticipant: inspectorFeintExpectedEncounterParticipant,
        scenarioParticipants: effectiveScenarioParticipants,
      })
    : undefined;
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
  const inspectorActionValidationMessage = inspectorCombatExperienceDifficultyCommandPending
    ? inspectorCombatExperienceDifficultyValidationMessage
    : (inspectorCombatExperienceDifficultyValidationMessage ??
      inspectorTargetValidationMessage ??
      inspectorAttackSourceValidationMessage ??
      inspectorDamageCommitValidationMessage ??
      inspectorRoundEndActionValidationMessage);
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
  const inspectorCurrentActionOutcomeKey = inspectorSkipActionOutcomeSelectorAvailable
    ? [
        selectedTimelineRoundState.roundNumber,
        selectedTimelineRoundState.currentCursor?.participantId ?? "none",
        selectedTimelineRoundState.currentCursor?.step ?? "none",
        inspectorActionButtonLabel,
      ].join(":")
    : "none";

  useEffect(() => {
    setInspectorCurrentActionOutcomeSelection("normal");
  }, [inspectorCurrentActionOutcomeKey]);

  const inspectorSkipActionSelected =
    inspectorSkipActionOutcomeSelectorAvailable &&
    inspectorCurrentActionOutcomeSelection === "skip";
  const inspectorActionButtonDisabled =
    saving ||
    (projectedBoundaryTransitionAction
      ? false
      : inspectorAdjustDistanceProposal
        ? (inspectorAdjustDistanceProposal.status === "awaiting_defender_response" ||
            inspectorAdjustDistanceProposal.status === "awaiting_rolls") &&
          !inspectorAdjustDistanceExpectedScenarioParticipant
        : inspectorFeintProposal
          ? inspectorFeintProposal.status === "awaiting_rolls" &&
            !inspectorFeintExpectedScenarioParticipant
          : inspectorDoubleAttackDecisionAvailable
            ? false
            : inspectorPhaseAttackChoiceIsBackOut
              ? Boolean(inspectorSnapshot) || !inspectorCanBackOutPhaseAttack
              : (inspectorIsInspectionOnly &&
                  inspector.step !== "select_actions" &&
                  !inspectorCombatExperienceRequired &&
                  !inspectorRoundEndDistanceAction) ||
                inspectorPhaseInitiativeChoiceSubmitted ||
                Boolean(inspectorActionValidationMessage) ||
                inspectorSelectedAttackAlreadyRolled ||
                inspectorDamageCommitted ||
                Boolean(inspectorSnapshot));
  const inspectorEffectiveActionButtonLabel = inspectorSkipActionSelected
    ? "Skip current action"
    : inspectorActionButtonLabel;
  const inspectorEffectiveActionButtonDisabled = inspectorSkipActionSelected
    ? saving ||
      Boolean(inspectorSnapshot) ||
      inspectorIsInspectionOnly ||
      !inspectorSkipActionOutcomeSelectorAvailable
    : inspectorActionButtonDisabled;
  const inspectorCurrentActionOutcomeControls = inspectorSkipActionOutcomeSelectorAvailable ? (
    <label style={compactFieldLabelStyle}>
      <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Action outcome</span>
      <select
        disabled={saving || Boolean(inspectorSnapshot) || inspectorIsInspectionOnly}
        onChange={(event) =>
          setInspectorCurrentActionOutcomeSelection(
            event.target.value as InspectorCurrentActionOutcomeSelection,
          )
        }
        value={inspectorCurrentActionOutcomeSelection}
      >
        <option value="normal">{inspectorActionButtonLabel}</option>
        <option value="skip">Skip current action</option>
      </select>
    </label>
  ) : null;
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
          <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>GM override</span>
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
            <option value="">Use proposal</option>
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
              {COMBAT_FEINT_REFERENCE_ROWS.map((row) => {
                const selected = inspectorFeintProposal.tableResult?.band === row.band;
                return (
                  <tr
                    key={row.band}
                    style={selected ? { background: "#f3ead2", fontWeight: 700 } : undefined}
                  >
                    <td>{row.difference}</td>
                    <td style={{ textAlign: "right" }}>
                      {row.defenderObDb >= 0 ? "+" : ""}
                      {row.defenderObDb}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {row.attackerDbParry >= 0 ? "+" : ""}
                      {row.attackerDbParry}
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
          <span>GM note</span>
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
          <div>
            {inspectorAdjustDistanceProposal.defenderResponse === "allow"
              ? "Defender allowed the adjustment."
              : `Dodge: ${inspectorAdjustDistanceProposal.attackerRoll?.finalTotal} vs ${inspectorAdjustDistanceProposal.defenderRoll?.finalTotal} · ${inspectorAdjustDistanceProposal.standardOutcome}`}
          </div>
          <div>
            Standard proposal: distance {inspectorAdjustDistanceProposal.standardProposedDistance}
          </div>
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
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((distance) => (
                <option key={distance} value={distance}>
                  {distance}
                </option>
              ))}
            </select>
          </label>
          <label style={compactFieldLabelStyle}>
            <span>GM note</span>
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
  const inspectorPreActionControls =
    inspectorCurrentActionOutcomeControls ||
    inspectorCombatExperienceDifficultyControls ||
    inspectorFeintControls ||
    inspectorAdjustDistanceControls ||
    inspectorDoubleAttackDecisionControls ||
    inspectorPhaseAttackChoiceControls ||
    inspectorRoundEndDistanceControls ? (
      <>
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
    !showInspectorPhaseCombatExperienceContextPanel && inspectorCurrentStepIsInitiative;
  const showInspectorModifierReviewContextPanel =
    !showInspectorInitiativeContextPanel &&
    !showInspectorPhaseCombatExperienceContextPanel &&
    (inspector.step === "review_action_modifiers" || inspector.step === "review_phase_2_modifiers");
  const showInspectorCombatStartExperienceContextPanel =
    !showInspectorInitiativeContextPanel &&
    !showInspectorPhaseCombatExperienceContextPanel &&
    !showInspectorModifierReviewContextPanel &&
    inspectorCombatExperienceRequired &&
    inspectorCombatExperienceIsCombatStart;
  const inspectorPhaseInitiativeChoiceResultPanel = buildPhaseInitiativeChoiceResultPanel(
    inspectorPhaseInitiativeChoice,
  );
  const inspectorFallbackCombatExperienceResult = inspectorPhaseInitiativeChoiceResultPanel
    ? undefined
    : inspectorVisibleCombatExperienceResult;
  const inspectorPhaseResolutionLines =
    inspectorResolutionAttackResult && inspectorDisplayPhaseResolutionResult
      ? formatCombatPhaseResolutionResultLines({
          attackResult: inspectorResolutionAttackResult,
          participantId: inspector.participant?.participantId,
          resolution: inspectorDisplayPhaseResolutionResult,
        })
      : undefined;
  const inspectorCanonicalActionResultEvents = projectGmCombatEvents({
    events: selectCombatEventsForTrackerCell({
      events: selectedTimelineRoundState.events,
      participantId: inspector.participant?.participantId,
      retainLatestWhenEmpty: !inspectorIsHistorical && inspectorSelectionIsCurrentProgression,
      step: inspector.step,
    }),
    participants: selectedTimelineRoundState.participants,
  });
  const inspectorHasCanonicalActionResult = inspectorCanonicalActionResultEvents.length > 0;
  const inspectorShowsLegacyResultFallback = Boolean(
    inspectorIsHistorical &&
    !inspectorHistoricalStepOutcome &&
    inspectorSnapshot &&
    (inspectorSnapshot.actionResultStatus === "recorded" ||
      inspectorSnapshot.attackResult ||
      inspectorSnapshot.initiativeResult ||
      inspectorSnapshot.actionResultSummary),
  );
  const inspectorLatestRoundEndDistanceResult =
    selectedRoundIsActive &&
    inspector.step === "round_summary" &&
    latestCombatEventSummary?.roundNumber === roundState.roundNumber &&
    (latestCombatEventSummary.shortTitle === "Distance control rolled" ||
      latestCombatEventSummary.shortTitle === "Distance control applied")
      ? {
          detailLines: latestCombatEventSummary.details
            ? [latestCombatEventSummary.details]
            : undefined,
          interpretedResult: latestCombatEventSummary.summaryText,
          rankLabel: latestCombatEventSummary.shortTitle,
          resultLabel:
            latestCombatEventSummary.shortTitle === "Distance control applied"
              ? latestCombatEventSummary.summaryText
              : undefined,
        }
      : undefined;
  const inspectorHistoricalActionResult = inspectorIsHistorical
    ? inspectorHistoricalStepOutcome
      ? { interpretedResult: inspectorHistoricalStepOutcome.message }
      : buildHistoricalCombatActionResult({
          participantId: inspector.participant?.participantId,
          snapshot: inspectorSnapshot,
        })
    : undefined;
  const inspectorActionResult = inspectorIsHistorical
    ? inspectorHistoricalActionResult
    : inspectorPhaseResolutionLines
      ? {
          detailLines: [inspectorPhaseResolutionLines.armorLine].filter((line): line is string =>
            Boolean(line),
          ),
          interpretedResult: inspectorPhaseResolutionLines.statusLine,
          rankLabel: inspectorPhaseResolutionLines.attackLine,
          resultLabel: inspectorPhaseResolutionLines.proposalLine,
          sections: inspectorPhaseResolutionLines.sections,
        }
      : inspectorDisplayAttackResult
        ? buildCombatAttackResultPanel({
            participantId: inspector.participant?.participantId,
            result: inspectorDisplayAttackResult,
          })
        : inspectorLatestRelevantAttackResult
          ? buildCombatAttackResultPanel({
              participantId: inspector.participant?.participantId,
              result: inspectorLatestRelevantAttackResult,
            })
          : inspectorResolutionPhase
            ? {
                interpretedResult: `No ${formatCombatPhaseLabel(inspectorResolutionPhase)} attack result.`,
              }
            : inspectorNoPhaseAttack
              ? {
                  interpretedResult: `No ${formatCombatPhaseLabel(inspectorAttackPhase ?? "phase1")} attack.`,
                }
              : inspectorPhaseInitiativeChoiceResultPanel
                ? inspectorPhaseInitiativeChoiceResultPanel
                : inspectorDisplayInitiative
                  ? {
                      interpretedResult: formatCombatInitiativeFormula(inspectorDisplayInitiative),
                      rankLabel:
                        formatSnapshotInitiativeRankLabel(inspectorSnapshot?.initiativeRank) ??
                        (combatProgressionPresentation.executionOrder?.phase ===
                        inspectorCurrentInitiativePhase
                          ? formatInitiativeRankLabel({
                              participantId: inspector.participant?.participantId,
                              ranks:
                                inspectorCurrentInitiativePhase === "phase2"
                                  ? phase2Ranks
                                  : phase1Ranks,
                              value: getCombatRoundInitiativeTotal(inspectorDisplayInitiative),
                            })
                          : undefined),
                    }
                  : inspectorFallbackCombatExperienceResult
                    ? {
                        interpretedResult: formatCombatExperienceCalculation(
                          inspectorFallbackCombatExperienceResult,
                        ),
                        rankLabel: "Combat Experience",
                        resultLabel: formatCombatExperienceEffectLine(
                          inspectorFallbackCombatExperienceResult,
                        ),
                      }
                    : inspectorLatestRoundEndDistanceResult
                      ? inspectorLatestRoundEndDistanceResult
                      : null;
  const inspectorCurrentStepStatus = inspector.participant?.stepStatuses[inspector.step];
  const inspectorHistoricalStatusLabel = inspectorHistoricalStepOutcome
    ? inspectorHistoricalStepOutcome.category === "not_required"
      ? "Not required"
      : inspectorHistoricalStepOutcome.category === "not_applicable"
        ? "Not applicable"
        : "Skipped"
    : undefined;
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
  const inspectorInitiativeCalculation = buildEncounterInitiativeModifierCalculation({
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
      manualSelectionRef.current = undefined;
      pendingSelectionRef.current = undefined;
      setSelectedRoundNumber(initialRoundState.roundNumber);
      setDamageReviewDrafts({});
      setInspectorDrafts({});
      setInspectorModifierEditedDraftKeys({});
      setParrySourceSelections({});
      setRoundEndHealthDifficultyDrafts({});
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

  function scrollActiveCurrentCellIntoView(
    stateForCurrentTask: CombatRoundState = roundState,
    mode: CombatRoundTimelineScrollMode = "nearest",
  ) {
    const selection = getCurrentCombatRoundTaskSelection(stateForCurrentTask);

    if (!selection?.participantId) {
      return;
    }

    scrollTimelineCellIntoView(
      {
        participantId: selection.participantId,
        roundNumber: stateForCurrentTask.roundNumber,
        step: selection.step,
      },
      mode,
    );
  }

  function focusRoundTable(
    input: {
      scrollIntoView?: boolean;
      scrollMode?: CombatRoundTimelineScrollMode;
      scrollToCurrent?: boolean;
      state?: CombatRoundState;
    } = {},
  ) {
    if (input.scrollIntoView !== false && input.scrollToCurrent !== true) {
      tableContainerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    tableContainerRef.current?.focus({ preventScroll: true });

    if (input.scrollToCurrent) {
      scrollActiveCurrentCellIntoView(input.state ?? roundState, input.scrollMode);
    }
  }

  function buildScenarioParticipantPhaseSummary(input: {
    declaration?: CombatRoundDeclaration;
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
    const liveModifiers = buildEncounterLiveCombatModifierSummary({
      combatContext: draft.combatContext,
      combatEffects: input.scenarioParticipant?.state.combatEffects,
      phaseKey: input.phaseKey,
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
        step,
      });
      const modifierRows = recordedModifierRows.map((row) => ({
        bucketKey: row.bucketKey,
        entries: row.entries,
        label: row.label,
        total: row.total,
      }));
      const phaseContext = phaseSummary.phaseContext;
      const targetOptions = getPlayerEncounterOpponentParticipants({
        allowedParticipantIds: encounterScenarioParticipantIds,
        isGameMaster: true,
        participants: effectiveScenarioParticipants,
        selectedParticipantId: scenarioParticipant?.id,
      });
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
          dbRaw: phaseSummary.liveModifiers.dbRaw,
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

  async function commitCurrentStep() {
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
      setSaving(true);

      try {
        const {
          commandEnvelope,
          encounter: nextEncounter,
          participants,
        } = await commitPhaseInitiativeResolutionOnServer({
          encounterId: encounter.id,
          phase: phaseInitiativeResolutionPhase,
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
        setRoundState(nextRoundState);
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
        encounterId: boundaryTransitionAction.encounterId,
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
      const stalePayload =
        caughtError instanceof ApiRequestError &&
        caughtError.status === 409 &&
        caughtError.payload &&
        typeof caughtError.payload === "object" &&
        "code" in caughtError.payload &&
        caughtError.payload.code === "stale_revision";

      if (stalePayload) {
        try {
          const refreshedEncounter = await loadEncounterById(boundaryTransitionAction.encounterId);
          const accepted = acceptCanonicalEncounterState(refreshedEncounter);

          if (accepted) {
            onEncounterUpdated?.(refreshedEncounter);
          }
          setSaveError(
            "Combat state refreshed. Review the current action and retry if it is still available.",
          );
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

  async function persistRoundState(nextRoundState: typeof roundState) {
    const stateToPersist = nextRoundState;

    setRoundState(stateToPersist);
    setInspectionSelection(
      resolveCombatRoundInspectionSelection({
        manualSelection: getCurrentCombatRoundTaskSelection(stateToPersist),
        state: stateToPersist,
      }),
    );
    setSelectedRoundNumber(stateToPersist.roundNumber);
    setSaving(true);

    try {
      const nextEncounter = await updateEncounterOnServer({
        encounterId: encounter.id,
        session: {
          ...encounter,
          combatRoundState: stateToPersist,
          currentRound: stateToPersist.roundNumber,
        },
      });

      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: stateToPersist });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to save combat round state.",
      );
    } finally {
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
      setRoundState(nextRoundState);
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
    manualSelectionRef.current = undefined;
    pendingSelectionRef.current = undefined;
    setSelectedRoundNumber(roundState.roundNumber);
    setInspectionSelection(
      resolveCombatRoundInspectionSelection({
        manualSelection: getCurrentCombatRoundTaskSelection(roundState),
        state: roundState,
      }),
    );
    focusRoundTable({
      scrollIntoView: false,
      scrollMode: "center",
      scrollToCurrent: true,
      state: roundState,
    });
  }

  function selectTimelineSelection(
    selection: CombatRoundTimelineSelection,
    mode: CombatRoundTimelineScrollMode = "nearest",
  ) {
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
      timelineRoundStates,
    });
    const nextSelection =
      input.stepOffset !== undefined
        ? getAdjacentCombatRoundTimelineStepSelection({
            participantId: inspectionSelection.participantId,
            roundNumbers: timelineRoundNumbers,
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
    if (isGridArrowTarget(event.target)) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection({ stepOffset: 1 });
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelection({ stepOffset: -1 });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection({ participantOffset: 1 });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection({ participantOffset: -1 });
    }
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

  async function saveInspectorDeclaration() {
    if (!encounter.scenarioId || !selectedScenarioParticipant || !selectedEncounterParticipant) {
      return;
    }

    if (inspectorCombatExperienceRequired) {
      setSaveError("Roll Combat Experience before declaring an action.");
      return;
    }

    const feintTargetResolution =
      inspectorDraft.actionId === "feint_attack"
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
    if (inspectorDraft.actionId === "adjust_range_attack") {
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
    const targetValidation = validateCombatDeclarationTargets({
      actionId: inspectorDraft.actionId || undefined,
      phaseContexts: requestPhaseContexts,
      secondaryActionId: inspectorDraft.secondaryActionId || undefined,
    });

    if (!targetValidation.valid) {
      setSaveError(targetValidation.message ?? "Select a target for each attack phase.");
      return;
    }

    setSaving(true);

    try {
      const actedParticipantId = selectedEncounterParticipant.id;
      const actedStep = roundState.currentStep;
      const shouldUsePersistedCursor = isGlobalCombatRoundParticipantStep(actedStep);
      const displayedParticipantIds = displayParticipants.map(
        (participant) => participant.participantId,
      );
      const { encounter: nextEncounter, participant } = await submitCombatDeclarationOnServer({
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
        combatContext: inspectorGeneratedCombatContext,
        encounterId: encounter.id,
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
        phaseAttackSources: {
          phase1:
            inspectorDraft.actionId === "double_attack" ||
            (inspectorDraft.actionId === "feint_attack" && inspectorDraft.feintMethod === "weapon")
              ? buildCombatAttackSourceRef({
                  phaseKey: "phase1",
                  reference: inspectorPhaseLoadoutSummaries.phase1.reference,
                  unarmedTemplateId: "virtual-weapon-template-punch",
                })
              : undefined,
          phase2:
            inspectorDraft.actionId === "double_attack" ||
            inspectorDraft.actionId === "feint_attack" ||
            inspectorDraft.actionId === "adjust_range_attack"
              ? buildCombatAttackSourceRef({
                  phaseKey: "phase2",
                  reference: inspectorPhaseLoadoutSummaries.phase2.reference,
                  unarmedTemplateId: "virtual-weapon-template-kick",
                })
              : undefined,
        },
        phaseWeaponNames: {
          phase1: inspectorPhaseLoadoutSummaries.phase1.attackStats?.weaponName,
          phase2: inspectorPhaseLoadoutSummaries.phase2.attackStats?.weaponName,
        },
        scenarioParticipantId: selectedScenarioParticipant.id,
        secondaryActionId: inspectorDraft.secondaryActionId || undefined,
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

      setScenarioParticipantOverrides((current) => ({
        ...current,
        [participant.id]: participant,
      }));

      if (nextSelection) {
        pendingSelectionRef.current = nextSelection;
        manualSelectionRef.current = nextSelection;
      } else {
        pendingSelectionRef.current = undefined;
        manualSelectionRef.current = undefined;
      }

      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      onScenarioParticipantsUpdated?.([participant]);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to save combat declaration.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollInspectorFeint() {
    if (!inspectorFeintProposal || !inspectorFeintExpectedScenarioParticipant) return;
    setSaving(true);
    try {
      const { encounter: nextEncounter } = await rollCombatFeintOnServer({
        encounterId: encounter.id,
        proposalId: inspectorFeintProposal.id,
        scenarioParticipantId: inspectorFeintExpectedScenarioParticipant.id,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      setRoundState(nextRoundState);
      setInspectionSelection(resolveCombatRoundInspectionSelection({ state: nextRoundState }));
      onEncounterUpdated?.(nextEncounter);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : "Unable to roll feint.");
    } finally {
      setSaving(false);
    }
  }

  async function advanceInspectorAdjustDistance() {
    if (!inspectorAdjustDistanceProposal || saving) return;
    setSaving(true);
    try {
      let nextEncounter: EncounterSession;
      if (inspectorAdjustDistanceProposal.status === "awaiting_defender_response") {
        if (!inspectorAdjustDistanceExpectedScenarioParticipant) return;
        nextEncounter = await respondCombatAdjustDistanceOnServer({
          encounterId: encounter.id,
          proposalId: inspectorAdjustDistanceProposal.id,
          response: inspectorAdjustDistanceResponse,
          scenarioParticipantId: inspectorAdjustDistanceExpectedScenarioParticipant.id,
        });
      } else if (inspectorAdjustDistanceProposal.status === "awaiting_gm_adjustment") {
        const draft = inspectorAdjustDistanceAdjustmentDraftRef.current?.getDraft() ?? {
          note: "",
          participantId: "",
          value: "0",
        };
        const request = buildAdjustDistanceGmAdjustmentRequest(draft);
        nextEncounter = await reviewCombatAdjustDistanceOnServer({
          encounterId: encounter.id,
          proposalId: inspectorAdjustDistanceProposal.id,
          ...request,
        });
      } else if (inspectorAdjustDistanceProposal.status === "awaiting_rolls") {
        if (!inspectorAdjustDistanceExpectedScenarioParticipant) return;
        nextEncounter = await rollCombatAdjustDistanceOnServer({
          encounterId: encounter.id,
          proposalId: inspectorAdjustDistanceProposal.id,
          scenarioParticipantId: inspectorAdjustDistanceExpectedScenarioParticipant.id,
        });
      } else if (inspectorAdjustDistanceProposal.status === "awaiting_review") {
        nextEncounter = await commitCombatAdjustDistanceOnServer({
          committedDistance: Number.parseInt(inspectorAdjustDistanceCommittedDistance, 10),
          encounterId: encounter.id,
          notes: inspectorAdjustDistanceReviewNote || undefined,
          outcome: inspectorAdjustDistanceOutcome,
          proposalId: inspectorAdjustDistanceProposal.id,
        });
      } else return;
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      setRoundState(nextRoundState);
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

  async function commitInspectorFeint() {
    if (!inspectorFeintProposal?.review) return;
    setSaving(true);
    try {
      const { encounter: nextEncounter, participants } = await commitCombatFeintOnServer({
        encounterId: encounter.id,
        gmAttackerDbParryModifier: Number.parseInt(inspectorFeintAttackerModifier, 10) || 0,
        gmDefenderDbParryModifier: Number.parseInt(inspectorFeintDefenderDbModifier, 10) || 0,
        gmDefenderSkillObModifier: Number.parseInt(inspectorFeintDefenderObModifier, 10) || 0,
        notes: inspectorFeintNote || undefined,
        proposalId: inspectorFeintProposal.id,
      });
      setScenarioParticipantOverrides((current) => ({
        ...current,
        ...Object.fromEntries(participants.map((participant) => [participant.id, participant])),
      }));
      onScenarioParticipantsUpdated?.(participants);
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      setRoundState(nextRoundState);
      setInspectionSelection(resolveCombatRoundInspectionSelection({ state: nextRoundState }));
      onEncounterUpdated?.(nextEncounter);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : "Unable to commit feint.");
    } finally {
      setSaving(false);
    }
  }

  async function rollInspectorCombatExperience() {
    if (!selectedScenarioParticipant || !selectedEncounterParticipant) {
      return;
    }

    if (!inspectorCombatExperienceWindowOpen) {
      setSaveError("Set Combat Experience difficulty before rolling.");
      return;
    }

    setSaving(true);

    try {
      const { encounter: nextEncounter, participant } = await rollCombatExperienceOnServer({
        encounterId: encounter.id,
        scenarioParticipantId: selectedScenarioParticipant.id,
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
      setRoundState(nextRoundState);
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

  async function backOutInspectorPhaseAttack() {
    if (
      !selectedScenarioParticipant ||
      !selectedEncounterParticipant ||
      !inspectorPhaseAttackBackOutOpportunity
    ) {
      return;
    }

    setSaving(true);

    try {
      const { encounter: nextEncounter, participant } = await backOutPhaseAttackOnServer({
        encounterId: encounter.id,
        phase: inspectorPhaseAttackBackOutOpportunity.phase,
        scenarioParticipantId: selectedScenarioParticipant.id,
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
      setRoundState(nextRoundState);
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

  async function continueInspectorPhaseAttack() {
    if (
      !selectedScenarioParticipant ||
      !selectedEncounterParticipant ||
      !inspectorPhaseAttackBackOutOpportunity
    ) {
      return;
    }

    setSaving(true);

    try {
      const { encounter: nextEncounter, participant } = await continuePhaseAttackOnServer({
        encounterId: encounter.id,
        phase: inspectorPhaseAttackBackOutOpportunity.phase,
        scenarioParticipantId: selectedScenarioParticipant.id,
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
      setRoundState(nextRoundState);
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

  async function decideInspectorDoubleAttackPhase2() {
    if (!selectedScenarioParticipant || !selectedEncounterParticipant) return;
    setSaving(true);
    try {
      const { encounter: nextEncounter, participant } = await decideDoubleAttackPhase2OnServer({
        decision: inspectorDoubleAttackDecision,
        encounterId: encounter.id,
        scenarioParticipantId: selectedScenarioParticipant.id,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      setScenarioParticipantOverrides((current) => ({
        ...current,
        [participant.id]: participant,
      }));
      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(resolveCombatRoundInspectionSelection({ state: nextRoundState }));
      setRoundState(nextRoundState);
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

  async function saveCombatExperienceDifficultyDraft(value = inspectorCombatExperienceDifficulty) {
    const difficulty = Number.parseInt(value, 10);

    if (!Number.isInteger(difficulty) || difficulty <= 0) {
      setSaveError("Combat Experience difficulty must be a positive integer.");
      return;
    }

    if (difficulty === activeCombatExperienceDifficulty && inspectorCombatExperienceWindowOpen) {
      return;
    }

    setSaving(true);

    try {
      const { encounter: nextEncounter } = await setCombatExperienceDifficultyOnServer({
        difficulty,
        encounterId: encounter.id,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      const nextInspectionSelection = resolveCombatRoundInspectionSelection({
        state: nextRoundState,
      });

      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState);
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
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to set Combat Experience difficulty.",
      );
    } finally {
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
      setRoundState(nextRoundState);
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

  async function rollInspectorInitiative() {
    if (!selectedScenarioParticipant || !selectedEncounterParticipant) {
      return;
    }

    setSaving(true);

    try {
      const actedParticipantId = selectedEncounterParticipant.id;
      const actedStep = roundState.currentStep;
      const shouldUsePersistedCursor = isGlobalCombatRoundParticipantStep(actedStep);
      const displayedParticipantIds = displayParticipants.map(
        (participant) => participant.participantId,
      );
      const { encounter: nextEncounter } = await rollCombatInitiativeOnServer({
        encounterId: encounter.id,
        initiativeBase: inspectorInitiativeCalculation.baseInitiative,
        initiativeModifierAdjustment: inspectorInitiativeCalculation.modifierAdjustment,
        scenarioParticipantId: selectedScenarioParticipant.id,
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
      setRoundState(nextRoundState);
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

  async function rollInspectorPhaseAttack(phase: CombatRoundPhase) {
    if (!selectedScenarioParticipant || !selectedEncounterParticipant) {
      return;
    }

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
    const phaseContext = inspectorDraft.phaseContexts[phase];
    const phaseModel = buildPlayerCombatPhasePanelModel({
      actionId: inspectorDraft.actionId,
      attackStats: inspectorPhaseLoadoutSummaries[phase].attackStats,
      defenseStats: null,
      phaseCard: {
        description: "",
        phaseLabel: phase === "phase1" ? "Phase 1" : "Phase 2",
        stats: [],
        title: "",
      },
      phaseContext,
      phaseKey: phase,
      secondaryActionId: inspectorDraft.secondaryActionId,
    });

    if (!phaseModel.showAttackStats || !phaseModel.attackStats) {
      setSaveError(`No ${phaseLabel} attack source available.`);
      return;
    }

    const targetIdentity = resolveCanonicalCombatTargetIdentity({
      encounterParticipants: encounter.participants,
      targetParticipantId: phaseContext.targetParticipantId,
    });
    const targetScenarioParticipant = effectiveScenarioParticipants.find(
      (participant) => participant.id === targetIdentity?.scenarioParticipantId,
    );
    const targetEncounterParticipant = findEncounterParticipantForScenarioParticipant({
      encounterParticipants: encounter.participants,
      scenarioParticipant: targetScenarioParticipant,
      scenarioParticipantId: phaseContext.targetParticipantId,
    });
    const targetRoundParticipant = roundState.participants.find(
      (participant) => participant.participantId === targetEncounterParticipant?.id,
    );

    if (!targetIdentity || !targetScenarioParticipant || !targetEncounterParticipant) {
      setSaveError(
        inspectorDraft.actionId === "feint_attack" && phase === "phase2"
          ? "The Feint target is no longer in this encounter."
          : `Select a target for ${phaseLabel} attack.`,
      );
      return;
    }

    const targetPhaseSummary = buildScenarioParticipantPhaseSummary({
      declaration: targetRoundParticipant?.declaration,
      phaseKey: phase,
      scenarioParticipant: targetScenarioParticipant,
    });

    if (!targetPhaseSummary.defenseStats) {
      setSaveError(`Target ${phaseLabel} DB is not available.`);
      return;
    }

    let defenderDb: number;
    let ob: number;

    try {
      ob = parseCombatInteger(phaseModel.attackStats.ob, `${phaseLabel} OB`);
      defenderDb = parseCombatInteger(
        targetPhaseSummary.defenseStats.db,
        `Target ${phaseLabel} DB`,
      );
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to resolve ${phaseLabel} attack.`,
      );
      return;
    }

    setSaving(true);

    try {
      const {
        commandEnvelope,
        encounter: nextEncounter,
        participant,
      } = await rollCombatAttackOnServer({
        actionId: inspectorDraft.actionId || `${phase}_attack`,
        defenderDb,
        defenderDbParryRaw: getMergedCombatDbParryModifierTotal({
          combatContext: targetScenarioParticipant.state.combat.combatContext,
          phase,
        }),
        defenderParticipantId: targetIdentity.encounterParticipantId,
        encounterId: encounter.id,
        ob,
        obSkillRaw: getMergedCombatSkillObModifierTotal({
          combatContext: inspectorGeneratedCombatContext,
          phase,
        }),
        phase,
        scenarioParticipantId: selectedScenarioParticipant.id,
        weaponCriticalCode: phaseModel.attackStats.weaponCriticalCode,
        weaponDamageClass: phaseModel.attackStats.weaponDamageClass,
        weaponName: phaseModel.attackStats.weaponName,
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
      setRoundState(nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to save ${phaseLabel} attack result.`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function rollInspectorParry() {
    const attackResult = inspectorResolutionAttackResult;
    const phase = inspectorResolutionPhase;

    if (!attackResult || !phase) {
      setSaveError("No attack result is available for parry.");
      return;
    }

    if (!attackResult.hit) {
      setSaveError("Attack missed; parry is not applicable.");
      return;
    }

    if (inspectorParryBase === undefined) {
      setSaveError("Select at least one available parry source.");
      return;
    }

    if (!inspectorParryDefenderScenarioParticipant) {
      setSaveError("Defender scenario participant is required to roll parry.");
      return;
    }

    const sources = inspectorParryDefenderPhaseSummary?.parrySources;
    const usedMainHand = inspectorParrySelection.usedMainHand && Boolean(sources?.mainHand);
    const usedOffHand = inspectorParrySelection.usedOffHand && Boolean(sources?.offHand);

    setSaving(true);

    try {
      const { commandEnvelope, encounter: nextEncounter } = await rollCombatParryCommandOnServer({
        attackResultId: getCombatRoundAttackResultId({
          result: attackResult,
          roundNumber: roundState.roundNumber,
        }),
        dbParryRaw: getMergedCombatDbParryModifierTotal({
          combatContext: inspectorParryDefenderScenarioParticipant.state.combat.combatContext,
          phase,
        }),
        encounterId: encounter.id,
        mainHandParryScore: usedMainHand ? sources?.mainHand?.score : undefined,
        offHandParryScore: usedOffHand ? sources?.offHand?.score : undefined,
        parryBase: inspectorParryBase,
        parrySourceLabel: formatSelectedCombatParrySourceName({
          selection: {
            usedMainHand,
            usedOffHand,
          },
          sources,
        }),
        scenarioParticipantId: inspectorParryDefenderScenarioParticipant.id,
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
      setRoundState(nextRoundState);
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

  async function completeInspectorPhaseResolution(phase: CombatRoundPhase) {
    const ownerParticipantId = inspectorPhaseResolutionOwnerParticipantId;

    if (!ownerParticipantId) {
      return;
    }

    setSaving(true);

    try {
      const { commandEnvelope, encounter: nextEncounter } =
        await completeCurrentCombatPhaseResolutionOnServer({
          encounterId: encounter.id,
        });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to complete ${formatCombatPhaseLabel(phase)} resolution.`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function skipInspectorCurrentPhaseAction() {
    setSaving(true);

    try {
      const { commandEnvelope, encounter: nextEncounter } =
        await skipCombatRoundCurrentActionOnServer({
          encounterId: encounter.id,
        });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to skip current action.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveInspectorDamageReview() {
    const damageResult = inspectorDisplayPhaseResolutionResult?.damageResult;

    if (!inspectorDamageReviewKey || !damageResult) {
      return;
    }

    setSaving(true);

    try {
      const { commandEnvelope, encounter: nextEncounter } =
        await saveCurrentCombatDamageReviewOnServer({
          encounterId: encounter.id,
          review: buildCombatDamageReviewFromDraft({
            criticalRoll: inspectorDisplayPhaseResolutionResult?.criticalRoll,
            damageResult,
            draft: inspectorDamageReviewDraft,
          }),
        });
      const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
        getCombatRoundManagerStateFromCommandEnvelope({
          commandEnvelope,
          encounter: nextEncounter,
        });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
      setInspectionSelection(nextInspectionSelection);
      setRoundState(nextRoundState);
      setSelectedRoundNumber(nextRoundState.roundNumber);
      setDamageReviewDrafts((current) => {
        const rest = { ...current };
        delete rest[inspectorDamageReviewKey];

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

  async function advanceInspectorRoundEndReview() {
    if (!selectedRoundIsActive || inspector.step !== "round_summary") {
      return;
    }

    setSaving(true);

    try {
      if (!roundState.roundEndReview) {
        setSaveError("Round-end review is preparing automatically.");
        return;
      }

      if (!inspector.participant?.participantId) {
        setSaveError("Select a participant for SU review.");
        return;
      }

      const participantReview =
        roundState.roundEndReview.participantReviews[inspector.participant.participantId];

      if (!participantReview) {
        setSaveError("Round-end review is missing for this participant.");
        return;
      }

      if (inspectorRoundEndTask?.kind === "effect_review") {
        if (!encounter.scenarioId || !selectedScenarioParticipant) {
          setSaveError("Scenario participant state is required to commit SU review.");
          return;
        }

        const { encounter: nextEncounter, participant: updatedParticipant } =
          await commitRoundEndParticipantReviewOnServer({
            encounterId: encounter.id,
            scenarioParticipantId: selectedScenarioParticipant.id,
          });
        const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
        acceptCanonicalEncounterState(nextEncounter, nextRoundState);
        setInspectionSelection({
          participantId: nextRoundState.currentCursor?.participantId,
          step: "round_summary",
        });
        setScenarioParticipantOverrides((current) => ({
          ...current,
          [updatedParticipant.id]: updatedParticipant,
        }));
        onScenarioParticipantsUpdated?.([updatedParticipant]);
        onEncounterUpdated?.(nextEncounter);
        setSaveError(undefined);
        return;
      }

      if (inspectorRoundEndTask?.kind === "health_review") {
        if (!encounter.scenarioId || !selectedScenarioParticipant) {
          setSaveError("Scenario participant state is required to roll SU health.");
          return;
        }

        const pendingHealthRoll = participantReview.proposedHealthRolls.find(
          (proposal) =>
            proposal.accepted &&
            proposal.status === "pending" &&
            proposal.id === inspectorRoundEndTask.identity.healthRollId,
        );

        if (!pendingHealthRoll) {
          setSaveError("No pending health roll is available for this participant.");
          return;
        }

        const difficultyDraft = roundEndHealthDifficultyDrafts[pendingHealthRoll.id];
        const difficulty =
          difficultyDraft && difficultyDraft.trim().length > 0
            ? parseCombatInteger(difficultyDraft, "Health difficulty")
            : pendingHealthRoll.difficulty;

        const { encounter: nextEncounter, participant: updatedParticipant } =
          await rollRoundEndHealthCheckOnServer({
            difficulty,
            encounterId: encounter.id,
            healthRollId: pendingHealthRoll.id,
            scenarioParticipantId: selectedScenarioParticipant.id,
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

  async function commitRoundEndDistanceControl(distanceProposalId: string) {
    if (!selectedRoundIsActive || inspector.step !== "round_summary") {
      return;
    }

    setSaving(true);

    try {
      const overrideDraft = roundEndDistanceOverrideDrafts[distanceProposalId];
      const { commandEnvelope, encounter: nextEncounter } =
        await commitRoundEndDistanceControlOnServer({
          distanceOverride:
            overrideDraft && overrideDraft.trim().length > 0
              ? parseCombatInteger(overrideDraft, "Distance")
              : undefined,
          distanceProposalId,
          encounterId: encounter.id,
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

        delete next[distanceProposalId];

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

  async function rollRoundEndDistanceControlFromPrimaryAction() {
    if (
      !selectedRoundIsActive ||
      inspector.step !== "round_summary" ||
      inspectorRoundEndDistanceAction?.kind !== "roll"
    ) {
      return;
    }

    setSaving(true);

    try {
      const { commandEnvelope, encounter: nextEncounter } =
        await rollCurrentRoundEndDistanceControlOnServer({
          encounterId: encounter.id,
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

  async function advanceInspectorPhaseResolutionSubstep(phase: CombatRoundPhase) {
    const ownerParticipantId = inspectorPhaseResolutionOwnerParticipantId;

    if (!ownerParticipantId) {
      return;
    }

    setSaving(true);

    try {
      const updatedAt = new Date().toISOString();
      const currentOwnerStatus = getCombatRoundPhaseResolutionStatus({
        participantId: ownerParticipantId,
        phase,
        state: roundState,
      });
      const damageReviewAttackResult = inspectorResolutionAttackResult;
      let nextRoundState: typeof roundState;

      if (currentOwnerStatus.substep === "damage") {
        if (!damageReviewAttackResult) {
          setSaveError("No attack result is available for damage review.");
          return;
        }

        const existingDamageResolution = getCombatRoundPhaseResolutionResultForAttack({
          attackResult: damageReviewAttackResult,
          state: roundState,
        });
        const damageSubstate = getCombatRoundDamageSubstate(existingDamageResolution);
        const attackerRoundParticipant = roundState.participants.find(
          (participant) =>
            participant.participantId === damageReviewAttackResult.attackerParticipantId,
        );
        const buildDamageProposalInput = () => {
          const phaseLabel = formatCombatPhaseLabel(phase);
          const attackerEncounterParticipant = encounter.participants.find(
            (participant) => participant.id === damageReviewAttackResult.attackerParticipantId,
          );
          const attackerScenarioParticipant = attackerEncounterParticipant
            ? findScenarioParticipantForEncounterParticipant({
                encounterParticipant: attackerEncounterParticipant,
                scenarioParticipants: effectiveScenarioParticipants,
              })
            : undefined;
          const attackerPhaseSummary = buildScenarioParticipantPhaseSummary({
            declaration: attackerRoundParticipant?.declaration,
            phaseKey: phase,
            scenarioParticipant: attackerScenarioParticipant,
          });
          const attackStats = attackerPhaseSummary.attackStats;
          const defenseStats = inspectorParryDefenderPhaseSummary?.defenseStats;

          if (!attackStats) {
            setSaveError(`${phaseLabel} attack DMB is not available.`);
            return undefined;
          }

          if (!defenseStats) {
            setSaveError(`${phaseLabel} defender DM is not available.`);
            return undefined;
          }

          return {
            armorCoverage: inspectorParryDefenderPhaseSummary?.armorCoverage,
            attackerStrengthGm: attackerPhaseSummary.strengthGm,
            defenderDm: parseCombatInteger(defenseStats.dm, `${phaseLabel} defender DM`),
            dmb: parseCombatInteger(attackStats.dmb, `${phaseLabel} DMB`),
            weaponArmorClass: normalizeCombatArmorModifierClass(attackStats.weaponArmorClass),
          };
        };

        if (damageSubstate === "location_pending") {
          const damageProposal = buildDamageProposalInput();

          if (!damageProposal) {
            return;
          }

          nextRoundState = recordCombatRoundHitLocationRoll({
            attackResult: damageReviewAttackResult,
            command: {
              createdAt: updatedAt,
            },
            damageProposal,
            rolledByParticipantId: damageReviewAttackResult.attackerParticipantId,
            state: roundState,
            submittedBy: "gm",
            targetLocation:
              attackerRoundParticipant?.declaration?.phaseContexts?.[phase]?.targetLocation,
            updatedAt,
          });
        } else if (damageSubstate === "location_rolled") {
          const damageProposal = buildDamageProposalInput();

          if (!damageProposal) {
            return;
          }

          nextRoundState = recordCombatRoundDamageResult({
            ...damageProposal,
            attackResult: damageReviewAttackResult,
            command: {
              createdAt: updatedAt,
            },
            state: roundState,
            submittedBy: "gm",
            updatedAt,
          });
        } else if (damageSubstate === "critical_pending") {
          nextRoundState = recordCombatRoundCriticalRoll({
            attackResult: damageReviewAttackResult,
            command: {
              createdAt: updatedAt,
            },
            rolledByParticipantId: damageReviewAttackResult.attackerParticipantId,
            state: roundState,
            submittedBy: "gm",
            updatedAt,
          });
        } else if (
          existingDamageResolution?.damageResult &&
          existingDamageResolution.damageProposal.status !== "committed"
        ) {
          if (!encounter.scenarioId) {
            setSaveError("Scenario id is required to commit phase damage.");
            return;
          }

          const { commandEnvelope, encounter: nextEncounter } =
            await commitCurrentCombatPhaseDamageOnServer({
              encounterId: encounter.id,
              review: buildCombatDamageReviewFromDraft({
                criticalRoll: inspectorDisplayPhaseResolutionResult?.criticalRoll,
                damageResult: existingDamageResolution.damageResult,
                draft: inspectorDamageReviewDraft,
              }),
            });
          const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
            getCombatRoundManagerStateFromCommandEnvelope({
              commandEnvelope,
              encounter: nextEncounter,
            });

          pendingSelectionRef.current = undefined;
          manualSelectionRef.current = undefined;
          setInspectionSelection(nextInspectionSelection);
          setRoundState(nextRoundState);
          setSelectedRoundNumber(nextRoundState.roundNumber);
          if (inspectorDamageReviewKey) {
            setDamageReviewDrafts((current) => {
              const rest = { ...current };
              delete rest[inspectorDamageReviewKey];

              return rest;
            });
          }
          onEncounterUpdated?.(nextEncounter);
          focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
          setSaveError(undefined);
          return;
        } else {
          setSaveError("Hit location roll required.");
          return;
        }

        await persistRoundState(nextRoundState);
      } else {
        const { commandEnvelope, encounter: nextEncounter } =
          await advanceCurrentCombatPhaseResolutionOnServer({
            encounterId: encounter.id,
          });
        const { inspectionSelection: nextInspectionSelection, state: nextRoundState } =
          getCombatRoundManagerStateFromCommandEnvelope({
            commandEnvelope,
            encounter: nextEncounter,
          });

        pendingSelectionRef.current = undefined;
        manualSelectionRef.current = undefined;
        setInspectionSelection(nextInspectionSelection);
        setRoundState(nextRoundState);
        setSelectedRoundNumber(nextRoundState.roundNumber);
        onEncounterUpdated?.(nextEncounter);
        focusRoundTable({ scrollToCurrent: true, state: nextRoundState });
      }

      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to advance ${formatCombatPhaseLabel(phase)} resolution.`,
      );
    } finally {
      setSaving(false);
    }
  }

  const trackerCellFacts: CombatTrackerCellFacts[] = [];

  for (const timelineRoundState of timelineRoundStates) {
    const snapshotByCellKey = new Map(
      timelineRoundState.stepSnapshots.map((snapshot) => [
        buildCombatTrackerCellKey({
          participantId: snapshot.participantId,
          roundNumber: snapshot.roundNumber,
          step: snapshot.step,
        }),
        snapshot,
      ]),
    );
    const feintByAttackerId = new Map(
      timelineRoundState.feintProposals
        .filter((proposal) => proposal.roundNumber === timelineRoundState.roundNumber)
        .map((proposal) => [proposal.attackerParticipantId, proposal]),
    );
    const adjustDistanceByAttackerId = new Map(
      timelineRoundState.adjustDistanceProposals
        .filter((proposal) => proposal.roundNumber === timelineRoundState.roundNumber)
        .map((proposal) => [proposal.attackerParticipantId, proposal]),
    );
    const outgoingAttackByParticipantPhase = new Map<string, CombatRoundAttackRollResult>();
    const incomingAttackByParticipantPhase = new Map<string, CombatRoundAttackRollResult>();
    for (const participant of timelineRoundState.participants) {
      for (const phase of ["phase1", "phase2"] as const) {
        const key = `${participant.participantId}:${phase}`;
        const outgoing = getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: participant.participantId,
          phase,
          state: timelineRoundState,
        });
        const incoming = getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: participant.participantId,
          phase,
          state: timelineRoundState,
        });
        if (outgoing) outgoingAttackByParticipantPhase.set(key, outgoing);
        if (incoming) incomingAttackByParticipantPhase.set(key, incoming);
      }
    }
    for (const timelineParticipant of displayParticipants) {
      const roundParticipant =
        timelineRoundState.participants.find(
          (candidate) => candidate.participantId === timelineParticipant.participantId,
        ) ?? timelineParticipant;

      for (const step of COMBAT_ROUND_STEPS) {
        const stepStatus = getParticipantDeclarationStatus({
          participantId: timelineParticipant.participantId,
          roundState: timelineRoundState,
          status: roundParticipant.stepStatuses[step] ?? "pending",
          step,
        });
        const initiative =
          step === "initiative_phase_1"
            ? roundParticipant.initiatives.phase1
            : step === "initiative_phase_2"
              ? roundParticipant.initiatives.phase2
              : undefined;
        const trackerAttackPhase = getCombatAttackPhaseForStep(step);
        const trackerSnapshot = snapshotByCellKey.get(
          buildCombatTrackerCellKey({
            participantId: timelineParticipant.participantId,
            roundNumber: timelineRoundState.roundNumber,
            step,
          }),
        );
        const trackerCanonicalAttackResult = trackerAttackPhase
          ? outgoingAttackByParticipantPhase.get(
              `${timelineParticipant.participantId}:${trackerAttackPhase}`,
            )
          : undefined;
        const trackerAttackResult = trackerCanonicalAttackResult ?? trackerSnapshot?.attackResult;
        const trackerResolutionPhase = getCombatRoundResolutionPhaseForStep(step);
        const trackerResolutionAttackResult = trackerSnapshot
          ? trackerSnapshot.attackResult
          : trackerResolutionPhase
            ? incomingAttackByParticipantPhase.get(
                `${timelineParticipant.participantId}:${trackerResolutionPhase}`,
              )
            : undefined;
        const trackerPhaseResolutionResult = trackerSnapshot
          ? trackerSnapshot.phaseResolutionResult
          : trackerResolutionAttackResult
            ? getCombatRoundPhaseResolutionResultForAttack({
                attackResult: trackerResolutionAttackResult,
                state: timelineRoundState,
              })
            : undefined;
        const trackerFeintProposal =
          step === "phase_1_actions"
            ? feintByAttackerId.get(timelineParticipant.participantId)
            : undefined;
        const trackerFeintModifier = trackerFeintProposal?.review
          ? (trackerFeintProposal.review.gmDefenderObDbModifier ??
            trackerFeintProposal.review.proposedDefenderObDbModifier)
          : undefined;
        const trackerAdjustDistanceProposal =
          step === "phase_1_actions"
            ? adjustDistanceByAttackerId.get(timelineParticipant.participantId)
            : undefined;
        trackerCellFacts.push({
          adjustDistance: trackerAdjustDistanceProposal
            ? {
                committedDistance: trackerAdjustDistanceProposal.review?.committedDistance,
                currentDistance: trackerAdjustDistanceProposal.currentDistance,
                defenderLabel: timelineRoundState.participants.find(
                  (participant) =>
                    participant.participantId ===
                    trackerAdjustDistanceProposal.defenderParticipantId,
                )?.label,
                requestedDistance: trackerAdjustDistanceProposal.requestedDistance,
                status:
                  trackerAdjustDistanceProposal.status === "committed" ? "committed" : "pending",
              }
            : undefined,
          actionResultStatus: trackerSnapshot?.actionResultStatus,
          attackAttackerLabel: trackerAttackResult
            ? timelineRoundState.participants.find(
                (participant) =>
                  participant.participantId === trackerAttackResult.attackerParticipantId,
              )?.label
            : undefined,
          attackDefenderLabel: trackerAttackResult
            ? timelineRoundState.participants.find(
                (participant) =>
                  participant.participantId === trackerAttackResult.defenderParticipantId,
              )?.label
            : undefined,
          attackResult: trackerAttackResult,
          commands: timelineRoundState.commands,
          declarationSubmittedBy: roundParticipant.declaration?.submittedBy,
          feint: trackerFeintProposal
            ? {
                defenderLabel: timelineRoundState.participants.find(
                  (participant) =>
                    participant.participantId === trackerFeintProposal.defenderParticipantId,
                )?.label,
                defenderPhase2Modifier: trackerFeintModifier,
                method: trackerFeintProposal.method,
                status:
                  trackerFeintProposal.status === "committed"
                    ? "committed"
                    : trackerFeintProposal.status === "impossible"
                      ? "impossible"
                      : "pending",
              }
            : undefined,
          inspectable: true,
          initiativeCommitted:
            step === "initiative_phase_1" || step === "initiative_phase_2"
              ? timelineRoundState.commands.some(
                  (command) =>
                    command.type === "commit_phase_initiative_resolution" &&
                    command.roundNumber === timelineRoundState.roundNumber &&
                    command.phase === (step === "initiative_phase_1" ? "phase1" : "phase2"),
                )
              : undefined,
          initiativeTotal: getCombatRoundInitiativeTotal(initiative),
          participantId: timelineParticipant.participantId,
          participantLabel: timelineParticipant.label,
          phaseResolutionResult: trackerPhaseResolutionResult,
          progression:
            timelineRoundState.roundNumber === roundState.roundNumber
              ? combatProgressionTrackerIndex.byCellKey[
                  buildCombatTrackerCellKey({
                    participantId: timelineParticipant.participantId,
                    roundNumber: timelineRoundState.roundNumber,
                    step,
                  })
                ]
              : undefined,
          roundNumber: timelineRoundState.roundNumber,
          selected:
            timelineRoundState.roundNumber === selectedRoundNumber &&
            inspectionSelection.participantId === timelineParticipant.participantId &&
            inspectionSelection.step === step,
          status: stepStatus,
          step,
          stepOutcome: deriveCombatHistoryStepOutcome(trackerSnapshot),
        });
      }
    }
  }

  const trackerModel = buildCombatTrackerModel({
    cellFacts: trackerCellFacts,
    rounds: timelineRoundStates.map((timelineRoundState) => ({
      currentStep:
        timelineRoundState.roundNumber === roundState.roundNumber
          ? roundState.currentStep
          : undefined,
      roundNumber: timelineRoundState.roundNumber,
    })),
    rows: displayParticipants.map((participant) => ({
      label: participant.label,
      participantId: participant.participantId,
      selected: inspectionSelection.participantId === participant.participantId,
    })),
    steps: COMBAT_ROUND_STEPS,
  });

  return (
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
              Current task
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

      <section
        aria-label="Latest combat event"
        style={{
          background: "#fbfaf7",
          border: "1px solid #e3e1dc",
          borderRadius: 8,
          display: "grid",
          gap: "0.25rem",
          padding: "0.65rem 0.75rem",
        }}
      >
        <strong>Latest combat event</strong>
        {latestCombatEventSummary ? (
          <>
            <div>{latestCombatEventSummary.summaryText}</div>
            {latestCombatEventSummary.details ? (
              <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
                {latestCombatEventSummary.details}
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>No resolved combat event yet.</div>
        )}
      </section>

      <CombatTracker
        model={trackerModel}
        onInspect={(cell) => selectInspector(cell.participantId, cell.step, cell.roundNumber)}
        onKeyDown={handleTimelineKeyDown}
        registerCell={(cellKey, node, currentTask) => {
          timelineCellRefs.current[cellKey] = node;
          if (currentTask) {
            activeCurrentCellRef.current = node;
          }
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
                        updateInspectorDraft({ secondaryActionId })
                      }
                      roundNumber={selectedRoundNumber}
                      secondaryActionId={inspectorDisplayDraft.secondaryActionId}
                      sourceLabel={inspectorSourceLabel}
                    />
                  )}
                  {inspectorPhaseCards.map((phaseCard, index) => {
                    const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2";
                    const historicalPhasePanel = inspectorPanelSnapshot?.phasePanels?.[phaseKey];
                    const phaseCombatContext = inspectorIsHistorical
                      ? (historicalPhasePanel?.phaseContext ??
                        createUnrecordedHistoricalPhaseContext())
                      : (inspectorNormalizedFeintPhaseContexts[phaseKey] ??
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
                            ...getCombatDistanceParticipantAliases(phaseTargetEncounterParticipant),
                            ...getCombatDistanceParticipantAliases(phaseTargetScenarioParticipant),
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
                    const phaseDefenseStats = !inspectorIsHistorical
                      ? buildPlayerCombatDefenseStats({
                          mainHandParryItemLabel: phaseLoadoutSummary.mainHandParryItemLabel,
                          offHandParryItemLabel: phaseLoadoutSummary.offHandParryItemLabel,
                          phaseContext: phaseCombatContext,
                          reference: phaseLoadoutSummary.reference,
                        })
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
                            attackResultId: inspectorDisplayPhaseResolutionResult.attackResultId,
                            parryBase: inspectorParryBase,
                            parryModifierCalculation: inspectorParryModifierCalculation,
                            parryResolution: inspectorDisplayPhaseResolutionResult.parryResolution,
                            parrySourceLabel: formatSelectedCombatParrySourceName({
                              selection: inspectorParrySelection,
                              sources: inspectorParryDefenderPhaseSummary?.parrySources,
                            }),
                          }
                        : undefined;
                    const phaseProjection = buildCombatRoundPhasePanelProjection({
                      actionId: inspectorDisplayDraft.actionId,
                      attackStats: inspectorIsHistorical ? null : phaseLoadoutSummary.attackStats,
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
                              targetOptions={inspectorTargetOptions}
                            />
                            <label style={compactFieldLabelStyle}>
                              <strong>Requested distance</strong>
                              <select
                                disabled={saving || inspectorIsHistorical}
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
                              targetOptions={inspectorTargetOptions}
                            />
                            <label style={compactFieldLabelStyle}>
                              <strong>Feint method</strong>
                              <select
                                disabled={saving || inspectorIsHistorical}
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
                            </label>
                            <div>
                              <strong>Skill:</strong>{" "}
                              {inspectorResolvedFeintSkill?.label ?? "Unavailable"}
                            </div>
                            <div>Characteristic: Dexterity</div>
                            <div>Defender: highest close-combat skill · Intelligence</div>
                            {inspectorDisplayDraft.feintMethod === "weapon" &&
                            phaseModel.attackStats ? (
                              <>
                                <PlayerCombatAttackStatsTable stats={phaseModel.attackStats} />
                                <PlayerCombatAttackModeSelector
                                  controlsDisabled={saving || inspectorIsHistorical}
                                  onChange={(attackModeId) =>
                                    updateInspectorDraft({
                                      phaseContexts: {
                                        ...inspectorDraft.phaseContexts,
                                        phase1: {
                                          ...inspectorDraft.phaseContexts.phase1,
                                          attackModeId,
                                        },
                                      },
                                    })
                                  }
                                  options={phaseLoadoutSummary.attackModeOptions}
                                  selectedAttackModeId={phaseLoadoutSummary.selectedAttackModeId}
                                />
                              </>
                            ) : null}
                          </div>
                        ) : phaseModel.showAttackStats && phaseModel.attackStats ? (
                          <PlayerCombatAttackStatsTable stats={phaseModel.attackStats} />
                        ) : null}
                        {(!inspectorIsHistorical || historicalPhasePanel) &&
                        phaseModel.showAttackLocationSelector &&
                        !(
                          inspectorDisplayDraft.actionId === "feint_attack" && phaseKey === "phase1"
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
                                            targetParticipantId: combatContext.targetParticipantId,
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
                                (inspectorDisplayDraft.actionId === "feint_attack" ||
                                  inspectorDisplayDraft.actionId === "adjust_range_attack") &&
                                phaseKey === "phase2"
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
                            />
                            <PlayerCombatAttackModeSelector
                              controlsDisabled={saving || inspectorIsHistorical}
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
                                  : phaseLoadoutSummary.selectedAttackModeId
                              }
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
                      <strong>Combat modifiers · History</strong>
                      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                        No information available for this panel.
                      </div>
                    </section>
                  ) : (
                    <PlayerCombatModifierPanel
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
                      readOnly={inspectorIsHistorical}
                      rows={inspectorDisplayModifierRows}
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
                          <div>Base initiative {inspectorInitiativeCalculation.baseInitiative}</div>
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
                              Rolled initiative {inspectorDisplayInitiative.total}.
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
                        <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                          Review generated and manual modifiers before advancing.
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
                    {inspectorResolutionStepKind === "parry" &&
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
                        sources={inspectorParryDefenderPhaseSummary?.parrySources}
                      />
                    ) : null}
                    {inspectorDamageProposalReady &&
                    inspectorDisplayPhaseResolutionResult?.damageResult ? (
                      <CombatDamageReviewPanel
                        attackerLabel={inspectorDamageAttackerLabel}
                        commitReadiness={inspectorDamageReviewCommitReadiness}
                        controlsDisabled={
                          saving || inspectorIsInspectionOnly || Boolean(inspectorSnapshot)
                        }
                        damageResult={inspectorDisplayPhaseResolutionResult.damageResult}
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
                    {inspector.step === "round_summary" ? (
                      <>
                        {inspectorRoundEndDistanceControlComplete ? (
                          <CombatRoundEndParticipantReviewPanel
                            controlsDisabled={saving || inspectorIsInspectionOnly}
                            difficultyDrafts={roundEndHealthDifficultyDrafts}
                            onDifficultyDraftChange={(healthRollId, value) =>
                              setRoundEndHealthDifficultyDrafts((current) => ({
                                ...current,
                                [healthRollId]: value,
                              }))
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
                    <PlayerCombatActionButtonPanel
                      buttonLabel={inspectorEffectiveActionButtonLabel}
                      disabled={inspectorEffectiveActionButtonDisabled}
                      onDeclareAction={(descriptor?: CurrentActionCommandDescriptor) => {
                        if (
                          !descriptor ||
                          descriptor.taskId !== currentActionPresentation?.taskId ||
                          descriptor.expectedRevision !==
                            currentActionPresentation.encounterRevision
                        ) {
                          setSaveError(
                            "Combat state changed. Review the current action before continuing.",
                          );
                          return;
                        }
                        void (projectedBoundaryTransitionAction
                          ? commitCurrentStep()
                          : inspectorAdjustDistanceProposal
                            ? advanceInspectorAdjustDistance()
                            : inspectorFeintProposal?.status === "awaiting_rolls"
                              ? rollInspectorFeint()
                              : inspectorFeintProposal?.status === "awaiting_review"
                                ? commitInspectorFeint()
                                : inspectorDoubleAttackDecisionAvailable
                                  ? decideInspectorDoubleAttackPhase2()
                                  : inspectorPhaseAttackChoiceIsBackOut
                                    ? backOutInspectorPhaseAttack()
                                    : inspectorSkipActionSelected
                                      ? skipInspectorCurrentPhaseAction()
                                      : inspectorCombatExperienceDifficultyCommandPending
                                        ? saveCombatExperienceDifficultyDraft()
                                        : inspectorCombatExperienceRequired
                                          ? rollInspectorCombatExperience()
                                          : inspectorCanContinuePhaseAttack
                                            ? continueInspectorPhaseAttack()
                                            : inspector.step === "round_summary" &&
                                                inspectorRoundEndDistanceAction?.kind === "roll"
                                              ? rollRoundEndDistanceControlFromPrimaryAction()
                                              : inspector.step === "round_summary" &&
                                                  inspectorRoundEndDistanceAction?.kind === "commit"
                                                ? commitRoundEndDistanceControl(
                                                    inspectorRoundEndDistanceAction.proposal.id,
                                                  )
                                                : inspector.step === "round_summary"
                                                  ? advanceInspectorRoundEndReview()
                                                  : inspectorPhaseInitiativeCommitLabel
                                                    ? commitCurrentStep()
                                                    : inspectorCurrentStepIsInitiative
                                                      ? rollInspectorInitiative()
                                                      : inspectorCanRollParry
                                                        ? rollInspectorParry()
                                                        : inspectorCurrentResolutionPhase &&
                                                            (inspectorActionPhaseHasAttack ===
                                                              false ||
                                                              inspectorActionPhaseResolutionStatus?.substep ===
                                                                "effects")
                                                          ? completeInspectorPhaseResolution(
                                                              inspectorCurrentResolutionPhase,
                                                            )
                                                          : inspectorCurrentResolutionPhase &&
                                                              (inspectorActionPhaseResolutionStatus?.substep ===
                                                                "parry" ||
                                                                inspectorActionPhaseResolutionStatus?.substep ===
                                                                  "damage")
                                                            ? advanceInspectorPhaseResolutionSubstep(
                                                                inspectorCurrentResolutionPhase,
                                                              )
                                                            : inspectorCanRollPhaseAttack &&
                                                                inspectorCurrentAttackPhase
                                                              ? rollInspectorPhaseAttack(
                                                                  inspectorCurrentAttackPhase,
                                                                )
                                                              : saveInspectorDeclaration());
                      }}
                      preActionControls={
                        inspectorSelectionIsCurrentProgression
                          ? inspectorPreActionControls
                          : undefined
                      }
                      presentation={currentActionPresentation}
                      saving={saving}
                      statusText={
                        projectedBoundaryTransitionAction
                          ? `Current boundary complete. ${getBoundaryTransitionButtonLabel(
                              projectedBoundaryTransitionAction.targetBoundary,
                            )}.`
                          : inspectorIsHistorical
                            ? `Historical step: ${
                                inspectorHistoricalStepOutcome?.message ??
                                `${getPlayerCombatStepLabel(inspector.step)}.`
                              }`
                            : `Current step: ${getPlayerCombatStepLabel(
                                inspector.step,
                              )}.${inspectorStatusSuffix}`
                      }
                      validationMessage={inspectorActionValidationMessage}
                    />
                  </div>
                  {inspectorHasCanonicalActionResult ? (
                    <CombatEventResultList events={inspectorCanonicalActionResultEvents} />
                  ) : inspectorActionResult ? (
                    <div style={{ display: "grid", gap: "0.3rem" }}>
                      {inspectorShowsLegacyResultFallback ? (
                        <div style={{ color: "#8a4f21", fontSize: "0.8rem", fontWeight: 700 }}>
                          Some historical result details are unavailable.
                        </div>
                      ) : null}
                      <PlayerCombatActionResultPanel result={inspectorActionResult} />
                    </div>
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
          <div>Select a participant step to inspect combat details.</div>
        )}
      </section>

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
                disabled={saving || !selectedRoundIsActive || dirtyCombatDistanceRows.length === 0}
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
  );
}
