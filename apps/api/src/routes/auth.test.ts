import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

const auth = vi.hoisted(() => ({
  createSessionForUser: vi.fn(),
  loginWithCredentials: vi.fn(),
}));

vi.mock("@glantri/database", () => ({
  AuthService: class {
    createSessionForUser = auth.createSessionForUser;
    loginWithCredentials = auth.loginWithCredentials;
  },
}));

import { authRoutes } from "./auth";

describe("credential login validation", () => {
  beforeEach(() => {
    auth.createSessionForUser.mockReset();
    auth.loginWithCredentials.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function buildApp() {
    const app = Fastify({ logger: false });
    await app.register(authRoutes, { prefix: "/auth" });
    return app;
  }

  it("returns a client response for malformed credentials without querying accounts", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        email: "recovery-admin",
        password: "not-an-account-password",
      },
      url: "/auth/login",
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Enter a valid email address and password.",
    });
    expect(auth.loginWithCredentials).not.toHaveBeenCalled();
    expect(auth.createSessionForUser).not.toHaveBeenCalled();
  });

  it("keeps valid but incorrect credentials account-neutral", async () => {
    auth.loginWithCredentials.mockResolvedValueOnce(null);
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        email: "unknown@example.invalid",
        password: "incorrect-password",
      },
      url: "/auth/login",
    });
    await app.close();

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Invalid email or password.",
    });
    expect(auth.loginWithCredentials).toHaveBeenCalledWith({
      email: "unknown@example.invalid",
      password: "incorrect-password",
    });
    expect(auth.createSessionForUser).not.toHaveBeenCalled();
  });

  it("preserves the credential session cookie contract for a successful login", async () => {
    vi.stubEnv("NODE_ENV", "development");
    auth.loginWithCredentials.mockResolvedValueOnce({
      email: "local-playtest-gm@example.invalid",
      id: "playtest-user",
      roles: ["player", "game_master", "admin"],
    });
    auth.createSessionForUser.mockResolvedValueOnce({
      session: {
        expiresAt: "2099-09-17T12:00:00.000Z",
      },
      token: "private-session-token",
    });
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        email: "local-playtest-gm@example.invalid",
        password: "valid-password",
      },
      url: "/auth/login",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        email: "local-playtest-gm@example.invalid",
        id: "playtest-user",
        roles: ["player", "game_master", "admin"],
      },
    });
    expect(response.headers["set-cookie"]).toContain(
      "glantri_session=private-session-token; HttpOnly; Path=/; SameSite=Lax",
    );
    expect(response.body).not.toContain("private-session-token");
  });
});
