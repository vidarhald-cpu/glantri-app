import { z } from "zod";

import type { ScenarioParticipant } from "../campaign/scenario";
import { glantriCharacteristicKeySchema } from "../character/profiles";
import { getCombatDistanceParticipantAliases } from "./combatDistance";
import { combatRoundStateSchema, type CombatRoundState } from "./combatRoundManager";
import type { EncounterParticipantReadSource } from "./combatReadModels";

const idSchema = z.string().min(1);
const encounterCombatRoundStateSchema = combatRoundStateSchema as z.ZodType<CombatRoundState>;

export const encounterKindSchema = z.enum(["combat", "roleplay"]);
export const encounterParticipantMembershipModeSchema = z.enum(["defaultAllActive", "explicit"]);
export const encounterCanonicalStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
]);
export const encounterStatusSchema = z.preprocess((input) => {
  if (input === "setup" || input === "planned") return "draft";
  if (input === "complete") return "completed";
  return input;
}, encounterCanonicalStatusSchema);
export const encounterTurnOrderModeSchema = z.enum(["manual"]);
export const encounterFacingSchema = z.enum(["north", "east", "south", "west"]);
export const encounterOrientationSchema = z.enum(["neutral", "front", "side", "behind"]);
export const encounterParticipantTypeSchema = z.enum(["character", "ad-hoc", "scenario"]);
export const encounterActionTypeSchema = z.enum([
  "none",
  "attack",
  "move",
  "defend",
  "ready",
  "other",
]);
export const encounterDefensePostureSchema = z.enum([
  "none",
  "guard",
  "parry",
  "shield",
  "full-defense",
]);
export const encounterTargetLocationSchema = z.enum(["any", "head", "torso", "arm", "leg"]);
export const encounterDefenseFocusSchema = z.enum(["none", "self", "weapon-side", "shield-side"]);
export const encounterCombatOutcomeSchema = z.enum([
  "miss",
  "hit",
  "parried",
  "hit-pending-damage",
  "critical-pending",
  "critical-resolved",
]);
export const encounterCriticalStatusSchema = z.enum(["none", "pending", "resolved"]);
export const encounterCriticalTypeSchema = z.enum(["general", "limb"]);
export const encounterCriticalSeveritySchema = z.enum(["none", "minor", "major", "severe"]);

export const encounterPositionSchema = z.object({
  x: z.number().int().default(0),
  y: z.number().int().default(0),
  zone: z.string().min(1).default("center"),
});

export const encounterParticipantDeclarationSchema = z.object({
  actionType: encounterActionTypeSchema.default("none"),
  defenseFocus: encounterDefenseFocusSchema.default("none"),
  defensePosture: encounterDefensePostureSchema.default("none"),
  shieldItemId: idSchema.optional(),
  targetLocation: encounterTargetLocationSchema.default("any"),
  targetParticipantId: idSchema.optional(),
  weaponItemId: idSchema.optional(),
});

export const encounterAttackRollResultSchema = z.object({
  baseOb: z.number().int(),
  defenseTarget: z.number().int(),
  hit: z.boolean(),
  margin: z.number().int(),
  roll: z.number().int().min(1).max(100),
  total: z.number().int(),
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
  selectedWeaponItemId: idSchema.optional(),
});

export const encounterHitLocationResultSchema = z.object({
  aimedLocation: encounterTargetLocationSchema.default("any"),
  resolvedLocation: encounterTargetLocationSchema,
  roll: z.number().int().min(1).max(100).optional(),
});

export const encounterDamageResolutionSchema = z.object({
  armorLabel: z.string().min(1).optional(),
  armorValue: z.number().int().default(0),
  criticalPending: z.boolean().default(false),
  finalDamage: z.number().int().default(0),
  rawDamage: z.number().int().default(0),
  weaponArmorModifier: z.number().int().default(0),
});

export const encounterCriticalEffectSummarySchema = z.object({
  severity: encounterCriticalSeveritySchema.default("none"),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
});

export const encounterCriticalRollResultSchema = z.object({
  baseModifier: z.number().int().default(0),
  finalRoll: z.number().int().optional(),
  locationModifier: z.number().int().default(0),
  resultKey: z.string().min(1).optional(),
  resultRow: z.string().min(1).optional(),
  roll: z.number().int().min(1).max(100).optional(),
  totalModifier: z.number().int().default(0),
});

export const encounterCriticalResolutionSchema = z.object({
  effect: encounterCriticalEffectSummarySchema.optional(),
  provisionalRuleLabel: z.string().min(1).optional(),
  roll: encounterCriticalRollResultSchema.default({
    baseModifier: 0,
    locationModifier: 0,
    totalModifier: 0,
  }),
  status: encounterCriticalStatusSchema.default("none"),
  triggerDamage: z.number().int().default(0),
  triggerThreshold: z.number().int().positive().optional(),
  type: encounterCriticalTypeSchema.optional(),
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
  selectedWeaponItemId: idSchema.optional(),
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
    "godly",
  ]),
);

