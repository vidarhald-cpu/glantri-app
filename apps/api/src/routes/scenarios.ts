import type { FastifyPluginAsync } from "fastify";

import { CharacterService, ScenarioService } from "@glantri/database";
import {
  campaignAssetTypeSchema,
  campaignSettingsSchema,
  campaignStatusSchema,
  reusableEntityKindSchema,
  scenarioKindSchema,
  scenarioLiveStateSchema,
  scenarioParticipantJoinSourceSchema,
  scenarioParticipantRoleSchema,
  scenarioParticipantStateSchema,
  scenarioStatusSchema,
  scenarioVisibilitySchema
} from "@glantri/domain";

import { requireAdminUser, requireAuthenticatedUser } from "../lib/sessionAuth";
import { canEditCharacterInApi } from "../lib/characterEditAccess";

const characterService = new CharacterService();
const scenarioService = new ScenarioService();

function parseId(params: unknown, key: string, label: string): string {
  const value =
    params && typeof params === "object" && key in params ? (params as Record<string, unknown>)[key] : undefined;

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function parseBodyObject(body: unknown, label: string): Record<string, unknown> {
  if (!body || typeof body !== "object") {
    throw new Error(`${label} is required.`);
  }

  return body as Record<string, unknown>;
}

function parseOptionalString(
  object: Record<string, unknown>,
  key: string
): string | undefined {
  const value = object[key];

  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string when provided.`);
  }

  return value;
}

function parseRequiredString(
  object: Record<string, unknown>,
  key: string
): string {
  const value = object[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function parseOptionalNullableString(
  object: Record<string, unknown>,
  key: string
): string | null | undefined {
  const value = object[key];

  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string or null when provided.`);
  }

  return value;
}

