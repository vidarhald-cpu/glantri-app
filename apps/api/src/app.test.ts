import { describe, expect, it, vi } from "vitest";

import { buildApiServer } from "./app";

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
});
