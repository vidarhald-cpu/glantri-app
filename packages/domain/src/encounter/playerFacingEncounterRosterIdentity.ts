import type { ScenarioParticipant } from "../campaign/scenario";

import type { EncounterParticipantReadSource } from "./combatReadModels";
import {
  encounterRosterIdentityRefusal,
  encounterRosterScenarioIdentityRefusal,
  resolveEncounterParticipantMembership,
} from "./session";

/**
 * The roster-identity condition, asked again on the player-facing read — Forgejo issue #963.
 *
 * ## Why the read has to ask it at all
 *
 * #947 states the condition in two halves, and both are write-time:
 *
 * - the roster-local half is `encounterRosterIdentityRefusal`, applied as a `superRefine` on
 *   `encounterSessionSchema`, which is the one place every writer passes through;
 * - the half that needs the Scenario's participants is `encounterRosterScenarioIdentityRefusal`,
 *   applied at the repository write boundary, where they are known.
 *
 * Neither reaches a stored roster that became violating without being written again, and two
 * ordinary steps produce exactly that: the GM writes a row carrying the identity of a Character
 * that has not joined the Scenario yet — accepted, because at write time there is no participant
 * for it to collide with — and that Character then joins. Nothing re-asks the question, so the
 * player-facing read resolves a roster the branch's own condition forbids.
 *
 * `playerFacingEncounterSessionSchema` cannot inherit the refusal either. It is derived from
 * `encounterSessionObjectSchema` — the *unrefined* object — because `playerFacingObject` reads a
 * Zod object's `shape` and `superRefine` returns an effects wrapper that has none. The placement
 * that made the condition universal for writers is the same placement that exempted this one
 * reader, and the exemption is by construction rather than by decision. So the condition is asked
 * here, explicitly, as its own check in the player-facing read path.
 *
 * ## What it asks, and what it deliberately does not
 *
 * Both halves are asked against state as it is *now*:
 *
 * 1. `encounterRosterScenarioIdentityRefusal` over the stored rows and the Scenario's current
 *    participants. This is the half that reaches issue #963: the latecomer's join is what turns an
 *    accepted roster into a violating one, and only a read that re-resolves against the current
 *    participants can see it.
 * 2. `encounterRosterIdentityRefusal` over the **resolved** roster — the collection every reader
 *    resolves against, which `resolveEncounterParticipantMembership` produces by backfilling each
 *    row's `scenarioParticipantId` and `characterId`. Asking it over the resolved roster is
 *    strictly stronger than asking it over the raw rows, because the backfill only ever *adds*
 *    aliases: a raw collision is still a resolved collision. It is also the only reachable form of
 *    this half, since `encounterRepository` re-parses stored rows through `encounterSessionSchema`
 *    on read, so a stored raw collision fails every read including the GM's.
 *
 * `pendingParticipants` is **not** asked. The held roster is a whole future roster that no reader
 * resolves and no player response carries: `resolveEncounterParticipantMembership` reads
 * `participants` only, so a held roster confers no membership, no control and no disclosure. There
 * is nothing for a collision placed there to disclose, and refusing a player read over it would
 * close a read for state the player never receives. It is asked the moment the round-boundary
 * commit promotes it into `participants`, which is where it becomes a roster readers resolve.
 *
 * ## Where this must not be asked
 *
 * Nowhere a GM diagnostic read passes through. A GM must still be able to read a violating roster:
 * the state is invisible otherwise at exactly the moment someone needs to look at it. Write and
 * repair semantics — how a violating roster returns to a legal state — are Forgejo issue #968 and
 * are not settled here.
 *
 * Returns the refusal message, or `undefined` when the roster a player-facing read would resolve
 * holds a coherent identity for every row.
 */
export function playerFacingEncounterRosterRefusal(input: {
  encounter: EncounterParticipantReadSource;
  scenarioParticipants: ScenarioParticipant[];
}): string | undefined {
  const scenarioIdentity = encounterRosterScenarioIdentityRefusal({
    participants: input.encounter.participants,
    scenarioParticipants: input.scenarioParticipants,
  });

  if (scenarioIdentity) {
    return scenarioIdentity;
  }

  const membership = resolveEncounterParticipantMembership(input);

  // The default-fallback roster is synthesised from the Scenario's own participants rather than
  // written by anyone, so it carries no claim to refuse.
  if (!membership.explicitMode) {
    return undefined;
  }

  return encounterRosterIdentityRefusal(membership.participants);
}

/**
 * What a player is told. It names no participant, no row and no identity: the refusal messages the
 * conditions return carry the colliding identifiers, which is diagnostic text for the GM and not
 * something a refusal owes the viewer it is refusing.
 */
export const PLAYER_FACING_ENCOUNTER_ROSTER_REFUSAL_MESSAGE =
  "This Encounter cannot be shown while its roster is unresolved. Ask the Game Master to review it.";

/**
 * The refusal a player-facing Encounter projection throws. Carries the diagnostic message
 * non-enumerably, so a handler that serialises the error cannot turn it into the disclosure this
 * refusal exists to prevent.
 */
export class PlayerFacingEncounterRosterRefusalError extends Error {
  readonly code = "encounter_roster_identity_unresolved";

  constructor(diagnostic: string) {
    super(PLAYER_FACING_ENCOUNTER_ROSTER_REFUSAL_MESSAGE);
    this.name = "PlayerFacingEncounterRosterRefusalError";
    Object.defineProperty(this, "diagnostic", {
      configurable: true,
      enumerable: false,
      value: diagnostic,
      writable: false,
    });
  }
}

/**
 * Fails the player-facing read closed. Called by the player-facing Encounter projection itself
 * rather than by its callers, so a reader added later cannot forget it.
 */
export function assertPlayerFacingEncounterRosterReadable(input: {
  encounter: EncounterParticipantReadSource;
  scenarioParticipants: ScenarioParticipant[];
}): void {
  const refusal = playerFacingEncounterRosterRefusal(input);

  if (refusal) {
    throw new PlayerFacingEncounterRosterRefusalError(refusal);
  }
}

/**
 * The Encounters a player-facing Scenario-session read must not resolve, as a set its callers can
 * ask once per response instead of once per field.
 */
export function unreadablePlayerFacingEncounterIds(input: {
  encounters: readonly (EncounterParticipantReadSource & { id: string })[];
  scenarioParticipants: ScenarioParticipant[];
}): ReadonlySet<string> {
  const unreadable = new Set<string>();

  for (const encounter of input.encounters) {
    const refusal = playerFacingEncounterRosterRefusal({
      encounter,
      scenarioParticipants: input.scenarioParticipants,
    });

    if (refusal) {
      unreadable.add(encounter.id);
    }
  }

  return unreadable;
}
