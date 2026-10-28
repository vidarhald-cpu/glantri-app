import { describe, expect, it } from "vitest";

import { encounterSessionSchema, type EncounterSession } from "../encounter/session";
import { scenarioParticipantSchema, type ScenarioParticipant } from "./scenario";
import { resolveScenarioParticipantDisclosure } from "./scenarioParticipantDisclosure";

const now = "2026-10-28T10:00:00.000Z";

function participant(input: {
  controlledByUserId?: string;
  displayName: string;
  id: string;
  role?: ScenarioParticipant["role"];
}): ScenarioParticipant {
  return scenarioParticipantSchema.parse({
    characterId: `character-${input.id}`,
    controlledByUserId: input.controlledByUserId,
    createdAt: now,
    id: input.id,
    isActive: true,
    joinSource: "gm_added",
    role: input.role ?? (input.controlledByUserId ? "player_character" : "npc"),
    scenarioId: "scenario-1",
    snapshot: { displayName: input.displayName },
    sourceType: input.controlledByUserId ? "character" : "entity",
    state: { combat: {}, equipment: {}, health: {}, resources: {} },
    updatedAt: now,
  });
}

/**
 * Encounter participant ids use the production shape `scenario-${ScenarioParticipant.id}`,
 * which is what `ScenarioDetailPageContent.buildEncounterParticipant` writes. A fixture
 * using synthetic ids would make the id-space mapping look easier than it is.
 */
function encounter(input: {
  id: string;
  scenarioParticipantIds: string[];
  status?: EncounterSession["status"];
  title: string;
  visibility?: Record<string, Record<string, boolean>>;
}): EncounterSession {
  return encounterSessionSchema.parse({
    createdAt: now,
    id: input.id,
    kind: "roleplay",
    participantMembershipMode: "explicit",
    participants: input.scenarioParticipantIds.map((scenarioParticipantId, index) => ({
      id: `scenario-${scenarioParticipantId}`,
      label: scenarioParticipantId,
      order: index,
      participantType: "scenario",
      scenarioParticipantId,
    })),
    ...(input.visibility ? { roleplayState: { visibility: input.visibility } } : {}),
    scenarioId: "scenario-1",
    status: input.status ?? "active",
    title: input.title,
    updatedAt: now,
  });
}

const ari = participant({ controlledByUserId: "user-ari", displayName: "Ari", id: "p-ari" });
const bryn = participant({ controlledByUserId: "user-bryn", displayName: "Bryn", id: "p-bryn" });
const shade = participant({ displayName: "Lurking Shade", id: "p-shade" });
const rell = participant({ displayName: "Gate Sergeant Rell", id: "p-rell" });
const dorn = participant({ displayName: "Watchman Dorn", id: "p-dorn" });

const participants = [ari, bryn, shade, rell, dorn];

/** The GM has hidden Shade from Ari, and said nothing about Rell. */
const gatehouseHidesShadeFromAri = {
  "scenario-p-ari": {
    "scenario-p-rell": true,
    "scenario-p-shade": false,
  },
};

