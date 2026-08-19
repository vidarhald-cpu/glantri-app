import { describe, expect, it, vi } from "vitest";

import { resolveScenarioWorkspaceAccess, runScenarioWorkspaceAccessRequest } from "./access";

function createServices() {
  return {
    campaignService: {
      getCampaignById: vi.fn().mockResolvedValue({ id: "campaign-1", gmUserId: "gm-1" }),
    },
    scenarioService: {
      getScenarioById: vi.fn().mockResolvedValue({
        campaignId: "campaign-1",
        id: "scenario-1",
      }),
      userHasPlayerScenarioAccess: vi.fn().mockResolvedValue(false),
    },
  };
}

describe("Scenario workspace lifecycle access", () => {
  it("does not treat platform-admin status as Campaign authority", async () => {
    const services = createServices();

    await expect(
      resolveScenarioWorkspaceAccess(services as never, {
        scenarioId: "scenario-1",
        userId: "admin-1",
        userRoles: ["admin"],
      }),
    ).resolves.toBeNull();
  });

  it("allows paused player reads but keeps player writes live-only", async () => {
    const services = createServices();
    services.scenarioService.userHasPlayerScenarioAccess.mockImplementation(
      async (input: { includePaused?: boolean }) => input.includePaused === true,
    );

    await resolveScenarioWorkspaceAccess(services as never, {
      accessIntent: "read",
      scenarioId: "scenario-1",
      userId: "player-1",
      userRoles: ["player"],
    });
    expect(services.scenarioService.userHasPlayerScenarioAccess).toHaveBeenLastCalledWith({
      includePaused: true,
      scenarioId: "scenario-1",
      userId: "player-1",
    });

    await resolveScenarioWorkspaceAccess(services as never, {
      accessIntent: "write",
      scenarioId: "scenario-1",
      userId: "player-1",
      userRoles: ["player"],
    });
    expect(services.scenarioService.userHasPlayerScenarioAccess).toHaveBeenLastCalledWith({
      scenarioId: "scenario-1",
      userId: "player-1",
    });
  });

  it("derives omitted access intent from the request method without admitting paused writes", async () => {
    const services = createServices();
    services.scenarioService.userHasPlayerScenarioAccess.mockImplementation(
      async (input: { includePaused?: boolean }) => input.includePaused === true,
    );

    await expect(
      runScenarioWorkspaceAccessRequest("GET", () =>
        resolveScenarioWorkspaceAccess(services as never, {
          scenarioId: "scenario-1",
          userId: "player-1",
          userRoles: ["player"],
        }),
      ),
    ).resolves.toMatchObject({ mode: "player" });

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      await expect(
        runScenarioWorkspaceAccessRequest(method, () =>
          resolveScenarioWorkspaceAccess(services as never, {
            scenarioId: "scenario-1",
            userId: "player-1",
            userRoles: ["player"],
          }),
        ),
      ).resolves.toBeNull();
    }
  });
});
