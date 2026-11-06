import { describe, expect, it } from "vitest";

import {
  encountersBlockingScenarioParticipantDeactivation,
  scenarioParticipantDeactivationRefusal,
} from "./session";

function encounter(input: {
  held?: string[];
  inForce: string[];
  status: "active" | "archived" | "completed" | "draft" | "paused";
  title?: string;
}) {
  return {
    participants: input.inForce.map((scenarioParticipantId) => ({ scenarioParticipantId })),
    pendingParticipants: input.held?.map((scenarioParticipantId) => ({ scenarioParticipantId })),
    status: input.status,
    title: input.title ?? "Courtyard",
  };
}

describe("which Encounters freeze a Scenario participant's activity", () => {
  it("names a running Encounter that holds the participant on the roster in force", () => {
    expect(
      encountersBlockingScenarioParticipantDeactivation({
        encounters: [encounter({ inForce: ["participant-1", "participant-2"], status: "active" })],
        scenarioParticipantId: "participant-1",
      }),
    ).toHaveLength(1);
  });

  it("names a running Encounter that holds the participant only on the held roster", () => {
    // A held roster becomes the roster in force at the next round boundary, so a combatant made
    // inactive while waiting there would leave that boundary unable to write the roster promised.
    expect(
      encountersBlockingScenarioParticipantDeactivation({
        encounters: [
          encounter({
            held: ["participant-1", "participant-3"],
            inForce: ["participant-1"],
            status: "active",
          }),
        ],
        scenarioParticipantId: "participant-3",
      }),
    ).toHaveLength(1);
  });

  it("names nothing for a participant no running Encounter holds", () => {
    expect(
      encountersBlockingScenarioParticipantDeactivation({
        encounters: [encounter({ inForce: ["participant-1"], status: "active" })],
        scenarioParticipantId: "participant-9",
      }),
    ).toEqual([]);
  });

  it.each(["draft", "paused", "completed", "archived"] as const)(
    "names nothing for a %s Encounter, which is running no round",
    (status) => {
      expect(
        encountersBlockingScenarioParticipantDeactivation({
          encounters: [encounter({ inForce: ["participant-1"], status })],
          scenarioParticipantId: "participant-1",
        }),
      ).toEqual([]);
    },
  );

  it("names every running Encounter that holds the participant", () => {
    expect(
      encountersBlockingScenarioParticipantDeactivation({
        encounters: [
          encounter({ inForce: ["participant-1"], status: "active", title: "Courtyard" }),
          encounter({ inForce: ["participant-1"], status: "paused", title: "Cellar" }),
          encounter({ inForce: ["participant-1"], status: "active", title: "Gatehouse" }),
        ],
        scenarioParticipantId: "participant-1",
      }).map((blocking) => blocking.title),
    ).toEqual(["Courtyard", "Gatehouse"]);
  });
});

describe("what the GM is told when a running Encounter freezes a participant's activity", () => {
  it("says nothing when no running Encounter holds the participant", () => {
    expect(
      scenarioParticipantDeactivationRefusal({
        encounterTitles: [],
        participantDisplayName: "Glim Fairwater",
      }),
    ).toBeUndefined();
  });

  it("names the combatant, the Encounter and both ways forward", () => {
    const refusal = scenarioParticipantDeactivationRefusal({
      encounterTitles: ["Courtyard"],
      participantDisplayName: "Glim Fairwater",
    });

    expect(refusal).toContain("Glim Fairwater");
    expect(refusal).toContain("the Encounter Courtyard");
    expect(refusal).toContain("Encounter roster");
    expect(refusal).toContain("round end");
  });

  it("never tells the GM to refresh, because the Scenario they are reading is already correct", () => {
    expect(
      scenarioParticipantDeactivationRefusal({
        encounterTitles: ["Courtyard"],
        participantDisplayName: "Glim Fairwater",
      })?.toLowerCase(),
    ).not.toContain("refresh");
  });

  it("names several Encounters when several hold the combatant", () => {
    expect(
      scenarioParticipantDeactivationRefusal({
        encounterTitles: ["Courtyard", "Gatehouse"],
        participantDisplayName: "Glim Fairwater",
      }),
    ).toContain("the Encounters Courtyard and Gatehouse");
  });
});
