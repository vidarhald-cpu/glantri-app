import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import type { FastifyInstance } from "fastify";

export type CombatPerformanceStageRecord = {
  durationMs: number;
  stage: string;
} & Record<string, boolean | number | string | undefined>;

export type CombatPerformanceServerCapture = {
  archivedRoundCount?: number;
  broadEncounterReads: number;
  command: string;
  commandCount?: number;
  correlationId: string;
  encounterId?: string;
  participantCount?: number;
  repositoryOperations: number;
  revision?: string;
  roundNumber?: number;
  stages: CombatPerformanceStageRecord[];
};

type ClientCapture = {
  clickToSettledMs?: number;
  followUpRequests: Array<{
    method?: string;
    path?: string;
    startedAtMs?: number;
  }>;
  networkMs?: number;
  panelBuildMs?: number;
  reactCommitMs?: number;
  renderMs?: number;
  renderCount: number;
  requestCount: number;
  responseBytes?: number;
  responseParseMs?: number;
  stages: CombatPerformanceStageRecord[];
  trackerBuildMs?: number;
};

type CombatPerformanceCapture = {
  archivedRoundCount?: number;
  capturedAt: string;
  client: ClientCapture | null;
  command: string;
  commandCount?: number;
  correlationId: string;
  encounterId?: string;
  participantCount?: number;
  responseBytes?: number;
  revision?: string;
  round?: number;
  server: {
    activeReadMs?: number;
    apiTotalMs?: number;
    authenticationMs?: number;
    authorizationMs?: number;
    broadEncounterReads: number;
    compatibilityReadMs?: number;
    executionMs?: number;
    historyReadMs?: number;
    materializationMs?: number;
    projectionMs?: number;
    repositoryOperations: number;
    serializationMs?: number;
    stages: CombatPerformanceStageRecord[];
    writeMs?: number;
  };
  task: string;
  version: 1;
};

const DEFAULT_CAPTURE_DIRECTORY = resolve(__dirname, "../../../../tmp/combat-performance");
const DEFAULT_MAX_CAPTURE_FILES = 100;
const capturePaths = new Map<string, string>();
const pendingClientCaptures = new Map<string, ClientCapture>();

function isEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.GLANTRI_COMBAT_PERF === "1";
}

function captureDirectory(): string {
  return process.env.GLANTRI_COMBAT_PERF_DIR || DEFAULT_CAPTURE_DIRECTORY;
}

function maxCaptureFiles(): number {
  const configured = Number(process.env.GLANTRI_COMBAT_PERF_MAX_FILES);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_CAPTURE_FILES;
}

function safeFilePart(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return normalized.slice(0, 80) || "combat_command";
}

function sumStage(
  stages: CombatPerformanceStageRecord[],
  ...stageNames: string[]
): number | undefined {
  const matching = stages.filter((stage) => stageNames.includes(stage.stage));
  if (matching.length === 0) {
    return undefined;
  }
  return Number(matching.reduce((total, stage) => total + stage.durationMs, 0).toFixed(2));
}

function firstNumber(
  stages: CombatPerformanceStageRecord[],
  stageName: string,
  property: string,
): number | undefined {
  const value = stages.find((stage) => stage.stage === stageName)?.[property];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function buildServerSummary(input: CombatPerformanceServerCapture): CombatPerformanceCapture {
  return {
    archivedRoundCount: input.archivedRoundCount,
    capturedAt: new Date().toISOString(),
    client: null,
    command: input.command,
    commandCount: input.commandCount,
    correlationId: input.correlationId,
    encounterId: input.encounterId,
    participantCount: input.participantCount,
    responseBytes: firstNumber(input.stages, "response_serialization_probe", "payloadBytes"),
    revision: input.revision,
    round: input.roundNumber,
    server: {
      activeReadMs: sumStage(input.stages, "repository_read_active"),
      apiTotalMs: sumStage(input.stages, "api_total"),
      authenticationMs: sumStage(input.stages, "authentication_complete"),
      authorizationMs: sumStage(
        input.stages,
        "workspace_authorization",
        "descriptor_projection_and_authorization",
      ),
      broadEncounterReads: input.broadEncounterReads,
      compatibilityReadMs: sumStage(input.stages, "repository_read_full_encounter"),
      executionMs: sumStage(input.stages, "domain_command_execution"),
      historyReadMs: sumStage(input.stages, "repository_read_history_source"),
      materializationMs: sumStage(input.stages, "active_state_materialization"),
      projectionMs: sumStage(input.stages, "response_construction"),
      repositoryOperations: input.repositoryOperations,
      serializationMs: sumStage(input.stages, "response_serialization_probe"),
      stages: input.stages,
      writeMs: sumStage(
        input.stages,
        "repository_write_participant",
        "repository_write_scenario_event",
        "repository_write_transaction",
      ),
    },
    task: input.command,
    version: 1,
  };
}

function capturePath(input: {
  command: string;
  correlationId: string;
  capturedAt: string;
}): string {
  const existing = capturePaths.get(input.correlationId);
  if (existing) {
    return existing;
  }

  const timestamp = input.capturedAt.replace(/[:.]/g, "-");
  const filename = `${timestamp}_${safeFilePart(input.command)}_${safeFilePart(
    input.correlationId,
  ).slice(0, 16)}.json`;
  const path = `${captureDirectory()}/${filename}`;
  capturePaths.set(input.correlationId, path);
  return path;
}

function readCapture(path: string): CombatPerformanceCapture | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CombatPerformanceCapture;
  } catch {
    return undefined;
  }
}

