import { describe, expect, it } from "vitest";

import type { ScenarioParticipant } from "../campaign/scenario";

import {
  PLAYER_FACING_ENCOUNTER_ROSTER_REFUSAL_MESSAGE,
  PlayerFacingEncounterRosterRefusalError,
  assertPlayerFacingEncounterRosterReadable,
  playerFacingEncounterRosterRefusal,
  unreadablePlayerFacingEncounterIds,
} from "./playerFacingEncounterRosterIdentity";
import { encounterSessionSchema, type EncounterSession } from "./session";

/**
 * Forgejo #963 — the roster-identity condition asked again on the player-facing read.
 *
 * The reaching path has two steps, and the point of this file is that step 1 is *accepted*: the
 * state the player read must refuse is state the write boundary was right to let through, because
 * at write time the Scenario participant it collides with did not exist.
 *
 * The driven consequence — which reads refuse, which still pass, and the GM control read that
 * proves the violating state is there to be found — is in
 * `apps/api/src/routes/scenarios/encounterRoutes.playerFacingRosterIdentity.integration.test.ts`.
 */

const now = "2026-11-05T10:00:00.000Z";

function scenarioParticipant(id: string, characterId: string): ScenarioParticipant {
  return {
    characterId,
    createdAt: now,
    id,
    isActive: true,
    joinSource: "gm_added",
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: { displayName: `Participant ${id}` },
    sourceType: "character",
    state: {},
    updatedAt: now,
  } as ScenarioParticipant;
}

function row(input: {
  characterId?: string;
  id: string;
  scenarioParticipantId?: string;
}): Record<string, unknown> {
  return {
    ...(input.characterId ? { characterId: input.characterId } : {}),
    id: input.id,
    label: `Row ${input.id}`,
    participantType: "character",
    ...(input.scenarioParticipantId ? { scenarioParticipantId: input.scenarioParticipantId } : {}),
  };
}

function encounter(participants: unknown[], pendingParticipants?: unknown[]): EncounterSession {
  return encounterSessionSchema.parse({
    createdAt: now,
    id: "encounter-1",
    kind: "combat",
    participantMembershipMode: "explicit",
    participants,
    ...(pendingParticipants ? { pendingParticipants } : {}),
    scenarioId: "scenario-1",
    status: "active",
    title: "The ford",
    updatedAt: now,
  });
}

/** The two combatants the GM meant to put in the Encounter. */
const onstage = scenarioParticipant("participant-onstage", "character-onstage");
const partner = scenarioParticipant("participant-partner", "character-partner");
/** The Character the GM prepared a row for before its player had joined the Scenario. */
const latecomer = scenarioParticipant("participant-latecomer", "character-latecomer");

const legitimateRoster = [
  row({
    characterId: onstage.characterId!,
    id: "encounter-participant-onstage",
    scenarioParticipantId: onstage.id,
  }),
  row({
    characterId: partner.characterId!,
    id: "encounter-participant-partner",
    scenarioParticipantId: partner.id,
  }),
];

