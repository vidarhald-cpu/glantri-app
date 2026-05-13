import type { FastifyPluginAsync } from "fastify";

import { CampaignService, EncounterService, ScenarioService } from "@glantri/database";
import {
  buildRoleplayCalculationPreview,
  encounterSessionSchema,
  isUserAssignedToEncounterMembership,
  normalizeRoleplayState,
  recordRoleplayGmSkillRoll,
  resolveEncounterParticipantByRollParticipantId,
  resolveEncounterParticipantMembership,
} from "@glantri/domain";
import { resolveRoleplaySkillRollModifiers } from "@glantri/rules-engine";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import { parseBodyObject, parseId } from "./parsing";
import { resolveScenarioWorkspaceAccess } from "./access";

const campaignService = new CampaignService();
const encounterService = new EncounterService();
const scenarioService = new ScenarioService();

function parseInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }

  return value;
}

function parseIntegerInRange(value: unknown, label: string, min: number, max: number): number {
  const parsed = parseInteger(value, label);

  if (parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }

  return parsed;
}

function parsePlayerRollBody(body: unknown): {
  pendingRollId: string;
  roll: {
    dieResult: number;
    openEndedD10s: number[];
    rollD20: number;
  };
} {
  const value = parseBodyObject(body, "Player roll payload");
  const pendingRollId = value.pendingRollId;
  const rollValue = value.roll;

  if (typeof pendingRollId !== "string" || pendingRollId.trim().length === 0) {
    throw new Error("pendingRollId is required.");
  }

  if (!rollValue || typeof rollValue !== "object") {
    throw new Error("roll is required.");
  }

  const roll = rollValue as Record<string, unknown>;
  const openEndedD10sValue = roll.openEndedD10s;

  return {
    pendingRollId,
    roll: {
      dieResult: parseInteger(roll.dieResult, "roll.dieResult"),
      openEndedD10s: Array.isArray(openEndedD10sValue)
        ? openEndedD10sValue.map((entry, index) =>
            parseIntegerInRange(entry, `roll.openEndedD10s[${index}]`, 1, 10)
          )
        : [],
      rollD20: parseIntegerInRange(roll.rollD20, "roll.rollD20", 1, 20),
    },
  };
}

