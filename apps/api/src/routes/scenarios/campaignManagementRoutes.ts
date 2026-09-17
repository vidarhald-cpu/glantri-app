import type { FastifyPluginAsync, FastifyReply } from "fastify";

import {
  CampaignManagementService,
  CampaignNoteNotFoundError,
  CampaignNoteReferenceError,
  CampaignService,
} from "@glantri/database";
import {
  campaignNoteReferenceSchema,
  campaignNoteStatusSchema,
  type CampaignNoteReference,
} from "@glantri/domain";

import { requireAdminUser } from "../../lib/sessionAuth";
import { parseBodyObject, parseId, parseRequiredString } from "./parsing";

const campaignService = new CampaignService();
const campaignManagementService = new CampaignManagementService();

function parseOptionalReference(value: unknown): CampaignNoteReference | undefined {
  return value == null ? undefined : campaignNoteReferenceSchema.parse(value);
}

function sendNoteError(reply: FastifyReply, error: unknown) {
  if (error instanceof CampaignNoteNotFoundError) {
    return reply.code(404).send({ error: "Campaign note not found." });
  }
  if (error instanceof CampaignNoteReferenceError) {
    return reply.code(400).send({ error: error.message });
  }
  return reply.code(400).send({
    error: error instanceof Error ? error.message : "Unable to update Campaign note.",
  });
}

export const campaignManagementRoutes: FastifyPluginAsync = async (app) => {
  async function requireCampaignOwner(
    request: Parameters<typeof requireAdminUser>[0],
    reply: FastifyReply,
  ) {
    const user = await requireAdminUser(request, reply);
    if (!user) return null;
    const campaignId = parseId(request.params, "campaignId", "Campaign id");
    const campaign = await campaignService.getCampaignById(campaignId);
    if (!campaign || campaign.gmUserId !== user.id) {
      await reply.code(404).send({ error: "Campaign not found." });
      return null;
    }
    return { campaignId, user };
  }

  app.get("/campaigns/:campaignId/workspace-overview", async (request, reply) => {
    try {
      const access = await requireCampaignOwner(request, reply);
      if (!access) return;
      const overview = await campaignManagementService.getOverview(access.campaignId);
      if (!overview) return reply.code(404).send({ error: "Campaign not found." });
      return { overview };
    } catch (error) {
      request.log.error({ err: error }, "Campaign workspace overview load failed");
      return reply.code(500).send({ error: "Unable to load Campaign workspace." });
    }
  });

  app.post("/campaigns/:campaignId/notes", async (request, reply) => {
    try {
      const access = await requireCampaignOwner(request, reply);
      if (!access) return;
      const body = parseBodyObject(request.body, "Campaign note payload");
      const note = await campaignManagementService.createNote({
        actorUserId: access.user.id,
        campaignId: access.campaignId,
        content: parseRequiredString(body, "content"),
        reference: parseOptionalReference(body.reference),
      });
      return { note };
    } catch (error) {
      return sendNoteError(reply, error);
    }
  });

  app.put("/campaigns/:campaignId/notes/:noteId", async (request, reply) => {
    try {
      const access = await requireCampaignOwner(request, reply);
      if (!access) return;
      const noteId = parseId(request.params, "noteId", "Campaign note id");
      const body = parseBodyObject(request.body, "Campaign note payload");
      const note = await campaignManagementService.updateNote({
        actorUserId: access.user.id,
        campaignId: access.campaignId,
        content: parseRequiredString(body, "content"),
        noteId,
        reference: body.reference == null ? null : parseOptionalReference(body.reference),
      });
      return { note };
    } catch (error) {
      return sendNoteError(reply, error);
    }
  });

  app.post("/campaigns/:campaignId/notes/:noteId/status", async (request, reply) => {
    try {
      const access = await requireCampaignOwner(request, reply);
      if (!access) return;
      const noteId = parseId(request.params, "noteId", "Campaign note id");
      const body = parseBodyObject(request.body, "Campaign note status payload");
      const note = await campaignManagementService.setNoteStatus({
        actorUserId: access.user.id,
        campaignId: access.campaignId,
        noteId,
        status: campaignNoteStatusSchema.parse(body.status),
      });
      return { note };
    } catch (error) {
      return sendNoteError(reply, error);
    }
  });
};
