import { afterEach, describe, expect, it, vi } from "vitest";

import {
  beginCombatPerformanceInteraction,
  combatPerformanceNow,
  getCombatPerformanceRequestHeaders,
  isCombatPerformanceEnabled,
  measureCombatPerformanceStage,
  recordCombatPerformanceRequestEnd,
  recordCombatPerformanceRequestStart,
  resetCombatPerformanceForTests,
  settleCombatPerformanceInteraction,
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

  it("measures opt-in presentation substages without changing their result", () => {
    vi.stubEnv("NEXT_PUBLIC_GLANTRI_COMBAT_PERF", "1");
    vi.stubEnv("NODE_ENV", "development");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    beginCombatPerformanceInteraction({
      command: "inspect_archived_tracker_cell",
      encounterId: "encounter-2",
      participantCount: 2,
      requestExpected: false,
      roundNumber: 3,
    });

    expect(
      measureCombatPerformanceStage("panel_historical_snapshot_resolution", () => "preserved"),
    ).toBe("preserved");
    expect(info).toHaveBeenCalledWith(
      "PERF combat-command",
      expect.objectContaining({
        stage: "panel_historical_snapshot_resolution",
      }),
    );
  });

  it("does not measure presentation substages when instrumentation is disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_GLANTRI_COMBAT_PERF", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    expect(measureCombatPerformanceStage("panel_active_modifier_presentation", () => 42)).toBe(42);
    expect(info).not.toHaveBeenCalled();
  });

  it("posts one bounded client summary after the interaction settles", async () => {
    vi.stubEnv("NEXT_PUBLIC_GLANTRI_COMBAT_PERF", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const correlationId = beginCombatPerformanceInteraction({
      command: "complete_modifier_review",
      encounterId: "encounter-3",
      expectedRevision: "revision-3",
      participantCount: 2,
      roundNumber: 5,
    });
    const requestStartedAt = recordCombatPerformanceRequestStart({
      method: "POST",
      path: "/encounters/encounter-3/combat-round/modifier-review",
    });
    measureCombatPerformanceStage("panel_phase_summary_presentation", () => undefined);
    measureCombatPerformanceStage("panel_phase_summary_presentation", () => undefined);
    recordCombatPerformanceRequestEnd({
      parseDurationMs: 1,
      path: "/encounters/encounter-3/combat-round/modifier-review",
      requestStartedAt,
      responseBytes: 2048,
      status: 200,
    });
    settleCombatPerformanceInteraction();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(fetch.mock.calls[0]?.[0]).toContain(`/internal/combat-performance/${correlationId}`);
    const request = fetch.mock.calls[0]?.[1];
    expect(request).toMatchObject({
      credentials: "include",
      keepalive: true,
      method: "POST",
    });
    expect(String(request?.body)).toContain('"responseBytes":2048');
    expect(JSON.parse(String(request?.body))).toMatchObject({
      client: {
        stages: expect.arrayContaining([
          expect.objectContaining({
            executionCount: 2,
            stage: "panel_phase_summary_presentation",
          }),
        ]),
      },
    });
    expect(String(request?.body)).not.toContain("participantSheet");
  });

  it("records every archived-inspection request as a sized follow-up", async () => {
    vi.stubEnv("NEXT_PUBLIC_GLANTRI_COMBAT_PERF", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    beginCombatPerformanceInteraction({
      command: "inspect_archived_tracker_cell",
      encounterId: "encounter-4",
      participantCount: 2,
      requestExpected: false,
      roundNumber: 4,
    });
    for (const [path, responseBytes] of [
      ["/characters/character-1", 1200],
      ["/characters/character-1/equipment", 3400],
    ] as const) {
      const requestStartedAt = recordCombatPerformanceRequestStart({ method: "GET", path });
      recordCombatPerformanceRequestEnd({
        parseDurationMs: 1,
        path,
        requestStartedAt,
        responseBytes,
        status: 200,
      });
    }
    settleCombatPerformanceInteraction();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      client: {
        followUpRequests: [
          { path: "/characters/character-1", responseBytes: 1200, status: 200 },
          { path: "/characters/character-1/equipment", responseBytes: 3400, status: 200 },
        ],
      },
    });
  });
});
