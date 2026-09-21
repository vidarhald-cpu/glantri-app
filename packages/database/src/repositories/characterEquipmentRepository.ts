import { randomUUID } from "node:crypto";

import {
  CharacterLoadoutSchema,
  CanonicalEquipmentItemSchema,
  EquipmentItemSchema,
  EquipmentItemFactsV1Schema,
  ItemMechanicalOverridesSchema,
  isSupportedAmmunitionTemplate,
  StorageLocationSchema,
  type CharacterLoadout as DomainCharacterLoadout,
  type AssignedEquipmentItem,
  type CanonicalEquipmentItem,
  type CombatItemInteractionOperation,
  type ItemStorageAssignment,
  type StorageLocation,
} from "@glantri/domain";
import { createDefaultEquipmentLocations, equipmentTemplatesById } from "@glantri/content";
import { Prisma, PrismaClient } from "@prisma/client";

import { prisma as defaultPrisma } from "../client";

function parseStringArrayOrNull(value: unknown): string[] | null {
  if (value == null) {
    return null;
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("Expected JSON string array.");
  }

  return value;
}

const COMBAT_ITEM_PRESENT_PREFIX = "glantri:combat-item:present:";
const COMBAT_ITEM_APPLIED_PREFIX = "glantri:combat-item:applied:";

function isInternalCombatItemTag(tag: string): boolean {
  return tag.startsWith(COMBAT_ITEM_PRESENT_PREFIX) || tag.startsWith(COMBAT_ITEM_APPLIED_PREFIX);
}

function parseStoredStatusTags(value: unknown): string[] {
  return parseStringArrayOrNull(value) ?? [];
}

function visibleStatusTags(value: unknown): string[] | null {
  const visible = parseStoredStatusTags(value).filter((tag) => !isInternalCombatItemTag(tag));
  return visible.length > 0 ? visible : null;
}

function serializeJsonArray(
  value: string[] | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  return value == null ? Prisma.JsonNull : value;
}

function serializeItemFacts(value: CanonicalEquipmentItem["itemFacts"]): Prisma.InputJsonValue {
  return EquipmentItemFactsV1Schema.parse(value) as unknown as Prisma.InputJsonValue;
}

/**
 * The single canonical derivation of a campaign Item identifier. Every writer —
 * the Campaign Items surface and staged intake acceptance alike — uses it, so
 * the identifier shape is never restated.
 */
export function buildCampaignEquipmentItemId(campaignId: string): string {
  return `${campaignId}:item-${randomUUID()}`;
}

/**
 * A descriptive-only campaign Item: a game-world object the GM described in
 * words, with no Equipment template and therefore no mechanical behaviour. It
 * has campaign presence and no holder until somebody picks it up.
 *
 * `description` becomes the Item's player-visible description, which is the
 * same `notes` field the Campaign Items surface writes and labels
 * "Description". GM-only prose has no place here; it is stored separately and
 * passed to {@link campaignEquipmentItemCreateData}.
 */
export function buildDescriptiveCampaignEquipmentItem(input: {
  campaignId: string;
  description: string | null;
  id: string;
  title: string;
}): CanonicalEquipmentItem {
  return CanonicalEquipmentItemSchema.parse({
    acquiredFrom: null,
    campaignContextId: input.campaignId,
    category: null,
    characterId: null,
    conditionState: "intact",
    displayName: input.title,
    durabilityCurrent: null,
    durabilityMax: null,
    encumbranceOverride: null,
    holderCharacterId: null,
    id: input.id,
    isEquipped: false,
    isFavorite: null,
    isStackable: false,
    itemFacts: EquipmentItemFactsV1Schema.parse({
      activeMechanics: [],
      descriptiveTraits: [],
      templateOverrides: [],
      unsupportedCapabilities: [],
      version: 1,
    }),
    itemKind: "descriptive_only",
    material: "other",
    mechanicalOverrides: [],
    notes: input.description,
    physicalBaseEncumbrance: null,
    previousStorageAssignment: null,
    quality: "standard",
    quantity: 1,
    specificityType: "specific",
    statusTags: null,
    storageAssignment: null,
    templateId: null,
    valueOverride: null,
  });
}

/**
 * The single canonical mapping from a domain Item to its stored row. Shared so
 * that every writer — including staged intake acceptance, which must create the
 * Item inside the same transaction as its Artifact — uses one derivation.
 *
 * `gmNotes` is deliberately not part of the domain Item. It is stored beside
 * the Item and read only through the GM-scoped path, so it cannot travel inside
 * any Item value and therefore cannot reach a player-facing projection.
 */
export function campaignEquipmentItemCreateData(
  item: CanonicalEquipmentItem,
  gmNotes?: string | null,
): Prisma.CharacterEquipmentItemUncheckedCreateInput {
  return {
    gmNotes: gmNotes ?? null,
    acquiredFrom: item.acquiredFrom ?? null,
    campaignContextId: item.campaignContextId,
    category: item.category,
    holderCharacterId: item.holderCharacterId,
    conditionState: item.conditionState,
    displayName: item.displayName ?? null,
    durabilityCurrent: item.durabilityCurrent ?? null,
    durabilityMax: item.durabilityMax ?? null,
    encumbranceOverride: item.encumbranceOverride ?? null,
    id: item.id,
    isEquipped: item.isEquipped ?? null,
    isFavorite: item.isFavorite ?? null,
    isStackable: item.isStackable,
    itemFactsJson: serializeItemFacts(item.itemFacts),
    mechanicalOverridesJson: ItemMechanicalOverridesSchema.parse(
      item.mechanicalOverrides ?? [],
    ) as Prisma.InputJsonValue,
    physicalBaseEncumbrance: item.physicalBaseEncumbrance ?? null,
    locationId: item.storageAssignment?.locationId ?? null,
    carryMode: item.storageAssignment?.carryMode ?? null,
    previousLocationId: item.previousStorageAssignment?.locationId ?? null,
    previousCarryMode: item.previousStorageAssignment?.carryMode ?? null,
    material: item.material,
    notes: item.notes ?? null,
    quality: item.quality,
    quantity: item.quantity,
    specificityType: item.specificityType,
    statusTagsJson: serializeJsonArray(item.statusTags),
    templateId: item.templateId,
    valueOverride: item.valueOverride ?? null,
  };
}

function preserveStoredItemFacts(
  value: CanonicalEquipmentItem["itemFacts"],
  stored: unknown,
): Prisma.InputJsonValue {
  const parsed = EquipmentItemFactsV1Schema.parse(value);
  const old =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};
  const result: Record<string, unknown> = { ...old, ...parsed };
  for (const key of [
    "activeMechanics",
    "templateOverrides",
    "descriptiveTraits",
    "unsupportedCapabilities",
  ] as const) {
    const previous = Array.isArray(old[key]) ? (old[key] as Array<Record<string, unknown>>) : [];
    result[key] = parsed[key].map((fact) => ({
      ...previous.find((entry) => entry?.id === fact.id),
      ...fact,
    }));
  }
  return result as Prisma.InputJsonValue;
}

function mapCanonicalEquipmentItem(record: {
  acquiredFrom: string | null;
  campaignContextId: string | null;
  category: string | null;
  holderCharacterId: string | null;
  conditionState: string;
  displayName: string | null;
  durabilityCurrent: number | null;
  durabilityMax: number | null;
  encumbranceOverride: number | null;
  id: string;
  isEquipped: boolean | null;
  isFavorite: boolean | null;
  isStackable: boolean;
  itemFactsJson: unknown;
  locationId: string | null;
  carryMode: string | null;
  previousLocationId: string | null;
  previousCarryMode: string | null;
  material: string;
  notes: string | null;
  quality: string;
  quantity: number;
  specificityType: string;
  statusTagsJson: unknown;
  templateId: string | null;
  mechanicalOverridesJson?: unknown;
  physicalBaseEncumbrance?: number | null;
  valueOverride: number | null;
  updatedAt: Date;
}): CanonicalEquipmentItem {
  if (
    record.quantity === 0 &&
    (!record.templateId ||
      !equipmentTemplatesById[record.templateId] ||
      !isSupportedAmmunitionTemplate(equipmentTemplatesById[record.templateId]))
  )
    throw new Error("Only supported exhausted ammunition may have zero quantity.");
  return CanonicalEquipmentItemSchema.parse({
    acquiredFrom: record.acquiredFrom,
    campaignContextId: record.campaignContextId,
    category: record.category,
    characterId: record.holderCharacterId,
    conditionState: record.conditionState,
    displayName: record.displayName,
    durabilityCurrent: record.durabilityCurrent,
    durabilityMax: record.durabilityMax,
    encumbranceOverride: record.encumbranceOverride,
    holderCharacterId: record.holderCharacterId,
    id: record.id,
    isEquipped: record.isEquipped,
    isFavorite: record.isFavorite,
    isStackable: record.isStackable,
    itemFacts: EquipmentItemFactsV1Schema.parse(record.itemFactsJson),
    material: record.material,
    notes: record.notes,
    quality: record.quality,
    quantity: record.quantity,
    revision: record.updatedAt.toISOString(),
    specialProperties: null,
    specificityType: record.specificityType,
    statusTags: visibleStatusTags(record.statusTagsJson),
    storageAssignment:
      record.locationId && record.carryMode
        ? {
            carryMode: record.carryMode,
            locationId: record.locationId,
          }
        : null,
    previousStorageAssignment:
      record.previousLocationId && record.previousCarryMode
        ? {
            carryMode: record.previousCarryMode,
            locationId: record.previousLocationId,
          }
        : null,
    templateId: record.templateId,
    itemKind: record.templateId === null ? "descriptive_only" : "template_backed",
    mechanicalOverrides: ItemMechanicalOverridesSchema.parse(record.mechanicalOverridesJson ?? []),
    physicalBaseEncumbrance: record.physicalBaseEncumbrance ?? null,
    valueOverride: record.valueOverride,
  });
}

