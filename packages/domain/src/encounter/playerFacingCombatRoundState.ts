import { z } from "zod";

import {
  activeCombatRoundStateSchema,
  combatRoundPhaseResolutionStatusesSchema,
} from "./combatRoundManager";
import type { combatRoundStepSchema } from "./combatRoundStep";
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
 * The combat round state's own field schemas, read from the canonical schema itself so the leaves
 * below are the canonical ones. The canonical round-state schemas are declared as plain `ZodType`s
 * (their inferred type is too large to emit), so the shape is typed here: the leaves with the types
 * of the canonical schemas they are, which `playerFacingObject` checks are leaves when this module
 * loads, and every structured field as an opaque schema it never reuses.
 */
const internalRoundStateShape = (
  activeCombatRoundStateSchema as unknown as z.ZodEffects<z.ZodObject<z.ZodRawShape>>
).innerType().shape as {
  activeParticipantId: z.ZodOptional<z.ZodString>;
  combatExperienceDifficulty: z.ZodOptional<z.ZodNumber>;
  currentStep: z.ZodDefault<typeof combatRoundStepSchema>;
  encounterId: z.ZodOptional<z.ZodString>;
  roundNumber: z.ZodDefault<z.ZodNumber>;
  selectedParticipantId: z.ZodOptional<z.ZodString>;
  selectedStep: z.ZodOptional<typeof combatRoundStepSchema>;
} & Record<
  | "adjustDistanceProposals"
  | "breakOffProposals"
  | "commands"
  | "committedInitiativeOrders"
  | "continuedContacts"
  | "currentCursor"
  | "defenseSnapshots"
  | "disarmAttempts"
  | "disarmUnbalancedConditions"
  | "distanceState"
  | "engagements"
  | "events"
  | "feintProposals"
  | "genericActions"
  | "gmBacktrackHold"
  | "missileReadiness"
  | "observationAttempts"
  | "observationManualReviews"
  | "observationRelationships"
  | "offensiveParryContests"
  | "participants"
  | "phaseResolutionCursor"
  | "phaseResolutionResults"
  | "phaseResolutionStatuses"
  | "roundEndReview"
  | "stepSnapshots"
  | "unbalancedConditions",
  z.ZodTypeAny
>;

/**
 * The combat round state as an encounter carries it, with its archived rounds: the internal object
 * whose fields the player-facing round state names.
 */
const combatRoundStateObjectSchema = z.object({
  ...internalRoundStateShape,
  rounds: z.unknown(),
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
 * - `observationManualReviews` — the round's Observe attempts set aside for manual review (#948).
 *   A marker names an observer and a target and says which required datum of theirs is missing, so
 *   it is GM-only, like every other Observe outcome. Named here as `neverPlayerFacing` rather than
 *   left out, for the same reason as `committedInitiativeOrders` below: `activeStateFromEncounter`
 *   re-parses the projected state with the internal schema, whose `.default([])` would otherwise
 *   put the key back as an empty array on every `active-v1` response;
 * - `gmBacktrackHold` — the GM's clear-current-step hold; the projection always removed it, and the
 *   internal schema declares it optional with no default, so nothing re-adds the key;
 * - `committedInitiativeOrders` — the committed initiative order records (#875). The records name
 *   every participant and carry every rolled total, so no player receives one; a player reads the
 *   committed order from `progression.executionOrder`, which the per-viewer presentation already
 *   narrows to the participants that viewer may see. The field is named here as `neverPlayerFacing`
 *   rather than left out: leaving it out did not keep the key out of a player response, because
 *   `activeStateFromEncounter` re-parses the projected state with the internal
 *   `activeCombatRoundStateSchema`, whose `.default([])` put the key back as an empty array on
 *   every `active-v1` response. Named this way the key a player reads is declared by a
 *   player-facing schema and only an empty list can parse into it;
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
    committedInitiativeOrders: neverPlayerFacing,
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
    observationManualReviews: neverPlayerFacing,
    observationRelationships: z.array(playerFacingCombatObservationRelationshipSchema).default([]),
    phaseResolutionCursor: playerFacingCombatRoundPhaseResolutionCursorSchema.optional(),
    phaseResolutionResults: z.array(playerFacingCombatRoundPhaseResolutionResultSchema).default([]),
    phaseResolutionStatuses: z
      .record(
        combatRoundPhaseResolutionStatusesSchema.keySchema,
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
