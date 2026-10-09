import { z } from "zod";

import { scenarioParticipantSecondaryActionContextSchema } from "../campaign/scenario";
import { MissileWeaponProfileSchema } from "../equipment/schemas";
import {
  combatAdjustDistanceAppliedModifierSchema,
  combatAdjustDistanceProposalSchema,
  combatAdjustDistanceRollResultSchema,
} from "./combatAdjustDistance";
import { combatAttackPhaseDefensivePenaltySchema } from "./combatAttackPhasePenalty";
import {
  combatBreakOffProposalSchema,
  combatBreakOffRollSchema,
  combatEngagementSchema,
} from "./combatBreakOff";
import { combatCriticalExactRationalSchema } from "./combatCriticalRuntime";
import {
  combatDeclarationIntentSchema,
  combatDeclarationItemIntentSchema,
  combatDeclarationPrimaryIntentSchema,
  combatDeclarationRelativePositionIntentSchema,
  combatDeclarationSecondaryIntentSchema,
} from "./combatDeclarationIntent";
import {
  combatDisarmAttemptSchema,
  combatDisarmRollSchema,
  combatDisarmUnbalancedConditionSchema,
} from "./combatDisarm";
import { combatDistanceEdgeSchema, combatDistanceStateSchema } from "./combatDistance";
import {
  combatFeintProposalSchema,
  combatFeintReviewSchema,
  combatFeintRollResultSchema,
  combatFeintTableResultSchema,
} from "./combatFeint";
import {
  combatGenericActionDurationSchema,
  combatGenericActionProgressSchema,
  combatGenericActionReferenceSchema,
  combatGenericActionResolutionSchema,
  combatGenericActionRollRequestSchema,
  combatGenericActionRollResultSchema,
  combatGenericActionSchema,
  combatItemInteractionSchema,
} from "./combatGenericAction";
import { combatMissileReadinessSchema } from "./combatMissile";
import { canonicalCombatModifierDurationSchema } from "./combatModifierLifecycle";
import { combatMovementBurdenSnapshotSchema } from "./combatMovementBurden";
import {
  distancePreferenceIntentSchema,
  environmentalMovementDestinationSchema,
  environmentalMovementIntentSchema,
  movementIntentSchema,
} from "./combatMovementIntent";
import {
  combatObservationAppliedModifierSchema,
  combatObservationAttemptSchema,
  combatObservationRelationshipSchema,
  combatObservationRollSchema,
} from "./combatObservation";
import {
  continuedContactMaintenanceContestSchema,
  continuedContactSchema,
  offensiveParryBrawlingRollSchema,
  offensiveParryContestSchema,
  unbalancedCombatConditionSchema,
} from "./combatOffensiveParry";
import {
  combatAttackSourceRefSchema,
  combatRoundAttackRollResultSchema,
  combatRoundCombatExperienceDueSchema,
  combatRoundCriticalRollResultSchema,
  combatRoundDamageArmorCoverageSchema,
  combatRoundDamageResultSchema,
  combatRoundEndDamageProposalSchema,
  combatRoundEndDistanceCalculationReadinessSchema,
  combatRoundEndDistanceControlSideSchema,
  combatRoundEndDistanceProposalSchema,
  combatRoundEndDistanceRollResultSchema,
  combatRoundEndEffectProposalSchema,
  combatRoundEndHealthRollProposalSchema,
  combatRoundEndHealthRollResultSchema,
  combatRoundEndParticipantReviewSchema,
  combatRoundEndRemovalProposalSchema,
  combatRoundEndReviewSchema,
  combatRoundFeintDeclarationSchema,
  combatRoundHitLocationRollResultSchema,
  combatRoundInitiativeResultSchema,
  combatRoundParryModifierBreakdownEntrySchema,
  combatRoundParryResolutionSchema,
  combatRoundPhaseResolutionCursorSchema,
  combatRoundPhaseResolutionParticipantStatusSchema,
  combatRoundPhaseResolutionResultSchema,
  combatRoundPhaseResolutionStatusesSchema,
} from "./combatRoundManager";
import {
  combatSkillContestCalculationSchema,
  combatSkillContestPercentageContributionSchema,
} from "./combatSkillContest";
import {
  canonicalCombatSuLifecycleProposalSchema,
  canonicalCombatSuRequirementSchema,
  canonicalCombatSuReviewSchema,
} from "./combatSuReview";
import {
  encounterAttackResolutionSchema,
  encounterAttackRollResultSchema,
  encounterCriticalEffectSummarySchema,
  encounterCriticalResolutionSchema,
  encounterCriticalRollResultSchema,
  encounterDamageResolutionSchema,
  encounterDefenseRollResultSchema,
  encounterHitLocationResultSchema,
  encounterItemReferenceSchema,
  encounterParticipantDeclarationSchema,
  encounterParticipantSchema,
  encounterPositionSchema,
  roleplayActionLogEntrySchema,
  roleplayParticipantDescriptionSchema,
  roleplayPendingSkillRollSchema,
  roleplayPendingStatCheckSchema,
  roleplayStateSchema,
} from "./session";
import {
  brandPlayerFacing,
  LEAF,
  playerFacingObject,
  playerFacingVariant,
} from "./playerFacingSchema";

/**
 * The nested structures of the player-facing round state and encounter, Forgejo issue #517 (privacy
 * hardening, Tier 3): one player-facing schema per internal object schema a player can receive, each
 * naming that schema's fields one by one (`playerFacingSchema.ts` explains the construction and what
 * it enforces).
 *
 * Every field the per-viewer player projection emitted at the Tier 3 baseline (`f2fdd5c1`) is named,
 * so Tier 3 changes how a player's values are built, not what a player sees, except for the fields
 * each schema lists as not player-facing:
 *
 * - account identities (`*UserId`, `createdBy*`) — actor identities are not player-facing (Tier 1,
 *   `playerFacingScenarioParticipant`; Tier 2, `playerFacingCombatRoundParticipant`);
 * - the canonical lifecycle and the GM correction history (`canonicalLifecycle`,
 *   `canonicalTransitions`) — the correction history is GM-only and the lifecycle is omitted under
 *   R1 until the control plane rules which of it is legitimately public;
 * - fields the per-viewer projection removed for every viewer at every location the schema occurs.
 *
 * A field the projection removes for some viewers, or at some locations only, is named here and set
 * by the projection for each viewer.
 */

export const playerFacingCombatAdjustDistanceAppliedModifierSchema = playerFacingObject(
  "PlayerFacingCombatAdjustDistanceAppliedModifier",
  combatAdjustDistanceAppliedModifierSchema,
  {
    bucket: LEAF,
    id: LEAF,
    label: LEAF,
    sourceId: LEAF,
    value: LEAF,
  },
);

export const playerFacingCombatSkillContestCalculationGoverningStatSchema = playerFacingObject(
  "PlayerFacingCombatSkillContestCalculationGoverningStat",
  combatSkillContestCalculationSchema.shape.governingStat,
  {
    id: LEAF,
    label: LEAF,
    value: LEAF,
  },
);

export const playerFacingCombatMovementBurdenSnapshotCarriedItemsSchema = playerFacingObject(
  "PlayerFacingCombatMovementBurdenSnapshotCarriedItems",
  combatMovementBurdenSnapshotSchema.shape.carriedItems.removeDefault().element,
  {
    effectiveEncumbrance: LEAF,
    itemId: LEAF,
    templateId: LEAF,
  },
);

export const playerFacingCombatMovementBurdenSnapshotCarryingCapacityInputsSchema =
  playerFacingObject(
    "PlayerFacingCombatMovementBurdenSnapshotCarryingCapacityInputs",
    combatMovementBurdenSnapshotSchema.shape.carryingCapacityInputs.unwrap(),
    {
      constitution: LEAF,
      size: LEAF,
      strength: LEAF,
    },
  );

export const playerFacingCombatMovementBurdenSnapshotShieldSchema = playerFacingObject(
  "PlayerFacingCombatMovementBurdenSnapshotShield",
  combatMovementBurdenSnapshotSchema.shape.shield.unwrap(),
  {
    itemId: LEAF,
    label: LEAF,
    movementContribution: LEAF,
    templateId: LEAF,
  },
);

export const playerFacingCombatMovementBurdenSnapshotProvenanceSchema = playerFacingObject(
  "PlayerFacingCombatMovementBurdenSnapshotProvenance",
  combatMovementBurdenSnapshotSchema.shape.provenance,
  {
    carriedLoadSource: LEAF,
    formula: LEAF,
    sourceRange: LEAF,
    workbook: LEAF,
  },
);

export const playerFacingCombatMovementBurdenSnapshotSchema = playerFacingObject(
  "PlayerFacingCombatMovementBurdenSnapshot",
  combatMovementBurdenSnapshotSchema,
  {
    schemaVersion: LEAF,
    participantId: LEAF,
    sourceSnapshotId: LEAF,
    equipmentLoadoutRevision: LEAF,
    carriedItems: z.array(playerFacingCombatMovementBurdenSnapshotCarriedItemsSchema).default([]),
    totalEffectiveCarriedEncumbrance: LEAF,
    carryingCapacityInputs:
      playerFacingCombatMovementBurdenSnapshotCarryingCapacityInputsSchema.optional(),
    carryingCapacity: LEAF,
    carriedPercentage: LEAF,
    encumbranceLevel: LEAF,
    shield: playerFacingCombatMovementBurdenSnapshotShieldSchema.optional(),
    shieldMovementContribution: LEAF,
    finalMovementModifier: LEAF,
    completeness: LEAF,
    missingFacts: LEAF,
    visibility: LEAF,
    provenance: playerFacingCombatMovementBurdenSnapshotProvenanceSchema,
  },
);

export const playerFacingCombatSkillContestCalculationOpenEndedDieSchema = playerFacingObject(
  "PlayerFacingCombatSkillContestCalculationOpenEndedDie",
  combatSkillContestCalculationSchema.shape.openEndedDie,
  {
    openEndedD10s: LEAF,
    rollD20: LEAF,
    rollTotal: LEAF,
  },
);

export const playerFacingCombatSkillContestPercentageContributionSchema = playerFacingObject(
  "PlayerFacingCombatSkillContestPercentageContribution",
  combatSkillContestPercentageContributionSchema,
  {
    category: LEAF,
    id: LEAF,
    label: LEAF,
    provenance: LEAF,
    sourceId: LEAF,
    unit: LEAF,
    value: LEAF,
  },
);

export const playerFacingCombatSkillContestCalculationSkillSchema = playerFacingObject(
  "PlayerFacingCombatSkillContestCalculationSkill",
  combatSkillContestCalculationSchema.shape.skill,
  {
    id: LEAF,
    label: LEAF,
    totalXp: LEAF,
  },
);