function mapEquipmentItem(
  record: Parameters<typeof mapCanonicalEquipmentItem>[0],
): AssignedEquipmentItem {
  return EquipmentItemSchema.parse(mapCanonicalEquipmentItem(record));
}

function mapStorageLocation(record: {
  availabilityClass?: string | null;
  characterId: string;
  id: string;
  isAccessibleInEncounter: boolean;
  isMobile: boolean;
  name: string;
  notes: string | null;
  parentLocationId: string | null;
  type: string;
}): StorageLocation {
  const availabilityClass =
    record.availabilityClass ?? (record.type.endsWith("_system") ? "with_you" : "elsewhere");

  return StorageLocationSchema.parse({
    availabilityClass,
    characterId: record.characterId,
    id: record.id,
    isAccessibleInEncounter: record.isAccessibleInEncounter,
    isMobile: record.isMobile,
    name: record.name,
    notes: record.notes,
    parentLocationId: record.parentLocationId,
    type: record.type,
  });
}

function mapLoadout(record: {
  activeAmmoItemIds: string[];
  activeMissileWeaponItemId: string | null;
  activePrimaryWeaponItemId: string | null;
  activeSecondaryWeaponItemId: string | null;
  characterId: string;
  id: string;
  isActive: boolean;
  name: string;
  notes: string | null;
  quickAccessItemIdsJson: unknown;
  readyShieldItemId: string | null;
  wornArmorItemId: string | null;
}): DomainCharacterLoadout {
  return CharacterLoadoutSchema.parse({
    activeAmmoItemIds: record.activeAmmoItemIds,
    activeMissileWeaponItemId: record.activeMissileWeaponItemId,
    activePrimaryWeaponItemId: record.activePrimaryWeaponItemId,
    activeSecondaryWeaponItemId: record.activeSecondaryWeaponItemId,
    characterId: record.characterId,
    id: record.id,
    isActive: record.isActive,
    name: record.name,
    notes: record.notes,
    quickAccessItemIds: parseStringArrayOrNull(record.quickAccessItemIdsJson) ?? [],
    readyShieldItemId: record.readyShieldItemId,
    wornArmorItemId: record.wornArmorItemId,
  });
}

export interface CharacterEquipmentRepository {
  /** A coherent, share-locked read of every normalized record in one Character aggregate. */
  getCharacterEquipmentAggregateState(
    characterId: string,
  ): Promise<CharacterEquipmentAggregateState>;
  /**
   * Runs one equipment mutation under the aggregate revision lock.  Callers
   * must supply the revision they read; stale callers change no participating
   * record.
   */
  mutateCharacterEquipmentAggregate<T>(input: {
    characterId: string;
    expectedRevision: number;
    mutation: (repository: CharacterEquipmentRepository) => Promise<T>;
  }): Promise<{ result: T; revision: number }>;
  createCharacterStorageLocation(location: StorageLocation): Promise<StorageLocation>;
  removeCharacterStorageLocation(characterId: string, locationId: string): Promise<void>;
  createCharacterEquipmentItem(item: AssignedEquipmentItem): Promise<AssignedEquipmentItem>;
  createCampaignEquipmentItem(item: CanonicalEquipmentItem): Promise<CanonicalEquipmentItem>;
  updateCampaignEquipmentItemAuthoring(
    item: CanonicalEquipmentItem,
  ): Promise<CanonicalEquipmentItem>;
  transferCampaignEquipmentItem(
    input: TransferCampaignEquipmentItemInput,
  ): Promise<CanonicalEquipmentItem>;
  acquireUnheldCampaignEquipmentItem?(input: {
    campaignId: string;
    evidence?: EquipmentTransitionEvidence;
    expectedTargetRevision?: number;
    expectedItemRevision?: string;
    itemId: string;
    targetCharacterId: string;
    targetStorageAssignment: ItemStorageAssignment;
  }): Promise<CanonicalEquipmentItem>;
  releaseHeldCampaignEquipmentItem?(input: {
    campaignId: string;
    evidence?: EquipmentTransitionEvidence;
    expectedSourceRevision?: number;
    expectedItemRevision?: string;
    itemId: string;
    sourceCharacterId: string;
  }): Promise<CanonicalEquipmentItem>;
  recordEquipmentTransition?(input: EquipmentTransitionEventInput): Promise<void>;
  applyCombatItemInteraction(
    input: ApplyCombatItemInteractionInput,
  ): Promise<ApplyCombatItemInteractionResult>;
  restoreCombatThrownWeaponAttack?(
    input: RestoreCombatThrownWeaponAttackInput,
  ): Promise<CanonicalEquipmentItem>;
  getCombatItemInteractionRecords(campaignId: string): Promise<CombatItemInteractionRecord[]>;
  updateCharacterEquipmentItem(item: AssignedEquipmentItem): Promise<AssignedEquipmentItem>;
  removeCharacterEquipmentItem(characterId: string, itemId: string): Promise<void>;
  moveCharacterEquipmentItem(
    characterId: string,
    itemId: string,
    storageAssignment: ItemStorageAssignment,
  ): Promise<AssignedEquipmentItem>;
  upsertCharacterLoadout(loadout: DomainCharacterLoadout): Promise<DomainCharacterLoadout>;
  ensureDefaultEquipmentLocations(characterId: string): Promise<StorageLocation[]>;
  getCharacterEquipmentItems(characterId: string): Promise<AssignedEquipmentItem[]>;
  getCanonicalEquipmentItemById(itemId: string): Promise<CanonicalEquipmentItem | null>;
  getCampaignEquipmentItems(campaignId: string): Promise<CanonicalEquipmentItem[]>;
  /**
   * GM-private Item notes, keyed by Item id. Deliberately a separate read: the
   * notes are never carried inside an Item value, so no Item projection can
   * disclose them and every caller of this method must be GM-scoped.
   */
  getCampaignEquipmentItemGmNotes(campaignId: string): Promise<Record<string, string>>;
  getCharacterStorageLocations(characterId: string): Promise<StorageLocation[]>;
  getCharacterLoadouts(characterId: string): Promise<DomainCharacterLoadout[]>;
  getCharacterEquipmentState(characterId: string): Promise<{
    items: AssignedEquipmentItem[];
    loadouts: DomainCharacterLoadout[];
    locations: StorageLocation[];
    revision: number;
  }>;
}

export interface CharacterEquipmentAggregateState {
  items: AssignedEquipmentItem[];
  loadouts: DomainCharacterLoadout[];
  locations: StorageLocation[];
  revision: number;
}

export class StaleCharacterEquipmentAggregateError extends Error {
  constructor() {
    super("Character equipment changed. Reload it before trying again.");
    this.name = "StaleCharacterEquipmentAggregateError";
  }
}

/** Only reads and idempotent lazy initialization may restart after a conflict. */
export async function retryCharacterEquipmentRead<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      const retryable =
        error instanceof StaleCharacterEquipmentAggregateError ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2034" ||
            (error.code === "P2010" && error.meta?.code === "40001") ||
            (error.code === "P2002" &&
              error.meta?.modelName === "CharacterEquipmentAggregate" &&
              Array.isArray(error.meta.target) &&
              error.meta.target.length === 1 &&
              error.meta.target[0] === "characterId")));
      if (!retryable || attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}

export interface CombatItemInteractionRecord {
  availableInEncounter: boolean;
  hidden: boolean;
  item: CanonicalEquipmentItem;
  presentEncounterId?: string;
}

export interface ApplyCombatItemInteractionInput {
  actionId: string;
  campaignId: string;
  encounterId: string;
  expectedItemRevision: string;
  itemId: string;
  operation: CombatItemInteractionOperation;
  ownerCharacterId: string;
  /** Canonical Encounter association; legacy status tags remain read-compatible. */
  presentInEncounter?: boolean;
  recipientCharacterId?: string;
}

export interface ApplyCombatItemInteractionResult {
  alreadyApplied: boolean;
  item: CanonicalEquipmentItem;
}

export interface CombatThrownWeaponAttackUndo {
  actionId: string;
  encounterId: string;
  itemAfterRevision: string;
  itemBefore: CanonicalEquipmentItem;
  loadoutsBefore: DomainCharacterLoadout[];
  ownerCharacterId: string;
  version: 1;
}

export interface RestoreCombatThrownWeaponAttackInput {
  campaignId: string;
  /** Canonical Encounter association; legacy status tags remain read-compatible. */
  presentInEncounter?: boolean;
  undo: CombatThrownWeaponAttackUndo;
}

