import type { FastifyPluginAsync } from "fastify";

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
  EncounterService,
  ScenarioService,
} from "@glantri/database";
import {
  buildPlayerSafeRoleplayStateForUser,
  applyCommittedCombatFeintModifiers,
  applyCombatActionGeneratedModifiers,
  advanceCombatProgressionBoundary,
  authorizeCombatProgressionTask,
  backOutCombatRoundPhaseAttack,
  buildCombatRoundCommandEnvelope,
  buildCombatRoundAttackRollResult,
  buildCombatProgressionProjection,
  buildCombatRoundDeclaredAttackOpportunities,
  buildCombatRoundDamageArmorCoverageFromEquipmentState,
  buildCombatRoundInitiativeResult,
  buildReactiveAttackPhase2InitiativeModifierEntry,
  COMBAT_PROGRESSION_BOUNDARIES,
  CombatProgressionBoundaryAdvanceError,
  canClearCombatRoundStep,
  canPlayerRollCombatInitiative,
  buildRoleplayCalculationPreview,
  commitCombatRoundPhaseInitiativeResolution,
  commitCombatRoundEndDistanceControl,
  commitCombatRoundEndParticipantReview,
  commitCombatRoundPhaseDamage,
  continueCombatRoundPhaseAttack,
  decideCombatRoundDoubleAttackPhase2,
  canRepeatWeaponAttackInRound,
  canPlayerSubmitCombatDeclaration,
  characterBuildSchema,
  clearCombatRoundStep,
  clearCurrentCombatRoundStepAndRewind,
  combatRoundPhaseSchema,
  combatEffectEventSchema,
  combatEffectSchema,
  combatEffectsStateSchema,
  combatAttackSourceRefSchema,
  combatDistanceSchema,
  combatRoundStepSchema,
  combatRoundStepSnapshotSchema,
  encounterParticipantMembershipModeSchema,
  encounterSessionSchema,
  encounterStatusSchema,
  ensureDistanceEdgesForParticipantPairs,
  ensureCombatRoundEndReviewPrepared,
  expireCombatFeintGeneratedModifiersBeforeRound,
  expireAdjustDistanceAttackGeneratedModifiersBeforeRound,
  fingerprintCombatModifierResolution,
  getCombatRoundInitiativePhaseForStep,
  getCombatRoundCurrentInitiativeExecutionGroup,
  buildLiveCombatModifierContributionProjection,
  createCombatParticipantPairKey,
  getMergedCombatDbFlatAdjustmentTotal,
  getCombatRoundParryReviewStepForPhase,
  getCombatRoundAttackResultById,
  getCombatRoundAttackResultForOpportunity,
  getCombatRoundAttackResultId,
  getCombatRoundCriticalResultId,
  getCanonicalAttackOpportunityIdentity,
  getCombatRoundDamageReviewId,
  getCombatRoundGrazeDamageRollContext,
  getCombatRoundCombatExperienceDifficulty,
  getCombatDistanceParticipantAliases,
  getDistanceEdgeBetweenParticipantAliases,
  getCombatDeclarationAttackPhases,
  getCombatRoundDistanceEdge,
  getCombatRoundEndDistanceProposalLifecycle,
  getCombatRoundRequiredCombatExperienceTrigger,
  getCombatRoundHitLocationResultId,
  getSingleAttackDeclaredDistanceForPenalty,
  getCombatRoundPhaseAttackCandidates,
  getParticipantCombatExperienceSkillTotalLookup,
  initializeCombatRoundState,
  isCombatStartExperienceRollRequired,
  isCombatRoundCombatExperienceWindowOpen,
  isUserAssignedToEncounterMembership,
  normalizeRoleplayState,
  normalizeCombatArmorModifierClass,
  rollCombatRoundCombatExperience,
  recordCombatRoundCriticalRoll,
  recordCombatRoundDamageResult,
  recordCombatRoundDeclaration,
  respondCombatRoundAdjustDistance,
  reviewCombatRoundAdjustDistanceRollAdjustment,
  recordCombatRoundAdjustDistanceRoll,
  commitCombatRoundAdjustDistance,
  combatAdjustDistanceRollResultSchema,
  recordCombatRoundFeintRoll,
  commitCombatRoundFeintResult,
  recordCombatRoundHitLocationRoll,
  recordCombatRoundInitiative,
  recordCombatRoundAttackResult,
  recordCombatRoundParryResult,
  recordCombatRoundOffensiveParryBrawlingRoll,
  reviewCombatRoundDamageResult,
  recordCombatRoundParticipantStepReview,
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
  normalizeCombatRollAdjustment,
  resolveCombatDodgeModifiers,
  resolveCanonicalCombatAttackModifierFacts,
  resolveCombatWideGeneralModifiers,
  resolveCombatModifierContributions,
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
  removeDistanceGeneratedObSkillModifiers,
  resolveCombatFeintWeaponSkillDefinition,
  scenarioParticipantCombatContextSchema,
  combatFeintMethodSchema,
  combatFeintProposalSchema,
  combatFeintRollResultSchema,
  combatAdjustDistanceProposalSchema,
  setCombatRoundCombatExperienceDifficulty,
  setCombatRoundPairDistance,
  setCombatRoundSelection,
  validateCombatDeclarationTargets,
} from "@glantri/domain";
import type {
  CombatAttackModifierValidationProjection,
  CombatActionGeneratedDistanceModifierInput,
  CombatAttackSourceRef,
  CombatDistanceWeaponLike,
  CombatRoundAttackOpportunity,
  CombatRoundAttackResults,
  CombatRoundCommand,
  CombatRoundEndDistanceControlSide,
  CombatRoundEndDistanceProposal,
  CombatRoundPhase,
  CombatRoundPhaseInitiativeCommitParticipantInput,
  CombatRoundAttackDistanceModifierDetail,
  CombatRoundPhaseResolutionResult,
  CombatRoundDamageReview,
  CombatRoundStepSnapshot,
  CombatRoundState,
  CombatProgressionBoundaryKind,
  CombatProgressionExpectedCommand,
  CombatRoundPhaseContexts,
  CombatCalculationContext,
  CombatProgressionProjection,
  EncounterSession,
  MovementIntent,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
  ScenarioParticipant,
  WeaponTemplate,
} from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  calculateWorkbookPercentageAdjustmentTrace,
  isCombatFeintResistanceSkill,
  recordRoleplayGmSkillRoll,
  resolveCombatParry,
  resolveCombatFeintSkillProfile,
  resolveCombatFeintTable,
  resolveHighestCombatFeintResistanceProfile,
  resolveRoleplaySkillRollModifiers,
  resolveParticipantSkillRollProfile,
} from "@glantri/rules-engine";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import { combatRoundStatesDiffer } from "./combatRoundPersistence";
import { parseBodyObject, parseId, parseOptionalString } from "./parsing";
import { resolveScenarioWorkspaceAccess } from "./access";

