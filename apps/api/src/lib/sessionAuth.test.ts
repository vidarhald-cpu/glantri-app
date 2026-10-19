import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

import { applyLocalCors, resolveSessionCookieSecurityPosture } from "./sessionAuth";

describe("session auth HTTP contract", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("allows credentialed CORS preflight for PATCH from the configured web origin", async () => {
    vi.stubEnv("WEB_ORIGIN", "https://web.example.test");
    const app = Fastify();
    applyLocalCors(app);

    const response = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        "access-control-request-headers": "content-type,x-glantri-combat-response",
        "access-control-request-method": "PATCH",
        origin: "https://web.example.test",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("https://web.example.test");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    expect(response.headers["access-control-allow-headers"]).toBe(
      "content-type,x-glantri-artifact-mutation,x-glantri-blackboard-mutation,x-glantri-map-mutation,x-glantri-combat-command,x-glantri-combat-correlation-id,x-glantri-combat-response",
    );
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

  it("uses secure cross-site session cookies for an https production web origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEB_ORIGIN", "https://web.example.test");
    vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));
    const { buildSessionCookie } = await import("./sessionAuth");

    expect(buildSessionCookie("token value", "2026-05-09T13:00:00.000Z")).toBe(
      "glantri_session=token%20value; HttpOnly; Path=/; SameSite=None; Max-Age=3600; Secure",
    );
  });

  it("omits Secure and uses SameSite=Lax for an http production web origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEB_ORIGIN", "http://localhost:3000");
    vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));
    const { buildSessionCookie } = await import("./sessionAuth");

    expect(buildSessionCookie("token value", "2026-05-09T13:00:00.000Z")).toBe(
      "glantri_session=token%20value; HttpOnly; Path=/; SameSite=Lax; Max-Age=3600",
    );
  });

  it("keeps the secure posture in production when WEB_ORIGIN is absent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEB_ORIGIN", undefined);
    vi.setSystemTime(new Date("2026-05-09T12:00:00.000Z"));
    const { buildSessionCookie } = await import("./sessionAuth");

    expect(buildSessionCookie("token value", "2026-05-09T13:00:00.000Z")).toBe(
      "glantri_session=token%20value; HttpOnly; Path=/; SameSite=None; Max-Age=3600; Secure",
    );
  });

  it("expires the session cookie with the same posture as it was issued", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEB_ORIGIN", "http://localhost:3000");
    const httpModule = await import("./sessionAuth");

    expect(httpModule.buildExpiredSessionCookie()).toBe(
      "glantri_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
    );

    vi.resetModules();
    vi.stubEnv("WEB_ORIGIN", "https://web.example.test");
    const httpsModule = await import("./sessionAuth");

    expect(httpsModule.buildExpiredSessionCookie()).toBe(
      "glantri_session=; HttpOnly; Path=/; SameSite=None; Max-Age=0; Secure",
    );
  });
});

describe("session cookie security posture resolution", () => {
  it("relaxes the posture only for an explicit http production origin", () => {
    expect(resolveSessionCookieSecurityPosture("production", "http://localhost:3000")).toEqual({
      sameSite: "Lax",
      secure: false,
    });
    expect(resolveSessionCookieSecurityPosture("production", "http://web.internal:8080")).toEqual({
      sameSite: "Lax",
      secure: false,
    });
  });

  it("keeps the secure posture for https production origins", () => {
    expect(
      resolveSessionCookieSecurityPosture("production", "https://glantri.example.com"),
    ).toEqual({ sameSite: "None", secure: true });
  });

  it("falls back to the secure posture when the signal is absent, empty, malformed or unrecognised", () => {
    for (const webOrigin of [
      undefined,
      "",
      "   ",
      "not a url",
      "//web.example.test",
      "web.example.test:3000",
      "ws://web.example.test",
    ]) {
      expect(resolveSessionCookieSecurityPosture("production", webOrigin)).toEqual({
        sameSite: "None",
        secure: true,
      });
    }
  });

  it("leaves non-production behaviour unchanged regardless of the configured origin", () => {
    for (const webOrigin of [undefined, "http://localhost:3000", "https://web.example.test"]) {
      expect(resolveSessionCookieSecurityPosture("development", webOrigin)).toEqual({
        sameSite: "Lax",
        secure: false,
      });
      expect(resolveSessionCookieSecurityPosture("test", webOrigin)).toEqual({
        sameSite: "Lax",
        secure: false,
      });
      expect(resolveSessionCookieSecurityPosture(undefined, webOrigin)).toEqual({
        sameSite: "Lax",
        secure: false,
      });
    }
  });
});