const roleplayOptionalDifficultySchema = z.preprocess(
  (input) => (input === "none" ? undefined : input),
  roleplayDifficultySchema.optional(),
);

export const roleplayParticipantDescriptionSchema = z.object({
  detailedDescription: z.string().default(""),
  name: z.string().min(1).optional(),
  shortDescription: z.string().default(""),
});

const roleplayRollModifierSchema = z.object({
  otherMod: z.number().int().default(0),
  useDbMod: z.boolean().default(false),
  useGenMod: z.boolean().default(false),
  useObSkillMod: z.boolean().default(false),
});

export const roleplayRollSideSchema = z.enum(["actor", "opponent"]);

export const roleplayPendingSkillRollSchema = z
  .object({
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
    supportSkillValue: z.number().int().optional(),
  })
  .merge(roleplayRollModifierSchema);

export const roleplayPendingStatCheckSchema = z.object({
  assignedAt: z.string().min(1),
  difficulty: roleplayDifficultySchema,
  id: idSchema,
  participantId: idSchema,
  statId: glantriCharacteristicKeySchema,
  statLabel: z.string().min(1),
  statValue: z.number().int(),
});

export const roleplayActionLogEntrySchema = z
  .object({
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
    statId: glantriCharacteristicKeySchema.optional(),
    statLabel: z.string().min(1).optional(),
    statValue: z.number().int().optional(),
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
    type: z.enum([
      "gm_message_updated",
      "skill_roll_assigned",
      "gm_skill_roll",
      "stat_check_assigned",
      "stat_check_result",
    ]),
  })
  .merge(roleplayRollModifierSchema.partial());

export const roleplayStateSchema = z.object({
  actionLog: z.array(roleplayActionLogEntrySchema).default([]),
  currentRankedRollStackId: idSchema.optional(),
  gmMessage: z.string().default(""),
  participantDescriptions: z.record(idSchema, roleplayParticipantDescriptionSchema).default({}),
  pendingSkillRolls: z.array(roleplayPendingSkillRollSchema).default([]),
  pendingStatChecks: z.array(roleplayPendingStatCheckSchema).default([]),
  visibility: z.record(idSchema, z.record(idSchema, z.boolean())).default({}),
});

export const encounterParticipantSchema = z.object({
  adHocName: z.string().min(1).optional(),
  characterId: idSchema.optional(),
  declaration: encounterParticipantDeclarationSchema.default({
    actionType: "none",
    defenseFocus: "none",
    defensePosture: "none",
    targetLocation: "any",
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
    zone: "center",
  }),
  scenarioParticipantId: idSchema.optional(),
});

/**
 * The identity-bearing fields of a roster row — the only fields the identity
 * conditions below read, so a caller holding a persisted row, a submitted row or
 * a resolved one can be asked the same question.
 */
export interface EncounterParticipantIdentityLike {
  characterId?: string | null;
  id?: string | null;
  scenarioParticipantId?: string | null;
}

/**
 * An identity two rows can claim is not an identity.
 *
 * Every reader that answers a question about a combatant answers it against an
 * identity the roster carries, and it finds that row through the alias set
 * `getCombatDistanceParticipantAliases` derives — the row's own `id`, its
 * Scenario-participant mapping in both its bare and `scenario-` prefixed forms,
 * and its `characterId`. Those readers disagree about what to do when two rows
 * answer for one alias, because the question has no answer: there is no way to
 * tell whose state the GM's entry for that alias was meant to express, or whose
 * combatant a viewer who controls it controls.
 *
 * So the roster refuses the state rather than asking each reader to cope with
 * it. The condition is stated over the same alias helper the readers use, so a
 * form added there is covered here without a second enumeration.
 *
 * Returns the refusal message, or `undefined` when every row holds a distinct
 * identity.
 */
export function encounterRosterIdentityRefusal(
  participants: readonly EncounterParticipantIdentityLike[],
): string | undefined {
  const claimedBy = new Map<string, number>();

  for (const [index, participant] of participants.entries()) {
    for (const alias of getCombatDistanceParticipantAliases(participant)) {
      const firstClaimant = claimedBy.get(alias);

      if (firstClaimant !== undefined && firstClaimant !== index) {
        return `Two Encounter participants claim the identity ${alias}. Give every combatant a distinct identity.`;
      }

      claimedBy.set(alias, index);
    }
  }

  return undefined;
}

/**
 * A reference from one Encounter to an existing Campaign Item. The Item keeps
 * its canonical identity and ownership in the equipment aggregate; Encounter
 * state records only presence and audience.
 */
export const encounterItemReferenceSchema = z.object({
  itemId: idSchema,
  visibility: z.enum(["players", "gm_only"]),
});

/**
 * The Encounter session's field shape, before the roster identity condition below.
 *
 * Exported for the player-facing projection only, which needs the object's `shape`
 * to prove that every field a stored Encounter carries is named by a player-facing
 * schema. Nothing parses through this: `encounterSessionSchema` is the parse.
 */
