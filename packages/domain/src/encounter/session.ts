import { z } from "zod";

import type { ScenarioParticipant } from "../campaign/scenario";

const idSchema = z.string().min(1);

export const encounterKindSchema = z.enum(["combat", "roleplay"]);
export const encounterParticipantMembershipModeSchema = z.enum([
  "defaultAllActive",
  "explicit"
]);
export const encounterStatusSchema = z.enum([
  "setup",
  "planned",
  "active",
  "paused",
  "complete",
  "archived"
]);
export const encounterTurnOrderModeSchema = z.enum(["manual"]);
export const encounterFacingSchema = z.enum(["north", "east", "south", "west"]);
export const encounterOrientationSchema = z.enum(["neutral", "front", "side", "behind"]);
export const encounterParticipantTypeSchema = z.enum(["character", "ad-hoc", "scenario"]);
export const encounterActionTypeSchema = z.enum(["none", "attack", "move", "defend", "ready", "other"]);
export const encounterDefensePostureSchema = z.enum([
  "none",
  "guard",
  "parry",
  "shield",
  "full-defense"
]);
export const encounterTargetLocationSchema = z.enum(["any", "head", "torso", "arm", "leg"]);
export const encounterDefenseFocusSchema = z.enum([
  "none",
  "self",
  "weapon-side",
  "shield-side"
]);
export const encounterCombatOutcomeSchema = z.enum([
  "miss",
  "hit",
  "parried",
  "hit-pending-damage",
  "critical-pending",
  "critical-resolved"
]);
export const encounterCriticalStatusSchema = z.enum(["none", "pending", "resolved"]);
export const encounterCriticalTypeSchema = z.enum(["general", "limb"]);
export const encounterCriticalSeveritySchema = z.enum(["none", "minor", "major", "severe"]);

export const encounterPositionSchema = z.object({
  x: z.number().int().default(0),
  y: z.number().int().default(0),
  zone: z.string().min(1).default("center")
});

export const encounterParticipantDeclarationSchema = z.object({
  actionType: encounterActionTypeSchema.default("none"),
  defenseFocus: encounterDefenseFocusSchema.default("none"),
  defensePosture: encounterDefensePostureSchema.default("none"),
  shieldItemId: idSchema.optional(),
  targetLocation: encounterTargetLocationSchema.default("any"),
  targetParticipantId: idSchema.optional(),
  weaponItemId: idSchema.optional()
});

export const encounterAttackRollResultSchema = z.object({
  baseOb: z.number().int(),
  defenseTarget: z.number().int(),
  hit: z.boolean(),
  margin: z.number().int(),
  roll: z.number().int().min(1).max(100),
  total: z.number().int()
});

export const encounterDefenseRollResultSchema = z.object({
  dbApplied: z.boolean().default(false),
  dbValue: z.number().int().default(0),
  defending: z.boolean().default(false),
  parryAttempted: z.boolean().default(false),
  parryBase: z.number().int().default(0),
  parryRoll: z.number().int().min(1).max(100).optional(),
  parrySucceeded: z.boolean().default(false),
  parryTotal: z.number().int().optional(),
  selectedShieldItemId: idSchema.optional(),
  selectedWeaponItemId: idSchema.optional()
});

export const encounterHitLocationResultSchema = z.object({
  aimedLocation: encounterTargetLocationSchema.default("any"),
  resolvedLocation: encounterTargetLocationSchema,
  roll: z.number().int().min(1).max(100).optional()
});

export const encounterDamageResolutionSchema = z.object({
  armorLabel: z.string().min(1).optional(),
  armorValue: z.number().int().default(0),
  criticalPending: z.boolean().default(false),
  finalDamage: z.number().int().default(0),
  rawDamage: z.number().int().default(0),
  weaponArmorModifier: z.number().int().default(0)
});

export const encounterCriticalEffectSummarySchema = z.object({
  severity: encounterCriticalSeveritySchema.default("none"),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).default([])
});

export const encounterCriticalRollResultSchema = z.object({
  baseModifier: z.number().int().default(0),
  finalRoll: z.number().int().optional(),
  locationModifier: z.number().int().default(0),
  resultKey: z.string().min(1).optional(),
  resultRow: z.string().min(1).optional(),
  roll: z.number().int().min(1).max(100).optional(),
  totalModifier: z.number().int().default(0)
});

