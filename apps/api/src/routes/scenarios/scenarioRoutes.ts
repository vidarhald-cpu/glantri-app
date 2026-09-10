import type { FastifyPluginAsync } from "fastify";

import {
  CampaignService,
  EncounterService,
  ScenarioService,
  ScenarioSessionWriteError,
} from "@glantri/database";
import {
  canMutateScenarioInStatus,
  buildPlayerSafeScenario,
  buildScenarioSessionView,
  buildScenarioPlayerProjection,
  scenarioAvailableObjectReferenceSchema,
  scenarioKindSchema,
  scenarioLiveStateSchema,
  scenarioStatusSchema,
} from "@glantri/domain";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import { resolveScenarioWorkspaceAccess } from "./access";
import {
  parseBodyObject,
  parseId,
  parseOptionalNullableString,
  parseOptionalString,
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
        { scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access) {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      const scenario = await scenarioService.getScenarioById(scenarioId);

      return {
        scenario: access.mode === "gm" ? scenario : buildPlayerSafeScenario(scenario!),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load scenario.",
      });
    }
  });

  app.get("/scenarios/:scenarioId/session", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access) return reply.code(404).send({ error: "Scenario not found." });

      const [scenario, participants, encounters, eventLogs] = await Promise.all([
        scenarioService.getScenarioById(scenarioId),
        scenarioService.listScenarioParticipants(scenarioId),
        encounterService.listEncountersByScenario(scenarioId),
        scenarioService.listScenarioEventLogs(scenarioId),
      ]);
      if (!scenario) return reply.code(404).send({ error: "Scenario not found." });
      const availableObjects = await scenarioService.resolveScenarioAvailableObjects({
        scenario,
        viewerMode: access.mode,
      });
      const equipmentByParticipantId = await scenarioService.resolveEquipmentStatuses({
        participants,
        userId: user.id,
        viewerMode: access.mode,
      });

      return {
        session: buildScenarioSessionView({
          availableObjects,
          encounters,
          equipmentByParticipantId,
          eventLogs,
          participants,
          scenario,
          userId: user.id,
          viewerMode: access.mode,
        }),
      };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load the Scenario session.",
      });
    }
  });

  app.patch("/scenarios/:scenarioId/session", async (request, reply) => {
    const user = await requireAdminUser(request, reply);
    if (!user) return;

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles },
      );
      if (!access || access.mode !== "gm") {
        return reply.code(404).send({ error: "Scenario not found." });
      }
      const scenario = await scenarioService.getScenarioById(scenarioId);
      if (!scenario) {
        return reply.code(404).send({ error: "Scenario not found." });
      }
      if (!canMutateScenarioInStatus(scenario.status)) {
        return reply.code(400).send({ error: "Scenario is not editable in its current status." });
      }
      const body = parseBodyObject(request.body, "Scenario session payload");
      if (!Array.isArray(body.availableObjects)) {
        throw new Error("Available objects must be a list.");
      }
      const expectedRevision = parseOptionalString(body, "expectedRevision");
      if (!expectedRevision) throw new Error("Refresh the Scenario before saving.");
      const updated = await scenarioService.updateScenarioSessionState({
        actorUserId: user.id,
        availableObjects: body.availableObjects.map((reference) =>
          scenarioAvailableObjectReferenceSchema.parse(reference),
        ),
        expectedRevision,
        gmPrivateNotes: parseOptionalString(body, "gmPrivateNotes") ?? "",
        scenarioId,
      });
      return { scenario: updated };
    } catch (error) {
      if (error instanceof ScenarioSessionWriteError) {
        return reply.code(409).send({ error: error.message });
      }
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to save the Scenario session.",
      });
    }
  });

  app.post(
    "/scenarios/:scenarioId/available-objects/:availabilityId/pick-up",
    async (request, reply) => {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return;

      try {
        const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
        const availabilityId = parseId(request.params, "availabilityId", "Available object id");
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId, userId: user.id, userRoles: user.roles },
        );
        if (!access) return reply.code(404).send({ error: "Available Item not found." });
        const scenario = await scenarioService.getScenarioById(scenarioId);

        if (!scenario) {
          return reply.code(404).send({ error: "Available Item not found." });
        }
        if (!canMutateScenarioInStatus(scenario.status)) {
          return reply.code(400).send({ error: "Scenario is not editable in its current status." });
        }
        const body = parseBodyObject(request.body, "Item pickup payload");
        const expectedRevision = parseOptionalString(body, "expectedRevision");
        const requestId = parseOptionalString(body, "requestId");
        const targetParticipantId = parseOptionalString(body, "targetParticipantId");
        if (!expectedRevision || !requestId || !targetParticipantId) {
          throw new Error("Refresh the Scenario and choose who will receive the Item.");
        }
        const result = await scenarioService.pickUpScenarioAvailableItem({
          actorUserId: user.id,
          availabilityId,
          expectedRevision,
          requestId,
          scenarioId,
          targetParticipantId,
          viewerMode: access.mode,
        });
        const [participants, encounters, eventLogs, availableObjects] = await Promise.all([
          scenarioService.listScenarioParticipants(scenarioId),
          encounterService.listEncountersByScenario(scenarioId),
          scenarioService.listScenarioEventLogs(scenarioId),
          scenarioService.resolveScenarioAvailableObjects({
            scenario: result.scenario,
            viewerMode: access.mode,
          }),
        ]);
        const equipmentByParticipantId = await scenarioService.resolveEquipmentStatuses({
          participants,
          userId: user.id,
          viewerMode: access.mode,
        });
        return {
          idempotent: result.idempotent,
          session: buildScenarioSessionView({
            availableObjects,
            encounters,
            equipmentByParticipantId,
            eventLogs,
            participants,
            scenario: result.scenario,
            userId: user.id,
            viewerMode: access.mode,
          }),
        };
      } catch (error) {
        if (error instanceof ScenarioSessionWriteError) {
          return reply.code(409).send({ error: error.message });
        }
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to pick up the Item.",
        });
      }
    },
  );

  app.get("/scenarios/:scenarioId/player-projection", async (request, reply) => {
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

      if (!access) {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      const scenario = await scenarioService.getScenarioById(scenarioId);
      if (!scenario) {
        return reply.code(404).send({ error: "Scenario not found." });
      }
      const participants = await scenarioService.listScenarioParticipants(scenarioId);
      const projection = buildScenarioPlayerProjection({
        participants,
        scenario,
        userId: user.id,
        viewerMode: access.mode,
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
      const expectedRevision = parseOptionalString(body, "expectedRevision");
      const scenario = await scenarioService.updateScenario({
        expectedRevision,
        description: parseOptionalString(body, "description"),
        kind: body.kind == null ? undefined : scenarioKindSchema.parse(body.kind),
        mapAssetId: parseOptionalNullableString(body, "mapAssetId"),
        name: parseOptionalString(body, "name"),
        scenarioId,
        status: body.status == null ? undefined : scenarioStatusSchema.parse(body.status),
      });

      return { scenario };
    } catch (error) {
      const conflictCode =
        typeof error === "object" && error !== null
          ? (error as { code?: unknown }).code
          : undefined;

      if (conflictCode === "stale_revision" || conflictCode === "transaction_conflict") {
        return reply.code(409).send({
          code: conflictCode,
          error:
            typeof error === "object" && error !== null && "message" in error
              ? String((error as { message?: unknown }).message ?? "")
              : "Unable to update scenario.",
        });
      }
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update scenario.",
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
      if (!canMutateScenarioInStatus(existingScenario.status)) {
        return reply.code(400).send({ error: "Scenario is not editable in its current status." });
      }
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
