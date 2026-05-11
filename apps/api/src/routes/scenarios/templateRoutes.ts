import type { FastifyPluginAsync } from "fastify";

import { CampaignService } from "@glantri/database";
import { reusableEntityKindSchema } from "@glantri/domain";

import { requireAdminUser } from "../../lib/sessionAuth";
import { parseBodyObject, parseId, parseOptionalString, parseRequiredString } from "./parsing";

const campaignService = new CampaignService();

export const templateRoutes: FastifyPluginAsync = async (app) => {
  app.get("/templates", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const entities = await campaignService.listReusableEntitiesByGameMaster(user.id);
      return { templates: entities };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list templates."
      });
    }
  });

  app.post("/templates", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const body = parseBodyObject(request.body, "Template payload");
      const snapshot =
        body.snapshot && typeof body.snapshot === "object"
          ? { ...(body.snapshot as Record<string, unknown>), actorClass: "template" }
          : { actorClass: "template" };

      const template = await campaignService.createReusableEntity({
        description: parseOptionalString(body, "description"),
        gmUserId: user.id,
        kind: reusableEntityKindSchema.parse(body.kind),
        name: parseRequiredString(body, "name"),
        notes: parseOptionalString(body, "notes"),
        snapshot
      });

      return { template };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create template."
      });
    }
  });

  app.put("/templates/:templateId", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const { templateId } = request.params as { templateId: string };
      const existing = await campaignService.getReusableEntityById(templateId);

      if (!existing) {
        return reply.code(404).send({
          error: "Template not found."
        });
      }

      if (existing.gmUserId !== user.id && !user.roles.includes("admin")) {
        return reply.code(403).send({
          error: "Template access restricted."
        });
      }

      const body = parseBodyObject(request.body, "Template payload");
      const snapshot =
        body.snapshot && typeof body.snapshot === "object"
          ? { ...(body.snapshot as Record<string, unknown>), actorClass: "template" }
          : { actorClass: "template" };

      const template = await campaignService.updateReusableEntity({
        description: parseOptionalString(body, "description"),
        entityId: templateId,
        kind: reusableEntityKindSchema.parse(body.kind),
        name: parseRequiredString(body, "name"),
        notes: parseOptionalString(body, "notes"),
        snapshot
      });

      return { template };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update template."
      });
    }
  });

  app.get("/entities/:entityId", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const entityId = parseId(request.params, "entityId", "Entity id");
      const entity = await campaignService.getReusableEntityById(entityId);

      if (!entity || entity.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Reusable entity not found."
        });
      }

      return { entity };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load reusable entity."
      });
    }
  });
};
