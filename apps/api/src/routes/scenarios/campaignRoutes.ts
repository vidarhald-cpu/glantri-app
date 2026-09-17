import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  CampaignCharacterRosterCandidateNotFoundError,
  CampaignCharacterAlreadyRosteredError,
  CampaignService,
  EncounterService,
  ScenarioService,
} from "@glantri/database";
import {
  buildPlayerAccessibleCampaign,
  buildPlayerAccessibleScenario,
  buildPlayerCampaignHomeRecord,
  campaignRosterCategorySchema,
  campaignRosterSourceTypeSchema,
  campaignSettingsSchema,
  campaignStatusSchema,
  characterBuildSchema,
  reusableEntityKindSchema,
  scenarioKindSchema,
  scenarioStatusSchema,
} from "@glantri/domain";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import {
  parseBodyObject,
  parseId,
  parseOptionalNullableString,
  parseOptionalString,
  parseRequiredString,
} from "./parsing";

const campaignService = new CampaignService();
const encounterService = new EncounterService();
const scenarioService = new ScenarioService();

interface RouteError extends Error {
  code?: string;
  details?: unknown;
}

const CAMPAIGN_LOAD_FAILURE_PAYLOAD = {
  code: "CAMPAIGN_LOAD_FAILED",
  error: "Unable to load campaign data. Please try again.",
} as const;

function sendCampaignLoadFailure(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  request.log.error({ err: error }, "Campaign data load failed");
  return reply.code(500).send(CAMPAIGN_LOAD_FAILURE_PAYLOAD);
}

function parseConcreteNpcSnapshot(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Concrete NPC snapshot is required.");
  }

  const snapshot = value as Record<string, unknown>;
  characterBuildSchema.parse(snapshot.build);

  if (!snapshot.sheetSummary || typeof snapshot.sheetSummary !== "object") {
    throw new Error("Concrete NPC sheet summary is required.");
  }

  if (!snapshot.equipmentState || typeof snapshot.equipmentState !== "object") {
    throw new Error("Concrete NPC equipment state is required.");
  }

  if (!snapshot.generatedHumanoidNpc || typeof snapshot.generatedHumanoidNpc !== "object") {
    throw new Error("Concrete NPC generation provenance is required.");
  }

  return snapshot;
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
      parsed.error.issues,
    );
  }

  return parsed.data;
}

function buildRosterRouteErrorPayload(
  error: unknown,
  context?: {
    campaignId?: unknown;
    route?: string;
    sourceId?: unknown;
    sourceType?: unknown;
  },
) {
  const diagnosticDetails = {
    campaignId: context?.campaignId,
    causeMessage: error instanceof Error ? error.message : String(error),
    causeName: error instanceof Error ? error.name : typeof error,
    route: context?.route,
    sourceId: context?.sourceId,
    sourceType: context?.sourceType,
  };

  if (error instanceof Error && error.message === "Campaign not found.") {
    return {
      payload: {
        code: "CAMPAIGN_NOT_FOUND",
        details: diagnosticDetails,
        error: "Campaign not found.",
        route: context?.route,
      },
      status: 404,
    };
  }

  if (error instanceof Error) {
    const routeError = error as RouteError;

    return {
      payload: {
        code: routeError.code ?? "CAMPAIGN_ROSTER_REMOVE_FAILED",
        details: {
          ...diagnosticDetails,
          validation: routeError.details,
        },
        error: routeError.message,
        route: context?.route,
      },
      status: 400,
    };
  }

  return {
    payload: {
      code: "CAMPAIGN_ROSTER_REMOVE_FAILED",
      details: diagnosticDetails,
      error: "Unable to remove campaign roster membership.",
      route: context?.route,
    },
    status: 400,
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
    sourceType,
  });
}

