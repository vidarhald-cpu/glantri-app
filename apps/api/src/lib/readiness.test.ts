import { describe, expect, it, vi } from "vitest";

import { checkReadiness } from "./readiness";

const configuredEnvironment: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgresql://postgres:secret@127.0.0.1:55432/glantri_task_example",
};

const initializedSchema = [{ has_migrations: true, has_session: true, has_user: true }];

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
  it("returns ready when the database responds, the schema exists, and migrations are resolved", async () => {
    const database = createDatabaseMock([1, initializedSchema, [{ unresolved_count: 0 }]]);

    await expect(checkReadiness(database, configuredEnvironment)).resolves.toEqual({
      status: "ready",
    });
    expect(database.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it("returns not ready when migrations are unresolved", async () => {
    const database = createDatabaseMock([1, initializedSchema, [{ unresolved_count: 1 }]]);

    await expect(checkReadiness(database, configuredEnvironment)).resolves.toEqual({
      status: "not_ready",
      reason: "unresolved_migrations",
    });
  });

  it("returns not ready when the database query fails", async () => {
    const database = createDatabaseMock([new Error("connection refused")]);

    await expect(checkReadiness(database, configuredEnvironment)).resolves.toEqual({
      status: "not_ready",
      reason: "database_unavailable",
    });
  });

  it("returns not ready without touching the database when DATABASE_URL is missing", async () => {
    const database = createDatabaseMock([1, initializedSchema, [{ unresolved_count: 0 }]]);

    await expect(checkReadiness(database, {})).resolves.toEqual({
      status: "not_ready",
      reason: "database_not_configured",
    });
    expect(database.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns not ready when DATABASE_URL is blank", async () => {
    const database = createDatabaseMock([]);

    await expect(checkReadiness(database, { DATABASE_URL: "   " })).resolves.toEqual({
      status: "not_ready",
      reason: "database_not_configured",
    });
  });

  it("returns not ready when the connection works but no schema has been applied", async () => {
    const database = createDatabaseMock([
      1,
      [{ has_migrations: false, has_session: false, has_user: false }],
    ]);

    await expect(checkReadiness(database, configuredEnvironment)).resolves.toEqual({
      status: "not_ready",
      reason: "schema_not_initialized",
    });
  });

  it("returns not ready when migration history exists but the authentication tables do not", async () => {
    const database = createDatabaseMock([
      1,
      [{ has_migrations: true, has_session: false, has_user: true }],
    ]);

    await expect(checkReadiness(database, configuredEnvironment)).resolves.toEqual({
      status: "not_ready",
      reason: "schema_not_initialized",
    });
  });

  it("returns not ready when the schema probe itself fails", async () => {
    const database = createDatabaseMock([1, new Error("terminating connection")]);

    await expect(checkReadiness(database, configuredEnvironment)).resolves.toEqual({
      status: "not_ready",
      reason: "database_unavailable",
    });
  });

  it("returns not ready when the migration query fails after the schema probe", async () => {
    const database = createDatabaseMock([1, initializedSchema, new Error("permission denied")]);

    await expect(checkReadiness(database, configuredEnvironment)).resolves.toEqual({
      status: "not_ready",
      reason: "database_unavailable",
    });
  });
});
