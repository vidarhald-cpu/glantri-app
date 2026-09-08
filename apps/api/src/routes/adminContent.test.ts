import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { FastifyInstance } from "fastify";

import { buildApiServer } from "../app";
import * as sessionAuth from "../lib/sessionAuth";
import { CanonicalContentService } from "../lib/adminContentService";

describe("admin content reference route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("denies unauthenticated callers before projection load", async () => {
    const app = buildApiServer() as FastifyInstance;
    await app.ready();
    const getSkillReference = vi.spyOn(CanonicalContentService.prototype, "getSkillReference");

    const response = await app.inject({
      method: "GET",
      url: "/api/admin/content/reference"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Authentication required." });
    expect(getSkillReference).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns canonical-only projection for authorized admins", async () => {
    const app = buildApiServer() as FastifyInstance;
    await app.ready();
    const getSkillReference = vi.spyOn(CanonicalContentService.prototype, "getSkillReference");

    const adminUser = {
      displayName: "Admin User",
      email: "admin@glantri.test",
      id: "admin-001",
      roles: ["admin"] as ("admin" | "player" | "game_master")[],
    };

    vi.spyOn(sessionAuth, "requireStrictAdminUser").mockResolvedValue(adminUser);

    const response = await app.inject({
      method: "GET",
      url: "/api/admin/content/reference"
    });

    expect(response.statusCode).toBe(200);
    expect(getSkillReference).toHaveBeenCalledTimes(1);
    expect(response.json()).toMatchObject({
      candidate: null,
      canonical: {
        title: expect.stringMatching(/pilot/i),
        status: "canonical"
      }
    });
    await app.close();
  });
});
