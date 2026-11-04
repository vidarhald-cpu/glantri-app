import { describe, expect, it } from "vitest";

import {
  encounterRosterIdentityRefusal,
  encounterRosterScenarioIdentityRefusal,
  encounterSessionSchema,
} from "./session";

/**
 * Forgejo #947 — an identity two rows can claim is not an identity.
 *
 * Two conditions, in the two places that can state them:
 *
 * - **roster-local uniqueness** is a property of the roster alone, so
 *   `encounterSessionSchema` states it and therefore reaches every writer; and
 * - **identity-to-Scenario consistency** is not, because a row can borrow the
 *   identity of a Scenario participant who is not on the roster at all. It is asked
 *   at the write boundary, where the Scenario's participants are known.
 *
 * The driven reader consequences, and the route-level acceptance and refusal, are in
 * `apps/api/src/routes/scenarios/encounterRosterIdentity.integration.test.ts`.
 */

const now = "2026-11-04T10:00:00.000Z";

/** The form the GM's roster editor mints: an `id` derived from the row's own mapping. */
function derivedRow(scenarioParticipantId: string, characterId?: string) {
  return {
    characterId,
    id: `scenario-${scenarioParticipantId}`,
    label: `Row ${scenarioParticipantId}`,
    participantType: "character" as const,
    scenarioParticipantId,
  };
}

/** The form a seeded or imported roster carries: an `id` of its own, plus a mapping. */
function mappedRow(id: string, scenarioParticipantId: string, characterId?: string) {
  return {
    characterId,
    id,
    label: `Row ${id}`,
    participantType: "character" as const,
    scenarioParticipantId,
  };
}

/** An ad-hoc combatant: a free `id`, no Scenario mapping and no character. */
function adHocRow(id: string) {
  return { adHocName: "Hired blade", id, label: "Hired blade", participantType: "ad-hoc" as const };
}

function session(participants: unknown[], pendingParticipants?: unknown[]) {
  return {
    createdAt: now,
    id: "encounter-1",
    kind: "combat",
    participantMembershipMode: "explicit",
    participants,
    pendingParticipants,
    scenarioId: "scenario-1",
    status: "active",
    title: "The ford",
    updatedAt: now,
  };
}

describe("a roster refuses an identity two rows can claim (#947)", () => {
  it("accepts a roster in which every row holds a distinct identity", () => {
    expect(
      encounterRosterIdentityRefusal([
        mappedRow("encounter-participant-a", "participant-a", "character-a"),
        derivedRow("participant-b", "character-b"),
        adHocRow("3f2a9c18-0000-4000-8000-000000000001"),
        { id: "scenario-fallback-participant-c", scenarioParticipantId: "participant-c" },
      ]),
    ).toBeUndefined();
  });

  /**
   * One case per alias form the readers resolve a row through, because the condition
   * is only as good as its coverage of the ways two rows can meet. Each is stated as
   * the identity the second row borrows from the first.
   */
  it.each([
    [
      "the same row id",
      [mappedRow("row-x", "participant-a"), mappedRow("row-x", "participant-b")],
      "row-x",
    ],
    [
      "a row id equal to another row's mapping",
      [mappedRow("participant-b", "participant-a"), mappedRow("row-y", "participant-b")],
      "participant-b",
    ],
    [
      "a row id equal to another row's prefixed mapping",
      [mappedRow("scenario-participant-b", "participant-a"), mappedRow("row-y", "participant-b")],
      "scenario-participant-b",
    ],
    [
      "the same character",
      [
        mappedRow("row-x", "participant-a", "character-shared"),
        mappedRow("row-y", "participant-b", "character-shared"),
      ],
      "character-shared",
    ],
    [
      "a row id equal to another row's character",
      [
        mappedRow("character-b", "participant-a"),
        mappedRow("row-y", "participant-b", "character-b"),
      ],
      "character-b",
    ],
  ])("refuses a roster whose rows meet through %s", (_label, participants, alias) => {
    expect(encounterRosterIdentityRefusal(participants)).toContain(`claim the identity ${alias}`);
  });

  it("refuses the session that carries such a roster, so every writer is reached", () => {
    const refused = encounterSessionSchema.safeParse(
      session([mappedRow("row-x", "participant-a"), mappedRow("row-x", "participant-b")]),
    );

    expect(refused.success).toBe(false);
    expect(refused.error?.issues.map((issue) => issue.path.join("."))).toEqual(["participants"]);
  });

  /**
   * The held roster is a whole future roster: a collision placed there becomes the
   * roster in force at the next round boundary, so it is required to be coherent on
   * its own terms rather than when it is promoted.
   */
  it("refuses a collision placed in the roster held for the round boundary", () => {
    const refused = encounterSessionSchema.safeParse(
      session(
        [mappedRow("row-a", "participant-a")],
        [mappedRow("row-x", "participant-a"), mappedRow("row-x", "participant-b")],
      ),
    );

    expect(refused.success).toBe(false);
    expect(refused.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "pendingParticipants",
    ]);
  });

  it("accepts the session that carries a coherent roster and a coherent held roster", () => {
    expect(
      encounterSessionSchema.safeParse(
        session(
          [mappedRow("row-a", "participant-a"), derivedRow("participant-b")],
          [mappedRow("row-a", "participant-a")],
        ),
      ).success,
    ).toBe(true);
  });
});