export class CombatItemUnavailableError extends Error {
  constructor() {
    super("The selected Item is no longer available.");
    this.name = "CombatItemUnavailableError";
  }
}

export class CombatItemRevisionError extends Error {
  constructor() {
    super("The selected Item changed. Refresh and review the latest state.");
    this.name = "CombatItemRevisionError";
  }
}

export interface TransferCampaignEquipmentItemInput {
  campaignId: string;
  evidence?: EquipmentTransitionEvidence;
  itemId: string;
  sourceCharacterId: string;
  sourceExpectedRevision?: number;
  targetCharacterId: string;
  targetExpectedRevision?: number;
  targetStorageAssignment: ItemStorageAssignment;
  expectedItemRevision?: string;
}

export interface EquipmentTransitionEvidence {
  actorAuthority: "campaign_gm" | "character_controller" | "combat_controller";
  actorUserId: string;
  commandId?: string;
  encounterId?: string;
  scenarioId?: string;
}

export interface EquipmentTransitionEventInput extends EquipmentTransitionEvidence {
  after?: Record<string, unknown>;
  before?: Record<string, unknown>;
  campaignId?: string;
  characterId?: string;
  eventType: string;
  itemId: string;
  sourceCharacterId?: string;
  targetCharacterId?: string;
}

export class StaleEquipmentTransferError extends Error {
  constructor() {
    super("This item is no longer held by the expected Character.");
    this.name = "StaleEquipmentTransferError";
  }
}

export async function advanceCharacterEquipmentAggregates(input: {
  characterIds: readonly (string | null | undefined)[];
  client: Prisma.TransactionClient;
}): Promise<void> {
  const characterIds = [
    ...new Set(input.characterIds.filter((id): id is string => Boolean(id))),
  ].sort();
  for (const characterId of characterIds) {
    await input.client.characterEquipmentAggregate.upsert({
      create: { characterId },
      update: {},
      where: { characterId },
    });
  }
  if (characterIds.length === 0) return;
  await input.client.$queryRaw(
    Prisma.sql`SELECT "characterId" FROM "CharacterEquipmentAggregate" WHERE "characterId" IN (${Prisma.join(characterIds)}) ORDER BY "characterId" FOR UPDATE`,
  );
  const advanced = await input.client.characterEquipmentAggregate.updateMany({
    data: { revision: { increment: 1 } },
    where: { characterId: { in: characterIds } },
  });
  if (advanced.count !== characterIds.length) {
    throw new StaleCharacterEquipmentAggregateError();
  }
}

