import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  CampaignService,
  CharacterService,
  EncounterService,
  ScenarioMutationConflictError,
  ScenarioParticipationFrozenError,
  ScenarioService,
} from "@glantri/database";
import {
  attachCanonicalPersistentEffectLifecycles,
  buildPlayerFacingScenarioParticipant,
  isScenarioLiveInteractive,
  buildScenarioPlayerVisibleParticipants,
  mergePlayerSubmittedScenarioParticipantState,
  reusableEntityKindSchema,
  scenarioParticipantJoinSourceSchema,
  scenarioParticipantRoleSchema,
  scenarioParticipantStateSchema,
  type PlayerFacingScenarioParticipant,
} from "@glantri/domain";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import { resolveScenarioWorkspaceAccess } from "./access";
import {
  applyParticipantCombatEffectsChange,
  ParticipantCombatEffectsChangeConflict,
  PARTICIPANT_STATE_CHANGED_MESSAGE,
  parseParticipantCombatEffectsChange,
} from "./participantCombatEffectsChange";
import { canEditCharacterInApi } from "../../lib/characterEditAccess";
import {
  parseBodyObject,
  parseId,
  parseOptionalBoolean,
  parseOptionalInteger,
  parseOptionalNullableString,
  parseOptionalString,
  parseRequiredString,
} from "./parsing";

const characterService = new CharacterService();
const campaignService = new CampaignService();
const encounterService = new EncounterService();
const scenarioService = new ScenarioService();

/**
 * The player response of a participant boundary converted in #502 (privacy hardening, Tier 1). It
 * accepts only the declared player-facing participant, so a stored participant cannot be returned
 * to a player through it.
 */
function playerParticipantResponse(response: {
  participant: PlayerFacingScenarioParticipant | null;
}) {
  return response;
}

/**
 * #851 ruling 22734 ("Press generate first") as scoped by the Product Owner's option (i) on #1001:
 * a humanoid archetype Template — every Template authored on the Templates page — is a thing NPCs
 * are generated from, not itself a combatant. It carries no build, so fielded directly it can
 * neither roll initiative nor be attacked.
 *
 * Only that Template kind is refused. A Template that carries its own build (the seeded Training
 * Bandit, the #666 Templates) and a concrete NPC generated from an archetype are not archetypes and
 * are fielded exactly as before. A generated NPC's snapshot never carries `templateKind`; the
 * `actorClass` check states that independence explicitly rather than relying on it.
 */
const GENERATE_FROM_TEMPLATE_FIRST = "Generate an NPC from this Template first.";

