import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { applyLocalCors } from "./sessionAuth";

describe("session auth HTTP contract", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows credentialed CORS preflight for DELETE from the configured web origin", async () => {
    vi.stubEnv("WEB_ORIGIN", "https://web.example.test");
    const app = Fastify();
    applyLocalCors(app);

    const response = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        "access-control-request-method": "DELETE",
        origin: "https://web.example.test",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://web.example.test");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toBe("GET,POST,PUT,DELETE,OPTIONS");
    expect(response.headers["access-control-allow-headers"]).toBe("content-type");
    expect(response.headers.vary).toBe("origin");
  });

  it("does not emit credentialed CORS headers for an unconfigured origin", async () => {
    vi.stubEnv("WEB_ORIGIN", "https://web.example.test");
    const app = Fastify();
    applyLocalCors(app);

    const response = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        "access-control-request-method": "DELETE",
        origin: "https://other.example.test",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("uses lax session cookies outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));
    const { buildSessionCookie } = await import("./sessionAuth");

    expect(buildSessionCookie("token value", "2026-05-09T13:00:00.000Z")).toBe(
      "glantri_session=token%20value; HttpOnly; Path=/; SameSite=Lax; Max-Age=3600",
    );
  });

  it("uses secure cross-site session cookies in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));
    const { buildSessionCookie } = await import("./sessionAuth");

    expect(buildSessionCookie("token value", "2026-05-09T13:00:00.000Z")).toBe(
      "glantri_session=token%20value; HttpOnly; Path=/; SameSite=None; Max-Age=3600; Secure",
    );
  });
});