export const encounterRoutes: FastifyPluginAsync = async (app) => {
  app.get("/scenarios/:scenarioId/encounters", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles
        }
      );

      if (!access) {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const encounters = await encounterService.listEncountersByScenario(scenarioId);

      return { encounters };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list encounters."
      });
    }
  });

  app.post("/scenarios/:scenarioId/encounters", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const scenarioId = parseId(request.params, "scenarioId", "Scenario id");
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles
        }
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({
          error: "Scenario not found."
        });
      }

      const body = parseBodyObject(request.body, "Encounter payload");
      const encounter = await encounterService.createEncounter({
        createdByUserId: user.id,
        session: encounterSessionSchema.parse(body.session)
      });

      await scenarioService.recordScenarioEvent({
        actorUserId: user.id,
        eventType: "encounter_created",
        payload: {
          encounterId: encounter.id,
          kind: encounter.kind,
          status: encounter.status
        },
        scenarioId,
        summary: `Created ${encounter.kind} encounter ${encounter.title}.`
      });

      return { encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create encounter."
      });
    }
  });

  app.get("/encounters/:encounterId", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found."
        });
      }

      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId: encounter.scenarioId,
          userId: user.id,
          userRoles: user.roles
        }
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found."
        });
      }

      return { encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load encounter."
      });
    }
  });

  app.put("/encounters/:encounterId", async (request, reply) => {
    const user = await requireAdminUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const existingEncounter = await encounterService.getEncounterById(encounterId);

      if (!existingEncounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found."
        });
      }

      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId: existingEncounter.scenarioId,
          userId: user.id,
          userRoles: user.roles
        }
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({
          error: "Encounter not found."
        });
      }

      const body = parseBodyObject(request.body, "Encounter payload");
      const encounterSession = encounterSessionSchema.parse(body.session);
      const encounter = await encounterService.updateEncounter(encounterSession);

      await scenarioService.recordScenarioEvent({
        actorUserId: user.id,
        eventType: "encounter_updated",
        payload: {
          encounterId: encounter.id,
          participantCount: encounter.participants.length,
          status: encounter.status
        },
        scenarioId: existingEncounter.scenarioId,
        summary: `Updated encounter ${encounter.title}.`
      });

      return { encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update encounter."
      });
    }
  });

  app.post("/encounters/:encounterId/player-roll", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found."
        });
      }

      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId: encounter.scenarioId,
          userId: user.id,
          userRoles: user.roles
        }
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found."
        });
      }

      const body = parsePlayerRollBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(encounter.scenarioId);
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const state = normalizeRoleplayState(encounter);
      const pendingRoll = state.pendingSkillRolls.find((roll) => roll.id === body.pendingRollId);

      if (!pendingRoll || pendingRoll.silent) {
        return reply.code(403).send({
          error: "Roll is not available to this player."
        });
      }

      if (
        !isUserAssignedToEncounterMembership({
          encounter,
          scenarioParticipants,
          userId: user.id,
        })
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter."
        });
      }

      const participant = resolveEncounterParticipantByRollParticipantId({
        participantId: pendingRoll.participantId,
        participants: membership.participants,
      });
      const scenarioParticipant = participant?.scenarioParticipantId
        ? scenarioParticipants.find((entry) => entry.id === participant.scenarioParticipantId)
        : undefined;

      if (
        !participant ||
        !scenarioParticipant ||
        scenarioParticipant.controlledByUserId !== user.id ||
        !scenarioParticipant.isActive
      ) {
        return reply.code(403).send({
          error: "Roll is not assigned to this player."
        });
      }

      const modifierPipeline = resolveRoleplaySkillRollModifiers({
        modifiers:
          pendingRoll.otherMod === 0
            ? []
            : [
                {
                  bucket: "other",
                  label: "Other",
                  source: "manual",
                  value: pendingRoll.otherMod,
                },
              ],
        skillTotal: pendingRoll.skillValue ?? 0,
      });
      const preview = buildRoleplayCalculationPreview({
        difficulty: pendingRoll.mode === "difficulty" ? pendingRoll.difficulty : undefined,
        modifierPipeline,
        otherMod: pendingRoll.otherMod,
        roll: body.roll,
        skillLabel: pendingRoll.skillLabel,
        skillValue: pendingRoll.skillValue,
        useDbMod: pendingRoll.useDbMod,
        useGenMod: pendingRoll.useGenMod,
        useObSkillMod: pendingRoll.useObSkillMod,
      });
      const nextEncounter = recordRoleplayGmSkillRoll({
        achievedSuccessLevel: preview.achievedSuccessLevel,
        autoSuccess: preview.autoSuccess,
        calculationText: preview.calculationText,
        dieResult: body.roll.dieResult,
        difficulty: pendingRoll.mode === "difficulty" ? pendingRoll.difficulty : undefined,
        finalTotal: preview.finalTotal,
        fumble: preview.fumble,
        mode: pendingRoll.mode,
        numericSubtotal: preview.numericSubtotal,
        openEndedD10s: body.roll.openEndedD10s,
        otherMod: pendingRoll.otherMod,
        participantId: participant.id,
        partial: preview.partial,
        roll: body.roll,
        rollSetId: pendingRoll.rollSetId,
        session: encounter,
        silent: false,
        skillId: pendingRoll.skillId,
        skillLabel: pendingRoll.skillLabel,
        success: preview.success,
        supportSkillId: pendingRoll.supportSkillId,
        supportSkillLabel: pendingRoll.supportSkillLabel,
        useDbMod: pendingRoll.useDbMod,
        useGenMod: pendingRoll.useGenMod,
        useObSkillMod: pendingRoll.useObSkillMod,
      });
      const savedEncounter = await encounterService.updateEncounter({
        ...nextEncounter,
        updatedAt: new Date().toISOString(),
      });

      return { encounter: savedEncounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to submit player roll."
      });
    }
  });
};