export const encounterSessionObjectSchema = z.object({
  actionLog: z.array(encounterAttackResolutionSchema).default([]),
  campaignId: idSchema.optional(),
  combatRoundState: encounterCombatRoundStateSchema.optional(),
  createdAt: z.string().min(1),
  currentRound: z.number().int().positive().default(1),
  currentTurnIndex: z.number().int().nonnegative().default(0),
  declarationsLocked: z.boolean().default(false),
  description: z.string().optional(),
  gmPrivateClosingNote: z.string().optional(),
  id: idSchema,
  /** Present once Encounter references, rather than legacy Item tags, own presence. */
  itemReferencesVersion: z.literal(1).optional(),
  itemReferences: z.array(encounterItemReferenceSchema).optional(),
  kind: encounterKindSchema.default("combat"),
  participantMembershipMode: encounterParticipantMembershipModeSchema.optional(),
  participants: z.array(encounterParticipantSchema).default([]),
  /**
   * The roster the Encounter will run with from the next round, when the GM has changed it while
   * a round was already under way. Combatants enter and leave only between rounds, so the change
   * waits here and replaces `participants` at the round boundary.
   *
   * It is a holding field, not a record of anything: it is the whole next roster rather than a
   * list of additions and removals, it carries no round number, no order and no history, and it
   * is read at exactly one point — the round-end commit. Nothing in play depends on it, and no
   * combat rule refers to it. Absent means the in-force roster is the only roster.
   */
  pendingParticipants: z.array(encounterParticipantSchema).optional(),
  playerOutcome: z.string().optional(),
  roleplayState: roleplayStateSchema.optional(),
  scenarioId: idSchema.optional(),
  status: encounterStatusSchema.default("draft"),
  timelineLabel: z.string().optional(),
  title: z.string().min(1),
  turnOrderMode: encounterTurnOrderModeSchema.default("manual"),
  updatedAt: z.string().min(1),
});

/**
 * The roster identity condition is stated here rather than on a route, because the
 * schema is the one place every writer passes through: the roster `PATCH`, the
 * whole-session `PUT`, create, status change, pending-roster withdrawal, the
 * round-boundary commit that promotes `pendingParticipants`, the repository write
 * paths, and the offline local store all parse through this object. A condition on
 * one route is only a condition on that route.
 *
 * The in-force roster and the held roster are separate rosters and are each
 * required to be internally coherent; a held roster is a whole future roster, so a
 * collision placed there would become the roster in force at the next round
 * boundary.
 *
 * No tolerant read branch is owed. A roster that violates this could not be
 * written again, so a stored one is a state the readers have no reading for, and
 * failing the parse is the fail-closed direction.
 */
export const encounterSessionSchema = encounterSessionObjectSchema.superRefine(
  (session, context) => {
    const inForce = encounterRosterIdentityRefusal(session.participants);

    if (inForce) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: inForce, path: ["participants"] });
    }

    const held = session.pendingParticipants
      ? encounterRosterIdentityRefusal(session.pendingParticipants)
      : undefined;

    if (held) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: held,
        path: ["pendingParticipants"],
      });
    }
  },
);

export const encounterSessionSummarySchema = z
  .object({
    campaignId: idSchema.optional(),
    createdAt: z.string().min(1),
    id: idSchema,
    scenarioId: idSchema.optional(),
    status: encounterStatusSchema,
    title: z.string().min(1),
    updatedAt: z.string().min(1),
    viewerAssigned: z.boolean().optional(),
  })
  .strict();

export const encounterSessionRevisionSchema = z
  .object({
    encounterId: idSchema,
    revision: z.string().min(1),
    status: encounterStatusSchema,
    updatedAt: z.string().min(1),
  })
  .strict();

export type EncounterStatus = z.infer<typeof encounterStatusSchema>;
export type EncounterItemReference = z.infer<typeof encounterItemReferenceSchema>;
export type EncounterKind = z.infer<typeof encounterKindSchema>;
export type EncounterSessionSummary = z.infer<typeof encounterSessionSummarySchema>;
export type EncounterSessionRevision = z.infer<typeof encounterSessionRevisionSchema>;
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
export type RoleplayPendingStatCheck = z.infer<typeof roleplayPendingStatCheckSchema>;
export type RoleplayActionLogEntry = z.infer<typeof roleplayActionLogEntrySchema>;
export type RoleplayState = z.infer<typeof roleplayStateSchema>;
export type EncounterAttackResolution = z.infer<typeof encounterAttackResolutionSchema>;
export type EncounterParticipant = z.infer<typeof encounterParticipantSchema>;

export const encounterLifecycleTransitions: Readonly<
  Record<EncounterStatus, readonly EncounterStatus[]>
> = {
  active: ["paused"],
  archived: [],
  completed: ["archived"],
  draft: ["active", "archived"],
  paused: ["active", "completed"],
};

