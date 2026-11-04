import {
  buildPlayerSafeCombatScopeForUser,
  type CombatRoundCommandEnvelopeViewer,
  type ScenarioParticipant,
} from "@glantri/domain";

type CombatRoundCommandEnvelopeViewerEncounter = Parameters<
  typeof buildPlayerSafeCombatScopeForUser
>[0]["encounter"];

/**
 * #925. The viewer a combat route's `commandEnvelope` is built for.
 *
 * Independent QA (issue #925, comment 20613, finding B1) established that
 * `buildCombatRoundCommandEnvelope` took no viewer, so `latestEvent.summaryText` applied no
 * entitlement gate and a departed combatant's recorded label reached a player. Two of the
 * twenty-six envelope call sites in `encounterRoutes.ts` returned it unprojected beside an
 * `encounter` that *was* player-projected; the other twenty-four were no different.
 *
 * Every call site resolves its viewer through this one function, from `access.mode` — the value the
 * route's own authorization produced — rather than from a hand-written claim about what that route
 * admits. A route whose gate is later loosened therefore starts producing a player viewer on its
 * own, instead of keeping a GM viewer that a comment once asserted was safe.
 *
 * The scope comes from `buildPlayerSafeCombatScopeForUser`, the same helper the sibling
 * `buildPlayerFacingEncounterForUser` projection uses, and its visible set is built from the live
 * roster (`combatPlayerVisibility.ts`), so a participant who has left the encounter can never be in
 * it.
 */
export function resolveCombatRoundCommandEnvelopeViewer(input: {
  encounter: CombatRoundCommandEnvelopeViewerEncounter;
  mode: "gm" | "player";
  scenarioParticipants: ScenarioParticipant[];
  userId: string;
}): CombatRoundCommandEnvelopeViewer {
  if (input.mode === "gm") {
    return { kind: "gm" };
  }

  const scope = buildPlayerSafeCombatScopeForUser({
    encounter: input.encounter,
    scenarioParticipants: input.scenarioParticipants,
    userId: input.userId,
  });

  return {
    controlledParticipantIds: scope.controlledEncounterParticipantIds,
    kind: "player",
    visibleParticipantIds: scope.visibleParticipantIds,
  };
}
