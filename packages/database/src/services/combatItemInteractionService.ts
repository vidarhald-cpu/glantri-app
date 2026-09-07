import { isDeepStrictEqual } from "node:util";

import { equipmentTemplatesById } from "@glantri/content";
import {
  isScenarioLiveInteractive,
  projectCombatItemInteractionRecipients,
  revealableEquipmentItemFacts,
  resolveWeaponDisarmMismatch,
  resolveWeaponDisarmProfile,
  type CombatDisarmDeclaration,
  type CombatGenericAction,
  type CombatGenericActionReference,
  type CombatItemInteraction,
  type CombatItemInteractionOperation,
  type CombatItemInteractionState,
  type EncounterSession,
  type ScenarioParticipantState,
} from "@glantri/domain";
import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../client";
import {
  CombatItemUnavailableError,
  createPrismaCharacterEquipmentRepository,
  type ApplyCombatItemInteractionResult,
  type CharacterEquipmentRepository,
  type CombatItemInteractionRecord,
  type CombatThrownWeaponAttackUndo,
} from "../repositories/characterEquipmentRepository";
import {
  CombatPersistenceError,
  createPrismaCombatStatePersistenceRepository,
  isRetryableCombatTransactionError,
} from "../repositories/combatStatePersistenceRepository";
import { createPrismaCombatStateReadRepository } from "../repositories/combatStateReadRepository";

export { CombatPersistenceError } from "../repositories/combatStatePersistenceRepository";
export type { CombatThrownWeaponAttackUndo } from "../repositories/characterEquipmentRepository";

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
  templateId: string;
  weaponDisarm?: {
    capability: "none" | "trap";
    controlRating: number;
    gripClass: "one_handed" | "two_handed";
    parryModifier: number;
  };
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
  disarmTargets: CombatItemInteractionActorOptions[];
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

export interface CommitCombatThrownWeaponAttackInput {
  actorUserId: string;
  campaignId: string;
  commandId: string;
  encounterId: string;
  expectedEncounterRevision: string;
  itemId: string;
  ownerCharacterId: string;
  roundNumber: number;
  scenarioId: string;
  session: EncounterSession;
  templateId: string;
}

export interface CombatMissileAmmoUndo {
  actionId: string;
  ammoItemId: string;
  ammoItemRevisionBefore: string;
  ammoItemRevisionAfter: string;
  encounterId: string;
  quantityAfter: number;
  quantityBefore: number;
  version: 1;
}

export interface CommitCombatMissileAttackInput {
  actorUserId: string;
  ammoItemId: string;
  ammoItemRevision: string;
  campaignId: string;
  commandId: string;
  encounterId: string;
  expectedEncounterRevision: string;
  ownerCharacterId: string;
  roundNumber: number;
  scenarioId: string;
  session: EncounterSession;
}

export interface CommitCombatDisarmInput {
  actorUserId: string;
  campaignId: string;
  commandId: string;
  encounterId: string;
  expectedEncounterRevision: string;
  ownerCharacterId: string;
  roundNumber: number;
  scenarioId: string;
  session: EncounterSession;
}

