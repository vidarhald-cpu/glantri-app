import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const playerUser = {
    email: "player@example.test",
    id: "player-1",
    roles: ["player"],
  };
  const adminUser = {
    email: "admin@example.test",
    id: "admin-1",
    roles: ["admin"],
  };
  const stubRuleSet = {
    id: "ruleset-1",
    name: "Default",
    isActive: true,
    parameters: {},
  };
  const stubStore = {
    activeRuleSet: stubRuleSet,
    ruleSets: [stubRuleSet],
  };
  const chargenRuleSetService = {
    activateRuleSet: vi.fn(),
    createRuleSet: vi.fn(),
    getStore: vi.fn(),
  };
  return {
    adminUser,
    chargenRuleSetService,
    playerUser,
    requireAdminUser: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
    stubRuleSet,
    stubStore,
  };
});

vi.mock("@glantri/database", () => ({
  ChargenRuleSetService: vi.fn(() => mocks.chargenRuleSetService),
}));

vi.mock("@glantri/domain", () => ({
  chargenRuleSetParametersSchema: { parse: (v: unknown) => v },
}));

vi.mock("../lib/sessionAuth", () => ({
  requireAdminUser: mocks.requireAdminUser,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

import { chargenRoutes } from "./chargen";

async function buildChargenTestApp() {
  const app = Fastify({ logger: false });
  await app.register(chargenRoutes, { prefix: "/chargen" });
  return app;
}

describe("chargen route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    mocks.requireAdminUser.mockResolvedValue(mocks.adminUser);
    mocks.chargenRuleSetService.getStore.mockResolvedValue(mocks.stubStore);
  });

  it("returns the rule set store for authenticated users", async () => {
    const app = await buildChargenTestApp();
    const response = await app.inject({ method: "GET", url: "/chargen/rule-sets" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(mocks.stubStore);
  });

  it("returns 401 shape when not authenticated on rule-sets", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(null);

    const app = await buildChargenTestApp();
    const response = await app.inject({ method: "GET", url: "/chargen/rule-sets" });

    expect(response.statusCode).toBe(200);
    expect(mocks.chargenRuleSetService.getStore).not.toHaveBeenCalled();
  });

  it("returns only the active rule set on the active endpoint", async () => {
    const app = await buildChargenTestApp();
    const response = await app.inject({ method: "GET", url: "/chargen/rule-sets/active" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ activeRuleSet: mocks.stubRuleSet });
  });

  it("creates a rule set and returns the updated store", async () => {
    mocks.chargenRuleSetService.createRuleSet.mockResolvedValue(mocks.stubStore);

    const app = await buildChargenTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/chargen/rule-sets",
      payload: { name: "New Set", parameters: {} },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(mocks.stubStore);
    expect(mocks.chargenRuleSetService.createRuleSet).toHaveBeenCalledWith({
      name: "New Set",
      parameters: {},
    });
  });

  it("returns 401 shape when non-admin tries to create a rule set", async () => {
    mocks.requireAdminUser.mockResolvedValue(null);

    const app = await buildChargenTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/chargen/rule-sets",
      payload: { name: "New Set", parameters: {} },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.chargenRuleSetService.createRuleSet).not.toHaveBeenCalled();
  });

  it("activates a rule set and returns the updated store", async () => {
    mocks.chargenRuleSetService.activateRuleSet.mockResolvedValue(mocks.stubStore);

    const app = await buildChargenTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/chargen/rule-sets/ruleset-1/activate",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(mocks.stubStore);
    expect(mocks.chargenRuleSetService.activateRuleSet).toHaveBeenCalledWith("ruleset-1");
  });

  it("returns 404 when activating a non-existent rule set", async () => {
    mocks.chargenRuleSetService.activateRuleSet.mockRejectedValue(
      new Error("Chargen rule set not found.")
    );

    const app = await buildChargenTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/chargen/rule-sets/missing/activate",
      payload: {},
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Chargen rule set not found." });
  });
});
