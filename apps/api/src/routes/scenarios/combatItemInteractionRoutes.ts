import type { FastifyPluginAsync } from "fastify";
import {
  activateCombatGenericAction,
  combatGenericActionDurationSchema,
  combatItemInteractionOperationSchema,
  declareCombatGenericAction,
  finishCombatGenericAction,
  getCombatRoundLiveItemInteractionForParticipant,
  initializeCombatRoundState,
  resolveEncounterParticipantByRollParticipantId,
  resolveEncounterParticipantMembership,
  reviewCombatGenericAction,
  type CombatGenericActionDuration,
  type CombatItemInteractionOperation,
  type EncounterSession,
  type ScenarioParticipant,
} from "@glantri/domain";
import {
  CampaignService,
  CombatItemInteractionService,
  CombatPersistenceError,
  CombatItemRevisionError,
  CombatItemUnavailableError,
  EncounterCombatWriteError,
  EncounterService,
  ScenarioService,
  ScenarioEquipmentStaleError,
} from "@glantri/database";

import { requireAuthenticatedUser } from "../../lib/sessionAuth";
import { resolveScenarioWorkspaceAccess } from "./access";
import {
  buildPlayerSafeCombatScopeForUser,
  buildPlayerFacingEncounterForUser,
} from "./encounterRoutes";

type ItemActionLifecycleOperation =
  | "declare"
  | "review"
  | "activate"
  | "resolve"
  | "interrupt"
  | "cancel";

interface ItemActionBody {
  actionId: string;
  duration?: CombatGenericActionDuration;
  expectedItemRevision?: string;
  expectedRevision: string;
  intentDetail?: string;
  itemId?: string;
  itemOperation?: CombatItemInteractionOperation;
  operation: ItemActionLifecycleOperation;
  participantId?: string;
  recipientParticipantId?: string;
  resultText?: string;
  visibleToParticipantIds: string[];
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Canonical Item action payload is required.");
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  return value.trim().slice(0, maxLength);
}

function parseBody(value: unknown): ItemActionBody {
  const body = bodyObject(value);
  const operation = body.operation;
  if (
    operation !== "declare" &&
    operation !== "review" &&
    operation !== "activate" &&
    operation !== "resolve" &&
    operation !== "interrupt" &&
    operation !== "cancel"
  ) {
    throw new Error("Choose a valid canonical Item action operation.");
  }
  return {
    actionId: nonEmptyString(body.actionId, "actionId"),
    duration:
      body.duration === undefined
        ? undefined
        : combatGenericActionDurationSchema.parse(body.duration),
    expectedItemRevision: optionalString(body.expectedItemRevision),
    expectedRevision: nonEmptyString(body.expectedRevision, "expectedRevision"),
    intentDetail: optionalString(body.intentDetail),
    itemId: optionalString(body.itemId),
    itemOperation:
      body.itemOperation === undefined
        ? undefined
        : combatItemInteractionOperationSchema.parse(body.itemOperation),
    operation,
    participantId: optionalString(body.participantId),
    recipientParticipantId: optionalString(body.recipientParticipantId),
    resultText: optionalString(body.resultText, 4000),
    visibleToParticipantIds: Array.isArray(body.visibleToParticipantIds)
      ? [
          ...new Set(
            body.visibleToParticipantIds.filter(
              (entry): entry is string => typeof entry === "string" && entry.length > 0,
            ),
          ),
        ]
      : [],
  };
}

function operationIntent(input: {
  detail?: string;
  itemLabel: string;
  operation: CombatItemInteractionOperation;
  recipientLabel?: string;
}): string {
  const verb = {
    draw: "Draw / ready",
    drop: "Drop",
    pass: "Pass / give",
    pickup: "Pick up",
    stow: "Stow / unequip",
    use: "Use / interact with",
  }[input.operation];
  const recipient = input.recipientLabel ? ` to ${input.recipientLabel}` : "";
  const detail = input.detail ? ` — ${input.detail}` : "";
  return `${verb} ${input.itemLabel}${recipient}${detail}`;
}

export interface CombatItemInteractionRouteServices {
  campaignService: CampaignService;
  encounterService: EncounterService;
  itemService: CombatItemInteractionService;
  scenarioService: ScenarioService;
}

function defaultServices(): CombatItemInteractionRouteServices {
  return {
    campaignService: new CampaignService(),
    encounterService: new EncounterService(),
    itemService: new CombatItemInteractionService(),
    scenarioService: new ScenarioService(),
  };
}