export const playerFacingCombatSkillContestCalculationSchema = playerFacingObject(
  "PlayerFacingCombatSkillContestCalculation",
  combatSkillContestCalculationSchema,
  {
    baseSkill: LEAF,
    calculationId: LEAF,
    completeness: LEAF,
    contestType: LEAF,
    derivedIntegerAdjustment: LEAF,
    finalResult: LEAF,
    governingStat: playerFacingCombatSkillContestCalculationGoverningStatSchema,
    missingContributionPoints: LEAF,
    movementBurden: playerFacingCombatMovementBurdenSnapshotSchema.optional(),
    openEndedDie: playerFacingCombatSkillContestCalculationOpenEndedDieSchema,
    opponentParticipantId: LEAF,
    participantId: LEAF,
    percentageContributions: z
      .array(playerFacingCombatSkillContestPercentageContributionSchema)
      .default([]),
    preDieTotal: LEAF,
    role: LEAF,
    skill: playerFacingCombatSkillContestCalculationSkillSchema,
    totalPercentageAdjustment: LEAF,
    visibility: LEAF,
  },
);

/** Not player-facing: `rolledByUserId` (an account identity). */
export const playerFacingCombatAdjustDistanceRollResultSchema = playerFacingObject(
  "PlayerFacingCombatAdjustDistanceRollResult",
  combatAdjustDistanceRollResultSchema,
  {
    appliedModifiers: z.array(playerFacingCombatAdjustDistanceAppliedModifierSchema).optional(),
    dodgeSkillLabel: LEAF,
    dodgeSkillXp: LEAF,
    dodgeSkillTotal: LEAF,
    dodgeStatLabel: LEAF,
    dodgeStatValue: LEAF,
    finalTotal: LEAF,
    generalFatigueModifier: LEAF,
    id: LEAF,
    openEndedD10s: LEAF,
    participantId: LEAF,
    rollD20: LEAF,
    rollTotal: LEAF,
    rolledAt: LEAF,
    situationalAdjustment: LEAF,
    skillContestCalculation: playerFacingCombatSkillContestCalculationSchema.optional(),
    totalModifiers: LEAF,
    preDieTotal: LEAF,
  },
);

/** Not player-facing: `notes` (a GM note the per-viewer projection always removed). */
export const playerFacingCombatAdjustDistanceProposalGmRollAdjustmentSchema = playerFacingObject(
  "PlayerFacingCombatAdjustDistanceProposalGmRollAdjustment",
  combatAdjustDistanceProposalSchema.shape.gmRollAdjustment.unwrap(),
  {
    participantId: LEAF,
    value: LEAF,
  },
);

/** Not player-facing: `notes` (a GM note the per-viewer projection always removed). */
export const playerFacingCombatAdjustDistanceProposalReviewSchema = playerFacingObject(
  "PlayerFacingCombatAdjustDistanceProposalReview",
  combatAdjustDistanceProposalSchema.shape.review.unwrap(),
  {
    acceptedOutcome: LEAF,
    committedDistance: LEAF,
  },
);

/** Not player-facing: `committedByUserId` (an account identity). */
export const playerFacingCombatAdjustDistanceProposalSchema = playerFacingObject(
  "PlayerFacingCombatAdjustDistanceProposal",
  combatAdjustDistanceProposalSchema,
  {
    attackerParticipantId: LEAF,
    attackerRoll: playerFacingCombatAdjustDistanceRollResultSchema.optional(),
    attackerRollRecorded: LEAF,
    committedAt: LEAF,
    currentDistance: LEAF,
    defenderParticipantId: LEAF,
    defenderResponse: LEAF,
    defenderRoll: playerFacingCombatAdjustDistanceRollResultSchema.optional(),
    defenderRollRecorded: LEAF,
    difference: LEAF,
    direction: LEAF,
    gmRollAdjustment: playerFacingCombatAdjustDistanceProposalGmRollAdjustmentSchema.optional(),
    id: LEAF,
    pairId: LEAF,
    phase1OpportunityId: LEAF,
    phase2AttackOpportunityId: LEAF,
    requestedDistance: LEAF,
    review: playerFacingCombatAdjustDistanceProposalReviewSchema.optional(),
    roundNumber: LEAF,
    standardOutcome: LEAF,
    standardProposedDistance: LEAF,
    standardTableRowId: LEAF,
    status: LEAF,
  },
);

/** Not player-facing: `rolledByUserId` (an account identity). */
export const playerFacingCombatBreakOffRollSchema = playerFacingObject(
  "PlayerFacingCombatBreakOffRoll",
  combatBreakOffRollSchema,
  {
    calculation: playerFacingCombatSkillContestCalculationSchema,
    finalTotal: LEAF,
    id: LEAF,
    participantId: LEAF,
    rolledAt: LEAF,
  },
);

/** Not player-facing: `notes` (a GM note the per-viewer projection always removed). */
export const playerFacingCombatBreakOffProposalGmReviewSchema = playerFacingObject(
  "PlayerFacingCombatBreakOffProposalGmReview",
  combatBreakOffProposalSchema.shape.gmReview.unwrap(),
  {
    attackerAdjustment: LEAF,
    escapeeAdjustment: LEAF,
  },
);

export const playerFacingCombatBreakOffProposalResultSchema = playerFacingObject(
  "PlayerFacingCombatBreakOffProposalResult",
  combatBreakOffProposalSchema.shape.result.unwrap(),
  {
    attackerObModifier: LEAF,
    defenderDbParryModifier: LEAF,
    escaped: LEAF,
    tableRowId: LEAF,
  },
);

/** Not player-facing: `committedByUserId` (an account identity). */
export const playerFacingCombatBreakOffProposalSchema = playerFacingObject(
  "PlayerFacingCombatBreakOffProposal",
  combatBreakOffProposalSchema,
  {
    attackerParticipantId: LEAF,
    attackerRoll: playerFacingCombatBreakOffRollSchema.optional(),
    committedAt: LEAF,
    difference: LEAF,
    escapeeParticipantId: LEAF,
    escapeeRoll: playerFacingCombatBreakOffRollSchema.optional(),
    gmReview: playerFacingCombatBreakOffProposalGmReviewSchema.optional(),
    id: LEAF,
    intentNote: LEAF,
    pairKey: LEAF,
    result: playerFacingCombatBreakOffProposalResultSchema.optional(),
    roundNumber: LEAF,
    status: LEAF,
  },
);

/** Not player-facing: `canonicalLifecycle` (the canonical lifecycle (R1; restoration awaits the control-plane ruling)); `canonicalTransitions` (the GM correction history). */
export const playerFacingContinuedContactSchema = playerFacingObject(
  "PlayerFacingContinuedContact",
  continuedContactSchema,
  {
    affectedParticipantId: LEAF,
    brawlingContestResultId: LEAF,
    controllerParticipantId: LEAF,
    endedByMaintenanceContestResultId: LEAF,
    endedRound: LEAF,
    establishedPhase: LEAF,
    establishedRound: LEAF,
    id: LEAF,
    lastMaintainedByContestResultId: LEAF,
    lastMaintainedRound: LEAF,
    sourceActionId: LEAF,
    sourceAttackResultId: LEAF,
    sourceDeclarationId: LEAF,
    sourceOpportunityId: LEAF,
    sourceParryResultId: LEAF,
    status: LEAF,
  },
);

/** Not player-facing: `rolledByUserId` (an account identity). */
export const playerFacingCombatDisarmRollSchema = playerFacingObject(
  "PlayerFacingCombatDisarmRoll",
  combatDisarmRollSchema,
  {
    calculation: playerFacingCombatSkillContestCalculationSchema,
    characteristicChoice: LEAF,
    finalTotal: LEAF,
    id: LEAF,
    participantId: LEAF,
    rolledAt: LEAF,
    skillChoice: LEAF,
  },
);

export const playerFacingCombatDisarmAttemptResultSchema = playerFacingObject(
  "PlayerFacingCombatDisarmAttemptResult",
  combatDisarmAttemptSchema.shape.result.unwrap(),
  {
    disarmed: LEAF,
    tableRowId: LEAF,
    unbalanced: LEAF,
  },
);

/** Not player-facing: `difference` (the per-viewer projection always removed it). */
export const playerFacingCombatDisarmAttemptSchema = playerFacingObject(
  "PlayerFacingCombatDisarmAttempt",
  combatDisarmAttemptSchema,
  {
    actingParticipantId: LEAF,
    actingRoll: playerFacingCombatDisarmRollSchema.optional(),
    actingWeaponItemId: LEAF,
    actingWeaponTemplateId: LEAF,
    attackResultId: LEAF,
    contactQualityModifier: LEAF,
    continuedContactId: LEAF,
    disarmCapability: LEAF,
    id: LEAF,
    method: LEAF,
    parryResultId: LEAF,
    phase: LEAF,
    resistingParticipantId: LEAF,
    resistingRoll: playerFacingCombatDisarmRollSchema.optional(),
    result: playerFacingCombatDisarmAttemptResultSchema.optional(),
    roundNumber: LEAF,
    status: LEAF,
    targetWeaponItemId: LEAF,
    targetWeaponItemRevision: LEAF,
    targetWeaponTemplateId: LEAF,
  },
);

export const playerFacingCombatDisarmUnbalancedConditionSchema = playerFacingObject(
  "PlayerFacingCombatDisarmUnbalancedCondition",
  combatDisarmUnbalancedConditionSchema,
  {
    affectedParticipantId: LEAF,
    establishedRound: LEAF,
    expiresAfterRound: LEAF,
    id: LEAF,
    modifierValue: LEAF,
    sourceActionId: LEAF,
    sourceDisarmAttemptId: LEAF,
    status: LEAF,
  },
);

export const playerFacingCombatDistanceEdgeSchema = playerFacingObject(
  "PlayerFacingCombatDistanceEdge",
  combatDistanceEdgeSchema,
  {
    distance: LEAF,
    lastChangedPhase: LEAF,
    lastChangedRound: LEAF,
    notes: LEAF,
    pairKey: LEAF,
    participantAId: LEAF,
    participantBId: LEAF,
    source: LEAF,
  },
);

export const playerFacingCombatRoundDistanceStateSchema = playerFacingObject(
  "PlayerFacingCombatRoundDistanceState",
  combatDistanceStateSchema.removeDefault(),
  {
    edges: z
      .record(
        combatDistanceStateSchema.removeDefault().shape.edges.removeDefault().keySchema,
        playerFacingCombatDistanceEdgeSchema,
      )
      .default({}),
  },
);

export const playerFacingCombatEngagementSchema = playerFacingObject(
  "PlayerFacingCombatEngagement",
  combatEngagementSchema,
  {
    changedAt: LEAF,
    changedByCommandId: LEAF,
    participantAId: LEAF,
    participantBId: LEAF,
    pairKey: LEAF,
    reason: LEAF,
    sourceProposalId: LEAF,
    status: LEAF,
  },
);

