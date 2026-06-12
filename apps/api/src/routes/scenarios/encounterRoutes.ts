import type { FastifyPluginAsync } from "fastify";

import { CampaignService, EncounterService, ScenarioService } from "@glantri/database";
import {
  buildPlayerSafeRoleplayStateForUser,
  applyCombatActionGeneratedModifiers,
  buildCombatRoundAttackRollResult,
  buildCombatRoundInitiativeResult,
  canPlayerRollCombatInitiative,
  buildRoleplayCalculationPreview,
  canPlayerSubmitCombatDeclaration,
  clearCombatRoundStep,
  clearCurrentCombatRoundStepAndRewind,
  combatRoundPhaseSchema,
  combatRoundStepSchema,
  encounterSessionSchema,
  getCombatRoundInitiativePhaseForStep,
  getCombatRoundAttackResultById,
  getPlayerCombatCurrentRollAction,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  initializeCombatRoundState,
  isUserAssignedToEncounterMembership,
  normalizeRoleplayState,
  recordCombatRoundCriticalRoll,
  recordCombatRoundDeclaration,
  recordCombatRoundHitLocationRoll,
  recordCombatRoundInitiative,
  recordCombatRoundAttackResult,
  recordCombatRoundParryResult,
  recordCombatRoundParticipantStepReview,
  removeCombatRoundCommittedDamageEffects,
  resolveEncounterParticipantByRollParticipantId,
  resolveEncounterParticipantMembership,
  rollOpenEndedCombatToHitD20,
  rollOpenEndedD20,
  rollOpenEndedD6,
  combatRoundPhaseContextsSchema,
  scenarioParticipantCombatContextSchema,
  setCombatRoundSelection,
  validateCombatDeclarationTargets,
} from "@glantri/domain";
import type { ScenarioParticipant } from "@glantri/domain";
import {
  recordRoleplayGmSkillRoll,
  resolveCombatParry,
  resolveRoleplaySkillRollModifiers,
} from "@glantri/rules-engine";

import { requireAdminUser, requireAuthenticatedUser } from "../../lib/sessionAuth";
import { parseBodyObject, parseId, parseOptionalString } from "./parsing";
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

function computeDieResult(rollD20: number, openEndedD10s: number[]): number {
  if (openEndedD10s.length === 0) return rollD20;
  const direction = rollD20 === 20 ? 1 : rollD20 === 1 ? -1 : 0;
  return rollD20 + direction * openEndedD10s.reduce((sum, d10) => sum + d10, 0);
}

function parseRollFields(
  roll: Record<string, unknown>,
  prefix: string,
): { dieResult: number; openEndedD10s: number[]; rollD20: number } {
  const rollD20 = parseIntegerInRange(roll.rollD20, `${prefix}.rollD20`, 1, 20);
  const openEndedD10sValue = roll.openEndedD10s;
  const openEndedD10s = Array.isArray(openEndedD10sValue)
    ? openEndedD10sValue.map((entry, index) =>
        parseIntegerInRange(entry, `${prefix}.openEndedD10s[${index}]`, 1, 10),
      )
    : [];
  return { dieResult: computeDieResult(rollD20, openEndedD10s), openEndedD10s, rollD20 };
}

function parsePlayerRollBody(body: unknown): {
  pendingRollId: string;
  roll: {
    dieResult: number;
    openEndedD10s: number[];
    rollD20: number;
  };
  supportRoll?: {
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

  const supportRollValue = value.supportRoll;
  const supportRoll =
    supportRollValue && typeof supportRollValue === "object"
      ? (supportRollValue as Record<string, unknown>)
      : undefined;

  return {
    pendingRollId,
    roll: parseRollFields(rollValue as Record<string, unknown>, "roll"),
    supportRoll: supportRoll ? parseRollFields(supportRoll, "supportRoll") : undefined,
  };
}

function parseOptionalDeclarationString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function parseCombatDeclarationBody(body: unknown): {
  actionId?: string;
  additionalActionNotes?: string;
  combatContext: ReturnType<typeof scenarioParticipantCombatContextSchema.parse>;
  movementId?: string;
  phaseContexts?: ReturnType<typeof combatRoundPhaseContextsSchema.parse>;
  scenarioParticipantId: string;
  secondaryActionId?: string;
} {
  const value = parseBodyObject(body, "Combat declaration payload");
  const scenarioParticipantId = value.scenarioParticipantId;

  if (typeof scenarioParticipantId !== "string" || scenarioParticipantId.trim().length === 0) {
    throw new Error("scenarioParticipantId is required.");
  }

  return {
    actionId: parseOptionalDeclarationString(value.actionId),
    additionalActionNotes:
      typeof value.additionalActionNotes === "string" ? value.additionalActionNotes : undefined,
    combatContext: scenarioParticipantCombatContextSchema.parse(value.combatContext ?? {}),
    movementId: parseOptionalDeclarationString(value.movementId),
    phaseContexts:
      value.phaseContexts === undefined
        ? undefined
        : combatRoundPhaseContextsSchema.parse(value.phaseContexts),
    scenarioParticipantId,
    secondaryActionId: parseOptionalDeclarationString(value.secondaryActionId),
  };
}

function parseParticipantCommandBody(
  body: unknown,
  label: string,
): {
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, label);
  const scenarioParticipantId = value.scenarioParticipantId;

  if (typeof scenarioParticipantId !== "string" || scenarioParticipantId.trim().length === 0) {
    throw new Error("scenarioParticipantId is required.");
  }

  return { scenarioParticipantId };
}

