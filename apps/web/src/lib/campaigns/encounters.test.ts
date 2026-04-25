import { describe, expect, it } from "vitest";

import type { EncounterSession } from "@glantri/domain";

import {
  getCampaignWorkspaceVisibleEncounters,
  getScenarioVisibleEncounters,
} from "./encounters";

function createEncounter(input: Partial<EncounterSession> & Pick<EncounterSession, "id" | "title">): EncounterSession {
  return {
    actionLog: [],
    createdAt: "2026-04-25T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: input.id,
    participants: [],
    status: "setup",
    title: input.title,
    turnOrderMode: "manual",
    updatedAt: "2026-04-25T00:00:00.000Z",
    campaignId: input.campaignId,
    scenarioId: input.scenarioId,
  };
}

describe("campaign encounter visibility", () => {
  it("shows player-visible encounters for accessible scenarios only", () => {
    const visible = getCampaignWorkspaceVisibleEncounters({
      campaignId: "campaign-1",
      encounters: [
        createEncounter({
          campaignId: "campaign-1",
          id: "enc-1",
          scenarioId: "scenario-1",
          title: "Arena bout",
        }),
        createEncounter({
          campaignId: "campaign-1",
          id: "enc-2",
          scenarioId: "scenario-2",
          title: "Hidden ambush",
        }),
        createEncounter({
          campaignId: "campaign-2",
          id: "enc-3",
          scenarioId: "scenario-1",
          title: "Wrong campaign",
        }),
      ],
      scenarioIds: ["scenario-1"],
    });

    expect(visible.map((encounter) => encounter.id)).toEqual(["enc-1"]);
  });

  it("hides encounters that are not linked to an accessible scenario", () => {
    const visible = getCampaignWorkspaceVisibleEncounters({
      campaignId: "campaign-1",
      encounters: [
        createEncounter({
          campaignId: "campaign-1",
          id: "enc-1",
          title: "Legacy orphan",
        }),
      ],
      scenarioIds: ["scenario-1"],
    });

    expect(visible).toEqual([]);
  });

  it("returns the scenario-specific encounter list used by the player view", () => {
    const visible = getScenarioVisibleEncounters({
      encounters: [
        createEncounter({
          campaignId: "campaign-1",
          id: "enc-1",
          scenarioId: "scenario-1",
          title: "Arena bout",
        }),
        createEncounter({
          campaignId: "campaign-1",
          id: "enc-2",
          scenarioId: "scenario-2",
          title: "Dock fight",
        }),
      ],
      scenarioId: "scenario-1",
    });

    expect(visible.map((encounter) => encounter.id)).toEqual(["enc-1"]);
  });
});

