import type { FastifyPluginAsync, FastifyReply } from "fastify";

import {
  defaultCanonicalContent,
  equipmentTemplatesById,
  kickTemplate,
  punchTemplate,
  weaponTemplates,
} from "@glantri/content";
import {
  CampaignService,
  CharacterService,
  CombatStateReadService,
  CombatItemInteractionService,
  EncounterCombatWriteError,
  EncounterService,
  EncounterWriteError,
  ScenarioService,
  type CombatThrownWeaponAttackUndo,
} from "@glantri/database";
import {
  buildPlayerSafeRoleplayStateForUser,
  adaptModifierBucketRowToCanonicalLifecycle,
  applyCommittedCombatFeintModifiers,
  applyCombatActionGeneratedModifiers,
  advanceCombatProgressionBoundary,
  acceptedCombatDefenseCalculationSchema,
  authorizeCombatProgressionTask,
  backOutCombatRoundPhaseAttack,
  buildEncounterSessionRevisionFromMetadataView,
  buildEncounterSessionSummaryFromMetadataView,
  buildCombatRoundCommandEnvelope,
  buildCombatRoundDeclarationId,
  DEFAULT_COMBAT_STEP_AUTOMATION_LIMIT,
  buildCombatRoundCommandId,
  buildCombatObservationModifierContributions,
  buildCombatObservationSkillContestContribution,
  projectProcessNumericContributionToCanonicalModifierLifecycle,
  transitionCanonicalCombatModifierEffect,
  buildPlayerSafeCombatObservationAttempts,
  buildPlayerSafeCombatObservationRelationships,
  activateCombatGenericAction,
  combatGenericActionDurationSchema,
  declareCombatGenericAction,
  finishCombatGenericAction,
  buildCombatRoundAttackRollResult,
  buildCanonicalCombatModifierReviewFromDraft,
  buildCombatProgressionProjection,
  isCompleteDeterministicCombatTask,
  getCurrentExecutableCombatTasks,
  getConflictingContinuedContactIds,
  getCombatStepAutomationCommandPrefix,
  holdCombatRoundForGmBacktrack,
  projectActiveCombatParticipation,
  projectCombatNpcDeclarationProposal,
  projectCombatGenericActionsForPlayer,
  runCombatDeterministicTransitionSuffix,
  runCombatStepAutomation,
  buildCombatRoundDeclaredAttackOpportunities,
  buildCombatRoundDamageArmorCoverageFromEquipmentState,
  buildCombatRoundInitiativeResult,
  buildReactiveAttackPhase2InitiativeModifierEntry,
  COMBAT_PROGRESSION_BOUNDARIES,
  CombatProgressionBoundaryAdvanceError,
  canClearCombatRoundStep,
  canPlayerRollCombatInitiative,
  buildRoleplayCalculationPreview,
  completeRemainingCombatRoundStep,
  commitCombatRoundPhaseInitiativeResolution,
  commitCombatRoundEndDistanceControl,
  commitCombatRoundEndParticipantReview,
  commitCombatRoundPhaseDamage,
  continueCombatRoundPhaseAttack,
  decideCombatRoundDoubleAttackPhase2,
  canRepeatWeaponAttackInRound,
  canPlayerSubmitCombatDeclaration,
  characterBuildSchema,
  AnyEquipmentTemplateSchema,
  CharacterLoadoutSchema,
  EquipmentItemSchema,
  StorageLocationSchema,
  clearCombatRoundStep,
  clearCurrentCombatRoundStepAndRewind,
  combatRoundPhaseSchema,
  combatEffectEventSchema,
  combatEffectSchema,
  combatEffectsStateSchema,
  CanonicalCombatModifierReviewError,
  canonicalCombatModifierEffectSchema,
  canonicalCombatModifierReviewInputSchema,
  canonicalCombatModifierReviewTransactionSchema,
  commitCanonicalCombatModifierReview,
  CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
  CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION,
  combatAttackSourceRefSchema,
  combatDistanceSchema,
  combatRoundStepSchema,
  combatRoundStepSnapshotSchema,
  combatStepAutomationStartRequestSchema,
  combatStepAutomationCommandLinkSchema,
  combatNpcDeclarationProposalProvenanceSchema,
  encounterParticipantMembershipModeSchema,
  encounterSessionSchema,
  encounterStatusSchema,
  glantriCharacteristicKeySchema,
  ensureDistanceEdgesForParticipantPairs,
  ensureCombatRoundEndReviewPrepared,
  deriveCombatRoundAttackResultsCompatibility,
  expireCombatFeintGeneratedModifiersBeforeRound,
  expireAdjustDistanceAttackGeneratedModifiersBeforeRound,
  fingerprintCombatModifierResolution,
  getCombatRoundInitiativePhaseForStep,
  getCombatBreakOffPairConsequence,
  getCombatRoundCurrentInitiativeExecutionGroup,
  getCombatRoundNextEventSequence,
  getCombatNpcDeclarationProposalAttackSources,
  getCanonicalCombatModifierReviewState,
  buildLiveCombatModifierContributionProjection,
  createCombatParticipantPairKey,
  getMergedCombatDbFlatAdjustmentTotal,
  projectCanonicalCombatModifierReviewPublicResult,
  projectCanonicalCombatModifierReviewInput,
  getCombatRoundParryReviewStepForPhase,
  getCombatRoundAttackResultById,
  getCombatRoundAttackResultForOpportunity,
  getCombatRoundAttackResultId,
  getCombatRoundCriticalResultId,
  getCanonicalAttackOpportunityIdentity,
  getCombatRoundDamageReviewId,
  resolveCombatDisarmContactQualityModifier,
  getCombatRoundGrazeDamageRollContext,
  getCombatRoundCombatExperienceDifficulty,
  getCombatDistanceParticipantAliases,
  getDistanceEdgeBetweenParticipantAliases,
  getCombatDeclarationAttackPhases,
  getCombatRoundDistanceEdge,
  getCombatRoundEndDistanceProposalLifecycle,
  getCombatRoundEndHealthAutomationReviewDisposition,
  getCombatRoundEndHealthCheckPendingRolls,
  getPendingCombatObservationAttempts,
  getCombatRoundRequiredCombatExperienceTrigger,
  getCombatRoundHitLocationResultId,
  getSingleAttackDeclaredDistanceForPenalty,
  getCombatRoundPhaseAttackCandidates,
  getParticipantCombatExperienceSkillTotalLookup,
  initializeCombatRoundState,
  isCombatStartExperienceRollRequired,
  isThrownWeaponAttackMode,
  isCombatRoundCombatExperienceWindowOpen,
  isCombatStepAutomationProjectionWithinScope,
  isUserAssignedToEncounterMembership,
  normalizeRoleplayState,
  roleplayDifficultySchema,
  normalizeCombatArmorModifierClass,
  rollCombatRoundCombatExperience,
  recordCombatRoundCriticalRoll,
  recordCombatGenericActionRoll,
  recordCombatRoundDamageResult,
  recordCombatRoundDeclaration,
  respondCombatRoundAdjustDistance,
  reviewCombatRoundAdjustDistanceRollAdjustment,
  reviewCombatRoundBreakOff,
  recordCombatRoundAdjustDistanceRoll,
  recordCombatRoundBreakOffRoll,
  recordCombatRoundDisarmRoll,
  commitCombatRoundAdjustDistance,
  commitCombatRoundBreakOff,
  commitCombatRoundDisarm,
  cancelCombatRoundDisarmWithoutContact,
  openCombatRoundDisarmAfterContact,
  combatAdjustDistanceRollResultSchema,
  combatBreakOffRollSchema,
  combatDisarmRollSchema,
  combatRoundEndDistanceRollResultSchema,
  recordCombatRoundFeintRoll,
  commitCombatRoundFeintResult,
  recordCombatRoundHitLocationRoll,
  recordCombatRoundInitiative,
  recordCombatRoundAttackResult,
  recordCombatRoundParryResult,
  recordCombatRoundOffensiveParryBrawlingRoll,
  recordCombatObservationRoll,
  recordContinuedContactMaintenanceRoll,
  reviewCombatRoundDamageResult,
  recordCombatRoundParticipantStepReview,
  refreshScenarioParticipantPersistentCombatModifiers,
  removeCombatRoundCombatExperienceCombatContextModifiers,
  removeCombatRoundCombatExperienceEffects,
  restoreCombatRoundPhaseInitiativeResolutionCombatContextModifiers,
  restoreCombatRoundBackOutCombatContextModifiers,
  removeCombatRoundCommittedDamageEffects,
  removeCombatRoundEndHealthCheckEffects,
  removeCombatRoundEndParticipantReviewEffects,
  resolveEncounterParticipantByRollParticipantId,
  resolveEncounterParticipantForViewer,
  resolveEncounterParticipantMembership,
  reviewCombatGenericAction,
  resolveCombatDodgeModifiers,
  resolveCanonicalCombatAttackModifierFacts,
  resolveCanonicalCombatParryModifierFacts,
  resolveCombatWideGeneralModifiers,
  resolveCombatModifierContributions,
  resolveCombatAttackPhaseDefensivePenalties,
  resolveCombatAttackPhaseDefensivePenalty,
  rollCombatRoundEndDistanceControl,
  rollCombatRoundEndHealthCheck,
  rollOpenEndedCombatToHitD20,
  rollOpenEndedD20,
  rollOpenEndedD6,
  combatRoundPhaseContextsSchema,
  getWeaponPreferredDistances,
  isDistanceGeneratedObSkillModifier,
  movementIntentSchema,
  normalizeMovementIntent,
  normalizeCombatModifierRowsForEncounter,
  projectCombatHistory,
  withCombatHistoryRoundState,
  removeDistanceGeneratedObSkillModifiers,
  resolveCombatDeclarationParticipantIdentity,
  resolveCombatFeintWeaponSkillDefinition,
  scenarioParticipantCombatContextSchema,
  scenarioCombatModifierEntrySchema,
  scenarioParticipantSecondaryActionContextSchema,
  combatFeintMethodSchema,
  combatFeintProposalSchema,
  combatFeintRollResultSchema,
  combatAdjustDistanceProposalSchema,
  setCombatRoundCombatExperienceDifficulty,
  setCombatRoundPairDistance,
  setCombatRoundSelection,
  skipCombatRoundCurrentPhaseAction,
  validateCombatDeclarationCompatibility,
  validateCombatDeclarationTargets,
  validateCombatNpcDeclarationProposal,
  upsertCombatRoundStepSnapshots,
  type CanonicalCombatModifierEffect,
  type CanonicalCombatModifierReviewDecision,
  type CanonicalCombatModifierReviewProposal,
  type ActiveCombatDeterministicAdvanceDescriptor,
  type ScenarioParticipantState,
  type CombatStepAutomationProjection,
  type CombatStepAutomationProcessFamily,
  type CombatStepAutomationRunIdentity,
  type CombatStepAutomationStopReason,
  type CombatRoundEndDistanceCalculationReadiness,
  type CombatGenericActionDuration,
  type CombatGenericActionReference,
  type CombatGenericActionRollRequest,
  type CombatNpcDeclarationProposal,
  type CombatNpcDeclarationSourceStatus,
  type ParticipantCombatExperienceSkillTotalLookup,
} from "@glantri/domain";
import {
  ACTIVE_COMBAT_MUTATION_RESPONSE_HEADER,
  buildRequestedCombatMutationResponse,
  prefersActiveCombatMutationResponse,
} from "./combatMutationResponse";
import type {
  CombatAttackModifierValidationProjection,
  CombatAttackPhaseDefensivePenalty,
  CombatParryModifierValidationProjection,
  CombatActionGeneratedDistanceModifierInput,
  CombatAttackSourceRef,
  CombatDisarmRoll,
  CombatDistanceWeaponLike,
  CombatRoundAttackOpportunity,
  CombatRoundCommand,
  CombatRoundEndDistanceControlSide,
  CombatRoundEndDistanceProposal,
  CombatRoundEndDistanceRollResult,
  CombatRoundPhase,
  CombatRoundPhaseInitiativeCommitParticipantInput,
  CombatRoundAttackDistanceModifierDetail,
  CombatRoundPhaseResolutionResult,
  CombatRoundDamageReview,
  CombatRoundDeclaration,
  CombatRoundStepSnapshot,
  CombatRoundState,
  CombatProgressionBoundaryKind,
  CombatProgressionExpectedCommand,
  CombatRoundPhaseContexts,
  CombatCalculationContext,
  CombatModifierContribution,
  CombatSkillContestRole,
  CombatSkillContestType,
  CombatFeintProposal,
  CombatProgressionProjection,
  CombatProgressionTask,
  EncounterParticipantReadSource,
  EncounterSession,
  GlantriCharacteristicKey,
  MovementIntent,
  RoleplayDifficulty,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
  ScenarioParticipant,
  WeaponTemplate,
} from "@glantri/domain";
import {
  assignRoleplayStatCheck,
  buildCharacterSheetSummary,
  buildCombatStateCharacterInputs,
  calculateWorkbookPercentageAdjustmentTrace,
  deriveParryPrimaryActionModifier,
  isCombatFeintResistanceSkill,
  recordRoleplayGmSkillRoll,
  recordRoleplayStatCheckResult,
  resolveCombatParry,
  resolveCombatFeintSkillContest,
  resolveCombatFeintSkillProfile,
  resolveCombatFeintTable,
  resolveCombatOffensiveParryBrawling,
  resolveHighestCombatFeintResistanceProfile,
  resolveRoleplaySkillRollModifiers,
  resolveParticipantSkillRollProfile,
  resolveParticipantStatRollProfile,
  resolveCombatSkillContest,
  resolveCombatMovementBurden,
  getCombatMovementModifierApplicability,
  resolveCombatObservationSkillProfile,
  resolveGenericCombatActionRoll,
  resolveCombatDisarmRoll,
} from "@glantri/rules-engine";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import {
  instrumentCombatService,
  measureCombatPerformanceStage,
  probeCombatPerformanceSerialization,
  timeCombatPerformanceStage,
} from "../../lib/combatPerformance";
import { combatRoundStatesDiffer } from "./combatRoundPersistence";
import { parseBodyObject, parseId, parseOptionalString } from "./parsing";
import { resolveScenarioWorkspaceAccess } from "./access";
import { selectCurrentCombatModifierValidationTask } from "./combatModifierValidationTaskSelection";
import { resolveCanonicalScenarioParticipantDefense } from "./combatDefenseResolution";
import { resolveCanonicalCombatInitiativeBaseForTask } from "./combatInitiativeResolution";
import {
  resolveCanonicalAttackOffense,
  resolveCanonicalParryBase,
  resolveCanonicalWeaponParryBase,
} from "./combatManualCalculationResolution";

const campaignService = instrumentCombatService(new CampaignService(), {
  getCampaignById: {
    stage: "repository_read_campaign",
  },
});
const characterService = new CharacterService();
const combatItemInteractionService = new CombatItemInteractionService();
const combatStateReadService = instrumentCombatService(new CombatStateReadService(), {
  getActiveCombatStateById: {
    stage: "repository_read_active",
  },
  getArchivedCombatRoundsById: {
    stage: "repository_read_archives",
  },
  getCombatHistorySourceById: {
    stage: "repository_read_history_source",
  },
  getEncounterMetadataById: {
    stage: "repository_read_metadata",
  },
  getFullEncounterById: {
    broadEncounterRead: true,
    stage: "repository_read_full_encounter",
    summarizeEncounter: true,
  },
});
const encounterService = instrumentCombatService(new EncounterService(), {
  getEncounterById: {
    broadEncounterRead: true,
    stage: "repository_read_full_encounter",
    summarizeEncounter: true,
  },
  updateCombatEncounter: {
    stage: "repository_write_transaction",
    summarizeEncounter: true,
  },
  updateScenarioParticipantState: {
    stage: "repository_write_participant",
  },
});
const scenarioService = instrumentCombatService(new ScenarioService(), {
  getScenarioById: {
    stage: "repository_read_scenario",
  },
  listScenarioParticipants: {
    stage: "repository_read_participants",
  },
  recordScenarioEvent: {
    stage: "repository_write_scenario_event",
  },
  userHasPlayerScenarioAccess: {
    stage: "repository_read_player_access",
  },
});

function buildObservationRollBasis(input: {
  contributions: readonly CombatModifierContribution[];
  context: CombatCalculationContext;
  profile: NonNullable<ReturnType<typeof resolveCombatObservationSkillProfile>>;
}) {
  const general = resolveCombatModifierContributions({
    bucket: "general_fatigue",
    context: input.context,
    contributions: input.contributions,
  });
  const skill = resolveCombatModifierContributions({
    bucket: "skill_ob",
    context: input.context,
    contributions: input.contributions,
  });
  const trace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: input.profile.baseValue,
    rawModifiers: [
      { label: "General/Fatigue", value: general.total },
      { label: "Skill/OB", value: skill.total },
    ],
  });
  if (!trace) {
    throw new RangeError("Observation modifiers are outside the canonical workbook table.");
  }
  return {
    appliedModifiers: [
      ...general.rows.map((row) => ({
        bucket: "general_fatigue" as const,
        label: row.label,
        sourceId: row.sourceId,
        value: row.value,
      })),
      ...skill.rows.map((row) => ({
        bucket: "skill_ob" as const,
        label: row.label,
        sourceId: row.sourceId,
        value: row.value,
      })),
    ],
    baseValue: input.profile.baseValue,
    effectiveSkillValue: trace.finalValue,
    intelligenceValue: input.profile.intelligenceValue,
    intelligenceXp: input.profile.intelligenceXp,
    percentageAdjustment: trace.percentageAdjustment,
    percentageModifierTotal: trace.rawModifierTotal,
    skillId: input.profile.skillId,
    skillLabel: input.profile.skillLabel,
    skillXp: input.profile.skillXp,
  };
}

type ApiCombatObservationRollContext =
  | {
      kind: "ready";
      observerBasis: ReturnType<typeof buildObservationRollBasis>;
      targetBasis: ReturnType<typeof buildObservationRollBasis>;
    }
  | {
      kind: "stopped";
      reason: "observation_review_required" | "target_invalid";
    };

/** Resolves one exact Observe contest entirely from canonical server-owned combat facts. */
function resolveApiCombatObservationRollContext(input: {
  encounter: EncounterSession;
  observerParticipantId: string;
  observationAttemptId: string;
  relationshipId: string;
  scenarioParticipants: readonly ScenarioParticipant[];
  state: CombatRoundState;
  targetParticipantId: string;
}): ApiCombatObservationRollContext {
  const observerEncounterParticipant = input.encounter.participants.find(
    (participant) => participant.id === input.observerParticipantId,
  );
  const targetEncounterParticipant = input.encounter.participants.find(
    (participant) => participant.id === input.targetParticipantId,
  );
  const scenarioParticipants = [...input.scenarioParticipants];
  const observer = findScenarioParticipantForEncounterParticipant({
    encounterParticipant: observerEncounterParticipant,
    scenarioParticipants,
  });
  const target = findScenarioParticipantForEncounterParticipant({
    encounterParticipant: targetEncounterParticipant,
    scenarioParticipants,
  });
  if (!targetEncounterParticipant || !target?.isActive) {
    return { kind: "stopped", reason: "target_invalid" };
  }
  if (!observerEncounterParticipant || !observer?.isActive) {
    return { kind: "stopped", reason: "observation_review_required" };
  }
  const pending = getPendingCombatObservationAttempts(input.state).find(
    (attempt) =>
      attempt.attemptId === input.observationAttemptId &&
      attempt.observerParticipantId === input.observerParticipantId &&
      attempt.relationshipId === input.relationshipId &&
      attempt.targetParticipantId === input.targetParticipantId,
  );
  if (!pending) return { kind: "stopped", reason: "observation_review_required" };

  const observerProfile = resolveCombatObservationSkillProfile({
    ...getScenarioParticipantFeintSkillInput(observer),
    skills: defaultCanonicalContent.skills,
  });
  const targetProfile = resolveCombatObservationSkillProfile({
    ...getScenarioParticipantFeintSkillInput(target),
    skills: defaultCanonicalContent.skills,
  });
  if (!observerProfile || !targetProfile) {
    return { kind: "stopped", reason: "observation_review_required" };
  }

  const observerModifierProjection = buildLiveCombatModifierContributionProjection({
    combatContext: observer.state.combat.combatContext,
    combatEffects: observer.state.combatEffects,
    currentRound: input.state.roundNumber,
    encounterId: input.encounter.id,
    ownerParticipantId: observer.id,
  });
  const targetModifierProjection = buildLiveCombatModifierContributionProjection({
    combatContext: target.state.combat.combatContext,
    combatEffects: target.state.combatEffects,
    currentRound: input.state.roundNumber,
    encounterId: input.encounter.id,
    ownerParticipantId: target.id,
  });
  const observerObservationContributions = buildCombatObservationModifierContributions({
    encounterId: input.encounter.id,
    observerCombatantId: observerEncounterParticipant.id,
    observerParticipantId: observer.id,
    opponentCombatantId: targetEncounterParticipant.id,
    opponentParticipantId: target.id,
    relationships: input.state.observationRelationships,
  });
  const targetObservationContributions = buildCombatObservationModifierContributions({
    encounterId: input.encounter.id,
    observerCombatantId: targetEncounterParticipant.id,
    observerParticipantId: target.id,
    opponentCombatantId: observerEncounterParticipant.id,
    opponentParticipantId: observer.id,
    relationships: input.state.observationRelationships,
  });
  const observationContext = (contextInput: {
    ownerParticipantId: string;
    opponentParticipantId: string;
    skillId: string;
  }): CombatCalculationContext => ({
    actionId: "observe_opponent",
    encounterId: input.encounter.id,
    ownerParticipantId: contextInput.ownerParticipantId,
    opponentParticipantId: contextInput.opponentParticipantId,
    pairKey: createCombatParticipantPairKey(
      contextInput.ownerParticipantId,
      contextInput.opponentParticipantId,
    ),
    rollPurpose: "observe_opponent",
    rollType: "observation",
    roundNumber: input.state.roundNumber,
    skillId: contextInput.skillId,
    step: "round_summary",
  });

  try {
    return {
      kind: "ready",
      observerBasis: buildObservationRollBasis({
        context: observationContext({
          ownerParticipantId: observer.id,
          opponentParticipantId: target.id,
          skillId: observerProfile.skillId,
        }),
        contributions: [
          ...observerModifierProjection.contributions,
          ...observerObservationContributions,
        ],
        profile: observerProfile,
      }),
      targetBasis: buildObservationRollBasis({
        context: observationContext({
          ownerParticipantId: target.id,
          opponentParticipantId: observer.id,
          skillId: targetProfile.skillId,
        }),
        contributions: [
          ...targetModifierProjection.contributions,
          ...targetObservationContributions,
        ],
        profile: targetProfile,
      }),
    };
  } catch {
    return { kind: "stopped", reason: "observation_review_required" };
  }
}

function parseInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }

  return value;
}

function parseIntegerInRange(value: unknown, label: string, min: number, max: number): number {
  const parsed = parseInteger(value, label);

  if (parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }

  return parsed;
}

function computeDieResult(rollD20: number, openEndedD10s: number[]): number {
  if (openEndedD10s.length === 0) return rollD20;
  const direction = rollD20 === 20 ? 1 : rollD20 === 1 ? -1 : 0;
  return rollD20 + direction * openEndedD10s.reduce((sum, d10) => sum + d10, 0);
}

async function getCombatExperienceSkillLookupForScenarioParticipant(
  participant: ScenarioParticipant,
) {
  if (!participant.characterId) {
    return getParticipantCombatExperienceSkillTotalLookup(participant);
  }

  const character = await characterService.getCharacterById(participant.characterId);
  const sheetSummary = character
    ? buildCharacterSheetSummary({
        build: character.build,
        content: defaultCanonicalContent,
      })
    : undefined;

  if (!sheetSummary) {
    return getParticipantCombatExperienceSkillTotalLookup(participant);
  }

  return getParticipantCombatExperienceSkillTotalLookup({
    ...participant,
    sheetSummary,
  });
}

function getScenarioParticipantFeintSkillInput(participant: ScenarioParticipant) {
  const build = characterBuildSchema.safeParse(participant.snapshot.build);
  const sheetSummary = build.success
    ? buildCharacterSheetSummary({
        build: build.data,
        content: defaultCanonicalContent,
      })
    : participant.snapshot.sheetSummary;

  return {
    build: build.success ? build.data : participant.snapshot,
    content: defaultCanonicalContent,
    participantId: participant.id,
    participantName: participant.snapshot.displayName,
    sheetSummary,
  };
}

function getScenarioParticipantRoundEndSheetFacts(participant: ScenarioParticipant): {
  dodgeSkillLabel?: string;
  dodgeSkillXp?: number;
  dodgeSkillTotal?: number;
  dodgeStatLabel?: string;
  dodgeStatValue?: number;
  healthStat?: number;
} {
  const build = characterBuildSchema.safeParse(participant.snapshot.build);
  if (!build.success) return {};

  const dodgeSkill = defaultCanonicalContent.skills.find((skill) => skill.id === "dodge");
  const dodgeProfile = dodgeSkill
    ? resolveParticipantSkillRollProfile({
        ...getScenarioParticipantFeintSkillInput(participant),
        linkedStatsOverride: ["dex"],
        preferAdjustedStats: true,
        skill: dodgeSkill,
      })
    : undefined;

  return {
    dodgeSkillLabel: dodgeProfile?.skillName ?? "Dodge",
    dodgeSkillXp: dodgeProfile?.totalXP,
    dodgeSkillTotal: dodgeProfile
      ? dodgeProfile.avgStats + dodgeProfile.totalXP + dodgeProfile.unknownSkillPenalty
      : undefined,
    dodgeStatLabel: "Dexterity",
    dodgeStatValue: dodgeProfile?.avgStats,
    healthStat: buildCharacterSheetSummary({
      build: build.data,
      content: defaultCanonicalContent,
    }).adjustedStats.health,
  };
}

function getScenarioParticipantDodgeSkillValue(
  participant: ScenarioParticipant,
): number | undefined {
  const build = characterBuildSchema.safeParse(participant.snapshot.build);
  if (!build.success) return undefined;
  const sheet = buildCharacterSheetSummary({
    build: build.data,
    content: defaultCanonicalContent,
  });
  const dodge = sheet.draftView.skills.find((skill) => skill.skillId === "dodge");
  return dodge?.effectiveSkillNumber;
}

function buildRoundEndParticipantInputs(input: {
  encounter: EncounterSession;
  roundState: CombatRoundState;
  scenarioParticipants: ScenarioParticipant[];
}) {
  return Object.fromEntries(
    input.roundState.participants.flatMap((roundParticipant) => {
      const encounterParticipant = input.encounter.participants.find((candidate) =>
        participantAliasesInclude({ id: roundParticipant.participantId, participant: candidate }),
      );
      const scenarioParticipant = findScenarioParticipantForEncounterParticipant({
        encounterParticipant,
        scenarioParticipants: input.scenarioParticipants,
      });
      if (!scenarioParticipant) return [];

      const sheetFacts = getScenarioParticipantRoundEndSheetFacts(scenarioParticipant);
      const modifierProjection = buildLiveCombatModifierContributionProjection({
        combatContext: scenarioParticipant.state.combat.combatContext,
        combatEffects: scenarioParticipant.state.combatEffects,
        currentRound: input.roundState.roundNumber,
        encounterId: input.encounter.id,
        ownerParticipantId: scenarioParticipant.id,
      });
      const hasAuthoritativeModifierSource =
        scenarioParticipant.state.combatEffects !== undefined ||
        Object.values(scenarioParticipant.state.combat.combatContext?.modifierBuckets ?? {}).some(
          (entries) => entries.length > 0,
        );
      const movementBurden = resolveScenarioParticipantMovementBurden(scenarioParticipant);
      const readinessReasons: CombatRoundEndDistanceCalculationReadiness["reasons"] = [
        ...(sheetFacts.dodgeSkillTotal === undefined ? (["dodge_facts"] as const) : []),
        ...(sheetFacts.dodgeStatValue === undefined ? (["dexterity_facts"] as const) : []),
        ...(movementBurden.completeness !== "complete" ? (["movement_modifier"] as const) : []),
      ];
      const calculationReadiness: CombatRoundEndDistanceCalculationReadiness = {
        completeness: readinessReasons.length === 0 ? "complete" : "incomplete",
        reasons: readinessReasons,
        schemaVersion: 1,
      };
      return [
        [
          roundParticipant.participantId,
          {
            combatEffects: scenarioParticipant.state.combatEffects,
            distanceControl: {
              calculationReadiness,
              dodgeSkillLabel: sheetFacts.dodgeSkillLabel,
              dodgeSkillXp: sheetFacts.dodgeSkillXp,
              dodgeSkillTotal: sheetFacts.dodgeSkillTotal,
              dodgeStatLabel: sheetFacts.dodgeStatLabel,
              dodgeStatValue: sheetFacts.dodgeStatValue,
              ...(hasAuthoritativeModifierSource
                ? {
                    modifierContributions: modifierProjection.contributions,
                    modifierEncounterId: input.encounter.id,
                    modifierOwnerParticipantId: scenarioParticipant.id,
                  }
                : {}),
              warnings:
                sheetFacts.dodgeSkillTotal === undefined
                  ? ["Dodge total unavailable in participant snapshot."]
                  : [],
            },
            healthStat: sheetFacts.healthStat,
          },
        ],
      ];
    }),
  );
}

function buildRoundEndDistanceControlInputs(input: {
  encounter: EncounterSession;
  roundState: CombatRoundState;
  scenarioParticipants: ScenarioParticipant[];
}) {
  const participantInputs = buildRoundEndParticipantInputs(input);
  return Object.fromEntries(
    Object.entries(participantInputs).map(([participantId, participantInput]) => [
      participantId,
      participantInput.distanceControl,
    ]),
  );
}

function resolveAdjustDistanceSkillContestCalculation(input: {
  calculationId: string;
  contestType: Extract<
    CombatSkillContestType,
    "adjust_distance_attack" | "break_off" | "round_end_adjust_distance"
  >;
  encounterId: string;
  gmAdjustment?: number;
  modifierContributions?: readonly CombatModifierContribution[];
  opponentCombatantId: string;
  opponentLabel?: string;
  opponentScenarioParticipantId?: string;
  participant: ScenarioParticipant;
  participantCombatantId: string;
  proposalId: string;
  role: CombatSkillContestRole;
  roll: ReturnType<typeof rollOpenEndedD20>;
  roundNumber: number;
  roundState: CombatRoundState;
  step: "phase_1_actions" | "round_summary";
}) {
  const dodgeSkill = defaultCanonicalContent.skills.find((skill) => skill.id === "dodge");
  if (!dodgeSkill) {
    throw new RangeError("Dodge skill is unavailable.");
  }
  const profile = resolveParticipantSkillRollProfile({
    ...getScenarioParticipantFeintSkillInput(input.participant),
    linkedStatsOverride: ["dex"],
    preferAdjustedStats: true,
    skill: dodgeSkill,
  });
  const movementBurden = resolveScenarioParticipantMovementBurden(input.participant);
  const movementApplicability = getCombatMovementModifierApplicability(input.contestType);
  const context: CombatCalculationContext = {
    actionId: input.contestType === "break_off" ? "break_off_engagement" : "adjust_range_attack",
    encounterId: input.encounterId,
    ownerParticipantId: input.participant.id,
    opponentParticipantId: input.opponentScenarioParticipantId,
    pairKey: input.opponentScenarioParticipantId
      ? createCombatParticipantPairKey(input.participant.id, input.opponentScenarioParticipantId)
      : undefined,
    proposalId: input.proposalId,
    rollType:
      input.contestType === "break_off"
        ? "break_off_dodge"
        : input.contestType === "adjust_distance_attack"
          ? "adjust_distance_dodge"
          : "round_end_distance_dodge",
    roundNumber: input.roundNumber,
    skillId: "dodge",
    step: input.step,
    ...(input.step === "phase_1_actions" ? { phase: "phase1" as const } : {}),
  };
  const observationRelationshipIds = new Set(
    input.roundState.observationRelationships.map((relationship) => relationship.id),
  );
  const modifierResolution = resolveCombatDodgeModifiers({
    context,
    // Weapon Resolution publishes Observe as Skill/OB and DB/Parry rows. A
    // Skill Contest selects its one role-aware relationship contribution below
    // instead of inheriting either weapon bucket generically.
    contributions: (input.modifierContributions ?? []).filter(
      (contribution) => !observationRelationshipIds.has(contribution.sourceId ?? ""),
    ),
  });
  const observation = buildCombatObservationSkillContestContribution({
    contestType: input.contestType,
    observerCombatantId: input.participantCombatantId,
    opponentCombatantId: input.opponentCombatantId,
    relationships: input.roundState.observationRelationships,
    role: input.role,
  });
  const percentageContributions = [
    ...modifierResolution.rows
      .filter((row) => row.value !== 0)
      .map((row) => ({
        category: row.bucket === "skill_ob" ? ("skill_ob" as const) : ("general_fatigue" as const),
        id: row.id,
        label: row.label,
        provenance: row.sourceKind,
        sourceId: row.sourceId,
        unit: "percentage" as const,
        value: row.value,
      })),
    ...(observation
      ? [
          {
            ...observation,
            label: input.opponentLabel
              ? `${observation.label} · ${input.opponentLabel}`
              : observation.label,
          },
        ]
      : []),
    ...(movementApplicability === "required" &&
    movementBurden.completeness === "complete" &&
    movementBurden.finalMovementModifier !== undefined
      ? [
          {
            category: "movement_mm" as const,
            id: `${input.proposalId}:${input.participantCombatantId}:movement-mm`,
            label: "Movement Modifier",
            provenance: movementBurden.sourceSnapshotId,
            sourceId: movementBurden.sourceSnapshotId,
            unit: "percentage" as const,
            value: -movementBurden.finalMovementModifier,
          },
        ]
      : []),
    ...(input.gmAdjustment
      ? [
          {
            category: "gm_adjustment" as const,
            id: `${input.proposalId}:${input.participantCombatantId}:gm-adjustment`,
            label:
              input.contestType === "break_off"
                ? "GM Break Off adjustment"
                : "GM maneuver adjustment",
            provenance:
              input.contestType === "break_off"
                ? "Accepted Break Off review"
                : "Accepted Adjust Distance review",
            sourceId: input.proposalId,
            unit: "percentage" as const,
            value: input.gmAdjustment,
          },
        ]
      : []),
  ];

  return resolveCombatSkillContest({
    baseSkillAdjustment: profile.unknownSkillPenalty,
    calculationId: input.calculationId,
    contestType: input.contestType,
    governingStat: {
      id: "dex",
      label: "Dexterity",
      value: profile.avgStats,
    },
    missingContributionPoints:
      movementApplicability === "required" && movementBurden.completeness !== "complete"
        ? ["movement_mm"]
        : [],
    movementBurden,
    opponentParticipantId: input.opponentCombatantId,
    participantId: input.participantCombatantId,
    percentageContributions,
    role: input.role,
    roll: input.roll,
    skill: {
      id: profile.skillId,
      label: profile.skillName,
      totalXp: profile.totalXP,
    },
  });
}

function resolveFeintSkillContestCalculation(input: {
  calculationId: string;
  encounterId: string;
  isAttacker: boolean;
  modifierContributions: readonly CombatModifierContribution[];
  opponentCombatantId: string;
  opponentScenarioParticipantId?: string;
  participant: ScenarioParticipant;
  participantCombatantId: string;
  proposal: CombatFeintProposal;
  roll: ReturnType<typeof rollOpenEndedD20>;
  roundState: CombatRoundState;
  skillId: string;
}) {
  const skill = defaultCanonicalContent.skills.find((candidate) => candidate.id === input.skillId);
  if (!skill) throw new RangeError("The selected feint skill is unavailable.");
  const characteristic = input.isAttacker ? ("dex" as const) : ("int" as const);
  const profile = resolveCombatFeintSkillProfile({
    ...getScenarioParticipantFeintSkillInput(input.participant),
    characteristic,
    skill,
  });
  const context: CombatCalculationContext = {
    actionId: "feint_attack",
    encounterId: input.encounterId,
    opportunityId: input.proposal.phase1OpportunityId,
    ownerParticipantId: input.participant.id,
    opponentParticipantId: input.opponentScenarioParticipantId,
    pairKey: input.opponentScenarioParticipantId
      ? createCombatParticipantPairKey(input.participant.id, input.opponentScenarioParticipantId)
      : undefined,
    phase: "phase1",
    proposalId: input.proposal.id,
    rollType: input.proposal.method === "movement" ? "feint_dodge" : "feint_weapon",
    roundNumber: input.roundState.roundNumber,
    skillId: input.skillId,
    step: "phase_1_actions",
  };
  const observationRelationshipIds = new Set(
    input.roundState.observationRelationships.map((relationship) => relationship.id),
  );
  const nonObservationContributions = input.modifierContributions.filter(
    (contribution) => !observationRelationshipIds.has(contribution.sourceId ?? ""),
  );
  const resolvedRows = [
    ...resolveCombatModifierContributions({
      bucket: "general_fatigue",
      context,
      contributions: nonObservationContributions,
    }).rows,
    ...resolveCombatModifierContributions({
      bucket: "skill_ob",
      context,
      contributions: nonObservationContributions,
    }).rows,
  ];
  const percentageContributions = [
    ...resolvedRows
      .filter((row) => row.value !== 0)
      .map((row) => ({
        category: row.bucket === "skill_ob" ? ("skill_ob" as const) : ("general_fatigue" as const),
        id: row.id,
        label: row.label,
        provenance: row.sourceKind,
        sourceId: row.sourceId,
        unit: "percentage" as const,
        value: row.value,
      })),
  ];

  return resolveCombatFeintSkillContest({
    calculationId: input.calculationId,
    governingStatValue: profile.avgStats,
    gmAdjustment: input.isAttacker ? input.proposal.feasibilityAdjustment : 0,
    method: input.proposal.method,
    observationRelationships: input.roundState.observationRelationships,
    opponentParticipantId: input.opponentCombatantId,
    participantId: input.participantCombatantId,
    percentageContributions,
    roll: input.roll,
    side: input.isAttacker ? "initiator" : "defender",
    skill: {
      id: profile.skillId,
      label: profile.skillName,
      totalXp: profile.totalXP,
    },
    unknownSkillPenalty: profile.unknownSkillPenalty,
  });
}

function resolveOffensiveParryBrawlingSkillContestCalculation(input: {
  calculationId: string;
  encounterId: string;
  modifierContributions: readonly CombatModifierContribution[];
  opponentCombatantId: string;
  opponentScenarioParticipantId?: string;
  participant: ScenarioParticipant;
  participantCombatantId: string;
  parryQualityModifier?: number;
  phase?: CombatRoundPhase;
  purpose: "initial_offensive_parry" | "continued_contact_maintenance";
  roll: ReturnType<typeof rollOpenEndedD20>;
  roundState: CombatRoundState;
  side: "controller" | "responder";
}) {
  const brawlingSkill = defaultCanonicalContent.skills.find((skill) => skill.id === "brawling");
  if (!brawlingSkill) {
    throw new RangeError("Brawling skill definition is unavailable.");
  }
  const profile = resolveParticipantSkillRollProfile({
    ...getScenarioParticipantFeintSkillInput(input.participant),
    skill: brawlingSkill,
  });
  const context: CombatCalculationContext = {
    actionId: "offensive_parry",
    encounterId: input.encounterId,
    ownerParticipantId: input.participant.id,
    opponentParticipantId: input.opponentScenarioParticipantId,
    pairKey: input.opponentScenarioParticipantId
      ? createCombatParticipantPairKey(input.participant.id, input.opponentScenarioParticipantId)
      : undefined,
    phase: input.phase,
    rollPurpose:
      input.purpose === "continued_contact_maintenance" && input.side === "responder"
        ? "escape_continued_contact"
        : input.purpose === "initial_offensive_parry"
          ? "offensive_parry_brawling"
          : undefined,
    rollType: "brawling",
    roundNumber: input.roundState.roundNumber,
    skillId: "brawling",
    step:
      input.purpose === "continued_contact_maintenance"
        ? "round_summary"
        : getCombatRoundParryReviewStepForPhase(input.phase ?? "phase1"),
  };
  const observationRelationshipIds = new Set(
    input.roundState.observationRelationships.map((relationship) => relationship.id),
  );
  const nonObservationContributions = input.modifierContributions.filter(
    (contribution) => !observationRelationshipIds.has(contribution.sourceId ?? ""),
  );
  const generalRows = resolveCombatModifierContributions({
    bucket: "general_fatigue",
    context,
    contributions: nonObservationContributions,
  }).rows;

  return resolveCombatOffensiveParryBrawling({
    calculationId: input.calculationId,
    characteristicAverage: profile.avgStats,
    observationRelationships: input.roundState.observationRelationships,
    opponentParticipantId: input.opponentCombatantId,
    participantId: input.participantCombatantId,
    parryQualityModifier: input.parryQualityModifier,
    percentageContributions: generalRows
      .filter((row) => row.value !== 0)
      .map((row) => ({
        category: "general_fatigue" as const,
        id: row.id,
        label: row.label,
        provenance: row.sourceKind,
        sourceId: row.sourceId,
        unit: "percentage" as const,
        value: row.value,
      })),
    purpose: input.purpose,
    roll: input.roll,
    side: input.side,
    skill: {
      id: profile.skillId,
      label: profile.skillName,
      totalXp: profile.totalXP,
    },
    unknownSkillPenalty: profile.unknownSkillPenalty,
  });
}

function buildRoundEndDistanceRollResult(input: {
  calculation: ReturnType<typeof resolveAdjustDistanceSkillContestCalculation>;
  createdAt: string;
  createdByUserId?: string;
  rolledAtRound: number;
  rolledBy: "player" | "gm_proxy";
}): CombatRoundEndDistanceRollResult {
  const generalFatigueModifier = input.calculation.percentageContributions
    .filter((contribution) => contribution.category === "general_fatigue")
    .reduce((total, contribution) => total + contribution.value, 0);
  return combatRoundEndDistanceRollResultSchema.parse({
    dodgeSkillTotal: input.calculation.baseSkill,
    finalTotal: input.calculation.finalResult,
    generalFatigueModifier,
    openEndedD10s: input.calculation.openEndedDie.openEndedD10s,
    rolledAt: input.createdAt,
    rolledAtRound: input.rolledAtRound,
    rolledBy: input.rolledBy,
    rolledByUserId: input.createdByUserId,
    rollD20: input.calculation.openEndedDie.rollD20,
    rollTotal: input.calculation.openEndedDie.rollTotal,
    skillContestCalculation: input.calculation,
  });
}

function getRoundEndAdjustDistanceRole(input: {
  participantId: string;
  proposal: CombatRoundEndDistanceProposal;
}): CombatSkillContestRole {
  const ownSide =
    input.proposal.participantAId === input.participantId
      ? input.proposal.participantA
      : input.proposal.participantBId === input.participantId
        ? input.proposal.participantB
        : undefined;
  const opponentSide =
    input.proposal.participantAId === input.participantId
      ? input.proposal.participantB
      : input.proposal.participantBId === input.participantId
        ? input.proposal.participantA
        : undefined;
  if (!ownSide || !opponentSide) {
    throw new RangeError("Participant is not part of the distance-control proposal.");
  }
  if (ownSide.desiredDistance !== undefined && opponentSide.desiredDistance === undefined) {
    return "initiator";
  }
  if (ownSide.desiredDistance === undefined && opponentSide.desiredDistance !== undefined) {
    return "resisting_opponent";
  }
  // When both participants declare different distances the archived process does
  // not identify one canonical initiator. Treat both as contestants rather than
  // inventing directional Observe applicability.
  return "contestant";
}

function parseRollFields(
  roll: Record<string, unknown>,
  prefix: string,
): { dieResult: number; openEndedD10s: number[]; rollD20: number } {
  const rollD20 = parseIntegerInRange(roll.rollD20, `${prefix}.rollD20`, 1, 20);
  const openEndedD10sValue = roll.openEndedD10s;
  const openEndedD10s = Array.isArray(openEndedD10sValue)
    ? openEndedD10sValue.map((entry, index) =>
        parseIntegerInRange(entry, `${prefix}.openEndedD10s[${index}]`, 1, 10),
      )
    : [];
  return { dieResult: computeDieResult(rollD20, openEndedD10s), openEndedD10s, rollD20 };
}

function parsePlayerRollBody(body: unknown): {
  acceptAutomaticSuccess: boolean;
  expectedRevision?: string;
  pendingRollId: string;
  roll?: {
    dieResult: number;
    openEndedD10s: number[];
    rollD20: number;
  };
  supportRoll?: {
    dieResult: number;
    openEndedD10s: number[];
    rollD20: number;
  };
} {
  const value = parseBodyObject(body, "Player roll payload");
  const pendingRollId = value.pendingRollId;
  const rollValue = value.roll;

  if (typeof pendingRollId !== "string" || pendingRollId.trim().length === 0) {
    throw new Error("pendingRollId is required.");
  }

  const acceptAutomaticSuccess = value.acceptAutomaticSuccess === true;

  if ((!rollValue || typeof rollValue !== "object") && !acceptAutomaticSuccess) {
    throw new Error("roll is required unless accepting an automatic success.");
  }

  const supportRollValue = value.supportRoll;
  const supportRoll =
    supportRollValue && typeof supportRollValue === "object"
      ? (supportRollValue as Record<string, unknown>)
      : undefined;

  return {
    acceptAutomaticSuccess,
    expectedRevision:
      typeof value.expectedRevision === "string" && value.expectedRevision.length > 0
        ? value.expectedRevision
        : undefined,
    pendingRollId,
    roll: rollValue ? parseRollFields(rollValue as Record<string, unknown>, "roll") : undefined,
    supportRoll: supportRoll ? parseRollFields(supportRoll, "supportRoll") : undefined,
  };
}

function parseRoleplayStatCheckAssignmentBody(body: unknown): {
  difficulty: RoleplayDifficulty;
  expectedRevision: string;
  participantId: string;
  statId: GlantriCharacteristicKey;
} {
  const value = parseBodyObject(body, "Stat check assignment payload");

  if (typeof value.expectedRevision !== "string" || value.expectedRevision.length === 0) {
    throw new Error("expectedRevision is required.");
  }
  if (typeof value.participantId !== "string" || value.participantId.length === 0) {
    throw new Error("participantId is required.");
  }

  return {
    difficulty: roleplayDifficultySchema.parse(value.difficulty),
    expectedRevision: value.expectedRevision,
    participantId: value.participantId,
    statId: glantriCharacteristicKeySchema.parse(value.statId),
  };
}

type GenericCombatActionOperation =
  | "declare"
  | "review"
  | "activate"
  | "roll"
  | "resolve"
  | "interrupt"
  | "cancel";

interface GenericCombatActionBody {
  actionId: string;
  difficulty?: number;
  duration?: CombatGenericActionDuration;
  environmentDescription?: string;
  expectedRevision: string;
  intent?: string;
  itemId?: string;
  operation: GenericCombatActionOperation;
  participantId?: string;
  preset?: "look_around";
  referenceKind?: "none" | "participant" | "item" | "environment";
  referenceParticipantId?: string;
  resultText?: string;
  rollKind?: "none" | "skill" | "stat";
  skillId?: string;
  statId?: GlantriCharacteristicKey;
  visibleToParticipantIds: string[];
}

function parseGenericCombatActionBody(body: unknown): GenericCombatActionBody {
  const value = parseBodyObject(body, "Generic Combat action payload");
  const operation = value.operation;
  const actionId = value.actionId;
  const expectedRevision = value.expectedRevision;
  if (
    operation !== "declare" &&
    operation !== "review" &&
    operation !== "activate" &&
    operation !== "roll" &&
    operation !== "resolve" &&
    operation !== "interrupt" &&
    operation !== "cancel"
  ) {
    throw new Error("Choose a valid Combat action operation.");
  }
  if (typeof actionId !== "string" || actionId.trim().length === 0) {
    throw new Error("actionId is required.");
  }
  if (typeof expectedRevision !== "string" || expectedRevision.length === 0) {
    throw new Error("expectedRevision is required.");
  }
  const rollKind =
    value.rollKind === "none" || value.rollKind === "skill" || value.rollKind === "stat"
      ? value.rollKind
      : undefined;
  const difficulty =
    value.difficulty === undefined
      ? undefined
      : parseIntegerInRange(value.difficulty, "Difficulty", 1, 200);
  if (rollKind && rollKind !== "none" && difficulty === undefined) {
    throw new Error("A numeric Difficulty is required for a Combat action roll.");
  }
  const visibleToParticipantIds = Array.isArray(value.visibleToParticipantIds)
    ? value.visibleToParticipantIds.filter(
        (entry): entry is string => typeof entry === "string" && entry.length > 0,
      )
    : [];
  const referenceKind =
    value.referenceKind === "none" ||
    value.referenceKind === "participant" ||
    value.referenceKind === "item" ||
    value.referenceKind === "environment"
      ? value.referenceKind
      : undefined;

  return {
    actionId: actionId.trim(),
    difficulty,
    duration: value.duration ? combatGenericActionDurationSchema.parse(value.duration) : undefined,
    environmentDescription: parseOptionalDeclarationString(value.environmentDescription),
    expectedRevision,
    intent: parseOptionalDeclarationString(value.intent),
    itemId: parseOptionalDeclarationString(value.itemId),
    operation,
    participantId: parseOptionalDeclarationString(value.participantId),
    preset: value.preset === "look_around" ? "look_around" : undefined,
    referenceKind,
    referenceParticipantId: parseOptionalDeclarationString(value.referenceParticipantId),
    resultText: parseOptionalDeclarationString(value.resultText),
    rollKind,
    skillId: parseOptionalDeclarationString(value.skillId),
    statId:
      value.statId === undefined ? undefined : glantriCharacteristicKeySchema.parse(value.statId),
    visibleToParticipantIds: [...new Set(visibleToParticipantIds)],
  };
}

function parseOptionalDeclarationString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function parseFeintTargetParticipantId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Select a target for the Feint.");
  }
  return value.trim();
}

function parseCombatDeclarationPhaseWeaponNames(
  value: unknown,
): Partial<Record<"phase1" | "phase2", string | undefined>> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const phase1 = parseOptionalDeclarationString(record.phase1);
  const phase2 = parseOptionalDeclarationString(record.phase2);

  return phase1 || phase2 ? { phase1, phase2 } : undefined;
}

function parseCombatDeclarationPhaseAttackSources(
  value: unknown,
): Partial<Record<"phase1" | "phase2", CombatAttackSourceRef>> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const parseSource = (source: unknown): CombatAttackSourceRef | undefined =>
    source === undefined ? undefined : combatAttackSourceRefSchema.parse(source);
  const phase1 = parseSource(record.phase1);
  const phase2 = parseSource(record.phase2);
  return phase1 || phase2 ? { phase1, phase2 } : undefined;
}

interface ParsedCombatTaskCommandIdentity {
  executionGroupId: string;
  expectedRevision: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
  taskId: string;
}

class CombatCommandRequestError extends Error {
  readonly code: "boundary_mismatch" | "identity_mismatch";

  constructor(code: "boundary_mismatch" | "identity_mismatch", message: string) {
    super(message);
    this.code = code;
    this.name = "CombatCommandRequestError";
  }
}

function parseCombatTaskCommandIdentity(
  value: Record<string, unknown>,
): ParsedCombatTaskCommandIdentity {
  return {
    executionGroupId: parseNonEmptyString(value.executionGroupId, "executionGroupId"),
    expectedRevision: parseNonEmptyString(value.expectedRevision, "expectedRevision"),
    initiativeGroupId:
      typeof value.initiativeGroupId === "string" && value.initiativeGroupId.trim()
        ? value.initiativeGroupId
        : undefined,
    initiativeValue:
      typeof value.initiativeValue === "number" && Number.isInteger(value.initiativeValue)
        ? value.initiativeValue
        : undefined,
    taskId: parseNonEmptyString(value.taskId, "taskId"),
  };
}

function authorizeCombatTaskCommand(input: {
  authorization: Omit<
    Parameters<typeof authorizeCombatProgressionTask>[0],
    "executionGroupId" | "projection" | "taskId"
  >;
  encounterRevision: string;
  identity: ParsedCombatTaskCommandIdentity;
  projection?: ReturnType<typeof buildCombatProgressionProjection>;
  roundState: CombatRoundState;
}) {
  return measureCombatPerformanceStage("descriptor_projection_and_authorization", () => {
    if (input.identity.expectedRevision !== input.encounterRevision) {
      return {
        code: "stale_revision" as const,
        message: "Combat state changed before this task could be completed.",
        ok: false as const,
      };
    }
    return authorizeCombatProgressionTask({
      ...input.authorization,
      executionGroupId: input.identity.executionGroupId,
      initiativeGroupId: input.identity.initiativeGroupId,
      initiativeValue: input.identity.initiativeValue,
      projection: input.projection ?? buildCombatProgressionProjection(input.roundState),
      taskId: input.identity.taskId,
    });
  });
}

function sendCombatWriteError(reply: FastifyReply, error: unknown): unknown | undefined {
  if (!(error instanceof EncounterCombatWriteError)) {
    return undefined;
  }

  if (error.code === "transaction_conflict") {
    return reply.code(409).send({
      code: "transaction_conflict",
      error: "Combat state changed while saving. Refresh and try again.",
    });
  }

  return reply.code(409).send({
    code: "stale_revision",
    error: "Combat state changed before this task could be completed.",
  });
}

function sendRoleplayStatWriteError(reply: FastifyReply, error: unknown): unknown | undefined {
  if (!(error instanceof EncounterWriteError)) {
    return undefined;
  }

  return reply.code(409).send({
    code: "stale_revision",
    error: "This Stat check changed before the result was accepted. Refresh and review it.",
  });
}

function parseCombatDeclarationBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  adjustDistance?: {
    requestedDistance: ReturnType<typeof combatDistanceSchema.parse>;
    targetParticipantId: string;
  };
  actionId?: string;
  additionalActionNotes?: string;
  combatContext: ReturnType<typeof scenarioParticipantCombatContextSchema.parse>;
  movementId?: string;
  movementIntent?: MovementIntent;
  expectedParticipantRevision?: string;
  phaseContexts?: ReturnType<typeof combatRoundPhaseContextsSchema.parse>;
  phaseAttackSources?: ReturnType<typeof parseCombatDeclarationPhaseAttackSources>;
  phaseWeaponNames?: Partial<Record<"phase1" | "phase2", string | undefined>>;
  reviewStepSnapshot?: CombatRoundStepSnapshot;
  scenarioParticipantId: string;
  secondaryActionContext?: ReturnType<typeof scenarioParticipantSecondaryActionContextSchema.parse>;
  secondaryActionId?: string;
  feint?: {
    attackerSkillId?: string;
    method: "movement" | "weapon";
    targetParticipantId: string;
  };
  disarm?: {
    actingItemId: string;
    actingItemRevision: string;
    method: "proactive" | "reactive_parry";
    phase: "phase1" | "phase2";
    targetItemId: string;
    targetItemRevision: string;
    targetParticipantId: string;
  };
} {
  const value = parseBodyObject(body, "Combat declaration payload");
  const scenarioParticipantId = value.scenarioParticipantId;
  const taskIdentity = parseCombatTaskCommandIdentity(value);

  if (typeof scenarioParticipantId !== "string" || scenarioParticipantId.trim().length === 0) {
    throw new Error("scenarioParticipantId is required.");
  }

  return {
    adjustDistance:
      value.adjustDistance && typeof value.adjustDistance === "object"
        ? {
            requestedDistance: combatDistanceSchema.parse(
              (value.adjustDistance as Record<string, unknown>).requestedDistance,
            ),
            targetParticipantId: parseFeintTargetParticipantId(
              (value.adjustDistance as Record<string, unknown>).targetParticipantId,
            ),
          }
        : undefined,
    actionId: parseOptionalDeclarationString(value.actionId),
    additionalActionNotes:
      typeof value.additionalActionNotes === "string" ? value.additionalActionNotes : undefined,
    combatContext: scenarioParticipantCombatContextSchema.parse(value.combatContext ?? {}),
    ...taskIdentity,
    movementId: parseOptionalDeclarationString(value.movementId),
    movementIntent: normalizeMovementIntent(value.movementIntent),
    expectedParticipantRevision: parseOptionalDeclarationString(value.expectedParticipantRevision),
    phaseContexts:
      value.phaseContexts === undefined
        ? undefined
        : combatRoundPhaseContextsSchema.parse(value.phaseContexts),
    phaseAttackSources: parseCombatDeclarationPhaseAttackSources(value.phaseAttackSources),
    phaseWeaponNames: parseCombatDeclarationPhaseWeaponNames(value.phaseWeaponNames),
    reviewStepSnapshot:
      value.reviewStepSnapshot === undefined
        ? undefined
        : combatRoundStepSnapshotSchema.parse(value.reviewStepSnapshot),
    scenarioParticipantId,
    secondaryActionContext:
      value.secondaryActionContext === undefined
        ? undefined
        : scenarioParticipantSecondaryActionContextSchema.parse(value.secondaryActionContext),
    secondaryActionId: parseOptionalDeclarationString(value.secondaryActionId),
    feint:
      value.feint && typeof value.feint === "object"
        ? {
            attackerSkillId: parseOptionalDeclarationString(
              (value.feint as Record<string, unknown>).attackerSkillId,
            ),
            method: combatFeintMethodSchema.parse((value.feint as Record<string, unknown>).method),
            targetParticipantId: parseFeintTargetParticipantId(
              (value.feint as Record<string, unknown>).targetParticipantId,
            ),
          }
        : undefined,
    disarm:
      value.disarm && typeof value.disarm === "object"
        ? (() => {
            const disarm = value.disarm as Record<string, unknown>;
            const method =
              disarm.method === "proactive" || disarm.method === "reactive_parry"
                ? disarm.method
                : undefined;
            const phase =
              disarm.phase === "phase1" || disarm.phase === "phase2" ? disarm.phase : undefined;
            if (!method || !phase) throw new Error("Choose a valid Disarm method and phase.");
            return {
              actingItemId: parseNonEmptyString(disarm.actingItemId, "actingItemId"),
              actingItemRevision: parseNonEmptyString(
                disarm.actingItemRevision,
                "actingItemRevision",
              ),
              method,
              phase,
              targetItemId: parseNonEmptyString(disarm.targetItemId, "targetItemId"),
              targetItemRevision: parseNonEmptyString(
                disarm.targetItemRevision,
                "targetItemRevision",
              ),
              targetParticipantId: parseNonEmptyString(
                disarm.targetParticipantId,
                "targetParticipantId",
              ),
            };
          })()
        : undefined,
  };
}

const MODIFIER_REVIEW_BUCKETS = [
  ["general", "general"],
  ["situationInitiative", "initiative"],
  ["situationObSkill", "skill_ob"],
  ["situationDb", "db_parry"],
] as const;

const MODIFIER_REVIEW_LEGACY_BUCKETS = {
  general: "general",
  situationDb: "situation_db",
  situationInitiative: "situation_initiative",
  situationObSkill: "situation_ob_skill",
} as const;

function modifierReviewRows(context: ScenarioParticipantCombatContext): Array<{
  bucketKey: (typeof MODIFIER_REVIEW_BUCKETS)[number][0];
  category: (typeof MODIFIER_REVIEW_BUCKETS)[number][1];
  entry: ScenarioCombatModifierEntry;
}> {
  return MODIFIER_REVIEW_BUCKETS.flatMap(([bucketKey, category]) =>
    context.modifierBuckets[bucketKey].map((entry) => ({ bucketKey, category, entry })),
  );
}

function participantOwnedModifierReviewRows(input: {
  context: ScenarioParticipantCombatContext;
  participantId: string;
}) {
  return modifierReviewRows(input.context).filter(({ entry }) => {
    const lifecycle = canonicalCombatModifierEffectSchema.safeParse(entry.canonicalLifecycle);
    return !lifecycle.success || lifecycle.data.ownerParticipantId === input.participantId;
  });
}

function modifierReviewEffectId(
  entry: ScenarioCombatModifierEntry,
  knownEffectIds?: { has(value: string): boolean },
): string {
  const lifecycle = canonicalCombatModifierEffectSchema.safeParse(entry.canonicalLifecycle);
  if (lifecycle.success) return lifecycle.data.id;
  return entry.sourceEffectId && knownEffectIds?.has(entry.sourceEffectId)
    ? entry.sourceEffectId
    : entry.id;
}

function modifierReviewDuration(input: {
  canonicalCutoff: number;
  durationRounds?: number;
  phase: "M1" | "M2";
  roundNumber: number;
}) {
  return input.durationRounds
    ? {
        creationRoundCounts: true as const,
        kind: "rounds" as const,
        remaining: input.durationRounds,
        startPhase: input.phase === "M1" ? ("phase1" as const) : ("phase2" as const),
        startRound: input.roundNumber,
        startSequence: input.canonicalCutoff,
        transitionBoundary: "round_boundary" as const,
      }
    : {
        kind: "manual" as const,
        removableBy: "gm" as const,
        startPhase: input.phase === "M1" ? ("phase1" as const) : ("phase2" as const),
        startRound: input.roundNumber,
        startSequence: input.canonicalCutoff,
      };
}

function buildManualModifierReviewEffect(input: {
  canonicalCutoff: number;
  category: "general" | "initiative" | "skill_ob" | "db_parry";
  createdAt: string;
  encounterId: string;
  entry: ScenarioCombatModifierEntry;
  ownerParticipantId: string;
  phase: "M1" | "M2";
  revision: string;
  roundNumber: number;
}): CanonicalCombatModifierEffect {
  if (input.entry.application === "flat_db") {
    throw new RangeError(
      "New GM modifiers use percentage application unless an authoritative direct-point rule exists.",
    );
  }
  const category =
    input.category === "general"
      ? "general_fatigue"
      : input.category === "initiative"
        ? "initiative"
        : input.category;
  return canonicalCombatModifierEffectSchema.parse({
    applicability: {
      combatWide: true,
      encounterId: input.encounterId,
      rollPurposes: [],
      roundNumber: input.roundNumber,
    },
    createdAt: input.createdAt,
    createdRevision: input.revision,
    createdSequence: input.canonicalCutoff,
    id: input.entry.id,
    lifecycle: {
      duration: modifierReviewDuration({
        canonicalCutoff: input.canonicalCutoff,
        durationRounds: input.entry.durationRounds,
        phase: input.phase,
        roundNumber: input.roundNumber,
      }),
      state: "active",
    },
    lineage: {},
    missingFacts: [],
    ownerParticipantId: input.ownerParticipantId,
    payload: {
      category,
      contributionScope: "calculation",
      kind: "numeric",
      unit: input.category === "initiative" ? "initiative_value" : "percentage",
      value: input.entry.value,
    },
    provenanceCompleteness: "complete",
    publicLabel: input.entry.notes?.trim() || "GM modifier",
    schemaVersion: CANONICAL_COMBAT_MODIFIER_LIFECYCLE_SCHEMA_VERSION,
    sourceFamily: "manual",
    sourceReferences: { rowId: input.entry.id },
    version: 1,
    visibility: { audience: "public", sourceIdentity: "public" },
  });
}

function buildCanonicalModifierReviewFromDraft(input: {
  canonicalCutoff: number;
  commandId: string;
  createdAt: string;
  currentContext: ScenarioParticipantCombatContext;
  draftContext: ScenarioParticipantCombatContext;
  encounterId: string;
  participantState: ScenarioParticipantState;
  phase: "M1" | "M2";
  publicNote?: string;
  revision: string;
  roundNumber: number;
  scenarioParticipantId: string;
}) {
  const inputEffects = new Map<string, CanonicalCombatModifierEffect>();
  for (const effect of combatEffectsStateSchema.parse(input.participantState.combatEffects)
    .effects) {
    if (effect.canonicalLifecycle?.ownerParticipantId === input.scenarioParticipantId) {
      inputEffects.set(effect.canonicalLifecycle.id, effect.canonicalLifecycle);
    }
  }
  for (const { bucketKey, entry } of participantOwnedModifierReviewRows({
    context: input.currentContext,
    participantId: input.scenarioParticipantId,
  })) {
    const lifecycle = canonicalCombatModifierEffectSchema.safeParse(entry.canonicalLifecycle);
    const adapted = lifecycle.success
      ? lifecycle.data
      : adaptModifierBucketRowToCanonicalLifecycle({
          bucket: MODIFIER_REVIEW_LEGACY_BUCKETS[bucketKey],
          context: {
            createdAt: input.createdAt,
            createdRevision: input.revision,
            createdSequence: input.canonicalCutoff,
            encounterId: input.encounterId,
            explicitDuration:
              entry.durationRounds === undefined
                ? undefined
                : modifierReviewDuration({
                    canonicalCutoff: input.canonicalCutoff,
                    durationRounds: entry.durationRounds,
                    phase: input.phase,
                    roundNumber: input.roundNumber,
                  }),
            explicitUnit: entry.application,
            visibility: { audience: "public", sourceIdentity: "public" },
          },
          entry,
          ownerParticipantId: input.scenarioParticipantId,
        }).effect;
    if (adapted) {
      inputEffects.set(adapted.id, adapted);
    }
  }

  const currentRows = new Map(
    participantOwnedModifierReviewRows({
      context: input.currentContext,
      participantId: input.scenarioParticipantId,
    }).map((row) => [modifierReviewEffectId(row.entry, inputEffects), row]),
  );
  const draftRows = new Map(
    participantOwnedModifierReviewRows({
      context: input.draftContext,
      participantId: input.scenarioParticipantId,
    }).map((row) => [modifierReviewEffectId(row.entry, inputEffects), row]),
  );
  const proposals: CanonicalCombatModifierReviewProposal[] = [];
  for (const effect of inputEffects.values()) {
    if (
      effect.lifecycle.state !== "active" ||
      effect.lifecycle.duration.kind !== "phase" ||
      effect.lifecycle.duration.phase === (input.phase === "M1" ? "phase1" : "phase2") ||
      (draftRows.has(effect.id) && effect.sourceFamily !== "manual")
    ) {
      continue;
    }
    proposals.push({
      effectId: effect.id,
      expectedVersion: effect.version,
      id: `${input.commandId}:proposal:expire:${effect.id}`,
      mayOverride: effect.sourceFamily === "manual",
      nextState: "expired",
      owner: "modifier_review",
      reason: "natural_expiry",
      transitionType: "expire",
    });
  }

  const proposalByEffectId = new Map(proposals.map((proposal) => [proposal.effectId, proposal]));
  const decisions: CanonicalCombatModifierReviewDecision[] = [];
  for (const [effectId, current] of currentRows) {
    const effect = inputEffects.get(effectId);
    if (!effect) continue;
    const draft = draftRows.get(effectId);
    const proposal = proposalByEffectId.get(effectId);
    if (!draft) {
      decisions.push(
        proposal
          ? {
              decisionId: `${input.commandId}:accept:${proposal.id}`,
              kind: "accept_proposal",
              proposalId: proposal.id,
            }
          : {
              decisionId: `${input.commandId}:remove:${effectId}`,
              effectId,
              expectedVersion: effect.version,
              kind: "remove",
            },
      );
      continue;
    }
    if (proposal) {
      decisions.push({
        decisionId: `${input.commandId}:retain:${proposal.id}`,
        kind: "retain",
        proposalId: proposal.id,
      });
    }
    const valueChanged =
      effect.payload.kind === "numeric" && effect.payload.value !== draft.entry.value;
    const durationChanged = current.entry.durationRounds !== draft.entry.durationRounds;
    const labelChanged =
      Boolean(draft.entry.notes?.trim()) && draft.entry.notes?.trim() !== effect.publicLabel;
    if (valueChanged || durationChanged || labelChanged) {
      if (
        ![
          "manual",
          "persistent_effect",
          "combat_experience",
          "damage",
          "health",
          "stunned",
        ].includes(effect.sourceFamily)
      ) {
        throw new RangeError(
          `${effect.publicLabel} is process-owned and cannot be edited as a manual modifier.`,
        );
      }
      decisions.push({
        decisionId: `${input.commandId}:edit:${effectId}`,
        effectId,
        expectedVersion: effect.version,
        kind: "edit",
        nextDuration: durationChanged
          ? modifierReviewDuration({
              canonicalCutoff: input.canonicalCutoff,
              durationRounds: draft.entry.durationRounds,
              phase: input.phase,
              roundNumber: input.roundNumber,
            })
          : undefined,
        nextPayload:
          valueChanged && effect.payload.kind === "numeric"
            ? { ...effect.payload, value: draft.entry.value }
            : undefined,
        nextPublicLabel: labelChanged ? draft.entry.notes?.trim() : undefined,
      });
    }
  }
  for (const [effectId, draft] of draftRows) {
    if (currentRows.has(effectId) || inputEffects.has(effectId)) continue;
    decisions.push({
      decisionId: `${input.commandId}:add:${effectId}`,
      effect: buildManualModifierReviewEffect({
        canonicalCutoff: input.canonicalCutoff,
        category: draft.category,
        createdAt: input.createdAt,
        encounterId: input.encounterId,
        entry: draft.entry,
        ownerParticipantId: input.scenarioParticipantId,
        phase: input.phase,
        revision: input.revision,
        roundNumber: input.roundNumber,
      }),
      kind: "add",
    });
  }

  const requiredRolls = [...inputEffects.values()].flatMap((effect) => {
    const duration = effect.lifecycle.duration;
    if (duration.kind !== "until_check") return [];
    const owner =
      duration.check.checkKind === "gm_review" ? ("modifier_review" as const) : ("su" as const);
    return [
      {
        blocksReview: owner === "modifier_review",
        id: duration.check.checkId,
        kind: duration.check.checkKind,
        owner,
        resolved: effect.lifecycle.state === "resolved",
        sourceEffectId: effect.id,
      },
    ];
  });

  const review = canonicalCombatModifierReviewInputSchema.parse({
    automaticProposals: proposals,
    canonicalCutoff: input.canonicalCutoff,
    decisions,
    encounterId: input.encounterId,
    expectedEncounterRevision: input.revision,
    inputEffects: [...inputEffects.values()],
    participantId: input.scenarioParticipantId,
    phase: input.phase,
    publicNote: input.publicNote,
    requiredRolls,
    reviewId: `${input.commandId}:review`,
    roundNumber: input.roundNumber,
    schemaVersion: CANONICAL_COMBAT_MODIFIER_REVIEW_SCHEMA_VERSION,
  });
  return commitCanonicalCombatModifierReview({
    acceptedRevision: input.revision,
    acceptedSequence: input.canonicalCutoff,
    commandId: input.commandId,
    review,
  });
}

function combatEffectStatusForLifecycle(effect: CanonicalCombatModifierEffect) {
  if (effect.lifecycle.state === "active") return "active" as const;
  if (
    effect.lifecycle.state === "pending_activation" ||
    effect.lifecycle.state === "pending_review" ||
    effect.lifecycle.state === "provisional" ||
    effect.lifecycle.state === "proposed"
  ) {
    return "pending" as const;
  }
  if (effect.lifecycle.state === "expired") return "expired" as const;
  if (effect.lifecycle.state === "superseded") return "superseded" as const;
  return "resolved" as const;
}

function applyCanonicalModifierReviewToParticipantState(input: {
  createdAt: string;
  draftContext: ScenarioParticipantCombatContext;
  state: ScenarioParticipantState;
  transaction: ReturnType<typeof commitCanonicalCombatModifierReview>;
}): ScenarioParticipantState {
  const outputById = new Map(input.transaction.outputEffects.map((effect) => [effect.id, effect]));
  const transitionsById = new Map<string, typeof input.transaction.transitions>();
  for (const transition of input.transaction.transitions) {
    transitionsById.set(transition.effectId, [
      ...(transitionsById.get(transition.effectId) ?? []),
      transition,
    ]);
  }
  const priorEffects = combatEffectsStateSchema.parse(input.state.combatEffects);
  const existingIds = new Set(priorEffects.effects.map((effect) => effect.id));
  const effects = priorEffects.effects.map((effect) => {
    const lifecycle = outputById.get(effect.id);
    if (!lifecycle) return effect;
    return combatEffectSchema.parse({
      ...effect,
      canonicalLifecycle: lifecycle,
      canonicalTransitions: [
        ...(effect.canonicalTransitions ?? []),
        ...(transitionsById.get(effect.id) ?? []),
      ],
      duration:
        lifecycle.lifecycle.duration.kind === "rounds"
          ? `${lifecycle.lifecycle.duration.remaining} rounds`
          : effect.duration,
      modifierValue:
        lifecycle.payload.kind === "numeric" ? lifecycle.payload.value : effect.modifierValue,
      status: combatEffectStatusForLifecycle(lifecycle),
      updatedAt: input.createdAt,
    });
  });
  const events = [...priorEffects.events];
  for (const change of input.transaction.changes) {
    if (change.kind !== "added" || existingIds.has(change.effectId)) continue;
    const lifecycle = outputById.get(change.effectId);
    if (!lifecycle) continue;
    const eventId = `${input.transaction.commandId}:effect-event:${lifecycle.id}`;
    events.push(
      combatEffectEventSchema.parse({
        createdAt: input.createdAt,
        id: eventId,
        sourceLabel: lifecycle.publicLabel,
        sourceType: "gm_adjustment",
        targetParticipantId: lifecycle.ownerParticipantId,
      }),
    );
    effects.push(
      combatEffectSchema.parse({
        canonicalLifecycle: lifecycle,
        canonicalTransitions: [],
        combatModifierBucket:
          lifecycle.payload.kind === "numeric"
            ? lifecycle.payload.category === "general_fatigue"
              ? "general"
              : lifecycle.payload.category === "initiative"
                ? "initiative"
                : lifecycle.payload.category === "skill_ob"
                  ? "skill_ob"
                  : lifecycle.payload.category === "db_parry"
                    ? "db_parry"
                    : undefined
            : undefined,
        combatWide: lifecycle.applicability.combatWide,
        createdAt: input.createdAt,
        damage: 0,
        description: lifecycle.publicNote ?? lifecycle.publicLabel,
        duration:
          lifecycle.lifecycle.duration.kind === "rounds"
            ? `${lifecycle.lifecycle.duration.remaining} rounds`
            : undefined,
        effectGroup:
          lifecycle.payload.kind === "restriction"
            ? "special"
            : lifecycle.payload.category === "general_fatigue"
              ? "general"
              : lifecycle.payload.category === "skill_ob"
                ? "obSkill"
                : lifecycle.payload.category === "db_parry"
                  ? "db"
                  : "other",
        generalDamage: 0,
        id: lifecycle.id,
        modifierValue: lifecycle.payload.kind === "numeric" ? lifecycle.payload.value : undefined,
        sourceEventId: eventId,
        status: combatEffectStatusForLifecycle(lifecycle),
        targetParticipantId: lifecycle.ownerParticipantId,
        type: lifecycle.payload.kind === "restriction" ? "special" : "other_modifier",
        updatedAt: input.createdAt,
      }),
    );
  }

  const context = scenarioParticipantCombatContextSchema.parse({
    ...input.draftContext,
    modifierBuckets: Object.fromEntries(
      MODIFIER_REVIEW_BUCKETS.map(([bucketKey]) => [
        bucketKey,
        input.draftContext.modifierBuckets[bucketKey]
          .map((entry) => {
            const lifecycle = outputById.get(modifierReviewEffectId(entry, outputById));
            return lifecycle
              ? scenarioCombatModifierEntrySchema.parse({
                  ...entry,
                  application:
                    lifecycle.payload.kind === "numeric" && lifecycle.payload.unit === "flat_db"
                      ? "flat_db"
                      : "percentage",
                  canonicalLifecycle: lifecycle,
                  canonicalTransitions: [
                    ...(entry.canonicalTransitions ?? []),
                    ...(transitionsById.get(lifecycle.id) ?? []),
                  ],
                  durationRounds:
                    lifecycle.lifecycle.duration.kind === "rounds"
                      ? lifecycle.lifecycle.duration.remaining
                      : entry.durationRounds,
                  notes: lifecycle.publicLabel,
                  value:
                    lifecycle.payload.kind === "numeric" ? lifecycle.payload.value : entry.value,
                })
              : entry;
          })
          .filter((entry) => {
            const lifecycle = canonicalCombatModifierEffectSchema.safeParse(
              entry.canonicalLifecycle,
            );
            return (
              !lifecycle.success ||
              [
                "proposed",
                "provisional",
                "pending_review",
                "pending_activation",
                "active",
              ].includes(lifecycle.data.lifecycle.state)
            );
          }),
      ]),
    ),
  });
  return {
    ...input.state,
    combat: { ...input.state.combat, combatContext: context },
    combatEffects: combatEffectsStateSchema.parse({ effects, events }),
  };
}

function normalizeCombatDeclarationMovementIntent(input: {
  encounter: EncounterSession;
  encounterParticipant: EncounterSession["participants"][number];
  gmAuthorizedOperation: boolean;
  movementIntent?: MovementIntent;
  roundState: CombatRoundState;
}): MovementIntent | undefined {
  if (!input.movementIntent) {
    return undefined;
  }

  if (input.movementIntent.mode === "hold_position") {
    return movementIntentSchema.parse({
      distancePreferences: [],
      mode: "hold_position",
    });
  }

  if (input.movementIntent.mode === "move_in_environment") {
    const environmentalMovement = input.movementIntent.environmentalMovement;
    if (!environmentalMovement) {
      throw new Error("Describe where this movement is going.");
    }
    return movementIntentSchema.parse({
      distancePreferences: [],
      environmentalMovement: {
        ...environmentalMovement,
        actionId: `${buildCombatRoundDeclarationId({
          participantId: input.encounterParticipant.id,
          roundNumber: input.roundState.roundNumber,
        })}:environmental-movement`,
      },
      mode: "move_in_environment",
    });
  }

  const source = input.gmAuthorizedOperation ? "gm_proxy" : "player_declared";
  const hasVisibilityRows = Object.keys(input.encounter.roleplayState?.visibility ?? {}).length > 0;
  const preferencesByTargetParticipantId = new Map<
    string,
    MovementIntent["distancePreferences"][number]
  >();
  const playerUnavailableTargetMessage = "Distance preference target is unavailable.";

  for (const preference of input.movementIntent.distancePreferences) {
    const targetRoundParticipant = findCombatRoundParticipantByAlias({
      id: preference.targetParticipantId,
      state: input.roundState,
    });

    if (!targetRoundParticipant) {
      throw new Error(
        input.gmAuthorizedOperation
          ? "Distance preference target is not part of this combat round."
          : playerUnavailableTargetMessage,
      );
    }

    if (targetRoundParticipant.participantId === input.encounterParticipant.id) {
      throw new Error("Distance preference target must be another participant.");
    }

    const targetEncounterParticipant = input.encounter.participants.find((participant) =>
      participantAliasesInclude({ id: targetRoundParticipant.participantId, participant }),
    );

    if (!targetEncounterParticipant) {
      throw new Error(
        input.gmAuthorizedOperation
          ? "Distance preference target is not assigned to this encounter."
          : playerUnavailableTargetMessage,
      );
    }

    if (
      !input.gmAuthorizedOperation &&
      hasVisibilityRows &&
      !hasCombatDistanceVisibility({
        target: targetEncounterParticipant,
        viewer: input.encounterParticipant,
        visibility: input.encounter.roleplayState?.visibility,
      })
    ) {
      throw new Error(playerUnavailableTargetMessage);
    }

    const currentDistance = getDistanceEdgeBetweenParticipantAliases({
      participantA: input.encounterParticipant,
      participantB: targetEncounterParticipant,
      state: input.roundState.distanceState,
    })?.distance;
    const operationMatchesDistance =
      !preference.operation ||
      (currentDistance !== undefined &&
        ((preference.operation === "maintain" && preference.desiredDistance === currentDistance) ||
          (preference.operation === "close" && preference.desiredDistance < currentDistance) ||
          ((preference.operation === "open" || preference.operation === "retreat") &&
            preference.desiredDistance > currentDistance)));
    if (!operationMatchesDistance) {
      throw new Error("Relative movement no longer matches the current participant distance.");
    }

    preferencesByTargetParticipantId.set(
      targetRoundParticipant.participantId,
      movementIntentSchema.parse({
        distancePreferences: [
          {
            ...preference,
            source,
          },
        ],
        mode: "set_distance_preferences",
      }).distancePreferences[0],
    );
  }

  return movementIntentSchema.parse({
    distancePreferences: [...preferencesByTargetParticipantId.values()],
    mode: "set_distance_preferences",
  });
}

function parseParticipantCommandBody(
  body: unknown,
  label: string,
): {
  expectedParticipantRevision?: string;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, label);
  const scenarioParticipantId = value.scenarioParticipantId;

  if (typeof scenarioParticipantId !== "string" || scenarioParticipantId.trim().length === 0) {
    throw new Error("scenarioParticipantId is required.");
  }

  return {
    expectedParticipantRevision: parseOptionalDeclarationString(value.expectedParticipantRevision),
    scenarioParticipantId,
  };
}

function parseCombatInitiativeBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  expectedParticipantRevision: string;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Combat initiative payload");
  const parsed = parseParticipantCommandBody(value, "Combat initiative payload");

  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    expectedParticipantRevision: parseNonEmptyString(
      value.expectedParticipantRevision,
      "expectedParticipantRevision",
    ),
  };
}

function parseCombatExperienceBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  difficulty?: number;
  opportunityId?: string;
  phase?: CombatRoundPhase;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Combat Experience payload");
  const parsed = parseParticipantCommandBody(value, "Combat Experience payload");
  const difficulty = value.difficulty;
  const phase = value.phase;

  if (
    difficulty !== undefined &&
    (typeof difficulty !== "number" || !Number.isInteger(difficulty) || difficulty <= 0)
  ) {
    throw new Error("difficulty must be a positive integer.");
  }
  if (phase !== undefined && phase !== "phase1" && phase !== "phase2") {
    throw new Error("phase must be phase1 or phase2.");
  }

  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    difficulty: typeof difficulty === "number" ? difficulty : undefined,
    opportunityId: parseOptionalDeclarationString(value.opportunityId),
    phase,
  };
}

function parseRoundEndDistanceControlRollBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  distanceProposalId: string;
  opponentParticipantId: string;
  pairId: string;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Round-end distance control roll payload");
  const parsed = parseParticipantCommandBody(value, "Round-end distance control roll payload");
  const distanceProposalId = parseNonEmptyString(value.distanceProposalId, "distanceProposalId");

  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    distanceProposalId,
    opponentParticipantId: parseNonEmptyString(
      value.opponentParticipantId,
      "opponentParticipantId",
    ),
    pairId: parseNonEmptyString(value.pairId, "pairId"),
  };
}

function parseContinuedContactMaintenanceRollBody(
  body: unknown,
): ParsedCombatTaskCommandIdentity & {
  contestId: string;
  continuedContactId: string;
  opponentParticipantId: string;
  processId: string;
  rollPurpose: "escape_continued_contact";
  scenarioParticipantId: string;
  stageId: string;
} {
  const value = parseBodyObject(body, "Continued Contact maintenance roll payload");
  const parsed = parseParticipantCommandBody(value, "Continued Contact maintenance roll payload");
  if (value.rollPurpose !== "escape_continued_contact") {
    throw new Error("rollPurpose must be escape_continued_contact.");
  }
  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    contestId: parseNonEmptyString(value.contestId, "contestId"),
    continuedContactId: parseNonEmptyString(value.continuedContactId, "continuedContactId"),
    opponentParticipantId: parseNonEmptyString(
      value.opponentParticipantId,
      "opponentParticipantId",
    ),
    processId: parseNonEmptyString(value.processId, "processId"),
    rollPurpose: "escape_continued_contact",
    stageId: parseNonEmptyString(value.stageId, "stageId"),
  };
}

function parseCombatObservationRollBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  observationAttemptId: string;
  opponentParticipantId: string;
  processId: string;
  relationshipId: string;
  scenarioParticipantId: string;
  stageId: string;
} {
  const value = parseBodyObject(body, "Observe Opponent roll payload");
  const parsed = parseParticipantCommandBody(value, "Observe Opponent roll payload");
  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    observationAttemptId: parseNonEmptyString(value.observationAttemptId, "observationAttemptId"),
    opponentParticipantId: parseNonEmptyString(
      value.opponentParticipantId,
      "opponentParticipantId",
    ),
    processId: parseNonEmptyString(value.processId, "processId"),
    relationshipId: parseNonEmptyString(value.relationshipId, "relationshipId"),
    stageId: parseNonEmptyString(value.stageId, "stageId"),
  };
}

function parseRoundEndHealthCheckRollBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  expectedParticipantRevision: string;
  healthRollId: string;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Round-end health check roll payload");
  const parsed = parseParticipantCommandBody(value, "Round-end health check roll payload");
  const healthRollId = parseNonEmptyString(value.healthRollId, "healthRollId");
  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    expectedParticipantRevision: parseNonEmptyString(
      value.expectedParticipantRevision,
      "expectedParticipantRevision",
    ),
    healthRollId,
  };
}

function parseRoundEndDistanceControlCommitBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  chosenDistance?: number;
  distanceOverride?: number;
  distanceProposalId: string;
  pairId: string;
  scenarioParticipantId?: string;
} {
  const value = parseBodyObject(body, "Round-end distance control commit payload");
  const distanceProposalId = parseNonEmptyString(value.distanceProposalId, "distanceProposalId");
  const chosenDistance = value.chosenDistance;
  const distanceOverride = value.distanceOverride;
  if (
    chosenDistance !== undefined &&
    (typeof chosenDistance !== "number" || !Number.isFinite(chosenDistance))
  ) {
    throw new Error("chosenDistance must be a number.");
  }
  if (
    distanceOverride !== undefined &&
    (typeof distanceOverride !== "number" || !Number.isFinite(distanceOverride))
  ) {
    throw new Error("distanceOverride must be a number.");
  }
  return {
    ...parseCombatTaskCommandIdentity(value),
    chosenDistance: typeof chosenDistance === "number" ? chosenDistance : undefined,
    distanceOverride: typeof distanceOverride === "number" ? distanceOverride : undefined,
    distanceProposalId,
    pairId: parseNonEmptyString(value.pairId, "pairId"),
    scenarioParticipantId:
      value.scenarioParticipantId === undefined
        ? undefined
        : parseNonEmptyString(value.scenarioParticipantId, "scenarioParticipantId"),
  };
}

function parseCombatExperienceDifficultyBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  difficulty: number;
} {
  const value = parseBodyObject(body, "Combat Experience difficulty payload");
  const difficulty = value.difficulty;

  if (typeof difficulty !== "number" || !Number.isInteger(difficulty) || difficulty <= 0) {
    throw new Error("difficulty must be a positive integer.");
  }

  return { ...parseCombatTaskCommandIdentity(value), difficulty };
}

function parsePairDistanceBody(body: unknown): {
  distance: number;
  participantAId: string;
  participantBId: string;
} {
  const value = parseBodyObject(body, "Pair distance payload");
  const participantAId = parseNonEmptyString(value.participantAId, "participantAId");
  const participantBId = parseNonEmptyString(value.participantBId, "participantBId");
  const distance = parseIntegerInRange(value.distance, "distance", 0, 8);

  return {
    distance,
    participantAId,
    participantBId,
  };
}

function parseCombatRoundAdvanceBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  commandType: Extract<
    CombatProgressionExpectedCommand,
    "advance_combat_boundary" | "complete_round"
  >;
  expectedBoundary: CombatProgressionBoundaryKind;
  stepSnapshots?: CombatRoundStepSnapshot[];
  targetBoundary: CombatProgressionBoundaryKind;
} {
  const value = parseBodyObject(body, "Combat round advance payload");
  const parseBoundary = (key: "expectedBoundary" | "targetBoundary") => {
    let boundary: string;
    try {
      boundary = parseNonEmptyString(value[key], key);
    } catch (error) {
      throw new CombatCommandRequestError(
        "boundary_mismatch",
        error instanceof Error ? error.message : `${key} is required.`,
      );
    }
    if (!COMBAT_PROGRESSION_BOUNDARIES.includes(boundary as CombatProgressionBoundaryKind)) {
      throw new CombatCommandRequestError(
        "boundary_mismatch",
        `${key} must be a recognized combat progression boundary.`,
      );
    }
    return boundary as CombatProgressionBoundaryKind;
  };
  const commandType =
    value.commandType === "advance_combat_boundary" || value.commandType === "complete_round"
      ? value.commandType
      : undefined;
  if (!commandType) {
    throw new CombatCommandRequestError(
      "identity_mismatch",
      "commandType must identify the current combat boundary transition.",
    );
  }
  const expectedBoundary = parseBoundary("expectedBoundary");
  let identity: ParsedCombatTaskCommandIdentity;
  try {
    identity = parseCombatTaskCommandIdentity(value);
  } catch (error) {
    throw new CombatCommandRequestError(
      "identity_mismatch",
      error instanceof Error ? error.message : "Combat task identity is required.",
    );
  }
  const targetBoundary = parseBoundary("targetBoundary");
  const stepSnapshotsValue = value.stepSnapshots;

  if (stepSnapshotsValue === undefined) {
    return { ...identity, commandType, expectedBoundary, targetBoundary };
  }

  if (!Array.isArray(stepSnapshotsValue)) {
    throw new Error("stepSnapshots must be an array.");
  }

  return {
    ...identity,
    commandType,
    expectedBoundary,
    stepSnapshots: stepSnapshotsValue.map((snapshot) =>
      combatRoundStepSnapshotSchema.parse(snapshot),
    ),
    targetBoundary,
  };
}

function parsePhaseAttackBackOutBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Phase attack back-out payload");
  const parsed = parseParticipantCommandBody(value, "Phase attack back-out payload");

  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    phase: combatRoundPhaseSchema.parse(value.phase),
  };
}

function parseNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function parseCombatAttackBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  actionId: string;
  attackIndex: number;
  attackModeId: string;
  declarationId: string;
  effectCutoffInitiativeGroupId?: string;
  defenderParticipantId: string;
  expectedParticipantRevision: string;
  modifierValidationTaskId?: string;
  opportunityId: string;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
  weaponInstanceId?: string;
  weaponSourceId: string;
  weaponSourceSlot: CombatAttackSourceRef["slot"];
  weaponTemplateId: string;
} {
  const value = parseBodyObject(body, "Combat attack payload");
  const parsed = parseParticipantCommandBody(value, "Combat attack payload");
  const defenderParticipantId = parseNonEmptyString(
    value.defenderParticipantId ?? value.defenderScenarioParticipantId,
    "defenderParticipantId",
  );
  const phase = combatRoundPhaseSchema.parse(value.phase);
  const actionId = parseNonEmptyString(value.actionId, "actionId");
  const modifierValidationTaskId =
    typeof value.modifierValidationTaskId === "string" &&
    value.modifierValidationTaskId.trim().length > 0
      ? value.modifierValidationTaskId
      : undefined;
  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    actionId,
    attackIndex: parseInteger(value.attackIndex, "attackIndex"),
    attackModeId: parseNonEmptyString(value.attackModeId, "attackModeId"),
    declarationId: parseNonEmptyString(value.declarationId, "declarationId"),
    effectCutoffInitiativeGroupId:
      value.effectCutoffInitiativeGroupId === undefined
        ? undefined
        : parseNonEmptyString(value.effectCutoffInitiativeGroupId, "effectCutoffInitiativeGroupId"),
    defenderParticipantId,
    expectedParticipantRevision: parseNonEmptyString(
      value.expectedParticipantRevision,
      "expectedParticipantRevision",
    ),
    modifierValidationTaskId,
    opportunityId: parseNonEmptyString(value.opportunityId, "opportunityId"),
    phase,
    weaponInstanceId:
      value.weaponInstanceId === undefined
        ? undefined
        : parseNonEmptyString(value.weaponInstanceId, "weaponInstanceId"),
    weaponSourceId: parseNonEmptyString(value.weaponSourceId, "weaponSourceId"),
    weaponSourceSlot: (() => {
      const slot = value.weaponSourceSlot;
      if (!["primary", "secondary", "throwing", "other", "virtual"].includes(String(slot))) {
        throw new Error("weaponSourceSlot is required.");
      }
      return slot as CombatAttackSourceRef["slot"];
    })(),
    weaponTemplateId: parseNonEmptyString(value.weaponTemplateId, "weaponTemplateId"),
  };
}

function parseOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function getCombatThrownWeaponAttackUndo(
  command: CombatRoundCommand,
): CombatThrownWeaponAttackUndo | undefined {
  const value = command.facts.thrownWeaponUndo;
  if (!isRecord(value) || value.version !== 1 || value.actionId !== command.id) return undefined;
  if (
    typeof value.encounterId !== "string" ||
    typeof value.itemAfterRevision !== "string" ||
    typeof value.ownerCharacterId !== "string" ||
    !isRecord(value.itemBefore) ||
    typeof value.itemBefore.id !== "string" ||
    !Array.isArray(value.loadoutsBefore)
  ) {
    return undefined;
  }
  return value as unknown as CombatThrownWeaponAttackUndo;
}

function getCombatDisarmItemUndo(
  command: CombatRoundCommand,
): CombatThrownWeaponAttackUndo | undefined {
  const value = command.facts.disarmItemUndo;
  if (!isRecord(value) || value.version !== 1 || value.actionId !== command.id) return undefined;
  if (
    command.type !== "commit_disarm" ||
    typeof value.encounterId !== "string" ||
    typeof value.itemAfterRevision !== "string" ||
    typeof value.ownerCharacterId !== "string" ||
    !isRecord(value.itemBefore) ||
    typeof value.itemBefore.id !== "string" ||
    !Array.isArray(value.loadoutsBefore)
  ) {
    return undefined;
  }
  return value as unknown as CombatThrownWeaponAttackUndo;
}

function parseCombatParryBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  attackResultId: string;
  attackerParticipantId: string;
  commandType: "roll_parry";
  effectCutoffInitiativeGroupId?: string;
  declarationId?: string;
  declaredOpponentParticipantId?: string;
  disarmAttemptId?: string;
  defenderParticipantId: string;
  expectedParticipantRevision: string;
  modifierValidationTaskId: string;
  offensiveParryAttemptId?: string;
  opportunityId?: string;
  parryPurpose: "ordinary_defense" | "offensive_parry" | "parry_disarm";
  parrySourceId: string;
  phase: CombatRoundPhase;
  processId: string;
  scenarioParticipantId: string;
  stageId: string;
  usedMainHand?: boolean;
  usedOffHand?: boolean;
} {
  const value = parseBodyObject(body, "Combat parry payload");
  const parsed = parseParticipantCommandBody(value, "Combat parry payload");
  const attackResultId = parseNonEmptyString(value.attackResultId, "attackResultId");
  if (value.commandType !== "roll_parry") {
    throw new Error("commandType must be roll_parry.");
  }
  const parryPurpose =
    value.parryPurpose === "ordinary_defense" ||
    value.parryPurpose === "offensive_parry" ||
    value.parryPurpose === "parry_disarm"
      ? value.parryPurpose
      : undefined;
  if (!parryPurpose) {
    throw new Error("parryPurpose is required.");
  }
  const declarationId =
    value.declarationId === undefined
      ? undefined
      : parseNonEmptyString(value.declarationId, "declarationId");
  const declaredOpponentParticipantId =
    value.declaredOpponentParticipantId === undefined
      ? undefined
      : parseNonEmptyString(value.declaredOpponentParticipantId, "declaredOpponentParticipantId");
  const offensiveParryAttemptId =
    value.offensiveParryAttemptId === undefined
      ? undefined
      : parseNonEmptyString(value.offensiveParryAttemptId, "offensiveParryAttemptId");
  const disarmAttemptId =
    value.disarmAttemptId === undefined
      ? undefined
      : parseNonEmptyString(value.disarmAttemptId, "disarmAttemptId");
  if (
    parryPurpose === "offensive_parry" &&
    (!declarationId ||
      !declaredOpponentParticipantId ||
      !offensiveParryAttemptId ||
      !value.opportunityId)
  ) {
    throw new Error(
      "Offensive Parry requires declarationId, declaredOpponentParticipantId, offensiveParryAttemptId, and opportunityId.",
    );
  }
  if (parryPurpose === "parry_disarm" && !disarmAttemptId) {
    throw new Error("Parry-Disarm requires disarmAttemptId.");
  }

  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    attackResultId,
    attackerParticipantId: parseNonEmptyString(
      value.attackerParticipantId,
      "attackerParticipantId",
    ),
    commandType: "roll_parry",
    effectCutoffInitiativeGroupId:
      value.effectCutoffInitiativeGroupId === undefined
        ? undefined
        : parseNonEmptyString(value.effectCutoffInitiativeGroupId, "effectCutoffInitiativeGroupId"),
    declarationId,
    declaredOpponentParticipantId,
    disarmAttemptId,
    defenderParticipantId: parseNonEmptyString(
      value.defenderParticipantId,
      "defenderParticipantId",
    ),
    expectedParticipantRevision: parseNonEmptyString(
      value.expectedParticipantRevision,
      "expectedParticipantRevision",
    ),
    modifierValidationTaskId: parseNonEmptyString(
      value.modifierValidationTaskId,
      "modifierValidationTaskId",
    ),
    offensiveParryAttemptId,
    opportunityId:
      value.opportunityId === undefined
        ? undefined
        : parseNonEmptyString(value.opportunityId, "opportunityId"),
    parryPurpose,
    parrySourceId: parseNonEmptyString(value.parrySourceId, "parrySourceId"),
    phase: combatRoundPhaseSchema.parse(value.phase),
    processId: parseNonEmptyString(value.processId, "processId"),
    stageId: parseNonEmptyString(value.stageId, "stageId"),
    usedMainHand: parseOptionalBoolean(value.usedMainHand, "usedMainHand"),
    usedOffHand: parseOptionalBoolean(value.usedOffHand, "usedOffHand"),
  };
}

function parseOffensiveParryBrawlingBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  attackResultId: string;
  contestId: string;
  declarationId: string;
  declaredOpponentParticipantId: string;
  offensiveParryAttemptId: string;
  opponentParticipantId: string;
  opportunityId: string;
  parryResultId: string;
  phase: CombatRoundPhase;
  processId: string;
  rollPurpose: "offensive_parry_brawling";
  scenarioParticipantId: string;
  stageId: string;
} {
  const value = parseBodyObject(body, "Offensive Parry Brawling payload");
  const participant = parseParticipantCommandBody(value, "Offensive Parry Brawling payload");
  if (value.rollPurpose !== "offensive_parry_brawling") {
    throw new Error("rollPurpose must be offensive_parry_brawling.");
  }
  return {
    ...participant,
    ...parseCombatTaskCommandIdentity(value),
    attackResultId: parseNonEmptyString(value.attackResultId, "attackResultId"),
    contestId: parseNonEmptyString(value.contestId, "contestId"),
    declarationId: parseNonEmptyString(value.declarationId, "declarationId"),
    declaredOpponentParticipantId: parseNonEmptyString(
      value.declaredOpponentParticipantId,
      "declaredOpponentParticipantId",
    ),
    offensiveParryAttemptId: parseNonEmptyString(
      value.offensiveParryAttemptId,
      "offensiveParryAttemptId",
    ),
    opponentParticipantId: parseNonEmptyString(
      value.opponentParticipantId,
      "opponentParticipantId",
    ),
    opportunityId: parseNonEmptyString(value.opportunityId, "opportunityId"),
    parryResultId: parseNonEmptyString(value.parryResultId, "parryResultId"),
    phase: combatRoundPhaseSchema.parse(value.phase),
    processId: parseNonEmptyString(value.processId, "processId"),
    rollPurpose: "offensive_parry_brawling",
    stageId: parseNonEmptyString(value.stageId, "stageId"),
  };
}

interface ParsedCombatDownstreamTaskIdentity {
  attackResultId: string;
  attackerParticipantId: string;
  defenderParticipantId: string;
  executionGroupId: string;
  expectedRevision: string;
  opportunityId?: string;
  phase: CombatRoundPhase;
  taskId: string;
}

function parseCombatDownstreamTaskIdentity(
  value: Record<string, unknown>,
): ParsedCombatDownstreamTaskIdentity {
  return {
    attackResultId: parseNonEmptyString(value.attackResultId, "attackResultId"),
    attackerParticipantId: parseNonEmptyString(
      value.attackerParticipantId,
      "attackerParticipantId",
    ),
    defenderParticipantId: parseNonEmptyString(
      value.defenderParticipantId,
      "defenderParticipantId",
    ),
    executionGroupId: parseNonEmptyString(value.executionGroupId, "executionGroupId"),
    expectedRevision: parseNonEmptyString(value.expectedRevision, "expectedRevision"),
    opportunityId:
      value.opportunityId === undefined
        ? undefined
        : parseNonEmptyString(value.opportunityId, "opportunityId"),
    phase: combatRoundPhaseSchema.parse(value.phase),
    taskId: parseNonEmptyString(value.taskId, "taskId"),
  };
}

function parseCombatAttackerPrivilegedRollBody(
  body: unknown,
): ParsedCombatDownstreamTaskIdentity & {
  criticalResultId?: string;
  hitLocationResultId: string;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Combat attacker roll payload");
  const parsed = parseParticipantCommandBody(value, "Combat attacker roll payload");

  return {
    ...parsed,
    ...parseCombatDownstreamTaskIdentity(value),
    criticalResultId:
      value.criticalResultId === undefined
        ? undefined
        : parseNonEmptyString(value.criticalResultId, "criticalResultId"),
    hitLocationResultId: parseNonEmptyString(value.hitLocationResultId, "hitLocationResultId"),
  };
}

type ParsedCombatDamageTaskBody = ParsedCombatDownstreamTaskIdentity & {
  commandType: "commit_phase_damage" | "resolve_damage";
  criticalResultId: string;
  damageRollExpression?: string;
  damageReviewId: string;
  hitLocationResultId: string;
  scenarioParticipantId?: string;
};

function parseCombatDamageTaskBody(body: unknown): ParsedCombatDamageTaskBody {
  const value = parseBodyObject(body, "Combat damage task payload");
  if (value.commandType !== "resolve_damage" && value.commandType !== "commit_phase_damage") {
    throw new Error("commandType must identify the current damage review task.");
  }
  return {
    ...parseCombatDownstreamTaskIdentity(value),
    commandType: value.commandType,
    criticalResultId: parseNonEmptyString(value.criticalResultId, "criticalResultId"),
    damageRollExpression:
      value.damageRollExpression === undefined
        ? undefined
        : parseNonEmptyString(value.damageRollExpression, "damageRollExpression"),
    damageReviewId: parseNonEmptyString(value.damageReviewId, "damageReviewId"),
    hitLocationResultId: parseNonEmptyString(value.hitLocationResultId, "hitLocationResultId"),
    scenarioParticipantId:
      value.scenarioParticipantId === undefined
        ? undefined
        : parseNonEmptyString(value.scenarioParticipantId, "scenarioParticipantId"),
  };
}

function parseCombatDamageReviewBody(body: unknown): ParsedCombatDamageTaskBody & {
  review: Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId">;
} {
  const value = parseBodyObject(body, "Combat damage review payload");

  if (!value.review || typeof value.review !== "object" || Array.isArray(value.review)) {
    throw new Error("review is required.");
  }

  return {
    ...parseCombatDamageTaskBody(value),
    review: value.review as Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId">,
  };
}

function clearScenarioParticipantCombatDeclaration(
  participant: ScenarioParticipant,
): ScenarioParticipant["state"] {
  return {
    ...participant.state,
    combat: {
      ...participant.state.combat,
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      declarationSubmittedAt: undefined,
      declarationSubmittedByUserId: undefined,
      lastDeclaredActionId: undefined,
      lastDeclaredEncounterId: undefined,
      lastDeclaredMovementId: undefined,
      lastDeclaredRoundNumber: undefined,
      lastDeclaredSecondaryActionId: undefined,
      lastDeclarationNotes: undefined,
    },
  };
}

function parseCombatSummaryInteger(value: string | undefined, label: string): number | undefined {
  if (!value || value === "—" || value === "incomplete") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }

  return parsed;
}

function combatContextsDiffer(
  left: ScenarioParticipantCombatContext,
  right: ScenarioParticipantCombatContext,
): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getSnapshotEquipmentState(
  participant: ScenarioParticipant,
): Record<string, unknown> | undefined {
  const snapshot = isRecord(participant.snapshot) ? participant.snapshot : undefined;
  const equipmentStateValue = snapshot?.["equipmentState"];

  return isRecord(equipmentStateValue) ? equipmentStateValue : undefined;
}

function getEquipmentTemplatesById(
  equipmentState: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const nestedTemplatesValue = equipmentState?.["templates"];
  const nestedTemplates = isRecord(nestedTemplatesValue) ? nestedTemplatesValue : undefined;
  const nestedTemplatesByIdValue = nestedTemplates?.["templatesById"];

  if (isRecord(nestedTemplatesByIdValue)) {
    return nestedTemplatesByIdValue;
  }

  const flatTemplatesByIdValue = equipmentState?.["templatesById"];

  return isRecord(flatTemplatesByIdValue) ? flatTemplatesByIdValue : undefined;
}

function resolveScenarioParticipantMovementBurden(participant: ScenarioParticipant) {
  const build = characterBuildSchema.safeParse(participant.snapshot.build);
  const characterInputs = build.success
    ? buildCombatStateCharacterInputs(
        buildCharacterSheetSummary({
          build: build.data,
          content: defaultCanonicalContent,
        }),
      )
    : undefined;
  const equipmentState = getSnapshotEquipmentState(participant);
  const itemsValue = equipmentState?.["itemsById"];
  const locationsValue = equipmentState?.["locationsById"];
  const loadoutsValue = equipmentState?.["activeLoadoutByCharacterId"];
  const itemsById = isRecord(itemsValue) ? itemsValue : undefined;
  const locationsById = isRecord(locationsValue) ? locationsValue : undefined;
  const loadoutsByCharacterId = isRecord(loadoutsValue) ? loadoutsValue : undefined;
  const characterId =
    participant.characterId ??
    (loadoutsByCharacterId
      ? Object.keys(loadoutsByCharacterId).find((key) => key.trim().length > 0)
      : undefined);
  const parsedItems = itemsById
    ? Object.values(itemsById).flatMap((value) => {
        const parsed = EquipmentItemSchema.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  const itemsAreComplete = itemsById ? parsedItems.length === Object.keys(itemsById).length : false;
  const parsedLocations = locationsById
    ? Object.fromEntries(
        Object.entries(locationsById).flatMap(([id, value]) => {
          const parsed = StorageLocationSchema.safeParse(value);
          return parsed.success ? [[id, parsed.data] as const] : [];
        }),
      )
    : {};
  const locationsAreComplete = locationsById
    ? Object.keys(parsedLocations).length === Object.keys(locationsById).length
    : false;
  const snapshotTemplates = getEquipmentTemplatesById(equipmentState);
  const parsedSnapshotTemplates = snapshotTemplates
    ? Object.fromEntries(
        Object.entries(snapshotTemplates).flatMap(([id, value]) => {
          const parsed = AnyEquipmentTemplateSchema.safeParse(value);
          return parsed.success ? [[id, parsed.data] as const] : [];
        }),
      )
    : {};
  const loadoutValue = characterId ? loadoutsByCharacterId?.[characterId] : undefined;
  const parsedLoadout = CharacterLoadoutSchema.safeParse(loadoutValue);
  const loadoutIsComplete = loadoutValue === undefined || parsedLoadout.success;

  return resolveCombatMovementBurden({
    characterId,
    characteristics: characterInputs
      ? {
          constitution: characterInputs.constitution,
          size: characterInputs.size,
          strength: characterInputs.strength,
        }
      : undefined,
    equipmentLoadoutRevision: participant.updatedAt,
    equipmentState:
      equipmentState &&
      itemsById &&
      locationsById &&
      itemsAreComplete &&
      locationsAreComplete &&
      loadoutIsComplete
        ? {
            activeLoadout: parsedLoadout.success ? parsedLoadout.data : undefined,
            items: parsedItems,
            locationsById: parsedLocations,
            templatesById: {
              ...equipmentTemplatesById,
              ...parsedSnapshotTemplates,
            },
          }
        : undefined,
    participantId: participant.id,
    sourceSnapshotId: `scenario-participant:${participant.id}:snapshot:${
      participant.snapshot.sourceUpdatedAt ?? participant.updatedAt ?? "unversioned"
    }`,
  });
}

function isWeaponTemplateLike(template: unknown): template is WeaponTemplate {
  return (
    isRecord(template) &&
    template.category === "weapon" &&
    typeof template.name === "string" &&
    template.name.trim().length > 0
  );
}

function getSnapshotWeaponTemplates(participant: ScenarioParticipant): WeaponTemplate[] {
  const equipmentState = getSnapshotEquipmentState(participant);
  const templatesById = getEquipmentTemplatesById(equipmentState);

  if (!templatesById) {
    return [];
  }

  return Object.values(templatesById).filter(isWeaponTemplateLike);
}

function getScenarioParticipantReadyItemIds(participant: ScenarioParticipant): string[] {
  const participantRecord = participant as unknown;
  const state = isRecord(participantRecord) ? participantRecord["state"] : undefined;
  const equipment = isRecord(state) ? state["equipment"] : undefined;
  const readyItemIds = isRecord(equipment) ? equipment["readyItemIds"] : undefined;

  return (Array.isArray(readyItemIds) ? readyItemIds : []).filter(
    (itemId): itemId is string => typeof itemId === "string" && itemId.length > 0,
  );
}

function getScenarioParticipantActiveWeaponItemIds(participant: ScenarioParticipant): string[] {
  const equipmentState = getSnapshotEquipmentState(participant);
  const activeLoadoutsValue = equipmentState?.["activeLoadoutByCharacterId"];
  const activeLoadouts = isRecord(activeLoadoutsValue) ? activeLoadoutsValue : undefined;
  const characterId =
    participant.characterId ??
    (activeLoadouts ? Object.keys(activeLoadouts).find((key) => key.trim().length > 0) : undefined);
  const activeLoadoutValue = characterId ? activeLoadouts?.[characterId] : undefined;
  const activeLoadout = isRecord(activeLoadoutValue) ? activeLoadoutValue : undefined;

  return [
    activeLoadout?.["activePrimaryWeaponItemId"],
    activeLoadout?.["activeSecondaryWeaponItemId"],
    activeLoadout?.["activeMissileWeaponItemId"],
  ].filter((itemId): itemId is string => typeof itemId === "string" && itemId.length > 0);
}

function getScenarioParticipantWieldedWeaponItemIds(participant: ScenarioParticipant): string[] {
  const equipmentState = getSnapshotEquipmentState(participant);
  const activeLoadoutsValue = equipmentState?.["activeLoadoutByCharacterId"];
  const activeLoadouts = isRecord(activeLoadoutsValue) ? activeLoadoutsValue : undefined;
  const characterId =
    participant.characterId ??
    (activeLoadouts ? Object.keys(activeLoadouts).find((key) => key.trim().length > 0) : undefined);
  const activeLoadoutValue = characterId ? activeLoadouts?.[characterId] : undefined;
  const activeLoadout = isRecord(activeLoadoutValue) ? activeLoadoutValue : undefined;
  return [
    activeLoadout?.["activePrimaryWeaponItemId"],
    activeLoadout?.["activeSecondaryWeaponItemId"],
  ].filter((itemId): itemId is string => typeof itemId === "string" && itemId.length > 0);
}

function hasExactWieldedWeaponItem(input: {
  expectedRevision: string;
  expectedTemplateId: string;
  itemId: string;
  participant: ScenarioParticipant;
}): boolean {
  const equipmentState = getSnapshotEquipmentState(input.participant);
  const itemsById = isRecord(equipmentState?.["itemsById"])
    ? (equipmentState["itemsById"] as Record<string, unknown>)
    : undefined;
  const item = EquipmentItemSchema.safeParse(itemsById?.[input.itemId]);
  const wieldedIds = getScenarioParticipantWieldedWeaponItemIds(input.participant);
  return Boolean(
    item.success &&
    wieldedIds.includes(input.itemId) &&
    item.data.templateId === input.expectedTemplateId &&
    item.data.revision === input.expectedRevision &&
    item.data.conditionState === "intact" &&
    item.data.storageAssignment?.carryMode === "equipped",
  );
}

function getScenarioParticipantWeaponItemIdForSlot(
  participant: ScenarioParticipant,
  slot: CombatAttackSourceRef["slot"],
): string | undefined {
  if (slot === "other" || slot === "virtual") return undefined;
  const equipmentState = getSnapshotEquipmentState(participant);
  const activeLoadoutsValue = equipmentState?.["activeLoadoutByCharacterId"];
  const activeLoadouts = isRecord(activeLoadoutsValue) ? activeLoadoutsValue : undefined;
  const characterId =
    participant.characterId ??
    (activeLoadouts ? Object.keys(activeLoadouts).find((key) => key.trim().length > 0) : undefined);
  const activeLoadoutValue = characterId ? activeLoadouts?.[characterId] : undefined;
  const activeLoadout = isRecord(activeLoadoutValue) ? activeLoadoutValue : undefined;
  const field =
    slot === "primary"
      ? "activePrimaryWeaponItemId"
      : slot === "secondary"
        ? "activeSecondaryWeaponItemId"
        : "activeMissileWeaponItemId";
  const itemId = activeLoadout?.[field];
  return typeof itemId === "string" && itemId.length > 0 ? itemId : undefined;
}

function getEquipmentItemTemplate(input: {
  itemId: string;
  itemsById: Record<string, unknown>;
  templatesById: Record<string, unknown> | undefined;
}): WeaponTemplate | undefined {
  const item = input.itemsById[input.itemId];
  const templateId = isRecord(item) ? item["templateId"] : undefined;
  const template = typeof templateId === "string" ? input.templatesById?.[templateId] : undefined;

  const contentTemplate =
    typeof templateId === "string"
      ? weaponTemplates.find((candidate) => candidate.id === templateId)
      : undefined;

  if (isWeaponTemplateLike(template) && isWeaponTemplateLike(contentTemplate)) {
    return {
      ...template,
      attackModes: contentTemplate.attackModes ?? template.attackModes,
    };
  }

  if (isWeaponTemplateLike(template)) return template;
  return isWeaponTemplateLike(contentTemplate) ? contentTemplate : undefined;
}

function resolveDeclaredWeaponSource(input: {
  phaseLabel: "Phase 1" | "Phase 2";
  participant: ScenarioParticipant;
  source: Extract<CombatAttackSourceRef, { sourceKind: "weapon" }>;
}):
  | {
      ok: true;
      source: {
        attackModeId: string;
        itemId: string;
        isThrownAttack: boolean;
        repeatEligible: boolean;
        weaponArmorClass?: ReturnType<typeof normalizeCombatArmorModifierClass>;
        weaponCriticalCode?: string;
        weaponDamageClass?: string;
        weaponDmb?: number;
        weaponName: string;
        weaponSkill: string;
        weaponTemplateId: string;
      };
    }
  | { error: string; ok: false } {
  const itemId = input.source.scenarioItemId;
  const equipmentState = getSnapshotEquipmentState(input.participant);
  const itemsById = isRecord(equipmentState?.["itemsById"])
    ? (equipmentState?.["itemsById"] as Record<string, unknown>)
    : undefined;
  const usableItemIds = new Set([
    ...getScenarioParticipantActiveWeaponItemIds(input.participant),
    ...getScenarioParticipantReadyItemIds(input.participant),
  ]);
  if (!itemsById || !itemsById[itemId]) {
    return { error: `The selected ${input.phaseLabel} weapon source is missing.`, ok: false };
  }
  const expectedSlotItemId = getScenarioParticipantWeaponItemIdForSlot(
    input.participant,
    input.source.slot,
  );
  const isReadyOtherSource =
    input.source.slot === "other" &&
    getScenarioParticipantReadyItemIds(input.participant).includes(itemId);
  const isExplicitThrowingSource = input.source.slot === "throwing";
  if (
    !usableItemIds.has(itemId) ||
    (!isReadyOtherSource && !isExplicitThrowingSource && expectedSlotItemId !== itemId)
  ) {
    return { error: `The selected ${input.phaseLabel} weapon is not ready.`, ok: false };
  }
  const item = itemsById[itemId];
  const storedTemplateId = isRecord(item) ? item["templateId"] : undefined;
  if (storedTemplateId !== input.source.templateId) {
    return {
      error: `The selected ${input.phaseLabel} weapon source does not match its equipment template.`,
      ok: false,
    };
  }
  const template = getEquipmentItemTemplate({
    itemId,
    itemsById,
    templatesById: getEquipmentTemplatesById(equipmentState),
  });
  if (!template) {
    return { error: `The selected ${input.phaseLabel} weapon source is missing.`, ok: false };
  }
  const mode = template.attackModes?.find(
    (candidate) => candidate.id === input.source.attackModeId,
  );
  const isExplicitThrownMode = input.source.slot === "throwing" && isThrownWeaponAttackMode(mode);
  if (!mode || (mode.canonicalMeleeMode == null && !isExplicitThrownMode)) {
    return {
      error: `${template.name} does not have the selected ${input.phaseLabel} attack mode.`,
      ok: false,
    };
  }
  return {
    ok: true,
    source: {
      attackModeId: mode.id,
      itemId,
      isThrownAttack: isExplicitThrownMode,
      repeatEligible: canRepeatWeaponAttackInRound(mode),
      weaponArmorClass: normalizeCombatArmorModifierClass(mode.armorModifier),
      weaponCriticalCode:
        mode.crit && mode.secondCrit ? `${mode.crit}${mode.secondCrit}` : (mode.crit ?? undefined),
      weaponDamageClass: mode.damageClass ?? undefined,
      weaponDmb: mode.dmb ?? undefined,
      weaponName: template.name,
      weaponSkill: template.weaponSkill,
      weaponTemplateId: template.id,
    },
  };
}

function buildDeclaredAttackOpportunitySource(input: {
  source: CombatAttackSourceRef;
  weapon?: {
    attackModeId: string;
    itemId: string;
    weaponTemplateId: string;
  };
}) {
  return input.source.sourceKind === "weapon" && input.weapon
    ? {
        attackModeId: input.weapon.attackModeId,
        itemId: input.weapon.itemId,
        sourceKind: "weapon" as const,
        weaponInstanceId: input.weapon.itemId,
        weaponSourceSlot: input.source.slot,
        weaponTemplateId: input.weapon.weaponTemplateId,
      }
    : {
        attackModeId: input.source.attackModeId,
        sourceKind: "unarmed" as const,
        weaponSourceSlot: "virtual" as const,
        weaponTemplateId: input.source.templateId,
      };
}

function buildAttackSourceRefFromDeclaredOpportunity(
  opportunity: CombatRoundAttackOpportunity | undefined,
): CombatAttackSourceRef | undefined {
  if (
    !opportunity?.attackModeId ||
    !opportunity.weaponTemplateId ||
    !opportunity.weaponSourceSlot
  ) {
    return undefined;
  }
  if (opportunity.sourceKind === "unarmed") {
    if (opportunity.weaponSourceSlot !== "virtual") return undefined;
    return {
      attackModeId: opportunity.attackModeId,
      opportunitySlot: opportunity.slot,
      slot: "virtual",
      sourceKind: "unarmed",
      templateId: opportunity.weaponTemplateId,
    };
  }
  const itemId = opportunity.weaponInstanceId ?? opportunity.itemId;
  if (
    opportunity.sourceKind !== "weapon" ||
    !itemId ||
    opportunity.weaponSourceSlot === "virtual"
  ) {
    return undefined;
  }
  return {
    attackModeId: opportunity.attackModeId,
    opportunitySlot: opportunity.slot,
    scenarioItemId: itemId,
    slot: opportunity.weaponSourceSlot,
    sourceKind: "weapon",
    templateId: opportunity.weaponTemplateId,
  };
}

function resolveCanonicalAttackOpportunityWeaponFacts(input: {
  opportunity: ReturnType<typeof getCombatRoundPhaseAttackCandidates>[number];
  participant: ScenarioParticipant;
}):
  | {
      attackModeId: string;
      isThrownAttack: boolean;
      weaponArmorClass?: ReturnType<typeof normalizeCombatArmorModifierClass>;
      weaponCriticalCode?: string;
      weaponDamageClass?: string;
      weaponDmb?: number;
      weaponName: string;
    }
  | undefined {
  if (
    !input.opportunity.attackModeId ||
    !input.opportunity.weaponTemplateId ||
    !input.opportunity.weaponSourceSlot
  ) {
    return undefined;
  }
  if (input.opportunity.sourceKind === "weapon") {
    const itemId = input.opportunity.weaponInstanceId ?? input.opportunity.itemId;
    if (!itemId || input.opportunity.weaponSourceSlot === "virtual") return undefined;
    const resolution = resolveDeclaredWeaponSource({
      participant: input.participant,
      phaseLabel: input.opportunity.phase === "phase1" ? "Phase 1" : "Phase 2",
      source: {
        attackModeId: input.opportunity.attackModeId,
        opportunitySlot: input.opportunity.slot,
        scenarioItemId: itemId,
        slot: input.opportunity.weaponSourceSlot,
        sourceKind: "weapon",
        templateId: input.opportunity.weaponTemplateId,
      },
    });
    return resolution.ok
      ? {
          attackModeId: resolution.source.attackModeId,
          isThrownAttack: resolution.source.isThrownAttack,
          weaponArmorClass: resolution.source.weaponArmorClass,
          weaponCriticalCode: resolution.source.weaponCriticalCode,
          weaponDamageClass: resolution.source.weaponDamageClass,
          weaponDmb: resolution.source.weaponDmb,
          weaponName: resolution.source.weaponName,
        }
      : undefined;
  }
  if (input.opportunity.sourceKind !== "unarmed") return undefined;
  const template = [punchTemplate, kickTemplate].find(
    (candidate) => candidate.id === input.opportunity.weaponTemplateId,
  );
  const mode = template?.attackModes?.find(
    (candidate) => candidate.id === input.opportunity.attackModeId,
  );
  if (!template || !mode) return undefined;
  return {
    attackModeId: mode.id,
    isThrownAttack: false,
    weaponArmorClass: normalizeCombatArmorModifierClass(mode.armorModifier),
    weaponCriticalCode:
      mode.crit && mode.secondCrit ? `${mode.crit}${mode.secondCrit}` : (mode.crit ?? undefined),
    weaponDamageClass: mode.damageClass ?? undefined,
    weaponDmb: mode.dmb ?? undefined,
    weaponName: template.name,
  };
}

function getSnapshotActiveWeaponTemplates(participant: ScenarioParticipant): WeaponTemplate[] {
  const equipmentState = getSnapshotEquipmentState(participant);
  const activeWeaponItemIds = getScenarioParticipantActiveWeaponItemIds(participant);
  const readyItemIds = getScenarioParticipantReadyItemIds(participant);
  const candidateWeaponItemIds = [...new Set([...activeWeaponItemIds, ...readyItemIds])];
  const itemsValue = equipmentState?.["itemsById"];
  const itemsById = isRecord(itemsValue) ? itemsValue : undefined;
  const templatesById = getEquipmentTemplatesById(equipmentState);

  if (!itemsById) {
    return [];
  }

  return candidateWeaponItemIds
    .map((itemId) => getEquipmentItemTemplate({ itemId, itemsById, templatesById }))
    .filter((template): template is WeaponTemplate => Boolean(template));
}

function participantAliasesInclude(input: {
  id?: string;
  participant: Parameters<typeof getCombatDistanceParticipantAliases>[0];
}): boolean {
  if (!input.id) {
    return false;
  }

  return getCombatDistanceParticipantAliases(input.participant).includes(input.id);
}

function findCombatRoundParticipantByAlias(input: {
  id?: string;
  state: CombatRoundState;
}): CombatRoundState["participants"][number] | undefined {
  return input.state.participants.find((participant) =>
    participantAliasesInclude({ id: input.id, participant }),
  );
}

function findEncounterParticipantByScenarioParticipant(input: {
  encounterParticipants: EncounterSession["participants"];
  scenarioParticipant?: ScenarioParticipant;
}): EncounterSession["participants"][number] | undefined {
  return input.scenarioParticipant
    ? input.encounterParticipants.find(
        (participant) =>
          participant.scenarioParticipantId === input.scenarioParticipant?.id ||
          participant.id === input.scenarioParticipant?.id ||
          (input.scenarioParticipant?.characterId &&
            participant.characterId === input.scenarioParticipant.characterId),
      )
    : undefined;
}

function findScenarioParticipantForEncounterParticipant(input: {
  encounterParticipant?: EncounterSession["participants"][number];
  scenarioParticipants: ScenarioParticipant[];
}): ScenarioParticipant | undefined {
  const encounterParticipant = input.encounterParticipant;
  if (!encounterParticipant) {
    return undefined;
  }

  return input.scenarioParticipants.find(
    (participant) =>
      participant.id === encounterParticipant.scenarioParticipantId ||
      participant.id === encounterParticipant.id ||
      (participant.characterId && participant.characterId === encounterParticipant.characterId),
  );
}

function buildCurrentAttackModifierValidation(input: {
  allowedAttackerParticipantIds?: ReadonlySet<string>;
  encounterId: string;
  encounterParticipants: EncounterSession["participants"];
  encounterRevision: string;
  projection: CombatProgressionProjection;
  roundState: CombatRoundState;
  scenarioParticipants: ScenarioParticipant[];
}): CombatAttackModifierValidationProjection | undefined {
  const task = selectCurrentCombatModifierValidationTask({
    allowedParticipantIds: input.allowedAttackerParticipantIds,
    kind: "attack",
    projection: input.projection,
  });
  if (!task || task.owner?.kind !== "combatant" || !task.identity.phase) return undefined;
  const attackerParticipantId = task.owner.participantId;
  const attackerEncounterParticipant = input.encounterParticipants.find((participant) =>
    participantAliasesInclude({ id: attackerParticipantId, participant }),
  );
  const candidate = getCombatRoundPhaseAttackCandidates({
    phase: task.identity.phase,
    state: input.roundState,
  }).find(
    (entry) =>
      entry.participantId === attackerParticipantId &&
      (task.identity.opportunityId === undefined || entry.id === task.identity.opportunityId),
  );
  const defenderEncounterParticipant = input.encounterParticipants.find((participant) =>
    participantAliasesInclude({ id: candidate?.targetParticipantId, participant }),
  );
  if (!attackerEncounterParticipant || !defenderEncounterParticipant) return undefined;
  const attackerScenarioParticipant = findScenarioParticipantForEncounterParticipant({
    encounterParticipant: attackerEncounterParticipant,
    scenarioParticipants: input.scenarioParticipants,
  });
  const defenderScenarioParticipant = findScenarioParticipantForEncounterParticipant({
    encounterParticipant: defenderEncounterParticipant,
    scenarioParticipants: input.scenarioParticipants,
  });
  if (!attackerScenarioParticipant || !defenderScenarioParticipant) return undefined;
  const facts = resolveCanonicalCombatAttackModifierFacts({
    attackerCombatantId: attackerEncounterParticipant.id,
    attackerScenarioParticipant,
    defenderCombatantId: defenderEncounterParticipant.id,
    defenderScenarioParticipant,
    encounterId: input.encounterId,
    opportunityId: candidate?.id ?? task.identity.opportunityId,
    phase: task.identity.phase,
    state: input.roundState,
  });
  const canonicalWeaponFacts = candidate
    ? resolveCanonicalAttackOpportunityWeaponFacts({
        opportunity: candidate,
        participant: attackerScenarioParticipant,
      })
    : undefined;
  const canonicalDefense = resolveCanonicalScenarioParticipantDefense({
    defenderResolution: facts.defenderResolution,
    flatDbResolution: facts.defenderFlatResolution,
    participant: defenderScenarioParticipant,
  });
  const latestDefenderSnapshot =
    canonicalDefense.completeness === "complete"
      ? undefined
      : findLegacyCombatDefenseSnapshot({
          defenderParticipantId: defenderEncounterParticipant.id,
          phase: task.identity.phase,
          state: input.roundState,
        });
  const legacyDefenderDb = latestDefenderSnapshot
    ? resolveLegacyAttackDefenderDb({
        currentFlatAdjustment: getMergedCombatDbFlatAdjustmentTotal({
          combatContext: facts.defenderCombatContext,
          phase: task.identity.phase,
        }),
        snapshot: latestDefenderSnapshot,
      })
    : undefined;

  return {
    actionId: facts.attackerActionId,
    attackContextAvailability:
      canonicalWeaponFacts?.weaponName &&
      (canonicalDefense.completeness === "complete" || legacyDefenderDb !== undefined)
        ? "complete"
        : "unavailable_required",
    attackerModifierFingerprint: fingerprintCombatModifierResolution(facts.attackerResolution),
    attackerParticipantId: attackerEncounterParticipant.id,
    defenderParticipantId: defenderEncounterParticipant.id,
    effectCutoffInitiativeGroupId: task.identity.initiativeGroupId,
    encounterId: input.encounterId,
    expectedRevision: input.encounterRevision,
    initiativeGroupId: task.identity.initiativeGroupId,
    initiativeValue: task.identity.initiativeValue,
    obSkillRaw: facts.attackerResolution.total,
    opportunityId: facts.declaredOpportunity?.id ?? task.identity.opportunityId,
    pairKey: facts.pairKey,
    phase: task.identity.phase,
    proposalId: facts.attackerProposalId,
    taskId: task.id,
  };
}

function findLegacyCombatDefenseSnapshot(input: {
  defenderParticipantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundStepSnapshot | undefined {
  return [...input.state.stepSnapshots]
    .reverse()
    .find(
      (snapshot) =>
        snapshot.roundNumber === input.state.roundNumber &&
        snapshot.participantId === input.defenderParticipantId &&
        snapshot.phase === input.phase &&
        (snapshot.defenseSummary ?? snapshot.phasePanels?.[input.phase]?.defenseSummary),
    );
}

function resolveLegacyAttackDefenderDb(input: {
  currentFlatAdjustment: number;
  snapshot?: CombatRoundStepSnapshot;
}): number | undefined {
  const summary =
    input.snapshot?.defenseSummary ??
    (input.snapshot?.phase
      ? input.snapshot.phasePanels?.[input.snapshot.phase]?.defenseSummary
      : undefined);
  const snapshotDb = parseCombatSummaryInteger(summary?.db, "Defender DB");

  return snapshotDb !== undefined
    ? snapshotDb +
        input.currentFlatAdjustment -
        (input.snapshot?.modifierSummary?.dbFlatAdjustment ?? 0)
    : undefined;
}

function buildAcceptedCombatDefenseCalculationFact(input: {
  calculation: ReturnType<typeof resolveCanonicalScenarioParticipantDefense>;
  cutoffInitiativeGroupId?: string;
  cutoffSequence: number;
  defenderResolution: ReturnType<
    typeof resolveCanonicalCombatAttackModifierFacts
  >["defenderResolution"];
  flatResolution: ReturnType<
    typeof resolveCanonicalCombatAttackModifierFacts
  >["defenderFlatResolution"];
  effectiveDb: number;
  legacySnapshot?: CombatRoundStepSnapshot;
}) {
  if (input.calculation.completeness !== "complete") {
    return acceptedCombatDefenseCalculationSchema.parse({
      authority: "legacy_combat_round_step_snapshot" as const,
      completeness: "legacy_incomplete" as const,
      cutoffInitiativeGroupId: input.cutoffInitiativeGroupId,
      cutoffSequence: input.cutoffSequence,
      effectiveDb: input.effectiveDb,
      schemaVersion: 1,
      sourceSnapshotId: input.legacySnapshot?.id,
    });
  }

  return acceptedCombatDefenseCalculationSchema.parse({
    authority: input.calculation.authority,
    baseDb: input.calculation.baseDb,
    completeness: input.calculation.completeness,
    cutoffInitiativeGroupId: input.cutoffInitiativeGroupId,
    cutoffSequence: input.cutoffSequence,
    dynamicContributions: input.defenderResolution.rows.map((row) => ({
      id: row.id,
      label: row.label,
      sourceId: row.sourceId,
      value: row.value,
    })),
    dynamicRawPercentage: input.defenderResolution.total,
    effectiveDb: input.calculation.effectiveDb,
    effectiveDm: input.calculation.effectiveDm,
    equipment: input.calculation.equipment,
    equipmentLoadoutRevision: input.calculation.equipmentLoadoutRevision,
    flatContributions: input.flatResolution.rows.map((row) => ({
      id: row.id,
      label: row.label,
      sourceId: row.sourceId,
      value: row.value,
    })),
    flatDbAdjustment: input.calculation.flatDbAdjustment,
    participantId: input.calculation.participantId,
    percentageAdjustment: input.calculation.percentage.fullAdjustment,
    percentageTrace: input.calculation.percentage.fullTrace,
    schemaVersion: 1,
    sourceSnapshotId: input.calculation.sourceSnapshotId,
    toHitModifier: input.calculation.toHitModifier,
  });
}

function getAcceptedCombatDefenseDm(input: {
  attackResultId: string;
  state: CombatRoundState;
}): number | undefined {
  const command = [...input.state.commands]
    .reverse()
    .find(
      (candidate) =>
        candidate.type === "roll_attack" && candidate.facts.attackResultId === input.attackResultId,
    );
  const calculation = acceptedCombatDefenseCalculationSchema.safeParse(
    command?.facts.defenderCalculation,
  );
  return calculation.success && calculation.data.authority === "canonical_scenario_state"
    ? calculation.data.effectiveDm
    : undefined;
}

function buildCurrentParryModifierValidation(input: {
  allowedDefenderParticipantIds?: ReadonlySet<string>;
  encounterId: string;
  encounterParticipants: EncounterSession["participants"];
  encounterRevision: string;
  projection: CombatProgressionProjection;
  roundState: CombatRoundState;
  scenarioParticipants: ScenarioParticipant[];
}): CombatParryModifierValidationProjection | undefined {
  const task = selectCurrentCombatModifierValidationTask({
    allowedParticipantIds: input.allowedDefenderParticipantIds,
    kind: "parry",
    projection: input.projection,
  });
  if (
    !task ||
    task.owner?.kind !== "combatant" ||
    !task.identity.attackResultId ||
    !task.identity.attackerParticipantId ||
    !task.identity.defenderParticipantId ||
    !task.identity.opportunityId ||
    !task.identity.parryPurpose ||
    !task.identity.parrySourceId
  ) {
    return undefined;
  }
  const attackResult = getCombatRoundAttackResultById({
    attackResultId: task.identity.attackResultId,
    state: input.roundState,
  });
  const defenderEncounterParticipant = input.encounterParticipants.find((participant) =>
    participantAliasesInclude({
      id: task.identity.defenderParticipantId,
      participant,
    }),
  );
  const attackerEncounterParticipant = input.encounterParticipants.find((participant) =>
    participantAliasesInclude({
      id: task.identity.attackerParticipantId,
      participant,
    }),
  );
  const defenderScenarioParticipant = findScenarioParticipantForEncounterParticipant({
    encounterParticipant: defenderEncounterParticipant,
    scenarioParticipants: input.scenarioParticipants,
  });
  const attackerScenarioParticipant = findScenarioParticipantForEncounterParticipant({
    encounterParticipant: attackerEncounterParticipant,
    scenarioParticipants: input.scenarioParticipants,
  });
  if (
    !attackResult ||
    !defenderEncounterParticipant ||
    !attackerEncounterParticipant ||
    !defenderScenarioParticipant
  ) {
    return undefined;
  }
  const facts = resolveCanonicalCombatParryModifierFacts({
    attackerScenarioParticipant,
    attackResult,
    defenderCombatantId: defenderEncounterParticipant.id,
    defenderScenarioParticipant,
    encounterId: input.encounterId,
    state: input.roundState,
  });

  return {
    attackResultId: task.identity.attackResultId,
    attackResultModifier: facts.attackResultModifier,
    attackerParticipantId: attackerEncounterParticipant.id,
    dbParryRaw: facts.defenderResolution.total,
    defenderModifierFingerprint: fingerprintCombatModifierResolution(facts.defenderResolution),
    defenderParticipantId: defenderEncounterParticipant.id,
    disarmAttemptId: task.identity.disarmAttemptId,
    effectCutoffInitiativeGroupId: task.identity.initiativeGroupId,
    encounterId: input.encounterId,
    expectedRevision: input.encounterRevision,
    initiativeGroupId: task.identity.initiativeGroupId,
    initiativeValue: task.identity.initiativeValue,
    opportunityId: task.identity.opportunityId,
    parryPurpose: task.identity.parryPurpose,
    parrySourceId: task.identity.parrySourceId,
    processId: task.processId,
    stageId: task.stageId,
    taskId: task.id,
  };
}

function buildDistanceDefaultWeaponsByParticipantId(input: {
  encounter: EncounterParticipantReadSource;
  scenarioParticipants: ScenarioParticipant[];
}): Record<string, readonly CombatDistanceWeaponLike[]> {
  const membership = resolveEncounterParticipantMembership(input);

  return Object.fromEntries(
    membership.participants.map((encounterParticipant) => {
      const scenarioParticipant = input.scenarioParticipants.find(
        (participant) =>
          participant.id === encounterParticipant.scenarioParticipantId ||
          participant.id === encounterParticipant.id ||
          (participant.characterId && participant.characterId === encounterParticipant.characterId),
      );

      return [
        encounterParticipant.id,
        scenarioParticipant ? getSnapshotActiveWeaponTemplates(scenarioParticipant) : [],
      ];
    }),
  );
}

function materializeCombatRoundDistanceDefaults(input: {
  encounter: EncounterParticipantReadSource;
  roundState: CombatRoundState;
  scenarioParticipants: ScenarioParticipant[];
}): CombatRoundState {
  return {
    ...input.roundState,
    distanceState: ensureDistanceEdgesForParticipantPairs({
      lastChangedRound: input.roundState.roundNumber,
      participantIds: input.roundState.participants.map((participant) => participant.participantId),
      refreshFallbackDefaultEdges: true,
      state: input.roundState.distanceState,
      weaponsByParticipantId: buildDistanceDefaultWeaponsByParticipantId({
        encounter: input.encounter,
        scenarioParticipants: input.scenarioParticipants,
      }),
    }),
  };
}

function initializeMaterializedCombatRoundState(input: {
  encounter: EncounterParticipantReadSource & {
    combatRoundState?: CombatRoundState;
    currentRound: number;
    id: string;
  };
  scenarioParticipants: ScenarioParticipant[];
}): CombatRoundState {
  const membership = resolveEncounterParticipantMembership(input);
  const effectiveEncounter =
    membership.participants === input.encounter.participants
      ? input.encounter
      : { ...input.encounter, participants: membership.participants };
  const roundState = initializeCombatRoundState({
    encounter: effectiveEncounter,
    weaponsByParticipantId: buildDistanceDefaultWeaponsByParticipantId(input),
  });

  return materializeCombatRoundDistanceDefaults({
    encounter: input.encounter,
    roundState,
    scenarioParticipants: input.scenarioParticipants,
  });
}

function projectAcceptedDeterministicAdvance(input: {
  encounter: EncounterSession;
  scenarioParticipants: readonly ScenarioParticipant[];
}): ActiveCombatDeterministicAdvanceDescriptor | undefined {
  const state = initializeMaterializedCombatRoundState({
    encounter: input.encounter,
    scenarioParticipants: [...input.scenarioParticipants],
  });
  const participation = projectActiveCombatParticipation({
    encounterRevision: input.encounter.updatedAt,
    scenarioParticipants: input.scenarioParticipants,
    state,
  });
  const task = getCurrentExecutableCombatTasks(
    buildCombatProgressionProjection(state, { participation }),
  )[0];
  return task && isCompleteDeterministicCombatTask(task)
    ? {
        executionGroupId: task.executionGroupId,
        expectedRevision: input.encounter.updatedAt,
        taskId: task.id,
      }
    : undefined;
}

type ApiCombatStepAutomationProjection = CombatStepAutomationProjection<CombatRoundState> & {
  participation: ReturnType<typeof projectActiveCombatParticipation>;
};

type ResolvedDeclaredWeaponSource = Extract<
  ReturnType<typeof resolveDeclaredWeaponSource>,
  { ok: true }
>["source"];

interface ApiCombatNpcDeclarationProposalResolution {
  phaseSources: Readonly<Partial<Record<CombatRoundPhase, CombatAttackSourceRef>>>;
  proposal: CombatNpcDeclarationProposal;
  resolvedFeintWeapon?: ResolvedDeclaredWeaponSource;
  resolvedWeapons: Readonly<Partial<Record<CombatRoundPhase, ResolvedDeclaredWeaponSource>>>;
}

function resolveProposalAttackSource(input: {
  participant: ScenarioParticipant;
  phase: CombatRoundPhase;
  source: CombatAttackSourceRef;
}): {
  resolvedWeapon?: ResolvedDeclaredWeaponSource;
  status: CombatNpcDeclarationSourceStatus;
} {
  if (input.source.sourceKind === "weapon") {
    const resolution = resolveDeclaredWeaponSource({
      participant: input.participant,
      phaseLabel: input.phase === "phase1" ? "Phase 1" : "Phase 2",
      source: input.source,
    });
    if (resolution.ok) return { resolvedWeapon: resolution.source, status: "valid" };
    return {
      status: resolution.error.includes("attack mode") ? "attack_mode_invalid" : "weapon_invalid",
    };
  }
  const template =
    input.source.templateId === punchTemplate.id
      ? punchTemplate
      : input.source.templateId === kickTemplate.id
        ? kickTemplate
        : undefined;
  if (!template) return { status: "weapon_invalid" };
  return {
    status: template.attackModes?.some((mode) => mode.id === input.source.attackModeId)
      ? "valid"
      : "attack_mode_invalid",
  };
}

function getCanonicalProposalTargetId(input: {
  encounter: EncounterSession;
  id?: string;
  state: CombatRoundState;
}): string | undefined {
  if (!input.id) return undefined;
  return findCombatRoundParticipantByAlias({ id: input.id, state: input.state })?.participantId;
}

function buildProposalContext(input: {
  current: ScenarioParticipantCombatContext;
  encounter: EncounterSession;
  source?: ScenarioParticipantCombatContext;
  state: CombatRoundState;
}): ScenarioParticipantCombatContext {
  const source: Partial<ScenarioParticipantCombatContext> = input.source ?? {};
  return scenarioParticipantCombatContextSchema.parse({
    attackModeId: source.attackModeId,
    incomingAttackSide: source.incomingAttackSide,
    mainHandParryDirection: source.mainHandParryDirection,
    modifierBuckets: input.current.modifierBuckets,
    offHandParryDirection: source.offHandParryDirection,
    parrySource: source.parrySource,
    selectedOpponentId: getCanonicalProposalTargetId({
      encounter: input.encounter,
      id: source.selectedOpponentId,
      state: input.state,
    }),
    targetLocation: source.targetLocation,
    targetParticipantId: getCanonicalProposalTargetId({
      encounter: input.encounter,
      id: source.targetParticipantId,
      state: input.state,
    }),
  });
}

function resolveApiCombatNpcDeclarationProposal(input: {
  encounter: EncounterSession;
  participant: ScenarioParticipant;
  scenarioParticipants: readonly ScenarioParticipant[];
  state: CombatRoundState;
  task: CombatProgressionTask;
}): ApiCombatNpcDeclarationProposalResolution | undefined {
  const participantId =
    input.task.owner?.kind === "combatant"
      ? input.task.owner.participantId
      : input.task.identity.participantId;
  if (!participantId) return undefined;
  const proposal = projectCombatNpcDeclarationProposal({
    encounterId: input.encounter.id,
    encounterRevision: input.encounter.updatedAt,
    participantId,
    proposalSequence: getCombatRoundNextEventSequence(input.state),
    state: input.state,
  });
  if (!proposal) return undefined;
  const membership = resolveEncounterParticipantMembership({
    encounter: input.encounter,
    scenarioParticipants: [...input.scenarioParticipants],
  });
  const validTargetParticipantIds = new Set<string>();
  for (const encounterParticipant of membership.participants) {
    if (encounterParticipant.id === participantId) continue;
    const target = input.scenarioParticipants.find(
      (candidate) =>
        candidate.id === encounterParticipant.scenarioParticipantId ||
        candidate.id === encounterParticipant.id,
    );
    if (!target?.isActive || target.state.health.dead) continue;
    validTargetParticipantIds.add(encounterParticipant.id);
    if (encounterParticipant.scenarioParticipantId) {
      validTargetParticipantIds.add(encounterParticipant.scenarioParticipantId);
    }
    if (encounterParticipant.characterId) {
      validTargetParticipantIds.add(encounterParticipant.characterId);
    }
  }

  const phaseSources = getCombatNpcDeclarationProposalAttackSources(proposal);
  const phaseSourceStatus: Partial<Record<CombatRoundPhase, CombatNpcDeclarationSourceStatus>> = {};
  const resolvedWeapons: Partial<Record<CombatRoundPhase, ResolvedDeclaredWeaponSource>> = {};
  for (const phase of ["phase1", "phase2"] as const) {
    const source = phaseSources[phase];
    if (!source) continue;
    const resolution = resolveProposalAttackSource({
      participant: input.participant,
      phase,
      source,
    });
    phaseSourceStatus[phase] = resolution.status;
    if (resolution.resolvedWeapon) resolvedWeapons[phase] = resolution.resolvedWeapon;
  }

  const feintWeaponSource = proposal.sourceDeclaration.feint?.weaponSource;
  const feintWeaponResolution = feintWeaponSource
    ? resolveProposalAttackSource({
        participant: input.participant,
        phase: "phase1",
        source: feintWeaponSource,
      })
    : undefined;
  const feintTargetId = getCanonicalProposalTargetId({
    encounter: input.encounter,
    id: proposal.sourceDeclaration.feint?.targetParticipantId,
    state: input.state,
  });
  const feintTarget = feintTargetId
    ? input.scenarioParticipants.find((candidate) => {
        const encounterParticipant = membership.participants.find(
          (participant) => participant.id === feintTargetId,
        );
        return (
          candidate.id === encounterParticipant?.scenarioParticipantId ||
          candidate.id === encounterParticipant?.id
        );
      })
    : undefined;
  const defenderFeintProfile = feintTarget
    ? resolveHighestCombatFeintResistanceProfile({
        ...getScenarioParticipantFeintSkillInput(feintTarget),
        skills: defaultCanonicalContent.skills,
      })
    : undefined;
  const feintAttackerSkill =
    proposal.sourceDeclaration.actionId !== "feint_attack"
      ? undefined
      : proposal.sourceDeclaration.feint?.method === "movement"
        ? defaultCanonicalContent.skills.find((skill) => skill.id === "dodge")
        : feintWeaponResolution?.resolvedWeapon
          ? resolveCombatFeintWeaponSkillDefinition({
              skills: defaultCanonicalContent.skills,
              specializations: defaultCanonicalContent.specializations,
              weaponSkill: feintWeaponResolution.resolvedWeapon.weaponSkill,
            })
          : undefined;
  const adjustTarget = getCanonicalProposalTargetId({
    encounter: input.encounter,
    id: proposal.sourceDeclaration.adjustDistance?.targetParticipantId,
    state: input.state,
  });
  const adjustDistanceEdge = adjustTarget
    ? getDistanceEdgeBetweenParticipantAliases({
        participantA: membership.participants.find((candidate) => candidate.id === participantId),
        participantB: membership.participants.find((candidate) => candidate.id === adjustTarget),
        state: input.state.distanceState,
      })
    : undefined;
  const adjustDistanceValid =
    proposal.sourceDeclaration.actionId !== "adjust_range_attack" ||
    Boolean(
      adjustTarget &&
      adjustDistanceEdge &&
      proposal.sourceDeclaration.adjustDistance &&
      proposal.sourceDeclaration.adjustDistance.requestedDistance !== adjustDistanceEdge.distance,
    );
  let doubleAttackValid = true;
  if (proposal.sourceDeclaration.actionId === "double_attack") {
    const phase1 = phaseSources.phase1;
    const phase2 = phaseSources.phase2;
    const phase1Identity =
      phase1?.sourceKind === "weapon"
        ? phase1.scenarioItemId
        : phase1
          ? `${phase1.sourceKind}:${phase1.templateId}`
          : undefined;
    const phase2Identity =
      phase2?.sourceKind === "weapon"
        ? phase2.scenarioItemId
        : phase2
          ? `${phase2.sourceKind}:${phase2.templateId}`
          : undefined;
    doubleAttackValid = Boolean(
      phase1Identity &&
      phase2Identity &&
      (phase1Identity !== phase2Identity || resolvedWeapons.phase2?.repeatEligible),
    );
  }
  const declarationCompatibility = validateCombatDeclarationCompatibility({
    movementKind: proposal.sourceDeclaration.movementIntent?.mode,
    primaryAction: proposal.sourceDeclaration.actionId,
    secondaryAction: proposal.sourceDeclaration.secondaryActionId,
  });
  const encounterParticipant = membership.participants.find(
    (candidate) => candidate.id === participantId,
  );
  let movementValid =
    proposal.sourceDeclaration.movementIntent?.distancePreferences.every((preference) =>
      validTargetParticipantIds.has(preference.targetParticipantId),
    ) ?? true;
  if (movementValid && proposal.sourceDeclaration.movementIntent && encounterParticipant) {
    try {
      normalizeCombatDeclarationMovementIntent({
        encounter: input.encounter,
        encounterParticipant,
        gmAuthorizedOperation: true,
        movementIntent: proposal.sourceDeclaration.movementIntent,
        roundState: input.state,
      });
    } catch {
      movementValid = false;
    }
  }
  const participantRuleValid =
    proposal.sourceDeclaration.actionId !== "parry" ||
    getScenarioParticipantDodgeSkillValue(input.participant) !== undefined;
  const validation = validateCombatNpcDeclarationProposal({
    facts: {
      adjustDistanceValid,
      currentDeclarationExists: Boolean(
        input.state.participants.find((candidate) => candidate.participantId === participantId)
          ?.declaration,
      ),
      declarationStillLegal:
        declarationCompatibility.valid && doubleAttackValid && participantRuleValid,
      feintValid:
        proposal.sourceDeclaration.actionId !== "feint_attack" ||
        Boolean(feintTarget && defenderFeintProfile && feintAttackerSkill),
      feintWeaponStatus: feintWeaponResolution?.status,
      movementValid,
      participantActive: input.participant.isActive,
      participantCapable:
        !input.participant.state.health.dead && !input.participant.state.health.unconscious,
      participantGmControlled: !input.participant.controlledByUserId,
      phaseSourceStatus,
      validTargetParticipantIds,
    },
    proposal,
  });
  return {
    phaseSources,
    proposal: validation,
    resolvedFeintWeapon: feintWeaponResolution?.resolvedWeapon,
    resolvedWeapons,
  };
}

function prepareAcceptedNpcDeclarationProposal(input: {
  encounter: EncounterSession;
  encounterParticipant: EncounterSession["participants"][number];
  participant: ScenarioParticipant;
  resolution: ApiCombatNpcDeclarationProposalResolution;
  scenarioParticipants: readonly ScenarioParticipant[];
  state: CombatRoundState;
  submittedAt: string;
  userId: string;
}):
  | {
      declaration: Omit<CombatRoundDeclaration, "submittedBy">;
      participantState: ScenarioParticipantState;
    }
  | undefined {
  const { proposal } = input.resolution;
  if (proposal.validation.status !== "complete") return undefined;
  const source = proposal.sourceDeclaration;
  const currentContext = scenarioParticipantCombatContextSchema.parse(
    input.participant.state.combat.combatContext ?? {},
  );
  const phaseContexts = {
    phase1: source.phaseContexts?.phase1
      ? buildProposalContext({
          current: currentContext,
          encounter: input.encounter,
          source: source.phaseContexts.phase1,
          state: input.state,
        })
      : undefined,
    phase2: source.phaseContexts?.phase2
      ? buildProposalContext({
          current: currentContext,
          encounter: input.encounter,
          source: source.phaseContexts.phase2,
          state: input.state,
        })
      : undefined,
  };
  for (const phase of ["phase1", "phase2"] as const) {
    const sourceRef = input.resolution.phaseSources[phase];
    if (sourceRef && phaseContexts[phase]) {
      phaseContexts[phase] = scenarioParticipantCombatContextSchema.parse({
        ...phaseContexts[phase],
        attackModeId:
          input.resolution.resolvedWeapons[phase]?.attackModeId ?? sourceRef.attackModeId,
      });
    }
  }
  const combatContext = buildProposalContext({
    current: currentContext,
    encounter: input.encounter,
    source: source.combatContext,
    state: input.state,
  });
  const movementIntent = normalizeCombatDeclarationMovementIntent({
    encounter: input.encounter,
    encounterParticipant: input.encounterParticipant,
    gmAuthorizedOperation: true,
    movementIntent: source.movementIntent,
    roundState: input.state,
  });
  const secondaryActionContext =
    source.secondaryActionId === "observe_opponent" && source.secondaryActionContext
      ? scenarioParticipantSecondaryActionContextSchema.parse({
          action: "observe_opponent",
          targetParticipantId: getCanonicalProposalTargetId({
            encounter: input.encounter,
            id: source.secondaryActionContext.targetParticipantId,
            state: input.state,
          }),
        })
      : source.secondaryActionContext;
  const opportunitySources: Parameters<
    typeof buildCombatRoundDeclaredAttackOpportunities
  >[0]["sources"] = {};
  for (const phase of ["phase1", "phase2"] as const) {
    const sourceRef = input.resolution.phaseSources[phase];
    if (sourceRef) {
      opportunitySources[phase] = buildDeclaredAttackOpportunitySource({
        source: sourceRef,
        weapon: input.resolution.resolvedWeapons[phase],
      });
    }
  }
  const attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
    actionId: source.actionId,
    participantId: input.encounterParticipant.id,
    phaseContexts,
    roundNumber: input.state.roundNumber,
    secondaryActionId: source.secondaryActionId,
    sources: opportunitySources,
  });
  const attackPhaseDefensivePenalties = resolveCombatAttackPhaseDefensivePenalties({
    commitment: "committed",
    opportunities: attackOpportunities,
    participantId: input.encounterParticipant.id,
    roundNumber: input.state.roundNumber,
  });
  let feint: CombatRoundDeclaration["feint"];
  if (source.actionId === "feint_attack" && source.feint) {
    const targetParticipantId = getCanonicalProposalTargetId({
      encounter: input.encounter,
      id: source.feint.targetParticipantId,
      state: input.state,
    });
    const targetEncounterParticipant = input.encounter.participants.find(
      (participant) => participant.id === targetParticipantId,
    );
    const target = input.scenarioParticipants.find(
      (participant) =>
        participant.id === targetEncounterParticipant?.scenarioParticipantId ||
        participant.id === targetEncounterParticipant?.id,
    );
    const defenderProfile = target
      ? resolveHighestCombatFeintResistanceProfile({
          ...getScenarioParticipantFeintSkillInput(target),
          skills: defaultCanonicalContent.skills,
        })
      : undefined;
    const attackerSkill =
      source.feint.method === "movement"
        ? defaultCanonicalContent.skills.find((skill) => skill.id === "dodge")
        : input.resolution.resolvedFeintWeapon
          ? resolveCombatFeintWeaponSkillDefinition({
              skills: defaultCanonicalContent.skills,
              specializations: defaultCanonicalContent.specializations,
              weaponSkill: input.resolution.resolvedFeintWeapon.weaponSkill,
            })
          : undefined;
    if (!targetParticipantId || !defenderProfile || !attackerSkill) return undefined;
    feint = {
      attackerSkillId: attackerSkill.id,
      attackerSkillLabel: attackerSkill.name,
      defenderSkillId: defenderProfile.skillId,
      defenderSkillLabel: defenderProfile.skillName,
      method: source.feint.method,
      targetParticipantId,
      weaponSource: source.feint.method === "weapon" ? source.feint.weaponSource : undefined,
    };
  }
  let adjustDistance: CombatRoundDeclaration["adjustDistance"];
  if (source.actionId === "adjust_range_attack" && source.adjustDistance) {
    const targetParticipantId = getCanonicalProposalTargetId({
      encounter: input.encounter,
      id: source.adjustDistance.targetParticipantId,
      state: input.state,
    });
    const targetParticipant = input.encounter.participants.find(
      (participant) => participant.id === targetParticipantId,
    );
    const edge = getDistanceEdgeBetweenParticipantAliases({
      participantA: input.encounterParticipant,
      participantB: targetParticipant,
      state: input.state.distanceState,
    });
    if (
      !targetParticipantId ||
      !edge ||
      edge.distance === source.adjustDistance.requestedDistance
    ) {
      return undefined;
    }
    adjustDistance = {
      currentDistance: edge.distance,
      requestedDistance: source.adjustDistance.requestedDistance,
      targetParticipantId,
    };
  }
  const lifecycleSequence = getCombatRoundNextEventSequence(input.state);
  const submittedCombatContext = applyGeneratedCombatActionModifiersForDeclaration({
    actionId: source.actionId,
    adjustDistance: adjustDistance
      ? { ...adjustDistance, roundNumber: input.state.roundNumber }
      : undefined,
    attackPhaseDefensivePenalties,
    combatContext,
    encounterId: input.encounter.id,
    encounterParticipant: input.encounterParticipant,
    lifecycleContext: {
      createdAt: input.submittedAt,
      createdRevision: input.encounter.updatedAt,
      createdSequence: lifecycleSequence,
      encounterId: input.encounter.id,
      ownerParticipantId: input.participant.id,
      visibility: { audience: "involved", sourceIdentity: "public" },
    },
    movementIntent,
    phaseAttackSources: input.resolution.phaseSources,
    phaseContexts,
    roundState: input.state,
    scenarioParticipant: input.participant,
    secondaryActionId: source.secondaryActionId,
  });
  const targetValidation = validateCombatDeclarationTargets({
    actingParticipantId: input.encounterParticipant.id,
    actionId: source.actionId,
    movementKind: movementIntent?.mode,
    phaseContexts,
    secondaryActionContext,
    secondaryActionId: source.secondaryActionId,
    selectedOpponentId: submittedCombatContext.selectedOpponentId,
  });
  if (!targetValidation.valid) return undefined;
  return {
    declaration: {
      actionId: source.actionId,
      additionalActionNotes: source.additionalActionNotes,
      adjustDistance,
      attackOpportunities,
      attackPhaseDefensivePenalties,
      combatContext: submittedCombatContext,
      feint,
      id: buildCombatRoundDeclarationId({
        participantId: input.encounterParticipant.id,
        roundNumber: input.state.roundNumber,
      }),
      movementId: source.movementId,
      movementIntent,
      phaseContexts,
      roundNumber: input.state.roundNumber,
      secondaryActions: secondaryActionContext ? [secondaryActionContext] : undefined,
      secondaryActionContext,
      secondaryActionId: source.secondaryActionId,
      submittedAt: input.submittedAt,
      submittedByUserId: input.userId,
    },
    participantState: {
      ...input.participant.state,
      combat: {
        ...input.participant.state.combat,
        combatContext: submittedCombatContext,
        declarationSubmittedAt: input.submittedAt,
        declarationSubmittedByUserId: input.userId,
        lastDeclaredActionId: source.actionId,
        lastDeclaredEncounterId: input.encounter.id,
        lastDeclaredMovementId: source.movementId,
        lastDeclaredRoundNumber: input.state.roundNumber,
        lastDeclaredSecondaryActionId: source.secondaryActionId,
        lastDeclarationNotes: source.additionalActionNotes,
        lastMovementIntent: movementIntent,
      },
    },
  };
}

function projectApiCombatStepAutomation(input: {
  encounter: EncounterSession;
  scenarioParticipants: readonly ScenarioParticipant[];
}): ApiCombatStepAutomationProjection {
  const state = initializeMaterializedCombatRoundState({
    encounter: input.encounter,
    scenarioParticipants: [...input.scenarioParticipants],
  });
  const participation = projectActiveCombatParticipation({
    encounterRevision: input.encounter.updatedAt,
    scenarioParticipants: input.scenarioParticipants,
    state,
  });
  const progression = buildCombatProgressionProjection(state, { participation });
  const tasks = getCurrentExecutableCombatTasks(progression).filter((task) => {
    if (task.kind !== "submit_declaration") return true;
    const participantId =
      task.owner?.kind === "combatant" ? task.owner.participantId : task.identity.participantId;
    return !state.participants.find((participant) => participant.participantId === participantId)
      ?.declaration;
  });
  return {
    participation,
    revision: input.encounter.updatedAt,
    roundNumber: state.roundNumber,
    state,
    step: state.currentStep,
    tasks,
  };
}

function getStepAutomationScenarioParticipant(input: {
  scenarioParticipants: readonly ScenarioParticipant[];
  state: CombatRoundState;
  task: CombatProgressionTask;
}): { encounterParticipantId: string; participant: ScenarioParticipant } | undefined {
  const encounterParticipantId =
    input.task.owner?.kind === "combatant"
      ? input.task.owner.participantId
      : input.task.identity.participantId;
  const roundParticipant = input.state.participants.find(
    (participant) => participant.participantId === encounterParticipantId,
  );
  const participant = roundParticipant?.scenarioParticipantId
    ? input.scenarioParticipants.find(
        (candidate) => candidate.id === roundParticipant.scenarioParticipantId,
      )
    : undefined;
  return encounterParticipantId && participant
    ? { encounterParticipantId, participant }
    : undefined;
}

function getStraightforwardStepAutomationModifierReview(input: {
  commandId: string;
  encounter: EncounterSession;
  participant: ScenarioParticipant;
  state: CombatRoundState;
  task: CombatProgressionTask;
}) {
  const roundParticipant = input.state.participants.find(
    (participant) =>
      participant.participantId ===
      (input.task.owner?.kind === "combatant"
        ? input.task.owner.participantId
        : input.task.identity.participantId),
  );
  const declaration = roundParticipant?.declaration;
  const phase = input.task.identity.phase === "phase1" ? "M1" : "M2";
  if (!roundParticipant || !declaration || !input.task.identity.phase) return undefined;
  const currentContext = scenarioParticipantCombatContextSchema.parse(
    declaration.combatContext ?? input.participant.state.combat.combatContext,
  );
  const review = projectCanonicalCombatModifierReviewInput({
    canonicalCutoff: getCombatRoundNextEventSequence(input.state),
    commandId: input.commandId,
    createdAt: input.encounter.updatedAt,
    currentContext,
    draftContext: currentContext,
    encounterId: input.encounter.id,
    participantState: input.participant.state,
    phase,
    revision: input.encounter.updatedAt,
    roundNumber: input.state.roundNumber,
    scenarioParticipantId: input.participant.id,
  });
  const straightforward =
    getCanonicalCombatModifierReviewState(review) === "ready" &&
    review.automaticProposals.every((proposal) => !proposal.mayOverride) &&
    review.decisions.length === 0 &&
    review.requiredRolls.every((roll) => !roll.blocksReview || roll.resolved);
  return { currentContext, declaration, review, roundParticipant, straightforward };
}

function resolveApiCombatDistanceAutomationContext(input: {
  encounter: EncounterSession;
  scenarioParticipants: readonly ScenarioParticipant[];
  state: CombatRoundState;
  task: CombatProgressionTask;
}):
  | {
      kind: "complete";
      distanceInputs: ReturnType<typeof buildRoundEndDistanceControlInputs>;
      opponent: ScenarioParticipant;
      opponentCombatantId: string;
      owner: NonNullable<ReturnType<typeof getStepAutomationScenarioParticipant>>;
      proposal: CombatRoundEndDistanceProposal;
    }
  | { kind: "stopped"; reason: CombatStepAutomationStopReason } {
  if (input.task.kind !== "distance_roll") {
    return { kind: "stopped", reason: "unsupported_task" };
  }
  const owner = getStepAutomationScenarioParticipant({
    scenarioParticipants: input.scenarioParticipants,
    state: input.state,
    task: input.task,
  });
  const proposal = input.state.roundEndReview?.proposedDistances.find(
    (candidate) => candidate.id === input.task.identity.proposalId,
  );
  const opponentCombatantId = input.task.identity.opponentParticipantId;
  if (!owner || !proposal || !opponentCombatantId) {
    return { kind: "stopped", reason: "distance_calculation_review_required" };
  }
  const normalizedPair = createCombatParticipantPairKey(
    proposal.participantAId,
    proposal.participantBId,
  );
  const [normalizedParticipantAId, normalizedParticipantBId] = normalizedPair.split("::");
  const expectedOpponentId =
    owner.encounterParticipantId === proposal.participantAId
      ? proposal.participantBId
      : owner.encounterParticipantId === proposal.participantBId
        ? proposal.participantAId
        : undefined;
  const side =
    owner.encounterParticipantId === proposal.participantAId
      ? proposal.participantA
      : owner.encounterParticipantId === proposal.participantBId
        ? proposal.participantB
        : undefined;
  if (
    proposal.controlMode !== "ordinary" ||
    proposal.pairKey !== normalizedPair ||
    proposal.participantAId !== normalizedParticipantAId ||
    proposal.participantBId !== normalizedParticipantBId ||
    input.task.identity.pairId !== normalizedPair ||
    expectedOpponentId !== opponentCombatantId ||
    side?.participantId !== owner.encounterParticipantId ||
    side.status !== "pending"
  ) {
    return { kind: "stopped", reason: "invalid_proposal" };
  }
  const currentEdge = getCombatRoundDistanceEdge({
    participantAId: proposal.participantAId,
    participantBId: proposal.participantBId,
    state: input.state,
  });
  if (
    proposal.currentDistanceSource !== "canonical" ||
    !currentEdge ||
    currentEdge.distance !== proposal.currentDistance ||
    proposal.warnings.length > 0 ||
    side.warnings.length > 0 ||
    side.calculationReadiness?.completeness !== "complete"
  ) {
    return { kind: "stopped", reason: "distance_calculation_review_required" };
  }
  const membership = resolveEncounterParticipantMembership({
    encounter: input.encounter,
    scenarioParticipants: [...input.scenarioParticipants],
  });
  const opponentCombatant = membership.participants.find(
    (participant) => participant.id === opponentCombatantId,
  );
  const opponent = opponentCombatant?.scenarioParticipantId
    ? input.scenarioParticipants.find(
        (participant) => participant.id === opponentCombatant.scenarioParticipantId,
      )
    : undefined;
  if (!opponent) {
    return { kind: "stopped", reason: "distance_calculation_review_required" };
  }
  const distanceInputs = buildRoundEndDistanceControlInputs({
    encounter: input.encounter,
    roundState: input.state,
    scenarioParticipants: [...input.scenarioParticipants],
  });
  const currentReadiness = distanceInputs[owner.encounterParticipantId]?.calculationReadiness;
  if (currentReadiness?.completeness !== "complete") {
    return { kind: "stopped", reason: "distance_calculation_review_required" };
  }
  return {
    distanceInputs,
    kind: "complete",
    opponent,
    opponentCombatantId,
    owner,
    proposal,
  };
}

function classifyApiCombatStepAutomationTask(input: {
  combatExperienceSkillLookups?: ReadonlyMap<string, ParticipantCombatExperienceSkillTotalLookup>;
  encounter: EncounterSession;
  operationFamily: "roll_remaining" | "accept_remaining" | "commit_remaining";
  projection: ApiCombatStepAutomationProjection;
  scenarioParticipants: readonly ScenarioParticipant[];
  scopeProcessFamily?: CombatStepAutomationProcessFamily;
  task: CombatProgressionTask;
}):
  | { kind: "execute"; countsTowardProcessed: boolean }
  | { kind: "stop"; reason: CombatStepAutomationStopReason } {
  const { operationFamily, task } = input;
  if (task.kind === "gm_advance_boundary" && task.expectedCommand === "complete_round") {
    return { kind: "stop", reason: "gm_decision_required" };
  }
  if (
    operationFamily === "roll_remaining" &&
    task.kind === "combat_experience" &&
    task.expectedCommand !== "roll_combat_experience"
  ) {
    return { kind: "stop", reason: "gm_decision_required" };
  }
  if (
    operationFamily === "roll_remaining" &&
    task.kind === "commit_initiative" &&
    task.participation?.workClass === "deterministic_transition"
  ) {
    return { countsTowardProcessed: false, kind: "execute" };
  }
  if (
    input.scopeProcessFamily === "health_bleed" &&
    operationFamily === "roll_remaining" &&
    task.kind === "effect_review"
  ) {
    const owner = getStepAutomationScenarioParticipant({
      scenarioParticipants: input.scenarioParticipants,
      state: input.projection.state,
      task,
    });
    if (!owner) return { kind: "stop", reason: "unsupported_task" };
    if (owner.participant.controlledByUserId) {
      return { kind: "stop", reason: "player_action_required" };
    }
    const disposition = getCombatRoundEndHealthAutomationReviewDisposition({
      participantId: owner.encounterParticipantId,
      state: input.projection.state,
    });
    return disposition === "automatic"
      ? { countsTowardProcessed: false, kind: "execute" }
      : { kind: "stop", reason: disposition };
  }
  if (
    operationFamily === "accept_remaining" &&
    task.kind === "gm_advance_boundary" &&
    task.participation?.workClass === "deterministic_transition"
  ) {
    return { countsTowardProcessed: false, kind: "execute" };
  }
  const owner = getStepAutomationScenarioParticipant({
    scenarioParticipants: input.scenarioParticipants,
    state: input.projection.state,
    task,
  });
  if (!owner) return { kind: "stop", reason: "unsupported_task" };
  if (owner.participant.controlledByUserId) {
    return { kind: "stop", reason: "player_action_required" };
  }
  if (operationFamily === "accept_remaining" && task.kind === "submit_declaration") {
    const resolution = resolveApiCombatNpcDeclarationProposal({
      encounter: input.encounter,
      participant: owner.participant,
      scenarioParticipants: input.scenarioParticipants,
      state: input.projection.state,
      task,
    });
    if (!resolution) return { kind: "stop", reason: "declaration_review_required" };
    if (resolution.proposal.validation.status === "complete") {
      return { countsTowardProcessed: true, kind: "execute" };
    }
    if (resolution.proposal.validation.status === "legacy_incomplete") {
      return { kind: "stop", reason: "incomplete_legacy_state" };
    }
    if (resolution.proposal.validation.status === "requires_review") {
      return { kind: "stop", reason: "declaration_review_required" };
    }
    return {
      kind: "stop",
      reason: resolution.proposal.validation.reasons.includes("target_invalid")
        ? "target_invalid"
        : "invalid_proposal",
    };
  }
  if (operationFamily === "roll_remaining" && task.kind === "distance_roll") {
    if (
      input.scopeProcessFamily !== "ordinary_distance_roll" ||
      input.projection.step !== "round_summary"
    ) {
      return { kind: "stop", reason: "unsupported_task" };
    }
    const context = resolveApiCombatDistanceAutomationContext({
      encounter: input.encounter,
      scenarioParticipants: input.scenarioParticipants,
      state: input.projection.state,
      task,
    });
    if (context.kind === "stopped") return { kind: "stop", reason: context.reason };
  }
  if (task.participation?.completeness !== "complete") {
    return { kind: "stop", reason: "incomplete_legacy_state" };
  }

  if (operationFamily === "roll_remaining") {
    if (
      task.kind !== "roll_initiative" &&
      task.kind !== "combat_experience" &&
      task.kind !== "health_review" &&
      task.kind !== "observation_roll" &&
      task.kind !== "continued_contact_maintenance_roll" &&
      task.kind !== "distance_roll"
    ) {
      return { kind: "stop", reason: "unsupported_task" };
    }
    if (task.kind === "combat_experience") {
      if (input.projection.step !== "select_actions") {
        return { kind: "stop", reason: "unsupported_task" };
      }
      const lookup = input.combatExperienceSkillLookups?.get(owner.participant.id);
      if (!lookup || lookup.warning) {
        return { kind: "stop", reason: "combat_experience_review_required" };
      }
    }
    if (task.kind === "health_review") {
      if (
        input.scopeProcessFamily !== "health_bleed" ||
        input.projection.step !== "round_summary"
      ) {
        return { kind: "stop", reason: "unsupported_task" };
      }
      const pending = getCombatRoundEndHealthCheckPendingRolls({
        participantId: owner.encounterParticipantId,
        state: input.projection.state,
      });
      const proposal = pending.find((candidate) => candidate.id === task.identity.healthRollId);
      const review =
        input.projection.state.roundEndReview?.participantReviews[owner.encounterParticipantId];
      if (
        !proposal ||
        !Number.isInteger(proposal.difficulty) ||
        proposal.warnings.length > 0 ||
        !review?.canonicalReview
      ) {
        return {
          kind: "stop",
          reason: review?.canonicalReview
            ? "warning_requires_acknowledgement"
            : "incomplete_legacy_state",
        };
      }
      if (review.canonicalReview.effectVersions[proposal.sourceEffectId] === undefined) {
        return { kind: "stop", reason: "incomplete_legacy_state" };
      }
    }
    if (task.kind === "observation_roll") {
      if (input.scopeProcessFamily !== "observation" || input.projection.step !== "round_summary") {
        return { kind: "stop", reason: "unsupported_task" };
      }
      const observationAttemptId = task.identity.observationAttemptId;
      const relationshipId = task.identity.relationshipId;
      const targetParticipantId = task.identity.opponentParticipantId;
      if (!observationAttemptId || !relationshipId || !targetParticipantId) {
        return { kind: "stop", reason: "observation_review_required" };
      }
      const context = resolveApiCombatObservationRollContext({
        encounter: input.encounter,
        observerParticipantId: owner.encounterParticipantId,
        observationAttemptId,
        relationshipId,
        scenarioParticipants: input.scenarioParticipants,
        state: input.projection.state,
        targetParticipantId,
      });
      if (context.kind === "stopped") {
        return { kind: "stop", reason: context.reason };
      }
    }
    if (task.kind === "continued_contact_maintenance_roll") {
      if (
        input.scopeProcessFamily !== "continued_contact" ||
        input.projection.step !== "round_summary"
      ) {
        return { kind: "stop", reason: "unsupported_task" };
      }
      const contest =
        input.projection.state.roundEndReview?.continuedContactMaintenanceContests.find(
          (candidate) => candidate.id === task.identity.contestId,
        );
      const contact = contest
        ? input.projection.state.continuedContacts.find(
            (candidate) =>
              candidate.id === contest.continuedContactId && candidate.status === "active",
          )
        : undefined;
      const condition = contest
        ? input.projection.state.unbalancedConditions.find(
            (candidate) =>
              candidate.id === contest.unbalancedConditionId && candidate.status === "active",
          )
        : undefined;
      if (
        contest?.reviewRequiredReason ||
        getConflictingContinuedContactIds(input.projection.state).has(
          contest?.continuedContactId ?? "",
        )
      ) {
        return { kind: "stop", reason: "continued_contact_review_required" };
      }
      if (
        !contest ||
        !contact ||
        !condition ||
        !task.identity.opponentParticipantId ||
        contact.controllerParticipantId !== contest.controllerParticipantId ||
        contact.affectedParticipantId !== contest.affectedParticipantId
      ) {
        return { kind: "stop", reason: "incomplete_legacy_state" };
      }
      const affectedCombatant = resolveEncounterParticipantMembership({
        encounter: input.encounter,
        scenarioParticipants: [...input.scenarioParticipants],
      }).participants.find((participant) => participant.id === contest.affectedParticipantId);
      const affectedOwner = affectedCombatant?.scenarioParticipantId
        ? input.scenarioParticipants.find(
            (participant) => participant.id === affectedCombatant.scenarioParticipantId,
          )
        : undefined;
      const linkedEffect = affectedOwner
        ? combatEffectsStateSchema
            .parse(affectedOwner.state.combatEffects)
            .effects.find((effect) => effect.id === condition.id)
        : undefined;
      const contactLifecycle = canonicalCombatModifierEffectSchema.safeParse(
        contact.canonicalLifecycle,
      );
      if (
        !linkedEffect?.canonicalLifecycle ||
        !contactLifecycle.success ||
        contactLifecycle.data.createdSequence === undefined
      ) {
        return { kind: "stop", reason: "incomplete_legacy_state" };
      }
    }
    if (task.automation.eligibility === "requires_warning") {
      return { kind: "stop", reason: "warning_requires_acknowledgement" };
    }
    if (
      task.automation.eligibility !== "eligible" ||
      task.automation.authority.kind !== "gm_controlled_participant"
    ) {
      return {
        kind: "stop",
        reason:
          task.automation.stopReason === "legacy_state"
            ? "incomplete_legacy_state"
            : "roll_not_eligible",
      };
    }
    return { countsTowardProcessed: true, kind: "execute" };
  }

  if (operationFamily === "accept_remaining") {
    if (task.kind !== "modifier_review") {
      return { kind: "stop", reason: "unsupported_task" };
    }
    const review = getStraightforwardStepAutomationModifierReview({
      commandId: `combat-step-automation-preview:${task.id}`,
      encounter: input.encounter,
      participant: owner.participant,
      state: input.projection.state,
      task,
    });
    return review?.straightforward
      ? { countsTowardProcessed: true, kind: "execute" }
      : { kind: "stop", reason: "modifier_review_required" };
  }

  return { kind: "stop", reason: "unsupported_task" };
}

function recordCanonicalServerCombatInitiative(input: {
  commandId?: string;
  encounter: EncounterSession;
  encounterParticipantId: string;
  initiativeBase: number;
  phase: CombatRoundPhase;
  scenarioParticipant: ScenarioParticipant;
  state: CombatRoundState;
  submittedBy: "gm" | "player";
  submittedAt: string;
  userId: string;
}): { initiative: ReturnType<typeof buildCombatRoundInitiativeResult>; state: CombatRoundState } {
  const initiativeProjection = buildLiveCombatModifierContributionProjection({
    combatContext: input.scenarioParticipant.state.combat.combatContext,
    combatEffects: input.scenarioParticipant.state.combatEffects,
    currentRound: input.state.roundNumber,
    encounterId: input.encounter.id,
    ownerParticipantId: input.scenarioParticipant.id,
  });
  const calculationContext: CombatCalculationContext = {
    encounterId: input.encounter.id,
    ownerParticipantId: input.scenarioParticipant.id,
    phase: input.phase,
    roundNumber: input.state.roundNumber,
    step: input.phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2",
  };
  const initiativeResolution = resolveCombatModifierContributions({
    bucket: "initiative",
    context: calculationContext,
    contributions: initiativeProjection.contributions,
  });
  const generalResolution = resolveCombatWideGeneralModifiers({
    context: { ...calculationContext, rollType: "initiative" },
    contributions: initiativeProjection.contributions,
  });
  const rawModifier = initiativeResolution.total + generalResolution.total;
  const trace = calculateWorkbookPercentageAdjustmentTrace({
    baseValue: input.initiativeBase,
    rawModifiers: [{ label: "Initiative", value: rawModifier }],
  });
  const initiative = buildCombatRoundInitiativeResult({
    baseInitiative: input.initiativeBase,
    modifierAdjustment: (trace?.finalValue ?? input.initiativeBase) - input.initiativeBase,
    roll: rollOpenEndedD6(),
  });
  return {
    initiative,
    state: recordCombatRoundInitiative({
      command: {
        commandId: input.commandId,
        createdAt: input.submittedAt,
        createdByUserId: input.userId,
      },
      initiative,
      participantId: input.encounterParticipantId,
      phase: input.phase,
      state: input.state,
      submittedBy: input.submittedBy,
      visibility: input.encounter.roleplayState?.visibility,
    }),
  };
}

function attachCombatStepAutomationCommandLink(input: {
  commandId: string;
  countsTowardProcessed: boolean;
  executionGroupId: string;
  identity: CombatStepAutomationRunIdentity;
  state: CombatRoundState;
  taskId: string;
}): CombatRoundState {
  const link = combatStepAutomationCommandLinkSchema.parse({
    countsTowardProcessed: input.countsTowardProcessed,
    executionGroupId: input.executionGroupId,
    operationFamily: input.identity.operationFamily,
    runId: input.identity.runId,
    schemaVersion: 1,
    startProcessFamily: input.identity.startProcessFamily,
    startingSequence: input.identity.startingSequence,
    startingRevision: input.identity.startingRevision,
    taskId: input.taskId,
  });
  return {
    ...input.state,
    commands: input.state.commands.map((command) =>
      command.id === input.commandId
        ? { ...command, facts: { ...command.facts, stepAutomation: link } }
        : command,
    ),
  };
}

function attachContinuedContactEffectTransitionFacts(input: {
  commandId: string;
  nextEffect: ReturnType<typeof combatEffectSchema.parse>;
  previousEffect: ReturnType<typeof combatEffectSchema.parse>;
  scenarioParticipantId: string;
  state: CombatRoundState;
}): CombatRoundState {
  return {
    ...input.state,
    commands: input.state.commands.map((command) =>
      command.id === input.commandId
        ? (() => {
            const transition = {
              nextEffect: input.nextEffect,
              previousEffect: input.previousEffect,
              scenarioParticipantId: input.scenarioParticipantId,
            };
            const existing = getContinuedContactEffectTransitionFactsList(command);
            return {
              ...command,
              facts: {
                ...command.facts,
                // Retain the singular fact for compatibility with existing persisted commands.
                continuedContactEffectTransition: transition,
                continuedContactEffectTransitions: [...existing, transition],
              },
            };
          })()
        : command,
    ),
  };
}

function parseContinuedContactEffectTransitionFact(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const facts = value as Record<string, unknown>;
  const previousEffect = combatEffectSchema.safeParse(facts.previousEffect);
  const nextEffect = combatEffectSchema.safeParse(facts.nextEffect);
  return typeof facts.scenarioParticipantId === "string" &&
    previousEffect.success &&
    nextEffect.success
    ? {
        nextEffect: nextEffect.data,
        previousEffect: previousEffect.data,
        scenarioParticipantId: facts.scenarioParticipantId,
      }
    : undefined;
}

function getContinuedContactEffectTransitionFactsList(command: CombatRoundCommand) {
  const plural = Array.isArray(command.facts.continuedContactEffectTransitions)
    ? command.facts.continuedContactEffectTransitions
        .map(parseContinuedContactEffectTransitionFact)
        .filter(
          (
            transition,
          ): transition is NonNullable<
            ReturnType<typeof parseContinuedContactEffectTransitionFact>
          > => transition !== undefined,
        )
    : [];
  if (plural.length > 0) return plural;
  const singular = parseContinuedContactEffectTransitionFact(
    command.facts.continuedContactEffectTransition,
  );
  return singular ? [singular] : [];
}

function attachCombatNpcDeclarationProposalProvenance(input: {
  commandId: string;
  proposal: CombatNpcDeclarationProposal;
  state: CombatRoundState;
}): CombatRoundState {
  if (!input.proposal.sourceCommandId || !input.proposal.sourceDeclarationId) return input.state;
  const provenance = combatNpcDeclarationProposalProvenanceSchema.parse({
    kind: "proposal_acceptance",
    proposalSchemaVersion: input.proposal.schemaVersion,
    sourceCommandId: input.proposal.sourceCommandId,
    sourceDeclarationId: input.proposal.sourceDeclarationId,
    sourceRoundNumber: input.proposal.sourceRoundNumber,
  });
  return {
    ...input.state,
    commands: input.state.commands.map((command) =>
      command.id === input.commandId
        ? { ...command, facts: { ...command.facts, declarationProposal: provenance } }
        : command,
    ),
  };
}

function getAcceptedCombatStepAutomationCommands(input: {
  identity: Pick<CombatStepAutomationRunIdentity, "operationFamily" | "runId" | "startingRevision">;
  state: CombatRoundState;
}) {
  const prefix = getCombatStepAutomationCommandPrefix(input.identity);
  return input.state.commands.flatMap((command) => {
    if (!command.id.startsWith(prefix)) return [];
    const link = combatStepAutomationCommandLinkSchema.safeParse(command.facts.stepAutomation);
    return link.success ? [{ command, link: link.data }] : [];
  });
}

function hasAcceptedDeterministicCommand(input: {
  commandId: string;
  encounter: EncounterSession;
}): boolean {
  const state = input.encounter.combatRoundState;
  if (!state) return false;
  return (
    state.commands.some((command) => command.id === input.commandId) ||
    state.rounds.at(-1)?.commands.some((command) => command.id === input.commandId) === true
  );
}

async function normalizeScenarioParticipantModifierRowsForEncounter(input: {
  encounter: EncounterSession;
  initializingNewEncounter?: boolean;
  persistChanges?: boolean;
  scenarioParticipants: ScenarioParticipant[];
}): Promise<ScenarioParticipant[]> {
  if (!Array.isArray(input.encounter.participants)) return input.scenarioParticipants;
  const membership = resolveEncounterParticipantMembership({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
  });
  const linkedScenarioParticipantIds = new Set(
    membership.participants.map((participant) => participant.scenarioParticipantId),
  );
  const activeProposalIds =
    input.encounter.combatRoundState?.feintProposals.map((proposal) => proposal.id) ?? [];

  return Promise.all(
    input.scenarioParticipants.map(async (participant) => {
      if (!linkedScenarioParticipantIds.has(participant.id)) return participant;
      if (!participant.state?.combat) return participant;
      const combatContext = normalizeCombatModifierRowsForEncounter({
        activeProposalIds,
        combatContext: participant.state.combat.combatContext,
        encounterId: input.encounter.id,
        initializingNewEncounter: input.initializingNewEncounter,
        roundNumber: input.encounter.combatRoundState?.roundNumber ?? input.encounter.currentRound,
      });
      if (!combatContextsDiffer(combatContext, participant.state.combat.combatContext)) {
        return participant;
      }
      const normalizedParticipant = {
        ...participant,
        state: {
          ...participant.state,
          combat: { ...participant.state.combat, combatContext },
        },
      };
      if (input.persistChanges === false) {
        return normalizedParticipant;
      }
      return encounterService.updateScenarioParticipantState({
        participantId: participant.id,
        scenarioId: participant.scenarioId,
        state: normalizedParticipant.state,
      });
    }),
  );
}

function buildCombatActionDistanceModifierInputs(input: {
  actionId?: string;
  encounterParticipant: EncounterSession["participants"][number];
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phase: "phase1" | "phase2";
  phaseAttackSource?: CombatAttackSourceRef;
  roundState: CombatRoundState;
  scenarioParticipant: ScenarioParticipant;
}): CombatActionGeneratedDistanceModifierInput | undefined {
  const targetParticipantId = input.phaseContexts?.[input.phase]?.targetParticipantId;

  if (!targetParticipantId) {
    return undefined;
  }

  const targetRoundParticipant = findCombatRoundParticipantByAlias({
    id: targetParticipantId,
    state: input.roundState,
  }) ?? { participantId: targetParticipantId };
  const distanceEdge = getDistanceEdgeBetweenParticipantAliases({
    participantA: input.encounterParticipant,
    participantB: targetRoundParticipant,
    state: input.roundState.distanceState,
  });

  if (!distanceEdge) {
    return undefined;
  }

  const source = input.phaseAttackSource;
  if (!source) return undefined;
  const weaponTemplate =
    source.sourceKind === "unarmed"
      ? [punchTemplate, kickTemplate].find((template) => template.id === source.templateId)
      : [
          ...getSnapshotActiveWeaponTemplates(input.scenarioParticipant),
          ...getSnapshotWeaponTemplates(input.scenarioParticipant),
          ...weaponTemplates,
        ].find((template) => template.id === source.templateId);
  if (!weaponTemplate?.attackModes?.some((mode) => mode.id === source.attackModeId)) {
    return undefined;
  }
  const preferredDistances = getWeaponPreferredDistances(weaponTemplate ?? {});

  if (preferredDistances.length === 0) {
    return undefined;
  }

  const declaredPenaltyDistance = getSingleAttackDeclaredDistanceForPenalty({
    actionId: input.actionId,
    movementIntent: input.movementIntent,
    phase: input.phase,
    preferredDistances,
    targetParticipantId,
  });

  return {
    actualDistance: declaredPenaltyDistance ?? distanceEdge.distance,
    actualDistanceBasis: declaredPenaltyDistance === undefined ? "current" : "declared_intent",
    phase: input.phase,
    preferredDistances,
    sourceActionId: input.actionId,
    weaponName: weaponTemplate.name,
  };
}

function buildCombatActionDistanceModifierInputsForDeclaration(input: {
  actionId?: string;
  encounterParticipant: EncounterSession["participants"][number];
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseAttackSources?: Partial<Record<"phase1" | "phase2", CombatAttackSourceRef | undefined>>;
  roundState: CombatRoundState;
  scenarioParticipant: ScenarioParticipant;
  secondaryActionId?: string;
}): CombatActionGeneratedDistanceModifierInput[] {
  return getCombatDeclarationAttackPhases({
    actionId: input.actionId,
    secondaryActionId: input.secondaryActionId,
  })
    .map((phase) =>
      buildCombatActionDistanceModifierInputs({
        actionId: input.actionId,
        encounterParticipant: input.encounterParticipant,
        movementIntent: input.movementIntent,
        phase,
        phaseContexts: input.phaseContexts,
        phaseAttackSource: input.phaseAttackSources?.[phase],
        roundState: input.roundState,
        scenarioParticipant: input.scenarioParticipant,
      }),
    )
    .filter((entry): entry is CombatActionGeneratedDistanceModifierInput => entry !== undefined);
}

function findExistingDistanceModifierEntry(input: {
  combatContext: ScenarioParticipantCombatContext;
  phase: "phase1" | "phase2";
}): ScenarioCombatModifierEntry | undefined {
  return findExistingDistanceModifierEntryFromEntries({
    entries: input.combatContext.modifierBuckets.situationObSkill,
    phase: input.phase,
  });
}

function findExistingDistanceModifierEntryFromEntries(input: {
  entries: readonly ScenarioCombatModifierEntry[];
  phase: "phase1" | "phase2";
}): ScenarioCombatModifierEntry | undefined {
  return input.entries.find(
    (entry) =>
      isDistanceGeneratedObSkillModifier(entry) &&
      (entry.sourcePhase === input.phase ||
        entry.id === `generated:distance:${input.phase}:ob-skill`),
  );
}

function findExistingDistanceModifierEntryFromSnapshot(input: {
  phase: "phase1" | "phase2";
  snapshot: CombatRoundState["stepSnapshots"][number] | undefined;
}): ScenarioCombatModifierEntry | undefined {
  return input.snapshot?.modifierSummary?.rows
    .map((row) =>
      findExistingDistanceModifierEntryFromEntries({
        entries: row.entries,
        phase: input.phase,
      }),
    )
    .find((entry): entry is ScenarioCombatModifierEntry => Boolean(entry));
}

function buildDistanceModifierDetailFromExistingEntry(
  entry: ScenarioCombatModifierEntry | undefined,
): CombatRoundAttackDistanceModifierDetail | undefined {
  if (!entry) {
    return undefined;
  }

  return {
    createdCombatModifierIds: [],
    modifierId: entry.id,
    notes: entry.notes,
    preferredDistances: [],
    value: entry.value,
  };
}

function applyGeneratedCombatActionModifiersForDeclaration(input: {
  adjustDistance?: { currentDistance: number; requestedDistance: number; roundNumber?: number };
  actionId?: string;
  attackPhaseDefensivePenalties?: readonly CombatAttackPhaseDefensivePenalty[];
  combatContext: ScenarioParticipantCombatContext;
  encounterId: string;
  encounterParticipant: EncounterSession["participants"][number];
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseAttackSources?: Partial<Record<"phase1" | "phase2", CombatAttackSourceRef | undefined>>;
  roundState: CombatRoundState;
  scenarioParticipant: ScenarioParticipant;
  secondaryActionId?: string;
  lifecycleContext?: Parameters<typeof applyCombatActionGeneratedModifiers>[0]["lifecycleContext"];
}): ScenarioParticipantCombatContext {
  const roundParticipantId =
    findCombatRoundParticipantByAlias({
      id: input.encounterParticipant.id,
      state: input.roundState,
    })?.participantId ?? input.encounterParticipant.id;

  const dodgeSkillValue =
    input.actionId === "parry"
      ? getScenarioParticipantDodgeSkillValue(input.scenarioParticipant)
      : undefined;
  return applyCombatActionGeneratedModifiers({
    actionId: input.actionId,
    attackPhaseDefensivePenalties: input.attackPhaseDefensivePenalties,
    adjustDistance: input.adjustDistance,
    combatContext: input.combatContext,
    sourceEncounterId: input.encounterId,
    sourceRoundNumber: input.roundState.roundNumber,
    lifecycleContext: input.lifecycleContext,
    distanceModifiers: buildCombatActionDistanceModifierInputsForDeclaration({
      actionId: input.actionId,
      encounterParticipant: input.encounterParticipant,
      movementIntent: input.movementIntent,
      phaseContexts: input.phaseContexts,
      phaseAttackSources: input.phaseAttackSources,
      roundState: input.roundState,
      scenarioParticipant: input.scenarioParticipant,
      secondaryActionId: input.secondaryActionId,
    }),
    initiativeModifiers: [
      buildReactiveAttackPhase2InitiativeModifierEntry({
        actionId: input.actionId,
        participantId: roundParticipantId,
        state: input.roundState,
      }),
    ].filter((entry): entry is ScenarioCombatModifierEntry => Boolean(entry)),
    parryModifier:
      dodgeSkillValue === undefined ? undefined : deriveParryPrimaryActionModifier(dodgeSkillValue),
  });
}

function recomputeRoundDeclarationCombatActionModifiers(input: {
  encounter: EncounterSession;
  roundState: CombatRoundState;
  scenarioParticipants: ScenarioParticipant[];
}): {
  participantStatesById: Map<string, ScenarioParticipant["state"]>;
  roundState: CombatRoundState;
} {
  const participantStatesById = new Map<string, ScenarioParticipant["state"]>();
  const nextParticipants = input.roundState.participants.map((roundParticipant) => {
    const declaration = roundParticipant.declaration;

    if (!declaration) {
      return roundParticipant;
    }

    const scenarioParticipant = input.scenarioParticipants.find(
      (participant) =>
        participant.id === roundParticipant.scenarioParticipantId ||
        participant.id === roundParticipant.participantId ||
        (participant.characterId && participant.characterId === roundParticipant.characterId),
    );
    const encounterParticipant =
      input.encounter.participants.find((participant) =>
        participantAliasesInclude({ id: roundParticipant.participantId, participant }),
      ) ??
      findEncounterParticipantByScenarioParticipant({
        encounterParticipants: input.encounter.participants,
        scenarioParticipant,
      });

    if (!scenarioParticipant || !encounterParticipant) {
      return roundParticipant;
    }

    const currentContext = scenarioParticipantCombatContextSchema.parse(
      scenarioParticipant.state.combat.combatContext ?? declaration.combatContext ?? {},
    );
    const attackPhaseDefensivePenalties =
      declaration.attackPhaseDefensivePenalties ??
      (declaration.attackOpportunities
        ? resolveCombatAttackPhaseDefensivePenalties({
            commitment: "committed",
            opportunities: declaration.attackOpportunities,
            participantId: roundParticipant.participantId,
            roundNumber: input.roundState.roundNumber,
          })
        : undefined);
    const nextCombatContext = applyGeneratedCombatActionModifiersForDeclaration({
      actionId: declaration.actionId,
      attackPhaseDefensivePenalties,
      combatContext: currentContext,
      encounterId: input.encounter.id,
      encounterParticipant,
      movementIntent: declaration.movementIntent,
      phaseContexts: declaration.phaseContexts,
      phaseAttackSources: {
        phase1: buildAttackSourceRefFromDeclaredOpportunity(
          declaration.attackOpportunities?.find((opportunity) => opportunity.phase === "phase1"),
        ),
        phase2: buildAttackSourceRefFromDeclaredOpportunity(
          declaration.attackOpportunities?.find((opportunity) => opportunity.phase === "phase2"),
        ),
      },
      roundState: input.roundState,
      scenarioParticipant,
      secondaryActionId: declaration.secondaryActionId,
      adjustDistance: declaration.adjustDistance
        ? { ...declaration.adjustDistance, roundNumber: input.roundState.roundNumber }
        : undefined,
    });

    if (combatContextsDiffer(currentContext, nextCombatContext)) {
      participantStatesById.set(scenarioParticipant.id, {
        ...scenarioParticipant.state,
        combat: {
          ...scenarioParticipant.state.combat,
          combatContext: nextCombatContext,
        },
      });
    }

    return {
      ...roundParticipant,
      declaration: {
        ...declaration,
        attackPhaseDefensivePenalties,
        combatContext: nextCombatContext,
      },
    };
  });

  return {
    participantStatesById,
    roundState: {
      ...input.roundState,
      participants: nextParticipants,
    },
  };
}

function getEncounterParticipantsControlledByUser(input: {
  encounter: EncounterParticipantReadSource;
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): EncounterSession["participants"] {
  return input.scenarioParticipants
    .map((scenarioParticipant) =>
      resolveEncounterParticipantForViewer({
        encounter: input.encounter,
        requestedParticipantId: scenarioParticipant.id,
        scenarioParticipants: input.scenarioParticipants,
        viewer: { kind: "player", userId: input.userId },
      }),
    )
    .filter((resolution): resolution is NonNullable<typeof resolution> => Boolean(resolution))
    .map((resolution) => resolution.encounterParticipant)
    .filter(
      (participant, index, participants) =>
        participants.findIndex((candidate) => candidate.id === participant.id) === index,
    );
}

function resolveCombatParticipantForRequest(input: {
  accessMode: "gm" | "player";
  encounter: EncounterSession;
  requestedParticipantId: string;
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}) {
  return resolveEncounterParticipantForViewer({
    encounter: input.encounter,
    requestedParticipantId: input.requestedParticipantId,
    scenarioParticipants: input.scenarioParticipants,
    viewer: input.accessMode === "gm" ? { kind: "gm" } : { kind: "player", userId: input.userId },
  });
}

function hasCombatDistanceVisibility(input: {
  target: EncounterSession["participants"][number];
  viewer: EncounterSession["participants"][number];
  visibility?: NonNullable<EncounterSession["roleplayState"]>["visibility"];
}): boolean {
  const targetAliases = getCombatDistanceParticipantAliases(input.target);
  const viewerAliases = getCombatDistanceParticipantAliases(input.viewer);

  return viewerAliases.some((viewerAlias) => {
    const row = input.visibility?.[viewerAlias];

    return targetAliases.some((targetAlias) => Boolean(row?.[targetAlias]));
  });
}

export function buildPlayerSafeCombatScopeForUser(input: {
  encounter: EncounterParticipantReadSource & {
    participantVisibility?: NonNullable<EncounterSession["roleplayState"]>["visibility"];
    roleplayState?: Pick<NonNullable<EncounterSession["roleplayState"]>, "visibility">;
  };
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): {
  controlledEncounterParticipantIds: Set<string>;
  visibleParticipantIds: Set<string>;
} {
  const controlledEncounterParticipants = getEncounterParticipantsControlledByUser(input);
  return buildPlayerSafeCombatScopeForParticipants({
    controlledEncounterParticipants,
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
  });
}

function buildPlayerSafeCombatScopeForParticipants(input: {
  controlledEncounterParticipants: EncounterSession["participants"];
  encounter: EncounterParticipantReadSource & {
    participantVisibility?: NonNullable<EncounterSession["roleplayState"]>["visibility"];
    roleplayState?: Pick<NonNullable<EncounterSession["roleplayState"]>, "visibility">;
  };
  scenarioParticipants: ScenarioParticipant[];
}): {
  controlledEncounterParticipantIds: Set<string>;
  visibleParticipantIds: Set<string>;
} {
  const membership = resolveEncounterParticipantMembership({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
  });
  const controlledEncounterParticipantIds = new Set(
    input.controlledEncounterParticipants.flatMap((participant) =>
      getCombatDistanceParticipantAliases(participant),
    ),
  );
  const visibility =
    input.encounter.participantVisibility ?? input.encounter.roleplayState?.visibility;
  const hasVisibilityRows = Object.keys(visibility ?? {}).length > 0;
  const visibleParticipantIds = new Set(
    membership.participants
      .filter(
        (participant) =>
          input.controlledEncounterParticipants.some(
            (controlled) => controlled.id === participant.id,
          ) ||
          !hasVisibilityRows ||
          input.controlledEncounterParticipants.some((viewer) =>
            hasCombatDistanceVisibility({
              target: participant,
              viewer,
              visibility,
            }),
          ),
      )
      .flatMap((participant) => getCombatDistanceParticipantAliases(participant)),
  );

  return {
    controlledEncounterParticipantIds,
    visibleParticipantIds,
  };
}

function isPlayerControlledCombatParticipant(input: {
  controlledEncounterParticipantIds: Set<string>;
  participantId: string;
}): boolean {
  return input.controlledEncounterParticipantIds.has(input.participantId);
}

function getPlayerSafeDistanceControlSide(input: {
  controlledEncounterParticipantIds: Set<string>;
  side: CombatRoundEndDistanceControlSide;
}): CombatRoundEndDistanceControlSide {
  if (
    isPlayerControlledCombatParticipant({
      controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
      participantId: input.side.participantId,
    })
  ) {
    return input.side;
  }

  return {
    participantId: input.side.participantId,
    status: input.side.status,
  } as CombatRoundEndDistanceControlSide;
}

function buildPlayerSafeDistanceControlProposalForUser(input: {
  controlledEncounterParticipantIds: Set<string>;
  proposal: CombatRoundEndDistanceProposal;
  visibleParticipantIds: Set<string>;
}): CombatRoundEndDistanceProposal | undefined {
  const participantAControlled = isPlayerControlledCombatParticipant({
    controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
    participantId: input.proposal.participantAId,
  });
  const participantBControlled = isPlayerControlledCombatParticipant({
    controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
    participantId: input.proposal.participantBId,
  });

  if (!participantAControlled && !participantBControlled) {
    return undefined;
  }

  const opponentParticipantId = participantAControlled
    ? input.proposal.participantBId
    : input.proposal.participantAId;

  if (!input.visibleParticipantIds.has(opponentParticipantId)) {
    return undefined;
  }

  const safeProposal = {
    ...input.proposal,
    notes: undefined,
    participantA: getPlayerSafeDistanceControlSide({
      controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
      side: input.proposal.participantA,
    }),
    participantB: getPlayerSafeDistanceControlSide({
      controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
      side: input.proposal.participantB,
    }),
  } satisfies CombatRoundEndDistanceProposal;

  if (getCombatRoundEndDistanceProposalLifecycle(input.proposal) === "applied") {
    return safeProposal;
  }

  return {
    ...safeProposal,
    appliedDistance: undefined,
    gmOverrideDistance: undefined,
    outcome: "contest_pending",
    proposedDistance: undefined,
    warnings: [],
    winnerParticipantId: undefined,
  };
}

function sanitizePlayerSafeDistanceControlCommandFacts(input: {
  command: CombatRoundCommand;
  controlledEncounterParticipantIds: Set<string>;
  visibleParticipantIds: Set<string>;
}): CombatRoundCommand | undefined {
  const facts = input.command.facts;
  const nextProposal = facts.nextProposal as CombatRoundEndDistanceProposal | undefined;
  const previousProposal = facts.previousProposal as CombatRoundEndDistanceProposal | undefined;
  const proposal = nextProposal ?? previousProposal;
  const safeNextProposal = nextProposal
    ? buildPlayerSafeDistanceControlProposalForUser({
        controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
        proposal: nextProposal,
        visibleParticipantIds: input.visibleParticipantIds,
      })
    : undefined;
  const safePreviousProposal = previousProposal
    ? buildPlayerSafeDistanceControlProposalForUser({
        controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
        proposal: previousProposal,
        visibleParticipantIds: input.visibleParticipantIds,
      })
    : undefined;

  if (proposal && !safeNextProposal && !safePreviousProposal) {
    return undefined;
  }

  const rolledParticipantId =
    typeof facts.rolledParticipantId === "string" ? facts.rolledParticipantId : undefined;
  const playerRolledOwnSide =
    rolledParticipantId &&
    isPlayerControlledCombatParticipant({
      controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
      participantId: rolledParticipantId,
    });

  if (input.command.type === "roll_round_end_distance_control" && !playerRolledOwnSide) {
    return {
      ...input.command,
      facts: {
        distanceProposalId: facts.distanceProposalId,
        pairKey: facts.pairKey,
        participantAId: facts.participantAId,
        participantBId: facts.participantBId,
        rolledParticipantId,
        status: safeNextProposal?.status ?? safePreviousProposal?.status,
      },
    };
  }

  if (input.command.type === "roll_round_end_distance_control") {
    return {
      ...input.command,
      facts: {
        currentDistance: facts.currentDistance,
        distanceProposalId: facts.distanceProposalId,
        nextProposal: safeNextProposal,
        outcome: safeNextProposal?.outcome ?? "contest_pending",
        pairKey: facts.pairKey,
        participantAId: facts.participantAId,
        participantBId: facts.participantBId,
        previousProposal: safePreviousProposal,
        proposedDistance: safeNextProposal?.proposedDistance,
        rolledBy: facts.rolledBy,
        rolledParticipantFinalTotal: facts.rolledParticipantFinalTotal,
        rolledParticipantId,
        rolledParticipantRoll: facts.rolledParticipantRoll,
      },
    };
  }

  if (input.command.type === "commit_round_end_distance_control") {
    const safeProposal = safeNextProposal ?? safePreviousProposal;

    if (!safeProposal) {
      return undefined;
    }

    return {
      ...input.command,
      facts: {
        appliedDistance: facts.appliedDistance,
        distanceProposalId: facts.distanceProposalId,
        nextEdge: facts.nextEdge,
        nextProposal: safeNextProposal,
        outcome: safeProposal.outcome,
        pairKey: facts.pairKey,
        participantAId: facts.participantAId,
        participantBId: facts.participantBId,
        proposedDistance: safeProposal.proposedDistance,
      },
    };
  }

  return input.command;
}

function buildPlayerSafeCombatRoundCommandForUser(input: {
  command: CombatRoundCommand;
  controlledEncounterParticipantIds: Set<string>;
  visibleParticipantIds: Set<string>;
}): CombatRoundCommand | undefined {
  // Feint command facts retain undo provenance, including both raw rolls and GM notes.
  // Player live state uses the separately sanitized proposal and projected event history.
  if (
    input.command.type === "review_feint_feasibility" ||
    input.command.type === "roll_feint" ||
    input.command.type === "commit_feint_result" ||
    input.command.type === "respond_adjust_distance" ||
    input.command.type === "review_adjust_distance_roll_adjustment" ||
    input.command.type === "roll_adjust_distance" ||
    input.command.type === "commit_adjust_distance"
  ) {
    return undefined;
  }

  // Disarm command facts are exact undo snapshots and contain both sides' private
  // roll calculations and canonical Item identities. The authoritative state keeps
  // them for retry/undo; player views use the sanitized attempt projection instead.
  if (
    input.command.type === "open_disarm" ||
    input.command.type === "roll_disarm" ||
    input.command.type === "commit_disarm"
  ) {
    return undefined;
  }

  if (
    input.command.type === "submit_phase_initiative_choice" &&
    !input.controlledEncounterParticipantIds.has(input.command.participantId)
  ) {
    return undefined;
  }

  if (
    input.command.type === "declare_action" &&
    !input.controlledEncounterParticipantIds.has(input.command.participantId)
  ) {
    return undefined;
  }

  if (
    input.command.type === "review_modifiers_phase1" ||
    input.command.type === "review_modifiers_phase2"
  ) {
    if (!input.controlledEncounterParticipantIds.has(input.command.participantId)) {
      return undefined;
    }
    const transaction = canonicalCombatModifierReviewTransactionSchema.safeParse(
      input.command.facts.modifierReview,
    );
    return {
      ...input.command,
      facts: transaction.success
        ? {
            modifierReviewPublicResult: projectCanonicalCombatModifierReviewPublicResult({
              transaction: transaction.data,
              viewer: {
                controlledParticipantIds: input.controlledEncounterParticipantIds,
                isGm: false,
                visibleParticipantIds: input.visibleParticipantIds,
              },
            }),
          }
        : {},
    };
  }

  if (
    input.command.type === "roll_combat_experience" &&
    !input.controlledEncounterParticipantIds.has(input.command.participantId)
  ) {
    return undefined;
  }

  if (input.command.type === "roll_attack") {
    const safeFacts = { ...input.command.facts };
    delete safeFacts.attackerCalculation;
    delete safeFacts.defenderCalculation;
    delete safeFacts.thrownWeaponUndo;
    return { ...input.command, facts: safeFacts };
  }

  if (
    input.command.type === "roll_round_end_distance_control" ||
    input.command.type === "commit_round_end_distance_control"
  ) {
    return sanitizePlayerSafeDistanceControlCommandFacts(input);
  }

  if (input.command.type === "roll_continued_contact_maintenance") {
    const contactId =
      typeof input.command.facts.continuedContactId === "string"
        ? input.command.facts.continuedContactId
        : undefined;
    const contact = contactId ? input.command.facts.previousContinuedContact : undefined;
    const parsedContact =
      contact && typeof contact === "object"
        ? (contact as {
            affectedParticipantId?: unknown;
            controllerParticipantId?: unknown;
          })
        : undefined;
    const involved = [
      parsedContact?.affectedParticipantId,
      parsedContact?.controllerParticipantId,
    ].some(
      (participantId) =>
        typeof participantId === "string" &&
        (input.controlledEncounterParticipantIds.has(participantId) ||
          input.visibleParticipantIds.has(participantId)),
    );
    if (!involved) return undefined;
    return {
      ...input.command,
      facts: {
        contactMaintained: input.command.facts.contactMaintained,
        contestId: input.command.facts.contestId,
        continuedContactId: input.command.facts.continuedContactId,
        opponentParticipantId: input.command.facts.opponentParticipantId,
        resolved: input.command.facts.resolved,
        resultId: input.command.facts.resultId,
        rollId: input.command.facts.rollId,
        rollPurpose: input.command.facts.rollPurpose,
        unbalancedConditionId: input.command.facts.unbalancedConditionId,
      },
    };
  }

  if (input.command.type === "roll_observation") {
    if (!input.controlledEncounterParticipantIds.has(input.command.participantId)) {
      return undefined;
    }
    return {
      ...input.command,
      facts: {
        observationAttemptId: input.command.facts.observationAttemptId,
        relationshipId: input.command.facts.relationshipId,
        targetParticipantId: input.command.facts.targetParticipantId,
      },
    };
  }

  return input.command;
}

function sanitizePlayerSafeDisarmRoll(roll: CombatDisarmRoll): CombatDisarmRoll {
  return {
    ...roll,
    calculation: {
      ...roll.calculation,
      percentageContributions: roll.calculation.percentageContributions.filter(
        (contribution) => contribution.category !== "weapon_control",
      ),
    },
    rolledByUserId: undefined,
  };
}

function buildPlayerSafeCombatRoundStateForUser(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): CombatRoundState | undefined {
  const roundState = input.encounter.combatRoundState
    ? initializeMaterializedCombatRoundState({
        encounter: input.encounter,
        scenarioParticipants: input.scenarioParticipants,
      })
    : undefined;

  if (!roundState) {
    return undefined;
  }

  const { controlledEncounterParticipantIds, visibleParticipantIds } =
    buildPlayerSafeCombatScopeForUser(input);
  const safeCurrentCursor =
    !roundState.currentCursor?.participantId ||
    visibleParticipantIds.has(roundState.currentCursor.participantId)
      ? roundState.currentCursor
      : undefined;
  const safePhaseResolutionCursor =
    roundState.phaseResolutionCursor &&
    visibleParticipantIds.has(roundState.phaseResolutionCursor.participantId)
      ? roundState.phaseResolutionCursor
      : undefined;
  const safePhaseResolutionStatuses = Object.fromEntries(
    Object.entries(roundState.phaseResolutionStatuses).filter(([participantId]) =>
      visibleParticipantIds.has(participantId),
    ),
  );
  const safeDistanceEdges = Object.fromEntries(
    Object.entries(roundState.distanceState?.edges ?? {}).filter(
      ([, edge]) =>
        (controlledEncounterParticipantIds.has(edge.participantAId) &&
          visibleParticipantIds.has(edge.participantBId)) ||
        (controlledEncounterParticipantIds.has(edge.participantBId) &&
          visibleParticipantIds.has(edge.participantAId)),
    ),
  );
  const safeRoundEndReview = roundState.roundEndReview
    ? {
        ...roundState.roundEndReview,
        continuedContactMaintenanceContests:
          roundState.roundEndReview.continuedContactMaintenanceContests
            .filter((contest) =>
              isPlayerVisibleCombatRoundResultPair({
                attackerParticipantId: contest.controllerParticipantId,
                controlledEncounterParticipantIds,
                defenderParticipantId: contest.affectedParticipantId,
                visibleParticipantIds,
              }),
            )
            .map((contest) => ({
              ...contest,
              affectedRoll: controlledEncounterParticipantIds.has(contest.affectedParticipantId)
                ? contest.affectedRoll
                : undefined,
              controllerRoll: controlledEncounterParticipantIds.has(contest.controllerParticipantId)
                ? contest.controllerRoll
                : undefined,
            })),
        participantReviews: Object.fromEntries(
          Object.entries(roundState.roundEndReview.participantReviews).filter(([participantId]) =>
            visibleParticipantIds.has(participantId),
          ),
        ),
        proposedDistances: roundState.roundEndReview.proposedDistances
          .map((proposal) =>
            buildPlayerSafeDistanceControlProposalForUser({
              controlledEncounterParticipantIds,
              proposal,
              visibleParticipantIds,
            }),
          )
          .filter((proposal): proposal is CombatRoundEndDistanceProposal => Boolean(proposal)),
      }
    : undefined;
  const safeBreakOffProposals = roundState.breakOffProposals
    .filter((proposal) =>
      isPlayerVisibleCombatRoundResultPair({
        attackerParticipantId: proposal.attackerParticipantId,
        controlledEncounterParticipantIds,
        defenderParticipantId: proposal.escapeeParticipantId,
        visibleParticipantIds,
      }),
    )
    .map((proposal) => ({
      ...proposal,
      attackerRoll: controlledEncounterParticipantIds.has(proposal.attackerParticipantId)
        ? proposal.attackerRoll
          ? { ...proposal.attackerRoll, rolledByUserId: undefined }
          : undefined
        : undefined,
      committedByUserId: undefined,
      escapeeRoll: controlledEncounterParticipantIds.has(proposal.escapeeParticipantId)
        ? proposal.escapeeRoll
          ? { ...proposal.escapeeRoll, rolledByUserId: undefined }
          : undefined
        : undefined,
      gmReview: proposal.gmReview ? { ...proposal.gmReview, notes: undefined } : undefined,
    }));

  const safeState: CombatRoundState = {
    ...roundState,
    activeParticipantId:
      roundState.activeParticipantId && visibleParticipantIds.has(roundState.activeParticipantId)
        ? roundState.activeParticipantId
        : undefined,
    commands: roundState.commands
      .map((command) =>
        buildPlayerSafeCombatRoundCommandForUser({
          command,
          controlledEncounterParticipantIds,
          visibleParticipantIds,
        }),
      )
      .filter((command): command is CombatRoundCommand => Boolean(command)),
    distanceState: {
      edges: safeDistanceEdges,
    },
    events: [],
    breakOffProposals: safeBreakOffProposals,
    disarmUnbalancedConditions: roundState.disarmUnbalancedConditions.filter(
      (condition) =>
        controlledEncounterParticipantIds.has(condition.affectedParticipantId) ||
        visibleParticipantIds.has(condition.affectedParticipantId),
    ),
    disarmAttempts: roundState.disarmAttempts
      .filter((attempt) =>
        isPlayerVisibleCombatRoundResultPair({
          attackerParticipantId: attempt.actingParticipantId,
          controlledEncounterParticipantIds,
          defenderParticipantId: attempt.resistingParticipantId,
          visibleParticipantIds,
        }),
      )
      .map((attempt) => ({
        ...attempt,
        difference: undefined,
        actingRoll: controlledEncounterParticipantIds.has(attempt.actingParticipantId)
          ? attempt.actingRoll
            ? sanitizePlayerSafeDisarmRoll(attempt.actingRoll)
            : undefined
          : undefined,
        resistingRoll: controlledEncounterParticipantIds.has(attempt.resistingParticipantId)
          ? attempt.resistingRoll
            ? sanitizePlayerSafeDisarmRoll(attempt.resistingRoll)
            : undefined
          : undefined,
      })),
    engagements: roundState.engagements.filter((engagement) =>
      isPlayerVisibleCombatRoundResultPair({
        attackerParticipantId: engagement.participantAId,
        controlledEncounterParticipantIds,
        defenderParticipantId: engagement.participantBId,
        visibleParticipantIds,
      }),
    ),
    gmBacktrackHold: undefined,
    adjustDistanceProposals: roundState.adjustDistanceProposals
      .filter((proposal) =>
        isPlayerVisibleCombatRoundResultPair({
          attackerParticipantId: proposal.attackerParticipantId,
          controlledEncounterParticipantIds,
          defenderParticipantId: proposal.defenderParticipantId,
          visibleParticipantIds,
        }),
      )
      .map((proposal) => {
        const viewerIsAttacker = controlledEncounterParticipantIds.has(
          proposal.attackerParticipantId,
        );
        const viewerIsDefender = controlledEncounterParticipantIds.has(
          proposal.defenderParticipantId,
        );
        return combatAdjustDistanceProposalSchema.parse({
          ...proposal,
          attackerRoll: viewerIsAttacker ? proposal.attackerRoll : undefined,
          attackerRollRecorded: proposal.attackerRollRecorded || Boolean(proposal.attackerRoll),
          committedByUserId: undefined,
          defenderRoll: viewerIsDefender ? proposal.defenderRoll : undefined,
          defenderRollRecorded: proposal.defenderRollRecorded || Boolean(proposal.defenderRoll),
          gmRollAdjustment: proposal.gmRollAdjustment
            ? { ...proposal.gmRollAdjustment, notes: undefined }
            : undefined,
          review: proposal.review ? { ...proposal.review, notes: undefined } : undefined,
        });
      }),
    feintProposals: roundState.feintProposals
      .filter((proposal) =>
        isPlayerVisibleCombatRoundResultPair({
          attackerParticipantId: proposal.attackerParticipantId,
          controlledEncounterParticipantIds,
          defenderParticipantId: proposal.defenderParticipantId,
          visibleParticipantIds,
        }),
      )
      .map((proposal) => {
        const viewerIsAttacker = controlledEncounterParticipantIds.has(
          proposal.attackerParticipantId,
        );
        const viewerIsDefender = controlledEncounterParticipantIds.has(
          proposal.defenderParticipantId,
        );
        const committed = proposal.status === "committed" || proposal.status === "impossible";
        return combatFeintProposalSchema.parse({
          ...proposal,
          attackerRoll: viewerIsAttacker ? proposal.attackerRoll : undefined,
          committedByUserId: undefined,
          defenderRoll: viewerIsDefender ? proposal.defenderRoll : undefined,
          difference: committed ? proposal.difference : undefined,
          feasibilityNote: undefined,
          review:
            committed && proposal.review ? { ...proposal.review, notes: undefined } : undefined,
          tableResult: committed ? proposal.tableResult : undefined,
        });
      }),
    genericActions: projectCombatGenericActionsForPlayer({
      actions: roundState.genericActions,
      controlledParticipantIds: controlledEncounterParticipantIds,
      visibleParticipantIds,
    }),
    offensiveParryContests: roundState.offensiveParryContests
      .filter((contest) =>
        isPlayerVisibleCombatRoundResultPair({
          attackerParticipantId: contest.controllerParticipantId,
          controlledEncounterParticipantIds,
          defenderParticipantId: contest.affectedParticipantId,
          visibleParticipantIds,
        }),
      )
      .map((contest) => ({
        ...contest,
        initiatorRoll: controlledEncounterParticipantIds.has(contest.controllerParticipantId)
          ? contest.initiatorRoll
          : undefined,
        responderRoll: controlledEncounterParticipantIds.has(contest.affectedParticipantId)
          ? contest.responderRoll
          : undefined,
      })),
    observationRelationships: buildPlayerSafeCombatObservationRelationships({
      controlledParticipantIds: controlledEncounterParticipantIds,
      relationships: roundState.observationRelationships,
    }),
    observationAttempts: buildPlayerSafeCombatObservationAttempts({
      attempts: roundState.observationAttempts,
      controlledParticipantIds: controlledEncounterParticipantIds,
      relationships: roundState.observationRelationships,
    }),
    continuedContacts: roundState.continuedContacts.filter((contact) =>
      isPlayerVisibleCombatRoundResultPair({
        attackerParticipantId: contact.controllerParticipantId,
        controlledEncounterParticipantIds,
        defenderParticipantId: contact.affectedParticipantId,
        visibleParticipantIds,
      }),
    ),
    currentCursor: safeCurrentCursor,
    participants: roundState.participants
      .filter((participant) => visibleParticipantIds.has(participant.participantId))
      .map((participant) =>
        controlledEncounterParticipantIds.has(participant.participantId)
          ? participant
          : {
              ...participant,
              declaration:
                roundState.currentStep === "select_actions"
                  ? undefined
                  : participant.declaration?.disarm
                    ? undefined
                    : participant.declaration
                      ? {
                          ...participant.declaration,
                          additionalActionNotes: undefined,
                          movementIntent: undefined,
                          secondaryActions:
                            participant.declaration.secondaryActionId === "observe_opponent"
                              ? undefined
                              : participant.declaration.secondaryActions,
                          secondaryActionContext:
                            participant.declaration.secondaryActionId === "observe_opponent"
                              ? undefined
                              : participant.declaration.secondaryActionContext,
                          secondaryActionId:
                            participant.declaration.secondaryActionId === "observe_opponent"
                              ? undefined
                              : participant.declaration.secondaryActionId,
                        }
                      : undefined,
            },
      ),
    phaseResolutionCursor: safePhaseResolutionCursor,
    phaseResolutionStatuses: safePhaseResolutionStatuses,
    roundEndReview: safeRoundEndReview,
    rounds: [],
    selectedParticipantId:
      roundState.selectedParticipantId &&
      visibleParticipantIds.has(roundState.selectedParticipantId)
        ? roundState.selectedParticipantId
        : undefined,
    stepSnapshots: [],
    unbalancedConditions: roundState.unbalancedConditions.filter(
      (condition) =>
        controlledEncounterParticipantIds.has(condition.affectedParticipantId) ||
        visibleParticipantIds.has(condition.affectedParticipantId),
    ),
  };

  return sanitizePlayerSafeCurrentCombatResultsState({
    controlledEncounterParticipantIds,
    state: safeState,
    visibleParticipantIds,
  });
}

export function buildPlayerSafeEncounterForUser(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): EncounterSession {
  if (!Array.isArray(input.encounter.participants)) {
    return {
      ...input.encounter,
      combatRoundState: buildPlayerSafeCombatRoundStateForUser(input),
      roleplayState: input.encounter.roleplayState
        ? buildPlayerSafeRoleplayStateForUser(input)
        : undefined,
    };
  }

  const membership = resolveEncounterParticipantMembership(input);
  const { visibleParticipantIds } = buildPlayerSafeCombatScopeForUser(input);

  return {
    ...input.encounter,
    combatRoundState: buildPlayerSafeCombatRoundStateForUser(input),
    participants: membership.participants
      .filter((participant) =>
        getCombatDistanceParticipantAliases(participant).some((alias) =>
          visibleParticipantIds.has(alias),
        ),
      )
      .map((participant) => {
        const resolution = resolveEncounterParticipantForViewer({
          encounter: input.encounter,
          requestedParticipantId: participant.id,
          scenarioParticipants: input.scenarioParticipants,
          viewer: { kind: "gm" },
        });

        return resolution
          ? {
              ...participant,
              characterId: resolution.characterId ?? participant.characterId,
              scenarioParticipantId: resolution.scenarioParticipantId,
            }
          : participant;
      }),
    roleplayState: input.encounter.roleplayState
      ? buildPlayerSafeRoleplayStateForUser(input)
      : undefined,
  };
}

function isPlayerVisibleCombatRoundResultPair(input: {
  attackerParticipantId: string;
  controlledEncounterParticipantIds: Set<string>;
  defenderParticipantId: string;
  visibleParticipantIds: Set<string>;
}): boolean {
  if (input.controlledEncounterParticipantIds.has(input.attackerParticipantId)) {
    return input.visibleParticipantIds.has(input.defenderParticipantId);
  }

  if (input.controlledEncounterParticipantIds.has(input.defenderParticipantId)) {
    return input.visibleParticipantIds.has(input.attackerParticipantId);
  }

  return false;
}

function sanitizePlayerSafeCurrentCombatResultResolution(
  result: CombatRoundPhaseResolutionResult,
): CombatRoundPhaseResolutionResult {
  return {
    ...result,
    damageResult: result.damageResult
      ? {
          ...result.damageResult,
          review: undefined,
        }
      : undefined,
  };
}

function sanitizePlayerSafeCurrentCombatResultsState(input: {
  controlledEncounterParticipantIds: Set<string>;
  state: CombatRoundState;
  visibleParticipantIds: Set<string>;
}): CombatRoundState {
  return {
    ...input.state,
    participants: input.state.participants.map((participant) => {
      const attackResultsByOpportunity = Object.fromEntries(
        Object.entries(participant.attackResultsByOpportunity ?? {}).filter(([, result]) =>
          isPlayerVisibleCombatRoundResultPair({
            attackerParticipantId: result.attackerParticipantId,
            controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
            defenderParticipantId: result.defenderParticipantId,
            visibleParticipantIds: input.visibleParticipantIds,
          }),
        ),
      );

      return {
        ...participant,
        attackResultsByOpportunity,
        attackResults: deriveCombatRoundAttackResultsCompatibility({
          attackResultsByOpportunity,
          participantId: participant.participantId,
        }),
      };
    }),
    phaseResolutionResults: input.state.phaseResolutionResults
      .filter((result) =>
        isPlayerVisibleCombatRoundResultPair({
          attackerParticipantId: result.attackerParticipantId,
          controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
          defenderParticipantId: result.defenderParticipantId,
          visibleParticipantIds: input.visibleParticipantIds,
        }),
      )
      .map(sanitizePlayerSafeCurrentCombatResultResolution),
  };
}

function buildPlayerSafeCombatRollMutationEncounterForUser(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): EncounterSession {
  return buildPlayerSafeEncounterForUser(input);
}

function preservePlayerCombatModifierBuckets(input: {
  existingContext: ReturnType<typeof scenarioParticipantCombatContextSchema.parse>;
  requestedContext: ReturnType<typeof scenarioParticipantCombatContextSchema.parse>;
}): ReturnType<typeof scenarioParticipantCombatContextSchema.parse> {
  return {
    ...input.requestedContext,
    modifierBuckets: input.existingContext.modifierBuckets,
  };
}

function resolveGenericCombatActionRollRequest(input: {
  body: GenericCombatActionBody;
  forceLookAroundPreset?: boolean;
  scenarioParticipant: ScenarioParticipant;
}): CombatGenericActionRollRequest | undefined {
  const rollKind = input.forceLookAroundPreset ? "skill" : input.body.rollKind;
  const difficulty = input.body.difficulty;
  if (!rollKind || rollKind === "none") return undefined;
  if (difficulty === undefined) {
    throw new RangeError("A numeric Difficulty is required for a Combat action roll.");
  }
  if (rollKind === "skill") {
    const skillId = input.forceLookAroundPreset ? "perception" : input.body.skillId;
    const skill = defaultCanonicalContent.skills.find((candidate) => candidate.id === skillId);
    if (!skill) throw new RangeError("Choose an existing Skill for this Combat action.");
    const profile = resolveParticipantSkillRollProfile({
      ...getScenarioParticipantFeintSkillInput(input.scenarioParticipant),
      skill,
    });
    return {
      basis: {
        avgStats: profile.avgStats,
        baseValue: profile.rollBaseValue + profile.unknownSkillPenalty,
        derivedXp: profile.derivedXP,
        groupXp: profile.groupXP,
        kind: "skill",
        skillId: profile.skillId,
        skillLabel: profile.skillName,
        skillXp: profile.skillXP,
        unknownSkillPenalty: profile.unknownSkillPenalty,
      },
      difficulty,
    };
  }

  if (!input.body.statId) throw new RangeError("Choose an existing Stat for this Combat action.");
  const profile = resolveParticipantStatRollProfile({
    participantId: input.scenarioParticipant.id,
    participantName: input.scenarioParticipant.snapshot.displayName,
    snapshot: input.scenarioParticipant.snapshot,
    statId: input.body.statId,
  });
  if (profile.statValue == null) {
    throw new RangeError(profile.warning ?? "The selected Current Stat is unavailable.");
  }
  return {
    basis: {
      baseValue: profile.statValue,
      kind: "stat",
      statId: profile.statId,
      statLabel: profile.statLabel,
    },
    difficulty,
  };
}

function resolveGenericCombatActionReference(input: {
  body: GenericCombatActionBody;
  encounter: EncounterSession;
  ownerEncounterParticipantId: string;
  ownerScenarioParticipant: ScenarioParticipant;
  roundState: CombatRoundState;
  visibleParticipantIds?: ReadonlySet<string>;
}): CombatGenericActionReference | undefined {
  if (!input.body.referenceKind || input.body.referenceKind === "none") return undefined;
  if (input.body.referenceKind === "environment") {
    if (!input.body.environmentDescription) {
      throw new RangeError("Describe the environment reference.");
    }
    return { description: input.body.environmentDescription, kind: "environment" };
  }
  if (input.body.referenceKind === "participant") {
    const participant = input.roundState.participants.find(
      (candidate) => candidate.participantId === input.body.referenceParticipantId,
    );
    if (
      !participant ||
      (input.visibleParticipantIds && !input.visibleParticipantIds.has(participant.participantId))
    ) {
      throw new RangeError("Choose an active visible Combat participant.");
    }
    return {
      kind: "participant",
      label: participant.label,
      participantId: participant.participantId,
    };
  }

  if (!input.body.itemId) throw new RangeError("Choose a canonical Item.");
  const equipmentState = getSnapshotEquipmentState(input.ownerScenarioParticipant);
  const itemsById = isRecord(equipmentState?.itemsById)
    ? (equipmentState.itemsById as Record<string, unknown>)
    : undefined;
  const item = itemsById?.[input.body.itemId];
  if (!isRecord(item)) throw new RangeError("The selected Item is no longer available.");
  const templateId = typeof item.templateId === "string" ? item.templateId : undefined;
  const template = templateId ? getEquipmentTemplatesById(equipmentState)?.[templateId] : undefined;
  const label =
    (typeof item.name === "string" && item.name.trim()) ||
    (isRecord(template) && typeof template.name === "string" && template.name.trim()) ||
    (templateId ? equipmentTemplatesById[templateId]?.name : undefined) ||
    "Item";
  return {
    itemId: input.body.itemId,
    kind: "item",
    label,
    ownerParticipantId: input.ownerEncounterParticipantId,
  };
}

export const encounterRoutes: FastifyPluginAsync = async (app) => {
  app.post("/encounters/:encounterId/combat-round/generic-actions", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId || encounter.kind !== "combat") {
        return reply.code(404).send({ error: "Combat encounter not found." });
      }
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        {
          scenarioId: encounter.scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );
      if (!access) return reply.code(404).send({ error: "Combat encounter not found." });

      const body = parseGenericCombatActionBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const existingAction = roundState.genericActions.find(
        (action) => action.id === body.actionId,
      );
      const isGm = access.mode === "gm";
      const membership = resolveEncounterParticipantMembership({ encounter, scenarioParticipants });
      const existingOwnerEncounterParticipant = existingAction
        ? resolveEncounterParticipantByRollParticipantId({
            participantId: existingAction.ownerParticipantId,
            participants: membership.participants,
          })
        : undefined;
      const existingOwnerScenarioParticipant = existingOwnerEncounterParticipant
        ? findScenarioParticipantForEncounterParticipant({
            encounterParticipant: existingOwnerEncounterParticipant,
            scenarioParticipants,
          })
        : undefined;
      const canAccessExistingAction =
        isGm || existingOwnerScenarioParticipant?.controlledByUserId === user.id;

      if (!isGm && body.operation !== "declare" && !canAccessExistingAction) {
        return reply.code(404).send({ error: "Combat action not found." });
      }

      // A retried declaration with the same client-generated identity returns the cached canonical
      // action even if the encounter revision advanced after the first successful write.
      if (body.operation === "declare" && existingAction) {
        if (!canAccessExistingAction) {
          return reply.code(404).send({ error: "Combat action not found." });
        }
        return {
          encounter:
            access.mode === "gm"
              ? encounter
              : buildPlayerSafeEncounterForUser({
                  encounter,
                  scenarioParticipants,
                  userId: user.id,
                }),
        };
      }
      // A repeated roll request returns the first server-owned roll, including after a refresh,
      // instead of advancing the revision or consuming another random roll.
      if (body.operation === "roll" && existingAction?.rollResult) {
        return {
          encounter:
            access.mode === "gm"
              ? encounter
              : buildPlayerSafeEncounterForUser({
                  encounter,
                  scenarioParticipants,
                  userId: user.id,
                }),
        };
      }
      if (body.expectedRevision !== encounter.updatedAt) {
        return reply.code(409).send({
          error: "The Combat action changed. Refresh and review the latest state.",
        });
      }

      const ownerParticipantId =
        body.operation === "declare" ? body.participantId : existingAction?.ownerParticipantId;
      const ownerEncounterParticipant = ownerParticipantId
        ? resolveEncounterParticipantByRollParticipantId({
            participantId: ownerParticipantId,
            participants: membership.participants,
          })
        : undefined;
      const ownerScenarioParticipant = ownerEncounterParticipant
        ? findScenarioParticipantForEncounterParticipant({
            encounterParticipant: ownerEncounterParticipant,
            scenarioParticipants,
          })
        : undefined;
      if (!ownerEncounterParticipant || !ownerScenarioParticipant?.isActive) {
        return reply.code(400).send({ error: "Choose an active participant in this Combat." });
      }
      const ownsParticipant = ownerScenarioParticipant.controlledByUserId === user.id;
      if (!isGm && !ownsParticipant) {
        return reply
          .code(403)
          .send({ error: "This Combat action is not assigned to this player." });
      }
      if (!isGm && body.operation !== "declare" && body.operation !== "roll") {
        return reply.code(403).send({ error: "Only the GM can review or resolve Combat actions." });
      }
      const visibleParticipantIds = isGm
        ? undefined
        : buildPlayerSafeCombatScopeForUser({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }).visibleParticipantIds;

      const now = new Date().toISOString();
      let genericActions = roundState.genericActions;
      if (body.operation === "declare") {
        if (!body.intent) return reply.code(400).send({ error: "Describe what you intend to do." });
        const duration = body.duration ?? { kind: "round" as const };
        const rollRequest = resolveGenericCombatActionRollRequest({
          body,
          forceLookAroundPreset: body.preset === "look_around",
          scenarioParticipant: ownerScenarioParticipant,
        });
        const reference = resolveGenericCombatActionReference({
          body,
          encounter,
          ownerEncounterParticipantId: ownerEncounterParticipant.id,
          ownerScenarioParticipant,
          roundState,
          visibleParticipantIds,
        });
        genericActions = declareCombatGenericAction({
          action: {
            createdAt: now,
            createdByUserId: user.id,
            duration,
            id: body.actionId,
            intent: body.intent,
            ownerParticipantId: ownerEncounterParticipant.id,
            preset: body.preset,
            reference,
            rollRequest,
          },
          actions: genericActions,
        });
      } else if (body.operation === "review") {
        if (!isGm) return reply.code(403).send({ error: "Only the GM can review Combat actions." });
        const duration = body.duration ?? existingAction!.duration;
        const rollRequest =
          body.rollKind !== undefined
            ? resolveGenericCombatActionRollRequest({
                body,
                scenarioParticipant: ownerScenarioParticipant,
              })
            : existingAction!.rollRequest;
        const reference =
          body.referenceKind !== undefined
            ? resolveGenericCombatActionReference({
                body,
                encounter,
                ownerEncounterParticipantId: ownerEncounterParticipant.id,
                ownerScenarioParticipant,
                roundState,
                visibleParticipantIds,
              })
            : existingAction!.reference;
        genericActions = reviewCombatGenericAction({
          actionId: body.actionId,
          actions: genericActions,
          duration,
          reference,
          reviewedAt: now,
          rollRequest,
        });
      } else if (body.operation === "activate") {
        genericActions = activateCombatGenericAction({
          actionId: body.actionId,
          activatedAt: now,
          actions: genericActions,
          roundNumber: roundState.roundNumber,
          step: roundState.currentStep,
        });
      } else if (body.operation === "roll") {
        if (!existingAction?.rollRequest) {
          return reply.code(400).send({ error: "This Combat action has no roll to make." });
        }
        genericActions = recordCombatGenericActionRoll({
          actionId: body.actionId,
          actions: genericActions,
          result: resolveGenericCombatActionRoll({
            request: existingAction.rollRequest,
            rolledAt: now,
            rolledByUserId: user.id,
          }),
        });
      } else {
        if (!isGm)
          return reply.code(403).send({ error: "Only the GM can resolve Combat actions." });
        const terminalStatus =
          body.operation === "resolve"
            ? "completed"
            : body.operation === "interrupt"
              ? "interrupted"
              : "cancelled";
        const validAudience = new Set(
          roundState.participants.map((participant) => participant.participantId),
        );
        if (body.visibleToParticipantIds.some((id) => !validAudience.has(id))) {
          return reply
            .code(400)
            .send({ error: "Choose active participants for the result audience." });
        }
        genericActions = finishCombatGenericAction({
          actionId: body.actionId,
          actions: genericActions,
          at: now,
          resolution:
            terminalStatus === "completed" && body.resultText
              ? {
                  resolvedAt: now,
                  resolvedByUserId: user.id,
                  text: body.resultText,
                  visibleToParticipantIds: body.visibleToParticipantIds,
                }
              : undefined,
          roundNumber: roundState.roundNumber,
          status: terminalStatus,
          step: roundState.currentStep,
        });
      }

      const nextEncounter = await encounterService.updateCombatEncounter({
        campaignId: access.campaignId,
        encounterId,
        expectedRevision: encounter.updatedAt,
        scenarioId: encounter.scenarioId,
        session: {
          ...encounter,
          combatRoundState: { ...roundState, genericActions },
          updatedAt: now,
        },
      });
      await scenarioService.recordScenarioEvent({
        actorUserId: user.id,
        eventType: "encounter_updated",
        payload: { actionId: body.actionId, encounterId, operation: body.operation },
        scenarioId: encounter.scenarioId,
        summary: `Combat action ${body.operation}.`,
      });
      return {
        encounter:
          access.mode === "gm"
            ? nextEncounter
            : buildPlayerSafeEncounterForUser({
                encounter: nextEncounter,
                scenarioParticipants,
                userId: user.id,
              }),
      };
    } catch (error) {
      const persistenceErrorResponse = sendCombatWriteError(reply, error);
      if (persistenceErrorResponse !== undefined) return persistenceErrorResponse;
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update the Combat action.",
      });
    }
  });

  app.addHook("preSerialization", async (request, _reply, payload) => {
    const response = measureCombatPerformanceStage("response_construction", () =>
      buildRequestedCombatMutationResponse({
        activeResponseRequested: prefersActiveCombatMutationResponse(
          request.headers[ACTIVE_COMBAT_MUTATION_RESPONSE_HEADER],
        ),
        payload,
      }),
    );
    try {
      probeCombatPerformanceSerialization(response);
    } catch {
      // Fastify owns canonical serialization and error handling. The probe must never alter it.
    }
    return response;
  });
  app.get("/scenarios/:scenarioId/encounters", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Scenario not found.",
        });
      }

      if (access.mode === "player") {
        const encounters = await encounterService.listEncountersByScenario(scenarioId);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);

        return {
          encounters: encounters.map((enc) =>
            buildPlayerSafeEncounterForUser({
              encounter: enc,
              scenarioParticipants,
              userId: user.id,
            }),
          ),
        };
      }

      return {
        encounters:
          await combatStateReadService.listScenarioEncounterManagementProjections(scenarioId),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list encounters.",
      });
    }
  });

  app.get("/scenarios/:scenarioId/encounter-summaries", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Scenario not found.",
        });
      }

      if (access.mode === "player") {
        const [encounterMetadata, scenarioParticipants] = await Promise.all([
          combatStateReadService.listEncounterAccessMetadataByScenario(scenarioId),
          scenarioService.listScenarioParticipants(scenarioId),
        ]);

        return {
          encounters: encounterMetadata.map((source) =>
            buildEncounterSessionSummaryFromMetadataView(source.metadata, {
              viewerAssigned: isUserAssignedToEncounterMembership({
                encounter: {
                  participantMembershipMode: source.participantMembershipMode,
                  participants: source.participants,
                  scenarioId: source.metadata.scenarioId,
                  status: source.metadata.status,
                },
                scenarioParticipants,
                userId: user.id,
              }),
            }),
          ),
        };
      }

      return {
        encounters: await encounterService.listEncounterSummariesByScenario(scenarioId),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list encounter summaries.",
      });
    }
  });

  app.post("/scenarios/:scenarioId/encounters", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({
          error: "Scenario not found.",
        });
      }

      const body = parseBodyObject(request.body, "Encounter payload");
      const encounterSession = encounterSessionSchema.parse(body.session);
      const encounter = await encounterService.createEncounter({
        campaignId: access.campaignId,
        createdByUserId: user.id,
        scenarioId,
        session: encounterSessionSchema.parse({
          ...encounterSession,
          combatRoundState: undefined,
          currentRound: 1,
        }),
      });
      const scenarioParticipants =
        (await scenarioService.listScenarioParticipants(scenarioId)) ?? [];
      await normalizeScenarioParticipantModifierRowsForEncounter({
        encounter,
        initializingNewEncounter: true,
        scenarioParticipants,
      });

      await scenarioService.recordScenarioEvent({
        actorUserId: user.id,
        eventType: "encounter_created",
        payload: {
          encounterId: encounter.id,
          kind: encounter.kind,
          status: encounter.status,
        },
        scenarioId,
        summary: `Created ${encounter.kind} encounter ${encounter.title}.`,
      });

      return { encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create encounter.",
      });
    }
  });

  app.get("/encounters/:encounterId", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const loadedScenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const scenarioParticipants = await normalizeScenarioParticipantModifierRowsForEncounter({
        encounter,
        persistChanges: false,
        scenarioParticipants: loadedScenarioParticipants,
      });
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const shouldNormalizeCombatRoundState =
        (encounter.kind === "combat" || Boolean(encounter.combatRoundState)) &&
        (!encounter.combatRoundState ||
          combatRoundStatesDiffer(roundState, encounter.combatRoundState));
      const normalizedEncounter = shouldNormalizeCombatRoundState
        ? encounterSessionSchema.parse({
            ...encounter,
            combatRoundState: roundState,
            currentRound: roundState.roundNumber,
          })
        : encounter;

      if (access.mode === "player") {
        return {
          encounter: buildPlayerSafeEncounterForUser({
            encounter: normalizedEncounter,
            scenarioParticipants,
            userId: user.id,
          }),
        };
      }

      return { encounter: normalizedEncounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load encounter.",
      });
    }
  });

  app.get("/encounters/:encounterId/revision", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await combatStateReadService.getEncounterMetadataById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId: encounter.scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      return {
        encounter: buildEncounterSessionRevisionFromMetadataView(encounter),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load encounter revision.",
      });
    }
  });

  app.get("/encounters/:encounterId/combat-history", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const historySource = await combatStateReadService.getCombatHistorySourceById(encounterId);

      if (!historySource?.scenarioId) {
        return reply.code(404).send({ error: "Encounter not found." });
      }

      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        {
          scenarioId: historySource.scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({ error: "Encounter not found." });
      }

      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        historySource.scenarioId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter: historySource,
        scenarioParticipants,
      });
      const state = initializeMaterializedCombatRoundState({
        encounter: {
          combatRoundState: historySource.activeCombatState
            ? {
                ...historySource.activeCombatState,
                rounds: historySource.archivedRounds,
              }
            : undefined,
          currentRound: historySource.currentRound,
          id: historySource.encounterId,
          participantMembershipMode: historySource.participantMembershipMode,
          participants: historySource.participants,
          scenarioId: historySource.scenarioId,
          status: historySource.status,
        },
        scenarioParticipants,
      });
      const materializedHistorySource = withCombatHistoryRoundState({
        source: historySource,
        state,
      });
      const participants = membership.participants.map((participant) => ({
        displayName: participant.label,
        participantId: participant.id,
      }));
      const playerScope = buildPlayerSafeCombatScopeForUser({
        encounter: historySource,
        scenarioParticipants,
        userId: user.id,
      });
      const requestedPerspectiveParticipantId =
        request.query && typeof request.query === "object"
          ? (request.query as Record<string, unknown>).perspectiveParticipantId
          : undefined;
      const perspectiveParticipant =
        access.mode === "gm" && typeof requestedPerspectiveParticipantId === "string"
          ? resolveEncounterParticipantForViewer({
              encounter: historySource,
              requestedParticipantId: requestedPerspectiveParticipantId,
              scenarioParticipants,
              viewer: { kind: "gm" },
            })?.encounterParticipant
          : undefined;
      if (
        access.mode === "gm" &&
        requestedPerspectiveParticipantId !== undefined &&
        !perspectiveParticipant
      ) {
        return reply.code(404).send({ error: "Participant not found." });
      }
      const perspectiveScope = perspectiveParticipant
        ? buildPlayerSafeCombatScopeForParticipants({
            controlledEncounterParticipants: [perspectiveParticipant],
            encounter: historySource,
            scenarioParticipants,
          })
        : undefined;
      const viewer =
        access.mode === "gm" && !perspectiveScope
          ? ({ kind: "gm" } as const)
          : {
              controlledParticipantIds:
                perspectiveScope?.controlledEncounterParticipantIds ??
                playerScope.controlledEncounterParticipantIds,
              kind: "player" as const,
              visibleParticipantIds:
                perspectiveScope?.visibleParticipantIds ?? playerScope.visibleParticipantIds,
            };
      const progressionProjection = buildCombatProgressionProjection(state, {
        participation: projectActiveCombatParticipation({
          encounterRevision: historySource.revision,
          scenarioParticipants,
          state,
        }),
      });
      const currentAttackModifierValidation = buildCurrentAttackModifierValidation({
        allowedAttackerParticipantIds:
          viewer.kind === "player" ? viewer.controlledParticipantIds : undefined,
        encounterId: historySource.encounterId,
        encounterParticipants: membership.participants,
        encounterRevision: historySource.revision,
        projection: progressionProjection,
        roundState: state,
        scenarioParticipants,
      });
      const currentParryModifierValidation = buildCurrentParryModifierValidation({
        allowedDefenderParticipantIds:
          viewer.kind === "player" ? viewer.controlledParticipantIds : undefined,
        encounterId: historySource.encounterId,
        encounterParticipants: membership.participants,
        encounterRevision: historySource.revision,
        projection: progressionProjection,
        roundState: state,
        scenarioParticipants,
      });

      return {
        history: projectCombatHistory({
          currentAttackModifierValidation,
          currentParryModifierValidation,
          participants,
          progressionProjection,
          source: materializedHistorySource,
          viewer,
        }),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load combat history.",
      });
    }
  });

  app.put("/encounters/:encounterId", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const existingEncounter = await encounterService.getEncounterById(encounterId);

      if (!existingEncounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId: existingEncounter.scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseBodyObject(request.body, "Encounter payload");
      const encounterSession = encounterSessionSchema.parse(body.session);
      const encounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId: existingEncounter.scenarioId,
        session: encounterSession,
      });

      await scenarioService.recordScenarioEvent({
        actorUserId: user.id,
        eventType: "encounter_updated",
        payload: {
          encounterId: encounter.id,
          participantCount: encounter.participants.length,
          status: encounter.status,
        },
        scenarioId: existingEncounter.scenarioId,
        summary: `Updated encounter ${encounter.title}.`,
      });

      return { encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update encounter.",
      });
    }
  });

  app.patch("/encounters/:encounterId/status", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const existingEncounter = await encounterService.getEncounterById(encounterId);

      if (!existingEncounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId: existingEncounter.scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseBodyObject(request.body, "Encounter status payload");
      const status = encounterStatusSchema.parse(body.status);
      const encounterSession = encounterSessionSchema.parse({
        ...existingEncounter,
        status,
        updatedAt: new Date().toISOString(),
      });
      const encounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId: existingEncounter.scenarioId,
        session: encounterSession,
      });

      await scenarioService.recordScenarioEvent({
        actorUserId: user.id,
        eventType: "encounter_updated",
        payload: {
          encounterId: encounter.id,
          previousStatus: existingEncounter.status,
          status: encounter.status,
        },
        scenarioId: existingEncounter.scenarioId,
        summary: `Updated encounter ${encounter.title} status to ${encounter.status}.`,
      });

      return { encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update encounter status.",
      });
    }
  });

  app.patch("/encounters/:encounterId/participants", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const existingEncounter = await encounterService.getEncounterById(encounterId);

      if (!existingEncounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId: existingEncounter.scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseBodyObject(request.body, "Encounter participants payload");

      if (!Array.isArray(body.participants)) {
        throw new Error("participants is required.");
      }

      const participantMembershipMode = encounterParticipantMembershipModeSchema.parse(
        body.participantMembershipMode ?? "explicit",
      );
      const encounterSession = encounterSessionSchema.parse({
        ...existingEncounter,
        participantMembershipMode,
        participants: body.participants,
        updatedAt: new Date().toISOString(),
      });
      const encounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId: existingEncounter.scenarioId,
        session: encounterSession,
      });

      await scenarioService.recordScenarioEvent({
        actorUserId: user.id,
        eventType: "encounter_updated",
        payload: {
          encounterId: encounter.id,
          participantCount: encounter.participants.length,
          status: encounter.status,
        },
        scenarioId: existingEncounter.scenarioId,
        summary: `Updated encounter ${encounter.title} participants.`,
      });

      return { encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update encounter participants.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-declaration", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatDeclarationBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: body.scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const membership = resolveEncounterParticipantMembership({ encounter, scenarioParticipants });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      const declarationCompatibility = validateCombatDeclarationCompatibility({
        movementKind: body.movementIntent?.mode,
        primaryAction: body.actionId,
        secondaryAction: body.secondaryActionId,
      });
      if (!declarationCompatibility.valid) {
        return reply.code(400).send({ error: declarationCompatibility.message });
      }

      const gmAuthorizedOperation = access.mode === "gm";
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const reviewedRoundParticipant = roundState.participants.find(
        (participant) => participant.participantId === encounterParticipant.id,
      );
      const gmModifierReviewOperation =
        gmAuthorizedOperation &&
        Boolean(reviewedRoundParticipant?.declaration) &&
        (roundState.currentStep === "review_action_modifiers" ||
          roundState.currentStep === "review_phase_2_modifiers");

      if (
        roundState.currentStep === "select_actions" &&
        isCombatStartExperienceRollRequired({
          participantId: encounterParticipant.id,
          state: roundState,
        })
      ) {
        return reply.code(409).send({
          error: "Roll Combat Experience before declaring an action.",
        });
      }

      const existingCombatContext = scenarioParticipantCombatContextSchema.parse(
        scenarioParticipant.state.combat.combatContext ?? {},
      );
      const selectedOffensiveParryOpponent =
        body.actionId === "offensive_parry"
          ? findCombatRoundParticipantByAlias({
              id: body.combatContext.selectedOpponentId,
              state: roundState,
            })
          : undefined;
      if (
        body.actionId === "offensive_parry" &&
        body.combatContext.selectedOpponentId &&
        (!selectedOffensiveParryOpponent ||
          selectedOffensiveParryOpponent.participantId === encounterParticipant.id)
      ) {
        return reply.code(400).send({
          error: "Select an active opponent to counter with Offensive Parry.",
        });
      }
      const selectedObserveOpponent =
        body.secondaryActionId === "observe_opponent"
          ? resolveCombatDeclarationParticipantIdentity({
              participantId: body.secondaryActionContext?.targetParticipantId,
              participants: roundState.participants,
            })?.participant
          : undefined;
      if (
        body.secondaryActionId === "observe_opponent" &&
        body.secondaryActionContext?.targetParticipantId &&
        (!selectedObserveOpponent ||
          selectedObserveOpponent.participantId === encounterParticipant.id)
      ) {
        return reply.code(400).send({
          error: "Select an active opponent to observe.",
        });
      }
      const canonicalSecondaryActionContext =
        body.secondaryActionId === "observe_opponent" && selectedObserveOpponent
          ? scenarioParticipantSecondaryActionContextSchema.parse({
              action: "observe_opponent",
              targetParticipantId: selectedObserveOpponent.participantId,
            })
          : body.secondaryActionContext;
      if (
        !gmModifierReviewOperation &&
        body.actionId === "parry" &&
        getScenarioParticipantDodgeSkillValue(scenarioParticipant) === undefined
      ) {
        return reply.code(400).send({
          error: "Parry requires the participant's canonical Dodge skill.",
        });
      }
      const canonicalRequestedCombatContext = scenarioParticipantCombatContextSchema.parse({
        ...body.combatContext,
        selectedOpponentId:
          body.actionId === "offensive_parry"
            ? selectedOffensiveParryOpponent?.participantId
            : body.combatContext.selectedOpponentId,
      });
      const submittedPhaseContexts = body.phaseContexts
        ? {
            phase1: body.phaseContexts.phase1
              ? gmAuthorizedOperation
                ? body.phaseContexts.phase1
                : preservePlayerCombatModifierBuckets({
                    existingContext: existingCombatContext,
                    requestedContext: body.phaseContexts.phase1,
                  })
              : undefined,
            phase2: body.phaseContexts.phase2
              ? gmAuthorizedOperation
                ? body.phaseContexts.phase2
                : preservePlayerCombatModifierBuckets({
                    existingContext: existingCombatContext,
                    requestedContext: body.phaseContexts.phase2,
                  })
              : undefined,
          }
        : undefined;
      const baseSubmittedCombatContext = gmAuthorizedOperation
        ? canonicalRequestedCombatContext
        : preservePlayerCombatModifierBuckets({
            existingContext: existingCombatContext,
            requestedContext: canonicalRequestedCombatContext,
          });
      // Generated rows are derived when the declaration is created and refreshed by domain
      // result transitions. During GM modifier review, the submitted rows are the reviewed
      // overrides and must not be regenerated back to their default values.
      let submittedCombatContext = gmModifierReviewOperation
        ? baseSubmittedCombatContext
        : applyGeneratedCombatActionModifiersForDeclaration({
            actionId: body.actionId,
            adjustDistance: body.adjustDistance
              ? {
                  currentDistance:
                    getDistanceEdgeBetweenParticipantAliases({
                      participantA: encounterParticipant,
                      participantB: findCombatRoundParticipantByAlias({
                        id: body.adjustDistance?.targetParticipantId,
                        state: roundState,
                      }),
                      state: roundState.distanceState,
                    })?.distance ?? 3,
                  requestedDistance: body.adjustDistance.requestedDistance,
                  roundNumber: roundState.roundNumber,
                }
              : undefined,
            combatContext: baseSubmittedCombatContext,
            encounterId: encounter.id,
            encounterParticipant,
            movementIntent: body.movementIntent,
            phaseContexts: submittedPhaseContexts,
            phaseAttackSources: body.phaseAttackSources,
            roundState,
            scenarioParticipant,
            secondaryActionId: body.secondaryActionId,
          });

      if (!gmAuthorizedOperation) {
        if (
          scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          })
        ) {
          return reply.code(403).send({
            error: "Player is not assigned to this encounter participant.",
          });
        }

        if (
          !canPlayerSubmitCombatDeclaration({
            participantId: encounterParticipant.id,
            state: roundState,
          })
        ) {
          return reply.code(409).send({
            error: "Declaration is closed for this round.",
          });
        }
      }

      const progressionParticipation = projectActiveCombatParticipation({
        encounterRevision: encounter.updatedAt,
        scenarioParticipants,
        state: roundState,
      });
      const progressionProjection = buildCombatProgressionProjection(roundState, {
        participation: progressionParticipation,
      });
      const commandType =
        progressionProjection.boundary.kind === "phase1_modifier_review"
          ? "review_modifiers_phase1"
          : progressionProjection.boundary.kind === "phase2_modifier_review"
            ? "review_modifiers_phase2"
            : "declare_action";
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor: gmAuthorizedOperation
            ? { kind: "gm" }
            : { kind: "combatant", participantId: encounterParticipant.id },
          commandType,
          participantId: encounterParticipant.id,
          phase:
            commandType === "review_modifiers_phase1"
              ? "phase1"
              : commandType === "review_modifiers_phase2"
                ? "phase2"
                : undefined,
        },
        encounterRevision: encounter.updatedAt,
        identity: body,
        // A descriptor issued before task-suppression deployment remains consumable once. New
        // clients never receive suppressed review tasks; retained canonical tasks authorize from
        // the participation-aware projection.
        projection: progressionProjection.boundary.processes
          .flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
          .some((task) => task.id === body.taskId)
          ? progressionProjection
          : undefined,
        roundState,
      });
      if (!authorization.ok) {
        return reply.code(409).send({
          code: authorization.code,
          error: "Declaration or modifier review is closed for this participant.",
        });
      }

      if (
        gmModifierReviewOperation &&
        (commandType === "review_modifiers_phase1" || commandType === "review_modifiers_phase2")
      ) {
        if (
          !body.expectedParticipantRevision ||
          body.expectedParticipantRevision !== scenarioParticipant.updatedAt
        ) {
          return reply.code(409).send({
            code: "stale_revision",
            error: "Participant modifier state changed while the review was open.",
          });
        }
        const roundParticipant = roundState.participants.find(
          (participant) => participant.participantId === encounterParticipant.id,
        );
        const declaration = roundParticipant?.declaration;
        if (!declaration) {
          return reply.code(409).send({ error: "The reviewed participant has no declaration." });
        }

        const submittedAt = new Date().toISOString();
        const commandId = buildCombatRoundCommandId({
          createdAt: submittedAt,
          participantId: encounterParticipant.id,
          state: roundState,
          type: commandType,
        });
        const canonicalCutoff =
          roundState.events.reduce((maximum, event) => Math.max(maximum, event.sequence), 0) + 1;
        const modifierReview = buildCanonicalModifierReviewFromDraft({
          canonicalCutoff,
          commandId,
          createdAt: submittedAt,
          currentContext: scenarioParticipantCombatContextSchema.parse(
            declaration.combatContext ?? existingCombatContext,
          ),
          draftContext: submittedCombatContext,
          encounterId: encounter.id,
          participantState: scenarioParticipant.state,
          phase: commandType === "review_modifiers_phase1" ? "M1" : "M2",
          publicNote: body.additionalActionNotes?.trim() || undefined,
          revision: encounter.updatedAt,
          roundNumber: roundState.roundNumber,
          scenarioParticipantId: scenarioParticipant.id,
        });
        const suppressBacktrackNoChangeResult = Boolean(
          roundState.gmBacktrackHold?.roundNumber === roundState.roundNumber &&
          roundState.gmBacktrackHold.participantId === encounterParticipant.id &&
          roundState.gmBacktrackHold.step === roundState.currentStep &&
          modifierReview.changes.length === 0 &&
          !modifierReview.input.publicNote,
        );
        const nextParticipantState = applyCanonicalModifierReviewToParticipantState({
          createdAt: submittedAt,
          draftContext: submittedCombatContext,
          state: scenarioParticipant.state,
          transaction: modifierReview,
        });
        const reviewedDeclarationState = recordCombatRoundDeclaration({
          declaration: {
            ...declaration,
            combatContext: submittedCombatContext,
            phaseContexts: {
              phase1: submittedPhaseContexts?.phase1 ?? declaration.phaseContexts?.phase1,
              phase2: submittedPhaseContexts?.phase2 ?? declaration.phaseContexts?.phase2,
            },
            submittedAt,
            submittedByUserId: user.id,
          },
          participantId: encounterParticipant.id,
          state: roundState,
          submittedBy: "gm",
        });
        const reviewedRoundState = recordCombatRoundParticipantStepReview({
          command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
          modifierReview,
          modifierReviewUndo: {
            combatContext: scenarioParticipant.state.combat.combatContext,
            combatEffects: scenarioParticipant.state.combatEffects,
          },
          participantId: encounterParticipant.id,
          previousDeclaration: declaration,
          state: reviewedDeclarationState,
          step: roundState.currentStep,
          submittedBy: "gm",
          suppressNoChangeResult: suppressBacktrackNoChangeResult,
        });
        if (
          body.reviewStepSnapshot &&
          (body.reviewStepSnapshot.participantId !== encounterParticipant.id ||
            body.reviewStepSnapshot.roundNumber !== roundState.roundNumber ||
            body.reviewStepSnapshot.step !== roundState.currentStep ||
            body.reviewStepSnapshot.phase !==
              (commandType === "review_modifiers_phase1" ? "phase1" : "phase2"))
        ) {
          return reply.code(409).send({
            code: "identity_mismatch",
            error: "The modifier-review combat summary belongs to another task.",
          });
        }
        const nextRoundState = body.reviewStepSnapshot
          ? upsertCombatRoundStepSnapshots({
              snapshots: [body.reviewStepSnapshot],
              state: reviewedRoundState,
            })
          : reviewedRoundState;
        const saved = await encounterService.commitCombatModifierReview({
          campaignId: access.campaignId,
          encounterId,
          expectedEncounterRevision: encounter.updatedAt,
          participant: scenarioParticipant,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: nextRoundState,
            currentRound: nextRoundState.roundNumber,
            updatedAt: submittedAt,
          },
          state: nextParticipantState,
        });

        return {
          commandEnvelope: buildCombatRoundCommandEnvelope({ state: nextRoundState }),
          encounter: saved.encounter,
          participant: saved.participant,
        };
      }

      const submittedMovementIntent = normalizeCombatDeclarationMovementIntent({
        encounter,
        encounterParticipant,
        gmAuthorizedOperation,
        movementIntent: body.movementIntent,
        roundState,
      });

      let attackOpportunities;
      let declarationPhaseContexts:
        | ReturnType<typeof combatRoundPhaseContextsSchema.parse>
        | undefined = submittedPhaseContexts;
      let declarationFeint;
      let declarationAdjustDistance;
      let declarationDisarm;
      if (body.actionId === "disarm" || body.actionId === "parry_disarm") {
        if (!body.disarm) {
          return reply.code(400).send({ error: "Select both weapons for Disarm." });
        }
        if (
          (body.actionId === "disarm" && body.disarm.method !== "proactive") ||
          (body.actionId === "parry_disarm" && body.disarm.method !== "reactive_parry")
        ) {
          return reply.code(400).send({ error: "The Disarm method does not match the action." });
        }
        const targetEncounterParticipant = membership.participants.find(
          (participant) =>
            participant.id === body.disarm?.targetParticipantId ||
            participant.scenarioParticipantId === body.disarm?.targetParticipantId ||
            participant.characterId === body.disarm?.targetParticipantId,
        );
        if (!targetEncounterParticipant) {
          return reply.code(400).send({ error: "The Disarm target is unavailable." });
        }
        try {
          declarationDisarm = await combatItemInteractionService.resolveDisarmDeclaration({
            actingItemId: body.disarm.actingItemId,
            actingItemRevision: body.disarm.actingItemRevision,
            actingParticipantId: encounterParticipant.id,
            campaignId: access.campaignId,
            encounterId: encounter.id,
            method: body.disarm.method,
            participants: membership.participants.map((participant) => ({
              characterId: participant.characterId,
              label: participant.label,
              participantId: participant.id,
            })),
            phase: body.disarm.phase,
            targetItemId: body.disarm.targetItemId,
            targetItemRevision: body.disarm.targetItemRevision,
            targetParticipantId: targetEncounterParticipant.id,
            viewer:
              access.mode === "gm"
                ? { kind: "gm" }
                : {
                    controlledParticipantIds: new Set([encounterParticipant.id]),
                    kind: "player",
                    visibleParticipantIds: buildPlayerSafeCombatScopeForUser({
                      encounter,
                      scenarioParticipants,
                      userId: user.id,
                    }).visibleParticipantIds,
                  },
          });
        } catch {
          return reply.code(409).send({
            code: "disarm_item_unavailable",
            error: "A selected Disarm weapon is unavailable. Refresh and select again.",
          });
        }
        const targetScenarioParticipant = findScenarioParticipantForEncounterParticipant({
          encounterParticipant: targetEncounterParticipant,
          scenarioParticipants,
        });
        if (
          !targetScenarioParticipant ||
          !hasExactWieldedWeaponItem({
            expectedRevision: declarationDisarm.actingWeapon.itemRevision,
            expectedTemplateId: declarationDisarm.actingWeapon.templateId,
            itemId: declarationDisarm.actingWeapon.itemId,
            participant: scenarioParticipant,
          }) ||
          !hasExactWieldedWeaponItem({
            expectedRevision: declarationDisarm.targetWeapon.itemRevision,
            expectedTemplateId: declarationDisarm.targetWeapon.templateId,
            itemId: declarationDisarm.targetWeapon.itemId,
            participant: targetScenarioParticipant,
          })
        ) {
          return reply.code(409).send({
            code: "disarm_item_unavailable",
            error: "A selected Disarm weapon is unavailable. Refresh and select again.",
          });
        }
        declarationPhaseContexts = {
          ...submittedPhaseContexts,
          [body.disarm.phase]: scenarioParticipantCombatContextSchema.parse({
            ...submittedPhaseContexts?.[body.disarm.phase],
            targetParticipantId: targetEncounterParticipant.id,
          }),
        };
        if (body.disarm.method === "proactive") {
          const source = body.phaseAttackSources?.[body.disarm.phase];
          if (!source || source.sourceKind !== "weapon") {
            return reply.code(400).send({ error: "Select the trapping weapon as attack source." });
          }
          const weaponResolution = resolveDeclaredWeaponSource({
            participant: scenarioParticipant,
            phaseLabel: body.disarm.phase === "phase1" ? "Phase 1" : "Phase 2",
            source,
          });
          if (!weaponResolution.ok) return reply.code(400).send({ error: weaponResolution.error });
          if (
            weaponResolution.source.itemId !== declarationDisarm.actingWeapon.itemId ||
            weaponResolution.source.weaponTemplateId !== declarationDisarm.actingWeapon.templateId
          ) {
            return reply.code(409).send({ error: "The Disarm attack source changed." });
          }
          attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
            actionId: body.actionId,
            disarmPhase: body.disarm.phase,
            participantId: encounterParticipant.id,
            phaseContexts: declarationPhaseContexts,
            roundNumber: roundState.roundNumber,
            sources: {
              [body.disarm.phase]: buildDeclaredAttackOpportunitySource({
                source,
                weapon: weaponResolution.source,
              }),
            },
          });
        }
      } else if (body.actionId === "adjust_range_attack") {
        if (!body.adjustDistance) {
          return reply.code(400).send({ error: "Select an opponent for Adjust Distance-Attack." });
        }
        const targetEncounterParticipant = membership.participants.find(
          (participant) =>
            participant.id === body.adjustDistance?.targetParticipantId ||
            participant.scenarioParticipantId === body.adjustDistance?.targetParticipantId ||
            participant.characterId === body.adjustDistance?.targetParticipantId,
        );
        if (!targetEncounterParticipant) {
          return reply
            .code(400)
            .send({ error: "The selected opponent is no longer in this encounter." });
        }
        const canonicalTargetParticipantId = targetEncounterParticipant.id;
        const submittedPhaseTargetIds = [
          submittedPhaseContexts?.phase1?.targetParticipantId,
          submittedPhaseContexts?.phase2?.targetParticipantId,
        ].filter((value): value is string => Boolean(value));
        const hasMismatchedPhaseTarget = submittedPhaseTargetIds.some((targetId) => {
          const resolved = membership.participants.find(
            (participant) =>
              participant.id === targetId ||
              participant.scenarioParticipantId === targetId ||
              participant.characterId === targetId,
          );
          return !resolved || resolved.id !== canonicalTargetParticipantId;
        });
        if (hasMismatchedPhaseTarget) {
          return reply.code(400).send({
            error: "Adjust Distance target and Phase 2 attack target must match.",
          });
        }
        const distanceEdge = getDistanceEdgeBetweenParticipantAliases({
          participantA: encounterParticipant,
          participantB: targetEncounterParticipant,
          state: roundState.distanceState,
        });
        if (!distanceEdge) {
          return reply
            .code(400)
            .send({ error: "Current distance is unavailable for this opponent." });
        }
        const existingAdjustDistanceProposal = roundState.adjustDistanceProposals.find(
          (proposal) =>
            proposal.roundNumber === roundState.roundNumber &&
            participantAliasesInclude({
              id: proposal.attackerParticipantId,
              participant: encounterParticipant,
            }),
        );
        const distanceAtDeclaration =
          existingAdjustDistanceProposal?.currentDistance ?? distanceEdge.distance;
        if (
          existingAdjustDistanceProposal?.status !== "committed" &&
          body.adjustDistance.requestedDistance === distanceAtDeclaration
        ) {
          return reply
            .code(400)
            .send({ error: "Requested distance must differ from the current distance." });
        }
        const phase2Source = body.phaseAttackSources?.phase2;
        if (!phase2Source) {
          return reply.code(400).send({ error: "Select an attack source for Phase 2." });
        }
        const phase2WeaponResolution =
          phase2Source.sourceKind === "weapon"
            ? resolveDeclaredWeaponSource({
                participant: scenarioParticipant,
                phaseLabel: "Phase 2",
                source: phase2Source,
              })
            : undefined;
        if (phase2WeaponResolution && !phase2WeaponResolution.ok) {
          return reply.code(400).send({ error: phase2WeaponResolution.error });
        }
        const contexts = {
          ...submittedPhaseContexts,
          phase1: scenarioParticipantCombatContextSchema.parse({
            ...submittedPhaseContexts?.phase1,
            targetParticipantId: canonicalTargetParticipantId,
          }),
          phase2: scenarioParticipantCombatContextSchema.parse({
            ...submittedPhaseContexts?.phase2,
            attackModeId: phase2WeaponResolution?.source.attackModeId ?? phase2Source.attackModeId,
            targetParticipantId: canonicalTargetParticipantId,
          }),
        };
        attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
          actionId: body.actionId,
          participantId: encounterParticipant.id,
          phaseContexts: contexts,
          roundNumber: roundState.roundNumber,
          sources: {
            phase2: buildDeclaredAttackOpportunitySource({
              source: phase2Source,
              weapon: phase2WeaponResolution?.source,
            }),
          },
        });
        declarationPhaseContexts = contexts;
        declarationAdjustDistance = {
          currentDistance: distanceEdge.distance,
          requestedDistance: body.adjustDistance.requestedDistance,
          targetParticipantId: canonicalTargetParticipantId,
        };
      } else if (body.actionId === "feint_attack") {
        if (!body.feint) {
          return reply.code(400).send({ error: "Select a feint method." });
        }
        const resolveEncounterTarget = (targetId: string | undefined) =>
          targetId
            ? membership.participants.find(
                (participant) =>
                  participant.id === targetId ||
                  participant.scenarioParticipantId === targetId ||
                  participant.characterId === targetId,
              )
            : undefined;
        const targetEncounterParticipant = resolveEncounterTarget(body.feint.targetParticipantId);
        if (!targetEncounterParticipant) {
          return reply.code(400).send({
            error: "The Feint target is no longer in this encounter.",
          });
        }
        const targetScenarioParticipant = scenarioParticipants.find(
          (participant) =>
            participant.id === targetEncounterParticipant?.scenarioParticipantId ||
            participant.id === targetEncounterParticipant?.id,
        );
        if (!targetScenarioParticipant) {
          return reply.code(400).send({
            error: "The Feint target is no longer in this encounter.",
          });
        }
        const canonicalTargetParticipantId = targetEncounterParticipant.id;
        const feintPhaseContexts = {
          ...submittedPhaseContexts,
          phase1: scenarioParticipantCombatContextSchema.parse({
            ...submittedPhaseContexts?.phase1,
            targetParticipantId: canonicalTargetParticipantId,
          }),
          phase2: scenarioParticipantCombatContextSchema.parse({
            ...submittedPhaseContexts?.phase2,
            targetParticipantId: canonicalTargetParticipantId,
          }),
        };
        const defenderProfile = resolveHighestCombatFeintResistanceProfile({
          ...getScenarioParticipantFeintSkillInput(targetScenarioParticipant),
          skills: defaultCanonicalContent.skills,
        });
        if (!defenderProfile) {
          return reply.code(400).send({
            error: "The defender has no relevant close-combat resistance skill.",
          });
        }
        const phase1Source = body.phaseAttackSources?.phase1;
        let feintWeaponSource: CombatAttackSourceRef | undefined;
        let attackerSkill =
          body.feint.method === "movement"
            ? defaultCanonicalContent.skills.find((skill) => skill.id === "dodge")
            : undefined;
        if (body.feint.method === "weapon") {
          if (!phase1Source || phase1Source.sourceKind !== "weapon") {
            return reply.code(400).send({ error: "Select a weapon for the weapon feint." });
          }
          const resolution = resolveDeclaredWeaponSource({
            participant: scenarioParticipant,
            phaseLabel: "Phase 1",
            source: phase1Source,
          });
          if (!resolution.ok) return reply.code(400).send({ error: resolution.error });
          feintWeaponSource = phase1Source;
          const derivedWeaponSkill = resolveCombatFeintWeaponSkillDefinition({
            skills: defaultCanonicalContent.skills,
            specializations: defaultCanonicalContent.specializations,
            weaponSkill: resolution.source.weaponSkill,
          });
          if (!derivedWeaponSkill || !isCombatFeintResistanceSkill(derivedWeaponSkill)) {
            return reply.code(400).send({
              error: `${resolution.source.weaponName} has no valid combat skill for a weapon feint.`,
            });
          }
          attackerSkill = derivedWeaponSkill;
        }
        if (!attackerSkill) {
          return reply.code(400).send({ error: "No valid skill is available for the feint." });
        }
        const phase2Source = body.phaseAttackSources?.phase2;
        if (!phase2Source) {
          return reply.code(400).send({ error: "Select an attack source for Phase 2." });
        }
        const phase2WeaponResolution =
          phase2Source.sourceKind === "weapon"
            ? resolveDeclaredWeaponSource({
                participant: scenarioParticipant,
                phaseLabel: "Phase 2",
                source: phase2Source,
              })
            : undefined;
        if (phase2WeaponResolution && !phase2WeaponResolution.ok) {
          return reply.code(400).send({ error: phase2WeaponResolution.error });
        }
        if (
          phase2Source.sourceKind === "unarmed" &&
          !new Set([punchTemplate.id, kickTemplate.id]).has(phase2Source.templateId)
        ) {
          return reply.code(400).send({ error: "Select a legal Phase 2 attack source." });
        }
        attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
          actionId: body.actionId,
          participantId: encounterParticipant.id,
          phaseContexts: feintPhaseContexts,
          roundNumber: roundState.roundNumber,
          sources: {
            phase2: buildDeclaredAttackOpportunitySource({
              source: phase2Source,
              weapon: phase2WeaponResolution?.source,
            }),
          },
        });
        declarationPhaseContexts = {
          ...feintPhaseContexts,
          phase2: {
            ...feintPhaseContexts.phase2,
            attackModeId: phase2WeaponResolution?.source.attackModeId ?? phase2Source.attackModeId,
          },
        };
        declarationFeint = {
          attackerSkillId: attackerSkill.id,
          attackerSkillLabel: attackerSkill.name,
          defenderSkillId: defenderProfile.skillId,
          defenderSkillLabel: defenderProfile.skillName,
          method: body.feint.method,
          targetParticipantId: canonicalTargetParticipantId,
          weaponSource: feintWeaponSource,
        };
      } else if (body.actionId === "double_attack") {
        const phase1Source = body.phaseAttackSources?.phase1;
        const phase2Source = body.phaseAttackSources?.phase2;
        if (!phase1Source) {
          return reply.code(400).send({
            error: "Double Attack is missing its Phase 1 attack source.",
          });
        }
        if (!phase2Source) {
          return reply.code(400).send({
            error: "Double Attack is missing its Phase 2 attack source.",
          });
        }
        if (
          phase1Source.opportunitySlot !== "attack_1" ||
          phase2Source.opportunitySlot !== "attack_2"
        ) {
          return reply.code(400).send({
            error: "Double Attack source opportunities do not match their declared phases.",
          });
        }
        const phase1WeaponResolution =
          phase1Source.sourceKind === "weapon"
            ? resolveDeclaredWeaponSource({
                participant: scenarioParticipant,
                phaseLabel: "Phase 1",
                source: phase1Source,
              })
            : undefined;
        const phase2WeaponResolution =
          phase2Source.sourceKind === "weapon"
            ? resolveDeclaredWeaponSource({
                participant: scenarioParticipant,
                phaseLabel: "Phase 2",
                source: phase2Source,
              })
            : undefined;
        const legalUnarmedSourceIds = new Set([punchTemplate.id, kickTemplate.id]);
        if (phase1WeaponResolution && !phase1WeaponResolution.ok) {
          return reply.code(400).send({ error: phase1WeaponResolution.error });
        }
        if (phase2WeaponResolution && !phase2WeaponResolution.ok) {
          return reply.code(400).send({ error: phase2WeaponResolution.error });
        }
        const phase1Weapon = phase1WeaponResolution?.source;
        const phase2Weapon = phase2WeaponResolution?.source;
        if (
          (phase1Source.sourceKind === "unarmed" &&
            !legalUnarmedSourceIds.has(phase1Source.templateId)) ||
          (phase2Source.sourceKind === "unarmed" &&
            !legalUnarmedSourceIds.has(phase2Source.templateId))
        ) {
          return reply.code(400).send({ error: "Select a legal unarmed source for both phases." });
        }
        const phase1Identity =
          phase1Weapon?.itemId ?? `${phase1Source.sourceKind}:${phase1Source.templateId}`;
        const phase2Identity =
          phase2Weapon?.itemId ?? `${phase2Source.sourceKind}:${phase2Source.templateId}`;
        if (phase1Identity === phase2Identity && !phase2Weapon?.repeatEligible) {
          return reply.code(400).send({
            error: phase2Weapon
              ? `The selected Phase 2 attack mode for ${phase2Weapon.weaponName} is not eligible for same-weapon Double Attack.`
              : "The same unarmed source cannot be used for both Double Attack opportunities.",
          });
        }
        attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
          actionId: body.actionId,
          participantId: encounterParticipant.id,
          phaseContexts: submittedPhaseContexts,
          roundNumber: roundState.roundNumber,
          sources: {
            phase1: buildDeclaredAttackOpportunitySource({
              source: phase1Source,
              weapon: phase1Weapon,
            }),
            phase2: buildDeclaredAttackOpportunitySource({
              source: phase2Source,
              weapon: phase2Weapon,
            }),
          },
        });
        declarationPhaseContexts = {
          phase1: submittedPhaseContexts?.phase1
            ? {
                ...submittedPhaseContexts.phase1,
                attackModeId: phase1Weapon?.attackModeId ?? phase1Source.attackModeId,
              }
            : undefined,
          phase2: submittedPhaseContexts?.phase2
            ? {
                ...submittedPhaseContexts.phase2,
                attackModeId: phase2Weapon?.attackModeId ?? phase2Source.attackModeId,
              }
            : undefined,
        };
      } else {
        const attackPhases = getCombatDeclarationAttackPhases({
          actionId: body.actionId,
          secondaryActionId: body.secondaryActionId,
        });
        if (attackPhases.length > 0) {
          const sources: Parameters<
            typeof buildCombatRoundDeclaredAttackOpportunities
          >[0]["sources"] = {};
          for (const phase of attackPhases) {
            const source = body.phaseAttackSources?.[phase];
            const phaseLabel = phase === "phase1" ? "Phase 1" : "Phase 2";
            if (!source) {
              return reply.code(400).send({
                error: `${phaseLabel} attack source is required.`,
              });
            }
            const weaponResolution =
              source.sourceKind === "weapon"
                ? resolveDeclaredWeaponSource({
                    participant: scenarioParticipant,
                    phaseLabel,
                    source,
                  })
                : undefined;
            if (weaponResolution && !weaponResolution.ok) {
              return reply.code(400).send({ error: weaponResolution.error });
            }
            if (
              source.sourceKind === "unarmed" &&
              !new Set([punchTemplate.id, kickTemplate.id]).has(source.templateId)
            ) {
              return reply.code(400).send({ error: `Select a legal ${phaseLabel} attack source.` });
            }
            sources[phase] = buildDeclaredAttackOpportunitySource({
              source,
              weapon: weaponResolution?.source,
            });
          }
          attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
            actionId: body.actionId,
            participantId: encounterParticipant.id,
            phaseContexts: submittedPhaseContexts,
            roundNumber: roundState.roundNumber,
            secondaryActionId: body.secondaryActionId,
            sources,
          });
        }
      }

      const submittedAt = new Date().toISOString();
      const lifecycleSequence =
        roundState.events.reduce((highest, event) => Math.max(highest, event.sequence), -1) + 1;
      const attackPhaseDefensivePenalties = attackOpportunities
        ? resolveCombatAttackPhaseDefensivePenalties({
            commitment: "committed",
            opportunities: attackOpportunities,
            participantId: encounterParticipant.id,
            roundNumber: roundState.roundNumber,
          })
        : [];
      submittedCombatContext = applyGeneratedCombatActionModifiersForDeclaration({
        actionId: body.actionId,
        attackPhaseDefensivePenalties,
        adjustDistance: declarationAdjustDistance
          ? { ...declarationAdjustDistance, roundNumber: roundState.roundNumber }
          : undefined,
        combatContext: submittedCombatContext,
        encounterId: encounter.id,
        encounterParticipant,
        movementIntent: submittedMovementIntent,
        phaseContexts: declarationPhaseContexts,
        phaseAttackSources: body.phaseAttackSources,
        roundState,
        scenarioParticipant,
        secondaryActionId: body.secondaryActionId,
        lifecycleContext: {
          createdAt: submittedAt,
          createdRevision: encounter.updatedAt,
          createdSequence: lifecycleSequence,
          encounterId: encounter.id,
          ownerParticipantId: scenarioParticipant.id,
          visibility: { audience: "involved", sourceIdentity: "public" },
        },
      });

      const targetValidation = validateCombatDeclarationTargets({
        actingParticipantId: encounterParticipant.id,
        actionId: body.actionId,
        movementKind: submittedMovementIntent?.mode,
        participantIdentities: roundState.participants,
        phaseContexts: declarationPhaseContexts,
        secondaryActionContext: canonicalSecondaryActionContext,
        selectedOpponentId: submittedCombatContext.selectedOpponentId,
        secondaryActionId: body.secondaryActionId,
      });

      if (!targetValidation.valid) {
        return reply.code(400).send({
          error: targetValidation.message ?? "Select a target for each attack phase.",
        });
      }

      const nextParticipantState = {
        ...scenarioParticipant.state,
        combat: {
          ...scenarioParticipant.state.combat,
          combatContext: submittedCombatContext,
          disarm: declarationDisarm,
          declarationSubmittedAt: submittedAt,
          declarationSubmittedByUserId: user.id,
          lastDeclaredActionId: body.actionId,
          lastDeclaredEncounterId: encounter.id,
          lastDeclaredMovementId: body.movementId,
          lastDeclaredRoundNumber: roundState.roundNumber,
          lastDeclaredSecondaryActionId: body.secondaryActionId,
          lastDeclarationNotes: body.additionalActionNotes,
          lastMovementIntent: submittedMovementIntent,
        },
      };
      const declaredRoundState = recordCombatRoundDeclaration({
        command:
          roundState.currentStep === "select_actions"
            ? {
                createdAt: submittedAt,
                createdByUserId: user.id,
              }
            : undefined,
        declaration: {
          actionId: body.actionId,
          adjustDistance: declarationAdjustDistance,
          additionalActionNotes: body.additionalActionNotes,
          attackOpportunities,
          attackPhaseDefensivePenalties,
          combatContext: submittedCombatContext,
          disarm: declarationDisarm,
          feint: declarationFeint,
          movementId: body.movementId,
          movementIntent: submittedMovementIntent,
          phaseContexts: declarationPhaseContexts,
          roundNumber: roundState.roundNumber,
          secondaryActions: canonicalSecondaryActionContext
            ? [canonicalSecondaryActionContext]
            : undefined,
          secondaryActionContext: canonicalSecondaryActionContext,
          secondaryActionId: body.secondaryActionId,
          submittedAt,
          submittedByUserId: user.id,
        },
        participantId: encounterParticipant.id,
        state: roundState,
        submittedBy: gmAuthorizedOperation ? "gm" : "player",
      });
      const environmentalMovement = submittedMovementIntent?.environmentalMovement;
      const declarationStateWithMovementAction = environmentalMovement
        ? {
            ...declaredRoundState,
            genericActions: declareCombatGenericAction({
              action: {
                createdAt: submittedAt,
                createdByUserId: user.id,
                duration: environmentalMovement.duration,
                id: environmentalMovement.actionId!,
                intent: `${
                  environmentalMovement.pace === "run"
                    ? "Run"
                    : environmentalMovement.pace === "walk"
                      ? "Walk"
                      : "Reposition"
                } to ${environmentalMovement.destination.description}.`,
                ownerParticipantId: encounterParticipant.id,
                preset: "environmental_movement" as const,
                reference: {
                  description: environmentalMovement.destination.description,
                  kind: "environment" as const,
                },
              },
              actions: declaredRoundState.genericActions,
            }),
          }
        : declaredRoundState;
      const nextRoundState =
        gmAuthorizedOperation &&
        roundState.currentStep !== "initiative_phase_1" &&
        roundState.currentStep !== "initiative_phase_2"
          ? recordCombatRoundParticipantStepReview({
              command:
                roundState.currentStep === "review_action_modifiers" ||
                roundState.currentStep === "review_phase_2_modifiers"
                  ? {
                      createdAt: submittedAt,
                      createdByUserId: user.id,
                    }
                  : undefined,
              participantId: encounterParticipant.id,
              state: declarationStateWithMovementAction,
              step: roundState.currentStep,
              submittedBy: "gm",
            })
          : declarationStateWithMovementAction;
      const saved = await encounterService.commitCombatParticipantStateMutation({
        campaignId: access.campaignId,
        encounterId,
        expectedEncounterRevision: encounter.updatedAt,
        participant: scenarioParticipant,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
        state: nextParticipantState,
      });

      const acceptedScenarioParticipants = scenarioParticipants.map((candidate) =>
        candidate.id === saved.participant.id ? saved.participant : candidate,
      );
      const deterministicAdvance = projectAcceptedDeterministicAdvance({
        encounter: saved.encounter,
        scenarioParticipants: acceptedScenarioParticipants,
      });

      return { deterministicAdvance, encounter: saved.encounter, participant: saved.participant };
    } catch (error) {
      const persistenceErrorResponse = sendCombatWriteError(reply, error);
      if (persistenceErrorResponse !== undefined) return persistenceErrorResponse;
      if (error instanceof CanonicalCombatModifierReviewError) {
        return reply
          .code(error.code === "illegal_decision" || error.code === "duplicate_effect" ? 400 : 409)
          .send({ code: error.code, error: error.message });
      }
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to save combat declaration.",
      });
    }
  });

  app.post(
    "/encounters/:encounterId/combat-round/double-attack-phase2-decision",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const body = parseBodyObject(request.body, "Double Attack decision payload");
        const identity = parseCombatTaskCommandIdentity(body);
        const opportunityId = parseNonEmptyString(body.opportunityId, "opportunityId");
        const scenarioParticipantId = parseOptionalDeclarationString(body.scenarioParticipantId);
        const decision =
          body.decision === "cancel"
            ? "cancel"
            : body.decision === "continue"
              ? "continue"
              : undefined;
        if (!scenarioParticipantId || !decision)
          throw new Error("Participant and decision are required.");
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access) return reply.code(404).send({ error: "Encounter not found." });
        const scenarioParticipants = await scenarioService.listScenarioParticipants(
          encounter.scenarioId,
        );
        const participantResolution = resolveCombatParticipantForRequest({
          accessMode: access.mode,
          encounter,
          requestedParticipantId: scenarioParticipantId,
          scenarioParticipants,
          userId: user.id,
        });
        const scenarioParticipant = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;
        if (!scenarioParticipant || !encounterParticipant)
          return reply.code(403).send({ error: "Participant is not assigned to this encounter." });
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor:
              access.mode === "gm"
                ? { kind: "gm" }
                : { kind: "combatant", participantId: encounterParticipant.id },
            commandType: "decide_double_attack_phase2",
            opportunityId,
            participantId: encounterParticipant.id,
            phase: "phase2",
          },
          encounterRevision: encounter.updatedAt,
          identity,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }
        const createdAt = new Date().toISOString();
        const nextRoundState = decideCombatRoundDoubleAttackPhase2({
          command: { createdAt, createdByUserId: user.id },
          decision,
          participantId: encounterParticipant.id,
          state: roundState,
        });
        const nextDeclaration = nextRoundState.participants.find(
          (entry) => entry.participantId === encounterParticipant.id,
        )?.declaration;
        const saved = await encounterService.commitCombatParticipantStateMutation({
          campaignId: access.campaignId,
          encounterId,
          expectedEncounterRevision: encounter.updatedAt,
          participant: scenarioParticipant,
          scenarioId: encounter.scenarioId,
          session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
          state: {
            ...scenarioParticipant.state,
            combat: {
              ...scenarioParticipant.state.combat,
              combatContext:
                nextDeclaration?.combatContext ?? scenarioParticipant.state.combat.combatContext,
            },
          },
        });
        return { encounter: saved.encounter, participant: saved.participant };
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error ? error.message : "Unable to record Double Attack decision.",
        });
      }
    },
  );

  app.post(
    "/encounters/:encounterId/combat-round/respond-adjust-distance",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const body = parseBodyObject(request.body, "Adjust Distance response payload");
        const identity = parseCombatTaskCommandIdentity(body);
        const proposalId = parseNonEmptyString(body.proposalId, "proposalId");
        const scenarioParticipantId = parseNonEmptyString(
          body.scenarioParticipantId,
          "scenarioParticipantId",
        );
        const response =
          body.response === "allow" ? "allow" : body.response === "oppose" ? "oppose" : undefined;
        if (!response) throw new Error("Select Allow or Oppose.");
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access) return reply.code(404).send({ error: "Encounter not found." });
        const scenarioParticipants = await scenarioService.listScenarioParticipants(
          encounter.scenarioId,
        );
        const participantResolution = resolveCombatParticipantForRequest({
          accessMode: access.mode,
          encounter,
          requestedParticipantId: scenarioParticipantId,
          scenarioParticipants,
          userId: user.id,
        });
        const scenarioParticipant = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;
        if (!scenarioParticipant || !encounterParticipant)
          return reply.code(403).send({ error: "Participant is not assigned to this encounter." });
        if (access.mode !== "gm" && scenarioParticipant.controlledByUserId !== user.id)
          return reply.code(403).send({ error: "Player does not control this participant." });
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const proposal = roundState.adjustDistanceProposals.find(
          (entry) => entry.id === proposalId,
        );
        if (!proposal || proposal.defenderParticipantId !== encounterParticipant.id)
          return reply
            .code(409)
            .send({ error: "The defender must choose whether to oppose the maneuver." });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor:
              access.mode === "gm"
                ? { kind: "gm" }
                : { kind: "combatant", participantId: encounterParticipant.id },
            commandType: "respond_adjust_distance",
            opponentParticipantId: proposal.attackerParticipantId,
            opportunityId: proposal.phase1OpportunityId,
            pairId: proposal.pairId,
            participantId: encounterParticipant.id,
            phase: "phase1",
            proposalId,
          },
          encounterRevision: encounter.updatedAt,
          identity,
          roundState,
        });
        if (!authorization.ok)
          return reply
            .code(409)
            .send({ error: "The defender must choose whether to oppose the maneuver." });
        const createdAt = new Date().toISOString();
        const nextRoundState = respondCombatRoundAdjustDistance({
          command: { createdAt, createdByUserId: user.id },
          proposalId,
          response,
          state: roundState,
        });
        const savedEncounter = await encounterService.updateCombatEncounter({
          expectedRevision: encounter.updatedAt,
          campaignId: access.campaignId,
          encounterId,
          scenarioId: encounter.scenarioId,
          session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
        });
        return {
          encounter:
            access.mode === "player"
              ? buildPlayerSafeCombatRollMutationEncounterForUser({
                  encounter: savedEncounter,
                  scenarioParticipants,
                  userId: user.id,
                })
              : savedEncounter,
        };
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to record the maneuver response.",
        });
      }
    },
  );

  app.post("/encounters/:encounterId/combat-round/review-break-off", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;
    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const body = parseBodyObject(request.body, "Break Off review payload");
      const identity = parseCombatTaskCommandIdentity(body);
      const proposalId = parseNonEmptyString(body.proposalId, "proposalId");
      const parseAdjustment = (value: unknown, label: string) => {
        const adjustment = value === undefined ? 0 : value;
        if (typeof adjustment !== "number" || !Number.isInteger(adjustment)) {
          throw new Error(`${label} must be an integer.`);
        }
        return adjustment;
      };
      const attackerAdjustment = parseAdjustment(body.attackerAdjustment, "Attacker adjustment");
      const escapeeAdjustment = parseAdjustment(body.escapeeAdjustment, "Escapee adjustment");
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access || access.mode !== "gm")
        return reply.code(403).send({ error: "The GM must review Break Off." });
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const proposal = roundState.breakOffProposals.find((entry) => entry.id === proposalId);
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor: { kind: "gm" },
          commandType: "review_break_off",
          opponentParticipantId: proposal?.attackerParticipantId,
          pairId: proposal?.pairKey,
          phase: "phase1",
          proposalId,
        },
        encounterRevision: encounter.updatedAt,
        identity,
        roundState,
      });
      if (!authorization.ok)
        return reply
          .code(409)
          .send({ error: "Break Off review is stale or not currently available." });
      const createdAt = new Date().toISOString();
      const nextRoundState = reviewCombatRoundBreakOff({
        attackerAdjustment,
        command: { createdAt, createdByUserId: user.id },
        escapeeAdjustment,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        proposalId,
        state: roundState,
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId: encounter.scenarioId,
        session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
      });
      return { encounter: savedEncounter };
    } catch (error) {
      const persistenceErrorResponse = sendCombatWriteError(reply, error);
      if (persistenceErrorResponse) return persistenceErrorResponse;
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to review Break Off.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/roll-break-off", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;
    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const body = parseBodyObject(request.body, "Break Off roll payload");
      const identity = parseCombatTaskCommandIdentity(body);
      const proposalId = parseNonEmptyString(body.proposalId, "proposalId");
      const scenarioParticipantId = parseNonEmptyString(
        body.scenarioParticipantId,
        "scenarioParticipantId",
      );
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access) return reply.code(404).send({ error: "Encounter not found." });
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;
      if (!scenarioParticipant || !encounterParticipant)
        return reply.code(403).send({ error: "Participant is not assigned to this encounter." });
      if (access.mode !== "gm" && scenarioParticipant.controlledByUserId !== user.id)
        return reply.code(403).send({ error: "Player does not control this participant." });
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const unavailableBreakOffRoll = () =>
        reply.code(409).send({
          code: "break_off_roll_unavailable",
          error: "Break Off roll is stale or not currently available.",
        });
      // Authorize only against the caller's exact projected task before inspecting proposal state.
      // Hidden, nonexistent, completed, and wrong-pair proposal probes are intentionally equivalent.
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor:
            access.mode === "gm"
              ? { kind: "gm" }
              : { kind: "combatant", participantId: encounterParticipant.id },
          commandType: "roll_break_off",
          participantId: encounterParticipant.id,
          phase: "phase1",
          proposalId,
        },
        encounterRevision: encounter.updatedAt,
        identity,
        roundState,
      });
      if (!authorization.ok) return unavailableBreakOffRoll();
      const proposal = roundState.breakOffProposals.find((entry) => entry.id === proposalId);
      if (!proposal || proposal.status !== "awaiting_rolls") return unavailableBreakOffRoll();
      const side =
        encounterParticipant.id === proposal.escapeeParticipantId
          ? "escapee"
          : encounterParticipant.id === proposal.attackerParticipantId
            ? "attacker"
            : undefined;
      if (!side) return unavailableBreakOffRoll();
      if (
        (side === "escapee" && proposal.escapeeRoll) ||
        (side === "attacker" && proposal.attackerRoll)
      )
        return unavailableBreakOffRoll();
      const opponentParticipantId =
        side === "escapee" ? proposal.attackerParticipantId : proposal.escapeeParticipantId;
      const membership = resolveEncounterParticipantMembership({ encounter, scenarioParticipants });
      const opponentEncounterParticipant = membership.participants.find(
        (participant) => participant.id === opponentParticipantId,
      );
      const opponentScenarioParticipant = opponentEncounterParticipant?.scenarioParticipantId
        ? scenarioParticipants.find(
            (participant) => participant.id === opponentEncounterParticipant.scenarioParticipantId,
          )
        : undefined;
      const distanceControlInput = buildRoundEndParticipantInputs({
        encounter,
        roundState,
        scenarioParticipants,
      })[encounterParticipant.id]?.distanceControl;
      if (!distanceControlInput)
        return reply.code(409).send({ error: "Dodge profile is unavailable." });
      const roll = rollOpenEndedD20();
      const createdAt = new Date().toISOString();
      const calculation = resolveAdjustDistanceSkillContestCalculation({
        calculationId: `${proposal.id}:roll:${side}`,
        contestType: "break_off",
        encounterId,
        gmAdjustment:
          side === "escapee"
            ? proposal.gmReview?.escapeeAdjustment
            : proposal.gmReview?.attackerAdjustment,
        modifierContributions: distanceControlInput.modifierContributions,
        opponentCombatantId: opponentParticipantId,
        opponentLabel: opponentScenarioParticipant?.snapshot.displayName,
        opponentScenarioParticipantId: opponentScenarioParticipant?.id,
        participant: scenarioParticipant,
        participantCombatantId: encounterParticipant.id,
        proposalId,
        role: side === "escapee" ? "break_off_escapee" : "break_off_attacker",
        roll,
        roundNumber: roundState.roundNumber,
        roundState,
        step: "phase_1_actions",
      });
      const result = combatBreakOffRollSchema.parse({
        calculation,
        finalTotal: calculation.finalResult,
        id: `${proposal.id}:roll:${side}`,
        participantId: encounterParticipant.id,
        rolledAt: createdAt,
        rolledByUserId: user.id,
      });
      const nextRoundState = recordCombatRoundBreakOffRoll({
        command: { createdAt, createdByUserId: user.id },
        proposalId,
        result,
        state: roundState,
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId: encounter.scenarioId,
        session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
      });
      return {
        encounter:
          access.mode === "player"
            ? buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              })
            : savedEncounter,
      };
    } catch (error) {
      const persistenceErrorResponse = sendCombatWriteError(reply, error);
      if (persistenceErrorResponse) return persistenceErrorResponse;
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll Break Off Dodge.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/commit-break-off", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;
    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const body = parseBodyObject(request.body, "Break Off commit payload");
      const identity = parseCombatTaskCommandIdentity(body);
      const proposalId = parseNonEmptyString(body.proposalId, "proposalId");
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access || access.mode !== "gm")
        return reply.code(403).send({ error: "The GM must commit Break Off." });
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const proposal = roundState.breakOffProposals.find((entry) => entry.id === proposalId);
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor: { kind: "gm" },
          commandType: "commit_break_off",
          opponentParticipantId: proposal?.attackerParticipantId,
          pairId: proposal?.pairKey,
          phase: "phase1",
          proposalId,
        },
        encounterRevision: encounter.updatedAt,
        identity,
        roundState,
      });
      if (!authorization.ok)
        return reply
          .code(409)
          .send({ error: "Break Off commit is stale or not currently available." });
      const createdAt = new Date().toISOString();
      let stateToSave = commitCombatRoundBreakOff({
        command: {
          createdAt,
          createdByUserId: user.id,
          createdRevision: encounter.updatedAt,
        },
        proposalId,
        state: roundState,
      });
      const command = stateToSave.commands.at(-1)!;
      const endedConditions = roundState.unbalancedConditions.filter((condition) => {
        const next = stateToSave.unbalancedConditions.find((entry) => entry.id === condition.id);
        return condition.status === "active" && next?.status === "ended";
      });
      const membership = resolveEncounterParticipantMembership({ encounter, scenarioParticipants });
      const participantMutations = new Map<
        string,
        { participant: ScenarioParticipant; state: ScenarioParticipant["state"] }
      >();
      const transitionSequence = Math.max(
        0,
        stateToSave.events.reduce((highest, event) => Math.max(highest, event.sequence), -1),
      );
      for (const endedCondition of endedConditions) {
        const affectedEncounterParticipant = membership.participants.find(
          (participant) => participant.id === endedCondition.affectedParticipantId,
        );
        const affected = affectedEncounterParticipant?.scenarioParticipantId
          ? scenarioParticipants.find(
              (participant) =>
                participant.id === affectedEncounterParticipant.scenarioParticipantId,
            )
          : undefined;
        if (!affected) {
          throw new RangeError("The Unbalanced participant is not assigned to this encounter.");
        }
        const currentState = participantMutations.get(affected.id)?.state ?? affected.state;
        const effects = combatEffectsStateSchema.parse(currentState.combatEffects);
        const previousEffect = effects.effects.find(
          (effect) =>
            effect.id === endedCondition.id &&
            (effect.status === "active" || effect.status === "pending"),
        );
        if (!previousEffect) {
          throw new RangeError(
            "The active Continued Contact relationship has no matching Unbalanced effect.",
          );
        }
        const activated =
          previousEffect.canonicalLifecycle?.lifecycle.state === "pending_activation"
            ? transitionCanonicalCombatModifierEffect({
                acceptedRevision: encounter.updatedAt,
                acceptedSequence: transitionSequence,
                commandId: command.id,
                effect: previousEffect.canonicalLifecycle,
                nextState: "active",
                reason: "activation_cutoff_reached",
                transitionId: `${command.id}:activate:${previousEffect.id}`,
                transitionType: "activate",
              })
            : undefined;
        const canonicalBeforeResolution = activated?.effect ?? previousEffect.canonicalLifecycle;
        const transitioned = canonicalBeforeResolution
          ? transitionCanonicalCombatModifierEffect({
              acceptedRevision: encounter.updatedAt,
              acceptedSequence: transitionSequence,
              commandId: command.id,
              effect: canonicalBeforeResolution,
              nextState: "resolved",
              reason: "condition_cleared",
              transitionId: `${command.id}:resolve:${previousEffect.id}`,
              transitionType: "resolve",
            })
          : undefined;
        const nextEffect = combatEffectSchema.parse({
          ...previousEffect,
          canonicalLifecycle: transitioned?.effect ?? previousEffect.canonicalLifecycle,
          canonicalTransitions: transitioned
            ? [
                ...(previousEffect.canonicalTransitions ?? []),
                ...(activated ? [activated.transition] : []),
                transitioned.transition,
              ]
            : previousEffect.canonicalTransitions,
          status: "expired",
          updatedAt: createdAt,
        });
        stateToSave = attachContinuedContactEffectTransitionFacts({
          commandId: command.id,
          nextEffect,
          previousEffect,
          scenarioParticipantId: affected.id,
          state: stateToSave,
        });
        participantMutations.set(affected.id, {
          participant: affected,
          state: {
            ...currentState,
            combatEffects: combatEffectsStateSchema.parse({
              ...effects,
              effects: effects.effects.map((effect) =>
                effect.id === previousEffect.id ? nextEffect : effect,
              ),
            }),
          },
        });
      }
      if (participantMutations.size > 0) {
        const saved = await encounterService.commitCombatParticipantStateMutations({
          campaignId: access.campaignId,
          encounterId,
          expectedEncounterRevision: encounter.updatedAt,
          participants: [...participantMutations.values()],
          scenarioId: encounter.scenarioId,
          session: { ...encounter, combatRoundState: stateToSave, updatedAt: createdAt },
        });
        return { encounter: saved.encounter, participants: saved.participants };
      }
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId: encounter.scenarioId,
        session: { ...encounter, combatRoundState: stateToSave, updatedAt: createdAt },
      });
      return { encounter: savedEncounter, participants: [] };
    } catch (error) {
      const persistenceErrorResponse = sendCombatWriteError(reply, error);
      if (persistenceErrorResponse) return persistenceErrorResponse;
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to commit Break Off.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/roll-disarm", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;
    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const body = parseBodyObject(request.body, "Disarm roll payload");
      const identity = parseCombatTaskCommandIdentity(body);
      const attemptId = parseNonEmptyString(body.attemptId, "attemptId");
      const requestedParticipantId = parseNonEmptyString(
        body.scenarioParticipantId,
        "scenarioParticipantId",
      );
      const skillChoice =
        body.skillChoice === "weapon_skill" || body.skillChoice === "parry"
          ? body.skillChoice
          : undefined;
      const characteristicChoice =
        body.characteristicChoice === "strength" || body.characteristicChoice === "dexterity"
          ? body.characteristicChoice
          : undefined;
      if (!skillChoice || !characteristicChoice) {
        return reply.code(400).send({ error: "Choose a Skill and characteristic for Disarm." });
      }
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access) return reply.code(404).send({ error: "Encounter not found." });
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;
      if (!scenarioParticipant || !encounterParticipant) {
        return reply.code(403).send({ error: "Participant is not assigned to this encounter." });
      }
      if (access.mode !== "gm" && scenarioParticipant.controlledByUserId !== user.id) {
        return reply.code(403).send({ error: "Player does not control this participant." });
      }
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const attempt = roundState.disarmAttempts.find((candidate) => candidate.id === attemptId);
      const unavailable = () =>
        reply.code(409).send({
          code: "disarm_roll_unavailable",
          error: "Disarm roll is stale or not currently available.",
        });
      if (!attempt || attempt.status !== "awaiting_rolls") return unavailable();
      const role =
        encounterParticipant.id === attempt.actingParticipantId
          ? "actor"
          : encounterParticipant.id === attempt.resistingParticipantId
            ? "holder"
            : undefined;
      if (!role) return unavailable();
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor:
            access.mode === "gm"
              ? { kind: "gm" }
              : { kind: "combatant", participantId: encounterParticipant.id },
          commandType: "roll_disarm",
          disarmAttemptId: attempt.id,
          participantId: encounterParticipant.id,
          phase: attempt.phase,
        },
        encounterRevision: encounter.updatedAt,
        identity,
        roundState,
      });
      if (!authorization.ok) return unavailable();

      const weaponTemplateId =
        role === "actor" ? attempt.actingWeaponTemplateId : attempt.targetWeaponTemplateId;
      const template = equipmentTemplatesById[weaponTemplateId];
      if (template?.category !== "weapon") return unavailable();
      const skill =
        skillChoice === "parry"
          ? defaultCanonicalContent.skills.find((candidate) => candidate.id === "parry")
          : resolveCombatFeintWeaponSkillDefinition({
              skills: defaultCanonicalContent.skills,
              specializations: defaultCanonicalContent.specializations,
              weaponSkill: template.weaponSkill,
            });
      if (!skill) return reply.code(409).send({ error: "The selected Skill is unavailable." });
      const profile = resolveParticipantSkillRollProfile({
        ...getScenarioParticipantFeintSkillInput(scenarioParticipant),
        linkedStatsOverride: [],
        preferAdjustedStats: true,
        skill,
      });
      const statId = characteristicChoice === "strength" ? "str" : "dex";
      const stat = resolveParticipantStatRollProfile({
        participantId: scenarioParticipant.id,
        participantName: scenarioParticipant.snapshot.displayName,
        snapshot: scenarioParticipant.snapshot,
        statId,
      });
      if (stat.statValue === undefined) {
        return reply.code(409).send({ error: "The selected characteristic is unavailable." });
      }
      const declaration = roundState.participants.find(
        (participant) => participant.participantId === attempt.actingParticipantId,
      )?.declaration?.disarm;
      if (!declaration) return unavailable();
      const activeStunned = (scenarioParticipant.state.combatEffects?.effects ?? []).filter(
        (effect) =>
          (effect.status === "active" || effect.status === "pending") &&
          (effect.canonicalLifecycle?.payload as { effectKind?: string } | undefined)
            ?.effectKind === "stunned",
      );
      const activeUnbalancedIds = new Set([
        ...roundState.disarmUnbalancedConditions
          .filter(
            (condition) =>
              condition.status === "active" &&
              condition.affectedParticipantId === encounterParticipant.id,
          )
          .map((condition) => condition.id),
        ...roundState.unbalancedConditions
          .filter(
            (condition) =>
              condition.status === "active" &&
              condition.affectedParticipantId === encounterParticipant.id,
          )
          .map((condition) => condition.id),
      ]);
      const roll = rollOpenEndedD20();
      const createdAt = new Date().toISOString();
      const calculation = resolveCombatDisarmRoll({
        actingParryModifier: declaration.actingWeapon.parryModifier,
        actingWeaponControlRating: declaration.actingWeapon.controlRating,
        calculationId: `${attempt.id}:roll:${role}`,
        characteristic: { choice: characteristicChoice, value: stat.statValue },
        conditions: [
          ...activeStunned.map((effect) => ({
            id: effect.id,
            kind: "stunned" as const,
            sourceId: effect.canonicalLifecycle?.id ?? effect.id,
          })),
          ...[...activeUnbalancedIds].map((id) => ({
            id,
            kind: "unbalanced" as const,
            sourceId: id,
          })),
        ],
        contactQualityModifier: attempt.contactQualityModifier,
        opponentParticipantId:
          role === "actor" ? attempt.resistingParticipantId : attempt.actingParticipantId,
        participantId: encounterParticipant.id,
        role,
        roll,
        skill: {
          choice: skillChoice,
          id: skill.id,
          label: skill.name,
          totalXp: profile.totalXP + profile.unknownSkillPenalty,
        },
        targetWeaponControlRating: declaration.targetWeapon.controlRating,
      });
      const result = combatDisarmRollSchema.parse({
        calculation,
        characteristicChoice,
        finalTotal: calculation.finalResult,
        id: `${attempt.id}:roll:${role}`,
        participantId: encounterParticipant.id,
        rolledAt: createdAt,
        rolledByUserId: user.id,
        skillChoice,
      });
      const nextRoundState = recordCombatRoundDisarmRoll({
        attemptId,
        command: { createdAt, createdByUserId: user.id },
        result,
        state: roundState,
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId: encounter.scenarioId,
        session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
      });
      return {
        encounter:
          access.mode === "player"
            ? buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              })
            : savedEncounter,
      };
    } catch (error) {
      const persistenceErrorResponse = sendCombatWriteError(reply, error);
      if (persistenceErrorResponse) return persistenceErrorResponse;
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll Disarm.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/commit-disarm", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;
    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const body = parseBodyObject(request.body, "Disarm commit payload");
      const identity = parseCombatTaskCommandIdentity(body);
      const attemptId = parseNonEmptyString(body.attemptId, "attemptId");
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access || access.mode !== "gm") {
        return reply.code(403).send({ error: "The GM must commit Disarm." });
      }
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const attempt = roundState.disarmAttempts.find((candidate) => candidate.id === attemptId);
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor: { kind: "gm" },
          commandType: "commit_disarm",
          disarmAttemptId: attemptId,
          phase: attempt?.phase,
        },
        encounterRevision: encounter.updatedAt,
        identity,
        roundState,
      });
      if (!authorization.ok || !attempt || attempt.status !== "awaiting_commit") {
        return reply.code(409).send({ error: "Disarm commit is stale or unavailable." });
      }
      const createdAt = new Date().toISOString();
      const commandId = buildCombatRoundCommandId({
        createdAt,
        participantId: attempt.actingParticipantId,
        state: roundState,
        type: "commit_disarm",
      });
      const nextRoundState = commitCombatRoundDisarm({
        attemptId,
        command: { commandId, createdAt, createdByUserId: user.id },
        state: roundState,
      });
      const session = { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt };
      if (attempt.result?.disarmed) {
        const membership = resolveEncounterParticipantMembership({
          encounter,
          scenarioParticipants,
        });
        const holder = membership.participants.find(
          (participant) => participant.id === attempt.resistingParticipantId,
        );
        if (!holder?.characterId) {
          return reply.code(409).send({ error: "The weapon holder is unavailable." });
        }
        const committed = await combatItemInteractionService.commitDisarm({
          actorUserId: user.id,
          campaignId: access.campaignId,
          commandId,
          encounterId,
          expectedEncounterRevision: encounter.updatedAt,
          ownerCharacterId: holder.characterId,
          roundNumber: roundState.roundNumber,
          scenarioId: encounter.scenarioId,
          session,
        });
        return { encounter: committed.encounter };
      }
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId: encounter.scenarioId,
        session,
      });
      return { encounter: savedEncounter };
    } catch (error) {
      const persistenceErrorResponse = sendCombatWriteError(reply, error);
      if (persistenceErrorResponse) return persistenceErrorResponse;
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to commit Disarm.",
      });
    }
  });

  app.post(
    "/encounters/:encounterId/combat-round/review-adjust-distance",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const body = parseBodyObject(request.body, "Adjust Distance review payload");
        const identity = parseCombatTaskCommandIdentity(body);
        const proposalId = parseNonEmptyString(body.proposalId, "proposalId");
        const value = body.value === undefined ? 0 : body.value;
        if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
          throw new Error("Maneuver adjustment must be an integer.");
        }
        const participantId = parseOptionalDeclarationString(body.participantId);
        const notes = typeof body.notes === "string" ? body.notes : undefined;
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access || access.mode !== "gm")
          return reply.code(403).send({ error: "The GM must confirm the maneuver adjustment." });
        const scenarioParticipants = await scenarioService.listScenarioParticipants(
          encounter.scenarioId,
        );
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const proposal = roundState.adjustDistanceProposals.find(
          (entry) => entry.id === proposalId,
        );
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: { kind: "gm" },
            commandType: "review_adjust_distance_roll_adjustment",
            opponentParticipantId: proposal?.defenderParticipantId,
            opportunityId: proposal?.phase1OpportunityId,
            pairId: proposal?.pairId,
            phase: "phase1",
            proposalId,
          },
          encounterRevision: encounter.updatedAt,
          identity,
          roundState,
        });
        if (!authorization.ok)
          return reply.code(409).send({ error: "The GM must confirm the maneuver adjustment." });
        const createdAt = new Date().toISOString();
        const nextRoundState = reviewCombatRoundAdjustDistanceRollAdjustment({
          command: { createdAt, createdByUserId: user.id },
          notes,
          participantId,
          proposalId,
          state: roundState,
          value,
        });
        const savedEncounter = await encounterService.updateCombatEncounter({
          expectedRevision: encounter.updatedAt,
          campaignId: access.campaignId,
          encounterId,
          scenarioId: encounter.scenarioId,
          session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
        });
        return { encounter: savedEncounter };
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error ? error.message : "Unable to confirm the maneuver adjustment.",
        });
      }
    },
  );

  app.post("/encounters/:encounterId/combat-round/roll-adjust-distance", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;
    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const body = parseBodyObject(request.body, "Adjust Distance roll payload");
      const identity = parseCombatTaskCommandIdentity(body);
      const proposalId = parseNonEmptyString(body.proposalId, "proposalId");
      const scenarioParticipantId = parseNonEmptyString(
        body.scenarioParticipantId,
        "scenarioParticipantId",
      );
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access) return reply.code(404).send({ error: "Encounter not found." });
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const membership = resolveEncounterParticipantMembership({ encounter, scenarioParticipants });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;
      if (!scenarioParticipant || !encounterParticipant)
        return reply.code(403).send({ error: "Participant is not assigned to this encounter." });
      if (access.mode !== "gm" && scenarioParticipant.controlledByUserId !== user.id)
        return reply.code(403).send({ error: "Player does not control this participant." });
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const proposal = roundState.adjustDistanceProposals.find((entry) => entry.id === proposalId);
      if (!proposal || proposal.status !== "awaiting_rolls")
        return reply
          .code(409)
          .send({ error: "Distance-adjustment rolls are not currently available." });
      const side =
        encounterParticipant.id === proposal.attackerParticipantId
          ? "attacker"
          : encounterParticipant.id === proposal.defenderParticipantId
            ? "defender"
            : undefined;
      if (!side)
        return reply.code(409).send({
          error: "Only a participant in this distance contest may roll Dodge.",
        });
      if (
        (side === "attacker" && proposal.attackerRoll) ||
        (side === "defender" && proposal.defenderRoll)
      )
        return reply.code(409).send({ error: "This participant has already rolled Dodge." });
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor:
            access.mode === "gm"
              ? { kind: "gm" }
              : { kind: "combatant", participantId: encounterParticipant.id },
          commandType: "roll_adjust_distance",
          opponentParticipantId:
            encounterParticipant.id === proposal.attackerParticipantId
              ? proposal.defenderParticipantId
              : proposal.attackerParticipantId,
          opportunityId: proposal.phase1OpportunityId,
          pairId: proposal.pairId,
          participantId: encounterParticipant.id,
          phase: "phase1",
          proposalId,
        },
        encounterRevision: encounter.updatedAt,
        identity,
        roundState,
      });
      if (!authorization.ok)
        return reply
          .code(409)
          .send({ error: "Distance-adjustment rolls are not currently available." });
      const distanceControlInput = buildRoundEndParticipantInputs({
        encounter,
        roundState,
        scenarioParticipants,
      })[encounterParticipant.id]?.distanceControl;
      if (!distanceControlInput)
        return reply.code(409).send({ error: "Dodge profile is unavailable." });
      const adjustment =
        proposal.gmRollAdjustment?.participantId === encounterParticipant.id
          ? proposal.gmRollAdjustment.value
          : 0;
      const opponentEncounterParticipantId =
        proposal.attackerParticipantId === encounterParticipant.id
          ? proposal.defenderParticipantId
          : proposal.attackerParticipantId;
      const opponentEncounterParticipant = membership.participants.find(
        (participant) => participant.id === opponentEncounterParticipantId,
      );
      const opponentScenarioParticipant = opponentEncounterParticipant?.scenarioParticipantId
        ? scenarioParticipants.find(
            (participant) => participant.id === opponentEncounterParticipant.scenarioParticipantId,
          )
        : undefined;
      const roll = rollOpenEndedD20();
      const createdAt = new Date().toISOString();
      const skillContestCalculation = resolveAdjustDistanceSkillContestCalculation({
        calculationId: `${proposal.id}:roll:${side}`,
        contestType: "adjust_distance_attack",
        encounterId,
        gmAdjustment: adjustment,
        modifierContributions: distanceControlInput.modifierContributions,
        opponentCombatantId: opponentEncounterParticipantId,
        opponentLabel: opponentScenarioParticipant?.snapshot.displayName,
        opponentScenarioParticipantId: opponentScenarioParticipant?.id,
        participant: scenarioParticipant,
        participantCombatantId: encounterParticipant.id,
        proposalId: proposal.id,
        role: side === "attacker" ? "initiator" : "resisting_opponent",
        roll,
        roundNumber: roundState.roundNumber,
        roundState,
        step: "phase_1_actions",
      });
      const generalFatigueModifier = skillContestCalculation.percentageContributions
        .filter((contribution) => contribution.category === "general_fatigue")
        .reduce((total, contribution) => total + contribution.value, 0);
      const result = combatAdjustDistanceRollResultSchema.parse({
        appliedModifiers: skillContestCalculation.percentageContributions.map((contribution) => ({
          bucket:
            contribution.category === "skill_ob" || contribution.category === "relationship"
              ? "skill_ob"
              : "general_fatigue",
          id: contribution.id,
          label: contribution.label,
          sourceId: contribution.sourceId,
          value: contribution.value,
        })),
        dodgeSkillLabel: skillContestCalculation.skill.label,
        dodgeSkillXp: skillContestCalculation.skill.totalXp,
        dodgeSkillTotal: skillContestCalculation.baseSkill,
        dodgeStatLabel: skillContestCalculation.governingStat.label,
        dodgeStatValue: skillContestCalculation.governingStat.value,
        finalTotal: skillContestCalculation.finalResult,
        generalFatigueModifier,
        id: `${proposal.id}:roll:${side}`,
        openEndedD10s: roll.openEndedD10s,
        participantId: encounterParticipant.id,
        rollD20: roll.rollD20,
        rollTotal: roll.dieResult,
        rolledAt: createdAt,
        rolledByUserId: user.id,
        situationalAdjustment: adjustment,
        skillContestCalculation,
        totalModifiers: skillContestCalculation.totalPercentageAdjustment,
        preDieTotal: skillContestCalculation.preDieTotal,
      });
      const nextRoundState = recordCombatRoundAdjustDistanceRoll({
        command: { createdAt, createdByUserId: user.id },
        proposalId,
        result,
        state: roundState,
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId: encounter.scenarioId,
        session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
      });
      return {
        encounter:
          access.mode === "player"
            ? buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              })
            : savedEncounter,
      };
    } catch (error) {
      return reply
        .code(400)
        .send({ error: error instanceof Error ? error.message : "Unable to roll Dodge." });
    }
  });

  app.post(
    "/encounters/:encounterId/combat-round/commit-adjust-distance",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const body = parseBodyObject(request.body, "Adjust Distance commit payload");
        const identity = parseCombatTaskCommandIdentity(body);
        const proposalId = parseNonEmptyString(body.proposalId, "proposalId");
        const committedDistance = combatDistanceSchema.parse(body.committedDistance);
        const outcome =
          body.outcome === "successful" ||
          body.outcome === "unsuccessful" ||
          body.outcome === "allowed"
            ? body.outcome
            : undefined;
        if (!outcome) throw new Error("Select the maneuver outcome.");
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access || access.mode !== "gm")
          return reply
            .code(403)
            .send({ error: "The GM must commit the distance proposal before Phase 2." });
        const scenarioParticipants = await scenarioService.listScenarioParticipants(
          encounter.scenarioId,
        );
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const proposal = roundState.adjustDistanceProposals.find(
          (entry) => entry.id === proposalId,
        );
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: { kind: "gm" },
            commandType: "commit_adjust_distance",
            opponentParticipantId: proposal?.defenderParticipantId,
            opportunityId: proposal?.phase1OpportunityId,
            pairId: proposal?.pairId,
            phase: "phase1",
            proposalId,
          },
          encounterRevision: encounter.updatedAt,
          identity,
          roundState,
        });
        if (!authorization.ok)
          return reply
            .code(409)
            .send({ error: "The GM must commit the distance proposal before Phase 2." });
        const createdAt = new Date().toISOString();
        const nextRoundState = commitCombatRoundAdjustDistance({
          command: { createdAt, createdByUserId: user.id },
          committedDistance,
          notes: typeof body.notes === "string" ? body.notes : undefined,
          outcome,
          proposalId,
          state: roundState,
        });
        const recomputed = recomputeRoundDeclarationCombatActionModifiers({
          encounter,
          roundState: nextRoundState,
          scenarioParticipants,
        });
        const participantMutations = Array.from(
          recomputed.participantStatesById,
          ([participantId, state]) => {
            const participant = scenarioParticipants.find(
              (candidate) => candidate.id === participantId,
            );
            if (!participant) {
              throw new RangeError(
                "A participant affected by the distance adjustment is no longer available.",
              );
            }
            return { participant, state };
          },
        );
        const saved = await encounterService.commitCombatParticipantStateMutations({
          campaignId: access.campaignId,
          encounterId,
          expectedEncounterRevision: encounter.updatedAt,
          participants: participantMutations,
          scenarioId: encounter.scenarioId,
          session: { ...encounter, combatRoundState: recomputed.roundState, updatedAt: createdAt },
        });
        return { encounter: saved.encounter, participants: saved.participants };
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error ? error.message : "Unable to commit the distance adjustment.",
        });
      }
    },
  );

  app.post("/encounters/:encounterId/combat-round/roll-feint", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;
    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const body = parseBodyObject(request.body, "Feint roll payload");
      const identity = parseCombatTaskCommandIdentity(body);
      const proposalId = parseNonEmptyString(body.proposalId, "proposalId");
      const scenarioParticipantId = parseNonEmptyString(
        body.scenarioParticipantId,
        "scenarioParticipantId",
      );
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access) return reply.code(404).send({ error: "Encounter not found." });
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const membership = resolveEncounterParticipantMembership({ encounter, scenarioParticipants });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;
      if (!scenarioParticipant || !encounterParticipant) {
        return reply.code(403).send({ error: "Participant is not assigned to this encounter." });
      }
      if (access.mode !== "gm" && scenarioParticipant.controlledByUserId !== user.id) {
        return reply.code(403).send({ error: "Player does not control this participant." });
      }
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const proposal = roundState.feintProposals.find((entry) => entry.id === proposalId);
      if (!proposal || proposal.status !== "awaiting_rolls") {
        return reply.code(409).send({ error: "Feint rolls are not currently available." });
      }
      const isAttackerRoll = !proposal.attackerRoll;
      const expectedParticipantId = isAttackerRoll
        ? proposal.attackerParticipantId
        : proposal.defenderParticipantId;
      if (encounterParticipant.id !== expectedParticipantId) {
        return reply.code(409).send({
          error: isAttackerRoll
            ? "The attacker must roll the feint."
            : "The defender must roll resistance.",
        });
      }
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor:
            access.mode === "gm"
              ? { kind: "gm" }
              : { kind: "combatant", participantId: encounterParticipant.id },
          commandType: "roll_feint",
          opponentParticipantId: isAttackerRoll
            ? proposal.defenderParticipantId
            : proposal.attackerParticipantId,
          opportunityId: proposal.phase1OpportunityId,
          pairId: proposal.pairId,
          participantId: encounterParticipant.id,
          phase: "phase1",
          proposalId,
        },
        encounterRevision: encounter.updatedAt,
        identity,
        roundState,
      });
      if (!authorization.ok) {
        return reply.code(409).send({ error: "Feint rolls are not currently available." });
      }
      const skillId = isAttackerRoll ? proposal.attackerSkillId : proposal.defenderSkillId;
      const opponentEncounterParticipantId = isAttackerRoll
        ? proposal.defenderParticipantId
        : proposal.attackerParticipantId;
      const opponentEncounterParticipant = membership.participants.find(
        (participant) => participant.id === opponentEncounterParticipantId,
      );
      const opponentScenarioParticipant = opponentEncounterParticipant?.scenarioParticipantId
        ? scenarioParticipants.find(
            (participant) => participant.id === opponentEncounterParticipant.scenarioParticipantId,
          )
        : undefined;
      const projection = buildLiveCombatModifierContributionProjection({
        combatContext: scenarioParticipant.state.combat.combatContext,
        combatEffects: scenarioParticipant.state.combatEffects,
        currentInitiativeGroupId: getCombatRoundCurrentInitiativeExecutionGroup({
          phase: "phase1",
          state: roundState,
        })?.id,
        currentRound: roundState.roundNumber,
        encounterId,
        ownerParticipantId: scenarioParticipant.id,
      });
      const roll = rollOpenEndedD20();
      const createdAt = new Date().toISOString();
      const skillContestCalculation = resolveFeintSkillContestCalculation({
        calculationId: `${proposal.id}:roll:${isAttackerRoll ? "attacker" : "defender"}`,
        encounterId,
        isAttacker: isAttackerRoll,
        modifierContributions: projection.contributions,
        opponentCombatantId: opponentEncounterParticipantId,
        opponentScenarioParticipantId: opponentScenarioParticipant?.id,
        participant: scenarioParticipant,
        participantCombatantId: encounterParticipant.id,
        proposal,
        roll,
        roundState,
        skillId,
      });
      const result = combatFeintRollResultSchema.parse({
        adjustment: skillContestCalculation.derivedIntegerAdjustment,
        characteristic: isAttackerRoll ? "dex" : "int",
        characteristicValue: skillContestCalculation.governingStat.value,
        finalTotal: skillContestCalculation.finalResult,
        id: `${proposal.id}:roll:${isAttackerRoll ? "attacker" : "defender"}`,
        openEndedD10s: roll.openEndedD10s,
        participantId: encounterParticipant.id,
        rollD20: roll.rollD20,
        rollTotal: roll.dieResult,
        rolledAt: createdAt,
        rolledByUserId: user.id,
        skillContestCalculation,
        skillId,
        skillLabel: skillContestCalculation.skill.label,
        skillXp: skillContestCalculation.skill.totalXp,
      });
      const difference = proposal.attackerRoll
        ? proposal.attackerRoll.finalTotal - result.finalTotal
        : undefined;
      const nextRoundState = recordCombatRoundFeintRoll({
        command: { createdAt, createdByUserId: user.id },
        proposalId,
        result,
        state: roundState,
        tableResult: difference === undefined ? undefined : resolveCombatFeintTable(difference),
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId: encounter.scenarioId,
        session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
      });
      return {
        encounter:
          access.mode === "player"
            ? buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              })
            : savedEncounter,
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll the feint.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/commit-feint", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;
    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const body = parseBodyObject(request.body, "Feint commit payload");
      const identity = parseCombatTaskCommandIdentity(body);
      const proposalId = parseNonEmptyString(body.proposalId, "proposalId");
      const gmAttackerDbParryModifier =
        body.gmAttackerDbParryModifier === undefined
          ? undefined
          : parseInteger(body.gmAttackerDbParryModifier, "gmAttackerDbParryModifier");
      const gmDefenderObDbModifier =
        body.gmDefenderObDbModifier === undefined
          ? undefined
          : parseInteger(body.gmDefenderObDbModifier, "gmDefenderObDbModifier");
      const gmDefenderSkillObModifier =
        body.gmDefenderSkillObModifier === undefined
          ? undefined
          : parseInteger(body.gmDefenderSkillObModifier, "gmDefenderSkillObModifier");
      const gmDefenderDbParryModifier =
        body.gmDefenderDbParryModifier === undefined
          ? undefined
          : parseInteger(body.gmDefenderDbParryModifier, "gmDefenderDbParryModifier");
      const notes = typeof body.notes === "string" ? body.notes : undefined;
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId: encounter.scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access) return reply.code(404).send({ error: "Encounter not found." });
      if (access.mode !== "gm") {
        return reply
          .code(403)
          .send({ error: "The GM must commit the feint result before Phase 2." });
      }
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const membership = resolveEncounterParticipantMembership({ encounter, scenarioParticipants });
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const existingProposal = roundState.feintProposals.find((entry) => entry.id === proposalId);
      if (!existingProposal?.review || existingProposal.status !== "awaiting_review") {
        return reply
          .code(409)
          .send({ error: "The GM must commit the feint result before Phase 2." });
      }
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor: { kind: "gm" },
          commandType: "commit_feint_result",
          opponentParticipantId: existingProposal.defenderParticipantId,
          opportunityId: existingProposal.phase1OpportunityId,
          pairId: existingProposal.pairId,
          phase: "phase1",
          proposalId,
        },
        encounterRevision: encounter.updatedAt,
        identity,
        roundState,
      });
      if (!authorization.ok) {
        return reply
          .code(409)
          .send({ error: "The GM must commit the feint result before Phase 2." });
      }
      const findScenarioParticipant = (roundParticipantId: string) => {
        const member = membership.participants.find(
          (participant) => participant.id === roundParticipantId,
        );
        return scenarioParticipants.find(
          (participant) => participant.id === member?.scenarioParticipantId,
        );
      };
      const attacker = findScenarioParticipant(existingProposal.attackerParticipantId);
      const defender = findScenarioParticipant(existingProposal.defenderParticipantId);
      if (!attacker || !defender) {
        return reply.code(409).send({ error: "Feint participants are no longer available." });
      }
      const createdAt = new Date().toISOString();
      const committedProposal = combatFeintProposalSchema.parse({
        ...existingProposal,
        committedAt: createdAt,
        committedByUserId: user.id,
        review: {
          ...existingProposal.review,
          gmAttackerDbParryModifier,
          gmDefenderDbParryModifier,
          gmDefenderObDbModifier,
          gmDefenderSkillObModifier,
          notes,
        },
        status: "committed",
      });
      const modifiers = applyCommittedCombatFeintModifiers({
        attackerCombatContext: attacker.state.combat.combatContext,
        attackerEffectOwnerParticipantId: attacker.id,
        defenderCombatContext: defender.state.combat.combatContext,
        defenderEffectOwnerParticipantId: defender.id,
        encounterId: encounter.id,
        lifecycleContext: {
          createdAt,
          createdRevision: encounter.updatedAt,
          createdSequence:
            roundState.events.reduce((highest, event) => Math.max(highest, event.sequence), -1) + 1,
          encounterId: encounter.id,
          visibility: { audience: "involved", sourceIdentity: "public" },
        },
        proposal: committedProposal,
      });
      const nextAttackerState = {
        ...attacker.state,
        combat: { ...attacker.state.combat, combatContext: modifiers.attackerCombatContext },
      };
      const nextDefenderState = {
        ...defender.state,
        combat: { ...defender.state.combat, combatContext: modifiers.defenderCombatContext },
      };
      const nextRoundState = commitCombatRoundFeintResult({
        attackerCombatContext: nextAttackerState.combat.combatContext,
        command: { createdAt, createdByUserId: user.id },
        defenderCombatContext: nextDefenderState.combat.combatContext,
        gmAttackerDbParryModifier,
        gmDefenderDbParryModifier,
        gmDefenderObDbModifier,
        gmDefenderSkillObModifier,
        modifierIds: modifiers.modifierIds,
        notes,
        previousAttackerCombatContext: attacker.state.combat.combatContext,
        previousDefenderCombatContext: defender.state.combat.combatContext,
        proposalId,
        state: roundState,
      });
      const saved = await encounterService.commitCombatParticipantStateMutations({
        campaignId: access.campaignId,
        encounterId,
        expectedEncounterRevision: encounter.updatedAt,
        participants: [
          { participant: attacker, state: nextAttackerState },
          { participant: defender, state: nextDefenderState },
        ],
        scenarioId: encounter.scenarioId,
        session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
      });
      return { encounter: saved.encounter, participants: saved.participants };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to commit the feint result.",
      });
    }
  });

  app.post(
    "/encounters/:encounterId/combat-round/complete-remaining-step",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) {
          return reply.code(404).send({ error: "Encounter not found." });
        }

        const scenarioId = encounter.scenarioId;
        const access = await timeCombatPerformanceStage("workspace_authorization", () =>
          resolveScenarioWorkspaceAccess(
            { campaignService, scenarioService },
            {
              scenarioId,
              userId: user.id,
              userRoles: user.roles,
            },
          ),
        );
        if (!access || access.mode !== "gm") {
          return reply.code(403).send({
            error: "Only GM users can complete the remaining combat step.",
          });
        }

        const value = parseBodyObject(request.body, "Complete remaining step payload");
        const identity = parseCombatTaskCommandIdentity(value);
        const phase = combatRoundPhaseSchema.parse(value.phase);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const { playerOwnedParticipantIds, roundState } = measureCombatPerformanceStage(
          "active_state_materialization",
          () => {
            const materializedRoundState = initializeMaterializedCombatRoundState({
              encounter,
              scenarioParticipants,
            });
            const ownedParticipantIds = new Set(
              materializedRoundState.participants.flatMap((roundParticipant) => {
                const encounterParticipant = encounter.participants.find((candidate) =>
                  participantAliasesInclude({
                    id: roundParticipant.participantId,
                    participant: candidate,
                  }),
                );
                const scenarioParticipant = findScenarioParticipantForEncounterParticipant({
                  encounterParticipant,
                  scenarioParticipants,
                });

                return scenarioParticipant?.controlledByUserId &&
                  scenarioParticipant.controlledByUserId !== user.id
                  ? [roundParticipant.participantId]
                  : [];
              }),
            );
            return {
              playerOwnedParticipantIds: ownedParticipantIds,
              roundState: materializedRoundState,
            };
          },
        );
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: { kind: "gm" },
            commandType: "complete_remaining_step",
            participantId:
              typeof value.participantId === "string" ? value.participantId : undefined,
            phase,
          },
          encounterRevision: encounter.updatedAt,
          identity,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({
            code: authorization.code,
            error: "The remaining combat step is no longer available for bulk completion.",
          });
        }

        const submittedAt = new Date().toISOString();
        const completed = measureCombatPerformanceStage("domain_command_execution", () =>
          completeRemainingCombatRoundStep({
            command: {
              createdAt: submittedAt,
              createdByUserId: user.id,
            },
            phase,
            playerOwnedParticipantIds,
            state: roundState,
          }),
        );
        const participantMutations =
          roundState.currentStep === "review_action_modifiers" ||
          roundState.currentStep === "review_phase_2_modifiers"
            ? completed.completedParticipantIds.map((participantId) => {
                const encounterParticipant = encounter.participants.find(
                  (participant) => participant.id === participantId,
                );
                const scenarioParticipant = scenarioParticipants.find(
                  (participant) => participant.id === encounterParticipant?.scenarioParticipantId,
                );
                const declaration = completed.state.participants.find(
                  (participant) => participant.participantId === participantId,
                )?.declaration;
                if (!encounterParticipant || !scenarioParticipant || !declaration) {
                  throw new RangeError(
                    "A participant in the remaining modifier review is no longer available.",
                  );
                }

                return {
                  participant: scenarioParticipant,
                  state: {
                    ...scenarioParticipant.state,
                    combat: {
                      ...scenarioParticipant.state.combat,
                      combatContext: scenarioParticipantCombatContextSchema.parse(
                        declaration.combatContext ?? scenarioParticipant.state.combat.combatContext,
                      ),
                    },
                  },
                };
              })
            : [];
        const saved =
          participantMutations.length > 0
            ? await encounterService.commitCombatParticipantStateMutations({
                campaignId: access.campaignId,
                encounterId,
                expectedEncounterRevision: encounter.updatedAt,
                participants: participantMutations,
                scenarioId,
                session: {
                  ...encounter,
                  combatRoundState: completed.state,
                  currentRound: completed.state.roundNumber,
                  updatedAt: submittedAt,
                },
              })
            : {
                encounter: await encounterService.updateCombatEncounter({
                  expectedRevision: encounter.updatedAt,
                  campaignId: access.campaignId,
                  encounterId,
                  scenarioId,
                  session: {
                    ...encounter,
                    combatRoundState: completed.state,
                    currentRound: completed.state.roundNumber,
                    updatedAt: submittedAt,
                  },
                }),
                participants: [] as ScenarioParticipant[],
              };

        return {
          blocker: completed.blocker,
          commandEnvelope: buildCombatRoundCommandEnvelope({ state: completed.state }),
          completedParticipantIds: completed.completedParticipantIds,
          encounter: saved.encounter,
          participants: saved.participants,
          stoppedAtParticipantId: completed.stoppedAtParticipantId,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to complete the remaining combat step.";
        return reply.code(error instanceof RangeError ? 409 : 400).send({ error: message });
      }
    },
  );

  app.post(
    "/encounters/:encounterId/combat-round/skip-current-phase-action",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) {
          return reply.code(404).send({ error: "Encounter not found." });
        }
        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access || access.mode !== "gm") {
          return reply.code(403).send({ error: "Only GM users can skip a combat action." });
        }

        const value = parseBodyObject(request.body, "Skip current phase action payload");
        const identity = parseCombatTaskCommandIdentity(value);
        const phase = combatRoundPhaseSchema.parse(value.phase);
        const participantId = parseId(value, "participantId", "Participant id");
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: { kind: "gm" },
            commandType: "skip_phase_action",
            participantId,
            phase,
          },
          encounterRevision: encounter.updatedAt,
          identity,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({
            code: authorization.code,
            error: "The current phase action is no longer available to skip.",
          });
        }

        const submittedAt = new Date().toISOString();
        const nextRoundState = skipCombatRoundCurrentPhaseAction({
          command: { createdAt: submittedAt, createdByUserId: user.id },
          participantId,
          phase,
          state: roundState,
          submittedBy: "gm",
          updatedAt: submittedAt,
        });
        const savedEncounter = await encounterService.updateCombatEncounter({
          expectedRevision: encounter.updatedAt,
          campaignId: access.campaignId,
          encounterId,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: nextRoundState,
            currentRound: nextRoundState.roundNumber,
            updatedAt: submittedAt,
          },
        });
        return {
          commandEnvelope: buildCombatRoundCommandEnvelope({ state: nextRoundState }),
          encounter: savedEncounter,
        };
      } catch (error) {
        return reply.code(error instanceof RangeError ? 409 : 400).send({
          error: error instanceof Error ? error.message : "Unable to skip the current action.",
        });
      }
    },
  );

  app.post("/encounters/:encounterId/combat-initiative", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatInitiativeBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: body.scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      if (body.expectedParticipantRevision !== scenarioParticipant.updatedAt) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Participant combat state changed before initiative was rolled.",
        });
      }

      const gmAuthorizedOperation = access.mode === "gm";
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const phase = getCombatRoundInitiativePhaseForStep(roundState.currentStep);

      if (
        !phase ||
        (roundState.currentStep !== "initiative_phase_1" &&
          roundState.currentStep !== "initiative_phase_2")
      ) {
        return reply.code(409).send({
          error: "Initiative is not open for this step.",
        });
      }

      const initiativeAuthorization = authorizeCombatTaskCommand({
        authorization: {
          actor: gmAuthorizedOperation
            ? { kind: "gm" }
            : { kind: "combatant", participantId: encounterParticipant.id },
          commandType: phase === "phase1" ? "roll_initiative_phase1" : "roll_initiative_phase2",
          participantId: encounterParticipant.id,
          phase,
        },
        encounterRevision: encounter.updatedAt,
        identity: body,
        roundState,
      });
      if (!initiativeAuthorization.ok) {
        return reply.code(409).send({
          error: "Initiative is closed for this step.",
        });
      }

      if (!gmAuthorizedOperation) {
        if (
          scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          })
        ) {
          return reply.code(403).send({
            error: "Player is not assigned to this encounter participant.",
          });
        }

        if (
          !canPlayerRollCombatInitiative({
            participantId: encounterParticipant.id,
            phase,
            state: roundState,
          })
        ) {
          return reply.code(409).send({
            error: "Initiative is closed for this step.",
          });
        }
      }

      const initiativeContext = resolveCanonicalCombatInitiativeBaseForTask({
        encounterParticipantId: encounterParticipant.id,
        participant: scenarioParticipant,
        phase,
        state: roundState,
      });
      if (initiativeContext.completeness !== "complete") {
        return reply.code(409).send({
          code: "initiative_context_unavailable",
          error: "Required initiative context is unavailable. Refresh combat before rolling.",
        });
      }
      const submittedAt = new Date().toISOString();
      const rolled = recordCanonicalServerCombatInitiative({
        encounter,
        encounterParticipantId: encounterParticipant.id,
        initiativeBase: initiativeContext.initiativeBase,
        phase,
        scenarioParticipant,
        state: roundState,
        submittedBy: gmAuthorizedOperation ? "gm" : "player",
        submittedAt,
        userId: user.id,
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: rolled.state,
          currentRound: rolled.state.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return {
        encounter: gmAuthorizedOperation
          ? savedEncounter
          : buildPlayerSafeCombatRollMutationEncounterForUser({
              encounter: savedEncounter,
              scenarioParticipants,
              userId: user.id,
            }),
        initiative: rolled.initiative,
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll combat initiative.",
      });
    }
  });

  app.post(
    "/encounters/:encounterId/combat-round/combat-experience-difficulty",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);

        if (!encounter?.scenarioId) {
          return reply.code(404).send({
            error: "Encounter not found.",
          });
        }

        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          {
            campaignService,
            scenarioService,
          },
          {
            scenarioId,
            userId: user.id,
            userRoles: user.roles,
          },
        );

        if (!access || access.mode !== "gm") {
          return reply.code(403).send({
            error: "Only GM users can set Combat Experience difficulty.",
          });
        }

        const body = parseCombatExperienceDifficultyBody(request.body);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const nextRoundState = setCombatRoundCombatExperienceDifficulty({
          difficulty: body.difficulty,
          state: roundState,
        });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: { kind: "gm" },
            commandType: "set_combat_experience_difficulty",
          },
          encounterRevision: encounter.updatedAt,
          identity: body,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }
        const submittedAt = new Date().toISOString();
        const savedEncounter = await encounterService.updateCombatEncounter({
          expectedRevision: encounter.updatedAt,
          campaignId: access.campaignId,
          encounterId,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: nextRoundState,
            currentRound: nextRoundState.roundNumber,
            updatedAt: submittedAt,
          },
        });

        return {
          difficulty: getCombatRoundCombatExperienceDifficulty(nextRoundState),
          encounter: savedEncounter,
          windowOpen: isCombatRoundCombatExperienceWindowOpen(nextRoundState),
        };
      } catch (error) {
        const persistenceErrorResponse = sendCombatWriteError(reply, error);
        if (persistenceErrorResponse !== undefined) {
          return persistenceErrorResponse;
        }
        return reply.code(400).send({
          error:
            error instanceof Error ? error.message : "Unable to set Combat Experience difficulty.",
        });
      }
    },
  );

  app.post("/encounters/:encounterId/combat-round/pair-distance", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(403).send({
          error: "Only GM users can set combat distance.",
        });
      }

      const body = parsePairDistanceBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const submittedAt = new Date().toISOString();
      const nextRoundState = setCombatRoundPairDistance({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        distance: body.distance,
        participantAId: body.participantAId,
        participantBId: body.participantBId,
        state: roundState,
      });
      const recomputed = recomputeRoundDeclarationCombatActionModifiers({
        encounter,
        roundState: nextRoundState,
        scenarioParticipants,
      });
      const participantMutations = Array.from(
        recomputed.participantStatesById,
        ([participantId, state]) => {
          const participant = scenarioParticipants.find(
            (candidate) => candidate.id === participantId,
          );
          if (!participant) {
            throw new RangeError("A participant affected by distance is no longer available.");
          }
          return { participant, state };
        },
      );
      const saved = await encounterService.commitCombatParticipantStateMutations({
        campaignId: access.campaignId,
        encounterId,
        expectedEncounterRevision: encounter.updatedAt,
        participants: participantMutations,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: recomputed.roundState,
          currentRound: recomputed.roundState.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return {
        encounter: saved.encounter,
        edge: getCombatRoundDistanceEdge({
          participantAId: body.participantAId,
          participantBId: body.participantBId,
          state: recomputed.roundState,
        }),
        participants: saved.participants,
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to set combat distance.",
      });
    }
  });

  app.post(
    "/encounters/:encounterId/combat-round/roll-combat-experience",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);

        if (!encounter?.scenarioId) {
          return reply.code(404).send({
            error: "Encounter not found.",
          });
        }

        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          {
            campaignService,
            scenarioService,
          },
          {
            scenarioId,
            userId: user.id,
            userRoles: user.roles,
          },
        );

        if (!access) {
          return reply.code(404).send({
            error: "Encounter not found.",
          });
        }

        const body = parseCombatExperienceBody(request.body);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const participantResolution = resolveCombatParticipantForRequest({
          accessMode: access.mode,
          encounter,
          requestedParticipantId: body.scenarioParticipantId,
          scenarioParticipants,
          userId: user.id,
        });
        const scenarioParticipant = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;

        if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
          return reply.code(403).send({
            error: "Participant is not assigned to this encounter.",
          });
        }

        const gmAuthorizedOperation = access.mode === "gm";
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });

        if (!gmAuthorizedOperation) {
          if (
            scenarioParticipant.controlledByUserId !== user.id ||
            !isUserAssignedToEncounterMembership({
              encounter,
              scenarioParticipants,
              userId: user.id,
            })
          ) {
            return reply.code(403).send({
              error: "Player is not assigned to this encounter participant.",
            });
          }
        }

        const combatExperienceTrigger = getCombatRoundRequiredCombatExperienceTrigger({
          participantId: encounterParticipant.id,
          state: roundState,
          visibility: encounter.roleplayState?.visibility,
        });

        if (!combatExperienceTrigger) {
          return reply.code(409).send({
            error: "Combat Experience already rolled or is not required for this participant.",
          });
        }
        const combatExperiencePhase =
          combatExperienceTrigger === "phase1_attack"
            ? "phase1"
            : combatExperienceTrigger === "phase2_attack"
              ? "phase2"
              : undefined;
        if (body.phase !== combatExperiencePhase) {
          return reply.code(409).send({
            error: "Combat Experience phase does not match the projected task.",
          });
        }
        if (combatExperiencePhase && !body.opportunityId) {
          return reply.code(409).send({
            error: "Combat Experience attack opportunity does not match the projected task.",
          });
        }

        if (
          combatExperienceTrigger === "combat_start" &&
          !isCombatRoundCombatExperienceWindowOpen(roundState)
        ) {
          return reply.code(409).send({
            error: "Combat Experience rolls are not open. Set Combat Experience difficulty first.",
          });
        }

        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: gmAuthorizedOperation
              ? { kind: "gm" }
              : { kind: "combatant", participantId: encounterParticipant.id },
            commandType: combatExperiencePhase
              ? "submit_phase_initiative_choice"
              : "roll_combat_experience",
            opportunityId: body.opportunityId,
            participantId: encounterParticipant.id,
            phase: combatExperiencePhase,
          },
          encounterRevision: encounter.updatedAt,
          identity: body,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }

        const submittedAt = new Date().toISOString();
        const combatExperienceSkillLookup =
          await getCombatExperienceSkillLookupForScenarioParticipant(scenarioParticipant);
        const rolled = rollCombatRoundCombatExperience({
          combatContext: scenarioParticipant.state.combat.combatContext,
          combatEffects: scenarioParticipant.state.combatEffects,
          command: {
            createdAt: submittedAt,
            createdByUserId: user.id,
          },
          createdRevision: encounter.updatedAt,
          encounterId: encounter.id,
          opportunityId: body.opportunityId,
          participantId: encounterParticipant.id,
          scenarioId,
          scenarioParticipantId: scenarioParticipant.id,
          skillTotal: combatExperienceSkillLookup.skillTotal,
          skillTotalSource: combatExperienceSkillLookup.source,
          skillTotalWarning: combatExperienceSkillLookup.warning,
          state: roundState,
          trigger: combatExperienceTrigger,
          visibility: encounter.roleplayState?.visibility,
        });
        const saved = await encounterService.commitCombatParticipantStateMutation({
          campaignId: access.campaignId,
          encounterId,
          expectedEncounterRevision: encounter.updatedAt,
          participant: scenarioParticipant,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: rolled.state,
            currentRound: rolled.state.roundNumber,
            updatedAt: submittedAt,
          },
          state: {
            ...scenarioParticipant.state,
            combat: {
              ...scenarioParticipant.state.combat,
              combatContext: rolled.combatContext,
            },
            combatEffects: rolled.combatEffects,
          },
        });

        return {
          combatExperience: rolled.result,
          encounter: gmAuthorizedOperation
            ? saved.encounter
            : buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: saved.encounter,
                scenarioParticipants,
                userId: user.id,
              }),
          participant: saved.participant,
        };
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to roll Combat Experience.",
        });
      }
    },
  );

  app.post(
    "/encounters/:encounterId/combat-round/roll-continued-contact-maintenance",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) {
          return reply.code(404).send({ error: "Encounter not found." });
        }
        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access) return reply.code(404).send({ error: "Encounter not found." });

        const body = parseContinuedContactMaintenanceRollBody(request.body);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const participantResolution = resolveCombatParticipantForRequest({
          accessMode: access.mode,
          encounter,
          requestedParticipantId: body.scenarioParticipantId,
          scenarioParticipants,
          userId: user.id,
        });
        const roller = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;
        if (!roller || !roller.isActive || !encounterParticipant) {
          return reply.code(403).send({
            error: "Participant is not assigned to this encounter.",
          });
        }
        const gmAuthorizedOperation = access.mode === "gm";
        if (
          !gmAuthorizedOperation &&
          (roller.controlledByUserId !== user.id ||
            !isUserAssignedToEncounterMembership({
              encounter,
              scenarioParticipants,
              userId: user.id,
            }))
        ) {
          return reply.code(403).send({
            error: "Player is not assigned to this encounter participant.",
          });
        }

        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const contest = roundState.roundEndReview?.continuedContactMaintenanceContests.find(
          (entry) => entry.id === body.contestId,
        );
        if (!contest || contest.continuedContactId !== body.continuedContactId) {
          return reply.code(404).send({ error: "Continued Contact maintenance not found." });
        }
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: gmAuthorizedOperation
              ? { kind: "gm" }
              : { kind: "combatant", participantId: encounterParticipant.id },
            commandType: "roll_continued_contact_maintenance",
            contestId: body.contestId,
            continuedContactId: body.continuedContactId,
            opponentParticipantId: body.opponentParticipantId,
            participantId: encounterParticipant.id,
            processId: body.processId,
            rollPurpose: body.rollPurpose,
            stageId: body.stageId,
          },
          encounterRevision: encounter.updatedAt,
          identity: body,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }

        const opponentEncounterParticipant = resolveEncounterParticipantMembership({
          encounter,
          scenarioParticipants,
        }).participants.find((participant) => participant.id === body.opponentParticipantId);
        const opponentScenarioParticipant = opponentEncounterParticipant?.scenarioParticipantId
          ? scenarioParticipants.find(
              (participant) =>
                participant.id === opponentEncounterParticipant.scenarioParticipantId,
            )
          : undefined;
        const modifierProjection = buildLiveCombatModifierContributionProjection({
          combatContext: roller.state.combat.combatContext,
          combatEffects: roller.state.combatEffects,
          currentRound: roundState.roundNumber,
          encounterId,
          ownerParticipantId: roller.id,
        });
        const openEndedRoll = rollOpenEndedD20();
        const calculation = resolveOffensiveParryBrawlingSkillContestCalculation({
          calculationId: `${contest.id}:roll:${encounterParticipant.id}:calculation`,
          encounterId,
          modifierContributions: modifierProjection.contributions,
          opponentCombatantId: body.opponentParticipantId,
          opponentScenarioParticipantId: opponentScenarioParticipant?.id,
          participant: roller,
          participantCombatantId: encounterParticipant.id,
          purpose: "continued_contact_maintenance",
          roll: openEndedRoll,
          roundState,
          side:
            encounterParticipant.id === contest.controllerParticipantId
              ? "controller"
              : "responder",
        });
        const createdAt = new Date().toISOString();
        const roll = {
          brawlingBaseValue: calculation.baseSkill,
          brawlingSkillXp: calculation.skill.totalXp,
          characteristicAverage: calculation.governingStat.value,
          effectiveSkillValue: calculation.preDieTotal,
          finalTotal: calculation.finalResult,
          generalModifier: calculation.percentageContributions
            .filter((contribution) => contribution.category === "general_fatigue")
            .reduce((total, contribution) => total + contribution.value, 0),
          id: `${contest.id}:roll:${encounterParticipant.id}`,
          openEndedD10s: openEndedRoll.openEndedD10s,
          participantId: encounterParticipant.id,
          parryQualityModifier: 0,
          percentageAdjustment: calculation.derivedIntegerAdjustment,
          percentageModifierTotal: calculation.totalPercentageAdjustment,
          pendingModifiers: modifierProjection.pendingModifierEntries.map((entry) => ({
            activationLabel: "Effective from later combat work",
            label: entry.notes?.trim() || "Combat effect",
            value: entry.value,
          })),
          rollD20: openEndedRoll.rollD20,
          rollPurpose: "escape_continued_contact" as const,
          rollTotal: openEndedRoll.dieResult,
          rolledAt: createdAt,
          rolledByUserId: user.id,
          skillId: "brawling" as const,
          skillLabel: "Brawling" as const,
          skillModifier: 0,
          skillContestCalculation: calculation,
        };
        const rolled = recordContinuedContactMaintenanceRoll({
          command: {
            createdAt,
            createdByUserId: user.id,
            createdRevision: encounter.updatedAt,
          },
          contestId: body.contestId,
          executionGroupId: body.executionGroupId,
          opponentParticipantId: body.opponentParticipantId,
          participantId: encounterParticipant.id,
          participantInputs: buildRoundEndDistanceControlInputs({
            encounter,
            roundState,
            scenarioParticipants,
          }),
          roll,
          skillContestCalculation: calculation,
          state: roundState,
        });

        const endedCondition = roundState.unbalancedConditions.find((condition) => {
          const next = rolled.state.unbalancedConditions.find((entry) => entry.id === condition.id);
          return condition.status === "active" && next?.status === "ended";
        });
        let responseScenarioParticipants = scenarioParticipants;
        let updatedParticipant: ScenarioParticipant | undefined;
        let stateToSave = rolled.state;
        if (endedCondition) {
          const affectedEncounterParticipant = resolveEncounterParticipantMembership({
            encounter,
            scenarioParticipants,
          }).participants.find(
            (participant) => participant.id === endedCondition.affectedParticipantId,
          );
          const affected = affectedEncounterParticipant?.scenarioParticipantId
            ? scenarioParticipants.find(
                (participant) =>
                  participant.id === affectedEncounterParticipant.scenarioParticipantId,
              )
            : undefined;
          if (!affected) {
            throw new RangeError("The Unbalanced participant is not assigned to this encounter.");
          }
          const effects = combatEffectsStateSchema.parse(affected.state.combatEffects);
          if (
            !effects.effects.some(
              (effect) =>
                effect.id === endedCondition.id &&
                (effect.status === "active" || effect.status === "pending"),
            )
          ) {
            throw new RangeError(
              "The active Continued Contact relationship has no matching Unbalanced effect.",
            );
          }
          const transitionSequence = Math.max(
            0,
            rolled.state.events.reduce((highest, event) => Math.max(highest, event.sequence), -1),
          );
          const previousEffect = effects.effects.find((effect) => effect.id === endedCondition.id)!;
          const nextEffect = (() => {
            const effect = previousEffect;
            const activated =
              effect.canonicalLifecycle?.lifecycle.state === "pending_activation"
                ? transitionCanonicalCombatModifierEffect({
                    acceptedRevision: encounter.updatedAt,
                    acceptedSequence: transitionSequence,
                    commandId: rolled.command.id,
                    effect: effect.canonicalLifecycle,
                    nextState: "active",
                    reason: "activation_cutoff_reached",
                    transitionId: `${rolled.command.id}:activate:${effect.id}`,
                    transitionType: "activate",
                  })
                : undefined;
            const canonicalBeforeResolution = activated?.effect ?? effect.canonicalLifecycle;
            const transitioned = canonicalBeforeResolution
              ? transitionCanonicalCombatModifierEffect({
                  acceptedRevision: encounter.updatedAt,
                  acceptedSequence: transitionSequence,
                  commandId: rolled.command.id,
                  effect: canonicalBeforeResolution,
                  nextState: "resolved",
                  reason: "condition_cleared",
                  transitionId: `${rolled.command.id}:resolve:${effect.id}`,
                  transitionType: "resolve",
                })
              : undefined;
            return combatEffectSchema.parse({
              ...effect,
              canonicalLifecycle: transitioned?.effect ?? effect.canonicalLifecycle,
              canonicalTransitions: transitioned
                ? [
                    ...(effect.canonicalTransitions ?? []),
                    ...(activated ? [activated.transition] : []),
                    transitioned.transition,
                  ]
                : effect.canonicalTransitions,
              status: "expired",
              updatedAt: createdAt,
            });
          })();
          stateToSave = attachContinuedContactEffectTransitionFacts({
            commandId: rolled.command.id,
            nextEffect,
            previousEffect,
            scenarioParticipantId: affected.id,
            state: rolled.state,
          });
          const saved = await encounterService.commitCombatParticipantStateMutation({
            campaignId: access.campaignId,
            encounterId,
            expectedEncounterRevision: encounter.updatedAt,
            participant: affected,
            scenarioId,
            session: {
              ...encounter,
              combatRoundState: stateToSave,
              currentRound: stateToSave.roundNumber,
              updatedAt: createdAt,
            },
            state: {
              ...affected.state,
              combatEffects: combatEffectsStateSchema.parse({
                ...effects,
                effects: effects.effects.map((effect) =>
                  effect.id === endedCondition.id ? nextEffect : effect,
                ),
              }),
            },
          });
          updatedParticipant = saved.participant;
          responseScenarioParticipants = scenarioParticipants.map((participant) =>
            participant.id === saved.participant.id ? saved.participant : participant,
          );
          return {
            command: gmAuthorizedOperation
              ? stateToSave.commands.find((command) => command.id === rolled.command.id)!
              : buildPlayerSafeCombatRoundCommandForUser({
                  command: stateToSave.commands.find(
                    (command) => command.id === rolled.command.id,
                  )!,
                  ...buildPlayerSafeCombatScopeForUser({
                    encounter: saved.encounter,
                    scenarioParticipants: responseScenarioParticipants,
                    userId: user.id,
                  }),
                }),
            commandEnvelope: buildCombatRoundCommandEnvelope({ state: stateToSave }),
            encounter: gmAuthorizedOperation
              ? saved.encounter
              : buildPlayerSafeCombatRollMutationEncounterForUser({
                  encounter: saved.encounter,
                  scenarioParticipants: responseScenarioParticipants,
                  userId: user.id,
                }),
            participant: updatedParticipant,
            roll,
          };
        }

        const savedEncounter = await encounterService.updateCombatEncounter({
          expectedRevision: encounter.updatedAt,
          campaignId: access.campaignId,
          encounterId,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: stateToSave,
            currentRound: stateToSave.roundNumber,
            updatedAt: createdAt,
          },
        });
        return {
          command: gmAuthorizedOperation
            ? rolled.command
            : buildPlayerSafeCombatRoundCommandForUser({
                command: rolled.command,
                ...buildPlayerSafeCombatScopeForUser({
                  encounter: savedEncounter,
                  scenarioParticipants: responseScenarioParticipants,
                  userId: user.id,
                }),
              }),
          commandEnvelope: buildCombatRoundCommandEnvelope({ state: stateToSave }),
          encounter: gmAuthorizedOperation
            ? savedEncounter
            : buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants: responseScenarioParticipants,
                userId: user.id,
              }),
          participant: updatedParticipant,
          roll,
        };
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error
              ? error.message
              : "Unable to roll Continued Contact maintenance.",
        });
      }
    },
  );

  app.post("/encounters/:encounterId/combat-round/roll-observation", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId) {
        return reply.code(404).send({ error: "Encounter not found." });
      }
      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access) return reply.code(404).send({ error: "Encounter not found." });

      const body = parseCombatObservationRollBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: body.scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const observer = participantResolution?.scenarioParticipant;
      const observerEncounterParticipant = participantResolution?.encounterParticipant;
      if (!observer || !observer.isActive || !observerEncounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }
      const gmAuthorizedOperation = access.mode === "gm";
      if (
        !gmAuthorizedOperation &&
        (observer.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }))
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter participant.",
        });
      }

      const targetEncounterParticipant = encounter.participants.find(
        (participant) => participant.id === body.opponentParticipantId,
      );
      const target = findScenarioParticipantForEncounterParticipant({
        encounterParticipant: targetEncounterParticipant,
        scenarioParticipants,
      });
      if (!target || !target.isActive) {
        return reply.code(409).send({
          error: "The observed opponent is no longer available.",
        });
      }
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor: gmAuthorizedOperation
            ? { kind: "gm" }
            : { kind: "combatant", participantId: observerEncounterParticipant.id },
          commandType: "roll_observation",
          observationAttemptId: body.observationAttemptId,
          opponentParticipantId: body.opponentParticipantId,
          participantId: observerEncounterParticipant.id,
          processId: body.processId,
          relationshipId: body.relationshipId,
          stageId: body.stageId,
        },
        encounterRevision: encounter.updatedAt,
        identity: body,
        roundState,
      });
      if (!authorization.ok) {
        return reply.code(409).send({ code: authorization.code, error: authorization.message });
      }

      const observationContext = resolveApiCombatObservationRollContext({
        encounter,
        observerParticipantId: observerEncounterParticipant.id,
        observationAttemptId: body.observationAttemptId,
        relationshipId: body.relationshipId,
        scenarioParticipants,
        state: roundState,
        targetParticipantId: body.opponentParticipantId,
      });
      if (observationContext.kind === "stopped") {
        return reply.code(409).send({
          error:
            observationContext.reason === "target_invalid"
              ? "The observed opponent is no longer available."
              : "Observe Opponent requires exact canonical relationship and skill facts.",
        });
      }
      const submittedAt = new Date().toISOString();
      const rolled = recordCombatObservationRoll({
        command: { createdAt: submittedAt, createdByUserId: user.id },
        completedAtRevision: submittedAt,
        executionGroupId: body.executionGroupId,
        observerBasis: observationContext.observerBasis,
        observerParticipantId: observerEncounterParticipant.id,
        observationAttemptId: body.observationAttemptId,
        relationshipId: body.relationshipId,
        state: roundState,
        targetBasis: observationContext.targetBasis,
        targetParticipantId: body.opponentParticipantId,
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: rolled.state,
          currentRound: rolled.state.roundNumber,
          updatedAt: submittedAt,
        },
      });
      const responseEncounter = gmAuthorizedOperation
        ? savedEncounter
        : buildPlayerSafeCombatRollMutationEncounterForUser({
            encounter: savedEncounter,
            scenarioParticipants,
            userId: user.id,
          });
      const safeAttempt = gmAuthorizedOperation
        ? rolled.attempt
        : { ...rolled.attempt, targetRoll: undefined };

      return {
        attempt: safeAttempt,
        command: gmAuthorizedOperation
          ? rolled.command
          : buildPlayerSafeCombatRoundCommandForUser({
              command: rolled.command,
              ...buildPlayerSafeCombatScopeForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              }),
            }),
        commandEnvelope: buildCombatRoundCommandEnvelope({ state: rolled.state }),
        encounter: responseEncounter,
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll Observe Opponent.",
      });
    }
  });

  app.post(
    "/encounters/:encounterId/combat-round/roll-distance-control",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);

        if (!encounter?.scenarioId) {
          return reply.code(404).send({
            error: "Encounter not found.",
          });
        }

        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          {
            campaignService,
            scenarioService,
          },
          {
            scenarioId,
            userId: user.id,
            userRoles: user.roles,
          },
        );

        if (!access) {
          return reply.code(404).send({
            error: "Encounter not found.",
          });
        }

        const body = parseRoundEndDistanceControlRollBody(request.body);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const participantResolution = resolveCombatParticipantForRequest({
          accessMode: access.mode,
          encounter,
          requestedParticipantId: body.scenarioParticipantId,
          scenarioParticipants,
          userId: user.id,
        });
        const scenarioParticipant = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;

        if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
          return reply.code(403).send({
            error: "Participant is not assigned to this encounter.",
          });
        }

        const gmAuthorizedOperation = access.mode === "gm";

        if (
          !gmAuthorizedOperation &&
          (scenarioParticipant.controlledByUserId !== user.id ||
            !isUserAssignedToEncounterMembership({
              encounter,
              scenarioParticipants,
              userId: user.id,
            }))
        ) {
          return reply.code(403).send({
            error: "Player is not assigned to this encounter participant.",
          });
        }

        const submittedAt = new Date().toISOString();
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: gmAuthorizedOperation
              ? { kind: "gm" }
              : { kind: "combatant", participantId: encounterParticipant.id },
            commandType: "roll_round_end_distance_control",
            opponentParticipantId: body.opponentParticipantId,
            pairId: body.pairId,
            participantId: encounterParticipant.id,
            proposalId: body.distanceProposalId,
          },
          encounterRevision: encounter.updatedAt,
          identity: body,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }
        const proposal = roundState.roundEndReview?.proposedDistances.find(
          (candidate) => candidate.id === body.distanceProposalId,
        );
        if (!proposal) {
          return reply.code(409).send({ error: "Distance-control proposal is unavailable." });
        }
        const canonicalOpponentParticipantId =
          proposal.participantAId === encounterParticipant.id
            ? proposal.participantBId
            : proposal.participantBId === encounterParticipant.id
              ? proposal.participantAId
              : undefined;
        if (
          !canonicalOpponentParticipantId ||
          canonicalOpponentParticipantId === encounterParticipant.id ||
          canonicalOpponentParticipantId !== body.opponentParticipantId
        ) {
          return reply.code(409).send({
            error: "Distance-control pair identity changed. Refresh the current task.",
          });
        }
        const membership = resolveEncounterParticipantMembership({
          encounter,
          scenarioParticipants,
        });
        const opponentEncounterParticipant = membership.participants.find(
          (participant) => participant.id === canonicalOpponentParticipantId,
        );
        const opponentScenarioParticipant = opponentEncounterParticipant?.scenarioParticipantId
          ? scenarioParticipants.find(
              (participant) =>
                participant.id === opponentEncounterParticipant.scenarioParticipantId,
            )
          : undefined;
        if (!opponentEncounterParticipant || !opponentScenarioParticipant) {
          return reply.code(409).send({ error: "Distance-control opponent is unavailable." });
        }
        if (opponentScenarioParticipant.id === scenarioParticipant.id) {
          return reply.code(409).send({
            error: "Distance-control pair identity is invalid for this encounter.",
          });
        }
        const distanceInputs = buildRoundEndDistanceControlInputs({
          encounter,
          roundState,
          scenarioParticipants,
        });
        const roll = rollOpenEndedD20();
        const skillContestCalculation = resolveAdjustDistanceSkillContestCalculation({
          calculationId: `${proposal.id}:roll:${encounterParticipant.id}`,
          contestType: "round_end_adjust_distance",
          encounterId,
          modifierContributions: distanceInputs[encounterParticipant.id]?.modifierContributions,
          opponentCombatantId: opponentEncounterParticipant.id,
          opponentLabel: opponentScenarioParticipant.snapshot.displayName,
          opponentScenarioParticipantId: opponentScenarioParticipant.id,
          participant: scenarioParticipant,
          participantCombatantId: encounterParticipant.id,
          proposalId: proposal.id,
          role: getRoundEndAdjustDistanceRole({
            participantId: encounterParticipant.id,
            proposal,
          }),
          roll,
          roundNumber: roundState.roundNumber,
          roundState,
          step: "round_summary",
        });
        const rolled = rollCombatRoundEndDistanceControl({
          command: {
            createdAt: submittedAt,
            createdByUserId: user.id,
          },
          distanceProposalId: body.distanceProposalId,
          participantId: encounterParticipant.id,
          result: buildRoundEndDistanceRollResult({
            calculation: skillContestCalculation,
            createdAt: submittedAt,
            createdByUserId: user.id,
            rolledAtRound: roundState.roundNumber,
            rolledBy: gmAuthorizedOperation ? "gm_proxy" : "player",
          }),
          state: roundState,
        });
        const savedEncounter = await encounterService.updateCombatEncounter({
          expectedRevision: encounter.updatedAt,
          campaignId: access.campaignId,
          encounterId,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: rolled.state,
            currentRound: rolled.state.roundNumber,
            updatedAt: submittedAt,
          },
        });
        const responseEncounter = gmAuthorizedOperation
          ? savedEncounter
          : buildPlayerSafeEncounterForUser({
              encounter: savedEncounter,
              scenarioParticipants,
              userId: user.id,
            });
        const responseCommand = gmAuthorizedOperation
          ? rolled.command
          : buildPlayerSafeCombatRoundCommandForUser({
              command: rolled.command,
              ...buildPlayerSafeCombatScopeForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              }),
            });

        return {
          command: responseCommand,
          encounter: responseEncounter,
          participant: scenarioParticipant,
        };
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error ? error.message : "Unable to roll distance control contest.",
        });
      }
    },
  );

  app.post(
    "/encounters/:encounterId/combat-round/roll-current-distance-control",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);

        if (!encounter?.scenarioId) {
          return reply.code(404).send({ error: "Encounter not found." });
        }

        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId, userId: user.id, userRoles: user.roles },
        );

        if (!access || access.mode !== "gm") {
          return reply.code(403).send({
            error: "Only GM users can proxy the current distance-control roll.",
          });
        }

        const body = parseBodyObject(request.body, "Current distance-control roll payload");
        const identity = parseCombatTaskCommandIdentity(body);
        const participantId = parseNonEmptyString(body.participantId, "participantId");
        const opponentParticipantId = parseNonEmptyString(
          body.opponentParticipantId,
          "opponentParticipantId",
        );
        const pairId = parseNonEmptyString(body.pairId, "pairId");
        const proposalId = parseNonEmptyString(body.proposalId, "proposalId");
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: { kind: "gm" },
            commandType: "roll_round_end_distance_control",
            opponentParticipantId,
            pairId,
            participantId,
            proposalId,
          },
          encounterRevision: encounter.updatedAt,
          identity,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }

        const submittedAt = new Date().toISOString();
        const proposal = roundState.roundEndReview?.proposedDistances.find(
          (candidate) => candidate.id === proposalId,
        );
        const participantResolution = resolveCombatParticipantForRequest({
          accessMode: "gm",
          encounter,
          requestedParticipantId: participantId,
          scenarioParticipants,
          userId: user.id,
        });
        const scenarioParticipant = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;
        const membership = resolveEncounterParticipantMembership({
          encounter,
          scenarioParticipants,
        });
        const opponentEncounterParticipant = membership.participants.find(
          (participant) => participant.id === opponentParticipantId,
        );
        const opponentScenarioParticipant = opponentEncounterParticipant?.scenarioParticipantId
          ? scenarioParticipants.find(
              (participant) =>
                participant.id === opponentEncounterParticipant.scenarioParticipantId,
            )
          : undefined;
        if (
          !proposal ||
          !scenarioParticipant ||
          !encounterParticipant ||
          !opponentEncounterParticipant ||
          !opponentScenarioParticipant
        ) {
          return reply.code(409).send({ error: "Distance-control calculation is unavailable." });
        }
        const distanceInputs = buildRoundEndDistanceControlInputs({
          encounter,
          roundState,
          scenarioParticipants,
        });
        const roll = rollOpenEndedD20();
        const skillContestCalculation = resolveAdjustDistanceSkillContestCalculation({
          calculationId: `${proposal.id}:roll:${participantId}`,
          contestType: "round_end_adjust_distance",
          encounterId,
          modifierContributions: distanceInputs[participantId]?.modifierContributions,
          opponentCombatantId: opponentEncounterParticipant.id,
          opponentLabel: opponentScenarioParticipant.snapshot.displayName,
          opponentScenarioParticipantId: opponentScenarioParticipant.id,
          participant: scenarioParticipant,
          participantCombatantId: encounterParticipant.id,
          proposalId: proposal.id,
          role: getRoundEndAdjustDistanceRole({ participantId, proposal }),
          roll,
          roundNumber: roundState.roundNumber,
          roundState,
          step: "round_summary",
        });
        const rolled = rollCombatRoundEndDistanceControl({
          command: {
            createdAt: submittedAt,
            createdByUserId: user.id,
          },
          distanceProposalId: proposalId,
          participantId,
          result: buildRoundEndDistanceRollResult({
            calculation: skillContestCalculation,
            createdAt: submittedAt,
            createdByUserId: user.id,
            rolledAtRound: roundState.roundNumber,
            rolledBy: "gm_proxy",
          }),
          state: roundState,
        });
        const savedEncounter = await encounterService.updateCombatEncounter({
          expectedRevision: encounter.updatedAt,
          campaignId: access.campaignId,
          encounterId,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: rolled.state,
            currentRound: rolled.state.roundNumber,
            updatedAt: submittedAt,
          },
        });
        const commandEnvelope = buildCombatRoundCommandEnvelope({ state: rolled.state });

        return { commandEnvelope, encounter: savedEncounter };
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error
              ? error.message
              : "Unable to roll current distance control contest.",
        });
      }
    },
  );

  app.post(
    "/encounters/:encounterId/combat-round/commit-distance-control",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access) {
          return reply.code(404).send({ error: "Encounter not found." });
        }
        const body = parseRoundEndDistanceControlCommitBody(request.body);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const participantResolution = body.scenarioParticipantId
          ? resolveCombatParticipantForRequest({
              accessMode: access.mode,
              encounter,
              requestedParticipantId: body.scenarioParticipantId,
              scenarioParticipants,
              userId: user.id,
            })
          : undefined;
        const scenarioParticipant = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;
        const gmAuthorizedOperation = access.mode === "gm";
        if (!gmAuthorizedOperation && (!scenarioParticipant || !encounterParticipant)) {
          return reply.code(403).send({ error: "Participant is not assigned to this encounter." });
        }
        if (
          !gmAuthorizedOperation &&
          (scenarioParticipant?.controlledByUserId !== user.id ||
            !isUserAssignedToEncounterMembership({
              encounter,
              scenarioParticipants,
              userId: user.id,
            }))
        ) {
          return reply.code(403).send({
            error: "Player is not assigned to this encounter participant.",
          });
        }
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: gmAuthorizedOperation
              ? { kind: "gm" }
              : { kind: "combatant", participantId: encounterParticipant!.id },
            commandType: "commit_round_end_distance_control",
            pairId: body.pairId,
            participantId: encounterParticipant?.id,
            proposalId: body.distanceProposalId,
          },
          encounterRevision: encounter.updatedAt,
          identity: body,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }
        const submittedAt = new Date().toISOString();
        const committed = commitCombatRoundEndDistanceControl({
          chosenDistance: body.chosenDistance,
          command: { createdAt: submittedAt, createdByUserId: user.id },
          distanceOverride: body.distanceOverride,
          distanceProposalId: body.distanceProposalId,
          participantId: encounterParticipant?.id,
          state: roundState,
        });
        const savedEncounter = await encounterService.updateCombatEncounter({
          expectedRevision: encounter.updatedAt,
          campaignId: access.campaignId,
          encounterId,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: committed.state,
            currentRound: committed.state.roundNumber,
            updatedAt: submittedAt,
          },
        });
        if (gmAuthorizedOperation) {
          return {
            commandEnvelope: buildCombatRoundCommandEnvelope({ state: committed.state }),
            encounter: savedEncounter,
          };
        }
        return {
          command: buildPlayerSafeCombatRoundCommandForUser({
            command: committed.command,
            ...buildPlayerSafeCombatScopeForUser({
              encounter: savedEncounter,
              scenarioParticipants,
              userId: user.id,
            }),
          }),
          encounter: buildPlayerSafeEncounterForUser({
            encounter: savedEncounter,
            scenarioParticipants,
            userId: user.id,
          }),
          participant: scenarioParticipant,
        };
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to commit distance control.",
        });
      }
    },
  );

  app.post(
    "/encounters/:encounterId/combat-round/commit-participant-review",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;
      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) return reply.code(404).send({ error: "Encounter not found." });
        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access || access.mode !== "gm") {
          return reply.code(403).send({ error: "Only GM users can commit participant review." });
        }
        const bodyValue = parseBodyObject(request.body, "Round-end participant review payload");
        const body = {
          ...parseParticipantCommandBody(bodyValue, "Round-end participant review payload"),
          ...parseCombatTaskCommandIdentity(bodyValue),
        };
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const participantResolution = resolveCombatParticipantForRequest({
          accessMode: access.mode,
          encounter,
          requestedParticipantId: body.scenarioParticipantId,
          scenarioParticipants,
          userId: user.id,
        });
        const scenarioParticipant = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;
        if (!scenarioParticipant || !encounterParticipant) {
          return reply.code(403).send({ error: "Participant is not assigned to this encounter." });
        }
        if (
          !body.expectedParticipantRevision ||
          body.expectedParticipantRevision !== scenarioParticipant.updatedAt
        ) {
          return reply.code(409).send({
            code: "stale_revision",
            error: "Participant effect state changed while the SU review was open.",
          });
        }
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: { kind: "gm" },
            commandType: "commit_round_end_participant_review",
            participantId: encounterParticipant.id,
          },
          encounterRevision: encounter.updatedAt,
          identity: body,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }
        const submittedAt = new Date().toISOString();
        const committed = commitCombatRoundEndParticipantReview({
          combatEffects: scenarioParticipant.state.combatEffects,
          createdRevision: encounter.updatedAt,
          command: { createdAt: submittedAt, createdByUserId: user.id },
          encounterId,
          participantId: encounterParticipant.id,
          scenarioId,
          scenarioParticipantId: scenarioParticipant.id,
          state: roundState,
        });
        const saved = await encounterService.commitCombatParticipantStateMutation({
          campaignId: access.campaignId,
          encounterId,
          expectedEncounterRevision: encounter.updatedAt,
          participant: scenarioParticipant,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: committed.state,
            currentRound: committed.state.roundNumber,
            updatedAt: submittedAt,
          },
          state: { ...scenarioParticipant.state, combatEffects: committed.combatEffects },
        });
        return {
          commandEnvelope: buildCombatRoundCommandEnvelope({ state: committed.state }),
          encounter: saved.encounter,
          participant: saved.participant,
        };
      } catch (error) {
        const persistenceErrorResponse = sendCombatWriteError(reply, error);
        if (persistenceErrorResponse !== undefined) return persistenceErrorResponse;
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to commit participant review.",
        });
      }
    },
  );

  app.post("/encounters/:encounterId/combat-round/roll-health-check", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseRoundEndHealthCheckRollBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: body.scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      const gmAuthorizedOperation = access.mode === "gm";

      if (
        !gmAuthorizedOperation &&
        (scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }))
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter participant.",
        });
      }

      if (body.expectedParticipantRevision !== scenarioParticipant.updatedAt) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Participant effect state changed while the SU review was open.",
        });
      }

      const submittedAt = new Date().toISOString();
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const authorization = authorizeCombatTaskCommand({
        authorization: {
          actor: gmAuthorizedOperation
            ? { kind: "gm" }
            : { kind: "combatant", participantId: encounterParticipant.id },
          commandType: "roll_round_end_health_check",
          healthRollId: body.healthRollId,
          participantId: encounterParticipant.id,
          proposalId: body.healthRollId,
        },
        encounterRevision: encounter.updatedAt,
        identity: body,
        roundState,
      });
      if (!authorization.ok) {
        return reply.code(409).send({ code: authorization.code, error: authorization.message });
      }
      const rolled = rollCombatRoundEndHealthCheck({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        combatEffects: scenarioParticipant.state.combatEffects,
        createdRevision: encounter.updatedAt,
        healthRollId: body.healthRollId,
        participantId: encounterParticipant.id,
        rolledBy: gmAuthorizedOperation ? "gm_proxy" : "player",
        state: roundState,
      });
      const saved = await encounterService.commitCombatParticipantStateMutation({
        campaignId: access.campaignId,
        encounterId,
        expectedEncounterRevision: encounter.updatedAt,
        participant: scenarioParticipant,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: rolled.state,
          currentRound: rolled.state.roundNumber,
          updatedAt: submittedAt,
        },
        state: {
          ...scenarioParticipant.state,
          combatEffects: rolled.combatEffects,
        },
      });

      return {
        command: rolled.command,
        encounter: gmAuthorizedOperation
          ? saved.encounter
          : buildPlayerSafeCombatRollMutationEncounterForUser({
              encounter: saved.encounter,
              scenarioParticipants,
              userId: user.id,
            }),
        participant: saved.participant,
      };
    } catch (error) {
      const persistenceErrorResponse = sendCombatWriteError(reply, error);
      if (persistenceErrorResponse !== undefined) return persistenceErrorResponse;
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll round-end health check.",
      });
    }
  });

  app.post(
    "/encounters/:encounterId/combat-round/back-out-phase-attack",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);

        if (!encounter?.scenarioId) {
          return reply.code(404).send({
            error: "Encounter not found.",
          });
        }

        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          {
            campaignService,
            scenarioService,
          },
          {
            scenarioId,
            userId: user.id,
            userRoles: user.roles,
          },
        );

        if (!access) {
          return reply.code(404).send({
            error: "Encounter not found.",
          });
        }

        const body = parsePhaseAttackBackOutBody(request.body);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const participantResolution = resolveCombatParticipantForRequest({
          accessMode: access.mode,
          encounter,
          requestedParticipantId: body.scenarioParticipantId,
          scenarioParticipants,
          userId: user.id,
        });
        const scenarioParticipant = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;

        if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
          return reply.code(403).send({
            error: "Participant is not assigned to this encounter.",
          });
        }

        if (
          access.mode !== "gm" &&
          (scenarioParticipant.controlledByUserId !== user.id ||
            !isUserAssignedToEncounterMembership({
              encounter,
              scenarioParticipants,
              userId: user.id,
            }))
        ) {
          return reply.code(403).send({
            error: "Player is not assigned to this encounter participant.",
          });
        }

        const submittedAt = new Date().toISOString();
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor:
              access.mode === "gm"
                ? { kind: "gm" }
                : { kind: "combatant", participantId: encounterParticipant.id },
            commandType: "submit_phase_initiative_choice",
            participantId: encounterParticipant.id,
            phase: body.phase,
          },
          encounterRevision: encounter.updatedAt,
          identity: body,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }
        const backedOut = backOutCombatRoundPhaseAttack({
          combatContext: scenarioParticipant.state.combat.combatContext,
          command: {
            createdAt: submittedAt,
            createdByUserId: user.id,
          },
          participantId: encounterParticipant.id,
          phase: body.phase,
          state: roundState,
          updatedAt: submittedAt,
          visibility: encounter.roleplayState?.visibility,
        });
        const saved = await encounterService.commitCombatParticipantStateMutation({
          campaignId: access.campaignId,
          encounterId,
          expectedEncounterRevision: encounter.updatedAt,
          participant: scenarioParticipant,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: backedOut.state,
            currentRound: backedOut.state.roundNumber,
            updatedAt: submittedAt,
          },
          state: {
            ...scenarioParticipant.state,
            combat: {
              ...scenarioParticipant.state.combat,
              combatContext: backedOut.combatContext,
            },
          },
        });

        return {
          command: backedOut.command,
          encounter: saved.encounter,
          participant: saved.participant,
        };
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to back out of phase attack.",
        });
      }
    },
  );

  app.post(
    "/encounters/:encounterId/combat-round/continue-phase-attack",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);

        if (!encounter?.scenarioId) {
          return reply.code(404).send({
            error: "Encounter not found.",
          });
        }

        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          {
            campaignService,
            scenarioService,
          },
          {
            scenarioId,
            userId: user.id,
            userRoles: user.roles,
          },
        );

        if (!access) {
          return reply.code(404).send({
            error: "Encounter not found.",
          });
        }

        const body = parsePhaseAttackBackOutBody(request.body);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const participantResolution = resolveCombatParticipantForRequest({
          accessMode: access.mode,
          encounter,
          requestedParticipantId: body.scenarioParticipantId,
          scenarioParticipants,
          userId: user.id,
        });
        const scenarioParticipant = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;

        if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
          return reply.code(403).send({
            error: "Participant is not assigned to this encounter.",
          });
        }

        if (
          access.mode !== "gm" &&
          (scenarioParticipant.controlledByUserId !== user.id ||
            !isUserAssignedToEncounterMembership({
              encounter,
              scenarioParticipants,
              userId: user.id,
            }))
        ) {
          return reply.code(403).send({
            error: "Player is not assigned to this encounter participant.",
          });
        }

        const submittedAt = new Date().toISOString();
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor:
              access.mode === "gm"
                ? { kind: "gm" }
                : { kind: "combatant", participantId: encounterParticipant.id },
            commandType: "submit_phase_initiative_choice",
            participantId: encounterParticipant.id,
            phase: body.phase,
          },
          encounterRevision: encounter.updatedAt,
          identity: body,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }
        const continued = continueCombatRoundPhaseAttack({
          command: {
            createdAt: submittedAt,
            createdByUserId: user.id,
          },
          participantId: encounterParticipant.id,
          phase: body.phase,
          state: roundState,
          visibility: encounter.roleplayState?.visibility,
        });
        const savedEncounter = await encounterService.updateCombatEncounter({
          expectedRevision: encounter.updatedAt,
          campaignId: access.campaignId,
          encounterId,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: continued.state,
            currentRound: continued.state.roundNumber,
            updatedAt: submittedAt,
          },
        });

        return {
          command: continued.command,
          encounter: savedEncounter,
          participant: scenarioParticipant,
        };
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to continue phase attack.",
        });
      }
    },
  );

  app.post(
    "/encounters/:encounterId/combat-round/prepare-round-end-review",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) return;

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) {
          return reply.code(404).send({ error: "Encounter not found." });
        }

        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access || access.mode !== "gm") {
          return reply.code(403).send({
            error: "Only GM users can prepare combat round-end review.",
          });
        }

        const identity = parseCombatTaskCommandIdentity(
          parseBodyObject(request.body, "Round-end preparation payload"),
        );
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor: { kind: "gm" },
            commandType: "prepare_round_end_review",
          },
          encounterRevision: encounter.updatedAt,
          identity,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }
        const submittedAt = new Date().toISOString();
        const nextRoundState = ensureCombatRoundEndReviewPrepared({
          command: { createdAt: submittedAt, createdByUserId: user.id },
          participantInputs: buildRoundEndParticipantInputs({
            encounter,
            roundState,
            scenarioParticipants,
          }),
          state: roundState,
        });
        const savedEncounter = await encounterService.updateCombatEncounter({
          expectedRevision: encounter.updatedAt,
          campaignId: access.campaignId,
          encounterId,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: nextRoundState,
            currentRound: nextRoundState.roundNumber,
            updatedAt: submittedAt,
          },
        });

        return { encounter: savedEncounter };
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to prepare round-end review.",
        });
      }
    },
  );

  app.post(
    "/encounters/:encounterId/combat-round/advance-deterministic",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        let workingEncounter = await encounterService.getEncounterById(encounterId);
        if (!workingEncounter?.scenarioId) {
          return reply.code(404).send({ error: "Encounter not found." });
        }
        const scenarioId = workingEncounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access || access.mode !== "gm") {
          return reply.code(403).send({
            code: "unauthorized_actor",
            error: "Only GM users can advance deterministic combat work.",
          });
        }
        const body = parseBodyObject(request.body, "Deterministic combat advancement payload");
        const expectedRevision = parseNonEmptyString(body.expectedRevision, "expectedRevision");
        const expectedTaskId = parseNonEmptyString(body.taskId, "taskId");
        const expectedExecutionGroupId = parseNonEmptyString(
          body.executionGroupId,
          "executionGroupId",
        );
        if (workingEncounter.updatedAt !== expectedRevision) {
          const commandId = `combat-deterministic-v1:${expectedRevision}:${expectedTaskId}:${expectedExecutionGroupId}`;
          if (hasAcceptedDeterministicCommand({ commandId, encounter: workingEncounter })) {
            const participants = await scenarioService.listScenarioParticipants(scenarioId);
            return {
              commandEnvelope: buildCombatRoundCommandEnvelope({
                state: initializeMaterializedCombatRoundState({
                  encounter: workingEncounter,
                  scenarioParticipants: participants,
                }),
              }),
              encounter: workingEncounter,
              executedTaskIds: [],
              participants,
              stopReason: "already_accepted",
            };
          }
          return reply.code(409).send({
            code: "stale_revision",
            error: "Combat state changed before deterministic work could advance.",
          });
        }

        let workingParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const project = () => {
          const state = initializeMaterializedCombatRoundState({
            encounter: workingEncounter!,
            scenarioParticipants: workingParticipants,
          });
          const participation = projectActiveCombatParticipation({
            encounterRevision: workingEncounter!.updatedAt,
            scenarioParticipants: workingParticipants,
            state,
          });
          return {
            participation,
            progression: buildCombatProgressionProjection(state, { participation }),
            revision: workingEncounter!.updatedAt,
            state,
          };
        };
        const initial = project();
        const initialTask = getCurrentExecutableCombatTasks(initial.progression)[0];
        if (
          !initialTask ||
          initialTask.id !== expectedTaskId ||
          initialTask.executionGroupId !== expectedExecutionGroupId
        ) {
          return reply.code(409).send({
            actualTask: initialTask
              ? {
                  executionGroupId: initialTask.executionGroupId,
                  kind: initialTask.kind,
                  taskId: initialTask.id,
                }
              : undefined,
            code: "task_mismatch",
            error: "The deterministic combat task changed before it could advance.",
            expectedTask: {
              executionGroupId: expectedExecutionGroupId,
              taskId: expectedTaskId,
            },
            revision: workingEncounter.updatedAt,
          });
        }

        const result = await runCombatDeterministicTransitionSuffix({
          initial,
          project: () => project(),
          execute: async ({ commandId, projection, task }) => {
            const priorRevisionTime = Date.parse(workingEncounter!.updatedAt);
            const submittedAt = new Date(
              Math.max(Date.now(), Number.isFinite(priorRevisionTime) ? priorRevisionTime + 1 : 0),
            ).toISOString();
            const state = projection.state;

            if (task.kind === "round_end_prepare") {
              const nextState = ensureCombatRoundEndReviewPrepared({
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                participantInputs: buildRoundEndParticipantInputs({
                  encounter: workingEncounter!,
                  roundState: state,
                  scenarioParticipants: workingParticipants,
                }),
                state,
              });
              workingEncounter = await encounterService.updateCombatEncounter({
                expectedRevision: workingEncounter!.updatedAt,
                campaignId: access.campaignId,
                encounterId,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
              });
              return { revision: workingEncounter.updatedAt, state: nextState };
            }

            if (task.kind === "effect_review" && task.identity.participantId) {
              const roundParticipant = state.participants.find(
                (participant) => participant.participantId === task.identity.participantId,
              );
              const scenarioParticipant = roundParticipant?.scenarioParticipantId
                ? workingParticipants.find(
                    (participant) => participant.id === roundParticipant.scenarioParticipantId,
                  )
                : undefined;
              if (!roundParticipant || !scenarioParticipant) {
                throw new RangeError("Deterministic participant review owner is unavailable.");
              }
              const committed = commitCombatRoundEndParticipantReview({
                combatEffects: scenarioParticipant.state.combatEffects,
                createdRevision: workingEncounter!.updatedAt,
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                deterministicNoWorkCompletion:
                  task.participation?.reason === "deterministic_boundary",
                encounterId,
                participantId: roundParticipant.participantId,
                scenarioId,
                scenarioParticipantId: scenarioParticipant.id,
                state,
              });
              const saved = await encounterService.commitCombatParticipantStateMutation({
                campaignId: access.campaignId,
                encounterId,
                expectedEncounterRevision: workingEncounter!.updatedAt,
                participant: scenarioParticipant,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: committed.state,
                  currentRound: committed.state.roundNumber,
                  updatedAt: submittedAt,
                },
                state: {
                  ...scenarioParticipant.state,
                  combatEffects: committed.combatEffects,
                },
              });
              workingEncounter = saved.encounter;
              workingParticipants = workingParticipants.map((participant) =>
                participant.id === saved.participant.id ? saved.participant : participant,
              );
              return { revision: workingEncounter.updatedAt, state: committed.state };
            }

            if (task.kind === "modifier_review" && task.owner?.kind === "combatant") {
              const ownerParticipantId = task.owner.participantId;
              const roundParticipant = state.participants.find(
                (participant) => participant.participantId === ownerParticipantId,
              );
              const scenarioParticipant = roundParticipant?.scenarioParticipantId
                ? workingParticipants.find(
                    (participant) => participant.id === roundParticipant.scenarioParticipantId,
                  )
                : undefined;
              const declaration = roundParticipant?.declaration;
              if (!roundParticipant || !scenarioParticipant || !declaration) {
                throw new RangeError("Deterministic modifier review owner is unavailable.");
              }
              const currentContext = scenarioParticipantCombatContextSchema.parse(
                declaration.combatContext ?? scenarioParticipant.state.combat.combatContext,
              );
              const modifierReview = buildCanonicalCombatModifierReviewFromDraft({
                canonicalCutoff:
                  state.events.reduce((maximum, event) => Math.max(maximum, event.sequence), 0) + 1,
                commandId,
                createdAt: submittedAt,
                currentContext,
                draftContext: currentContext,
                encounterId,
                participantState: scenarioParticipant.state,
                phase: task.identity.phase === "phase1" ? "M1" : "M2",
                revision: workingEncounter!.updatedAt,
                roundNumber: state.roundNumber,
                scenarioParticipantId: scenarioParticipant.id,
              });
              const nextParticipantState = applyCanonicalModifierReviewToParticipantState({
                createdAt: submittedAt,
                draftContext: currentContext,
                state: scenarioParticipant.state,
                transaction: modifierReview,
              });
              const reviewedDeclarationState = recordCombatRoundDeclaration({
                declaration: {
                  ...declaration,
                  combatContext: currentContext,
                  submittedAt,
                  submittedByUserId: user.id,
                },
                participantId: roundParticipant.participantId,
                state,
                submittedBy: "gm",
              });
              const nextState = recordCombatRoundParticipantStepReview({
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                modifierReview,
                modifierReviewUndo: {
                  combatContext: scenarioParticipant.state.combat.combatContext,
                  combatEffects: scenarioParticipant.state.combatEffects,
                },
                participantId: roundParticipant.participantId,
                previousDeclaration: declaration,
                state: reviewedDeclarationState,
                step: state.currentStep,
                submittedBy: "gm",
              });
              const saved = await encounterService.commitCombatModifierReview({
                campaignId: access.campaignId,
                encounterId,
                expectedEncounterRevision: workingEncounter!.updatedAt,
                participant: scenarioParticipant,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
                state: nextParticipantState,
              });
              workingEncounter = saved.encounter;
              workingParticipants = workingParticipants.map((participant) =>
                participant.id === saved.participant.id ? saved.participant : participant,
              );
              return { revision: workingEncounter.updatedAt, state: nextState };
            }

            if (task.kind === "commit_initiative" && task.identity.phase) {
              const nonParticipatingParticipantIds = new Set(
                projection.participation.facts.flatMap((fact) =>
                  fact.identity.processFamily === "initiative" &&
                  fact.identity.phase === task.identity.phase &&
                  fact.status === "not_required" &&
                  fact.workClass === "no_work" &&
                  fact.completeness === "complete" &&
                  fact.identity.participantId
                    ? [fact.identity.participantId]
                    : [],
                ),
              );
              const committed = commitCombatRoundPhaseInitiativeResolution({
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                nonParticipatingParticipantIds,
                phase: task.identity.phase,
                state,
                visibility: workingEncounter!.roleplayState?.visibility,
              });
              workingEncounter = await encounterService.updateCombatEncounter({
                expectedRevision: workingEncounter!.updatedAt,
                campaignId: access.campaignId,
                encounterId,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: committed.state,
                  currentRound: committed.state.roundNumber,
                  updatedAt: submittedAt,
                },
              });
              return { revision: workingEncounter.updatedAt, state: committed.state };
            }

            if (task.kind === "gm_advance_boundary" && task.transition) {
              const nextState = advanceCombatProgressionBoundary({
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                expectedBoundary: task.transition.currentBoundary,
                expectedCommandType:
                  task.expectedCommand === "complete_round"
                    ? "complete_round"
                    : "advance_combat_boundary",
                expectedExecutionGroupId: task.executionGroupId,
                expectedTaskId: task.id,
                participation: projection.participation,
                state,
                targetBoundary: task.transition.targetBoundary,
                visibility: workingEncounter!.roleplayState?.visibility,
              });
              if (nextState.roundNumber > state.roundNumber) {
                const participantMutations = workingParticipants.flatMap((participant) => {
                  const currentContext = participant.state.combat.combatContext;
                  const nextContext = expireAdjustDistanceAttackGeneratedModifiersBeforeRound(
                    expireCombatFeintGeneratedModifiersBeforeRound(
                      currentContext,
                      nextState.roundNumber,
                    ),
                    nextState.roundNumber,
                  );
                  if (JSON.stringify(nextContext) === JSON.stringify(currentContext)) {
                    return [];
                  }
                  return [
                    {
                      participant,
                      state: {
                        ...participant.state,
                        combat: { ...participant.state.combat, combatContext: nextContext },
                      },
                    },
                  ];
                });
                if (participantMutations.length > 0) {
                  const saved = await encounterService.commitCombatParticipantStateMutations({
                    campaignId: access.campaignId,
                    encounterId,
                    expectedEncounterRevision: workingEncounter!.updatedAt,
                    participants: participantMutations,
                    scenarioId,
                    session: {
                      ...workingEncounter!,
                      combatRoundState: nextState,
                      currentRound: nextState.roundNumber,
                      updatedAt: submittedAt,
                    },
                  });
                  workingEncounter = saved.encounter;
                  const savedById = new Map(
                    saved.participants.map((participant) => [participant.id, participant]),
                  );
                  workingParticipants = workingParticipants.map(
                    (participant) => savedById.get(participant.id) ?? participant,
                  );
                  return { revision: workingEncounter.updatedAt, state: nextState };
                }
              }
              workingEncounter = await encounterService.updateCombatEncounter({
                expectedRevision: workingEncounter!.updatedAt,
                campaignId: access.campaignId,
                encounterId,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
              });
              return { revision: workingEncounter.updatedAt, state: nextState };
            }

            throw new RangeError(`Unsupported deterministic combat task ${task.kind}.`);
          },
        });

        return {
          commandEnvelope: buildCombatRoundCommandEnvelope({ state: result.final.state }),
          encounter: workingEncounter,
          executedTaskIds: result.executedTaskIds,
          participants: workingParticipants,
          stopReason: result.stopReason,
        };
      } catch (error) {
        const persistenceErrorResponse = sendCombatWriteError(reply, error);
        if (persistenceErrorResponse !== undefined) return persistenceErrorResponse;
        return reply.code(error instanceof RangeError ? 409 : 400).send({
          error:
            error instanceof Error ? error.message : "Unable to advance deterministic combat work.",
        });
      }
    },
  );

  app.post("/encounters/:encounterId/combat-round/run-gm-step-workflow", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      let workingEncounter = await encounterService.getEncounterById(encounterId);
      if (!workingEncounter?.scenarioId) {
        return reply.code(404).send({ error: "Encounter not found." });
      }
      const scenarioId = workingEncounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access || access.mode !== "gm") {
        return reply.code(403).send({
          code: "unauthorized_actor",
          error: "Only the GM can run combat step workflow actions.",
        });
      }
      const start = combatStepAutomationStartRequestSchema.parse(request.body);
      if (start.encounterId !== encounterId) {
        return reply.code(409).send({
          code: "task_changed",
          error: "The combat workflow belongs to another encounter.",
        });
      }
      let workingParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const initial = projectApiCombatStepAutomation({
        encounter: workingEncounter,
        scenarioParticipants: workingParticipants,
      });
      const initialTask = initial.tasks[0];
      const combatExperienceSkillLookups = new Map<
        string,
        ParticipantCombatExperienceSkillTotalLookup
      >();
      if (
        start.operationFamily === "roll_remaining" &&
        initialTask?.kind === "combat_experience" &&
        initialTask.expectedCommand === "roll_combat_experience"
      ) {
        const combatExperienceOwners = initial.tasks.flatMap((task) => {
          if (
            task.kind !== "combat_experience" ||
            task.expectedCommand !== "roll_combat_experience"
          ) {
            return [];
          }
          const owner = getStepAutomationScenarioParticipant({
            scenarioParticipants: workingParticipants,
            state: initial.state,
            task,
          });
          return owner ? [owner.participant] : [];
        });
        await Promise.all(
          combatExperienceOwners.map(async (participant) => {
            combatExperienceSkillLookups.set(
              participant.id,
              await getCombatExperienceSkillLookupForScenarioParticipant(participant),
            );
          }),
        );
      }
      const acceptedLinks = getAcceptedCombatStepAutomationCommands({
        identity: {
          operationFamily: start.operationFamily,
          runId: start.runId,
          startingRevision: start.expectedRevision,
        },
        state: initial.state,
      });
      const startingSequence =
        acceptedLinks[0]?.link.startingSequence ?? getCombatRoundNextEventSequence(initial.state);
      const startProcessFamily =
        acceptedLinks[0]?.link.startProcessFamily ??
        (initialTask?.kind === "health_review"
          ? "health_bleed"
          : initialTask?.kind === "observation_roll"
            ? "observation"
            : initialTask?.kind === "continued_contact_maintenance_roll"
              ? "continued_contact"
              : initialTask?.kind === "distance_roll"
                ? "ordinary_distance_roll"
                : undefined);
      const identity: CombatStepAutomationRunIdentity = {
        encounterId,
        gmActorUserId: user.id,
        operationFamily: start.operationFamily,
        runId: start.runId,
        schemaVersion: 1,
        startExecutionGroupId: start.expectedExecutionGroupId,
        startProcessId: start.expectedProcessId,
        startProcessFamily,
        startingRevision: start.expectedRevision,
        startingRound: start.expectedRound,
        startingSequence,
        startingStep: start.expectedStep,
        startTaskId: start.expectedTaskId,
      };

      if (acceptedLinks.length > 0) {
        const currentTask = initial.tasks[0];
        const currentOwner = currentTask
          ? getStepAutomationScenarioParticipant({
              scenarioParticipants: workingParticipants,
              state: initial.state,
              task: currentTask,
            })
          : undefined;
        const declarationProposal =
          currentTask?.kind === "submit_declaration" &&
          currentOwner &&
          !currentOwner.participant.controlledByUserId
            ? resolveApiCombatNpcDeclarationProposal({
                encounter: workingEncounter,
                participant: currentOwner.participant,
                scenarioParticipants: workingParticipants,
                state: initial.state,
                task: currentTask,
              })?.proposal
            : undefined;
        const currentDecision = currentTask
          ? classifyApiCombatStepAutomationTask({
              combatExperienceSkillLookups,
              encounter: workingEncounter,
              operationFamily: start.operationFamily,
              projection: initial,
              scenarioParticipants: workingParticipants,
              scopeProcessFamily: identity.startProcessFamily,
              task: currentTask,
            })
          : undefined;
        const stepComplete = !isCombatStepAutomationProjectionWithinScope({
          identity,
          projection: initial,
        });
        const acceptedTasks = acceptedLinks.map(({ command, link }) => ({
          commandId: command.id,
          executionGroupId: link.executionGroupId,
          kind: command.type,
          participantId: command.participantId,
          taskId: link.taskId,
        }));
        const stopReason = stepComplete
          ? identity.startProcessFamily === "continued_contact" &&
            (currentTask?.kind === "distance_roll" || currentTask?.kind === "distance_commit")
            ? "distance_decision_required"
            : identity.startProcessFamily === "ordinary_distance_roll" &&
                currentTask?.kind === "distance_commit"
              ? "distance_review_required"
              : "end_of_step"
          : currentDecision?.kind === "stop"
            ? currentDecision.reason
            : acceptedLinks.length >= DEFAULT_COMBAT_STEP_AUTOMATION_LIMIT
              ? "safety_limit_reached"
              : "task_changed";
        return {
          commandEnvelope: buildCombatRoundCommandEnvelope({ state: initial.state }),
          declarationProposal,
          encounter: workingEncounter,
          participants: workingParticipants,
          workflow: {
            acceptedTasks,
            alreadyAccepted: true,
            attemptedTasks: acceptedTasks,
            finalRevision: workingEncounter.updatedAt,
            finalTask: currentTask
              ? {
                  executionGroupId: currentTask.executionGroupId,
                  kind: currentTask.kind,
                  participantId:
                    currentTask.owner?.kind === "combatant"
                      ? currentTask.owner.participantId
                      : currentTask.identity.participantId,
                  taskId: currentTask.id,
                }
              : undefined,
            identity,
            processedCount: acceptedLinks.filter(({ link }) => link.countsTowardProcessed).length,
            stepComplete,
            stopParticipantId:
              currentTask?.owner?.kind === "combatant"
                ? currentTask.owner.participantId
                : currentTask?.identity.participantId,
            stopReason,
            stopTask: currentTask
              ? {
                  executionGroupId: currentTask.executionGroupId,
                  kind: currentTask.kind,
                  participantId:
                    currentTask.owner?.kind === "combatant"
                      ? currentTask.owner.participantId
                      : currentTask.identity.participantId,
                  taskId: currentTask.id,
                }
              : undefined,
          },
        };
      }

      if (workingEncounter.updatedAt !== start.expectedRevision) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Combat state changed before the workflow could start.",
        });
      }
      if (
        initial.roundNumber !== start.expectedRound ||
        initial.step !== start.expectedStep ||
        !initialTask ||
        initialTask.id !== start.expectedTaskId ||
        initialTask.executionGroupId !== start.expectedExecutionGroupId ||
        initialTask.processId !== start.expectedProcessId
      ) {
        return reply.code(409).send({
          code: "task_changed",
          error: "The current combat task changed before the workflow could start.",
        });
      }

      const project = () =>
        projectApiCombatStepAutomation({
          encounter: workingEncounter!,
          scenarioParticipants: workingParticipants,
        });
      const workflow = await runCombatStepAutomation({
        classify: ({ projection, task }) =>
          classifyApiCombatStepAutomationTask({
            combatExperienceSkillLookups,
            encounter: workingEncounter!,
            operationFamily: start.operationFamily,
            projection: projection as ApiCombatStepAutomationProjection,
            scenarioParticipants: workingParticipants,
            scopeProcessFamily: identity.startProcessFamily,
            task,
          }),
        execute: async ({ commandId, projection, task }) => {
          const apiProjection = projection as ApiCombatStepAutomationProjection;
          const countsTowardProcessed =
            task.kind === "roll_initiative" ||
            task.kind === "combat_experience" ||
            task.kind === "health_review" ||
            task.kind === "observation_roll" ||
            task.kind === "continued_contact_maintenance_roll" ||
            task.kind === "distance_roll" ||
            task.kind === "modifier_review" ||
            task.kind === "submit_declaration";
          const priorRevisionTime = Date.parse(workingEncounter!.updatedAt);
          const submittedAt = new Date(
            Math.max(Date.now(), Number.isFinite(priorRevisionTime) ? priorRevisionTime + 1 : 0),
          ).toISOString();

          try {
            if (task.kind === "distance_roll") {
              const context = resolveApiCombatDistanceAutomationContext({
                encounter: workingEncounter!,
                scenarioParticipants: workingParticipants,
                state: apiProjection.state,
                task,
              });
              if (context.kind === "stopped") {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason: context.reason,
                };
              }
              const openEndedRoll = rollOpenEndedD20();
              const calculation = resolveAdjustDistanceSkillContestCalculation({
                calculationId: `${context.proposal.id}:roll:${context.owner.encounterParticipantId}`,
                contestType: "round_end_adjust_distance",
                encounterId,
                modifierContributions:
                  context.distanceInputs[context.owner.encounterParticipantId]
                    ?.modifierContributions,
                opponentCombatantId: context.opponentCombatantId,
                opponentLabel: context.opponent.snapshot.displayName,
                opponentScenarioParticipantId: context.opponent.id,
                participant: context.owner.participant,
                participantCombatantId: context.owner.encounterParticipantId,
                proposalId: context.proposal.id,
                role: getRoundEndAdjustDistanceRole({
                  participantId: context.owner.encounterParticipantId,
                  proposal: context.proposal,
                }),
                roll: openEndedRoll,
                roundNumber: apiProjection.state.roundNumber,
                roundState: apiProjection.state,
                step: "round_summary",
              });
              const rolled = rollCombatRoundEndDistanceControl({
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                distanceProposalId: context.proposal.id,
                participantId: context.owner.encounterParticipantId,
                result: buildRoundEndDistanceRollResult({
                  calculation,
                  createdAt: submittedAt,
                  createdByUserId: user.id,
                  rolledAtRound: apiProjection.state.roundNumber,
                  rolledBy: "gm_proxy",
                }),
                state: apiProjection.state,
              });
              const nextState = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed,
                executionGroupId: task.executionGroupId,
                identity,
                state: rolled.state,
                taskId: task.id,
              });
              workingEncounter = await encounterService.updateCombatEncounter({
                campaignId: access.campaignId,
                encounterId,
                expectedRevision: workingEncounter!.updatedAt,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
              });
              return { kind: "accepted" as const, projection: project() };
            }

            if (task.kind === "continued_contact_maintenance_roll") {
              const owner = getStepAutomationScenarioParticipant({
                scenarioParticipants: workingParticipants,
                state: apiProjection.state,
                task,
              });
              const contest =
                apiProjection.state.roundEndReview?.continuedContactMaintenanceContests.find(
                  (candidate) => candidate.id === task.identity.contestId,
                );
              const opponentParticipantId = task.identity.opponentParticipantId;
              const opponentEncounterParticipant = opponentParticipantId
                ? resolveEncounterParticipantMembership({
                    encounter: workingEncounter!,
                    scenarioParticipants: workingParticipants,
                  }).participants.find((participant) => participant.id === opponentParticipantId)
                : undefined;
              const opponent = opponentEncounterParticipant?.scenarioParticipantId
                ? workingParticipants.find(
                    (participant) =>
                      participant.id === opponentEncounterParticipant.scenarioParticipantId,
                  )
                : undefined;
              if (
                !owner ||
                !contest ||
                contest.reviewRequiredReason ||
                !opponentParticipantId ||
                !opponent
              ) {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason: contest?.reviewRequiredReason
                    ? ("continued_contact_review_required" as const)
                    : ("incomplete_legacy_state" as const),
                };
              }
              const modifierProjection = buildLiveCombatModifierContributionProjection({
                combatContext: owner.participant.state.combat.combatContext,
                combatEffects: owner.participant.state.combatEffects,
                currentRound: apiProjection.state.roundNumber,
                encounterId,
                ownerParticipantId: owner.participant.id,
              });
              const openEndedRoll = rollOpenEndedD20();
              const calculation = resolveOffensiveParryBrawlingSkillContestCalculation({
                calculationId: `${contest.id}:roll:${owner.encounterParticipantId}:calculation`,
                encounterId,
                modifierContributions: modifierProjection.contributions,
                opponentCombatantId: opponentParticipantId,
                opponentScenarioParticipantId: opponent.id,
                participant: owner.participant,
                participantCombatantId: owner.encounterParticipantId,
                purpose: "continued_contact_maintenance",
                roll: openEndedRoll,
                roundState: apiProjection.state,
                side:
                  owner.encounterParticipantId === contest.controllerParticipantId
                    ? "controller"
                    : "responder",
              });
              const roll = {
                brawlingBaseValue: calculation.baseSkill,
                brawlingSkillXp: calculation.skill.totalXp,
                characteristicAverage: calculation.governingStat.value,
                effectiveSkillValue: calculation.preDieTotal,
                finalTotal: calculation.finalResult,
                generalModifier: calculation.percentageContributions
                  .filter((contribution) => contribution.category === "general_fatigue")
                  .reduce((total, contribution) => total + contribution.value, 0),
                id: `${contest.id}:roll:${owner.encounterParticipantId}`,
                openEndedD10s: openEndedRoll.openEndedD10s,
                participantId: owner.encounterParticipantId,
                parryQualityModifier: 0,
                percentageAdjustment: calculation.derivedIntegerAdjustment,
                percentageModifierTotal: calculation.totalPercentageAdjustment,
                pendingModifiers: modifierProjection.pendingModifierEntries.map((entry) => ({
                  activationLabel: "Effective from later combat work",
                  label: entry.notes?.trim() || "Combat effect",
                  value: entry.value,
                })),
                rollD20: openEndedRoll.rollD20,
                rollPurpose: "escape_continued_contact" as const,
                rollTotal: openEndedRoll.dieResult,
                rolledAt: submittedAt,
                rolledByUserId: user.id,
                skillId: "brawling" as const,
                skillLabel: "Brawling" as const,
                skillModifier: 0,
              };
              const rolled = recordContinuedContactMaintenanceRoll({
                command: {
                  commandId,
                  createdAt: submittedAt,
                  createdByUserId: user.id,
                  createdRevision: workingEncounter!.updatedAt,
                },
                contestId: contest.id,
                executionGroupId: task.executionGroupId,
                opponentParticipantId,
                participantId: owner.encounterParticipantId,
                participantInputs: buildRoundEndDistanceControlInputs({
                  encounter: workingEncounter!,
                  roundState: apiProjection.state,
                  scenarioParticipants: workingParticipants,
                }),
                roll,
                skillContestCalculation: calculation,
                state: apiProjection.state,
              });
              let nextState = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed,
                executionGroupId: task.executionGroupId,
                identity,
                state: rolled.state,
                taskId: task.id,
              });
              const endedCondition = apiProjection.state.unbalancedConditions.find((condition) => {
                const next = nextState.unbalancedConditions.find(
                  (candidate) => candidate.id === condition.id,
                );
                return condition.status === "active" && next?.status === "ended";
              });
              if (endedCondition) {
                const membership = resolveEncounterParticipantMembership({
                  encounter: workingEncounter!,
                  scenarioParticipants: workingParticipants,
                });
                const affectedCombatant = membership.participants.find(
                  (participant) => participant.id === endedCondition.affectedParticipantId,
                );
                const affected = affectedCombatant?.scenarioParticipantId
                  ? workingParticipants.find(
                      (participant) => participant.id === affectedCombatant.scenarioParticipantId,
                    )
                  : undefined;
                const effects = affected
                  ? combatEffectsStateSchema.parse(affected.state.combatEffects)
                  : undefined;
                const previousEffect = effects?.effects.find(
                  (effect) => effect.id === endedCondition.id,
                );
                if (!affected || !effects || !previousEffect?.canonicalLifecycle) {
                  return {
                    kind: "stopped" as const,
                    projection: apiProjection,
                    reason: "incomplete_legacy_state" as const,
                  };
                }
                const transitionSequence = Math.max(
                  0,
                  nextState.events.reduce(
                    (highest, event) => Math.max(highest, event.sequence),
                    -1,
                  ),
                );
                const activated =
                  previousEffect.canonicalLifecycle.lifecycle.state === "pending_activation"
                    ? transitionCanonicalCombatModifierEffect({
                        acceptedRevision: workingEncounter!.updatedAt,
                        acceptedSequence: transitionSequence,
                        commandId,
                        effect: previousEffect.canonicalLifecycle,
                        nextState: "active",
                        reason: "activation_cutoff_reached",
                        transitionId: `${commandId}:activate:${previousEffect.id}`,
                        transitionType: "activate",
                      })
                    : undefined;
                const transitioned = transitionCanonicalCombatModifierEffect({
                  acceptedRevision: workingEncounter!.updatedAt,
                  acceptedSequence: transitionSequence,
                  commandId,
                  effect: activated?.effect ?? previousEffect.canonicalLifecycle,
                  nextState: "resolved",
                  reason: "condition_cleared",
                  transitionId: `${commandId}:resolve:${previousEffect.id}`,
                  transitionType: "resolve",
                });
                const nextEffect = combatEffectSchema.parse({
                  ...previousEffect,
                  canonicalLifecycle: transitioned.effect,
                  canonicalTransitions: [
                    ...(previousEffect.canonicalTransitions ?? []),
                    ...(activated ? [activated.transition] : []),
                    transitioned.transition,
                  ],
                  status: "expired",
                  updatedAt: submittedAt,
                });
                nextState = attachContinuedContactEffectTransitionFacts({
                  commandId,
                  nextEffect,
                  previousEffect,
                  scenarioParticipantId: affected.id,
                  state: nextState,
                });
                const saved = await encounterService.commitCombatParticipantStateMutation({
                  campaignId: access.campaignId,
                  encounterId,
                  expectedEncounterRevision: workingEncounter!.updatedAt,
                  participant: affected,
                  scenarioId,
                  session: {
                    ...workingEncounter!,
                    combatRoundState: nextState,
                    currentRound: nextState.roundNumber,
                    updatedAt: submittedAt,
                  },
                  state: {
                    ...affected.state,
                    combatEffects: combatEffectsStateSchema.parse({
                      ...effects,
                      effects: effects.effects.map((effect) =>
                        effect.id === nextEffect.id ? nextEffect : effect,
                      ),
                    }),
                  },
                });
                workingEncounter = saved.encounter;
                workingParticipants = workingParticipants.map((participant) =>
                  participant.id === saved.participant.id ? saved.participant : participant,
                );
              } else {
                workingEncounter = await encounterService.updateCombatEncounter({
                  campaignId: access.campaignId,
                  encounterId,
                  expectedRevision: workingEncounter!.updatedAt,
                  scenarioId,
                  session: {
                    ...workingEncounter!,
                    combatRoundState: nextState,
                    currentRound: nextState.roundNumber,
                    updatedAt: submittedAt,
                  },
                });
              }
              return { kind: "accepted" as const, projection: project() };
            }

            if (task.kind === "observation_roll") {
              const owner = getStepAutomationScenarioParticipant({
                scenarioParticipants: workingParticipants,
                state: apiProjection.state,
                task,
              });
              const observationAttemptId = task.identity.observationAttemptId;
              const relationshipId = task.identity.relationshipId;
              const targetParticipantId = task.identity.opponentParticipantId;
              if (!owner || !observationAttemptId || !relationshipId || !targetParticipantId) {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason: "observation_review_required" as const,
                };
              }
              const context = resolveApiCombatObservationRollContext({
                encounter: workingEncounter!,
                observerParticipantId: owner.encounterParticipantId,
                observationAttemptId,
                relationshipId,
                scenarioParticipants: workingParticipants,
                state: apiProjection.state,
                targetParticipantId,
              });
              if (context.kind === "stopped") {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason: context.reason,
                };
              }
              const rolled = recordCombatObservationRoll({
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                completedAtRevision: submittedAt,
                executionGroupId: task.executionGroupId,
                observerBasis: context.observerBasis,
                observerParticipantId: owner.encounterParticipantId,
                observationAttemptId,
                relationshipId,
                state: apiProjection.state,
                targetBasis: context.targetBasis,
                targetParticipantId,
              });
              const nextState = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed,
                executionGroupId: task.executionGroupId,
                identity,
                state: rolled.state,
                taskId: task.id,
              });
              workingEncounter = await encounterService.updateCombatEncounter({
                campaignId: access.campaignId,
                encounterId,
                expectedRevision: workingEncounter!.updatedAt,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
              });
              return { kind: "accepted" as const, projection: project() };
            }

            if (task.kind === "health_review") {
              const owner = getStepAutomationScenarioParticipant({
                scenarioParticipants: workingParticipants,
                state: apiProjection.state,
                task,
              });
              const proposal = owner
                ? getCombatRoundEndHealthCheckPendingRolls({
                    participantId: owner.encounterParticipantId,
                    state: apiProjection.state,
                  }).find((candidate) => candidate.id === task.identity.healthRollId)
                : undefined;
              if (
                !owner ||
                !proposal ||
                proposal.warnings.length > 0 ||
                !Number.isInteger(proposal.difficulty)
              ) {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason: proposal?.warnings.length
                    ? ("warning_requires_acknowledgement" as const)
                    : ("roll_not_eligible" as const),
                };
              }
              const rolled = rollCombatRoundEndHealthCheck({
                combatEffects: owner.participant.state.combatEffects,
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                createdRevision: workingEncounter!.updatedAt,
                healthRollId: proposal.id,
                participantId: owner.encounterParticipantId,
                rolledBy: "gm_proxy",
                state: apiProjection.state,
              });
              const nextState = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed,
                executionGroupId: task.executionGroupId,
                identity,
                state: rolled.state,
                taskId: task.id,
              });
              const saved = await encounterService.commitCombatParticipantStateMutation({
                campaignId: access.campaignId,
                encounterId,
                expectedEncounterRevision: workingEncounter!.updatedAt,
                participant: owner.participant,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
                state: {
                  ...owner.participant.state,
                  combatEffects: rolled.combatEffects,
                },
              });
              workingEncounter = saved.encounter;
              workingParticipants = workingParticipants.map((participant) =>
                participant.id === saved.participant.id ? saved.participant : participant,
              );
              return { kind: "accepted" as const, projection: project() };
            }

            if (identity.startProcessFamily === "health_bleed" && task.kind === "effect_review") {
              const owner = getStepAutomationScenarioParticipant({
                scenarioParticipants: workingParticipants,
                state: apiProjection.state,
                task,
              });
              const disposition = owner
                ? getCombatRoundEndHealthAutomationReviewDisposition({
                    participantId: owner.encounterParticipantId,
                    state: apiProjection.state,
                  })
                : undefined;
              if (!owner || disposition !== "automatic") {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason:
                    disposition === "incomplete_legacy_state"
                      ? ("incomplete_legacy_state" as const)
                      : ("effect_review_required" as const),
                };
              }
              const committed = commitCombatRoundEndParticipantReview({
                combatEffects: owner.participant.state.combatEffects,
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                createdRevision: workingEncounter!.updatedAt,
                encounterId,
                participantId: owner.encounterParticipantId,
                scenarioId,
                scenarioParticipantId: owner.participant.id,
                state: apiProjection.state,
              });
              const nextState = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed: false,
                executionGroupId: task.executionGroupId,
                identity,
                state: committed.state,
                taskId: task.id,
              });
              const saved = await encounterService.commitCombatParticipantStateMutation({
                campaignId: access.campaignId,
                encounterId,
                expectedEncounterRevision: workingEncounter!.updatedAt,
                participant: owner.participant,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
                state: {
                  ...owner.participant.state,
                  combatEffects: committed.combatEffects,
                },
              });
              workingEncounter = saved.encounter;
              workingParticipants = workingParticipants.map((participant) =>
                participant.id === saved.participant.id ? saved.participant : participant,
              );
              return { kind: "accepted" as const, projection: project() };
            }

            if (task.kind === "combat_experience") {
              const owner = getStepAutomationScenarioParticipant({
                scenarioParticipants: workingParticipants,
                state: apiProjection.state,
                task,
              });
              const lookup = owner
                ? combatExperienceSkillLookups.get(owner.participant.id)
                : undefined;
              const trigger = owner
                ? getCombatRoundRequiredCombatExperienceTrigger({
                    participantId: owner.encounterParticipantId,
                    state: apiProjection.state,
                    visibility: workingEncounter!.roleplayState?.visibility,
                  })
                : undefined;
              if (
                !owner ||
                !lookup ||
                lookup.warning ||
                trigger !== "combat_start" ||
                !isCombatRoundCombatExperienceWindowOpen(apiProjection.state)
              ) {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason:
                    lookup?.warning || !lookup
                      ? ("combat_experience_review_required" as const)
                      : ("roll_not_eligible" as const),
                };
              }
              const rolled = rollCombatRoundCombatExperience({
                combatContext: owner.participant.state.combat.combatContext,
                combatEffects: owner.participant.state.combatEffects,
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                createdRevision: workingEncounter!.updatedAt,
                encounterId: workingEncounter!.id,
                participantId: owner.encounterParticipantId,
                scenarioId,
                scenarioParticipantId: owner.participant.id,
                skillTotal: lookup.skillTotal,
                skillTotalSource: lookup.source,
                state: apiProjection.state,
                trigger,
                visibility: workingEncounter!.roleplayState?.visibility,
              });
              const nextState = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed,
                executionGroupId: task.executionGroupId,
                identity,
                state: rolled.state,
                taskId: task.id,
              });
              const saved = await encounterService.commitCombatParticipantStateMutation({
                campaignId: access.campaignId,
                encounterId,
                expectedEncounterRevision: workingEncounter!.updatedAt,
                participant: owner.participant,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
                state: {
                  ...owner.participant.state,
                  combat: {
                    ...owner.participant.state.combat,
                    combatContext: rolled.combatContext,
                  },
                  combatEffects: rolled.combatEffects,
                },
              });
              workingEncounter = saved.encounter;
              workingParticipants = workingParticipants.map((participant) =>
                participant.id === saved.participant.id ? saved.participant : participant,
              );
              return { kind: "accepted" as const, projection: project() };
            }

            if (task.kind === "submit_declaration") {
              const owner = getStepAutomationScenarioParticipant({
                scenarioParticipants: workingParticipants,
                state: apiProjection.state,
                task,
              });
              const encounterParticipant = owner
                ? workingEncounter!.participants.find(
                    (participant) => participant.id === owner.encounterParticipantId,
                  )
                : undefined;
              const resolution = owner
                ? resolveApiCombatNpcDeclarationProposal({
                    encounter: workingEncounter!,
                    participant: owner.participant,
                    scenarioParticipants: workingParticipants,
                    state: apiProjection.state,
                    task,
                  })
                : undefined;
              const prepared =
                owner && encounterParticipant && resolution
                  ? prepareAcceptedNpcDeclarationProposal({
                      encounter: workingEncounter!,
                      encounterParticipant,
                      participant: owner.participant,
                      resolution,
                      scenarioParticipants: workingParticipants,
                      state: apiProjection.state,
                      submittedAt,
                      userId: user.id,
                    })
                  : undefined;
              if (!owner || !resolution || !prepared) {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason: resolution?.proposal.validation.reasons.includes("target_invalid")
                    ? ("target_invalid" as const)
                    : resolution?.proposal.validation.status === "legacy_incomplete"
                      ? ("incomplete_legacy_state" as const)
                      : resolution?.proposal.validation.status === "requires_review"
                        ? ("declaration_review_required" as const)
                        : ("invalid_proposal" as const),
                };
              }
              const declared = recordCombatRoundDeclaration({
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                declaration: prepared.declaration,
                participantId: owner.encounterParticipantId,
                state: apiProjection.state,
                submittedBy: "gm",
              });
              const linked = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed,
                executionGroupId: task.executionGroupId,
                identity,
                state: declared,
                taskId: task.id,
              });
              const nextState = attachCombatNpcDeclarationProposalProvenance({
                commandId,
                proposal: resolution.proposal,
                state: linked,
              });
              const saved = await encounterService.commitCombatParticipantStateMutation({
                encounterId,
                campaignId: access.campaignId,
                expectedEncounterRevision: workingEncounter!.updatedAt,
                participant: owner.participant,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
                state: prepared.participantState,
              });
              workingEncounter = saved.encounter;
              workingParticipants = workingParticipants.map((participant) =>
                participant.id === saved.participant.id ? saved.participant : participant,
              );
              return { kind: "accepted" as const, projection: project() };
            }

            if (task.kind === "roll_initiative" && task.identity.phase) {
              const owner = getStepAutomationScenarioParticipant({
                scenarioParticipants: workingParticipants,
                state: apiProjection.state,
                task,
              });
              if (!owner) {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason: "roll_not_eligible" as const,
                };
              }
              const base = resolveCanonicalCombatInitiativeBaseForTask({
                encounterParticipantId: owner.encounterParticipantId,
                participant: owner.participant,
                phase: task.identity.phase,
                state: apiProjection.state,
              });
              if (base.completeness !== "complete") {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason: "roll_not_eligible" as const,
                };
              }
              const rolled = recordCanonicalServerCombatInitiative({
                commandId,
                encounter: workingEncounter!,
                encounterParticipantId: owner.encounterParticipantId,
                initiativeBase: base.initiativeBase,
                phase: task.identity.phase,
                scenarioParticipant: owner.participant,
                state: apiProjection.state,
                submittedAt,
                submittedBy: "gm",
                userId: user.id,
              });
              const nextState = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed,
                executionGroupId: task.executionGroupId,
                identity,
                state: rolled.state,
                taskId: task.id,
              });
              workingEncounter = await encounterService.updateCombatEncounter({
                campaignId: access.campaignId,
                encounterId,
                expectedRevision: workingEncounter!.updatedAt,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
              });
              return { kind: "accepted" as const, projection: project() };
            }

            if (task.kind === "modifier_review") {
              const owner = getStepAutomationScenarioParticipant({
                scenarioParticipants: workingParticipants,
                state: apiProjection.state,
                task,
              });
              const review = owner
                ? getStraightforwardStepAutomationModifierReview({
                    commandId,
                    encounter: workingEncounter!,
                    participant: owner.participant,
                    state: apiProjection.state,
                    task,
                  })
                : undefined;
              if (!owner || !review?.straightforward) {
                return {
                  kind: "stopped" as const,
                  projection: apiProjection,
                  reason: "modifier_review_required" as const,
                };
              }
              const transaction = commitCanonicalCombatModifierReview({
                acceptedRevision: workingEncounter!.updatedAt,
                acceptedSequence: review.review.canonicalCutoff,
                commandId,
                review: review.review,
              });
              const nextParticipantState = applyCanonicalModifierReviewToParticipantState({
                createdAt: submittedAt,
                draftContext: review.currentContext,
                state: owner.participant.state,
                transaction,
              });
              const reviewedDeclarationState = recordCombatRoundDeclaration({
                declaration: {
                  ...review.declaration,
                  combatContext: review.currentContext,
                  submittedAt,
                  submittedByUserId: user.id,
                },
                participantId: owner.encounterParticipantId,
                state: apiProjection.state,
                submittedBy: "gm",
              });
              const recorded = recordCombatRoundParticipantStepReview({
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                modifierReview: transaction,
                modifierReviewUndo: {
                  combatContext: owner.participant.state.combat.combatContext,
                  combatEffects: owner.participant.state.combatEffects,
                },
                participantId: owner.encounterParticipantId,
                previousDeclaration: review.declaration,
                state: reviewedDeclarationState,
                step: apiProjection.state.currentStep,
                submittedBy: "gm",
              });
              const nextState = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed,
                executionGroupId: task.executionGroupId,
                identity,
                state: recorded,
                taskId: task.id,
              });
              const saved = await encounterService.commitCombatModifierReview({
                campaignId: access.campaignId,
                encounterId,
                expectedEncounterRevision: workingEncounter!.updatedAt,
                participant: owner.participant,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
                state: nextParticipantState,
              });
              workingEncounter = saved.encounter;
              workingParticipants = workingParticipants.map((participant) =>
                participant.id === saved.participant.id ? saved.participant : participant,
              );
              return { kind: "accepted" as const, projection: project() };
            }

            if (task.kind === "commit_initiative" && task.identity.phase) {
              const nonParticipatingParticipantIds = new Set(
                apiProjection.participation.facts.flatMap((fact) =>
                  fact.identity.processFamily === "initiative" &&
                  fact.identity.phase === task.identity.phase &&
                  fact.status === "not_required" &&
                  fact.workClass === "no_work" &&
                  fact.completeness === "complete" &&
                  fact.identity.participantId
                    ? [fact.identity.participantId]
                    : [],
                ),
              );
              const committed = commitCombatRoundPhaseInitiativeResolution({
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                nonParticipatingParticipantIds,
                phase: task.identity.phase,
                state: apiProjection.state,
                visibility: workingEncounter!.roleplayState?.visibility,
              });
              const nextState = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed: false,
                executionGroupId: task.executionGroupId,
                identity,
                state: committed.state,
                taskId: task.id,
              });
              workingEncounter = await encounterService.updateCombatEncounter({
                campaignId: access.campaignId,
                encounterId,
                expectedRevision: workingEncounter!.updatedAt,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
              });
              return { kind: "accepted" as const, projection: project() };
            }

            if (task.kind === "gm_advance_boundary" && task.transition) {
              const advanced = advanceCombatProgressionBoundary({
                command: { commandId, createdAt: submittedAt, createdByUserId: user.id },
                expectedBoundary: task.transition.currentBoundary,
                expectedCommandType: "advance_combat_boundary",
                expectedExecutionGroupId: task.executionGroupId,
                expectedTaskId: task.id,
                participation: apiProjection.participation,
                state: apiProjection.state,
                targetBoundary: task.transition.targetBoundary,
                visibility: workingEncounter!.roleplayState?.visibility,
              });
              const nextState = attachCombatStepAutomationCommandLink({
                commandId,
                countsTowardProcessed: false,
                executionGroupId: task.executionGroupId,
                identity,
                state: advanced,
                taskId: task.id,
              });
              workingEncounter = await encounterService.updateCombatEncounter({
                campaignId: access.campaignId,
                encounterId,
                expectedRevision: workingEncounter!.updatedAt,
                scenarioId,
                session: {
                  ...workingEncounter!,
                  combatRoundState: nextState,
                  currentRound: nextState.roundNumber,
                  updatedAt: submittedAt,
                },
              });
              return { kind: "accepted" as const, projection: project() };
            }

            return {
              kind: "stopped" as const,
              projection: apiProjection,
              reason: "unsupported_task" as const,
            };
          } catch (error) {
            if (error instanceof EncounterCombatWriteError) {
              const latestEncounter = await encounterService.getEncounterById(encounterId);
              if (latestEncounter?.scenarioId === scenarioId) {
                workingEncounter = latestEncounter;
                workingParticipants = await scenarioService.listScenarioParticipants(scenarioId);
                const latest = project();
                return {
                  kind: "stopped" as const,
                  projection: latest,
                  reason:
                    latest.tasks[0]?.id === task.id
                      ? ("stale_revision" as const)
                      : ("task_changed" as const),
                };
              }
            }
            return {
              kind: "stopped" as const,
              projection: project(),
              reason: "persistence_failure" as const,
            };
          }
        },
        identity,
        initial,
      });

      const { final: finalProjection, ...workflowResult } = workflow;
      const boundedWorkflowResult =
        identity.startProcessFamily === "continued_contact" &&
        workflowResult.stopReason === "end_of_step" &&
        (workflowResult.finalTask?.kind === "distance_roll" ||
          workflowResult.finalTask?.kind === "distance_commit")
          ? { ...workflowResult, stopReason: "distance_decision_required" as const }
          : identity.startProcessFamily === "ordinary_distance_roll" &&
              workflowResult.stopReason === "end_of_step" &&
              workflowResult.finalTask?.kind === "distance_commit"
            ? { ...workflowResult, stopReason: "distance_review_required" as const }
            : workflowResult;
      const finalTask = finalProjection.tasks[0];
      const finalOwner = finalTask
        ? getStepAutomationScenarioParticipant({
            scenarioParticipants: workingParticipants,
            state: finalProjection.state,
            task: finalTask,
          })
        : undefined;
      const declarationProposal =
        finalTask?.kind === "submit_declaration" &&
        finalOwner &&
        !finalOwner.participant.controlledByUserId
          ? resolveApiCombatNpcDeclarationProposal({
              encounter: workingEncounter,
              participant: finalOwner.participant,
              scenarioParticipants: workingParticipants,
              state: finalProjection.state,
              task: finalTask,
            })?.proposal
          : undefined;
      return {
        commandEnvelope: buildCombatRoundCommandEnvelope({ state: finalProjection.state }),
        declarationProposal,
        encounter: workingEncounter,
        participants: workingParticipants,
        workflow: boundedWorkflowResult,
      };
    } catch (error) {
      const persistenceErrorResponse = sendCombatWriteError(reply, error);
      if (persistenceErrorResponse !== undefined) return persistenceErrorResponse;
      return reply.code(error instanceof RangeError ? 409 : 400).send({
        error: error instanceof Error ? error.message : "Unable to run the combat workflow.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/advance-current-step", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(403).send({
          code: "unauthorized_actor",
          error: "Only GM users can advance combat round steps.",
        });
      }

      const body = parseCombatRoundAdvanceBody(request.body);
      if (body.expectedRevision !== encounter.updatedAt) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Combat state changed before the boundary could be advanced.",
        });
      }
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const participation = projectActiveCombatParticipation({
        encounterRevision: encounter.updatedAt,
        scenarioParticipants,
        state: roundState,
      });
      const submittedAt = new Date().toISOString();
      const nextRoundState = advanceCombatProgressionBoundary({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        expectedBoundary: body.expectedBoundary,
        expectedCommandType: body.commandType,
        expectedExecutionGroupId: body.executionGroupId,
        expectedTaskId: body.taskId,
        participation,
        state: roundState,
        stepSnapshots: body.stepSnapshots,
        targetBoundary: body.targetBoundary,
        visibility: encounter.roleplayState?.visibility,
      });
      const participantMutations =
        nextRoundState.roundNumber > roundState.roundNumber
          ? scenarioParticipants.flatMap((participant) => {
              const currentContext = participant.state.combat.combatContext;
              const nextContext = expireAdjustDistanceAttackGeneratedModifiersBeforeRound(
                expireCombatFeintGeneratedModifiersBeforeRound(
                  currentContext,
                  nextRoundState.roundNumber,
                ),
                nextRoundState.roundNumber,
              );
              if (JSON.stringify(nextContext) === JSON.stringify(currentContext)) return [];
              return [
                {
                  participant,
                  state: {
                    ...participant.state,
                    combat: { ...participant.state.combat, combatContext: nextContext },
                  },
                },
              ];
            })
          : [];
      const saved =
        participantMutations.length > 0
          ? await encounterService.commitCombatParticipantStateMutations({
              campaignId: access.campaignId,
              encounterId,
              expectedEncounterRevision: encounter.updatedAt,
              participants: participantMutations,
              scenarioId,
              session: {
                ...encounter,
                combatRoundState: nextRoundState,
                currentRound: nextRoundState.roundNumber,
                updatedAt: submittedAt,
              },
            })
          : {
              encounter: await encounterService.updateCombatEncounter({
                expectedRevision: encounter.updatedAt,
                campaignId: access.campaignId,
                encounterId,
                scenarioId,
                session: {
                  ...encounter,
                  combatRoundState: nextRoundState,
                  currentRound: nextRoundState.roundNumber,
                  updatedAt: submittedAt,
                },
              }),
              participants: [] as ScenarioParticipant[],
            };
      const commandEnvelope = buildCombatRoundCommandEnvelope({
        state: nextRoundState,
      });

      return {
        commandEnvelope,
        encounter: saved.encounter,
        participants: saved.participants,
      };
    } catch (error) {
      return reply.code(400).send({
        ...(error instanceof CombatProgressionBoundaryAdvanceError ||
        error instanceof CombatCommandRequestError
          ? { code: error.code }
          : {}),
        error: error instanceof Error ? error.message : "Unable to advance combat round step.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/save-damage-review", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({ error: "Encounter not found." });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(403).send({
          error: "Only GM users can save damage reviews.",
        });
      }

      const body = parseCombatDamageReviewBody(request.body);
      if (body.commandType !== "commit_phase_damage") {
        return reply.code(409).send({ error: "Damage review is not ready to be saved." });
      }
      if (body.expectedRevision !== encounter.updatedAt) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Combat state changed. Review the current action before continuing.",
        });
      }
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const attackResult = getCombatRoundAttackResultById({
        attackResultId: body.attackResultId,
        state: roundState,
      });

      if (!attackResult) {
        throw new Error("No current damage proposal is open.");
      }
      if (
        body.attackerParticipantId !== attackResult.attackerParticipantId ||
        body.defenderParticipantId !== attackResult.defenderParticipantId ||
        body.phase !== attackResult.phase ||
        body.hitLocationResultId !==
          getCombatRoundHitLocationResultId({
            attackResultId: body.attackResultId,
          }) ||
        body.criticalResultId !==
          getCombatRoundCriticalResultId({
            attackResultId: body.attackResultId,
          }) ||
        body.damageReviewId !==
          getCombatRoundDamageReviewId({
            attackResultId: body.attackResultId,
          })
      ) {
        return reply.code(409).send({ error: "The damage review identity is stale." });
      }
      const authorization = authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        attackResultId: body.attackResultId,
        attackerParticipantId: body.attackerParticipantId,
        commandType: "commit_phase_damage",
        criticalResultId: body.criticalResultId,
        damageReviewId: body.damageReviewId,
        defenderParticipantId: body.defenderParticipantId,
        executionGroupId: body.executionGroupId,
        hitLocationResultId: body.hitLocationResultId,
        opportunityId: body.opportunityId,
        phase: body.phase,
        projection: buildCombatProgressionProjection(roundState),
        taskId: body.taskId,
      });
      if (!authorization.ok) {
        return reply.code(409).send({
          code: authorization.code,
          error: "Damage review is not open for this attack.",
        });
      }
      const resolution = roundState.phaseResolutionResults.find(
        (candidate) => candidate.attackResultId === body.attackResultId,
      );

      if (!resolution?.damageResult) {
        throw new Error("No current damage proposal is open.");
      }

      const submittedAt = new Date().toISOString();
      const reviewedState = reviewCombatRoundDamageResult({
        attackResultId: resolution.damageResult.attackResultId,
        review: body.review,
        reviewedAt: submittedAt,
        reviewedByUserId: user.id,
        state: roundState,
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: reviewedState,
          currentRound: reviewedState.roundNumber,
          updatedAt: submittedAt,
        },
      });
      const commandEnvelope = buildCombatRoundCommandEnvelope({ state: reviewedState });

      return { commandEnvelope, encounter: savedEncounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to save damage review.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/commit-phase-damage", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({ error: "Encounter not found." });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(403).send({
          error: "Only GM users can commit phase damage.",
        });
      }

      const body = parseCombatDamageReviewBody(request.body);
      if (body.commandType !== "commit_phase_damage") {
        return reply.code(409).send({ error: "Damage review is not ready to be committed." });
      }
      if (body.expectedRevision !== encounter.updatedAt) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Combat state changed. Review the current action before continuing.",
        });
      }
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const attackResult = getCombatRoundAttackResultById({
        attackResultId: body.attackResultId,
        state: roundState,
      });

      if (!attackResult) {
        throw new Error("No current damage proposal is open.");
      }
      if (
        body.attackerParticipantId !== attackResult.attackerParticipantId ||
        body.defenderParticipantId !== attackResult.defenderParticipantId ||
        body.phase !== attackResult.phase ||
        body.hitLocationResultId !==
          getCombatRoundHitLocationResultId({
            attackResultId: body.attackResultId,
          }) ||
        body.criticalResultId !==
          getCombatRoundCriticalResultId({
            attackResultId: body.attackResultId,
          }) ||
        body.damageReviewId !==
          getCombatRoundDamageReviewId({
            attackResultId: body.attackResultId,
          })
      ) {
        return reply.code(409).send({ error: "The damage review identity is stale." });
      }
      const authorization = authorizeCombatProgressionTask({
        actor: { kind: "gm" },
        attackResultId: body.attackResultId,
        attackerParticipantId: body.attackerParticipantId,
        commandType: "commit_phase_damage",
        criticalResultId: body.criticalResultId,
        damageReviewId: body.damageReviewId,
        defenderParticipantId: body.defenderParticipantId,
        executionGroupId: body.executionGroupId,
        hitLocationResultId: body.hitLocationResultId,
        opportunityId: body.opportunityId,
        phase: body.phase,
        projection: buildCombatProgressionProjection(roundState),
        taskId: body.taskId,
      });
      if (!authorization.ok) {
        return reply.code(409).send({
          code: authorization.code,
          error: "Damage review is not open for this attack.",
        });
      }
      const resolution = roundState.phaseResolutionResults.find(
        (candidate) => candidate.attackResultId === body.attackResultId,
      );

      if (!resolution?.damageResult) {
        throw new Error("No current damage proposal is open.");
      }

      const defenderEncounterParticipant = encounter.participants.find((participant) =>
        participantAliasesInclude({ id: attackResult.defenderParticipantId, participant }),
      );
      const attackerEncounterParticipant = encounter.participants.find((participant) =>
        participantAliasesInclude({ id: attackResult.attackerParticipantId, participant }),
      );
      const defenderScenarioParticipant = findScenarioParticipantForEncounterParticipant({
        encounterParticipant: defenderEncounterParticipant,
        scenarioParticipants,
      });
      const attackerScenarioParticipant = findScenarioParticipantForEncounterParticipant({
        encounterParticipant: attackerEncounterParticipant,
        scenarioParticipants,
      });

      if (!defenderScenarioParticipant) {
        throw new Error("Defender scenario participant state is required to commit damage.");
      }

      const submittedAt = new Date().toISOString();
      const reviewedState = reviewCombatRoundDamageResult({
        attackResultId: resolution.damageResult.attackResultId,
        review: body.review,
        reviewedAt: submittedAt,
        reviewedByUserId: user.id,
        state: roundState,
      });
      const committed = commitCombatRoundPhaseDamage({
        attackResultId: resolution.damageResult.attackResultId,
        attackerScenarioParticipantId: attackerScenarioParticipant?.id,
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        combatEffects: defenderScenarioParticipant.state.combatEffects,
        createdRevision: encounter.updatedAt,
        defenderScenarioParticipantId: defenderScenarioParticipant.id,
        encounterId,
        scenarioId,
        state: reviewedState,
      });

      const saved = await encounterService.commitCombatParticipantStateMutation({
        campaignId: access.campaignId,
        encounterId,
        expectedEncounterRevision: encounter.updatedAt,
        participant: defenderScenarioParticipant,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: committed.state,
          currentRound: committed.state.roundNumber,
          updatedAt: submittedAt,
        },
        state: {
          ...defenderScenarioParticipant.state,
          combatEffects: committed.combatEffects,
        },
      });
      const commandEnvelope = buildCombatRoundCommandEnvelope({ state: committed.state });

      return { commandEnvelope, encounter: saved.encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to commit phase damage.",
      });
    }
  });

  app.post(
    "/encounters/:encounterId/combat-round/commit-phase-initiative-resolution",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);

      if (!user) {
        return;
      }

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);

        if (!encounter?.scenarioId) {
          return reply.code(404).send({
            error: "Encounter not found.",
          });
        }

        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          {
            campaignService,
            scenarioService,
          },
          {
            scenarioId,
            userId: user.id,
            userRoles: user.roles,
          },
        );

        if (!access || access.mode !== "gm") {
          return reply.code(403).send({
            error: "Only GM users can commit phase initiative resolution.",
          });
        }

        const value = parseBodyObject(request.body, "Phase initiative resolution payload");
        const identity = parseCombatTaskCommandIdentity(value);
        const phase = combatRoundPhaseSchema.parse(value.phase);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const membership = resolveEncounterParticipantMembership({
          encounter,
          scenarioParticipants,
        });
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const initiativeCommitAuthorization = authorizeCombatTaskCommand({
          authorization: {
            actor: { kind: "gm" },
            commandType: "commit_phase_initiative_resolution",
            phase,
          },
          encounterRevision: encounter.updatedAt,
          identity,
          roundState,
        });
        if (!initiativeCommitAuthorization.ok) {
          return reply.code(400).send({
            error: "Phase initiative must be complete before resolution can be committed.",
          });
        }
        const participantInputs: Record<string, CombatRoundPhaseInitiativeCommitParticipantInput> =
          {};

        for (const encounterParticipant of membership.participants) {
          const scenarioParticipant = scenarioParticipants.find(
            (participant) =>
              participant.id === encounterParticipant.scenarioParticipantId ||
              participant.id === encounterParticipant.id ||
              (encounterParticipant.characterId &&
                participant.characterId === encounterParticipant.characterId),
          );

          if (!scenarioParticipant) {
            continue;
          }

          const skillLookup =
            await getCombatExperienceSkillLookupForScenarioParticipant(scenarioParticipant);

          participantInputs[encounterParticipant.id] = {
            combatContext: scenarioParticipant.state.combat.combatContext,
            scenarioParticipantId: scenarioParticipant.id,
            skillTotal: skillLookup.skillTotal,
            skillTotalSource: skillLookup.source,
            skillTotalWarning: skillLookup.warning,
          };
        }

        const submittedAt = new Date().toISOString();
        const committed = commitCombatRoundPhaseInitiativeResolution({
          command: {
            createdAt: submittedAt,
            createdByUserId: user.id,
          },
          participants: participantInputs,
          phase,
          state: roundState,
          visibility: encounter.roleplayState?.visibility,
        });
        const participantMutations = Object.entries(
          committed.combatContextsByParticipantId,
        ).flatMap(([encounterParticipantId, combatContext]) => {
          const encounterParticipant = membership.participants.find(
            (participant) => participant.id === encounterParticipantId,
          );
          const scenarioParticipant = encounterParticipant
            ? scenarioParticipants.find(
                (participant) =>
                  participant.id === encounterParticipant.scenarioParticipantId ||
                  participant.id === encounterParticipant.id ||
                  (encounterParticipant.characterId &&
                    participant.characterId === encounterParticipant.characterId),
              )
            : undefined;

          if (!scenarioParticipant) {
            return [];
          }

          return [
            {
              participant: scenarioParticipant,
              state: {
                ...scenarioParticipant.state,
                combat: {
                  ...scenarioParticipant.state.combat,
                  combatContext,
                },
              },
            },
          ];
        });
        const saved = await encounterService.commitCombatParticipantStateMutations({
          campaignId: access.campaignId,
          encounterId,
          expectedEncounterRevision: encounter.updatedAt,
          participants: participantMutations,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: committed.state,
            currentRound: committed.state.roundNumber,
            updatedAt: submittedAt,
          },
        });
        const commandEnvelope = buildCombatRoundCommandEnvelope({
          latestResult: {
            kind: "phase_initiative_commit",
            phase,
          },
          state: committed.state,
        });

        return {
          commandEnvelope,
          encounter: saved.encounter,
          participants: saved.participants,
        };
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error
              ? error.message
              : "Unable to commit phase initiative resolution.",
        });
      }
    },
  );

  app.post("/encounters/:encounterId/combat-round/roll-attack", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatAttackBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: body.scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const defenderResolution = resolveEncounterParticipantForViewer({
        encounter,
        requestedParticipantId: body.defenderParticipantId,
        scenarioParticipants,
        viewer: { kind: "gm" },
      });
      const membership = resolveEncounterParticipantMembership({ encounter, scenarioParticipants });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;
      const defenderEncounterParticipant = defenderResolution?.encounterParticipant;
      const defenderScenarioParticipant = defenderResolution?.scenarioParticipant;

      if (
        !scenarioParticipant ||
        !scenarioParticipant.isActive ||
        !encounterParticipant ||
        !defenderScenarioParticipant ||
        !defenderScenarioParticipant.isActive ||
        !defenderEncounterParticipant
      ) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      if (body.expectedParticipantRevision !== scenarioParticipant.updatedAt) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Attacker combat state changed before the attack was rolled.",
        });
      }

      if (
        access.mode !== "gm" &&
        (scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }))
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter participant.",
        });
      }

      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const attackAuthorization = authorizeCombatTaskCommand({
        authorization: {
          actor:
            access.mode === "gm"
              ? { kind: "gm" }
              : { kind: "combatant", participantId: encounterParticipant.id },
          commandType: "roll_attack",
          attackIndex: body.attackIndex,
          attackModeId: body.attackModeId,
          declarationId: body.declarationId,
          opportunityId: body.opportunityId,
          participantId: encounterParticipant.id,
          phase: body.phase,
          weaponInstanceId: body.weaponInstanceId,
          weaponSourceId: body.weaponSourceId,
          weaponSourceSlot: body.weaponSourceSlot,
          weaponTemplateId: body.weaponTemplateId,
        },
        encounterRevision: encounter.updatedAt,
        identity: body,
        roundState,
      });
      if (!attackAuthorization.ok) {
        return reply.code(409).send({
          code: attackAuthorization.code,
          error:
            attackAuthorization.code === "stale_revision"
              ? "Combat state changed after this attack was displayed. Refresh combat before rolling."
              : attackAuthorization.message,
        });
      }
      const projectedAttackTask = attackAuthorization.task;
      if (
        body.modifierValidationTaskId &&
        body.modifierValidationTaskId !== projectedAttackTask?.id
      ) {
        return reply.code(409).send({
          code: "modifier_validation_task_mismatch",
          error:
            "The attack modifier validation belongs to an older task. Refresh combat before rolling.",
        });
      }
      if (
        body.effectCutoffInitiativeGroupId !== undefined &&
        body.effectCutoffInitiativeGroupId !== projectedAttackTask?.identity.initiativeGroupId
      ) {
        return reply.code(409).send({
          code: "effect_cutoff_mismatch",
          error:
            "The attack effect cutoff belongs to an older initiative group. Refresh combat before rolling.",
        });
      }
      const existingAttackResult = getCombatRoundAttackResultForOpportunity({
        opportunityId: body.opportunityId,
        state: roundState,
      });

      if (existingAttackResult) {
        return reply.code(409).send({
          error: "Attack already rolled for this participant and phase.",
        });
      }

      const attackerRoundParticipant = roundState.participants.find(
        (participant) => participant.participantId === encounterParticipant.id,
      );
      const declaredOpportunity = getCombatRoundPhaseAttackCandidates({
        phase: body.phase,
        state: roundState,
      }).find(
        (opportunity) =>
          opportunity.participantId === encounterParticipant.id &&
          opportunity.id === body.opportunityId &&
          opportunity.status === "committed",
      );
      const canonicalOpportunityIdentity = declaredOpportunity
        ? getCanonicalAttackOpportunityIdentity({
            actionId: attackerRoundParticipant?.declaration?.actionId,
            attackerParticipantId: encounterParticipant.id,
            opportunity: declaredOpportunity,
            roundNumber: roundState.roundNumber,
          })
        : undefined;
      const canonicalWeaponFacts = declaredOpportunity
        ? resolveCanonicalAttackOpportunityWeaponFacts({
            opportunity: declaredOpportunity,
            participant: scenarioParticipant,
          })
        : undefined;
      if (!declaredOpportunity || !canonicalOpportunityIdentity || !canonicalWeaponFacts) {
        return reply.code(409).send({
          code: "identity_mismatch",
          error: `The ${body.phase === "phase1" ? "Phase 1" : "Phase 2"} attack source or mode is unavailable.`,
        });
      }
      const declaredTargetId =
        (attackerRoundParticipant?.declaration?.actionId === "feint_attack" &&
        body.phase === "phase2"
          ? attackerRoundParticipant.declaration.feint?.targetParticipantId
          : undefined) ??
        declaredOpportunity?.targetParticipantId ??
        attackerRoundParticipant?.declaration?.phaseContexts?.[body.phase]?.targetParticipantId;
      const declaredTargetParticipant = membership.participants.find(
        (participant) =>
          participant.id === declaredTargetId ||
          participant.scenarioParticipantId === declaredTargetId ||
          participant.characterId === declaredTargetId,
      );

      if (
        attackerRoundParticipant?.declaration?.actionId === "feint_attack" &&
        body.phase === "phase2" &&
        !declaredTargetParticipant
      ) {
        return reply.code(409).send({
          error: "The Feint target is no longer in this encounter.",
        });
      }

      if (
        declaredTargetParticipant &&
        declaredTargetParticipant.id !== defenderEncounterParticipant.id
      ) {
        return reply.code(409).send({
          error: "Selected defender does not match the declared attack target.",
        });
      }

      const breakOffConsequence = getCombatBreakOffPairConsequence({
        attackerParticipantId: encounterParticipant.id,
        defenderParticipantId: defenderEncounterParticipant.id,
        state: roundState,
      });
      if (
        breakOffConsequence.disengaged &&
        canonicalOpportunityIdentity.weaponSourceSlot !== "throwing"
      ) {
        return reply.code(409).send({
          code: "combat_pair_disengaged",
          error: "This ordinary direct melee attack is blocked because the pair disengaged.",
        });
      }

      const latestAttackerSnapshot = [...roundState.stepSnapshots]
        .reverse()
        .find(
          (snapshot) =>
            snapshot.roundNumber === roundState.roundNumber &&
            snapshot.participantId === encounterParticipant.id &&
            snapshot.phase === body.phase &&
            snapshot.attackSummary,
        );
      const canonicalModifierFacts = resolveCanonicalCombatAttackModifierFacts({
        attackerCombatantId: encounterParticipant.id,
        attackerScenarioParticipant: scenarioParticipant,
        defenderCombatantId: defenderEncounterParticipant.id,
        defenderScenarioParticipant,
        encounterId,
        opportunityId: canonicalOpportunityIdentity.opportunityId,
        phase: body.phase,
        state: roundState,
      });
      const weaponName = canonicalWeaponFacts.weaponName;
      const canonicalDefense = resolveCanonicalScenarioParticipantDefense({
        defenderResolution: canonicalModifierFacts.defenderResolution,
        flatDbResolution: canonicalModifierFacts.defenderFlatResolution,
        participant: defenderScenarioParticipant,
      });
      const latestDefenderSnapshot =
        canonicalDefense.completeness === "complete"
          ? undefined
          : findLegacyCombatDefenseSnapshot({
              defenderParticipantId: defenderEncounterParticipant.id,
              phase: body.phase,
              state: roundState,
            });
      const defenderFlatDbAdjustment =
        canonicalDefense.completeness === "complete"
          ? canonicalDefense.flatDbAdjustment
          : getMergedCombatDbFlatAdjustmentTotal({
              combatContext: canonicalModifierFacts.defenderCombatContext,
              phase: body.phase,
            });
      const baseDefenderDb =
        canonicalDefense.completeness === "complete"
          ? canonicalDefense.effectiveDb
          : resolveLegacyAttackDefenderDb({
              currentFlatAdjustment: defenderFlatDbAdjustment,
              snapshot: latestDefenderSnapshot,
            });

      const breakOffDefenderTrace =
        baseDefenderDb === undefined || breakOffConsequence.defenderDbParryModifier === 0
          ? undefined
          : calculateWorkbookPercentageAdjustmentTrace({
              baseValue: baseDefenderDb,
              rawModifiers: [
                {
                  label: "Break Off result · DB/Parry",
                  value: breakOffConsequence.defenderDbParryModifier,
                },
              ],
            });
      const defenderDb =
        breakOffConsequence.defenderDbParryModifier === 0
          ? baseDefenderDb
          : breakOffDefenderTrace?.finalValue;

      if (!weaponName || defenderDb === undefined) {
        return reply.code(409).send({
          code: "attack_context_unavailable",
          error: "Required attack context is unavailable. Refresh combat before rolling.",
        });
      }

      const submittedAt = new Date().toISOString();
      const actionId = canonicalOpportunityIdentity.actionId;
      const attackerCombatContext = canonicalModifierFacts.attackerCombatContext;
      const canonicalObSkillResolution = canonicalModifierFacts.attackerResolution;
      const canonicalDefenderDbParryResolution = canonicalModifierFacts.defenderResolution;
      const canonicalObSkillRaw = canonicalObSkillResolution.total;

      const distanceModifierDetail = buildDistanceModifierDetailFromExistingEntry(
        findExistingDistanceModifierEntry({
          combatContext: attackerCombatContext,
          phase: body.phase,
        }) ??
          findExistingDistanceModifierEntryFromSnapshot({
            phase: body.phase,
            snapshot: latestAttackerSnapshot,
          }),
      );
      const canonicalOffense = resolveCanonicalAttackOffense({
        attackerResolution: canonicalModifierFacts.attackerResolution,
        opponentResolution: canonicalModifierFacts.attackerOpponentResolution,
        opportunity: declaredOpportunity,
        participant: scenarioParticipant,
      });
      if (canonicalOffense.completeness !== "complete") {
        return reply.code(409).send({
          code: "attack_context_unavailable",
          error: "Required attack context is unavailable. Refresh combat before rolling.",
        });
      }
      // Canonical pre-opponent OB already contains the committed round modifiers. Observation is
      // opponent-specific, so apply only that direct-action layer here rather than duplicating the
      // whole phase modifier stack.
      const opponentSpecificObModifierRows = [
        ...canonicalModifierFacts.attackerOpponentResolution.rows.map((row) => ({
          label: `${row.label} · ${defenderScenarioParticipant.snapshot.displayName}`,
          sourceId: row.sourceId,
          value: row.value,
        })),
        ...(breakOffConsequence.attackerObModifier === 0
          ? []
          : [
              {
                label: `Break Off result · ${defenderScenarioParticipant.snapshot.displayName}`,
                sourceId: `break-off:${encounterParticipant.id}:${defenderEncounterParticipant.id}`,
                value: breakOffConsequence.attackerObModifier,
              },
            ]),
      ];
      const opponentSpecificObTrace = calculateWorkbookPercentageAdjustmentTrace({
        baseValue: canonicalOffense.preOpponentOb,
        rawModifiers: opponentSpecificObModifierRows.map((row) => ({
          label: row.label,
          value: row.value,
        })),
      });
      if (!opponentSpecificObTrace) {
        return reply.code(409).send({
          code: "attacker_modifier_out_of_range",
          error: "Attack modifiers are outside the canonical calculation table.",
        });
      }
      const roll = rollOpenEndedCombatToHitD20();
      const declaredAttackPhaseDefensivePenalty =
        attackerRoundParticipant?.declaration?.attackPhaseDefensivePenalties?.find(
          (penalty) => penalty.attackOpportunityId === canonicalOpportunityIdentity.opportunityId,
        ) ??
        (attackerRoundParticipant?.declaration
          ? resolveCombatAttackPhaseDefensivePenalty({
              commitment: "committed",
              opportunity: declaredOpportunity,
              participantId: encounterParticipant.id,
              roundNumber: roundState.roundNumber,
            })
          : undefined);
      const defenderCalculation = buildAcceptedCombatDefenseCalculationFact({
        calculation: canonicalDefense,
        cutoffInitiativeGroupId: body.effectCutoffInitiativeGroupId,
        cutoffSequence: getCombatRoundNextEventSequence(roundState),
        defenderResolution: canonicalDefenderDbParryResolution,
        effectiveDb: defenderDb,
        flatResolution: canonicalModifierFacts.defenderFlatResolution,
        legacySnapshot: latestDefenderSnapshot,
      });
      const attackResult = buildCombatRoundAttackRollResult({
        actionId,
        attackPhaseDefensivePenalty: declaredAttackPhaseDefensivePenalty
          ? resolveCombatAttackPhaseDefensivePenalty({
              commitment: "committed",
              executionState: "executed",
              opportunity: declaredOpportunity,
              participantId: encounterParticipant.id,
              reason: "ordinary_committed_attack",
              roundNumber: roundState.roundNumber,
            })
          : undefined,
        attackIndex: canonicalOpportunityIdentity.attackIndex,
        attackModeId: canonicalOpportunityIdentity.attackModeId,
        attackOpportunityId: canonicalOpportunityIdentity.opportunityId,
        attackSlot: declaredOpportunity.slot,
        attackerParticipantId: encounterParticipant.id,
        declarationId: canonicalOpportunityIdentity.declarationId,
        defenderDb,
        defenderParticipantId: defenderEncounterParticipant.id,
        ob: opponentSpecificObTrace.finalValue,
        openEndedD10s: roll.openEndedD10s,
        phase: body.phase,
        rollD20: roll.rollD20,
        rollTotal: roll.rollTotal,
        rolledAt: submittedAt,
        rolledByUserId: user.id,
        weaponArmorClass: canonicalWeaponFacts.weaponArmorClass,
        weaponCriticalCode: canonicalWeaponFacts.weaponCriticalCode,
        weaponDamageClass: canonicalWeaponFacts.weaponDamageClass,
        weaponDmb: canonicalWeaponFacts.weaponDmb,
        weaponInstanceId: canonicalOpportunityIdentity.weaponInstanceId,
        weaponName,
        weaponSourceId: canonicalOpportunityIdentity.weaponSourceId,
        weaponSourceSlot: canonicalOpportunityIdentity.weaponSourceSlot,
        weaponTemplateId: canonicalOpportunityIdentity.weaponTemplateId,
      });
      let nextRoundState = recordCombatRoundAttackResult({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
          facts: {
            defenderCalculation,
            defenderFlatDbAdjustment,
            ...(distanceModifierDetail ? { distanceModifier: distanceModifierDetail } : {}),
            obSkillRaw: canonicalObSkillRaw,
            attackerCalculation: {
              authority: canonicalOffense.authority,
              baseOb: canonicalOffense.baseOb,
              dynamicRawPercentage: canonicalOffense.dynamicRawPercentage,
              effectiveOb: opponentSpecificObTrace.finalValue,
              equipmentLoadoutRevision: canonicalOffense.equipmentLoadoutRevision,
              opponentSpecificRawPercentage:
                canonicalModifierFacts.attackerOpponentResolution.total,
              participantId: canonicalOffense.participantId,
              preOpponentOb: canonicalOffense.preOpponentOb,
              schemaVersion: 1,
              sourceSnapshotId: canonicalOffense.sourceSnapshotId,
            },
            ...(opponentSpecificObModifierRows.length > 0
              ? {
                  obBeforeOpponentSpecificModifier: canonicalOffense.preOpponentOb,
                  opponentSpecificObPercentageAdjustment:
                    opponentSpecificObTrace.percentageAdjustment,
                  opponentSpecificObRaw: canonicalModifierFacts.attackerOpponentResolution.total,
                  opponentSpecificObModifierRows,
                }
              : {}),
          },
        },
        participantId: encounterParticipant.id,
        result: attackResult,
        state: roundState,
        submittedBy: access.mode === "gm" ? "gm" : "player",
      });
      const attackCommand = nextRoundState.commands.at(-1);
      const attackResultId = getCombatRoundAttackResultId({
        result: attackResult,
        roundNumber: nextRoundState.roundNumber,
      });
      const disarmAttempt = nextRoundState.disarmAttempts.find(
        (attempt) =>
          attempt.roundNumber === nextRoundState.roundNumber &&
          attempt.method === "proactive" &&
          attempt.status === "awaiting_contact" &&
          attempt.actingParticipantId === encounterParticipant.id &&
          attempt.resistingParticipantId === defenderEncounterParticipant.id &&
          attempt.phase === body.phase,
      );
      if (disarmAttempt) {
        const activeContinuedContact = nextRoundState.continuedContacts.find(
          (contact) =>
            contact.status === "active" &&
            contact.controllerParticipantId === encounterParticipant.id &&
            contact.affectedParticipantId === defenderEncounterParticipant.id,
        );
        nextRoundState =
          attackResult.hit || activeContinuedContact
            ? openCombatRoundDisarmAfterContact({
                attackResultId,
                attemptId: disarmAttempt.id,
                command: { createdAt: submittedAt, createdByUserId: user.id },
                continuedContactId: activeContinuedContact?.id,
                state: nextRoundState,
              })
            : cancelCombatRoundDisarmWithoutContact({
                attackResultId,
                attemptId: disarmAttempt.id,
                command: { createdAt: submittedAt, createdByUserId: user.id },
                reason: "proactive_attack_missed",
                state: nextRoundState,
              });
      }
      const nextEncounterSession = {
        ...encounter,
        combatRoundState: nextRoundState,
        currentRound: nextRoundState.roundNumber,
        updatedAt: submittedAt,
      };
      const savedEncounter = canonicalWeaponFacts.isThrownAttack
        ? (
            await combatItemInteractionService.commitThrownWeaponAttack({
              actorUserId: user.id,
              campaignId: access.campaignId,
              commandId: attackCommand?.id ?? "",
              encounterId,
              expectedEncounterRevision: encounter.updatedAt,
              itemId: canonicalOpportunityIdentity.weaponInstanceId ?? "",
              ownerCharacterId: scenarioParticipant.characterId ?? "",
              roundNumber: nextRoundState.roundNumber,
              scenarioId,
              session: nextEncounterSession,
              templateId: canonicalOpportunityIdentity.weaponTemplateId,
            })
          ).encounter
        : await encounterService.updateCombatEncounter({
            expectedRevision: encounter.updatedAt,
            campaignId: access.campaignId,
            encounterId,
            scenarioId,
            session: nextEncounterSession,
          });
      const commandEnvelope = buildCombatRoundCommandEnvelope({
        latestResult: {
          attackResultId,
          attackerParticipantId: attackResult.attackerParticipantId,
          defenderParticipantId: attackResult.defenderParticipantId,
          kind: "attack",
          phase: attackResult.phase,
        },
        state: nextRoundState,
      });

      return {
        attackResult,
        command:
          access.mode === "gm" || !attackCommand
            ? attackCommand
            : buildPlayerSafeCombatRoundCommandForUser({
                command: attackCommand,
                ...buildPlayerSafeCombatScopeForUser({
                  encounter: savedEncounter,
                  scenarioParticipants,
                  userId: user.id,
                }),
              }),
        commandEnvelope,
        encounter:
          access.mode === "gm"
            ? savedEncounter
            : buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              }),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll combat attack.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/roll-parry", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatParryBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: body.scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const membership = resolveEncounterParticipantMembership({ encounter, scenarioParticipants });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      if (body.expectedParticipantRevision !== scenarioParticipant.updatedAt) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Defender combat state changed before the Parry was rolled.",
        });
      }

      if (
        access.mode !== "gm" &&
        (scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }))
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter participant.",
        });
      }

      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const attackResult = getCombatRoundAttackResultById({
        attackResultId: body.attackResultId,
        state: roundState,
      });
      if (
        attackResult &&
        (body.attackerParticipantId !== attackResult.attackerParticipantId ||
          body.defenderParticipantId !== attackResult.defenderParticipantId ||
          body.phase !== attackResult.phase ||
          (body.opportunityId !== undefined &&
            body.opportunityId !== attackResult.attackOpportunityId))
      ) {
        return reply.code(409).send({
          code: "stale_opportunity",
          error: "Parry is not open for this attack.",
        });
      }
      const parryAuthorization = authorizeCombatTaskCommand({
        authorization: {
          actor:
            access.mode === "gm"
              ? { kind: "gm" }
              : { kind: "combatant", participantId: encounterParticipant.id },
          attackResultId: body.attackResultId,
          attackerParticipantId: body.attackerParticipantId,
          commandType: "roll_parry",
          declarationId: body.declarationId,
          declaredOpponentParticipantId: body.declaredOpponentParticipantId,
          defenderParticipantId: body.defenderParticipantId,
          disarmAttemptId: body.disarmAttemptId,
          offensiveParryAttemptId: body.offensiveParryAttemptId,
          opportunityId: body.opportunityId,
          parryPurpose: body.parryPurpose,
          parrySourceId: body.parrySourceId,
          participantId: encounterParticipant.id,
          phase: body.phase,
          processId: body.processId,
          stageId: body.stageId,
        },
        encounterRevision: encounter.updatedAt,
        identity: body,
        roundState,
      });
      if (!parryAuthorization.ok) {
        return reply.code(409).send({
          code: parryAuthorization.code,
          error: "Parry is not open for this participant.",
        });
      }
      if (!attackResult) {
        return reply.code(404).send({
          error: "Attack result not found.",
        });
      }

      const attackerEncounterParticipant = membership.participants.find(
        (participant) => participant.id === attackResult.attackerParticipantId,
      );
      const attackerScenarioParticipant = attackerEncounterParticipant?.scenarioParticipantId
        ? scenarioParticipants.find(
            (participant) => participant.id === attackerEncounterParticipant.scenarioParticipantId,
          )
        : undefined;
      const parryDisarmAttempt =
        body.parryPurpose === "parry_disarm" && body.disarmAttemptId
          ? roundState.disarmAttempts.find(
              (attempt) =>
                attempt.id === body.disarmAttemptId &&
                attempt.status === "awaiting_contact" &&
                attempt.method === "reactive_parry",
            )
          : undefined;
      const parryDisarmDeclaration =
        body.parryPurpose === "parry_disarm"
          ? roundState.participants.find(
              (participant) => participant.participantId === encounterParticipant.id,
            )?.declaration?.disarm
          : undefined;
      if (
        body.parryPurpose === "parry_disarm" &&
        (!parryDisarmAttempt ||
          !parryDisarmDeclaration ||
          !attackerScenarioParticipant ||
          body.parrySourceId !== parryDisarmDeclaration.actingWeapon.itemId ||
          parryDisarmAttempt.actingWeaponItemId !== parryDisarmDeclaration.actingWeapon.itemId ||
          parryDisarmAttempt.targetWeaponItemId !== parryDisarmDeclaration.targetWeapon.itemId ||
          !hasExactWieldedWeaponItem({
            expectedRevision: parryDisarmDeclaration.actingWeapon.itemRevision,
            expectedTemplateId: parryDisarmDeclaration.actingWeapon.templateId,
            itemId: parryDisarmDeclaration.actingWeapon.itemId,
            participant: scenarioParticipant,
          }) ||
          !hasExactWieldedWeaponItem({
            expectedRevision: parryDisarmDeclaration.targetWeapon.itemRevision,
            expectedTemplateId: parryDisarmDeclaration.targetWeapon.templateId,
            itemId: parryDisarmDeclaration.targetWeapon.itemId,
            participant: attackerScenarioParticipant,
          }))
      ) {
        return reply.code(409).send({
          code: "parry_context_unavailable",
          error: "The declared Parry-Disarm weapon is no longer ready. Refresh combat.",
        });
      }
      const canonicalModifierFacts = resolveCanonicalCombatParryModifierFacts({
        attackerScenarioParticipant,
        attackResult,
        defenderCombatantId: encounterParticipant.id,
        defenderScenarioParticipant: scenarioParticipant,
        encounterId,
        state: roundState,
      });
      const currentInitiativeGroupId = getCombatRoundCurrentInitiativeExecutionGroup({
        phase: attackResult.phase,
        state: roundState,
      })?.id;
      if (
        body.modifierValidationTaskId !== body.taskId ||
        body.effectCutoffInitiativeGroupId !== currentInitiativeGroupId
      ) {
        return reply.code(409).send({
          code: "parry_modifier_signature_mismatch",
          error: "Parry modifiers changed. Refresh combat before rolling.",
        });
      }

      const rawModifiers = [
        ...(canonicalModifierFacts.defenderResolution.total !== 0
          ? [{ label: "DB/Parry", value: canonicalModifierFacts.defenderResolution.total }]
          : []),
        ...(canonicalModifierFacts.attackResultModifier !== 0
          ? [{ label: "Attack result", value: canonicalModifierFacts.attackResultModifier }]
          : []),
      ];

      const submittedAt = new Date().toISOString();
      const roll = rollOpenEndedD20();
      const canonicalParryBase =
        body.parryPurpose === "parry_disarm" && parryDisarmDeclaration
          ? resolveCanonicalWeaponParryBase({
              expectedItemRevision: parryDisarmDeclaration.actingWeapon.itemRevision,
              expectedTemplateId: parryDisarmDeclaration.actingWeapon.templateId,
              participant: scenarioParticipant,
              weaponItemId: parryDisarmDeclaration.actingWeapon.itemId,
            })
          : resolveCanonicalParryBase({
              participant: scenarioParticipant,
              usedMainHand: body.usedMainHand,
              usedOffHand: body.usedOffHand,
            });
      if (canonicalParryBase.completeness !== "complete") {
        return reply.code(409).send({
          code: "parry_context_unavailable",
          error: "Required Parry context is unavailable. Refresh combat before rolling.",
        });
      }
      const parry = resolveCombatParry({
        parryBase: canonicalParryBase.combinedParryScore,
        rawModifiers,
        rollTotal: roll.dieResult,
      });
      const parryResolution = {
        attackOpportunityId: body.opportunityId,
        attackResultId: body.attackResultId,
        combinedParryScore: parry.parryBase,
        declaredOpponentParticipantId: body.declaredOpponentParticipantId,
        disarmAttemptId: body.disarmAttemptId,
        mainHandParryScore: canonicalParryBase.mainHandParryScore,
        modifiedParryBeforeRoll: parry.parryBase + parry.modifierAdjustment,
        modifierAdjustment: parry.modifierAdjustment,
        modifierBreakdown: parry.rawModifiers.map((modifier) => ({ ...modifier })),
        notes:
          "Direction, location coverage, and multi-opponent source allocation are deferred in this first parry slice.",
        offHandParryScore: canonicalParryBase.offHandParryScore,
        offensiveParryAttemptId: body.offensiveParryAttemptId,
        offensiveParryDeclarationId: body.declarationId,
        openEndedD10s: roll.openEndedD10s,
        parrySourceId: body.parrySourceId,
        parrySourceLabel: canonicalParryBase.parrySourceLabel,
        purpose: body.parryPurpose,
        rawModifierTotal: parry.rawModifierTotal,
        resultLabel: parry.success ? "Parry successful" : "Parry failed",
        rollD20: roll.rollD20,
        rollTotal: roll.dieResult,
        status: "resolved" as const,
        success: parry.success,
        targetNumber: parry.targetNumber,
        total: parry.total,
        usedMainHand: canonicalParryBase.usedMainHand,
        usedOffHand: canonicalParryBase.usedOffHand,
      };
      let nextRoundState = recordCombatRoundParryResult({
        attackResult,
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        parryResolution,
        state: roundState,
        submittedBy: access.mode === "gm" ? "gm" : "player",
        updatedAt: submittedAt,
      });
      const recordedParryCommand = nextRoundState.commands.at(-1);
      const recordedParryResultId =
        typeof recordedParryCommand?.facts.parryResultId === "string"
          ? recordedParryCommand.facts.parryResultId
          : undefined;
      if (body.parryPurpose === "parry_disarm" && body.disarmAttemptId) {
        if (parry.success && recordedParryResultId) {
          nextRoundState = openCombatRoundDisarmAfterContact({
            attackResultId: body.attackResultId,
            attemptId: body.disarmAttemptId,
            command: { createdAt: submittedAt, createdByUserId: user.id },
            contactQualityModifier: resolveCombatDisarmContactQualityModifier(
              parry.total - parry.targetNumber,
            ).modifier,
            parryResultId: recordedParryResultId,
            state: nextRoundState,
          });
        } else {
          nextRoundState = cancelCombatRoundDisarmWithoutContact({
            attackResultId: body.attackResultId,
            attemptId: body.disarmAttemptId,
            command: { createdAt: submittedAt, createdByUserId: user.id },
            reason: "parry_failed",
            state: nextRoundState,
          });
        }
      }
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });
      const parryCommand = recordedParryCommand;
      const parryResultId =
        typeof parryCommand?.facts?.parryResultId === "string"
          ? parryCommand.facts.parryResultId
          : undefined;
      const commandEnvelope = buildCombatRoundCommandEnvelope({
        latestResult: {
          attackResultId: body.attackResultId,
          defenderParticipantId: attackResult.defenderParticipantId,
          kind: "parry",
          parryResultId,
          phase: attackResult.phase,
        },
        state: nextRoundState,
      });

      return {
        command: parryCommand,
        commandEnvelope,
        encounter:
          access.mode === "gm"
            ? savedEncounter
            : buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              }),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll combat parry.",
      });
    }
  });

  app.post(
    "/encounters/:encounterId/combat-round/roll-offensive-parry-brawling",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;

      try {
        const encounterId = parseId(request.params, "encounterId", "Encounter id");
        const encounter = await encounterService.getEncounterById(encounterId);
        if (!encounter?.scenarioId) {
          return reply.code(404).send({ error: "Encounter not found." });
        }
        const scenarioId = encounter.scenarioId;
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access) return reply.code(404).send({ error: "Encounter not found." });

        const body = parseOffensiveParryBrawlingBody(request.body);
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const participantResolution = resolveCombatParticipantForRequest({
          accessMode: access.mode,
          encounter,
          requestedParticipantId: body.scenarioParticipantId,
          scenarioParticipants,
          userId: user.id,
        });
        const roller = participantResolution?.scenarioParticipant;
        const encounterParticipant = participantResolution?.encounterParticipant;
        if (!roller || !roller.isActive || !encounterParticipant) {
          return reply.code(403).send({
            error: "Participant is not assigned to this encounter.",
          });
        }
        if (
          access.mode !== "gm" &&
          (roller.controlledByUserId !== user.id ||
            !isUserAssignedToEncounterMembership({
              encounter,
              scenarioParticipants,
              userId: user.id,
            }))
        ) {
          return reply.code(403).send({
            error: "Player is not assigned to this encounter participant.",
          });
        }

        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const contest = roundState.offensiveParryContests.find(
          (entry) => entry.id === body.contestId,
        );
        if (!contest) {
          return reply.code(404).send({ error: "Offensive Parry contest not found." });
        }
        const authorization = authorizeCombatTaskCommand({
          authorization: {
            actor:
              access.mode === "gm"
                ? { kind: "gm" }
                : { kind: "combatant", participantId: encounterParticipant.id },
            attackResultId: body.attackResultId,
            commandType: "roll_offensive_parry_brawling",
            contestId: body.contestId,
            declarationId: body.declarationId,
            declaredOpponentParticipantId: body.declaredOpponentParticipantId,
            offensiveParryAttemptId: body.offensiveParryAttemptId,
            opponentParticipantId: body.opponentParticipantId,
            opportunityId: body.opportunityId,
            parryResultId: body.parryResultId,
            participantId: encounterParticipant.id,
            phase: body.phase,
            processId: body.processId,
            stageId: body.stageId,
          },
          encounterRevision: encounter.updatedAt,
          identity: body,
          roundState,
        });
        if (!authorization.ok) {
          return reply.code(409).send({ code: authorization.code, error: authorization.message });
        }

        const opponentEncounterParticipant = resolveEncounterParticipantMembership({
          encounter,
          scenarioParticipants,
        }).participants.find((participant) => participant.id === body.opponentParticipantId);
        const opponentScenarioParticipant = opponentEncounterParticipant?.scenarioParticipantId
          ? scenarioParticipants.find(
              (participant) =>
                participant.id === opponentEncounterParticipant.scenarioParticipantId,
            )
          : undefined;
        const initiativeGroup = getCombatRoundCurrentInitiativeExecutionGroup({
          phase: contest.phase,
          state: roundState,
        });
        const modifierProjection = buildLiveCombatModifierContributionProjection({
          combatContext: roller.state.combat.combatContext,
          combatEffects: roller.state.combatEffects,
          currentInitiativeGroupId: initiativeGroup?.id,
          currentRound: roundState.roundNumber,
          encounterId,
          ownerParticipantId: roller.id,
        });
        const parryQualityModifier =
          encounterParticipant.id === contest.controllerParticipantId
            ? contest.parryQualityModifier
            : 0;
        const openEndedRoll = rollOpenEndedD20();
        const calculation = resolveOffensiveParryBrawlingSkillContestCalculation({
          calculationId: `${contest.id}:roll:${encounterParticipant.id}:calculation`,
          encounterId,
          modifierContributions: modifierProjection.contributions,
          opponentCombatantId: body.opponentParticipantId,
          opponentScenarioParticipantId: opponentScenarioParticipant?.id,
          participant: roller,
          participantCombatantId: encounterParticipant.id,
          parryQualityModifier,
          phase: contest.phase,
          purpose: "initial_offensive_parry",
          roll: openEndedRoll,
          roundState,
          side:
            encounterParticipant.id === contest.controllerParticipantId
              ? "controller"
              : "responder",
        });
        const createdAt = new Date().toISOString();
        const roll = {
          brawlingBaseValue: calculation.baseSkill,
          brawlingSkillXp: calculation.skill.totalXp,
          characteristicAverage: calculation.governingStat.value,
          effectiveSkillValue: calculation.preDieTotal,
          finalTotal: calculation.finalResult,
          id: `${contest.id}:roll:${encounterParticipant.id}`,
          generalModifier: calculation.percentageContributions
            .filter((contribution) => contribution.category === "general_fatigue")
            .reduce((total, contribution) => total + contribution.value, 0),
          openEndedD10s: openEndedRoll.openEndedD10s,
          participantId: encounterParticipant.id,
          parryQualityModifier,
          percentageAdjustment: calculation.derivedIntegerAdjustment,
          percentageModifierTotal: calculation.totalPercentageAdjustment,
          pendingModifiers: modifierProjection.pendingModifierEntries.map((entry) => ({
            activationLabel: initiativeGroup
              ? `Effective after Initiative ${initiativeGroup.initiativeValue} finishes`
              : "Effective from the next initiative group",
            label: entry.notes?.trim() || "Combat effect",
            value: entry.value,
          })),
          rollD20: openEndedRoll.rollD20,
          rollPurpose: "offensive_parry_brawling" as const,
          rollTotal: openEndedRoll.dieResult,
          rolledAt: createdAt,
          rolledByUserId: user.id,
          skillId: "brawling" as const,
          skillLabel: "Brawling" as const,
          skillModifier: 0,
          skillContestCalculation: calculation,
        };
        const previousConditionIds = new Set(
          roundState.unbalancedConditions.map((condition) => condition.id),
        );
        const nextRoundState = recordCombatRoundOffensiveParryBrawlingRoll({
          attackResultId: body.attackResultId,
          command: {
            createdAt,
            createdByUserId: user.id,
            createdRevision: encounter.updatedAt,
          },
          contestId: body.contestId,
          declarationId: body.declarationId,
          executionGroupId: body.executionGroupId,
          opportunityId: body.opportunityId,
          opponentParticipantId: body.opponentParticipantId,
          parryResultId: body.parryResultId,
          phase: body.phase,
          roll,
          rollerParticipantId: encounterParticipant.id,
          skillContestCalculation: calculation,
          state: roundState,
          submittedBy: access.mode === "gm" ? "gm" : "player",
        });

        const createdCondition = nextRoundState.unbalancedConditions.find(
          (condition) => !previousConditionIds.has(condition.id) && condition.status === "active",
        );
        let affectedParticipantMutation:
          | { participant: ScenarioParticipant; state: ScenarioParticipant["state"] }
          | undefined;
        if (createdCondition) {
          const affectedEncounterParticipant = resolveEncounterParticipantMembership({
            encounter,
            scenarioParticipants,
          }).participants.find(
            (participant) => participant.id === createdCondition.affectedParticipantId,
          );
          const affectedScenarioParticipant = affectedEncounterParticipant?.scenarioParticipantId
            ? scenarioParticipants.find(
                (participant) =>
                  participant.id === affectedEncounterParticipant.scenarioParticipantId,
              )
            : undefined;
          if (!affectedScenarioParticipant) {
            throw new RangeError("The Unbalanced participant is not assigned to this encounter.");
          }
          const eventId = `${createdCondition.id}:effect-event`;
          const activatesAfterCurrentInitiativeGroup = Boolean(
            initiativeGroup &&
            getCombatRoundCurrentInitiativeExecutionGroup({
              phase: contest.phase,
              state: nextRoundState,
            })?.id === initiativeGroup.id,
          );
          const canonicalUnbalancedProjection =
            projectProcessNumericContributionToCanonicalModifierLifecycle({
              activationCutoff:
                activatesAfterCurrentInitiativeGroup && initiativeGroup
                  ? {
                      afterInitiativeGroupId: initiativeGroup.id,
                      kind: "initiative_group",
                    }
                  : undefined,
              category: "general_fatigue",
              context: {
                createdAt,
                createdRevision: encounter.updatedAt,
                createdSequence: Math.max(
                  0,
                  nextRoundState.events.reduce(
                    (highest, event) => Math.max(highest, event.sequence),
                    -1,
                  ),
                ),
                encounterId,
                visibility: { audience: "involved", sourceIdentity: "public" },
              },
              duration: {
                conditionId: createdCondition.sourceContinuedContactId,
                conditionKind: "contact_ended",
                kind: "until_condition",
                startPhase: contest.phase,
                startRound: roundState.roundNumber,
                startSequence: Math.max(
                  0,
                  nextRoundState.events.reduce(
                    (highest, event) => Math.max(highest, event.sequence),
                    -1,
                  ),
                ),
              },
              effectId: createdCondition.id,
              excludedRollPurposes: ["escape_continued_contact"],
              ownerParticipantId: affectedScenarioParticipant.id,
              processId: createdCondition.sourceContinuedContactId,
              publicLabel: "Unbalanced",
              sourceFamily: "unbalanced",
              state: activatesAfterCurrentInitiativeGroup ? "pending_activation" : "active",
              unit: "percentage",
              value: createdCondition.modifierValue,
            }).effect;
          const combatEffects = combatEffectsStateSchema.parse(
            affectedScenarioParticipant.state.combatEffects,
          );
          affectedParticipantMutation = {
            participant: affectedScenarioParticipant,
            state: {
              ...affectedScenarioParticipant.state,
              combatEffects: combatEffectsStateSchema.parse({
                effects: [
                  ...combatEffects.effects.filter((effect) => effect.id !== createdCondition.id),
                  combatEffectSchema.parse({
                    combatModifierBucket: "general",
                    combatWide: true,
                    canonicalLifecycle: canonicalUnbalancedProjection,
                    createdAt,
                    createdInInitiativeGroupId: initiativeGroup?.id,
                    damage: 0,
                    description: "Unbalanced from Offensive Parry continued contact.",
                    duration: "Until continued contact ends",
                    effectGroup: "general",
                    effectiveAfterInitiativeGroupId: initiativeGroup?.id,
                    excludedRollPurposes: ["escape_continued_contact"],
                    generalDamage: 0,
                    id: createdCondition.id,
                    initiativePhase: initiativeGroup?.phase,
                    initiativeValue: initiativeGroup?.initiativeValue,
                    modifierValue: -2,
                    roundNumber: roundState.roundNumber,
                    sourceEventId: eventId,
                    sourceAttackResultId: contest.attackResultId,
                    sourceOpportunityId: contest.opportunityId,
                    status: activatesAfterCurrentInitiativeGroup ? "pending" : "active",
                    targetParticipantId: affectedScenarioParticipant.id,
                    type: "general_modifier",
                    updatedAt: createdAt,
                  }),
                ],
                events: [
                  ...combatEffects.events.filter((event) => event.id !== eventId),
                  combatEffectEventSchema.parse({
                    createdAt,
                    createdByUserId: user.id,
                    description: "Continued contact left the participant Unbalanced.",
                    encounterId,
                    id: eventId,
                    phase: contest.phase,
                    roundNumber: roundState.roundNumber,
                    scenarioId,
                    sourceActorId: contest.controllerParticipantId,
                    sourceLabel: "Offensive Parry",
                    sourceType: "combat_action",
                    targetParticipantId: affectedScenarioParticipant.id,
                  }),
                ],
              }),
            },
          };
        }

        const saved = affectedParticipantMutation
          ? await encounterService.commitCombatParticipantStateMutation({
              campaignId: access.campaignId,
              encounterId,
              expectedEncounterRevision: encounter.updatedAt,
              participant: affectedParticipantMutation.participant,
              scenarioId,
              session: {
                ...encounter,
                combatRoundState: nextRoundState,
                currentRound: nextRoundState.roundNumber,
                updatedAt: createdAt,
              },
              state: affectedParticipantMutation.state,
            })
          : {
              encounter: await encounterService.updateCombatEncounter({
                expectedRevision: encounter.updatedAt,
                campaignId: access.campaignId,
                encounterId,
                scenarioId,
                session: {
                  ...encounter,
                  combatRoundState: nextRoundState,
                  currentRound: nextRoundState.roundNumber,
                  updatedAt: createdAt,
                },
              }),
              participant: undefined,
            };
        return {
          command: nextRoundState.commands.at(-1),
          encounter:
            access.mode === "gm"
              ? saved.encounter
              : buildPlayerSafeCombatRollMutationEncounterForUser({
                  encounter: saved.encounter,
                  scenarioParticipants,
                  userId: user.id,
                }),
          roll,
        };
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error ? error.message : "Unable to roll Offensive Parry Brawling.",
        });
      }
    },
  );

  app.post("/encounters/:encounterId/combat-round/roll-hit-location", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatAttackerPrivilegedRollBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: body.scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      if (body.expectedRevision !== encounter.updatedAt) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Combat state changed. Review the current action before continuing.",
        });
      }

      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const attackResult = getCombatRoundAttackResultById({
        attackResultId: body.attackResultId,
        state: roundState,
      });

      if (!attackResult) {
        return reply.code(404).send({
          error: "Attack result not found.",
        });
      }

      if (
        body.attackerParticipantId !== attackResult.attackerParticipantId ||
        body.defenderParticipantId !== attackResult.defenderParticipantId ||
        body.phase !== attackResult.phase ||
        body.hitLocationResultId !==
          getCombatRoundHitLocationResultId({
            attackResultId: body.attackResultId,
          })
      ) {
        return reply.code(409).send({
          code: "stale_opportunity",
          error: "Hit location is not open for this attack.",
        });
      }

      if (attackResult.attackerParticipantId !== encounterParticipant.id) {
        return reply.code(403).send({
          error: "Only the attacking participant can roll hit location.",
        });
      }
      const hitLocationAuthorization = authorizeCombatProgressionTask({
        actor:
          access.mode === "gm"
            ? { kind: "gm" }
            : { kind: "combatant", participantId: encounterParticipant.id },
        attackResultId: body.attackResultId,
        attackerParticipantId: body.attackerParticipantId,
        commandType: "roll_hit_location",
        defenderParticipantId: body.defenderParticipantId,
        executionGroupId: body.executionGroupId,
        hitLocationResultId: body.hitLocationResultId,
        opportunityId: body.opportunityId,
        participantId: encounterParticipant.id,
        phase: body.phase,
        projection: buildCombatProgressionProjection(roundState),
        taskId: body.taskId,
      });
      if (!hitLocationAuthorization.ok) {
        return reply.code(409).send({
          code: hitLocationAuthorization.code,
          error: "Hit location is not open for this participant.",
        });
      }

      if (
        access.mode !== "gm" &&
        (scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }))
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter participant.",
        });
      }

      const submittedAt = new Date().toISOString();
      const attackerRoundParticipant = roundState.participants.find(
        (participant) => participant.participantId === attackResult.attackerParticipantId,
      );
      const latestAttackerSnapshot = [...roundState.stepSnapshots]
        .reverse()
        .find(
          (snapshot) =>
            snapshot.roundNumber === roundState.roundNumber &&
            snapshot.participantId === attackResult.attackerParticipantId &&
            snapshot.phase === attackResult.phase &&
            snapshot.attackSummary,
        );
      const latestDefenderSnapshot = [...roundState.stepSnapshots]
        .reverse()
        .find(
          (snapshot) =>
            snapshot.roundNumber === roundState.roundNumber &&
            snapshot.participantId === attackResult.defenderParticipantId &&
            snapshot.phase === attackResult.phase &&
            snapshot.defenseSummary,
        );
      // Snapshot fallback is read compatibility for pre-lineage attacks only. New live results
      // persist the exact opportunity's weapon inputs and never select by participant + phase.
      const dmb =
        attackResult.weaponDmb ??
        parseCombatSummaryInteger(latestAttackerSnapshot?.attackSummary?.dmb, "DMB");
      const defenderDm =
        getAcceptedCombatDefenseDm({
          attackResultId: getCombatRoundAttackResultId({
            result: attackResult,
            roundNumber: roundState.roundNumber,
          }),
          state: roundState,
        }) ?? parseCombatSummaryInteger(latestDefenderSnapshot?.defenseSummary?.dm, "Defender DM");
      const defenderEncounterParticipant = encounter.participants.find((participant) =>
        participantAliasesInclude({ id: attackResult.defenderParticipantId, participant }),
      );
      const defenderScenarioParticipant = findScenarioParticipantForEncounterParticipant({
        encounterParticipant: defenderEncounterParticipant,
        scenarioParticipants,
      });
      const armorCoverage = buildCombatRoundDamageArmorCoverageFromEquipmentState({
        characterId: defenderScenarioParticipant?.characterId,
        equipmentState: defenderScenarioParticipant?.snapshot.equipmentState,
        fallbackTemplatesById: equipmentTemplatesById,
      });
      const weaponArmorClass =
        attackResult.weaponArmorClass ??
        normalizeCombatArmorModifierClass(latestAttackerSnapshot?.attackSummary?.attackMode);
      const damageProposal =
        dmb !== undefined && defenderDm !== undefined
          ? {
              armorCoverage,
              defenderDm,
              dmb,
              weaponArmorClass,
            }
          : undefined;
      const nextRoundState = recordCombatRoundHitLocationRoll({
        attackResult,
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        damageProposal,
        rolledByParticipantId: encounterParticipant.id,
        state: roundState,
        submittedBy: access.mode === "gm" ? "gm" : "player",
        targetLocation:
          attackerRoundParticipant?.declaration?.phaseContexts?.[attackResult.phase]
            ?.targetLocation,
        updatedAt: submittedAt,
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return {
        encounter:
          access.mode === "gm"
            ? savedEncounter
            : buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              }),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll hit location.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/resolve-phase-damage", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId) {
        return reply.code(404).send({ error: "Encounter not found." });
      }
      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access) {
        return reply.code(404).send({ error: "Encounter not found." });
      }
      const body = parseCombatDamageTaskBody(request.body);
      if (body.commandType !== "resolve_damage") {
        return reply.code(409).send({ error: "Damage is not ready to be resolved." });
      }
      if (body.expectedRevision !== encounter.updatedAt) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Combat state changed. Review the current action before continuing.",
        });
      }
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const participantResolution = body.scenarioParticipantId
        ? resolveCombatParticipantForRequest({
            accessMode: access.mode,
            encounter,
            requestedParticipantId: body.scenarioParticipantId,
            scenarioParticipants,
            userId: user.id,
          })
        : undefined;
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const attackResult = getCombatRoundAttackResultById({
        attackResultId: body.attackResultId,
        state: roundState,
      });
      if (!attackResult) {
        return reply.code(404).send({ error: "Attack result not found." });
      }
      if (
        access.mode !== "gm" &&
        (!participantResolution?.scenarioParticipant.isActive ||
          participantResolution.encounterParticipant.id !== attackResult.attackerParticipantId)
      ) {
        return reply.code(403).send({
          error: "Only the attacking participant can roll graze damage.",
        });
      }
      if (
        body.attackerParticipantId !== attackResult.attackerParticipantId ||
        body.defenderParticipantId !== attackResult.defenderParticipantId ||
        body.phase !== attackResult.phase ||
        body.hitLocationResultId !==
          getCombatRoundHitLocationResultId({
            attackResultId: body.attackResultId,
          }) ||
        body.criticalResultId !==
          getCombatRoundCriticalResultId({
            attackResultId: body.attackResultId,
          }) ||
        body.damageReviewId !==
          getCombatRoundDamageReviewId({
            attackResultId: body.attackResultId,
          })
      ) {
        return reply.code(409).send({ error: "The damage review identity is stale." });
      }
      const authorization = authorizeCombatProgressionTask({
        actor:
          access.mode === "gm"
            ? { kind: "gm" }
            : {
                kind: "combatant",
                participantId: participantResolution!.encounterParticipant.id,
              },
        attackResultId: body.attackResultId,
        attackerParticipantId: body.attackerParticipantId,
        commandType: "resolve_damage",
        criticalResultId: body.criticalResultId,
        damageReviewId: body.damageReviewId,
        defenderParticipantId: body.defenderParticipantId,
        executionGroupId: body.executionGroupId,
        hitLocationResultId: body.hitLocationResultId,
        opportunityId: body.opportunityId,
        participantId:
          access.mode === "gm" ? undefined : participantResolution!.encounterParticipant.id,
        phase: body.phase,
        projection: buildCombatProgressionProjection(roundState),
        taskId: body.taskId,
      });
      if (!authorization.ok) {
        return reply.code(409).send({
          code: authorization.code,
          error: "Damage is not open for this attack.",
        });
      }

      const latestAttackerSnapshot = [...roundState.stepSnapshots]
        .reverse()
        .find(
          (snapshot) =>
            snapshot.roundNumber === roundState.roundNumber &&
            snapshot.participantId === attackResult.attackerParticipantId &&
            snapshot.phase === attackResult.phase &&
            snapshot.attackSummary,
        );
      const latestDefenderSnapshot = [...roundState.stepSnapshots]
        .reverse()
        .find(
          (snapshot) =>
            snapshot.roundNumber === roundState.roundNumber &&
            snapshot.participantId === attackResult.defenderParticipantId &&
            snapshot.phase === attackResult.phase &&
            snapshot.defenseSummary,
        );
      // Snapshot fallback is historical compatibility for results recorded before canonical
      // attack-source lineage was persisted.
      const dmb =
        attackResult.weaponDmb ??
        parseCombatSummaryInteger(latestAttackerSnapshot?.attackSummary?.dmb, "DMB");
      const defenderDm =
        getAcceptedCombatDefenseDm({
          attackResultId: getCombatRoundAttackResultId({
            result: attackResult,
            roundNumber: roundState.roundNumber,
          }),
          state: roundState,
        }) ?? parseCombatSummaryInteger(latestDefenderSnapshot?.defenseSummary?.dm, "Defender DM");
      if (dmb === undefined || defenderDm === undefined) {
        return reply.code(409).send({ error: "Canonical damage inputs are not available." });
      }
      if (attackResult.grazing) {
        const canonicalDamageRollExpression = getCombatRoundGrazeDamageRollContext({
          defenderDm,
          dmb,
        }).diceExpression;
        if (body.damageRollExpression !== canonicalDamageRollExpression) {
          return reply.code(409).send({
            error: "The graze damage roll context is stale.",
          });
        }
      }
      const defenderEncounterParticipant = encounter.participants.find((participant) =>
        participantAliasesInclude({ id: attackResult.defenderParticipantId, participant }),
      );
      const defenderScenarioParticipant = findScenarioParticipantForEncounterParticipant({
        encounterParticipant: defenderEncounterParticipant,
        scenarioParticipants,
      });
      const armorCoverage = buildCombatRoundDamageArmorCoverageFromEquipmentState({
        characterId: defenderScenarioParticipant?.characterId,
        equipmentState: defenderScenarioParticipant?.snapshot.equipmentState,
        fallbackTemplatesById: equipmentTemplatesById,
      });
      const submittedAt = new Date().toISOString();
      const nextRoundState = recordCombatRoundDamageResult({
        armorCoverage,
        attackResult,
        command: { createdAt: submittedAt, createdByUserId: user.id },
        defenderDm,
        dmb,
        state: roundState,
        submittedBy: access.mode === "gm" ? "gm" : "player",
        updatedAt: submittedAt,
        weaponArmorClass:
          attackResult.weaponArmorClass ??
          normalizeCombatArmorModifierClass(latestAttackerSnapshot?.attackSummary?.attackMode),
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });
      return {
        commandEnvelope: buildCombatRoundCommandEnvelope({ state: nextRoundState }),
        encounter:
          access.mode === "gm"
            ? savedEncounter
            : buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              }),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to resolve phase damage.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/roll-critical", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatAttackerPrivilegedRollBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const participantResolution = resolveCombatParticipantForRequest({
        accessMode: access.mode,
        encounter,
        requestedParticipantId: body.scenarioParticipantId,
        scenarioParticipants,
        userId: user.id,
      });
      const scenarioParticipant = participantResolution?.scenarioParticipant;
      const encounterParticipant = participantResolution?.encounterParticipant;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      if (body.expectedRevision !== encounter.updatedAt) {
        return reply.code(409).send({
          code: "stale_revision",
          error: "Combat state changed. Review the current action before continuing.",
        });
      }

      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const attackResult = getCombatRoundAttackResultById({
        attackResultId: body.attackResultId,
        state: roundState,
      });

      if (!attackResult) {
        return reply.code(404).send({
          error: "Attack result not found.",
        });
      }

      if (
        body.attackerParticipantId !== attackResult.attackerParticipantId ||
        body.defenderParticipantId !== attackResult.defenderParticipantId ||
        body.phase !== attackResult.phase ||
        body.hitLocationResultId !==
          getCombatRoundHitLocationResultId({
            attackResultId: body.attackResultId,
          }) ||
        body.criticalResultId !==
          getCombatRoundCriticalResultId({
            attackResultId: body.attackResultId,
          })
      ) {
        return reply.code(409).send({
          code: "stale_opportunity",
          error: "Critical roll is not open for this attack.",
        });
      }

      if (attackResult.attackerParticipantId !== encounterParticipant.id) {
        return reply.code(403).send({
          error: "Only the attacking participant can roll the critical die.",
        });
      }

      const criticalAuthorization = authorizeCombatProgressionTask({
        actor:
          access.mode === "gm"
            ? { kind: "gm" }
            : { kind: "combatant", participantId: encounterParticipant.id },
        attackResultId: body.attackResultId,
        attackerParticipantId: body.attackerParticipantId,
        commandType: "roll_critical",
        criticalResultId: body.criticalResultId,
        defenderParticipantId: body.defenderParticipantId,
        executionGroupId: body.executionGroupId,
        hitLocationResultId: body.hitLocationResultId,
        opportunityId: body.opportunityId,
        participantId: encounterParticipant.id,
        phase: body.phase,
        projection: buildCombatProgressionProjection(roundState),
        taskId: body.taskId,
      });
      if (!criticalAuthorization.ok) {
        return reply.code(409).send({
          code: criticalAuthorization.code,
          error: "Critical roll is not open for this participant.",
        });
      }

      if (
        access.mode !== "gm" &&
        (scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }))
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter participant.",
        });
      }

      const submittedAt = new Date().toISOString();
      const nextRoundState = recordCombatRoundCriticalRoll({
        attackResult,
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        rolledByParticipantId: encounterParticipant.id,
        state: roundState,
        submittedBy: access.mode === "gm" ? "gm" : "player",
        updatedAt: submittedAt,
      });
      const savedEncounter = await encounterService.updateCombatEncounter({
        expectedRevision: encounter.updatedAt,
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return {
        encounter:
          access.mode === "gm"
            ? savedEncounter
            : buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              }),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll critical.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/clear-current-step", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(403).send({
          error: "Only GM users can clear combat round steps.",
        });
      }

      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const body =
        request.body && typeof request.body === "object"
          ? (request.body as Record<string, unknown>)
          : {};
      const selectedParticipantId = parseOptionalString(body, "participantId");
      const selectedStepValue = parseOptionalString(body, "step");
      const selectedStep = selectedStepValue
        ? combatRoundStepSchema.parse(selectedStepValue)
        : undefined;
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const stateForClear =
        selectedParticipantId && selectedStep
          ? setCombatRoundSelection({
              participantId: selectedParticipantId,
              state: roundState,
              step: selectedStep,
            })
          : roundState;
      const clearStep = selectedStep ?? stateForClear.currentStep;
      const clearsDeclarationStep = clearStep === "select_actions";

      if (!canClearCombatRoundStep({ state: stateForClear, step: clearStep })) {
        if (
          encounter.combatRoundState &&
          combatRoundStatesDiffer(roundState, encounter.combatRoundState)
        ) {
          const repairedAt = new Date().toISOString();
          const savedEncounter = await encounterService.updateCombatEncounter({
            expectedRevision: encounter.updatedAt,
            campaignId: access.campaignId,
            encounterId,
            scenarioId,
            session: {
              ...encounter,
              combatRoundState: roundState,
              currentRound: roundState.roundNumber,
              updatedAt: repairedAt,
            },
          });

          return { encounter: savedEncounter, participants: [] };
        }

        return { encounter, participants: [] };
      }

      const clearedRoundState =
        selectedParticipantId && selectedStep
          ? clearCombatRoundStep({
              state: stateForClear,
              step: selectedStep,
            })
          : clearCurrentCombatRoundStepAndRewind(roundState);
      const restoredRoundState = initializeMaterializedCombatRoundState({
        encounter: {
          ...encounter,
          combatRoundState: clearedRoundState,
          currentRound: clearedRoundState.roundNumber,
        },
        scenarioParticipants,
      });
      const restoredParticipation = projectActiveCombatParticipation({
        encounterRevision: encounter.updatedAt,
        scenarioParticipants,
        state: restoredRoundState,
      });
      const restoredProjection = buildCombatProgressionProjection(restoredRoundState, {
        participation: restoredParticipation,
      });
      const restoredTask = getCurrentExecutableCombatTasks(restoredProjection)[0];
      const nextRoundState =
        restoredTask && isCompleteDeterministicCombatTask(restoredTask)
          ? holdCombatRoundForGmBacktrack({
              participantId:
                selectedParticipantId ??
                restoredRoundState.currentCursor?.participantId ??
                restoredRoundState.selectedParticipantId,
              state: restoredRoundState,
              step: restoredRoundState.currentStep,
            })
          : restoredRoundState;
      const removedDeclareCommandParticipantIds = new Set(
        roundState.commands
          .filter(
            (command) =>
              command.roundNumber === roundState.roundNumber &&
              command.type === "declare_action" &&
              !nextRoundState.commands.some(
                (remainingCommand) => remainingCommand.id === command.id,
              ),
          )
          .map((command) => command.participantId),
      );
      const removedCommittedDamageCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "commit_phase_damage" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedCombatExperienceCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "roll_combat_experience" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedBackOutPhaseAttackCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          (command.type === "back_out_phase_attack" ||
            (command.type === "submit_phase_initiative_choice" &&
              command.facts.choice === "back_out")) &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedDoubleAttackDecisionCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "decide_double_attack_phase2" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedFeintCommitCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "commit_feint_result" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedAttackCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "roll_attack" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedThrownWeaponAttacks = removedAttackCommands.flatMap((command) => {
        const undo = getCombatThrownWeaponAttackUndo(command);
        return undo ? [{ commandId: command.id, undo }] : [];
      });
      const removedDisarmCommits = roundState.commands
        .filter(
          (command) =>
            command.roundNumber === roundState.roundNumber &&
            command.type === "commit_disarm" &&
            !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
        )
        .flatMap((command) => {
          const undo = getCombatDisarmItemUndo(command);
          return undo ? [{ commandId: command.id, undo }] : [];
        });
      if (removedThrownWeaponAttacks.length > 0 && removedDisarmCommits.length > 0) {
        return reply.code(409).send({
          code: "canonical_item_undo_conflict",
          error:
            "This rewind crosses multiple canonical Item changes. Rewind one action at a time.",
        });
      }
      const removedPhaseInitiativeResolutionCommitCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "commit_phase_initiative_resolution" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedRoundEndParticipantReviewCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "commit_round_end_participant_review" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedRoundEndHealthCheckCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "roll_round_end_health_check" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedOffensiveParryBrawlingCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "roll_offensive_parry_brawling" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedContinuedContactMaintenanceCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "roll_continued_contact_maintenance" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedBreakOffCommitCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "commit_break_off" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const removedModifierReviewCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          (command.type === "review_modifiers_phase1" ||
            command.type === "review_modifiers_phase2") &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const declarationClearEncounterParticipantIds = new Set<string>();

      if (clearsDeclarationStep) {
        if (selectedParticipantId) {
          declarationClearEncounterParticipantIds.add(selectedParticipantId);
        } else {
          for (const participant of membership.participants) {
            declarationClearEncounterParticipantIds.add(participant.id);
          }
        }
      }

      for (const participantId of removedDeclareCommandParticipantIds) {
        declarationClearEncounterParticipantIds.add(participantId);
      }

      const submittedAt = new Date().toISOString();
      const atomicParticipantEffectCommands = [
        ...removedModifierReviewCommands,
        ...removedRoundEndHealthCheckCommands,
        ...removedRoundEndParticipantReviewCommands,
        ...removedContinuedContactMaintenanceCommands.filter(
          (command) => getContinuedContactEffectTransitionFactsList(command).length > 0,
        ),
        ...removedBreakOffCommitCommands.filter(
          (command) => getContinuedContactEffectTransitionFactsList(command).length > 0,
        ),
      ].sort(
        (left, right) =>
          roundState.commands.findIndex((command) => command.id === right.id) -
          roundState.commands.findIndex((command) => command.id === left.id),
      );
      const hasExactContinuedContactEffectRestoration = [
        ...removedContinuedContactMaintenanceCommands,
        ...removedBreakOffCommitCommands,
      ].some((command) => getContinuedContactEffectTransitionFactsList(command).length > 0);
      if (atomicParticipantEffectCommands.length > 0) {
        const restorationStates = new Map(
          scenarioParticipants.map((participant) => [participant.id, participant.state]),
        );
        let completeAtomicRestoration = true;
        for (const command of atomicParticipantEffectCommands) {
          const continuedContactEffectTransitions =
            getContinuedContactEffectTransitionFactsList(command);
          if (continuedContactEffectTransitions.length > 0) {
            for (const transition of continuedContactEffectTransitions) {
              const scenarioParticipant = scenarioParticipants.find(
                (participant) => participant.id === transition.scenarioParticipantId,
              );
              if (!scenarioParticipant) {
                completeAtomicRestoration = false;
                break;
              }
              const currentState = restorationStates.get(scenarioParticipant.id)!;
              const effects = combatEffectsStateSchema.parse(currentState.combatEffects);
              const currentEffect = effects.effects.find(
                (effect) => effect.id === transition.nextEffect.id,
              );
              if (
                !currentEffect ||
                JSON.stringify(currentEffect) !== JSON.stringify(transition.nextEffect)
              ) {
                completeAtomicRestoration = false;
                break;
              }
              restorationStates.set(scenarioParticipant.id, {
                ...currentState,
                combatEffects: combatEffectsStateSchema.parse({
                  ...effects,
                  effects: effects.effects.map((effect) =>
                    effect.id === transition.nextEffect.id ? transition.previousEffect : effect,
                  ),
                }),
              });
            }
            if (!completeAtomicRestoration) break;
            continue;
          }
          const encounterParticipant = membership.participants.find(
            (participant) => participant.id === command.participantId,
          );
          const scenarioParticipant = encounterParticipant
            ? scenarioParticipants.find(
                (participant) => participant.id === encounterParticipant.scenarioParticipantId,
              )
            : undefined;
          if (!scenarioParticipant) {
            completeAtomicRestoration = false;
            break;
          }
          const currentState = restorationStates.get(scenarioParticipant.id)!;
          if (
            command.type === "review_modifiers_phase1" ||
            command.type === "review_modifiers_phase2"
          ) {
            const undoFacts =
              command.facts.modifierReviewUndo &&
              typeof command.facts.modifierReviewUndo === "object" &&
              !Array.isArray(command.facts.modifierReviewUndo)
                ? (command.facts.modifierReviewUndo as Record<string, unknown>)
                : undefined;
            const priorCombatContext = scenarioParticipantCombatContextSchema.safeParse(
              undoFacts?.combatContext,
            );
            const priorCombatEffects = combatEffectsStateSchema.safeParse(undoFacts?.combatEffects);
            if (!priorCombatContext.success || !priorCombatEffects.success) {
              completeAtomicRestoration = false;
              break;
            }
            restorationStates.set(scenarioParticipant.id, {
              ...currentState,
              combat: { ...currentState.combat, combatContext: priorCombatContext.data },
              combatEffects: priorCombatEffects.data,
            });
          } else if (command.type === "commit_round_end_participant_review") {
            restorationStates.set(scenarioParticipant.id, {
              ...currentState,
              combatEffects: removeCombatRoundEndParticipantReviewEffects({
                combatEffects: currentState.combatEffects,
                command,
              }),
            });
          } else {
            restorationStates.set(scenarioParticipant.id, {
              ...currentState,
              combatEffects: removeCombatRoundEndHealthCheckEffects({
                combatEffects: currentState.combatEffects,
                command,
              }),
            });
          }
        }
        if (completeAtomicRestoration) {
          const affectedParticipantIds = new Set(
            atomicParticipantEffectCommands.flatMap((command) => {
              const transitions = getContinuedContactEffectTransitionFactsList(command);
              if (transitions.length > 0) {
                return transitions.map((transition) => transition.scenarioParticipantId);
              }
              const encounterParticipant = membership.participants.find(
                (participant) => participant.id === command.participantId,
              );
              return encounterParticipant ? [encounterParticipant.scenarioParticipantId] : [];
            }),
          );
          const restorations = scenarioParticipants
            .filter((participant) => affectedParticipantIds.has(participant.id))
            .map((participant) => ({
              participant,
              state: restorationStates.get(participant.id)!,
            }));
          const session = {
            ...encounter,
            combatRoundState: nextRoundState,
            currentRound: nextRoundState.roundNumber,
            updatedAt: submittedAt,
          };
          const saved =
            removedThrownWeaponAttacks.length > 0 || removedDisarmCommits.length > 0
              ? await (async () => {
                  const savedEncounter = await (removedDisarmCommits.length > 0
                    ? combatItemInteractionService.commitDisarmUndo({
                        actorUserId: user.id,
                        campaignId: access.campaignId,
                        encounterId,
                        expectedEncounterRevision: encounter.updatedAt,
                        participantStateUpdates: restorations.map(({ participant, state }) => ({
                          expectedRevision: participant.updatedAt,
                          participantId: participant.id,
                          scenarioId,
                          state: refreshScenarioParticipantPersistentCombatModifiers({ state }),
                        })),
                        scenarioId,
                        session,
                        undos: removedDisarmCommits,
                      })
                    : combatItemInteractionService.commitThrownWeaponAttackUndo({
                        actorUserId: user.id,
                        campaignId: access.campaignId,
                        encounterId,
                        expectedEncounterRevision: encounter.updatedAt,
                        participantStateUpdates: restorations.map(({ participant, state }) => ({
                          expectedRevision: participant.updatedAt,
                          participantId: participant.id,
                          scenarioId,
                          state: refreshScenarioParticipantPersistentCombatModifiers({ state }),
                        })),
                        scenarioId,
                        session,
                        undos: removedThrownWeaponAttacks,
                      }));
                  const refreshed = await scenarioService.listScenarioParticipants(scenarioId);
                  const changedIds = new Set(restorations.map(({ participant }) => participant.id));
                  return {
                    encounter: savedEncounter,
                    participants: refreshed.filter((participant) => changedIds.has(participant.id)),
                  };
                })()
              : await encounterService.commitCombatParticipantStateMutations({
                  campaignId: access.campaignId,
                  encounterId,
                  expectedEncounterRevision: encounter.updatedAt,
                  participants: restorations,
                  scenarioId,
                  session,
                });
          return saved;
        }
        if (hasExactContinuedContactEffectRestoration) {
          throw new RangeError(
            "Continued Contact effect state changed before exact undo could be applied.",
          );
        }
      }
      const participantMutations =
        declarationClearEncounterParticipantIds.size > 0 ||
        removedCombatExperienceCommands.length > 0 ||
        removedBackOutPhaseAttackCommands.length > 0 ||
        removedDoubleAttackDecisionCommands.length > 0 ||
        removedFeintCommitCommands.length > 0 ||
        removedAttackCommands.length > 0 ||
        removedPhaseInitiativeResolutionCommitCommands.length > 0 ||
        removedCommittedDamageCommands.length > 0 ||
        removedRoundEndParticipantReviewCommands.length > 0 ||
        removedRoundEndHealthCheckCommands.length > 0 ||
        removedOffensiveParryBrawlingCommands.length > 0 ||
        removedContinuedContactMaintenanceCommands.length > 0 ||
        removedBreakOffCommitCommands.length > 0
          ? scenarioParticipants.flatMap((participant) => {
              const encounterParticipant = membership.participants.find(
                (entry) => entry.scenarioParticipantId === participant.id,
              );

              if (!encounterParticipant) {
                return [];
              }

              let nextState = participant.state;

              if (declarationClearEncounterParticipantIds.has(encounterParticipant.id)) {
                const restoredDeclaration = nextRoundState.participants.find(
                  (entry) => entry.participantId === encounterParticipant.id,
                )?.declaration;
                nextState = restoredDeclaration
                  ? {
                      ...nextState,
                      combat: {
                        ...nextState.combat,
                        combatContext:
                          restoredDeclaration.combatContext ?? nextState.combat.combatContext,
                        lastDeclaredActionId: restoredDeclaration.actionId,
                        lastDeclaredEncounterId: encounter.id,
                        lastDeclaredMovementId: restoredDeclaration.movementId,
                        lastDeclaredRoundNumber: restoredDeclaration.roundNumber,
                        lastDeclaredSecondaryActionId: restoredDeclaration.secondaryActionId,
                        lastDeclarationNotes: restoredDeclaration.additionalActionNotes,
                        lastMovementIntent: restoredDeclaration.movementIntent,
                      },
                    }
                  : clearScenarioParticipantCombatDeclaration({
                      ...participant,
                      state: nextState,
                    });
              }

              for (const command of removedCombatExperienceCommands) {
                if (command.participantId !== encounterParticipant.id) {
                  continue;
                }

                nextState = {
                  ...nextState,
                  combat: {
                    ...nextState.combat,
                    combatContext: removeCombatRoundCombatExperienceCombatContextModifiers({
                      combatContext: nextState.combat.combatContext,
                      command,
                    }),
                  },
                  combatEffects: removeCombatRoundCombatExperienceEffects({
                    combatEffects: nextState.combatEffects,
                    command,
                  }),
                };
              }

              for (const command of removedBackOutPhaseAttackCommands) {
                if (command.participantId !== encounterParticipant.id) {
                  continue;
                }

                nextState = {
                  ...nextState,
                  combat: {
                    ...nextState.combat,
                    combatContext: restoreCombatRoundBackOutCombatContextModifiers({
                      combatContext: nextState.combat.combatContext,
                      command,
                    }),
                  },
                };
              }

              for (const command of removedDoubleAttackDecisionCommands) {
                if (command.participantId !== encounterParticipant.id) continue;
                const restoredContext = nextRoundState.participants.find(
                  (entry) => entry.participantId === encounterParticipant.id,
                )?.declaration?.combatContext;
                if (restoredContext) {
                  nextState = {
                    ...nextState,
                    combat: { ...nextState.combat, combatContext: restoredContext },
                  };
                }
              }

              for (const command of removedFeintCommitCommands) {
                const proposalId =
                  typeof command.facts.proposalId === "string"
                    ? command.facts.proposalId
                    : undefined;
                const previousProposal = proposalId
                  ? roundState.feintProposals.find((proposal) => proposal.id === proposalId)
                  : undefined;
                if (
                  !previousProposal ||
                  (previousProposal.attackerParticipantId !== encounterParticipant.id &&
                    previousProposal.defenderParticipantId !== encounterParticipant.id)
                ) {
                  continue;
                }
                const restoredContext = nextRoundState.participants.find(
                  (entry) => entry.participantId === encounterParticipant.id,
                )?.declaration?.combatContext;
                if (restoredContext) {
                  nextState = {
                    ...nextState,
                    combat: { ...nextState.combat, combatContext: restoredContext },
                  };
                }
              }

              for (const command of removedAttackCommands) {
                if (command.participantId !== encounterParticipant.id) {
                  continue;
                }

                nextState = {
                  ...nextState,
                  combat: {
                    ...nextState.combat,
                    combatContext: removeDistanceGeneratedObSkillModifiers({
                      combatContext: nextState.combat.combatContext,
                      command,
                    }),
                  },
                };
              }

              for (const command of removedPhaseInitiativeResolutionCommitCommands) {
                nextState = {
                  ...nextState,
                  combat: {
                    ...nextState.combat,
                    combatContext:
                      restoreCombatRoundPhaseInitiativeResolutionCombatContextModifiers({
                        combatContext: nextState.combat.combatContext,
                        command,
                        participantId: encounterParticipant.id,
                      }),
                  },
                };
              }

              for (const command of removedCommittedDamageCommands) {
                if (command.participantId !== encounterParticipant.id) {
                  continue;
                }

                nextState = {
                  ...nextState,
                  combatEffects: removeCombatRoundCommittedDamageEffects({
                    combatEffects: nextState.combatEffects,
                    command,
                  }),
                };
              }

              for (const command of removedRoundEndParticipantReviewCommands) {
                if (command.participantId !== encounterParticipant.id) {
                  continue;
                }

                nextState = {
                  ...nextState,
                  combatEffects: removeCombatRoundEndParticipantReviewEffects({
                    combatEffects: nextState.combatEffects,
                    command,
                  }),
                };
              }

              for (const command of removedRoundEndHealthCheckCommands) {
                if (command.participantId !== encounterParticipant.id) {
                  continue;
                }

                nextState = {
                  ...nextState,
                  combatEffects: removeCombatRoundEndHealthCheckEffects({
                    combatEffects: nextState.combatEffects,
                    command,
                  }),
                };
              }

              for (const command of removedOffensiveParryBrawlingCommands) {
                const conditionId =
                  typeof command.facts.createdUnbalancedConditionId === "string"
                    ? command.facts.createdUnbalancedConditionId
                    : undefined;
                if (!conditionId) continue;
                const effects = combatEffectsStateSchema.parse(nextState.combatEffects);
                nextState = {
                  ...nextState,
                  combatEffects: combatEffectsStateSchema.parse({
                    effects: effects.effects.filter((effect) => effect.id !== conditionId),
                    events: effects.events.filter(
                      (event) => event.id !== `${conditionId}:effect-event`,
                    ),
                  }),
                };
              }

              for (const command of removedContinuedContactMaintenanceCommands) {
                if (command.facts.resolved !== true || command.facts.contactMaintained !== false) {
                  continue;
                }
                const conditionId =
                  typeof command.facts.unbalancedConditionId === "string"
                    ? command.facts.unbalancedConditionId
                    : undefined;
                if (!conditionId) continue;
                const effects = combatEffectsStateSchema.parse(nextState.combatEffects);
                if (!effects.effects.some((effect) => effect.id === conditionId)) continue;
                nextState = {
                  ...nextState,
                  combatEffects: combatEffectsStateSchema.parse({
                    ...effects,
                    effects: effects.effects.map((effect) =>
                      effect.id === conditionId
                        ? combatEffectSchema.parse({
                            ...effect,
                            status: "active",
                            updatedAt: submittedAt,
                          })
                        : effect,
                    ),
                  }),
                };
              }

              return nextState === participant.state ? [] : [{ participant, state: nextState }];
            })
          : [];

      const nextEncounterSession = {
        ...encounter,
        combatRoundState: nextRoundState,
        currentRound: nextRoundState.roundNumber,
        updatedAt: submittedAt,
      };
      const saved =
        removedThrownWeaponAttacks.length > 0 || removedDisarmCommits.length > 0
          ? await (async () => {
              const savedEncounter = await (removedDisarmCommits.length > 0
                ? combatItemInteractionService.commitDisarmUndo({
                    actorUserId: user.id,
                    campaignId: access.campaignId,
                    encounterId,
                    expectedEncounterRevision: encounter.updatedAt,
                    participantStateUpdates: participantMutations.map(({ participant, state }) => ({
                      expectedRevision: participant.updatedAt,
                      participantId: participant.id,
                      scenarioId,
                      state: refreshScenarioParticipantPersistentCombatModifiers({ state }),
                    })),
                    scenarioId,
                    session: nextEncounterSession,
                    undos: removedDisarmCommits,
                  })
                : combatItemInteractionService.commitThrownWeaponAttackUndo({
                    actorUserId: user.id,
                    campaignId: access.campaignId,
                    encounterId,
                    expectedEncounterRevision: encounter.updatedAt,
                    participantStateUpdates: participantMutations.map(({ participant, state }) => ({
                      expectedRevision: participant.updatedAt,
                      participantId: participant.id,
                      scenarioId,
                      state: refreshScenarioParticipantPersistentCombatModifiers({ state }),
                    })),
                    scenarioId,
                    session: nextEncounterSession,
                    undos: removedThrownWeaponAttacks,
                  }));
              const refreshed = await scenarioService.listScenarioParticipants(scenarioId);
              const changedIds = new Set(
                participantMutations.map(({ participant }) => participant.id),
              );
              return {
                encounter: savedEncounter,
                participants: refreshed.filter((participant) => changedIds.has(participant.id)),
              };
            })()
          : participantMutations.length > 0
            ? await encounterService.commitCombatParticipantStateMutations({
                campaignId: access.campaignId,
                encounterId,
                expectedEncounterRevision: encounter.updatedAt,
                participants: participantMutations,
                scenarioId,
                session: nextEncounterSession,
              })
            : {
                encounter: await encounterService.updateCombatEncounter({
                  expectedRevision: encounter.updatedAt,
                  campaignId: access.campaignId,
                  encounterId,
                  scenarioId,
                  session: nextEncounterSession,
                }),
                participants: [] as ScenarioParticipant[],
              };

      return saved;
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to clear combat round step.",
      });
    }
  });

  app.post("/encounters/:encounterId/roleplay/stat-checks", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId || encounter.kind !== "roleplay") {
        return reply.code(404).send({ error: "Roleplaying encounter not found." });
      }

      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        {
          scenarioId: encounter.scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({ error: "Roleplaying encounter not found." });
      }

      const body = parseRoleplayStatCheckAssignmentBody(request.body);

      if (body.expectedRevision !== encounter.updatedAt) {
        return reply.code(409).send({
          error:
            "The encounter changed before this Stat check was assigned. Refresh and review it.",
        });
      }

      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const participant = resolveEncounterParticipantByRollParticipantId({
        participantId: body.participantId,
        participants: membership.participants,
      });
      const scenarioParticipant = participant?.scenarioParticipantId
        ? scenarioParticipants.find((entry) => entry.id === participant.scenarioParticipantId)
        : undefined;

      if (!participant || !scenarioParticipant?.isActive) {
        return reply.code(400).send({
          error: "Choose an active participant assigned to this encounter.",
        });
      }

      const statProfile = resolveParticipantStatRollProfile({
        participantId: participant.id,
        participantName: participant.label,
        snapshot: scenarioParticipant.snapshot,
        statId: body.statId,
      });

      if (statProfile.statValue == null) {
        return reply.code(400).send({
          error: statProfile.warning ?? "The selected Stat is not available for this participant.",
        });
      }

      const nextEncounter = assignRoleplayStatCheck({
        difficulty: body.difficulty,
        participantId: participant.id,
        participantName: participant.label,
        session: encounter,
        statId: statProfile.statId,
        statLabel: statProfile.statLabel,
        statValue: statProfile.statValue,
      });
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        expectedRevision: body.expectedRevision,
        scenarioId: encounter.scenarioId,
        session: {
          ...nextEncounter,
          updatedAt: new Date().toISOString(),
        },
      });

      await scenarioService.recordScenarioEvent({
        actorUserId: user.id,
        eventType: "encounter_updated",
        payload: {
          encounterId,
          participantId: participant.id,
          statId: statProfile.statId,
        },
        scenarioId: encounter.scenarioId,
        summary: `Assigned ${statProfile.statLabel} Stat check to ${participant.label}.`,
      });

      return { encounter: savedEncounter };
    } catch (error) {
      const conflictResponse = sendRoleplayStatWriteError(reply, error);
      if (conflictResponse) {
        return conflictResponse;
      }
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to assign Stat check.",
      });
    }
  });

  app.post("/encounters/:encounterId/player-roll", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId: encounter.scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parsePlayerRollBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const state = normalizeRoleplayState(encounter);
      const pendingSkillRoll = state.pendingSkillRolls.find(
        (roll) => roll.id === body.pendingRollId,
      );
      const pendingStatCheck = state.pendingStatChecks.find(
        (check) => check.id === body.pendingRollId,
      );

      if ((!pendingSkillRoll && !pendingStatCheck) || pendingSkillRoll?.silent) {
        return reply.code(403).send({
          error: "Roll is not available to this player.",
        });
      }

      if (pendingStatCheck && body.expectedRevision !== encounter.updatedAt) {
        return reply.code(409).send({
          error: "This Stat check changed before the result was accepted. Refresh and review it.",
        });
      }

      const pendingRollSide = pendingSkillRoll
        ? (pendingSkillRoll.side ?? (pendingSkillRoll.mode === "opposed" ? "actor" : undefined))
        : undefined;
      const existingResult = state.actionLog.find((entry) => {
        if (pendingStatCheck) {
          return entry.type === "stat_check_result" && entry.pendingRollId === pendingStatCheck.id;
        }

        return (
          pendingSkillRoll != null &&
          entry.type === "gm_skill_roll" &&
          !entry.silent &&
          ((entry.pendingRollId && entry.pendingRollId === pendingSkillRoll.id) ||
            (pendingSkillRoll.rollSetId &&
              entry.rollSetId === pendingSkillRoll.rollSetId &&
              (pendingRollSide ? entry.side === pendingRollSide : true) &&
              entry.participantId === pendingSkillRoll.participantId &&
              entry.skillId === pendingSkillRoll.skillId))
        );
      });

      if (existingResult) {
        return reply.code(409).send({
          error: "Roll has already been submitted.",
        });
      }

      const gmAuthorizedOperation = access.mode === "gm";

      if (
        !gmAuthorizedOperation &&
        !isUserAssignedToEncounterMembership({
          encounter,
          scenarioParticipants,
          userId: user.id,
        })
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter.",
        });
      }

      const assignedParticipantId =
        pendingStatCheck?.participantId ?? pendingSkillRoll!.participantId;
      const participant = resolveEncounterParticipantByRollParticipantId({
        participantId: assignedParticipantId,
        participants: membership.participants,
      });
      const scenarioParticipant = participant?.scenarioParticipantId
        ? scenarioParticipants.find((entry) => entry.id === participant.scenarioParticipantId)
        : undefined;

      if (
        !participant ||
        !scenarioParticipant ||
        (!gmAuthorizedOperation && scenarioParticipant.controlledByUserId !== user.id) ||
        !scenarioParticipant.isActive
      ) {
        return reply.code(403).send({
          error: "Roll is not assigned to this player.",
        });
      }

      let nextEncounter: EncounterSession;

      if (pendingStatCheck) {
        const preview = buildRoleplayCalculationPreview({
          difficulty: pendingStatCheck.difficulty,
          kind: "stat",
          roll: body.roll,
          skillLabel: pendingStatCheck.statLabel,
          skillValue: pendingStatCheck.statValue,
        });

        if (body.acceptAutomaticSuccess && !preview.autoSuccess) {
          return reply.code(400).send({
            error: "This Stat check requires a roll.",
          });
        }
        if (!body.acceptAutomaticSuccess && !body.roll) {
          return reply.code(400).send({ error: "Roll the Stat check before submitting it." });
        }

        nextEncounter = recordRoleplayStatCheckResult({
          achievedSuccessLevel: preview.achievedSuccessLevel,
          autoSuccess: preview.autoSuccess,
          calculationText: preview.calculationText,
          difficulty: pendingStatCheck.difficulty,
          finalTotal: preview.finalTotal,
          fumble: preview.fumble,
          numericSubtotal: preview.numericSubtotal,
          participantId: participant.id,
          participantName: participant.label,
          pendingRollId: pendingStatCheck.id,
          roll: body.roll,
          session: encounter,
          statId: pendingStatCheck.statId,
          statLabel: pendingStatCheck.statLabel,
          statValue: pendingStatCheck.statValue,
          success: preview.autoSuccess ? true : preview.success,
        });
      } else {
        const pendingRoll = pendingSkillRoll!;

        if (!body.roll) {
          return reply.code(400).send({ error: "Roll is required." });
        }

        const modifierPipeline = resolveRoleplaySkillRollModifiers({
          modifiers:
            pendingRoll.otherMod === 0
              ? []
              : [
                  {
                    bucket: "other",
                    label: "Other",
                    source: "manual",
                    value: pendingRoll.otherMod,
                  },
                ],
          skillTotal: pendingRoll.skillValue ?? 0,
        });
        const preview = buildRoleplayCalculationPreview({
          difficulty: pendingRoll.mode === "difficulty" ? pendingRoll.difficulty : undefined,
          modifierPipeline,
          otherMod: pendingRoll.otherMod,
          roll: body.roll,
          skillLabel: pendingRoll.skillLabel,
          skillValue: pendingRoll.skillValue,
          useDbMod: pendingRoll.useDbMod,
          useGenMod: pendingRoll.useGenMod,
          useObSkillMod: pendingRoll.useObSkillMod,
        });
        const supportPreview =
          pendingRoll.supportSkillId && body.supportRoll
            ? buildRoleplayCalculationPreview({
                roll: body.supportRoll,
                skillLabel: pendingRoll.supportSkillLabel ?? "Support",
                skillValue: pendingRoll.supportSkillValue,
              })
            : undefined;
        nextEncounter = recordRoleplayGmSkillRoll({
          achievedSuccessLevel: preview.achievedSuccessLevel,
          autoSuccess: preview.autoSuccess,
          calculationText: preview.calculationText,
          dieResult: body.roll.dieResult,
          difficulty: pendingRoll.mode === "difficulty" ? pendingRoll.difficulty : undefined,
          finalTotal: preview.finalTotal,
          fumble: preview.fumble,
          mode: pendingRoll.mode,
          numericSubtotal: preview.numericSubtotal,
          openEndedD10s: body.roll.openEndedD10s,
          otherMod: pendingRoll.otherMod,
          participantId: participant.id,
          participantName: participant.label,
          partial: preview.partial,
          pendingRollId: pendingRoll.id,
          roll: body.roll,
          rollSetId: pendingRoll.rollSetId,
          session: encounter,
          side: pendingRollSide,
          silent: false,
          skillId: pendingRoll.skillId,
          skillLabel: pendingRoll.skillLabel,
          skillValue: pendingRoll.skillValue,
          success: preview.success,
          summary: `${participant.label} rolled ${pendingRoll.skillLabel}.`,
          supportCalculationText: supportPreview?.calculationText,
          supportNumericSubtotal: supportPreview?.numericSubtotal,
          supportRoll: body.supportRoll,
          supportSkillId: pendingRoll.supportSkillId,
          supportSkillLabel: pendingRoll.supportSkillLabel,
          supportSkillValue: pendingRoll.supportSkillValue,
          useDbMod: pendingRoll.useDbMod,
          useGenMod: pendingRoll.useGenMod,
          useObSkillMod: pendingRoll.useObSkillMod,
        });
      }
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: encounter.campaignId,
        encounterId,
        expectedRevision: pendingStatCheck ? body.expectedRevision : undefined,
        scenarioId: encounter.scenarioId,
        session: {
          ...nextEncounter,
          updatedAt: new Date().toISOString(),
        },
      });

      return {
        encounter: gmAuthorizedOperation
          ? savedEncounter
          : buildPlayerSafeEncounterForUser({
              encounter: savedEncounter,
              scenarioParticipants,
              userId: user.id,
            }),
      };
    } catch (error) {
      const conflictResponse = sendRoleplayStatWriteError(reply, error);
      if (conflictResponse) {
        return conflictResponse;
      }
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to submit player roll.",
      });
    }
  });
};