function parseCombatInitiativeBody(body: unknown): {
  initiativeBase?: number;
  initiativeModifierAdjustment?: number;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Combat initiative payload");
  const parsed = parseParticipantCommandBody(value, "Combat initiative payload");
  const initiativeBase = value.initiativeBase;
  const initiativeModifierAdjustment = value.initiativeModifierAdjustment;

  if (initiativeBase !== undefined && !Number.isInteger(initiativeBase)) {
    throw new Error("initiativeBase must be an integer.");
  }

  if (
    initiativeModifierAdjustment !== undefined &&
    !Number.isInteger(initiativeModifierAdjustment)
  ) {
    throw new Error("initiativeModifierAdjustment must be an integer.");
  }

  return {
    ...parsed,
    initiativeBase: typeof initiativeBase === "number" ? initiativeBase : undefined,
    initiativeModifierAdjustment:
      typeof initiativeModifierAdjustment === "number" ? initiativeModifierAdjustment : undefined,
  };
}

function parseOptionalInteger(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseInteger(value, label);
}

function parseNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function parseCombatAttackBody(body: unknown): {
  actionId?: string;
  defenderDb?: number;
  defenderScenarioParticipantId: string;
  ob?: number;
  phase: "phase1" | "phase2";
  scenarioParticipantId: string;
  weaponCriticalCode?: string;
  weaponDamageClass?: string;
  weaponName?: string;
} {
  const value = parseBodyObject(body, "Combat attack payload");
  const parsed = parseParticipantCommandBody(value, "Combat attack payload");
  const defenderScenarioParticipantId = parseNonEmptyString(
    value.defenderScenarioParticipantId,
    "defenderScenarioParticipantId",
  );
  const phase = combatRoundPhaseSchema.parse(value.phase);
  const actionId =
    typeof value.actionId === "string" && value.actionId.trim().length > 0
      ? value.actionId
      : undefined;
  const weaponName =
    typeof value.weaponName === "string" && value.weaponName.trim().length > 0
      ? value.weaponName
      : undefined;
  const weaponCriticalCode =
    typeof value.weaponCriticalCode === "string" && value.weaponCriticalCode.trim().length > 0
      ? value.weaponCriticalCode
      : undefined;
  const weaponDamageClass =
    typeof value.weaponDamageClass === "string" && value.weaponDamageClass.trim().length > 0
      ? value.weaponDamageClass
      : undefined;

  return {
    ...parsed,
    actionId,
    defenderDb: parseOptionalInteger(value.defenderDb, "defenderDb"),
    defenderScenarioParticipantId,
    ob: parseOptionalInteger(value.ob, "ob"),
    phase,
    weaponCriticalCode,
    weaponDamageClass,
    weaponName,
  };
}

function parseOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function parseCombatParryModifierBreakdown(value: unknown): Array<{ label: string; value: number }> {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("modifierBreakdown must be an array.");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`modifierBreakdown[${index}] must be an object.`);
    }

    const candidate = entry as Record<string, unknown>;

    return {
      label: parseNonEmptyString(candidate.label, `modifierBreakdown[${index}].label`),
      value: parseInteger(candidate.value, `modifierBreakdown[${index}].value`),
    };
  });
}

function parseCombatParryBody(body: unknown): {
  attackResultId: string;
  mainHandParryScore?: number;
  modifierBreakdown: Array<{ label: string; value: number }>;
  offHandParryScore?: number;
  parryBase: number;
  parrySourceLabel?: string;
  scenarioParticipantId: string;
  usedMainHand?: boolean;
  usedOffHand?: boolean;
} {
  const value = parseBodyObject(body, "Combat parry payload");
  const parsed = parseParticipantCommandBody(value, "Combat parry payload");
  const attackResultId = parseNonEmptyString(value.attackResultId, "attackResultId");
  const parrySourceLabel =
    typeof value.parrySourceLabel === "string" && value.parrySourceLabel.trim().length > 0
      ? value.parrySourceLabel
      : undefined;

  return {
    ...parsed,
    attackResultId,
    mainHandParryScore: parseOptionalInteger(value.mainHandParryScore, "mainHandParryScore"),
    modifierBreakdown: parseCombatParryModifierBreakdown(value.modifierBreakdown),
    offHandParryScore: parseOptionalInteger(value.offHandParryScore, "offHandParryScore"),
    parryBase: parseInteger(value.parryBase, "parryBase"),
    parrySourceLabel,
    usedMainHand: parseOptionalBoolean(value.usedMainHand, "usedMainHand"),
    usedOffHand: parseOptionalBoolean(value.usedOffHand, "usedOffHand"),
  };
}