describe("a roster row's identity must describe its own mapping (#947)", () => {
  const scenarioParticipants = [
    { characterId: "character-a", id: "participant-a" },
    { characterId: "character-b", id: "participant-b" },
    { characterId: "character-c", id: "participant-c" },
  ];

  it("accepts every form a legitimate writer produces", () => {
    expect(
      encounterRosterScenarioIdentityRefusal({
        participants: [
          mappedRow("encounter-participant-a", "participant-a", "character-a"),
          derivedRow("participant-b", "character-b"),
          { id: "scenario-fallback-participant-c", scenarioParticipantId: "participant-c" },
          adHocRow("3f2a9c18-0000-4000-8000-000000000001"),
        ],
        scenarioParticipants,
      }),
    ).toBeUndefined();
  });

  /**
   * The reaching condition the roster-local condition above cannot see: the borrowed
   * identity belongs to `participant-c`, who is not on this roster, so the submitted
   * document does not contain it. This is the condition that makes that participant
   * control the row, and control is tested before visibility.
   */
  it("refuses a row carrying the bare identity of a participant who is not on the roster", () => {
    expect(
      encounterRosterScenarioIdentityRefusal({
        participants: [
          mappedRow("participant-c", "participant-a", "character-a"),
          mappedRow("encounter-participant-b", "participant-b", "character-b"),
        ],
        scenarioParticipants,
      }),
    ).toContain(
      "belonging to Scenario participant participant-c rather than to its own participant-a",
    );
  });

  it("refuses a row carrying the prefixed identity of another participant", () => {
    expect(
      encounterRosterScenarioIdentityRefusal({
        participants: [mappedRow("scenario-participant-c", "participant-a", "character-a")],
        scenarioParticipants,
      }),
    ).toContain("belonging to Scenario participant participant-c");
  });

  it("refuses a row carrying another participant's character", () => {
    expect(
      encounterRosterScenarioIdentityRefusal({
        participants: [mappedRow("encounter-participant-a", "participant-a", "character-c")],
        scenarioParticipants,
      }),
    ).toContain("belonging to Scenario participant participant-c");
  });

  /**
   * An ad-hoc row declares no mapping, so there is no answer to prefer when it
   * corresponds to two participants. That is the same ambiguity without a declared
   * resolution, and it is refused rather than resolved by position.
   */
  it("refuses an unmapped row that corresponds to more than one participant", () => {
    expect(
      encounterRosterScenarioIdentityRefusal({
        participants: [{ characterId: "character-b", id: "participant-a" }],
        scenarioParticipants,
      }),
    ).toContain("more than one Scenario participant");
  });

  it("accepts an unmapped row that corresponds to exactly one participant", () => {
    expect(
      encounterRosterScenarioIdentityRefusal({
        participants: [{ characterId: "character-b", id: "row-free" }],
        scenarioParticipants,
      }),
    ).toBeUndefined();
  });

  /**
   * The condition asks the readers' own correspondence rather than keeping an
   * enumeration of its own, so a Scenario participant the correspondence does not
   * reach is not reached here either — and, the other way round, a form added to the
   * correspondence is covered here without this file changing.
   */
  it("reaches no participant the readers' own correspondence does not reach", () => {
    expect(
      encounterRosterScenarioIdentityRefusal({
        participants: [mappedRow("unrelated-handle", "participant-a", "character-a")],
        scenarioParticipants,
      }),
    ).toBeUndefined();
  });
});
