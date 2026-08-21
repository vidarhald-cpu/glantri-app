import { describe, expect, it, vi } from "vitest";

import { startApiServer } from "./server";

describe("API database compatibility startup guard", () => {
  it("checks compatibility before building or listening", async () => {
    const events: string[] = [];
    const assertCompatibility = vi.fn(async () => {
      events.push("compatibility");
      return {
        appliedMigrationCount: 1,
        checksumMismatches: [],
        classification: "equal" as const,
        divergentAppliedMigrations: [],
        incompleteMigrations: [],
        knownMigrationCount: 1,
        pendingMigrations: [],
        safeToQuery: true,
        unknownAppliedMigrations: [],
      };
    });
    const listen = vi.fn(async () => {
      events.push("listen");
    });
    const buildServer = vi.fn(() => {
      events.push("build");
      return { listen } as never;
    });

    await startApiServer({
      assertCompatibility,
      buildServer,
      database: {} as never,
      writeDiagnostic: vi.fn(),
    });

    expect(events).toEqual(["compatibility", "build", "listen"]);
  });

  it("refuses startup without building routes when compatibility is unsafe", async () => {
    const buildServer = vi.fn();
    const diagnostic =
      "Database migration compatibility: database_ahead (applied=2 known=1); " +
      `unknown-applied=20260202000000_newer checksum=${"a".repeat(64)}`;

    await expect(
      startApiServer({
        assertCompatibility: vi.fn(async () => {
          throw new Error(diagnostic);
        }),
        buildServer,
        database: {} as never,
        writeDiagnostic: vi.fn(),
      }),
    ).rejects.toThrow("database_ahead");
    expect(buildServer).not.toHaveBeenCalled();
  });
});