function rotateCaptures(): void {
  const directory = captureDirectory();
  const files = readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort();
  const removed = files.slice(0, Math.max(0, files.length - maxCaptureFiles()));

  for (const filename of removed) {
    const path = `${directory}/${filename}`;
    unlinkSync(path);
    for (const [correlationId, mappedPath] of capturePaths) {
      if (mappedPath === path) {
        capturePaths.delete(correlationId);
      }
    }
  }
}

function writeCapture(path: string, capture: CombatPerformanceCapture): void {
  mkdirSync(captureDirectory(), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(capture, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, path);
  rotateCaptures();
}

export function persistCombatPerformanceServerCapture(
  input: CombatPerformanceServerCapture,
): string | undefined {
  if (!isEnabled()) {
    return undefined;
  }
  const serverCapture = buildServerSummary(input);
  const path = capturePath(serverCapture);
  const existing = readCapture(path);
  writeCapture(path, {
    ...serverCapture,
    client: existing?.client ?? pendingClientCaptures.get(input.correlationId) ?? null,
  });
  pendingClientCaptures.delete(input.correlationId);
  return path;
}

export function reserveCombatPerformanceCapture(input: {
  command: string;
  correlationId: string;
}): void {
  if (!isEnabled()) {
    return;
  }
  capturePath({
    capturedAt: new Date().toISOString(),
    command: input.command,
    correlationId: input.correlationId,
  });
}

function boundedString(value: unknown, maximumLength: number): string | undefined {
  return typeof value === "string" ? value.slice(0, maximumLength) : undefined;
}

function boundedNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(2))
    : undefined;
}

function sanitizeStage(value: unknown): CombatPerformanceStageRecord | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const stage = boundedString(candidate.stage, 80);
  const durationMs = boundedNumber(candidate.durationMs);
  if (!stage || durationMs === undefined) {
    return undefined;
  }

  const sanitized: CombatPerformanceStageRecord = { durationMs, stage };
  for (const [key, item] of Object.entries(candidate).slice(0, 20)) {
    if (key === "durationMs" || key === "stage" || key.length > 80) {
      continue;
    }
    if (typeof item === "boolean") {
      sanitized[key] = item;
    } else if (typeof item === "number" && Number.isFinite(item)) {
      sanitized[key] = Number(item.toFixed(2));
    } else if (typeof item === "string") {
      sanitized[key] = item.slice(0, 300);
    }
  }
  return sanitized;
}

function sanitizeClientCapture(value: unknown): ClientCapture | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  const stages = Array.isArray(candidate.stages)
    ? candidate.stages.slice(0, 200).map(sanitizeStage).filter((stage) => stage !== undefined)
    : [];
  const requests = Array.isArray(candidate.followUpRequests)
    ? candidate.followUpRequests.slice(0, 50).flatMap((request) => {
        if (!request || typeof request !== "object") {
          return [];
        }
        const entry = request as Record<string, unknown>;
        return [
          {
            method: boundedString(entry.method, 20),
            path: boundedString(entry.path, 300),
            startedAtMs: boundedNumber(entry.startedAtMs),
          },
        ];
      })
    : [];

  return {
    clickToSettledMs: boundedNumber(candidate.clickToSettledMs),
    followUpRequests: requests,
    networkMs: boundedNumber(candidate.networkMs),
    panelBuildMs: boundedNumber(candidate.panelBuildMs),
    reactCommitMs: boundedNumber(candidate.reactCommitMs),
    renderMs: boundedNumber(candidate.renderMs),
    renderCount: boundedNumber(candidate.renderCount) ?? 0,
    requestCount: boundedNumber(candidate.requestCount) ?? 0,
    responseBytes: boundedNumber(candidate.responseBytes),
    responseParseMs: boundedNumber(candidate.responseParseMs),
    stages,
    trackerBuildMs: boundedNumber(candidate.trackerBuildMs),
  };
}

export function mergeCombatPerformanceClientCapture(input: {
  client: unknown;
  correlationId: string;
}): string | undefined {
  if (!isEnabled()) {
    return undefined;
  }
  const path = capturePaths.get(input.correlationId);
  const client = sanitizeClientCapture(input.client);
  if (!path || !client) {
    return undefined;
  }
  const existing = readCapture(path);
  if (!existing) {
    pendingClientCaptures.set(input.correlationId, client);
    return path;
  }
  if (existing.correlationId !== input.correlationId) {
    return undefined;
  }
  writeCapture(path, { ...existing, client });
  return path;
}

export function registerCombatPerformanceCaptureRoute(app: FastifyInstance): void {
  app.post("/internal/combat-performance/:correlationId", async (request, reply) => {
    if (!isEnabled()) {
      return reply.code(404).send({ error: "Not found." });
    }
    const correlationId = boundedString(
      (request.params as { correlationId?: unknown }).correlationId,
      160,
    );
    const client =
      request.body && typeof request.body === "object"
        ? (request.body as { client?: unknown }).client
        : undefined;
    if (!correlationId || !mergeCombatPerformanceClientCapture({ client, correlationId })) {
      return reply.code(404).send({ error: "Unknown performance correlation." });
    }
    return reply.code(204).send();
  });
}

export function resetCombatPerformanceCapturesForTests(): void {
  capturePaths.clear();
  pendingClientCaptures.clear();
}
