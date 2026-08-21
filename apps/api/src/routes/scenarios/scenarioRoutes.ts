import type { FastifyPluginAsync } from "fastify";

import {
  CampaignService,
  EncounterService,
  ScenarioLifecycleConflictError,
  ScenarioService,
} from "@glantri/database";
import {
  buildScenarioPlayerProjection,
  getAvailableScenarioLifecycleActions,
  scenarioKindSchema,
  scenarioLifecycleActionSchema,
  scenarioLiveStateSchema,
} from "@glantri/domain";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import { resolveScenarioWorkspaceAccess } from "./access";
import {
  parseBodyObject,
  parseId,
  parseOptionalInteger,
  parseOptionalNullableString,
  parseOptionalString,
  parseRequiredString,
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
      const query =
        request.query && typeof request.query === "object"
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
          scenarios: await scenarioService.listScenariosByCampaign(campaign.id),
        })),
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
            status: scenario.status,
          })),
      );

      return { joinableScenarios };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load joinable scenarios.",
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
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { accessIntent: "read", scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access) {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      const scenario = await scenarioService.getScenarioById(scenarioId);

      return { scenario };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load scenario.",
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
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { accessIntent: "read", scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access) {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      const scenario = await scenarioService.getScenarioById(scenarioId);
      const participants = await scenarioService.listScenarioParticipants(scenarioId);
      const projection = buildScenarioPlayerProjection({
        participants,
        scenario: scenario!,
        userId: user.id,
      });

      return { projection };
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error ? error.message : "Unable to load scenario player projection.",
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
          error: "Scenario not found.",
        });
      }

      const campaign = await campaignService.getCampaignById(existingScenario.campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Scenario not found.",
        });
      }

      const body = parseBodyObject(request.body, "Scenario update payload");

      if ("status" in body) {
        return reply.code(400).send({
          error: "Use a Scenario lifecycle action to change status.",
        });
      }

      const scenario = await scenarioService.updateScenario({
        description: parseOptionalString(body, "description"),
        kind: body.kind == null ? undefined : scenarioKindSchema.parse(body.kind),
        mapAssetId: parseOptionalNullableString(body, "mapAssetId"),
        name: parseOptionalString(body, "name"),
        scenarioId,
      });

      return { scenario };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update scenario.",
      });
    }
  });

  app.get("/scenarios/:scenarioId/lifecycle", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { accessIntent: "read", scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      const scenario = await scenarioService.getScenarioById(scenarioId);

      if (!scenario) {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      return {
        availableActions: getAvailableScenarioLifecycleActions(scenario),
        preflight:
          scenario.status === "draft"
            ? await scenarioService.getScenarioStartPreflight(scenarioId)
            : undefined,
        scenario,
        transitions: await scenarioService.listScenarioLifecycleTransitions(scenarioId),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load Scenario lifecycle.",
      });
    }
  });

  app.post("/scenarios/:scenarioId/lifecycle/:action", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const action = scenarioLifecycleActionSchema.parse(
        parseId(request.params, "action", "Lifecycle action"),
      );
      const existingScenario = await scenarioService.getScenarioById(scenarioId);

      if (!existingScenario) {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      const campaign = await campaignService.getCampaignById(existingScenario.campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      const body = parseBodyObject(request.body, "Scenario lifecycle payload");
      const expectedRevision = parseOptionalInteger(body, "expectedRevision");

      if (expectedRevision == null || expectedRevision < 0) {
        throw new Error("expectedRevision must be a non-negative integer.");
      }

      const acceptedWarningCodesValue = body.acceptedWarningCodes;
      if (
        acceptedWarningCodesValue != null &&
        (!Array.isArray(acceptedWarningCodesValue) ||
          acceptedWarningCodesValue.some((code) => typeof code !== "string"))
      ) {
        throw new Error("acceptedWarningCodes must be an array of strings when provided.");
      }

      const result = await scenarioService.transitionScenarioLifecycle({
        acceptedWarningCodes: acceptedWarningCodesValue as string[] | undefined,
        action,
        actorUserId: user.id,
        expectedRevision,
        reason: parseRequiredString(body, "reason"),
        scenarioId,
      });

      if (!result) {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      return result;
    } catch (error) {
      if (error instanceof ScenarioLifecycleConflictError) {
        return reply.code(409).send({
          code: error.code,
          error: error.message,
          preflight: error.preflight,
        });
      }

      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to change Scenario lifecycle.",
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
          error: "Scenario not found.",
        });
      }

      const campaign = await campaignService.getCampaignById(existingScenario.campaignId);

      if (!campaign || campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Scenario not found.",
        });
      }

      const body = parseBodyObject(request.body, "Scenario live state payload");
      const scenario = await encounterService.updateScenarioLiveState({
        liveState: scenarioLiveStateSchema.parse(body.liveState),
        scenarioId,
      });

      return { scenario };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update scenario live state.",
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
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      const eventLogs = await scenarioService.listScenarioEventLogs(scenarioId);

      return { eventLogs };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list scenario event logs.",
      });
    }
  });
};
