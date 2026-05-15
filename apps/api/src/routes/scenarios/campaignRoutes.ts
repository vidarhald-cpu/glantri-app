import type { FastifyPluginAsync } from "fastify";

import { CampaignService, ScenarioService } from "@glantri/database";
import {
  campaignAssetTypeSchema,
  campaignRosterCategorySchema,
  campaignRosterSourceTypeSchema,
  campaignSettingsSchema,
  campaignStatusSchema,
  reusableEntityKindSchema,
  scenarioKindSchema,
  scenarioStatusSchema,
  scenarioVisibilitySchema
} from "@glantri/domain";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import {
  parseBodyObject,
  parseId,
  parseOptionalNullableString,
  parseOptionalString,
  parseRequiredString
} from "./parsing";

const campaignService = new CampaignService();
const scenarioService = new ScenarioService();

interface RouteError extends Error {
  code?: string;
  details?: unknown;
}

function createRosterRouteError(message: string, code: string, details?: unknown): RouteError {
  const error = new Error(message) as RouteError;
  error.code = code;
  error.details = details;
  return error;
}

function parseCampaignRosterSourceType(value: unknown) {
  const parsed = campaignRosterSourceTypeSchema.safeParse(value);

  if (!parsed.success) {
    throw createRosterRouteError(
      "Invalid roster source type. Expected character, reusableEntity, or template.",
      "INVALID_ROSTER_SOURCE_TYPE",
      parsed.error.issues
    );
  }

  return parsed.data;
}

function buildRosterRouteErrorPayload(error: unknown) {
  if (error instanceof Error && error.message === "Campaign not found.") {
    return {
      payload: {
        code: "CAMPAIGN_NOT_FOUND",
        error: "Campaign not found."
      },
      status: 404
    };
  }

  if (error instanceof Error) {
    const routeError = error as RouteError;

    return {
      payload: {
        code: routeError.code ?? "CAMPAIGN_ROSTER_REMOVE_FAILED",
        details: routeError.details,
        error: routeError.message
      },
      status: 400
    };
  }

  return {
    payload: {
      code: "CAMPAIGN_ROSTER_REMOVE_FAILED",
      error: "Unable to remove campaign roster membership."
    },
    status: 400
  };
}

async function removeCampaignRosterMembershipBySource(input: {
  campaignId: string;
  sourceId: string;
  sourceType: unknown;
  userId: string;
}): Promise<{ removed: boolean }> {
  const sourceType = parseCampaignRosterSourceType(input.sourceType);
  const campaign = await campaignService.getCampaignById(input.campaignId);

  if (!campaign || campaign.gmUserId !== input.userId) {
    throw new Error("Campaign not found.");
  }

  return campaignService.removeCampaignRosterEntryBySource({
    campaignId: input.campaignId,
    sourceId: input.sourceId,
    sourceType
  });
}