/** Not player-facing: `rolledByUserId` (an account identity). */
export const playerFacingCombatFeintRollResultSchema = playerFacingObject(
  "PlayerFacingCombatFeintRollResult",
  combatFeintRollResultSchema,
  {
    adjustment: LEAF,
    characteristic: LEAF,
    characteristicValue: LEAF,
    finalTotal: LEAF,
    id: LEAF,
    openEndedD10s: LEAF,
    participantId: LEAF,
    rollD20: LEAF,
    rollTotal: LEAF,
    rolledAt: LEAF,
    skillId: LEAF,
    skillLabel: LEAF,
    skillXp: LEAF,
    skillContestCalculation: playerFacingCombatSkillContestCalculationSchema.optional(),
  },
);

/** Not player-facing: `notes` (a GM note the per-viewer projection always removed). */
export const playerFacingCombatFeintReviewSchema = playerFacingObject(
  "PlayerFacingCombatFeintReview",
  combatFeintReviewSchema,
  {
    gmAttackerDbParryModifier: LEAF,
    gmDefenderDbParryModifier: LEAF,
    gmDefenderObDbModifier: LEAF,
    gmDefenderSkillObModifier: LEAF,
    proposedAttackerDbParryModifier: LEAF,
    proposedDefenderObDbModifier: LEAF,
  },
);

export const playerFacingCombatFeintTableResultSchema = playerFacingObject(
  "PlayerFacingCombatFeintTableResult",
  combatFeintTableResultSchema,
  {
    attackerPhase1DbParryModifier: LEAF,
    band: LEAF,
    defenderObDbModifier: LEAF,
  },
);

/** Not player-facing: `committedByUserId` (an account identity); `feasibilityNote` (a GM note the per-viewer projection always removed). */
export const playerFacingCombatFeintProposalSchema = playerFacingObject(
  "PlayerFacingCombatFeintProposal",
  combatFeintProposalSchema,
  {
    attackerParticipantId: LEAF,
    attackerRoll: playerFacingCombatFeintRollResultSchema.optional(),
    attackerRollRecorded: LEAF,
    attackerSkillId: LEAF,
    attackerSkillLabel: LEAF,
    committedAt: LEAF,
    defenderParticipantId: LEAF,
    defenderRoll: playerFacingCombatFeintRollResultSchema.optional(),
    defenderRollRecorded: LEAF,
    defenderSkillId: LEAF,
    defenderSkillLabel: LEAF,
    description: LEAF,
    difference: LEAF,
    feasibility: LEAF,
    feasibilityAdjustment: LEAF,
    id: LEAF,
    method: LEAF,
    pairId: LEAF,
    phase1OpportunityId: LEAF,
    phase2AttackOpportunityId: LEAF,
    review: playerFacingCombatFeintReviewSchema.optional(),
    roundNumber: LEAF,
    status: LEAF,
    tableResult: playerFacingCombatFeintTableResultSchema.optional(),
  },
);

export const playerFacingCombatGenericActionAwarenessContextSchema = playerFacingObject(
  "PlayerFacingCombatGenericActionAwarenessContext",
  combatGenericActionSchema.shape.awarenessContext.unwrap(),
  {
    kind: LEAF,
  },
);

export const playerFacingCombatGenericActionDurationPhaseSchema = playerFacingVariant(
  "PlayerFacingCombatGenericActionDurationPhase",
  combatGenericActionDurationSchema.options[0],
  {
    kind: LEAF,
    phase: LEAF,
  },
);

export const playerFacingCombatGenericActionDurationRoundSchema = playerFacingVariant(
  "PlayerFacingCombatGenericActionDurationRound",
  combatGenericActionDurationSchema.options[1],
  {
    kind: LEAF,
  },
);

export const playerFacingCombatGenericActionDurationRoundsSchema = playerFacingVariant(
  "PlayerFacingCombatGenericActionDurationRounds",
  combatGenericActionDurationSchema.options[2],
  {
    kind: LEAF,
    rounds: LEAF,
  },
);

export const playerFacingCombatGenericActionDurationGmDecidedSchema = playerFacingVariant(
  "PlayerFacingCombatGenericActionDurationGmDecided",
  combatGenericActionDurationSchema.options[3],
  {
    kind: LEAF,
  },
);

export const playerFacingCombatGenericActionDurationSchema = brandPlayerFacing(
  "PlayerFacingCombatGenericActionDuration",
  z.discriminatedUnion("kind", [
    playerFacingCombatGenericActionDurationPhaseSchema,
    playerFacingCombatGenericActionDurationRoundSchema,
    playerFacingCombatGenericActionDurationRoundsSchema,
    playerFacingCombatGenericActionDurationGmDecidedSchema,
  ]),
);

export const playerFacingCombatItemInteractionSchema = playerFacingObject(
  "PlayerFacingCombatItemInteraction",
  combatItemInteractionSchema,
  {
    itemId: LEAF,
    itemLabel: LEAF,
    itemRevision: LEAF,
    operation: LEAF,
    recipientParticipantId: LEAF,
    stateAtDeclaration: LEAF,
    visibleToParticipantIds: LEAF,
  },
);

export const playerFacingCombatGenericActionProgressSchema = playerFacingObject(
  "PlayerFacingCombatGenericActionProgress",
  combatGenericActionProgressSchema,
  {
    completedRounds: LEAF,
    lastProgressedRoundNumber: LEAF,
    startedRoundNumber: LEAF,
    startedStep: LEAF,
    totalRounds: LEAF,
  },
);

export const playerFacingCombatGenericActionReferenceParticipantSchema = playerFacingVariant(
  "PlayerFacingCombatGenericActionReferenceParticipant",
  combatGenericActionReferenceSchema.options[0],
  {
    kind: LEAF,
    participantId: LEAF,
    label: LEAF,
  },
);

export const playerFacingCombatGenericActionReferenceItemSchema = playerFacingVariant(
  "PlayerFacingCombatGenericActionReferenceItem",
  combatGenericActionReferenceSchema.options[1],
  {
    itemId: LEAF,
    kind: LEAF,
    label: LEAF,
    ownerParticipantId: LEAF,
  },
);

export const playerFacingCombatGenericActionReferenceEnvironmentSchema = playerFacingVariant(
  "PlayerFacingCombatGenericActionReferenceEnvironment",
  combatGenericActionReferenceSchema.options[2],
  {
    description: LEAF,
    kind: LEAF,
  },
);

export const playerFacingCombatGenericActionReferenceSchema = brandPlayerFacing(
  "PlayerFacingCombatGenericActionReference",
  z.discriminatedUnion("kind", [
    playerFacingCombatGenericActionReferenceParticipantSchema,
    playerFacingCombatGenericActionReferenceItemSchema,
    playerFacingCombatGenericActionReferenceEnvironmentSchema,
  ]),
);

/** Not player-facing: `resolvedByUserId` (an account identity). */
export const playerFacingCombatGenericActionResolutionSchema = playerFacingObject(
  "PlayerFacingCombatGenericActionResolution",
  combatGenericActionResolutionSchema,
  {
    resolvedAt: LEAF,
    text: LEAF,
    visibleToParticipantIds: LEAF,
  },
);

export const playerFacingCombatGenericActionRollRequestBasisSkillSchema = playerFacingVariant(
  "PlayerFacingCombatGenericActionRollRequestBasisSkill",
  combatGenericActionRollRequestSchema.shape.basis.options[0],
  {
    avgStats: LEAF,
    baseValue: LEAF,
    derivedXp: LEAF,
    groupXp: LEAF,
    kind: LEAF,
    skillId: LEAF,
    skillLabel: LEAF,
    skillXp: LEAF,
    unknownSkillPenalty: LEAF,
  },
);

export const playerFacingCombatGenericActionRollRequestBasisStatSchema = playerFacingVariant(
  "PlayerFacingCombatGenericActionRollRequestBasisStat",
  combatGenericActionRollRequestSchema.shape.basis.options[1],
  {
    baseValue: LEAF,
    kind: LEAF,
    statId: LEAF,
    statLabel: LEAF,
  },
);

export const playerFacingCombatGenericActionRollRequestBasisSchema = brandPlayerFacing(
  "PlayerFacingCombatGenericActionRollRequestBasis",
  z.discriminatedUnion("kind", [
    playerFacingCombatGenericActionRollRequestBasisSkillSchema,
    playerFacingCombatGenericActionRollRequestBasisStatSchema,
  ]),
);

export const playerFacingCombatGenericActionRollRequestSchema = playerFacingObject(
  "PlayerFacingCombatGenericActionRollRequest",
  combatGenericActionRollRequestSchema,
  {
    basis: playerFacingCombatGenericActionRollRequestBasisSchema,
    difficulty: LEAF,
  },
);

/** Not player-facing: `rolledByUserId` (an account identity). */
export const playerFacingCombatGenericActionRollResultSchema = playerFacingObject(
  "PlayerFacingCombatGenericActionRollResult",
  combatGenericActionRollResultSchema,
  {
    achievedLevelId: LEAF,
    achievedLevelLabel: LEAF,
    calculationText: LEAF,
    dieResult: LEAF,
    finalTotal: LEAF,
    openEndedD10s: LEAF,
    rollD20: LEAF,
    rolledAt: LEAF,
    success: LEAF,
  },
);

/** Not player-facing: `createdByUserId` (an account identity). */
export const playerFacingCombatGenericActionSchema = playerFacingObject(
  "PlayerFacingCombatGenericAction",
  combatGenericActionSchema,
  {
    awarenessContext: playerFacingCombatGenericActionAwarenessContextSchema.optional(),
    createdAt: LEAF,
    declarationKind: LEAF,
    duration: playerFacingCombatGenericActionDurationSchema,
    id: LEAF,
    intent: LEAF,
    itemInteraction: playerFacingCombatItemInteractionSchema.optional(),
    lastUpdatedAt: LEAF,
    ownerParticipantId: LEAF,
    preset: LEAF,
    progress: playerFacingCombatGenericActionProgressSchema,
    reference: playerFacingCombatGenericActionReferenceSchema.optional(),
    resolution: playerFacingCombatGenericActionResolutionSchema.optional(),
    rollRequest: playerFacingCombatGenericActionRollRequestSchema.optional(),
    rollResult: playerFacingCombatGenericActionRollResultSchema.optional(),
    status: LEAF,
  },
);

export const playerFacingMissileWeaponProfileSchema = playerFacingObject(
  "PlayerFacingMissileWeaponProfile",
  MissileWeaponProfileSchema,
  {
    ammoFamily: LEAF,
    canRemainReady: LEAF,
    family: LEAF,
    fullNormalCycleRounds: LEAF,
    preparationModel: LEAF,
    rapidShotAllowed: LEAF,
    standardPreparationRounds: LEAF,
  },
);

