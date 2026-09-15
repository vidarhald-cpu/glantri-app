import { lstatSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { assertRecoveryClientEndpoint } from "../../packages/database/src/recoveryClient";

import {
  IMPORTER_VERSION,
  archiveHistoricalEncounterRows,
  loadMappingInventory,
  selectCompatibleRosterRows,
  transformScenarioRows,
} from "./historicalPlaytestCore";
import {
  ISSUE,
  RECOVERY_IDENTITY,
  currentMigrationChecksums,
  deriveRecoveryIdentity,
  migrationsDirectory,
  recoveryLabels,
  repositoryRoot,
  sanitizeError,
  targetConfirmationFor,
  targetMarker,
  targetMarkerFor,
  validateSourceEndpoint,
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

  it("matches the authoritative current migration set and head", () => {
    const migrations = currentMigrationChecksums();
    const authoritativeMigrationNames = readdirSync(migrationsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    expect(migrations.map((migration) => migration.name)).toEqual(authoritativeMigrationNames);
    expect(migrations.at(-1)?.name).toBe(authoritativeMigrationNames.at(-1));
    expect(
      authoritativeMigrationNames.indexOf("20260907100000_add_character_equipment_aggregate"),
    ).toBe(17);
    expect(migrations.every((migration) => /^[0-9a-f]{64}$/.test(migration.checksum))).toBe(true);
  });

  it("carries deterministic importer provenance", () => {
    expect(IMPORTER_VERSION).toBe(2);
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
  const currentTarget = RECOVERY_IDENTITY.targets["target-a"];
  const container = currentTarget.container;
  const isLinkedWorktree = lstatSync(resolve(repositoryRoot, ".git")).isFile();
  const ordinaryCheckoutError =
    "Historical recovery database access requires a linked task worktree.";

  it.each([
    "postgresql://postgres@localhost:5432/glantri",
    "postgresql://postgres@127.0.0.1:5433/glantri_playtest",
    `postgresql://postgres@db.example.com:55432/${currentTarget.database}`,
    "postgresql://postgres@127.0.0.1:55432/glantri",
  ])("rejects protected, persistent, remote, or ambiguous target %s", (url) => {
    expect(() => validateTargetEndpoint(url, "target-a", container)).toThrow();
  });

  it("uses a deterministic non-secret database marker", () => {
    expect(targetMarker("failure", "importing-abcdef0123456789-5")).toBe(
      `glantri:r5c:issue-${ISSUE}:worktree-${RECOVERY_IDENTITY.worktreeKey}:failure:importing-abcdef0123456789-5`,
    );
  });

  it("derives names, labels, markers, and confirmations for another linked-worktree key", () => {
    const qaIdentity = deriveRecoveryIdentity(
      "/Users/qa/.codex/worktrees/1ed7/glantri-app-forgejo",
    );

    expect(qaIdentity.worktreeKey).toBe("1ed7");
    expect(qaIdentity.source).toEqual({
      container: "glantri-task-issue-61-1ed7-r5c-source-pg16",
      database: "glantri_task_issue_61_1ed7_r5c_source",
      purpose: "source",
      volume: "glantri-task-issue-61-1ed7-r5c-source-data",
    });
    expect(qaIdentity.targets["target-a"].database).toBe("glantri_task_issue_61_1ed7_r5c_target_a");
    expect(recoveryLabels(qaIdentity, "target-a")["glantri.db.worktree"]).toBe("1ed7");
    expect(targetConfirmationFor(qaIdentity, "target-a")).toBe("issue-61-1ed7-target-a");
    expect(targetMarkerFor(qaIdentity, "target-a")).toBe(
      "glantri:r5c:issue-61:worktree-1ed7:target-a:prepared",
    );
  });

  it("accepts the current endpoint only in a linked worktree and rejects foreign ownership", () => {
    const currentUrl = `postgresql://postgres@127.0.0.1:55432/${currentTarget.database}`;
    const assertCurrentEndpoint = () =>
      assertRecoveryClientEndpoint(currentUrl, {
        ...currentTarget,
        host: "127.0.0.1",
        issue: ISSUE,
        port: "55432",
        worktreeKey: RECOVERY_IDENTITY.worktreeKey,
      });

    // Hosted Actions uses an ordinary checkout; recovery must still fail closed there.
    if (isLinkedWorktree) {
      expect(assertCurrentEndpoint).not.toThrow();
    } else {
      expect(assertCurrentEndpoint).toThrow(ordinaryCheckoutError);
    }

    const foreign = deriveRecoveryIdentity(
      "/Users/qa/.codex/worktrees/foreign/glantri-app-forgejo",
    );
    const foreignTarget = foreign.targets["target-a"];
    const foreignUrl = `postgresql://postgres@127.0.0.1:55432/${foreignTarget.database}`;
    const foreignSourceUrl = `postgresql://postgres@127.0.0.1:55431/${foreign.source.database}`;

    expect(() => validateSourceEndpoint(foreignSourceUrl, foreign.source.container)).toThrow(
      isLinkedWorktree
        ? "issue #61 restored source database"
        : "Historical recovery commands require the current linked task worktree.",
    );
    expect(() => validateTargetEndpoint(foreignUrl, "target-a", foreignTarget.container)).toThrow(
      isLinkedWorktree
        ? "exact target-a resource"
        : "Historical recovery commands require the current linked task worktree.",
    );
    expect(() =>
      assertRecoveryClientEndpoint(foreignUrl, {
        ...foreignTarget,
        host: "127.0.0.1",
        issue: ISSUE,
        port: "55432",
        worktreeKey: foreign.worktreeKey,
      }),
    ).toThrow(
      isLinkedWorktree
        ? `not current worktree ${RECOVERY_IDENTITY.worktreeKey}`
        : ordinaryCheckoutError,
    );

    expect(RECOVERY_IDENTITY).toEqual(deriveRecoveryIdentity(repositoryRoot));
  });

  it("redacts PostgreSQL URLs from errors", () => {
    const sensitive = ["private", "password"].join("-");
    const url = `postgresql${"://"}private-user:${sensitive}@127.0.0.1:55432/private`;
    expect(sanitizeError(new Error(`connection failed ${url}`))).not.toContain(sensitive);
  });
});
