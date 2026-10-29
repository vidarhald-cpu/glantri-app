import { getCombatDistanceParticipantAliases } from "../encounter/combatDistance";
import { buildPlayerSafeCombatScopeForUser } from "../encounter/combatPlayerVisibility";
import {
  isUserAssignedToEncounterMembership,
  isUserEntitledToTerminalEncounterHistory,
  resolveEncounterParticipantMembership,
  type EncounterSession,
} from "../encounter/session";
import type { ScenarioParticipant } from "./scenario";

/**
 * Participant-level disclosure for one viewer of one Scenario.
 *
 * Issue #798. The Scenario-level producers used to filter on
 * `ScenarioParticipant.visibilityOverrides`, which no production path can
 * write, so their filters were inert. The store the GM's hide control actually
 * writes is `EncounterSession.roleplayState.visibility` — a per-viewer,
 * per-target matrix (PO ruling D1). This module resolves that matrix, once,
 * into the Scenario-participant id space both producers work in.
 *
 * Two independent reasons suppress a participant for a player viewer:
 *
 * 1. **Explicit GM hide.** The viewer shares at least one Encounter with the
 *    participant, and in every shared Encounter the GM's matrix makes the
 *    participant not visible to this viewer.
 * 2. **No shared Encounter.** The participant belongs to one or more
 *    Encounters and the viewer is related to none of them. This is the
 *    cross-Encounter boundary, and it is deliberately independent of Encounter
 *    `status`: the previous `status === "active"` condition made the boundary
 *    disappear whenever the GM paused, completed or archived the Encounter.
 *
 * A participant who belongs to no Encounter at all (a Scenario-level NPC) and
 * the viewer's own participants are never suppressed.
 *
 * The empty-matrix default is deliberately fail-open and is answered in exactly
 * one place — `buildPlayerSafeCombatScopeForUser` / `hasVisibilityRows` — per PO
 * ruling D3: an empty visibility matrix means everyone is visible, and #798
 * only honours an explicit GM hide.
 */
export interface ScenarioParticipantDisclosure {
  /** Scenario participant ids the viewer controls. Never suppressed. */
  readonly controlledParticipantIds: ReadonlySet<string>;
  /**
   * Every id form a suppressed participant is addressed by — the
   * `ScenarioParticipant.id`, its `scenario-` prefixed Encounter alias, its
   * `characterId` and its Encounter participant ids. Used to match stored
   * event payloads, which do not agree on one id form.
   */
  readonly suppressedParticipantIdAliases: ReadonlySet<string>;
  /** Suppressed participants in `ScenarioParticipant.id` space. */
  readonly suppressedParticipantIds: ReadonlySet<string>;
  /** Display names of suppressed participants, for stored-prose suppression. */
  readonly suppressedParticipantNames: ReadonlySet<string>;
  /**
   * Diagnostics for the id-space mapping. A repair whose computed set never
   * intersects the id space it filters measures clean because it filters
   * nothing, so the mapping is reported rather than assumed.
   */
  readonly idSpaceDiagnostics: {
    /** Encounter memberships that resolved back to a Scenario participant. */
    readonly mappedEncounterMemberships: number;
    /** Encounter memberships carrying no `scenarioParticipantId`. */
    readonly unmappedEncounterMemberships: number;
    /** Scenario participants the viewer shares at least one Encounter with. */
    readonly participantsSharingAnEncounter: number;
  };
}

const EMPTY_DISCLOSURE: ScenarioParticipantDisclosure = {
  controlledParticipantIds: new Set<string>(),
  idSpaceDiagnostics: {
    mappedEncounterMemberships: 0,
    participantsSharingAnEncounter: 0,
    unmappedEncounterMemberships: 0,
  },
  suppressedParticipantIdAliases: new Set<string>(),
  suppressedParticipantIds: new Set<string>(),
  suppressedParticipantNames: new Set<string>(),
};

/**
 * An archived Encounter rejects active-control resolution, so terminal history
 * entitlement is resolved against the `completed` reading, exactly as the
 * objective-history projection already does.
 */
function visibilityResolutionSource(encounter: EncounterSession): EncounterSession {
  return encounter.status === "archived" ? { ...encounter, status: "completed" } : encounter;
}

