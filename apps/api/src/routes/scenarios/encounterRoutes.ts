import type { FastifyPluginAsync } from "fastify";

import { defaultCanonicalContent, equipmentTemplatesById, weaponTemplates } from "@glantri/content";
import {
  CampaignService,
  CharacterService,
  EncounterService,
  ScenarioService,
} from "@glantri/database";
import {
  buildPlayerSafeRoleplayStateForUser,
  applyCombatActionGeneratedModifiers,
  backOutCombatRoundPhaseAttack,
  buildCombatRoundCommandEnvelope,
  buildCombatRoundAttackRollResult,
  buildCombatRoundDamageArmorCoverageFromEquipmentState,
  buildCombatRoundInitiativeResult,
  buildReactiveAttackPhase2InitiativeModifierEntry,
  advanceCombatRoundPhaseResolutionSubstepForParticipant,
  advanceCombatRoundStep,
  canClearCombatRoundStep,
  canPlayerRollCombatInitiative,
  buildRoleplayCalculationPreview,
  combatRoundParticipantHasPhaseAttack,
  commitCombatRoundPhaseInitiativeResolution,
  commitCombatRoundPhaseDamage,
  completeCombatRoundPhaseResolutionForParticipant,
  continueCombatRoundPhaseAttack,
  canPlayerSubmitCombatDeclaration,
  clearCombatRoundStep,
  clearCurrentCombatRoundStepAndRewind,
  combatRoundPhaseSchema,
  combatRoundStepSchema,
  combatRoundStepSnapshotSchema,
  encounterParticipantMembershipModeSchema,
  encounterSessionSchema,
  encounterStatusSchema,
  ensureDistanceEdgesForParticipantPairs,
  getCombatRoundInitiativePhaseForStep,
  getCombatRoundAttackResultById,
  getCombatRoundAttackResultId,
  getCombatRoundCombatExperienceDifficulty,
  getCombatDistanceParticipantAliases,
  getCombatDeclarationAttackPhases,
  getCombatRoundDistanceEdge,
  getCombatRoundRequiredCombatExperienceTrigger,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getPlayerCombatCurrentRollAction,
  getSingleAttackDeclaredDistanceForPenalty,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getNextCombatRoundEndTask,
  getCombatRoundPhaseResolutionStatus,
  getParticipantCombatExperienceSkillTotalLookup,
  initializeCombatRoundState,
  isCombatStartExperienceRollRequired,
  isCombatRoundCombatExperienceWindowOpen,
  isUserAssignedToEncounterMembership,
  normalizeRoleplayState,
  normalizeCombatArmorModifierClass,
  rollCombatRoundCombatExperience,
  recordCombatRoundCriticalRoll,
  recordCombatRoundDeclaration,
  recordCombatRoundHitLocationRoll,
  recordCombatRoundInitiative,
  recordCombatRoundAttackResult,
  recordCombatRoundNoAttackPhaseReview,
  recordCombatRoundParryResult,
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
  resolveEncounterParticipantMembership,
  rollCombatRoundEndDistanceControl,
  rollCombatRoundEndHealthCheck,
  rollOpenEndedCombatToHitD20,
  rollOpenEndedD20,
  rollOpenEndedD6,
  skipCombatRoundCurrentPhaseAction,
  combatRoundPhaseContextsSchema,
  getDistanceEdgeBetweenParticipantAliases,
  getWeaponPreferredDistances,
  isDistanceGeneratedObSkillModifier,
  movementIntentSchema,
  normalizeMovementIntent,
  removeDistanceGeneratedObSkillModifiers,
  scenarioParticipantCombatContextSchema,
  setCombatRoundCombatExperienceDifficulty,
  setCombatRoundPairDistance,
  setCombatRoundSelection,
  validateCombatDeclarationTargets,
} from "@glantri/domain";
import type {
  CombatActionGeneratedDistanceModifierInput,
  CombatDistanceWeaponLike,
  CombatRoundAttackResults,
  CombatRoundCommand,
  CombatRoundEndDistanceControlSide,
  CombatRoundEndDistanceProposal,
  CombatRoundPhaseInitiativeCommitParticipantInput,
  CombatRoundAttackDistanceModifierDetail,
  CombatRoundPhaseResolutionResult,
  CombatRoundDamageReview,
  CombatRoundStepSnapshot,
  CombatRoundState,
  CombatRoundPhaseContexts,
  EncounterSession,
  MovementIntent,
  ScenarioCombatModifierEntry,
  ScenarioParticipantCombatContext,
  ScenarioParticipant,
  WeaponTemplate,
} from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  recordRoleplayGmSkillRoll,
  resolveCombatParry,
  resolveRoleplaySkillRollModifiers,
} from "@glantri/rules-engine";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
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

