import {
  activeCombatRoundStateSchema,
  completedCombatRoundSchema,
  composeEncounterSessionFromSplitCombatPersistence,
  encounterSessionSchema,
  scenarioParticipantStateSchema,
  splitEncounterSessionForCombatPersistence,
  type EncounterSession,
  type ScenarioParticipantState,
} from "@glantri/domain";
import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "../client";

export const COMBAT_STORAGE_MODE_LEGACY = "legacy";
export const COMBAT_STORAGE_MODE_SPLIT_V1 = "split_v1";

export type CombatStorageMode =
  | typeof COMBAT_STORAGE_MODE_LEGACY
  | typeof COMBAT_STORAGE_MODE_SPLIT_V1;

export class CombatPersistenceError extends Error {
  constructor(
    readonly code:
      | "archive_delta_invalid"
      | "malformed_split_storage"
      | "stale_revision"
      | "transaction_conflict"
      | "unsupported_storage_mode",
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "CombatPersistenceError";
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: cause,
        writable: true,
      });
    }
  }
}

const DEFAULT_COMBAT_TRANSACTION_ATTEMPTS = 3;

export function isRetryableCombatTransactionError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function defaultCombatTransactionRetryDelay(attempt: number): Promise<void> {
  const delayMs = attempt * 5 + Math.floor(Math.random() * 5);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function asStorageMode(value: string): CombatStorageMode {
  if (value === COMBAT_STORAGE_MODE_LEGACY || value === COMBAT_STORAGE_MODE_SPLIT_V1) {
    return value;
  }
  throw new CombatPersistenceError(
    "unsupported_storage_mode",
    `Unsupported combat storage mode: ${value}.`,
  );
}

function metadataInput(record: {
  campaignId: string | null;
  createdAt: Date;
  id: string;
  name: string;
  scenarioId: string | null;
  status: string;
  updatedAt: Date;
}) {
  return {
    campaignId: record.campaignId,
    createdAt: record.createdAt.toISOString(),
    encounterId: record.id,
    revision: record.updatedAt.toISOString(),
    scenarioId: record.scenarioId,
    status: record.status,
    title: record.name,
  };
}

const splitEncounterRecordSelect = {
  activeCombatState: {
    select: {
      revision: true,
      stateJson: true,
    },
  },
  archivedCombatRounds: {
    orderBy: { roundNumber: "asc" as const },
    select: {
      roundJson: true,
      roundNumber: true,
    },
  },
  campaignId: true,
  combatArchiveCount: true,
  combatStorageMode: true,
  createdAt: true,
  id: true,
  name: true,
  scenarioId: true,
  sessionJson: true,
  status: true,
  updatedAt: true,
} as const;

export type TransactionClient = Prisma.TransactionClient;

function splitCurrentCombatMutation(input: {
  campaignId?: string | null;
  encounterId: string;
  scenarioId?: string | null;
  session: EncounterSession;
}) {
  const rawCombatState = input.session.combatRoundState;
  if (!rawCombatState) {
    throw new CombatPersistenceError(
      "malformed_split_storage",
      "Combat persistence requires one active combat state.",
    );
  }
  const { rounds, ...rawActiveCombatState } = rawCombatState;
  const { combatRoundState: _combatRoundState, ...rawSessionWithoutCombatState } = input.session;
  const sessionWithoutCombatState = encounterSessionSchema.parse({
    ...rawSessionWithoutCombatState,
    campaignId: input.campaignId ?? input.session.campaignId,
    id: input.encounterId,
    scenarioId: input.scenarioId ?? input.session.scenarioId,
  });

  return {
    activeCombatState: activeCombatRoundStateSchema.parse({
      ...rawActiveCombatState,
      encounterId: input.encounterId,
    }),
    archivedRounds: rounds,
    sessionWithoutCombatState,
  };
}

function composeSplitRecord(record: {
  activeCombatState: { revision: Date; stateJson: Prisma.JsonValue } | null;
  archivedCombatRounds: { roundJson: Prisma.JsonValue; roundNumber: number }[];
  campaignId: string | null;
  combatArchiveCount: number;
  combatStorageMode: string;
  createdAt: Date;
  id: string;
  name: string;
  scenarioId: string | null;
  sessionJson: Prisma.JsonValue | null;
  status: string;
  updatedAt: Date;
}): EncounterSession {
  if (asStorageMode(record.combatStorageMode) !== COMBAT_STORAGE_MODE_SPLIT_V1) {
    throw new CombatPersistenceError(
      "malformed_split_storage",
      "Split encounter composition requires split_v1 storage.",
    );
  }
  if (!record.activeCombatState) {
    throw new CombatPersistenceError(
      "malformed_split_storage",
      "Split combat storage is missing its active-state row.",
    );
  }
  if (
    record.activeCombatState.revision.getTime() !== record.updatedAt.getTime() ||
    record.archivedCombatRounds.length !== record.combatArchiveCount
  ) {
    throw new CombatPersistenceError(
      "malformed_split_storage",
      "Split combat storage revision or archive count is inconsistent.",
    );
  }
  for (const [index, round] of record.archivedCombatRounds.entries()) {
    if (round.roundNumber !== index + 1) {
      throw new CombatPersistenceError(
        "malformed_split_storage",
        "Split combat archive ordering is not contiguous.",
      );
    }
  }

  return composeEncounterSessionFromSplitCombatPersistence({
    activeCombatState: record.activeCombatState.stateJson,
    archivedRounds: record.archivedCombatRounds.map((round) => round.roundJson),
    metadata: metadataInput(record),
    sessionWithoutCombatState: record.sessionJson ?? {},
  });
}

async function updateMetadataWithExpectedRevision(input: {
  archiveCount: number;
  encounterId: string;
  expectedRevision: string;
  normalized: EncounterSession;
  sessionWithoutCombatState: EncounterSession;
  transaction: TransactionClient;
}): Promise<Date> {
  const result = await input.transaction.encounter.updateMany({
    data: {
      campaignId: input.normalized.campaignId ?? null,
      combatArchiveCount: input.archiveCount,
      combatStorageMode: COMBAT_STORAGE_MODE_SPLIT_V1,
      name: input.normalized.title,
      scenarioId: input.normalized.scenarioId ?? null,
      sessionJson: asJson(input.sessionWithoutCombatState),
      status: input.normalized.status,
    },
    where: {
      id: input.encounterId,
      updatedAt: new Date(input.expectedRevision),
    },
  });

  if (result.count !== 1) {
    throw new CombatPersistenceError(
      "stale_revision",
      "Encounter revision changed before combat state could be saved.",
    );
  }

  const updated = await input.transaction.encounter.findUniqueOrThrow({
    select: { updatedAt: true },
    where: { id: input.encounterId },
  });
  return updated.updatedAt;
}

export interface CombatStatePersistenceRepository {
  updateCombatEncounter(input: {
    campaignId?: string | null;
    encounterId: string;
    expectedRevision: string;
    scenarioId?: string | null;
    session: EncounterSession;
    participantStateUpdates?: Array<{
      expectedRevision: string;
      participantId: string;
      scenarioId: string;
      state: ScenarioParticipantState;
    }>;
  }): Promise<EncounterSession>;
  updateEncounterPreservingSplitCombat(input: {
    afterPersist?: (transaction: TransactionClient, encounter: EncounterSession) => Promise<void>;
    beforePersist?: (transaction: TransactionClient, encounter: EncounterSession) => Promise<void>;
    campaignId?: string | null;
    encounterId: string;
    expectedRevision?: string;
    scenarioId?: string | null;
    session: EncounterSession;
  }): Promise<EncounterSession>;
}

export function createPrismaCombatStatePersistenceRepository(
  client: PrismaClient | TransactionClient = prisma,
  options: {
    maxTransactionAttempts?: number;
    retryDelay?: (attempt: number) => Promise<void>;
  } = {},
): CombatStatePersistenceRepository {
  const rootClient = client as PrismaClient;
  const transactionClient = "$transaction" in client ? undefined : client;
  const maxTransactionAttempts = Math.max(
    1,
    options.maxTransactionAttempts ?? DEFAULT_COMBAT_TRANSACTION_ATTEMPTS,
  );
  const retryDelay = options.retryDelay ?? defaultCombatTransactionRetryDelay;

  return {
    async updateCombatEncounter(input) {
      for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
        try {
          const persist = async (transaction: TransactionClient) => {
            const existing = await transaction.encounter.findUniqueOrThrow({
              select: {
                combatArchiveCount: true,
                combatStorageMode: true,
                updatedAt: true,
              },
              where: { id: input.encounterId },
            });
            const storageMode = asStorageMode(existing.combatStorageMode);

            if (existing.updatedAt.toISOString() !== input.expectedRevision) {
              throw new CombatPersistenceError(
                "stale_revision",
                "Encounter revision changed before combat state could be saved.",
              );
            }

            const legacyNormalized =
              storageMode === COMBAT_STORAGE_MODE_LEGACY
                ? encounterSessionSchema.parse({
                    ...input.session,
                    campaignId: input.campaignId ?? input.session.campaignId,
                    id: input.encounterId,
                    scenarioId: input.scenarioId ?? input.session.scenarioId,
                  })
                : undefined;
            const parts = legacyNormalized
              ? splitEncounterSessionForCombatPersistence(legacyNormalized)
              : splitCurrentCombatMutation(input);
            const normalized = legacyNormalized ?? parts.sessionWithoutCombatState;
            const priorArchiveCount =
              storageMode === COMBAT_STORAGE_MODE_LEGACY ? 0 : existing.combatArchiveCount;
            const nextArchiveCount = parts.archivedRounds.length;
            const archiveDelta = nextArchiveCount - priorArchiveCount;

            if (
              (storageMode === COMBAT_STORAGE_MODE_SPLIT_V1 &&
                ![-1, 0, 1].includes(archiveDelta)) ||
              (storageMode === COMBAT_STORAGE_MODE_LEGACY && archiveDelta < 0)
            ) {
              throw new CombatPersistenceError(
                "archive_delta_invalid",
                "Combat persistence may append or remove only the exact boundary archive.",
              );
            }

            const updatedAt = await updateMetadataWithExpectedRevision({
              archiveCount: nextArchiveCount,
              encounterId: input.encounterId,
              expectedRevision: input.expectedRevision,
              normalized,
              sessionWithoutCombatState: parts.sessionWithoutCombatState,
              transaction,
            });

            if (!parts.activeCombatState) {
              throw new CombatPersistenceError(
                "malformed_split_storage",
                "Combat persistence requires one active combat state.",
              );
            }

            await transaction.encounterActiveCombatState.upsert({
              create: {
                encounterId: input.encounterId,
                revision: updatedAt,
                schemaVersion: 1,
                stateJson: asJson(parts.activeCombatState),
              },
              update: {
                revision: updatedAt,
                schemaVersion: 1,
                stateJson: asJson(parts.activeCombatState),
              },
              where: { encounterId: input.encounterId },
            });

            if (storageMode === COMBAT_STORAGE_MODE_LEGACY) {
              for (const rawRound of parts.archivedRounds) {
                const round = completedCombatRoundSchema.parse(rawRound);
                await transaction.encounterArchivedCombatRound.create({
                  data: {
                    encounterId: input.encounterId,
                    roundJson: asJson(round),
                    roundNumber: round.roundNumber,
                    schemaVersion: 1,
                    sourceRevision: updatedAt,
                  },
                });
              }
            } else if (archiveDelta === 1) {
              const rawRound = parts.archivedRounds.at(-1);
              const round = rawRound ? completedCombatRoundSchema.parse(rawRound) : undefined;
              if (!round || round.roundNumber !== nextArchiveCount) {
                throw new CombatPersistenceError(
                  "archive_delta_invalid",
                  "The appended archived round must be the next canonical round.",
                );
              }
              await transaction.encounterArchivedCombatRound.create({
                data: {
                  encounterId: input.encounterId,
                  roundJson: asJson(round),
                  roundNumber: round.roundNumber,
                  schemaVersion: 1,
                  sourceRevision: updatedAt,
                },
              });
            } else if (archiveDelta === -1) {
              const removed = await transaction.encounterArchivedCombatRound.deleteMany({
                where: {
                  encounterId: input.encounterId,
                  roundNumber: priorArchiveCount,
                },
              });
              if (removed.count !== 1) {
                throw new CombatPersistenceError(
                  "malformed_split_storage",
                  "The archived round required by boundary undo was not present.",
                );
              }
            }

            for (const participantStateUpdate of input.participantStateUpdates ?? []) {
              const participantState = scenarioParticipantStateSchema.parse(
                participantStateUpdate.state,
              );
              const participantUpdate = await transaction.scenarioParticipant.updateMany({
                data: { stateJson: asJson(participantState) },
                where: {
                  id: participantStateUpdate.participantId,
                  scenarioId: participantStateUpdate.scenarioId,
                  updatedAt: new Date(participantStateUpdate.expectedRevision),
                },
              });
              if (participantUpdate.count !== 1) {
                throw new CombatPersistenceError(
                  "stale_revision",
                  "Participant modifier state changed before combat review could be saved.",
                );
              }
            }

            return {
              ...parts.sessionWithoutCombatState,
              combatRoundState: {
                ...parts.activeCombatState,
                rounds: parts.archivedRounds,
              },
              updatedAt: updatedAt.toISOString(),
            } as EncounterSession;
          };
          return await (!transactionClient
            ? rootClient.$transaction(persist, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
              })
            : persist(transactionClient));
        } catch (error) {
          if (!isRetryableCombatTransactionError(error)) {
            throw error;
          }
          if (attempt === maxTransactionAttempts) {
            throw new CombatPersistenceError(
              "transaction_conflict",
              "Combat state changed while saving. Refresh and try again.",
              error,
            );
          }
          await retryDelay(attempt);
        }
      }

      throw new CombatPersistenceError(
        "transaction_conflict",
        "Combat state changed while saving. Refresh and try again.",
      );
    },

    async updateEncounterPreservingSplitCombat(input) {
      const normalized = encounterSessionSchema.parse({
        ...input.session,
        campaignId: input.campaignId ?? input.session.campaignId,
        id: input.encounterId,
        scenarioId: input.scenarioId ?? input.session.scenarioId,
      });
      const expectedRevision = input.expectedRevision;

      const persist = () =>
        rootClient.$transaction(
          async (transaction) => {
            const existing = await transaction.encounter.findUniqueOrThrow({
              select: splitEncounterRecordSelect,
              where: { id: input.encounterId },
            });
            const storageMode = asStorageMode(existing.combatStorageMode);

            if (expectedRevision && existing.updatedAt.toISOString() !== expectedRevision) {
              throw new CombatPersistenceError(
                "stale_revision",
                "Encounter revision changed before roleplay state could be saved.",
              );
            }

            await input.beforePersist?.(transaction, normalized);

            if (storageMode === COMBAT_STORAGE_MODE_LEGACY) {
              const data = {
                campaignId: normalized.campaignId ?? null,
                name: normalized.title,
                scenarioId: normalized.scenarioId ?? null,
                sessionJson: asJson(normalized),
                status: normalized.status,
              };
              const record = await (expectedRevision
                ? (async () => {
                    const result = await transaction.encounter.updateMany({
                      data,
                      where: {
                        id: input.encounterId,
                        updatedAt: new Date(expectedRevision),
                      },
                    });
                    if (result.count !== 1) {
                      throw new CombatPersistenceError(
                        "stale_revision",
                        "Encounter revision changed before roleplay state could be saved.",
                      );
                    }
                    return transaction.encounter.findUniqueOrThrow({
                      select: { createdAt: true, updatedAt: true },
                      where: { id: input.encounterId },
                    });
                  })()
                : transaction.encounter.update({
                    data,
                    where: { id: input.encounterId },
                  }));
              const saved = encounterSessionSchema.parse({
                ...normalized,
                createdAt: record.createdAt.toISOString(),
                updatedAt: record.updatedAt.toISOString(),
              });
              await input.afterPersist?.(transaction, saved);
              return saved;
            }

            if (!existing.activeCombatState) {
              throw new CombatPersistenceError(
                "malformed_split_storage",
                "Split combat storage is missing its active-state row.",
              );
            }

            const parts = splitEncounterSessionForCombatPersistence(normalized);
            const data = {
              campaignId: normalized.campaignId ?? null,
              name: normalized.title,
              scenarioId: normalized.scenarioId ?? null,
              sessionJson: asJson(parts.sessionWithoutCombatState),
              status: normalized.status,
            };
            const updated = await (expectedRevision
              ? (async () => {
                  const result = await transaction.encounter.updateMany({
                    data,
                    where: {
                      id: input.encounterId,
                      updatedAt: new Date(expectedRevision),
                    },
                  });
                  if (result.count !== 1) {
                    throw new CombatPersistenceError(
                      "stale_revision",
                      "Encounter revision changed before roleplay state could be saved.",
                    );
                  }
                  return transaction.encounter.findUniqueOrThrow({
                    select: { updatedAt: true },
                    where: { id: input.encounterId },
                  });
                })()
              : transaction.encounter.update({
                  data,
                  select: { updatedAt: true },
                  where: { id: input.encounterId },
                }));
            await transaction.encounterActiveCombatState.update({
              data: { revision: updated.updatedAt },
              where: { encounterId: input.encounterId },
            });

            const saved = composeEncounterSessionFromSplitCombatPersistence({
              activeCombatState: existing.activeCombatState.stateJson,
              archivedRounds: existing.archivedCombatRounds.map((round) => round.roundJson),
              metadata: {
                ...metadataInput(existing),
                campaignId: normalized.campaignId,
                revision: updated.updatedAt.toISOString(),
                scenarioId: normalized.scenarioId,
                status: normalized.status,
                title: normalized.title,
              },
              sessionWithoutCombatState: parts.sessionWithoutCombatState,
            });
            await input.afterPersist?.(transaction, saved);
            return saved;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

      if (!expectedRevision) {
        return persist();
      }

      for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
        try {
          return await persist();
        } catch (error) {
          if (!isRetryableCombatTransactionError(error)) {
            throw error;
          }
          if (attempt === maxTransactionAttempts) {
            throw new CombatPersistenceError(
              "transaction_conflict",
              "Encounter state changed while saving. Refresh and try again.",
              error,
            );
          }
          await retryDelay(attempt);
        }
      }

      throw new CombatPersistenceError(
        "transaction_conflict",
        "Encounter state changed while saving. Refresh and try again.",
      );
    },
  };
}

export async function readComposedSplitEncounter(
  transaction: TransactionClient,
  encounterId: string,
): Promise<EncounterSession | null> {
  const record = await transaction.encounter.findUnique({
    select: splitEncounterRecordSelect,
    where: { id: encounterId },
  });

  if (!record) {
    return null;
  }
  return composeSplitRecord(record);
}
