import { equipmentTemplatesById } from "@glantri/content";
import {
  projectCombatItemInteractionRecipients,
  type CombatGenericAction,
  type CombatGenericActionReference,
  type CombatItemInteraction,
  type CombatItemInteractionOperation,
  type CombatItemInteractionState,
  type EncounterSession,
} from "@glantri/domain";
import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../client";
import {
  CombatItemUnavailableError,
  createPrismaCharacterEquipmentRepository,
  type ApplyCombatItemInteractionResult,
  type CharacterEquipmentRepository,
  type CombatItemInteractionRecord,
} from "../repositories/characterEquipmentRepository";
import {
  CombatPersistenceError,
  createPrismaCombatStatePersistenceRepository,
  isRetryableCombatTransactionError,
} from "../repositories/combatStatePersistenceRepository";
import { createPrismaCombatStateReadRepository } from "../repositories/combatStateReadRepository";

export { CombatPersistenceError } from "../repositories/combatStatePersistenceRepository";

export {
  CombatItemRevisionError,
  CombatItemUnavailableError,
} from "../repositories/characterEquipmentRepository";

export interface CombatItemParticipantContext {
  characterId?: string;
  label: string;
  participantId: string;
}

export interface CombatItemInteractionOption {
  category: string;
  id: string;
  label: string;
  operations: CombatItemInteractionOperation[];
  playerVisible: boolean;
  revision: string;
  state: CombatItemInteractionState;
}

export interface CombatItemInteractionActorOptions {
  characterId?: string;
  items: CombatItemInteractionOption[];
  label: string;
  participantId: string;
  unsupportedReason?: string;
}

export interface CombatItemInteractionOptions {
  actors: CombatItemInteractionActorOptions[];
  presentItems: CombatItemInteractionOption[];
  recipients: Array<{ label: string; participantId: string }>;
}

export type CombatItemInteractionViewer =
  | { kind: "gm" }
  | {
      controlledParticipantIds: ReadonlySet<string>;
      kind: "player";
      visibleParticipantIds: ReadonlySet<string>;
    };

export interface CommitCombatItemInteractionResolutionInput {
  actionId: string;
  actorUserId: string;
  campaignId: string;
  encounterId: string;
  encounterSession: EncounterSession;
  expectedEncounterRevision: string;
  interaction: CombatItemInteraction;
  ownerCharacterId: string;
  recipientCharacterId?: string;
  roundNumber: number;
  scenarioId: string;
}

type CombatItemInteractionTransactionBoundary = "item" | "encounter" | "event";

interface CombatItemResolutionActionContext {
  action: CombatGenericAction;
  participants: ReadonlyArray<{ characterId?: string; participantId: string }>;
}

function findResolutionActionContext(
  encounter: EncounterSession,
  actionId: string,
): CombatItemResolutionActionContext | undefined {
  const state = encounter.combatRoundState;
  if (!state) return undefined;
  for (const round of [state, ...state.rounds]) {
    const action = round.genericActions.find((candidate) => candidate.id === actionId);
    if (action) return { action, participants: round.participants };
  }
  return undefined;
}

function sameItemInteraction(
  action: CombatGenericAction,
  interaction: CombatItemInteraction,
): boolean {
  return (
    action.preset === "item_interaction" &&
    action.itemInteraction?.itemId === interaction.itemId &&
    action.itemInteraction.itemRevision === interaction.itemRevision &&
    action.itemInteraction.operation === interaction.operation &&
    action.itemInteraction.recipientParticipantId === interaction.recipientParticipantId
  );
}

function hasExactParticipantSemantics(input: {
  context: CombatItemResolutionActionContext;
  ownerCharacterId: string;
  recipientCharacterId?: string;
}): boolean {
  const owner = input.context.participants.find(
    (participant) => participant.participantId === input.context.action.ownerParticipantId,
  );
  const recipientParticipantId = input.context.action.itemInteraction?.recipientParticipantId;
  const recipient = recipientParticipantId
    ? input.context.participants.find(
        (participant) => participant.participantId === recipientParticipantId,
      )
    : undefined;
  return (
    owner?.characterId === input.ownerCharacterId &&
    (recipientParticipantId
      ? recipient?.characterId === input.recipientCharacterId
      : input.recipientCharacterId === undefined)
  );
}