/** Not player-facing: `ammoItemId` (the per-viewer projection always removed it); `ammoItemRevision` (the per-viewer projection always removed it); `lastCommandId` (the per-viewer projection always removed it). */
export const playerFacingCombatMissileReadinessSchema = playerFacingObject(
  "PlayerFacingCombatMissileReadiness",
  combatMissileReadinessSchema,
  {
    aimCompletedRounds: LEAF,
    aimRequiredRounds: LEAF,
    aimLevel: LEAF,
    ammoFamily: LEAF,
    baseCompletedRounds: LEAF,
    baseRequiredRounds: LEAF,
    family: LEAF,
    gmPreparationAdjustment: LEAF,
    id: LEAF,
    lastProgressRound: LEAF,
    participantId: LEAF,
    phase: LEAF,
    profile: playerFacingMissileWeaponProfileSchema,
    rapidShot: LEAF,
    status: LEAF,
    targetParticipantId: LEAF,
    updatedAt: LEAF,
    weaponItemId: LEAF,
    weaponTemplateId: LEAF,
  },
);

export const playerFacingOffensiveParryBrawlingRollPendingModifiersSchema = playerFacingObject(
  "PlayerFacingOffensiveParryBrawlingRollPendingModifiers",
  offensiveParryBrawlingRollSchema.shape.pendingModifiers.removeDefault().element,
  {
    activationLabel: LEAF,
    label: LEAF,
    value: LEAF,
  },
);

/** Not player-facing: `rolledByUserId` (an account identity). */
export const playerFacingOffensiveParryBrawlingRollSchema = playerFacingObject(
  "PlayerFacingOffensiveParryBrawlingRoll",
  offensiveParryBrawlingRollSchema,
  {
    brawlingBaseValue: LEAF,
    brawlingSkillXp: LEAF,
    characteristicAverage: LEAF,
    effectiveSkillValue: LEAF,
    finalTotal: LEAF,
    generalModifier: LEAF,
    id: LEAF,
    openEndedD10s: LEAF,
    participantId: LEAF,
    parryQualityModifier: LEAF,
    percentageAdjustment: LEAF,
    percentageModifierTotal: LEAF,
    pendingModifiers: z
      .array(playerFacingOffensiveParryBrawlingRollPendingModifiersSchema)
      .default([]),
    rollD20: LEAF,
    rollPurpose: LEAF,
    rollTotal: LEAF,
    rolledAt: LEAF,
    skillId: LEAF,
    skillLabel: LEAF,
    skillModifier: LEAF,
  },
);

export const playerFacingOffensiveParryContestSchema = playerFacingObject(
  "PlayerFacingOffensiveParryContest",
  offensiveParryContestSchema,
  {
    affectedParticipantId: LEAF,
    attackResultId: LEAF,
    brawlingContestResultId: LEAF,
    controllerParticipantId: LEAF,
    declarationId: LEAF,
    declaredOpponentParticipantId: LEAF,
    id: LEAF,
    initiatorRoll: playerFacingOffensiveParryBrawlingRollSchema.optional(),
    initiatorRollRecorded: LEAF,
    offensiveParryAttemptId: LEAF,
    opportunityId: LEAF,
    parryQualityModifier: LEAF,
    parryQualityTableRow: LEAF,
    parryResultId: LEAF,
    phase: LEAF,
    responderRoll: playerFacingOffensiveParryBrawlingRollSchema.optional(),
    responderRollRecorded: LEAF,
    roundNumber: LEAF,
    status: LEAF,
    winnerParticipantId: LEAF,
  },
);

export const playerFacingCombatObservationAppliedModifierSchema = playerFacingObject(
  "PlayerFacingCombatObservationAppliedModifier",
  combatObservationAppliedModifierSchema,
  {
    bucket: LEAF,
    label: LEAF,
    sourceId: LEAF,
    value: LEAF,
  },
);

export const playerFacingCombatObservationRollSchema = playerFacingObject(
  "PlayerFacingCombatObservationRoll",
  combatObservationRollSchema,
  {
    appliedModifiers: z.array(playerFacingCombatObservationAppliedModifierSchema).default([]),
    baseValue: LEAF,
    effectiveSkillValue: LEAF,
    finalTotal: LEAF,
    intelligenceValue: LEAF,
    intelligenceXp: LEAF,
    openEndedD10s: LEAF,
    percentageAdjustment: LEAF,
    percentageModifierTotal: LEAF,
    rollD20: LEAF,
    rollTotal: LEAF,
    skillId: LEAF,
    skillLabel: LEAF,
    skillXp: LEAF,
  },
);

/** Not player-facing: `targetRoll` (the observed participant's roll, GM-only; the per-viewer projection always removed it). */
export const playerFacingCombatObservationAttemptSchema = playerFacingObject(
  "PlayerFacingCombatObservationAttempt",
  combatObservationAttemptSchema,
  {
    bestBonusAfter: LEAF,
    candidateBonus: LEAF,
    completedAttemptNumber: LEAF,
    completedAt: LEAF,
    completedAtRevision: LEAF,
    difference: LEAF,
    id: LEAF,
    observerRoll: playerFacingCombatObservationRollSchema,
    requiredQualifyingRounds: LEAF,
    roundNumber: LEAF,
  },
);

export const playerFacingCombatObservationRelationshipSchema = playerFacingObject(
  "PlayerFacingCombatObservationRelationship",
  combatObservationRelationshipSchema,
  {
    bestBonus: LEAF,
    completedAttempts: LEAF,
    id: LEAF,
    lastAttempt: playerFacingCombatObservationAttemptSchema.optional(),
    lastCompletedAttemptRevision: LEAF,
    observerParticipantId: LEAF,
    roundsTowardNextAttempt: LEAF,
    targetParticipantId: LEAF,
  },
);

export const playerFacingCombatRoundPhaseResolutionCursorSchema = playerFacingObject(
  "PlayerFacingCombatRoundPhaseResolutionCursor",
  combatRoundPhaseResolutionCursorSchema,
  {
    participantId: LEAF,
    phase: LEAF,
    substep: LEAF,
  },
);

export const playerFacingCombatRoundCriticalRollResultArmorCriticalModifierSourceSchema =
  playerFacingObject(
    "PlayerFacingCombatRoundCriticalRollResultArmorCriticalModifierSource",
    combatRoundCriticalRollResultSchema
      .removeDefault()
      .shape.armorCriticalModifierSource.removeDefault(),
    {
      reason: LEAF,
      status: LEAF,
    },
  );

/** Not player-facing: `rolledByUserId` (an account identity). */
export const playerFacingCombatRoundCriticalRollResultSchema = playerFacingObject(
  "PlayerFacingCombatRoundCriticalRollResult",
  combatRoundCriticalRollResultSchema.removeDefault(),
  {
    armorCriticalModifier: LEAF,
    armorCriticalModifierSource:
      playerFacingCombatRoundCriticalRollResultArmorCriticalModifierSourceSchema.default({
        reason: "Armor critical modifier was not available; using 0.",
        status: "not_applied",
      }),
    attackResultId: LEAF,
    attackerParticipantId: LEAF,
    criticalDice: LEAF,
    criticalDiceTotal: LEAF,
    criticalGrade: LEAF,
    criticalTypeModifier: LEAF,
    defenderParticipantId: LEAF,
    finalCriticalRoll: LEAF,
    rolledAt: LEAF,
    rolledByParticipantId: LEAF,
    rollPrivilege: LEAF,
    selectedHitLocation: LEAF,
    status: LEAF,
  },
);

export const playerFacingCombatRoundPhaseResolutionResultDamageProposalSchema = playerFacingObject(
  "PlayerFacingCombatRoundPhaseResolutionResultDamageProposal",
  combatRoundPhaseResolutionResultSchema.shape.damageProposal.removeDefault(),
  {
    committedCombatEffectEventId: LEAF,
    committedCombatEffectIds: LEAF,
    proposedEffects: LEAF,
    status: LEAF,
  },
);

export const playerFacingCombatRoundPhaseResolutionResultDamageRollSchema = playerFacingObject(
  "PlayerFacingCombatRoundPhaseResolutionResultDamageRoll",
  combatRoundPhaseResolutionResultSchema.shape.damageRoll.removeDefault(),
  {
    diceExpression: LEAF,
    notes: LEAF,
    rolls: LEAF,
    status: LEAF,
    total: LEAF,
  },
);

export const playerFacingCombatRoundDamageArmorCoverageAbdomenSchema = playerFacingObject(
  "PlayerFacingCombatRoundDamageArmorCoverageAbdomen",
  combatRoundDamageArmorCoverageSchema.removeDefault().shape.abdomen.unwrap(),
  {
    armorClass: LEAF,
    coverageLabel: LEAF,
    criticalModifier: LEAF,
    label: LEAF,
    value: LEAF,
  },
);

export const playerFacingCombatRoundDamageArmorCoverageSchema = playerFacingObject(
  "PlayerFacingCombatRoundDamageArmorCoverage",
  combatRoundDamageArmorCoverageSchema.removeDefault(),
  {
    abdomen: playerFacingCombatRoundDamageArmorCoverageAbdomenSchema.optional(),
    backArm: playerFacingCombatRoundDamageArmorCoverageAbdomenSchema.optional(),
    backFoot: playerFacingCombatRoundDamageArmorCoverageAbdomenSchema.optional(),
    backThigh: playerFacingCombatRoundDamageArmorCoverageAbdomenSchema.optional(),
    chest: playerFacingCombatRoundDamageArmorCoverageAbdomenSchema.optional(),
    frontArm: playerFacingCombatRoundDamageArmorCoverageAbdomenSchema.optional(),
    frontFoot: playerFacingCombatRoundDamageArmorCoverageAbdomenSchema.optional(),
    frontThigh: playerFacingCombatRoundDamageArmorCoverageAbdomenSchema.optional(),
    head: playerFacingCombatRoundDamageArmorCoverageAbdomenSchema.optional(),
  },
);

export const playerFacingCombatRoundDamageResultArmorModifierSourceSchema = playerFacingObject(
  "PlayerFacingCombatRoundDamageResultArmorModifierSource",
  combatRoundDamageResultSchema.shape.armorModifierSource.removeDefault(),
  {
    armorClass: LEAF,
    label: LEAF,
    reason: LEAF,
    status: LEAF,
    weaponArmorClass: LEAF,
  },
);

