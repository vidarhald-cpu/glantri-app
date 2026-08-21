import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignService: {
    getCampaignById: vi.fn(),
  },
  encounterService: {},
  gmUser: {
    email: "gm@example.test",
    id: "gm-1",
    roles: ["game_master"],
  },
  requireAdminUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  scenarioService: {
    getScenarioById: vi.fn(),
    getScenarioStartPreflight: vi.fn(),
    listScenarioLifecycleTransitions: vi.fn(),
    transitionScenarioLifecycle: vi.fn(),
    updateScenario: vi.fn(),
    userHasPlayerScenarioAccess: vi.fn(),
  },
}));

vi.mock("@glantri/database", () => {
  class ScenarioLifecycleConflictError extends Error {
    constructor(
      readonly code: string,
      message: string,
      readonly preflight?: unknown,
    ) {
      super(message);
      this.name = "ScenarioLifecycleConflictError";
    }
  }

  return {
    CampaignService: vi.fn(() => mocks.campaignService),
    EncounterService: vi.fn(() => mocks.encounterService),
    ScenarioLifecycleConflictError,
    ScenarioService: vi.fn(() => mocks.scenarioService),
  };
});

vi.mock("../../lib/sessionAuth", () => ({
  requireAdminUser: mocks.requireAdminUser,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

import { ScenarioLifecycleConflictError } from "@glantri/database";

import { scenarioRoutes } from "./scenarioRoutes";

const scenario = {
  campaignId: "campaign-1",
  createdAt: "2026-08-19T12:00:00.000Z",
  description: "An episode",
  id: "scenario-1",
  kind: "mixed" as const,
  lifecycleCycle: 0,
  lifecycleRevision: 0,
  name: "The Crossing",
  status: "draft" as const,
  updatedAt: "2026-08-19T12:00:00.000Z",
};

async function buildApp() {
  const app = Fastify();
  await app.register(scenarioRoutes);
  return app;
}

describe("Scenario lifecycle routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminUser.mockResolvedValue(mocks.gmUser);
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.gmUser);
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: mocks.gmUser.id,
      id: scenario.campaignId,
    });
  });

  it("rejects direct status mutation", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "PUT",
      payload: { status: "live" },
      url: `/scenarios/${scenario.id}`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Use a Scenario lifecycle action to change status.",
    });
    expect(mocks.scenarioService.updateScenario).not.toHaveBeenCalled();
    await app.close();
  });

  it("passes the revision, reason, warning acceptance, and actor to the canonical service", async () => {
    const transition = {
      action: "start",
      actorUserId: mocks.gmUser.id,
      cycle: 1,
      expectedRevision: 0,
      fromStatus: "draft",
      id: "transition-1",
      reason: "Begin play",
      resultingRevision: 1,
      scenarioId: scenario.id,
      toStatus: "live",
      transitionedAt: "2026-08-19T12:05:00.000Z",
    };
    mocks.scenarioService.transitionScenarioLifecycle.mockResolvedValue({
      scenario: { ...scenario, lifecycleCycle: 1, lifecycleRevision: 1, status: "live" },
      transition,
    });
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        acceptedWarningCodes: ["no_active_player_participants"],
        expectedRevision: 0,
        reason: "Begin play",
      },
      url: `/scenarios/${scenario.id}/lifecycle/start`,
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.scenarioService.transitionScenarioLifecycle).toHaveBeenCalledWith({
      acceptedWarningCodes: ["no_active_player_participants"],
      action: "start",
      actorUserId: mocks.gmUser.id,
      expectedRevision: 0,
      reason: "Begin play",
      scenarioId: scenario.id,
    });
    expect(response.json().transition).toMatchObject(transition);
    await app.close();
  });

  it("returns stable conflict details for a stale revision", async () => {
    mocks.scenarioService.transitionScenarioLifecycle.mockRejectedValue(
      new ScenarioLifecycleConflictError(
        "stale_revision",
        "The Scenario changed. Refresh it before trying this action again.",
      ),
    );
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      payload: { expectedRevision: 0, reason: "Pause" },
      url: `/scenarios/${scenario.id}/lifecycle/pause`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "stale_revision",
      error: "The Scenario changed. Refresh it before trying this action again.",
    });
    await app.close();
  });

  it("makes unauthorized and nonexistent transition probes privacy-equivalent", async () => {
    const app = await buildApp();
    mocks.campaignService.getCampaignById.mockResolvedValueOnce({
      gmUserId: "another-gm",
      id: scenario.campaignId,
    });
    const unauthorized = await app.inject({
      method: "POST",
      payload: { expectedRevision: 0, reason: "Probe" },
      url: `/scenarios/${scenario.id}/lifecycle/start`,
    });
    mocks.scenarioService.getScenarioById.mockResolvedValueOnce(null);
    const nonexistent = await app.inject({
      method: "POST",
      payload: { expectedRevision: 0, reason: "Probe" },
      url: "/scenarios/missing/lifecycle/start",
    });

    expect(unauthorized.statusCode).toBe(404);
    expect(nonexistent.statusCode).toBe(404);
    expect(unauthorized.json()).toEqual(nonexistent.json());
    expect(mocks.scenarioService.transitionScenarioLifecycle).not.toHaveBeenCalled();
    await app.close();
  });
});
