import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadCampaignById: vi.fn(),
  loadEncounterById: vi.fn(),
  loadScenarioById: vi.fn(),
  loadScenarioMyParticipant: vi.fn(),
  loadScenarioParticipants: vi.fn(),
  submitPlayerRoleplayRollOnServer: vi.fn(),
  user: { id: "player-1", roles: ["player"] },
}));

vi.mock("@/lib/api/localServiceClient", () => mocks);
vi.mock("@/lib/auth/SessionUserContext", () => ({
  useSessionUser: () => ({ currentUser: mocks.user }),
}));
vi.mock("@/lib/content/loadCanonicalContent", () => ({
  loadCanonicalContent: vi.fn().mockResolvedValue({ skills: [] }),
}));

import { PlayerRoleplayingEncounterScreen } from "./RoleplayEncounterScreens";

describe("PlayerRoleplayingEncounterScreen polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    for (const fn of [
      mocks.loadCampaignById,
      mocks.loadEncounterById,
      mocks.loadScenarioById,
      mocks.loadScenarioMyParticipant,
    ]) {
      fn.mockReset();
    }
    mocks.loadScenarioById.mockResolvedValue({ id: "scenario-1", status: "live" });
    mocks.loadCampaignById.mockResolvedValue(null);
    mocks.loadScenarioMyParticipant.mockResolvedValue(null);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("starts no second request while the mount request is still pending", async () => {
    let release: (value: unknown) => void = () => undefined;
    mocks.loadEncounterById.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    render(
      <PlayerRoleplayingEncounterScreen
        campaignId="campaign-1"
        encounterId="encounter-1"
        scenarioId="scenario-1"
        surface="skill-rolls"
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mocks.loadEncounterById).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(mocks.loadEncounterById).toHaveBeenCalledTimes(1);

    mocks.loadEncounterById.mockResolvedValue({ id: "encounter-1", participants: [] });
    await act(async () => {
      release({ id: "encounter-1", participants: [] });
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(mocks.loadEncounterById).toHaveBeenCalledTimes(2);
  });
});
