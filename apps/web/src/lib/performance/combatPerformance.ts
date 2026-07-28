"use client";

import { API_BASE_URL } from "../api/apiConfig";

type CombatPerformanceInteraction = {
  command: string;
  correlationId: string;
  encounterId: string;
  expectedRevision?: string;
  pendingRequestCount: number;
  participantCount: number;
  records: CombatPerformanceRecord[];
  requestCount: number;
  requestResolved: boolean;
  renderCount: number;
  roundNumber: number;
  settleRequested: boolean;
  startedAt: number;
};

type CombatPerformanceRecord = {
  command: string;
  correlationId: string;
  durationMs: number;
  encounterId: string;
  requestCount: number;
  renderCount: number;
  stage: string;
} & Record<string, boolean | number | string | undefined>;

let activeInteraction: CombatPerformanceInteraction | undefined;
let fallbackCorrelationSequence = 0;

export function isCombatPerformanceEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_GLANTRI_COMBAT_PERF === "1"
  );
}

export function combatPerformanceNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function createCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  fallbackCorrelationSequence += 1;
  return `combat-perf-${Date.now()}-${fallbackCorrelationSequence}`;
}

function writeRecord(
  stage: string,
  durationMs: number,
  extra: Record<string, boolean | number | string | undefined> = {},
): void {
  if (!activeInteraction) {
    return;
  }
  const record: CombatPerformanceRecord = {
    command: activeInteraction.command,
    correlationId: activeInteraction.correlationId,
    durationMs: Number(durationMs.toFixed(2)),
    encounterId: activeInteraction.encounterId,
    renderCount: activeInteraction.renderCount,
    requestCount: activeInteraction.requestCount,
    stage,
    ...extra,
  };
  activeInteraction.records.push(record);
  // Development-only, metadata-only measurement output. Never include request/response bodies.
  console.info("PERF combat-command", record);
}

export function beginCombatPerformanceInteraction(input: {
  command: string;
  encounterId: string;
  expectedRevision?: string;
  participantCount: number;
  roundNumber: number;
}): string | undefined {
  if (!isCombatPerformanceEnabled()) {
    return undefined;
  }

  activeInteraction = {
    command: input.command,
    correlationId: createCorrelationId(),
    encounterId: input.encounterId,
    expectedRevision: input.expectedRevision,
    pendingRequestCount: 0,
    participantCount: input.participantCount,
    records: [],
    renderCount: 0,
    roundNumber: input.roundNumber,
    requestCount: 0,
    requestResolved: false,
    settleRequested: false,
    startedAt: combatPerformanceNow(),
  };
  writeRecord("click", 0, {
    participantCount: input.participantCount,
    revision: input.expectedRevision,
    roundNumber: input.roundNumber,
  });
  return activeInteraction.correlationId;
}

export function getCombatPerformanceRequestHeaders(): Record<string, string> | undefined {
  if (!activeInteraction) {
    return undefined;
  }
  return {
    "x-glantri-combat-command": activeInteraction.command,
    "x-glantri-combat-correlation-id": activeInteraction.correlationId,
  };
}

export function recordCombatPerformanceRequestStart(input: {
  method: string;
  path: string;
}): number | undefined {
  if (!activeInteraction) {
    return undefined;
  }
  activeInteraction.requestCount += 1;
  activeInteraction.pendingRequestCount += 1;
  const startedAt = combatPerformanceNow();
  writeRecord("request_start", startedAt - activeInteraction.startedAt, {
    method: input.method,
    path: input.path.split("?")[0],
  });
  return startedAt;
}

export function recordCombatPerformanceRequestEnd(input: {
  parseDurationMs: number;
  path: string;
  requestStartedAt?: number;
  responseBytes?: number;
  status?: number;
}): void {
  if (!activeInteraction || input.requestStartedAt === undefined) {
    return;
  }
  activeInteraction.requestResolved = true;
  activeInteraction.pendingRequestCount = Math.max(0, activeInteraction.pendingRequestCount - 1);
  writeRecord("network_and_parse", combatPerformanceNow() - input.requestStartedAt, {
    parseDurationMs: Number(input.parseDurationMs.toFixed(2)),
    path: input.path.split("?")[0],
    responseBytes: input.responseBytes,
    status: input.status,
  });
  if (activeInteraction.settleRequested && activeInteraction.pendingRequestCount === 0) {
    settleCombatPerformanceInteraction();
  }
}

