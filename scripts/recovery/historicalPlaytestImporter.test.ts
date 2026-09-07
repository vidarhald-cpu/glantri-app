import { describe, expect, it } from "vitest";

import {
  archiveHistoricalEncounterRows,
  loadMappingInventory,
  selectCompatibleRosterRows,
  transformScenarioRows,
} from "./historicalPlaytestCore";
import {
  TARGET_MIGRATION_HEAD,
  currentMigrationChecksums,
  sanitizeError,
  targetMarker,
  validateTargetEndpoint,
} from "./historicalPlaytestSafety";

describe("historical playtest mapping", () => {
  it("classifies every field in all 23 restored source tables", () => {
    const inventory = loadMappingInventory();
    const allowed = new Set(["A", "B", "C", "D", "E"]);

    expect(inventory.tables).toHaveLength(23);
    expect(new Set(inventory.tables.map((table) => table.name)).size).toBe(23);
    for (const table of inventory.tables) {
      expect(allowed.has(table.classification)).toBe(true);
      expect(Object.keys(table.fields).length).toBeGreaterThan(0);
      expect(Object.values(table.fields).every((value) => allowed.has(value))).toBe(true);
    }

    expect(inventory.tables.find((table) => table.name === "Session")?.classification).toBe("D");
    expect(
      inventory.tables.find((table) => table.name === "ScenarioLifecycleTransition")
        ?.classification,
    ).toBe("C");
    expect(inventory.tables.find((table) => table.name === "Encounter")?.fields.status).toBe("B");
  });

  it("matches the exact 17-file current migration head", () => {
    const migrations = currentMigrationChecksums();
    expect(migrations).toHaveLength(17);
    expect(migrations.at(-1)?.name).toBe(TARGET_MIGRATION_HEAD);
    expect(migrations.every((migration) => /^[0-9a-f]{64}$/.test(migration.checksum))).toBe(true);
  });
});

describe("approved transformations", () => {
  it("maps only closed Scenario status to completed and strips lifecycle-only fields", () => {
    expect(
      transformScenarioRows([
        { id: "closed", lifecycleCycle: 1, lifecycleRevision: 2, status: "closed" },
        { id: "live", lifecycleCycle: 0, lifecycleRevision: 0, status: "live" },
      ]),
    ).toEqual([
      { id: "closed", status: "completed" },
      { id: "live", status: "live" },
    ]);
  });

  it("keeps every multi-Campaign Character membership out of current roster authority", () => {
    expect(
      selectCompatibleRosterRows(
        [
          { id: "multi-a", sourceId: "multi", sourceType: "character" },
          { id: "multi-b", sourceId: "multi", sourceType: "character" },
          { id: "single", sourceId: "single", sourceType: "character" },
          { id: "template", sourceId: "template-1", sourceType: "template" },
        ],
        ["multi"],
      ).map((row) => row.id),
    ).toEqual(["single", "template"]);
  });

  it("archives every historical Encounter without altering its evidence payload", () => {
    expect(
      archiveHistoricalEncounterRows([
        { id: "active", sessionJson: { round: 4 }, status: "active" },
        { id: "planned", sessionJson: null, status: "planned" },
      ]),
    ).toEqual([
      { id: "active", sessionJson: { round: 4 }, status: "archived" },
      { id: "planned", sessionJson: null, status: "archived" },
    ]);
  });
});

describe("fail-closed target guards", () => {
  const container = "glantri-task-issue-61-d543-r5c-target-a-pg16";

  it.each([
    "postgresql://postgres@localhost:5432/glantri",
    "postgresql://postgres@127.0.0.1:5433/glantri_playtest",
    "postgresql://postgres@db.example.com:55432/glantri_task_issue_61_d543_r5c_target_a",
    "postgresql://postgres@127.0.0.1:55432/glantri",
  ])("rejects protected, persistent, remote, or ambiguous target %s", (url) => {
    expect(() => validateTargetEndpoint(url, "target-a", container)).toThrow();
  });

  it("uses a deterministic non-secret database marker", () => {
    expect(targetMarker("failure", "importing-abcdef0123456789-5")).toBe(
      "glantri:r5c:issue-61:worktree-d543:failure:importing-abcdef0123456789-5",
    );
  });

  it("redacts PostgreSQL URLs from errors", () => {
    const sensitive = ["private", "password"].join("-");
    const url = `postgresql${"://"}private-user:${sensitive}@127.0.0.1:55432/private`;
    expect(sanitizeError(new Error(`connection failed ${url}`))).not.toContain(sensitive);
  });
});