describe("the roster-identity condition on the player-facing read (#963)", () => {
  it("accepts the roster the GM meant to write", () => {
    expect(
      playerFacingEncounterRosterRefusal({
        encounter: encounter(legitimateRoster),
        scenarioParticipants: [onstage, partner],
      }),
    ).toBeUndefined();
  });

  describe("the Character who joins after the roster was written", () => {
    /**
     * The row the GM prepared: its own mapping is the onstage combatant, and it carries the
     * latecomer's Character. Step 1 of the reaching path.
     */
    const preparedRoster = [
      row({
        characterId: latecomer.characterId!,
        id: "encounter-participant-onstage",
        scenarioParticipantId: onstage.id,
      }),
      legitimateRoster[1]!,
    ];

    it("is accepted while that Character has not joined, which is why a read has to ask", () => {
      expect(
        playerFacingEncounterRosterRefusal({
          encounter: encounter(preparedRoster),
          scenarioParticipants: [onstage, partner],
        }),
      ).toBeUndefined();
    });

    it("refuses the same stored roster once that Character has joined", () => {
      const refusal = playerFacingEncounterRosterRefusal({
        encounter: encounter(preparedRoster),
        scenarioParticipants: [onstage, partner, latecomer],
      });

      expect(refusal).toContain(latecomer.id);
      expect(refusal).toContain("own identity");
    });

    it("refuses with nothing written and nothing re-read: only the Scenario changed", () => {
      const stored = encounter(preparedRoster);

      expect(
        playerFacingEncounterRosterRefusal({
          encounter: stored,
          scenarioParticipants: [onstage, partner],
        }),
      ).toBeUndefined();
      expect(
        playerFacingEncounterRosterRefusal({
          encounter: stored,
          scenarioParticipants: [onstage, partner, latecomer],
        }),
      ).toBeDefined();
    });
  });

  /**
   * The other reachable form: the raw rows share no alias, so the schema's `superRefine` accepts
   * the roster and it can be stored and re-read. The collision exists only in the collection the
   * readers resolve, after the membership resolver backfills the first row's own `characterId`.
   */
  it("refuses a collision that exists only in the roster readers resolve", () => {
    const rawRows = [
      row({ id: "encounter-participant-partner", scenarioParticipantId: partner.id }),
      row({
        characterId: onstage.characterId!,
        id: partner.characterId!,
        scenarioParticipantId: onstage.id,
      }),
    ];
    const stored = encounter(rawRows);

    // The schema accepts it, which is the condition that makes this a read-side question.
    expect(encounterSessionSchema.safeParse(stored).success).toBe(true);
    expect(
      playerFacingEncounterRosterRefusal({
        encounter: stored,
        scenarioParticipants: [onstage, partner],
      }),
    ).toContain(`claim the identity ${partner.characterId}`);
  });

  /**
   * The held roster is a whole future roster. `resolveEncounterParticipantMembership` reads
   * `participants` only, so a collision held there confers no membership, no control and no
   * disclosure, and there is nothing for the player read to refuse over. It is asked the moment
   * the round-boundary commit promotes it.
   */
  it("does not refuse over the roster held for the round boundary", () => {
    const held = [
      row({
        characterId: latecomer.characterId!,
        id: "encounter-participant-onstage",
        scenarioParticipantId: onstage.id,
      }),
      legitimateRoster[1]!,
    ];

    expect(
      playerFacingEncounterRosterRefusal({
        encounter: encounter(legitimateRoster, held),
        scenarioParticipants: [onstage, partner, latecomer],
      }),
    ).toBeUndefined();
    // Promoted into force, the same rows refuse.
    expect(
      playerFacingEncounterRosterRefusal({
        encounter: encounter(held),
        scenarioParticipants: [onstage, partner, latecomer],
      }),
    ).toBeDefined();
  });

  it("puts no claim on the default-fallback roster, which nobody wrote", () => {
    expect(
      playerFacingEncounterRosterRefusal({
        encounter: encounterSessionSchema.parse({
          createdAt: now,
          id: "encounter-1",
          kind: "combat",
          participantMembershipMode: "defaultAllActive",
          participants: [],
          scenarioId: "scenario-1",
          status: "active",
          title: "The ford",
          updatedAt: now,
        }),
        scenarioParticipants: [onstage, partner, latecomer],
      }),
    ).toBeUndefined();
  });

  describe("the refusal a projection throws", () => {
    const violating = encounter([
      row({
        characterId: latecomer.characterId!,
        id: "encounter-participant-onstage",
        scenarioParticipantId: onstage.id,
      }),
      legitimateRoster[1]!,
    ]);

    it("names no participant, no row and no identity in what the viewer is shown", () => {
      let thrown: unknown;
      try {
        assertPlayerFacingEncounterRosterReadable({
          encounter: violating,
          scenarioParticipants: [onstage, partner, latecomer],
        });
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(PlayerFacingEncounterRosterRefusalError);
      const refusal = thrown as PlayerFacingEncounterRosterRefusalError;
      expect(refusal.message).toBe(PLAYER_FACING_ENCOUNTER_ROSTER_REFUSAL_MESSAGE);
      for (const identifier of [
        latecomer.id,
        latecomer.characterId!,
        onstage.id,
        onstage.characterId!,
        partner.id,
        "encounter-participant-onstage",
      ]) {
        expect(refusal.message).not.toContain(identifier);
      }
      // The diagnostic is kept, and kept off anything that serialises the error.
      expect(Object.keys(refusal)).not.toContain("diagnostic");
      expect(JSON.stringify(refusal)).not.toContain(latecomer.id);
      expect((refusal as unknown as { diagnostic: string }).diagnostic).toContain(latecomer.id);
    });

    it("does not throw for the roster the GM meant to write", () => {
      expect(() =>
        assertPlayerFacingEncounterRosterReadable({
          encounter: encounter(legitimateRoster),
          scenarioParticipants: [onstage, partner, latecomer],
        }),
      ).not.toThrow();
    });

    it("reports the unresolved Encounters as a set a session read can ask once", () => {
      expect([
        ...unreadablePlayerFacingEncounterIds({
          encounters: [violating, { ...encounter(legitimateRoster), id: "encounter-2" }],
          scenarioParticipants: [onstage, partner, latecomer],
        }),
      ]).toEqual(["encounter-1"]);
    });
  });
});
