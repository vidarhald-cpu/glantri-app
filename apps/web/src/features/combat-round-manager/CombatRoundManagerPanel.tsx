"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import type {
  CombatRoundDeclaration,
  CombatRoundAttackRollResult,
  CombatRoundParryResolution,
  CombatRoundPhase,
  CombatRoundPhaseResolutionResult,
  CombatRoundStep,
  CombatRoundStepStatus,
  CombatRoundInitiativeRank,
  CombatRoundStepSnapshot,
  EncounterSession,
  ScenarioCombatModifierBucket,
  ScenarioCombatModifierEntry,
  ScenarioParticipant,
  ScenarioParticipantCombatContext,
} from "@glantri/domain";
import {
  COMBAT_ROUND_STEP_ABBREVIATIONS,
  COMBAT_ROUND_STEP_LABELS,
  COMBAT_ROUND_STEPS,
  advanceCombatRoundPhaseResolutionSubstepForParticipant,
  advanceCombatRoundStep,
  buildCombatRoundAttackRollResult,
  buildCombatRoundPhaseResolutionResult,
  buildCombatRoundInspector,
  characterBuildSchema,
  combatRoundParticipantHasPhaseAttack,
  completeCombatRoundPhaseResolutionForParticipant,
  ensureCombatRoundPhaseResolutionResultsForPhase,
  formatOpenEndedD20RollBreakdown,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundDamageReviewStepForPhase,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundParticipantPhaseStepStatus,
  getCombatRoundPhaseResolutionResultForAttack,
  getCombatRoundPhaseResolutionStatus,
  getCombatRoundInitiativeRanks,
  getCombatRoundInitiativeTotal,
  getCombatRoundModifierPhaseForStep,
  getCombatRoundResolutionPhaseForStep,
  getCombatRoundStepSnapshot,
  hasScenarioParticipantCombatDeclarationForEncounterRound,
  initializeCombatRoundState,
  recordCombatRoundAttackResult,
  recordCombatRoundDamageResult,
  recordCombatRoundNoAttackPhaseReview,
  recordCombatRoundParryResult,
  rollOpenEndedD20,
  rollOpenEndedCombatToHitD20,
  setCombatRoundSelection,
  sortCombatRoundParticipantsByInitiative,
  validateCombatDeclarationTargets,
} from "@glantri/domain";
import { resolveCombatParry, type WorkbookRawModifier } from "@glantri/rules-engine";

import { buildEquipmentLoadoutModuleModel } from "@/features/equipment/loadoutModule";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import {
  clearCurrentCombatRoundStepOnServer,
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
  type PlayerCombatDefenseStatsView,
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
  getNextCombatRoundParticipantSelection,
  isGlobalCombatRoundParticipantStep,
  normalizeCombatRoundManagerSelection,
  type CombatRoundSelectionTarget,
} from "./combatRoundSelection";

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

const inspectorNavStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem",
} as const;

const timelineRounds = 1;

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
  combinedScore?: number;
  mainHand?: CombatParrySourceOption;
  offHand?: CombatParrySourceOption;
}

interface CombatParrySourceSelection {
  usedMainHand: boolean;
  usedOffHand: boolean;
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
  if (isSequentialResolutionStep(step)) {
    return "Use inspector for phase resolution";
  }

  return `Commit ${COMBAT_ROUND_STEP_ABBREVIATIONS[step]} and advance to ${getNextStepLabel(step)}`;
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

  return `Parry: P ${resolution.combinedParryScore} + [mods] ${resolution.modifierAdjustment >= 0 ? "+" : ""}${resolution.modifierAdjustment} + roll ${rollText} = ${resolution.total}`;
}