const campaignService = new CampaignService();
const characterService = new CharacterService();
const encounterService = new EncounterService();
const scenarioService = new ScenarioService();

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
  dodgeSkillTotal?: number;
  healthStat?: number;
} {
  const build = characterBuildSchema.safeParse(participant.snapshot.build);
  if (!build.success) return {};

  const sheet = buildCharacterSheetSummary({
    build: build.data,
    content: defaultCanonicalContent,
  });

  return {
    dodgeSkillTotal:
      typeof sheet.combat.dodge === "number" && Number.isFinite(sheet.combat.dodge)
        ? Math.round(sheet.combat.dodge)
        : undefined,
    healthStat: build.data.profile.rolledStats.health,
  };
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
      return [
        [
          roundParticipant.participantId,
          {
            combatEffects: scenarioParticipant.state.combatEffects,
            distanceControl: {
              dodgeSkillTotal: sheetFacts.dodgeSkillTotal,
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
  pendingRollId: string;
  roll: {
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

  if (!rollValue || typeof rollValue !== "object") {
    throw new Error("roll is required.");
  }

  const supportRollValue = value.supportRoll;
  const supportRoll =
    supportRollValue && typeof supportRollValue === "object"
      ? (supportRollValue as Record<string, unknown>)
      : undefined;

  return {
    pendingRollId,
    roll: parseRollFields(rollValue as Record<string, unknown>, "roll"),
    supportRoll: supportRoll ? parseRollFields(supportRoll, "supportRoll") : undefined,
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
  roundState: CombatRoundState;
}) {
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
    projection: buildCombatProgressionProjection(input.roundState),
    taskId: input.identity.taskId,
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
  phaseContexts?: ReturnType<typeof combatRoundPhaseContextsSchema.parse>;
  phaseAttackSources?: ReturnType<typeof parseCombatDeclarationPhaseAttackSources>;
  phaseWeaponNames?: Partial<Record<"phase1" | "phase2", string | undefined>>;
  scenarioParticipantId: string;
  secondaryActionId?: string;
  feint?: {
    attackerSkillId?: string;
    method: "movement" | "weapon";
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
    phaseContexts:
      value.phaseContexts === undefined
        ? undefined
        : combatRoundPhaseContextsSchema.parse(value.phaseContexts),
    phaseAttackSources: parseCombatDeclarationPhaseAttackSources(value.phaseAttackSources),
    phaseWeaponNames: parseCombatDeclarationPhaseWeaponNames(value.phaseWeaponNames),
    scenarioParticipantId,
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

  const source = input.gmAuthorizedOperation ? "gm_proxy" : "player_declared";
  const hasVisibilityRows = Object.keys(input.encounter.roleplayState?.visibility ?? {}).length > 0;
  const preferencesByTargetParticipantId = new Map<
    string,
    MovementIntent["distancePreferences"][number]
  >();

  for (const preference of input.movementIntent.distancePreferences) {
    const targetRoundParticipant = findCombatRoundParticipantByAlias({
      id: preference.targetParticipantId,
      state: input.roundState,
    });

    if (!targetRoundParticipant) {
      throw new Error("Distance preference target is not part of this combat round.");
    }

    if (targetRoundParticipant.participantId === input.encounterParticipant.id) {
      throw new Error("Distance preference target must be another participant.");
    }

    const targetEncounterParticipant = input.encounter.participants.find((participant) =>
      participantAliasesInclude({ id: targetRoundParticipant.participantId, participant }),
    );

    if (!targetEncounterParticipant) {
      throw new Error("Distance preference target is not assigned to this encounter.");
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
      throw new Error("Distance preference target is not visible to this player.");
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
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, label);
  const scenarioParticipantId = value.scenarioParticipantId;

  if (typeof scenarioParticipantId !== "string" || scenarioParticipantId.trim().length === 0) {
    throw new Error("scenarioParticipantId is required.");
  }

  return { scenarioParticipantId };
}

function parseCombatInitiativeBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  initiativeBase?: number;
  initiativeModifierAdjustment?: number;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Combat initiative payload");
  const parsed = parseParticipantCommandBody(value, "Combat initiative payload");
  const initiativeBase = value.initiativeBase;
  const initiativeModifierAdjustment = value.initiativeModifierAdjustment;

  if (initiativeBase !== undefined && !Number.isInteger(initiativeBase)) {
    throw new Error("initiativeBase must be an integer.");
  }

  if (
    initiativeModifierAdjustment !== undefined &&
    !Number.isInteger(initiativeModifierAdjustment)
  ) {
    throw new Error("initiativeModifierAdjustment must be an integer.");
  }

  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    initiativeBase: typeof initiativeBase === "number" ? initiativeBase : undefined,
    initiativeModifierAdjustment:
      typeof initiativeModifierAdjustment === "number" ? initiativeModifierAdjustment : undefined,
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

function parseRoundEndHealthCheckRollBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  difficulty?: number;
  healthRollId: string;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Round-end health check roll payload");
  const parsed = parseParticipantCommandBody(value, "Round-end health check roll payload");
  const healthRollId = parseNonEmptyString(value.healthRollId, "healthRollId");
  const difficulty = value.difficulty;
  if (
    difficulty !== undefined &&
    (typeof difficulty !== "number" || !Number.isInteger(difficulty) || difficulty <= 0)
  ) {
    throw new Error("difficulty must be a positive integer.");
  }

  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    difficulty: typeof difficulty === "number" ? difficulty : undefined,
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

function parseOptionalInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseInteger(value, label);
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
  defenderDb?: number;
  defenderDbParryRaw?: number;
  defenderModifierFingerprint?: string;
  defenderParticipantId: string;
  modifierValidationTaskId?: string;
  ob: number;
  obSkillRaw: number;
  opportunityId: string;
  attackerModifierFingerprint?: string;
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
  const attackerModifierFingerprint =
    typeof value.attackerModifierFingerprint === "string"
      ? value.attackerModifierFingerprint
      : undefined;
  const defenderModifierFingerprint =
    typeof value.defenderModifierFingerprint === "string"
      ? value.defenderModifierFingerprint
      : undefined;

  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    actionId,
    attackIndex: parseInteger(value.attackIndex, "attackIndex"),
    attackModeId: parseNonEmptyString(value.attackModeId, "attackModeId"),
    declarationId: parseNonEmptyString(value.declarationId, "declarationId"),
    defenderDb: parseOptionalInteger(value.defenderDb, "defenderDb"),
    defenderDbParryRaw: parseOptionalInteger(value.defenderDbParryRaw, "defenderDbParryRaw"),
    defenderModifierFingerprint,
    defenderParticipantId,
    modifierValidationTaskId,
    ob: parseInteger(value.ob, "ob"),
    obSkillRaw: parseInteger(value.obSkillRaw, "obSkillRaw"),
    opportunityId: parseNonEmptyString(value.opportunityId, "opportunityId"),
    attackerModifierFingerprint,
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

function parseCombatParryBody(body: unknown): ParsedCombatTaskCommandIdentity & {
  attackResultId: string;
  attackerParticipantId: string;
  commandType: "roll_parry";
  dbParryRaw: number;
  declarationId?: string;
  declaredOpponentParticipantId?: string;
  defenderParticipantId: string;
  mainHandParryScore?: number;
  offHandParryScore?: number;
  offensiveParryAttemptId?: string;
  opportunityId?: string;
  parryBase: number;
  parryPurpose: "ordinary_defense" | "offensive_parry";
  parrySourceId: string;
  parrySourceLabel?: string;
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
  const parrySourceLabel =
    typeof value.parrySourceLabel === "string" && value.parrySourceLabel.trim().length > 0
      ? value.parrySourceLabel
      : undefined;
  if (value.commandType !== "roll_parry") {
    throw new Error("commandType must be roll_parry.");
  }
  const parryPurpose =
    value.parryPurpose === "ordinary_defense" || value.parryPurpose === "offensive_parry"
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

  return {
    ...parsed,
    ...parseCombatTaskCommandIdentity(value),
    attackResultId,
    attackerParticipantId: parseNonEmptyString(
      value.attackerParticipantId,
      "attackerParticipantId",
    ),
    commandType: "roll_parry",
    dbParryRaw: parseInteger(value.dbParryRaw, "dbParryRaw"),
    declarationId,
    declaredOpponentParticipantId,
    defenderParticipantId: parseNonEmptyString(
      value.defenderParticipantId,
      "defenderParticipantId",
    ),
    mainHandParryScore: parseOptionalInteger(value.mainHandParryScore, "mainHandParryScore"),
    offHandParryScore: parseOptionalInteger(value.offHandParryScore, "offHandParryScore"),
    offensiveParryAttemptId,
    opportunityId:
      value.opportunityId === undefined
        ? undefined
        : parseNonEmptyString(value.opportunityId, "opportunityId"),
    parryBase: parseInteger(value.parryBase, "parryBase"),
    parryPurpose,
    parrySourceId: parseNonEmptyString(value.parrySourceId, "parrySourceId"),
    parrySourceLabel,
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
  if (!usableItemIds.has(itemId) || (!isReadyOtherSource && expectedSlotItemId !== itemId)) {
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
  if (!mode || mode.canonicalMeleeMode == null) {
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

function getCombatProgressionTasks(projection: CombatProgressionProjection) {
  return projection.boundary.processes.flatMap((process) =>
    process.stages.flatMap((stage) => stage.executionGroups.flatMap((group) => group.tasks)),
  );
}

function buildCurrentAttackModifierValidation(input: {
  allowedAttackerParticipantIds?: ReadonlySet<string>;
  encounter: EncounterSession;
  projection: CombatProgressionProjection;
  roundState: CombatRoundState;
  scenarioParticipants: ScenarioParticipant[];
}): CombatAttackModifierValidationProjection | undefined {
  const task = getCombatProgressionTasks(input.projection).find(
    (candidate) =>
      candidate.kind === "attack" &&
      candidate.state === "executable" &&
      candidate.owner?.kind === "combatant",
  );
  if (!task || task.owner?.kind !== "combatant" || !task.identity.phase) return undefined;
  const attackerParticipantId = task.owner.participantId;
  if (
    input.allowedAttackerParticipantIds &&
    !input.allowedAttackerParticipantIds.has(attackerParticipantId)
  ) {
    return undefined;
  }
  const attackerEncounterParticipant = input.encounter.participants.find((participant) =>
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
  const defenderEncounterParticipant = input.encounter.participants.find((participant) =>
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
    encounterId: input.encounter.id,
    opportunityId: candidate?.id ?? task.identity.opportunityId,
    phase: task.identity.phase,
    state: input.roundState,
  });

  return {
    actionId: facts.attackerActionId,
    attackerModifierFingerprint: fingerprintCombatModifierResolution(facts.attackerResolution),
    attackerParticipantId: attackerEncounterParticipant.id,
    defenderDbParryRaw: facts.defenderResolution.total,
    defenderModifierFingerprint: fingerprintCombatModifierResolution(facts.defenderResolution),
    defenderParticipantId: defenderEncounterParticipant.id,
    effectCutoffInitiativeGroupId: task.identity.initiativeGroupId,
    encounterId: input.encounter.id,
    expectedRevision: input.encounter.updatedAt,
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

function buildDistanceDefaultWeaponsByParticipantId(input: {
  encounter: EncounterSession;
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
  encounter: EncounterSession;
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
  encounter: EncounterSession;
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

async function normalizeScenarioParticipantModifierRowsForEncounter(input: {
  encounter: EncounterSession;
  initializingNewEncounter?: boolean;
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
      return encounterService.updateScenarioParticipantState({
        participantId: participant.id,
        scenarioId: participant.scenarioId,
        state: {
          ...participant.state,
          combat: { ...participant.state.combat, combatContext },
        },
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
  combatContext: ScenarioParticipantCombatContext;
  encounterId: string;
  encounterParticipant: EncounterSession["participants"][number];
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseAttackSources?: Partial<Record<"phase1" | "phase2", CombatAttackSourceRef | undefined>>;
  roundState: CombatRoundState;
  scenarioParticipant: ScenarioParticipant;
  secondaryActionId?: string;
}): ScenarioParticipantCombatContext {
  const roundParticipantId =
    findCombatRoundParticipantByAlias({
      id: input.encounterParticipant.id,
      state: input.roundState,
    })?.participantId ?? input.encounterParticipant.id;

  return applyCombatActionGeneratedModifiers({
    actionId: input.actionId,
    adjustDistance: input.adjustDistance,
    combatContext: input.combatContext,
    sourceEncounterId: input.encounterId,
    sourceRoundNumber: input.roundState.roundNumber,
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
    const nextCombatContext = applyGeneratedCombatActionModifiersForDeclaration({
      actionId: declaration.actionId,
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
  encounter: EncounterSession;
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

function buildPlayerSafeCombatScopeForUser(input: {
  encounter: EncounterSession;
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
  encounter: EncounterSession;
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
  const visibility = input.encounter.roleplayState?.visibility;
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
    input.command.type === "roll_combat_experience" &&
    !input.controlledEncounterParticipantIds.has(input.command.participantId)
  ) {
    return undefined;
  }

  if (
    input.command.type === "roll_round_end_distance_control" ||
    input.command.type === "commit_round_end_distance_control"
  ) {
    return sanitizePlayerSafeDistanceControlCommandFacts(input);
  }

  return input.command;
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

  const safeState: CombatRoundState = {
    ...roundState,
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
    continuedContacts: roundState.continuedContacts.filter((contact) =>
      isPlayerVisibleCombatRoundResultPair({
        attackerParticipantId: contact.controllerParticipantId,
        controlledEncounterParticipantIds,
        defenderParticipantId: contact.affectedParticipantId,
        visibleParticipantIds,
      }),
    ),
    participants: roundState.participants.map((participant) =>
      controlledEncounterParticipantIds.has(participant.participantId)
        ? participant
        : {
            ...participant,
            declaration:
              roundState.currentStep === "select_actions"
                ? undefined
                : participant.declaration
                  ? {
                      ...participant.declaration,
                      additionalActionNotes: undefined,
                      movementIntent: undefined,
                    }
                  : undefined,
          },
    ),
    roundEndReview: safeRoundEndReview,
    rounds: [],
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

function buildPlayerSafeEncounterForUser(input: {
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

function sanitizePlayerSafeCurrentCombatAttackResults(input: {
  attackResults: CombatRoundAttackResults;
  controlledEncounterParticipantIds: Set<string>;
  visibleParticipantIds: Set<string>;
}): CombatRoundAttackResults {
  const attackResults: CombatRoundAttackResults = {};

  for (const phase of combatRoundPhaseSchema.options) {
    const result = input.attackResults[phase];

    if (
      result &&
      isPlayerVisibleCombatRoundResultPair({
        attackerParticipantId: result.attackerParticipantId,
        controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
        defenderParticipantId: result.defenderParticipantId,
        visibleParticipantIds: input.visibleParticipantIds,
      })
    ) {
      attackResults[phase] = result;
    }
  }

  return attackResults;
}

function sanitizePlayerSafeCurrentCombatResultsState(input: {
  controlledEncounterParticipantIds: Set<string>;
  state: CombatRoundState;
  visibleParticipantIds: Set<string>;
}): CombatRoundState {
  return {
    ...input.state,
    participants: input.state.participants.map((participant) => ({
      ...participant,
      attackResultsByOpportunity: participant.attackResultsByOpportunity
        ? Object.fromEntries(
            Object.entries(participant.attackResultsByOpportunity).filter(([, result]) =>
              isPlayerVisibleCombatRoundResultPair({
                attackerParticipantId: result.attackerParticipantId,
                controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
                defenderParticipantId: result.defenderParticipantId,
                visibleParticipantIds: input.visibleParticipantIds,
              }),
            ),
          )
        : undefined,
      attackResults: sanitizePlayerSafeCurrentCombatAttackResults({
        attackResults: participant.attackResults,
        controlledEncounterParticipantIds: input.controlledEncounterParticipantIds,
        visibleParticipantIds: input.visibleParticipantIds,
      }),
    })),
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

export const encounterRoutes: FastifyPluginAsync = async (app) => {
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

      const encounters = await encounterService.listEncountersByScenario(scenarioId);

      if (access.mode === "player") {
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

      return { encounters };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list encounters.",
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
        ? await encounterService.updateEncounter({
            campaignId: access.campaignId,
            encounterId,
            scenarioId,
            session: {
              ...encounter,
              combatRoundState: roundState,
              currentRound: roundState.roundNumber,
              updatedAt: new Date().toISOString(),
            },
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

  app.get("/encounters/:encounterId/combat-history", async (request, reply) => {
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

      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        {
          scenarioId: encounter.scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({ error: "Encounter not found." });
      }

      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const state = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const participants = membership.participants.map((participant) => ({
        displayName: participant.label,
        participantId: participant.id,
      }));
      const playerScope = buildPlayerSafeCombatScopeForUser({
        encounter,
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
              encounter,
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
            encounter,
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
      const progressionProjection = buildCombatProgressionProjection(state);
      const currentAttackModifierValidation = buildCurrentAttackModifierValidation({
        allowedAttackerParticipantIds:
          viewer.kind === "player" ? viewer.controlledParticipantIds : undefined,
        encounter,
        projection: progressionProjection,
        roundState: state,
        scenarioParticipants,
      });

      return {
        history: projectCombatHistory({
          currentAttackModifierValidation,
          participants,
          progressionProjection,
          sourceUpdatedAt: encounter.updatedAt,
          state,
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

      const gmAuthorizedOperation = access.mode === "gm";
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });

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
      const gmModifierReviewOperation =
        gmAuthorizedOperation &&
        roundState.participants.some(
          (participant) =>
            participant.participantId === encounterParticipant.id && participant.declaration,
        ) &&
        (roundState.currentStep === "review_action_modifiers" ||
          roundState.currentStep === "review_phase_2_modifiers");
      // Generated rows are derived when the declaration is created and refreshed by domain
      // result transitions. During GM modifier review, the submitted rows are the reviewed
      // overrides and must not be regenerated back to their default values.
      const submittedCombatContext = gmModifierReviewOperation
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

      const progressionProjection = buildCombatProgressionProjection(roundState);
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
        const roundParticipant = roundState.participants.find(
          (participant) => participant.participantId === encounterParticipant.id,
        );
        const declaration = roundParticipant?.declaration;
        if (!declaration) {
          return reply.code(409).send({ error: "The reviewed participant has no declaration." });
        }

        const submittedAt = new Date().toISOString();
        const participant = await encounterService.updateScenarioParticipantState({
          participantId: scenarioParticipant.id,
          scenarioId: encounter.scenarioId,
          state: {
            ...scenarioParticipant.state,
            combat: {
              ...scenarioParticipant.state.combat,
              combatContext: submittedCombatContext,
            },
          },
        });
        const reviewedDeclarationState = recordCombatRoundDeclaration({
          declaration: {
            ...declaration,
            combatContext: submittedCombatContext,
            phaseContexts: {
              phase1: submittedPhaseContexts?.phase1 ?? declaration.phaseContexts?.phase1,
              phase2: submittedPhaseContexts?.phase2 ?? declaration.phaseContexts?.phase2,
            },
          },
          participantId: encounterParticipant.id,
          state: roundState,
          submittedBy: "gm",
        });
        const nextRoundState = recordCombatRoundParticipantStepReview({
          command: { createdAt: submittedAt, createdByUserId: user.id },
          participantId: encounterParticipant.id,
          state: reviewedDeclarationState,
          step: roundState.currentStep,
          submittedBy: "gm",
        });
        const savedEncounter = await encounterService.updateEncounter({
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
          participant,
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
      let declarationPhaseContexts = submittedPhaseContexts;
      let declarationFeint;
      let declarationAdjustDistance;
      if (body.actionId === "adjust_range_attack") {
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

      const targetValidation = validateCombatDeclarationTargets({
        actionId: body.actionId,
        phaseContexts: declarationPhaseContexts,
        selectedOpponentId: submittedCombatContext.selectedOpponentId,
        secondaryActionId: body.secondaryActionId,
      });

      if (!targetValidation.valid) {
        return reply.code(400).send({
          error: targetValidation.message ?? "Select a target for each attack phase.",
        });
      }

      const submittedAt = new Date().toISOString();
      const participant = await encounterService.updateScenarioParticipantState({
        participantId: scenarioParticipant.id,
        scenarioId: encounter.scenarioId,
        state: {
          ...scenarioParticipant.state,
          combat: {
            ...scenarioParticipant.state.combat,
            combatContext: submittedCombatContext,
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
        },
      });
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
          combatContext: submittedCombatContext,
          feint: declarationFeint,
          movementId: body.movementId,
          movementIntent: submittedMovementIntent,
          phaseContexts: declarationPhaseContexts,
          roundNumber: roundState.roundNumber,
          secondaryActionId: body.secondaryActionId,
          submittedAt,
          submittedByUserId: user.id,
        },
        participantId: encounterParticipant.id,
        state: roundState,
        submittedBy: gmAuthorizedOperation ? "gm" : "player",
      });
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
              state: declaredRoundState,
              step: roundState.currentStep,
              submittedBy: "gm",
            })
          : declaredRoundState;
      const savedEncounter = await encounterService.updateEncounter({
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

      return { encounter: savedEncounter, participant };
    } catch (error) {
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
        const participant = await encounterService.updateScenarioParticipantState({
          participantId: scenarioParticipant.id,
          scenarioId: encounter.scenarioId,
          state: {
            ...scenarioParticipant.state,
            combat: {
              ...scenarioParticipant.state.combat,
              combatContext:
                nextDeclaration?.combatContext ?? scenarioParticipant.state.combat.combatContext,
            },
          },
        });
        const savedEncounter = await encounterService.updateEncounter({
          campaignId: access.campaignId,
          encounterId,
          scenarioId: encounter.scenarioId,
          session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
        });
        return { encounter: savedEncounter, participant };
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
        const savedEncounter = await encounterService.updateEncounter({
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
        const savedEncounter = await encounterService.updateEncounter({
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
      const profile = buildRoundEndParticipantInputs({
        encounter,
        roundState,
        scenarioParticipants,
      })[encounterParticipant.id]?.distanceControl;
      if (!profile || profile.dodgeSkillTotal === undefined)
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
      const pairKey = opponentScenarioParticipant
        ? createCombatParticipantPairKey(scenarioParticipant.id, opponentScenarioParticipant.id)
        : undefined;
      const dodgeContext: CombatCalculationContext = {
        actionId: "adjust_range_attack",
        encounterId,
        opportunityId: proposal.phase1OpportunityId,
        ownerParticipantId: scenarioParticipant.id,
        opponentParticipantId: opponentScenarioParticipant?.id,
        pairKey,
        phase: "phase1",
        proposalId: proposal.id,
        rollType: "adjust_distance_dodge",
        roundNumber: roundState.roundNumber,
        skillId: "dodge",
        step: "phase_1_actions",
      };
      const rollAdjustment =
        proposal.gmRollAdjustment?.participantId === encounterParticipant.id
          ? normalizeCombatRollAdjustment({
              actionId: "adjust_range_attack",
              encounterId,
              opportunityId: proposal.phase1OpportunityId,
              opponentParticipantId: opponentScenarioParticipant?.id,
              ownerParticipantId: scenarioParticipant.id,
              pairKey,
              phase: "phase1",
              proposalId: proposal.id,
              rollType: "adjust_distance_dodge",
              roundNumber: roundState.roundNumber,
              step: "phase_1_actions",
              value: adjustment,
              notes: proposal.gmRollAdjustment?.notes,
            })
          : undefined;
      const baseDodgeResolution = resolveCombatDodgeModifiers({
        context: dodgeContext,
        contributions: profile.modifierContributions ?? [],
      });
      const dodgeResolution = resolveCombatDodgeModifiers({
        context: dodgeContext,
        contributions: profile.modifierContributions ?? [],
        rollAdjustments: rollAdjustment ? [rollAdjustment] : [],
      });
      const generalFatigueModifier =
        baseDodgeResolution.bucketResolutions.find(
          (resolution) => resolution.bucket === "general_fatigue",
        )?.total ?? 0;
      const roll = rollOpenEndedD20();
      const createdAt = new Date().toISOString();
      const result = combatAdjustDistanceRollResultSchema.parse({
        dodgeSkillTotal: profile.dodgeSkillTotal,
        finalTotal: roll.dieResult + profile.dodgeSkillTotal + dodgeResolution.total,
        generalFatigueModifier,
        id: `${proposal.id}:roll:${side}`,
        openEndedD10s: roll.openEndedD10s,
        participantId: encounterParticipant.id,
        rollD20: roll.rollD20,
        rollTotal: roll.dieResult,
        rolledAt: createdAt,
        rolledByUserId: user.id,
        situationalAdjustment: adjustment,
      });
      const nextRoundState = recordCombatRoundAdjustDistanceRoll({
        command: { createdAt, createdByUserId: user.id },
        proposalId,
        result,
        state: roundState,
      });
      const savedEncounter = await encounterService.updateEncounter({
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
        const participants = [];
        for (const [participantId, state] of recomputed.participantStatesById) {
          participants.push(
            await encounterService.updateScenarioParticipantState({
              participantId,
              scenarioId: encounter.scenarioId,
              state,
            }),
          );
        }
        const savedEncounter = await encounterService.updateEncounter({
          campaignId: access.campaignId,
          encounterId,
          scenarioId: encounter.scenarioId,
          session: { ...encounter, combatRoundState: recomputed.roundState, updatedAt: createdAt },
        });
        return { encounter: savedEncounter, participants };
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
      const skill = defaultCanonicalContent.skills.find((candidate) => candidate.id === skillId);
      if (!skill)
        return reply.code(409).send({ error: "The selected feint skill is unavailable." });
      const profile = resolveCombatFeintSkillProfile({
        ...getScenarioParticipantFeintSkillInput(scenarioParticipant),
        characteristic: isAttackerRoll ? "dex" : "int",
        skill,
      });
      const adjustment = 0;
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
      const feintCalculationContext: CombatCalculationContext = {
        actionId: "feint_attack",
        encounterId,
        opportunityId: proposal.phase1OpportunityId,
        ownerParticipantId: scenarioParticipant.id,
        ...(opponentScenarioParticipant
          ? {
              opponentParticipantId: opponentScenarioParticipant.id,
              pairKey: createCombatParticipantPairKey(
                scenarioParticipant.id,
                opponentScenarioParticipant.id,
              ),
            }
          : {}),
        phase: "phase1",
        proposalId: proposal.id,
        rollType: proposal.method === "movement" ? "feint_dodge" : "feint_weapon",
        roundNumber: roundState.roundNumber,
        skillId,
        step: "phase_1_actions",
      };
      let canonicalCombatModifier = resolveCombatWideGeneralModifiers({
        context: feintCalculationContext,
        contributions: projection.contributions,
      }).total;
      if (proposal.method === "movement" && skillId === "dodge") {
        const dodgeResolution = resolveCombatDodgeModifiers({
          context: feintCalculationContext,
          contributions: projection.contributions,
        });
        canonicalCombatModifier = dodgeResolution.total;
      }
      const roll = rollOpenEndedD20();
      const createdAt = new Date().toISOString();
      const result = combatFeintRollResultSchema.parse({
        adjustment,
        characteristic: isAttackerRoll ? "dex" : "int",
        characteristicValue: profile.avgStats,
        finalTotal:
          roll.dieResult +
          profile.rollBaseValue +
          profile.unknownSkillPenalty +
          adjustment +
          canonicalCombatModifier,
        id: `${proposal.id}:roll:${isAttackerRoll ? "attacker" : "defender"}`,
        openEndedD10s: roll.openEndedD10s,
        participantId: encounterParticipant.id,
        rollD20: roll.rollD20,
        rollTotal: roll.dieResult,
        rolledAt: createdAt,
        rolledByUserId: user.id,
        skillId: profile.skillId,
        skillLabel: profile.skillName,
        skillXp: profile.totalXP,
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
      const savedEncounter = await encounterService.updateEncounter({
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
        defenderCombatContext: defender.state.combat.combatContext,
        encounterId: encounter.id,
        proposal: committedProposal,
      });
      const [savedAttacker, savedDefender] = await Promise.all([
        encounterService.updateScenarioParticipantState({
          participantId: attacker.id,
          scenarioId: encounter.scenarioId,
          state: {
            ...attacker.state,
            combat: { ...attacker.state.combat, combatContext: modifiers.attackerCombatContext },
          },
        }),
        encounterService.updateScenarioParticipantState({
          participantId: defender.id,
          scenarioId: encounter.scenarioId,
          state: {
            ...defender.state,
            combat: { ...defender.state.combat, combatContext: modifiers.defenderCombatContext },
          },
        }),
      ]);
      const nextRoundState = commitCombatRoundFeintResult({
        attackerCombatContext: savedAttacker.state.combat.combatContext,
        command: { createdAt, createdByUserId: user.id },
        defenderCombatContext: savedDefender.state.combat.combatContext,
        gmAttackerDbParryModifier,
        gmDefenderDbParryModifier,
        gmDefenderObDbModifier,
        gmDefenderSkillObModifier,
        notes,
        previousAttackerCombatContext: attacker.state.combat.combatContext,
        previousDefenderCombatContext: defender.state.combat.combatContext,
        proposalId,
        state: roundState,
      });
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId: encounter.scenarioId,
        session: { ...encounter, combatRoundState: nextRoundState, updatedAt: createdAt },
      });
      return { encounter: savedEncounter, participants: [savedAttacker, savedDefender] };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to commit the feint result.",
      });
    }
  });

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

      const initiativeRoll = rollOpenEndedD6();
      const initiativeBase = body.initiativeBase ?? 0;
      const initiativeProjection = buildLiveCombatModifierContributionProjection({
        combatContext: scenarioParticipant.state.combat.combatContext,
        combatEffects: scenarioParticipant.state.combatEffects,
        currentRound: roundState.roundNumber,
        encounterId,
        ownerParticipantId: scenarioParticipant.id,
      });
      const initiativeCalculationContext: CombatCalculationContext = {
        encounterId,
        ownerParticipantId: scenarioParticipant.id,
        phase,
        roundNumber: roundState.roundNumber,
        step: phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2",
      };
      const initiativeResolution = resolveCombatModifierContributions({
        bucket: "initiative",
        context: initiativeCalculationContext,
        contributions: initiativeProjection.contributions,
      });
      const initiativeGeneralResolution = resolveCombatWideGeneralModifiers({
        context: { ...initiativeCalculationContext, rollType: "initiative" },
        contributions: initiativeProjection.contributions,
      });
      const initiativeRawModifier = initiativeResolution.total + initiativeGeneralResolution.total;
      const initiativeModifierTrace = calculateWorkbookPercentageAdjustmentTrace({
        baseValue: initiativeBase,
        rawModifiers: [{ label: "Initiative", value: initiativeRawModifier }],
      });
      const rolledInitiative = buildCombatRoundInitiativeResult({
        baseInitiative: initiativeBase,
        modifierAdjustment:
          (initiativeModifierTrace?.finalValue ?? initiativeBase) - initiativeBase,
        roll: initiativeRoll,
      });
      const submittedAt = new Date().toISOString();
      const nextRoundState = recordCombatRoundInitiative({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        initiative: rolledInitiative,
        participantId: encounterParticipant.id,
        phase,
        state: roundState,
        submittedBy: gmAuthorizedOperation ? "gm" : "player",
        visibility: encounter.roleplayState?.visibility,
      });
      const savedEncounter = await encounterService.updateEncounter({
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
        encounter: gmAuthorizedOperation
          ? savedEncounter
          : buildPlayerSafeCombatRollMutationEncounterForUser({
              encounter: savedEncounter,
              scenarioParticipants,
              userId: user.id,
            }),
        initiative: rolledInitiative,
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
        const savedEncounter = await encounterService.updateEncounter({
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
      const participants = [];

      for (const [participantId, state] of recomputed.participantStatesById) {
        participants.push(
          await encounterService.updateScenarioParticipantState({
            participantId,
            scenarioId,
            state,
          }),
        );
      }

      const savedEncounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: recomputed.roundState,
          currentRound: recomputed.roundState.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return {
        encounter: savedEncounter,
        edge: getCombatRoundDistanceEdge({
          participantAId: body.participantAId,
          participantBId: body.participantBId,
          state: recomputed.roundState,
        }),
        participants,
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
        const savedParticipant = await encounterService.updateScenarioParticipantState({
          participantId: scenarioParticipant.id,
          scenarioId,
          state: {
            ...scenarioParticipant.state,
            combat: {
              ...scenarioParticipant.state.combat,
              combatContext: rolled.combatContext,
            },
            combatEffects: rolled.combatEffects,
          },
        });
        const savedEncounter = await encounterService.updateEncounter({
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
          combatExperience: rolled.result,
          encounter: gmAuthorizedOperation
            ? savedEncounter
            : buildPlayerSafeCombatRollMutationEncounterForUser({
                encounter: savedEncounter,
                scenarioParticipants,
                userId: user.id,
              }),
          participant: savedParticipant,
        };
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to roll Combat Experience.",
        });
      }
    },
  );

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
        const rolled = rollCombatRoundEndDistanceControl({
          command: {
            createdAt: submittedAt,
            createdByUserId: user.id,
          },
          distanceProposalId: body.distanceProposalId,
          participantId: encounterParticipant.id,
          participantInputs: buildRoundEndDistanceControlInputs({
            encounter,
            roundState,
            scenarioParticipants,
          }),
          rolledBy: gmAuthorizedOperation ? "gm_proxy" : "player",
          state: roundState,
        });
        const savedEncounter = await encounterService.updateEncounter({
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
        const rolled = rollCombatRoundEndDistanceControl({
          command: {
            createdAt: submittedAt,
            createdByUserId: user.id,
          },
          distanceProposalId: proposalId,
          participantId,
          participantInputs: buildRoundEndDistanceControlInputs({
            encounter,
            roundState,
            scenarioParticipants,
          }),
          rolledBy: "gm_proxy",
          state: roundState,
        });
        const savedEncounter = await encounterService.updateEncounter({
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
        const savedEncounter = await encounterService.updateEncounter({
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
          command: { createdAt: submittedAt, createdByUserId: user.id },
          encounterId,
          participantId: encounterParticipant.id,
          scenarioId,
          scenarioParticipantId: scenarioParticipant.id,
          state: roundState,
        });
        const savedParticipant = await encounterService.updateScenarioParticipantState({
          participantId: scenarioParticipant.id,
          scenarioId,
          state: { ...scenarioParticipant.state, combatEffects: committed.combatEffects },
        });
        const savedEncounter = await encounterService.updateEncounter({
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
        return {
          commandEnvelope: buildCombatRoundCommandEnvelope({ state: committed.state }),
          encounter: savedEncounter,
          participant: savedParticipant,
        };
      } catch (error) {
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
        difficulty: body.difficulty,
        healthRollId: body.healthRollId,
        participantId: encounterParticipant.id,
        rolledBy: gmAuthorizedOperation ? "gm_proxy" : "player",
        state: roundState,
      });
      const savedParticipant = await encounterService.updateScenarioParticipantState({
        participantId: scenarioParticipant.id,
        scenarioId,
        state: {
          ...scenarioParticipant.state,
          combatEffects: rolled.combatEffects,
        },
      });
      const savedEncounter = await encounterService.updateEncounter({
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
        command: rolled.command,
        encounter: gmAuthorizedOperation
          ? savedEncounter
          : buildPlayerSafeCombatRollMutationEncounterForUser({
              encounter: savedEncounter,
              scenarioParticipants,
              userId: user.id,
            }),
        participant: savedParticipant,
      };
    } catch (error) {
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
        const savedParticipant = await encounterService.updateScenarioParticipantState({
          participantId: scenarioParticipant.id,
          scenarioId,
          state: {
            ...scenarioParticipant.state,
            combat: {
              ...scenarioParticipant.state.combat,
              combatContext: backedOut.combatContext,
            },
          },
        });
        const savedEncounter = await encounterService.updateEncounter({
          campaignId: access.campaignId,
          encounterId,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: backedOut.state,
            currentRound: backedOut.state.roundNumber,
            updatedAt: submittedAt,
          },
        });

        return {
          command: backedOut.command,
          encounter: savedEncounter,
          participant: savedParticipant,
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
        const savedEncounter = await encounterService.updateEncounter({
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
        const savedEncounter = await encounterService.updateEncounter({
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
        state: roundState,
        stepSnapshots: body.stepSnapshots,
        targetBoundary: body.targetBoundary,
        visibility: encounter.roleplayState?.visibility,
      });
      const refreshedParticipants =
        nextRoundState.roundNumber > roundState.roundNumber
          ? (
              await Promise.all(
                scenarioParticipants.map(async (participant) => {
                  const currentContext = participant.state.combat.combatContext;
                  const nextContext = expireAdjustDistanceAttackGeneratedModifiersBeforeRound(
                    expireCombatFeintGeneratedModifiersBeforeRound(
                      currentContext,
                      nextRoundState.roundNumber,
                    ),
                    nextRoundState.roundNumber,
                  );
                  if (JSON.stringify(nextContext) === JSON.stringify(currentContext))
                    return undefined;
                  return encounterService.updateScenarioParticipantState({
                    participantId: participant.id,
                    scenarioId,
                    state: {
                      ...participant.state,
                      combat: { ...participant.state.combat, combatContext: nextContext },
                    },
                  });
                }),
              )
            ).filter((participant): participant is ScenarioParticipant => participant !== undefined)
          : [];
      const savedEncounter = await encounterService.updateEncounter({
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
      const commandEnvelope = buildCombatRoundCommandEnvelope({
        state: nextRoundState,
      });

      return {
        commandEnvelope,
        encounter: savedEncounter,
        participants: refreshedParticipants,
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
      const savedEncounter = await encounterService.updateEncounter({
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
        defenderScenarioParticipantId: defenderScenarioParticipant.id,
        encounterId,
        scenarioId,
        state: reviewedState,
      });

      await encounterService.updateScenarioParticipantState({
        participantId: defenderScenarioParticipant.id,
        scenarioId,
        state: {
          ...defenderScenarioParticipant.state,
          combatEffects: committed.combatEffects,
        },
      });
      const savedEncounter = await encounterService.updateEncounter({
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
      const commandEnvelope = buildCombatRoundCommandEnvelope({ state: committed.state });

      return { commandEnvelope, encounter: savedEncounter };
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
        const updatedParticipants = await Promise.all(
          Object.entries(committed.combatContextsByParticipantId).map(
            async ([encounterParticipantId, combatContext]) => {
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
                return undefined;
              }

              return encounterService.updateScenarioParticipantState({
                participantId: scenarioParticipant.id,
                scenarioId,
                state: {
                  ...scenarioParticipant.state,
                  combat: {
                    ...scenarioParticipant.state.combat,
                    combatContext,
                  },
                },
              });
            },
          ),
        );
        const savedEncounter = await encounterService.updateEncounter({
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
        const commandEnvelope = buildCombatRoundCommandEnvelope({
          latestResult: {
            kind: "phase_initiative_commit",
            phase,
          },
          state: committed.state,
        });

        return {
          command: committed.command,
          commandEnvelope,
          encounter: savedEncounter,
          participants: updatedParticipants.filter(
            (participant): participant is ScenarioParticipant => Boolean(participant),
          ),
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

      const latestAttackerSnapshot = [...roundState.stepSnapshots]
        .reverse()
        .find(
          (snapshot) =>
            snapshot.roundNumber === roundState.roundNumber &&
            snapshot.participantId === encounterParticipant.id &&
            snapshot.phase === body.phase &&
            snapshot.attackSummary,
        );
      const latestDefenderSnapshot = [...roundState.stepSnapshots]
        .reverse()
        .find(
          (snapshot) =>
            snapshot.roundNumber === roundState.roundNumber &&
            snapshot.participantId === defenderEncounterParticipant.id &&
            snapshot.phase === body.phase &&
            snapshot.defenseSummary,
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
      const snapshotDefenderDb = parseCombatSummaryInteger(
        latestDefenderSnapshot?.defenseSummary?.db,
        "Defender DB",
      );
      const defenderFlatDbAdjustment = getMergedCombatDbFlatAdjustmentTotal({
        combatContext: canonicalModifierFacts.defenderCombatContext,
        phase: body.phase,
      });
      const defenderDb =
        snapshotDefenderDb !== undefined
          ? snapshotDefenderDb +
            defenderFlatDbAdjustment -
            (latestDefenderSnapshot?.modifierSummary?.dbFlatAdjustment ?? 0)
          : body.defenderDb;

      if (!weaponName || defenderDb === undefined) {
        return reply.code(409).send({
          error: "Attack or defender combat summary is not available.",
        });
      }

      const submittedAt = new Date().toISOString();
      const actionId = canonicalOpportunityIdentity.actionId;
      const attackerCombatContext = canonicalModifierFacts.attackerCombatContext;
      const canonicalObSkillResolution = canonicalModifierFacts.attackerResolution;
      const canonicalDefenderDbParryResolution = canonicalModifierFacts.defenderResolution;
      const canonicalDefenderDbParryRaw = canonicalDefenderDbParryResolution.total;
      const recordedDefenderDbParryRaw =
        body.defenderDbParryRaw ??
        (latestDefenderSnapshot ? (latestDefenderSnapshot.modifierSummary?.dbRaw ?? 0) : undefined);

      if (
        recordedDefenderDbParryRaw === undefined ||
        recordedDefenderDbParryRaw !== canonicalDefenderDbParryRaw ||
        (body.defenderModifierFingerprint !== undefined &&
          body.defenderModifierFingerprint !==
            fingerprintCombatModifierResolution(canonicalDefenderDbParryResolution))
      ) {
        return reply.code(409).send({
          code: "defender_modifier_signature_mismatch",
          error: "Defender modifiers changed. Refresh combat before rolling.",
        });
      }
      const canonicalObSkillRaw = canonicalObSkillResolution.total;

      if (
        body.obSkillRaw !== canonicalObSkillRaw ||
        (body.attackerModifierFingerprint !== undefined &&
          body.attackerModifierFingerprint !==
            fingerprintCombatModifierResolution(canonicalObSkillResolution))
      ) {
        return reply.code(409).send({
          code: "attacker_modifier_signature_mismatch",
          error: "Attack modifiers changed. Refresh combat before rolling.",
        });
      }

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
      const roll = rollOpenEndedCombatToHitD20();
      const attackResult = buildCombatRoundAttackRollResult({
        actionId,
        attackIndex: canonicalOpportunityIdentity.attackIndex,
        attackModeId: canonicalOpportunityIdentity.attackModeId,
        attackOpportunityId: canonicalOpportunityIdentity.opportunityId,
        attackSlot: declaredOpportunity.slot,
        attackerParticipantId: encounterParticipant.id,
        declarationId: canonicalOpportunityIdentity.declarationId,
        defenderDb,
        defenderParticipantId: defenderEncounterParticipant.id,
        ob: body.ob,
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
      const nextRoundState = recordCombatRoundAttackResult({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
          facts: {
            defenderFlatDbAdjustment,
            ...(distanceModifierDetail ? { distanceModifier: distanceModifierDetail } : {}),
            obSkillRaw: canonicalObSkillRaw,
          },
        },
        participantId: encounterParticipant.id,
        result: attackResult,
        state: roundState,
        submittedBy: access.mode === "gm" ? "gm" : "player",
      });
      const savedEncounter = await encounterService.updateEncounter({
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
      const attackCommand = nextRoundState.commands.at(-1);
      const attackResultId = getCombatRoundAttackResultId({
        result: attackResult,
        roundNumber: nextRoundState.roundNumber,
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
        command: attackCommand,
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
      const attackerRoundParticipant = roundState.participants.find(
        (participant) => participant.participantId === attackResult.attackerParticipantId,
      );
      const defenderRoundParticipant = roundState.participants.find(
        (participant) => participant.participantId === encounterParticipant.id,
      );
      const attackOpportunity = attackerRoundParticipant?.declaration?.attackOpportunities?.find(
        (opportunity) => opportunity.id === attackResult.attackOpportunityId,
      );
      const defenderFeintProposal = roundState.feintProposals.find(
        (proposal) =>
          proposal.roundNumber === roundState.roundNumber &&
          proposal.status === "committed" &&
          proposal.attackerParticipantId === attackResult.attackerParticipantId &&
          proposal.defenderParticipantId === encounterParticipant.id,
      );

      const defenderCombatContext = scenarioParticipantCombatContextSchema.parse(
        scenarioParticipant.state.combat.combatContext ?? {},
      );
      const defenderModifierProjection = buildLiveCombatModifierContributionProjection({
        combatContext: defenderCombatContext,
        combatEffects: scenarioParticipant.state.combatEffects,
        currentInitiativeGroupId: getCombatRoundCurrentInitiativeExecutionGroup({
          phase: attackResult.phase,
          state: roundState,
        })?.id,
        currentRound: roundState.roundNumber,
        encounterId,
        ownerParticipantId: scenarioParticipant.id,
      });
      const canonicalDbParryResolution = resolveCombatModifierContributions({
        bucket: "db_parry",
        context: {
          actionId: defenderRoundParticipant?.declaration?.actionId,
          encounterId,
          ...(attackerScenarioParticipant
            ? { opponentParticipantId: attackerScenarioParticipant.id }
            : {}),
          ...(attackOpportunity?.id ? { opportunityId: attackOpportunity.id } : {}),
          ownerParticipantId: scenarioParticipant.id,
          ...(attackerScenarioParticipant
            ? {
                pairKey: createCombatParticipantPairKey(
                  scenarioParticipant.id,
                  attackerScenarioParticipant.id,
                ),
              }
            : {}),
          phase: attackResult.phase,
          proposalId: defenderFeintProposal?.id,
          roundNumber: roundState.roundNumber,
          rollType: "parry",
          step: getCombatRoundParryReviewStepForPhase(attackResult.phase),
        },
        contributions: defenderModifierProjection.contributions,
      });
      const canonicalGeneralParryResolution = resolveCombatWideGeneralModifiers({
        context: {
          actionId: defenderRoundParticipant?.declaration?.actionId,
          encounterId,
          opportunityId: attackOpportunity?.id,
          ownerParticipantId: scenarioParticipant.id,
          opponentParticipantId: attackerScenarioParticipant?.id,
          phase: attackResult.phase,
          rollType: "parry",
          roundNumber: roundState.roundNumber,
          step: getCombatRoundParryReviewStepForPhase(attackResult.phase),
        },
        contributions: defenderModifierProjection.contributions,
      });
      const canonicalDbParryRaw =
        canonicalDbParryResolution.total + canonicalGeneralParryResolution.total;

      if (body.dbParryRaw !== canonicalDbParryRaw) {
        return reply.code(409).send({
          error: "Parry modifiers changed. Refresh combat before rolling.",
        });
      }

      const rawModifiers = [
        ...(canonicalDbParryRaw !== 0 ? [{ label: "DB/Parry", value: canonicalDbParryRaw }] : []),
        ...(attackResult.defenderParryModifier !== 0
          ? [{ label: "Attack result", value: attackResult.defenderParryModifier }]
          : []),
      ];

      const submittedAt = new Date().toISOString();
      const roll = rollOpenEndedD20();
      const parry = resolveCombatParry({
        parryBase: body.parryBase,
        rawModifiers,
        rollTotal: roll.dieResult,
      });
      const parryResolution = {
        attackOpportunityId: body.opportunityId,
        attackResultId: body.attackResultId,
        combinedParryScore: parry.parryBase,
        declaredOpponentParticipantId: body.declaredOpponentParticipantId,
        mainHandParryScore: body.mainHandParryScore,
        modifiedParryBeforeRoll: parry.parryBase + parry.modifierAdjustment,
        modifierAdjustment: parry.modifierAdjustment,
        modifierBreakdown: parry.rawModifiers.map((modifier) => ({ ...modifier })),
        notes:
          "Direction, location coverage, and multi-opponent source allocation are deferred in this first parry slice.",
        offHandParryScore: body.offHandParryScore,
        offensiveParryAttemptId: body.offensiveParryAttemptId,
        offensiveParryDeclarationId: body.declarationId,
        openEndedD10s: roll.openEndedD10s,
        parrySourceId: body.parrySourceId,
        parrySourceLabel: body.parrySourceLabel,
        purpose: body.parryPurpose,
        rawModifierTotal: parry.rawModifierTotal,
        resultLabel: parry.success ? "Parry successful" : "Parry failed",
        rollD20: roll.rollD20,
        rollTotal: roll.dieResult,
        status: "resolved" as const,
        success: parry.success,
        targetNumber: parry.targetNumber,
        total: parry.total,
        usedMainHand: body.usedMainHand,
        usedOffHand: body.usedOffHand,
      };
      const nextRoundState = recordCombatRoundParryResult({
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
      const savedEncounter = await encounterService.updateEncounter({
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
      const parryCommand = nextRoundState.commands.at(-1);
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

        const brawlingSkill = defaultCanonicalContent.skills.find(
          (skill) => skill.id === "brawling",
        );
        if (!brawlingSkill) {
          return reply.code(409).send({ error: "Brawling skill definition is unavailable." });
        }
        const profile = resolveParticipantSkillRollProfile({
          ...getScenarioParticipantFeintSkillInput(roller),
          skill: brawlingSkill,
        });
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
        const modifierContext: CombatCalculationContext = {
          actionId: "offensive_parry",
          encounterId,
          opportunityId: contest.opportunityId,
          ownerParticipantId: roller.id,
          opponentParticipantId: opponentScenarioParticipant?.id,
          pairKey: opponentScenarioParticipant
            ? createCombatParticipantPairKey(roller.id, opponentScenarioParticipant.id)
            : undefined,
          phase: contest.phase,
          rollPurpose: "offensive_parry_brawling",
          rollType: "brawling",
          roundNumber: roundState.roundNumber,
          skillId: "brawling",
          step: getCombatRoundParryReviewStepForPhase(contest.phase),
        };
        const generalResolution = resolveCombatModifierContributions({
          bucket: "general_fatigue",
          context: modifierContext,
          contributions: modifierProjection.contributions,
        });
        const skillResolution = resolveCombatModifierContributions({
          bucket: "skill_ob",
          context: modifierContext,
          contributions: modifierProjection.contributions,
        });
        const parryQualityModifier =
          encounterParticipant.id === contest.controllerParticipantId
            ? contest.parryQualityModifier
            : 0;
        const openEndedRoll = rollOpenEndedD20();
        const createdAt = new Date().toISOString();
        const roll = {
          brawlingBaseValue: profile.rollBaseValue + profile.unknownSkillPenalty,
          brawlingSkillXp: profile.totalXP,
          characteristicAverage: profile.avgStats,
          finalTotal:
            openEndedRoll.dieResult +
            profile.rollBaseValue +
            profile.unknownSkillPenalty +
            generalResolution.total +
            skillResolution.total +
            parryQualityModifier,
          id: `${contest.id}:roll:${encounterParticipant.id}`,
          generalModifier: generalResolution.total,
          openEndedD10s: openEndedRoll.openEndedD10s,
          participantId: encounterParticipant.id,
          parryQualityModifier,
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
          skillModifier: skillResolution.total,
        };
        const previousConditionIds = new Set(
          roundState.unbalancedConditions.map((condition) => condition.id),
        );
        const nextRoundState = recordCombatRoundOffensiveParryBrawlingRoll({
          attackResultId: body.attackResultId,
          command: { createdAt, createdByUserId: user.id },
          contestId: body.contestId,
          declarationId: body.declarationId,
          executionGroupId: body.executionGroupId,
          opportunityId: body.opportunityId,
          opponentParticipantId: body.opponentParticipantId,
          parryResultId: body.parryResultId,
          phase: body.phase,
          roll,
          rollerParticipantId: encounterParticipant.id,
          state: roundState,
          submittedBy: access.mode === "gm" ? "gm" : "player",
        });

        const createdCondition = nextRoundState.unbalancedConditions.find(
          (condition) => !previousConditionIds.has(condition.id) && condition.status === "active",
        );
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
          const combatEffects = combatEffectsStateSchema.parse(
            affectedScenarioParticipant.state.combatEffects,
          );
          await encounterService.updateScenarioParticipantState({
            participantId: affectedScenarioParticipant.id,
            scenarioId,
            state: {
              ...affectedScenarioParticipant.state,
              combatEffects: combatEffectsStateSchema.parse({
                effects: [
                  ...combatEffects.effects.filter((effect) => effect.id !== createdCondition.id),
                  combatEffectSchema.parse({
                    combatModifierBucket: "general",
                    combatWide: true,
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
                    status:
                      initiativeGroup &&
                      getCombatRoundCurrentInitiativeExecutionGroup({
                        phase: contest.phase,
                        state: nextRoundState,
                      })?.id === initiativeGroup.id
                        ? "pending"
                        : "active",
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
          });
        }

        const savedEncounter = await encounterService.updateEncounter({
          campaignId: access.campaignId,
          encounterId,
          scenarioId,
          session: {
            ...encounter,
            combatRoundState: nextRoundState,
            currentRound: nextRoundState.roundNumber,
            updatedAt: createdAt,
          },
        });
        return {
          command: nextRoundState.commands.at(-1),
          encounter:
            access.mode === "gm"
              ? savedEncounter
              : buildPlayerSafeCombatRollMutationEncounterForUser({
                  encounter: savedEncounter,
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
      const defenderDm = parseCombatSummaryInteger(
        latestDefenderSnapshot?.defenseSummary?.dm,
        "Defender DM",
      );
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
      const savedEncounter = await encounterService.updateEncounter({
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
      const defenderDm = parseCombatSummaryInteger(
        latestDefenderSnapshot?.defenseSummary?.dm,
        "Defender DM",
      );
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
      const savedEncounter = await encounterService.updateEncounter({
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
      const savedEncounter = await encounterService.updateEncounter({
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
          const savedEncounter = await encounterService.updateEncounter({
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
      const nextRoundState = initializeMaterializedCombatRoundState({
        encounter: {
          ...encounter,
          combatRoundState: clearedRoundState,
          currentRound: clearedRoundState.roundNumber,
        },
        scenarioParticipants,
      });
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
      const savedEncounter = await encounterService.updateEncounter({
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
      const updatedParticipants =
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
        removedOffensiveParryBrawlingCommands.length > 0
          ? await Promise.all(
              scenarioParticipants
                .map((participant) => {
                  const encounterParticipant = membership.participants.find(
                    (entry) => entry.scenarioParticipantId === participant.id,
                  );

                  if (!encounterParticipant) {
                    return undefined;
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

                  return nextState === participant.state
                    ? undefined
                    : encounterService.updateScenarioParticipantState({
                        participantId: participant.id,
                        scenarioId,
                        state: nextState,
                      });
                })
                .filter((update): update is Promise<ScenarioParticipant> => Boolean(update)),
            )
          : [];

      return { encounter: savedEncounter, participants: updatedParticipants };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to clear combat round step.",
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
      const pendingRoll = state.pendingSkillRolls.find((roll) => roll.id === body.pendingRollId);

      if (!pendingRoll || pendingRoll.silent) {
        return reply.code(403).send({
          error: "Roll is not available to this player.",
        });
      }

      const pendingRollSide =
        pendingRoll.side ?? (pendingRoll.mode === "opposed" ? "actor" : undefined);
      const existingResult = state.actionLog.find(
        (entry) =>
          entry.type === "gm_skill_roll" &&
          !entry.silent &&
          ((entry.pendingRollId && entry.pendingRollId === pendingRoll.id) ||
            (pendingRoll.rollSetId &&
              entry.rollSetId === pendingRoll.rollSetId &&
              (pendingRollSide ? entry.side === pendingRollSide : true) &&
              entry.participantId === pendingRoll.participantId &&
              entry.skillId === pendingRoll.skillId)),
      );

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

      const participant = resolveEncounterParticipantByRollParticipantId({
        participantId: pendingRoll.participantId,
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
      const nextEncounter = recordRoleplayGmSkillRoll({
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
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: encounter.campaignId,
        encounterId,
        scenarioId: encounter.scenarioId,
        session: {
          ...nextEncounter,
          updatedAt: new Date().toISOString(),
        },
      });

      return { encounter: savedEncounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to submit player roll.",
      });
    }
  });
};