function participantContexts(input: {
  encounter: EncounterSession;
  scenarioParticipants: ScenarioParticipant[];
}) {
  const state = initializeCombatRoundState({ encounter: input.encounter });
  const membership = resolveEncounterParticipantMembership(input);
  return state.participants
    .map((roundParticipant) => {
      const encounterParticipant = resolveEncounterParticipantByRollParticipantId({
        participantId: roundParticipant.participantId,
        participants: membership.participants,
      });
      const scenarioParticipant = input.scenarioParticipants.find(
        (candidate) =>
          candidate.id === encounterParticipant?.scenarioParticipantId ||
          candidate.id === encounterParticipant?.id ||
          (candidate.characterId && candidate.characterId === encounterParticipant?.characterId),
      );
      if (scenarioParticipant && !scenarioParticipant.isActive) return null;
      return {
        characterId: scenarioParticipant?.characterId ?? encounterParticipant?.characterId,
        controlledByUserId: scenarioParticipant?.controlledByUserId,
        label: roundParticipant.label,
        participantId: roundParticipant.participantId,
      };
    })
    .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant));
}

export function createCombatItemInteractionRoutes(
  configuredServices?: CombatItemInteractionRouteServices,
): FastifyPluginAsync {
  return async (app) => {
    let resolvedServices = configuredServices;
    const services = () => (resolvedServices ??= defaultServices());

    async function context(
      request: Parameters<typeof requireAuthenticatedUser>[0],
      reply: Parameters<typeof requireAuthenticatedUser>[1],
    ) {
      const user = await requireAuthenticatedUser(request, reply);
      if (!user) return null;
      const encounterId = nonEmptyString(
        (request.params as Record<string, unknown> | undefined)?.encounterId,
        "Encounter id",
      );
      const current = services();
      const encounter = await current.encounterService.getEncounterById(encounterId);
      if (!encounter?.scenarioId || encounter.status !== "active") return null;
      const access = await resolveScenarioWorkspaceAccess(current, {
        scenarioId: encounter.scenarioId,
        userId: user.id,
        userRoles: user.roles,
      });
      if (!access) return null;
      const scenarioParticipants = await current.scenarioService.listScenarioParticipants(
        encounter.scenarioId,
      );
      const participants = participantContexts({ encounter, scenarioParticipants });
      const controlledParticipantIds = new Set(
        participants
          .filter((participant) => participant.controlledByUserId === user.id)
          .map((participant) => participant.participantId),
      );
      const visibleParticipantIds =
        access.mode === "gm"
          ? new Set(participants.map((participant) => participant.participantId))
          : buildPlayerSafeCombatScopeForUser({
              encounter,
              scenarioParticipants,
              userId: user.id,
            }).visibleParticipantIds;
      return {
        access,
        controlledParticipantIds,
        encounter,
        encounterId,
        participants,
        scenarioParticipants,
        user,
        visibleParticipantIds,
      };
    }

    app.get(
      "/encounters/:encounterId/combat-round/item-interactions/options",
      async (request, reply) => {
        const currentContext = await context(request, reply);
        if (!currentContext) return reply.code(404).send({ error: "Combat encounter not found." });
        try {
          const options = await services().itemService.getOptions({
            campaignId: currentContext.access.campaignId,
            encounterSession: currentContext.encounter,
            encounterId: currentContext.encounterId,
            participants: currentContext.participants,
            viewer:
              currentContext.access.mode === "gm"
                ? { kind: "gm" }
                : {
                    controlledParticipantIds: currentContext.controlledParticipantIds,
                    kind: "player",
                    visibleParticipantIds: currentContext.visibleParticipantIds,
                  },
          });
          return { options };
        } catch (error) {
          if (error instanceof ScenarioEquipmentStaleError) {
            return reply.code(409).send({ error: error.message });
          }
          throw error;
        }
      },
    );

    app.post("/encounters/:encounterId/combat-round/item-interactions", async (request, reply) => {
      const currentContext = await context(request, reply);
      if (!currentContext) return reply.code(404).send({ error: "Combat encounter not found." });
      const body = parseBody(request.body);
      const { encounter, scenarioParticipants } = currentContext;
      const roundState = initializeCombatRoundState({ encounter });
      const existingAction = roundState.genericActions.find(
        (action) => action.id === body.actionId,
      );
      const isGm = currentContext.access.mode === "gm";
      const existingIsItemAction = existingAction?.preset === "item_interaction";
      const ownsExisting = Boolean(
        existingAction &&
        currentContext.controlledParticipantIds.has(existingAction.ownerParticipantId),
      );

      if (body.operation === "declare" && existingAction) {
        if (!existingIsItemAction || (!isGm && !ownsExisting)) {
          return reply.code(404).send({ error: "Canonical Item action not found." });
        }
        return {
          encounter: isGm
            ? encounter
            : buildPlayerFacingEncounterForUser({
                encounter,
                scenarioParticipants,
                userId: currentContext.user.id,
              }),
        };
      }
      if (body.operation !== "declare" && !existingIsItemAction) {
        return reply.code(404).send({ error: "Canonical Item action not found." });
      }
      if (!isGm && body.operation !== "declare") {
        return reply.code(403).send({ error: "Only the GM can review or resolve Item actions." });
      }
      if (body.expectedRevision !== encounter.updatedAt) {
        return reply.code(409).send({
          error: "The canonical Item action changed. Refresh and review the latest state.",
        });
      }
      // One live Item action per participant — rule decision 0007 §2's one-live-action principle
      // applied to the Item action family by Product Owner ruling on Forgejo issue #409.
      //
      // This is the **server-side creation-time refusal**; the panel's disabled buttons are a
      // convenience, not the guard. Its scope is the ruling's, and each exclusion is deliberate:
      //
      // - Per participant, not per round. `getCombatRoundLiveItemInteractionForParticipant` scans
      //   the live round state's carried-forward `genericActions`, so a still-live Item action from
      //   an earlier round still occupies the slot. Carry-forward is a rollover, not a declaration,
      //   so it is never itself refused here.
      // - Idempotent re-declaration by the declaration's own id never reaches this point: the
      //   `body.operation === "declare" && existingAction` branch above already returned the
      //   canonical encounter unchanged. `excludeActionId` keeps that true regardless of ordering.
      // - The family is decided by `declarationKind`, not by `preset`. A guarded Item action is one
      //   the Item authority minted — `preset: "item_interaction"` and **no** `declarationKind`.
      //   The M7 secondary `small_action` that names an Item carries both fields, and the Product
      //   Owner ruled it is *a Small Action involving an Item*, not this family: it is neither
      //   refused here nor able to occupy the slot, exactly as 0007 §2 excludes `small_action`.
      //   This route's `declare` branch is the only creator of the guarded family, so this is the
      //   only place the refusal is needed; `materializeCombatDeclarationTasks` stamps a
      //   `declarationKind` on everything it mints and therefore cannot create one.
      //
      // Like 0007's refusal this repairs nothing already persisted; it only stops a second live
      // Item action being created. The remedy it names is the existing GM review/cancel lifecycle,
      // not a new replacement mechanism.
      if (body.operation === "declare" && body.participantId) {
        const liveItemAction = getCombatRoundLiveItemInteractionForParticipant({
          excludeActionId: body.actionId,
          participantId: body.participantId,
          state: roundState,
        });
        if (liveItemAction) {
          return reply.code(400).send({
            error:
              "This character already has an Item action in progress. Resolve, interrupt or cancel it before declaring another.",
          });
        }
      }
      if (body.operation === "resolve" && existingAction?.status === "completed") {
        return { encounter };
      }
      if (body.operation === "resolve" && existingAction?.status !== "active") {
        return reply.code(400).send({ error: "Only an active Item action can be resolved." });
      }

      let genericActions = roundState.genericActions;
      let atomicallyCommittedEncounter: EncounterSession | undefined;
      const now = new Date().toISOString();
      try {
        if (body.operation === "declare") {
          if (
            !body.participantId ||
            !body.itemId ||
            !body.expectedItemRevision ||
            !body.itemOperation
          ) {
            throw new CombatItemUnavailableError();
          }
          if (!isGm && !currentContext.controlledParticipantIds.has(body.participantId)) {
            throw new CombatItemUnavailableError();
          }
          const declaration = await services().itemService.resolveDeclaration({
            campaignId: currentContext.access.campaignId,
            encounterId: currentContext.encounterId,
            expectedItemRevision: body.expectedItemRevision,
            itemId: body.itemId,
            operation: body.itemOperation,
            ownerParticipantId: body.participantId,
            participants: currentContext.participants,
            recipientParticipantId: body.recipientParticipantId,
            viewer: isGm
              ? { kind: "gm" }
              : {
                  controlledParticipantIds: currentContext.controlledParticipantIds,
                  kind: "player",
                  visibleParticipantIds: currentContext.visibleParticipantIds,
                },
          });
          const recipientLabel = body.recipientParticipantId
            ? currentContext.participants.find(
                (participant) => participant.participantId === body.recipientParticipantId,
              )?.label
            : undefined;
          genericActions = declareCombatGenericAction({
            action: {
              createdAt: now,
              createdByUserId: currentContext.user.id,
              duration: { kind: "gm_decided" },
              id: body.actionId,
              intent: operationIntent({
                detail: body.intentDetail,
                itemLabel: declaration.interaction.itemLabel,
                operation: declaration.interaction.operation,
                recipientLabel,
              }),
              itemInteraction: declaration.interaction,
              ownerParticipantId: body.participantId,
              preset: "item_interaction",
              reference: declaration.reference,
            },
            actions: genericActions,
          });
        } else if (body.operation === "review") {
          genericActions = reviewCombatGenericAction({
            actionId: body.actionId,
            actions: genericActions,
            duration: body.duration ?? existingAction!.duration,
            reference: existingAction!.reference,
            reviewedAt: now,
          });
        } else if (body.operation === "activate") {
          genericActions = activateCombatGenericAction({
            actionId: body.actionId,
            activatedAt: now,
            actions: genericActions,
            roundNumber: roundState.roundNumber,
            step: roundState.currentStep,
          });
        } else {
          const terminalStatus =
            body.operation === "resolve"
              ? "completed"
              : body.operation === "interrupt"
                ? "interrupted"
                : "cancelled";
          if (body.operation === "resolve") {
            if (!body.resultText || body.visibleToParticipantIds.length === 0) {
              return reply.code(400).send({ error: "Enter a player-safe result and audience." });
            }
            const audience = new Set(roundState.participants.map((entry) => entry.participantId));
            if (body.visibleToParticipantIds.some((id) => !audience.has(id))) {
              return reply.code(400).send({ error: "Choose active participants for the result." });
            }
          }
          genericActions = finishCombatGenericAction({
            actionId: body.actionId,
            actions: genericActions,
            at: now,
            resolution:
              body.operation === "resolve"
                ? {
                    resolvedAt: now,
                    resolvedByUserId: currentContext.user.id,
                    text: body.resultText!,
                    visibleToParticipantIds: body.visibleToParticipantIds,
                  }
                : undefined,
            roundNumber: roundState.roundNumber,
            status: terminalStatus,
            step: roundState.currentStep,
          });
          if (body.operation === "resolve") {
            const owner = currentContext.participants.find(
              (participant) => participant.participantId === existingAction!.ownerParticipantId,
            );
            const recipient = existingAction!.itemInteraction?.recipientParticipantId
              ? currentContext.participants.find(
                  (participant) =>
                    participant.participantId ===
                    existingAction!.itemInteraction?.recipientParticipantId,
                )
              : undefined;
            if (!owner?.characterId || !existingAction!.itemInteraction) {
              throw new CombatItemUnavailableError();
            }
            atomicallyCommittedEncounter = (
              await services().itemService.commitResolution({
                actionId: existingAction!.id,
                actorUserId: currentContext.user.id,
                campaignId: currentContext.access.campaignId,
                encounterId: currentContext.encounterId,
                encounterSession: {
                  ...encounter,
                  combatRoundState: { ...roundState, genericActions },
                  updatedAt: now,
                },
                expectedEncounterRevision: encounter.updatedAt,
                interaction: existingAction!.itemInteraction,
                ownerCharacterId: owner.characterId,
                recipientCharacterId: recipient?.characterId,
                roundNumber: roundState.roundNumber,
                scenarioId: encounter.scenarioId!,
              })
            ).encounter;
          }
        }

        const nextEncounter =
          atomicallyCommittedEncounter ??
          (await services().encounterService.updateCombatEncounter({
            campaignId: currentContext.access.campaignId,
            encounterId: currentContext.encounterId,
            expectedRevision: encounter.updatedAt,
            scenarioId: encounter.scenarioId!,
            session: {
              ...encounter,
              combatRoundState: { ...roundState, genericActions },
              updatedAt: now,
            },
          }));
        if (!atomicallyCommittedEncounter) {
          await services().scenarioService.recordScenarioEvent({
            actorUserId: currentContext.user.id,
            eventType: "encounter_updated",
            payload: {
              actionId: body.actionId,
              encounterId: currentContext.encounterId,
              operation: body.operation,
            },
            scenarioId: encounter.scenarioId!,
            summary: `Canonical Combat Item action ${body.operation}.`,
          });
        }
        return {
          encounter: isGm
            ? nextEncounter
            : buildPlayerFacingEncounterForUser({
                encounter: nextEncounter,
                scenarioParticipants,
                userId: currentContext.user.id,
              }),
        };
      } catch (error) {
        if (error instanceof ScenarioEquipmentStaleError) {
          return reply.code(409).send({ error: error.message });
        }
        if (error instanceof CombatItemUnavailableError) {
          return reply.code(404).send({ error: "The selected Item is no longer available." });
        }
        if (
          error instanceof CombatItemRevisionError ||
          (error instanceof CombatPersistenceError &&
            (error.code === "stale_revision" || error.code === "transaction_conflict")) ||
          (error instanceof EncounterCombatWriteError && error.code === "stale_revision")
        ) {
          return reply.code(409).send({
            error: "The canonical Item action changed. Refresh and review the latest state.",
          });
        }
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Unable to update the Item action.",
        });
      }
    });
  };
}

export const combatItemInteractionRoutes = createCombatItemInteractionRoutes();
