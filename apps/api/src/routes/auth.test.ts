import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";

const auth = vi.hoisted(() => ({
  createSessionForUser: vi.fn(),
  findUserByEmail: vi.fn(),
  registerLocalUser: vi.fn(),
  loginWithCredentials: vi.fn(),
}));

vi.mock("@glantri/database", () => ({
  AuthService: class {
    createSessionForUser = auth.createSessionForUser;
    findUserByEmail = auth.findUserByEmail;
    registerLocalUser = auth.registerLocalUser;
    loginWithCredentials = auth.loginWithCredentials;
  },
}));

import { authRoutes } from "./auth";

describe("credential login validation", () => {
  beforeEach(() => {
    auth.createSessionForUser.mockReset();
    auth.findUserByEmail.mockReset();
    auth.registerLocalUser.mockReset();
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

describe("credential registration validation (#1112)", () => {
  beforeEach(() => {
    auth.createSessionForUser.mockReset();
    auth.findUserByEmail.mockReset();
    auth.registerLocalUser.mockReset();
  });

  async function register(payload: unknown) {
    const app = Fastify({ logger: false });
    await app.register(authRoutes, { prefix: "/auth" });
    const response = await app.inject({
      method: "POST",
      payload: payload as object,
      url: "/auth/register",
    });
    await app.close();
    return response;
  }

  it("returns 400 with the password message for a 7-character password, without echoing it", async () => {
    const response = await register({ email: "new@example.invalid", password: "sevench" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Password must be at least 8 characters.",
      fields: { password: "Password must be at least 8 characters." },
    });
    expect(response.body).not.toContain("sevench");
    expect(auth.registerLocalUser).not.toHaveBeenCalled();
  });

  it("returns 400 with the email message for an invalid email", async () => {
    const response = await register({ email: "not-an-email", password: "longenough1" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Enter a valid email address.",
      fields: { email: "Enter a valid email address." },
    });
    expect(auth.registerLocalUser).not.toHaveBeenCalled();
  });

  it("reports both fields and tolerates a missing body", async () => {
    const both = await register({ email: "x", password: "y" });
    expect(both.statusCode).toBe(400);
    expect(both.json().error).toBe(
      "Enter a valid email address. Password must be at least 8 characters.",
    );

    const none = await register(undefined);
    expect(none.statusCode).toBe(400);
  });

  it("still returns 409 for a duplicate email", async () => {
    auth.findUserByEmail.mockResolvedValueOnce({ id: "u1" });
    const response = await register({ email: "dup@example.invalid", password: "longenough1" });

    expect(response.statusCode).toBe(409);
    expect(auth.registerLocalUser).not.toHaveBeenCalled();
  });

  it("still registers a valid account", async () => {
    auth.findUserByEmail.mockResolvedValueOnce(null);
    auth.registerLocalUser.mockResolvedValueOnce({
      email: "ok@example.invalid",
      id: "u2",
      roles: ["player"],
    });
    auth.createSessionForUser.mockResolvedValueOnce({
      session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
      token: "t",
    });
    const response = await register({ email: "ok@example.invalid", password: "longenough1" });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.id).toBe("u2");
  });
});
