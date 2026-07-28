import { afterEach, describe, expect, it, vi } from "vitest";

import {
  beginCombatPerformanceInteraction,
  combatPerformanceNow,
  getCombatPerformanceRequestHeaders,
  isCombatPerformanceEnabled,
  recordCombatPerformanceRequestEnd,
  recordCombatPerformanceRequestStart,
  resetCombatPerformanceForTests,
} from "./combatPerformance";

afterEach(() => {
  resetCombatPerformanceForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("browser combat performance instrumentation", () => {
  it("is disabled by default and provides no correlation headers", () => {
    vi.stubEnv("NEXT_PUBLIC_GLANTRI_COMBAT_PERF", "");

    expect(isCombatPerformanceEnabled()).toBe(false);
    expect(
      beginCombatPerformanceInteraction({
        command: "roll_attack",
        encounterId: "encounter-1",
        participantCount: 2,
        roundNumber: 1,
      }),
    ).toBeUndefined();
    expect(getCombatPerformanceRequestHeaders()).toBeUndefined();
  });

  it("preserves one correlation id through request measurement", () => {
    vi.stubEnv("NEXT_PUBLIC_GLANTRI_COMBAT_PERF", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    const correlationId = beginCombatPerformanceInteraction({
      command: "complete_remaining_step",
      encounterId: "encounter-2",
      expectedRevision: "revision-2",
      participantCount: 2,
      roundNumber: 5,
    });
    const headers = getCombatPerformanceRequestHeaders();
    const requestStartedAt = recordCombatPerformanceRequestStart({
      method: "POST",
      path: "/encounters/encounter-2/combat-round/complete-remaining-step",
    });
    recordCombatPerformanceRequestEnd({
      parseDurationMs: 1,
      path: "/encounters/encounter-2/combat-round/complete-remaining-step",
      requestStartedAt,
      status: 200,
    });

    expect(correlationId).toBeTruthy();
    expect(headers?.["x-glantri-combat-correlation-id"]).toBe(correlationId);
    expect(headers?.["x-glantri-combat-command"]).toBe("complete_remaining_step");
  });

  it("does not throw when the browser Performance API is unavailable", () => {
    vi.stubGlobal("performance", undefined);
    expect(() => combatPerformanceNow()).not.toThrow();
    expect(combatPerformanceNow()).toBeTypeOf("number");
  });
});