function resolutionEventPayload(input: CommitCombatItemInteractionResolutionInput) {
  const context = findResolutionActionContext(input.encounterSession, input.actionId);
  return {
    actionId: input.actionId,
    encounterId: input.encounterId,
    itemId: input.interaction.itemId,
    itemRevision: input.interaction.itemRevision,
    operation: input.interaction.operation,
    ownerCharacterId: input.ownerCharacterId,
    ownerParticipantId: context?.action.ownerParticipantId,
    recipientCharacterId: input.recipientCharacterId ?? null,
    recipientParticipantId: input.interaction.recipientParticipantId ?? null,
    resolutionKind: "canonical_combat_item",
  };
}

function payloadMatchesResolution(
  value: unknown,
  expected: ReturnType<typeof resolutionEventPayload>,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return Object.entries(expected).every(([key, expectedValue]) => payload[key] === expectedValue);
}

function itemLabel(record: CombatItemInteractionRecord): string {
  return (
    record.item.displayName?.trim() ||
    equipmentTemplatesById[record.item.templateId]?.name ||
    "Item"
  );
}

function itemState(record: CombatItemInteractionRecord): CombatItemInteractionState {
  if (!record.item.holderCharacterId) return "present_unheld";
  if (record.item.isEquipped || record.item.storageAssignment?.carryMode === "equipped") {
    return "equipped";
  }
  if (
    record.item.storageAssignment?.carryMode === "backpack" ||
    record.item.storageAssignment?.carryMode === "stored"
  ) {
    return "stowed";
  }
  return "held";
}

function supportedOperations(
  record: CombatItemInteractionRecord,
  state: CombatItemInteractionState,
): CombatItemInteractionOperation[] {
  if (state === "present_unheld") return ["pickup"];
  const operations: CombatItemInteractionOperation[] = [];
  if (
    state !== "equipped" &&
    (record.item.category === "weapon" ||
      record.item.category === "shield" ||
      record.item.category === "armor")
  ) {
    operations.push("draw");
  }
  if (state !== "stowed") operations.push("stow");
  operations.push("drop", "pass", "use");
  return operations;
}

function toOption(record: CombatItemInteractionRecord): CombatItemInteractionOption {
  if (!record.item.revision) {
    throw new Error("Canonical Item revision is unavailable.");
  }
  const state = itemState(record);
  return {
    category: record.item.category,
    id: record.item.id,
    label: itemLabel(record),
    operations: supportedOperations(record, state),
    playerVisible: !record.hidden,
    revision: record.item.revision,
    state,
  };
}

export class CombatItemInteractionService {
  constructor(
    private readonly repository: CharacterEquipmentRepository = createPrismaCharacterEquipmentRepository(),
    private readonly client: PrismaClient = defaultPrisma,
    private readonly transactionBoundaryHook?: (
      boundary: CombatItemInteractionTransactionBoundary,
    ) => Promise<void> | void,
  ) {}

  async getOptions(input: {
    campaignId: string;
    encounterId: string;
    participants: readonly CombatItemParticipantContext[];
    viewer: CombatItemInteractionViewer;
  }): Promise<CombatItemInteractionOptions> {
    const records = await this.repository.getCombatItemInteractionRecords(input.campaignId);
    const visibleActors = input.participants.filter(
      (participant) =>
        input.viewer.kind === "gm" ||
        input.viewer.controlledParticipantIds?.has(participant.participantId),
    );
    const actors = visibleActors.map((participant): CombatItemInteractionActorOptions => {
      if (!participant.characterId) {
        return {
          items: [],
          label: participant.label,
          participantId: participant.participantId,
          unsupportedReason:
            "Canonical Item interactions currently require a Character participant.",
        };
      }
      return {
        characterId: participant.characterId,
        items: records
          .filter(
            (record) =>
              record.availableInEncounter &&
              (input.viewer.kind === "gm" || !record.hidden) &&
              record.item.holderCharacterId === participant.characterId,
          )
          .map(toOption),
        label: participant.label,
        participantId: participant.participantId,
      };
    });
    const presentItems = records
      .filter(
        (record) =>
          record.presentEncounterId === input.encounterId &&
          !record.item.holderCharacterId &&
          (input.viewer.kind === "gm" || !record.hidden),
      )
      .map(toOption);

    return {
      actors,
      presentItems,
      recipients: projectCombatItemInteractionRecipients({
        participants: input.participants.filter((participant) => Boolean(participant.characterId)),
        viewer:
          input.viewer.kind === "gm"
            ? { kind: "gm" }
            : {
                kind: "player",
                visibleParticipantIds: input.viewer.visibleParticipantIds,
              },
      }).map((participant) => ({
        label: participant.label,
        participantId: participant.participantId,
      })),
    };
  }

