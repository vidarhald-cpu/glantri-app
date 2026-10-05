import type { z } from "zod";

import type { CombatRoundState } from "./combatRoundManager";
import {
  buildPlayerFacingCombatRoundParticipant,
  type PlayerFacingCombatRoundParticipant,
} from "./playerFacingCombatRoundParticipant";
import type { EncounterSession } from "./session";

/**
 * The combat round state of a player-facing encounter (#507, Tier 2): its participants and their
 * declarations are the player-facing types, built field by field. The rest of the round state is
 * still what the per-viewer player projection produced; replacing it with additive construction is
 * Tier 3.
 */
export type PlayerFacingEncounterCombatRoundState = Omit<CombatRoundState, "participants"> & {
  participants: PlayerFacingCombatRoundParticipant[];
};

/**
 * The player-facing encounter — an encounter as it reaches a non-GM actor — Forgejo issue #502
 * (privacy hardening, Tier 1).
 *
 * Its top-level fields are enumerated additively and `gmPrivateClosingNote` is never one of them,
 * so a field added to `encounterSessionSchema` changes nothing a player can see.
 *
 * The nested values are the ones the player encounter projection produced for this viewer, except
 * the round-state participants and declarations, which are rebuilt additively (#507, Tier 2). That
 * projection still builds the rest of its combat round state by spreading the stored state and
 * removing what a player may not see; replacing it with additive construction is Tier 3, at which
 * point `combatRoundState` becomes a player-facing round-state type throughout. Until then this
 * type marks the boundary every converted response emits, and the seam Tier 3 fills.
 *
 * The type is branded so a stored encounter is not assignable to it.
 */
export type PlayerFacingEncounterSession = {
  actionLog: EncounterSession["actionLog"];
  campaignId?: EncounterSession["campaignId"];
  combatRoundState?: PlayerFacingEncounterCombatRoundState;
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

function buildPlayerFacingEncounterCombatRoundState(input: {
  keepDeclarationCombatContextAsR2ResidualFor?: ReadonlySet<string>;
  state: CombatRoundState;
}): PlayerFacingEncounterCombatRoundState {
  return {
    // Every round-state field other than `participants` is the per-viewer projection's (Tier 3).
    ...input.state,
    participants: input.state.participants.map((participant) =>
      buildPlayerFacingCombatRoundParticipant({
        keepDeclarationCombatContextAsR2Residual:
          input.keepDeclarationCombatContextAsR2ResidualFor?.has(participant.participantId)
            ? true
            : undefined,
        participant,
      }),
    ),
  };
}

/**
 * Copies the named top-level fields of an encounter that has already been projected for one
 * player, and rebuilds its round-state participants as player-facing participants. The input must
 * be the output of the player encounter projection; this function adds the barrier and the type, it
 * does not decide per-viewer visibility.
 *
 * `keepDeclarationCombatContextAsR2ResidualFor` names the round-state participants whose
 * declaration keeps its combat context as the projection produced it: the R2 residual (#502 Tier 1
 * rulings), which only the combat-declaration route passes, for the viewer's own participants.
 */
export function buildPlayerFacingEncounterSession(input: {
  keepDeclarationCombatContextAsR2ResidualFor?: ReadonlySet<string>;
  projectedEncounter: EncounterSession;
}): PlayerFacingEncounterSession {
  const encounter = input.projectedEncounter;

  return {
    actionLog: encounter.actionLog,
    campaignId: encounter.campaignId,
    combatRoundState:
      encounter.combatRoundState &&
      buildPlayerFacingEncounterCombatRoundState({
        keepDeclarationCombatContextAsR2ResidualFor:
          input.keepDeclarationCombatContextAsR2ResidualFor,
        state: encounter.combatRoundState,
      }),
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
