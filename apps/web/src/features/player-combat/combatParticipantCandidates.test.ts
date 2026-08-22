import { describe, expect, it } from "vitest";

import {
  buildCombatParticipantCandidates,
  type CombatParticipantRosterEntry,
} from "./combatParticipantCandidates";

const encounter: { participants: CombatParticipantRosterEntry[] } = {
  participants: [
    {
      id: "encounter-aria",
      label: "Aria",
      scenarioParticipantId: "aria",
      characterId: "character-aria",
    },
    {
      id: "encounter-borin",
      label: "Borin",
      scenarioParticipantId: "borin",
      characterId: "character-borin",
    },
  ],
};

describe("combat participant candidates", () => {
  it("uses the encounter roster before and after declaration facts change", () => {
    const input = {
      actingParticipantId: "aria",
      encounter,
      purpose: "attack_target" as const,
      visibleParticipantIds: new Set(["aria", "borin"]),
    };

    const beforeDeclaration = buildCombatParticipantCandidates(input);
    const afterDeclaration = buildCombatParticipantCandidates(input);

    expect(beforeDeclaration).toEqual(afterDeclaration);
    expect(beforeDeclaration.filter((candidate) => candidate.selectable)).toEqual([
      expect.objectContaining({
        participantId: "encounter-borin",
        relationship: "opponent",
      }),
    ]);
  });

  it("resolves aliases, excludes self and filters inactive or hidden participants", () => {
    const candidates = buildCombatParticipantCandidates({
      activeParticipantIds: new Set(["aria", "borin"]),
      actingParticipantId: "scenario-aria",
      encounter: {
        participants: [
          ...encounter.participants,
          { id: "removed", label: "Removed", scenarioParticipantId: "removed" },
        ],
      },
      purpose: "maneuver_target",
      visibleParticipantIds: new Set(["scenario-aria", "borin"]),
    });

    expect(candidates.map((candidate) => [candidate.participantId, candidate.selectable])).toEqual([
      ["encounter-aria", false],
      ["encounter-borin", true],
      ["removed", false],
    ]);
    expect(
      candidates.find((candidate) => candidate.participantId === "removed")?.disabledReason,
    ).toBe("Hidden from this viewer");
  });

  it("keeps deterministic ordering and purpose-independent target policy", () => {
    const attack = buildCombatParticipantCandidates({
      actingParticipantId: "aria",
      encounter,
      purpose: "attack_target",
    });
    const maneuver = buildCombatParticipantCandidates({
      actingParticipantId: "aria",
      encounter,
      purpose: "maneuver_target",
    });

    expect(attack.map((candidate) => candidate.participantId)).toEqual([
      "encounter-aria",
      "encounter-borin",
    ]);
    expect(maneuver.map((candidate) => candidate.participantId)).toEqual(
      attack.map((candidate) => candidate.participantId),
    );
  });

  it("keeps identities omitted by the player projection out of target options across refreshes", () => {
    const sharedEncounter = {
      participants: [
        ...encounter.participants,
        {
          id: "encounter-hidden",
          label: "Hidden Steward",
          scenarioParticipantId: "hidden-steward",
        },
        {
          id: "encounter-gm-only",
          label: "GM Only Witness",
          scenarioParticipantId: "gm-only-witness",
        },
      ],
    };
    const playerProjectionIds = new Set(["aria", "borin"]);
    const buildTargetOptions = () =>
      buildCombatParticipantCandidates({
        actingParticipantId: "aria",
        encounter: sharedEncounter,
        purpose: "attack_target" as const,
        visibleParticipantIds: playerProjectionIds,
      })
        .filter((candidate) => candidate.selectable)
        .map(({ displayName, participantId }) => ({ displayName, participantId }));

    const initial = buildTargetOptions();
    const afterReloadOrPoll = buildTargetOptions();

    expect(initial).toEqual(afterReloadOrPoll);
    expect(initial).toEqual([{ displayName: "Borin", participantId: "encounter-borin" }]);
    expect(JSON.stringify(initial)).not.toContain("Hidden Steward");
    expect(JSON.stringify(initial)).not.toContain("GM Only Witness");
    expect(initial).toEqual(
      buildCombatParticipantCandidates({
        actingParticipantId: "aria",
        encounter,
        purpose: "attack_target",
        visibleParticipantIds: playerProjectionIds,
      })
        .filter((candidate) => candidate.selectable)
        .map(({ displayName, participantId }) => ({ displayName, participantId })),
    );
  });
});
