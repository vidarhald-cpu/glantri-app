import type { FastifyPluginAsync } from "fastify";

import { CampaignService, CharacterService, EncounterService, ScenarioService } from "@glantri/database";
import {
  buildScenarioPlayerVisibleParticipants,
  reusableEntityKindSchema,
  scenarioParticipantJoinSourceSchema,
  scenarioParticipantRoleSchema,
  scenarioParticipantStateSchema
} from "@glantri/domain";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import { resolveScenarioWorkspaceAccess } from "./access";
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
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles }
      );

      if (!access) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const participants = await scenarioService.listScenarioParticipants(scenarioId);

      if (access.mode === "player") {
        return {
          participants: buildScenarioPlayerVisibleParticipants({ participants })
        };
      }

      return { participants };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list scenario participants."
      });
    }
  });

  app.get("/scenarios/:scenarioId/my-participant", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles }
      );

      if (!access) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const participants = await scenarioService.listScenarioParticipants(scenarioId);
      const myParticipant = participants.find(
        (p) => p.isActive && p.role === "player_character" && p.controlledByUserId === user.id
      ) ?? null;

      return { participant: myParticipant };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load participant."
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

      if (!canEditCharacterInApi(user)) {
        const character = await characterService.getOwnedCharacter(user.id, characterId);

        if (!character) {
          return reply.code(404).send({
            error: "Character not found."
          });
        }
      }

      if (!isGameMaster) {
        if (scenario.status !== "live") {
          return reply.code(403).send({
            error: "No live scenario is currently available for this character."
          });
        }

        const campaignRoster = await campaignService.listCampaignRosterEntries(campaign.id);
        const characterIsInCampaignRoster = campaignRoster.some(
          (entry) => entry.sourceType === "character" && entry.sourceId === characterId
        );

        if (!characterIsInCampaignRoster) {
          return reply.code(403).send({
            error: "This character is not currently assigned to a campaign."
          });
        }
      }

      const participant = await scenarioService.addCharacterParticipant({
        characterId,
        controlledByUserId: isGameMaster
          ? parseOptionalNullableString(body, "controlledByUserId") ?? user.id
          : user.id,
        displayOrder: parseOptionalInteger(body, "displayOrder"),
        factionId: parseOptionalNullableString(body, "factionId"),
        joinSource:
          body.joinSource == null
            ? "gm_added"
            : scenarioParticipantJoinSourceSchema.parse(body.joinSource),
        role: isGameMaster
          ? body.role == null ? undefined : scenarioParticipantRoleSchema.parse(body.role)
          : "player_character",
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
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles }
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({ error: "Scenario not found." });
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
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles }
      );

      if (!access) {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      if (access.mode === "player") {
        const participant = await scenarioService.getScenarioParticipantById(
          participantId,
          scenarioId
        );

        if (!participant || participant.controlledByUserId !== user.id) {
          return reply.code(403).send({ error: "Access denied." });
        }
      }

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
        const access = await resolveScenarioWorkspaceAccess(
          { campaignService, scenarioService },
          { scenarioId, userId: user.id, userRoles: user.roles }
        );

        if (!access || access.mode !== "gm") {
          return reply.code(404).send({ error: "Scenario not found." });
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
