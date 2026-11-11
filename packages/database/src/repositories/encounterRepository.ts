import {
  buildCombatActivityFacts,
  COMBAT_ACTIVITY_FACTS_PAYLOAD_KEY,
  encounterRosterScenarioIdentityRefusal,
  encounterSessionSchema,
  encounterSessionSummarySchema,
  encounterStatusSchema,
  isCombatStepEventPublishedToActivity,
  type CombatLogSummaryFacts,
  type EncounterSession,
  type EncounterSessionSummary,
  type CombatStepEvent,
  type ScenarioParticipantState,
} from "@glantri/domain";
import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "../client";
import { createPrismaCombatStatePersistenceRepository } from "./combatStatePersistenceRepository";
import { createPrismaCombatStateReadRepository } from "./combatStateReadRepository";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function mapEncounterRecord(record: {
  campaignId: string | null;
  createdAt: Date;
  id: string;
  name: string;
  scenarioId: string | null;
  sessionJson: Prisma.JsonValue | null;
  status: string;
  updatedAt: Date;
}): EncounterSession {
  const parsedSession =
    record.sessionJson == null ? undefined : encounterSessionSchema.safeParse(record.sessionJson);
  const parsedData = parsedSession?.success ? parsedSession.data : undefined;

  return encounterSessionSchema.parse({
    ...(parsedData ?? {}),
    campaignId: record.campaignId ?? parsedData?.campaignId,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    scenarioId: record.scenarioId ?? parsedData?.scenarioId,
    status: record.status,
    title: record.name,
    updatedAt: record.updatedAt.toISOString(),
  });
}

function mapEncounterSummary(record: {
  campaignId: string | null;
  createdAt: Date;
  id: string;
  name: string;
  scenarioId: string | null;
  status: string;
  updatedAt: Date;
}): EncounterSessionSummary {
  return encounterSessionSummarySchema.parse({
    campaignId: record.campaignId ?? undefined,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    scenarioId: record.scenarioId ?? undefined,
    status: record.status,
    title: record.name,
    updatedAt: record.updatedAt.toISOString(),
  });
}

export interface EncounterRepository {
  createEncounter(input: {
    campaignId?: string | null;
    createdByUserId?: string | null;
    scenarioId: string;
    session: EncounterSession;
  }): Promise<EncounterSession>;
  getEncounterById(encounterId: string): Promise<EncounterSession | null>;
  getEncounterSummaryById(encounterId: string): Promise<EncounterSessionSummary | null>;
  listEncountersByScenario(scenarioId: string): Promise<EncounterSession[]>;
  listEncounterSummariesByScenario(scenarioId: string): Promise<EncounterSessionSummary[]>;
  /**
   * Forgejo #1136. The Encounters of a Scenario as the Scenario session projections read them
   * (`GET /scenarios/:id/session`, `GET /scenarios/:id/player-projection`), in the order of
   * `listEncountersByScenario`.
   *
   * Draft, active and paused Encounters are read in full, exactly as `listEncountersByScenario`
   * reads them. Finished (`completed`/`archived`) Encounters are read without their combat rounds:
   * see `listFinishedEncounterSessionSummaries` in `combatStateReadRepository.ts` for what such an
   * entry carries. Only those projections may take Encounters from here.
   */
  listScenarioSessionEncounters(scenarioId: string): Promise<EncounterSession[]>;
  updateEncounter(input: {
    objectiveEvent?: {
      actorUserId?: string | null;
      eventType: string;
      summary: string;
    };
    campaignId?: string | null;
    encounterId: string;
    expectedRevision?: string;
    scenarioId?: string | null;
    session: EncounterSession;
  }): Promise<EncounterSession>;
  updateCombatEncounter(input: {
    campaignId?: string | null;
    encounterId: string;
    expectedRevision: string;
    /**
     * Let this one write through although a roster participant is an inactive Scenario participant.
     *
     * **Only** that sub-check of the presence check is skipped. The explicit-membership,
     * roster-identity, live-parent-Scenario and already-active-in-another-Encounter conditions all
     * still hold, and the presence check still runs.
     *
     * It exists for `clear-current-step` — the control the product offers a GM for leaving a step
     * that will not finish — and nothing else sets it. On #845 that control was refused by the very
     * condition it was the remedy for, so the one state a GM could not get out of was the one they
     * most needed to. Deactivation is now refused at its own write, but an Encounter stored in that
     * state before this change still exists and must stay recoverable.
     *
     * Clearing a step removes recorded work. It never advances the round and resolves nothing
     * against the inactive combatant, so it is not the mid-round participant change #850 declines
     * to support.
     */
    permitInactiveRosterParticipants?: boolean;
    scenarioId?: string | null;
    session: EncounterSession;
    objectiveEvents?: CombatStepEvent[];
    /** Combat Log summary facts for the forwarded events, keyed by `CombatStepEvent.id`. */
    objectiveEventSummaryFacts?: Readonly<Record<string, CombatLogSummaryFacts>>;
    participantStateUpdates?: Array<{
      expectedRevision: string;
      participantId: string;
      scenarioId: string;
      state: ScenarioParticipantState;
    }>;
  }): Promise<EncounterSession>;
}

