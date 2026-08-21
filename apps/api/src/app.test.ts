import { describe, expect, it, vi } from "vitest";

import { checkReadiness } from "./lib/readiness";
import { buildApiServer } from "./app";

vi.mock("./lib/readiness", () => ({
  checkReadiness: vi.fn(),
}));

describe("api app health contract", () => {
  it("permits the active combat response header on the exact CE mutation preflight", async () => {
    vi.stubEnv("LOG_LEVEL", "silent");
    vi.stubEnv("WEB_ORIGIN", "http://localhost:3000");
    const app = buildApiServer();

    const response = await app.inject({
      headers: {
        "access-control-request-headers": "content-type,x-glantri-combat-response",
        "access-control-request-method": "POST",
        origin: "http://localhost:3000",
      },
      method: "OPTIONS",
      url: "/encounters/encounter-1/combat-round/combat-experience-difficulty",
    });

    await app.close();

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
    expect(response.headers["access-control-allow-headers"]).toBe(
      "content-type,x-glantri-combat-command,x-glantri-combat-correlation-id,x-glantri-combat-response",
    );
    expect(response.headers.vary).toBe("origin");
    vi.unstubAllEnvs();
  });

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
      url: "/ready",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      service: "@glantri/api",
      status: "ready",
    });
    vi.unstubAllEnvs();
  });

  it("reports application not ready on /ready when database checks fail", async () => {
    vi.mocked(checkReadiness).mockResolvedValueOnce({
      status: "not_ready",
      reason: "database_unavailable",
    });
    vi.stubEnv("LOG_LEVEL", "silent");
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/ready",
    });

    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      service: "@glantri/api",
      status: "not_ready",
      reason: "database_unavailable",
    });
    vi.unstubAllEnvs();
  });

  it("does not expose migration diagnostics through /ready", async () => {
    vi.mocked(checkReadiness).mockResolvedValueOnce({
      status: "not_ready",
      reason: "database_incompatible",
    });
    vi.stubEnv("LOG_LEVEL", "silent");
    const app = buildApiServer();

    const response = await app.inject({
      method: "GET",
      url: "/ready",
    });

    await app.close();

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      service: "@glantri/api",
      status: "not_ready",
      reason: "database_incompatible",
    });
    expect(response.body).not.toMatch(/migration_name|checksum|postgresql:\/\//i);
    vi.unstubAllEnvs();
  });
});