export const campaignRoutes: FastifyPluginAsync = async (app) => {
  app.get("/campaigns", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    const campaigns = await campaignService.listCampaignsByGameMaster(user.id);

    return { campaigns };
  });

  app.get("/campaigns/accessible", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaigns = await campaignService.listCampaignsByPlayerAccess(user.id);
      const accessibleCampaigns = await Promise.all(
        campaigns.map(async (campaign) => ({
          campaign,
          scenarios: await scenarioService.listScenariosByCampaignPlayerAccess(campaign.id, user.id)
        }))
      );

      return { accessibleCampaigns };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load accessible campaigns."
      });
    }
  });

  app.get("/campaigns/accessible/:campaignId", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const scenarios = await scenarioService.listScenariosByCampaignPlayerAccess(campaignId, user.id);

      if (scenarios.length === 0) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      return {
        accessibleCampaign: {
          campaign,
          scenarios
        }
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load accessible campaign."
      });
    }
  });

  app.post("/campaigns", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const body = parseBodyObject(request.body, "Campaign payload");
      const campaign = await campaignService.createCampaign({
        description: parseOptionalString(body, "description"),
        gmUserId: user.id,
        name: parseRequiredString(body, "name"),
        settings: body.settings == null ? undefined : campaignSettingsSchema.parse(body.settings),
        status: body.status == null ? undefined : campaignStatusSchema.parse(body.status)
      });

      return { campaign };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create campaign."
      });
    }
  });

  app.get("/campaigns/:campaignId", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      return { campaign };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load campaign."
      });
    }
  });

  app.get("/campaigns/:campaignId/scenarios", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const scenarios = await scenarioService.listScenariosByCampaign(campaignId);

      return { scenarios };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list scenarios."
      });
    }
  });

  app.post("/campaigns/:campaignId/scenarios", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const body = parseBodyObject(request.body, "Scenario payload");
      const scenario = await scenarioService.createScenario({
        campaignId,
        continuesFromScenarioId: parseOptionalString(body, "continuesFromScenarioId"),
        description: parseOptionalString(body, "description"),
        kind: body.kind == null ? undefined : scenarioKindSchema.parse(body.kind),
        mapAssetId: parseOptionalNullableString(body, "mapAssetId"),
        name: parseRequiredString(body, "name"),
        status: body.status == null ? undefined : scenarioStatusSchema.parse(body.status)
      });

      return { scenario };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create scenario."
      });
    }
  });

  app.get("/campaigns/:campaignId/scenario-relationships", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const relationships = await scenarioService.listScenarioRelationshipsByCampaign(campaignId);

      return { relationships };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list scenario relationships."
      });
    }
  });

  app.get("/campaigns/:campaignId/roster", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const roster = await campaignService.listCampaignRosterEntries(campaignId);

      return { roster };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list campaign roster."
      });
    }
  });

  app.post("/campaigns/:campaignId/roster", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const body = parseBodyObject(request.body, "Campaign roster payload");
      const rosterEntry = await campaignService.addCampaignRosterEntry({
        campaignId,
        category: campaignRosterCategorySchema.parse(body.category),
        createdByUserId: user.id,
        notes: parseOptionalString(body, "notes"),
        sourceId: parseRequiredString(body, "sourceId"),
        sourceType: campaignRosterSourceTypeSchema.parse(body.sourceType)
      });

      return { rosterEntry };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to add campaign roster entry."
      });
    }
  });

  app.delete("/campaigns/:campaignId/roster/:rosterEntryId", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const rosterEntryId = parseId(request.params, "rosterEntryId", "Roster entry id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      await campaignService.removeCampaignRosterEntry({
        campaignId,
        rosterEntryId
      });

      return { ok: true };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to remove campaign roster entry."
      });
    }
  });

  app.delete("/campaigns/:campaignId/roster-membership/:sourceType/:sourceId", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const params =
        request.params && typeof request.params === "object"
          ? (request.params as Record<string, unknown>)
          : {};
      const sourceId = parseRequiredString(params, "sourceId");

      const result = await removeCampaignRosterMembershipBySource({
        campaignId,
        sourceId,
        sourceType: params.sourceType,
        userId: user.id
      });

      return { ok: true, removed: result.removed };
    } catch (error) {
      const { payload, status } = buildRosterRouteErrorPayload(error);

      return reply.code(status).send(payload);
    }
  });

  app.get("/campaigns/:campaignId/entities", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const entities = await campaignService.listReusableEntitiesByGameMaster(campaign.gmUserId);

      return { entities };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list reusable entities."
      });
    }
  });

  app.delete("/campaigns/:campaignId/roster-membership", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const query =
        request.query && typeof request.query === "object"
          ? (request.query as Record<string, unknown>)
          : {};
      const sourceId = parseRequiredString(query, "sourceId");

      const result = await removeCampaignRosterMembershipBySource({
        campaignId,
        sourceId,
        sourceType: query.sourceType,
        userId: user.id
      });

      return { ok: true, removed: result.removed };
    } catch (error) {
      const { payload, status } = buildRosterRouteErrorPayload(error);

      return reply.code(status).send(payload);
    }
  });

  app.post("/campaigns/:campaignId/entities", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const body = parseBodyObject(request.body, "Reusable entity payload");
      const entity = await campaignService.createReusableEntity({
        description: parseOptionalString(body, "description"),
        gmUserId: user.id,
        kind: reusableEntityKindSchema.parse(body.kind),
        name: parseRequiredString(body, "name"),
        notes: parseOptionalString(body, "notes"),
        snapshot: body.snapshot
      });

      return { entity };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create reusable entity."
      });
    }
  });

  app.get("/campaigns/:campaignId/assets", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const assets = await campaignService.listCampaignAssets(campaignId);

      return { assets };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list campaign assets."
      });
    }
  });

  app.post("/campaigns/:campaignId/assets", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const body = parseBodyObject(request.body, "Campaign asset payload");
      const asset = await campaignService.createCampaignAsset({
        campaignId,
        createdByUserId: user.id,
        description: parseOptionalString(body, "description"),
        mimeType: parseOptionalString(body, "mimeType"),
        storageUrl: parseRequiredString(body, "storageUrl"),
        title: parseRequiredString(body, "title"),
        type: campaignAssetTypeSchema.parse(body.type),
        visibility: scenarioVisibilitySchema.parse(body.visibility)
      });

      return { asset };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create campaign asset."
      });
    }
  });

  app.put("/campaign-assets/:assetId/visibility", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const assetId = parseId(request.params, "assetId", "Asset id");
      const existingAsset = await campaignService.getCampaignAssetById(assetId);

      if (!existingAsset) {
        return reply.code(404).send({
          error: "Campaign asset not found."
        });
      }

      const body = parseBodyObject(request.body, "Asset visibility payload");
      const asset = await campaignService.updateCampaignAssetVisibility({
        assetId,
        visibility: scenarioVisibilitySchema.parse(body.visibility)
      });

      return { asset };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update asset visibility."
      });
    }
  });
};