export class EncounterPresenceError extends Error {
  constructor(
    readonly code:
      | "inactive_participant"
      | "invalid_active_membership"
      | "participant_already_active"
      | "parent_scenario_not_active",
    message: string,
  ) {
    super(message);
    this.name = "EncounterPresenceError";
  }
}

function explicitScenarioParticipantIds(encounter: EncounterSession): string[] {
  if (encounter.participantMembershipMode !== "explicit") {
    throw new EncounterPresenceError(
      "invalid_active_membership",
      "An active Encounter must use an explicit participant list.",
    );
  }
  const participantIds = encounter.participants.map(
    (participant) => participant.scenarioParticipantId,
  );
  if (participantIds.some((participantId) => !participantId)) {
    throw new EncounterPresenceError(
      "invalid_active_membership",
      "Every active Encounter participant must belong to the Scenario.",
    );
  }
  const uniqueIds = new Set(participantIds as string[]);
  if (uniqueIds.size !== participantIds.length || uniqueIds.size === 0) {
    throw new EncounterPresenceError(
      "invalid_active_membership",
      "Choose one or more distinct Scenario participants before starting the Encounter.",
    );
  }
  return [...uniqueIds];
}

/**
 * A roster row's identity must describe the participant its mapping describes.
 *
 * The roster-local half of the condition — that no two rows claim one identity —
 * is in `encounterSessionSchema` and so reaches every writer without a query. This
 * half cannot be: a row can carry the identity of a Scenario participant who is
 * not on the roster at all, which the submitted document does not contain. It is
 * asked here, where the Scenario's participants are known, at every status, and
 * next to the presence check that already refuses an incoherent roster.
 *
 * It costs one indexed read of the Scenario's participants per Encounter write.
 * The in-force roster and the held roster are both checked: a held roster becomes
 * the roster in force at the next round boundary.
 */
async function assertEncounterRosterIdentity(input: {
  encounter: EncounterSession;
  scenarioId: string;
  transaction: Prisma.TransactionClient;
}): Promise<void> {
  const rosters = [input.encounter.participants, input.encounter.pendingParticipants ?? []].filter(
    (roster) => roster.length > 0,
  );

  if (rosters.length === 0) return;

  const scenarioParticipants = await input.transaction.scenarioParticipant.findMany({
    select: { characterId: true, id: true },
    where: { scenarioId: input.scenarioId },
  });

  for (const roster of rosters) {
    const refusal = encounterRosterScenarioIdentityRefusal({
      participants: roster,
      scenarioParticipants,
    });

    if (refusal) {
      throw new EncounterPresenceError("invalid_active_membership", refusal);
    }
  }
}

