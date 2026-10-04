import type { z } from "zod";

import type { CombatRoundState } from "./combatRoundManager";
import type { EncounterSession } from "./session";

/**
 * The player-facing encounter — an encounter as it reaches a non-GM actor — Forgejo issue #502
 * (privacy hardening, Tier 1).
 *
 * Its top-level fields are enumerated additively and `gmPrivateClosingNote` is never one of them,
 * so a field added to `encounterSessionSchema` changes nothing a player can see.
 *
 * The nested values are the ones the player encounter projection produced for this viewer. That
 * projection still builds its combat round state by spreading the stored state and removing what
 * a player may not see; replacing it with additive construction is Tier 3, at which point
 * `combatRoundState` becomes a player-facing round-state type instead of the projected internal
 * one. Until then this type marks the boundary every converted response emits, and the seam Tier 3
 * fills.
 *
 * The type is branded so a stored encounter is not assignable to it.
 */
export type PlayerFacingEncounterSession = {
  actionLog: EncounterSession["actionLog"];
  campaignId?: EncounterSession["campaignId"];
  combatRoundState?: CombatRoundState;
  createdAt: EncounterSession["createdAt"];
  currentRound: EncounterSession["currentRound"];
  currentTurnIndex: EncounterSession["currentTurnIndex"];
  declarationsLocked: EncounterSession["declarationsLocked"];
  description?: EncounterSession["description"];
  id: EncounterSession["id"];
  itemReferencesVersion?: EncounterSession["itemReferencesVersion"];
  itemReferences?: EncounterSession["itemReferences"];
  kind: EncounterSession["kind"];
  participantMembershipMode?: EncounterSession["participantMembershipMode"];
  participants: EncounterSession["participants"];
  playerOutcome?: EncounterSession["playerOutcome"];
  roleplayState?: EncounterSession["roleplayState"];
  scenarioId?: EncounterSession["scenarioId"];
  status: EncounterSession["status"];
  timelineLabel?: EncounterSession["timelineLabel"];
  title: EncounterSession["title"];
  turnOrderMode: EncounterSession["turnOrderMode"];
  updatedAt: EncounterSession["updatedAt"];
} & z.BRAND<"PlayerFacingEncounterSession">;

/**
 * Copies the named top-level fields of an encounter that has already been projected for one
 * player. The input must be the output of the player encounter projection; this function adds
 * the top-level barrier and the type, it does not decide per-viewer visibility.
 */
export function buildPlayerFacingEncounterSession(input: {
  projectedEncounter: EncounterSession;
}): PlayerFacingEncounterSession {
  const encounter = input.projectedEncounter;

  return {
    actionLog: encounter.actionLog,
    campaignId: encounter.campaignId,
    combatRoundState: encounter.combatRoundState,
    createdAt: encounter.createdAt,
    currentRound: encounter.currentRound,
    currentTurnIndex: encounter.currentTurnIndex,
    declarationsLocked: encounter.declarationsLocked,
    description: encounter.description,
    id: encounter.id,
    itemReferencesVersion: encounter.itemReferencesVersion,
    itemReferences: encounter.itemReferences,
    kind: encounter.kind,
    participantMembershipMode: encounter.participantMembershipMode,
    participants: encounter.participants,
    playerOutcome: encounter.playerOutcome,
    roleplayState: encounter.roleplayState,
    scenarioId: encounter.scenarioId,
    status: encounter.status,
    timelineLabel: encounter.timelineLabel,
    title: encounter.title,
    turnOrderMode: encounter.turnOrderMode,
    updatedAt: encounter.updatedAt,
  } as PlayerFacingEncounterSession;
}