export function recordCombatPerformanceStage(
  stage: string,
  durationMs: number,
  extra?: Record<string, boolean | number | string | undefined>,
): void {
  writeRecord(stage, durationMs, extra);
}

export function recordCombatPerformanceAdoption(input: {
  accepted: boolean;
  revision?: string;
}): void {
  if (!activeInteraction) {
    return;
  }
  writeRecord("canonical_state_adoption", combatPerformanceNow() - activeInteraction.startedAt, {
    accepted: input.accepted,
    revision: input.revision,
  });
}

export function recordCombatPerformanceReactCommit(input: {
  actualDuration: number;
  baseDuration: number;
  phase: "mount" | "nested-update" | "update";
}): void {
  if (!activeInteraction) {
    return;
  }
  activeInteraction.renderCount += 1;
  writeRecord("react_commit", input.actualDuration, {
    baseDurationMs: Number(input.baseDuration.toFixed(2)),
    reactPhase: input.phase,
  });
}

export function settleCombatPerformanceInteraction(): void {
  const interaction = activeInteraction;
  if (!interaction?.requestResolved) {
    return;
  }
  interaction.settleRequested = true;

  const finish = () => {
    if (activeInteraction !== interaction || interaction.pendingRequestCount > 0) {
      return;
    }
    writeRecord("click_to_settled", combatPerformanceNow() - interaction.startedAt);
    activeInteraction = undefined;
    flushCombatPerformanceCapture(interaction);
  };

  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    finish();
    return;
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
}

function sumStage(records: CombatPerformanceRecord[], stage: string): number | undefined {
  const matching = records.filter((record) => record.stage === stage);
  if (matching.length === 0) {
    return undefined;
  }
  return Number(matching.reduce((total, record) => total + record.durationMs, 0).toFixed(2));
}

function flushCombatPerformanceCapture(interaction: CombatPerformanceInteraction): void {
  const requests = interaction.records.filter((record) => record.stage === "request_start");
  const network = interaction.records.find((record) => record.stage === "network_and_parse");
  const clickToSettled = interaction.records.find(
    (record) => record.stage === "click_to_settled",
  );
  const payload = {
    client: {
      clickToSettledMs: clickToSettled?.durationMs,
      followUpRequests: requests.slice(1).map((request) => ({
        method: typeof request.method === "string" ? request.method : undefined,
        path: typeof request.path === "string" ? request.path : undefined,
        startedAtMs: request.durationMs,
      })),
      networkMs:
        network && typeof network.parseDurationMs === "number"
          ? Number((network.durationMs - network.parseDurationMs).toFixed(2))
          : network?.durationMs,
      panelBuildMs: sumStage(interaction.records, "combat_panel_view_model"),
      reactCommitMs: sumStage(interaction.records, "react_commit"),
      renderMs: sumStage(interaction.records, "react_commit"),
      renderCount: interaction.renderCount,
      requestCount: interaction.requestCount,
      responseBytes:
        network && typeof network.responseBytes === "number" ? network.responseBytes : undefined,
      responseParseMs:
        network && typeof network.parseDurationMs === "number"
          ? network.parseDurationMs
          : undefined,
      stages: interaction.records,
      trackerBuildMs: sumStage(interaction.records, "tracker_view_model"),
    },
  };

  void fetch(
    `${API_BASE_URL}/internal/combat-performance/${encodeURIComponent(
      interaction.correlationId,
    )}`,
    {
      body: JSON.stringify(payload),
      credentials: "include",
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST",
    },
  ).catch(() => {
    // Capture persistence is diagnostic only and must never affect combat interaction.
  });
}

export function resetCombatPerformanceForTests(): void {
  activeInteraction = undefined;
  fallbackCorrelationSequence = 0;
}