export const campaignRoutes: FastifyPluginAsync = async (app) => {
  app.get("/campaigns", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaigns = await campaignService.listCampaignsByGameMaster(user.id);

      return { campaigns };
    } catch (error) {
      return sendCampaignLoadFailure(request, reply, error);
    }
  });

  app.get("/campaigns/accessible", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const activeCampaigns = (await campaignService.listCampaignsByUserAccess(user.id)).filter(
        (campaign) => campaign.status === "active",
      );
      const accessibleCampaigns = await Promise.all(
        activeCampaigns.map(async (campaign) => ({
          campaign: buildPlayerAccessibleCampaign(campaign),
          scenarios: (
            await scenarioService.listScenariosByCampaignPlayerControl(campaign.id, user.id)
          ).map(buildPlayerAccessibleScenario),
        })),
      );

      return { accessibleCampaigns };
    } catch (error) {
      return sendCampaignLoadFailure(request, reply, error);
    }
  });

  app.get("/campaigns/player-home", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const activeCampaigns = (await campaignService.listCampaignsByUserAccess(user.id)).filter(
        (campaign) => campaign.status === "active",
      );
      const playerCampaigns = await Promise.all(
        activeCampaigns.map(async (campaign) => {
          const [rosterCharacters, scenarios] = await Promise.all([
            campaignService.listPlayerCampaignCharacters({
              campaignId: campaign.id,
              userId: user.id,
            }),
            // Keep ownership-visible context long enough to identify delegated roster Characters;
            // the domain projection withholds every Scenario the requester does not control.
            scenarioService.listScenariosByCampaignPlayerAccess(campaign.id, user.id),
          ]);
          const scenarioContexts = await Promise.all(
            scenarios.map(async (scenario) => {
              const [encounters, participants] = await Promise.all([
                encounterService.listEncountersByScenario(scenario.id),
                scenarioService.listScenarioParticipants(scenario.id),
              ]);

              return { encounters, participants, scenario };
            }),
          );

          return buildPlayerCampaignHomeRecord({
            campaign,
            rosterCharacters,
            scenarios: scenarioContexts,
            userId: user.id,
          });
        }),
      );

      return { campaigns: playerCampaigns };
    } catch (error) {
      return sendCampaignLoadFailure(request, reply, error);
    }
  });

  app.get("/campaigns/accessible/:campaignId", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const activeCampaigns = (await campaignService.listCampaignsByUserAccess(user.id)).filter(
        (candidate) => candidate.status === "active",
      );
      const campaign = activeCampaigns.find((candidate) => candidate.id === campaignId);

      if (!campaign) {
        return reply.code(404).send({
          error: "Campaign not found.",
        });
      }

      const scenarios = await scenarioService.listScenariosByCampaignPlayerControl(
        campaignId,
        user.id,
      );

      return {
        accessibleCampaign: {
          campaign: buildPlayerAccessibleCampaign(campaign),
          scenarios: scenarios.map(buildPlayerAccessibleScenario),
        },
      };
    } catch (error) {
      return sendCampaignLoadFailure(request, reply, error);
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
        status: body.status == null ? undefined : campaignStatusSchema.parse(body.status),
      });

      return { campaign };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create campaign.",
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
          error: "Campaign not found.",
        });
      }

      return { campaign };
    } catch (error) {
      return sendCampaignLoadFailure(request, reply, error);
    }
  });

  app.post("/campaigns/:campaignId/activate", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const next = await campaignService.activateCampaign({
        actorUserId: user.id,
        actorIsAdmin: user.roles.includes("admin"),
        campaignId,
      });

      return { campaign: next };
    } catch (error) {
      if (error instanceof Error && error.message === "Campaign not found.") {
        return reply.code(404).send({
          error: "Campaign not found.",
        });
      }

      if (
        error instanceof Error &&
        error.message === "Campaign can only be activated from draft status."
      ) {
        return reply.code(400).send({
          error: error.message,
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to activate campaign.",
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
          error: "Campaign not found.",
        });
      }

      const scenarios = await scenarioService.listScenariosByCampaign(campaignId);

      return { scenarios };
    } catch (error) {
      return sendCampaignLoadFailure(request, reply, error);
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
          error: "Campaign not found.",
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
        status: body.status == null ? undefined : scenarioStatusSchema.parse(body.status),
      });

      return { scenario };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create scenario.",
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
          error: "Campaign not found.",
        });
      }

      const relationships = await scenarioService.listScenarioRelationshipsByCampaign(campaignId);

      return { relationships };
    } catch (error) {
      return sendCampaignLoadFailure(request, reply, error);
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
          error: "Campaign not found.",
        });
      }

      const roster = await campaignService.listCampaignRosterHistoryEntries(campaignId);

      return { roster };
    } catch (error) {
      return sendCampaignLoadFailure(request, reply, error);
    }
  });

  app.get("/campaigns/:campaignId/roster-candidates/characters", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found.",
        });
      }

      const characters = await campaignService.listCampaignCharacterRosterCandidates({
        actorUserId: user.id,
        campaignId,
      });

      return { characters };
    } catch (error) {
      return sendCampaignLoadFailure(request, reply, error);
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
          error: "Campaign not found.",
        });
      }

      const body = parseBodyObject(request.body, "Campaign roster payload");
      const rosterEntry = await campaignService.addCampaignRosterEntry({
        actorIsAdmin: user.roles.includes("admin"),
        actorUserId: user.id,
        campaignId,
        category: campaignRosterCategorySchema.parse(body.category),
        createdByUserId: user.id,
        notes: parseOptionalString(body, "notes"),
        sourceId: parseRequiredString(body, "sourceId"),
        sourceType: campaignRosterSourceTypeSchema.parse(body.sourceType),
      });

      return { rosterEntry };
    } catch (error) {
      if (error instanceof CampaignCharacterAlreadyRosteredError) {
        return reply.code(409).send({
          code: "CHARACTER_ALREADY_IN_ACTIVE_CAMPAIGN",
          error: error.message,
        });
      }
      if (error instanceof CampaignCharacterRosterCandidateNotFoundError) {
        return reply.code(404).send({ error: "Campaign character candidate not found." });
      }

      if (error instanceof Error && error.message === "Reusable entity not found.") {
        return reply.code(404).send({ error: "Reusable entity not found." });
      }

      return reply.code(400).send({
        error: "Unable to add campaign roster entry.",
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
          error: "Campaign not found.",
        });
      }

      await campaignService.removeCampaignRosterEntry({
        campaignId,
        rosterEntryId,
      });

      return { ok: true };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to remove campaign roster entry.",
      });
    }
  });

  app.post("/campaigns/:campaignId/characters/:characterId/leave", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;
    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const characterId = parseId(request.params, "characterId", "Character id");
      const result = await campaignService.leaveCampaign({
        campaignId,
        characterId,
        ownerUserId: user.id,
      });
      return { ok: true, removed: result.removed };
    } catch (error) {
      if (error instanceof CampaignCharacterRosterCandidateNotFoundError) {
        return reply.code(404).send({ error: "Character not found." });
      }
      return reply.code(400).send({ error: "Unable to leave Campaign." });
    }
  });

  app.delete(
    "/campaigns/:campaignId/roster-membership/:sourceType/:sourceId",
    async (request, reply) => {
      const user = await requireAdminUser(request, reply);

      if (!user) {
        return;
      }

      const params =
        request.params && typeof request.params === "object"
          ? (request.params as Record<string, unknown>)
          : {};
      const context = {
        campaignId: params.campaignId,
        route: "source-key",
        sourceId: params.sourceId,
        sourceType: params.sourceType,
      };

      try {
        const campaignId = parseId(request.params, "campaignId", "Campaign id");
        const sourceId = parseRequiredString(params, "sourceId");

        const result = await removeCampaignRosterMembershipBySource({
          campaignId,
          sourceId,
          sourceType: params.sourceType,
          userId: user.id,
        });

        return { ok: true, removed: result.removed, route: "source-key" };
      } catch (error) {
        request.log.error(
          {
            campaignId: context.campaignId,
            err: error,
            route: context.route,
            sourceId: context.sourceId,
            sourceType: context.sourceType,
          },
          "remove roster membership failed",
        );
        const { payload, status } = buildRosterRouteErrorPayload(error, context);

        return reply.code(status).send(payload);
      }
    },
  );

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
          error: "Campaign not found.",
        });
      }

      const entities = await campaignService.listReusableEntitiesByGameMaster(campaign.gmUserId);

      return { entities };
    } catch (error) {
      return sendCampaignLoadFailure(request, reply, error);
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
        userId: user.id,
      });

      return { ok: true, removed: result.removed, route: "source-query" };
    } catch (error) {
      const query =
        request.query && typeof request.query === "object"
          ? (request.query as Record<string, unknown>)
          : {};
      const { payload, status } = buildRosterRouteErrorPayload(error, {
        campaignId:
          request.params && typeof request.params === "object"
            ? (request.params as Record<string, unknown>).campaignId
            : undefined,
        route: "source-query",
        sourceId: query.sourceId,
        sourceType: query.sourceType,
      });

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
          error: "Campaign not found.",
        });
      }

      const body = parseBodyObject(request.body, "Reusable entity payload");
      const entity = await campaignService.createReusableEntity({
        description: parseOptionalString(body, "description"),
        gmUserId: user.id,
        kind: reusableEntityKindSchema.parse(body.kind),
        name: parseRequiredString(body, "name"),
        notes: parseOptionalString(body, "notes"),
        snapshot: body.snapshot,
      });

      return { entity };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create reusable entity.",
      });
    }
  });

  app.post("/campaigns/:campaignId/npcs", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const campaignId = parseId(request.params, "campaignId", "Campaign id");
      const campaign = await campaignService.getCampaignById(campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Campaign not found.",
        });
      }

      const body = parseBodyObject(request.body, "Concrete NPC payload");
      const kind = reusableEntityKindSchema.parse(body.kind);

      if (kind !== "npc") {
        throw new Error("Concrete generated actors must use the NPC kind.");
      }

      const result = await campaignService.createCampaignNpc({
        campaignId,
        createdByUserId: user.id,
        description: parseOptionalString(body, "description"),
        gmUserId: campaign.gmUserId,
        kind,
        name: parseRequiredString(body, "name"),
        notes: parseOptionalString(body, "notes"),
        snapshot: parseConcreteNpcSnapshot(body.snapshot),
      });

      return result;
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create campaign NPC.",
      });
    }
  });

  app.get("/campaigns/:campaignId/assets", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    return reply.code(410).send({ error: "Use the authenticated Campaign Artifacts view." });
  });

  app.post("/campaigns/:campaignId/assets", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    return reply.code(410).send({ error: "Upload through the Campaign Artifacts view." });
  });

  app.put("/campaign-assets/:assetId/visibility", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    return reply.code(410).send({ error: "Use explicit Artifact sharing controls." });
  });
};