export function resolveScenarioParticipantDisclosure(input: {
  encounters: EncounterSession[];
  participants: ScenarioParticipant[];
  userId: string;
  viewerMode: "gm" | "player";
}): ScenarioParticipantDisclosure {
  const controlledParticipantIds = new Set(
    input.participants
      .filter(
        (participant) => participant.isActive && participant.controlledByUserId === input.userId,
      )
      .map((participant) => participant.id),
  );

  if (input.viewerMode !== "player") {
    return { ...EMPTY_DISCLOSURE, controlledParticipantIds };
  }

  let mappedEncounterMemberships = 0;
  let unmappedEncounterMemberships = 0;

  /**
   * Encounter memberships per Scenario participant, keyed by Encounter id, with
   * the Encounter participant aliases that membership resolved to. Only
   * explicit membership counts: the default-fallback mode synthesises a
   * membership row for every active Scenario participant, which is not a
   * statement that the participant is in that Encounter.
   */
  const membershipsByParticipantId = new Map<string, Map<string, readonly string[]>>();
  for (const encounter of input.encounters) {
    const membership = resolveEncounterParticipantMembership({
      encounter,
      scenarioParticipants: input.participants,
    });
    if (!membership.explicitMode) continue;
    for (const encounterParticipant of membership.participants) {
      if (!encounterParticipant.scenarioParticipantId) {
        unmappedEncounterMemberships += 1;
        continue;
      }
      mappedEncounterMemberships += 1;
      const byEncounterId =
        membershipsByParticipantId.get(encounterParticipant.scenarioParticipantId) ??
        new Map<string, readonly string[]>();
      byEncounterId.set(encounter.id, getCombatDistanceParticipantAliases(encounterParticipant));
      membershipsByParticipantId.set(encounterParticipant.scenarioParticipantId, byEncounterId);
    }
  }

  /**
   * Encounters this viewer is related to: assigned to the membership of a
   * non-archived Encounter, or entitled to the terminal history of a
   * completed/archived one. Status is otherwise irrelevant, which is what
   * closes the pause/complete/archive bypass.
   */
  const viewerEncounterIds = new Set(
    input.encounters
      .filter(
        (encounter) =>
          isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants: input.participants,
            userId: input.userId,
          }) ||
          isUserEntitledToTerminalEncounterHistory({
            encounter,
            scenarioParticipants: input.participants,
            userId: input.userId,
          }),
      )
      .map((encounter) => encounter.id),
  );

  const visibleAliasesByEncounterId = new Map<string, ReadonlySet<string>>();
  const visibleAliasesForEncounter = (encounterId: string): ReadonlySet<string> => {
    const cached = visibleAliasesByEncounterId.get(encounterId);
    if (cached) return cached;
    const encounter = input.encounters.find((candidate) => candidate.id === encounterId);
    const visible = encounter
      ? buildPlayerSafeCombatScopeForUser({
          encounter: visibilityResolutionSource(encounter),
          scenarioParticipants: input.participants,
          userId: input.userId,
        }).visibleParticipantIds
      : new Set<string>();
    visibleAliasesByEncounterId.set(encounterId, visible);
    return visible;
  };

  const suppressedParticipants: ScenarioParticipant[] = [];
  let participantsSharingAnEncounter = 0;

  for (const participant of input.participants) {
    if (controlledParticipantIds.has(participant.id)) continue;

    /**
     * Retained fail-closed belt. `visibilityOverrides` has no production write
     * path, so it never hides anyone a GM hid through the application — which
     * is the whole of #798. But it *is* written by `scenarioRepository`'s
     * create path, by `scripts/recovery/historicalPlaytestCore.ts` and by test
     * helpers, and before #798 it was the only thing these producers consulted.
     * Dropping it would therefore have *widened* disclosure for any row that
     * carries it, which is the opposite of this issue's intent. Keeping it is
     * not the collapse ruling D1 forbids: nothing writes this enum from the
     * GM's per-viewer control, and the matrix below remains the per-viewer
     * mechanism. It only ever denies.
     */
    const flatVisibility = participant.visibilityOverrides?.visibility;
    if (flatVisibility === "hidden" || flatVisibility === "gm_only") {
      suppressedParticipants.push(participant);
      continue;
    }

    const memberships = membershipsByParticipantId.get(participant.id);
    // A Scenario-level participant belongs to no Encounter and stays visible.
    if (!memberships || memberships.size === 0) continue;

    const sharedEncounterIds = [...memberships.keys()].filter((encounterId) =>
      viewerEncounterIds.has(encounterId),
    );
    if (sharedEncounterIds.length === 0) {
      suppressedParticipants.push(participant);
      continue;
    }

    participantsSharingAnEncounter += 1;
    // Union across the viewer's Encounters: visible in one is visible.
    const visibleSomewhere = sharedEncounterIds.some((encounterId) => {
      const visibleAliases = visibleAliasesForEncounter(encounterId);
      return (memberships.get(encounterId) ?? []).some((alias) => visibleAliases.has(alias));
    });
    if (!visibleSomewhere) suppressedParticipants.push(participant);
  }

  const suppressedParticipantIds = new Set(
    suppressedParticipants.map((participant) => participant.id),
  );
  const suppressedParticipantIdAliases = new Set<string>();
  for (const participant of suppressedParticipants) {
    suppressedParticipantIdAliases.add(participant.id);
    suppressedParticipantIdAliases.add(`scenario-${participant.id}`);
    if (participant.characterId) suppressedParticipantIdAliases.add(participant.characterId);
    for (const alias of membershipsByParticipantId.get(participant.id)?.values() ?? []) {
      for (const entry of alias) suppressedParticipantIdAliases.add(entry);
    }
  }

  return {
    controlledParticipantIds,
    idSpaceDiagnostics: {
      mappedEncounterMemberships,
      participantsSharingAnEncounter,
      unmappedEncounterMemberships,
    },
    suppressedParticipantIdAliases,
    suppressedParticipantIds,
    suppressedParticipantNames: new Set(
      suppressedParticipants.map((participant) => participant.snapshot.displayName),
    ),
  };
}