describe("resolveScenarioParticipantDisclosure", () => {
  it("suppresses a participant the GM hid from this viewer, and proves the id spaces intersect", () => {
    const disclosure = resolveScenarioParticipantDisclosure({
      encounters: [
        encounter({
          id: "encounter-gatehouse",
          scenarioParticipantIds: ["p-ari", "p-rell", "p-shade"],
          title: "Gatehouse",
          visibility: gatehouseHidesShadeFromAri,
        }),
      ],
      participants,
      userId: "user-ari",
      viewerMode: "player",
    });

    expect([...disclosure.suppressedParticipantIds]).toEqual(["p-shade"]);
    expect(disclosure.suppressedParticipantNames.has("Lurking Shade")).toBe(true);

    // The id-space intersection, asserted rather than assumed: a set that never
    // intersects the space it filters produces a repair that measures clean
    // because it filters nothing.
    expect(disclosure.idSpaceDiagnostics).toEqual({
      mappedEncounterMemberships: 3,
      participantsSharingAnEncounter: 2,
      unmappedEncounterMemberships: 0,
    });
    expect(disclosure.suppressedParticipantIdAliases).toContain("p-shade");
    expect(disclosure.suppressedParticipantIdAliases).toContain("scenario-p-shade");
    expect(disclosure.suppressedParticipantIdAliases).toContain("character-p-shade");
  });

  it("is per viewer: the same hide does not reach a player the GM did not hide it from", () => {
    const encounters = [
      encounter({
        id: "encounter-gatehouse",
        scenarioParticipantIds: ["p-ari", "p-bryn", "p-shade"],
        title: "Gatehouse",
        visibility: {
          "scenario-p-ari": { "scenario-p-bryn": true, "scenario-p-shade": false },
          "scenario-p-bryn": { "scenario-p-ari": true, "scenario-p-shade": true },
        },
      }),
    ];

    expect([
      ...resolveScenarioParticipantDisclosure({
        encounters,
        participants,
        userId: "user-ari",
        viewerMode: "player",
      }).suppressedParticipantIds,
    ]).toEqual(["p-shade"]);
    expect([
      ...resolveScenarioParticipantDisclosure({
        encounters,
        participants,
        userId: "user-bryn",
        viewerMode: "player",
      }).suppressedParticipantIds,
    ]).toEqual([]);
  });

  /**
   * Characterizes a consequence of reusing the honoured resolver rather than
   * reimplementing its default, which #798's packet requires: the
   * `hasVisibilityRows` flag is global to the Encounter's matrix, so once the
   * GM has written any row, a viewer without a row of their own sees no
   * co-participants there. That is already how combat and `GET /encounters/:id`
   * behave; before #798 the Scenario-level surfaces simply did not consult the
   * matrix at all, so they disagreed with the Encounter the player was in.
   */
  it("treats a non-empty matrix as explicit: a viewer with no row of their own sees no co-participant", () => {
    const disclosure = resolveScenarioParticipantDisclosure({
      encounters: [
        encounter({
          id: "encounter-gatehouse",
          scenarioParticipantIds: ["p-ari", "p-bryn", "p-rell"],
          title: "Gatehouse",
          // A row for Ari only. Bryn is in the same Encounter and unmentioned.
          visibility: { "scenario-p-ari": { "scenario-p-rell": true } },
        }),
      ],
      participants,
      userId: "user-bryn",
      viewerMode: "player",
    });

    expect([...disclosure.suppressedParticipantIds].sort()).toEqual(["p-ari", "p-rell"]);
  });

  it("takes the union across the viewer's Encounters: visible in one is visible", () => {
    const disclosure = resolveScenarioParticipantDisclosure({
      encounters: [
        encounter({
          id: "encounter-gatehouse",
          scenarioParticipantIds: ["p-ari", "p-shade"],
          title: "Gatehouse",
          visibility: { "scenario-p-ari": { "scenario-p-shade": false } },
        }),
        encounter({
          id: "encounter-cellar",
          scenarioParticipantIds: ["p-ari", "p-shade"],
          title: "Cellar",
          visibility: { "scenario-p-ari": { "scenario-p-shade": true } },
        }),
      ],
      participants,
      userId: "user-ari",
      viewerMode: "player",
    });

    expect([...disclosure.suppressedParticipantIds]).toEqual([]);
  });

  it("never suppresses the viewer's own participant or a participant in no Encounter", () => {
    const disclosure = resolveScenarioParticipantDisclosure({
      encounters: [
        encounter({
          id: "encounter-gatehouse",
          scenarioParticipantIds: ["p-ari", "p-shade"],
          title: "Gatehouse",
          // Ari is hidden from herself and Shade is hidden from Ari.
          visibility: { "scenario-p-ari": { "scenario-p-ari": false } },
        }),
      ],
      participants,
      userId: "user-ari",
      viewerMode: "player",
    });

    expect(disclosure.suppressedParticipantIds.has("p-ari")).toBe(false);
    // Watchman Dorn belongs to no Encounter: the Situation rail must not empty.
    expect(disclosure.suppressedParticipantIds.has("p-dorn")).toBe(false);
    expect(disclosure.suppressedParticipantIds.has("p-shade")).toBe(true);
  });

  it("keeps the deliberate fail-open default when the GM has written no visibility rows", () => {
    const disclosure = resolveScenarioParticipantDisclosure({
      encounters: [
        encounter({
          id: "encounter-gatehouse",
          scenarioParticipantIds: ["p-ari", "p-rell", "p-shade"],
          title: "Gatehouse",
        }),
      ],
      participants,
      userId: "user-ari",
      viewerMode: "player",
    });

    expect([...disclosure.suppressedParticipantIds]).toEqual([]);
    // Non-vacuous: the mapping ran and had something to decide about.
    expect(disclosure.idSpaceDiagnostics.participantsSharingAnEncounter).toBe(2);
  });

  it("suppresses occupants of an Encounter the viewer is not in, whatever its status", () => {
    for (const status of ["active", "paused", "completed", "archived", "draft"] as const) {
      const disclosure = resolveScenarioParticipantDisclosure({
        encounters: [
          encounter({
            id: "encounter-courtyard",
            scenarioParticipantIds: ["p-ari"],
            title: "Courtyard",
          }),
          encounter({
            id: "encounter-vault",
            scenarioParticipantIds: ["p-shade"],
            status,
            title: "Vault",
          }),
        ],
        participants,
        userId: "user-ari",
        viewerMode: "player",
      });

      expect([...disclosure.suppressedParticipantIds], `vault status ${status}`).toEqual([
        "p-shade",
      ]);
    }
  });

  it("keeps a co-participant of the viewer's own completed or archived Encounter visible", () => {
    for (const status of ["completed", "archived"] as const) {
      const disclosure = resolveScenarioParticipantDisclosure({
        encounters: [
          encounter({
            id: "encounter-gatehouse",
            scenarioParticipantIds: ["p-ari", "p-rell"],
            status,
            title: "Gatehouse",
          }),
        ],
        participants,
        userId: "user-ari",
        viewerMode: "player",
      });

      expect([...disclosure.suppressedParticipantIds], `gatehouse status ${status}`).toEqual([]);
    }
  });

  it("decides nothing for a GM viewer", () => {
    const disclosure = resolveScenarioParticipantDisclosure({
      encounters: [
        encounter({
          id: "encounter-gatehouse",
          scenarioParticipantIds: ["p-ari", "p-shade"],
          title: "Gatehouse",
          visibility: gatehouseHidesShadeFromAri,
        }),
      ],
      participants,
      userId: "the-gm",
      viewerMode: "gm",
    });

    expect([...disclosure.suppressedParticipantIds]).toEqual([]);
  });
});