export function createPrismaCharacterEquipmentRepository(
  client?: PrismaClient | Prisma.TransactionClient,
): CharacterEquipmentRepository {
  const prisma = (client ?? defaultPrisma) as PrismaClient;
  const transactionClient = client && !("$transaction" in client) ? client : undefined;

  const loadAggregateState = async (
    transaction: Prisma.TransactionClient,
    characterId: string,
  ): Promise<CharacterEquipmentAggregateState> => {
    await transaction.characterEquipmentAggregate.upsert({
      create: { characterId },
      update: {},
      where: { characterId },
    });
    const aggregates = await transaction.$queryRaw<Array<{ revision: number }>>(
      Prisma.sql`SELECT "revision" FROM "CharacterEquipmentAggregate" WHERE "characterId" = ${characterId} FOR SHARE`,
    );
    const aggregate = aggregates[0];
    if (!aggregate) throw new Error("Character equipment aggregate not found.");
    const [items, locations, loadouts] = await Promise.all([
      transaction.characterEquipmentItem.findMany({
        orderBy: { createdAt: "asc" },
        where: {
          carryMode: { not: null },
          holderCharacterId: characterId,
          locationId: { not: null },
        },
      }),
      transaction.characterStorageLocation.findMany({
        orderBy: { createdAt: "asc" },
        where: { characterId },
      }),
      transaction.characterLoadout.findMany({
        orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        where: { characterId },
      }),
    ]);
    return {
      items: items.map(mapEquipmentItem),
      loadouts: loadouts.map(mapLoadout),
      locations: locations.map(mapStorageLocation),
      revision: aggregate.revision,
    };
  };

  return {
    async getCharacterEquipmentAggregateState(characterId) {
      const read = async (transaction: Prisma.TransactionClient) =>
        loadAggregateState(transaction, characterId);
      // READ COMMITTED lets FOR SHARE wait for a writer and read its committed
      // revision instead of rejecting an older repeatable-read snapshot (40001).
      // Holding that lock until all components are read prevents an aggregate
      // mutation from committing between queries. Caller-owned transactions keep
      // their isolation and must handle their own conflicts.
      return transactionClient
        ? read(transactionClient)
        : retryCharacterEquipmentRead(() =>
            prisma.$transaction(read, {
              isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            }),
          );
    },
    async mutateCharacterEquipmentAggregate(input) {
      if (input.expectedRevision < 0 || !Number.isInteger(input.expectedRevision)) {
        throw new StaleCharacterEquipmentAggregateError();
      }
      const mutate = async (transaction: Prisma.TransactionClient) => {
        await transaction.characterEquipmentAggregate.upsert({
          create: { characterId: input.characterId },
          update: {},
          where: { characterId: input.characterId },
        });
        const locked = await transaction.$queryRaw<Array<{ revision: number }>>(
          Prisma.sql`SELECT "revision" FROM "CharacterEquipmentAggregate" WHERE "characterId" = ${input.characterId} FOR UPDATE`,
        );
        if (locked[0]?.revision !== input.expectedRevision) {
          throw new StaleCharacterEquipmentAggregateError();
        }
        const result = await input.mutation(createPrismaCharacterEquipmentRepository(transaction));
        const advanced = await transaction.characterEquipmentAggregate.updateMany({
          data: { revision: { increment: 1 } },
          where: { characterId: input.characterId, revision: input.expectedRevision },
        });
        if (advanced.count !== 1) throw new StaleCharacterEquipmentAggregateError();
        return { result, revision: input.expectedRevision + 1 };
      };
      try {
        return transactionClient
          ? await mutate(transactionClient)
          : await prisma.$transaction(mutate, {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          throw new StaleCharacterEquipmentAggregateError();
        }
        throw error;
      }
    },
    async recordEquipmentTransition(input) {
      await prisma.equipmentTransitionEvent.create({
        data: {
          actorAuthority: input.actorAuthority,
          actorUserId: input.actorUserId,
          afterJson: input.after ? (input.after as Prisma.InputJsonValue) : Prisma.JsonNull,
          beforeJson: input.before ? (input.before as Prisma.InputJsonValue) : Prisma.JsonNull,
          campaignId: input.campaignId ?? null,
          characterId: input.characterId ?? null,
          commandId: input.commandId ?? null,
          encounterId: input.encounterId ?? null,
          eventType: input.eventType,
          itemId: input.itemId,
          scenarioId: input.scenarioId ?? null,
          sourceCharacterId: input.sourceCharacterId ?? null,
          targetCharacterId: input.targetCharacterId ?? null,
        },
      });
    },
    async createCharacterStorageLocation(location) {
      const created = await prisma.characterStorageLocation.create({
        data: {
          availabilityClass: location.availabilityClass,
          characterId: location.characterId,
          id: location.id,
          isAccessibleInEncounter: location.isAccessibleInEncounter,
          isMobile: location.isMobile,
          name: location.name,
          notes: location.notes ?? null,
          parentLocationId: location.parentLocationId ?? null,
          type: location.type,
        } as Prisma.CharacterStorageLocationUncheckedCreateInput,
      });

      return mapStorageLocation(created);
    },
    async removeCharacterStorageLocation(characterId, locationId) {
      const result = await prisma.characterStorageLocation.deleteMany({
        where: {
          characterId,
          id: locationId,
        },
      });

      if (result.count === 0) {
        throw new Error("Storage location not found for character.");
      }
    },
    async createCharacterEquipmentItem(item) {
      const created = await prisma.characterEquipmentItem.create({
        data: {
          acquiredFrom: item.acquiredFrom ?? null,
          campaignContextId: item.campaignContextId,
          category: item.category,
          holderCharacterId: item.holderCharacterId,
          conditionState: item.conditionState,
          displayName: item.displayName ?? null,
          durabilityCurrent: item.durabilityCurrent ?? null,
          durabilityMax: item.durabilityMax ?? null,
          encumbranceOverride: item.encumbranceOverride ?? null,
          id: item.id,
          isEquipped: item.isEquipped ?? null,
          isFavorite: item.isFavorite ?? null,
          isStackable: item.isStackable,
          itemFactsJson: serializeItemFacts(item.itemFacts),
          mechanicalOverridesJson: ItemMechanicalOverridesSchema.parse(
            item.mechanicalOverrides ?? [],
          ) as Prisma.InputJsonValue,
          physicalBaseEncumbrance: item.physicalBaseEncumbrance ?? null,
          locationId: item.storageAssignment.locationId,
          carryMode: item.storageAssignment.carryMode,
          previousLocationId: item.previousStorageAssignment?.locationId ?? null,
          previousCarryMode: item.previousStorageAssignment?.carryMode ?? null,
          material: item.material,
          notes: item.notes ?? null,
          quality: item.quality,
          quantity: item.quantity,
          specificityType: item.specificityType,
          statusTagsJson: serializeJsonArray(item.statusTags),
          templateId: item.templateId,
          valueOverride: item.valueOverride ?? null,
        },
      });

      return mapEquipmentItem(created);
    },
    async createCampaignEquipmentItem(item) {
      const created = await prisma.characterEquipmentItem.create({
        data: campaignEquipmentItemCreateData(item),
      });

      return mapCanonicalEquipmentItem(created);
    },
    async updateCampaignEquipmentItemAuthoring(item) {
      if (!item.revision) throw new StaleEquipmentTransferError();
      const persist = async (transaction: Prisma.TransactionClient) => {
        // Match the transfer lock order: holder aggregate, then the Item.
        if (item.holderCharacterId) {
          await transaction.characterEquipmentAggregate.upsert({
            create: { characterId: item.holderCharacterId },
            update: {},
            where: { characterId: item.holderCharacterId },
          });
          await transaction.$queryRaw(
            Prisma.sql`SELECT "characterId" FROM "CharacterEquipmentAggregate" WHERE "characterId" = ${item.holderCharacterId} FOR UPDATE`,
          );
        }
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" = ${item.id} FOR UPDATE`,
        );
        const stored = await transaction.characterEquipmentItem.findUnique({
          where: { id: item.id },
        });
        if (!stored || stored.updatedAt.toISOString() !== item.revision)
          throw new StaleEquipmentTransferError();
        const result = await transaction.characterEquipmentItem.updateMany({
          data: {
            displayName: item.displayName ?? null,
            itemFactsJson: preserveStoredItemFacts(item.itemFacts, stored.itemFactsJson),
            mechanicalOverridesJson: ItemMechanicalOverridesSchema.parse(
              item.mechanicalOverrides ?? [],
            ) as Prisma.InputJsonValue,
            physicalBaseEncumbrance: item.physicalBaseEncumbrance ?? null,
            notes: item.notes ?? null,
            quantity: item.quantity,
          },
          where: {
            campaignContextId: item.campaignContextId,
            id: item.id,
            holderCharacterId: item.holderCharacterId,
            updatedAt: new Date(item.revision!),
          },
        });
        if (result.count !== 1) throw new StaleEquipmentTransferError();
        if (item.holderCharacterId)
          await transaction.characterEquipmentAggregate.update({
            data: { revision: { increment: 1 } },
            where: { characterId: item.holderCharacterId },
          });
        return mapCanonicalEquipmentItem(
          await transaction.characterEquipmentItem.findUniqueOrThrow({ where: { id: item.id } }),
        );
      };
      try {
        return transactionClient
          ? await persist(transactionClient)
          : await prisma.$transaction(persist, {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2034" || (error.code === "P2010" && error.meta?.code === "40001"))
        )
          throw new StaleEquipmentTransferError();
        throw error;
      }
    },
    async transferCampaignEquipmentItem(input) {
      const persist = async (transaction: Prisma.TransactionClient) => {
        const aggregateCharacterIds = [input.sourceCharacterId, input.targetCharacterId].sort();
        for (const characterId of aggregateCharacterIds) {
          await transaction.characterEquipmentAggregate.upsert({
            create: { characterId },
            update: {},
            where: { characterId },
          });
        }
        const aggregates = await transaction.$queryRaw<
          Array<{ characterId: string; revision: number }>
        >(
          Prisma.sql`SELECT "characterId", "revision" FROM "CharacterEquipmentAggregate" WHERE "characterId" IN (${Prisma.join(aggregateCharacterIds)}) ORDER BY "characterId" FOR UPDATE`,
        );
        const revisionByCharacterId = new Map(
          aggregates.map((aggregate) => [aggregate.characterId, aggregate.revision]),
        );
        if (
          (input.sourceExpectedRevision !== undefined &&
            revisionByCharacterId.get(input.sourceCharacterId) !== input.sourceExpectedRevision) ||
          (input.targetExpectedRevision !== undefined &&
            revisionByCharacterId.get(input.targetCharacterId) !== input.targetExpectedRevision)
        ) {
          throw new StaleCharacterEquipmentAggregateError();
        }
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" = ${input.itemId} FOR UPDATE`,
        );
        const current = await transaction.characterEquipmentItem.findUnique({
          where: { id: input.itemId },
        });
        if (
          input.expectedItemRevision !== undefined &&
          current?.updatedAt.toISOString() !== input.expectedItemRevision
        )
          throw new StaleEquipmentTransferError();

        if (!current || current.campaignContextId !== input.campaignId) {
          throw new Error("Campaign item not found.");
        }
        if (current.holderCharacterId !== input.sourceCharacterId) {
          throw new StaleEquipmentTransferError();
        }
        if (input.sourceCharacterId === input.targetCharacterId) {
          throw new Error("Choose a different Character to receive this item.");
        }

        const rosterCount = await transaction.campaignRosterEntry.count({
          where: {
            campaignId: input.campaignId,
            sourceId: { in: [input.sourceCharacterId, input.targetCharacterId] },
            sourceType: "character",
          },
        });
        if (rosterCount !== 2) {
          throw new Error("Choose Characters from this campaign roster.");
        }

        let targetLocation = await transaction.characterStorageLocation.findFirst({
          where: {
            characterId: input.targetCharacterId,
            id: input.targetStorageAssignment.locationId,
          },
        });
        if (!targetLocation) {
          const defaultTargetLocations = createDefaultEquipmentLocations(input.targetCharacterId);
          const isStandardTarget = defaultTargetLocations.some(
            (location) => location.id === input.targetStorageAssignment.locationId,
          );
          if (!isStandardTarget) {
            throw new Error("The receiving Character has no valid storage for this transfer.");
          }

          for (const location of defaultTargetLocations) {
            await transaction.characterStorageLocation.upsert({
              create: {
                availabilityClass: location.availabilityClass,
                characterId: location.characterId,
                id: location.id,
                isAccessibleInEncounter: location.isAccessibleInEncounter,
                isMobile: location.isMobile,
                name: location.name,
                notes: location.notes ?? null,
                parentLocationId: location.parentLocationId ?? null,
                type: location.type,
              } as Prisma.CharacterStorageLocationUncheckedCreateInput,
              update: {},
              where: { id: location.id },
            });
          }
          targetLocation = await transaction.characterStorageLocation.findFirst({
            where: {
              characterId: input.targetCharacterId,
              id: input.targetStorageAssignment.locationId,
            },
          });
        }
        if (!targetLocation || input.targetStorageAssignment.carryMode === "equipped") {
          throw new Error("The receiving Character has no valid storage for this transfer.");
        }

        await transaction.characterLoadout.upsert({
          create: {
            activeAmmoItemIds: [],
            activeMissileWeaponItemId: null,
            activePrimaryWeaponItemId: null,
            activeSecondaryWeaponItemId: null,
            characterId: input.targetCharacterId,
            id: `${input.targetCharacterId}:loadout-current`,
            isActive: true,
            name: "Current",
            notes: null,
            quickAccessItemIdsJson: [],
            readyShieldItemId: null,
            wornArmorItemId: null,
          },
          update: {},
          where: { id: `${input.targetCharacterId}:loadout-current` },
        });

        const sourceLoadouts = await transaction.characterLoadout.findMany({
          where: { characterId: input.sourceCharacterId },
        });
        for (const loadout of sourceLoadouts) {
          const quickAccessItemIds = parseStringArrayOrNull(loadout.quickAccessItemIdsJson) ?? [];
          await transaction.characterLoadout.update({
            data: {
              activeAmmoItemIds: loadout.activeAmmoItemIds.filter((id) => id !== input.itemId),
              activeMissileWeaponItemId:
                loadout.activeMissileWeaponItemId === input.itemId
                  ? null
                  : loadout.activeMissileWeaponItemId,
              activePrimaryWeaponItemId:
                loadout.activePrimaryWeaponItemId === input.itemId
                  ? null
                  : loadout.activePrimaryWeaponItemId,
              activeSecondaryWeaponItemId:
                loadout.activeSecondaryWeaponItemId === input.itemId
                  ? null
                  : loadout.activeSecondaryWeaponItemId,
              quickAccessItemIdsJson: quickAccessItemIds.filter((id) => id !== input.itemId),
              readyShieldItemId:
                loadout.readyShieldItemId === input.itemId ? null : loadout.readyShieldItemId,
              wornArmorItemId:
                loadout.wornArmorItemId === input.itemId ? null : loadout.wornArmorItemId,
            },
            where: { id: loadout.id },
          });
        }

        const moved = await transaction.characterEquipmentItem.updateMany({
          data: {
            carryMode: input.targetStorageAssignment.carryMode,
            holderCharacterId: input.targetCharacterId,
            isEquipped: false,
            locationId: input.targetStorageAssignment.locationId,
            previousCarryMode: null,
            previousLocationId: null,
          },
          where: {
            campaignContextId: input.campaignId,
            holderCharacterId: input.sourceCharacterId,
            id: input.itemId,
          },
        });
        if (moved.count !== 1) {
          throw new StaleEquipmentTransferError();
        }

        const updated = await transaction.characterEquipmentItem.findUnique({
          where: { id: input.itemId },
        });
        if (!updated) {
          throw new Error("Campaign item not found after transfer.");
        }

        const sourceAdvanced = await transaction.characterEquipmentAggregate.updateMany({
          data: { revision: { increment: 1 } },
          where: {
            characterId: input.sourceCharacterId,
            revision: revisionByCharacterId.get(input.sourceCharacterId),
          },
        });
        const targetAdvanced = await transaction.characterEquipmentAggregate.updateMany({
          data: { revision: { increment: 1 } },
          where: {
            characterId: input.targetCharacterId,
            revision: revisionByCharacterId.get(input.targetCharacterId),
          },
        });
        if (sourceAdvanced.count !== 1 || targetAdvanced.count !== 1) {
          throw new StaleCharacterEquipmentAggregateError();
        }

        if (input.evidence) {
          await transaction.equipmentTransitionEvent.create({
            data: {
              actorAuthority: input.evidence.actorAuthority,
              actorUserId: input.evidence.actorUserId,
              afterJson: {
                holderCharacterId: input.targetCharacterId,
                sourceAggregateRevision:
                  (revisionByCharacterId.get(input.sourceCharacterId) ?? 0) + 1,
                targetAggregateRevision:
                  (revisionByCharacterId.get(input.targetCharacterId) ?? 0) + 1,
              },
              beforeJson: {
                holderCharacterId: input.sourceCharacterId,
                sourceAggregateRevision: revisionByCharacterId.get(input.sourceCharacterId),
                targetAggregateRevision: revisionByCharacterId.get(input.targetCharacterId),
              },
              campaignId: input.campaignId,
              commandId: input.evidence.commandId ?? null,
              encounterId: input.evidence.encounterId ?? null,
              eventType: "character_transfer",
              itemId: input.itemId,
              scenarioId: input.evidence.scenarioId ?? null,
              sourceCharacterId: input.sourceCharacterId,
              targetCharacterId: input.targetCharacterId,
            },
          });
        }

        return mapCanonicalEquipmentItem(updated);
      };
      try {
        return transactionClient
          ? await persist(transactionClient)
          : await prisma.$transaction(persist, {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          throw new StaleCharacterEquipmentAggregateError();
        }
        throw error;
      }
    },
    async acquireUnheldCampaignEquipmentItem(input) {
      const acquire = async (transaction: Prisma.TransactionClient) => {
        await transaction.characterEquipmentAggregate.upsert({
          create: { characterId: input.targetCharacterId },
          update: {},
          where: { characterId: input.targetCharacterId },
        });
        const aggregates = await transaction.$queryRaw<Array<{ revision: number }>>(
          Prisma.sql`SELECT "revision" FROM "CharacterEquipmentAggregate" WHERE "characterId" = ${input.targetCharacterId} FOR UPDATE`,
        );
        const aggregateRevision = aggregates[0]?.revision;
        if (
          aggregateRevision === undefined ||
          (input.expectedTargetRevision !== undefined &&
            aggregateRevision !== input.expectedTargetRevision)
        ) {
          throw new StaleCharacterEquipmentAggregateError();
        }
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" = ${input.itemId} FOR UPDATE`,
        );
        const current = await transaction.characterEquipmentItem.findUnique({
          where: { id: input.itemId },
        });
        if (
          input.expectedItemRevision !== undefined &&
          current?.updatedAt.toISOString() !== input.expectedItemRevision
        )
          throw new StaleEquipmentTransferError();
        if (
          !current ||
          current.campaignContextId !== input.campaignId ||
          current.holderCharacterId !== null
        ) {
          throw new StaleEquipmentTransferError();
        }
        const rostered = await transaction.campaignRosterEntry.count({
          where: {
            campaignId: input.campaignId,
            sourceId: input.targetCharacterId,
            sourceType: "character",
          },
        });
        if (rostered !== 1) throw new Error("Choose a Character from this campaign roster.");
        for (const location of createDefaultEquipmentLocations(input.targetCharacterId)) {
          await transaction.characterStorageLocation.upsert({
            create: {
              availabilityClass: location.availabilityClass,
              characterId: location.characterId,
              id: location.id,
              isAccessibleInEncounter: location.isAccessibleInEncounter,
              isMobile: location.isMobile,
              name: location.name,
              notes: location.notes ?? null,
              parentLocationId: location.parentLocationId ?? null,
              type: location.type,
            } as Prisma.CharacterStorageLocationUncheckedCreateInput,
            update: {},
            where: { id: location.id },
          });
        }
        const targetLocation = await transaction.characterStorageLocation.findFirst({
          where: {
            characterId: input.targetCharacterId,
            id: input.targetStorageAssignment.locationId,
          },
        });
        if (!targetLocation || input.targetStorageAssignment.carryMode === "equipped") {
          throw new Error("The receiving Character has no valid storage for this pickup.");
        }
        const updated = await transaction.characterEquipmentItem.update({
          data: {
            carryMode: input.targetStorageAssignment.carryMode,
            holderCharacterId: input.targetCharacterId,
            isEquipped: false,
            locationId: input.targetStorageAssignment.locationId,
            previousCarryMode: null,
            previousLocationId: null,
          },
          where: { id: input.itemId },
        });
        await transaction.characterEquipmentAggregate.update({
          data: { revision: { increment: 1 } },
          where: { characterId: input.targetCharacterId },
        });
        if (input.evidence) {
          await transaction.equipmentTransitionEvent.create({
            data: {
              actorAuthority: input.evidence.actorAuthority,
              actorUserId: input.evidence.actorUserId,
              afterJson: {
                aggregateRevision: aggregateRevision + 1,
                holderCharacterId: input.targetCharacterId,
                quantity: updated.quantity,
              },
              beforeJson: {
                aggregateRevision,
                holderCharacterId: null,
                quantity: current.quantity,
              },
              campaignId: input.campaignId,
              characterId: input.targetCharacterId,
              commandId: input.evidence.commandId ?? null,
              encounterId: input.evidence.encounterId ?? null,
              eventType: input.evidence.scenarioId ? "scenario_pickup" : "assignment",
              itemId: input.itemId,
              scenarioId: input.evidence.scenarioId ?? null,
              targetCharacterId: input.targetCharacterId,
            },
          });
        }
        return mapCanonicalEquipmentItem(updated);
      };
      try {
        return transactionClient
          ? await acquire(transactionClient)
          : await prisma.$transaction(acquire, {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          throw new StaleCharacterEquipmentAggregateError();
        }
        throw error;
      }
    },
    async releaseHeldCampaignEquipmentItem(input) {
      const release = async (transaction: Prisma.TransactionClient) => {
        await transaction.characterEquipmentAggregate.upsert({
          create: { characterId: input.sourceCharacterId },
          update: {},
          where: { characterId: input.sourceCharacterId },
        });
        const aggregates = await transaction.$queryRaw<Array<{ revision: number }>>(
          Prisma.sql`SELECT "revision" FROM "CharacterEquipmentAggregate" WHERE "characterId" = ${input.sourceCharacterId} FOR UPDATE`,
        );
        const aggregateRevision = aggregates[0]?.revision;
        if (
          aggregateRevision === undefined ||
          (input.expectedSourceRevision !== undefined &&
            aggregateRevision !== input.expectedSourceRevision)
        ) {
          throw new StaleCharacterEquipmentAggregateError();
        }
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" = ${input.itemId} FOR UPDATE`,
        );
        const current = await transaction.characterEquipmentItem.findUnique({
          where: { id: input.itemId },
        });
        if (
          input.expectedItemRevision !== undefined &&
          current?.updatedAt.toISOString() !== input.expectedItemRevision
        )
          throw new StaleEquipmentTransferError();
        if (
          !current ||
          current.campaignContextId !== input.campaignId ||
          current.holderCharacterId !== input.sourceCharacterId
        ) {
          throw new StaleEquipmentTransferError();
        }

        const sourceLoadouts = await transaction.characterLoadout.findMany({
          where: { characterId: input.sourceCharacterId },
        });
        for (const loadout of sourceLoadouts) {
          const quickAccessItemIds = parseStringArrayOrNull(loadout.quickAccessItemIdsJson) ?? [];
          await transaction.characterLoadout.update({
            data: {
              activeAmmoItemIds: loadout.activeAmmoItemIds.filter((id) => id !== input.itemId),
              activeMissileWeaponItemId:
                loadout.activeMissileWeaponItemId === input.itemId
                  ? null
                  : loadout.activeMissileWeaponItemId,
              activePrimaryWeaponItemId:
                loadout.activePrimaryWeaponItemId === input.itemId
                  ? null
                  : loadout.activePrimaryWeaponItemId,
              activeSecondaryWeaponItemId:
                loadout.activeSecondaryWeaponItemId === input.itemId
                  ? null
                  : loadout.activeSecondaryWeaponItemId,
              quickAccessItemIdsJson: quickAccessItemIds.filter((id) => id !== input.itemId),
              readyShieldItemId:
                loadout.readyShieldItemId === input.itemId ? null : loadout.readyShieldItemId,
              wornArmorItemId:
                loadout.wornArmorItemId === input.itemId ? null : loadout.wornArmorItemId,
            },
            where: { id: loadout.id },
          });
        }

        const updated = await transaction.characterEquipmentItem.update({
          data: {
            carryMode: null,
            holderCharacterId: null,
            isEquipped: false,
            locationId: null,
            previousCarryMode: null,
            previousLocationId: null,
          },
          where: { id: input.itemId },
        });
        await transaction.characterEquipmentAggregate.update({
          data: { revision: { increment: 1 } },
          where: { characterId: input.sourceCharacterId },
        });
        if (input.evidence) {
          await transaction.equipmentTransitionEvent.create({
            data: {
              actorAuthority: input.evidence.actorAuthority,
              actorUserId: input.evidence.actorUserId,
              afterJson: {
                aggregateRevision: aggregateRevision + 1,
                holderCharacterId: null,
                quantity: updated.quantity,
              },
              beforeJson: {
                aggregateRevision,
                holderCharacterId: input.sourceCharacterId,
                quantity: current.quantity,
              },
              campaignId: input.campaignId,
              characterId: input.sourceCharacterId,
              commandId: input.evidence.commandId ?? null,
              encounterId: input.evidence.encounterId ?? null,
              eventType: "unassignment",
              itemId: input.itemId,
              scenarioId: input.evidence.scenarioId ?? null,
              sourceCharacterId: input.sourceCharacterId,
            },
          });
        }
        return mapCanonicalEquipmentItem(updated);
      };
      try {
        return transactionClient
          ? await release(transactionClient)
          : await prisma.$transaction(release, {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
          throw new StaleCharacterEquipmentAggregateError();
        }
        throw error;
      }
    },
    async getCombatItemInteractionRecords(campaignId) {
      const items = await prisma.characterEquipmentItem.findMany({
        include: {
          storageLocation: {
            select: { availabilityClass: true, isAccessibleInEncounter: true },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        where: { campaignContextId: campaignId },
      });

      return items.map((record) => {
        const storedTags = parseStoredStatusTags(record.statusTagsJson);
        const visibilityTags = storedTags.map((tag) => tag.trim().toLowerCase());
        return {
          availableInEncounter:
            !record.holderCharacterId ||
            (record.storageLocation?.availabilityClass === "with_you" &&
              record.storageLocation.isAccessibleInEncounter),
          hidden: visibilityTags.includes("hidden") || visibilityTags.includes("unrevealed"),
          item: mapCanonicalEquipmentItem(record),
          presentEncounterId: storedTags
            .find((tag) => tag.startsWith(COMBAT_ITEM_PRESENT_PREFIX))
            ?.slice(COMBAT_ITEM_PRESENT_PREFIX.length),
        };
      });
    },
    async applyCombatItemInteraction(input) {
      const apply = async (transaction: Prisma.TransactionClient) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" = ${input.itemId} FOR UPDATE`,
        );
        const current = await transaction.characterEquipmentItem.findUnique({
          where: { id: input.itemId },
        });
        if (!current || current.campaignContextId !== input.campaignId) {
          throw new CombatItemUnavailableError();
        }

        const storedTags = parseStoredStatusTags(current.statusTagsJson);
        if (current.updatedAt.toISOString() !== input.expectedItemRevision) {
          throw new CombatItemRevisionError();
        }

        const presentTag = `${COMBAT_ITEM_PRESENT_PREFIX}${input.encounterId}`;
        const isPresentHere = storedTags.includes(presentTag);
        const rosterCharacterIds = [input.ownerCharacterId, input.recipientCharacterId].filter(
          (id): id is string => Boolean(id),
        );
        const rosterCount = await transaction.campaignRosterEntry.count({
          where: {
            campaignId: input.campaignId,
            sourceId: { in: [...new Set(rosterCharacterIds)] },
            sourceType: "character",
          },
        });
        if (rosterCount !== new Set(rosterCharacterIds).size) {
          throw new CombatItemUnavailableError();
        }

        const ensureLocations = async (characterId: string) => {
          for (const location of createDefaultEquipmentLocations(characterId)) {
            await transaction.characterStorageLocation.upsert({
              create: {
                availabilityClass: location.availabilityClass,
                characterId: location.characterId,
                id: location.id,
                isAccessibleInEncounter: location.isAccessibleInEncounter,
                isMobile: location.isMobile,
                name: location.name,
                notes: location.notes ?? null,
                parentLocationId: location.parentLocationId ?? null,
                type: location.type,
              } as Prisma.CharacterStorageLocationUncheckedCreateInput,
              update: {},
              where: { id: location.id },
            });
          }
        };
        const clearLoadoutReferences = async (characterId: string) => {
          const loadouts = await transaction.characterLoadout.findMany({
            where: { characterId },
          });
          for (const loadout of loadouts) {
            const quickAccessItemIds = parseStringArrayOrNull(loadout.quickAccessItemIdsJson) ?? [];
            await transaction.characterLoadout.update({
              data: {
                activeAmmoItemIds: loadout.activeAmmoItemIds.filter((id) => id !== input.itemId),
                activeMissileWeaponItemId:
                  loadout.activeMissileWeaponItemId === input.itemId
                    ? null
                    : loadout.activeMissileWeaponItemId,
                activePrimaryWeaponItemId:
                  loadout.activePrimaryWeaponItemId === input.itemId
                    ? null
                    : loadout.activePrimaryWeaponItemId,
                activeSecondaryWeaponItemId:
                  loadout.activeSecondaryWeaponItemId === input.itemId
                    ? null
                    : loadout.activeSecondaryWeaponItemId,
                quickAccessItemIdsJson: quickAccessItemIds.filter((id) => id !== input.itemId),
                readyShieldItemId:
                  loadout.readyShieldItemId === input.itemId ? null : loadout.readyShieldItemId,
                wornArmorItemId:
                  loadout.wornArmorItemId === input.itemId ? null : loadout.wornArmorItemId,
              },
              where: { id: loadout.id },
            });
          }
        };
        const findSystemLocation = async (
          characterId: string,
          type: "equipped_system" | "person_system" | "backpack_system",
        ) => {
          await ensureLocations(characterId);
          const location = await transaction.characterStorageLocation.findFirst({
            where: { characterId, type },
          });
          if (!location) throw new CombatItemUnavailableError();
          return location;
        };

        let holderCharacterId = current.holderCharacterId;
        let locationId = current.locationId;
        let carryMode = current.carryMode;
        let isEquipped = current.isEquipped;
        let previousLocationId = current.previousLocationId;
        let previousCarryMode = current.previousCarryMode;
        // Any canonical interaction cleans up the retired internal presence
        // markers. Encounter presence now lives on Encounter.itemReferences.
        const nextTags = storedTags.filter(
          (tag) =>
            !tag.startsWith(COMBAT_ITEM_PRESENT_PREFIX) &&
            !tag.startsWith(COMBAT_ITEM_APPLIED_PREFIX),
        );

        if (input.operation === "draw") {
          if (current.holderCharacterId !== input.ownerCharacterId || !current.locationId) {
            throw new CombatItemUnavailableError();
          }
          if (!(["weapon", "shield", "armor"] as string[]).includes(current.category ?? "")) {
            throw new Error("This Item does not have a supported ready or equip state.");
          }
          const equippedLocation = await findSystemLocation(
            input.ownerCharacterId,
            "equipped_system",
          );
          let loadout = await transaction.characterLoadout.findFirst({
            orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
            where: { characterId: input.ownerCharacterId },
          });
          if (!loadout) {
            loadout = await transaction.characterLoadout.create({
              data: {
                activeAmmoItemIds: [],
                activeMissileWeaponItemId: null,
                activePrimaryWeaponItemId: null,
                activeSecondaryWeaponItemId: null,
                characterId: input.ownerCharacterId,
                id: `${input.ownerCharacterId}:loadout-current`,
                isActive: true,
                name: "Current",
                notes: null,
                quickAccessItemIdsJson: [],
                readyShieldItemId: null,
                wornArmorItemId: null,
              },
            });
          }
          const slot =
            current.category === "weapon"
              ? "activePrimaryWeaponItemId"
              : current.category === "shield"
                ? "readyShieldItemId"
                : "wornArmorItemId";
          const previousItemId = loadout[slot];
          await clearLoadoutReferences(input.ownerCharacterId);
          if (previousItemId && previousItemId !== current.id) {
            const previousItem = await transaction.characterEquipmentItem.findUnique({
              where: { id: previousItemId },
            });
            if (previousItem?.holderCharacterId === input.ownerCharacterId) {
              const fallback = await findSystemLocation(input.ownerCharacterId, "person_system");
              const selectedSourceIsUsable =
                current.carryMode !== "equipped" && current.locationId !== equippedLocation.id;
              await transaction.characterEquipmentItem.update({
                data: {
                  carryMode: selectedSourceIsUsable ? current.carryMode : "on_person",
                  isEquipped: false,
                  locationId: selectedSourceIsUsable ? current.locationId : fallback.id,
                  previousCarryMode: null,
                  previousLocationId: null,
                },
                where: { id: previousItem.id },
              });
            }
          }
          await transaction.characterLoadout.update({
            data: { [slot]: current.id },
            where: { id: loadout.id },
          });
          holderCharacterId = input.ownerCharacterId;
          locationId = equippedLocation.id;
          carryMode = "equipped";
          isEquipped = true;
          if (current.carryMode !== "equipped") {
            previousLocationId = current.locationId;
            previousCarryMode = current.carryMode;
          }
        } else if (input.operation === "stow") {
          if (current.holderCharacterId !== input.ownerCharacterId) {
            throw new CombatItemUnavailableError();
          }
          await clearLoadoutReferences(input.ownerCharacterId);
          const fallback = await findSystemLocation(input.ownerCharacterId, "backpack_system");
          const priorLocation = current.previousLocationId
            ? await transaction.characterStorageLocation.findFirst({
                where: {
                  characterId: input.ownerCharacterId,
                  id: current.previousLocationId,
                },
              })
            : null;
          holderCharacterId = input.ownerCharacterId;
          locationId = priorLocation?.id ?? fallback.id;
          carryMode =
            priorLocation && current.previousCarryMode !== "equipped"
              ? (current.previousCarryMode ?? "backpack")
              : "backpack";
          isEquipped = false;
          previousLocationId = null;
          previousCarryMode = null;
        } else if (input.operation === "drop") {
          if (current.holderCharacterId !== input.ownerCharacterId) {
            throw new CombatItemUnavailableError();
          }
          await clearLoadoutReferences(input.ownerCharacterId);
          holderCharacterId = null;
          locationId = null;
          carryMode = null;
          isEquipped = false;
          previousLocationId = null;
          previousCarryMode = null;
        } else if (input.operation === "pickup") {
          if (current.holderCharacterId !== null || !(input.presentInEncounter || isPresentHere)) {
            throw new CombatItemUnavailableError();
          }
          const personLocation = await findSystemLocation(input.ownerCharacterId, "person_system");
          holderCharacterId = input.ownerCharacterId;
          locationId = personLocation.id;
          carryMode = "on_person";
          isEquipped = false;
          previousLocationId = null;
          previousCarryMode = null;
        } else if (input.operation === "pass") {
          if (
            current.holderCharacterId !== input.ownerCharacterId ||
            !input.recipientCharacterId ||
            input.recipientCharacterId === input.ownerCharacterId
          ) {
            throw new CombatItemUnavailableError();
          }
          await clearLoadoutReferences(input.ownerCharacterId);
          const personLocation = await findSystemLocation(
            input.recipientCharacterId,
            "person_system",
          );
          holderCharacterId = input.recipientCharacterId;
          locationId = personLocation.id;
          carryMode = "on_person";
          isEquipped = false;
          previousLocationId = null;
          previousCarryMode = null;
        } else if (input.operation === "use") {
          if (
            current.holderCharacterId !== input.ownerCharacterId &&
            !(input.presentInEncounter || isPresentHere)
          ) {
            throw new CombatItemUnavailableError();
          }
        }

        const updated = await transaction.characterEquipmentItem.update({
          data: {
            carryMode,
            holderCharacterId,
            isEquipped,
            locationId,
            previousCarryMode,
            previousLocationId,
            statusTagsJson: nextTags,
            updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
          },
          where: { id: current.id },
        });
        await advanceCharacterEquipmentAggregates({
          characterIds: [current.holderCharacterId, holderCharacterId],
          client: transaction,
        });
        return { alreadyApplied: false, item: mapCanonicalEquipmentItem(updated) };
      };
      return transactionClient ? apply(transactionClient) : prisma.$transaction(apply);
    },
    async restoreCombatThrownWeaponAttack(input) {
      const restore = async (transaction: Prisma.TransactionClient) => {
        const undo = input.undo;
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" = ${undo.itemBefore.id} FOR UPDATE`,
        );
        const current = await transaction.characterEquipmentItem.findUnique({
          where: { id: undo.itemBefore.id },
        });
        const currentTags = parseStoredStatusTags(current?.statusTagsJson);
        if (
          !current ||
          current.campaignContextId !== input.campaignId ||
          current.updatedAt.toISOString() !== undo.itemAfterRevision ||
          current.holderCharacterId !== null ||
          !(
            input.presentInEncounter ||
            currentTags.includes(`${COMBAT_ITEM_PRESENT_PREFIX}${undo.encounterId}`)
          )
        ) {
          throw new CombatItemRevisionError();
        }

        const loadouts = await transaction.characterLoadout.findMany({
          orderBy: { id: "asc" },
          where: { characterId: undo.ownerCharacterId },
        });
        const beforeById = new Map(undo.loadoutsBefore.map((loadout) => [loadout.id, loadout]));
        if (loadouts.length !== beforeById.size) throw new CombatItemRevisionError();
        for (const loadout of loadouts) {
          const before = beforeById.get(loadout.id);
          if (!before) throw new CombatItemRevisionError();
          const expectedAfter = {
            activeAmmoItemIds: before.activeAmmoItemIds.filter((id) => id !== undo.itemBefore.id),
            activeMissileWeaponItemId:
              before.activeMissileWeaponItemId === undo.itemBefore.id
                ? null
                : before.activeMissileWeaponItemId,
            activePrimaryWeaponItemId:
              before.activePrimaryWeaponItemId === undo.itemBefore.id
                ? null
                : before.activePrimaryWeaponItemId,
            activeSecondaryWeaponItemId:
              before.activeSecondaryWeaponItemId === undo.itemBefore.id
                ? null
                : before.activeSecondaryWeaponItemId,
            quickAccessItemIds: before.quickAccessItemIds.filter((id) => id !== undo.itemBefore.id),
            readyShieldItemId:
              before.readyShieldItemId === undo.itemBefore.id ? null : before.readyShieldItemId,
            wornArmorItemId:
              before.wornArmorItemId === undo.itemBefore.id ? null : before.wornArmorItemId,
          };
          if (
            JSON.stringify(loadout.activeAmmoItemIds) !==
              JSON.stringify(expectedAfter.activeAmmoItemIds) ||
            loadout.activeMissileWeaponItemId !== expectedAfter.activeMissileWeaponItemId ||
            loadout.activePrimaryWeaponItemId !== expectedAfter.activePrimaryWeaponItemId ||
            loadout.activeSecondaryWeaponItemId !== expectedAfter.activeSecondaryWeaponItemId ||
            JSON.stringify(parseStringArrayOrNull(loadout.quickAccessItemIdsJson) ?? []) !==
              JSON.stringify(expectedAfter.quickAccessItemIds) ||
            loadout.readyShieldItemId !== expectedAfter.readyShieldItemId ||
            loadout.wornArmorItemId !== expectedAfter.wornArmorItemId
          ) {
            throw new CombatItemRevisionError();
          }
        }

        for (const before of undo.loadoutsBefore) {
          await transaction.characterLoadout.update({
            data: {
              activeAmmoItemIds: before.activeAmmoItemIds,
              activeMissileWeaponItemId: before.activeMissileWeaponItemId ?? null,
              activePrimaryWeaponItemId: before.activePrimaryWeaponItemId ?? null,
              activeSecondaryWeaponItemId: before.activeSecondaryWeaponItemId ?? null,
              quickAccessItemIdsJson: before.quickAccessItemIds,
              readyShieldItemId: before.readyShieldItemId ?? null,
              wornArmorItemId: before.wornArmorItemId ?? null,
            },
            where: { id: before.id },
          });
        }
        const before = undo.itemBefore;
        const updated = await transaction.characterEquipmentItem.update({
          data: {
            carryMode: before.storageAssignment?.carryMode ?? null,
            holderCharacterId: before.holderCharacterId,
            isEquipped: before.isEquipped ?? false,
            locationId: before.storageAssignment?.locationId ?? null,
            previousCarryMode: before.previousStorageAssignment?.carryMode ?? null,
            previousLocationId: before.previousStorageAssignment?.locationId ?? null,
            statusTagsJson: serializeJsonArray(before.statusTags),
            updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)),
          },
          where: { id: before.id },
        });
        await advanceCharacterEquipmentAggregates({
          characterIds: [undo.ownerCharacterId],
          client: transaction,
        });
        return mapCanonicalEquipmentItem(updated);
      };
      return transactionClient ? restore(transactionClient) : prisma.$transaction(restore);
    },
    async updateCharacterEquipmentItem(item) {
      const stored = await prisma.characterEquipmentItem.findUnique({ where: { id: item.id } });
      const result = await prisma.characterEquipmentItem.updateMany({
        data: {
          acquiredFrom: item.acquiredFrom ?? null,
          category: item.category,
          conditionState: item.conditionState,
          displayName: item.displayName ?? null,
          durabilityCurrent: item.durabilityCurrent ?? null,
          durabilityMax: item.durabilityMax ?? null,
          encumbranceOverride: item.encumbranceOverride ?? null,
          isEquipped: item.isEquipped ?? null,
          isFavorite: item.isFavorite ?? null,
          isStackable: item.isStackable,
          locationId: item.storageAssignment.locationId,
          carryMode: item.storageAssignment.carryMode,
          previousLocationId: item.previousStorageAssignment?.locationId ?? null,
          previousCarryMode: item.previousStorageAssignment?.carryMode ?? null,
          material: item.material,
          notes: item.notes ?? null,
          quality: item.quality,
          quantity: item.quantity,
          itemFactsJson: preserveStoredItemFacts(item.itemFacts, stored?.itemFactsJson),
          mechanicalOverridesJson: ItemMechanicalOverridesSchema.parse(
            item.mechanicalOverrides ?? [],
          ) as Prisma.InputJsonValue,
          physicalBaseEncumbrance: item.physicalBaseEncumbrance ?? null,
          specificityType: item.specificityType,
          statusTagsJson: serializeJsonArray(item.statusTags),
          templateId: item.templateId,
          valueOverride: item.valueOverride ?? null,
        },
        where: {
          holderCharacterId: item.characterId,
          id: item.id,
        },
      });

      if (result.count !== 1) {
        throw new Error("Equipment item is no longer held by this Character.");
      }

      const updated = await prisma.characterEquipmentItem.findUnique({ where: { id: item.id } });
      if (!updated) {
        throw new Error("Equipment item not found after update.");
      }

      return mapEquipmentItem(updated);
    },
    async removeCharacterEquipmentItem(characterId, itemId) {
      const result = await prisma.characterEquipmentItem.deleteMany({
        where: {
          holderCharacterId: characterId,
          id: itemId,
        },
      });

      if (result.count === 0) {
        throw new Error("Equipment item not found for character.");
      }
    },
    async moveCharacterEquipmentItem(characterId, itemId, storageAssignment) {
      const result = await prisma.characterEquipmentItem.updateMany({
        data: {
          carryMode: storageAssignment.carryMode,
          isEquipped: storageAssignment.carryMode === "equipped",
          locationId: storageAssignment.locationId,
          previousLocationId: null,
          previousCarryMode: null,
        },
        where: {
          holderCharacterId: characterId,
          id: itemId,
        },
      });

      if (result.count === 0) {
        throw new Error("Equipment item not found for character.");
      }

      const updated = await prisma.characterEquipmentItem.findUnique({
        where: {
          id: itemId,
        },
      });

      if (!updated) {
        throw new Error("Equipment item not found after move.");
      }

      return mapEquipmentItem(updated);
    },
    async upsertCharacterLoadout(loadout) {
      const referencedItemIds = [
        loadout.wornArmorItemId,
        loadout.readyShieldItemId,
        loadout.activePrimaryWeaponItemId,
        loadout.activeSecondaryWeaponItemId,
        loadout.activeMissileWeaponItemId,
        ...loadout.activeAmmoItemIds,
        ...loadout.quickAccessItemIds,
      ].filter((id): id is string => Boolean(id));
      const uniqueReferencedItemIds = [...new Set(referencedItemIds)];

      const persist = async (transaction: Prisma.TransactionClient) => {
        const previous = await transaction.characterLoadout.findUnique({
          where: { id: loadout.id },
        });
        const previousIds = previous
          ? [
              previous.wornArmorItemId,
              previous.readyShieldItemId,
              previous.activePrimaryWeaponItemId,
              previous.activeSecondaryWeaponItemId,
              previous.activeMissileWeaponItemId,
              ...previous.activeAmmoItemIds,
              ...(parseStringArrayOrNull(previous.quickAccessItemIdsJson) ?? []),
            ].filter((id): id is string => Boolean(id))
          : [];
        const affectedIds = [...new Set([...previousIds, ...uniqueReferencedItemIds])].sort();
        if (affectedIds.length)
          await transaction.$queryRaw(
            Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" IN (${Prisma.join(affectedIds)}) ORDER BY "id" FOR UPDATE`,
          );

        if (uniqueReferencedItemIds.length > 0) {
          await transaction.$queryRaw(
            Prisma.sql`SELECT "id" FROM "CharacterEquipmentItem" WHERE "id" IN (${Prisma.join(uniqueReferencedItemIds)}) FOR UPDATE`,
          );
          const heldCount = await transaction.characterEquipmentItem.count({
            where: {
              holderCharacterId: loadout.characterId,
              id: { in: uniqueReferencedItemIds },
            },
          });
          if (heldCount !== uniqueReferencedItemIds.length) {
            throw new Error("A loadout item is no longer held by this Character.");
          }
        }

        const saved = await transaction.characterLoadout.upsert({
          create: {
            activeAmmoItemIds: loadout.activeAmmoItemIds,
            activeMissileWeaponItemId: loadout.activeMissileWeaponItemId ?? null,
            activePrimaryWeaponItemId: loadout.activePrimaryWeaponItemId ?? null,
            activeSecondaryWeaponItemId: loadout.activeSecondaryWeaponItemId ?? null,
            characterId: loadout.characterId,
            id: loadout.id,
            isActive: loadout.isActive,
            name: loadout.name,
            notes: loadout.notes ?? null,
            quickAccessItemIdsJson: loadout.quickAccessItemIds,
            readyShieldItemId: loadout.readyShieldItemId ?? null,
            wornArmorItemId: loadout.wornArmorItemId ?? null,
          },
          update: {
            activeAmmoItemIds: loadout.activeAmmoItemIds,
            activeMissileWeaponItemId: loadout.activeMissileWeaponItemId ?? null,
            activePrimaryWeaponItemId: loadout.activePrimaryWeaponItemId ?? null,
            activeSecondaryWeaponItemId: loadout.activeSecondaryWeaponItemId ?? null,
            isActive: loadout.isActive,
            name: loadout.name,
            notes: loadout.notes ?? null,
            quickAccessItemIdsJson: loadout.quickAccessItemIds,
            readyShieldItemId: loadout.readyShieldItemId ?? null,
            wornArmorItemId: loadout.wornArmorItemId ?? null,
          },
          where: {
            id: loadout.id,
          },
        });
        if (affectedIds.length)
          await transaction.characterEquipmentItem.updateMany({
            data: { updatedAt: new Date() },
            where: { id: { in: affectedIds }, holderCharacterId: loadout.characterId },
          });
        return saved;
      };
      const upserted = transactionClient
        ? await persist(transactionClient)
        : await prisma.$transaction(persist);

      return mapLoadout(upserted);
    },
    async ensureDefaultEquipmentLocations(characterId) {
      const defaults = createDefaultEquipmentLocations(characterId);

      const persist = async (transaction: Prisma.TransactionClient) => {
        await Promise.all(
          defaults.map((location) =>
            transaction.characterStorageLocation.upsert({
              create: {
                availabilityClass: location.availabilityClass,
                characterId: location.characterId,
                id: location.id,
                isAccessibleInEncounter: location.isAccessibleInEncounter,
                isMobile: location.isMobile,
                name: location.name,
                notes: location.notes ?? null,
                parentLocationId: location.parentLocationId ?? null,
                type: location.type,
              } as Prisma.CharacterStorageLocationUncheckedCreateInput,
              update: {
                availabilityClass: location.availabilityClass,
                isAccessibleInEncounter: location.isAccessibleInEncounter,
                isMobile: location.isMobile,
                name: location.name,
                notes: location.notes ?? null,
                parentLocationId: location.parentLocationId ?? null,
                type: location.type,
              } as Prisma.CharacterStorageLocationUncheckedUpdateInput,
              where: {
                id: location.id,
              },
            }),
          ),
        );
      };
      if (transactionClient) await persist(transactionClient);
      else await prisma.$transaction(persist);

      return this.getCharacterStorageLocations(characterId);
    },
    async getCharacterEquipmentItems(characterId) {
      const items = await prisma.characterEquipmentItem.findMany({
        orderBy: {
          createdAt: "asc",
        },
        where: {
          carryMode: { not: null },
          holderCharacterId: characterId,
          locationId: { not: null },
        },
      });

      return items.map(mapEquipmentItem);
    },
    async getCanonicalEquipmentItemById(itemId) {
      const item = await prisma.characterEquipmentItem.findUnique({
        where: { id: itemId },
      });

      return item ? mapCanonicalEquipmentItem(item) : null;
    },
    async getCampaignEquipmentItemGmNotes(campaignId) {
      const rows = await prisma.characterEquipmentItem.findMany({
        select: { gmNotes: true, id: true },
        where: { campaignContextId: campaignId, gmNotes: { not: null } },
      });

      return Object.fromEntries(rows.map((row) => [row.id, row.gmNotes!]));
    },
    async getCampaignEquipmentItems(campaignId) {
      const items = await prisma.characterEquipmentItem.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        where: { campaignContextId: campaignId },
      });

      return items.map(mapCanonicalEquipmentItem);
    },
    async getCharacterStorageLocations(characterId) {
      const locations = await prisma.characterStorageLocation.findMany({
        orderBy: {
          createdAt: "asc",
        },
        where: {
          characterId,
        },
      });

      return locations.map(mapStorageLocation);
    },
    async getCharacterLoadouts(characterId) {
      const loadouts = await prisma.characterLoadout.findMany({
        orderBy: [
          {
            isActive: "desc",
          },
          {
            createdAt: "asc",
          },
        ],
        where: {
          characterId,
        },
      });

      return loadouts.map(mapLoadout);
    },
    async getCharacterEquipmentState(characterId) {
      return this.getCharacterEquipmentAggregateState(characterId);
    },
  };
}
