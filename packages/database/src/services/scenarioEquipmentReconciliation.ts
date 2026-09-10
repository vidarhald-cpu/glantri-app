import { createHash } from "node:crypto";

import {
  projectScenarioParticipantEquipment,
  scenarioParticipantSnapshotSchema,
  scenarioParticipantStateSchema,
  type ScenarioParticipant,
  type ScenarioSessionParticipantEquipment,
} from "@glantri/domain";
import { Prisma, type PrismaClient } from "@prisma/client";

import { CharacterEquipmentReadModelService } from "./characterEquipmentReadModelService";
import { createPrismaCharacterEquipmentRepository } from "../repositories/characterEquipmentRepository";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export class ScenarioEquipmentStaleError extends Error {
  constructor() {
    super(
      "Scenario equipment changed outside play. The GM must reconcile it before dependent play can continue.",
    );
    this.name = "ScenarioEquipmentStaleError";
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

export function fingerprintScenarioEquipment(equipmentState: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(equipmentState)))
    .digest("hex")}`;
}

function capturedRevision(participant: ScenarioParticipant): number | undefined {
  if (participant.snapshot.equipmentProjection) {
    return participant.snapshot.equipmentProjection.aggregateRevision;
  }
  const state = participant.snapshot.equipmentState;
  if (!state || typeof state !== "object" || Array.isArray(state)) return undefined;
  const revision = (state as Record<string, unknown>).revision;
  return typeof revision === "number" && Number.isInteger(revision) && revision >= 0
    ? revision
    : undefined;
}

function capturedFingerprint(participant: ScenarioParticipant): string | undefined {
  if (participant.snapshot.equipmentProjection) {
    return participant.snapshot.equipmentProjection.fingerprint;
  }
  return participant.snapshot.equipmentState === undefined
    ? undefined
    : fingerprintScenarioEquipment(participant.snapshot.equipmentState);
}

async function currentEquipmentState(client: DatabaseClient, characterId: string) {
  return new CharacterEquipmentReadModelService(
    createPrismaCharacterEquipmentRepository(client),
  ).getCharacterEquipmentState(characterId);
}

export async function resolveScenarioEquipmentStatus(input: {
  client: DatabaseClient;
  participant: ScenarioParticipant;
  viewerMode: "gm" | "player";
}): Promise<ScenarioSessionParticipantEquipment | undefined> {
  if (!input.participant.characterId || input.participant.sourceType !== "character") {
    return undefined;
  }
  const current = await currentEquipmentState(input.client, input.participant.characterId);
  const revision = capturedRevision(input.participant);
  const fingerprint = capturedFingerprint(input.participant);
  const status =
    revision === undefined || fingerprint === undefined
      ? "unavailable"
      : revision === current.revision && fingerprint === fingerprintScenarioEquipment(current)
        ? "current"
        : "stale";
  return {
    canReconcile: input.viewerMode === "gm" && status !== "current",
    message:
      status === "current"
        ? "Ready for play and matches the Character’s current equipment."
        : status === "stale"
          ? "The Character’s current equipment changed since this Scenario was prepared. Update it before play continues."
          : "Prepare this participant’s equipment before play continues.",
    status,
  };
}

export async function resolveScenarioEquipmentStatuses(input: {
  client: DatabaseClient;
  participants: ScenarioParticipant[];
  userId: string;
  viewerMode: "gm" | "player";
}): Promise<Record<string, ScenarioSessionParticipantEquipment>> {
  const visible = input.participants.filter(
    (participant) => input.viewerMode === "gm" || participant.controlledByUserId === input.userId,
  );
  const entries = await Promise.all(
    visible.map(async (participant) => {
      const status = await resolveScenarioEquipmentStatus({
        client: input.client,
        participant,
        viewerMode: input.viewerMode,
      });
      return status ? ([participant.id, status] as const) : undefined;
    }),
  );
  return Object.fromEntries(entries.filter((entry): entry is NonNullable<typeof entry> => !!entry));
}

export async function reconcileScenarioEquipmentForCharacters(input: {
  capturedAt?: Date;
  characterIds: readonly string[];
  client: DatabaseClient;
  scenarioId: string;
}): Promise<void> {
  const characterIds = [...new Set(input.characterIds)].sort();
  if (characterIds.length === 0) return;
  const capturedAt = (input.capturedAt ?? new Date()).toISOString();
  for (const characterId of characterIds) {
    const equipmentState = await currentEquipmentState(input.client, characterId);
    const participants = await input.client.scenarioParticipant.findMany({
      where: { characterId, scenarioId: input.scenarioId, sourceType: "character" },
    });
    for (const record of participants) {
      const snapshot = scenarioParticipantSnapshotSchema.parse(record.snapshotJson);
      const state = scenarioParticipantStateSchema.parse(record.stateJson);
      await input.client.scenarioParticipant.update({
        data: {
          snapshotJson: {
            ...snapshot,
            equipmentProjection: {
              aggregateRevision: equipmentState.revision,
              capturedAt,
              contractVersion: "scenario-equipment-projection/v1",
              fingerprint: fingerprintScenarioEquipment(equipmentState),
              provenance: { characterId, source: "character_equipment_aggregate" },
            },
            equipmentState,
          } as unknown as Prisma.InputJsonValue,
          stateJson: {
            ...state,
            equipment: projectScenarioParticipantEquipment(equipmentState),
          } as unknown as Prisma.InputJsonValue,
        },
        where: { id: record.id },
      });
    }
  }
  await input.client.scenario.update({
    data: { updatedAt: input.capturedAt ?? new Date() },
    where: { id: input.scenarioId },
  });
}

export async function assertScenarioEquipmentCurrent(input: {
  characterIds?: readonly string[];
  client: DatabaseClient;
  scenarioId: string;
}): Promise<void> {
  const participants = await input.client.scenarioParticipant.findMany({
    where: {
      ...(input.characterIds?.length
        ? { characterId: { in: [...new Set(input.characterIds)] } }
        : {}),
      isActive: true,
      scenarioId: input.scenarioId,
      sourceType: "character",
    },
  });
  for (const record of participants) {
    const parsed = scenarioParticipantSnapshotSchema.safeParse(record.snapshotJson);
    if (!record.characterId || !parsed.success) throw new ScenarioEquipmentStaleError();
    const current = await currentEquipmentState(input.client, record.characterId);
    const revision =
      parsed.data.equipmentProjection?.aggregateRevision ??
      (parsed.data.equipmentState && typeof parsed.data.equipmentState === "object"
        ? (parsed.data.equipmentState as Record<string, unknown>).revision
        : undefined);
    const fingerprint =
      parsed.data.equipmentProjection?.fingerprint ??
      (parsed.data.equipmentState === undefined
        ? undefined
        : fingerprintScenarioEquipment(parsed.data.equipmentState));
    if (revision !== current.revision || fingerprint !== fingerprintScenarioEquipment(current)) {
      throw new ScenarioEquipmentStaleError();
    }
  }
}
