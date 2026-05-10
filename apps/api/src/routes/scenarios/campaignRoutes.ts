import type { FastifyPluginAsync } from "fastify";

import { ScenarioService } from "@glantri/database";
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

const scenarioService = new ScenarioService();

export const campaignRoutes: FastifyPluginAsync = async (app) => {
  app.get("/campaigns", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    const campaigns = await scenarioService.listCampaignsByGameMaster(user.id);

    return { campaigns };
  });

  app.get("/campaigns/accessible", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaigns = await scenarioService.listCampaignsByPlayerAccess(user.id);
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
      const campaign = await scenarioService.getCampaignById(campaignId);

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
      const campaign = await scenarioService.createCampaign({
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
      const campaign = await scenarioService.getCampaignById(campaignId);

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
      const campaign = await scenarioService.getCampaignById(campaignId);

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
      const campaign = await scenarioService.getCampaignById(campaignId);

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
      const campaign = await scenarioService.getCampaignById(campaignId);

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
      const campaign = await scenarioService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const roster = await scenarioService.listCampaignRosterEntries(campaignId);

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
      const campaign = await scenarioService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const body = parseBodyObject(request.body, "Campaign roster payload");
      const rosterEntry = await scenarioService.addCampaignRosterEntry({
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
      const campaign = await scenarioService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      await scenarioService.removeCampaignRosterEntry({
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

  app.get("/campaigns/:campaignId/entities", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await scenarioService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const entities = await scenarioService.listReusableEntitiesByGameMaster(campaign.gmUserId);

      return { entities };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list reusable entities."
      });
    }
  });

  app.post("/campaigns/:campaignId/entities", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await scenarioService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const body = parseBodyObject(request.body, "Reusable entity payload");
      const entity = await scenarioService.createReusableEntity({
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
      const campaign = await scenarioService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const assets = await scenarioService.listCampaignAssets(campaignId);

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
      const campaign = await scenarioService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const body = parseBodyObject(request.body, "Campaign asset payload");
      const asset = await scenarioService.createCampaignAsset({
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
      const existingAsset = await scenarioService.getCampaignAssetById(assetId);

      if (!existingAsset) {
        return reply.code(404).send({
          error: "Campaign asset not found."
        });
      }

      const body = parseBodyObject(request.body, "Asset visibility payload");
      const asset = await scenarioService.updateCampaignAssetVisibility({
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
