import { describe, expect, it } from "vitest";

import type { ScenarioParticipant } from "../campaign/scenario";

import {
  encounterParticipantSchema,
  encounterRosterIdentityRefusal,
  encounterRosterScenarioIdentityRefusal,
  encounterSessionSchema,
  resolveEncounterParticipantByRollParticipantId,
  resolveEncounterParticipantMembership,
  type EncounterParticipant,
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

/** A roster row as the schema normalizes it, so the readers below are given real rows. */
function rosterRow(row: Record<string, unknown>): EncounterParticipant {
  return encounterParticipantSchema.parse(row);
}

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
   * A row may legitimately be its own mapping — the alias helper deduplicates within a
   * row, so a row whose `id` equals its own `scenarioParticipantId` claims one identity
   * and not two. Worth a case of its own: a condition that refused this would refuse a
   * shape the product writes.
   */
  it("accepts a row whose identity is its own mapping, in either form", () => {
    expect(
      encounterRosterIdentityRefusal([
        { characterId: "character-a", id: "participant-a", scenarioParticipantId: "participant-a" },
        {
          characterId: "character-b",
          id: "scenario-participant-b",
          scenarioParticipantId: "participant-b",
        },
      ]),
    ).toBeUndefined();
  });

  it("accepts a roster with no rows, which is how the Scenario fallback is written", () => {
    expect(encounterRosterIdentityRefusal([])).toBeUndefined();
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
          { id: "participant-b", scenarioParticipantId: "participant-b" },
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

/**
 * Forgejo #947, repair cycle 1 — the defence this branch removed, restored where it
 * can be stated without a roster write.
 *
 * `resolveEncounterParticipantByRollParticipantId` prefers a row whose own `id` is the
 * requested identity over a row that merely answers for it through an alias. That
 * ordering decides which combatant a reader answers about when two rows can answer,
 * and it is the only thing that decides it.
 *
 * The branch deleted the route case that pinned the ordering and recorded that the
 * roster conditions above had made a colliding roster unwritable. **That ground is
 * false, measured.** The roster-local condition is stated over the **raw** rows;
 * `resolveEncounterParticipantMembership` then backfills `scenarioParticipantId` and
 * `characterId`, and every reader applies the tie-break to the **resolved** collection.
 * Independent QA (issue #947, comment 21083) drove the surviving shape through the GM's
 * own `PATCH` at a 200, and showed that inverting the ordering left the entire
 * repository green — so the ordering was load-bearing and covered nowhere.
 *
 * The third case below carries that shape and is the one that makes the preference
 * reachable rather than hypothetical; the first two state the preference itself over a
 * two-row colliding array, in both orders, so the answer cannot come from the roster's
 * order. Each of the three fails when the ordering in `session.ts` is inverted.
 */
describe("an exact identity is preferred over a colliding alias (#947)", () => {
  /** The acting row's own `id` is the bystander's Character id. */
  const theRowHoldingTheIdentity = rosterRow(
    mappedRow("character-bystander", "participant-owner", "character-owner"),
  );
  /** The bystander's own row answers for the same Character through its alias. */
  const theRowAnsweringThroughItsCharacter = rosterRow(
    mappedRow("row-bystander", "participant-bystander", "character-bystander"),
  );

  it("prefers the row whose own id is the requested identity", () => {
    const resolved = resolveEncounterParticipantByRollParticipantId({
      participantId: "character-bystander",
      participants: [theRowHoldingTheIdentity, theRowAnsweringThroughItsCharacter],
    });

    expect(resolved?.id).toBe("character-bystander");
    expect(resolved?.scenarioParticipantId).toBe("participant-owner");
  });

  it("prefers it from behind the colliding row, so the answer is not the roster's order", () => {
    const resolved = resolveEncounterParticipantByRollParticipantId({
      participantId: "character-bystander",
      participants: [theRowAnsweringThroughItsCharacter, theRowHoldingTheIdentity],
    });

    expect(resolved?.id).toBe("character-bystander");
    expect(resolved?.scenarioParticipantId).toBe("participant-owner");
  });

  /**
   * The reachable shape, and the reason the preference still has work to do: the raw
   * rows share no alias, so the roster conditions accept this roster and the GM can
   * write it. The collision appears only after the membership resolver backfills the
   * bystander's own `characterId`, which is the collection every reader resolves
   * against — the same roster the past-item-viewability gate refuses on.
   */
  it("answers a collision the roster conditions accept, because readers resolve and they do not", () => {
    const rawRows = [
      {
        id: "row-bystander",
        label: "Row row-bystander",
        participantType: "character" as const,
        scenarioParticipantId: "participant-bystander",
      },
      mappedRow("character-bystander", "participant-owner", "character-owner"),
    ];
    expect(encounterSessionSchema.safeParse(session(rawRows)).success).toBe(true);
    expect(encounterRosterIdentityRefusal(rawRows)).toBeUndefined();

    const resolvedRoster = resolveEncounterParticipantMembership({
      encounter: encounterSessionSchema.parse(session(rawRows)),
      scenarioParticipants: [
        scenarioParticipant("participant-owner", "character-owner"),
        scenarioParticipant("participant-bystander", "character-bystander"),
      ],
    }).participants;

    expect(encounterRosterIdentityRefusal(resolvedRoster)).toContain(
      "claim the identity character-bystander",
    );
    expect(
      resolveEncounterParticipantByRollParticipantId({
        participantId: "character-bystander",
        participants: resolvedRoster,
      })?.scenarioParticipantId,
    ).toBe("participant-owner");
  });

  /**
   * The control that makes the preference a preference rather than "always answer with
   * the row that was asked for": with no row holding the identity, the alias fallback
   * still answers. This case passes under the inverted ordering, and it is here so that
   * the three above are known to be measuring the ordering and not the lookup.
   */
  it("still answers through the alias when no row holds the identity exactly", () => {
    expect(
      resolveEncounterParticipantByRollParticipantId({
        participantId: "character-bystander",
        participants: [theRowAnsweringThroughItsCharacter],
      })?.id,
    ).toBe("row-bystander");
  });
});
