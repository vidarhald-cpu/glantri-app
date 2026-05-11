import type { FastifyPluginAsync } from "fastify";

import { CampaignService, CharacterService, EncounterService, ScenarioService } from "@glantri/database";
import {
  reusableEntityKindSchema,
  scenarioParticipantJoinSourceSchema,
  scenarioParticipantRoleSchema,
  scenarioParticipantStateSchema
} from "@glantri/domain";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import { canEditCharacterInApi } from "../../lib/characterEditAccess";
import {
  parseBodyObject,
  parseId,
  parseOptionalBoolean,
  parseOptionalInteger,
  parseOptionalNullableString,
  parseOptionalString,
  parseRequiredString
} from "./parsing";

const characterService = new CharacterService();
const campaignService = new CampaignService();
const encounterService = new EncounterService();
const scenarioService = new ScenarioService();

export const participantRoutes: FastifyPluginAsync = async (app) => {
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

      const campaign = await campaignService.getCampaignById(scenario.campaignId);

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
        displayOrder: parseOptionalInteger(body, "displayOrder"),
        factionId: parseOptionalNullableString(body, "factionId"),
        joinSource:
          body.joinSource == null
            ? "gm_added"
            : scenarioParticipantJoinSourceSchema.parse(body.joinSource),
        role: body.role == null ? undefined : scenarioParticipantRoleSchema.parse(body.role),
        roleTag: parseOptionalNullableString(body, "roleTag"),
        scenarioId,
        tacticalGroupId: parseOptionalNullableString(body, "tacticalGroupId")
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
        displayOrder: parseOptionalInteger(body, "displayOrder"),
        entityId,
        entityInput,
        factionId: parseOptionalNullableString(body, "factionId"),
        isTemporary: parseOptionalBoolean(body, "isTemporary"),
        joinSource:
          body.joinSource == null
            ? "gm_added"
            : scenarioParticipantJoinSourceSchema.parse(body.joinSource),
        role: scenarioParticipantRoleSchema.parse(body.role),
        roleTag: parseOptionalNullableString(body, "roleTag"),
        scenarioId,
        tacticalGroupId: parseOptionalNullableString(body, "tacticalGroupId")
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
      const participant = await encounterService.updateScenarioParticipantState({
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

  app.put(
    "/scenarios/:scenarioId/participants/:participantId/metadata",
    async (request, reply) => {
      const user = await requireAdminUser(request, reply);

      if (!user) {
        return;
      }

      try {
        const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
        const participantId = parseId(request.params, "participantId", "Participant id");
        const scenario = await scenarioService.getScenarioById(scenarioId);

        if (!scenario) {
          return reply.code(404).send({
            error: "Scenario not found."
          });
        }

        const body = parseBodyObject(request.body, "Participant metadata payload");
        const participant = await scenarioService.updateScenarioParticipantMetadata({
          controlledByUserId: parseOptionalNullableString(body, "controlledByUserId"),
          displayOrder: parseOptionalInteger(body, "displayOrder"),
          factionId: parseOptionalNullableString(body, "factionId"),
          isActive: parseOptionalBoolean(body, "isActive"),
          participantId,
          roleTag: parseOptionalNullableString(body, "roleTag"),
          scenarioId,
          tacticalGroupId: parseOptionalNullableString(body, "tacticalGroupId")
        });

        return { participant };
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to update participant metadata."
        });
      }
    }
  );
};
