import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mergeCombatPerformanceClientCapture,
  persistCombatPerformanceServerCapture,
  reserveCombatPerformanceCapture,
  resetCombatPerformanceCapturesForTests,
} from "./combatPerformanceCapture";

let captureDirectory: string;

beforeEach(() => {
  captureDirectory = mkdtempSync(`${tmpdir()}/glantri-combat-perf-capture-`);
  vi.stubEnv("GLANTRI_COMBAT_PERF_DIR", captureDirectory);
  vi.stubEnv("GLANTRI_COMBAT_PERF", "1");
  vi.stubEnv("NODE_ENV", "development");
  resetCombatPerformanceCapturesForTests();
});

afterEach(() => {
  rmSync(captureDirectory, { force: true, recursive: true });
  resetCombatPerformanceCapturesForTests();
  vi.unstubAllEnvs();
});

function persistCapture(correlationId: string): string {
  reserveCombatPerformanceCapture({
    command: "complete_modifier_review",
    correlationId,
  });
  return persistCombatPerformanceServerCapture({
    archivedRoundCount: 4,
    broadEncounterReads: 1,
    command: "complete_modifier_review",
    commandCount: 3,
    correlationId,
    encounterId: "encounter-1",
    participantCount: 2,
    repositoryOperations: 4,
    revision: "revision-5",
    roundNumber: 5,
    stages: [
      { durationMs: 12.5, stage: "repository_read_full_encounter" },
      { durationMs: 3.25, stage: "repository_write_transaction" },
      {
        durationMs: 0.4,
        payloadBytes: 2048,
        stage: "response_serialization_probe",
      },
      { durationMs: 22.5, stage: "api_total", statusCode: 200 },
    ],
  })!;
}

describe("combat performance capture persistence", () => {
  it("merges server and bounded client metadata into one JSON file", () => {
    const path = persistCapture("correlation-1");
    expect(
      mergeCombatPerformanceClientCapture({
        client: {
          clickToSettledMs: 40,
          followUpRequests: [{ method: "GET", path: "/encounters/encounter-1/history" }],
          participantSheet: "must-not-be-written",
          reactCommitMs: 4,
          renderCount: 2,
          requestCount: 2,
          stages: [
            { durationMs: 20, path: "/encounters/encounter-1/combat-round", stage: "network" },
          ],
        },
        correlationId: "correlation-1",
      }),
    ).toBe(path);

    const capture = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    expect(capture).toMatchObject({
      archivedRoundCount: 4,
      client: {
        clickToSettledMs: 40,
        renderCount: 2,
        requestCount: 2,
      },
      command: "complete_modifier_review",
      correlationId: "correlation-1",
      responseBytes: 2048,
      round: 5,
      server: {
        apiTotalMs: 22.5,
        broadEncounterReads: 1,
        compatibilityReadMs: 12.5,
        repositoryOperations: 4,
        serializationMs: 0.4,
        writeMs: 3.25,
      },
      version: 1,
    });
    expect(readFileSync(path, "utf8")).not.toContain("must-not-be-written");
  });

  it("merges an early client capture after the server record arrives", () => {
    reserveCombatPerformanceCapture({
      command: "complete_modifier_review",
      correlationId: "correlation-early",
    });
    expect(
      mergeCombatPerformanceClientCapture({
        client: {
          clickToSettledMs: 10,
          followUpRequests: [],
          renderCount: 1,
          requestCount: 1,
          stages: [],
        },
        correlationId: "correlation-early",
      }),
    ).toBeTruthy();

    const path = persistCombatPerformanceServerCapture({
      broadEncounterReads: 0,
      command: "complete_modifier_review",
      correlationId: "correlation-early",
      repositoryOperations: 1,
      stages: [{ durationMs: 6, stage: "api_total" }],
    })!;
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({
      client: { clickToSettledMs: 10 },
      server: { apiTotalMs: 6 },
    });
  });

  it("persists a bounded client-only archived-inspection capture", () => {
    const path = mergeCombatPerformanceClientCapture({
      client: {
        clickToSettledMs: 18,
        followUpRequests: [],
        renderCount: 1,
        requestCount: 0,
        responseBytes: 4096,
        stages: [
          {
            archivedRoundCount: 4,
            command: "inspect_archived_tracker_cell",
            durationMs: 0,
            encounterId: "encounter-1",
            participantCount: 2,
            revision: "revision-5",
            roundNumber: 3,
            stage: "click",
          },
          {
            durationMs: 12,
            historical: true,
            stage: "panel_historical_snapshot_resolution",
          },
          {
            archivedRoundCount: 4,
            durationMs: 0,
            stage: "tracker_view_model",
          },
        ],
      },
      correlationId: "correlation-client-only",
    });

    expect(path).toBeTruthy();
    expect(JSON.parse(readFileSync(path!, "utf8"))).toMatchObject({
      archivedRoundCount: 4,
      client: {
        clickToSettledMs: 18,
        requestCount: 0,
      },
      command: "inspect_archived_tracker_cell",
      correlationId: "correlation-client-only",
      encounterId: "encounter-1",
      participantCount: 2,
      responseBytes: 4096,
      revision: "revision-5",
      round: 3,
      server: {
        broadEncounterReads: 0,
        repositoryOperations: 0,
        stages: [],
      },
    });
  });

  it("rotates old captures and is disabled outside the explicit development flag", () => {
    vi.stubEnv("GLANTRI_COMBAT_PERF_MAX_FILES", "2");
    persistCapture("correlation-a");
    persistCapture("correlation-b");
    persistCapture("correlation-c");
    expect(readdirSync(captureDirectory).filter((file) => file.endsWith(".json"))).toHaveLength(2);

    vi.stubEnv("GLANTRI_COMBAT_PERF", "");
    expect(
      persistCombatPerformanceServerCapture({
        broadEncounterReads: 0,
        command: "disabled",
        correlationId: "correlation-disabled",
        repositoryOperations: 0,
        stages: [],
      }),
    ).toBeUndefined();
    expect(readdirSync(captureDirectory).filter((file) => file.endsWith(".json"))).toHaveLength(2);
  });
});
