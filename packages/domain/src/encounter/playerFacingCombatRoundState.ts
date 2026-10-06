import { z } from "zod";

import { activeCombatRoundStateShape, completedCombatRoundSchema } from "./combatRoundManager";
import {
  playerFacingCombatRoundCommandSchema,
  playerFacingCombatRoundCursorSchema,
} from "./playerFacingCombatRoundCommand";
import { playerFacingCombatRoundParticipantSchema } from "./playerFacingCombatRoundParticipant";
import {
  playerFacingCombatAdjustDistanceProposalSchema,
  playerFacingCombatBreakOffProposalSchema,
  playerFacingCombatDisarmAttemptSchema,
  playerFacingCombatDisarmUnbalancedConditionSchema,
  playerFacingCombatEngagementSchema,
  playerFacingCombatFeintProposalSchema,
  playerFacingCombatGenericActionSchema,
  playerFacingCombatMissileReadinessSchema,
  playerFacingCombatObservationAttemptSchema,
  playerFacingCombatObservationRelationshipSchema,
  playerFacingCombatRoundDistanceStateSchema,
  playerFacingCombatRoundEndReviewSchema,
  playerFacingCombatRoundPhaseResolutionCursorSchema,
  playerFacingCombatRoundPhaseResolutionParticipantStatusesSchema,
  playerFacingCombatRoundPhaseResolutionResultSchema,
  playerFacingContinuedContactSchema,
  playerFacingOffensiveParryContestSchema,
  playerFacingUnbalancedCombatConditionSchema,
} from "./playerFacingCombatRoundStructures";
import { LEAF, playerFacingObject } from "./playerFacingSchema";

/**
 * The combat round state as an encounter carries it, with its archived rounds: the internal object
 * whose fields the player-facing round state names.
 */
const combatRoundStateObjectSchema = z.object({
  ...activeCombatRoundStateShape,
  rounds: z.array(completedCombatRoundSchema).default([]),
});

/**
 * A round-state collection no player receives, emitted empty as it always has been. Only an empty
 * list parses, so a value can never be put into one by mistake.
 */
const neverPlayerFacing = z.array(z.never()).default([]);

/**
 * The player-facing combat round state, Forgejo issue #517 (privacy hardening, Tier 3).
 *
 * Every player encounter response carries this as its `combatRoundState`, and every `active-v1`
 * response as its `activeCombatState` (which also drops `rounds`). It replaces the per-viewer
 * projection's own `CombatRoundState`, which spread the stored state and removed what a player may
 * not see, so a field added to any internal round-state structure reached players. Every field at
 * every level is now named by a player-facing schema (`playerFacingSchema.ts`): participants and
 * declarations (`playerFacingCombatRoundParticipant`), commands (`playerFacingCombatRoundCommand`,
 * whose `facts` stay open until Tier 4) and every other structure
 * (`playerFacingCombatRoundStructures`).
 *
 * The per-viewer projection still decides which participants, proposals, contests, results and
 * conditions a viewer sees and which nested values (another participant's rolls, a hidden
 * participant's cursor) are withheld; these schemas decide which fields can carry them.
 *
 * Not player-facing:
 * - `gmBacktrackHold` — the GM's clear-current-step hold; the projection always removed it;
 * - `defenseSnapshots`, `events`, `rounds`, `stepSnapshots` — always empty for players, as before.
 */
export const playerFacingCombatRoundStateSchema = playerFacingObject(
  "PlayerFacingCombatRoundState",
  combatRoundStateObjectSchema,
  {
    activeParticipantId: LEAF,
    adjustDistanceProposals: z.array(playerFacingCombatAdjustDistanceProposalSchema).default([]),
    breakOffProposals: z.array(playerFacingCombatBreakOffProposalSchema).default([]),
    combatExperienceDifficulty: LEAF,
    commands: z.array(playerFacingCombatRoundCommandSchema).default([]),
    continuedContacts: z.array(playerFacingContinuedContactSchema).default([]),
    disarmAttempts: z.array(playerFacingCombatDisarmAttemptSchema).default([]),
    disarmUnbalancedConditions: z
      .array(playerFacingCombatDisarmUnbalancedConditionSchema)
      .default([]),
    currentCursor: playerFacingCombatRoundCursorSchema.optional(),
    currentStep: LEAF,
    defenseSnapshots: neverPlayerFacing,
    distanceState: playerFacingCombatRoundDistanceStateSchema.default({ edges: {} }),
    engagements: z.array(playerFacingCombatEngagementSchema).default([]),
    encounterId: LEAF,
    events: neverPlayerFacing,
    feintProposals: z.array(playerFacingCombatFeintProposalSchema).default([]),
    genericActions: z.array(playerFacingCombatGenericActionSchema).default([]),
    missileReadiness: z.array(playerFacingCombatMissileReadinessSchema).default([]),
    offensiveParryContests: z.array(playerFacingOffensiveParryContestSchema).default([]),
    observationAttempts: z.array(playerFacingCombatObservationAttemptSchema).default([]),
    observationRelationships: z.array(playerFacingCombatObservationRelationshipSchema).default([]),
    phaseResolutionCursor: playerFacingCombatRoundPhaseResolutionCursorSchema.optional(),
    phaseResolutionResults: z.array(playerFacingCombatRoundPhaseResolutionResultSchema).default([]),
    phaseResolutionStatuses: z
      .record(
        activeCombatRoundStateShape.phaseResolutionStatuses.removeDefault().keySchema,
        playerFacingCombatRoundPhaseResolutionParticipantStatusesSchema,
      )
      .default({}),
    participants: z.array(playerFacingCombatRoundParticipantSchema).default([]),
    roundEndReview: playerFacingCombatRoundEndReviewSchema.optional(),
    roundNumber: LEAF,
    rounds: neverPlayerFacing,
    selectedParticipantId: LEAF,
    selectedStep: LEAF,
    stepSnapshots: neverPlayerFacing,
    unbalancedConditions: z.array(playerFacingUnbalancedCombatConditionSchema).default([]),
  },
);
export type PlayerFacingCombatRoundState = z.infer<typeof playerFacingCombatRoundStateSchema>;
