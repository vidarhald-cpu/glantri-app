import { describe, expect, it, vi } from "vitest";

import { knownDatabaseMigrations } from "@glantri/database";

import { checkReadiness } from "./readiness";

function createDatabaseMock(results: unknown[]) {
  return {
    $queryRaw: vi.fn().mockImplementation(() => {
      const next = results.shift();

      if (next instanceof Error) {
        return Promise.reject(next);
      }

      return Promise.resolve(next);
    }),
  };
}

describe("readiness checks", () => {
  it("returns ready when the database responds and migrations are resolved", async () => {
    const database = createDatabaseMock([
      [{ migration_table_exists: true }],
      knownDatabaseMigrations.map((migration) => ({
        checksum: migration.checksum,
        finished_at: new Date("2026-01-01T00:00:00Z"),
        migration_name: migration.name,
        rolled_back_at: null,
      })),
    ]);

    await expect(checkReadiness(database)).resolves.toEqual({ status: "ready" });
    expect(database.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("returns ready when the checkout is normally ahead of the database", async () => {
    const database = createDatabaseMock([[{ migration_table_exists: false }]]);

    await expect(checkReadiness(database)).resolves.toEqual({ status: "ready" });
  });

  it("returns not ready when migrations are unresolved", async () => {
    const database = createDatabaseMock([
      [{ migration_table_exists: true }],
      [
        {
          checksum: knownDatabaseMigrations[0].checksum,
          finished_at: null,
          migration_name: knownDatabaseMigrations[0].name,
          rolled_back_at: null,
        },
      ],
    ]);

    await expect(checkReadiness(database)).resolves.toEqual({
      status: "not_ready",
      reason: "unresolved_migrations",
    });
  });

  it("returns a client-safe reason when the database is ahead", async () => {
    const secret = "postgresql://private:password@localhost:5432/glantri";
    const database = createDatabaseMock([
      [{ migration_table_exists: true }],
      [
        {
          checksum: secret,
          finished_at: new Date("2026-01-01T00:00:00Z"),
          migration_name: `newer-${secret}`,
          rolled_back_at: null,
        },
      ],
    ]);
    const result = await checkReadiness(database);

    expect(result).toEqual({
      status: "not_ready",
      reason: "database_incompatible",
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("postgresql://");
  });

  it("returns not ready when the database query fails", async () => {
    const database = createDatabaseMock([
      new Error("postgresql://private:password@localhost:5432/glantri"),
    ]);

    await expect(checkReadiness(database)).resolves.toEqual({
      status: "not_ready",
      reason: "database_unavailable",
    });
  });
});