export function canTransitionEncounterStatus(
  current: EncounterStatus,
  next: EncounterStatus,
): boolean {
  return (
    current === next || encounterLifecycleTransitions[current].some((status) => status === next)
  );
}

export function isEncounterMutable(status: EncounterStatus): boolean {
  return status === "draft" || status === "active" || status === "paused";
}

export function isEncounterActivityAllowed(status: EncounterStatus): boolean {
  return status === "active";
}

export interface EffectiveEncounterParticipants {
  explicitMode: boolean;
  participants: EncounterParticipant[];
  source: "defaultFallback" | "explicit";
}

export interface ResolvedEncounterParticipantForViewer {
  active: true;
  access: "gm_perspective" | "player_controlled";
  characterId?: string;
  encounterParticipant: EncounterParticipant;
  encounterParticipantId: string;
  membershipSource: EffectiveEncounterParticipants["source"];
  scenarioParticipant: ScenarioParticipant;
  scenarioParticipantId: string;
  visible: true;
}

export type EncounterParticipantViewer = { kind: "gm" } | { kind: "player"; userId: string };

/**
 * The canonical correspondence between a roster row and a Scenario participant.
 *
 * It is stated over the identity-bearing fields only, so the roster identity
 * condition at the write boundary can ask exactly the question the readers ask
 * rather than keeping an enumeration of its own. A form added here is therefore
 * covered there too.
 */
export function encounterParticipantMatchesScenarioParticipant(input: {
  encounterParticipant: EncounterParticipantIdentityLike;
  scenarioParticipant: { characterId?: string | null; id: string };
}): boolean {
  return (
    input.encounterParticipant.scenarioParticipantId === input.scenarioParticipant.id ||
    input.encounterParticipant.id === input.scenarioParticipant.id ||
    input.encounterParticipant.id === `scenario-${input.scenarioParticipant.id}` ||
    Boolean(
      input.scenarioParticipant.characterId &&
      input.encounterParticipant.characterId === input.scenarioParticipant.characterId,
    )
  );
}

/**
 * A row's identity must describe the person its mapping describes.
 *
 * Roster uniqueness is a property of the roster alone, so the schema can state it.
 * This condition is not: a row's `id` can borrow the identity of a Scenario
 * participant who is not on the roster at all, and the document the schema sees
 * does not contain that participant. Driven on #947: a row carrying its own
 * `scenarioParticipantId` and another participant's `id` passes every roster-local
 * condition, passes the repository presence check, and makes that other
 * participant control the row.
 *
 * So it is asked where the Scenario participants are known — the write boundary,
 * next to the presence check that already refuses an incoherent roster there.
 *
 * The condition: the Scenario participants a row corresponds to must be no more
 * than the one it declares. A row that declares a mapping must correspond to that
 * participant and no other; a row that declares none — an ad-hoc combatant — must
 * correspond to at most one, because a second correspondence is the same ambiguity
 * without a declared answer.
 *
 * Returns the refusal message, or `undefined` when every row's identity describes
 * its own mapping.
 */
export function encounterRosterScenarioIdentityRefusal(input: {
  participants: readonly EncounterParticipantIdentityLike[];
  scenarioParticipants: readonly { characterId?: string | null; id: string }[];
}): string | undefined {
  for (const participant of input.participants) {
    const corresponding = input.scenarioParticipants.filter((scenarioParticipant) =>
      encounterParticipantMatchesScenarioParticipant({
        encounterParticipant: participant,
        scenarioParticipant,
      }),
    );
    const declared = participant.scenarioParticipantId;
    const foreign = declared
      ? corresponding.filter((scenarioParticipant) => scenarioParticipant.id !== declared)
      : corresponding.slice(1);

    if (foreign.length > 0) {
      return declared
        ? `Encounter participant ${participant.id} carries an identity belonging to Scenario participant ${foreign[0]!.id} rather than to its own ${declared}. Give every combatant its own identity.`
        : `Encounter participant ${participant.id} carries identities belonging to more than one Scenario participant. Give every combatant its own identity.`;
    }
  }

  return undefined;
}

/**
 * Whether a GM roster change has to wait for the round boundary instead of taking effect now.
 *
 * Combatants enter and leave only between rounds: after the GM commits round end and before the
 * first action of the next round. The round-end commit empties the command list, so a round that
 * has recorded no command of its own is still inside that window and a change made then applies
 * immediately. Anything after the first recorded command of a round waits.
 *
 * Only an Encounter that can still reach a round boundary holds anything. A completed or archived
 * Encounter keeps the round state of its last round, and a change held there would never apply.
 */
export function encounterRosterChangeWaitsForRoundBoundary(encounter: {
  combatRoundState?: CombatRoundState;
  status: EncounterStatus;
}): boolean {
  const state = encounter.combatRoundState;

  if (!state || !isEncounterMutable(encounter.status)) {
    return false;
  }

  return state.commands.some((command) => command.roundNumber === state.roundNumber);
}