  async resolveDeclaration(input: {
    campaignId: string;
    encounterId: string;
    expectedItemRevision: string;
    itemId: string;
    operation: CombatItemInteractionOperation;
    ownerParticipantId: string;
    participants: readonly CombatItemParticipantContext[];
    recipientParticipantId?: string;
    viewer: CombatItemInteractionViewer;
  }): Promise<{
    interaction: CombatItemInteraction;
    reference: CombatGenericActionReference;
  }> {
    const options = await this.getOptions(input);
    const owner = options.actors.find((actor) => actor.participantId === input.ownerParticipantId);
    const candidateItems =
      input.operation === "pickup" ? options.presentItems : (owner?.items ?? []);
    const item = candidateItems.find(
      (candidate) =>
        candidate.id === input.itemId &&
        candidate.revision === input.expectedItemRevision &&
        candidate.operations.includes(input.operation),
    );
    const recipient = input.recipientParticipantId
      ? options.recipients.find(
          (candidate) => candidate.participantId === input.recipientParticipantId,
        )
      : undefined;
    if (
      !owner?.characterId ||
      !item ||
      (input.operation === "pass" &&
        (!recipient || recipient.participantId === input.ownerParticipantId)) ||
      (input.operation !== "pass" && input.recipientParticipantId)
    ) {
      throw new CombatItemUnavailableError();
    }

    return {
      interaction: {
        itemId: item.id,
        itemLabel: item.label,
        itemRevision: item.revision,
        operation: input.operation,
        recipientParticipantId: recipient?.participantId,
        stateAtDeclaration: item.state,
        visibleToParticipantIds: item.playerVisible
          ? [
              ...new Set([
                input.ownerParticipantId,
                ...(recipient ? [recipient.participantId] : []),
              ]),
            ]
          : [],
      },
      reference: {
        itemId: item.id,
        kind: "item",
        label: item.label,
        ownerParticipantId: input.ownerParticipantId,
      },
    };
  }

  async apply(input: {
    actionId: string;
    campaignId: string;
    encounterId: string;
    interaction: CombatItemInteraction;
    ownerCharacterId: string;
    recipientCharacterId?: string;
  }): Promise<ApplyCombatItemInteractionResult> {
    return this.repository.applyCombatItemInteraction({
      actionId: input.actionId,
      campaignId: input.campaignId,
      encounterId: input.encounterId,
      expectedItemRevision: input.interaction.itemRevision,
      itemId: input.interaction.itemId,
      operation: input.interaction.operation,
      ownerCharacterId: input.ownerCharacterId,
      recipientCharacterId: input.recipientCharacterId,
    });
  }

