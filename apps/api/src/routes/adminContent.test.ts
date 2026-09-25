import { afterEach, describe, expect, it, vi } from "vitest";

import type { FastifyInstance } from "fastify";
import { defaultCanonicalContent } from "@glantri/content";

import { buildApiServer } from "../app";
import * as sessionAuth from "../lib/sessionAuth";
import { CanonicalContentService } from "../lib/adminContentService";

describe("admin content reference route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the unauthenticated /content/ body on canonical seed content", async () => {
    const getCanonicalContent = vi
      .spyOn(CanonicalContentService.prototype, "getCanonicalContent")
      .mockResolvedValue({ content: defaultCanonicalContent, revision: 0, source: "seed" });
    const getSkillReference = vi.spyOn(CanonicalContentService.prototype, "getSkillReference");
    const app = buildApiServer() as FastifyInstance;
    try {
      const response = await app.inject({ method: "GET", url: "/content/" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        content: defaultCanonicalContent,
        revision: 0,
        source: "seed",
        status: "ready",
        version: "r0",
      });
      expect(getCanonicalContent).toHaveBeenCalledOnce();
      expect(getSkillReference).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("keeps GET Admin content authenticated and PUT Admin content strictly gated", async () => {
    const getCanonicalContent = vi.spyOn(CanonicalContentService.prototype, "getCanonicalContent");
    const saveCanonicalContent = vi.spyOn(
      CanonicalContentService.prototype,
      "saveCanonicalContent",
    );
    const app = buildApiServer() as FastifyInstance;
    try {
      const read = await app.inject({ method: "GET", url: "/api/admin/content" });
      const write = await app.inject({
        method: "PUT",
        url: "/api/admin/content",
        payload: { expectedRevision: 0, content: {} },
      });
      expect(read.statusCode).toBe(401);
      expect(write.statusCode).toBe(401);
      expect(getCanonicalContent).not.toHaveBeenCalled();
      expect(saveCanonicalContent).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("denies unauthenticated callers before projection load", async () => {
    const app = buildApiServer() as FastifyInstance;
    await app.ready();
    const getSkillReference = vi.spyOn(CanonicalContentService.prototype, "getSkillReference");

    const response = await app.inject({
      method: "GET",
      url: "/api/admin/content/reference",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Authentication required." });
    expect(getSkillReference).not.toHaveBeenCalled();
    await app.close();
  });

  it("denies an authenticated non-admin before projection load", async () => {
    const app = buildApiServer() as FastifyInstance;
    await app.ready();
    const getSkillReference = vi.spyOn(CanonicalContentService.prototype, "getSkillReference");

    vi.spyOn(sessionAuth, "requireStrictAdminUser").mockImplementation(async (_request, reply) => {
      await reply.code(403).send({ error: "Admin role required." });
      return null;
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/admin/content/reference",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Admin role required." });
    expect(getSkillReference).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns the canonical V2 reference to authorized admins", async () => {
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
      url: "/api/admin/content/reference",
    });

    expect(response.statusCode).toBe(200);
    expect(getSkillReference).toHaveBeenCalledTimes(1);
    expect(response.json()).toMatchObject({
      sourceDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/),
      relationships: {
        grants: expect.arrayContaining([
          { sourceId: "skill:medicine", targetId: "skill:first-aid", factor: 1 },
        ]),
      },
    });
    expect(response.json().groups).toHaveLength(95);
    expect(response.json().paths).toHaveLength(86);
    expect(response.json()).not.toHaveProperty("candidate");
    await app.close();
  });
});