/**
 * Which combatants an Encounter roster holds, as a value two rosters can be compared on.
 *
 * The ruling is about entering and leaving combat, so a roster change is a change to *who* is
 * present. `declaration`, `facing`, `initiative`, `label`, `order`, `orientation` and `position`
 * describe a combatant already in play and change freely during a round; the fields here are the
 * ones that say which combatant a row is. Order is not part of it either: re-ordering a roster
 * adds and removes nobody.
 *
 * Built from an array rather than an object so the comparison cannot turn on key order.
 */
function encounterRosterMembership(participants: EncounterParticipant[]): string {
  return JSON.stringify(
    participants
      .map((participant) =>
        JSON.stringify([
          participant.participantType,
          participant.id,
          participant.scenarioParticipantId ?? null,
          participant.characterId ?? null,
          participant.adHocName ?? null,
        ]),
      )
      .sort(),
  );
}

/**
 * Whether two Encounter rosters hold the same combatants — nobody has entered and nobody has left.
 *
 * This is what makes the between-rounds rule one rule rather than one rule per route. A route that
 * submits a whole Encounter session, rather than a roster, asks this to tell a GM roster change
 * from an ordinary save that happens to carry the roster it loaded.
 */
export function encounterRostersHoldTheSameCombatants(
  one: EncounterParticipant[],
  other: EncounterParticipant[],
): boolean {
  return encounterRosterMembership(one) === encounterRosterMembership(other);
}

/**
 * The membership mode governing the roster in force.
 *
 * An absent mode behaves as `explicit`, which is both what the roster routes have always defaulted
 * to and what an active Encounter is required to carry.
 */
export function encounterParticipantMembershipModeInForce(encounter: {
  participantMembershipMode?: EncounterParticipantMembershipMode;
}): EncounterParticipantMembershipMode {
  return encounter.participantMembershipMode ?? "explicit";
}

/**
 * Why a roster held for the round boundary could never take effect, or `undefined` when it could.
 *
 * A held roster is refused when it is submitted rather than when the boundary tries to write it,
 * so the GM is told at the point they can still do something about it and the round-end commit is
 * not left unable to advance. These are the structural conditions an active Encounter roster must
 * satisfy; the database-level conditions it also satisfies are rechecked when the roster is
 * actually written, and can still have changed by then.
 */
export function encounterHeldRosterRefusal(
  participants: EncounterParticipant[],
): string | undefined {
  const scenarioParticipantIds = participants.map(
    (participant) => participant.scenarioParticipantId,
  );

  if (scenarioParticipantIds.some((participantId) => !participantId)) {
    return "Every Encounter participant must belong to the Scenario.";
  }

  if (
    scenarioParticipantIds.length === 0 ||
    new Set(scenarioParticipantIds).size !== scenarioParticipantIds.length
  ) {
    return "Choose one or more distinct Scenario participants.";
  }

  return undefined;
}

/**
 * Which Encounters a combatant's Scenario participation is load-bearing for.
 *
 * An Encounter that is running requires every participant on its explicit roster to be an active
 * Scenario participant, so making one inactive is a removal from combat by another name — and the
 * participant set of a running Encounter is frozen (#850). Both rosters count: a held roster
 * becomes the roster in force at the next round boundary, so a combatant made inactive while only
 * waiting there would leave that boundary unable to write the roster it was promised.
 *
 * Only `active` Encounters are named. A draft, paused, completed or archived Encounter is running
 * no round, so nothing about it is made incoherent by a Scenario-level change; a draft or paused
 * one is refused its own activation later, by the presence check at the write, which is where that
 * belongs.
 */
export function encountersBlockingScenarioParticipantDeactivation<
  T extends {
    participants: Pick<EncounterParticipant, "scenarioParticipantId">[];
    pendingParticipants?: Pick<EncounterParticipant, "scenarioParticipantId">[];
    status: EncounterStatus;
  },
>(input: { encounters: readonly T[]; scenarioParticipantId: string }): T[] {
  return input.encounters.filter(
    (encounter) =>
      isEncounterActivityAllowed(encounter.status) &&
      [...encounter.participants, ...(encounter.pendingParticipants ?? [])].some(
        (participant) => participant.scenarioParticipantId === input.scenarioParticipantId,
      ),
  );
}

/**
 * What to tell a GM who tried to make a combatant of a running Encounter inactive.
 *
 * The refusal names the combatant, the Encounters that hold them, and both ways forward, because
 * the condition is recoverable in one action and the measured failure on #845 was that nothing
 * said which action. It deliberately does not say "refresh": the Scenario state the GM is looking
 * at is correct, and re-reading it changes nothing.
 *
 * `undefined` when no running Encounter holds the combatant, which is the ordinary case.
 */
