import type { FastifyPluginAsync } from "fastify";

import { CampaignService, EncounterService, ScenarioService } from "@glantri/database";
import {
  buildScenarioPlayerProjection,
  scenarioKindSchema,
  scenarioLiveStateSchema,
  scenarioStatusSchema
} from "@glantri/domain";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import {
  parseBodyObject,
  parseId,
  parseOptionalNullableString,
  parseOptionalString
} from "./parsing";

const campaignService = new CampaignService();
const encounterService = new EncounterService();
const scenarioService = new ScenarioService();

export const scenarioRoutes: FastifyPluginAsync = async (app) => {
  app.get("/scenarios/joinable", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const query = request.query && typeof request.query === "object"
        ? (request.query as Record<string, unknown>)
        : {};
      const characterId = parseOptionalString(query, "characterId");
      const isGameMaster = user.roles.includes("game_master") || user.roles.includes("admin");

      const campaigns = characterId
        ? await campaignService.listCampaignsByCharacterRosterAccess(characterId)
        : isGameMaster
          ? await campaignService.listCampaignsByGameMaster(user.id)
          : [];

      const scenarioGroups = await Promise.all(
        campaigns.map(async (campaign) => ({
          campaign,
          scenarios: await scenarioService.listScenariosByCampaign(campaign.id)
        }))
      );

      const joinableScenarios = scenarioGroups.flatMap(({ campaign, scenarios }) =>
        scenarios
          .filter((scenario) => scenario.status === "live")
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

  app.get("/scenarios/:scenarioId/player-projection", async (request, reply) => {
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
      const projection = buildScenarioPlayerProjection({
        participants,
        scenario,
        userId: user.id
      });

      return { projection };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load scenario player projection."
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

      const campaign = await campaignService.getCampaignById(existingScenario.campaignId);

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

      const campaign = await campaignService.getCampaignById(existingScenario.campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const body = parseBodyObject(request.body, "Scenario live state payload");
      const scenario = await encounterService.updateScenarioLiveState({
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
