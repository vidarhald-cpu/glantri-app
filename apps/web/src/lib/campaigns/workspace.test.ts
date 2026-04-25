import { describe, expect, it } from "vitest";

import { buildCampaignWorkspaceTabs, resolveCampaignWorkspaceState } from "./workspace";

describe("campaign workspace", () => {
  it("keeps the intended left-to-right tab order and hides the GM tab for players", () => {
    expect(
      buildCampaignWorkspaceTabs({ canAccessGmEncounter: true }).map((tab) => tab.id)
    ).toEqual(["campaign", "scenario", "gm-encounter", "player-encounter"]);

    expect(
      buildCampaignWorkspaceTabs({ canAccessGmEncounter: false }).map((tab) => tab.id)
    ).toEqual(["campaign", "scenario", "player-encounter"]);
  });

  it("sanitizes scenario and encounter selection against the current campaign flow", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: true,
      encounters: [
        {
          actionLog: [],
          campaignId: "camp-1",
          createdAt: "2026-04-23T00:00:00.000Z",
          currentRound: 1,
          currentTurnIndex: 0,
          declarationsLocked: false,
          id: "enc-1",
          participants: [],
          scenarioId: "scn-1",
          status: "setup",
          title: "Gate skirmish",
          turnOrderMode: "manual",
          updatedAt: "2026-04-23T00:00:00.000Z"
        }
      ],
      requestedEncounterId: "enc-1",
      requestedScenarioId: "missing-scenario",
      requestedTab: "gm-encounter",
      scenarios: [
        {
          campaignId: "camp-1",
          createdAt: "2026-04-23T00:00:00.000Z",
          description: "",
          gmUserId: "gm-1",
          id: "scn-1",
          kind: "mixed",
          name: "Session one",
          participantIds: [],
          status: "draft",
          updatedAt: "2026-04-23T00:00:00.000Z"
        }
      ]
    });

    expect(state.activeScenarioId).toBeUndefined();
    expect(state.activeEncounterId).toBeUndefined();
    expect(state.activeTab).toBe("gm-encounter");
  });

  it("redirects a player away from the hidden GM tab while preserving other context", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: false,
      encounters: [],
      requestedEncounterId: null,
      requestedScenarioId: "scn-1",
      requestedTab: "gm-encounter",
      scenarios: [
        {
          campaignId: "camp-1",
          createdAt: "2026-04-23T00:00:00.000Z",
          description: "",
          gmUserId: "gm-1",
          id: "scn-1",
          kind: "mixed",
          name: "Session one",
          participantIds: [],
          status: "draft",
          updatedAt: "2026-04-23T00:00:00.000Z"
        }
      ]
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeTab).toBe("player-encounter");
  });

  it("restores remembered scenario, encounter, and tab when the URL does not specify them", () => {
    const state = resolveCampaignWorkspaceState({
      activeCampaignId: "camp-1",
      canAccessGmEncounter: true,
      encounters: [
        {
          actionLog: [],
          campaignId: "camp-1",
          createdAt: "2026-04-23T00:00:00.000Z",
          currentRound: 1,
          currentTurnIndex: 0,
          declarationsLocked: false,
          id: "enc-1",
          participants: [],
          scenarioId: "scn-1",
          status: "setup",
          title: "Gate skirmish",
          turnOrderMode: "manual",
          updatedAt: "2026-04-23T00:00:00.000Z"
        }
      ],
      rememberedEncounterId: "enc-1",
      rememberedScenarioId: "scn-1",
      rememberedTab: "player-encounter",
      requestedEncounterId: null,
      requestedScenarioId: null,
      requestedTab: null,
      scenarios: [
        {
          campaignId: "camp-1",
          createdAt: "2026-04-23T00:00:00.000Z",
          description: "",
          gmUserId: "gm-1",
          id: "scn-1",
          kind: "mixed",
          name: "Session one",
          participantIds: [],
          status: "draft",
          updatedAt: "2026-04-23T00:00:00.000Z"
        }
      ]
    });

    expect(state.activeScenarioId).toBe("scn-1");
    expect(state.activeEncounterId).toBe("enc-1");
    expect(state.activeTab).toBe("player-encounter");
  });
});