export function scenarioParticipantDeactivationRefusal(input: {
  encounterTitles: readonly string[];
  participantDisplayName: string;
}): string | undefined {
  if (input.encounterTitles.length === 0) return undefined;

  const titles =
    input.encounterTitles.length === 1
      ? `the Encounter ${input.encounterTitles[0]}`
      : `the Encounters ${input.encounterTitles.slice(0, -1).join(", ")} and ${input.encounterTitles.at(-1)}`;

  return (
    `${input.participantDisplayName} is a combatant in ${titles}, which is under way, and combatants ` +
    "enter and leave only between rounds. Take them out of the Encounter roster instead — that " +
    "change applies at the next round boundary — or commit round end first and make them inactive " +
    "in the Scenario then."
  );
}

/**
 * The Encounter roster fields to persist when the round-end commit crosses into the next round.
 *
 * This is the one point that reads the waiting roster. It replaces the roster in force and stops
 * existing; it is never consulted again and leaves no trace of itself. With nothing waiting the
 * Encounter is returned unchanged, so an ordinary round-end commit writes exactly what it wrote
 * before.
 */
export function withEncounterRosterForNextRound<
  T extends {
    participants: EncounterParticipant[];
    pendingParticipants?: EncounterParticipant[];
  },
>(encounter: T): T {
  if (!encounter.pendingParticipants) {
    return encounter;
  }

  return {
    ...encounter,
    participants: encounter.pendingParticipants,
    pendingParticipants: undefined,
  };
}

export function resolveEncounterParticipantMembership(input: {
  encounter: EncounterParticipantReadSource;
  scenarioParticipants: ScenarioParticipant[];
}): EffectiveEncounterParticipants {
  const explicitMode =
    input.encounter.participantMembershipMode === "explicit" ||
    input.encounter.participants.length > 0;

  if (explicitMode) {
    return {
      explicitMode: true,
      participants: input.encounter.participants.map((encounterParticipant) => {
        const matchingScenarioParticipants = input.scenarioParticipants.filter(
          (scenarioParticipant) =>
            encounterParticipantMatchesScenarioParticipant({
              encounterParticipant,
              scenarioParticipant,
            }),
        );
        const scenarioParticipant =
          matchingScenarioParticipants.length === 1 ? matchingScenarioParticipants[0] : undefined;

        return scenarioParticipant
          ? {
              ...encounterParticipant,
              characterId: encounterParticipant.characterId ?? scenarioParticipant.characterId,
              scenarioParticipantId: scenarioParticipant.id,
            }
          : encounterParticipant;
      }),
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
        (participant.scenarioParticipantId &&
          `scenario-${participant.scenarioParticipantId}` === input.participantId) ||
        participant.characterId === input.participantId,
    )
  );
}

/**
 * Resolves one viewer-facing participant through the effective encounter roster.
 *
 * This is the canonical access/alias boundary for explicit encounter rows and
 * the legacy scenario fallback. Ambiguous aliases fail closed.
 */
export function resolveEncounterParticipantForViewer(input: {
  characterId?: string | null;
  encounter: EncounterParticipantReadSource;
  requestedParticipantId?: string | null;
  scenarioParticipants: ScenarioParticipant[];
  viewer: EncounterParticipantViewer;
}): ResolvedEncounterParticipantForViewer | undefined {
  if (input.encounter.status === "archived") {
    return undefined;
  }

  const membership = resolveEncounterParticipantMembership(input);
  const activeScenarioParticipants = input.scenarioParticipants.filter(
    (participant) =>
      participant.scenarioId === input.encounter.scenarioId &&
      participant.isActive &&
      (input.viewer.kind === "gm" || participant.role === "player_character"),
  );
  const requestedId = input.requestedParticipantId?.trim() || undefined;
  const characterId = input.characterId?.trim() || undefined;
  const exactEncounterParticipant = requestedId
    ? membership.participants.find((participant) => participant.id === requestedId)
    : undefined;
  const scenarioCandidates = activeScenarioParticipants.filter((scenarioParticipant) => {
    if (
      input.viewer.kind === "player" &&
      scenarioParticipant.controlledByUserId !== input.viewer.userId
    ) {
      return false;
    }

    if (characterId && scenarioParticipant.characterId !== characterId) {
      return false;
    }

    if (!requestedId) {
      return true;
    }

    return (
      scenarioParticipant.id === requestedId ||
      scenarioParticipant.characterId === requestedId ||
      Boolean(
        exactEncounterParticipant &&
        encounterParticipantMatchesScenarioParticipant({
          encounterParticipant: exactEncounterParticipant,
          scenarioParticipant,
        }),
      )
    );
  });
  const matches = scenarioCandidates.flatMap((scenarioParticipant) =>
    membership.participants
      .filter((encounterParticipant) =>
        encounterParticipantMatchesScenarioParticipant({
          encounterParticipant,
          scenarioParticipant,
        }),
      )
      .map((encounterParticipant) => ({ encounterParticipant, scenarioParticipant })),
  );
  const uniqueMatches = matches.filter(
    (match, index) =>
      matches.findIndex(
        (candidate) =>
          candidate.encounterParticipant.id === match.encounterParticipant.id &&
          candidate.scenarioParticipant.id === match.scenarioParticipant.id,
      ) === index,
  );

  if (uniqueMatches.length !== 1) {
    return undefined;
  }

  const { encounterParticipant, scenarioParticipant } = uniqueMatches[0]!;
  return Object.freeze({
    active: true,
    access: input.viewer.kind === "gm" ? "gm_perspective" : "player_controlled",
    characterId: scenarioParticipant.characterId ?? encounterParticipant.characterId,
    encounterParticipant,
    encounterParticipantId: encounterParticipant.id,
    membershipSource: membership.source,
    scenarioParticipant,
    scenarioParticipantId: scenarioParticipant.id,
    visible: true,
  });
}

