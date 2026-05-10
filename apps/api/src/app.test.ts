import { describe, expect, it, vi } from "vitest";

import { checkReadiness } from "./lib/readiness";
import { buildApiServer } from "./app";

vi.mock("./lib/readiness", () => ({
  checkReadiness: vi.fn()
}));

describe("api app health contract", () => {
  it("reports process liveness on /health", async () => {
    vi.stubEnv("LOG_LEVEL", "silent");
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      service: "@glantri/api",
      status: "ok",
    });
    vi.unstubAllEnvs();
  });

  it("reports application readiness on /ready when database checks pass", async () => {
    vi.mocked(checkReadiness).mockResolvedValueOnce({ status: "ready" });
    vi.stubEnv("LOG_LEVEL", "silent");
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/ready"
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      service: "@glantri/api",
      status: "ready"
    });
    vi.unstubAllEnvs();
  });

  it("reports application not ready on /ready when database checks fail", async () => {
    vi.mocked(checkReadiness).mockResolvedValueOnce({
      status: "not_ready",
      reason: "database_unavailable"
    });
    vi.stubEnv("LOG_LEVEL", "silent");
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/ready"
    });

    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      service: "@glantri/api",
      status: "not_ready",
      reason: "database_unavailable"
    });
    vi.unstubAllEnvs();
  });
});
