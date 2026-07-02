"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import type {
  CombatRoundDeclaration,
  CombatRoundAttackDirection,
  CombatRoundAttackRollResult,
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
  CombatEffectsState,
  EncounterSession,
  RoundEndParticipantReview,
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  ScenarioParticipant,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";
import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  COMBAT_ROUND_STEP_LABELS,
  COMBAT_ROUND_STEPS,
  COMBAT_EXPERIENCE_DEFAULT_DIFFICULTY,
  advanceCombatRoundPhaseResolutionSubstepForParticipant,
  advanceCombatRoundStep,
  buildCombatRoundPhaseResolutionResult,
  buildCombatRoundInspector,
  canClearCombatRoundStep,
  characterBuildSchema,
  combatRoundParticipantHasPhaseAttack,
  commitCombatRoundEndParticipantReview,
  commitCombatRoundPhaseDamage,
  completeCombatRoundPhaseResolutionForParticipant,
  ensureCombatRoundEndReviewPrepared,
  ensureCombatRoundPhaseResolutionResultsForPhase,
  formatOpenEndedD20RollBreakdown,
  getParticipantCombatExperienceSkillTotalLookup,
  getCombatRoundDamageSubstate,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundDamageReviewStepForPhase,
  getCombatRoundEffectiveCriticalRoll,
  getCombatRoundEffectiveDamageResult,
  getCombatRoundPhaseDamageCommitReadiness,
  getCombatRoundStartNextRoundBlocker,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundParticipantPhaseStepStatus,
  getCombatRoundPhaseResolutionResultForAttack,
  getCombatRoundPhaseResolutionStatus,
  getCombatRoundTimelineRoundStates,
  getCombatRoundInitiativeRanks,
  getCombatRoundInitiativeTotal,
  getCombatRoundModifierPhaseForStep,
  getCombatRoundResolutionPhaseForStep,
  getCombatRoundStepSnapshot,
  getHitLocationFullLabel,
  getFinalCriticalRollIndexStatus,
  getLatestCombatEventSummary,
  HIT_LOCATIONS,
  hasScenarioParticipantCombatDeclarationForEncounterRound,
  initializeCombatRoundState,
  isCombatStartExperienceRollRequired,
  isCombatRoundEndReviewComplete,
  normalizeCombatArmorModifierClass,
  recordCombatRoundCriticalRoll,
  recordCombatRoundDamageResult,
  recordCombatRoundHitLocationRoll,
  reviewCombatRoundDamageResult,
  recordCombatRoundNoAttackPhaseReview,
  recordCombatRoundParryResult,
  rollCombatRoundEndHealthCheck,
  rollOpenEndedD20,
  sortCombatRoundParticipantsByInitiative,
  skipCombatRoundCurrentPhaseAction,
  validateCombatDeclarationTargets,
} from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  buildCombatStateCharacterInputs,
  resolveCombatParry,
  type WorkbookRawModifier,
} from "@glantri/rules-engine";

import { buildEquipmentLoadoutModuleModel } from "@/features/equipment/loadoutModule";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import { updateScenarioParticipantStateOnServer } from "@/lib/api/scenarioClient";
import {
  clearCurrentCombatRoundStepOnServer,
  rollCombatAttackOnServer,
  rollCombatExperienceOnServer,
  rollCombatInitiativeOnServer,
  submitCombatDeclarationOnServer,
  updateEncounterOnServer,
} from "@/lib/api/encounterClient";
import {
  loadCharacterEquipmentState,
  loadServerCharacterById,
  type ServerCharacterRecord,
} from "@/lib/api/localServiceClient";
import {
  buildPlayerCombatModifierRows,
  formatCombatInitiativeFormula,
  getGmCombatStepActionLabel,
  getPlayerCombatStepLabel,
  PlayerCombatActionButtonPanel,
  PlayerCombatActionResultPanel,
  PlayerCombatActionSelectorPanel,
  PlayerCombatAttackLocationSelector,
  PlayerCombatAttackStatsTable,
  PlayerCombatAttackTargetSelector,
  PlayerCombatDefenseStatsTable,
  PlayerCombatModifierPanel,
  PlayerCombatParryContextPanel,
  PlayerCombatPhasePanel,
  playerCombatPanelCardStyle,
  playerCombatPanelRowStyle,
  playerCombatTopPanelRowStyle,
  type PlayerCombatModifierBucketView,
  type PlayerCombatPhaseCardView,
} from "@/features/player-combat/PlayerCombatPanels";
import {
  applyDefaultPlayerCombatPhaseContext,
  buildPlayerCombatDefenseStats,
  buildPlayerCombatLoadoutSummary,
  buildPlayerCombatPhasePanelModel,
  isEquipmentFeatureState,
  type PlayerCombatPhaseKey,
} from "@/features/player-combat/playerCombatPhaseModel";
import {
  buildEncounterDbParryModifierCalculation,
  buildEncounterInitiativeModifierCalculation,
  buildEncounterLiveCombatModifierSummary,
  type EncounterLiveCombatModifierSummary,
} from "@/lib/campaigns/liveCombatModifiers";
import {
  getPlayerEncounterOpponentParticipants,
  isPlayerEncounterActionId,
  mergeCombatContextWithCurrentModifierBuckets,
  type PlayerEncounterActionId,
  type PlayerEncounterMovementId,
} from "@/lib/campaigns/playerEncounter";
import { loadCanonicalContent } from "@/lib/content/loadCanonicalContent";
import {
  applyCombatRoundSelectionTarget,
  getCurrentCombatRoundTaskSelection,
  getNextCombatRoundParticipantSelection,
  isGlobalCombatRoundParticipantStep,
  isSelectedCombatRoundStepExecutable,
  normalizeCombatRoundManagerSelection,
  type CombatRoundSelectionTarget,
} from "./combatRoundSelection";
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

interface CombatRoundManagerPanelProps {
  encounter: EncounterSession;
  onEncounterUpdated?: (encounter: EncounterSession) => void;
  onScenarioParticipantsUpdated?: (participants: ScenarioParticipant[]) => void;
  scenarioParticipants?: ScenarioParticipant[];
}

const panelStyle = {
  background: "#fbfaf7",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "1rem",
  padding: "1rem",
} as const;

const tableWrapStyle = {
  border: "1px solid #e3e1dc",
  borderRadius: 10,
  overflowX: "auto",
} as const;

const stickyParticipantCellStyle = {
  background: "#fbfaf7",
  boxShadow: "1px 0 0 #e3e1dc",
  left: 0,
  minWidth: "13rem",
  position: "sticky",
  zIndex: 2,
} as const;

const stepCellStyle = {
  height: "2.35rem",
  minWidth: "3rem",
  padding: "0.2rem",
  textAlign: "center",
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

const roundBoundaryStartBorder = "2px solid #c9bea4";

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
  phaseContexts: CombatInspectorPhaseContextDrafts;
  secondaryActionId: PlayerEncounterActionId | "";
}

interface CombatInspectorPhaseContextDrafts {
  phase1: ScenarioParticipantCombatContext;
  phase2: ScenarioParticipantCombatContext;
}

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
      ? (scopedCombat?.combatContext ?? declaration.combatContext)
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

