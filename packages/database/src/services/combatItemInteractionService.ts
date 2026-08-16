import { equipmentTemplatesById } from "@glantri/content";
import type {
  CombatGenericActionReference,
  CombatItemInteraction,
  CombatItemInteractionOperation,
  CombatItemInteractionState,
} from "@glantri/domain";

import {
  CombatItemUnavailableError,
  createPrismaCharacterEquipmentRepository,
  type ApplyCombatItemInteractionResult,
  type CharacterEquipmentRepository,
  type CombatItemInteractionRecord,
} from "../repositories/characterEquipmentRepository";

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
    revision: record.item.revision,
    state,
  };
}

export class CombatItemInteractionService {
  constructor(
    private readonly repository: CharacterEquipmentRepository = createPrismaCharacterEquipmentRepository(),
  ) {}

  async getOptions(input: {
    campaignId: string;
    encounterId: string;
    participants: readonly CombatItemParticipantContext[];
    viewer: { controlledParticipantIds?: ReadonlySet<string>; kind: "gm" | "player" };
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
      recipients: input.participants
        .filter((participant) => Boolean(participant.characterId))
        .map((participant) => ({
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
    viewer: { controlledParticipantIds?: ReadonlySet<string>; kind: "gm" | "player" };
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
}