export function formatEncounterParticipantMembershipLabel(input: {
  encounter: EncounterParticipantReadSource;
  scenarioParticipants: ScenarioParticipant[];
}): string {
  const membership = resolveEncounterParticipantMembership(input);

  return membership.source === "defaultFallback"
    ? `${membership.participants.length} active scenario participants (default)`
    : `${membership.participants.length} assigned`;
}

export function isUserAssignedToEncounterMembership(input: {
  encounter: EncounterParticipantReadSource;
  scenarioParticipants: ScenarioParticipant[];
  userId?: string | null;
}): boolean {
  if (!input.userId || input.encounter.status === "archived") {
    return false;
  }

  return input.scenarioParticipants.some(
    (participant) =>
      participant.controlledByUserId === input.userId &&
      Boolean(
        resolveEncounterParticipantForViewer({
          encounter: input.encounter,
          requestedParticipantId: participant.id,
          scenarioParticipants: input.scenarioParticipants,
          viewer: { kind: "player", userId: input.userId! },
        }),
      ),
  );
}

export function isUserEntitledToTerminalEncounterHistory(input: {
  encounter: EncounterParticipantReadSource;
  scenarioParticipants: ScenarioParticipant[];
  userId?: string | null;
}): boolean {
  if (
    !input.userId ||
    (input.encounter.status !== "completed" && input.encounter.status !== "archived")
  ) {
    return false;
  }

  const relationshipSource =
    input.encounter.status === "archived"
      ? { ...input.encounter, status: "completed" as const }
      : input.encounter;

  return input.scenarioParticipants.some(
    (participant) =>
      participant.controlledByUserId === input.userId &&
      Boolean(
        resolveEncounterParticipantForViewer({
          encounter: relationshipSource,
          requestedParticipantId: participant.id,
          scenarioParticipants: input.scenarioParticipants,
          viewer: { kind: "player", userId: input.userId! },
        }),
      ),
  );
}
export type EncounterSession = z.infer<typeof encounterSessionSchema>;

export function buildEncounterSessionSummary(
  encounter: EncounterSession,
  options?: {
    viewerAssigned?: boolean;
  },
): EncounterSessionSummary {
  return encounterSessionSummarySchema.parse({
    campaignId: encounter.campaignId,
    createdAt: encounter.createdAt,
    id: encounter.id,
    scenarioId: encounter.scenarioId,
    status: encounter.status,
    title: encounter.title,
    updatedAt: encounter.updatedAt,
    viewerAssigned: options?.viewerAssigned,
  });
}

export function buildEncounterSessionRevision(
  encounter: Pick<EncounterSessionSummary, "id" | "status" | "updatedAt">,
): EncounterSessionRevision {
  return encounterSessionRevisionSchema.parse({
    encounterId: encounter.id,
    revision: encounter.updatedAt,
    status: encounter.status,
    updatedAt: encounter.updatedAt,
  });
}

export function buildPlayerSafeRoleplayState(state: RoleplayState): RoleplayState {
  return {
    actionLog: [],
    currentRankedRollStackId: PLAYER_SAFE_EMPTY_RANKED_ROLL_STACK_ID,
    gmMessage: state.gmMessage,
    participantDescriptions: {},
    pendingSkillRolls: [],
    pendingStatChecks: [],
    visibility: {},
  };
}

const PLAYER_SAFE_EMPTY_RANKED_ROLL_STACK_ID = "player-safe-empty-ranked-roll-stack";
const PLAYER_SAFE_PUBLIC_RANKED_ROLL_STACK_ID = "player-safe-public-ranked-roll-stack";