async function assertActiveEncounterPresence(input: {
  encounter: EncounterSession;
  /** See `permitInactiveRosterParticipants` on `EncounterRepository.updateCombatEncounter`. */
  permitInactiveRosterParticipants?: boolean;
  scenarioId: string;
  transaction: Prisma.TransactionClient;
}): Promise<string[]> {
  if (input.encounter.status !== "active") return [];
  const participantIds = explicitScenarioParticipantIds(input.encounter);

  await input.transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Scenario" WHERE "id" = ${input.scenarioId} FOR UPDATE`,
  );
  const scenario = await input.transaction.scenario.findUnique({
    select: { status: true },
    where: { id: input.scenarioId },
  });
  if (scenario?.status !== "live") {
    throw new EncounterPresenceError(
      "parent_scenario_not_active",
      "The parent Scenario must be active before this Encounter can be active.",
    );
  }
  // Read only each roster participant's id and activity: a character snapshot is large and the
  // success path never needs it. Names are read below, only when the refusal is about to be thrown.
  const rosterParticipants = await input.transaction.scenarioParticipant.findMany({
    select: { id: true, isActive: true },
    where: { id: { in: participantIds }, scenarioId: input.scenarioId },
  });
  const inactiveParticipants = rosterParticipants.filter((participant) => !participant.isActive);
  const missingParticipantCount = participantIds.length - rosterParticipants.length;

  if (missingParticipantCount > 0) {
    throw new EncounterPresenceError(
      "inactive_participant",
      "This Encounter's roster names a participant who is no longer in this Scenario. Take them " +
        "out of the Encounter roster.",
    );
  }

  if (inactiveParticipants.length > 0 && !input.permitInactiveRosterParticipants) {
    // #845: the message this replaces told the GM to refresh, which never helps — the Scenario they
    // are looking at is already correct — and spoke of "starting the Encounter" even when the
    // refused write was a step in a round already under way. It names the combatants and the
    // remedies instead.
    const inactiveWithSnapshots = await input.transaction.scenarioParticipant.findMany({
      select: { id: true, snapshotJson: true },
      where: {
        id: { in: inactiveParticipants.map((participant) => participant.id) },
        scenarioId: input.scenarioId,
      },
    });
    const snapshotById = new Map(
      inactiveWithSnapshots.map((participant) => [participant.id, participant.snapshotJson]),
    );
    const names = inactiveParticipants.map((participant) => {
      const snapshot = snapshotById.get(participant.id) as
        | { displayName?: unknown }
        | null
        | undefined;
      return typeof snapshot?.displayName === "string" && snapshot.displayName.trim().length > 0
        ? snapshot.displayName
        : participant.id;
    });
    const subject =
      names.length === 1
        ? `${names[0]} is not an active participant`
        : `${names.slice(0, -1).join(", ")} and ${names.at(-1)} are not active participants`;

    throw new EncounterPresenceError(
      "inactive_participant",
      `${subject} in this Scenario, so this Encounter cannot run with them on its roster. Either ` +
        "make them active in the Scenario again, or take them out of the Encounter roster.",
    );
  }

  const otherActiveRecords = await input.transaction.encounter.findMany({
    select: { id: true, name: true, sessionJson: true, status: true },
    where: {
      id: { not: input.encounter.id },
      scenarioId: input.scenarioId,
      status: "active",
    },
  });
  for (const record of otherActiveRecords) {
    const parsed = encounterSessionSchema.parse({
      ...(record.sessionJson && typeof record.sessionJson === "object" ? record.sessionJson : {}),
      id: record.id,
      scenarioId: input.scenarioId,
      status: record.status,
      title: record.name,
    });
    if (parsed.participantMembershipMode !== "explicit") continue;
    const otherIds = new Set(
      parsed.participants.flatMap((participant) =>
        participant.scenarioParticipantId ? [participant.scenarioParticipantId] : [],
      ),
    );
    if (participantIds.some((participantId) => otherIds.has(participantId))) {
      throw new EncounterPresenceError(
        "participant_already_active",
        "A selected participant is already active in another Encounter.",
      );
    }
  }
  return participantIds;
}

