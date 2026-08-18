import { describe, expect, it, vi } from "vitest";

import type { Campaign, Scenario, ScenarioParticipant } from "@glantri/domain";

import { loadCampaignWorkspaceInitialData } from "./campaignWorkspaceLoading";

const campaign = {
  id: "campaign-1",
  name: "Border Trouble",
} as Campaign;
const scenarios = [
  { id: "scenario-1", name: "Bridge" },
  { id: "scenario-2", name: "Courtyard" },
] as Scenario[];

describe("campaign workspace initial loading", () => {
  it("loads access once and each scenario summary/participant context once", async () => {
    const loadAccess = vi.fn().mockResolvedValue({
      accessMode: "gm",
      campaign,
      scenarios,
    });
    const loadEncounterSummaries = vi.fn(async (scenarioId: string) => [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        id: `encounter-${scenarioId}`,
        scenarioId,
        status: "active" as const,
        title: scenarioId,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const loadParticipants = vi.fn(async (scenarioId: string) => [
      { id: `participant-${scenarioId}`, scenarioId } as ScenarioParticipant,
    ]);
    const loadMyParticipant = vi.fn();

    const result = await loadCampaignWorkspaceInitialData({
      loadAccess,
      loadEncounterSummaries,
      loadMyParticipant,
      loadParticipants,
    });

    expect(loadAccess).toHaveBeenCalledTimes(1);
    expect(loadEncounterSummaries).toHaveBeenCalledTimes(2);
    expect(loadEncounterSummaries.mock.calls).toEqual([
      ["scenario-1"],
      ["scenario-2"],
    ]);
    expect(loadParticipants).toHaveBeenCalledTimes(2);
    expect(loadMyParticipant).not.toHaveBeenCalled();
    expect(result.encounterSummaries).toHaveLength(2);
    expect(result.participants).toHaveLength(2);
  });

  it("uses only the current player's participant shell in player mode", async () => {
    const playerParticipant = {
      id: "participant-1",
      scenarioId: "scenario-1",
    } as ScenarioParticipant;
    const loadParticipants = vi.fn();
    const loadMyParticipant = vi.fn().mockResolvedValue(playerParticipant);

    const result = await loadCampaignWorkspaceInitialData({
      loadAccess: vi.fn().mockResolvedValue({
        accessMode: "player",
        campaign,
        scenarios: [scenarios[0]!],
      }),
      loadEncounterSummaries: vi.fn().mockResolvedValue([]),
      loadMyParticipant,
      loadParticipants,
    });

    expect(loadMyParticipant).toHaveBeenCalledTimes(1);
    expect(loadParticipants).not.toHaveBeenCalled();
    expect(result.participants).toEqual([playerParticipant]);
  });
});