function buildPublicRankedSkillResult(input: {
  entry: RoleplayActionLogEntry;
  rollStackId: string;
}): RoleplayActionLogEntry {
  return roleplayActionLogEntrySchema.parse({
    createdAt: "1970-01-01T00:00:00.000Z",
    fumble: input.entry.fumble,
    id: input.entry.id,
    mode: "difficulty",
    numericSubtotal: input.entry.numericSubtotal,
    participantId: input.entry.participantId,
    rollSetId: input.rollStackId,
    silent: false,
    skillId: input.entry.skillId,
    skillLabel: input.entry.skillLabel,
    summary: "Public Skill result.",
    type: "gm_skill_roll",
  });
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
      (scenarioParticipant.id === input.participant.scenarioParticipantId ||
        scenarioParticipant.id === input.participant.id ||
        (input.participant.characterId &&
          scenarioParticipant.characterId === input.participant.characterId)),
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
    }),
  );
  const visibleParticipants = membership.participants.filter(
    (participant) =>
      controlledParticipants.some((controlled) => controlled.id === participant.id) ||
      controlledParticipants.some((viewer) =>
        canViewerSeeTarget({
          state,
          target: participant,
          viewer,
        }),
      ),
  );
  const visibleIdentityKeys = new Set(
    visibleParticipants.flatMap(getEncounterParticipantIdentityKeys),
  );
  const controlledIdentityKeys = new Set(
    controlledParticipants.flatMap(getEncounterParticipantIdentityKeys),
  );
  const visibility = Object.fromEntries(
    [...controlledIdentityKeys]
      .map((viewerKey) => {
        const row = state.visibility[viewerKey];

        if (!row) {
          return undefined;
        }

        const safeRow = Object.fromEntries(
          Object.entries(row).filter(
            ([targetKey, visible]) => Boolean(visible) && visibleIdentityKeys.has(targetKey),
          ),
        );

        return [viewerKey, safeRow] as const;
      })
      .filter((entry): entry is readonly [string, Record<string, boolean>] => Boolean(entry)),
  );
  const participantDescriptions = Object.fromEntries(
    Object.entries(state.participantDescriptions).filter(([participantId]) =>
      visibleIdentityKeys.has(participantId),
    ),
  );
  const isControlledParticipantId = (participantId?: string): boolean => {
    const participant = resolveEncounterParticipantByRollParticipantId({
      participantId,
      participants: membership.participants,
    });

    return (
      participant != null &&
      controlledParticipants.some((controlled) => controlled.id === participant.id)
    );
  };
  const isVisibleParticipantId = (participantId?: string): boolean => {
    const participant = resolveEncounterParticipantByRollParticipantId({
      participantId,
      participants: membership.participants,
    });

    return (
      participant != null && visibleParticipants.some((visible) => visible.id === participant.id)
    );
  };
  const currentRankedRollStackId = state.currentRankedRollStackId;
  const opposedRollSetIds = new Set(
    [
      ...state.pendingSkillRolls
        .filter((roll) => roll.mode === "opposed")
        .map((roll) => roll.rollSetId),
      ...state.actionLog
        .filter((entry) => entry.mode === "opposed" || Boolean(entry.side))
        .map((entry) => entry.rollSetId),
    ].filter((rollSetId): rollSetId is string => Boolean(rollSetId)),
  );
  const pendingSkillRolls = state.pendingSkillRolls.filter(
    (roll) => !roll.silent && isControlledParticipantId(roll.participantId),
  );
  const controlledActionLog = state.actionLog.filter(
    (entry) =>
      !entry.silent &&
      isControlledParticipantId(entry.participantId) &&
      (entry.type === "skill_roll_assigned" ||
        entry.type === "gm_skill_roll" ||
        entry.type.startsWith("stat_check_")),
  );
  const ownsCurrentRankedRollStack = Boolean(
    currentRankedRollStackId &&
    (pendingSkillRolls.some((roll) => roll.rollSetId === currentRankedRollStackId) ||
      controlledActionLog.some((entry) => entry.rollSetId === currentRankedRollStackId)),
  );
  const publicRankedRollStackId = ownsCurrentRankedRollStack
    ? currentRankedRollStackId!
    : PLAYER_SAFE_PUBLIC_RANKED_ROLL_STACK_ID;
  const publicRankedSkillResults = currentRankedRollStackId
    ? state.actionLog
        .filter(
          (entry) =>
            entry.type === "gm_skill_roll" &&
            entry.mode !== "opposed" &&
            !entry.side &&
            !entry.silent &&
            entry.rollSetId === currentRankedRollStackId &&
            !opposedRollSetIds.has(entry.rollSetId) &&
            entry.numericSubtotal != null &&
            !isControlledParticipantId(entry.participantId) &&
            isVisibleParticipantId(entry.participantId),
        )
        .map((entry) =>
          buildPublicRankedSkillResult({
            entry,
            rollStackId: publicRankedRollStackId,
          }),
        )
    : [];

  return {
    actionLog: [...controlledActionLog, ...publicRankedSkillResults].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
    currentRankedRollStackId:
      ownsCurrentRankedRollStack || publicRankedSkillResults.length > 0
        ? publicRankedRollStackId
        : PLAYER_SAFE_EMPTY_RANKED_ROLL_STACK_ID,
    gmMessage: state.gmMessage,
    participantDescriptions,
    pendingSkillRolls,
    pendingStatChecks: state.pendingStatChecks.filter((check) =>
      isControlledParticipantId(check.participantId),
    ),
    visibility,
  };
}