function isUnfieldableArchetypeTemplateSnapshot(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return false;
  }
  const record = snapshot as Record<string, unknown>;
  return (
    record.templateKind === "humanoid_npc_archetype" &&
    record.actorClass !== "campaign_npc" &&
    record.actorClass !== "generated_npc"
  );
}

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
        { scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Scenario not found.",
        });
      }

      const allParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const participants =
        access.mode === "gm"
          ? allParticipants
          : allParticipants.filter(
              (participant) => participant.isActive && participant.controlledByUserId === user.id,
            );

      if (access.mode === "player") {
        return {
          participants: buildScenarioPlayerVisibleParticipants({ participants }),
        };
      }

      return { participants };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list scenario participants.",
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
        { scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Scenario not found.",
        });
      }

      const participants = await scenarioService.listScenarioParticipants(scenarioId);
      const myParticipant =
        participants.find(
          (p) => p.isActive && p.role === "player_character" && p.controlledByUserId === user.id,
        ) ?? null;

      if (access.mode === "player") {
        return playerParticipantResponse({
          participant: myParticipant ? buildPlayerFacingScenarioParticipant(myParticipant) : null,
        });
      }

      return { participant: myParticipant };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load participant.",
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
          error: "Scenario not found.",
        });
      }

      const campaign = await campaignService.getCampaignById(scenario.campaignId);

      if (!campaign) {
        return reply.code(404).send({
          error: "Campaign not found.",
        });
      }

      const body = parseBodyObject(request.body, "Character participant payload");
      const characterId = parseRequiredString(body, "characterId");
      const isGameMaster = user.roles.includes("game_master") || user.roles.includes("admin");

      if (isGameMaster && campaign.gmUserId !== user.id) {
        return reply.code(404).send({
          error: "Scenario not found.",
        });
      }

      if (isGameMaster && !isScenarioLiveInteractive(scenario.status)) {
        return reply.code(400).send({ error: "Scenario is not currently open for live updates." });
      }

      if (!canEditCharacterInApi(user)) {
        const character = await characterService.getOwnedCharacter(user.id, characterId);

        if (!character) {
          return reply.code(404).send({
            error: "Character not found.",
          });
        }
      }

      if (!isGameMaster) {
        if (!isScenarioLiveInteractive(scenario.status)) {
          return reply.code(404).send({
            error: "Scenario not found.",
          });
        }
      }

      const campaignRoster = await campaignService.listCampaignRosterEntries(campaign.id);
      const characterIsInCampaignRoster = campaignRoster.some(
        (entry) => entry.sourceType === "character" && entry.sourceId === characterId,
      );

      if (!characterIsInCampaignRoster) {
        return reply.code(403).send({
          error: "This character is not currently assigned to a campaign.",
        });
      }

      const participant = await scenarioService.addCharacterParticipant({
        characterId,
        controlledByUserId: isGameMaster
          ? (parseOptionalNullableString(body, "controlledByUserId") ?? user.id)
          : user.id,
        displayOrder: parseOptionalInteger(body, "displayOrder"),
        factionId: parseOptionalNullableString(body, "factionId"),
        joinSource:
          body.joinSource == null
            ? "gm_added"
            : scenarioParticipantJoinSourceSchema.parse(body.joinSource),
        role: isGameMaster
          ? body.role == null
            ? undefined
            : scenarioParticipantRoleSchema.parse(body.role)
          : "player_character",
        roleTag: parseOptionalNullableString(body, "roleTag"),
        scenarioId,
        tacticalGroupId: parseOptionalNullableString(body, "tacticalGroupId"),
      });

      if (!isGameMaster) {
        return playerParticipantResponse({
          participant: buildPlayerFacingScenarioParticipant(participant),
        });
      }

      return { participant };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to add character participant.",
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
        { scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      const body = parseBodyObject(request.body, "Entity participant payload");
      const entityId = parseOptionalString(body, "entityId");
      if (entityId) {
        const entity = await campaignService.getReusableEntityById(entityId);

        if (!entity || entity.gmUserId !== user.id) {
          return reply.code(404).send({ error: "Reusable entity not found." });
        }

        const snapshot =
          entity.snapshot && typeof entity.snapshot === "object" && !Array.isArray(entity.snapshot)
            ? (entity.snapshot as Record<string, unknown>)
            : undefined;

        if (isUnfieldableArchetypeTemplateSnapshot(snapshot)) {
          return reply.code(409).send({
            code: "generate_npc_from_template_first",
            error: GENERATE_FROM_TEMPLATE_FIRST,
          });
        }

        if (snapshot?.actorClass === "campaign_npc") {
          if (snapshot.campaignId !== access.campaignId) {
            return reply.code(400).send({ error: "NPC belongs to a different campaign." });
          }

          const roster = await campaignService.listCampaignRosterEntries(access.campaignId);
          const isRosterMember = roster.some(
            (entry) => entry.sourceType === "reusableEntity" && entry.sourceId === entity.id,
          );

          if (!isRosterMember) {
            return reply.code(403).send({ error: "Add this NPC to the campaign roster first." });
          }
        }
      }
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
                snapshot: entityPayload.snapshot,
              };
            })();

      if (!entityId && isUnfieldableArchetypeTemplateSnapshot(entityInput?.snapshot)) {
        return reply
          .code(409)
          .send({ code: "generate_npc_from_template_first", error: GENERATE_FROM_TEMPLATE_FIRST });
      }

      const participant = await scenarioService.addEntityParticipant({
        controlledByUserId: parseOptionalNullableString(body, "controlledByUserId") ?? user.id,
        displayOrder: parseOptionalInteger(body, "displayOrder"),
        entityId,
        entityInput,
        expectedGmUserId: user.id,
        factionId: parseOptionalNullableString(body, "factionId"),
        isTemporary: parseOptionalBoolean(body, "isTemporary"),
        joinSource:
          body.joinSource == null
            ? "gm_added"
            : scenarioParticipantJoinSourceSchema.parse(body.joinSource),
        role: scenarioParticipantRoleSchema.parse(body.role),
        roleTag: parseOptionalNullableString(body, "roleTag"),
        scenarioId,
        tacticalGroupId: parseOptionalNullableString(body, "tacticalGroupId"),
      });

      return { participant };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to add entity participant.",
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

      if (body.combatEffectsChange !== undefined && body.state !== undefined) {
        throw new Error("Send either state or combatEffectsChange, not both.");
      }

      // The GM's Character-screen edit arrives as the change itself (#1126); every other caller
      // still replaces the whole state.
      const submitted =
        body.combatEffectsChange === undefined
          ? { kind: "state" as const, state: scenarioParticipantStateSchema.parse(body.state) }
          : {
              change: parseParticipantCombatEffectsChange(body.combatEffectsChange),
              kind: "combat_effects_change" as const,
            };
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

      if (!isScenarioLiveInteractive(scenario.status)) {
        return reply.code(403).send({ error: "Scenario is not currently open for live updates." });
      }

      if (access.mode === "player" && !isScenarioLiveInteractive(scenario.status)) {
        return reply
          .code(403)
          .send({ error: "Scenario is not currently open for live participant updates." });
      }

      if (submitted.kind === "combat_effects_change") {
        if (access.mode !== "gm") {
          return reply.code(403).send({ error: "Only GM users can edit combat effects." });
        }

        try {
          const participant = await encounterService.updateScenarioParticipantState({
            participantId,
            scenarioId,
            update: (current) =>
              scenarioParticipantStateSchema.parse({
                ...current.state,
                combatEffects: attachCanonicalPersistentEffectLifecycles({
                  combatEffects: applyParticipantCombatEffectsChange({
                    change: submitted.change,
                    combatEffects: current.state.combatEffects,
                  }),
                }),
              }),
          });

          return { participant };
        } catch (error) {
          if (!(error instanceof ParticipantCombatEffectsChangeConflict)) {
            throw error;
          }

          // Nothing was written. The current participant lets the screen refresh in place.
          return reply.code(409).send({
            code: "participant_state_changed",
            error: PARTICIPANT_STATE_CHANGED_MESSAGE,
            participant: await scenarioService.getScenarioParticipantById(
              participantId,
              scenarioId,
            ),
          });
        }
      }

      const submittedState = submitted.state;
      let acceptedState = submittedState;

      if (access.mode === "player") {
        const participant = await scenarioService.getScenarioParticipantById(
          participantId,
          scenarioId,
        );

        if (!participant || participant.controlledByUserId !== user.id) {
          return reply.code(403).send({ error: "Access denied." });
        }

        // The player receives the player-facing state (#502); what it omits is kept from storage.
        const mergedState = mergePlayerSubmittedScenarioParticipantState({
          currentState: scenarioParticipantStateSchema.parse(participant.state),
          submittedState,
        });

        if (!mergedState) {
          return reply.code(403).send({ error: "Only GM users can edit combat effects." });
        }

        acceptedState = mergedState;
      } else if (!(await scenarioService.getScenarioParticipantById(participantId, scenarioId))) {
        // #1140: the GM is authorized for the Scenario in the URL, and only for its participants.
        // A participant of any other Scenario — in another GM's Campaign, or in another Scenario of
        // this Campaign, paused or not — is not found here, so nothing is written or logged.
        return reply.code(404).send({ error: "Scenario participant not found." });
      }

      const nextState = scenarioParticipantStateSchema.parse({
        ...acceptedState,
        combatEffects: attachCanonicalPersistentEffectLifecycles({
          combatEffects: acceptedState.combatEffects,
        }),
      });

      const participant = await encounterService.updateScenarioParticipantState({
        participantId,
        scenarioId,
        state: nextState,
      });

      if (access.mode === "player") {
        return playerParticipantResponse({
          participant: buildPlayerFacingScenarioParticipant(participant),
        });
      }

      return { participant };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update participant state.",
      });
    }
  });

  const reconcileCharacterEquipment = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireAuthenticatedUser(request, reply);
    if (!user) return;

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const participantId = parseId(request.params, "participantId", "Participant id");
      const access = await resolveScenarioWorkspaceAccess(
        { campaignService, scenarioService },
        { scenarioId, userId: user.id, userRoles: user.roles },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({ error: "Scenario not found." });
      }

      const participant = await scenarioService.refreshCharacterParticipantEquipmentSnapshot({
        participantId,
        scenarioId,
      });
      return { participant };
    } catch (error) {
      return reply.code(400).send({
        error:
          error instanceof Error ? error.message : "Unable to reconcile participant equipment.",
      });
    }
  };
  app.post(
    "/scenarios/:scenarioId/participants/:participantId/reconcile-character-equipment",
    reconcileCharacterEquipment,
  );
  app.post(
    "/scenarios/:scenarioId/participants/:participantId/refresh-character-equipment",
    reconcileCharacterEquipment,
  );

  /**
   * Explicitly revoke a participant's control assignment.
   *
   * Deliberately separate from the metadata route below, and deliberately **not** gated on
   * `isScenarioLiveInteractive`. Product Owner ruling on Forgejo #439 keeps control-derived
   * Character read access valid in `completed` and `archived` Scenarios "unless the control
   * relationship is explicitly revoked"; the liveness gate exists to stop *gameplay* edits to
   * a finished Scenario, and withdrawing an authorization is not a gameplay edit.
   *
   * The scope is exactly one column. The route takes no body, and the service writes only
   * `controlledByUserId = null`. No other field of a completed or archived Scenario becomes
   * mutable through this path, the participation record is preserved, and the campaign-GM
   * authorization required is the same one the metadata route already requires.
   */
  app.post(
    "/scenarios/:scenarioId/participants/:participantId/revoke-control",
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
          { scenarioId, userId: user.id, userRoles: user.roles },
        );

        if (!access || access.mode !== "gm") {
          return reply.code(404).send({ error: "Scenario not found." });
        }

        const participant = await scenarioService.revokeScenarioParticipantControl({
          participantId,
          scenarioId,
        });

        return { participant };
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to revoke participant control.",
        });
      }
    },
  );

  app.put("/scenarios/:scenarioId/participants/:participantId/metadata", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const participantId = parseId(request.params, "participantId", "Participant id");
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

      if (!isScenarioLiveInteractive(scenario.status)) {
        return reply.code(400).send({ error: "Scenario is not currently open for live updates." });
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
        tacticalGroupId: parseOptionalNullableString(body, "tacticalGroupId"),
      });

      return { participant };
    } catch (error) {
      // A running Encounter's participant set is frozen (#850), so this is a state conflict rather
      // than a malformed request, and the GM is shown the refusal's own message: it names the
      // combatant, the Encounter and both ways forward. It deliberately does not say "refresh".
      if (error instanceof ScenarioParticipationFrozenError) {
        return reply.code(409).send({ code: error.code, error: error.message });
      }
      // The deactivation boundary runs Serializable against this Scenario's running Encounters, so
      // an Encounter write committing against it is a conflict rather than a bad request. Its
      // bounded retry normally re-decides and the GM gets the frozen refusal above; this is the
      // exhausted case, and the GM is told to try again, which here is true.
      if (error instanceof ScenarioMutationConflictError) {
        return reply.code(409).send({ code: error.code, error: error.message });
      }
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update participant metadata.",
      });
    }
  });
};