export const encounterCriticalResolutionSchema = z.object({
  effect: encounterCriticalEffectSummarySchema.optional(),
  provisionalRuleLabel: z.string().min(1).optional(),
  roll: encounterCriticalRollResultSchema.default({
    baseModifier: 0,
    locationModifier: 0,
    totalModifier: 0
  }),
  status: encounterCriticalStatusSchema.default("none"),
  triggerDamage: z.number().int().default(0),
  triggerThreshold: z.number().int().positive().optional(),
  type: encounterCriticalTypeSchema.optional()
});

export const encounterAttackResolutionSchema = z.object({
  attackerParticipantId: idSchema,
  attackRoll: encounterAttackRollResultSchema,
  critical: encounterCriticalResolutionSchema.optional(),
  declaration: encounterParticipantDeclarationSchema,
  defenderParticipantId: idSchema,
  defense: encounterDefenseRollResultSchema,
  damage: encounterDamageResolutionSchema.optional(),
  encounterId: idSchema,
  hitLocation: encounterHitLocationResultSchema.optional(),
  id: idSchema,
  order: z.number().int().nonnegative(),
  outcome: encounterCombatOutcomeSchema,
  resolvedAt: z.string().min(1),
  roundNumber: z.number().int().positive(),
  selectedShieldItemId: idSchema.optional(),
  selectedWeaponItemId: idSchema.optional()
});

export const roleplayDifficultySchema = z.preprocess(
  (input) => (input === "critical_plus" ? "legendary" : input),
  z.enum([
    "trivial_success",
    "easy",
    "medium_minus",
    "medium",
    "medium_plus",
    "hard",
    "very_hard",
    "critical",
    "legendary",
    "godly"
  ])
);

const roleplayOptionalDifficultySchema = z.preprocess(
  (input) => (input === "none" ? undefined : input),
  roleplayDifficultySchema.optional()
);

export const roleplayParticipantDescriptionSchema = z.object({
  detailedDescription: z.string().default(""),
  name: z.string().min(1).optional(),
  shortDescription: z.string().default("")
});

const roleplayRollModifierSchema = z.object({
  otherMod: z.number().int().default(0),
  useDbMod: z.boolean().default(false),
  useGenMod: z.boolean().default(false),
  useObSkillMod: z.boolean().default(false)
});

export const roleplayRollSideSchema = z.enum(["actor", "opponent"]);

export const roleplayPendingSkillRollSchema = z.object({
  assignedAt: z.string().min(1),
  difficulty: roleplayOptionalDifficultySchema,
  id: idSchema,
  mode: z.enum(["difficulty", "opposed"]).default("difficulty"),
  opponentParticipantId: idSchema.optional(),
  opponentParticipantName: z.string().min(1).optional(),
  opponentSkillId: idSchema.optional(),
  opponentSkillLabel: z.string().min(1).optional(),
  opponentSkillValue: z.number().int().optional(),
  opponentSilent: z.boolean().default(false),
  opponentSupportSkillId: idSchema.optional(),
  opponentSupportSkillLabel: z.string().min(1).optional(),
  participantId: idSchema,
  rollSetId: idSchema.optional(),
  side: roleplayRollSideSchema.optional(),
  silent: z.boolean().default(false),
  skillId: idSchema,
  skillLabel: z.string().min(1),
  skillValue: z.number().int().optional(),
  supportSkillId: idSchema.optional(),
  supportSkillLabel: z.string().min(1).optional(),
  supportSkillValue: z.number().int().optional()
}).merge(roleplayRollModifierSchema);

