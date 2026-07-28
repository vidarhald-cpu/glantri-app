"use client";

type CombatPerformanceInteraction = {
  command: string;
  correlationId: string;
  encounterId: string;
  pendingRequestCount: number;
  requestCount: number;
  requestResolved: boolean;
  renderCount: number;
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
    pendingRequestCount: 0,
    renderCount: 0,
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
  };

  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    finish();
    return;
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
}

export function resetCombatPerformanceForTests(): void {
  activeInteraction = undefined;
  fallbackCorrelationSequence = 0;
}