function getNextStepLabel(step: CombatRoundStep): string {
  const currentIndex = COMBAT_ROUND_STEPS.indexOf(step);
  const nextStep = COMBAT_ROUND_STEPS[currentIndex + 1] ?? "select_actions";

  return COMBAT_ROUND_STEP_ABBREVIATIONS[nextStep];
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

function getAdvanceButtonLabel(step: CombatRoundStep): string {
  if (step === "round_summary") {
    return "Start next round";
  }

  if (isSequentialResolutionStep(step)) {
    return "Use inspector for phase resolution";
  }

  return `Commit ${COMBAT_ROUND_STEP_ABBREVIATIONS[step]} and advance to ${getNextStepLabel(step)}`;
}

function formatCombatExperienceStatus(result?: CombatRoundCombatExperienceResult): string {
  if (!result) {
    return "Not rolled";
  }

  if (result.noRollRequired) {
    return "Active, no roll required";
  }

  if (!result.needsEffectRow || result.modifierValue === 0) {
    return "Active, no modifier";
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
  if (result.noRollRequired) {
    return "Result: Active - no roll required";
  }

  if (!result.needsEffectRow || result.modifierValue === 0) {
    return "Result: Active, no modifier";
  }

  return `Result: ${result.label}, General ${result.modifierValue} for ${result.durationRounds} round${
    result.durationRounds === 1 ? "" : "s"
  }`;
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
        ? (scopedCombat?.combatContext ?? declaration.combatContext)
        : scopedCombat?.combatContext,
    }),
    movementId: (declaration?.movementId ??
      scopedCombat?.lastDeclaredMovementId ??
      "hold") as PlayerEncounterMovementId,
    phaseContexts: buildInspectorPhaseContexts(participant, declaration, scope),
    secondaryActionId: isPlayerEncounterActionId(declaration?.secondaryActionId)
      ? declaration.secondaryActionId
      : isPlayerEncounterActionId(scopedCombat?.lastDeclaredSecondaryActionId)
        ? scopedCombat.lastDeclaredSecondaryActionId
        : "",
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

function hasCombatRoundDeclarationAction(declaration?: CombatRoundDeclaration): boolean {
  return Boolean(
    declaration?.actionId ||
    declaration?.secondaryActionId ||
    declaration?.movementId ||
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

function formatSignedCombatNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function formatCombatParryModifierBreakdown(input: {
  fallbackAdjustment: number;
  modifiers?: readonly CombatRoundParryModifierBreakdownEntry[];
}): string {
  const modifiers = input.modifiers?.filter((modifier) => modifier.value !== 0) ?? [];

  if (modifiers.length === 0) {
    return `mods ${formatSignedCombatNumber(input.fallbackAdjustment)}`;
  }

  return modifiers
    .map((modifier) => `${modifier.label} ${formatSignedCombatNumber(modifier.value)}`)
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
  } + armor crit mod ${
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

function buildCombatRoundDamageArmorCoverageFromLoadoutModel(
  model: ReturnType<typeof buildEquipmentLoadoutModuleModel> | null,
): CombatRoundDamageArmorCoverage {
  const coverage: CombatRoundDamageArmorCoverage = {};

  for (const location of model?.armorSummary?.locations ?? []) {
    coverage[location.key] = {
      armorClass: normalizeCombatArmorModifierClass(location.type),
      coverageLabel: location.valueWithType !== "—" ? location.valueWithType : undefined,
      label: location.label,
      value: location.value ?? undefined,
    };
  }

  return coverage;
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

function getScenarioParticipantHealthStat(participant?: ScenarioParticipant): number | undefined {
  const buildResult = characterBuildSchema.safeParse(participant?.snapshot.build);

  return buildResult.success ? buildResult.data.profile.rolledStats.health : undefined;
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

function getStatusMarker(input: { current: boolean; status: string | undefined }): string {
  void input.current;

  switch (input.status) {
    case "submitted":
    case "gmEdited":
    case "complete":
    case "ready":
      return "✓";
    case "locked":
    case "skipped":
      return "–";
    case "pending":
    default:
      return "·";
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

function buildCombatParryRawModifiers(input: {
  attackResult?: CombatRoundAttackRollResult;
  liveModifiers?: EncounterLiveCombatModifierSummary;
}): WorkbookRawModifier[] {
  return [
    {
      label: "General/Fatigue",
      value: input.liveModifiers?.generalFatigueRaw ?? 0,
    },
    {
      label: "DB/Parry",
      value: input.liveModifiers?.dbRaw ?? 0,
    },
    ...buildCombatAttackResultParryModifiers(input.attackResult),
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
  commitReadiness?: CombatRoundPhaseDamageCommitReadiness;
  controlsDisabled?: boolean;
  damageResult: CombatRoundDamageResult;
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
      <strong>Damage review</strong>
      <section
        style={{
          background: "#fbfaf6",
          border: "1px solid #e6e0d2",
          borderRadius: "6px",
          display: "grid",
          gap: "0.35rem",
          padding: "0.65rem",
        }}
      >
        <strong style={{ fontSize: "0.9rem" }}>Outcome summary</strong>
        <ul style={{ color: "#2f342b", fontSize: "0.9rem", margin: 0, paddingLeft: "1.1rem" }}>
          {outcomeSummary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section style={{ display: "grid", gap: "0.35rem" }}>
        <strong style={{ fontSize: "0.9rem" }}>
          Proposed character-sheet rows: {proposedRows.length}
        </strong>
        {proposedRows.length === 0 ? (
          <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
            No character-sheet rows proposed.
          </div>
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
      {criticalEffectProposal ? (
        <section
          style={{
            background: "#f7f3ea",
            border: "1px solid #ddd3bf",
            borderRadius: "6px",
            display: "grid",
            gap: "0.45rem",
            padding: "0.7rem",
          }}
        >
          <strong style={{ fontSize: "0.95rem" }}>
            {criticalEffectProposal.criticalIndexStatus === "no_effect"
              ? "No critical effect"
              : (criticalEffectProposal.title ?? "Critical table mapping unavailable")}
          </strong>
          {criticalEffectProposal.bodyText ? (
            <div style={{ lineHeight: 1.45 }}>{criticalEffectProposal.bodyText}</div>
          ) : null}
          {unrepresentedRollReports.length > 0 ? (
            <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
              App-side rolls:{" "}
              {unrepresentedRollReports
                .map((report) => `${report.formula} ${report.rolls.join(" + ")} = ${report.total}`)
                .join("; ")}
            </div>
          ) : null}
          {criticalEffectProposal.warnings.length > 0 ? (
            <div style={{ color: "#8a3b1f", display: "grid", gap: "0.2rem", fontSize: "0.85rem" }}>
              {criticalEffectProposal.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      {criticalEffectStatus ? (
        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>{criticalEffectStatus}</div>
      ) : null}
      <details
        style={{
          borderTop: "1px solid #e6e0d2",
          color: "#5e5a50",
          fontSize: "0.86rem",
          paddingTop: "0.45rem",
        }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Calculation details</summary>
        {criticalMinimumStatus ? (
          <div style={{ color: "#5e5a50", marginTop: "0.5rem" }}>{criticalMinimumStatus}</div>
        ) : null}
        {input.commitReadiness?.warnings.length ? (
          <div style={{ color: "#8a3b1f", display: "grid", gap: "0.2rem", marginTop: "0.5rem" }}>
            {input.commitReadiness.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        ) : null}
        <div
          style={{
            display: "grid",
            gap: "0.5rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))",
            marginTop: "0.5rem",
          }}
        >
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
      </details>
      {input.draft.operationalConsequences.length > 0 ? (
        <section style={{ display: "grid", gap: "0.5rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>
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
      ) : null}
      <section style={{ display: "grid", gap: "0.5rem" }}>
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>Add manual row</strong>
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
      </section>
      <button disabled={disabled} onClick={input.onSaveReview} type="button">
        {input.saving ? "Saving..." : "Save review"}
      </button>
    </section>
  );
}

function CombatRoundEndReviewPanel(input: {
  controlsDisabled?: boolean;
  difficultyDrafts: Record<string, string>;
  onDifficultyDraftChange: (healthRollId: string, value: string) => void;
  participantLabel?: string;
  review?: RoundEndParticipantReview;
}) {
  const review = input.review;

  return (
    <section style={playerCombatPanelCardStyle}>
      <strong>Round-end review</strong>
      {!review ? (
        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
          Preparing round-end review...
        </div>
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
                    Damage due {proposal.amount} · remainder{" "}
                    {proposal.remainingAccumulatedTenths}/10
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
                    <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                      {proposal.notes}
                    </div>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}
          {review.proposedHealthRolls.length > 0 ? (
            <section style={{ display: "grid", gap: "0.4rem" }}>
              <strong style={{ fontSize: "0.9rem" }}>Health rolls</strong>
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
                    {proposal.warnings.map((warning) => (
                      <div key={warning} style={{ color: "#8a3b1f", fontSize: "0.82rem" }}>
                        {warning}
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          ) : null}
          {review.warnings.map((warning) => (
            <div key={warning} style={{ color: "#8a3b1f", fontSize: "0.85rem" }}>
              {warning}
            </div>
          ))}
          {review.proposedEffects.length === 0 &&
          review.proposedRemovals.length === 0 &&
          review.proposedDamage.length === 0 &&
          review.proposedHealthRolls.length === 0 ? (
            <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
              No round-end changes proposed.
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function shouldSortByInitiative(step: CombatRoundStep): "phase1" | "phase2" | undefined {
  if (step === "phase_1_actions" || step === "review_phase_2_actions") {
    return "phase1";
  }

  if (step === "phase_2_actions" || step === "review_phase_2_damage") {
    return "phase2";
  }

  return undefined;
}

export default function CombatRoundManagerPanel({
  encounter,
  onEncounterUpdated,
  onScenarioParticipantsUpdated,
  scenarioParticipants = [],
}: CombatRoundManagerPanelProps) {
  const initialRoundState = useMemo(() => initializeCombatRoundState({ encounter }), [encounter]);
  const [roundState, setRoundState] = useState(initialRoundState);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [scenarioParticipantOverrides, setScenarioParticipantOverrides] = useState<
    Record<string, ScenarioParticipant>
  >({});
  const [inspectorDrafts, setInspectorDrafts] = useState<
    Record<string, CombatInspectorDeclarationDraft>
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
  const [roundEndHealthDifficultyDrafts, setRoundEndHealthDifficultyDrafts] = useState<
    Record<string, string>
  >({});
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
  const timelineCellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const encounterScopeRef = useRef(encounter.id);
  const manualSelectionRef = useRef<CombatRoundSelectionTarget | undefined>(undefined);
  const pendingSelectionRef = useRef<CombatRoundSelectionTarget | undefined>(undefined);
  const roundEndAutoPrepareAttemptRef = useRef<string | undefined>(undefined);
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
  const initiativeSortPhase = shouldSortByInitiative(roundState.currentStep);
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
    if (!initiativeSortPhase) {
      return roundState.participants;
    }

    const hasInitiative = roundState.participants.some(
      (participant) => participant.initiatives[initiativeSortPhase] !== undefined,
    );

    return hasInitiative
      ? sortCombatRoundParticipantsByInitiative({
          phase: initiativeSortPhase,
          state: roundState,
        })
      : roundState.participants;
  }, [initiativeSortPhase, roundState]);
  const timelineRoundNumbers = timelineRoundStates.map((state) => state.roundNumber);
  const currentTaskSelection = getCurrentCombatRoundTaskSelection(roundState);
  const inspector = buildCombatRoundInspector({
    participantId: roundState.selectedParticipantId,
    state: selectedTimelineRoundState,
    step: roundState.selectedStep,
  });
  const inspectorSelectionIsCurrentTask =
    selectedRoundIsActive &&
    isSelectedCombatRoundStepExecutable({
      participantId: inspector.participant?.participantId,
      state: roundState,
      step: inspector.step,
    });
  const clearCurrentStepAvailable =
    canClearCombatRoundStep({
      state: roundState,
      step: inspector.step,
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
  const inspectorCombatExperienceRequired =
    selectedRoundIsActive &&
    inspector.participant?.participantId
      ? isCombatStartExperienceRollRequired({
          participantId: inspector.participant.participantId,
          state: roundState,
        })
      : false;
  const inspectorCombatExperienceResult = inspector.participant?.combatExperience;
  const inspectorCombatExperienceDifficultyKey = inspector.participant
    ? `${roundState.roundNumber}:${inspector.participant.participantId}:combat-experience`
    : undefined;
  const inspectorCombatExperienceDifficulty =
    inspectorCombatExperienceDifficultyKey &&
    combatExperienceDifficultyDrafts[inspectorCombatExperienceDifficultyKey] !== undefined
      ? combatExperienceDifficultyDrafts[inspectorCombatExperienceDifficultyKey]
      : String(COMBAT_EXPERIENCE_DEFAULT_DIFFICULTY);
  const roundEndReviewComplete =
    roundState.currentStep === "round_summary" && isCombatRoundEndReviewComplete(roundState);
  const roundEndStartNextRoundBlocker =
    roundState.currentStep === "round_summary" && !roundEndReviewComplete
      ? getCombatRoundStartNextRoundBlocker(roundState)
      : undefined;
  const inspectorRoundEndReview =
    inspector.step === "round_summary" && inspector.participant?.participantId
      ? selectedTimelineRoundState.roundEndReview?.participantReviews[
          inspector.participant.participantId
        ]
      : undefined;
  const buildRoundEndParticipantInputs = (
    stateForReview: typeof roundState = roundState,
  ): Record<
    string,
    { combatEffects?: CombatEffectsState; healthStat?: number }
  > =>
    Object.fromEntries(
      stateForReview.participants.map((participant) => {
        const encounterParticipant = encounter.participants.find(
          (entry) => entry.id === participant.participantId,
        );
        const scenarioParticipant = encounterParticipant
          ? findScenarioParticipantForEncounterParticipant({
              encounterParticipant,
              scenarioParticipants: effectiveScenarioParticipants,
            })
          : undefined;
        const resolvedCharacterState = scenarioParticipant
          ? resolvedCharacterStateByParticipantId[scenarioParticipant.id]
          : undefined;
        const buildResult = characterBuildSchema.safeParse(
          resolvedCharacterState?.serverRecord.build ?? scenarioParticipant?.snapshot.build,
        );

        return [
          participant.participantId,
          {
            combatEffects: scenarioParticipant?.state.combatEffects,
            healthStat: buildResult.success
              ? buildResult.data.profile.rolledStats.health
              : getScenarioParticipantHealthStat(scenarioParticipant),
          },
        ];
      }),
    );
  function autoPrepareRoundEndReviewState(stateForReview: typeof roundState): typeof roundState {
    if (
      stateForReview.currentStep !== "round_summary" ||
      stateForReview.roundEndReview?.roundNumber === stateForReview.roundNumber
    ) {
      return stateForReview;
    }

    return ensureCombatRoundEndReviewPrepared({
      command: {
        createdAt: new Date().toISOString(),
      },
      participantInputs: buildRoundEndParticipantInputs(stateForReview),
      state: stateForReview,
    });
  }

  useEffect(() => {
    if (
      saving ||
      !selectedRoundIsActive ||
      roundState.currentStep !== "round_summary" ||
      roundState.roundEndReview?.roundNumber === roundState.roundNumber
    ) {
      return;
    }

    const attemptKey = `${encounter.id}:${roundState.roundNumber}`;

    if (roundEndAutoPrepareAttemptRef.current === attemptKey) {
      return;
    }

    roundEndAutoPrepareAttemptRef.current = attemptKey;

    try {
      void persistRoundState(autoPrepareRoundEndReviewState(roundState));
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to prepare round-end review automatically.",
      );
    }
  }, [encounter.id, roundState, saving, selectedRoundIsActive]);
  const selectedRoundDeclaration = hasCombatRoundDeclarationAction(
    inspector.participant?.declaration,
  )
    ? inspector.participant?.declaration
    : undefined;
  const inspectorDraftKey = buildInspectorDraftKey({
    declaration: selectedRoundDeclaration,
    participantId: selectedScenarioParticipant?.id,
  });
  const inspectorDraft =
    inspectorDraftKey && inspectorDrafts[inspectorDraftKey]
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
  const inspectorDisplayDraft = inspectorSnapshot
    ? {
        ...inspectorDraft,
        actionId:
          (inspectorSnapshot.declarationSummary?.actionId as PlayerEncounterActionId | undefined) ??
          inspectorDraft.actionId,
        additionalActionNotes:
          inspectorSnapshot.declarationSummary?.additionalActionNotes ??
          inspectorDraft.additionalActionNotes,
        movementId:
          (inspectorSnapshot.declarationSummary?.movementId as
            | PlayerEncounterMovementId
            | undefined) ?? inspectorDraft.movementId,
        phaseContexts:
          inspectorSnapshot.phase && inspectorSnapshot.phaseContext
            ? {
                ...inspectorDraft.phaseContexts,
                [inspectorSnapshot.phase]: inspectorSnapshot.phaseContext,
              }
            : inspectorDraft.phaseContexts,
        secondaryActionId:
          (inspectorSnapshot.declarationSummary?.secondaryActionId as
            | PlayerEncounterActionId
            | undefined) ?? inspectorDraft.secondaryActionId,
      }
    : inspectorDraft;
  const inspectorModifierPhase = getCombatRoundModifierPhaseForStep(inspector.step);
  const inspectorLiveModifiers = useMemo(
    () =>
      buildEncounterLiveCombatModifierSummary({
        combatContext: inspectorDraft.combatContext,
        combatEffects: selectedScenarioParticipant?.state.combatEffects,
        phaseKey: inspectorModifierPhase,
      }),
    [inspectorDraft.combatContext, inspectorModifierPhase, selectedScenarioParticipant],
  );
  const inspectorModifierRows = useMemo(
    () =>
      buildPlayerCombatModifierRows({
        combatContext: inspectorDraft.combatContext,
        liveModifiers: inspectorLiveModifiers,
        phaseKey: inspectorModifierPhase,
      }),
    [inspectorDraft.combatContext, inspectorLiveModifiers, inspectorModifierPhase],
  );
  const inspectorDisplayModifierRows: readonly PlayerCombatModifierBucketView[] =
    inspectorSnapshot?.modifierSummary?.rows ?? inspectorModifierRows;
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
  const inspectorCanExecuteSelectedStep =
    selectedRoundIsActive &&
    (inspectorSelectionIsCurrentTask ||
      (inspectorCurrentStepIsInitiative && roundState.currentStep === inspector.step));
  const inspectorIsInspectionOnly = !inspectorCanExecuteSelectedStep;
  const inspectorCurrentAttackPhase = inspectorAttackPhase;
  const inspectorCurrentResolutionPhase = inspectorAttackPhase ?? inspectorResolutionPhase;
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
  const inspectorCombatExperienceDifficultyValue = Number.parseInt(
    inspectorCombatExperienceDifficulty,
    10,
  );
  const inspectorCombatExperienceNoRollAvailable =
    inspectorCombatExperienceRequired &&
    Number.isInteger(inspectorCombatExperienceDifficultyValue) &&
    inspectorCombatExperienceSkillTotal >= inspectorCombatExperienceDifficultyValue;
  const inspectorEquipmentState = useMemo(() => {
    const candidate =
      resolvedInspectorCharacterState?.equipmentState ??
      selectedScenarioParticipant?.snapshot.equipmentState;
    return isEquipmentFeatureState(candidate) ? candidate : null;
  }, [
    resolvedInspectorCharacterState?.equipmentState,
    selectedScenarioParticipant?.snapshot.equipmentState,
  ]);
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
        characterId: selectedScenarioParticipant?.characterId ?? "",
        liveCombatModifiers: inspectorLiveModifiers,
        state: inspectorEquipmentState,
        throwingWeaponItemId: null,
      }),
    [
      content,
      inspectorBuild,
      inspectorEquipmentState,
      inspectorLiveModifiers,
      selectedScenarioParticipant?.characterId,
    ],
  );
  const inspectorLoadoutSummary = useMemo(
    () =>
      buildPlayerCombatLoadoutSummary({
        actionId: inspectorDraft.actionId,
        loadoutModel: inspectorLoadoutModel,
        secondaryActionId: inspectorDraft.secondaryActionId,
      }),
    [inspectorDraft.actionId, inspectorDraft.secondaryActionId, inspectorLoadoutModel],
  );
  const inspectorTargetOptions = useMemo(
    () =>
      getPlayerEncounterOpponentParticipants({
        allowedParticipantIds: encounterScenarioParticipantIds,
        isGameMaster: true,
        participants: effectiveScenarioParticipants,
        selectedParticipantId: selectedScenarioParticipant?.id,
      }),
    [
      effectiveScenarioParticipants,
      encounterScenarioParticipantIds,
      selectedScenarioParticipant?.id,
    ],
  );
  const inspectorPhaseLoadoutSummaries = useMemo(() => {
    const buildPhaseSummary = (phaseKey: PlayerCombatPhaseKey) => {
      const phaseLiveModifiers = buildEncounterLiveCombatModifierSummary({
        combatContext: inspectorDraft.combatContext,
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
        characterId: selectedScenarioParticipant?.characterId ?? "",
        liveCombatModifiers: phaseLiveModifiers,
        state: inspectorEquipmentState,
        throwingWeaponItemId: null,
      });

      return buildPlayerCombatLoadoutSummary({
        actionId: inspectorDraft.actionId,
        loadoutModel: phaseLoadoutModel,
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
    inspectorDraft.combatContext,
    inspectorDraft.secondaryActionId,
    inspectorEquipmentState,
    selectedScenarioParticipant?.characterId,
    selectedScenarioParticipant?.state.combatEffects,
  ]);
  const inspectorCurrentInitiativePhase =
    inspector.step === "initiative_phase_1"
      ? "phase1"
      : inspector.step === "initiative_phase_2"
        ? "phase2"
        : undefined;
  const inspectorCurrentInitiative = inspectorCurrentInitiativePhase
    ? inspector.participant?.initiatives[inspectorCurrentInitiativePhase]
    : undefined;
  const inspectorDisplayInitiative =
    inspectorSnapshot?.initiativeResult ?? inspectorCurrentInitiative;
  const inspectorDisplayAttackResult =
    inspectorSnapshot?.attackResult ??
    (inspector.participant && inspectorAttackPhase
      ? getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: inspector.participant.participantId,
          phase: inspectorAttackPhase,
          state: selectedTimelineRoundState,
        })
      : undefined);
  const inspectorResolutionAttackResult =
    inspectorSnapshot?.attackResult ??
    (inspector.participant && inspectorResolutionPhase
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: inspector.participant.participantId,
          phase: inspectorResolutionPhase,
          state: selectedTimelineRoundState,
        })
      : undefined);
  const inspectorDisplayPhaseResolutionResult =
    inspectorSnapshot?.phaseResolutionResult ??
    (inspectorResolutionAttackResult
      ? (getCombatRoundPhaseResolutionResultForAttack({
          attackResult: inspectorResolutionAttackResult,
          state: selectedTimelineRoundState,
        }) ??
        buildCombatRoundPhaseResolutionResult({
          attackResult: inspectorResolutionAttackResult,
          roundNumber: selectedTimelineRoundState.roundNumber,
          updatedAt: inspectorResolutionAttackResult.rolledAt,
        }))
      : undefined);
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
    inspectorCurrentPhaseHasAttack === true &&
    (!inspectorPhaseResolutionStatus ||
      inspectorPhaseResolutionStatus.substep === "pending" ||
      inspectorPhaseResolutionStatus.substep === "attack") &&
    !inspectorDisplayAttackResult;
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
  const inspectorRoundEndActionValidationMessage =
    inspector.step === "round_summary" && selectedRoundIsActive
      ? !selectedTimelineRoundState.roundEndReview
        ? "Round-end review is preparing automatically."
        : inspectorRoundEndReview?.status === "complete"
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
  const inspectorActionValidationMessage =
    inspectorTargetValidationMessage ??
    inspectorAttackSourceValidationMessage ??
    inspectorDamageCommitValidationMessage ??
    inspectorRoundEndActionValidationMessage;
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
  const inspectorActionButtonLabel = inspectorSelectedAttackAlreadyRolled
      ? "Attack already rolled"
      : inspectorIsInspectionOnly
        ? "Inspecting step - use Current task to resume"
      : inspector.step === "select_actions" && inspectorCombatExperienceRequired
        ? inspectorCombatExperienceNoRollAvailable
          ? "Confirm Combat Experience"
          : "Roll Combat Experience"
      : inspector.step === "round_summary" && !selectedTimelineRoundState.roundEndReview
        ? "Preparing round-end review"
        : inspector.step === "round_summary" && inspectorRoundEndReview?.status === "review_ready"
          ? inspectorRoundEndReviewHasProposals
            ? "Commit participant SU review"
            : "Mark SU review complete"
          : inspector.step === "round_summary" &&
              inspectorRoundEndReview?.status === "health_roll_pending"
            ? "Roll health check"
            : inspector.step === "round_summary" && inspectorRoundEndReview?.status === "complete"
              ? "Round-end review complete"
              : inspectorDamageCommitted
                ? "Phase damage committed"
                : inspectorDamageSubstate === "critical_pending"
                  ? "Roll critical"
                  : inspectorDamageSubstate === "location_pending"
                    ? "Roll hit location"
                    : inspectorDamageSubstate === "location_rolled"
                      ? "Prepare damage review"
                      : inspectorDamageProposalReady
                        ? "Commit phase damage"
                        : inspectorCanRollParry
                          ? "Roll parry"
                          : inspectorAttackSourceValidationMessage
                            ? inspectorAttackSourceValidationMessage
                            : inspectorCurrentResolutionPhase &&
                                inspectorActionPhaseHasAttack === false
                              ? `Complete ${formatCombatPhaseLabel(inspectorCurrentResolutionPhase)} for participant`
                              : getCombatResolutionButtonLabel({
                                  hasPhaseAttack: inspectorActionPhaseHasAttack,
                                  phase: inspectorCurrentResolutionPhase,
                                  step: inspector.step,
                                  substep: inspectorActionPhaseResolutionStatus?.substep,
                                });
  const inspectorPhaseResolutionLines =
    inspectorResolutionAttackResult && inspectorDisplayPhaseResolutionResult
      ? formatCombatPhaseResolutionResultLines({
          attackResult: inspectorResolutionAttackResult,
          participantId: inspector.participant?.participantId,
          resolution: inspectorDisplayPhaseResolutionResult,
        })
      : undefined;
  const inspectorActionResult = inspectorPhaseResolutionLines
    ? {
        detailLines: [inspectorPhaseResolutionLines.armorLine].filter((line): line is string =>
          Boolean(line),
        ),
        interpretedResult: inspectorPhaseResolutionLines.statusLine,
        rankLabel: inspectorPhaseResolutionLines.attackLine,
        resultLabel: inspectorPhaseResolutionLines.proposalLine,
        sections: inspectorPhaseResolutionLines.sections,
      }
    : inspectorResolutionPhase
      ? {
          interpretedResult: `No ${formatCombatPhaseLabel(inspectorResolutionPhase)} attack result.`,
        }
      : inspectorDisplayAttackResult
        ? {
            interpretedResult: formatCombatAttackResultLine({
              participantId: inspector.participant?.participantId,
              result: inspectorDisplayAttackResult,
            }),
            resultLabel: `Result: ${inspectorDisplayAttackResult.tableResult}`,
          }
        : inspectorNoPhaseAttack
          ? {
              interpretedResult: `No ${formatCombatPhaseLabel(inspectorAttackPhase ?? "phase1")} attack.`,
            }
          : inspectorDisplayInitiative
            ? {
                interpretedResult: formatCombatInitiativeFormula(inspectorDisplayInitiative),
                rankLabel:
                  formatSnapshotInitiativeRankLabel(inspectorSnapshot?.initiativeRank) ??
                  formatInitiativeRankLabel({
                    participantId: inspector.participant?.participantId,
                    ranks: inspectorCurrentInitiativePhase === "phase2" ? phase2Ranks : phase1Ranks,
                    value: getCombatRoundInitiativeTotal(inspectorDisplayInitiative),
                  }),
              }
            : inspectorCombatExperienceResult
              ? {
                  interpretedResult: formatCombatExperienceCalculation(
                    inspectorCombatExperienceResult,
                  ),
                  rankLabel: "Combat Experience",
                  resultLabel: formatCombatExperienceEffectLine(inspectorCombatExperienceResult),
                }
            : null;
  const inspectorCurrentStepStatus = inspector.participant?.stepStatuses[inspector.step];
  const inspectorParticipantHasDeclared = Boolean(selectedRoundDeclaration);
  const inspectorStatusSuffix = inspectorSnapshot
    ? " Committed."
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
            : inspector.step === "review_action_modifiers" &&
                (inspectorCurrentStepStatus === "complete" ||
                  inspectorCurrentStepStatus === "gmEdited")
              ? " Modifiers declared."
              : inspector.step === "review_phase_2_modifiers" &&
                  (inspectorCurrentStepStatus === "complete" ||
                    inspectorCurrentStepStatus === "gmEdited")
                ? " Phase 2 modifiers declared."
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
    liveModifiers: inspectorLiveModifiers,
  });
  useEffect(() => {
    const encounterChanged = encounterScopeRef.current !== encounter.id;

    if (encounterChanged) {
      encounterScopeRef.current = encounter.id;
      manualSelectionRef.current = undefined;
      pendingSelectionRef.current = undefined;
      setSelectedRoundNumber(initialRoundState.roundNumber);
      setDamageReviewDrafts({});
      setInspectorDrafts({});
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
    const nextRoundStateCandidate = normalizeCombatRoundManagerSelection({
      manualSelection: manualSelection ?? currentTaskSelection,
      pendingSelection,
      state: initialRoundState,
    });
    const nextRoundState =
      currentTaskSelection && !manualSelection && !pendingSelection
        ? applyCombatRoundSelectionTarget({
            selection: currentTaskSelection,
            state: nextRoundStateCandidate,
          })
        : nextRoundStateCandidate;

    if (pendingSelection) {
      pendingSelectionRef.current = undefined;
    }

    setSelectedRoundNumber((currentRoundNumber) =>
      currentTaskSelection
        ? initialRoundState.roundNumber
        : getCombatRoundTimelineRoundStates(nextRoundState).some(
              (round) => round.roundNumber === currentRoundNumber,
            )
          ? currentRoundNumber
          : nextRoundState.roundNumber,
    );

    if (
      manualSelection &&
      (manualSelection.step !== nextRoundState.currentStep ||
        !nextRoundState.participants.some(
          (participant) => participant.participantId === manualSelection.participantId,
        ))
    ) {
      manualSelectionRef.current = undefined;
    }

    setRoundState(nextRoundState);

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
  }, [initialRoundState]);

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
    attackStats: ReturnType<typeof buildPlayerCombatLoadoutSummary>["attackStats"];
    baseDefenseStats: ReturnType<typeof buildPlayerCombatDefenseStats>;
    defenseStats: ReturnType<typeof buildPlayerCombatDefenseStats>;
    strengthGm?: number;
    liveModifiers: ReturnType<typeof buildEncounterLiveCombatModifierSummary>;
    modifierRows: ReturnType<typeof buildPlayerCombatModifierRows>;
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
      liveModifiers,
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
    const equipmentStateCandidate =
      resolvedCharacterState?.equipmentState ?? input.scenarioParticipant?.snapshot.equipmentState;
    const equipmentState = isEquipmentFeatureState(equipmentStateCandidate)
      ? equipmentStateCandidate
      : null;
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
      characterId: input.scenarioParticipant?.characterId ?? "",
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
      characterId: input.scenarioParticipant?.characterId ?? "",
      state: equipmentState,
      throwingWeaponItemId: null,
    });
    const loadoutSummary = buildPlayerCombatLoadoutSummary({
      actionId: draft.actionId,
      loadoutModel,
      phaseKey: input.phaseKey,
      secondaryActionId: draft.secondaryActionId,
    });
    const baseLoadoutSummary = buildPlayerCombatLoadoutSummary({
      actionId: draft.actionId,
      loadoutModel: baseLoadoutModel,
      phaseKey: input.phaseKey,
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
      armorCoverage: buildCombatRoundDamageArmorCoverageFromLoadoutModel(baseLoadoutModel),
      attackStats: loadoutSummary.attackStats,
      baseDefenseStats,
      defenseStats,
      strengthGm: characterCombatInputs?.strengthGm ?? undefined,
      liveModifiers,
      modifierRows,
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
      const phaseSummary = buildScenarioParticipantPhaseSummary({
        declaration,
        phaseKey: phase,
        scenarioParticipant,
      });
      const modifierRows = phaseSummary.modifierRows.map((row) => ({
        bucketKey: row.bucketKey,
        entries: row.entries,
        label: row.label,
        total: row.total,
      }));
      const phaseContext = phaseSummary.phaseContext;
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

      return {
        actionResultSummary:
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
                : undefined,
        attackResult,
        attackSummary:
          phaseModel?.showAttackStats && phaseModel.attackStats
            ? phaseModel.attackStats
            : undefined,
        committedAt,
        declarationSummary: {
          actionId: draft.actionId || undefined,
          additionalActionNotes: draft.additionalActionNotes || undefined,
          movementId: draft.movementId || undefined,
          secondaryActionId: draft.secondaryActionId || undefined,
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
        phaseContext,
        phaseResolutionStatus,
        phaseResolutionResult,
        roundNumber: stateForSnapshots.roundNumber,
        step,
      };
    });
  }

  async function commitCurrentStep() {
    if (isSequentialResolutionStep(roundState.currentStep)) {
      return;
    }

    const committedAt = new Date().toISOString();
    const resolutionPhase = getCombatRoundResolutionPhaseForStep(roundState.currentStep);
    const stateForCommit = resolutionPhase
      ? ensureCombatRoundPhaseResolutionResultsForPhase({
          phase: resolutionPhase,
          state: roundState,
          updatedAt: committedAt,
        })
      : roundState;
    const stepSnapshots = buildCombatRoundStepSnapshots(committedAt, stateForCommit);
    const commandParticipantId =
      inspector.participant?.participantId ??
      stateForCommit.currentCursor?.participantId ??
      stateForCommit.selectedParticipantId;
    const advanceInput = commandParticipantId
      ? {
          command: {
            createdAt: committedAt,
            participantId: commandParticipantId,
          },
          stepSnapshots,
        }
      : { stepSnapshots };

    try {
      await persistRoundState(advanceCombatRoundStep(stateForCommit, advanceInput));
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to advance combat round.",
      );
    }
  }

  async function persistRoundState(nextRoundState: typeof roundState) {
    let stateToPersist: typeof roundState;

    try {
      stateToPersist = autoPrepareRoundEndReviewState(nextRoundState);
    } catch (caughtError) {
      throw new Error(
        caughtError instanceof Error
          ? `Unable to prepare round-end review automatically: ${caughtError.message}`
          : "Unable to prepare round-end review automatically.",
      );
    }

    setRoundState(stateToPersist);
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
      const clearedSelection: CombatRoundSelectionTarget = {
        participantId: inspector.participant?.participantId,
        step: inspector.step,
      };
      const { encounter: nextEncounter, participants } = await clearCurrentCombatRoundStepOnServer({
        encounterId: encounter.id,
        participantId: clearedSelection.participantId,
        step: clearedSelection.step,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      const nextSelection: CombatRoundSelectionTarget = {
        participantId: nextRoundState.selectedParticipantId ?? clearedSelection.participantId,
        step: nextRoundState.selectedStep ?? clearedSelection.step,
      };

      pendingSelectionRef.current = nextSelection;
      manualSelectionRef.current = nextSelection;
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
    setRoundState((current) => {
      const selection = getCurrentCombatRoundTaskSelection(current);

      return selection
        ? applyCombatRoundSelectionTarget({
            selection,
            state: current,
          })
        : current;
    });
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
    setRoundState((current) =>
      applyCombatRoundSelectionTarget({
        selection: {
          participantId: selection.participantId,
          step: selection.step,
        },
        state: current,
      }),
    );
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
    const currentStep = roundState.selectedStep ?? roundState.currentStep;
    const participantIds = getParticipantIdsForTimelineRound({
      fallbackParticipantIds: displayParticipants.map((participant) => participant.participantId),
      roundNumber: selectedRoundNumber,
      timelineRoundStates,
    });
    const nextSelection =
      input.stepOffset !== undefined
        ? getAdjacentCombatRoundTimelineStepSelection({
            participantId: roundState.selectedParticipantId,
            roundNumbers: timelineRoundNumbers,
            selectedRoundNumber,
            step: currentStep,
            stepOffset: input.stepOffset,
          })
        : getAdjacentCombatRoundTimelineParticipantSelection({
            participantId: roundState.selectedParticipantId,
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

    const targetValidation = validateCombatDeclarationTargets({
      actionId: inspectorDraft.actionId || undefined,
      phaseContexts: inspectorDraft.phaseContexts,
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
        additionalActionNotes: inspectorDraft.additionalActionNotes,
        combatContext: inspectorDraft.combatContext,
        encounterId: encounter.id,
        movementId: inspectorDraft.movementId || undefined,
        phaseContexts: inspectorDraft.phaseContexts,
        scenarioParticipantId: selectedScenarioParticipant.id,
        secondaryActionId: inspectorDraft.secondaryActionId || undefined,
      });
      const nextRoundState = initializeCombatRoundState({ encounter: nextEncounter });
      const nextSelection = shouldUsePersistedCursor
        ? undefined
        : getNextCombatRoundParticipantSelection({
            fromParticipantId: actedParticipantId,
            participantIds: displayedParticipantIds,
            step: roundState.selectedStep ?? actedStep,
          });
      const nextSelectedRoundState = shouldUsePersistedCursor
        ? normalizeCombatRoundManagerSelection({
            state: nextRoundState,
          })
        : applyCombatRoundSelectionTarget({
            selection: nextSelection ?? {
              participantId: actedParticipantId,
              step: roundState.selectedStep ?? actedStep,
            },
            state: nextRoundState,
          });

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

      setRoundState(nextSelectedRoundState);
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

  async function rollInspectorCombatExperience() {
    if (!selectedScenarioParticipant || !selectedEncounterParticipant) {
      return;
    }

    const difficulty = Number.parseInt(inspectorCombatExperienceDifficulty, 10);

    if (!Number.isInteger(difficulty) || difficulty <= 0) {
      setSaveError("Combat Experience difficulty must be a positive integer.");
      return;
    }

    setSaving(true);

    try {
      const { encounter: nextEncounter, participant } = await rollCombatExperienceOnServer({
        difficulty,
        encounterId: encounter.id,
        scenarioParticipantId: selectedScenarioParticipant.id,
      });
      const nextRoundState = normalizeCombatRoundManagerSelection({
        state: initializeCombatRoundState({ encounter: nextEncounter }),
      });

      setScenarioParticipantOverrides((current) => ({
        ...current,
        [participant.id]: participant,
      }));
      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
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
            step: roundState.selectedStep ?? actedStep,
          });
      const nextSelectedRoundState = shouldUsePersistedCursor
        ? normalizeCombatRoundManagerSelection({
            state: nextRoundState,
          })
        : applyCombatRoundSelectionTarget({
            selection: nextSelection ?? {
              participantId: actedParticipantId,
              step: roundState.selectedStep ?? actedStep,
            },
            state: nextRoundState,
          });

      if (nextSelection) {
        pendingSelectionRef.current = nextSelection;
        manualSelectionRef.current = nextSelection;
      } else {
        pendingSelectionRef.current = undefined;
        manualSelectionRef.current = undefined;
      }

      setRoundState(nextSelectedRoundState);
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

    const targetScenarioParticipant = effectiveScenarioParticipants.find(
      (participant) => participant.id === phaseContext.targetParticipantId,
    );
    const targetEncounterParticipant = findEncounterParticipantForScenarioParticipant({
      encounterParticipants: encounter.participants,
      scenarioParticipant: targetScenarioParticipant,
      scenarioParticipantId: phaseContext.targetParticipantId,
    });
    const targetRoundParticipant = roundState.participants.find(
      (participant) => participant.participantId === targetEncounterParticipant?.id,
    );

    if (!targetScenarioParticipant || !targetEncounterParticipant) {
      setSaveError(`Select a target for ${phaseLabel} attack.`);
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

    let ob: number;
    let defenderDb: number;

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
      const { encounter: nextEncounter } = await rollCombatAttackOnServer({
        actionId: inspectorDraft.actionId || `${phase}_attack`,
        defenderDb,
        defenderScenarioParticipantId: targetScenarioParticipant.id,
        encounterId: encounter.id,
        ob,
        phase,
        scenarioParticipantId: selectedScenarioParticipant.id,
        weaponCriticalCode: phaseModel.attackStats.weaponCriticalCode,
        weaponDamageClass: phaseModel.attackStats.weaponDamageClass,
        weaponName: phaseModel.attackStats.weaponName,
      });
      const nextRoundState = normalizeCombatRoundManagerSelection({
        state: initializeCombatRoundState({ encounter: nextEncounter }),
      });

      pendingSelectionRef.current = undefined;
      manualSelectionRef.current = undefined;
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

    const sources = inspectorParryDefenderPhaseSummary?.parrySources;
    const rawModifiers = buildCombatParryRawModifiers({
      attackResult,
      liveModifiers: inspectorParryDefenderPhaseSummary?.liveModifiers,
    });
    const roll = rollOpenEndedD20();
    const parry = resolveCombatParry({
      parryBase: inspectorParryBase,
      rawModifiers,
      rollTotal: roll.dieResult,
    });
    const usedMainHand = inspectorParrySelection.usedMainHand && Boolean(sources?.mainHand);
    const usedOffHand = inspectorParrySelection.usedOffHand && Boolean(sources?.offHand);
    const parrySourceLabel = formatSelectedCombatParrySourceName({
      selection: {
        usedMainHand,
        usedOffHand,
      },
      sources,
    });
    const updatedAt = new Date().toISOString();
    const parryResolution: CombatRoundParryResolution = {
      combinedParryScore: parry.parryBase,
      mainHandParryScore: usedMainHand ? sources?.mainHand?.score : undefined,
      modifiedParryBeforeRoll: parry.parryBase + parry.modifierAdjustment,
      modifierAdjustment: parry.modifierAdjustment,
      modifierBreakdown: parry.rawModifiers.map((modifier) => ({ ...modifier })),
      notes:
        "Direction, location coverage, and multi-opponent source allocation are deferred in this first parry slice.",
      offHandParryScore: usedOffHand ? sources?.offHand?.score : undefined,
      openEndedD10s: roll.openEndedD10s,
      parrySourceLabel,
      rawModifierTotal: parry.rawModifierTotal,
      resultLabel: parry.success ? "Parry successful" : "Parry failed",
      rollD20: roll.rollD20,
      rollTotal: roll.dieResult,
      status: "resolved",
      success: parry.success,
      targetNumber: parry.targetNumber,
      total: parry.total,
      usedMainHand,
      usedOffHand,
    };

    setSaving(true);

    try {
      const nextRoundState = recordCombatRoundParryResult({
        attackResult,
        command: {
          createdAt: updatedAt,
        },
        parryResolution,
        state: roundState,
        submittedBy: "gm",
        updatedAt,
      });

      await persistRoundState(nextRoundState);
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
      const updatedAt = new Date().toISOString();
      const ownerHasPhaseAttack = combatRoundParticipantHasPhaseAttack({
        participantId: ownerParticipantId,
        phase,
        state: roundState,
      });
      const nextRoundState = ownerHasPhaseAttack
        ? completeCombatRoundPhaseResolutionForParticipant({
            participantId: ownerParticipantId,
            phase,
            state: roundState,
            submittedBy: "gm",
            updatedAt,
          })
        : recordCombatRoundNoAttackPhaseReview({
            command: {
              createdAt: updatedAt,
            },
            participantId: ownerParticipantId,
            phase,
            state: roundState,
            submittedBy: "gm",
            updatedAt,
          });

      await persistRoundState(nextRoundState);
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
    if (!inspector.participant?.participantId || !inspectorCurrentAttackPhase) {
      return;
    }

    setSaving(true);

    try {
      const updatedAt = new Date().toISOString();
      const nextRoundState = skipCombatRoundCurrentPhaseAction({
        command: {
          createdAt: updatedAt,
        },
        participantId: inspector.participant.participantId,
        phase: inspectorCurrentAttackPhase,
        reason: "GM skipped action",
        state: roundState,
        submittedBy: "gm",
        updatedAt,
      });

      await persistRoundState(nextRoundState);
      setSaveError(undefined);
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to skip current action.",
      );
    } finally {
      setSaving(false);
    }
  }

  function buildRoundStateWithInspectorDamageReview(input: {
    reviewedAt: string;
    state: typeof roundState;
  }): typeof roundState {
    const damageResult = inspectorDisplayPhaseResolutionResult?.damageResult;

    if (!damageResult) {
      throw new Error("No damage proposal is available for review.");
    }

    return reviewCombatRoundDamageResult({
      attackResultId: damageResult.attackResultId,
      review: buildCombatDamageReviewFromDraft({
        criticalRoll: inspectorDisplayPhaseResolutionResult?.criticalRoll,
        damageResult,
        draft: inspectorDamageReviewDraft,
      }),
      reviewedAt: input.reviewedAt,
      state: input.state,
    });
  }

  async function saveInspectorDamageReview() {
    if (!inspectorDamageReviewKey) {
      return;
    }

    try {
      const reviewedAt = new Date().toISOString();
      const reviewedState = buildRoundStateWithInspectorDamageReview({
        reviewedAt,
        state: roundState,
      });

      await persistRoundState(reviewedState);
      setDamageReviewDrafts((current) => {
        const rest = { ...current };
        delete rest[inspectorDamageReviewKey];

        return rest;
      });
    } catch (caughtError) {
      setSaveError(
        caughtError instanceof Error ? caughtError.message : "Unable to save damage review.",
      );
    }
  }

  async function advanceInspectorRoundEndReview() {
    if (!selectedRoundIsActive || inspector.step !== "round_summary") {
      return;
    }

    setSaving(true);

    try {
      const updatedAt = new Date().toISOString();

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

      if (participantReview.status === "review_ready") {
        if (!encounter.scenarioId || !selectedScenarioParticipant) {
          setSaveError("Scenario participant state is required to commit SU review.");
          return;
        }

        const committed = commitCombatRoundEndParticipantReview({
          command: {
            createdAt: updatedAt,
          },
          combatEffects: selectedScenarioParticipant.state.combatEffects,
          encounterId: encounter.id,
          participantId: inspector.participant.participantId,
          scenarioId: encounter.scenarioId,
          scenarioParticipantId: selectedScenarioParticipant.id,
          state: roundState,
        });
        const updatedParticipant = await updateScenarioParticipantStateOnServer({
          participantId: selectedScenarioParticipant.id,
          scenarioId: encounter.scenarioId,
          state: {
            ...selectedScenarioParticipant.state,
            combatEffects: committed.combatEffects,
          },
        });

        setScenarioParticipantOverrides((current) => ({
          ...current,
          [updatedParticipant.id]: updatedParticipant,
        }));
        onScenarioParticipantsUpdated?.([updatedParticipant]);
        await persistRoundState(committed.state);
        setSaveError(undefined);
        return;
      }

      if (participantReview.status === "health_roll_pending") {
        if (!encounter.scenarioId || !selectedScenarioParticipant) {
          setSaveError("Scenario participant state is required to roll SU health.");
          return;
        }

        const pendingHealthRoll = participantReview.proposedHealthRolls.find(
          (proposal) => proposal.accepted && proposal.status === "pending",
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

        const rolled = rollCombatRoundEndHealthCheck({
          command: {
            createdAt: updatedAt,
          },
          combatEffects: selectedScenarioParticipant.state.combatEffects,
          difficulty,
          healthRollId: pendingHealthRoll.id,
          participantId: inspector.participant.participantId,
          state: roundState,
        });
        const updatedParticipant = await updateScenarioParticipantStateOnServer({
          participantId: selectedScenarioParticipant.id,
          scenarioId: encounter.scenarioId,
          state: {
            ...selectedScenarioParticipant.state,
            combatEffects: rolled.combatEffects,
          },
        });

        setScenarioParticipantOverrides((current) => ({
          ...current,
          [updatedParticipant.id]: updatedParticipant,
        }));
        onScenarioParticipantsUpdated?.([updatedParticipant]);
        await persistRoundState(rolled.state);
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

          const defenderEncounterParticipant = encounter.participants.find(
            (participant) => participant.id === damageReviewAttackResult.defenderParticipantId,
          );
          const defenderScenarioParticipant = defenderEncounterParticipant
            ? findScenarioParticipantForEncounterParticipant({
                encounterParticipant: defenderEncounterParticipant,
                scenarioParticipants: effectiveScenarioParticipants,
              })
            : undefined;
          const attackerEncounterParticipant = encounter.participants.find(
            (participant) => participant.id === damageReviewAttackResult.attackerParticipantId,
          );
          const attackerScenarioParticipant = attackerEncounterParticipant
            ? findScenarioParticipantForEncounterParticipant({
                encounterParticipant: attackerEncounterParticipant,
                scenarioParticipants: effectiveScenarioParticipants,
              })
            : undefined;

          if (!defenderScenarioParticipant) {
            setSaveError("Defender scenario participant state is required to commit damage.");
            return;
          }

          const reviewedRoundState = buildRoundStateWithInspectorDamageReview({
            reviewedAt: updatedAt,
            state: roundState,
          });
          const committed = commitCombatRoundPhaseDamage({
            attackResultId: existingDamageResolution.damageResult.attackResultId,
            attackerScenarioParticipantId: attackerScenarioParticipant?.id,
            command: {
              createdAt: updatedAt,
            },
            combatEffects: defenderScenarioParticipant.state.combatEffects,
            defenderScenarioParticipantId: defenderScenarioParticipant.id,
            encounterId: encounter.id,
            scenarioId: encounter.scenarioId,
            state: reviewedRoundState,
          });
          const updatedParticipant = await updateScenarioParticipantStateOnServer({
            participantId: defenderScenarioParticipant.id,
            scenarioId: encounter.scenarioId,
            state: {
              ...defenderScenarioParticipant.state,
              combatEffects: committed.combatEffects,
            },
          });

          setScenarioParticipantOverrides((current) => ({
            ...current,
            [updatedParticipant.id]: updatedParticipant,
          }));
          if (inspectorDamageReviewKey) {
            setDamageReviewDrafts((current) => {
              const rest = { ...current };
              delete rest[inspectorDamageReviewKey];

              return rest;
            });
          }
          onScenarioParticipantsUpdated?.([updatedParticipant]);
          await persistRoundState(committed.state);
          setSaveError(undefined);
          return;
        } else {
          setSaveError("Hit location roll required.");
          return;
        }
      } else {
        nextRoundState = advanceCombatRoundPhaseResolutionSubstepForParticipant({
          participantId: ownerParticipantId,
          phase,
          state: roundState,
          updatedAt,
        });
      }

      const nextOwnerStatus = getCombatRoundPhaseResolutionStatus({
        participantId: ownerParticipantId,
        phase,
        state: nextRoundState,
      });
      const defenderParticipantId =
        inspectorResolutionAttackResult?.defenderParticipantId ?? ownerParticipantId;
      const defenderOwnedNextRoundState =
        nextOwnerStatus.substep === "damage" || nextOwnerStatus.substep === "effects"
          ? {
              ...nextRoundState,
              phaseResolutionCursor: {
                participantId: defenderParticipantId,
                phase,
                substep: nextOwnerStatus.substep,
              },
              selectedParticipantId: defenderParticipantId,
              selectedStep: getCombatRoundDamageReviewStepForPhase(phase),
            }
          : nextRoundState;

      await persistRoundState(defenderOwnedNextRoundState);
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
          <button
            disabled={
              saving ||
              !selectedRoundIsActive ||
              inspectorSelectedStepIsSequential ||
              Boolean(roundEndStartNextRoundBlocker)
            }
            onClick={() => void commitCurrentStep()}
            type="button"
            title={roundEndStartNextRoundBlocker}
          >
            {saving ? "Saving..." : getAdvanceButtonLabel(inspector.step)}
          </button>
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

      <div
        aria-label="Combat round timeline grid"
        onKeyDown={handleTimelineKeyDown}
        ref={tableContainerRef}
        style={tableWrapStyle}
        tabIndex={0}
      >
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: 620,
            width: "max-content",
          }}
        >
          <thead>
            <tr>
              <th
                rowSpan={2}
                style={{
                  ...stickyParticipantCellStyle,
                  padding: "0.45rem",
                  textAlign: "left",
                  top: 0,
                }}
              >
                Participant
              </th>
              {timelineRoundNumbers.map((roundNumber, roundIndex) => (
                <th
                  className={roundIndex > 0 ? "round-boundary-start" : undefined}
                  colSpan={COMBAT_ROUND_STEPS.length}
                  key={roundNumber}
                  style={{
                    background: "#efe7d3",
                    borderBottom: "1px solid #d1c7aa",
                    borderLeft: roundIndex > 0 ? roundBoundaryStartBorder : "1px solid #e3e1dc",
                    padding: "0.35rem",
                    textAlign: "center",
                  }}
                >
                  Round {roundNumber}
                </th>
              ))}
            </tr>
            <tr>
              {timelineRoundNumbers.flatMap((roundNumber, roundIndex) =>
                COMBAT_ROUND_STEPS.map((step, stepIndex) => (
                  <th
                    className={
                      roundIndex > 0 && stepIndex === 0 ? "round-boundary-start" : undefined
                    }
                    key={`${roundNumber}-${step}`}
                    style={{
                      ...stepCellStyle,
                      background:
                        roundNumber === roundState.roundNumber && step === roundState.currentStep
                          ? "#f6f0dd"
                          : "#fbfaf7",
                      borderBottom: "1px solid #e3e1dc",
                      borderLeft:
                        roundIndex > 0 && stepIndex === 0
                          ? roundBoundaryStartBorder
                          : "1px solid #e3e1dc",
                      fontWeight:
                        roundNumber === roundState.roundNumber && step === roundState.currentStep
                          ? 800
                          : 700,
                    }}
                    title={COMBAT_ROUND_STEP_LABELS[step]}
                  >
                    {COMBAT_ROUND_STEP_ABBREVIATIONS[step]}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {displayParticipants.map((participant) => {
              const selectedRow = roundState.selectedParticipantId === participant.participantId;

              return (
                <tr
                  key={participant.participantId}
                  style={{ background: selectedRow ? "#fff8e8" : undefined }}
                >
                  <td
                    style={{
                      ...stickyParticipantCellStyle,
                      borderTop: "1px solid #e3e1dc",
                      padding: "0.45rem",
                    }}
                  >
                    <div style={{ display: "grid", gap: "0.25rem" }}>
                      <strong>{participant.label}</strong>
                    </div>
                  </td>
                  {timelineRoundStates.flatMap((timelineRoundState, roundIndex) =>
                    COMBAT_ROUND_STEPS.map((step, stepIndex) => {
                      const roundNumber = timelineRoundState.roundNumber;
                      const roundParticipant =
                        timelineRoundState.participants.find(
                          (candidate) => candidate.participantId === participant.participantId,
                        ) ?? participant;
                      const selected =
                        roundNumber === selectedRoundNumber &&
                        roundState.selectedParticipantId === participant.participantId &&
                        roundState.selectedStep === step;
                      const currentStepCell =
                        roundNumber === roundState.roundNumber && step === roundState.currentStep;
                      const activeCurrentTaskCell =
                        roundNumber === roundState.roundNumber &&
                        currentTaskSelection?.participantId === participant.participantId &&
                        currentTaskSelection.step === step;
                      const stepStatus = getParticipantDeclarationStatus({
                        participantId: participant.participantId,
                        roundState: timelineRoundState,
                        status: roundParticipant.stepStatuses[step] ?? "pending",
                        step,
                      });
                      const marker = getStatusMarker({
                        current: currentStepCell,
                        status: stepStatus,
                      });
                      const initiative =
                        step === "initiative_phase_1"
                          ? roundParticipant.initiatives.phase1
                          : step === "initiative_phase_2"
                            ? roundParticipant.initiatives.phase2
                            : undefined;
                      const initiativeTotal = getCombatRoundInitiativeTotal(initiative);
                      const title = `${participant.label}, round ${roundNumber}, ${COMBAT_ROUND_STEP_LABELS[step]}, status ${stepStatus}`;
                      const cellKey = getCombatRoundTimelineCellKey({
                        participantId: participant.participantId,
                        roundNumber,
                        step,
                      });

                      return (
                        <td
                          className={
                            roundIndex > 0 && stepIndex === 0 ? "round-boundary-start" : undefined
                          }
                          key={`${roundNumber}-${step}`}
                          style={{
                            ...stepCellStyle,
                            background: selected
                              ? "#efe7d3"
                              : currentStepCell
                                ? "#f6f0dd"
                                : undefined,
                            borderLeft:
                              roundIndex > 0 && stepIndex === 0
                                ? roundBoundaryStartBorder
                                : "1px solid #e3e1dc",
                            borderTop: "1px solid #e3e1dc",
                            outline: selected ? "2px solid #2f5d62" : undefined,
                            outlineOffset: "-2px",
                          }}
                        >
                          <button
                            aria-label={title}
                            onClick={() =>
                              selectInspector(participant.participantId, step, roundNumber)
                            }
                            ref={(node) => {
                              timelineCellRefs.current[cellKey] = node;

                              if (activeCurrentTaskCell) {
                                activeCurrentCellRef.current = node;
                              }
                            }}
                            style={{
                              alignItems: "center",
                              background: "transparent",
                              border: "none",
                              color: "#2f5d62",
                              cursor: "pointer",
                              display: "grid",
                              fontSize: "0.85rem",
                              fontWeight: currentStepCell ? 800 : 600,
                              justifyItems: "center",
                              lineHeight: 1.1,
                              minHeight: "1.8rem",
                              padding: 0,
                              width: "100%",
                            }}
                            title={
                              initiativeTotal !== undefined
                                ? `${title}, initiative ${initiativeTotal}`
                                : title
                            }
                            type="button"
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                color: initiativeTotal !== undefined ? "#1f7a4d" : undefined,
                                fontWeight: initiativeTotal !== undefined ? 800 : undefined,
                              }}
                            >
                              {initiativeTotal ?? marker}
                            </span>
                          </button>
                        </td>
                      );
                    }),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
                  {COMBAT_ROUND_STEP_LABELS[inspector.step]} · {formatStepStatus(inspector.status)}
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
                  <PlayerCombatActionSelectorPanel
                    actionId={inspectorDisplayDraft.actionId}
                    additionalActionNotes={inspectorDisplayDraft.additionalActionNotes}
                    controlsDisabled={
                      saving ||
                      !selectedRoundIsActive ||
                      Boolean(inspectorSnapshot) ||
                      inspectorCombatExperienceRequired
                    }
                    movementId={inspectorDisplayDraft.movementId}
                    onActionChange={(actionId) => updateInspectorDraft({ actionId })}
                    onAdditionalActionNotesChange={(additionalActionNotes) =>
                      updateInspectorDraft({ additionalActionNotes })
                    }
                    onMovementChange={(movementId) => updateInspectorDraft({ movementId })}
                    onSecondaryActionChange={(secondaryActionId) =>
                      updateInspectorDraft({ secondaryActionId })
                    }
                    roundNumber={selectedRoundNumber}
                    secondaryActionId={inspectorDisplayDraft.secondaryActionId}
                  />
                  {inspectorPhaseCards.map((phaseCard, index) => {
                    const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2";
                    const phaseCombatContext = inspectorDisplayDraft.phaseContexts[phaseKey];
                    const phaseLoadoutSummary = inspectorPhaseLoadoutSummaries[phaseKey];
                    const snapshotForPhase =
                      inspectorSnapshot?.phase === phaseKey ? inspectorSnapshot : undefined;
                    const phaseDefenseStats = buildPlayerCombatDefenseStats({
                      mainHandParryItemLabel: phaseLoadoutSummary.mainHandParryItemLabel,
                      offHandParryItemLabel: phaseLoadoutSummary.offHandParryItemLabel,
                      phaseContext: phaseCombatContext,
                      reference: phaseLoadoutSummary.reference,
                    });
                    const selectedResolutionContext =
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
                      attackStats: phaseLoadoutSummary.attackStats,
                      liveModifiers:
                        phaseKey === inspectorResolutionPhase
                          ? inspectorParryDefenderPhaseSummary?.liveModifiers
                          : buildEncounterLiveCombatModifierSummary({
                              combatContext: inspectorDraft.combatContext,
                              combatEffects: selectedScenarioParticipant?.state.combatEffects,
                              phaseKey,
                            }),
                      participantId: inspector.participant?.participantId,
                      phaseCard,
                      phaseContext: phaseCombatContext,
                      phaseDefenseStats,
                      phaseKey,
                      secondaryActionId: inspectorDisplayDraft.secondaryActionId,
                      selectedResolutionContext,
                      selectedStep: inspector.step,
                      snapshotAttackStats: snapshotForPhase?.attackSummary,
                      snapshotDefenseStats: snapshotForPhase?.defenseSummary,
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
                      >
                        {phaseModel.showAttackStats && phaseModel.attackStats ? (
                          <PlayerCombatAttackStatsTable stats={phaseModel.attackStats} />
                        ) : null}
                        {phaseModel.showAttackLocationSelector ? (
                          <>
                            <PlayerCombatAttackTargetSelector
                              combatContext={phaseModel.phaseContext}
                              controlsDisabled={saving || Boolean(inspectorSnapshot)}
                              onCombatContextChange={(combatContext) =>
                                updateInspectorDraft({
                                  phaseContexts: {
                                    ...inspectorDraft.phaseContexts,
                                    [phaseKey]: combatContext,
                                  },
                                })
                              }
                              targetOptions={inspectorTargetOptions}
                            />
                            <PlayerCombatAttackLocationSelector
                              combatContext={phaseModel.phaseContext}
                              controlsDisabled={saving || Boolean(inspectorSnapshot)}
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
                        {phaseModel.showDefenseContext && phaseModel.defenseStats ? (
                          <>
                            <PlayerCombatDefenseStatsTable stats={phaseModel.defenseStats} />
                            <PlayerCombatParryContextPanel
                              combatContext={phaseModel.phaseContext}
                              controlsDisabled={saving || Boolean(inspectorSnapshot)}
                              mainHandItemLabel={phaseLoadoutSummary.mainHandParryItemLabel}
                              offHandItemLabel={phaseLoadoutSummary.offHandParryItemLabel}
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
                    readOnly={Boolean(inspectorSnapshot)}
                    rows={inspectorDisplayModifierRows}
                  />
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    {inspector.step === "select_actions" ? (
                      <section style={playerCombatPanelCardStyle}>
                        <strong>Combat Experience</strong>
                        <div>{formatCombatExperienceStatus(inspectorCombatExperienceResult)}</div>
                        <div style={{ color: "#5e5a50", fontSize: "0.88rem" }}>
                          Skill total {inspectorCombatExperienceSkillTotal}
                        </div>
                        {inspectorCombatExperienceSkillLookup.warning ? (
                          <div style={{ color: "#8a4f21", fontSize: "0.85rem" }}>
                            {inspectorCombatExperienceSkillLookup.warning}
                          </div>
                        ) : null}
                        {inspectorCombatExperienceRequired ? (
                          <label style={compactFieldLabelStyle}>
                            <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                              Difficulty
                            </span>
                            <input
                              disabled={saving || inspectorIsInspectionOnly || Boolean(inspectorSnapshot)}
                              onChange={(event) => {
                                if (!inspectorCombatExperienceDifficultyKey) {
                                  return;
                                }

                                setCombatExperienceDifficultyDrafts((current) => ({
                                  ...current,
                                  [inspectorCombatExperienceDifficultyKey]: event.target.value,
                                }));
                              }}
                              type="number"
                              value={inspectorCombatExperienceDifficulty}
                            />
                          </label>
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
                        commitReadiness={inspectorDamageReviewCommitReadiness}
                        controlsDisabled={
                          saving || inspectorIsInspectionOnly || Boolean(inspectorSnapshot)
                        }
                        damageResult={inspectorDisplayPhaseResolutionResult.damageResult}
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
                      <CombatRoundEndReviewPanel
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
                    <PlayerCombatActionButtonPanel
                      buttonLabel={inspectorActionButtonLabel}
                      disabled={
                        saving ||
                        inspectorIsInspectionOnly ||
                        Boolean(inspectorActionValidationMessage) ||
                        inspectorSelectedAttackAlreadyRolled ||
                        inspectorDamageCommitted ||
                        Boolean(inspectorSnapshot)
                      }
                      onDeclareAction={() =>
                        void (inspector.step === "select_actions" &&
                        inspectorCombatExperienceRequired
                          ? rollInspectorCombatExperience()
                          : inspector.step === "round_summary"
                          ? advanceInspectorRoundEndReview()
                          : inspectorCurrentStepIsInitiative
                            ? rollInspectorInitiative()
                            : inspectorCanRollParry
                              ? rollInspectorParry()
                              : inspectorCurrentResolutionPhase &&
                                  (inspectorActionPhaseHasAttack === false ||
                                    inspectorActionPhaseResolutionStatus?.substep === "effects")
                                ? completeInspectorPhaseResolution(inspectorCurrentResolutionPhase)
                                : inspectorCurrentResolutionPhase &&
                                    (inspectorActionPhaseResolutionStatus?.substep === "parry" ||
                                      inspectorActionPhaseResolutionStatus?.substep === "damage")
                                  ? advanceInspectorPhaseResolutionSubstep(
                                      inspectorCurrentResolutionPhase,
                                    )
                                  : inspectorCanRollPhaseAttack && inspectorCurrentAttackPhase
                                    ? rollInspectorPhaseAttack(inspectorCurrentAttackPhase)
                                    : saveInspectorDeclaration())
                      }
                      onSecondaryAction={() => void skipInspectorCurrentPhaseAction()}
                      saving={saving}
                      secondaryButtonDisabled={
                        saving ||
                        inspectorIsInspectionOnly ||
                        Boolean(inspectorSnapshot) ||
                        !inspectorCanSkipCurrentPhaseAction
                      }
                      secondaryButtonLabel={
                        inspectorCanSkipCurrentPhaseAction ? "Skip current action" : undefined
                      }
                      statusText={`Current step: ${getPlayerCombatStepLabel(
                        inspector.step,
                      )}.${inspectorStatusSuffix}`}
                      validationMessage={inspectorActionValidationMessage}
                    />
                  </div>
                  <PlayerCombatActionResultPanel result={inspectorActionResult} />
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
    </section>
  );
}