export const roleplayActionLogEntrySchema = z.object({
  achievedSuccessLevelId: z.string().min(1).optional(),
  achievedSuccessLevelLabel: z.string().min(1).optional(),
  autoSuccess: z.boolean().default(false),
  calculationText: z.string().optional(),
  createdAt: z.string().min(1),
  dieResult: z.number().int().optional(),
  difficulty: roleplayOptionalDifficultySchema,
  finalTotal: z.number().int().optional(),
  fumble: z.boolean().default(false),
  id: idSchema,
  mode: z.enum(["difficulty", "opposed"]).default("difficulty"),
  numericSubtotal: z.number().int().optional(),
  openEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  opposedMargin: z.number().int().optional(),
  opposedResult: z.enum(["win", "loss", "tie", "pending"]).optional(),
  opponentAchievedSuccessLevelLabel: z.string().min(1).optional(),
  opponentDieResult: z.number().int().optional(),
  opponentFumble: z.boolean().default(false),
  opponentNumericSubtotal: z.number().int().optional(),
  opponentOpenEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  opponentParticipantId: idSchema.optional(),
  opponentParticipantName: z.string().min(1).optional(),
  opponentRollD20: z.number().int().min(1).max(20).optional(),
  opponentSkillId: idSchema.optional(),
  opponentSkillLabel: z.string().min(1).optional(),
  opponentSilent: z.boolean().default(false),
  opponentSupportSkillId: idSchema.optional(),
  opponentSupportSkillLabel: z.string().min(1).optional(),
  partial: z.boolean().default(false),
  pendingRollId: idSchema.optional(),
  participantId: idSchema.optional(),
  participantName: z.string().min(1).optional(),
  resultModifier: z.number().int().optional(),
  roll: z.number().int().optional(),
  rollD20: z.number().int().min(1).max(20).optional(),
  rollSetId: idSchema.optional(),
  side: roleplayRollSideSchema.optional(),
  silent: z.boolean().default(false),
  skillId: idSchema.optional(),
  skillLabel: z.string().optional(),
  skillValue: z.number().int().optional(),
  success: z.boolean().optional(),
  summary: z.string().min(1),
  supportCalculationText: z.string().optional(),
  supportDieResult: z.number().int().optional(),
  supportNumericSubtotal: z.number().int().optional(),
  supportOpenEndedD10s: z.array(z.number().int().min(1).max(10)).default([]),
  supportRollD20: z.number().int().min(1).max(20).optional(),
  supportSkillId: idSchema.optional(),
  supportSkillLabel: z.string().min(1).optional(),
  supportSkillValue: z.number().int().optional(),
  type: z.enum(["gm_message_updated", "skill_roll_assigned", "gm_skill_roll"])
}).merge(roleplayRollModifierSchema.partial());

export const roleplayStateSchema = z.object({
  actionLog: z.array(roleplayActionLogEntrySchema).default([]),
  currentRankedRollStackId: idSchema.optional(),
  gmMessage: z.string().default(""),
  participantDescriptions: z.record(idSchema, roleplayParticipantDescriptionSchema).default({}),
  pendingSkillRolls: z.array(roleplayPendingSkillRollSchema).default([]),
  visibility: z.record(idSchema, z.record(idSchema, z.boolean())).default({})
});

export const encounterParticipantSchema = z.object({
  adHocName: z.string().min(1).optional(),
  characterId: idSchema.optional(),
  declaration: encounterParticipantDeclarationSchema.default({
    actionType: "none",
    defenseFocus: "none",
    defensePosture: "none",
    targetLocation: "any"
  }),
  facing: encounterFacingSchema.default("north"),
  id: idSchema,
  initiative: z.number().int().default(0),
  label: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  orientation: encounterOrientationSchema.default("neutral"),
  participantType: encounterParticipantTypeSchema,
  position: encounterPositionSchema.default({
    x: 0,
    y: 0,
    zone: "center"
  }),
  scenarioParticipantId: idSchema.optional()
});

export const encounterSessionSchema = z.object({
  actionLog: z.array(encounterAttackResolutionSchema).default([]),
  campaignId: idSchema.optional(),
  createdAt: z.string().min(1),
  currentRound: z.number().int().positive().default(1),
  currentTurnIndex: z.number().int().nonnegative().default(0),
  declarationsLocked: z.boolean().default(false),
  description: z.string().optional(),
  id: idSchema,
  kind: encounterKindSchema.default("combat"),
  participantMembershipMode: encounterParticipantMembershipModeSchema.optional(),
  participants: z.array(encounterParticipantSchema).default([]),
  roleplayState: roleplayStateSchema.optional(),
  scenarioId: idSchema.optional(),
  status: encounterStatusSchema.default("setup"),
  timelineLabel: z.string().optional(),
  title: z.string().min(1),
  turnOrderMode: encounterTurnOrderModeSchema.default("manual"),
  updatedAt: z.string().min(1)
});

export type EncounterStatus = z.infer<typeof encounterStatusSchema>;
export type EncounterKind = z.infer<typeof encounterKindSchema>;
export type EncounterParticipantMembershipMode = z.infer<
  typeof encounterParticipantMembershipModeSchema