function parseOptionalBoolean(
  object: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = object[key];

  if (value == null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${key} must be a boolean when provided.`);
  }

  return value;
}

export const scenariosRoutes: FastifyPluginAsync = async (app) => {
  app.get("/templates", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const entities = await scenarioService.listReusableEntitiesByGameMaster(user.id);
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

      const template = await scenarioService.createReusableEntity({
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

  app.get("/scenarios/joinable", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const isGameMaster = user.roles.includes("game_master") || user.roles.includes("admin");
      const campaigns = isGameMaster
        ? user.roles.includes("admin")
          ? await scenarioService.listCampaignsAllowingPlayerSelfJoin()
          : await scenarioService.listCampaignsByGameMaster(user.id)
        : await scenarioService.listCampaignsAllowingPlayerSelfJoin();

      const scenarioGroups = await Promise.all(
        campaigns.map(async (campaign) => ({
          campaign,
          scenarios: await scenarioService.listScenariosByCampaign(campaign.id)
        }))
      );

      const joinableScenarios = scenarioGroups.flatMap(({ campaign, scenarios }) =>
        scenarios
          .filter((scenario) => scenario.status !== "archived" && scenario.status !== "completed")
          .map((scenario) => ({
            campaignId: campaign.id,
            campaignName: campaign.name,
            kind: scenario.kind,
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            status: scenario.status
          }))
      );

      return { joinableScenarios };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load joinable scenarios."
      });
    }
  });

  app.get("/campaigns", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    const campaigns = await scenarioService.listCampaignsByGameMaster(user.id);

    return { campaigns };
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
        settings:
          body.settings == null ? undefined : campaignSettingsSchema.parse(body.settings),
        status:
          body.status == null ? undefined : campaignStatusSchema.parse(body.status)
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

  app.get("/scenarios/:scenarioId", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const scenario = await scenarioService.getScenarioById(scenarioId);

      if (!scenario) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      return { scenario };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load scenario."
      });
    }
  });

  app.put("/scenarios/:scenarioId", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const existingScenario = await scenarioService.getScenarioById(scenarioId);

      if (!existingScenario) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const campaign = await scenarioService.getCampaignById(existingScenario.campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const body = parseBodyObject(request.body, "Scenario update payload");
      const scenario = await scenarioService.updateScenario({
        description: parseOptionalString(body, "description"),
        kind: body.kind == null ? undefined : scenarioKindSchema.parse(body.kind),
        mapAssetId: parseOptionalNullableString(body, "mapAssetId"),
        name: parseOptionalString(body, "name"),
        scenarioId,
        status: body.status == null ? undefined : scenarioStatusSchema.parse(body.status)
      });

      return { scenario };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update scenario."
      });
    }
  });

  app.put("/scenarios/:scenarioId/live-state", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const existingScenario = await scenarioService.getScenarioById(scenarioId);

      if (!existingScenario) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const campaign = await scenarioService.getCampaignById(existingScenario.campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const body = parseBodyObject(request.body, "Scenario live state payload");
      const scenario = await scenarioService.updateScenarioLiveState({
        liveState: scenarioLiveStateSchema.parse(body.liveState),
        scenarioId
      });

      return { scenario };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update scenario live state."
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
      const entity = await scenarioService.getReusableEntityById(entityId);

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

  app.get("/scenarios/:scenarioId/participants", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const scenario = await scenarioService.getScenarioById(scenarioId);

      if (!scenario) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const participants = await scenarioService.listScenarioParticipants(scenarioId);

      return { participants };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list scenario participants."
      });
    }
  });

  app.post("/scenarios/:scenarioId/participants/character", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const scenario = await scenarioService.getScenarioById(scenarioId);

      if (!scenario) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const campaign = await scenarioService.getCampaignById(scenario.campaignId);

      if (!campaign) {
        return reply.code(404).send({
          error: "Campaign not found."
        });
      }

      const body = parseBodyObject(request.body, "Character participant payload");
      const characterId = parseRequiredString(body, "characterId");
      const isGameMaster = user.roles.includes("game_master") || user.roles.includes("admin");

      if (isGameMaster && !user.roles.includes("admin") && campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      if (!isGameMaster && !campaign.settings.allowPlayerSelfJoin) {
        return reply.code(403).send({
          error: "Player self-join is not enabled for this campaign."
        });
      }

      if (!canEditCharacterInApi(user)) {
        const character = await characterService.getOwnedCharacter(user.id, characterId);

        if (!character) {
          return reply.code(404).send({
            error: "Character not found."
          });
        }
      }

      const participant = await scenarioService.addCharacterParticipant({
        characterId,
        controlledByUserId: parseOptionalNullableString(body, "controlledByUserId") ?? user.id,
        joinSource:
          body.joinSource == null
            ? "gm_added"
            : scenarioParticipantJoinSourceSchema.parse(body.joinSource),
        role: body.role == null ? undefined : scenarioParticipantRoleSchema.parse(body.role),
        scenarioId
      });

      return { participant };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to add character participant."
      });
    }
  });

  app.post("/scenarios/:scenarioId/participants/entity", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const scenario = await scenarioService.getScenarioById(scenarioId);

      if (!scenario) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const body = parseBodyObject(request.body, "Entity participant payload");
      const entityId = parseOptionalString(body, "entityId");
      const entityInput =
        body.entityInput == null
          ? undefined
          : (() => {
              const entityPayload = parseBodyObject(body.entityInput, "entityInput");

              return {
                description: parseOptionalString(entityPayload, "description"),
                gmUserId: user.id,
                kind: reusableEntityKindSchema.parse(entityPayload.kind),
                name: parseRequiredString(entityPayload, "name"),
                notes: parseOptionalString(entityPayload, "notes"),
                snapshot: entityPayload.snapshot
              };
            })();

      const participant = await scenarioService.addEntityParticipant({
        controlledByUserId: parseOptionalNullableString(body, "controlledByUserId") ?? user.id,
        entityId,
        entityInput,
        isTemporary: parseOptionalBoolean(body, "isTemporary"),
        joinSource:
          body.joinSource == null
            ? "gm_added"
            : scenarioParticipantJoinSourceSchema.parse(body.joinSource),
        role: scenarioParticipantRoleSchema.parse(body.role),
        scenarioId
      });

      return { participant };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to add entity participant."
      });
    }
  });

  app.put("/scenarios/:scenarioId/participants/:participantId/state", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const participantId = parseId(request.params, "participantId", "Participant id");
      const body = parseBodyObject(request.body, "Participant state payload");
      const participant = await scenarioService.updateScenarioParticipantState({
        participantId,
        scenarioId,
        state: scenarioParticipantStateSchema.parse(body.state)
      });

      return { participant };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update participant state."
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

  app.get("/scenarios/:scenarioId/events", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const scenario = await scenarioService.getScenarioById(scenarioId);

      if (!scenario) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const eventLogs = await scenarioService.listScenarioEventLogs(scenarioId);

      return { eventLogs };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list scenario event logs."
      });
    }
  });
};