  async commitResolution(
    input: CommitCombatItemInteractionResolutionInput,
  ): Promise<{ encounter: EncounterSession; item: ApplyCombatItemInteractionResult }> {
    const completedContext = findResolutionActionContext(input.encounterSession, input.actionId);
    const completedAction = completedContext?.action;
    if (
      input.encounterSession.id !== input.encounterId ||
      input.encounterSession.campaignId !== input.campaignId ||
      input.encounterSession.scenarioId !== input.scenarioId ||
      completedAction?.status !== "completed" ||
      !sameItemInteraction(completedAction, input.interaction) ||
      !completedContext ||
      !hasExactParticipantSemantics({
        context: completedContext,
        ownerCharacterId: input.ownerCharacterId,
        recipientCharacterId: input.recipientCharacterId,
      })
    ) {
      throw new CombatItemUnavailableError();
    }
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.client.$transaction(
          async (transaction) => {
            await transaction.$queryRaw(
              Prisma.sql`SELECT "id" FROM "Encounter" WHERE "id" = ${input.encounterId} FOR UPDATE`,
            );
            const persistedEncounter = (
              await createPrismaCombatStateReadRepository(transaction).getFullEncounterById(
                input.encounterId,
              )
            )?.encounter;
            const persistedContext = persistedEncounter
              ? findResolutionActionContext(persistedEncounter, input.actionId)
              : undefined;
            if (
              !persistedEncounter ||
              persistedEncounter.campaignId !== input.campaignId ||
              persistedEncounter.scenarioId !== input.scenarioId ||
              !persistedContext ||
              !sameItemInteraction(persistedContext.action, input.interaction) ||
              persistedContext.action.ownerParticipantId !== completedAction.ownerParticipantId ||
              !hasExactParticipantSemantics({
                context: persistedContext,
                ownerCharacterId: input.ownerCharacterId,
                recipientCharacterId: input.recipientCharacterId,
              })
            ) {
              throw new CombatItemUnavailableError();
            }

            const expectedEventPayload = resolutionEventPayload(input);
            const priorEvents = await transaction.scenarioEventLog.findMany({
              where: {
                AND: [
                  { payloadJson: { path: ["encounterId"], equals: input.encounterId } },
                  { payloadJson: { path: ["actionId"], equals: input.actionId } },
                  {
                    payloadJson: {
                      path: ["resolutionKind"],
                      equals: "canonical_combat_item",
                    },
                  },
                ],
                eventType: "encounter_updated",
                scenarioId: input.scenarioId,
              },
            });
            const exactPriorEvent = priorEvents.find((event) =>
              payloadMatchesResolution(event.payloadJson, expectedEventPayload),
            );
            if (persistedContext.action.status === "completed") {
              if (!exactPriorEvent || priorEvents.length !== 1) {
                throw new CombatItemUnavailableError();
              }
              const currentItem = await createPrismaCharacterEquipmentRepository(
                transaction,
              ).getCanonicalEquipmentItemById(input.interaction.itemId);
              if (!currentItem || currentItem.campaignContextId !== input.campaignId) {
                throw new CombatItemUnavailableError();
              }
              return {
                encounter: persistedEncounter,
                item: { alreadyApplied: true, item: currentItem },
              };
            }
            if (
              persistedContext.action.status !== "active" ||
              persistedEncounter.updatedAt !== input.expectedEncounterRevision ||
              priorEvents.length > 0
            ) {
              throw new CombatPersistenceError(
                "stale_revision",
                "Encounter revision changed before combat state could be saved.",
              );
            }

            const item = await createPrismaCharacterEquipmentRepository(
              transaction,
            ).applyCombatItemInteraction({
              actionId: input.actionId,
              campaignId: input.campaignId,
              encounterId: input.encounterId,
              expectedItemRevision: input.interaction.itemRevision,
              itemId: input.interaction.itemId,
              operation: input.interaction.operation,
              ownerCharacterId: input.ownerCharacterId,
              recipientCharacterId: input.recipientCharacterId,
            });
            await this.transactionBoundaryHook?.("item");

            const encounter = await createPrismaCombatStatePersistenceRepository(transaction, {
              maxTransactionAttempts: 1,
            }).updateCombatEncounter({
              campaignId: input.campaignId,
              encounterId: input.encounterId,
              expectedRevision: input.expectedEncounterRevision,
              scenarioId: input.scenarioId,
              session: input.encounterSession,
            });
            await this.transactionBoundaryHook?.("encounter");

            await transaction.scenarioEventLog.create({
              data: {
                actorUserId: input.actorUserId,
                eventType: "encounter_updated",
                payloadJson: expectedEventPayload,
                roundNumber: input.roundNumber,
                scenarioId: input.scenarioId,
                summary: "Canonical Combat Item action resolve.",
              },
            });
            await this.transactionBoundaryHook?.("event");
            return { encounter, item };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!isRetryableCombatTransactionError(error)) throw error;
        if (attempt === 3) {
          throw new CombatPersistenceError(
            "transaction_conflict",
            "Combat state changed while saving. Refresh and try again.",
            error,
          );
        }
      }
    }
    throw new CombatPersistenceError(
      "transaction_conflict",
      "Combat state changed while saving. Refresh and try again.",
    );
  }
}