function parseCombatAttackerPrivilegedRollBody(body: unknown): {
  attackResultId: string;
  scenarioParticipantId: string;
} {
  const value = parseBodyObject(body, "Combat attacker roll payload");
  const parsed = parseParticipantCommandBody(value, "Combat attacker roll payload");
  const attackResultId = value.attackResultId;

  if (typeof attackResultId !== "string" || attackResultId.trim().length === 0) {
    throw new Error("attackResultId is required.");
  }

  return {
    ...parsed,
    attackResultId,
  };
}

function clearScenarioParticipantCombatDeclaration(
  participant: ScenarioParticipant,
): ScenarioParticipant["state"] {
  return {
    ...participant.state,
    combat: {
      ...participant.state.combat,
      combatContext: scenarioParticipantCombatContextSchema.parse({}),
      declarationSubmittedAt: undefined,
      declarationSubmittedByUserId: undefined,
      lastDeclaredActionId: undefined,
      lastDeclaredEncounterId: undefined,
      lastDeclaredMovementId: undefined,
      lastDeclaredRoundNumber: undefined,
      lastDeclaredSecondaryActionId: undefined,
      lastDeclarationNotes: undefined,
    },
  };
}

function parseCombatSummaryInteger(value: string | undefined, label: string): number | undefined {
  if (!value || value === "—" || value === "incomplete") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer.`);
  }

  return parsed;
}

function preservePlayerCombatModifierBuckets(input: {
  existingContext: ReturnType<typeof scenarioParticipantCombatContextSchema.parse>;
  requestedContext: ReturnType<typeof scenarioParticipantCombatContextSchema.parse>;
}): ReturnType<typeof scenarioParticipantCombatContextSchema.parse> {
  return {
    ...input.requestedContext,
    modifierBuckets: input.existingContext.modifierBuckets,
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
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Scenario not found.",
        });
      }

      const encounters = await encounterService.listEncountersByScenario(scenarioId);

      if (access.mode === "player") {
        const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);

        return {
          encounters: encounters.map((enc) => ({
            ...enc,
            roleplayState: enc.roleplayState
              ? buildPlayerSafeRoleplayStateForUser({
                  encounter: enc,
                  scenarioParticipants,
                  userId: user.id,
                })
              : undefined,
          })),
        };
      }

      return { encounters };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to list encounters.",
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
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({
          error: "Scenario not found.",
        });
      }

      const body = parseBodyObject(request.body, "Encounter payload");
      const encounterSession = encounterSessionSchema.parse(body.session);
      const encounter = await encounterService.createEncounter({
        campaignId: access.campaignId,
        createdByUserId: user.id,
        scenarioId,
        session: encounterSession,
      });

      await scenarioService.recordScenarioEvent({
        actorUserId: user.id,
        eventType: "encounter_created",
        payload: {
          encounterId: encounter.id,
          kind: encounter.kind,
          status: encounter.status,
        },
        scenarioId,
        summary: `Created ${encounter.kind} encounter ${encounter.title}.`,
      });

      return { encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to create encounter.",
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
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      if (access.mode === "player") {
        const scenarioParticipants = await scenarioService.listScenarioParticipants(
          encounter.scenarioId,
        );

        return {
          encounter: {
            ...encounter,
            roleplayState: encounter.roleplayState
              ? buildPlayerSafeRoleplayStateForUser({
                  encounter,
                  scenarioParticipants,
                  userId: user.id,
                })
              : undefined,
          },
        };
      }

      return { encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to load encounter.",
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
          error: "Encounter not found.",
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
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseBodyObject(request.body, "Encounter payload");
      const encounterSession = encounterSessionSchema.parse(body.session);
      const encounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId: existingEncounter.scenarioId,
        session: encounterSession,
      });

      await scenarioService.recordScenarioEvent({
        actorUserId: user.id,
        eventType: "encounter_updated",
        payload: {
          encounterId: encounter.id,
          participantCount: encounter.participants.length,
          status: encounter.status,
        },
        scenarioId: existingEncounter.scenarioId,
        summary: `Updated encounter ${encounter.title}.`,
      });

      return { encounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to update encounter.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-declaration", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatDeclarationBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      const gmAuthorizedOperation = access.mode === "gm";
      const roundState = initializeCombatRoundState({ encounter });
      const existingCombatContext = scenarioParticipantCombatContextSchema.parse(
        scenarioParticipant.state.combat.combatContext ?? {},
      );
      const submittedCombatContext = applyCombatActionGeneratedModifiers({
        actionId: body.actionId,
        combatContext: gmAuthorizedOperation
          ? body.combatContext
          : preservePlayerCombatModifierBuckets({
              existingContext: existingCombatContext,
              requestedContext: body.combatContext,
            }),
      });
      const submittedPhaseContexts = body.phaseContexts
        ? {
            phase1: body.phaseContexts.phase1
              ? gmAuthorizedOperation
                ? body.phaseContexts.phase1
                : preservePlayerCombatModifierBuckets({
                    existingContext: existingCombatContext,
                    requestedContext: body.phaseContexts.phase1,
                  })
              : undefined,
            phase2: body.phaseContexts.phase2
              ? gmAuthorizedOperation
                ? body.phaseContexts.phase2
                : preservePlayerCombatModifierBuckets({
                    existingContext: existingCombatContext,
                    requestedContext: body.phaseContexts.phase2,
                  })
              : undefined,
          }
        : undefined;

      if (!gmAuthorizedOperation) {
        if (
          scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          })
        ) {
          return reply.code(403).send({
            error: "Player is not assigned to this encounter participant.",
          });
        }

        if (
          !canPlayerSubmitCombatDeclaration({
            participantId: encounterParticipant.id,
            state: roundState,
          })
        ) {
          return reply.code(409).send({
            error: "Declaration is closed for this round.",
          });
        }
      }

      const targetValidation = validateCombatDeclarationTargets({
        actionId: body.actionId,
        phaseContexts: submittedPhaseContexts,
        secondaryActionId: body.secondaryActionId,
      });

      if (!targetValidation.valid) {
        return reply.code(400).send({
          error: targetValidation.message ?? "Select a target for each attack phase.",
        });
      }

      const submittedAt = new Date().toISOString();
      const participant = await encounterService.updateScenarioParticipantState({
        participantId: scenarioParticipant.id,
        scenarioId: encounter.scenarioId,
        state: {
          ...scenarioParticipant.state,
          combat: {
            ...scenarioParticipant.state.combat,
            combatContext: submittedCombatContext,
            declarationSubmittedAt: submittedAt,
            declarationSubmittedByUserId: user.id,
            lastDeclaredActionId: body.actionId,
            lastDeclaredEncounterId: encounter.id,
            lastDeclaredMovementId: body.movementId,
            lastDeclaredRoundNumber: roundState.roundNumber,
            lastDeclaredSecondaryActionId: body.secondaryActionId,
            lastDeclarationNotes: body.additionalActionNotes,
          },
        },
      });
      const declaredRoundState = recordCombatRoundDeclaration({
        command:
          roundState.currentStep === "select_actions"
            ? {
                createdAt: submittedAt,
                createdByUserId: user.id,
              }
            : undefined,
        declaration: {
          actionId: body.actionId,
          additionalActionNotes: body.additionalActionNotes,
          combatContext: submittedCombatContext,
          movementId: body.movementId,
          phaseContexts: submittedPhaseContexts,
          roundNumber: roundState.roundNumber,
          secondaryActionId: body.secondaryActionId,
          submittedAt,
          submittedByUserId: user.id,
        },
        participantId: encounterParticipant.id,
        state: roundState,
        submittedBy: gmAuthorizedOperation ? "gm" : "player",
      });
      const nextRoundState =
        gmAuthorizedOperation &&
        roundState.currentStep !== "initiative_phase_1" &&
        roundState.currentStep !== "initiative_phase_2"
          ? recordCombatRoundParticipantStepReview({
              command:
                roundState.currentStep === "review_action_modifiers" ||
                roundState.currentStep === "review_phase_2_modifiers"
                  ? {
                      createdAt: submittedAt,
                      createdByUserId: user.id,
                    }
                  : undefined,
              participantId: encounterParticipant.id,
              state: declaredRoundState,
              step: roundState.currentStep,
              submittedBy: "gm",
            })
          : declaredRoundState;
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return { encounter: savedEncounter, participant };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to save combat declaration.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-initiative", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatInitiativeBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      const gmAuthorizedOperation = access.mode === "gm";
      const roundState = initializeCombatRoundState({ encounter });
      const phase = getCombatRoundInitiativePhaseForStep(roundState.currentStep);

      if (
        !phase ||
        (roundState.currentStep !== "initiative_phase_1" &&
          roundState.currentStep !== "initiative_phase_2")
      ) {
        return reply.code(409).send({
          error: "Initiative is not open for this step.",
        });
      }

      if (!gmAuthorizedOperation) {
        if (
          scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          })
        ) {
          return reply.code(403).send({
            error: "Player is not assigned to this encounter participant.",
          });
        }

        if (
          !canPlayerRollCombatInitiative({
            participantId: encounterParticipant.id,
            phase,
            state: roundState,
          })
        ) {
          return reply.code(409).send({
            error: "Initiative is closed for this step.",
          });
        }
      }

      const initiativeRoll = rollOpenEndedD6();
      const rolledInitiative = buildCombatRoundInitiativeResult({
        baseInitiative: body.initiativeBase,
        modifierAdjustment: body.initiativeModifierAdjustment,
        roll: initiativeRoll,
      });
      const submittedAt = new Date().toISOString();
      const nextRoundState = recordCombatRoundInitiative({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        initiative: rolledInitiative,
        participantId: encounterParticipant.id,
        phase,
        state: roundState,
        submittedBy: gmAuthorizedOperation ? "gm" : "player",
      });
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return { encounter: savedEncounter, initiative: rolledInitiative };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll combat initiative.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/roll-attack", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatAttackBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const defenderScenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.defenderScenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;
      const defenderEncounterParticipant = defenderScenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === defenderScenarioParticipant.id ||
              participant.id === defenderScenarioParticipant.id ||
              (defenderScenarioParticipant.characterId &&
                participant.characterId === defenderScenarioParticipant.characterId),
          )
        : undefined;

      if (
        !scenarioParticipant ||
        !scenarioParticipant.isActive ||
        !encounterParticipant ||
        !defenderScenarioParticipant ||
        !defenderScenarioParticipant.isActive ||
        !defenderEncounterParticipant
      ) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      if (
        access.mode !== "gm" &&
        (scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }))
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter participant.",
        });
      }

      const roundState = initializeCombatRoundState({ encounter });
      const existingAttackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: encounterParticipant.id,
        phase: body.phase,
        state: roundState,
      });

      if (existingAttackResult) {
        return reply.code(409).send({
          error: "Attack already rolled for this participant and phase.",
        });
      }

      const currentRollAction = getPlayerCombatCurrentRollAction({
        participantId: encounterParticipant.id,
        state: roundState,
      });

      if (currentRollAction?.kind !== "attack" || currentRollAction.phase !== body.phase) {
        return reply.code(409).send({
          error: "Attack is not open for this participant.",
        });
      }

      const attackerRoundParticipant = roundState.participants.find(
        (participant) => participant.participantId === encounterParticipant.id,
      );
      const declaredTargetId =
        attackerRoundParticipant?.declaration?.phaseContexts?.[body.phase]?.targetParticipantId;

      if (
        declaredTargetId &&
        declaredTargetId !== defenderScenarioParticipant.id &&
        declaredTargetId !== defenderEncounterParticipant.id
      ) {
        return reply.code(409).send({
          error: "Selected defender does not match the declared attack target.",
        });
      }

      const latestAttackerSnapshot = [...roundState.stepSnapshots]
        .reverse()
        .find(
          (snapshot) =>
            snapshot.roundNumber === roundState.roundNumber &&
            snapshot.participantId === encounterParticipant.id &&
            snapshot.phase === body.phase &&
            snapshot.attackSummary,
        );
      const latestDefenderSnapshot = [...roundState.stepSnapshots]
        .reverse()
        .find(
          (snapshot) =>
            snapshot.roundNumber === roundState.roundNumber &&
            snapshot.participantId === defenderEncounterParticipant.id &&
            snapshot.phase === body.phase &&
            snapshot.defenseSummary,
        );
      const ob =
        parseCombatSummaryInteger(latestAttackerSnapshot?.attackSummary?.ob, "Attacker OB") ??
        body.ob;
      const weaponName = latestAttackerSnapshot?.attackSummary?.weaponName ?? body.weaponName;
      const defenderDb =
        parseCombatSummaryInteger(latestDefenderSnapshot?.defenseSummary?.db, "Defender DB") ??
        body.defenderDb;

      if (ob === undefined || !weaponName || defenderDb === undefined) {
        return reply.code(409).send({
          error: "Attack or defender combat summary is not available.",
        });
      }

      const submittedAt = new Date().toISOString();
      const roll = rollOpenEndedCombatToHitD20();
      const attackResult = buildCombatRoundAttackRollResult({
        actionId:
          body.actionId ??
          attackerRoundParticipant?.declaration?.actionId ??
          `${body.phase}_attack`,
        attackerParticipantId: encounterParticipant.id,
        defenderDb,
        defenderParticipantId: defenderEncounterParticipant.id,
        ob,
        openEndedD10s: roll.openEndedD10s,
        phase: body.phase,
        rollD20: roll.rollD20,
        rollTotal: roll.rollTotal,
        rolledAt: submittedAt,
        rolledByUserId: user.id,
        weaponCriticalCode: body.weaponCriticalCode,
        weaponDamageClass: body.weaponDamageClass,
        weaponName,
      });
      const nextRoundState = recordCombatRoundAttackResult({
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        participantId: encounterParticipant.id,
        result: attackResult,
        state: roundState,
        submittedBy: access.mode === "gm" ? "gm" : "player",
      });
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return { attackResult, encounter: savedEncounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll combat attack.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/roll-parry", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatParryBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      if (
        access.mode !== "gm" &&
        (scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }))
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter participant.",
        });
      }

      const roundState = initializeCombatRoundState({ encounter });
      const currentRollAction = getPlayerCombatCurrentRollAction({
        participantId: encounterParticipant.id,
        state: roundState,
      });

      if (
        currentRollAction?.kind !== "parry" ||
        currentRollAction.attackResultId !== body.attackResultId
      ) {
        return reply.code(409).send({
          error: "Parry is not open for this participant.",
        });
      }

      const attackResult = getCombatRoundAttackResultById({
        attackResultId: body.attackResultId,
        state: roundState,
      });

      if (!attackResult) {
        return reply.code(404).send({
          error: "Attack result not found.",
        });
      }

      const submittedAt = new Date().toISOString();
      const roll = rollOpenEndedD20();
      const parry = resolveCombatParry({
        parryBase: body.parryBase,
        rawModifiers: body.modifierBreakdown,
        rollTotal: roll.dieResult,
      });
      const parryResolution = {
        combinedParryScore: parry.parryBase,
        mainHandParryScore: body.mainHandParryScore,
        modifiedParryBeforeRoll: parry.parryBase + parry.modifierAdjustment,
        modifierAdjustment: parry.modifierAdjustment,
        modifierBreakdown: parry.rawModifiers.map((modifier) => ({ ...modifier })),
        notes:
          "Direction, location coverage, and multi-opponent source allocation are deferred in this first parry slice.",
        offHandParryScore: body.offHandParryScore,
        openEndedD10s: roll.openEndedD10s,
        parrySourceLabel: body.parrySourceLabel,
        rawModifierTotal: parry.rawModifierTotal,
        resultLabel: parry.success ? "Parry successful" : "Parry failed",
        rollD20: roll.rollD20,
        rollTotal: roll.dieResult,
        status: "resolved" as const,
        success: parry.success,
        targetNumber: parry.targetNumber,
        total: parry.total,
        usedMainHand: body.usedMainHand,
        usedOffHand: body.usedOffHand,
      };
      const nextRoundState = recordCombatRoundParryResult({
        attackResult,
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        parryResolution,
        state: roundState,
        submittedBy: access.mode === "gm" ? "gm" : "player",
        updatedAt: submittedAt,
      });
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return { encounter: savedEncounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll combat parry.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/roll-hit-location", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatAttackerPrivilegedRollBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      const roundState = initializeCombatRoundState({ encounter });
      const attackResult = getCombatRoundAttackResultById({
        attackResultId: body.attackResultId,
        state: roundState,
      });

      if (!attackResult) {
        return reply.code(404).send({
          error: "Attack result not found.",
        });
      }

      if (attackResult.attackerParticipantId !== encounterParticipant.id) {
        return reply.code(403).send({
          error: "Only the attacking participant can roll hit location.",
        });
      }

      const currentRollAction = getPlayerCombatCurrentRollAction({
        participantId: encounterParticipant.id,
        state: roundState,
      });

      if (
        currentRollAction?.kind !== "hit_location" ||
        currentRollAction.attackResultId !== body.attackResultId
      ) {
        return reply.code(409).send({
          error: "Hit location is not open for this attack.",
        });
      }

      if (
        access.mode !== "gm" &&
        (scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }))
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter participant.",
        });
      }

      const submittedAt = new Date().toISOString();
      const attackerRoundParticipant = roundState.participants.find(
        (participant) => participant.participantId === attackResult.attackerParticipantId,
      );
      const nextRoundState = recordCombatRoundHitLocationRoll({
        attackResult,
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        rolledByParticipantId: encounterParticipant.id,
        state: roundState,
        submittedBy: access.mode === "gm" ? "gm" : "player",
        targetLocation:
          attackerRoundParticipant?.declaration?.phaseContexts?.[attackResult.phase]
            ?.targetLocation,
        updatedAt: submittedAt,
      });
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return { encounter: savedEncounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll hit location.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/roll-critical", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parseCombatAttackerPrivilegedRollBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const scenarioParticipant = scenarioParticipants.find(
        (participant) => participant.id === body.scenarioParticipantId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const encounterParticipant = scenarioParticipant
        ? membership.participants.find(
            (participant) =>
              participant.scenarioParticipantId === scenarioParticipant.id ||
              participant.id === scenarioParticipant.id ||
              (scenarioParticipant.characterId &&
                participant.characterId === scenarioParticipant.characterId),
          )
        : undefined;

      if (!scenarioParticipant || !scenarioParticipant.isActive || !encounterParticipant) {
        return reply.code(403).send({
          error: "Participant is not assigned to this encounter.",
        });
      }

      const roundState = initializeCombatRoundState({ encounter });
      const attackResult = getCombatRoundAttackResultById({
        attackResultId: body.attackResultId,
        state: roundState,
      });

      if (!attackResult) {
        return reply.code(404).send({
          error: "Attack result not found.",
        });
      }

      if (attackResult.attackerParticipantId !== encounterParticipant.id) {
        return reply.code(403).send({
          error: "Only the attacking participant can roll the critical die.",
        });
      }

      const currentRollAction = getPlayerCombatCurrentRollAction({
        participantId: encounterParticipant.id,
        state: roundState,
      });

      if (
        currentRollAction?.kind !== "critical" ||
        currentRollAction.attackResultId !== body.attackResultId
      ) {
        return reply.code(409).send({
          error: "Critical roll is not open for this attack.",
        });
      }

      if (
        access.mode !== "gm" &&
        (scenarioParticipant.controlledByUserId !== user.id ||
          !isUserAssignedToEncounterMembership({
            encounter,
            scenarioParticipants,
            userId: user.id,
          }))
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter participant.",
        });
      }

      const submittedAt = new Date().toISOString();
      const nextRoundState = recordCombatRoundCriticalRoll({
        attackResult,
        command: {
          createdAt: submittedAt,
          createdByUserId: user.id,
        },
        rolledByParticipantId: encounterParticipant.id,
        state: roundState,
        submittedBy: access.mode === "gm" ? "gm" : "player",
        updatedAt: submittedAt,
      });
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });

      return { encounter: savedEncounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to roll critical.",
      });
    }
  });

  app.post("/encounters/:encounterId/combat-round/clear-current-step", async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply);

    if (!user) {
      return;
    }

    try {
      const encounterId = parseId(request.params, "encounterId", "Encounter id");
      const encounter = await encounterService.getEncounterById(encounterId);

      if (!encounter?.scenarioId) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const scenarioId = encounter.scenarioId;
      const access = await resolveScenarioWorkspaceAccess(
        {
          campaignService,
          scenarioService,
        },
        {
          scenarioId,
          userId: user.id,
          userRoles: user.roles,
        },
      );

      if (!access || access.mode !== "gm") {
        return reply.code(403).send({
          error: "Only GM users can clear combat round steps.",
        });
      }

      const scenarioParticipants = await scenarioService.listScenarioParticipants(scenarioId);
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const body =
        request.body && typeof request.body === "object"
          ? (request.body as Record<string, unknown>)
          : {};
      const selectedParticipantId = parseOptionalString(body, "participantId");
      const selectedStepValue = parseOptionalString(body, "step");
      const selectedStep = selectedStepValue
        ? combatRoundStepSchema.parse(selectedStepValue)
        : undefined;
      const roundState = initializeCombatRoundState({ encounter });
      const stateForClear =
        selectedParticipantId && selectedStep
          ? setCombatRoundSelection({
              participantId: selectedParticipantId,
              state: roundState,
              step: selectedStep,
            })
          : roundState;
      const clearStep = selectedStep ?? stateForClear.currentStep;
      const clearsDeclarationStep = clearStep === "select_actions";
      const nextRoundState =
        selectedParticipantId && selectedStep
          ? clearCombatRoundStep({
              state: stateForClear,
              step: selectedStep,
            })
          : clearCurrentCombatRoundStepAndRewind(roundState);
      const removedDeclareCommandParticipantIds = new Set(
        roundState.commands
          .filter(
            (command) =>
              command.roundNumber === roundState.roundNumber &&
              command.type === "declare_action" &&
              !nextRoundState.commands.some(
                (remainingCommand) => remainingCommand.id === command.id,
              ),
          )
          .map((command) => command.participantId),
      );
      const removedCommittedDamageCommands = roundState.commands.filter(
        (command) =>
          command.roundNumber === roundState.roundNumber &&
          command.type === "commit_phase_damage" &&
          !nextRoundState.commands.some((remainingCommand) => remainingCommand.id === command.id),
      );
      const declarationClearEncounterParticipantIds = new Set<string>();

      if (clearsDeclarationStep) {
        if (selectedParticipantId) {
          declarationClearEncounterParticipantIds.add(selectedParticipantId);
        } else {
          for (const participant of membership.participants) {
            declarationClearEncounterParticipantIds.add(participant.id);
          }
        }
      }

      for (const participantId of removedDeclareCommandParticipantIds) {
        declarationClearEncounterParticipantIds.add(participantId);
      }

      const submittedAt = new Date().toISOString();
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: access.campaignId,
        encounterId,
        scenarioId,
        session: {
          ...encounter,
          combatRoundState: nextRoundState,
          currentRound: nextRoundState.roundNumber,
          updatedAt: submittedAt,
        },
      });
      const updatedParticipants =
        declarationClearEncounterParticipantIds.size > 0 ||
        removedCommittedDamageCommands.length > 0
          ? await Promise.all(
              scenarioParticipants
                .map((participant) => {
                  const encounterParticipant = membership.participants.find(
                    (entry) => entry.scenarioParticipantId === participant.id,
                  );

                  if (!encounterParticipant) {
                    return undefined;
                  }

                  let nextState = participant.state;

                  if (declarationClearEncounterParticipantIds.has(encounterParticipant.id)) {
                    nextState = clearScenarioParticipantCombatDeclaration({
                      ...participant,
                      state: nextState,
                    });
                  }

                  for (const command of removedCommittedDamageCommands) {
                    if (command.participantId !== encounterParticipant.id) {
                      continue;
                    }

                    nextState = {
                      ...nextState,
                      combatEffects: removeCombatRoundCommittedDamageEffects({
                        combatEffects: nextState.combatEffects,
                        command,
                      }),
                    };
                  }

                  return nextState === participant.state
                    ? undefined
                    : encounterService.updateScenarioParticipantState({
                        participantId: participant.id,
                        scenarioId,
                        state: nextState,
                      });
                })
                .filter((update): update is Promise<ScenarioParticipant> => Boolean(update)),
            )
          : [];

      return { encounter: savedEncounter, participants: updatedParticipants };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to clear combat round step.",
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
          error: "Encounter not found.",
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
          userRoles: user.roles,
        },
      );

      if (!access) {
        return reply.code(404).send({
          error: "Encounter not found.",
        });
      }

      const body = parsePlayerRollBody(request.body);
      const scenarioParticipants = await scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants,
      });
      const state = normalizeRoleplayState(encounter);
      const pendingRoll = state.pendingSkillRolls.find((roll) => roll.id === body.pendingRollId);

      if (!pendingRoll || pendingRoll.silent) {
        return reply.code(403).send({
          error: "Roll is not available to this player.",
        });
      }

      const pendingRollSide =
        pendingRoll.side ?? (pendingRoll.mode === "opposed" ? "actor" : undefined);
      const existingResult = state.actionLog.find(
        (entry) =>
          entry.type === "gm_skill_roll" &&
          !entry.silent &&
          ((entry.pendingRollId && entry.pendingRollId === pendingRoll.id) ||
            (pendingRoll.rollSetId &&
              entry.rollSetId === pendingRoll.rollSetId &&
              (pendingRollSide ? entry.side === pendingRollSide : true) &&
              entry.participantId === pendingRoll.participantId &&
              entry.skillId === pendingRoll.skillId)),
      );

      if (existingResult) {
        return reply.code(409).send({
          error: "Roll has already been submitted.",
        });
      }

      const gmAuthorizedOperation = access.mode === "gm";

      if (
        !gmAuthorizedOperation &&
        !isUserAssignedToEncounterMembership({
          encounter,
          scenarioParticipants,
          userId: user.id,
        })
      ) {
        return reply.code(403).send({
          error: "Player is not assigned to this encounter.",
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
        (!gmAuthorizedOperation && scenarioParticipant.controlledByUserId !== user.id) ||
        !scenarioParticipant.isActive
      ) {
        return reply.code(403).send({
          error: "Roll is not assigned to this player.",
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
      const supportPreview =
        pendingRoll.supportSkillId && body.supportRoll
          ? buildRoleplayCalculationPreview({
              roll: body.supportRoll,
              skillLabel: pendingRoll.supportSkillLabel ?? "Support",
              skillValue: pendingRoll.supportSkillValue,
            })
          : undefined;
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
        participantName: participant.label,
        partial: preview.partial,
        pendingRollId: pendingRoll.id,
        roll: body.roll,
        rollSetId: pendingRoll.rollSetId,
        session: encounter,
        side: pendingRollSide,
        silent: false,
        skillId: pendingRoll.skillId,
        skillLabel: pendingRoll.skillLabel,
        skillValue: pendingRoll.skillValue,
        success: preview.success,
        summary: `${participant.label} rolled ${pendingRoll.skillLabel}.`,
        supportCalculationText: supportPreview?.calculationText,
        supportNumericSubtotal: supportPreview?.numericSubtotal,
        supportRoll: body.supportRoll,
        supportSkillId: pendingRoll.supportSkillId,
        supportSkillLabel: pendingRoll.supportSkillLabel,
        supportSkillValue: pendingRoll.supportSkillValue,
        useDbMod: pendingRoll.useDbMod,
        useGenMod: pendingRoll.useGenMod,
        useObSkillMod: pendingRoll.useObSkillMod,
      });
      const savedEncounter = await encounterService.updateEncounter({
        campaignId: encounter.campaignId,
        encounterId,
        scenarioId: encounter.scenarioId,
        session: {
          ...nextEncounter,
          updatedAt: new Date().toISOString(),
        },
      });

      return { encounter: savedEncounter };
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Unable to submit player roll.",
      });
    }
  });
};
