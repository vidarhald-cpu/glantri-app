import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  finishCombatPerformanceRequest,
  isCombatPerformanceEnabled,
  recordCombatPerformanceCheckpoint,
  runCombatPerformanceRequest,
  timeCombatPerformanceStage,
} from "./combatPerformance";
import { resetCombatPerformanceCapturesForTests } from "./combatPerformanceCapture";

let captureDirectory: string;

beforeEach(() => {
  captureDirectory = mkdtempSync(`${tmpdir()}/glantri-combat-perf-test-`);
  vi.stubEnv("GLANTRI_COMBAT_PERF_DIR", captureDirectory);
  resetCombatPerformanceCapturesForTests();
});

afterEach(() => {
  rmSync(captureDirectory, { force: true, recursive: true });
  resetCombatPerformanceCapturesForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("combat performance instrumentation", () => {
  it("is disabled by default and emits no output", () => {
    vi.stubEnv("GLANTRI_COMBAT_PERF", "");
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    expect(isCombatPerformanceEnabled()).toBe(false);
    runCombatPerformanceRequest(
      {
        headers: {
          "x-glantri-combat-command": "roll_attack",
          "x-glantri-combat-correlation-id": "correlation-1",
        },
        method: "POST",
        raw: { url: "/encounters/encounter-1/combat-round/attack" },
        url: "/encounters/encounter-1/combat-round/attack",
      } as never,
      () => recordCombatPerformanceCheckpoint("domain_command_execution"),
    );

    expect(write).not.toHaveBeenCalled();
  });

  it("preserves correlation metadata without logging payload contents", () => {
    vi.stubEnv("GLANTRI_COMBAT_PERF", "1");
    vi.stubEnv("NODE_ENV", "development");
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    runCombatPerformanceRequest(
      {
        body: { secretCombatPayload: "must-not-be-logged" },
        headers: {
          "x-glantri-combat-command": "roll_attack",
          "x-glantri-combat-correlation-id": "correlation-2",
        },
        method: "POST",
        raw: { url: "/encounters/encounter-2/combat-round/attack" },
        url: "/encounters/encounter-2/combat-round/attack",
      } as never,
      () => {
        recordCombatPerformanceCheckpoint("authentication_complete");
        finishCombatPerformanceRequest(200);
      },
    );

    const output = write.mock.calls.map(([value]) => String(value)).join("");
    expect(output).toContain('"correlationId":"correlation-2"');
    expect(output).toContain('"command":"roll_attack"');
    expect(output).not.toContain("must-not-be-logged");
  });

  it("does not alter an instrumented operation's result", async () => {
    vi.stubEnv("GLANTRI_COMBAT_PERF", "1");
    vi.stubEnv("NODE_ENV", "development");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    let result: { accepted: boolean } | undefined;

    runCombatPerformanceRequest(
      {
        headers: {
          "x-glantri-combat-correlation-id": "correlation-3",
        },
        method: "POST",
        raw: { url: "/encounters/encounter-3/combat-round/attack" },
        url: "/encounters/encounter-3/combat-round/attack",
      } as never,
      () => {
        void timeCombatPerformanceStage("domain_command_execution", async () => ({
          accepted: true,
        })).then((value) => {
          result = value;
        });
      },
    );
    await vi.waitFor(() => expect(result).toEqual({ accepted: true }));
  });
});