export function createPrismaEncounterRepository(
  client: PrismaClient = prisma,
): EncounterRepository {
  const combatReadRepository = createPrismaCombatStateReadRepository(client);
  const combatPersistenceRepository = createPrismaCombatStatePersistenceRepository(client);

  return {
    async createEncounter(input) {
      const normalized = encounterSessionSchema.parse({
        ...input.session,
        campaignId: input.campaignId ?? input.session.campaignId,
        scenarioId: input.scenarioId,
      });
      const record = await client.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Scenario" WHERE "id" = ${input.scenarioId} FOR UPDATE`,
        );
        const scenario = await transaction.scenario.findUnique({
          select: { status: true },
          where: { id: input.scenarioId },
        });
        if (!scenario || scenario.status === "completed" || scenario.status === "archived") {
          throw new EncounterPresenceError(
            "parent_scenario_not_active",
            "Closed or archived Scenarios cannot contain new Encounters.",
          );
        }
        await assertEncounterRosterIdentity({
          encounter: normalized,
          scenarioId: input.scenarioId,
          transaction,
        });
        return transaction.encounter.create({
          data: {
            campaignId: normalized.campaignId ?? null,
            createdByUserId: input.createdByUserId ?? null,
            id: normalized.id,
            name: normalized.title,
            scenarioId: input.scenarioId,
            sessionJson: asJson(normalized),
            status: normalized.status,
          },
        });
      });

      return mapEncounterRecord(record);
    },
    async getEncounterById(encounterId) {
      return (await combatReadRepository.getFullEncounterById(encounterId))?.encounter ?? null;
    },
    async getEncounterSummaryById(encounterId) {
      const record = await client.encounter.findUnique({
        select: {
          campaignId: true,
          createdAt: true,
          id: true,
          name: true,
          scenarioId: true,
          status: true,
          updatedAt: true,
        },
        where: { id: encounterId },
      });

      return record ? mapEncounterSummary(record) : null;
    },
    async listEncountersByScenario(scenarioId) {
      const records = await client.encounter.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true },
        where: { scenarioId },
      });

      const encounters = await Promise.all(
        records.map((record) => combatReadRepository.getFullEncounterById(record.id)),
      );
      return encounters.flatMap((view) => (view ? [view.encounter] : []));
    },
    async listScenarioSessionEncounters(scenarioId) {
      const records = await client.encounter.findMany({
        orderBy: { updatedAt: "desc" },
        select: { id: true, status: true },
        where: { scenarioId },
      });
      const isFinished = (status: string) => {
        const parsed = encounterStatusSchema.safeParse(status);
        return parsed.success && (parsed.data === "completed" || parsed.data === "archived");
      };
      const readFull = async (encounterId: string) =>
        (await combatReadRepository.getFullEncounterById(encounterId))?.encounter ?? null;
      const summaries = combatReadRepository.listFinishedEncounterSessionSummaries({
        encounterIds: records.filter((record) => isFinished(record.status)).map(({ id }) => id),
        scenarioId,
      });

      const encounters = await Promise.all(
        records.map(async (record) => {
          if (!isFinished(record.status)) return readFull(record.id);
          // A finished Encounter the summary read does not cover — one still in legacy storage —
          // is read in full, as before.
          return (await summaries).get(record.id) ?? readFull(record.id);
        }),
      );
      return encounters.flatMap((encounter) => (encounter ? [encounter] : []));
    },
    async listEncounterSummariesByScenario(scenarioId) {
      const records = await client.encounter.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          campaignId: true,
          createdAt: true,
          id: true,
          name: true,
          scenarioId: true,
          status: true,
          updatedAt: true,
        },
        where: { scenarioId },
      });

      return records.map(mapEncounterSummary);
    },
    async updateEncounter(input) {
      let audienceParticipantIds: string[] = [];
      return combatPersistenceRepository.updateEncounterPreservingSplitCombat({
        ...input,
        afterPersist: async (transaction, encounter) => {
          if (!input.objectiveEvent || !encounter.scenarioId) return;
          await transaction.scenarioEventLog.create({
            data: {
              actorUserId: input.objectiveEvent.actorUserId ?? null,
              eventType: input.objectiveEvent.eventType,
              payloadJson: asJson({
                audienceParticipantIds,
                encounterId: encounter.id,
              }),
              scenarioId: encounter.scenarioId,
              summary: input.objectiveEvent.summary,
            },
          });
        },
        beforePersist: async (transaction, encounter) => {
          if (!encounter.scenarioId) return;
          await assertEncounterRosterIdentity({
            encounter,
            scenarioId: encounter.scenarioId,
            transaction,
          });
          audienceParticipantIds =
            encounter.status === "active"
              ? await assertActiveEncounterPresence({
                  encounter,
                  scenarioId: encounter.scenarioId,
                  transaction,
                })
              : encounter.participants.flatMap((participant) =>
                  participant.scenarioParticipantId ? [participant.scenarioParticipantId] : [],
                );
        },
      });
    },
    async updateCombatEncounter(input) {
      const { permitInactiveRosterParticipants, ...persistenceInput } = input;
      return combatPersistenceRepository.updateCombatEncounter({
        ...persistenceInput,
        afterPersist: async (transaction, encounter) => {
          if (!encounter.scenarioId) return;
          for (const event of input.objectiveEvents ?? []) {
            // Write-side narrowing (combat-panel-contract.md 12.7/12.13): round and phase
            // bookkeeping never becomes an Activity row in the first place. The read-side gate in
            // `projectScenarioObjectiveHistory` covers the legacy rows 12.19 forbids migrating.
            if (!isCombatStepEventPublishedToActivity(event.type)) continue;
            const toScenarioParticipantId = (participantId: string | undefined) =>
              encounter.participants.find(
                (participant) =>
                  participant.id === participantId ||
                  participant.scenarioParticipantId === participantId,
              )?.scenarioParticipantId;
            const actorParticipantId = toScenarioParticipantId(event.actorParticipantId);
            const audienceParticipantIds =
              event.visibility.outcomeScope === "public"
                ? undefined
                : event.visibility.involvedParticipantIds.flatMap((participantId) => {
                    const scenarioParticipantId = toScenarioParticipantId(participantId);
                    return scenarioParticipantId ? [scenarioParticipantId] : [];
                  });
            // A2-Q1: a GM-adjudicated outcome carries its GM-authored player-safe text, exactly as
            // `combatItemInteractionService` already does for an Item resolution. Every automatic
            // outcome stores structured facts instead, and its sentence is produced per viewer.
            const gmAuthoredSummary =
              event.type === "task_resolved" &&
              typeof event.facts.involvedOutcome.resultText === "string" &&
              event.facts.involvedOutcome.resultText.trim().length > 0
                ? event.facts.involvedOutcome.resultText
                : undefined;
            const activityFacts = buildCombatActivityFacts({
              event,
              summaryFacts: input.objectiveEventSummaryFacts?.[event.id],
              toScenarioParticipantId,
            });
            await transaction.scenarioEventLog.create({
              data: {
                eventType: "encounter_combat_outcome",
                participantId: null,
                payloadJson: asJson({
                  ...(audienceParticipantIds ? { audienceParticipantIds } : {}),
                  [COMBAT_ACTIVITY_FACTS_PAYLOAD_KEY]: activityFacts,
                  actorParticipantId,
                  combatEventId: event.id,
                  combatSequence: event.sequence,
                  encounterId: encounter.id,
                  eventKind: event.type,
                  ...(gmAuthoredSummary ? { gmAuthoredSummary: true } : {}),
                  sourceOccurredAt: event.occurredAt,
                }),
                phase: event.phase === "phase1" ? 1 : event.phase === "phase2" ? 2 : null,
                roundNumber: event.roundNumber,
                scenarioId: encounter.scenarioId,
                summary: gmAuthoredSummary ?? `Combat: ${event.type.replaceAll("_", " ")}.`,
              },
            });
          }
        },
        beforePersist: async (transaction, encounter) => {
          if (!encounter.scenarioId) return;
          await assertEncounterRosterIdentity({
            encounter,
            scenarioId: encounter.scenarioId,
            transaction,
          });
          await assertActiveEncounterPresence({
            encounter,
            permitInactiveRosterParticipants,
            scenarioId: encounter.scenarioId,
            transaction,
          });
        },
      });
    },
  };
}