function formatResolutionStatusLabel(value: string): string {
  return value
    .split("_")
    .map((part, index) => (index === 0 ? part[0]?.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function formatCombatDamageCalculationLine(
  damage: CombatRoundPhaseResolutionResult["damageResult"],
): string | undefined {
  if (!damage) {
    return undefined;
  }

  const damageLabel = damage.grazing ? "grazing" : "hit";
  const rollPart =
    damage.damageRoll.required && damage.damageRoll.total !== undefined
      ? ` + roll ${damage.damageRoll.total}`
      : "";

  return `Damage: DMB ${damage.dmb} + DM ${damage.defenderDm} + ${damageLabel} ${damage.tableDamageModifier}${rollPart} + armor ${damage.armorModifier ?? 0} = ${damage.totalDamage}`;
}

function formatCombatDamageResultLine(
  damage: CombatRoundPhaseResolutionResult["damageResult"],
): string | undefined {
  if (!damage) {
    return undefined;
  }

  const critical = damage.criticalGrade
    ? ` · Critical: ${damage.criticalGrade.toUpperCase()} pending`
    : "";

  return `Result: ${damage.totalDamage} damage${critical}`;
}

function formatCombatPhaseResolutionResultLines(input: {
  attackResult: CombatRoundAttackRollResult;
  participantId?: string;
  resolution: CombatRoundPhaseResolutionResult;
}): {
  attackLine: string;
  proposalLine: string;
  statusLine: string;
} {
  const parry = input.resolution.parryResolution;
  const damage = input.resolution.damageRoll;
  const damageResult = input.resolution.damageResult;
  const proposal = input.resolution.damageProposal;
  const resolvedParryLine = formatCombatParryCalculationLine(parry);
  const resolvedDamageLine = formatCombatDamageCalculationLine(damageResult);
  const resolvedDamageResultLine = formatCombatDamageResultLine(damageResult);
  const parryLine =
    resolvedParryLine ??
    `Parry: ${formatResolutionStatusLabel(parry.status)}${
      parry.resultLabel ? ` (${parry.resultLabel})` : ""
    }`;
  const parryResultLine =
    parry.status === "resolved" && parry.resultLabel ? `Result: ${parry.resultLabel}` : undefined;
  const damageLine = `Damage roll: ${formatResolutionStatusLabel(damage.status)}`;
  const proposalLine = `Proposal: ${formatResolutionStatusLabel(proposal.status)}`;
  const statusLine = resolvedDamageLine
    ? `${parryLine} · ${resolvedDamageLine}`
    : parryResultLine
      ? parryLine
      : `${parryLine} · ${damageLine}`;

  return {
    attackLine: `${formatCombatAttackResultLine({
      participantId: input.participantId,
      result: input.attackResult,
    })} · Result: ${input.attackResult.tableResult}`,
    proposalLine: resolvedDamageResultLine ?? parryResultLine ?? proposalLine,
    statusLine,
  };
}

function formatCombatPhaseResolutionSummary(input: {
  attackResult: CombatRoundAttackRollResult;
  participantId?: string;
  resolution: CombatRoundPhaseResolutionResult;
}): string {
  const lines = formatCombatPhaseResolutionResultLines(input);

  return `${lines.attackLine}\n${lines.statusLine}\n${lines.proposalLine}`;
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
    return "Resolve damage";
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

function getCombinedParryScore(
  model: ReturnType<typeof buildEquipmentLoadoutModuleModel> | null,
): number | undefined {
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

  return row
    ? parseOptionalCombatInteger(
        getCombatTableCell({ columns: table.columns, label: "Parry", row }),
      )
    : undefined;
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

  return {
    combinedScore: getCombinedParryScore(input.loadoutModel),
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
  const labels = [
    input.selection.usedMainHand ? input.sources?.mainHand?.label : undefined,
    input.selection.usedOffHand ? input.sources?.offHand?.label : undefined,
  ].filter((label): label is string => Boolean(label));

  return labels.length > 0 ? labels.join(" + ") : "No parry source selected";
}

function buildSelectedCombatParryDefenseStats(input: {
  baseStats: PlayerCombatDefenseStatsView | null;
  parryBase?: number;
  selection: CombatParrySourceSelection;
  sources?: CombatParrySourceOptions;
}): PlayerCombatDefenseStatsView | null {
  if (!input.baseStats) {
    return null;
  }

  return {
    ...input.baseStats,
    parry: input.parryBase === undefined ? "0" : String(input.parryBase),
    sourceName: formatSelectedCombatParrySourceName({
      selection: input.selection,
      sources: input.sources,
    }),
  };
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

function CombatParryResolutionPanel(input: {
  attackResult: CombatRoundAttackRollResult;
  controlsDisabled?: boolean;
  modifierAdjustment: number;
  onSelectionChange: (selection: CombatParrySourceSelection) => void;
  parryBase?: number;
  resolution?: CombatRoundParryResolution;
  selection: CombatParrySourceSelection;
  sources?: CombatParrySourceOptions;
}) {
  const canUseMainHand = Boolean(input.sources?.mainHand);
  const canUseOffHand = Boolean(input.sources?.offHand);
  const sourceSummary =
    input.parryBase !== undefined
      ? `P ${input.parryBase} + [mods] ${input.modifierAdjustment >= 0 ? "+" : ""}${input.modifierAdjustment}`
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
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const manualSelectionRef = useRef<CombatRoundSelectionTarget | undefined>(undefined);
  const pendingSelectionRef = useRef<CombatRoundSelectionTarget | undefined>(undefined);
  const selectedRoundNumber = roundState.roundNumber;
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
  const timelineRoundNumbers = Array.from(
    { length: timelineRounds },
    (_, index) => roundState.roundNumber + index,
  );
  const inspector = buildCombatRoundInspector({
    participantId: roundState.selectedParticipantId,
    state: roundState,
    step: roundState.selectedStep,
  });
  const selectedEncounterParticipant = encounter.participants.find(
    (participant) => participant.id === inspector.participant?.participantId,
  );
  const selectedScenarioParticipant = selectedEncounterParticipant
    ? findScenarioParticipantForEncounterParticipant({
        encounterParticipant: selectedEncounterParticipant,
        scenarioParticipants: effectiveScenarioParticipants,
      })
    : undefined;
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
          roundNumber: roundState.roundNumber,
        });
  const inspectorSnapshot = getCombatRoundStepSnapshot({
    participantId: inspector.participant?.participantId,
    roundNumber: selectedRoundNumber,
    state: roundState,
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
  const inspectorCurrentAttackPhase = inspectorAttackPhase;
  const inspectorCurrentResolutionPhase = inspectorAttackPhase ?? inspectorResolutionPhase;
  const inspectorPhaseResolutionCursor =
    inspectorSelectedStepIsSequential &&
    roundState.phaseResolutionCursor?.phase === inspectorCurrentResolutionPhase
      ? roundState.phaseResolutionCursor
      : undefined;
  const inspectorPhaseResolutionStatus =
    inspector.participant && inspectorCurrentResolutionPhase
      ? getCombatRoundPhaseResolutionStatus({
          participantId: inspector.participant.participantId,
          phase: inspectorCurrentResolutionPhase,
          state: roundState,
        })
      : undefined;
  const inspectorCurrentPhaseHasAttack =
    inspector.participant && inspectorCurrentResolutionPhase
      ? combatRoundParticipantHasPhaseAttack({
          participantId: inspector.participant.participantId,
          phase: inspectorCurrentResolutionPhase,
          state: roundState,
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
        isGameMaster: true,
        participants: effectiveScenarioParticipants,
        selectedParticipantId: selectedScenarioParticipant?.id,
      }),
    [effectiveScenarioParticipants, selectedScenarioParticipant?.id],
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
          state: roundState,
        })
      : undefined);
  const inspectorResolutionAttackResult =
    inspectorSnapshot?.attackResult ??
    (inspector.participant && inspectorResolutionPhase
      ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
          participantId: inspector.participant.participantId,
          phase: inspectorResolutionPhase,
          state: roundState,
        })
      : undefined);
  const inspectorDisplayPhaseResolutionResult =
    inspectorSnapshot?.phaseResolutionResult ??
    (inspectorResolutionAttackResult
      ? (getCombatRoundPhaseResolutionResultForAttack({
          attackResult: inspectorResolutionAttackResult,
          state: roundState,
        }) ??
        buildCombatRoundPhaseResolutionResult({
          attackResult: inspectorResolutionAttackResult,
          roundNumber: roundState.roundNumber,
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
          state: roundState,
        })
      : undefined;
  const inspectorPhaseResolutionOwnerHasAttack =
    inspectorPhaseResolutionOwnerParticipantId && inspectorCurrentResolutionPhase
      ? combatRoundParticipantHasPhaseAttack({
          participantId: inspectorPhaseResolutionOwnerParticipantId,
          phase: inspectorCurrentResolutionPhase,
          state: roundState,
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
    roundNumber: roundState.roundNumber,
  });
  const inspectorParryDefenderRoundParticipant = inspectorResolutionAttackResult
    ? roundState.participants.find(
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
  const inspectorParryModifierCalculation =
    inspectorParryBase !== undefined
      ? buildEncounterDbParryModifierCalculation({
          baseValue: inspectorParryBase,
          liveModifiers: inspectorParryDefenderPhaseSummary?.liveModifiers,
        })
      : null;
  const inspectorParryModifierAdjustment = inspectorParryModifierCalculation
    ? inspectorParryModifierCalculation.finalValue - (inspectorParryBase ?? 0)
    : 0;
  const inspectorNoPhaseAttack =
    Boolean(inspectorAttackPhase) &&
    !inspectorDisplayAttackResult &&
    inspectorCurrentPhaseHasAttack === false;
  const inspectorSelectedAttackAlreadyRolled = Boolean(
    inspectorAttackPhase && inspectorDisplayAttackResult,
  );
  const inspectorCanRollPhaseAttack =
    Boolean(inspectorCurrentAttackPhase) &&
    inspectorCurrentPhaseHasAttack === true &&
    (!inspectorPhaseResolutionStatus ||
      inspectorPhaseResolutionStatus.substep === "pending" ||
      inspectorPhaseResolutionStatus.substep === "attack") &&
    !inspectorDisplayAttackResult;
  const inspectorCanRollParry =
    Boolean(inspectorResolutionPhase) &&
    inspectorResolutionStepKind === "parry" &&
    Boolean(inspectorResolutionAttackResult?.hit) &&
    inspectorDisplayPhaseResolutionResult?.parryResolution.status === "pending" &&
    inspectorPhaseResolutionOwnerStatus?.substep === "parry" &&
    inspector.participant?.participantId ===
      inspectorResolutionAttackResult?.defenderParticipantId &&
    inspectorParryBase !== undefined &&
    !inspectorSnapshot;
  const inspectorDamageAlreadyResolved =
    inspectorResolutionStepKind === "damage" &&
    Boolean(inspectorDisplayPhaseResolutionResult?.damageResult);
  const inspectorIsCursorParticipant =
    Boolean(inspectorPhaseResolutionCursor) &&
    inspectorPhaseResolutionCursor?.participantId === inspector.participant?.participantId;
  const inspectorCursorParticipantLabel = inspectorPhaseResolutionCursor
    ? roundState.participants.find(
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
          state: roundState,
        })
      : undefined;
  const inspectorCursorActorLabel = inspectorCursorIncomingAttackResult
    ? roundState.participants.find(
        (participant) =>
          participant.participantId === inspectorCursorIncomingAttackResult.attackerParticipantId,
      )?.label
    : inspectorCursorParticipantLabel;
  const inspectorCursorDefenderLabel = inspectorCursorIncomingAttackResult
    ? roundState.participants.find(
        (participant) =>
          participant.participantId === inspectorCursorIncomingAttackResult.defenderParticipantId,
      )?.label
    : undefined;
  const inspectorActionButtonLabel = inspectorSelectedAttackAlreadyRolled
    ? "Attack already rolled"
    : inspectorDamageAlreadyResolved
      ? "Damage resolved"
      : inspectorCanRollParry
      ? "Roll parry"
      : inspectorCurrentResolutionPhase && inspectorActionPhaseHasAttack === false
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
        interpretedResult: inspectorPhaseResolutionLines.statusLine,
        rankLabel: inspectorPhaseResolutionLines.attackLine,
        resultLabel: inspectorPhaseResolutionLines.proposalLine,
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
              state: roundState,
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
    const pendingSelection = pendingSelectionRef.current;
    const manualSelection = manualSelectionRef.current;
    const nextRoundState = normalizeCombatRoundManagerSelection({
      manualSelection,
      pendingSelection,
      state: initialRoundState,
    });

    if (pendingSelection) {
      pendingSelectionRef.current = undefined;
    }

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

  function focusRoundTable() {
    tableContainerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    tableContainerRef.current?.focus({ preventScroll: true });
    tableContainerRef.current?.scrollTo({ left: 0, top: 0 });
  }

  function buildScenarioParticipantPhaseSummary(input: {
    declaration?: CombatRoundDeclaration;
    phaseKey?: PlayerCombatPhaseKey;
    scenarioParticipant?: ScenarioParticipant;
  }): {
    attackStats: ReturnType<typeof buildPlayerCombatLoadoutSummary>["attackStats"];
    defenseStats: ReturnType<typeof buildPlayerCombatDefenseStats>;
    liveModifiers: ReturnType<typeof buildEncounterLiveCombatModifierSummary>;
    modifierRows: ReturnType<typeof buildPlayerCombatModifierRows>;
    parrySources: CombatParrySourceOptions;
    phaseContext?: ScenarioParticipantCombatContext;
  } {
    const draft = buildDeclarationDraft(input.scenarioParticipant, input.declaration, {
      encounterId: encounter.id,
      roundNumber: roundState.roundNumber,
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
    const loadoutSummary = buildPlayerCombatLoadoutSummary({
      actionId: draft.actionId,
      loadoutModel,
      secondaryActionId: draft.secondaryActionId,
    });
    const parrySources = buildCombatParrySourceOptions({
      loadoutModel,
      mainHandLabel: loadoutSummary.mainHandParryItemLabel,
      offHandLabel: loadoutSummary.offHandParryItemLabel,
    });
    const phaseContext = input.phaseKey ? draft.phaseContexts[input.phaseKey] : undefined;
    const defenseStats = phaseContext
      ? buildPlayerCombatDefenseStats({
          mainHandParryItemLabel: loadoutSummary.mainHandParryItemLabel,
          offHandParryItemLabel: loadoutSummary.offHandParryItemLabel,
          phaseContext,
          reference: loadoutSummary.reference,
        })
      : null;

    return {
      attackStats: loadoutSummary.attackStats,
      defenseStats,
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
        roundNumber: roundState.roundNumber,
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

    await persistRoundState(advanceCombatRoundStep(stateForCommit, advanceInput));
  }

  async function persistRoundState(nextRoundState: typeof roundState) {
    setRoundState(nextRoundState);
    setSaving(true);

    try {
      const nextEncounter = await updateEncounterOnServer({
        encounterId: encounter.id,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
        },
      });

      onEncounterUpdated?.(nextEncounter);
      focusRoundTable();
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
      setSaveError(undefined);
      onEncounterUpdated?.(nextEncounter);
      focusRoundTable();

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

  function selectInspector(participantId: string, step: CombatRoundStep) {
    manualSelectionRef.current = {
      participantId,
      step,
    };
    setRoundState((current) =>
      setCombatRoundSelection({
        participantId,
        state: current,
        step,
      }),
    );
  }

  function moveSelection(input: { participantOffset?: number; stepOffset?: number }) {
    setRoundState((current) => {
      const participantIndex = displayParticipants.findIndex(
        (participant) => participant.participantId === current.selectedParticipantId,
      );
      const stepIndex = COMBAT_ROUND_STEPS.indexOf(current.selectedStep ?? current.currentStep);
      const nextParticipant =
        displayParticipants[
          Math.min(
            Math.max(
              (participantIndex === -1 ? 0 : participantIndex) + (input.participantOffset ?? 0),
              0,
            ),
            Math.max(displayParticipants.length - 1, 0),
          )
        ];
      const nextStep =
        COMBAT_ROUND_STEPS[
          Math.min(
            Math.max((stepIndex === -1 ? 0 : stepIndex) + (input.stepOffset ?? 0), 0),
            COMBAT_ROUND_STEPS.length - 1,
          )
        ];

      manualSelectionRef.current = {
        participantId: nextParticipant?.participantId,
        step: nextStep,
      };

      return setCombatRoundSelection({
        participantId: nextParticipant?.participantId,
        state: current,
        step: nextStep,
      });
    });
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
    step: CombatRoundStep;
    status: CombatRoundStepStatus;
  }): CombatRoundStepStatus {
    const phase =
      getCombatAttackPhaseForStep(input.step) ?? getCombatRoundResolutionPhaseForStep(input.step);

    if (phase) {
      return getCombatRoundParticipantPhaseStepStatus({
        participantId: input.participantId,
        state: roundState,
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
      roundNumber: roundState.roundNumber,
    });

    return declaredThisRound && input.status === "pending" ? "submitted" : input.status;
  }

  async function saveInspectorDeclaration() {
    if (!encounter.scenarioId || !selectedScenarioParticipant || !selectedEncounterParticipant) {
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
      setSaveError(`No ${phaseLabel} attack.`);
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

    let attackResult: CombatRoundAttackRollResult;

    try {
      const ob = parseCombatInteger(phaseModel.attackStats.ob, `${phaseLabel} OB`);
      const defenderDb = parseCombatInteger(
        targetPhaseSummary.defenseStats.db,
        `Target ${phaseLabel} DB`,
      );
      const roll = rollOpenEndedCombatToHitD20();

      attackResult = buildCombatRoundAttackRollResult({
        actionId: inspectorDraft.actionId || `${phase}_attack`,
        attackerParticipantId: selectedEncounterParticipant.id,
        defenderDb,
        defenderParticipantId: targetEncounterParticipant.id,
        ob,
        openEndedD10s: roll.openEndedD10s,
        phase,
        rollD20: roll.rollD20,
        rollTotal: roll.rollTotal,
        rolledAt: new Date().toISOString(),
        weaponName: phaseModel.attackStats.weaponName,
      });
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
      const nextRoundState = recordCombatRoundAttackResult({
        command: {
          createdAt: attackResult.rolledAt,
        },
        participantId: selectedEncounterParticipant.id,
        result: attackResult,
        state: roundState,
        submittedBy: "gm",
      });

      await persistRoundState(nextRoundState);
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
    const rawModifiers: WorkbookRawModifier[] = [
      {
        label: "General/Fatigue",
        value: inspectorParryDefenderPhaseSummary?.liveModifiers.generalFatigueRaw ?? 0,
      },
      {
        label: "DB/Parry",
        value: inspectorParryDefenderPhaseSummary?.liveModifiers.dbRaw ?? 0,
      },
    ];
    const roll = rollOpenEndedD20();
    const parry = resolveCombatParry({
      parryBase: inspectorParryBase,
      rawModifiers,
      rollTotal: roll.dieResult,
    });
    const usedMainHand = inspectorParrySelection.usedMainHand && Boolean(sources?.mainHand);
    const usedOffHand = inspectorParrySelection.usedOffHand && Boolean(sources?.offHand);
    const updatedAt = new Date().toISOString();
    const parryResolution: CombatRoundParryResolution = {
      combinedParryScore: parry.parryBase,
      mainHandParryScore: usedMainHand ? sources?.mainHand?.score : undefined,
      modifierAdjustment: parry.modifierAdjustment,
      notes:
        "Direction, location coverage, and multi-opponent source allocation are deferred in this first parry slice.",
      offHandParryScore: usedOffHand ? sources?.offHand?.score : undefined,
      openEndedD10s: roll.openEndedD10s,
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

        const phaseLabel = formatCombatPhaseLabel(phase);
        const attackerRoundParticipant = roundState.participants.find(
          (participant) =>
            participant.participantId === damageReviewAttackResult.attackerParticipantId,
        );
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
          return;
        }

        if (!defenseStats) {
          setSaveError(`${phaseLabel} defender DM is not available.`);
          return;
        }

        const dmb = parseCombatInteger(attackStats.dmb, `${phaseLabel} DMB`);
        const defenderDm = parseCombatInteger(defenseStats.dm, `${phaseLabel} defender DM`);

        nextRoundState = recordCombatRoundDamageResult({
          attackResult: damageReviewAttackResult,
          command: {
            createdAt: updatedAt,
          },
          armorModifier: 0,
          defenderDm,
          dmb,
          state: roundState,
          submittedBy: "gm",
          updatedAt,
        });
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
            disabled={saving || inspectorSelectedStepIsSequential}
            onClick={() => void commitCurrentStep()}
            type="button"
          >
            {saving ? "Saving..." : getAdvanceButtonLabel(inspector.step)}
          </button>
          <button disabled={saving} onClick={() => void clearCurrentStep()} type="button">
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
              {timelineRoundNumbers.map((roundNumber) => (
                <th
                  colSpan={COMBAT_ROUND_STEPS.length}
                  key={roundNumber}
                  style={{
                    background: "#efe7d3",
                    borderBottom: "1px solid #d1c7aa",
                    borderLeft: "1px solid #e3e1dc",
                    padding: "0.35rem",
                    textAlign: "center",
                  }}
                >
                  Round {roundNumber}
                </th>
              ))}
            </tr>
            <tr>
              {timelineRoundNumbers.flatMap((roundNumber) =>
                COMBAT_ROUND_STEPS.map((step) => (
                  <th
                    key={`${roundNumber}-${step}`}
                    style={{
                      ...stepCellStyle,
                      background: step === roundState.currentStep ? "#f6f0dd" : "#fbfaf7",
                      borderBottom: "1px solid #e3e1dc",
                      borderLeft: "1px solid #e3e1dc",
                      fontWeight: step === roundState.currentStep ? 800 : 700,
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
                  {timelineRoundNumbers.flatMap((roundNumber) =>
                    COMBAT_ROUND_STEPS.map((step) => {
                      const selected =
                        roundNumber === selectedRoundNumber &&
                        roundState.selectedParticipantId === participant.participantId &&
                        roundState.selectedStep === step;
                      const currentStepCell =
                        roundNumber === roundState.roundNumber && step === roundState.currentStep;
                      const stepStatus = getParticipantDeclarationStatus({
                        participantId: participant.participantId,
                        status: participant.stepStatuses[step] ?? "pending",
                        step,
                      });
                      const marker = getStatusMarker({
                        current: currentStepCell,
                        status: stepStatus,
                      });
                      const initiative =
                        step === "initiative_phase_1"
                          ? participant.initiatives.phase1
                          : step === "initiative_phase_2"
                            ? participant.initiatives.phase2
                            : undefined;
                      const initiativeTotal = getCombatRoundInitiativeTotal(initiative);
                      const title = `${participant.label}, round ${roundNumber}, ${COMBAT_ROUND_STEP_LABELS[step]}, status ${stepStatus}`;

                      return (
                        <td
                          key={`${roundNumber}-${step}`}
                          style={{
                            ...stepCellStyle,
                            background: selected
                              ? "#efe7d3"
                              : currentStepCell
                                ? "#f6f0dd"
                                : undefined,
                            borderLeft: "1px solid #e3e1dc",
                            borderTop: "1px solid #e3e1dc",
                            outline: selected ? "2px solid #2f5d62" : undefined,
                            outlineOffset: "-2px",
                          }}
                        >
                          <button
                            aria-label={title}
                            onClick={() => selectInspector(participant.participantId, step)}
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
                    controlsDisabled={saving || Boolean(inspectorSnapshot)}
                    movementId={inspectorDisplayDraft.movementId}
                    onActionChange={(actionId) => updateInspectorDraft({ actionId })}
                    onAdditionalActionNotesChange={(additionalActionNotes) =>
                      updateInspectorDraft({ additionalActionNotes })
                    }
                    onMovementChange={(movementId) => updateInspectorDraft({ movementId })}
                    onSecondaryActionChange={(secondaryActionId) =>
                      updateInspectorDraft({ secondaryActionId })
                    }
                    roundNumber={roundState.roundNumber}
                    secondaryActionId={inspectorDisplayDraft.secondaryActionId}
                  />
                  {inspectorPhaseCards.map((phaseCard, index) => {
                    const phaseKey: PlayerCombatPhaseKey = index === 0 ? "phase1" : "phase2";
                    const phaseCombatContext = inspectorDisplayDraft.phaseContexts[phaseKey];
                    const phaseLoadoutSummary = inspectorPhaseLoadoutSummaries[phaseKey];
                    const snapshotForPhase =
                      inspectorSnapshot?.phase === phaseKey ? inspectorSnapshot : undefined;
                    const baseDefenseStats =
                      snapshotForPhase?.defenseSummary ??
                      buildPlayerCombatDefenseStats({
                        mainHandParryItemLabel: phaseLoadoutSummary.mainHandParryItemLabel,
                        offHandParryItemLabel: phaseLoadoutSummary.offHandParryItemLabel,
                        phaseContext: phaseCombatContext,
                        reference: phaseLoadoutSummary.reference,
                      });
                    const shouldShowSelectedParryStats =
                      !snapshotForPhase &&
                      phaseKey === inspectorResolutionPhase &&
                      inspector.participant?.participantId ===
                        inspectorResolutionAttackResult?.defenderParticipantId &&
                      inspectorResolutionStepKind === "parry";
                    const defenseStats = shouldShowSelectedParryStats
                      ? buildSelectedCombatParryDefenseStats({
                          baseStats: baseDefenseStats,
                          parryBase: inspectorParryBase,
                          selection: inspectorParrySelection,
                          sources: inspectorParryDefenderPhaseSummary?.parrySources,
                        })
                      : baseDefenseStats;
                    const phaseModel = buildPlayerCombatPhasePanelModel({
                      actionId: inspectorDisplayDraft.actionId,
                      attackStats:
                        snapshotForPhase?.attackSummary ?? phaseLoadoutSummary.attackStats,
                      defenseStats,
                      phaseCard,
                      phaseContext: phaseCombatContext,
                      phaseKey,
                      secondaryActionId: inspectorDisplayDraft.secondaryActionId,
                    });

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
                    {inspectorResolutionStepKind === "parry" &&
                    inspectorResolutionAttackResult?.hit &&
                    inspectorDisplayPhaseResolutionResult &&
                    inspectorDisplayPhaseResolutionResult?.parryResolution.status !==
                      "not_applicable" ? (
                      <CombatParryResolutionPanel
                        attackResult={inspectorResolutionAttackResult}
                        controlsDisabled={
                          saving ||
                          Boolean(inspectorSnapshot) ||
                          inspectorDisplayPhaseResolutionResult.parryResolution.status ===
                            "resolved"
                        }
                        modifierAdjustment={inspectorParryModifierAdjustment}
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
                    <PlayerCombatActionButtonPanel
                      buttonLabel={inspectorActionButtonLabel}
                      disabled={
                        saving ||
                        Boolean(inspectorTargetValidationMessage) ||
                        inspectorSelectedAttackAlreadyRolled ||
                        inspectorDamageAlreadyResolved ||
                        Boolean(inspectorSnapshot)
                      }
                      onDeclareAction={() =>
                        void (inspectorCurrentStepIsInitiative
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
                      saving={saving}
                      statusText={`Current step: ${getPlayerCombatStepLabel(
                        inspector.step,
                      )}.${inspectorStatusSuffix}`}
                      validationMessage={inspectorTargetValidationMessage}
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
