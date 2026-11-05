import { z } from "zod";

import {
  playerFacingCombatRoundStateSchema,
  type PlayerFacingCombatRoundState,
} from "./playerFacingCombatRoundState";
import {
  playerFacingEncounterAttackResolutionSchema,
  playerFacingEncounterItemReferenceSchema,
  playerFacingEncounterParticipantSchema,
  playerFacingRoleplayStateSchema,
} from "./playerFacingCombatRoundStructures";
import { buildPlayerFacing, LEAF, playerFacingObject } from "./playerFacingSchema";
import { encounterSessionObjectSchema, type EncounterSession } from "./session";

/**
 * The player-facing encounter — an encounter as it reaches a non-GM actor — Forgejo issue #502
 * (privacy hardening, Tier 1), whole-path since #517 (Tier 3).
 *
 * Every field at every level is named by a player-facing schema (`playerFacingSchema.ts`):
 * `gmPrivateClosingNote` is not one of them, the round state is the player-facing round state
 * (`playerFacingCombatRoundState`), and the action log, item references, encounter participants and
 * roleplay state are player-facing structures (`playerFacingCombatRoundStructures`). So this type
 * inherits nothing automatically from `encounterSessionSchema`: a field added there is carried only
 * if a player-facing schema names it. Every level is branded, so a stored encounter, or any stored
 * value inside one, is not assignable to it.
 *
 * It does not close the deliberately open containers it carries — the `facts` record on a
 * round-state command — nor the combat history's event fact buckets, which copy some round-state
 * structures whole. Those are privacy Tier 4's (#528).
 */
export const playerFacingEncounterSessionSchema = playerFacingObject(
  "PlayerFacingEncounterSession",
  encounterSessionObjectSchema,
  {
    actionLog: z.array(playerFacingEncounterAttackResolutionSchema).default([]),
    campaignId: LEAF,
    combatRoundState: playerFacingCombatRoundStateSchema.optional(),
    createdAt: LEAF,
    currentRound: LEAF,
    currentTurnIndex: LEAF,
    declarationsLocked: LEAF,
    description: LEAF,
    id: LEAF,
    itemReferencesVersion: LEAF,
    itemReferences: z.array(playerFacingEncounterItemReferenceSchema).optional(),
    kind: LEAF,
    participantMembershipMode: LEAF,
    participants: z.array(playerFacingEncounterParticipantSchema).default([]),
    playerOutcome: LEAF,
    roleplayState: playerFacingRoleplayStateSchema.optional(),
    scenarioId: LEAF,
    status: LEAF,
    timelineLabel: LEAF,
    title: LEAF,
    turnOrderMode: LEAF,
    updatedAt: LEAF,
  },
);
export type PlayerFacingEncounterSession = z.infer<typeof playerFacingEncounterSessionSchema>;
export type PlayerFacingEncounterParticipant = z.infer<
  typeof playerFacingEncounterParticipantSchema
>;
export type PlayerFacingEncounterItemReference = z.infer<
  typeof playerFacingEncounterItemReferenceSchema
>;
export type PlayerFacingRoleplayState = z.infer<typeof playerFacingRoleplayStateSchema>;

/**
 * Builds the player-facing encounter from the stored encounter's named top-level fields and the
 * values the per-viewer projection built for one viewer. The per-viewer values are required and
 * already player-facing, so this function cannot be used to show a player a stored round state,
 * participant list, roleplay state or item list it has not been projected for.
 */
export function buildPlayerFacingEncounterSession(input: {
  combatRoundState: PlayerFacingCombatRoundState | undefined;
  encounter: EncounterSession;
  itemReferences: readonly PlayerFacingEncounterItemReference[] | undefined;
  participants: readonly PlayerFacingEncounterParticipant[];
  roleplayState: PlayerFacingRoleplayState | undefined;
}): PlayerFacingEncounterSession {
  return buildPlayerFacing(playerFacingEncounterSessionSchema, input.encounter, {
    combatRoundState: input.combatRoundState,
    itemReferences: input.itemReferences,
    participants: input.participants,
    roleplayState: input.roleplayState,
  });
}