export interface ResolveCombatDisarmDeclarationInput {
  actingItemId: string;
  actingItemRevision: string;
  actingParticipantId: string;
  campaignId: string;
  encounterId: string;
  method: CombatDisarmDeclaration["method"];
  participants: readonly CombatItemParticipantContext[];
  phase: CombatDisarmDeclaration["phase"];
  targetItemId: string;
  targetItemRevision: string;
  targetParticipantId: string;
  viewer: CombatItemInteractionViewer;
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

function findCombatCommand(encounter: EncounterSession, commandId: string) {
  const state = encounter.combatRoundState;
  if (!state) return undefined;
  for (const round of [state, ...state.rounds]) {
    const command = round.commands.find((candidate) => candidate.id === commandId);
    if (command) return command;
  }
  return undefined;
}

function attachThrownWeaponUndo(
  encounter: EncounterSession,
  commandId: string,
  undo: CombatThrownWeaponAttackUndo,
): EncounterSession {
  const state = encounter.combatRoundState;
  if (!state) throw new CombatItemUnavailableError();
  let found = false;
  const commands = state.commands.map((command) => {
    if (command.id !== commandId || command.type !== "roll_attack") return command;
    found = true;
    return { ...command, facts: { ...command.facts, thrownWeaponUndo: undo } };
  });
  if (!found) throw new CombatItemUnavailableError();
  return { ...encounter, combatRoundState: { ...state, commands } };
}

function commandHasThrownWeaponUndo(
  encounter: EncounterSession,
  commandId: string,
  undo: CombatThrownWeaponAttackUndo,
): boolean {
  const command = findCombatCommand(encounter, commandId);
  const fact = command?.facts.thrownWeaponUndo;
  return (
    command?.type === "roll_attack" &&
    undo.actionId === commandId &&
    undo.encounterId === encounter.id &&
    isDeepStrictEqual(fact, undo)
  );
}

function attachMissileAmmoUndo(
  encounter: EncounterSession,
  commandId: string,
  undo: CombatMissileAmmoUndo,
): EncounterSession {
  const state = encounter.combatRoundState;
  if (!state) throw new CombatItemUnavailableError();
  let found = false;
  const commands = state.commands.map((command) => {
    if (command.id !== commandId || command.type !== "roll_attack") return command;
    found = true;
    return { ...command, facts: { ...command.facts, missileAmmoUndo: undo } };
  });
  if (!found) throw new CombatItemUnavailableError();
  return { ...encounter, combatRoundState: { ...state, commands } };
}

function commandHasMissileAmmoUndo(
  encounter: EncounterSession,
  commandId: string,
  undo: CombatMissileAmmoUndo,
): boolean {
  const command = findCombatCommand(encounter, commandId);
  return (
    command?.type === "roll_attack" &&
    undo.actionId === commandId &&
    undo.encounterId === encounter.id &&
    isDeepStrictEqual(command.facts.missileAmmoUndo, undo)
  );
}

function findDisarmAttempt(encounter: EncounterSession, commandId: string) {
  const command = findCombatCommand(encounter, commandId);
  const attemptId = command?.facts.attemptId;
  const state = encounter.combatRoundState;
  if (command?.type !== "commit_disarm" || typeof attemptId !== "string" || !state) {
    return undefined;
  }
  return [state, ...state.rounds]
    .flatMap((round) => round.disarmAttempts)
    .find((attempt) => attempt.id === attemptId);
}

function attachDisarmItemUndo(
  encounter: EncounterSession,
  commandId: string,
  undo: CombatThrownWeaponAttackUndo,
): EncounterSession {
  const state = encounter.combatRoundState;
  if (!state) throw new CombatItemUnavailableError();
  let found = false;
  const commands = state.commands.map((command) => {
    if (command.id !== commandId || command.type !== "commit_disarm") return command;
    found = true;
    return { ...command, facts: { ...command.facts, disarmItemUndo: undo } };
  });
  if (!found) throw new CombatItemUnavailableError();
  return { ...encounter, combatRoundState: { ...state, commands } };
}

function commandHasDisarmItemUndo(
  encounter: EncounterSession,
  commandId: string,
  undo: CombatThrownWeaponAttackUndo,
): boolean {
  const command = findCombatCommand(encounter, commandId);
  return (
    command?.type === "commit_disarm" &&
    undo.actionId === commandId &&
    undo.encounterId === encounter.id &&
    isDeepStrictEqual(command.facts.disarmItemUndo, undo)
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

function toOption(
  record: CombatItemInteractionRecord,
  itemFacts = record.item.itemFacts,
): CombatItemInteractionOption {
  if (!record.item.revision) {
    throw new Error("Canonical Item revision is unavailable.");
  }
  const state = itemState(record);
  const template = equipmentTemplatesById[record.item.templateId];
  const weaponDisarm =
    record.item.category === "weapon" && template?.category === "weapon"
      ? (() => {
          const profile = resolveWeaponDisarmProfile({
            itemFacts,
            template,
          });
          return {
            capability: profile.capability,
            controlRating: profile.controlRating,
            gripClass: profile.gripClass,
            parryModifier: template.parry ?? 0,
          };
        })()
      : undefined;
  return {
    category: record.item.category,
    id: record.item.id,
    label: itemLabel(record),
    operations: supportedOperations(record, state),
    playerVisible: !record.hidden,
    revision: record.item.revision,
    state,
    templateId: record.item.templateId,
    weaponDisarm,
  };
}

function toOptionForViewer(
  record: CombatItemInteractionRecord,
  viewer: CombatItemInteractionViewer,
): CombatItemInteractionOption {
  return toOption(
    record,
    viewer.kind === "gm"
      ? record.item.itemFacts
      : revealableEquipmentItemFacts(record.item.itemFacts),
  );
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
          .map((record) => toOptionForViewer(record, input.viewer)),
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
      .map((record) => toOptionForViewer(record, input.viewer));
    const disarmTargets = input.participants
      .filter(
        (participant) =>
          input.viewer.kind === "gm" ||
          input.viewer.visibleParticipantIds.has(participant.participantId),
      )
      .map(
        (participant): CombatItemInteractionActorOptions => ({
          characterId: participant.characterId,
          items: participant.characterId
            ? records
                .filter(
                  (record) =>
                    record.availableInEncounter &&
                    record.item.holderCharacterId === participant.characterId &&
                    record.item.category === "weapon" &&
                    (input.viewer.kind === "gm" || !record.hidden),
                )
                .map((record) => toOptionForViewer(record, input.viewer))
            : [],
          label: participant.label,
          participantId: participant.participantId,
          unsupportedReason: participant.characterId
            ? undefined
            : "Canonical Disarm currently requires a Character participant.",
        }),
      );

    return {
      actors,
      disarmTargets,
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

  /**
   * Resolve exact canonical weapon snapshots for Disarm without leaking whether a hidden or
   * nonexistent target Item exists. Resolution never trusts labels, template ids, or ratings
   * supplied by a client.
   */
  async resolveDisarmDeclaration(
    input: ResolveCombatDisarmDeclarationInput,
  ): Promise<CombatDisarmDeclaration> {
    const actor = input.participants.find(
      (participant) => participant.participantId === input.actingParticipantId,
    );
    const target = input.participants.find(
      (participant) => participant.participantId === input.targetParticipantId,
    );
    const viewerMayAct =
      input.viewer.kind === "gm" ||
      input.viewer.controlledParticipantIds.has(input.actingParticipantId);
    const viewerMaySeeTarget =
      input.viewer.kind === "gm" ||
      input.viewer.visibleParticipantIds.has(input.targetParticipantId);
    if (
      !viewerMayAct ||
      !viewerMaySeeTarget ||
      !actor?.characterId ||
      !target?.characterId ||
      actor.participantId === target.participantId
    ) {
      throw new CombatItemUnavailableError();
    }

    const records = await this.repository.getCombatItemInteractionRecords(input.campaignId);
    const actingRecord = records.find(
      (record) =>
        record.availableInEncounter &&
        record.item.id === input.actingItemId &&
        record.item.revision === input.actingItemRevision &&
        record.item.holderCharacterId === actor.characterId &&
        (input.viewer.kind === "gm" || !record.hidden),
    );
    const targetRecord = records.find(
      (record) =>
        record.availableInEncounter &&
        record.item.id === input.targetItemId &&
        record.item.revision === input.targetItemRevision &&
        record.item.holderCharacterId === target.characterId &&
        (input.viewer.kind === "gm" || !record.hidden),
    );
    if (!actingRecord || !targetRecord) throw new CombatItemUnavailableError();

    const visibleActing = toOptionForViewer(actingRecord, input.viewer);
    const visibleTargetWeapon = toOptionForViewer(targetRecord, input.viewer);
    if (
      visibleActing.category !== "weapon" ||
      visibleTargetWeapon.category !== "weapon" ||
      visibleActing.weaponDisarm?.capability !== "trap" ||
      !visibleTargetWeapon.weaponDisarm
    ) {
      throw new CombatItemUnavailableError();
    }
    // Player-facing availability is based only on revealed facts; the resulting
    // declaration still uses the full canonical facts for GM-owned mechanics.
    const acting = toOption(actingRecord);
    const targetWeapon = toOption(targetRecord);
    if (
      acting.category !== "weapon" ||
      targetWeapon.category !== "weapon" ||
      acting.weaponDisarm?.capability !== "trap" ||
      !targetWeapon.weaponDisarm
    ) {
      throw new CombatItemUnavailableError();
    }
    const mismatch = resolveWeaponDisarmMismatch({
      actingControlRating: acting.weaponDisarm.controlRating,
      targetControlRating: targetWeapon.weaponDisarm.controlRating,
    });
    if (!mismatch.feasible) throw new CombatItemUnavailableError();

    return {
      actingWeapon: {
        capability: "trap",
        controlRating: acting.weaponDisarm.controlRating,
        itemId: acting.id,
        itemRevision: acting.revision,
        label: acting.label,
        parryModifier: acting.weaponDisarm.parryModifier,
        templateId: acting.templateId,
      },
      method: input.method,
      phase: input.phase,
      targetParticipantId: target.participantId,
      targetWeapon: {
        capability: targetWeapon.weaponDisarm.capability,
        controlRating: targetWeapon.weaponDisarm.controlRating,
        itemId: targetWeapon.id,
        itemRevision: targetWeapon.revision,
        label: targetWeapon.label,
        parryModifier: targetWeapon.weaponDisarm.parryModifier,
        templateId: targetWeapon.templateId,
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

  async commitThrownWeaponAttack(
    input: CommitCombatThrownWeaponAttackInput,
  ): Promise<{ encounter: EncounterSession; item: ApplyCombatItemInteractionResult }> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.client.$transaction(
          async (transaction) => {
            await transaction.$queryRaw(
              Prisma.sql`SELECT "id" FROM "Encounter" WHERE "id" = ${input.encounterId} FOR UPDATE`,
            );
            await this.assertScenarioAllowsCombatMutation(input.scenarioId, transaction);
            const persistedEncounter = (
              await createPrismaCombatStateReadRepository(transaction).getFullEncounterById(
                input.encounterId,
              )
            )?.encounter;
            if (
              !persistedEncounter ||
              persistedEncounter.updatedAt !== input.expectedEncounterRevision ||
              persistedEncounter.campaignId !== input.campaignId ||
              persistedEncounter.scenarioId !== input.scenarioId ||
              findCombatCommand(persistedEncounter, input.commandId) ||
              findCombatCommand(input.session, input.commandId)?.type !== "roll_attack"
            ) {
              throw new CombatItemUnavailableError();
            }

            const repository = createPrismaCharacterEquipmentRepository(transaction);
            const itemBefore = await repository.getCanonicalEquipmentItemById(input.itemId);
            const loadoutsBefore = await repository.getCharacterLoadouts(input.ownerCharacterId);
            const readyInLoadout = loadoutsBefore.some((loadout) =>
              [
                loadout.activePrimaryWeaponItemId,
                loadout.activeSecondaryWeaponItemId,
                loadout.activeMissileWeaponItemId,
                ...loadout.quickAccessItemIds,
              ].includes(input.itemId),
            );
            if (
              !itemBefore ||
              !itemBefore.revision ||
              itemBefore.campaignContextId !== input.campaignId ||
              itemBefore.holderCharacterId !== input.ownerCharacterId ||
              itemBefore.templateId !== input.templateId ||
              (!itemBefore.isEquipped && !readyInLoadout)
            ) {
              throw new CombatItemUnavailableError();
            }
            const item = await repository.applyCombatItemInteraction({
              actionId: input.commandId,
              campaignId: input.campaignId,
              encounterId: input.encounterId,
              expectedItemRevision: itemBefore.revision,
              itemId: input.itemId,
              operation: "drop",
              ownerCharacterId: input.ownerCharacterId,
            });
            await this.transactionBoundaryHook?.("item");
            if (!item.item.revision) {
              throw new CombatItemUnavailableError();
            }
            const undo: CombatThrownWeaponAttackUndo = {
              actionId: input.commandId,
              encounterId: input.encounterId,
              itemAfterRevision: item.item.revision,
              itemBefore,
              loadoutsBefore,
              ownerCharacterId: input.ownerCharacterId,
              version: 1,
            };
            const session = attachThrownWeaponUndo(input.session, input.commandId, undo);
            const encounter = await createPrismaCombatStatePersistenceRepository(transaction, {
              maxTransactionAttempts: 1,
            }).updateCombatEncounter({
              campaignId: input.campaignId,
              encounterId: input.encounterId,
              expectedRevision: input.expectedEncounterRevision,
              scenarioId: input.scenarioId,
              session,
            });
            await this.transactionBoundaryHook?.("encounter");
            await transaction.scenarioEventLog.create({
              data: {
                actorUserId: input.actorUserId,
                eventType: "encounter_updated",
                payloadJson: {
                  commandId: input.commandId,
                  encounterId: input.encounterId,
                  itemId: input.itemId,
                  resolutionKind: "canonical_thrown_weapon",
                },
                roundNumber: input.roundNumber,
                scenarioId: input.scenarioId,
                summary: "Canonical thrown weapon attack resolved.",
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

  async commitMissileWeaponAttack(
    input: CommitCombatMissileAttackInput,
  ): Promise<{ encounter: EncounterSession; undo: CombatMissileAmmoUndo }> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.client.$transaction(
          async (transaction) => {
            await transaction.$queryRaw(
              Prisma.sql`SELECT "id" FROM "Encounter" WHERE "id" = ${input.encounterId} FOR UPDATE`,
            );
            await this.assertScenarioAllowsCombatMutation(input.scenarioId, transaction);
            const persistedEncounter = (
              await createPrismaCombatStateReadRepository(transaction).getFullEncounterById(
                input.encounterId,
              )
            )?.encounter;
            const submittedCommand = findCombatCommand(input.session, input.commandId);
            if (
              !persistedEncounter ||
              persistedEncounter.campaignId !== input.campaignId ||
              persistedEncounter.scenarioId !== input.scenarioId ||
              submittedCommand?.type !== "roll_attack"
            ) {
              throw new CombatItemUnavailableError();
            }
            const priorCommand = findCombatCommand(persistedEncounter, input.commandId);
            if (priorCommand?.type === "roll_attack") {
              const priorUndo = priorCommand.facts.missileAmmoUndo as
                | CombatMissileAmmoUndo
                | undefined;
              if (
                !priorUndo ||
                priorUndo.ammoItemId !== input.ammoItemId ||
                priorUndo.ammoItemRevisionBefore !== input.ammoItemRevision ||
                !commandHasMissileAmmoUndo(persistedEncounter, input.commandId, priorUndo)
              ) {
                throw new CombatItemUnavailableError();
              }
              const currentAmmo = await transaction.characterEquipmentItem.findUnique({
                where: { id: input.ammoItemId },
              });
              if (
                !currentAmmo ||
                currentAmmo.quantity !== priorUndo.quantityAfter ||
                currentAmmo.updatedAt.toISOString() !== priorUndo.ammoItemRevisionAfter
              ) {
                throw new CombatItemUnavailableError();
              }
              return { encounter: persistedEncounter, undo: priorUndo };
            }
            if (persistedEncounter.updatedAt !== input.expectedEncounterRevision) {
              throw new CombatItemUnavailableError();
            }
            const readiness = submittedCommand.facts.previousMissileReadiness as
              | { ammoItemId?: string; ammoItemRevision?: string }
              | undefined;
            if (
              readiness?.ammoItemId !== input.ammoItemId ||
              readiness.ammoItemRevision !== input.ammoItemRevision
            ) {
              throw new CombatItemUnavailableError();
            }
            await transaction.$queryRaw(
              Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" = ${input.ammoItemId} FOR UPDATE`,
            );
            const ammo = await transaction.characterEquipmentItem.findUnique({
              where: { id: input.ammoItemId },
            });
            const loadout = await transaction.characterLoadout.findFirst({
              where: { characterId: input.ownerCharacterId, isActive: true },
            });
            if (
              !ammo ||
              ammo.updatedAt.toISOString() !== input.ammoItemRevision ||
              ammo.campaignContextId !== input.campaignId ||
              ammo.holderCharacterId !== input.ownerCharacterId ||
              ammo.quantity < 1 ||
              !loadout?.activeAmmoItemIds.includes(input.ammoItemId)
            ) {
              throw new CombatItemUnavailableError();
            }
            const quantityAfter = ammo.quantity - 1;
            const ammoAfter = await transaction.characterEquipmentItem.update({
              data: {
                quantity: quantityAfter,
                updatedAt: new Date(Math.max(Date.now(), ammo.updatedAt.getTime() + 1)),
              },
              where: { id: ammo.id },
            });
            await this.transactionBoundaryHook?.("item");
            const undo: CombatMissileAmmoUndo = {
              actionId: input.commandId,
              ammoItemId: ammo.id,
              ammoItemRevisionAfter: ammoAfter.updatedAt.toISOString(),
              ammoItemRevisionBefore: input.ammoItemRevision,
              encounterId: input.encounterId,
              quantityAfter,
              quantityBefore: ammo.quantity,
              version: 1,
            };
            const session = attachMissileAmmoUndo(input.session, input.commandId, undo);
            const encounter = await createPrismaCombatStatePersistenceRepository(transaction, {
              maxTransactionAttempts: 1,
            }).updateCombatEncounter({
              campaignId: input.campaignId,
              encounterId: input.encounterId,
              expectedRevision: input.expectedEncounterRevision,
              scenarioId: input.scenarioId,
              session,
            });
            await this.transactionBoundaryHook?.("encounter");
            await transaction.scenarioEventLog.create({
              data: {
                actorUserId: input.actorUserId,
                eventType: "encounter_updated",
                payloadJson: {
                  ammoItemId: ammo.id,
                  commandId: input.commandId,
                  encounterId: input.encounterId,
                  quantityAfter,
                  resolutionKind: "canonical_missile_ammunition",
                },
                roundNumber: input.roundNumber,
                scenarioId: input.scenarioId,
                summary: "Canonical missile ammunition consumed.",
              },
            });
            await this.transactionBoundaryHook?.("event");
            return { encounter, undo };
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

  async commitDisarm(
    input: CommitCombatDisarmInput,
  ): Promise<{ encounter: EncounterSession; item?: ApplyCombatItemInteractionResult }> {
    const completedAttempt = findDisarmAttempt(input.session, input.commandId);
    if (
      input.session.id !== input.encounterId ||
      input.session.campaignId !== input.campaignId ||
      input.session.scenarioId !== input.scenarioId ||
      completedAttempt?.status !== "committed" ||
      !completedAttempt.result?.disarmed
    ) {
      throw new CombatItemUnavailableError();
    }
    for (let transactionAttempt = 1; transactionAttempt <= 3; transactionAttempt += 1) {
      try {
        return await this.client.$transaction(
          async (transaction) => {
            await transaction.$queryRaw(
              Prisma.sql`SELECT "id" FROM "Encounter" WHERE "id" = ${input.encounterId} FOR UPDATE`,
            );
            await this.assertScenarioAllowsCombatMutation(input.scenarioId, transaction);
            const persistedEncounter = (
              await createPrismaCombatStateReadRepository(transaction).getFullEncounterById(
                input.encounterId,
              )
            )?.encounter;
            if (
              !persistedEncounter ||
              persistedEncounter.campaignId !== input.campaignId ||
              persistedEncounter.scenarioId !== input.scenarioId
            ) {
              throw new CombatItemUnavailableError();
            }

            const priorCommand = findCombatCommand(persistedEncounter, input.commandId);
            if (priorCommand?.type === "commit_disarm") {
              const undo = priorCommand.facts.disarmItemUndo as
                | CombatThrownWeaponAttackUndo
                | undefined;
              if (
                !undo ||
                undo.ownerCharacterId !== input.ownerCharacterId ||
                undo.itemBefore.id !== completedAttempt.targetWeaponItemId ||
                !commandHasDisarmItemUndo(persistedEncounter, input.commandId, undo)
              ) {
                throw new CombatItemUnavailableError();
              }
              const canonical = await createPrismaCharacterEquipmentRepository(
                transaction,
              ).getCanonicalEquipmentItemById(undo.itemBefore.id);
              if (!canonical || canonical.revision !== undo.itemAfterRevision) {
                throw new CombatItemUnavailableError();
              }
              return {
                encounter: persistedEncounter,
                item: { alreadyApplied: true, item: canonical },
              };
            }
            if (persistedEncounter.updatedAt !== input.expectedEncounterRevision) {
              throw new CombatItemUnavailableError();
            }
            const persistedState = persistedEncounter.combatRoundState;
            const persistedAttempt = persistedState
              ? [persistedState, ...persistedState.rounds]
                  .flatMap((round) => round.disarmAttempts)
                  .find((attempt) => attempt.id === completedAttempt.id)
              : undefined;
            if (
              persistedAttempt?.status !== "awaiting_commit" ||
              !persistedAttempt.result?.disarmed ||
              persistedAttempt.targetWeaponItemId !== completedAttempt.targetWeaponItemId ||
              persistedAttempt.targetWeaponItemRevision !==
                completedAttempt.targetWeaponItemRevision
            ) {
              throw new CombatItemUnavailableError();
            }

            const repository = createPrismaCharacterEquipmentRepository(transaction);
            const itemBefore = await repository.getCanonicalEquipmentItemById(
              completedAttempt.targetWeaponItemId,
            );
            const loadoutsBefore = await repository.getCharacterLoadouts(input.ownerCharacterId);
            if (
              !itemBefore ||
              !itemBefore.revision ||
              itemBefore.revision !== completedAttempt.targetWeaponItemRevision ||
              itemBefore.campaignContextId !== input.campaignId ||
              itemBefore.holderCharacterId !== input.ownerCharacterId ||
              itemBefore.templateId !== completedAttempt.targetWeaponTemplateId ||
              itemBefore.category !== "weapon"
            ) {
              throw new CombatItemUnavailableError();
            }
            const item = await repository.applyCombatItemInteraction({
              actionId: input.commandId,
              campaignId: input.campaignId,
              encounterId: input.encounterId,
              expectedItemRevision: itemBefore.revision,
              itemId: itemBefore.id,
              operation: "drop",
              ownerCharacterId: input.ownerCharacterId,
            });
            await this.transactionBoundaryHook?.("item");
            if (!item.item.revision) throw new CombatItemUnavailableError();
            const undo: CombatThrownWeaponAttackUndo = {
              actionId: input.commandId,
              encounterId: input.encounterId,
              itemAfterRevision: item.item.revision,
              itemBefore,
              loadoutsBefore,
              ownerCharacterId: input.ownerCharacterId,
              version: 1,
            };
            const session = attachDisarmItemUndo(input.session, input.commandId, undo);
            const encounter = await createPrismaCombatStatePersistenceRepository(transaction, {
              maxTransactionAttempts: 1,
            }).updateCombatEncounter({
              campaignId: input.campaignId,
              encounterId: input.encounterId,
              expectedRevision: input.expectedEncounterRevision,
              scenarioId: input.scenarioId,
              session,
            });
            await this.transactionBoundaryHook?.("encounter");
            await transaction.scenarioEventLog.create({
              data: {
                actorUserId: input.actorUserId,
                eventType: "encounter_updated",
                payloadJson: {
                  commandId: input.commandId,
                  encounterId: input.encounterId,
                  itemId: itemBefore.id,
                  resolutionKind: "canonical_disarm",
                },
                roundNumber: input.roundNumber,
                scenarioId: input.scenarioId,
                summary: "Canonical Disarm resolved.",
              },
            });
            await this.transactionBoundaryHook?.("event");
            return { encounter, item };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!isRetryableCombatTransactionError(error)) throw error;
        if (transactionAttempt === 3) {
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

  async commitDisarmUndo(input: {
    actorUserId: string;
    campaignId: string;
    encounterId: string;
    expectedEncounterRevision: string;
    participantStateUpdates?: Array<{
      expectedRevision: string;
      participantId: string;
      scenarioId: string;
      state: ScenarioParticipantState;
    }>;
    scenarioId: string;
    session: EncounterSession;
    undos: Array<{ commandId: string; undo: CombatThrownWeaponAttackUndo }>;
  }): Promise<EncounterSession> {
    return this.client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Encounter" WHERE "id" = ${input.encounterId} FOR UPDATE`,
        );
        await this.assertScenarioAllowsCombatMutation(input.scenarioId, transaction);
        const persistedEncounter = (
          await createPrismaCombatStateReadRepository(transaction).getFullEncounterById(
            input.encounterId,
          )
        )?.encounter;
        if (
          !persistedEncounter ||
          input.undos.length === 0 ||
          persistedEncounter.updatedAt !== input.expectedEncounterRevision ||
          persistedEncounter.campaignId !== input.campaignId ||
          persistedEncounter.scenarioId !== input.scenarioId ||
          input.undos.some(
            ({ commandId, undo }) =>
              !commandHasDisarmItemUndo(persistedEncounter, commandId, undo) ||
              findCombatCommand(input.session, commandId),
          )
        ) {
          throw new CombatItemUnavailableError();
        }
        const repository = createPrismaCharacterEquipmentRepository(transaction);
        if (!repository.restoreCombatThrownWeaponAttack) throw new CombatItemUnavailableError();
        for (const { undo } of input.undos) {
          await repository.restoreCombatThrownWeaponAttack({
            campaignId: input.campaignId,
            undo,
          });
        }
        await this.transactionBoundaryHook?.("item");
        const encounter = await createPrismaCombatStatePersistenceRepository(transaction, {
          maxTransactionAttempts: 1,
        }).updateCombatEncounter({
          campaignId: input.campaignId,
          encounterId: input.encounterId,
          expectedRevision: input.expectedEncounterRevision,
          participantStateUpdates: input.participantStateUpdates,
          scenarioId: input.scenarioId,
          session: input.session,
        });
        await this.transactionBoundaryHook?.("encounter");
        await transaction.scenarioEventLog.create({
          data: {
            actorUserId: input.actorUserId,
            eventType: "encounter_updated",
            payloadJson: {
              commandIds: input.undos.map(({ commandId }) => commandId),
              encounterId: input.encounterId,
              itemIds: input.undos.map(({ undo }) => undo.itemBefore.id),
              resolutionKind: "canonical_disarm_undo",
            },
            scenarioId: input.scenarioId,
            summary: "Canonical Disarm undone.",
          },
        });
        await this.transactionBoundaryHook?.("event");
        return encounter;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async commitThrownWeaponAttackUndo(input: {
    actorUserId: string;
    campaignId: string;
    encounterId: string;
    expectedEncounterRevision: string;
    participantStateUpdates?: Array<{
      expectedRevision: string;
      participantId: string;
      scenarioId: string;
      state: ScenarioParticipantState;
    }>;
    scenarioId: string;
    session: EncounterSession;
    undos: Array<{ commandId: string; undo: CombatThrownWeaponAttackUndo }>;
  }): Promise<EncounterSession> {
    return this.client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Encounter" WHERE "id" = ${input.encounterId} FOR UPDATE`,
        );
        await this.assertScenarioAllowsCombatMutation(input.scenarioId, transaction);
        const persistedEncounter = (
          await createPrismaCombatStateReadRepository(transaction).getFullEncounterById(
            input.encounterId,
          )
        )?.encounter;
        if (
          !persistedEncounter ||
          input.undos.length === 0 ||
          persistedEncounter.updatedAt !== input.expectedEncounterRevision ||
          persistedEncounter.campaignId !== input.campaignId ||
          persistedEncounter.scenarioId !== input.scenarioId ||
          input.undos.some(
            ({ commandId, undo }) =>
              !commandHasThrownWeaponUndo(persistedEncounter, commandId, undo) ||
              findCombatCommand(input.session, commandId),
          )
        ) {
          throw new CombatItemUnavailableError();
        }
        const repository = createPrismaCharacterEquipmentRepository(transaction);
        if (!repository.restoreCombatThrownWeaponAttack) {
          throw new CombatItemUnavailableError();
        }
        for (const { undo } of input.undos) {
          await repository.restoreCombatThrownWeaponAttack({
            campaignId: input.campaignId,
            undo,
          });
        }
        await this.transactionBoundaryHook?.("item");
        const encounter = await createPrismaCombatStatePersistenceRepository(transaction, {
          maxTransactionAttempts: 1,
        }).updateCombatEncounter({
          campaignId: input.campaignId,
          encounterId: input.encounterId,
          expectedRevision: input.expectedEncounterRevision,
          participantStateUpdates: input.participantStateUpdates,
          scenarioId: input.scenarioId,
          session: input.session,
        });
        await this.transactionBoundaryHook?.("encounter");
        await transaction.scenarioEventLog.create({
          data: {
            actorUserId: input.actorUserId,
            eventType: "encounter_updated",
            payloadJson: {
              commandIds: input.undos.map(({ commandId }) => commandId),
              encounterId: input.encounterId,
              itemIds: input.undos.map(({ undo }) => undo.itemBefore.id),
              resolutionKind: "canonical_thrown_weapon_undo",
            },
            scenarioId: input.scenarioId,
            summary: "Canonical thrown weapon attack undone.",
          },
        });
        await this.transactionBoundaryHook?.("event");
        return encounter;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async commitMissileWeaponAttackUndo(input: {
    actorUserId: string;
    campaignId: string;
    commandId: string;
    encounterId: string;
    expectedEncounterRevision: string;
    participantStateUpdates?: Array<{
      expectedRevision: string;
      participantId: string;
      scenarioId: string;
      state: ScenarioParticipantState;
    }>;
    scenarioId: string;
    session: EncounterSession;
    undo: CombatMissileAmmoUndo;
  }): Promise<EncounterSession> {
    return this.client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Encounter" WHERE "id" = ${input.encounterId} FOR UPDATE`,
        );
        await this.assertScenarioAllowsCombatMutation(input.scenarioId, transaction);
        const persistedEncounter = (
          await createPrismaCombatStateReadRepository(transaction).getFullEncounterById(
            input.encounterId,
          )
        )?.encounter;
        if (
          !persistedEncounter ||
          persistedEncounter.updatedAt !== input.expectedEncounterRevision ||
          persistedEncounter.campaignId !== input.campaignId ||
          persistedEncounter.scenarioId !== input.scenarioId ||
          !commandHasMissileAmmoUndo(persistedEncounter, input.commandId, input.undo) ||
          findCombatCommand(input.session, input.commandId)
        ) {
          throw new CombatItemUnavailableError();
        }
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" = ${input.undo.ammoItemId} FOR UPDATE`,
        );
        const ammo = await transaction.characterEquipmentItem.findUnique({
          where: { id: input.undo.ammoItemId },
        });
        if (
          !ammo ||
          ammo.campaignContextId !== input.campaignId ||
          ammo.quantity !== input.undo.quantityAfter ||
          ammo.updatedAt.toISOString() !== input.undo.ammoItemRevisionAfter
        ) {
          throw new CombatItemUnavailableError();
        }
        await transaction.characterEquipmentItem.update({
          data: {
            quantity: input.undo.quantityBefore,
            updatedAt: new Date(Math.max(Date.now(), ammo.updatedAt.getTime() + 1)),
          },
          where: { id: ammo.id },
        });
        await this.transactionBoundaryHook?.("item");
        const encounter = await createPrismaCombatStatePersistenceRepository(transaction, {
          maxTransactionAttempts: 1,
        }).updateCombatEncounter({
          campaignId: input.campaignId,
          encounterId: input.encounterId,
          expectedRevision: input.expectedEncounterRevision,
          participantStateUpdates: input.participantStateUpdates,
          scenarioId: input.scenarioId,
          session: input.session,
        });
        await this.transactionBoundaryHook?.("encounter");
        await transaction.scenarioEventLog.create({
          data: {
            actorUserId: input.actorUserId,
            eventType: "encounter_updated",
            payloadJson: {
              ammoItemId: ammo.id,
              commandId: input.commandId,
              encounterId: input.encounterId,
              quantity: input.undo.quantityBefore,
              resolutionKind: "canonical_missile_ammunition_undo",
            },
            scenarioId: input.scenarioId,
            summary: "Canonical missile ammunition restored.",
          },
        });
        await this.transactionBoundaryHook?.("event");
        return encounter;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
            await this.assertScenarioAllowsCombatMutation(input.scenarioId, transaction);
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

  private async assertScenarioAllowsCombatMutation(
    scenarioId: string,
    transaction: Pick<Prisma.TransactionClient, "scenario">,
  ): Promise<void> {
    const scenario = await transaction.scenario.findUnique({
      where: { id: scenarioId },
      select: { status: true },
    });

    if (!scenario) {
      throw new CombatItemUnavailableError();
    }

    if (!isScenarioLiveInteractive(scenario.status)) {
      throw new CombatItemUnavailableError();
    }
  }
}