>;
export type EncounterTurnOrderMode = z.infer<typeof encounterTurnOrderModeSchema>;
export type EncounterFacing = z.infer<typeof encounterFacingSchema>;
export type EncounterOrientation = z.infer<typeof encounterOrientationSchema>;
export type EncounterParticipantType = z.infer<typeof encounterParticipantTypeSchema>;
export type EncounterActionType = z.infer<typeof encounterActionTypeSchema>;
export type EncounterDefensePosture = z.infer<typeof encounterDefensePostureSchema>;
export type EncounterTargetLocation = z.infer<typeof encounterTargetLocationSchema>;
export type EncounterDefenseFocus = z.infer<typeof encounterDefenseFocusSchema>;
export type EncounterCombatOutcome = z.infer<typeof encounterCombatOutcomeSchema>;
export type EncounterCriticalStatus = z.infer<typeof encounterCriticalStatusSchema>;
export type EncounterCriticalType = z.infer<typeof encounterCriticalTypeSchema>;
export type EncounterCriticalSeverity = z.infer<typeof encounterCriticalSeveritySchema>;
export type EncounterPosition = z.infer<typeof encounterPositionSchema>;
export type EncounterParticipantDeclaration = z.infer<typeof encounterParticipantDeclarationSchema>;
export type EncounterAttackRollResult = z.infer<typeof encounterAttackRollResultSchema>;
export type EncounterDefenseRollResult = z.infer<typeof encounterDefenseRollResultSchema>;
export type EncounterHitLocationResult = z.infer<typeof encounterHitLocationResultSchema>;
export type EncounterDamageResolution = z.infer<typeof encounterDamageResolutionSchema>;
export type EncounterCriticalEffectSummary = z.infer<typeof encounterCriticalEffectSummarySchema>;
export type EncounterCriticalRollResult = z.infer<typeof encounterCriticalRollResultSchema>;
export type EncounterCriticalResolution = z.infer<typeof encounterCriticalResolutionSchema>;
export type RoleplayDifficulty = z.infer<typeof roleplayDifficultySchema>;
export type RoleplayParticipantDescription = z.infer<typeof roleplayParticipantDescriptionSchema>;
export type RoleplayRollSide = z.infer<typeof roleplayRollSideSchema>;
export type RoleplayPendingSkillRoll = z.infer<typeof roleplayPendingSkillRollSchema>;
export type RoleplayActionLogEntry = z.infer<typeof roleplayActionLogEntrySchema>;
export type RoleplayState = z.infer<typeof roleplayStateSchema>;
export type EncounterAttackResolution = z.infer<typeof encounterAttackResolutionSchema>;
export type EncounterParticipant = z.infer<typeof encounterParticipantSchema>;

export interface EffectiveEncounterParticipants {
  explicitMode: boolean;
  participants: EncounterParticipant[];
  source: "defaultFallback" | "explicit";
}

export function resolveEncounterParticipantMembership(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
}): EffectiveEncounterParticipants {
  const explicitMode =
    input.encounter.participantMembershipMode === "explicit" ||
    input.encounter.participants.length > 0;

  if (explicitMode) {
    return {
      explicitMode: true,
      participants: input.encounter.participants,
      source: "explicit",
    };
  }

  return {
    explicitMode: false,
    participants: input.scenarioParticipants
      .filter((participant) => participant.scenarioId === input.encounter.scenarioId)
      .filter((participant) => participant.isActive)
      .map((participant, index) => ({
        declaration: {
          actionType: "none",
          defenseFocus: "none",
          defensePosture: "none",
          targetLocation: "any",
        },
        facing: "north",
        id: `scenario-fallback-${participant.id}`,
        initiative: 0,
        label: participant.snapshot.displayName,
        order: participant.displayOrder ?? index,
        orientation: "neutral",
        participantType: "scenario",
        position: {
          x: 0,
          y: 0,
          zone: "center",
        },
        scenarioParticipantId: participant.id,
      })),
    source: "defaultFallback",
  };
}

export function resolveEncounterParticipantByRollParticipantId(input: {
  participantId?: string | null;
  participants: EncounterParticipant[];
}): EncounterParticipant | undefined {
  if (!input.participantId) {
    return undefined;
  }

  return (
    input.participants.find((participant) => participant.id === input.participantId) ??
    input.participants.find(
      (participant) =>
        participant.scenarioParticipantId === input.participantId ||
        participant.characterId === input.participantId
    )
  );
}

export function formatEncounterParticipantMembershipLabel(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
}): string {
  const membership = resolveEncounterParticipantMembership(input);

  return membership.source === "defaultFallback"
    ? `${membership.participants.length} active scenario participants (default)`
    : `${membership.participants.length} assigned`;
}