export const playerFacingCombatRoundDamageResultDamageRollSchema = playerFacingObject(
  "PlayerFacingCombatRoundDamageResultDamageRoll",
  combatRoundDamageResultSchema.shape.damageRoll.removeDefault(),
  {
    derivedFromLookupTotal: LEAF,
    derivedNormalDamageTotal: LEAF,
    diceExpression: LEAF,
    grazingDieSides: LEAF,
    grazingReferenceDamage: LEAF,
    grazingReferenceDamageLookupTotal: LEAF,
    grazingReferenceHitLookupTotal: LEAF,
    grazingReferenceTableDamage: LEAF,
    rawGrazingDamage: LEAF,
    required: LEAF,
    rolls: LEAF,
    total: LEAF,
  },
);

/** Not player-facing: `createdByUserId` (an account identity); `review` (the GM damage review; the per-viewer projection always removed it). */
export const playerFacingCombatRoundDamageResultSchema = playerFacingObject(
  "PlayerFacingCombatRoundDamageResult",
  combatRoundDamageResultSchema,
  {
    armorAppliesToDamage: LEAF,
    armorAppliesToMinimumDamage: LEAF,
    armorClass: LEAF,
    armorCoverage: playerFacingCombatRoundDamageArmorCoverageSchema.default({}),
    armorCoverageLabel: LEAF,
    armorDamageModifier: LEAF,
    armorModifier: LEAF,
    armorModifierSource: playerFacingCombatRoundDamageResultArmorModifierSourceSchema.default({
      label: "No armor coverage",
      reason: "No defender armor coverage was available for this damage proposal.",
      status: "not_applied",
    }),
    armorRegion: LEAF,
    armorRegionLabel: LEAF,
    armorValue: LEAF,
    armorWarnings: LEAF,
    attackDirection: LEAF,
    attackResultId: LEAF,
    attackerParticipantId: LEAF,
    createdAt: LEAF,
    criticalGrade: LEAF,
    damageRoll: playerFacingCombatRoundDamageResultDamageRollSchema.default({ required: false }),
    defenderDm: LEAF,
    defenderParticipantId: LEAF,
    damageLookupTotal: LEAF,
    dmb: LEAF,
    grazing: LEAF,
    hitLocationRolls: LEAF,
    hitLocationSelectionReason: LEAF,
    hitLookupTotal: LEAF,
    kind: LEAF,
    attackerStrengthGm: LEAF,
    cappedTotalDamage: LEAF,
    maxDamageApplied: LEAF,
    maxDamageCap: LEAF,
    lookupTotal: LEAF,
    maxDamageNote: LEAF,
    minDamage: LEAF,
    parryResultId: LEAF,
    phase: LEAF,
    selectedHitLocation: LEAF,
    selectedHitLocationRoll: LEAF,
    minimumDamageAfterArmor: LEAF,
    minimumDamageBeforeArmor: LEAF,
    provisionalDamageAfterArmor: LEAF,
    rawTableDamage: LEAF,
    tableDamage: LEAF,
    tableDamageModifier: LEAF,
    targetLocation: LEAF,
    rawTotalDamage: LEAF,
    totalDamage: LEAF,
    weaponArmorClass: LEAF,
    weaponCriticalGradeMaximum: LEAF,
    weaponName: LEAF,
  },
);

/** Not player-facing: `rolledByUserId` (an account identity). */
export const playerFacingCombatRoundHitLocationRollResultSchema = playerFacingObject(
  "PlayerFacingCombatRoundHitLocationRollResult",
  combatRoundHitLocationRollResultSchema.removeDefault(),
  {
    attackResultId: LEAF,
    attackerParticipantId: LEAF,
    defenderParticipantId: LEAF,
    hitLocationRolls: LEAF,
    rolledAt: LEAF,
    rolledByParticipantId: LEAF,
    rollPrivilege: LEAF,
    selectedHitLocation: LEAF,
    selectedHitLocationRoll: LEAF,
    selectionReason: LEAF,
    status: LEAF,
    targetLocation: LEAF,
  },
);

export const playerFacingCombatRoundParryModifierBreakdownEntrySchema = playerFacingObject(
  "PlayerFacingCombatRoundParryModifierBreakdownEntry",
  combatRoundParryModifierBreakdownEntrySchema,
  {
    label: LEAF,
    value: LEAF,
  },
);

export const playerFacingCombatRoundParryResolutionSchema = playerFacingObject(
  "PlayerFacingCombatRoundParryResolution",
  combatRoundParryResolutionSchema,
  {
    attackOpportunityId: LEAF,
    attackResultId: LEAF,
    combinedParryScore: LEAF,
    declaredOpponentParticipantId: LEAF,
    disarmAttemptId: LEAF,
    mainHandParryScore: LEAF,
    modifiedParryBeforeRoll: LEAF,
    modifierAdjustment: LEAF,
    modifierBreakdown: z.array(playerFacingCombatRoundParryModifierBreakdownEntrySchema).optional(),
    notes: LEAF,
    offHandParryScore: LEAF,
    offensiveParryAttemptId: LEAF,
    offensiveParryDeclarationId: LEAF,
    parrySourceLabel: LEAF,
    parrySourceId: LEAF,
    purpose: LEAF,
    openEndedD10s: LEAF,
    rawModifierTotal: LEAF,
    resultLabel: LEAF,
    rollD20: LEAF,
    rollTotal: LEAF,
    status: LEAF,
    success: LEAF,
    targetNumber: LEAF,
    total: LEAF,
    usedMainHand: LEAF,
    usedOffHand: LEAF,
  },
);

export const playerFacingCombatRoundPhaseResolutionResultSchema = playerFacingObject(
  "PlayerFacingCombatRoundPhaseResolutionResult",
  combatRoundPhaseResolutionResultSchema,
  {
    attackResultId: LEAF,
    attackerParticipantId: LEAF,
    criticalRoll: playerFacingCombatRoundCriticalRollResultSchema.default({}),
    damageProposal: playerFacingCombatRoundPhaseResolutionResultDamageProposalSchema.default({
      committedCombatEffectIds: [],
      proposedEffects: [],
      status: "not_ready",
    }),
    damageRoll: playerFacingCombatRoundPhaseResolutionResultDamageRollSchema.default({
      status: "pending",
    }),
    damageResult: playerFacingCombatRoundDamageResultSchema.optional(),
    defenderParticipantId: LEAF,
    defenseSnapshotId: LEAF,
    hitLocationRoll: playerFacingCombatRoundHitLocationRollResultSchema.default({}),
    parryResolution: playerFacingCombatRoundParryResolutionSchema.default({ status: "pending" }),
    phase: LEAF,
    roundNumber: LEAF,
    updatedAt: LEAF,
  },
);

export const playerFacingCombatRoundPhaseResolutionParticipantStatusSchema = playerFacingObject(
  "PlayerFacingCombatRoundPhaseResolutionParticipantStatus",
  combatRoundPhaseResolutionParticipantStatusSchema,
  {
    substep: LEAF,
    updatedAt: LEAF,
  },
);

export const playerFacingCombatRoundPhaseResolutionParticipantStatusesSchema = playerFacingObject(
  "PlayerFacingCombatRoundPhaseResolutionParticipantStatuses",
  combatRoundPhaseResolutionStatusesSchema.valueSchema.removeDefault(),
  {
    phase1: playerFacingCombatRoundPhaseResolutionParticipantStatusSchema.optional(),
    phase2: playerFacingCombatRoundPhaseResolutionParticipantStatusSchema.optional(),
  },
);

