import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";

import type { FastifyRequest } from "fastify";

import type { EncounterSession } from "@glantri/domain";

export const COMBAT_PERFORMANCE_CORRELATION_HEADER = "x-glantri-combat-correlation-id";
export const COMBAT_PERFORMANCE_COMMAND_HEADER = "x-glantri-combat-command";

type CombatPerformanceCounts = {
  archivedRoundCount?: number;
  commandCount?: number;
  participantCount?: number;
  roundNumber?: number;
};

type CombatPerformanceContext = {
  broadEncounterReads: number;
  command: string;
  correlationId: string;
  counts: CombatPerformanceCounts;
  encounterId?: string;
  repositoryOperations: number;
  requestStartedAt: number;
  revision?: string;
};

const storage = new AsyncLocalStorage<CombatPerformanceContext>();

export function isCombatPerformanceEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.GLANTRI_COMBAT_PERF === "1";
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function writeCombatPerformanceRecord(input: {
  durationMs: number;
  extra?: Record<string, boolean | number | string | undefined>;
  stage: string;
}): void {
  const context = storage.getStore();
  if (!context) {
    return;
  }

  process.stdout.write(
    `PERF combat-command ${JSON.stringify({
      archivedRoundCount: context.counts.archivedRoundCount,
      broadEncounterReads: context.broadEncounterReads,
      command: context.command,
      commandCount: context.counts.commandCount,
      correlationId: context.correlationId,
      durationMs: Number(input.durationMs.toFixed(2)),
      encounterId: context.encounterId,
      participantCount: context.counts.participantCount,
      repositoryOperations: context.repositoryOperations,
      revision: context.revision,
      roundNumber: context.counts.roundNumber,
      stage: input.stage,
      ...input.extra,
    })}\n`,
  );
}

export function runCombatPerformanceRequest(request: FastifyRequest, next: () => void): void {
  const correlationId = firstHeader(request.headers[COMBAT_PERFORMANCE_CORRELATION_HEADER]);
  if (!isCombatPerformanceEnabled() || !correlationId) {
    next();
    return;
  }

  const path = request.raw.url ?? request.url;
  const encounterMatch = path.match(/\/encounters\/([^/?]+)/);
  storage.run(
    {
      broadEncounterReads: 0,
      command:
        firstHeader(request.headers[COMBAT_PERFORMANCE_COMMAND_HEADER]) ??
        `${request.method} ${path.split("?")[0]}`,
      correlationId,
      counts: {},
      encounterId: encounterMatch?.[1],
      repositoryOperations: 0,
      requestStartedAt: performance.now(),
    },
    next,
  );
}

export function recordCombatPerformanceCheckpoint(
  stage: string,
  extra?: Record<string, boolean | number | string | undefined>,
): void {
  const context = storage.getStore();
  if (!context) {
    return;
  }
  writeCombatPerformanceRecord({
    durationMs: performance.now() - context.requestStartedAt,
    extra,
    stage,
  });
}

export function finishCombatPerformanceRequest(statusCode: number): void {
  const context = storage.getStore();
  if (!context) {
    return;
  }
  writeCombatPerformanceRecord({
    durationMs: performance.now() - context.requestStartedAt,
    extra: { statusCode },
    stage: "api_total",
  });
}

export function annotateCombatPerformanceEncounter(
  encounter: EncounterSession | null | undefined,
): void {
  const context = storage.getStore();
  const roundState = encounter?.combatRoundState;
  if (!context || !encounter || !roundState) {
    return;
  }

  context.encounterId = encounter.id;
  context.revision = encounter.updatedAt;
  context.counts = {
    archivedRoundCount: roundState.rounds.length,
    commandCount: roundState.commands.length,
    participantCount: roundState.participants.length,
    roundNumber: roundState.roundNumber,
  };
}

export function probeCombatPerformanceSerialization(payload: unknown): void {
  if (!storage.getStore()) {
    return;
  }
  const startedAt = performance.now();
  const payloadBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  writeCombatPerformanceRecord({
    durationMs: performance.now() - startedAt,
    extra: { payloadBytes },
    stage: "response_serialization_probe",
  });
}

export async function timeCombatPerformanceStage<T>(
  stage: string,
  run: () => Promise<T>,
  options: {
    broadEncounterRead?: boolean;
    repositoryOperation?: boolean;
    summarizeEncounter?: boolean;
  } = {},
): Promise<T> {
  const context = storage.getStore();
  if (!context) {
    return run();
  }

  if (options.broadEncounterRead) {
    context.broadEncounterReads += 1;
  }
  if (options.repositoryOperation) {
    context.repositoryOperations += 1;
  }

  const startedAt = performance.now();
  try {
    const result = await run();
    if (options.summarizeEncounter) {
      annotateCombatPerformanceEncounter(result as EncounterSession | null);
    }
    writeCombatPerformanceRecord({
      durationMs: performance.now() - startedAt,
      stage,
    });
    return result;
  } catch (error) {
    writeCombatPerformanceRecord({
      durationMs: performance.now() - startedAt,
      extra: { failed: true },
      stage,
    });
    throw error;
  }
}

export function measureCombatPerformanceStage<T>(stage: string, run: () => T): T {
  const context = storage.getStore();
  if (!context) {
    return run();
  }

  const startedAt = performance.now();
  try {
    return run();
  } finally {
    writeCombatPerformanceRecord({
      durationMs: performance.now() - startedAt,
      stage,
    });
  }
}

export function instrumentCombatService<T extends object>(
  service: T,
  methods: Partial<
    Record<
      keyof T,
      {
        broadEncounterRead?: boolean;
        stage: string;
        summarizeEncounter?: boolean;
      }
    >
  >,
): T {
  return new Proxy(service, {
    get(target, property, receiver) {
      const original = Reflect.get(target, property, receiver);
      const measurement = methods[property as keyof T];
      if (typeof original !== "function" || !measurement) {
        return original;
      }

      return (...args: unknown[]) =>
        timeCombatPerformanceStage(
          measurement.stage,
          () => Reflect.apply(original, target, args) as Promise<unknown>,
          {
            broadEncounterRead: measurement.broadEncounterRead,
            repositoryOperation: true,
            summarizeEncounter: measurement.summarizeEncounter,
          },
        );
    },
  });
}