function parseCombatDeclarationBody(body: unknown): {
  actionId?: string;
  additionalActionNotes?: string;
  combatContext: ReturnType<typeof scenarioParticipantCombatContextSchema.parse>;
  movementId?: string;
  movementIntent?: MovementIntent;
  phaseContexts?: ReturnType<typeof combatRoundPhaseContextsSchema.parse>;
  phaseWeaponNames?: Partial<Record<"phase1" | "phase2", string | undefined>>;
  scenarioParticipantId: string;
  secondaryActionId?: string;
} {
  const value = parseBodyObject(body, "Combat declaration payload");
  const scenarioParticipantId = value.scenarioParticipantId;

  if (typeof scenarioParticipantId !== "string" || scenarioParticipantId.trim().length === 0) {
    throw new Error("scenarioParticipantId is required.");
  }

  return {
    actionId: parseOptionalDeclarationString(value.actionId),
    additionalActionNotes:
      typeof value.additionalActionNotes === "string" ? value.additionalActionNotes : undefined,
    combatContext: scenarioParticipantCombatContextSchema.parse(value.combatContext ?? {}),
    movementId: parseOptionalDeclarationString(value.movementId),
    movementIntent: normalizeMovementIntent(value.movementIntent),
    phaseContexts:
      value.phaseContexts === undefined
        ? undefined
        : combatRoundPhaseContextsSchema.parse(value.phaseContexts),
    phaseWeaponNames: parseCombatDeclarationPhaseWeaponNames(value.phaseWeaponNames),
    scenarioParticipantId,
    secondaryActionId: parseOptionalDeclarationString(value.secondaryActionId),
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

function parseCombatInitiativeBody(body: unknown): {
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
    initiativeBase: typeof initiativeBase === "number" ? initiativeBase : undefined,
    initiativeModifierAdjustment:
      typeof initiativeModifierAdjustment === "number" ? initiativeModifierAdjustment : undefined,
  };
}

function parseCombatExperienceBody(body: unknown): {
  difficulty?: number;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Combat Experience payload");
  const parsed = parseParticipantCommandBody(value, "Combat Experience payload");
  const difficulty = value.difficulty;

  if (
    difficulty !== undefined &&
    (typeof difficulty !== "number" || !Number.isInteger(difficulty) || difficulty <= 0)
  ) {
    throw new Error("difficulty must be a positive integer.");
  }

  return {
    ...parsed,
    difficulty: typeof difficulty === "number" ? difficulty : undefined,
  };
}

function parseRoundEndDistanceControlRollBody(body: unknown): {
  distanceProposalId: string;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Round-end distance control roll payload");
  const parsed = parseParticipantCommandBody(value, "Round-end distance control roll payload");
  const distanceProposalId = parseNonEmptyString(value.distanceProposalId, "distanceProposalId");

  return {
    ...parsed,
    distanceProposalId,
  };
}

function parseRoundEndHealthCheckRollBody(body: unknown): {
  healthRollId: string;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Round-end health check roll payload");
  const parsed = parseParticipantCommandBody(value, "Round-end health check roll payload");
  const healthRollId = parseNonEmptyString(value.healthRollId, "healthRollId");

  return {
    ...parsed,
    healthRollId,
  };
}

function parseCombatExperienceDifficultyBody(body: unknown): {
  difficulty: number;
} {
  const value = parseBodyObject(body, "Combat Experience difficulty payload");
  const difficulty = value.difficulty;

  if (typeof difficulty !== "number" || !Number.isInteger(difficulty) || difficulty <= 0) {
    throw new Error("difficulty must be a positive integer.");
  }

  return { difficulty };
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

function parseCombatRoundAdvanceBody(body: unknown): {
  stepSnapshots?: CombatRoundStepSnapshot[];
} {
  const value =
    body && typeof body === "object" && !Array.isArray(body)
      ? parseBodyObject(body, "Combat round advance payload")
      : {};
  const stepSnapshotsValue = value.stepSnapshots;

  if (stepSnapshotsValue === undefined) {
    return {};
  }

  if (!Array.isArray(stepSnapshotsValue)) {
    throw new Error("stepSnapshots must be an array.");
  }

  return {
    stepSnapshots: stepSnapshotsValue.map((snapshot) =>
      combatRoundStepSnapshotSchema.parse(snapshot),
    ),
  };
}

function parsePhaseAttackBackOutBody(body: unknown): {
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Phase attack back-out payload");
  const parsed = parseParticipantCommandBody(value, "Phase attack back-out payload");

  return {
    ...parsed,
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

function parseCombatAttackBody(body: unknown): {
  actionId?: string;
  defenderDb?: number;
  defenderScenarioParticipantId: string;
  ob?: number;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
  weaponCriticalCode?: string;
  weaponDamageClass?: string;
  weaponName?: string;
} {
  const value = parseBodyObject(body, "Combat attack payload");
  const parsed = parseParticipantCommandBody(value, "Combat attack payload");
  const defenderScenarioParticipantId = parseNonEmptyString(
    value.defenderScenarioParticipantId,
    "defenderScenarioParticipantId",
  );
  const phase = combatRoundPhaseSchema.parse(value.phase);
  const actionId =
    typeof value.actionId === "string" && value.actionId.trim().length > 0
      ? value.actionId
      : undefined;
  const weaponName =
    typeof value.weaponName === "string" && value.weaponName.trim().length > 0
      ? value.weaponName
      : undefined;
  const weaponCriticalCode =
    typeof value.weaponCriticalCode === "string" && value.weaponCriticalCode.trim().length > 0
      ? value.weaponCriticalCode
      : undefined;
  const weaponDamageClass =
    typeof value.weaponDamageClass === "string" && value.weaponDamageClass.trim().length > 0
      ? value.weaponDamageClass
      : undefined;

  return {
    ...parsed,
    actionId,
    defenderDb: parseOptionalInteger(value.defenderDb, "defenderDb"),
    defenderScenarioParticipantId,
    ob: parseOptionalInteger(value.ob, "ob"),
    phase,
    weaponCriticalCode,
    weaponDamageClass,
    weaponName,
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

function parseCombatParryModifierBreakdown(
  value: unknown,
): Array<{ label: string; value: number }> {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("modifierBreakdown must be an array.");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`modifierBreakdown[${index}] must be an object.`);
    }

    const candidate = entry as Record<string, unknown>;

    return {
      label: parseNonEmptyString(candidate.label, `modifierBreakdown[${index}].label`),
      value: parseInteger(candidate.value, `modifierBreakdown[${index}].value`),
    };
  });
}

function parseCombatParryBody(body: unknown): {
  attackResultId: string;
  mainHandParryScore?: number;
  modifierBreakdown: Array<{ label: string; value: number }>;
  offHandParryScore?: number;
  parryBase: number;
  parrySourceLabel?: string;
  scenarioParticipantId: string;
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

  return {
    ...parsed,
    attackResultId,
    mainHandParryScore: parseOptionalInteger(value.mainHandParryScore, "mainHandParryScore"),
    modifierBreakdown: parseCombatParryModifierBreakdown(value.modifierBreakdown),
    offHandParryScore: parseOptionalInteger(value.offHandParryScore, "offHandParryScore"),
    parryBase: parseInteger(value.parryBase, "parryBase"),
    parrySourceLabel,
    usedMainHand: parseOptionalBoolean(value.usedMainHand, "usedMainHand"),
    usedOffHand: parseOptionalBoolean(value.usedOffHand, "usedOffHand"),
  };
}

function parseCombatAttackerPrivilegedRollBody(body: unknown): {
  attackResultId: string;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Combat attacker roll payload");
  const parsed = parseParticipantCommandBody(value, "Combat attacker roll payload");
  const attackResultId = value.attackResultId;

  if (typeof attackResultId !== "string" || attackResultId.trim().length === 0) {
    throw new Error("attackResultId is required.");
  }

  return {
    ...parsed,
    attackResultId,
  };
}

function parseCombatDamageReviewBody(body: unknown): {
  review: Omit<CombatRoundDamageReview, "reviewedAt" | "reviewedByUserId">;
} {
  const value = parseBodyObject(body, "Combat damage review payload");

  if (!value.review || typeof value.review !== "object" || Array.isArray(value.review)) {
    throw new Error("review is required.");
  }

  return {
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

function combatRoundStatesDiffer(
  left: CombatRoundState | undefined,
  right: CombatRoundState | undefined,
): boolean {
  return JSON.stringify(left ?? null) !== JSON.stringify(right ?? null);
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

function normalizeWeaponName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : undefined;
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

function getEquipmentItemTemplate(input: {
  itemId: string;
  itemsById: Record<string, unknown>;
  templatesById: Record<string, unknown> | undefined;
}): WeaponTemplate | undefined {
  const item = input.itemsById[input.itemId];
  const templateId = isRecord(item) ? item["templateId"] : undefined;
  const template = typeof templateId === "string" ? input.templatesById?.[templateId] : undefined;

  if (isWeaponTemplateLike(template)) {
    return template;
  }

  const contentTemplate =
    typeof templateId === "string"
      ? weaponTemplates.find((candidate) => candidate.id === templateId)
      : undefined;

  return isWeaponTemplateLike(contentTemplate) ? contentTemplate : undefined;
}

function getSnapshotActiveWeaponTemplates(participant: ScenarioParticipant): WeaponTemplate[] {
  const equipmentState = getSnapshotEquipmentState(participant);
  const activeLoadoutsValue = equipmentState?.["activeLoadoutByCharacterId"];
  const activeLoadouts = isRecord(activeLoadoutsValue) ? activeLoadoutsValue : undefined;
  const characterId =
    participant.characterId ??
    (activeLoadouts ? Object.keys(activeLoadouts).find((key) => key.trim().length > 0) : undefined);
  const activeLoadoutValue = characterId ? activeLoadouts?.[characterId] : undefined;
  const activeLoadout = isRecord(activeLoadoutValue) ? activeLoadoutValue : undefined;
  const activeWeaponItemIds = [
    activeLoadout?.["activePrimaryWeaponItemId"],
    activeLoadout?.["activeSecondaryWeaponItemId"],
    activeLoadout?.["activeMissileWeaponItemId"],
  ].filter((itemId): itemId is string => typeof itemId === "string" && itemId.length > 0);
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

function findAttackWeaponTemplateByName(input: {
  participant: ScenarioParticipant;
  weaponName?: string;
}): WeaponTemplate | undefined {
  const weaponName = normalizeWeaponName(input.weaponName);

  if (!weaponName) {
    return undefined;
  }

  const candidates = [
    ...getSnapshotActiveWeaponTemplates(input.participant),
    ...getSnapshotWeaponTemplates(input.participant),
    ...weaponTemplates,
  ];
  const exactMatch = candidates.find(
    (template) => normalizeWeaponName(template.name) === weaponName,
  );

  if (exactMatch) {
    return exactMatch;
  }

  return candidates.find((template) => {
    const templateName = normalizeWeaponName(template.name);

    return (
      Boolean(templateName) &&
      (weaponName.startsWith(`${templateName} `) || weaponName.startsWith(`${templateName}+`))
    );
  });
}

function getDefaultAttackWeaponTemplate(
  participant: ScenarioParticipant,
): WeaponTemplate | undefined {
  return (
    getSnapshotActiveWeaponTemplates(participant)[0] ?? getSnapshotWeaponTemplates(participant)[0]
  );
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

function buildDistanceDefaultWeaponsByParticipantId(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
}): Record<string, readonly CombatDistanceWeaponLike[]> {
  return Object.fromEntries(
    input.encounter.participants.map((encounterParticipant) => {
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
  const roundState = initializeCombatRoundState({
    encounter: input.encounter,
    weaponsByParticipantId: buildDistanceDefaultWeaponsByParticipantId(input),
  });

  return materializeCombatRoundDistanceDefaults({
    encounter: input.encounter,
    roundState,
    scenarioParticipants: input.scenarioParticipants,
  });
}

function buildCombatActionDistanceModifierInputs(input: {
  actionId?: string;
  encounterParticipant: EncounterSession["participants"][number];
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phase: "phase1" | "phase2";
  phaseWeaponName?: string;
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

  const weaponTemplate =
    findAttackWeaponTemplateByName({
      participant: input.scenarioParticipant,
      weaponName: input.phaseWeaponName,
    }) ?? getDefaultAttackWeaponTemplate(input.scenarioParticipant);
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
    weaponName: weaponTemplate?.name ?? input.phaseWeaponName,
  };
}

function buildCombatActionDistanceModifierInputsForDeclaration(input: {
  actionId?: string;
  encounterParticipant: EncounterSession["participants"][number];
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseWeaponNames?: Partial<Record<"phase1" | "phase2", string | undefined>>;
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
        phaseWeaponName: input.phaseWeaponNames?.[phase],
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

function getDistanceModifierValueFromSnapshot(input: {
  phase: "phase1" | "phase2";
  snapshot: CombatRoundState["stepSnapshots"][number] | undefined;
}): number {
  return findExistingDistanceModifierEntryFromSnapshot(input)?.value ?? 0;
}

function applyGeneratedCombatActionModifiersForDeclaration(input: {
  actionId?: string;
  combatContext: ScenarioParticipantCombatContext;
  encounterParticipant: EncounterSession["participants"][number];
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseWeaponNames?: Partial<Record<"phase1" | "phase2", string | undefined>>;
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
    combatContext: input.combatContext,
    distanceModifiers: buildCombatActionDistanceModifierInputsForDeclaration({
      actionId: input.actionId,
      encounterParticipant: input.encounterParticipant,
      movementIntent: input.movementIntent,
      phaseContexts: input.phaseContexts,
      phaseWeaponNames: input.phaseWeaponNames,
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
      encounterParticipant,
      movementIntent: declaration.movementIntent,
      phaseContexts: declaration.phaseContexts,
      roundState: input.roundState,
      scenarioParticipant,
      secondaryActionId: declaration.secondaryActionId,
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
  const membership = resolveEncounterParticipantMembership({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
  });

  return membership.participants.filter((encounterParticipant) => {
    const scenarioParticipant = input.scenarioParticipants.find(
      (participant) =>
        participant.id === encounterParticipant.scenarioParticipantId ||
        participant.id === encounterParticipant.id ||
        (encounterParticipant.characterId &&
          participant.characterId === encounterParticipant.characterId),
    );

    return scenarioParticipant?.controlledByUserId === input.userId;
  });
}

function getEncounterParticipantIdsControlledByUser(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): Set<string> {
  return new Set(
    getEncounterParticipantsControlledByUser(input).flatMap((participant) =>
      getCombatDistanceParticipantAliases(participant),
    ),
  );
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
  const membership = resolveEncounterParticipantMembership({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
  });
  const controlledEncounterParticipants = getEncounterParticipantsControlledByUser(input);
  const controlledEncounterParticipantIds = getEncounterParticipantIdsControlledByUser(input);
  const visibility = input.encounter.roleplayState?.visibility;
  const hasVisibilityRows = Object.keys(visibility ?? {}).length > 0;
  const visibleParticipantIds = new Set(
    membership.participants
      .filter(
        (participant) =>
          controlledEncounterParticipants.some((controlled) => controlled.id === participant.id) ||
          !hasVisibilityRows ||
          controlledEncounterParticipants.some((viewer) =>
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

  if (input.proposal.status === "committed") {
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
    participants: roundState.participants.map((participant) =>
      controlledEncounterParticipantIds.has(participant.participantId)
        ? participant
        : {
            ...participant,
            declaration: participant.declaration
              ? {
                  ...participant.declaration,
                  additionalActionNotes: undefined,
                  movementIntent: undefined,
                }
              : undefined,
          },
    ),
    roundEndReview: safeRoundEndReview,
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
  return {
    ...input.encounter,
    combatRoundState: buildPlayerSafeCombatRoundStateForUser(input),
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

      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
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
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

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
        ? body.combatContext
        : preservePlayerCombatModifierBuckets({
            existingContext: existingCombatContext,
            requestedContext: body.combatContext,
          });
      const submittedCombatContext = applyGeneratedCombatActionModifiersForDeclaration({
        actionId: body.actionId,
        combatContext: baseSubmittedCombatContext,
        encounterParticipant,
        movementIntent: body.movementIntent,
        phaseContexts: submittedPhaseContexts,
        phaseWeaponNames: body.phaseWeaponNames,
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

      const submittedMovementIntent = normalizeCombatDeclarationMovementIntent({
        encounter,
        encounterParticipant,
        gmAuthorizedOperation,
        movementIntent: body.movementIntent,
        roundState,
      });

      const targetValidation = validateCombatDeclarationTargets({
        actionId: body.actionId,
        phaseContexts: submittedPhaseContexts,
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
          additionalActionNotes: body.additionalActionNotes,
          combatContext: submittedCombatContext,
          movementId: body.movementId,
          movementIntent: submittedMovementIntent,
          phaseContexts: submittedPhaseContexts,
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
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

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
      const rolledInitiative = buildCombatRoundInitiativeResult({
        baseInitiative: body.initiativeBase,
        modifierAdjustment: body.initiativeModifierAdjustment,
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
        const scenarioParticipant = scenarioParticipants.find(
          (participant) => participant.id === body.scenarioParticipantId,
        );
        const membership = resolveEncounterParticipantMembership({
          encounter,
          scenarioParticipants,
        });
        const encounterParticipant = scenarioParticipant
          ? membership.participants.find(
              (participant) =>
                participant.scenarioParticipantId === scenarioParticipant.id ||
                participant.id === scenarioParticipant.id ||
                (scenarioParticipant.characterId &&
                  participant.characterId === scenarioParticipant.characterId),
            )
          : undefined;

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

        if (
          combatExperienceTrigger === "combat_start" &&
          !isCombatRoundCombatExperienceWindowOpen(roundState)
        ) {
          return reply.code(409).send({
            error: "Combat Experience rolls are not open. Set Combat Experience difficulty first.",
          });
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
        const scenarioParticipant = scenarioParticipants.find(
          (participant) => participant.id === body.scenarioParticipantId,
        );
        const membership = resolveEncounterParticipantMembership({
          encounter,
          scenarioParticipants,
        });
        const encounterParticipant = scenarioParticipant
          ? membership.participants.find(
              (participant) =>
                participant.scenarioParticipantId === scenarioParticipant.id ||
                participant.id === scenarioParticipant.id ||
                (scenarioParticipant.characterId &&
                  participant.characterId === scenarioParticipant.characterId),
            )
          : undefined;

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
        const rolled = rollCombatRoundEndDistanceControl({
          command: {
            createdAt: submittedAt,
            createdByUserId: user.id,
          },
          distanceProposalId: body.distanceProposalId,
          participantId: encounterParticipant.id,
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

        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const currentTask = getNextCombatRoundEndTask({ state: roundState });

        if (currentTask?.kind !== "distance_roll") {
          throw new Error("No current distance-control roll is open.");
        }

        const submittedAt = new Date().toISOString();
        const rolled = rollCombatRoundEndDistanceControl({
          command: {
            createdAt: submittedAt,
            createdByUserId: user.id,
          },
          distanceProposalId: currentTask.distanceProposalId,
          participantId: currentTask.participantId,
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
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

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
      const rolled = rollCombatRoundEndHealthCheck({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        combatEffects: scenarioParticipant.state.combatEffects,
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
        const scenarioParticipant = scenarioParticipants.find(
          (participant) => participant.id === body.scenarioParticipantId,
        );
        const membership = resolveEncounterParticipantMembership({
          encounter,
          scenarioParticipants,
        });
        const encounterParticipant = scenarioParticipant
          ? membership.participants.find(
              (participant) =>
                participant.scenarioParticipantId === scenarioParticipant.id ||
                participant.id === scenarioParticipant.id ||
                (scenarioParticipant.characterId &&
                  participant.characterId === scenarioParticipant.characterId),
            )
          : undefined;

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
        const scenarioParticipant = scenarioParticipants.find(
          (participant) => participant.id === body.scenarioParticipantId,
        );
        const membership = resolveEncounterParticipantMembership({
          encounter,
          scenarioParticipants,
        });
        const encounterParticipant = scenarioParticipant
          ? membership.participants.find(
              (participant) =>
                participant.scenarioParticipantId === scenarioParticipant.id ||
                participant.id === scenarioParticipant.id ||
                (scenarioParticipant.characterId &&
                  participant.characterId === scenarioParticipant.characterId),
            )
          : undefined;

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
          error: "Only GM users can advance combat round steps.",
        });
      }

      const body = parseCombatRoundAdvanceBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const submittedAt = new Date().toISOString();
      const nextRoundState = advanceCombatRoundStep(roundState, {
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
          participantId: roundState.currentCursor?.participantId,
        },
        stepSnapshots: body.stepSnapshots,
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
      const commandEnvelope = buildCombatRoundCommandEnvelope({
        state: nextRoundState,
      });

      return {
        commandEnvelope,
        encounter: savedEncounter,
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to advance combat round step.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/skip-current-action", async (request, reply) => {
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
          error: "Only GM users can skip combat phase actions.",
        });
      }

      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const currentCursor = roundState.currentCursor;

      if (!currentCursor?.participantId) {
        throw new Error("No current combat action is open.");
      }

      const phase =
        currentCursor.step === "A1" ? "phase1" : currentCursor.step === "A2" ? "phase2" : undefined;

      if (!phase) {
        throw new Error("Current combat task is not a phase action.");
      }

      const submittedAt = new Date().toISOString();
      const nextRoundState = skipCombatRoundCurrentPhaseAction({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        participantId: currentCursor.participantId,
        phase,
        reason: "GM skipped action",
        state: roundState,
        submittedBy: "gm",
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
      const commandEnvelope = buildCombatRoundCommandEnvelope({
        state: nextRoundState,
      });

      return {
        commandEnvelope,
        encounter: savedEncounter,
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to skip current action.",
      });
    }
  });

  function getCanonicalCurrentPhaseResolutionTarget(
    roundState: ReturnType<typeof initializeCombatRoundState>,
  ): {
    ownerParticipantId: string;
    phase: "phase1" | "phase2";
  } {
    const cursor = roundState.phaseResolutionCursor;
    const currentCursor = roundState.currentCursor;
    const visibleParticipantId = cursor?.participantId ?? currentCursor?.participantId;
    const phase =
      cursor?.phase ??
      (currentCursor?.step === "A1" || currentCursor?.step === "P1" || currentCursor?.step === "D1"
        ? "phase1"
        : currentCursor?.step === "A2" ||
            currentCursor?.step === "P2" ||
            currentCursor?.step === "D2"
          ? "phase2"
          : undefined);

    if (!visibleParticipantId || !phase) {
      throw new Error("No current phase resolution task is open.");
    }

    const incomingAttackResult = getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
      participantId: visibleParticipantId,
      phase,
      state: roundState,
    });

    return {
      ownerParticipantId: incomingAttackResult?.attackerParticipantId ?? visibleParticipantId,
      phase,
    };
  }

  app.post(
    "/encounters/:encounterId/combat-round/advance-current-phase-resolution",
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
            error: "Only GM users can advance combat phase resolution.",
          });
        }

        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const { ownerParticipantId, phase } = getCanonicalCurrentPhaseResolutionTarget(roundState);
        const currentOwnerStatus = getCombatRoundPhaseResolutionStatus({
          participantId: ownerParticipantId,
          phase,
          state: roundState,
        });

        if (currentOwnerStatus.substep === "damage") {
          throw new Error("Damage review uses the damage-specific command path.");
        }

        const submittedAt = new Date().toISOString();
        const advancedRoundState = advanceCombatRoundPhaseResolutionSubstepForParticipant({
          participantId: ownerParticipantId,
          phase,
          state: roundState,
          updatedAt: submittedAt,
        });
        const nextOwnerStatus = getCombatRoundPhaseResolutionStatus({
          participantId: ownerParticipantId,
          phase,
          state: advancedRoundState,
        });
        const attackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: ownerParticipantId,
          phase,
          state: advancedRoundState,
        });
        const damageParticipantId = attackResult?.defenderParticipantId ?? ownerParticipantId;
        const damageCursorStep: "D1" | "D2" = phase === "phase1" ? "D1" : "D2";
        const damageReviewStep: "phase_1_damage" | "phase_2_damage" =
          phase === "phase1" ? "phase_1_damage" : "phase_2_damage";
        const nextRoundState =
          nextOwnerStatus.substep === "damage" || nextOwnerStatus.substep === "effects"
            ? {
                ...advancedRoundState,
                currentCursor: {
                  participantId: damageParticipantId,
                  roundNumber: advancedRoundState.roundNumber,
                  step: damageCursorStep,
                },
                currentStep: damageReviewStep,
                phaseResolutionCursor: {
                  participantId: damageParticipantId,
                  phase,
                  substep: nextOwnerStatus.substep,
                },
                selectedParticipantId: damageParticipantId,
                selectedStep: damageReviewStep,
              }
            : advancedRoundState;
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
        };
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error ? error.message : "Unable to advance combat phase resolution.",
        });
      }
    },
  );

  app.post(
    "/encounters/:encounterId/combat-round/complete-current-phase-resolution",
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
            error: "Only GM users can complete combat phase resolution.",
          });
        }

        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
        const roundState = initializeMaterializedCombatRoundState({
          encounter,
          scenarioParticipants,
        });
        const { ownerParticipantId, phase } = getCanonicalCurrentPhaseResolutionTarget(roundState);
        const submittedAt = new Date().toISOString();
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
              updatedAt: submittedAt,
            })
          : recordCombatRoundNoAttackPhaseReview({
              command: {
                createdAt: submittedAt,
                createdByUserId: user.id,
              },
              participantId: ownerParticipantId,
              phase,
              state: roundState,
              submittedBy: "gm",
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
        const commandEnvelope = buildCombatRoundCommandEnvelope({
          state: nextRoundState,
        });

        return {
          commandEnvelope,
          encounter: savedEncounter,
        };
      } catch (error) {
        return reply.code(400).send({
          error:
            error instanceof Error ? error.message : "Unable to complete combat phase resolution.",
        });
      }
    },
  );

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

      const { review } = parseCombatDamageReviewBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const { ownerParticipantId, phase } = getCanonicalCurrentPhaseResolutionTarget(roundState);
      const attackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: ownerParticipantId,
        phase,
        state: roundState,
      });

      if (!attackResult) {
        throw new Error("No current damage proposal is open.");
      }

      const attackResultId = getCombatRoundAttackResultId({
        result: attackResult,
        roundNumber: roundState.roundNumber,
      });
      const resolution = roundState.phaseResolutionResults.find(
        (candidate) => candidate.attackResultId === attackResultId,
      );

      if (!resolution?.damageResult) {
        throw new Error("No current damage proposal is open.");
      }

      const submittedAt = new Date().toISOString();
      const reviewedState = reviewCombatRoundDamageResult({
        attackResultId: resolution.damageResult.attackResultId,
        review,
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

      const { review } = parseCombatDamageReviewBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const roundState = initializeMaterializedCombatRoundState({
        encounter,
        scenarioParticipants,
      });
      const { ownerParticipantId, phase } = getCanonicalCurrentPhaseResolutionTarget(roundState);
      const attackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: ownerParticipantId,
        phase,
        state: roundState,
      });

      if (!attackResult) {
        throw new Error("No current damage proposal is open.");
      }

      const attackResultId = getCombatRoundAttackResultId({
        result: attackResult,
        roundNumber: roundState.roundNumber,
      });
      const resolution = roundState.phaseResolutionResults.find(
        (candidate) => candidate.attackResultId === attackResultId,
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
        review,
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
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const defenderScenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.defenderScenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;
      const defenderEncounterParticipant = defenderScenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === defenderScenarioParticipant.id ||
              participant.id === defenderScenarioParticipant.id ||
              (defenderScenarioParticipant.characterId &&
                participant.characterId === defenderScenarioParticipant.characterId),
          )
        : undefined;

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
      const existingAttackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: encounterParticipant.id,
        phase: body.phase,
        state: roundState,
      });

      if (existingAttackResult) {
        return reply.code(409).send({
          error: "Attack already rolled for this participant and phase.",
        });
      }

      const currentRollAction = getPlayerCombatCurrentRollAction({
        participantId: encounterParticipant.id,
        state: roundState,
      });

      if (currentRollAction?.kind !== "attack" || currentRollAction.phase !== body.phase) {
        return reply.code(409).send({
          error: "Attack is not open for this participant.",
        });
      }

      const attackerRoundParticipant = roundState.participants.find(
        (participant) => participant.participantId === encounterParticipant.id,
      );
      const declaredTargetId =
        attackerRoundParticipant?.declaration?.phaseContexts?.[body.phase]?.targetParticipantId;

      if (
        declaredTargetId &&
        declaredTargetId !== defenderScenarioParticipant.id &&
        declaredTargetId !== defenderEncounterParticipant.id
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
      const snapshotOb =
        parseCombatSummaryInteger(latestAttackerSnapshot?.attackSummary?.ob, "Attacker OB") ??
        body.ob;
      const weaponName = latestAttackerSnapshot?.attackSummary?.weaponName ?? body.weaponName;
      const defenderDb =
        parseCombatSummaryInteger(latestDefenderSnapshot?.defenseSummary?.db, "Defender DB") ??
        body.defenderDb;

      if (snapshotOb === undefined || !weaponName || defenderDb === undefined) {
        return reply.code(409).send({
          error: "Attack or defender combat summary is not available.",
        });
      }

      const submittedAt = new Date().toISOString();
      const actionId =
        body.actionId ?? attackerRoundParticipant?.declaration?.actionId ?? `${body.phase}_attack`;
      const attackerCombatContext = scenarioParticipantCombatContextSchema.parse(
        scenarioParticipant.state.combat.combatContext ?? {},
      );
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
      const persistedDistanceModifierValue = distanceModifierDetail?.value ?? 0;
      const snapshotDistanceModifierValue = latestAttackerSnapshot
        ? getDistanceModifierValueFromSnapshot({
            phase: body.phase,
            snapshot: latestAttackerSnapshot,
          })
        : persistedDistanceModifierValue;
      const ob = snapshotOb + persistedDistanceModifierValue - snapshotDistanceModifierValue;
      const roll = rollOpenEndedCombatToHitD20();
      const attackResult = buildCombatRoundAttackRollResult({
        actionId,
        attackerParticipantId: encounterParticipant.id,
        defenderDb,
        defenderParticipantId: defenderEncounterParticipant.id,
        ob,
        openEndedD10s: roll.openEndedD10s,
        phase: body.phase,
        rollD20: roll.rollD20,
        rollTotal: roll.rollTotal,
        rolledAt: submittedAt,
        rolledByUserId: user.id,
        weaponCriticalCode: body.weaponCriticalCode,
        weaponDamageClass: body.weaponDamageClass,
        weaponName,
      });
      const nextRoundState = recordCombatRoundAttackResult({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
          facts: {
            ...(distanceModifierDetail ? { distanceModifier: distanceModifierDetail } : {}),
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
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

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
      const currentRollAction = getPlayerCombatCurrentRollAction({
        participantId: encounterParticipant.id,
        state: roundState,
      });

      if (
        currentRollAction?.kind !== "parry" ||
        currentRollAction.attackResultId !== body.attackResultId
      ) {
        return reply.code(409).send({
          error: "Parry is not open for this participant.",
        });
      }

      const attackResult = getCombatRoundAttackResultById({
        attackResultId: body.attackResultId,
        state: roundState,
      });

      if (!attackResult) {
        return reply.code(404).send({
          error: "Attack result not found.",
        });
      }

      const submittedAt = new Date().toISOString();
      const roll = rollOpenEndedD20();
      const parry = resolveCombatParry({
        parryBase: body.parryBase,
        rawModifiers: body.modifierBreakdown,
        rollTotal: roll.dieResult,
      });
      const parryResolution = {
        combinedParryScore: parry.parryBase,
        mainHandParryScore: body.mainHandParryScore,
        modifiedParryBeforeRoll: parry.parryBase + parry.modifierAdjustment,
        modifierAdjustment: parry.modifierAdjustment,
        modifierBreakdown: parry.rawModifiers.map((modifier) => ({ ...modifier })),
        notes:
          "Direction, location coverage, and multi-opponent source allocation are deferred in this first parry slice.",
        offHandParryScore: body.offHandParryScore,
        openEndedD10s: roll.openEndedD10s,
        parrySourceLabel: body.parrySourceLabel,
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
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
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

      if (attackResult.attackerParticipantId !== encounterParticipant.id) {
        return reply.code(403).send({
          error: "Only the attacking participant can roll hit location.",
        });
      }

      const currentRollAction = getPlayerCombatCurrentRollAction({
        participantId: encounterParticipant.id,
        state: roundState,
      });

      if (
        currentRollAction?.kind !== "hit_location" ||
        currentRollAction.attackResultId !== body.attackResultId
      ) {
        return reply.code(409).send({
          error: "Hit location is not open for this attack.",
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
      const dmb = parseCombatSummaryInteger(latestAttackerSnapshot?.attackSummary?.dmb, "DMB");
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
      const weaponArmorClass = normalizeCombatArmorModifierClass(
        latestAttackerSnapshot?.attackSummary?.attackMode,
      );
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
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
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

      if (attackResult.attackerParticipantId !== encounterParticipant.id) {
        return reply.code(403).send({
          error: "Only the attacking participant can roll the critical die.",
        });
      }

      const currentRollAction = getPlayerCombatCurrentRollAction({
        participantId: encounterParticipant.id,
        state: roundState,
      });

      if (
        currentRollAction?.kind !== "critical" ||
        currentRollAction.attackResultId !== body.attackResultId
      ) {
        return reply.code(409).send({
          error: "Critical roll is not open for this attack.",
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
          command.type === "back_out_phase_attack" &&
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
        removedAttackCommands.length > 0 ||
        removedPhaseInitiativeResolutionCommitCommands.length > 0 ||
        removedCommittedDamageCommands.length > 0 ||
        removedRoundEndParticipantReviewCommands.length > 0 ||
        removedRoundEndHealthCheckCommands.length > 0
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
                    nextState = clearScenarioParticipantCombatDeclaration({
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