export const playerFacingContinuedContactMaintenanceContestSchema = playerFacingObject(
  "PlayerFacingContinuedContactMaintenanceContest",
  continuedContactMaintenanceContestSchema,
  {
    affectedParticipantId: LEAF,
    affectedRoll: playerFacingOffensiveParryBrawlingRollSchema.optional(),
    affectedRollRecorded: LEAF,
    continuedContactId: LEAF,
    controllerParticipantId: LEAF,
    controllerRoll: playerFacingOffensiveParryBrawlingRollSchema.optional(),
    controllerRollRecorded: LEAF,
    id: LEAF,
    outcome: LEAF,
    resultId: LEAF,
    reviewRequiredReason: LEAF,
    roundNumber: LEAF,
    status: LEAF,
    unbalancedConditionId: LEAF,
    winnerParticipantId: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationPhaseSchema = playerFacingVariant(
  "PlayerFacingCanonicalCombatModifierDurationPhase",
  canonicalCombatModifierDurationSchema.options[0],
  {
    startPhase: LEAF,
    startRound: LEAF,
    startSequence: LEAF,
    expiresAt: LEAF,
    kind: LEAF,
    phase: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationAttackOpportunityCountSchema =
  playerFacingVariant(
    "PlayerFacingCanonicalCombatModifierDurationAttackOpportunityCount",
    canonicalCombatModifierDurationSchema.options[1],
    {
      startPhase: LEAF,
      startRound: LEAF,
      startSequence: LEAF,
      consumeOn: LEAF,
      kind: LEAF,
      opportunityIds: LEAF,
      remaining: LEAF,
    },
  );

export const playerFacingCanonicalCombatModifierDurationRoundsRolledSchema = playerFacingObject(
  "PlayerFacingCanonicalCombatModifierDurationRoundsRolled",
  canonicalCombatModifierDurationSchema.options[2].shape.rolled.unwrap(),
  {
    formula: LEAF,
    unit: LEAF,
    value: LEAF,
    rolledAtRound: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationRoundsSchema = playerFacingVariant(
  "PlayerFacingCanonicalCombatModifierDurationRounds",
  canonicalCombatModifierDurationSchema.options[2],
  {
    startPhase: LEAF,
    startRound: LEAF,
    startSequence: LEAF,
    creationRoundCounts: LEAF,
    kind: LEAF,
    remaining: LEAF,
    rolled: playerFacingCanonicalCombatModifierDurationRoundsRolledSchema.optional(),
    transitionBoundary: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationRemainderOfRoundSchema =
  playerFacingVariant(
    "PlayerFacingCanonicalCombatModifierDurationRemainderOfRound",
    canonicalCombatModifierDurationSchema.options[3],
    {
      startPhase: LEAF,
      startRound: LEAF,
      startSequence: LEAF,
      kind: LEAF,
    },
  );

export const playerFacingCanonicalCombatModifierDurationInstantaneousSchema = playerFacingVariant(
  "PlayerFacingCanonicalCombatModifierDurationInstantaneous",
  canonicalCombatModifierDurationSchema.options[4],
  {
    startPhase: LEAF,
    startRound: LEAF,
    startSequence: LEAF,
    kind: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationUntilCheckCheckSchema = playerFacingObject(
  "PlayerFacingCanonicalCombatModifierDurationUntilCheckCheck",
  canonicalCombatModifierDurationSchema.options[5].shape.check,
  {
    checkId: LEAF,
    checkKind: LEAF,
    skillOrStatId: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationUntilCheckSchema = playerFacingVariant(
  "PlayerFacingCanonicalCombatModifierDurationUntilCheck",
  canonicalCombatModifierDurationSchema.options[5],
  {
    startPhase: LEAF,
    startRound: LEAF,
    startSequence: LEAF,
    check: playerFacingCanonicalCombatModifierDurationUntilCheckCheckSchema,
    kind: LEAF,
    resolvesOn: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationUntilConditionSchema = playerFacingVariant(
  "PlayerFacingCanonicalCombatModifierDurationUntilCondition",
  canonicalCombatModifierDurationSchema.options[6],
  {
    startPhase: LEAF,
    startRound: LEAF,
    startSequence: LEAF,
    conditionId: LEAF,
    conditionKind: LEAF,
    kind: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationRelationshipSchema = playerFacingVariant(
  "PlayerFacingCanonicalCombatModifierDurationRelationship",
  canonicalCombatModifierDurationSchema.options[7],
  {
    startPhase: LEAF,
    startRound: LEAF,
    startSequence: LEAF,
    endsWhen: LEAF,
    kind: LEAF,
    relationshipId: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationManualSchema = playerFacingVariant(
  "PlayerFacingCanonicalCombatModifierDurationManual",
  canonicalCombatModifierDurationSchema.options[8],
  {
    startPhase: LEAF,
    startRound: LEAF,
    startSequence: LEAF,
    kind: LEAF,
    removableBy: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationIndefiniteSchema = playerFacingVariant(
  "PlayerFacingCanonicalCombatModifierDurationIndefinite",
  canonicalCombatModifierDurationSchema.options[9],
  {
    startPhase: LEAF,
    startRound: LEAF,
    startSequence: LEAF,
    kind: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationLegacyUntypedSchema = playerFacingVariant(
  "PlayerFacingCanonicalCombatModifierDurationLegacyUntyped",
  canonicalCombatModifierDurationSchema.options[10],
  {
    kind: LEAF,
    rawValue: LEAF,
    reason: LEAF,
  },
);

export const playerFacingCanonicalCombatModifierDurationSchema = brandPlayerFacing(
  "PlayerFacingCanonicalCombatModifierDuration",
  z.discriminatedUnion("kind", [
    playerFacingCanonicalCombatModifierDurationPhaseSchema,
    playerFacingCanonicalCombatModifierDurationAttackOpportunityCountSchema,
    playerFacingCanonicalCombatModifierDurationRoundsSchema,
    playerFacingCanonicalCombatModifierDurationRemainderOfRoundSchema,
    playerFacingCanonicalCombatModifierDurationInstantaneousSchema,
    playerFacingCanonicalCombatModifierDurationUntilCheckSchema,
    playerFacingCanonicalCombatModifierDurationUntilConditionSchema,
    playerFacingCanonicalCombatModifierDurationRelationshipSchema,
    playerFacingCanonicalCombatModifierDurationManualSchema,
    playerFacingCanonicalCombatModifierDurationIndefiniteSchema,
    playerFacingCanonicalCombatModifierDurationLegacyUntypedSchema,
  ]),
);

export const playerFacingCanonicalCombatSuLifecycleProposalSchema = playerFacingObject(
  "PlayerFacingCanonicalCombatSuLifecycleProposal",
  canonicalCombatSuLifecycleProposalSchema,
  {
    automatic: LEAF,
    effectId: LEAF,
    expectedEffectVersion: LEAF,
    id: LEAF,
    mayOverride: LEAF,
    nextDuration: playerFacingCanonicalCombatModifierDurationSchema.optional(),
    nextState: LEAF,
    owner: LEAF,
    priorDuration: playerFacingCanonicalCombatModifierDurationSchema,
    priorState: LEAF,
    reason: LEAF,
    transitionType: LEAF,
  },
);

export const playerFacingCanonicalCombatSuRequirementSchema = playerFacingObject(
  "PlayerFacingCanonicalCombatSuRequirement",
  canonicalCombatSuRequirementSchema,
  {
    blocksReview: LEAF,
    completeness: LEAF,
    effectId: LEAF,
    id: LEAF,
    kind: LEAF,
    label: LEAF,
    owner: LEAF,
    resolved: LEAF,
  },
);

export const playerFacingCanonicalCombatSuReviewSchema = playerFacingObject(
  "PlayerFacingCanonicalCombatSuReview",
  canonicalCombatSuReviewSchema,
  {
    canonicalCutoff: LEAF,
    effectVersions: LEAF,
    participantId: LEAF,
    proposals: z.array(playerFacingCanonicalCombatSuLifecycleProposalSchema),
    requirements: z.array(playerFacingCanonicalCombatSuRequirementSchema),
    reviewId: LEAF,
    roundNumber: LEAF,
    schemaVersion: LEAF,
    state: LEAF,
  },
);

export const playerFacingCombatCriticalExactRationalSchema = playerFacingObject(
  "PlayerFacingCombatCriticalExactRational",
  combatCriticalExactRationalSchema._def.innerType,
  {
    denominator: LEAF,
    numerator: LEAF,
  },
);

export const playerFacingCombatRoundEndDamageProposalSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndDamageProposal",
  combatRoundEndDamageProposalSchema,
  {
    accepted: LEAF,
    amount: LEAF,
    accumulatedTenths: LEAF,
    bleedType: LEAF,
    bleedRate: LEAF,
    exactPreviousRemainder: playerFacingCombatCriticalExactRationalSchema.readonly().optional(),
    exactRemainingRemainder: playerFacingCombatCriticalExactRationalSchema.readonly().optional(),
    exactTotal: playerFacingCombatCriticalExactRationalSchema.readonly().optional(),
    healthCheckDue: LEAF,
    id: LEAF,
    initializedRound: LEAF,
    label: LEAF,
    lastHealthCheckRound: LEAF,
    notes: LEAF,
    participantId: LEAF,
    previousAccumulatedTenths: LEAF,
    remainingAccumulatedTenths: LEAF,
    roundsUntilHealthCheck: LEAF,
    sourceEffectId: LEAF,
    sourceEffectIds: LEAF,
  },
);

export const playerFacingCombatRoundEndDistanceCalculationReadinessSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndDistanceCalculationReadiness",
  combatRoundEndDistanceCalculationReadinessSchema,
  {
    completeness: LEAF,
    reasons: LEAF,
    schemaVersion: LEAF,
  },
);

/** Not player-facing: `rolledByUserId` (an account identity). */
export const playerFacingCombatRoundEndDistanceRollResultSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndDistanceRollResult",
  combatRoundEndDistanceRollResultSchema,
  {
    dodgeSkillTotal: LEAF,
    finalTotal: LEAF,
    generalFatigueModifier: LEAF,
    openEndedD10s: LEAF,
    rolledAt: LEAF,
    rolledAtRound: LEAF,
    rolledBy: LEAF,
    rollD20: LEAF,
    rollTotal: LEAF,
    skillContestCalculation: playerFacingCombatSkillContestCalculationSchema.optional(),
  },
);

export const playerFacingCombatRoundEndDistanceControlSideSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndDistanceControlSide",
  combatRoundEndDistanceControlSideSchema,
  {
    calculationReadiness: playerFacingCombatRoundEndDistanceCalculationReadinessSchema.optional(),
    desiredDistance: LEAF,
    dodgeSkillTotal: LEAF,
    generalFatigueModifier: LEAF,
    participantId: LEAF,
    result: playerFacingCombatRoundEndDistanceRollResultSchema.optional(),
    status: LEAF,
    warnings: LEAF,
  },
);

export const playerFacingCombatRoundEndDistanceProposalSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndDistanceProposal",
  combatRoundEndDistanceProposalSchema,
  {
    accepted: LEAF,
    affectedParticipantId: LEAF,
    appliedDistance: LEAF,
    appliesFromRound: LEAF,
    chosenDistance: LEAF,
    continuedContactId: LEAF,
    controllerParticipantId: LEAF,
    controlMode: LEAF,
    currentDistance: LEAF,
    currentDistanceSource: LEAF,
    gmOverrideDistance: LEAF,
    id: LEAF,
    notes: LEAF,
    outcome: LEAF,
    pairKey: LEAF,
    participantA: playerFacingCombatRoundEndDistanceControlSideSchema,
    participantAId: LEAF,
    participantB: playerFacingCombatRoundEndDistanceControlSideSchema,
    participantBId: LEAF,
    proposedDistance: LEAF,
    requiresContest: LEAF,
    reason: LEAF,
    status: LEAF,
    warnings: LEAF,
    winnerParticipantId: LEAF,
  },
);

export const playerFacingCombatRoundEndEffectProposalSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndEffectProposal",
  combatRoundEndEffectProposalSchema,
  {
    accepted: LEAF,
    effectId: LEAF,
    id: LEAF,
    kind: LEAF,
    label: LEAF,
    nextDuration: LEAF,
    nextExpiresAtRound: LEAF,
    notes: LEAF,
    participantId: LEAF,
    previousDuration: LEAF,
    previousExpiresAtRound: LEAF,
  },
);

/** Not player-facing: `rolledByUserId` (an account identity). */
export const playerFacingCombatRoundEndHealthRollResultSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndHealthRollResult",
  combatRoundEndHealthRollResultSchema,
  {
    difficulty: LEAF,
    finalTotal: LEAF,
    healthStat: LEAF,
    openEndedD10s: LEAF,
    rolledAt: LEAF,
    rolledBy: LEAF,
    rollD20: LEAF,
    rollTotal: LEAF,
    success: LEAF,
  },
);

export const playerFacingCombatRoundEndHealthRollProposalSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndHealthRollProposal",
  combatRoundEndHealthRollProposalSchema,
  {
    accepted: LEAF,
    bleedType: LEAF,
    bleedReduction: LEAF,
    damageProposalId: LEAF,
    difficulty: LEAF,
    healthStat: LEAF,
    id: LEAF,
    label: LEAF,
    nextBleedRate: LEAF,
    participantId: LEAF,
    previousBleedRate: LEAF,
    result: playerFacingCombatRoundEndHealthRollResultSchema.optional(),
    sourceEffectId: LEAF,
    status: LEAF,
    warnings: LEAF,
  },
);

export const playerFacingCombatRoundEndRemovalProposalSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndRemovalProposal",
  combatRoundEndRemovalProposalSchema,
  {
    accepted: LEAF,
    effectId: LEAF,
    id: LEAF,
    kind: LEAF,
    label: LEAF,
    notes: LEAF,
    participantId: LEAF,
    previousDuration: LEAF,
    previousExpiresAtRound: LEAF,
    previousStatus: LEAF,
  },
);

/** Not player-facing: `committedByUserId` (an account identity). */
export const playerFacingCombatRoundEndParticipantReviewSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndParticipantReview",
  combatRoundEndParticipantReviewSchema,
  {
    canonicalReview: playerFacingCanonicalCombatSuReviewSchema.optional(),
    committedAt: LEAF,
    participantId: LEAF,
    proposedDamage: z.array(playerFacingCombatRoundEndDamageProposalSchema).default([]),
    proposedDistances: z.array(playerFacingCombatRoundEndDistanceProposalSchema).default([]),
    proposedEffects: z.array(playerFacingCombatRoundEndEffectProposalSchema).default([]),
    proposedHealthRolls: z.array(playerFacingCombatRoundEndHealthRollProposalSchema).default([]),
    proposedRemovals: z.array(playerFacingCombatRoundEndRemovalProposalSchema).default([]),
    status: LEAF,
    warnings: LEAF,
  },
);

/** Not player-facing: `preparedByUserId` (an account identity). */
export const playerFacingCombatRoundEndReviewSchema = playerFacingObject(
  "PlayerFacingCombatRoundEndReview",
  combatRoundEndReviewSchema,
  {
    continuedContactMaintenanceContests: z
      .array(playerFacingContinuedContactMaintenanceContestSchema)
      .default([]),
    participantReviews: z
      .record(
        combatRoundEndReviewSchema.shape.participantReviews.removeDefault().keySchema,
        playerFacingCombatRoundEndParticipantReviewSchema,
      )
      .default({}),
    preparedAt: LEAF,
    proposedDistances: z.array(playerFacingCombatRoundEndDistanceProposalSchema).default([]),
    roundNumber: LEAF,
  },
);

/** Not player-facing: `canonicalLifecycle` (the canonical lifecycle (R1; restoration awaits the control-plane ruling)); `canonicalTransitions` (the GM correction history). */
export const playerFacingUnbalancedCombatConditionSchema = playerFacingObject(
  "PlayerFacingUnbalancedCombatCondition",
  unbalancedCombatConditionSchema,
  {
    affectedParticipantId: LEAF,
    endedByMaintenanceContestResultId: LEAF,
    endedRound: LEAF,
    establishedRound: LEAF,
    id: LEAF,
    modifierValue: LEAF,
    sourceActionId: LEAF,
    sourceContinuedContactId: LEAF,
    status: LEAF,
  },
);

export const playerFacingCombatAttackPhaseDefensivePenaltySchema = playerFacingObject(
  "PlayerFacingCombatAttackPhaseDefensivePenalty",
  combatAttackPhaseDefensivePenaltySchema,
  {
    activationCutoff: LEAF,
    application: LEAF,
    attackIndex: LEAF,
    attackOpportunityId: LEAF,
    attackProcessId: LEAF,
    commitment: LEAF,
    completeness: LEAF,
    duration: LEAF,
    executionState: LEAF,
    id: LEAF,
    initiativeGroupId: LEAF,
    participantId: LEAF,
    penalty: LEAF,
    phase: LEAF,
    reason: LEAF,
    roundNumber: LEAF,
    sourceActionId: LEAF,
    sourceException: LEAF,
    targetParticipantId: LEAF,
  },
);

export const playerFacingCombatRoundWeaponDmbFormulaSchema = playerFacingObject(
  "PlayerFacingCombatRoundWeaponDmbFormula",
  combatRoundAttackRollResultSchema
    .innerType()
    .innerType()
    .shape.weaponDmbFormula.unwrap()
    .unwrap(),
  {
    kind: LEAF,
    raw: LEAF,
    numericValue: LEAF,
    diceCount: LEAF,
    diceSides: LEAF,
    flatModifier: LEAF,
    textModifier: LEAF,
    specialValue: LEAF,
    note: LEAF,
  },
);

export const playerFacingCombatAttackSourceRefWeaponSchema = playerFacingVariant(
  "PlayerFacingCombatAttackSourceRefWeapon",
  combatAttackSourceRefSchema.options[0],
  {
    attackModeId: LEAF,
    opportunitySlot: LEAF,
    scenarioItemId: LEAF,
    slot: LEAF,
    sourceKind: LEAF,
    templateId: LEAF,
  },
);

export const playerFacingCombatAttackSourceRefUnarmedSchema = playerFacingVariant(
  "PlayerFacingCombatAttackSourceRefUnarmed",
  combatAttackSourceRefSchema.options[1],
  {
    attackModeId: LEAF,
    opportunitySlot: LEAF,
    slot: LEAF,
    sourceKind: LEAF,
    templateId: LEAF,
  },
);

export const playerFacingCombatAttackSourceRefSchema = brandPlayerFacing(
  "PlayerFacingCombatAttackSourceRef",
  z.discriminatedUnion("sourceKind", [
    playerFacingCombatAttackSourceRefWeaponSchema,
    playerFacingCombatAttackSourceRefUnarmedSchema,
  ]),
);

export const playerFacingCombatRoundFeintDeclarationSchema = playerFacingObject(
  "PlayerFacingCombatRoundFeintDeclaration",
  combatRoundFeintDeclarationSchema,
  {
    attackerSkillId: LEAF,
    attackerSkillLabel: LEAF,
    defenderSkillId: LEAF,
    defenderSkillLabel: LEAF,
    method: LEAF,
    targetParticipantId: LEAF,
    weaponSource: playerFacingCombatAttackSourceRefSchema.optional(),
  },
);

export const playerFacingCombatDeclarationPrimaryIntentSchema = playerFacingObject(
  "PlayerFacingCombatDeclarationPrimaryIntent",
  combatDeclarationPrimaryIntentSchema,
  {
    actionId: LEAF,
    description: LEAF,
    taskId: LEAF,
  },
);

export const playerFacingCombatDeclarationRelativePositionIntentKeepDistanceSchema =
  playerFacingVariant(
    "PlayerFacingCombatDeclarationRelativePositionIntentKeepDistance",
    combatDeclarationRelativePositionIntentSchema.options[0],
    {
      desiredDistance: LEAF,
      kind: LEAF,
      targetParticipantId: LEAF,
    },
  );

export const playerFacingCombatDeclarationRelativePositionIntentAdjustDistanceSchema =
  playerFacingVariant(
    "PlayerFacingCombatDeclarationRelativePositionIntentAdjustDistance",
    combatDeclarationRelativePositionIntentSchema.options[1],
    {
      desiredDistance: LEAF,
      intendedSpeed: LEAF,
      kind: LEAF,
      targetParticipantId: LEAF,
    },
  );

export const playerFacingCombatDeclarationRelativePositionIntentHoldFormationSchema =
  playerFacingVariant(
    "PlayerFacingCombatDeclarationRelativePositionIntentHoldFormation",
    combatDeclarationRelativePositionIntentSchema.options[2],
    {
      formation: LEAF,
      kind: LEAF,
    },
  );

export const playerFacingCombatDeclarationRelativePositionIntentSchema = brandPlayerFacing(
  "PlayerFacingCombatDeclarationRelativePositionIntent",
  z.discriminatedUnion("kind", [
    playerFacingCombatDeclarationRelativePositionIntentKeepDistanceSchema,
    playerFacingCombatDeclarationRelativePositionIntentAdjustDistanceSchema,
    playerFacingCombatDeclarationRelativePositionIntentHoldFormationSchema,
  ]),
);

export const playerFacingCombatDeclarationItemIntentSchema = playerFacingObject(
  "PlayerFacingCombatDeclarationItemIntent",
  combatDeclarationItemIntentSchema,
  {
    expectedItemRevision: LEAF,
    itemId: LEAF,
    operation: LEAF,
    recipientParticipantId: LEAF,
  },
);

export const playerFacingCombatDeclarationSecondaryIntentSchema = playerFacingObject(
  "PlayerFacingCombatDeclarationSecondaryIntent",
  combatDeclarationSecondaryIntentSchema,
  {
    actionId: LEAF,
    description: LEAF,
    item: playerFacingCombatDeclarationItemIntentSchema.optional(),
    taskId: LEAF,
    utteranceText: LEAF,
    utteranceType: LEAF,
  },
);

export const playerFacingCombatDeclarationIntentSchema = playerFacingObject(
  "PlayerFacingCombatDeclarationIntent",
  combatDeclarationIntentSchema,
  {
    facing: LEAF,
    movementDirection: LEAF,
    primaryAction: playerFacingCombatDeclarationPrimaryIntentSchema.optional(),
    relativePositions: z
      .array(playerFacingCombatDeclarationRelativePositionIntentSchema)
      .default([]),
    secondaryAction: playerFacingCombatDeclarationSecondaryIntentSchema.optional(),
  },
);

export const playerFacingDistancePreferenceIntentSchema = playerFacingObject(
  "PlayerFacingDistancePreferenceIntent",
  distancePreferenceIntentSchema,
  {
    desiredDistance: LEAF,
    notes: LEAF,
    operation: LEAF,
    phase: LEAF,
    source: LEAF,
    targetParticipantId: LEAF,
  },
);

export const playerFacingEnvironmentalMovementDestinationDescriptionSchema = playerFacingVariant(
  "PlayerFacingEnvironmentalMovementDestinationDescription",
  environmentalMovementDestinationSchema.options[0],
  {
    description: LEAF,
    kind: LEAF,
  },
);

export const playerFacingEnvironmentalMovementDestinationSchema = brandPlayerFacing(
  "PlayerFacingEnvironmentalMovementDestination",
  z.discriminatedUnion("kind", [playerFacingEnvironmentalMovementDestinationDescriptionSchema]),
);

export const playerFacingEnvironmentalMovementIntentSchema = playerFacingObject(
  "PlayerFacingEnvironmentalMovementIntent",
  environmentalMovementIntentSchema,
  {
    actionId: LEAF,
    destination: playerFacingEnvironmentalMovementDestinationSchema,
    duration: playerFacingCombatGenericActionDurationSchema,
    pace: LEAF,
  },
);

export const playerFacingMovementIntentSchema = playerFacingObject(
  "PlayerFacingMovementIntent",
  movementIntentSchema.innerType(),
  {
    distancePreferences: z.array(playerFacingDistancePreferenceIntentSchema).default([]),
    environmentalMovement: playerFacingEnvironmentalMovementIntentSchema.optional(),
    mode: LEAF,
  },
);

export const playerFacingScenarioParticipantSecondaryActionContextObserveOpponentSchema =
  playerFacingVariant(
    "PlayerFacingScenarioParticipantSecondaryActionContextObserveOpponent",
    scenarioParticipantSecondaryActionContextSchema.options[0],
    {
      action: LEAF,
      targetParticipantId: LEAF,
    },
  );

export const playerFacingScenarioParticipantSecondaryActionContextSchema = brandPlayerFacing(
  "PlayerFacingScenarioParticipantSecondaryActionContext",
  z.discriminatedUnion("action", [
    playerFacingScenarioParticipantSecondaryActionContextObserveOpponentSchema,
  ]),
);

export const playerFacingCombatRoundCombatExperienceDueSchema = playerFacingObject(
  "PlayerFacingCombatRoundCombatExperienceDue",
  combatRoundCombatExperienceDueSchema,
  {
    dueFromRoundNumber: LEAF,
    markedAtRoundNumber: LEAF,
    reason: LEAF,
  },
);

export const playerFacingCombatRoundInitiativeResultSchema = playerFacingObject(
  "PlayerFacingCombatRoundInitiativeResult",
  combatRoundInitiativeResultSchema,
  {
    baseInitiative: LEAF,
    modifierAdjustment: LEAF,
    resolutionType: LEAF,
    rolls: LEAF,
    rollTotal: LEAF,
    total: LEAF,
  },
);

export const playerFacingEncounterAttackRollResultSchema = playerFacingObject(
  "PlayerFacingEncounterAttackRollResult",
  encounterAttackRollResultSchema,
  {
    baseOb: LEAF,
    defenseTarget: LEAF,
    hit: LEAF,
    margin: LEAF,
    roll: LEAF,
    total: LEAF,
  },
);

export const playerFacingEncounterCriticalEffectSummarySchema = playerFacingObject(
  "PlayerFacingEncounterCriticalEffectSummary",
  encounterCriticalEffectSummarySchema,
  {
    severity: LEAF,
    summary: LEAF,
    tags: LEAF,
  },
);

export const playerFacingEncounterCriticalRollResultSchema = playerFacingObject(
  "PlayerFacingEncounterCriticalRollResult",
  encounterCriticalRollResultSchema,
  {
    baseModifier: LEAF,
    finalRoll: LEAF,
    locationModifier: LEAF,
    resultKey: LEAF,
    resultRow: LEAF,
    roll: LEAF,
    totalModifier: LEAF,
  },
);

export const playerFacingEncounterCriticalResolutionSchema = playerFacingObject(
  "PlayerFacingEncounterCriticalResolution",
  encounterCriticalResolutionSchema,
  {
    effect: playerFacingEncounterCriticalEffectSummarySchema.optional(),
    provisionalRuleLabel: LEAF,
    roll: playerFacingEncounterCriticalRollResultSchema.default({
      baseModifier: 0,
      locationModifier: 0,
      totalModifier: 0,
    }),
    status: LEAF,
    triggerDamage: LEAF,
    triggerThreshold: LEAF,
    type: LEAF,
  },
);

export const playerFacingEncounterParticipantDeclarationSchema = playerFacingObject(
  "PlayerFacingEncounterParticipantDeclaration",
  encounterParticipantDeclarationSchema,
  {
    actionType: LEAF,
    defenseFocus: LEAF,
    defensePosture: LEAF,
    shieldItemId: LEAF,
    targetLocation: LEAF,
    targetParticipantId: LEAF,
    weaponItemId: LEAF,
  },
);

export const playerFacingEncounterDefenseRollResultSchema = playerFacingObject(
  "PlayerFacingEncounterDefenseRollResult",
  encounterDefenseRollResultSchema,
  {
    dbApplied: LEAF,
    dbValue: LEAF,
    defending: LEAF,
    parryAttempted: LEAF,
    parryBase: LEAF,
    parryRoll: LEAF,
    parrySucceeded: LEAF,
    parryTotal: LEAF,
    selectedShieldItemId: LEAF,
    selectedWeaponItemId: LEAF,
  },
);

export const playerFacingEncounterDamageResolutionSchema = playerFacingObject(
  "PlayerFacingEncounterDamageResolution",
  encounterDamageResolutionSchema,
  {
    armorLabel: LEAF,
    armorValue: LEAF,
    criticalPending: LEAF,
    finalDamage: LEAF,
    rawDamage: LEAF,
    weaponArmorModifier: LEAF,
  },
);

export const playerFacingEncounterHitLocationResultSchema = playerFacingObject(
  "PlayerFacingEncounterHitLocationResult",
  encounterHitLocationResultSchema,
  {
    aimedLocation: LEAF,
    resolvedLocation: LEAF,
    roll: LEAF,
  },
);

export const playerFacingEncounterAttackResolutionSchema = playerFacingObject(
  "PlayerFacingEncounterAttackResolution",
  encounterAttackResolutionSchema,
  {
    attackerParticipantId: LEAF,
    attackRoll: playerFacingEncounterAttackRollResultSchema,
    critical: playerFacingEncounterCriticalResolutionSchema.optional(),
    declaration: playerFacingEncounterParticipantDeclarationSchema,
    defenderParticipantId: LEAF,
    defense: playerFacingEncounterDefenseRollResultSchema,
    damage: playerFacingEncounterDamageResolutionSchema.optional(),
    encounterId: LEAF,
    hitLocation: playerFacingEncounterHitLocationResultSchema.optional(),
    id: LEAF,
    order: LEAF,
    outcome: LEAF,
    resolvedAt: LEAF,
    roundNumber: LEAF,
    selectedShieldItemId: LEAF,
    selectedWeaponItemId: LEAF,
  },
);

export const playerFacingEncounterItemReferenceSchema = playerFacingObject(
  "PlayerFacingEncounterItemReference",
  encounterItemReferenceSchema,
  {
    itemId: LEAF,
    visibility: LEAF,
  },
);

export const playerFacingEncounterPositionSchema = playerFacingObject(
  "PlayerFacingEncounterPosition",
  encounterPositionSchema,
  {
    x: LEAF,
    y: LEAF,
    zone: LEAF,
  },
);

export const playerFacingEncounterParticipantSchema = playerFacingObject(
  "PlayerFacingEncounterParticipant",
  encounterParticipantSchema,
  {
    adHocName: LEAF,
    characterId: LEAF,
    declaration: playerFacingEncounterParticipantDeclarationSchema.default({
      actionType: "none",
      defenseFocus: "none",
      defensePosture: "none",
      targetLocation: "any",
    }),
    facing: LEAF,
    id: LEAF,
    initiative: LEAF,
    label: LEAF,
    order: LEAF,
    orientation: LEAF,
    participantType: LEAF,
    position: playerFacingEncounterPositionSchema.default({ x: 0, y: 0, zone: "center" }),
    scenarioParticipantId: LEAF,
  },
);

export const playerFacingRoleplayActionLogEntrySchema = playerFacingObject(
  "PlayerFacingRoleplayActionLogEntry",
  roleplayActionLogEntrySchema,
  {
    achievedSuccessLevelId: LEAF,
    achievedSuccessLevelLabel: LEAF,
    autoSuccess: LEAF,
    calculationText: LEAF,
    createdAt: LEAF,
    dieResult: LEAF,
    difficulty: LEAF,
    finalTotal: LEAF,
    fumble: LEAF,
    id: LEAF,
    mode: LEAF,
    numericSubtotal: LEAF,
    openEndedD10s: LEAF,
    opposedMargin: LEAF,
    opposedResult: LEAF,
    opponentAchievedSuccessLevelLabel: LEAF,
    opponentDieResult: LEAF,
    opponentFumble: LEAF,
    opponentNumericSubtotal: LEAF,
    opponentOpenEndedD10s: LEAF,
    opponentParticipantId: LEAF,
    opponentParticipantName: LEAF,
    opponentRollD20: LEAF,
    opponentSkillId: LEAF,
    opponentSkillLabel: LEAF,
    opponentSilent: LEAF,
    opponentSupportSkillId: LEAF,
    opponentSupportSkillLabel: LEAF,
    partial: LEAF,
    pendingRollId: LEAF,
    participantId: LEAF,
    participantName: LEAF,
    resultModifier: LEAF,
    roll: LEAF,
    rollD20: LEAF,
    rollSetId: LEAF,
    side: LEAF,
    silent: LEAF,
    skillId: LEAF,
    skillLabel: LEAF,
    skillValue: LEAF,
    statId: LEAF,
    statLabel: LEAF,
    statValue: LEAF,
    success: LEAF,
    summary: LEAF,
    supportCalculationText: LEAF,
    supportDieResult: LEAF,
    supportNumericSubtotal: LEAF,
    supportOpenEndedD10s: LEAF,
    supportRollD20: LEAF,
    supportSkillId: LEAF,
    supportSkillLabel: LEAF,
    supportSkillValue: LEAF,
    type: LEAF,
    otherMod: LEAF,
    useDbMod: LEAF,
    useGenMod: LEAF,
    useObSkillMod: LEAF,
  },
);

export const playerFacingRoleplayParticipantDescriptionSchema = playerFacingObject(
  "PlayerFacingRoleplayParticipantDescription",
  roleplayParticipantDescriptionSchema,
  {
    detailedDescription: LEAF,
    name: LEAF,
    shortDescription: LEAF,
  },
);

export const playerFacingRoleplayPendingSkillRollSchema = playerFacingObject(
  "PlayerFacingRoleplayPendingSkillRoll",
  roleplayPendingSkillRollSchema,
  {
    assignedAt: LEAF,
    difficulty: LEAF,
    id: LEAF,
    mode: LEAF,
    opponentParticipantId: LEAF,
    opponentParticipantName: LEAF,
    opponentSkillId: LEAF,
    opponentSkillLabel: LEAF,
    opponentSkillValue: LEAF,
    opponentSilent: LEAF,
    opponentSupportSkillId: LEAF,
    opponentSupportSkillLabel: LEAF,
    participantId: LEAF,
    rollSetId: LEAF,
    side: LEAF,
    silent: LEAF,
    skillId: LEAF,
    skillLabel: LEAF,
    skillValue: LEAF,
    supportSkillId: LEAF,
    supportSkillLabel: LEAF,
    supportSkillValue: LEAF,
    otherMod: LEAF,
    useDbMod: LEAF,
    useGenMod: LEAF,
    useObSkillMod: LEAF,
  },
);

export const playerFacingRoleplayPendingStatCheckSchema = playerFacingObject(
  "PlayerFacingRoleplayPendingStatCheck",
  roleplayPendingStatCheckSchema,
  {
    assignedAt: LEAF,
    difficulty: LEAF,
    id: LEAF,
    participantId: LEAF,
    statId: LEAF,
    statLabel: LEAF,
    statValue: LEAF,
  },
);

export const playerFacingRoleplayStateSchema = playerFacingObject(
  "PlayerFacingRoleplayState",
  roleplayStateSchema,
  {
    actionLog: z.array(playerFacingRoleplayActionLogEntrySchema).default([]),
    currentRankedRollStackId: LEAF,
    gmMessage: LEAF,
    participantDescriptions: z
      .record(
        roleplayStateSchema.shape.participantDescriptions.removeDefault().keySchema,
        playerFacingRoleplayParticipantDescriptionSchema,
      )
      .default({}),
    pendingSkillRolls: z.array(playerFacingRoleplayPendingSkillRollSchema).default([]),
    pendingStatChecks: z.array(playerFacingRoleplayPendingStatCheckSchema).default([]),
    visibility: LEAF,
  },
);
