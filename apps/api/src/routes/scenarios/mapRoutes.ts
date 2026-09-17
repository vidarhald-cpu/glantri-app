import { Readable } from "node:stream";

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  ArtifactService,
  CampaignMapConflictError,
  CampaignMapNotFoundError,
  CampaignMapReferenceError,
  CampaignMapService,
} from "@glantri/database";

import { createArtifactStorageRuntime } from "../../artifacts/artifactStorageConfig";
import { getAuthenticatedUser, requireAdminUser } from "../../lib/sessionAuth";
import { routeId, sendError as sendArtifactError } from "../artifacts";

const ABSENCE = { error: "Map not found." } as const;

async function requirePrivateUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    await reply.code(404).send(ABSENCE);
    return null;
  }
  return user;
}

function requireMapMutationDefense(request: FastifyRequest, reply: FastifyReply): boolean {
  const expectedOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
  if (
    request.headers.origin !== expectedOrigin ||
    request.headers["x-glantri-map-mutation"] !== "1"
  ) {
    void reply.code(403).send({ error: "Map action not allowed." });
    return false;
  }
  return true;
}

function sendMapError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof CampaignMapNotFoundError) return reply.code(404).send(ABSENCE);
  if (error instanceof CampaignMapConflictError) {
    return reply.code(409).send({ code: "map_version_conflict", error: error.message });
  }
  if (error instanceof CampaignMapReferenceError) {
    return reply.code(400).send({ error: error.message });
  }
  if ((error as { name?: string }).name === "ZodError") {
    return reply.code(400).send({ error: "Check the Map details and try again." });
  }
  request.log.error({ category: "map_operation_failed" }, "Map operation failed");
  return reply.code(500).send({ error: "Unable to complete the Map action." });
}

export const mapRoutes: FastifyPluginAsync = async (app) => {
  const maps = new CampaignMapService();

  app.get("/campaigns/:campaignId/maps", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      return await maps.listForUser(routeId(request, "campaignId"), user.id);
    } catch (error) {
      return sendMapError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/maps/authoring-options", async (request, reply) => {
    const user = await requireAdminUser(request, reply);
    if (!user) return;
    try {
      return { options: await maps.authoringOptions(routeId(request, "campaignId"), user.id) };
    } catch (error) {
      return sendMapError(request, reply, error);
    }
  });

  app.post("/campaigns/:campaignId/maps", async (request, reply) => {
    if (!requireMapMutationDefense(request, reply)) return;
    const user = await requireAdminUser(request, reply);
    if (!user) return;
    try {
      return {
        map: await maps.create({
          actorUserId: user.id,
          campaignId: routeId(request, "campaignId"),
          payload: request.body,
        }),
        mode: "gm",
      };
    } catch (error) {
      return sendMapError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/maps/:mapId", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    try {
      return await maps.getForUser(
        routeId(request, "campaignId"),
        routeId(request, "mapId"),
        user.id,
      );
    } catch (error) {
      return sendMapError(request, reply, error);
    }
  });

  app.put("/campaigns/:campaignId/maps/:mapId", async (request, reply) => {
    if (!requireMapMutationDefense(request, reply)) return;
    const user = await requireAdminUser(request, reply);
    if (!user) return;
    try {
      return {
        map: await maps.replaceAggregate({
          actorUserId: user.id,
          campaignId: routeId(request, "campaignId"),
          mapId: routeId(request, "mapId"),
          payload: request.body,
        }),
        mode: "gm",
      };
    } catch (error) {
      return sendMapError(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/maps/:mapId/background", async (request, reply) => {
    const user = await requirePrivateUser(request, reply);
    if (!user) return;
    const artifactRuntime = createArtifactStorageRuntime();
    if (!artifactRuntime.enabled) return reply.code(404).send(ABSENCE);
    try {
      const artifacts = new ArtifactService(artifactRuntime.store);
      const campaignId = routeId(request, "campaignId");
      const artifactId = await maps.getBackgroundArtifactIdForUser({
        campaignId,
        mapId: routeId(request, "mapId"),
        userId: user.id,
      });
      const result = await artifacts.readContent({ artifactId, campaignId, userId: user.id });
      reply
        .header("cache-control", "private, no-store")
        .header("x-content-type-options", "nosniff")
        .header("content-security-policy", "sandbox; default-src 'none'")
        .header("content-type", result.mediaType)
        .header("content-length", String(result.body.byteSize))
        .header("content-disposition", "inline");
      return reply.send(Readable.from(result.body.content));
    } catch (error) {
      if (error instanceof CampaignMapNotFoundError) return reply.code(404).send(ABSENCE);
      return sendArtifactError(request, reply, error);
    }
  });
};
