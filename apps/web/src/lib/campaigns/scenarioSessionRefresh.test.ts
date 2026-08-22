import { describe, expect, it } from "vitest";

import type { ScenarioSessionView } from "@glantri/domain";

import { shouldAcceptScenarioSessionResponse } from "./scenarioSessionRefresh";

function view(revision: string): ScenarioSessionView {
  return {
    availableObjects: [],
    blackboard: { availableObjectIds: [], campaignId: "campaign-1", scenarioId: "scenario-1" },
    encounters: [],
    history: [],
    participants: [],
    revision,
    scenario: {
      campaignId: "campaign-1",
      description: "",
      id: "scenario-1",
      name: "Lost Seal",
      status: "live",
    },
    viewerMode: "player",
  };
}

describe("Scenario session refresh ordering", () => {
  it("does not let a late polling response replace a newer mutation response", () => {
    expect(
      shouldAcceptScenarioSessionResponse(
        view("2026-08-22T10:00:02.000Z"),
        view("2026-08-22T10:00:01.000Z"),
      ),
    ).toBe(false);
    expect(
      shouldAcceptScenarioSessionResponse(
        view("2026-08-22T10:00:02.000Z"),
        view("2026-08-22T10:00:03.000Z"),
      ),
    ).toBe(true);
  });
});