export function isUserAssignedToEncounterMembership(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
  userId?: string | null;
}): boolean {
  if (!input.userId || input.encounter.status === "archived") {
    return false;
  }

  const controlledScenarioParticipants = input.scenarioParticipants.filter(
    (participant) =>
      participant.isActive &&
      participant.role === "player_character" &&
      participant.controlledByUserId === input.userId
  );
  const controlledScenarioParticipantIds = new Set(
    controlledScenarioParticipants.map((participant) => participant.id)
  );
  const controlledCharacterIds = new Set(
    controlledScenarioParticipants
      .map((participant) => participant.characterId)
      .filter((characterId): characterId is string => Boolean(characterId))
  );
  const membership = resolveEncounterParticipantMembership(input);

  return membership.participants.some(
    (participant) =>
      (participant.scenarioParticipantId &&
        controlledScenarioParticipantIds.has(participant.scenarioParticipantId)) ||
      (participant.characterId && controlledCharacterIds.has(participant.characterId))
  );
}
export type EncounterSession = z.infer<typeof encounterSessionSchema>;

export function buildPlayerSafeRoleplayState(state: RoleplayState): RoleplayState {
  return {
    actionLog: state.actionLog.filter((entry) => !entry.silent),
    gmMessage: state.gmMessage,
    participantDescriptions: {},
    pendingSkillRolls: state.pendingSkillRolls.filter((roll) => !roll.silent),
    visibility: {}
  };
}

function getEncounterParticipantIdentityKeys(participant: EncounterParticipant): string[] {
  return [
    participant.id,
    participant.scenarioParticipantId,
    participant.scenarioParticipantId ? `scenario-${participant.scenarioParticipantId}` : undefined,
    participant.characterId,
  ].filter((key, index, keys): key is string => Boolean(key) && keys.indexOf(key) === index);
}

function isEncounterParticipantControlledByUser(input: {
  participant: EncounterParticipant;
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): boolean {
  return input.scenarioParticipants.some(
    (scenarioParticipant) =>
      scenarioParticipant.isActive &&
      scenarioParticipant.role === "player_character" &&
      scenarioParticipant.controlledByUserId === input.userId &&
      (
        scenarioParticipant.id === input.participant.scenarioParticipantId ||
        scenarioParticipant.id === input.participant.id ||
        (input.participant.characterId && scenarioParticipant.characterId === input.participant.characterId)
      )
  );
}

function canViewerSeeTarget(input: {
  state: RoleplayState;
  target: EncounterParticipant;
  viewer: EncounterParticipant;
}): boolean {
  const targetKeys = getEncounterParticipantIdentityKeys(input.target);

  return getEncounterParticipantIdentityKeys(input.viewer).some((viewerKey) => {
    const row = input.state.visibility[viewerKey];

    return targetKeys.some((targetKey) => Boolean(row?.[targetKey]));
  });
}

export function buildPlayerSafeRoleplayStateForUser(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): RoleplayState {
  const state = roleplayStateSchema.parse(input.encounter.roleplayState ?? {});
  const membership = resolveEncounterParticipantMembership({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
  });
  const controlledParticipants = membership.participants.filter((participant) =>
    isEncounterParticipantControlledByUser({
      participant,
      scenarioParticipants: input.scenarioParticipants,
      userId: input.userId,
    })
  );
  const visibleParticipants = membership.participants.filter(
    (participant) =>
      controlledParticipants.some((controlled) => controlled.id === participant.id) ||
      controlledParticipants.some((viewer) =>
        canViewerSeeTarget({
          state,
          target: participant,
          viewer,
        })
      )
  );
  const visibleIdentityKeys = new Set(visibleParticipants.flatMap(getEncounterParticipantIdentityKeys));
  const controlledIdentityKeys = new Set(controlledParticipants.flatMap(getEncounterParticipantIdentityKeys));
  const visibility = Object.fromEntries(
    [...controlledIdentityKeys]
      .map((viewerKey) => {
        const row = state.visibility[viewerKey];

        if (!row) {
          return undefined;
        }

        const safeRow = Object.fromEntries(
          Object.entries(row).filter(
            ([targetKey, visible]) => Boolean(visible) && visibleIdentityKeys.has(targetKey)
          )
        );

        return [viewerKey, safeRow] as const;
      })
      .filter((entry): entry is readonly [string, Record<string, boolean>] => Boolean(entry))
  );
  const participantDescriptions = Object.fromEntries(
    Object.entries(state.participantDescriptions).filter(([participantId]) =>
      visibleIdentityKeys.has(participantId)
    )
  );

  return {
    actionLog: state.actionLog.filter((entry) => !entry.silent),
    currentRankedRollStackId: state.currentRankedRollStackId,
    gmMessage: state.gmMessage,
    participantDescriptions,
    pendingSkillRolls: state.pendingSkillRolls.filter((roll) => !roll.silent),
    visibility,
  };
}
